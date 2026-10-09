// Renders look-dev stills: node look.js <outdir> [names...]
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const outdir = process.argv[2] || "out";
const names = process.argv.slice(3).length ? process.argv.slice(3) : ["entity", "stairs", "board", "hands"];
(async () => {
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", e => { console.error("pageerror:", e.message); process.exitCode = 1; });
  page.on("console", m => { if (m.type() === "error") console.error("console:", m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "awe.html"));
  console.log("ready", JSON.stringify(await page.evaluate(() => window.ready())));
  for (const n of names) {
    const t0 = Date.now();
    const jpg = await page.evaluate(n => window.renderLook(n, 3.7), n);
    fs.writeFileSync(path.join(outdir, `look-${n}.jpg`), Buffer.from(jpg, "base64"));
    console.log(n, `${Date.now() - t0}ms`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
