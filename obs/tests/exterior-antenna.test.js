import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createParabolicAntenna} from '../src/obs/exterior-antenna.js';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';
import {createProductionExterior} from '../src/obs/exterior-production.js';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
test('the reflector is concave toward the feed and the feed aperture faces the bowl',()=>{
  const material=new THREE.MeshStandardMaterial();
  try{for(const radius of [.36,.38,.7]){
    const depth=radius*.30,antenna=createParabolicAntenna({radius,depth,material,structureMaterial:material,feedMaterial:material});antenna.updateMatrixWorld(true);
    const reflector=antenna.getObjectByName('Concave parabolic reflector');
    const surfaceY=x=>{
      const ray=new THREE.Raycaster(new THREE.Vector3(x,1,0),new THREE.Vector3(0,-1,0),0,2),hit=ray.intersectObject(reflector)[0];assert.ok(hit);return hit.point.y;
    };
    assert.ok(surfaceY(radius*.85)>surfaceY(radius*.10)+depth*.6,'the rim is above the center, rather than a convex umbrella');
    const aperture=antenna.getObjectByName('Feed aperture'),direction=new THREE.Vector3(0,0,1).applyQuaternion(aperture.quaternion);
    assert.ok(direction.dot(aperture.position.clone().negate().normalize())>.999,'the feed looks back into the reflector');
    assert.ok(Math.abs(aperture.position.y-radius*radius/(4*depth))<1e-10,'the feed aperture sits at the paraboloid focus');
    antenna.traverse(mesh=>mesh.geometry?.dispose());
  }}finally{material.dispose();}
});

test('the feed horn has an opaque rear cap and its mast coupling stays behind the reflector face',()=>{
  const material=new THREE.MeshStandardMaterial();
  try{for(const radius of [.36,.38,.7]){
    const depth=radius*.30,antenna=createParabolicAntenna({radius,depth,material,structureMaterial:material,feedMaterial:material});
    try{
      antenna.updateMatrixWorld(true);
      const {focus}=antenna.userData.antenna;
      const origin=new THREE.Vector3(0,focus+radius*.24+.1,0);
      const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,.2).intersectObject(antenna,true)[0];
      assert.ok(hit,'the horn cannot be transparent when viewed from behind');
      assert.equal(hit.object.name,'Closed feed horn rear');
      assert.ok(Math.abs(hit.distance-.1)<1e-6);
      const coupling=antenna.getObjectByName('Antenna mast coupling'),positions=coupling.geometry.attributes.position;
      for(let index=0;index<positions.count;index++){
        const point=new THREE.Vector3().fromBufferAttribute(positions,index).applyMatrix4(coupling.matrix);
        assert.ok(point.y<depth*(point.x**2+point.z**2)/(radius**2)-.002,'the coupling never reaches the inner reflecting surface');
      }
    }finally{antenna.traverse(mesh=>mesh.geometry?.dispose());}
  }}finally{material.dispose();}
});

test('mothership yokes and probe support never protrude through the centre of a tilted dish',()=>{
  const ship=createExteriorShip();
  try{
    ship.root.updateMatrixWorld(true);
    const antennas=[],surfaces=[];
    ship.root.traverse(object=>{
      if(object.userData.antenna)antennas.push(object);
      if(object.isMesh&&!object.material.transparent)surfaces.push(object);
    });
    assert.equal(antennas.length,3);
    for(const antenna of antennas){
      const expected=antenna.name.startsWith('Mothership')?'Worn insulation':'Replacement panel';
      const radius=antenna.userData.antenna.radius*.06;
      for(let index=0;index<6;index++){
        const angle=index*Math.PI/3;
        const origin=antenna.localToWorld(new THREE.Vector3(Math.cos(angle)*radius,.06,Math.sin(angle)*radius));
        const direction=new THREE.Vector3(0,-1,0).transformDirection(antenna.matrixWorld);
        const hit=new THREE.Raycaster(origin,direction,0,.18).intersectObjects(surfaces,false)[0];
        assert.equal(hit?.object.material.name,expected,'only the reflector is visible below the intentional feed horn and struts');
      }
    }
  }finally{ship.dispose();}
});

test('mothership dishes sit on low bolted foundations with two-sided elevation bearings rather than a bare stalk',()=>{
  const ship=createExteriorMothership();
  try{
    const antennas=[],foundations=[],structure=[];
    ship.machinery.traverse(object=>{
      if(object.userData.antenna)antennas.push(object);
      if(object.name==='Bolted antenna azimuth and elevation mount')foundations.push(object);
      if(object.isMesh&&['Unpainted structure','Warm service metal'].includes(object.material.name))structure.push(object);
    });
    const hull=ship.core.children.filter(mesh=>mesh.isMesh&&mesh.material.name==='Aged Macintosh beige');
    assert.equal(foundations.length,2);
    const cast=(origin,direction,meshes)=>{
      const point=ship.core.localToWorld(origin.clone()),outward=direction.clone().transformDirection(ship.core.matrixWorld);
      const hit=new THREE.Raycaster(point,outward).intersectObjects(meshes,false)[0];
      assert.ok(hit,'the actual mounting or pressure-skin geometry is present');
      return ship.core.worldToLocal(hit.point.clone());
    };
    for(const scale of [1,2.6]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      for(const antenna of antennas){
        const {radius,mountPoint}=antenna.userData.antenna,anchor=antenna.position;
        const roof=cast(new THREE.Vector3(anchor.x,8,anchor.z),new THREE.Vector3(0,-1,0),hull);
        assert.ok(Math.abs(anchor.y-roof.y-.40)<1e-5,'each dish is lowered to a compact clearance above its actual roof facet');
        const halfLength=Math.max(.28,radius*.50),halfWidth=Math.max(.22,radius*.34);
        for(const axial of [-1,1])for(const lateral of [-1,1]){
          const top=cast(new THREE.Vector3(anchor.x+axial*halfLength*.87,roof.y+.13,anchor.z+lateral*halfWidth*.78),new THREE.Vector3(0,-1,0),structure);
          assert.ok(Math.abs(top.y-roof.y-.08)<1e-5,'the wide eight-corner foundation plate is seated on the roof');
        }
        const pivot=new THREE.Vector3(...mountPoint).applyMatrix4(antenna.matrix);
        for(const side of [-1,1]){
          const bearing=cast(pivot.clone().add(new THREE.Vector3(side*.5,0,0)),new THREE.Vector3(-side,0,0),structure);
          assert.ok(Math.abs(bearing.x-anchor.x)>.12,'both sides have a physical elevation bearing and axis pin');
        }
      }
    }
    let meshes=0;ship.root.traverse(object=>{if(object.isMesh)meshes++;});
    assert.equal(meshes,99,'the additional mechanical details stay in existing material batches');
  }finally{ship.dispose();}
});

test('both mothership antenna bowls share the tank insulation material in the study and production finish',()=>{
  for(const createShip of [createExteriorMothership,createProductionExterior]){
    const ship=createShip();
    try{
      ship.root.updateMatrixWorld(true);
      const antennas=[],insulation=[];
      ship.machinery.traverse(object=>{
        if(object.userData.antenna)antennas.push(object);
        if(object.isMesh&&object.material.name==='Worn insulation')insulation.push(object);
      });
      assert.equal(antennas.length,2);
      assert.equal(insulation.length,1,'tank shells and antenna bowls share the same existing material batch');
      const positions=insulation[0].geometry.attributes.position;
      assert.ok(Array.from({length:positions.count},(_,index)=>positions.getX(index)).some(axial=>axial<-10),'the shared batch includes the tanks');
      for(const antenna of antennas){
        const {radius,depth}=antenna.userData.antenna;
        const point=insulation[0].worldToLocal(antenna.localToWorld(new THREE.Vector3(0,depth*.49,radius*.7)));
        let found=false;
        for(let index=0;index<positions.count;index++){
          if(Math.hypot(positions.getX(index)-point.x,positions.getY(index)-point.y,positions.getZ(index)-point.z)<1e-5){found=true;break;}
        }
        assert.ok(found,'the actual bowl reflector uses the tank material instead of the beige hull paint');
      }
    }finally{ship.dispose();}
  }
});
