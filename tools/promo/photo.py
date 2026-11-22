#!/usr/bin/env python3
"""The photo moment and the field-guide species card for the Project Zealandia films.

Everything is pixel art on the footage's own grid (3 device px per art px):
  viewfinder_art()  thin corner brackets, a focus ring that tightens and locks, an exposure tick row
  make_print()      the frozen frame as a photo print: ivory border, the name handwritten on the lower border
  stamp_art()       a red NEW SPECIES stamp with an ink texture
  pin_art()         a map pin to fix the print to the card
  card_art()        an aged field-guide page: dithered edges and burn, paper fibres, a fern, the pinned
                    print, the name, the binomial and a few data lines from the species entry

PhotoMoment and SpeciesCard are drawables for compose.py (draw(frame, t, ...)).
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from textfx import TextBlock, STYLES, hexc, dilate, shift, bayer_tile, blit_art, _hash
import ornaments as O

S = 3                      # device px per art px (the footage's pixel)
BONE = '#f2ead6'
DARK = '#14120e'
LOCK = '#b6cc7c'
PAPER = ('#ece1c6', '#e3d6b8', '#f3ead4', '#cdb98f', '#b9a173')


# ----------------------------------------------------------------------------------------- helpers
def text_rgba(text, style, spacing=1, max_w=None, align='left'):
    """Text at the art grid, trimmed to its layout box. Returns (rgba, ox, oy): paste at (x-ox, y-oy)."""
    b = TextBlock(text, STYLES[style], scale=1, mode='show', wave=None, spacing=spacing, max_w=max_w,
                  align=align, icons={'\x03': O.MIDDOT})
    a, P, PT = b.art(10.0)
    return a, P, PT, b


def paste(dst, src, x, y):
    O.paste(dst, src, int(x), int(y))


def rotate(rgba, deg):
    """Rotate pixel art by nearest neighbour (a slight tilt keeps hard edges)."""
    if abs(deg) < 0.01:
        return rgba
    im = Image.fromarray(rgba, 'RGBA').rotate(deg, resample=Image.NEAREST, expand=True)
    return np.array(im)


def drop_shadow(rgba, steps=(('#0b0907', 1.0), ('#0b0907', 0.5))):
    """A stepped drop shadow under an RGBA sprite (down-right), the second step dithered."""
    h, w = rgba.shape[:2]
    n = len(steps)
    out = np.zeros((h + n, w + n, 4), np.uint8)
    m = rgba[..., 3] > 0
    big = np.zeros((h + n, w + n), bool)
    big[:h, :w] = m
    used = big.copy()
    b4 = bayer_tile(h + n, w + n, 4)
    for k, (c, d) in enumerate(steps, 1):
        sh = shift(big, k, k) & ~used
        if d < 1:
            sh &= b4 < d
        used |= sh
        out[sh, :3] = hexc(c)
        out[sh, 3] = 255
    out[:h, :w][m] = rgba[m]
    return out


def circle(cx, cy, r):
    """Midpoint circle: a crisp one-pixel ring."""
    pts = set()
    x, y, d = r, 0, 1 - r
    while x >= y:
        for a, b in ((x, y), (y, x), (-x, y), (-y, x), (x, -y), (y, -x), (-x, -y), (-y, -x)):
            pts.add((cx + a, cy + b))
        y += 1
        if d < 0:
            d += 2 * y + 1
        else:
            x -= 1
            d += 2 * (y - x) + 1
    return pts


def fade(rgba, op):
    return O.fade_rgba(rgba, op)


# -------------------------------------------------------------------------------------- viewfinder
def viewfinder_art(Wa, Ha, box, u, locked):
    """Full-frame RGBA at the art grid. box = (x0, y0, x1, y1) of the photo; u in [0,1] tightens the ring."""
    rgba = np.zeros((Ha, Wa, 4), np.uint8)
    m = np.zeros((Ha, Wa), bool)
    col = np.zeros((Ha, Wa, 3), np.uint8)

    def put(x, y, c):
        if 0 <= x < Wa and 0 <= y < Ha:
            m[y, x] = True
            col[y, x] = hexc(c)

    x0, y0, x1, y1 = box
    arm = 18
    for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        for k in range(arm):
            put(cx + dx * k, cy, BONE)
            put(cx, cy + dy * k, BONE)
    fx, fy = (x0 + x1) // 2, (y0 + y1) // 2
    r = int(round(34 - 20 * (1 - (1 - u) ** 2)))
    ring = LOCK if locked else BONE
    for (x, y) in circle(fx, fy, r):
        put(x, y, ring)
    for k in range(3):                                   # focus ticks: N, S, E, W just outside the ring
        put(fx, fy - r - 2 - k, ring)
        put(fx, fy + r + 2 + k, ring)
        put(fx - r - 2 - k, fy, ring)
        put(fx + r + 2 + k, fy, ring)
    put(fx, fy, ring)
    # exposure tick row under the frame: -2 .. 0 .. +2, the needle settles on 0 as focus locks
    ty = y1 + 6
    for k in range(-8, 9):
        x = fx + k * 4
        hgt = 4 if k % 4 == 0 else 2
        for j in range(hgt):
            put(x, ty + 4 - j, BONE)
    needle = int(round(fx + (1 - u) * 22 * math.sin(u * 9)))
    for j in range(3):
        for i in range(-j, j + 1):
            put(needle + i, ty - 3 + j, LOCK if locked else '#e8b86a')
    # a ready light, top right of the frame
    for i in range(2):
        for j in range(2):
            put(x1 - 6 + i, y0 + 5 + j, LOCK if locked else '#d9553f')
    o = dilate(m, 8) & ~m
    rgba[o, :3] = hexc(DARK)
    rgba[o, 3] = 255
    rgba[m, :3] = col[m]
    rgba[m, 3] = 255
    return rgba


# ------------------------------------------------------------------------------------------ print
def make_print(photo_art, name, border=5, bottom=19):
    """Photo (RGB art) on an ivory print, the name handwritten on the lower border."""
    h, w = photo_art.shape[:2]
    P = np.zeros((h + border + bottom, w + 2 * border, 4), np.uint8)
    P[..., :3] = hexc('#f4eedf')
    P[..., 3] = 255
    hs = _hash(P.shape[0], P.shape[1], 17)
    P[hs < 0.06, :3] = hexc('#e7dfcb')
    P[:, [0, -1], :3] = hexc('#d8cdb2')
    P[[0, -1], :, :3] = hexc('#d8cdb2')
    P[border:border + h, border:border + w, :3] = photo_art
    P[border - 1, border:border + w, :3] = hexc('#cfc3a6')
    a, ox, oy, b = text_rgba(name, 'ink_pen', spacing=0)
    tx = (P.shape[1] - b.w) // 2
    paste(P, a, tx - ox, h + border + 3 - oy)
    return P


def stamp_art(text='NEW SPECIES', seed=5):
    a, ox, oy, b = text_rgba(text, 'ink_bold', spacing=1)
    w, h = b.w + 13, 22
    R = np.zeros((h, w, 4), np.uint8)
    red, light = hexc('#b3261e'), hexc('#d65a45')
    m = np.zeros((h, w), bool)
    m[0, 2:-2] = m[-1, 2:-2] = True
    m[2:-2, 0] = m[2:-2, -1] = True
    m[1, 1] = m[1, -2] = m[-2, 1] = m[-2, -2] = True
    m[2, 3:-3] = m[-3, 3:-3] = True                       # the inner rule of a rubber stamp
    tm = a[..., 3] > 0
    ys, xs = np.nonzero(tm)
    ty, tx = ys - oy + 3, xs - ox + 6
    ok = (ty >= 0) & (ty < h) & (tx >= 0) & (tx < w)
    box = m.copy()
    m[ty[ok], tx[ok]] = True
    hs = _hash(h, w, seed)
    m &= ~((box & (hs < 0.2)) | (~box & (hs < 0.04)))    # ink that did not take: the rim more than the type
    R[m, :3] = red
    R[m & (hs > 0.82), :3] = light
    R[m, 3] = 255
    return shear(R, -0.09)


def shear(rgba, k):
    """Tilt by shifting whole columns (strokes stay intact, unlike a rotation at this size)."""
    h, w = rgba.shape[:2]
    off = [int(round(x * k)) for x in range(w)]
    lo, hi = min(off), max(off)
    out = np.zeros((h + hi - lo, w, 4), np.uint8)
    for x in range(w):
        out[off[x] - lo:off[x] - lo + h, x] = rgba[:, x]
    return out


def pin_art():
    rows = ['..oooo..',
            '.orrrro.',
            'orhhrrro',
            'orhrrrro',
            'orrrrrdo',
            '.orrddo.',
            '..oooo..',
            '...os...',
            '...os...',
            '....s...']
    pal = {'o': '#3a0f0b', 'r': '#c4392c', 'h': '#f4a08e', 'd': '#8a2219', 's': '#6b6152'}
    a = np.zeros((len(rows), len(rows[0]), 4), np.uint8)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in pal:
                a[y, x, :3] = hexc(pal[c])
                a[y, x, 3] = 255
    return a


# ------------------------------------------------------------------------------------------- card
def paper(w, h, seed=3):
    """An aged page: base tone, fibres, a dithered burn toward the edges and a ragged edge."""
    hs = _hash(h, w, seed)
    hs2 = _hash(h, w, seed + 7)
    a = np.zeros((h, w, 4), np.uint8)
    a[..., :3] = hexc(PAPER[0])
    a[hs < 0.10, :3] = hexc(PAPER[1])
    a[hs > 0.95, :3] = hexc(PAPER[2])
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)).astype(np.float32)
    b = bayer_tile(h, w, 8)
    burn = np.clip(1 - d / 9, 0, 1)
    a[b < burn * 0.75, :3] = hexc(PAPER[3])
    a[b < burn * 0.3, :3] = hexc(PAPER[4])
    a[..., 3] = 255
    a[(d < 1.5) & (hs2 < 0.35)] = 0                    # ragged edge
    a[(d < 0.5)] = 0
    a[(d < 2.5) & (hs2 < 0.06)] = 0
    # a foxing spot or two
    rng = np.random.default_rng(seed)
    for _ in range(3):
        cx, cy = rng.integers(20, w - 20), rng.integers(20, h - 20)
        sel = ((xx - cx) ** 2 + (yy - cy) ** 2 < rng.integers(4, 12)) & (b < 0.35) & (a[..., 3] > 0)
        a[sel, :3] = hexc('#d8c59c')
    return a


def card_art(small_print, info, entry, seed=3):
    """The field-guide entry. info: common, sci, group, rows [(label, value), ...]."""
    W, H = 340, 222
    C = paper(W, H, seed)
    # the pinned print, tilted
    pr = rotate(drop_shadow(small_print, (('#5d4e35', 1.0), ('#5d4e35', 0.5))), -3)
    px, py = 12, 12
    paste(C, pr, px, py)
    pin = pin_art()
    paste(C, pin, px + pr.shape[1] // 2 - 4, py - 3)
    # right column
    rx = px + pr.shape[1] + 8
    y = 16
    a, ox, oy, b = text_rgba('FIELD GUIDE', 'ink_muted', spacing=2)
    paste(C, a, rx - ox, y - oy)
    a, ox, oy, b2 = text_rgba(entry, 'ink_muted', spacing=1)
    y += 15
    paste(C, a, rx - ox, y - oy)
    y += 19
    rule = O.fern_rule(min(60, W - rx - 14), leaf=2, seed=seed + 2, pal=O.FERN_DRY, outline=False)
    paste(C, rule, rx - 2, y)
    y += rule.shape[0] + 4
    a, ox, oy, b = text_rgba(info['common'], 'ink_bold', spacing=1, max_w=W - rx - 10)
    paste(C, a, rx - ox, y - oy)
    y += b.h + 3
    a, ox, oy, b = text_rgba(info['sci'], 'ink_muted', spacing=1, max_w=W - rx - 10)
    paste(C, a, rx - ox, y - oy)
    y += b.h + 3
    a, ox, oy, b = text_rgba(info['group'].upper(), 'ink_muted', spacing=2)
    paste(C, a, rx - ox, y - oy)
    # data rows across the page
    y = py + small_print.shape[0] + 14
    for lab, val in info['rows']:
        a, ox, oy, b = text_rgba(lab, 'ink_muted', spacing=1)
        paste(C, a, 14 - ox, y - oy)
        a, ox, oy, b = text_rgba(val, 'ink', spacing=1)
        paste(C, a, 67 - ox, y - oy)
        y += 17
    # a dry fern in the bottom-right corner, half off the page
    f = O.fern_frond(34, ang0=-math.pi / 2 - 0.9, bend=-0.6, curl=1.0, leaf=5, seed=seed + 4, pal=O.FERN_DRY,
                     outline=False)
    paste(C, f, W - f.shape[1] + 4, H - f.shape[0] + 6)
    C[:, :, 3] = np.where(paper(W, H, seed)[..., 3] > 0, C[..., 3], 0)   # keep the ragged edge
    return drop_shadow(C)


# --------------------------------------------------------------------------------------- drawables
class PhotoMoment:
    """Viewfinder (tb-0.6 .. tb), shutter at tb (the caller flashes and freezes the frame), then the print:
    it shrinks in steps and slides to its rest, a NEW SPECIES stamp thumps on, it holds, it slides out."""

    def __init__(self, tb, focus, name, rest=(820, 1235), hold=4.0, fw=1080, fh=1920):
        self.tb, self.name, self.rest, self.hold = tb, name, rest, hold
        self.fw, self.fh = fw, fh
        Wa, Ha = fw // S, fh // S
        pw, ph = 288, 216
        fx, fy = focus[0] // S, focus[1] // S
        x0 = int(np.clip(fx - pw // 2, 2, Wa - pw - 2))
        y0 = int(np.clip(fy - ph // 2, 30, Ha - ph - 40))
        self.box = (x0, y0, x0 + pw - 1, y0 + ph - 1)
        self.big = self.small = self.stamp = None
        self.t_stamp = tb + 0.95
        self.t_out = tb + 0.75 + hold
        self.end = self.t_out + 0.45

    def capture(self, frame):
        x0, y0, x1, y1 = self.box
        art = frame[y0 * S:(y1 + 1) * S:S, x0 * S:(x1 + 1) * S:S]     # one sample per footage pixel
        self.big = make_print(art.copy(), self.name, border=6, bottom=22)
        self.small = make_print(art[::2, ::2].copy(), self.name)
        self.stamp = stamp_art()
        self.small_stamped = self.small.copy()
        sx = self.small.shape[1] - self.stamp.shape[1] + 6
        sy = self.small.shape[0] - self.stamp.shape[0] - 14
        st = self.stamp.copy()
        paste(self.small_stamped, st, sx, sy)
        self.small_stamped = self.small_stamped[:self.small.shape[0], :self.small.shape[1]]

    def draw(self, frame, t, *_):
        tb = self.tb
        if tb - 0.6 <= t < tb + 0.3:
            u = min(1.0, (t - (tb - 0.6)) / 0.5)
            vf = viewfinder_art(self.fw // S, self.fh // S, self.box, u, t >= tb - 0.12)
            blit_art(frame, fade(vf, min(1.0, (t - (tb - 0.6)) / 0.25)), 0, 0, S)
        if self.big is None or t < tb + 0.3 or t > self.end:
            return
        x0, y0, x1, y1 = self.box
        bx, by = (x0 + x1 + 1) * S // 2, (y0 + y1 + 1) * S // 2
        rx, ry = self.rest
        k = t - (tb + 0.3)
        if k < 0.12:                                      # the photo lifts off the frame as a print
            spr, sc, cx, cy = drop_shadow(self.big), S, bx, by + 30
        elif k < 0.24:
            spr, sc = rotate(drop_shadow(self.big), 2), 2
            cx, cy = bx + (rx - bx) // 3, by + (ry - by) // 3
        else:
            u = min(1.0, (k - 0.24) / 0.25)
            u = 1 - (1 - u) ** 3
            src = self.small_stamped if t >= self.t_stamp + 2 / 30 else self.small
            spr, sc = rotate(drop_shadow(src), 4), S
            cx = int(bx + (rx - bx) * (1 / 3 + 2 / 3 * u))
            cy = int(by + (ry - by) * (1 / 3 + 2 / 3 * u))
            if t >= self.t_out:                           # slide out to the right
                v = min(1.0, (t - self.t_out) / 0.45)
                cx = int(rx + (self.fw + 400 - rx) * v * v)
        h, w = spr.shape[:2]
        X, Y = (cx - w * sc // 2) // sc * sc, (cy - h * sc // 2) // sc * sc
        blit_art(frame, spr, X, Y, sc)
        # the stamp thumps down: two frames big, then it lands (and stays in the print)
        if self.t_stamp <= t < self.t_stamp + 2 / 30 and t < self.t_out:
            st = self.stamp
            sx = X + (spr.shape[1] - st.shape[1] - 2) * sc
            sy = Y + (spr.shape[0] - st.shape[0] - 18) * sc
            blit_art(frame, st, sx - st.shape[1] // 2, sy - st.shape[0] // 2, 4)


class SpeciesCard:
    """The field-guide page with the pinned print: rises in (dithered), holds, folds away in steps."""

    def __init__(self, moment, info, entry, t_in, hold, bottom=1850, fw=1080):
        self.m, self.info, self.entry = moment, info, entry
        self.t_in, self.t_out = t_in, t_in + 0.5 + hold
        self.end = self.t_out + 0.45
        self.bottom, self.fw = bottom, fw
        self.art = None

    def draw(self, frame, t, *_):
        if t < self.t_in or t > self.end or self.m.small is None:
            return
        if self.art is None:
            self.art = card_art(self.m.small_stamped, self.info, self.entry)
        a = self.art
        h, w = a.shape[:2]
        x = (self.fw - w * S) // 2 // S * S
        y = (self.bottom - h * S) // S * S
        k = t - self.t_in
        if k < 0.5:                                       # rises 12 art px while it dithers in
            a = fade(a, k / 0.5)
            y += int((1 - k / 0.5) * 12) * S
        if t >= self.t_out:                               # folds: rows squeezed toward the middle, in steps
            v = min(1.0, max(0.0, (t - self.t_out) / 0.45))
            keep = max(2, int(h * (1 - v) ** 1.5))
            step = max(1, round(4 * v))
            rows = np.linspace(0, h - 1, keep).astype(int)
            a = a[rows]
            a = fade(a, 1 - v * 0.8) if step > 2 else a
            y += (h - keep) * S // 2 // S * S
        blit_art(frame, a, x, y, S)
