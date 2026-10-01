import{V as O,g as x,i as Y,F,M as $,m as Z,c as j,e as ie,s as se,aI as ce,b8 as xe,S as le,G as pe,K as ee,a4 as be,ai as Me,b9 as we,ba as Se,bb as Pe,k as ke,x as ze,ad as He,az as _e,bc as Ae}from"./three-D_l1qIn7.js";import{G as Ce}from"./cabin-toon-BUzERox2.js";import{a as me}from"./BufferGeometryUtils-CVtbbMuF.js";import{t as Le}from"./triangle-subset-DZfP0SvM.js";const K=new WeakMap;function De(h){if(K.has(h))return K.get(h);const t=new O(0,1.9,0),l=new j(h,new ie({side:Z})),i=new se,p=96,z=48,w=[];for(let f=0;f<=z;f++)for(let c=0;c<p;c++){const g=f/z*2.12,a=c/p*Math.PI*2,d=new O(Math.sin(g)*Math.sin(a),Math.cos(g),Math.sin(g)*Math.cos(a));i.set(t.clone().addScaledVector(d,6),d.clone().negate());const m=i.intersectObject(l,!1)[0];w.push(m?m.point.distanceTo(t):1.7)}l.material.dispose();const S=f=>{const c=(Math.atan2(f.x,f.z)/(Math.PI*2)+1)%1*p,g=Math.min(z-1e-5,Math.acos(x.clamp(f.y,-1,1))/2.12*z),a=Math.floor(c),d=Math.floor(g),m=c-a,u=g-d,v=(b,s)=>w[s*p+b%p],y=x.lerp(x.lerp(v(a,d),v(a+1,d),m),x.lerp(v(a,d+1),v(a+1,d+1),m),u);return t.clone().addScaledVector(f,y)};return K.set(h,S),S}function Be(h,t,l){const i=De(h),p=[],z=[],w=[],S=[];let f=71023;const c=()=>(f=Math.imul(f,1664525)+1013904223>>>0,f/4294967296),g=18,a=2,d=16e3;for(let y=0;y<d;y++){const b=1-c()*1.4,s=y*2.3999632297,M=new O(Math.sqrt(1-b*b)*Math.sin(s),b,Math.sqrt(1-b*b)*Math.cos(s)),H=i(M);if(H.y-l(H.x,H.z)<-.025)continue;const n=x.smoothstep(H.y,2.45,3.35);x.smoothstep(H.z,.3,1.4);const o=c(),r=c(),P=(.36+n*(t==="swept"?1.2:t==="fringe"?.78:.95))*(.85+o*.3),k=(.009+n*.014)*(.85+c()*.3),_=(.004+n*(t==="rough"?.035:.018))*(.85+o*.3),L=c()*6.28,T=p.length/3;for(let D=0;D<=g;D++){const B=D/g,C=new O(n*(t==="swept"?-1.2:t==="fringe"?-.22:-.8)+(1-n)*M.x*.18,n*.25-(1-n)*.6,t==="fringe"?n*.65-(1-n)*.6:t==="swept"?-.65:-1);C.x+=n*(t==="rough"?.18:.06)*Math.sin(L+B*2.5),C.addScaledVector(M,-C.dot(M)).normalize(),D&&M.addScaledVector(C,P/g/1.75).normalize();const A=i(M),I=new O().crossVectors(C,M).normalize(),E=x.smoothstep(A.y-l(A.x,A.z),-.03,.14),ue=x.smoothstep(B,0,.1)*(1-.96*x.smoothstep(B,.8,1))*E,ve=x.smoothstep(A.y,2.65,3.5),ge=.5+.5*Math.sin(A.x*5+A.z*2.7+Math.sin(A.z*2.2)),ye=.004+E*(ve*(.12+.075*ge)+_*Math.sin(Math.PI*B*.91));for(let V=0;V<=a;V++){const te=V/a,X=te*2-1,q=A.clone().addScaledVector(I,X*k*ue).addScaledVector(M,ye+(1-X*X)*k*.12);if(p.push(q.x,q.y,q.z),z.push(te,B),w.push(r),D<g&&V<a){const N=T+D*(a+1)+V;S.push(N,N+a+1,N+1,N+1,N+a+1,N+a+2)}}}}const m=new Y;m.setAttribute("position",new F(p,3)),m.setAttribute("uv",new F(z,2)),m.setAttribute("lockSeed",new F(w,1)),m.setIndex(S),m.computeVertexNormals(),m.computeBoundingBox(),m.computeBoundingSphere();const u=new $({color:4798245,roughness:.68,metalness:0,side:Z});u.onBeforeCompile=y=>{y.vertexShader=y.vertexShader.replace("#include <common>",`#include <common>
attribute float lockSeed; varying float vLockSeed; varying vec2 vLockUv;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vLockSeed=lockSeed;vLockUv=uv;`),y.fragmentShader=y.fragmentShader.replace("#include <common>",`#include <common>
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
    `)},u.customProgramCacheKey=()=>"milo-groom-fibers-v1";const v=new j(m,u);return v.name=`Milo groom ${t}`,v.userData.style=t,v.castShadow=!0,v.receiveShadow=!0,v}function ne(h,t){const l=1.2+x.smoothstep(t,-1.1,1.65)*1.54+x.smoothstep(Math.abs(h),.95,1.65)*.18-.14*Math.exp(-((h+.35)**2)*3)*x.smoothstep(t,1,1.7)+.018*Math.sin(h*19+t*7);return Math.max(l,2.22*x.smoothstep(Math.abs(h),1.2,1.6))}const Oe=`
float hairline = 1.20 + smoothstep(-1.1, 1.65, vHeadPosition.z) * 1.54
  + smoothstep(0.95, 1.65, abs(vHeadPosition.x)) * 0.18
  - 0.14 * exp(-pow(vHeadPosition.x + 0.35, 2.0) * 3.0) * smoothstep(1.0, 1.7, vHeadPosition.z)
  + 0.018 * sin(vHeadPosition.x * 19.0 + vHeadPosition.z * 7.0);
hairline = max(hairline, 2.22 * smoothstep(1.2, 1.6, abs(vHeadPosition.x)));`,de={reference:{label:"提供モデル",description:"提供OBJの毛束・頭皮・テクスチャを使用"},crop:{label:"A 現行・短髪",description:"今の短いクルーカット"},rough:{label:"B ラフクロップ",description:"不均一な束と立ち上がり。参照に最も近い"},fringe:{label:"C 乱れた前髪",description:"前方へ落ちる短い束を残す"},swept:{label:"D 流し気味",description:"片側へ流した少し整ったラフショート"}};function Te(h,t,{top:l,edge:i,clump:p,front:z}){const w=x.smoothstep(t.y,2.78,3.48),S=1-i;if(h==="rough"){const f=.5+.5*Math.sin(t.x*17-t.z*11+Math.sin(t.y*9)*2.2),c=Math.max(0,Math.sin(t.x*11+t.z*7-t.y*3))**3;return{volume:.006+i*(.012+l*(.16+.11*p)),x:w*i*(p-.5)*.18,y:w*i*(.06+.22*c+.08*f),z:w*i*(z*.12-.045)}}if(h==="fringe"){const f=z*(1-x.smoothstep(t.y,2.9,3.55)),c=.55+.45*Math.sin(t.x*8.5+1.2);return{volume:.005+i*(.011+l*(.13+.09*p)+f*.1),x:-l*i*.03+t.x*f*S*.1,y:-f*(.15+.42*S)*c,z:f*(.34+.34*S)-l*i*.02}}return h==="swept"?{volume:.005+i*(.012+l*(.16+.07*p)),x:-w*i*(.4+.1*p),y:w*i*.07,z:w*i*.07}:{volume:.003+i*(.008+l*(.12+.09*p)),x:-l*i*.17,y:0,z:-l*i*.06}}function ae(h,t="crop",{hairline:l=ne}={}){if(de[t]||(t="crop"),t!=="crop")return Be(h,t,ne);const i=h.index?h.toNonIndexed():h,p=i.attributes.position,z=i.attributes.normal,w=[],S=[],f=m=>m.y-Math.max(l(m.x,m.z)+.04,2.22+.08*Math.sin(m.x*4+m.z*3));for(let m=0;m<p.count;m+=3){const u=[];for(let v=0;v<3;v++){const y=m+v,b=m+(v+1)%3,s=new O().fromBufferAttribute(p,y),M=new O().fromBufferAttribute(p,b),H=new O().fromBufferAttribute(z,y),e=new O().fromBufferAttribute(z,b),n=f(s),o=f(M);if(n>=0&&u.push({p:s,n:H}),n>=0!=o>=0){const r=n/(n-o);u.push({p:s.clone().lerp(M,r),n:H.clone().lerp(e,r).normalize()})}}for(let v=1;v<u.length-1;v++)for(const{p:y,n:b}of[u[0],u[v],u[v+1]]){const s=x.smoothstep(y.y,2.25,3.5),M=x.smoothstep(f(y),0,.32),H=y.x*10+y.z*4+Math.sin(y.z*6)*.45,e=.5+.5*Math.sin(H),n=x.smoothstep(y.z,.55,1.75),o=Te(t,y,{top:s,edge:M,clump:e,front:n}),r=y.clone().addScaledVector(b,o.volume);r.x+=o.x,r.y+=o.y,r.z+=o.z,w.push(r.x,r.y,r.z),S.push(x.smoothstep(f(y),0,.32))}}i!==h&&i.dispose();const c=new Y;c.setAttribute("position",new F(w,3)),c.setAttribute("hairCoverage",new F(S,1));const g=me(c,1e-4);c.dispose(),g.computeVertexNormals(),g.computeBoundingBox(),g.computeBoundingSphere();const a=new $({color:2695451,roughness:.95,envMapIntensity:.12,transparent:!0,depthWrite:!1});a.onBeforeCompile=m=>{m.vertexShader=m.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vHair;
attribute float hairCoverage;
varying float vHairCoverage;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vHair = position;
vHairCoverage = hairCoverage;`),m.fragmentShader=m.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHair;
varying float vHairCoverage;`).replace("#include <color_fragment>",`#include <color_fragment>
      float strand = sin(vHair.x * 310.0 + vHair.z * 112.0 + sin(vHair.y * 22.0) * 4.0);
      float lock = sin(vHair.x * 9.0 + vHair.z * 2.8);
      float grain = fract(sin(dot(vHair, vec3(127.1,311.7,74.7))) * 43758.5453);
      diffuseColor.rgb *= 0.85 + 0.035 * strand + 0.035 * lock + grain * 0.12;
      diffuseColor.a *= vHairCoverage;
    `)},a.customProgramCacheKey=()=>`milo-textured-hair-${t}-v2`;const d=new j(g,a);return d.name=`Milo hair ${t}`,d.userData.style=t,d.castShadow=!0,d.receiveShadow=!0,d}function Ee(h){const t=["position","normal","uv"],l=Object.fromEntries(t.map(c=>[c,[]])),i=c=>Object.fromEntries(t.map(g=>{const a=h.attributes[g];return[g,Array.from(a.array.slice(c*a.itemSize,(c+1)*a.itemSize))]})),p=c=>{const[g,a]=c.position,d=x.smoothstep(Math.abs(g+.11),.65,1.2);return a-(-.65+1.35*d)},z=(c,g,a)=>Object.fromEntries(t.map(d=>[d,c[d].map((m,u)=>x.lerp(m,g[d][u],a))])),w=h.index.array;for(let c=0;c<w.length;c+=3){const g=[i(w[c]),i(w[c+1]),i(w[c+2])],a=[];for(let d=0;d<3;d++){const m=g[d],u=g[(d+1)%3],v=p(m),y=p(u);if(v>=0&&a.push(m),v>=0!=y>=0){let b=0,s=1;for(let M=0;M<24;M++){const H=(b+s)/2;p(z(m,u,H))>=0==v>=0?b=H:s=H}a.push(z(m,u,(b+s)/2))}}for(let d=1;d<a.length-1;d++)for(const m of[a[0],a[d],a[d+1]])for(const u of t)l[u].push(...m[u])}const S=new Y;for(const c of t)S.setAttribute(c,new F(l[c],c==="uv"?2:3));const f=me(S,1e-6);return S.dispose(),f.normalizeNormals(),f}async function Fe(h){const t=new ce,l=new xe,[i,p,z,w,S,f,c]=await Promise.all([l.loadAsync(h+"hair-solid.json"),l.loadAsync(h+"scalp.json"),t.loadAsync(h+"hair-color-2k.png"),t.loadAsync(h+"hair-opacity-2k.jpg"),t.loadAsync(h+"hair-normal-2k.png"),t.loadAsync(h+"scalp-color.jpg"),t.loadAsync(h+"scalp-opacity.jpg")]);for(const a of[z,f])a.colorSpace=le;for(const a of[z,w,S,f,c])a.anisotropy=8;const g=new pe;g.name="Supplied Jacob hairstyle";for(const[a,d,m,u,v]of[[p,f,c,null,"Supplied scalp"],[i,z,w,S,"Supplied hair cards"]]){const y=new $({map:d,alphaMap:m,normalMap:u,normalScale:new ee(.18,.18),roughness:.84,metalness:0,side:Z,alphaTest:u?.22:.35,alphaToCoverage:!0}),b=Ee(a);a.dispose(),b.computeBoundingBox(),b.computeBoundingSphere();const s=new j(b,y);s.name=v,s.castShadow=!0,s.receiveShadow=!0,g.add(s)}return g}const W={none:{label:"なし",strength:0},light:{label:"薄い無精髭",strength:.42},rough:{label:"濃い無精髭",strength:1}};function U(h,t,l){const i=x.clamp((h-t)/(l-t),0,1);return 6*i*(1-i)/(l-t)}const J=.025;function Q(h,t=0){const l=h.clone(),i=l.attributes.position,p=l.index.array,z=[];for(let e=0;e<p.length;e+=3)[p[e],p[e+1],p[e+2]].every(n=>i.getY(n)>=-1.05)&&z.push(p[e],p[e+1],p[e+2]);const w=.12,S=.38,f=l.attributes.normal;for(let e=0;e<i.count;e++){const n=i.getX(e),o=i.getY(e),r=i.getZ(e),P=1-x.smoothstep(o,-1.05,.85),k=1-x.smoothstep(r,.5,1.6),_=P*k;if(!_)continue;const L=1-w*_,T=1-S*_;i.setXYZ(e,n*L,o,r*T);const D=-U(o,-1.05,.85)*k,B=-P*U(r,.5,1.6),C=f.getX(e)/L,A=(f.getZ(e)+w*n*B*C)/(T-S*r*B),I=f.getY(e)+w*n*D*C+S*r*D*A,E=Math.hypot(C,I,A)||1;f.setXYZ(e,C/E,I/E,A/E)}const c=new Set,g=f.array.slice();for(let e=0;e<i.count;e++){const n=i.getX(e),o=i.getY(e),r=i.getZ(e),P=x.smoothstep(r,.05,.55)*(1-x.smoothstep(o,-.85,-.45)),k=.14+1.28*Math.sqrt(Math.max(0,1-(n/1.2)**2));P&&k>r&&(i.setZ(e,x.lerp(r,k,P)),c.add(e))}l.computeVertexNormals();for(let e=0;e<f.count;e++)c.has(e)||f.setXYZ(e,...g.slice(e*3,e*3+3));l.setIndex(z);const a=l.toNonIndexed(),d=["position","normal","uv"],m=Object.fromEntries(d.map(e=>[e,Array.from(a.attributes[e].array)])),u=e=>Object.fromEntries(d.map(n=>{const o=l.attributes[n];return[n,Array.from(o.array.slice(e*o.itemSize,(e+1)*o.itemSize))]})),v=(e,n,o)=>Object.fromEntries(d.map(r=>[r,e[r].map((P,k)=>x.lerp(P,n[r][k],o))])),y=(...e)=>{for(const n of e)for(const o of d)m[o].push(...n[o])},b=-1.05,s=[];for(let e=0;e<p.length;e+=3){const n=[p[e],p[e+1],p[e+2]].map(u);if(n.every(r=>r.position[1]>=b)||n.every(r=>r.position[1]<b))continue;const o=[];for(let r=0;r<3;r++){const P=n[r],k=n[(r+1)%3],_=P.position[1]>=b,L=k.position[1]>=b;if(_&&o.push(P),_!==L){const T=v(P,k,(b-P.position[1])/(k.position[1]-P.position[1]));T.position[1]=b,o.push(T)}}for(let r=1;r<o.length-1;r++)y(o[0],o[r],o[r+1]);for(let r=0;r<o.length;r++){const P=o[r],k=o[(r+1)%o.length];P.position[1]===b&&k.position[1]===b&&s.push([P,k])}}const M=(e,n)=>{const o=Math.atan2(e.position[2],e.position[0]),r=x.smoothstep(n,0,1),P=b-.9*n,k=e.normal[0]*Math.cos(o)+e.normal[2]*Math.sin(o),_=x.clamp(.9*e.normal[1]/Math.max(.25,k),-.6,.6)*n*(1-n)*(1-n),L=x.lerp(e.position[0],Math.cos(o)*1.34,r)+Math.cos(o)*_,T=x.lerp(e.position[2],Math.sin(o)*(Math.sin(o)>0?1.42:1.22),r)+Math.sin(o)*_;return[L,P,T]},H=(e,n)=>{const o=Math.atan2(e.position[2],e.position[0]),r=v(e,e,0);r.position=M(e,n);const P=M(e,Math.max(0,n-.001)),k=M(e,Math.min(1,n+.001)),_=((k[0]-P[0])*Math.cos(o)+(k[2]-P[2])*Math.sin(o))/(P[1]-k[1]),L=new O(...e.normal).lerp(new O(Math.cos(o),_,Math.sin(o)).normalize(),x.smoothstep(n,0,.25)).normalize();return r.normal=L.toArray(),r};for(const[e,n]of s)for(let o=0;o<16;o++){const r=H(e,o/16),P=H(n,o/16),k=H(e,(o+1)/16),_=H(n,(o+1)/16);y(P,r,k),y(P,k,_)}for(const e of d)a.setAttribute(e,new F(m[e],e==="uv"?2:3));if(t){const e=a.attributes.position,n=a.attributes.normal;for(let o=0;o<e.count;o++){const r=e.getY(o),P=e.getZ(o),k=x.smoothstep(P,.5,1.6),_=x.smoothstep(r,-1.25,.55),L=x.smoothstep(r,-1.25,-.55),T=x.lerp(_,L,k);e.setZ(o,e.getZ(o)+t*T);const D=x.lerp(U(r,-1.25,.55),U(r,-1.25,-.55),k),B=U(P,.5,1.6)*(L-_),C=n.getX(o),A=n.getZ(o)/(1+t*B),I=n.getY(o)-t*D*A,E=Math.hypot(C,I,A);n.setXYZ(o,C/E,I/E,A/E)}}return a.setAttribute("headRestPosition",a.attributes.position.clone()),l.dispose(),a.computeBoundingBox(),a.computeBoundingSphere(),a}const oe=[{x:-.73,y:1.69,halfWidth:.27,halfHeight:.086},{x:.51,y:1.69,halfWidth:.27,halfHeight:.086}],re=oe.map(({x:h,y:t,halfWidth:l,halfHeight:i},p)=>`vec2 eyeOpening${p}=(vHeadPosition.xy-vec2(${h.toFixed(4)},${t.toFixed(4)}))/vec2(${l.toFixed(4)},${i.toFixed(4)});`).join(`
`)+`
if(vHeadPosition.z>1.4&&min(dot(eyeOpening0,eyeOpening0),dot(eyeOpening1,eyeOpening1))<1.0)discard;`;let R;function je(){if(R)return R;const h=256,t=128,l=new Float32Array(h*t*4);for(let i=0;i<t;i++)for(let p=0;p<h;p++){const z=p/h,w=i/t,S=(a,d,m,u)=>Math.exp(-Math.pow((z-a)/m,8)-Math.pow((w-d)/u,8)),f=S(.68,.66,.036,.052)*5,c=S(.26,.58,.075,.018)*1.2,g=(i*h+p)*4;l[g]=.025+f+c*.75,l[g+1]=.03+f+c*.87,l[g+2]=.04+f+c,l[g+3]=1}return R=new ze(l,h,t,He,_e),R.mapping=Ae,R.needsUpdate=!0,R}function he(h,{x:t,y:l,halfWidth:i,halfHeight:p}){const w=new be(new O(t-i*1.03,l-p*1.03,-1/0),new O(t+i*1.03,l+p*1.03,1/0)),S=new ie({side:Z}),f=new j(Le(h,w),S),c=new se(new O,new O(0,0,-1)),g=(e,n)=>{c.ray.origin.set(e,n,4);const o=c.intersectObject(f,!1)[0];if(!o)throw new Error("Milo eyelid surface is missing");return o.point.z},a=128,d=16,m=g(t,l)+.03,u=Array.from({length:a},(e,n)=>{const o=n/a*Math.PI*2;return g(t+i*Math.cos(o),l+p*Math.sin(o))}),v=[0,0,0,0,0];for(let e=0;e<a;e++){const n=e/a*Math.PI*2,o=u[e]/a;v[0]+=o,v[1]+=2*o*Math.cos(n),v[2]+=2*o*Math.sin(n),v[3]+=2*o*Math.cos(2*n),v[4]+=2*o*Math.sin(2*n)}const y=[t,l,m],b=[];for(let e=1;e<=d+1;e++){const n=e<=d?e/d:1.025;for(let o=0;o<a;o++){const r=o/a*Math.PI*2,P=t+i*n*Math.cos(r),k=l+p*n*Math.sin(r),_=m+n*(v[1]*Math.cos(r)+v[2]*Math.sin(r))+n*n*(v[0]-m+v[3]*Math.cos(2*r)+v[4]*Math.sin(2*r)),L=x.lerp(m,u[o],n*n),T=e<=d?x.lerp(_,L,x.smoothstep(n,.7,1)):g(P,k)-.004;y.push(P,k,T);const D=1+(e-1)*a+o,B=1+(e-1)*a+(o+1)%a;if(e===1)b.push(0,D,B);else{const C=D-a,A=B-a;b.push(C,D,B,C,B,A)}}}S.dispose(),f.geometry.dispose();const s=new Y;s.setAttribute("position",new F(y,3)),s.setIndex(b),s.computeVertexNormals(),s.computeBoundingBox(),s.computeBoundingSphere();const M=new Me({color:16777215,roughness:.24,metalness:0,clearcoat:1,clearcoatRoughness:.055,envMap:je(),envMapIntensity:.65});M.onBeforeCompile=e=>{e.uniforms.eyeCenter={value:new ee(t,l)},e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
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
      vec2 lid=vEyeOffset/vec2(${i.toFixed(5)},${p.toFixed(5)});
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
      clearcoatNormal=normalize(geometryNormal-eyeT*corneaSlope.x-eyeB*corneaSlope.y);
    `)},M.customProgramCacheKey=()=>"milo-fitted-eye-v3-fibers";const H=new j(s,M);return H.name="Fitted Milo eye surface",H.receiveShadow=!0,H}const G={width:1.5,height:.3,centerY:-.7},fe=`
  vec2 napeUv=vec2(.5-vHeadPosition.x/${G.width.toFixed(4)},.5+(vHeadPosition.y-(${G.centerY.toFixed(4)}))/${G.height.toFixed(4)});
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
`;async function Ie(h="/3D/assets/obs/head/"){const t=new ce,[l,i,p,z,w]=await Promise.all([new Ce().loadAsync(h+"LeePerrySmith.glb"),t.loadAsync(h+"Map-COL.jpg"),t.loadAsync(h+"Infinite-Level_02_Tangent_SmoothUV.jpg"),t.loadAsync(h+"tattoo-naval-barcode.png"),Fe(h+"supplied-hair/")]);z.colorSpace=we,z.anisotropy=4,i.colorSpace=le,i.anisotropy=4,p.anisotropy=4;const S=new $({color:13813949,map:i,normalMap:p,normalScale:new ee(.45,.45),roughness:.74,metalness:0,envMapIntensity:.3}),f={value:0},c={value:1},g={value:1};S.onBeforeCompile=s=>{s.uniforms.mouthMotion=f,s.uniforms.facialHairStrength=c,s.uniforms.proceduralHair=g,s.uniforms.napeTattoo={value:z},s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
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
      ${Oe}
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
      ${fe}
    `)},S.customProgramCacheKey=()=>"obs-milo-scan-v10-anchored-neck";const a=l.scene.getObjectByName("LeePerrySmith");if(!a?.isMesh)throw new Error("Milo head mesh is missing");const d=J/.055,m=Q(a.geometry),u=new pe,v=new j(Q(a.geometry,d),S);v.name="Milo scanned head",v.castShadow=!0,v.receiveShadow=!0,u.add(v),u.scale.setScalar(.055),u.userData.faceForward=J,v.customDepthMaterial=new Se({depthPacking:Pe}),v.customDepthMaterial.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
attribute vec3 headRestPosition;
varying vec3 vHeadPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vHeadPosition=headRestPosition;`),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHeadPosition;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
      ${re}
    `)},v.customDepthMaterial.customProgramCacheKey=()=>"milo-open-eyelid-shadow-v3-anchored-neck";let y=ae(m);y.position.z=d,u.add(y);const b=new j(new ke(1,24,12),new $({color:2429967,roughness:1}));return b.position.set(-.11,.405,2.285+d),b.visible=!1,u.add(b),u.userData.setMouthMotion=(s,M)=>{f.value=s+M*.28,b.visible=s>.04,b.scale.set(.43,.075*s,.025)},u.userData.appearance={hair:"crop",beard:"rough"},u.userData.setAppearance=({hair:s=u.userData.appearance.hair,beard:M=u.userData.appearance.beard}={})=>{de[s]||(s="crop"),W[M]||(M="rough"),s!==u.userData.appearance.hair&&(u.remove(y),y!==w&&y.traverse(H=>{H.geometry?.dispose(),H.material?.dispose()}),y=s==="reference"?w:ae(m,s),y.position.z=d,u.add(y)),g.value=s==="reference"?0:1,c.value=W[M].strength,u.userData.appearance={hair:s,beard:M}},u.add(...oe.map(s=>{const M=he(a.geometry,s);return M.position.z=d,M})),l.scene.traverse(s=>{s.geometry?.dispose(),s.material&&(Array.isArray(s.material)?s.material:[s.material]).forEach(M=>M.dispose())}),u}const $e=Object.freeze(Object.defineProperty({__proto__:null,MILO_BEARD_STYLES:W,MILO_EYE_OPENINGS:oe,MILO_HEAD_FORWARD:J,MILO_NAPE_TATTOO:G,NAPE_TATTOO_GLSL:fe,createMiloEye:he,headGeometry:Q,loadMiloHead:Ie},Symbol.toStringTag,{value:"Module"}));export{Oe as H,ae as c,$e as h,Ie as l};
