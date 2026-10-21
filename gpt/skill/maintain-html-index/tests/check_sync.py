#!/usr/bin/env python3
"""Real file changes, conversion and HTTP sync in a temporary folder."""
import hashlib,json,os,subprocess,sys,tempfile,threading,time,urllib.request,urllib.error,shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from serve_editor import make_server
skill=Path(__file__).resolve().parents[1]
root=Path(tempfile.mkdtemp(prefix='index-sync-test-'))
def build(*args):subprocess.run([sys.executable,str(skill/'scripts/build_folder_index.py'),str(root),*args],check=True,capture_output=True)
def manifest():return json.loads((root/'.file-index/manifest.json').read_text())
def wait_for(predicate,timeout=45):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  if predicate():return
  time.sleep(.15)
 raise AssertionError('sync timed out: '+str(server.editor.sync.status()))
def request(path):
 try:
  with urllib.request.urlopen(base+'/'+path,timeout=5) as r:return r.status,r.read(),r.headers
 except urllib.error.HTTPError as e:return e.code,e.read(),e.headers
server=None
try:
 (root/'assets').mkdir();(root/'assets/data.txt').write_text('dependency')
 (root/'ignored').mkdir();(root/'ignored/private.txt').write_text('Excluded')
 (root/'folder').mkdir();src=root/'folder/note.md';src.write_text('# First\n\nBefore.\n\n## Second\n\nTail.')
 build('--title','Preserved title','--exclude','ignored','--max-pages','3')
 server=make_server(root,watch=True,interval=.15,settle=.2);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'+server.editor.prefix
 wait_for(lambda:server.editor.sync.status()['state']=='ready')
 assert manifest()['build_options']['exclude']==['ignored'] and manifest()['build_options']['max_pages']==3
 assert b'Preserved title' in request('00%20-%20%E6%96%87%E4%BB%B6%E7%B4%A2%E5%BC%95.html')[1]
 old=manifest()['files'][0];oldurl=old['preview'];assert b'sync-config' in request(oldurl)[1]
 version=server.editor.sync.status()['version'];src.write_text('# First\n\nAfter edit.\n\n## Second\n\nTail.')
 wait_for(lambda:server.editor.sync.status()['version']>version)
 assert 'After edit.' in (root/urllib.parse.unquote(oldurl)).read_text();assert b'After edit.' in request(oldurl)[1]
 version=server.editor.sync.status()['version'];added=root/'new.txt';added.write_text('new source')
 wait_for(lambda:server.editor.sync.status()['version']>version)
 assert {r['path'] for r in manifest()['files']}=={'folder/note.md','new.txt'}
 version=server.editor.sync.status()['version'];src.rename(root/'renamed.md')
 wait_for(lambda:server.editor.sync.status()['version']>version)
 assert request(oldurl)[0]==410;assert not (root/urllib.parse.unquote(oldurl)).exists()
 renamed=next(r for r in manifest()['files'] if r['path']=='renamed.md');assert b'data-edit-block' in request(renamed['preview'])[1]
 version=server.editor.sync.status()['version'];(root/'renamed.md').unlink();shutil.rmtree(root/'folder')
 assert request(renamed['preview'])[0]==410,'missing sources blocked before next rebuild'
 wait_for(lambda:server.editor.sync.status()['version']>version)
 assert {r['path'] for r in manifest()['files']}=={'new.txt'};assert not manifest()['directories']
 # Neither generated files, snapshots nor Office lock files retrigger a build.
 version=server.editor.sync.status()['version'];(root/'~$new.docx').write_text('lock')
 (root/'.file-index/history').mkdir(exist_ok=True);(root/'.file-index/history/test').write_text('backup')
 (root/'ignored/private.txt').write_text('Excluded update');time.sleep(1)
 assert server.editor.sync.status()['version']==version
 # Changes to non-indexed dependencies trigger one build, not an endless loop.
 (root/'assets/data.txt').write_text('changed dependency')
 wait_for(lambda:server.editor.sync.status()['version']>version)
 version=server.editor.sync.status()['version'];time.sleep(1);assert server.editor.sync.status()['version']==version
 assert request('_sync')[0]==200 and json.loads(request('_sync')[1])['protocol']==2
 assert request('.file-index/editor-private/session.json')[0]==403
 print('PASS: real source edits/additions/rename/deletion, retired previews, new-file editing, preserved options, assets, debounce/no feedback, HTTP status and private paths.')
finally:
 if server:server.shutdown();server.server_close()
 shutil.rmtree(root)
