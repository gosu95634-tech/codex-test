// Renders film.html at 24 fps into ffmpeg. usage: node render.js <out.mp4> --from s --to s [--stills t1,t2]
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const outPath = args[0], fps = Number(opt("--fps", 24)), from = Number(opt("--from", 0)), to = Number(opt("--to", 34)), stills = opt("--stills", "");
(async () => {
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", e => { console.error("pageerror:", e.message); process.exitCode = 1; });
  await page.goto("file://" + path.resolve(__dirname, "film.html"));
  const info = await page.evaluate(() => window.ready());
  if (info.fonts < 7) throw new Error("fonts missing: " + JSON.stringify(info));
  const grab = t => page.evaluate(t => window.renderFrame(t), t);
  if (stills) { for (const s of stills.split(",").map(Number)) fs.writeFileSync(outPath.replace(/\.\w+$/, `-${s.toFixed(2)}.jpg`), Buffer.from(await grab(s), "base64")); await browser.close(); return; }
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath], { stdio: ["pipe", "inherit", "inherit"] });
  const n0 = Math.round(from * fps), n1 = Math.round(to * fps), t0 = Date.now();
  for (let n = n0; n < n1; n++) {
    const jpg = Buffer.from(await grab(n / fps), "base64");
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once("drain", r));
    if ((n - n0) % 48 === 0) process.stderr.write(`frame ${n - n0}/${n1 - n0} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg " + c))));
  await browser.close();
  console.log(`rendered ${n1 - n0} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${outPath}`);
})().catch(e => { console.error(e); process.exit(1); });
