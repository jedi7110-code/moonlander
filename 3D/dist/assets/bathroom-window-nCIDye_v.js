import{V as C,C as I,i as O,F as R,w as E,v as j,a3 as K,ak as k,af as P,c as N,ag as q,e as B,ah as A}from"./three-C530VLcl.js";import{y as J}from"./industrial-DDNLLJkh.js";const U=66311;function T(t,{reference:n=[0,5,0],windows:r=null,matchPov:e=!1}={}){const s=t.geometry,c=s.getAttribute("position"),o=s.getAttribute("starSize"),a=64,d=new C(...n),i=new C,p=[];for(let l=0;l<c.count;l++){i.fromBufferAttribute(c,l).sub(d);const y=a/i.length();p.push((o?.getX(l)??1)*y),i.multiplyScalar(y),c.setXYZ(l,i.x,i.y,i.z)}c.needsUpdate=!0,s.setAttribute("starSize",new R(p,1)),t.frustumCulled=!1,t.renderOrder=1,t.material.depthWrite=!1,t.material.userData.cabinAlwaysPowered=!0,t.material.userData.castShadow=!1;const w={value:new C},g={value:new K},m={value:1};return t.onBeforeRender=(l,y,f)=>{w.value.setFromMatrixPosition(f.matrixWorld),g.value.setFromMatrix4(f.matrixWorld),t.position.copy(w.value),t.parent?.worldToLocal(t.position),t.updateMatrixWorld(!0),m.value=l.getPixelRatio()},t.material.onBeforeCompile=l=>{l.uniforms.starEye=w,l.uniforms.starCameraRotation=g,l.uniforms.starPixelRatio=m;const y=r?.map(u=>`{
      float t = (${u.z.toFixed(6)} - eye.z) / ray.z;
      vec2 p = abs(eye.xy + ray.xy * t - vec2(${u.x.toFixed(6)}, ${u.y.toFixed(6)}));
      if (t > 0.0 && p.x < ${(u.width/2).toFixed(6)} && p.y < ${(u.height/2).toFixed(6)}
          && p.x + p.y < ${(u.width/2+u.height/2-u.cut).toFixed(6)}) throughWindow = true;
    }`).join(`
`),f=r?`
      vec3 eye = starEye;
      vec3 ray = starCameraRotation * mvPosition.xyz;
      bool throughWindow = false;
      if (abs(ray.z) > 0.00001) { ${y} }
      if (!throughWindow) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    `:"";l.vertexShader=l.vertexShader.replace("#include <common>",`#include <common>
      uniform vec3 starEye;
      uniform mat3 starCameraRotation;
      uniform float starPixelRatio;
      attribute float starSize;
      varying float starCoverage;
    `).replace("#include <project_vertex>",`#include <project_vertex>
      ${e?`
      // OBS frames the cutaway with a distant, very narrow lens. Keep the
      // POV sky's screen density instead of magnifying an almost empty patch.
      // Apply one angular scale to the whole field, never camera translation.
      mvPosition.xy *= min(1.0, 1.428148 / projectionMatrix[1][1]);
      gl_Position = projectionMatrix * mvPosition;
      `:""}
      // The shell is only a direction carrier: opaque scenery is always nearer.
      gl_Position.z = gl_Position.w * 0.999999;
      ${f}
    `).replace("#include <logdepthbuf_vertex>",`
      float footprint = gl_PointSize * starSize;
      starCoverage = min(1.0, pow(footprint / starPixelRatio, 2.0));
      gl_PointSize = clamp(footprint, starPixelRatio, 1.8 * starPixelRatio);
      #include <logdepthbuf_vertex>
    `),l.fragmentShader=l.fragmentShader.replace("#include <common>",`#include <common>
varying float starCoverage;`).replace("#include <color_fragment>",`#include <color_fragment>
diffuseColor.rgb *= starCoverage;`)},t.material.customProgramCacheKey=()=>`distant-sky-v6-${e}-${JSON.stringify(r)}`,t}function Z({rear:t=!1,windows:n=null}={}){let r=73191;const e=()=>(r=Math.imul(r,1664525)+1013904223>>>0,r/4294967296),s=[],c=[],o=new I;for(let p=0;p<1900;p++){const w=(e()-.5)*155,g=(e()-.5)*90+5,m=40+e()*35;s.push(t?-w:w,g,t?-m:m),o.setHSL(.56+e()*.09,.08+e()*.23,.46+e()*.42),c.push(...o.toArray())}const a=new O().setAttribute("position",new R(s,3)).setAttribute("color",new R(c,3)),d=new E({name:t?"Rear windows / distant stars":"POV / distant stars",size:.055,vertexColors:!0,toneMapped:!1});d.userData.cabinAlwaysPowered=!0,d.userData.castShadow=!1;const i=new j(a,d);return i.name=t?"Rear windows / stars":"POV / stars",T(i,{windows:n,matchPov:!0})}function re(){const t=new Float32Array(1260);for(let e=0;e<420;e++)t[e*3]=Math.sin(e*162.2)*45,t[e*3+1]=Math.sin(e*714.1)*26+5,t[e*3+2]=-9-Math.abs(Math.sin(e))*10;const n=new O().setAttribute("position",new R(t,3)),r=new j(n,new E({name:"Cutaway / distant stars",color:10203061,size:.028,transparent:!0,opacity:.36}));return r.name="Cutaway / stars",T(r,{reference:[0,5,60]})}function ne(t){const n=[];return t.updateMatrixWorld(!0),t.traverse(r=>{if(!r.userData.spaceWindow)return;const e=r.getWorldPosition(new C);n.push({...r.userData.spaceWindow,x:e.x,y:e.y,z:e.z})}),Z({rear:!0,windows:n})}const Q={width:.98,height:1.08,y:1.61,wallBack:-3.86,wallDepth:.12},_=new WeakMap;function h(t,n,r,e,s=0){const c=new t,o=n/2,a=r/2;return(e>0?[[-o+e,-a],[o-e,-a],[o,-a+e],[o,a-e],[o-e,a],[-o+e,a],[-o,a-e],[-o,-a+e]]:[[-o,-a],[o,-a],[o,a],[-o,a]]).forEach(([i,p],w)=>w?c.lineTo(i,p+s):c.moveTo(i,p+s)),c.closePath(),c}function ee(t){if(_.has(t))return _.get(t);const n=new B({name:"Rear windows / deep space",color:U,depthWrite:!1,toneMapped:!1}),r=new B({name:"Bathroom / pressure glass",color:9086128,transparent:!0,opacity:.065,depthWrite:!1,toneMapped:!1});for(const s of[n,r])s.userData.cabinAlwaysPowered=!0,s.userData.castShadow=!1;const e={space:n,glass:r};return _.set(t,e),e}function se(t,n,r,e,s){return te(t,n,r,e,s)}function te(t,n,r,e,s,c={}){const{width:o,height:a,y:d,wallBack:i,wallDepth:p,wallWidth:w,wallHeight:g,wallY:m,wallCut:l,wallMaterial:y}={...Q,wallWidth:1.56,wallHeight:2.48,wallY:1.29,wallCut:.04,wallMaterial:n.dark,...c},f=i+p,u=(v,b,S,L,X)=>{const x=new N(b,S);return x.name=`${s} ${v}`,x.position.set(r,e+L,X),x.castShadow=x.receiveShadow=S.userData.castShadow!==!1,t.add(x),x},z=(v,b)=>new q(v,{depth:b,steps:1,bevelEnabled:!1,curveSegments:1}),$=h(P,w,g,l,m);$.holes.push(h(A,o,a,.12,d)),u("rear wall",z($,p),y,0,i);const D=h(P,o+.22,a+.22,.18);D.holes.push(h(A,o-.02,a-.02,.115)),u("pressure window frame",z(D,.075),n.metal,d,f-.015);const F=h(P,o+.028,a+.028,.135);F.holes.push(h(A,o-.07,a-.07,.1)),u("pressure window seal",z(F,.042),n.rubber,d,f-.067);const M=o/2+.06,W=a/2-.23;for(const[v,b]of[[-M,-W],[-M,W],[M,-W],[M,W],[0,-a/2-.06],[0,a/2+.06]]){const S=J(t,n.dark,r+v,e+d+b,f+.067,.014,.012,.014,6);S.rotation.x=Math.PI/2,S.name=`${s} window fastener`}const{space:V,glass:G}=ee(n);u("pressure window glass",new k(h(P,o,a,.12)),G,d,i+.012);const H=new k(h(P,o+.08,a+.08,.13)),Y=u("space view",H,V,d,i-.003);Y.userData.spaceWindow={width:o-.07,height:a-.07,cut:.1}}export{U as S,te as a,re as b,Z as c,ne as d,se as e};
