import * as THREE from 'three';

// Stable panels let the same tear open, peel away and fall on every replay.
// Displacement after skinning makes loose cloth fall down even on a bent torso.
export function createTearingClothes(root,spread,hookMaterial){
  const skin=root.userData.bodySkin,lining=skin.clone();
  lining.name='Curtis tearing tee and trousers';lining.material=skin.material.clone();
  lining.material.onBeforeCompile=skin.material.onBeforeCompile;
  lining.material.customProgramCacheKey=skin.material.customProgramCacheKey;
  lining.geometry=skin.geometry.clone();lining.skeleton=skin.skeleton;
  lining.bindMatrix.copy(skin.bindMatrix);lining.bindMatrixInverse.copy(skin.bindMatrixInverse);
  skin.parent.add(lining);
  const clothes=[root.getObjectByName('Open space-print aloha shirt'),root.getObjectByName('Aloha untucked long hem'),lining].filter(Boolean);
  for(const cloth of clothes){
    const hem=cloth.name.includes('hem'),inner=cloth===lining;
    const source=cloth.geometry,geometry=source.index?source.toNonIndexed():source.clone();
    const pos=geometry.attributes.position,arms=geometry.attributes.armRegion,panels=new Float32Array(pos.count*4);
    for(let i=0;i<pos.count;i+=3){
      let x=0,y=0,z=0,arm=0;
      for(let j=0;j<3;j++){x+=pos.getX(i+j)/3;y+=pos.getY(i+j)/3;z+=pos.getZ(i+j)/3;arm+=(arms?.getX(i+j)??0)/3;}
      const cx=Math.round(x/.095)*.095,cy=Math.round(y/.135)*.135,cz=Math.round(z/.10)*.10;
      const torso=.06+Math.abs(cx+.19)*.42+Math.max(0,1.44-cy)*.52;
      const leg=.38+Math.max(0,.98-cy)*.42+THREE.MathUtils.smoothstep(cx,-.04,.10)*.10;
      const threshold=THREE.MathUtils.lerp(THREE.MathUtils.lerp(torso,leg,1-THREE.MathUtils.smoothstep(cy,.94,1.04)),.30+Math.max(0,1.48-cy)*.38,arm*THREE.MathUtils.smoothstep(cx,.08,.18));
      const seed=(Math.sin(cx*172.1+cy*319.7+cz*89.3)*43758.5453)%1;
      for(let j=0;j<3;j++)panels.set([cx,cz,threshold,Math.abs(seed)],(i+j)*4);
    }
    geometry.setAttribute('tearPanel',new THREE.Float32BufferAttribute(panels,4));cloth.geometry=geometry;
    cloth.frustumCulled=false;cloth.material.side=THREE.DoubleSide;
    hookMaterial(cloth.material,`tearing-panels-${hem}-${inner}`,shader=>{
      shader.uniforms.clothSpread=spread;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        uniform float clothSpread;attribute vec4 tearPanel;varying float vTearProgress;varying float vTearSeed;varying vec3 vTearPoint;`)
        .replace('#include <begin_vertex>',`#include <begin_vertex>
        vTearProgress=max(clamp((clothSpread-tearPanel.z+.015)/.30,0.,1.),smoothstep(.76,.98,clothSpread));
        vTearSeed=tearPanel.w;vTearPoint=position;
        float stretch=smoothstep(0.,.32,vTearProgress);
        transformed+=normal*(.003+stretch*.040);`)
        .replace('#include <skinning_vertex>',`#include <skinning_vertex>
        float peel=smoothstep(.12,.60,vTearProgress),fall=smoothstep(.35,1.,vTearProgress);
        vec2 outward=normalize(vec2(tearPanel.x,tearPanel.y)+vec2(.0001));
        float flutter=sin(vTearProgress*17.+vTearSeed*6.)*.016*peel;
        transformed.x+=outward.x*(peel*.12+fall*.11)+flutter;
        transformed.z+=outward.y*peel*.13+flutter*(.5+vTearSeed);
        transformed.y-=fall*fall*(.34+vTearSeed*.24);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying float vTearProgress;varying float vTearSeed;varying vec3 vTearPoint;`)
        .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        ${inner?'if(vTearProgress<.025)discard;':''}
        float fray=.5+.5*sin(vTearPoint.x*317.+vTearSeed*41.)*sin(vTearPoint.y*289.+vTearPoint.z*311.);
        if(vTearProgress>.985||(vTearProgress>.76&&fray<smoothstep(.76,1.,vTearProgress)))discard;`);
      if(inner)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        if(max(shirt,trousers)<.5||vBodyPosition.y<.20)discard;`);
    });
    // Loose fragments are brief and thin; avoid casting the intact garment's
    // original shadow after its visible panels have already torn away.
    cloth.castShadow=false;
  }
  return {update(progress){clothes.forEach(cloth=>{
    cloth.visible=progress<.985&&(cloth!==lining||progress>.005);cloth.castShadow=false;
  });}};
}
