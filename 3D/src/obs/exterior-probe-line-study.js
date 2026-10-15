// Use A's exact geometry and UV layout. Re-ink only the seams already painted
// into the original 8×4 service sheet, preserving its wear and panel colours.
export function createProbeLineStudy(ship){
  const materials=new Map(),textures=new Map();
  ship.dockedLander.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material.name!=='Probe aged pressure panels')return;
    const material=mesh.material;if(materials.has(material))return;
    const source=material.map;materials.set(material,source);
    if(!source?.image||typeof document==='undefined'||textures.has(source))return;
    const canvas=document.createElement('canvas');canvas.width=source.image.width;canvas.height=source.image.height;
    const c=canvas.getContext('2d');c.drawImage(source.image,0,0);
    c.save();c.translate(0,512);c.strokeStyle='#4b5045';c.lineWidth=1.2;
    for(let row=0;row<4;row++)for(let col=0;col<8;col++)c.strokeRect(col*128+1,row*128+1,126,126);
    c.restore();
    const map=source.clone();map.source=new THREE.Source(canvas);map.needsUpdate=true;
    map.name='Probe A / existing panel seams in darker ink';textures.set(source,map);
  });
  return{
    setEnabled(enabled){for(const [material,source]of materials){material.map=enabled?(textures.get(source)??source):source;material.needsUpdate=true;}},
    dispose(){for(const [material,source]of materials){material.map=source;material.needsUpdate=true;}for(const map of textures.values())map.dispose();},
  };
}
import * as THREE from 'three';
