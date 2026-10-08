#!/usr/bin/env python3
"""Package backend source for the disposable AWS CodeBuild project."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'fastapi/backend'
excluded = {'__pycache__', '.venv', 'venv', 'node_modules'}
with ZipFile(args.output, 'w', compression=ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if not path.is_file() or path.is_symlink():
            continue
        if any(part in excluded or part.startswith('.') for part in relative.parts):
            if relative.as_posix() != '.dockerignore':
                continue
        if path.suffix not in {'.py', '.txt', '.crt'} and path.name not in {'Dockerfile', '.dockerignore'}:
            continue
        archive.write(path, relative.as_posix())
print(f'Packaged backend source: {args.output}')
