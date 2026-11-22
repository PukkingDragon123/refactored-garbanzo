#!/usr/bin/env python3
"""Alagard pixel-text effects for the Project Zealandia promo pack.

Glyphs are rasterised at Alagard's native grid (16 px per em: the outlines sit on a 64-unit grid in a
1024-unit em, cap height 11 px, ascent 12, descent 3), binarised, and every effect is built at that
art resolution. The result is scaled up by a whole number with nearest-neighbour, so nothing is ever
anti-aliased.

Effects (all composable on a TextBlock):
  - quantised 3-4 band gradient fill with a checker-dithered seam, a top bevel and a bottom shade
  - hard 1-art-px outline plus a second, darker outline around everything
  - stepped (diagonal staircase) drop shadow
  - per-letter entry: 'drop' (bounce, staggered) or 'type' (typewriter with a little pop)
  - gentle idle wave
  - pixel sparkles (4-point stars) on keywords
  - glow made of ordered-dithered rings (no blur)
  - shine sweep across the fill, ordered-dither dissolve exit

Usage from Python:
    from textfx import TextBlock, STYLES
    tb = TextBlock("PROJECT ZEALANDIA", STYLES['gold'], scale=8, mode='drop', t_in=0.2)
    tb.draw(frame_rgb_uint8, t, cx=540, cy=900)

CLI preview:  python3 tools/promo/textfx.py --out /path/preview.png
"""
from __future__ import annotations

import math
import os
import random
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, 'alagard.ttf')
NATIVE = 16          # px per em on the font's own pixel grid
LINE_H = 16          # ascent 12 + descent 3 + 1 lead

_font = None
_glyph_cache: dict = {}


def font():
    global _font
    if _font is None:
        _font = ImageFont.truetype(FONT_PATH, NATIVE)
    return _font


def hexc(h: str):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# ----------------------------------------------------------------------------------- dither helpers
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32)
BAYER4 = (_B4 + 0.5) / 16.0


def _bayer8():
    b = np.zeros((8, 8), dtype=np.float32)
    for y in range(8):
        for x in range(8):
            b[y, x] = 4 * _B4[y % 4, x % 4] + [[0, 2], [3, 1]][y // 4][x // 4]
    return (b + 0.5) / 64.0


BAYER8 = _bayer8()


def bayer_tile(h, w, n=4):
    b = BAYER4 if n == 4 else BAYER8
    reps = (h // b.shape[0] + 1, w // b.shape[1] + 1)
    return np.tile(b, reps)[:h, :w]


def dither_darken(img, level, cell, colour=(6, 10, 18), steps=3, strength=0.34):
    """level: float map 0..1. Ordered dither across `steps` darkening levels, each a fixed blend toward
    `colour`, so the pattern stays low-contrast (no smooth gradient, no screen-door)."""
    H, W = img.shape[:2]
    b = bayer_tile(H // cell + 1, W // cell + 1, 8)
    b = np.repeat(np.repeat(b, cell, 0), cell, 1)[:H, :W]
    k = np.clip(np.floor(level * steps + b), 0, steps).astype(np.int32)
    keep = (1 - strength) ** np.arange(steps + 1)
    f = keep[k][..., None]
    out = img.astype(np.float32) * f + np.array(colour, np.float32) * (1 - f)
    return out.astype(np.uint8)


# ---------------------------------------------------------------------------------- mask helpers
def shift(m, dx, dy):
    out = np.zeros_like(m)
    h, w = m.shape
    xs0, xd0 = (0, dx) if dx >= 0 else (-dx, 0)
    ys0, yd0 = (0, dy) if dy >= 0 else (-dy, 0)
    cw, ch = w - abs(dx), h - abs(dy)
    if cw <= 0 or ch <= 0:
        return out
    out[yd0:yd0 + ch, xd0:xd0 + cw] = m[ys0:ys0 + ch, xs0:xs0 + cw]
    return out


def dilate(m, conn=8):
    o = m.copy()
    o[1:, :] |= m[:-1, :]
    o[:-1, :] |= m[1:, :]
    o[:, 1:] |= m[:, :-1]
    o[:, :-1] |= m[:, 1:]
    if conn == 8:
        o[1:, 1:] |= m[:-1, :-1]
        o[1:, :-1] |= m[:-1, 1:]
        o[:-1, 1:] |= m[1:, :-1]
        o[:-1, :-1] |= m[1:, 1:]
    return o


# ------------------------------------------------------------------------------------- glyphs
@dataclass
class Icon:
    """A hand-placed pixel sprite that sits inline in a line of text (rows of palette keys)."""
    rows: list
    palette: dict
    def arrays(self):
        h, w = len(self.rows), max(len(r) for r in self.rows)
        col = np.zeros((h, w, 3), np.uint8)
        m = np.zeros((h, w), bool)
        for y, r in enumerate(self.rows):
            for x, c in enumerate(r):
                if c in self.palette:
                    col[y, x] = hexc(self.palette[c])
                    m[y, x] = True
        return m, col


def glyph(ch):
    """(mask bool[h,w], x_off, y_off, advance) at the native grid; y_off from the line top."""
    if ch in _glyph_cache:
        return _glyph_cache[ch]
    f = font()
    adv = int(round(f.getlength(ch)))
    if ch.strip() == '':
        res = (np.zeros((1, 1), bool), 0, 0, adv)
    else:
        mk = f.getmask(ch, mode='1')
        bb = f.getbbox(ch)
        w, h = mk.size
        a = np.array(mk, dtype=np.uint8).reshape(h, w) > 0
        res = (a, bb[0], bb[1], adv)
    _glyph_cache[ch] = res
    return res


@dataclass
class G:
    ch: str
    idx: int          # index into the source text
    x: int            # art px, layout space
    y: int            # line top, art px
    line: int
    word: int
    mask: np.ndarray
    ox: int
    oy: int
    icon_col: np.ndarray | None = None


def text_width(s, spacing=1):
    w = 0
    for c in s:
        w += glyph(c)[3] + spacing
    return max(0, w - spacing)


def wrap(text, max_w, spacing=1):
    """Greedy word wrap at the art grid. '\n' forces a break."""
    lines = []
    for para in text.split('\n'):
        cur = ''
        for word in para.split(' '):
            cand = word if not cur else cur + ' ' + word
            if max_w is None or text_width(cand, spacing) <= max_w or not cur:
                cur = cand
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


# --------------------------------------------------------------------------------------- styles
@dataclass
class Style:
    fill: list                    # gradient bands top -> bottom
    outline: str
    outline2: str
    shadow: list                  # one colour per staircase step
    glow: str | None = None
    glow_rings: int = 3
    glow_density: tuple = (0.55, 0.32, 0.15, 0.07, 0.03)
    bevel: str | None = None      # top-edge highlight on every stroke
    under: str | None = None      # bottom-edge shade on every stroke
    shine: str | None = None      # sweeping diagonal shine colour
    sparkle: tuple = ('#ffffff', '#fff4c2', '#ffd56b')
    band_top: int = 1             # rows of the line the gradient spans
    band_bot: int = 12


STYLES = {
    # the logo: molten gold with a deep ember shadow
    'gold': Style(fill=['#fffbe6', '#ffe991', '#ffd04a', '#ffad2f', '#ec7f22'],
                  outline='#5a1606', outline2='#140403', shadow=['#b8461b', '#82290f', '#511508'],
                  glow='#ffb545', glow_rings=6, glow_density=(0.6, 0.42, 0.28, 0.17, 0.09, 0.04),
                  bevel='#ffffff', under=None, shine='#fffdf0',
                  sparkle=('#ffffff', '#fff3b8', '#ffc85a')),
    'ember': Style(fill=['#fff6c8', '#ffe066', '#ffc23a', '#ffa22e'],
                   outline='#4d0f09', outline2='#150404', shadow=['#7a1f0f', '#4d120a'],
                   glow='#ff8a3a', glow_rings=3, bevel='#ffffff', under=None,
                   sparkle=('#ffffff', '#ffe7a8', '#ff9d4a')),
    # captions: ivory with a cool teal edge
    'caption': Style(fill=['#fffdf4', '#f4ead2', '#dccdaa'],
                     outline='#0f4a55', outline2='#04141a', shadow=['#0b323b', '#072229'],
                     glow='#3fd3c8', glow_rings=2, glow_density=(0.22, 0.07), bevel='#ffffff',
                     sparkle=('#ffffff', '#d9fffa', '#7ff0e2')),
    # creature names: ice-teal to ivory, bright glow
    'name': Style(fill=['#ffffff', '#e4fff6', '#a6f5e4', '#5fdcca', '#35b8b0'],
                  outline='#0a2a38', outline2='#02080c', shadow=['#145566', '#0d3a48', '#08242e'],
                  glow='#5cf2d8', glow_rings=4, glow_density=(0.45, 0.28, 0.14, 0.06), bevel=None,
                  under=None, shine='#ffffff',
                  sparkle=('#ffffff', '#e2fff9', '#8ff5e4')),
    # small print (subtitles)
    'small': Style(fill=['#e8fbf6', '#9fe0d6'], outline='#0b3540', outline2='#03090c',
                   shadow=['#08262e'], glow=None, bevel=None),
}


def band_colour_index(rows, xs, n, top, bot):
    """Quantised gradient index for pixels at (row, x); seams get a one-row checker."""
    v = (rows - top) / max(1, bot - top) * (n - 1)
    chk = ((rows + xs) & 1) * 0.5
    idx = np.floor(v + chk - 0.25 + 0.5).astype(int)
    return np.clip(idx, 0, n - 1)


# ----------------------------------------------------------------------------------- sparkles
_SPARK = {
    1: ['.a.',
        'aca',
        '.a.'],
    2: ['..b..',
        '..a..',
        'bacab',
        '..a..',
        '..b..'],
    3: ['...b...',
        '...a...',
        '..dad..',
        'baacaab',
        '..dad..',
        '...a...',
        '...b...'],
    4: ['....b....',
        '....b....',
        '....a....',
        '...dad...',
        'bbaacaabb',
        '...dad...',
        '....a....',
        '....b....',
        '....b....'],
}


def draw_sparkle(col, alpha, x, y, size, colours):
    rows = _SPARK[size]
    c = {'c': hexc(colours[0]), 'a': hexc(colours[0]), 'b': hexc(colours[2]), 'd': hexc(colours[1])}
    if size <= 2:
        c['a'] = hexc(colours[1])
    h, w = alpha.shape
    r = len(rows) // 2
    for j, row in enumerate(rows):
        for i, k in enumerate(row):
            if k == '.':
                continue
            px, py = x - r + i, y - r + j
            if 0 <= px < w and 0 <= py < h:
                col[py, px] = c[k]
                alpha[py, px] = True


def bounce(u):
    """easeOutBounce"""
    n1, d1 = 7.5625, 2.75
    if u < 1 / d1:
        return n1 * u * u
    if u < 2 / d1:
        u -= 1.5 / d1
        return n1 * u * u + 0.75
    if u < 2.5 / d1:
        u -= 2.25 / d1
        return n1 * u * u + 0.9375
    u -= 2.625 / d1
    return n1 * u * u + 0.984375


POP = [-3, -2, 0, 1, 0]      # typewriter pop, one step per 30 fps frame


# ----------------------------------------------------------------------------------- TextBlock
@dataclass
class TextBlock:
    text: str
    style: Style
    scale: int = 6
    max_w: int | None = None           # device px; wraps to fit
    align: str = 'center'
    spacing: int = 1                    # extra art px between letters
    line_gap: int = 3                   # extra art px between lines
    mode: str = 'type'                  # 'type' | 'drop' | 'show'
    t_in: float = 0.0
    type_rate: float = 0.055            # s per typed character
    drop_h: int = 26                    # art px the letters fall
    drop_dur: float = 0.6
    stagger: float = 0.06
    wave: tuple | None = (1, 0.7, 0.55)  # (amp art px, Hz, phase per letter)
    t_out: float | None = None
    out_dur: float = 0.35
    keywords: dict = field(default_factory=dict)   # word -> Style (fill override) or None
    sparkle_words: tuple = ()
    sparkle_rate: float = 5.0           # sparkles per second per keyword
    icons: dict = field(default_factory=dict)       # char -> Icon
    seed: int = 1
    shine_period: float = 2.4
    fps: float | None = 30.0            # typed reveals snap to frame times, so blips and letters coincide

    def __post_init__(self):
        self._layout()
        self._times()
        self._sparkles()

    # ---- layout
    def _layout(self):
        max_art = None if self.max_w is None else self.max_w // self.scale
        lines = wrap(self.text, max_art, self.spacing) if self.max_w else self.text.split('\n')
        self.lines = lines
        glyphs = []
        src_i = 0
        word = 0
        widths = []
        for ln in lines:
            widths.append(sum(self._adv(c) + self.spacing for c in ln) - self.spacing if ln else 0)
        self.w = max(widths) if widths else 0
        self.h = len(lines) * LINE_H + (len(lines) - 1) * self.line_gap
        for li, ln in enumerate(lines):
            # find this line in the source text (wrapping consumed one space or newline)
            while src_i < len(self.text) and self.text[src_i] in ' \n' and not ln.startswith(self.text[src_i]):
                src_i += 1
                word += 1
            x = {'center': (self.w - widths[li]) // 2, 'left': 0, 'right': self.w - widths[li]}[self.align]
            y = li * (LINE_H + self.line_gap)
            for c in ln:
                if c == ' ':
                    word += 1
                if c in self.icons:
                    m, col = self.icons[c].arrays()
                    ih = m.shape[0]
                    g = G(c, src_i, x, y, li, word, m, 0, 12 - ih + 2, col)
                    adv = m.shape[1]
                else:
                    m, ox, oy, adv = glyph(c)
                    g = G(c, src_i, x, y, li, word, m, ox, oy)
                glyphs.append(g)
                x += adv + self.spacing
                src_i += 1
            word += 1
        self.glyphs = glyphs
        # word strings, for keyword styling
        self.word_of = {}
        words = {}
        for g in glyphs:
            if g.ch != ' ':
                words.setdefault(g.word, []).append(g)
        self.words = words
        self.kw_style = {}
        self.kw_glyphs = []
        for wi, gs in words.items():
            wtxt = ''.join(g.ch for g in gs).strip(".,!?'\"").upper()
            if wtxt in {k.upper() for k in self.keywords}:
                st = [v for k, v in self.keywords.items() if k.upper() == wtxt][0]
                for g in gs:
                    if st is not None:
                        self.kw_style[g.idx] = st
            if wtxt in {k.upper() for k in self.sparkle_words}:
                self.kw_glyphs.append(gs)
        self.pad = max(4, self.style.glow_rings + 3) + len(self.style.shadow) + 4
        self.pad_top = self.pad + (self.drop_h if self.mode == 'drop' else 4)

    def _adv(self, c):
        if c in self.icons:
            return self.icons[c].arrays()[0].shape[1]
        return glyph(c)[3]

    # ---- timing
    def _times(self):
        """Reveal time of each glyph, and typed-character events for the babble."""
        t = self.t_in
        self.reveal = {}
        self.events = []
        if self.mode == 'type':
            prev = ''
            line = 0
            for g in self.glyphs:
                if g.line != line:          # the space eaten by the wrap still takes a beat
                    line = g.line
                    t += self.type_rate
                ts = round(t * self.fps) / self.fps if self.fps else t
                self.reveal[g.idx] = ts
                self.events.append({'t': ts, 'ch': g.ch, 'idx': g.idx, 'word': g.word})
                step = 1.0
                if g.ch in ',;:':
                    step = 3.0
                elif g.ch in '.!?':
                    step = 2.0 if g.ch == '.' else 4.0
                prev = g.ch
                t += step * self.type_rate
            self.t_done = t
        elif self.mode == 'drop':
            n = 0
            for g in self.glyphs:
                self.reveal[g.idx] = t + n * self.stagger
                if g.ch != ' ':
                    n += 1
            self.t_done = t + max(0, n - 1) * self.stagger + self.drop_dur
        else:
            for g in self.glyphs:
                self.reveal[g.idx] = t
            self.t_done = t
        # landing time of each dropped glyph (for the stinger)
        self.t_land = self.t_in + self.drop_dur * 0.36 if self.mode == 'drop' else self.t_in

    def _sparkles(self):
        rnd = random.Random(self.seed)
        self.sparks = []
        if not self.kw_glyphs:
            return
        t_end = self.t_out if self.t_out is not None else self.t_done + 30
        for gs in self.kw_glyphs:
            t0 = max(self.reveal[g.idx] for g in gs) + (self.drop_dur * 0.5 if self.mode == 'drop' else 0.05)
            # an opening burst, then a steady trickle
            burst = [t0 + 0.04 * k for k in range(min(5, len(gs) + 1))]
            ts = burst
            t = t0 + 0.3
            while t < t_end:
                t += rnd.expovariate(self.sparkle_rate)
                ts.append(t)
            for t in ts:
                g = rnd.choice(gs)
                ys, xs = np.nonzero(g.mask)
                if len(xs) == 0:
                    continue
                k = rnd.randrange(len(xs))
                # bias to the edge of the stroke and a little outside it
                px = g.x + g.ox + xs[k] + rnd.choice([-2, -1, 0, 1, 2])
                py = g.y + g.oy + ys[k] + rnd.choice([-2, -1, 0, 1])
                big = rnd.random() < 0.35
                self.sparks.append((t, g.idx, px, py, big))

    # ---- per-letter offset
    def _dy(self, g, t, i):
        r = self.reveal[g.idx]
        if t < r:
            return None
        if self.mode == 'drop':
            u = (t - r) / self.drop_dur
            if u < 1:
                dy = -int(round(self.drop_h * (1 - bounce(u))))
            else:
                dy = 0
            settled = r + self.drop_dur
        elif self.mode == 'type':
            f = int((t - r) * 30)
            dy = POP[f] if f < len(POP) else 0
            settled = r + len(POP) / 30
        else:
            dy, settled = 0, r
        if self.wave and t > settled:
            amp, hz, ph = self.wave
            ramp = min(1.0, (t - settled) / 0.6)
            dy += int(round(amp * ramp * math.sin(2 * math.pi * hz * (t - self.t_in) - i * ph)))
        return dy

    # ---- render at the art grid
    def art(self, t):
        """RGBA uint8 at art resolution, plus the canvas offset of the layout origin."""
        st = self.style
        P, PT = self.pad, self.pad_top
        H, W = self.h + P + PT, self.w + 2 * P
        mask = np.zeros((H, W), bool)
        fill = np.zeros((H, W, 3), np.uint8)
        icon_px = np.zeros((H, W), bool)
        drawn = {}
        vis_i = 0
        for g in self.glyphs:
            if g.ch == ' ':
                continue
            dy = self._dy(g, t, vis_i)
            vis_i += 1
            if dy is None:
                continue
            gx, gy = P + g.x + g.ox, PT + g.y + g.oy + dy
            drawn[g.idx] = dy
            gh, gw = g.mask.shape
            y0, y1 = max(0, gy), min(H, gy + gh)
            x0, x1 = max(0, gx), min(W, gx + gw)
            if y1 <= y0 or x1 <= x0:
                continue
            sub = g.mask[y0 - gy:y1 - gy, x0 - gx:x1 - gx]
            mask[y0:y1, x0:x1] |= sub
            if g.icon_col is not None:
                region = fill[y0:y1, x0:x1]
                region[sub] = g.icon_col[y0 - gy:y1 - gy, x0 - gx:x1 - gx][sub]
                icon_px[y0:y1, x0:x1] |= sub
                continue
            gst = self.kw_style.get(g.idx, st)
            ys, xs = np.nonzero(sub)
            rows = (ys + y0) - (PT + g.y + dy)          # row within this line, moves with the letter
            cols = np.array([hexc(c) for c in gst.fill], np.uint8)
            bi = band_colour_index(rows, xs + x0, len(cols), st.band_top, st.band_bot)
            fill[ys + y0, xs + x0] = cols[bi]
            # bevel / under-shade per stroke
            if gst.bevel:
                above = np.zeros_like(sub)
                above[1:] = sub[:-1]
                top_edge = sub & ~above
                ty, tx = np.nonzero(top_edge)
                keep = ((ty + y0) - (PT + g.y + dy)) < 8
                fill[ty[keep] + y0, tx[keep] + x0] = hexc(gst.bevel)
            if gst.under:
                below = np.zeros_like(sub)
                below[:-1] = sub[1:]
                bot_edge = sub & ~below
                by_, bx = np.nonzero(bot_edge)
                fill[by_ + y0, bx + x0] = hexc(gst.under)
        # shine sweep
        if st.shine and self.t_done < t:
            ph = ((t - self.t_done) % self.shine_period) / self.shine_period
            pos = int(ph * (W + H) * 1.6) - H
            yy, xx = np.nonzero(mask & ~icon_px)
            d = xx + (yy - PT) // 2 - pos
            sel = (d >= 0) & (d < 3)
            fill[yy[sel], xx[sel]] = hexc(st.shine)
        out1 = dilate(mask, 8) & ~mask
        sil = mask | out1
        layers = []
        sh_union = np.zeros_like(mask)
        for s, c in enumerate(st.shadow, 1):
            sh = shift(sil, s, s) & ~sil & ~sh_union
            layers.append((sh, c))
            sh_union |= sh
        union = sil | sh_union
        out2 = dilate(union, 8) & ~union
        col = np.zeros((H, W, 3), np.uint8)
        alpha = np.zeros((H, W), bool)
        # glow (bottom)
        if st.glow and alpha.size:
            prev = union | out2
            bt = bayer_tile(H, W, 4)
            pulse = 0.85 + 0.15 * math.sin(t * 2 * math.pi * 0.8)
            gc = hexc(st.glow)
            for r in range(st.glow_rings):
                ring = dilate(prev, 8 if r % 2 else 4) & ~prev
                dens = st.glow_density[min(r, len(st.glow_density) - 1)] * pulse
                sel = ring & (bt < dens)
                col[sel] = gc
                alpha |= sel
                prev = prev | ring
        col[out2] = hexc(st.outline2)
        alpha |= out2
        for sh, c in layers:
            col[sh] = hexc(c)
            alpha |= sh
        col[out1] = hexc(st.outline)
        alpha |= out1
        col[mask] = fill[mask]
        alpha |= mask
        # dissolve out
        if self.t_out is not None and t >= self.t_out:
            k = (t - self.t_out) / self.out_dur
            if k >= 1:
                alpha[:] = False
            else:
                alpha &= bayer_tile(H, W, 8) >= k
        # sparkles on top
        for (ts, gi, px, py, big) in self.sparks:
            if gi not in drawn:
                continue
            age = t - ts
            life = 0.55 if big else 0.4
            if 0 <= age < life:
                seq = [1, 2, 3, 4, 3, 2, 1] if big else [1, 2, 3, 2, 1]
                size = seq[min(len(seq) - 1, int(age / life * len(seq)))]
                if self.t_out is not None and t >= self.t_out:
                    continue
                draw_sparkle(col, alpha, P + px, PT + py + drawn[gi], size, st.sparkle if gi not in self.kw_style else self.kw_style[gi].sparkle)
        rgba = np.zeros((H, W, 4), np.uint8)
        rgba[..., :3] = col
        rgba[..., 3] = alpha * 255
        return rgba, P, PT

    # ---- composite on a device frame
    def size_px(self):
        return self.w * self.scale, self.h * self.scale

    def draw(self, frame, t, cx, cy, anchor='center', snap=True):
        """Draw onto an RGB uint8 frame in place. (cx, cy) is the layout's anchor in device px."""
        if t < self.t_in - 0.001:
            return
        if self.t_out is not None and t > self.t_out + self.out_dur:
            return
        rgba, P, PT = self.art(t)
        s = self.scale
        bw, bh = self.w * s, self.h * s
        if anchor == 'center':
            x0, y0 = cx - bw // 2, cy - bh // 2
        elif anchor == 'top':
            x0, y0 = cx - bw // 2, cy
        elif anchor == 'bottom':
            x0, y0 = cx - bw // 2, cy - bh
        else:
            x0, y0 = cx, cy
        if snap:
            x0, y0 = (x0 // s) * s, (y0 // s) * s
        blit_art(frame, rgba, x0 - P * s, y0 - PT * s, s)


def blit_art(frame, rgba, x, y, s):
    """Nearest-neighbour upscale by s and paste (binary alpha)."""
    big = np.repeat(np.repeat(rgba, s, axis=0), s, axis=1)
    H, W = frame.shape[:2]
    h, w = big.shape[:2]
    fx0, fy0 = max(0, x), max(0, y)
    fx1, fy1 = min(W, x + w), min(H, y + h)
    if fx1 <= fx0 or fy1 <= fy0:
        return
    sub = big[fy0 - y:fy1 - y, fx0 - x:fx1 - x]
    a = sub[..., 3] > 0
    frame[fy0:fy1, fx0:fx1][a] = sub[..., :3][a]


def fit_scale(text, max_w_px, smax=8, smin=3, spacing=1):
    w = text_width(text, spacing)
    for s in range(smax, smin - 1, -1):
        if w * s <= max_w_px:
            return s
    return smin


# --------------------------------------------------------------------------- icons drawn by hand
# A speech bubble with a little game controller inside (deliberately not any company's logo).
CHAT_PAD = Icon(rows=[
    '...oooooooooooo...',
    '..owwwwwwwwwwwwo..',
    '.owwhhhhhhhhhhwwo.',
    'owwhkkkkkkkkkkhwwo',
    'owwkkccccccccckwwo',
    'owkccwcccccrcckkwo',
    'owkcwwwccccrbcckwo',
    'owkccwcccrcccbckwo',
    'owkcccccccbccckwwo',
    'owwkcckkkkkkcckwwo',
    'owwkkkwwwwwwkkkwwo',
    '.owwwwwwwwwwwwwwo.',
    '..ooowwwwwwwwooo..',
    '.....owwwoooo.....',
    '.....owwo.........',
    '....owwo..........',
    '....oo............',
], palette={'o': '#0a2a38', 'w': '#e9fbf5', 'h': '#ffffff', 'k': '#1a3442', 'c': '#5e6fd6',
            'r': '#ff6b6b', 'b': '#ffd166'})

# a small 4-point star used as a bullet
STAR = Icon(rows=[
    '...a...',
    '...a...',
    '..aca..',
    'aaccaa.',
    '..aca..',
    '...a...',
    '...a...',
], palette={'a': '#ffd56b', 'c': '#ffffff'})


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='Render a preview sheet of the Alagard effects.')
    ap.add_argument('--out', required=True)
    ap.add_argument('--t', type=float, default=3.0)
    a = ap.parse_args()
    fr = np.zeros((1300, 1080, 3), np.uint8)
    fr[:] = (24, 40, 52)
    fr[::12, :] = (30, 52, 66)
    blocks = [
        (TextBlock('PROJECT', STYLES['gold'], 7, mode='drop', t_in=0.0), 140),
        (TextBlock('ZEALANDIA', STYLES['gold'], 11, mode='drop', t_in=0.3, sparkle_words=('ZEALANDIA',)), 300),
        (TextBlock('SOMETHING IS CIRCLING...', STYLES['caption'], 6, max_w=1000, t_in=0.0), 520),
        (TextBlock('GLASSEYE WHALER', STYLES['name'], 7, mode='drop', t_in=0.5, sparkle_words=('GLASSEYE',)), 720),
        (TextBlock("COMMENT 'PLAY' FOR THE GAME LINK", STYLES['caption'], 5, max_w=1000, t_in=0.0,
                   keywords={"PLAY": STYLES['ember']}, sparkle_words=('PLAY',)), 880),
        (TextBlock('\x01 PLAYTEST ON DISCORD, LINK IN BIO', STYLES['caption'], 5, max_w=1000, t_in=0.0,
                   icons={'\x01': CHAT_PAD}, keywords={'DISCORD': STYLES['name']}), 1060),
        (TextBlock('Knock its snout and it veers off.', STYLES['caption'], 5, max_w=1000, t_in=0.0), 1200),
    ]
    for tb, y in blocks:
        tb.draw(fr, a.t, 540, y)
    Image.fromarray(fr).save(a.out)
    print('wrote', a.out)
