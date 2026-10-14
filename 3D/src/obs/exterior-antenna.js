import * as THREE from 'three';

// A closed, thin paraboloid: the rim rises above the vertex and the feed
// looks back into the concave face from the focal point, f = r² / (4d).
export function createParabolicAntenna({radius,depth,material,structureMaterial,feedMaterial,name='Directional communications antenna'}){
  const group=new THREE.Group();group.name=name;group.userData.bakeBoundary=true;
  const thickness=Math.min(.018,radius*.035),profile=[];
  for(let i=0;i<=10;i++){const r=radius*i/10;profile.push(new THREE.Vector2(r,depth*(r/radius)**2-thickness));}
  for(let i=10;i>=0;i--){const r=radius*i/10;profile.push(new THREE.Vector2(r,depth*(r/radius)**2));}
  const reflector=new THREE.Mesh(new THREE.LatheGeometry(profile,24),material);reflector.name='Concave parabolic reflector';group.add(reflector);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(radius,thickness*.6,5,24),structureMaterial);rim.name='Reflector edge';rim.rotation.x=Math.PI/2;rim.position.y=depth;group.add(rim);
  const mount=new THREE.Mesh(new THREE.CylinderGeometry(radius*.18,radius*.18,.09,12),structureMaterial);mount.name='Antenna mast coupling';mount.position.y=-.045;group.add(mount);
  const focus=radius*radius/(4*depth),feedLength=radius*.24;
  const feed=new THREE.Mesh(new THREE.CylinderGeometry(radius*.075,radius*.115,feedLength,12,1,true),feedMaterial);feed.name='Feed horn toward reflector';feed.position.y=focus+feedLength/2;group.add(feed);
  const mouth=new THREE.Mesh(new THREE.CircleGeometry(radius*.10,12),feedMaterial);mouth.name='Feed aperture';mouth.rotation.x=Math.PI/2;mouth.position.y=focus;group.add(mouth);
  for(let i=0;i<3;i++){
    const angle=i*2*Math.PI/3,start=new THREE.Vector3(Math.cos(angle)*radius,depth,Math.sin(angle)*radius),end=new THREE.Vector3(0,focus+feedLength*.75,0),direction=end.clone().sub(start);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(radius*.017,radius*.017,direction.length(),8),structureMaterial);arm.name='Feed support strut';arm.position.copy(start).add(end).multiplyScalar(.5);arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());group.add(arm);
  }
  group.userData.antenna={radius,depth,focus};return group;
}
