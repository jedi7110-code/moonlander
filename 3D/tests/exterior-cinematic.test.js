import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleExteriorCinema,sampleExteriorCinemaFrame,exteriorCinemaShots,CINEMA_SHOTS,OPENING_DURATION,EXTERIOR_VIEW_DURATION,CINEMA_DISSOLVE_SECONDS} from '../src/obs/exterior-cinematic.js';
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
test('scene 01 ship is three percent slower, scene 02 camera slides right, and 04 keeps its fixed planet view',()=>{
  assert.equal(CINEMA_SHOTS[0].speed,10.12*.97);
  const planetStart=shotStart('planet');
  const a=sampleExteriorCinema(planetStart+1,{opening:true}),b=sampleExteriorCinema(planetStart+2,{opening:true});
  assert.equal(b.shipX-a.shipX,48);
  const left=sampleExteriorCinema(planetStart,{opening:true}),right=sampleExteriorCinema(planetStart+12-.001,{opening:true});
  assert.equal(left.mode,'lateral');assert.ok(Math.abs(right.eye[0]-left.eye[0]-240)<.001);
  assert.ok(Math.abs(right.target[0]-left.target[0]-240)<.001);
  assert.deepEqual(left.eye.slice(1),right.eye.slice(1));assert.deepEqual(left.target.slice(1),right.target.slice(1));
  assert.deepEqual(left.planet,right.planet,'the distant planet stays in world space as the camera slides');
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
  assert.ok(directions[0].x<-.6&&directions[0].y>-.76,'the bow approaches an oblique observer, rather than a straight-down camera');
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
  assert.equal(sampleExteriorCinema(definition.flightOrigin,{opening:true}).shipX,0);
  const pitchAt=seconds=>-Math.asin(cameraFor(sampleExteriorCinema(seconds,{opening:true})).getWorldDirection(new THREE.Vector3()).y)*180/Math.PI;
  const startup=(pitchAt(.3)-pitchAt(0))/.3;
  const beforeLogo=(pitchAt(EXTERIOR_LOGO.start)-pitchAt(1.2))/(EXTERIOR_LOGO.start-1.2);
  const atReveal=(pitchAt(EXTERIOR_LOGO.end)-pitchAt(EXTERIOR_LOGO.end-.2))/.2;
  const withShip=(pitchAt(EXTERIOR_LOGO.end+4)-pitchAt(EXTERIOR_LOGO.end+2))/2;
  assert.ok(startup<beforeLogo/2,'the tilt eases in without jumping to full speed');
  assert.ok(Math.abs(beforeLogo-.3)<1e-9,'the empty sky reaches the steady tilt speed before the logo');
  assert.ok(Math.abs(beforeLogo-atReveal)<1e-9&&Math.abs(beforeLogo-withShip)<1e-9,'the same tilt speed carries through the ship reveal');
});
test('the camera tilts before the logo and the ship enters during the title fade',()=>{
  const definition=CINEMA_SHOTS[0],initial=sampleExteriorCinema(0,{opening:true});
  for(const seconds of [0,1,EXTERIOR_LOGO.start,4.2,EXTERIOR_LOGO.hold]){
    const shot=sampleExteriorCinema(seconds,{opening:true});
    assert.equal(shot.shipVisible,true,'the ship stays rendered while approaching outside the frame');
    assert.deepEqual(shot.eye,initial.eye,'the camera stays at its fixed position');
    if(seconds>0)assert.ok(shot.target[1]<initial.target[1],'the tilt is already moving before the ship appears');
  }
  const ship=createExteriorShip(),point=new THREE.Vector3();ship.setCoreScale(2.6);ship.dockedLander.visible=false;
  function lowestPoint(seconds){
    const shot=sampleExteriorCinema(seconds,{opening:true}),camera=cameraFor(shot);let lowest=Infinity;
    ship.root.position.x=shot.shipX;ship.setAngle(shot.angle);ship.root.updateMatrixWorld(true);
    ship.root.traverseVisible(mesh=>{const positions=mesh.geometry?.attributes.position;if(!positions)return;for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(camera);lowest=Math.min(lowest,point.y);
    }});
    return lowest;
  }
  try{
    for(let time=0;time<=EXTERIOR_LOGO.hold;time+=.1){
      assert.ok(lowestPoint(time)>.88,'the entire moving hull remains outside the image until the logo fades, including mobile letterboxing');
    }
    const entry=lowestPoint(EXTERIOR_LOGO.end-.3);
    assert.ok(entry<.84&&entry>0,'the hull enters through the upper edge while the title fades');
    assert.ok(lowestPoint(EXTERIOR_LOGO.end+4)<entry,'the ship continues down into the composition');
    assert.ok(Math.abs(lowestPoint(definition.flightOrigin+.001)-lowestPoint(definition.flightOrigin-.001))<.001,'the entry trajectory has no position jump');
  }finally{ship.dispose();}
  const before=sampleExteriorCinema(EXTERIOR_LOGO.hold-.1,{opening:true}),during=sampleExteriorCinema(EXTERIOR_LOGO.end-.3,{opening:true}),after=sampleExteriorCinema(EXTERIOR_LOGO.end+.1,{opening:true});
  assert.equal(before.shipVisible,true);assert.ok(during.shipVisible&&during.titleOpacity>0&&during.titleOpacity<1);
  assert.equal(after.titleOpacity,0);assert.equal(after.shipVisible,true);
  assert.ok(after.target[1]<before.target[1],'the downward tilt continues through the overlapping reveal');
  let previousY=0;
  for(const seconds of [0,4.2,5.2,6,7,10,14,20,28,definition.duration-.001]){
    const direction=cameraFor(sampleExteriorCinema(seconds,{opening:true})).getWorldDirection(new THREE.Vector3());
    assert.ok(direction.y<=previousY+1e-12,'the camera never tilts upward, including during entry');previousY=direction.y;
  }
  sampleExteriorCinema(40,{opening:true});assert.deepEqual(sampleExteriorCinema(0,{opening:true}),initial,'restarting restores the empty logo sky');
});
test('the first approach has enough depth precision for the habitat end hatch',()=>{
  const shot=sampleExteriorCinema(12,{opening:true}),ship=createExteriorShip();ship.setCoreScale(2.6);
  try{
    ship.root.position.x=shot.shipX;ship.setAngle(shot.angle);ship.root.updateMatrixWorld(true);
    const hatch=ship.pods[1].localToWorld(new THREE.Vector3(EXTERIOR.podLength/2+1.84,-.5,1.28));
    const distance=hatch.distanceTo(new THREE.Vector3(...shot.eye));
    const depthStep=distance*distance*(shot.far-shot.near)/(shot.far*shot.near*(2**24-1));
    assert.ok(depthStep<.005,'the depth buffer separates the hatch face from its 0.02-unit raised label');
  }finally{ship.dispose();}
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
      const from=(definition.flightOrigin??0)+.1;
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
test('the optional bow view changes only scene 05 and keeps its moving dissolve and flight timing',()=>{
  const start=shotStart('mounted'),end=start+CINEMA_SHOTS.find(s=>s.id==='mounted').duration;
  const options={opening:true,penultimate:'bow'};
  for(const seconds of [0,37,64.8,start-1,end+1,110])
    assert.deepEqual(sampleExteriorCinemaFrame(seconds,options),sampleExteriorCinemaFrame(seconds,{opening:true}));
  const a=sampleExteriorCinema(start+1,options),b=sampleExteriorCinema(end-1,options);
  assert.equal(a.id,'mounted');assert.equal(a.mode,'fixed');assert.deepEqual(a.eye,b.eye);assert.deepEqual(a.target,b.target);
  assert.ok(b.shipX>a.shipX,'the external observer sees the ship advance');
  for(const seconds of [start-.5,start+1,end-.5]){
    const changed=sampleExteriorCinemaFrame(seconds,options),original=sampleExteriorCinemaFrame(seconds,{opening:true});
    assert.equal(changed.mix,original.mix,'the existing edit points stay fixed');
    for(const key of ['from','to'])if(changed[key]){
      for(const field of ['shipX','angle','probe','start','end','duration'])assert.deepEqual(changed[key][field],original[key][field]);
    }
  }
  const expected=sampleExteriorCinemaFrame(start-.3,options);
  sampleExteriorCinemaFrame(120,options);assert.deepEqual(sampleExteriorCinemaFrame(start-.3,options),expected);
});
test('scene 03 can preview scene 05 camera placement while keeping its own field of view and probe approach',()=>{
  const start=shotStart('distant'),bowStart=shotStart('mounted');
  for(const aspect of [.6,1,16/9])for(const offset of [1,4,7]){
    const options={opening:true,aspect,penultimate:'bow',approach:'bow'};
    const scene3=sampleExteriorCinema(start+offset,options),scene5=sampleExteriorCinema(bowStart+offset,options);
    const original=sampleExteriorCinema(start+offset,{opening:true,aspect});
    assert.equal(scene3.number,3);assert.equal(scene3.fov,original.fov);assert.equal(scene3.fov,38);
    for(const key of ['eye','target'])for(let axis=0;axis<3;axis++)
      assert.ok(Math.abs(scene3[key][axis]-(axis===0?scene3.shipX:0)-scene5[key][axis]+(axis===0?scene5.shipX:0))<1e-9);
    for(const key of ['shipX','probe','angle','start','end'])assert.deepEqual(scene3[key],original[key]);
  }
  for(const seconds of [0,37,48,59,83,110])
    assert.deepEqual(sampleExteriorCinemaFrame(seconds,{opening:true,penultimate:'bow',approach:'bow'}),
      sampleExteriorCinemaFrame(seconds,{opening:true,penultimate:'bow'}));
});
test('three scene 05 studies preserve all edit times and craft motion and seek to the same moving camera',()=>{
  const start=shotStart('mounted'),end=start+CINEMA_SHOTS.find(s=>s.id==='mounted').duration;
  for(const penultimate of ['bow-slide','underside','probe-wide']){
    const options={opening:true,approach:'bow',penultimate};
    const baseline={opening:true,approach:'bow'};
    for(const seconds of [0,37,54,64.8,start-1,end+1,110])
      assert.deepEqual(sampleExteriorCinemaFrame(seconds,options),sampleExteriorCinemaFrame(seconds,baseline));
    const a=sampleExteriorCinema(start+1,options),b=sampleExteriorCinema(end-1,options);
    assert.equal(a.number,5);assert.equal(a.mode,'follow');assert.ok(a.probe.latched);
    assert.notDeepEqual(a.eye.map((v,i)=>v-(i===0?a.shipX:0)),b.eye.map((v,i)=>v-(i===0?b.shipX:0)));
    for(const seconds of [start-.5,start+4,end-.5]){
      const preview=sampleExteriorCinemaFrame(seconds,options),original=sampleExteriorCinemaFrame(seconds,baseline);
      assert.equal(preview.mix,original.mix);
      for(const layer of ['from','to'])if(preview[layer])for(const key of ['shipX','angle','probe','start','end','duration'])
        assert.deepEqual(preview[layer][key],original[layer][key]);
    }
    const expected=sampleExteriorCinemaFrame(start+4,options);
    sampleExteriorCinemaFrame(120,options);assert.deepEqual(sampleExteriorCinemaFrame(start+4,options),expected);
  }
  assert.deepEqual(sampleExteriorCinema(start+4,{opening:true,penultimate:'unknown'}),sampleExteriorCinema(start+4,{opening:true}));
});
test('the B ending replaces 09, keeps its initial camera path, and tracks a ship receding forever',()=>{
  const options={opening:true,approach:'bow',ending:'underside'},start=shotStart('mounted');
  assert.deepEqual(exteriorCinemaShots(options).map(s=>s.number),[1,2,3,7,4,5]);
  assert.equal(exteriorCinemaShots(options).reduce((sum,s)=>sum+s.duration,0),OPENING_DURATION);
  for(const seconds of [0,37,54,64.8,start-1])
    assert.deepEqual(sampleExteriorCinemaFrame(seconds,options),sampleExteriorCinemaFrame(seconds,{opening:true,approach:'bow'}));
  for(const offset of [0,1,4,7.9,8]){
    const baseline={opening:true,approach:'bow',penultimate:'underside'};
    const b=offset===8?sampleExteriorCinemaFrame(start+offset,baseline).from:sampleExteriorCinema(start+offset,baseline);
    const ending=sampleExteriorCinema(start+offset,options);
    for(const key of ['target','fov','shipX','angle','probe'])assert.deepEqual(ending[key],b[key]);
    assert.deepEqual(ending.eye.slice(1),b.eye.slice(1));
    assert.ok(Math.abs(ending.eye[0]-b.eye[0]+offset*EXTERIOR_CRUISE_SPEED)<1e-9,'the observer slides in space instead of advancing with the hull');
  }
  for(const aspect of [.6,16/9,2.4]){
    const samples=[start+8,150,300,10000].map(seconds=>sampleExteriorCinema(seconds,{...options,aspect}));
    let previousSpan=Infinity;
    for(const shot of samples){
      assert.equal(shot.number,5);assert.equal(shot.id,'underside-ending');assert.equal(shot.done,false);assert.equal(shot.fade,0);
      assert.deepEqual(shot.eye,samples[0].eye,'the observer remains in space after settling');
      assert.ok(Math.abs(shot.target[0]-shot.shipX-((3-EXTERIOR.rotorX)*2.6+EXTERIOR.rotorX))<1e-9);
      const camera=cameraFor(shot,aspect),center=new THREE.Vector3(shot.shipX,0,0).project(camera);
      assert.ok(Math.abs(center.x)<1&&Math.abs(center.y)<1&&center.z<1,'the camera keeps the distant ship in view');
      const top=new THREE.Vector3(shot.shipX,32,0).project(camera),bottom=new THREE.Vector3(shot.shipX,-32,0).project(camera);
      const span=Math.abs(top.y-bottom.y);assert.ok(span<previousSpan);previousSpan=span;
      assert.equal(sampleExteriorCinemaFrame(shot.time,{...options,aspect}).to,null,'there is no final dissolve or restart');
    }
  }
  const epsilon=.0001;
  for(const boundary of [start+8]){
    const before=sampleExteriorCinema(boundary-epsilon,options),at=sampleExteriorCinema(boundary,options),after=sampleExteriorCinema(boundary+epsilon,options);
    for(let axis=0;axis<3;axis++)assert.ok(Math.abs((at.eye[axis]-before.eye[axis])/epsilon-(after.eye[axis]-at.eye[axis])/epsilon)<.002,'camera velocity settles without a jump');
  }
  const before=sampleExteriorCinemaFrame(86.75,options),later=sampleExteriorCinema(10000,options);
  assert.equal(later.shipSpeed,EXTERIOR_CRUISE_SPEED);assert.ok(later.shipX>before.shot.shipX);assert.equal(later.cruising,true);
  assert.deepEqual(sampleExteriorCinemaFrame(86.75,options),before,'seeking remains independent of history');
});
test('the B ending never stalls relative ship motion when its camera slide ends around 87 seconds',()=>{
  for(const aspect of [.6,16/9,2.4]){
    const options={opening:true,ending:'underside',aspect},dt=.01;
    for(let seconds=79.5;seconds<=96;seconds+=.25){
      const a=sampleExteriorCinema(seconds,options),b=sampleExteriorCinema(seconds+dt,options);
      const relativeSpeed=((b.shipX-b.eye[0])-(a.shipX-a.eye[0]))/dt;
      assert.ok(relativeSpeed>=EXTERIOR_CRUISE_SPEED-1e-8,`the ship keeps receding at ${seconds}s (${aspect} aspect)`);
      assert.ok(Math.abs((b.shipX-a.shipX)/dt-EXTERIOR_CRUISE_SPEED)<1e-8,'ship speed stays constant');
      assert.equal(sampleExteriorCinemaFrame(seconds,options).to,null);
    }
  }
});
test('planet transit slides past a stationary planet while the tiny ship crosses the frame',()=>{
  const start=shotStart('planet'),duration=CINEMA_SHOTS.find(s=>s.id==='planet').duration;
  const a=sampleExteriorCinema(start+.5,{opening:true}),b=sampleExteriorCinema(start+duration-.5,{opening:true});
  assert.ok(b.eye[0]>a.eye[0]&&b.target[0]>a.target[0]);assert.deepEqual(a.planet,b.planet);
  assert.ok(a.planet.position[2]+4200<0,'even the near surface of the planet stays behind the foreground ship');
  const camera=cameraFor(a),centerA=new THREE.Vector3(a.shipX,0,0).project(camera),centerB=new THREE.Vector3(b.shipX,0,0).project(cameraFor(b));
  assert.ok(centerA.x<0&&centerB.x>centerA.x,'small ship moves right from just left of the planet');
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
test('console logo uses Moonlander dial-up bands without leaking glow before its first band',()=>{
  assert.equal(sampleExteriorLogo(0).reveal,0);assert.equal(sampleExteriorLogo(0).opacity,0);
  assert.equal(EXTERIOR_LOGO.resolve,1.2);assert.equal(EXTERIOR_LOGO.steps,10);
  assert.equal(sampleExteriorLogo(EXTERIOR_LOGO.start+.119).reveal,0);
  for(let step=1;step<=10;step++){
    const boundary=EXTERIOR_LOGO.start+step*EXTERIOR_LOGO.resolve/10;
    assert.equal(sampleExteriorLogo(boundary-.001).reveal,(step-1)/10);
    assert.equal(sampleExteriorLogo(boundary).reveal,step/10);
  }
  assert.equal(sampleExteriorLogo(LOGO_SETTLED).clipPath,'inset(-40px -40px calc(0% - 40px) -40px)');
  assert.equal(sampleExteriorLogo(LOGO_SETTLED).reveal,1);
  assert.ok(EXTERIOR_LOGO.hold-LOGO_SETTLED>=2,'completed logo remains legible');
  assert.ok(Math.abs(EXTERIOR_LOGO.end-EXTERIOR_LOGO.hold-1.6)<1e-10,'the logo now takes 1.6 seconds to fade');
  assert.equal(sampleExteriorLogo(EXTERIOR_LOGO.hold).opacity,1);
  assert.equal(sampleExteriorLogo(EXTERIOR_LOGO.end).opacity,0);
  for(let time=LOGO_SETTLED;time<=EXTERIOR_LOGO.hold;time+=.05)assert.equal(sampleExteriorLogo(time).opacity,1,'the completed logo holds a constant brightness');
  let previous=1;
  for(let time=EXTERIOR_LOGO.hold;time<=EXTERIOR_LOGO.end;time+=.05){const opacity=sampleExteriorLogo(time).opacity;assert.ok(opacity<=previous,'the exit fades without flicker');previous=opacity;}
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
