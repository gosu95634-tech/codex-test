// 「인류의 마지막 발명」 timeline: renderFrame(t) composes the WebGL scene and the caption layer for time t (seconds).
const LB = 0.128, BAR = Math.round(H * LB);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const easeIO = u => ease(u);
const CAMF = (pos, at, fov = 1.3) => ({ pos, fwd: norm(sub(at, pos)), up: [0, 1, 0], fov });
const camUniforms = c => ({ uCamPos: c.pos, uCamFwd: c.fwd, uCamUp: c.up, uFov: c.fov });

// Caption with breath: fades and sharpens in, tracking tightens, then dissolves.
function caption(t, t0, t1, draw) {
  if (window.CLEAN || t < t0 - 0.01 || t > t1) return;
  const a = smooth(t0, t0 + 0.9, t) * (1 - smooth(t1 - 0.9, t1, t));
  const u = clamp((t - t0) / (t1 - t0));
  draw(a, u);
}
const capB = (s, a, u, o2 = {}) => line(s, W / 2, H - BAR / 2, { size: 40, glow: 8, alpha: a, spacing: 0.2 - 0.06 * ease(u * 2), blur: (1 - a) * 4, ...o2 });
const capT = (s, a, u, o2 = {}) => line(s, W / 2, BAR / 2, { size: 26, color: GOLD, glow: 6, alpha: a, spacing: 0.6 - 0.1 * ease(u * 2), blur: (1 - a) * 3, ...o2 });

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
// Chapter title card, identical in every chapter: Roman numeral, hairline, Korean title. k = seconds since the card began.
function chapterCard(k, numeral, title, dur = 6) {
  const a = smooth(0.4, 1.8, k) * (1 - smooth(dur - 1.3, dur - 0.2, k));
  if (a <= 0) return;
  const u = clamp(k / dur);
  line(numeral, W / 2, H / 2 - 62, { size: 84, font: "Corm", color: GOLD, spacing: 0.5 - 0.12 * ease(u * 1.4), alpha: a, glow: 22, blur: (1 - a) * 5 });
  o.save(); o.globalAlpha = a * 0.7; o.fillStyle = GOLD; const hw = 120 * smooth(0.9, 2.6, k); o.fillRect(W / 2 - hw, H / 2 - 4, hw * 2, 1); o.restore();
  line(title, W / 2, H / 2 + 52, { size: 46, spacing: 0.34 - 0.08 * ease(u * 1.4), alpha: a * smooth(0.9, 2.3, k) / Math.max(smooth(0.4, 1.8, k), 1e-3), glow: 14, blur: (1 - a) * 4 });
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
function coldOpen(t) {
  if (t < 14) { // A. the long rise: valley floor, up through the cloud deck, out under the stars; a wrong star burns far above
    const y = keys([[0, 30], [3.5, 380], [6, 1250], [9, 2350], [11.5, 2800], [14, 2900]], t);
    const pos = [lerp(-140, 0, easeIO(t / 14)), y, lerp(-2600, -1200, easeIO(t / 14))];
    const pitch = keys([[0, 0.09], [4, 0.15], [6.5, 0.2], [9.5, 0.1], [12, -0.13], [14, -0.18]], t);   // out of the cloud: look down at the sea we left
    worldFrame(t, pitchCam(pos, pitch, 0, 1.25), { E: E_SKY, open: 0, ringOpen: 0, core: 1.3 + 0.4 * smooth(9, 14, t), ground: 0.75, gaze: 0, sock: SOCK_DOWN,
      rays: 0.2, exposure: 1.15 - 0.15 * smooth(8, 12, t), fade: smooth(0, 3, t), haze: 1 });
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
    const a = smooth(0.8, 2.6, k) * (1 - smooth(5.1, 6.3, k));
    line("인류의 마지막 발명", W / 2, H / 2 - 30, { size: 92, spacing: 0.3 - 0.06 * ease(k / 4), alpha: a, glow: 24, blur: (1 - a) * 6 });
    o.save(); o.globalAlpha = a * 0.8; o.fillStyle = GOLD; const hw = 160 * smooth(1.2, 2.8, k); o.fillRect(W / 2 - hw, H / 2 + 40, hw * 2, 1); o.restore();
    line("AI의 역사, 그리고 AGI와 ASI", W / 2, H / 2 + 90, { size: 30, spacing: 0.32, color: GOLD, alpha: smooth(1.8, 3.2, k) * (1 - smooth(5.1, 6.3, k)), glow: 8 });
  }
  caption(t, 21.6, 26.4, (a, u) => capB("AGI는 이미 도착했다", a, u));
  caption(t, 28.6, 33.6, (a, u) => capB("그리고 1~2년 뒤,   그것은 인간을 넘어설 것이다.", a, u));
  caption(t, 34.3, 38.9, (a, u) => capB("이것은 그 지능이 태어나기까지의 이야기다", a, u));
}
const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
chapter("cold", 47, k => coldOpen(k));
