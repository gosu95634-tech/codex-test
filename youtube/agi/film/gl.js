// HDR WebGL2 pipeline: scene shader -> float FBO -> bright pass -> blur + god rays -> ACES composite.
const GL = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 1920; canvas.height = 1080;
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 unavailable");
  const hdr = !!gl.getExtension("EXT_color_buffer_float");
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  gl.getExtension("OES_texture_float_linear");

  const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0, 1); }`;
  const tri = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const programs = {};
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + "\n" + src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n")); return s; }
  function program(name, fs) {
    if (programs[name]) return programs[name];
    const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace("[0]", "")] = gl.getUniformLocation(p, info.name); }
    return (programs[name] = { p, u });
  }
  function target(w, h) {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  const targets = {};
  function rt(key, w, h) { const k = `${key}:${w}x${h}`; return targets[k] || (targets[k] = target(w, h)); }
  function run(prog, out, uniforms = {}, textures = {}) {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.viewport(0, 0, out ? out.w : canvas.width, out ? out.h : canvas.height);
    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); if (prog.u[name]) gl.uniform1i(prog.u[name], unit); unit++; }
    for (const [name, v] of Object.entries(uniforms)) {
      const loc = prog.u[name]; if (!loc) continue;
      if (typeof v === "number") gl.uniform1f(loc, v);
      else if (v.float) gl.uniform1fv(loc, v.float); else if (v.vec2) gl.uniform2fv(loc, v.vec2); else if (v.vec3) gl.uniform3fv(loc, v.vec3);
      else if (v.vec4) gl.uniform4fv(loc, v.vec4); else if (v.mat3) gl.uniformMatrix3fv(loc, false, v.mat3);
      else if (v.length === 2) gl.uniform2fv(loc, v); else if (v.length === 3) gl.uniform3fv(loc, v); else if (v.length === 4) gl.uniform4fv(loc, v); else if (v.length === 9 || (v.length > 16 && v.length % 9 === 0)) gl.uniformMatrix3fv(loc, false, v);
      else gl.uniform4fv(loc, v);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, tri); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // 19x19 data texture for the Go board
  let boardTex = null;
  function setBoard(cells) { // cells: Float32 361 values
    if (!boardTex) { boardTex = gl.createTexture(); }
    gl.bindTexture(gl.TEXTURE_2D, boardTex);
    const data = new Uint8Array(361 * 4); cells.forEach((v, i) => { data[i * 4] = Math.round(v * 255); data[i * 4 + 3] = 255; });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 19, 19, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return boardTex;
  }

  // Upload a 2D canvas (text, engraving, paper) as a texture once and cache it by key. Draw the canvas after fonts are ready.
  const texCache = {};
  function canvasTex(key, src, { mip = true, repeat = false } = {}) {
    if (texCache[key]) return texCache[key];
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return (texCache[key] = tex);
  }

  /** Render one frame. scene = { fs, uniforms, scale, textures }, post = { bloom, exposure, rays:[x,y,amt], letterbox, vignette, ca, grain, t } */
  function frame(scene, post) {
    const W = canvas.width, H = canvas.height, s = scene.scale || 1;
    const sw = Math.round(W * s), sh = Math.round(H * s);
    const sc = rt("scene", sw, sh);
    run(program(scene.name, scene.fs), sc, { uRes: [sw, sh], ...scene.uniforms }, scene.textures || {});
    const bw = Math.round(W / 4), bh = Math.round(H / 4);
    const a = rt("bA", bw, bh), b = rt("bB", bw, bh), r = rt("rays", bw, bh);
    run(program("bright", SHADERS.bright), a, { uThresh: post.thresh ?? 0.8 }, { uTex: sc.tex });
    for (let k = 0; k < 2; k++) {
      run(program("blur", SHADERS.blur), b, { uDir: [1 / bw, 0] }, { uTex: a.tex });
      run(program("blur", SHADERS.blur), a, { uDir: [0, 1 / bh] }, { uTex: b.tex });
    }
    const rays = post.rays || [0.5, 0.5, 0];
    run(program("rays", SHADERS.rays), r, { uLight: [rays[0], rays[1]], uAmt: rays[2] }, { uTex: a.tex });
    run(program("composite", SHADERS.composite), null, {
      uBloom: post.bloom ?? 0.8, uExposure: post.exposure ?? 1.0, uLetterbox: post.letterbox ?? 0, uVignette: post.vignette ?? 0.35,
      uCA: post.ca ?? 0.0015, uGrain: post.grain ?? 0.05, uSeed: post.t ?? 0, uRes: [W, H], uFade: post.fade ?? 1, uLift: post.lift ?? 0,
    }, { uScene: sc.tex, uBloomTex: a.tex, uRays: r.tex });
    return canvas;
  }
  return { canvas, gl, frame, setBoard, canvasTex, hdr, renderer };
})();
