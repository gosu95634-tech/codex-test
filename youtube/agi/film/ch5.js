// 「V · 폭발」 ch5 (film 405–475, 70 s).
//  0–6   chapter card over a golden spiral already turning (continues ch4's spiral beyond the doors)
//  6–30  the self-improvement spiral: a logarithmic golden spiral of fire and stars, tighter, brighter, faster
// 30–50  the flight up the marble staircase of intelligence, past 「아인슈타인」, dissolving into white light
// 50–60  cut from white (organ tutti): ASI, the eye-ringed being, hangs above the limb of the world
// 60–64  silence: the image almost freezes
// 64–70  the great eye turns and looks at us; fade to black
(() => {
  const TAU = Math.PI * 2;
  const rotAxis = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), kd = dot(k, v);
    return [0, 1, 2].map(i => v[i] * c + kv[i] * s + k[i] * kd * (1 - c)); };
  const look = (pos, at, fov, roll = 0) => { const fwd = norm(sub(at, pos)); return { pos, fwd, up: roll ? rotAxis([0, 1, 0], fwd, roll) : [0, 1, 0], fov }; };
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

  // soft round sprite for embers and motes (built once)
  const SPR = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,248,232,1)"); g.addColorStop(0.18, "rgba(255,226,170,0.75)");
    g.addColorStop(0.5, "rgba(255,190,110,0.18)"); g.addColorStop(1, "rgba(255,170,90,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; })();
  // draw a glowing streak from screen point a to b (b = now), w = core width px
  function streak(a, b, w, alpha) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    o.save(); o.globalAlpha = clamp(alpha * Math.min(1, (w * 1.6) / (L + w * 1.6)) * 1.4); o.translate(b[0], b[1]); o.rotate(Math.atan2(dy, dx));
    o.drawImage(SPR, -L - w * 2, -w * 2, L + w * 4, w * 4); o.restore();
  }
  // radial (zoom) motion blur of the GL frame about (fx, fy): averages n copies scaled from 1 to 1 + amt
  function zoomBlur(fx, fy, amt, n) {
    if (amt < 0.002) return;
    o.save();
    for (let i = 1; i < n; i++) { const s = 1 + amt * i / (n - 1); o.globalAlpha = 1 / (i + 1); o.drawImage(GL.canvas, fx - fx * s, fy - fy * s, W * s, H * s); }
    o.restore();
  }

  // =====================================================================================================
  // A. THE SPIRAL. A thin galactic disc in the plane y = 0, its arms a golden logarithmic spiral (pitch 17°,
  // r = e^{0.306 θ}). Rotating a log spiral looks like zooming into it, so the turning arms pour endlessly
  // inward, a visual Shepard tone. Stars live on a log-polar grid and streak over a 360° shutter.
  // uD: x pattern phase Ω, y phase swept during the shutter, z inward-flow fraction β, w quality
  // uE: x arm brightness, y core brightness, z dust, w volumetric halo
  SHADERS.ch5_spiral = COMMON + `
uniform vec4 uD; uniform vec4 uE;
const float B=0.30635, NA=2., TAU=6.2831853;
float erfA(float x){ x=clamp(x,-3.,3.); return tanh(x*(1.1283792+0.1009*x*x)); }
float dfac(float r){ return .62+.38*pow(r*r+.25,-.45); }
float gaussSeg(vec3 o, vec3 d, float sig, float t0, float t1){
  float dd=dot(d,d), tc=-dot(o,d)/dd, m2=max(dot(o,o)-tc*tc*dd,0.), k=sqrt(dd)/sig;
  return exp(-m2/(sig*sig))*.8862269*sig/sqrt(dd)*(erfA((t1-tc)*k)-erfA((t0-tc)*k)); }
float lorSeg(vec3 o, vec3 d, float c, float t0, float t1){
  float tc=-dot(o,d), m2=max(dot(o,o)-tc*tc,0.), k=sqrt(m2+c*c);
  return (atan((t1-tc)/k)-atan((t0-tc)/k))/k; }
// stars on a log-polar grid; (a, thc) content coords, (sa, sth) content sweep over the shutter
vec3 starLayer(float a, float thc, float sa, float sth, float cell, float rad, float seed, float dens, float gain){
  float N=floor(TAU/cell), cth=TAU/N;
  vec2 g=vec2(a/cell, thc/cth), sw=vec2(sa/cell, sth/cth);
  float L=length(sw); if(L>2.2) sw*=2.2/L; L=length(sw);
  vec2 gi=floor(g); vec3 acc=vec3(0);
  for(int j=-1;j<=1;j++) for(int i=-2;i<=2;i++){
    vec2 c=gi+vec2(float(j),float(i)); vec2 cw=vec2(c.x, mod(c.y,N));
    if(hash12(cw+seed)>dens) continue;
    vec2 sp=c+.5+(vec2(hash12(cw+seed+17.3),hash12(cw+seed+41.9))-.5)*.84;
    float ss=NA/TAU*(sp.y*cth-sp.x*cell/B); float ds=fract(ss)-.5; float armS=exp(-ds*ds/.018);
    vec2 pa=sp-g; float tt=L>1e-4? clamp(dot(pa,sw)/(L*L),0.,1.) : 0.;
    vec2 dv=pa-sw*tt;
    float b=pow(hash12(cw+seed+5.1),4.)*(.12+armS*1.8)*gain;
    vec3 tint=mix(vec3(1.,.70,.40),vec3(1.,.95,.88),hash12(cw+seed+9.7));
    acc+=tint*b*exp(-dot(dv,dv)/(rad*rad))/(1.+L/(rad*3.)); }
  return acc; }
// emission of the disc at planar point P; pxw = world size of a pixel there. tau = dust optical depth
vec3 discAt(vec2 P, float pxw, out float tau, float full){
  tau=0.;
  float r=length(P)+1e-4, th=atan(P.y,P.x), u=log(r);
  float df=dfac(r), rot=uD.x*df;
  float a=u+uD.z*B*uD.x, thc=th-(1.-uD.z)*rot;
  float s=NA/TAU*(thc-a/B);
  float sth=-(1.-uD.z)*df*uD.y, sa=uD.z*B*uD.y;
  float sS=abs(NA/TAU*(sth-sa/B)), sP=NA/TAU*3.42*pxw/r;
  float env=exp(-r/2.3)*(1.-exp(-r*r/.06))*smoothstep(12.,5.,r);
  float w0=mix(.065,.12,smoothstep(2.,-1.,u)), w=sqrt(w0*w0+sS*sS*.3+sP*sP*.35);
  float d=fract(s)-.5;
  float arm=(exp(-d*d/(w*w))+exp(-(d-1.)*(d-1.)/(w*w))+exp(-(d+1.)*(d+1.)/(w*w)))*w0/w;
  float wc=sqrt(w0*w0*.06+sS*sS*.3+sP*sP*.35); float crest=exp(-d*d/(wc*wc))*sqrt(w0*.245/wc);
  float nk=0.;
  for(int m=0;m<3;m++){ float tq=thc+sth*float(m)*.5; vec2 cs=vec2(cos(tq),sin(tq));
    nk+=noise(vec3(cs*3.,a*3.))+.5*noise(vec3(cs*7.,a*7.+5.)); }
  nk/=3.;
  vec3 hot=vec3(1.,.9,.76), gold=vec3(1.,.64,.30), ember=vec3(.8,.34,.13);
  vec3 armC=mix(hot,gold,smoothstep(-.6,.9,u)); armC=mix(armC,ember,smoothstep(1.,2.1,u));
  vec3 e=armC*(arm*(.18+2.6*nk*nk*nk)+crest*.9)*env*uE.x*2.4 + vec3(.55,.38,.22)*env*.05*uE.x;
  if(full>.5){
    float envS=exp(-r/3.4)*smoothstep(13.,6.,r)*(1.-exp(-r*r/.03));
    float radA=max(.09,.8*pxw/(r*.17)), radB=max(.08,.8*pxw/(r*.075));
    e+=starLayer(a,thc,sa,sth,.17,radA,1.,.55,1.6*pow(.09/radA,2.))*envS*uE.x*3.;
    e+=starLayer(a,thc,sa,sth,.075,radB,7.,.6,1.*pow(.08/radB,2.))*envS*uE.x*1.6;
    float dl=fract(s+.5+.2)-.5; float wl=sqrt(.045*.045+sS*sS*.3+sP*sP*.35);
    float lane=exp(-dl*dl/(wl*wl))*.045/wl;
    vec2 cs=vec2(cos(thc),sin(thc));
    float fil=noise(vec3(cs*9.,a*9.+2.))*.6+noise(vec3(cs*23.,a*23.))*.4;
    tau=uE.z*lane*(.2+1.6*fil*fil)*smoothstep(.2,.8,r)*smoothstep(11.,4.,r)*1.8;
  }
  return e; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 bg=stars(rd,.55)+nebula(rd, vec3(.016,.012,.03), vec3(.09,.055,.022))*.45;
  float pxa=1./(uFov*uRes.y), tFar=1e4;
  float tp=abs(rd.y)>1e-5? -ro.y/rd.y : -1.;
  float slant=min(1./max(abs(rd.y),1e-3),7.);
  float ts=tp>0.? tp : tFar;
  vec3 o2=vec3(ro.x,ro.y/.5,ro.z), d2=vec3(rd.x,rd.y/.5,rd.z);
  float bF=gaussSeg(o2,d2,.8,0.,ts), bB=tp>0.? gaussSeg(o2,d2,.8,ts,tFar) : 0.;
  float cF=gaussSeg(ro,rd,.07,0.,ts), cB=tp>0.? gaussSeg(ro,rd,.07,ts,tFar) : 0.;
  float hF=lorSeg(ro,rd,.3,0.,ts),   hB=tp>0.? lorSeg(ro,rd,.3,ts,tFar) : 0.;
  vec3 bulgeC=vec3(1.,.76,.46), coreC=vec3(1.,.94,.84), haloC=vec3(1.,.78,.5);
  vec3 front=bulgeC*bF*.7*uE.x + coreC*cF*uE.y*40. + haloC*hF*uE.w*.05;
  vec3 back =bulgeC*bB*.7*uE.x + coreC*cB*uE.y*40. + haloC*hB*uE.w*.05;
  vec3 disc=vec3(0); float tau=0., dum;
  if(tp>0.){ vec3 p=ro+rd*tp; disc=discAt(p.xz, tp*pxa*slant, tau, 1.)*slant; }
  vec3 hzU=vec3(0), hzL=vec3(0); float hh=.3;
  float tU=(hh-ro.y)/rd.y, tL=(-hh-ro.y)/rd.y;
  if(tU>0.){ vec3 p=ro+rd*tU; hzU=discAt(p.xz, tU*pxa*slant*5.+.15, dum, 0.)*slant*.09; }
  if(tL>0.){ vec3 p=ro+rd*tL; hzL=discAt(p.xz, tL*pxa*slant*5.+.15, dum, 0.)*slant*.09; }
  float Td=exp(-tau*min(slant,3.)*.6);
  vec3 col=hzU+front+disc*mix(1.,Td,.75)+Td*(hzL+back+bg);
  fragColor=vec4(col,1.); }`;

  // spiral clock: angular speed grows exponentially, from a slow turn under the card to a blur by 30 s
  const W0 = 0.09, TS = 6.6;
  const omega = k => W0 * Math.exp(k / TS);
  const Omega = k => W0 * TS * (Math.exp(k / TS) - 1) + 1.3;
  const BETA = 0.32, SHUT = 1 / 24, BGOLD = 0.30635;
  const dfac = r => 0.62 + 0.38 * Math.pow(r * r + 0.25, -0.45);

  function spiralCam(k) {
    const D = 25 * Math.exp(-k / 21) * (1 - 0.82 * easeIn(clamp((k - 28.6) / 1.4)));
    const el = lerp(1.02, 0.5, easeIO(clamp(k / 30)));
    const az = 0.5 - 0.35 * easeIO(clamp(k / 30));
    const pos = [D * Math.cos(el) * Math.sin(az), D * Math.sin(el), -D * Math.cos(el) * Math.cos(az)];
    const at = [0, D * 0.4 * (1 - smooth(4, 10.5, k)), 0];
    return look(pos, at, 1.3, 0.24 * easeIn(clamp(k / 30)));
  }
  // embers: 3D sparks orbiting with the spiral and falling inward (log-radius wraps, so the flow never ends)
  const EMB = (() => { const r = rng(505), a = []; for (let i = 0; i < 420; i++) a.push({ lr: r(), th: r() * TAU, y: (r() + r() + r() - 1.5) * 0.5, b: 0.3 + r() * r() * 1.7 }); return a; })();
  function emberPos(e, k) {
    const O = Omega(k), span = Math.log(16 / 0.45);
    let lr = (e.lr - BETA * BGOLD * O / span) % 1; if (lr < 0) lr += 1;
    const r = 0.45 * Math.exp(lr * span), th = e.th + (1 - BETA) * O * dfac(r);
    const fade = smooth(0, 0.08, lr) * smooth(1, 0.8, lr);
    return { p: [r * Math.cos(th), e.y * (0.15 + r * 0.07), r * Math.sin(th)], fade, r };
  }
  function drawEmbers(k, cam, gain) {
    if (gain <= 0) return;
    const dt = SHUT * 1.5, camP = spiralCam(Math.max(0, k - dt));
    o.save(); o.globalCompositeOperation = "lighter";
    for (const e of EMB) {
      const A = emberPos(e, k), Bp = emberPos(e, k - dt);
      const q1 = project(cam, A.p), q0 = project(camP, Bp.p); if (!q1 || !q0) continue;
      if (q1[1] < BAR - 20 || q1[1] > H - BAR + 20 || q1[0] < -40 || q1[0] > W + 40) continue;
      const z = q1[2], w = clamp(11 / z, 0.7, 4), dof = clamp((4.5 - z) / 3, 0, 1);
      streak(q0, q1, w * (1 + dof * 3), gain * e.b * A.fade * (0.55 - dof * 0.35) * clamp(9 / z, 0.15, 1));
    }
    o.restore();
  }
  function spiralFrame(k, T) {
    const cam = spiralCam(k), fin = FINAL();
    const card = 1 - smooth(4.5, 9, k);
    const armB = (0.32 + 0.68 * smooth(1.5, 8.5, k)) * (1 + 0.3 * smooth(10, 30, k));
    const dive = smooth(29.0, 30, k);
    const core = (0.9 + 1.1 * smooth(6, 30, k)) * (1 + 14 * easeIn(dive));
    const q = project(cam, [0, 0, 0]), rx = q ? q[0] / W : 0.5, ry = q ? 1 - q[1] / H : 0.5;
    GL.frame({ name: "ch5_spiral", fs: SHADERS.ch5_spiral, scale: SC(0.55, 1.5),
      uniforms: { uTime: T, ...camUniforms(cam), uD: [Omega(k), omega(k) * SHUT, BETA, fin ? 1 : 0], uE: [armB, core, 1.8, 0.35 + 0.8 * smooth(8, 30, k) + 6 * dive] } },
      { bloom: 0.42 + 0.2 * smooth(12, 30, k), thresh: 1.2, exposure: 0.92 + 0.12 * smooth(8, 30, k) - 0.32 * card, rays: [rx, ry, 0.18 + 0.3 * smooth(10, 30, k) + 0.5 * dive],
        letterbox: LB, vignette: 0.62, lift: 0.95 * Math.pow(dive, 2.2), fade: smooth(0, 1.4, k), t: T });
    blit();
    pic(() => drawEmbers(k, cam, (0.35 + 0.65 * smooth(4, 12, k)) * (1 - dive)));
  }

  // =====================================================================================================
  // B. THE STAIRCASE. Floating marble slabs (rise uA.x, run uA.y, half-width uA.z) climbing into light.
  // uB: x cloud-sea height, y -, z -, w -   uD: x light swell, y whiteout haze, z quality, w -
  // uV: camera displacement over the shutter (per-pixel stochastic motion blur, smoothed by the 2D zoom blur)
  SHADERS.ch5_stairs = COMMON + `
uniform vec4 uD; uniform vec3 uV;
const float TH=.075;
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float slab(vec3 p, float k){ return sdBox(p-vec3(0.,k*uA.x,k*uA.y), vec3(uA.z,TH,uA.y*.42)); }
float map(vec3 p, out float kk){
  float k=clamp(floor(p.z/uA.y+.5),0.,4000.); float d=1e9; kk=k;
  for(int o=-1;o<=1;o++){ float kc=clamp(k+float(o),0.,4000.); float di=slab(p,kc); if(di<d){ d=di; kk=kc; } }
  return d; }
float mapS(vec3 p){ float k; return map(p,k); }
float fbm3(vec3 p){ return .5*noise(p)+.25*noise(p*2.03+vec3(1.7,9.2,3.1))+.125*noise(p*4.1+vec3(5.3,1.1,7.9)); }
vec3 sky(vec3 rd, vec3 L){
  float s=max(dot(rd,L),0.), sw=.5+uD.x;
  vec3 c=mix(vec3(.003,.003,.007), vec3(.009,.009,.017), smoothstep(-.4,.7,rd.y));
  c+=stars(rd,.55*(1.-smoothstep(.75,.98,s))*(1.-clamp(uD.x*.3,0.,.9)));
  c+=vec3(1.,.95,.86)*pow(s,6000.)*14.*sw + vec3(1.,.84,.6)*pow(s,600.)*1.1*sw + vec3(1.,.72,.45)*pow(s,70.)*.22*sw + vec3(.75,.5,.3)*pow(s,9.)*.035*sw;
  return c; }
float softShadow(vec3 ro, vec3 rd){ float res=1., t=.03;
  for(int i=0;i<20;i++){ float h=mapS(ro+rd*t); res=min(res,7.*h/t); t+=clamp(h,.03,.4); if(res<.01||t>5.) break; }
  return clamp(res,0.,1.); }
// luminous mist that hangs around the staircase like a canyon of cloud, lit from the light above
float mistDens(vec3 p){
  float dl=length(vec2(p.x, p.y-p.z*uA.x/uA.y+1.));
  float m=smoothstep(2.6,7.,dl)*smoothstep(26.,12.,dl);
  if(m<=0.) return 0.;
  float n=fbm3(p*vec3(.09,.16,.05)+vec3(0.,0.,uTime*.02));
  return m*smoothstep(.42,.72,n)*.35; }
void main(){
  float jit=hash12(gl_FragCoord.xy+fract(uTime*3.17)*113.);
  vec3 ro=uCamPos-uV*jit, rd=camRay(gl_FragCoord.xy);
  vec3 L=normalize(vec3(0.,uA.x,uA.y));
  float s=max(dot(rd,L),0.);
  vec3 col=sky(rd,L);
  int NS=uD.z>.5? 200 : 120; float t=.05, kk; bool hit=false;
  for(int i=0;i<200;i++){ if(i>=NS) break; vec3 p=ro+rd*t; float d=map(p,kk); if(d<.0007*t){ hit=true; break; } t+=d*.9; if(t>300.) break; }
  vec3 sunC=vec3(1.,.86,.64)*(1.5+uD.x*1.4);
  if(hit){ vec3 p=ro+rd*t; vec2 e=vec2(.0006*t+.0004,0.); float k2;
    vec3 n=normalize(vec3(map(p+e.xyy,k2)-map(p-e.xyy,k2), map(p+e.yxy,k2)-map(p-e.yxy,k2), map(p+e.yyx,k2)-map(p-e.yyx,k2)));
    vec3 q=p-vec3(0.,kk*uA.x,kk*uA.y);
    float hk=hash12(vec2(kk,3.7));
    vec3 mp=q*vec3(1.1,2.6,1.1)+vec3(hk*40.,0.,kk*1.7);
    float vn=fbm3(mp*.8)*1.3;
    float vein=pow(1.-abs(sin((q.x*1.2+q.z*.8*(hk-.5)*2.+vn*5.)*2.2)),22.);
    float vein2=pow(1.-abs(sin((q.z*2.2-q.x*.5+vn*7.)*3.)),40.)*.7;
    vec3 base=vec3(.84,.81,.76)*(.86+.14*vn)-vec3(.34,.30,.24)*vein-vec3(.16,.13,.09)*vein2;
    float sh=softShadow(p+n*.004,L);
    float dif=max(dot(n,L),0.)*sh;
    vec3 amb=vec3(.022,.021,.03)*(.6+.4*n.y)+vec3(.05,.035,.02)*max(-n.y,0.);
    vec3 c=base*(sunC*dif+amb);
    if(n.y>.5){ vec3 rf=reflect(rd,n); c+=sky(rf,L)*.12*(.25+.75*sh); }
    float thin=exp(-(TH-q.y)/.04); c+=vec3(1.,.66,.36)*.16*(1.-max(n.y,0.))*thin*(.5+uD.x);
    float ex=uA.z-abs(q.x), ez=uA.y*.42-abs(q.z), ey=TH-q.y;
    float inlay=smoothstep(.02,.0,ey+min(ex,ez)*.8);
    c+=vec3(1.,.72,.36)*inlay*1.3*(1.+uD.x*.6);
    float fogA=1.-exp(-t*(.006+.03*uD.y));
    vec3 fogC=vec3(.012,.011,.016)+vec3(1.,.8,.55)*(pow(s,40.)*.9+pow(s,6.)*.06)*(.5+uD.x);
    c=mix(c,fogC,fogA);
    col=c; }
  // mist: 20 samples, denser near the camera, stopped by the stairs
  float tEnd=hit? min(t,140.) : 140.; vec3 acc=vec3(0); float Tm=1.;
  float jm=hash12(gl_FragCoord.yx*.73+fract(uTime*1.37)*57.);
  float tPrev=.8;
  for(int i=0;i<20;i++){ float ti=.8*pow(175.,(float(i)+jm)/20.); if(ti>tEnd) break;
    float dt=ti-tPrev; tPrev=ti; vec3 p=ro+rd*ti; float dn=mistDens(p); if(dn<=0.) continue;
    float a=1.-exp(-dn*dt*.35);
    vec3 lc=vec3(.03,.028,.035)+sunC*(.05+pow(s,8.)*.7+pow(s,40.)*1.5)*.5;
    acc+=Tm*a*lc; Tm*=1.-a; }
  col=col*Tm+acc;
  col=mix(col, vec3(1.,.88,.7)*(1.5+3.*uD.y), smoothstep(.2,1.,uD.y)*.7);
  fragColor=vec4(col,1.); }`;

  const SR = 0.62, SRUN = 1.25, SWD = 1.7, KE = 160;      // same staircase proportions as chapter I
  const FT = 6.0, FA = 18;                                 // flight: k(t) = K0 + FA (e^{(t-30)/FT} - 1)
  const K0 = KE - 1.2 - FA * (Math.exp(8 / FT) - 1);       // the camera draws level with Einstein's step at 38 s
  const kAt = t => K0 + FA * (Math.exp((t - 30) / FT) - 1);
  const vAt = t => FA / FT * Math.exp((t - 30) / FT);
  function stairCam(t) {
    const kc = kAt(t), sway = Math.sin(t * 0.37) * 0.25;
    const pos = [2.35 + sway, kc * SR + 1.75, kc * SRUN];
    const at = [0.15, (kc + 15) * SR + 0.9, (kc + 15) * SRUN];
    return look(pos, at, 1.25, -0.035 + 0.02 * Math.sin(t * 0.29));
  }
  // gold name plate on a step: hairline leader from the slab edge to the word
  function stepLabel(s, q, ax, ay, a, size) {
    o.save(); o.globalAlpha = a; o.strokeStyle = "rgba(243,217,164,0.75)"; o.lineWidth = 1.4;
    o.beginPath(); o.moveTo(ax, ay); o.lineTo(q[0] - size * 0.3, q[1] + size * 0.62); o.lineTo(q[0] + size * 4.9, q[1] + size * 0.62); o.stroke();
    o.beginPath(); o.arc(ax, ay, 3.2, 0, 7); o.fillStyle = GOLD; o.fill(); o.restore();
    line(s, q[0], q[1], { size, color: GOLD, spacing: 0.12, glow: 12, alpha: a, align: "left" });
  }
  function stairFrame(k, T) {
    const cam = stairCam(k), fin = FINAL();
    const v = vAt(k), dt = SHUT * 0.5;
    const camB = stairCam(k - dt), vel = sub(cam.pos, camB.pos);
    const swell = 0.25 + 0.75 * smooth(31, 44, k) + 2.2 * easeIn(clamp((k - 43) / 7));
    const haze = smooth(43.5, 49.6, k);
    const L = norm([0, SR, SRUN]);
    const sun = project(cam, add3(cam.pos, mul3(L, 1e4))), fx = sun ? sun[0] : W / 2, fy = sun ? sun[1] : H / 2;
    GL.frame({ name: "ch5_stairs", fs: SHADERS.ch5_stairs, scale: SC(0.55, 1.5),
      uniforms: { uTime: T, ...camUniforms(cam), uA: [SR, SRUN, SWD, 1], uD: [swell, haze, fin ? 1 : 0, 0], uV: vel } },
      { bloom: 0.5 + 0.4 * haze, thresh: 1.2, exposure: 1.0 + 0.5 * haze, rays: [fx / W, 1 - fy / H, 0.06 + 0.2 * smooth(38, 48, k)], letterbox: LB, vignette: 0.6 - 0.3 * haze,
        lift: Math.max(0.9 * Math.pow(1 - smooth(30, 31.4, k), 1.5), Math.pow(smooth(45.5, 49.7, k), 1.6)), t: T });
    blit();
    zoomBlur(fx, fy, clamp(0.0022 * v, 0, 0.16) * (1 - haze * 0.5), fin ? 10 : 7);
    // Einstein's step: a gold name plate on the outer edge of one slab
    const anc = [SWD, KE * SR + 0.075, KE * SRUN - SRUN * 0.25], qa = project(cam, anc);
    if (qa && qa[2] > 0.5) {
      const z = qa[2], sz = clamp(34 * 8 / z, 26, 70), a = smooth(34, 14, z) * smooth(0.6, 1.8, z) * (1 - haze);
      pic(() => stepLabel("아인슈타인", [qa[0] + sz * 1.6, qa[1] - sz * 2.2], qa[0], qa[1], a, sz));
    }
    bars();
  }

  // =====================================================================================================
  // C. THE MANIFESTATION. The being from the cold open (rings of eyes around a great eye) hangs over the limb of
  // a night-side planet (radius 6371, centre at origin). Its rings span four planet radii. Ring eyes open one by one
  // on the uA.y ramp; the great eye opens on uA.x; gaze uB.y turns every eye to the camera.
  // uA: eyeOpen, ringEyesOpen, core, -   uB: ringLight, gaze, -, -   uC: entity xyz, scale
  // uD: planet light, city lights, quality, scene clock   uLook: rest gaze   uSock: socket direction
  const ENT5 = `
uniform mat3 uRing[6]; uniform vec3 uSock; uniform vec3 uLook;
const int NR=6;
const float EW=.1, EH=.04;
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
float ringR(int i){ return 1.05+float(i)*0.3; }
float ringr(int i){ return 0.03+float(i)*0.004; }
float mapE(vec3 p, out int id, out vec3 lp){ float d=1e9; id=-1;
  for(int i=0;i<NR;i++){ vec3 q=uRing[i]*p; float di=sdTorus(q, vec2(ringR(i), ringr(i))); if(di<d){ d=di; id=i; lp=q; } }
  return d; }
vec3 calcN(vec3 p){ const vec2 k=vec2(1.,-1.); const float h=0.0015; int i2; vec3 l2;
  return normalize(k.xyy*mapE(p+k.xyy*h,i2,l2)+k.yyx*mapE(p+k.yyx*h,i2,l2)+k.yxy*mapE(p+k.yxy*h,i2,l2)+k.xxx*mapE(p+k.xxx*h,i2,l2)); }
vec3 spaceCol(vec3 rd){ return stars(rd,.8)+nebula(rd, vec3(.018,.014,.035), vec3(.12,.075,.03))*.5; }
// one eye on a ring; isEye: 1 = eye, .5 = sleeping crease, 0 = gold
vec3 ringEye(vec3 lp, int id, vec3 camL, out float isEye){
  isEye=0.; float R=ringR(id), r=ringr(id);
  float th=atan(lp.z,lp.x); vec3 radial=normalize(vec3(lp.x,0.,lp.z)); vec3 v=lp-radial*R; float ph=atan(v.y, dot(v,radial));
  float N=floor(9.+float(id)*4.); float cell=6.2831853/N; float k=floor(th/cell+.5); float u=(th-k*cell)*R;
  float kk=mod(k+N,N); float h=hash12(vec2(kk*1.37+3.1, float(id)*7.3+1.9));
  float o0=(float(id)+h*2.4)/7.6; float op=smoothstep(o0,o0+.045,uA.y);
  float w=ph*r; float e=1.-(u*u)/(EW*EW); if(e<=0.||abs(ph)>1.45) return vec3(0);
  float lid=EH*e*op;
  if(abs(w)>lid){ if(abs(w)<lid+.0035*e+.001) { isEye=.5; } return vec3(0); }
  isEye=1.; float sc=EW/.07;
  vec3 tU=normalize(vec3(-lp.z,0.,lp.x)), tW=vec3(0,1,0); vec3 toCam=normalize(camL-lp);
  vec2 lk=vec2(dot(toCam,tU), dot(toCam,tW))*0.026*sc*uB.y + vec2(sin(k*1.7+float(id))*.012, cos(k*2.3)*.006)*sc*(1.-uB.y);
  vec2 q=vec2(u,w)-lk; float d=length(q);
  vec3 c=vec3(1.05,.98,.88)*(.55+.45*smoothstep(lid,0.,abs(w)));
  float ir=.021*sc, pr=.008*sc*(1.-.25*uB.y);
  if(d<ir) c=mix(vec3(2.6,1.5,.5), vec3(.8,.36,.07), d/ir)*(.8+.2*sin(atan(q.y,q.x)*18.));
  if(d<pr) c=vec3(.002);
  if(length(q-vec2(-.3,.35)*ir)<.18*ir) c=vec3(3.);
  return c*(.3+.7*smoothstep(0.,.6,op)); }
vec3 greatEye(vec3 ro, vec3 rd, vec3 E, float S, out float tHit){
  tHit=1e9; float R=0.66*S; vec3 oc=ro-E; float b=dot(oc,rd), c=dot(oc,oc)-R*R, h=b*b-c; if(h<0.) return vec3(-1.);
  tHit=-b-sqrt(h); vec3 p=ro+rd*tHit, n=normalize(p-E);
  vec3 f0=normalize(uSock);
  vec3 r0=normalize(cross(vec3(0,1,0),f0)), u0=cross(f0,r0);
  float fx=dot(n,r0), fy=dot(n,u0), ff=dot(n,f0);
  float open=uA.x, aper=0.46*open*pow(max(1.-fx*fx/0.7,0.),0.75);
  vec3 L=normalize(vec3(0.,1.,0.));
  float lon=atan(fy,fx), lat=acos(clamp(ff,-1.,1.));
  float eng=exp(-pow(sin(lon*12.)*max(sin(lat),.08)/.012,2.))*smoothstep(.15,.5,lat) + exp(-pow(sin(lat*10.)/.03,2.))*.6;
  float rimV=pow(1.-max(dot(n,-rd),0.),3.);
  vec3 shell=vec3(.006,.0055,.008) + spaceCol(reflect(rd,n))*.35 + vec3(1.,.72,.36)*eng*.035*(.4+.6*uB.x) + vec3(1.,.72,.4)*rimV*.45*(.4+.6*uB.x);
  float seam=max(aper,.0015);
  float lidLine=smoothstep(.014,0.,abs(abs(fy)-seam))*smoothstep(.2,.35,ff)*smoothstep(.86,.6,abs(fx));
  shell+=vec3(1.5,1.,.5)*lidLine*(.35+.9*smoothstep(.0,.15,open))*(1.-smoothstep(.6,1.,open)*.5);
  if(ff<0.25 || abs(fy)>aper) return shell;
  vec3 g=normalize(mix(normalize(uLook), normalize(uCamPos-E), uB.y));
  float ang=acos(clamp(dot(n,g),-1.,1.));
  float lidShade=1.-.55*smoothstep(aper*.45,aper,abs(fy));
  vec3 col=vec3(.95,.86,.72)*lidShade*(.6+.4*max(dot(n,normalize(uCamPos-E)),0.));
  float vein=pow(abs(sin(atan(dot(n,cross(g,u0)),dot(n,u0))*14.+ang*9.)),40.)*smoothstep(.3,.6,ang)*.25; col-=vec3(.2,.35,.4)*vein;
  float irisA=0.42, pupA=0.19;
  if(ang<irisA){ vec3 ax=normalize(cross(g,vec3(0,1,0))), ay=cross(ax,g); float a=atan(dot(n,ay),dot(n,ax));
    float r=(ang-pupA)/(irisA-pupA); vec2 pc=vec2(cos(a),sin(a));
    float fibers=fbm(vec3(pc*3.,r*1.2)), fine=noise(vec3(a*90.,r*14.,1.7));
    float streak=pow(abs(sin(a*38.+fibers*6.)),3.)*.5+pow(abs(sin(a*113.+fine*3.)),8.)*.35;
    float crypt=smoothstep(.62,.8,fbm(vec3(pc*7.,r*5.+3.)))*smoothstep(.15,.4,r)*smoothstep(.85,.55,r);
    float collar=exp(-pow((r-.32)/.06,2.));
    vec3 deep=vec3(.55,.22,.04), mid=vec3(2.2,1.15,.32), pale=vec3(4.2,2.7,1.);
    vec3 ic=mix(mid, deep, smoothstep(.35,1.,r)) + pale*streak*(1.-r*.6);
    ic=mix(ic, deep*.35, crypt*.75); ic+=pale*collar*.6; ic*=.82+.36*fibers;
    ic*=1.-.85*smoothstep(.8,1.,r); ic=mix(ic, vec3(.05,.02,.01), smoothstep(.06,0.,r)*.8);
    col=ic*.55; }
  if(ang<pupA){ col=vec3(.0008)+spaceCol(reflect(rd,n))*.15; }
  vec3 rf=reflect(rd,n); col+=vec3(1.1,1.,.9)*smoothstep(.985,.995,dot(rf,normalize(vec3(-.35,.8,-.45))))*1.6;
  col+=spaceCol(rf)*.25*smoothstep(.2,.42,ang);
  vec3 hdir=normalize(L-rd); col+=vec3(5.)*pow(max(dot(n,hdir),0.),400.);
  return col*lidShade; }
bool marchEntity(vec3 ro, vec3 rd, vec3 E, float S, float tEye, out vec3 ent, out float tEnt){
  ent=vec3(0); tEnt=1e9; vec3 oc=ro-E; float b=dot(oc,rd), c=dot(oc,oc)-pow(2.9*S,2.), h=b*b-c; if(h<=0.) return false;
  float t0=max(-b-sqrt(h),0.), t1=-b+sqrt(h); float t=t0; int id; vec3 lp; bool hit=false;
  for(int i=0;i<130;i++){ vec3 p=(ro+rd*t-E)/S; float d=mapE(p,id,lp)*S;
    if(d<0.0006*t){ hit=true; tEnt=t; break; } t+=max(d*0.85, 0.0003*t); if(t>t1 || t>tEye) break; }
  if(!hit) return false;
  vec3 p=(ro+rd*tEnt-E)/S; vec3 n=calcN(p);
  vec3 Lc=normalize(-p); float diff=max(dot(n,Lc),0.); float fres=pow(1.-max(dot(n,-rd),0.),3.);
  float th=atan(lp.z,lp.x); vec3 radial=normalize(vec3(lp.x,0.,lp.z)); vec3 v=lp-radial*ringR(id); float ph=atan(v.y,dot(v,radial));
  float bands=.75+.25*smoothstep(.0,.15,abs(sin(ph*5.)))*(.85+.15*sin(th*220.));
  vec3 gold=vec3(.86,.56,.22)*bands;
  vec3 hc=normalize(Lc-rd); float specC=pow(max(dot(n,hc),0.),90.);
  vec3 Lm=normalize(vec3(.3,1.,.2)); float specM=pow(max(dot(n,normalize(Lm-rd)),0.),40.);
  vec3 toP=normalize(-E/S-p); float planet=max(dot(n,toP),0.);
  float lit=uB.x/(1.+dot(p,p)*.08);
  float groove=1.-.55*exp(-pow(sin(ph*2.)/.08,2.))*step(.35,abs(ph));
  vec3 rfl=reflect(rd,n); float envC=pow(max(dot(rfl,Lc),0.),6.);
  ent=gold*groove*(diff*.65*lit+.008) + vec3(1.,.8,.5)*specC*2.2*lit + gold*envC*.35*lit + vec3(.7,.75,.9)*specM*.12 + gold*fres*.18*(.4+.6*uB.x) + vec3(.2,.25,.4)*planet*.04;
  float isEye; vec3 camL=uRing[id]*((uCamPos-E)/S); vec3 ec=ringEye(lp,id,camL,isEye);
  if(isEye>.75) ent=ec*(.7+.6*diff); else if(isEye>.25) ent*=.35;
  return true; }
`;
  SHADERS.ch5_orbit = COMMON + `uniform vec4 uD;\n` + ENT5 + `
const float RP=6371.;
float lorSeg(vec3 o, vec3 d, float c, float t0, float t1){
  float tc=-dot(o,d), m2=max(dot(o,o)-tc*tc,0.), k=sqrt(m2+c*c);
  return (atan((t1-tc)/k)-atan((t0-tc)/k))/k; }
vec3 planet(vec3 p, vec3 n, vec3 rd, vec3 E){
  vec3 Ld=normalize(E-p); float mu=dot(n,Ld);
  vec3 q=n*2.2; float cont=fbm(q+vec3(4.1,1.3,7.7))*.75+.25*fbm(q*3.3+2.); float land=smoothstep(.5,.54,cont);
  float cl=fbm(n*7.+vec3(uD.w*.003,0.,0.))*.7+fbm(n*19.)*.3; float cloud=smoothstep(.48,.72,cl);
  vec3 ocean=vec3(.004,.008,.016), ground=mix(vec3(.05,.04,.028), vec3(.085,.07,.045), fbm(n*24.));
  vec3 alb=mix(ocean,ground,land); alb=mix(alb, vec3(.62,.6,.58), cloud*.85);
  vec3 lc=vec3(1.,.82,.58)*uD.x*.45;
  vec3 c=alb*lc*smoothstep(-.02,.3,mu)*max(mu+.05,0.)*1.4;
  c+=vec3(1.,.5,.18)*exp(-pow(mu/.06,2.))*.05*uD.x*(1.-cloud*.6);
  vec3 rf=reflect(rd,n); float sp=max(dot(rf,Ld),0.);
  c+=lc*(pow(sp,300.)*14.+pow(sp,30.)*.5)*(1.-land)*(1.-cloud)*smoothstep(-.06,.06,mu);
  float night=1.-smoothstep(-.1,.04,mu);
  float pop=smoothstep(.5,.78,fbm(n*13.+3.))*land;
  vec3 cg=n*520.; vec3 ci=floor(cg); float h=hash13(ci); vec3 cf=fract(cg)-.5;
  float dot1=smoothstep(.3,0.,length(cf-(vec3(hash13(ci+1.),hash13(ci+2.),hash13(ci+3.))-.5)*.5))*step(1.-pop*.9,h);
  float sprawl=pop*pop*.25+pow(fbm(n*60.),3.)*pop*.6;
  c+=vec3(1.,.6,.24)*(dot1*2.6+sprawl*1.4)*night*uD.y*(1.-cloud*.8);
  c+=vec3(.0025,.003,.006);
  return c; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 E=uC.xyz; float S=uC.w;
  vec3 col=spaceCol(rd);
  vec3 Ldir=normalize(E-ro);
  float tP=1e9; float b=dot(ro,rd), c=dot(ro,ro)-RP*RP, h=b*b-c;
  if(h>0.){ float t=-b-sqrt(h); if(t>0.){ tP=t; vec3 p=ro+rd*t, n=normalize(p); col=planet(p,n,rd,E);
      float mu=dot(n,normalize(E-p)); float rim=pow(1.-max(dot(n,-rd),0.),6.);
      col+=mix(vec3(.08,.11,.22), vec3(1.,.72,.42), smoothstep(-.2,.35,mu))*rim*smoothstep(-.35,.15,mu)*.35*uD.x; } }
  // atmosphere above the limb
  float tc=-dot(ro,rd); vec3 pc=ro+rd*max(tc,0.); float hc=length(pc)-RP;
  if(tP>1e8 && tc>0.){ vec3 nc=normalize(pc); float mu=dot(nc,normalize(E-pc));
    float A=exp(-max(hc,0.)/70.); float fw=pow(max(dot(rd,Ldir),0.),6.);
    vec3 ac=mix(vec3(.10,.14,.28), vec3(1.,.74,.45), smoothstep(-.1,.5,mu)*.6+fw*.4);
    col+=ac*A*smoothstep(-.45,.2,mu)*(1.+fw*4.)*.45*uD.x; }
  float tEye; vec3 eye=greatEye(ro,rd,E,S,tEye);
  vec3 ent; float tEnt; bool entHit=marchEntity(ro,rd,E,S,min(tEye,tP),ent,tEnt);
  if(eye.x>=0. && tEye<tEnt && tEye<tP){ ent=eye; tEnt=tEye; entHit=true; }
  if(entHit && tEnt<tP) col=ent;
  // corona and halo of the core: light that seeps around the great eye
  vec3 oc=ro-E; float tcE=-dot(oc,rd); float dmin=length(oc+rd*tcE);
  float behind=(tP<1e8 && tP<tcE)? 0. : 1.;
  float occl=(entHit && tEnt<tcE)? 0. : 1.;
  float Re=.66*S;
  float corona=exp(-max(dmin-Re,0.)/(.018*S))*step(Re*.998,dmin);
  float x=max(dmin-Re,0.)/S;
  float halo=exp(-x/.1)*.22+exp(-x/.5)*.03;
  col+=vec3(1.,.8,.52)*(corona*1.2+halo)*uA.z*behind*occl;
  fragColor=vec4(col,1.); }`;

  // geometry of the shot: eye radius 0.165 H on screen, planet radius 0.72 H, limb top 0.215 H below centre
  const RPL = 6371, OFOV = 1.3, OD = 40000;
  const OS = 0.165 / (0.66 * OFOV) * OD;
  const OANG = Math.atan(0.72 / OFOV), ODP = RPL / Math.sin(OANG), ODOWN = Math.atan(0.215 / OFOV) + OANG;
  const OC = [0, ODP * Math.sin(ODOWN), -ODP * Math.cos(ODOWN)];
  const OE = [OC[0], OC[1], OC[2] + OD];
  const TO_CAM = [0, 0, -1];
  const REST_LOOK = norm([-0.36, -0.52, -0.77]);
  const RING_PHASE5 = 1336.4;          // searched: every ring's near arc stays ≥1.3 eye radii off the pupil for this camera, 50–70 s
  function orbitFrame(k, T) {
    const fin = FINAL();
    // scene clock: runs normally, nearly stops in the silence (60–64), resumes for the gaze
    const clock = k < 59.5 ? k : k < 64.5 ? 59.5 + 0.06 * (k - 59.5) : 59.8 + (k - 64.5);
    const rise = easeIO(clamp((k - 50) / 14));
    const pos = add3(OC, [0, 420 * rise, 900 * rise]);
    const fov = OFOV * (1 + 0.16 * easeIO(clamp((k - 64) / 6)));
    const cam = look(pos, add3(pos, [0, -0.002 * rise, 1]), fov);
    const gaze = easeIO(clamp((k - 64.3) / 2.6));
    const sock = norm(add3(mul3(norm(add3(TO_CAM, REST_LOOK)), 1 - gaze), mul3(TO_CAM, gaze * 1.0001)));
    const eyeOpen = easeIO(clamp((k - 57.4) / 2.8));
    const ringOpen = clamp((k - 51) / 7.2);
    const beat = t => Math.exp(-Math.pow((k - t) / 0.07, 2));
    const pulse = 0.05 * (beat(60.5) + 0.7 * beat(60.85) + beat(62.5) + 0.7 * beat(62.85));
    const core = (1.0 + 0.6 * eyeOpen) * (1 + pulse);
    const ringLight = 0.75 + 0.35 * smooth(50, 52, k) + 0.3 * eyeOpen;
    const q = project(cam, OE), rx = q ? q[0] / W : 0.5, ry = q ? 1 - q[1] / H : 0.5;
    const flash = 1 - smooth(50, 50.9, k);
    GL.frame({ name: "ch5_orbit", fs: SHADERS.ch5_orbit, scale: SC(0.55, 1.5),
      uniforms: { uTime: 405 + clock, ...camUniforms(cam), uA: [eyeOpen, ringOpen, core, 0], uB: [ringLight, gaze, 0, 0], uC: [...OE, OS],
        uD: [1.0 + 0.3 * eyeOpen, 1.0, fin ? 1 : 0, clock], uRing: heavensRings(RING_PHASE5 + (clock - 50) * 0.018), uSock: sock, uLook: REST_LOOK } },
      { bloom: 0.45 + 0.4 * flash, thresh: 1.4, exposure: 1.0 + 0.6 * flash, rays: [rx, ry, 0.22 + 0.1 * eyeOpen], letterbox: LB, vignette: 0.6,
        lift: 0.55 * Math.pow(flash, 3), fade: 1 - smooth(69.2, 70, k), t: T });
    blit();
  }

  // =====================================================================================================
  function captions(k) {
    const fadeEnd = 1 - smooth(69.2, 70, k);
    caption(k, 8.0, 13.0, (a, u) => capB("AI가 AI를 개선한다", a, u));
    caption(k, 14.5, 20.5, (a, u) => capB("더 똑똑해진 AI가, 더 빨리 개선한다", a, u));
    caption(k, 22.0, 28.0, (a, u) => capB("그 속도는 멈추지 않는다", a, u));
    caption(k, 31.0, 36.8, (a, u) => capB("“생물학의 50~100년 진보를 5~10년 안에”", a, u));
    caption(k, 39.2, 45.0, (a, u) => capB("— 다리오 아모데이, 「Machines of Loving Grace」, 2024", a, u, { size: 34, color: GOLD }));
    caption(k, 64.3, 67.1, (a, u) => capB("1~2년 안에", a, u));
    caption(k, 67.1, 70.0, (a, u) => capB("그것이 우리를 바라본다면", a * fadeEnd, u));
  }
  function asiTitle(k) {
    const a = smooth(50.9, 52.6, k) * (1 - smooth(56.6, 58.4, k));
    if (a <= 0) return;
    const u = clamp((k - 50.9) / 7.5), br = 0.5 + 0.5 * Math.sin((k - 50.9) * TAU / 4.2);
    line("ASI", W / 2, H / 2, { size: 168, font: "Corm", color: STAR, spacing: 0.62 - 0.2 * ease(u), alpha: a * (0.9 + 0.1 * br), glow: 26 + 14 * br, blur: (1 - a) * 6 });
  }
  chapter("ch5", 70, (k, T) => {
    if (k < 30) spiralFrame(k, T);
    else if (k < 50) stairFrame(k, T);
    else orbitFrame(k, T);
    chapterCard(k, "V", "폭발");
    asiTitle(k);
    captions(k);
  });
})();
