// 「인류의 마지막 발명」 timeline: renderFrame(t) composes the WebGL scene and the caption layer for time t (seconds).
// No letterbox: the picture fills the frame and the words are set into it.
const LB = 0, BAR = 0;
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const easeIO = u => ease(u);
const CAMF = (pos, at, fov = 1.3) => ({ pos, fwd: norm(sub(at, pos)), up: [0, 1, 0], fov });
const camUniforms = c => ({ uCamPos: c.pos, uCamFwd: c.fwd, uCamUp: c.up, uFov: c.fov });

// ---------- type. Captions are not subtitles in a bar: they are big words set into the picture in a heavy sans, the
// important ones in gold, each word landing on its own beat. Markup in caption strings: *gold*, ~small aside~.
let CAP = { t: 0, t0: 0, t1: 1 };                                          // the caption being drawn: now, start, end
function caption(t, t0, t1, draw) {
  if (window.CLEAN || window.NOCAP || t < t0 - 0.01 || t > t1) return;
  const a = smooth(t0, t0 + 0.3, t) * (1 - smooth(t1 - 0.32, t1, t));
  CAP = { t, t0, t1 };
  draw(a, clamp((t - t0) / (t1 - t0)));
}
const easeOut3 = u => 1 - Math.pow(1 - clamp(u), 3);
const easeBack = u => { u = clamp(u); return 1 + 2.6 * Math.pow(u - 1, 3) + 1.6 * Math.pow(u - 1, 2); };
function parseType(s) {                                                    // -> [{t, em, sm} | {sp}]
  const out = [];
  for (const part of s.split(/(\*[^*]+\*|~[^~]+~)/)) {
    if (!part) continue;
    const em = part.length > 2 && part[0] === "*" && part.endsWith("*"), sm = part.length > 2 && part[0] === "~" && part.endsWith("~");
    if (sm) { out.push({ t: part.slice(1, -1), em: false, sm: true }); continue; }   // an aside never breaks across lines
    for (const w of (em ? part.slice(1, -1) : part).split(/(\s+)/)) if (w) out.push(/^\s+$/.test(w) ? { sp: true } : { t: w, em, sm: false });
  }
  return out;
}
// Lay out and animate one block of type. st: { size, y, x (left edge, else centred), font, color, maxW, slam, track, back }
function typeset(s, st = {}) {
  const font = st.font || "SansB", maxW = st.maxW || W * 0.86, track = st.track ?? -0.02, toks = parseType(s);
  let size = st.size || 92;
  const fam = tk => tk.sm ? "SansM" : font, px = tk => Math.round(tk.sm ? size * 0.46 : size);
  const meas = () => { for (const tk of toks) { if (tk.sp) { tk.w = size * 0.28; continue; }
    o.font = `${px(tk)}px "${fam(tk)}"`; o.letterSpacing = `${track * px(tk)}px`; tk.w = o.measureText(tk.t).width; } };
  o.save(); meas();
  const lw = ln => ln.reduce((v, tk) => v + tk.w, 0);
  let lines = [toks];
  if (lw(toks) > maxW || st.lines === 2) {                                 // one break, at the space that best balances the two lines
    let best = null; const total = lw(toks);
    toks.forEach((tk, i) => { if (!tk.sp) return; const w1 = lw(toks.slice(0, i)), m = Math.max(w1, total - w1 - tk.w); if (!best || m < best.m) best = { i, m }; });
    if (best) lines = [toks.slice(0, best.i), toks.slice(best.i + 1)];
  }
  const widest = Math.max(...lines.map(lw)); if (widest > maxW) { size *= maxW / widest; meas(); }
  const lineH = size * 1.16, cy = st.y ?? H * 0.8, y0 = cy - (lines.length - 1) * lineH / 2, cx = st.x ?? W / 2;
  const wMax = Math.max(...lines.map(lw));
  // a soft darkening behind the words: they sit in the picture, not on a bar
  const fadeAll = 1 - clamp((CAP.t - (CAP.t1 - 0.3)) / 0.3), inAll = clamp((CAP.t - CAP.t0) / 0.3);
  if ((st.back ?? 1) > 0) {
    o.save(); o.translate(st.x != null ? cx + wMax / 2 : cx, cy); o.scale((wMax + size * 1.6) / 2, (lines.length * lineH + size * 1.1) / 2);
    const g = o.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, "rgba(0,0,0,0.5)"); g.addColorStop(.6, "rgba(0,0,0,0.3)"); g.addColorStop(1, "rgba(0,0,0,0)");
    o.globalAlpha = (st.back ?? 1) * inAll * fadeAll; o.fillStyle = g; o.beginPath(); o.arc(0, 0, 1, 0, 7); o.fill(); o.restore();
  }
  const words = toks.filter(tk => !tk.sp).length, stagger = Math.min(st.slam ? 0.09 : 0.06, 0.45 / Math.max(words - 1, 1));
  let wi = 0;
  lines.forEach((ln, li) => {
    let x = st.x != null ? cx : cx - lw(ln) / 2; const y = y0 + li * lineH;
    for (const tk of ln) {
      if (tk.sp) { x += tk.w; continue; }
      const p = clamp((CAP.t - CAP.t0 - wi * stagger) / (st.slam ? 0.42 : 0.34)), q = clamp((CAP.t - (CAP.t1 - 0.3)) / 0.3);
      const e = easeOut3(p), sc = (st.slam ? lerp(1.7, 1, easeBack(p)) : lerp(1.35, 1, e)) * (1 + 0.07 * easeOut3(q));
      const al = clamp(p * 1.8) * (1 - q); wi++;
      if (al > 0.002) {
        const fs = px(tk), wx = x + tk.w / 2, wy = y + (tk.sm ? size * 0.12 : 0) + (1 - e) * size * 0.22;
        o.save(); o.globalAlpha = al; o.translate(wx, wy); o.scale(sc, sc); o.translate(-tk.w / 2, 0);
        const bl = (1 - p) * 9 + q * 6; if (bl > 0.4) o.filter = `blur(${bl.toFixed(1)}px)`;
        o.font = `${fs}px "${fam(tk)}"`; o.letterSpacing = `${track * fs}px`; o.textBaseline = "middle"; o.textAlign = "left";
        o.lineJoin = "round"; o.shadowColor = "rgba(0,0,0,0.85)"; o.shadowBlur = fs * 0.32; o.shadowOffsetY = fs * 0.05;
        o.lineWidth = fs * 0.08; o.strokeStyle = "rgba(0,0,0,0.6)"; o.strokeText(tk.t, 0, 0);
        if (tk.em) { const gr = o.createLinearGradient(0, -fs * 0.5, 0, fs * 0.5); gr.addColorStop(0, "#fff0b8"); gr.addColorStop(0.55, "#ffc75a"); gr.addColorStop(1, "#f29a2c");
          o.shadowColor = "rgba(255,165,40,0.6)"; o.shadowBlur = fs * 0.45; o.shadowOffsetY = 0; o.fillStyle = gr; o.fillText(tk.t, 0, 0); }
        else { o.shadowColor = "transparent"; o.fillStyle = tk.sm ? "rgba(244,241,234,0.8)" : (st.color || "#ffffff"); o.fillText(tk.t, 0, 0); }
        if (tk.em) { o.shadowColor = "transparent"; o.fillText(tk.t, 0, 0); }
        o.restore();
      }
      x += tk.w;
    }
  });
  o.restore();
}
// The caption kinds every chapter uses. capB: the line itself (o2.slam: a short blow, huge, mid-frame; o2.y moves it).
// Quotes run a little smaller; attributions ("— ...") are set in gold medium weight; o2.font keeps a display face.
function capB(s, a, u, o2 = {}) {
  if (a <= 0) return;
  if (o2.slam) return typeset(s, { size: o2.size || 170, y: o2.y ?? H * 0.5, slam: true, maxW: W * 0.9, back: 0.8 });
  if (s.startsWith("—") || (o2.size && o2.size < 40)) return typeset(s, { size: 62, y: o2.y ?? H * 0.84, color: "#ffd98a", track: 0, back: 0.85 });
  if (o2.font) return typeset(s, { size: 104, y: o2.y ?? H * 0.8, font: o2.font, color: o2.color || "#f6ead2", track: 0 });
  return typeset(s, { size: s.startsWith("“") ? 82 : 94, y: o2.y ?? H * 0.8 });
}
// capT: the when and where, a gold kicker set top left with a bar that wipes in.
function capT(s, a, u, o2 = {}) {
  if (a <= 0) return;
  const p = easeOut3((CAP.t - CAP.t0) / 0.45), q = clamp((CAP.t - (CAP.t1 - 0.35)) / 0.35), al = p * (1 - q);
  const x = 136 - (1 - p) * 46, y = H * 0.12, fs = o2.size || 66;
  o.save(); o.globalAlpha = al; o.font = `${fs}px "SansB"`; o.letterSpacing = `${fs * 0.03}px`; o.textBaseline = "middle"; o.textAlign = "left";
  o.shadowColor = "rgba(0,0,0,0.85)"; o.shadowBlur = fs * 0.4;
  o.fillStyle = "#ffc75a"; o.fillRect(x - 30, y - fs * 0.5, 9, fs * smooth(0, 1, p));
  o.lineJoin = "round"; o.lineWidth = fs * 0.08; o.strokeStyle = "rgba(0,0,0,0.6)"; o.strokeText(s, x, y);
  o.shadowColor = "transparent"; o.fillStyle = "#ffd98a"; o.fillText(s, x, y);
  o.restore();
}
// a footnote under the line (disclaimers)
function capSmall(s, a, y = H * 0.915) { if (a > 0) typeset(s, { size: 46, y, color: "rgba(255,248,236,0.92)", track: 0, back: 0.9 }); }

// Ring orientations for SHADERS.heavens, column-major mat3 x6 (matches rx*ry*rz in the old GLSL ringM).
function heavensRings(spin) {
  const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; };
  const ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; };
  const rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, -s, c, 0, 0, 0, 1]; };
  const mul = (A, B) => { const R = new Array(9); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { let v = 0; for (let k = 0; k < 3; k++) v += A[k * 3 + i] * B[j * 3 + k]; R[j * 3 + i] = v; } return R; };
  const out = [];
  for (let i = 0; i < 6; i++) out.push(...mul(mul(rx(1.0 + i * 0.83 + spin * (0.05 + i * 0.011)), ry(i * 1.27 + spin * (0.03 - i * 0.008))), rz(i * 0.52)));
  return out;
}
// ---------- shared helpers for every chapter (see CHAPTERS.md)
const FINAL = () => window.QUALITY === "final";
const SC = (pre = 0.55, fin = 1.5) => FINAL() ? fin : pre;               // scene render scale: preview vs final (GPU)
// Clip 2D drawing to the picture area between the letterbox bars.
function pic(fn) { o.save(); o.beginPath(); o.rect(0, BAR, W, H - 2 * BAR); o.clip(); fn(); o.restore(); }
function bars() { o.save(); o.fillStyle = "#000"; o.fillRect(0, 0, W, BAR); o.fillRect(0, H - BAR, W, BAR); o.restore(); }
// Draw the GL canvas onto the 2D layer.
function blit() { o.drawImage(GL.canvas, 0, 0); }
// Chapters register themselves; master.js lays them end to end. fn(k, T): k = seconds into the chapter, T = film time.
const CHAPTERS = {};
function chapter(id, len, fn) { CHAPTERS[id] = { len, fn }; }
// Chapter title card, identical in every chapter: Roman numeral in gold, a hairline, the title in heavy type landing hard.
// k = seconds since the card began.
function chapterCard(k, numeral, title, dur = 6) {
  if (window.NOCAP) return;
  const a = smooth(0.15, 0.7, k) * (1 - smooth(dur - 0.8, dur - 0.1, k));
  if (a <= 0) return;
  const u = clamp(k / dur);
  line(numeral, W / 2, H / 2 - 132, { size: 112, font: "Corm", color: GOLD, spacing: 0.5 - 0.12 * ease(u * 1.4), alpha: a, glow: 26, blur: (1 - a) * 5 });
  o.save(); o.globalAlpha = a * 0.85; o.fillStyle = GOLD; const hw = 230 * smooth(0.4, 1.4, k); o.fillRect(W / 2 - hw, H / 2 - 62, hw * 2, 2); o.restore();
  const saved = CAP; CAP = { t: k, t0: 0.45, t1: dur - 0.1 };
  typeset(title, { size: 196, y: H / 2 + 70, slam: true, maxW: W * 0.88, back: 0.75 });
  CAP = saved;
}
// ---------- cold open (0–47 s): rise through the clouds, the eye descends and fills the frame, then the people below
const CLOUD = [1300, 2300];
const ES = 4200;                                                         // entity scale (great eye radius = 0.66·ES)
// It waits high in the sky; we go to it. Hidden above the frame while we rise through the clouds, then we fly up
// along the line toward it, tilting our gaze up, and it enters from the top of the frame and grows.
const P_TOP = [0, 2900, -1200], E_SKY = [0, 30000, 22000], D_NEAR = 13000;
const S_END = 1 - D_NEAR / Math.hypot(...sub(E_SKY, P_TOP));
const flyPos = k => lerp3(P_TOP, E_SKY, S_END * easeIO(clamp(k / 10.5)));
function eDescent() { return { E: E_SKY }; }
const E_LOW = [0, 4200, 6500];                                           // above the valley, seen from the people
const SOCK_DOWN = norm(sub([0, 0, -200], E_SKY));                         // before it finds you, it watches the valley
const SOCK_CROWD = norm(sub([0, 1.7, -150], E_LOW));
const RING_PHASE = 385.05;                                                // searched: no band crosses the line to the pupil during the dive (17–26.9 s)
// Monotone-ish Catmull-Rom through [time, value] keys.
function keys(K, t) {
  if (t <= K[0][0]) return K[0][1]; if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
  let i = 0; while (t > K[i + 1][0]) i++;
  const [t1, p1] = K[i], [t2, p2] = K[i + 1], p0 = (K[i - 1] || K[i])[1], p3 = (K[i + 2] || K[i + 1])[1], u = (t - t1) / (t2 - t1);
  const m1 = (p2 - p0) / 2, m2 = (p3 - p1) / 2, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
}
const pitchCam = (pos, pitch, yaw = 0, fov = 1.25) => ({ pos, fwd: [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], up: [0, 1, 0], fov });
function worldFrame(t, cam, o2) {
  const E = o2.E, fin = FINAL(), D = Math.hypot(...sub(E, cam.pos));
  const q = project(cam, E), rx = q ? q[0] / W : 0.5, ry = q ? 1 - q[1] / H : 0.9;
  GL.frame({ name: "world", fs: SHADERS.world, scale: fin ? 1.5 : 0.55,
    uniforms: { uTime: t, ...camUniforms(cam), uA: [o2.open, o2.ringOpen, o2.core, 0.6], uB: [o2.ground, o2.gaze, t * 0.01, o2.haze ?? Math.min(1, 14000 / D)], uC: [...E, ES],
      uD: [CLOUD[0], CLOUD[1], fin ? 1 : 0, 0], uK: [o2.city ?? 0, 0, 0, 0], uRing: heavensRings(RING_PHASE + t * 0.04), uSock: o2.sock } },
    { bloom: o2.bloom ?? 0.5, thresh: 1.3, exposure: o2.exposure ?? 1.0, rays: [rx, ry, q ? (o2.rays ?? 0.3) : 0], letterbox: window.CLEAN ? 0 : LB, vignette: 0.6, lift: o2.lift ?? 0, fade: o2.fade ?? 1, t });
  blit();
}
// ---------- 0–14 s: the hook. The answer before the question: its eye. Then Turing's question, 76 years, and the answers
// landing one per flute note of the score (6.1–10.6), each a flash cut to the scene where the film tells it. Then "what
// next?" as we burst up through the clouds into the sky where it waits (14 s, the being's chord).
// [t0, t1, chapter, its k at t0, playback speed, small line above, the line]
const HOOK = [
  [0.00, 0.90, "ch5", 67.2, 0.5, "", ""],
  [0.90, 2.60, "ch2", 12.6, 0.8, "1950 · 앨런 튜링", "기계는 *생각*할 수 있는가?"],
  [2.60, 4.30, "ch5", 21.0, 1.6, "", "*76년* 뒤"],
  [4.30, 6.10, "ch4", 31.2, 0.9, "", "기계가 *답했다*"],
  [6.10, 6.65, "ch2", 70.5, 1.6, "1997", "*체스*"],
  [6.65, 7.20, "ch3", 36.1, 1.6, "2016", "*바둑*"],
  [7.20, 7.75, "ch3", 89.4, 1.6, "2022", "*대화*"],
  [7.75, 8.30, "ch4", 10.5, 1.6, "2023", "*변호사 시험*"],
  [8.30, 8.80, "ch4", 20.1, 1.6, "2025", "*수학 올림피아드*"],
  [8.80, 9.35, "ch4", 29.5, 1.6, "2026", "*27년 된 결함*"],
  [9.35, 9.95, "ch4", 47.0, 1.6, "2026", "*80년 난제*"],
  [9.95, 10.60, "ch4", 64.4, 1.6, "2026", "*수능 만점*"],
  [10.60, 11.30, "ch4", 75.7, 1.2, "2026", "*밀레니엄 난제*"],
];
const CH_START = { ch1: 47, ch2: 113, ch3: 203, ch4: 303, ch5: 405, ch6: 475 };
// draw another chapter's frame at its own k, without its captions, scaled about the centre (a cut's punch-in)
function borrow(id, k, zoom) {
  const c = CHAPTERS[id]; if (!c) return false;
  const was = window.NOCAP; window.NOCAP = true;
  o.save(); o.translate(W / 2, H / 2); o.scale(zoom, zoom); o.translate(-W / 2, -H / 2);
  c.fn(k, CH_START[id] + k);
  o.restore(); window.NOCAP = was; return true;
}
function hook(t) {
  const i = HOOK.findIndex(h => t >= h[0] && t < h[1]); if (i < 0) return;
  const [t0, t1, id, k0, sp, kick, words] = HOOK[i], dt = t - t0;
  const zoom = 1 + 0.08 * Math.exp(-dt / 0.22) + 0.035 * dt / (t1 - t0);          // every cut punches in, then keeps creeping
  if (!borrow(id, k0 + dt * sp, zoom)) { o.fillStyle = "#000"; o.fillRect(0, 0, W, H); }
  if (i > 0) { o.save(); o.globalAlpha = 0.55 * Math.exp(-dt / 0.08); o.fillStyle = "#fff8ec"; o.fillRect(0, 0, W, H); o.restore(); }   // the cut flashes
  if (window.CLEAN) return;
  const saved = CAP, montage = i >= 4;
  CAP = { t, t0: t0 - (montage ? 0.12 : 0), t1: t1 + (montage ? 0.3 : 0) };        // montage words are already landing at the cut
  if (kick) typeset(kick, { size: montage ? 64 : 54, y: montage ? H * 0.5 - 150 : H * 0.5 - 265, font: "SansB", color: "#ffe2a0", track: 0.12, back: 0 });
  if (words) typeset(words, { size: montage ? 200 : 168, y: H * 0.5 + (montage ? 20 : 30), slam: true, maxW: W * 0.88, back: 0.85 });
  CAP = saved;
}
function coldOpen(t) {
  if (t < 11.3) hook(t);
  else if (t < 14) { // A. we burst up through the cloud deck, out under the stars, toward the light that waits above
    const u = (t - 11.3) / 2.7, y = keys([[0, 1250], [0.45, 2350], [0.8, 2800], [1, 2900]], u);
    const pos = [0, y, lerp(-1700, -1200, easeIO(u))];
    const pitch = keys([[0, 0.25], [0.5, 0.12], [0.85, -0.12], [1, -0.18]], u);   // out of the cloud: look down at the sea we left
    worldFrame(t, pitchCam(pos, pitch, 0, 1.25), { E: E_SKY, open: 0, ringOpen: 0, core: 1.5 + 0.4 * u, ground: 0.75, gaze: 0, sock: SOCK_DOWN,
      rays: 0.2, exposure: 1.0 + 0.3 * Math.exp(-(t - 11.3) / 0.25), fade: 1, haze: 1 });
    caption(t, 11.4, 13.85, (a, u2) => capB("*그다음은?*", a, u2, { slam: true }));
  } else if (t < 27) { // B. we fly up toward it; it enters from the top of the frame, opens its eye, finds us; we fall into the pupil
    const k = t - 14, E = E_SKY;
    const pos = flyPos(k);
    const dir0 = norm(sub(E, P_TOP)), drop0 = Math.asin(dir0[1]) + 0.18;
    const dir = norm(sub(E, pos)), drop = drop0 * (1 - smooth(0.4, 6.8, k));     // the gaze lifts from the falling cloud sea up to it
    const pitch = Math.asin(dir[1]) - drop, yaw = Math.atan2(dir[0], dir[2]);
    const fov = 1.25 + 2.25 * easeIn(clamp((k - 9.8) / 2)) + 9 * easeIn(clamp((k - 10.9) / 1.7));
    worldFrame(t, pitchCam(pos, pitch, yaw, fov), { E, open: smooth(2, 5, k), ringOpen: smooth(3, 6.5, k), core: 1.7 + 1.0 * smooth(0, 7, k), ground: 0.75 + 0.5 * smooth(0, 7, k), gaze: smooth(5.2, 7.5, k), sock: SOCK_DOWN,
      haze: lerp(0.55, 1.0, smooth(0, 3, k)),
      rays: 0.35 * (1 - smooth(11, 12.5, k)), exposure: 1.0 + 0.1 * smooth(0, 3, k), fade: 1 - smooth(12.5, 12.98, k) });
  } else if (t < 40.5) { // C. the people: faces lit by it, then the sea of them beneath the eye; white
    const k = t - 27;
    const front = k2 => { const u = easeIO(clamp(k2 / 6.8));            // over the city at night, drifting toward the mountains
      return pitchCam(lerp3([40, 300, -1250], [10, 230, -1060], u), lerp(-0.33, -0.24, u), 0.03, 0.95); };
    const wide = k2 => { const u = easeIO(clamp(k2 / 7.3));
      return pitchCam(lerp3([0, 170, -1200], [0, 230, -1320], u), lerp(0.13, 0.17, u), 0, 0.75); };
    const base = { E: E_LOW, open: 1, ringOpen: 1, gaze: 1, sock: SOCK_CROWD, ground: 0.5, city: 1 };
    const x = smooth(6.2, 6.9, k);                                    // dissolve front -> wide at 33.2–33.9
    if (x < 1) worldFrame(t, front(k), { ...base, core: 1.7, rays: 0, bloom: 0.45, exposure: 1.05, fade: smooth(0.15, 1.8, k) });
    if (x > 0) { o.save(); o.globalAlpha = x; const k2 = k - 6.2, white = smooth(5.3, 7.0, k2 + 0.3);
      worldFrame(t, wide(k2), { ...base, core: 1.6 + 2.0 * smooth(3, 7, k2), rays: 0.35 + 0.4 * smooth(3, 7, k2), bloom: 0.5 + 0.35 * smooth(3, 7, k2), exposure: 1.0 + 0.5 * smooth(4, 7, k2), lift: white });
      o.restore(); }
  } else { // title out of the white
    const k = t - 40.5;
    const cam = CAMF([0, 0, 0], [0, 0, 1], 1.2);
    GL.frame({ name: "space", fs: SHADERS.space, scale: 0.5, uniforms: { uTime: t, ...camUniforms(cam), uA: [0, 0.0, 0.22 * (1 - smooth(0, 5, k)), 0] } },
      { bloom: 0.6, thresh: 1.0, exposure: 0.8, rays: [0.5, 0.5, 0], letterbox: LB, vignette: 0.6, lift: 1 - smooth(0, 1.8, k), fade: 1 - smooth(5.3, 6.5, k), t });
    blit();
    if (!window.CLEAN) {                                                 // the title, in the type of the film
      const saved = CAP; CAP = { t: k, t0: 0.5, t1: 6.2 };
      typeset("인류의 *마지막 발명*", { size: 176, y: H / 2 - 40, slam: true, maxW: W * 0.9, back: 0.6 });
      o.save(); o.globalAlpha = smooth(1.0, 1.8, k) * (1 - smooth(5.4, 6.2, k)) * 0.85; o.fillStyle = GOLD; const hw = 300 * smooth(1.0, 2.2, k); o.fillRect(W / 2 - hw, H / 2 + 78, hw * 2, 2); o.restore();
      CAP = { t: k, t0: 1.5, t1: 6.2 };
      typeset("AI의 과거와 현재, 그리고 미래", { size: 54, y: H / 2 + 150, font: "SansM", color: "#ffe2a0", track: 0.06, back: 0 });
      CAP = saved;
    }
  }
  caption(t, 21.6, 26.4, (a, u) => capB("AGI는 *이미 도착했다*", a, u, { slam: true, y: H * 0.74, size: 150 }));
  caption(t, 28.6, 33.6, (a, u) => capB("그리고 *1~2년* 뒤, 그것은 *인간을 넘어설* 것이다", a, u));
  caption(t, 34.3, 38.9, (a, u) => capB("이것은 그 지능이 *태어나기까지*의 이야기다", a, u));
}
const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
chapter("cold", 47, k => coldOpen(k));
