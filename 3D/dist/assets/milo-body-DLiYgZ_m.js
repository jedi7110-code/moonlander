import{g as d,aO as It,bf as Yt,S as Kt,G as jt,_ as St,U as pt,i as Nt,F as st,a2 as Wt,bl as at,V as $,Y as nt,C as $t,m as Ut,E as qt,a3 as Ft,ar as Et,as as Ht,$ as Lt,Q as zt,e as Ot,K as Vt,c as Gt,s as Qt}from"./three-DEZM1chT.js";import{t as Jt}from"./triangle-subset-gaf9ScNe.js";const to=`
float miloBruiseHash(vec2 p){
  vec3 h=fract(vec3(p.xyx)*.1031);
  h+=dot(h,h.yzx+33.33);
  return fract((h.x+h.y)*h.z);
}
float miloBruiseNoise(vec2 p){
  vec2 cell=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(miloBruiseHash(cell),miloBruiseHash(cell+vec2(1,0)),f.x),
    mix(miloBruiseHash(cell+vec2(0,1)),miloBruiseHash(cell+vec2(1,1)),f.x),f.y);
}
vec3 miloBruisedSkin(vec3 skin,vec2 p,float mask,float strength){
  if(mask<.001||strength<.001)return skin;
  float islands=miloBruiseNoise(p*3.8+vec2(8.2,2.9));
  float mottling=miloBruiseNoise(p*14.0+vec2(3.6,9.1));
  float grain=miloBruiseNoise(p*73.0+vec2(17.1,4.2));
  float fine=miloBruiseNoise(p*157.0+vec2(2.3,19.4));
  float field=.50*islands+.34*mottling+.16*grain;

  // A diffuse ochre undertone around/between the darker subcutaneous islands.
  // Keep the skin underneath visible; this is not an opaque wound decal.
  float edge=smoothstep(.0,.26,mask)*(1.0-smoothstep(.35,.85,mask));
  float halo=mask*.18+edge*.34;
  vec3 ochre=skin*vec3(.92,.78,.48);
  vec3 surface=mix(skin,ochre,halo*strength*(.65+.35*islands));

  // Uneven pale centre, with purple/burgundy concentrations rather than a ring.
  vec2 centre=(p-vec2(.12,-.10))/vec2(.34,.43);
  float clearing=exp(-dot(centre,centre)*1.8)*(.55+.35*mottling);
  float coverage=smoothstep(.08,.72,mask+(field-.5)*.40);
  float density=coverage*(.40+.60*smoothstep(.25,.72,field))*(1.0-.82*clearing);
  density*=.88+.12*fine;
  vec3 plum=vec3(.064,.019,.052),burgundy=vec3(.155,.034,.050);
  vec3 pigment=mix(plum,burgundy,smoothstep(.25,.72,mottling));
  pigment*=.84+.30*grain;
  surface=mix(surface,pigment,strength*density*.89);
  return mix(surface,ochre,clearing*coverage*strength*.32);
}
`;function oo(c,w,k,x){if(c>=0||x<.9)return 0;const B=(w-1.13)/.055,F=(k+.003)/.045,M=Math.hypot(B,F)+.06*Math.sin(B*7+F*4)+.045*Math.sin(F*11-B*3);return(1-d.smoothstep(M,.4,1.12))*d.smoothstep(-c,.19,.225)*d.smoothstep(x,.9,.98)}function eo(c,w,k,x){if(c>=0||x<.9||k<=.001)return 0;const B=(w-.892)/.025,F=(c+.212)/.023,M=Math.hypot(B,F)+.08*Math.sin(B*5-F*7)+.04*Math.sin(B*11+F*3);return(1-d.smoothstep(M,.32,1.1))*d.smoothstep(k,.001,.012)*d.smoothstep(x,.9,.98)}function so(c){if(c?.condition?.kind==="injury"){const w=c.treatment;return w?.kind==="injury"?1-.35*d.smoothstep(w.elapsed/w.duration,0,1):1}return .65*d.smoothstep((c?.bandageTime??0)/180,0,1)}function co(c,w){const k=so(w);c.userData.bruiseStrength=k;const x=c.userData.bodySkin?.material.userData.bruiseStrength;x&&(x.value=k)}const Ct=`
vec2 miloKneeFolds(vec3 p){
  float x=abs(p.x)-.105;
  float handed=p.x<0.0?-1.0:1.0;
  vec2 folds=vec2(0.0);
  for(int i=0;i<3;i++){
    float row=float(i);
    float slope=i==1?.19:-.14;
    float center=.567-row*.041+handed*.003+handed*slope*x+.004*cos(x*28.0+row);
    float taper=1.0-smoothstep(.035,.085,abs(x+(row-1.0)*.008));
    float width=mix(.0025,.009,taper);
    float d=p.y-center;
    float valley=exp(-pow(d/width,2.0));
    float ridge=exp(-pow((d-.010)/(width*1.6),2.0));
    folds+=vec2(valley,ridge)*taper*(i==1?1.0:.86);
  }
  return min(folds,vec2(1.0));
}
vec2 miloFrontFolds(vec3 p){
  float side=abs(p.x);
  float offset=p.x<0.0?-.002:.002;
  vec2 folds=vec2(0.0);
  for(int i=0;i<2;i++){
    float center=i==0?.878+.20*(side-.025):.858+.025*(side-.070);
    float start=i==0?.022:.052;
    float end=i==0?.168:.153;
    float taper=smoothstep(start,start+.023,side)*(1.0-smoothstep(end-.038,end,side));
    float width=mix(.002,.007,taper);
    float d=p.y-center-offset;
    folds+=vec2(exp(-pow(d/width,2.0)),exp(-pow((d-.009)/(width*1.7),2.0)))*taper*(i==0?1.0:.78);
  }
  return min(folds,vec2(1.0));
}
`;let H=null,tt=null,it=null,N=null;function ao(c){c&&(c.userData.poseBoundsStale=!0)}function Dt(c){if(!c)return null;const w=new Ot({side:Ut}),k=[-1,1].map(l=>(1.563-.02*l-1.637)/.055),x=new Vt(new $(-1/0,Math.min(...k)-1e-4,-1/0),new $(1/0,Math.max(...k)+1e-4,1/0)),B=new Gt(Jt(c,x),w),F=new Qt,M=[];for(let l=0;l<128;l++){const A=l*Math.PI*2/128,i=Math.cos(A),X=Math.sin(A);F.set(new $(i*4,(1.563-.02*X-1.637)/.055,X*4),new $(-i,0,-X));const L=F.intersectObject(B,!1)[0];M.push(L?(4-L.distance)*.055:null)}return w.dispose(),B.geometry.dispose(),M.every(l=>Number.isFinite(l)&&l>.03)?M:null}async function no(c="/3D/assets/obs/milo/body.json"){if(H)return H;const w="/3D/",k=typeof document<"u"?new It:null,x=k?Promise.all(["tattoo-cosmo-atomic-bold.webp","tattoo-cat-red.webp","tshirt-back-print.webp","tattoo-right-upper.webp"].map(M=>k.loadAsync(`${w}assets/obs/milo/${M}`))):null;x?.catch(()=>{});const B=await fetch(c);if(!B.ok)throw new Error("Milo body could not be loaded");const F=await B.json();if(x){const M=await x;tt=M.slice(0,2),N=M[2],it=M[3];for(const X of[...tt,it])X.colorSpace=Yt,X.anisotropy=4;const l=N.image,A=document.createElement("canvas");A.width=Math.min(1024,l.width),A.height=Math.round(A.width*l.height/l.width);const i=A.getContext("2d");i.imageSmoothingQuality="high",i.drawImage(l,0,0,A.width,A.height),N.image=A,N.colorSpace=Kt,N.anisotropy=4,N.needsUpdate=!0}return H=F,H}function io(c,w,k,x){if(!H)return null;const{body:B,chest:F,head:M,arms:l,legs:A}=c.userData,i=H,X=.274+l[0].hand.position.y,L=.904+X,q={body:B,chest:F,head:M},ut=[];for(let t=0;t<l.length;t++){const s=l[t].side<0?"L":"R";l[t].hand.position.z=-.025,l[t].hand.scale.set(1.16,1.05,1.08);for(const o of["arm","elbow","hand"])q[s+"_"+o]=l[t][o];for(const o of["leg","knee","boot"])q[s+"_"+o]=A[t][o];l[t].fingers.forEach((o,n)=>{[o,...o.userData.links].forEach((r,g)=>q[`${s}_finger${n}_${g}`]=r)}),q[s+"_thumb"]=l[t].thumb;for(let o=1;o<=2;o++){const n=new jt;n.position.copy(l[t].hand.position),n.position.z*=o/3,l[t].elbow.add(n),n.scale.set(1,1,1).lerp(l[t].hand.scale,o/3),q[`${s}_wrist${o}`]=n,ut.push({driver:n,hand:l[t].hand,side:l[t].side,fraction:o/3})}}const rt=i.bones.map(t=>{const s=new St;return s.name="Milo skin "+t.name,q[t.name].add(s),s}),ht=i.bones.map(t=>{const s=[...t.target];return/_(hand|finger|thumb|wrist)/.test(t.name)&&(s[1]+=X),new pt().makeTranslation(...s.map(o=>-o))}),v=new Nt;v.setAttribute("position",new st(i.positions,3)),v.setAttribute("uv",new st(i.uvs,2)),v.setAttribute("skinIndex",new Wt(i.joints,4)),v.setAttribute("skinWeight",new st(i.weights,4));const e=v.attributes.position,a=d.smoothstep,I=Dt(M.getObjectByName("Milo scanned head")?.geometry),ot=new Map,ft=[.96,1.025,1.075,1.1,1.125,1.175,1.225,1.275,1.325,1.36],Rt=new at(ft,[.178,.179,.158,.158,.173,.174,.177,.181,.185,.186],1),At=new at(ft,[.178,.17,.156,.153,.15,.149,.157,.175,.184,.186],1),vt=[.17,.22,.3,.4,.535,.65,.72,.77,.82,.87,.94],Tt=new at(vt,[.069,.077,.078,.08,.087,.095,.098,.094,.074,.074,.076],1),Xt=new at(vt,[.069,.08,.081,.081,.08,.081,.081,.08,.078,.075,.076],1);for(let t=0;t<e.count;t++){const s=Math.abs(e.getX(t)),o=e.getY(t),n=e.getZ(t);if(o>.17&&o<.94){const m=Xt.evaluate(o)[0]/Tt.evaluate(o)[0],h=1-a(o,.75,.82),y=a(o,.17,.22)*(1-a(o,.87,.94))*(1-a(i.armRegions[t],.05,.2)),S=d.lerp(h,1,a(s,.075,.125));e.setX(t,Math.sign(e.getX(t))*(s+(s-.1)*(m-1)*y*S))}if(s<.05&&o>.75&&o<.89&&i.armRegions[t]<.05){const m=Math.cos((i.uvs[t*2]-.5)*Math.PI*2),h=(1-a(s,.015,.05))*a(o,.75,.78)*(1-a(o,.855,.89)),y=Math.sign(m)*Math.max(Math.abs(e.getX(t)),.016*Math.abs(m));e.setX(t,d.lerp(e.getX(t),y,h))}if(o>.96&&o<1.36){const m=1-a(i.armRegions[t],.05,.2),h=Math.min(1,At.evaluate(o)[0]/Rt.evaluate(o)[0]),y=a(o,.96,1.005)*(1-a(o,1.325,1.36))*m;e.setX(t,e.getX(t)*d.lerp(1,h,y))}if(i.armRegions[t]>.95&&o<1.24){const m=e.getX(t)<0?-1:1,h=m*.207,y=l.find(f=>f.side===m).hand;let S=0,_=0,R=0,Z=0,E=0,Y=0;for(let f=0;f<4;f++){const T=i.bones[i.joints[t*4+f]].name,K=T.endsWith("_wrist1")?1/3:T.endsWith("_wrist2")?2/3:/hand|finger|thumb/.test(T)?1:0,j=i.weights[t*4+f],V=Math.cos(K*m*Math.PI/2),G=Math.sin(K*m*Math.PI/2),Q=1+(y.scale.x-1)*K,J=1+(y.scale.z-1)*K;S+=j*V*Q,_+=j*G*J,R-=j*G*Q,Z+=j*V*J,Y+=j*y.position.z*K,E+=j*(1+(y.scale.y-1)*K)}if(ot.set(t,{m00:S,m02:_,m20:R,m22:Z,sy:E,tz:Y,pivot:h}),o>.855){const f=d.clamp((o-.88)/.3,0,1),T=.025+.039*f-.014*f*f,K=.036+.037*f-.016*f*f,j=-.036-.039*f+.014*f*f,V=-m*.01*a(o,.88,1.14),G=S*(e.getX(t)-h)+_*n,Q=R*(e.getX(t)-h)+Z*n+Y,J=Math.atan2((Q-j)/K,(G-V)/T),xt=a(o,.855,.88)*(1-a(o,1.14,1.24)),Bt=d.lerp(G,V+Math.cos(J)*T,xt),Mt=d.lerp(Q,j+Math.sin(J)*K,xt)-Y,Pt=S*Z-_*R;e.setX(t,h+(Z*Bt-_*Mt)/Pt),e.setZ(t,(S*Mt-R*Bt)/Pt)}}const r=Math.hypot(s,n+.009);if(o>1.47&&r>.001&&r<.14){const m=1.563-.02*(n+.009)/r,h=(n+.009)/r,y=h>0?.081:.07;let S=1/Math.hypot(e.getX(t)/r/.076,h/y);if(I){const f=(Math.atan2(n+.009,e.getX(t))+Math.PI*2)%(Math.PI*2)*I.length/(Math.PI*2),T=Math.floor(f);S=d.lerp(I[T],I[(T+1)%I.length],f-T)+.001}const _=S+.3*Math.max(0,m-o)+(I?.01*a(m-o,0,.018):0),R=a(o,1.47,1.54)*(1-a(r,.11,.14)),Z=_-r,E=.5*(Z+Math.sqrt(Z*Z+16e-6)),Y=I?d.lerp(r,_,R):r+E*R;if(e.setX(t,e.getX(t)*Y/r),e.setZ(t,-.009+(n+.009)*Y/r),I){const f=a(r-S,.004,.025)*(1-a(s,.11,.16)),T=m-.002;e.setY(t,o-Math.max(0,o-T)*f)}}if(s>.11&&s<.29&&o>1.37){const m=s-.175,h=o-1.4,y=n+.025,S=Math.hypot(m/.085,h/.14,y/.098),_=a(s,.11,.17)*a(o,1.37,1.46),R=d.lerp(1,1/S,_),Z=I&&s<.16?Math.min(e.getY(t),1.4+h*R):1.4+h*R;e.setXYZ(t,Math.sign(e.getX(t))*(.175+m*R),Z,-.025+y*R);const E=1.552-.043*a(s,.085,.24)-.07*(n/.1)**2,Y=a(s,.095,.13)*(1-a(s,.22,.26))*a(o,1.48,1.525);e.setY(t,e.getY(t)+Math.min(.012,Math.max(0,E-e.getY(t)))*Y)}if(i.armRegions[t]>.95&&o>1.24&&o<1.44){const m=a(o,1.24,1.29)*(1-a(o,1.37,1.44)),h=a(n,-.065,.015),y=Math.sign(e.getX(t));e.setX(t,y*(.207+(Math.abs(e.getX(t))-.207)*(1-.05*m))),e.setZ(t,e.getZ(t)-.1*m*h*Math.max(0,n+.045))}const g=a(-n,.01,.065)*(1-a(i.armRegions[t],.05,.3));if(!g||o<.68||o>1.19)continue;const P=a(o,1.015,1.055)*(1-a(o,1.125,1.185)),p=.13*Math.sqrt(Math.max(0,1-(s/.181)**2));let u=d.lerp(-n,Math.max(-n,p),g*P);const C=a(o,.83,.96),U=.1*(1-C),b=d.lerp(.098,.182,C),W=d.lerp(.117,.139,a(o,.74,.96))*Math.sqrt(Math.max(0,1-((s-U)/b)**2)),mt=a(o,.68,.75)*(1-a(o,.955,1.015))*a(s,.015,.05);u=d.lerp(u,Math.max(u,W),g*mt),e.setZ(t,-u)}for(let t=0;t<e.count;t++){const s=e.getY(t),o=a(i.armRegions[t],.8,.95);e.setY(t,s+X*d.clamp((1.178-s)/.274,0,1)*o)}v.setIndex(i.indices),v.computeVertexNormals(),v.computeBoundingBox(),v.computeBoundingSphere();const et=v.clone(),Zt=et.attributes.position;for(const[t,{m00:s,m02:o,m20:n,m22:r,sy:g,tz:P,pivot:p}]of ot){const u=e.getX(t)-p,C=e.getY(t),U=e.getZ(t);Zt.setXYZ(t,p+s*u+o*U,L+(C-L)*g,n*u+r*U+P)}et.computeVertexNormals();const O=new $,gt=new $;for(const[t,{m00:s,m02:o,m20:n,m22:r,sy:g}]of ot){const P=i.positions[t*3+1],p=a(P,.855,.88)*(1-a(P,1.14,1.24));if(!p)continue;O.fromBufferAttribute(et.attributes.normal,t);const{x:u,z:C}=O,U=s*r-o*n;O.set((r*u-o*C)/U,O.y/g,(s*C-n*u)/U).normalize(),gt.fromBufferAttribute(v.attributes.normal,t).lerp(O,p).normalize(),v.attributes.normal.setXYZ(t,...gt.toArray())}et.dispose();const lt=new Float32Array(e.count*2),yt=new Float32Array(e.count);for(const[t,{m00:s,m02:o,m20:n,m22:r,tz:g,pivot:P}]of ot){const p=e.getX(t)<0?-1:1,u=e.getX(t)-P,C=e.getZ(t),U=i.positions[t*3+1],b=d.clamp((U-.88)/.3,0,1),W=-.036-.039*b+.014*b*b,mt=-p*.01*a(U,.88,1.14),m=s*u+o*C,h=n*u+r*C+g,y=.07,S=.21;lt[t*2]=.5-p*(h-W)/y,lt[t*2+1]=.5+(e.getY(t)-1.055)/S,yt[t]=a(p*(m-mt),.008,.02)*a(i.armRegions[t],.9,.98)}v.setAttribute("tattooUv",new nt(lt,2)),v.setAttribute("tattooMask",new nt(yt,1)),v.setAttribute("armRegion",new st(i.armRegions,1));const bt=new Float32Array(e.count),ct=new Float32Array(e.count*2);for(let t=0;t<e.count;t++){const s=e.getX(t),o=e.getY(t),n=e.getZ(t),r=i.armRegions[t];bt[t]=Math.max(oo(s,o,n,r),eo(s,o,n,r)),ct[t*2]=o<1?(o-.892)/.025+.75:(o-1.13)/.055,ct[t*2+1]=o<1?(s+.212)/.023+.65:(n+.003)/.045}v.setAttribute("bruiseMask",new nt(bt,1)),v.setAttribute("bruiseUv",new nt(ct,2));const z=w.skin.clone(),dt=k.userData.fabricMap??k.bumpMap;z.roughness=.84;const _t=new $t(11251372);z.userData.bruiseStrength={value:0},z.shirtBackPrint=N,z.tattooRightUpper=it,z.side=Ut,z.shadowSide=qt,dt&&(z.bumpMap=dt.clone(),z.bumpMap.repeat.set(18,24),z.bumpMap.needsUpdate=!0,z.bumpScale=.006),z.onBeforeCompile=t=>{t.uniforms.bruiseStrength=z.userData.bruiseStrength,t.uniforms.tattooAtom={value:tt?.[0]??null},t.uniforms.tattooCat={value:tt?.[1]??null},t.uniforms.tattooStrength={value:tt?.88:0},t.uniforms.tattooRightUpper={value:it},t.uniforms.shirtBackPrint={value:N},t.uniforms.shirtBackPrintStrength={value:N?1:0},t.uniforms.shirtColor={value:_t},t.uniforms.trouserColor={value:k.color},t.uniforms.trouserMap={value:dt},t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
attribute float bruiseMask; varying float vBruiseMask; attribute vec2 bruiseUv; varying vec2 vBruiseUv; attribute float armRegion; attribute vec2 tattooUv; attribute float tattooMask; varying vec2 vTattooUv; varying float vTattooMask; varying float vArmRegion; varying vec3 vBodyPosition; varying vec2 vMiloUv;`+Ct).replace("#include <begin_vertex>",`#include <begin_vertex>
      vBruiseMask=bruiseMask;vBruiseUv=bruiseUv;
      vBodyPosition=position;vArmRegion=armRegion;vMiloUv=uv;vTattooUv=tattooUv;vTattooMask=tattooMask;
      float trouserVertex=(1.0-smoothstep(1.065,1.085,position.y))*(1.0-smoothstep(.2,.5,armRegion));
      float frontMask=smoothstep(.015,.095,position.z),backMask=smoothstep(.015,.095,-position.z);
      float kneeShape=exp(-pow((position.y-.53)/.16,2.0));
      float calfShape=exp(-pow((position.y-.30)/.21,2.0));
      float backKneeShape=backMask*exp(-pow((position.y-.525)/.090,2.0));
      float waistShape=exp(-pow((position.y-1.005)/.055,2.0));
      float crotchShape=frontMask*exp(-pow((position.y-.865)/.115,2.0));
      float clothFold=sin(position.y*38.0+position.z*27.0+position.x*13.0)*sin(position.y*17.0-position.z*41.0);
      float crossFold=sin(position.x*58.0+position.y*31.0-position.z*19.0);
      vec2 backKneeFolds=miloKneeFolds(position);
      float backKneeFold=-backKneeFolds.x+.30*backKneeFolds.y;
      float waistFold=sin(position.x*67.0+position.z*36.0)+.45*sin(position.x*109.0-position.z*51.0);
      vec2 frontFolds=miloFrontFolds(position);
      float crotchFold=-frontFolds.x+.30*frontFolds.y;
      transformed+=normal*trouserVertex*(.0009*clothFold+(.0015*kneeShape+.0007*calfShape)*crossFold+.0028*backKneeShape*backKneeFold+.0017*waistShape*waistFold+.0022*crotchShape*crotchFold);
    `),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
uniform float bruiseStrength;varying float vBruiseMask;varying vec2 vBruiseUv;uniform vec3 shirtColor;uniform vec3 trouserColor;uniform sampler2D trouserMap;uniform sampler2D tattooAtom;uniform sampler2D tattooCat;uniform sampler2D tattooRightUpper;uniform float tattooStrength;uniform sampler2D shirtBackPrint;uniform float shirtBackPrintStrength;varying vec2 vTattooUv;varying float vTattooMask;varying float vArmRegion;varying vec3 vBodyPosition;varying vec2 vMiloUv;`+Ct+to).replace("#include <color_fragment>",`#include <color_fragment>
      float side=abs(vBodyPosition.x);
      float neckline=1.563-.020*(vBodyPosition.z+.009)/max(length(vec2(vBodyPosition.x,vBodyPosition.z+.009)),.001);
      if(vBodyPosition.y>neckline)discard;
      float sleeve=mix(1.0,smoothstep(1.293,1.297,vBodyPosition.y),smoothstep(.20,.50,vArmRegion));
      float shirt=(1.0-smoothstep(neckline-.001,neckline+.001,vBodyPosition.y))*sleeve;
      float collar=smoothstep(neckline-.014,neckline-.010,vBodyPosition.y)*shirt;
      float cuff=(1.0-smoothstep(1.303,1.310,vBodyPosition.y))*smoothstep(.5,.8,vArmRegion)*shirt;
      float trousers=(1.0-smoothstep(1.073,1.077,vBodyPosition.y))*(1.0-smoothstep(.2,.5,vArmRegion));
      vec3 weave=texture2D(trouserMap,vMiloUv*vec2(18.0,24.0)).rgb;
      float weaveTone=mix(.90,1.08,smoothstep(.08,.42,dot(weave,vec3(.3333))));
      float kneeWear=exp(-pow((vBodyPosition.y-.53)/.18,2.0));
      float thighWear=exp(-pow((vBodyPosition.y-.82)/.23,2.0));
      float ankleWear=exp(-pow((vBodyPosition.y-.22)/.14,2.0));
      float frontMask=smoothstep(.015,.095,vBodyPosition.z),backMask=smoothstep(.015,.095,-vBodyPosition.z);
      float backKneeZone=backMask*exp(-pow((vBodyPosition.y-.525)/.090,2.0));
      float waistZone=exp(-pow((vBodyPosition.y-1.005)/.055,2.0));
      float crotchZone=frontMask*exp(-pow((vBodyPosition.y-.865)/.115,2.0));
      float seatZone=backMask*smoothstep(.895,.915,vBodyPosition.y)*exp(-pow((vBodyPosition.y-.945)/.065,2.0));
      float longFold=sin(vBodyPosition.y*31.0+vBodyPosition.z*25.0+abs(vBodyPosition.x)*17.0);
      float diagonalFold=sin(vBodyPosition.y*53.0-vBodyPosition.z*37.0+vBodyPosition.x*29.0);
      float fineFold=sin(vBodyPosition.y*89.0+vBodyPosition.z*21.0-vBodyPosition.x*47.0);
      float foldField=.52*longFold+.31*diagonalFold+.17*fineFold;
      float crease=pow(smoothstep(.12,.72,foldField),3.0),ridge=pow(smoothstep(.28,.82,-foldField),4.0);
      float wrinkleZone=clamp(.78*kneeWear+.36*thighWear+.46*ankleWear,0.0,1.0);
      float backThighSmooth=backMask*smoothstep(.70,.78,vBodyPosition.y)*(1.0-smoothstep(.875,.925,vBodyPosition.y));
      wrinkleZone*=1.0-.92*backThighSmooth;
      vec2 backKneeFolds=miloKneeFolds(vBodyPosition);
      float backKneeCrease=backKneeFolds.x;
      float backKneeRidge=backKneeFolds.y;
      float waistFold=sin(vBodyPosition.x*67.0+vBodyPosition.z*36.0)+.45*sin(vBodyPosition.x*109.0-vBodyPosition.z*51.0);
      vec2 frontFolds=miloFrontFolds(vBodyPosition);
      float seatFold=sin((vBodyPosition.y-.84)*46.0+vBodyPosition.x*29.0-vBodyPosition.z*26.0);
      float jointCrease=backKneeZone*backKneeCrease+.62*waistZone*pow(smoothstep(.18,.90,waistFold),3.0)+.82*crotchZone*frontFolds.x+.16*seatZone*pow(smoothstep(.12,.76,seatFold),3.0);
      float jointRidge=backKneeZone*backKneeRidge+.55*waistZone*pow(smoothstep(.28,.96,-waistFold),3.0)+.72*crotchZone*frontFolds.y+.12*seatZone*pow(smoothstep(.22,.84,-seatFold),3.0);
      float foldShade=1.0+.022*longFold+.016*diagonalFold-.32*crease*wrinkleZone+.085*ridge*wrinkleZone-.39*jointCrease+.12*jointRidge;
      vec3 trouserSurface=trouserColor*weaveTone*foldShade;

      float belt=smoothstep(1.045,1.050,vBodyPosition.y)*(1.0-smoothstep(1.069,1.075,vBodyPosition.y))*trousers;
      float buckle=belt*frontMask*(1.0-smoothstep(.022,.028,abs(vBodyPosition.x)));
      float loopDistance=min(abs(abs(vBodyPosition.x)-.062),abs(abs(vBodyPosition.x)-.148));
      float beltLoop=frontMask*(1.0-smoothstep(.006,.010,loopDistance))*smoothstep(1.034,1.040,vBodyPosition.y)*(1.0-smoothstep(1.083,1.090,vBodyPosition.y));
      trouserSurface=mix(trouserSurface,vec3(.012,.016,.015),belt);
      trouserSurface=mix(trouserSurface,vec3(.075,.082,.076),buckle);
      trouserSurface=mix(trouserSurface,trouserColor*.60,beltLoop);

      float flyY=smoothstep(.850,.862,vBodyPosition.y)*(1.0-smoothstep(1.042,1.052,vBodyPosition.y));
      float flyCurve=mix(.006,-.021,smoothstep(.850,1.015,vBodyPosition.y));
      float flyStitch=(1.0-smoothstep(.0012,.0032,abs(vBodyPosition.x-flyCurve)))+(1.0-smoothstep(.0012,.0032,abs(vBodyPosition.x-flyCurve+.009)));
      float frontFly=clamp(flyStitch,0.0,1.0)*flyY*frontMask;
      float handPocketY=1.040-(side-.075)*.43;
      float handPocket=(1.0-smoothstep(.0015,.0040,abs(vBodyPosition.y-handPocketY)))*smoothstep(.075,.095,side)*(1.0-smoothstep(.158,.178,side))*frontMask;

      float cargoY=smoothstep(.620,.634,vBodyPosition.y)*(1.0-smoothstep(.825,.839,vBodyPosition.y));
      float cargoZ=smoothstep(-.105,-.088,vBodyPosition.z)*(1.0-smoothstep(.088,.105,vBodyPosition.z));
      float cargoOuter=smoothstep(.132,.153,side)*cargoY*cargoZ;
      float cargoInner=smoothstep(.132,.153,side)*smoothstep(.638,.651,vBodyPosition.y)*(1.0-smoothstep(.800,.813,vBodyPosition.y))*smoothstep(-.086,-.073,vBodyPosition.z)*(1.0-smoothstep(.073,.086,vBodyPosition.z));
      float cargoEdge=clamp(cargoOuter-cargoInner,0.0,1.0);
      float cargoFlap=smoothstep(.793,.804,vBodyPosition.y)*(1.0-smoothstep(.835,.844,vBodyPosition.y))*cargoZ*smoothstep(.132,.153,side);

      float rearX=1.0-smoothstep(.045,.057,abs(side-.100));
      float rearY=smoothstep(.900,.912,vBodyPosition.y)*(1.0-smoothstep(1.010,1.022,vBodyPosition.y));
      float rearPocket=rearX*rearY*backMask;
      float rearInner=(1.0-smoothstep(.037,.047,abs(side-.100)))*smoothstep(.915,.927,vBodyPosition.y)*(1.0-smoothstep(.985,.997,vBodyPosition.y))*backMask;
      float rearEdge=clamp(rearPocket-rearInner,0.0,1.0);
      float rearFlap=rearX*smoothstep(.987,.997,vBodyPosition.y)*(1.0-smoothstep(1.020,1.030,vBodyPosition.y))*backMask;
      float garmentLines=clamp(frontFly+handPocket+cargoEdge+cargoFlap+rearEdge+rearFlap,0.0,1.0);
      trouserSurface=mix(trouserSurface,trouserColor*.78,cargoOuter*.62+rearPocket*.55);
      trouserSurface=mix(trouserSurface,trouserColor*.42,garmentLines);
      // Reuse the fabric map as neutral, stretched yarns and fine knit grain.
      // The UVs follow the skin; mipmaps soften the heather at a distance.
      float yarnTone=dot(texture2D(trouserMap,vMiloUv*vec2(3.0,14.0)).rgb,vec3(.2126,.7152,.0722));
      float fiberTone=dot(weave,vec3(.2126,.7152,.0722));
      float heather=mix(.86,1.14,smoothstep(.02,.13,yarnTone))*mix(.96,1.04,smoothstep(.02,.13,fiberTone));
      vec3 shirtSurface=shirtColor*heather*(1.0-.09*max(collar,cuff));
      diffuseColor.rgb=mix(mix(diffuseColor.rgb,shirtSurface,shirt),trouserSurface,trousers);
      // Bind-space coordinates follow the same skin as the shirt, including bends.
      // Reverse X for a readable rear view; keep the complete supplied aspect ratio.
      vec2 backPrintUv=vec2(.5-vBodyPosition.x/.30,.5+(vBodyPosition.y-1.425)/(.30*1808.0/3538.0));
      float backPrintFrame=step(0.0,backPrintUv.x)*step(backPrintUv.x,1.0)*step(0.0,backPrintUv.y)*step(backPrintUv.y,1.0);
      float backPrintMask=backPrintFrame*smoothstep(.025,.065,-vBodyPosition.z)*(1.0-smoothstep(.05,.20,vArmRegion))*shirt*(1.0-trousers)*shirtBackPrintStrength;
      if(backPrintMask>.001){
        vec4 printInk=texture2D(shirtBackPrint,clamp(backPrintUv,0.0,1.0));
        diffuseColor.rgb=mix(diffuseColor.rgb,printInk.rgb,printInk.a*backPrintMask);
      }
      float tattooFrame=1.0-smoothstep(.98,1.0,max(abs(vTattooUv.x-.5),abs(vTattooUv.y-.5))*2.0);
      if(tattooFrame*vTattooMask*tattooStrength>0.001){
        vec2 uv=clamp(vTattooUv,0.0,1.0);
        // Preserve the complete source artwork. Transparent pixels (cosmos)
        // and white paper (cat) remain bare skin, including antialiased edges.
        vec4 artwork=vBodyPosition.x<0.0?texture2D(tattooCat,uv):texture2D(tattooAtom,uv);
        float pigment=min(artwork.r,min(artwork.g,artwork.b));
        // Render the cat's red source strokes with the same dark tattoo ink.
        vec3 inkColor=diffuseColor.rgb*vec3(.15,.19,.18);
        float ink=artwork.a*(1.0-smoothstep(.40,.96,pigment))*tattooFrame*vTattooMask*tattooStrength*(1.0-shirt)*(1.0-trousers);
        diffuseColor.rgb=mix(diffuseColor.rgb,inkColor,ink);
      }
      // Anatomical right is -X. Set the artwork 8 mm below the sleeve hem so
      // a little more shows while the upper portion stays masked by the shirt.
      vec2 upperTattooUv=vec2(.5+(vBodyPosition.z+.035)/.130,.5+(vBodyPosition.y-1.287)/(.130*182.0/388.0));
      float upperTattooFrame=1.0-smoothstep(.98,1.0,max(abs(upperTattooUv.x-.5),abs(upperTattooUv.y-.5))*2.0);
      float upperTattooMask=upperTattooFrame*smoothstep(.215,.240,-vBodyPosition.x)*smoothstep(.90,.98,vArmRegion)*(1.0-shirt)*(1.0-trousers)*tattooStrength;
      if(upperTattooMask>.001){
        vec4 artwork=texture2D(tattooRightUpper,clamp(upperTattooUv,0.0,1.0));
        float pigment=min(artwork.r,min(artwork.g,artwork.b));
        float ink=artwork.a*(1.0-smoothstep(.40,.96,pigment))*upperTattooMask;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.15,.19,.18),ink);
      }
      // Pigment below intact skin: no blood, cuts, displacement or wet gloss.
      diffuseColor.rgb=miloBruisedSkin(diffuseColor.rgb,vBruiseUv,vBruiseMask,
        bruiseStrength*(1.0-shirt)*(1.0-trousers));
    `).replace("#include <normal_fragment_maps>",`vec3 smoothBodyNormal=normal;
      #include <normal_fragment_maps>
      float trouserBumpMask=(1.0-smoothstep(1.065,1.085,vBodyPosition.y))*(1.0-smoothstep(.2,.5,vArmRegion));
      normal=normalize(mix(smoothBodyNormal,normal,trouserBumpMask));
    `).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,.96,shirt);
roughnessFactor=mix(roughnessFactor,.96,trousers);`)},z.customProgramCacheKey=()=>"milo-continuous-body-tshirt-trousers-tattoos-bruise-v28-upper-tattoo-visible";const D=new Ft(v,z);D.name="Continuous sample-based human body",D.castShadow=!0,D.receiveShadow=!0,D.frustumCulled=!1,B.add(D),D.raycast=function(t,s){this.userData.poseBoundsStale&&(this.boundingBox=null,this.boundingSphere=null,this.userData.poseBoundsStale=!1),Ft.prototype.raycast.call(this,t,s)},D.customDepthMaterial=new Et({depthPacking:Ht}),D.customDepthMaterial.onBeforeCompile=t=>{t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vBodyPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vBodyPosition=position;`),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vBodyPosition;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
      float neckline=1.563-.020*(vBodyPosition.z+.009)/max(length(vec2(vBodyPosition.x,vBodyPosition.z+.009)),.001);
      if(vBodyPosition.y>neckline)discard;
    `)},D.customDepthMaterial.customProgramCacheKey=()=>"milo-shirt-neckline-shadow-v1";const kt=v.attributes.skinIndex,wt=v.attributes.skinWeight;for(const{thumb:t,side:s}of l){const o=s<0?"L":"R",n=i.bones.findIndex(p=>p.name===o+"_thumb"),r=rt.length,g=new St;g.name=`Milo skin ${o}_thumbIP`,t.userData.ip.add(g),rt.push(g);const P=new $(...i.bones[n].target).add(t.userData.ip.position);P.y+=X,ht.push(new pt().makeTranslation(-P.x,-P.y,-P.z));for(let p=0;p<e.count;p++){const u=Array.from({length:4},(b,W)=>({id:kt.array[p*4+W],weight:wt.array[p*4+W]})),C=u.find(b=>b.id===n&&b.weight>0);if(!C)continue;const U=1-a(i.positions[p*3+1],.823,.838);if(U!==0){u.push({id:r,weight:C.weight*U}),C.weight*=1-U,u.sort((b,W)=>W.weight-b.weight);for(let b=0;b<4;b++)kt.array[p*4+b]=u[b].id,wt.array[p*4+b]=u[b].weight}}}D.bind(new Lt(rt,ht),new pt),D.normalizeSkinWeights();for(const t of x)t.visible=!1;return c.userData.updateWristTwists=()=>{for(const{driver:t,hand:s,side:o,fraction:n}of ut){t.position.copy(s.position),t.position.z*=n,t.scale.set(1,1,1).lerp(s.scale,n);const r=s.quaternion,g=new zt(0,r.y,0,r.w).normalize(),P=o*Math.PI/2,p=P+d.euclideanModulo(2*Math.atan2(g.y,g.w)-P+Math.PI,Math.PI*2)-Math.PI,u=r.clone().multiply(g.clone().invert());t.quaternion.identity().slerp(u,n).multiply(new zt().setFromAxisAngle(new $(0,1,0),p*n))}},c.userData.bodySkin=D,c.userData.bodySource=i.source,D}const mo=Object.freeze(Object.defineProperty({__proto__:null,attachMiloBody:io,invalidateMiloSkinBounds:ao,loadMiloBody:no,sampleMiloNeckline:Dt},Symbol.toStringTag,{value:"Module"}));export{io as a,ao as i,no as l,mo as m,co as u};
