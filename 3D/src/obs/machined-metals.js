import * as THREE from 'three';
import {GYM} from './layout.js';

export function createMachinedMetals(){
  // Shared fine tool marks, filtered down naturally at wider camera views.
  const width=128,height=128,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const grain=.62+.20*Math.sin(y*2.37)+.065*Math.sin(y*.51+x*.047);
    const value=Math.round(255*grain),offset=(y*width+x)*4;
    data[offset]=data[offset+1]=data[offset+2]=value;data[offset+3]=255;
  }
  const grain=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(2,6);
  grain.generateMipmaps=true;grain.minFilter=THREE.LinearMipmapLinearFilter;
  grain.magFilter=THREE.LinearFilter;grain.anisotropy=4;grain.needsUpdate=true;
  const make=(name,color,roughness,intensity)=>{
    const material=new THREE.MeshPhysicalMaterial({name,color,metalness:.94,roughness,
      roughnessMap:grain,bumpMap:grain,bumpScale:.00035,envMapIntensity:intensity,
      anisotropy:.3,anisotropyRotation:Math.PI/2});
    // This Three.js revision needs an explicit UV varying for anisotropy.
    material.defines.USE_UV='';
    material.userData.cabinKeepSurface=true;return material;
  };
  return {
    shell:make('Study / smoked titanium',0x737c7e,.58,.65),
    alloy:make('Study / machined aluminium',0x929b9e,.43,.75),
  };
}

export function finishMachinedFixtures(root,m,metals){
  // The three wall-racked dumbbells are separate meshes in the source ship.
  const rackX=(GYM.x-700)*.022-.70;
  for(const mesh of root.children){
    if(!mesh.isMesh||mesh.geometry.type!=='CylinderGeometry'||
      mesh.position.z!==-1.1||Math.abs(mesh.position.x-rackX)>.17||
      ![.69,.97,1.25].some(y=>Math.abs(mesh.position.y-y)<1e-6))continue;
    const shape=mesh.geometry.parameters;
    if(mesh.material===m.black&&shape.radiusTop===.085&&shape.height===.08){
      mesh.name='Machined dumbbell weight';mesh.material=metals.shell;
    }else if(mesh.material===m.metal&&shape.radiusTop===.024&&Math.abs(shape.height-.32)<1e-6){
      mesh.name='Machined dumbbell grip';mesh.material=metals.alloy;
    }
  }
  root.traverse(group=>{
    if(group.name.startsWith('Cat passage deck ')){
      for(const mesh of group.children){
        if(!mesh.isMesh)continue;
        if(mesh.material===m.metal&&mesh.geometry.type==='ExtrudeGeometry'){
          mesh.name='Machined cat passage frame';mesh.material=metals.shell;
        }else if(mesh.material===m.dark&&mesh.position.x===0&&mesh.position.z===.13){
          mesh.name='Machined cat passage sill';mesh.material=metals.shell;
        }else if(mesh.material===m.dark&&mesh.position.z===.111){
          mesh.name='Machined cat passage fastener';mesh.material=metals.alloy;
        }
      }
    }
    if(group.name==='Kitchen station'){
      for(const mesh of group.children){
        if(!mesh.isMesh)continue;
        if(mesh.material===m.dark&&mesh.position.x===-9.3&&
          mesh.position.y===1.075&&mesh.position.z===-.29){
          mesh.name='Machined kitchen sink';mesh.material=metals.shell;
        }else if(mesh.material===m.metal&&mesh.geometry.type==='TubeGeometry'&&
          mesh.geometry.parameters.path.points[0].x===-9.3){
          mesh.name='Machined kitchen faucet';mesh.material=metals.alloy;
        }
      }
    }
    if(group.name==='Washing machine'||group.name==='Dryer'){
      for(const mesh of group.children){
        if(!mesh.isMesh)continue;
        if(mesh.material===m.enamel)mesh.material=metals.shell;
        else if(mesh.material===m.metal)mesh.material=metals.alloy;
      }
    }
    if(group.name!=='Octagonal gate and rear room')return;
    const frame=group.getObjectByName('Eight-sided gate frame');
    if(frame){
      frame.material=metals.shell;
      // Cut the bevel into the existing frame so the doorway and wall reveals
      // retain their clearances instead of growing into adjacent surfaces.
      const old=frame.geometry,{shapes,options}=old.parameters;
      const bevel=.007;
      frame.geometry=new THREE.ExtrudeGeometry(shapes,{...options,depth:options.depth-2*bevel,
        bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelOffset:-bevel,bevelSegments:2});
      frame.geometry.translate(0,0,bevel);
      old.dispose();
    }
    for(const mesh of group.children){
      const geometry=mesh.geometry;
      if(mesh.isMesh&&mesh.material===m.dark&&geometry.type==='CylinderGeometry'&&
        geometry.parameters.radiusTop===.026&&geometry.parameters.radialSegments===6){
        mesh.name='Machined gate frame bolt';mesh.material=metals.alloy;
      }
    }
  });
}
