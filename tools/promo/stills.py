#!/usr/bin/env python3
"""Promo stills for Project Zealandia, in the documentary / wild-nature look.

    python3 tools/promo/stills.py
    python3 tools/promo/stills.py --pick shark=3 --focus shark=600,280

Writes to <scratch>/promo/out/:
  banner_1920x480.png, banner_960x300.png  four habitats, foreground fern silhouettes, the carved logo
  cover_630x500.png                        itch.io cover: a 2x2 of the habitats round the carved logo
  thumb_1280x720.png                       documentary poster: the shark looming in the blue, the logo
  reelcover_<id>.png                       1080x1920 per film: title card, creature, field-note label

Images are only ever scaled by whole numbers with nearest-neighbour; titles are Alagard at its native grid
(textfx.py), ornaments are placed pixel by pixel (ornaments.py).
"""
from __future__ import annotations

import argparse
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from textfx import TextBlock, STYLES, fit_scale, bayer_tile, dither_darken   # noqa: E402
import ornaments as O                                                       # noqa: E402
from compose import FILMS, PROMO, DOT, read_manifest                         # noqa: E402

IDS = ['shark', 'gecko', 'worm', 'crab']
ORDER = ['crab', 'worm', 'gecko', 'shark']      # shore -> bush -> glow forest -> the deep
# hero still and the creature's centre in it (1280x720), checked by eye on helper A's stills
HERO = {'shark': (3, (720, 320)), 'gecko': (3, (640, 420)), 'worm': (3, (720, 435)), 'crab': (2, (630, 385))}
SIL = dict(stem='#0d170b', dark='#0a1209', mid='#111e0e', light='#182a13', tip='#20361a', outline='#070b06')


def load(d, rid, pick):
    p = os.path.join(d, f'{rid}_still_{pick}.png')
    if not os.path.exists(p):
        p = os.path.join(d, f'{rid}_still_1.png')
    return np.array(Image.open(p).convert('RGB'))


def crop_scaled(img, fx, fy, w, h, s, ax=0.5, ay=0.5):
    """Crop so the focus lands at (ax, ay) of a w x h output, nearest-upscaled by the whole number s."""
    cw, ch = -(-w // s), -(-h // s)
    Hs, Ws = img.shape[:2]
    x0 = int(np.clip(fx - cw * ax, 0, Ws - cw))
    y0 = int(np.clip(fy - ch * ay, 0, Hs - ch))
    c = img[y0:y0 + ch, x0:x0 + cw]
    return np.repeat(np.repeat(c, s, 0), s, 1)[:h, :w]


def grade(img, contrast=1.08, sat=1.08, lift=-4):
    """A gentle, natural grade (per-pixel curve, no filtering)."""
    x = img.astype(np.float32)
    m = x.mean(axis=2, keepdims=True)
    x = m + (x - m) * sat
    x = (x - 128) * contrast + 128 + lift
    return np.clip(x, 0, 255).astype(np.uint8)


def ellipse(H, W, cx, cy, rx, ry, peak):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return np.clip(1 - r, 0, 1) ** 0.6 * peak


def edges(H, W, amount, power=3.0):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.maximum(np.abs(xx / W - 0.5) * 2, np.abs(yy / H - 0.5) * 2)
    return np.clip(r, 0, 1) ** power * amount


def blit(dst, rgba, x, y, s):
    O.draw_rgba(dst, rgba, x, y, s, anchor='topleft')


def foliage(dst, s, seed=1, top=True, bottom=True):
    """Foreground fern silhouettes reaching in from the corners, as if seen through the bush."""
    H, W = dst.shape[:2]
    rnd = np.random.default_rng(seed)
    specs = []
    if bottom:
        for side in (0, 1):
            for k in range(2):
                L = int(rnd.integers(40, 60)) * (H // s) // 160
                a0 = -math.pi / 2 + (0.35 + 0.35 * k) * (1 if side == 0 else -1)
                specs.append((side, 'b', max(22, L), a0, (0.9 + 0.3 * k) * (1 if side == 0 else -1)))
    if top:
        for side in (0, 1):
            L = int(rnd.integers(30, 44)) * (H // s) // 160
            specs.append((side, 't', max(18, L), math.pi / 2 + (0.6 if side else -0.6), (0.6 if side else -0.6)))
    for i, (side, edge, L, a0, bend) in enumerate(specs):
        f, (rx, ry) = O.fern_frond(L, ang0=a0, bend=bend, curl=0.9, leaf=max(5, L // 6), seed=seed * 10 + i,
                                   pal=SIL, with_root=True)
        x = (0 if side == 0 else W // s) + int(rnd.integers(-4, 10)) * (1 if side == 0 else -1)
        y = (H // s + 2) if edge == 'b' else -2
        blit(dst, f, (x - rx) * s, (y - ry) * s, s)


def logo_block(dst, cx, cy, s, tagline_s=None, darken=True):
    lg = O.logo()
    h, w = lg.shape[:2]
    if darken:
        H, W = dst.shape[:2]
        lvl = ellipse(H, W, cx, cy, w * s * 0.62, h * s * 0.95, 0.95)
        dst[:] = dither_darken(dst, lvl, s, colour=(6, 9, 7), steps=4, strength=0.32)
    O.draw_rgba(dst, lg, cx, cy, s)
    if tagline_s:
        tg = TextBlock('A WILDLIFE PHOTOGRAPHY ADVENTURE', STYLES['sage'], scale=tagline_s, mode='show', wave=None,
                       spacing=2)
        tg.draw(dst, 10.0, cx, cy + h * s // 2 + 4 * tagline_s, 'top')
    return h * s


# --------------------------------------------------------------------------------------- banner
def banner(st, W, H, zoom, logo_s, tag_s, out):
    n = len(ORDER)
    pw = W // n
    seam = pw // 3
    canvas = np.zeros((H, W, 3), np.uint8)
    for k, rid in enumerate(ORDER):
        img, (fx, fy) = st[rid]
        p = grade(crop_scaled(img, fx, fy, pw + seam, H, zoom, 0.5, 0.74))
        x0 = k * pw - seam // 2
        # an organic, wavering seam, ordered-dithered across its width
        bt = bayer_tile(H // zoom + 1, (pw + seam) // zoom + 1, 8)
        bt = np.repeat(np.repeat(bt, zoom, 0), zoom, 1)[:H, :pw + seam]
        yy = np.arange(H)[:, None]
        wob = (np.sin(yy / H * 5.0 + k * 1.7) * 0.18 + np.sin(yy / H * 13.0 + k) * 0.06)
        xs = np.arange(pw + seam)[None, :]
        ramp = np.clip(xs / seam + wob, 0, 1)
        m = (bt < ramp) if k > 0 else np.ones_like(bt, bool)
        xa, xb = max(0, x0), min(W, x0 + pw + seam)
        sub = canvas[:, xa:xb]
        sel = m[:, xa - x0:xb - x0]
        sub[sel] = p[:, xa - x0:xb - x0][sel]
    canvas = dither_darken(canvas, edges(H, W, 0.45, 3.0), zoom, colour=(6, 9, 7), steps=3, strength=0.3)
    foliage(canvas, zoom, seed=3, top=True, bottom=True)
    logo_block(canvas, W // 2, int(H * 0.30), logo_s, tag_s)
    Image.fromarray(canvas).save(out)
    return out


# ---------------------------------------------------------------------------------------- cover
def cover(st, out):
    W, H = 630, 500
    cw, ch = W // 2, H // 2
    canvas = np.zeros((H, W, 3), np.uint8)
    for rid, (qx, qy) in {'shark': (1, 0), 'gecko': (0, 0), 'worm': (0, 1), 'crab': (1, 1)}.items():
        img, (fx, fy) = st[rid]
        canvas[qy * ch:(qy + 1) * ch, qx * cw:(qx + 1) * cw] = grade(
            crop_scaled(img, fx, fy, cw, ch, 1, 0.5 + (0.12 if qx == 0 else -0.12), 0.72 if qy == 0 else 0.4))
    # a dark mossy cross where the four prints meet
    canvas[ch - 1:ch + 1, :] = (10, 16, 10)
    canvas[:, cw - 1:cw + 1] = (10, 16, 10)
    canvas = dither_darken(canvas, edges(H, W, 0.4, 3), 1, colour=(6, 9, 7))
    foliage(canvas, 1, seed=5, top=False, bottom=True)
    logo_block(canvas, W // 2, H // 2 - 6, 2, 1)
    Image.fromarray(canvas).save(out)
    return out


# ---------------------------------------------------------------------------------------- thumb
def thumb(st, out):
    W, H = 1280, 720
    img, (fx, fy) = st['shark']
    pic = grade(crop_scaled(img, fx, fy, W, H, 2, 0.29, 0.58), contrast=1.14, sat=1.12, lift=-6)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    lvl = edges(H, W, 0.55, 2.4)
    lvl = np.maximum(lvl, np.clip((xx / W - 0.48) / 0.52, 0, 1) ** 1.3 * 0.55 * np.clip(1.2 - yy / H, 0, 1))
    lvl = np.maximum(lvl, np.clip((yy / H - 0.55) / 0.45, 0, 1) ** 1.5 * 0.7)          # the deep below
    pic = dither_darken(pic, lvl, 3, colour=(4, 12, 20), steps=4, strength=0.3)
    lg = O.logo()
    s = 3
    cx = W - lg.shape[1] * s // 2 - 40
    O.draw_rgba(pic, lg, cx, 40 + lg.shape[0] * s // 2, s)
    y = 40 + lg.shape[0] * s + 26
    t1 = TextBlock('THE KELP FOREST', STYLES['bone'], scale=4, mode='show', wave=None, spacing=2)
    t1.draw(pic, 10.0, cx, y, 'top')
    y += t1.h * 4 + 12
    O.draw_rgba(pic, O.fern_rule(60, leaf=3, seed=4), cx, y + 9, 3)
    t2 = TextBlock(f'Glasseye Whaler {DOT} Carcharhinus vitreus', STYLES['sage'], scale=2, mode='show', wave=None,
                   spacing=1, icons={DOT: O.MIDDOT})
    t2.draw(pic, 10.0, cx, y + 34, 'top')
    Image.fromarray(pic).save(out)
    return out


# ----------------------------------------------------------------------------------- reel cover
def reel_cover(rid, img, foc, out):
    W, H = 1080, 1920
    cfg = FILMS[rid]
    pic = grade(crop_scaled(img, foc[0], foc[1], W, H, 3, 0.5, 0.54))
    yy = np.arange(H, dtype=np.float32)[:, None] * np.ones((1, W), np.float32)
    lvl = np.clip(1 - yy / (H * 0.30), 0, 1) ** 1.1 * 0.8 + np.clip((yy - H * 0.66) / (H * 0.34), 0, 1) ** 1.1 * 0.85
    pic = dither_darken(pic, lvl, 3, colour=(6, 9, 7), steps=4, strength=0.3)
    ts = min(7, fit_scale(cfg['title'], 960, 7, 4, spacing=2))
    t = TextBlock(cfg['title'], STYLES['bone'], scale=ts, mode='show', wave=None, spacing=2)
    t.draw(pic, 10.0, W // 2, 300, 'center')
    O.draw_rgba(pic, O.fern_rule(70, leaf=3, seed=4), W // 2, 300 + ts * 10 + 12, 3)
    meet = TextBlock(f'Meet the {cfg["common"]}', STYLES['bone'], scale=4, mode='show', wave=None, spacing=1)
    meet.draw(pic, 10.0, W // 2, 300 + ts * 10 + 70, 'center')
    sub = TextBlock(f'Project Zealandia {DOT} Species {cfg["n"]} of 4', STYLES['sage'], scale=3, mode='show',
                    wave=None, spacing=2, icons={DOT: O.MIDDOT})
    sub.draw(pic, 10.0, W // 2, 300 + ts * 10 + 128, 'center')
    # field-note label, bottom left
    x, y = 72, 1380
    O.draw_rgba(pic, O.fern_rule(64, leaf=3, seed=12), x - 6, y, 3, anchor='topleft')
    y += 48
    for txt, sty, sc, sp, gap in ((cfg['common'], 'bone', 6, 2, 10), (cfg['place'], 'sage', 3, 2, 8),
                                  (cfg['sci'], 'muted', 3, 1, 0)):
        b = TextBlock(txt, STYLES[sty], scale=sc, mode='show', wave=None, spacing=sp, align='left')
        b.draw(pic, 10.0, x, y, 'left')
        y += b.h * sc + gap
    O.draw_rgba(pic, O.logo(), W // 2, 1822, 2)
    Image.fromarray(pic).save(out)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--pick', action='append', default=[], help='id=N: use <id>_still_N.png')
    ap.add_argument('--focus', action='append', default=[], help='id=x,y: creature centre in the 1280x720 still')
    ap.add_argument('--out', default=os.path.join(PROMO, 'out'))
    a = ap.parse_args()
    d = os.path.join(PROMO, 'raw')
    os.makedirs(a.out, exist_ok=True)
    picks = {k: int(v) for k, v in (p.split('=') for p in a.pick)}
    focus = {k: tuple(int(c) for c in v.split(',')) for k, v in (f.split('=') for f in a.focus)}
    st = {}
    for rid in IDS:
        n, f = HERO[rid]
        man = read_manifest(d, rid)
        mf = man.get('focus') if isinstance(man.get('focus'), (list, tuple)) else None
        st[rid] = (load(d, rid, picks.get(rid, n)), focus.get(rid, tuple(mf) if mf else f))
    outs = [banner(st, 1920, 480, 1, 3, 2, os.path.join(a.out, 'banner_1920x480.png')),
            banner(st, 960, 300, 1, 2, 1, os.path.join(a.out, 'banner_960x300.png')),
            cover(st, os.path.join(a.out, 'cover_630x500.png')),
            thumb(st, os.path.join(a.out, 'thumb_1280x720.png'))]
    for rid in IDS:
        outs.append(reel_cover(rid, st[rid][0], st[rid][1], os.path.join(a.out, f'reelcover_{rid}.png')))
    for o in outs:
        print('wrote', o, Image.open(o).size)


if __name__ == '__main__':
    main()
