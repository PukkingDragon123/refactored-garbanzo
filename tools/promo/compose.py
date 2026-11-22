#!/usr/bin/env python3
"""Compose the Project Zealandia nature films (vertical, about a minute each, documentary style).

    python3 tools/promo/compose.py --id shark
    python3 tools/promo/compose.py --all --sheet
    python3 tools/promo/compose.py --id gecko --frames 2,9.5,40      # preview frames only (PNG)

Input  <scratch>/promo/raw/<id>.mp4 (1080x1920, 30 fps) and manifest.json:
       per id 'duration', 'beats' {name: t, 'main': t} and/or 'shots' [{start, end, type}, ...], 'main'.
Output <scratch>/promo/out/reel_<id>.mp4, reel_<id>.wav, reel_<id>_levels.txt, reel_<id>_plan.txt
       (and reel_<id>_sheet.png with --sheet: 12 frames).

The film (E = footage length, capped at 70 s; total = E + 5 s):
  0.5 - 5.5 s   title card over the establishing shot: "THE KELP FOREST", a fern rule,
                "Project Zealandia · Field Notes"; each letter dithers in, then dissolves out
  shot cuts     a 0.4 s ordered-dither cross-dissolve from the outgoing shot's last frame
  captions      two or three calm observations from the field guide, placed on the shot list (top band)
  main beat     a field-note lower-third: fern rule, common name, small-caps habitat, binomial
  E - E+5       end card: last frame frozen and dither-darkened, the carved logo with fronds and a kiwi,
                "Comment PLAY for the game link", a fern divider, "Playtest on Discord · link in bio"
Sound: the CC0 track (next-to-you for the dive, town-theme elsewhere) and a synthesised ambience bed.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import zlib

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio as A                                    # noqa: E402
from textfx import TextBlock, STYLES, fit_scale, text_width, bayer_tile, dither_darken   # noqa: E402
import ornaments as O                                # noqa: E402

W, H, FPS = 1080, 1920, 30
SCRATCH = os.environ.get('PROMO_SCRATCH',
                         '/tmp/claude-0/-home-user-refactored-garbanzo/008a599d-3fa5-508c-bfed-9f9233f31c34/scratchpad')
PROMO = os.path.join(SCRATCH, 'promo')
END_DUR = 5.0
MAX_FOOTAGE = 70.0
CELL = 3                 # device px per footage art pixel (the raw is a 3x nearest upscale)
XFADE = 0.4
DOT = '\x03'             # a mid-dot (Alagard has none): drawn as a 2x2 pixel icon
MARGIN = 72

FILMS = {
    'shark': dict(title='THE KELP FOREST', common='Glasseye Whaler', sci='Carcharhinus vitreus',
                  place='WHALER SHARK\nTE MOANA RIMURIMU', bed='underwater',
                  music='next-to-you.mp3', music_offset=0.0,
                  captions=[('kelp', 'A forest of kelp is a maze to a three-metre shark.'),
                            ('investigate', 'A whaler patrols the edge of the reef, where the blue begins.'),
                            ('hunch', 'Back up, fins down: the warning before a charge.'),
                            ('veer', 'A sharp knock on the snout makes it think again.')]),
    'gecko': dict(title='THE GLOW FOREST', common='Mokoturama', sci='Hoplodactylus lucernarius',
                  place='LANTERN GECKO\nTHE GLOW FOREST, NIGHT', bed='night',
                  music='town-theme.mp3', music_offset=18.0,
                  captions=[('forage', 'At night, two rows of lights wake along its flanks.'),
                            ('feed', 'It licks the sweet dew the glowcaps weep after dark.'),
                            ('lure', 'The lantern on its tail sways like a fungus cap. Moths come.'),
                            ('freeze', 'One false move, and every light goes out at once.')]),
    'worm': dict(title='THE FEATHERED GULLY', common='Ngaokeoke', sci='Peripatoides titan',
                 place='GIANT VELVET WORM\nTHE FEATHERED GULLY', bed='forest',
                 music='town-theme.mp3', music_offset=8.0,
                 captions=[('hide', 'Under a rotten log, the air stays wet.'),
                           ('curl', 'Uncovered, it curls up tight.'),
                           ('squirt', 'Two jets of slime, and they set like glue.'),
                           ('creep', 'Its kind has walked the earth for 500 million years.')]),
    'crab': dict(title='THE TIDELINE', common='Glass Crab', sci='Hyalocarcinus pellucidus',
                 place='GHOST CRAB\nTHE LANDING BEACH', bed='beach',
                 music='town-theme.mp3', music_offset=26.0,
                 captions=[('feed', 'On wet sand, only its organs seem to float.'),
                           ('wave', 'Males wave one oversized claw at their rivals.'),
                           ('dig', 'At the first footstep, it digs in.'),
                           ('peek', 'Then it peeks out on its eyestalks.')]),
}
REELS = FILMS          # stills.py and older callers


# ----------------------------------------------------------------------------------- manifest
RAW = os.path.join(PROMO, 'raw')


def raw_dir():
    return RAW


def probe_duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 18.0


def read_manifest(d, rid):
    p = os.path.join(d, 'manifest.json')
    if not os.path.exists(p):
        return {}
    try:
        m = json.load(open(p))
    except Exception:
        return {}
    if isinstance(m, dict) and isinstance(m.get(rid), dict):
        return m[rid]
    if isinstance(m, dict) and isinstance(m.get('reels'), dict):
        return m['reels'].get(rid, {})
    if isinstance(m, list):
        for e in m:
            if isinstance(e, dict) and e.get('id') == rid:
                return e
    return {}


def _num(v):
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, dict):
        for k in ('t', 'time', 'start'):
            if isinstance(v.get(k), (int, float)):
                return float(v[k])
    return None


def shots_of(man):
    out = []
    for s in man.get('shots', []) or []:
        if isinstance(s, dict):
            a, b = _num(s.get('start')), _num(s.get('end'))
            if a is not None:
                out.append(dict(start=a, end=b, type=str(s.get('type', s.get('name', ''))),
                                label=str(s.get('label', '')), beats=s.get('beats', {})))
    return sorted(out, key=lambda s: s['start'])


def anchor_time(man, name):
    """When does `name` happen? beats{} first, then a shot whose type/label/beats mention it."""
    beats = man.get('beats') or {}
    if isinstance(beats, dict) and name in beats and _num(beats[name]) is not None:
        return _num(beats[name])
    if isinstance(beats, list):
        for b in beats:
            if isinstance(b, dict) and name in (b.get('name'), b.get('type')):
                return _num(b)
    for s in shots_of(man):
        if name in (s['type'], s['label']) or name in s['type'].split('_') or \
                (isinstance(s['beats'], dict) and name in s['beats']):
            if isinstance(s['beats'], dict) and _num(s['beats'].get(name)) is not None:
                return _num(s['beats'][name])
            return s['start']
    return None


def main_time(man, default):
    for k in ('main', 'main_beat'):
        v = _num(man.get(k))
        if v is not None:
            return v
    v = anchor_time(man, 'main')
    if v is not None:
        return v
    for s in shots_of(man):
        if s['type'] in ('main', 'hero', 'behaviour', 'behavior'):
            return s['start']
    return default


# ------------------------------------------------------------------------------------- dither
_CB = {}


def cell_bayer(cell=CELL):
    if cell not in _CB:
        b = bayer_tile(H // cell + 1, W // cell + 1, 8)
        _CB[cell] = np.repeat(np.repeat(b, cell, 0), cell, 1)[:H, :W]
    return _CB[cell]


def band_scrim(frame, top, strength, frac=0.27):
    """Soft, stepped ordered-dither darkening of the top or bottom band behind text."""
    if strength <= 0:
        return
    strength = math.floor(strength * 6 + 1e-6) / 6
    band = int(H * frac)
    yy = np.arange(band, dtype=np.float32)
    lvl = (1 - yy / band) if top else (yy / band)
    lvl = np.clip(lvl, 0, 1) ** 1.1 * 0.75 * strength
    rows = slice(0, band) if top else slice(H - band, H)
    frame[rows] = dither_darken(frame[rows], np.broadcast_to(lvl[:, None], (band, W)), CELL, steps=3, strength=0.3)


_R2 = None


def endcard_bg(still, te):
    """Calm darkening: ordered dither across three levels, with a slow, soft vignette."""
    global _R2
    if _R2 is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        _R2 = ((xx - W / 2) / (W * 0.7)) ** 2 + ((yy - H * 0.45) / (H * 0.6)) ** 2
    r2 = _R2
    a = min(1.0, te / 1.2)
    lvl = np.clip(a * (0.72 + 0.3 * min(1.0, te / END_DUR) * r2 + 0.2 * r2), 0, 1)
    return dither_darken(still, lvl, CELL, colour=(6, 9, 8), steps=4, strength=0.3)


# --------------------------------------------------------------------------------- the plan
class Ornament:
    """An RGBA ornament with a dithered fade-in/out, drawn like a TextBlock."""

    def __init__(self, rgba, scale, t_in, fade=0.7, t_out=None, out_dur=0.6):
        self.rgba, self.scale, self.t_in, self.fade, self.t_out, self.out_dur = rgba, scale, t_in, fade, t_out, out_dur

    def draw(self, frame, t, cx, cy, anchor='center'):
        if t < self.t_in:
            return
        op = min(1.0, (t - self.t_in) / self.fade)
        if self.t_out is not None and t >= self.t_out:
            op = min(op, 1 - (t - self.t_out) / self.out_dur)
        if op <= 0:
            return
        O.draw_rgba(frame, self.rgba, cx, cy, self.scale, anchor, op)


def fade_text(text, style, scale, t_in, t_out=None, stagger=0.05, fade_dur=0.7, out_dur=0.7, spacing=1,
              max_w=None, align='center'):
    return TextBlock(text, STYLES[style], scale=scale, mode='fade', t_in=t_in, stagger=stagger, fade_dur=fade_dur,
                     t_out=t_out, out_dur=out_dur, wave=None, spacing=spacing, max_w=max_w, align=align,
                     icons={DOT: O.MIDDOT})


def build(rid, man, footage):
    cfg = FILMS[rid]
    E = min(footage, MAX_FOOTAGE)
    total = E + END_DUR
    items = []            # (drawable, x, y, anchor)
    log = []

    # title card over the establishing shot
    t_title_out = min(5.2, E * 0.3)
    ts = min(7, fit_scale(cfg['title'], 960, 7, 4, spacing=2))
    title = fade_text(cfg['title'], 'bone', ts, 0.6, t_out=t_title_out, stagger=0.07, fade_dur=0.8, spacing=2)
    rule = Ornament(O.fern_rule(70, leaf=3, seed=4), 3, 1.5, fade=0.9, t_out=t_title_out)
    sub = fade_text(f'Project Zealandia {DOT} Field Notes', 'sage', 3, 1.9, t_out=t_title_out, stagger=0.03, spacing=2)
    items += [(title, W // 2, 300, 'center'), (rule, W // 2, 300 + ts * 10 + 12, 'center'),
              (sub, W // 2, 300 + ts * 10 + 64, 'center')]
    log.append(f'title "{cfg["title"]}" 0.60 - {t_title_out + 0.7:.2f}s')
    top_busy = [(0.0, t_title_out + 0.8)]

    # lower third at the main beat
    tm = main_time(man, E * 0.4)
    lt0 = max(t_title_out + 0.6, min(tm + 0.3, E - 7.5))
    lt1 = min(lt0 + 6.5, E - 0.6)
    lrule = Ornament(O.fern_rule(64, leaf=3, seed=12), 3, lt0, fade=0.6, t_out=lt1)
    name = fade_text(cfg['common'], 'bone', min(6, fit_scale(cfg['common'], W - 2 * MARGIN, 6, 4, spacing=2)),
                     lt0 + 0.3, t_out=lt1, stagger=0.06, spacing=2, align='left')
    place = fade_text(cfg['place'], 'sage', 3, lt0 + 1.0, t_out=lt1, stagger=0.02, spacing=2, align='left')
    sci = fade_text(cfg['sci'], 'muted', 3, lt0 + 1.5, t_out=lt1, stagger=0.02, spacing=1, align='left')
    y = 1800 - (sci.h * 3 + place.h * 3 + name.h * name.scale + 14 * 3 + 30)
    items.append((lrule, MARGIN - 6, y, 'left'))
    y += 14 * 3 + 6
    for blk, gap in ((name, 10), (place, 8), (sci, 0)):
        items.append((blk, MARGIN, y, 'left'))
        y += blk.h * blk.scale + gap
    log.append(f'lower third "{cfg["common"]}" {lt0:.2f} - {lt1 + 0.7:.2f}s (main beat {tm:.2f}s)')
    bottom_busy = [(lt0 - 0.2, lt1 + 0.8)]

    # observation captions, placed on the shot list / beats, never on top of each other
    caps = []
    last_end = t_title_out + 0.9
    for name_, text in cfg['captions']:
        if len(caps) >= 3:
            break
        ta = anchor_time(man, name_)
        if ta is None:
            continue
        t0 = max(ta + 0.5, last_end + 0.6)
        if t0 - ta > 7.0:
            log.append(f'caption skipped (stale by {t0 - ta:.1f}s): "{text}" anchor {name_}@{ta:.2f}')
            continue
        dur = 3.2 + 0.035 * len(text)
        if t0 + dur > E - 0.5:
            log.append(f'caption skipped (no room): "{text}" anchor {name_}@{ta:.2f}')
            continue
        caps.append((t0, t0 + dur, text, name_, ta))
        last_end = t0 + dur + 0.7
    for t0, t1, text, name_, ta in caps:
        c = fade_text(text, 'bone', 4, t0, t_out=t1, stagger=0.025, fade_dur=0.6, out_dur=0.7, max_w=W - 2 * 80)
        items.append((c, W // 2, 330, 'center'))
        top_busy.append((t0 - 0.2, t1 + 0.8))
        log.append(f'caption {t0:6.2f} - {t1 + 0.7:6.2f}s  [{name_}@{ta:.2f}] "{text}"')

    # end card
    lg = O.logo()
    ls = 4 if lg.shape[1] * 4 <= W - 40 else 3
    logo = Ornament(lg, ls, E + 0.35, fade=1.1)
    cta1 = TextBlock('Comment PLAY\nfor the game link', STYLES['bone'], scale=5, mode='fade', t_in=E + 1.6,
                     stagger=0.03, fade_dur=0.6, wave=None, spacing=1, max_w=W - 120,
                     keywords={'PLAY': STYLES['moss']})
    div = Ornament(O.fern_divider(42, leaf=3), 3, E + 2.5, fade=0.8)
    cta2 = fade_text(f'Playtest on Discord\n{DOT} link in bio {DOT}', 'bone', 4, E + 2.8, stagger=0.03,
                     fade_dur=0.6)
    items += [(logo, W // 2, 690, 'center'), (cta1, W // 2, 1080, 'center'), (div, W // 2, 1215, 'center'),
              (cta2, W // 2, 1330, 'center')]
    log.append(f'end card {E:.2f} - {total:.2f}s')
    return dict(E=E, total=total, items=items, top_busy=top_busy, bottom_busy=bottom_busy, cfg=cfg, log=log)


def _strength(t, spans, ramp=0.5):
    s = 0.0
    for a, b in spans:
        if a <= t <= b:
            s = max(s, min(1.0, (t - a) / ramp, (b - t) / ramp))
    return s


# ----------------------------------------------------------------------------------- render
def render_audio(rid, plan, wav):
    cfg = plan['cfg']
    mix, stems, off = A.mix_film(plan['total'], cfg['bed'], cfg['music'], cfg['music_offset'], end_t=plan['E'],
                                 seed=zlib.crc32(rid.encode()) % 1000)
    A.write_wav(wav, mix)
    lines = [f'reel {rid}: music {cfg["music"]} from {off:.1f}s, bed {cfg["bed"]}',
             f'overall RMS  mix {A.db(mix):6.1f} dBFS   music {A.db(stems["music"]):6.1f}   '
             f'ambience {A.db(stems["ambience"]):6.1f}   peak {20 * math.log10(np.max(np.abs(mix)) + 1e-9):6.1f} dBFS',
             '  sec    mix   music  ambience   (dBFS RMS per second; stems before the master gain)']
    for s in range(int(plan['total'])):
        a, b = s * A.SR, (s + 1) * A.SR
        lines.append(f'  {s:3d}  {A.db(mix[a:b]):6.1f}  {A.db(stems["music"][a:b]):6.1f}  {A.db(stems["ambience"][a:b]):6.1f}')
    return lines


def render(rid, frames_only=None, out_dir=None, cuts='dither'):
    d = raw_dir()
    src = os.path.join(d, f'{rid}.mp4')
    if not os.path.exists(src):
        raise SystemExit(f'missing footage: {src}')
    out_dir = out_dir or os.path.join(PROMO, 'out')
    os.makedirs(out_dir, exist_ok=True)
    man = read_manifest(d, rid)
    footage = probe_duration(src)
    if _num(man.get('duration')) is not None:
        footage = min(footage, _num(man['duration']))
    plan = build(rid, man, footage)
    E, total = plan['E'], plan['total']
    nfr = int(round(total * FPS))
    cut_frames = sorted({int(round(s['start'] * FPS)) for s in shots_of(man) if 0.2 < s['start'] < E - 0.2})
    plan['log'].insert(0, f'reel {rid}: footage {footage:.2f}s, end card at {E:.2f}s, total {total:.2f}s '
                          f'({nfr} frames), {len(cut_frames)} cuts ({cuts})')
    wav = os.path.join(out_dir, f'reel_{rid}.wav')
    if frames_only is None:
        levels = render_audio(rid, plan, wav)
        with open(os.path.join(out_dir, f'reel_{rid}_levels.txt'), 'w') as f:
            f.write('\n'.join(levels) + '\n')
        with open(os.path.join(out_dir, f'reel_{rid}_plan.txt'), 'w') as f:
            f.write('\n'.join(plan['log']) + '\n')

    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={W}:{H}:flags=neighbor,fps={FPS}',
                            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE,
                           stderr=subprocess.DEVNULL if frames_only is not None else None)
    out_mp4 = os.path.join(out_dir, f'reel_{rid}.mp4')
    enc = None
    if frames_only is None:
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                                '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', wav,
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-tune', 'animation',
                                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest',
                                '-movflags', '+faststart', out_mp4], stdin=subprocess.PIPE)
    fsz = W * H * 3
    last = prev_shot_last = None
    frozen = None
    saved = {}
    eframe = int(round(E * FPS))
    xf_n = int(round(XFADE * FPS))
    cur_cut = None
    for i in range(nfr):
        t = i / FPS
        if i <= eframe:
            buf = dec.stdout.read(fsz)
            if len(buf) == fsz:
                if i in cut_frames:
                    prev_shot_last, cur_cut = last, i
                last = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            if last is None:
                last = np.zeros((H, W, 3), np.uint8)
            frame = last.copy()
            if i == eframe:
                frozen = last.copy()
            # ordered-dither cross-dissolve out of the previous shot's last frame
            if cuts == 'dither' and cur_cut is not None and prev_shot_last is not None and i - cur_cut < xf_n:
                k = (i - cur_cut + 1) / (xf_n + 1)
                keep_old = cell_bayer() >= k
                frame[keep_old] = prev_shot_last[keep_old]
        if t >= E:
            frame = endcard_bg(frozen if frozen is not None else last, t - E)
        else:
            band_scrim(frame, True, _strength(t, plan['top_busy']))
            band_scrim(frame, False, _strength(t, plan['bottom_busy']))
        for blk, x, y, anchor in plan['items']:
            blk.draw(frame, t, x, y, anchor)
        if enc:
            enc.stdin.write(frame.tobytes())
        if frames_only is not None and i in frames_only:
            saved[i] = frame.copy()
        if frames_only is not None and i >= max(frames_only):
            break
    dec.kill()
    dec.stdout.close()
    dec.wait()
    if enc:
        enc.stdin.close()
        enc.wait()
    return out_mp4, saved, plan


def contact_sheet(mp4, out_png, n=12, cols=6):
    from PIL import Image
    dur = probe_duration(mp4)
    tiles = []
    for k in range(n):
        t = dur * (k + 0.5) / n
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', mp4, '-frames:v', '1',
                              '-vf', 'scale=270:480:flags=neighbor', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                             capture_output=True).stdout
        tiles.append(np.frombuffer(raw, np.uint8).reshape(480, 270, 3))
    rows = [np.concatenate(tiles[r * cols:(r + 1) * cols], 1) for r in range(n // cols)]
    Image.fromarray(np.concatenate(rows, 0)).save(out_png)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--id', choices=list(FILMS))
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--out', default=None, help='output dir (default <scratch>/promo/out)')
    ap.add_argument('--sheet', action='store_true', help='also write a 12-frame contact sheet')
    ap.add_argument('--cuts', choices=['dither', 'plain'], default='dither')
    ap.add_argument('--raw', default=None, help='footage dir (default <scratch>/promo/raw)')
    ap.add_argument('--frames', default=None, help='only preview these times (s, comma separated) as PNGs')
    a = ap.parse_args()
    if a.raw:
        global RAW
        RAW = a.raw
    ids = list(FILMS) if a.all else ([a.id] if a.id else [])
    if not ids:
        ap.error('give --id or --all')
    if a.frames:
        from PIL import Image
        times = [float(x) for x in a.frames.split(',')]
        for rid in ids:
            fr = {int(round(t * FPS)): t for t in times}
            _, saved, plan = render(rid, frames_only=set(fr), out_dir=a.out, cuts=a.cuts)
            print('\n'.join(plan['log']))
            for i, img in saved.items():
                p = os.path.join(PROMO, 'work', f'prev_{rid}_{fr[i]:05.2f}.png')
                os.makedirs(os.path.dirname(p), exist_ok=True)
                Image.fromarray(img).save(p)
                print('preview', p)
        return
    for rid in ids:
        mp4, _, plan = render(rid, out_dir=a.out, cuts=a.cuts)
        print(f'wrote {mp4}  ({plan["total"]:.2f}s)')
        if a.sheet:
            sp = mp4.replace('.mp4', '_sheet.png')
            contact_sheet(mp4, sp)
            print('  sheet', sp)


if __name__ == '__main__':
    main()
