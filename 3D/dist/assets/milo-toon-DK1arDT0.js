import{t as g}from"./lighting-BLIiU2NT.js";import{h as u,aD as h,c as _,aW as v,e as S,y as M,w as x,aH as y,aX as f,C as k,aG as b}from"./three-31ksWoXt.js";const C=new Set(["Continuous sample-based human body","Milo scanned head","Continuous leather boot upper","Anatomical combat boot sole","Supplied hair cards","Supplied scalp"]),d=e=>/^(Supplied |Milo hair |Milo groom )/.test(e.name),w=e=>C.has(e.name)||d(e);function P(e){const o=Object.create(e);o.userData={};const r=new e.constructor().copy(o);return r.userData={...e.userData},r.onBeforeCompile=(t,n)=>e.onBeforeCompile(t,n),r.customProgramCacheKey=()=>e.customProgramCacheKey()+"-milo-study-mask-v1",r.stencilWrite=!0,r.stencilRef=1,r.stencilZPass=b,r}function D(e,o){const r=P(e);return!e.isMeshStandardMaterial||o.name==="Fitted Milo eye surface"||e.metalness>.5||(r.normalScale?.multiplyScalar(o.name==="Milo scanned head"?.1:.25),r.bumpScale*=.12,r.onBeforeCompile=(t,n)=>{e.onBeforeCompile(t,n),o.name==="Milo scanned head"&&(t.fragmentShader=t.fragmentShader.replace("#include <map_fragment>",v.map_fragment.replace("texture2D( map, vMapUv )","texture2D( map, vMapUv, 1.5 )"))),t.fragmentShader=t.fragmentShader.replace("vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",`
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
    `)},r.customProgramCacheKey=()=>e.customProgramCacheKey()+"-milo-diffuse-toon-v2-"+o.name),r}function T(e,o,r){const t=new S({map:e.map,alphaMap:e.alphaMap,alphaTest:e.alphaTest,opacity:e.opacity,transparent:e.transparent,vertexColors:e.vertexColors,clippingPlanes:e.clippingPlanes,clipIntersection:e.clipIntersection,stencilWrite:!0,stencilRef:1});return t.name="Milo study ink",t.side=d(o)?M:x,t.toneMapped=!1,t.depthWrite=!1,t.forceSinglePass=!0,t.stencilFunc=y,t.stencilWriteMask=0,t.onBeforeCompile=(n,s)=>{n.vertexShader=f.standard.vertexShader,n.fragmentShader=f.standard.fragmentShader,e.onBeforeCompile(n,s),n.fragmentShader=n.fragmentShader.split("#include <alphahash_fragment>")[0]+`
      #include <alphahash_fragment>
      vec3 outgoingLight = inkColor;
      #include <opaque_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      #include <premultiplied_alpha_fragment>
      #include <dithering_fragment>
    }`;const p=new Set(["common","packing","dithering_pars_fragment","color_pars_fragment","uv_pars_fragment","map_pars_fragment","alphamap_pars_fragment","alphatest_pars_fragment","alphahash_pars_fragment","fog_pars_fragment","logdepthbuf_pars_fragment","clipping_planes_pars_fragment","clipping_planes_fragment","logdepthbuf_fragment","map_fragment","color_fragment","alphamap_fragment","alphatest_fragment","alphahash_fragment","opaque_fragment","colorspace_fragment","fog_fragment","premultiplied_alpha_fragment","dithering_fragment"]);n.fragmentShader=n.fragmentShader.replace(/#include <(\w+)>/g,(a,m)=>p.has(m)?a:""),n.vertexShader=n.vertexShader.replace(/#include <shadowmap_(pars_vertex|vertex)>/g,""),n.uniforms.inkViewport=r,n.uniforms.inkColor={value:new k(1647660)},n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
uniform vec2 inkViewport;`).replace("#include <project_vertex>",`
      #include <project_vertex>
      vec4 inkNormal = projectionMatrix * vec4(normalize(normalMatrix * objectNormal), 0.0);
      vec2 inkDirection = (inkNormal.xy * gl_Position.w - gl_Position.xy * inkNormal.w) * inkViewport;
      inkDirection /= max(length(inkDirection), 0.00001);
      gl_Position.xy += inkDirection * (2.0 * 1.2 / inkViewport) * gl_Position.w;
      gl_Position.z += 0.00002 * gl_Position.w;
    `),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 inkColor;`)},t.customProgramCacheKey=()=>e.customProgramCacheKey()+"-milo-unlit-ink-v2",t}function K(e){return g(B(e))}function*B(e){const o=[];e.traverse(a=>{a.isMesh&&o.push(a)});const r=[],t=[],n={value:new u(1,1)};let s=performance.now();for(const a of o){if(performance.now()-s>=4&&(yield,s=performance.now()),Array.isArray(a.material))continue;const m=a.material,i=D(m,a);if(a.material=i,r.push({mesh:a,source:m,material:i}),!w(a))continue;const l=T(m,a,n),c=a.isSkinnedMesh?new h(a.geometry,l):new _(a.geometry,l);c.name="Milo toon outline",c.frustumCulled=!1,c.renderOrder=a.renderOrder+1,c.matrixAutoUpdate=!1,c.matrix=a.matrix,c.raycast=()=>{},a.parent.add(c),t.push({source:a,outline:c})}function p(a=1,m=1){n.value.set(Math.max(1,a),Math.max(1,m));for(const{source:i,outline:l}of t)l.visible=i.visible,l.geometry=i.geometry,l.morphTargetDictionary=i.morphTargetDictionary,l.morphTargetInfluences=i.morphTargetInfluences,i.isSkinnedMesh&&(l.skeleton=i.skeleton,l.bindMode=i.bindMode,l.bindMatrix.copy(i.bindMatrix),l.bindMatrixInverse.copy(i.bindMatrixInverse))}return p(),{update:p,dispose(){t.forEach(({outline:a})=>{a.removeFromParent(),a.material.dispose()}),r.forEach(({mesh:a,source:m,material:i})=>{a.material=m,i.dispose()})}}}export{B as a,K as c};
