#!/usr/bin/env python3
"""Install/update the optional macOS click-only helper after user authorization."""
import json, os, plistlib, secrets, shutil, subprocess, sys, tempfile
from pathlib import Path
from native_opener import APP, DATA, atomic_json

BUNDLE_ID = 'local.reverie.file-preview-opener'

def main():
    if sys.platform != 'darwin':
        raise SystemExit('This optional helper supports macOS only.')
    if APP.exists():
        info = plistlib.loads((APP / 'Contents/Info.plist').read_bytes())
        if info.get('CFBundleIdentifier') != BUNDLE_ID:
            raise SystemExit('An unrelated app occupies the installation path.')
    APP.parent.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    DATA.chmod(0o700)
    with tempfile.TemporaryDirectory(prefix='.file-preview-build-', dir=APP.parent) as temp:
        stage = Path(temp) / APP.name
        binary = stage / 'Contents/MacOS/FilePreviewOpener'
        binary.parent.mkdir(parents=True)
        subprocess.run(['xcrun', 'swiftc', '-O', str(Path(__file__).with_name('FilePreviewOpener.swift')), '-o', str(binary), '-framework', 'AppKit'], check=True)
        info = {'CFBundleIdentifier': BUNDLE_ID, 'CFBundleName': 'File Preview Opener', 'CFBundleDisplayName': '文件原件打开器', 'CFBundleExecutable': 'FilePreviewOpener', 'CFBundlePackageType': 'APPL', 'CFBundleVersion': '1', 'CFBundleShortVersionString': '1.0', 'LSUIElement': True, 'NSHighResolutionCapable': True, 'CFBundleURLTypes': [{'CFBundleURLName': BUNDLE_ID, 'CFBundleURLSchemes': ['reverie-preview'], 'CFBundleTypeRole': 'Viewer'}]}
        (stage / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
        subprocess.run(['codesign', '--force', '--sign', '-', str(stage)], check=True)
        previous = Path(temp) / 'previous.app'
        if APP.exists(): APP.rename(previous)
        try: stage.rename(APP)
        except Exception:
            if previous.exists(): previous.rename(APP)
            raise
    settings = DATA / 'settings.json'
    prefs = json.loads(settings.read_text()) if settings.exists() else {'secret': secrets.token_hex(32)}
    prefs['enabled'] = True
    atomic_json(settings, prefs)
    registrar = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
    subprocess.run([registrar, '-f', str(APP)], check=True)
    print('Installed click-only helper:', APP)
    print('No background service or login item was created.')

if __name__ == '__main__': main()
