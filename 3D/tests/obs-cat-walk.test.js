import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {createCat,animateCat} from '../src/obs/characters.js';
import {CAT_WALK,catFootfall} from '../src/obs/cat-walk.js';
import {CatMotion} from '../src/obs/state.js';
import {CAT_PORT} from '../src/obs/layout.js';

const makeCat=()=>{const material=new MeshStandardMaterial();return createCat(new Proxy({},{get:()=>material}));};
test('the cat has a tapered face, a narrow neck and substantial ankles rather than oversized paws',()=>{
  const cat=makeCat(),{head,neck,eyes,legs}=cat.userData,skull=head.getObjectByName('Contoured cat skull');
  assert.ok(skull);assert.ok(skull.geometry.boundingBox.max.z>1);
  const points=skull.geometry.attributes.position,normals=skull.geometry.attributes.normal;
  let jaw=0,cheek=0;
  for(let i=0;i<points.count;i++){
    const x=Math.abs(points.getX(i)),y=points.getY(i);
    if(y<-.45&&y>-.65)jaw=Math.max(jaw,x);
    if(Math.abs(y)<.2)cheek=Math.max(cheek,x);
    assert.ok(Number.isFinite(normals.getX(i)+normals.getY(i)+normals.getZ(i)));
  }
  assert.ok(jaw<cheek*.85);assert.ok(neck.children[0].scale.x<skull.scale.x*.8);
  for(const eye of eyes)assert.ok(Math.abs(eye.position.x)<skull.scale.x*.5);
  for(const leg of legs){
    const {rings,sides}=leg.skin.userData,ring=Math.round(rings*.8),vertices=leg.skin.geometry.attributes.position;
    const a=new Vector3().fromBufferAttribute(vertices,ring*(sides+1));
    const b=new Vector3().fromBufferAttribute(vertices,ring*(sides+1)+sides/2);
    const ankleRadius=a.distanceTo(b)/2;
    assert.ok(ankleRadius>leg.paw.scale.x*.68&&ankleRadius<leg.paw.scale.x);
  }
});
test('a walking cycle uses lateral four-beat contacts, with two or three supporting paws',()=>{
  for(const [phase,side,rear]of [[0,-1,true],[.25,-1,false],[.5,1,true],[.75,1,false]]){
    const contact=catFootfall(phase*CAT_WALK.stride,side,rear);
    assert.ok(contact.phase<1e-9);assert.equal(contact.planted,true);
  }
  for(let i=0;i<200;i++){
    const paws=[-1,1].flatMap(side=>[true,false].map(rear=>catFootfall(i/200*CAT_WALK.stride,side,rear)));
    const support=paws.filter(paw=>paw.planted).length;assert.ok(support===2||support===3);
  }
});
test('planted paws remain fixed in world space while shoulders and the body advance',()=>{
  for(const facing of [-1,1]){
    const cat=makeCat(),previous=new Map();cat.rotation.y=facing*Math.PI/2;
    for(let i=0;i<=180;i++){
      const distance=i/180*CAT_WALK.stride;cat.position.x=facing*distance;
      animateCat(cat,{time:i/180,moving:true,mode:'walk',facing,walkDistance:distance});cat.updateMatrixWorld(true);
      for(const leg of cat.userData.legs){
        const target=catFootfall(distance,leg.side,leg.rear),point=leg.foot.getWorldPosition(new Vector3()),before=previous.get(leg);
        if(target.planted){
          assert.ok(Math.abs(point.y-CAT_WALK.pawHeight)<1e-6,`paw height ${point.y}`);
          if(before?.planted&&before.phase<target.phase)assert.ok(point.distanceTo(before.point)<1e-6,`sliding ${point.distanceTo(before.point)}`);
          const bounds=new Box3().setFromObject(leg.foot);assert.ok(bounds.min.y>=-.001&&bounds.min.y<.01);
        }else assert.ok(point.y>=CAT_WALK.pawHeight-1e-6);
        if(leg.rear){
          assert.ok(leg.knee.rotation.x>0);assert.ok(leg.ankle.getWorldPosition(new Vector3()).y-point.y>.075);
        }else assert.ok(leg.knee.rotation.x<0);
        previous.set(leg,{...target,point});
      }
    }
  }
});
test('the swing clears the deck and returns without a position or velocity discontinuity',()=>{
  for(const rear of [true,false]){
    const offset=rear?0:.25,at=phase=>catFootfall((phase+offset)*CAT_WALK.stride,-1,rear);
    assert.ok(at((1+CAT_WALK.stance)/2).y>.095);
    for(const join of [CAT_WALK.stance,1]){
      const eps=1e-5,a=at(join-eps),b=at(join),c=at(join+eps);
      assert.ok(Math.abs(a.z-c.z)<.00002);assert.ok(Math.abs((b.z-a.z)-(c.z-b.z))<1e-8);
      assert.ok(Math.abs(a.y-c.y)<1e-7);
    }
  }
});
test('leg skins stay continuous and grounded, without reallocation or residual grooming transforms',()=>{
  const cat=makeCat(),skins=cat.userData.legs.map(leg=>leg.skin.geometry);cat.rotation.y=Math.PI/2;
  for(const [mode,moving]of [['groom',false],['sleep',false],['walk',true],['eat',false]]){
    for(let i=0;i<30;i++)animateCat(cat,{time:i/30,mode,moving,facing:1,walkDistance:i/60,actionTime:2,remaining:10});
    cat.userData.legs.forEach((leg,index)=>{
      assert.equal(leg.skin.geometry,skins[index]);assert.equal(leg.skin.children.length,0);
      for(const value of leg.skin.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
      assert.ok(new Box3().setFromObject(leg.skin).min.y>-.012);
    });
  }
  const snapshot=()=>cat.userData.legs.flatMap(leg=>[...leg.hip.quaternion.toArray(),...leg.knee.quaternion.toArray(),...leg.ankle.quaternion.toArray(),...leg.foot.quaternion.toArray()]);
  for(let i=0;i<120;i++)animateCat(cat,{time:2+i/60,mode:'walk',moving:true,facing:1,walkDistance:.2});
  const before=snapshot();animateCat(cat,{time:5,mode:'walk',moving:true,facing:1,walkDistance:.2});assert.deepEqual(snapshot(),before);
});
test('the wall passage measures its actual depth travel and does not advance the gait while hidden',()=>{
  const cat=new CatMotion({floor:0,x:CAT_PORT.x});cat.goTo({floor:1,x:800});
  for(let i=0;i<240;i++){
    const z=cat.z,distance=cat.portalWalkDistance;cat.update(1/60);
    assert.ok(Math.abs(cat.portalWalkDistance-distance-Math.abs(cat.z-z))<1e-9);
  }
  assert.equal(cat.hidden,true);const distance=cat.portalWalkDistance;
  cat.update(0);assert.equal(cat.portalWalkDistance,distance);cat.update(.5);assert.equal(cat.portalWalkDistance,distance);
});
