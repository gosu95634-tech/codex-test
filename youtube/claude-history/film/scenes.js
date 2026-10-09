// 「아모데이의 모험」 scenes. Each scene draws a full frame into ctx g for global time t (beat b = t / SPB).
const B = b => b * SPB; // beat → seconds
function bg(c) { g.fillStyle = c; g.fillRect(0, 0, W, H); }
function zoomed(z, cx, cy, fn, rot = 0) { g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore(); }
function pill(text, x, y, size = 40, o = {}) {
  const { fill = ORANGE, fg = INK, align = "center", font = "Mono" } = o, w = measure(g, text, font, size) + size * 1.3, h = size * 1.6, x0 = align === "left" ? x : x - w / 2;
  g.save(); g.fillStyle = fill; g.beginPath(); g.roundRect(x0, y - h / 2, w, h, h / 2); g.fill(); txt(g, text, x0 + w / 2, y + 2, { font, size, fill: fg, ls: 3 }); g.restore();
}

// ---------- A. titles (approved test) ----------
function sceneCards(t, b) {
  const i = Math.floor(b) - 4, u = b - Math.floor(b), z = lerp(1.07, 1.0, easeOut(u));
  bg(INK);
  zoomed(z, W / 2, H / 2, () => {
    if (i === 0) { card(g, "제1화", 130, H / 2 + 20, 560, { align: "left" }); txt(g, "EPISODE : 01", W - 140, H - 150, { font: "Mono", size: 34, align: "right", ls: 10, fill: DIM }); }
    else if (i === 1) card(g, "아모데이", W / 2, H / 2 + 10, 500, { sx: 0.74 });
    else if (i === 2) card(g, "의", W * 0.64, H * 0.6, 1250, { sx: 0.9 });
    else { card(g, "모", W / 2, H * 0.285, 420, { sx: 0.95 }); card(g, "험", W / 2, H * 0.725, 420, { sx: 0.95 }); }
  });
}
function titleCard(u, cursor = true) {
  txt(g, "제1화", 150, 214, { size: 108, align: "left", sx: 0.84, stroke: PAPER, lw: 3 });
  txt(g, "EPISODE : 01", W - 150, 214, { font: "Mono", size: 30, align: "right", ls: 10, fill: DIM });
  g.fillStyle = PAPER; g.globalAlpha = 0.7; g.fillRect(150, 292, (W - 300) * easeOut(u / 0.6), 3); g.globalAlpha = 1;
  card(g, "아모데이의", 140, 530, 300, { align: "left" });
  card(g, "모험", 140, 838, 300, { align: "left" });
  const cw = measure(g, "모험", "Serif", 300) * 0.82;
  if (cursor && Math.floor(u * 2.5) % 2 === 0) { g.save(); g.shadowColor = ORANGE; g.shadowBlur = 30; g.fillStyle = ORANGE; g.fillRect(140 + cw + 36, 838 - 118, 54, 226); g.restore(); }
  txt(g, "THE  ADVENTURE  OF  AMODEI", W - 150, 960, { size: 40, align: "right", ls: 6, fill: PAPER, alpha: easeOut((u - 0.3) / 0.6) });
}
function sceneTitle(t, b) { const u = b - 8; bg(INK); zoomed(1 + 0.035 * u, W / 2, H / 2, () => titleCard(u)); }
function sceneStutter(t, b) {
  const idx = Math.min(3, Math.floor((b - 10) * 2)), u = (b - 10) * 2 - idx;
  const words = ["세상을", "바꾸러", "가", "다"], sizes = [400, 400, 820, 820];
  const inv = idx === 1, fg = idx === 3 ? ORANGE : inv ? INK : PAPER;
  bg(inv ? PAPER : INK);
  zoomed(lerp(1.12, 1, easeOut(u * 1.5)), W / 2, H / 2, () => card(g, words[idx], W / 2 + (idx === 2 ? -120 : idx === 3 ? 150 : 0), H / 2 + 20, sizes[idx], { fill: fg }));
}
function sceneSlam(t, b) {
  const u = b - 12;
  bg(INK);
  halftoneBurst(g, W / 2, H / 2, 1250, 0.75 + 0.35 * env(t, ["slam", "beat"], 6), u * 0.05);
  focusLines(g, W / 2, H / 2, 140, 430, 100 + Math.floor(t * 20), 0.85);
  const vig = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 1000); vig.addColorStop(0, "rgba(11,11,13,0.9)"); vig.addColorStop(0.55, "rgba(11,11,13,0.25)"); vig.addColorStop(1, "rgba(11,11,13,0)");
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
  const z = (0.6 + 0.4 * easeOutBack(u / 0.25)) * (1 + 0.04 * env(t, ["beat"], 9));
  zoomed(z, W / 2, H / 2, () => {
    txt(g, "세상을 바꾸러 가다", W / 2, H / 2 + 10, { size: 232, sx: 0.84, fill: null, stroke: INK, lw: 56, join: "miter" });
    card(g, "세상을 바꾸러 가다", W / 2, H / 2 + 10, 232);
    g.fillStyle = ORANGE; g.fillRect(W / 2 - 760 * easeOut(u / 0.5), H / 2 + 160, 1520 * easeOut(u / 0.5), 16);
  });
  menaceRing(g, t, B(13), MENACE_SPOTS);
}
function sceneDoor(t, b) {
  const u = b - 16, cx = W / 2, foot = 930, hd = 560, focusY = foot - 500;
  const push = u < 4 ? lerp(1, 1.12, u / 4) : lerp(1.12, 2.6, easeIn((u - 4) / 4.2));
  bg(INK);
  zoomed(push, cx, focusY, () => {
    txt(g, "2021", cx, 470, { size: 560, sx: 0.86, fill: null, stroke: "rgba(242,238,230,0.16)", lw: 3 });
    g.save(); g.globalCompositeOperation = "lighter"; const r = rng(42);
    for (let i = 0; i < 46; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.6 + Math.sin(t * 0.6 + i) * 0.02, w = 0.01 + r() * 0.04, L = 1500;
      g.fillStyle = `rgba(255,${150 + r() * 80 | 0},90,${0.035 + r() * 0.04})`;
      g.beginPath(); g.moveTo(cx, 560); g.lineTo(cx + Math.cos(a - w) * L, 560 + Math.sin(a - w) * L); g.lineTo(cx + Math.cos(a + w) * L, 560 + Math.sin(a + w) * L); g.fill(); }
    g.restore();
    const dw = 300, dh = 700, dx = cx - dw / 2, dy = foot - dh;
    g.save(); g.shadowColor = ORANGE; g.shadowBlur = 120;
    const dg = g.createLinearGradient(dx, 0, dx + dw, 0); dg.addColorStop(0, "#ffb37a"); dg.addColorStop(0.5, "#fff6ea"); dg.addColorStop(1, "#ffb37a");
    g.fillStyle = dg; g.fillRect(dx, dy, dw, dh); g.restore();
    const fg = g.createLinearGradient(0, foot, 0, H); fg.addColorStop(0, "rgba(255,170,110,0.55)"); fg.addColorStop(1, "rgba(255,106,31,0)");
    g.fillStyle = fg; g.beginPath(); g.moveTo(dx, foot); g.lineTo(dx + dw, foot); g.lineTo(dx + dw + 520, H); g.lineTo(dx - 520, H); g.fill();
    drawDario(g, cx, foot, hd, t);
  });
  const [gs] = since(t, ["glint"]);
  if (gs < 1.2) { const lx = cx + (-16) * push, ly = focusY; starFlare(g, lx, ly, (0.4 + 1.4 * easeOut(gs / 0.12)) * (1 - easeIn(gs / 1.2)) * Math.min(1.6, push)); }
  if (u >= 4) focusLines(g, W / 2, focusY, 60 + (u - 4) * 40, lerp(700, 260, (u - 4) / 4), 300 + Math.floor(t * 30), 0.25 + 0.15 * (u - 4));
  [[300, 300, 150], [1640, 330, 140], [280, 820, 130], [1660, 800, 160]].forEach(([x, y, s], k) => menace(g, x, y, s * (1 + 0.1 * env(t, ["beat"], 8)), t, B(16.5 + k * 0.5), 20 + k));
  if (u < 0.6) halftoneWipe(g, u / 0.6, cx, focusY);
}
// Low-angle hero shot: "2021" + Anthropic founding.
function sceneReveal(t, b) {
  const u = b - 24;
  bg(INK);
  sunburst(g, W * 0.36, H * 0.42, 28, u * 0.06, INK, "#17171b");
  halftoneBurst(g, W * 0.36, H * 0.4, 900, 0.85 + 0.3 * env(t, ["beat"], 7), -u * 0.04);
  focusLines(g, W * 0.36, H * 0.4, 90, 520, 500 + Math.floor(t * 15), 0.35);
  const z = lerp(1.08, 1.0, easeOut(u / 2)) * (1 + 0.025 * env(t, ["beat"], 9));
  zoomed(z, W * 0.36, H * 0.5, () => {
    glow(g, W * 0.36, H * 0.42, 520, "rgba(255,130,60,ALPHA)", 0.35);
    drawDario(g, W * 0.36, H + 160, 1080, t, { wind: 1.6 });
  });
  const pop = easeOutBack(u / 0.3);
  zoomed(pop, W * 0.76, H * 0.45, () => {
    txt(g, "2021", W * 0.76, H * 0.45, { size: 380, sx: 0.84, fill: null, stroke: ORANGE, lw: 40, join: "miter" });
    txt(g, "2021", W * 0.76, H * 0.45, { size: 380, sx: 0.84, fill: null, stroke: INK, lw: 18, join: "miter" });
    card(g, "2021", W * 0.76, H * 0.45, 380);
  }, -0.05);
  if (u >= 4) { const k = easeOutBack((u - 4) / 0.3); zoomed(k, W * 0.76, H * 0.72, () => captionBox(g, "Anthropic 창업", W * 0.76, H * 0.72, 64, { align: "center" })); txt(g, "OpenAI 출신들이 세운 AI 안전 연구 회사", W * 0.76, H * 0.83, { font: "SansM", size: 32, alpha: easeOut((u - 4.4) / 0.6) }); }
  menaceRing(g, t, B(24.5), [[140, 160, 150], [1820, 120, 130], [120, 940, 140]], 1, 40);
  if (u < 2) starFlare(g, W * 0.36 - 16 * 1080 / 560, H + 160 - 500 * 1080 / 560, (1 - easeIn(u / 2)) * 1.2);
}
// ---------- B. hero walk ----------
const TEAM = [{ hair: "short" }, { hair: "long" }, { hair: "cap" }, null, { hair: "bun" }, { hair: "short", shoulder: 112 }, { hair: "long" }];
function sceneWalk(t, b) {
  const u = b - 32, adv = easeInOut(u / 16), cam = 1 + (u > 12 ? easeIn((u - 12) / 4) * 0.5 : 0);
  bg(INK);
  zoomed(cam, W / 2, H * 0.45, () => {
    const hz = H * 0.56;
    const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, "#0b0b0d"); sky.addColorStop(1, "#3a1a0c"); g.fillStyle = sky; g.fillRect(0, 0, W, hz);
    glow(g, W / 2, hz, 900, "rgba(255,150,80,ALPHA)", 0.9); glow(g, W / 2, hz, 260, "rgba(255,245,230,ALPHA)", 1);
    const fl = g.createLinearGradient(0, hz, 0, H); fl.addColorStop(0, "#2a140a"); fl.addColorStop(1, INK); g.fillStyle = fl; g.fillRect(0, hz, W, H - hz);
    g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,200,150,0.5)"; g.fillRect(0, hz - 2, W, 4); g.restore();
    // dust motes drifting in the backlight
    const r = rng(9); g.fillStyle = "rgba(255,210,170,0.6)"; for (let i = 0; i < 90; i++) { const x = (r() * W + t * 20 * (r() - 0.3)) % W, y = r() * H, s = r() * 3; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
    const scale = lerp(0.95, 1.2, adv), foot = lerp(H * 1.12, H * 1.28, adv);
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, W / 2, hz - 40, 1000, "rgba(255,170,110,ALPHA)", 0.35); g.restore();
    const order = [0, 6, 1, 5, 2, 4, 3]; // draw outer figures first, Dario last (in front)
    order.forEach(i => {
      const st = TEAM[i], off = i - 3, x = W / 2 + off * 250 * scale, f = foot - Math.abs(off) * 22 + (st ? 0 : 30), h = 560 * scale * (st ? 0.95 : 1.04);
      g.save(); g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.moveTo(x - 60 * scale, f); g.lineTo(x + 60 * scale, f); g.lineTo(x + off * 120 + 160, H + 200); g.lineTo(x + off * 120 - 160, H + 200); g.fill(); g.restore();
      if (st) walker(g, x, f, h, t * 0.5, st, i * 1.3); else drawDario(g, x, f, h, t * 0.5, { wind: 0.6 });
    });
  });
  starFlare(g, W / 2, H * 0.45 + (H * 0.56 - H * 0.45) * cam, 1.3 + 0.2 * Math.sin(t * 2), 0.6);
  if (u >= 0.3) captionBox(g, "2021 · 동료들과 함께", 90, 120, 48, { alpha: easeOut((u - 0.3) / 0.4) });
  if (u >= 8 && u < 15) { const k = easeOutBack((u - 8) / 0.25); zoomed(k, W / 2, H * 0.2, () => bubble(g, "안전한 AI, 우리가 만든다", W / 2, H * 0.2, 60, W / 2 - 10, H * 0.36)); }
  if (u >= 12) focusLines(g, W / 2, H * 0.5, 40 + (u - 12) * 30, 600, 700 + Math.floor(t * 30), 0.2 + (u - 12) * 0.1);
}
// ---------- C. pocket ----------
function sceneRummage(t, b, b0, len) {
  const u = (b - b0) / len, sh = Math.sin(t * 50) * 6 * (0.5 + u);
  bg(INK); halftoneBurst(g, W * 0.6, H * 0.55, 1100, 0.5, t * 0.1, "#2a1d16", 30);
  focusLines(g, W * 0.6, H * 0.6, 80, 380, 900 + Math.floor(t * 20), 0.25);
  const px = W * 0.58, py = H * 0.62;
  zoomed(1 + 0.05 * u, px, py, () => {
    drawDario(g, W * 0.5 + sh, H + 1350, 2300, t, { wind: 0.4 });
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, px, py, 160 + 220 * u + 20 * Math.sin(t * 30), "rgba(255,160,80,ALPHA)", 0.5 + 0.5 * u); g.restore();
    g.save(); g.fillStyle = PAPER; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(px - 150, py); g.arc(px, py, 150, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
    g.globalCompositeOperation = "lighter"; g.strokeStyle = `rgba(255,170,90,${0.6 + 0.4 * u})`; g.lineWidth = 10 + 10 * u; g.shadowColor = ORANGE; g.shadowBlur = 40; g.beginPath(); g.moveTo(px - 140, py); g.lineTo(px + 140, py); g.stroke(); g.restore();
  });
  const r = rng(Math.floor(t * 10));
  [[0.13, 0.3], [0.86, 0.36], [0.16, 0.78]].forEach(([fx, fy], k) => slamText(g, "뒤적", W * fx + (r() - 0.5) * 30, H * fy + (r() - 0.5) * 30, 120 + 40 * u, { rot: (r() - 0.5) * 0.4, outer: ORANGE }));
}
const GADGETS = [
  { name: "Claude!", date: "2023.03", r: 80, c1: ORANGE, c2: "#ff8a45", tag: "첫 번째 Claude" },
  { name: "Claude 2!", date: "2023.07", r: 105, c1: "#ffd2a8", c2: "#ffbe86", tag: "더 길게, 더 똑똑하게" },
  { name: "Claude 3!", date: "2024.03", r: 135, c1: ORANGE, c2: "#ffcf9e", tag: "3형제의 등장" },
];
function sceneGadget(t, b, b0, idx) {
  const u = b - b0, G = GADGETS[idx];
  sunburst(g, W * 0.34, H * 0.36, 24, u * 0.15, G.c1, G.c2);
  halftoneBurst(g, W * 0.34, H * 0.36, 1500, 0.35, 0, "rgba(11,11,13,0.25)", 40);
  const arm = easeOutBack(u / 0.35), z = lerp(1.1, 1, easeOut(u / 0.5)) * (1 + 0.03 * env(t, ["beat", "fanfare"], 8));
  zoomed(z, W * 0.34, H * 0.5, () => {
    const d = drawDario(g, W * 0.3, H + 40, 760, t, { arm, wind: 0.8, rim: PAPER, rimColor: PAPER });
    const [hx, hy] = d.hand, orbY = Math.max(G.r * 1.25, hy - G.r * 0.55);
    drawOrb(g, hx, orbY, G.r * (0.5 + 0.5 * easeOutBack(u / 0.4)), t, { power: 1.2, corona: 0.6 + idx * 0.3 });
    sparkles(g, hx, orbY, G.r * 3, 18, t, 30 + idx, "#fff8ee", 26);
    if (u < 0.6) starFlare(g, hx, orbY, (1 - u / 0.6) * 1.6);
  });
  const k = easeOutBack((u - 0.15) / 0.3);
  if (k > 0) zoomed(k, W * 0.71, H * 0.4, () => slamText(g, G.name, W * 0.71, H * 0.4, 205, { rot: -0.06, fill: PAPER }), 0);
  if (u > 0.6) { pill(G.date, W * 0.7, H * 0.62, 48, { fill: INK, fg: PAPER }); txt(g, G.tag, W * 0.7, H * 0.73, { font: "SansB", size: 44, fill: INK, alpha: easeOut((u - 0.8) / 0.4) }); }
}
const TRIO = [{ n: "Haiku", r: 70, x: 0.2, b: 82, d: "빠르고 가볍게" }, { n: "Sonnet", r: 100, x: 0.5, b: 84, d: "균형 잡힌 힘" }, { n: "Opus", r: 140, x: 0.8, b: 86, d: "최강의 두뇌" }];
function sceneSplit(t, b) {
  const u = b - 80;
  bg(INK); halftoneBurst(g, W / 2, H / 2, 1300, 0.6 + 0.3 * env(t, ["beat"], 7), u * 0.03, "#3a1a0c");
  focusLines(g, W / 2, H / 2, 110, 460, 1100 + Math.floor(t * 20), 0.3);
  const cam = u > 12 ? lerp(1, 2.4, easeIn((u - 12) / 4)) : 1, camX = W * lerp(0.5, 0.8, easeIn((u - 12) / 4));
  zoomed(cam, u > 12 ? camX : W / 2, H * 0.46, () => {
    if (u < 0.5) { drawOrb(g, W / 2, H * 0.46, 150, t, { corona: 1 }); cracks(g, W / 2, H * 0.46, u / 0.5, 3); }
    TRIO.forEach((o, i) => {
      const k = easeOutBack((u - 0.4) / 0.6); if (k <= 0) return;
      const x = lerp(W / 2, W * o.x, k), y = H * 0.46 + Math.sin(t * 2 + i) * 10, pw = u > 8 ? 1 + (u - 8) * 0.1 : 1;
      drawOrb(g, x, y, o.r * pw, t + i, { corona: u > 8 ? 0.5 + (u - 8) * 0.12 : 0.3, power: pw });
      const kk = easeOutBack((b - o.b) / 0.3);
      if (kk > 0) { zoomed(kk, x, H * 0.76, () => { card(g, o.n, x, H * 0.76, 110, { sx: 0.9 }); }); txt(g, o.d, x, H * 0.86, { font: "SansM", size: 34, fill: EMBER, alpha: clamp((b - o.b - 0.3) / 0.4) }); }
    });
  });
  if (u < 0.6) shards(g, W / 2, H * 0.46, u * 1.2, 5, 30, EMBER);
  if (u >= 8) { captionBox(g, "Claude 3 패밀리 · 2024.03", 90, 110, 46, { alpha: easeOut((u - 8) / 0.4) }); menaceRing(g, t, B(88), [[160, 900, 150], [1760, 900, 150], [1760, 160, 130]], 1, 60); }
}
// ---------- D. scouter ----------
const POWER = ["1,200", "9,000", "18,000", "120,000", "530,000", "ERROR"];
function sceneScouter(t, b) {
  const u = b - 96;
  bg("#0d0a0a");
  halftoneBurst(g, W * 0.62, H * 0.5, 1200, 0.5, t * 0.05, "#2a120a", 30);
  const ox = W * 0.62, oy = H * 0.5;
  const shake = b >= 106 && b < 112 ? (b - 106) * 3 : 0, r0 = rng(Math.floor(t * 60));
  g.save(); g.translate((r0() - 0.5) * shake * 4, (r0() - 0.5) * shake * 4);
  drawOrb(g, ox, oy, 210, t, { corona: 1 + Math.max(0, b - 100) * 0.25, power: 1.3 });
  sparkles(g, ox, oy, 600, 20, t, 70, EMBER, 20);
  g.restore();
  scouterHUD(g, W * 0.56, H * 0.5, 1460, 820, t);
  const lock = easeInOut((u - 0.5) / 3), rx = lerp(W * 0.3, ox, lock), ry = lerp(H * 0.3, oy, lock);
  reticle(g, rx, ry, 150 - 30 * lock, t);
  if (Math.floor(t * 4) % 2 === 0 || b >= 100) txt(g, b < 106 ? "전투력 측정 중…" : "", W * 0.56 - 680, H * 0.5 - 360, { font: "SansB", size: 44, align: "left", fill: HUD });
  txt(g, "TARGET: CLAUDE 3 OPUS", W * 0.56 + 680, H * 0.5 - 360, { font: "Mono", size: 30, align: "right", fill: HUD, ls: 3 });
  // power readout: slot-machine digits between count events
  let shown = "0";
  const [cs, ce] = since(t, ["count"]);
  if (ce && ce.n < 10) { const tgt = POWER[ce.n]; shown = cs < 0.12 && ce.n > 0 && tgt !== "ERROR" ? String(Math.floor(rng(Math.floor(t * 60))() * 999999)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : tgt; }
  if (b >= 100) txt(g, shown, W * 0.56 + 680, H * 0.5 + 300, { font: "Mono", size: 140, align: "right", fill: shown === "ERROR" ? "#ff3b2f" : HUD });
  if (b >= 100) txt(g, "POWER", W * 0.56 + 680, H * 0.5 + 200, { font: "Mono", size: 34, align: "right", fill: HUD, ls: 8 });
  if (b >= 106) { const k = easeOutBack((b - 106) / 0.25); zoomed(k, W * 0.4, H * 0.42, () => slamText(g, "측정 불가", W * 0.4, H * 0.42, 210, { fill: "#ff3b2f", outer: PAPER, rot: -0.05 })); }
  if (b >= 108) { const k = easeOutBack((b - 108) / 0.25); zoomed(k, W * 0.3, H * 0.78, () => bubble(g, "말도 안 돼…!", W * 0.3, H * 0.78, 64, W * 0.12, H * 1.02)); }
  if (b >= 109) cracks(g, W * 0.56, H * 0.5, (Math.floor(b) - 108) / 3 + 0.2, 13, "#fff3e6");
}
function sceneAfter(t, b) {
  const u = b - 112;
  bg(INK);
  smoke(g, W / 2, H * 0.55, u * SPB, 4, 20, 0.55 * (1 - u / 9));
  drawOrb(g, W / 2, H * 0.48, 180, t, { corona: 0.6 });
  shards(g, W / 2, H * 0.48, u * SPB, 7, 60, PAPER);
  if (u >= 2) { const n = Math.floor(clamp((u - 2) / 2.5) * 14); txt(g, "그리고 2024년 5월…".slice(0, n), W / 2, H * 0.82, { size: 80, sx: 0.84 }); }
  if (u >= 4) focusLines(g, W / 2, H * 0.48, 30 + (u - 4) * 25, 500, 1300 + Math.floor(t * 30), 0.2 + (u - 4) * 0.08);
}
// ---------- E. transformation ----------
function magicBg(t, warm = 0) {
  const gr = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 1200);
  gr.addColorStop(0, "#ffe2c8"); gr.addColorStop(0.25, ROSE); gr.addColorStop(0.6, "#7a1f6a"); gr.addColorStop(1, "#1a0820");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = "lighter"; const r = rng(5);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.28 + t * 0.3, w = 0.05 + r() * 0.05; g.fillStyle = `rgba(255,220,240,${0.06 + r() * 0.05})`; g.beginPath(); g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, 2000, a, a + w); g.fill(); }
  g.restore();
  sparkles(g, W / 2, H / 2, 1100, 60, t, 99, "#fff4fb", 24);
}
function sceneTransform(t, b) {
  const u = b - 120;
  magicBg(t);
  const cx = W / 2, cy = H * 0.48;
  if (u < 12) {
    const spin = u >= 4 ? (u - 4) : 0, sq = 1 + Math.sin(spin * 3) * 0.15;
    g.save(); g.translate(cx, cy); g.scale(1 / sq, sq); drawOrb(g, 0, 0, 170, t, { corona: 0.4 + spin * 0.1 }); g.restore();
    if (u >= 4) [ROSE, ORANGE, "#fff0e0"].forEach((c, k) => ribbon(g, cx, cy, 260, t, k * 2.1, c));
    const [ss] = since(t, ["sparkle"]); if (ss < 0.5 && u >= 4) starFlare(g, cx + Math.sin(b * 7) * 200, cy + Math.cos(b * 5) * 160, (1 - ss / 0.5) * 1.4);
  }
  if (u < 4) { const k = easeOutBack(u / 0.3); zoomed(k, cx, H * 0.18, () => slamText(g, "Claude, 변신!", cx, H * 0.18, 150, { outer: ROSE, rot: -0.04 })); }
  if (u >= 12) {
    const prog = clamp((u - 12) / 8);
    drawBridge(g, cx, H * 0.66, 860, prog, t);
    if (prog < 0.5) drawOrb(g, cx, cy, 170 * (1 - prog * 2), t, { corona: 1 });
    sparkles(g, cx, H * 0.5, 800, 30, t, 101, "#fff8ee", 30);
  }
}
function sceneBridgeForm(t, b) {
  const u = b - 140;
  sunburst(g, W / 2, H * 0.62, 30, u * 0.08, "#ff8a45", ORANGE);
  halftoneBurst(g, W / 2, H * 0.6, 1400, 0.5, 0, "rgba(255,95,162,0.55)", 36);
  const z = lerp(1.15, 1, easeOut(u / 0.6)) * (1 + 0.03 * env(t, ["beat"], 9));
  zoomed(z, W / 2, H * 0.6, () => {
    const water = g.createLinearGradient(0, H * 0.72, 0, H); water.addColorStop(0, "#5a1b10"); water.addColorStop(1, INK); g.fillStyle = water; g.fillRect(0, H * 0.72, W, H * 0.28);
    drawBridge(g, W / 2, H * 0.68, 900, 1, t, { color: "#c4301f" });
    sparkles(g, W / 2, H * 0.4, 900, 40, t, 140, "#fff8ee", 30);
  });
  const k = easeOutBack(u / 0.3);
  zoomed(k, W / 2, H * 0.17, () => slamText(g, "골든 게이트 폼!", W / 2, H * 0.17, 170, { outer: ROSE, rot: -0.03 }));
  if (u > 1) pill("2024.05 · 24시간 한정 공개", W / 2, H * 0.92, 40, { fill: INK, fg: PAPER, font: "SansB" });
  menaceRing(g, t, B(141), [[160, 520, 130], [1760, 520, 130]], 1, 80, "キ");
  const [gs] = since(t, ["glint"]); if (gs < 1) starFlare(g, W / 2 - 215, H * 0.68 - 470, (1 - gs) * 1.6);
  if (u >= 8 - 1.2) { const p = clamp((u - 6.8) / 1.2); g.save(); g.fillStyle = INK; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, 1200 * (1 - easeIn(p)), 0, 7, true); g.fill("evenodd"); g.restore(); }
}
// ---------- F. mecha ----------
function hangarBg(t, b) {
  bg("#0a0a0c");
  for (let i = 0; i < 9; i++) { const x = i * 240 - 40; g.fillStyle = "#141418"; g.fillRect(x, 0, 60, H); g.fillStyle = "#1c1c22"; for (let y = 0; y < H; y += 120) g.fillRect(x - 20, y, 100, 14); }
  warnStripes(g, 0, 0, W, 60, t); warnStripes(g, 0, H - 60, W, 60, -t);
  const siren = b >= 152 && b < 172;
  if (siren) { g.save(); g.globalCompositeOperation = "lighter"; [[260, 90], [W - 260, 90]].forEach(([x, y], k) => { const a = t * 5 + k * Math.PI; g.fillStyle = "rgba(255,60,30,0.18)"; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 1400, a - 0.25, a + 0.25); g.fill(); glow(g, x, y, 60, "rgba(255,80,40,ALPHA)", 0.9); }); g.restore(); }
  g.fillStyle = "rgba(10,10,12,0.85)"; g.fillRect(40, 140, 420, 620); g.fillRect(W - 460, 140, 420, 620);
  g.strokeStyle = HUD; g.lineWidth = 3; g.strokeRect(40, 140, 420, 620); g.strokeRect(W - 460, 140, 420, 620);
  codeRain(g, 40, 140, 420, 620, t, 3, { size: 22 });
}
const CHECKS = ["터미널 연결", "코드베이스 읽기", "테스트 실행", "커밋 준비"];
function sceneHangar(t, b) {
  const u = b - 152;
  hangarBg(t, b);
  const rise = u < 8 ? 0 : easeInOut((u - 8) / 8), my = lerp(H + 380, H * 0.64, rise);
  const eyes = b >= 171 ? clamp((b - 171) / 1) * 0.6 : 0;
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, W / 2, H, 700, "rgba(255,120,40,ALPHA)", 0.35); g.restore();
  drawMecha(g, W / 2, my, 0.66, t, { eyes, core: 0.4 + rise * 0.6 });
  txt(g, "CLAUDE CODE", W / 2, 120, { font: "Mono", size: 40, fill: HUD, ls: 14 });
  if (u < 8) { const k = easeOutBack(u / 0.3); zoomed(k, W / 2, H * 0.42, () => { txt(g, "발진 준비", W / 2, H * 0.42, { size: 260, sx: 0.84, fill: null, stroke: INK, lw: 40, join: "miter" }); card(g, "발진 준비", W / 2, H * 0.42, 260); }); }
  // checklist on the right monitor
  g.fillStyle = "rgba(10,10,12,0.92)"; g.fillRect(W - 460, 140, 420, 620); g.strokeStyle = HUD; g.lineWidth = 3; g.strokeRect(W - 460, 140, 420, 620);
  txt(g, "SYSTEM CHECK", W - 440, 190, { font: "Mono", size: 28, align: "left", fill: HUD, ls: 4 });
  CHECKS.forEach((c, i) => { const cb = 160 + i * 2, on = b >= cb, y = 280 + i * 110; txt(g, c, W - 430, y, { font: "SansB", size: 38, align: "left", fill: on ? PAPER : DIM }); if (on) { const k = easeOutBack((b - cb) / 0.3); zoomed(k, W - 90, y, () => txt(g, "✓", W - 90, y, { font: "SansB", size: 56, fill: ORANGE })); } });
  // countdown 3-2-1
  const [cs, ce] = since(t, ["count"]);
  if (ce && ce.n >= 10 && b < 171) { const n = 3 - (ce.n - 10), k = lerp(1.6, 1, easeOut(cs / 0.15)); zoomed(k, W / 2, H * 0.42, () => { txt(g, String(n), W / 2, H * 0.42, { size: 560, fill: null, stroke: INK, lw: 50, join: "miter" }); card(g, String(n), W / 2, H * 0.42, 560, { fill: ORANGE, stroke: ORANGE }); }); }
  if (b >= 171) { g.fillStyle = `rgba(0,0,0,${0.5 * clamp((b - 171) / 0.5)})`; g.fillRect(0, 0, W, H); drawMecha(g, W / 2, my, 0.66, t, { eyes, core: 1 }); }
}
function sceneLaunch(t, b) {
  const u = b - 172;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#0b0b0d"); sky.addColorStop(0.7, "#2a0f06"); sky.addColorStop(1, ORANGE); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  speedLinesV(g, 120, 17, 0.5, PAPER, t);
  const r = rng(Math.floor(t * 60)), sh = 14 * Math.max(0, 1 - u / 6);
  g.save(); g.translate((r() - 0.5) * sh, (r() - 0.5) * sh);
  const y = lerp(H * 0.8, H * 0.6, easeOut(u / 2));
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, W / 2, y + 380, 600, "rgba(255,150,60,ALPHA)", 0.9); glow(g, W / 2, y + 340, 220, "rgba(255,245,230,ALPHA)", 1); g.restore();
  drawMecha(g, W / 2, y, 0.62, t, { eyes: 1, core: 1 });
  g.restore();
  if (u < 3) { const k = easeOutBack(u / 0.25); zoomed(k, W / 2, H * 0.22, () => slamText(g, "발진!!", W / 2, H * 0.22, 300, { rot: -0.05 })); }
  if (u >= 1) pill("2025.02 · Claude Code", 90, H - 130, 40, { align: "left", fill: PAPER, fg: INK, font: "SansB" });
}
function sceneClaude4(t, b) {
  const u = b - 180;
  sunburst(g, W / 2, H * 0.42, 32, u * 0.05, INK, "#1a1410");
  halftoneBurst(g, W / 2, H * 0.4, 1300, 0.7 + 0.3 * env(t, ["beat"], 7), u * 0.03);
  const cam = u > 8 ? lerp(1, 5, easeIn((u - 8) / 4)) : lerp(1.1, 1, easeOut(u / 1));
  zoomed(cam, W / 2, H * 0.6 + 130 * 0.74, () => {
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, W / 2, H * 0.5, 800, "rgba(255,120,40,ALPHA)", 0.4); g.restore();
    drawMecha(g, W / 2, H * 0.6, 0.74, t, { eyes: 1, core: 1.4 });
    drawOrb(g, W / 2, H * 0.6 + 130 * 0.74, 52, t, { corona: 1.4, power: 1.4 });
  });
  if (u < 8) { const k = easeOutBack(u / 0.3); zoomed(k, W / 2, H * 0.86, () => slamText(g, "Claude 4", W / 2, H * 0.86, 220, { rot: -0.03 })); pill("2025.05", W - 200, 110, 44, { fill: PAPER, fg: INK }); }
  if (u > 10) { g.fillStyle = `rgba(255,246,232,${easeIn((u - 10) / 2)})`; g.fillRect(0, 0, W, H); }
}
// ---------- G. climax ----------
const NAMES = [["3.5", "2024.06"], ["3.7", "2025.02"], ["4", "2025.05"], ["4.5", "2025.09"], ["5", "2026.06"], ["Fable", "2026.06"]];
const WORDS = ["진화", "코딩", "추론", "속도", "안전", "협업"];
function nameCard(t, i, u) {
  const [n, d] = NAMES[i % NAMES.length], lay = i % 3;
  if (lay === 0) { bg(INK); halftoneBurst(g, W * 0.3, H / 2, 1100, 0.7, i, "#3a1a0c"); txt(g, "Claude", 160, 300, { size: 110, align: "left", sx: 0.84, fill: DIM }); card(g, n, 140, H * 0.6, n.length > 3 ? 360 : 520, { align: "left", fill: PAPER }); pill(d, W - 160, H - 140, 44, { align: "center" }); }
  else if (lay === 1) { sunburst(g, W / 2, H / 2, 20, t * 0.4, ORANGE, "#ff8a45"); slamText(g, `Claude ${n}`, W / 2, H / 2, n.length > 3 ? 190 : 225, { outer: PAPER, fill: INK, rot: -0.05 }); pill(d, W / 2, H * 0.8, 44, { fill: INK, fg: PAPER }); }
  else { bg(INK); g.save(); g.fillStyle = ORANGE; g.beginPath(); g.moveTo(W * 0.55, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W * 0.4, H); g.fill(); g.restore(); card(g, n, W * 0.3, H / 2, 420, { fill: PAPER }); txt(g, d, W * 0.76, H / 2, { font: "Mono", size: 80, fill: INK }); }
}
function wordCard(t, i) { bg(i % 2 ? INK : "#1a0d07"); focusLines(g, W / 2, H / 2, 100, 300, 2000 + i, 0.35); slamText(g, WORDS[i % WORDS.length], W / 2, H / 2, 320, { rot: (i % 2 ? 0.05 : -0.05) }); }
const FLASHES = [b => sceneGadget(B(b), b, 52, 0), b => sceneSplit(B(89 + (b % 1)), 89 + (b % 1)), b => sceneScouter(B(106.2), 106.2), b => sceneBridgeForm(B(142 + (b % 1)), 142 + (b % 1)), b => sceneLaunch(B(173 + (b % 1)), 173 + (b % 1)), b => sceneWalk(B(41), 41), b => sceneReveal(B(26), 26), b => sceneClaude4(B(181), 181)];
function sceneMontage(t, b) {
  const i = Math.floor((b - 192) * 2), u = (b - 192) * 2 - i;
  if (i < 12) { if (i % 2 === 0) nameCard(t, i / 2, u); else FLASHES[(i >> 1) % FLASHES.length](b); }
  else if (i < 24) { const k = i - 12; if (k % 3 === 0) wordCard(t, k / 3); else FLASHES[(k + 3) % FLASHES.length](b); }
  else nameCard(t, i - 24, u);
  const z = lerp(1.1, 1, easeOut(u * 2)); if (z > 1.001) { tg.globalCompositeOperation = "source-over"; tg.drawImage(buf, 0, 0); g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.drawImage(tmp, -W / 2, -H / 2); g.restore(); }
}
function sceneBreakdown(t, b) {
  const u = b - 208;
  bg(INK);
  const hb = env(t, ["heart"], 6); g.save(); g.globalCompositeOperation = "lighter"; glow(g, W / 2, H / 2, 900, "rgba(255,106,31,ALPHA)", 0.15 * hb); g.restore();
  const n = Math.floor(clamp((u - 0.5) / 2) * 6), s = "그리고 지금".slice(0, n);
  const sh = u >= 6 ? (u - 6) * 8 : 0, r = rng(Math.floor(t * 60));
  card(g, s, W / 2 + (r() - 0.5) * sh, H / 2 + (r() - 0.5) * sh, 200);
  const cw = measure(g, s, "Serif", 200) * 0.82; if (Math.floor(t * 2.5) % 2 === 0) { g.fillStyle = ORANGE; g.fillRect(W / 2 + cw / 2 + 24, H / 2 - 80, 36, 160); }
  if (u >= 6) focusLines(g, W / 2, H / 2, 40 + (u - 6) * 60, 500, 2500 + Math.floor(t * 30), 0.3 + (u - 6) * 0.25);
}
function sceneFinal(t, b) {
  const u = b - 216;
  sunburst(g, W / 2, H / 2, 36, u * 0.1, "#1a0d07", ORANGE);
  halftoneBurst(g, W / 2, H / 2, 1300, 0.6 + 0.4 * env(t, ["beat"], 7), -u * 0.05, INK);
  drawOrb(g, W / 2, H / 2, 300, t, { corona: 1.6, power: 1.5 });
  const k = easeOutBack(u / 0.3);
  zoomed(k * (1 + 0.04 * env(t, ["beat"], 9)), W / 2, H / 2, () => {
    txt(g, "Claude", W / 2, H * 0.24, { size: 150, sx: 0.84, fill: PAPER, stroke: INK, lw: 20, join: "miter" });
    slamText(g, "5.5", W / 2, H * 0.58, 460, { rot: -0.04 });
  });
  if (u > 1) pill("2026.09 — 지금", W / 2, H * 0.88, 44, { fill: PAPER, fg: INK, font: "SansB" });
  menaceRing(g, t, B(216.5), MENACE_SPOTS, 1, 120);
  sparkles(g, W / 2, H / 2, 900, 30, t, 216, "#fff8ee", 30);
}
function posterFrame(t, b, u, showTitle = true) {
  sunburst(g, W / 2, H * 0.35, 30, u * 0.04, INK, "#1c120c");
  halftoneBurst(g, W / 2, H * 0.4, 1300, 0.7 + 0.3 * env(t, ["beat", "impact"], 7), u * 0.02);
  const cam = 1 + 0.06 * (u / 16) + 0.03 * env(t, ["impact"], 9);
  zoomed(cam, W / 2, H * 0.5, () => {
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, W / 2, H * 0.3, 900, "rgba(255,120,40,ALPHA)", 0.45); g.restore();
    drawMecha(g, W * 0.6, H * 0.6, 0.92, t, { eyes: 1, core: 1.2 });
    drawDario(g, W * 0.32, H + 30, 720, t, { wind: 1.5 });
  });
  menaceRing(g, t, B(224.5), MENACE_SPOTS, 1, 140);
  focusLines(g, W / 2, H * 0.4, 60, 700, 3000 + Math.floor(t * 12), 0.2);
  if (showTitle && u >= 8) { const k = easeOut((u - 8) / 0.6); g.save(); g.globalAlpha = k; g.fillStyle = "rgba(11,11,13,0.75)"; g.fillRect(0, H * 0.78, W, H * 0.22); card(g, "아모데이의 모험", W / 2, H * 0.885, 130); g.restore(); }
}
function scenePose(t, b) { posterFrame(t, b, b - 224); }
// ---------- H. outro ----------
function sceneOutro(t, b) {
  const u = b - 240, tf = B(239.9);
  posterFrame(tf, 239.9, 15.9, false);
  tg.globalCompositeOperation = "source-over"; tg.filter = "sepia(1) saturate(1.3) contrast(1.05) brightness(0.9)"; tg.drawImage(buf, 0, 0); tg.filter = "none";
  g.drawImage(tmp, 0, 0);
  // JoJo-style arrow
  const k = easeOut((u - 1.6) / 0.4), ax = lerp(-900, 90, k), ay = H - 190;
  if (u >= 1.6) {
    g.save(); g.fillStyle = "#3b2a1a"; g.strokeStyle = "#f0e2c4"; g.lineWidth = 6;
    g.beginPath(); g.moveTo(ax, ay - 50); g.lineTo(ax + 640, ay - 50); g.lineTo(ax + 640, ay - 90); g.lineTo(ax + 760, ay); g.lineTo(ax + 640, ay + 90); g.lineTo(ax + 640, ay + 50); g.lineTo(ax, ay + 50); g.closePath(); g.fill(); g.stroke();
    txt(g, "To Be Continued", ax + 330, ay + 2, { size: 64, fill: "#f0e2c4", sx: 0.95 });
    g.restore();
  }
  if (u >= 8) {
    const k2 = easeOutBack((u - 8) / 0.3);
    zoomed(k2, W * 0.72, H * 0.24, () => {
      g.fillStyle = "rgba(11,11,13,0.85)"; g.beginPath(); g.roundRect(W * 0.72 - 380, H * 0.24 - 120, 760, 240, 30); g.fill();
      txt(g, "구독하면 제2화", W * 0.72, H * 0.24 - 30, { font: "SansB", size: 64 });
      pill("구독", W * 0.72 - 110, H * 0.24 + 60, 40, { fill: ORANGE, fg: INK, font: "SansB" });
      pill("Coming Soon", W * 0.72 + 120, H * 0.24 + 60, 32, { fill: PAPER, fg: INK });
    });
  }
}
// ---------- A0. cold open ----------
function sceneCold(t, b) {
  const i = Math.floor(b);
  if (i === 0) sceneHangar(B(171.9), 171.9), sceneLaunch(B(172.15), 172.15);
  else if (i === 1) { sceneScouter(B(111.95), 111.95); shards(g, W / 2, H / 2, (b % 1) * SPB * 1.5, 9, 50); }
  else if (i === 2) sceneBridgeForm(B(140.2 + (b % 1)), 140.2 + (b % 1));
  else sceneFinal(B(216.3 + (b % 1)), 216.3 + (b % 1));
}

const SCENES = [
  [0, 4, sceneCold], [4, 8, sceneCards], [8, 10, sceneTitle], [10, 12, sceneStutter], [12, 16, sceneSlam], [16, 24, sceneDoor], [24, 32, sceneReveal],
  [32, 48, sceneWalk],
  [48, 52, (t, b) => sceneRummage(t, b, 48, 4)], [52, 60, (t, b) => sceneGadget(t, b, 52, 0)], [60, 62, (t, b) => sceneRummage(t, b, 60, 2)], [62, 70, (t, b) => sceneGadget(t, b, 62, 1)], [70, 72, (t, b) => sceneRummage(t, b, 70, 2)], [72, 80, (t, b) => sceneGadget(t, b, 72, 2)], [80, 96, sceneSplit],
  [96, 112, sceneScouter], [112, 120, sceneAfter],
  [120, 140, sceneTransform], [140, 152, sceneBridgeForm],
  [152, 172, sceneHangar], [172, 180, sceneLaunch], [180, 192, sceneClaude4],
  [192, 208, sceneMontage], [208, 216, sceneBreakdown], [216, 224, sceneFinal], [224, 240, scenePose],
  [240, 999, sceneOutro],
];
function drawScene(t) {
  const b = t / SPB;
  for (const [b0, b1, fn] of SCENES) if (b >= b0 && b < b1) { fn(t, b); break; }
  if (b >= 4 && b < 16) txt(g, "※ 패러디 · 실제 인물·회사와 무관한 팬 메이드 영상", W / 2, H - 46, { font: "SansM", size: 26, fill: DIM, alpha: 0.9 });
}
