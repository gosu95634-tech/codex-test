// 「인류의 마지막 발명」 ch6 「VI · 누가 만드는가」 (35 s, film 475–510) and the ending (30 s, film 510–540).
// One world for both: a sea of clouds seen from above, from pre-dawn to sunrise and back to night.
//   ch6  0–5    title card over the dark cloud sea before dawn
//        5–17   dawn; two pillars of light rise from the horizon, far apart
//        15.6–  the camera tilts up to the being above; the pillars go out (the second one last)
//        19–23  its eyes close; its light descends; the camera rides the light down
//        26–31  close: the descending light and a small human flame almost touch
//        31–35  the light swells to white
//   end  0–12   out of the white: sunrise over the cloud sea, I. J. Good's sentence
//        11–14  the sun sinks into an ember; night returns
//        12–30  end screen (question at the top, two empty boxes for YouTube), fade to black at 28–30
(() => {
  // ---------------------------------------------------------------- shader
  // The ring eyes already open and close one by one in ENTITY itself (each at its own moment on uA.y).
  const ENT6 = ENTITY;

  // uA: eyeOpen, ringEyesOpen, coreGlow, -   uB: -, gaze, -, -   uC: being pos xyz, scale
  // uD: dawn (0 night .. 1 dawn), star amount, quality (0 preview .. 1 final), flow time (s)
  // uP1/uP2: pillar x, z, intensity, top height (m)
  // uBm: beam tip y, intensity, top radius, tip radius      uFl: flame xyz, intensity
  // uSn: sun elevation (rad), sun intensity, being presence, end-screen mask
  // uMi: flame size (m), ember intensity, sky warmth, flame reach (0..1)
  // uM : the point under the beam; the cloud field is re-levelled so its top there is exactly uM.y
  const FS = COMMON + ENT6 + `
uniform vec4 uD, uP1, uP2, uBm, uFl, uSn, uMi, uL; uniform vec3 uM;
const float CB=-650., CTOP=360.;
float gHm=0.; vec3 gHz=vec3(0), gAir=vec3(0);
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x), f.y); }
// union of round domes on a jittered grid: the cumulus tops of the cloud sea
float domes(vec2 p){ vec2 i=floor(p), f=fract(p); float h=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 c=g+.2+.6*hash22(i+g)-f;
    float r=.62+.42*hash12(i+g+19.7); float q=max(1.-dot(c,c)/(r*r),0.); h=max(h, q*(2.-q)*r); }
  return h; }
float rawH(vec2 p, int lod){
  float h=(n2(p/5200.)+.5*n2(p/2100.+3.1)-.75)*220.;
  h+=domes(p/950.)*190.;
  if(lod<2) h+=domes(p/400.+vec2(7.3,2.9))*88.; else h+=46.;
  if(lod<1) h+=domes(p/165.+vec2(1.7,8.2))*32.+(n2(p/55.)-.5)*12.; else h+=17.;
  return h; }
float cloudH(vec2 p, int lod){ return rawH(p,lod)-gHm; }
float hg(float c, float g){ float g2=g*g; return (1.-g2)/pow(max(1.+g2-2.*g*c,1e-4),1.5); }   // HG phase x 4pi (isotropic = 1)
vec3 sunDir(){ return normalize(vec3(0., sin(uSn.x), cos(uSn.x))); }

// ---- the two lights on the horizon: a source glowing just below the far cloud tops, and a soft column above it
vec2 pillarAng(vec3 rd, vec4 P, out float el){
  vec3 B=vec3(P.x,-60.,P.y)-uCamPos; float azB=atan(B.x,B.z), elB=atan(B.y,length(B.xz));
  el=asin(clamp(rd.y,-1.,1.)); return vec2((atan(rd.x,rd.z)-azB)*cos(el), el-elB); }
vec3 pillarSrc(vec3 rd, vec4 P){
  if(P.z<=0.) return vec3(0); float el; vec2 a=pillarAng(rd,P,el); float ang=length(vec2(a.x,a.y*1.8));
  return vec3(1.,.8,.55)*P.z*(exp(-ang/.004)*4.+exp(-ang/.02)*.7+exp(-ang/.08)*.1); }
vec3 pillarGlow(vec3 rd, vec4 P){
  if(P.z<=0.) return vec3(0);
  float el; vec2 a=pillarAng(rd,P,el); float da=a.x, de=a.y, h=max(de,0.);
  float wid=.014+h*.06, x=da/wid;
  float rise=smoothstep(P.w, P.w-.07, h)*smoothstep(-.003,.005,de);
  float flow=.8+.4*noise(vec3(x*1.1, (h-uD.w*.006)*30., P.x*.001));
  float body=exp(-x*x*1.3)*exp(-h/.2)*flow*1.0 + exp(-x*x*5.)*exp(-h/.06)*1.4;
  float halo=exp(-abs(da)/.045)*exp(-h/.12)*.1;
  float head=exp(-pow((h-P.w)/.02,2.))*exp(-x*x*2.)*1.6*step(P.w,.55);
  return vec3(1.,.85,.62)*P.z*((body+halo)*rise+head) + pillarSrc(rd,P); }

// ---- sky: ink zenith, warm band at the horizon toward the dawn, sun, ember, stars, high thin cloud
vec3 skyC(vec3 rd){
  float y=rd.y, hy=max(y,0.); vec3 L=sunDir();
  float az=max(dot(normalize(rd.xz+vec2(1e-5)), normalize(L.xz)),0.);
  float dawn=uD.x, warm=uMi.z;
  vec3 zen=mix(vec3(.0025,.0035,.010), vec3(.006,.012,.036), dawn);
  vec3 mid=mix(vec3(.0050,.0070,.018), vec3(.030,.044,.100), dawn);
  vec3 hor=mix(vec3(.012,.015,.028), mix(vec3(.16,.12,.15), vec3(.85,.42,.18), pow(az,2.5)), dawn*warm);
  vec3 c=mix(mid, zen, smoothstep(0.,.5,hy));
  c=mix(c, hor, exp(-hy*11.)*(.35+.65*az));
  c+=vec3(1.,.45,.16)*dawn*warm*exp(-hy*34.)*pow(az,16.)*.9;
  float cs=max(dot(rd,L),0.);
  c+=vec3(1.,.78,.5)*uSn.y*(smoothstep(.99989,.99995,cs)*70.+pow(cs,2500.)*9.+pow(cs,150.)*.8+pow(cs,14.)*.13);
  c+=vec3(1.,.6,.28)*uMi.y*(smoothstep(.99996,.999985,cs)*30.+pow(cs,5000.)*2.5+pow(cs,500.)*.35+pow(cs,50.)*.04);
  float sm=1.;
  if(uSn.w>0.){ vec2 fp=gl_FragCoord.xy/uRes*vec2(1920.,1080.); fp.y=1080.-fp.y;
    float inX=max(step(100.,fp.x)*step(fp.x,860.), step(1060.,fp.x)*step(fp.x,1820.)), inY=step(310.,fp.y)*step(fp.y,880.);
    sm=1.-inX*inY*uSn.w; }
  c+=stars(rd,uD.y*sm)*smoothstep(.03,.3,y);
  if(y>.004){ float tc=(9500.-uCamPos.y)/y; vec2 q=uCamPos.xz+rd.xz*tc;
    float n=fbm(vec3(q.x/26000., q.y/5200., 1.3)); float nv=noise(vec3(q.x/4000.,q.y/900.,2.));
    float a=smoothstep(.54,.84,n)*(.55+.45*nv)*exp(-tc/90000.)*.6;
    vec3 cc=mix(vec3(.012,.016,.03), mix(vec3(.3,.18,.2), vec3(1.,.5,.26), pow(az,3.)), dawn*warm)*(.2+.8*dawn) + vec3(1.,.7,.45)*uSn.y*.3*pow(az,4.);
    c=mix(c, cc, a); }
  return c; }

// ---- light reaching a point inside the cloud skin
vec3 cloudLight(vec3 p, vec3 rd, float depth, float dn, int lod, float soft){
  float top=exp(-depth/34.);
  vec3 c=mix(vec3(.003,.005,.014), vec3(.022,.036,.084), uL.x)*(.28+.72*top);
  vec3 L=sunDir(); float od=0.;
  if(lod<2){ int ns=uD.z>.5?4:3; float dd=20.;
    for(int k=0;k<4;k++){ if(k>=ns) break; vec3 q=p+L*dd; od+=clamp((cloudH(q.xz,k==0?1:2)-q.y)/(soft*1.4),0.,1.)*dd; dd*=2.9; } }
  else od=depth*4.;
  float sh=exp(-od*.022), cs=dot(rd,L);
  float ph=mix(mix(hg(cs,.6), hg(cs,-.1), .45), 1., smoothstep(9000.,35000.,length(p-uCamPos)));
  vec3 lc=mix(vec3(1.,.58,.34), vec3(1.,.74,.5), clamp(uSn.y*.4,0.,1.))*(.3+.7*smoothstep(.8,.985,cs));   // warm only toward the sun
  c+=lc*(uL.y+uSn.y)*sh*ph*(.25+.75*(1.-exp(-dn*3.)));
  c+=vec3(1.,.6,.3)*uMi.y*.07*sh*ph;
  for(int i=0;i<2;i++){ vec4 P=i==0?uP1:uP2; if(P.z<=0.) continue;
    vec2 d=P.xy-p.xz; float r=length(d); vec3 Lp=normalize(vec3(d.x,400.,d.y));
    c+=vec3(1.,.8,.56)*P.z*(2500./(r+2500.))*(.03+.97*top)*(.015+hg(dot(rd,Lp),.75)*.03)*sh; }
  if(uSn.z>0.){ vec3 dE=uC.xyz-p; float S=uC.w;
    c+=vec3(1.,.8,.55)*uA.z*uSn.z*S*S*.35/dot(dE,dE)*(.2+.8*top)*(1.+.4*hg(dot(rd,normalize(dE)),.5)); }
  if(uBm.y>0.){ vec3 q=vec3(uC.x, clamp(p.y,uBm.x,uC.y), uC.z); float d=length(p-q); float R=max(uBm.w*6.,60.);
    vec3 dT=vec3(uC.x,uBm.x,uC.z)-p; float w2=uBm.w*uBm.w;
    float I=uBm.y*(.08*R/(d+R) + 9.*w2/(dot(dT,dT)+w2*5.));
    c+=vec3(1.,.86,.66)*I*(.08+.92*top)*(.5+.5*hg(dot(rd,normalize(dT)),.55)); }
  if(uFl.w>0.){ vec3 dF=uFl.xyz-p; float s=uMi.x; float d2=dot(dF,dF);
    float inside=smoothstep(0.,30.,cloudH(uFl.xz,0)-uFl.y);
    c+=vec3(1.,.5,.18)*uFl.w*s*s*.9/(d2+s*s*.5)*mix(.25+.75*top, exp(-sqrt(d2)/40.)*2., inside); }
  return c*uL.w; }

// ---- the cloud sea: skip down to the tops as a heightfield, then a short volumetric march through their soft skin
vec3 marchClouds(vec3 ro, vec3 rd, out float T, out float tHit){
  T=1.; tHit=1e9; vec3 acc=vec3(0);
  float t0=0., t1=95000.;
  if(ro.y>CTOP){ if(rd.y>=-1e-5) return acc; t0=(CTOP-ro.y)/rd.y; } else if(rd.y>0.) t1=(CTOP-ro.y)/rd.y;
  if(rd.y<0.) t1=min(t1,(CB-ro.y)/rd.y);
  if(t0>=t1) return acc;
  float jit=hash12(gl_FragCoord.xy+fract(uTime*7.31)*91.), sl=max(-rd.y,0.);
  int N=uD.z>.5?190:120; float t=t0; bool done=false;
  for(int i=0;i<190;i++){
    if(i>=N||t>t1||T<.03){ done=t>t1||T<.03; break; }
    vec3 p=ro+rd*t; float soft=16.+t*.0035+t*t*1.2e-7;
    float hc=cloudH(p.xz,2); float dyc=p.y-hc;
    if(dyc>150.+soft){ t+=max((dyc-140.)/(.3+sl)*.85, 2.+t*(t>15000.?.012:.004)); continue; }
    int lod=t<6000.?0:(t<18000.?1:2);
    float h=lod==2?hc:cloudH(p.xz,lod); float dy=p.y-h;
    if(dy>soft*1.5){ t+=max(dy/(lod==0?.9:.55)*.8/(1.+sl), 1.+t*(t>15000.?.01:.004)); continue; }
    float dn=(h-p.y)/soft;
    if(lod==0){ dn+=(noise(p/34.+vec3(0.,uD.w*.04,0.))-.5)*1.3+(noise(p/12.+7.)-.5)*.45; if(t<700.) dn+=((noise(p/4.3+3.)-.5)*.35+(noise(p/1.6+9.)-.5)*.15)*smoothstep(700.,250.,t); }
    dn=clamp(dn,0.,1.);
    float dt=(4.+t*.0055)*(.7+.6*jit);
    if(dn>.002){
      float a=1.-exp(-.034*dn*dt);
      vec3 lc=cloudLight(p,rd,max(h-p.y,0.),dn,lod,soft);
      lc=mix(lc, gAir, (1.-exp(-t/30000.))*uL.z); lc=mix(lc, gHz, smoothstep(25000.,85000.,t));
      acc+=T*a*lc; if(tHit>1e8&&T<.55) tHit=t; T*=1.-a; }
    t+=dt; }
  if(!done && rd.y<0.){ vec3 p=ro+rd*t; vec3 lc=cloudLight(p,rd,10.,1.,2,16.+t*.0035);
    lc=mix(lc, gAir, (1.-exp(-t/30000.))*uL.z); lc=mix(lc, gHz, smoothstep(25000.,85000.,t)); acc+=T*lc; if(tHit>1e8) tHit=t; T=0.; }
  return acc; }

// ---- the descending light: a column from the being's eye down to a rounded tip (ray-segment distance)
vec3 beamGlow(vec3 ro, vec3 rd, out float tB){
  tB=1e9; if(uBm.y<=0.) return vec3(0);
  vec3 E=uC.xyz; float S=uC.w; vec3 A=vec3(E.x,uBm.x,E.z); float Ls=max(E.y-S*.25-uBm.x,1.);
  vec3 w0=ro-A; float b=rd.y, d=dot(rd,w0), e=w0.y, den=max(1.-b*b,1e-5);
  float u=clamp((e-b*d)/den,0.,Ls); vec3 Q=A+vec3(0,u,0);
  float s=max(dot(Q-ro,rd),0.); vec3 X=ro+rd*s-Q; float dist=length(X); tB=s;
  float uu=u/Ls, R=uBm.w*sqrt(u/(u+9.))+.02*u+uBm.z*pow(uu,1.5)+.4;
  vec3 side=normalize(cross(rd,vec3(0,1,0))+1e-5); float sg=dot(X,side)/R;
  float yy=Q.y;
  float flow=.62+.76*noise(vec3(sg*2.4, (yy+uD.w*R*1.6)/(R*4.), 3.))*(.65+.35*noise(vec3(sg*7., (yy+uD.w*R*2.4)/(R*1.5), 9.)));
  float lat=dist/R;
  float core=exp(-lat*lat*1.6)*flow, inner=exp(-lat*lat*9.);
  float Rh=min(R,90.); float halo=(exp(-dist/(Rh*2.4))*.2+exp(-dist/(Rh*9.))*.03)*smoothstep(Ls,Ls*.45,u);
  float topFade=smoothstep(Ls, Ls*.85, u);
  vec3 Y=ro+rd*max(dot(A-ro,rd),0.)-A; float tipD=length(Y)/uBm.w;
  float tip=exp(-tipD*tipD*9.)*5.+exp(-tipD*tipD*1.2)*.7+exp(-tipD*.7)*.12;
  return vec3(1.,.9,.75)*uBm.y*((core*1.1+inner*1.5)*topFade + halo + tip); }
vec3 flameGlow(vec3 ro, vec3 rd, out float tF){
  tF=1e9; if(uFl.w<=0.) return vec3(0);
  vec3 F=uFl.xyz; float sz=uMi.x*(1.+.22*uMi.w);
  vec3 f=normalize(uCamFwd); float tt=dot(F-ro,f)/dot(rd,f); if(tt<=0.) return vec3(0); tF=tt;
  vec3 q=ro+rd*tt-F; vec3 r=normalize(cross(f,vec3(0,1,0))); vec3 up=normalize(cross(r,f));
  vec2 uv=vec2(dot(q,r), dot(q,up))/sz;
  float px=tt/(uFov*uRes.y)/sz, tm=uD.w;
  float sway=(noise(vec3(tm*1.6,0.,0.))-.5)*.14*(1.-.6*uMi.w)+(noise(vec3(tm*5.1,4.,0.))-.5)*.05;
  float k=uv.y+.3, x=uv.x-sway*k*k*1.3;
  x+=(noise(vec3(uv.y*5.-tm*6.,tm*.7,2.))-.5)*.05*k;
  float w=.4*pow(clamp(k,0.,1.),.42)*pow(clamp(1.-k,0.,1.),.8+.6*uMi.w)+px*1.2;
  float d=abs(x)/max(w,1e-4), inside=step(0.,k)*step(k,1.);
  float body=smoothstep(1.,.45,d)*inside;
  float core=smoothstep(.8,.05,d)*smoothstep(.02,.2,k)*smoothstep(.72,.22,k)*inside;
  float base=smoothstep(.25,0.,k)*body;
  float flick=.9+.2*noise(vec3(tm*8.,uv.y*2.5,1.));
  vec3 col=mix(vec3(1.,.34,.07),vec3(1.,.6,.22),smoothstep(.1,.7,k))*body*2.4*(1.-.5*base) + vec3(1.,.84,.56)*core*6.5 + vec3(.9,.3,.08)*base*.8;
  float rr=length((uv-vec2(0.,.12))*vec2(1.,.75)), rp=rr/max(px,1e-5);
  col+=vec3(1.,.52,.2)*(exp(-rr*rr*3.)*.5+exp(-rr*1.3)*.13) + vec3(1.,.72,.42)*exp(-rp*rp/7.)*3.*smoothstep(.03,.2,px);
  return col*uFl.w*flick; }

void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  gHm=rawH(uM.xz,0)-uM.y;
  vec3 hd=normalize(vec3(rd.x,.01,rd.z));
  gHz=skyC(hd)+(pillarSrc(hd,uP1)+pillarSrc(hd,uP2))*.5; gAir=skyC(normalize(vec3(rd.x,.2,rd.z)))*.9;
  vec3 col=skyC(rd)+pillarGlow(rd,uP1)+pillarGlow(rd,uP2);
  float tEnt=1e9;
  if(uSn.z>0.){ vec3 E=uC.xyz; float S=uC.w; float glowAcc=0.; float tEye; vec3 eye=greatEye(ro,rd,E,S,tEye);
    vec3 ent; bool hit=marchEntity(ro,rd,E,S,tEye,ent,tEnt,glowAcc);
    if(eye.x>=0. && tEye<tEnt){ ent=eye; tEnt=tEye; hit=true; }
    if(hit){ float hz=1.-exp(-tEnt*.00002); col=mix(col, mix(ent, skyC(rd)+ent*.5, hz), uSn.z); } else tEnt=1e9;
    col+=vec3(1.,.84,.6)*glowAcc*uA.z*uSn.z; }
  float tB, tF; vec3 bm=beamGlow(ro,rd,tB), fl=flameGlow(ro,rd,tF);
  if(tEnt<tB) bm*=.1;
  float T, tC; vec3 cl=marchClouds(ro,rd,T,tC);
  col=col*T+cl;
  col+=bm*(tB<tC?1.:T)+fl*(tF<tC?1.:T);
  fragColor=vec4(col,1.); }`;

  // ---------------------------------------------------------------- world layout (metres; the cloud tops sit near y = 0)
  const PZ = 70000, PX = 22000;               // the two lights, on the horizon (screen right is -x)
  const E6 = [0, 6000, 9500], S6 = 1400;       // the being, above the cloud sea
  const MX = [0, 0, 9500];                     // under the being: the cloud top here is exactly y = 0
  const FLAME = 14, TIP_R = 6;                 // flame height, radius of the light's tip (m)
  const deg = Math.PI / 180;
  const camYP = (pos, yaw, pitch, fov) => ({ pos, fwd: [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], up: [0, 1, 0], fov });
  const easeOut = (x, p = 2.5) => 1 - Math.pow(1 - clamp(x), p);

  function sky(TT, cam, P, post, alpha = 1) {
    const fin = FINAL();
    GL.frame({ name: "ch6_sky", fs: FS, scale: SC(0.55, 1.5), uniforms: {
      uTime: TT, ...camUniforms(cam),
      uA: [P.open ?? 1, P.ringOpen ?? 1, P.core ?? 1.2, 0], uB: [0, P.gaze ?? 1, 0, 0], uC: [...E6, S6],
      uD: [P.dawn ?? 0.5, P.stars ?? 0.3, fin ? 1 : 0, TT - 470],
      uP1: [-PX, PZ, P.p1 ?? 0, P.p1h ?? 0], uP2: [PX, PZ, P.p2 ?? 0, P.p2h ?? 0],
      uBm: [P.tipY ?? 0, P.beam ?? 0, S6 * 0.36, TIP_R],
      uFl: [MX[0], P.flameY ?? -60, MX[2], P.flame ?? 0],
      uSn: [P.sunEl ?? 0.035, P.sun ?? 0, P.being ?? 0, P.mask ?? 0],
      uMi: [FLAME, P.ember ?? 0, P.warm ?? 1, P.reach ?? 0],
      uL: [P.amb ?? 0.5, P.hlight ?? 0.2, P.haze ?? 1, P.cexp ?? 1],
      uM: MX,
      uRing: heavensRings(RING_PHASE + TT * 0.04), uSock: norm(sub(cam.pos, E6)),
    } }, { bloom: 0.55, thresh: 1.25, exposure: 1.0, letterbox: LB, vignette: 0.55, t: TT, ...post });
    o.save(); o.globalAlpha = alpha; o.drawImage(GL.canvas, 0, 0); o.restore();
  }

  // ---------------------------------------------------------------- ch6
  const TIP_TOP = E6[1] - S6 * 0.62;
  function tipY(k) { // the descending light: from the eye down to just above the flame, then a last slow approach
    if (k < 26.4) return lerp(TIP_TOP, 290, ease(clamp((k - 22.4) / 4)));
    if (k < 31) return lerp(290, 218, easeOut((k - 26.4) / 4.6));
    return lerp(218, 213, ease((k - 31) / 4));
  }
  function flameY(k) { // the small human flame rising out of the cloud sea
    if (k < 26.4) return lerp(-50, 160, ease(clamp((k - 23.8) / 2.6)));
    if (k < 31) return lerp(160, 196, easeOut((k - 26.4) / 4.6));
    return lerp(196, 198, ease((k - 31) / 4));
  }
  function wide(k, TT) { // shot A + B1: one camera, from the horizon up to the being and down along its light
    const pos = lerp3([0, 430, 0], [0, 480, 1800], clamp(k / 27)); pos[1] += 120 * smooth(20, 26.5, k);
    const tiltUp = ease(clamp((k - 15.6) / 4.2)), tiltDown = ease(clamp((k - 23.0) / 3.8));
    const pitchA = lerp(-4.0, -3.4, clamp(k / 15.6)) * deg;
    const eAt = Math.atan2(E6[1] - pos[1], E6[2] - pos[2]) - 1.0 * deg;
    const tAt = Math.atan2(tipY(k) - pos[1], E6[2] - pos[2]) + 2 * deg;
    const pitch = lerp(lerp(pitchA, eAt, tiltUp), Math.max(tAt, 1.5 * deg), tiltDown);
    const fov = lerp(lerp(1.25, 0.95, tiltUp), 1.05, tiltDown);
    const cam = camYP(pos, 0, pitch, fov);
    const dawn = 0.12 + 0.13 * smooth(0, 5, k) + 0.55 * smooth(5, 17, k) + 0.05 * smooth(17, 26, k);
    const p1 = 1.6 * smooth(5.2, 6.6, k) * (1 - smooth(15.6, 17.2, k));
    const p2 = 1.6 * smooth(10.2, 11.6, k) * (1 - smooth(16.8, 19.8, k));
    const p1h = 0.62 * Math.pow(clamp((k - 5.4) / 2.8), 1.5), p2h = 0.62 * Math.pow(clamp((k - 10.4) / 2.8), 1.5);
    const q = project(cam, E6), rays = q ? [q[0] / W, 1 - q[1] / H, 0.3 * smooth(16.5, 20, k)] : [0.5, 0.5, 0];
    sky(TT, cam, {
      dawn, stars: 0.5 * (1 - smooth(4, 15, k)) + 0.08, p1, p2, p1h, p2h,
      amb: 0.1 + 0.1 * smooth(0, 5, k) + 0.55 * smooth(5, 17, k), hlight: 0.004 + 0.008 * smooth(0, 5, k) + 0.09 * smooth(5, 17, k),
      being: 1, open: 1 - smooth(19.6, 23.4, k), ringOpen: 1 - smooth(19.2, 23.4, k), gaze: 1,
      core: 1.0 + 1.4 * smooth(21, 23.5, k), tipY: tipY(k), beam: 1.2 * smooth(22.2, 23.2, k),
      flameY: flameY(k), flame: smooth(23.8, 24.8, k) * 1.3,
    }, { rays, fade: smooth(0, 1.4, k) });
  }
  function close(k, TT, alpha = 1) { // B2: the meeting, near
    const u = ease(clamp((k - 26.2) / 5)), v = ease(clamp((k - 31) / 4));
    const G = [MX[0], 204, MX[2]];
    const off = lerp3(lerp3([-70, -6, -178], [-20, -9, -58], u), [-16, -8, -47], v);
    const cam = CAMF([G[0] + off[0], G[1] + off[1], G[2] + off[2]], G, 0.95);
    const sw = smooth(31, 35, k);
    const q = project(cam, [MX[0], 210, MX[2]]), rays = q ? [q[0] / W, 1 - q[1] / H, 0.2 + 0.6 * sw] : [0.5, 0.5, 0];
    sky(TT, cam, {
      dawn: 0.85, stars: 0.06, amb: 0.75, hlight: 0.1, being: 0, core: 2.4,
      tipY: tipY(k), beam: 1.2 * (1 + 2.5 * sw), flameY: flameY(k), flame: 1.3 * (1 + 1.5 * sw), reach: smooth(28, 32, k),
    }, { rays, bloom: 0.55 + 0.5 * sw, exposure: 1.0 + 0.8 * sw, lift: smooth(32.6, 34.9, k) }, alpha);
    motes(k, cam, alpha * (1 - smooth(32.5, 34.5, k)));
  }
  // light motes drifting down around the descending light, and a few embers lifting off the flame (world space, projected)
  function motes(k, cam, alpha) {
    if (alpha <= 0.01) return;
    const r = rng(606), ty = tipY(k), fy = flameY(k);
    pic(() => {
      o.save(); o.globalCompositeOperation = "lighter";
      const dot = (p, rad, a, warm) => {
        const q = project(cam, p); if (!q || a <= 0.005) return;
        const px = Math.max(1.2, rad * cam.fov * H / q[2]);
        const g = o.createRadialGradient(q[0], q[1], 0, q[0], q[1], px * 3);
        const c = warm ? "255,190,120" : "255,236,200";
        g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(0.3, `rgba(${c},${a * 0.35})`); g.addColorStop(1, `rgba(${c},0)`);
        o.fillStyle = g; o.beginPath(); o.arc(q[0], q[1], px * 3, 0, 7); o.fill();
      };
      for (let i = 0; i < 34; i++) { // falling motes of light
        const ph = r(), sp = 2.2 + r() * 2.5, ang = r() * 6.283, rad = 3 + r() * 14, life = 70 + r() * 50;
        const age = ((k * sp + ph * life) % life), y = ty + life - age;
        const p = [MX[0] + Math.cos(ang + k * 0.2) * rad, y, MX[2] + Math.sin(ang + k * 0.2) * rad];
        dot(p, 0.12 + r() * 0.12, alpha * 0.55 * smooth(0, 12, age) * smooth(0, 10, y - ty), false);
      }
      for (let i = 0; i < 12; i++) { // embers from the flame, drifting outward and up
        const ph = r(), life = 2.2 + r() * 1.6, age = ((k + ph * life) % life) / life, ang = r() * 6.283, sp = 3 + r() * 5;
        const p = [MX[0] + Math.cos(ang) * age * sp * 1.6, fy + 6 + age * (8 + r() * 10), MX[2] + Math.sin(ang) * age * sp];
        dot(p, 0.09 + r() * 0.06, alpha * 0.8 * Math.sin(Math.PI * age) * smooth(26.8, 28, k), true);
      }
      o.restore();
    });
  }

  function fn6(k, T) {
    const TT = 475 + k;
    if (k < 26.2) wide(k, TT);
    else if (k < 27.4) { wide(k, TT); close(k, TT, ease((k - 26.2) / 1.2)); }
    else close(k, TT);
    chapterCard(k, "VI", "누가 만드는가", 5);
    caption(k, 5.6, 10.0, (a, u) => capB("*OpenAI* — “AGI가 인류 전체에 이롭도록”", a, u));
    caption(k, 10.2, 16.9, (a, u) => capB("*Anthropic* — “신뢰할 수 있고, 해석할 수 있고, 조종할 수 있는 AI”", a, u));
    caption(k, 17.6, 21.6, (a, u) => capB("Machines of Loving Grace", a, u, { font: "CormI", size: 54, spacing: 0.06 - 0.03 * ease(u * 2), color: "#f6ead2" }));
    caption(k, 21.8, 25.0, (a, u) => capB("“데이터센터 안의 *천재들의 나라*”", a, u));
    caption(k, 25.2, 28.5, (a, u) => capB("“그것은 *2026년*에 올 수도 있다”", a, u));
    caption(k, 28.7, 31.6, (a, u) => capB("— 다리오 아모데이, 2024", a, u));
  }

  // ---------------------------------------------------------------- end
  function fnEnd(k, T) {
    const TT = 510 + k;
    const pos = lerp3([0, 520, 0], [0, 560, 1400], k / 30);
    const night = smooth(10.8, 14.2, k);
    const cam = camYP(pos, 0, lerp(-2.2, -2.6, night) * deg, 1.15);
    sky(TT, cam, {
      dawn: lerp(0.95, 0.07, night), stars: 0.05 + 0.35 * night, being: 0,
      amb: lerp(0.7, 0.035, night), hlight: lerp(0.04, 0.0, night),
      sun: lerp(0.42, 0, smooth(10.8, 13.4, k)), sunEl: lerp(0.012, 0.004, night),
      ember: smooth(11.6, 14, k) * (0.85 + 0.15 * Math.sin((k - 14) * 2 * Math.PI / 7)), mask: smooth(11, 13, k),
    }, { lift: 1 - smooth(0, 2.6, k), rays: [0.5, 0.55, 0.25 * (1 - night)], fade: 1 - smooth(28, 30, k) });
    caption(k, 0.8, 3.6, (a, u) => capB("최초의 *초지능 기계*는", a, u));
    caption(k, 3.8, 7.0, (a, u) => capB("인간이 만들 필요가 있는 *마지막 발명*이다", a, u));
    caption(k, 7.2, 12.4, (a, u) => capB("— 그 기계가 자신을 통제하는 법을 우리에게 알려줄 만큼 온순하다면", a, u));
    caption(k, 8.4, 12.4, (a, u) => capT("I. J. 굿, 1965", a, u));
    const f = 1 - smooth(28, 30, k);
    const qa = smooth(13.2, 15.0, k) * f;
    if (qa > 0 && !window.NOCAP) {                                       // the question, big, over the end screen
      const saved = CAP; CAP = { t: k, t0: 13.2, t1: 30 };
      o.save(); o.globalAlpha = f; typeset("당신은 *누가 먼저* 도달한다고 보나요?", { size: 78, y: 170, back: 0.6 }); o.restore();
      CAP = saved;
      o.save(); o.globalAlpha = qa * 0.7; o.fillStyle = GOLD; const hw = 120 * smooth(14, 16, k); o.fillRect(W / 2 - hw, 250, hw * 2, 2); o.restore();
    }
    const ta = smooth(14.4, 16.2, k) * f;
    if (ta > 0 && !window.NOCAP) line("인류의 마지막 발명", W / 2, H - 64, { size: 30, color: GOLD, spacing: 0.45, alpha: ta, glow: 6 });
  }

  chapter("ch6", 35, fn6);
  chapter("end", 30, fnEnd);
})();
