// 「II · 불씨」 (The Spark) — ch2, 90 s, film time 113–203.
// A: 0–20  title card, the ember lights a candle; Turing's question soaks into parchment.
// B: 18–36 embers rise from the flame and assemble into ARTIFICIAL INTELLIGENCE.
// C: 34–46 the embers become stars; gold threads engrave a neuron constellation.
// D: 46–64 winter: the constellation freezes, frost grows in from the frame, snow, silver.
// E: 64–76 a frozen hall; the marble king topples (impact 70.0), the ice cracks, warm light leaks.
// F: 76–90 the ice melts; a gothic cathedral of light; the rose window opens like an eye (peak 82).
(() => {
  const sm = smooth;
  const Q = () => (FINAL() ? 1 : 0);
  const SCALE = () => SC(0.55, 1.5);

  // ---------------------------------------------------------------- additive segment pass
  // Draws thousands of soft HDR segments (embers with motion streaks, stars, threads, snow) into a float texture
  // that the scene shaders add before post, so bloom and tonemapping treat them like scene light.
  const SL = { a: new Float32Array(8 * 24000), n: 0 };
  function segReset() { SL.n = 0; }
  // x0,y0,x1,y1 in design px (1920x1080, y down); r,g,b linear HDR; w = core radius in design px
  function seg(x0, y0, x1, y1, r, g, b, w) {
    if (SL.n >= 24000) return; const i = SL.n++ * 8, a = SL.a;
    a[i] = x0; a[i + 1] = y0; a[i + 2] = x1; a[i + 3] = y1; a[i + 4] = r; a[i + 5] = g; a[i + 6] = b; a[i + 7] = w;
  }
  const SEG = (() => {
    const gl = GL.gl; let prog = null, vao, inst, uRes, uS; const fbs = {};
    const VS = `#version 300 es
layout(location=0) in vec2 aC; layout(location=1) in vec4 aSeg; layout(location=2) in vec4 aCol;
uniform vec2 uRes; uniform float uS;
out vec2 vP; out vec2 vA; out vec2 vB; out vec3 vCol; out float vR;
void main(){
  vec2 a=aSeg.xy*uS, b=aSeg.zw*uS; float r0=aCol.w*uS; float r=max(r0,.8);
  vec2 d=b-a; float L=length(d); vec2 t=L>1e-3? d/L : vec2(1.,0.); vec2 n=vec2(-t.y,t.x);
  float ext=r*4.;
  vec2 p=(aC.x<0.? a : b)+t*aC.x*ext+n*aC.y*ext;
  float k=r0/r; float e=1.+1./(1.+L/r);                 // energy kept when the core is clamped to sub-pixel
  vP=p; vA=a; vB=b; vR=r; vCol=aCol.rgb*pow(k,e);
  gl_Position=vec4(p.x/uRes.x*2.-1., 1.-p.y/uRes.y*2., 0., 1.); }`;
    const FS = `#version 300 es
precision highp float; in vec2 vP; in vec2 vA; in vec2 vB; in vec3 vCol; in float vR; out vec4 o;
void main(){ vec2 pa=vP-vA, ba=vB-vA; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.); float d=length(pa-ba*h)/vR;
  float g=exp(-d*d)+.07*exp(-d*d*.11); o=vec4(vCol*g,1.); }`;
    function init() {
      const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      uRes = gl.getUniformLocation(prog, "uRes"); uS = gl.getUniformLocation(prog, "uS");
      vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    function target(w, h) {
      const k = w + "x" + h; if (fbs[k]) return fbs[k];
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, GL.hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, GL.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return (fbs[k] = { tex, fb });
    }
    function render(scale) {
      if (!prog) init();
      const w = Math.round(1920 * scale), h = Math.round(1080 * scale), t = target(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      if (SL.n > 0) {
        gl.useProgram(prog); gl.uniform2f(uRes, w, h); gl.uniform1f(uS, w / 1920);
        gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, inst); gl.bufferData(gl.ARRAY_BUFFER, SL.a.subarray(0, SL.n * 8), gl.DYNAMIC_DRAW);
        gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, SL.n);
        gl.disable(gl.BLEND); gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return t.tex;
    }
    return { render };
  })();

  // ---------------------------------------------------------------- small math
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const mix3 = lerp3;
  const camAt = (pos, at, fov) => ({ pos, fwd: norm(sub(at, pos)), up: [0, 1, 0], fov });
  const camDir = (pos, fwd, fov) => ({ pos, fwd: norm(fwd), up: [0, 1, 0], fov });
  const hsh = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  const camBasis = cam => { const f = norm(cam.fwd), r = norm(cross(f, cam.up)), u = cross(r, f); return { f, r, u }; };

  // ---------------------------------------------------------------- text textures (built lazily, after fonts load)
  // Ink: R = sharp glyph, G = slightly blurred, B = wide bleed. Two rows: Korean question, English question.
  const Q_KO = "기계는 생각할 수 있는가?", Q_EN = "Can machines think?";
  // Korean syllables land on the half-beat (60 BPM): music-box note per glyph.
  const KO_T = [7.5, 8.0, 8.5, 9.5, 10.0, 10.5, 11.5, 12.5, 13.0, 13.5, 14.0];
  const EN_T0 = 15.0, EN_DT = 0.07;
  const INK = { tex: null, X: [], n0: 0, n1: 0 };
  function buildInk() {
    if (INK.tex) return INK;
    const cw = 2048, ch = 512, c = document.createElement("canvas"); c.width = cw; c.height = ch; const x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, cw, ch);
    // layout glyphs individually so each has known extents
    const rows = [];
    const layout = (s, font, size, track, y) => {
      x.font = `${size}px "${font}"`; const gl = [...s].map(g => ({ g, w: x.measureText(g).width }));
      const tw = gl.reduce((a, g) => a + g.w, 0) + track * size * (gl.length - 1); let cx = (cw - tw) / 2; const out = [];
      for (const g of gl) { out.push({ g: g.g, x0: cx, x1: cx + g.w, font, size, y }); cx += g.w + track * size; }
      return out;
    };
    let size = 132; let r0 = layout(Q_KO, "SerifL", size, 0.1, 205);
    while (r0[r0.length - 1].x1 - r0[0].x0 > cw * 0.94) { size -= 4; r0 = layout(Q_KO, "SerifL", size, 0.1, 205); }
    const r1 = layout(Q_EN, "CormI", 96, 0.04, 400);
    rows.push(r0.filter(g => g.g !== " "), r1.filter(g => g.g !== " "));
    x.globalCompositeOperation = "lighter"; x.textBaseline = "middle"; x.textAlign = "left";
    for (const [col, blur] of [["rgb(255,0,0)", 0], ["rgb(0,255,0)", 2.5], ["rgb(0,0,255)", 9]]) {
      x.filter = blur ? `blur(${blur}px)` : "none"; x.fillStyle = col;
      for (const row of rows) for (const g of row) { x.font = `${g.size}px "${g.font}"`; x.fillText(g.g, g.x0, g.y); }
    }
    x.filter = "none";
    // letter boundaries (left edge in u) at midpoints between neighbouring glyphs
    const X = [];
    for (const row of rows) row.forEach((g, i) => X.push(i === 0 ? 0 : ((row[i - 1].x1 + g.x0) / 2) / cw));
    INK.X = X; INK.n0 = rows[0].length; INK.n1 = rows[1].length;
    INK.tex = GL.canvasTex("ch2_ink", c, { mip: true });
    return INK;
  }
  function inkAges(k) {
    const A = [];
    for (let i = 0; i < INK.n0; i++) A.push(k - KO_T[i]);
    for (let i = 0; i < INK.n1; i++) A.push(k - (EN_T0 + i * EN_DT));
    while (A.length < 30) A.push(-1);
    return A.slice(0, 30);
  }
  // The word: white glyphs on black, sampled for ember targets.
  const WORD = { tex: null, pts: null, cw: 2048, ch: 256 };
  function buildWord() {
    if (WORD.tex) return WORD;
    const cw = WORD.cw, ch = WORD.ch, c = document.createElement("canvas"); c.width = cw; c.height = ch; const x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, cw, ch);
    let size = 120; const s = "ARTIFICIAL INTELLIGENCE";
    const fit = () => { x.font = `${size}px "CormSB"`; x.letterSpacing = `${0.34 * size}px`; return x.measureText(s).width - 0.34 * size; };
    while (fit() > cw * 0.9) size -= 2;
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(s, cw / 2 + 0.17 * size, ch / 2 + 4);
    const d = x.getImageData(0, 0, cw, ch).data, all = [];
    for (let y = 0; y < ch; y += 2) for (let xx = 0; xx < cw; xx += 2) if (d[(y * cw + xx) * 4] > 140) all.push([xx, y]);
    const r = rng(1956), pts = [];
    for (let i = 0; i < NWORD; i++) pts.push(all[Math.floor(r() * all.length)]);
    WORD.pts = pts.map(([px, py]) => [(px / cw - 0.5) * 2, -(py / ch - 0.5) * 2 / (cw / ch)]); // plane units: x in [-1,1], y scaled
    WORD.tex = GL.canvasTex("ch2_word", c, { mip: true });
    return WORD;
  }

  // ---------------------------------------------------------------- shaders
  const DESK = COMMON + `
uniform sampler2D uSeg, uInk, uWord;
uniform float uInkX[30]; uniform float uInkA[30];
uniform vec4 uD;   // flame size, flame intensity, quality, room fill
uniform vec4 uE;   // drifting ember: pos xyz, light
uniform vec4 uF;   // sky amount, word reveal, word glow, haze
uniform vec4 uG;   // ember swarm light: pos xyz, intensity
uniform vec4 uWP;  // word plane centre xyz, half width
uniform vec3 uWR; uniform vec3 uWU;
uniform vec4 uS;   // flame sway xz, flame height flicker, wick glow
const vec3 CB=vec3(-1.08,0.,-0.15);
const float CRAD=.064, CTOP=.6;
const float SA=.3746, CA=.9272;
const vec3 PC=vec3(0.,.26,0.);
const vec3 PN=vec3(0.,CA,SA);
const vec3 PV=vec3(0.,-SA,CA);
const vec3 FLC=vec3(1.,.5,.2);
const int N0=${11}, N1=${17};
const float SPLIT=.62;
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float sdCyl(vec3 p, float r, float h){ vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h); return min(max(d.x,d.y),0.)+length(max(d,0.)); }
float sdVCap(vec3 p, float h, float r){ p.y-=clamp(p.y,-h,0.); return length(p)-r; }
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
vec3 WICK(){ return CB+vec3(.003,CTOP+.026,0.); }
float mapScene(vec3 p, out float m){
  m=0.; float d=1e9;
  // candle and brass holder
  vec3 q=p-CB;
  if(length(q.xz)<.3 && q.y<CTOP+.1){
    float dish=sdCyl(q-vec3(0.,.012,0.),.155,.007)-.005;
    float rim=length(vec2(length(q.xz)-.158,q.y-.022))-.009;
    float cup=sdCyl(q-vec3(0.,.045,0.),.08,.032)-.004;
    float ring=length(vec2(length(q.xz)-.084,q.y-.078))-.006;
    float brass=min(min(dish,rim),min(cup,ring));
    float wax=sdCyl(q-vec3(0.,CTOP*.5,0.),CRAD,CTOP*.5-.004)-.004;
    float pool=length((q-vec3(0.,CTOP+.004,0.))*vec3(1.,2.6,1.))-CRAD*.84;
    wax=max(wax,-pool);
    for(int i=0;i<4;i++){ float fi=float(i); float a=fi*1.9+.5; vec3 dp=vec3(cos(a)*(CRAD+.002),CTOP-.01-fi*.012,sin(a)*(CRAD+.002));
      float dr=sdVCap(q-dp,.05+fi*.045,.0105-.0015*fi); wax=smin(wax,dr,.01); }
    float wick=length(vec2(length(q.xz-vec2(.0025*clamp((q.y-CTOP)/.03,0.,1.),0.)),0.))-.0026;
    wick=max(wick,max(q.y-CTOP-.028,CTOP-.02-q.y));
    d=wax; m=1.; if(brass<d){ d=brass; m=2.; } if(wick<d){ d=wick; m=3.; }
  }
  // writing slope (a wedge-shaped box) under the parchment
  vec3 r=p-PC; vec3 l=vec3(r.x, dot(r,PN), dot(r,PV));
  float box=max(max(abs(l.x)-.88,abs(l.z)-.6),l.y+.007); box=max(box,-p.y); box=max(box,-(l.z+.6)*0.+(-p.y));
  box-=.004;
  if(box<d){ d=box; m=4.; }
  // two old books, back right
  vec3 b1=p-vec3(1.32,.07,-.78); b1.xz*=rot(.25); float bk1=sdBox(b1,vec3(.30,.065,.21))-.006;
  vec3 b2=p-vec3(1.28,.185,-.74); b2.xz*=rot(-.12); float bk2=sdBox(b2,vec3(.26,.05,.19))-.006;
  float bk=min(bk1,bk2); if(bk<d){ d=bk; m=bk1<bk2?5.:6.; }
  return d;
}
float mapS(vec3 p){ float m; return mapScene(p,m); }
vec3 calcNormal(vec3 p){ const vec2 k=vec2(1.,-1.); const float h=.0007;
  return normalize(k.xyy*mapS(p+k.xyy*h)+k.yyx*mapS(p+k.yyx*h)+k.yxy*mapS(p+k.yxy*h)+k.xxx*mapS(p+k.xxx*h)); }
float softShadow(vec3 ro, vec3 rd, float maxt){ float res=1., t=.012;
  for(int i=0;i<28;i++){ float h=mapS(ro+rd*t); res=min(res,10.*h/t); t+=clamp(h,.008,.12); if(res<.005||t>maxt) break; }
  return clamp(res,0.,1.); }
// --- the flame
vec3 flameEmit(vec3 q, float fs){
  float h=.15*fs*uS.z; float y=q.y/h; if(y<-.18||y>1.12) return vec3(0);
  float yy=clamp(y,0.,1.);
  q.xz-=uS.xy*yy*yy;
  float n=noise(vec3(q.x*80.,q.y*46.-uTime*12.,q.z*80.));
  q.xz+=(n-.5)*.009*yy*yy*fs;
  float R=.0235*fs*1.75*pow(clamp(y+.13,0.,1.3),.5)*pow(clamp(1.-y,0.,1.),.72)+1e-4;
  float d=length(q.xz)/R;
  float body=smoothstep(1.,.45,d)*smoothstep(-.18,0.,y);
  float core=smoothstep(.85,.05,d)*smoothstep(.05,.3,y)*smoothstep(1.02,.4,y);
  float dark=smoothstep(.5,.0,d)*smoothstep(.32,.03,y);
  float blue=smoothstep(.24,.0,y)*smoothstep(.3,.9,d)*body;
  vec3 c=vec3(2.4,.82,.18)*body*(1.-dark*.6)+vec3(10.,7.,3.6)*core*(1.-dark*.8)+vec3(.07,.13,.55)*blue*1.7;
  return c*mix(1.,.2,smoothstep(.62,1.08,y));
}
vec3 flameVol(vec3 ro, vec3 rd, float tmax){
  float fs=uD.x; if(fs<=.002) return vec3(0);
  vec3 W=WICK(); vec3 c=W+vec3(uS.x*.4,.07*fs,uS.y*.4); float R=.1*fs+.012;
  vec3 oc=ro-c; float b=dot(oc,rd), h=b*b-(dot(oc,oc)-R*R); if(h<0.) return vec3(0);
  float sq=sqrt(h); float t0=max(-b-sq,0.), t1=min(-b+sq,tmax); if(t1<=t0) return vec3(0);
  int NS=uD.z>.5?56:30; float dt=(t1-t0)/float(NS); vec3 acc=vec3(0);
  float jit=hash12(gl_FragCoord.xy+fract(uTime*3.7)*41.);
  for(int i=0;i<56;i++){ if(i>=NS) break; vec3 p=ro+rd*(t0+(float(i)+jit)*dt); acc+=flameEmit(p-W,fs)*dt; }
  return acc*30.;
}
vec3 LP(){ return WICK()+vec3(uS.x*.3,.065*uD.x,uS.y*.3); }
// --- materials
vec3 woodCol(vec2 p, float dark){
  float g=p.x*2.2+fbm(vec3(p*vec2(.7,4.),1.3))*2.6;
  float rings=.5+.5*sin(g*14.); float fine=noise(vec3(p.x*30.,p.y*420.,2.));
  vec3 c=mix(vec3(.045,.019,.008),vec3(.12,.056,.024),rings*.55+fine*.45);
  return c*dark; }
vec3 parchCol(vec2 uv, float e){
  float n1=fbm(vec3(uv*2.6,2.)), n2=fbm(vec3(uv*11.,5.)), fib=noise(vec3(uv.x*140.,uv.y*38.,1.)), sp=noise(vec3(uv*60.,8.));
  vec3 c=vec3(.80,.63,.40)*(.80+.3*n1);
  c*=1.-.16*smoothstep(.56,.82,n2);
  c*=.93+.07*fib; c*=1.-.12*smoothstep(.75,.95,sp);
  c=mix(c*vec3(.62,.48,.34),c,smoothstep(.0,.16,e));
  c=mix(vec3(.10,.05,.025),c,smoothstep(.0,.025,e));
  return c; }
float inkAt(vec2 tuv, out float wet){
  wet=0.; if(tuv.x<0.||tuv.x>1.||tuv.y<0.||tuv.y>1.) return 0.;
  vec3 g=texture(uInk,vec2(tuv.x,1.-tuv.y)).rgb;
  if(g.b<.003) return 0.;
  bool r0=tuv.y<SPLIT; int i0=r0?0:N0, i1=r0?N0:N0+N1;
  int li=i0; for(int i=0;i<20;i++){ int j=i0+i; if(j>=i1) break; if(tuv.x>=uInkX[j]) li=j; }
  float age=uInkA[li]; if(age<=0.) return 0.;
  float p=clamp(age/1.25,0.,1.);
  float n=fbm(vec3(tuv*vec2(260.,65.),3.));
  float core=clamp(g.g*1.8,0.,1.);
  float grow=clamp(p*1.6-(1.-core)*1.15+(n-.5)*.45,0.,1.);
  float cov=g.r*smoothstep(0.,.35,grow);
  float bleed=g.b*smoothstep(.1,1.,p)*.3*(.45+n);
  wet=(1.-smoothstep(.6,3.2,age))*cov;
  return clamp(max(cov,bleed),0.,1.)*uD.w; }
// all lights at a surface point
vec3 shade(vec3 p, vec3 n, vec3 rd, vec3 alb, float gloss, float wrap, float shOn){
  vec3 V=-rd; vec3 c=vec3(0);
  if(uD.y>0.){ vec3 lv=LP()-p; float dl=length(lv); vec3 L=lv/dl; float att=uD.y/(dl*dl+.015);
    float nl=dot(n,L); float diff=max((nl+wrap)/(1.+wrap),0.);
    float sh= shOn>.5 && nl>-.2 ? softShadow(p+n*.003,L,dl-.05) : 1.;
    vec3 H=normalize(L+V); float sp=pow(max(dot(n,H),0.),gloss)*(gloss+8.)/25.;
    float fr=.04+.96*pow(1.-max(dot(n,V),0.),5.);
    c+=FLC*att*sh*(alb*diff+sp*fr*.6*step(0.,nl)); }
  if(uE.w>0.){ vec3 lv=uE.xyz-p; float dl=length(lv); vec3 L=lv/dl; c+=vec3(1.,.42,.12)*uE.w/(dl*dl+.004)*alb*max(dot(n,L),0.); }
  if(uG.w>0.){ vec3 lv=uG.xyz-p; float dl=length(lv); vec3 L=lv/dl; c+=vec3(1.,.62,.3)*uG.w/(dl*dl+.08)*alb*max(dot(n,L)*.7+.3,0.); }
  vec3 M=normalize(vec3(.55,.75,.35)); c+=vec3(.45,.55,.8)*uD.w*.0*alb; // (reserved)
  c+=alb*vec3(.35,.42,.6)*uD.w*.012*(.6+.4*n.y);
  return c; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 col=vec3(.0015,.0015,.003);
  if(uF.x>0.) col=mix(col,(nebula(rd,vec3(.03,.024,.05),vec3(.26,.17,.08))*.55+stars(rd,1.))*smoothstep(-.05,.25,rd.y)*1.,uF.x);
  float tHit=1e9; int what=0; // 1 desk, 2 parchment, 3 object
  // desk plane
  if(rd.y<0.){ float t=-ro.y/rd.y; if(t>0.){ tHit=t; what=1; } }
  // parchment on the slope (with curled edges)
  float dn=dot(rd,PN);
  if(dn<0.){ float tp=-dot(ro-PC,PN)/dn; vec2 uv=vec2(0.);
    for(int it=0;it<3;it++){ vec3 pp=ro+rd*tp-PC; uv=vec2(pp.x,dot(pp,PV)); float curl=.018*pow(smoothstep(.3,.56,abs(uv.y)),2.)+.012*pow(smoothstep(.55,.8,abs(uv.x)),2.)+.003;
      tp=(curl-dot(ro-PC,PN))/dn; }
    vec3 pp=ro+rd*tp-PC; uv=vec2(pp.x,dot(pp,PV));
    float edge=min(.78-abs(uv.x),.55-abs(uv.y))+(fbm(vec3(uv*9.,4.))-.5)*.035;
    if(edge>0. && tp>0. && tp<tHit){ tHit=tp; what=2; } }
  // objects
  float tObj=1e9, mObj=0.;
  { float t=.02; int NS=uD.z>.5?160:96;
    for(int i=0;i<160;i++){ if(i>=NS) break; vec3 p=ro+rd*t; float m; float d=mapScene(p,m);
      if(d<.0004*t+.0002){ tObj=t; mObj=m; break; } t+=d*.9; if(t>min(tHit,9.)) break; } }
  if(tObj<tHit){ tHit=tObj; what=3; }
  vec3 W=WICK();
  if(what>0){ vec3 p=ro+rd*tHit; vec3 c;
    if(what==1){ vec3 n=vec3(0,1,0); vec3 alb=woodCol(p.xz,1.);
      c=shade(p,n,rd,alb,90.,0.,1.);
      // varnish: the flame mirrored in the desk
      vec3 rr=reflect(rd,n); vec3 lp=LP(); float tl=max(dot(lp-p,rr),0.); float dl=length(p+rr*tl-lp);
      float fr=.05+.95*pow(1.-max(dot(n,-rd),0.),5.);
      c+=FLC*uD.y*fr*(.0009/(dl*dl+.0006))*(.6+.4*noise(vec3(p.xz*40.,1.)));
      c*=exp(-max(length(p.xz-vec2(-.3,-.1))-1.6,0.)*1.2);
    } else if(what==2){ vec3 pp=p-PC; vec2 uv=vec2(pp.x,dot(pp,PV));
      float edge=min(.78-abs(uv.x),.55-abs(uv.y))+(fbm(vec3(uv*9.,4.))-.5)*.035;
      vec3 alb=parchCol(uv,edge);
      vec2 tuv=vec2((uv.x+.62)/1.24,(uv.y+.22)/.31); float wet; float ink=inkAt(tuv,wet);
      alb*=1.-ink*vec3(.93,.95,.96);
      float fb=noise(vec3(uv.x*160.,uv.y*45.,4.))-.5;
      vec3 n=normalize(PN+PV*(.06*sign(uv.y)*smoothstep(.3,.56,abs(uv.y)))+vec3(1,0,0)*(.04*sign(uv.x)*smoothstep(.55,.8,abs(uv.x)))+vec3(fb*.05,0.,fb*.03));
      c=shade(p,n,rd,alb,mix(18.,220.,wet),.15,0.);
      // a little light passes through thin parchment
      c+=alb*FLC*uD.y*.02/(dot(LP()-p,LP()-p)+.05);
    } else { vec3 n=calcNormal(p); vec3 q=p-CB;
      if(mObj==1.){ // wax: ivory with light scattered through the top
        vec3 alb=vec3(.82,.72,.56);
        c=shade(p,n,rd,alb,30.,.35,0.);
        float thick=exp(-max(CTOP+.01-q.y,0.)*9.);
        c+=vec3(1.,.48,.16)*thick*uD.y*1.1*(.6+.4*smoothstep(-.2,.6,dot(n,-rd)));
      } else if(mObj==2.){ // brass
        vec3 alb=vec3(.55,.36,.14);
        c=shade(p,n,rd,alb*.35,140.,0.,0.);
        vec3 rr=reflect(rd,n); vec3 lp=LP(); float tl=max(dot(lp-p,rr),0.); float dl=length(p+rr*tl-lp);
        c+=vec3(1.,.66,.3)*uD.y*.0012/(dl*dl+.0008)*alb*2.;
        c+=alb*vec3(.4,.3,.2)*.02*uD.w;
      } else if(mObj==3.){ // wick, its tip glowing
        float tip=smoothstep(CTOP+.005,CTOP+.028,q.y);
        c=vec3(.01)+vec3(2.5,.7,.12)*tip*(uS.w+uD.x*.6);
      } else if(mObj==4.){ // the slope box: dark polished wood
        vec3 r=p-PC; vec2 wp=vec2(r.x,dot(r,PV));
        vec3 alb=woodCol(wp*1.3+vec2(3.1,1.7),.8);
        c=shade(p,n,rd,alb,70.,0.,1.);
      } else { // books: worn leather, cream page edges, a gilt band
        vec3 b=mObj==5.? p-vec3(1.32,.07,-.78) : p-vec3(1.28,.185,-.74); b.xz*=rot(mObj==5.?.25:-.12);
        vec3 hs=mObj==5.? vec3(.30,.065,.21) : vec3(.26,.05,.19);
        float pages=step(abs(b.y),hs.y-.012)*step(hs.z-.012,abs(b.z));
        vec3 alb=mObj==5.? vec3(.14,.035,.02) : vec3(.05,.06,.035);
        alb*=.7+.3*fbm(b*30.);
        if(pages>.5) alb=vec3(.55,.45,.3)*(.85+.15*sin(b.y*900.));
        float gilt=step(abs(abs(b.x)-hs.x+.06),.006)*(1.-pages);
        float gl=mix(20.,160.,gilt);
        if(gilt>.5) alb=vec3(.7,.48,.18);
        c=shade(p,n,rd,alb,gl,0.,1.);
      }
    }
    // air between us and the surface
    float fog=1.-exp(-tHit*.04*uF.w);
    col=mix(c,vec3(.006,.004,.003),fog);
  }
  // the word of light, floating above the flame
  if(uF.z>0.){ vec3 wn=normalize(cross(uWR,uWU)); float dw=dot(rd,wn);
    if(abs(dw)>1e-4){ float tw=dot(uWP.xyz-ro,wn)/dw; if(tw>0.){ vec3 q=ro+rd*tw-uWP.xyz; float x=dot(q,uWR)/uWP.w, y=dot(q,uWU)/uWP.w;
        vec2 wuv=vec2(.5+x*.5,.5+y*4.);
        if(wuv.x>0.&&wuv.x<1.&&wuv.y>0.&&wuv.y<1.){
          float g=texture(uWord,wuv).r; float gb=textureLod(uWord,wuv,3.).r;
          float n=noise(vec3(wuv*vec2(160.,20.),7.));
          float rv=smoothstep(n*.8,n*.8+.2,uF.y);
          col+=vec3(1.,.74,.40)*(g*2.6+gb*.5)*rv*uF.z;
        } } } }
  // flame and the glow it makes in the air
  col+=flameVol(ro,rd,tHit);
  { vec3 lp=LP(); float tl=dot(lp-ro,rd); if(tl>0.&&tl<tHit+.3){ float dl=length(ro+rd*tl-lp);
      col+=FLC*uD.y*(.00075/(dl*dl+.0011)+.012*exp(-dl*3.5)); } }
  if(uE.w>0.){ float tl=dot(uE.xyz-ro,rd); if(tl>0.){ float dl=length(ro+rd*tl-uE.xyz); col+=vec3(1.,.45,.12)*uE.w*(.0002/(dl*dl+.0004)); } }
  col+=texture(uSeg,gl_FragCoord.xy/uRes).rgb;
  fragColor=vec4(col,1.);
}`;
  SHADERS.ch2_desk = DESK;

  // ---------------------------------------------------------------- section A/B: desk, candle, ink, embers, word
  const FL = [-1.08 + 0.003, 0.6 + 0.026, -0.15];           // wick top in world
  const NWORD = 3600, NFREE = 900;
  // ember path during the title card: drifts down from the upper right and touches the wick at 6.0
  function emberPos(k) {
    const u = clamp((k - 0.3) / 5.7);
    const e = 1 - Math.pow(1 - u, 1.6);
    const A = [0.85, 1.25, 0.55], B = [-0.2, 1.05, -0.25], C = [-0.75, 0.9, -0.1], D = FL;
    const b = (a, b, c, d, s) => { const m = 1 - s; return a * m * m * m + 3 * b * m * m * s + 3 * c * m * s * s + d * s * s * s; };
    const p = [0, 1, 2].map(i => b(A[i], B[i], C[i], D[i], e));
    const sway = (1 - u) * 0.06;
    p[0] += Math.sin(k * 1.3 + 0.4) * sway; p[1] += Math.sin(k * 1.9) * sway * 0.6; p[2] += Math.cos(k * 1.1) * sway;
    return p;
  }
  function flameState(k, T) {
    const ign = sm(6.0, 6.55, k), ov = Math.exp(-Math.max(k - 6.2, 0) * 2.2) * sm(6.0, 6.25, k);
    const size = ign * (1 + 0.35 * ov);
    const fl = 1 + 0.06 * Math.sin(T * 9.3) + 0.04 * Math.sin(T * 15.1 + 1.3) + 0.05 * Math.sin(T * 3.7 + 0.5);
    const sway = [0.004 * Math.sin(T * 1.7) + 0.0025 * Math.sin(T * 4.3 + 1), 0.003 * Math.cos(T * 1.3 + 0.7)];
    return { size, I: 2.4 * ign * fl * (1 + 0.6 * ov), sway, h: 1 + 0.05 * Math.sin(T * 7.1) + 0.04 * Math.sin(T * 12.7 + 2) };
  }
  function deskCam(k) {
    // 0–8 settle onto the page; 8–18 slow push; 18–25 crane up to the flame; 25–32.5 hold and push; 32.5–36 tilt to the sky
    const P0 = [0.22, 1.2, 2.35], A0 = [-0.12, 0.38, -0.1];
    const P1 = [0.05, 1.1, 2.1], A1 = [-0.05, 0.36, -0.1];
    const P2 = [0.0, 1.02, 1.86], A2 = [-0.08, 0.35, -0.1];
    const P3 = [-0.52, 1.0, 1.32], A3 = [-1.0, 1.06, -0.2];
    const P4 = [-0.6, 1.02, 1.12];
    let pos, at, fov = 1.4;
    if (k < 8) { const u = easeIO(k / 8); pos = mix3(P0, P1, u); at = mix3(A0, A1, u); }
    else if (k < 18) { const u = easeIO((k - 8) / 10); pos = mix3(P1, P2, u); at = mix3(A1, A2, u); fov = lerp(1.4, 1.45, u); }
    else if (k < 25) { const u = easeIO((k - 18) / 7); pos = mix3(P2, P3, u); at = mix3(A2, A3, ease(clamp((k - 18.4) / 6.6))); fov = lerp(1.45, 1.35, u); }
    else { const u = easeIO(clamp((k - 25) / 11)); pos = mix3(P3, P4, u); at = A3; fov = 1.35; }
    let cam = camAt(pos, at, fov);
    if (k > 32.5) { const u = easeIO(clamp((k - 32.5) / 3.5)); cam = camDir(pos, norm(mix3(cam.fwd, SKY_F0, u)), lerp(1.35, SKY_FOV0, u)); }
    return cam;
  }
  // word plane: fixed in the world above the flame, facing the camera at 28 s
  let WP = null;
  function wordPlane() {
    if (WP) return WP;
    const cam = deskCam(28), { f, r, u } = camBasis(cam);
    const c = add3(cam.pos, mul3(f, 1.62));
    WP = { c, r, u, f, hw: 0.74 };
    return WP;
  }
  // per-ember constants
  let EM = null;
  function buildEmbers() {
    if (EM) return EM;
    const r = rng(113), N = NWORD + NFREE, E = [];
    for (let i = 0; i < N; i++) {
      const word = i < NWORD;
      const birth = 18.4 + Math.pow(r(), 0.85) * 5.6;
      const tgt = word ? WORD.pts[i] : null;
      E.push({
        word, birth, v: 0.32 + r() * 0.5, spread: 0.05 + r() * 0.12,
        ph: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28], fr: [0.7 + r() * 1.3, 1.1 + r() * 1.6, 0.5 + r() * 0.9],
        R: 0.25 + Math.pow(r(), 0.7) * 1.25, th0: r() * 6.28, om: 0.45 + r() * 0.5, tilt: (r() - 0.5) * 0.7, zR: (r() - 0.5) * 0.5,
        tgt, a0: word ? 24.6 + (tgt[0] * 0.5 + 0.5) * 1.5 + r() * 0.9 : 0, dur: 1.5 + r() * 0.7,
        size: 0.8 + Math.pow(r(), 2.5) * 2.2, temp: r(), flick: 3 + r() * 9, life: 2.2 + r() * 3.5,
        star: -1,
      });
    }
    EM = E; return E;
  }
  // ember position in word-plane coordinates (x right, y up, z toward camera), plus a brightness
  const FLW = () => { const P = wordPlane(), d = sub(FL, P.c); return [dot(d, P.r) / P.hw, dot(d, P.u) / P.hw, -dot(d, P.f) / P.hw]; };
  function emberLocal(e, t, flw) {
    const tau = t - e.birth; if (tau < 0) return null;
    // rise: fast at first, cooling and slowing, drifting on slow eddies
    const rise = e.v * (1 - Math.exp(-tau * 0.9)) / 0.9 * 1.25;
    const w = Math.min(tau, 4) * e.spread;
    const rx = flw[0] + Math.sin(tau * e.fr[0] + e.ph[0]) * w + Math.sin(tau * e.fr[1] * 1.7 + e.ph[1]) * w * 0.35;
    const ry = flw[1] + 0.06 + rise / 0.74;
    const rz = flw[2] + Math.cos(tau * e.fr[2] + e.ph[2]) * w;
    if (!e.word) return [rx, ry, rz, Math.max(0, 1 - tau / e.life)];
    // swirl: a slow tilted vortex around the word
    const th = e.th0 + e.om * (t - 21) / Math.max(e.R, 0.4);
    const sx = Math.cos(th) * e.R * 1.15, sy = 0.05 + Math.sin(th) * e.R * 0.32 + e.tilt * 0.2, sz = Math.sin(th) * e.R * 0.5 + e.zR;
    const w1 = sm(e.birth + 0.8, e.birth + 3.4, t);
    let x = lerp(rx, sx, w1), y = lerp(ry, sy, w1), z = lerp(rz, sz, w1);
    const w2 = ease(clamp((t - e.a0) / e.dur));
    x = lerp(x, e.tgt[0], w2); y = lerp(y, e.tgt[1], w2); z = lerp(z, 0, w2);
    return [x, y, z, 1, w2];
  }
  const toWorld = (l) => { const P = wordPlane(); return add3(P.c, add3(mul3(P.r, l[0] * P.hw), add3(mul3(P.u, l[1] * P.hw), mul3(P.f, -l[2] * P.hw)))); };
  // star targets for the embers that become the constellation are filled in by the sky section
  function drawEmbers(k, T, cam, out) {
    const E = buildEmbers(), flw = FLW(); const dt = 1 / 48;
    let cx = 0, cy = 0, cz = 0, cn = 0;
    const scatter = sm(32.6, 35.5, k);
    for (let i = 0; i < E.length; i++) {
      const e = E[i]; if (k < e.birth) continue;
      const a = emberLocal(e, k, flw); if (!a) continue;
      const b = emberLocal(e, k - dt, flw) || a;
      let A = toWorld(a), B = toWorld(b);
      let pa = project(cam, A), pb = project(cam, B); if (!pa || !pb) continue;
      let life = a[3]; if (life <= 0) continue;
      const locked = a[4] || 0;
      // flicker and colour: hot gold when young or assembled, deep orange as they cool
      const fl = 0.55 + 0.45 * Math.sin(T * e.flick + e.ph[3]);
      const tau = k - e.birth;
      const heat = clamp(1 - tau * 0.18) * 0.6 + locked * 0.5 + e.temp * 0.2;
      let I = (0.6 + 0.9 * fl) * life * (1 - 0.72 * sm(27.6, 29.5, k) * locked);
      // scattering into stars at the end of the section
      if (scatter > 0 && e.word) {
        const st = e.star;
        if (st >= 0 && out.stars) { const sp = out.stars[st]; if (sp) { const u = ease(clamp((k - 32.8 - (i % 7) * 0.08) / 2.8)); pa = [lerp(pa[0], sp[0], u), lerp(pa[1], sp[1], u), pa[2]]; pb = [lerp(pb[0], sp[0], u), lerp(pb[1], sp[1], u), pb[2]]; I = lerp(I, sp[2], u); } }
        else { const drift = scatter * scatter; const dx = (hsh(i, 1) - 0.5) * 900 * drift, dy = -(0.3 + hsh(i, 2)) * 500 * drift;
          pa = [pa[0] + dx, pa[1] + dy, pa[2]]; pb = [pb[0] + dx * 0.97, pb[1] + dy * 0.97, pb[2]]; I *= 1 - sm(33.2, 35.8, k) * (0.6 + 0.4 * hsh(i, 3)); }
      }
      const dist = pa[2]; const rad = e.size * 1.6 / Math.max(dist, 0.3);
      const L = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); const norm1 = rad * 1.8 / (L + rad * 1.8);
      const cr = 1.0, cg = 0.42 + 0.38 * heat, cb = 0.1 + 0.32 * heat * heat;
      const s = I * 3.2 * norm1;
      seg(pb[0], pb[1], pa[0], pa[1], cr * s, cg * s, cb * s, rad);
      if (k < 33) { cx += A[0]; cy += A[1]; cz += A[2]; cn++; }
    }
    return cn ? [cx / cn, cy / cn, cz / cn, Math.min(cn / 2500, 1)] : [0, 0, 0, 0];
  }

  function sceneDesk(k, T) {
    buildInk(); buildWord();
    const cam = deskCam(k), f = flameState(k, T), sc = SCALE();
    segReset();
    // the drifting ember of the title card
    let eL = [0, 0, 0, 0];
    if (k < 6.2) {
      const p = emberPos(k), p2 = emberPos(k - 1 / 48), a = project(cam, p), b = project(cam, p2);
      const I = sm(0.3, 1.4, k) * (1 - sm(5.9, 6.15, k)) * (0.75 + 0.25 * Math.sin(T * 7.3));
      if (a && b) { seg(b[0], b[1], a[0], a[1], 3.2 * I, 1.3 * I, 0.35 * I, 2.2 / a[2] * 1.6); seg(a[0], a[1], a[0], a[1], 9 * I, 5 * I, 2.2 * I, 0.9 / a[2] * 1.6); }
      eL = [...p, 0.035 * I];
    }
    let swarm = [0, 0, 0, 0];
    if (k > 18.2) swarm = drawEmbers(k, T, cam, { stars: SKY_STARS_SCREEN(k) });
    const tex = SEG.render(sc);
    const P = wordPlane();
    const wordReveal = clamp((k - 26.3) / 1.7), wordGlow = sm(26.0, 27.2, k) * (1 - sm(32.6, 34.2, k)) * (0.92 + 0.08 * Math.sin(T * 2.1));
    const room = 1 - sm(31, 35, k);
    const lp = project(cam, add3(FL, [0, 0.07, 0]));
    GL.frame({ name: "ch2_desk", fs: DESK, scale: sc, textures: { uSeg: tex, uInk: INK.tex, uWord: WORD.tex },
      uniforms: { uTime: T, ...camUniforms(cam), uD: [f.size * room, f.I * room, Q(), 1], uE: eL, uF: [sm(32.4, 35.2, k), wordReveal, wordGlow, 1],
        uG: [swarm[0], swarm[1], swarm[2], swarm[3] * 0.05 * room], uWP: [...P.c, P.hw], uWR: P.r, uWU: P.u,
        uS: [f.sway[0], f.sway[1], f.h, sm(5.6, 6.0, k) * (1 - sm(6.0, 6.4, k)) * 2], uInkX: { float: [...INK.X, ...new Array(30 - INK.X.length).fill(2)] }, uInkA: { float: inkAges(k) } } },
      { bloom: 0.7, thresh: 1.0, exposure: 1.05, rays: lp ? [lp[0] / W, 1 - lp[1] / H, 0.12 * f.size * room] : [0.5, 0.5, 0], letterbox: LB, vignette: 0.55, ca: 0.0012, t: T });
    blit();
  }

  // ---------------------------------------------------------------- sky placeholders (filled in below)
  const SKY_F0 = norm([-0.28, 0.62, -1.0]), SKY_FOV0 = 1.35;
  function SKY_STARS_SCREEN(k) { return null; }

  // ---------------------------------------------------------------- chapter
  chapter("ch2", 90, (k, T) => {
    if (k < 36) sceneDesk(k, T);
    // captions
    if (k < 6.2) chapterCard(k, "II", "불씨");
    caption(k, 7.0, 18.8, (a, u) => capT("1950 · 앨런 튜링", a, u));
    caption(k, 21.0, 33.2, (a, u) => capT("1956 · 다트머스", a, u));
    caption(k, 28.2, 33.6, (a, u) => capB("인공지능이라는 학문이 시작되다", a, u));
  });
})();
