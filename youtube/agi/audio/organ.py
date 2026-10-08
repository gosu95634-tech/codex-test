"""Cathedral score for 「인류의 마지막 발명」: pipe organ, timpani, tubular bell, in a synthetic cathedral.

No synth leads, no glitches: every voice models an acoustic instrument.
usage: python3 organ.py <score-name> <out.wav>
"""
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(11)


def secs(n):
    return np.arange(int(round(n * SR))) / SR


def hz(note):
    """Scientific pitch name ('A3', 'C#4', 'Bb2') or midi number -> frequency."""
    if isinstance(note, (int, float)):
        return 440.0 * 2 ** ((note - 69) / 12)
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = names[note[0]]
    rest = note[1:]
    if rest[0] in "#b":
        n += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    return 440.0 * 2 ** ((n + 12 * (int(rest) + 1) - 69) / 12)


def spectral(x, fn):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * fn(f), len(x))


def lp(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def bp(x, fc, q=3.0):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (q * (f / fc - fc / np.maximum(f, 1e-3))) ** 2))


# ---------- pipe organ
SPECTRA = {  # relative partial amplitudes per rank (pipe family)
    "principal": [1, .55, .32, .22, .14, .1, .07, .05, .035, .025, .018, .012, .008],
    "flute": [1, .05, .2, .02, .06, .01, .025, .005, .01],
    "string": [1 / k ** 0.55 for k in range(1, 26)],
    "reed": [1 / k ** 0.3 for k in range(1, 32)],
    "pedal": [1, .7, .45, .3, .2, .12, .08, .05],
}
FOOT = {"32": 0.25, "16": 0.5, "8": 1, "4": 2, "2": 4, "2.2/3": 3}  # pitch multiplier per footage (2 2/3' = twelfth)


def pipe(freq, dur, family="principal", gain=1.0, attack=0.045, release=0.18, detune_cents=0.0):
    """One organ pipe: additive partials, wind-pressure drift, speech transient (chiff), breath noise."""
    total = dur + release
    t = secs(total)
    n = len(t)
    f = freq * 2 ** (detune_cents / 1200)
    drift = 1 + 0.0006 * lp(rng.standard_normal(n), 3.0) / 0.3  # slow wind instability, ~±1 cent
    phase_base = 2 * np.pi * np.cumsum(f * drift) / SR
    out = np.zeros(n)
    for k, a in enumerate(SPECTRA[family], start=1):
        if f * k > 15000:
            break
        # upper partials speak a little later: the pipe "blooms"
        bloom = 1 - np.exp(-t / (attack * (0.6 + 0.12 * k)))
        out += a * np.sin(k * phase_base + rng.uniform(0, 6.28)) * bloom
    env = np.clip(t / attack, 0, 1) ** 0.7
    rel = np.where(t > dur, np.exp(-(t - dur) / (release / 3)), 1.0)
    out *= env * rel
    chiff_len = min(0.09, total)
    ch = bp(rng.standard_normal(int(chiff_len * SR)), min(f * 3, 9000), 4.0) * np.exp(-secs(chiff_len) / 0.022)
    out[: len(ch)] += ch * (0.35 if family == "flute" else 0.18)
    if family in ("flute", "principal"):
        out += bp(rng.standard_normal(n), min(f * 2, 9000), 1.5) * 0.012 * env * rel  # breath
    return out * gain / max(1, len(SPECTRA[family])) ** 0.35


def organ_note(note, dur, stops, gain=1.0):
    """stops: list of (family, footage, level). Celeste = a string rank doubled 4 cents sharp."""
    f0 = hz(note)
    out = None
    for family, foot, level in stops:
        mult = FOOT[foot]
        if family == "celeste":
            sig = pipe(f0 * mult, dur, "string", level) + pipe(f0 * mult, dur, "string", level, detune_cents=4.5)
        else:
            sig = pipe(f0 * mult, dur, family, level)
        out = sig if out is None else out + sig
    return out * gain


REG = {  # registrations
    "tutti": [("principal", "8", 1), ("principal", "4", .6), ("principal", "2", .35), ("reed", "8", .5), ("principal", "2.2/3", .2)],
    "full": [("principal", "8", 1), ("principal", "4", .55), ("reed", "8", .35)],
    "principal": [("principal", "8", 1), ("principal", "4", .35)],
    "flute": [("flute", "8", 1), ("flute", "4", .3)],
    "celeste": [("celeste", "8", .8)],
    "pedal": [("pedal", "16", 1), ("pedal", "8", .5)],
    "pedal_reed": [("pedal", "16", 1), ("reed", "16", .55), ("pedal", "8", .5)],
    "bourdon32": [("pedal", "32", 1), ("pedal", "16", .6)],
}


# ---------- percussion
def timpani(note, vel=1.0, length=4.0):
    f0 = hz(note)
    t = secs(length)
    modes = [(1.0, 1.0, 2.6), (1.504, .55, 1.7), (1.742, .35, 1.3), (2.0, .3, 1.1), (2.245, .18, .8), (2.494, .12, .6), (2.8, .08, .5)]
    glide = 1 + 0.012 * np.exp(-t / 0.05)
    out = sum(a * np.sin(2 * np.pi * f0 * r * np.cumsum(glide) / SR) * np.exp(-t / d) for r, a, d in modes)
    thump = lp(rng.standard_normal(len(t)), 180) * np.exp(-t / 0.035) * 1.2
    return (out * 0.5 + thump) * vel


def timpani_roll(note, t0, t1, v0, v1, bus):
    n = int((t1 - t0) * 15)
    for i in range(n):
        u = i / max(1, n - 1)
        at = t0 + i / 15 + rng.uniform(-0.006, 0.006)
        bus.add(timpani(note, (v0 + (v1 - v0) * u ** 1.6) * rng.uniform(0.85, 1.1), 2.0), at)


def bell(note, vel=1.0, length=9.0):
    f = hz(note)
    t = secs(length)
    partials = [(0.5, .6, 9), (1.0, 1, 6), (1.183, .5, 4), (1.506, .35, 3.5), (2.0, .55, 3), (2.514, .25, 2), (2.662, .2, 1.8), (3.011, .15, 1.5), (4.166, .1, 1)]
    out = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in partials)
    strike = bp(rng.standard_normal(len(t)), f * 4, 2) * np.exp(-t / 0.01) * 0.3
    return (out * 0.35 + strike) * vel


# ---------- cathedral
def cathedral_ir(rt_low=6.5, rt_mid=5.0, rt_high=2.4, length=7.5):
    n = int(length * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for ch in range(2):
        r = np.random.default_rng(300 + ch)
        noise = r.standard_normal(n)
        X = np.fft.rfft(noise)
        f = np.fft.rfftfreq(n, 1 / SR)
        bands = [(f < 300, rt_low), ((f >= 300) & (f < 2500), rt_mid), (f >= 2500, rt_high)]
        ir = np.zeros(n)
        for mask, rt in bands:
            ir += np.fft.irfft(X * mask, n) * np.exp(-6.91 * t / rt)
        pre = int(0.028 * SR)
        ir = np.concatenate([np.zeros(pre), ir])[:n]
        for d, a in [(0.011, .5), (0.019, .38), (0.027, .33), (0.041, .26), (0.053, .2), (0.067, .16)]:
            ir[int((d + r.uniform(-0.002, 0.002)) * SR)] += a * r.choice([-1, 1]) * 6
        out[ch] = ir / np.sqrt(np.sum(ir ** 2))
    return out


def convolve(x, ir):
    L = len(x) + len(ir)
    return np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]


class Bus:
    def __init__(self, seconds):
        self.x = np.zeros(int((seconds + 8) * SR))

    def add(self, sig, at, gain=1.0):
        i = int(round(at * SR))
        if i < 0 or i >= len(self.x):
            return
        sig = sig[: len(self.x) - i]
        self.x[i:i + len(sig)] += sig * gain


def swell(sig, a0, a1, curve=1.0):
    """Expression-pedal swell box: amplitude ramp across the note."""
    u = np.linspace(0, 1, len(sig)) ** curve
    return sig * (a0 + (a1 - a0) * u)


# ---------- scores
CH = {
    "Am": ["A2", "E3", "A3", "C4", "E4"], "F": ["F2", "C3", "F3", "A3", "C4"], "C": ["C3", "G3", "C4", "E4", "G4"],
    "G": ["G2", "D3", "G3", "B3", "D4"], "A": ["A2", "E3", "A3", "C#4", "E4", "A4"], "Dm": ["D3", "A3", "D4", "F4", "A4"],
}
ARP = {"Am": ["A3", "C4", "E4", "A4", "E4", "C4"], "F": ["F3", "A3", "C4", "F4", "C4", "A3"], "C": ["C4", "E4", "G4", "C5", "G4", "E4"], "G": ["G3", "B3", "D4", "G4", "D4", "B3"]}
MOTIF = [("A3", 1.0), ("E4", 1.0), ("D4", 1.0), ("C4", 2.0)]  # the "spark" leitmotif


def score_coldopen():
    total = 34.0
    org, perc = Bus(total), Bus(total)
    # 0–3: 32' bourdon breathes in the dark
    org.add(swell(organ_note("A1", 6.5, REG["bourdon32"], 0.55), 0.0, 1.0, 0.6), 0.0)
    timpani_roll("A2", 1.0, 2.98, 0.08, 0.9, perc)
    # 3: tutti A minor, the revelation
    for nt in CH["Am"] + ["A4"]:
        org.add(organ_note(nt, 4.2, REG["tutti"], 0.5), 3.0)
    org.add(organ_note("A1", 4.6, REG["pedal_reed"], 0.9), 3.0)
    perc.add(timpani("A2", 1.4, 5.0), 3.0)
    perc.add(bell("A3", 0.8), 3.0)
    # 7.5–20: celeste harmony + flute ostinato, the leitmotif on a solo principal
    prog = [("Am", 7.5), ("F", 11.0), ("C", 14.0), ("G", 17.0)]
    for i, (c, at) in enumerate(prog):
        end = prog[i + 1][1] if i + 1 < len(prog) else 20.2
        for nt in CH[c][1:]:
            org.add(organ_note(nt, end - at + 0.3, REG["celeste"], 0.23), at)
        org.add(organ_note(CH[c][0], end - at + 0.3, REG["pedal"], 0.3), at)
        k = 0
        tt = max(at, 8.5)
        while tt < end - 0.05:
            org.add(organ_note(ARP[c][k % 6], 0.22, REG["flute"], 0.12 + 0.07 * (tt - 8.5) / 11.5), tt)
            tt += 0.25
            k += 1
    for start in (9.0, 15.0):
        tt = start
        for nt, d in MOTIF:
            org.add(organ_note(nt, d * 0.95, REG["principal"], 0.32 if start < 12 else 0.4), tt)
            tt += d
    # 20–27: crescendo on full organ, pedal reeds, timpani roll
    for c, at, d in (("Am", 20.0, 2.0), ("F", 22.0, 2.0), ("G", 24.0, 2.95)):
        u = (at - 20) / 5
        for nt in CH[c]:
            org.add(swell(organ_note(nt, d, REG["full"], 0.12 + 0.26 * u), 0.6, 1.25), at)
        org.add(organ_note(CH[c][0][:-1] + str(int(CH[c][0][-1]) - 1), d, REG["pedal_reed"], 0.3 + 0.5 * u), at)
    timpani_roll("A2", 24.0, 26.95, 0.06, 1.0, perc)
    # 27: A major tutti (Picardy third) under the title, ringing into the stone
    for nt in CH["A"] + ["C#5"]:
        org.add(organ_note(nt, 4.0, REG["tutti"], 0.56), 27.0)
    org.add(organ_note("A1", 4.4, REG["pedal_reed"], 0.9), 27.0)
    org.add(organ_note("A1", 5.0, REG["bourdon32"], 0.6), 27.0)
    perc.add(timpani("A2", 1.3, 5.0), 27.0)
    perc.add(bell("A3", 0.9), 27.0)
    perc.add(bell("E4", 0.4), 27.6)
    return org.x, perc.x, total


def master(org, perc, total):
    ir = cathedral_ir()
    st = np.zeros((2, len(org)))
    for ch in range(2):
        st[ch] = org * 0.55 + convolve(org, ir[ch]) * 0.75 + perc * 0.5 + convolve(perc, ir[ch]) * 0.6
    st = st[:, : int(total * SR)]
    fade = int(1.2 * SR)
    st[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    st /= np.max(np.abs(st)) + 1e-9
    return np.tanh(st * 1.15) / np.tanh(1.15) * 0.93


def write_wav(path, st):
    data = (np.clip(st.T, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


SCORES = {"coldopen": score_coldopen}

if __name__ == "__main__":
    org, perc, total = SCORES[sys.argv[1]]()
    write_wav(sys.argv[2], master(org, perc, total))
    print("wrote", sys.argv[2])
