// A centimetre-scale inspection near plane wastes almost all depth precision
// when the same viewer is pulled back kilometres. Keep it in front
// of the model's bounding box, while retaining close inspection inside it.
export function fitExteriorInspectionDepth(camera,target,bounds){
  const distance=camera.position.distanceTo(target),clearance=bounds.distanceToPoint(camera.position);
  const inspectionNear=Math.min(80,distance/16,clearance>0?clearance/4:.1);
  // At kilometre ranges, raise the near plane with distance squared to retain
  // small surface offsets. Half the model clearance keeps the hull safely ahead.
  const distantNear=clearance>0?Math.min(clearance/2,distance*distance/20000):0;
  const near=Math.max(.02,inspectionNear,distantNear);
  if(Math.abs(camera.near-near)>1e-6){camera.near=near;camera.updateProjectionMatrix();}
}
