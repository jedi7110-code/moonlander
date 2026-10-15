// A centimetre-scale inspection near plane wastes almost all depth precision
// when the same viewer is pulled back hundreds of metres. Keep it in front
// of the model's bounding box, while retaining close inspection inside it.
export function fitExteriorInspectionDepth(camera,target,bounds){
  const distance=camera.position.distanceTo(target),clearance=bounds.distanceToPoint(camera.position);
  const near=Math.max(.02,Math.min(40,distance/20,clearance>0?clearance/4:.1));
  if(Math.abs(camera.near-near)>1e-6){camera.near=near;camera.updateProjectionMatrix();}
}
