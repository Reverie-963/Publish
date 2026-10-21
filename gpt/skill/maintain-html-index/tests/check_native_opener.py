#!/usr/bin/env python3
"""Validate local capabilities and paths without opening target documents."""
import importlib.util, json, subprocess, tempfile
from pathlib import Path

script = Path(__file__).resolve().parents[1] / 'scripts/native_opener.py'
spec = importlib.util.spec_from_file_location('native_opener', script)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
binary = m.APP / 'Contents/MacOS/FilePreviewOpener'
created = []
def check(url, valid):
    result = subprocess.run([str(binary), '--check', url], capture_output=True, text=True)
    assert (result.returncode == 0) == valid, result.stderr
    return result.stdout.strip()
try:
    with tempfile.TemporaryDirectory(prefix='original-opener-test-') as folder:
        root = Path(folder) / '资料 # & %'; root.mkdir()
        file = root / '原文 # 1 & 2.md'; file.write_text('unchanged')
        links = m.register_originals(root, [file]); url = links[str(file)]
        token = url.rsplit('/', 1)[1]; entry = m.DATA / 'files' / (token + '.json'); created.append(entry)
        assert check(url, True) == str(file)
        assert m.register_originals(root, [file]) == links
        for bad in [url+'?x=1',url+'#x','https://open/'+token,'reverie-preview://open/../../etc/passwd','reverie-preview://open/'+'0'*64]:check(bad,False)
        outside = Path(folder) / 'outside.md'; outside.write_text('outside')
        file.unlink(); file.symlink_to(outside); check(url,False)
        file.unlink(); check(url,False)
        file.mkdir(); check(url,False)
        entry.write_text(json.dumps({'root':str(root),'path':'../outside.md'}));check(url,False)
        entry.write_text('broken');check(url,False)
    print('PASS: registered Unicode/special-character paths, stable links, unknown/malformed links, symlink escape, missing files, directories, traversal and invalid registry; no application launched.')
finally:
    for entry in created:entry.unlink(missing_ok=True)
