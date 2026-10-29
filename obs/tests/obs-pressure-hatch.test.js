import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Group,MeshStandardMaterial,Raycaster,Texture,Vector3} from 'three';
import {createPressureHatch,animatePressureHatch,PRESSURE_HATCH as P} from '../src/obs/pressure-hatch.js';
import {createEVAHatch,animateAirlock,EVA_BAY,HATCH_SERVICE_POINT} from '../src/obs/eva.js';
import {CABIN_AISLE} from '../src/obs/layout.js';
import {coplanarSurfaces} from './helpers/coplanar-surfaces.js';

test('thick closed leaves overlap the jamb and hide the pocket slot from acute angles on both faces',()=>{
  const root=createPressureHatch();root.updateMatrixWorld(true);
  const core=new Box3().setFromObject(root.getObjectByName('Sealed pressure door'));
  assert.ok(core.max.z-core.min.z>=.12,'substantial leaf thickness, not a thin decorative skin');
  const edges=[];root.traverse(mesh=>{if(mesh.name==='Overlapping leaf perimeter')edges.push(mesh);});
  assert.equal(edges.length,2);
  for(const edge of edges){
    const box=new Box3().setFromObject(edge);
    assert.ok(Math.abs(box.max.z-.119)<1e-7&&Math.abs(box.min.z+.119)<1e-7,'perimeter has 1 mm running clearance in the 240 mm pocket');
    assert.ok(box.max.y> P.height/2&&box.max.y<1.10,'top overlap fits below the upper slide rail');
    assert.ok(box.min.y<-P.height/2&&box.min.y>-1.10,'bottom overlap fits above the lower slide rail');
  }
  const probes=[[-P.width/2,0,-1,0],[P.width/2,0,1,0],[-.22,P.height/2,0,1],[.22,-P.height/2,0,-1]];
  for(const x of [-1,1])for(const y of [-1,1])probes.push([x*(P.width/2-P.cut/2),y*(P.height/2-P.cut/2),x/Math.SQRT2,y/Math.SQRT2]);
  for(const side of [-1,1])for(const degrees of [0,45,70,80])for(const [x,y,nx,ny]of probes){
    const angle=degrees*Math.PI/180;
    // Start just inside the aperture at the cover's inner face. An old thin
    // leaf let this ray enter the pocket and see its back wall/end cap instead.
    const origin=new Vector3(x-nx*.0005,y-ny*.0005,side*.120001);
    const direction=new Vector3(nx*Math.sin(angle),ny*Math.sin(angle),-side*Math.cos(angle));
    const hit=new Raycaster(origin,direction).intersectObject(root,true)[0];
    assert.ok(hit&&edges.includes(hit.object),`sealed jamb at ${x}, ${y}, ${degrees} degrees, face ${side}`);
    assert.ok(hit.point.z*side>.118,'ray is stopped at the thick leaf edge, not the far pocket wall');
  }
});

test('thicker leaf edges and seals do not introduce flickering surfaces during opening',()=>{
  const root=createPressureHatch();
  for(const opening of [0,.25,.5,.75,1]){
    animatePressureHatch(root.userData.door,opening);
    assert.equal(coplanarSurfaces([root]).length,0,`no overlapping planar faces at ${opening}`);
  }
});

test('both leaves, glass and all lock parts stay inside the cassette throughout the travel',()=>{
  const root=createPressureHatch({inner:true}),{door}=root.userData;
  for(let i=0;i<=100;i++){
    animatePressureHatch(door,i/100);root.updateMatrixWorld(true);
    assert.ok(door.visible,'do not conceal overflow by making the door disappear');
    for(const leaf of door.userData.leaves){
      const box=new Box3().setFromObject(leaf);
      assert.ok(box.min.x>-P.cassetteWidth/2+.02&&box.max.x<P.cassetteWidth/2-.02,`pocket contains leaf at ${i}%`);
      assert.ok(box.min.z>-.12&&box.max.z<.12,'front and reverse locks also fit between the pocket covers');
      assert.equal(leaf.position.y,0);assert.equal(leaf.position.z,0,'the panels only slide laterally');
    }
  }
  const [left,right]=door.userData.leaves;
  assert.ok(new Box3().setFromObject(left).max.x<-P.width/2,'left leaf entirely clears the opening');
  assert.ok(new Box3().setFromObject(right).min.x>P.width/2,'right leaf entirely clears the opening');
  animatePressureHatch(door,0);assert.equal(left.position.x,0);assert.equal(right.position.x,0);
});

test('pocket covers hide the parked panels from either side and leave a person-sized clear passage',()=>{
  const root=createPressureHatch(),{door}=root.userData;animatePressureHatch(door,1);root.updateMatrixWorld(true);
  for(const side of [-1,1]){
    for(const x of [-.43,-.2,0,.2,.43])for(const y of [-.80,0,.80]){
      const ray=new Raycaster(new Vector3(x,y,side*2),new Vector3(0,0,-side));
      assert.equal(ray.intersectObject(root,true).length,0,`clear opening at ${x}, ${y} from ${side}`);
    }
    for(const x of [-1.15,-.85,-.64,.64,.85,1.15]){
      const hit=new Raycaster(new Vector3(x,0,side*2),new Vector3(0,0,-side)).intersectObject(root,true)[0];
      assert.ok(hit&&(hit.object.name.startsWith('Pocket cassette cover')||hit.object.parent.name==='Fixed pocket finish'),'actual opaque walls and their fixed service panels cover the moving leaves');
      assert.equal(hit.object.material.transparent,false);
    }
  }
  assert.ok(P.width>=1&&P.width<=1.15);assert.ok(P.height>=2.05&&P.height<=2.2);
});

test('front and reverse faces have matching lock mechanisms, a real angular window, and no wheel or round window',()=>{
  const root=createPressureHatch({inner:true}),front=root.getObjectByName('Pressure lock / cabin face'),back=root.getObjectByName('Pressure lock / reverse face');
  assert.ok(front&&back);assert.deepEqual(front.children.map(p=>p.geometry.type),back.children.map(p=>p.geometry.type));
  assert.equal(front.children.length,back.children.length);
  assert.ok(front.position.z>0&&back.position.z<0);
  const round=[];root.traverse(part=>{if(part.geometry?.type==='TorusGeometry'||/Pressure window rim|Sign:/.test(part.name))round.push(part);});assert.equal(round.length,0);
  assert.ok(root.getObjectByName('Angular safety window').material.transparent);
  assert.equal(front.getObjectByName('Pressure lock status strip').material,back.getObjectByName('Pressure lock status strip').material);
});

test('glass, aperture and both window frames have the same diagonal angles as the door seam',()=>{
  const hatch=createPressureHatch(),plate=hatch.getObjectByName('Sealed pressure door');
  const diagonalSlopes=points=>points.slice(0,-1).flatMap((a,i)=>{
    const b=points[i+1],dx=b.x-a.x,dy=b.y-a.y;
    return Math.abs(dx)>1e-8&&Math.abs(dy)>1e-8?[dy/dx]:[];
  }).sort((a,b)=>a-b);
  const seamPoints=plate.geometry.parameters.shapes.getPoints().filter(point=>point.x>=0);
  const expected=diagonalSlopes(seamPoints);
  assert.equal(expected.length,2);
  const shapes=[hatch.getObjectByName('Angular safety window').geometry.parameters.shapes,plate.geometry.parameters.shapes.holes[0]];
  hatch.traverse(part=>{if(part.name==='Angular safety window frame')shapes.push(part.geometry.parameters.shapes,...part.geometry.parameters.shapes.holes);});
  assert.equal(shapes.length,6,'glass, door opening, and inside/outside edges of both frames');
  for(const shape of shapes){
    const slopes=diagonalSlopes(shape.getPoints());assert.equal(slopes.length,2);
    slopes.forEach((slope,i)=>assert.ok(Math.abs(slope-expected[i])<1e-10,'every slanted window edge is parallel to the matching door cut'));
  }
});

test('OBS reparenting and study-local animation yield identical doors, lock targets and containment within the deck',()=>{
  for(const inner of [true,false]){
    const study=createEVAHatch(null,0,inner),obs=createEVAHatch(null,0,inner),animated=new Group();
    obs.updateMatrixWorld(true);animated.attach(obs.userData.door);
    for(const opening of [0,.1,.5,.9,1,0]){
      animateAirlock(study.userData.door,study.userData.signal,opening);animateAirlock(obs.userData.door,obs.userData.signal,opening);
      study.updateMatrixWorld(true);animated.updateMatrixWorld(true);
      const a=new Box3().setFromObject(study.userData.door),b=new Box3().setFromObject(obs.userData.door);
      assert.ok(a.min.distanceTo(b.min)<1e-7&&a.max.distanceTo(b.max)<1e-7);
      assert.ok(a.min.z>CABIN_AISLE.deckBack&&a.max.z<CABIN_AISLE.deckFront,'neither leaf leaves the ship');
    }
    assert.equal(study.position.z,EVA_BAY.depth);
    assert.ok(Math.abs(study.position.z-CABIN_AISLE.crewZ)<.1,'the enlarged opening stays aligned with the real walking lane');
    if(inner){const screw=study.getObjectByName('Inner lock service screw');assert.ok(screw.localToWorld(new Vector3(0,.014,0)).distanceTo(new Vector3(...Object.values(HATCH_SERVICE_POINT)))<1e-7);}
  }
});

test('opening values are bounded and invalid values close safely',()=>{
  const {door}=createPressureHatch().userData;
  for(const amount of [-1,NaN,Infinity]){animatePressureHatch(door,amount);assert.equal(Math.abs(door.userData.leaves[0].position.x),0);}
  animatePressureHatch(door,5);assert.equal(door.userData.leaves[1].position.x,P.travel);
});

test('hatch finish reuses the cabin paint and steel maps without altering shared materials',()=>{
  const paintMap=new Texture(),steelMap=new Texture(),bump=new Texture();
  const materials={enamel:new MeshStandardMaterial({map:paintMap,bumpMap:bump,color:0xd3d2c5}),metal:new MeshStandardMaterial({map:steelMap}),rubber:new MeshStandardMaterial(),red:new MeshStandardMaterial()};
  const a=createPressureHatch({materials}),b=createPressureHatch({materials});
  const plate=a.getObjectByName('Sealed pressure door').material,steel=a.getObjectByName('Chamfered metal jamb').material;
  assert.equal(plate.map,paintMap);assert.equal(plate.bumpMap,bump);assert.equal(steel.map,steelMap);
  assert.notEqual(plate,materials.enamel);assert.equal(materials.enamel.color.getHex(),0xd3d2c5);
  assert.equal(plate,b.getObjectByName('Sealed pressure door').material,'both doors reuse finish materials');
  const groups=[a.getObjectByName('Fixed pocket finish'),...a.userData.door.userData.leaves.map(leaf=>leaf.getObjectByName('Leaf surface finish'))];
  for(const [i,group]of groups.entries()){assert.ok(group);assert.ok(group.children.length<=(i===0?6:4),'screws and panel trim are batched instead of creating separate draw calls');}
  const prints=groups.flatMap(group=>group.children).filter(mesh=>mesh.material.name==='Pressure hatch / direct service printing');
  assert.equal(new Set(prints.map(mesh=>mesh.material)).size,1,'one small atlas for all stencils');
  for(const print of prints){assert.equal(print.castShadow,false);assert.equal(print.material.depthWrite,false);assert.ok(print.material.polygonOffset);}
});
