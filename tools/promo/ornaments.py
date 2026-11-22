#!/usr/bin/env python3
"""Natural pixel ornaments and the carved logo for the Project Zealandia documentary promo.

Every ornament is placed pixel by pixel at the art grid (no anti-aliasing) and returned as RGBA at art
resolution; blit it with textfx.blit_art at a whole-number scale.

  fern_frond()    a curved fern frond whose tip rolls into a koru, leaflets tapering along it
  fern_rule()     a straight frond used as a rule line under titles and lower-thirds
  fern_divider()  two fronds back to back from a little koru, for the end card
  KIWI            a small kiwi silhouette (hand-placed)
  logo()          PROJECT ZEALANDIA as weathered, carved bone, framed by fronds, a vine rule and a kiwi

Preview:  python3 tools/promo/ornaments.py --out /path/preview.png
"""
from __future__ import annotations

import math
import random

import numpy as np

from textfx import (STYLES, TextBlock, Icon, glyph, hexc, dilate, shift, band_colour_index, carve, bayer_tile,
                    blit_art, text_width)

FERN = dict(stem='#3b5a2a', dark='#2c4422', mid='#56843b', light='#86ad52', tip='#b4cf78', outline='#0b1208')
FERN_DRY = dict(stem='#6e6a4a', dark='#4f5236', mid='#8a8f5c', light='#b2b47a', tip='#d6d39c', outline='#12110b')


def _line(x0, y0, x1, y1):
    """Bresenham, inclusive."""
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return pts


def _canvas(pix, outline=None, pad=2):
    """pix: {(x,y): '#rrggbb'} -> RGBA art array (with an optional 1-px outline)."""
    xs = [p[0] for p in pix]
    ys = [p[1] for p in pix]
    x0, y0 = min(xs) - pad, min(ys) - pad
    w, h = max(xs) - x0 + pad + 1, max(ys) - y0 + pad + 1
    rgba = np.zeros((h, w, 4), np.uint8)
    for (x, y), c in pix.items():
        rgba[y - y0, x - x0, :3] = hexc(c)
        rgba[y - y0, x - x0, 3] = 255
    if outline:
        m = rgba[..., 3] > 0
        o = dilate(m, 8) & ~m
        rgba[o, :3] = hexc(outline)
        rgba[o, 3] = 255
    return rgba


def fern_frond(length=40, ang0=-math.pi / 2, bend=0.7, curl=1.0, leaf=6, flip=False, seed=1, pal=FERN,
               outline=True, koru=True, spacing=2, with_root=False):
    """A fern frond growing from its root at (0,0) for `length` px, sweeping `bend` radians along the way.
    Pinnae alternate along it, angled toward the tip, broad near the base and tapering; the tip rolls into
    a koru (a spiral of about 1.3 turns) curling the way the frond bends. Placed pixel by pixel."""
    rnd = random.Random(seed)
    pts = []
    x = y = 0.0
    ang = ang0
    n = int(length * 2)
    for i in range(n):
        ang += bend / n
        x += math.cos(ang) * 0.5
        y += math.sin(ang) * 0.5
        pts.append((x, y, i / n, ang))
    pix = {}
    last = None
    alt = 0
    for (px, py, s, a) in pts:
        if s < 0.05 or s > 0.93:
            continue
        ip = (int(round(px)), int(round(py)))
        if last is not None and max(abs(ip[0] - last[0]), abs(ip[1] - last[1])) < spacing:
            continue
        last = ip
        alt ^= 1
        prof = min(1.0, s / 0.14) * (1 - s) ** 0.55
        L = max(1, int(round(leaf * prof + rnd.choice([-1, 0, 0, 0, 0, 1]))))
        for sd in (1, -1):
            if rnd.random() < 0.05:
                continue                      # a pinna lost to weather
            la = a + sd * (math.pi / 2 - 0.8) + (0.12 if alt else -0.06) * sd
            lit = (sd == 1) == (math.cos(a) >= 0)
            for k in range(1, L + 1):
                f = k / L
                qx = int(round(px + math.cos(la) * k))
                qy = int(round(py + math.sin(la) * k))
                c = pal['dark'] if f < 0.34 else (pal['light'] if lit else pal['mid'])
                if f >= 0.99 and lit and L >= 3:
                    c = pal['tip']
                pix[(qx, qy)] = c
                if L >= 4 and f < 0.55:        # pinnae are leaves: two pixels thick near the stem
                    pix.setdefault((qx + (1 if math.sin(la) > 0 else 0), qy + (1 if math.sin(la) <= 0 else 0)),
                                   pal['mid'] if lit else pal['dark'])
    for (px, py, s, a) in pts:
        pix[(int(round(px)), int(round(py)))] = pal['stem'] if s < 0.7 else pal['mid']
    if koru and pts:
        ex, ey, _, ea = pts[-1]
        d = 1 if bend >= 0 else -1
        r0 = max(2.0, length * 0.075) * curl
        cx, cy = ex + math.cos(ea + d * math.pi / 2) * r0, ey + math.sin(ea + d * math.pi / 2) * r0
        th0 = math.atan2(ey - cy, ex - cx)
        steps = 160
        for i in range(steps):
            u = i / steps
            th = th0 + d * u * 2 * math.pi * 1.3
            r = r0 * (1 - 0.75 * u)
            pix[(int(round(cx + math.cos(th) * r)), int(round(cy + math.sin(th) * r)))] = \
                pal['mid'] if u < 0.6 else pal['light']
        pix[(int(round(cx)), int(round(cy)))] = pal['tip']
    if flip:
        pix = {(-x, y): c for (x, y), c in pix.items()}
    rgba = _canvas(pix, pal['outline'] if outline else None)
    if with_root:
        xs = [p[0] for p in pix]
        ys = [p[1] for p in pix]
        return rgba, (-(min(xs) - 2), -(min(ys) - 2))
    return rgba


def fern_rule(length=60, leaf=3, seed=4, pal=FERN, outline=True):
    """A straight frond pointing right, tip rolled in a small koru: a rule line."""
    return fern_frond(length, ang0=0.0, bend=0.01, curl=0.8, leaf=leaf, seed=seed, pal=pal, outline=outline,
                      spacing=3)


def fern_divider(half=40, leaf=3, seed=6, pal=FERN):
    """Two fronds growing out of the middle, back to back."""
    r = fern_frond(half, ang0=0.0, bend=0.01, curl=0.8, leaf=leaf, seed=seed, pal=pal, spacing=3)
    l = r[:, ::-1]
    h = max(r.shape[0], l.shape[0])
    out = np.zeros((h, l.shape[1] + r.shape[1] - 4, 4), np.uint8)
    out[(h - l.shape[0]) // 2:(h - l.shape[0]) // 2 + l.shape[0], :l.shape[1]] = l
    rr = out[(h - r.shape[0]) // 2:(h - r.shape[0]) // 2 + r.shape[0], l.shape[1] - 4:]
    m = r[..., 3] > 0
    rr[m] = r[m]
    return out


KIWI = Icon(rows=[
    '...........oooo.......',
    '..........obbbbo......',
    '.....ooooobbbbbbo.....',
    '...oobbbbbbbbbebo.....',
    '..obbbbbbbbbbbbbbo....',
    '.obbbbbbbbbbbbbbbo....',
    '.obbbbbbbbbbbbbbbboo..',
    'obbbbbbbbbbbbbbbbo.ko.',
    'obbbbbbbbbbbbbbbo...ko',
    '.obbbbbbbbbbbbbo.....k',
    '..oobbbbbbbbboo.......',
    '....oooobooooo........',
    '.......oko.ko.........',
    '.......oko.ko.........',
    '......okko.kko........',
    '.....ooooooooo........',
], palette={'o': '#120f0a', 'b': '#6a5840', 'e': '#efe4c8', 'k': '#d8c79a'})


MIDDOT = Icon(rows=['oo', 'oo'], palette={'o': '#cbd5b2'}, oy=6)


def icon_rgba(icon, outline=None):
    m, col = icon.arrays()
    rgba = np.zeros(m.shape + (4,), np.uint8)
    rgba[m, :3] = col[m]
    rgba[m, 3] = 255
    if outline:
        h, w = m.shape
        big = np.zeros((h + 2, w + 2, 4), np.uint8)
        big[1:-1, 1:-1] = rgba
        mm = big[..., 3] > 0
        o = dilate(mm, 8) & ~mm
        big[o, :3] = hexc(outline)
        big[o, 3] = 255
        rgba = big
    return rgba


def paste(dst, src, x, y):
    """Alpha-paste an RGBA art array into another (binary alpha), clipped."""
    H, W = dst.shape[:2]
    h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    m = s[..., 3] > 0
    dst[y0:y1, x0:x1][m] = s[m]


def style_mask(mask, style, steps=None):
    """Render a mask in a Style at the art grid (fill bands over the mask's rows, carve, outline, shadow)."""
    st = style
    P = len(st.shadow) + 3
    h, w = mask.shape
    m = np.zeros((h + 2 * P, w + 2 * P), bool)
    m[P:P + h, P:P + w] = mask
    H, W = m.shape
    fill = np.zeros((H, W, 3), np.uint8)
    ys, xs = np.nonzero(m)
    cols = np.array([hexc(c) for c in st.fill], np.uint8)
    rows = ys - P
    fill[ys, xs] = cols[band_colour_index(rows, xs, len(cols), 0, max(1, h - 1))]
    if st.carve:
        carve(m, fill)
    out1 = dilate(m, 8) & ~m
    sil = m | out1
    rgba = np.zeros((H, W, 4), np.uint8)
    used = np.zeros_like(m)
    b4 = bayer_tile(H, W, 4)
    shadows = []
    for k, c in enumerate(st.shadow, 1):
        sh = shift(sil, k, k) & ~sil & ~used
        if len(st.shadow_density) >= k and st.shadow_density[k - 1] < 1:
            sh &= b4 < st.shadow_density[k - 1]
        used |= sh
        shadows.append((sh, c))
    for sh, c in shadows:
        rgba[sh, :3] = hexc(c)
        rgba[sh, 3] = 255
    rgba[out1, :3] = hexc(st.outline)
    rgba[out1, 3] = 255
    rgba[m, :3] = fill[m]
    rgba[m, 3] = 255
    return rgba, P


def word_mask(text, k=1, spacing=1):
    """Binary mask of a word at the native grid, letters upscaled k x (the carved words are cut at 2x)."""
    w = text_width(text, spacing)
    m = np.zeros((16, w + 2), bool)
    x = 0
    for c in text:
        g, ox, oy, adv = glyph(c)
        if c.strip():
            m[oy:oy + g.shape[0], x + ox:x + ox + g.shape[1]] |= g
        x += adv + spacing
    ys = np.nonzero(m.any(1))[0]
    m = m[ys[0]:ys[-1] + 1]
    if k > 1:
        m = np.repeat(np.repeat(m, k, 0), k, 1)
    return m


def logo(frame_ferns=True, kiwi=True, vine=True, project=True, pal=FERN, seed=2):
    """The carved PROJECT ZEALANDIA logo at the art grid. Returns RGBA."""
    zm = word_mask('ZEALANDIA', k=2, spacing=1)
    z, zp = style_mask(zm, STYLES['carved'])
    parts = []
    W = z.shape[1] + 200
    H = z.shape[0] + 120
    can = np.zeros((H, W, 4), np.uint8)
    zx, zy = (W - z.shape[1]) // 2, 70
    # fronds rise from below the ends of the word and arch outward, koru tips curling back in
    if frame_ferns:
        base_y = zy + z.shape[0] - 2
        for k, (L, a0, bd, lf, dx) in enumerate([(62, -math.pi / 2 - 0.35, -0.95, 9, 22), (40, -math.pi / 2 - 0.9, -0.7, 6, 34)]):
            f, (rx, ry) = fern_frond(L, ang0=a0, bend=bd, curl=1.0, leaf=lf, seed=seed + k, pal=pal, with_root=True)
            paste(can, f, zx + dx - rx, base_y - ry)
            g, (gx, gy) = fern_frond(L, ang0=a0, bend=bd, curl=1.0, leaf=lf, seed=seed + 5 + k, pal=pal, with_root=True)
            g = g[:, ::-1]
            paste(can, g, zx + z.shape[1] - dx - (g.shape[1] - 1 - gx), base_y - gy)
    paste(can, z, zx, zy)
    if project:
        p = TextBlock('PROJECT', STYLES['sage'], scale=1, mode='show', wave=None, spacing=3)
        pa, pP, pPT = p.art(10.0)
        # trim to the drawn pixels
        ys, xs = np.nonzero(pa[..., 3])
        pa = pa[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        py = zy - pa.shape[0] + 2
        px = (W - pa.shape[1]) // 2
        paste(can, pa, px, py)
        # little rules either side of PROJECT
        rule = fern_rule(22, leaf=2, seed=9, pal=pal)
        paste(can, rule[:, ::-1], px - rule.shape[1] - 3, py + pa.shape[0] // 2 - rule.shape[0] // 2 - 1)
        paste(can, rule, px + pa.shape[1] + 3, py + pa.shape[0] // 2 - rule.shape[0] // 2 - 1)
    vy = zy + z.shape[0] + 1
    if vine:
        vr = fern_rule(z.shape[1] // 2 - 6, leaf=3, seed=11, pal=pal)
        paste(can, vr[:, ::-1], W // 2 - vr.shape[1] + 2, vy)
        paste(can, vr, W // 2 - 2, vy)
    if kiwi:
        kw = icon_rgba(KIWI)
        paste(can, kw, zx + z.shape[1] - kw.shape[1] - 10, vy - kw.shape[0] + 6)
    ys, xs = np.nonzero(can[..., 3])
    return can[max(0, ys.min() - 1):ys.max() + 2, max(0, xs.min() - 1):xs.max() + 2]


def fade_rgba(rgba, opacity, salt=0):
    """Ordered-dither opacity: a pixel stays while the Bayer threshold is under `opacity`."""
    if opacity >= 1:
        return rgba
    out = rgba.copy()
    if opacity <= 0:
        out[..., 3] = 0
        return out
    b = bayer_tile(rgba.shape[0], rgba.shape[1], 8)
    out[..., 3] = np.where(b < opacity, out[..., 3], 0)
    return out


def draw_rgba(frame, rgba, cx, cy, s, anchor='center', opacity=1.0):
    h, w = rgba.shape[:2]
    if anchor == 'center':
        x, y = cx - w * s // 2, cy - h * s // 2
    elif anchor == 'top':
        x, y = cx - w * s // 2, cy
    else:
        x, y = cx, cy
    x, y = (x // s) * s, (y // s) * s
    blit_art(frame, fade_rgba(rgba, opacity), x, y, s)


if __name__ == '__main__':
    import argparse
    from PIL import Image
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    fr = np.zeros((900, 1080, 3), np.uint8)
    fr[:] = (18, 24, 20)
    lg = logo()
    draw_rgba(fr, lg, 540, 260, 4)
    draw_rgba(fr, fern_rule(70), 540, 560, 3)
    draw_rgba(fr, fern_divider(40), 540, 640, 3)
    draw_rgba(fr, fern_frond(40, seed=3), 150, 780, 3)
    draw_rgba(fr, fern_frond(40, seed=5, pal=FERN_DRY), 930, 780, 3)
    Image.fromarray(fr).save(a.out)
    print('logo art', lg.shape)
