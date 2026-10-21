"""Add heading anchors to a sandboxed HTML copy without changing the source."""
import html, os, re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, unquote

class Headings(HTMLParser):
 def __init__(self,source):
  super().__init__(convert_charrefs=True)
  self.source=source;self.offsets=[0];self.items=[];self.pending=None;self.edits=[];self.ids=set();self.base=None
  for m in re.finditer('\n',source):self.offsets.append(m.end())
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if attrs.get('id'):self.ids.add(attrs['id'])
  if tag=='base' and self.base is None and 'href' in attrs:self.base=attrs['href']
  if re.fullmatch('h[1-6]',tag):
   line,col=self.getpos();self.pending=[self.offsets[line-1]+col,self.get_starttag_text(),int(tag[1]),[]]
 def handle_data(self,data):
  if self.pending:self.pending[3].append(data)
 def handle_endtag(self,tag):
  if self.pending and tag=='h'+str(self.pending[2]):self.items.append(self.pending);self.pending=None

def html_preview(src,out,max_bytes):
 if src.stat().st_size>max_bytes:raise RuntimeError('网页超出文本预览上限，请打开原件')
 # Honour declared legacy encodings where possible; do not guess lossy replacement text.
 raw=src.read_bytes();m=re.search(br'charset\s*=\s*["\']?\s*([\w-]+)',raw[:4096],re.I)
 source=raw.decode(m.group(1).decode('ascii') if m else 'utf-8-sig')
 parser=Headings(source);parser.feed(source)
 entries=[];edits=[]
 for i,(start,tag,level,parts) in enumerate(parser.items):
  label=' '.join(''.join(parts).split())
  if not label:continue
  target='index-heading-'+str(i+1)
  while target in parser.ids:target+='-nav'
  parser.ids.add(target)
  # Preserve existing anchors by inserting a new span before the heading.
  edits.append((start,'<span id="'+target+'"></span>'))
  entries.append((target,label,level))
 if len(entries)<2:
  href='/'.join(quote(x,safe='') for x in Path(os.path.relpath(src,out.parent)).parts)
  return '<iframe title="HTML 原件预览" class="embedded" sandbox="" src="'+href+'"></iframe>'
 for start,insertion in reversed(edits):source=source[:start]+insertion+source[start:]
 # The first base href wins. Resolve any source base against the source location,
 # then express local paths relative to the generated copy so the folder can move.
 resolved=urlsplit(urljoin(src.as_uri(),parser.base or ''))
 if resolved.scheme=='file':
  base='/'.join(quote(x,safe='') for x in Path(os.path.relpath(unquote(resolved.path),out.parent)).parts)
  if resolved.path.endswith('/'):base+='/'
  if resolved.query:base+='?'+resolved.query
  if resolved.fragment:base+='#'+resolved.fragment
 else:base=resolved.geturl()
 addition='<base href="'+html.escape(base,quote=True)+'">'
 head=re.search(r'<head\b[^>]*>',source,re.I)
 if head:at=head.end()
 else:
  opening=re.search(r'<html\b[^>]*>|<!doctype[^>]*>',source,re.I)
  at=opening.end() if opening else 0
  addition='<head>'+addition+'</head>'
 source=source[:at]+addition+source[at:]
 # Output UTF-8 consistently, overriding a legacy charset declaration.
 source=re.sub(r'(charset\s*=\s*["\']?\s*)[\w-]+',r'\1utf-8',source,flags=re.I)
 (out.parent/'content.html').write_text(source,encoding='utf-8')
 depth=min(item[2] for item in entries)
 links=''.join('<a href="content.html#'+target+'" target="document-content" data-frame="embedded-document" style="margin-left:'+str((level-depth)*12)+'px">'+html.escape(label)+'</a>' for target,label,level in entries)
 return '<button class="toc-toggle" aria-expanded="false" aria-controls="reader-toc">目录</button><aside class="toc-panel" id="reader-toc" inert><nav class="toc" aria-label="网页目录">'+links+'</nav></aside><iframe id="embedded-document" name="document-content" title="HTML 原件预览" class="embedded" sandbox="" src="content.html"></iframe>'
