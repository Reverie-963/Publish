#!/usr/bin/env python3
"""Start/reuse an explicitly requested local editor without changing the offline index."""
import argparse,json,os,subprocess,sys,time,urllib.request
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);args=parser.parse_args();root=args.root.resolve()
private=root/'.file-index/editor-private';private.mkdir(parents=True,exist_ok=True);os.chmod(private,0o700);ready=private/'session.json'
if ready.exists():
 try:
  previous=json.loads(ready.read_text())
  if previous.get('root')==str(root):
   with urllib.request.urlopen(previous['url'],timeout=2) as response:
    if response.status==200:print(json.dumps(previous,ensure_ascii=False));raise SystemExit(0)
 except (OSError,ValueError,KeyError):pass
 ready.unlink(missing_ok=True)
env=os.environ.copy()
# Prefer the bundled converter when running in the Codex desktop runtime.
bundled=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice'
if bundled.is_file():env.setdefault('INDEX_SOFFICE',str(bundled))
with (private/'server.log').open('ab') as log:
 child=subprocess.Popen([sys.executable,str(Path(__file__).with_name('serve_editor.py')),str(root),'--ready-file',str(ready)],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,env=env)
for _ in range(100):
 if ready.exists():
  data=json.loads(ready.read_text());os.chmod(ready,0o600);print(json.dumps(data,ensure_ascii=False));break
 if child.poll() is not None:raise SystemExit('本机编辑入口未启动，请检查 .file-index/editor-private/server.log')
 time.sleep(.1)
else:raise SystemExit('启动超时，请检查本机编辑服务日志')
