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
  // Ring eyes close one by one instead of all at once.
  const ENT6 = ENTITY.replace("eh=0.03*uA.y;", "eh=0.03*clamp(uA.y*1.8-.8*hash12(vec2(k*1.37+float(id)*7.1,float(id)*3.3)),0.,1.);");
  if (ENT6 === ENTITY) throw new Error("ch6: ENTITY patch failed");

  // uA: eyeOpen, ringEyesOpen, coreGlow, -   uB: -, gaze, -, -   uC: being pos xyz, scale
  // uD: dawn (0 night .. 1 dawn), star amount, quality (0 preview .. 1 final), flow time (s)
  // uP1/uP2: pillar x, z, intensity, top height (m)
  // uBm: beam tip y, intensity, top radius, tip radius      uFl: flame xyz, intensity
  // uSn: sun elevation (rad), sun intensity, being presence, end-screen mask
  // uMi: flame size (m), ember intensity, sky warmth, flame reach (0..1)
  // uM : the point under the beam; the cloud field is re-levelled so its top there is exactly uM.y
  const FS = COMMON + ENT6 + `
uniform vec4 uD, uP1, uP2, uBm, uFl, uSn, uMi; uniform vec3 uM;
const float CB=-650., CTOP=360.;
float gHm=0.; vec3 gHz=vec3(0);
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

// ---- sky: ink zenith, warm band at the horizon toward the dawn, sun, ember, stars, high thin cloud
vec3 skyC(vec3 rd){
  float y=rd.y, hy=max(y,0.); vec3 L=sunDir();
  float az=max(dot(normalize(rd.xz+vec2(1e-5)), normalize(L.xz)),0.);
  float dawn=uD.x, warm=uMi.z;
  vec3 zen=mix(vec3(.0030,.0040,.0110), vec3(.010,.017,.046), dawn);
  vec3 mid=mix(vec3(.0060,.0080,.0190), vec3(.050,.064,.125), dawn);
  vec3 hor=mix(vec3(.016,.018,.032), mix(vec3(.26,.20,.22), vec3(.98,.52,.25), pow(az,2.5)), dawn*warm);
  vec3 c=mix(mid, zen, smoothstep(0.,.55,hy));
  c=mix(c, hor, exp(-hy*7.)*(.45+.55*az));
  c+=vec3(1.,.48,.18)*dawn*warm*exp(-hy*30.)*pow(az,14.)*1.1;
  float cs=max(dot(rd,L),0.);
  c+=vec3(1.,.78,.5)*uSn.y*(smoothstep(.99989,.99995,cs)*70.+pow(cs,2500.)*9.+pow(cs,150.)*.8+pow(cs,14.)*.13);
  c+=vec3(1.,.6,.28)*uMi.y*(smoothstep(.99996,.999985,cs)*40.+pow(cs,4000.)*3.+pow(cs,400.)*.45+pow(cs,40.)*.05);
  float sm=1.;
  if(uSn.w>0.){ vec2 fp=gl_FragCoord.xy/uRes*vec2(1920.,1080.); fp.y=1080.-fp.y;
    float inX=max(step(100.,fp.x)*step(fp.x,860.), step(1060.,fp.x)*step(fp.x,1820.)), inY=step(310.,fp.y)*step(fp.y,880.);
    sm=1.-inX*inY*uSn.w; }
  c+=stars(rd,uD.y*sm)*smoothstep(.03,.3,y);
  if(y>.004){ float tc=(9500.-uCamPos.y)/y; vec2 q=uCamPos.xz+rd.xz*tc;
    float n=fbm(vec3(q.x/26000., q.y/5200., 1.3)); float n2v=noise(vec3(q.x/4000.,q.y/900.,2.));
    float a=smoothstep(.52,.82,n)*(.55+.45*n2v)*exp(-tc/90000.)*.75;
    vec3 cc=mix(vec3(.02,.025,.045), mix(vec3(.5,.3,.3), vec3(1.2,.62,.32), pow(az,3.)), dawn*warm)*(.25+.75*dawn) + vec3(1.,.7,.45)*uSn.y*.35*pow(az,4.);
    c=mix(c, cc, a); }
  return c; }

// ---- local light sources as seen by the clouds
vec3 pillarLight(vec3 p, vec3 rd, vec4 P, float top){
  if(P.z<=0.) return vec3(0);
  vec2 d=P.xy-p.xz; float r=length(d); float rise=smoothstep(0.,4000.,P.w);
  vec3 L=normalize(vec3(d.x, 700., d.y));
  float I=P.z*rise*(1600./(r+1600.));
  return vec3(1.,.83,.6)*I*(.05+.95*top)*(.06+hg(dot(rd,L),.65)*.1); }
vec3 cloudLight(vec3 p, vec3 rd, float depth, float dn, int lod, float soft){
  float top=exp(-depth/38.);
  vec3 c=mix(vec3(.0045,.006,.014), vec3(.055,.068,.11), uD.x)*(.16+.84*top);
  // the low warm light from the horizon: the dawn glow, later the sun
  vec3 L=sunDir(); float od=0.;
  if(lod<2){ int ns=uD.z>.5?4:3; float dd=22.;
    for(int k=0;k<4;k++){ if(k>=ns) break; vec3 q=p+L*dd; od+=clamp((cloudH(q.xz,k==0?1:2)-q.y)/(soft*1.4),0.,1.)*dd; dd*=2.8; } }
  else od=depth*4.;
  float sh=exp(-od*.02);
  float cs=dot(rd,L);
  float ph=mix(hg(cs,.62), hg(cs,-.15), .35);
  float Ld=uD.x*uMi.z*.42 + uSn.y;
  vec3 lc=mix(vec3(1.,.5,.25), vec3(1.,.73,.45), clamp(uSn.y*.4,0.,1.));
  c+=lc*Ld*sh*ph*(.3+.7*(1.-exp(-dn*3.)));
  c+=vec3(1.,.6,.3)*uMi.y*.25*sh*ph;
  c+=pillarLight(p,rd,uP1,top)+pillarLight(p,rd,uP2,top);
  if(uSn.z>0.){ vec3 dE=uC.xyz-p; float S=uC.w;
    c+=vec3(1.,.8,.55)*uA.z*uSn.z*S*S*.5/dot(dE,dE)*(.25+.75*top)*(1.+.5*hg(dot(rd,normalize(dE)),.5)); }
  if(uBm.y>0.){ vec3 q=vec3(uC.x, clamp(p.y,uBm.x,uC.y), uC.z); float d=length(p-q); float R=max(uBm.w*8.,80.);
    vec3 qt=vec3(uC.x,uBm.x,uC.z); vec3 dT=qt-p; float w2=uBm.w*uBm.w;
    float I=uBm.y*(.2*R/(d+R) + 22.*w2/(dot(dT,dT)+w2*6.));
    c+=vec3(1.,.88,.7)*I*(.12+.88*top)*(.5+.5*hg(dot(rd,normalize(dT)),.55)); }
  if(uFl.w>0.){ vec3 dF=uFl.xyz-p; float s=uMi.x; float d2=dot(dF,dF);
    float inside=smoothstep(0.,30.,cloudH(uFl.xz,0)-uFl.y);
    c+=vec3(1.,.52,.2)*uFl.w*s*s*1.6/(d2+s*s)*mix(.25+.75*top, exp(-sqrt(d2)/45.)*2., inside); }
  return c; }

// ---- the cloud sea: heightfield skipping above the tops, a short volumetric march through their soft skin
vec3 marchClouds(vec3 ro, vec3 rd, out float T, out float tHit){
  T=1.; tHit=1e9; vec3 acc=vec3(0);
  float t0=0., t1=90000.;
  if(ro.y>CTOP){ if(rd.y>=-1e-5) return acc; t0=(CTOP-ro.y)/rd.y; } else if(rd.y>0.) t1=(CTOP-ro.y)/rd.y;
  if(rd.y<0.) t1=min(t1,(CB-ro.y)/rd.y);
  if(t0>=t1) return acc;
  float jit=hash12(gl_FragCoord.xy+fract(uTime*7.31)*91.);
  int N=uD.z>.5?150:96; float t=t0; bool done=false;
  for(int i=0;i<150;i++){
    if(i>=N||t>t1||T<.03){ done=t>t1||T<.03; break; }
    vec3 p=ro+rd*t; float soft=16.+t*.0035;
    float hc=cloudH(p.xz,2); float dyc=p.y-hc;
    if(dyc>150.+soft){ t+=max((dyc-140.)*.6, 1.+t*.006); continue; }
    int lod=t<5500.?0:(t<17000.?1:2);
    float h=lod==2?hc:cloudH(p.xz,lod); float dy=p.y-h;
    if(dy>soft*1.5){ t+=max(dy*.5, 1.+t*.005); continue; }
    float dn=(h-p.y)/soft;
    if(lod==0) dn+=(noise(p/34.+vec3(0.,uD.w*.04,0.))-.5)*1.3+(noise(p/12.+7.)-.5)*.45;
    dn=clamp(dn,0.,1.);
    float dt=(4.+t*.0055)*(.7+.6*jit);
    if(dn>.002){
      float a=1.-exp(-.032*dn*dt);
      vec3 lc=cloudLight(p,rd,max(h-p.y,0.),dn,lod,soft);
      lc=mix(lc, gHz, 1.-exp(-t/26000.));
      acc+=T*a*lc; if(tHit>1e8&&T<.55) tHit=t; T*=1.-a; }
    t+=dt; }
  if(!done && rd.y<0.){ acc+=T*gHz*.8; if(tHit>1e8) tHit=t; T=0.; }
  return acc; }

// ---- emitters
vec3 pillarGlow(vec3 ro, vec3 rd, vec4 P){
  if(P.z<=0.) return vec3(0);
  vec2 o2=ro.xz-P.xy, d2=rd.xz; float dd=max(dot(d2,d2),1e-8); float s=-dot(o2,d2)/dd; if(s<0.) return vec3(0);
  vec2 c=o2+d2*s; float r=length(c); float y=ro.y+rd.y*s;
  float Wd=520.; float lat=dot(c,vec2(-d2.y,d2.x))/sqrt(dd)/Wd;
  float base=smoothstep(-600.,250.,y), body=1.-smoothstep(P.w-3000.,P.w,y);
  float head=exp(-pow((y-P.w)/1800.,2.))*(1.-smoothstep(30000.,60000.,P.w));
  float fall=.38+.62*exp(-max(y,0.)/11000.);
  float flow=.72+.56*noise(vec3(lat*1.8, (y-uD.w*700.)/2600., P.x*.001));
  float core=exp(-lat*lat*1.6)*flow, inner=exp(-lat*lat*14.);
  float halo=exp(-abs(lat)/5.)*.22+exp(-abs(lat)/24.)*.05;
  float bloomBase=exp(-max(y,0.)/1500.)*exp(-abs(lat)/3.)*1.2;
  return vec3(1.,.86,.64)*P.z*((core*2.4+inner*5.+halo)*base*body*fall + head*(inner*14.+core*3.)*base + bloomBase*body*base); }
vec3 beamGlow(vec3 ro, vec3 rd, out float tB){
  tB=1e9; if(uBm.y<=0.) return vec3(0);
  vec3 E=uC.xyz; float S=uC.w;
  vec2 o2=ro.xz-E.xz, d2=rd.xz; float dd=max(dot(d2,d2),1e-8); float s=-dot(o2,d2)/dd; if(s<0.) return vec3(0);
  vec2 c=o2+d2*s; float r=length(c); float y=ro.y+rd.y*s; tB=s;
  float yT=uBm.x, u=clamp((y-yT)/max(E.y-yT,1.),0.,1.);
  float R=mix(uBm.w, uBm.z, pow(u,.75));
  float dTip=y<yT? length(vec2(r,(y-yT)*1.35)) : r;
  float lat=dTip/R, sg=dot(c,vec2(-d2.y,d2.x))/sqrt(dd)/R;
  float flow=.68+.64*noise(vec3(sg*2.2, (y+uD.w*R*2.)/(R*5.), 3.))*(.7+.3*noise(vec3(sg*7., (y+uD.w*R*3.)/(R*2.), 9.)));
  float core=exp(-lat*lat*1.8)*flow, inner=exp(-lat*lat*10.);
  float halo=exp(-dTip/(R*2.6))*.32+exp(-dTip/(R*11.))*.07;
  float topFade=smoothstep(E.y-S*.15, E.y-S*.6, y);
  float tipD=length(vec2(r,(y-yT)*1.1))/uBm.w;
  float tip=exp(-tipD*tipD*1.4)*5.+exp(-tipD*.9)*.6;
  return vec3(1.,.9,.74)*uBm.y*((core*2.4+inner*4.+halo)*topFade + tip); }
vec3 flameGlow(vec3 ro, vec3 rd, out float tF){
  tF=1e9; if(uFl.w<=0.) return vec3(0);
  vec3 F=uFl.xyz; float sz=uMi.x*(1.+.22*uMi.w);
  vec3 f=normalize(uCamFwd); float tt=dot(F-ro,f)/dot(rd,f); if(tt<=0.) return vec3(0); tF=tt;
  vec3 q=ro+rd*tt-F; vec3 r=normalize(cross(f,vec3(0,1,0))); vec3 up=normalize(cross(r,f));
  vec2 uv=vec2(dot(q,r), dot(q,up))/sz;
  float px=tt/(uFov*uRes.y)/sz, tm=uD.w;
  float sway=(noise(vec3(tm*1.6,0.,0.))-.5)*.14*(1.-.6*uMi.w)+(noise(vec3(tm*5.1,4.,0.))-.5)*.05;
  float k=uv.y+.3, x=uv.x-sway*k*k*1.3;
  float w=.42*pow(clamp(k,0.,1.),.42)*pow(clamp(1.-k,0.,1.),.85+.5*uMi.w)+px*1.2;
  float d=abs(x)/max(w,1e-4), inside=step(0.,k)*step(k,1.);
  float body=smoothstep(1.,.5,d)*inside;
  float core=smoothstep(.75,0.,d)*smoothstep(0.,.18,k)*smoothstep(.8,.2,k)*inside;
  float flick=.88+.24*noise(vec3(tm*8.,uv.y*2.5,1.));
  vec3 col=mix(vec3(1.,.36,.08),vec3(1.,.55,.2),k)*body*2.6 + vec3(1.,.82,.5)*core*10.;
  float rr=length((uv-vec2(0.,.08))*vec2(1.,.8)), rp=rr/max(px,1e-5);
  col+=vec3(1.,.55,.24)*(exp(-rr*rr*2.5)*.55+exp(-rr*1.1)*.14) + vec3(1.,.72,.42)*exp(-rp*rp/7.)*3.*smoothstep(.03,.2,px);
  return col*uFl.w*flick; }

void main(){
  vec3 ro=uCamPos, rd=camRay(gl_FragCoord.xy);
  gHm=rawH(uM.xz,0)-uM.y;
  gHz=skyC(normalize(vec3(rd.x,.012,rd.z)));
  vec3 col=skyC(rd);
  col+=pillarGlow(ro,rd,uP1)+pillarGlow(ro,rd,uP2);
  float tEnt=1e9;
  if(uSn.z>0.){ vec3 E=uC.xyz; float S=uC.w; float glowAcc=0.; float tEye; vec3 eye=greatEye(ro,rd,E,S,tEye);
    vec3 ent; bool hit=marchEntity(ro,rd,E,S,tEye,ent,tEnt,glowAcc);
    if(eye.x>=0. && tEye<tEnt){ ent=eye; tEnt=tEye; hit=true; }
    if(hit){ float hz=1.-exp(-tEnt*.000022); col=mix(col, mix(ent, skyC(rd)+ent*.45, hz), uSn.z); } else tEnt=1e9;
    col+=vec3(1.,.84,.6)*glowAcc*uA.z*uSn.z; }
  float tB, tF; vec3 bm=beamGlow(ro,rd,tB), fl=flameGlow(ro,rd,tF);
  if(tEnt<tB) bm*=.15;
  float T, tC; vec3 cl=marchClouds(ro,rd,T,tC);
  col=col*T+cl;
  col+=bm*(tB<tC?1.:T)+fl*(tF<tC?1.:T);
  fragColor=vec4(col,1.); }`;

  // ---------------------------------------------------------------- world layout (metres; the cloud tops sit near y = 0)
  const PZ = 70000, PX = 22000;               // the two pillars, on the horizon
  const E6 = [0, 7600, 14500], S6 = 1200;      // the being, above the cloud sea
  const MX = [0, 0, 14500];                    // under the being: the cloud top here is exactly y = 0
  const FLAME = 14;                             // flame height (m)
  const camYP = (pos, yaw, pitch, fov) => ({ pos, fwd: [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], up: [0, 1, 0], fov });
  const camAt = (pos, at, fov) => CAMF(pos, at, fov);
  const deg = Math.PI / 180;

  function sky(TT, cam, P, post, alpha = 1) {
    const fin = FINAL();
    const E = P.E || E6;
    GL.frame({ name: "ch6_sky", fs: FS, scale: SC(0.55, 1.5), uniforms: {
      uTime: TT, ...camUniforms(cam),
      uA: [P.open ?? 1, P.ringOpen ?? 1, P.core ?? 1.2, 0], uB: [0, P.gaze ?? 1, 0, 0], uC: [...E, S6],
      uD: [P.dawn ?? 0.5, P.stars ?? 0.5, fin ? 1 : 0, TT - 470],
      uP1: [-PX, PZ, P.p1 ?? 0, P.p1h ?? 0], uP2: [PX, PZ, P.p2 ?? 0, P.p2h ?? 0],
      uBm: [P.tipY ?? 0, P.beam ?? 0, P.beamR ?? S6 * 0.42, P.tipR ?? 11],
      uFl: [MX[0], P.flameY ?? -60, MX[2], P.flame ?? 0],
      uSn: [P.sunEl ?? 0.035, P.sun ?? 0, P.being ?? 0, P.mask ?? 0],
      uMi: [FLAME, P.ember ?? 0, P.warm ?? 1, P.reach ?? 0],
      uM: MX,
      uRing: heavensRings(RING_PHASE + TT * 0.04), uSock: norm(sub(cam.pos, E)),
    } }, { bloom: 0.55, thresh: 1.25, exposure: 1.0, letterbox: LB, vignette: 0.55, t: TT, ...post });
    o.save(); o.globalAlpha = alpha; o.drawImage(GL.canvas, 0, 0); o.restore();
  }

  // ---------------------------------------------------------------- ch6
  const TIP_TOP = E6[1] - S6 * 0.62, TIP_LOW = 0;   // tip y: from the eye down to the meeting height
  function tipY(k) { // the descending light: from the being down to just above the flame
    const a = ease(clamp((k - 22.4) / 4.4));
    const b = ease(clamp((k - 26.4) / 4.6));          // the last approach, seen close
    const close = 168 + 0.0 * b;
    return lerp(TIP_TOP, lerp(250, 166, b), a);
  }
  function flameY(k) { return lerp(-40, 150, ease(clamp((k - 24.6) / 6.4))); }

  function wide(k, TT) { // shot A + B1: one continuous camera from the horizon up to the being and down its light
    const pos = lerp3([0, 420, 0], [0, 485, 1700], clamp(k / 27));
    const tiltUp = ease(clamp((k - 15.6) / 4.2)), tiltDown = ease(clamp((k - 23.2) / 3.6));
    const pitchA = lerp(-3.2, -2.6, clamp(k / 15.6)) * deg;
    const eAt = Math.atan2(E6[1] - pos[1], E6[2] - pos[2]) - 1.5 * deg;
    const tAt = Math.atan2(tipY(k) - pos[1], E6[2] - pos[2]) - 3 * deg;
    const pitch = lerp(lerp(pitchA, eAt, tiltUp), Math.max(tAt, 1.2 * deg), tiltDown);
    const fov = lerp(lerp(1.25, 1.05, tiltUp), 1.0, tiltDown);
    const cam = camYP(pos, 0, pitch, fov);
    const dawn = 0.12 + 0.2 * smooth(0, 5, k) + 0.5 * smooth(5, 17, k) + 0.1 * smooth(17, 26, k);
    const p1 = 2.2 * smooth(5.2, 6.4, k) * (1 - smooth(15.8, 17.4, k));
    const p2 = 2.2 * smooth(10.0, 11.2, k) * (1 - smooth(16.8, 19.6, k));
    const p1h = 60000 * Math.pow(clamp((k - 5.2) / 2.8), 1.6), p2h = 60000 * Math.pow(clamp((k - 10.0) / 2.8), 1.6);
    const q = project(cam, E6), rays = q ? [q[0] / W, 1 - q[1] / H, 0.35 * smooth(16.5, 20, k)] : [0.5, 0.5, 0];
    sky(TT, cam, {
      dawn, stars: 0.55 * (1 - smooth(4, 15, k)) + 0.1, p1, p2, p1h, p2h,
      being: 1, open: 1 - smooth(19.6, 23.4, k), ringOpen: 1 - smooth(19.2, 23.4, k), gaze: 1,
      core: 1.0 + 1.6 * smooth(21, 23.5, k), tipY: tipY(k), beam: 1.6 * smooth(22.2, 23.2, k),
      flameY: flameY(k), flame: smooth(24.4, 25.4, k) * 1.4,
    }, { rays, fade: smooth(0, 1.4, k), exposure: 1.0 });
  }
  function close(k, TT, alpha = 1) { // B2: the meeting, near
    const u = ease(clamp((k - 26.2) / 6));
    const pos = lerp3([MX[0] - 120, 172, MX[2] - 360], [MX[0] - 34, 166, MX[2] - 118], u);
    const at = [MX[0], 160, MX[2]];
    const cam = camAt(pos, at, 1.0);
    const sw = smooth(31, 35, k);
    const q = project(cam, [MX[0], 162, MX[2]]), rays = q ? [q[0] / W, 1 - q[1] / H, 0.25 + 0.6 * sw] : [0.5, 0.5, 0];
    sky(TT, cam, {
      dawn: 0.85, stars: 0.06, being: 0, core: 2.6, tipY: tipY(k) - 1.4 * sw, beam: 1.6 * (1 + 2.5 * sw),
      flameY: flameY(k), flame: 1.4 * (1 + 1.5 * sw), reach: smooth(28, 32, k),
    }, { rays, bloom: 0.55 + 0.5 * sw, exposure: 1.0 + 0.8 * sw, lift: smooth(32.4, 34.9, k) }, alpha);
  }

  function fn6(k, T) {
    const TT = 475 + k;
    if (k < 26.2) wide(k, TT);
    else if (k < 27.4) { wide(k, TT); close(k, TT, ease((k - 26.2) / 1.2)); }
    else close(k, TT);
    chapterCard(k, "VI", "누가 만드는가", 5);
    caption(k, 5.6, 10.0, (a, u) => capB("OpenAI — “AGI가 인류 전체에 이롭도록”", a, u));
    caption(k, 10.2, 16.9, (a, u) => capB("Anthropic — “신뢰할 수 있고, 해석할 수 있고, 조종할 수 있는 AI”", a, u));
    caption(k, 17.6, 21.6, (a, u) => capB("Machines of Loving Grace", a, u, { font: "CormI", size: 54, spacing: 0.06 - 0.03 * ease(u * 2), color: "#f6ead2" }));
    caption(k, 21.8, 25.0, (a, u) => capB("“데이터센터 안의 천재들의 나라”", a, u));
    caption(k, 25.2, 28.5, (a, u) => capB("“그것은 2026년에 올 수도 있다”", a, u));
    caption(k, 28.7, 31.6, (a, u) => capB("— 다리오 아모데이, 2024", a, u));
  }

  // ---------------------------------------------------------------- end
  function fnEnd(k, T) {
    const TT = 510 + k;
    const pos = lerp3([0, 520, 0], [0, 560, 1400], k / 30);
    const night = smooth(10.8, 14.2, k);
    const cam = camYP(pos, 0, lerp(-2.2, -2.6, night) * deg, 1.15);
    sky(TT, cam, {
      dawn: lerp(1.0, 0.07, night), stars: 0.05 + 0.4 * night, being: 0,
      sun: lerp(2.4, 0, smooth(10.8, 13.4, k)), sunEl: lerp(0.012, 0.004, night),
      ember: smooth(11.6, 14, k) * (0.85 + 0.15 * Math.sin((k - 14) * 2 * Math.PI / 7)), mask: smooth(11, 13, k),
      warm: 1,
    }, { lift: 1 - smooth(0, 2.6, k), exposure: 1.0, rays: [0.5, 0.55, 0.25 * (1 - night)], fade: 1 - smooth(28, 30, k) });
    caption(k, 0.8, 3.6, (a, u) => capB("최초의 초지능 기계는", a, u));
    caption(k, 3.8, 7.0, (a, u) => capB("인간이 만들 필요가 있는 마지막 발명이다", a, u));
    caption(k, 7.2, 12.4, (a, u) => capB("— 그 기계가 자신을 통제하는 법을 우리에게 알려줄 만큼 온순하다면", a, u));
    caption(k, 8.4, 12.4, (a, u) => capT("I. J. 굿, 1965", a, u));
    // end screen
    const f = 1 - smooth(28, 30, k);
    const qa = smooth(13.2, 15.0, k) * f;
    if (qa > 0) {
      line("당신은 누가 먼저 도달한다고 보나요?", W / 2, BAR + 98, { size: 54, spacing: 0.2 - 0.05 * ease((k - 13.2) / 5), alpha: qa, glow: 14, blur: (1 - qa) * 5 });
      o.save(); o.globalAlpha = qa * 0.6; o.fillStyle = GOLD; const hw = 70 * smooth(14, 16, k); o.fillRect(W / 2 - hw, BAR + 152, hw * 2, 1); o.restore();
    }
    const ta = smooth(14.4, 16.2, k) * f;
    if (ta > 0) line("인류의 마지막 발명", W / 2, BAR / 2, { size: 24, color: GOLD, spacing: 0.55, alpha: ta, glow: 6 });
  }

  chapter("ch6", 35, fn6);
  chapter("end", 30, fnEnd);
})();
