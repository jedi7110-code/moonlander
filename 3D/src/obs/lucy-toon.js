import {BackSide,Color,Mesh,MeshToonMaterial,NotEqualStencilFunc,ReplaceStencilOp,ShaderMaterial,SkinnedMesh,Vector2} from 'three';

const KEEP_GLOSS=new Set(['Hazel iris','Pupils and eye margin','Whiskers','Sleeping eyelid crease']);

function toonMaterial(source,thresholds){
  const material=new MeshToonMaterial({
    name:source.name,color:source.color,map:source.map,vertexColors:source.vertexColors,
    side:source.side,transparent:source.transparent,opacity:source.opacity,
    alphaMap:source.alphaMap,alphaTest:source.alphaTest,depthWrite:source.depthWrite,
    clippingPlanes:source.clippingPlanes,clipShadows:source.clipShadows,
  });
  // Mask the visible coat so concave joints cannot expose the ink shell inside
  // the animal. Only the outside silhouette and the gaps between limbs get ink.
  if(source.name==='Lucy calico coat'){
    material.stencilWrite=true;material.stencilRef=1;material.stencilZPass=ReplaceStencilOp;
  }
  // Quantize the combined lighting once so cabin lamps do not wash out the bands.
  material.onBeforeCompile=shader=>{
    shader.uniforms.toonThresholds={value:new Vector2(...thresholds)};
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_toon_pars_fragment>',`
      varying vec3 vViewPosition;
      uniform vec2 toonThresholds;
      struct ToonMaterial { vec3 diffuseColor; };
      void RE_Direct_Toon(const in IncidentLight light, const in GeometricContext geometry,
        const in ToonMaterial material, inout ReflectedLight reflectedLight) {
        reflectedLight.directDiffuse += saturate(dot(geometry.normal, light.direction)) * light.color * RECIPROCAL_PI;
      }
      void RE_IndirectDiffuse_Toon(const in vec3 irradiance, const in GeometricContext geometry,
        const in ToonMaterial material, inout ReflectedLight reflectedLight) {
        reflectedLight.indirectDiffuse += irradiance * RECIPROCAL_PI;
      }
      #define RE_Direct RE_Direct_Toon
      #define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
    `).replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`
      vec3 light = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
      float value = dot(light, vec3(0.2126, 0.7152, 0.0722));
      float edge = max(fwidth(value), 0.012);
      float middle = smoothstep(toonThresholds.x-edge, toonThresholds.x+edge, value);
      float bright = smoothstep(toonThresholds.y-edge, toonThresholds.y+edge, value);
      vec3 shade = mix(vec3(0.34, 0.39, 0.46), vec3(0.69, 0.71, 0.73), middle);
      shade = mix(shade, vec3(1.12, 1.09, 1.02), bright);
      vec3 outgoingLight = diffuseColor.rgb * shade + totalEmissiveRadiance;
    `);
  };
  material.customProgramCacheKey=()=> 'lucy-cabin-toon-v1';
  return material;
}

function outlineMaterial(clippingPlanes){
  return new ShaderMaterial({
    name:'Lucy ink outline',side:BackSide,toneMapped:false,
    clipping:true,clippingPlanes,depthWrite:false,
    stencilWrite:true,stencilRef:1,stencilFunc:NotEqualStencilFunc,stencilWriteMask:0,
    uniforms:{ink:{value:new Color(0x19242c)},viewport:{value:new Vector2(1,1)},width:{value:1.2}},
    vertexShader:`
      #include <common>
      #include <morphtarget_pars_vertex>
      #include <skinning_pars_vertex>
      #include <clipping_planes_pars_vertex>
      uniform vec2 viewport;
      uniform float width;
      void main(){
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        #include <clipping_planes_vertex>
        vec4 projectedNormal = projectionMatrix * vec4(normalize(normalMatrix * objectNormal), 0.0);
        vec2 direction = (projectedNormal.xy * gl_Position.w - gl_Position.xy * projectedNormal.w) * viewport;
        direction /= max(length(direction), 0.00001);
        gl_Position.xy += direction * (2.0 * width / viewport) * gl_Position.w;
        gl_Position.z += 0.00002 * gl_Position.w;
      }
    `,
    fragmentShader:`
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 ink;
      void main(){
        #include <clipping_planes_fragment>
        gl_FragColor = vec4(ink, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Install after the approved rig is built; preserve geometry and animation data.
export function createLucyToon(root,{thresholds=[.46,.86]}={}){
  const meshes=[];root.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
  const materials=new Map(),replaced=[],outlines=[];
  for(const mesh of meshes){
    const source=mesh.material;
    if(KEEP_GLOSS.has(source.name))continue;
    if(!materials.has(source))materials.set(source,toonMaterial(source,thresholds));
    mesh.material=materials.get(source);replaced.push({mesh,source});
    // Ink only the continuous body, not eyes, whiskers or fitted paw pads.
    if(source.name!=='Lucy calico coat')continue;
    const ink=outlineMaterial(source.clippingPlanes);
    const outline=mesh.isSkinnedMesh?new SkinnedMesh(mesh.geometry,ink):new Mesh(mesh.geometry,ink);
    outline.name='Lucy toon outline';outline.frustumCulled=false;
    outline.renderOrder=mesh.renderOrder+1;
    outline.matrixAutoUpdate=false;outline.matrix=mesh.matrix;
    outline.raycast=()=>{};
    mesh.parent.add(outline);outlines.push({source:mesh,outline});
  }
  function update(width=1,height=1){
    for(const {source,outline} of outlines){
      outline.visible=source.visible;outline.geometry=source.geometry;
      outline.morphTargetInfluences=source.morphTargetInfluences;
      outline.morphTargetDictionary=source.morphTargetDictionary;
      if(source.isSkinnedMesh){
        outline.skeleton=source.skeleton;outline.bindMode=source.bindMode;
        outline.bindMatrix.copy(source.bindMatrix);outline.bindMatrixInverse.copy(source.bindMatrixInverse);
      }
      outline.material.uniforms.viewport.value.set(Math.max(1,width),Math.max(1,height));
    }
  }
  update();
  return {update,dispose(){
    outlines.forEach(({outline})=>{outline.removeFromParent();outline.material.dispose();});
    replaced.forEach(({mesh,source})=>mesh.material=source);
    materials.forEach(material=>material.dispose());
  }};
}
