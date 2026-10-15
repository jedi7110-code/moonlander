import{V as O,f as v,j as ee,F as N,M as G,y as Z,c as R,e as le,R as pe,b7 as me,S as de,G as he,h as oe,bv as Me,aV as be,aW as Se,l as Pe,x as ke,aO as He,s as ze,av as _e,aw as Ae,bw as Ce}from"./three-DQ4xDlKG.js";import{G as fe}from"./eva-Do_fO24L.js";import{a as Le}from"./BufferGeometryUtils-BMZX59MU.js";import{t as De}from"./triangle-subset-DgMiKONV.js";import{o as ae,q as ie}from"./lighting-BvCn_dPx.js";const K=new WeakMap;function Be(p){if(K.has(p))return K.get(p);const t=new O(0,1.9,0),r=new R(p,new le({side:Z})),a=new pe,c=96,z=48,S=[];for(let h=0;h<=z;h++)for(let g=0;g<c;g++){const m=h/z*2.12,i=g/c*Math.PI*2,x=new O(Math.sin(m)*Math.sin(i),Math.cos(m),Math.sin(m)*Math.cos(i));a.set(t.clone().addScaledVector(x,6),x.clone().negate());const d=a.intersectObject(r,!1)[0];S.push(d?d.point.distanceTo(t):1.7)}r.material.dispose();const k=h=>{const g=(Math.atan2(h.x,h.z)/(Math.PI*2)+1)%1*c,m=Math.min(z-1e-5,Math.acos(v.clamp(h.y,-1,1))/2.12*z),i=Math.floor(g),x=Math.floor(m),d=g-i,y=m-x,f=(b,s)=>S[s*c+b%c],u=v.lerp(v.lerp(f(i,x),f(i+1,x),d),v.lerp(f(i,x+1),f(i+1,x+1),d),y);return t.clone().addScaledVector(h,u)};return K.set(p,k),k}function Oe(p,t,r){const a=Be(p),c=[],z=[],S=[],k=[];let h=71023;const g=()=>(h=Math.imul(h,1664525)+1013904223>>>0,h/4294967296),m=18,i=2,x=16e3;for(let u=0;u<x;u++){const b=1-g()*1.4,s=u*2.3999632297,M=new O(Math.sqrt(1-b*b)*Math.sin(s),b,Math.sqrt(1-b*b)*Math.cos(s)),_=a(M);if(_.y-r(_.x,_.z)<-.025)continue;const e=v.smoothstep(_.y,2.45,3.35);v.smoothstep(_.z,.3,1.4);const n=g(),o=g(),l=(.36+e*(t==="swept"?1.2:t==="fringe"?.78:.95))*(.85+n*.3),w=(.009+e*.014)*(.85+g()*.3),P=(.004+e*(t==="rough"?.035:.018))*(.85+n*.3),A=g()*6.28,D=c.length/3;for(let C=0;C<=m;C++){const B=C/m,T=new O(e*(t==="swept"?-1.2:t==="fringe"?-.22:-.8)+(1-e)*M.x*.18,e*.25-(1-e)*.6,t==="fringe"?e*.65-(1-e)*.6:t==="swept"?-.65:-1);T.x+=e*(t==="rough"?.18:.06)*Math.sin(A+B*2.5),T.addScaledVector(M,-T.dot(M)).normalize(),C&&M.addScaledVector(T,l/m/1.75).normalize();const L=a(M),F=new O().crossVectors(T,M).normalize(),I=v.smoothstep(L.y-r(L.x,L.z),-.03,.14),E=v.smoothstep(B,0,.1)*(1-.96*v.smoothstep(B,.8,1))*I,ye=v.smoothstep(L.y,2.65,3.5),xe=.5+.5*Math.sin(L.x*5+L.z*2.7+Math.sin(L.z*2.2)),we=.004+I*(ye*(.12+.075*xe)+P*Math.sin(Math.PI*B*.91));for(let $=0;$<=i;$++){const ne=$/i,X=ne*2-1,q=L.clone().addScaledVector(F,X*w*E).addScaledVector(M,we+(1-X*X)*w*.12);if(c.push(q.x,q.y,q.z),z.push(ne,B),S.push(o),C<m&&$<i){const V=D+C*(i+1)+$;k.push(V,V+i+1,V+1,V+1,V+i+1,V+i+2)}}}}const d=new ee;d.setAttribute("position",new N(c,3)),d.setAttribute("uv",new N(z,2)),d.setAttribute("lockSeed",new N(S,1)),d.setIndex(k),d.computeVertexNormals(),d.computeBoundingBox(),d.computeBoundingSphere();const y=new G({color:4798245,roughness:.68,metalness:0,side:Z});y.onBeforeCompile=u=>{u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>
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
    `)},y.customProgramCacheKey=()=>"milo-groom-fibers-v1";const f=new R(d,y);return f.name=`Milo groom ${t}`,f.userData.style=t,f.castShadow=!0,f.receiveShadow=!0,f}function re(p,t){const r=1.2+v.smoothstep(t,-1.1,1.65)*1.54+v.smoothstep(Math.abs(p),.95,1.65)*.18-.14*Math.exp(-((p+.35)**2)*3)*v.smoothstep(t,1,1.7)+.018*Math.sin(p*19+t*7);return Math.max(r,2.22*v.smoothstep(Math.abs(p),1.2,1.6))}const Te=`
float hairline = 1.20 + smoothstep(-1.1, 1.65, vHeadPosition.z) * 1.54
  + smoothstep(0.95, 1.65, abs(vHeadPosition.x)) * 0.18
  - 0.14 * exp(-pow(vHeadPosition.x + 0.35, 2.0) * 3.0) * smoothstep(1.0, 1.7, vHeadPosition.z)
  + 0.018 * sin(vHeadPosition.x * 19.0 + vHeadPosition.z * 7.0);
hairline = max(hairline, 2.22 * smoothstep(1.2, 1.6, abs(vHeadPosition.x)));`,ue={reference:{label:"提供モデル",description:"提供OBJの毛束・頭皮・テクスチャを使用"},crop:{label:"A 現行・短髪",description:"今の短いクルーカット"},rough:{label:"B ラフクロップ",description:"不均一な束と立ち上がり。参照に最も近い"},fringe:{label:"C 乱れた前髪",description:"前方へ落ちる短い束を残す"},swept:{label:"D 流し気味",description:"片側へ流した少し整ったラフショート"}};function Fe(p,t,{top:r,edge:a,clump:c,front:z}){const S=v.smoothstep(t.y,2.78,3.48),k=1-a;if(p==="rough"){const h=.5+.5*Math.sin(t.x*17-t.z*11+Math.sin(t.y*9)*2.2),g=Math.max(0,Math.sin(t.x*11+t.z*7-t.y*3))**3;return{volume:.006+a*(.012+r*(.16+.11*c)),x:S*a*(c-.5)*.18,y:S*a*(.06+.22*g+.08*h),z:S*a*(z*.12-.045)}}if(p==="fringe"){const h=z*(1-v.smoothstep(t.y,2.9,3.55)),g=.55+.45*Math.sin(t.x*8.5+1.2);return{volume:.005+a*(.011+r*(.13+.09*c)+h*.1),x:-r*a*.03+t.x*h*k*.1,y:-h*(.15+.42*k)*g,z:h*(.34+.34*k)-r*a*.02}}return p==="swept"?{volume:.005+a*(.012+r*(.16+.07*c)),x:-S*a*(.4+.1*c),y:S*a*.07,z:S*a*.07}:{volume:.003+a*(.008+r*(.12+.09*c)),x:-r*a*.17,y:0,z:-r*a*.06}}function se(p,t="crop",{hairline:r=re}={}){if(ue[t]||(t="crop"),t!=="crop")return Oe(p,t,re);const a=p.index?p.toNonIndexed():p,c=a.attributes.position,z=a.attributes.normal,S=[],k=[],h=d=>d.y-Math.max(r(d.x,d.z)+.04,2.22+.08*Math.sin(d.x*4+d.z*3));for(let d=0;d<c.count;d+=3){const y=[];for(let f=0;f<3;f++){const u=d+f,b=d+(f+1)%3,s=new O().fromBufferAttribute(c,u),M=new O().fromBufferAttribute(c,b),_=new O().fromBufferAttribute(z,u),H=new O().fromBufferAttribute(z,b),e=h(s),n=h(M);if(e>=0&&y.push({p:s,n:_}),e>=0!=n>=0){const o=e/(e-n);y.push({p:s.clone().lerp(M,o),n:_.clone().lerp(H,o).normalize()})}}for(let f=1;f<y.length-1;f++)for(const{p:u,n:b}of[y[0],y[f],y[f+1]]){const s=v.smoothstep(u.y,2.25,3.5),M=v.smoothstep(h(u),0,.32),_=u.x*10+u.z*4+Math.sin(u.z*6)*.45,H=.5+.5*Math.sin(_),e=v.smoothstep(u.z,.55,1.75),n=Fe(t,u,{top:s,edge:M,clump:H,front:e}),o=u.clone().addScaledVector(b,n.volume);o.x+=n.x,o.y+=n.y,o.z+=n.z,S.push(o.x,o.y,o.z),k.push(v.smoothstep(h(u),0,.32))}}a!==p&&a.dispose();const g=new ee;g.setAttribute("position",new N(S,3)),g.setAttribute("hairCoverage",new N(k,1));const m=Le(g,1e-4);g.dispose(),m.computeVertexNormals(),m.computeBoundingBox(),m.computeBoundingSphere();const i=new G({color:2695451,roughness:.95,envMapIntensity:.12,transparent:!0,depthWrite:!1});i.onBeforeCompile=d=>{d.vertexShader=d.vertexShader.replace("#include <common>",`#include <common>
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
    `)},i.customProgramCacheKey=()=>`milo-textured-hair-${t}-v2`;const x=new R(m,i);return x.name=`Milo hair ${t}`,x.userData.style=t,x.castShadow=!0,x.receiveShadow=!0,x}async function Ee(p){const t=new me,[r,a,c,z,S,k]=await Promise.all([new fe().loadAsync(p+"supplied-hair.glb"),t.loadAsync(p+"hair-color-2k.webp"),t.loadAsync(p+"hair-opacity-2k.jpg"),t.loadAsync(p+"hair-normal-2k.webp"),t.loadAsync(p+"scalp-color.jpg"),t.loadAsync(p+"scalp-opacity.jpg")]);for(const m of[a,S])m.colorSpace=de;for(const m of[a,c,z,S,k])m.anisotropy=8;const h=m=>{const i=r.scene.getObjectByName(m);if(!i?.isMesh)throw new Error(`Supplied hair mesh is missing: ${m}`);return i.geometry},g=new he;g.name="Supplied Jacob hairstyle";for(const[m,i,x,d,y]of[[h("scalp"),S,k,null,"Supplied scalp"],[h("hair-cards"),a,c,z,"Supplied hair cards"]]){const f=new G({map:i,alphaMap:x,normalMap:d,normalScale:new oe(.18,.18),roughness:.84,metalness:0,side:Z,alphaTest:d?.22:.35,alphaToCoverage:!0});m.computeBoundingBox(),m.computeBoundingSphere();const u=new R(m,f);u.name=y,u.castShadow=!0,u.receiveShadow=!0,g.add(u)}return r.scene.traverse(m=>{m.material&&(Array.isArray(m.material)?m.material:[m.material]).forEach(i=>i.dispose())}),g}const W={none:{label:"なし",strength:0},light:{label:"薄い無精髭",strength:.42},rough:{label:"濃い無精髭",strength:1}};function U(p,t,r){const a=v.clamp((p-t)/(r-t),0,1);return 6*a*(1-a)/(r-t)}const J=.025;function Ie(p,t=0){const r=Q(p,t);let a;do a=r.next();while(!a.done);return a.value}function*Q(p,t=0){const r=p.clone(),a=r.attributes.position,c=r.index.array,z=[];for(let e=0;e<c.length;e+=3)e%3072===0&&(yield),[c[e],c[e+1],c[e+2]].every(n=>a.getY(n)>=-1.05)&&z.push(c[e],c[e+1],c[e+2]);const S=.12,k=.38,h=r.attributes.normal;for(let e=0;e<a.count;e++){e%1024===0&&(yield);const n=a.getX(e),o=a.getY(e),l=a.getZ(e),w=1-v.smoothstep(o,-1.05,.85),P=1-v.smoothstep(l,.5,1.6),A=w*P;if(!A)continue;const D=1-S*A,C=1-k*A;a.setXYZ(e,n*D,o,l*C);const B=-U(o,-1.05,.85)*P,T=-w*U(l,.5,1.6),L=h.getX(e)/D,F=(h.getZ(e)+S*n*T*L)/(C-k*l*T),I=h.getY(e)+S*n*B*L+k*l*B*F,E=Math.hypot(L,I,F)||1;h.setXYZ(e,L/E,I/E,F/E)}const g=new Set,m=h.array.slice();for(let e=0;e<a.count;e++){e%1024===0&&(yield);const n=a.getX(e),o=a.getY(e),l=a.getZ(e),w=v.smoothstep(l,.05,.55)*(1-v.smoothstep(o,-.85,-.45)),P=.14+1.28*Math.sqrt(Math.max(0,1-(n/1.2)**2));w&&P>l&&(a.setZ(e,v.lerp(l,P,w)),g.add(e))}yield,r.computeVertexNormals(),yield;for(let e=0;e<h.count;e++)g.has(e)||h.setXYZ(e,...m.slice(e*3,e*3+3));r.setIndex(z);const i=r.toNonIndexed(),x=["position","normal","uv"],d=Object.fromEntries(x.map(e=>[e,Array.from(i.attributes[e].array)])),y=e=>Object.fromEntries(x.map(n=>{const o=r.attributes[n];return[n,Array.from(o.array.slice(e*o.itemSize,(e+1)*o.itemSize))]})),f=(e,n,o)=>Object.fromEntries(x.map(l=>[l,e[l].map((w,P)=>v.lerp(w,n[l][P],o))])),u=(...e)=>{for(const n of e)for(const o of x)d[o].push(...n[o])},b=-1.05,s=[];for(let e=0;e<c.length;e+=3){e%3072===0&&(yield);const n=[c[e],c[e+1],c[e+2]].map(y);if(n.every(l=>l.position[1]>=b)||n.every(l=>l.position[1]<b))continue;const o=[];for(let l=0;l<3;l++){const w=n[l],P=n[(l+1)%3],A=w.position[1]>=b,D=P.position[1]>=b;if(A&&o.push(w),A!==D){const C=f(w,P,(b-w.position[1])/(P.position[1]-w.position[1]));C.position[1]=b,o.push(C)}}for(let l=1;l<o.length-1;l++)u(o[0],o[l],o[l+1]);for(let l=0;l<o.length;l++){const w=o[l],P=o[(l+1)%o.length];w.position[1]===b&&P.position[1]===b&&s.push([w,P])}}const M=(e,n)=>{const o=Math.atan2(e.position[2],e.position[0]),l=v.smoothstep(n,0,1),w=b-.9*n,P=e.normal[0]*Math.cos(o)+e.normal[2]*Math.sin(o),A=v.clamp(.9*e.normal[1]/Math.max(.25,P),-.6,.6)*n*(1-n)*(1-n),D=v.lerp(e.position[0],Math.cos(o)*1.34,l)+Math.cos(o)*A,C=v.lerp(e.position[2],Math.sin(o)*(Math.sin(o)>0?1.42:1.22),l)+Math.sin(o)*A;return[D,w,C]},_=(e,n)=>{const o=Math.atan2(e.position[2],e.position[0]),l=f(e,e,0);l.position=M(e,n);const w=M(e,Math.max(0,n-.001)),P=M(e,Math.min(1,n+.001)),A=((P[0]-w[0])*Math.cos(o)+(P[2]-w[2])*Math.sin(o))/(w[1]-P[1]),D=new O(...e.normal).lerp(new O(Math.cos(o),A,Math.sin(o)).normalize(),v.smoothstep(n,0,.25)).normalize();return l.normal=D.toArray(),l};let H=0;for(const[e,n]of s){H++%16===0&&(yield);for(let o=0;o<16;o++){const l=_(e,o/16),w=_(n,o/16),P=_(e,(o+1)/16),A=_(n,(o+1)/16);u(w,l,P),u(w,P,A)}}yield;for(const e of x)i.setAttribute(e,new N(d[e],e==="uv"?2:3));if(t){const e=i.attributes.position,n=i.attributes.normal;for(let o=0;o<e.count;o++){o%1024===0&&(yield);const l=e.getY(o),w=e.getZ(o),P=v.smoothstep(w,.5,1.6),A=v.smoothstep(l,-1.25,.55),D=v.smoothstep(l,-1.25,-.55),C=v.lerp(A,D,P);e.setZ(o,e.getZ(o)+t*C);const B=v.lerp(U(l,-1.25,.55),U(l,-1.25,-.55),P),T=U(w,.5,1.6)*(D-A),L=n.getX(o),F=n.getZ(o)/(1+t*T),I=n.getY(o)-t*B*F,E=Math.hypot(L,I,F);n.setXYZ(o,L/E,I/E,F/E)}}return i.setAttribute("headRestPosition",i.attributes.position.clone()),r.dispose(),i.computeBoundingBox(),i.computeBoundingSphere(),i}const te=[{x:-.73,y:1.69,halfWidth:.27,halfHeight:.086},{x:.51,y:1.69,halfWidth:.27,halfHeight:.086}],ce=te.map(({x:p,y:t,halfWidth:r,halfHeight:a},c)=>`vec2 eyeOpening${c}=(vHeadPosition.xy-vec2(${p.toFixed(4)},${t.toFixed(4)}))/vec2(${r.toFixed(4)},${a.toFixed(4)});`).join(`
`)+`
if(vHeadPosition.z>1.4&&min(dot(eyeOpening0,eyeOpening0),dot(eyeOpening1,eyeOpening1))<1.0)discard;`;let j;function Re(){if(j)return j;const p=256,t=128,r=new Float32Array(p*t*4);for(let a=0;a<t;a++)for(let c=0;c<p;c++){const z=c/p,S=a/t,k=(i,x,d,y)=>Math.exp(-Math.pow((z-i)/d,8)-Math.pow((S-x)/y,8)),h=k(.68,.66,.036,.052)*5,g=k(.26,.58,.075,.018)*1.2,m=(a*p+c)*4;r[m]=.025+h+g*.75,r[m+1]=.03+h+g*.87,r[m+2]=.04+h+g,r[m+3]=1}return j=new ze(r,p,t,_e,Ae),j.mapping=Ce,j.needsUpdate=!0,j}function ve(p,{x:t,y:r,halfWidth:a,halfHeight:c}){const S=new ke(new O(t-a*1.03,r-c*1.03,-1/0),new O(t+a*1.03,r+c*1.03,1/0)),k=new le({side:Z}),h=new R(De(p,S),k),g=new pe(new O,new O(0,0,-1)),m=(H,e)=>{g.ray.origin.set(H,e,4);const n=g.intersectObject(h,!1)[0];if(!n)throw new Error("Milo eyelid surface is missing");return n.point.z},i=128,x=16,d=m(t,r)+.03,y=Array.from({length:i},(H,e)=>{const n=e/i*Math.PI*2;return m(t+a*Math.cos(n),r+c*Math.sin(n))}),f=[0,0,0,0,0];for(let H=0;H<i;H++){const e=H/i*Math.PI*2,n=y[H]/i;f[0]+=n,f[1]+=2*n*Math.cos(e),f[2]+=2*n*Math.sin(e),f[3]+=2*n*Math.cos(2*e),f[4]+=2*n*Math.sin(2*e)}const u=[t,r,d],b=[];for(let H=1;H<=x+1;H++){const e=H<=x?H/x:1.025;for(let n=0;n<i;n++){const o=n/i*Math.PI*2,l=t+a*e*Math.cos(o),w=r+c*e*Math.sin(o),P=d+e*(f[1]*Math.cos(o)+f[2]*Math.sin(o))+e*e*(f[0]-d+f[3]*Math.cos(2*o)+f[4]*Math.sin(2*o)),A=v.lerp(d,y[n],e*e),D=H<=x?v.lerp(P,A,v.smoothstep(e,.7,1)):m(l,w)-.004;u.push(l,w,D);const C=1+(H-1)*i+n,B=1+(H-1)*i+(n+1)%i;if(H===1)b.push(0,C,B);else{const T=C-i,L=B-i;b.push(T,C,B,T,B,L)}}}k.dispose(),h.geometry.dispose();const s=new ee;s.setAttribute("position",new N(u,3)),s.setIndex(b),s.computeVertexNormals(),s.computeBoundingBox(),s.computeBoundingSphere();const M=new He({color:16777215,roughness:.24,metalness:0,clearcoat:1,clearcoatRoughness:.055,envMap:Re(),envMapIntensity:.65});M.onBeforeCompile=H=>{H.uniforms.eyeCenter={value:new oe(t,r)},H.vertexShader=H.vertexShader.replace("#include <common>",`#include <common>
uniform vec2 eyeCenter; varying vec2 vEyeOffset;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vEyeOffset=position.xy-eyeCenter;`),H.fragmentShader=H.fragmentShader.replace("#include <common>",`#include <common>
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
      vec2 lid=vEyeOffset/vec2(${a.toFixed(5)},${c.toFixed(5)});
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
    `)},M.customProgramCacheKey=()=>"milo-fitted-eye-v3-fibers";const _=new R(s,M);return _.name="Fitted Milo eye surface",_.receiveShadow=!0,_}const Y={width:1.5,height:.3,centerY:-.7},ge=`
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
`;async function Ne(p="/3D/assets/obs/head/"){const t=new me,[r,a,c,z,S]=await Promise.all([new fe().loadAsync(p+"LeePerrySmith.glb"),t.loadAsync(p+"Map-COL.jpg"),t.loadAsync(p+"Infinite-Level_02_Tangent_SmoothUV.jpg"),t.loadAsync(p+"tattoo-naval-barcode.webp"),Ee(p+"supplied-hair/")]);z.colorSpace=Me,z.anisotropy=4,a.colorSpace=de,a.anisotropy=4,c.anisotropy=4;const k=new G({color:13813949,map:a,normalMap:c,normalScale:new oe(.45,.45),roughness:.74,metalness:0,envMapIntensity:.3}),h={value:0},g={value:1},m={value:1};k.onBeforeCompile=s=>{s.uniforms.mouthMotion=h,s.uniforms.facialHairStrength=g,s.uniforms.proceduralHair=m,s.uniforms.napeTattoo={value:z},s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
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
    `)},k.customProgramCacheKey=()=>"obs-milo-scan-v10-anchored-neck";const i=r.scene.getObjectByName("LeePerrySmith");if(!i?.isMesh)throw new Error("Milo head mesh is missing");const x=J/.055,d=await ae(Q(i.geometry)),y=new he,f=new R(await ae(Q(i.geometry,x)),k);f.name="Milo scanned head",f.castShadow=!0,f.receiveShadow=!0,y.add(f),y.scale.setScalar(.055),y.userData.faceForward=J,f.customDepthMaterial=new be({depthPacking:Se}),f.customDepthMaterial.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
attribute vec3 headRestPosition;
varying vec3 vHeadPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vHeadPosition=headRestPosition;`),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHeadPosition;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
      ${ce}
    `)},f.customDepthMaterial.customProgramCacheKey=()=>"milo-open-eyelid-shadow-v3-anchored-neck",await ie();let u=se(d);u.position.z=x,y.add(u);const b=new R(new Pe(1,24,12),new G({color:2429967,roughness:1}));b.position.set(-.11,.405,2.285+x),b.visible=!1,y.add(b),y.userData.setMouthMotion=(s,M)=>{h.value=s+M*.28,b.visible=s>.04,b.scale.set(.43,.075*s,.025)},y.userData.appearance={hair:"crop",beard:"rough"},y.userData.setAppearance=({hair:s=y.userData.appearance.hair,beard:M=y.userData.appearance.beard}={})=>{ue[s]||(s="crop"),W[M]||(M="rough"),s!==y.userData.appearance.hair&&(y.remove(u),u!==S&&u.traverse(_=>{_.geometry?.dispose(),_.material?.dispose()}),u=s==="reference"?S:se(d,s),u.position.z=x,y.add(u)),m.value=s==="reference"?0:1,g.value=W[M].strength,y.userData.appearance={hair:s,beard:M}};for(const s of te){await ie();const M=ve(i.geometry,s);M.position.z=x,y.add(M)}return r.scene.traverse(s=>{s.geometry?.dispose(),s.material&&(Array.isArray(s.material)?s.material:[s.material]).forEach(M=>M.dispose())}),y}const Ye=Object.freeze(Object.defineProperty({__proto__:null,MILO_BEARD_STYLES:W,MILO_EYE_OPENINGS:te,MILO_HEAD_FORWARD:J,MILO_NAPE_TATTOO:Y,NAPE_TATTOO_GLSL:ge,createMiloEye:ve,headGeometry:Ie,loadMiloHead:Ne},Symbol.toStringTag,{value:"Module"}));export{Te as H,se as c,Ye as h,Ne as l};
