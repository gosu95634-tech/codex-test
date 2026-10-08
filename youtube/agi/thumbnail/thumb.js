// Renders thumbnail variants to JPEG: node thumb.js A B
// Background frames first: node ../film/render.js ../out/thumb/f.jpg --only cold --quality final --clean --stills 24.2,36.8
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("file://" + path.resolve(__dirname, "thumb.html"));
  for (const k of process.argv.slice(2)) { await page.evaluate(k => window.show(k), k); await page.locator("#t").screenshot({ path: path.resolve(__dirname, `thumb-${k}.jpg`), type: "jpeg", quality: 93 }); console.log("thumb", k); }
  await browser.close();
})();
