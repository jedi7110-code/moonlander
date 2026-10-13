import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleExteriorCinema,sampleExteriorCinemaFrame,CINEMA_SHOTS,OPENING_DURATION,EXTERIOR_VIEW_DURATION,CINEMA_DISSOLVE_SECONDS} from '../src/obs/exterior-cinematic.js';
import {cinemaMessageAccepted,shouldPlayExteriorOpening} from '../src/obs/exterior-cinema-policy.js';
import {EXTERIOR,createExteriorShip} from '../src/obs/ship-exterior.js';
import {EXTERIOR_LOGO,LOGO_SETTLED,sampleExteriorLogo} from '../src/obs/exterior-logo.js';
import {EXTERIOR_CRUISE_SPEED} from '../src/obs/exterior-cruise.js';
import {engineDistanceGain} from '../src/obs/exterior-optics.js';
const shotStart=id=>CINEMA_SHOTS.slice(0,CINEMA_SHOTS.findIndex(s=>s.id===id)).reduce((sum,s)=>sum+s.duration,0);
const cameraFor=(shot,aspect=16/9)=>{
  const camera=new THREE.PerspectiveCamera(shot.fov,aspect,shot.near,shot.far);
  camera.position.fromArray(shot.eye);camera.up.fromArray(shot.up);camera.lookAt(new THREE.Vector3(...shot.target));camera.updateMatrixWorld(true);
  return camera;
};

test('distinct shots cut in order, and the opening keeps playing until the viewer enters',()=>{
  const ids=[];let start=0;
  for(const shot of CINEMA_SHOTS){ids.push(sampleExteriorCinema(start+shot.duration/2,{opening:true}).id);start+=shot.duration;}
  assert.deepEqual(ids,CINEMA_SHOTS.map(s=>s.id));
  assert.equal(ids[0],'overhead');assert.equal(ids.at(-1),'flyby');
  assert.equal(sampleExteriorCinema(OPENING_DURATION-.001,{opening:true}).done,false);
  assert.equal(sampleExteriorCinema(OPENING_DURATION,{opening:true}).done,false);
  assert.equal(sampleExteriorCinema(OPENING_DURATION,{opening:true}).id,'flyby');
  assert.equal(sampleExteriorCinema(OPENING_DURATION+1,{opening:true}).titleOpacity,0);
  assert.equal(sampleExteriorCinema(OPENING_DURATION*10000+1,{opening:true}).done,false);
  for(const opening of [true,false]){
    const duration=opening?OPENING_DURATION:EXTERIOR_VIEW_DURATION;
    const a=sampleExteriorCinema(duration,{opening}),b=sampleExteriorCinema(duration+10000,{opening});
    assert.equal(a.id,'flyby');assert.equal(b.id,'flyby');assert.equal(b.number,9);
    assert.deepEqual(a.eye,b.eye);assert.deepEqual(a.target,b.target);
    assert.ok(b.shipX>a.shipX);assert.ok(Math.abs((b.shipX-a.shipX)/10000-6)<1e-10);
    assert.equal(b.time,duration+10000);assert.equal(b.cruising,true);assert.equal(b.titleOpacity,0);assert.equal(b.fade,0);
    assert.ok(new THREE.Vector3(b.shipX,0,0).project(cameraFor(b)).z<1,'distant flight stays within the camera range');
  }
});
test('editing numbers stay stable, scene 03 leads straight into 07, and scenes 06 and 08 are removed',()=>{
  const numbers=[];let time=0;
  for(const definition of CINEMA_SHOTS){numbers.push(sampleExteriorCinema(time+definition.duration/2,{opening:true}).number);time+=definition.duration;}
  assert.deepEqual(numbers,[1,2,3,7,4,5,9]);
  assert.equal(CINEMA_SHOTS.some(shot=>shot.id==='engines'),false);
  const boundary=shotStart('lander'),frame=sampleExteriorCinemaFrame(boundary+.25,{opening:true});
  assert.equal(frame.from.number,3);assert.equal(frame.to.number,7);
  assert.deepEqual(frame.from.probe,frame.to.probe,'03 approaches the trimmed opening pose without a jump during the dissolve');
  assert.ok(Math.abs(frame.from.shipX-frame.to.shipX)<1e-9);
});
test('scene 02 travels at half its previous speed, and 04 uses a fixed ultra-telephoto view with a huge planet',()=>{
  const a=sampleExteriorCinema(shotStart('planet')+1,{opening:true}),b=sampleExteriorCinema(shotStart('planet')+2,{opening:true});
  assert.equal(b.shipX-a.shipX,48);
  const start=shotStart('crossing'),mid=sampleExteriorCinema(start+5,{opening:true}),end=sampleExteriorCinema(start+9,{opening:true});
  assert.equal(mid.number,4);assert.ok(mid.fov<5);
  const camera=cameraFor(mid);assert.ok(camera.position.distanceTo(new THREE.Vector3(...mid.target))>2000);
  assert.deepEqual(mid.eye,end.eye);assert.deepEqual(mid.target,end.target);assert.deepEqual(mid.planet,end.planet);
  assert.ok(mid.planet.position[2]+4200<-70000,'the visible surface stays far behind the foreground hull');
  const upper=new THREE.Vector3(...mid.planet.position).add(new THREE.Vector3(0,4200,0)).project(camera);
  const lower=new THREE.Vector3(...mid.planet.position).add(new THREE.Vector3(0,-4200,0)).project(camera);
  assert.ok((upper.y-lower.y)/2>1.5,'the planet is larger than the frame height');
});
test('scene 01 approaches from depth while its stationary oblique camera tilts down',()=>{
  const definition=CINEMA_SHOTS[0];
  const a=sampleExteriorCinema(definition.duration/2,{opening:true}),b=sampleExteriorCinema(definition.duration-4,{opening:true});
  assert.equal(a.number,1);assert.equal(a.mode,'tilt');assert.equal(a.titleOpacity,0);assert.deepEqual(a.up,[0,1,0]);
  assert.deepEqual(a.eye,b.eye);assert.equal(a.fov,b.fov);
  const cameras=[cameraFor(a),cameraFor(b)],directions=cameras.map(camera=>camera.getWorldDirection(new THREE.Vector3()));
  assert.ok(directions[0].x<-.6&&directions[0].y>-.75,'the bow approaches an oblique observer, rather than a straight-down camera');
  assert.ok(directions[1].y<directions[0].y&&directions[1].y>-.9,'only the downward tilt increases');
  assert.ok(Math.abs(directions[0].z/directions[0].x-directions[1].z/directions[1].x)<1e-10,'horizontal bearing stays fixed');
  const distance=shot=>new THREE.Vector3(...shot.eye).distanceTo(new THREE.Vector3(shot.shipX,0,0));
  assert.ok(distance(b)<distance(a)*.7,'the real ship substantially closes its distance to the stationary camera');
  const spans=[a,b].map((shot,i)=>{
    const center=new THREE.Vector3(shot.shipX,0,0).project(cameras[i]);
    assert.ok(Math.abs(center.x)<1&&Math.abs(center.y)<1,'the approaching ship stays in the composition');
    const bow=new THREE.Vector3(shot.shipX+48,0,0).project(cameras[i]),stern=new THREE.Vector3(shot.shipX-58,0,0).project(cameras[i]);
    return Math.hypot(bow.x-stern.x,bow.y-stern.y);
  });
  assert.ok(spans[1]>spans[0]*1.25,'perspective makes the approaching ship larger without a zoom');
  assert.ok(Math.abs((b.shipX-a.shipX)/(b.time-a.time)-definition.speed)<1e-10);
  assert.equal(sampleExteriorCinema(EXTERIOR_LOGO.end,{opening:true}).shipX,0);
  assert.deepEqual(sampleExteriorCinema(0,{opening:true}).target,sampleExteriorCinema(EXTERIOR_LOGO.end,{opening:true}).target,'the logo holds the initial tilt');
});
test('the logo shows empty space, then a continuous tilt reveals the ship through the upper edge',()=>{
  const definition=CINEMA_SHOTS[0],initial=sampleExteriorCinema(0,{opening:true});
  for(const seconds of [0,.8,2,4.2,4.7,EXTERIOR_LOGO.end-.001]){
    const shot=sampleExteriorCinema(seconds,{opening:true});
    assert.equal(shot.shipVisible,false,'no ship is rendered while the logo appears or fades');
    assert.deepEqual(shot.eye,initial.eye);assert.deepEqual(shot.target,initial.target,'the camera also waits for the logo');
  }
  const ship=createExteriorShip(),point=new THREE.Vector3();ship.setCoreScale(2.6);
  function lowestPoint(seconds){
    const shot=sampleExteriorCinema(seconds,{opening:true}),camera=cameraFor(shot);let lowest=Infinity;
    ship.root.position.x=shot.shipX;ship.setAngle(shot.angle);ship.root.updateMatrixWorld(true);
    ship.root.traverse(mesh=>{const positions=mesh.geometry?.attributes.position;if(!positions)return;for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(camera);lowest=Math.min(lowest,point.y);
    }});
    return lowest;
  }
  try{
    assert.ok(lowestPoint(EXTERIOR_LOGO.end)>.88,'the entire real hull stays above the visible frame, including the smaller mobile letterbox, when rendering begins');
    const entry=lowestPoint(EXTERIOR_LOGO.end+2);
    assert.ok(entry<.84&&entry>0,'the bow appears through the upper edge after the logo clears');
    assert.ok(lowestPoint(EXTERIOR_LOGO.end+8)<entry,'the ship continues down into the composition');
  }finally{ship.dispose();}
  const before=sampleExteriorCinema(EXTERIOR_LOGO.end,{opening:true}),after=sampleExteriorCinema(EXTERIOR_LOGO.end+.1,{opening:true});
  assert.equal(after.titleOpacity,0);assert.equal(after.shipVisible,true);
  assert.ok(after.target[1]<before.target[1],'the downward tilt begins only after the logo has gone');
  let previousY=0;
  for(const seconds of [0,4.2,5.2,6,7,10,14,20,28,definition.duration-.001]){
    const direction=cameraFor(sampleExteriorCinema(seconds,{opening:true})).getWorldDirection(new THREE.Vector3());
    assert.ok(direction.y<=previousY+1e-12,'the camera never tilts upward, including during entry');previousY=direction.y;
  }
  sampleExteriorCinema(40,{opening:true});assert.deepEqual(sampleExteriorCinema(0,{opening:true}),initial,'restarting restores the empty logo sky');
});
test('distant engine flares shrink and fade while all near engines retain their blue streaks',()=>{
  const camera=new THREE.Vector3(),near=new THREE.Vector3(100,0,0),far=new THREE.Vector3(2000,0,0);
  assert.equal(engineDistanceGain(camera,near),1);
  assert.ok(Math.abs(engineDistanceGain(camera,far)-.01)<1e-12);
});
test('seeking is independent of frame history and keeps reference 1G rotation',()=>{
  const expected=sampleExteriorCinema(17.3);
  for(const rate of [24,60,120]){
    for(let t=0;t<17.3;t+=1/rate)sampleExteriorCinema(t);
    assert.deepEqual(sampleExteriorCinema(17.3),expected);
  }
  const a=sampleExteriorCinema(1),b=sampleExteriorCinema(1+60/EXTERIOR.rpm);
  assert.ok(Math.abs(b.angle-a.angle-2*Math.PI)<1e-10);
});
test('wide views fit distant hull/ring in portrait and the ship crosses frame',()=>{
  const midpoints=[];let start=0;
  for(const shot of CINEMA_SHOTS){if(shot.wide)midpoints.push(start+shot.duration/2);start+=shot.duration;}
  for(const aspect of [.45,1,16/9,2.4]){
    for(const seconds of midpoints){
      const shot=sampleExteriorCinema(seconds,{opening:true,aspect});
      const camera=cameraFor(shot,aspect);
      const center=new THREE.Vector3(shot.shipX,0,0).project(camera);
      assert.ok(Math.abs(center.x)<1&&Math.abs(center.y)<1);
      assert.ok(camera.position.distanceTo(new THREE.Vector3(...shot.target))>100);
    }
  }
  const crossing=CINEMA_SHOTS.find(s=>s.id==='crossing'),crossingStart=shotStart('crossing');
  const xs=[crossingStart+.5,crossingStart+crossing.duration-.5].map(seconds=>{
    const shot=sampleExteriorCinema(seconds,{opening:true}),camera=cameraFor(shot);
    return new THREE.Vector3(shot.shipX,0,0).project(camera).x;
  });
  assert.ok(xs[0]*xs[1]<0,'the ship crosses the center rather than being locked to it');
});
test('fixed cameras stay in world space while the ship alone advances at its shot speed',()=>{
  let start=0;
  for(const definition of CINEMA_SHOTS){
    if(definition.mode==='fixed'){
      const from=(definition.delay??0)+.1;
      const a=sampleExteriorCinema(start+from,{opening:true}),b=sampleExteriorCinema(start+definition.duration-.1,{opening:true});
      assert.deepEqual(a.eye,b.eye);assert.deepEqual(a.target,b.target);assert.equal(a.fov,b.fov);
      assert.ok(b.shipX>a.shipX);assert.ok(Math.abs((b.shipX-a.shipX)/(definition.duration-.1-from)-(definition.speed??EXTERIOR_CRUISE_SPEED))<1e-10);
    }
    start+=definition.duration;
  }
});
test('the camera mounted on the hull has a fixed attachment and orientation, without an orbit tween',()=>{
  const start=shotStart('mounted'),duration=CINEMA_SHOTS.find(s=>s.id==='mounted').duration;
  const a=sampleExteriorCinema(start+.1,{opening:true}),b=sampleExteriorCinema(start+duration-.1,{opening:true});
  assert.equal(a.mode,'mounted');assert.equal(b.id,a.id);
  for(const key of ['eye','target'])for(let i=0;i<3;i++){
    const localA=a[key][i]-(i===0?a.shipX:0),localB=b[key][i]-(i===0?b.shipX:0);
    assert.ok(Math.abs(localA-localB)<1e-10);
  }
});
test('planet transit keeps a tiny ship, stationary backdrop and a faster apparent pass',()=>{
  const start=shotStart('planet'),duration=CINEMA_SHOTS.find(s=>s.id==='planet').duration;
  const a=sampleExteriorCinema(start+.5,{opening:true}),b=sampleExteriorCinema(start+duration-.5,{opening:true});
  assert.deepEqual(a.eye,b.eye);assert.deepEqual(a.target,b.target);assert.deepEqual(a.planet,b.planet);
  assert.ok(a.planet.position[2]+4200<0,'even the near surface of the planet stays behind the foreground ship');
  const camera=cameraFor(a),centerA=new THREE.Vector3(a.shipX,0,0).project(camera),centerB=new THREE.Vector3(b.shipX,0,0).project(camera);
  assert.ok(centerA.x<0&&centerB.x>0,'small ship crosses the fixed composition');
  const width=Math.abs(new THREE.Vector3(a.shipX+55,0,0).project(camera).x-new THREE.Vector3(a.shipX-55,0,0).project(camera).x)/2;
  assert.ok(width<.035,'110 m hull occupies under 3.5 percent of the frame width');
  const normal=sampleExteriorCinema(shotStart('crossing')+1,{opening:true}),normalCamera=cameraFor(normal);
  const normalRate=Math.abs(new THREE.Vector3(normal.shipX+normal.shipSpeed,0,0).project(normalCamera).x-new THREE.Vector3(normal.shipX,0,0).project(normalCamera).x);
  const distantRate=Math.abs(new THREE.Vector3(a.shipX+a.shipSpeed,0,0).project(camera).x-centerA.x);
  assert.ok(distantRate>normalRate&&distantRate<normalRate*2,'the distant transit looks a little faster');
  const before=sampleExteriorCinema(start+duration-.000001,{opening:true}),after=sampleExteriorCinema(start+duration,{opening:true});
  assert.ok(Math.abs(after.shipX-before.shipX)<.001,'flight position stays continuous at the cut');
  assert.equal(after.planet,null);assert.equal(after.shipSpeed,EXTERIOR_CRUISE_SPEED);
});
test('space is visible immediately, and scene changes never fade to black',()=>{
  assert.equal(sampleExteriorCinema(0).fade,0);assert.equal(sampleExteriorCinema(EXTERIOR_VIEW_DURATION).fade,0);
  assert.equal(sampleExteriorCinema(1).fade,0);
  let start=0;
  for(const shot of CINEMA_SHOTS.slice(0,-1)){
    start+=shot.duration;
    assert.equal(sampleExteriorCinema(start-.01,{opening:true}).fade,0);
    assert.equal(sampleExteriorCinema(start+.01,{opening:true}).fade,0);
  }
  assert.equal(sampleExteriorCinema(OPENING_DURATION,{opening:true}).fade,0);
});
test('all scene edits dissolve between two moving viewpoints on a seek-safe film clock',()=>{
  for(const opening of [true,false]){
    const scale=opening?1:EXTERIOR_VIEW_DURATION/OPENING_DURATION,half=CINEMA_DISSOLVE_SECONDS/2;
    let boundary=0;
    for(let index=0;index<CINEMA_SHOTS.length-1;index++){
      boundary+=CINEMA_SHOTS[index].duration*scale;
      const before=sampleExteriorCinemaFrame(boundary-half-.001,{opening});
      const start=sampleExteriorCinemaFrame(boundary-half,{opening});
      const middle=sampleExteriorCinemaFrame(boundary,{opening});
      const nearEnd=sampleExteriorCinemaFrame(boundary+half-.001,{opening});
      const after=sampleExteriorCinemaFrame(boundary+half,{opening});
      assert.equal(before.to,null);assert.equal(start.mix,0);assert.equal(middle.mix,.5);assert.equal(after.to,null);
      assert.equal(middle.from.id,CINEMA_SHOTS[index].id);assert.equal(middle.to.id,CINEMA_SHOTS[index+1].id);
      assert.ok(nearEnd.mix>.999);
      for(const key of ['from','to']){
        assert.ok(nearEnd[key].shipX>start[key].shipX,'both layers keep flying throughout the overlap');
        assert.ok(nearEnd[key].angle>start[key].angle,'rotation never freezes in either layer');
        assert.equal(middle[key].time,boundary);assert.equal(middle[key].fade,0);
      }
      assert.equal(middle.from.angle,middle.to.angle,'both views share the same 1G rotation clock');
      assert.deepEqual(start.from,sampleExteriorCinema(boundary-half,{opening}),'the dissolve starts on the unchanged outgoing image');
      sampleExteriorCinemaFrame(OPENING_DURATION+300,{opening});
      assert.deepEqual(sampleExteriorCinemaFrame(boundary,{opening}),middle,'seeking does not depend on a previous frame');
    }
    for(const seconds of [0,OPENING_DURATION*scale,OPENING_DURATION*scale+10000]){
      const frame=sampleExteriorCinemaFrame(seconds,{opening});assert.equal(frame.to,null);assert.equal(frame.mix,0);assert.equal(frame.shot.done,false);
    }
  }
});
test('the final slow flyover keeps clear of the rotating hull and continues away from its fixed observer',()=>{
  const start=shotStart('flyby'),initial=sampleExteriorCinema(start,{opening:true});
  assert.equal(initial.id,'flyby');assert.equal(initial.titleOpacity,0);assert.equal(initial.shipVisible,true);
  const camera=cameraFor(initial),forward=new THREE.Vector3();camera.getWorldDirection(forward);
  const depth=shot=>new THREE.Vector3(shot.shipX,0,0).sub(camera.position).dot(forward);
  assert.ok(depth(initial)<0,'ship starts behind the observer');
  const near=sampleExteriorCinema(start+9,{opening:true}),far=sampleExteriorCinema(OPENING_DURATION+500,{opening:true});
  assert.deepEqual(initial.eye,far.eye);assert.deepEqual(initial.target,far.target);
  assert.ok(depth(near)>0&&depth(far)>depth(near),'ship passes the observer and recedes');
  const ship=createExteriorShip(),point=new THREE.Vector3();let sweptRadius=0;
  try{
    ship.setCoreScale(2.6);ship.root.updateMatrixWorld(true);
    ship.rotor.traverse(mesh=>{const positions=mesh.geometry?.attributes.position;if(!positions)return;for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);sweptRadius=Math.max(sweptRadius,Math.hypot(point.y,point.z));
    }});
    assert.ok(Math.hypot(camera.position.y,camera.position.z)-sweptRadius>2,'close flyover stays outside every rotating hull vertex');
    for(const seconds of [start,start+4]){
      const shot=sampleExteriorCinema(seconds,{opening:true}),openingCamera=cameraFor(shot);let visible=0;
      ship.root.position.x=shot.shipX;ship.setAngle(shot.angle);ship.root.updateMatrixWorld(true);
      ship.root.traverse(mesh=>{const positions=mesh.geometry?.attributes.position;if(!positions)return;for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(openingCamera);
        if(point.z>=-1&&point.z<=1&&Math.abs(point.x)<1&&Math.abs(point.y)<1)visible++;
      }});
      if(seconds===start)assert.equal(visible,0,'the ship starts behind the observer rather than popping into view');
      else assert.ok(visible>0,'the hull enters within four seconds while retaining the slow flyover speed');
    }
    assert.ok(initial.shipSpeed<=6,'a 100-metre hull takes over 16 seconds to pass the observer');
  }finally{ship.dispose();}
  assert.equal(sampleExteriorCinema(shotStart('planet')+1,{opening:true}).titleOpacity,0);
});
test('console logo loads in ten horizontal bands, holds and samples identically after seeking',()=>{
  assert.equal(sampleExteriorLogo(0).reveal,0);assert.equal(sampleExteriorLogo(0).opacity,0);
  for(let step=0;step<=10;step++){
    const time=EXTERIOR_LOGO.start+(step+.001)*EXTERIOR_LOGO.resolve/10;
    assert.equal(sampleExteriorLogo(time).reveal,Math.min(1,step/10));
  }
  assert.equal(sampleExteriorLogo(LOGO_SETTLED).reveal,1);
  assert.ok(EXTERIOR_LOGO.hold-LOGO_SETTLED>=2,'completed logo remains legible');
  assert.ok(EXTERIOR_LOGO.end<6,'the logo clears promptly while loading proceeds independently');
  assert.equal(sampleExteriorLogo(EXTERIOR_LOGO.hold).opacity,1);
  assert.equal(sampleExteriorLogo(EXTERIOR_LOGO.end).opacity,0);
  assert.ok(Math.abs(sampleExteriorLogo(EXTERIOR_LOGO.start+.73*4.5).flicker-.85)<1e-10);
  assert.equal(sampleExteriorLogo(EXTERIOR_LOGO.start+.74*4.5).flicker,1);
  const expected=sampleExteriorLogo(4.1);sampleExteriorLogo(14);assert.deepEqual(sampleExteriorLogo(4.1),expected);
});
test('opening skips inspection links and only accepts messages from its own origin and iframe',()=>{
  assert.equal(shouldPlayExteriorOpening(''),true);
  assert.equal(shouldPlayExteriorOpening('?opening=0'),false);
  assert.equal(shouldPlayExteriorOpening('?preview=airlock'),false);
  const frame={contentWindow:{}},origin='https://example.test';
  const event={origin,source:frame.contentWindow,data:{type:'tara-exterior',action:'done'}};
  assert.equal(cinemaMessageAccepted(event,frame,origin),true);
  assert.equal(cinemaMessageAccepted({...event,origin:'https://other.test'},frame,origin),false);
  assert.equal(cinemaMessageAccepted({...event,source:{}},frame,origin),false);
  assert.equal(cinemaMessageAccepted({...event,data:{type:'other'}},frame,origin),false);
});
