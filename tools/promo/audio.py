#!/usr/bin/env python3
"""Synthesised audio for the Project Zealandia promo reels (all generated here; music is CC0).

  - babble(): Animal Crossing style "8-bit voice". One short pulse-wave blip per typed character,
    pitched per word and per syllable on a pentatonic scale, with a per-speaker timbre (base pitch,
    pulse duty, octave mix, glide). Spaces and punctuation are silent; a sentence's last word falls
    in pitch ('?' rises). Hissy consonants get a little LFSR noise.
  - whoosh(), chime(), bass_hit(): chiptune stingers.
  - music(): a CC0 track from src/assets/trailer/, faded in and out.
  - mix(): music ducked under the voice, plus voice and stingers, soft-limited.

CLI demo:  python3 tools/promo/audio.py --demo /path/demo.wav
"""
from __future__ import annotations

import math
import os
import subprocess
import wave
import zlib

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
MUSIC_DIR = os.path.join(REPO, 'src', 'assets', 'trailer')

VOWELS = set('AEIOUY')
PENTA = [0, 2, 4, 7, 9]


def _q(semi):
    """Snap a semitone offset to the major pentatonic, so the babble sounds sung, not random."""
    o, r = divmod(int(round(semi)), 12)
    best = min(PENTA + [12], key=lambda p: abs(p - r))
    return o * 12 + best


def _h(s):
    return zlib.crc32(s.encode('utf8'))


VOICES = {
    # base Hz, pulse duty, octave-up mix, blip length (s), downward glide, noise on hissy consonants
    'narrator': dict(base=246.9, duty=0.25, oct=0.30, length=0.052, glide=0.07, hiss=0.22, gain=0.50),
    'guide':    dict(base=329.6, duty=0.125, oct=0.22, length=0.046, glide=0.05, hiss=0.18, gain=0.46),
    'host':     dict(base=196.0, duty=0.33, oct=0.35, length=0.050, glide=0.09, hiss=0.20, gain=0.52),
}


def pulse(freq, n, duty, phase0=0.0):
    """freq may be an array (per sample). Returns (wave, end phase)."""
    f = np.broadcast_to(np.asarray(freq, np.float64), (n,))
    ph = phase0 + np.cumsum(f) / SR
    w = np.where((ph % 1.0) < duty, 1.0, -1.0)
    return w, ph[-1] if n else phase0


def lfsr_noise(n, period=1, short=False, seed=1):
    """NES-style noise: a 15-bit LFSR held for `period` samples (array or int)."""
    reg = seed & 0x7FFF or 1
    out = np.empty(n, np.float64)
    per = np.broadcast_to(np.asarray(period, np.float64), (n,))
    cnt = 0.0
    val = 1.0
    tap = 6 if short else 1
    for i in range(n):
        cnt -= 1
        if cnt <= 0:
            fb = (reg ^ (reg >> tap)) & 1
            reg = (reg >> 1) | (fb << 14)
            val = 1.0 if reg & 1 else -1.0
            cnt += max(1.0, per[i])
        out[i] = val
    return out


def _env(n, attack=0.003, release_frac=0.45):
    e = np.ones(n)
    a = max(1, int(attack * SR))
    e[:a] = np.linspace(0, 1, a)
    r = max(1, int(n * release_frac))
    e[-r:] *= np.linspace(1, 0, r) ** 1.6
    return e


# ------------------------------------------------------------------------------------ the voice
def plan_pitches(events, voice='narrator'):
    """Semitone offset per spoken event (None for silent characters)."""
    chars = [e['ch'] for e in events]
    words = {}
    for i, e in enumerate(events):
        if e['ch'].isalnum():
            words.setdefault(e['word'], []).append(i)
    # sentence ends: the word right before . ! ? gets the fall (or the rise)
    tail = {}
    for i, c in enumerate(chars):
        if c in '.!?':
            j = i - 1
            while j >= 0 and not chars[j].isalnum():
                j -= 1
            if j >= 0:
                tail[events[j]['word']] = c
    out = [None] * len(events)
    vh = _h(voice)
    for wi, idxs in words.items():
        word = ''.join(chars[i] for i in idxs).upper()
        base = [-3, 0, 2, 4, 0, 7, -1][(_h(word) ^ vh) % 7]
        syl = 0
        prev_v = False
        for k, i in enumerate(idxs):
            c = chars[i].upper()
            v = c in VOWELS
            if v and not prev_v and k > 0:
                syl += 1
            prev_v = v
            contour = [0, 2, -2, 3, 1, -1][syl % 6]
            jitter = ((ord(c) * 7) % 5 - 2) * 0.6 if not v else 0
            semi = base + contour + jitter
            end = tail.get(wi)
            if end in ('.', '!'):
                semi -= 2 + 5 * (k + 1) / len(idxs)
            elif end == '?':
                semi += 1 + 6 * (k + 1) / len(idxs)
            out[i] = _q(semi)
    return out


def babble(events, voice='narrator', total=None):
    """Render the bleep track for typed-character events [{'t','ch','word'}, ...]."""
    V = VOICES[voice]
    end_t = (max(e['t'] for e in events) + 0.3) if events else 0.0
    n_total = int(SR * (total if total is not None else end_t))
    out = np.zeros(n_total)
    pitches = plan_pitches(events, voice)
    times = [e['t'] for e in events]
    log = []
    for i, e in enumerate(events):
        semi = pitches[i]
        if semi is None:
            continue
        c = e['ch'].upper()
        nxt = times[i + 1] if i + 1 < len(times) else e['t'] + 1
        dur = min(V['length'] * (1.25 if c in VOWELS else 1.0), max(0.02, (nxt - e['t']) * 0.92))
        n = int(dur * SR)
        s0 = int(round(e['t'] * SR))
        if s0 >= n_total:
            continue
        f0 = V['base'] * 2 ** (semi / 12)
        fr = f0 * (1.03 - V['glide'] * np.linspace(0, 1, n))
        w, _ = pulse(fr, n, V['duty'])
        w2, _ = pulse(fr * 2, n, 0.5)
        sig = (w * (1 - V['oct']) + w2 * V['oct'])
        if c in 'SZXCJ' or (c in 'TKP' and V['hiss']):
            nz = lfsr_noise(n, period=2 if c in 'SZXCJ' else 5, seed=_h(c) & 0x7FFF)
            ne = np.exp(-np.linspace(0, 6 if c in 'TKP' else 3, n))
            sig = sig + nz * ne * V['hiss'] * 2.2
        sig *= _env(n) * V['gain']
        s1 = min(n_total, s0 + n)
        out[s0:s1] += sig[:s1 - s0]
        log.append((e['t'], s0, c, semi, round(f0, 1)))
    return out, log


# ----------------------------------------------------------------------------------- stingers
def whoosh(dur=0.7, up=True):
    n = int(dur * SR)
    x = np.linspace(0, 1, n)
    shape = np.sin(np.pi * x) ** 2
    period = 26 - 22 * np.sin(np.pi * x) if up else 4 + 22 * x
    nz = lfsr_noise(n, period=period, seed=0x1234)
    f = 180 * 2 ** (3.5 * np.sin(np.pi * x * 0.5)) if up else 900 * 2 ** (-3 * x)
    sq, _ = pulse(f, n, 0.125)
    return (nz * 0.55 + sq * 0.18) * shape * 0.55


def chime(notes=(1318.5, 1661.2, 1975.5, 2637.0, 3322.4), step=0.055, echo=0.11):
    n = int((step * len(notes) + 0.5 + echo * 3) * SR)
    out = np.zeros(n)
    for k, f in enumerate(notes):
        m = int(0.28 * SR)
        w, _ = pulse(np.full(m, f), m, 0.125)
        tri = 2 * np.abs(2 * ((np.arange(m) * f * 2 / SR) % 1) - 1) - 1
        e = np.exp(-np.linspace(0, 7, m))
        sig = (w * 0.6 + tri * 0.4) * e * 0.33
        for r, g in enumerate((1.0, 0.42, 0.18, 0.07)):
            s0 = int((k * step + r * echo) * SR)
            out[s0:s0 + m] += sig[:max(0, min(m, n - s0))] * g
    return out


def bass_hit(dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 45 + 125 * np.exp(-t / 0.06)
    ph = np.cumsum(f) / SR
    tri = 2 * np.abs(2 * (ph % 1) - 1) - 1
    tri = np.round(tri * 7.5) / 7.5                    # 4-bit triangle, NES style
    body = tri * np.exp(-t / 0.55)
    snap = lfsr_noise(int(0.14 * SR), period=1, seed=77) * np.exp(-np.linspace(0, 9, int(0.14 * SR)))
    crash_n = int(1.1 * SR)
    crash = lfsr_noise(crash_n, period=1, short=False, seed=99) * np.exp(-np.linspace(0, 5, crash_n)) * 0.22
    # a low chord stab: root, fifth, octave
    stab = np.zeros(n)
    for fr, g in ((87.3, 0.5), (130.8, 0.32), (174.6, 0.25)):
        w, _ = pulse(np.full(n, fr), n, 0.5)
        stab += w * g
    stab *= np.exp(-t / 0.35) * 0.22
    out = body * 0.95 + stab
    out[:len(snap)] += snap * 0.55
    out[:crash_n] += crash
    return out * 0.8


def music(name, total, rms=0.2, fade_in=0.6, fade_out=1.4, offset=0.0):
    path = os.path.join(MUSIC_DIR, name)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(offset), '-i', path, '-t', str(total + 0.1),
                          '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    n = int(total * SR)
    if len(x) < n:
        x = np.concatenate([x, np.zeros(n - len(x))])
    x = x[:n].copy()
    x = x * (rms / (np.sqrt(np.mean(x ** 2)) or 1.0))      # match loudness, not peaks
    fi, fo = int(fade_in * SR), int(fade_out * SR)
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo) ** 1.5
    return x


def duck_curve(n, spans, depth=0.5, attack=0.06, release=0.3):
    """Gain curve: 1 normally, (1-depth) inside spans [(t0, t1)], one-pole attack/release."""
    target = np.ones(n)
    for a, b in spans:
        target[max(0, int(a * SR)):min(n, int(b * SR))] = 1 - depth
    # one-pole smoothing, run at a decimated rate for speed
    hop = 64
    tt = target[::hop]
    g = np.empty_like(tt)
    cur = 1.0
    ka = 1 - math.exp(-hop / (attack * SR))
    kr = 1 - math.exp(-hop / (release * SR))
    for i, v in enumerate(tt):
        cur += (v - cur) * (ka if v < cur else kr)
        g[i] = cur
    return np.repeat(g, hop)[:n]


def place(track, clip, t, gain=1.0):
    s0 = int(round(t * SR))
    if s0 >= len(track):
        return
    m = min(len(clip), len(track) - s0)
    track[s0:s0 + m] += clip[:m] * gain


def master(x, ceiling=0.89):
    y = np.tanh(x * 1.1) / math.tanh(1.1)
    pk = np.max(np.abs(y)) or 1.0
    return y * min(1.0, ceiling / pk) if pk > ceiling else y


def write_wav(path, x, stereo=True):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    if stereo:
        pcm = np.repeat(pcm[:, None], 2, axis=1).ravel()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--demo', required=True)
    a = ap.parse_args()
    from textfx import TextBlock, STYLES
    tb = TextBlock('SOMETHING IS CIRCLING...', STYLES['caption'], 6, t_in=0.3)
    tb2 = TextBlock('Knock its snout and it veers off.', STYLES['caption'], 5, t_in=2.6, type_rate=0.05)
    total = 6.0
    v1, _ = babble(tb.events, 'narrator', total)
    v2, _ = babble(tb2.events, 'guide', total)
    voice = v1 + v2
    mus = music('next-to-you.mp3', total)
    spans = [(tb.events[0]['t'], tb.t_done + 0.1), (tb2.events[0]['t'], tb2.t_done + 0.1)]
    mix = mus * duck_curve(len(mus), spans) + voice * 0.62
    place(mix, whoosh(), 2.2)
    place(mix, chime(), 2.5)
    place(mix, bass_hit(), 4.6)
    write_wav(a.demo, master(mix))
    print('wrote', a.demo)
