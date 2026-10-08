// Times renderFrame at given times in one process: node bench.js t1,t2,...
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const ts = (process.argv[2] || "1.5,9.5,21").split(",").map(Number);
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", e => console.error("pageerror:", e.message));
  await page.goto("file://" + path.resolve(__dirname, "film.html"));
  await page.evaluate(() => window.ready());
  await page.evaluate(t => window.renderFrame(t), ts[0]); // warm-up (shader compile)
  for (const t of ts) { const t0 = Date.now(); await page.evaluate(t => window.renderFrame(t), t); console.log(`t=${t}: ${Date.now() - t0} ms`); }
  await browser.close();
})();
