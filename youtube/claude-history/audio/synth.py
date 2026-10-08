"""Original score + SFX for 「아모데이의 모험」, synthesized from scratch with numpy.

usage: python3 synth.py <cues.json> <out.wav>
Reads the same cue sheet as film/film.html so every hit lands on its frame.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


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


def noise(n):
    return rng.standard_normal(int(n * SR))


def saw(freq, dur, harmonics=48, phase=0.0):
    t = secs(dur)
    out = np.zeros_like(t)
    nmax = int(min(harmonics, (SR / 2 - 500) / freq))
    for k in range(1, nmax + 1):
        out += np.sin(2 * np.pi * freq * k * t + phase * k) / k
    return out * (2 / np.pi)


def supersaw(freqs, dur, voices=5, spread=0.18, harmonics=40):
    out = np.zeros(int(dur * SR))
    for f in freqs:
        for v in range(voices):
            det = (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread
            out += saw(f * 2 ** (det / 12), dur, harmonics, phase=rng.uniform(0, 6.28))
    return out / (len(freqs) * voices) ** 0.5


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
        if i >= len(self.x):
            return
        sig = sig[: len(self.x) - i]
        self.x[i:i + len(sig)] += sig * gain


# ---------- instruments
def kick(strength=1.0, f0=160, f1=45, decay=0.17, click=True):
    t = secs(decay * 2.2)
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / decay)
    if click:
        c = noise(0.006) * np.linspace(1, 0, int(0.006 * SR))
        body[: len(c)] += hp(c, 2000) * 0.6
    return np.tanh(body * 1.6 * strength) * 0.9


def heart(strength=1.0):
    return lp(kick(strength, f0=95, f1=38, decay=0.16, click=False), 260)


def snare(strength=1.0):
    n = noise(0.25)
    t = secs(0.25)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.6
    return (hp(lp(n, 7000), 900) * np.exp(-t / 0.07) * 0.8 + body) * strength


def hat(strength=1.0, length=0.05):
    t = secs(length)
    return hp(noise(length), 7000) * np.exp(-t / (length / 3)) * 0.35 * strength


def crash(strength=1.0, length=2.6):
    t = secs(length)
    return hp(noise(length), 3500) * np.exp(-t / 0.9) * 0.45 * strength


def boom(strength=1.0, tail=0.3):
    """Big cinematic hit: sub drop + low noise thump. tail sets how long the sub rings."""
    t = secs(tail * 5)
    f = 32 + 90 * np.exp(-t / 0.06)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tail)
    thump = lp(noise(tail * 5), 700) * np.exp(-t / 0.05) * 0.9
    snap = hp(noise(tail * 5), 2500) * np.exp(-t / 0.012) * 0.5
    return np.tanh((sub + thump + snap) * 1.2) * strength


def stab(notes, strength=1.0, length=0.5, bright=6000):
    sig = supersaw([midi(n) for n in notes], length)
    return lp(sig, bright) * adsr(length, 0.002, 0.07, 0.12, 0.1) * strength


def pad(notes, length, cutoff=2400):
    sig = supersaw([midi(n) for n in notes], length, voices=5, spread=0.25, harmonics=30)
    return lp(sig, cutoff) * adsr(length, 0.04, 0.4, 0.8, 0.08)


def bass_note(note, length):
    sig = saw(midi(note), length, harmonics=14) + 0.5 * np.sin(2 * np.pi * midi(note) * secs(length))
    return lp(sig, 900) * adsr(length, 0.002, 0.08, 0.7, 0.02)


def riser(length, f0=200, f1=2400):
    t = secs(length)
    u = t / length
    tone = np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** u) / SR) * 0.25
    n = noise(length)
    bands = [lp(n, fc) for fc in (400, 1200, 3500, 9000)]
    w = u * (len(bands) - 1)
    nz = np.zeros_like(t)
    for i, b in enumerate(bands):
        nz += b * np.clip(1 - np.abs(w - i), 0, 1)
    return (tone + nz * 0.35) * u ** 2


def glint(strength=1.0):
    t = secs(0.9)
    out = np.zeros_like(t)
    for f in (2637, 3520, 4699, 6272, 7902):
        out += np.sin(2 * np.pi * f * (1 + 0.04 * t) * t) * np.exp(-t / (0.15 + 400 / f))
    swish = hp(noise(0.9), 6000) * np.exp(-t / 0.08) * 0.5
    return (out * 0.18 + swish) * strength


def drone(length, root=38):
    t = secs(length)
    sig = supersaw([midi(root), midi(root + 7), midi(root + 12)], length, voices=4, spread=0.3, harmonics=24)
    cut = 300 + 1600 * (t / length) ** 2
    lo, hi = lp(sig, 300), lp(sig, 1900)
    mix = (cut - 300) / 1600
    return (lo * (1 - mix) + hi * mix) * np.clip(t / 0.6, 0, 1)


def reverb(x, seconds=1.8, mix=0.22):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, len(x)))
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 5))
        ir = lp(ir, 6000)
        ir /= np.sqrt(np.sum(ir ** 2))
        L = len(x) + n
        wet = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
        out[ch] = x * (1 - mix) + wet * mix * 1.4
    return out


# ---------- arrangement
CHORDS = {"Dm": [50, 53, 57, 62], "Bb": [46, 50, 53, 58], "C": [48, 52, 55, 60], "A": [45, 49, 52, 57]}
BASS = {"Dm": 38, "Bb": 34, "C": 36, "A": 33}


def build(cues):
    spb = 60 / cues["bpm"]
    total = cues["beats"] * spb
    drums, music, fx = Bus(total), Bus(total), Bus(total)
    kick_times = []

    for e in cues["events"]:
        at, s, ty = e["b"] * spb, e.get("s", 1.0), e["type"]
        if ty == "heart":
            drums.add(heart(s), at, 0.9)
        elif ty == "riser":
            fx.add(riser(e["len"] * spb), at, 0.7)
        elif ty in ("impact", "title"):
            fx.add(boom(s, 0.5 if ty == "title" else 0.16), at, 0.9)
            music.add(stab(CHORDS["Dm"] + [74], s, 0.35 if ty == "impact" else 1.2, 5000), at, 0.5)
            kick_times.append(at)
        elif ty == "stab":
            r = 50 + e.get("root", 0)
            music.add(stab([r, r + 7, r + 12, r + 19], s, 0.22, 7000), at, 0.6)
            drums.add(kick(0.8), at, 0.6)
        elif ty == "slam":
            fx.add(boom(s, 0.45), at, 1.0)
            fx.add(crash(s), at, 0.7)
            drums.add(kick(1.2), at, 0.9)
            music.add(stab(CHORDS["Dm"] + [74, 81], s, 1.2, 8000), at, 0.6)
            kick_times.append(at)
        elif ty == "drone":
            music.add(drone(e["len"] * spb), at, 0.45)
        elif ty == "glint":
            fx.add(glint(s), at, 0.8)
        elif ty == "groove":
            prog = ["Dm", "Dm", "Bb", "Bb", "C", "C", "A", "A"]
            for k in range(e["len"]):
                b0 = at + k * spb
                if k > 0:
                    drums.add(kick(1.0), b0, 0.85)
                kick_times.append(b0)
                drums.add(hat(0.9), b0 + spb / 2, 0.8)
                drums.add(hat(0.4, 0.03), b0 + spb / 4, 0.5)
                drums.add(hat(0.4, 0.03), b0 + 3 * spb / 4, 0.5)
                if k % 2 == 1:
                    drums.add(snare(0.9), b0, 0.6)
                ch = prog[k % len(prog)]
                for h in range(2):
                    music.add(bass_note(BASS[ch] + (12 if h else 0), spb / 2 * 0.9), b0 + h * spb / 2, 0.55)
                if k % 2 == 0:
                    music.add(pad(CHORDS[ch], spb * 2), b0, 0.42)
            fx.add(riser(spb * 4, 300, 3000), at + spb * 4, 0.35)
        elif ty == "roll":
            n_beats = e["len"]
            for k in range(n_beats):
                b0 = at + k * spb
                drums.add(kick(1.0), b0, 0.85)
                kick_times.append(b0)
                sub = 4 if k < n_beats / 2 else 8
                for j in range(sub):
                    vel = 0.35 + 0.65 * (k * sub + j) / (n_beats * sub)
                    drums.add(snare(vel), b0 + j * spb / sub, 0.55)
                music.add(pad([45, 49, 52, 57, 64], spb), b0, 0.4)
                music.add(bass_note(33, spb * 0.9), b0, 0.55)
            fx.add(riser(n_beats * spb, 400, 5000), at, 0.6)

    # sidechain: duck music under kicks/hits
    t = np.arange(len(music.x)) / SR
    duck = np.ones_like(t)
    for kt in kick_times:
        m = t >= kt
        duck[m] *= 1 - 0.55 * np.exp(-(t[m] - kt) / 0.11)
    mix_mono = music.x * duck
    st_music = reverb(mix_mono, 1.4, 0.2)
    st_fx = reverb(fx.x, 1.6, 0.16)
    st_drums = reverb(drums.x, 0.6, 0.06)
    out = st_music + st_fx + st_drums
    out = out[:, : int((total + 1.2) * SR)]
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
