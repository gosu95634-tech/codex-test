// Renders thumbnail variants A and B to <outdir>/thumb-A.png, thumb-B.png (1920x1080; downscale with ffmpeg).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const outdir = process.argv[2] || "out";
(async () => {
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", e => { console.error("pageerror:", e.message); process.exitCode = 1; });
  await page.goto("file://" + path.resolve(__dirname, "thumb.html"));
  await page.evaluate(() => window.ready());
  const cues = JSON.parse(fs.readFileSync(path.resolve(__dirname, "cues-full.json"), "utf8"));
  await page.evaluate(c => setCues(c), cues);
  for (const k of ["A", "B"]) {
    const png = await page.evaluate(k => window.drawThumb(k), k);
    fs.writeFileSync(path.join(outdir, `thumb-${k}-full.png`), Buffer.from(png, "base64"));
  }
  await browser.close();
  console.log("thumbs written");
})().catch(e => { console.error(e); process.exit(1); });
