// 「V · 폭발」 ch5 (film 405–475, 70 s).
//  0–6   chapter card over a golden spiral already turning (continues ch4's spiral beyond the doors)
//  6–30  the self-improvement spiral: a logarithmic golden spiral of fire and stars, tighter, brighter, faster
// 30–50  from a glade in a night forest, the flight up the marble staircase of intelligence, past 「아인슈타인」, into white light
// 50–60  cut from white (organ tutti): low over the night side of the Earth at hundreds of km/s; ASI rises over the limb
// 55.2–64.7 the great eye wakes: a slit of light, one long smooth opening, one slow blink in the silence (60–64)
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
  // already turning briskly under the card, accelerating smoothly to a capped speed (never a blur that makes you dizzy)
  const omega = k => 0.45 + 4.5 * Math.pow(clamp(k / 30), 1.8);
  const Omega = k => 0.45 * k + 4.5 * 30 / 2.8 * Math.pow(clamp(k / 30), 2.8) + 1.3;
  const BETA = 0.32, SHUT = 1 / 24, BGOLD = 0.30635;
  const dfac = r => 0.62 + 0.38 * Math.pow(r * r + 0.25, -0.45);

  function spiralCam(k) {
    const D = 25 * Math.exp(-k / 21) * (1 - 0.82 * easeIn(clamp((k - 28.6) / 1.4)));
    const el = lerp(1.02, 0.5, easeIO(clamp(k / 30)));
    const az = 0.5 - 0.35 * easeIO(clamp(k / 30));
    const pos = [D * Math.cos(el) * Math.sin(az), D * Math.sin(el), -D * Math.cos(el) * Math.cos(az)];
    const at = [0, D * 0.4 * (1 - smooth(4, 10.5, k)), 0];
    return look(pos, at, 1.3, 0);
  }
  // embers: 3D sparks orbiting with the spiral and falling inward (log-radius wraps, so the flow never ends)
  const EMB = (() => { const r = rng(505), a = []; for (let i = 0; i < 900; i++) a.push({ lr: r(), th: r() * TAU, y: (r() + r() + r() - 1.5) * 0.5, b: 0.3 + r() * r() * 1.7 }); return a; })();
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
    const armB = (0.55 + 0.45 * smooth(1.5, 8.5, k)) * (1 + 0.3 * smooth(10, 30, k)) * (1 + 0.1 * Math.sin(k * 1.9));   // the arms breathe
    const dive = 0.35 * smooth(28.6, 30.4, k);
    const core = (0.9 + 1.1 * smooth(6, 30, k)) * (1 + 14 * easeIn(dive));
    const q = project(cam, [0, 0, 0]), rx = q ? q[0] / W : 0.5, ry = q ? 1 - q[1] / H : 0.5;
    GL.frame({ name: "ch5_spiral", fs: SHADERS.ch5_spiral, scale: SC(0.55, 1.5),
      uniforms: { uTime: T, ...camUniforms(cam), uD: [Omega(k), omega(k) * SHUT, BETA, fin ? 1 : 0], uE: [armB, core, 1.8, 0.35 + 0.8 * smooth(8, 30, k) + 6 * dive] } },
      { bloom: 0.42 + 0.2 * smooth(12, 30, k), thresh: 1.2, exposure: 0.92 + 0.12 * smooth(8, 30, k) - 0.32 * card, rays: [rx, ry, 0.18 + 0.3 * smooth(10, 30, k) + 0.5 * dive],
        letterbox: LB, vignette: 0.62, lift: 0.95 * Math.pow(dive, 2.2), t: T });
    blit();
    pic(() => drawEmbers(k, cam, (0.55 + 0.75 * smooth(3, 12, k)) * (1 - dive)));
  }

  window.CH5_SPIRAL = spiralFrame;                        // chapter IV ends on this same spiral (k < 0)
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
  float alt=smoothstep(15.,260.,uCamPos.y);                         // from a dusk sky on the ground to space
  c=mix(c*vec3(1.6,1.4,1.5)+vec3(.012,.012,.02)*smoothstep(.3,-.1,rd.y)+vec3(.035,.04,.065)*exp(-abs(rd.y-.03)*7.), c, alt);   // a pale band low in the sky so the treeline reads
  c+=stars(rd,(.7+.6*alt)*(1.-smoothstep(.75,.98,s))*(1.-clamp(uD.x*.3,0.,.9)));
  c+=vec3(1.,.95,.86)*pow(s,6000.)*14.*sw + vec3(1.,.84,.6)*pow(s,600.)*1.1*sw + vec3(1.,.72,.45)*pow(s,70.)*.22*sw + vec3(.75,.5,.3)*pow(s,9.)*.035*sw;
  return c; }
float softShadow(vec3 ro, vec3 rd){ float res=1., t=.03;
  for(int i=0;i<20;i++){ float h=mapS(ro+rd*t); res=min(res,7.*h/t); t+=clamp(h,.03,.4); if(res<.01||t>5.) break; }
  return clamp(res,0.,1.); }
// luminous mist that hangs around the staircase like a canyon of cloud, lit from the light above
float mistDens(vec3 p){
  float dl=length(vec2(p.x, p.y-p.z*uA.x/uA.y+1.));
  float m=smoothstep(2.6,7.,dl)*smoothstep(26.,12.,dl)*smoothstep(6.,30.,p.y);
  if(m<=0.) return 0.;
  float n=fbm3(p*vec3(.09,.16,.05)+vec3(0.,0.,uTime*.02));
  return m*smoothstep(.42,.72,n)*.35; }
// the old forest the staircase rises out of: tall conifers on a jittered 7 m grid, an oval glade around the foot of
// the stairs. Crowns are cones with branch whorls. Distances are conservative (cone x .6, capped by the gap to the
// trees outside the 3x3 neighbourhood) so the march never steps through a tree.
const float FC=7., FTOP=27.;
float tree(vec3 p, vec2 c, out float mat){
  mat=0.;
  float h1=hash12(c*1.31+7.7), h2=hash12(c*.77+2.3), h3=hash12(c+11.1);
  vec2 ctr=(c+.5+(vec2(h1,h2)-.5)*.6)*FC;
  vec2 gl=vec2(ctr.x/13., (ctr.y-8.)/54.);
  if(dot(gl,gl)<1.+.35*(h3-.5)) return 1e9;                          // the glade
  float hh=15.+12.*h3, R=min(hh*(.15+.06*h1),4.), yb=hh*(h2>.72? .2 : .03);
  vec3 q=vec3(p.x-ctr.x, p.y+.32, p.z-ctr.y);
  float r=length(q.xz);
  float u=clamp((q.y-yb)/(hh-yb),0.,1.);
  float wh=fract(u*(13.+6.*h2)+h1+.3*noise(vec3(q.xz*.7,c.x+c.y*7.)));   // many irregular whorls with drooping tips
  float clump=.74+.5*(.6*noise(p*vec3(2.4,3.,2.4)+h1*17.)+.4*noise(p*vec3(6.,4.,6.)));   // ragged branch ends
  float rr=R*pow(1.-u,1.1)*(.88+.12*smoothstep(0.,.9,wh))*clump+.08;
  float dc=max(max((r-rr)*.42, yb-q.y), q.y-hh);
  float dt=max(r-.28, q.y-yb-1.);
  if(dt<dc){ mat=1.; return dt; }
  return dc; }
float forest(vec3 p, out float mat, out float top){
  mat=0.; top=0.;
  if(p.y>FTOP) return p.y-FTOP+.5;
  vec2 c=floor(p.xz/FC); float d=4.2, m;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ float di=tree(p, c+vec2(float(i),float(j)), m); if(di<d){ d=di; mat=m; } }
  return d; }
float forestS(vec3 p){ float m, tp; return forest(p,m,tp); }
void main(){
  float jit=hash12(gl_FragCoord.xy+fract(uTime*3.17)*113.);
  vec3 ro=uCamPos-uV*jit, rd=camRay(gl_FragCoord.xy);
  vec3 L=normalize(vec3(0.,uA.x,uA.y));
  float s=max(dot(rd,L),0.);
  vec3 col=sky(rd,L);
  int NS=uD.z>.5? 220 : 140; float t=.05, kk, fm=0., ftp; bool hit=false, gnd=false, fst=false;
  for(int i=0;i<220;i++){ if(i>=NS) break; vec3 p=ro+rd*t; float d=map(p,kk), dg=p.y+.32, df=forest(p,fm,ftp);
    float dm=min(dg,df); if(dm<d){ d=dm; }
    if(d<.0007*t+.0005){ hit=true; gnd= dg<=d+1e-5; fst= !gnd && df<=d+1e-5; break; } t+=d*.9; if(t>2000.) break; }
  if(!hit && rd.y<0.){ float tg=-(ro.y-FTOP*.6)/rd.y; if(tg>0.){ hit=true; fst=true; fm=2.; t=tg; } }   // far canopy
  vec3 sunC=vec3(1.,.86,.64)*(1.5+uD.x*1.4);
  vec3 fogN=vec3(.010,.012,.018);
  if(hit && gnd){ vec3 p=ro+rd*t;                                   // the glade floor: moss and low grass
    float n1=fbm3(vec3(p.xz*.35,1.)), n2=fbm3(vec3(p.xz*2.1,4.));
    vec3 base=mix(vec3(.011,.014,.009), vec3(.024,.027,.016), n1)*(.7+.6*n2);
    float sh=softShadow(p+vec3(0.,.01,0.),L);
    vec3 c=base*(sunC*max(L.y,0.)*sh*.45+vec3(.03,.034,.05));
    c+=vec3(1.,.78,.5)*base*.5*exp(-length(p.xz-vec2(0.,2.))*.15)*(.35+.6*uD.x);          // the first steps light the moss
    float fogA=1.-exp(-t*.006); c=mix(c, fogN+vec3(1.,.8,.55)*pow(s,6.)*.06, fogA);
    col=c; }
  else if(hit && fst){ vec3 p=ro+rd*t;                              // conifers, black-green, warm where the light reaches
    vec3 n=vec3(0.,1.,0.);
    if(fm<1.5){ vec2 e=vec2(.004*t+.01,0.);
      n=normalize(vec3(forestS(p+e.xyy)-forestS(p-e.xyy), forestS(p+e.yxy)-forestS(p-e.yxy), forestS(p+e.yyx)-forestS(p-e.yyx))); }
    float ao=smoothstep(-.3,FTOP*.85,p.y);
    float tex=fbm3(p*vec3(2.2,3.5,2.2));
    vec3 base= fm>.5&&fm<1.5 ? vec3(.035,.026,.02)*(.7+.6*tex) : vec3(.016,.028,.02)*(.55+.9*tex);
    float dif=max(dot(n,L),0.)*(.3+.7*ao);
    vec3 Mn=normalize(vec3(-.6,.55,-.45));                                              // cool moonlight from behind-left
    vec3 c=base*(sunC*dif*.7+vec3(.025,.03,.045)*(.4+.6*max(n.y,0.))*(.4+.6*ao)+vec3(.55,.7,1.05)*max(dot(n,Mn),0.)*(.25+.75*ao));
    float fr=pow(1.-max(dot(n,-rd),0.),3.);
    c+=vec3(1.,.74,.44)*fr*dif*.04 + vec3(.012,.016,.026)*fr*(.3+.7*ao);                 // needle tips catch the light
    float fogA=1.-exp(-t*.0045);
    float hz=exp(-max(p.y,0.)*.12)*.5;                                                  // night mist pooled between the trees
    c=mix(c, fogN*1.6+vec3(1.,.8,.55)*pow(s,6.)*.05, clamp(fogA+hz*(1.-exp(-t*.02)),0.,1.));
    col=c; }
  else if(hit){ vec3 p=ro+rd*t; vec2 e=vec2(.0006*t+.0004,0.); float k2;
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
    c+=base*vec3(.16,.14,.12)*max(n.y,0.)*(1.-smoothstep(15.,260.,uCamPos.y));   // the dusk sky fills the treads near the ground
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

  const SR = 0.62, SRUN = 1.25, SWD = 1.7, KE = 60;       // same staircase proportions as chapter I
  // the climb starts on the ground, a few steps at walking pace, then ever faster: k(t) = -4 + V0 FT (e^{(t-30)/FT} - 1)
  const V0 = 1.2, FT = 3.36;
  const kAt = t => -4 + V0 * FT * (Math.exp((t - 30) / FT) - 1);
  const vAt = t => V0 * Math.exp((t - 30) / FT);
  function stairCam(t) {
    const kc = kAt(t), sway = Math.sin(t * 0.37) * 0.25;
    const pos = [2.35 + sway, Math.max(kc * SR + 1.75, 1.45), kc * SRUN];
    const ahead = 6 + 9 * smooth(30.5, 36, t);
    const at = [0.15, Math.max((kc + ahead) * SR + 0.9 - 1.6 * (1 - smooth(30.5, 36, t)), 0.4), (kc + ahead) * SRUN];
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
    const camB = stairCam(k - dt), v0 = sub(cam.pos, camB.pos), vl = Math.hypot(...v0), vel = mul3(v0, Math.min(1, 0.5 / Math.max(vl, 1e-6)));
    const swell = 0.25 + 0.75 * smooth(31, 44, k) + 2.2 * easeIn(clamp((k - 43) / 7));
    const haze = smooth(43.5, 49.6, k);
    const L = norm([0, SR, SRUN]);
    const sun = project(cam, add3(cam.pos, mul3(L, 1e4))), fx = sun ? sun[0] : W / 2, fy = sun ? sun[1] : H / 2;
    GL.frame({ name: "ch5_stairs", fs: SHADERS.ch5_stairs, scale: SC(0.55, 1.5),
      uniforms: { uTime: T, ...camUniforms(cam), uA: [SR, SRUN, SWD, 1], uD: [swell, haze, fin ? 1 : 0, 0], uV: vel } },
      { bloom: 0.5 + 0.4 * haze, thresh: 1.2, exposure: 1.0 + 0.5 * haze, rays: [fx / W, 1 - fy / H, 0.06 + 0.2 * smooth(38, 48, k)], letterbox: LB, vignette: 0.6 - 0.3 * haze,
        lift: Math.pow(smooth(45.5, 49.7, k), 1.6), t: T });
    o.save(); o.globalAlpha = smooth(29.0, 30.6, k); blit(); o.restore();
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
  // C. THE MANIFESTATION. Out of the white we are low over the night side of the Earth (radius 6371 km, centre at the
  // origin), rushing toward the dawn limb at hundreds of km/s: city lights and clouds stream beneath us. Beyond the
  // limb the being rises: a great eye 10,000 km across inside rings of eyes 40,000 km across. However fast we fly, it
  // hardly moves in the frame; that contrast is its size. Its eye opens in one long, smooth motion, blinks once,
  // slowly, and turns to us.
  // uA: eyeOpen, ringEyesOpen, core, -   uB: ringLight, gaze, -, pupil constriction   uC: entity xyz, scale
  // uD: planet light, city lights, quality, scene clock   uLook: rest gaze   uSock: socket direction   uEyeUp: lid frame up
  // uAnchor: origin (km) for the surface noise, on the flight path, so the finest octaves stay precise
  const ENT5 = `
uniform mat3 uRing[6]; uniform vec3 uSock; uniform vec3 uLook; uniform vec3 uEyeUp; uniform float uSpin[6];
const int NR=6;
const float EW=.1, EH=.04, RPL=6371., BT=.0075;
vec3 hash33(vec3 p3){ p3=fract(p3*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx)*2.-1.; }
float gnoise(vec3 p){ vec3 i=floor(p), f=fract(p), u=f*f*f*(f*(f*6.-15.)+10.);
  float a=dot(hash33(i),f), b=dot(hash33(i+vec3(1,0,0)),f-vec3(1,0,0)), c=dot(hash33(i+vec3(0,1,0)),f-vec3(0,1,0)), d=dot(hash33(i+vec3(1,1,0)),f-vec3(1,1,0));
  float e=dot(hash33(i+vec3(0,0,1)),f-vec3(0,0,1)), g=dot(hash33(i+vec3(1,0,1)),f-vec3(1,0,1)), h=dot(hash33(i+vec3(0,1,1)),f-vec3(0,1,1)), k=dot(hash33(i+vec3(1,1,1)),f-vec3(1,1,1));
  return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y),mix(mix(e,g,u.x),mix(h,k,u.x),u.y),u.z); }
float ringR(int i){ return 1.05+float(i)*0.3; }
float ringW(int i){ return .052+float(i)*.006; }
// a ring of the being: a band of metal like the hoop of an armillary sphere, BT thick, 2·ringW wide, edges bevelled
float sdBand(vec3 q, float R, float w){ vec2 d=abs(vec2(length(q.xz)-R, q.y))-vec2(BT,w); return min(max(d.x,d.y),0.)+length(max(d,0.))-.002; }
float mapE(vec3 p, out int id, out vec3 lp){ float d=1e9; id=-1;
  for(int i=0;i<NR;i++){ vec3 q=uRing[i]*p; float di=sdBand(q, ringR(i), ringW(i)); if(di<d){ d=di; id=i; lp=q; } }
  return d; }
vec3 calcN(vec3 p){ const vec2 k=vec2(1.,-1.); const float h=0.001; int i2; vec3 l2;
  return normalize(k.xyy*mapE(p+k.xyy*h,i2,l2)+k.yyx*mapE(p+k.yyx*h,i2,l2)+k.yxy*mapE(p+k.yxy*h,i2,l2)+k.xxx*mapE(p+k.xxx*h,i2,l2)); }
vec3 spaceCol(vec3 rd){ return stars(rd,.8)+nebula(rd, vec3(.018,.014,.035), vec3(.12,.075,.03))*.5; }
// what the being's polished surfaces mirror: the night planet with its lit crescent and thin air, and space
vec3 envRefl(vec3 ro, vec3 rd, vec3 E){
  float b=dot(ro,rd), cc=dot(ro,ro)-RPL*RPL, h=b*b-cc;
  if(h>0. && -b-sqrt(h)>0.){ vec3 p=ro+rd*(-b-sqrt(h)), n=normalize(p); float mu=dot(n,normalize(E-p));
    float lit=smoothstep(-.15,.25,mu);
    float lights=smoothstep(.62,.8,noise(n*70.))*smoothstep(.4,.7,noise(n*9.))*(1.-lit);
    return vec3(.004,.006,.012)+vec3(.6,.45,.32)*lit*max(mu+.1,0.)*.6*uD.x+vec3(1.,.55,.2)*lights*.5
           +vec3(.3,.5,1.)*pow(1.-max(dot(n,-rd),0.),4.)*.25*lit; }
  float tc=-b; vec3 pc=ro+rd*max(tc,0.); float hc=length(pc)-RPL;
  vec3 c=spaceCol(rd)*.6;
  if(tc>0.) c+=vec3(.4,.6,1.)*exp(-max(hc,0.)/25.)*.35*smoothstep(-.3,.2,dot(normalize(pc),normalize(E-pc)));
  return c; }
// one eye set into the outer face of a band; isEye: 1 = eye, .5 = its closed lid and bezel, 0 = metal
vec3 ringEye(vec3 lp, int id, vec3 camL, float face, out float isEye){
  isEye=0.; if(face<.7) return vec3(0);
  float R=ringR(id), th=atan(lp.z,lp.x)+uSpin[id];                                   // the band turns like a wheel
  float N=floor(9.+float(id)*4.); float cell=6.2831853/N; float k=floor(th/cell+.5); float u=(th-k*cell)*R;
  float kk=mod(k+N,N); float h=hash12(vec2(kk*1.37+3.1, float(id)*7.3+1.9));
  float o0=(float(id)+h*2.4)/7.6*.88; float op=smoothstep(o0,o0+.12,uA.y);
  float bt=uD.w-58.5-h*9.; op*=1.-.9*smoothstep(0.,.45,bt)*(1.-smoothstep(.6,1.4,bt));      // each eye blinks once, slowly, at its own time
  float eh=min(EH, ringW(id)*.75), w=lp.y, e=1.-(u*u)/(EW*EW); if(e<=0.) return vec3(0);
  float lid=eh*e*op;
  if(abs(w)>lid){ if(abs(w)<eh*e+.004) isEye=.5; return vec3(0); }
  isEye=1.; float sc=EW/.07;
  vec3 tU=normalize(vec3(-lp.z,0.,lp.x)), tW=vec3(0,1,0); vec3 toCam=normalize(camL-lp);
  vec2 lk=vec2(dot(toCam,tU), dot(toCam,tW))*0.026*sc*uB.y + vec2(sin(k*1.7+float(id))*.012, cos(k*2.3)*.006)*sc*(1.-uB.y);
  vec2 q=vec2(u,w)-lk; float d=length(q);
  vec3 c=vec3(.62,.56,.48)*(.45+.55*smoothstep(lid,0.,abs(w)));
  float ir=.021*sc, pr=.008*sc*(1.-.25*uB.y);
  if(d<ir){ float aa=atan(q.y,q.x); c=mix(vec3(2.,1.15,.38), vec3(.6,.26,.05), d/ir)*(.7+.3*noise(vec3(cos(aa)*7.,sin(aa)*7.,d/ir*3.))); }
  if(d<pr) c=vec3(.002);
  if(length(q-vec2(-.3,.35)*ir)<.16*ir) c=vec3(1.8);
  c+=vec3(1.4,1.,.55)*exp(-pow((op-.45)/.22,2.))*step(uD.w,60.);  // light spills from each eye as it first opens
  return c*(.3+.7*smoothstep(0.,.6,op)); }
// relief of the being's body: ridged fBm on the unit sphere, and thin fissures at every scale (fis)
float bodyH(vec3 n, float pf, out float fis){
  float s=0., a=.5, f=2.3; fis=0.;
  for(int i=0;i<7;i++){ float w=1.-smoothstep(.15,.45,pf*f); if(w<=0.) break;
    float g=gnoise(n*f+vec3(float(i)*3.7,1.3,-2.1)); float r=1.-abs(g)*2.2; s+=a*w*r*abs(r);
    if(i>0 && i<3){ vec3 nw=n*f*1.3+vec3(11.3,float(i)*5.9,7.7); nw+=.35*vec3(gnoise(nw*2.1),gnoise(nw*2.1+4.),gnoise(nw*2.1+9.));
      fis+=w*a*2.5*smoothstep(.984,.998,1.-abs(gnoise(nw))); }
    a*=.5; f*=2.13; }
  return s; }
// The great eye: a dark world (the being's body, its lids) parting around a living eyeball. The upper lid travels further
// than the lower and the opening is widest at the centre. pf = size of a pixel in eye radii; every fine detail fades by it.
vec3 greatEye(vec3 ro, vec3 rd, vec3 E, float S, float pxa, out float tHit){
  tHit=1e9; float R=0.66*S; vec3 oc=ro-E; float b=dot(oc,rd), c=dot(oc,oc)-R*R, h=b*b-c; if(h<0.) return vec3(-1.);
  tHit=-b-sqrt(h); vec3 p=ro+rd*tHit, n=normalize(p-E);
  float pf=tHit*pxa/R;
  vec3 f0=normalize(uSock);
  vec3 r0=normalize(cross(uEyeUp,f0)), u0=cross(f0,r0);
  float fx=dot(n,r0), fy=dot(n,u0), ff=dot(n,f0);
  float open=uA.x, prof=pow(max(1.-fx*fx/.7,0.),.75);
  float rag=1.+.07*gnoise(vec3(fx*7.,fy>0.? 1.:-1.,2.))+.03*gnoise(vec3(fx*23.,fy>0.? 3.:-3.,5.));   // the lid margins are rock, not a drawn line
  float aperU=.52*open*prof*rag, aperL=.36*open*prof*rag, aper=fy>0.? aperU : aperL;
  vec3 V=-rd;
  float glowIn=.25+.75*smoothstep(0.,.25,open);
  float wake=smoothstep(0.,.03,open)*(1.-smoothstep(.08,.5,open));              // light pours from the first slit
  // --- the body: dark basalt and old metal, mountain ridges, fissures glowing with the light inside it
  float fis, fis1, fis2;
  float dl=max(.003,pf*1.5);
  vec3 t1=normalize(cross(n,f0+vec3(.01,.02,.03))), t2=cross(n,t1);
  float h0=bodyH(n,pf,fis), h1=bodyH(normalize(n+t1*dl),pf,fis1), h2=bodyH(normalize(n+t2*dl),pf,fis2);
  vec3 nb=normalize(n-(t1*(h1-h0)+t2*(h2-h0))*(.04/dl));
  vec3 Lo=E+f0*R*.8, toO=Lo-p; float dO=length(toO)/R; toO=normalize(toO);
  float spill=(.9*smoothstep(0.,.25,open)+2.*wake)*(.4+.6*uB.x)/(1.+dO*dO*4.);   // light from the opening across the ground
  vec3 Le=normalize(-E);                                                           // the Earth, in front of and below it
  vec3 albB=mix(vec3(.025,.023,.021), vec3(.085,.07,.056), smoothstep(-.1,.5,h0));
  vec3 shell=albB*(vec3(1.,.7,.4)*max(dot(nb,toO),0.)*spill*6. + vec3(.3,.38,.5)*max(dot(nb,Le),0.)*1.2 + .012);
  float fb=.04+.96*pow(1.-max(dot(nb,V),0.),5.);
  shell+=envRefl(p,reflect(rd,nb),E)*fb*.5;
  shell+=vec3(1.5,.85,.32)*min(fis,1.)*.5*exp(-dO*2.6)*smoothstep(0.,.3,open)*(.4+.6*uB.x);   // rifts near the eye glow from inside
  shell+=vec3(1.,.72,.4)*pow(1.-max(dot(n,V),0.),3.)*.3*(.4+.6*uB.x);           // light wrapping round from behind it
  float de=abs(fy)-aper;                                                          // > 0 on the lid
  float edgeMask=smoothstep(.86,.6,abs(fx))*smoothstep(.2,.35,ff);
  float cliff=smoothstep(.05,0.,de)*step(0.,de)*edgeMask;                         // the inner wall of the lid, lit by the eye
  shell=mix(shell, vec3(1.2,.75,.38)*(.05+.1*smoothstep(.05,0.,de))*glowIn*(.3+.7*uB.x), cliff*.7);
  float seam=exp(-pow(de/max(.004,pf*1.2),2.))*edgeMask;
  shell+=vec3(1.6,1.1,.55)*seam*(.08+1.4*smoothstep(0.,.06,open)*(1.-smoothstep(.3,.9,open))+2.5*wake)*(.5+.5*uB.x);
  if(ff<.25 || fy>aperU || fy<-aperL) return shell;
  // --- the eyeball
  vec3 g=normalize(mix(normalize(uLook), normalize(uCamPos-E), uB.y));
  float ang=acos(clamp(dot(n,g),-1.,1.));
  vec3 ax=normalize(cross(g,u0)), ay=cross(ax,g); float a=atan(dot(n,ay),dot(n,ax)); vec2 pc=vec2(cos(a),sin(a));
  float lidOcc=smoothstep(0.,max(aper*.6,.01),aper-abs(fy));                    // the lids shade the globe near their edge
  // sclera: wet ivory, warmer and darker toward the corners; fine vessels run in from the corners
  float vsF=1.-smoothstep(.002,.008,pf);
  float vs=pow(1.-abs(2.*noise(vec3(pc*3.,ang*7.)+.7*noise(vec3(pc*9.,ang*18.+4.)))-1.),14.)*smoothstep(.55,1.15,ang);
  vec3 Lk=normalize(u0*.8+normalize(uCamPos-E)*.6+r0*.25);                       // a soft key from above: the globe reads round
  float shade=.3+.7*max(dot(n,Lk),0.);
  float corner=smoothstep(.35,.85,abs(fx));
  vec3 scl=mix(vec3(.5,.43,.35), vec3(.72,.64,.53), smoothstep(1.2,.5,ang))*(.86+.14*fbm(n*14.));
  scl=mix(scl, vec3(.56,.3,.26), corner*.45);                                      // warmer, pinker toward the corners
  scl=mix(scl, vec3(.5,.17,.12), vs*.6*vsF);
  vec3 col=scl*shade*(.16+.84*lidOcc)*.42*glowIn;
  // iris: luminous stroma in three layers of radial fibres, a collarette, crypts, contraction furrows, a dark limbal ring
  float irisA=.42, pupA=mix(.27,.16,uB.w);
  if(ang<irisA+.03){
    float r=(ang-pupA)/(irisA-pupA);
    float da=pf/max(sin(ang),.03);                                               // angular size of a pixel here
    float w1=1.-smoothstep(.25,.6,da*7.2), w2=1.-smoothstep(.25,.6,da*22.), w3=1.-smoothstep(.25,.6,da*67.);
    float fib=.5+(noise(vec3(pc*7.2,r*2.5))-.5)*1.1*w1+(noise(vec3(pc*22.,r*5.+3.))-.5)*.8*w2+(noise(vec3(pc*67.,r*9.+7.))-.5)*.6*w3;
    float cr=exp(-pow((r-.34-.05*(noise(vec3(pc*8.,1.))-.5))/.045,2.));
    float crypt=smoothstep(.66,.8,noise(vec3(pc*9.,r*4.+3.)))*smoothstep(.12,.3,r)*smoothstep(.8,.5,r);
    float fur=pow(.5+.5*sin(r*46.+noise(vec3(pc*5.,2.))*4.),6.)*smoothstep(.55,.9,r)*(1.-smoothstep(.2,.5,pf*46./(irisA-pupA)));
    vec3 inner=vec3(1.9,1.1,.32), outer=vec3(.75,.33,.08), deep=vec3(.16,.06,.015);
    vec3 ic=mix(inner, outer, smoothstep(.15,.8,r))*(.4+1.2*(fib-.5)+.6);
    ic=mix(ic, deep, crypt*.75); ic+=vec3(2.,1.3,.5)*cr*.35; ic*=1.-.4*fur;
    ic*=1.-.9*smoothstep(.76,1.02,r);
    ic=mix(ic, vec3(.03,.012,.005), smoothstep(.07,0.,r)*.9);
    col=mix(col, ic*(.6+.4*shade)*(.35+.65*lidOcc)*glowIn, smoothstep(irisA+.02, irisA-.01, ang));
  }
  if(ang<pupA) col=vec3(.0006)+spaceCol(reflect(rd,n))*.08;                      // the pupil: a way into the dark
  // cornea: a clear wet dome over all of it, mirroring the world and the sky
  float fres=.03+.97*pow(1.-max(dot(n,V),0.),5.);
  vec3 envC=envRefl(p, reflect(rd,n), E);
  col=col*(1.-fres*.5)+envC*(fres*1.6+.035);
  col+=vec3(1.2,1.,.8)*exp(-pow((aper-abs(fy))/max(.004,pf*1.5),2.))*.18*glowIn;  // tear film along the lid edge
  col+=vec3(2.6,1.8,.95)*wake*(.6+.4*smoothstep(aper,0.,abs(fy)));
  return col; }
bool marchEntity(vec3 ro, vec3 rd, vec3 E, float S, float tEye, float pxa, out vec3 ent, out float tEnt){
  ent=vec3(0); tEnt=1e9; vec3 oc=ro-E; float b=dot(oc,rd), c=dot(oc,oc)-pow(2.9*S,2.), h=b*b-c; if(h<=0.) return false;
  float t0=max(-b-sqrt(h),0.), t1=-b+sqrt(h); float t=t0; int id; vec3 lp; bool hit=false;
  for(int i=0;i<160;i++){ vec3 p=(ro+rd*t-E)/S; float d=mapE(p,id,lp)*S;
    if(d<0.0005*t){ hit=true; tEnt=t; break; } t+=max(d*0.85, 0.00025*t); if(t>t1 || t>tEye) break; }
  if(!hit) return false;
  vec3 p=(ro+rd*tEnt-E)/S; vec3 n=calcN(p);
  mat3 M=uRing[id]; vec3 nL=M*n;
  float rr=length(lp.xz); vec3 radial=vec3(lp.x,0.,lp.z)/max(rr,1e-4);
  float face=dot(nL,radial);                                                      // +1 outer face, -1 inner face, 0 on the edges
  float th=atan(lp.z,lp.x)+uSpin[id], R=ringR(id), w=ringW(id), ay=abs(lp.y);
  float pfE=tEnt*pxa/S, lw=max(.0011,pfE*1.1);
  // engraving: grooves along the edges, a scale of graduations (every degree, longer every fifth), and the seams where
  // the segments of the band are joined (every ten degrees). It fades out where it would be finer than a pixel.
  float deg=th*57.29578;
  float groove=exp(-pow((ay-w*.7)/lw,2.))+.8*exp(-pow((ay-w*.92)/lw,2.));
  float d1=abs(fract(deg+.5)-.5)/57.29578*R, d5=abs(fract(deg/5.+.5)-.5)*5./57.29578*R, d10=abs(fract(deg/10.+.5)-.5)*10./57.29578*R;
  float side=step(0.,lp.y);                                                        // the scale runs along one edge only
  float tick=(exp(-pow(d1/lw,2.))*step(w*.74,ay)*step(ay,w*.8)+exp(-pow(d5/lw,2.))*step(w*.74,ay)*step(ay,w*.86))*side;
  float engr=clamp(groove*.7+tick*.8,0.,1.)*(1.-smoothstep(.002,.007,pfE))*step(.7,abs(face));
  float ham=.88+.24*noise(vec3(th*R*180.,lp.y*180.,float(id)*3.));
  vec3 metal=mix(vec3(.30,.18,.09), vec3(.80,.55,.24), .55+.45*noise(vec3(th*R*9.,lp.y*20.,float(id))))*ham*(1.-.65*engr);
  vec3 V=-rd, Lc=normalize(-p);
  float diff=max(dot(n,Lc),0.), lit=uB.x/(1.+dot(p,p)*.08), fres=.04+.96*pow(1.-max(dot(n,V),0.),5.);
  vec3 tWd=transpose(M)*normalize(vec3(-lp.z,0.,lp.x));                           // brushed along the band
  vec3 hc=normalize(Lc+V); float tH=dot(tWd,hc); float aniso=pow(sqrt(max(1.-tH*tH,0.)),160.)*smoothstep(0.,.2,dot(n,Lc));
  vec3 envW=envRefl(ro+rd*tEnt, reflect(rd,n), E);
  float earthF=max(dot(n,normalize(-E)),0.);
  // metal: little diffuse light, most of it in the brushed highlight and in what it mirrors
  ent=metal*(diff*.16*lit+earthF*.03+.002) + metal*aniso*2.2*lit*(1.-.6*engr) + metal*envW*(.12+fres*1.6) + metal*fres*.06*uB.x;
  float isEye; vec3 camL=M*((uCamPos-E)/S); vec3 ec=ringEye(lp,id,camL,face,isEye);
  if(isEye>.75) ent=ec*(.75+.5*diff); else if(isEye>.25) ent*=.45;
  return true; }
`;
  SHADERS.ch5_orbit = COMMON + `uniform vec4 uD; uniform vec3 uAnchor; uniform vec4 uVel;\n` + ENT5 + `
const float RP=6371.;
const vec3 TAU0=vec3(.045,.10,.24);                    // vertical optical depth of the air (red, green, blue)
// fBm in kilometres: first wavelength L0, n octaves; an octave finer than the pixel footprint fw (km) fades to its mean,
// so nothing shimmers while the ground streams past
float fbmK(vec3 q, float L0, int n, float fw, float gain){
  float s=0., a=1., nrm=0., f=1./L0;
  for(int i=0;i<13;i++){ if(i>=n) break; float w=1.-smoothstep(.25,.6,fw*f);
    if(w>0.) s+=a*w*gnoise(q*f+vec3(float(i)*17.3,float(i)*5.1,float(i)*11.7));
    nrm+=a; a*=gain; f*=2.03; }
  return s/nrm*2.2; }
float airmass(float c){ c=clamp(c,0.,1.); float z=acos(c)*57.29578; return 1./(c+.50572*pow(max(96.07995-z,.01),-1.6364)); }
// The Earth from low orbit, mostly at night. p on the sphere, fw = pixel footprint in km. cl returns cloud cover.
vec3 earth(vec3 p, vec3 n, vec3 rd, float fw, vec3 E, float S, out float cl){
  vec3 q=p-uAnchor;
  vec3 Ld=normalize(E-p); float mu=dot(n,Ld);
  float src=clamp(.66*S/length(E-p),.03,.35);
  float lit=smoothstep(-src*.5,src,mu);                                    // a source this large casts a wide penumbra
  float cont=fbmK(q+vec3(3100.,-900.,2000.),3000.,12,fw,.52)+.12*exp(-dot(q,q)/6.8e6);   // land under our path
  float land=smoothstep(.03,.07,cont), coast=exp(-pow((cont-.05)/.06,2.));
  // weather: large warped systems with fine billows, drifting
  vec3 qc=q+vec3(uD.w*5.,0.,uD.w*2.);
  vec3 wv=vec3(fbmK(qc,2600.,3,fw,.5), fbmK(qc+vec3(41.,7.,3.),2600.,3,fw,.5), fbmK(qc+vec3(9.,33.,17.),2600.,3,fw,.5));
  float cd=fbmK(qc+wv*900.,1500.,12,fw,.56);
  cl=smoothstep(0.,.42,cd-.06);
  vec3 tL=normalize(Ld-n*mu+vec3(1e-4));
  float cd2=fbmK(qc+wv*900.+tL*5.,1500.,12,fw,.56);
  float relief=clamp((cd2-cd)*22.,-1.,1.);                                  // billow faces toward the light
  vec3 sunT=mix(vec3(1.,.34,.1), vec3(1.,.86,.68), smoothstep(0.,.35,mu));
  vec3 Lc=sunT*uD.x*.32*lit;                                                 // it lights the world like a strong moon, not a sun
  float veg=fbmK(q+vec3(-700.,300.,90.),500.,9,fw,.55);
  vec3 alb=mix(vec3(.008,.016,.03), mix(vec3(.05,.065,.035), vec3(.2,.16,.1), smoothstep(-.2,.4,veg)), land);
  vec3 c=alb*Lc*max(mu+.08,0.)*(1.-cl*.9);
  vec3 hv=normalize(Ld-rd); float sp=max(dot(n,hv),0.); float fr=.02+.98*pow(1.-max(dot(n,-rd),0.),5.);
  c+=Lc*(pow(sp,140.)*3.5+pow(sp,16.)*.22)*fr*(1.-land)*(1.-cl);           // the glint of the being on the sea
  float cLit=clamp(.55+.45*relief,0.,1.)*(.35+.65*smoothstep(-.1,.3,mu+.1));
  c=mix(c, vec3(.78,.77,.75)*Lc*max(mu+.12,0.)*cLit*1.2, cl);
  // night: city lights in coastal sprawl, towns, the faint threads of highways; cloud dims and spreads them
  float night=1.-.6*smoothstep(-.05,.25,mu);
  float pop=smoothstep(.05,.6,fbmK(q+vec3(55.,90.,-40.),900.,3,fw,.5)+.45*coast+.3*exp(-dot(q,q)/2.e6))*land;   // lights streaming beneath us
  float metro=smoothstep(.55,1.,pop)*smoothstep(.2,.65,fbmK(q+vec3(12.,-8.,30.),45.,8,fw,.6));        // city cores, a few tens of km
  float sub=smoothstep(.3,.8,pop)*smoothstep(.05,.55,fbmK(q+vec3(-31.,6.,2.),12.,6,fw,.6));          // grainy suburbs
  float town=pow(smoothstep(.5,.9,fbmK(q+vec3(-3.,4.,7.),5.,5,fw,.6)+.45*pop-.25),2.);              // villages: scattered points
  float hwW=.006+fw/90.; float hw=exp(-pow(gnoise(q/90.+vec3(3.,1.,2.))/hwW,2.))*(.006/hwW)*smoothstep(.1,.45,pop);
  vec3 lights=vec3(1.,.5,.18)*(metro*1.1+sub*.45+town*.8+hw*.3)+vec3(.95,.85,.72)*metro*.7;
  c+=lights*night*uD.y*(1.-cl*.85)*land;
  c+=vec3(1.,.55,.25)*cl*smoothstep(.2,.7,pop)*.04*night*uD.y;              // city glow on the undersides of cloud
  c+=vec3(.007,.010,.018)*(.3+cl*2.2)*night;                                 // starlight and airglow: night clouds read faint blue-grey
  return c; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 E=uC.xyz; float S=uC.w;
  float pxa=1./(uFov*uRes.y);
  float mie=pow(max(dot(rd,normalize(E-ro)),0.),10.);
  vec3 bg=spaceCol(rd)*.7, atm=vec3(0), trans=vec3(1);
  vec3 col=bg;
  float tP=1e9; float b=dot(ro,rd), c=dot(ro,ro)-RP*RP, h=b*b-c;
  if(h>0. && -b-sqrt(h)>0.){ float t=-b-sqrt(h); tP=t; vec3 p=ro+rd*t, n=normalize(p);
    float cz=max(dot(n,-rd),0.), fw=t*pxa/sqrt(max(cz,.03));
    float cl; vec3 s=earth(p,n,rd,fw,E,S,cl);
    float muP=dot(n,normalize(E-p));
    vec3 Tr=exp(-TAU0*airmass(cz));
    vec3 sunT=mix(vec3(1.,.3,.08), vec3(1.,.86,.66), smoothstep(-.05,.35,muP));
    vec3 inS=(1.-Tr)*sunT*uD.x*.22*smoothstep(-.15,.2,muP)*(.5+1.5*mie);
    float ag=min(1./max(cz,.02),45.)*.0005;
    col=s*Tr+inS+vec3(.25,1.,.42)*ag*(1.-.7*smoothstep(-.1,.2,muP));
  } else {
    float tc=-b; vec3 pc=ro+rd*max(tc,0.); float hc=length(pc)-RP;
    if(tc>0. && hc<300.){ vec3 nc=normalize(pc); float muc=dot(nc,normalize(E-pc));
      vec3 tauT=TAU0*79.*exp(-max(hc,0.)/8.);
      trans=exp(-tauT);
      float litc=smoothstep(-.2,.15,muc);
      vec3 sunC=mix(vec3(1.,.28,.07), vec3(1.,.86,.66), smoothstep(-.05,.3,muc));
      atm=(1.-trans)*sunC*litc*uD.x*.35*(.5+2.5*mie);
      atm+=vec3(.25,1.,.42)*exp(-pow((hc-95.)/5.,2.))*.02*(1.-.7*litc);     // airglow, a thin green shell seen edge-on
    }
  }
  float tEye; vec3 eye=greatEye(ro,rd,E,S,pxa,tEye);
  vec3 ent; float tEnt; bool entHit=marchEntity(ro,rd,E,S,min(tEye,tP),pxa,ent,tEnt);
  if(eye.x>=0. && tEye<tEnt && tEye<tP){ ent=eye; tEnt=tEye; entHit=true; }
  if(tP>1e8) col=(entHit? ent : bg)*trans+atm;
  else if(entHit && tEnt<tP) col=ent;
  // corona and halo of the core: light that seeps around the great eye, dimmed and reddened by the limb
  vec3 oc=ro-E; float tcE=-dot(oc,rd); float dmin=length(oc+rd*tcE);
  float behind=(tP<1e8 && tP<tcE)? 0. : 1.;
  float occl=(entHit && tEnt<tcE)? 0. : 1.;
  float Re=.66*S;
  float corona=exp(-max(dmin-Re,0.)/(.018*S))*step(Re*.998,dmin);
  float x=max(dmin-Re,0.)/S;
  float halo=exp(-x/.1)*.22+exp(-x/.5)*.03;
  col+=vec3(1.,.8,.52)*(corona*1.2+halo)*uA.z*behind*occl*trans;
  // its wake: a faint glow along the path it has just covered (uVel.xyz = the way it came, uVel.w = length in km);
  // it fades as the thing slows to rest
  if(uVel.w>1.){ vec3 a=E, ab=uVel.xyz*uVel.w, w0=a-ro;
    float A2=dot(ab,ab), B2=dot(ab,rd), D2=dot(ab,w0), E2=dot(rd,w0);
    float s=clamp((B2*E2-D2)/max(A2-B2*B2,1e-3),0.,1.), t=max(dot(a+ab*s-ro,rd),0.);
    float d=length(a+ab*s-(ro+rd*t));
    float vis=(tP<t || (entHit && tEnt<t))? 0. : 1.;
    float wake=exp(-d/(.2*S))*pow(1.-s,1.6)*smoothstep(.05,.3,s);
    col+=vec3(1.,.76,.45)*wake*.26*min(uVel.w/20000.,1.)*vis*trans; }
  fragColor=vec4(col,1.); }`;

  // geometry: the being comes to rest 80,000 km from the Earth's centre; we fly a low arc over the night side toward it.
  // D0 = angle, seen from the centre, between us and its resting place at k = 50; DA = how far round we travel.
  // A slightly wide lens keeps the streaming ground in the lower frame.
  const RPL = 6371, OFOV = 1.05, OS = 18000;             // great eye radius 0.66·OS ≈ 11,900 km (bigger than the Earth)
  const RAD = Math.PI / 180, PHI_E = 89 * RAD;
  const E_END = [6000, 80000 * Math.cos(PHI_E), 80000 * Math.sin(PHI_E)];
  // It is moving. Out of the white it glides in from the right at ~5,000 km/s and coasts to rest by 64 s, where it turns
  // its eye on us. On screen that is a slow drift across a third of the frame: the bigger a thing is, the slower it seems.
  // Its light on the sea and along the limb slides with it, which gives the real speed away.
  const E_OFF = [-42000, 0, 20000], E_STOP = 64;
  const beingPos = k => add3(E_END, mul3(E_OFF, Math.pow(1 - clamp((k - 50) / (E_STOP - 50)), 2)));
  const TRACK = 0.22;                                    // the camera follows it only a little, so it drifts across the frame
  const D0 = 104, DA = 12, TAU_F = 6.5, H0 = 320, H1 = 520;
  function flight(k) {                                   // a rush out of the white that settles into a glide
    const s = (1 - Math.exp(-(k - 50) / TAU_F)) / (1 - Math.exp(-20 / TAU_F));
    const phi = PHI_E - (D0 - DA * s) * RAD, rc = RPL + H0 + (H1 - H0) * smooth(50, 70, k);
    return [0, rc * Math.cos(phi), rc * Math.sin(phi)];
  }
  function orbitCam(k) {                                 // aimed below the being so it rises from the limb to the upper frame
    const pos = flight(k), up = norm(pos), aim = add3(E_END, mul3(sub(beingPos(k), E_END), TRACK)), toA = norm(sub(aim, pos));
    const right = norm(cross(toA, up)), upv = cross(right, toA);
    const d = Math.atan(lerp(0.12, 0.17, smooth(50, 64, k)) / OFOV);
    return { pos, fwd: norm(add3(mul3(toA, Math.cos(d)), mul3(upv, -Math.sin(d)))), up, fov: OFOV };
  }
  const ANCHOR = mul3(norm(flight(57)), RPL);
  const REST_LOOK = norm([0.55, -0.25, -0.8]);           // while it travels it looks ahead and down, at the world
  // the bands tumble slowly (RING_RATE) and each turns about its own axis like a wheel, alternate ones the other way, so
  // the eyes set in them travel along them. Phase searched with the glide: no band crosses the pupil while the eye is open.
  const RING_PHASE5 = 1336.4, RING_RATE = 0.3;
  const SPIN = [0.05, -0.042, 0.036, -0.03, 0.026, -0.022];
  const spins = k => SPIN.map(w => (k - 50) * w);
  // where every ring eye sits and when it opens (mirrors the shader), for the light that blooms as each one wakes
  const hash12 = (x, y) => { let a = (x * .1031) % 1, b = (y * .1031) % 1, c = (x * .1031) % 1; if (a < 0) a += 1; if (b < 0) b += 1; if (c < 0) c += 1;
    const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33); a += d; b += d; c += d; const v = ((a + b) * c) % 1; return v < 0 ? v + 1 : v; };
  const EYES = (() => { const a = []; for (let id = 0; id < 6; id++) { const N = Math.floor(9 + id * 4), R = 1.05 + id * 0.3;
    for (let kk = 0; kk < N; kk++) { const h = hash12(kk * 1.37 + 3.1, id * 7.3 + 1.9); a.push({ id, th: kk * 2 * Math.PI / N, R, o0: (id + h * 2.4) / 7.6 * 0.88 }); } } return a; })();
  function eyeBlooms(k, cam, rings, E, sp) {
    const ro = clamp((k - 51) / 7.2);
    o.save(); o.globalCompositeOperation = "lighter";
    for (const e of EYES) {
      const u = (ro - e.o0) / 0.12; if (u < 0.15 || u > 2.5) continue;
      const th = e.th - sp[e.id];
      const M = rings.slice(e.id * 9, e.id * 9 + 9), q = [e.R * Math.cos(th), 0, e.R * Math.sin(th)];
      const w = [M[0] * q[0] + M[1] * q[1] + M[2] * q[2], M[3] * q[0] + M[4] * q[1] + M[5] * q[2], M[6] * q[0] + M[7] * q[1] + M[8] * q[2]];  // ring -> world (transpose)
      const Pw = add3(E, mul3(w, OS)), dv = sub(Pw, cam.pos), dl = Math.hypot(...dv), rv = mul3(dv, 1 / dl);
      const pb = dot(cam.pos, rv), ph = pb * pb - (dot(cam.pos, cam.pos) - RPL * RPL);
      if (ph > 0 && -pb - Math.sqrt(ph) > 0 && -pb - Math.sqrt(ph) < dl) continue;          // behind the Earth
      const P = project(cam, Pw); if (!P || P[1] < BAR || P[1] > H - BAR) continue;
      const a = Math.exp(-Math.pow((u - 0.55) / 0.45, 2)) * 0.6;
      const g = o.createRadialGradient(P[0], P[1], 0, P[0], P[1], 60); g.addColorStop(0, `rgba(255,236,200,${a})`); g.addColorStop(0.25, `rgba(255,190,110,${a * 0.45})`); g.addColorStop(1, "rgba(255,160,80,0)");
      o.fillStyle = g; o.beginPath(); o.arc(P[0], P[1], 60, 0, 7); o.fill();
    }
    o.restore();
  }
  // Something the size of a world does not move quickly. The great eye opens in one long, smooth motion (slow to start,
  // slow to settle), blinks once, slowly, in the silence, and only then turns to us. No steps, no jolts.
  const sm5 = u => { u = clamp(u); return u * u * u * (u * (u * 6 - 15) + 10); };
  function lidOpen(k) {
    const o1 = sm5((k - 55.2) / 6.6);                                   // 55.2 → 61.8
    const blink = sm5((k - 62.1) / 1.0) * (1 - sm5((k - 63.25) / 1.45)); // closes 62.1–63.1, opens 63.25–64.7
    return o1 * (1 - 0.97 * blink);
  }
  function orbitFrame(k, T) {
    const fin = FINAL(), N = fin ? 5 : 1, SHUT = 0.5 / 24;        // several sub-frames over a 180° shutter: true motion blur
    const eyeOpen = lidOpen(k);
    const pupil = sm5((k - 57.5) / 5.5);
    const slit = smooth(55.4, 56.8, k) * (1 - smooth(58, 61, k));
    const gaze = sm5((k - 64.3) / 2.8);
    const ringOpen = clamp((k - 51) / 7.2);
    const core = 1.0 + 0.6 * eyeOpen;
    const ringLight = 0.75 + 0.35 * smooth(50, 52, k) + 0.3 * eyeOpen;
    const flash = 1 - smooth(50, 52.6, k);
    for (let i = 0; i < N; i++) {
      const kt = k + ((i + 0.5) / N - 0.5) * SHUT;
      const cam = orbitCam(kt), E = beingPos(kt);
      const vel = mul3(sub(beingPos(kt + 0.05), beingPos(kt - 0.05)), 10), speed = Math.hypot(...vel);       // km/s
      const wake = speed > 1 ? [...mul3(vel, -1 / speed), speed * 4] : [0, 0, 0, 0];                            // the last 4 s of its path
      const toCam = norm(sub(cam.pos, E));
      const sock = norm(add3(mul3(norm(add3(toCam, REST_LOOK)), 1 - gaze), mul3(toCam, gaze * 1.0001)));
      const r = norm(cross(cam.fwd, cam.up)), eyeUp = cross(r, cam.fwd);
      const q = project(cam, E), rx = q ? q[0] / W : 0.5, ry = q ? 1 - q[1] / H : 0.5;
      GL.frame({ name: "ch5_orbit", fs: SHADERS.ch5_orbit, scale: SC(0.55, 1.35),
        uniforms: { uTime: 405 + kt, ...camUniforms(cam), uA: [eyeOpen, ringOpen, core, 0], uB: [ringLight, gaze, 0, pupil], uC: [...E, OS],
          uD: [1.0 + 0.7 * eyeOpen, 1.0, fin ? 1 : 0, kt], uRing: heavensRings(RING_PHASE5 + (kt - 50) * RING_RATE), uSpin: { float: spins(kt) },
          uSock: sock, uLook: REST_LOOK, uEyeUp: eyeUp, uAnchor: ANCHOR, uVel: wake } },
        { bloom: 0.45 + 0.4 * flash + 0.15 * slit, thresh: 1.4, exposure: 1.0 + 0.6 * flash, rays: [rx, ry, 0.06 + 0.04 * eyeOpen + 0.25 * slit], letterbox: window.CLEAN ? 0 : LB, vignette: 0.6,
          lift: 0.75 * Math.pow(flash, 2.2), fade: 1 - smooth(69.2, 70, k), t: T });
      o.save(); o.globalAlpha = 1 / (i + 1); blit(); o.restore();
    }
    pic(() => eyeBlooms(k, orbitCam(k), heavensRings(RING_PHASE5 + (k - 50) * RING_RATE), beingPos(k), spins(k)));
  }

  // =====================================================================================================
  function captions(k) {
    const fadeEnd = 1 - smooth(69.2, 70, k);
    caption(k, 8.0, 13.0, (a, u) => capB("*AI*가 *AI*를 개선한다", a, u, { slam: true, size: 150 }));
    caption(k, 14.5, 20.5, (a, u) => capB("더 똑똑해진 AI가, *더 빨리* 개선한다", a, u));
    caption(k, 22.0, 28.0, (a, u) => capB("그 속도는 *멈추지 않는다*", a, u, { slam: true, size: 150 }));
    caption(k, 31.0, 36.8, (a, u) => capB("“지금 살아 있는 사람 대부분이, *원하는 만큼 오래* 살게 될 것이다”", a, u));
    caption(k, 39.2, 45.0, (a, u) => capB("— 다리오 아모데이, 「Machines of Loving Grace」, 2024", a, u, { size: 34, color: GOLD }));
    caption(k, 64.3, 67.1, (a, u) => capB("*1~2년* 안에", a, u, { slam: true, y: H * 0.76, size: 160 }));
    caption(k, 67.1, 70.0, (a, u) => capB("그것이 *우리를* 바라본다면", a * fadeEnd, u, { slam: true, y: H * 0.76, size: 130 }));
  }
  function asiTitle(k) {                                 // the name, huge, slammed onto the frame on the tutti
    if (window.CLEAN || window.NOCAP || k < 50.6 || k > 58.4) return;
    const saved = CAP; CAP = { t: k, t0: 50.6, t1: 58.4 };
    typeset("*ASI*", { size: 330, y: H * 0.52, slam: true, track: 0.18, back: 0.55 });
    CAP = saved;
  }
  chapter("ch5", 70, (k, T) => {
    if (k < 30.6) spiralFrame(k, T);                       // the spiral dissolves into the foot of the staircase
    if (k >= 29.0 && k < 50) stairFrame(k, T);
    if (k >= 50) orbitFrame(k, T);
    chapterCard(k, "V", "폭발");
    asiTitle(k);
    captions(k);
  });
})();
