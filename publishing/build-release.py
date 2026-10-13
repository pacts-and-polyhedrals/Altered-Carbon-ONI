#!/usr/bin/env python3
"""Build a release without network access or third-party Python packages."""
import argparse
import json
import re
import zipfile
from pathlib import Path

def build(root, output, repo=None, release_download=False, source=False):
    manifest=json.loads((root/'module.json').read_text())
    if repo:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo):
            raise ValueError('Use your real GitHub OWNER/REPOSITORY.')
        base=f'https://github.com/{repo}'
        manifest.update(url=base,manifest=f'https://raw.githubusercontent.com/{repo}/main/module.json',download=f'{base}/archive/refs/heads/main.zip')
    if release_download:
        base=manifest['url'];manifest['download']=f'{base}/releases/download/v{manifest["version"]}/altered-carbon-oni-v{manifest["version"]}.zip'
    output.mkdir(parents=True,exist_ok=True)
    (output/'module.json').write_text(json.dumps(manifest,indent=2)+'\n')
    archive=output/f'altered-carbon-oni-v{manifest["version"]}.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('altered-carbon-oni/module.json',json.dumps(manifest,indent=2)+'\n')
        for p in sorted(root.rglob('*')):
            if not p.is_file() or p==root/'module.json' or output.resolve() in p.resolve().parents: continue
            rel=p.relative_to(root)
            if rel.parts[0] in {'tests','.git','node_modules'} or p.name=='package.json' or '__pycache__' in rel.parts or p.suffix=='.pyc': continue
            z.write(p,f'altered-carbon-oni/{rel.as_posix()}')
    result={'archive':str(archive.resolve()),'manifest':str((output/'module.json').resolve()),'version':manifest['version']}
    if source:
        source_archive=output/f'altered-carbon-oni-source-v{manifest["version"]}.zip'
        with zipfile.ZipFile(source_archive,'w',zipfile.ZIP_DEFLATED) as z:
            z.writestr('module.json',json.dumps(manifest,indent=2)+'\n')
            for p in sorted(root.rglob('*')):
                if not p.is_file() or p==root/'module.json' or output.resolve() in p.resolve().parents:continue
                rel=p.relative_to(root)
                if rel.parts[0] in {'.git','node_modules'} or '__pycache__' in rel.parts or p.suffix=='.pyc':continue
                z.write(p,rel.as_posix())
        result['source']=str(source_archive.resolve())
    print(json.dumps(result))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo');p.add_argument('--output',default='release');p.add_argument('--release-download',action='store_true');p.add_argument('--source',action='store_true')
    args=p.parse_args();build(Path(__file__).resolve().parents[1],Path(args.output).resolve(),args.repo,args.release_download,args.source)
