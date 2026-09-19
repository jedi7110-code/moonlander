import {MeshPhysicalMaterial,DoubleSide} from 'three';

// A separate, untextured glaze: never inherit the ship's painted-wall maps.
export const whiteCeramic=new MeshPhysicalMaterial({
  name:'Study / white porcelain',color:0xffffff,metalness:0,roughness:.22,
  clearcoat:.4,clearcoatRoughness:.16,envMapIntensity:.30,
});

export function finishStaticCups(root){
  const loungeCup=root.getObjectByName('Table cup');
  if(loungeCup)loungeCup.material=whiteCeramic;
  const kitchen=root.getObjectByName('Kitchen station');
  // Omit the original station's small plain cup at the far left.
  const cup=kitchen?.children.find(mesh=>mesh.isMesh&&mesh.geometry.type==='CylinderGeometry'&&
    mesh.position.x===-11.50&&mesh.position.y===1.13&&mesh.position.z===-.02);
  if(cup){cup.removeFromParent();cup.geometry.dispose();}
}

export function finishCabinFixtures(view){
  // Both the resting cup and Milo's held copy use the same clean ceramic.
  const mugs=[...Object.values(view.ship.diningDocks).map(dock=>dock.mug),view.milo.userData.dining?.mug];
  for(const mug of mugs)if(mug)mug.traverse(mesh=>{
    if(mesh.isMesh&&mesh.name!=='Cup liquid surface')mesh.material=whiteCeramic;
  });

  const rack=view.ship.plants;
  const backing=rack.root.children.find(mesh=>mesh.isMesh&&mesh.position.x===0&&
    mesh.position.y===1.27&&mesh.position.z===-1.03);
  if(backing){
    backing.name='Study / ivory grow-rack backing';
    backing.material=new MeshPhysicalMaterial({name:'Study / grow-rack ivory',
      color:0xcbd0bd,metalness:0,roughness:.65,envMapIntensity:.18,
      emissive:0xe7eddc,emissiveIntensity:.025});
  }
  const greens=[0x528d27,0x3f7830,0x669539];
  rack.rows.forEach((row,index)=>{
    // Retain actual area-light shading on leaf surfaces; the cabin toon shader
    // does not implement RectAreaLight. No additional lights are introduced.
    const leafMaterial=new MeshPhysicalMaterial({name:`Study / lit greens ${index+1}`,
      color:greens[index],roughness:.72,metalness:0,envMapIntensity:.14,side:DoubleSide,
      emissive:greens[index],emissiveIntensity:.035});
    const sources=new Set();
    for(const plant of row.plants)plant.traverse(mesh=>{
      if(mesh.isMesh&&mesh.material.side===DoubleSide)sources.add(mesh.material);
    });
    for(const plant of row.plants)plant.traverse(mesh=>{
      if(mesh.isMesh&&sources.has(mesh.material))mesh.material=leafMaterial;
    });
    row.growLight.color.setHex(0xf4ffe8);row.growLight.intensity=3.8;
  });
  rack.root.traverse(mesh=>{
    if(mesh.isMesh&&mesh.material.name==='Full-spectrum grow diffuser')mesh.material.color.setHex(0xf4ffe8);
  });
}
