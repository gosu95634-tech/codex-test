// Lays the registered chapters end to end and exposes renderFrame(t). ?only=<id> renders one chapter alone from t = 0.
const ORDER = ["cold", "ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "end"];
const ONLY = new URLSearchParams(location.search).get("only");
const SEGMENTS = [];
{ let acc = 0; for (const id of ORDER) { const c = CHAPTERS[id]; if (!c || (ONLY && id !== ONLY)) continue; SEGMENTS.push([acc, acc + c.len, c.fn, id]); acc += c.len; } }
function drawFrame(t) {
  o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, H); o.fillStyle = "#000"; o.fillRect(0, 0, W, H);
  for (const [t0, t1, fn] of SEGMENTS) if (t >= t0 && t < t1) { o.save(); fn(t - t0, t); o.restore(); break; }
  grainOver(Math.floor(t * 24), 0.045);
}
window.FILM_DURATION = SEGMENTS.length ? SEGMENTS[SEGMENTS.length - 1][1] : 0;
window.SEGMENT_TABLE = SEGMENTS.map(([a, b, , id]) => [id, a, b]);
window.renderFrame = t => { drawFrame(t); return out.toDataURL("image/jpeg", 0.95).slice(23); };
