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

// ---------- cold open (0–34 s)
function coldOpen(t) {
  if (t < 3) { // a single point of light in the dark
    const cam = CAMF([0, 0, 0], [0, 0, 1], 1.2);
    GL.frame({ name: "space", fs: SHADERS.space, scale: 0.5, uniforms: { uTime: t, ...camUniforms(cam), uA: [0, 0.02, 0.02 + 0.13 * smooth(0.3, 3, t), 0] } },
      { bloom: 0.7, thresh: 0.9, exposure: 0.55 + 0.25 * smooth(0, 3, t), rays: [0.5, 0.52, 0.15 * smooth(1, 3, t)], letterbox: LB, vignette: 0.7, t });
    o.drawImage(GL.canvas, 0, 0);
    return;
  }
  if (t < 27) { // the entity
    const k = t - 3;
    const dist = lerp(6.0, 4.1, easeIO(k / 24)), hgt = lerp(-0.35, -0.95, easeIO(k / 24)), orb = Math.sin(k * 0.05) * 0.7;
    const cam = CAMF([orb, hgt, -dist], [0, 0.25 * (dist / 4.35) * 0.9, 0], 1.25);
    const scale = lerp(0.62, 1.0, 1 - Math.pow(1 - clamp(k / 5), 3));
    const openC = smooth(1.5, 4.6, k), openR = smooth(6, 10, k);
    const core = 0.8 + 2.4 * smooth(17, 24, k), gaze = 1 - smooth(10.5, 12, k);
    const flash = Math.exp(-k / 0.35) * 0.55, white = smooth(22.4, 24, k);
    const q = project({ ...cam }, [0, 0, 0]), rx = q ? q[0] / W : 0.5, ry = q ? 1 - q[1] / H : 0.5;
    GL.frame({ name: "entity", fs: SHADERS.entity, scale: 0.75, uniforms: { uTime: t, ...camUniforms(cam), uA: [openC, scale, core, gaze], uB: [k * 0.22, 0.7, 0, 0], uC: [0, openR, 0, 0] } },
      { bloom: 0.55 + 0.4 * smooth(17, 24, k), thresh: 1.3, exposure: 1.0 + 0.6 * smooth(18, 24, k), rays: [rx, ry, 0.15 + 0.55 * smooth(17, 24, k)], letterbox: LB, vignette: 0.55, lift: Math.min(1, flash + white), t });
    o.drawImage(GL.canvas, 0, 0);
  } else { // title out of the white
    const k = t - 27;
    const cam = CAMF([0, 0, 0], [0, 0, 1], 1.2);
    GL.frame({ name: "space", fs: SHADERS.space, scale: 0.5, uniforms: { uTime: t, ...camUniforms(cam), uA: [0, 0.0, 0.25 * (1 - smooth(0, 4, k)), 0] } },
      { bloom: 0.6, thresh: 1.0, exposure: 0.8, rays: [0.5, 0.5, 0], letterbox: LB, vignette: 0.6, lift: 1 - smooth(0, 1.6, k), fade: 1 - smooth(5.8, 7, k), t });
    o.drawImage(GL.canvas, 0, 0);
    const a = smooth(0.6, 2.2, k) * (1 - smooth(5.6, 6.8, k));
    line("인류의 마지막 발명", W / 2, H / 2 - 30, { size: 92, spacing: 0.3 - 0.06 * ease(k / 4), alpha: a, glow: 24, blur: (1 - a) * 6 });
    o.save(); o.globalAlpha = a * 0.8; o.fillStyle = GOLD; const hw = 160 * smooth(1.0, 2.6, k); o.fillRect(W / 2 - hw, H / 2 + 40, hw * 2, 1); o.restore();
    line("AI의 역사, 그리고 AGI와 ASI", W / 2, H / 2 + 90, { size: 30, spacing: 0.32, color: GOLD, alpha: smooth(1.6, 3.0, k) * (1 - smooth(5.6, 6.8, k)), glow: 8 });
  }
  caption(t, 4.2, 7.8, (a, u) => capT("2026", a, u));
  caption(t, 8.3, 13.6, (a, u) => { capB("우리는 본다.  AGI는 이미 도착했다.", a, u); tag("이 채널의 판단", W - 190, H - BAR / 2, a); });
  caption(t, 14.3, 19.6, (a, u) => { capB("그리고 1~2년 뒤,  그것은 인간을 넘어선다.", a, u); tag("이 채널의 예측", W - 190, H - BAR / 2, a); });
  caption(t, 20.5, 25.4, (a, u) => capB("이것은 그 지능이 태어나기까지의 이야기다", a, u));
}

const SEGMENTS = [[0, 34, coldOpen]];
function drawFrame(t) {
  o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, H); o.fillStyle = "#000"; o.fillRect(0, 0, W, H);
  for (const [t0, t1, fn] of SEGMENTS) if (t >= t0 && t < t1) { fn(t); break; }
  grainOver(Math.floor(t * 24), 0.045);
}
window.renderFrame = t => { drawFrame(t); return out.toDataURL("image/jpeg", 0.95).slice(23); };
