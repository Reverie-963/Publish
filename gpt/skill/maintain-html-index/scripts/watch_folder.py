#!/usr/bin/env python3
"""Debounced local source monitoring; generated files and backups never feed back."""
import json, os, subprocess, sys, threading, time
from pathlib import Path

class FolderSync:
 def __init__(self,root,on_update,interval=2,settle=2):
  self.root=Path(root);self.on_update=on_update;self.interval=interval;self.settle=settle
  self.options=json.loads((self.root/'.file-index/manifest.json').read_text()).get('build_options')
  if not self.options:raise ValueError('请先按原有选项重新生成一次索引，再开启自动同步')
  self.stop_event=threading.Event();self.lock=threading.Lock();self.process=None;self.thread=None
  self.version=0;self.state='starting';self.error='';self.last_success=None
 def status(self):
  with self.lock:return {'version':self.version,'state':self.state,'error':self.error,'last_success':self.last_success}
 def set_state(self,state,error=''):
  with self.lock:self.state=state;self.error=error
 def snapshot(self):
  if not self.root.is_dir():raise OSError('资料文件夹暂时不可用')
  result={};excluded={'node_modules','__pycache__',*self.options.get('exclude',[])};entry=self.options['name']
  def fail(error):raise error
  for directory,dirs,files in os.walk(self.root,onerror=fail):
   dirs[:]=sorted(d for d in dirs if not d.startswith('.') and d not in excluded and not (Path(directory)/d).is_symlink())
   for name in dirs:result[(Path(directory)/name).relative_to(self.root).as_posix()+'/']=()
   for name in files:
    p=Path(directory)/name;relative=p.relative_to(self.root).as_posix()
    if p.is_symlink() or name.startswith(('.','~$')) or relative in {entry,entry+'.tmp'}:continue
    if not self.options.get('include_originals') and name.endswith(('.original.md','.original.html')):continue
    if name=='index.html' or (p.suffix=='.html' and p.with_suffix('.md').exists()):
     with p.open(errors='replace') as stream:prefix=stream.read(500)
     if any(mark in prefix for mark in ['codex-folder-index v2','codex-md-reader v1','codex-index-state:start']):continue
    stat=p.stat();result[relative]=(stat.st_size,stat.st_mtime_ns,stat.st_ino)
  links=self.options.get('links')
  if links:
   p=Path(links);p=p if p.is_absolute() else self.root/p
   stat=p.stat();result['@links']=(stat.st_size,stat.st_mtime_ns)
  return result
 def command(self,force=False):
  o=self.options;args=[sys.executable,str(Path(__file__).with_name('build_folder_index.py')),str(self.root),'--name',o['name']]
  for key in ['title','max_pages','max_cells','max_text_bytes']:
   if o.get(key) is not None:args.extend(['--'+key.replace('_','-'),str(o[key])])
  for value in o.get('exclude',[]):args.extend(['--exclude',value])
  if o.get('include_originals'):args.append('--include-originals')
  if o.get('links'):
   p=Path(o['links']);args.extend(['--links',str(p if p.is_absolute() else self.root/p)])
  if force:args.append('--force')
  return args
 def run(self):
  previous=None;successful=None;changed_at=time.monotonic();retry_at=0
  while not self.stop_event.wait(self.interval):
   try:
    current=self.snapshot();now=time.monotonic()
    if current!=previous:previous=current;changed_at=now;self.set_state('pending')
    if current==successful:self.set_state('ready');continue
    if now-changed_at<self.settle or now<retry_at:continue
    # Dependencies such as Markdown images are not separate indexed sources.
    manifest=json.loads((self.root/'.file-index/manifest.json').read_text());indexed={r['path'] for r in manifest['files']}
    changed=set(current) if successful is None else {p for p in set(current)|set(successful) if current.get(p)!=successful.get(p)}
    force=successful is None or any(p not in indexed and not p.endswith('/') for p in changed)
    self.set_state('building')
    self.process=subprocess.Popen(self.command(force),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:out,err=self.process.communicate(timeout=600)
    except subprocess.TimeoutExpired:
     self.process.kill();self.process.communicate();raise RuntimeError('转换耗时过长，将稍后重试')
    if self.stop_event.is_set():break
    if self.process.returncode:raise RuntimeError((err or out or '预览更新失败')[-500:])
    self.on_update()
    if self.snapshot()!=current:self.set_state('pending');continue
    successful=current
    with self.lock:self.version+=1;self.state='ready';self.error='';self.last_success=time.time()
   except Exception as error:
    self.set_state('error',str(error));retry_at=time.monotonic()+10
   finally:self.process=None
 def start(self):
  self.thread=threading.Thread(target=self.run,daemon=True,name='folder-preview-sync');self.thread.start();return self
 def close(self):
  self.stop_event.set()
  process=self.process
  if process and process.poll() is None:process.terminate()
  if self.thread:self.thread.join(timeout=3)
