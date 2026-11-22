#!/usr/bin/env python3
"""Documentary sound for the Project Zealandia promo films: CC0 music plus a synthesised ambience bed.

Nothing here is 8-bit. The beds are built from FFT-shaped noise, slow random swells and simple
synthesised calls, all deterministic from a seed:
  underwater()  low filtered rumble, slow water movement, bubble trains from a diver's exhale
  night()       soft night air, a few crickets (filtered chirp pulses) over a distant chorus, a far ruru
  forest()      wind in gusts, leaf rustle that follows the gusts, bellbird phrases, fantail chips,
                a grey-warbler trill
  beach()       surf: each wave swells, breaks and washes back (noise swells), a little wind, distant piping
Music: a CC0 track from src/assets/trailer/ (see CREDITS.md), loudness-matched with long fades.

CLI demo:  python3 tools/promo/audio.py --demo night --out /path/demo.wav --seconds 20
"""
from __future__ import annotations

import math
import os
import subprocess
import wave

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
MUSIC_DIR = os.path.join(REPO, 'src', 'assets', 'trailer')


# ------------------------------------------------------------------------------------ building blocks
def shaped_noise(n, lo, hi, seed, tilt=0.0, order=4):
    """White noise band-limited in the frequency domain (soft 'order' skirts), unit RMS."""
    rng = np.random.default_rng(seed)
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    fs = np.maximum(f, 1.0)
    g = 1 / (1 + (lo / fs) ** order) / (1 + (fs / hi) ** order)
    if tilt:
        g = g * (fs / 1000.0) ** tilt
    y = np.fft.irfft(X * g, n)
    return y / (np.std(y) + 1e-12)


def lowpass(x, hi, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (np.maximum(f, 1) / hi) ** order), len(x))


def lfo(n, rate, seed, lo=0.0, hi=1.0):
    """A smooth random curve (cosine-interpolated random points `rate` per second) in [lo, hi]."""
    rng = np.random.default_rng(seed)
    k = max(2, int(n / SR * rate) + 3)
    pts = rng.random(k)
    t = np.arange(n) / SR * rate
    i = np.floor(t).astype(int)
    u = t - i
    u = (1 - np.cos(np.pi * u)) / 2
    v = pts[i] * (1 - u) + pts[np.minimum(i + 1, k - 1)] * u
    return lo + (hi - lo) * v


def env_ad(n, attack, decay_tau):
    t = np.arange(n) / SR
    e = np.exp(-t / decay_tau)
    a = max(1, int(attack * SR))
    e[:a] *= np.linspace(0, 1, a)
    return e


def tone(freqs, amp_env, harmonics=((1, 1.0),), phase=0.0):
    """freqs: per-sample Hz array. harmonics: (multiple, gain)."""
    ph = 2 * np.pi * np.cumsum(freqs) / SR + phase
    y = np.zeros_like(freqs)
    for m, g in harmonics:
        y += np.sin(ph * m) * g
    return y * amp_env


def add(track, clip, t, gain=1.0, pan=0.0):
    """Add a mono clip into a stereo track at time t (s) with an equal-power pan in [-1, 1]."""
    s0 = int(round(t * SR))
    if s0 >= len(track) or s0 + len(clip) <= 0:
        return
    a, b = max(0, s0), min(len(track), s0 + len(clip))
    c = clip[a - s0:b - s0] * gain
    th = (pan + 1) * math.pi / 4
    track[a:b, 0] += c * math.cos(th)
    track[a:b, 1] += c * math.sin(th)


def stereo(x, width=0.0, seed=0):
    """Mono bed -> stereo, optionally decorrelated a little by a slow pan drift."""
    if width <= 0:
        return np.stack([x, x], 1) * math.sqrt(0.5)
    p = lfo(len(x), 0.05, seed, -width, width)
    th = (p + 1) * math.pi / 4
    return np.stack([x * np.cos(th), x * np.sin(th)], 1)


# ----------------------------------------------------------------------------------------- beds
def underwater(total, seed=1):
    n = int(total * SR)
    rumble = shaped_noise(n, 18, 150, seed) * lfo(n, 0.08, seed + 1, 0.55, 1.0)
    move = shaped_noise(n, 220, 900, seed + 2, tilt=-0.5) * lfo(n, 0.15, seed + 3, 0.1, 0.45)
    bed = stereo(rumble * 0.5 + move * 0.16, 0.25, seed)
    rng = np.random.default_rng(seed + 10)
    bub = np.zeros((n, 2))

    def bubble(f0):
        d = rng.uniform(0.025, 0.07)
        m = int(d * SR)
        fr = f0 * (1 + 0.7 * (np.arange(m) / m) ** 1.5)
        return tone(fr, env_ad(m, 0.002, d / 3), ((1, 1.0), (2, 0.12)))

    t = rng.uniform(1.0, 3.0)
    while t < total - 1:                      # the diver's exhale: a rising train of bubbles
        k = rng.integers(10, 26)
        pan = rng.uniform(-0.3, 0.3)
        for j in range(k):
            add(bub, bubble(rng.uniform(380, 1300) * (1 + j / k * 0.4)), t + j * rng.uniform(0.02, 0.06),
                rng.uniform(0.25, 0.6) * (1 - j / k * 0.5), pan + rng.uniform(-0.15, 0.15))
        t += rng.uniform(3.8, 5.6)
    t = 0.5
    while t < total - 0.5:                    # stray bubbles from the reef
        add(bub, bubble(rng.uniform(600, 2200)), t, rng.uniform(0.05, 0.2), rng.uniform(-0.8, 0.8))
        t += rng.exponential(1.3)
    bub[:, 0] = lowpass(bub[:, 0], 2600)
    bub[:, 1] = lowpass(bub[:, 1], 2600)
    return bed + bub * 0.55


def night(total, seed=2):
    n = int(total * SR)
    air = shaped_noise(n, 60, 1400, seed, tilt=-0.6) * lfo(n, 0.1, seed + 1, 0.35, 0.8) * 0.18
    chorus = shaped_noise(n, 5600, 7400, seed + 2) * (0.5 + 0.5 * np.sign(np.sin(
        2 * np.pi * np.cumsum(lfo(n, 0.5, seed + 3, 34, 46)) / SR))) * lfo(n, 0.2, seed + 4, 0.3, 0.8) * 0.035
    out = stereo(air, 0.3, seed) + stereo(chorus, 0.6, seed + 5)
    rng = np.random.default_rng(seed + 20)
    for c in range(4):                        # a few crickets near and far, each its own song
        f = rng.uniform(4100, 5400)
        pulses = rng.integers(3, 5)
        period = rng.uniform(0.55, 0.95)
        gain = rng.uniform(0.05, 0.13) * (1.0 if c < 2 else 0.5)
        pan = rng.uniform(-0.8, 0.8)
        t = rng.uniform(0, period)
        while t < total - 0.3:
            for p in range(pulses):
                m = int(0.013 * SR)
                fr = f * (1 + 0.01 * np.sin(np.arange(m) / m * np.pi))
                add(out, tone(fr, np.sin(np.linspace(0, np.pi, m)) ** 2, ((1, 1.0), (2, 0.15))),
                    t + p * 0.024, gain, pan)
            t += period * rng.uniform(0.92, 1.08)
            if rng.random() < 0.06:
                t += rng.uniform(1.0, 3.0)    # a cricket pauses
    # a far ruru (morepork): two soft hooting notes, twice in the film
    for tt in (total * 0.27, total * 0.63):
        for k, (f, d) in enumerate(((690, 0.28), (530, 0.36))):
            m = int(d * SR)
            fr = np.full(m, f) * (1 - 0.05 * np.arange(m) / m)
            e = np.sin(np.linspace(0, np.pi, m)) ** 0.8
            hoot = tone(fr, e, ((1, 1.0), (2, 0.25), (3, 0.06)))
            add(out, lowpass(hoot, 1500), tt + k * 0.42, 0.10, -0.5)
    return out


def forest(total, seed=3):
    n = int(total * SR)
    gust = lfo(n, 0.07, seed, 0.2, 1.0) ** 1.5
    wind = shaped_noise(n, 140, 900, seed + 1, tilt=-0.3) * (0.25 + 0.75 * gust) * 0.32
    leaves = shaped_noise(n, 1800, 7000, seed + 2) * gust ** 2 * lfo(n, 2.0, seed + 3, 0.6, 1.0) * 0.07
    out = stereo(wind, 0.3, seed) + stereo(leaves, 0.7, seed + 4)
    rng = np.random.default_rng(seed + 30)
    t = rng.uniform(1, 4)
    while t < total - 2:                      # bellbird: liquid bell notes in short phrases
        base = rng.uniform(1300, 2100)
        notes = rng.integers(3, 6)
        pan = rng.uniform(-0.7, 0.7)
        g = rng.uniform(0.05, 0.11)
        for k in range(notes):
            f = base * rng.choice([1.0, 1.122, 1.26, 1.335, 1.5])
            m = int(0.45 * SR)
            fr = np.full(m, f) * (1 + 0.015 * np.exp(-np.arange(m) / (0.02 * SR)))
            add(out, tone(fr, env_ad(m, 0.004, 0.14), ((1, 1.0), (2.76, 0.08))), t + k * rng.uniform(0.16, 0.24),
                g, pan)
        t += rng.uniform(5.5, 9.5)
    t = rng.uniform(3, 6)
    while t < total - 2:                      # fantail: quick high 'cheet' chips
        pan = rng.uniform(-0.8, 0.8)
        for k in range(rng.integers(4, 9)):
            m = int(0.045 * SR)
            fr = np.linspace(rng.uniform(6500, 7500), rng.uniform(4800, 5600), m)
            add(out, tone(fr, np.sin(np.linspace(0, np.pi, m)) ** 1.5), t + k * rng.uniform(0.09, 0.14),
                0.035, pan)
        t += rng.uniform(7, 12)
    t = rng.uniform(8, 14)
    while t < total - 3:                      # grey warbler: a falling, wavering trill
        pan = rng.uniform(-0.6, 0.6)
        for k in range(12):
            m = int(0.05 * SR)
            f = 3900 - k * 85 + rng.uniform(-60, 60)
            add(out, tone(np.full(m, f) * (1 + 0.04 * np.sin(np.arange(m) / SR * 2 * np.pi * 40)),
                          np.sin(np.linspace(0, np.pi, m))), t + k * 0.065, 0.03, pan)
        t += rng.uniform(14, 22)
    return out


def beach(total, seed=4, wave_times=None):
    n = int(total * SR)
    rng = np.random.default_rng(seed)
    low = shaped_noise(n, 40, 500, seed + 1)
    mid = shaped_noise(n, 300, 2200, seed + 2)
    hiss = shaped_noise(n, 1800, 9000, seed + 3, tilt=-0.4)
    e_low = np.full(n, 0.25)
    e_mid = np.full(n, 0.08)
    e_hiss = np.full(n, 0.03)
    t = np.arange(n) / SR
    if wave_times is None:
        wave_times = []
        w = rng.uniform(1.5, 4.0)
        while w < total + 2:
            wave_times.append(w)
            w += rng.uniform(6.5, 9.5)
    for w in wave_times:                      # each wave: swell, break, wash, draw back
        size = rng.uniform(0.7, 1.0)
        rise = np.exp(-((t - w + 0.2) / 1.1) ** 2)
        brk = np.where(t >= w, np.exp(-(t - w) / 0.6), np.exp(-((t - w) / 0.12) ** 2))
        wash = np.where(t >= w, np.exp(-(t - w - 0.4).clip(0) / 2.6) * (1 - np.exp(-(t - w) / 0.3)), 0)
        back = np.where(t >= w + 2.2, np.exp(-(t - w - 2.2) / 1.6) * (1 - np.exp(-(t - w - 2.2) / 0.5)), 0)
        e_low += size * (0.45 * rise + 0.8 * brk + 0.25 * back)
        e_mid += size * (0.35 * brk + 0.25 * wash)
        e_hiss += size * (0.12 * brk + 0.3 * wash + 0.12 * back)
    surf = low * e_low * 0.22 + mid * e_mid * 0.3 + hiss * e_hiss * 0.35
    wind = shaped_noise(n, 200, 1200, seed + 4) * lfo(n, 0.1, seed + 5, 0.1, 0.4) * 0.08
    out = stereo(surf, 0.35, seed) + stereo(wind, 0.5, seed + 6)
    tt = rng.uniform(5, 9)
    while tt < total - 2:                     # distant piping from the wrack line
        pan = rng.uniform(-0.8, 0.8)
        for k in range(rng.integers(3, 7)):
            m = int(0.09 * SR)
            fr = np.linspace(3300, 2700, m) * rng.uniform(0.95, 1.05)
            add(out, lowpass(tone(fr, np.sin(np.linspace(0, np.pi, m)), ((1, 1.0), (2, 0.1))), 4000),
                tt + k * 0.17, 0.03, pan)
        tt += rng.uniform(9, 16)
    return out


BEDS = {'underwater': underwater, 'night': night, 'forest': forest, 'beach': beach}
# each bed sits this far under full scale (RMS): a few dB under the music, so it is felt more than heard
BED_DB = {'underwater': -26.0, 'night': -29.0, 'forest': -28.0, 'beach': -27.5}


# ------------------------------------------------------------------------------------------- music
def music_duration(name):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                        os.path.join(MUSIC_DIR, name)], capture_output=True, text=True)
    return float(r.stdout.strip())


def music(name, total, rms=0.1, fade_in=2.5, fade_out=3.5, offset=0.0):
    """Mono CC0 track, loudness-matched (RMS), faded; the offset is pulled back if the track would run out."""
    dur = music_duration(name)
    offset = max(0.0, min(offset, dur - total - 0.5))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(offset), '-i', os.path.join(MUSIC_DIR, name),
                          '-t', str(total + 0.1), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    n = int(total * SR)
    if len(x) < n:
        x = np.concatenate([x, np.zeros(n - len(x))])
    x = x[:n].copy()
    x *= rms / (np.sqrt(np.mean(x ** 2)) or 1.0)
    fi, fo = int(fade_in * SR), int(fade_out * SR)
    x[:fi] *= np.linspace(0, 1, fi) ** 2
    x[-fo:] *= np.linspace(1, 0, fo) ** 1.5
    return x, offset


def fade_curve(n, fade_in=1.5, fade_out=3.0, dips=()):
    """1 with raised-cosine fades; dips = [(t0, t1, level)] eased in/out over 1 s."""
    g = np.ones(n)
    fi, fo = int(fade_in * SR), int(fade_out * SR)
    g[:fi] = (1 - np.cos(np.linspace(0, np.pi, fi))) / 2
    g[-fo:] *= (1 + np.cos(np.linspace(0, np.pi, fo))) / 2
    t = np.arange(n) / SR
    for a, b, lv in dips:
        w = np.clip(np.minimum((t - a) / 1.0, (b - t) / 1.0), 0, 1)
        g *= 1 - (1 - lv) * w
    return g


def master(x, target_db=-16.0, knee=0.7, ceiling=0.94):
    """Bring the film to about -16 dBFS RMS (social-video loudness), with a soft knee above `knee`
    so the odd wave crash or bubble burst never clips."""
    r = np.sqrt(np.mean(x ** 2)) or 1.0
    y = x * (10 ** (target_db / 20) / r)
    a = np.abs(y)
    over = a > knee
    room = ceiling - knee
    y[over] = np.sign(y[over]) * (knee + room * np.tanh((a[over] - knee) / room))
    return y


def write_wav(path, x):
    """x: (n, 2) float stereo, or (n,) mono."""
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def db(x):
    r = np.sqrt(np.mean(np.asarray(x, np.float64) ** 2))
    return -120.0 if r <= 1e-9 else 20 * math.log10(r)


def mix_film(total, bed, music_name, music_offset=0.0, music_rms=0.1, bed_db=None, end_t=None, seed=1,
             wave_times=None):
    """Return (mix stereo, stems dict, music offset used)."""
    n = int(total * SR)
    mus, off = music(music_name, total, rms=music_rms, offset=music_offset)
    if bed == 'beach':
        amb = beach(total, seed, wave_times)
    else:
        amb = BEDS[bed](total, seed)
    target = 10 ** ((bed_db if bed_db is not None else BED_DB[bed]) / 20)
    amb = amb * (target / (np.sqrt(np.mean(amb ** 2)) or 1.0))
    dips = [(end_t, total + 1, 0.45)] if end_t else []
    amb = amb * fade_curve(n, 1.2, 3.0, dips)[:, None]
    m2 = np.stack([mus, mus], 1) * math.sqrt(0.5) * 1.41
    mix = master(m2 + amb)
    return mix, {'music': m2, 'ambience': amb}, off


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--demo', choices=list(BEDS), required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--seconds', type=float, default=20.0)
    ap.add_argument('--music', default='town-theme.mp3')
    a = ap.parse_args()
    mix, stems, _ = mix_film(a.seconds, a.demo, a.music)
    write_wav(a.out, mix)
    print('wrote', a.out, 'music %.1f dB, ambience %.1f dB, mix %.1f dB' % (db(stems['music']), db(stems['ambience']), db(mix)))
