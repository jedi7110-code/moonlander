// Keep the original dark iron / reddish brass pipes, with matching warm backing.
export function finishServicePanels(root,m,habitation,bottom){
  const panels=[{x:-4.2,width:1.5,floor:habitation,name:'Bunk'},
    {x:1.65,width:1.2,floor:bottom,name:'Gym'}];
  const backing=m.dark.clone();backing.name='Study / service panel warm charcoal';
  // Match the cabin's warm structural iron without its darkening colour map.
  backing.map=null;
  backing.roughness=.85;backing.metalness=.18;backing.envMapIntensity=.3;
  // A small linear-light lift preserves the original hue, grime and reflection.
  const lift=source=>{const material=source.clone();material.color.multiplyScalar(1.18);return material;};
  const steel=lift(m.pipeSteel),brass=lift(m.brass),fastener=lift(m.metal);
  const near=(a,b)=>Math.abs(a-b)<1e-6;
  for(const {x,width,floor,name} of panels){
    for(const mesh of root.children){
      if(!mesh.isMesh)continue;
      const p=mesh.position;
      if(mesh.material===m.dark&&near(p.x,x)&&near(p.y,floor+1.95)&&near(p.z,-1.40)){
        mesh.name=`${name} service panel backing`;mesh.material=backing;continue;
      }
      if(mesh.geometry.type!=='CylinderGeometry'||Math.abs(p.x-x)>width/2+.05||
        Math.abs(p.z+1.23)>.07||p.y<floor+1.64||p.y>floor+2.22)continue;
      const shape=mesh.geometry.parameters;
      if(near(shape.radiusTop,.049)&&[m.pipeSteel,m.brass].includes(mesh.material)){
        mesh.name=`${name} service pipe`;mesh.material=mesh.material===m.brass?brass:steel;
      }else if(mesh.material===m.pipeSteel&&near(shape.radiusTop,.049*1.46)){
        mesh.name=`${name} service pipe flange`;mesh.material=steel;
      }else if(mesh.material===m.metal&&near(shape.radiusTop,.018)){
        mesh.name=`${name} service pipe fastener`;mesh.material=fastener;
      }
    }
  }
}
