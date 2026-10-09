"""Generates cues-full.json: the beat map shared by film.html (visual hits) and synth.py (score).

150 BPM, 1 beat = 0.4 s, 256 beats = 1:42.4.
"""
import json
import os

E = []


def ev(b, type_, **kw):
    E.append({"b": b, "type": type_, **kw})


# A. cold open — four flash-forwards, one per beat
for k, ref in enumerate(["mecha", "scouter", "bridge", "final"]):
    ev(k, "cut", s=1.1, ref=ref)
ev(3, "riser", len=1, f0=300, f1=3000)

# A. titles (same as the approved 10 s test)
for b in (4, 5, 6):
    ev(b, "impact", s=1)
ev(7, "impact", s=1.2)
ev(8, "title", s=1)
ev(8, "drone", len=4)
for b, root, s in ((10, 0, .8), (10.5, 2, .85), (11, 3, .9), (11.5, 5, 1)):
    ev(b, "stab", s=s, root=root)
ev(12, "slam", s=1.4)
ev(12, "groove", len=8, prog=["Dm", "Dm", "Bb", "Bb", "C", "C", "A", "A"], style="drive")
ev(16, "impact", s=0.9)
ev(18, "glint", s=1)
ev(20, "roll", len=4)
ev(24, "slam", s=1.6)

# A. reveal pose — "2021"
ev(24, "groove", len=8, prog=["Dm", "Dm", "Bb", "Bb", "C", "C", "A", "A"], style="drive")
ev(28, "impact", s=1)

# B. hero walk — halftime anthem
ev(32, "impact", s=1.1)
ev(32, "groove", len=16, prog=["Dm", "Dm", "Bb", "Bb", "F", "F", "C", "C"] * 2, style="half", melody="anthem")
ev(40, "impact", s=0.9)
ev(44, "riser", len=4, f0=300, f1=4000)

# C. pocket reveals — bright D major bounce
def rummage(b, n):
    ev(b, "rummage", len=n)


rummage(48, 4)
ev(48, "groove", len=4, prog=["Bm"] * 4, style="hats")
for b0, s in ((52, 1.0), (62, 1.1), (72, 1.3)):
    ev(b0, "fanfare", s=s)
    ev(b0, "groove", len=8, prog=["D", "D", "Bm", "Bm", "G", "G", "A", "A"], style="bounce", melody="bounce")
rummage(60, 2)
ev(60, "groove", len=2, prog=["A", "A"], style="hats")
rummage(70, 2)
ev(70, "groove", len=2, prog=["A", "A"], style="hats")
ev(80, "slam", s=1.3)
for b in (82, 84, 86):
    ev(b, "impact", s=1)
ev(80, "groove", len=16, prog=["D", "D", "Bm", "Bm", "G", "G", "A", "A"] * 2, style="drive")
ev(92, "riser", len=4, f0=300, f1=5000)

# D. scouter
ev(96, "scouter", len=12)
for k, b in enumerate((100, 101, 102, 103, 104, 105)):
    ev(b, "count", n=k)
ev(106, "stab", s=1.1, root=0)
ev(108, "stab", s=1.0, root=1)
for b in (109, 110, 111):
    ev(b, "crack", s=1)
ev(112, "explode", s=1.6)
ev(112, "drone", len=8)
ev(112, "heart", s=1)
ev(113, "heart", s=0.8)
ev(116, "riser", len=4, f0=400, f1=6000)

# E. magical transformation
ev(120, "title", s=1.1)
ev(120, "groove", len=32, prog=["D", "D", "A", "A", "Bm", "Bm", "G", "G"] * 4, style="sparkle", melody="sparkle")
for b in (124, 126, 128, 130):
    ev(b, "sparkle", s=1)
for b in (132, 134, 136):
    ev(b, "impact", s=1)
ev(140, "slam", s=1.4)
ev(148, "glint", s=1)
ev(148, "riser", len=4, f0=500, f1=6000)

# F. mecha launch
ev(152, "siren", len=8)
ev(152, "groove", len=16, prog=["Dm"] * 16, style="mecha")
for b in (160, 162, 164, 166):
    ev(b, "check", s=1)
for k, b in enumerate((168, 169, 170)):
    ev(b, "count", n=10 + k)
ev(172, "launch", s=1.6)
ev(172, "groove", len=16, prog=["Dm", "Dm", "Bb", "Bb", "C", "C", "A", "A"] * 2, style="drive")
ev(180, "slam", s=1.3)
ev(188, "riser", len=4, f0=300, f1=6000)

# G. climax — rapid MAD cuts, breakdown, "Claude 5.5", back-to-back pose
ev(192, "groove", len=16, prog=["Dm", "Dm", "Bb", "Bb", "C", "C", "A", "A"] * 2, style="drive", melody="hook")
b = 192.0
while b < 208:
    ev(b, "cut", s=0.9 if b % 1 else 1.1)
    b += 0.5
ev(208, "breakdown", len=8)
ev(208, "heart", s=1)
ev(210, "heart", s=1)
ev(212, "heart", s=1)
ev(214, "roll", len=2)
ev(216, "slam", s=1.8)
ev(216, "groove", len=24, prog=["Dm", "Dm", "Bb", "Bb", "C", "C", "A", "A"] * 3, style="drive", melody="hook")
ev(224, "impact", s=1.2)
for b in (236, 237, 238, 239):
    ev(b, "impact", s=1.0 + (b - 236) * 0.15)

# H. outro
ev(240, "freeze", s=1)
ev(240, "tapestop", len=1.5)
ev(242, "impact", s=0.8)
ev(242, "outro", len=14)
ev(248, "impact", s=0.7)

E.sort(key=lambda e: e["b"])
out = {"bpm": 150, "beats": 256, "events": E}
path = os.path.join(os.path.dirname(__file__), "cues-full.json")
json.dump(out, open(path, "w"), ensure_ascii=False, indent=1)
print(f"wrote {path}: {len(E)} events")
