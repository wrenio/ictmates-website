"""Package only dist/ plus a checksum manifest for the restricted SSH receiver."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from zipfile import ZipFile, ZIP_DEFLATED

from deploy_receiver import MANIFEST, MAX_EXPANDED, safe_name

def build(dist, output, commit):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('A full Git commit SHA is required')
    files = {}
    for path in sorted(dist.rglob('*')):
        if path.is_symlink():
            raise ValueError('Build output contains a symlink')
        if path.is_file():
            name = path.relative_to(dist).as_posix()
            safe_name(name)
            files[name] = path.read_bytes()
    if 'index.html' not in files or sum(map(len, files.values())) > MAX_EXPANDED:
        raise ValueError('Invalid static build')
    meta = {'commit': commit, 'files': {
        name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.writestr(MANIFEST, json.dumps(meta))
        for name, data in files.items():
            archive.writestr(name, data)
    print('Packaged ' + str(len(files)) + ' static files for commit ' + commit)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dist', type=Path, default=Path('dist'))
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    args = parser.parse_args()
    build(args.dist, args.output, args.commit)
