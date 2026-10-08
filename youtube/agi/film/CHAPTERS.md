# How to build a chapter

「인류의 마지막 발명」 is rendered frame by frame in headless Chromium:

1. A WebGL2 scene shader renders into an HDR buffer.
2. Post-processing adds bloom, god rays, ACES tonemapping, chromatic aberration, grain and a 2.39:1 letterbox.
3. A Canvas2D layer draws typography on top.
4. `film/render.js` grabs each frame and pipes it to ffmpeg.

The timing and on-screen text live in `../script.md`, which is the contract. The music is composed against its absolute times. Keep every cue within ±0.5 s of the script.

## Files and loading
- `film.html` loads these files in order:
  1. `shaders.js`
  2. `gl.js`
  3. `overlay.js`
  4. `timeline.js` (shared helpers and the cold open)
  5. `chN.js` (the chapter files)
  6. `master.js`
- A chapter file registers itself with `chapter("ch3", 100, fn)`, where `fn(k, T)` draws one frame:
  - `k` is seconds since the chapter started.
  - `T` is film time; use it for `uTime` and grain seeds.
- `master.js` lays the chapters end to end in the order cold, ch1, …, ch6, end.
- `film.html?only=ch3` loads only `ch3.js`, and the chapter then starts at t = 0. The `end` chapter lives in `ch6.js`.
- All classic scripts share one global scope, so wrap your whole file in an IIFE (`(() => { ... })();`). Shader names in `GL.frame` are program-cache keys, so prefix them with your chapter (`ch3_board`).

## Rendering stills and checking your work
```bash
cd youtube/agi/film
export NODE_PATH=$(npm root -g)
node render.js ../out/dev/ch3/s.jpg --only ch3 --stills 3,12.5,28,51   # writes s-3.00.jpg, ...
node render.js ../out/dev/ch3/clip.mp4 --only ch3 --from 20 --to 26 --fps 8   # optional motion check
node render.js x --only ch3 --duration                               # prints chapter length
```
- The cloud has no GPU. SwiftShader takes roughly 2–8 s per frame at preview scale, so render a handful of stills per iteration in one command; the browser starts once per command.
- Look at the stills with the Read tool and make a contact sheet (ffmpeg `tile` or PIL) to judge flow.
- `pageerror:` or `console:` lines mean your script threw. Fix them.

## Helpers you can use (globals)
- **overlay.js**
  - Constants: `W`, `H` (1920×1080), `o` (2D context), `out` (output canvas), `GOLD`, `STAR`, `DIMW`.
  - Math: `clamp`, `lerp`, `ease` (cubic in-out), `easeIn`, `rng(seed)`.
  - Vectors: `sub`, `dot`, `cross`, `norm`.
  - Text: `line(s, x, y, {size, font, color, alpha, spacing, align, glow, blur})` draws text with a soft glow; `label(s, x, y, ax, ay, alpha, size)` adds a leader line.
  - `project(cam, p)` maps a world point to pixels using the shader camera model.
  - `drawHumanHand`, `drawLightHand`, `flare(x, y, scale, alpha)`.
- **timeline.js**
  - Layout: `LB = 0.128` (letterbox fraction) and `BAR` (≈138 px bar height).
  - Easing: `smooth(a, b, x)` (smoothstep), `easeIO`.
  - Camera: `CAMF(pos, at, fov)` builds a camera; `camUniforms(cam)` turns it into uniforms.
  - Captions: `caption(t, t0, t1, (a, u) => …)` handles fade, breath and timing. Inside it, use `capB(text, a, u)` for a subtitle in the bottom bar or `capT(text, a, u)` for a small gold date or place in the top bar.
  - `chapterCard(k, "III", "신의 한 수")` draws the standard title card text; draw your own backdrop under it.
  - Quality: `FINAL()` and `SC(pre, fin)` for render scale. Preview is about 0.55; final on the user's GPU is 1.5.
  - Drawing: `pic(fn)` clips 2D drawing to the picture area, `bars()` repaints the letterbox, `blit()` draws the GL canvas.
  - Shared scenes: `heavensRings(spin)`, `lerp3`, `worldFrame`.
- **gl.js**
  - `GL.frame(scene, post)` renders one shader frame into `GL.canvas`; follow it with `blit()`.
    - `scene = { name, fs, scale, uniforms, textures }`.
    - `post = { bloom, thresh, exposure, rays: [x, y, amt] (screen uv), letterbox: LB, vignette, ca, grain, t, fade, lift }`.
  - Uniform types:
    - A number is a float. Length 2, 3 or 4 is a vec. Length 9, or a multiple of 9 above 16, is a mat3 or mat3 array.
    - To be explicit, pass `{vec4: [...]}`, `{vec3: [...]}`, `{float: [...]}` or `{mat3: [...]}`, which you need for vec4 arrays.
  - `GL.canvasTex(key, canvas, {mip, repeat})` uploads a 2D canvas once as a texture. Use it for engraved text, paper or glyphs on 3D surfaces, and build the canvas lazily on the first frame.
  - `GL.setBoard(cells)` sets the 19×19 Go board texture. `GL.gl` is the raw WebGL2 context.
- **shaders.js**
  - `COMMON`: header, hash, noise, `fbm`, `rot`, `camRay`, `stars`, `nebula`. Declares `uRes uTime uCamPos uCamFwd uCamUp uFov uA uB uC`.
  - `ENTITY`: the eye-ringed being, the "god" of the film.
  - Existing scenes: `heavens`, `orbit` (planet radius 6371 with the being), `world`, `stairs` (floating marble steps into light), `board` (Go board of light), `space`. Read their header comments for uniforms.
  - Add your own as `SHADERS.ch3_x = COMMON + \`...\`` inside your file, or copy and modify an existing one under your prefix.
- `master.js` adds film grain after your frame, so don't add more.

## Look: the bar is a cinema title sequence, not a slideshow
- **Feeling:** awe and scale, like looking at a god. Slow, deliberate, sacred.
  - Reference feel: *2001*, the title work in *Arrival* and *Dune*, Malick's *Voyage of Time*, cathedral light.
- **Palette:**
  - Near-black ink blue (≈ #05060b) and warm gold (#f3d9a4, HDR highlights well above 1.0 so bloom catches them).
  - Candle and amber light, pale marble, frost white for the winter.
  - Avoid saturated cyan, neon and RGB "tech" colours.
- **Materials and motifs:** starlight, gold, marble, stone, obsidian, parchment and ink, stained glass, frost, candle flame, astrolabes and armillary spheres, cathedral vaults.
- **Never:**
  - Circuits, blue neural nets, robots, binary or hex, code rain, glitches, HUD or hologram UI, emoji, clip-art.
  - Flat vector shapes or **black silhouettes**. The user rejected cheap-looking black figures and flat ground; everything must be lit, have depth (haze, fog, parallax, depth falloff) and material.
- **Motion:**
  - Every shot moves slowly: an eased camera push, orbit, rise, or light that breathes.
  - No frame is static for more than about 2 s.
  - Cuts are rare; prefer dissolves through light or darkness.
- **Typography:**
  - One line at a time, set in the bars with `capB` and `capT`.
  - Big centre text only for the moments the script marks as 화면 중앙.
  - Never put body text over a busy bright area.
  - Text content comes from `../script.md` exactly; only facts from `../facts.md`.
- **Chapter rhythm:** start with the chapter card over a dark backdrop that already belongs to your first scene. End your chapter with a soft fade to black in the last ~0.8 s unless the script says white.

## Performance budget
- **Preview** (SwiftShader, `SC()` preview scale) should stay at or under about 8 s per frame.
- **Final** (`FINAL()`, scale 1.5 on a desktop GPU) must stay well under about 150 ms per frame. A frame that runs too long can trip the GPU watchdog and lose the context.
- Keep raymarch loops at or under about 200 steps and volumetric loops at or under 64. Use a `uQ` uniform to raise steps on final.

## Ground rules for parallel work
- Edit only your own files: `film/chN.js`, plus helper data files named `film/chN-*.js` if needed.
- Do not edit shared files (`shaders.js`, `gl.js`, `overlay.js`, `timeline.js`, `master.js`, `film.html`, `render.js`). Copy what you need into your IIFE. If a shared change is truly required, describe it in your final report.
- Do not run git commands that change anything (no add, commit, push or checkout). The lead commits.
- Write scratch output under `youtube/agi/out/dev/<your id>/` (gitignored).
