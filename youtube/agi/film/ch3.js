// 제3장 · 신의 한 수 · ch3 (100 s, film 203–303). See ../script.md.
// Board of light (real records of AlphaGo–Lee Sedol games 2 and 4), the transformer's gilded attention, the night Earth.
// Data (move lists, land mask, cities) lives in ch3-data.js, which this file loads itself.
if (!window.CH3_DATA && document.readyState === "loading") document.write('<script src="ch3-data.js"><\/script>');
(() => {
// ---------------------------------------------------------------- timing (local seconds; music syncs marked ★)
const T37 = 28.0;            // ★ move 37 lands (game 2)
const T78 = 50.0;            // ★ move 78 lands (game 4)
const G2_FIRST = 20.7, G2_LAST = 26.3;     // moves 1–36 of game 2
const G4_FIRST = 43.3, G4_LAST = 46.5;     // moves 1–77 of game 4 cascade in
const DROP37 = 1.0;          // the two great stones descend for 1 s before contact

// ---------------------------------------------------------------- small helpers
const v3 = (x, y, z) => [x, y, z];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len3 = a => Math.hypot(a[0], a[1], a[2]);
// Cubic Hermite spline through keyframes [[t, [values...]], ...] with Catmull-Rom tangents; flat at both ends.
function spline(keys, k) {
  const n = keys.length;
  if (k <= keys[0][0]) return keys[0][1].slice();
  if (k >= keys[n - 1][0]) return keys[n - 1][1].slice();
  let i = 0; while (k > keys[i + 1][0]) i++;
  const tan = j => (j === 0 || j === n - 1) ? keys[j][1].map(() => 0) : keys[j][1].map((_, q) => (keys[j + 1][1][q] - keys[j - 1][1][q]) / (keys[j + 1][0] - keys[j - 1][0]));
  const [t0, p0] = keys[i], [t1, p1] = keys[i + 1], h = t1 - t0, u = (k - t0) / h;
  const m0 = tan(i), m1 = tan(i + 1);
  const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
  return p0.map((v, q) => h00 * v + h10 * h * m0[q] + h01 * p1[q] + h11 * h * m1[q]);
}
const camOf = (pos, at, fov) => ({ pos, fwd: norm(sub(at, pos)), up: [0, 1, 0], fov });

// ---------------------------------------------------------------- raw GL: own HDR pass (scene → texture) so a DOF pass can follow
const P = (() => {
  const gl = GL.gl;
  const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0, 1); }`;
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const progs = {}, targets = {};
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(name, fs) {
    if (progs[name]) return progs[name];
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace("[0]", "")] = gl.getUniformLocation(p, info.name); }
    return (progs[name] = { p, u });
  }
  function target(key, w, h) {
    const k = `${key}:${w}x${h}`; if (targets[k]) return targets[k];
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, GL.hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, GL.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return (targets[k] = { tex, fb, w, h });
  }
  function run(name, fs, key, w, h, uniforms, textures = {}) {
    const pr = prog(name, fs), out = target(key, w, h);
    gl.useProgram(pr.p); gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb); gl.viewport(0, 0, w, h);
    let unit = 0;
    for (const [nm, tex] of Object.entries(textures)) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); if (pr.u[nm]) gl.uniform1i(pr.u[nm], unit); unit++; }
    for (const [nm, v] of Object.entries({ uRes: [w, h], ...uniforms })) {
      const loc = pr.u[nm]; if (!loc) continue;
      if (typeof v === "number") gl.uniform1f(loc, v);
      else if (v.vec4) gl.uniform4fv(loc, v.vec4); else if (v.float) gl.uniform1fv(loc, v.float);
      else if (v.length === 2) gl.uniform2fv(loc, v); else if (v.length === 3) gl.uniform3fv(loc, v); else gl.uniform4fv(loc, v);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out.tex;
  }
  // Small data textures, re-uploaded every frame.
  const dtex = {};
  function dataTex(key, w, h, data, filter = "nearest") {
    let t = dtex[key]; if (!t) { t = dtex[key] = gl.createTexture(); }
    gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const f = filter === "nearest" ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  return { run, dataTex };
})();

// ---------------------------------------------------------------- the games
// World frame: board centre at the origin, y up, one unit per grid line. A viewer at -z looking toward +z sees the
// standard diagram (row 1 nearest, column A on the left). Shader screen-right is -x, so x = 9 - col, z = 9 - row(from top).
const GAMES = {};
function game(id) {
  if (GAMES[id]) return GAMES[id];
  const s = window.CH3_DATA[id], mv = [];
  for (let i = 0; i < s.length; i += 2) mv.push({ c: s.charCodeAt(i) - 97, r: s.charCodeAt(i + 1) - 97, color: (i / 2) % 2 === 0 ? 1 : 2, cap: Infinity });
  // replay with captures: a stone records the move index that removed it
  const at = new Int16Array(361).fill(-1);
  const nbr = (c, r) => [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([a, b]) => a >= 0 && a < 19 && b >= 0 && b < 19);
  const group = (c, r) => { const col = mv[at[r * 19 + c]].color, seen = new Set([r * 19 + c]), st = [[c, r]]; let libs = 0;
    while (st.length) { const [x, y] = st.pop(); for (const [a, b] of nbr(x, y)) { const j = b * 19 + a; if (at[j] < 0) libs++; else if (mv[at[j]].color === col && !seen.has(j)) { seen.add(j); st.push([a, b]); } } }
    return { seen, libs }; };
  mv.forEach((m, i) => {
    at[m.r * 19 + m.c] = i;
    for (const [a, b] of nbr(m.c, m.r)) { const j = b * 19 + a; if (at[j] >= 0 && mv[at[j]].color !== m.color) { const g = group(a, b); if (!g.libs) g.seen.forEach(q => { mv[at[q]].cap = i; at[q] = -1; }); } }
  });
  return (GAMES[id] = mv);
}
// Landing times for each move.
function moveTimes(n, first, last, special) {
  const t = [];
  for (let i = 0; i < n - 1; i++) { const u = i / (n - 2); t.push(lerp(first, last, u + 0.10 * Math.sin(u * Math.PI) * (u - 0.5) * -2)); }
  t.push(special);
  return t;
}
const TIMES = { G2: moveTimes(37, G2_FIRST, G2_LAST, T37), G4: moveTimes(78, G4_FIRST, G4_LAST, T78) };
// Per-cell texture: R kind*60 (1 black, 2 white, 3 the gold-lit 37, 4 the candle-lit 78), G landing pulse, B lift, A presence.
const cellBuf = new Uint8Array(361 * 4);
function boardState(id, k, opts = {}) {
  const mv = game(id), times = TIMES[id], n = mv.length;
  cellBuf.fill(0);
  const pulses = []; let liftMax = 0;
  for (let i = 0; i < n; i++) {
    const m = mv[i], t = times[i], big = i === n - 1;
    const drop = big ? DROP37 : (opts.cascade ? 0.12 : 0.17);
    if (k < t - drop) continue;
    const capT = m.cap < n ? times[m.cap] : Infinity;
    let alpha = clamp((k - (t - drop)) / (drop * 0.45));
    if (k > capT) alpha *= 1 - clamp((k - capT) / 0.3);
    if (alpha <= 0) continue;
    const tau = clamp((t - k) / drop);
    const lift = big ? Math.pow(tau, 2.2) * 0.85 : tau * tau * 0.55;
    const age = k - t;
    const pulse = age >= 0 ? Math.exp(-age * (opts.cascade ? 5 : 3.2)) : 0;
    const kind = big ? (m.color === 1 ? 3 : 4) : m.color;
    const j = (m.r * 19 + m.c) * 4;
    cellBuf[j] = kind * 60; cellBuf[j + 1] = Math.round(pulse * 255); cellBuf[j + 2] = Math.round(lift * 255); cellBuf[j + 3] = Math.round(alpha * 255);
    liftMax = Math.max(liftMax, lift);
    if (age >= 0 && age < 1.4 && !big) pulses.push([9 - m.c, 9 - m.r, age, opts.cascade ? 0.45 : 1]);
  }
  pulses.sort((a, b) => a[2] - b[2]);
  const pul = []; for (let i = 0; i < 8; i++) pul.push(...(pulses[i] || [0, 0, 9, 0]));
  const last = mv[n - 1];
  return { tex: P.dataTex("ch3board", 19, 19, cellBuf), pul, liftMax, big: [9 - last.c, 9 - last.r], age: k - times[n - 1] };
}

// ---------------------------------------------------------------- shaders
const BOARD_FS = COMMON + `
uniform sampler2D uBoard;
uniform vec4 uD;   // x lift max, y grid glow, z hoshi glow, w key light
uniform vec4 uE;   // move 37: x, z, age (s after contact), amount
uniform vec4 uF;   // move 78: x, z, age, amount
uniform vec4 uG;   // cold side light (machine), warm side light (human), haze, sea of lights
uniform vec4 uH;   // quality, board dim, ignition sweep front (z), sea spread radius
uniform vec4 uPul[8];
#define BX 9.9
#define BT 0.85
#define SR 0.476
#define SH 0.205
#define LIFT 1.5
const float RS=(SR*SR+SH*SH)/(2.*SH);
const vec3 KEYP=vec3(6.,15.,-8.);
const vec3 KEYAT=vec3(-.5,0.,1.);
const vec3 COLDP=vec3(-36.,2.5,12.);
const vec3 WARMP=vec3(36.,2.5,-9.);
const vec3 KEYC=vec3(1.,.9,.77);
const vec3 COLDC=vec3(.88,.91,1.);
const vec3 WARMC=vec3(1.,.56,.24);
const vec3 GOLDC=vec3(1.,.73,.36);
const vec3 C37=vec3(1.,.80,.50);
const vec3 C78=vec3(1.,.46,.15);
float flick=1.;
vec4 cellv(vec2 c){ return texelFetch(uBoard, ivec2(int(9.-c.x+.5), int(9.-c.y+.5)), 0); }
int kindOf(vec4 v){ return int(v.r*255./60.+.5); }
float keySpot(vec3 p){ vec3 d=normalize(p-KEYP); return smoothstep(.80,.93,dot(d,normalize(KEYAT-KEYP))); }
float keyShaft(vec3 p){ vec3 d=normalize(p-KEYP); return smoothstep(.86,.96,dot(d,normalize(KEYAT-KEYP))); }
float n3(vec3 p){ return noise(p); }
bool hitStone(vec3 ro, vec3 rd, vec3 C, out float t, out vec3 n){
  vec3 c1=C-vec3(0.,RS-SH,0.), c2=C+vec3(0.,RS-SH,0.);
  vec3 oc=ro-c1; float b=dot(oc,rd), c=dot(oc,oc)-RS*RS, h=b*b-c; if(h<0.) return false; h=sqrt(h);
  float a0=-b-h, a1=-b+h;
  oc=ro-c2; b=dot(oc,rd); c=dot(oc,oc)-RS*RS; float h2=b*b-c; if(h2<0.) return false; h2=sqrt(h2);
  float b0=-b-h2, b1=-b+h2;
  float tn=max(a0,b0), tf=min(a1,b1); if(tn>tf||tn<0.) return false;
  t=tn; vec3 p=ro+rd*t; n= a0>b0 ? normalize(p-c1) : normalize(p-c2);
  vec3 q=p-C; float e=abs(q.y)/SH;                                           // 0 on the rim
  vec3 rim=normalize(vec3(q.x, q.y*2.2, q.z));
  n=normalize(mix(rim, n, smoothstep(0.,.42,e)));
  return true; }
bool traceStones(vec3 ro, vec3 rd, float yTop, out float tH, out vec3 nH, out vec3 cH, out vec4 vH){
  float t0=0., t1=1e9;
  if(abs(rd.y)<1e-6){ if(ro.y<0.||ro.y>yTop) return false; }
  else { float ta=-ro.y/rd.y, tb=(yTop-ro.y)/rd.y; t0=max(t0,min(ta,tb)); t1=min(t1,max(ta,tb)); }
  if(abs(rd.x)<1e-6){ if(abs(ro.x)>9.5) return false; } else { float ta=(-9.5-ro.x)/rd.x, tb=(9.5-ro.x)/rd.x; t0=max(t0,min(ta,tb)); t1=min(t1,max(ta,tb)); }
  if(abs(rd.z)<1e-6){ if(abs(ro.z)>9.5) return false; } else { float ta=(-9.5-ro.z)/rd.z, tb=(9.5-ro.z)/rd.z; t0=max(t0,min(ta,tb)); t1=min(t1,max(ta,tb)); }
  if(t0>=t1) return false;
  vec3 p=ro+rd*(t0+1e-4);
  vec2 ci=clamp(floor(p.xz+.5), vec2(-9.), vec2(9.));
  vec2 sd=vec2(rd.x>=0.?1.:-1., rd.z>=0.?1.:-1.);
  vec2 rv=vec2(abs(rd.x)<1e-6?1e-6*sd.x:rd.x, abs(rd.z)<1e-6?1e-6*sd.y:rd.z);
  vec2 tN=(ci+.5*sd-ro.xz)/rv, tD=abs(1./rv);
  for(int i=0;i<30;i++){
    vec4 v=cellv(ci);
    if(v.a>.003&&v.r>.1){ vec3 C=vec3(ci.x, SH+v.b*LIFT, ci.y); float t; vec3 n;
      if(hitStone(ro,rd,C,t,n)){ tH=t; nH=n; cH=C; vH=v; return true; } }
    float tn=min(tN.x,tN.y); if(tn>t1) break;
    if(tN.x<tN.y){ tN.x+=tD.x; ci.x+=sd.x; } else { tN.y+=tD.y; ci.y+=sd.y; }
    if(abs(ci.x)>9.||abs(ci.y)>9.) break; }
  return false; }
bool hitBoard(vec3 ro, vec3 rd, out float t, out vec3 n){
  vec3 r=vec3(abs(rd.x)<1e-6?1e-6:rd.x, abs(rd.y)<1e-6?1e-6:rd.y, abs(rd.z)<1e-6?1e-6:rd.z);
  vec3 ta=(vec3(-BX,-BT,-BX)-ro)/r, tb=(vec3(BX,0.,BX)-ro)/r;
  vec3 mn=min(ta,tb), mx=max(ta,tb);
  float tn=max(max(mn.x,mn.y),mn.z), tf=min(min(mx.x,mx.y),mx.z);
  if(tn>tf||tf<0.) return false; t=tn;
  n= tn==mn.x ? vec3(-sign(r.x),0.,0.) : (tn==mn.y ? vec3(0.,-sign(r.y),0.) : vec3(0.,0.,-sign(r.z)));
  return true; }
// the void: ink-blue dark, a faint warm nebula, rare stars, and the two presences glowing low on the horizon
vec3 env(vec3 d){
  vec3 c=mix(vec3(.0045,.005,.009), vec3(.0018,.002,.004), clamp(d.y*1.5+.3,0.,1.));
  vec3 kd=normalize(KEYP-KEYAT); float k=dot(d,kd);
  c+=KEYC*(smoothstep(.972,.99,k)*2.6+pow(max(k,0.),12.)*.04)*uD.w;
  c+=COLDC*uG.x*(pow(max(dot(d,normalize(COLDP)),0.),18.)*.55+pow(max(dot(d,normalize(COLDP)),0.),400.)*2.);
  c+=WARMC*uG.y*flick*(pow(max(dot(d,normalize(WARMP)),0.),18.)*.55+pow(max(dot(d,normalize(WARMP)),0.),400.)*2.);
  return c; }
vec3 sky(vec3 rd){
  vec3 c=mix(vec3(.0045,.005,.009), vec3(.0015,.0017,.0035), clamp(rd.y*1.5+.3,0.,1.));
  vec3 dc=normalize(COLDP), dw=normalize(WARMP);
  c+=(COLDC*uG.x*pow(max(dot(rd,dc),0.),6.)+WARMC*uG.y*flick*pow(max(dot(rd,dw),0.),6.))*.06*exp(-abs(rd.y)*6.);
  c+=nebula(rd, vec3(.010,.008,.016), vec3(.05,.032,.012))*.5*smoothstep(-.3,.4,rd.y);
  c+=stars(rd,.22)*smoothstep(-.05,.3,rd.y);
  return c; }
// the sea of lights far below: the watching world (2 hundred million), spreading out from beneath the board
vec3 sea(vec3 ro, vec3 rd, out float tS){
  tS=1e4; if(rd.y>-.002||uG.w<=0.) return vec3(0.);
  const float Y=-55.; float t=(Y-ro.y)/rd.y; tS=t; vec3 p=ro+rd*t;
  const float cs=1.6; vec2 q=p.xz/cs; vec2 id=floor(q), f=q-id;
  float h=hash12(id+.5), h2=hash12(id*1.73+3.1), h3=hash12(id*2.31+7.7);
  vec2 pc=vec2(h2,h3)*.6+.2;
  float town=smoothstep(.42,.75,fbm(vec3(p.xz*.018,2.3)));         // clusters of light, like towns seen from the sky
  float fp=t/(uFov*uRes.y)/max(-rd.y,.05)/cs;                 // pixel footprint in cells
  float r=max(.05, fp*.9);
  float dd=length(f-pc);
  float on=step(1.-(.15+.75*town),h)*(.25+.75*h3*h3);
  float pt=on*exp(-dd*dd/(r*r))*(.05*.05)/(r*r);
  float avg=(.15+.75*town)*.4*3.1416*.05*.05;
  float v=mix(pt, avg, smoothstep(.12,.5,fp));
  float R=length(p.xz); float spread=smoothstep(uH.w, uH.w-40., R);
  float tw=.7+.3*sin(uTime*(1.5+h2*2.)+h*60.);
  vec3 c=mix(vec3(1.,.5,.2), vec3(1.,.78,.5), h2*h2);
  return c*v*tw*spread*uG.w*80.*exp(-t*.004); }
float lineCov(float d, float w, float fw){ fw=max(fw,1e-4); return clamp((min(d+fw*.5,w)-max(d-fw*.5,-w))/fw,0.,1.); }
vec3 shadeStone(vec3 p, vec3 n, vec3 rd, vec3 C, vec4 v, bool cheap);
vec3 shadeTop(vec3 p, vec3 rd, float t){
  vec2 g=p.xz; vec3 V=-rd; vec3 n=vec3(0.,1.,0.);
  vec2 c0=floor(g+.5);
  vec3 Lk=normalize(KEYP-p); vec2 shOff=-Lk.xz/Lk.y;
  float ao=1., sh=1.;
  if(abs(g.x)<9.6&&abs(g.y)<9.6){
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 c=c0+vec2(float(i),float(j)); if(abs(c.x)>9.||abs(c.y)>9.) continue;
      vec4 v=cellv(c); if(v.a<.003||v.r<.1) continue; float lift=v.b*LIFT;
      float d=length(g-c);
      ao*=1.-v.a*.8*exp(-max(d-.36,0.)*8.)/(1.+lift*5.);
      vec2 sc=c+shOff*(SH+lift); float ds=length(g-sc); float pen=.10+.3*(SH+lift);
      sh*=1.-v.a*.9*smoothstep(SR+pen, SR-pen*.6, ds); } }
  float spot=keySpot(p);
  // dark smoked glass with a slow inner cloud
  float cl=fbm(vec3(g*.16,1.7));
  vec3 base=vec3(.012,.010,.009)*(.7+.6*cl);
  float NV=max(dot(n,V),0.);
  float fr=.05+.95*pow(1.-NV,5.);
  vec3 col=base*KEYC*uD.w*spot*max(Lk.y,0.)*sh*ao*1.4;
  col+=base*(COLDC*uG.x*.25+WARMC*uG.y*flick*.25);
  col+=mix(WARMC*1.2, COLDC*.9, smoothstep(5.,-5.,g.x))*uB.x*.035*exp(-abs(g.x)*.06)*(1.-fr);
  // reflection (with the stones mirrored in the glass)
  vec2 wob=vec2(n3(vec3(g*1.3,0.)), n3(vec3(g*1.3,5.)))-.5;
  vec3 nr=normalize(vec3(wob.x*.012,1.,wob.y*.012));
  vec3 R=reflect(rd,nr); vec3 refl=sky(R);
  float tr; vec3 nn, cc; vec4 vv;
  if(traceStones(p+vec3(0.,.002,0.),R,2.*SH+uD.x*LIFT+.02,tr,nn,cc,vv)) refl=shadeStone(p+R*tr,nn,R,cc,vv,true);
  col+=refl*fr*mix(.5,1.,ao);
  // gold inlay grid
  vec2 fw=fwidth(g); vec2 gd=abs(fract(g+.5)-.5);
  float inX=step(abs(g.y),9.03), inZ=step(abs(g.x),9.03);
  float wx=abs(floor(g.x+.5))>8.5?.028:.016, wz=abs(floor(g.y+.5))>8.5?.028:.016;
  float lx=lineCov(gd.x,wx,fw.x)*inX*step(abs(g.x),9.5), lz=lineCov(gd.y,wz,fw.y)*inZ*step(abs(g.y),9.5);
  float L=max(lx,lz);
  float rg=length(g);
  float sweep=smoothstep(uH.z+.4, uH.z-2.2, rg);
  float front=exp(-pow((rg-uH.z)/.7,2.))*smoothstep(13.5,9.,uH.z);
  vec3 tint=mix(vec3(1.,.62,.30), vec3(.85,.88,1.), smoothstep(3.5,-3.5,g.x));
  vec3 gcol=mix(GOLDC, tint*vec3(1.,.9,.75), uB.x);
  vec3 gem=gcol*uD.y*(.10+.32*spot)*sweep + GOLDC*front*1.6;
  vec3 gref=vec3(1.,.78,.42)*(env(R)*.8+KEYC*pow(max(dot(R,Lk),0.),24.)*uD.w*.9)*sweep;
  // hoshi
  vec2 hp=clamp(floor((g+3.)/6.)*6., vec2(-6.), vec2(6.)); float hd=length(g-hp);
  float hsw=smoothstep(uH.z+.3, uH.z-1., length(hp));
  float breath=.85+.15*sin(uTime*1.3+hp.x*.7+hp.y*.4);
  vec3 hos=mix(GOLDC,tint*vec3(1.,.9,.75),uB.x*.7)*(smoothstep(.095,.06,hd)*2.2+exp(-hd*hd*14.)*.35)*uD.z*breath*hsw;
  // landing pulses: a soft ring of light from each stone that lands
  vec3 pl=vec3(0.); float plg=0.;
  for(int i=0;i<8;i++){ vec4 q=uPul[i]; if(q.w<=0.) continue; float d=length(g-q.xy), a=q.z;
    float r=.45+a*1.6; float ring=exp(-pow((d-r)/(.35+a*.5),2.))*exp(-a*3.4)*q.w;
    float disc=exp(-d*d*3.)*exp(-a*6.)*q.w;
    pl+=vec3(1.,.84,.6)*(ring*.10+disc*.45); plg+=ring*.5+disc; }
  // move 37: the ripple of light across the whole board, and its corona
  vec3 rp=vec3(0.); float rpg=0.;
  if(uE.w>0.){ float d=length(g-uE.xy), a=uE.z;
    if(a<0.){ float s=smoothstep(-1.,0.,a); rp+=C37*exp(-d*d*2.5)*s*s*.9; }
    else { float amp=uE.w*exp(-a*.28);
      for(int e=0;e<2;e++){ float ae=a-float(e)*.8; if(ae<0.) continue; float R2=ae*5.6;
        float w=.22+.10*ae; float x=(d-R2)/w; float ring=(x>0.?exp(-x*x*2.2):exp(-x*x*.35))*amp*(e==0?1.:.3);
        rpg+=ring; rp+=C37*ring*.16; }
      rp+=C37*smoothstep(a*5.6,0.,d)*.012*amp;
      float cor=exp(-max(d-.46,0.)*5.)*(1.5+3.*exp(-a*1.3))*smoothstep(.40,.47,d)+exp(-max(d-.46,0.)*1.4)*.3*(1.+2.*exp(-a*2.));
      rp+=C37*cor*uE.w; } }
  // move 78: a candle-warm light that spreads slowly over the board
  vec3 wm=vec3(0.); float wmg=0.;
  if(uF.w>0.){ float d=length(g-uF.xy), a=uF.z;
    if(a<0.){ float s=smoothstep(-1.,0.,a); wm+=C78*exp(-d*d*2.)*s*s*.8; }
    else { float I=uF.w*flick*(.8+.5*smoothstep(0.,2.5,a))+uF.w*2.*exp(-a*2.2);
      float reach=smoothstep(a*2.4+1., a*2.4-2., d);
      wm+=C78*I*(base*40./(1.+d*d*1.2) + exp(-max(d-.5,0.)*1.8)*.5*(1.+exp(-a*2.)) );
      wm+=C78*exp(-pow((d-.52)/.06,2.))*I*1.4;
      wmg=reach*I; } }
  vec3 gl=gem+gref*.6 + GOLDC*plg*1.2 + C37*rpg*8. + C78*wmg*1.2*uD.y;
  col=mix(col, gl, L*.92);
  col+=hos+pl+rp+wm;
  // depth inside the glass: faint gilded dust far beneath the surface
  vec3 rr=refract(rd,n,.66); vec3 q=p+rr*(1.1/max(-rr.y,.2));
  float dust=pow(fbm(vec3(q.xz*.35,uTime*.01)),4.)*.6;
  col+=GOLDC*dust*.05*(1.-fr)*uD.y;
  return col*mix(.25,1.,ao); }
vec3 shadeSide(vec3 p, vec3 n, vec3 rd){
  vec3 V=-rd; float fr=.05+.95*pow(1.-max(dot(n,V),0.),5.);
  vec3 col=sky(reflect(rd,n))*fr;
  float top=exp(-max(-p.y,0.)*55.); float bot=exp(-max(p.y+BT,0.)*40.);
  col+=GOLDC*(top*1.1*uD.y+bot*.15*uD.y);
  col+=vec3(.010,.008,.007)*(.4+.6*keySpot(p))*uD.w;
  col+=vec3(1.,.55,.22)*uG.w*.02*smoothstep(0.,-BT,p.y);
  return col; }
vec3 shadeStone(vec3 p, vec3 n, vec3 rd, vec3 C, vec4 v, bool cheap){
  int kind=kindOf(v); bool white=(kind==2||kind==4);
  vec3 V=-rd; float NV=max(dot(n,V),0.);
  vec3 Lk=normalize(KEYP-p); float spot=keySpot(p);
  float lift=v.b*LIFT;
  float hgt=p.y-(C.y-SH);
  float ao=mix(.3,1.,smoothstep(0.,.24,hgt)); ao=mix(ao,1.,clamp(lift*4.,0.,1.));
  if(!cheap){ float nb=0.;
    for(int q=0;q<4;q++){ vec2 dd=q==0?vec2(1.,0.):(q==1?vec2(-1.,0.):(q==2?vec2(0.,1.):vec2(0.,-1.))); vec2 c=C.xz+dd;
      if(abs(c.x)>9.||abs(c.y)>9.) continue; vec4 w=cellv(c); if(w.a>.003&&w.r>.1) nb+=max(dot(n.xz,dd),0.)*w.a; }
    ao*=1.-.5*nb*(1.-max(n.y,0.)); }
  float hs=hash12(C.xz*7.31+3.); float ang=hs*6.283; vec2 sdir=vec2(cos(ang),sin(ang));
  vec3 q=p-C; float str=0.;
  vec3 alb;
  if(white){ float s=dot(q.xz,sdir); str=.5+.5*sin(s*95.+sin(s*11.+hs*20.)*2.5+hs*9.); str=pow(str,2.);
    float band=.5+.5*sin(s*13.+hs*30.);
    alb=vec3(.80,.78,.72)*(1.-.06*str-.04*band)*(.96+.04*hs); }
  else alb=vec3(.017,.018,.021)*(.85+.3*noise(p*38.));
  vec3 col=vec3(0.);
  float wrap=white? max((dot(n,Lk)+.35)/1.35,0.) : max(dot(n,Lk),0.);
  col+=alb*KEYC*uD.w*spot*wrap*ao*1.5;
  vec3 Lc=normalize(COLDP-p), Lw=normalize(WARMP-p);
  col+=alb*(COLDC*uG.x*max(dot(n,Lc),0.)+WARMC*uG.y*flick*max(dot(n,Lw),0.))*ao*.8;
  col+=alb*(vec3(.018,.02,.028)*(.5+.5*n.y)+GOLDC*uD.y*.05*max(-n.y+.2,0.))*ao;
  float fr=.045+.955*pow(1.-NV,5.);
  float shin=white?50.:38., ks=white?.28:.22;
  vec3 Hh=normalize(Lk+V); col+=KEYC*uD.w*spot*pow(max(dot(n,Hh),0.),shin)*ks*(shin+8.)/25.*ao;
  Hh=normalize(Lc+V); col+=COLDC*uG.x*pow(max(dot(n,Hh),0.),shin)*ks*(shin+8.)/25.*ao;
  Hh=normalize(Lw+V); col+=WARMC*uG.y*flick*pow(max(dot(n,Hh),0.),shin)*ks*(shin+8.)/25.*ao;
  vec3 R=reflect(rd,n);
  col+=env(R)*fr*(white?.4:.32)*ao;
  if(R.y<0.) col+=GOLDC*uD.y*(white?.04:.025)*fr*ao;                                           // the gold grid seen in the stone
  // landing pulse
  float pg=v.g; col+=vec3(1.,.86,.64)*pg*(fr*2.4+.12)*(white?.6:1.);
  // light from the ripple of move 37 washing past this stone
  if(uE.w>0.&&uE.z>0.){ float d=length(C.xz-uE.xy), a=uE.z, amp=uE.w*exp(-a*.28), rl=0.;
    for(int e=0;e<2;e++){ float ae=a-float(e)*.8; if(ae<0.) continue; rl+=exp(-pow((d-ae*5.6)/.6,2.))*(e==0?1.:.3); }
    rl*=amp; col+=C37*rl*(alb*2.2*max(.35-n.y,0.)+fr*1.6+.03); }
  // warm light from move 78
  if(uF.w>0.&&uF.z>-.3&&kind!=4){ vec3 P78=vec3(uF.x,.3,uF.y); vec3 l=P78-p; float d2=dot(l,l); l=normalize(l);
    float I=uF.w*flick*smoothstep(-.3,.6,uF.z);
    col+=C78*I*(alb*max(dot(n,l),0.)*3.2+fr*.25*max(dot(R,l),0.))/(1.+d2*1.1); }
  if(kind==3){ // move 37: black slate lit by a cold gold corona
    float a=uE.z; float k0=a<0.? smoothstep(-1.,0.,a)*.6 : 1.;
    float rim=pow(1.-NV,2.5);
    col+=C37*uE.w*k0*(pow(1.-NV,4.)*(1.2+1.6*exp(-max(a,0.)*1.1))+smoothstep(.1,-.6,n.y)*.9);
    col+=C37*uE.w*k0*(pow(max(R.y,0.),24.)*.9+pow(max(R.y,0.),4.)*.08); }
  if(kind==4){ // move 78: a shell stone lit from within, like a candle behind alabaster
    float a=uF.z; float k0=a<0.? smoothstep(-1.,0.,a)*.5 : 1.;
    float I=uF.w*k0*flick*(1.25+1.3*exp(-max(a,0.)*1.6));
    float thin=.55+.45*pow(1.-NV,1.5);
    col=mix(col, col*.4, .5*k0) + C78*I*(1.15-.25*str)*thin*1.6 + vec3(1.,.82,.6)*I*pow(NV,6.)*.6; }
  return col; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  flick=.9+.06*sin(uTime*7.3)+.04*sin(uTime*13.1+1.)+.05*(noise(vec3(uTime*3.1,0.,0.))-.5);
  float tB; vec3 nB; bool hb=hitBoard(ro,rd,tB,nB);
  float tS; vec3 nS, cS; vec4 vS; bool hs=traceStones(ro,rd,2.*SH+uD.x*LIFT+.02,tS,nS,cS,vS);
  vec3 col; float depth;
  if(hs&&(!hb||tS<=tB+1e-3)){ depth=tS; col=shadeStone(ro+rd*tS,nS,rd,cS,vS,false); }
  else if(hb){ depth=tB; vec3 p=ro+rd*tB; col= nB.y>.5 ? shadeTop(p,rd,tB) : shadeSide(p,nB,rd); }
  else { depth=1000.; float tq; col=sky(rd)+sea(ro,rd,tq); }
  // haze: the key light's cone with drifting dust, the two presences glowing in the air
  float jit=hash12(gl_FragCoord.xy+fract(uTime*7.13)*91.);
  float tE=min(depth,60.); vec3 hz=vec3(0.);
  int NH=uH.x>.5?20:10;
  for(int i=0;i<20;i++){ if(i>=NH) break; float t=tE*(float(i)+jit)/float(NH); vec3 p=ro+rd*t;
    float sp=keyShaft(p)*step(-.2,p.y+((abs(p.x)<BX&&abs(p.z)<BX)?0.:100.));
    float dn=n3(p*.3+vec3(0.,-uTime*.05,uTime*.02)); dn=dn*dn*2.2; hz+=KEYC*sp*dn*exp(-max(p.y,0.)*.09)*smoothstep(-3.,1.,p.y); }
  hz*=tE/float(NH)*uG.z*uD.w*.0011;
  vec3 gC=COLDP-ro, gW=WARMP-ro;
  float s0=dot(gC,rd); float dC=max(length(gC-rd*s0),4.); float iC=(atan((tE-s0)/dC)+atan(s0/dC))/dC;
  s0=dot(gW,rd); float dW=max(length(gW-rd*s0),4.); float iW=(atan((tE-s0)/dW)+atan(s0/dW))/dW;
  hz+=(COLDC*uG.x*iC+WARMC*uG.y*flick*iW)*uG.z*.06;
  col=col*exp(-depth*.0025*uG.z)+hz;
  fragColor=vec4(col, depth); }`;

// Bokeh depth of field: scatter-as-gather over a golden-angle disc (Gustafsson). alpha of uSrc = view distance.
const DOF_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 fragColor;
uniform sampler2D uSrc; uniform vec2 uRes; uniform float uFocus, uAper, uMaxR, uN, uTime;
float coc(float d){ return min(uMaxR, uAper*uRes.y*abs(d-uFocus)/max(d,1e-3)); }
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec4 c0=texture(uSrc,vUv); float s0=coc(c0.a);
  vec3 acc=c0.rgb; float tot=1.;
  float jit=h12(gl_FragCoord.xy)*.35;
  for(int i=0;i<200;i++){ if(float(i)>=uN) break;
    float fi=float(i)+.5; float r=uMaxR*sqrt(fi/uN); float a=fi*2.39996+jit;
    vec4 s=texture(uSrc, vUv+vec2(cos(a),sin(a))*r/uRes);
    float ss=coc(s.a); if(s.a>c0.a) ss=min(ss, s0*2.);
    float m=smoothstep(r-1.,r+1.,ss);
    acc+=mix(acc/tot, s.rgb, m); tot+=1.; }
  fragColor=vec4(acc/tot,1.); }`;

// ---------------------------------------------------------------- board scene: cameras and light cues
// Camera keys: [t, [pos xyz, look-at xyz, fov, aperture, focus distance (0 = the look-at point)]].
const CAM_INTRO = [
  [0, [1.05, 0.62, -1.55, -0.15, 0.42, 0.55, 1.75, 0.034, 1.95]],
  [6, [1.55, 1.1, -2.9, -0.20, 0.38, 0.60, 1.65, 0.028, 3.3]],
  [9.8, [6.4, 4.6, -12.0, -0.6, 0.0, 0.6, 1.3, 0.014, 0]],
  [15.5, [3.4, 10.5, -17.5, -0.4, 0.0, 0.5, 1.25, 0.010, 0]],
  [20.6, [0.9, 19.5, -13.2, -0.4, 0.0, 0.7, 1.2, 0.006, 0]],
];
const CAM_G2 = [
  [20.6, [0.9, 19.5, -13.2, -0.4, 0.0, 0.7, 1.2, 0.006, 0]],
  [24.4, [-1.6, 18.2, -12.4, -1.2, 0.0, 0.8, 1.2, 0.006, 0]],
  [26.6, [-6.0, 11.0, -11.4, -4.0, 0.0, 0.6, 1.2, 0.008, 0]],
  [28.0, [-11.6, 5.0, -8.2, -5.0, 0.2, 0.2, 1.25, 0.013, 0]],
  [31.5, [-8.9, 2.2, -4.2, -4.8, 0.25, 0.1, 1.3, 0.020, 0]],
  [35.5, [-8.4, 2.6, 2.4, -4.8, 0.25, 0.0, 1.3, 0.018, 0]],
  [41.6, [-3.0, 23.0, -1.8, -2.2, 0.0, 0.5, 1.2, 0.005, 0]],
];
const CAM_G4 = [
  [42.4, [1.0, 25.5, -2.4, 0.0, 0.0, 0.3, 1.2, 0.005, 0]],
  [45.6, [-0.4, 23.5, -1.8, -0.4, 0.0, 0.5, 1.2, 0.005, 0]],
  [50.0, [3.6, 4.1, -4.3, -1.2, 0.2, 1.4, 1.3, 0.014, 0]],
  [55.0, [4.8, 3.6, 1.6, -1.1, 0.2, 1.2, 1.3, 0.014, 0]],
  [59.6, [2.2, 11.5, -6.0, -0.7, 0.0, 0.7, 1.2, 0.008, 0]],
  [64.0, [0.6, 34.0, -5.5, 0.0, 0.0, -1.2, 1.2, 0.004, 0]],
  [72.0, [-0.6, 46.0, -4.0, 0.0, 0.0, -1.6, 1.2, 0.004, 0]],
];
function boardShot(k) {
  const keys = k < 20.6 ? CAM_INTRO : k < 42.2 ? CAM_G2 : CAM_G4;
  const v = spline(keys, k);
  return { cam: camOf([v[0], v[1], v[2]], [v[3], v[4], v[5]], v[6]), focus: v[8] > 0.05 ? v[8] : len3(sub([v[3], v[4], v[5]], [v[0], v[1], v[2]])), aper: v[7] };
}
function boardScene(k, T) {
  const fin = FINAL(), s = SC(0.55, 1.5);
  const sw = Math.round(W * s), sh = Math.round(H * s);
  const g = k < 42.2 ? "G2" : "G4";
  const st = boardState(g, k, { cascade: g === "G4" });
  const { cam, focus, aper } = boardShot(k);
  // light cues
  const keyI = 1.25 * smooth(0.3, 5.5, k) * (1 - 0.35 * smooth(26.4, 27.8, k) + 0.35 * smooth(28.0, 29.5, k)) * (1 - 0.3 * smooth(48.0, 49.8, k) + 0.3 * smooth(50.0, 52, k)) * (1 - 0.86 * smooth(59.2, 62.6, k));
  const grid = smooth(0.5, 3, k) * (0.85 - 0.25 * smooth(26.4, 27.8, k) + 0.25 * smooth(28.2, 30, k)) * (1 - 0.8 * smooth(59.2, 62.6, k));
  const hoshi = smooth(1, 4, k) * (1 - 0.75 * smooth(59.2, 62.6, k));
  const cold = 0.8 * smooth(7.6, 10.5, k) * (1 + 0.5 * Math.exp(-Math.max(0, k - T37) * 0.8) * (k > T37 && k < 42.2 ? 1 : 0)) * (1 - 0.8 * smooth(60, 66, k));
  const warm = 0.8 * smooth(7.6, 10.5, k) * (1 + (k > 42.2 ? 0.6 * smooth(T78, T78 + 3, k) : 0)) * (1 - 0.7 * smooth(60, 66, k));
  const sea = smooth(13.0, 15.0, k) * (1 - 0.5 * smooth(19, 22, k)) * (1 - 0.6 * smooth(62, 68, k));
  const seaR = lerp(0, 420, easeIn(clamp((k - 12.6) / 6.4)) * 0.6 + 0.4 * smooth(12.6, 19.0, k));
  const split = smooth(7.4, 10.2, k) * (1 - 0.65 * smooth(18.5, 21.5, k)) * (1 - smooth(60, 66, k));
  const sweep = lerp(-0.5, 15, Math.pow(smooth(0.6, 11.5, k), 1.7));
  const e37 = g === "G2" ? [...st.big, st.age, smooth(T37 - DROP37, T37, k) * (1 - 0.4 * smooth(38, 41.5, k))] : [0, 0, 0, 0];
  const f78 = g === "G4" ? [...st.big, st.age, smooth(T78 - DROP37, T78, k) * (1 - 0.45 * smooth(59.5, 63, k))] : [0, 0, 0, 0];
  const tex = P.run("ch3_board", BOARD_FS, "ch3scene", sw, sh, {
    uTime: T, ...camUniforms(cam),
    uD: [st.liftMax, grid, hoshi, keyI], uE: e37, uF: f78, uG: [cold, warm, 1.0, sea], uH: [fin ? 1 : 0, 0, sweep, seaR], uB: [split, 0, 0, 0],
    uPul: { vec4: st.pul },
  }, { uBoard: st.tex });
  const fade = smooth(0, 1.8, k) * (1 - smooth(41.4, 42.2, k) + smooth(42.3, 43.3, k)) * (1 - smooth(70.6, 72, k));
  const flash37 = g === "G2" && k > T37 ? Math.exp(-(k - T37) * 2.2) : 0;
  const flash78 = g === "G4" && k > T78 ? Math.exp(-(k - T78) * 1.6) : 0;
  const q = project(cam, g === "G2" ? [st.big[0], 0.3, st.big[1]] : [st.big[0], 0.3, st.big[1]]);
  const rx = q ? q[0] / W : 0.5, ry = q ? 1 - q[1] / H : 0.5;
  GL.frame({ name: "ch3_dof", fs: DOF_FS, scale: s, uniforms: { uTime: T, uFocus: focus, uAper: aper, uMaxR: 0.022 * sh, uN: fin ? 160 : 72 }, textures: { uSrc: tex } },
    { bloom: 0.55 + 0.5 * flash37 + 0.35 * flash78, thresh: 1.05, exposure: 1.05 + 0.25 * flash37, rays: [rx, ry, 0.12 * flash37 + 0.08 * flash78], letterbox: LB, vignette: 0.55, ca: 0.0012, grain: 0.0, t: T, fade });
  blit();
  return { cam, focus, aper };
}

// 60–72: "4 : 1" over the dimmed board, the one human win still glowing like an ember
function scoreText(k) {
  const a = smooth(60.8, 62.6, k) * (1 - smooth(70.0, 71.4, k));
  if (a <= 0) return;
  const u = clamp((k - 60.8) / 10.6), y = H / 2 - 8;
  o.save();
  o.globalCompositeOperation = "source-over";
  const g = o.createRadialGradient(W / 2, y, 0, W / 2, y, 560); g.addColorStop(0, "rgba(0,0,0,0.88)"); g.addColorStop(0.55, "rgba(0,0,0,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
  o.globalAlpha = a; o.fillStyle = g; o.fillRect(W / 2 - 560, y - 560, 1120, 1120);
  o.restore();
  const sp = 0.16 - 0.05 * ease(u * 1.5);
  line("4", W / 2 - 128 - sp * 300, y, { size: 150, font: "SerifL", color: "#f6ecd8", alpha: a, glow: 30, blur: (1 - a) * 8, spacing: 0 });
  line(":", W / 2, y - 6, { size: 120, font: "Corm", color: GOLD, alpha: a * 0.85, glow: 18, blur: (1 - a) * 8, spacing: 0 });
  line("1", W / 2 + 128 + sp * 300, y, { size: 150, font: "SerifL", color: "#f6ecd8", alpha: a, glow: 30, blur: (1 - a) * 8, spacing: 0 });
  o.save(); o.globalAlpha = a * 0.55; o.fillStyle = GOLD; const hw = 150 * smooth(61.6, 63.6, k); o.fillRect(W / 2 - hw, y + 108, hw * 2, 1); o.restore();
}

// ---------------------------------------------------------------- 72–86: the transformer — a sentence held together by gilded arcs of attention
const VOID_FS = COMMON + `
void main(){ vec3 rd=camRay(gl_FragCoord.xy);
  vec3 c=mix(vec3(.007,.006,.009), vec3(.002,.002,.004), clamp(rd.y*2.+.5,0.,1.));
  c+=nebula(rd, vec3(.014,.010,.02), vec3(.07,.045,.015))*.4*uA.y;
  c+=stars(rd,.16);
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  c+=vec3(1.,.70,.38)*exp(-dot(uv*vec2(.55,1.5),uv*vec2(.55,1.5))*3.)*.028*uA.x;
  fragColor=vec4(c,1.); }`;
const WORDS = ["그 한 수가", "수백 년의", "상식을", "뒤집었다"];
const ATT = [ // query row → key weights (hand-set; how a model might read the sentence)
  [0, .3, .4, .9],
  [.3, 0, .9, .4],
  [.4, .9, 0, .8],
  [1, .3, .9, 0],
];
const WORD_T0 = 73.0, WORD_DT = 0.42, Q_T0 = 76.2, Q_DT = 1.05;
let WL = null;
function wordLayout() {
  if (WL) return WL;
  const S = 0.84;
  o.save(); o.font = '100px "SerifM"'; const wd = WORDS.map(w => o.measureText(w).width / 100 * S); o.restore();
  const gap = 1.9 * S, total = wd.reduce((a, b) => a + b, 0) + gap * (WORDS.length - 1);
  let x = -total / 2; WL = [];
  WORDS.forEach((w, i) => { const cx = x + wd[i] / 2, e = cx / (total / 2);
    WL.push({ w, p: [-cx, 0.18 * Math.sin(i * 1.7 + 0.3), 2.2 * e * e + 0.35 * Math.sin(i * 2.1 + 0.4)], wd: wd[i], S });
    x += wd[i] + gap; });
  return WL;
}
const MOTES = (() => { const r = rng(37), a = []; for (let i = 0; i < 190; i++) a.push([lerp(-13, 13, r()), lerp(-5, 7, r()), lerp(-5, 16, r()), r(), r()]); return a; })();
let glowCv = null;
function arcPoints(cam, A, B, up, n = 34) {
  const h = 0.45 + 0.30 * Math.abs(A[0] - B[0]) * (up ? 1 : 0.72), dz = up ? 0.15 : -0.35;
  const c1 = [A[0], A[1] + h, A[2] + dz], c2 = [B[0], B[1] + h, B[2] + dz], pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, s = 1 - t;
    const p = [0, 1, 2].map(q => s * s * s * A[q] + 3 * s * s * t * c1[q] + 3 * s * t * t * c2[q] + t * t * t * B[q]);
    const pr = project(cam, p); if (pr) pts.push(pr); }
  return pts;
}
function wordsScene(k, T) {
  const u = k - 72, s = SC(0.5, 1.0);
  const cu = easeIO(clamp(u / 14));
  const pos = lerp3([1.3, 1.5, -15.4], [-1.2, 0.7, -12.6], cu), at = lerp3([0.2, 1.05, 0.8], [-0.1, 1.15, 0.6], cu);
  const cam = camOf(pos, at, 1.22);
  const focus = len3(sub(at, pos));
  const fade = smooth(72.2, 73.4, k) * (1 - smooth(85.1, 86.0, k));
  GL.frame({ name: "ch3_void", fs: VOID_FS, scale: s, uniforms: { uTime: T, ...camUniforms(cam), uA: [smooth(73, 77, k), 1, 0, 0] } },
    { bloom: 0.5, thresh: 1.0, exposure: 1.0, letterbox: LB, vignette: 0.6, grain: 0, t: T, fade });
  blit();
  const L = wordLayout();
  const fin = fade;
  pic(() => {
    // gold dust drifting at every depth
    o.save(); o.globalCompositeOperation = "lighter";
    for (const m of MOTES) {
      const p = [m[0] + Math.sin(T * 0.13 + m[3] * 9) * 0.4, m[1] + ((T * 0.08 + m[4] * 12) % 12) - 6, m[2]];
      const q = project(cam, p); if (!q) continue;
      const coc = Math.min(26, 0.022 * H * Math.abs(q[2] - focus) / q[2]) + 1.2;
      const al = fin * (0.5 + 0.5 * Math.sin(T * 1.3 + m[3] * 20)) * 0.55 / (1 + coc * coc * 0.04);
      const g = o.createRadialGradient(q[0], q[1], 0, q[0], q[1], coc * 1.6);
      g.addColorStop(0, `rgba(255,214,150,${al})`); g.addColorStop(0.55, `rgba(255,190,110,${al * 0.35})`); g.addColorStop(1, "rgba(255,170,90,0)");
      o.fillStyle = g; o.beginPath(); o.arc(q[0], q[1], coc * 1.6, 0, 7); o.fill();
    }
    o.restore();
    // arcs of attention: thin gilded cores here, their glow on a half-size layer blurred once
    if (!glowCv) { glowCv = document.createElement("canvas"); glowCv.width = W / 2; glowCv.height = H / 2; }
    const gx = glowCv.getContext("2d"); gx.setTransform(1, 0, 0, 1, 0, 0); gx.clearRect(0, 0, W / 2, H / 2); gx.scale(0.5, 0.5); gx.lineCap = "round";
    const tops = L.map(w => [w.p[0], w.p[1] + 0.40 * w.S, w.p[2]]);
    const heat = new Array(WORDS.length).fill(0);
    const finale = smooth(82.6, 84.0, k);
    o.save(); o.globalCompositeOperation = "lighter"; o.lineCap = "round";
    for (let qi = 0; qi < WORDS.length; qi++) {
      const tq = Q_T0 + qi * Q_DT;
      const keys = ATT[qi].map((w, j) => [w, j]).filter(([w]) => w > 0).sort((a, b) => b[0] - a[0]);
      keys.forEach(([w, j], rank) => {
        const t0 = tq + 0.12 * rank, prog = ease(clamp((k - t0) / 0.75));
        if (prog <= 0) return;
        const after = Math.max(0, k - (t0 + 0.75));
        let b = w * (0.32 + 0.68 * Math.exp(-after * 0.8));
        b = lerp(b, w * (0.75 + 0.25 * Math.sin(T * 2.1 + qi + j)), finale);
        b *= fin;
        const pts = arcPoints(cam, tops[qi], tops[j], j > qi);
        const nUse = Math.max(2, Math.round(pts.length * prog));
        const sub2 = pts.slice(0, nUse);
        // glow
        gx.strokeStyle = `rgba(255,186,96,${0.55 * b})`; gx.lineWidth = 10 + 10 * w; gx.beginPath(); sub2.forEach((p, i) => i ? gx.lineTo(p[0], p[1]) : gx.moveTo(p[0], p[1])); gx.stroke();
        // core: gold leaf with a brighter leading edge
        const pa = sub2[0], pb = sub2[sub2.length - 1];
        const grad = o.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
        grad.addColorStop(0, `rgba(205,150,70,${0.55 * b})`); grad.addColorStop(1, `rgba(255,236,200,${0.95 * b})`);
        o.strokeStyle = grad; o.lineWidth = 1.1 + 1.9 * w; o.beginPath(); sub2.forEach((p, i) => i ? o.lineTo(p[0], p[1]) : o.moveTo(p[0], p[1])); o.stroke();
        // the travelling head, and beads of light flowing in the finale
        if (prog < 1) { o.fillStyle = `rgba(255,244,220,${b})`; o.beginPath(); o.arc(pb[0], pb[1], 2.2 + 2 * w, 0, 7); o.fill();
          gx.fillStyle = `rgba(255,214,150,${b})`; gx.beginPath(); gx.arc(pb[0], pb[1], 14 + 10 * w, 0, 7); gx.fill(); }
        if (finale > 0) { const ph = ((T * 0.55 + qi * 0.37 + j * 0.21) % 1), bi = Math.min(pts.length - 1, Math.floor(ph * pts.length)), bp = pts[bi];
          o.fillStyle = `rgba(255,240,210,${finale * b})`; o.beginPath(); o.arc(bp[0], bp[1], 1.8 + 1.6 * w, 0, 7); o.fill(); }
        if (prog >= 1) heat[j] = Math.max(heat[j], b * Math.exp(-after * 1.2));
        heat[qi] = Math.max(heat[qi], 0.7 * Math.exp(-Math.max(0, k - tq) * 0.9) * (k >= tq ? 1 : 0));
      });
    }
    o.restore();
    o.save(); o.globalCompositeOperation = "lighter"; o.filter = "blur(9px)"; o.drawImage(glowCv, 0, 0, W, H); o.filter = "blur(3px)"; o.globalAlpha = 0.6; o.drawImage(glowCv, 0, 0, W, H); o.restore();
    // the words: luminous serif, focus falling off with depth
    L.forEach((w, i) => {
      const q = project(cam, w.p); if (!q) return;
      const ta = WORD_T0 + i * WORD_DT, a = smooth(ta, ta + 0.9, k) * fin;
      if (a <= 0) return;
      const size = w.S * cam.fov * H / q[2];
      const dofB = Math.min(6, 0.022 * H * Math.abs(q[2] - focus) / q[2] * 0.5);
      const h = Math.min(1, heat[i]);
      const rise = (1 - ease(clamp((k - ta) / 1.2))) * 18;
      o.save(); o.globalAlpha = a; o.font = `${size}px "SerifM"`; o.textAlign = "center"; o.textBaseline = "alphabetic";
      if (dofB + (1 - a) * 6 > 0.3) o.filter = `blur(${dofB + (1 - a) * 6}px)`;
      o.shadowColor = `rgba(255,${200 + 30 * h},${140 + 40 * h},${0.55 + 0.45 * h})`; o.shadowBlur = 16 + 26 * h;
      o.fillStyle = h > 0.02 ? `rgb(255,${238 - 10 * h},${214 - 40 * h})` : "#efe4cf";
      o.fillText(w.w, q[0], q[1] + rise);
      o.restore();
    });
  });
}

// ---------------------------------------------------------------- 86–100: the night Earth; warm lights spread outward from San Francisco
const EARTH_FS = COMMON + `
uniform sampler2D uLand;
uniform vec4 uD;   // x spread front (radians from the origin), y clouds, z lights master, w quality
uniform vec4 uE;   // origin unit vector, w atmosphere
uniform vec4 uF;   // sun direction (behind the planet), w dawn
const float PI=3.14159265;
vec3 sph(float lat, float lon){ return vec3(cos(lat)*cos(lon), sin(lat), -cos(lat)*sin(lon)); }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 sun=normalize(uF.xyz);
  vec3 col=stars(rd,.75)+nebula(rd, vec3(.010,.008,.018), vec3(.05,.034,.014))*.35;
  float b=dot(ro,rd), c=dot(ro,ro)-1., h=b*b-c;
  float tP=1e9;
  vec3 moon=normalize(vec3(-.55,.35,-.75));
  if(h>0.){ float t=-b-sqrt(h); if(t>0.){ tP=t; vec3 p=ro+rd*t, n=normalize(p);
    float lat=asin(clamp(n.y,-1.,1.)), lon=atan(-n.z,n.x);
    vec2 uv=vec2(lon/(2.*PI)+.5, .5-lat/PI), uv2=vec2(fract(uv.x+.5)-.5, uv.y);
    vec2 gx=dFdx(uv), gy=dFdy(uv), gx2=dFdx(uv2), gy2=dFdy(uv2);
    if(dot(gx2,gx2)+dot(gy2,gy2)<dot(gx,gx)+dot(gy,gy)){ gx=gx2; gy=gy2; }
    vec4 tx=textureGrad(uLand, uv, gx, gy);
    float land=tx.r, city=tx.g;
    float mo=max(dot(n,moon),0.);
    float snow=smoothstep(.58,.82,abs(n.y))*(.6+.4*noise(n*30.));
    float seaIce=smoothstep(.86,.95,n.y)*(1.-land)*(.5+.5*noise(n*18.));
    vec3 ground=vec3(.006,.0055,.005)*(.6+.8*noise(n*60.))*(1.+snow*4.)*land;
    vec3 ocean=vec3(.0012,.0016,.0030)*(1.-land);
    col=(ground+ocean+vec3(.03,.033,.04)*seaIce)*(.25+1.6*mo);
    col+=vec3(.5,.55,.65)*pow(max(dot(reflect(rd,n),moon),0.),60.)*.05*(1.-land);
    // the lights: each place ignites when the wave reaches it, flares like an ember, then settles
    float ang=acos(clamp(dot(n,uE.xyz),-1.,1.));
    float j=(noise(n*21.)-.5)*.22+(noise(n*83.)-.5)*.06;
    float since=uD.x-(ang+j);
    float lit=smoothstep(0.,.04,since), ember=exp(-max(since,0.)*16.)*lit;
    float fine=.25+1.6*pow(noise(n*520.),2.)*(.4+.6*noise(n*170.+3.));
    float Ls=city*fine*(lit+ember*1.8)*uD.z;
    vec3 lc=mix(vec3(1.,.50,.18), vec3(1.,.80,.55), smoothstep(.25,1.2,Ls));
    // clouds drifting over the night side
    float cl=smoothstep(.5,.8,fbm(n*3.4+vec3(uTime*.004,0.,0.)))*uD.y;
    col=mix(col, vec3(.010,.011,.014)*(.3+1.4*mo), cl*.75);
    col+=lc*Ls*2.4*(1.-cl*.55);
    col+=lc*city*uD.z*lit*.06*(1.-cl);                                   // the soft halo of a lit region
    // dawn creeping round the limb and a thin air glow
    float dn=dot(n,sun);
    col+=vec3(1.,.55,.25)*smoothstep(-.10,.06,dn)*.10*uF.w*(land*.6+.4);
    float fres=pow(1.-max(dot(n,-rd),0.),3.);
    col+=mix(vec3(.25,.3,.45),vec3(1.,.6,.3),smoothstep(-.3,.1,dn))*fres*.05*uE.w;
  } }
  // the atmosphere ring, lit from behind by the sun
  float tc=max(-b,0.); vec3 pc=ro+rd*tc; float hc=length(pc), alt=hc-1.;
  if(tP>1e8 || alt<0.){ float a2=max(alt,0.);
    float fw=pow(max(dot(rd,sun),0.),2.)*.9+.25;
    vec3 low=vec3(1.,.42,.16), mid=vec3(1.,.74,.42), high=vec3(.42,.52,.80);
    vec3 ac=mix(mix(low,mid,smoothstep(0.,.006,a2)),high,smoothstep(.006,.02,a2));
    float g=exp(-a2/.0085)*(tP>1e8?1.:.0);
    col+=ac*g*fw*.9*uE.w; }
  fragColor=vec4(col,1.); }`;
let earthTex = null;
function earthTexture() {
  if (earthTex) return earthTex;
  const D = window.CH3_DATA, w = D.LAND_W, h = D.LAND_H;
  const land = document.createElement("canvas"); land.width = w; land.height = h;
  const lx = land.getContext("2d"), id = lx.createImageData(w, h);
  D.LAND.split(";").forEach((row, y) => { let x = 0, v = 0; for (const r of row.split(",")) { const n = parseInt(r, 16); if (v) for (let i = 0; i < n; i++) { const j = (y * w + x + i) * 4; id.data[j] = id.data[j + 1] = id.data[j + 2] = 255; } x += n; v ^= 1; }
    for (let i = 0; i < w; i++) id.data[(y * w + i) * 4 + 3] = 255; });
  lx.putImageData(id, 0, 0);
  const soft = document.createElement("canvas"); soft.width = w; soft.height = h;
  const sx = soft.getContext("2d"); sx.filter = "blur(1.2px)"; sx.drawImage(land, 0, 0);
  const lights = document.createElement("canvas"); lights.width = w; lights.height = h;
  const cx = lights.getContext("2d"); cx.fillStyle = "#000"; cx.fillRect(0, 0, w, h); cx.globalCompositeOperation = "lighter";
  const C = D.CITIES;
  for (let i = 0; i < C.length; i += 3) {
    const lon = C[i] / 10, lat = C[i + 1] / 10, lp = C[i + 2];
    const x = (lon + 180) / 360 * w, y = (90 - lat) / 180 * h, s = clamp((lp - 90) / 60);
    const r = (0.55 + 2.4 * s * s + 0.5 * s) / Math.max(0.25, Math.cos(lat * Math.PI / 180)) ** 0.5, a = 0.16 + 0.84 * s;
    for (const ox of [0, -w, w]) { const X = x + ox; if (X < -r * 3 || X > w + r * 3) continue;
      const g = cx.createRadialGradient(X, y, 0, X, y, r * 2.2); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.35, `rgba(255,255,255,${a * 0.35})`); g.addColorStop(1, "rgba(255,255,255,0)");
      cx.fillStyle = g; cx.fillRect(X - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); }
  }
  const a = sx.getImageData(0, 0, w, h).data, b = cx.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { out[i * 4] = a[i * 4]; out[i * 4 + 1] = Math.min(255, b[i * 4] * (a[i * 4] > 10 ? 1 : 0.25)); out[i * 4 + 3] = 255; }
  const gl = GL.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, out); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return (earthTex = t);
}
const sph = (lat, lon) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)]; };
const SF = sph(37.77, -122.42);
const CAM_EARTH = [ // [t, [lat, lon, distance, target lat, target lon, target depth]]
  [86.0, [26, -138, 1.62, 44, -112, 0.55]],
  [92.5, [38, -150, 2.05, 50, -138, 0.55]],
  [100.0, [52, -168, 2.6, 60, -160, 0.6]],
];
function earthScene(k, T) {
  const s = SC(0.55, 1.5);
  const v = spline(CAM_EARTH, k);
  const pos = mul3(sph(v[0], v[1]), v[2]), at = mul3(sph(v[3], v[4]), v[5]);
  const cam = camOf(pos, at, 1.25);
  const front = Math.max(0, k - 87.0) * 0.2;
  const sun = norm(add3(mul3(norm(pos), -1), [0, -0.35, 0]));
  GL.frame({ name: "ch3_earth", fs: EARTH_FS, scale: s, textures: { uLand: earthTexture() },
    uniforms: { uTime: T, ...camUniforms(cam), uD: [front, 0.85, 1.0, FINAL() ? 1 : 0], uE: [...SF, 1.0], uF: [...sun, 1.0] } },
    { bloom: 0.6, thresh: 0.9, exposure: 1.1, letterbox: LB, vignette: 0.55, grain: 0, t: T, fade: smooth(86.0, 87.2, k) * (1 - smooth(99.2, 100, k)) });
  blit();
}

// ---------------------------------------------------------------- chapter
chapter("ch3", 100, (k, T) => {
  if (k < 72) boardScene(k, T);
  else if (k < 86) wordsScene(k, T);
  else earthScene(k, T);
  if (k > 60 && k < 72) scoreText(k);
  chapterCard(k, "III", "신의 한 수");
  // captions (local seconds)
  caption(k, 6.8, 19.2, (a, u) => capT("2016년 3월 · 서울", a, u));
  caption(k, 7.6, 12.4, (a, u) => capB("알파고 대 이세돌", a, u));
  caption(k, 13.2, 19.0, (a, u) => capB("전 세계 2억 명이 지켜보았다", a, u));
  caption(k, 20.6, 41.2, (a, u) => capT("제2국 · 37수", a, u));
  caption(k, 29.4, 33.4, (a, u) => capB("해설자들은 실수라고 생각했다", a, u));
  caption(k, 34.0, 37.6, (a, u) => capB("인간이 둘 확률, 1만 분의 1", a, u));
  caption(k, 38.2, 41.6, (a, u) => capB("그 한 수가 수백 년의 상식을 뒤집었다", a, u));
  caption(k, 43.2, 59.2, (a, u) => capT("제4국 · 78수", a, u));
  caption(k, 43.8, 48.0, (a, u) => capB("알파고 3연승. 그리고 —", a, u));
  caption(k, 51.0, 54.4, (a, u) => capB("이세돌의 한 수", a, u));
  caption(k, 55.0, 59.4, (a, u) => capB("사람들은 그것을 “신의 한 수”라 불렀다", a, u));
  caption(k, 64.4, 70.6, (a, u) => capB("그날 이후, 기계를 보는 눈이 달라졌다", a, u));
  caption(k, 72.8, 85.2, (a, u) => capT("2017 · 트랜스포머", a, u));
  caption(k, 74.6, 79.2, (a, u) => capB("“Attention Is All You Need”", a, u));
  caption(k, 80.0, 85.0, (a, u) => capB("오늘날 AI의 뼈대", a, u));
  caption(k, 87.0, 99.0, (a, u) => capT("2022년 11월", a, u));
  caption(k, 88.2, 93.2, (a, u) => capB("기계가 우리와 대화하기 시작했다", a, u));
  caption(k, 94.0, 98.8, (a, u) => capB("5일 만에 100만 명", a, u));
});
})();
