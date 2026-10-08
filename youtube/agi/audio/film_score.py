"""Film score for 「인류의 마지막 발명」: 540 s, composed against the 음악 column of ../script.md.

Every voice models an acoustic instrument in one synthetic cathedral:
pipe-organ ranks (principal, stopped and harmonic flutes, salicional and voix celeste, open and
stopped 32'/16' pedal, a little reed only in the tutti), a comb music box, distant church bells
and a felt-mallet timpani for the heartbeat. No synth leads, risers or electronic sounds.
The Shepard-Risset rise (397-455) is played on real flue pipes as an endless, quickening organ
glissando: discrete pipes, octave-layered under a fixed spectral bell.

usage: python3 audio/film_score.py out/score.wav [--only cold_a,ch2] [--from 150 --to 200] [--jobs 3]
"""
import os
import sys
import time
import wave

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

import organ as O  # noqa: E402
from organ import SR, hz  # noqa: E402

TOTAL = 540.0
PRE = 2.0     # every section buffer starts this much before its nominal start (anticipations)
TAIL = 11.0   # ... and runs this long past its end (releases)
FMAX = 11000.0

# ======================================================================================
# instruments
# ======================================================================================
NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi(note):
    n = NAMES[note[0]]
    rest = note[1:]
    if rest[0] in "#b":
        n += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    return n + 12 * (int(rest) + 1)


def name_of(m):
    return SHARP[m % 12] + str(m // 12 - 1)


# pipe families: partial amplitudes, chiff level, breath level, speech time (s)
FAM = {
    "principal": (O.SPECTRA["principal"], 0.05, 0.010, 0.040),
    "flute": (O.SPECTRA["flute"], 0.08, 0.016, 0.030),                         # stopped wood Gedackt
    "hflute": ([1, .34, .13, .055, .025, .012, .006], 0.06, 0.024, 0.045),      # harmonic flute, the solo voice
    "string": ([1 / k ** 0.8 for k in range(1, 22)], 0.025, 0.004, 0.075),     # salicional; slow, bowed-like speech
    "bourdon": ([1, .05, .38, .03, .14, .02, .06, .01, .025], 0.05, 0.0, 0.12),  # stopped 32'/16'
    "pedal": (O.SPECTRA["pedal"], 0.04, 0.0, 0.09),                            # open 16' / violone
    "reed": ([1 / k ** 0.5 for k in range(1, 24)], 0.02, 0.0, 0.035),
}
RMS = {k: np.sqrt(np.sum(np.square(v[0])) / 2) for k, v in FAM.items()}

FOOT = dict(O.FOOT)
FOOT.update({"1.1/3": 6, "1": 8})

REG = {  # registrations: (family, footage, level); 'celeste' = salicional + voix celeste tuned 4.5 cents sharp
    "b32": [("bourdon", "32", .72), ("bourdon", "16", .4)],
    "b32only": [("bourdon", "32", .8)],
    "ped": [("bourdon", "16", 1.0), ("flute", "8", .32)],
    "ped_mel": [("bourdon", "16", 1.0), ("principal", "8", .55), ("flute", "4", .2)],
    "ped_open": [("pedal", "16", 1.0), ("bourdon", "16", .6), ("principal", "8", .45), ("principal", "4", .2)],
    "ped_tutti": [("pedal", "16", 1.0), ("bourdon", "16", .7), ("principal", "8", .6), ("principal", "4", .35), ("reed", "16", .22)],
    "cel": [("celeste", "8", 1.0)],
    "aether": [("celeste", "8", .8), ("flute", "4", .25)],
    "fl8": [("flute", "8", 1.0)],
    "fl84": [("flute", "8", 1.0), ("flute", "4", .4)],
    "fl_low": [("flute", "8", 1.0), ("bourdon", "16", .55)],
    "hfl": [("hflute", "8", 1.0)],
    "spr": [("principal", "8", .8), ("flute", "8", .5)],            # soft principal: the motif's voice
    "prin": [("principal", "8", 1.0), ("principal", "4", .4)],
    "chorus": [("principal", "8", 1.0), ("principal", "4", .55), ("principal", "2", .25), ("flute", "8", .5)],
    "dark": [("flute", "8", 1.0), ("principal", "8", .35), ("bourdon", "16", .4)],
    "plenum": [("principal", "16", .45), ("principal", "8", 1.0), ("principal", "4", .62), ("principal", "2.2/3", .28),
               ("principal", "2", .42), ("principal", "1.1/3", .2), ("principal", "1", .14), ("flute", "8", .5), ("reed", "8", .2)],
    "plenum_soft": [("principal", "16", .4), ("principal", "8", 1.0), ("principal", "4", .55), ("principal", "2", .3),
                    ("principal", "1.1/3", .12), ("flute", "8", .5)],
}

PAN_W = {"bourdon": .16, "pedal": .2, "reed": .28, "principal": .3, "flute": .42, "hflute": .38, "string": .5}


def pan_of(m, fam):
    """Pipes stand on C- and C#-side chests: alternate semitones sound from opposite sides of the case."""
    return (1 if m % 2 == 0 else -1) * PAN_W[fam]


def fast_len(n):
    return int(np.ceil(n / 960.0)) * 960   # 960 = 2^6*3*5 keeps every FFT fast


def smooth_noise(rng, n, rate=100, cutoff=2.5):
    """Unit-rms random wander, band-limited to `cutoff` Hz, generated on a coarse grid and interpolated."""
    step = SR // rate
    m = n // step + 6
    c = rng.standard_normal(m)
    f = np.fft.rfftfreq(m, 1 / rate)
    c = np.fft.irfft(np.fft.rfft(c) / np.sqrt(1 + (f / cutoff) ** 4), m)
    c /= np.std(c) + 1e-12
    return np.interp(np.arange(n) / step, np.arange(m), c)


def envelope(n, dur, att, rel, pts=None):
    """Expression (swell-box) envelope: raised-cosine breath in, optional breakpoint swell, raised-cosine release."""
    e = np.ones(n, np.float32)
    na = min(n, int(att * SR))
    if na > 0:
        e[:na] = np.sin(0.5 * np.pi * np.arange(na, dtype=np.float32) / max(na, 1)) ** 2
    i0 = min(n, int(dur * SR))
    nr = max(1, int(rel * SR))
    i1 = min(n, i0 + nr)
    e[i0:i1] *= np.cos(0.5 * np.pi * np.arange(i1 - i0, dtype=np.float32) / nr) ** 2
    e[i1:] = 0
    if pts:
        t = np.arange(n, dtype=np.float32) / SR
        e *= np.interp(t, [p[0] for p in pts], [p[1] for p in pts]).astype(np.float32)
    return e


def unit_noise(rng, n, fc, q):
    x = O.bp(rng.standard_normal(n), fc, q)
    return x / (np.std(x) + 1e-12)


def narrow_noise(rng, n, bw):
    """Complex low-pass noise of bandwidth ~bw (coarse grid + linear interpolation), unit rms."""
    step = max(1, int(SR / max(4 * bw, 50)))
    m = n // step + 3
    xi = np.arange(n, dtype=np.float32) / step
    c = np.interp(xi, np.arange(m), rng.standard_normal(m)) + 1j * np.interp(xi, np.arange(m), rng.standard_normal(m))
    return (c / (np.sqrt(np.mean(np.abs(c) ** 2)) + 1e-12)).astype(np.complex64)


def pipe(rng, f, dur, fam, att=0.06, rel=0.35, pts=None, detune=0.0, trem=0.0, chiff=1.0):
    """One flue or reed pipe: phase-locked additive partials driven by a wandering wind supply, upper partials
    speaking slightly late (bloom), speech chiff, breath noise. The expression envelope darkens the tone as the
    swell box closes (upper partials follow env^2)."""
    parts, chiff_lvl, breath_lvl, speech = FAM[fam]
    f = f * 2 ** (detune / 1200)
    n = fast_len(int((dur + rel) * SR) + 64)
    wind = 1 + 0.0006 * smooth_noise(rng, n)              # about +-1 cent of wind instability
    amp = None
    if trem:                                              # tremulant: wind-pressure pulse, ~5.3 Hz
        ph_t = 2 * np.pi * 5.3 * np.arange(n) / SR + rng.uniform(0, 6.28)
        wind = wind + trem * 0.0016 * np.sin(ph_t)
        amp = (1 + trem * 0.07 * np.sin(ph_t + 0.5)).astype(np.float32)
    z = np.exp(1j * (2 * np.pi / SR) * np.cumsum(f * wind)).astype(np.complex64)
    lo = np.zeros(n, np.complex64)
    hi = np.zeros(n, np.complex64)
    tmp = np.empty(n, np.complex64)
    zk = z.copy()
    z2 = None
    nb = min(n, int(speech * 7 * (0.5 + 0.15 * len(parts)) * SR) + 1)
    tb = np.arange(nb, dtype=np.float32) / SR
    for k, a in enumerate(parts, start=1):
        fk = f * k
        if fk > FMAX:
            break
        a = a / np.sqrt(1 + (fk / 6500.0) ** 4)           # voicing: upper partials tamed above ~6.5 kHz
        np.multiply(zk, np.complex64(a * np.exp(1j * rng.uniform(0, 2 * np.pi))), out=tmp)
        tau = speech * (0.5 + 0.15 * k)
        mb = min(nb, int(tau * 7 * SR))
        tmp[:mb] *= 1 - np.exp(-tb[:mb] / tau)
        if k <= 2:
            lo += tmp
        else:
            hi += tmp
        if k == 2:
            z2 = zk.copy()
        zk *= z
    env = envelope(n, dur, att, rel, pts)
    out = lo.imag * env + hi.imag * (env * np.minimum(env, 1.2))
    if chiff and chiff_lvl:
        cl = min(n, int(0.09 * SR))
        ch = unit_noise(rng, cl, min(f * 3, 7000), 4.0) * np.exp(-np.arange(cl) / SR / 0.02)
        out[:cl] += (ch * chiff_lvl * chiff * env[:cl]).astype(np.float32)
    if breath_lvl and z2 is not None:     # breath: noise band around the octave, riding the pipe's own phase
        out += (narrow_noise(rng, n, min(f * 2, 7000) / 3.0) * z2).real * np.float32(breath_lvl * 1.41) * env
    if amp is not None:
        out *= amp
    return out * np.float32(0.3 / RMS[fam])


def music_box(rng, f, vel=1.0):
    """Comb tine: clamped-free beam modes (inharmonic), two tines per note slightly apart (sublime harmonie),
    a soft pin pluck."""
    tau1 = 2.6 * (523.25 / f) ** 0.5
    n = fast_len(int(min(7.0, tau1 * 5 + 0.3) * SR))
    t = np.arange(n) / SR
    out = np.zeros(n)
    modes = [(1.0, 1.0, tau1), (2.0, .035, tau1 * .25), (5.93, .2, .22 * (523.25 / f) ** .3), (16.7, .045, .05)]
    for r, a, tau in modes:
        for det, w in ((-1.3, .55), (1.4, .45)):
            fr = f * r * 2 ** (det / 1200)
            if fr < FMAX:
                out += a * w * np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    na = int(0.0018 * SR)
    out[:na] *= np.sin(0.5 * np.pi * np.arange(na) / na) ** 2
    cl = int(0.004 * SR)
    out[:cl] += O.lp(unit_noise(rng, cl, 4500, 1.2), 7000) * np.exp(-np.arange(cl) / SR / 0.0012) * 0.02
    out[-int(0.2 * SR):] *= np.linspace(1, 0, int(0.2 * SR))
    return (out * vel * 0.17).astype(np.float32)


BELL = [  # (ratio to prime, amplitude, decay relative to the hum)
    (0.5, .5, 1.0), (1.0, .7, .55), (1.2, .5, .45), (1.5, .2, .3), (2.0, 1.0, .36),
    (2.5, .28, .18), (2.67, .2, .15), (3.0, .16, .12), (4.0, .09, .08), (5.33, .045, .055)]


def bell(rng, f, vel=1.0, major=False):
    """Church bell heard from far off: hum, prime, tierce (minor, or a major-third bell), quint, nominal and
    upper partials, each a slowly beating doublet; a soft clapper strike, air absorption."""
    hum_tau = 9.0 * (220.0 / f) ** 0.7
    length = min(14.0, max(6.0, hum_tau * 1.4))
    n = fast_len(int(length * SR))
    t = np.arange(n) / SR
    out = np.zeros(n)
    for r, a, d in BELL:
        if major and r == 1.2:
            r = 1.25
        for split, w in ((-1, .6), (1, .4)):
            fr = f * r + split * rng.uniform(0.15, 0.6)
            if fr < 9000:
                out += a * w * np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28)) * np.exp(-t / (hum_tau * d))
    cl = int(0.05 * SR)
    out[:cl] += unit_noise(rng, cl, min(f * 3, 6000), 1.5) * np.exp(-np.arange(cl) / SR / 0.006) * 0.15
    na = int(0.004 * SR)
    out[:na] *= np.sin(0.5 * np.pi * np.arange(na) / na) ** 2
    out = O.lp(out, 3200, 2)
    out[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR)) ** 2
    return (out * vel * 0.095).astype(np.float32)


def timpani(rng, f, vel=1.0):
    """Low timpani struck with soft felt, half-muffled: the heartbeat."""
    n = fast_len(int(2.2 * SR))
    t = np.arange(n) / SR
    modes = [(1.0, 1.0, .55), (1.504, .45, .38), (1.742, .26, .3), (2.0, .18, .26), (2.245, .09, .2), (2.494, .05, .16)]
    glide = 1 + 0.004 * np.exp(-t / 0.06)
    ph = 2 * np.pi * f * np.cumsum(glide) / SR
    out = sum(a * np.sin(r * ph + rng.uniform(0, 6.28)) * np.exp(-t / d) for r, a, d in modes)
    thump = O.lp(rng.standard_normal(n), 110, 2)
    out += thump / (np.std(thump[: int(0.05 * SR)]) + 1e-9) * np.exp(-t / 0.028) * 0.35
    na = int(0.008 * SR)
    out[:na] *= np.sin(0.5 * np.pi * np.arange(na) / na) ** 2
    out = O.lp(out, 900, 2)
    out[-int(0.3 * SR):] *= np.linspace(1, 0, int(0.3 * SR))
    return (out * vel * 0.4).astype(np.float32)


# ======================================================================================
# a section of the film: dry and reverb-send buses, stereo
# ======================================================================================
PLACE = {  # dry level, reverb send, how much of the pan reaches the reverb
    "organ": (0.36, 0.92, .5),
    "solo": (0.50, 0.80, .5),
    "box": (0.58, 0.46, .6),
    "bell": (0.07, 1.00, .6),
    "timp": (0.55, 0.22, .4),
}


class Sec:
    def __init__(self, name, t0, t1, seed):
        self.name, self.t0, self.t1 = name, t0, t1
        self.start = t0 - PRE
        self.n = int(round((t1 + TAIL - self.start) * SR))
        self.dry = np.zeros((2, self.n), np.float32)
        self.send = np.zeros((2, self.n), np.float32)
        self.rng = np.random.default_rng(seed)

    def put(self, sig, at, place="organ", pan=0.0, gain=1.0):
        i = int(round((at - self.start) * SR))
        if i < 0:
            sig, i = sig[-i:], 0
        m = min(len(sig), self.n - i)
        if m <= 0:
            return
        d, s, sp = PLACE[place]
        x = sig[:m] * np.float32(gain)
        for buf, lvl, p in ((self.dry, d, pan), (self.send, s, pan * sp)):
            th = (np.clip(p, -1, 1) + 1) * np.pi / 4
            buf[0, i:i + m] += x * np.float32(lvl * np.cos(th))
            buf[1, i:i + m] += x * np.float32(lvl * np.sin(th))

    def note(self, nt, at, dur, reg, gain, att=1.0, rel=1.5, pts=None, place="organ", spread=1.0, trem=0.0, chiff=1.0):
        f0, m = hz(nt), midi(nt)
        for fam, foot, lvl in REG[reg]:
            mult = FOOT[foot]
            f = f0 * mult
            while mult >= 3 and f > 4200:      # mixtures and high ranks break back an octave
                f /= 2
            if fam == "celeste":
                p = pan_of(m, "string") * spread
                for det, pp in ((0.0, p), (4.5, -p)):
                    self.put(pipe(self.rng, f, dur, "string", att, rel, pts, det, trem, chiff), at, place, pp, gain * lvl)
            else:
                sig = pipe(self.rng, f, dur, fam, att, rel, pts, 0.0, trem, chiff)
                self.put(sig, at, place, pan_of(m, fam) * spread, gain * lvl)

    def chord(self, notes, at, dur, reg, gain, **kw):
        for nt in notes:
            self.note(nt, at, dur, reg, gain, **kw)

    def line(self, seq, at, reg, gain, legato=0.97, **kw):
        """seq: (note, beats) pairs at 60 BPM; note None is a rest. A final pts list may be given per note."""
        tt = at
        for item in seq:
            nt, d = item[0], item[1]
            extra = dict(kw)
            if len(item) > 2:
                extra.update(item[2])
            if nt:
                self.note(nt, tt, d * legato, reg, gain, **extra)
            tt += d
        return tt

    def box(self, nt, at, vel=0.5, pan=None):
        m = midi(nt)
        self.put(music_box(self.rng, hz(nt), vel), at, "box", (m - 84) / 30 if pan is None else pan)

    def bell(self, nt, at, vel=0.5, major=False, pan=None):
        p = self.rng.uniform(-.3, .3) if pan is None else pan
        self.put(bell(self.rng, hz(nt), vel, major), at, "bell", p)

    def timp(self, nt, at, vel=0.5):
        self.put(timpani(self.rng, hz(nt), vel), at, "timp", 0.05)


MOTIF = [n for n, _ in O.MOTIF]                      # A3 E4 D4 C4, the spark
BEATS = [d for _, d in O.MOTIF]                      # 1 1 1 2


def motif(octave=0, major=False, last=2.0):
    notes = [n[:-1] + str(int(n[-1]) + octave) for n in MOTIF]
    if major:
        notes[3] = "C#" + str(4 + octave)
    return list(zip(notes, BEATS[:3] + [last]))


def prog(S, steps, end, reg, gain, bass_reg="ped", bass_gain=0.18, att=1.6, rel=1.8, overlap=0.4, pts=None):
    """Chord progression: steps = [(time, bass, [notes])]."""
    for i, (at, bass, notes) in enumerate(steps):
        nxt = steps[i + 1][0] if i + 1 < len(steps) else end
        d = nxt - at + overlap
        if bass:
            S.note(bass, at, d, bass_reg, bass_gain, att=att, rel=rel, pts=pts)
        S.chord(notes, at, d, reg, gain, att=att, rel=rel, pts=pts)


# ======================================================================================
# the score, section by section (absolute seconds, as in script.md)
# ======================================================================================
def cold_a(S):
    # 0-14  the 32' bourdon breathes in out of the dark; the ascent swells a celeste A minor (add 9)
    S.note("A2", 0.0, 14.0, "b32", 0.62, att=7.0, rel=2.6, pts=[(0, .4), (7, .7), (14, 1.0)])
    S.note("A2", 2.5, 11.6, "ped", 0.2, att=5.0, rel=2.4)
    S.chord(["A3", "E4", "B4", "C5"], 2.5, 11.8, "cel", 0.085, att=8.0, rel=2.6, pts=[(0, .35), (7, .7), (11.8, 1.0)])
    S.note("E3", 3.0, 11.2, "fl8", 0.07, att=5.0, rel=2.4)
    S.note("E5", 5.5, 8.8, "cel", 0.05, att=4.0, rel=2.4)
    # 6-10  through the clouds: high flutes glitter
    for at, nt, g in [(6.1, "E6", .05), (6.65, "B5", .045), (7.2, "A6", .036), (7.75, "E6", .05), (8.3, "C7", .026),
                      (8.8, "B6", .032), (9.35, "E6", .04), (9.95, "A6", .028), (10.6, "E6", .022)]:
        S.note(nt, at, 0.9, "fl8", g, att=0.12, rel=1.1, place="solo", spread=1.8)
    # 14-19  it descends and opens its eye: F major rises out of the bourdon (the 32' F holds to the cut)
    S.note("F2", 13.4, 13.8, "b32", 0.66, att=3.2, rel=0.5, pts=[(0, .6), (5.6, 1.0), (7.6, .78), (11.6, 1.0), (13.6, 1.3)])
    S.note("F2", 13.8, 5.4, "ped", 0.24, att=2.6, rel=1.6)
    S.chord(["F3", "A3", "C4", "F4", "A4"], 14.0, 4.9, "aether", 0.085, att=3.2, rel=1.8, pts=[(0, .55), (4.9, 1.0)])
    # 19-21.5  it turns to find me; the music holds its breath: one high E over the low pedal
    S.note("E6", 18.6, 3.3, "cel", 0.042, att=1.1, rel=0.9)
    S.note("E5", 18.9, 2.8, "fl8", 0.03, att=1.1, rel=0.8)
    # 21.5  the gaze locks: F major 9 blooms; the motif on a soft principal; 25-27 swell to the peak, cut at 27.0
    sw = [(0, .78), (3.5, .88), (5.5, 1.55)]
    S.note("F2", 21.35, 6.0, "ped", 0.28, att=1.4, rel=0.4, pts=sw)
    S.chord(["F3", "A3", "C4", "E4", "G4"], 21.5, 5.9, "aether", 0.095, att=1.3, rel=0.4, pts=sw)
    S.chord(["C4", "F4", "A4"], 21.7, 5.7, "fl84", 0.06, att=1.3, rel=0.4, pts=sw)
    S.chord(["F4", "C5", "E5"], 24.7, 2.7, "prin", 0.05, att=1.7, rel=0.3, pts=[(0, .4), (2.3, 1.35)])
    S.line([("A4", 1), ("E5", 1), ("D5", 1), ("C5", 2.45, {"pts": [(0, 1.0), (0.4, 1.0), (2.0, 1.45)], "rel": 0.3})],
           22.0, "spr", 0.11, att=0.22, rel=0.9, place="solo", spread=0.4)


def cold_b(S):
    # 27.0 hush (the cut is in the master). 27.6 the pupil's dark lifts: a sea of people looking up
    # C/E -> Dm7 -> Esus4 -> E, layer on layer
    S.note("E2", 27.6, 3.7, "ped", 0.22, att=1.7, rel=1.4)
    S.chord(["E3", "G3", "C4", "E4", "G4"], 27.6, 3.6, "cel", 0.075, att=1.9, rel=1.6)
    S.note("D5", 28.4, 2.8, "fl8", 0.026, att=1.3, rel=1.4)
    S.note("D2", 31.0, 3.8, "ped", 0.24, att=1.4, rel=1.4)
    S.chord(["D3", "A3", "C4", "F4", "A4"], 31.0, 3.8, "cel", 0.08, att=1.5, rel=1.5)
    S.chord(["F4", "A4", "C5"], 31.3, 3.5, "fl84", 0.042, att=1.4, rel=1.5)
    S.note("E2", 34.4, 6.15, "ped", 0.26, att=1.4, rel=0.45, pts=[(0, 1), (4.4, 1), (6.1, 1.4)])
    S.note("E2", 34.6, 5.95, "b32", 0.5, att=2.6, rel=0.4, pts=[(0, .55), (4.2, .8), (5.9, 1.5)])
    S.chord(["E3", "A3", "B3", "E4", "A4"], 34.5, 3.2, "cel", 0.085, att=1.4, rel=1.2)
    S.chord(["B3", "E4", "A4"], 34.7, 3.0, "spr", 0.05, att=1.4, rel=1.2)
    S.chord(["E3", "G#3", "B3", "E4", "G#4", "B4"], 37.5, 3.1, "cel", 0.085, att=1.0, rel=0.35, pts=[(0, .8), (1.3, .9), (3.0, 1.55)])
    # 38.8-40.5 whiteout: the principals breathe in to a crescendo
    S.chord(["E3", "B3", "E4", "G#4", "B4", "E5"], 38.6, 1.95, "chorus", 0.085, att=1.6, rel=0.3, pts=[(0, .3), (1.9, 1.3)])
    # 40.5 the title: A major, soft tutti without reeds; distant bells
    S.note("A2", 40.42, 4.8, "b32", 0.5, att=0.6, rel=3.2)
    S.note("A2", 40.45, 4.8, "ped_open", 0.17, att=0.45, rel=3.2)
    S.chord(["E3", "A3", "C#4", "E4", "A4", "C#5", "E5"], 40.5, 4.4, "chorus", 0.038, att=0.4, rel=3.0)
    S.chord(["A3", "C#4", "E4", "A4", "C#5", "E5"], 40.5, 4.7, "aether", 0.048, att=0.5, rel=3.2)
    S.bell("A3", 40.5, 0.8, major=True, pan=-.15)
    S.bell("E4", 41.25, 0.45, major=True, pan=.25)
    S.bell("A4", 42.1, 0.32, major=True, pan=-.3)
    S.bell("C#5", 43.0, 0.2, major=True, pan=.3)


def ch1(S):
    r = S.rng
    # 47-53 card "I / 세 개의 단어": the spark motif once, on a music box
    for at, notes in [(47.6, ["A5", "A4"]), (48.6, ["E6", "C5"]), (49.6, ["D6", "F5"]), (50.6, ["C6", "E5", "A4"])]:
        for j, nt in enumerate(notes):
            S.box(nt, at + j * 0.012, 0.9 if j == 0 else 0.45)
    S.note("A2", 47.3, 6.0, "ped", 0.11, att=3.0, rel=2.0)
    S.chord(["E4", "A4"], 48.0, 5.4, "cel", 0.032, att=3.0, rel=2.5)
    # 53-65 the marble knight: a sparse flute 4' ostinato, precise but small
    pat = ["A5", None, "E5", None, "C6", None, "B5", "E5"]
    t, i = 53.0, 0
    while t < 72.0:
        nt = pat[i % 8]
        if nt:
            g = 0.065 * min(1, (t - 52.6) / 2.0) * (1 if t < 67 else max(0.0, 1 - (t - 67) / 5))
            S.note(nt, t + r.uniform(-0.004, 0.004), 0.3, "fl8", g, att=0.05, rel=0.3, place="solo", spread=0.6)
        t += 0.5
        i += 1
    S.note("A2", 53.0, 12.5, "ped", 0.12, att=2.0, rel=2.0)
    S.chord(["E4"], 53.5, 11.6, "cel", 0.035, att=3.0, rel=2.0)
    # 65-81 the armillary rings: celeste chords widen warmly, Am -> F -> C
    prog(S, [(65.0, "A2", ["A3", "C4", "E4"]),
             (70.5, "F2", ["F3", "A3", "C4", "F4", "A4"]),
             (76.0, "C3", ["C3", "G3", "C4", "E4", "G4", "C5"])], 81.4, "aether", 0.068, bass_gain=0.17, att=2.2, rel=1.8)
    S.note("E5", 76.5, 4.8, "fl8", 0.03, att=2.0, rel=1.6)
    # 81-91 the staircase of intelligence: a pedal melody climbs one step at a time
    steps = [(81.0, "A2", ["A3", "C4", "E4"]), (83.5, "B2", ["G3", "B3", "D4"]), (86.0, "C3", ["G3", "C4", "E4"]),
             (88.5, "D3", ["F3", "A3", "D4"])]
    for at, bass, notes in steps:
        S.note(bass, at, 2.6, "ped_mel", 0.2, att=0.6, rel=1.0)
        S.chord(notes, at, 2.6, "cel", 0.062, att=1.0, rel=1.2)
    S.note("E3", 91.0, 3.0, "ped_mel", 0.2, att=0.6, rel=1.4)
    # 91-101 the camera looks up: the 32' spreads beneath, a suspended chord hangs open
    S.note("E2", 90.6, 10.0, "b32", 0.56, att=3.6, rel=2.2, pts=[(0, .6), (7, 1.0), (10, .9)])
    S.note("E2", 91.0, 9.5, "ped", 0.18, att=2.0, rel=2.0)
    S.chord(["B2", "E3", "A3", "B3", "E4", "A4", "B4", "D5"], 91.0, 9.6, "aether", 0.062, att=3.0, rel=2.0, pts=[(0, .7), (8, 1.1)])
    S.chord(["A5", "B5"], 95.0, 5.8, "fl8", 0.022, att=3.0, rel=2.0)
    # 101-113 three lights: resolve to A minor, brighten to C major at "the second step", end quietly
    S.note("A2", 101.0, 5.8, "ped", 0.18, att=1.2, rel=2.0)
    S.chord(["A3", "C4", "E4", "A4"], 101.0, 5.6, "cel", 0.07, att=1.2, rel=2.0)
    S.chord(["C4", "E4"], 101.2, 5.4, "spr", 0.034, att=1.4, rel=2.0)
    S.note("C3", 106.5, 6.0, "ped", 0.16, att=1.6, rel=2.5, pts=[(0, 1), (6, .55)])
    S.chord(["C4", "E4", "G4", "C5"], 106.5, 6.0, "aether", 0.07, att=1.6, rel=2.5, pts=[(0, 1), (6, .5)])
    S.note("E5", 106.8, 5.6, "fl8", 0.026, att=1.6, rel=2.4, pts=[(0, 1), (5.6, .5)])


TICKS_CH2 = [120.5 + 0.55 * i for i in range(11)]    # one tiny music-box tone per glyph of 「기계는 생각할 수 있는가?」


def ch2(S):
    # 113-119 card "II / 불씨": a low flute holds
    S.note("A3", 113.2, 7.2, "fl_low", 0.085, att=2.6, rel=2.6)
    S.note("A2", 118.0, 15.6, "ped", 0.11, att=3.0, rel=2.0)
    S.chord(["E4", "A4"], 119.0, 14.2, "cel", 0.03, att=3.0, rel=2.0)
    # 119-133 Turing's question: the motif on a single flute; a tiny music-box tone for each letter
    for at, nt in zip(TICKS_CH2, ["E6", "A6", "C7", "B6", "A6", "E6", "G6", "A6", "C7", "B6", "E7"]):
        S.box(nt, at, 0.3)
    S.line([("A4", 1.2), ("E5", 1.2), ("D5", 1.2), ("C5", 2.6), (None, 0.8),
            ("B4", 1), ("C5", 1), ("D5", 1), ("E5", 2.6)], 121.5, "hfl", 0.075, att=0.25, rel=1.0, place="solo", spread=0.3)
    # 133-147 Dartmouth: principals join and the harmony opens
    prog(S, [(133.0, "A2", ["A3", "C4", "E4", "B4"]), (136.5, "F2", ["F3", "A3", "C4", "G4"]),
             (140.0, "E2", ["G3", "C4", "E4", "G4"]), (143.5, "G2", ["G3", "B3", "D4", "G4"])], 147.4, "cel", 0.062, bass_gain=0.16)
    for i, (at, nt) in enumerate([(133.2, "E5"), (136.5, "C5"), (140.0, "E5"), (143.5, "D5")]):
        S.chord([nt, nt[:-1] + str(int(nt[-1]) - 1)], at, 3.8, "spr", 0.026 + 0.008 * i, att=1.6, rel=1.8)
    # 147-159 the perceptron constellation: hopeful celeste arpeggios, C -> G/B -> Am -> F
    arps = [(147.0, "C3", "C"), (150.0, "B2", "G"), (153.0, "A2", "Am"), (156.0, "F2", "F")]
    for i, (at, bass, c) in enumerate(arps):
        S.note(bass, at, 3.3, "ped", 0.15, att=1.0, rel=1.6)
        S.chord(O.CH[c][1:4], at, 3.3, "fl84", 0.03, att=1.2, rel=1.6)
        for k in range(12):
            nt = O.ARP[c][k % 6]
            S.note(nt, at + 0.25 * k, 1.0, "cel", 0.03 + 0.003 * i, att=0.14, rel=0.9, chiff=0.5)
    # 159-177 winter: the organ drops out; one high music-box tone now and then; cold and empty
    for at, nt, v in [(160.6, "E6", .6), (164.1, "B5", .5), (167.9, "A6", .42), (171.4, "E6", .48), (174.9, "B5", .38)]:
        S.box(nt, at, v)
    # 177-189 the frozen corridor; the king falls at 183.0: one distant bell
    S.note("A2", 177.0, 12.4, "b32", 0.36, att=4.0, rel=3.0)
    S.chord(["E5", "B5"], 178.0, 10.0, "cel", 0.026, att=4.0, rel=3.0)
    S.bell("A2", 183.0, 0.6, pan=0.1)
    # 189-203 the ice melts: spring, F -> C -> G -> Am in celeste and flutes, warm peak at 195
    prog(S, [(189.0, "F2", ["F3", "A3", "C4", "F4", "A4"]), (191.5, "E2", ["G3", "C4", "E4", "G4", "C5"]),
             (193.5, "G2", ["G3", "B3", "D4", "G4", "B4", "D5"])], 195.0, "aether", 0.07, bass_gain=0.18, att=1.4, rel=1.2,
         overlap=0.5)
    S.chord(["F4", "A4", "C5"], 189.3, 5.9, "fl84", 0.035, att=2.5, rel=1.2, pts=[(0, .6), (5.9, 1.1)])
    S.note("A2", 194.8, 6.5, "b32", 0.45, att=1.2, rel=2.6)
    S.note("A2", 195.0, 4.6, "ped", 0.25, att=0.8, rel=2.0)
    S.chord(["A3", "E4", "G4", "B4", "C5", "E5"], 195.0, 4.4, "aether", 0.1, att=0.8, rel=2.2, pts=[(0, 1), (4.4, .8)])
    S.chord(["C4", "E4", "A4"], 195.0, 4.2, "spr", 0.062, att=0.9, rel=2.0)
    S.chord(["A3", "C4", "F4", "A4", "G4"], 199.0, 3.4, "cel", 0.05, att=1.6, rel=2.0, pts=[(0, 1), (3.4, .5)])
    S.note("F2", 199.0, 3.2, "ped", 0.13, att=1.6, rel=2.0)
    S.line([("C5", 2.2), ("E5", 1.0), ("D5", 1.3), ("G5", 1.5, {"pts": [(0, .9), (1.5, 1.15)]}),
            ("E5", 3.0), ("D5", 1.0), ("C5", 2.6)], 189.3, "hfl", 0.06, att=0.3, rel=1.2, place="solo", spread=0.3)


def ch3(S):
    r = S.rng
    # 203-209 card "III / 신의 한 수": the motif on the music box, minor
    for at, notes in [(203.6, ["A5", "A4"]), (204.6, ["E6", "C5"]), (205.6, ["D6", "F5", "A4"]), (206.6, ["C6", "E5", "A4"]),
                      (208.0, ["B5", "E5", "G#4"])]:
        for j, nt in enumerate(notes):
            S.box(nt, at + j * 0.012, 0.8 if j == 0 else 0.4)
    S.note("A2", 204.0, 6.0, "ped", 0.11, att=3.0, rel=2.0)
    # 209-223 the board of light: a low pedal holds, a tense celeste above it
    S.note("A2", 208.6, 22.6, "b32", 0.4, att=3.0, rel=0.8)
    S.note("A2", 209.0, 22.2, "ped", 0.15, att=2.5, rel=0.8)
    tense = [(209.0, ["E4", "F4", "A4"]), (213.5, ["D4", "E4", "A4"]), (218.0, ["E4", "F4", "B4"]),
             (222.5, ["D#4", "E4", "A4"]), (226.0, ["E4", "F4", "G#4", "B4"])]
    for i, (at, notes) in enumerate(tense):
        nxt = tense[i + 1][0] if i + 1 < len(tense) else 231.0
        S.chord(notes, at, nxt - at + 0.5, "cel", 0.044 + 0.005 * i, att=2.2, rel=1.0 if nxt < 231 else 0.3)
    # 223-231 game 2 rushes by: a quiet high flute tremor thickens toward the move
    S.chord(["E5", "F5"], 226.0, 5.1, "cel", 0.03, att=4.0, rel=0.3, pts=[(0, .5), (5, 1.3)])
    # 231.0 move 37: one bell, and the organ chord bursts open (F lydian, the machine's chord)
    S.bell("F3", 231.0, 0.85, major=True, pan=-.1)
    S.note("F2", 230.9, 9.2, "b32", 0.58, att=0.55, rel=2.6)
    S.note("F2", 230.95, 9.2, "ped_open", 0.2, att=0.4, rel=2.6)
    S.chord(["F3", "C4", "G4", "A4", "B4", "E5"], 231.0, 4.6, "aether", 0.085, att=0.35, rel=1.6)
    S.chord(["F3", "A3", "C4", "E4", "G4"], 231.0, 4.6, "chorus", 0.042, att=0.3, rel=1.6)
    S.chord(["C5", "E5", "G5"], 231.05, 4.5, "fl84", 0.04, att=0.35, rel=1.6)
    prog(S, [(235.5, None, ["G3", "B3", "D4", "G4", "B4", "D5"]), (240.0, None, ["F3", "A3", "C4", "E4", "A4"]),
             (243.0, None, ["E3", "G3", "C4", "E4", "G4"])], 245.0, "aether", 0.07, att=1.4, rel=1.6,
         pts=None)
    S.chord(["E2"], 243.0, 2.4, "ped", 0.14, att=1.4, rel=1.6)
    # 245-253 three straight wins, and then: a hush, then the human move
    S.note("A2", 245.0, 3.9, "ped", 0.14, att=1.2, rel=1.4)
    S.chord(["A3", "C4", "E4"], 245.0, 3.9, "cel", 0.055, att=1.5, rel=1.4)
    S.note("F2", 248.5, 2.9, "ped", 0.14, att=1.2, rel=1.2)
    S.chord(["D4", "F4", "A4"], 248.5, 2.9, "cel", 0.055, att=1.2, rel=1.2)
    S.note("E2", 251.0, 2.1, "ped", 0.16, att=1.0, rel=0.5)
    S.chord(["E3", "G#3", "B3", "D4"], 251.0, 2.05, "cel", 0.058, att=0.9, rel=0.5, pts=[(0, .9), (2, 1.2)])
    # 253.0 move 78: a warm, human A major
    S.note("A2", 252.9, 6.0, "b32", 0.48, att=0.8, rel=2.6)
    S.note("A2", 253.0, 6.0, "ped", 0.22, att=0.6, rel=2.6)
    S.chord(["A3", "C#4", "E4", "A4"], 253.0, 4.0, "spr", 0.07, att=0.5, rel=2.0)
    S.chord(["E4", "A4", "C#5", "E5"], 253.0, 4.2, "aether", 0.082, att=0.6, rel=2.2)
    S.line([("C#5", 2.0), ("B4", 1.0), ("A4", 3.0)], 253.0, "hfl", 0.05, att=0.35, rel=1.2, place="solo", spread=0.3)
    S.chord(["D4", "F#4", "A4", "D5"], 257.0, 3.2, "cel", 0.06, att=1.4, rel=1.6)
    S.note("D3", 257.0, 3.2, "ped", 0.13, att=1.4, rel=1.6)
    S.chord(["C#4", "E4", "A4"], 260.0, 3.0, "cel", 0.055, att=1.4, rel=2.2, pts=[(0, 1), (3, .6)])
    S.note("A2", 260.0, 3.0, "ped", 0.13, att=1.4, rel=2.2)
    # 263-275 4 : 1 - the music sinks into one sustained tone
    S.note("A3", 262.2, 12.8, "fl8", 0.075, att=2.5, rel=2.2, pts=[(0, 1), (8, .75), (12.8, .9)])
    S.note("A2", 262.6, 12.4, "ped", 0.085, att=2.5, rel=2.2)
    # 275-289 the transformer: the flute ostinato comes back and quickens
    chords = [(275.0, "A2", ["A3", "C4", "E4"], ["A4", "E5", "C5", "E5"]),
              (278.5, "F2", ["F3", "A3", "C4"], ["F4", "C5", "A4", "C5"]),
              (282.0, "C3", ["G3", "C4", "E4"], ["G4", "E5", "C5", "E5"]),
              (285.5, "G2", ["G3", "B3", "D4"], ["G4", "D5", "B4", "D5"]),
              (289.0, "F2", ["F3", "A3", "C4", "G4"], ["A4", "F5", "C5", "G5"]),
              (293.5, "E2", ["G3", "C4", "E4", "D5"], ["G4", "E5", "C5", "D5"]),
              (298.0, "G2", ["G3", "C4", "D4", "G4"], ["G4", "D5", "C5", "D5"])]
    t, k = 275.0, 0
    while t < 301.5:
        ci = max(i for i, c in enumerate(chords) if c[0] <= t + 1e-6)
        nt = chords[ci][3][k % 4]
        g = 0.034 + 0.03 * min(1, (t - 275) / 16) - (0.03 * (t - 298) / 3.5 if t > 298 else 0)
        S.note(nt, t + r.uniform(-0.003, 0.003), 0.26, "fl84", max(g, 0.01), att=0.04, rel=0.25, place="solo", spread=0.7,
               chiff=0.7)
        iv = 0.5 * (0.2 / 0.5) ** min(1, (t - 275) / 14) if t < 296 else 0.2 + (t - 296) * 0.05
        t += iv
        k += 1
    # 275-289 pads under it, then 289-303 light spreads across the continents: a wide swell, no tutti
    for i, (at, bass, notes, _) in enumerate(chords):
        nxt = chords[i + 1][0] if i + 1 < len(chords) else 302.6
        if at < 289:
            S.note(bass, at, nxt - at + 0.4, "ped", 0.13, att=1.5, rel=1.4)
            S.chord(notes, at, nxt - at + 0.4, "cel", 0.05 + 0.004 * i, att=1.5, rel=1.4)
    swell = [(289.0, "F2", ["F3", "C4", "G4", "A4", "C5", "E5"]), (293.5, "E2", ["E3", "G3", "C4", "E4", "G4", "C5", "D5"]),
             (298.0, "G2", ["G3", "C4", "D4", "G4", "C5", "D5", "G5"])]
    for i, (at, bass, notes) in enumerate(swell):
        nxt = swell[i + 1][0] if i + 1 < len(swell) else 302.4
        lvl = [(0, .75 + .15 * i), (nxt - at, .9 + .15 * i)] if i < 2 else [(0, 1.05), (2.8, 1.2), (4.4, .7)]
        S.note(bass, at, nxt - at + 0.3, "b32", 0.42, att=1.4, rel=1.6, pts=lvl)
        S.note(bass, at, nxt - at + 0.3, "ped", 0.17, att=1.4, rel=1.6, pts=lvl)
        S.chord(notes, at, nxt - at + 0.3, "aether", 0.07, att=1.6, rel=1.6, pts=lvl)
        S.chord(notes[2:5], at, nxt - at + 0.3, "spr", 0.04, att=1.8, rel=1.6, pts=lvl)


TEN_STARS = [354.5 + 0.55 * i for i in range(10)]


def ch4(S):
    # 303-309 card "IV / 문턱": the pedal holds
    S.note("A2", 302.6, 9.7, "ped", 0.17, att=2.2, rel=1.4)
    S.note("A2", 303.0, 9.3, "b32", 0.34, att=3.0, rel=1.4)
    S.note("E4", 304.0, 8.3, "cel", 0.025, att=3.0, rel=1.4)
    # 309-325 montage: each step that lights (312, 317, 322) lifts the harmony one stair
    stairs = [(312.0, "F2", ["F3", "A3", "C4", "F4", "A4"], "C6"),
              (317.0, "G2", ["G3", "B3", "D4", "G4", "B4"], "D6"),
              (322.0, "A2", ["A3", "C4", "E4", "A4", "C5", "E5"], "E6")]
    for i, (at, bass, notes, spark) in enumerate(stairs):
        d = 5.4 if i < 2 else 3.6
        S.note(bass, at, d, "ped", 0.17 + 0.02 * i, att=0.35, rel=1.4)
        S.chord(notes, at, d, "aether", 0.062 + 0.01 * i, att=0.3, rel=1.5)
        S.chord(notes[1:4], at, d, "spr", 0.03 + 0.012 * i, att=0.35, rel=1.5)
        if i == 2:
            S.chord(notes[2:], at, d, "chorus", 0.03, att=0.35, rel=1.6)
        S.note(spark, at, 2.4, "hfl", 0.04, att=0.08, rel=1.6, place="solo", spread=0.4)
    # 325-343 the sealed gate: a low heavy 32' and a suppressed minor, swell box all but shut
    S.note("A2", 324.6, 18.7, "b32", 0.66, att=3.2, rel=1.6, pts=[(0, .8), (12, 1.0), (18.7, .9)])
    gate = [(325.0, ["A2", "E3", "A3", "C4"]), (331.0, ["A2", "F3", "A3", "C4"]), (337.0, ["A2", "D3", "F3", "A3"])]
    for i, (at, notes) in enumerate(gate):
        S.chord(notes, at, 6.4, "dark", 0.055, att=2.4, rel=1.6, pts=[(0, .55), (6.4, .5)])
    S.chord(["C5", "E5"], 334.0, 9.0, "cel", 0.018, att=4.0, rel=1.4)
    # 343-353 Erdos: the handwritten formula burns; the bell at 349.0
    S.note("D2", 343.0, 3.3, "ped", 0.16, att=1.2, rel=1.0)
    S.chord(["D3", "F3", "A3", "D4"], 343.0, 3.3, "cel", 0.06, att=1.2, rel=1.0)
    S.note("E2", 346.0, 3.1, "ped", 0.18, att=1.0, rel=0.5)
    S.chord(["E3", "G#3", "B3", "E4"], 346.0, 3.05, "cel", 0.062, att=1.0, rel=0.5, pts=[(0, .9), (3, 1.25)])
    S.bell("A3", 349.0, 0.75, pan=.12)
    S.note("A2", 348.9, 5.2, "b32", 0.42, att=0.6, rel=2.2)
    S.note("A2", 349.0, 5.0, "ped", 0.18, att=0.5, rel=2.2)
    S.chord(["A3", "C4", "E4", "B4", "E5"], 349.0, 4.8, "aether", 0.068, att=0.5, rel=2.2)
    # 353-363 ten stars: one music-box tone each (354.5 + 0.55 i), then all ten blaze in a chord at 360.5
    S.chord(["A3", "E4"], 352.6, 8.2, "cel", 0.03, att=3.0, rel=1.2)
    S.note("A2", 352.6, 8.2, "ped", 0.08, att=3.0, rel=1.2)
    for at, nt in zip(TEN_STARS, ["E5", "G5", "A5", "C6", "D6", "E6", "G6", "A6", "C7", "D7"]):
        S.box(nt, at, 0.6)
    S.note("F2", 360.4, 5.4, "b32", 0.45, att=0.5, rel=1.8)
    S.note("F2", 360.5, 5.2, "ped", 0.18, att=0.35, rel=1.8)
    S.chord(["F3", "A3", "C4", "E4", "G4"], 360.5, 4.8, "aether", 0.078, att=0.3, rel=1.8)
    S.chord(["C5", "E5", "G5"], 360.5, 4.6, "fl84", 0.04, att=0.3, rel=1.8)
    for j, nt in enumerate(["F5", "A5", "C6", "E6", "G6"]):
        S.box(nt, 360.5 + j * 0.008, 0.5)
    # 363-372 「450」 at 366.0: a bright major chord
    S.note("D3", 365.95, 5.6, "ped_open", 0.3, att=0.35, rel=1.6)
    S.chord(["D3", "A3", "D4", "F#4", "A4", "D5", "F#5"], 366.0, 5.4, "chorus", 0.08, att=0.3, rel=1.6)
    S.chord(["F#4", "A4", "D5", "F#5", "A5"], 366.0, 5.4, "aether", 0.11, att=0.35, rel=1.6)
    S.note("A5", 366.1, 3.0, "hfl", 0.035, att=0.3, rel=1.8, place="solo")
    # 372-379 Navier-Stokes: a celeste swirl narrows over a G pedal toward the blow-up
    S.note("G2", 371.6, 7.6, "b32", 0.5, att=2.0, rel=0.3, pts=[(0, .7), (7.4, 1.3)])
    S.note("G2", 372.0, 7.2, "ped", 0.18, att=1.6, rel=0.3, pts=[(0, .8), (7.0, 1.3)])
    scale = [55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81, 83, 84]
    t, k = 372.0, 0
    while t < 378.95:
        u = (t - 372.0) / 7.0
        span = 9 * (1 - u) + 1
        center = 11 + 2 * u
        idx = int(round(center + (span if k % 2 == 0 else -span) * (0.6 + 0.4 * np.sin(k * 1.7))))
        nt = name_of(scale[int(np.clip(idx, 0, len(scale) - 1))])
        S.note(nt, t, 0.55, "cel", 0.03 + 0.03 * u, att=0.1, rel=0.4, chiff=0.4, spread=1.4)
        t += 0.3 * (0.11 / 0.3) ** u
        k += 1
    S.chord(["F#5", "G5"], 375.0, 3.95, "cel", 0.03, att=2.5, rel=0.12, pts=[(0, .4), (3.9, 1.3)])
    # 379.0 the blow-up bursts: the organ opens wide on C, the chapter's peak
    S.note("C3", 378.95, 7.0, "b32", 0.66, att=0.4, rel=1.6)
    S.note("C3", 379.0, 6.8, "ped_open", 0.34, att=0.3, rel=1.8, pts=[(0, 1), (6.8, .7)])
    S.chord(["C3", "G3", "C4", "E4", "G4", "C5", "E5", "G5"], 379.0, 6.6, "plenum_soft", 0.068, att=0.3, rel=1.8,
            pts=[(0, 1), (6.6, .65)])
    S.chord(["E4", "G4", "C5", "E5"], 379.0, 6.6, "aether", 0.09, att=0.35, rel=1.8, pts=[(0, 1), (6.6, .7)])
    # 386-397 the cathedral doors open: F -> C/E -> Dm7 -> Esus4, layer on layer
    doors = [(386.0, "F2", ["F3", "A3", "C4", "F4", "A4", "C5"]), (389.0, "E2", ["E3", "G3", "C4", "E4", "G4", "C5"]),
             (391.5, "D2", ["D3", "A3", "C4", "F4", "A4", "C5"]), (394.0, "E2", ["E3", "A3", "B3", "E4", "A4", "B4"])]
    for i, (at, bass, notes) in enumerate(doors):
        nxt = doors[i + 1][0] if i + 1 < len(doors) else 397.4
        g = 1 + 0.17 * i
        S.note(bass, at, nxt - at + 0.4, "ped_open", 0.17 * g, att=1.0, rel=1.2)
        S.chord(notes, at, nxt - at + 0.4, "aether", 0.06 * g, att=1.0, rel=1.2)
        S.chord(notes[1:5], at, nxt - at + 0.4, "spr", 0.032 * g, att=1.1, rel=1.2)
    S.note("E2", 394.0, 3.6, "b32", 0.45, att=2.0, rel=1.2)


def rise(S):
    """397-455: over an E pedal, a Shepard-Risset rise on flue pipes: a quickening, endless organ glissando."""
    S.note("E2", 396.8, 58.3, "b32", 0.5, att=3.0, rel=0.3, pts=[(0, .7), (38, 1.0), (58.3, 1.35)])
    S.note("E2", 397.0, 58.1, "ped", 0.2, att=2.0, rel=0.3, pts=[(0, .8), (58.1, 1.4)])
    S.note("E3", 411.0, 44.1, "ped_open", 0.12, att=6.0, rel=0.3, pts=[(0, .5), (44, 1.3)])
    # a high celeste halo (E, B, D, A) breathes in as the registration piles up
    S.chord(["E5", "B5"], 423.0, 32.1, "cel", 0.03, att=8.0, rel=0.3, pts=[(0, .6), (32, 1.4)])
    S.chord(["D6", "A6"], 435.0, 20.1, "cel", 0.02, att=6.0, rel=0.3, pts=[(0, .6), (20, 1.4)])
    mc, sigma = 69.0, 14.0      # spectral bell: centre A4, sigma ~1.2 octaves
    t, s = 397.0, 0
    while t < 454.9:
        u = (t - 397.0) / 58.0
        iv = 1.3 * (0.17 / 1.3) ** min(1.0, u / 0.72)          # fastest from ~439 on
        lvl = 0.045 + 0.06 * min(1.0, u / 0.65) + 0.015 * max(0.0, (u - 0.65) / 0.35)
        regs = ["fl8"] + (["spr"] if t >= 411 else []) + (["cel"] if t >= 423 else []) + (["prin"] if t >= 435 else [])
        d = min(iv * 1.7, 455.05 - t)
        for j in range(8):
            m = 28 + (s % 12) + 12 * j
            w = np.exp(-0.5 * ((m - mc) / sigma) ** 2)
            if w < 0.03 or m > 100:
                continue
            for reg in regs:
                g = lvl * w * {"fl8": 1.0, "spr": .55, "cel": .5, "prin": .35}[reg]
                S.note(name_of(m), t, d, reg, g, att=min(0.3, iv * 0.55), rel=min(0.5, iv * 1.2) if t + d < 455 else 0.05,
                       chiff=0.4, spread=1.2)
        t += iv
        s += 1


def climax(S):
    # 455.0 the rise breaks off: full organ tutti, 32' and bells at once - loud but soft-edged (F, the being's chord)
    S.note("F2", 454.95, 10.3, "b32", 0.8, att=0.4, rel=0.3)
    S.note("F2", 455.0, 10.2, "ped_tutti", 0.55, att=0.25, rel=0.3)
    S.chord(["F2", "C3", "F3", "A3", "C4", "F4", "A4", "C5", "F5"], 455.0, 10.2, "plenum", 0.085, att=0.22, rel=0.3,
            pts=[(0, 1), (5, 1.06), (10, 1.1)])
    S.chord(["A3", "C4", "F4", "A4", "C5"], 455.0, 10.2, "aether", 0.13, att=0.3, rel=0.3)
    S.bell("F3", 455.0, 1.0, major=True, pan=-.2)
    S.bell("C4", 455.3, 0.7, major=True, pan=.25)
    S.bell("A4", 455.75, 0.5, major=True, pan=-.05)
    # the being's ring of eyes opens, one by one: high voices enter
    for at, nt in [(456.5, "G5"), (458.0, "A5"), (459.5, "C6"), (461.0, "E6")]:
        S.note(nt, at, 465.3 - at, "chorus", 0.05, att=0.6, rel=0.3)
        S.note(nt, at, 465.3 - at, "hfl", 0.045, att=0.5, rel=0.3, place="solo")


HEART = [465.55 + k for k in range(4)]


def coda(S):
    # 465-469 four seconds of silence; only a faint heartbeat, soft low timpani, lub-dub
    for T in HEART:
        S.timp("D2", T, 0.09)
        S.timp("D2", T + 0.3, 0.055)
    # 469-475 its eyes look at us: one 32' and one high celeste
    S.note("A2", 469.0, 7.6, "b32only", 0.55, att=2.0, rel=2.4)
    S.note("E6", 469.2, 7.4, "cel", 0.04, att=2.4, rel=2.4)


def ch6(S):
    # 475-480 card "VI / 누가 만드는가": a soft flute; 478 the motif turns major (flute over a soft principal)
    S.note("A2", 474.6, 17.8, "ped", 0.1, att=3.0, rel=2.0)
    S.chord(["E4", "A4"], 475.0, 5.2, "fl8", 0.035, att=2.0, rel=2.0)
    S.chord(["A3", "C#4", "E4"], 477.6, 3.0, "cel", 0.04, att=1.6, rel=1.4)
    S.chord(["F#3", "A3", "D4"], 480.0, 1.6, "cel", 0.04, att=0.8, rel=1.2)
    S.line(motif(1, major=True, last=2.4), 478.0, "spr", 0.065, att=0.3, rel=1.1, place="solo", spread=0.3)
    S.line(motif(1, major=True, last=2.4), 478.0, "fl8", 0.03, att=0.3, rel=1.1, place="solo", spread=0.3, trem=0.6)
    # 480-492 two pillars of light: two celeste voices in dialogue over A -> F#m -> D -> E
    prog(S, [(481.0, "A2", ["A3", "C#4", "E4"]), (483.5, "F#2", ["F#3", "A3", "C#4"]), (486.5, "D2", ["F#3", "A3", "D4"]),
             (489.0, "E2", ["G#3", "B3", "E4"])], 492.0, "cel", 0.035, bass_reg="ped", bass_gain=0.1, att=1.6, rel=1.6)
    S.line([("E5", 1), ("D5", 1), ("C#5", 1.6)], 481.0, "cel", 0.045, att=0.3, rel=1.2, place="solo")
    S.line([("A4", 1), ("B4", 1), ("C#5", 1.6)], 483.8, "hfl", 0.04, att=0.3, rel=1.2, place="solo", trem=0.5)
    S.line([("F#5", 1), ("E5", 1), ("D5", 1.6)], 486.5, "cel", 0.045, att=0.3, rel=1.2, place="solo")
    S.line([("B4", 1), ("C#5", 1), ("D5", 0.6), ("E5", 1.2)], 489.0, "hfl", 0.04, att=0.3, rel=1.2, place="solo", trem=0.5)
    # 492-510 the motif turns major on a soft principal; from 506 a great swell into the end
    bass = [(492.5, "A2", ["A3", "C#4", "E4"]), (493.5, "G#2", ["B3", "E4"]), (494.5, "F#2", ["A3", "D4"]),
            (495.5, "E2", ["A3", "C#4", "E4"]), (497.5, "D2", ["F#3", "A3", "C#4", "E4"]), (499.5, "B1", ["F#3", "A3", "D4"]),
            (500.5, "C#2", ["G#3", "C#4", "E4"]), (501.5, "D2", ["F#3", "A3", "D4"]), (502.5, "E2", ["A3", "B3", "E4"])]
    for i, (at, b, notes) in enumerate(bass):
        nxt = bass[i + 1][0] if i + 1 < len(bass) else 506.2
        S.note(b, at, nxt - at + 0.25, "ped", 0.15, att=0.6, rel=1.0)
        S.chord(notes, at, nxt - at + 0.25, "aether", 0.05, att=0.7, rel=1.1)
    S.note("A2", 492.0, 4.2, "b32", 0.32, att=2.0, rel=2.0)
    S.line(motif(1, major=True) + [("B4", 1), ("C#5", 1), ("D5", 1), ("E5", 3.5, {"pts": [(0, 1), (3.5, 1.2)]})],
           492.5, "spr", 0.085, att=0.3, rel=1.4, place="solo", spread=0.3)
    S.line([("E4", 5.0), ("F#4", 2.0), ("E4", 2.0), ("G#4", 4.5)], 492.5, "fl8", 0.03, att=0.6, rel=1.4, spread=0.5)
    # 506-510 E sus4 -> E, the 32' and the principals swell into the end
    S.note("E2", 505.8, 4.25, "b32", 0.55, att=2.0, rel=0.4, pts=[(0, .5), (4.2, 1.4)])
    S.note("E2", 506.0, 4.05, "ped_open", 0.2, att=1.6, rel=0.4, pts=[(0, .6), (4.0, 1.35)])
    S.chord(["E3", "A3", "B3", "E4", "A4", "B4"], 506.0, 2.0, "aether", 0.065, att=1.0, rel=0.4, pts=[(0, .8), (2, 1.0)])
    S.chord(["E3", "G#3", "B3", "E4", "G#4", "B4", "E5"], 508.0, 2.05, "aether", 0.07, att=0.6, rel=0.35, pts=[(0, 1.0), (2, 1.3)])
    S.chord(["B3", "E4", "G#4", "B4", "E5"], 506.4, 3.65, "chorus", 0.06, att=2.2, rel=0.35, pts=[(0, .35), (3.6, 1.3)])


def end(S):
    # 510 A major soft tutti; distant bells
    S.note("A2", 509.95, 12.3, "b32", 0.6, att=0.6, rel=3.4)
    S.note("A2", 510.0, 12.1, "ped_open", 0.24, att=0.5, rel=3.4, pts=[(0, 1), (12, .65)])
    S.chord(["E3", "A3", "C#4", "E4", "A4", "C#5", "E5"], 510.0, 4.8, "chorus", 0.044, att=0.45, rel=2.2)
    S.chord(["A3", "C#4", "E4", "A4", "C#5", "E5", "A5"], 510.0, 11.8, "aether", 0.058, att=0.5, rel=3.4, pts=[(0, 1), (12, .55)])
    S.bell("A3", 510.0, 0.75, major=True, pan=-.15)
    S.bell("E4", 510.8, 0.42, major=True, pan=.3)
    S.bell("C#5", 511.9, 0.24, major=True, pan=-.3)
    S.bell("A4", 513.4, 0.3, major=True, pan=.1)
    S.bell("E5", 515.6, 0.16, major=True, pan=-.2)
    # 515-521 a plagal amen: D/A -> A
    S.chord(["D4", "F#4", "A4", "D5"], 515.0, 3.2, "spr", 0.04, att=1.4, rel=1.6)
    S.chord(["C#4", "E4", "A4", "C#5"], 518.0, 3.6, "spr", 0.036, att=1.4, rel=2.4, pts=[(0, 1), (3.6, .6)])
    # 522-540 the end screen: the motif once more on the music box, a flute an octave below; fade away
    S.note("A2", 520.0, 15.0, "b32", 0.3, att=3.0, rel=3.0, pts=[(0, 1), (15, .3)])
    S.chord(["A3", "E4", "C#5"], 520.5, 15.5, "cel", 0.04, att=3.0, rel=3.0, pts=[(0, 1), (15.5, .25)])
    S.note("A2", 521.0, 13.0, "ped", 0.07, att=3.0, rel=3.0, pts=[(0, 1), (13, .3)])
    for at, notes in [(523.0, ["A5", "A4"]), (524.0, ["E6", "C#5"]), (525.0, ["D6", "F#5"]), (526.0, ["C#6", "E5", "A4"]),
                      (528.6, ["A5", "E5"])]:
        for j, nt in enumerate(notes):
            S.box(nt, at + j * 0.012, (0.85 if j == 0 else 0.4) * (0.7 if at > 528 else 1.0))
    S.line(motif(1, major=True, last=3.0), 523.0, "hfl", 0.032, att=0.3, rel=1.6, place="solo", spread=0.3)


# section name -> (start, end, composer, master segment)
SECTIONS = {
    "cold_a": (0.0, 27.0, cold_a, "A"),
    "cold_b": (27.0, 47.0, cold_b, "B"),
    "ch1": (47.0, 113.0, ch1, "B"),
    "ch2": (113.0, 203.0, ch2, "B"),
    "ch3": (203.0, 303.0, ch3, "B"),
    "ch4": (303.0, 397.0, ch4, "B"),
    "rise": (397.0, 455.0, rise, "B"),
    "climax": (455.0, 465.0, climax, "C"),
    "coda": (465.0, 475.0, coda, "D"),
    "ch6": (475.0, 510.0, ch6, "D"),
    "end": (510.0, 540.0, end, "D"),
}
# master segments: everything inside one segment shares a reverb pass; a segment may end in a hard cut
# (time, fast fade, residual floor, residual decay), applied after the reverb so the room is cut too
SEGMENTS = {
    "A": (0.0, 27.0, (27.0, 0.10, 0.03, 1.4)),      # 27.0 sudden hush into the pupil
    "B": (27.0, 455.0, (455.0, 0.06, 0.05, 0.6)),    # 455.0 the rise breaks off
    "C": (455.0, 465.0, (465.0, 0.25, 0.02, 1.0)),   # 465.0 tutti to near-total silence
    "D": (465.0, TOTAL, None),
}


def render_section(name):
    t_start = time.time()
    t0, t1, fn, _ = SECTIONS[name]
    S = Sec(name, t0, t1, seed=sum(map(ord, name)) * 7919)
    fn(S)
    return name, S.start, S.dry, S.send, time.time() - t_start


# ======================================================================================
# cathedral, master stage
# ======================================================================================
def cathedral(length=8.0):
    """Synthetic nave: frequency-dependent decay (long lows, air-absorbed highs), diffuse build-up, a few soft early
    reflections, decorrelated left/right. The reverb's sub-bass is trimmed so the 32' stays clear."""
    n = int(length * SR)
    t = np.arange(n) / SR
    f = np.fft.rfftfreq(n, 1 / SR)
    lf = np.log2(np.maximum(f, 1.0))
    xo = [110, 320, 1200, 3000, 6000, 10000]
    rts = [5.6, 6.2, 5.3, 4.2, 2.9, 1.7, 0.8]
    s = [0.5 + 0.5 * np.tanh((lf - np.log2(c)) / 0.35) for c in xo]
    w = [1 - s[0]] + [s[i] - s[i + 1] for i in range(len(xo) - 1)] + [s[-1]]
    shape = 1 / np.sqrt(1 + (50 / np.maximum(f, 1)) ** 4)
    out = np.zeros((2, n))
    for ch in range(2):
        r = np.random.default_rng(301 + ch)
        X = np.fft.rfft(r.standard_normal(n)) * shape
        ir = sum(np.fft.irfft(X * wb, n) * np.exp(-6.91 * t / rt) for wb, rt in zip(w, rts))
        ir *= 1 - np.exp(-t / 0.05)
        pre = int(0.026 * SR)
        ir = np.concatenate([np.zeros(pre), ir])[:n]
        pulse = np.hanning(11)
        for d, a in [(0.012, .45), (0.019, .36), (0.029, .3), (0.041, .25), (0.054, .2), (0.069, .15), (0.086, .12)]:
            k = int((d + r.uniform(-0.002, 0.002)) * SR)
            ir[k:k + 11] += pulse * a * 2.2 * r.choice([-1, 1])
        ir[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))
        out[ch] = ir / np.sqrt(np.sum(ir ** 2))
    return out


def ola_convolve(x, h, block=1 << 19):
    """Overlap-add FFT convolution in blocks (memory stays small for long inputs); output has len(x)."""
    nh = len(h)
    nfft = 1 << int(np.ceil(np.log2(block + nh - 1)))
    H = np.fft.rfft(h, nfft)
    y = np.zeros(len(x) + nh, np.float64)
    for s in range(0, len(x), block):
        seg = x[s:s + block]
        if not np.any(seg):
            continue
        yy = np.fft.irfft(np.fft.rfft(seg, nfft) * H, nfft)[: len(seg) + nh - 1]
        y[s:s + len(yy)] += yy
    return y[: len(x)]


def cut_env(n, t_seg, cut):
    t_cut, fast, floor, decay = cut
    t = t_seg + np.arange(n) / SR
    u = np.clip((t - t_cut) / fast, 0, 1)
    g = 1 - (1 - floor) * np.sin(0.5 * np.pi * u) ** 2
    after = t > t_cut + fast
    g[after] = floor * np.exp(-(t[after] - t_cut - fast) / (decay / 4))
    return g


def k_weighted_power(st):
    """ITU-R BS.1770 K-weighting (48 kHz biquads) applied as a magnitude response; returns per-channel y^2."""
    n = st.shape[1]
    w = 2 * np.pi * np.fft.rfftfreq(n, 1 / SR) / SR
    zi = np.exp(-1j * w)

    def resp(b, a):
        return (b[0] + b[1] * zi + b[2] * zi ** 2) / (a[0] + a[1] * zi + a[2] * zi ** 2)

    H = np.abs(resp([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585])
               * resp([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]))
    del zi, w
    return np.stack([np.fft.irfft(np.fft.rfft(st[c]) * H, n) ** 2 for c in range(st.shape[0])])


def loudness(st):
    """Integrated loudness (LUFS, gated), short-term LRA, and the momentary (400 ms) curve at 100 ms hops."""
    p = k_weighted_power(st).sum(0)
    c = np.concatenate([[0], np.cumsum(p)])
    hop, win = SR // 10, int(0.4 * SR)
    starts = np.arange(0, len(p) - win, hop)
    ms = (c[starts + win] - c[starts]) / win
    lk = -0.691 + 10 * np.log10(ms + 1e-20)
    g = ms[lk > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    integ = -0.691 + 10 * np.log10(np.mean(g[(-0.691 + 10 * np.log10(g)) > rel]))
    win3 = 3 * SR
    st3 = np.arange(0, len(p) - win3, hop)
    s3 = -0.691 + 10 * np.log10((c[st3 + win3] - c[st3]) / win3 + 1e-20)
    s3 = s3[s3 > -70]
    s3 = s3[s3 > 10 * np.log10(np.mean(10 ** (s3 / 10))) - 20]
    lra = np.percentile(s3, 95) - np.percentile(s3, 10)
    return integ, lra, lk


def limiter(st, ceiling, look=0.012, release=0.6):
    """Look-ahead peak limiter with smooth gain; only the loudest moments of the climax should touch it."""
    blk = 48
    nb = st.shape[1] // blk + 1
    pk = np.zeros(nb * blk)
    pk[: st.shape[1]] = np.max(np.abs(st), axis=0)
    pk = pk.reshape(nb, blk).max(1)
    g = np.minimum(1.0, ceiling / np.maximum(pk, 1e-12))
    la = int(look * SR / blk) + 1
    gm = g.copy()                                   # running minimum over the look-ahead window
    for k in range(1, la + 1):
        gm[:-k] = np.minimum(gm[:-k], g[k:])
    if gm.min() >= 1.0:
        return st, 0.0
    coef = np.exp(-blk / (release * SR))
    sm = np.empty_like(gm)
    cur = 1.0
    for i in range(nb):                             # instant attack (on the look-ahead minimum), slow release
        v = gm[i]
        cur = v if v < cur else v + (cur - v) * coef
        sm[i] = cur
    sm = np.convolve(np.concatenate([np.ones(la - 1), sm]), np.ones(la) / la, mode="valid")  # smooth the attack
    sm = np.minimum(sm, g)
    gs = np.interp(np.arange(st.shape[1]) / blk, np.arange(nb), sm)
    return st * gs, -20 * np.log10(sm.min())


def highpass(st, fc=20.0, shelf_db=-4.0, shelf_f=40.0):
    """Zero-phase 20 Hz high-pass plus a gentle low shelf under ~50 Hz."""
    n = st.shape[1]
    f = np.fft.rfftfreq(n, 1 / SR)
    H = 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** 4)
    H *= 10 ** (shelf_db / 20 / (1 + (f / shelf_f) ** 4))
    H[0] = 0
    for c in range(st.shape[0]):
        st[c] = np.fft.irfft(np.fft.rfft(st[c]) * H, n)
    return st


def write_wav24(path, st):
    x = np.clip(st.T, -1, 1)
    q = np.ascontiguousarray(np.round(x * 8388607.0).astype("<i4"))
    b = q.view(np.uint8).reshape(-1, 4)[:, :3]
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(np.ascontiguousarray(b).tobytes())


PLR = 12.6   # peak-to-loudness ceiling: after loudnorm to -15 LUFS the true peak lands near -2.4 dBTP (linear mode)


def main(argv):
    out_path = argv[0]
    only = None
    t_from, t_to, jobs, raw = 0.0, TOTAL, 3, False
    i = 1
    while i < len(argv):
        if argv[i] == "--only":
            only = argv[i + 1].split(",")
        elif argv[i] == "--from":
            t_from = float(argv[i + 1])
        elif argv[i] == "--to":
            t_to = float(argv[i + 1])
        elif argv[i] == "--jobs":
            jobs = int(argv[i + 1])
        elif argv[i] == "--raw":                       # diagnostics: no limiter
            raw = True
            i -= 1
        i += 2
    names = [k for k in SECTIONS if only is None or k in only]
    t_all = time.time()
    order = sorted(names, key=lambda k: -(SECTIONS[k][1] - SECTIONS[k][0]))   # longest first
    results = {}
    if jobs > 1 and len(order) > 1:
        import multiprocessing as mp
        with mp.get_context("fork").Pool(min(jobs, len(order)), maxtasksperchild=1) as pool:
            for name, start, dry, send, dt in pool.imap_unordered(render_section, order):
                print(f"  {name:7s} {dt:6.1f} s", flush=True)
                results[name] = (start, dry, send)
    else:
        for name in order:
            name, start, dry, send, dt = render_section(name)
            print(f"  {name:7s} {dt:6.1f} s", flush=True)
            results[name] = (start, dry, send)
    ir = cathedral().astype(np.float64)
    N = int(round(min(t_to, TOTAL) * SR))          # a test excerpt (--to) only masters what it needs
    master = np.zeros((2, N + int(TAIL * SR)))
    for seg, (s0, s1, cut) in SEGMENTS.items():
        members = [k for k in results if SECTIONS[k][3] == seg]
        if not members:
            continue
        n = int(round((s1 - s0 + TAIL) * SR))
        dry = np.zeros((2, n), np.float64)
        send = np.zeros((2, n), np.float32)
        for k in members:
            start, d, s = results.pop(k)
            off = int(round((start - s0) * SR))
            a = max(0, -off)
            m = min(d.shape[1] - a, n - (off + a))
            dry[:, off + a: off + a + m] += d[:, a:a + m]
            send[:, off + a: off + a + m] += s[:, a:a + m]
        for c in range(2):
            dry[c] += ola_convolve(send[c], ir[c])
        del send
        if cut:
            dry *= cut_env(n, s0, cut)
        i0 = int(round(s0 * SR))
        if i0 >= master.shape[1]:
            continue
        m = min(n, master.shape[1] - i0)
        master[:, i0:i0 + m] += dry[:, :m]
        del dry
    master = highpass(master[:, :N])
    if t_to >= TOTAL:                                       # the last two seconds settle to digital silence
        fo = int(2.0 * SR)
        master[:, -fo:] *= np.cos(0.5 * np.pi * np.linspace(0, 1, fo)) ** 2
    integ, lra, _ = loudness(master)
    gr = 0.0
    for _ in range(0 if raw else 2):
        master, gr = limiter(master, 10 ** ((integ + PLR) / 20))
        integ, lra, _ = loudness(master)
    peak = np.max(np.abs(master))
    gain = 10 ** (-1.0 / 20) / max(peak, 10 ** ((integ + PLR) / 20))
    master *= gain
    integ += 20 * np.log10(gain)
    a, b = int(t_from * SR), int(min(t_to, TOTAL) * SR)
    write_wav24(out_path, master[:, a:b])
    print(f"wrote {out_path}: {(b - a) / SR:.2f} s, I {integ:.1f} LUFS, LRA {lra:.1f} LU, "
          f"peak {20 * np.log10(np.max(np.abs(master)) + 1e-12):.2f} dBFS, limiter {gr:.1f} dB, {time.time() - t_all:.0f} s")


if __name__ == "__main__":
    main(sys.argv[1:])
