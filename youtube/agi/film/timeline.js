// 「인류의 마지막 발명」 timeline: renderFrame(t) composes the WebGL scene and the caption layer for time t (seconds).
const LB = 0.128, BAR = Math.round(H * LB);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const easeIO = u => ease(u);
const CAMF = (pos, at, fov = 1.3) => ({ pos, fwd: norm(sub(at, pos)), up: [0, 1, 0], fov });
const camUniforms = c => ({ uCamPos: c.pos, uCamFwd: c.fwd, uCamUp: c.up, uFov: c.fov });

// Caption with breath: fades and sharpens in, tracking tightens, then dissolves.
function caption(t, t0, t1, draw) {
  if (t < t0 - 0.01 || t > t1) return;
  const a = smooth(t0, t0 + 0.9, t) * (1 - smooth(t1 - 0.9, t1, t));
  const u = clamp((t - t0) / (t1 - t0));
  draw(a, u);
}
const capB = (s, a, u, o2 = {}) => line(s, W / 2, H - BAR / 2, { size: 40, glow: 8, alpha: a, spacing: 0.2 - 0.06 * ease(u * 2), blur: (1 - a) * 4, ...o2 });
const capT = (s, a, u, o2 = {}) => line(s, W / 2, BAR / 2, { size: 26, color: GOLD, glow: 6, alpha: a, spacing: 0.6 - 0.1 * ease(u * 2), blur: (1 - a) * 3, ...o2 });

// ---------- cold open (0–40 s): a tiny human on a ridge; the camera lifts its gaze; the being finds the viewer
const ENT = { pos: [0, 2700, 5600], S: 1250 };
function ridgeY(x) { return 1.15 + 0.22 * Math.sin(x * 0.21) + 0.1 * Math.sin(x * 0.9 + 1) - 0.0016 * x * x; }
function drawRidge(cam) {
  const pts = []; for (let x = -60; x <= 60; x += 0.5) { const q = project(cam, [x, ridgeY(x), 14]); if (q) pts.push(q); }
  if (pts.length < 2) return;
  o.save(); o.beginPath(); o.moveTo(pts[0][0], H + 10); pts.forEach(([x, y]) => o.lineTo(x, y)); o.lineTo(pts[pts.length - 1][0], H + 10); o.closePath();
  o.fillStyle = "#020203"; o.fill();
  o.beginPath(); pts.forEach(([x, y], i) => i ? o.lineTo(x, y) : o.moveTo(x, y)); o.strokeStyle = "rgba(255,214,160,0.28)"; o.lineWidth = 1.5; o.stroke(); o.restore();
}
function drawFigure(cam, t) { // a lone figure, head tilted up toward the sky
  const foot = project(cam, [1.4, ridgeY(1.4), 14]), head = project(cam, [1.4, ridgeY(1.4) + 1.75, 14]);
  if (!foot || !head) return;
  const h = foot[1] - head[1], s = h / 560;
  o.save(); o.translate(foot[0], foot[1]); o.scale(s, s);
  const p = new Path2D(), blob = (x, y, rx, ry) => { p.moveTo(x + rx, y); p.ellipse(x, y, rx, ry, 0, 0, 7); };
  p.moveTo(-20, -440); p.bezierCurveTo(-62, -434, -92, -426, -96, -392); p.lineTo(-100, -230); p.lineTo(-86, -228); p.lineTo(-84, -330);
  p.lineTo(-104 - Math.sin(t * 1.3) * 6, -150); p.lineTo(-44, -148); p.lineTo(-40, 0); p.lineTo(-8, 0); p.lineTo(-10, -150);
  p.lineTo(10, -150); p.lineTo(8, 0); p.lineTo(40, 0); p.lineTo(44, -148); p.lineTo(104 + Math.sin(t * 1.3 + 1) * 8, -150); p.lineTo(84, -330);
  p.lineTo(86, -228); p.lineTo(100, -230); p.lineTo(96, -392); p.bezierCurveTo(92, -426, 62, -434, 20, -440); p.closePath();
  p.rect(-15, -458, 30, 24); blob(4, -500, 34, 44);
  o.shadowColor = "rgba(255,210,150,0.7)"; o.shadowBlur = 14; o.strokeStyle = "rgba(255,220,170,0.55)"; o.lineWidth = 5; o.stroke(p);
  o.shadowBlur = 0; o.fillStyle = "#010102"; o.fill(p); o.restore();
}
function coldOpen(t) {
  if (t < 33) {
    const eye = [0, 0.9, 0];
    const lookA = [0, 26, 100], lookB = ENT.pos;
    const tilt = easeIO(clamp((t - 4.5) / 7.5));
    const dir = norm(sub(lerp3(lookA, lookB, tilt), eye));
    const fov = 1.2 + 0.75 * easeIO(clamp((t - 12) / 9)) + 0.15 * clamp((t - 21) / 12);
    const cam = { pos: eye, fwd: dir, up: [0, 1, 0], fov };
    const eyeOpen = smooth(12, 15.5, t), ringOpen = smooth(8.5, 12.5, t), gaze = smooth(16, 18.6, t);
    const core = 1.0 + 1.6 * smooth(27, 32.5, t), white = smooth(31.2, 33, t);
    const q = project(cam, ENT.pos), rx = q ? q[0] / W : 0.5, ry = q ? 1 - q[1] / H : 0.9;
    GL.frame({ name: "heavens", fs: SHADERS.heavens, scale: 0.7, uniforms: { uTime: t, ...camUniforms(cam), uA: [eyeOpen, ringOpen, core, 0.6], uB: [t * 0.06, gaze, t * 0.012, 1.0], uC: [...ENT.pos, ENT.S] } },
      { bloom: 0.45 + 0.35 * smooth(27, 32, t), thresh: 1.4, exposure: 0.95 + 0.6 * smooth(28, 33, t), rays: [rx, ry, 0.2 + 0.45 * smooth(26, 32, t)], letterbox: LB, vignette: 0.65, lift: white, t });
    o.drawImage(GL.canvas, 0, 0);
    if (tilt < 0.98) { o.save(); o.beginPath(); o.rect(0, BAR, W, H - 2 * BAR); o.clip(); drawRidge(cam); drawFigure(cam, t); o.restore(); }
  } else { // title out of the white
    const k = t - 33;
    const cam = CAMF([0, 0, 0], [0, 0, 1], 1.2);
    GL.frame({ name: "space", fs: SHADERS.space, scale: 0.5, uniforms: { uTime: t, ...camUniforms(cam), uA: [0, 0.0, 0.22 * (1 - smooth(0, 5, k)), 0] } },
      { bloom: 0.6, thresh: 1.0, exposure: 0.8, rays: [0.5, 0.5, 0], letterbox: LB, vignette: 0.6, lift: 1 - smooth(0, 1.8, k), fade: 1 - smooth(5.8, 7, k), t });
    o.drawImage(GL.canvas, 0, 0);
    const a = smooth(0.8, 2.6, k) * (1 - smooth(5.6, 6.8, k));
    line("인류의 마지막 발명", W / 2, H / 2 - 30, { size: 92, spacing: 0.3 - 0.06 * ease(k / 4), alpha: a, glow: 24, blur: (1 - a) * 6 });
    o.save(); o.globalAlpha = a * 0.8; o.fillStyle = GOLD; const hw = 160 * smooth(1.2, 2.8, k); o.fillRect(W / 2 - hw, H / 2 + 40, hw * 2, 1); o.restore();
    line("AI의 역사, 그리고 AGI와 ASI", W / 2, H / 2 + 90, { size: 30, spacing: 0.32, color: GOLD, alpha: smooth(1.8, 3.2, k) * (1 - smooth(5.6, 6.8, k)), glow: 8 });
  }
  caption(t, 19.0, 24.0, (a, u) => capB("우리는 본다.   AGI는 이미 도착했다.", a, u));
  caption(t, 24.5, 29.3, (a, u) => capB("그리고 1~2년 뒤,   그것은 인간을 넘어설 것이다.", a, u));
  caption(t, 29.7, 33.0, (a, u) => capB("이것은 그 지능이 태어나기까지의 이야기다", a, u));
}
const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

const SEGMENTS = [[0, 40, coldOpen]];
function drawFrame(t) {
  o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, H); o.fillStyle = "#000"; o.fillRect(0, 0, W, H);
  for (const [t0, t1, fn] of SEGMENTS) if (t >= t0 && t < t1) { fn(t); break; }
  grainOver(Math.floor(t * 24), 0.045);
}
window.renderFrame = t => { drawFrame(t); return out.toDataURL("image/jpeg", 0.95).slice(23); };
