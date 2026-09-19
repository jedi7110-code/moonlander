import {BackSide,Color,DoubleSide,Mesh,MeshToonMaterial,ShaderMaterial,Vector2} from 'three';

const KEEP_GLOSS=new Set(['Industrial / wet chain','Industrial / wet floor']);
const keepSurface=material=>material.userData.cabinKeepSurface===true;
const eligible=material=>material.isMeshStandardMaterial&&!material.transparent&&!KEEP_GLOSS.has(material.name)&&!material.isMeshPhysicalMaterial;

// Full ship = 0px; 2.5x zoom and closer = 1 CSS px. Ease both ends.
function outlineWidth(viewHeight,fullHeight){
  const t=Math.min(1,Math.max(0,(fullHeight/viewHeight-1)/1.5));
  return t*t*(3-2*t);
}

function toonMaterial(source){
  const material=new MeshToonMaterial({
    name:'Cabin toon / '+source.name,color:source.color,map:source.map,vertexColors:source.vertexColors,
    side:source.side,alphaMap:source.alphaMap,alphaTest:source.alphaTest,
    emissive:source.emissive,emissiveMap:source.emissiveMap,emissiveIntensity:source.emissiveIntensity,
    lightMap:source.lightMap,lightMapIntensity:source.lightMapIntensity,
    clippingPlanes:source.clippingPlanes,depthWrite:source.depthWrite,
  });
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_toon_pars_fragment>',`
      varying vec3 vViewPosition;
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
      float light = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));
      float edge = max(fwidth(light), 0.015);
      // Lift shadow and midtone bands gently; keep highlights and ink intact.
      vec3 shade = mix(vec3(0.47, 0.51, 0.55), vec3(0.82, 0.85, 0.83), smoothstep(0.58-edge, 0.58+edge, light));
      shade = mix(shade, vec3(1.10, 1.07, 1.00), smoothstep(1.04-edge, 1.04+edge, light));
      vec3 outgoingLight = diffuseColor.rgb * shade + totalEmissiveRadiance;
    `);
  };
  material.customProgramCacheKey=()=> 'cabin-study-bands-v2';
  return material;
}

function inkMaterial(){
  return new ShaderMaterial({name:'Cabin study ink',side:BackSide,toneMapped:false,depthWrite:false,
    clipping:true,uniforms:{viewport:{value:new Vector2(1,1)},ink:{value:new Color(0x18231f)},width:{value:1}},
    vertexShader:`
      #include <common>
      #include <clipping_planes_pars_vertex>
      uniform vec2 viewport; uniform float width;
      void main(){
        #include <beginnormal_vertex>
        #include <begin_vertex>
        #include <project_vertex>
        #include <clipping_planes_vertex>
        vec4 n = projectionMatrix * vec4(normalize(normalMatrix * objectNormal), 0.0);
        vec2 direction = (n.xy * gl_Position.w - gl_Position.xy * n.w) * viewport;
        direction /= max(length(direction), 0.00001);
        gl_Position.xy += direction * (2.0 * width / viewport) * gl_Position.w;
        gl_Position.z += 0.00003 * gl_Position.w;
      }`,
    fragmentShader:`
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 ink;
      void main(){
        #include <clipping_planes_fragment>
        gl_FragColor=vec4(ink,1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function createCabinToon(roots){
  const originals=[],materials=new Map(),outlines=[],ink=inkMaterial();
  for(const root of roots){root.updateMatrixWorld(true);root.traverse(mesh=>{if(mesh.isMesh)originals.push({mesh,source:mesh.material});});}
  for(const {mesh,source} of originals){
    if(Array.isArray(source))continue;
    const keep=keepSurface(source);
    if(!eligible(source)&&!keep)continue;
    if(!keep&&!materials.has(source))materials.set(source,toonMaterial(source));
    // Do not ink transparent panes, luminous lenses, thin cables or leaf cards.
    if(source.side===DoubleSide||source.emissiveIntensity>1||/cable|rubber|rope/i.test(source.name)||mesh.isSkinnedMesh||source.alphaTest>0)continue;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    // The static cabin is already batched by material. Moving small details stay clean.
    const box=mesh.geometry.boundingBox,scale=mesh.matrixWorld.elements;
    const extent=Math.max((box.max.x-box.min.x)*Math.hypot(scale[0],scale[1],scale[2]),
      (box.max.y-box.min.y)*Math.hypot(scale[4],scale[5],scale[6]),
      (box.max.z-box.min.z)*Math.hypot(scale[8],scale[9],scale[10]));
    if(extent<.24)continue;
    const shell=new Mesh(mesh.geometry,ink);shell.name='Cabin toon outline';shell.matrixAutoUpdate=false;
    shell.matrix=mesh.matrix;shell.renderOrder=mesh.renderOrder+1;shell.raycast=()=>{};
    mesh.parent.add(shell);outlines.push({mesh,shell});
  }
  let mode='current';
  function setStyle(next){
    if(!['current','cartoon','flat'].includes(next))return;
    mode=next;
    for(const {mesh,source} of originals)mesh.material=mode==='current'?source:(materials.get(source)??source);
    update();
  }
  function update(width,height,viewHeight,fullHeight){
    if(width&&height)ink.uniforms.viewport.value.set(width,height);
    if(viewHeight>0&&fullHeight>0)ink.uniforms.width.value=outlineWidth(viewHeight,fullHeight);
    // A zero-width shell must not add draw calls or darken open geometry.
    for(const {mesh,shell} of outlines){shell.visible=mode==='cartoon'&&ink.uniforms.width.value>1e-6&&mesh.visible;shell.geometry=mesh.geometry;}
  }
  setStyle('current');
  return {setStyle,update,get width(){return mode==='cartoon'?ink.uniforms.width.value:0;},dispose(){
    for(const {mesh,source} of originals)mesh.material=source;
    outlines.forEach(({shell})=>shell.removeFromParent());materials.forEach(material=>material.dispose());ink.dispose();
  }};
}
