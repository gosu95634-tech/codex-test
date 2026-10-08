// Canvas 2D layer: typography, hands, labels. Drawn over the WebGL frame.
const W = 1920, H = 1080;
const out = document.getElementById("out"), o = out.getContext("2d");
const GOLD = "#f3d9a4", STAR = "#f4f1ea", DIMW = "rgba(244,241,234,0.55)";
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const easeIn = u => Math.pow(clamp(u), 3);
const ease = u => { u = clamp(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Fine serif line with a soft glow; spacing in em.
function line(s, x, y, o2 = {}) {
  const { size = 52, font = "SerifL", color = STAR, alpha = 1, spacing = 0.14, align = "center", glow = 18, blur = 0 } = o2;
  o.save(); o.globalAlpha = alpha; o.font = `${size}px "${font}"`; o.textAlign = align; o.textBaseline = "middle"; o.letterSpacing = `${spacing * size}px`;
  if (blur) o.filter = `blur(${blur}px)`;
  o.shadowColor = "rgba(255,214,150,0.55)"; o.shadowBlur = glow; o.fillStyle = color; o.fillText(s, x + (align === "center" ? spacing * size / 2 : 0), y);
  o.restore();
}
// "이 채널의 판단" tag: small caps in a hairline frame.
function tag(s, x, y, alpha = 1) {
  o.save(); o.globalAlpha = alpha * 0.85; o.font = '22px "SansL"'; o.letterSpacing = "4px"; o.textBaseline = "middle";
  const w = o.measureText(s).width + 36; o.strokeStyle = "rgba(243,217,164,0.6)"; o.lineWidth = 1; o.strokeRect(x - w / 2, y - 20, w, 40);
  o.fillStyle = GOLD; o.textAlign = "center"; o.fillText(s, x + 2, y + 1); o.restore();
}
function label(s, x, y, ax, ay, alpha = 1, size = 30) { // leader line from (ax,ay) to text
  o.save(); o.globalAlpha = alpha; o.strokeStyle = "rgba(243,217,164,0.5)"; o.lineWidth = 1.2;
  o.beginPath(); o.moveTo(ax, ay); o.lineTo(x, y + size * 0.7); o.stroke();
  o.beginPath(); o.arc(ax, ay, 3, 0, 7); o.fillStyle = GOLD; o.fill();
  line(s, x, y, { size, spacing: 0.1, glow: 10, alpha }); o.restore();
}
// Project a world point with the same camera model as the shaders (fov = focal in uv units of height).
function project(cam, p) {
  const f = norm(cam.fwd), r = norm(cross(f, cam.up)), u = cross(r, f), d = sub(p, cam.pos);
  const z = dot(d, f); if (z <= 0.01) return null;
  return [W / 2 + dot(d, r) / z * cam.fov * H, H / 2 - dot(d, u) / z * cam.fov * H, z];
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

// Hands in the Creation-of-Adam composition. Local frame: wrist at origin, index finger pointing +x, units ≈ px at scale 1.
function handPath() {
  const p = new Path2D();
  p.moveTo(-700, -46); p.bezierCurveTo(-400, -60, -120, -48, 0, -34);
  p.bezierCurveTo(40, -40, 80, -44, 118, -36);              // back of hand to index knuckle
  p.bezierCurveTo(160, -30, 205, -24, 236, -16);            // index finger top
  p.bezierCurveTo(248, -13, 250, -2, 238, 0);               // fingertip
  p.bezierCurveTo(205, 2, 170, 0, 132, 4);                  // under index
  p.bezierCurveTo(160, 10, 196, 20, 206, 30); p.bezierCurveTo(210, 38, 198, 42, 186, 38); p.bezierCurveTo(165, 32, 145, 26, 128, 24); // middle finger, curled
  p.bezierCurveTo(150, 36, 176, 48, 180, 58); p.bezierCurveTo(181, 66, 170, 68, 160, 63); p.bezierCurveTo(142, 54, 128, 48, 116, 42); // ring
  p.bezierCurveTo(132, 54, 150, 66, 150, 74); p.bezierCurveTo(149, 81, 139, 81, 131, 76); p.bezierCurveTo(116, 68, 104, 60, 92, 54); // little finger
  p.bezierCurveTo(70, 52, 52, 50, 40, 44);                  // heel of palm
  p.bezierCurveTo(56, 58, 78, 70, 92, 78); p.bezierCurveTo(100, 84, 94, 92, 84, 90); p.bezierCurveTo(62, 84, 34, 70, 14, 56); // thumb
  p.bezierCurveTo(4, 50, -2, 48, -6, 46);
  p.bezierCurveTo(-140, 60, -420, 78, -700, 86); p.closePath();
  return p;
}
function drawHumanHand(x, y, s, t) {
  o.save(); o.translate(x, y); o.scale(s, s); o.rotate(-0.1);
  const p = handPath();
  o.shadowColor = "rgba(255,200,140,0.9)"; o.shadowBlur = 30; o.strokeStyle = "rgba(255,214,160,0.9)"; o.lineWidth = 2.4; o.stroke(p);
  o.shadowBlur = 0; o.fillStyle = "#060507"; o.fill(p);
  o.strokeStyle = "rgba(255,200,140,0.18)"; o.lineWidth = 1.2; o.beginPath(); o.moveTo(20, -30); o.bezierCurveTo(60, -20, 90, -14, 120, -20); o.moveTo(40, -18); o.bezierCurveTo(70, 0, 100, 6, 128, 4); o.stroke();
  o.restore();
}
function drawLightHand(x, y, s, t) {
  o.save(); o.translate(x, y); o.scale(-s, s); o.rotate(0.06);
  const p = handPath();
  o.globalCompositeOperation = "lighter";
  for (const [blur, a] of [[40, 0.22], [10, 0.3]]) { o.save(); o.filter = `blur(${blur / s}px)`; o.fillStyle = `rgba(255,214,160,${a})`; o.fill(p); o.restore(); }
  const g = o.createLinearGradient(-500, 0, 250, 0); g.addColorStop(0, "rgba(255,190,120,0.05)"); g.addColorStop(0.55, "rgba(255,220,170,0.45)"); g.addColorStop(1, "rgba(255,250,240,0.9)");
  o.fillStyle = g; o.fill(p);
  o.strokeStyle = "rgba(255,246,230,0.95)"; o.lineWidth = 1.6 / s * 1.5; o.stroke(p);
  const r = rng(5); o.fillStyle = "rgba(255,246,230,0.9)";
  for (let i = 0; i < 260; i++) { const px = -620 + r() * 860, py = -60 + r() * 150; if (!o.isPointInPath(p, px, py)) continue; const tw = 0.5 + 0.5 * Math.sin(t * 3 + i); o.beginPath(); o.arc(px, py, (0.6 + r() * 1.8) * tw, 0, 7); o.fill(); }
  o.restore();
}
function flare(x, y, sc, alpha = 1) {
  o.save(); o.globalCompositeOperation = "lighter"; o.globalAlpha = alpha;
  const g = o.createRadialGradient(x, y, 0, x, y, 140 * sc); g.addColorStop(0, "rgba(255,250,240,1)"); g.addColorStop(0.2, "rgba(255,210,150,0.55)"); g.addColorStop(1, "rgba(255,170,90,0)");
  o.fillStyle = g; o.beginPath(); o.arc(x, y, 140 * sc, 0, 7); o.fill();
  o.fillStyle = "rgba(255,248,236,0.9)";
  const spike = (len, wid, a) => { o.save(); o.translate(x, y); o.rotate(a); o.beginPath(); o.moveTo(-len, 0); o.quadraticCurveTo(0, -wid, len, 0); o.quadraticCurveTo(0, wid, -len, 0); o.fill(); o.restore(); };
  spike(700 * sc, 2.5 * sc, 0); spike(120 * sc, 2 * sc, Math.PI / 2);
  o.restore();
}
function grainOver(seed, amt = 0.06) {
  const r = rng(seed); o.save(); o.globalAlpha = amt; o.globalCompositeOperation = "overlay";
  o.drawImage(GRAIN[Math.floor(r() * 4)], -(r() * 256 | 0), -(r() * 256 | 0), W + 512, H + 512); o.restore();
}
const GRAIN = [0, 1, 2, 3].map(k => { const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"), d = x.createImageData(512, 512), r = rng(70 + k);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; });
