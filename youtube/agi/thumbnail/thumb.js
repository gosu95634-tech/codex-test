// Renders thumbnail variants to JPEG: node thumb.js A B C
// Background frame first: node ../film/render.js ../out/thumb/e.jpg --only ch5 --quality final --clean --stills 67.6 --gpu
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  let browser;                                   // installed Chrome or Edge first, as render.js does; Playwright's own Chromium last
  for (const channel of ["chrome", "msedge", undefined]) {
    try { browser = await chromium.launch({ channel, args: ["--allow-file-access-from-files"] }); break; } catch (e) { if (!channel) throw e; }
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("file://" + path.resolve(__dirname, "thumb.html"));
  for (const k of process.argv.slice(2)) { await page.evaluate(k => window.show(k), k); await page.locator("#t").screenshot({ path: path.resolve(__dirname, `thumb-${k}.jpg`), type: "jpeg", quality: 93 }); console.log("thumb", k); }
  await browser.close();
})();
