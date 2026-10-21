"""Optional click-to-open bridge. No server, watcher, or source writes."""
import hashlib, json, os, secrets
from pathlib import Path

APP = Path.home() / 'Applications/File Preview Opener.app'
DATA = Path.home() / 'Library/Application Support/File Preview Opener'

def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = path.with_name(path.name + '.' + secrets.token_hex(6) + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False))
    temp.chmod(0o600)
    os.replace(temp, path)

def register_originals(root, sources):
    """Register only files in the explicitly indexed folder; return opaque links."""
    if not (APP / 'Contents/MacOS/FilePreviewOpener').is_file():
        return {}
    try:
        prefs = json.loads((DATA / 'settings.json').read_text())
        secret = prefs['secret']
        if not prefs.get('enabled') or len(secret) < 32:
            return {}
    except (OSError, ValueError, KeyError, TypeError):
        return {}
    root = root.resolve()
    links = {}
    for source in sources:
        source = Path(source)
        if source.is_symlink() or not source.is_file():
            continue
        resolved = source.resolve()
        try:
            relative = resolved.relative_to(root).as_posix()
        except ValueError:
            continue
        token = hashlib.sha256((secret + '\0' + str(root) + '\0' + relative).encode()).hexdigest()
        entry = {'root': str(root), 'path': relative}
        path = DATA / 'files' / (token + '.json')
        try:
            unchanged = json.loads(path.read_text()) == entry
        except (OSError, ValueError):
            unchanged = False
        if not unchanged:
            atomic_json(path, entry)
        links[str(source)] = 'reverie-preview://open/' + token
    return links
