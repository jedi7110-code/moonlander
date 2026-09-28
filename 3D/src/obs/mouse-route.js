import {CurvePath,LineCurve3,QuadraticBezierCurve3,Vector3} from 'three';

// Each crossing begins and ends behind an existing rear-wall fixture. Rounded
// corners stay inside the furniture gaps instead of overshooting like a spline.
const POINTS=[
  // Operations: behind the console bank, around the chairs, back behind it.
  [[-10.75,-1.38],[-11.35,-1.38],[-11.35,1.35],[-5.85,1.35],[-5.85,-1.38],[-6.65,-1.38]],
  // Habitation: the gaps on either side of the lounge sofa.
  [[5.8,-.78],[4.95,-.78],[4.95,.60],[9.645,.60],[9.645,-.78],[9.2,-.78]],
  // Life support: between the galley, vegetable rack and its control cabinet.
  [[-8.95,-1.4],[-8.49,-1.4],[-8.49,-.22],[-5.425,-.22],[-5.425,-1.42],[-6,-1.42]],
];

export const MOUSE_ROUTES=POINTS.map(points=>{
  const vertices=points.map(([x,z])=>new Vector3(x,0,z)),curve=new CurvePath();
  let previous=vertices[0];
  for(let i=1;i<vertices.length-1;i++){
    const p=vertices[i],before=vertices[i-1],after=vertices[i+1];
    const radius=Math.min(.12,p.distanceTo(before)/3,p.distanceTo(after)/3);
    const entry=p.clone().add(before.clone().sub(p).normalize().multiplyScalar(radius));
    const exit=p.clone().add(after.clone().sub(p).normalize().multiplyScalar(radius));
    curve.add(new LineCurve3(previous,entry));curve.add(new QuadraticBezierCurve3(entry,p,exit));
    previous=exit;
  }
  curve.add(new LineCurve3(previous,vertices.at(-1)));curve.arcLengthDivisions=1200;
  const length=curve.getLength(),center=(vertices[0].x+vertices.at(-1).x)/2;
  const sample=(distance,direction=1)=>{
    const u=Math.max(0,Math.min(1,distance/length)),t=direction===1?u:1-u;
    const p=curve.getPointAt(t),tangent=curve.getTangentAt(t).multiplyScalar(direction);
    return {x:p.x-center,z:p.z,yaw:Math.atan2(tangent.x,tangent.z)};
  };
  return {length,center,sample,noticeDistance:1.65,
    stopX:direction=>sample(length,direction).x*direction-.65};
});
