#!/usr/bin/env node
// 「인류의 마지막 발명」 on your own PC: renders with your graphics card and saves the film to your Desktop.
// usage (from the repo root or this folder):  node youtube/agi/render-local.mjs [--chunks 2] [--from 0] [--to auto]
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const chunks = Number(opt("--chunks", 3)), from = Number(opt("--from", 0));
const log = m => console.log(`\x1b[33m▸\x1b[0m ${m}`);
const run = (cmd, o = {}) => execSync(cmd, { stdio: "inherit", cwd: here, ...o });

// 1. tools
try { execSync("ffmpeg -version", { stdio: "ignore" }); } catch {
  console.error("ffmpeg가 필요해요. Windows: winget install Gyan.FFmpeg  /  macOS: brew install ffmpeg  설치 후 다시 실행하세요.");
  process.exit(1);
}
if (!fs.existsSync(path.join(here, "node_modules", "playwright"))) { log("playwright 설치 중…"); run("npm install --no-audit --no-fund"); }

// 2. fonts (SIL OFL, from Google Fonts)
const fontDir = path.join(here, "..", "claude-history", "assets", "fonts");
const FONTS = {
  "NotoSerifKR-Light.ttf": "https://fonts.gstatic.com/s/notoserifkr/v32/3JnoSDn90Gmq2mr3blnHaTZXbOtLJDvui3JOnci4eM52.ttf",
  "NotoSerifKR-Medium.ttf": "https://fonts.gstatic.com/s/notoserifkr/v32/3JnoSDn90Gmq2mr3blnHaTZXbOtLJDvui3JOncjUeM52.ttf",
  "NotoSerifKR-Bold.ttf": "https://fonts.gstatic.com/s/notoserifkr/v32/3JnoSDn90Gmq2mr3blnHaTZXbOtLJDvui3JOncgBf852.ttf",
  "NotoSansKR-Light.ttf": "https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzrQyeLQ.ttf",
  "NotoSansKR-Medium.ttf": "https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzztgyeLQ.ttf",
  "NotoSansKR-Black.ttf": "https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzkM1eLQ.ttf",
  "Cormorant-Regular.ttf": "https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_v86GnM.ttf",
  "Cormorant-SemiBold.ttf": "https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_iE9GnM.ttf",
  "Cormorant-Italic.ttf": "https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jDOjw.ttf",
};
const get = (url, dest) => new Promise((res, rej) => https.get(url, r => {
  if (r.statusCode >= 300 && r.headers.location) return get(r.headers.location, dest).then(res, rej);
  if (r.statusCode !== 200) return rej(new Error(`${url}: HTTP ${r.statusCode}`));
  const f = fs.createWriteStream(dest); r.pipe(f); f.on("finish", () => f.close(res));
}).on("error", rej));
fs.mkdirSync(fontDir, { recursive: true });
for (const [name, url] of Object.entries(FONTS)) { const dest = path.join(fontDir, name); if (!fs.existsSync(dest)) { log(`폰트 받는 중: ${name}`); await get(url, dest); } }

// 3. render in parallel chunks on the GPU
const out = path.join(here, "out"); fs.mkdirSync(out, { recursive: true });
let to = opt("--to", "auto");
if (to === "auto") { // ask the film itself how long it is
  const info = execSync(`"${process.execPath}" "${path.join(here, "film", "render.js")}" x --duration --gpu`, { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  to = JSON.parse(info.trim().split("\n").pop()).duration;
}
to = Number(to);
const fps = 24, f0 = Math.round(from * fps), f1 = Math.round(to * fps), per = Math.ceil((f1 - f0) / chunks);
log(`GPU 렌더링 시작: ${from}–${to}초, ${f1 - f0}프레임, ${chunks}개 동시`);
const t0 = Date.now();
await Promise.all(Array.from({ length: chunks }, (_, i) => new Promise((res, rej) => {
  const a = f0 + i * per, b = Math.min(f1, a + per);
  const p = spawn(process.execPath, [path.join(here, "film", "render.js"), path.join(out, `part${i}.mp4`), "--from", String(a / fps), "--to", String(b / fps), "--gpu"], { cwd: here, stdio: ["ignore", "inherit", "inherit"] });
  p.on("close", c => c === 0 ? res() : rej(new Error(`chunk ${i} failed (${c})`)));
})));
fs.writeFileSync(path.join(out, "parts.txt"), Array.from({ length: chunks }, (_, i) => `file '${path.join(out, `part${i}.mp4`).replace(/\\/g, "/")}'`).join("\n"));
run(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${path.join(out, "parts.txt")}" -c copy "${path.join(out, "video.mp4")}"`);

// 4. mux the pre-mastered score (synthesized and loudness-normalized in the cloud, committed as audio/score.m4a)
const desk = [path.join(os.homedir(), "Desktop"), path.join(os.homedir(), "OneDrive", "Desktop"), path.join(os.homedir(), "OneDrive", "바탕 화면"), path.join(os.homedir(), "바탕 화면")].find(d => fs.existsSync(d)) || out;
const final = path.join(desk, "인류의 마지막 발명.mp4");
run(`ffmpeg -y -loglevel error -i "${path.join(out, "video.mp4")}" -ss ${from} -i "${path.join(here, "audio", "score.m4a")}" -map 0:v -map 1:a -c:v copy -c:a copy -shortest -movflags +faststart "${final}"`);
log(`완료 (${((Date.now() - t0) / 60000).toFixed(1)}분): ${final}`);
