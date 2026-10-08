import{K as g,a3 as d,c as u,av as h,e as _,m as v,J as S,a7 as M,aw as p,C as x,a6 as k}from"./three-QTzUF3zZ.js";const y=new Set(["Continuous sample-based human body","Milo scanned head","Continuous leather boot upper","Anatomical combat boot sole","Supplied hair cards","Supplied scalp"]),f=e=>/^(Supplied |Milo hair |Milo groom )/.test(e.name),C=e=>y.has(e.name)||f(e);function b(e){const r=e.clone();return r.userData={...e.userData},r.onBeforeCompile=(o,t)=>e.onBeforeCompile(o,t),r.customProgramCacheKey=()=>e.customProgramCacheKey()+"-milo-study-mask-v1",r.stencilWrite=!0,r.stencilRef=1,r.stencilZPass=k,r}function w(e,r){const o=b(e);return!e.isMeshStandardMaterial||r.name==="Fitted Milo eye surface"||e.metalness>.5||(o.normalScale?.multiplyScalar(r.name==="Milo scanned head"?.1:.25),o.bumpScale*=.12,o.onBeforeCompile=(t,n)=>{e.onBeforeCompile(t,n),r.name==="Milo scanned head"&&(t.fragmentShader=t.fragmentShader.replace("#include <map_fragment>",h.map_fragment.replace("texture2D( map, vMapUv )","texture2D( map, vMapUv, 1.5 )"))),t.fragmentShader=t.fragmentShader.replace("vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",`
      vec3 light = totalDiffuse / max(diffuseColor.rgb * (1.0 - metalnessFactor), vec3(0.0001));
      float value = dot(light, vec3(0.2126, 0.7152, 0.0722));
      float edge = max(fwidth(value), 0.015);
      float middle = smoothstep(0.80-edge, 0.80+edge, value);
      float bright = smoothstep(1.30-edge, 1.30+edge, value);
      vec3 shade = mix(vec3(0.34, 0.39, 0.46), vec3(0.69, 0.71, 0.73), middle);
      shade = mix(shade, vec3(1.12, 1.09, 1.02), bright);
      // The bands use diffuse irradiance. Omit the very faint glossy term so
      // the GPU can discard per-light GGX and reflected environment lookups.
      vec3 outgoingLight = diffuseColor.rgb * shade + totalEmissiveRadiance;
    `)},o.customProgramCacheKey=()=>e.customProgramCacheKey()+"-milo-diffuse-toon-v2-"+r.name),o}function P(e,r,o){const t=new _({map:e.map,alphaMap:e.alphaMap,alphaTest:e.alphaTest,opacity:e.opacity,transparent:e.transparent,vertexColors:e.vertexColors,clippingPlanes:e.clippingPlanes,clipIntersection:e.clipIntersection,stencilWrite:!0,stencilRef:1});return t.name="Milo study ink",t.side=f(r)?v:S,t.toneMapped=!1,t.depthWrite=!1,t.forceSinglePass=!0,t.stencilFunc=M,t.stencilWriteMask=0,t.onBeforeCompile=(n,c)=>{n.vertexShader=p.standard.vertexShader,n.fragmentShader=p.standard.fragmentShader,e.onBeforeCompile(n,c),n.fragmentShader=n.fragmentShader.split("#include <alphahash_fragment>")[0]+`
      #include <alphahash_fragment>
      vec3 outgoingLight = inkColor;
      #include <opaque_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      #include <premultiplied_alpha_fragment>
      #include <dithering_fragment>
    }`;const a=new Set(["common","packing","dithering_pars_fragment","color_pars_fragment","uv_pars_fragment","map_pars_fragment","alphamap_pars_fragment","alphatest_pars_fragment","alphahash_pars_fragment","fog_pars_fragment","logdepthbuf_pars_fragment","clipping_planes_pars_fragment","clipping_planes_fragment","logdepthbuf_fragment","map_fragment","color_fragment","alphamap_fragment","alphatest_fragment","alphahash_fragment","opaque_fragment","colorspace_fragment","fog_fragment","premultiplied_alpha_fragment","dithering_fragment"]);n.fragmentShader=n.fragmentShader.replace(/#include <(\w+)>/g,(m,i)=>a.has(i)?m:""),n.vertexShader=n.vertexShader.replace(/#include <shadowmap_(pars_vertex|vertex)>/g,""),n.uniforms.inkViewport=o,n.uniforms.inkColor={value:new x(1647660)},n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
uniform vec2 inkViewport;`).replace("#include <project_vertex>",`
      #include <project_vertex>
      vec4 inkNormal = projectionMatrix * vec4(normalize(normalMatrix * objectNormal), 0.0);
      vec2 inkDirection = (inkNormal.xy * gl_Position.w - gl_Position.xy * inkNormal.w) * inkViewport;
      inkDirection /= max(length(inkDirection), 0.00001);
      gl_Position.xy += inkDirection * (2.0 * 1.2 / inkViewport) * gl_Position.w;
      gl_Position.z += 0.00002 * gl_Position.w;
    `),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 inkColor;`)},t.customProgramCacheKey=()=>e.customProgramCacheKey()+"-milo-unlit-ink-v2",t}function B(e){const r=[];e.traverse(a=>{a.isMesh&&r.push(a)});const o=[],t=[],n={value:new g(1,1)};for(const a of r){if(Array.isArray(a.material))continue;const m=a.material,i=w(m,a);if(a.material=i,o.push({mesh:a,source:m,material:i}),!C(a))continue;const l=P(m,a,n),s=a.isSkinnedMesh?new d(a.geometry,l):new u(a.geometry,l);s.name="Milo toon outline",s.frustumCulled=!1,s.renderOrder=a.renderOrder+1,s.matrixAutoUpdate=!1,s.matrix=a.matrix,s.raycast=()=>{},a.parent.add(s),t.push({source:a,outline:s})}function c(a=1,m=1){n.value.set(Math.max(1,a),Math.max(1,m));for(const{source:i,outline:l}of t)l.visible=i.visible,l.geometry=i.geometry,l.morphTargetDictionary=i.morphTargetDictionary,l.morphTargetInfluences=i.morphTargetInfluences,i.isSkinnedMesh&&(l.skeleton=i.skeleton,l.bindMode=i.bindMode,l.bindMatrix.copy(i.bindMatrix),l.bindMatrixInverse.copy(i.bindMatrixInverse))}return c(),{update:c,dispose(){t.forEach(({outline:a})=>{a.removeFromParent(),a.material.dispose()}),o.forEach(({mesh:a,source:m,material:i})=>{a.material=m,i.dispose()})}}}export{B as c};
