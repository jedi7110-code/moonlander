import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,DoubleSide,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {REAR_ROOM_GATES,FLOOR_Y} from '../src/obs/ship.js';
import {createRearRoomFurnishings} from '../src/obs/rear-room-furnishings.js';
import {createMilo} from '../src/obs/characters.js';

test('02 has laundry and clothes; 03 has food and household supplies',()=>{
  assert.deepEqual(REAR_ROOM_GATES.map(g=>g.room),['operations','laundry','stores']);
  assert(REAR_ROOM_GATES.every(g=>g.x===REAR_ROOM_GATES[0].x&&g.width===REAR_ROOM_GATES[0].width&&g.height===REAR_ROOM_GATES[0].height),'all entrances have the same size and alignment');
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  for(const [level,names]of [[1,['Washing machine','Dryer','Open clothes closet','Hanging garment','Folded clothing','Laundry basket']],
    [2,['Food ration case','Preserved food tin','Household detergent','Stored linen','Paper roll','Household supply box']]]){
    const g=REAR_ROOM_GATES[level],room=createRearRoomFurnishings(m,g);
    for(const name of names)assert.ok(room.getObjectByName(name),name);
    const bounds=new Box3().setFromObject(room);
    assert(bounds.min.y>=FLOOR_Y[level]+.1-1e-6&&bounds.max.y<FLOOR_Y[level]+2.3);
    assert(bounds.min.x>=g.x-1.1&&bounds.max.x<=g.x+1.1,'equipment fits inside the rear room');
    assert(bounds.max.z< -3.1,'keep the doorway and approach clear');
    assert(bounds.min.z>g.back,'equipment stays in front of the rear wall');
    if(level===1){
      assert(!room.getObjectByName('Food ration case'));
      assert.equal(room.getObjectByName('Washer rotating clothes').visible,false,'washer starts empty');
      assert.equal(room.getObjectByName('Dryer clothes'),undefined,'unused dryer has no clothes to merge into the static room');
      const load=room.getObjectByName('Washer rotating clothes'),cloth=load.getObjectByName('Crumpled laundry');
      assert.equal(load.children.length,1,'folds share one draw mesh');assert.ok(cloth);
      assert.equal(cloth.geometry.index.count/3,240,'less geometry than the old 300-triangle rounded box');
      assert.equal(cloth.material.side,DoubleSide);assert.equal(cloth.material.vertexColors,true);
      assert.equal(cloth.material.metalness,0);assert.equal(cloth.material.roughness,1);
      const points=cloth.geometry.attributes.position,normals=cloth.geometry.attributes.normal;
      let minZ=Infinity,maxZ=-Infinity;
      for(let i=0;i<points.count;i++){
        const p=new Vector3().fromBufferAttribute(points,i),n=new Vector3().fromBufferAttribute(normals,i);
        assert.ok(p.toArray().every(Number.isFinite));assert.ok(Math.abs(n.length()-1)<1e-5);
        assert.ok(Math.hypot(p.x,p.y)<.205,'the load stays within the opening at every rotation');
        assert.ok(p.z>-.012&&p.z<.04,'folds sit ahead of the dark drum and behind the door rim');
        minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
      }
      assert.ok(maxZ-minZ>.025,'folds have real depth instead of a flat white panel');
      const shirts=[];room.traverse(o=>{if(o.name==='Seamless T-shirt')shirts.push(new Box3().setFromObject(o));});
      assert.equal(shirts.length,3);
      shirts.sort((a,b)=>a.min.x-b.min.x);
      for(let i=1;i<shirts.length;i++)assert(shirts[i].min.x-shirts[i-1].max.x>.025,'shirts and sleeves have a visible gap, without coplanar overlap');
      room.updateMatrixWorld(true);
      const boots=[];
      room.traverse(o=>{
        if(o.name==='Wardrobe boot')boots.push(o);
        if(o.name!=='Shirt hanger')return;
        const shirt=o.parent.getObjectByName('Seamless T-shirt');
        for(const tip of o.userData.shoulderContacts){
          const point=o.localToWorld(new Vector3(...tip));
          const hit=new Raycaster(point.clone().add(new Vector3(0,0,.10)),new Vector3(0,0,-1)).intersectObject(shirt)[0];
          assert(hit&&hit.point.z>point.z&&hit.point.z-point.z<.05,'hanger arms sit inside the fabric shoulders, not above a floating shirt');
        }
      });
      assert.equal(boots.length,2);
      const milo=createMilo(m);
      for(const stored of boots){
        const worn=milo.userData.legs.find(leg=>leg.side===stored.userData.side).boot;
        const copy=stored.getObjectByName('Laced combat boot');assert(copy);
        assert.deepEqual(copy.scale.toArray(),worn.scale.toArray(),'no oversized or stretched prop boots');
        assert.equal(copy.children.length,worn.children.length);
        copy.children.forEach((mesh,i)=>{
          const original=worn.children[i];assert.equal(mesh.name,original.name);
          assert.deepEqual(mesh.geometry.attributes.position.array,original.geometry.attributes.position.array,'identical boot shape, soles and laces');
          assert.deepEqual(mesh.position.toArray(),original.position.toArray());
          assert.deepEqual(mesh.scale.toArray(),original.scale.toArray());
          assert.deepEqual(mesh.quaternion.toArray(),original.quaternion.toArray());
          assert.equal(mesh.material.color.getHex(),original.material.color.getHex());
        });
      }
      milo.traverse(o=>o.geometry?.dispose());
      const bootBounds=boots.map(b=>new Box3().setFromObject(b));
      assert(!bootBounds[0].intersectsBox(bootBounds[1]),'boots stand separately');
      for(const b of bootBounds){
        assert(Math.abs(b.min.y-(g.floor+.11))<1e-6,'soles rest on the room floor');
        assert(b.min.z> -4.39&&b.max.z< -3.5,'boots sit in front of the closet, clear of the doorway');
      }
    }
    else assert(!room.getObjectByName('Washing machine'));
    room.traverse(o=>o.geometry?.dispose());
  }
  material.dispose();
});
