import{a5 as S,S as y,R as _,h as b,V as M,ax as I,a3 as P,a$ as T,d as k,v as R,C as A,Z as O,bB as L}from"./three-CxW9jrRV.js";function D(){const t=document.createElement("canvas");t.width=256,t.height=576;const i=t.getContext("2d"),o=(d,a,x,r,e)=>{i.fillStyle=e,i.fillRect(d,a,x,r)},h=(d,a,x=11,r="#28271c",e=!1)=>{i.fillStyle=r,i.font=`${e?"bold ":""}${x}px Arial`,i.textAlign="center",i.fillText(d,128,a)};o(10,8,236,440,"#4c4325"),o(14,12,228,432,"#d8b737"),o(18,17,220,52,"#24251b"),h("CAUTION",55,34,"#e1c550",!0),i.beginPath(),i.moveTo(128,93),i.lineTo(81,174),i.lineTo(175,174),i.closePath(),i.strokeStyle="#302e20",i.lineWidth=4,i.stroke(),h("!",160,49,"#302e20",!0),h("MOVING LOADS",204,20,"#28271c",!0),h("KEEP CLEAR OF",231,14,"#28271c",!0),h("SUSPENDED CARGO",250,14,"#28271c",!0),o(29,264,198,2,"#665621"),["SECURE CARGO BEFORE","OPERATING THE HATCH.","CHECK ALL RESTRAINTS","AND LIFTING EQUIPMENT.","","DO NOT STAND BENEATH","THE HOIST OR MOVING LOAD."].forEach((d,a)=>h(d,284+a*16,11)),o(18,415,220,22,"#2c2b1e"),h("AUTHORIZED PERSONNEL ONLY",430,9,"#dfc453",!0),o(10,462,236,106,"#574923"),o(14,466,228,98,"#d8b737"),o(18,471,220,24,"#2c2b1e"),h("CAUTION",489,16,"#dfc453",!0),h("KEEP THIS AREA",521,12,"#28271c",!0),h("CLEAR AT ALL TIMES",541,12,"#28271c",!0),i.save(),i.beginPath(),i.rect(10,8,236,440),i.rect(10,462,236,106),i.clip();let c=7110;const f=()=>(c=Math.imul(c,1664525)+1013904223>>>0,c/4294967296);for(let d=0;d<1600;d++)o(f()*256,f()*576,1+f()*4,1+f()*2,d%2?"#362b1d18":"#f4e4a21c");for(const d of[9,445,463,565])for(let a=0;a<32;a++)o(10+f()*236,d-2,1+f()*5,2+f()*3,"#e5d8aa99");i.restore();const p=new S(t);return p.colorSpace=y,p.anisotropy=4,p.name="Cargo hatch / worn yellow caution label",p}const N={x:11.21925,height:1.68,width:.48,angle:4*Math.PI/180},$={x:11.88075,height:1.69,width:.48,angle:-2*Math.PI/180},B={x:7.96,height:1.78,width:1.4,angle:0},W={x:10.66,height:1.32,width:.2,angle:0,floor:0,aspect:576/256},j=[{x:2.3473,height:1.63,width:.21,angle:1*Math.PI/180,file:"time-mag.jpg",aspect:1442/1091},{x:2.6073,height:1.63,width:.21,angle:-1*Math.PI/180,file:"time2.jpg",aspect:1456/1080},{x:2.3473,height:1.25,width:.21,angle:-2*Math.PI/180,file:"newsweek.jpg",aspect:1456/1080},{x:2.6073,height:1.25,width:.21,angle:2*Math.PI/180,file:"newyorker.jpg",aspect:1442/1091}],U=[{x:-5.43,height:1.5,width:.19,angle:-4*Math.PI/180,file:"milo-family-01.webp"},{x:-5.19,height:1.46,width:.19,angle:3*Math.PI/180,file:"milo-family-02.webp"},{x:-5.34,height:1.26,width:.19,angle:-2*Math.PI/180,file:"milo-family-03.webp"}];function C(t,i){if(!i?.length)return;const o=t.onBeforeCompile,h=t.customProgramCacheKey();i.forEach((c,f)=>{t[`bunkPrintMap${f}`]=c.map}),t.onBeforeCompile=(c,f)=>{o.call(t,c,f);let p=`varying vec3 vBunkCalendarWorld;
`,d="";i.forEach((a,x)=>{const r=`bunkPrint${x}`;Object.assign(c.uniforms,{[`${r}Map`]:{value:a.map},[`${r}Center`]:{value:a.center},[`${r}Size`]:{value:a.size},[`${r}Angle`]:{value:a.angle}}),p+=`uniform sampler2D ${r}Map;
        uniform vec3 ${r}Center;
        uniform vec2 ${r}Size;
        uniform float ${r}Angle;
`,d+=`{
        vec2 offset=vBunkCalendarWorld.xy-${r}Center.xy;
        float ca=cos(${r}Angle),sa=sin(${r}Angle);
        vec2 photoUV=vec2(ca*offset.x-sa*offset.y,sa*offset.x+ca*offset.y)/${r}Size+0.5;
        if(abs(vBunkCalendarWorld.z-${r}Center.z)<0.001 &&
          all(greaterThanEqual(photoUV,vec2(0.0))) && all(lessThanEqual(photoUV,vec2(1.0)))){
          vec4 photograph=texture2D(${r}Map,photoUV);
          diffuseColor.rgb=mix(diffuseColor.rgb,photograph.rgb,photograph.a);
        }
      }
`}),c.vertexShader=`varying vec3 vBunkCalendarWorld;
`+c.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
vBunkCalendarWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`),c.fragmentShader=p+c.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
`+d)},t.customProgramCacheKey=()=>`${h}/bunk-prints-v2/${i.length}`}function Z(t,i,o){if(typeof Image>"u")return;t.updateMatrixWorld(!0);const h="/obs/",c=new Map,f=[{...N,file:"bunk-calendar-1987.webp",aspect:1261/1247},{...$,file:"bunk-beach-poster.webp",aspect:1427/1102},{...B,file:"lounge-paradise-poster.jpg",aspect:1200/1800},...j,...U.map(p=>({...p,aspect:2/3})),{...W,map:D()}];for(const{x:p,height:d,width:a,angle:x,file:r,aspect:e,map:n,floor:u=o}of f){const l=new _(new b(p,u+d,0),new b(0,0,-1)).intersectObject(t,!0).find(({object:m,face:E})=>m.material===i.enamel&&E.normal.z>.999);if(!l)continue;const s=new M(a,a*e),v=n??new I().load(`${h}assets/obs/${r}`,m=>{s.y=a*m.image.height/m.image.width});v.colorSpace=y,v.anisotropy=4,r&&(v.name=r),c.has(l.object)||c.set(l.object,[]),c.get(l.object).push({map:v,center:l.point.clone(),size:s,angle:x})}for(const[p,d]of c){const a=p.material.clone();a.name="Cabin wall with supplied prints",a.userData.wallPrints=d,C(a,d),p.material=a,p.name="Cabin calendar and poster wall"}}const z=new Set(["Industrial / wet chain","Industrial / wet floor"]),K=t=>t.userData.cabinKeepSurface===!0,G=t=>t.isMeshStandardMaterial&&!t.transparent&&!z.has(t.name)&&!t.isMeshPhysicalMaterial;function V(t,i){const o=Math.min(1,Math.max(0,(i/t-1)/1.5));return o*o*(3-2*o)}function F(t){const i=new L({name:"Cabin toon / "+t.name,color:t.color,map:t.map,vertexColors:t.vertexColors,side:t.side,alphaMap:t.alphaMap,alphaTest:t.alphaTest,emissive:t.emissive,emissiveMap:t.emissiveMap,emissiveIntensity:t.emissiveIntensity,lightMap:t.lightMap,lightMapIntensity:t.lightMapIntensity,clippingPlanes:t.clippingPlanes,clipIntersection:t.clipIntersection,clipShadows:t.clipShadows,depthWrite:t.depthWrite});return i.onBeforeCompile=o=>{o.fragmentShader=o.fragmentShader.replace("#include <lights_toon_pars_fragment>",`
      varying vec3 vViewPosition;
      struct ToonMaterial { vec3 diffuseColor; };
      void RE_Direct_Toon(const in IncidentLight light, const in vec3 geometryPosition, const in vec3 geometryNormal,
        const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal,
        const in ToonMaterial material, inout ReflectedLight reflectedLight) {
        reflectedLight.directDiffuse += saturate(dot(geometryNormal, light.direction)) * light.color * RECIPROCAL_PI;
      }
      void RE_IndirectDiffuse_Toon(const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal,
        const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal,
        const in ToonMaterial material, inout ReflectedLight reflectedLight) {
        reflectedLight.indirectDiffuse += irradiance * RECIPROCAL_PI;
      }
      #define RE_Direct RE_Direct_Toon
      #define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
    `).replace("vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",`
      float light = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));
      float edge = max(fwidth(light), 0.015);
      // Lift shadow and midtone bands gently; keep highlights and ink intact.
      vec3 shade = mix(vec3(0.47, 0.51, 0.55), vec3(0.82, 0.85, 0.83), smoothstep(0.58-edge, 0.58+edge, light));
      shade = mix(shade, vec3(1.10, 1.07, 1.00), smoothstep(1.04-edge, 1.04+edge, light));
      vec3 outgoingLight = diffuseColor.rgb * shade + totalEmissiveRadiance;
    `)},i.customProgramCacheKey=()=>"cabin-study-bands-v2",C(i,t.userData.wallPrints),i}function w(t=1){return new R({name:"Cabin study ink",side:O,toneMapped:!1,depthWrite:!1,clipping:!0,uniforms:{viewport:{value:new M(1,1)},ink:{value:new A(1581855)},width:{value:t}},vertexShader:`
      #include <common>
      #include <clipping_planes_pars_vertex>
      #include <skinning_pars_vertex>
      uniform vec2 viewport; uniform float width;
      void main(){
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        #include <clipping_planes_vertex>
        vec4 n = projectionMatrix * vec4(normalize(normalMatrix * objectNormal), 0.0);
        vec2 direction = (n.xy * gl_Position.w - gl_Position.xy * n.w) * viewport;
        direction /= max(length(direction), 0.00001);
        gl_Position.xy += direction * (2.0 * width / viewport) * gl_Position.w;
        gl_Position.z += 0.00003 * gl_Position.w;
      }`,fragmentShader:`
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 ink;
      void main(){
        #include <clipping_planes_fragment>
        gl_FragColor=vec4(ink,1.0);
        #include <colorspace_fragment>
      }`})}function q(t){const i=[],o=new Map,h=[],c=w(),f=new Map,p=[];function d(e,n){let u=c;for(let s=e;s;s=s.parent){const v=s.userData.toonOutlineWidth;if(!(!Number.isFinite(v)||v<0)){f.has(v)||f.set(v,w(v)),u=f.get(v);break}}const g=n.clippingPlanes;if(!g?.length)return u;let l=p.find(s=>s.base===u&&s.planes===g&&s.intersection===n.clipIntersection);if(!l){const s=u.clone();s.name="Cabin study ink / clipped",s.uniforms=u.uniforms,s.clipping=!0,s.clippingPlanes=g,s.clipIntersection=n.clipIntersection,s.clipShadows=n.clipShadows,l={base:u,planes:g,intersection:n.clipIntersection,material:s},p.push(l)}return l.material}for(const e of t)e.updateMatrixWorld(!0),e.traverse(n=>{n.isMesh&&i.push({mesh:n,source:n.material})});for(const{mesh:e,source:n}of i){if(Array.isArray(n))continue;const u=K(n);if(!G(n)&&!u||(!u&&!o.has(n)&&o.set(n,F(n)),n.userData.cabinNoOutline||n.side===P||n.emissiveIntensity>1||/cable|rubber|rope/i.test(n.name)||e.isSkinnedMesh&&!e.userData.cabinRigidSkin||n.alphaTest>0))continue;e.geometry.boundingBox||e.geometry.computeBoundingBox();const g=e.geometry.boundingBox,l=e.matrixWorld.elements;if(Math.max((g.max.x-g.min.x)*Math.hypot(l[0],l[1],l[2]),(g.max.y-g.min.y)*Math.hypot(l[4],l[5],l[6]),(g.max.z-g.min.z)*Math.hypot(l[8],l[9],l[10]))<.24)continue;const v=d(e,n),m=e.isSkinnedMesh?new T(e.geometry,v):new k(e.geometry,v);m.name="Cabin toon outline",m.matrixAutoUpdate=!1,e.isSkinnedMesh&&(m.skeleton=e.skeleton,m.bindMode=e.bindMode,m.bindMatrix.copy(e.bindMatrix),m.bindMatrixInverse.copy(e.bindMatrixInverse),m.frustumCulled=!1),m.matrix=e.matrix,m.renderOrder=e.renderOrder+1,m.raycast=()=>{},e.parent.add(m),h.push({mesh:e,shell:m})}let a="current";function x(e){if(["current","cartoon","flat"].includes(e)){a=e;for(const{mesh:n,source:u}of i)n.material=a==="current"?u:o.get(u)??u;r()}}function r(e,n,u,g){e&&n&&(c.uniforms.viewport.value.set(e,n),f.forEach(l=>l.uniforms.viewport.value.set(e,n))),u>0&&g>0&&(c.uniforms.width.value=V(u,g));for(const{mesh:l,shell:s}of h)s.visible=a==="cartoon"&&s.material.uniforms.width.value>1e-6&&l.visible,s.geometry=l.geometry}return x("current"),{setStyle:x,update:r,get width(){return a==="cartoon"?c.uniforms.width.value:0},dispose(){for(const{mesh:e,source:n}of i)e.material=n;h.forEach(({shell:e})=>e.removeFromParent()),o.forEach(e=>e.dispose()),c.dispose(),f.forEach(e=>e.dispose()),p.forEach(({material:e})=>e.dispose())}}}export{q as c,Z as f};
