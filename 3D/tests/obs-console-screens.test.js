import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {ConsoleScreens,consoleTelemetry} from '../src/obs/console-screens.js';
import {CabinEnvironment,environmentDisplay} from '../src/obs/environment.js';
import {Supplies} from '../src/obs/state.js';
import {batchStatic} from '../src/obs/materials.js';
import {CabinStartupLighting} from '../src/obs/startup-lighting.js';

function canvas(){
  const labels=[],ctx=new Proxy({labels,fillText(value){labels.push(String(value));}},{get:(target,key)=>target[key]??(()=>{})});
  return{width:0,height:0,labels,getContext:()=>ctx};
}
function setup(){
  const original=globalThis.document;
  globalThis.document={createElement:canvas};
  const root=new Group(),screens=new ConsoleScreens();
  try{for(let i=0;i<3;i++)screens.add(root,-10.3+i*1.63,8.514,-.45,.9984,.61,i);}
  finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
  return{root,screens};
}

test('atmosphere values and hatch warnings come from the same live source as the header',()=>{
  const environment=new CabinEnvironment({random:()=>0}),brain={environment,hour:8.75};environment.update(45);
  let data=consoleTelemetry({brain,airlock:{opening:.5}}),header=environmentDisplay(environment);
  assert.equal(`${data.temperature.toFixed(1)}°C`,header.temperature);assert.equal(`${data.pressure.toFixed(1)} kPa`,header.pressure);
  assert.equal(data.shipTime,'08:45');assert.equal(data.innerDoor,'OPEN');assert.equal(data.fault,false);
  environment.triggerFault();environment.setStage(environment.fault.serial,'repair');data=consoleTelemetry({brain});
  assert.equal(data.fault,true);assert.equal(data.faultStage,'repair');
  environment.resolve(environment.fault.serial);assert.equal(consoleTelemetry({brain}).fault,false);
});

test('equipment changes load only while in use and the bus current balances its branches',()=>{
  const idle=consoleTelemetry({droid:{docked:true}});
  const meal=consoleTelemetry({brain:{state:'performing',cur:{id:'galley'}},droid:{docked:true}});
  const cooking=consoleTelemetry({droid:{docked:false,step:{action:'cook-stir'}}});
  const chopping=consoleTelemetry({droid:{docked:false,step:{action:'cook-chop'}}});
  assert.equal(meal.watts-idle.watts,412);assert.equal(cooking.watts-chopping.watts,412);
  const traveling=consoleTelemetry({brain:{state:'walking',cur:{id:'galley'}},droid:{docked:true}});
  assert.equal(traveling.watts,idle.watts,'walking toward an appliance does not turn it on');
  const scan=consoleTelemetry({brain:{state:'performing',cur:{id:'medical'}}});assert.equal(scan.watts-idle.watts,168);
  for(const data of [idle,meal,cooking,scan]){
    assert.equal(data.watts,data.loads.reduce((sum,load)=>sum+load.watts,0));
    assert.ok(Math.abs(data.voltage*data.amps-data.watts)<1e-8);assert.ok(data.loads.every(load=>load.watts<=load.rating));
  }
});

test('freight status and available portions follow actual supplies through delivery',()=>{
  const care=new Supplies();care.take('food');care.take('water');care.take('catfood');
  assert.deepEqual(consoleTelemetry({care}).stock,{food:2,water:3,catfood:2});
  care.request();assert.equal(consoleTelemetry({care}).freight,'queued');
  care.transmit();care.update(3);assert.equal(consoleTelemetry({care}).freight,'inbound');
  care.update(15);assert.equal(consoleTelemetry({care}).freight,'unloading');
  assert.deepEqual(consoleTelemetry({care}).stock,care.capacity);
});

test('three distinct recessed displays retain their texture after batching and ceiling-power changes',()=>{
  const {root,screens}=setup();assert.equal(root.children.length,3);
  const labels=screens.displays.map(display=>display.canvas.labels);
  assert.ok(labels[0].includes('ORBIT / ATTITUDE'));assert.ok(labels[1].includes('CABIN / ATMOSPHERE'));assert.ok(labels[2].includes('POWER / DISTRIBUTION'));
  assert.ok(!labels[0].includes('TEMPERATURE'));assert.ok(!labels[2].includes('MOON'));
  for(const mesh of root.children){
    assert.equal(mesh.position.z,-.45);assert.equal(mesh.geometry.index.count/3,2);
    assert.ok(Math.abs(mesh.material.map.image.width/mesh.material.map.image.height-.9984/.61)<.002);
  }
  const batch=batchStatic(root),lighting=new CabinStartupLighting([batch]);
  assert.equal(lighting.materials.length,0);lighting.update(3);
  const before=screens.displays.map(display=>display.texture.version);screens.update({clock:2});
  screens.displays.forEach((display,i)=>{
    assert.ok(batch.children.some(mesh=>mesh.material.map===display.texture));assert.equal(display.texture.version,before[i]+1);
  });lighting.dispose();
});

test('the pressure plot stores measured samples, stays bounded and stops updating while paused',()=>{
  const {screens}=setup();const state={brain:{environment:{clock:0,temperature:21.4,pressure:101.3}}};
  screens.update(state);const texture=screens.displays[1].texture,version=texture.version;
  for(let frame=0;frame<60;frame++)assert.equal(screens.update(state),false);
  assert.equal(texture.version,version);assert.equal(screens.history.length,1);
  state.brain.environment.clock=.7;assert.equal(screens.update(state),false);
  for(let i=1;i<=1000;i++){state.brain.environment.clock=i;state.brain.environment.pressure=101.2+i/10000;screens.update(state);}
  assert.equal(screens.history.length,121);assert.equal(screens.history[0].clock,880);
  assert.equal(screens.history.at(-1).pressure,state.brain.environment.pressure);
  state.brain.environment.clock=0;screens.update(state);assert.equal(screens.history.length,1);
});
