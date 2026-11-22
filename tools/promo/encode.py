#!/usr/bin/env python3
"""Turn a capture (frames + track.json from capture.cjs) into the reel files.

  python3 tools/promo/encode.py <id> [--work DIR] [--out DIR] [--stills t1,t2,t3]

Writes into --out (the promo raw folder):
  <id>.mp4        9:16, 1080x1920, 30 fps, H.264, no audio: a 360x640 crop of the 1280x720 frame that
                  follows the subject (track.json, smoothed both ways in time), scaled x3 nearest-neighbour
  <id>_wide.mp4   the whole 1280x720 frame
  <id>_still_N.png  1280x720 frames at the given times (seconds)
  manifest.json   merged: duration, frames, fps, beats {name: seconds}, stills
Crop settings come from shots.cjs (`crop: { scale, ease, yFrac }`).
"""
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('id')
ap.add_argument('--work', default=None)
ap.add_argument('--out', required=True)
ap.add_argument('--stills', default='')
a = ap.parse_args()
work = a.work or os.path.join(os.environ.get('PROMO_WORK', '/tmp/promo-work'), a.id)
os.makedirs(a.out, exist_ok=True)
cfg = json.loads(subprocess.check_output(['node', '-e', f"const s=require({json.dumps(os.path.join(HERE, 'shots.cjs'))})[{json.dumps(a.id)}]; console.log(JSON.stringify(s.crop||{{}}))"]))
tr = json.load(open(os.path.join(work, 'track.json')))
W, H, fps, n = tr['w'], tr['h'], tr['fps'], tr['frames']
scale = int(cfg.get('scale', 3))
CW, CH = 1080 // scale, 1920 // scale            # 360 x 640 device px
yfrac = float(cfg.get('yFrac', 0.5))             # where the subject sits in the crop, top..bottom

# ---------------------------------------------------------------- the crop path
pos = tr['pos']
xs = np.array([p[0] if p else np.nan for p in pos], float)
ys = np.array([p[1] if p else np.nan for p in pos], float)
for v in (xs, ys):
    ok = ~np.isnan(v)
    if not ok.any(): v[:] = W / 2 if v is xs else H / 2
    else: v[~ok] = np.interp(np.flatnonzero(~ok), np.flatnonzero(ok), v[ok])

def smooth(v, sigma):
    """zero-phase gaussian smoothing, with hard cuts (jumps > 300 px) kept as cuts"""
    if sigma <= 0: return v.copy()
    out = np.empty_like(v)
    cuts = [0] + [i for i in range(1, len(v)) if abs(v[i] - v[i - 1]) > 300] + [len(v)]
    r = int(sigma * 3)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
    for s, e in zip(cuts[:-1], cuts[1:]):
        seg = np.pad(v[s:e], r, mode='edge')
        out[s:e] = np.convolve(seg, k, mode='valid')
    return out

sig = float(cfg.get('ease', 0.6)) * fps
cx = smooth(xs, sig); cy = smooth(ys, sig * 1.3)
x0 = np.clip(np.round(cx - CW / 2), 0, W - CW).astype(int)
y0 = np.clip(np.round(cy - CH * yfrac), 0, H - CH).astype(int)

# ---------------------------------------------------------------- frames
def frame(i):
    return Image.open(os.path.join(work, f'f{i:05d}.png')).convert('RGB')

missing = [i for i in range(n) if not os.path.exists(os.path.join(work, f'f{i:05d}.png'))]
if missing:
    sys.exit(f'{len(missing)} frames missing (a --every preview?): first {missing[:5]}')

def enc(path, size):
    return subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{size[0]}x{size[1]}', '-r', str(fps), '-i', '-',
                             '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', str(fps), '-movflags', '+faststart', path], stdin=subprocess.PIPE)

tall = enc(os.path.join(a.out, f'{a.id}.mp4'), (1080, 1920))
wide = enc(os.path.join(a.out, f'{a.id}_wide.mp4'), (W, H))
for i in range(n):
    im = frame(i)
    wide.stdin.write(im.tobytes())
    c = im.crop((int(x0[i]), int(y0[i]), int(x0[i]) + CW, int(y0[i]) + CH)).resize((1080, 1920), Image.NEAREST)
    tall.stdin.write(c.tobytes())
for p in (tall, wide):
    p.stdin.close(); p.wait()

# ---------------------------------------------------------------- stills
stills = [float(t) for t in a.stills.split(',') if t.strip()]
for k, t in enumerate(stills, 1):
    i = min(n - 1, max(0, round(t * fps)))
    frame(i).save(os.path.join(a.out, f'{a.id}_still_{k}.png'))

# ---------------------------------------------------------------- manifest
mp = os.path.join(a.out, 'manifest.json')
man = json.load(open(mp)) if os.path.exists(mp) else {}
beats, seen = {}, {}
for b in tr['beats']:
    nm = b['name']; seen[nm] = seen.get(nm, 0) + 1
    beats[nm if seen[nm] == 1 else f'{nm}_{seen[nm]}'] = b['t']
man[a.id] = {
    'file': f'{a.id}.mp4', 'wide': f'{a.id}_wide.mp4', 'w': 1080, 'h': 1920, 'fps': fps, 'frames': n,
    'duration': round(n / fps, 3), 'beats': beats,
    'stills': {f'{a.id}_still_{k}.png': t for k, t in enumerate(stills, 1)},
    'crop': {'src': [W, H], 'box': [CW, CH], 'scale': scale},
}
for k in ('notes',):
    if k in cfg: man[a.id][k] = cfg[k]
json.dump(man, open(mp, 'w'), indent=1)
print('wrote', a.id, n, 'frames', beats)
