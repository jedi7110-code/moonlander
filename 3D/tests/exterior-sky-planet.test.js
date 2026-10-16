import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,DirectionalLight,Group} from 'three';
import {createExteriorPlanet,createExteriorSkyPlanet,EXTERIOR_PLANET_EMPHASIS} from '../src/obs/exterior-planet.js';
import {EXTERIOR_SYSTEM,createExteriorEphemeris,circularPeriod,visibleDiscFraction} from '../src/obs/exterior-system.js';
import {createDistantStars} from '../src/obs/exterior-stars.js';

const epoch=EXTERIOR_SYSTEM.epoch;
test('all four planets orbit the luminous star with distinct physical sizes, phases and Kepler periods',()=>{
  const ephemeris=createExteriorEphemeris();
  const frame=ephemeris.sample(epoch);
  assert.equal(frame.star.length(),0);
  assert.deepEqual(EXTERIOR_SYSTEM.planets.map(p=>p.id),['rust','current','ochre','ice']);
  const directions=frame.planetPositions.map(p=>p.clone().normalize());
  EXTERIOR_SYSTEM.planets.forEach((p,i)=>{
    assert.ok(Math.abs(frame.planetPositions[i].length()/p.orbitKm-1)<1e-12);
    assert.ok(Math.abs(p.periodSeconds-circularPeriod(p.orbitKm,EXTERIOR_SYSTEM.star.mu+p.mu))<1e-6);
    const start=frame.planetPositions[i].clone();
    const closed=ephemeris.planetPosition(i,epoch+p.periodSeconds,new Vector3());
    assert.ok(start.distanceTo(closed)/p.orbitKm<1e-12,'each orbit closes about the star');
    const quarter=ephemeris.planetPosition(i,epoch+p.periodSeconds/4,new Vector3());
    assert.ok(Math.abs(start.dot(quarter)/(p.orbitKm*p.orbitKm))<1e-12,'circular orbit sweeps equal angles in equal times');
    for(let j=0;j<i;j++)assert.ok(directions[i].angleTo(directions[j])>.5,'planets occupy different directions');
  });
  const b=EXTERIOR_SYSTEM.planets[0];
  assert.ok(b.periodSeconds/86400>265&&b.periodSeconds/86400<266,'the inner year follows its chosen mass and distance');
  assert.ok(frame.observer.distanceTo(frame.planetPositions[0])-b.radiusKm>9399.9999);
});

test('the four sky proxies retain physical angular sizes and one consistent lighting source',()=>{
  const light=new DirectionalLight();light.position.set(64,-110,92);
  const planet=createExteriorSkyPlanet({light,clock:()=>epoch}),cinema=createExteriorPlanet(),stars=createDistantStars();
  const camera=new PerspectiveCamera(38,4/5,.1,100000);camera.lookAt(planet.getViewDirection(new Vector3()));
  try{
    planet.follow(camera);
    assert.equal(planet.entries.length,4);
    const frame=planet.ephemeris.sample(epoch),expectedSun=frame.observer.clone().negate().normalize();
    const actualSun=light.position.clone().sub(light.target.position).normalize();
    assert.ok(expectedSun.distanceTo(actualSun)<1e-12,'the visible star and hull shadows share the physical source direction');
    planet.entries.forEach((entry,i)=>{
      const physicalDistance=frame.observer.distanceTo(frame.planetPositions[i]);
      assert.ok(Math.abs(entry.distanceKm/physicalDistance-1)<1e-12);
      const angular=Math.asin(entry.body.geometry.parameters.radius*entry.body.scale.x/entry.body.position.distanceTo(camera.position));
      assert.ok(Math.abs(angular-Math.asin(entry.spec.radiusKm/physicalDistance))<1e-12);
      const lightDirection=frame.planetPositions[i].clone().negate().normalize();
      assert.ok(entry.body.material.uniforms.lightDirection.value.distanceTo(lightDirection)<1e-12,'each planet is illuminated from the central star');
      assert.equal(entry.body.material.depthTest,false);assert.equal(entry.body.material.depthWrite,false);
      assert.equal(entry.body.frustumCulled,false);
      assert.ok(entry.body.renderOrder>stars.field.renderOrder&&entry.body.renderOrder<0);
      if(i)assert.ok(entry.angularRadius<.0003,'remote planets are genuinely unresolved or tiny, never enlarged decorative discs');
    });
    assert.ok(planet.entries[0].angularRadius>.2&&planet.entries[0].angularRadius<.35);
    assert.equal(camera.far,100000);
    assert.equal(cinema.body.material.depthWrite,true,'cinema keeps its independent background');
  }finally{planet.dispose();cinema.dispose();stars.dispose();}
});

test('physical local parallax is small and cruise origin resets cannot move the planetary sky',()=>{
  const ship={root:new Group()},camera=new PerspectiveCamera(38,1,.1,100000);
  const planet=createExteriorSkyPlanet({ship,clock:()=>epoch});
  try{
    camera.position.set(0,0,200);planet.follow(camera);const initial=planet.entries[0].direction.clone();
    ship.root.position.x=3600;camera.position.x=3600;planet.follow(camera);
    assert.ok(initial.distanceTo(planet.entries[0].direction)<1e-12,'shared origin reset leaves the physical observer unchanged');
    camera.position.x+=5000;planet.follow(camera);
    const angle=initial.angleTo(planet.entries[0].direction);
    assert.ok(angle>0&&angle<.0004,'a 5km camera move has kilometre-scale, not proxy-scale parallax');
  }finally{planet.dispose();}
});

test('real time drives axial rotation and the observer orbit independently without resetting on reload',()=>{
  let time=epoch;const clock=()=>time;
  const planet=createExteriorSkyPlanet({clock}),camera=new PerspectiveCamera();let reloaded;
  try{
    planet.follow(camera);const rotation=planet.body.quaternion.clone(),direction=planet.entries[0].direction.clone();
    time+=60;planet.follow(camera);
    assert.ok(Math.abs(rotation.angleTo(planet.body.quaternion)-2*Math.PI/(30*60))<1e-10,'one minute advances a 30-hour axial turn at 1x');
    assert.ok(Math.abs(direction.angleTo(planet.entries[0].direction)-2*Math.PI*60/EXTERIOR_SYSTEM.shipOrbit.periodSeconds)<1e-9,'apparent local sky motion follows the ship orbit, not the planetary year');
    reloaded=createExteriorSkyPlanet({clock});reloaded.follow(camera);
    assert.ok(reloaded.body.position.distanceTo(planet.body.position)<1e-8);
    assert.ok(reloaded.body.quaternion.angleTo(planet.body.quaternion)<1e-7);
    time=epoch+30*3600;planet.follow(camera);
    assert.ok(rotation.angleTo(planet.body.quaternion)<1e-7);
  }finally{planet.dispose();reloaded?.dispose();}
});

test('the emphasis study keeps the chosen ocean, gas and ice size ordering while physics stays unchanged',()=>{
  const planet=createExteriorSkyPlanet({clock:()=>epoch}),camera=new PerspectiveCamera(38,1,.1,100000);
  try{
    planet.follow(camera);
    const physical=planet.entries.map(entry=>({direction:entry.direction.clone(),distance:entry.distanceKm,radius:entry.angularRadius,scale:entry.body.scale.x,light:entry.body.material.uniforms.lightDirection.value.clone()}));
    const visibility=planet.sunVisibility;
    planet.setEmphasis(true);planet.follow(camera);
    planet.entries.forEach((entry,i)=>{
      assert.equal(entry.distanceKm,physical[i].distance);
      assert.ok(entry.direction.distanceTo(physical[i].direction)<1e-12);
      assert.equal(entry.angularRadius,physical[i].radius);
      assert.ok(entry.body.material.uniforms.lightDirection.value.distanceTo(physical[i].light)<1e-12);
      if(i){
        assert.ok(entry.body.visible);assert.equal(entry.marker.visible,false);
        assert.ok(Math.abs(entry.displayAngularRadius*360/Math.PI-EXTERIOR_PLANET_EMPHASIS[entry.spec.id])<1e-12);
      }else assert.equal(entry.body.scale.x,physical[i].scale,'the nearby rocky planet keeps its established size');
    });
    assert.ok(planet.entries[1].body.scale.x>planet.entries[2].body.scale.x);
    assert.ok(planet.entries[2].body.scale.x>planet.entries[3].body.scale.x);
    assert.equal(planet.sunVisibility,visibility,'visual enlargement cannot alter physical illumination or eclipse checks');
    planet.setEmphasis(false);planet.follow(camera);
    planet.entries.forEach((entry,i)=>assert.equal(entry.body.scale.x,physical[i].scale,'physical size can be restored in place'));
  }finally{planet.dispose();}
});

test('planetary occultations cover the stellar disc continuously, including partial transits',()=>{
  assert.equal(visibleDiscFraction(.005,.3,0),0);
  assert.equal(visibleDiscFraction(.005,.3,.4),1);
  const partial=visibleDiscFraction(.005,.3,.3);
  assert.ok(partial>.49&&partial<.51);
  assert.ok(Math.abs(visibleDiscFraction(.005,.3,.3-1e-8)-visibleDiscFraction(.005,.3,.3+1e-8))<.00001);
  assert.ok(visibleDiscFraction(.3,.005,0)>.99,'a smaller foreground planet only blocks its own area');
});
