// 「IV · 문턱」 (The Threshold): ch4, 102 s, film time 303–405.
// A procession of impossible things: the marble stair ignites step by step, a sealed bronze gate leaks light,
// Erdős's 1946 inequality is struck by fire, ten stars ignite, 450 is cast in gold, Navier–Stokes blows up into light,
// and the gate opens onto a turning spiral that hands off to chapter V.
(() => {
  const PRE = "ch4_";
  const Qf = () => (FINAL() ? 1 : 0);

  // ---------- small helpers
  const xfade = (u, drawA, drawB) => { // u: 0 → A only, 1 → B only
    if (u <= 0) return drawA();
    if (u >= 1) return drawB();
    drawA(); o.save(); o.globalAlpha = u; drawB(); o.restore();
  };
  function mspline(ts, vs, t) { // monotone cubic through keyframes
    const n = ts.length;
    if (t <= ts[0]) return vs[0];
    if (t >= ts[n - 1]) return vs[n - 1];
    const d = [], m = new Array(n);
    for (let j = 0; j < n - 1; j++) d.push((vs[j + 1] - vs[j]) / (ts[j + 1] - ts[j]));
    m[0] = 0; m[n - 1] = d[n - 2];
    for (let j = 1; j < n - 1; j++) m[j] = d[j - 1] * d[j] <= 0 ? 0 : (d[j - 1] + d[j]) / 2;
    for (let j = 0; j < n - 1; j++) {
      if (d[j] === 0) { m[j] = m[j + 1] = 0; continue; }
      const a = m[j] / d[j], b = m[j + 1] / d[j], s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); m[j] = tau * a * d[j]; m[j + 1] = tau * b * d[j]; }
    }
    let i = 0; while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], u = (t - ts[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * h * m[i + 1];
  }
  const camLook = (pos, at, fov, up = [0, 1, 0]) => ({ pos, fwd: norm(sub(at, pos)), up, fov });
  const small = (s, a, y = H - 24) => line(s, W / 2, y, { size: 19, color: "rgba(244,241,234,0.62)", alpha: a, spacing: 0.22, glow: 4 });
  // a bottom caption with a smaller aside inside the same line (e.g. a currency conversion); parts = [[text, size, color?], ...]
  const capMix = (parts, a, u) => {
    const sp = 0.2 - 0.06 * ease(u * 2), y = H - BAR / 2;
    o.save(); const ws = parts.map(([s, size]) => { o.font = `${size}px "SerifL"`; o.letterSpacing = `${sp * size}px`; return o.measureText(s).width; }); o.restore();
    let x = W / 2 - ws.reduce((t, w) => t + w, 0) / 2;
    parts.forEach(([s, size, color = STAR], i) => { line(s, x, y + (size < 40 ? 3 : 0), { size, color, glow: size < 40 ? 4 : 8, alpha: a, spacing: sp, blur: (1 - a) * 4, align: "left" }); x += ws[i]; });
  };

  // ---------- shared GLSL
  const H4 = `
uniform vec4 uD; uniform vec4 uE; uniform float uQ;
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float a=hash12(i), b=hash12(i+vec2(1,0)), c=hash12(i+vec2(0,1)), d=hash12(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm2(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn2(p); p=mat2(1.6,-1.2,1.2,1.6)*p+vec2(3.1,7.7); a*=.5; } return s; }
float fbm2q(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*vn2(p); p=mat2(1.6,-1.2,1.2,1.6)*p+vec2(3.1,7.7); a*=.5; } return s*1.14; }
float fbm3q(vec3 p){ float a=.5,s=0.; for(int i=0;i<3;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s*1.14; }
`;

  // A golden spiral of light (galaxy-like), used beyond the gate and in the final shot.
  // Disk centre SC, normal SN; spin = rotation phase; amt = brightness.
  const SPIRAL = `
const vec3 SC=vec3(0.,7.,95.); const vec3 SN=vec3(0.,0.76,-0.65);
float spiralDens(vec2 q, float spin, out float core){
  float r=length(q)/34.; float ph=atan(q.y,q.x);
  core=exp(-r*r*90.)*14.+exp(-r*11.)*1.4;
  float lr=log(max(r,.004));
  float rotP=spin*(1.6/(r+.25));                         // differential rotation: the inside turns faster
  float a=ph - lr/.30 - rotP;
  float warp=fbm2q(q*.09+vec2(spin*.1,0.))*1.6;
  float arms=pow(.5+.5*cos(2.*a+warp), 5.);
  float fine=pow(.5+.5*cos(2.*a+warp+.55+fbm2q(q*.35)*2.), 14.);
  float radial=exp(-r*2.6)*smoothstep(1.25,.6,r);
  float dust=smoothstep(.35,.75,fbm2q(vec2(a*1.3, lr*3.)+7.));
  float cellA=floor(a*40./6.2831853*3.), cellR=floor(lr*26.);
  float h=hash12(vec2(cellA,cellR));
  float spark=step(.93,h)*arms*2.5;
  return radial*(arms*1.4+fine*1.2+.08)*(1.-.55*dust)+spark*radial;
}
vec3 spiralCol(vec3 ro, vec3 rd, float spin, float amt){
  vec3 n=normalize(SN); vec3 ex=normalize(cross(n,vec3(0.,0.,1.))); if(length(cross(n,vec3(0,0,1)))<.01) ex=vec3(1,0,0); vec3 ey=cross(n,ex);
  vec3 bg=vec3(.004,.004,.009)+stars(rd,.55)+nebula(rd, vec3(.03,.02,.05), vec3(.22,.13,.05))*.35;
  float dn=dot(rd,n); if(abs(dn)<1e-4) return bg;
  vec3 acc=vec3(0); float core=0.;
  for(int i=0;i<5;i++){
    float off=(float(i)-2.)*1.1; float t=(dot(SC-ro,n)+off)/dn; if(t<0.) continue;
    vec3 p=ro+rd*t-SC; vec2 q=vec2(dot(p,ex),dot(p,ey)); float c;
    float d=spiralDens(q,spin,c)*exp(-off*off*.5);
    acc+=vec3(1.,.74,.38)*d*.32 + vec3(1.,.9,.72)*c*.2;
  }
  return bg + acc*amt;
}
`;

  // =====================================================================================
  // 1. THE MARBLE STAIR (0–22): floating marble steps, gold inlay, three risers ignite with engraved years.
  // uA: rise, run, half width, slab height   uB: seconds since ignition of the 3 inscribed steps, light level
  // uC: first inscribed step, glow at the top, cloud drift, -   uD: key light dir xyz, key intensity
  // =====================================================================================
  const STAIRS = COMMON + H4 + `
uniform sampler2D uTxt;
const float DEP=.46;
vec3 slabC(float k){ return vec3(0., k*uA.x-uA.w*.5, k*uA.y); }
float slab(vec3 p, float k){ return sdBox(p-slabC(k), vec3(uA.z, uA.w*.5, uA.y*DEP)-.04)-.04; }
float map(vec3 p, out float kk){
  float k0=floor(p.z/uA.y+.5); float d=1e9; kk=k0;
  for(int o=-1;o<=1;o++){ float kc=clamp(k0+float(o),-40.,400.); float di=slab(p,kc); if(di<d){ d=di; kk=kc; } }
  return min(d, uA.y*.9); }
float mapD(vec3 p){ float k; return map(p,k); }
vec3 nrm(vec3 p, float e){ vec2 h=vec2(e,0.);
  return normalize(vec3(mapD(p+h.xyy)-mapD(p-h.xyy), mapD(p+h.yxy)-mapD(p-h.yxy), mapD(p+h.yyx)-mapD(p-h.yyx))); }
float shadow(vec3 p, vec3 L){ float r=1., t=.03; int N=uQ>.5? 56:26;
  for(int i=0;i<56;i++){ if(i>=N) break; float h=mapD(p+L*t); r=min(r, 9.*h/t); if(r<.005) break; t+=clamp(h,.05,1.2); if(t>24.) break; }
  return clamp(r,0.,1.); }
float occl(vec3 p, vec3 n){ float s=0., w=1.; for(int i=1;i<=5;i++){ float h=.08*float(i); s+=w*max(h-mapD(p+n*h),0.); w*=.6; } return clamp(1.-s*2.,0.,1.); }
vec3 topDir(){ return normalize(vec3(0., uA.x, uA.y)); }
vec3 skyC(vec3 rd){
  float g=max(dot(rd,topDir()),0.);
  vec3 c=mix(vec3(.006,.007,.014), vec3(.020,.022,.040), smoothstep(-.5,.7,rd.y));
  c+=stars(rd,.45*(1.-smoothstep(.55,.97,g)));
  c+=nebula(rd*1.2, vec3(.016,.012,.026), vec3(.06,.04,.02))*.5;
  c+=vec3(1.,.86,.64)*(pow(g,1400.)*60.+pow(g,90.)*2.2+pow(g,10.)*.22+pow(g,2.5)*.05)*uC.y;
  return c; }
vec3 marble(vec3 p){
  float w=fbm(p*.55+vec3(3.1,1.2,0.));
  float v=abs(sin((p.x*.7+p.y*1.9+p.z*.45)*1.7+w*7.5));
  float v2=abs(sin((p.x*-.5+p.y*.8+p.z*1.3)*3.1+fbm(p*1.3)*6.));
  float vein=pow(1.-v,22.)*.6+pow(1.-v,4.)*.10+pow(1.-v2,30.)*.35;
  float cl=fbm(p*1.9+7.);
  vec3 base=mix(vec3(.74,.71,.66), vec3(.88,.86,.82), cl);
  base=mix(base, vec3(.34,.31,.29), clamp(vein,0.,1.));
  return base; }
float heat(float s){ return s<0.? 0. : 1.; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 L=normalize(uD.xyz); float lev=uB.w;
  float t=.1, kk=0.; bool hit=false;
  for(int i=0;i<170;i++){ vec3 p=ro+rd*t; float d=map(p,kk); if(d<.0005*t){ hit=true; break; } t+=d*.9; if(t>280.) break; }
  // background: sky, then a sea of cloud far below lit by the light at the top
  vec3 bg=skyC(rd);
  if(rd.y<-.003){ float tc=(-26.-ro.y)/rd.y; vec3 pc=ro+rd*tc;
    vec2 q=pc.xz*.022+vec2(uC.z,uC.z*.3);
    float n=fbm2(q+fbm2(q*1.7)*.9);
    float cov=smoothstep(.32,.78,n);
    float sl=fbm2(q+vec2(.05,.09))-n;
    vec3 cc=mix(vec3(.008,.009,.016), vec3(.10,.095,.10), cov)*lev + vec3(1.,.8,.55)*cov*clamp(.4+sl*9.,0.,1.)*.20*lev;
    cc+=vec3(1.,.78,.5)*pow(max(dot(rd*vec3(1.,-1.,1.),topDir()),0.),4.)*.25*cov*uC.y;
    bg=mix(cc, bg, 1.-exp(-tc*.0035)); }
  vec3 col=bg;
  if(hit){
    vec3 p=ro+rd*t; vec3 n=nrm(p, .0006*t+.0005);
    vec3 q=p-slabC(kk);
    vec3 alb=marble(p); float metal=0.; vec3 emit=vec3(0);
    float v=(q.y+uA.w*.5)/uA.w, u=(uA.z-q.x)/(2.*uA.z);
    bool front=n.z<-.6;
    float ins=kk-uC.x;
    // gold inlay: a thin band under the nosing of every riser and along the top edge
    float band=front? smoothstep(.885,.895,v)*smoothstep(.925,.915,v) : 0.;
    float stepLit=0.;
    if(ins>-.5 && ins<2.5){ float ii=floor(ins+.5); float s=ii<.5? uB.x : (ii<1.5? uB.y : uB.z); stepLit=s; }
    if(band>0.){ alb=mix(alb, vec3(1.,.74,.36), band); metal=max(metal,band); }
    if(front && ins>-.5 && ins<2.5 && v>.03 && v<.86){
      float ii=floor(ins+.5);
      float s=ii<.5? uB.x : (ii<1.5? uB.y : uB.z);
      vec2 tuv=vec2(u, (2.-ii+v/.86*.98+.01)/3.);
      float vis=smoothstep(-.05,.3,s);                       // the year is not there until its step ignites
      float m=texture(uTxt,tuv).r*vis;
      vec2 e=vec2(2./2048.,2./768.);
      float mx=(textureLod(uTxt,tuv+vec2(e.x,0.),1.).r-textureLod(uTxt,tuv-vec2(e.x,0.),1.).r)*vis;
      float my=(textureLod(uTxt,tuv+vec2(0.,e.y),1.).r-textureLod(uTxt,tuv-vec2(0.,e.y),1.).r)*vis;
      n=normalize(n + (vec3(-1.,0.,0.)*mx + vec3(0.,1.,0.)*my)*1.1);
      float dc=abs(u-.5)*2.;
      float fr=s/.6;                                         // the molten front runs out from the centre
      float filled=smoothstep(fr, fr-.05, dc)*step(0.,s);
      float since=max(s-dc*.6,0.);
      vec3 gold=vec3(1.,.72,.34);
      alb=mix(alb, mix(vec3(.16,.13,.10), gold, filled), m);
      metal=max(metal, m*mix(.4,1.,filled));
      vec3 hot=mix(vec3(10.,6.,2.8), vec3(3.2,1.4,.4), smoothstep(0.,.5,since));
      hot=mix(hot, vec3(1.15,.66,.24)*.75, smoothstep(.5,2.4,since));
      emit+=m*filled*hot;
      emit+=m*exp(-pow((dc-fr)/.025,2.))*step(0.,s)*step(dc,1.)*vec3(14.,9.,4.5);
    }
    if(stepLit>0.){ // the inlay and edges of an ignited step blaze, then glow
      float dc=abs(u-.5)*2.; float fr=stepLit/.6; float since=max(stepLit-dc*.6,0.);
      float on=smoothstep(fr,fr-.05,dc);
      vec3 g=mix(vec3(8.,5.,2.4), vec3(1.6,.95,.4), smoothstep(0.,1.6,since));
      emit+=band*on*g;
      float edge=front? (smoothstep(.97,1.,v)+smoothstep(.04,.0,v))*.5 : 0.;
      emit+=edge*on*g*.35;
    }
    // light
    float sh=shadow(p+n*.004, L), ao=occl(p,n);
    float dif=max(dot(n,L),0.), wrap=max((dot(n,L)+.35)/1.35,0.);
    vec3 keyC=vec3(1.,.84,.64)*uD.w*lev;
    vec3 amb=mix(vec3(.050,.040,.032), vec3(.045,.055,.085), n.y*.5+.5)*lev;
    vec3 diffC=alb*(keyC*(dif*.8+wrap*.12)*sh + amb*ao)*(1.-metal*.85);
    // glow from the ignited risers lights their neighbours
    for(int i=0;i<3;i++){ float s=i==0? uB.x : (i==1? uB.y : uB.z); if(s<=0.) continue;
      float I=(2.2*exp(-s*1.6)+.55)*smoothstep(0.,.25,s);
      vec3 P=slabC(uC.x+float(i))+vec3(0.,0.,-uA.y*DEP-.9);
      vec3 dl=P-p; float dd=length(dl); vec3 Ld=dl/dd;
      diffC+=alb*vec3(1.,.66,.3)*I*max(dot(n,Ld),0.)/(1.+dd*dd*.35)*(1.-metal*.6); }
    vec3 r=reflect(rd,n); float fre=pow(1.-max(dot(n,-rd),0.),5.);
    vec3 env=skyC(r);
    vec3 F0=mix(vec3(.035), alb, metal);
    vec3 spec=env*(F0+(1.-F0)*fre)*ao*mix(.6,1.6,metal);
    spec+=keyC*pow(max(dot(n,normalize(L-rd)),0.), mix(70.,220.,metal))*sh*mix(.3,3.,metal)*mix(vec3(1.),alb,metal);
    vec3 c=diffC+spec+emit;
    float fogA=1.-exp(-t*.010);
    vec3 fogC=mix(vec3(.016,.018,.03), vec3(.62,.47,.29)*uC.y, pow(max(dot(rd,topDir()),0.),6.))*lev;
    col=mix(c, fogC, fogA);
  }
  fragColor=vec4(col,1.); }`;

  const ST = { R: 0.9, D: 1.8, WD: 3.2, HB: 0.8, K0: 6 };
  const riserC = k => [0, k * ST.R - ST.HB / 2, k * ST.D - 0.46 * ST.D];
  const IGN = [9, 14, 19];
  let riserCanvas = null;
  function riserTex() {
    if (!riserCanvas) {
      const c = document.createElement("canvas"); c.width = 2048; c.height = 768;
      const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 2048, 768);
      x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "alphabetic";
      [["2023", "변호사 시험 상위 10%"], ["2024", "생각하는 법을 배우다"], ["2025", "국제수학올림피아드 금메달"]].forEach(([yr, s], i) => {
        const y0 = i * 256;
        x.font = '150px "SerifM"'; x.letterSpacing = "30px"; x.fillText(yr, 1024 + 15, y0 + 152);
        x.fillRect(1024 - 150, y0 + 178, 300, 3);
        x.font = '46px "SerifM"'; x.letterSpacing = "12px"; x.fillText(s, 1024 + 6, y0 + 236);
      });
      riserCanvas = c;
    }
    return GL.canvasTex(PRE + "riser", riserCanvas, { mip: true });
  }
  function stairsCam(k) {
    const kc = mspline([0, 6, 9, 11.4, 14, 16.4, 19, 22.5], [ST.K0 - 1.7, ST.K0 - 1.05, ST.K0, ST.K0 + 0.2, ST.K0 + 1, ST.K0 + 1.2, ST.K0 + 2, ST.K0 + 3.6], k);
    const ox = mspline([0, 6, 14, 22.5], [3.2, 2.7, 1.6, 0.2], k);
    const up = smooth(19.4, 22.5, k);
    const c = riserC(kc);
    const pos = [c[0] + ox, c[1] + 0.55 + 1.6 * up, c[2] - 5.0 - 0.6 * up];
    const tgt = lerp3([c[0] - 0.35, c[1] + 0.05, c[2] + 0.4], riserC(kc + 9), ease(up));
    return camLook(pos, tgt, 1.3);
  }
  function drawStairs(k, T, extra = {}) {
    const cam = stairsCam(k);
    const lev = 0.2 + 0.8 * smooth(4.2, 8.5, k);
    const s = IGN.map(t0 => k - t0);
    const L = norm([0.78, 0.62, -0.1]);
    const topG = 0.35 + 0.65 * smooth(4, 9, k) + 1.4 * smooth(19.5, 22.4, k);
    const td = norm([0, ST.R, ST.D]), tq = project(cam, [cam.pos[0] + td[0] * 300, cam.pos[1] + td[1] * 300, cam.pos[2] + td[2] * 300]);
    GL.frame({ name: PRE + "stairs", fs: STAIRS, scale: SC(0.55, 1.5), textures: { uTxt: riserTex() },
      uniforms: { uTime: T, ...camUniforms(cam), uA: [ST.R, ST.D, ST.WD, ST.HB], uB: [s[0], s[1], s[2], lev], uC: [ST.K0, topG, T * 0.004, 0], uD: [...L, 2.0], uQ: Qf() } },
    { bloom: 0.55 + 0.2 * smooth(19.5, 22.4, k), thresh: 1.0, exposure: 1.0 + 0.5 * smooth(20.2, 22.4, k), rays: tq ? [tq[0] / W, 1 - tq[1] / H, 0.3 + 0.3 * smooth(19.5, 22, k)] : [0.5, 1.2, 0.2], letterbox: LB, vignette: 0.55, t: T, lift: extra.lift ?? 0 });
    blit();
  }

  // =====================================================================================
  // 2. THE GATE (22–40 sealed, 83–98 opening): a Romanesque portal, bronze leaves with astrolabe medallions,
  // a seal of light across the seam, light leaking through every gap, dust in the shafts, a spiral beyond.
  // uA: open angle (rad), seal glow, leak intensity, interior light   uB: dust, spiral amount, spiral spin, -
  // =====================================================================================
  const GATE = COMMON + H4 + SPIRAL + `
const float HW=3., HS=10., TH=.5, ZF=.1, ZW=-2.4;
float gSeal;
float opening2(vec2 xy, float w){ return min(max(abs(xy.x)-w, xy.y-HS), length(vec2(xy.x, xy.y-HS))-w); }
// relief of a bronze leaf: q.x = distance from the seam (0..3), q.y = height. Returns 0..~1.4; seal = groove mask.
float leafRelief(vec2 q, out float seal){
  seal=0.;
  vec2 lo, hi; int pid;
  if(q.y<2.9){ lo=vec2(.32,.45); hi=vec2(2.68,2.75); pid=0; } else if(q.y<7.4){ lo=vec2(.32,3.05); hi=vec2(2.68,7.25); pid=1; } else { lo=vec2(.32,7.55); hi=vec2(2.68,9.55); pid=2; }
  vec2 dd=min(q-lo, hi-q); float din=min(dd.x,dd.y);
  float h=din<0.? 1. : .28;
  h=mix(h, 1., smoothstep(.02,-.015,din));
  h+=.55*exp(-pow((din-.11)/.022,2.)) + .3*exp(-pow((din-.2)/.012,2.));
  // studs on the stiles and rails
  if(din<-.03){ vec2 sp=vec2(.16, .16); vec2 g=q; float sx=fract(g.y/.42)-.5; float dist=1e9;
    float cx=q.x<.32? .16 : (q.x>2.68? 2.84 : -1.);
    if(cx>0.) dist=length(vec2(q.x-cx, sx*.42));
    float rowY=q.y<2.9? (q.y<.45? .22 : 2.9) : (q.y<7.4? (q.y<3.05? 2.9 : 7.4) : (q.y<7.55? 7.4 : 9.78));
    if(abs(q.y-rowY)<.2){ float fx=fract(q.x/.42)-.5; dist=min(dist, length(vec2(fx*.42, q.y-rowY))); }
    h+=.55*sqrt(max(0.,1.-dist*dist/.0049)); }
  if(pid!=1 && din>0.){ // astrolabe medallion
    vec2 c=(lo+hi)*.5; vec2 d=q-c; float r=length(d); float a=atan(d.y,d.x);
    h+=.5*exp(-pow((r-.9)/.035,2.)) + .35*exp(-pow((r-.72)/.022,2.)) + .25*exp(-pow((r-.42)/.02,2.));
    float tick=smoothstep(.2,.0,abs(fract(a*36./6.2831853)-.5)*2.-.0)*step(.73,r)*step(r,.89);
    h+=.3*smoothstep(.75,.95,1.-abs(fract(a*36./6.2831853)-.5)*2.)*step(.73,r)*step(r,.89);
    float st=.13+.24*pow(abs(cos(a*4.)),9.)+.08*pow(abs(cos(a*4.+.785)),9.);
    h+=.35*smoothstep(.012,-.012,r-st)*step(.0,r);
    h+=.45*sqrt(max(0.,1.-r*r/.008));
    h+=.18*smoothstep(.01,-.01,abs(r-.58)-.012);
  }
  if(pid==1 && din>0.){ // the seal: carved grooves that hold light, centred on the seam
    vec2 d=vec2(q.x, q.y-5.15); float r=length(d); float a=atan(d.y,d.x);
    float g=exp(-pow((r-1.78)/.03,2.)) + exp(-pow((r-1.5)/.022,2.)) + exp(-pow((r-.5)/.028,2.)) + exp(-pow((r-.26)/.018,2.));
    float cell=a*40./6.2831853; float ci=floor(cell); float fx=fract(cell)-.5; float hh=hash12(vec2(ci,3.)), hh2=hash12(vec2(ci,9.));
    float bar=smoothstep(.16,.08,abs(fx))*smoothstep(1.55+hh2*.06,1.58+hh2*.06,r)*smoothstep(1.74-hh*.08,1.71-hh*.08,r)*step(.25,hh);
    vec2 ad=abs(d);
    float dia=exp(-pow((ad.x+ad.y-1.42)/.018,2.)), sqr=exp(-pow((max(ad.x,ad.y)-1.005)/.018,2.));
    float star=(dia+sqr)*smoothstep(1.47,1.42,r)*smoothstep(.5,.56,r);
    float dots=smoothstep(.05,.03,length(vec2(fract(a*16./6.2831853)-.5, (r-1.62)*2.6)*vec2(.5,1.)))*0.;
    seal=clamp(g+bar+star,0.,1.);
    h+=.25*exp(-pow((r-1.64)/.15,2.));
    h-=.55*seal;
    // straps of light across the leaves above and below the seal
  }
  float strap=smoothstep(.035,.015,abs(q.y-2.9))+smoothstep(.035,.015,abs(q.y-7.4));
  seal=max(seal, strap*step(q.x,2.68));
  h-=.3*strap;
  return h; }
// leaf distance in mirrored local frame; also returns relief coordinates
float leaf(vec3 p, out vec2 rq, out float lz){
  vec3 m=vec3(abs(p.x), p.y, p.z);
  float dx=HW-m.x, dz=m.z-(ZF+TH);
  float c=cos(uA.x), s=sin(uA.x);
  vec3 l=vec3(dx*c+dz*s, m.y, -dx*s+dz*c);
  rq=vec2(HW-l.x, l.y); lz=l.z;
  float b=sdBox(l-vec3(HW*.5, HS*.5, -TH*.5), vec3(HW*.5-.004, HS*.5, TH*.5));
  if(b<.25 && l.z<-TH+.2){ float sl; b-=.10*leafRelief(rq, sl); return b*.55; }
  return b; }
float floorH(float z){ return z>-7.? 0. : -.26*ceil((-7.-z)/.78); }
float mapG(vec3 p, out int mat){
  // floor + steps
  float d=max((p.y-floorH(p.z))*.75, p.z-1.6); mat=0;
  // wall with stepped, arched orders
  vec2 xy=p.xy;
  float wall=max(sdBox(p-vec3(0.,22.,-.45), vec3(40.,22.,1.95)), -opening2(xy,4.65));
  // receding orders as solid rings (no internal boundaries in the empty doorway)
  for(int j=1;j<=3;j++){ float wo=4.65-.55*float(j-1), wi=j<3? 4.65-.55*float(j) : HW; float z0=j<3? ZW+.8*float(j) : -.01;
    float ring=max(max(opening2(xy,wo), -opening2(xy,wi)), max(z0-p.z, p.z-1.5));
    wall=min(wall, ring); }
  // tympanum fills the arch above the leaves, set back
  float ty=max(max(length(vec2(p.x,p.y-HS))-HW-.02, HS-p.y), max(.38-p.z, p.z-1.5));
  if(ty<.3){ float a=atan(p.y-HS,p.x); float r=length(vec2(p.x,p.y-HS));
    float rel=.06*pow(abs(cos(a*13.)),3.)*smoothstep(.7,1.,r)*smoothstep(2.9,2.6,r) + .1*smoothstep(.55,.45,r)*(.6+.4*cos(a*16.));
    ty-=rel; }
  wall=min(wall, ty);
  // lintel band above the leaves
  wall=min(wall, sdBox(p-vec3(0.,HS+.22,.2), vec3(HW+.05,.22,.18))-.02);
  if(wall<d){ d=wall; mat=1; }
  // roll mouldings: columns that continue round the arch
  for(int j=0;j<3;j++){ float w=4.65-.55*float(j); float zj=ZW+.8*float(j);
    vec2 cq=p.y<HS? vec2(abs(p.x)-w, p.z-zj) : vec2(length(vec2(p.x,p.y-HS))-w, p.z-zj);
    float cd=length(cq)-.27;
    float cap=sdBox(vec3(abs(p.x)-w, p.y-(HS-.3), p.z-zj), vec3(.45,.3,.45))-.03;
    float bas=sdBox(vec3(abs(p.x)-w, p.y-.25, p.z-zj), vec3(.42,.25,.42))-.03;
    cd=min(cd, min(cap,bas));
    if(cd<d){ d=cd; mat=2; } }
  // leaves
  vec2 rq; float lz; float lf=leaf(p,rq,lz);
  if(lf<d){ d=lf; mat=3; }
  return d; }
float mapD(vec3 p){ int m; return mapG(p,m); }
vec3 nrmG(vec3 p, float e){ vec2 h=vec2(e,0.);
  return normalize(vec3(mapD(p+h.xyy)-mapD(p-h.xyy), mapD(p+h.yxy)-mapD(p-h.yxy), mapD(p+h.yyx)-mapD(p-h.yyx))); }
float occl(vec3 p, vec3 n){ float s=0., w=1.; for(int i=1;i<=4;i++){ float h=.12*float(i); s+=w*max(h-mapD(p+n*h),0.); w*=.6; } return clamp(1.-s*1.6,0.,1.); }
float openA(){ return HW*(1.-cos(uA.x)); }
// the slit lights (closed) as seen on the door plane
float leakAt(vec2 xy){
  if(xy.y<0.) return 0.;
  float inH=step(xy.y,HS);
  float seam=(exp(-abs(xy.x)/.010)*5.+exp(-abs(xy.x)/.07)*.5)*inH*smoothstep(0.,.3,xy.y);
  float hinge=(exp(-abs(abs(xy.x)-HW)/.008)*1.6+exp(-abs(abs(xy.x)-HW)/.05)*.12)*inH;
  float top=(exp(-abs(xy.y-HS)/.008)*1.8+exp(-abs(xy.y-HS)/.05)*.15)*step(abs(xy.x),HW);
  return seam+hinge+top; }
float sheet(vec3 p){
  float dz=max(ZF-p.z,0.); float fall=1./(1.+dz*.22);
  float wS=.035+dz*.075;
  float s=exp(-pow(p.x/wS,2.))*(.05/wS)*step(0.,p.y)*smoothstep(HS+dz*.6+.2, HS-.6, p.y);
  float wH=.025+dz*.04;
  float h=exp(-pow((abs(p.x)-HW-dz*.02)/wH,2.))*(.012/wH)*step(0.,p.y)*smoothstep(HS+.2,HS-.4,p.y);
  float tp=exp(-pow((p.y-HS-dz*.03)/wH,2.))*(.012/wH)*smoothstep(HW+.3+dz*.03,HW-.2,abs(p.x));
  return (s+h+tp)*fall; }
float beam(vec3 p){
  float dz=max(ZF+TH-p.z,0.); float a=openA();
  float wx=a+dz*.035, wy=HS+dz*.03;
  float bx=smoothstep(wx+.25+dz*.03, wx-.25, abs(p.x));
  float by=smoothstep(wy+.4, wy-.4, p.y)*step(0.,p.y);
  return bx*by*(a/HW*.8+.2)/(1.+dz*.08); }
vec3 interior(vec3 ro, vec3 rd){
  vec3 sp=spiralCol(ro, rd, uB.z, uB.y)*uB.y;
  float glare=uA.w;
  return sp + vec3(1.,.9,.74)*glare; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  float t=.05; int mat=0; bool hit=false;
  for(int i=0;i<180;i++){ vec3 p=ro+rd*t; float d=mapG(p,mat); if(d<.0004*t+.0005){ hit=true; break; } t+=d*.85; if(t>140.) break; }
  float closed=1.-smoothstep(.0,.06,uA.x);
  float a=openA();
  vec3 leakC=vec3(1.,.82,.58);
  vec3 col;
  if(!hit){ col=interior(ro,rd); t=1e9; }
  else {
    vec3 p=ro+rd*t; vec3 n=nrmG(p,.0009*t+.0008);
    vec3 alb; float metal=0., rough=.6; vec3 emit=vec3(0);
    if(mat==0){ // polished dark stone floor, large slabs
      vec2 g=p.xz/vec2(2.2,2.2); vec2 gi=floor(g), gf=fract(g);
      float jnt=smoothstep(.006,.0,min(min(gf.x,1.-gf.x),min(gf.y,1.-gf.y))*2.2);
      float h=hash12(gi);
      alb=vec3(.07,.064,.058)*(.75+.5*h)*(.8+.4*fbm2q(p.xz*1.3));
      alb*=1.-.6*jnt; rough=.08+.25*fbm2q(p.xz*.7+3.);
    } else if(mat==3){ // bronze
      vec2 rq; float lz; leaf(p,rq,lz); float sl; float rh=leafRelief(rq,sl);
      float worn=smoothstep(.75,1.15,rh);
      alb=mix(vec3(.30,.19,.09), vec3(.85,.60,.32), worn)*(.85+.3*fbm2q(rq*6.));
      alb=mix(alb, vec3(.06,.04,.025), smoothstep(.45,.15,rh)*.7);
      metal=.85; rough=mix(.5,.22,worn);
      float br=(uA.y)*(.88+.12*sin(uTime*1.1)+.05*sin(uTime*3.7));
      emit+=sl*vec3(2.6,1.45,.55)*br*(.75+.25*fbm2q(rq*3.+uTime*.2));
    } else { // limestone
      vec2 w=vec2(p.x+p.z*.7, p.y); float row=floor(w.y/.92); vec2 bc=vec2(w.x/1.85+row*.5, w.y/.92);
      vec2 bi=floor(bc), bf=fract(bc);
      float mort=smoothstep(.02,.0,min(min(bf.x,1.-bf.x)*1.85,min(bf.y,1.-bf.y)*.92)-.008);
      float h=hash12(bi);
      alb=vec3(.40,.36,.31)*(.8+.35*h)*(.75+.5*fbm(p*1.7));
      if(mat!=1) alb=vec3(.42,.38,.33)*(.8+.4*fbm(p*2.3));
      else alb*=1.-.55*mort;
      rough=.8;
    }
    float ao=occl(p,n);
    vec3 diff=vec3(0), spec=vec3(0);
    vec3 V=-rd;
    // slit lights (closed): seam, hinge gaps, top gap
    if(closed>0.001 && p.z<ZF+.3){
      for(int k=0;k<3;k++){
        vec3 c; float I;
        if(k==0){ c=vec3(0., clamp(p.y,0.,HS), ZF-.03); I=1.; }
        else if(k==1){ c=vec3(sign(p.x)*HW, clamp(p.y,0.,HS), ZF-.03); I=.45; }
        else { c=vec3(clamp(p.x,-HW,HW), HS, ZF-.03); I=.5; }
        vec3 dl=c-p; float dd=length(dl)+1e-3; vec3 Ld=dl/dd;
        float dirW=.3+.7*clamp(-(-Ld.z)*-1.,0.,1.);
        float E=I*uA.z*closed/(dd*.8+.12)*exp(-dd*.22);
        float nl=max(dot(n,Ld),0.);
        diff+=leakC*E*nl;
        spec+=leakC*E*pow(max(dot(n,normalize(Ld+V)),0.), mix(8.,90.,1.-rough))*nl*2.;
      }
    }
    // the seal glows and lights the bronze around it
    if(uA.y>.01 && p.z<ZF+.3){
      vec2 sc=vec2(0.,5.15); vec2 rel=p.xy-sc; float rr=length(rel);
      vec3 c=vec3(sc+rel/max(rr,1e-3)*clamp(rr,.5,1.78), ZF-.06);
      vec3 dl=c-p; float dd=length(dl)+1e-3; vec3 Ld=dl/dd;
      float E=uA.y*.55/(dd*1.5+.1)*exp(-dd*.4);
      float nl=max(dot(n,Ld),0.);
      diff+=vec3(1.,.7,.35)*E*nl;
      spec+=vec3(1.,.7,.35)*E*pow(max(dot(n,normalize(Ld+V)),0.), mix(8.,90.,1.-rough))*nl*2.;
    }
    { vec3 Lm=normalize(vec3(-.25,.85,-.45)); float nl=max(dot(n,Lm),0.);
      diff+=vec3(.035,.042,.06)*nl; spec+=vec3(.035,.042,.06)*pow(max(dot(n,normalize(Lm+V)),0.),30.)*nl; }
    // the open doorway: an area light behind the leaves
    if(uA.x>.001){
      vec3 c=vec3(clamp(p.x,-a,a), clamp(p.y,.2,HS), ZF+TH+.2);
      vec3 dl=c-p; float dd=length(dl)+1e-3; vec3 Ld=dl/dd;
      float vis=smoothstep(-.2,.3,c.z-p.z);
      float E=uA.w*.55*(a/HW+.15)/(1.+dd*dd*.02)*vis;
      float nl=max(dot(n,Ld),0.);
      diff+=leakC*E*nl;
      spec+=leakC*E*pow(max(dot(n,normalize(Ld+V)),0.), mix(8.,90.,1.-rough))*nl*1.5;
    }
    vec3 amb=vec3(.010,.012,.020)*(.6+.4*n.y)*ao + vec3(.02,.015,.01)*ao*(1.-closed*.5);
    vec3 F0=mix(vec3(.04), alb, metal);
    col=alb*(diff+amb)*(1.-metal*.8) + spec*mix(vec3(.04+.2*(1.-rough)), F0, metal)*ao + emit;
    if(mat==0){ // floor reflection of the slit lights and of the open doorway
      vec3 rr=reflect(rd,n); float fre=.04+.96*pow(1.-max(dot(n,-rd),0.),5.);
      float tz=(ZF-p.z)/max(rr.z,1e-4);
      if(rr.z>0.){ vec3 pz=p+rr*tz; float blur=rough*tz*.6;
        float lk=0.;
        if(pz.y>0.){ float sx=.010+blur*.12, hx=.008+blur*.12;
          lk=(exp(-abs(pz.x)/sx)*(5.*.010/sx)+exp(-abs(pz.x)/(.07+blur))*.5)*step(pz.y,HS)
            +(exp(-abs(abs(pz.x)-HW)/hx)*1.6*.008/hx)*step(pz.y,HS)*.7
            +(exp(-abs(pz.y-HS)/hx)*1.8*.008/hx)*step(abs(pz.x),HW)*.7; }
        col+=leakC*lk*uA.z*closed*fre*1.4;
        if(uA.x>.001){ float inside=smoothstep(a+.3+blur,a-.3,abs(pz.x))*smoothstep(HS+.4,HS-.4,pz.y)*step(0.,pz.y);
          col+=vec3(1.,.9,.74)*uA.w*inside*fre*.7*ao; }
      }
    }
    // the slit itself, where the ray meets the door plane
    float tz=(ZF-ro.z)/rd.z;
    if(tz>0. && t>tz-.12){ vec3 pz=ro+rd*tz; col+=leakC*leakAt(pz.xy)*uA.z*closed*2.2; }
  }
  // dusty air: light sheets from the slits, then the beam through the opening
  {
    float tmax=min(t, 60.); int N=uQ>.5? 48:26; float jit=hash12(gl_FragCoord.xy+fract(uTime*3.7)*97.);
    vec3 acc=vec3(0); float dt=tmax/float(N);
    for(int i=0;i<48;i++){ if(i>=N) break; float tt=(float(i)+jit)*dt; vec3 p=ro+rd*tt;
      if(p.z>ZF+TH+.3) break;
      float dn=.35+1.3*fbm3q(p*vec3(.35,.25,.35)+vec3(0.,-uTime*.05,uTime*.03));
      dn*=.6+.8*fbm2q(vec2(p.x*1.6,p.y*.35)+3.);
      float ls=closed>0.? sheet(p)*uA.z*closed : 0.;
      float lb=uA.x>.001? beam(p)*uA.w : 0.;
      acc+=(leakC*ls*.5 + vec3(1.,.88,.7)*lb*.06)*dn*dt*uB.x;
    }
    col+=acc;
  }
  fragColor=vec4(col,1.); }`;

  // dust motes, drawn in 2D and lit by the same light sheets as the shader
  const MOTES = (() => { const r = rng(4044); return Array.from({ length: 520 }, () => [lerp(-6, 6, r()), lerp(0.1, 11.5, r()), lerp(-15, -0.25, r()), r() * 6.283, 0.4 + 0.9 * r()]); })();
  const G4 = { HW: 3, HS: 10, TH: 0.5, ZF: 0.1 };
  function sheetJS(x, y, z, open, closedAmt) {
    const dz = Math.max(G4.ZF - z, 0), fall = 1 / (1 + dz * 0.22);
    let v = 0;
    if (closedAmt > 0) {
      const wS = 0.035 + dz * 0.075;
      v += Math.exp(-Math.pow(x / wS, 2)) * (0.05 / wS) * (y > 0 ? 1 : 0) * (1 - smooth(G4.HS - 0.6, G4.HS + dz * 0.6 + 0.2, y)) * fall * closedAmt;
      const wH = 0.025 + dz * 0.04;
      v += Math.exp(-Math.pow((Math.abs(x) - G4.HW - dz * 0.02) / wH, 2)) * (0.012 / wH) * fall * closedAmt * (y > 0 && y < G4.HS ? 1 : 0);
    }
    return v;
  }
  function beamJS(x, y, z, open) {
    if (open <= 0) return 0;
    const dz = Math.max(G4.ZF + G4.TH - z, 0), a = G4.HW * (1 - Math.cos(open));
    const wx = a + dz * 0.035, wy = G4.HS + dz * 0.03;
    return (1 - smooth(wx - 0.25, wx + 0.25 + dz * 0.03, Math.abs(x))) * (1 - smooth(wy - 0.4, wy + 0.4, y)) * (a / G4.HW * 0.8 + 0.2) / (1 + dz * 0.08);
  }
  function drawMotes(cam, T, leak, interiorI, open, alpha = 1) {
    const closedAmt = 1 - smooth(0, 0.06, open);
    pic(() => {
      o.save(); o.globalCompositeOperation = "lighter";
      for (const m of MOTES) {
        const px = m[0] + 0.35 * Math.sin(T * 0.11 + m[3]) + 0.12 * Math.sin(T * 0.37 + m[3] * 3.1);
        const py = m[1] + 0.35 * Math.sin(T * 0.05 + m[3] * 1.7) + 0.1 * Math.sin(T * 0.21 + m[3] * 4.1);
        const pz = m[2] + 0.3 * Math.cos(T * 0.09 + m[3] * 2.3);
        const q = project(cam, [px, py, pz]); if (!q || q[2] < 0.4) continue;
        const b = (sheetJS(px, py, pz, open, closedAmt) * leak * 0.9 + beamJS(px, py, pz, open) * interiorI * 0.12) * alpha;
        if (b < 0.015) continue;
        const rad = clamp(3.2 / q[2] * m[4] * 6, 0.7, 9), bok = q[2] < 4 ? (4 - q[2]) * 2.5 : 0;
        const R = rad + bok, A = clamp(b * 0.5, 0, 0.9) * (bok > 0 ? 0.35 : 1);
        const g = o.createRadialGradient(q[0], q[1], 0, q[0], q[1], R);
        g.addColorStop(0, `rgba(255,236,200,${A})`); g.addColorStop(bok > 0 ? 0.7 : 0.35, `rgba(255,210,150,${A * 0.35})`); g.addColorStop(1, "rgba(255,190,120,0)");
        o.fillStyle = g; o.beginPath(); o.arc(q[0], q[1], R, 0, 6.283); o.fill();
      }
      o.restore();
    });
  }
  function gateFrame(T, cam, P, post) {
    GL.frame({ name: PRE + "gate", fs: GATE, scale: SC(0.5, 1.5),
      uniforms: { uTime: T, ...camUniforms(cam), uA: [P.open, P.seal, P.leak, P.inner], uB: [P.dust, P.spiral ?? 0, P.spin ?? 0, 0], uQ: Qf() } },
    { bloom: post.bloom ?? 0.6, thresh: post.thresh ?? 1.1, exposure: post.exposure ?? 1, rays: post.rays ?? [0.5, 0.55, 0.25], letterbox: LB, vignette: post.vignette ?? 0.6, t: T, fade: post.fade ?? 1, lift: post.lift ?? 0 });
    blit();
  }
  function drawGateSealed(k, T, extra = {}) { // k = chapter time, 22–40
    const u = clamp((k - 21.6) / 18.4);
    const e = easeIO(u);
    const cam = camLook([lerp(0.8, 0.3, e), lerp(1.2, 2.1, e), lerp(-17.5, -9.6, e)], [lerp(0.3, 0.05, e), lerp(6.5, 5.3, e), 0], lerp(1.02, 1.2, e));
    const breathe = 0.9 + 0.1 * Math.sin(T * 0.9) + 0.04 * Math.sin(T * 2.3);
    const leak = (0.8 + 0.25 * smooth(28, 38, k)) * breathe;
    const P = { open: 0, seal: 0.9 + 0.3 * smooth(30, 39, k), leak, inner: 0, dust: 1.0 };
    const fade = (extra.fadeIn ?? 1) * (1 - smooth(39.0, 39.95, k));
    const sq = project(cam, [0, 5, 0]);
    gateFrame(T, cam, P, { bloom: 0.62, thresh: 1.0, exposure: 1.0, rays: [sq[0] / W, 1 - sq[1] / H, 0.22], fade, lift: extra.lift ?? 0 });
    drawMotes(cam, T, leak, 0, 0, fade);
  }

  // =====================================================================================
  // 3. ERDŐS (40–50): aged paper, a 1946 note, the inequality struck by a line of fire, the unit-distance graph burns into light.
  // uA: strike front 0..1, seconds since strike began, graph flare, burn 0..1   uB: candle, focus distance, aperture, -
  // uC: strike line (u0,v0,u1,v1)   uD: paper half size x,z, under-light, -
  // =====================================================================================
  const PAPER = COMMON + H4 + `
uniform sampler2D uInk;
float pH(vec2 p){ return fbm2q(p*2.2)*.5 + vn2(p*55.)*.05 + vn2(vec2(p.x*260.,p.y*30.))*.012; }
vec2 segD(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return vec2(length(pa-ba*h), h); }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 col=vec3(.003,.0025,.002);
  if(rd.y<0.){
    float t=-ro.y/rd.y; vec3 p=ro+rd*t;
    vec2 uv=vec2((uD.x-p.x)/(2.*uD.x), (p.z+uD.y)/(2.*uD.y));
    float coc=abs(t-uB.y)*uB.z;
    float lod=clamp(log2(1.+coc*70.),0.,5.);
    float sharp=1.-smoothstep(.0,.05,coc);
    // paper surface
    vec2 pp=p.xz; float e=.0025;
    float h0=pH(pp), hx=pH(pp+vec2(e,0.)), hz=pH(pp+vec2(0.,e));
    float amp=mix(.15,1.,sharp);
    vec3 n=normalize(vec3(-(hx-h0)/e*.010*amp, 1., -(hz-h0)/e*.010*amp));
    float mott=fbm2(pp*1.6+4.), mott2=fbm2q(pp*7.);
    vec3 alb=mix(vec3(.72,.63,.48), vec3(.84,.77,.62), mott)*(.92+.12*mott2);
    float fox=smoothstep(.72,.8,fbm2q(pp*9.+11.))*.35+smoothstep(.8,.86,fbm2q(pp*3.+2.))*.25;
    alb=mix(alb, vec3(.45,.30,.16), fox);
    vec2 eu=min(uv,1.-uv); float edge=min(eu.x*1.4,eu.y);
    alb*=mix(.55,1.,smoothstep(.0,.12,edge));
    // squared paper, faded
    vec2 gq=uv*vec2(56.,40.); vec2 gd=abs(fract(gq)-.5);
    float grid=smoothstep(.06+lod*.04,.0,.5-max(gd.x,gd.y))*(.25/(1.+lod));
    alb=mix(alb, vec3(.50,.42,.34), grid*.45);
    // ink
    vec3 ink=textureLod(uInk, uv, lod).rgb;
    float im=clamp(ink.r+ink.g+ink.b,0.,1.);
    vec3 inkC=vec3(.065,.04,.025)*(.8+.4*vn2(pp*90.));
    alb=mix(alb, inkC, im*.93);
    // burn field around the graph
    float fG=textureLod(uInk, uv, 5.).g*1.6+textureLod(uInk, uv, 6.5).g*3.;
    float bn=fbm2q(uv*vec2(30.,22.)+uTime*.15)-.5;
    float bf=fG*1.8 + bn*.7 - (1.-uA.w)*2.6 - .25;
    float hole=step(0.,bf)*step(.001,uA.w);
    float rim=uA.w>0.? exp(-pow(bf/.09,2.))*(1.-hole) : 0.;
    float charR=uA.w>0.? smoothstep(-.7,-.08,bf)*(1.-hole) : 0.;
    alb*=1.-charR*.9;
    // strike line: fire runs left to right, then cools to a gold scar
    vec2 a=uC.xy, b=uC.zw; vec2 sd=segD(uv,a,b);
    float wob=(vn2(vec2(sd.y*40.,1.))-.5)*.006;
    float dl=abs(dot(uv-a, normalize(vec2(-(b-a).y,(b-a).x)))+wob);
    float along=sd.y; float passed=step(along,uA.x)*step(0.,uA.y);
    float charL=exp(-pow(dl/.010,2.))*passed;
    alb*=1.-charL*.8;
    // light: candle from the left, flickering; dim cool fill
    vec3 Lp=vec3(1.5,.55,-.35); vec3 dL=Lp-p; float dd=length(dL); vec3 L=dL/dd;
    float fl=uB.x*(.85+.1*sin(uTime*13.)+.08*sin(uTime*7.3+1.)+.06*vn2(vec2(uTime*9.,0.)));
    vec3 candle=vec3(1.,.74,.48)*fl*1.5/(dd*dd*.5+.4);
    float dif=max(dot(n,L),0.);
    col=alb*(candle*dif + vec3(.012,.013,.018));
    col+=candle*pow(max(dot(n,normalize(L-rd)),0.),30.)*im*.25;   // a little sheen on wet-looking ink
    // emission: graph flare, strike fire, burn rim, light through the hole
    float gI=ink.g*uA.z; col+=vec3(5.,3.,1.3)*gI;
    float age=max(uA.y-along*.45,0.);
    vec3 fire=mix(vec3(14.,6.,1.6), vec3(4.,1.2,.25), smoothstep(0.,.5,age)); fire=mix(fire, vec3(2.2,1.3,.5), smoothstep(.5,2.5,age));
    float flick=.75+.5*vn2(vec2(along*60.,uTime*14.));
    col+=fire*exp(-pow(dl/.0035,2.))*passed*flick*1.1 + fire*exp(-dl/.012)*passed*.25;
    float head=exp(-pow((along-uA.x)/.012,2.))*exp(-pow(dl/.01,2.))*step(0.,uA.y)*step(uA.x,.999);
    col+=vec3(20.,10.,3.)*head;
    col+=vec3(6.,2.2,.4)*rim*(.7+.6*vn2(uv*80.+uTime*3.));
    col=mix(col, vec3(7.,5.,3.)*uD.z*(.9+.1*sin(uTime*7.)), hole);
    col+=vec3(1.,.6,.3)*charR*uD.z*.05*(1.-hole);
  }
  fragColor=vec4(col,1.); }`;

  const PAP = { X0: 1.4, Z0: 1.0, CW: 2048, CH: 1463 };
  const papUV = (cx, cy) => [cx / PAP.CW, 1 - cy / PAP.CH];
  const papW = (cx, cy) => { const [u, v] = papUV(cx, cy); return [PAP.X0 - u * 2 * PAP.X0, 0, -PAP.Z0 + v * 2 * PAP.Z0]; };
  const STRIKE = [0, 0, 0, 0];
  const GRAPH = { cx: 1610, cy: 700, s: 92 };
  let inkCanvas = null;
  function inkTex() {
    if (!inkCanvas) {
      const c = document.createElement("canvas"); c.width = PAP.CW; c.height = PAP.CH;
      const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = "lighter"; x.textBaseline = "alphabetic";
      const R = rng(1946);
      const pen = (s, px, py, size, font, col, rot = 0) => { x.save(); x.translate(px, py); x.rotate(rot); x.font = `${size}px "${font}"`; x.fillStyle = col; x.fillText(s, 0, 0); x.restore(); };
      // the inequality, written by hand (each glyph a little off the line)
      const red = "rgb(255,0,0)";
      let cx = 170; const base = 690;
      const glyphs = [["u", 170], ["(", 170], ["n", 170], [")", 170], [" ", 170], ["≤", 150, "SerifL"], [" ", 170], ["n", 170]];
      for (const [g, sz, f] of glyphs) { x.font = `${sz}px "${f || "CormI"}"`; const w = x.measureText(g).width; pen(g, cx, base + (R() - 0.5) * 6 + (f ? -6 : 0), sz, f || "CormI", red, (R() - 0.5) * 0.05); cx += w + 4; }
      let ex = cx + 6; const eb = base - 96;
      for (const g of ["1", " ", "+", " ", "c", "/", "log", " ", "log", " ", "n"]) { x.font = '84px "CormI"'; const w = x.measureText(g).width; pen(g, ex, eb + (R() - 0.5) * 5, 84, "CormI", red, (R() - 0.5) * 0.06); ex += w + 2; }
      STRIKE[0] = 140; STRIKE[1] = base - 52; STRIKE[2] = ex + 30; STRIKE[3] = base - 92;
      // definition, smaller, beneath
      pen("u(n) : the most unit distances among n points", 190, 880, 54, "CormI", "rgb(0,0,255)", -0.006);
      pen("1946.", 1640, 250, 70, "CormI", "rgb(0,0,255)", -0.02);
      // unit-distance graph: a patch of the triangular lattice (all edges the same length)
      const pts = [];
      for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) { const s = -q - r; if (Math.abs(s) > 2) continue; pts.push([GRAPH.cx + GRAPH.s * (q + r / 2) + (R() - 0.5) * 4, GRAPH.cy - GRAPH.s * r * Math.sqrt(3) / 2 + (R() - 0.5) * 4]); }
      x.strokeStyle = "rgb(0,255,0)"; x.lineCap = "round";
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (Math.abs(d - GRAPH.s) > 12) continue;
        x.lineWidth = 3.2 + R() * 1.6; x.beginPath(); x.moveTo(pts[i][0], pts[i][1]);
        const mx = (pts[i][0] + pts[j][0]) / 2 + (R() - 0.5) * 3, my = (pts[i][1] + pts[j][1]) / 2 + (R() - 0.5) * 3;
        x.quadraticCurveTo(mx, my, pts[j][0], pts[j][1]); x.stroke();
      }
      x.fillStyle = "rgb(0,255,0)";
      for (const [px, py] of pts) { x.beginPath(); x.arc(px, py, 9 + R() * 2, 0, 6.283); x.fill(); }
      inkCanvas = c;
    }
    return GL.canvasTex(PRE + "ink", inkCanvas, { mip: true });
  }
  const EMBERS = (() => { const r = rng(4646); return Array.from({ length: 160 }, () => [r(), r(), r(), r(), r()]); })();
  function drawPaper(k, T, extra = {}) { // k = chapter time, 40–50
    const tex = inkTex();
    const u = clamp((k - 39.6) / 10.8), e = easeIO(u);
    const focusW = papW(1000, 690);
    const pos = [focusW[0] + lerp(0.38, 0.05, e), lerp(1.0, 0.82, e), focusW[2] + lerp(-1.02, -0.86, e)];
    const tgt = [focusW[0] + lerp(0.12, -0.04, e), 0, focusW[2] + lerp(0.06, 0.02, e)];
    const cam = camLook(pos, tgt, 1.45);
    const dist = Math.hypot(...sub(tgt, pos));
    const sp = k - 46.0, strikeDur = 0.55;
    const front = clamp(sp / strikeDur);
    const flare = smooth(46.25, 46.9, k) * (1 + 1.5 * Math.exp(-Math.max(0, k - 46.6) * 2.5));
    const burn = smooth(46.8, 50.2, k) * 0.95;
    const under = smooth(46.8, 48.5, k) * 1.0 + 0.6 * smooth(48.5, 50.2, k);
    const [u0, v0] = papUV(STRIKE[0], STRIKE[1]), [u1, v1] = papUV(STRIKE[2], STRIKE[3]);
    const candle = 1.0 + 0.25 * smooth(46, 47, k);
    const fadeIn = extra.fadeIn ?? smooth(39.95, 41.0, k);
    const gq = project(cam, papW(GRAPH.cx, GRAPH.cy));
    GL.frame({ name: PRE + "paper", fs: PAPER, scale: SC(0.55, 1.5), textures: { uInk: tex },
      uniforms: { uTime: T, ...camUniforms(cam), uA: [front, sp, flare, burn], uB: [candle, dist, 0.55, 0], uC: [u0, v0, u1, v1], uD: [PAP.X0, PAP.Z0, under, 0], uQ: Qf() } },
    { bloom: 0.55 + 0.25 * smooth(46, 48, k), thresh: 1.1, exposure: 1.0 + 0.35 * smooth(47.5, 50, k), rays: gq ? [gq[0] / W, 1 - gq[1] / H, 0.35 * smooth(46.5, 48, k)] : [0.5, 0.5, 0], letterbox: LB, vignette: 0.65, t: T, fade: fadeIn * (extra.fade ?? 1) });
    blit();
    // embers rising from the burning graph
    if (k > 46.3 && gq) pic(() => {
      o.save(); o.globalCompositeOperation = "lighter";
      for (const m of EMBERS) {
        const born = 46.3 + m[0] * 3.6, age = k - born; if (age < 0 || age > 2.6) continue;
        const ang = m[1] * 6.283, rad0 = (0.15 + 0.85 * m[2]) * 200 * (0.6 + burn);
        const x0 = gq[0] + Math.cos(ang) * rad0, y0 = gq[1] + Math.sin(ang) * rad0 * 0.6;
        const x = x0 + Math.sin(age * 2 + m[3] * 9) * 18 + age * 12 * (m[4] - 0.5), y = y0 - age * (90 + 140 * m[4]) - age * age * 20;
        const a = Math.min(1, age * 4) * (1 - age / 2.6) * fadeIn;
        const r = 1.2 + 2.2 * m[3];
        const g = o.createRadialGradient(x, y, 0, x, y, r * 4);
        g.addColorStop(0, `rgba(255,232,180,${a})`); g.addColorStop(0.3, `rgba(255,150,60,${a * 0.5})`); g.addColorStop(1, "rgba(255,110,30,0)");
        o.fillStyle = g; o.beginPath(); o.arc(x, y, r * 4, 0, 6.283); o.fill();
      }
      o.restore();
    });
  }

  // =====================================================================================
  // 4. ASTRA (50–60): a night sky; ten stars ignite on the beat, then flare and link into a spiral constellation.
  // uS[10]: star dir xyz, seconds since ignition   uA: link progress 0..1, seconds since the flare, sky level, -
  // =====================================================================================
  const ASTRA = COMMON + H4 + `
uniform vec4 uS[10];
vec3 skyN(vec3 rd){
  vec3 c=mix(vec3(.004,.005,.011), vec3(.010,.012,.024), smoothstep(-.6,.6,rd.y));
  vec3 bn=normalize(vec3(.42,.78,-.46)); float db=dot(rd,bn); float band=exp(-db*db*9.);
  float n1=fbm(rd*3.1+2.), n2=fbm(rd*7.3+5.);
  float lane=smoothstep(.48,.66,fbm(rd*5.2+9.))*exp(-db*db*40.);
  vec3 mw=mix(vec3(.05,.045,.06), vec3(.16,.11,.06), exp(-db*db*30.))*(.35+.9*n1*n2*1.6);
  c+=mw*band*(1.-.85*lane)*uA.z;
  c+=nebula(rd, vec3(.012,.01,.02), vec3(.07,.045,.02))*.6*uA.z;
  c+=stars(rd,.9*uA.z) + stars(rd*1.7+3.,.6*band*uA.z);
  return c; }
void main(){
  vec3 rd=camRay(gl_FragCoord.xy);
  vec3 col=skyN(rd);
  vec3 f=normalize(uCamFwd), r=normalize(cross(f,uCamUp)), up=cross(r,f);
  float flare=uA.y>0.? 1.+2.6*exp(-uA.y*2.)+.35 : 1.;
  for(int i=0;i<10;i++){
    vec3 s=uS[i].xyz; float a=uS[i].w; if(a<0.) continue;
    vec3 dv=rd-s; float d=length(dv);
    float on=smoothstep(0.,.08,a);
    float flash=exp(-a*4.5)*6.;
    float I=(on+flash)*flare;
    float tint=hash12(vec2(float(i),7.));
    vec3 sc=mix(vec3(1.,.86,.62), vec3(1.,.95,.86), tint);
    col+=sc*I*(exp(-pow(d/.0011,2.))*40. + exp(-d/.0045)*.9 + exp(-d/.03)*.10);
    vec2 q=vec2(dot(dv,r), dot(dv,up));
    float sp=exp(-abs(q.y)/.00045)*exp(-abs(q.x)/(.025+.03*flash)) + exp(-abs(q.x)/.00045)*exp(-abs(q.y)/(.018+.02*flash));
    col+=sc*sp*I*.9;
    float ringR=.004+a*.09; col+=vec3(1.,.8,.5)*exp(-pow((d-ringR)/.0025,2.))*exp(-a*3.)*1.2;
  }
  // links along the spiral, revealed in order
  for(int i=0;i<9;i++){
    float pr=clamp(uA.x*9.-float(i),0.,1.); if(pr<=0.) continue;
    vec3 A=uS[i].xyz, B=uS[i+1].xyz; vec3 nn=normalize(cross(A,B));
    float dp=abs(dot(rd,nn));
    float ang=acos(clamp(dot(A,B),-1.,1.));
    float s=atan(dot(cross(A,rd),nn), dot(A,rd))/ang;
    float inside=smoothstep(.0,.06,s)*smoothstep(pr,pr-.06,s)*smoothstep(1.,.94,s);
    col+=vec3(1.5,1.,.5)*inside*(exp(-pow(dp/.0007,2.))*1.6+exp(-dp/.004)*.12)*(.6+.4*exp(-uA.y*.8));
  }
  fragColor=vec4(col,1.); }`;

  // spiral constellation (link order) laid out on screen, and the order in which the stars ignite
  const STARS_UV = (() => { const r = rng(1010), pts = []; for (let i = 0; i < 10; i++) { const th = 0.5 + i * 0.8, rad = 0.43 * Math.exp(-0.2 * i); pts.push([1.7 * rad * Math.cos(th) + (r() - 0.5) * 0.03, 0.78 * rad * Math.sin(th) + (r() - 0.5) * 0.03]); } return pts; })();
  const IGN_ORDER = [4, 9, 1, 6, 0, 7, 3, 8, 2, 5]; // slot i ignites spiral star IGN_ORDER[i]
  const starIgnT = (() => { const t = new Array(10); IGN_ORDER.forEach((s, i) => { t[s] = 51.5 + 0.55 * i; }); return t; })();
  const ASTRA_CAM0 = camLook([0, 0, 0], [0, 0.32, 1], 1.25);
  const STAR_DIRS = (() => { const c = ASTRA_CAM0, f = c.fwd, r = norm(cross(f, c.up)), u = cross(r, f); return STARS_UV.map(([x, y]) => norm([f[0] * c.fov + x * r[0] + y * u[0], f[1] * c.fov + x * r[1] + y * u[1], f[2] * c.fov + x * r[2] + y * u[2]])); })();
  function drawAstra(k, T, extra = {}) {
    const u = clamp((k - 49.4) / 11.2), e = easeIO(u);
    const yaw = lerp(0.035, -0.03, e), pitch = lerp(-0.035, 0.03, e);
    const f0 = ASTRA_CAM0.fwd; const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let f = [f0[0] * cy + f0[2] * sy, f0[1] + pitch, -f0[0] * sy + f0[2] * cy];
    const roll = lerp(-0.02, 0.02, e);
    const cam = { pos: [0, 0, 0], fwd: norm(f), up: [Math.sin(roll), Math.cos(roll), 0], fov: lerp(1.22, 1.3, e) };
    const S = []; for (let i = 0; i < 10; i++) S.push(...STAR_DIRS[i], k - starIgnT[i]);
    const link = smooth(57.5, 59.0, k), fl = k - 57.5;
    const lev = smooth(49.3, 51.0, k);
    GL.frame({ name: PRE + "astra", fs: ASTRA, scale: SC(0.55, 1.5),
      uniforms: { uTime: T, ...camUniforms(cam), uS: { vec4: S }, uA: [link, fl, lev, 0], uQ: Qf() } },
    { bloom: 0.7, thresh: 1.0, exposure: 1.0 + 0.2 * Math.exp(-Math.max(0, fl) * 1.5) * (fl > 0 ? 1 : 0), rays: [0.5, 0.5, 0], letterbox: LB, vignette: 0.6, t: T, fade: extra.fade ?? 1 });
    blit();
  }

  // =====================================================================================
  // 5. 수능 (60–69): the CSAT answer sheet as a premium object; raking light; 450 cast in molten gold.
  // uA: seconds since 450, -, -, -   uB: focus distance, aperture, light, -   uC: 450 centre xz, half size xz   uD: sheet half size
  // =====================================================================================
  const OMR = COMMON + H4 + `
uniform sampler2D uSheet; uniform sampler2D uNum;
float num(vec2 nuv, float lod){ if(any(lessThan(nuv,vec2(0.)))||any(greaterThan(nuv,vec2(1.)))) return 0.; return textureLod(uNum,nuv,lod).r; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 col=vec3(.002);
  vec3 L=normalize(vec3(.92,.30,.22)); vec3 lightC=vec3(1.,.86,.68)*2.6*uB.z;
  if(rd.y<0.){
    float t=-ro.y/rd.y; vec3 p=ro+rd*t;
    float coc=abs(t-uB.x)*uB.y; float lod=clamp(log2(1.+coc*70.),0.,5.); float sharp=1.-smoothstep(0.,.05,coc);
    vec2 uv=vec2((uD.x-p.x)/(2.*uD.x), (p.z+uD.y)/(2.*uD.y));
    bool on=all(greaterThan(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.)));
    vec3 n=vec3(0,1,0); vec3 alb; float gloss=0.;
    if(on){
      vec2 pp=p.xz; float e=.002;
      float h0=vn2(pp*70.)*.6+vn2(pp*300.)*.4, hx=vn2((pp+vec2(e,0.))*70.)*.6+vn2((pp+vec2(e,0.))*300.)*.4, hz=vn2((pp+vec2(0.,e))*70.)*.6+vn2((pp+vec2(0.,e))*300.)*.4;
      n=normalize(vec3(-(hx-h0)/e*.0012*sharp, 1., -(hz-h0)/e*.0012*sharp));
      float curl=fbm2q(pp*1.2); n=normalize(n+vec3((fbm2q(pp*1.2+vec2(.03,0.))-curl)*1.4, 0., (fbm2q(pp*1.2+vec2(0.,.03))-curl)*1.4));
      vec3 tx=pow(textureLod(uSheet,uv,lod).rgb, vec3(2.2));
      alb=tx*vec3(.97,.955,.93);
      float lum=dot(tx,vec3(.3,.59,.11)); gloss=smoothstep(.15,.03,lum);
      vec2 eu=min(uv,1.-uv); alb*=mix(.8,1.,smoothstep(0.,.01,min(eu.x,eu.y)));
    } else { // dark walnut desk
      vec2 pp=p.xz; float g=fbm2(vec2(pp.x*1.5, pp.y*14.)+fbm2(pp*2.)*2.);
      alb=mix(vec3(.018,.010,.006), vec3(.05,.028,.015), g); gloss=.5;
    }
    // the 450: raised gold relief, poured molten then cooling
    vec2 nuv=(vec2(p.x,p.z)-uC.xy)/(uC.zw*2.)*vec2(-1.,1.)+.5;
    float sinceN=uA.x;
    float m=0., hgt=0.; vec3 emit=vec3(0); float metal=0.;
    if(sinceN>0.){
      float dc=length((nuv-.5)*vec2(2.,1.));
      float rv=sinceN/.75; float wob=(fbm2q(nuv*vec2(14.,7.)+3.)-.5)*.18;
      float filled=smoothstep(rv, rv-.08, dc+wob);
      m=num(nuv,0.)*filled; float mb=num(nuv,2.5)*filled;
      if(m>.002 || mb>.002){
        float e2=1.5/512.;
        float gx=num(nuv+vec2(e2,0.),2.)-num(nuv-vec2(e2,0.),2.), gy=num(nuv+vec2(0.,e2),2.)-num(nuv-vec2(0.,e2),2.);
        vec3 gn=normalize(vec3(gx*3.2, 1., -gy*3.2*(uC.w/uC.z)));
        float since=max(sinceN-dc*.75,0.);
        float molten=1.-smoothstep(.2,2.4,since);
        float rip=(fbm2q(nuv*vec2(30.,15.)+vec2(0.,uTime*1.2))-.5)*molten;
        gn=normalize(gn+vec3(rip*.6,0.,rip*.6));
        n=normalize(mix(n, gn, m)); metal=m;
        alb=mix(alb, vec3(1.,.74,.36), m);
        vec3 hot=mix(vec3(12.,7.,3.), vec3(4.5,1.6,.35), smoothstep(0.,.6,since));
        hot=mix(hot, vec3(.0), smoothstep(.6,2.6,since));
        emit=hot*m;
        emit+=vec3(14.,9.,4.)*exp(-pow((dc+wob-rv)/.03,2.))*num(nuv,1.)*step(rv,1.6);
      }
      // the relief casts a soft shadow away from the light
      float shd=num(nuv+vec2(-.012,.006),3.)*filled*(1.-m);
      alb*=1.-shd*.55;
    }
    float dif=max(dot(n,L),0.);
    vec3 amb=vec3(.035,.04,.055)*uB.z;
    col=alb*(lightC*dif + amb)*(1.-metal*.85);
    vec3 h=normalize(L-rd);
    col+=lightC*pow(max(dot(n,h),0.), mix(40.,260.,metal))*mix(gloss*.08, 2.6, metal)*mix(vec3(1.),vec3(1.,.76,.4),metal);
    vec3 rr=reflect(rd,n); float env=smoothstep(-.1,.6,rr.y)*.5+pow(max(dot(rr,normalize(vec3(.6,.5,.6))),0.),12.)*2.;
    col+=vec3(1.,.8,.5)*env*metal*.9*(.5+.5*pow(1.-max(dot(n,-rd),0.),2.));
    col+=emit;
    col*=1.-smoothstep(1.2,3.2,t)*.6;
  }
  fragColor=vec4(col,1.); }`;

  const OM = { X0: 1.6, Z0: 1.0, CW: 2048, CH: 1280 };
  const omrW = (cx, cy) => { const u = cx / OM.CW, v = 1 - cy / OM.CH; return [OM.X0 - u * 2 * OM.X0, 0, -OM.Z0 + v * 2 * OM.Z0]; };
  let sheetCanvas = null, numCanvas = null;
  function sheetTex() {
    if (!sheetCanvas) {
      const c = document.createElement("canvas"); c.width = OM.CW; c.height = OM.CH;
      const x = c.getContext("2d"); const R = rng(450);
      const RED = "#d9466a", PINK = "rgba(217,70,106,0.13)";
      x.fillStyle = "#fbf8f1"; x.fillRect(0, 0, c.width, c.height);
      x.strokeStyle = RED; x.fillStyle = RED;
      x.lineWidth = 6; x.strokeRect(36, 36, c.width - 72, c.height - 72); x.lineWidth = 2; x.strokeRect(50, 50, c.width - 100, c.height - 100);
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = '58px "SerifB"'; x.letterSpacing = "14px"; x.fillText("대학수학능력시험 답안지", 470, 128);
      x.lineWidth = 2; x.beginPath(); x.moveTo(60, 190); x.lineTo(880, 190); x.stroke();
      // name and exam number
      x.font = '34px "SerifM"'; x.letterSpacing = "8px";
      x.strokeRect(90, 230, 760, 90); x.fillText("성  명", 190, 275); x.beginPath(); x.moveTo(290, 230); x.lineTo(290, 320); x.stroke();
      x.fillText("수 험 번 호", 470, 365);
      const gx0 = 130, gy0 = 410, cw = 86, rh = 74;
      for (let col = 0; col < 8; col++) {
        x.strokeRect(gx0 + col * cw, gy0, cw, 70); const pick = Math.floor(R() * 10);
        x.fillStyle = "#151515"; x.font = '40px "SerifM"'; x.letterSpacing = "0px"; x.fillText(String(pick), gx0 + col * cw + cw / 2, gy0 + 37); x.fillStyle = RED;
        for (let d = 0; d < 10; d++) {
          const cx = gx0 + col * cw + cw / 2, cy = gy0 + 112 + d * rh;
          if (d % 2 === 0) { x.fillStyle = PINK; x.fillRect(gx0 + col * cw + 2, cy - rh / 2, cw - 4, rh); x.fillStyle = RED; }
          if (d === pick) { x.fillStyle = "#111"; x.beginPath(); x.ellipse(cx, cy, 20 + R(), 31 + R(), 0, 0, 6.283); x.fill(); x.fillStyle = RED; }
          else { x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy, 19, 30, 0, 0, 6.283); x.stroke(); x.font = '26px "SerifM"'; x.fillText(String(d), cx, cy + 1); }
        }
      }
      x.lineWidth = 2; x.strokeRect(gx0, gy0 + 72, cw * 8, rh * 10 + 4);
      // answer columns
      const ax0 = 960, ay0 = 150, colW = 340, rowH = 68;
      for (let colI = 0; colI < 3; colI++) {
        const X = ax0 + colI * colW;
        x.font = '30px "SerifM"'; x.letterSpacing = "6px"; x.fillStyle = RED;
        x.fillText("문번", X + 46, ay0); x.fillText("답      란", X + 200, ay0);
        x.lineWidth = 3; x.strokeRect(X, ay0 - 34, colW - 20, rowH * 15 + 74);
        for (let r = 0; r < 15; r++) {
          const cy = ay0 + 64 + r * rowH, qn = colI * 15 + r + 1;
          if (Math.floor(r / 5) % 2 === 0) { x.fillStyle = PINK; x.fillRect(X + 2, cy - rowH / 2, colW - 24, rowH); }
          x.fillStyle = RED; x.font = '32px "SerifM"'; x.letterSpacing = "0px"; x.fillText(String(qn), X + 46, cy + 1);
          const ans = Math.floor(R() * 5);
          for (let b = 0; b < 5; b++) {
            const bx = X + 112 + b * 46;
            if (b === ans) { x.fillStyle = "#101010"; x.beginPath(); x.ellipse(bx + (R() - 0.5) * 2, cy, 15 + R(), 25 + R(), (R() - 0.5) * 0.1, 0, 6.283); x.fill(); x.fillStyle = RED; }
            else { x.lineWidth = 2; x.strokeStyle = RED; x.beginPath(); x.ellipse(bx, cy, 15, 25, 0, 0, 6.283); x.stroke(); x.font = '22px "SerifM"'; x.fillText(String(b + 1), bx, cy + 1); }
          }
          x.lineWidth = 1; x.beginPath(); x.moveTo(X + 86, cy - rowH / 2); x.lineTo(X + 86, cy + rowH / 2); x.stroke();
        }
      }
      // timing marks along the edges
      x.fillStyle = "#111"; for (let r = 0; r < 15; r++) x.fillRect(c.width - 90, ay0 + 52 + r * rowH, 34, 18);
      for (let i = 0; i < 26; i++) x.fillRect(90 + i * 72, c.height - 88, 20, 30);
      sheetCanvas = c;
    }
    return GL.canvasTex(PRE + "sheet", sheetCanvas, { mip: true });
  }
  function numTex() {
    if (!numCanvas) {
      const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
      const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 1024, 512);
      x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.font = '400px "SerifB"'; x.letterSpacing = "26px";
      x.fillText("450", 512 + 13, 270);
      numCanvas = c;
    }
    return GL.canvasTex(PRE + "num", numCanvas, { mip: true });
  }
  const N450 = { c: omrW(1300, 560), hx: 0.5, hz: 0.25 };
  function drawOMR(k, T, extra = {}) {
    const C = N450.c;
    const g = smooth(59.6, 63.4, k), h = smooth(62.6, 69.4, k);
    const posA = [C[0] - 0.9, 0.22, C[2] - 0.55], tgtA = [C[0] - 0.2, 0, C[2] + 0.35];
    const posB = [C[0] + 0.05, 1.06, C[2] - 0.92], tgtB = [C[0], 0, C[2] + 0.02];
    const glide = [lerp(-0.25, 0.35, ease(g)), 0, lerp(-0.1, 0.1, g)];
    let pos = lerp3(posA.map((v, i) => v + glide[i]), posB, ease(clamp((k - 61.8) / 2.0)));
    let tgt = lerp3(tgtA.map((v, i) => v + glide[i]), tgtB, ease(clamp((k - 61.6) / 2.0)));
    pos = lerp3(pos, [C[0] + 0.06, 0.92, C[2] - 0.8], h * 0.6);
    const cam = camLook(pos, tgt, 1.4);
    const dist = Math.hypot(...sub(tgt, pos));
    const s450 = k - 63.0;
    GL.frame({ name: PRE + "omr", fs: OMR, scale: SC(0.55, 1.5), textures: { uSheet: sheetTex(), uNum: numTex() },
      uniforms: { uTime: T, ...camUniforms(cam), uA: [s450, 0, 0, 0], uB: [dist, 0.65, 1.0, 0], uC: [C[0], C[2], N450.hx, N450.hz], uD: [OM.X0, OM.Z0, 0, 0], uQ: Qf() } },
    { bloom: 0.55 + 0.25 * Math.exp(-Math.max(0, s450) * 0.8) * (s450 > 0 ? 1 : 0), thresh: 1.1, exposure: 1.0, rays: [0.5, 0.5, s450 > 0 ? 0.25 * Math.exp(-s450 * 0.7) : 0], letterbox: LB, vignette: 0.6, t: T, fade: extra.fade ?? 1 });
    blit();
  }

  // =====================================================================================
  // 6. NAVIER–STOKES (69–83): liquid gold and smoke in a vortex that tightens to a point, then bursts into light.
  // uA: zoom, rotation, spiral tightness, inward phase   uB: core intensity, core size, seconds since burst, -
  // uC: centre xy, tilt, level
  // =====================================================================================
  const FLOW = COMMON + H4 + `
float vnp(vec2 p, float P){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float a=hash12(vec2(mod(i.x,P),i.y)), b=hash12(vec2(mod(i.x+1.,P),i.y)), c=hash12(vec2(mod(i.x,P),i.y+1.)), d=hash12(vec2(mod(i.x+1.,P),i.y+1.));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
// periodic fbm in (angle cells, log radius); limits octaves by the pixel footprint fp
float fbmP(vec2 p, float P, float fp){ float s=0., a=.5, w=0.; for(int i=0;i<6;i++){ float k=1.-smoothstep(.35,.9,fp); s+=a*mix(.5,vnp(p,P),k); w+=a; p=p*2.+vec2(0.,1.7); P*=2.; fp*=2.; a*=.52; } return s/w; }
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float tilt=uC.z; float wpers=1.+uv.y*tilt; vec2 p=vec2(uv.x,uv.y*1.15)/wpers;
  p=rot(uA.y)*p/uA.x;
  vec2 d=p-uC.xy; float r=length(d)+1e-6; float th=atan(d.y,d.x);
  float rho=log(r);
  float pix=1./(uRes.y*uA.x*r);                           // pixel size in log-radius units
  float burst=uB.z;
  float out_=burst>0.? 2.2*(1.-exp(-burst*1.3)) : 0.;
  float ths=th + uA.z*rho;
  float ph=rho + uA.w - out_;
  // two layers: liquid gold filaments and slower smoke above
  float P=20.; vec2 q=vec2(ths/6.2831853*P, ph*2.6);                 // P/4 must stay whole or the pattern tears at the seam
  float fpA=pix*max(P/6.2831853*(1.+abs(uA.z)), 2.6)*1.2;
  float wv=fbmP(q*vec2(.25,.5)+vec2(0.,uTime*.08), P*.25, fpA*.4);
  vec2 qw=q+vec2(wv*5.,wv*1.2);
  float f=fbmP(qw, P, fpA);
  float ridge=1.-abs(f*2.-1.);
  float fil=pow(ridge,7.)*1.2+pow(ridge,2.5)*.25;
  float sm=fbmP(vec2((th+uA.z*.6*rho)/6.2831853*8., ph*1.3-uTime*.05)+wv, 8., pix*2.)*1.;
  float h=fil*.8+sm*.5;
  vec3 n=normalize(vec3(-dFdx(h)*2.4/max(pix*40.,1.), -dFdy(h)*2.4/max(pix*40.,1.), 1.));
  // light comes from the core
  vec3 Lc=normalize(vec3(-d, .35+r*.5)); float fall=1./(1.+r*r*9.);
  float dif=max(dot(n,Lc),0.);
  vec3 hv=normalize(Lc+vec3(0.,0.,1.)); float spec=pow(max(dot(n,hv),0.),60.);
  vec3 gold=vec3(1.,.66,.28);
  float near=smoothstep(.0,.012,r);
  vec3 smoke=mix(vec3(.010,.009,.012), vec3(.11,.085,.07), sm)*(.35+1.2*fall);
  vec3 col=smoke*uC.w;
  col+=gold*fil*(.12+2.2*dif*fall)*uC.w*near + vec3(1.,.85,.6)*spec*fil*3.2*fall*uC.w*near;
  float sparkC=hash12(floor(qw*vec2(1.,3.))); col+=vec3(2.,1.4,.7)*step(.985,sparkC)*fall*uC.w*smoothstep(.6,.2,fpA);
  // the core: a point that sharpens as the flow blows up
  float eps=uB.y;
  col+=vec3(1.,.8,.55)*uB.x*(eps*eps/(r*r+eps*eps))*1.4 + vec3(1.,.7,.4)*uB.x*.06/(1.+r*30.);
  // burst: flash and a shock ring
  if(burst>0.){ float R=burst*.9+burst*burst*.15; float wR=.02+burst*.05;
    col+=vec3(1.,.82,.6)*exp(-pow((r-R)/wR,2.))*exp(-burst*.9)*6.;
    col+=vec3(1.,.9,.75)*exp(-burst*6.)*4./(1.+r*r*30.);
    col+=gold*fil*exp(-burst*.8)*1.2*fall; }
  fragColor=vec4(col,1.); }`;
  function drawFlow(k, T, extra = {}) { // k = chapter time, 69–83
    const s = k - 69, burst = k - 76;
    // the inward phase accelerates hyperbolically toward the blow-up
    const pre = Math.min(k, 75.98);
    const phase = 0.25 * (pre - 69) + 1.25 * Math.log(7.2 / Math.max(76.02 - pre, 0.02));
    const tight = lerp(1.2, 5.5, Math.pow(clamp((pre - 69) / 7), 1.6)) + (burst > 0 ? -2.5 * (1 - Math.exp(-burst * 0.9)) : 0);
    const zoom = 1.0 + 0.35 * easeIO(clamp(s / 7)) + (burst > 0 ? -0.15 * (1 - Math.exp(-burst)) : 0);
    const rotA = 0.15 * s + (burst > 0 ? 0 : 0);
    const eps = burst > 0 ? 0.03 + 0.06 * (1 - Math.exp(-burst * 0.8)) : 0.05 * Math.pow(Math.max(76.02 - k, 0.002) / 7, 0.7) + 0.002;
    const coreI = burst > 0 ? 1.6 + 4 * Math.exp(-burst * 2.5) : 0.6 + 2.0 * Math.pow(clamp((k - 69) / 7), 3);
    const lev = smooth(68.8, 70.2, k);
    const lift = burst > 0 ? 0.12 * Math.exp(-burst * 6) : 0.05 * smooth(75.6, 76, k);
    GL.frame({ name: PRE + "flow", fs: FLOW, scale: SC(0.55, 1.5),
      uniforms: { uTime: T, uA: [zoom, rotA, tight, phase], uB: [coreI, eps, burst, 0], uC: [0, 0, 0.32, lev], uQ: Qf() } },
    { bloom: 0.65 + (burst > 0 ? 0.15 * Math.exp(-burst * 2) : 0), thresh: 1.0, exposure: 1.0 - (burst > 0 ? 0.25 * Math.exp(-burst * 1.5) : 0), rays: [0.5, 0.5, burst > 0 ? 0.35 * Math.exp(-burst * 1.2) : 0.15 * smooth(73, 76, k)], letterbox: LB, vignette: 0.6, t: T, lift: lift + (extra.lift ?? 0), fade: extra.fade ?? 1 });
    blit();
  }

  // =====================================================================================
  // 7. THE DOORS OPEN (83–98) and 8. THE SPIRAL (94–102)
  // =====================================================================================
  const SPIRALFS = COMMON + H4 + SPIRAL + `
void main(){ vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 col=spiralCol(ro, rd, uA.x, uA.y) + vec3(1.,.9,.74)*uA.z;
  fragColor=vec4(col,1.); }`;
  function openCam(k) {
    const u = clamp((k - 82.6) / 15.4);
    const z = mspline([82.6, 90, 94, 96.5, 98], [-17.5, -12.5, -8.5, -3.0, 1.5], k);
    const y = mspline([82.6, 92, 98], [1.55, 2.2, 4.8], k);
    return camLook([0, y, z], [0, lerp(5.9, 6.6, easeIO(u)), 40], 1.22);
  }
  const openAngle = k => 1.45 * easeIO(clamp((k - 84.4) / 8.2));
  const glareAt = k => (0.5 + 2.5 * smooth(84.4, 89.5, k) + 9 * smooth(89.5, 93.2, k)) * (1 - smooth(93.2, 97.0, k));
  const spiralAt = k => smooth(92.5, 96.5, k);
  const spinAt = k => { const s = Math.max(0, k - 92); return 0.02 * s * s + 0.004 * s * s * s; };
  function drawGateOpen(k, T, extra = {}) {
    const cam = openCam(k);
    const open = openAngle(k);
    const seal = (1.2 + 3.0 * smooth(83.0, 83.8, k)) * (1 - smooth(83.8, 85.0, k));
    const leak = (1.0 + 1.6 * smooth(83, 84, k)) * (1 - smooth(84.6, 86, k) * 0.5);
    const inner = glareAt(k);
    const spiral = spiralAt(k);
    const sq = project(cam, [0, 5, 2]);
    gateFrame(T, cam, { open, seal, leak, inner, dust: 1.0, spiral, spin: spinAt(k) },
      { bloom: 0.62 + 0.25 * smooth(86, 92, k), thresh: 1.0, exposure: 1.0 + 0.25 * smooth(88, 93, k) - 0.2 * smooth(94, 97, k), rays: sq ? [sq[0] / W, 1 - sq[1] / H, 0.25 + 0.3 * smooth(85, 91, k)] : [0.5, 0.5, 0.3], fade: extra.fade ?? 1, lift: (extra.lift ?? 0) + 0.12 * smooth(90.5, 93.5, k) * (1 - smooth(93.5, 96, k)) });
    drawMotes(cam, T, leak * (1 - smooth(84.6, 86, k)), inner, open, 1);
  }
  function drawSpiral(k, T, extra = {}) {
    const cam = openCam(Math.min(k, 98));
    const after = Math.max(0, k - 98);
    if (after > 0) { cam.pos = [0, 4.8 + after * 0.5, 1.5 + after * 7 + after * after * 0.6]; cam.fwd = norm(sub([0, 6.6 + after * 0.1, 40], cam.pos)); }
    const glare = Math.max(0, glareAt(k));
    GL.frame({ name: PRE + "spiral", fs: SPIRALFS, scale: SC(0.55, 1.5),
      uniforms: { uTime: T, ...camUniforms(cam), uA: [spinAt(k), spiralAt(k), glare, 0], uQ: Qf() } },
    { bloom: 0.7, thresh: 1.0, exposure: 1.0, rays: [0.5, 0.5, 0.2], letterbox: LB, vignette: 0.6, t: T, fade: (extra.fade ?? 1) * (1 - 0.45 * smooth(101.2, 102, k)) });
    blit();
  }

  // =====================================================================================
  // the cut
  // =====================================================================================
  function render(k, T) {
    if (k < 21.6) drawStairs(k, T);
    else if (k < 22.6) xfade(smooth(21.6, 22.6, k), () => drawStairs(k, T), () => drawGateSealed(k, T));
    else if (k < 40.0) drawGateSealed(k, T);
    else if (k < 49.4) drawPaper(k, T);
    else if (k < 50.6) xfade(smooth(49.4, 50.6, k), () => drawPaper(k, T, { fade: 1 - smooth(49.6, 50.6, k) }), () => drawAstra(k, T));
    else if (k < 59.6) drawAstra(k, T);
    else if (k < 60.6) xfade(smooth(59.6, 60.6, k), () => drawAstra(k, T), () => drawOMR(k, T));
    else if (k < 68.6) drawOMR(k, T);
    else if (k < 69.6) xfade(smooth(68.6, 69.6, k), () => drawOMR(k, T, { fade: 1 - smooth(68.6, 69.6, k) }), () => drawFlow(k, T));
    else if (k < 82.4) drawFlow(k, T);
    else if (k < 83.6) xfade(smooth(82.4, 83.6, k), () => drawFlow(k, T, { lift: 0.3 * smooth(82.4, 83.4, k) }), () => drawGateOpen(k, T));
    else if (k < 94.6) drawGateOpen(k, T);
    else if (k < 96.4) xfade(smooth(94.6, 96.4, k), () => drawGateOpen(k, T), () => spiralNext(k, T));
    else spiralNext(k, T);
  }
  const spiralNext = (k, T) => window.CH5_SPIRAL ? window.CH5_SPIRAL(k - 102, T) : drawSpiral(k, T);
  function captions(k) {
    chapterCard(k, "IV", "문턱");
    caption(k, 8.8, 13.4, (a, u) => capB("2023 — 변호사 시험 상위 10%", a, u));
    caption(k, 13.8, 18.4, (a, u) => capB("2024 — 생각하는 법을 배우다", a, u));
    caption(k, 18.8, 22.4, (a, u) => capB("2025 — 국제수학올림피아드 금메달", a, u));
    caption(k, 22.8, 39.6, (a, u) => capT("2026년 4월 · Anthropic", a, u));
    caption(k, 23.2, 26.8, (a, u) => capB("새 모델을 세상에 공개하지 않았다", a, u));
    caption(k, 27.2, 31.9, (a, u) => capB("그 모델은 27년 동안 아무도 못 찾은 결함을 찾아냈다", a, u));
    caption(k, 32.3, 35.5, (a, u) => capB("소프트웨어의 허점을 찾는 일에서", a, u));
    caption(k, 35.9, 39.9, (a, u) => capB("극소수의 최고 전문가를 빼면, 어떤 인간보다 뛰어났다", a, u));
    caption(k, 40.6, 49.6, (a, u) => capT("2026년 5월 · OpenAI", a, u));
    caption(k, 41.0, 45.5, (a, u) => capB("80년 동안 풀리지 않던 에르되시의 추측", a, u));
    caption(k, 46.0, 49.6, (a, u) => capB("AI가 반증했다", a, u));
    caption(k, 50.5, 59.7, (a, u) => capT("2026년 8월 · 아스트라", a, u));
    caption(k, 49.7, 51.8, (a, u) => capB("이게 끝일까?", a, u));
    caption(k, 52.0, 56.8, (a, u) => capB("10년 넘게 풀리지 않던 난제 열 개", a, u));
    caption(k, 57.3, 60.2, (a, u) => capB("한꺼번에", a, u));
    caption(k, 60.6, 68.7, (a, u) => capT("2026년 9월 6일", a, u));
    caption(k, 63.6, 68.0, (a, u) => capB("수능 전 과목 만점", a, u));
    caption(k, 64.6, 68.7, (a) => small("수능 문제 기반 비공식 AI 평가", a));
    caption(k, 69.8, 82.6, (a, u) => capT("2026년 9월 8일 · OpenAI", a, u));
    caption(k, 70.2, 73.3, (a, u) => capMix([["상금 100만 달러", 40], [" (약 13억 원)", 25, "rgba(244,241,234,0.62)"], [", 7대 밀레니엄 난제", 40]], a, u));   // 1 USD ≈ 1,342 KRW (2026-10-09)
    caption(k, 73.6, 76.6, (a, u) => capB("나비에–스토크스 방정식", a, u));
    caption(k, 77.2, 81.8, (a, u) => capB("공개되지 않은 모델이 88시간 만에 풀었다고 발표했다", a, u));
    caption(k, 78.4, 82.6, (a) => small("수학계 검증 진행 중", a));
    caption(k, 82.8, 85.8, (a, u) => capB("연구소 깊은 곳에서는, 지금 무엇이 풀리고 있을까", a, u));
    caption(k, 86.0, 88.5, (a, u) => line("이것은 현실이다", W / 2, H / 2, { size: 76, spacing: 0.3 - 0.08 * ease(u * 1.5), alpha: a, glow: 26, blur: (1 - a) * 6 }));
    caption(k, 88.7, 91.4, (a, u) => capB("우리는 이것을 AGI라고 본다", a, u));
    caption(k, 91.6, 94.2, (a, u) => capB("문턱은 이미 넘었다", a, u));
    caption(k, 94.4, 97.8, (a, u) => capB("그리고 이제 연구소들은", a, u));
    caption(k, 98.2, 101.9, (a, u) => capB("AI에게 AI 연구를 맡기기 시작했다", a, u));
  }
  chapter("ch4", 102, (k, T) => {
    render(k, T);
    bars();
    captions(k);
  });
})();
