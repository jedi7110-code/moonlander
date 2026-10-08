import{V as O,g as v,i as Q,F as N,M as U,m as G,c as F,e as ie,s as se,aN as ce,S as le,G as pe,K as ee,a1 as xe,af as Me,be as we,ar as be,as as Se,k as Pe,x as ke,aa as He,aB as ze,bf as _e}from"./three-QTzUF3zZ.js";import{G as me}from"./cabin-toon-DWmeeE1h.js";import{a as Ae}from"./BufferGeometryUtils-DNfABVdX.js";import{t as Ce}from"./triangle-subset-CKQ6pqBA.js";const q=new WeakMap;function Le(p){if(q.has(p))return q.get(p);const n=new O(0,1.9,0),c=new F(p,new ie({side:G})),r=new se,l=96,H=48,P=[];for(let d=0;d<=H;d++)for(let g=0;g<l;g++){const m=d/H*2.12,i=g/l*Math.PI*2,x=new O(Math.sin(m)*Math.sin(i),Math.cos(m),Math.sin(m)*Math.cos(i));r.set(n.clone().addScaledVector(x,6),x.clone().negate());const h=r.intersectObject(c,!1)[0];P.push(h?h.point.distanceTo(n):1.7)}c.material.dispose();const k=d=>{const g=(Math.atan2(d.x,d.z)/(Math.PI*2)+1)%1*l,m=Math.min(H-1e-5,Math.acos(v.clamp(d.y,-1,1))/2.12*H),i=Math.floor(g),x=Math.floor(m),h=g-i,y=m-x,u=(b,s)=>P[s*l+b%l],f=v.lerp(v.lerp(u(i,x),u(i+1,x),h),v.lerp(u(i,x+1),u(i+1,x+1),h),y);return n.clone().addScaledVector(d,f)};return q.set(p,k),k}function Be(p,n,c){const r=Le(p),l=[],H=[],P=[],k=[];let d=71023;const g=()=>(d=Math.imul(d,1664525)+1013904223>>>0,d/4294967296),m=18,i=2,x=16e3;for(let f=0;f<x;f++){const b=1-g()*1.4,s=f*2.3999632297,M=new O(Math.sqrt(1-b*b)*Math.sin(s),b,Math.sqrt(1-b*b)*Math.cos(s)),z=r(M);if(z.y-c(z.x,z.z)<-.025)continue;const t=v.smoothstep(z.y,2.45,3.35);v.smoothstep(z.z,.3,1.4);const o=g(),a=g(),w=(.36+t*(n==="swept"?1.2:n==="fringe"?.78:.95))*(.85+o*.3),S=(.009+t*.014)*(.85+g()*.3),_=(.004+t*(n==="rough"?.035:.018))*(.85+o*.3),L=g()*6.28,T=l.length/3;for(let B=0;B<=m;B++){const D=B/m,C=new O(t*(n==="swept"?-1.2:n==="fringe"?-.22:-.8)+(1-t)*M.x*.18,t*.25-(1-t)*.6,n==="fringe"?t*.65-(1-t)*.6:n==="swept"?-.65:-1);C.x+=t*(n==="rough"?.18:.06)*Math.sin(L+D*2.5),C.addScaledVector(M,-C.dot(M)).normalize(),B&&M.addScaledVector(C,w/m/1.75).normalize();const A=r(M),I=new O().crossVectors(C,M).normalize(),E=v.smoothstep(A.y-c(A.x,A.z),-.03,.14),fe=v.smoothstep(D,0,.1)*(1-.96*v.smoothstep(D,.8,1))*E,ve=v.smoothstep(A.y,2.65,3.5),ge=.5+.5*Math.sin(A.x*5+A.z*2.7+Math.sin(A.z*2.2)),ye=.004+E*(ve*(.12+.075*ge)+_*Math.sin(Math.PI*D*.91));for(let j=0;j<=i;j++){const te=j/i,Z=te*2-1,X=A.clone().addScaledVector(I,Z*S*fe).addScaledVector(M,ye+(1-Z*Z)*S*.12);if(l.push(X.x,X.y,X.z),H.push(te,D),P.push(a),B<m&&j<i){const R=T+B*(i+1)+j;k.push(R,R+i+1,R+1,R+1,R+i+1,R+i+2)}}}}const h=new Q;h.setAttribute("position",new N(l,3)),h.setAttribute("uv",new N(H,2)),h.setAttribute("lockSeed",new N(P,1)),h.setIndex(k),h.computeVertexNormals(),h.computeBoundingBox(),h.computeBoundingSphere();const y=new U({color:4798245,roughness:.68,metalness:0,side:G});y.onBeforeCompile=f=>{f.vertexShader=f.vertexShader.replace("#include <common>",`#include <common>
attribute float lockSeed; varying float vLockSeed; varying vec2 vLockUv;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vLockSeed=lockSeed;vLockUv=uv;`),f.fragmentShader=f.fragmentShader.replace("#include <common>",`#include <common>
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
    `)},y.customProgramCacheKey=()=>"milo-groom-fibers-v1";const u=new F(h,y);return u.name=`Milo groom ${n}`,u.userData.style=n,u.castShadow=!0,u.receiveShadow=!0,u}function ne(p,n){const c=1.2+v.smoothstep(n,-1.1,1.65)*1.54+v.smoothstep(Math.abs(p),.95,1.65)*.18-.14*Math.exp(-((p+.35)**2)*3)*v.smoothstep(n,1,1.7)+.018*Math.sin(p*19+n*7);return Math.max(c,2.22*v.smoothstep(Math.abs(p),1.2,1.6))}const De=`
float hairline = 1.20 + smoothstep(-1.1, 1.65, vHeadPosition.z) * 1.54
  + smoothstep(0.95, 1.65, abs(vHeadPosition.x)) * 0.18
  - 0.14 * exp(-pow(vHeadPosition.x + 0.35, 2.0) * 3.0) * smoothstep(1.0, 1.7, vHeadPosition.z)
  + 0.018 * sin(vHeadPosition.x * 19.0 + vHeadPosition.z * 7.0);
hairline = max(hairline, 2.22 * smoothstep(1.2, 1.6, abs(vHeadPosition.x)));`,he={reference:{label:"提供モデル",description:"提供OBJの毛束・頭皮・テクスチャを使用"},crop:{label:"A 現行・短髪",description:"今の短いクルーカット"},rough:{label:"B ラフクロップ",description:"不均一な束と立ち上がり。参照に最も近い"},fringe:{label:"C 乱れた前髪",description:"前方へ落ちる短い束を残す"},swept:{label:"D 流し気味",description:"片側へ流した少し整ったラフショート"}};function Oe(p,n,{top:c,edge:r,clump:l,front:H}){const P=v.smoothstep(n.y,2.78,3.48),k=1-r;if(p==="rough"){const d=.5+.5*Math.sin(n.x*17-n.z*11+Math.sin(n.y*9)*2.2),g=Math.max(0,Math.sin(n.x*11+n.z*7-n.y*3))**3;return{volume:.006+r*(.012+c*(.16+.11*l)),x:P*r*(l-.5)*.18,y:P*r*(.06+.22*g+.08*d),z:P*r*(H*.12-.045)}}if(p==="fringe"){const d=H*(1-v.smoothstep(n.y,2.9,3.55)),g=.55+.45*Math.sin(n.x*8.5+1.2);return{volume:.005+r*(.011+c*(.13+.09*l)+d*.1),x:-c*r*.03+n.x*d*k*.1,y:-d*(.15+.42*k)*g,z:d*(.34+.34*k)-c*r*.02}}return p==="swept"?{volume:.005+r*(.012+c*(.16+.07*l)),x:-P*r*(.4+.1*l),y:P*r*.07,z:P*r*.07}:{volume:.003+r*(.008+c*(.12+.09*l)),x:-c*r*.17,y:0,z:-c*r*.06}}function ae(p,n="crop",{hairline:c=ne}={}){if(he[n]||(n="crop"),n!=="crop")return Be(p,n,ne);const r=p.index?p.toNonIndexed():p,l=r.attributes.position,H=r.attributes.normal,P=[],k=[],d=h=>h.y-Math.max(c(h.x,h.z)+.04,2.22+.08*Math.sin(h.x*4+h.z*3));for(let h=0;h<l.count;h+=3){const y=[];for(let u=0;u<3;u++){const f=h+u,b=h+(u+1)%3,s=new O().fromBufferAttribute(l,f),M=new O().fromBufferAttribute(l,b),z=new O().fromBufferAttribute(H,f),e=new O().fromBufferAttribute(H,b),t=d(s),o=d(M);if(t>=0&&y.push({p:s,n:z}),t>=0!=o>=0){const a=t/(t-o);y.push({p:s.clone().lerp(M,a),n:z.clone().lerp(e,a).normalize()})}}for(let u=1;u<y.length-1;u++)for(const{p:f,n:b}of[y[0],y[u],y[u+1]]){const s=v.smoothstep(f.y,2.25,3.5),M=v.smoothstep(d(f),0,.32),z=f.x*10+f.z*4+Math.sin(f.z*6)*.45,e=.5+.5*Math.sin(z),t=v.smoothstep(f.z,.55,1.75),o=Oe(n,f,{top:s,edge:M,clump:e,front:t}),a=f.clone().addScaledVector(b,o.volume);a.x+=o.x,a.y+=o.y,a.z+=o.z,P.push(a.x,a.y,a.z),k.push(v.smoothstep(d(f),0,.32))}}r!==p&&r.dispose();const g=new Q;g.setAttribute("position",new N(P,3)),g.setAttribute("hairCoverage",new N(k,1));const m=Ae(g,1e-4);g.dispose(),m.computeVertexNormals(),m.computeBoundingBox(),m.computeBoundingSphere();const i=new U({color:2695451,roughness:.95,envMapIntensity:.12,transparent:!0,depthWrite:!1});i.onBeforeCompile=h=>{h.vertexShader=h.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vHair;
attribute float hairCoverage;
varying float vHairCoverage;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vHair = position;
vHairCoverage = hairCoverage;`),h.fragmentShader=h.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHair;
varying float vHairCoverage;`).replace("#include <color_fragment>",`#include <color_fragment>
      float strand = sin(vHair.x * 310.0 + vHair.z * 112.0 + sin(vHair.y * 22.0) * 4.0);
      float lock = sin(vHair.x * 9.0 + vHair.z * 2.8);
      float grain = fract(sin(dot(vHair, vec3(127.1,311.7,74.7))) * 43758.5453);
      diffuseColor.rgb *= 0.85 + 0.035 * strand + 0.035 * lock + grain * 0.12;
      diffuseColor.a *= vHairCoverage;
    `)},i.customProgramCacheKey=()=>`milo-textured-hair-${n}-v2`;const x=new F(m,i);return x.name=`Milo hair ${n}`,x.userData.style=n,x.castShadow=!0,x.receiveShadow=!0,x}async function Te(p){const n=new ce,[c,r,l,H,P,k]=await Promise.all([new me().loadAsync(p+"supplied-hair.glb"),n.loadAsync(p+"hair-color-2k.webp"),n.loadAsync(p+"hair-opacity-2k.jpg"),n.loadAsync(p+"hair-normal-2k.webp"),n.loadAsync(p+"scalp-color.jpg"),n.loadAsync(p+"scalp-opacity.jpg")]);for(const m of[r,P])m.colorSpace=le;for(const m of[r,l,H,P,k])m.anisotropy=8;const d=m=>{const i=c.scene.getObjectByName(m);if(!i?.isMesh)throw new Error(`Supplied hair mesh is missing: ${m}`);return i.geometry},g=new pe;g.name="Supplied Jacob hairstyle";for(const[m,i,x,h,y]of[[d("scalp"),P,k,null,"Supplied scalp"],[d("hair-cards"),r,l,H,"Supplied hair cards"]]){const u=new U({map:i,alphaMap:x,normalMap:h,normalScale:new ee(.18,.18),roughness:.84,metalness:0,side:G,alphaTest:h?.22:.35,alphaToCoverage:!0});m.computeBoundingBox(),m.computeBoundingSphere();const f=new F(m,u);f.name=y,f.castShadow=!0,f.receiveShadow=!0,g.add(f)}return c.scene.traverse(m=>{m.material&&(Array.isArray(m.material)?m.material:[m.material]).forEach(i=>i.dispose())}),g}const K={none:{label:"なし",strength:0},light:{label:"薄い無精髭",strength:.42},rough:{label:"濃い無精髭",strength:1}};function $(p,n,c){const r=v.clamp((p-n)/(c-n),0,1);return 6*r*(1-r)/(c-n)}const W=.025;function J(p,n=0){const c=p.clone(),r=c.attributes.position,l=c.index.array,H=[];for(let e=0;e<l.length;e+=3)[l[e],l[e+1],l[e+2]].every(t=>r.getY(t)>=-1.05)&&H.push(l[e],l[e+1],l[e+2]);const P=.12,k=.38,d=c.attributes.normal;for(let e=0;e<r.count;e++){const t=r.getX(e),o=r.getY(e),a=r.getZ(e),w=1-v.smoothstep(o,-1.05,.85),S=1-v.smoothstep(a,.5,1.6),_=w*S;if(!_)continue;const L=1-P*_,T=1-k*_;r.setXYZ(e,t*L,o,a*T);const B=-$(o,-1.05,.85)*S,D=-w*$(a,.5,1.6),C=d.getX(e)/L,A=(d.getZ(e)+P*t*D*C)/(T-k*a*D),I=d.getY(e)+P*t*B*C+k*a*B*A,E=Math.hypot(C,I,A)||1;d.setXYZ(e,C/E,I/E,A/E)}const g=new Set,m=d.array.slice();for(let e=0;e<r.count;e++){const t=r.getX(e),o=r.getY(e),a=r.getZ(e),w=v.smoothstep(a,.05,.55)*(1-v.smoothstep(o,-.85,-.45)),S=.14+1.28*Math.sqrt(Math.max(0,1-(t/1.2)**2));w&&S>a&&(r.setZ(e,v.lerp(a,S,w)),g.add(e))}c.computeVertexNormals();for(let e=0;e<d.count;e++)g.has(e)||d.setXYZ(e,...m.slice(e*3,e*3+3));c.setIndex(H);const i=c.toNonIndexed(),x=["position","normal","uv"],h=Object.fromEntries(x.map(e=>[e,Array.from(i.attributes[e].array)])),y=e=>Object.fromEntries(x.map(t=>{const o=c.attributes[t];return[t,Array.from(o.array.slice(e*o.itemSize,(e+1)*o.itemSize))]})),u=(e,t,o)=>Object.fromEntries(x.map(a=>[a,e[a].map((w,S)=>v.lerp(w,t[a][S],o))])),f=(...e)=>{for(const t of e)for(const o of x)h[o].push(...t[o])},b=-1.05,s=[];for(let e=0;e<l.length;e+=3){const t=[l[e],l[e+1],l[e+2]].map(y);if(t.every(a=>a.position[1]>=b)||t.every(a=>a.position[1]<b))continue;const o=[];for(let a=0;a<3;a++){const w=t[a],S=t[(a+1)%3],_=w.position[1]>=b,L=S.position[1]>=b;if(_&&o.push(w),_!==L){const T=u(w,S,(b-w.position[1])/(S.position[1]-w.position[1]));T.position[1]=b,o.push(T)}}for(let a=1;a<o.length-1;a++)f(o[0],o[a],o[a+1]);for(let a=0;a<o.length;a++){const w=o[a],S=o[(a+1)%o.length];w.position[1]===b&&S.position[1]===b&&s.push([w,S])}}const M=(e,t)=>{const o=Math.atan2(e.position[2],e.position[0]),a=v.smoothstep(t,0,1),w=b-.9*t,S=e.normal[0]*Math.cos(o)+e.normal[2]*Math.sin(o),_=v.clamp(.9*e.normal[1]/Math.max(.25,S),-.6,.6)*t*(1-t)*(1-t),L=v.lerp(e.position[0],Math.cos(o)*1.34,a)+Math.cos(o)*_,T=v.lerp(e.position[2],Math.sin(o)*(Math.sin(o)>0?1.42:1.22),a)+Math.sin(o)*_;return[L,w,T]},z=(e,t)=>{const o=Math.atan2(e.position[2],e.position[0]),a=u(e,e,0);a.position=M(e,t);const w=M(e,Math.max(0,t-.001)),S=M(e,Math.min(1,t+.001)),_=((S[0]-w[0])*Math.cos(o)+(S[2]-w[2])*Math.sin(o))/(w[1]-S[1]),L=new O(...e.normal).lerp(new O(Math.cos(o),_,Math.sin(o)).normalize(),v.smoothstep(t,0,.25)).normalize();return a.normal=L.toArray(),a};for(const[e,t]of s)for(let o=0;o<16;o++){const a=z(e,o/16),w=z(t,o/16),S=z(e,(o+1)/16),_=z(t,(o+1)/16);f(w,a,S),f(w,S,_)}for(const e of x)i.setAttribute(e,new N(h[e],e==="uv"?2:3));if(n){const e=i.attributes.position,t=i.attributes.normal;for(let o=0;o<e.count;o++){const a=e.getY(o),w=e.getZ(o),S=v.smoothstep(w,.5,1.6),_=v.smoothstep(a,-1.25,.55),L=v.smoothstep(a,-1.25,-.55),T=v.lerp(_,L,S);e.setZ(o,e.getZ(o)+n*T);const B=v.lerp($(a,-1.25,.55),$(a,-1.25,-.55),S),D=$(w,.5,1.6)*(L-_),C=t.getX(o),A=t.getZ(o)/(1+n*D),I=t.getY(o)-n*B*A,E=Math.hypot(C,I,A);t.setXYZ(o,C/E,I/E,A/E)}}return i.setAttribute("headRestPosition",i.attributes.position.clone()),c.dispose(),i.computeBoundingBox(),i.computeBoundingSphere(),i}const oe=[{x:-.73,y:1.69,halfWidth:.27,halfHeight:.086},{x:.51,y:1.69,halfWidth:.27,halfHeight:.086}],re=oe.map(({x:p,y:n,halfWidth:c,halfHeight:r},l)=>`vec2 eyeOpening${l}=(vHeadPosition.xy-vec2(${p.toFixed(4)},${n.toFixed(4)}))/vec2(${c.toFixed(4)},${r.toFixed(4)});`).join(`
`)+`
if(vHeadPosition.z>1.4&&min(dot(eyeOpening0,eyeOpening0),dot(eyeOpening1,eyeOpening1))<1.0)discard;`;let V;function Ee(){if(V)return V;const p=256,n=128,c=new Float32Array(p*n*4);for(let r=0;r<n;r++)for(let l=0;l<p;l++){const H=l/p,P=r/n,k=(i,x,h,y)=>Math.exp(-Math.pow((H-i)/h,8)-Math.pow((P-x)/y,8)),d=k(.68,.66,.036,.052)*5,g=k(.26,.58,.075,.018)*1.2,m=(r*p+l)*4;c[m]=.025+d+g*.75,c[m+1]=.03+d+g*.87,c[m+2]=.04+d+g,c[m+3]=1}return V=new ke(c,p,n,He,ze),V.mapping=_e,V.needsUpdate=!0,V}function de(p,{x:n,y:c,halfWidth:r,halfHeight:l}){const P=new xe(new O(n-r*1.03,c-l*1.03,-1/0),new O(n+r*1.03,c+l*1.03,1/0)),k=new ie({side:G}),d=new F(Ce(p,P),k),g=new se(new O,new O(0,0,-1)),m=(e,t)=>{g.ray.origin.set(e,t,4);const o=g.intersectObject(d,!1)[0];if(!o)throw new Error("Milo eyelid surface is missing");return o.point.z},i=128,x=16,h=m(n,c)+.03,y=Array.from({length:i},(e,t)=>{const o=t/i*Math.PI*2;return m(n+r*Math.cos(o),c+l*Math.sin(o))}),u=[0,0,0,0,0];for(let e=0;e<i;e++){const t=e/i*Math.PI*2,o=y[e]/i;u[0]+=o,u[1]+=2*o*Math.cos(t),u[2]+=2*o*Math.sin(t),u[3]+=2*o*Math.cos(2*t),u[4]+=2*o*Math.sin(2*t)}const f=[n,c,h],b=[];for(let e=1;e<=x+1;e++){const t=e<=x?e/x:1.025;for(let o=0;o<i;o++){const a=o/i*Math.PI*2,w=n+r*t*Math.cos(a),S=c+l*t*Math.sin(a),_=h+t*(u[1]*Math.cos(a)+u[2]*Math.sin(a))+t*t*(u[0]-h+u[3]*Math.cos(2*a)+u[4]*Math.sin(2*a)),L=v.lerp(h,y[o],t*t),T=e<=x?v.lerp(_,L,v.smoothstep(t,.7,1)):m(w,S)-.004;f.push(w,S,T);const B=1+(e-1)*i+o,D=1+(e-1)*i+(o+1)%i;if(e===1)b.push(0,B,D);else{const C=B-i,A=D-i;b.push(C,B,D,C,D,A)}}}k.dispose(),d.geometry.dispose();const s=new Q;s.setAttribute("position",new N(f,3)),s.setIndex(b),s.computeVertexNormals(),s.computeBoundingBox(),s.computeBoundingSphere();const M=new Me({color:16777215,roughness:.24,metalness:0,clearcoat:1,clearcoatRoughness:.055,envMap:Ee(),envMapIntensity:.65});M.onBeforeCompile=e=>{e.uniforms.eyeCenter={value:new ee(n,c)},e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
uniform vec2 eyeCenter; varying vec2 vEyeOffset;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vEyeOffset=position.xy-eyeCenter;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
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
      vec2 lid=vEyeOffset/vec2(${r.toFixed(5)},${l.toFixed(5)});
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
    `)},M.customProgramCacheKey=()=>"milo-fitted-eye-v3-fibers";const z=new F(s,M);return z.name="Fitted Milo eye surface",z.receiveShadow=!0,z}const Y={width:1.5,height:.3,centerY:-.7},ue=`
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
`;async function Fe(p="/3D/assets/obs/head/"){const n=new ce,[c,r,l,H,P]=await Promise.all([new me().loadAsync(p+"LeePerrySmith.glb"),n.loadAsync(p+"Map-COL.jpg"),n.loadAsync(p+"Infinite-Level_02_Tangent_SmoothUV.jpg"),n.loadAsync(p+"tattoo-naval-barcode.webp"),Te(p+"supplied-hair/")]);H.colorSpace=we,H.anisotropy=4,r.colorSpace=le,r.anisotropy=4,l.anisotropy=4;const k=new U({color:13813949,map:r,normalMap:l,normalScale:new ee(.45,.45),roughness:.74,metalness:0,envMapIntensity:.3}),d={value:0},g={value:1},m={value:1};k.onBeforeCompile=s=>{s.uniforms.mouthMotion=d,s.uniforms.facialHairStrength=g,s.uniforms.proceduralHair=m,s.uniforms.napeTattoo={value:H},s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
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
      ${re}
      ${De}
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
      ${ue}
    `)},k.customProgramCacheKey=()=>"obs-milo-scan-v10-anchored-neck";const i=c.scene.getObjectByName("LeePerrySmith");if(!i?.isMesh)throw new Error("Milo head mesh is missing");const x=W/.055,h=J(i.geometry),y=new pe,u=new F(J(i.geometry,x),k);u.name="Milo scanned head",u.castShadow=!0,u.receiveShadow=!0,y.add(u),y.scale.setScalar(.055),y.userData.faceForward=W,u.customDepthMaterial=new be({depthPacking:Se}),u.customDepthMaterial.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
attribute vec3 headRestPosition;
varying vec3 vHeadPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vHeadPosition=headRestPosition;`),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHeadPosition;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
      ${re}
    `)},u.customDepthMaterial.customProgramCacheKey=()=>"milo-open-eyelid-shadow-v3-anchored-neck";let f=ae(h);f.position.z=x,y.add(f);const b=new F(new Pe(1,24,12),new U({color:2429967,roughness:1}));return b.position.set(-.11,.405,2.285+x),b.visible=!1,y.add(b),y.userData.setMouthMotion=(s,M)=>{d.value=s+M*.28,b.visible=s>.04,b.scale.set(.43,.075*s,.025)},y.userData.appearance={hair:"crop",beard:"rough"},y.userData.setAppearance=({hair:s=y.userData.appearance.hair,beard:M=y.userData.appearance.beard}={})=>{he[s]||(s="crop"),K[M]||(M="rough"),s!==y.userData.appearance.hair&&(y.remove(f),f!==P&&f.traverse(z=>{z.geometry?.dispose(),z.material?.dispose()}),f=s==="reference"?P:ae(h,s),f.position.z=x,y.add(f)),m.value=s==="reference"?0:1,g.value=K[M].strength,y.userData.appearance={hair:s,beard:M}},y.add(...oe.map(s=>{const M=de(i.geometry,s);return M.position.z=x,M})),c.scene.traverse(s=>{s.geometry?.dispose(),s.material&&(Array.isArray(s.material)?s.material:[s.material]).forEach(M=>M.dispose())}),y}const je=Object.freeze(Object.defineProperty({__proto__:null,MILO_BEARD_STYLES:K,MILO_EYE_OPENINGS:oe,MILO_HEAD_FORWARD:W,MILO_NAPE_TATTOO:Y,NAPE_TATTOO_GLSL:ue,createMiloEye:de,headGeometry:J,loadMiloHead:Fe},Symbol.toStringTag,{value:"Module"}));export{De as H,ae as c,je as h,Fe as l};
