import * as THREE from 'three';
import {box,cylinder,rod,ball,batchStatic} from './materials.js';
import {DROID_SPEC,DROID_POSTURE} from './droid-model.js';
import {LADDER} from './ladder-pose.js';
import {CABIN_LADDER} from './cabin-ladder.js';
import {CAT_BOWL,WASTE_INCINERATOR as WASTE} from './layout.js';
import {sampleDroidTurn} from './droid-turn.js';

const mix=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const V=(...v)=>new THREE.Vector3(...v),UP=V(0,1,0);
const lerpPoint=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));

// Local surface dimensions and vertical offset from the carrying hands.
// The live rig replaces these defaults with measurements of its actual props.
const LOADS={
  cargo:[{width:.61,front:.215,offsetY:-.27},{width:.53,front:.20,offsetY:-.27},{width:.61,front:.215,offsetY:-.27}],
  cloth:{width:.32,front:.12,offsetY:-.045},
  greens:{width:.38,front:.14,offsetY:.03},
  food:{width:.23,front:.07,offsetY:.08},
  waste:{wrapper:{width:.23,front:.025,offsetY:.08},scraps:{width:.30,front:.09,offsetY:0}}
};

function fitCarriedObject(out,p,loads){
  const a=p.action;
  const wastePickup=a==='cook-cleanup'&&p.age>p.duration*.5;
  const kind=p.carrying??((a==='waste-insert'||wastePickup)&&p.wasteKind?'waste':a==='cargo-pick'&&p.age>p.duration*.5?'cargo':
    ['laundry-pick','laundry-load','laundry-unload','laundry-fold'].includes(a)?'cloth':a==='harvest'?'greens':null);
  if(!kind||!out.hands||p.climb)return;
  const shape=kind==='cargo'?loads.cargo[p.cargoIndex??0]:kind==='waste'?loads.waste[p.wasteKind??'scraps']:loads[kind];
  const indices=['harvest','washer-open','washer-close'].includes(a)?[0]:[0,1];
  const q=new THREE.Quaternion().setFromAxisAngle(V(1,0,0),a==='food-pour'?-.9*smooth(p.age/1.4):0);
  const position=V(...out.hands[indices[0]]);
  if(indices.length===2)position.add(V(...out.hands[1])).multiplyScalar(.5);
  position.y+=shape.offsetY;
  if(indices.length===1)position.x+=shape.width/2;
  const contacts=[-1,1].map(side=>V(side*shape.width/2,-shape.offsetY,shape.front-.035).applyQuaternion(q));
  const wrists=[-1,1].map(side=>q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,-side*Math.PI/2,0))));
  // Keep the entire load within both fixed-length arms' reach, including low
  // shelves. Never clamp just one wrist and leave the object floating away.
  for(const i of indices){
    const side=i?1:-1,shoulder=V(side*DROID_SPEC.shoulderHalfWidth,.47,0).applyAxisAngle(V(1,0,0),out.lean).add(V(out.bodyX??0,out.hipHeight,out.bodyZ));
    const offset=contacts[i].clone().sub(V(0,-.041,.018).applyQuaternion(wrists[i]));
    const dx=position.x+offset.x-shoulder.x,dy=position.y+offset.y-shoulder.y,dz=position.z+offset.z-shoulder.z;
    const reach=DROID_SPEC.upperArm+DROID_SPEC.forearm-.006;
    const radius=Math.sqrt(Math.max(0,reach*reach-dx*dx)),length=Math.hypot(dy,dz);
    if(length>radius){position.y+=dy*(radius/length-1);position.z+=dz*(radius/length-1);}
  }
  out.handWeight=1;out.gripKinds=[];out.wristQuaternions=[];
  for(const i of indices){
    out.hands[i]=contacts[i].clone().add(position).toArray();
    out.gripKinds[i]='carry';out.wristQuaternions[i]=wrists[i].toArray();
  }
  out.load={kind,position:position.toArray(),quaternion:q.toArray(),indices};
}

function walkingFeet(distance,age){
  const period=DROID_SPEC.stepPeriod,stride=.58*period*DROID_SPEC.stance;
  return [-1,1].map(side=>{
    const phase=((distance/(.58*period)+(side<0?.5:0))%1+1)%1;
    const swing=clamp((phase-.64)/.36,0,1);
    const point=[side*.137,.099+.075*Math.sin(swing*Math.PI),.045+(phase<.64?stride*(.5-phase/.64):mix(-stride/2,stride/2,smooth(swing)))];
    return lerpPoint([side*.137,.099,.045],point,smooth(age/.25));
  });
}

// Rungs are fixed in ship space. Only the released limb moves between them;
// sampling the same height on descent reverses the motion without sliding.
export function droidLadderContact(height,side,hand){
  const spacing=LADDER.spacing,cycle=(height-CABIN_LADDER.rungBase)/(2*spacing);
  const sidePhase=side<0?.5:0,phase=cycle+sidePhase+(hand?.25:.125),lap=Math.floor(phase),f=phase-lap;
  const swing=clamp((f-.68)/.32,0,1),reach=smooth(swing);
  const rung=2*lap-2*sidePhase+(hand?6:1);
  const y=CABIN_LADDER.rungBase+(rung+2*reach)*spacing+(hand?0:.099+LADDER.radius);
  return {point:[side*(hand?.23:.137),y-height,.34-CABIN_LADDER.depth-(hand?.065:.075)*Math.sin(Math.PI*swing)],held:f<=.68,rung,swing};
}

// Hands are grip contacts in model coordinates. Each task eases into and out
// of a working pose; all links are still solved by the model's rigid-link IK.
export function sampleDroidServicePose(p,loads=LOADS){
  const t=p.age,d=p.duration,u=clamp(t/d,0,1),wave=Math.sin(t*2.8);
  const blend=smooth(t/.85)*smooth((d-t)/.85),hold=[[-.31,1.04,.40],[.31,1.04,.40]];
  const out={rest:p.rest,wakeAge:p.mode==='wake'?p.age:undefined,hipHeight:.905,lean:DROID_POSTURE.idleLean,nod:-DROID_POSTURE.idleLean*.6,bodyZ:DROID_POSTURE.bodyZ,hands:p.carrying?hold:undefined};
  let hands=null,hip=.905,lean=0,nod=.22;
  if(p.walking){
    const period=DROID_SPEC.stepPeriod,stride=.58*period*DROID_SPEC.stance;
    out.walkAmount=smooth(t/.3)*smooth((d-t)/.3);out.walkPhase=p.walkDistance/(.58*period);
    out.lean=mix(DROID_POSTURE.idleLean,DROID_POSTURE.walkLean,out.walkAmount);out.nod=-out.lean*.6;
    out.feet=walkingFeet(p.walkDistance,t);
    out.hipHeight+=.004*Math.cos(p.walkDistance/stride*Math.PI*2);
  }
  if(p.turn){
    const entry=p.turn.entryWalk,turn=sampleDroidTurn(p.turn,t,entry?walkingFeet(entry.distance,entry.age):undefined);
    out.feet=turn.feet;out.footYaws=turn.footYaws;out.bodyX=turn.bodyX;
    out.hipHeight-=.006*turn.lift;
    out.walkAmount=.25*turn.lift;out.walkPhase=(turn.step+turn.swing)/2;
  }
  if(p.climb){
    const weight=smooth(Math.min(Math.abs(p.y-p.climb.from),Math.abs(p.y-p.climb.to))/.4);
    const hands=[-1,1].map(side=>droidLadderContact(p.y,side,true));
    out.hipHeight=mix(out.hipHeight,.82,weight);out.lean=mix(out.lean,.12,weight);out.bodyZ=mix(out.bodyZ,-.045,weight);
    // Roll around the hand's long axis: knuckles face the cabin camera and
    // palms face the ladder. The grip marker still determines the wrist target.
    out.hands=hands.map(hand=>hand.point);out.handWeight=weight;out.gripKind='ladder';out.wristRotation=[-2.55,Math.PI,0];
    out.handGripWeights=hands.map(hand=>1-Math.sin(Math.PI*hand.swing));
    out.feet=[-1,1].map(side=>lerpPoint([side*.137,.099,.045],droidLadderContact(p.y,side,false).point,weight));
    out.nod=-.10;return out;
  }
  switch(p.action){
    case 'cargo-pick':{
      const lift=smooth((t-1.3)/1.3);hip=mix(.79,.905,lift);lean=.4*(1-lift);
      hands=[-1,1].map(side=>[side*.30,mix(.945,1.04,lift),mix(.73,.40,lift)]);break;
    }
    case 'cargo-place':hip=[.34,.83,.955][p.cargoIndex];lean=[.50,.10,.05][p.cargoIndex];hands=[[-.30,.27+p.cargoIndex*.65,.55],[.30,.27+p.cargoIndex*.65,.55]];break;
    case 'harvest':{
      const height=1.89-p.harvestRow*.62;hip=p.harvestRow===0?.965:p.harvestRow===2?.62:.905;
      nod=p.harvestRow===0?-.20:.23;hands=[[-.21,.91,.22],[.13,height+.015*wave,.40+.025*Math.cos(t*2.8)]];break;
    }
    case 'greens-place':lean=.45;hands=[[-.20,1.11,.74],[.20,1.11,.74]];break;
    case 'laundry-pick':hip=.46;lean=.20;hands=[[-.15,.40,.48],[.15,.40,.48]];break;
    case 'laundry-load':case 'laundry-unload':hip=.53;lean=.22;hands=[[-.13,.44,.47],[.13,.44,.47]];break;
    case 'washer-open':case 'washer-close':hip=.57;lean=.16;hands=[[-.22,.76,.11],[.21,.43,.43]];break;
    case 'washer-start':hands=[[-.23,.78,.07],[.21,.78,.47]];break;
    case 'laundry-fold':hip=.58;lean=.19;hands=[[-.18,.59,.47],[.18+.04*wave,.60,.46]];break;
    case 'food-pick':hands=[[-.15,1.11,.37],[.15,1.11,.37]];break;
    case 'food-pour':hip=.43;lean=.29;hands=[[-.13,.41,.44],[.13,.43,.42]];nod=.40;break;
    case 'scrub-toilet':hip=.44;lean=.24;hands=[[-.20,.62,.17],[.14+.07*wave,.68,.37]];nod=.35;break;
    case 'scrub-shower':lean=.16;hands=[[-.23,1.04,.12],[.10+.14*wave,1.27+.17*Math.cos(t*2.1),.59]];break;
    case 'cook-chop':lean=.45;hands=[[-.05,1.13,.70],[.25,1.19+.045*Math.sin(t*6),.73]];break;
    case 'cook-stir':lean=.45;hands=[[-.05,1.13,.73],[.31+.065*Math.cos(t*2.3),1.47,.79+.04*Math.sin(t*2.3)]];break;
    case 'cook-serve':lean=.45;hands=[[-.05,1.17,.75],[.31,1.20,.75]];break;
    case 'cook-cleanup':lean=.45;hands=[[-.18,1.13,.70],[.18,1.13,.70]];break;
    case 'door-open':case 'door-close':hands=[[-.23,.8,.03],[.24,1.13,.30]];break;
  }
  if(hands){
    const pickup=['cargo-pick','cook-cleanup','laundry-pick','laundry-unload','food-pick','harvest'].includes(p.action);
    const weight=p.action==='cargo-pick'?smooth(t/.85):blend;
    out.hipHeight=mix(out.hipHeight,hip,weight);out.lean=mix(out.lean,lean,weight);out.nod=mix(out.nod,nod,weight);
    out.bodyZ=mix(out.bodyZ,p.action?.startsWith('cook-')||p.action==='greens-place'?.1:0,weight);
    const holding=Boolean(p.carrying)||(pickup&&u>.5);
    out.handWeight=holding?1:weight;
    out.hands=hands.map((hand,i)=>holding?lerpPoint(hold[i],hand,weight):hand);
  }
  // Rest values belong to the charging pose, not the default working hip height.
  if(p.rest){out.hipHeight=mix(out.hipHeight,.837,p.rest);out.lean=mix(out.lean,.11,p.rest);out.nod=mix(out.nod,.63,p.rest);out.bodyZ=mix(out.bodyZ,-.028,p.rest);}
  if(p.action==='waste-insert'){
    const reach=smooth(t/1.05)*(1-smooth((t-1.95)/(d-1.95)));
    out.hipHeight=mix(.905,.50,reach);out.lean=mix(DROID_POSTURE.idleLean,.42,reach);out.bodyZ=mix(DROID_POSTURE.bodyZ,.10,reach);out.nod=.24*reach;
    out.hands=hold.map(([x])=>[x,mix(1.04,.58,reach),mix(.40,.70,reach)]);
    out.handGripWeights=[1-smooth((t-WASTE.depositAt)/.16),1-smooth((t-WASTE.depositAt)/.16)];
  }
  fitCarriedObject(out,p,loads);
  if(p.action==='waste-insert'&&!p.carrying){out.handWeight=smooth((d-t)/.75);out.load=null;}
  return out;
}

export function createDroidServiceRig(bay,ship){
  const root=new THREE.Group();root.name='Droid household tasks';
  const actorRoot=new THREE.Group();actorRoot.name='Droid navigation';root.add(actorRoot);
  actorRoot.add(bay.droid.root);
  const m={
    metal:new THREE.MeshStandardMaterial({color:0x8b938a,metalness:.72,roughness:.45}),
    dark:new THREE.MeshStandardMaterial({color:0x242b26,roughness:.85}),
    cloth:new THREE.MeshStandardMaterial({color:0xf4f1df,roughness:.94}),
    green:new THREE.MeshStandardMaterial({color:0x6b983e,roughness:.88}),
    bag:new THREE.MeshStandardMaterial({color:0xb99d5f,roughness:.88}),
    food:new THREE.MeshStandardMaterial({color:CAT_BOWL.foodColor,roughness:.9})
  };
  m.metal.userData.cabinKeepSurface=true;
  const props={};
  const prop=(name)=>{const g=new THREE.Group();g.name='Droid / '+name;root.add(g);props[name]=g;return g;};
  const cloth=prop('cloth');for(let i=0;i<3;i++)box(cloth,m.cloth,0,i*.045,0,.32,.048,.24,.013);
  const greens=prop('greens');box(greens,m.dark,0,-.03,0,.38,.055,.28,.015);
  for(let i=0;i<7;i++)ball(greens,m.green,(i%3-1)*.09,.05,Math.floor(i/3)*.07-.08,.068,.12,.05);
  const food=prop('food');box(food,m.bag,0,0,0,.23,.25,.14,.018);box(food,m.dark,0,.04,.075,.13,.065,.007);
  const waste=prop('waste'),wasteVariants={};
  for(const kind of ['wrapper','scraps']){
    const g=new THREE.Group();g.name='Discarded '+kind;
    if(kind==='wrapper'){
      box(g,m.bag,0,0,0,.23,.25,.05,.01);
      box(g,m.dark,0,.035,.029,.13,.065,.006);
      const fold=box(g,m.bag,0,.132,-.008,.22,.025,.012);fold.rotation.x=.5;
    }else{
      box(g,m.dark,0,-.02,0,.30,.17,.18,.02);
      for(let i=0;i<3;i++){const scrap=box(g,i===1?m.green:m.bag,(i-1)*.074,.075,0,.10,.052,.13,.008);scrap.rotation.z=(i-1)*.24;}
    }
    const mesh=batchStatic(g);mesh.name=g.name;waste.add(mesh);wasteVariants[kind]=mesh;
  }
  const brush=prop('brush');rod(brush,m.metal,[0,0,0],[0,-.22,.08],.013);box(brush,m.cloth,0,-.24,.09,.15,.06,.09,.009);
  const sponge=prop('sponge');box(sponge,m.cloth,0,0,.025,.11,.07,.055,.013);
  const spoon=prop('spoon');rod(spoon,m.metal,[0,0,0],[0,-.19,.015],.009);ball(spoon,m.metal,0,-.21,.015,.028,.012,.046);
  const knife=prop('knife');box(knife,m.dark,0,-.025,0,.025,.07,.023,.004);box(knife,m.metal,0,-.07,.05,.005,.055,.13,.002);
  const pot=prop('pot');cylinder(pot,m.metal,0,.115,0,.145,.22,.15,24);cylinder(pot,m.dark,0,.23,0,.14,.014,.14,24);
  for(const side of [-1,1])box(pot,m.dark,side*.20,.18,0,.11,.025,.04,.009);
  pot.position.set(-10.56,1.075,-.17);
  const board=prop('board');box(board,m.bag,0,0,0,.40,.025,.22,.012);board.position.set(-10.00,1.065,-.015);
  for(let i=0;i<7;i++)box(board,m.green,(i-3)*.04,.025,0,.025,.028,.095,.009);
  const stream=prop('kibble');for(let i=0;i<10;i++)ball(stream,m.food,(i%3-1)*.013,-i*.028,0,.012,.012,.012);
  const cargo=ship.cargo.map((source,i)=>{const g=source.clone(true);g.name='Handled supply '+i;root.add(g);return g;});
  const stored=ship.cargo.map((source,i)=>{const g=source.clone(true);g.name='Stored supply '+i;g.position.set(-1.20,.122+i*.65,-3.70);root.add(g);return g;});
  const measure=(g,offsetY)=>{
    g.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(V());
    return {width:size.x,front:bounds.max.z-g.position.z,offsetY};
  };
  const loads={cargo:cargo.map(g=>measure(g,-.27)),cloth:measure(cloth,-.045),greens:measure(greens,.03),food:measure(food,.08),
    waste:Object.fromEntries(Object.entries(wasteVariants).map(([kind,g])=>[kind,measure(g,kind==='wrapper'?.08:0)]))};
  const dropOrigins=Object.fromEntries(Object.keys(wasteVariants).map(kind=>{
    const pose=sampleDroidServicePose({action:'waste-insert',age:WASTE.depositAt,duration:WASTE.insertDuration,rest:0,carrying:'waste',wasteKind:kind},loads);
    return [kind,V(...pose.load.position).applyAxisAngle(UP,Math.PI).add(V(WASTE.x,0,WASTE.approachZ))];
  }));
  let lastStamp=null;
  function update(routine){
    const p=routine.pose,stamp=p.mode==='charging'?`charging/${routine.care.preparedMeals??0}/${routine.stored.length}/${routine.washerLoaded}`:[p.time,p.mode,p.action].join('/');if(stamp===lastStamp)return;lastStamp=stamp;
    ship.incinerator?.update(routine.incineratorOpen,routine.time<routine.incineratingUntil&&routine.incineratorOpen===0);
    const model=sampleDroidServicePose(p,loads),droid=bay.droid;
    actorRoot.position.set(p.x,p.y,p.z);actorRoot.rotation.y=p.yaw;
    droid.face.setExpression(p.mode==='charging'?'sleepy':'neutral');droid.update(p.time,'service',model);
    bay.cable.visible=p.rest>.9;bay.mode=p.mode;
    root.updateMatrixWorld(true);
    for(const g of Object.values(props))g.visible=false;
    for(const [i,g]of stored.entries())g.visible=routine.stored.includes(i);
    cargo.forEach(g=>g.visible=false);
    function held(g,offset=[0,0,0],both=false,index=1){
      g.visible=true;
      if(model.load&&(g===props[model.load.kind]||g===cargo[p.cargoIndex])){
        g.position.copy(root.worldToLocal(actorRoot.localToWorld(V(...model.load.position))));
        g.quaternion.setFromAxisAngle(UP,p.yaw).multiply(new THREE.Quaternion().fromArray(model.load.quaternion));
        return;
      }
      const grip=droid.arms[index].palm.grip.getWorldPosition(V());
      if(both)grip.add(droid.arms[1-index].palm.grip.getWorldPosition(V())).multiplyScalar(.5);
      g.position.copy(grip).add(V(...offset).applyAxisAngle(UP,p.yaw));g.rotation.set(0,p.yaw,0);
    }
    const a=p.action,t=p.age;
    for(const [kind,g]of Object.entries(wasteVariants))g.visible=kind===(routine.binWaste??p.wasteKind);
    if(p.carrying==='waste'||(a==='cook-cleanup'&&t>p.duration*.5))held(waste,[0,0,0],true);
    if(routine.binWaste){
      const elapsed=Math.max(0,routine.time-routine.wasteDroppedAt),f=smooth(elapsed/.42);
      const target=V(WASTE.x,.36,WASTE.z+.03);
      waste.visible=true;waste.position.copy(dropOrigins[routine.binWaste]).lerp(target,f);waste.rotation.set(.12*f,Math.PI,0);
    }
    if(p.carrying==='cargo'){held(cargo[routine.cargoIndex],[0,-.27,0],true);}
    if(a==='cargo-pick'&&t>p.duration*.5){held(cargo[routine.step.cargoIndex],[0,-.27,0],true);ship.cargo[routine.step.cargoIndex].visible=false;}
    if(a==='cargo-place'&&t>p.duration*.5){const i=routine.step.cargoIndex;cargo[i].position.copy(stored[i].position);}
    if(p.carrying==='cloth'||['laundry-pick','laundry-fold'].includes(a)||(a==='laundry-load'&&!routine.washerLoaded))held(cloth,[0,-.045,0],true);
    if(p.carrying==='greens'||a==='harvest')held(greens,[0,-.10,0],a!=='harvest',0);
    if(p.carrying==='food')held(food,[0,.08,0],true);
    if(a==='food-pour'&&routine.carriedFood){
      if(!model.load)food.rotation.x=-.9*smooth(t/1.4);
      if(t>1.5&&t<p.duration-1){held(stream,[0,-.03,.09],true);stream.position.y-=((t*1.7)%1)*.06;}
    }
    if(a==='scrub-toilet')held(brush);
    if(a==='scrub-shower')held(sponge);
    // The saucepan lives on the hob, including before cooking and after meals.
    pot.visible=true;
    if(a?.startsWith('cook-')){board.visible=a==='cook-chop';if(a!=='cook-cleanup')held(a==='cook-chop'?knife:spoon);}
    if(ship.washerDoor)ship.washerDoor.rotation.y=-routine.washerOpening*1.55;
    if(ship.washerClothes){
      ship.washerClothes.visible=Boolean(routine.washerLoaded);
      ship.washerClothes.rotation.z=routine.washerLoaded&&routine.time<routine.washingUntil?routine.time*6:0;
    }
  }
  return {root,actorRoot,update,props,cargo,stored,wasteVariants};
}
