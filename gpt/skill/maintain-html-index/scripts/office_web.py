"""Convert a Writer HTML export to safe, reflowable document content."""
import hashlib, html, re, shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit, quote

class WebDocument(HTMLParser):
    allowed=set('p div span h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td caption ul ol li dl dt dd blockquote pre code strong b em i u s sub sup br hr img a'.split())
    void={'br','hr','img'}
    blocked={'script','style','iframe','object','embed','form','button','input','textarea','select'}
    def __init__(self,export,source,out,mapping):
        super().__init__(convert_charrefs=True)
        self.export,self.source,self.out,self.mapping=export,source,out,mapping
        self.in_body=False;self.skip=[];self.parts=[];self.stack=[];self.words=[];self.headings=[];self.current_heading=None;self.counter=0;self.images=0
    def relative(self,p):
        import os
        return '/'.join(quote(x,safe='') for x in Path(os.path.relpath(p,self.out.parent)).parts)
    def handle_starttag(self,tag,attrs):
        if tag=='body':self.in_body=True;return
        if not self.in_body:return
        if self.skip:
            if tag in self.blocked and tag not in {'input','embed'}:self.skip.append(tag)
            return
        if tag in self.blocked:
            if tag not in {'input','embed'}:self.skip.append(tag)
            return
        if tag not in self.allowed:return
        a=dict(attrs);clean={}
        if a.get('id') or (tag=='a' and a.get('name')):clean['id']=a.get('id') or a['name']
        if tag in {'td','th'}:
            for k in ['colspan','rowspan']:
                if a.get(k,'').isdigit() and 0<int(a[k])<1000:clean[k]=a[k]
        if tag=='ol' and re.fullmatch(r'-?\d+',a.get('start','')):clean['start']=a['start']
        if tag in {'td','th','p','span'}:
            styles=[]
            for pair in a.get('style','').split(';'):
                k,_,v=pair.partition(':');k=k.strip();v=v.strip()
                if k in {'font-weight','font-style','text-align','text-decoration'} and re.fullmatch(r'[a-z0-9 -]+',v):styles.append(k+':'+v)
            if styles:clean['style']=';'.join(styles)
        if tag=='a' and a.get('href'):
            u=a['href'];parts=urlsplit(u)
            if parts.scheme in {'http','https','mailto'}:clean['href']=u
            elif not parts.scheme and not parts.netloc:
                if not parts.path:clean['href']=u
                else:
                    target=(self.source.parent/unquote(parts.path)).resolve()
                    if target.exists():clean['href']=self.relative(Path(self.mapping.get(str(target),target)))+('?' + parts.query if parts.query else '')+('#'+parts.fragment if parts.fragment else '')
        if tag=='img':
            parts=urlsplit(a.get('src',''))
            if parts.scheme or parts.netloc:raise ValueError('网页导出包含非本地图片')
            image=(self.export.parent/unquote(parts.path)).resolve()
            if not image.is_relative_to(self.export.parent.resolve()) or not image.is_file():raise ValueError('网页导出的图片缺失或超出转换目录')
            folder=self.out.parent/'web-assets';folder.mkdir(exist_ok=True)
            dest=folder/(hashlib.sha256(image.read_bytes()).hexdigest()[:16]+image.suffix.lower());shutil.copyfile(image,dest)
            clean.update(src=self.relative(dest),alt=a.get('alt') or a.get('name') or '文档图片',loading='lazy');self.images+=1
        if tag in {'h1','h2','h3','h4','h5','h6'}:
            self.counter+=1;clean.setdefault('id','web-heading-'+str(self.counter));self.current_heading=[clean['id'],[]]
        if tag=='table':self.parts.append('<div class="table-scroll">')
        self.parts.append('<'+tag+''.join(' '+k+'="'+html.escape(v,quote=True)+'"' for k,v in clean.items())+'>')
        if tag not in self.void:self.stack.append(tag)
    def handle_endtag(self,tag):
        if tag=='body':self.in_body=False;return
        if self.skip:
            if tag==self.skip[-1]:self.skip.pop()
            return
        if not self.in_body or tag not in self.stack:return
        while self.stack:
            current=self.stack.pop();self.parts.append('</'+current+'>')
            if current=='table':self.parts.append('</div>')
            if current.startswith('h') and current in {'h1','h2','h3','h4','h5','h6'} and self.current_heading:
                self.headings.append((self.current_heading[0],''.join(self.current_heading[1]).strip()));self.current_heading=None
            if current==tag:break
    def handle_data(self,data):
        if self.in_body and not self.skip:
            self.parts.append(html.escape(data));self.words.append(data)
            if self.current_heading:self.current_heading[1].append(data)
    def result(self):
        if not ''.join(self.words).strip() and not self.images:raise ValueError('网页导出没有可读正文')
        for tag in reversed(self.stack):self.parts.append('</'+tag+'>'+('</div>' if tag=='table' else ''))
        toc=''
        if self.headings:
            links=''.join('<a href="#'+quote(i,safe='')+'">'+html.escape(' '.join(t.split()))+'</a>' for i,t in self.headings)
            toc='<button class="toc-toggle" type="button" aria-expanded="false" aria-controls="reader-toc">目录 →</button><aside class="toc-panel" id="reader-toc" inert><nav class="toc" aria-label="文章目录">'+links+'</nav></aside>'
        return toc+'<section class="document-flow">'+''.join(self.parts)+'</section>'

def writer_html(export,source,out,mapping):
    parser=WebDocument(export,source,out,mapping);parser.feed(export.read_text(encoding='utf-8'));return parser.result()
