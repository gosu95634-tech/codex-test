"""Original score + SFX for 「아모데이의 모험」, synthesized from scratch with numpy.

usage: python3 synth.py <cues.json> <out.wav>
Reads the same cue sheet as film/film.html so every hit lands on its frame.
All melodies are original; no samples are used.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)
_cache = {}


# ---------- primitives
def secs(n):
    return np.arange(int(n * SR)) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def spectral(x, fn):
    """Zero-phase filter: multiply the spectrum by fn(freqs)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * fn(f), len(x))


def lp(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def hp(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bp(x, fc, q=2.0):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (q * (f / fc - fc / np.maximum(f, 1e-3))) ** 2))


def noise(n):
    return rng.standard_normal(int(n * SR))


def saw(freq, dur, harmonics=48, phase=0.0):
    t = secs(dur)
    out = np.zeros_like(t)
    nmax = int(min(harmonics, (SR / 2 - 500) / freq))
    for k in range(1, nmax + 1):
        out += np.sin(2 * np.pi * freq * k * t + phase * k) / k
    return out * (2 / np.pi)


def square(freq, dur, harmonics=24):
    t = secs(dur)
    out = np.zeros_like(t)
    nmax = int(min(harmonics, (SR / 2 - 500) / freq))
    for k in range(1, nmax + 1, 2):
        out += np.sin(2 * np.pi * freq * k * t) / k
    return out * (4 / np.pi)


def supersaw(freqs, dur, voices=5, spread=0.18, harmonics=40):
    key = ("ss", tuple(np.round(freqs, 3)), round(dur, 4), voices, spread, harmonics)
    if key in _cache:
        return _cache[key]
    out = np.zeros(int(dur * SR))
    r = np.random.default_rng(len(freqs) * 31 + voices)
    for f in freqs:
        for v in range(voices):
            det = (v - (voices - 1) / 2) / max((voices - 1) / 2, 1) * spread
            out += saw(f * 2 ** (det / 12), dur, harmonics, phase=r.uniform(0, 6.28))
    out /= (len(freqs) * voices) ** 0.5
    _cache[key] = out
    return out


def adsr(n_s, a=0.005, d=0.1, s=0.6, r=0.2):
    n = int(n_s * SR)
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip((n_s - t) / max(r, 1e-6), 0, 1)
    return e * rel


class Bus:
    def __init__(self, n_s):
        self.x = np.zeros(int(n_s * SR) + SR * 4)

    def add(self, sig, at, gain=1.0):
        i = int(at * SR)
        if i >= len(self.x) or i < 0:
            return
        sig = sig[: len(self.x) - i]
        self.x[i:i + len(sig)] += sig * gain


# ---------- drums & hits
def kick(strength=1.0, f0=160, f1=45, decay=0.17, click=True):
    t = secs(decay * 2.2)
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    if click:
        c = noise(0.006) * np.linspace(1, 0, int(0.006 * SR))
        body[: len(c)] += hp(c, 2000) * 0.6
    return np.tanh(body * 1.6 * strength) * 0.9


def heart(strength=1.0):
    return lp(kick(strength, f0=95, f1=38, decay=0.16, click=False), 260)


def snare(strength=1.0):
    n, t = noise(0.25), secs(0.25)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.6
    return (hp(lp(n, 7000), 900) * np.exp(-t / 0.07) * 0.8 + body) * strength


def clap(strength=1.0):
    t = secs(0.3)
    e = np.zeros_like(t)
    for d in (0, 0.011, 0.022):
        m = t >= d
        e[m] += np.exp(-(t[m] - d) / (0.012 if d < 0.02 else 0.09))
    return bp(noise(0.3), 1400, 1.2) * e * 0.9 * strength


def hat(strength=1.0, length=0.05):
    t = secs(length)
    return hp(noise(length), 7000) * np.exp(-t / (length / 3)) * 0.35 * strength


def crash(strength=1.0, length=2.6):
    t = secs(length)
    return hp(noise(length), 3500) * np.exp(-t / 0.9) * 0.45 * strength


def clank(strength=1.0):
    """Metallic hit: inharmonic partials, for the mecha section."""
    t = secs(0.6)
    out = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d in ((523, 0.25), (1187, 0.15), (1733, 0.1), (2640, 0.07)))
    return (out * 0.25 + hp(noise(0.6), 3000) * np.exp(-t / 0.02) * 0.6) * strength


def boom(strength=1.0, tail=0.3):
    t = secs(tail * 5)
    f = 32 + 90 * np.exp(-t / 0.06)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tail)
    thump = lp(noise(tail * 5), 700) * np.exp(-t / 0.05) * 0.9
    snap = hp(noise(tail * 5), 2500) * np.exp(-t / 0.012) * 0.5
    return np.tanh((sub + thump + snap) * 1.2) * strength


def whoosh(length=0.5, up=True):
    t = secs(length)
    u = t / length
    n = noise(length)
    lo, hi = lp(n, 600), hp(n, 2500)
    m = u if up else 1 - u
    return (lo * (1 - m) + hi * m) * np.sin(np.pi * u) * 0.5


def shatter(strength=1.0, length=0.9):
    out = np.zeros(int(length * SR))
    for _ in range(40):
        at = rng.uniform(0, length * 0.7)
        L = rng.uniform(0.01, 0.06)
        b = hp(noise(L), rng.uniform(3000, 9000)) * np.exp(-secs(L) / (L / 3))
        i = int(at * SR)
        out[i:i + len(b)] += b[: len(out) - i] * rng.uniform(0.2, 0.7)
    return out * strength


def crack(strength=1.0):
    t = secs(0.25)
    return (hp(noise(0.25), 2500) * np.exp(-t / 0.018) + np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.04) * 0.2) * strength


def beep(freq, length=0.12, strength=1.0):
    return square(freq, length, 9) * adsr(length, 0.002, 0.05, 0.8, 0.02) * 0.22 * strength


def bell(note, length=1.2, strength=1.0):
    t = secs(length)
    f = midi(note)
    out = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (length * d)) for m, a, d in ((1, 1, 0.5), (2.01, 0.5, 0.3), (3.0, 0.25, 0.2), (4.2, 0.18, 0.12)))
    return out * 0.2 * strength


def glint(strength=1.0):
    t = secs(0.9)
    out = sum(np.sin(2 * np.pi * f * (1 + 0.04 * t) * t) * np.exp(-t / (0.15 + 400 / f)) for f in (2637, 3520, 4699, 6272, 7902))
    return (out * 0.18 + hp(noise(0.9), 6000) * np.exp(-t / 0.08) * 0.5) * strength


def riser(length, f0=200, f1=2400):
    t = secs(length)
    u = t / length
    tone = np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** u) / SR) * 0.25
    n = noise(length)
    bands = [lp(n, fc) for fc in (400, 1200, 3500, 9000)]
    w = u * (len(bands) - 1)
    nz = sum(b * np.clip(1 - np.abs(w - i), 0, 1) for i, b in enumerate(bands))
    return (tone + nz * 0.35) * u ** 2


def rustle(length):
    out = np.zeros(int(length * SR))
    step = 60 / 150 / 4
    for k in range(int(length / step)):
        L = 0.07
        b = bp(noise(L), rng.uniform(1500, 4000), 1.5) * np.exp(-secs(L) / 0.025) * rng.uniform(0.3, 1)
        i = int(k * step * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out * 0.6


# ---------- tonal parts
def stab(notes, strength=1.0, length=0.5, bright=6000):
    return lp(supersaw([midi(n) for n in notes], length), bright) * adsr(length, 0.002, 0.07, 0.12, 0.1) * strength


def pad(notes, length, cutoff=2400):
    return lp(supersaw([midi(n) for n in notes], length, voices=5, spread=0.25, harmonics=30), cutoff) * adsr(length, 0.04, 0.4, 0.8, 0.08)


def bass_note(note, length, bright=900):
    sig = saw(midi(note), length, harmonics=14) + 0.5 * np.sin(2 * np.pi * midi(note) * secs(length))
    return lp(sig, bright) * adsr(length, 0.002, 0.08, 0.7, 0.02)


def lead_note(note, length, kind="saw"):
    if kind == "square":
        sig = square(midi(note), length, 15) * 0.6
        env_ = adsr(length, 0.003, 0.08, 0.35, 0.03)
    elif kind == "bell":
        return bell(note, max(length, 0.6), 1.2)
    else:
        sig = supersaw([midi(note)], length, voices=3, spread=0.12, harmonics=36) + 0.35 * square(midi(note + 12), length, 9)
        env_ = adsr(length, 0.006, 0.15, 0.7, 0.04)
    return lp(sig, 6500) * env_


def pluck(note, length):
    sig = saw(midi(note), length, harmonics=24)
    t = secs(length)
    return lp(sig, 2500) * np.exp(-t / 0.18) * 0.7


def drone(length, root=38):
    t = secs(length)
    sig = supersaw([midi(root), midi(root + 7), midi(root + 12)], length, voices=4, spread=0.3, harmonics=24)
    mix = ((300 + 1600 * (t / length) ** 2) - 300) / 1600
    return (lp(sig, 300) * (1 - mix) + lp(sig, 1900) * mix) * np.clip(t / 0.6, 0, 1)


def varispeed_stop(x, length):
    """Tape stop: playback rate falls linearly from 1 to 0 over `length` seconds."""
    n = int(length * SR)
    rate = np.linspace(1, 0, n)
    pos = np.cumsum(rate)
    pos = np.clip(pos, 0, len(x) - 2)
    i = pos.astype(int)
    fr = pos - i
    return (x[i] * (1 - fr) + x[i + 1] * fr) * np.linspace(1, 0.3, n)


def reverb(x, seconds=1.8, mix=0.22, seed=0):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, len(x)))
    r = np.random.default_rng(100 + seed)
    for ch in range(2):
        ir = lp(r.standard_normal(n) * np.exp(-t / (seconds / 5)), 6000)
        ir /= np.sqrt(np.sum(ir ** 2))
        L = len(x) + n
        wet = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
        out[ch] = x * (1 - mix) + wet * mix * 1.4
    return out


def delay(x, d, fb=0.35, mix=0.3):
    out = x.copy()
    k = int(d * SR)
    g = mix
    for rep in range(1, 5):
        out[k * rep:] += x[: len(x) - k * rep] * g
        g *= fb
    return out


# ---------- harmony & melodies
CHORDS = {"Dm": [50, 53, 57, 62], "Bb": [46, 50, 53, 58], "C": [48, 52, 55, 60], "A": [45, 49, 52, 57], "F": [41, 45, 48, 53],
          "D": [50, 54, 57, 62], "Bm": [47, 50, 54, 59], "G": [43, 47, 50, 55]}
BASS = {"Dm": 38, "Bb": 34, "C": 36, "A": 33, "F": 29, "D": 38, "Bm": 35, "G": 31}
N = {"A4": 69, "A#4": 70, "B4": 71, "C5": 72, "C#5": 73, "D5": 74, "E5": 76, "F5": 77, "F#5": 78, "G5": 79, "A5": 81, "A#5": 82, "B5": 83,
     "C6": 84, "C#6": 85, "D6": 86, "E6": 88}
MELODIES = {  # (beat offset, note, length in beats); loops every `len`
    "hook": (16, "saw", [(0, "D5", .5), (.5, "F5", .5), (1, "A5", .75), (1.75, "G5", .25), (2, "F5", .5), (2.5, "D5", .5), (3, "F5", 1),
                         (4, "E5", .5), (4.5, "G5", .5), (5, "C6", .75), (5.75, "A#5", .25), (6, "A5", 1.5), (7.5, "C#6", .5),
                         (8, "D6", .5), (8.5, "A5", .5), (9, "F5", .5), (9.5, "A5", .5), (10, "D5", .5), (10.5, "F5", .5), (11, "A#5", 1),
                         (12, "G5", .5), (12.5, "E5", .5), (13, "C6", 1), (14, "A5", .5), (14.5, "E5", .5), (15, "C#6", 1)]),
    "anthem": (16, "saw", [(0, "A4", 2), (2, "D5", 2), (4, "F5", 3), (7, "E5", 1), (8, "D5", 2), (10, "C5", 2), (12, "A4", 2), (14, "C5", 2)]),
    "bounce": (8, "square", [(0, "F#5", .5), (.5, "A5", .5), (1, "D6", .5), (1.5, "A5", .5), (2, "F#5", .5), (2.5, "D5", .5), (3, "B4", .5), (3.5, "D5", .5),
                             (4, "D5", .5), (4.5, "G5", .5), (5, "B5", .5), (5.5, "G5", .5), (6, "E5", .5), (6.5, "C#6", .5), (7, "A5", .5), (7.5, "E5", .5)]),
}


def arp_notes(chord):
    c = CHORDS[chord]
    return [c[0] + 24, c[1] + 24, c[2] + 24, c[3] + 24]


# ---------- arrangement
def build(cues):
    spb = 60 / cues["bpm"]
    total = cues["beats"] * spb
    drums, music, lead, fx = Bus(total), Bus(total), Bus(total), Bus(total)
    kick_times = []

    def K(at, s=1.0, gain=0.85):
        drums.add(kick(s), at, gain)
        kick_times.append(at)

    for e in cues["events"]:
        at, s, ty = e["b"] * spb, e.get("s", 1.0), e["type"]
        if ty == "heart":
            drums.add(heart(s), at, 0.9)
        elif ty == "riser":
            fx.add(riser(e["len"] * spb, e.get("f0", 200), e.get("f1", 2400)), at, 0.6)
        elif ty in ("impact", "title"):
            fx.add(boom(s, 0.5 if ty == "title" else 0.16), at, 0.85)
            music.add(stab(CHORDS["Dm"] + [74], s, 0.35 if ty == "impact" else 1.2, 5000), at, 0.42)
            kick_times.append(at)
        elif ty == "cut":
            fx.add(boom(s * 0.8, 0.1), at, 0.6)
            fx.add(whoosh(0.18, True), at - 0.18, 0.35)
            kick_times.append(at)
        elif ty == "stab":
            r = 50 + e.get("root", 0)
            music.add(stab([r, r + 7, r + 12, r + 19], s, 0.22, 7000), at, 0.55)
            drums.add(kick(0.8), at, 0.6)
        elif ty == "slam":
            fx.add(boom(s, 0.45), at, 1.0)
            fx.add(crash(s), at, 0.65)
            K(at, 1.2, 0.9)
            music.add(stab(CHORDS["Dm"] + [74, 81], s, 1.2, 8000), at, 0.5)
        elif ty == "drone":
            music.add(drone(e["len"] * spb), at, 0.4)
        elif ty == "glint":
            fx.add(glint(s), at, 0.75)
        elif ty == "rummage":
            fx.add(rustle(e["len"] * spb), at, 0.7)
        elif ty == "fanfare":
            for k, n in enumerate((74, 78, 81, 86)):
                lead.add(lead_note(n, spb / 4, "square"), at - spb + k * spb / 4, 0.5)
            music.add(stab(CHORDS["D"] + [74, 78], s, 0.9, 9000), at, 0.55)
            fx.add(boom(s, 0.25), at, 0.7)
            fx.add(glint(0.8), at, 0.6)
            kick_times.append(at)
        elif ty == "scouter":
            L = e["len"] * spb
            t = secs(L)
            hum = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (t / L * 2)) / SR) * 0.12
            music.add(hum + lp(drone(L, 38), 1200) * 0.6, at, 0.6)
            for k in range(e["len"]):
                if k % 2 == 0:
                    K(at + k * spb, 0.9, 0.7)
                else:
                    drums.add(snare(0.6), at + k * spb, 0.45)
                for j in range(4):
                    drums.add(hat(0.4 + 0.15 * (j % 2), 0.03), at + k * spb + j * spb / 4, 0.55)
        elif ty == "count":
            n = e["n"]
            fx.add(beep(880, 0.3, 1.3) if n >= 10 else beep(1200 + n * 180, 0.1), at, 0.8)
        elif ty == "crack":
            fx.add(crack(s), at, 0.8)
        elif ty == "explode":
            fx.add(boom(s, 0.7), at, 1.0)
            fx.add(crash(s, 3.0), at, 0.7)
            fx.add(shatter(s), at, 0.7)
            K(at, 1.3, 0.9)
        elif ty == "sparkle":
            for k, n in enumerate((86, 90, 93, 98)):
                fx.add(bell(n, 1.0, 0.9), at + k * spb / 8, 0.55)
            fx.add(glint(0.7), at, 0.5)
        elif ty == "siren":
            L = e["len"] * spb
            t = secs(L)
            f = np.where((t / (spb * 2)) % 1 < 0.5, 620, 830)
            sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.12
            fx.add(lp(sig, 2000) * np.clip(t / 0.3, 0, 1), at, 0.6)
        elif ty == "check":
            fx.add(beep(1568, 0.07), at, 0.7)
            fx.add(beep(2093, 0.1), at + 0.07, 0.7)
        elif ty == "launch":
            fx.add(boom(s, 0.6), at, 1.0)
            fx.add(crash(s, 3.0), at, 0.7)
            fx.add(whoosh(1.4, True), at, 0.8)
            K(at, 1.3, 0.9)
            music.add(stab(CHORDS["Dm"] + [74, 81], s, 1.4, 9000), at, 0.5)
        elif ty == "breakdown":
            L = e["len"] * spb
            music.add(pad(CHORDS["Dm"], L, 900) * np.clip(secs(L) / 1.0, 0, 1), at, 0.5)
            music.add(bass_note(26, L, 300), at, 0.4)
        elif ty == "tapestop":
            bar = np.zeros(int(spb * 4 * SR))
            for k in range(4):
                i = int(k * spb * SR)
                kk = kick(1.0)
                bar[i:i + len(kk)] += kk[: len(bar) - i] * 0.8
            st = stab(CHORDS["Dm"] + [74, 81], 1.0, spb * 4, 7000) * 0.6
            bar[: len(st)] += st[: len(bar)]
            music.add(varispeed_stop(bar, e["len"] * spb), at, 0.9)
        elif ty == "outro":
            riff = ["D4", "F4", "A4", "C5", "A4", "F4", "E4", "A3"]
            pitch = {"A3": 57, "D4": 62, "E4": 64, "F4": 65, "A4": 69, "C5": 72}
            L = e["len"]
            for k in range(L * 2):
                b0 = at + k * spb / 2
                fade = 1 - max(0, (k / 2 - (L - 3)) / 3)
                lead.add(pluck(pitch[riff[k % 8]], spb * 0.45), b0, 0.5 * fade)
                if k % 2 == 0:
                    drums.add(hat(0.5 * fade, 0.03), b0 + spb / 2, 0.5)
                if k % 4 == 0:
                    K(b0, 0.7 * fade, 0.6)
            music.add(pad(CHORDS["Dm"], L * spb, 1200) * np.linspace(1, 0, int(L * spb * SR)), at, 0.25)
        elif ty in ("groove", "roll"):
            style = e.get("style", "roll")
            n_beats = e["len"]
            prog = e.get("prog", ["A"] * n_beats)
            for k in range(n_beats):
                b0 = at + k * spb
                ch = prog[k % len(prog)]
                if ty == "roll":
                    K(b0, 1.0)
                    sub = 4 if k < n_beats / 2 else 8
                    for j in range(sub):
                        drums.add(snare(0.35 + 0.65 * (k * sub + j) / (n_beats * sub)), b0 + j * spb / sub, 0.55)
                    music.add(pad([45, 49, 52, 57, 64], spb), b0, 0.38)
                    music.add(bass_note(33, spb * 0.9), b0, 0.5)
                    continue
                if style == "drive":
                    if k > 0 or e["b"] in (12, 24):
                        K(b0)
                    drums.add(hat(0.9), b0 + spb / 2, 0.8)
                    drums.add(hat(0.4, 0.03), b0 + spb / 4, 0.45)
                    drums.add(hat(0.4, 0.03), b0 + 3 * spb / 4, 0.45)
                    if k % 2 == 1:
                        drums.add(snare(0.9), b0, 0.55)
                        drums.add(clap(0.6), b0, 0.4)
                    for h in range(2):
                        music.add(bass_note(BASS[ch] + (12 if h else 0), spb / 2 * 0.9), b0 + h * spb / 2, 0.5)
                    if k % 2 == 0:
                        music.add(pad(CHORDS[ch], spb * 2), b0, 0.36)
                elif style == "half":
                    if k % 4 == 0:
                        K(b0, 1.0)
                    if k % 4 == 2:
                        drums.add(snare(1.0), b0, 0.6)
                        drums.add(clap(0.7), b0, 0.4)
                    drums.add(hat(0.6), b0 + spb / 2, 0.6)
                    if k % 2 == 0:
                        music.add(bass_note(BASS[ch], spb * 1.9, 500), b0, 0.55)
                        music.add(pad(CHORDS[ch] + [CHORDS[ch][0] + 12], spb * 2, 3000), b0, 0.4)
                elif style == "hats":
                    for j in range(4):
                        drums.add(hat(0.3 + 0.3 * (j % 2), 0.03), b0 + j * spb / 4, 0.5)
                    if k == 0:
                        K(b0, 0.8, 0.6)
                elif style == "bounce":
                    K(b0)
                    if k % 2 == 1:
                        drums.add(clap(1.0), b0, 0.55)
                    drums.add(hat(0.8), b0 + spb / 2, 0.7)
                    music.add(bass_note(BASS[ch], spb * 0.4), b0, 0.5)
                    music.add(bass_note(BASS[ch] + 12, spb * 0.4), b0 + spb / 2, 0.45)
                    music.add(stab(CHORDS[ch], 0.7, spb * 0.35, 4500), b0 + spb / 2, 0.45)
                elif style == "sparkle":
                    K(b0, 0.8, 0.7)
                    if k % 2 == 1:
                        drums.add(clap(0.7), b0, 0.4)
                    for j in range(4):
                        drums.add(hat(0.25 + 0.2 * (j % 2), 0.025), b0 + j * spb / 4, 0.5)
                        notes = arp_notes(ch)
                        lead.add(bell(notes[(k * 4 + j) % 4], 0.6, 0.8), b0 + j * spb / 4, 0.35)
                    if k % 2 == 0:
                        music.add(pad(CHORDS[ch] + [CHORDS[ch][0] + 12], spb * 2, 4000), b0, 0.36)
                        music.add(bass_note(BASS[ch], spb * 1.9, 600), b0, 0.45)
                elif style == "mecha":
                    if k % 2 == 0:
                        K(b0, 1.1)
                    if k % 4 == 3:
                        K(b0 + spb / 2, 0.8, 0.6)
                    if k % 2 == 1:
                        drums.add(clank(0.9), b0, 0.5)
                    for j in range(4):
                        music.add(lp(np.tanh(bass_note(26, spb / 4 * 0.85, 1400) * 3) * 0.4, 1800), b0 + j * spb / 4, 0.55)
                    if k % 4 == 0:
                        music.add(pad([38, 45, 50, 53], spb * 4, 1500), b0, 0.3)
            mel = e.get("melody")
            if mel in MELODIES:
                loop, kind, notes = MELODIES[mel]
                for rep in range(int(np.ceil(n_beats / loop))):
                    for off, nn, L in notes:
                        bt = rep * loop + off
                        if bt < n_beats:
                            lead.add(lead_note(N[nn], L * spb * 0.95, kind), at + bt * spb, 0.42 if kind == "saw" else 0.34)
            if style == "drive":
                fx.add(riser(spb * 4, 300, 3000), at + spb * max(0, n_beats - 4), 0.25)

    # sidechain: duck music + lead under kicks/hits
    t = np.arange(len(music.x)) / SR
    duck = np.ones_like(t)
    for kt in sorted(kick_times):
        i0 = int(kt * SR)
        i1 = min(len(duck), i0 + int(0.5 * SR))
        duck[i0:i1] *= 1 - 0.55 * np.exp(-(t[i0:i1] - kt) / 0.11)
    st_music = reverb(music.x * duck, 1.4, 0.2, 1)
    st_lead = reverb(delay(lead.x * (0.5 + 0.5 * duck), spb * 0.75, 0.3, 0.25), 1.6, 0.22, 2)
    st_fx = reverb(fx.x, 1.6, 0.16, 3)
    st_drums = reverb(drums.x, 0.6, 0.06, 4)
    out = st_music + st_lead * 0.9 + st_fx + st_drums
    out = out[:, : int((total + 1.5) * SR)]
    out /= np.max(np.abs(out)) + 1e-9
    return np.tanh(out * 1.1) / np.tanh(1.1) * 0.95


def write_wav(path, st):
    data = (np.clip(st.T, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == "__main__":
    cues = json.load(open(sys.argv[1]))
    write_wav(sys.argv[2], build(cues))
    print("wrote", sys.argv[2])
