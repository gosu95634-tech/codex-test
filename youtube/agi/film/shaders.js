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

const SHADERS = {
  bright: `#version 300 es
precision highp float; in vec2 vUv; out vec4 fragColor; uniform sampler2D uTex; uniform float uThresh;
void main(){ vec3 c=vec3(0); vec2 px=1./vec2(textureSize(uTex,0));
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) c+=texture(uTex,vUv+vec2(x,y)*px*1.5).rgb; c/=9.;
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
  col+=texture(uBloomTex,uv).rgb*uBloom + texture(uRays,uv).rgb;
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
  heavens: COMMON + `
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
mat3 rx(float a){ float c=cos(a),s=sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }
mat3 ry(float a){ float c=cos(a),s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rz(float a){ float c=cos(a),s=sin(a); return mat3(c,s,0, -s,c,0, 0,0,1); }
const int NR=6;
mat3 ringM(int i, float t){ float fi=float(i); return rx(1.0+fi*0.83 + t*(0.05+fi*0.011)) * ry(fi*1.27 + t*(0.03-fi*0.008)) * rz(fi*0.52); }
float ringR(int i){ return 1.05+float(i)*0.3; }
float ringr(int i){ return 0.024+float(i)*0.003; }
float mapE(vec3 p, out int id, out vec3 lp){ float d=1e9; id=-1;
  for(int i=0;i<NR;i++){ vec3 q=ringM(i,uB.x)*p; float di=sdTorus(q, vec2(ringR(i), ringr(i))); if(di<d){ d=di; id=i; lp=q; } }
  return d; }
vec3 skyCol(vec3 rd){
  float up=clamp(rd.y,0.,1.);
  vec3 c=mix(vec3(.035,.05,.09), vec3(.006,.008,.02), pow(up,.6));
  return c + stars(rd, .35*smoothstep(.1,.5,up)); }
// small eyes along the rings: irises turn toward the camera as uB.y rises
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
// the great eye: a fixed almond socket facing the ground; the eyeball turns inside it to find the viewer
vec3 greatEye(vec3 ro, vec3 rd, vec3 E, float S, out float tHit){
  tHit=1e9; float R=0.66*S; vec3 oc=ro-E; float b=dot(oc,rd), c=dot(oc,oc)-R*R, h=b*b-c; if(h<0.) return vec3(-1.);
  tHit=-b-sqrt(h); vec3 p=ro+rd*tHit, n=normalize(p-E);
  vec3 f0=normalize(-E*vec3(1.,1.,1.)+vec3(0.,0.,-0.25*length(E)));   // socket faces down toward the land
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
    float fib=.6+.4*sin(a*60.+ang*80.)*sin(a*13.); vec3 ic=mix(vec3(3.6,2.1,.65), vec3(.7,.3,.05), smoothstep(pupA,irisA,ang));
    col=ic*fib; col*=1.-.75*smoothstep(irisA*.86,irisA,ang); col+=vec3(2.5,1.4,.4)*smoothstep(.02,0.,abs(ang-pupA-.01)); }
  if(ang<pupA) col=vec3(.0015)+skyCol(reflect(rd,n))*.3;
  vec3 hdir=normalize(L-rd); col+=vec3(5.)*pow(max(dot(n,hdir),0.),400.);
  return col*lidShade; }
float cloudDens(vec3 p){
  float y0=uC.y*0.18, y1=uC.y*0.42; if(p.y<y0||p.y>y1) return 0.;
  float hh=(p.y-y0)/(y1-y0); float shape=smoothstep(0.,.2,hh)*smoothstep(1.,.55,hh);
  vec3 q=p*0.0021+vec3(uB.z*0.6,0.,uB.z);
  float n=fbm(q)*0.75+fbm(q*3.1)*0.25;
  vec3 ax=normalize(uC.xyz-uCamPos); vec3 rel=p-uCamPos; float along=dot(rel,ax); float off=length(rel-ax*along);
  float hole=smoothstep(uC.w*0.12, uC.w*0.32, off/max(along,1.)*length(uC.xyz-uCamPos)*1.0);
  return max(0., n-(1.-uA.w))*shape*2.4*mix(0.15,1.,hole); }
void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  vec3 E=uC.xyz; float S=uC.w;
  vec3 col=skyCol(rd);
  // ground: distant mountain silhouettes
  if(rd.y<0.02){ float tg=-ro.y/min(rd.y,-1e-4); vec3 gp=ro+rd*min(tg,6000.); float m=fbm(vec3(gp.x*0.0008,0.,0.))*220.;
    float horizonLift=m/6000.; if(rd.y<horizonLift-0.004) col=mix(vec3(.004,.005,.008), vec3(.02,.025,.04), smoothstep(-.2,0.,rd.y)); }
  // entity (bounded)
  vec3 oc=ro-E; float b=dot(oc,rd), c=dot(oc,oc)-pow(2.9*S,2.), h=b*b-c; float tEnt=1e9; vec3 ent=vec3(0); bool entHit=false;
  float glowAcc=0.;
  float tEye; vec3 eye=greatEye(ro,rd,E,S,tEye);
  if(h>0.){ float t0=max(-b-sqrt(h),0.), t1=-b+sqrt(h); float t=t0; int id; vec3 lp;
    for(int i=0;i<110;i++){ vec3 p=(ro+rd*t-E)/S; float d=mapE(p,id,lp)*S; if(t<tEye) glowAcc+=exp(-max(length(p)-0.66,0.)*22.)*0.0015;
      if(d<0.0007*t){ entHit=true; tEnt=t; break; } t+=max(d*0.85, 0.0004*t); if(t>t1) break; }
    if(entHit){ vec3 p=(ro+rd*tEnt-E)/S; vec2 e=vec2(0.0015,0.); int i2; vec3 l2;
      vec3 n=normalize(vec3(mapE(p+e.xyy,i2,l2)-mapE(p-e.xyy,i2,l2), mapE(p+e.yxy,i2,l2)-mapE(p-e.yxy,i2,l2), mapE(p+e.yyx,i2,l2)-mapE(p-e.yyx,i2,l2)));
      vec3 Lc=normalize(-p); float diff=max(dot(n,Lc),0.); float fres=pow(1.-max(dot(n,-rd),0.),3.);
      float th=atan(lp.z,lp.x); vec3 radial=normalize(vec3(lp.x,0.,lp.z)); vec3 v=lp-radial*ringR(id); float ph=atan(v.y,dot(v,radial));
      float bands=.75+.25*smoothstep(.0,.15,abs(sin(ph*5.)))*(.85+.15*sin(th*220.));
      vec3 gold=vec3(.86,.56,.22)*bands;
      vec3 hc=normalize(Lc-rd); float specC=pow(max(dot(n,hc),0.),90.);
      vec3 Lm=normalize(vec3(.3,1.,.2)); float specM=pow(max(dot(n,normalize(Lm-rd)),0.),40.);
      ent=gold*(diff*1.1+.015) + vec3(1.,.82,.55)*specC*3.5 + vec3(.7,.75,.9)*specM*.35 + vec3(1.,.8,.5)*fres*.25;
      float lights=smoothstep(.5,1.,sin(th*ringR(id)*260.)*sin(ph*3.+1.))*step(.3,abs(ph)); ent+=vec3(2.4,1.7,1.)*pow(lights,8.)*(.6+.4*sin(uTime*2.+th*90.));
      float isEye; vec3 camL=ringM(id,uB.x)*((uCamPos-E)/S); vec3 ec=ringEye(lp,id,camL,isEye); if(isEye>.5) ent=ec*(.6+.6*diff);
    }
  }
  if(eye.x>=0. && tEye<tEnt){ ent=eye; tEnt=tEye; entHit=true; }
  vec3 hazeC=vec3(.05,.06,.1);
  if(entHit){ float haze=1.-exp(-tEnt*0.00005*uB.w); col=mix(ent, hazeC+ent*.5, haze); }
  col+=vec3(1.,.84,.6)*glowAcc*uA.z;
  float toE=max(dot(rd,normalize(E-ro)),0.); col+=vec3(1.,.8,.55)*pow(toE,200.)*uA.z*0.6*(1.-uA.x) + vec3(.5,.42,.35)*pow(toE,8.)*.03*uA.z;
  // cloud slab between camera and the being
  float y0=uC.y*0.18, y1=uC.y*0.42;
  if(rd.y>0.001){ float ta=(y0-ro.y)/rd.y, tb=(y1-ro.y)/rd.y; float L=tb-ta; float T=1.; vec3 cc=vec3(0);
    float jit=hash12(gl_FragCoord.xy+uTime); vec3 Ld=normalize(E-(ro+rd*ta));
    for(int i=0;i<40;i++){ float t=ta+L*(float(i)+jit)/40.; vec3 p=ro+rd*t; float dn=cloudDens(p); if(dn<=0.001) continue;
      float a=1.-exp(-dn*L/40.*0.014); vec3 toEp=normalize(E-p); float fwd=pow(max(dot(rd,toEp),0.),30.);
      float lightThru=exp(-cloudDens(p+toEp*120.)*5.);
      float thin=exp(-dn*5.);
      float rim=lightThru*thin*(0.05+fwd*1.1);
      vec3 lc=vec3(.006,.008,.014) + vec3(1.,.76,.46)*rim*(.5+.5*uA.z);
      cc+=T*a*lc; T*=1.-a; if(T<0.02) break; }
    col=col*T+cc; }
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
