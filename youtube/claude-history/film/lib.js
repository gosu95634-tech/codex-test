// 「아모데이의 모험」 drawing library: utils, manga effects, characters. Everything is a pure function of its inputs.
const W = 1920, H = 1080;
const INK = "#0b0b0d", PAPER = "#f2eee6", ORANGE = "#ff6a1f", EMBER = "#ffb070", DIM = "#8a847c";
const BRIDGE = "#e0452b", ROSE = "#ff5fa2", HUD = "#ff7a3a";
let CUES = { bpm: 150, events: [] }, SPB = 0.4;

function setCues(c) {
  SPB = 60 / c.bpm;
  const ev = [...c.events];
  for (const e of c.events) if (e.type === "groove" || e.type === "roll") for (let k = 0; k < e.len; k++) ev.push({ b: e.b + k, type: "beat", s: 0.6 });
  CUES = { ...c, events: ev };
}

// ---------- utils
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const easeOut = u => 1 - Math.pow(1 - clamp(u), 3);
const easeIn = u => Math.pow(clamp(u), 3);
const easeInOut = u => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const easeOutBack = u => { u = clamp(u); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
const easeOutElastic = u => { u = clamp(u); return u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI / 3)) + 1; };
function env(t, types, k = 8) { let v = 0; for (const e of CUES.events) { if (!types.includes(e.type)) continue; const te = e.b * SPB; if (t >= te && t - te < 3) v += (e.s || 1) * Math.exp(-(t - te) * k); } return v; }
function since(t, types) { let best = Infinity, ev = null; for (const e of CUES.events) { if (!types.includes(e.type)) continue; const d = t - e.b * SPB; if (d >= 0 && d < best) { best = d; ev = e; } } return [best, ev]; }

function txt(ctx, s, x, y, o = {}) {
  const { font = "Serif", size = 200, sx = 1, align = "center", base = "middle", fill = PAPER, stroke = null, lw = 0, ls = 0, alpha = 1, rot = 0, join = "round" } = o;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sx, 1);
  ctx.font = `${size}px "${font}"`; ctx.textAlign = align; ctx.textBaseline = base; ctx.letterSpacing = ls + "px";
  if (stroke) { ctx.lineJoin = join; ctx.miterLimit = 3; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(s, 0, 0); }
  if (fill) { ctx.fillStyle = fill; ctx.fillText(s, 0, 0); }
  ctx.restore();
}
const card = (ctx, s, x, y, size, o = {}) => txt(ctx, s, x, y, { size, stroke: o.fill || PAPER, lw: size * 0.014, sx: 0.82, join: "miter", ...o });
// Manga slam text: thick ink outline + optional orange outer glow outline.
function slamText(ctx, s, x, y, size, o = {}) {
  const { font = "Impact", fill = PAPER, sx = 1, outer = ORANGE, rot = 0, alpha = 1 } = o;
  if (outer) txt(ctx, s, x, y, { font, size, sx, fill: null, stroke: outer, lw: size * 0.24, rot, alpha, join: "round" });
  txt(ctx, s, x, y, { font, size, sx, fill: null, stroke: INK, lw: size * 0.12, rot, alpha, join: "round" });
  txt(ctx, s, x, y, { font, size, sx, fill, rot, alpha });
}
function measure(ctx, s, font, size) { ctx.save(); ctx.font = `${size}px "${font}"`; const w = ctx.measureText(s).width; ctx.restore(); return w; }

// ---------- manga effects
function focusLines(ctx, cx, cy, n, inner, seed, alpha = 0.9, color = PAPER) {
  const r = rng(seed); ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, w = 0.004 + r() * 0.012, ri = inner * (0.85 + r() * 0.6), ro = 1700;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - w) * ro, cy + Math.sin(a - w) * ro);
    ctx.lineTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri * 0.62);
    ctx.lineTo(cx + Math.cos(a + w) * ro, cy + Math.sin(a + w) * ro);
    ctx.fill();
  }
  ctx.restore();
}
function speedLinesH(ctx, n, seed, alpha = 0.6, color = PAPER, dir = 1, t = 0) { // horizontal motion streaks
  const r = rng(seed); ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) { const y = r() * H, len = 300 + r() * 900, x = ((r() * W * 2 + t * 6000 * dir) % (W * 2)) - W * 0.5, h = 1 + r() * 4; ctx.fillRect(dir > 0 ? x : W - x, y, len, h); }
  ctx.restore();
}
function speedLinesV(ctx, n, seed, alpha = 0.6, color = PAPER, t = 0) {
  const r = rng(seed); ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) { const x = r() * W, len = 200 + r() * 700, y = ((r() * H * 2 + t * 5000) % (H * 2)) - H * 0.5, w = 1 + r() * 5; ctx.fillRect(x, H - y, w, len); }
  ctx.restore();
}
function halftoneBurst(ctx, cx, cy, R, amt, rot, color = ORANGE, sp = 34) {
  ctx.save(); ctx.fillStyle = color;
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let gy = -H * 0.6; gy <= H * 1.6; gy += sp) for (let gx = -W * 0.3; gx <= W * 1.3; gx += sp) {
    const x = cx + (gx - cx) * c - (gy - cy) * s, y = cy + (gx - cx) * s + (gy - cy) * c;
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    const d = Math.hypot(x - cx, (y - cy) * 1.4), rr = (1 - d / R) * sp * 0.62 * amt;
    if (rr > 0.6) { ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
function halftoneWipe(ctx, p, ox, oy, color = INK) {
  const sp = 48; ctx.save(); ctx.fillStyle = color;
  for (let y = 0; y <= H + sp; y += sp) for (let x = (y / sp) % 2 ? sp / 2 : 0; x <= W + sp; x += sp) {
    const d = Math.hypot(x - ox, y - oy) / 2200, rr = clamp((1 - p * 1.6 + d) * 1.2) * sp * 0.75;
    if (rr > 0.5) { ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
function sunburst(ctx, cx, cy, n, rot, c1, c2) {
  ctx.save(); ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H); ctx.fillStyle = c2;
  for (let i = 0; i < n; i++) { const a0 = rot + (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 2400, a0, a1); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function menace(ctx, x, y, size, t, born, seed, glyph = "ゴ") { // JoJo-style menacing glyph
  const age = t - born; if (age < 0) return;
  const r = rng(seed), pop = easeOutBack(age / 0.18), wob = Math.sin(t * 9 + r() * 6) * 0.06;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12 + wob); ctx.scale(pop * (1 + 0.04 * Math.sin(t * 14 + seed)), pop);
  txt(ctx, glyph, 0, 0, { font: "Dela", size, fill: null, stroke: ORANGE, lw: size * 0.16 });
  txt(ctx, glyph, 0, 0, { font: "Dela", size, fill: PAPER, stroke: INK, lw: size * 0.07 });
  ctx.restore();
}
function menaceRing(ctx, t, born, spots, scale = 1, seed0 = 1, glyph = "ゴ") { spots.forEach(([x, y, s], k) => menace(ctx, x, y, s * scale, t, born + k * 0.5 * SPB, seed0 + k, glyph)); }
const MENACE_SPOTS = [[250, 230, 190], [1680, 210, 170], [210, 860, 170], [1700, 850, 200], [560, 120, 120], [1360, 960, 130]];
function star4(ctx, x, y, r, rot = 0, color = "#fff8ee") {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.quadraticCurveTo(Math.cos(a - Math.PI / 4) * r * 0.18, Math.sin(a - Math.PI / 4) * r * 0.18, Math.cos(a) * r, Math.sin(a) * r); }
  ctx.quadraticCurveTo(Math.cos(-Math.PI / 4) * r * 0.18, Math.sin(-Math.PI / 4) * r * 0.18, r, 0); ctx.fill(); ctx.restore();
}
function starFlare(ctx, x, y, s, alpha = 1) {
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = alpha;
  const grd = ctx.createRadialGradient(x, y, 0, x, y, 90 * s); grd.addColorStop(0, "rgba(255,240,220,1)"); grd.addColorStop(0.25, "rgba(255,150,80,0.6)"); grd.addColorStop(1, "rgba(255,106,31,0)");
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, 90 * s, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff8ee";
  const spike = (len, wid, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(0, -wid, len, 0); ctx.quadraticCurveTo(0, wid, -len, 0); ctx.fill(); ctx.restore(); };
  spike(520 * s, 7 * s, 0); spike(160 * s, 6 * s, Math.PI / 2); spike(90 * s, 4 * s, Math.PI / 4); spike(90 * s, 4 * s, -Math.PI / 4);
  ctx.restore();
}
function sparkles(ctx, cx, cy, R, n, t, seed, color = "#fff8ee", size = 22) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = R * (0.3 + r() * 0.9), ph = r() * 6.28, sp = 2 + r() * 4;
    const tw = Math.max(0, Math.sin(t * sp + ph)); if (tw < 0.05) continue;
    star4(ctx, cx + Math.cos(a + t * 0.2) * d, cy + Math.sin(a + t * 0.2) * d * 0.8, size * tw * (0.5 + r()), t * 0.5 + ph, color);
  }
}
function shards(ctx, cx, cy, age, seed, n = 46, color = PAPER) {
  const r = rng(seed); ctx.save();
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, v = 900 + r() * 2200, rot = (r() - 0.5) * 18, sz = 18 + r() * 70, d = v * age - 300 * age * age;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d + 500 * age * age;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot * age + a); ctx.globalAlpha = clamp(1.4 - age);
    ctx.fillStyle = i % 3 ? color : ORANGE; ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.6, sz * 0.5); ctx.lineTo(-sz * 0.5, sz * 0.3); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
function cracks(ctx, cx, cy, level, seed, color = PAPER) {
  const r = rng(seed); ctx.save(); ctx.strokeStyle = color; ctx.lineCap = "round";
  const n = Math.floor(level * 9);
  for (let i = 0; i < n; i++) {
    let x = cx, y = cy, a = r() * 6.28; ctx.lineWidth = 5 - i * 0.3; ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 6 + r() * 8;
    for (let k = 0; k < steps; k++) { a += (r() - 0.5) * 0.9; const L = 30 + r() * 70; x += Math.cos(a) * L; y += Math.sin(a) * L; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
}
function smoke(ctx, cx, cy, t, seed, n = 18, alpha = 0.5) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, sp = 60 + r() * 140, rr = 120 + r() * 220 + t * 80, x = cx + Math.cos(a) * sp * t * 2, y = cy + Math.sin(a) * sp * t - t * 60;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(60,55,52,${alpha * (0.6 + r() * 0.4)})`); gr.addColorStop(1, "rgba(60,55,52,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
  }
}
function glow(ctx, x, y, r, color, a = 1) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color.replace("ALPHA", a)); gr.addColorStop(1, color.replace("ALPHA", 0));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
// Narration caption box (manga panel box) and speech bubble.
function captionBox(ctx, text, x, y, size, o = {}) {
  const { align = "left", font = "SansB", bg = PAPER, fg = INK, alpha = 1, tag = null } = o;
  const w = measure(ctx, text, font, size) + size * 1.2, h = size * 1.7, x0 = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = INK; ctx.fillRect(x0 + 10, y - h / 2 + 10, w, h);
  ctx.fillStyle = bg; ctx.fillRect(x0, y - h / 2, w, h); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.strokeRect(x0, y - h / 2, w, h);
  txt(ctx, text, x0 + w / 2, y + size * 0.04, { font, size, fill: fg });
  if (tag) txt(ctx, tag, x0 + w, y + h / 2 + size * 0.55, { font: "SansM", size: size * 0.4, align: "right", fill: DIM });
  ctx.restore();
}
function bubble(ctx, text, x, y, size, tailX, tailY, o = {}) {
  const { font = "SansB", tag = "(패러디 대사)" } = o;
  const w = measure(ctx, text, font, size) + size * 1.6, h = size * 2.2;
  ctx.save(); ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, 7);
  ctx.moveTo(x - size * 0.4, y + h * 0.38); ctx.lineTo(tailX, tailY); ctx.lineTo(x + size * 0.3, y + h * 0.42);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y, w / 2 - 3, h / 2 - 3, 0, 0, 7); ctx.fill();
  txt(ctx, text, x, y + size * 0.04, { font, size, fill: INK });
  if (tag) txt(ctx, tag, x, y + h / 2 + size * 0.45, { font: "SansM", size: size * 0.38, fill: PAPER, stroke: INK, lw: 4 });
  ctx.restore();
}

// ---------- characters
// Amodei caricature in manga silhouette. Origin at feet, 560 units tall. arm: 0 = down, 1 = raised overhead (right arm).
function darioPath(t, o = {}) {
  const { arm = 0, wind = 1 } = o;
  const p = new Path2D(), fl = Math.sin(t * 7) * 9 * wind, fl2 = Math.sin(t * 7 + 1.3) * 18 * wind;
  const blob = (x, y, rx, ry) => { p.moveTo(x + rx, y); p.ellipse(x, y, rx, ry, 0, 0, 7); };
  p.moveTo(-22, -446); p.bezierCurveTo(-70, -440, -104, -432, -112, -404);
  p.lineTo(-126, -238); p.lineTo(-104, -232); p.lineTo(-100, -330);
  p.lineTo(-132 - fl, -150); p.lineTo(-50, -146);
  p.lineTo(-46, -8); p.lineTo(-70, 0); p.lineTo(-12, 0); p.lineTo(-14, -150);
  p.lineTo(14, -150); p.lineTo(12, 0); p.lineTo(70, 0); p.lineTo(46, -8); p.lineTo(50, -146);
  p.lineTo(132, -150); p.lineTo(214 + fl2 * 1.4, -196 + fl * 0.8); p.lineTo(104, -330);
  if (arm > 0) { // right arm swings up: shoulder pivot at (104,-410)
    const a = lerp(Math.PI * 0.5, -Math.PI * 0.42, arm), L1 = 120, L2 = 115, ex = 104 + Math.cos(a) * L1, ey = -410 + Math.sin(a) * L1;
    const a2 = a - 0.25 * arm, hx = ex + Math.cos(a2) * L2, hy = ey + Math.sin(a2) * L2, nx = Math.cos(a + Math.PI / 2) * 17, ny = Math.sin(a + Math.PI / 2) * 17;
    p.lineTo(110, -300); p.lineTo(ex - nx, ey - ny); p.lineTo(hx - nx, hy - ny); p.lineTo(hx + nx * 1.4, hy + ny * 1.4); p.lineTo(ex + nx, ey + ny); p.lineTo(112, -404);
  } else { p.lineTo(104, -232); p.lineTo(126, -238); p.lineTo(112, -404); }
  p.bezierCurveTo(104, -432, 70, -440, 22, -446); p.closePath();
  p.rect(-17, -462, 34, 22);
  blob(0, -500, 38, 48);
  blob(-38, -498, 8, 12); blob(38, -498, 8, 12);
  const r = rng(11);
  for (let a = Math.PI * 0.96; a <= Math.PI * 2.04; a += 0.27) { const rr = 13 + r() * 9, d = 42 + r() * 8, sway = Math.sin(t * 6 + a * 3) * 2.5 * wind; blob(Math.cos(a) * d + sway, -514 + Math.sin(a) * (d * 0.92), rr, rr * (0.85 + r() * 0.3)); }
  for (let a = Math.PI * 1.18; a <= Math.PI * 1.82; a += 0.32) { const rr = 12 + r() * 7; blob(Math.cos(a) * 24, -534 + Math.sin(a) * 26, rr, rr); }
  return p;
}
function handPos(arm) { const a = lerp(Math.PI * 0.5, -Math.PI * 0.42, arm), ex = 104 + Math.cos(a) * 120, ey = -410 + Math.sin(a) * 120, a2 = a - 0.25 * arm; return [ex + Math.cos(a2) * 115, ey + Math.sin(a2) * 115]; }
function drawDario(ctx, cx, footY, h, t, o = {}) {
  const s = h / 560; ctx.save(); ctx.translate(cx, footY); ctx.scale(o.flip ? -s : s, s);
  const p = darioPath(t, o);
  ctx.save(); ctx.shadowColor = o.rimColor || ORANGE; ctx.shadowBlur = 40; ctx.strokeStyle = o.rim || EMBER; ctx.lineWidth = 7; ctx.stroke(p); ctx.restore();
  ctx.fillStyle = INK; ctx.fill(p);
  // inner rim-light contours give the silhouette form: lapels, coat opening, belt, arm edges
  ctx.save(); ctx.strokeStyle = "rgba(255,176,112,0.32)"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-22, -446); ctx.lineTo(-6, -372); ctx.lineTo(0, -310); ctx.moveTo(22, -446); ctx.lineTo(6, -372); ctx.lineTo(0, -310);
  ctx.moveTo(0, -310); ctx.lineTo(5, -152);
  ctx.moveTo(-98, -300); ctx.lineTo(98, -300);
  ctx.moveTo(-100, -404); ctx.lineTo(-101, -240);
  if (!(o.arm > 0)) { ctx.moveTo(100, -404); ctx.lineTo(101, -240); }
  ctx.moveTo(-12, -456); ctx.lineTo(12, -456);
  ctx.stroke(); ctx.restore();
  ctx.strokeStyle = o.lens || "rgba(255,190,140,0.6)"; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(-16, -500, 12, 0, 7); ctx.moveTo(28, -500); ctx.arc(16, -500, 12, 0, 7); ctx.moveTo(-4, -502); ctx.lineTo(4, -502); ctx.stroke();
  ctx.restore();
  const [hx, hy] = handPos(o.arm || 0), fx = o.flip ? -1 : 1;
  return { lensL: [cx - 16 * s * fx, footY - 500 * s], hand: [cx + hx * s * fx, footY + hy * s], s };
}
// Generic teammate silhouettes for the hero walk (no real likenesses).
function walker(ctx, cx, footY, h, t, style, phase) {
  const s = h / 560, step = Math.sin(t * 5 + phase), bob = Math.abs(step) * 6;
  ctx.save(); ctx.translate(cx, footY - bob); ctx.scale(s, s);
  const p = new Path2D(), blob = (x, y, rx, ry) => { p.moveTo(x + rx, y); p.ellipse(x, y, rx, ry, 0, 0, 7); };
  const sh = style.shoulder || 96, ll = 160 + step * 12, rl = 160 - step * 12, sw = step * 0.16;
  // torso: rounded shoulders tapering to the waist, jacket hem flaring slightly
  p.moveTo(-18, -436); p.bezierCurveTo(-60, -430, -sh, -424, -sh, -392); p.lineTo(-sh * 0.86, -250); p.lineTo(-sh * 0.92, -160); p.lineTo(sh * 0.92, -160); p.lineTo(sh * 0.86, -250); p.lineTo(sh, -392); p.bezierCurveTo(sh, -424, 60, -430, 18, -436); p.closePath();
  const arm = (side, a) => { const x0 = side * (sh - 8), y0 = -390; p.moveTo(x0 - 15, y0); p.lineTo(x0 + 15, y0); p.lineTo(x0 + 13 + Math.sin(a) * 210, y0 + Math.cos(a) * 210); p.lineTo(x0 - 17 + Math.sin(a) * 210, y0 + Math.cos(a) * 210); p.closePath(); };
  arm(-1, sw); arm(1, -sw);
  p.moveTo(-52, -165); p.lineTo(-14, -165); p.lineTo(-18, -165 + rl); p.lineTo(-48, -165 + rl); p.closePath();
  p.moveTo(14, -165); p.lineTo(52, -165); p.lineTo(48, -165 + ll); p.lineTo(18, -165 + ll); p.closePath();
  p.rect(-15, -452, 30, 24); blob(0, -496, 36, 46);
  if (style.hair === "long") { p.moveTo(-40, -508); p.bezierCurveTo(-58, -428, -62, -392, -46, -372); p.lineTo(46, -372); p.bezierCurveTo(62, -392, 58, -428, 40, -508); p.closePath(); blob(0, -516, 42, 36); }
  else if (style.hair === "bun") { blob(0, -548, 22, 20); blob(0, -513, 40, 30); }
  else if (style.hair === "short") blob(0, -518, 40, 28);
  else if (style.hair === "cap") { blob(0, -518, 40, 26); p.moveTo(64, -504); p.ellipse(18, -504, 46, 10, 0, 0, 7); }
  ctx.save(); ctx.shadowColor = ORANGE; ctx.shadowBlur = 30; ctx.strokeStyle = EMBER; ctx.lineWidth = 6; ctx.stroke(p); ctx.restore();
  ctx.fillStyle = INK; ctx.fill(p);
  ctx.restore();
}
// Claude core: an original glowing orb with a blinking cursor inside (no logo).
function drawOrb(ctx, x, y, r, t, o = {}) {
  const { power = 1, cursor = true, rings = 3, hue = ORANGE, corona = 0 } = o;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, x, y, r * (2.6 + 0.3 * Math.sin(t * 4)), "rgba(255,106,31,ALPHA)", 0.35 * power);
  if (corona > 0) { const rr = rng(77); for (let i = 0; i < 28; i++) { const a = (i / 28) * 6.28 + t * 0.4, L = r * (1.4 + rr() * 1.4 * corona + 0.2 * Math.sin(t * 6 + i)); ctx.strokeStyle = `rgba(255,180,110,${0.25 * corona})`; ctx.lineWidth = 3 + rr() * 5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke(); } }
  ctx.globalCompositeOperation = "source-over";
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
  body.addColorStop(0, "#fff6e8"); body.addColorStop(0.35, EMBER); body.addColorStop(0.75, hue); body.addColorStop(1, "#a83200");
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  for (let i = 0; i < rings; i++) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * (0.6 + i * 0.35) * (i % 2 ? -1 : 1) + i); ctx.scale(1, 0.32 + i * 0.12); ctx.strokeStyle = `rgba(255,246,232,${0.55 - i * 0.12})`; ctx.lineWidth = r * 0.035; ctx.beginPath(); ctx.arc(0, 0, r * (0.62 + i * 0.12), 0, 7); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  if (cursor && Math.floor(t * 2.5) % 2 === 0) { ctx.fillStyle = "rgba(11,11,13,0.85)"; ctx.fillRect(x - r * 0.09, y - r * 0.26, r * 0.18, r * 0.52); }
  ctx.strokeStyle = "rgba(255,246,232,0.8)"; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.arc(x, y, r * 0.97, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}
// Golden Gate Bridge, built progressively: prog 0..1 (towers → cables → deck → suspenders).
function drawBridge(ctx, cx, deckY, span, prog, t, o = {}) {
  const { color = BRIDGE, glowOn = true } = o;
  const tw = span * 0.5, towerH = span * 0.42, topY = deckY - towerH;
  const ut = easeOut(prog / 0.35), uc = easeInOut((prog - 0.3) / 0.3), ud = easeOut((prog - 0.45) / 0.25), us = clamp((prog - 0.65) / 0.3);
  ctx.save();
  if (glowOn) { ctx.shadowColor = ORANGE; ctx.shadowBlur = 40; }
  ctx.fillStyle = color; ctx.strokeStyle = color;
  const tower = x => { // art-deco stepped tower rising from the water
    const h = towerH * 1.25 * ut, base = deckY + towerH * 0.25, w = span * 0.045;
    ctx.fillRect(x - w, base - h, w * 0.55, h); ctx.fillRect(x + w * 0.45, base - h, w * 0.55, h);
    for (let k = 0; k < 4; k++) { const yy = base - h + h * (0.08 + k * 0.2); if (yy < base) ctx.fillRect(x - w, yy, w * 2, w * 0.35 * (1 - k * 0.15)); }
  };
  tower(cx - tw / 2); tower(cx + tw / 2);
  const cab = (x0, y0, x1, y1, sag, u) => { // parabola from (x0,y0) to (x1,y1), drawn to fraction u
    ctx.beginPath(); const N = 60;
    for (let i = 0; i <= N * u; i++) { const k = i / N, x = lerp(x0, x1, k), y = lerp(y0, y1, k) + sag * 4 * k * (1 - k); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.lineWidth = span * 0.008; ctx.stroke();
  };
  const ty = deckY + towerH * 0.25 - towerH * 1.25 * ut + towerH * 0.04;
  if (uc > 0) { cab(cx - tw / 2, ty, cx + tw / 2, ty, towerH * 0.95, uc); cab(cx - tw / 2, ty, cx - span, deckY - 10, towerH * 0.2, uc); cab(cx + tw / 2, ty, cx + span, deckY - 10, towerH * 0.2, uc); }
  if (ud > 0) { ctx.fillRect(cx - span * ud, deckY, span * 2 * ud, span * 0.022); ctx.fillRect(cx - span * ud, deckY + span * 0.022, span * 2 * ud, span * 0.008); }
  if (us > 0) { ctx.lineWidth = span * 0.0025; ctx.shadowBlur = 0;
    for (let k = 1; k < 30; k++) { const kk = k / 30; if (kk > us) break; const x = lerp(cx - tw / 2, cx + tw / 2, kk), y = ty + towerH * 0.95 * 4 * kk * (1 - kk); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, deckY); ctx.stroke(); } }
  ctx.restore();
}
// Mecha bust: angular helmet, visor eyes, Claude core in the chest. Origin at chest centre, scale 1 ≈ 900 px wide.
// Mecha bust: faceted armour plates lit from above, swept V-fin, visor eyes, Claude core in the chest.
// Origin at chest centre; unit space is ~1040 wide (pauldron to pauldron).
function drawMecha(ctx, cx, cy, s, t, o = {}) {
  const { eyes = 0, core = 1 } = o;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  const plate = (pts, top = "#2c2d34", bot = "#0f0f12", edge = 0.5) => {
    let y0 = Infinity, y1 = -Infinity; pts.forEach(([, y]) => { y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = `rgba(255,176,112,${edge})`; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.stroke();
  };
  const mirror = pts => pts.map(([x, y]) => [-x, y]);
  const both = (pts, a, b, e) => { plate(pts, a, b, e); plate(mirror(pts), a, b, e); };
  // arms, abdomen, torso
  both([[-470, 90], [-372, 96], [-360, 460], [-490, 460]], "#1d1e23", "#0b0b0d", 0.35);
  plate([[-160, 320], [160, 320], [130, 470], [-130, 470]], "#1b1c21", "#0b0b0d", 0.35);
  plate([[-262, -86], [262, -86], [312, 120], [210, 334], [-210, 334], [-312, 120]], "#26272d", "#0d0d10");
  both([[-252, -74], [-36, -44], [-70, 168], [-276, 112]], "#3a3b43", "#16161a", 0.6); // chest V plates
  ctx.fillStyle = "#08080a"; ctx.beginPath(); ctx.arc(0, 130, 96, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(255,176,112,0.6)"; ctx.lineWidth = 5; ctx.stroke();
  // pauldrons with an orange stripe
  both([[-250, -128], [-332, -196], [-474, -156], [-526, -24], [-486, 104], [-330, 84]], "#3a3b43", "#121216", 0.65);
  ctx.save(); ctx.strokeStyle = ORANGE; ctx.lineWidth = 9; ctx.globalAlpha = 0.9;
  [[[-300, -170], [-470, -120]], [[300, -170], [470, -120]]].forEach(([[a, b], [c, d]]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }); ctx.restore();
  // neck + head
  plate([[-72, -84], [72, -84], [56, -156], [-56, -156]], "#1e1f24", "#0e0e11", 0.4);
  plate([[-96, -162], [96, -162], [118, -262], [88, -342], [0, -372], [-88, -342], [-118, -262]], "#383941", "#141418", 0.65);
  both([[-118, -290], [-138, -280], [-138, -214], [-112, -204]], "#2a2b31", "#101013", 0.5); // ear vents
  plate([[-52, -216], [52, -216], [36, -168], [-36, -168]], "#24252b", "#0d0d10", 0.5); // jaw
  ctx.strokeStyle = "rgba(255,176,112,0.35)"; ctx.lineWidth = 2; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 12, -206); ctx.lineTo(k * 10, -178); ctx.stroke(); }
  ctx.fillStyle = "#040405"; ctx.beginPath(); ctx.moveTo(-84, -272); ctx.lineTo(84, -272); ctx.lineTo(72, -224); ctx.lineTo(-72, -224); ctx.closePath(); ctx.fill(); // visor
  // swept V-fin + crest gem
  both([[-6, -334], [-212, -462], [-196, -440], [-16, -314]], "#4a4b54", "#1a1a1f", 0.7);
  ctx.save(); ctx.shadowColor = ORANGE; ctx.shadowBlur = 24; ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.moveTo(0, -352); ctx.lineTo(-16, -330); ctx.lineTo(0, -302); ctx.lineTo(16, -330); ctx.closePath(); ctx.fill(); ctx.restore();
  if (eyes > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.shadowColor = ORANGE; ctx.shadowBlur = 50 * eyes; ctx.fillStyle = `rgba(255,190,120,${eyes})`;
    ctx.beginPath(); ctx.moveTo(-70, -260); ctx.lineTo(-14, -252); ctx.lineTo(-18, -238); ctx.lineTo(-64, -242); ctx.fill();
    ctx.beginPath(); ctx.moveTo(70, -260); ctx.lineTo(14, -252); ctx.lineTo(18, -238); ctx.lineTo(64, -242); ctx.fill(); ctx.restore();
    if (eyes > 0.6) { ctx.save(); ctx.globalCompositeOperation = "lighter"; glow(ctx, -42, -248, 200 * eyes, "rgba(255,120,40,ALPHA)", 0.4); glow(ctx, 42, -248, 200 * eyes, "rgba(255,120,40,ALPHA)", 0.4); ctx.restore(); }
  }
  ctx.restore();
  if (core > 0) drawOrb(ctx, cx, cy + 130 * s, 70 * s, t, { power: core, rings: 2 });
}
// Scouter HUD lens.
function scouterHUD(ctx, x, y, w, h, t, o = {}) {
  const { alpha = 1 } = o;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255,90,40,0.16)"; ctx.strokeStyle = HUD; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 40); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 40); ctx.clip();
  ctx.strokeStyle = "rgba(255,122,58,0.25)"; ctx.lineWidth = 1;
  for (let gx = x - w / 2; gx < x + w / 2; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, y - h / 2); ctx.lineTo(gx, y + h / 2); ctx.stroke(); }
  for (let gy = y - h / 2 + ((t * 120) % 40); gy < y + h / 2; gy += 40) { ctx.beginPath(); ctx.moveTo(x - w / 2, gy); ctx.lineTo(x + w / 2, gy); ctx.stroke(); }
  ctx.fillStyle = "rgba(255,122,58,0.08)"; for (let sy = y - h / 2; sy < y + h / 2; sy += 6) ctx.fillRect(x - w / 2, sy, w, 2);
  ctx.restore(); ctx.restore();
}
function reticle(ctx, x, y, r, t, color = HUD) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.translate(x, y); ctx.rotate(t * 1.4);
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.arc(0, 0, r, -0.5, 0.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r + 10, 0); ctx.lineTo(r + 40, -14); ctx.lineTo(r + 40, 14); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  ctx.restore();
}
const CODE = ["$ claude", "> 버그 고쳐 줘", "reading src/app.ts…", "✓ found the issue", "function fix() {", "  return safe(answer);", "}", "$ npm test", "✓ 128 passed", "git commit -m \"fix\"", "> 리팩터링 해 줘", "editing 12 files…", "✓ build ok", "def plan(goal):", "  steps = think(goal)", "  return steps", "✓ all checks green"];
function codeRain(ctx, x, y, w, h, t, seed, o = {}) {
  const { size = 22, color = HUD, alpha = 0.85 } = o, r = rng(seed), lh = size * 1.5;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.globalAlpha = alpha;
  const off = (t * 140) % lh, start = Math.floor(t * 140 / lh);
  for (let i = -1; i < h / lh + 1; i++) { const line = CODE[(start + i + Math.floor(r() * 100)) % CODE.length]; txt(ctx, line, x + 14, y + h - (i * lh + off), { font: "Mono", size, align: "left", fill: line.startsWith("✓") ? PAPER : color }); }
  ctx.restore();
}
function warnStripes(ctx, x, y, w, h, t, c1 = ORANGE, c2 = INK) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = c2; ctx.fillRect(x, y, w, h); ctx.fillStyle = c1;
  const sw = 40, off = (t * 160) % (sw * 2);
  for (let k = -h - sw * 2; k < w + h; k += sw * 2) { ctx.beginPath(); ctx.moveTo(x + k + off, y + h); ctx.lineTo(x + k + off + sw, y + h); ctx.lineTo(x + k + off + sw + h, y); ctx.lineTo(x + k + off + h, y); ctx.fill(); }
  ctx.restore();
}
function ribbon(ctx, cx, cy, R, t, phase, color) { // spiral ribbon wrapping a centre
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = 0.85; ctx.beginPath();
  const N = 80, pts = [];
  for (let i = 0; i <= N; i++) { const k = i / N, a = phase + t * 3 + k * 7, rr = R * (1.6 - k), y = cy + (k - 0.5) * R * 2.4; pts.push([cx + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.25, Math.sin(a)]); }
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y - 14) : ctx.moveTo(x, y - 14));
  for (let i = N; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 14);
  ctx.fill(); ctx.restore();
}

// ---------- post assets
const GRAIN = [0, 1, 2, 3].map(k => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), d = x.createImageData(256, 256), r = rng(900 + k);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; });
