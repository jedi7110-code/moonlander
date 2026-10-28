import{h as O,i as v,u as oe,y as N,j as G,a3 as X,d as R,c as le,R as pe,ax as me,S as de,f as he,V as te,b6 as Me,aF as be,aG as Se,r as Pe,B as ke,M as He,X as ze,aw as _e,az as Ae,bG as Ce}from"./three-CxW9jrRV.js";import{G as fe}from"./eva-wS50aKfd.js";import{a as Le}from"./BufferGeometryUtils-BkG5nKdK.js";import{t as Be}from"./triangle-subset-CmYhXjyt.js";import{g as ae,n as ie}from"./lighting-CxQJVJ1c.js";const W=new WeakMap;function De(m){if(W.has(m))return W.get(m);const o=new O(0,1.9,0),i=new R(m,new le({side:X})),a=new pe,l=96,z=48,b=[];for(let h=0;h<=z;h++)for(let g=0;g<l;g++){const f=h/z*2.12,r=g/l*Math.PI*2,y=new O(Math.sin(f)*Math.sin(r),Math.cos(f),Math.sin(f)*Math.cos(r));a.set(o.clone().addScaledVector(y,6),y.clone().negate());const d=a.intersectObject(i,!1)[0];b.push(d?d.point.distanceTo(o):1.7)}i.material.dispose();const k=h=>{const g=(Math.atan2(h.x,h.z)/(Math.PI*2)+1)%1*l,f=Math.min(z-1e-5,Math.acos(v.clamp(h.y,-1,1))/2.12*z),r=Math.floor(g),y=Math.floor(f),d=g-r,_=f-y,c=(x,H)=>b[H*l+x%l],u=v.lerp(v.lerp(c(r,y),c(r+1,y),d),v.lerp(c(r,y+1),c(r+1,y+1),d),_);return o.clone().addScaledVector(h,u)};return W.set(m,k),k}function Oe(m,o,i){const a=De(m),l=[],z=[],b=[],k=[];let h=71023;const g=()=>(h=Math.imul(h,1664525)+1013904223>>>0,h/4294967296),f=18,r=2,y=16e3;for(let u=0;u<y;u++){const x=1-g()*1.4,H=u*2.3999632297,s=new O(Math.sqrt(1-x*x)*Math.sin(H),x,Math.sqrt(1-x*x)*Math.cos(H)),S=a(s);if(S.y-i(S.x,S.z)<-.025)continue;const e=v.smoothstep(S.y,2.45,3.35);v.smoothstep(S.z,.3,1.4);const n=g(),t=g(),p=(.36+e*(o==="swept"?1.2:o==="fringe"?.78:.95))*(.85+n*.3),M=(.009+e*.014)*(.85+g()*.3),P=(.004+e*(o==="rough"?.035:.018))*(.85+n*.3),A=g()*6.28,B=l.length/3;for(let C=0;C<=f;C++){const D=C/f,T=new O(e*(o==="swept"?-1.2:o==="fringe"?-.22:-.8)+(1-e)*s.x*.18,e*.25-(1-e)*.6,o==="fringe"?e*.65-(1-e)*.6:o==="swept"?-.65:-1);T.x+=e*(o==="rough"?.18:.06)*Math.sin(A+D*2.5),T.addScaledVector(s,-T.dot(s)).normalize(),C&&s.addScaledVector(T,p/f/1.75).normalize();const L=a(s),F=new O().crossVectors(T,s).normalize(),I=v.smoothstep(L.y-i(L.x,L.z),-.03,.14),E=v.smoothstep(D,0,.1)*(1-.96*v.smoothstep(D,.8,1))*I,ye=v.smoothstep(L.y,2.65,3.5),xe=.5+.5*Math.sin(L.x*5+L.z*2.7+Math.sin(L.z*2.2)),we=.004+I*(ye*(.12+.075*xe)+P*Math.sin(Math.PI*D*.91));for(let $=0;$<=r;$++){const ne=$/r,q=ne*2-1,K=L.clone().addScaledVector(F,q*M*E).addScaledVector(s,we+(1-q*q)*M*.12);if(l.push(K.x,K.y,K.z),z.push(ne,D),b.push(t),C<f&&$<r){const V=B+C*(r+1)+$;k.push(V,V+r+1,V+1,V+1,V+r+1,V+r+2)}}}}const d=new oe;d.setAttribute("position",new N(l,3)),d.setAttribute("uv",new N(z,2)),d.setAttribute("lockSeed",new N(b,1)),d.setIndex(k),d.computeVertexNormals(),d.computeBoundingBox(),d.computeBoundingSphere();const _=new G({color:4798245,roughness:.68,metalness:0,side:X});_.onBeforeCompile=u=>{u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>
attribute float lockSeed; varying float vLockSeed; varying vec2 vLockUv;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vLockSeed=lockSeed;vLockUv=uv;`),u.fragmentShader=u.fragmentShader.replace("#include <common>",`#include <common>
      varying float vLockSeed; varying vec2 vLockUv;
      float fiberPhase(){return vLockUv.x*57.0+sin(vLockUv.y*5.0+vLockSeed*14.0)*.5;}
    `).replace("#include <color_fragment>",`#include <color_fragment>
      float phase=fiberPhase();
      float fine=.5+.5*sin(phase),secondary=.5+.5*sin(phase*2.17+vLockSeed*81.0);
      float strand=.42+.43*fine+.15*secondary;
      float root=mix(.85,1.0,smoothstep(0.0,.25,vLockUv.y));
      diffuseColor.rgb*=strand*root*(.91+.18*vLockSeed);
      float margin=min(vLockUv.x,1.0-vLockUv.x);
      if(margin<.014+.025*secondary || vLockUv.y>.94+.059*fine)discard;
    `).replace("#include <normal_fragment_begin>",`#include <normal_fragment_begin>
      vec3 dp1=dFdx(vViewPosition),dp2=dFdy(vViewPosition);
      vec2 du1=dFdx(vLockUv),du2=dFdy(vLockUv);
      vec3 across=dp1*du2.y-dp2*du1.y;
      float len=length(across);
      if(len>0.000001)normal=normalize(normal+across/len*sin(fiberPhase())*.08);
    `)},_.customProgramCacheKey=()=>"milo-groom-fibers-v1";const c=new R(d,_);return c.name=`Milo groom ${o}`,c.userData.style=o,c.castShadow=!0,c.receiveShadow=!0,c}function re(m,o){const i=1.2+v.smoothstep(o,-1.1,1.65)*1.54+v.smoothstep(Math.abs(m),.95,1.65)*.18-.14*Math.exp(-((m+.35)**2)*3)*v.smoothstep(o,1,1.7)+.018*Math.sin(m*19+o*7);return Math.max(i,2.22*v.smoothstep(Math.abs(m),1.2,1.6))}const Te=`
float hairline = 1.20 + smoothstep(-1.1, 1.65, vHeadPosition.z) * 1.54
  + smoothstep(0.95, 1.65, abs(vHeadPosition.x)) * 0.18
  - 0.14 * exp(-pow(vHeadPosition.x + 0.35, 2.0) * 3.0) * smoothstep(1.0, 1.7, vHeadPosition.z)
  + 0.018 * sin(vHeadPosition.x * 19.0 + vHeadPosition.z * 7.0);
hairline = max(hairline, 2.22 * smoothstep(1.2, 1.6, abs(vHeadPosition.x)));`,ue={reference:{label:"提供モデル",description:"提供OBJの毛束・頭皮・テクスチャを使用"},crop:{label:"A 現行・短髪",description:"今の短いクルーカット"},rough:{label:"B ラフクロップ",description:"不均一な束と立ち上がり。参照に最も近い"},fringe:{label:"C 乱れた前髪",description:"前方へ落ちる短い束を残す"},swept:{label:"D 流し気味",description:"片側へ流した少し整ったラフショート"}};function Fe(m,o,{top:i,edge:a,clump:l,front:z}){const b=v.smoothstep(o.y,2.78,3.48),k=1-a;if(m==="rough"){const h=.5+.5*Math.sin(o.x*17-o.z*11+Math.sin(o.y*9)*2.2),g=Math.max(0,Math.sin(o.x*11+o.z*7-o.y*3))**3;return{volume:.006+a*(.012+i*(.16+.11*l)),x:b*a*(l-.5)*.18,y:b*a*(.06+.22*g+.08*h),z:b*a*(z*.12-.045)}}if(m==="fringe"){const h=z*(1-v.smoothstep(o.y,2.9,3.55)),g=.55+.45*Math.sin(o.x*8.5+1.2);return{volume:.005+a*(.011+i*(.13+.09*l)+h*.1),x:-i*a*.03+o.x*h*k*.1,y:-h*(.15+.42*k)*g,z:h*(.34+.34*k)-i*a*.02}}return m==="swept"?{volume:.005+a*(.012+i*(.16+.07*l)),x:-b*a*(.4+.1*l),y:b*a*.07,z:b*a*.07}:{volume:.003+a*(.008+i*(.12+.09*l)),x:-i*a*.17,y:0,z:-i*a*.06}}function se(m,o="crop",{hairline:i=re}={}){if(ue[o]||(o="crop"),o!=="crop")return Oe(m,o,re);const a=m.index?m.toNonIndexed():m,l=a.attributes.position,z=a.attributes.normal,b=[],k=[],h=d=>d.y-Math.max(i(d.x,d.z)+.04,2.22+.08*Math.sin(d.x*4+d.z*3));for(let d=0;d<l.count;d+=3){const _=[];for(let c=0;c<3;c++){const u=d+c,x=d+(c+1)%3,H=new O().fromBufferAttribute(l,u),s=new O().fromBufferAttribute(l,x),S=new O().fromBufferAttribute(z,u),w=new O().fromBufferAttribute(z,x),e=h(H),n=h(s);if(e>=0&&_.push({p:H,n:S}),e>=0!=n>=0){const t=e/(e-n);_.push({p:H.clone().lerp(s,t),n:S.clone().lerp(w,t).normalize()})}}for(let c=1;c<_.length-1;c++)for(const{p:u,n:x}of[_[0],_[c],_[c+1]]){const H=v.smoothstep(u.y,2.25,3.5),s=v.smoothstep(h(u),0,.32),S=u.x*10+u.z*4+Math.sin(u.z*6)*.45,w=.5+.5*Math.sin(S),e=v.smoothstep(u.z,.55,1.75),n=Fe(o,u,{top:H,edge:s,clump:w,front:e}),t=u.clone().addScaledVector(x,n.volume);t.x+=n.x,t.y+=n.y,t.z+=n.z,b.push(t.x,t.y,t.z),k.push(v.smoothstep(h(u),0,.32))}}a!==m&&a.dispose();const g=new oe;g.setAttribute("position",new N(b,3)),g.setAttribute("hairCoverage",new N(k,1));const f=Le(g,1e-4);g.dispose(),f.computeVertexNormals(),f.computeBoundingBox(),f.computeBoundingSphere();const r=new G({color:2695451,roughness:.95,envMapIntensity:.12,transparent:!0,depthWrite:!1});r.onBeforeCompile=d=>{d.vertexShader=d.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vHair;
attribute float hairCoverage;
varying float vHairCoverage;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vHair = position;
vHairCoverage = hairCoverage;`),d.fragmentShader=d.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHair;
varying float vHairCoverage;`).replace("#include <color_fragment>",`#include <color_fragment>
      float strand = sin(vHair.x * 310.0 + vHair.z * 112.0 + sin(vHair.y * 22.0) * 4.0);
      float lock = sin(vHair.x * 9.0 + vHair.z * 2.8);
      float grain = fract(sin(dot(vHair, vec3(127.1,311.7,74.7))) * 43758.5453);
      diffuseColor.rgb *= 0.85 + 0.035 * strand + 0.035 * lock + grain * 0.12;
      diffuseColor.a *= vHairCoverage;
    `)},r.customProgramCacheKey=()=>`milo-textured-hair-${o}-v2`;const y=new R(f,r);return y.name=`Milo hair ${o}`,y.userData.style=o,y.castShadow=!0,y.receiveShadow=!0,y}async function Ee(m){const o=new me,[i,a,l,z,b,k]=await Promise.all([new fe().loadAsync(m+"supplied-hair.glb"),o.loadAsync(m+"hair-color-2k.webp"),o.loadAsync(m+"hair-opacity-2k.jpg"),o.loadAsync(m+"hair-normal-2k.webp"),o.loadAsync(m+"scalp-color.jpg"),o.loadAsync(m+"scalp-opacity.jpg")]);for(const f of[a,b])f.colorSpace=de;for(const f of[a,l,z,b,k])f.anisotropy=8;const h=f=>{const r=i.scene.getObjectByName(f);if(!r?.isMesh)throw new Error(`Supplied hair mesh is missing: ${f}`);return r.geometry},g=new he;g.name="Supplied Jacob hairstyle";for(const[f,r,y,d,_]of[[h("scalp"),b,k,null,"Supplied scalp"],[h("hair-cards"),a,l,z,"Supplied hair cards"]]){const c=new G({map:r,alphaMap:y,normalMap:d,normalScale:new te(.18,.18),roughness:.84,metalness:0,side:X,alphaTest:d?.22:.35,alphaToCoverage:!0});f.computeBoundingBox(),f.computeBoundingSphere();const u=new R(f,c);u.name=_,u.castShadow=!0,u.receiveShadow=!0,g.add(u)}return i.scene.traverse(f=>{f.material&&(Array.isArray(f.material)?f.material:[f.material]).forEach(r=>r.dispose())}),g}const J={none:{label:"なし",strength:0},light:{label:"薄い無精髭",strength:.42},rough:{label:"濃い無精髭",strength:1}};function U(m,o,i){const a=v.clamp((m-o)/(i-o),0,1);return 6*a*(1-a)/(i-o)}const Q=.025;function Ie(m,o=0){const i=ee(m,o);let a;do a=i.next();while(!a.done);return a.value}function*ee(m,o=0){const i=m.clone(),a=i.attributes.position,l=i.index.array,z=[];for(let e=0;e<l.length;e+=3)e%3072===0&&(yield),[l[e],l[e+1],l[e+2]].every(n=>a.getY(n)>=-1.05)&&z.push(l[e],l[e+1],l[e+2]);const b=.12,k=.38,h=i.attributes.normal;for(let e=0;e<a.count;e++){e%1024===0&&(yield);const n=a.getX(e),t=a.getY(e),p=a.getZ(e),M=1-v.smoothstep(t,-1.05,.85),P=1-v.smoothstep(p,.5,1.6),A=M*P;if(!A)continue;const B=1-b*A,C=1-k*A;a.setXYZ(e,n*B,t,p*C);const D=-U(t,-1.05,.85)*P,T=-M*U(p,.5,1.6),L=h.getX(e)/B,F=(h.getZ(e)+b*n*T*L)/(C-k*p*T),I=h.getY(e)+b*n*D*L+k*p*D*F,E=Math.hypot(L,I,F)||1;h.setXYZ(e,L/E,I/E,F/E)}const g=new Set,f=h.array.slice();for(let e=0;e<a.count;e++){e%1024===0&&(yield);const n=a.getX(e),t=a.getY(e),p=a.getZ(e),M=v.smoothstep(p,.05,.55)*(1-v.smoothstep(t,-.85,-.45)),P=.14+1.28*Math.sqrt(Math.max(0,1-(n/1.2)**2));M&&P>p&&(a.setZ(e,v.lerp(p,P,M)),g.add(e))}yield,i.computeVertexNormals(),yield;for(let e=0;e<h.count;e++)g.has(e)||h.setXYZ(e,...f.slice(e*3,e*3+3));i.setIndex(z);const r=i.toNonIndexed(),y=["position","normal","uv"],d=Object.fromEntries(y.map(e=>[e,Array.from(r.attributes[e].array)])),_=e=>Object.fromEntries(y.map(n=>{const t=i.attributes[n];return[n,Array.from(t.array.slice(e*t.itemSize,(e+1)*t.itemSize))]})),c=(e,n,t)=>Object.fromEntries(y.map(p=>[p,e[p].map((M,P)=>v.lerp(M,n[p][P],t))])),u=(...e)=>{for(const n of e)for(const t of y)d[t].push(...n[t])},x=-1.05,H=[];for(let e=0;e<l.length;e+=3){e%3072===0&&(yield);const n=[l[e],l[e+1],l[e+2]].map(_);if(n.every(p=>p.position[1]>=x)||n.every(p=>p.position[1]<x))continue;const t=[];for(let p=0;p<3;p++){const M=n[p],P=n[(p+1)%3],A=M.position[1]>=x,B=P.position[1]>=x;if(A&&t.push(M),A!==B){const C=c(M,P,(x-M.position[1])/(P.position[1]-M.position[1]));C.position[1]=x,t.push(C)}}for(let p=1;p<t.length-1;p++)u(t[0],t[p],t[p+1]);for(let p=0;p<t.length;p++){const M=t[p],P=t[(p+1)%t.length];M.position[1]===x&&P.position[1]===x&&H.push([M,P])}}const s=(e,n)=>{const t=Math.atan2(e.position[2],e.position[0]),p=v.smoothstep(n,0,1),M=x-.9*n,P=e.normal[0]*Math.cos(t)+e.normal[2]*Math.sin(t),A=v.clamp(.9*e.normal[1]/Math.max(.25,P),-.6,.6)*n*(1-n)*(1-n),B=v.lerp(e.position[0],Math.cos(t)*1.34,p)+Math.cos(t)*A,C=v.lerp(e.position[2],Math.sin(t)*(Math.sin(t)>0?1.42:1.22),p)+Math.sin(t)*A;return[B,M,C]},S=(e,n)=>{const t=Math.atan2(e.position[2],e.position[0]),p=c(e,e,0);p.position=s(e,n);const M=s(e,Math.max(0,n-.001)),P=s(e,Math.min(1,n+.001)),A=((P[0]-M[0])*Math.cos(t)+(P[2]-M[2])*Math.sin(t))/(M[1]-P[1]),B=new O(...e.normal).lerp(new O(Math.cos(t),A,Math.sin(t)).normalize(),v.smoothstep(n,0,.25)).normalize();return p.normal=B.toArray(),p};let w=0;for(const[e,n]of H){w++%16===0&&(yield);for(let t=0;t<16;t++){const p=S(e,t/16),M=S(n,t/16),P=S(e,(t+1)/16),A=S(n,(t+1)/16);u(M,p,P),u(M,P,A)}}yield;for(const e of y)r.setAttribute(e,new N(d[e],e==="uv"?2:3));if(o){const e=r.attributes.position,n=r.attributes.normal;for(let t=0;t<e.count;t++){t%1024===0&&(yield);const p=e.getY(t),M=e.getZ(t),P=v.smoothstep(M,.5,1.6),A=v.smoothstep(p,-1.25,.55),B=v.smoothstep(p,-1.25,-.55),C=v.lerp(A,B,P);e.setZ(t,e.getZ(t)+o*C);const D=v.lerp(U(p,-1.25,.55),U(p,-1.25,-.55),P),T=U(M,.5,1.6)*(B-A),L=n.getX(t),F=n.getZ(t)/(1+o*T),I=n.getY(t)-o*D*F,E=Math.hypot(L,I,F);n.setXYZ(t,L/E,I/E,F/E)}}return r.setAttribute("headRestPosition",r.attributes.position.clone()),i.dispose(),r.computeBoundingBox(),r.computeBoundingSphere(),r}const Z=[{x:-.73,y:1.69,halfWidth:.27,halfHeight:.086},{x:.51,y:1.69,halfWidth:.27,halfHeight:.086}],ce=Z.map(({x:m,y:o,halfWidth:i,halfHeight:a},l)=>`vec2 eyeOpening${l}=(vHeadPosition.xy-vec2(${m.toFixed(4)},${o.toFixed(4)}))/vec2(${i.toFixed(4)},${a.toFixed(4)});`).join(`
`)+`
if(vHeadPosition.z>1.4&&min(dot(eyeOpening0,eyeOpening0),dot(eyeOpening1,eyeOpening1))<1.0)discard;`;let j;function Re(){if(j)return j;const m=256,o=128,i=new Float32Array(m*o*4);for(let a=0;a<o;a++)for(let l=0;l<m;l++){const z=l/m,b=a/o,k=(r,y,d,_)=>Math.exp(-Math.pow((z-r)/d,8)-Math.pow((b-y)/_,8)),h=k(.68,.66,.036,.052)*5,g=k(.26,.58,.075,.018)*1.2,f=(a*m+l)*4;i[f]=.025+h+g*.75,i[f+1]=.03+h+g*.87,i[f+2]=.04+h+g,i[f+3]=1}return j=new ze(i,m,o,_e,Ae),j.mapping=Ce,j.needsUpdate=!0,j}function ve(m,{x:o,y:i,halfWidth:a,halfHeight:l}){const b=new ke(new O(o-a*1.03,i-l*1.03,-1/0),new O(o+a*1.03,i+l*1.03,1/0)),k=new le({side:X}),h=new R(Be(m,b),k),g=new pe(new O,new O(0,0,-1)),f=(w,e)=>{g.ray.origin.set(w,e,4);const n=g.intersectObject(h,!1)[0];if(!n)throw new Error("Milo eyelid surface is missing");return n.point.z},r=128,y=16,d=f(o,i)+.03,_=Array.from({length:r},(w,e)=>{const n=e/r*Math.PI*2;return f(o+a*Math.cos(n),i+l*Math.sin(n))}),c=[0,0,0,0,0];for(let w=0;w<r;w++){const e=w/r*Math.PI*2,n=_[w]/r;c[0]+=n,c[1]+=2*n*Math.cos(e),c[2]+=2*n*Math.sin(e),c[3]+=2*n*Math.cos(2*e),c[4]+=2*n*Math.sin(2*e)}const u=[o,i,d],x=[];for(let w=1;w<=y+1;w++){const e=w<=y?w/y:1.025;for(let n=0;n<r;n++){const t=n/r*Math.PI*2,p=o+a*e*Math.cos(t),M=i+l*e*Math.sin(t),P=d+e*(c[1]*Math.cos(t)+c[2]*Math.sin(t))+e*e*(c[0]-d+c[3]*Math.cos(2*t)+c[4]*Math.sin(2*t)),A=v.lerp(d,_[n],e*e),B=w<=y?v.lerp(P,A,v.smoothstep(e,.7,1)):f(p,M)-.004;u.push(p,M,B);const C=1+(w-1)*r+n,D=1+(w-1)*r+(n+1)%r;if(w===1)x.push(0,C,D);else{const T=C-r,L=D-r;x.push(T,C,D,T,D,L)}}}k.dispose(),h.geometry.dispose();const H=new oe;H.setAttribute("position",new N(u,3)),H.setIndex(x),H.computeVertexNormals(),H.computeBoundingBox(),H.computeBoundingSphere();const s=new He({color:16777215,roughness:.24,metalness:0,clearcoat:1,clearcoatRoughness:.055,envMap:Re(),envMapIntensity:.65});s.onBeforeCompile=w=>{w.uniforms.eyeCenter={value:new te(o,i)},w.vertexShader=w.vertexShader.replace("#include <common>",`#include <common>
uniform vec2 eyeCenter; varying vec2 vEyeOffset;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vEyeOffset=position.xy-eyeCenter;`),w.fragmentShader=w.fragmentShader.replace("#include <common>",`#include <common>
      varying vec2 vEyeOffset;
      float eyeHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float eyeNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(eyeHash(i),eyeHash(i+vec2(1,0)),f.x),mix(eyeHash(i+vec2(0,1)),eyeHash(i+vec2(1,1)),f.x),f.y);}
    `).replace("#include <color_fragment>",`#include <color_fragment>
      vec2 ep=vEyeOffset-vec2(0.0,.008);
      float radius=length(ep),angle=atan(ep.y,ep.x),r=radius/.138;
      float iris=1.0-smoothstep(.134,.141,radius);
      float radialNoise=eyeNoise(vec2(cos(angle),sin(angle))*44.0+vec2(r*2.0));
      float fibers=pow(.5+.5*sin(angle*113.0+radialNoise*5.0+r*13.0),2.0);
      float fine=.5+.5*sin(angle*317.0+radialNoise*9.0-r*21.0);
      float crypt=eyeNoise(vec2(cos(angle),sin(angle))*24.0+vec2(r*11.0));
      float ring=.47+.035*sin(angle*19.0)+.025*radialNoise;
      float collarette=exp(-pow((r-ring)/.047,2.0));
      vec3 irisTone=mix(vec3(.018,.040,.037),vec3(.12,.18,.115),fibers*.65+fine*.20);
      irisTone*=.65+.55*crypt;
      irisTone=mix(irisTone,vec3(.17,.12,.045),collarette*.48);
      irisTone*=1.0-.65*smoothstep(.85,1.02,r);
      irisTone*=.70+.30*smoothstep(.34,.53,r);
      float pupil=1.0-smoothstep(.047,.051,radius+.0006*sin(angle*37.0));
      vec2 lid=vEyeOffset/vec2(${a.toFixed(5)},${l.toFixed(5)});
      float rim=smoothstep(.48,1.02,length(lid));
      float corner=smoothstep(.55,1.0,abs(lid.x));
      vec3 sclera=mix(vec3(.58,.56,.51),vec3(.39,.22,.19),corner*.55);
      float vessel=pow(.5+.5*sin(ep.x*210.0+sin(ep.y*190.0)*2.5),24.0)*corner;
      sclera=mix(sclera,vec3(.30,.10,.08),vessel*.10);
      diffuseColor.rgb=mix(sclera,irisTone,iris);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.001,.0015,.002),pupil);
      float lidShade=(1.0-rim*.60)*(1.0-.40*smoothstep(.1,.95,lid.y));
      diffuseColor.rgb*=lidShade;
      // A narrow warm waterline seats the globe inside the eyelids; avoid the
      // hard black/white cut-out edge of the original eye replacement.
      float waterline=smoothstep(.87,1.015,length(lid));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.074,.052),waterline*.75);
    `).replace("#include <clearcoat_normal_fragment_begin>",`#include <clearcoat_normal_fragment_begin>
      // The wet cornea has a smooth optical surface independent of the scan's
      // small bumps. Tangents keep its reflection responsive to camera motion.
      vec3 eyeDx=dFdx(vViewPosition),eyeDy=dFdy(vViewPosition);
      vec2 uvDx=dFdx(vEyeOffset),uvDy=dFdy(vEyeOffset);
      vec3 eyeT=normalize(eyeDx*uvDy.y-eyeDy*uvDx.y);
      vec3 eyeB=normalize(-eyeDx*uvDy.x+eyeDy*uvDx.x);
      vec2 corneaSlope=ep*2.4;
      clearcoatNormal=normalize(nonPerturbedNormal-eyeT*corneaSlope.x-eyeB*corneaSlope.y);
    `)},s.customProgramCacheKey=()=>"milo-fitted-eye-v3-fibers";const S=new R(H,s);return S.name="Fitted Milo eye surface",S.receiveShadow=!0,S}const Y={width:1.5,height:.3,centerY:-.7},ge=`
  vec2 napeUv=vec2(.5-vHeadPosition.x/${Y.width.toFixed(4)},.5+(vHeadPosition.y-(${Y.centerY.toFixed(4)}))/${Y.height.toFixed(4)});
  float napeFrame=1.0-smoothstep(.96,1.0,max(abs(napeUv.x-.5),abs(napeUv.y-.5))*2.0);
  float napeRear=1.0-smoothstep(-.6,-.35,vHeadPosition.z);
  if(napeFrame*napeRear>0.001){
    vec4 mark=texture2D(napeTattoo,vec2(.19,.32)+clamp(napeUv,0.0,1.0)*vec2(.62,.36));
    float pigment=min(mark.r,min(mark.g,mark.b));
    float red=clamp((mark.r-max(mark.g,mark.b))*2.5,0.0,1.0);
    vec3 inkColor=diffuseColor.rgb*mix(vec3(.15,.19,.18),vec3(.80,.055,.035),red);
    float ink=mark.a*(1.0-smoothstep(.40,.96,pigment))*napeFrame*napeRear*.88;
    diffuseColor.rgb=mix(diffuseColor.rgb,inkColor,ink);
  }
`;async function Ne(m="/3D/assets/obs/head/",{onProgress:o=()=>{}}={}){const i=new me,[a,l,z,b,k]=await Promise.all([new fe().loadAsync(m+"LeePerrySmith.glb"),i.loadAsync(m+"Map-COL.jpg"),i.loadAsync(m+"Infinite-Level_02_Tangent_SmoothUV.jpg"),i.loadAsync(m+"tattoo-naval-barcode.webp"),Ee(m+"supplied-hair/")]);o(.15),b.colorSpace=Me,b.anisotropy=4,l.colorSpace=de,l.anisotropy=4,z.anisotropy=4;const h=new G({color:13813949,map:l,normalMap:z,normalScale:new te(.45,.45),roughness:.74,metalness:0,envMapIntensity:.3}),g={value:0},f={value:1},r={value:1};h.onBeforeCompile=s=>{s.uniforms.mouthMotion=g,s.uniforms.facialHairStrength=f,s.uniforms.proceduralHair=r,s.uniforms.napeTattoo={value:b},s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
attribute vec3 headRestPosition;
varying vec3 vHeadPosition;
uniform float mouthMotion;`).replace("#include <begin_vertex>",`#include <begin_vertex>
      vHeadPosition = headRestPosition;
      float lipLine = 0.45 - pow(abs(headRestPosition.x + 0.11), 2.0) * 0.20;
      float jaw = (1.0 - smoothstep(lipLine - 0.025, lipLine + 0.025, headRestPosition.y))
        * smoothstep(-0.9, -0.2, headRestPosition.y) * smoothstep(1.6, 2.1, headRestPosition.z)
        * (1.0 - smoothstep(0.55, 0.95, abs(headRestPosition.x + 0.11)));
      transformed.y -= mouthMotion * 0.20 * jaw;
    `),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHeadPosition;
uniform sampler2D napeTattoo;
uniform float facialHairStrength;
uniform float proceduralHair;`).replace("#include <color_fragment>",`#include <color_fragment>
      ${ce}
      ${Te}
      float hairMask = smoothstep(hairline - 0.16, hairline + 0.10, vHeadPosition.y);
      hairMask *= mix(0.30, 1.0, smoothstep(hairline, max(hairline + 0.25, 2.55), vHeadPosition.y));
      hairMask *= proceduralHair;
      float grain = fract(sin(dot(vHeadPosition, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float cheekLine = 0.53 + smoothstep(0.35, 1.45, abs(vHeadPosition.x)) * 0.54;
      float beard = (1.0 - smoothstep(cheekLine - 0.15, cheekLine + 0.13, vHeadPosition.y))
        * smoothstep(-0.85, -0.43, vHeadPosition.y) * smoothstep(0.45, 1.2, vHeadPosition.z);
      float moustache = smoothstep(0.50, 0.64, vHeadPosition.y) * (1.0 - smoothstep(0.88, 1.02, vHeadPosition.y))
        * (1.0 - smoothstep(0.38, 0.69, abs(vHeadPosition.x + 0.11))) * smoothstep(1.8, 2.15, vHeadPosition.z);
      float lips = exp(-pow((vHeadPosition.y - 0.44) / 0.13, 2.0))
        * (1.0 - smoothstep(0.35, 0.60, abs(vHeadPosition.x + 0.11))) * smoothstep(1.8, 2.1, vHeadPosition.z);
      float facialHair = max(beard * (1.0 - lips), moustache);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.033, 0.026, 0.020), clamp(facialHair * facialHairStrength * (0.42 + grain * 0.22), 0.0, 1.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.022, 0.018, 0.015) * (0.75 + grain * 0.45), hairMask);
      ${ge}
    `)},h.customProgramCacheKey=()=>"obs-milo-scan-v10-anchored-neck";const y=a.scene.getObjectByName("LeePerrySmith");if(!y?.isMesh)throw new Error("Milo head mesh is missing");const d=Q/.055,_=await ae(ee(y.geometry));o(.4);const c=new he,u=new R(await ae(ee(y.geometry,d)),h);o(.6),u.name="Milo scanned head",u.castShadow=!0,u.receiveShadow=!0,c.add(u),c.scale.setScalar(.055),c.userData.faceForward=Q,u.customDepthMaterial=new be({depthPacking:Se}),u.customDepthMaterial.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
attribute vec3 headRestPosition;
varying vec3 vHeadPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vHeadPosition=headRestPosition;`),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHeadPosition;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
      ${ce}
    `)},u.customDepthMaterial.customProgramCacheKey=()=>"milo-open-eyelid-shadow-v3-anchored-neck",await ie();let x=se(_);x.position.z=d,c.add(x),o(.7);const H=new R(new Pe(1,24,12),new G({color:2429967,roughness:1}));H.position.set(-.11,.405,2.285+d),H.visible=!1,c.add(H),c.userData.setMouthMotion=(s,S)=>{g.value=s+S*.28,H.visible=s>.04,H.scale.set(.43,.075*s,.025)},c.userData.appearance={hair:"crop",beard:"rough"},c.userData.setAppearance=({hair:s=c.userData.appearance.hair,beard:S=c.userData.appearance.beard}={})=>{ue[s]||(s="crop"),J[S]||(S="rough"),s!==c.userData.appearance.hair&&(c.remove(x),x!==k&&x.traverse(w=>{w.geometry?.dispose(),w.material?.dispose()}),x=s==="reference"?k:se(_,s),x.position.z=d,c.add(x)),r.value=s==="reference"?0:1,f.value=J[S].strength,c.userData.appearance={hair:s,beard:S}};for(const[s,S]of Z.entries()){await ie();const w=ve(y.geometry,S);w.position.z=d,c.add(w),o(.7+.3*(s+1)/Z.length)}return a.scene.traverse(s=>{s.geometry?.dispose(),s.material&&(Array.isArray(s.material)?s.material:[s.material]).forEach(S=>S.dispose())}),c}const Ye=Object.freeze(Object.defineProperty({__proto__:null,MILO_BEARD_STYLES:J,MILO_EYE_OPENINGS:Z,MILO_HEAD_FORWARD:Q,MILO_NAPE_TATTOO:Y,NAPE_TATTOO_GLSL:ge,createMiloEye:ve,headGeometry:Ie,loadMiloHead:Ne},Symbol.toStringTag,{value:"Module"}));export{Te as H,se as c,Ye as h,Ne as l};
