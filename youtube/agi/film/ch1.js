// 「인류의 마지막 발명」 ch1 · I 세 개의 단어 (film 47–113, 66 s)
// 0–6 card over black glass · 6–18 narrow AI: marble knight on an endless obsidian board · 18–34 AGI: armillary of human thought
// 34–54 ASI: the intelligence staircase into light · 54–66 three lights, the second ignites.
(() => {
// ---------------------------------------------------------------- shared GLSL
const LIB = `
uniform float uQ;
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float smin(float a, float b, float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float schlick(float c, float f0){ return f0+(1.-f0)*pow(1.-clamp(c,0.,1.),5.); }
// ACES-friendly warm palette
const vec3 WARM=vec3(1.,.78,.5), GOLDC=vec3(1.,.74,.36);
`;

// ---------------------------------------------------------------- A. obsidian board + marble knight
// uA: beam intensity, pool radius, rim light, knight visible   uB: horizon glow, haze density, -, knight yaw
// uD: light pos xyz (beam aims at the knight base), card darkness
// Knight head profile (facing +x), control points of a closed Catmull-Rom curve; repeated points keep the ear tip and nose crisp.
const KCTRL = [[-0.19, -0.03], [-0.215, 0.10], [-0.205, 0.22], [-0.172, 0.33], [-0.125, 0.425], [-0.075, 0.495], [-0.05, 0.56], [-0.018, 0.645], [-0.018, 0.645],
  [0.022, 0.588], [0.07, 0.552], [0.15, 0.505], [0.225, 0.435], [0.285, 0.36], [0.322, 0.295], [0.336, 0.24], [0.336, 0.24], [0.312, 0.196], [0.262, 0.168],
  [0.195, 0.152], [0.14, 0.158], [0.1, 0.176], [0.084, 0.14], [0.104, 0.065], [0.15, -0.03], [0.15, -0.03]];
function catmull(P, sub) {
  const n = P.length, outp = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    if (p1[0] === p2[0] && p1[1] === p2[1]) continue;
    for (let s2 = 0; s2 < sub; s2++) { const t = s2 / sub, t2 = t * t, t3 = t2 * t;
      outp.push([0, 1].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
  }
  return outp;
}
const KHEAD = catmull(KCTRL, 2);
const KBASE = [[0, 0], [0.30, 0], [0.312, 0.014], [0.312, 0.04], [0.292, 0.06], [0.256, 0.074], [0.246, 0.098], [0.262, 0.112], [0.256, 0.13],
  [0.216, 0.14], [0.2, 0.158], [0.212, 0.172], [0.19, 0.19], [0, 0.19]];
const glslArr = (name, a) => `const vec2 ${name}[${a.length}]=vec2[${a.length}](${a.map(([x, y]) => `vec2(${x.toFixed(4)},${y.toFixed(4)})`).join(",")});`;
const polyFn = (fn, arr, n) => `float ${fn}(vec2 p){ float d=dot(p-${arr}[0],p-${arr}[0]); float s=1.;
  for(int i=0, j=${n - 1}; i<${n}; j=i, i++){ vec2 e=${arr}[j]-${arr}[i], w=p-${arr}[i]; vec2 b=w-e*clamp(dot(w,e)/dot(e,e),0.,1.); d=min(d,dot(b,b));
    bvec3 c=bvec3(p.y>=${arr}[i].y, p.y<${arr}[j].y, e.x*w.y>e.y*w.x); if(all(c)||all(not(c))) s*=-1.; }
  return s*sqrt(d); }`;

const KNIGHT = `
${glslArr("KH", KHEAD)}
${glslArr("KB", KBASE)}
${polyFn("sdHeadP", "KH", KHEAD.length)}
float sdHead(vec2 p){ vec2 c=vec2(0.06,0.31), b=vec2(0.29,0.36); vec2 q=abs(p-c)-b; float bd=length(max(q,0.)); if(bd>0.04) return bd; return sdHeadP(p); }
${polyFn("sdBaseP", "KB", KBASE.length)}
const float KS=1.18;                    // knight scale (board squares are 1 unit)
vec3 kLocal(vec3 p){ vec3 q=(p)/KS; q.xz=rot(uB.w)*q.xz; return q; }
float mapK(vec3 p){
  vec3 q=kLocal(p);
  float r=length(q.xz);
  float base=sdBaseP(vec2(r,q.y))-0.003;
  vec3 h=q-vec3(0.,0.17,0.);
  float d2=sdHead(h.xy);
  float th=0.076-0.03*smoothstep(0.12,0.34,h.x)+0.012*smoothstep(0.25,0.0,h.y)-0.016*smoothstep(0.5,0.65,h.y);
  float mane=smoothstep(0.06,0.0,-d2)*smoothstep(0.03,-0.06,h.x)*smoothstep(0.1,0.2,h.y)*smoothstep(0.6,0.5,h.y)*pow(0.5+0.5*sin(h.y*110.-h.x*70.),3.);
  float sb=clamp(-d2/0.085,0.,1.); float pil=max(sqrt(sb*(2.-sb)),0.2)*(1.-mane*0.22);   // rounded, carved edge
  vec2 w=vec2(d2, abs(h.z)-th*pil);
  float head=min(max(w.x,w.y),0.)+length(max(w,0.))-0.004;
  float zs=sign(h.z)+1e-4;
  head=max(head, -(length((h-vec3(0.118,0.468,zs*th*0.93))*vec3(1.,1.35,1.))-0.017));   // eye
  head+=0.0035*smoothstep(0.03,0.0,abs(length(h.xy-vec2(0.118,0.468))-0.03))*step(0.,-d2); // carved lid ring
  head=max(head, -(length(h-vec3(0.304,0.252,zs*th*0.62))-0.012));          // nostril
  head=max(head, -(length((h-vec3(0.012,0.6,0.))*vec3(1.6,.55,4.))-0.02));  // split between the ears
  return smin(base, head, 0.02)*KS; }
vec3 kNormal(vec3 p){ const vec2 k=vec2(1.,-1.); const float e=0.0009;
  return normalize(k.xyy*mapK(p+k.xyy*e)+k.yyx*mapK(p+k.yyx*e)+k.yxy*mapK(p+k.yxy*e)+k.xxx*mapK(p+k.xxx*e)); }
// ray vs knight bounding cylinder (r<.42*KS, 0<y<.84*KS)
bool kBounds(vec3 ro, vec3 rd, out float t0, out float t1){
  float R=0.42*KS, top=0.84*KS;
  float a=dot(rd.xz,rd.xz), b=dot(ro.xz,rd.xz), c=dot(ro.xz,ro.xz)-R*R, h=b*b-a*c; if(h<0.||a<1e-8) return false;
  h=sqrt(h); t0=(-b-h)/a; t1=(-b+h)/a;
  float ty0=(0.-ro.y)/rd.y, ty1=(top-ro.y)/rd.y; if(ty0>ty1){ float s=ty0; ty0=ty1; ty1=s; }
  t0=max(t0,ty0); t1=min(t1,ty1); t0=max(t0,0.); return t1>t0; }
float traceK(vec3 ro, vec3 rd, int n){ float t0,t1; if(!kBounds(ro,rd,t0,t1)) return -1.;
  float t=t0; for(int i=0;i<160;i++){ if(i>=n) break; float d=mapK(ro+rd*t); if(d<0.0004*t+0.0002) return t; t+=d*0.7; if(t>t1) break; } return -1.; }
float kShadow(vec3 ro, vec3 rd, float k){ float t0,t1; if(!kBounds(ro,rd,t0,t1)) return 1.; float res=1.; float t=max(t0,0.01);
  for(int i=0;i<32;i++){ float d=mapK(ro+rd*t); res=min(res,k*d/t); if(res<0.01) return 0.; t+=clamp(d,0.008,0.08); if(t>t1) break; } return clamp(res,0.,1.); }
`;

SHADERS.ch1_board = COMMON + LIB + KNIGHT + `
uniform vec4 uD;
vec3 LP; vec3 LD; float LTAN;
float beamAt(vec3 p){ vec3 v=p-LP; float al=dot(v,LD); if(al<=0.) return 0.; float rad=length(v-LD*al); float R=al*LTAN;
  float core=smoothstep(R*1.0,R*0.62,rad); float halo=exp(-rad*rad/(R*R*1.8))*0.03; return core+halo; }
const vec2 GDIR=vec2(.25,1.);
vec3 envC(vec3 rd){ vec3 c=vec3(.0012,.0014,.0024);
  float az=pow(max(dot(normalize(rd.xz+1e-5),normalize(GDIR)),0.),3.);
  c+=uB.x*vec3(1.,.64,.32)*(.04*exp(-abs(rd.y)*24.)+.008*exp(-abs(rd.y)*5.))*(.2+.8*az);
  return c; }
// the same far glow seen in rough glass: a long vertical streak (anisotropic reflection)
vec3 glowStreak(vec3 rr){ float az=acos(clamp(dot(normalize(rr.xz+1e-5),normalize(GDIR)),-1.,1.));
  return uB.x*vec3(1.,.62,.3)*exp(-az*az*90.)*exp(-max(rr.y,0.)*5.)*.18; }
// in-scattering of the beam along a ray segment
vec3 scatter(vec3 ro, vec3 rd, float tmax, int n){
  // bound by the cylinder around the beam axis near the ground
  vec3 ax=LD; vec3 oc=ro-uD.xyz*0.; float Rm=max(LTAN*length(LP),0.05)*1.8+0.3;
  vec3 w=ro-LP; vec3 rp=rd-ax*dot(rd,ax), wp=w-ax*dot(w,ax); float a=dot(rp,rp), b=dot(wp,rp), c=dot(wp,wp)-Rm*Rm, h=b*b-a*c;
  if(h<0.) return vec3(0); h=sqrt(h); float t0=max((-b-h)/a,0.), t1=min((-b+h)/a,tmax); if(t1<=t0) return vec3(0);
  float dt=(t1-t0)/float(n), jit=hash12(gl_FragCoord.xy+fract(uTime*3.1)*71.); float s=0.;
  for(int i=0;i<48;i++){ if(i>=n) break; vec3 p=ro+rd*(t0+dt*(float(i)+jit));
    float dn=.55+.45*noise(p*2.3+vec3(0.,uTime*.05,uTime*.03)); s+=beamAt(p)*dn*smoothstep(-.05,.6,p.y); }
  return WARM*s*dt*uB.y; }
vec3 marble(vec3 q){ vec3 r=q*vec3(1.,1.,1.)+vec3(0.,0.,0.);
  float w=fbm(r*5.+vec3(3.1,0.,1.7));
  float v1=abs(sin((r.y*1.4+r.x*0.9+r.z*0.6)*9.+w*9.));            // main veins
  float v2=abs(sin((r.x*1.1-r.y*0.7+r.z)*23.+fbm(r*13.+2.)*7.));     // fine veins
  vec3 c=vec3(.95,.92,.87)*(0.93+0.07*w);
  c=mix(c, vec3(.52,.5,.5), smoothstep(.07,.0,v1)*.6);
  c=mix(c, vec3(.66,.63,.6), smoothstep(.05,.0,v2)*.35);
  c=mix(c, vec3(.82,.68,.45), smoothstep(.02,.0,v1)*.25);               // a whisper of gold in the deepest veins
  return c; }
vec3 shadeKnight(vec3 p, vec3 rd, vec3 n, bool full){
  vec3 q=kLocal(p); vec3 alb=marble(q);
  vec3 L=normalize(LP-p); float spot=beamAt(p)*uA.x*uB.z;
  float sh=full? kShadow(p+n*0.003, L, 14.) : 1.;
  float wrap=max((dot(n,L)+.4)/1.4,0.);
  float diff=max(dot(n,L),0.)*sh;
  // translucency: how thin the marble is towards the light
  float th=0.; if(full){ for(int i=1;i<=3;i++){ float hh=0.035*float(i); th+=clamp((hh+mapK(p-n*hh))/hh,0.,1.); } th/=3.; }
  vec3 sss=vec3(1.,.72,.45)*th*(.35+.65*wrap)*spot*.55;
  // rim light from behind
  vec3 RL=normalize(vec3(-.7,.45,-.75)); vec3 RL2=normalize(vec3(-.2,.3,-1.));
  float fr=1.-max(dot(n,-rd),0.);
  float rim=smoothstep(.62,.97,fr)*max(dot(n,RL)+.2,0.)*uA.z;
  float rim2=smoothstep(.6,.97,fr)*max(dot(n,RL2)+.1,0.)*uA.z*.5;
  vec3 R=reflect(rd,n);
  float spec=pow(max(dot(R,L),0.),70.)*sh*spot*2.2 + pow(max(dot(R,L),0.),12.)*sh*spot*.12;
  float bounce=max(-n.y,0.)*.6+.15;              // light coming back up from the lit board
  float poolNear=beamAt(vec3(p.x,0.,p.z))*uA.x*uB.z;
  float ao=clamp(mapK(p+n*0.04)/0.04,0.,1.)*.5+.5;
  float amb=clamp(uA.x,0.,1.);
  vec3 col=alb*(WARM*(diff*.95+wrap*.1)*spot + vec3(.014,.015,.02)*ao*amb + WARM*.07*bounce*poolNear*ao) + sss*alb;
  col+=vec3(1.,.84,.6)*rim*2.6 + vec3(1.,.9,.78)*rim2*1.4;
  col+=WARM*poolNear*.35*smoothstep(.0,-.6,R.y)*schlick(dot(n,-rd),.05);
  col+=WARM*spec*schlick(dot(n,-rd),.06)*6.;
  col+=envC(R)*schlick(dot(n,-rd),.05)*2.;
  return col*uA.w; }
// board material at p (y=0); returns colour, outputs reflectivity
vec3 shadeBoard(vec3 p, vec3 rd, float t, out float F, out vec3 rn){
  vec2 g=p.xz+.5; vec2 id=floor(g); vec2 f=fract(g)-.5;
  float chk=mod(id.x+id.y,2.);
  vec2 fw=fwidth(g); float aa=max(max(fw.x,fw.y),1e-4);
  vec2 ed=.5-abs(f); float e=min(ed.x,ed.y);
  const float lw=.011;
  float inlay=clamp((lw-e)/aa+.5,0.,1.)*clamp(lw*2.6/aa,0.,1.);
  float corner=smoothstep(.035+aa,.035-aa, length(ed))*clamp(.05/aa,0.,1.);   // tiny gold studs at the corners
  inlay=max(inlay,corner);
  float far=smoothstep(.45,1.2,aa*8.);            // filtered far field
  inlay=mix(inlay, lw*4., far);
  float h=hash12(id*1.7+3.); float veinA=h*6.28;
  vec2 vq=rot(veinA)*f;
  float smoke=fbm(vec3(vq*2.2+id*7.1,h*9.));
  vec3 dark=vec3(.004,.0042,.0048)*(0.8+0.4*smoke);
  vec3 lite=mix(vec3(.026,.025,.024), vec3(.062,.058,.054), smoke)*(0.85+0.3*h);
  lite=mix(lite, vec3(.13,.12,.11), smoothstep(.025,.0,abs(sin(vq.x*7.+smoke*6.)))*.4*(1.-far));
  vec3 alb=mix(dark, lite, chk);
  vec3 L=normalize(LP-p); float spot=beamAt(p)*uA.x*uB.z;
  float sh=1.; if(length(p.xz)<2.2*KS) sh=kShadow(p+vec3(0.,.002,0.), L, 10.);
  float r=length(p.xz)/KS; float ao=1.-.55*exp(-max(r-.28,0.)*9.)*step(r,1.2);
  vec3 col=alb*WARM*spot*max(L.y,0.)*sh*ao*1.1;
  // gold inlay: metal, lit by the pool and reflecting the world
  rn=vec3(0.,1.,0.);
  vec3 gold=GOLDC*(spot*sh*ao*(.6+.4*max(L.y,0.)));
  F=mix(schlick(-rd.y, mix(.045,.035,chk)), 0., inlay);
  col=mix(col, gold, inlay);
  // the gold catches the horizon glow far away
  col+=GOLDC*inlay*envC(reflect(rd,vec3(0,1,0)))*6.;
  // roughness for the light squares: small normal wobble
  if(chk>.5 && inlay<.5){ rn=normalize(vec3((smoke-.5)*.012, 1., (h-.5)*.012)); }
  return col; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  LP=uD.xyz; LD=normalize(vec3(0.)-LP); LTAN=uA.y/length(LP);
  int NK=uQ>.5? 150 : 90; int NS=uQ>.5? 40 : 22;
  float tK=traceK(ro,rd,NK);
  float tP=rd.y<-1e-4? -ro.y/rd.y : 1e9;
  vec3 col=envC(rd); float tHit=1e9;
  if(tK>0. && tK<tP){ vec3 p=ro+rd*tK; col=shadeKnight(p,rd,kNormal(p),true); tHit=tK; }
  else if(tP<1e8){ vec3 p=ro+rd*tP; tHit=tP; float F; vec3 rn;
    vec3 c=shadeBoard(p,rd,tP,F,rn);
    vec3 rr=reflect(rd,rn); vec3 rc=envC(rr)+glowStreak(rr);
    float tr=traceK(p+vec3(0.,.001,0.),rr,uQ>.5? 90 : 56);
    if(tr>0.){ vec3 q=p+rr*tr; rc=shadeKnight(q,rr,kNormal(q),false); }
    rc+=scatter(p+vec3(0.,.001,0.),rr, tr>0.? tr : 60., NS/2+4);
    c+=rc*F;
    float fog=1.-exp(-max(tP-1.,0.)*.035); c=mix(c, envC(rd)*.6, fog);
    col=c; }
  col+=scatter(ro,rd,min(tHit,80.),NS);
  col*=uD.w;
  fragColor=vec4(col,1.); }`;

// ---------------------------------------------------------------- B. the armillary of human thought
// Seven gold bands, each engraved with a different domain of human thought, around a small warm core. No eyes: an instrument.
const NRING = 7, RTH = 0.011;
const RINGS = [...Array(NRING)].map((_, i) => ({ R: 0.6 + 0.135 * i, wd: 0.05 + 0.0065 * i }));
RINGS.forEach(r => { r.n = Math.max(1, Math.round(2 * Math.PI * r.R / (2 * r.wd) / 16)); r.kx = (2 * r.wd / 256) / ((2 * Math.PI * r.R / r.n) / 4096); });
let ENG = null;
function engraving() {
  if (ENG) return ENG;
  const c = document.createElement("canvas"); c.width = 4096; c.height = 2048; const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, 4096, 2048); x.fillStyle = "#fff"; x.strokeStyle = "#fff"; x.textBaseline = "middle";
  const rows = [hangulRow, musicRow, mathRow, brushRow, mapRow, poemRow, degreeRow];
  RINGS.forEach((r, i) => { x.save(); x.beginPath(); x.rect(0, i * 256, 4096, 256); x.clip(); x.translate(0, i * 256); border(x, i); rows[i](x, r.kx, i); x.restore(); });
  return (ENG = c);
}
function border(x, i) {
  x.save(); x.fillRect(0, 10, 4096, 4); x.fillRect(0, 22, 4096, 1.5); x.fillRect(0, 242, 4096, 4); x.fillRect(0, 233, 4096, 1.5);
  for (let u = 0; u < 4096; u += 32) { const big = u % 256 === 0; x.fillRect(u, 23, 2, big ? 12 : 6); x.fillRect(u, 233 - (big ? 12 : 6), 2, big ? 12 : 6); }
  x.restore();
}
// lay out items of measured width across the 4096 px tile, justified so the strip wraps seamlessly
function justify(x, items, kx, draw) {
  const ws = items.map(it => it.w * kx), gap0 = 90 * kx; let n = 0, tot = 0;
  while (true) { const w = ws[n % ws.length] + gap0; if (tot + w > 4096 && n > 0) break; tot += w; n++; if (n > 400) break; }
  const gap = gap0 + (4096 - tot) / n; let u = gap / 2;
  for (let j = 0; j < n; j++) { const it = items[j % items.length]; x.save(); x.translate(u, 128); x.scale(kx, 1); draw(it, j); x.restore(); u += ws[j % ws.length] + gap; }
}
function star4(x, cx, cy, r) { x.beginPath(); for (let a = 0; a < 8; a++) { const rr = a % 2 ? r * 0.28 : r, an = a * Math.PI / 4 - Math.PI / 2; x.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } x.closePath(); x.fill(); }
function textItems(x, font, strs) { x.font = font; return strs.map(s2 => ({ s: s2, w: x.measureText(s2).width + 70 })); }
function hangulRow(x, kx) {
  const its = textItems(x, '112px "SerifM"', ["나라의 말이 중국과 달라", "문자와 서로 통하지 아니하므로", "어리석은 백성이 이르고자 하는 바가 있어도", "마침내 제 뜻을 펴지 못하는 사람이 많으니라", "내 이를 가엾이 여겨 새로 스물여덟 자를 만드노니"]);
  justify(x, its, kx, it => { x.font = '112px "SerifM"'; x.textAlign = "left"; x.fillText(it.s, 0, 4); star4(x, it.w - 35, 0, 16); });
}
function musicRow(x, kx) {
  // alto-clef staff (lines F3 A3 C4 E4 G4): the film's motif A3 E4 D4 C4, its answer, and a cadence
  const ys = s2 => 168 - s2 * 10;                   // step 0 = bottom line, a line every two steps
  for (let l = 0; l < 5; l++) x.fillRect(0, 167 - l * 20, 4096, 2.4);
  const phr = [[2, 6, 5, 4], [4, 8, 7, 6], [6, 5, 4, 3], [2, 6, 5, 4], [5, 9, 8, 6], [4, 3, 2]];
  const items = phr.map(p2 => ({ p: p2, w: 120 + p2.length * 92 }));
  justify(x, items, kx, (it, j) => {
    x.translate(0, -128);
    x.fillRect(-40, 88, 3, 82);                     // bar line
    it.p.forEach((s2, k2) => { const nx = 40 + k2 * 92, ny = ys(s2), half = k2 === it.p.length - 1 && j % 3 === 2;
      x.save(); x.translate(nx, ny); x.rotate(-0.35); x.beginPath(); x.ellipse(0, 0, 14, 10, 0, 0, 7);
      if (half) { x.lineWidth = 3.5; x.stroke(); } else x.fill(); x.restore();
      const up = s2 < 4; x.fillRect(up ? nx + 11 : nx - 13, up ? ny - 64 : ny, 2.6, 64); });
    const hi = Math.min(...it.p.map(ys)), y0 = Math.min(hi - 74, 74);
    x.lineWidth = 2.5; x.beginPath(); x.moveTo(34, y0 + 12); x.quadraticCurveTo(40 + (it.p.length - 1) * 46, y0 - 14, 46 + (it.p.length - 1) * 92, y0 + 12); x.stroke();
    if (j % 2 === 0) { x.font = '50px "CormI"'; x.textAlign = "left"; x.fillText(j % 4 === 0 ? "p" : "mp", 24, 214); }
  });
}
function mathRow(x, kx) {
  const C = '"Corm"', I = '"CormI"', S = '"SerifL"';
  const eqs = [
    [["E", I], [" = ", C], ["mc", I], ["2", C, .55, -.42]],
    [["e", I], ["iπ", I, .55, -.45], [" + 1 = 0", C]],
    [["a", I], ["2", C, .55, -.42], [" + ", C], ["b", I], ["2", C, .55, -.42], [" = ", C], ["c", I], ["2", C, .55, -.42]],
    [["∇", S, .8], [" · ", C], ["E", I], [" = ", C], ["ρ", S, .8], [" / ", C], ["ε", S, .8], ["0", C, .55, .3]],
    [["F", I], [" = ", C], ["G", I], ["  m", I], ["1", C, .55, .3], ["m", I], ["2", C, .55, .3], [" / ", C], ["r", I], ["2", C, .55, -.42]],
    [["∫", S, 1.1], [" e", I], ["-x²", I, .55, -.45], [" dx = ", C], ["√", S, .9], ["π", S, .8]],
    [["ζ", S, .8], ["(s) = ", C], ["∑", S, .9], [" 1 / n", I], ["s", I, .55, -.45]],
  ];
  const sz = 118;
  const meas = eq => eq.reduce((w, [t, f, sc = 1]) => { x.font = `${sz * sc}px ${f}`; return w + x.measureText(t).width; }, 0);
  const items = eqs.map(e => ({ e, w: meas(e) + 80 }));
  justify(x, items, kx, it => { let u = 0; x.textAlign = "left";
    for (const [t, f, sc = 1, dy = 0] of it.e) { x.font = `${sz * sc}px ${f}`; x.fillText(t, u, 6 + dy * sz); u += x.measureText(t).width; }
    star4(x, it.w - 40, 0, 14); });
}
function brushRow(x, kx) {
  const chars = "天地玄黃宇宙洪荒日月盈昃辰宿列張寒來暑往秋收冬藏".split(""), r = rng(31);
  const items = []; for (let i = 0; i < chars.length; i += 4) items.push({ s: chars.slice(i, i + 4), w: 4 * 150 + 60 });
  justify(x, items, kx, it => {
    it.s.forEach((ch, k2) => { x.save(); x.translate(k2 * 150 + 70, 0); x.rotate((r() - 0.5) * 0.08);
      x.font = `${140 + r() * 14}px "SerifB"`; x.textAlign = "center";
      for (let m = 0; m < 5; m++) { x.globalAlpha = 0.35; x.fillText(ch, (r() - 0.5) * 5, 6 + (r() - 0.5) * 5); }   // wet ink spread
      x.globalAlpha = 1; x.fillText(ch, 0, 6);
      x.globalCompositeOperation = "destination-out";                                                          // dry-brush streaks
      for (let m = 0; m < 26; m++) { x.globalAlpha = 0.5 + r() * 0.5; const yy = (r() - 0.5) * 130; x.fillRect(-80, yy, 160, 1 + r() * 2.2); }
      x.restore(); });
    x.save(); x.globalAlpha = 1; x.translate(4 * 150 + 22, 0); x.fillRect(-22, -22, 44, 44); x.globalCompositeOperation = "destination-out"; x.font = '30px "SerifB"'; x.textAlign = "center"; x.fillText("印", 0, 2); x.restore();
  });
}
function mapRow(x, kx) {
  // a portolan chart: rhumb lines from compass roses, a ragged coastline, stipple at the shore, little names
  const r = rng(7); const coast = []; for (let u = 0; u <= 4096; u += 8) { const t = u / 4096 * Math.PI * 2;
    coast.push(128 + 34 * Math.sin(t * 3 + 1) + 22 * Math.sin(t * 7 + 2) + 12 * Math.sin(t * 17) + 6 * Math.sin(t * 41 + 3)); }
  x.save(); x.globalAlpha = 0.5; x.lineWidth = 1.2;
  for (let c2 = 0; c2 < 6; c2++) { const cx = c2 * 4096 / 6 + 340, cy = 128; for (let a = 0; a < 16; a++) { const an = a * Math.PI / 8; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * 900, cy + Math.sin(an) * 900); x.stroke(); }
    x.globalAlpha = 1; x.save(); x.translate(cx, cy); for (let a = 0; a < 8; a++) { x.rotate(Math.PI / 4); x.beginPath(); x.moveTo(0, 0); x.lineTo(a % 2 ? 26 : 58, 0); x.lineTo(0, 8); x.closePath(); x.fill(); } x.beginPath(); x.arc(0, 0, 9, 0, 7); x.lineWidth = 2; x.stroke(); x.restore(); x.globalAlpha = 0.5; }
  x.restore();
  x.lineWidth = 4; x.beginPath(); coast.forEach((y, j) => j ? x.lineTo(j * 8, y) : x.moveTo(0, y)); x.stroke();
  x.lineWidth = 1.5; x.beginPath(); coast.forEach((y, j) => j ? x.lineTo(j * 8, y + 9) : x.moveTo(0, y + 9)); x.stroke();
  for (let j = 0; j < coast.length; j += 1) for (let m = 0; m < 3; m++) { const yy = coast[j] + 16 + r() * 40 * (1 + m); if (r() < 0.5 - m * 0.15) x.fillRect(j * 8 + r() * 8, yy, 2, 2); }
  for (let j = 0; j < coast.length; j += 3) { if (r() < 0.55) x.fillRect(j * 8, coast[j] - 8 - r() * 4, 2.5, 8 + r() * 10); }   // shore hatching on land
  x.font = 'italic 34px "CormI"'; x.textAlign = "center"; const names = ["Terra", "Mare", "Portus", "Insula", "Sinus", "Promontorium", "Mare Nostrum", "Ora"];
  for (let j = 0; j < 9; j++) { const u = 220 + j * 455, y = coast[Math.round(u / 8)]; x.save(); x.translate(u, y - 44); x.scale(kx, 1); x.fillText(names[j % names.length], 0, 0); x.restore(); }
}
function poemRow(x, kx) {
  const its = textItems(x, '104px "SerifL"', ["별 하나에 추억과", "별 하나에 사랑과", "별 하나에 쓸쓸함과", "별 하나에 동경과", "별 하나에 시와", "별 하나에 어머니, 어머니"]);
  justify(x, its, kx, it => { x.font = '104px "SerifL"'; x.textAlign = "left"; x.fillText(it.s, 0, 4); star4(x, it.w - 35, 0, 12); });
}
function degreeRow(x, kx) {
  for (let u = 0; u < 4096; u += 4096 / 120) { const k2 = Math.round(u / (4096 / 120)); const L = k2 % 10 === 0 ? 70 : k2 % 5 === 0 ? 48 : 30; x.fillRect(u, 36, 2.5, L); x.fillRect(u, 220 - L, 2.5, L); }
  x.font = '64px "Corm"'; x.textAlign = "center";
  for (let k2 = 0; k2 < 12; k2++) { x.save(); x.translate((k2 + 0.5) * 4096 / 12, 132); x.scale(kx, 1); x.fillText(String(k2 * 10 + 5).padStart(2, " ") + "°", 0, 0); x.restore(); }
}
const RT_GLSL = `const float RR[7]=float[7](${RINGS.map(r => r.R.toFixed(4)).join(",")}); const float RW[7]=float[7](${RINGS.map(r => r.wd.toFixed(4)).join(",")}); const float RN[7]=float[7](${RINGS.map(r => r.n.toFixed(1)).join(",")}); const float RT=${RTH};`;
// uA: core intensity, flare, key light, env   uB: unfold scale (global), shadow on, -, -
SHADERS.ch1_armil = COMMON + LIB + `
uniform sampler2D uEng; uniform mat3 uRM[7]; uniform float uRS[7]; uniform float uSp[7];
${RT_GLSL}
float ringSD(vec3 q, float R, float w){ vec2 d=abs(vec2(length(q.xz)-R, q.y))-vec2(RT, w); return length(max(d,0.))+min(max(d.x,d.y),0.)-0.002; }
float mapA(vec3 p, out int id){ float d=1e9; id=-1;
  for(int i=0;i<7;i++){ float s=uRS[i]; if(s<0.02) continue; vec3 q=uRM[i]*p; float di=ringSD(q, RR[i]*s, RW[i]*s); if(di<d){ d=di; id=i; } }
  float L=1.58*uB.x; vec3 a=vec3(0.,clamp(p.y,-L,L),0.); float rod=length(p-a)-0.009*uB.x;
  float fin=min(length(p-vec3(0.,L+0.03,0.)), length(p+vec3(0.,L+0.03,0.)))-0.028*uB.x;
  rod=min(rod,fin); if(rod<d){ d=rod; id=7; }
  return d; }
float mapS(vec3 p){ int i; return mapA(p,i); }
vec3 nrmA(vec3 p){ const vec2 k=vec2(1.,-1.); const float e=0.0006; return normalize(k.xyy*mapS(p+k.xyy*e)+k.yyx*mapS(p+k.yyx*e)+k.yxy*mapS(p+k.yxy*e)+k.xxx*mapS(p+k.xxx*e)); }
vec3 envA(vec3 rd){ vec3 c=vec3(.0016,.0016,.0026)+WARM*.03*pow(max(rd.y,0.),2.)*uA.w + vec3(.03,.025,.03)*exp(-abs(rd.y)*6.)*uA.w*.3;
  return c; }
float shadowA(vec3 p){ // toward the core
  vec3 rd=normalize(-p); float tmax=length(p)-0.06; float t=0.02, res=1.;
  for(int i=0;i<40;i++){ if(float(i)>=mix(20.,40.,uQ)) break; float d=mapS(p+rd*t); res=min(res,16.*d/t); if(res<0.02) return 0.; t+=clamp(d,0.01,0.12); if(t>tmax) break; }
  return clamp(res,0.,1.); }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  float Ic=uA.x;
  // core glow (closest approach to the origin)
  float tc=max(-dot(ro,rd),0.); float dmin=length(ro+rd*tc);
  vec3 col=envA(rd)+stars(rd,.12);
  float b=dot(ro,rd), c=dot(ro,ro)-2.9, h=b*b-c; float tHit=1e9; int id=-1;
  if(h>0.){ float t=max(-b-sqrt(h),0.), t1=-b+sqrt(h); int n=uQ>.5? 170 : 110;
    for(int i=0;i<170;i++){ if(i>=n) break; vec3 p=ro+rd*t; float d=mapA(p,id); if(d<0.00025*t+0.0001){ tHit=t; break; } t+=d*0.9; if(t>t1) break; } }
  float rC=0.045*(1.+uA.y*0.6);
  float tCore=-1.; { float bb=dot(ro,rd), cc=dot(ro,ro)-rC*rC, hh=bb*bb-cc; if(hh>0.) tCore=-bb-sqrt(hh); }
  if(tCore>0. && tCore<tHit){ col=WARM*Ic*1.2+vec3(Ic*.6); tHit=tCore; id=-2; }
  else if(tHit<1e8){
    vec3 p=ro+rd*tHit; vec3 n=nrmA(p); vec3 V=-rd;
    vec3 Lc=normalize(-p); float dist=length(p);
    float sh=uB.y>.5? shadowA(p+n*0.002) : 1.;
    vec3 Lk=normalize(vec3(-.45,.75,-.5));
    vec3 F0=vec3(1.,.74,.36); vec3 T=vec3(0,1,0); float m=0.; vec3 alb=F0;
    if(id<7){ vec3 q=uRM[id]*p; float s=uRS[id]; float R=RR[id]*s, w=RW[id]*s; float r=length(q.xz);
      vec3 radial=vec3(q.x,0.,q.z)/max(r,1e-5); vec3 tl=vec3(-radial.z,0.,radial.x);
      T=transpose(uRM[id])*tl; vec3 Bw=transpose(uRM[id])*vec3(0,1,0);
      bool face=abs(abs(q.y)-w)>0.0035;
      if(face){ float outer=r>R? -1. : 1.;
        float th=atan(q.z,q.x)+uSp[id];
        float u=outer*th/6.2831853*RN[id]; float vl=clamp(q.y/w*.5+.5,0.,1.);
        vec2 uv=vec2(u, 1.-(float(id)+1.-vl)/8.);
        vec2 dx=dFdx(uv), dy=dFdy(uv); dx.x-=floor(dx.x+.5); dy.x-=floor(dy.x+.5);
        m=textureGrad(uEng,uv,dx,dy).r;
        vec2 e=vec2(1.6/4096.,1.6/2048.);
        float mu=textureGrad(uEng,uv+vec2(e.x,0.),dx,dy).r, mv=textureGrad(uEng,uv+vec2(0.,e.y),dx,dy).r;
        vec3 Tf=T*outer;
        n=normalize(n-(Tf*(mu-m)+Bw*(mv-m))*1.6);
      }
    }
    float NV=max(dot(n,V),0.);
    vec3 Fr=F0+(1.-F0)*pow(1.-NV,5.);
    // anisotropic brushed-gold highlights (Kajiya-Kay) from the core and the key light
    vec3 Hc=normalize(Lc+V), Hk=normalize(Lk+V);
    float tc1=dot(T,Hc), tk1=dot(T,Hk);
    float anC=pow(sqrt(max(1.-tc1*tc1,0.)),120.), anK=pow(sqrt(max(1.-tk1*tk1,0.)),60.);
    float dC=max(dot(n,Lc),0.), dK=max(dot(n,Lk),0.);
    vec3 R=reflect(rd,n);
    float coreRef=pow(max(dot(R,Lc),0.),300.);
    vec3 polished = Fr*( WARM*Ic*(anC*dC*.9+coreRef*6.)*sh/(1.+dist*dist*2.) + WARM*uA.z*(anK*dK*.8+dK*.08) + envA(R)*3. + WARM*Ic*.05*dC*sh/(1.+dist*dist*2.) );
    vec3 groove = F0*.18*( WARM*Ic*dC*.25*sh/(1.+dist*dist*2.) + WARM*uA.z*dK*.25 ) + vec3(.003,.0025,.002);
    col=mix(polished, groove, smoothstep(.25,.75,m));
    col=mix(col, col*.4+groove, 0.);
  }
  // halo of the core over everything, occluded only by geometry nearer than the core
  float occ = (tHit<tc && id!=-2)? 0.25 : 1.;
  col+=WARM*Ic*(0.0009/(dmin*dmin+0.0005) + 0.03*exp(-dmin*5.))*occ*(1.+uA.y*3.);
  col+=vec3(1.,.9,.75)*uA.y*uA.y*0.6;
  fragColor=vec4(col,1.); }`;

// ---------------------------------------------------------------- C. the intelligence staircase
// Veined marble slabs with gold nosing, floating in a step pattern from a sea of cloud up through a cloud deck into blinding light.
// uA: rise, run, half width, sun intensity   uB: cloud deck y0, y1, hole radius, cloud cover   uD: sun dir xyz, quality
const ST = { rise: 0.62, run: 1.25, wd: 1.7 };
SHADERS.ch1_stairs = COMMON + LIB + `
uniform vec4 uD;
vec3 SUN; const float TH=0.15, DEP=0.52;
float slabD(vec3 p, float j){ vec3 q=p-vec3(0., j*uA.x, j*uA.y); return sdBox(q, vec3(uA.z-0.035, TH-0.035, DEP-0.035))-0.035; }
float mapS(vec3 p, out float jj){ float j=floor(p.z/uA.y+.5); float d=1e9; jj=0.;
  for(int o=-1;o<=1;o++){ float jc=j+float(o); if(jc<0.) continue; float di=slabD(p,jc); if(di<d){ d=di; jj=jc; } }
  return min(d, 1.); }
float mapS0(vec3 p){ float j; return mapS(p,j); }
vec3 nrmS(vec3 p, float t){ vec2 e=vec2(.0008+.0004*t,0.); return normalize(vec3(mapS0(p+e.xyy)-mapS0(p-e.xyy), mapS0(p+e.yxy)-mapS0(p-e.yxy), mapS0(p+e.yyx)-mapS0(p-e.yyx))); }
float shS(vec3 p){ float res=1., t=0.03; for(int i=0;i<24;i++){ float d=mapS0(p+SUN*t); res=min(res,12.*d/t); if(res<0.02) return 0.; t+=clamp(d,0.03,0.5); if(t>9.) break; } return clamp(res,0.,1.); }
vec3 skyS(vec3 rd){ float sd=max(dot(rd,SUN),0.);
  vec3 c=mix(vec3(.006,.008,.018), vec3(.012,.016,.034), smoothstep(-.5,.5,rd.y));
  c+=vec3(.05,.04,.035)*exp(-abs(rd.y-.02)*9.);
  c+=stars(rd,.35)*(1.-smoothstep(.6,.95,sd))*smoothstep(-.05,.3,rd.y);
  c+=vec3(1.,.8,.52)*(pow(sd,8.)*.012+pow(sd,60.)*.12+pow(sd,500.)*1.2+pow(sd,4000.)*14.)*uA.w;
  return c; }
float axisDist(vec3 p){ vec3 A=normalize(vec3(0.,uA.x,uA.y)); return length(p-A*dot(p,A)); }
// sea of cloud below the first steps: billowed top surface, soft volumetric body
float seaTop(vec2 xz){ vec2 q=xz*.075+vec2(uTime*.004,uTime*.008); float b=fbm(vec3(q,1.3)); float c=fbm(vec3(xz*.21+vec2(uTime*.01,0.),4.1)); return uB.x+3.6*b*b+1.3*c*c-1.; }
float seaD(vec3 p){ float h=seaTop(p.xz); float d=clamp((h-p.y)*1.4,0.,1.); if(d<=0.) return 0.; return d*(.55+.45*noise(p*.45+vec3(0.,uTime*.02,0.))); }
float seaCheap(vec3 p){ vec2 q=p.xz*.075+vec2(uTime*.004,uTime*.008); float b=noise(vec3(q,1.3))*.55+noise(vec3(q*2.03,1.3))*.27; float h=uB.x+3.6*b*b+.25-1.; return clamp((h-p.y)*1.4,0.,1.); }
vec3 marbleS(vec3 p){ float w=fbm(p*1.1+vec3(2.,7.,1.));
  float v1=abs(sin((p.x*.8+p.z*.5+p.y*.3)*2.6+w*8.)); float v2=abs(sin((p.x*.5-p.z*.9)*8.+fbm(p*3.5)*6.));
  vec3 c=vec3(.93,.9,.85)*(.9+.1*w); c=mix(c,vec3(.42,.41,.42),smoothstep(.07,0.,v1)*.55); c=mix(c,vec3(.64,.61,.58),smoothstep(.045,0.,v2)*.32);
  c=mix(c,vec3(.86,.68,.38),smoothstep(.018,0.,v1)*.45); return c; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy); SUN=normalize(uD.xyz);
  float t=0.05, jj=0.; bool hit=false; int N=uD.w>.5? 220 : 150;
  for(int i=0;i<220;i++){ if(i>=N) break; vec3 p=ro+rd*t; float d=mapS(p,jj); if(d<0.0006*t+0.0003){ hit=true; break; } t+=d*0.95; if(t>180.) break; }
  vec3 col; float tEnd=hit? t : 1e9;
  if(hit){ vec3 p=ro+rd*t; vec3 n=nrmS(p,t); vec3 q=p-vec3(0.,jj*uA.x,jj*uA.y);
    float sh=t<45.? shS(p+n*0.01) : 1.;
    vec3 alb=marbleS(q*1.3+vec3(jj*3.7,jj*1.3,0.));
    float topF=smoothstep(.5,.9,n.y);
    float aaW=0.012+t*.0015;
    float nose=smoothstep(.05+aaW,.05,abs(q.z+DEP-.05))*smoothstep(.06+aaW,.06,abs(q.y-TH+.06));        // gold band round the front top edge
    float side=smoothstep(.04+aaW,.04,abs(abs(q.x)-uA.z+.04))*smoothstep(.05+aaW,.05,abs(q.y-TH+.05));
    float gold=max(nose,side);
    float dif=max(dot(n,SUN),0.)*sh;
    vec3 K=normalize(vec3(.75,.8,-.55)); float difK=max(dot(n,K),0.);     // warm key from the camera side
    vec3 amb=vec3(.03,.036,.056)*(.6+.4*n.y)+vec3(.03,.026,.02)*max(-n.y,0.);
    vec3 R=reflect(rd,n);
    float Fm=schlick(dot(n,-rd),.045);
    float spec=pow(max(dot(R,SUN),0.),80.)*sh, specK=pow(max(dot(R,K),0.),40.);
    float fr=1.-max(dot(n,-rd),0.);
    float rim=smoothstep(.55,.95,fr)*pow(max(dot(rd,SUN),0.),2.);
    float trans=pow(max(dot(rd,SUN),0.),5.)*.3*(1.-topF);              // marble glowing through when seen against the light
    vec3 c=alb*(vec3(1.,.86,.66)*dif*1.5*uA.w+vec3(1.,.84,.66)*difK*.55*uD.w*0.+vec3(1.,.84,.66)*difK*.55+amb) + vec3(1.,.9,.75)*(spec*8.*uA.w+specK*1.2)*Fm + vec3(1.,.78,.5)*(trans+rim*.8)*uA.w*alb + skyS(R)*Fm*.8;
    vec3 gc=GOLDC*(skyS(R)*1.6 + vec3(1.,.85,.6)*(dif*.9+pow(max(dot(R,SUN),0.),16.)*sh*5.)*uA.w + vec3(1.,.84,.6)*(difK*.5+pow(max(dot(R,K),0.),12.)*1.6) + vec3(.02,.02,.03));
    c=mix(c, gc, gold);
    float f=1.-exp(-t*.016); vec3 hz=skyS(rd)*.75+vec3(.012,.014,.024);
    col=mix(c, hz, f);
  } else col=skyS(rd);
  // glowing mist below the stairs (analytic exponential height fog)
  { float a=.12, b=.9, y0=-3.; float tt=min(tEnd,140.);
    float fd= abs(rd.y)>1e-4 ? (a/b)*exp(-b*(ro.y-y0))*(1.-exp(-b*rd.y*tt))/rd.y : a*exp(-b*(ro.y-y0))*tt;
    float fm=1.-exp(-max(fd,0.));
    vec3 mc=vec3(.02,.024,.042)+vec3(1.,.8,.55)*pow(max(dot(rd,SUN)*.5+.5,0.),8.)*.1*uA.w;
    col=mix(col, mc, fm); }
  // sea of cloud (volumetric slab from the billow tops down)
  { float yT=uB.x+3.9, yB=uB.x-1.8; if(rd.y<-1e-4 && ro.y>yB){ float ta=max((yT-ro.y)/rd.y,0.), tb=min((yB-ro.y)/rd.y, min(tEnd,260.));
      if(tb>ta){ int NS=uD.w>.5? 64 : 36; float T=1.; vec3 cc=vec3(0); float jit=hash12(gl_FragCoord.xy+fract(uTime*5.3)*61.);
        float dt=(tb-ta)/float(NS); dt=max(dt,.15); float tt=ta+dt*jit;
        for(int i=0;i<64;i++){ if(i>=NS||tt>tb) break; vec3 p=ro+rd*tt; float dn=seaD(p);
          if(dn>.002){ float a=1.-exp(-dn*dt*1.8);
            float od=seaCheap(p+SUN*.8)+seaCheap(p+SUN*2.)*1.2; float lt=exp(-od*2.2);
            vec3 K=normalize(vec3(.75,.8,-.55)); float ltK=exp(-(seaCheap(p+K*1.2))*2.);
            float fwd=pow(max(dot(rd,SUN),0.),5.);
            float depth=clamp((seaTop(p.xz)-p.y)/2.,0.,1.);
            vec3 lc=vec3(.012,.015,.03)*(1.-depth*.7) + vec3(1.,.8,.52)*lt*(.14+fwd*2.4)*uA.w*(1.-exp(-dn*3.)) + vec3(1.,.86,.7)*ltK*.16*(1.-depth)*(1.-depth);
            float fog=1.-exp(-tt*.012); lc=mix(lc, skyS(rd)*.8+vec3(.015,.018,.03), fog);
            cc+=T*a*lc; T*=1.-a; if(T<.02) break; }
          tt+=dt*(.6+.8*hash12(vec2(float(i),jit))); }
        col=col*T+cc; } } }
  // a column of light pouring down the flight
  { float ls=0.; float tmax=min(tEnd,90.); for(int i=0;i<12;i++){ float tt=tmax*(float(i)+.5)/12.; vec3 p=ro+rd*tt; float ad=axisDist(p);
      float along=dot(p,normalize(vec3(0.,uA.x,uA.y))); ls+=exp(-ad*ad*.45)*smoothstep(0.,50.,along); } col+=vec3(1.,.82,.55)*ls*tmax/12.*.0007*uA.w*uB.z; }
  col+=vec3(1.,.85,.62)*pow(max(dot(rd,SUN),0.),14.)*.05*uA.w;
  fragColor=vec4(col,1.); }`;

// ---------------------------------------------------------------- D. three lights on three steps
// uA: light intensities 1..3, gold ignition
SHADERS.ch1_three = COMMON + LIB + `
const vec3 BX=vec3(-2.3,0.,2.3); const vec3 BH=vec3(.4,.76,1.12);
vec3 LPOS(int i){ float x=i==0?BX.x:(i==1?BX.y:BX.z); float h=i==0?BH.x:(i==1?BH.y:BH.z); return vec3(x,h+.26,0.); }
vec3 LCOL(int i){ if(i==0) return vec3(1.,.9,.78)*uA.x; if(i==1) return mix(vec3(1.,.55,.25),vec3(1.,.74,.38),uA.w)*uA.y; return vec3(.92,.92,1.)*uA.z; }
float mapB(vec3 p){ float d=1e9; for(int i=0;i<3;i++){ float x=i==0?BX.x:(i==1?BX.y:BX.z); float h=i==0?BH.x:(i==1?BH.y:BH.z);
  d=min(d, sdBox(p-vec3(x,h*.5,0.), vec3(.42,h*.5,.42)-.02)-.02); } return d; }
vec3 nrmB(vec3 p){ vec2 e=vec2(.001,0.); return normalize(vec3(mapB(p+e.xyy)-mapB(p-e.xyy),mapB(p+e.yxy)-mapB(p-e.yxy),mapB(p+e.yyx)-mapB(p-e.yyx))); }
float traceB(vec3 ro, vec3 rd){ float t=0.; for(int i=0;i<90;i++){ float d=mapB(ro+rd*t); if(d<.0005*t+.0002) return t; t+=d; if(t>40.) break; } return -1.; }
vec3 lightAt(vec3 p, vec3 n, vec3 rd){ vec3 c=vec3(0); for(int i=0;i<3;i++){ vec3 l=LPOS(i)-p; float d2=dot(l,l); vec3 L=l*inversesqrt(d2);
  c+=LCOL(i)*(max(dot(n,L),0.)*.9+pow(max(dot(reflect(rd,n),L),0.),40.)*.6)/(1.+d2*1.2); } return c; }
vec3 glows(vec3 ro, vec3 rd, float tmax){ vec3 c=vec3(0); for(int i=0;i<3;i++){ vec3 l=LPOS(i)-ro; float tc=dot(l,rd); if(tc<0.||tc>tmax) continue;
  float d=length(l-rd*tc); c+=LCOL(i)*(.0016/(d*d+.0005)+.05*exp(-d*3.)); } return c; }
vec3 shadeB(vec3 p, vec3 rd){ vec3 n=nrmB(p); float w=fbm(p*3.); float v=abs(sin((p.x+p.y*.7+p.z*.4)*6.+w*7.));
  vec3 alb=mix(vec3(.9,.87,.82),vec3(.5,.48,.47),smoothstep(.07,0.,v)*.5);
  float edge=smoothstep(.03,.0,abs(fract(p.y*20.)-.5)-.47)*0.;
  return alb*(lightAt(p,n,rd)+vec3(.006,.007,.01)); }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 col=vec3(.002,.0022,.0035); float tb=traceB(ro,rd); float tp=rd.y<-1e-4? -ro.y/rd.y : 1e9; float tHit=1e9;
  if(tb>0. && tb<tp){ col=shadeB(ro+rd*tb,rd); tHit=tb; }
  else if(tp<1e8){ vec3 p=ro+rd*tp; tHit=tp; vec2 g=p.xz+.5; vec2 f=abs(fract(g)-.5); float e=min(.5-f.x,.5-f.y);
    vec2 fw=fwidth(g); float aa=max(max(fw.x,fw.y),1e-4); float inlay=clamp((.01-e)/aa+.5,0.,1.)*clamp(.026/aa,0.,1.);
    vec3 alb=mix(vec3(.004),vec3(.03,.028,.026),mod(floor(g.x)+floor(g.y),2.));
    vec3 lit=lightAt(p,vec3(0,1,0),rd);
    vec3 c=mix(alb*lit*1.4, GOLDC*lit*.8, inlay);
    vec3 rr=reflect(rd,vec3(0,1,0)); float F=schlick(-rd.y,.05)*(1.-inlay);
    float tr=traceB(p+vec3(0,.001,0),rr); vec3 rc= tr>0.? shadeB(p+rr*tr,rr) : vec3(0); rc+=glows(p,rr, tr>0.? tr : 40.);
    c+=rc*F; c*=exp(-max(tp-4.,0.)*.08); col=c; }
  col+=glows(ro,rd,tHit);
  fragColor=vec4(col,1.); }`;

// ---------------------------------------------------------------- frame helpers
const fin = () => FINAL();
const CAM = (pos, at, fov = 1.3) => ({ pos, fwd: norm(sub(at, pos)), up: [0, 1, 0], fov });
function boardFrame(T, cam, p) {
  GL.frame({ name: "ch1_board", fs: SHADERS.ch1_board, scale: SC(0.55, 1.5),
    uniforms: { uTime: T, uQ: fin() ? 1 : 0, ...camUniforms(cam), uA: [p.beam, p.pool, p.rim, p.knight], uB: [p.glow, p.haze, p.boost ?? 1, p.yaw], uD: [...p.light, p.dark ?? 1] } },
    { bloom: p.bloom ?? 0.55, thresh: 1.0, exposure: p.exposure ?? 1.0, rays: p.rays || [0.5, 0.5, 0], letterbox: LB, vignette: 0.6, grain: 0.03, fade: p.fade ?? 1, lift: p.lift ?? 0, t: T });
  blit();
}

// armillary driver: ring orientations (column-major mat3, world -> ring), unfold scales, spins
const RING_EUL = [[1.2, 0.3, 0.0], [0.35, 1.1, 0.4], [1.57, 0.9, 0.0], [0.75, -0.6, 0.9], [1.95, 2.2, 0.3], [0.25, 0.0, 1.2], [1.5708, 0.35, 0.0]];
function m3mul(A, B) { const R = new Array(9); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { let v = 0; for (let q = 0; q < 3; q++) v += A[q * 3 + i] * B[j * 3 + q]; R[j * 3 + i] = v; } return R; }
const m3x = a => { const c = Math.cos(a), s2 = Math.sin(a); return [1, 0, 0, 0, c, s2, 0, -s2, c]; };
const m3y = a => { const c = Math.cos(a), s2 = Math.sin(a); return [c, 0, -s2, 0, 1, 0, s2, 0, c]; };
const m3z = a => { const c = Math.cos(a), s2 = Math.sin(a); return [c, s2, 0, -s2, c, 0, 0, 0, 1]; };
function armRings(k) {
  const M = [], S = [], SP = [];
  for (let i = 0; i < NRING; i++) {
    const u = ease(clamp((k - 18.35 - 0.3 * i) / 2.6));
    const drift = (k - 18) * (0.025 + 0.006 * i) * (i % 2 ? -1 : 1);
    const e = RING_EUL[i].map((v, j) => lerp(j === 0 ? 1.5708 : 0, v, u) + (j === 1 ? drift : 0));
    M.push(...m3mul(m3mul(m3x(e[0]), m3y(e[1])), m3z(e[2])));
    S.push(u); SP.push((k - 18) * (0.09 + 0.012 * i) * (i % 2 ? 1 : -1) + i * 1.3);
  }
  return { M, S, SP };
}
function armFrame(k, T, cam, p) {
  const tex = GL.canvasTex("ch1_eng", engraving(), { mip: true, repeat: true });
  const r = armRings(k);
  GL.frame({ name: "ch1_armil", fs: SHADERS.ch1_armil, scale: SC(0.55, 1.5), textures: { uEng: tex },
    uniforms: { uTime: T, uQ: fin() ? 1 : 0, ...camUniforms(cam), uRM: { mat3: r.M }, uRS: { float: r.S }, uSp: { float: r.SP }, uA: [p.core, p.flare, p.key, p.env], uB: [p.unfold, fin() ? 1 : (p.shadow ?? 1), 0, 0] } },
    { bloom: p.bloom ?? 0.6, thresh: 1.0, exposure: p.exposure ?? 1.0, rays: [0.5, 0.5, p.rays ?? 0.15], letterbox: LB, vignette: 0.6, grain: 0.03, lift: p.lift ?? 0, fade: p.fade ?? 1, t: T });
  blit();
}
function sceneArmil(k, T) {
  // 18: a single point of light; the bands unfold around it; slow orbit; 28–33.5 close on the engravings; 33.2–34 the core flares to white
  let pos, at, fov;
  const a = lerp(-0.15, 0.85, easeIO(clamp((k - 18) / 16)));
  const d = lerp(4.4, 3.3, easeIO(clamp((k - 18) / 9)));
  if (k < 27) { pos = [Math.sin(a) * d, lerp(0.15, 0.75, easeIO(clamp((k - 18) / 9))), -Math.cos(a) * d]; at = [0, 0, 0]; fov = 1.45; }
  else { const u = easeIO(clamp((k - 27) / 7)); const d2 = lerp(3.3, 2.25, u);
    pos = [Math.sin(a) * d2, lerp(0.75, 0.55, u), -Math.cos(a) * d2]; at = lerp3([0, 0, 0], [0.55, 0.2, 0.1], u); fov = lerp(1.45, 1.7, u); }
  let cam = CAM(pos, at, fov);
  if (DBG().acam) cam = CAM(...DBG().acam);
  const flare = smooth(32.9, 34.0, k);
  armFrame(k, T, cam, { core: 3.0 * smooth(17.6, 18.6, k) + 30 * flare * flare, flare, key: 0.9 * smooth(18.5, 21, k), env: 1.0, unfold: smooth(18.2, 19.5, k), exposure: 1.0 + 1.5 * flare, lift: smooth(33.5, 34.1, k) * 0.9, ...(DBG().ap || {}) });
}

// staircase driver
const SUN_DIR = norm([0.22, 0.74, 1.25]);
function stepTop(j, fx, fz) { return [ST.wd * fx, j * ST.rise + 0.15, j * ST.run + 0.52 * fz]; }
function stairFrame(k, T, cam, p) {
  const q = project(cam, [SUN_DIR[0] * 1000 + cam.pos[0], SUN_DIR[1] * 1000 + cam.pos[1], SUN_DIR[2] * 1000 + cam.pos[2]]);
  const rays = q ? [q[0] / W, 1 - q[1] / H, p.rays ?? 0.3] : [0.5, 0.5, 0];
  GL.frame({ name: "ch1_stairs", fs: SHADERS.ch1_stairs, scale: SC(0.55, 1.5),
    uniforms: { uTime: T, ...camUniforms(cam), uA: [ST.rise, ST.run, ST.wd, p.sun], uB: [p.sea ?? -3.4, 0, p.beam ?? 1, 0], uD: [...SUN_DIR, fin() ? 1 : 0] } },
    { bloom: p.bloom ?? 0.6, thresh: 1.0, exposure: p.exposure ?? 1.0, rays, letterbox: LB, vignette: 0.55, grain: 0.03, lift: p.lift ?? 0, fade: p.fade ?? 1, t: T });
  blit();
}
function stairCam(k) {
  // 34–43: low beside the first steps while the names appear; 43–54: the camera lifts its head up the endless flight
  const u = easeIO(clamp((k - 34) / 9.5));
  let pos = lerp3([6.8, 1.5, -4.8], [6.3, 2.1, -3.2], u), at = lerp3([0, 2.7, 5.0], [0, 3.1, 5.8], u), fov = 1.18;
  const v = easeIO(clamp((k - 43) / 10.5));
  if (v > 0) { pos = lerp3(pos, [3.6, 3.2, -0.5], v); at = lerp3(at, [0, 60 * ST.rise, 60 * ST.run], easeIO(clamp((k - 43.2) / 9.5))); fov = lerp(1.18, 1.1, v); }
  return CAM(pos, at, fov);
}
const STAIR_LABELS = [["개미", 1, 0.6, 35.2], ["닭", 3, 0.55, 36.8], ["침팬지", 6, 0.55, 38.4], ["보통 사람", 9, 0.25, 40.2], ["아인슈타인", 9, 0.9, 40.9]];
function sceneStairs(k, T) {
  let cam = stairCam(k); if (DBG().scam) cam = CAM(...DBG().scam);
  const white = smooth(52.2, 54.2, k);
  stairFrame(k, T, cam, { sun: 1.0 + 0.6 * smooth(44, 51, k) + 5 * white * white, exposure: 1.0 + 0.8 * white, lift: smooth(53.2, 54.3, k), rays: 0.12 + 0.12 * smooth(44, 52, k), bloom: 0.45, ...(DBG().sp || {}) });
  // names on the steps, stuck in 3D
  const fade = 1 - smooth(45, 47.5, k);
  pic(() => STAIR_LABELS.forEach(([s2, j, fx, t0], i) => {
    const a = smooth(t0, t0 + 0.9, k) * fade; if (a <= 0) return;
    const P = project(cam, stepTop(j, fx, -0.55)); if (!P) return;
    const isE = i === 4, isH = i === 3;
    const tx = P[0] + (isH ? -120 : isE ? 120 : 70), ty = P[1] - (isH ? 120 : isE ? 150 : 105);
    label(s2, tx, ty, P[0], P[1], a, 30);
  }));
}

function sceneThree(k, T) {
  const u = easeIO(clamp((k - 54) / 12));
  const cam = CAM(lerp3([0, 1.15, -6.4], [0, 1.0, -5.3], u), [0, 0.72, 0], 1.6);
  const ign = smooth(59.8, 60.9, k);
  const I1 = 1.2 * smooth(55.0, 55.8, k), I2 = 0.35 * smooth(55.8, 56.6, k) + 4.0 * ign, I3 = 0.3 * smooth(56.6, 57.4, k);
  const q = project(cam, [0, 1.02, 0]);
  GL.frame({ name: "ch1_three", fs: SHADERS.ch1_three, scale: SC(0.55, 1.5),
    uniforms: { uTime: T, uQ: fin() ? 1 : 0, ...camUniforms(cam), uA: [I1, I2, I3, ign] } },
    { bloom: 0.6 + 0.3 * ign, thresh: 1.0, exposure: 1.0, rays: q ? [q[0] / W, 1 - q[1] / H, 0.25 * ign] : [0.5, 0.5, 0], letterbox: LB, vignette: 0.6, grain: 0.03, fade: 1 - smooth(65.2, 66.0, k), t: T });
  blit();
}

// ---------------------------------------------------------------- the chapter
const LIGHT = [2.0, 26, 3.0];
const DBG = () => window.CH1DBG || {};
function sceneBoard(k, T) {
  // card (0–6): low over black glass in the dark, the knight still off-frame; the beam ignites ~4.4 and the camera finds it
  // 6–13 slow low orbit from behind its shoulder round to the profile; 13–18 crane up to show how small the lit world is; the pool closes
  const ign = smooth(4.9, 7.0, k);
  let th, rad, y, at, fov;
  if (k < 13) {
    const e = easeIO(clamp(k / 13));
    th = lerp(-1.45, 0.12, e); rad = lerp(4.6, 2.75, e); y = lerp(0.16, 0.42, e); fov = lerp(1.55, 1.62, e);
    const off = 3.6 * (1 - smooth(3.0, 8.5, k));                // look target slides onto the knight
    const side = [Math.cos(th), 0, -Math.sin(th)];
    at = [side[0] * off, lerp(0.22, 0.5, smooth(1, 9, k)), side[2] * off];
  } else {
    const e = easeIO(clamp((k - 13) / 5));
    th = lerp(0.12, 0.5, e); rad = lerp(2.75, 6.6, e); y = lerp(0.42, 8.0, e); fov = lerp(1.62, 1.5, e);
    at = [0, lerp(0.5, 0.0, e), 0];
  }
  let cam = CAM([Math.sin(th) * rad, y, Math.cos(th) * rad], at, fov);
  if (DBG().cam) cam = CAM(...DBG().cam);
  const pool = lerp(1.12, 0.04, easeIn(clamp((k - 15.6) / 2.4)));
  const boost = Math.pow(1.12 / pool, 1.7);
  boardFrame(T, cam, { beam: 1.8 * ign, pool, boost: Math.min(boost, 600), rim: 0.8 * smooth(5, 8, k), knight: 1, glow: lerp(1.0, 0.18, smooth(5, 9, k)), haze: 0.024 * ign * (1 - smooth(15.5, 17.5, k) * 0.6), yaw: 0, light: LIGHT, exposure: 1.0, ...(DBG().p || {}) });
}

chapter("ch1", 66, (k, T) => {
  if (k < 17.7) sceneBoard(k, T);
  else if (k < 18.3) { sceneBoard(k, T); const tmp = snapshot(); sceneArmil(k, T); o.save(); o.globalAlpha = 1 - smooth(17.7, 18.3, k); o.drawImage(tmp, 0, 0); o.restore(); }
  else if (k < 34.2) sceneArmil(k, T);
  else if (k >= 54.2) { sceneThree(k, T); if (k < 55.2) { o.save(); o.globalAlpha = 1 - smooth(54.2, 55.2, k); o.fillStyle = "#fff8ec"; o.fillRect(0, BAR, W, H - 2 * BAR); o.restore(); } }
  if (k >= 34.2 && k < 54.2) { sceneStairs(k, T); if (k < 34.9) { o.save(); o.globalAlpha = 1 - smooth(34.2, 34.9, k); o.fillStyle = "#fff8ec"; o.fillRect(0, BAR, W, H - 2 * BAR); o.restore(); } }
  chapterCard(k, "I", "세 개의 단어");
  caption(k, 7.0, 11.4, (a, u) => capB("*AI* — 한 가지만 잘하는 천재", a, u));
  caption(k, 12.0, 17.2, (a, u) => capB("체스는 *세계 최강*. 하지만 커피 한 잔도 못 탄다", a, u));
  caption(k, 19.0, 23.3, (a, u) => capB("*AGI* — 사람이 하는 거의 모든 지적인 일을", a, u));
  caption(k, 23.6, 26.8, (a, u) => capB("*사람만큼* 해내는 지능", a, u));
  caption(k, 27.6, 33.4, (a, u) => capT("OpenAI 헌장", a, u));
  caption(k, 27.6, 33.4, (a, u) => capB("“대부분의 경제적 가치가 있는 일에서 *인간을 능가하는* 시스템”", a, u));
  caption(k, 42.8, 45.6, (a, u) => capB("*ASI* — 모든 분야에서", a, u));
  caption(k, 45.8, 48.9, (a, u) => capB("인류 최고의 천재보다 *훨씬 뛰어난* 지능", a, u));
  caption(k, 49.1, 51.8, (a, u) => capB("개미가 인간을 이해할 수 없듯이", a, u));
  caption(k, 52.0, 55.2, (a, u) => capB("우리는 그것을 *이해할 수 없을지도* 모른다", a, u));
  caption(k, 55.6, 59.6, (a, u) => capB("AI → AGI → *ASI*", a, u, { slam: true }));
  caption(k, 60.0, 64.8, (a, u) => capB("연구소 깊은 곳에서, 우리는 *이미 AGI*에 닿았다", a, u));
});
// copy of the current 2D frame (used under cross-dissolves)
let SNAP = null;
function snapshot() { if (!SNAP) { SNAP = document.createElement("canvas"); SNAP.width = W; SNAP.height = H; } const x = SNAP.getContext("2d"); x.clearRect(0, 0, W, H); x.drawImage(out, 0, 0); return SNAP; }
})();
