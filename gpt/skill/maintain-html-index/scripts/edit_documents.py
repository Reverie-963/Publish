"""Text-only edits with revision checks; no HTML-to-document round trip."""
import copy, difflib, hashlib, html, io, json, os, re, shutil, subprocess, tempfile, zipfile
from pathlib import Path
from lxml import etree as ET
from build_folder_index import SKILL, outline
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS={'w':W,'a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def q(name):return '{'+W+'}'+name
def sha(data):return hashlib.sha256(data).hexdigest()
def xml(data):return ET.fromstring(data,ET.XMLParser(resolve_entities=False,no_network=True))
def esc(s):return html.escape(s,quote=True)

def convert(data,extension,target):
 binary=os.environ.get('INDEX_SOFFICE') or shutil.which('soffice')
 if not binary:raise ValueError('缺少 Word 格式转换工具')
 with tempfile.TemporaryDirectory(prefix='index-edit-word-') as temp:
  folder=Path(temp);src=folder/('source'+extension);src.write_bytes(data);dest=folder/'converted';dest.mkdir()
  format_name='doc:MS Word 97' if target=='.doc' else 'docx:Office Open XML Text'
  r=subprocess.run([binary,'-env:UserInstallation='+(folder/'profile').as_uri(),'--headless','--convert-to',format_name,'--outdir',str(dest),str(src)],capture_output=True,timeout=120)
  result=dest/('source'+target)
  if r.returncode or not result.exists():raise ValueError('Word 转换失败，未写入原件')
  return result.read_bytes()

def word_package(data,extension):return convert(data,'.doc','.docx') if extension=='.doc' else data

def paragraph_text(p):
 return ''.join(n.text or '' if n.tag==q('t') else '\t' if n.tag==q('tab') else '\n' for n in p.iter() if n.tag in {q('t'),q('br'),q('tab')})

def editable(p):
 # Only patch ordinary text runs. Fields, tracked edits, links, drawings and math
 # remain untouched rather than being flattened or silently destroyed.
 return all(c.tag in {q('pPr'),q('r')} for c in p) and all(c.tag in {q('rPr'),q('t'),q('br'),q('tab')} for r in p.findall(q('r')) for c in r)

def word_model(package):
 z=zipfile.ZipFile(io.BytesIO(package));root=xml(z.read('word/document.xml'))
 settings=xml(z.read('word/settings.xml')) if 'word/settings.xml' in z.namelist() else None
 if settings is not None and (settings.find(q('documentProtection')) is not None or settings.find(q('trackRevisions')) is not None):raise ValueError('文档有编辑保护或修订模式，请在 Word 中处理')
 paragraphs=list(root.iter(q('p')));indices={id(p):i for i,p in enumerate(paragraphs)};blocks={};heads=[]
 # Resolve named paragraph styles without changing the source styles.
 styles={}
 if 'word/styles.xml' in z.namelist():
  for st in xml(z.read('word/styles.xml')).findall(q('style')):
   name=st.find(q('name'));styles[st.get(q('styleId'))]=name.get(q('val'),'') if name is not None else ''
 relationships={}
 if 'word/_rels/document.xml.rels' in z.namelist():
  for r in xml(z.read('word/_rels/document.xml.rels')):relationships[r.get('Id')]=r.get('Target','')
 def paragraph(p):
  i=indices[id(p)];key='p-'+str(i);text=paragraph_text(p);style=p.find('w:pPr/w:pStyle',NS);style_name=styles.get(style.get(q('val')),'') if style is not None else ''
  match=re.search(r'(?:heading|标题)\s*([1-6])',style_name,re.I);tag='h'+match[1] if match else 'p'
  if match and text:heads.append((key,text,int(match[1])-1))
  if editable(p):
   blocks[key]={'text':text,'paragraph':i}
   content=''.join(run_html(r) for r in p.findall(q('r')))
   return '<'+tag+' id="'+key+'" data-edit-block="'+key+'">'+(content or '<br>')+'</'+tag+'>'
  content=esc(text).replace('\n','<br>')
  # Embedded pictures remain visible and unmodified. Unsupported objects are explicit.
  for blip in p.findall('.//a:blip',NS):
   target=relationships.get(blip.get('{'+NS['r']+'}embed'),'');part='word/'+target
   if part in z.namelist():
    import base64,mimetypes
    content+='<img alt="文档图片" src="data:'+ (mimetypes.guess_type(part)[0] or 'image/png')+';base64,'+base64.b64encode(z.read(part)).decode()+'">'
  if p.find('.//{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath') is not None:content+='<span class="notice">［公式请在原件中查看、编辑］</span>'
  return '<'+tag+' id="'+key+'" title="此段包含复杂对象，请在 Word 中编辑">'+(content or '［文档对象，请查看原件］')+'</'+tag+'>'
 def children(parent):
  chunks=[]
  for element in parent:
   if element.tag==q('p'):chunks.append(paragraph(element))
   elif element.tag==q('tbl'):
    rows=[]
    for tr in element.findall(q('tr')):
     cells=[]
     for tc in tr.findall(q('tc')):
      span=tc.find('w:tcPr/w:gridSpan',NS);attrs=' colspan="'+esc(span.get(q('val')))+'"' if span is not None else ''
      cells.append('<td'+attrs+'>'+children(tc)+'</td>')
     rows.append('<tr>'+''.join(cells)+'</tr>')
    chunks.append('<div class="table-scroll"><table>'+''.join(rows)+'</table></div>')
   elif element.tag not in {q('sectPr'),q('tcPr')}:
    # Read-only text for uncommon structures; never expose it as a writable block.
    text=''.join(element.itertext());chunks.append('<p title="复杂内容，请在 Word 中编辑">'+esc(text)+'</p>')
  return ''.join(chunks)
 def run_html(r):
  text=paragraph_text(r);content=esc(text).replace('\n','<br>').replace('\t','&#9;');props=r.find(q('rPr'))
  if props is not None:
   for name,tag in [('b','strong'),('i','em'),('u','u')]:
    item=props.find(q(name))
    if item is not None and item.get(q('val')) not in {'0','false','none'}:content='<'+tag+'>'+content+'</'+tag+'>'
  return content
 body=children(root.find(q('body')))
 if not paragraphs:blocks['p-0']={'text':'','paragraph':0};body='<p id="p-0" data-edit-block="p-0"><br></p>'
 return {'body':outline(heads)+body,'blocks':blocks}

def patch_word(package,block,text):
 z=zipfile.ZipFile(io.BytesIO(package));root=xml(z.read('word/document.xml'));paragraphs=list(root.iter(q('p')))
 p=paragraphs[block['paragraph']] if paragraphs else ET.SubElement(root.find(q('body')),q('p'))
 if not editable(p):raise ValueError('此段包含复杂对象，未改动原件')
 old=paragraph_text(p);runs=p.findall(q('r'))
 if not runs:runs=[ET.SubElement(p,q('r'))]
 owners=[]
 for i,r in enumerate(runs):owners.extend([i]*len(paragraph_text(r)))
 chunks=['']*len(runs)
 for kind,a,b,c,d in difflib.SequenceMatcher(a=old,b=text,autojunk=False).get_opcodes():
  if kind=='delete':continue
  for offset,char in enumerate(text[c:d]):
   at=a+offset if kind=='equal' else min(a+offset,max(a,b-1))
   owner=owners[min(at,len(owners)-1)] if owners else 0
   chunks[owner]+=char
 for r,chunk in zip(runs,chunks):
  for n in list(r):
   if n.tag!=q('rPr'):r.remove(n)
  for part in re.split('(\n|\t)',chunk):
   if part=='\n':ET.SubElement(r,q('br'))
   elif part=='\t':ET.SubElement(r,q('tab'))
   elif part:
    n=ET.SubElement(r,q('t'));n.set('{http://www.w3.org/XML/1998/namespace}space','preserve');n.text=part
 result=io.BytesIO()
 with zipfile.ZipFile(result,'w') as output:
  for item in z.infolist():output.writestr(item,ET.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True) if item.filename=='word/document.xml' else z.read(item.filename))
 return result.getvalue()

def markdown_model(source,out,mapping,text=None):
 payload={'source':str(source),'output':str(out),'mapping':mapping,'editable':True}
 if text is not None:payload['text']=text
 r=subprocess.run(['node',str(SKILL/'scripts/render_markdown.cjs')],input=json.dumps(payload),capture_output=True,text=True)
 if r.returncode:raise ValueError('Markdown 编辑内容无法预览：'+r.stderr[-150:])
 data=json.loads(r.stdout);content=source.read_bytes().decode('utf8') if text is None else text
 lines=content.splitlines(keepends=True);offsets=[0]
 for line in lines:offsets.append(offsets[-1]+len(line))
 for block in data['blocks'].values():
  a,b=block.pop('lines');start=offsets[a];end=offsets[min(b,len(lines))]
  if start==0 and content.startswith('\ufeff'):start=1
  while end>start and content[end-1] in '\r\n':end-=1
  block.update(start=start,end=end,text=content[start:end])
 return data

def atomic_save(path,data,expected,backup_dir):
 if sha(path.read_bytes())!=expected:raise ValueError('原文件已在其他地方修改；当前输入尚未写入，请保留输入并重新打开')
 original=path.read_bytes();backup_dir.mkdir(parents=True,exist_ok=True)
 backup=backup_dir/(expected+path.suffix)
 if not backup.exists():backup.write_bytes(original)
 fd,name=tempfile.mkstemp(prefix='.'+path.name+'-edit-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())
  os.chmod(name,path.stat().st_mode&0o777)
  if sha(path.read_bytes())!=expected:raise ValueError('保存时发现外部修改，已停止写入')
  os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)
 return sha(data)
