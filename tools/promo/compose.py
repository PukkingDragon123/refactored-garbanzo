#!/usr/bin/env python3
"""Compose the Project Zealandia promo reels: raw 9:16 footage + Alagard titles + chiptune audio.

    python3 tools/promo/compose.py --id shark
    python3 tools/promo/compose.py --all
    python3 tools/promo/compose.py --all --placeholder     # build & use placeholder footage

Input  <scratch>/promo/raw/<id>.mp4 (1080x1920, 30 fps) and manifest.json (optional).
Output <scratch>/promo/out/reel_<id>.mp4, reel_<id>.wav, reel_<id>_timing.txt.

Timeline of a reel (E = end-card start = min(footage, 16.5 s); total = E + 4.5 s):
  0 - 2.6 s   hook line typed with bleeps in the top band, dithered scrim, dissolves out
  beat        name card in the bottom band: whoosh, the name drops in letter by letter, sparkle chime,
              subtitle, then a one-line field-guide fact typed with bleeps
  E - E+4.5   end card: the last frame frozen and darkened with an ordered dither and a slow pixel
              vignette, the PROJECT ZEALANDIA logo (bass hit + sparkles), two calls to action typed.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio as A                                    # noqa: E402
from textfx import (TextBlock, STYLES, CHAT_PAD, Icon, fit_scale, text_width,   # noqa: E402
                    bayer_tile, dither_darken)

W, H, FPS = 1080, 1920, 30
SCRATCH = os.environ.get('PROMO_SCRATCH',
                         '/tmp/claude-0/-home-user-refactored-garbanzo/008a599d-3fa5-508c-bfed-9f9233f31c34/scratchpad')
PROMO = os.path.join(SCRATCH, 'promo')
END_DUR = 4.5
MAX_FOOTAGE = 16.5
CELL = 6               # device px per dither cell (matches the chunky title pixels)

REELS = {
    'shark': dict(hook='SOMETHING IS CIRCLING...', hook_kw='CIRCLING',
                  name='GLASSEYE WHALER', sub='OF THE KELP DROP-OFF',
                  fact='Knock its snout and it veers off.',
                  music='next-to-you.mp3', music_offset=0.0, beat=7.0,
                  ph_still='trailer/s10.png', ph_y=60),
    'gecko': dict(hook='WHAT GLOWS IN THE DARK?', hook_kw='GLOWS',
                  name='MOKOTURAMA', sub='THE LANTERN GECKO',
                  fact='Its glowing tail lures moths in.',
                  music='town-theme.mp3', music_offset=0.0, beat=7.0,
                  ph_still='trailer/s06.png', ph_y=60),
    'worm': dict(hook='LIFT THE LOG...', hook_kw='LOG',
                 name='NGAOKEOKE', sub='THE VELVET WORM',
                 fact='It hunts with glue.',
                 music='town-theme.mp3', music_offset=18.0, beat=7.0,
                 ph_still='trailer/s03.png', ph_y=70),
    'crab': dict(hook='LOOK CLOSER AT THE TIDE', hook_kw='CLOSER',
                 name='GLASS CRAB', sub='OF THE TIDELINE',
                 fact='You can see its heart beat.',
                 music='town-theme.mp3', music_offset=38.0, beat=7.0,
                 ph_still='trailer/s01.png', ph_y=70),
}

SMALL_STAR = Icon(rows=[
    '..a..',
    '.aca.',
    'acCca',
    '.aca.',
    '..a..',
], palette={'a': '#ffc85a', 'c': '#fff3b8', 'C': '#ffffff'})


# ----------------------------------------------------------------------------------- footage
def raw_dir(placeholder):
    return os.path.join(PROMO, 'placeholder' if placeholder else 'raw')


def make_placeholders():
    """Still-pan stand-ins with the same contract as helper A's footage."""
    d = raw_dir(True)
    os.makedirs(d, exist_ok=True)
    man = {}
    for rid, cfg in REELS.items():
        src = os.path.join(SCRATCH, cfg['ph_still'])
        out = os.path.join(d, f'{rid}.mp4')
        if not os.path.exists(out):
            dur = 18
            vf = (f"crop=360:640:x='trunc((1280-360)*t/{dur})':y={cfg['ph_y']},"
                  f"scale=1080:1920:flags=neighbor,fps=30")
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-i', src, '-t', str(dur), '-vf', vf,
                            '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', out], check=True)
        for k in (1, 2, 3):
            sp = os.path.join(d, f'{rid}_still_{k}.png')
            if not os.path.exists(sp):
                subprocess.run(['cp', src, sp], check=True)
        man[rid] = {'duration': 18.0, 'beats': {'main': cfg['beat']}}
    with open(os.path.join(d, 'manifest.json'), 'w') as f:
        json.dump(man, f, indent=2)


def probe_duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 18.0


def main_beat(entry, default):
    """Find the main behaviour beat in whatever shape the manifest uses."""
    if not isinstance(entry, dict):
        return default
    for k in ('main_beat', 'main', 'beat', 'hero'):
        v = entry.get(k)
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, dict) and isinstance(v.get('t'), (int, float)):
            return float(v['t'])
    beats = entry.get('beats')
    if isinstance(beats, dict) and beats:
        for k in ('main', 'main_beat', 'hero'):
            if k in beats:
                v = beats[k]
                return float(v['t'] if isinstance(v, dict) else v)
        v = list(beats.values())[0]
        return float(v['t'] if isinstance(v, dict) else v)
    if isinstance(beats, list) and beats:
        for b in beats:
            if isinstance(b, dict) and (b.get('main') or b.get('name') in ('main', 'hero')):
                return float(b.get('t', default))
        b = beats[len(beats) // 2]
        if isinstance(b, dict):
            return float(b.get('t', b.get('time', default)))
        if isinstance(b, (int, float)):
            return float(b)
    return default


def read_manifest(d, rid):
    p = os.path.join(d, 'manifest.json')
    if not os.path.exists(p):
        return {}
    try:
        m = json.load(open(p))
    except Exception:
        return {}
    if isinstance(m, dict) and rid in m:
        return m[rid]
    if isinstance(m, dict) and isinstance(m.get('reels'), dict):
        return m['reels'].get(rid, {})
    if isinstance(m, list):
        for e in m:
            if isinstance(e, dict) and e.get('id') == rid:
                return e
    return {}


# ------------------------------------------------------------------------------------- dither
_CELL_B = None


def cell_bayer():
    global _CELL_B
    if _CELL_B is None:
        b = bayer_tile(H // CELL + 1, W // CELL + 1, 8)
        _CELL_B = np.repeat(np.repeat(b, CELL, 0), CELL, 1)[:H, :W]
    return _CELL_B


def band_scrim(frame, top, strength):
    """Ordered-dither darkening of the top or bottom band (no smooth gradient), in stepped strength."""
    if strength <= 0:
        return
    strength = math.floor(strength * 4 + 1e-6) / 4
    band = int(H * 0.30)
    yy = np.arange(band, dtype=np.float32)
    lvl = (1 - yy / band) if top else (yy / band)
    lvl = np.clip(lvl, 0, 1) ** 0.9 * 0.85 * strength
    rows = slice(0, band) if top else slice(H - band, H)
    frame[rows] = dither_darken(frame[rows], np.broadcast_to(lvl[:, None], (band, W)), 3)


def endcard_bg(still, te):
    """Three-level ordered-dither darken plus a slowly closing pixel vignette."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # radius in cells, so the vignette edge steps in whole cells
    cy, cx = (yy // CELL) * CELL, (xx // CELL) * CELL
    r2 = ((cx - W / 2) / (W * 0.62)) ** 2 + ((cy - H * 0.46) / (H * 0.55)) ** 2
    a = min(1.0, te / 0.5) * 1.05
    b = 0.45 + 0.9 * min(1.0, te / END_DUR)
    v = a + b * r2
    lv = np.clip(np.floor(v + cell_bayer() - 0.5 + 0.5), 0, 2).astype(np.uint8)
    lv = np.where(v < 0.02, 0, lv)
    f = still.astype(np.uint16)
    out = still.copy()
    l1 = lv == 1
    l2 = lv >= 2
    out[l1] = (f[l1] * 7 // 16).astype(np.uint8)
    navy = np.array([5, 9, 18], np.uint16)
    out[l2] = ((f[l2] * 3 // 16) + navy).astype(np.uint8)
    return out


# ------------------------------------------------------------------------------------- titles
def _two_lines(text):
    """Split a hook into two balanced lines at a space."""
    words = text.split(' ')
    if len(words) < 2:
        return [text]
    best = min(range(1, len(words)), key=lambda k: abs(text_width(' '.join(words[:k])) - text_width(' '.join(words[k:]))))
    return [' '.join(words[:best]), ' '.join(words[best:])]


def _two_lines_text(text):
    return '\n'.join(_two_lines(text))


def build(rid, total_hint=None, beat_hint=None, footage=18.0):
    cfg = REELS[rid]
    E = min(footage, MAX_FOOTAGE)
    total = E + END_DUR
    beat = beat_hint if beat_hint is not None else cfg['beat']
    beat = max(3.3, min(beat, E - 5.3))
    items = []           # (block, cx, cy, anchor)
    voices = []          # (block, voice)
    sfx = []             # (time, clip name)

    # hook (top band): two lines at 7x if it fits, else 6x
    hs = 7 if max(text_width(l) for l in _two_lines(cfg['hook'])) * 7 <= 1000 else 6
    hook = TextBlock(_two_lines_text(cfg['hook']), STYLES['caption'], scale=hs, t_in=0.25, type_rate=0.055,
                     t_out=2.65, out_dur=0.3, keywords={cfg['hook_kw']: STYLES['ember']},
                     sparkle_words=(cfg['hook_kw'],), sparkle_rate=4.0, seed=11)
    items.append((hook, W // 2, 300, 'center'))
    voices.append((hook, 'narrator'))

    # name card (bottom band): star tag, name, optional subtitle, the fact typed
    name_s = min(8, fit_scale(cfg['name'], 1000, 8, 5))
    t_out = min(beat + 4.9, E - 0.35)
    tag = TextBlock('\x02 FIELD GUIDE \x02', STYLES['small'], scale=3, mode='drop', t_in=beat - 0.15, drop_h=4,
                    drop_dur=0.25, stagger=0.012, wave=None, icons={'\x02': SMALL_STAR},
                    t_out=t_out, out_dur=0.35)
    name = TextBlock(cfg['name'], STYLES['name'], scale=name_s, mode='drop', t_in=beat, drop_h=22,
                     drop_dur=0.55, stagger=0.045, t_out=t_out, out_dur=0.35,
                     sparkle_words=tuple(w for w in cfg['name'].split()), sparkle_rate=2.2, seed=21)
    sub = None
    if cfg.get('sub'):
        sub = TextBlock(cfg['sub'], STYLES['small'], scale=4, mode='drop', t_in=beat + 0.45, drop_h=5,
                        drop_dur=0.3, stagger=0.018, wave=None, t_out=t_out, out_dur=0.35)
    fact = TextBlock(cfg['fact'], STYLES['caption'], scale=5, max_w=1000, t_in=beat + 1.05, type_rate=0.05,
                     t_out=t_out, out_dur=0.35, wave=(1, 0.6, 0.5))
    bottom = 1810
    stack = [(tag, 4), (name, 8 if sub else 16), (sub, 16), (fact, 0)]
    stack = [(b, g) for b, g in stack if b is not None]
    y = bottom - sum(b.h * b.scale + g for b, g in stack)
    for b, g in stack:
        items.append((b, W // 2, y, 'top'))
        y += b.h * b.scale + g
    voices.append((fact, 'guide'))
    sfx += [(beat - 0.3, 'whoosh'), (name.t_land, 'chime')]
    card_span = (beat - 0.3, t_out + 0.35)

    # end card
    logo1 = TextBlock('PROJECT', STYLES['gold'], scale=8, mode='drop', t_in=E + 0.1, drop_h=20, drop_dur=0.6,
                      stagger=0.05, seed=31, wave=(1, 0.5, 0.5))
    zs = fit_scale('ZEALANDIA', 900, 11, 7)
    logo2 = TextBlock('ZEALANDIA', STYLES['gold'], scale=zs, mode='drop', t_in=E + 0.28, drop_h=22, drop_dur=0.65,
                      stagger=0.055, sparkle_words=('ZEALANDIA',), sparkle_rate=6.0, seed=32, wave=(1, 0.5, 0.45))
    tagline = TextBlock('A WILDLIFE PHOTOGRAPHY ADVENTURE', STYLES['small'], scale=3, mode='drop',
                        t_in=E + 0.85, drop_h=5, drop_dur=0.3, stagger=0.012, wave=None)
    cta1 = TextBlock("COMMENT 'PLAY'\nFOR THE GAME LINK", STYLES['caption'], scale=6, t_in=E + 0.8,
                     type_rate=0.034, keywords={'PLAY': STYLES['ember']}, sparkle_words=('PLAY',),
                     sparkle_rate=5.0, seed=41, wave=(1, 0.6, 0.5))
    badge = TextBlock('\x01', STYLES['caption'], scale=6, mode='drop', t_in=cta1.t_done + 0.05, drop_h=10,
                      drop_dur=0.45, icons={'\x01': CHAT_PAD}, wave=(2, 0.9, 0.0))
    cta2 = TextBlock('PLAYTEST ON DISCORD,\nLINK IN BIO', STYLES['caption'], scale=5,
                     t_in=cta1.t_done + 0.15, type_rate=0.034,
                     keywords={'DISCORD': STYLES['name']}, sparkle_words=('DISCORD',), sparkle_rate=3.0,
                     seed=42, wave=(1, 0.6, 0.5))
    items += [(logo1, W // 2, 540, 'center'), (logo2, W // 2, 685, 'center'), (tagline, W // 2, 815, 'center'),
              (cta1, W // 2, 925, 'top'), (badge, W // 2, 1225, 'center'), (cta2, W // 2, 1320, 'top')]
    voices += [(cta1, 'host'), (cta2, 'host')]
    sfx += [(E - 0.25, 'whoosh_down'), (logo2.t_land, 'bass'), (logo2.t_done - 0.1, 'chime')]
    return dict(E=E, total=total, beat=beat, items=items, voices=voices, sfx=sfx, hook=hook,
                card_span=card_span, cfg=cfg)


# --------------------------------------------------------------------------------------- audio
def render_audio(rid, plan, out_wav, log_lines):
    total = plan['total']
    n = int(total * A.SR)
    voice = np.zeros(n)
    spans = []
    for blk, vname in plan['voices']:
        v, blog = A.babble(blk.events, vname, total)
        voice += v
        spoken = [e for e in blk.events if e['ch'].isalnum()]
        if spoken:
            spans.append((spoken[0]['t'] - 0.05, spoken[-1]['t'] + 0.15))
        log_lines.append('# block "' + blk.text.replace(chr(10), ' / ') + f'" voice={vname}')
        log_lines.append('#   t(s)    frame  sample   char  semis  Hz      onset_err_ms')
        for (t, s0, c, semi, f0) in blog:
            frame = int(round(t * FPS))
            # measure the onset in the rendered stem
            # (look back only 2 ms: a blip always ends >= 2.6 ms before the next one starts)
            seg = np.abs(voice[max(0, s0 - 90):s0 + 400])
            hit = np.nonzero(seg > 0.02)[0]
            onset = (max(0, s0 - 90) + hit[0]) if len(hit) else -1
            err = (onset - s0) / A.SR * 1000 if onset >= 0 else float('nan')
            vis_t = frame / FPS
            log_lines.append(f'  {t:7.3f}  {frame:5d}  {s0:7d}  {c!r:5}  {semi:+4d}  {f0:7.1f}  {err:+6.1f}'
                             f'{"" if abs(vis_t - t) < 1e-6 else "  (visual " + f"{vis_t:.3f})"}')
    cfg = plan['cfg']
    mus = A.music(cfg['music'], total, rms=0.19, offset=cfg.get('music_offset', 0.0))
    # the sfx also duck the music a little
    for t, name in plan['sfx']:
        spans.append((t, t + 0.35))
    mix = mus * A.duck_curve(n, spans, depth=0.5) + voice * 0.62
    clips = {'whoosh': A.whoosh(0.7, True), 'whoosh_down': A.whoosh(0.6, False), 'chime': A.chime(),
             'bass': A.bass_hit()}
    gains = {'whoosh': 0.8, 'whoosh_down': 0.7, 'chime': 0.75, 'bass': 1.0}
    for t, name in plan['sfx']:
        A.place(mix, clips[name], t, gains[name])
        log_lines.append(f'# sfx {name:12s} at {t:7.3f}s  frame {int(round(t * FPS))}')
    A.write_wav(out_wav, A.master(mix))
    A.write_wav(out_wav.replace('.wav', '_voice.wav'), np.clip(voice, -1, 1), stereo=False)


# --------------------------------------------------------------------------------------- video
def render(rid, placeholder=False, frames_only=None, out_dir=None):
    d = raw_dir(placeholder)
    src = os.path.join(d, f'{rid}.mp4')
    if not os.path.exists(src):
        raise SystemExit(f'missing footage: {src}')
    out_dir = out_dir or os.path.join(PROMO, 'out')
    os.makedirs(out_dir, exist_ok=True)
    man = read_manifest(d, rid)
    footage = probe_duration(src)
    if isinstance(man.get('duration'), (int, float)):
        footage = min(footage, float(man['duration']))
    plan = build(rid, beat_hint=main_beat(man, REELS[rid]['beat']), footage=footage)
    E, total = plan['E'], plan['total']
    nfr = int(round(total * FPS))
    log = [f'reel {rid}: footage {footage:.2f}s, end card at {E:.2f}s, total {total:.2f}s ({nfr} frames), '
           f'name-card beat {plan["beat"]:.2f}s',
           'bleep onsets are rendered at the exact frame time the letter first appears (reveals snap to 1/30 s);',
           'onset_err_ms is measured from the rendered voice stem.']
    wav = os.path.join(out_dir, f'reel_{rid}.wav')
    render_audio(rid, plan, wav, log)
    with open(os.path.join(out_dir, f'reel_{rid}_timing.txt'), 'w') as f:
        f.write('\n'.join(log) + '\n')

    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-vf',
                            f'scale={W}:{H}:flags=neighbor,fps={FPS}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL if frames_only is not None else None)
    out_mp4 = os.path.join(out_dir, f'reel_{rid}.mp4')
    enc = None
    if frames_only is None:
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                                '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', wav,
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-tune', 'animation',
                                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest',
                                '-movflags', '+faststart', out_mp4], stdin=subprocess.PIPE)
    fsz = W * H * 3
    last = None
    frozen = None
    saved = {}
    eframe = int(round(E * FPS))
    for i in range(nfr):
        t = i / FPS
        if i <= eframe:
            buf = dec.stdout.read(fsz) if dec.poll() is None or True else b''
            if len(buf) == fsz:
                last = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            if last is None:
                last = np.zeros((H, W, 3), np.uint8)
            frame = last.copy()
            if i == eframe:
                frozen = last.copy()
        if t >= E:
            frame = endcard_bg(frozen if frozen is not None else last, t - E)
        else:
            hook = plan['hook']
            if t < hook.t_out + hook.out_dur:
                st = min(1.0, t / 0.25) if t < hook.t_out else 1 - (t - hook.t_out) / hook.out_dur
                band_scrim(frame, True, st)
            a, b = plan['card_span']
            if a <= t < b:
                st = min(1.0, (t - a) / 0.25) if t < b - 0.35 else (b - t) / 0.35
                band_scrim(frame, False, st)
        for blk, cx, cy, anchor in plan['items']:
            blk.draw(frame, t, cx, cy, anchor)
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


def contact_sheet(mp4, out_png, n=8):
    dur = probe_duration(mp4)
    times = [dur * (k + 0.5) / n for k in range(n)]
    tiles = []
    from PIL import Image
    for t in times:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', mp4, '-frames:v', '1',
                              '-vf', 'scale=270:480:flags=neighbor', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                             capture_output=True).stdout
        tiles.append(np.frombuffer(raw, np.uint8).reshape(480, 270, 3))
    sheet = np.concatenate([np.concatenate(tiles[:4], 1), np.concatenate(tiles[4:], 1)], 0)
    Image.fromarray(sheet).save(out_png)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--id', choices=list(REELS))
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--placeholder', action='store_true', help='build and use still-pan placeholder footage')
    ap.add_argument('--out', default=None, help='output dir (default <scratch>/promo/out)')
    ap.add_argument('--sheet', action='store_true', help='also write an 8-frame contact sheet')
    ap.add_argument('--frames', default=None, help='only preview these times (s, comma separated) as PNGs')
    a = ap.parse_args()
    if a.placeholder:
        make_placeholders()
    ids = list(REELS) if a.all else ([a.id] if a.id else [])
    if not ids:
        ap.error('give --id or --all')
    if a.frames:
        from PIL import Image
        times = [float(x) for x in a.frames.split(',')]
        for rid in ids:
            fr = {int(round(t * FPS)): t for t in times}
            _, saved, plan = render(rid, a.placeholder, frames_only=set(fr), out_dir=a.out)
            for i, img in saved.items():
                p = os.path.join(PROMO, 'work', f'prev_{rid}_{fr[i]:05.2f}.png')
                os.makedirs(os.path.dirname(p), exist_ok=True)
                Image.fromarray(img).save(p)
                print('preview', p)
        return
    for rid in ids:
        mp4, _, plan = render(rid, a.placeholder, out_dir=a.out)
        print(f'wrote {mp4}  ({plan["total"]:.2f}s, beat {plan["beat"]:.2f}s)')
        if a.sheet:
            sp = mp4.replace('.mp4', '_sheet.png')
            contact_sheet(mp4, sp)
            print('  sheet', sp)


if __name__ == '__main__':
    main()
