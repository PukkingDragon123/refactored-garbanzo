#!/usr/bin/env python3
"""Promo stills for Project Zealandia: itch.io banners and cover, a video thumbnail, reel covers.

    python3 tools/promo/stills.py                        # from <scratch>/promo/raw
    python3 tools/promo/stills.py --placeholder          # from the placeholder stills
    python3 tools/promo/stills.py --pick shark=2 --focus shark=640,300

Writes to <scratch>/promo/out/:
  banner_960x300.png, banner_1920x480.png   four habitats joined with dithered seams + logo + tagline
  cover_630x500.png                         itch.io cover thumbnail
  thumb_1280x720.png                        YouTube-style thumbnail: the shark big, the title
  reelcover_<id>.png                        1080x1920, one per reel

Every image is scaled only by whole numbers with nearest-neighbour; every title is Alagard at its
native grid scaled by a whole number (textfx.py).
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from textfx import TextBlock, STYLES, fit_scale, text_width, bayer_tile, dither_darken   # noqa: E402
from compose import REELS, SMALL_STAR, PROMO, _two_lines_text, read_manifest  # noqa: E402

IDS = ['shark', 'gecko', 'worm', 'crab']
# where the creature sits in each placeholder still (x, y at 1280x720); A's manifest or --focus override
FOCUS = {'shark': (230, 215), 'gecko': (900, 420), 'worm': (420, 520), 'crab': (640, 560)}
ORDER = ['crab', 'worm', 'gecko', 'shark']      # banner: shore -> bush -> glow forest -> the deep
# whole-number zoom per creature in the 1920 banner (small critters get bigger pixels); the 960 one uses z-1
ZOOM = {'shark': 1, 'gecko': 2, 'worm': 2, 'crab': 3}


def load_still(d, rid, pick):
    p = os.path.join(d, f'{rid}_still_{pick}.png')
    if not os.path.exists(p):
        p = os.path.join(d, f'{rid}_still_1.png')
    return np.array(Image.open(p).convert('RGB'))


def focus_of(man, rid, pick, override):
    if rid in override:
        return override[rid]
    e = man or {}
    cands = []
    st = e.get('stills')
    if isinstance(st, list) and len(st) >= pick and isinstance(st[pick - 1], dict):
        cands.append(st[pick - 1])
    if isinstance(st, dict):
        cands.append(st.get(str(pick), {}) if isinstance(st.get(str(pick)), dict) else {})
    cands.append(e)
    for c in cands:
        for k in ('focus', 'subject', 'center', 'centre'):
            v = c.get(k) if isinstance(c, dict) else None
            if isinstance(v, (list, tuple)) and len(v) >= 2:
                return (int(v[0]), int(v[1]))
        v = c.get('bbox') if isinstance(c, dict) else None
        if isinstance(v, (list, tuple)) and len(v) == 4:
            return (int(v[0] + v[2] / 2), int(v[1] + v[3] / 2))
    return FOCUS[rid]


def crop_scaled(img, fx, fy, w, h, s, ax=0.5, ay=0.5):
    """Crop (w/s x h/s) source px so the focus lands at (ax, ay) of the output, then nearest-upscale by s."""
    cw, ch = w // s + (1 if w % s else 0), h // s + (1 if h % s else 0)
    H, W = img.shape[:2]
    x0 = int(np.clip(fx - cw * ax, 0, W - cw))
    y0 = int(np.clip(fy - ch * ay, 0, H - ch))
    c = img[y0:y0 + ch, x0:x0 + cw]
    c = np.repeat(np.repeat(c, s, 0), s, 1)
    return c[:h, :w]


def quant_contrast(img, gain=1.18, lift=-10):
    """A punchier, still-hard-edged grade for the thumbnail: per-channel curve, no filtering."""
    x = img.astype(np.float32)
    m = x.mean(axis=2, keepdims=True)
    x = m + (x - m) * 1.15                     # a little saturation
    x = (x - 128) * gain + 128 + lift
    return np.clip(x, 0, 255).astype(np.uint8)


def best_t(blocks, lo=4.0, hi=9.0):
    """A time when the sparkles are out (stills freeze the animation)."""
    best, bt = -1, lo
    for t in np.arange(lo, hi, 1 / 30):
        n = 0
        for b in blocks:
            for (ts, gi, px, py, big) in b.sparks:
                if 0.12 < t - ts < 0.3:
                    n += 2 if big else 1
        if n > best:
            best, bt = n, float(t)
    return bt


def logo_blocks(scale_big, scale_small=None, one_line=False, sparkle_rate=1.6):
    if one_line:
        b = TextBlock('PROJECT ZEALANDIA', STYLES['gold'], scale=scale_big, mode='show', wave=None,
                      sparkle_words=('ZEALANDIA', 'PROJECT'), sparkle_rate=sparkle_rate, seed=7)
        return [b]
    a = TextBlock('PROJECT', STYLES['gold'], scale=scale_small or max(2, scale_big * 2 // 3), mode='show',
                  wave=None, sparkle_words=('PROJECT',), sparkle_rate=sparkle_rate * 0.6, seed=5)
    b = TextBlock('ZEALANDIA', STYLES['gold'], scale=scale_big, mode='show', wave=None,
                  sparkle_words=('ZEALANDIA',), sparkle_rate=sparkle_rate, seed=6)
    return [a, b]


def tagline(scale):
    return TextBlock('A WILDLIFE PHOTOGRAPHY ADVENTURE', STYLES['small'], scale=scale, mode='show', wave=None)


def ellipse_level(H, W, cx, cy, rx, ry, peak=0.75):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return np.clip(1.0 - r, 0, 1) ** 0.7 * peak


def edge_level(H, W, amount=0.55, power=2.2):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.maximum(np.abs(xx / W - 0.5) * 2, np.abs(yy / H - 0.5) * 2)
    return np.clip(r, 0, 1) ** power * amount


# ------------------------------------------------------------------------------------- banner
def banner(stills, foci, W, H, s, out, zoom=None):
    n = len(ORDER)
    pw = W // n
    seam = max(16, pw // 4)
    seam -= seam % (2 * s)
    cell = 2 * s
    panels = []
    for k, rid in enumerate(ORDER):
        fx, fy = foci[rid]
        # creature in the lower part of its panel, clear of the logo
        z = (zoom or {}).get(rid, s)
        panels.append(crop_scaled(stills[rid], fx, fy, pw + seam, H, z, 0.5, 0.64))
    canvas = np.zeros((H, W, 3), np.uint8)
    bt = bayer_tile(H // cell + 1, (pw + seam) // cell + 2, 8)
    bt = np.repeat(np.repeat(bt, cell, 0), cell, 1)
    for k, p in enumerate(panels):
        x0 = k * pw - seam // 2
        for x in range(p.shape[1]):
            X = x0 + x
            if X < 0 or X >= W:
                continue
            # dithered crossfade: inside the seam on the left edge, show this panel only where bayer < ramp
            if k > 0 and x < seam:
                ramp = (x + 0.5) / seam
                m = bt[:H, x] < ramp
                canvas[m, X] = p[m, x]
            else:
                canvas[:, X] = p[:, x]
    # darken behind the logo (dithered), and a little at the edges
    lvl = ellipse_level(H, W, W / 2, H * 0.24, W * 0.40, H * 0.34, 0.9) + edge_level(H, W, 0.25, 4)
    canvas = dither_darken(canvas, np.clip(lvl, 0, 1), s)
    zs = fit_scale('PROJECT ZEALANDIA', int(W * 0.66), 12, 2)
    logo = logo_blocks(zs, one_line=True)
    t = best_t(logo)
    for b in logo:
        b.draw(canvas, t, W // 2, int(H * 0.21), 'center')
    tg = tagline(max(1, zs // 2 - (1 if s == 1 else 0)))
    tg.draw(canvas, t, W // 2, int(H * 0.21) + logo[0].h * zs // 2 + 6 * s, 'top')
    Image.fromarray(canvas).save(out)
    return out


# --------------------------------------------------------------------------------- cover 630x500
def cover(stills, foci, out):
    W, H = 630, 500
    cw, ch = W // 2, H // 2
    canvas = np.zeros((H, W, 3), np.uint8)
    quad = {'shark': (0, 0), 'gecko': (1, 0), 'worm': (0, 1), 'crab': (1, 1)}
    for rid, (qx, qy) in quad.items():
        fx, fy = foci[rid]
        canvas[qy * ch:(qy + 1) * ch, qx * cw:(qx + 1) * cw] = crop_scaled(stills[rid], fx, fy, cw, ch, 1, 0.5,
                                                                            0.7 if qy == 0 else 0.62)
    lvl = ellipse_level(H, W, W / 2, H / 2, W * 0.6, H * 0.3, 0.95) + edge_level(H, W, 0.25, 4)
    canvas = dither_darken(canvas, np.clip(lvl, 0, 1), 1)
    # a hard pixel divider cross, like tape between prints
    canvas[ch - 1:ch + 1, :] = (8, 14, 22)
    canvas[:, cw - 1:cw + 1] = (8, 14, 22)
    logo = logo_blocks(5, 3)
    t = best_t(logo)
    logo[0].draw(canvas, t, W // 2, 196, 'center')
    logo[1].draw(canvas, t, W // 2, 262, 'center')
    tagline(1).draw(canvas, t, W // 2, 318, 'center')
    Image.fromarray(canvas).save(out)
    return out


# ---------------------------------------------------------------------------- thumb 1280x720
def thumb(stills, foci, out):
    W, H = 1280, 720
    fx, fy = foci['shark']
    img = crop_scaled(stills['shark'], fx, fy, W, H, 2, 0.27, 0.52)
    img = quant_contrast(img)
    lvl = edge_level(H, W, 0.55, 2.4)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    lvl = np.maximum(lvl, np.clip((xx / W - 0.42) / 0.5, 0, 1) ** 1.1 * 0.8)   # darker right side for type
    img = dither_darken(img, lvl, 2)
    logo = logo_blocks(8, 7)
    t = best_t(logo)
    cx = 1280 - logo[1].w * 8 // 2 - 70
    logo[0].draw(img, t, cx, 250, 'center')
    logo[1].draw(img, t, cx, 380, 'center')
    nm = TextBlock('GLASSEYE WHALER', STYLES['name'], scale=4, mode='show', wave=None,
                   sparkle_words=('GLASSEYE',), sparkle_rate=2, seed=3)
    nm.draw(img, best_t([nm]), cx, 510, 'center')
    hk = TextBlock('SOMETHING IS CIRCLING...', STYLES['caption'], scale=3, mode='show', wave=None)
    hk.draw(img, t, cx, 585, 'center')
    Image.fromarray(img).save(out)
    return out


# ------------------------------------------------------------------------------ reel covers
def reel_cover(rid, still, foc, out):
    W, H = 1080, 1920
    cfg = REELS[rid]
    img = crop_scaled(still, foc[0], foc[1], W, H, 3, 0.5, 0.52)
    yy = np.arange(H, dtype=np.float32)[:, None] * np.ones((1, W), np.float32)
    lvl = np.clip(1 - yy / (H * 0.32), 0, 1) ** 0.9 * 0.7 + np.clip((yy - H * 0.62) / (H * 0.38), 0, 1) ** 0.9 * 0.75
    img = dither_darken(img, lvl, 3)
    hook = TextBlock(_two_lines_text(cfg['hook']), STYLES['caption'], scale=7, mode='show', wave=None,
                     keywords={cfg['hook_kw']: STYLES['ember']}, sparkle_words=(cfg['hook_kw'],),
                     sparkle_rate=2.5, seed=13)
    name = TextBlock(cfg['name'], STYLES['name'], scale=min(9, fit_scale(cfg['name'], 1000, 9, 5)), mode='show',
                     wave=None, sparkle_words=tuple(cfg['name'].split()), sparkle_rate=2.0, seed=23)
    tag = TextBlock('\x02 FIELD GUIDE \x02', STYLES['small'], scale=4, mode='show', wave=None,
                    icons={'\x02': SMALL_STAR})
    t = best_t([hook, name])
    hook.draw(img, t, W // 2, 420, 'center')
    y = 1440
    tag.draw(img, t, W // 2, y, 'top')
    y += tag.h * tag.scale + 8
    name.draw(img, t, W // 2, y, 'top')
    y += name.h * name.scale + 14
    if cfg.get('sub'):
        sub = TextBlock(cfg['sub'], STYLES['small'], scale=5, mode='show', wave=None)
        sub.draw(img, t, W // 2, y, 'top')
        y += sub.h * sub.scale + 14
    logo = TextBlock('PROJECT ZEALANDIA', STYLES['gold'], scale=4, mode='show', wave=None)
    logo.draw(img, t, W // 2, 1800, 'center')
    Image.fromarray(img).save(out)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--placeholder', action='store_true')
    ap.add_argument('--pick', action='append', default=[], help='id=N: use <id>_still_N.png')
    ap.add_argument('--focus', action='append', default=[], help='id=x,y: creature centre in the 1280x720 still')
    ap.add_argument('--out', default=os.path.join(PROMO, 'out'))
    a = ap.parse_args()
    d = os.path.join(PROMO, 'placeholder' if a.placeholder else 'raw')
    os.makedirs(a.out, exist_ok=True)
    picks = {k: int(v) for k, v in (p.split('=') for p in a.pick)}
    over = {}
    for f in a.focus:
        k, v = f.split('=')
        x, y = v.split(',')
        over[k] = (int(x), int(y))
    stills, foci = {}, {}
    for rid in IDS:
        man = read_manifest(d, rid)
        pick = picks.get(rid) or int(man.get('hero_still', 1) or 1)
        stills[rid] = load_still(d, rid, pick)
        foci[rid] = focus_of(man, rid, pick, over)
    outs = [banner(stills, foci, 1920, 480, 2, os.path.join(a.out, 'banner_1920x480.png'), ZOOM),
            banner(stills, foci, 960, 300, 1, os.path.join(a.out, 'banner_960x300.png'),
                   {k: max(1, v - 1) for k, v in ZOOM.items()}),
            cover(stills, foci, os.path.join(a.out, 'cover_630x500.png')),
            thumb(stills, foci, os.path.join(a.out, 'thumb_1280x720.png'))]
    for rid in IDS:
        outs.append(reel_cover(rid, stills[rid], foci[rid], os.path.join(a.out, f'reelcover_{rid}.png')))
    for o in outs:
        print('wrote', o, Image.open(o).size)


if __name__ == '__main__':
    main()
