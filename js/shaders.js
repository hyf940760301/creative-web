// Original shaders for NOVA STUDIO. Simplex noise: Ashima Arts / Stefan Gustavson (MIT).
export const NOISE = /* glsl */`
vec3 m289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 m289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 perm(vec4 x){return m289(((x*34.)+1.)*x);}vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=m289(i);
vec4 p=perm(perm(perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 nm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;

// ---------- Hero centerpiece: "liquid prism" — morphing iridescent form ----------
export const blobVert = NOISE + /* glsl */`
uniform float uT,uAmp,uFreq,uMorph,uPulse;uniform vec3 uMouse;
varying vec3 vN,vW,vV;varying float vD;
float field(vec3 p){
  float t=uT*.18;
  vec3 q=p*mix(uFreq,uFreq*.62,uMorph);
  float a=snoise(q+vec3(t,t*.7,-t*.5));
  float b=snoise(q*1.9+a*.35-vec3(0.,t*1.1,0.))*mix(.28,.12,uMorph);
  float big=snoise(p*.55+vec3(-t*.5,t*.3,0.))*.6;           // smooth, low-frequency lobes for the about morph
  float d=mix(a+b, big+a*.35, uMorph);
  float mb=smoothstep(1.9,0.,distance(p,uMouse))*.32;
  return clamp(d*uAmp+mb+uPulse*sin(p.y*6.-uT*4.)*.03,-.28,.42);
}
vec3 disp(vec3 p){return p*(1.+field(p));}
void main(){
  vec3 p=position;vec3 n=normalize(p);
  vec3 tg=normalize(cross(n,abs(n.y)<.99?vec3(0.,1.,0.):vec3(1.,0.,0.)));vec3 bt=cross(n,tg);
  float e=.004;vec3 P=disp(p);
  vec3 A=disp(normalize(p+tg*e)),B=disp(normalize(p+bt*e)),A2=disp(normalize(p-tg*e)),B2=disp(normalize(p-bt*e));
  vec3 N=normalize(cross(A-A2,B-B2));if(dot(N,n)<0.)N=-N;
  vD=field(p);
  vec4 w=modelMatrix*vec4(P,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*N);vV=normalize(cameraPosition-w.xyz);
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
export const blobFrag = /* glsl */`
uniform float uT,uHue;uniform vec3 uA,uB;varying vec3 vN,vW,vV;varying float vD;
vec3 film(float t){return .5+.5*cos(6.28318*(t+vec3(0.,.33,.67)+uHue));}
void main(){
  vec3 N=normalize(vN),V=normalize(vV);
  float ndv=clamp(dot(N,V),0.,1.);float fr=.04+.96*pow(1.-ndv,5.);
  vec3 R=reflect(-V,N);
  // soft studio: big diffuse softboxes, gentle horizon, no hard hotspots
  float hor=smoothstep(-.35,.45,R.y);
  float box1=smoothstep(.55,.95,dot(R,normalize(vec3(-.6,.7,.4))));
  float box2=smoothstep(.75,.98,dot(R,normalize(vec3(.8,.2,.5))));
  float strip=smoothstep(.6,1.,sin(R.y*4.+R.x*1.5+uT*.1)*.5+.5)*.12;
  vec3 env=mix(vec3(.006,.006,.012),vec3(.05,.05,.07),hor)+box1*vec3(.75)+box2*vec3(.38,.4,.5)+strip+pow(max(dot(R,normalize(vec3(-.4,.8,.45))),0.),90.)*.9;
  // thin-film interference: thickness varies with view angle + surface field
  float thick=ndv*1.1+vD*1.8+uT*.02;
  vec3 irid=film(thick);
  vec3 spec=env*mix(vec3(1.),irid,.7);
  // fake transmission: dim tinted body seen through
  vec3 body=mix(vec3(.015,.012,.03),irid*.08,.6)*(1.-fr);
  vec3 col=body+spec*(.35+.65*fr)+irid*fr*.35;
  col+=uB*pow(1.-ndv,3.)*.12;           // subtle violet rim
  col=min(col,vec3(1.2));                 // clamp specular energy
  gl_FragColor=vec4(col,1.);
}`;

// ---------- Particles ----------
export const dustVert = NOISE + /* glsl */`
uniform float uT,uPR,uSize;uniform vec3 uMouse;attribute float aR;varying float vA;varying float vK;
void main(){
  vec3 p=position;float t=uT*.06;
  p+=vec3(snoise(p*.07+vec3(t,0.,0.)),snoise(p*.07+vec3(0.,t,9.)),snoise(p*.07+vec3(5.,0.,t)))*1.6;
  vec3 d=p-uMouse;float f=smoothstep(3.5,0.,length(d));p+=normalize(d+.0001)*f*1.3;
  vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
  gl_PointSize=uSize*(.6+aR*1.8)*uPR*(14./max(-mv.z,.5));
  vA=(.12+.6*aR)*smoothstep(60.,8.,-mv.z)*smoothstep(.5,3.,-mv.z)*(.6+.4*sin(uT*(1.+aR*2.)+aR*40.));vK=aR+f;
}`;
export const dustFrag = /* glsl */`
uniform vec3 uA,uB;varying float vA;varying float vK;
void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float g=pow(1.-d*2.,2.2);
vec3 c=mix(vec3(.75,.78,.9),vK>.93?uA:uB,step(.82,vK)*.85);gl_FragColor=vec4(c,vA*g);}`;

export const haloVert = /* glsl */`
uniform float uT,uPR;attribute float aR;attribute float aA;varying float vA;
void main(){float a=aA+uT*(.08+aR*.12);float r=2.25+aR*1.1+sin(aA*6.+uT)*.05;
vec3 p=vec3(cos(a)*r,(aR-.5)*.12+sin(a*3.+uT*.5)*.08,sin(a)*r);
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.+aR*2.)*uPR*(10./-mv.z);vA=.35+.65*aR;}`;
export const haloFrag = /* glsl */`
uniform vec3 uA;varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(mix(vec3(.9,.9,1.),uA,.18)*.7,vA*(1.-d*2.)*.8);}`;

// ---------- Project cards: procedural "project visual" + parallax UI layers ----------
export const cardVert = /* glsl */`
uniform float uT,uHover,uVel;uniform vec2 uUV;varying vec2 vUv;
void main(){vUv=uv;vec3 p=position;
float d=distance(uv,uUV);p.z+=sin(d*22.-uT*6.)*.035*uHover*smoothstep(.55,0.,d);
p.z-=uVel*.55*(1.-pow(abs(uv.x*2.-1.),2.));p.y+=uVel*.2*(uv.x-.5);
gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
export const cardFrag = NOISE + /* glsl */`
uniform sampler2D uMid,uFg;uniform float uT,uHover,uVel,uActive,uReveal,uKind,uAspect;uniform vec2 uUV,uPar;uniform vec3 uC0,uC1,uC2;varying vec2 vUv;
float h21(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*snoise(p);p*=2.03;a*=.5;}return s;}
vec3 ramp(float t){t=clamp(t,0.,1.);return t<.5?mix(uC0,uC1,t*2.):mix(uC1,uC2,t*2.-1.);}
vec3 visual(vec2 uv,float T){
  vec2 q=vec2((uv.x-.5)*uAspect,uv.y-.5);
  if(uKind<.5){ // flowing fluid (domain-warped noise)
    vec3 w=vec3(q*1.6,T*.12);float a=fbm(w);float b=fbm(w+vec3(a*1.8,-a,T*.05));
    float f=fbm(w+vec3(b*2.2,a*1.4,0.));return ramp(.5+f*.9)+pow(max(f,0.),3.)*uC2*1.5;
  } else if(uKind<1.5){ // generative typographic grid
    vec2 g=vec2(28.,14.);vec2 id=floor(uv*g),f=fract(uv*g);float r=h21(id);
    float wave=sin(id.x*.35+id.y*.6-T*2.2)*.5+.5;float on=step(.45,fract(r*7.+T*.25*step(.8,r)));
    float glyph=step(.18,f.x)*step(f.x,.82)*step(.2,f.y)*step(f.y,.8);
    float bar=mix(step(abs(f.y-.5),.09),step(abs(f.x-.5),.09),step(.5,r));
    float ring_=step(abs(length(f-.5)-.25),.06);
    float sh=r<.33?bar:r<.66?ring_:glyph*.35;
    vec3 bg=mix(uC0,uC1*.35,uv.y);return bg+ramp(wave)*sh*on*(.35+.9*wave);
  } else if(uKind<2.5){ // topographic contour lines
    float n=fbm(vec3(q*1.4,T*.06))*1.2+length(q-(uPar*.3))*.3;float c=fract(n*9.);
    float l=smoothstep(.06,0.,abs(c-.5)-.42);float major=smoothstep(.04,0.,abs(fract(n*1.8)-.5)-.47);
    vec3 col=mix(uC0,uC1*.5,smoothstep(-.6,.8,n));return col*.8+l*ramp(.3+n*.5)*.35+major*uC2*.4;
  } else if(uKind<3.5){ // halftone particle form
    vec2 g=vec2(64.,40.);vec2 id=floor(uv*g)+.5;vec2 c=(id/g-.5)*vec2(uAspect,1.);
    float body=smoothstep(.36,.0,length(c-vec2(sin(T*.4)*.12,.02))-.05)+smoothstep(.22,.0,length(c-vec2(.18+cos(T*.3)*.08,.16)))*.8;
    body+=fbm(vec3(c*3.,T*.15))*.25;float rad=clamp(body,0.,1.)*.48;
    float dot_=smoothstep(rad,rad-.12,length(fract(uv*g)-.5));
    return mix(uC0*.6,uC0,uv.y)+dot_*ramp(body*1.1)*1.2;
  } else { // glass shapes
    vec3 col=mix(uC0,uC1*.6,uv.y+sin(T*.2)*.1);
    for(int i=0;i<4;i++){float fi=float(i);vec2 cp=vec2(sin(T*.25+fi*1.7)*.45,cos(T*.2+fi*2.3)*.22);
      float r=.12+.05*fi;float d=length(q-cp)-r;float inside=smoothstep(.004,0.,d);
      vec2 refr=(q-cp)*(1.-.35*inside);float edge=smoothstep(.015,0.,abs(d))*.9;
      vec3 under=mix(uC0,uC2,smoothstep(-.4,.5,refr.y+refr.x*.3));
      col=mix(col,under*1.1+pow(1.-clamp(-d/r,0.,1.),4.)*.6,inside*.85)+edge*uC2;}
    return col;
  }
}
void main(){vec2 uv=vUv;
  float edge=uReveal*1.25-.12+(h21(floor(uv*vec2(40.,1.)))-.5)*.08;if(uv.y>edge)discard;
  vec2 par=uPar; // pointer parallax (-.5..5)
  float d=distance(vUv,uUV);vec2 dir=normalize(vUv-uUV+1e-4);
  vec2 vuv=.5+(uv-.5)*(.9-.04*uHover)+par*.05+dir*sin(d*38.-uT*7.)*.008*uHover*smoothstep(.5,0.,d);
  float s=.004*uHover+abs(uVel)*.02;
  vec3 col=vec3(visual(vuv+vec2(s,0.),uT).r,visual(vuv,uT).g,visual(vuv-vec2(s,0.),uT).b);col=min(col*.7,vec3(.5));
  // live thumbnail strip (bottom-right), each a different time slice
  for(int k=0;k<4;k++){vec2 o=vec2(.68+float(k)*.068,.07),sz=vec2(.058,.085);vec2 lu=(uv-par*.012-o)/sz;
    if(lu.x>0.&&lu.x<1.&&lu.y>0.&&lu.y<1.){col=min(visual(lu,uT*.6+float(k)*7.)*.6,vec3(.5));col+=step(.96,max(lu.x,lu.y))*.4+step(max(lu.x,lu.y),.04)*.0;}}
  float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l)*.55,col,.3+.7*uActive);
  col*=.55+.35*uActive+.2*uHover;
  // inner vignette for depth
  col*=1.-.45*pow(length((uv-.5)*vec2(1.,1.3)),2.);
  // mid UI layer + mini progress bar
  vec4 mid=texture2D(uMid,uv-par*.014);
  float pb=step(abs(uv.y-.045),.003)*step(.06,uv.x)*step(uv.x,.38);float pf=step(uv.x,.06+.32*fract(uT*.08+uKind*.21));
  col=mix(col,vec3(1.),pb*(.25+.75*pf));
  col=mix(col,mid.rgb*.5,mid.a*(.55+.45*uActive));
  // foreground title layer — crisp, no chromatic shift
  vec4 fg=texture2D(uFg,uv+par*.012);col=mix(col,fg.rgb*.6,fg.a);
  // specular glare sweep following pointer / tilt
  float gl=smoothstep(.22,0.,abs(dot(uv-uUV,normalize(vec2(1.,-.6)))))*.18*uHover;
  gl+=smoothstep(.04,0.,abs(fract(uv.x*.6-uv.y*.4-uT*.05)-.5)-.46)*.05*uActive;
  col+=gl*.6;
  float fr=smoothstep(0.,.004,vUv.x)*smoothstep(1.,.996,vUv.x)*smoothstep(0.,.006,vUv.y)*smoothstep(1.,.994,vUv.y);
  float border=(1.-smoothstep(0.,.0035,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y))*1.))*.35*uActive;
  float line=(1.-smoothstep(0.,.004,abs(vUv.y-edge)))*step(uReveal,.999);
  gl_FragColor=vec4(col+border+line*vec3(.83,1.,.23)*2.,fr);}`;

// ---------- Final grade: chromatic aberration, grain, vignette, flash ----------
export const finalShader = {
  uniforms: { tDiffuse:{value:null}, uT:{value:0}, uCA:{value:.0025}, uGrain:{value:.022}, uVig:{value:1.}, uFlash:{value:0}, uRes:{value:null} },
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uT,uCA,uGrain,uVig,uFlash;varying vec2 vUv;
  float h(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
  void main(){vec2 c=vUv-.5;float r=dot(c,c);vec2 o=c*r*uCA*14.;
  vec3 col=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
  col*=mix(1.,smoothstep(.9,.05,r*1.7),uVig);col=max(col-.012,0.)*1.012;
  col+=(h(vUv*1000.+fract(uT*7.3))-.5)*uGrain;
  col=mix(col,vec3(1.),uFlash);
  gl_FragColor=vec4(col,1.);}`
};
