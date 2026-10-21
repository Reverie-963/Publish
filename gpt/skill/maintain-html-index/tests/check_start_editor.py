"""A fresh folder gains editing through the public startup entry; no sample paths."""
import json,os,re,signal,subprocess,sys,tempfile,time,urllib.request
from pathlib import Path
scripts=Path(__file__).resolve().parents[1]/'scripts'
with tempfile.TemporaryDirectory(prefix='index-new-folder-') as directory:
 root=Path(directory);(root/'新文稿.md').write_text('# New folder\n\nOriginal text.\n')
 (root/'计算.m').write_text('x = 1;\n')
 def launch():
  result=subprocess.run([sys.executable,str(scripts/'start_editor.py'),str(root)],capture_output=True,text=True,timeout=60)
  assert result.returncode==0,result.stderr
  return json.loads(result.stdout)
 info=launch()
 try:
  assert info['editor_version']==4 and launch()['pid']==info['pid']
  base=info['url'].rsplit('/',1)[0]
  manifest=json.loads((root/'.file-index/manifest.json').read_text())
  for record in manifest['files']:
   body=urllib.request.urlopen(base+'/'+record['preview']).read().decode()
   config=json.loads(re.search(r'<script type="application/json" id="edit-config">(.*?)</script>',body,re.S).group(1))
   key,block=list(config['blocks'].items())[-1]
   data={'id':config['id'],'revision':config['revision'],'block':key,**block,'old':block['text'],'text':block['text']+' changed','request_id':record['id']}
   origin=base[:base.index('/',len('http://'))]
   req=urllib.request.Request(origin+config['endpoint'],data=json.dumps(data).encode(),headers={'Origin':origin,'X-Edit-Key':config['writeKey'],'Content-Type':'application/json'})
   assert urllib.request.urlopen(req).status==200
   assert 'changed' in (root/record['path']).read_text()
  print('PASS: new unrelated folder bootstrap, service reuse, Markdown and MATLAB real HTTP writes')
 finally:
  # Kill only the process group launched for this disposable test.
  os.killpg(info['pid'],signal.SIGTERM);time.sleep(.2)
