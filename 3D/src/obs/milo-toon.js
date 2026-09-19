import {BackSide,Color,DoubleSide,Mesh,MeshBasicMaterial,NotEqualStencilFunc,ReplaceStencilOp,ShaderChunk,ShaderLib,SkinnedMesh,Vector2} from 'three';

const INK_MESHES=new Set(['Continuous sample-based human body','Milo scanned head',
  'Continuous leather boot upper','Anatomical combat boot sole','Supplied hair cards','Supplied scalp']);
const isHair=mesh=>/^(Supplied |Milo hair |Milo groom )/.test(mesh.name);
const outlineMesh=mesh=>INK_MESHES.has(mesh.name)||isHair(mesh);

function copyMaterial(source){
  const material=source.clone();
  // These uniforms are driven by the live rig (bruises, mouth and appearance).
  material.userData={...source.userData};
  material.onBeforeCompile=(shader,renderer)=>source.onBeforeCompile(shader,renderer);
  material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-milo-study-mask-v1';
  material.stencilWrite=true;material.stencilRef=1;material.stencilZPass=ReplaceStencilOp;
  return material;
}

function toonMaterial(source,mesh){
  const material=copyMaterial(source);
  // Eyes and small glass/metal details retain their material response.
  if(!source.isMeshStandardMaterial||mesh.name==='Fitted Milo eye surface'||source.metalness>.5)return material;
  material.normalScale?.multiplyScalar(mesh.name==='Milo scanned head'?.10:.25);
  material.bumpScale*=.12;
  material.onBeforeCompile=(shader,renderer)=>{
    source.onBeforeCompile(shader,renderer);
    // Soften scan microdetail while retaining the face colors, lips and beard.
    if(mesh.name==='Milo scanned head')shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','texture2D( map, vMapUv, 1.5 )'));
    shader.fragmentShader=shader.fragmentShader.replace(
      'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',`
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
    `);
  };
  material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-milo-diffuse-toon-v2-'+mesh.name;
  return material;
}

function inkMaterial(source,mesh,viewport){
  // Ink needs deformation, alpha and cutouts, but no lights, BRDF or normal maps.
  const material=new MeshBasicMaterial({
    map:source.map,alphaMap:source.alphaMap,alphaTest:source.alphaTest,
    opacity:source.opacity,transparent:source.transparent,vertexColors:source.vertexColors,
    clippingPlanes:source.clippingPlanes,clipIntersection:source.clipIntersection,
    stencilWrite:true,stencilRef:1,
  });
  material.name='Milo study ink';material.side=isHair(mesh)?DoubleSide:BackSide;
  material.toneMapped=false;material.depthWrite=false;
  // Both faces blend the same constant ink: their order is immaterial.
  material.forceSinglePass=true;
  material.stencilFunc=NotEqualStencilFunc;material.stencilWriteMask=0;
  material.onBeforeCompile=(shader,renderer)=>{
    // Keep the original vertex folds, moving mouth, eye openings and neckline
    // discard so the silhouette matches the actual visible surface.
    shader.vertexShader=ShaderLib.standard.vertexShader;
    shader.fragmentShader=ShaderLib.standard.fragmentShader;
    source.onBeforeCompile(shader,renderer);
    // Retain source hooks through opacity/cutouts; later PBR chunks are unused.
    shader.fragmentShader=shader.fragmentShader.split('#include <alphahash_fragment>')[0]+`
      #include <alphahash_fragment>
      vec3 outgoingLight = inkColor;
      #include <opaque_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      #include <premultiplied_alpha_fragment>
      #include <dithering_fragment>
    }`;
    const inkChunks=new Set(['common','packing','dithering_pars_fragment','color_pars_fragment',
      'uv_pars_fragment','map_pars_fragment','alphamap_pars_fragment','alphatest_pars_fragment',
      'alphahash_pars_fragment','fog_pars_fragment','logdepthbuf_pars_fragment','clipping_planes_pars_fragment',
      'clipping_planes_fragment','logdepthbuf_fragment','map_fragment','color_fragment',
      'alphamap_fragment','alphatest_fragment','alphahash_fragment','opaque_fragment',
      'colorspace_fragment','fog_fragment','premultiplied_alpha_fragment','dithering_fragment']);
    shader.fragmentShader=shader.fragmentShader.replace(/#include <(\w+)>/g,(include,name)=>inkChunks.has(name)?include:'');
    shader.vertexShader=shader.vertexShader.replace(/#include <shadowmap_(pars_vertex|vertex)>/g,'');
    shader.uniforms.inkViewport=viewport;
    shader.uniforms.inkColor={value:new Color(0x19242c)};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nuniform vec2 inkViewport;').replace('#include <project_vertex>',`
      #include <project_vertex>
      vec4 inkNormal = projectionMatrix * vec4(normalize(normalMatrix * objectNormal), 0.0);
      vec2 inkDirection = (inkNormal.xy * gl_Position.w - gl_Position.xy * inkNormal.w) * inkViewport;
      inkDirection /= max(length(inkDirection), 0.00001);
      gl_Position.xy += inkDirection * (2.0 * 1.2 / inkViewport) * gl_Position.w;
      gl_Position.z += 0.00002 * gl_Position.w;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform vec3 inkColor;');
  };
  material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-milo-unlit-ink-v2';
  return material;
}

// Shared by the cabin and study; preserve the original materials, rig and geometry.
export function createMiloToon(root){
  const originals=[];root.traverse(mesh=>{if(mesh.isMesh)originals.push(mesh);});
  const replaced=[],outlines=[],viewport={value:new Vector2(1,1)};
  for(const mesh of originals){
    if(Array.isArray(mesh.material))continue;
    const source=mesh.material,material=toonMaterial(source,mesh);
    mesh.material=material;replaced.push({mesh,source,material});
    if(!outlineMesh(mesh))continue;
    const ink=inkMaterial(source,mesh,viewport);
    const outline=mesh.isSkinnedMesh?new SkinnedMesh(mesh.geometry,ink):new Mesh(mesh.geometry,ink);
    outline.name='Milo toon outline';outline.frustumCulled=false;
    outline.renderOrder=mesh.renderOrder+1;
    outline.matrixAutoUpdate=false;outline.matrix=mesh.matrix;outline.raycast=()=>{};
    mesh.parent.add(outline);outlines.push({source:mesh,outline});
  }
  function update(width=1,height=1){
    viewport.value.set(Math.max(1,width),Math.max(1,height));
    for(const {source,outline} of outlines){
      outline.visible=source.visible;outline.geometry=source.geometry;
      outline.morphTargetDictionary=source.morphTargetDictionary;
      outline.morphTargetInfluences=source.morphTargetInfluences;
      if(source.isSkinnedMesh){
        outline.skeleton=source.skeleton;outline.bindMode=source.bindMode;
        outline.bindMatrix.copy(source.bindMatrix);outline.bindMatrixInverse.copy(source.bindMatrixInverse);
      }
    }
  }
  update();
  return {update,dispose(){
    outlines.forEach(({outline})=>{outline.removeFromParent();outline.material.dispose();});
    replaced.forEach(({mesh,source,material})=>{mesh.material=source;material.dispose();});
  }};
}
