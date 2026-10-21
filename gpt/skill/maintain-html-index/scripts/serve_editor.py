#!/usr/bin/env python3
"""Loopback-only inline editor. Run explicitly for a user-selected index folder."""
import argparse, json, mimetypes, os, re, secrets, threading, urllib.parse, subprocess, sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from edit_documents import sha, word_package, word_model, patch_word, markdown_model, atomic_save, convert
from build_folder_index import SKILL, page, rel, TEXT

EDIT_TEXT=TEXT|{'.csv','.tsv','.html','.htm','.markdown','.jsx','.tsx','.rs','.go','.java','.sql','.r','.ipynb'}
NATIVE={'.doc','.docx','.odt','.rtf','.xls','.xlsx','.ods','.ppt','.pptx','.odp','.pdf','.png','.jpg','.jpeg','.gif','.webp','.tif','.tiff','.bmp','.heic','.mp3','.wav','.m4a','.mp4','.mov'}

def highlighted(text,name):
 result=subprocess.run(['node',str(SKILL/'scripts/highlight_code.cjs')],input=json.dumps({'code':text,'filename':name}),capture_output=True,text=True,timeout=30)
 if result.returncode:raise ValueError('文本着色失败，未保存')
 return result.stdout

class Editor:
 def __init__(self,root):
  self.root=root.resolve();self.manifest=json.loads((root/'.file-index/manifest.json').read_text());self.lock=threading.RLock();self.cache={};self.sync=None;self.receipts={}
  self.records={r['id']:r for r in self.manifest['files'] if not r.get('external')}
  self.mapping={str(self.root/r['path']):str(self.root/urllib.parse.unquote(r['preview'])) for r in self.records.values()}
  self.prefix='/'+secrets.token_urlsafe(24);self.write_key=secrets.token_urlsafe(32)
  self.manifest_stamp=(self.root/'.file-index/manifest.json').stat().st_mtime_ns
 def refresh(self):
  path=self.root/'.file-index/manifest.json';stamp=path.stat().st_mtime_ns
  if stamp==self.manifest_stamp:return
  data=json.loads(path.read_text())
  with self.lock:
   self.manifest=data;self.records={r['id']:r for r in data['files'] if not r.get('external')}
   self.mapping={str(self.root/r['path']):str(self.root/urllib.parse.unquote(r['preview'])) for r in self.records.values()}
   self.cache={};self.manifest_stamp=stamp
 def with_sync(self,html):
  if not self.sync:return html
  config={'version':self.sync.status()['version'],'endpoint':self.prefix+'/_sync'}
  tag='<script id="sync-config" type="application/json">'+json.dumps(config)+'</script><script>'+(SKILL/'assets/auto-sync.js').read_text()+'</script>'
  return html.replace('</body>',tag+'</body>')
 def gone(self,name):
  # Retired previews must not keep displaying deleted documents from old caches.
  link=self.prefix+'/'+urllib.parse.quote(self.manifest['entry'])
  html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>文件已移除</title><body style="background:#fafafa;color:#626974;font:16px/1.8 system-ui;margin:48px"><p>文件已删除或移动。</p><a style="color:#7c3aed" href="'+link+'">返回文件索引</a></body></html>'
  return self.with_sync(html)
 def source(self,id):
  r=self.records[id];p=self.root/r['path']
  if p.is_symlink() or not p.resolve().is_relative_to(self.root):raise ValueError('文件路径不可用')
  if p.suffix.lower() not in EDIT_TEXT|{'.md','.docx','.doc'}:raise ValueError('此类型不支持正文编辑')
  return p,r
 def model(self,id):
  src,r=self.source(id);data=src.read_bytes();revision=sha(data);ext=src.suffix.lower();out=self.root/urllib.parse.unquote(r['preview'])
  if ext=='.md':
   model=markdown_model(src,out,self.mapping);package=None
   if not model['blocks']:
    raw=data.decode('utf8');start=1 if raw.startswith('\ufeff') else 0
    model.update(body='<div data-edit-block="block-0"><pre>'+__import__('html').escape(raw[start:])+'</pre></div>',blocks={'block-0':{'start':start,'end':len(raw),'text':raw[start:]}})
  elif ext in EDIT_TEXT:
   if len(data)>1_000_000:raise ValueError('文本超过网页编辑上限，请使用本机编辑器')
   raw=data.decode('utf8');text=raw[1:] if raw.startswith('\ufeff') else raw
   if '\x00' in text:raise ValueError('此文件不是 UTF-8 纯文本，请使用原应用')
   model={'body':'<div data-edit-block="source">'+highlighted(text,src.name)+'</div>','blocks':{'source':{'start':len(raw)-len(text),'end':len(raw),'text':text}}};package=None
  else:
   key=(id,revision)
   if key not in self.cache:self.cache[key]=word_package(data,ext)
   package=self.cache[key];model=word_model(package)
  return src,out,revision,model,package
 def document(self,id):
  src,out,revision,model,package=self.model(id);kind='md' if src.suffix.lower()=='.md' else ('text' if src.suffix.lower() in EDIT_TEXT else 'word')
  title='<h1>'+__import__('html').escape(src.name)+'</h1>'
  body=title+model['body']+'<p><a href="'+rel(out,src)+'" target="_blank" rel="noopener">打开原件</a></p>'
  result=page(src.name,body,out,self.root,self.root/self.manifest['entry'])
  config={'id':id,'revision':revision,'kind':kind,'workspace':sha(str(self.root).encode())[:16],'blocks':model['blocks'],'endpoint':self.prefix+'/_edit','writeKey':self.write_key}
  css=(SKILL/'assets/inline-edit.css').read_text();js=(SKILL/'assets/inline-edit.js').read_text()
  data=json.dumps(config,ensure_ascii=False).replace('<','\\u003c').replace('&','\\u0026')
  return result.replace('</head>','<style>'+css+'</style></head>').replace('</body>','<script type="application/json" id="edit-config">'+data+'</script><script>'+js+'</script></body>')
 def with_native(self,body,id):
  src=self.root/self.records[id]['path']
  if sys.platform!='darwin' or src.suffix.lower() not in NATIVE:return body
  config=json.dumps({'id':id,'source':self.prefix+'/'+urllib.parse.quote(self.records[id]['path']),'endpoint':self.prefix+'/_open','writeKey':self.write_key}).replace('<','\\u003c')
  return body.replace('</body>','<script id="native-config" type="application/json">'+config+'</script><script>'+(SKILL/'assets/native-open.js').read_text()+'</script></body>')
 def open_native(self,request):
  src=self.root/self.records[request['id']]['path']
  if sys.platform!='darwin' or src.suffix.lower() not in NATIVE or src.is_symlink() or not src.resolve().is_relative_to(self.root) or not src.is_file():raise ValueError('无法用本机应用打开此文件')
  result=subprocess.run(['/usr/bin/open',str(src)],capture_output=True,text=True,timeout=15)
  if result.returncode:raise ValueError('未找到可用应用，请在 Finder 中选择编辑器')
  return {'opened':True}
 def save(self,request):
  with self.lock:
   token=request.get('request_id');fingerprint=sha(json.dumps(request,sort_keys=True).encode())
   if token in self.receipts:
    old_fingerprint,result=self.receipts[token]
    if old_fingerprint!=fingerprint:raise ValueError('保存请求标识重复')
    src,_=self.source(request['id'])
    if sha(src.read_bytes())!=result['revision']:raise ValueError('原文件已经变化，未覆盖')
    return result
   src,out,revision,model,package=self.model(request['id'])
   if request.get('revision')!=revision:raise ValueError('原文件已经变化，未覆盖；请保留输入后重新打开')
   text=request['text']
   if not isinstance(text,str) or '\x00' in text or len(text)>1_000_000:raise ValueError('编辑内容不受支持')
   if src.suffix.lower()=='.md' or src.suffix.lower() in EDIT_TEXT:
    original=src.read_bytes().decode('utf8');start,end=request['start'],request['end']
    if not isinstance(start,int) or not isinstance(end,int) or not 0<=start<=end<=len(original):raise ValueError('段落范围已失效')
    if original[start:end]!=request['old']:raise ValueError('段落已经变化，未覆盖')
    # Preserve untouched bytes, including BOM and original line endings.
    raw=src.read_bytes().decode('utf8');original=raw
    if original[start:end]!=request['old']:raise ValueError('换行编码发生变化，请重新打开')
    replacement=text.replace('\r\n','\n')
    if '\r\n' in original:replacement=replacement.replace('\n','\r\n')
    data=(original[:start]+replacement+original[end:]).encode('utf8');next_end=start+len(replacement)
    fragment=markdown_model(src,out,self.mapping,text)['body'] if src.suffix.lower()=='.md' else highlighted(text,src.name)
    if '<aside' in fragment:fragment=fragment[fragment.index('</aside>')+8:]
    result={'start':start,'end':next_end,'delta':len(replacement)-(end-start),'text':replacement,'fragment':fragment}
   else:
    block=model['blocks'].get(request['block'])
    if not block or block['text']!=request['old']:raise ValueError('此段已改变或包含复杂对象，未写入')
    patched=patch_word(package,block,text);data=convert(patched,'.docx','.doc') if src.suffix.lower()=='.doc' else patched
    # A legacy Word round trip must preserve the actual text being edited.
    verify_package=word_package(data,src.suffix.lower());verified_model=word_model(verify_package);verified=verified_model['blocks'].get(request['block'])
    if not verified or verified['text']!=text:raise ValueError('Word 转换未能保留修改，已停止保存')
    match=re.search(r'<(?:p|h[1-6]) id="'+re.escape(request['block'])+r'"[^>]*>(.*?)</(?:p|h[1-6])>',verified_model['body'],re.S)
    result={'text':text,'fragment':match.group(1) if match else __import__('html').escape(text)}
   if sha(data)!=revision:revision=atomic_save(src,data,revision,self.root/'.file-index/history'/request['id'])
   self.cache={}
   result['revision']=revision
   if isinstance(token,str) and 0<len(token)<=100:
    self.receipts[token]=(fingerprint,result.copy())
    if len(self.receipts)>256:self.receipts.pop(next(iter(self.receipts)))
   return result

def make_server(root,port=0,watch=False,interval=2,settle=2):
 editor=Editor(root)
 class Handler(BaseHTTPRequestHandler):
  def send(self,status,body,ctype='application/json; charset=utf-8',sandbox=False):
   data=body.encode() if isinstance(body,str) else body;self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer')
   if sandbox:self.send_header('Content-Security-Policy','sandbox')
   self.end_headers();self.wfile.write(data)
  def valid_host(self):return self.headers.get('Host')=='127.0.0.1:'+str(self.server.server_port)
  def do_GET(self):
   if not self.valid_host():return self.send(403,'{}')
   route=urllib.parse.urlsplit(self.path).path
   if not route.startswith(editor.prefix+'/'):return self.send(404,'{}')
   name=urllib.parse.unquote(route[len(editor.prefix)+1:]);candidate=editor.root/name
   if name=='_sync':
    return self.send(200,json.dumps({'protocol':2,'editor_version':3,'root':str(editor.root),**(editor.sync.status() if editor.sync else {'state':'disabled','version':0})}))
   if not candidate.resolve().is_relative_to(editor.root) or any(part in {'history','editor-private','.git'} for part in Path(name).parts):return self.send(403,'{}')
   if candidate.is_symlink():return self.send(403,'{}')
   try:
    editor.refresh()
    parts=Path(name).parts
    if len(parts)>=3 and parts[:2]==('.file-index','previews'):
     record=next((r for r in editor.manifest['files'] if r['id']==parts[2]),None)
     if record is None or (not record.get('external') and not (editor.root/record['path']).is_file()):return self.send(410,editor.gone(name),'text/html; charset=utf-8')
    if len(parts)>=3 and parts[:2]==('.file-index','folders') and not any(urllib.parse.unquote(r['preview'])==name for r in editor.manifest.get('directories',[])):return self.send(410,editor.gone(name),'text/html; charset=utf-8')
    for id,r in editor.records.items():
     if name==urllib.parse.unquote(r['preview']) and Path(r['path']).suffix.lower() in EDIT_TEXT|{'.md','.docx','.doc'} and r['status']!='error':
      return self.send(200,editor.with_sync(editor.with_native(editor.document(id),id)),'text/html; charset=utf-8')
    if not candidate.is_file():return self.send(404,'{}')
    # Only generated navigation/reader pages may run scripts. Source HTML/SVG and
    # extracted HTML remain sandboxed even if opened outside their usual iframe.
    trusted={editor.manifest['entry'],*[urllib.parse.unquote(r['preview']) for r in editor.records.values()],*[urllib.parse.unquote(r['preview']) for r in editor.manifest.get('directories',[])]}
    mime=mimetypes.guess_type(name)[0] or 'application/octet-stream'
    body=editor.with_sync(candidate.read_text()) if mime=='text/html' and name in trusted else candidate.read_bytes()
    if mime=='text/html' and name in trusted:
     rid=next((id for id,r in editor.records.items() if urllib.parse.unquote(r['preview'])==name),None)
     if rid:body=editor.with_native(body,rid)
    return self.send(200,body,mime,sandbox=mime in {'text/html','image/svg+xml'} and name not in trusted)
   except Exception as e:return self.send(409,'<!doctype html><meta charset="utf-8"><p>'+__import__('html').escape(str(e))+'</p>','text/html; charset=utf-8',True)
  def do_POST(self):
   origin='http://127.0.0.1:'+str(self.server.server_port)
   if not self.valid_host() or self.path not in {editor.prefix+'/_edit',editor.prefix+'/_open'} or self.headers.get('Origin')!=origin or self.headers.get('X-Edit-Key')!=editor.write_key or self.headers.get('Content-Type')!='application/json':return self.send(403,'{}')
   try:
    size=int(self.headers.get('Content-Length','0'))
    if not 0<size<=4_000_000:return self.send(413,'{}')
    editor.refresh();request=json.loads(self.rfile.read(size));result=editor.open_native(request) if self.path.endswith('/_open') else editor.save(request);self.send(200,json.dumps(result,ensure_ascii=False))
   except Exception as e:self.send(409,json.dumps({'error':str(e)},ensure_ascii=False))
  def log_message(self,*args):pass
 class Server(ThreadingHTTPServer):
  def server_close(self):
   if editor.sync:editor.sync.close()
   super().server_close()
 server=Server(('127.0.0.1',port),Handler);server.editor=editor
 if watch:
  from watch_folder import FolderSync
  try:editor.sync=FolderSync(root,editor.refresh,interval,settle).start()
  except Exception:server.server_close();raise
 return server

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('--port',type=int,default=0);parser.add_argument('--ready-file',type=Path);args=parser.parse_args()
 server=make_server(args.root,args.port,watch=True);url='http://127.0.0.1:'+str(server.server_port)+server.editor.prefix+'/'+urllib.parse.quote(server.editor.manifest['entry'])
 info={'url':url,'pid':os.getpid(),'root':str(args.root.resolve()),'protocol':2,'editor_version':3,'sync':True}
 if args.ready_file:args.ready_file.write_text(json.dumps(info,ensure_ascii=False))
 print(json.dumps(info,ensure_ascii=False),flush=True)
 server.serve_forever()
