"""Restricted SSH receiver for the ICT Mates static website.

Installed outside public_html. The dedicated SSH key may invoke only this script.
No shell commands, recursive sync, or deletion of old website files are used.
"""
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import socket
import stat
import sys
import tempfile
import time
import urllib.request
from zipfile import ZipFile

ROOT = Path('/home/customer/www/ictmates.com/public_html')
STATE = Path('/home/customer/.ictmates-deploy')
PROTECTED = ('WP old website', '.well-known')
MANIFEST = '.deploy-manifest.json'
MAX_ARCHIVE = 32 * 1024 * 1024
MAX_EXPANDED = 128 * 1024 * 1024
EXTENSIONS = {'.html', '.css', '.js', '.mjs', '.json', '.svg', '.png', '.jpg',
              '.jpeg', '.gif', '.webp', '.avif', '.ico', '.txt', '.xml', '.woff',
              '.woff2', '.ttf', '.otf', '.map', '.pdf'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def safe_name(name):
    require(isinstance(name, str) and name and '\\' not in name,
            'Invalid release path')
    path = PurePosixPath(name)
    require(not path.is_absolute() and str(path) == name, 'Non-canonical release path')
    require(all(p not in ('.', '..') and not p.startswith('.') for p in path.parts),
            'Hidden or traversing release path')
    require(path.parts[0].casefold() not in {p.casefold() for p in PROTECTED},
            'Protected backup path')
    require(path.suffix.lower() in EXTENSIONS, 'Only static files are permitted')
    return path

def read_package(payload):
    require(0 < len(payload) <= MAX_ARCHIVE, 'Release archive exceeds size limit')
    with ZipFile(io.BytesIO(payload)) as archive:
        entries = archive.infolist()
        names = [e.filename for e in entries]
        require(len(entries) <= 5001 and len(names) == len(set(names)),
                'Too many or duplicate release entries')
        require(sum(e.file_size for e in entries) <= MAX_EXPANDED,
                'Expanded release exceeds size limit')
        require(names.count(MANIFEST) == 1, 'Release manifest missing')
        require(archive.getinfo(MANIFEST).file_size <= 1024 * 1024,
                'Release manifest exceeds size limit')
        meta = json.loads(archive.read(MANIFEST))
        require(isinstance(meta, dict) and isinstance(meta.get('files'), dict),
                'Invalid release manifest')
        require(re.fullmatch(r'[0-9a-f]{40}', meta.get('commit', '')) is not None,
                'Invalid commit identifier')
        require(set(names) == set(meta['files']) | {MANIFEST}, 'Manifest file mismatch')
        require('index.html' in meta['files'], 'Homepage missing')
        files = {}
        for entry in entries:
            require(not entry.is_dir() and not stat.S_ISLNK(entry.external_attr >> 16),
                    'Directories and symlinks are not allowed in release archives')
            if entry.filename == MANIFEST:
                continue
            safe_name(entry.filename)
            data = archive.read(entry)
            require(sha256(data) == meta['files'][entry.filename], 'Release hash mismatch')
            files[entry.filename] = data
        require(bool(files['index.html'].strip()), 'Homepage is empty')
        return meta, files

def protected_snapshot(root):
    result = {}
    for name in PROTECTED:
        base = root / name
        require(base.is_dir() and not base.is_symlink(), 'Protected directory missing')
        records = []
        for parent, dirs, files in os.walk(base, followlinks=False):
            for path in [Path(parent)] + [Path(parent) / n for n in sorted(dirs + files)]:
                s = path.lstat()
                records.append((str(path.relative_to(base)), s.st_mode, s.st_size,
                                s.st_mtime_ns, s.st_ctime_ns, s.st_ino, s.st_uid, s.st_gid,
                                os.readlink(path) if stat.S_ISLNK(s.st_mode) else None))
        result[name] = {'entries': len(records),
                        'metadata_sha256': sha256(json.dumps(sorted(records)).encode())}
    return result

def safe_target(root, name):
    path = root
    for part in safe_name(name).parts:
        path = path / part
        require(not path.is_symlink(), 'Destination contains a symlink')
        if path.exists() and path != root / name:
            require(path.is_dir(), 'Destination parent is not a directory')
    if path.exists():
        require(path.is_file() and path.stat().st_nlink == 1,
                'Destination is not a regular standalone file')
    return path

def publish(meta, files, root=ROOT, state=STATE):
    require(root.resolve() == root and root.is_dir(), 'Unexpected document root')
    require(not state.is_symlink(), 'Deployment state is a symlink')
    state.mkdir(mode=0o700, exist_ok=True)
    # Linux flock also protects manual deployments outside GitHub's concurrency group.
    import fcntl
    with (state / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        before = protected_snapshot(root)
        for name in files:
            safe_target(root, name)
        releases = state / 'releases'
        releases.mkdir(mode=0o700, exist_ok=True)
        release = Path(tempfile.mkdtemp(prefix=meta['commit'][:12] + '-', dir=releases))
        staged, previous = release / 'staged', release / 'previous'
        for name, data in files.items():
            target = staged / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod(0o644)
            existing = safe_target(root, name)
            if existing.exists():
                old = previous / name
                old.parent.mkdir(parents=True, exist_ok=True)
                old.write_bytes(existing.read_bytes())
        written = []
        try:
            # Keep old hashed assets so visitors with an older cached page still work.
            for name in sorted(files, key=lambda n: (n == 'index.html', n)):
                target = safe_target(root, name)
                target.parent.mkdir(parents=True, exist_ok=True)
                os.replace(staged / name, target)
                written.append(name)
            for name, data in files.items():
                require(sha256((root / name).read_bytes()) == sha256(data),
                        'Published file hash mismatch')
        except Exception:
            for name in reversed(written):
                old = previous / name
                if old.exists():
                    os.replace(old, root / name)
                else:
                    (root / name).unlink()
            raise
        after = protected_snapshot(root)
        require(before == after, 'Protected directory metadata changed')
        receipt = {'commit': meta['commit'], 'files': sorted(files),
                   'sha256': {name: sha256(data) for name, data in files.items()},
                   'protected_before': before, 'protected_after': after,
                   'protected_unchanged': True, 'release_directory': str(release)}
        (release / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        current = state / 'current.json.tmp'
        current.write_text(json.dumps(receipt, indent=2) + '\n')
        os.replace(current, state / 'current.json')
        return receipt

def flush_cache():
    request = {'api': 'domain-all', 'cmd': 'update', 'settings': {'json': 1},
               'params': {'flush_cache': '1', 'id': 'ictmates.com', 'path': '/(.*)'}}
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
        connection.settimeout(15)
        connection.connect('/chroot/tmp/site-tools.sock')
        connection.sendall((json.dumps(request) + '\n').encode())
        with connection.makefile('rb') as response:
            result = json.loads(response.readline(32768))
    require(isinstance(result, dict) and 'err_code' not in result,
            'SiteGround cache flush failed')

def verify_https(expected):
    checks = []
    for host in ('ictmates.com', 'www.ictmates.com'):
        url = 'https://' + host + '/'
        for attempt in range(5):
            try:
                request = urllib.request.Request(url, headers={
                    'User-Agent': 'ICTMates-Deployment-Verification/1.0',
                    'Cache-Control': 'no-cache'})
                with urllib.request.urlopen(request, timeout=20) as response:
                    require(response.status == 200 and sha256(response.read()) == expected,
                            'Live homepage does not match release')
                checks.append({'url': url, 'status': 200, 'matches_release': True})
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(3)
    return checks

def main():
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    if command == 'status':
        print(json.dumps({'ready': ROOT.is_dir(), 'receiver_sha256': sha256(Path(__file__).read_bytes())}))
        return
    require(command == 'deploy', 'Only deploy and status commands are permitted')
    payload = sys.stdin.buffer.read(MAX_ARCHIVE + 1)
    meta, files = read_package(payload)
    receipt = publish(meta, files)
    flush_cache()
    receipt['https'] = verify_https(sha256(files['index.html']))
    require(receipt['protected_after'] == protected_snapshot(ROOT),
            'Protected directory metadata changed after cache flush')
    print(json.dumps(receipt, indent=2))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Deployment failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
