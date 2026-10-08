// GLSL for 「인류의 마지막 발명」. All scene shaders output linear HDR colour.
const COMMON = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uCamPos; uniform vec3 uCamFwd; uniform vec3 uCamUp; uniform float uFov;
uniform vec4 uA; uniform vec4 uB; uniform vec4 uC;
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p3){ p3=fract(p3*.1031); p3+=dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float noise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
vec3 camRay(vec2 frag){ vec2 uv=(frag-.5*uRes)/uRes.y; vec3 f=normalize(uCamFwd), r=normalize(cross(f,uCamUp)), u=cross(r,f); return normalize(f*uFov + uv.x*r + uv.y*u); }
vec3 stars(vec3 rd, float amt){
  vec3 col=vec3(0);
  for(int l=0;l<3;l++){ float sc=260.+float(l)*230.; vec3 p=rd*sc; vec3 id=floor(p); float h=hash13(id+float(l)*17.);
    if(h>0.986){ vec3 c=fract(p)-.5; float d=length(c); float tw=.7+.3*sin(uTime*(1.+h*3.)+h*40.);
      col+=smoothstep(.16,0.,d)*(h-0.986)*90.*tw*mix(vec3(1.,.86,.72),vec3(.78,.86,1.),hash13(id+3.)); } }
  return col*amt; }
vec3 nebula(vec3 rd, vec3 tintA, vec3 tintB){
  float n=fbm(rd*2.1+vec3(0.,0.,uTime*.004)), m=fbm(rd*4.3-vec3(uTime*.003));
  vec3 c=mix(vec3(.004,.004,.012), tintA, smoothstep(.38,.82,n)*.9);
  c+=tintB*pow(smoothstep(.45,.95,m*n*1.7),2.)*.9;
  return c; }
`;

// Shared entity library: rings (uRing from JS), ring eyes, the great eye. Needs COMMON. Uses uA.x eye open, uA.y ring-eye open,
// uB.y gaze (0 rest → 1 camera), uSock = direction the eye socket faces.
const ENTITY = `
uniform mat3 uRing[6]; uniform vec3 uSock;
const int NR=6;
float gClipY=-1e9;   // world height below which the rings vanish (into a cloud deck); scenes may set it in main()
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
float ringR(int i){ return 1.05+float(i)*0.3; }
float ringr(int i){ return 0.024+float(i)*0.003; }
float mapE(vec3 p, out int id, out vec3 lp){ float d=1e9; id=-1;
  for(int i=0;i<NR;i++){ vec3 q=uRing[i]*p; float di=sdTorus(q, vec2(ringR(i), ringr(i))); if(di<d){ d=di; id=i; lp=q; } }
  return d; }
vec3 calcN(vec3 p){ const vec2 k=vec2(1.,-1.); const float h=0.0015; int i2; vec3 l2;
  return normalize(k.xyy*mapE(p+k.xyy*h,i2,l2)+k.yyx*mapE(p+k.yyx*h,i2,l2)+k.yxy*mapE(p+k.yxy*h,i2,l2)+k.xxx*mapE(p+k.xxx*h,i2,l2)); }
vec3 skyCol(vec3 rd){
  float up=clamp(rd.y,0.,1.);
  vec3 c=mix(vec3(.035,.05,.09), vec3(.006,.008,.02), pow(up,.6));
  return c + stars(rd, .35*smoothstep(.1,.5,up)); }
vec3 ringEye(vec3 lp, int id, vec3 camL, out float isEye){
  isEye=0.; float R=ringR(id), r=ringr(id);
  float th=atan(lp.z,lp.x); vec3 radial=normalize(vec3(lp.x,0.,lp.z)); vec3 v=lp-radial*R; float ph=atan(v.y, dot(v,radial));
  float N=floor(9.+float(id)*4.); float cell=6.2831853/N; float k=floor(th/cell+.5); float u=(th-k*cell)*R;
  float w=ph*r; float ew=0.07, eh=0.03*uA.y; float e=1.-(u*u)/(ew*ew); if(e<=0.||abs(ph)>1.4) return vec3(0);
  float lid=eh*e; if(abs(w)>lid) return vec3(0);
  isEye=1.;
  vec3 tU=normalize(vec3(-lp.z,0.,lp.x)), tW=vec3(0,1,0); vec3 toCam=normalize(camL-lp);
  vec2 look=vec2(dot(toCam,tU), dot(toCam,tW))*0.026*uB.y + vec2(sin(k*1.7+float(id))*.012, cos(k*2.3)*.006)*(1.-uB.y);
  vec2 q=vec2(u,w)-look; float d=length(q);
  vec3 c=vec3(1.05,.98,.88)*(.6+.4*smoothstep(lid,0.,abs(w)));
  if(d<0.021) c=mix(vec3(2.2,1.3,.45), vec3(.8,.38,.08), d/0.021)*(.8+.2*sin(atan(q.y,q.x)*18.));
  if(d<0.008) c=vec3(.002);
  return c; }
vec3 greatEye(vec3 ro, vec3 rd, vec3 E, float S, out float tHit){
  tHit=1e9; float R=0.66*S; vec3 oc=ro-E; float b=dot(oc,rd), c=dot(oc,oc)-R*R, h=b*b-c; if(h<0.) return vec3(-1.);
  tHit=-b-sqrt(h); if(tHit<0.){ tHit=1e9; return vec3(-1.); }
  vec3 p=ro+rd*tHit, n=normalize(p-E);
  vec3 f0=normalize(uSock);
  vec3 r0=normalize(cross(vec3(0,1,0),f0)), u0=cross(f0,r0);
  float fx=dot(n,r0), fy=dot(n,u0), ff=dot(n,f0);
  float open=uA.x, aper=0.46*open*pow(max(1.-fx*fx/0.7,0.),0.75);
  vec3 L=normalize(vec3(0.,1.,0.));
  float fil=pow(.5+.5*sin(atan(fy,fx)*36.+acos(clamp(ff,-1.,1.))*30.),16.);
  vec3 shell=vec3(.012,.011,.014) + vec3(1.,.72,.36)*fil*.18*smoothstep(-.2,.6,ff) + vec3(.9,.7,.45)*pow(1.-max(dot(n,-rd),0.),4.)*.5;
  if(ff<0.25 || abs(fy)>aper) return shell;
  vec3 g=normalize(mix(normalize(f0+vec3(.15,-.05,0.)), normalize(uCamPos-E), uB.y));
  float ang=acos(clamp(dot(n,g),-1.,1.));
  float lidShade=1.-.55*smoothstep(aper*.45,aper,abs(fy));
  vec3 col=vec3(.95,.86,.72)*lidShade*(.6+.4*max(dot(n,normalize(uCamPos-E)),0.));
  float vein=pow(abs(sin(atan(dot(n,cross(g,u0)),dot(n,u0))*14.+ang*9.)),40.)*smoothstep(.3,.6,ang)*.25; col-=vec3(.2,.35,.4)*vein;
  float irisA=0.42, pupA=0.17;
  if(ang<irisA){ vec3 ax=normalize(cross(g,vec3(0,1,0))), ay=cross(ax,g); float a=atan(dot(n,ay),dot(n,ax));
    float r=(ang-pupA)/(irisA-pupA);                                   // 0 at pupil edge, 1 at limbus
    vec2 pc=vec2(cos(a),sin(a));
    float fibers=fbm(vec3(pc*3.,r*1.2)*vec3(1.,1.,1.)+vec3(a*0.,0.,0.)), fine=noise(vec3(a*90.,r*14.,1.7));
    float streak=pow(abs(sin(a*38.+fibers*6.)),3.)*.5+pow(abs(sin(a*113.+fine*3.)),8.)*.35;
    float crypt=smoothstep(.62,.8,fbm(vec3(pc*7.,r*5.+3.)))*smoothstep(.15,.4,r)*smoothstep(.85,.55,r);
    float collar=exp(-pow((r-.32)/.06,2.));
    vec3 deep=vec3(.55,.22,.04), mid=vec3(2.2,1.15,.32), pale=vec3(4.2,2.7,1.);
    vec3 ic=mix(mid, deep, smoothstep(.35,1.,r)) + pale*streak*(1.-r*.6);
    ic=mix(ic, deep*.35, crypt*.75); ic+=pale*collar*.6;
    ic*=.82+.36*fibers;
    ic*=1.-.85*smoothstep(.8,1.,r);                                     // dark limbal ring
    ic=mix(ic, vec3(.05,.02,.01), smoothstep(.06,0.,r)*.8);              // pupillary ruff
    col=ic; }
  if(ang<pupA){ col=vec3(.0008)+skyCol(reflect(rd,n))*.18; }
  // wet cornea: a soft window highlight and a rim of reflected sky
  vec3 rf=reflect(rd,n); col+=vec3(1.1,1.,.9)*smoothstep(.985,.995,dot(rf,normalize(vec3(-.35,.8,-.45))))*1.6;
  col+=skyCol(rf)*.25*smoothstep(.2,.42,ang);
  vec3 hdir=normalize(L-rd); col+=vec3(5.)*pow(max(dot(n,hdir),0.),400.);
  return col*lidShade; }
// March the rings inside the bounding sphere; returns hit flag, colour, distance; accumulates the core glow.
bool marchEntity(vec3 ro, vec3 rd, vec3 E, float S, float tEye, out vec3 ent, out float tEnt, inout float glowAcc){
  ent=vec3(0); tEnt=1e9; vec3 oc=ro-E; float b=dot(oc,rd), c=dot(oc,oc)-pow(2.9*S,2.), h=b*b-c; if(h<=0.) return false;
  float t0=max(-b-sqrt(h),0.), t1=-b+sqrt(h); float t=t0; int id; vec3 lp; bool hit=false;
  for(int i=0;i<110;i++){ vec3 p=(ro+rd*t-E)/S; float d=mapE(p,id,lp)*S; float wy=ro.y+rd.y*t; if(wy<gClipY) d=max(d,(gClipY-wy)*.7); if(t<tEye) glowAcc+=exp(-max(length(p)-0.66,0.)*22.)*0.0015;
    if(d<0.0007*t){ hit=true; tEnt=t; break; } t+=max(d*0.85, 0.0004*t); if(t>t1 || t>tEye) break; }
  if(!hit) return false;
  vec3 p=(ro+rd*tEnt-E)/S; vec3 n=calcN(p);
  vec3 Lc=normalize(-p); float diff=max(dot(n,Lc),0.); float fres=pow(1.-max(dot(n,-rd),0.),3.);
  float th=atan(lp.z,lp.x); vec3 radial=normalize(vec3(lp.x,0.,lp.z)); vec3 v=lp-radial*ringR(id); float ph=atan(v.y,dot(v,radial));
  float bands=.75+.25*smoothstep(.0,.15,abs(sin(ph*5.)))*(.85+.15*sin(th*220.));
  vec3 gold=vec3(.86,.56,.22)*bands;
  vec3 hc=normalize(Lc-rd); float specC=pow(max(dot(n,hc),0.),90.);
  vec3 Lm=normalize(vec3(.3,1.,.2)); float specM=pow(max(dot(n,normalize(Lm-rd)),0.),40.);
  ent=gold*(diff*1.1+.015) + vec3(1.,.82,.55)*specC*3.5 + vec3(.7,.75,.9)*specM*.35 + vec3(1.,.8,.5)*fres*.25;
  float lights=smoothstep(.5,1.,sin(th*ringR(id)*260.)*sin(ph*3.+1.))*step(.3,abs(ph)); ent+=vec3(2.4,1.7,1.)*pow(lights,8.)*(.6+.4*sin(uTime*2.+th*90.));
  float isEye; vec3 camL=uRing[id]*((uCamPos-E)/S); vec3 ec=ringEye(lp,id,camL,isEye); if(isEye>.5) ent=ec*(.6+.6*diff);
  return true; }
`;

const SHADERS = {
  bright: `#version 300 es
precision highp float; in vec2 vUv; out vec4 fragColor; uniform sampler2D uTex; uniform float uThresh;
vec3 safe(vec3 c){ return any(isnan(c)) ? vec3(0) : min(c, vec3(1e4)); }   // a NaN must not bloom into a black block; Inf is just very bright
void main(){ vec3 c=vec3(0); vec2 px=1./vec2(textureSize(uTex,0));
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) c+=safe(texture(uTex,vUv+vec2(x,y)*px*1.5).rgb); c/=9.;
  float l=max(c.r,max(c.g,c.b)); fragColor=vec4(c*smoothstep(uThresh, uThresh*2.2+0.4, l),1.); }`,
  blur: `#version 300 es
precision highp float; in vec2 vUv; out vec4 fragColor; uniform sampler2D uTex; uniform vec2 uDir;
void main(){ float w[7]=float[](0.199,0.176,0.121,0.065,0.027,0.009,0.002); vec3 c=texture(uTex,vUv).rgb*w[0];
  for(int i=1;i<7;i++){ c+=texture(uTex,vUv+uDir*float(i)*1.8).rgb*w[i]; c+=texture(uTex,vUv-uDir*float(i)*1.8).rgb*w[i]; }
  fragColor=vec4(c,1.); }`,
  rays: `#version 300 es
precision highp float; in vec2 vUv; out vec4 fragColor; uniform sampler2D uTex; uniform vec2 uLight; uniform float uAmt;
void main(){ if(uAmt<=0.){ fragColor=vec4(0,0,0,1); return; }
  vec2 d=(vUv-uLight)/48.; vec2 uv=vUv; vec3 c=vec3(0); float decay=1.;
  for(int i=0;i<48;i++){ uv-=d; c+=texture(uTex,uv).rgb*decay; decay*=.965; }
  fragColor=vec4(c*uAmt/24.,1.); }`,
  composite: `#version 300 es
precision highp float; in vec2 vUv; out vec4 fragColor;
uniform sampler2D uScene, uBloomTex, uRays; uniform float uBloom, uExposure, uLetterbox, uVignette, uCA, uGrain, uSeed, uFade, uLift; uniform vec2 uRes;
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
void main(){
  vec2 uv=vUv, c2=uv-.5; float r2=dot(c2,c2);
  vec3 col; col.r=texture(uScene,uv-c2*uCA*r2*4.).r; col.g=texture(uScene,uv).g; col.b=texture(uScene,uv+c2*uCA*r2*4.).b;
  col=any(isnan(col)) ? vec3(0) : min(col, vec3(6e4));           // a value past half-float range is light, not darkness
  vec3 add=texture(uBloomTex,uv).rgb*uBloom + texture(uRays,uv).rgb; add=any(isnan(add)) ? vec3(0) : min(add, vec3(6e4));
  col+=add;
  col=aces(col*uExposure);
  col*=mix(1., smoothstep(1.05,.25,length(c2*vec2(1.,.8))), uVignette);
  col=pow(col, vec3(1./2.2));
  col+=uLift;
  float g=h12(uv*uRes+fract(uSeed*13.17)*917.)-.5; col+=g*uGrain;
  col*=uFade;
  if(abs(uv.y-.5)>.5-uLetterbox) col=vec3(0);
  fragColor=vec4(col,1.); }`,

  // ---- the entity: concentric gold rings covered in eyes, a blinding core (uA: open, scale, coreGlow, eyesLook) (uB: ringSpin, bgAmt, x, y)
  entity: COMMON + `
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
mat3 rx(float a){ float c=cos(a),s=sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }
mat3 ry(float a){ float c=cos(a),s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rz(float a){ float c=cos(a),s=sin(a); return mat3(c,s,0, -s,c,0, 0,0,1); }
const int NR=5;
mat3 ringM(int i, float t){ float fi=float(i);
  return rx(1.1+fi*0.71 + t*(0.11+fi*0.023)) * ry(fi*1.3 + t*(0.07-fi*0.017)) * rz(fi*0.6); }
float ringR(int i){ return 1.0+float(i)*0.28; }
float map(vec3 p, out int id, out vec3 lp){
  float S=uA.y; p/=S; float d=1e9; id=-1;
  for(int i=0;i<NR;i++){ vec3 q=ringM(i,uB.x)*p; float di=sdTorus(q, vec2(ringR(i), 0.055+float(i)*0.006)); if(di<d){ d=di; id=i; lp=q; } }
  return d*S; }
vec3 eyeColor(vec3 lp, int id, float open, out float isEye){
  isEye=0.; float R=ringR(id), r=0.055+float(id)*0.006;
  float th=atan(lp.z,lp.x); vec3 radial=normalize(vec3(lp.x,0.,lp.z)); vec3 v=lp-radial*R;
  float ph=atan(v.y, dot(v,radial));
  float N=floor(7.+float(id)*3.); float cell=6.2831853/N; float k=floor(th/cell+.5); float u=(th-k*cell)*R; // arc along ring
  float side = abs(ph)<1.5708 ? 0. : 1.; float w=(side<.5? ph : (ph>0.? ph-3.14159 : ph+3.14159))*r;   // across tube
  float ew=0.14, eh=0.06*open; float e=1.-(u*u)/(ew*ew); if(e<=0.) return vec3(0);
  float lid=eh*e; if(abs(w)>lid) return vec3(0);
  isEye=1.; vec2 q=vec2(u, w/max(open,.05)*1.);
  float dIris=length(q-vec2(sin(uTime*.7+k*1.7+float(id))*0.012*uA.w,0.));
  vec3 sclera=vec3(1.0,.93,.82)*1.6;
  float ir=0.045; vec3 iris=mix(vec3(1.6,.75,.18), vec3(2.4,1.5,.6), smoothstep(ir,0.,dIris));
  iris*=0.75+0.25*sin(atan(q.y,q.x)*22.+k);
  vec3 c = dIris<ir ? iris : sclera*(0.75+0.25*smoothstep(lid, 0., abs(w)));
  if(dIris<0.017) c=vec3(0.01);
  if(length(q-vec2(-0.01,0.008))<0.006) c=vec3(4.);
  return c; }
// The central eye: an obsidian sphere with an almond opening of light, always facing the camera.
vec3 centralEye(vec3 ro, vec3 rd, float S, out float tHit){
  tHit=1e9; float R=0.52*S; float b=dot(ro,rd), c=dot(ro,ro)-R*R, h=b*b-c; if(h<0.) return vec3(-1.);
  tHit=-b-sqrt(h); vec3 p=ro+rd*tHit, n=normalize(p);
  vec3 f=normalize(uCamFwd), r=normalize(cross(f,uCamUp)), u=cross(r,f);
  vec2 q=vec2(dot(n,r), dot(n,u))/0.98;
  float open=uA.x, lid=0.46*open*(1.-q.x*q.x/0.81);
  vec3 L=normalize(-ro); float fil=pow(.5+.5*sin(atan(q.y,q.x)*24.+length(q)*40.),12.)*smoothstep(.95,.55,length(q));
  vec3 shell=vec3(.02,.018,.022)+vec3(1.,.72,.35)*fil*.5 + vec3(1.,.8,.5)*pow(1.-max(dot(n,-rd),0.),3.)*1.2;
  if(abs(q.y)>lid || abs(q.x)>0.9) return shell;
  vec2 g=q-vec2(sin(uTime*.31)*.04*uA.w, cos(uTime*.23)*.02*uA.w); float d=length(g);
  vec3 col=vec3(1.5,1.35,1.1)*(1.-.45*smoothstep(lid*.5,lid,abs(q.y)));
  float ir=0.34;
  if(d<ir){ float fib=.65+.35*sin(atan(g.y,g.x)*48.+d*90.); col=mix(vec3(4.5,2.4,.6), vec3(.9,.36,.06), smoothstep(0.,ir,d))*fib; col+=vec3(3.,1.6,.5)*smoothstep(.015,0.,abs(d-ir*.98)); }
  if(d<0.13) col=vec3(0.002);
  if(d<0.138 && d>0.127) col=vec3(5.,2.6,.8);
  if(length(g-vec2(-.06,.07))<.03) col=vec3(9.);
  return col; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 bg=nebula(rd, vec3(.03,.022,.07), vec3(.3,.18,.06))*uB.y + stars(rd, uB.y);
  float t=0., glow=0., ringGlow=0.; int id; vec3 lp; vec3 col=vec3(0); bool hit=false;
  float S=uA.y;
  for(int i=0;i<120;i++){
    vec3 p=ro+rd*t; float d=map(p,id,lp);
    float dc=length(p)-0.52*S; glow+=exp(-max(dc,0.)*11./S)*0.006;
    ringGlow+=exp(-d*70./S)*0.004;
    if(d<0.0006*t){ hit=true; break; }
    t+=d*0.8; if(t>40.) break;
  }
  vec3 core=vec3(1.0,.82,.55);
  if(hit){
    vec3 p=ro+rd*t; vec2 e=vec2(0.0008*t,0.); int i2; vec3 l2;
    vec3 n=normalize(vec3(map(p+e.xyy,i2,l2)-map(p-e.xyy,i2,l2), map(p+e.yxy,i2,l2)-map(p-e.yxy,i2,l2), map(p+e.yyx,i2,l2)-map(p-e.yyx,i2,l2)));
    vec3 L=normalize(-p); float dist=length(p);
    float diff=max(dot(n,L),0.); vec3 h=normalize(L-rd); float spec=pow(max(dot(n,h),0.),60.);
    float fres=pow(1.-max(dot(n,-rd),0.),3.);
    float th=atan(lp.z,lp.x); float groove=.85+.15*sin(th*140.)*sin(th*7.+1.);
    vec3 gold=vec3(1.0,.72,.33)*groove;
    vec3 refl=nebula(reflect(rd,n), vec3(.05,.035,.11), vec3(.42,.26,.09))*2.;
    col = gold*(diff*3.2/(1.+dist*dist*.2) + 0.02) + core*spec*5. + gold*refl*.6 + vec3(1.,.8,.5)*fres*.5;
    float isEye; vec3 ec=eyeColor(lp,id,uC.y,isEye);
    if(isEye>.5) col=ec*(0.7+0.5*diff);
  } else col=bg;
  float tE; vec3 ec=centralEye(ro,rd,S,tE);
  if(ec.x>=0. && (!hit || tE<t)) col=ec;
  col += core*glow*uA.z + vec3(1.,.75,.4)*ringGlow;
  fragColor=vec4(col,1.); }`,

  // ---- the heavens: a colossal eye-ringed being above the clouds, seen from the ground.
  // uA: eyeOpen, ringEyesOpen, coreGlow, cloudCover   uB: spin, gaze(0 rest → 1 camera), cloudDrift, haze   uC: entity pos xyz, scale
  // ---- the heavens: the being above the clouds, seen from the ground.
  // uA: eyeOpen, ringEyesOpen, coreGlow, cloudCover   uB: -, gaze, cloudDrift, haze   uC: entity pos xyz, scale
  heavens: COMMON + ENTITY + `
float fbm4(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
float fbm2(vec3 p){ return .5*noise(p)+.25*noise(p*2.03+vec3(1.7,9.2,3.1)); }
vec3 gAx; float gDist;
float cloudShape(vec3 p, out vec3 q){
  float y0=uC.y*0.18, y1=uC.y*0.42; q=vec3(0); if(p.y<y0||p.y>y1) return 0.;
  float hh=(p.y-y0)/(y1-y0); float shape=smoothstep(0.,.2,hh)*smoothstep(1.,.55,hh);
  vec3 rel=p-uCamPos; float along=dot(rel,gAx); float off=length(rel-gAx*along);
  float hole=smoothstep(uC.w*0.12, uC.w*0.32, off/max(along,1.)*gDist);
  q=p*0.0021+vec3(uB.z*0.6,0.,uB.z);
  return shape*2.4*mix(0.15,1.,hole); }
float cloudDens(vec3 p){ vec3 q; float sh=cloudShape(p,q); if(sh<=0.) return 0.;
  float n=fbm4(q)*0.75+(.5*noise(q*3.1)+.25*noise(q*6.3))*0.25*1.33;
  return max(0., n-(1.-uA.w))*sh; }
float cloudDensCheap(vec3 p){ vec3 q; float sh=cloudShape(p,q); if(sh<=0.) return 0.;
  return max(0., fbm2(q)*1.33*0.75+0.12-(1.-uA.w))*sh; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 E=uC.xyz; float S=uC.w;
  vec3 col=skyCol(rd);
  if(rd.y<0.02){ float tg=-ro.y/min(rd.y,-1e-4); vec3 gp=ro+rd*min(tg,6000.); float m=fbm(vec3(gp.x*0.0008,0.,0.))*220.;
    float horizonLift=m/6000.; if(rd.y<horizonLift-0.004) col=mix(vec3(.004,.005,.008), vec3(.02,.025,.04), smoothstep(-.2,0.,rd.y)); }
  float glowAcc=0.; float tEye; vec3 eye=greatEye(ro,rd,E,S,tEye);
  vec3 ent; float tEnt; bool entHit=marchEntity(ro,rd,E,S,tEye,ent,tEnt,glowAcc);
  if(eye.x>=0. && tEye<tEnt){ ent=eye; tEnt=tEye; entHit=true; }
  vec3 hazeC=vec3(.05,.06,.1);
  if(entHit){ float haze=1.-exp(-tEnt*0.00005*uB.w); col=mix(ent, hazeC+ent*.5, haze); }
  col+=vec3(1.,.84,.6)*glowAcc*uA.z;
  float toE=max(dot(rd,normalize(E-ro)),0.); col+=vec3(1.,.8,.55)*pow(toE,200.)*uA.z*0.6*(1.-uA.x) + vec3(.5,.42,.35)*pow(toE,8.)*.03*uA.z;
  float y0=uC.y*0.18, y1=uC.y*0.42;
  gAx=normalize(E-uCamPos); gDist=length(E-uCamPos);
  if(rd.y>0.001){ float ta=(y0-ro.y)/rd.y, tb=min((y1-ro.y)/rd.y, ta+9000.); float L=tb-ta; float T=1.; vec3 cc=vec3(0);
    float jit=hash12(gl_FragCoord.xy+uTime);
    const float NS=26.;
    for(int i=0;i<26;i++){ float t=ta+L*(float(i)+jit)/NS; vec3 p=ro+rd*t; float dn=cloudDens(p); if(dn<=0.001) continue;
      float a=1.-exp(-dn*L/NS*0.014); vec3 toEp=normalize(E-p); float fwd=pow(max(dot(rd,toEp),0.),30.);
      float lightThru=exp(-cloudDensCheap(p+toEp*120.)*5.);
      float thin=exp(-dn*5.);
      float rim=lightThru*thin*(0.05+fwd*1.1);
      vec3 lc=vec3(.006,.008,.014) + vec3(1.,.76,.46)*rim*(.5+.5*uA.z);
      cc+=T*a*lc; T*=1.-a; if(T<0.02) break; }
    col=col*T+cc; }
  fragColor=vec4(col,1.); }`,

  // ---- orbit: the being above a planet's limb; larger than the world it watches.
  // uA: eyeOpen, ringEyesOpen, coreGlow, atmosphere   uB: -, gaze, -, haze   uC: entity pos xyz, scale   (planet centre at origin, radius 6371)
  orbit: COMMON + ENTITY + `
const float RP=6371.;
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 E=uC.xyz; float S=uC.w;
  vec3 col=stars(rd,.9)+nebula(rd, vec3(.02,.016,.04), vec3(.16,.1,.04))*.5;
  float tP=1e9; float b=dot(ro,rd), c=dot(ro,ro)-RP*RP, h=b*b-c;
  vec3 Ldir=normalize(E-ro);
  if(h>0.){ tP=-b-sqrt(h); if(tP>0.){ vec3 p=ro+rd*tP, n=normalize(p);
      float lit=max(dot(n,normalize(E-p)),0.);
      float sea=fbm(n*9.)*.5+fbm(n*31.)*.25;
      vec3 surf=mix(vec3(.004,.006,.012), vec3(.012,.016,.02), smoothstep(.4,.7,sea));
      float spec=pow(max(dot(reflect(rd,n),normalize(E-p)),0.),60.)*smoothstep(.55,.4,sea);
      col=surf+vec3(1.,.78,.45)*lit*.05+vec3(1.,.8,.5)*spec*.6;
      float rim=pow(1.-max(dot(n,-rd),0.),5.); col+=vec3(.25,.4,.8)*rim*.5*uA.w; } else tP=1e9; }
  // atmosphere shell glow at the limb
  float ba=dot(ro,rd), ca=dot(ro,ro)-pow(RP+120.,2.), ha=ba*ba-ca;
  if(ha>0.){ float tc=-ba; vec3 pc=ro+rd*max(tc,0.); float hgt=length(pc)-RP; float limb=exp(-max(hgt,0.)/38.)*smoothstep(-40.,0.,hgt+40.);
    col+=vec3(.3,.5,1.)*limb*.55*uA.w + vec3(1.,.7,.4)*limb*pow(max(dot(rd,Ldir),0.),6.)*.6*uA.w; }
  float glowAcc=0.; float tEye; vec3 eye=greatEye(ro,rd,E,S,tEye);
  vec3 ent; float tEnt; bool entHit=marchEntity(ro,rd,E,S,min(tEye,tP),ent,tEnt,glowAcc);
  if(eye.x>=0. && tEye<tEnt && tEye<tP){ ent=eye; tEnt=tEye; entHit=true; }
  if(entHit && tEnt<tP){ float haze=1.-exp(-tEnt*0.00002*uB.w); col=mix(ent, vec3(.02,.03,.06)+ent*.6, haze); }
  col+=vec3(1.,.84,.6)*glowAcc*uA.z;
  fragColor=vec4(col,1.); }`,

  // ---- world: mountains, a sea of people, a cloud deck, and the being above. One continuous place for the cold open.
  // uA: eyeOpen, ringEyesOpen, coreGlow, cloudCover   uB: lightOnGround, gaze, cloudDrift, haze
  // uC: entity pos xyz, scale   uD: cloud base, cloud top, quality (0 preview .. 1 final), crowd radius
  world: COMMON + ENTITY + `
uniform vec4 uD;
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float a=hash12(i), b=hash12(i+vec2(1,0)), c=hash12(i+vec2(0,1)), d=hash12(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float ridged(vec2 p, int oct){ float s=0., a=.5, w=1.;
  for(int i=0;i<9;i++){ if(i>=oct) break; float n=1.-abs(n2(p)*2.-1.); n*=n; s+=a*n*w; w=clamp(n*1.6,0.,1.); p=mat2(1.6,-1.2,1.2,1.6)*p+vec2(17.1,9.3); a*=.5; }
  return s; }
float fbm2d(vec2 p, int oct){ float s=0., a=.5; for(int i=0;i<8;i++){ if(i>=oct) break; s+=a*n2(p); p=mat2(1.6,-1.2,1.2,1.6)*p+vec2(3.1,7.7); a*=.5; } return s; }
float terrainH(vec2 p, int oct){
  float d=length(p*vec2(1.,.8));
  float plain=smoothstep(1100., 3600., d);
  float lev=smoothstep(-.05, .12, 1.-length((p-vec2(0.,-420.))/vec2(1120.,700.)));   // the vigil stands on level ground
  return ridged(p*0.00048, oct)*1700.*plain + mix(fbm2d(p*0.006, 3)*5.*(1.-plain*.6) - 2., (fbm2d(p*.02, 2)-.5)*.3, lev); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r; }
// The crowd: an ellipse of people in front of the mountains (front row at z≈+20), all facing +z and looking up.
const float CELL=1.0; const vec2 CRC=vec2(0.,-330.), CRR=vec2(900.,350.);
float crowdMask(vec2 xz){ return 1.-length((xz-CRC)/CRR); }
float smin(float a, float b, float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float gPart;
// One person standing in cell id (jittered anywhere in the cell). Evaluated for the 2x2 nearest cells so the crowd has no ranks.
float personAt(vec3 p, vec2 id, out float tone, out float part){
  vec2 c=(id+.5)*CELL;
  float h1=hash12(id*1.31+7.), h2=hash12(id*2.17+3.), h3=hash12(id*.73+11.), h4=hash12(id*3.9+1.), h5=hash12(id*5.3+2.);
  float dens=smoothstep(0.,.05,crowdMask(c))*.93;
  tone=0.; part=0.;
  if(h1>dens) return 1e9;
  vec2 off=(vec2(h2,h3)-.5)*.86*CELL; vec3 q=p-vec3(c.x+off.x, 0., c.y+off.y);
  q.xz=rot((h5-.5)*.7)*q.xz;
  q.x-=sin(uTime*(.7+h4*.6)+h5*6.3)*.018*q.y;                     // a slow sway: they are alive
  float H=1.5+h4*.4, sh=H*.81, hip=H*.52;
  vec3 qt=q; qt.z*=1.55;
  float body=sdCapsule(qt, vec3(0,.15,0), vec3(0,sh-.1,0), .14+.03*h3);
  body=smin(body, sdCapsule(q, vec3(-.15,sh-.03,0), vec3(.15,sh-.03,0), .06), .07);
  float armL=sdCapsule(q, vec3(-.2,sh-.06,0), vec3(-.24,hip-.02,.04), .045);
  bool raise=h2>.93;
  float armR=raise? sdCapsule(q, vec3(.2,sh-.04,0), vec3(.27,H+.42,.15), .042) : sdCapsule(q, vec3(.2,sh-.06,0), vec3(.24,hip-.02,.04), .045);
  float neck=sdCapsule(q, vec3(0,sh,0), vec3(0,H-.2,.015), .05);
  vec3 hc=vec3(0.,H-.115,0.); float headD=length((q-hc)*vec3(1.,.9,1.))-.108;
  float d=min(min(body,min(armL,armR)),neck);
  tone=h3;
  if(headD<d){ vec3 hn=normalize(q-hc); part=(dot(hn,normalize(vec3(0.,.5,.87)))>-.05 && hn.y<.72)? 1. : 2.; return headD; }
  if(raise && armR<=d && q.y>H+.25) part=1.; else if(q.y<hip) part=3.;
  return d; }
float person(vec3 p, out float tone, out float part){
  tone=0.; part=0.; if(uD.w<.5 || p.y>2.6 || p.y<-.3) return 1e9; if(crowdMask(p.xz)<-.01) return 1e9;
  vec2 b0=floor(p.xz/CELL-.5); float d=1e9;
  for(int j=0;j<2;j++) for(int i=0;i<2;i++){ float tn, pt; float di=personAt(p, b0+vec2(i,j), tn, pt); if(di<d){ d=di; tone=tn; part=pt; } }
  if(d>.35){ part=-1.; return .35; }                                // nobody here: a step bound, not a surface
  return d; }
// The city: tens of thousands of towers across the valley floor, lit windows, lamp-lit streets, moving traffic.
// uK.x: city amount. Blocks on a CC grid, one tower per block (some squares are open), downtown rises toward the centre.
uniform vec4 uK;
const float CC=34.;
float cityMask(vec2 xz){ return 1.-length((xz-vec2(0.,-400.))/vec2(1060.,660.)); }
vec3 gBq, gBsz; float gBid;
float building(vec3 p){
  vec2 id=floor(p.xz/CC), c=(id+.5)*CC; float m=cityMask(c);
  if(m<=0. || p.y>320.) return 1e9;
  float h1=hash12(id*1.13+.7), h2=hash12(id*2.71+4.2), h3=hash12(id*5.1+2.3), h4=hash12(id*3.3+9.1);
  if(h1<.1) return 1e9;                                             // a square or a park
  vec2 dc=c-vec2(0.,-400.); float down=exp(-dot(dc,dc)/(2.*360.*360.));
  float H=(7.+26.*h2*h2+55.*down*h2+150.*pow(h2,5.)*down)*smoothstep(0.,.07,m);
  vec2 hs=vec2(CC*.5-5.5-4.*h3, CC*.5-5.5-4.*h4);                  // streets at least 11 m wide
  vec3 bq=p-vec3(c.x,0.,c.y); vec3 q=bq-vec3(0.,H*.5,0.); vec3 d=abs(q)-vec3(hs.x,H*.5,hs.y);
  gBq=bq; gBsz=vec3(hs.x,H,hs.y); gBid=hash12(id*7.7+1.1);
  return length(max(d,0.))+min(max(d.x,max(d.y,d.z)),0.); }
vec3 cityStreet(vec3 p, float fp){
  vec2 g=p.xz/CC; vec2 dd=abs(fract(g+.5)-.5)*CC; float ds=min(dd.x,dd.y);
  float street=smoothstep(6.5,5.,ds);
  float lx=abs(fract(p.x/14.)-.5)*14., lz=abs(fract(p.z/14.)-.5)*14.;
  float pool=exp(-(lx*lx+(dd.y-4.5)*(dd.y-4.5))/10.)*step(dd.y,8.)+exp(-(lz*lz+(dd.x-4.5)*(dd.x-4.5))/10.)*step(dd.x,8.);
  vec3 c=vec3(.01,.01,.012)+vec3(1.,.6,.27)*(.05*street+.7*pool);
  // traffic on the avenues (every fourth street): headlights one way, tail lights the other
  float ax=mod(floor(p.z/CC+.5),4.), az=mod(floor(p.x/CC+.5),4.);
  if(ax<.5 && dd.y<3.){ float side=sign(p.z-floor(p.z/CC+.5)*CC); float s=fract(p.x/9.+uTime*.9*side+hash12(vec2(floor(p.z/CC+.5),3.)));
    c+=(side>0.? vec3(1.,.92,.8) : vec3(1.,.12,.06))*smoothstep(.08,0.,abs(s-.5))*smoothstep(3.,1.,dd.y)*1.8; }
  if(az<.5 && dd.x<3.){ float side=sign(p.x-floor(p.x/CC+.5)*CC); float s=fract(p.z/9.+uTime*.9*side+hash12(vec2(floor(p.x/CC+.5),7.)));
    c+=(side>0.? vec3(1.,.92,.8) : vec3(1.,.12,.06))*smoothstep(.08,0.,abs(s-.5))*smoothstep(3.,1.,dd.x)*1.8; }
  vec3 avg=vec3(1.,.62,.3)*.11;                                     // far away: the average glow of the streets
  return mix(c, avg, smoothstep(1.5,5.,fp)); }
float mapG(vec3 p, float t, out int mat, out float tone){
  int oct=t<2200.?7:(t<6000.?5:4);
  float dT=(p.y-terrainH(p.xz,oct))*.5; mat=0; tone=0.;
  float tn, pt; float dP=person(p,tn,pt); if(dP<dT){ mat=pt<0.? 2 : 1; tone=tn; gPart=pt; return dP; }
  if(uK.x>0.){ vec3 sq=gBq, ss=gBsz; float si=gBid; float dB=building(p); if(dB<dT){ mat=3; return dB; } gBq=sq; gBsz=ss; gBid=si; }
  return dT; }
vec3 personN(vec3 p){ const vec2 k=vec2(1.,-1.); const float h=.003; float tn, pt;
  return normalize(k.xyy*person(p+k.xyy*h,tn,pt)+k.yyx*person(p+k.yyx*h,tn,pt)+k.yxy*person(p+k.yxy*h,tn,pt)+k.xxx*person(p+k.xxx*h,tn,pt)); }
const vec3 PAL[6]=vec3[](vec3(.16,.07,.06), vec3(.2,.16,.11), vec3(.07,.08,.11), vec3(.11,.12,.09), vec3(.13,.125,.12), vec3(.3,.27,.23));
vec3 terrainN(vec2 p, float t){ float e=.0012*t+.08; int oct=t<2200.?8:6;
  return normalize(vec3(terrainH(p-vec2(e,0),oct)-terrainH(p+vec2(e,0),oct), 2.*e, terrainH(p-vec2(0,e),oct)-terrainH(p+vec2(0,e),oct))); }
float terrainShadow(vec3 p, vec3 L){ float res=1., t=3.;
  for(int i=0;i<48;i++){ vec3 q=p+L*t; float h=q.y-terrainH(q.xz,5); res=min(res, 10.*h/t); if(res<.01||q.y>1900.) break; t+=clamp(h*.6, 3., 260.); }
  return clamp(res,0.,1.); }
// clouds
vec3 gAx; float gDist;
float cloudShape(vec3 p, out vec3 q){
  float y0=uD.x, y1=uD.y; q=vec3(0); if(p.y<y0||p.y>y1) return 0.;
  float hh=(p.y-y0)/(y1-y0); float shape=smoothstep(0.,.18,hh)*smoothstep(1.,.5,hh);
  vec3 rel=p-uCamPos; float along=dot(rel,gAx); float off=length(rel-gAx*along);
  float hole=along>0.? smoothstep(uC.w*.55, uC.w*1.05, off/max(along,1.)*gDist) : 1.;
  hole=mix(1., hole, smoothstep(1200., 3500., along));                 // keep the clouds you are flying through
  q=p*.0016+vec3(uB.z*.6,0.,uB.z);
  return shape*2.6*mix(.08,1.,hole); }
float cloudDens(vec3 p){ vec3 q; float sh=cloudShape(p,q); if(sh<=0.) return 0.;
  float n=fbm(q)*.72+(.5*noise(q*3.3)+.25*noise(q*6.7))*.28*1.33;
  return max(0., n-(1.-uA.w))*sh; }
vec2 slab(vec3 ro, vec3 rd, float y0, float y1){
  if(abs(rd.y)<1e-5) return (ro.y>y0&&ro.y<y1)? vec2(0.,30000.) : vec2(1.,0.);
  float t0=(y0-ro.y)/rd.y, t1=(y1-ro.y)/rd.y; return vec2(max(min(t0,t1),0.), max(t0,t1)); }
float cloudShadowAt(vec3 p, vec3 L){ float my=(uD.x+uD.y)*.5; if(L.y<=0.01) return 1.; vec3 q=p+L*((my-p.y)/L.y); return exp(-cloudDens(q)*2.2); }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 E=uC.xyz; float S=uC.w; float Q=uD.z;
  gAx=normalize(E-uCamPos); gDist=length(E-uCamPos); gClipY=(uD.x+uD.y)*.5;
  vec3 col=skyCol(rd)*vec3(.9,.88,.85)+vec3(.02,.022,.03)*exp(-abs(rd.y)*14.);
  { vec3 bandN=normalize(vec3(.55,.35,-.75)); float band=exp(-pow(dot(rd,bandN),2.)*12.);      // the Milky Way
    col+=nebula(rd*1.3, vec3(.03,.026,.034), vec3(.1,.08,.055))*band*smoothstep(0.,.3,rd.y)*.9; }
  vec3 lightC=vec3(1.,.8,.52)*uA.z;
  // solids: terrain + crowd
  float t=.3, tS=1e9; int mat=0; float tone=0.;
  for(int i=0;i<420;i++){ vec3 p=ro+rd*t; float d=mapG(p,t,mat,tone);
    if(mat!=2 && d<(mat==1? .0005*t+.002 : mat==3? .0006*t+.01 : .0015*t+.002)){ tS=t; break; }
    bool inC=uD.w>.5 && p.y<2.6 && crowdMask(p.xz)>-.01;
    float st=inC? max(min(d,.3),.004) : max(d,.003*t);
    if(uK.x>0. && p.y<330. && cityMask(p.xz)>-.06){                  // never step past the next block boundary
      vec2 id=floor(p.xz/CC); vec2 rdx=vec2(abs(rd.x)>1e-5? rd.x : 1e-5, abs(rd.z)>1e-5? rd.z : 1e-5);
      vec2 e=(vec2(rd.x>0.? id.x+1. : id.x, rd.z>0.? id.y+1. : id.y)*CC-p.xz)/rdx; st=min(max(d,.02), max(min(e.x,e.y),0.)+.05); }
    t+=st; if(t>26000. || (rd.y>0. && p.y>2000.)) break; }
  // entity
  float glowAcc=0.; float tEye; vec3 eye=greatEye(ro,rd,E,S,tEye);
  vec3 ent; float tEnt; bool entHit=marchEntity(ro,rd,E,S,min(tEye,tS),ent,tEnt,glowAcc);
  if(eye.x>=0. && tEye<tEnt && tEye<tS){ ent=eye; tEnt=tEye; entHit=true; }
  if(tS<1e8 && tS<tEnt){
    vec3 p=ro+rd*tS; vec3 L=normalize(E-p);
    float lightPool=cloudShadowAt(p,L)*uB.x;
    if(uD.w>.5) lightPool*=.4+.6*exp(-pow(length((p.xz-vec2(0.,-150.))/vec2(560.,300.)),2.));   // a pool of its light on the people
    vec3 c;
    float fpx=tS/(uFov*uRes.y);
    if(mat==3){ vec3 q=gBq-vec3(0.,gBsz.y*.5,0.); vec3 hs=vec3(gBsz.x,gBsz.y*.5,gBsz.z); vec3 aq=abs(q)/hs;
      vec3 n= (aq.x>aq.y&&aq.x>aq.z)? vec3(sign(q.x),0.,0.) : (aq.y>aq.z? vec3(0.,sign(q.y),0.) : vec3(0.,0.,sign(q.z)));
      float bid=gBid; vec3 wallC=mix(vec3(.022,.022,.026), vec3(.05,.045,.04), fract(bid*13.7))*(n.y>.5? .6 : 1.);
      c=wallC*(lightC*max(dot(n,L),0.)*lightPool*.16 + vec3(.01,.012,.02));    // at night the towers are dark; their windows carry them
      if(n.y<.5){ float u=abs(n.x)>.5? gBq.z : gBq.x; float v=p.y;
        vec2 cl=vec2(floor(u/3.), floor(v/3.6)), f=vec2(fract(u/3.), fract(v/3.6));
        float win=smoothstep(.16,.24,f.x)*smoothstep(.84,.76,f.x)*smoothstep(.22,.3,f.y)*smoothstep(.82,.74,f.y);
        float litP=.22+.55*fract(bid*7.31), h=hash12(cl+vec2(bid*91.,n.x*13.+n.z*7.));
        vec3 wc=mix(vec3(1.,.7,.4), vec3(1.,.86,.62), fract(h*17.)); if(fract(h*31.)>.93) wc=vec3(.7,.82,1.);
        vec3 lit=wc*(.9+1.5*fract(h*5.3))*step(h,litP)*win, avg=vec3(1.,.78,.5)*litP*.38*1.5;
        c+=mix(lit, avg, smoothstep(.9,2.4,fpx))*step(3.4,v)*step(v,gBsz.y-1.5); }
    } else if(mat==1){ vec3 n=personN(p); float part=gPart;
      float diff=max(dot(n,L),0.), wrap=max(dot(n,L)*.5+.5,0.);
      float rim=pow(1.-max(dot(n,-rd),0.),3.)*wrap;
      float occ=.2+.8*smoothstep(.2,1.65,p.y);                       // the people in front shade the lower body
      vec3 skin=mix(vec3(.62,.42,.3), vec3(.3,.18,.12), fract(tone*7.31));
      vec3 cloth=PAL[int(fract(tone*3.77)*5.99)]*(.55+.6*fract(tone*13.1))*(.85+.3*noise(p*vec3(9.,3.,9.)));
      vec3 alb=part<.5? cloth : (part<1.5? skin : (part<2.5? vec3(.03,.024,.02) : cloth*.45));
      vec3 sky=vec3(.022,.03,.055)*(.55+.45*n.y);
      c=alb*(lightC*(diff*.95+.06)*lightPool*occ + sky*occ) + lightC*rim*lightPool*.28*occ;
      if(part>.5 && part<1.5) c+=lightC*lightPool*pow(max(dot(reflect(-L,n),-rd),0.),18.)*.06;
    } else { vec3 n=terrainN(p.xz,tS);
      float diff=max(dot(n,L),0.); float sh=diff>0.? terrainShadow(p+n*.5,L) : 0.;
      float snow=smoothstep(650.,1100.,p.y+n.y*120.)*smoothstep(.55,.85,n.y);
      vec3 alb=mix(vec3(.035,.032,.03), vec3(.55,.56,.6), snow);
      c=alb*(lightC*diff*sh*lightPool*.9 + vec3(.012,.018,.035)*(.5+.5*n.y));
      if(uK.x>0.){ float cm=smoothstep(0.,.05,cityMask(p.xz)); c=mix(c, cityStreet(p,fpx), cm); }
    }
    float fogAmt=1.-exp(-tS*.00011); vec3 fogC=mix(vec3(.012,.017,.03), vec3(.35,.27,.17)*uA.z*.12, pow(max(dot(rd,gAx),0.),6.));
    c=mix(c, fogC, fogAmt);
    float vfog=exp(-max(p.y,0.)*.012)*(1.-exp(-tS*.004))*(uK.x>0.? .15 : .35); c=mix(c, vec3(.03,.035,.05)+lightC*.02*lightPool, vfog);
    col=c;
  } else if(entHit){ float haze=1.-exp(-tEnt*.000035*uB.w); col=mix(ent, vec3(.04,.05,.08)+ent*.55, haze); }
  col+=vec3(1.,.84,.6)*glowAcc*uA.z;
  // cloud deck in front of whatever was hit
  vec2 sl=slab(ro,rd,uD.x,uD.y); float tMax=min(min(tS,tEnt),30000.);
  if(sl.x<sl.y && sl.x<tMax){ float ta=sl.x, tb=min(min(sl.y,tMax), ta+14000.); float L=tb-ta; float T=1.; vec3 cc=vec3(0);
    float NS=Q>.5? 64. : 28.; float jit=hash12(gl_FragCoord.xy+fract(uTime*7.3)*91.);
    for(int i=0;i<64;i++){ if(float(i)>=NS) break; float tt=ta+L*(float(i)+jit)/NS; vec3 p=ro+rd*tt; float dn=cloudDens(p); if(dn<=.001) continue;
      float a=1.-exp(-dn*L/NS*.028); vec3 Lp=normalize(E-p); float fwd=pow(max(dot(rd,Lp),0.),24.);
      float od=0.; for(int k=1;k<=4;k++){ od+=cloudDens(p+Lp*float(k)*90.); } float lt=exp(-od*.9);
      float powder=1.-exp(-dn*2.);
      vec3 lc=vec3(.008,.011,.02)*(1.+dn) + lightC*lt*(.16+fwd*1.2+.35*pow(max(dot(rd,Lp),0.),3.))*powder*.9;
      cc+=T*a*lc; T*=1.-a; if(T<.015) break; }
    col=col*T+cc; }
  float toE=max(dot(rd,gAx),0.); col+=vec3(1.,.8,.55)*(pow(toE,1500.)*.4+pow(toE,60.)*.03+pow(toE,30000.)*14.)*uA.z*(1.-uA.x);
  if(any(isnan(col))||any(isinf(col))) col=vec3(0.);
  fragColor=vec4(col,1.); }`,

  // ---- celestial staircase: floating marble slabs ascending into light (uA: rise, run, width, glowTop) (uB: cloud, fadeHuman, -, -)
  stairs: COMMON + `
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float slab(vec3 p, float k){ return sdBox(p-vec3(0., k*uA.x, k*uA.y), vec3(uA.z, 0.06, uA.y*0.42)); }
float map(vec3 p, out float kk){
  float k=clamp(floor(p.z/uA.y+.5), 0., 400.); float d=1e9; kk=k;
  for(float o=-1.;o<=1.;o+=1.){ float kc=clamp(k+o,0.,400.); float di=slab(p,kc); if(di<d){ d=di; kk=kc; } }
  return d; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 sunDir=normalize(vec3(0., uA.x, uA.y));
  float sun=max(dot(rd,sunDir),0.);
  vec3 sky=mix(vec3(.004,.004,.012), vec3(.02,.018,.04), smoothstep(-.2,.8,rd.y));
  sky+=vec3(1.,.88,.66)*pow(sun,90.)*9. + vec3(1.,.72,.4)*pow(sun,14.)*.25;
  sky+=stars(rd, .5*(1.-smoothstep(.0,.5,sun)));
  float t=0.; float kk; bool hit=false; float fog=0.;
  for(int i=0;i<140;i++){ vec3 p=ro+rd*t; float d=map(p,kk);
    float h=p.y; float cl=fbm(p*.18+vec3(0.,0.,uTime*.03)); float dens=smoothstep(.45,.75,cl)*smoothstep(4.,18.,h)*uB.x;
    fog+=dens*0.012*min(d,1.5);
    if(d<0.001*t){ hit=true; break; } t+=d*.9; if(t>160.) break; }
  vec3 col;
  if(hit){ vec3 p=ro+rd*t; vec2 e=vec2(.001*t,0.); float k2;
    vec3 n=normalize(vec3(map(p+e.xyy,k2)-map(p-e.xyy,k2), map(p+e.yxy,k2)-map(p-e.yxy,k2), map(p+e.yyx,k2)-map(p-e.yyx,k2)));
    vec3 q=p-vec3(0.,kk*uA.x,kk*uA.y);
    float edge=max(smoothstep(uA.z-.05,uA.z,abs(q.x)), smoothstep(uA.y*.42-.04,uA.y*.42,abs(q.z)));
    float marble=.8+.2*fbm(p*3.);
    vec3 base=vec3(.5,.49,.47)*marble;
    float diff=max(dot(n,sunDir),0.)*.9+.06;
    col=base*diff*.35 + vec3(1.,.76,.4)*edge*(1.2+kk*0.05);
    col*=exp(-t*.012);
    col=mix(col, sky, 1.-exp(-t*.006));
  } else col=sky;
  col=mix(col, vec3(1.,.82,.6)*.9, clamp(fog,0.,1.)*.8);
  fragColor=vec4(col,1.); }`,

  // ---- Go board of light (uA: highlight x, y(board coords 0..18), ripple time, stoneGlow) (uB: boardGlow, -, -, -)
  board: COMMON + `
uniform sampler2D uBoard;
float sdEll(vec3 p, vec3 r){ float k0=length(p/r), k1=length(p/(r*r)); return k0*(k0-1.)/k1; }
float cellAt(vec2 g){ if(any(lessThan(g,vec2(0.)))||any(greaterThan(g,vec2(18.)))) return 0.; return texture(uBoard,(g+.5)/19.).r; }
float map(vec3 p, out float kind){
  float dPlane=p.y; kind=0.;
  vec2 g=floor(p.xz+9.5); float v=cellAt(g); float d=dPlane;
  if(v>0.05){ vec3 c=vec3(g.x-9., 0.19, g.y-9.); float ds=sdEll(p-c, vec3(.47,.2,.47)); if(ds<d){ d=ds; kind=v; } }
  vec2 f=fract(p.xz+9.5)-.5; float cellDist=.5-max(abs(f.x),abs(f.y))+.02; if(kind<0.05) d=min(d, max(cellDist, p.y-0.42));
  return d; }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 bg=nebula(rd, vec3(.04,.03,.08), vec3(.3,.2,.08))*.6 + stars(rd,.6);
  float t=0.; float kind; bool hit=false;
  for(int i=0;i<160;i++){ vec3 p=ro+rd*t; float d=map(p,kind); if(d<0.0008*t){ hit=true; break; } t+=d*.85; if(t>80.) break; }
  vec3 col=bg;
  vec2 hl=uA.xy-9.;
  if(hit){ vec3 p=ro+rd*t;
    if(kind<0.05){ // board surface: dark glass with golden grid
      bool on=abs(p.x)<9.6&&abs(p.z)<9.6;
      vec3 refl=nebula(reflect(rd,vec3(0,1,0)), vec3(.04,.03,.08), vec3(.3,.2,.08))*.5;
      float grain=.8+.2*sin(p.x*3.+fbm(vec3(p.xz*.6,1.))*6.);
      col= on? vec3(.035,.024,.014)*grain+refl*.6 : bg*.3;
      if(on){ vec2 gp=p.xz; vec2 gd=abs(fract(gp+.5)-.5); float line=smoothstep(.022,.0,min(gd.x,gd.y))*step(abs(gp.x),9.02)*step(abs(gp.y),9.02);
        col+=vec3(.95,.85,.66)*line*.22*uB.x;
        vec2 hm=gp-6.*floor(gp/6.+.5); if(length(hm)<.13 && abs(gp.x)<7. && abs(gp.y)<7.) col+=vec3(1.,.8,.5)*.6; // hoshi
        float rr=length(gp-hl); float rk=uA.z*3.; if(rk>0.) col+=vec3(1.,.8,.5)*smoothstep(.05,0.,abs(rr-rk))*exp(-rk*.35)*1.2;
      }
    } else { // stones
      vec2 g=floor(p.xz+9.5); vec3 c=vec3(g.x-9.,.19,g.y-9.); vec3 n=normalize((p-c)/vec3(.47*.47,.2*.2,.47*.47));
      vec3 L=normalize(vec3(.3,1.,-.4)); float diff=max(dot(n,L),0.); float spec=pow(max(dot(reflect(-L,n),-rd),0.),40.);
      float fres=pow(1.-max(dot(n,-rd),0.),4.);
      bool white=kind>.5 && kind<.8;
      float shellS=.92+.08*sin(dot(p.xz,vec2(37.,11.))); vec3 base= white? vec3(.86,.83,.77)*shellS : vec3(.015,.015,.018);
      col=base*(diff*.8+.15)+vec3(1.)*spec*(white?.6:1.2)+vec3(1.,.8,.5)*fres*.35;
      bool hi=distance(c.xz,hl)<.1;
      if(hi){ col+= vec3(1.,.75,.35)*(fres*3.+.4)*uA.w; }
    }
    col=mix(col,bg,1.-exp(-t*.02));
  }
  float dh=length((ro+rd*min(t,40.)).xz-hl); col+=vec3(1.,.8,.5)*exp(-dh*dh*1.2)*.12*uA.w;
  fragColor=vec4(col,1.); }`,

  // ---- deep space with a warm light source (uA: lightX, lightY, warmth, -)
  space: COMMON + `
void main(){ vec3 rd=camRay(gl_FragCoord.xy);
  vec3 col=nebula(rd, vec3(.035,.022,.07), vec3(.35,.2,.07))*.8 + stars(rd, .8);
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y; vec2 lp=uA.xy; float d=length(uv-lp);
  col+=vec3(1.,.8,.55)*(.02/(d*d+.02))*uA.z + vec3(1.,.6,.3)*exp(-d*2.)*.4*uA.z;
  fragColor=vec4(col,1.); }`,
};
