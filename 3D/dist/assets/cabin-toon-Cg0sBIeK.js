import{r as _,S as b,s as S,V as w,J as M,aJ as P,m as I,a3 as T,c as k,z as A,C as O,E as R,a5 as L}from"./three-Cd8_WpuG.js";function D(){const t=document.createElement("canvas");t.width=256,t.height=576;const i=t.getContext("2d"),a=(r,o,g,e,n)=>{i.fillStyle=n,i.fillRect(r,o,g,e)},c=(r,o,g=11,e="#28271c",n=!1)=>{i.fillStyle=e,i.font=`${n?"bold ":""}${g}px Arial`,i.textAlign="center",i.fillText(r,128,o)};a(10,8,236,440,"#4c4325"),a(14,12,228,432,"#d8b737"),a(18,17,220,52,"#24251b"),c("CAUTION",55,34,"#e1c550",!0),i.beginPath(),i.moveTo(128,93),i.lineTo(81,174),i.lineTo(175,174),i.closePath(),i.strokeStyle="#302e20",i.lineWidth=4,i.stroke(),c("!",160,49,"#302e20",!0),c("MOVING LOADS",204,20,"#28271c",!0),c("KEEP CLEAR OF",231,14,"#28271c",!0),c("SUSPENDED CARGO",250,14,"#28271c",!0),a(29,264,198,2,"#665621"),["SECURE CARGO BEFORE","OPERATING THE HATCH.","CHECK ALL RESTRAINTS","AND LIFTING EQUIPMENT.","","DO NOT STAND BENEATH","THE HOIST OR MOVING LOAD."].forEach((r,o)=>c(r,284+o*16,11)),a(18,415,220,22,"#2c2b1e"),c("AUTHORIZED PERSONNEL ONLY",430,9,"#dfc453",!0),a(10,462,236,106,"#574923"),a(14,466,228,98,"#d8b737"),a(18,471,220,24,"#2c2b1e"),c("CAUTION",489,16,"#dfc453",!0),c("KEEP THIS AREA",521,12,"#28271c",!0),c("CLEAR AT ALL TIMES",541,12,"#28271c",!0),i.save(),i.beginPath(),i.rect(10,8,236,440),i.rect(10,462,236,106),i.clip();let l=7110;const s=()=>(l=Math.imul(l,1664525)+1013904223>>>0,l/4294967296);for(let r=0;r<1600;r++)a(s()*256,s()*576,1+s()*4,1+s()*2,r%2?"#362b1d18":"#f4e4a21c");for(const r of[9,445,463,565])for(let o=0;o<32;o++)a(10+s()*236,r-2,1+s()*5,2+s()*3,"#e5d8aa99");i.restore();const f=new _(t);return f.colorSpace=b,f.anisotropy=4,f.name="Cargo hatch / worn yellow caution label",f}const N={x:11.21925,height:1.68,width:.48,angle:4*Math.PI/180},$={x:11.88075,height:1.69,width:.48,angle:-2*Math.PI/180},B={x:7.96,height:1.78,width:1.4,angle:0},W={x:10.66,height:1.32,width:.2,angle:0,floor:0,aspect:576/256},j=[{x:2.3473,height:1.63,width:.21,angle:1*Math.PI/180,file:"time-mag.jpg",aspect:1442/1091},{x:2.6073,height:1.63,width:.21,angle:-1*Math.PI/180,file:"time2.jpg",aspect:1456/1080},{x:2.3473,height:1.25,width:.21,angle:-2*Math.PI/180,file:"newsweek.jpg",aspect:1456/1080},{x:2.6073,height:1.25,width:.21,angle:2*Math.PI/180,file:"newyorker.jpg",aspect:1442/1091}],U=[{x:-5.43,height:1.5,width:.19,angle:-4*Math.PI/180,file:"milo-family-01.webp"},{x:-5.19,height:1.46,width:.19,angle:3*Math.PI/180,file:"milo-family-02.webp"},{x:-5.34,height:1.26,width:.19,angle:-2*Math.PI/180,file:"milo-family-03.webp"}];function C(t,i){if(!i?.length)return;const a=t.onBeforeCompile,c=t.customProgramCacheKey();i.forEach((l,s)=>{t[`bunkPrintMap${s}`]=l.map}),t.onBeforeCompile=(l,s)=>{a.call(t,l,s);let f=`varying vec3 vBunkCalendarWorld;
`,r="";i.forEach((o,g)=>{const e=`bunkPrint${g}`;Object.assign(l.uniforms,{[`${e}Map`]:{value:o.map},[`${e}Center`]:{value:o.center},[`${e}Size`]:{value:o.size},[`${e}Angle`]:{value:o.angle}}),f+=`uniform sampler2D ${e}Map;
        uniform vec3 ${e}Center;
        uniform vec2 ${e}Size;
        uniform float ${e}Angle;
`,r+=`{
        vec2 offset=vBunkCalendarWorld.xy-${e}Center.xy;
        float ca=cos(${e}Angle),sa=sin(${e}Angle);
        vec2 photoUV=vec2(ca*offset.x-sa*offset.y,sa*offset.x+ca*offset.y)/${e}Size+0.5;
        if(abs(vBunkCalendarWorld.z-${e}Center.z)<0.001 &&
          all(greaterThanEqual(photoUV,vec2(0.0))) && all(lessThanEqual(photoUV,vec2(1.0)))){
          vec4 photograph=texture2D(${e}Map,photoUV);
          diffuseColor.rgb=mix(diffuseColor.rgb,photograph.rgb,photograph.a);
        }
      }
`}),l.vertexShader=`varying vec3 vBunkCalendarWorld;
`+l.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
vBunkCalendarWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`),l.fragmentShader=f+l.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
`+r)},t.customProgramCacheKey=()=>`${c}/bunk-prints-v2/${i.length}`}function q(t,i,a){if(typeof Image>"u")return;t.updateMatrixWorld(!0);const c="/3D/",l=new Map,s=[{...N,file:"bunk-calendar-1987.webp",aspect:1261/1247},{...$,file:"bunk-beach-poster.webp",aspect:1427/1102},{...B,file:"lounge-paradise-poster.jpg",aspect:1200/1800},...j,...U.map(f=>({...f,aspect:2/3})),{...W,map:D()}];for(const{x:f,height:r,width:o,angle:g,file:e,aspect:n,map:d,floor:m=a}of s){const p=new S(new w(f,m+r,0),new w(0,0,-1)).intersectObject(t,!0).find(({object:x,face:E})=>x.material===i.enamel&&E.normal.z>.999);if(!p)continue;const v=new M(o,o*n),h=d??new P().load(`${c}assets/obs/${e}`,x=>{v.y=o*x.image.height/x.image.width});h.colorSpace=b,h.anisotropy=4,e&&(h.name=e),l.has(p.object)||l.set(p.object,[]),l.get(p.object).push({map:h,center:p.point.clone(),size:v,angle:g})}for(const[f,r]of l){const o=f.material.clone();o.name="Cabin wall with supplied prints",o.userData.wallPrints=r,C(o,r),f.material=o,f.name="Cabin calendar and poster wall"}}const z=new Set(["Industrial / wet chain","Industrial / wet floor"]),K=t=>t.userData.cabinKeepSurface===!0,G=t=>t.isMeshStandardMaterial&&!t.transparent&&!z.has(t.name)&&!t.isMeshPhysicalMaterial;function V(t,i){const a=Math.min(1,Math.max(0,(i/t-1)/1.5));return a*a*(3-2*a)}function F(t){const i=new L({name:"Cabin toon / "+t.name,color:t.color,map:t.map,vertexColors:t.vertexColors,side:t.side,alphaMap:t.alphaMap,alphaTest:t.alphaTest,emissive:t.emissive,emissiveMap:t.emissiveMap,emissiveIntensity:t.emissiveIntensity,lightMap:t.lightMap,lightMapIntensity:t.lightMapIntensity,clippingPlanes:t.clippingPlanes,depthWrite:t.depthWrite});return i.onBeforeCompile=a=>{a.fragmentShader=a.fragmentShader.replace("#include <lights_toon_pars_fragment>",`
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
    `)},i.customProgramCacheKey=()=>"cabin-study-bands-v2",C(i,t.userData.wallPrints),i}function y(t=1){return new A({name:"Cabin study ink",side:R,toneMapped:!1,depthWrite:!1,clipping:!0,uniforms:{viewport:{value:new M(1,1)},ink:{value:new O(1581855)},width:{value:t}},vertexShader:`
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
      }`})}function J(t){const i=[],a=new Map,c=[],l=y(),s=new Map;function f(e){for(let n=e;n;n=n.parent){const d=n.userData.toonOutlineWidth;if(!(!Number.isFinite(d)||d<0))return s.has(d)||s.set(d,y(d)),s.get(d)}return l}for(const e of t)e.updateMatrixWorld(!0),e.traverse(n=>{n.isMesh&&i.push({mesh:n,source:n.material})});for(const{mesh:e,source:n}of i){if(Array.isArray(n))continue;const d=K(n);if(!G(n)&&!d||(!d&&!a.has(n)&&a.set(n,F(n)),n.userData.cabinNoOutline||n.side===I||n.emissiveIntensity>1||/cable|rubber|rope/i.test(n.name)||e.isSkinnedMesh&&!e.userData.cabinRigidSkin||n.alphaTest>0))continue;e.geometry.boundingBox||e.geometry.computeBoundingBox();const m=e.geometry.boundingBox,u=e.matrixWorld.elements;if(Math.max((m.max.x-m.min.x)*Math.hypot(u[0],u[1],u[2]),(m.max.y-m.min.y)*Math.hypot(u[4],u[5],u[6]),(m.max.z-m.min.z)*Math.hypot(u[8],u[9],u[10]))<.24)continue;const v=f(e),h=e.isSkinnedMesh?new T(e.geometry,v):new k(e.geometry,v);h.name="Cabin toon outline",h.matrixAutoUpdate=!1,e.isSkinnedMesh&&(h.skeleton=e.skeleton,h.bindMode=e.bindMode,h.bindMatrix.copy(e.bindMatrix),h.bindMatrixInverse.copy(e.bindMatrixInverse),h.frustumCulled=!1),h.matrix=e.matrix,h.renderOrder=e.renderOrder+1,h.raycast=()=>{},e.parent.add(h),c.push({mesh:e,shell:h})}let r="current";function o(e){if(["current","cartoon","flat"].includes(e)){r=e;for(const{mesh:n,source:d}of i)n.material=r==="current"?d:a.get(d)??d;g()}}function g(e,n,d,m){e&&n&&(l.uniforms.viewport.value.set(e,n),s.forEach(u=>u.uniforms.viewport.value.set(e,n))),d>0&&m>0&&(l.uniforms.width.value=V(d,m));for(const{mesh:u,shell:p}of c)p.visible=r==="cartoon"&&p.material.uniforms.width.value>1e-6&&u.visible,p.geometry=u.geometry}return o("current"),{setStyle:o,update:g,get width(){return r==="cartoon"?l.uniforms.width.value:0},dispose(){for(const{mesh:e,source:n}of i)e.material=n;c.forEach(({shell:e})=>e.removeFromParent()),a.forEach(e=>e.dispose()),l.dispose(),s.forEach(e=>e.dispose())}}}export{J as c,q as f};
