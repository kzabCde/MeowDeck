#!/usr/bin/env python3
"""MeowDeck P0 read-only asset validation. Requires Python 3.10+ and Pillow.

Uses the source deck pack's manifest/atlas round-trip validation approach,
plus exact source PNG digests and versioned animation contract assertions.
Never creates, rewrites, or regenerates artwork, metadata, or reports.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ImportError:
    print('FAIL dependency Pillow is required: python -m pip install -r requirements-assets.txt',file=sys.stderr)
    raise SystemExit(2)


def validate(repo: Path) -> tuple[int, list[str]]:
    errors: list[str] = []
    checks = 0

    def check(field: str, actual: Any, expected: Any) -> None:
        nonlocal checks
        checks += 1
        if actual != expected:
            errors.append(f'{field}: expected {expected!r}; actual {actual!r}')

    def require(path: Path, field: str) -> bool:
        nonlocal checks
        checks += 1
        if not path.is_file():
            errors.append(f'{field}: expected existing file {path.relative_to(repo)!s}; actual MISSING')
            return False
        return True

    def read_json(path: Path) -> dict:
        if not require(path, 'metadata file'):
            return {}
        try:
            doc = json.loads(path.read_text(encoding='utf-8'))
            if isinstance(doc, dict):
                return doc
            errors.append(f'{path.relative_to(repo)}: expected JSON object; actual {type(doc).__name__}')
        except (ValueError, UnicodeError) as err:
            errors.append(f'{path.relative_to(repo)}: invalid JSON: {err}')
        return {}

    def path_from(root: Path, relative: str, field: str) -> Path | None:
        # Avoid escaping assets root through relative or absolute manifest paths.
        candidate = (root / relative).resolve()
        if not candidate.is_relative_to(root.resolve()):
            errors.append(f'{field}: expected path under {root.relative_to(repo)!s}; actual {relative!r}')
            return None
        return candidate

    def png(path: Path, field: str, size: tuple[int, int]) -> Image.Image | None:
        if not require(path, field):
            return None
        try:
            with Image.open(path) as source:
                check(f'{field}.format', source.format, 'PNG')
                check(f'{field}.mode', source.mode, 'RGBA')
                check(f'{field}.size', source.size, size)
                return source.copy()
        except Exception as exc:
            errors.append(f'{field}: cannot decode PNG {path.relative_to(repo)}: {exc}')
            return None

    contract = read_json(repo / 'asset-contract.json')
    if not contract:
        return checks, errors
    check('asset-contract.json.contractVersion', contract.get('contractVersion'), '1.0.0')
    cards = contract.get('cards', {})
    mochi = contract.get('mochi', {})
    if not isinstance(cards, dict) or not isinstance(mochi, dict):
        errors.append('asset-contract.json: expected cards and mochi objects')
        return checks, errors
    bc = cards.get('baseSize', {})
    hc = cards.get('hdSize', {})
    mc = mochi.get('frameSize', {})
    try:
        base = (bc['width'],bc['height'])
        hd = (hc['width'],hc['height'])
        frame_size = (mc['width'],mc['height'])
        atlas_cfg = cards['atlas']
        atlas_size = (atlas_cfg['columns'] * base[0], atlas_cfg['rows'] * base[1])
        atlas_hd_size = (atlas_cfg['columns'] * hd[0], atlas_cfg['rows'] * hd[1])
    except (KeyError,TypeError) as e:
        errors.append(f'asset-contract.json: required dimension/atlas key absent: {e}')
        return checks, errors

    check('cards.baseSize',base,(96,144))
    check('cards.hdSize',hd,(192,288))
    check('cards.aspectRatio',cards.get('aspectRatio'),{'width':2,'height':3})
    check('cards.pngMode',cards.get('pngMode'),'RGBA')
    check('cards.interpolation',cards.get('interpolation'),'nearest-neighbor')
    check('cards.cardIdSyntax',cards.get('cardIdSyntax'),'${rank}${suit}')
    check('cards.rankIds',cards.get('rankIds'),['A','2','3','4','5','6','7','8','9','10','J','Q','K'])
    check('cards.suitIds',cards.get('suitIds'),['S','H','D','C'])
    check('cards.playableCardCount',cards.get('playableCardCount'),52)
    check('cards.totalAssetCount',cards.get('totalAssetCount'),55)
    check('cards.optionalAssetIds',cards.get('optionalAssetIds'),['joker_red','joker_black','card_back'])
    check('cards.atlas.grid',tuple(atlas_cfg[k] for k in ('columns','rows','usedCells','transparentCells')),(8,7,55,1))
    check('mochi.frameSize',frame_size,(96,96))
    check('mochi.anchor',mochi.get('anchor'),{'x':48,'y':88})
    check('mochi.origin',mochi.get('origin'),{'x':.5,'y':88/96})
    check('mochi.totalAnimations',mochi.get('totalAnimations'),10)
    check('mochi.totalFrames',mochi.get('totalFrames'),44)
    check('mochi.pngMode',mochi.get('pngMode'),'RGBA')
    check('mochi.sheetLayout',mochi.get('sheetLayout'),'horizontal-row')
    check('mochi.priority',mochi.get('priority'),['victory/defeat','draw_card/play_card','pet_reaction/surprise','thinking','sleep','idle/blink'])

    card_manifest_path = path_from(repo,cards.get('manifestPath',''),'cards.manifestPath')
    atlas_json_path = path_from(repo,atlas_cfg.get('metadata',''),'cards.atlas.metadata')
    atlas_image_path = path_from(repo,atlas_cfg.get('image',''),'cards.atlas.image')
    atlas_hd_path = path_from(repo,atlas_cfg.get('image2x',''),'cards.atlas.image2x')
    mochi_manifest_path = path_from(repo,mochi.get('manifestPath',''),'mochi.manifestPath')
    if None in (card_manifest_path,atlas_json_path,atlas_image_path,atlas_hd_path,mochi_manifest_path):
        return checks,errors
    card_root = card_manifest_path.parent
    mochi_root = mochi_manifest_path.parent
    manifest = read_json(card_manifest_path)
    atlas_meta = read_json(atlas_json_path)
    mochi_manifest = read_json(mochi_manifest_path)
    if not manifest or not atlas_meta or not mochi_manifest:
        return checks,errors

    check('cards.manifest.base_size',manifest.get('base_size'),bc)
    check('cards.manifest.high_resolution_size',manifest.get('high_resolution_size'),hc)
    check('cards.manifest.assets_total',manifest.get('assets_total'),55)
    check('cards.manifest.standard_cards',manifest.get('standard_cards'),52)
    check('cards.manifest.jokers',manifest.get('jokers'),2)
    check('cards.manifest.backs',manifest.get('backs'),1)
    entries = manifest.get('assets',[])
    frames = atlas_meta.get('frames',{})
    if not isinstance(entries,list) or not isinstance(frames,dict):
        errors.append('cards.manifest.assets or atlas.frames: invalid collection')
        return checks,errors
    check('cards.manifest.assets count',len(entries),55)
    ids = [asset.get('id') for asset in entries if isinstance(asset,dict)]
    check('cards.manifest.unique ids',len(set(ids)),55)
    expected_cards = {rank+suit for rank in cards['rankIds'] for suit in cards['suitIds']}
    card_entries = [a for a in entries if isinstance(a,dict) and 'suit' in a]
    check('cards.manifest.playable ID set', {a['id'] for a in card_entries}, expected_cards)
    optional_entries = [a for a in entries if isinstance(a,dict) and 'suit' not in a]
    check('cards.manifest.optional ID set', {a['id'] for a in optional_entries},set(cards['optionalAssetIds']))
    check('cards.atlas.frame ID set',set(frames),set(ids))
    atlas_grid = atlas_meta.get('meta',{}).get('grid',{})
    check('cards.atlas.meta.grid',atlas_grid,{'columns':8,'rows':7,'cell_width':96,'cell_height':144,'used':55,'empty':1})
    check('cards.atlas.meta.size',atlas_meta.get('meta',{}).get('size'),{'w':768,'h':1008})
    check('cards.atlas.meta.format',atlas_meta.get('meta',{}).get('format'),'RGBA8888')
    base_atlas = png(atlas_image_path,'cards.atlas.png',atlas_size)
    hd_atlas = png(atlas_hd_path,'cards.atlas@2x.png',atlas_hd_size)
    if base_atlas is not None:
        check('cards.atlas.blankCell.alpha',base_atlas.getchannel('A').crop((7*96,6*144,8*96,7*144)).getbbox(),None)
    if hd_atlas is not None:
        check('cards.atlas@2x.blankCell.alpha',hd_atlas.getchannel('A').crop((7*192,6*288,8*192,7*288)).getbbox(),None)

    occupied: set[tuple[int,int]] = set()
    paths_seen: set[str] = set()
    for i, asset in enumerate(entries):
        if not isinstance(asset,dict):
            errors.append(f'cards.manifest.assets[{i}]: expected object, actual {asset!r}')
            continue
        cid=asset.get('id','<missing-id>')
        ap=asset.get('atlas',{})
        expected_rect={'x':(i%8)*96,'y':(i//8)*144,'w':96,'h':144,'index':i}
        check(f'cards.{cid}.manifest.atlas',ap,expected_rect)
        pos = frames.get(cid,{}).get('frame') if isinstance(frames.get(cid,{}),dict) else None
        check(f'cards.{cid}.atlas.frame',pos,{k:expected_rect[k] for k in ('x','y','w','h')})
        check(f'cards.{cid}.atlas.rotated',frames.get(cid,{}).get('rotated'),False)
        check(f'cards.{cid}.atlas.trimmed',frames.get(cid,{}).get('trimmed'),False)
        cell=(i%8,i//8)
        if cell in occupied: errors.append(f'cards.{cid}.atlas: duplicate grid cell {cell}')
        occupied.add(cell)
        if cell[0]>=8 or cell[1]>=7:errors.append(f'cards.{cid}.atlas: frame exceeds atlas {cell}')
        if 'suit' in asset:
            m=re.fullmatch(r'(A|2|3|4|5|6|7|8|9|10|J|Q|K)(S|H|D|C)',cid)
            check(f'cards.{cid}.id syntax',bool(m),True)
            if m:
                rank,suit=m.groups()
                check(f'cards.{cid}.rank',asset.get('rank'),rank)
                check(f'cards.{cid}.suit',asset.get('suit'),cards['suitDirectoryNames'][suit])
        else:
            check(f'cards.{cid}.optional type',asset.get('type'), 'back' if cid=='card_back' else 'joker')
        file1=asset.get('path','')
        file2=asset.get('path_2x','')
        if file1 in paths_seen: errors.append(f'cards.{cid}.path: duplicate {file1!r}')
        paths_seen.add(file1)
        p1=path_from(card_root,file1,f'cards.{cid}.path')
        p2=path_from(card_root,file2,f'cards.{cid}.path_2x')
        if p1 is None or p2 is None: continue
        im=png(p1,f'cards.{cid}.base',base)
        im2=png(p2,f'cards.{cid}.hd',hd)
        if im is None or im2 is None:continue
        check(f'cards.{cid}.hd.nearestNeighbor2x',im.resize(hd,Image.Resampling.NEAREST).tobytes()==im2.tobytes(),True)
        if base_atlas is not None:
            crop=base_atlas.crop((expected_rect['x'],expected_rect['y'],expected_rect['x']+96,expected_rect['y']+144))
            check(f'cards.{cid}.atlas.pixelPerfect',crop.tobytes()==im.tobytes(),True)
        if hd_atlas is not None:
            x,y=2*expected_rect['x'],2*expected_rect['y']
            crop=hd_atlas.crop((x,y,x+192,y+288))
            check(f'cards.{cid}.atlas2x.pixelPerfect',crop.tobytes()==im2.tobytes(),True)
        # Determine that source art still has expected transparency around its border.
        check(f'cards.{cid}.base.cornerAlpha',all(im.getpixel(pos)[3]==0 for pos in ((0,0),(95,0),(0,143),(95,143))),True)

    check('cards.atlas.usedCellCount',len(occupied),55)
    check('mochi.manifest.format',mochi_manifest.get('format'),'RGBA PNG')
    check('mochi.manifest.frameSize',mochi_manifest.get('frameSize'),[96,96])
    check('mochi.manifest.anchor',mochi_manifest.get('anchor'),[48,88])
    anims=mochi_manifest.get('animations',[])
    if not isinstance(anims,list):
        errors.append('mochi.manifest.animations: expected list')
        return checks,errors
    specs=mochi.get('animationSpecs',{})
    check('mochi.animationSpecs IDs',set(specs),{'idle','blink','thinking','draw_card','play_card','victory','defeat','sleep','pet_reaction','surprise'})
    check('mochi.manifest.animations count',len(anims),10)
    anim_ids=[a.get('name') for a in anims if isinstance(a,dict)]
    check('mochi.manifest.animation IDs',set(anim_ids),set(specs))
    check('mochi.manifest.animation ID uniqueness',len(set(anim_ids)),len(anim_ids))
    check('mochi.manifest.totalFrames',sum(a.get('frameCount',0) for a in anims if isinstance(a,dict)),44)
    for a in anims:
        if not isinstance(a,dict):
            errors.append(f'mochi.animation: expected object; actual {a!r}')
            continue
        aid=a.get('name','<missing>')
        spec=specs.get(aid)
        if spec is None:continue
        count=spec['frameCount']
        check(f'mochi.{aid}.frameCount',a.get('frameCount'),count)
        check(f'mochi.{aid}.frameWidth',a.get('frameWidth'),96)
        check(f'mochi.{aid}.frameHeight',a.get('frameHeight'),96)
        check(f'mochi.{aid}.sheetWidth',a.get('sheetWidth'),96*count)
        check(f'mochi.{aid}.sheetHeight',a.get('sheetHeight'),96)
        check(f'mochi.{aid}.anchor',a.get('anchor'),{'x':48,'y':88})
        check(f'mochi.{aid}.origin',a.get('origin'),{'x':0.5,'y':88/96})
        check(f'mochi.{aid}.frameDurationMs',a.get('frameDurationMs'),spec['frameDurationMs'])
        check(f'mochi.{aid}.loop',a.get('loop'),spec['loop'])
        if 'fps' in a:
            try:
                check(f'mochi.{aid}.fps compatibility',float(a['fps']),1000/spec['frameDurationMs'])
            except (TypeError,ValueError):
                errors.append(f'mochi.{aid}.fps: expected numeric calculated FPS, actual {a["fps"]!r}')
        check(f'mochi.{aid}.actionFrame',a.get('actionFrame'),spec.get('actionFrame'))
        if 'actionFrame' in a:
            check(f'mochi.{aid}.actionFrame.inRange',isinstance(a['actionFrame'],int) and 0<=a['actionFrame']<count,True)
        positions=a.get('frames',[])
        check(f'mochi.{aid}.frames.length',len(positions),count)
        for j,rect in enumerate(positions):
            check(f'mochi.{aid}.frames[{j}]',rect,{'index':j,'x':j*96,'y':0,'width':96,'height':96})
        sheet_path=path_from(mochi_root,a.get('sheet',''),f'mochi.{aid}.sheet')
        if sheet_path is not None:
            png(sheet_path,f'mochi.{aid}.sheet', (96*count,96))
        preview=a.get('preview')
        # Previews are explicitly not runtime requirements and need not be committed.
        if preview:
            check(f'mochi.{aid}.preview.path',preview.startswith('previews/'),True)

    # PNG fingerprints against user-provided original ZIPs, kept as a read-only fixture.
    digests = read_json(repo / 'asset-digests.json')
    check('original PNG digest entries',len(digests),122)
    for rel,expected in digests.items():
        file=path_from(repo,rel,f'asset-digests[{rel}]')
        if file is None or not require(file,f'asset-digests[{rel}]'):continue
        actual=hashlib.sha256(file.read_bytes()).hexdigest()
        check(f'asset-digests[{rel}].sha256',actual,expected)

    return checks,errors


def main() -> int:
    parser=argparse.ArgumentParser(description='Read-only P0 asset contract validator')
    parser.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[1],help='Path to MeowDeck repository root')
    args=parser.parse_args()
    root=args.repo.resolve()
    count,errors=validate(root)
    print(f'MeowDeck P0 Asset Validation — {"PASS" if not errors else "FAIL"}')
    print(f'Checks: {count}; passed: {count-len(errors)}; failed: {len(errors)}')
    for err in errors:
        print('  FAIL',err)
    print('Validator is read-only; no files were modified.')
    return 1 if errors else 0


if __name__=='__main__':
    raise SystemExit(main())
