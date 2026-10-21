#!/usr/bin/env python3
"""Loopback-only inline editor. Run explicitly for a user-selected index folder."""
import argparse, json, mimetypes, os, re, secrets, threading, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from edit_documents import sha, word_package, word_model, patch_word, markdown_model, atomic_save, convert
from build_folder_index import SKILL, page, rel

class Editor:
 def __init__(self,root):
  self.root=root.resolve();self.manifest=json.loads((root/'.file-index/manifest.json').read_text());self.lock=threading.Lock();self.cache={}
  self.records={r['id']:r for r in self.manifest['files'] if not r.get('external')}
  self.mapping={str(self.root/r['path']):str(self.root/urllib.parse.unquote(r['preview'])) for r in self.records.values()}
  self.prefix='/'+secrets.token_urlsafe(24);self.write_key=secrets.token_urlsafe(32)
 def source(self,id):
  r=self.records[id];p=self.root/r['path']
  if p.is_symlink() or not p.resolve().is_relative_to(self.root):raise ValueError('文件路径不可用')
  if p.suffix.lower() not in {'.md','.docx','.doc'}:raise ValueError('此类型不支持正文编辑')
  return p,r
 def model(self,id):
  src,r=self.source(id);data=src.read_bytes();revision=sha(data);ext=src.suffix.lower();out=self.root/urllib.parse.unquote(r['preview'])
  if ext=='.md':
   model=markdown_model(src,out,self.mapping);package=None
   if not model['blocks']:
    raw=data.decode('utf8');start=1 if raw.startswith('\ufeff') else 0
    model.update(body='<div data-edit-block="block-0"><pre>'+__import__('html').escape(raw[start:])+'</pre></div>',blocks={'block-0':{'start':start,'end':len(raw),'text':raw[start:]}})
  else:
   key=(id,revision)
   if key not in self.cache:self.cache[key]=word_package(data,ext)
   package=self.cache[key];model=word_model(package)
  return src,out,revision,model,package
 def document(self,id):
  src,out,revision,model,package=self.model(id);kind='md' if src.suffix.lower()=='.md' else 'word'
  title='<h1>'+__import__('html').escape(src.name)+'</h1>'
  body=title+model['body']+'<p><a href="'+rel(out,src)+'" target="_blank" rel="noopener">打开原件</a></p>'
  result=page(src.name,body,out,self.root,self.root/self.manifest['entry'])
  config={'id':id,'revision':revision,'kind':kind,'workspace':sha(str(self.root).encode())[:16],'blocks':model['blocks'],'endpoint':self.prefix+'/_edit','writeKey':self.write_key}
  css=(SKILL/'assets/inline-edit.css').read_text();js=(SKILL/'assets/inline-edit.js').read_text()
  data=json.dumps(config,ensure_ascii=False).replace('<','\\u003c').replace('&','\\u0026')
  return result.replace('</head>','<style>'+css+'</style></head>').replace('</body>','<script type="application/json" id="edit-config">'+data+'</script><script>'+js+'</script></body>')
 def save(self,request):
  with self.lock:
   src,out,revision,model,package=self.model(request['id'])
   if request.get('revision')!=revision:raise ValueError('原文件已经变化，未覆盖；请保留输入后重新打开')
   text=request['text']
   if not isinstance(text,str) or '\x00' in text or len(text)>1_000_000:raise ValueError('编辑内容不受支持')
   if src.suffix.lower()=='.md':
    original=src.read_bytes().decode('utf8');start,end=request['start'],request['end']
    if not isinstance(start,int) or not isinstance(end,int) or not 0<=start<=end<=len(original):raise ValueError('段落范围已失效')
    if original[start:end]!=request['old']:raise ValueError('段落已经变化，未覆盖')
    # Preserve untouched bytes, including BOM and original line endings.
    raw=src.read_bytes().decode('utf8');original=raw
    if original[start:end]!=request['old']:raise ValueError('换行编码发生变化，请重新打开')
    replacement=text.replace('\r\n','\n')
    if '\r\n' in original:replacement=replacement.replace('\n','\r\n')
    data=(original[:start]+replacement+original[end:]).encode('utf8');next_end=start+len(replacement)
    fragment=markdown_model(src,out,self.mapping,text)['body']
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
   return result

def make_server(root,port=0):
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
   if not candidate.resolve().is_relative_to(editor.root) or any(part in {'history','editor-private','.git'} for part in Path(name).parts):return self.send(403,'{}')
   if candidate.is_symlink():return self.send(403,'{}')
   try:
    for id,r in editor.records.items():
     if name==urllib.parse.unquote(r['preview']) and Path(r['path']).suffix.lower() in {'.md','.docx','.doc'} and r['status']!='error':
      return self.send(200,editor.document(id),'text/html; charset=utf-8')
    if not candidate.is_file():return self.send(404,'{}')
    # Only generated navigation/reader pages may run scripts. Source HTML/SVG and
    # extracted HTML remain sandboxed even if opened outside their usual iframe.
    trusted={editor.manifest['entry'],*[urllib.parse.unquote(r['preview']) for r in editor.records.values()],*[urllib.parse.unquote(r['preview']) for r in editor.manifest.get('directories',[])]}
    mime=mimetypes.guess_type(name)[0] or 'application/octet-stream'
    return self.send(200,candidate.read_bytes(),mime,sandbox=mime in {'text/html','image/svg+xml'} and name not in trusted)
   except Exception as e:return self.send(409,'<!doctype html><meta charset="utf-8"><p>'+__import__('html').escape(str(e))+'</p>','text/html; charset=utf-8',True)
  def do_POST(self):
   origin='http://127.0.0.1:'+str(self.server.server_port)
   if not self.valid_host() or self.path!=editor.prefix+'/_edit' or self.headers.get('Origin')!=origin or self.headers.get('X-Edit-Key')!=editor.write_key or self.headers.get('Content-Type')!='application/json':return self.send(403,'{}')
   try:
    size=int(self.headers.get('Content-Length','0'))
    if not 0<size<=4_000_000:return self.send(413,'{}')
    result=editor.save(json.loads(self.rfile.read(size)));self.send(200,json.dumps(result,ensure_ascii=False))
   except Exception as e:self.send(409,json.dumps({'error':str(e)},ensure_ascii=False))
  def log_message(self,*args):pass
 server=ThreadingHTTPServer(('127.0.0.1',port),Handler);server.editor=editor;return server

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('--port',type=int,default=0);parser.add_argument('--ready-file',type=Path);args=parser.parse_args()
 server=make_server(args.root,args.port);url='http://127.0.0.1:'+str(server.server_port)+server.editor.prefix+'/'+urllib.parse.quote(server.editor.manifest['entry'])
 info={'url':url,'pid':os.getpid(),'root':str(args.root.resolve())}
 if args.ready_file:args.ready_file.write_text(json.dumps(info,ensure_ascii=False))
 print(json.dumps(info,ensure_ascii=False),flush=True)
 server.serve_forever()
