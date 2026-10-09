import {FLOORS,EVA_PASSAGE,CAT_PORT,CAT_BOWL,WASTE_INCINERATOR,getStation} from './layout.js';
import {hatchOpening} from './delivery.js';
import {catPortOpening} from './cat-ports.js';
import {DROID_WALK_CYCLE_DISTANCE} from './pace.js';
import {BUNK_PHASE_SECONDS} from './bunk-visit.js';
import {CABIN_SOUNDS} from './sound-library.js';
import {KIBBLE_STREAM,KIBBLE_CONTACT_DELAY} from './kibble-timing.js';
import walkCycle from './milo-walk-cycle.json' with {type:'json'};

const station=(id,z=-1.5)=>{const s=getStation(id);return{x:(s.x-700)*.022,y:(870-FLOORS[s.floor].y)*.016+1,z};};
const locations={shower:station('shower',-2.8),toilet:station('toilet',-2.8),hatch:station('hatch'),inner:{x:(EVA_PASSAGE.x-700)*.022,y:(870-FLOORS[EVA_PASSAGE.floor].y)*.016+1,z:.78},washer:{x:-2.34,y:(870-FLOORS[1].y)*.016+.8,z:-3.73}};
const wasteLocation={x:WASTE_INCINERATOR.x,y:(870-FLOORS[WASTE_INCINERATOR.floor].y)*.016+.6,z:WASTE_INCINERATOR.z};
const bowlLocation={x:(CAT_BOWL.x-700)*.022,y:(870-FLOORS[CAT_BOWL.floor].y)*.016+CAT_BOWL.foodHeight,z:CAT_BOWL.depth};
const catDoorLocations=FLOORS.map(floor=>({x:(CAT_PORT.x-700)*.022,y:(870-floor.y)*.016+.045+CAT_PORT.height/2,z:CAT_PORT.wallZ+.055}));
const catVocalModes=new Set(['look','prone','walk','follow','fetch','idle']);
const bedStrokes={opening:'bedPiston',closing:'bedPiston',waking:'bedPiston',sealing:'bedPiston',extending:'bedSlide',entering:'bedSlide',leaving:'bedSlide',retracting:'bedSlide'};
const bedLocation={x:(getStation('bunk').x-700)*.022,y:(870-FLOORS[getStation('bunk').floor].y)*.016+.7,z:-.26};

// Read only simulation state. This advances while muted, so turning sound on
// never replays a backlog. Rendering, mirrors and multiple XR eyes cannot emit.
export class CabinSoundEvents {
  constructor(audio,{random=Math.random}={}){this.audio=audio;this.random=random;this.catVoiceTime=0;this.catVoice=null;this.doors=new Map();this.lids=new Map();this.steps=new Map();this.beats=new Map();this.previousBathroom=null;this.previousBathroomPhase=null;this.previousDroidStep=null;this.previousDelivery=null;this.deliveryAge=0;this.variant=0;}
  bunk(dt,visit){
    const previous=this.previousBunk,phase=visit?.phase,age=visit?.age??0;
    const changed=previous?.visit!==visit||previous?.phase!==phase;
    const discontinuity=dt>.1||(previous&&previous.visit===visit&&previous.phase===phase&&age<previous.age);
    if((changed||discontinuity)&&this.bedVoice){this.audio.stopVoice(this.bedVoice);this.bedVoice=null;}
    const id=bedStrokes[phase];
    // One finite stroke per new mechanical phase, never per render/frame.
    // Joining mid-stroke, seeking, muted/late loading or unpausing cannot replay it.
    if(previous&&changed&&!discontinuity&&id&&age<=dt+1e-6){
      const seconds=visit.seconds?.[phase]??BUNK_PHASE_SECONDS[phase];
      // The lid sound is a natural-speed stroke, not a fill for the whole
      // animation. Never slow it down to match a longer opening/closing.
      const rate=id==='bedPiston'?1:CABIN_SOUNDS[id].duration/seconds;
      this.bedVoice=this.audio.play(id,{position:bedLocation,rate});
    }
    this.previousBunk={visit,phase,age};
  }
  hungryCat(dt,cat){
    const now=this.catVoiceTime+=dt,motion=cat?.motion;
    if(this.catVoice?.cat!==cat)this.catVoice=cat?{cat,due:null,cooldown:0}:null;
    const voice=this.catVoice;if(!voice)return;
    // CatRoutine.hunger is fullness: 100 after eating, zero when starving.
    // Do not consume CatRoutine.random or change her needs / behaviour.
    const eligible=Number.isFinite(cat.hunger)&&cat.hunger<=35&&catVocalModes.has(cat.mode)&&motion&&
      !cat.bunkWake&&!cat.mouseChase?.controlled&&!motion.hidden&&!motion.portal&&!motion.hop;
    if(!eligible){voice.due=null;return;}
    // Waking / emerging from the lift never releases an overdue cry. Keep the
    // longer cooldown even if hunger or activity briefly crosses a threshold.
    if(voice.due===null){voice.due=Math.max(now+8+this.random()*10,voice.cooldown);return;}
    if(now+1e-9<voice.due)return;
    this.audio.play('catMeow',{position:{x:(motion.x-700)*.022,y:(870-motion.y)*.016+(motion.elevation??0)+.3,z:motion.z},volume:1});
    // No catch-up loop, including after mute or a large simulation step.
    voice.cooldown=voice.due=now+45+this.random()*45;
  }
  door(key,opening,position,volume=1){
    const previous=this.doors.get(key);let direction=0;
    if(previous){
      const delta=opening-previous.opening;direction=Math.abs(delta)>1e-6?Math.sign(delta):0;
      if(direction&&direction!==previous.direction)this.audio.play(direction>0?'doorOpen':'doorClose',{position,volume});
      if(opening<=.00001&&previous.opening>.00001)this.audio.play('latch',{position,volume:volume*.65});
    }
    this.doors.set(key,{opening,direction});
  }
  applianceLid(key,opening,position,dt,volume=1){
    if(!Number.isFinite(opening)){this.lids.delete(key);return;}
    const previous=this.lids.get(key);
    // Follow the visible hinge, not the next work-step token. First snapshots,
    // late frames and muted cycles establish state without catching up later.
    if(previous!==undefined&&dt<=.1){
      if(previous===0&&opening>0)this.audio.play('latch',{position,volume:volume*.5});
      if(previous>0&&opening===0)this.audio.play('applianceLid',{position,volume});
    }
    this.lids.set(key,opening);
  }
  stride(key,distance,moving,spacing,position,surface='boots'){
    const previous=this.steps.get(key),index=Math.floor(distance/spacing);
    if(previous&&moving&&distance>previous.distance&&distance-previous.distance<1.2&&(!previous.moving||index!==previous.index)){
      this.variant=(this.variant+1)%3;
      const id=`${surface==='ladder'?'ladderStep':'step'}${this.variant+1}`;
      this.audio.play(id,{position,volume:1,rate:1});
    }
    this.steps.set(key,{distance,index,moving});
  }
  droidFootfall(distance,moving,position){
    // Numerical tolerance keeps an exact landing from slipping one frame late.
    const spacing=DROID_WALK_CYCLE_DISTANCE/2,index=Math.floor(distance/spacing+1e-9),previous=this.steps.get('droid');
    // Each half-cycle wraps one visible foot from swing to planted. Do not
    // invent a contact on walk/resume, or catch up after a seek/teleport.
    if(moving&&previous?.moving&&index===previous.index+1&&distance>previous.distance&&distance-previous.distance<spacing){
      this.variant=(this.variant+1)%3;
      this.audio.play(`rubberStep${this.variant+1}`,{position,volume:1,rate:1});
    }
    this.steps.set('droid',{distance,index,moving});
  }
  beat(key,token,index,active,id,position,volume=1){
    const previous=this.beats.get(key);
    if(active&&previous&&previous.token===token&&index>previous.index)this.audio.play(id,{position,volume});
    this.beats.set(key,{token,index});
  }
  update(dt,{actor,brain,droid,airlock,care,cat}){
    if(!(dt>0))return;
    const audio=this.audio,bathroom=brain.bathroom,pose=bathroom?.pose;
    for(const id of ['shower','toilet'])this.door(id,bathroom?.id===id?(pose?.opening??0):droid?.door===id?droid.opening:0,locations[id],.75);
    this.door('inner',airlock?.opening??0,locations.inner);
    this.door('supply',care.phase==='unloading'?hatchOpening(care.delivery?.age??0):0,locations.hatch,1.1);
    // Use the same opening as the visible leaves; sound stays on each deck,
    // not on Lucy as she travels behind the closed doors. Small, quiet motors.
    for(let level=0;level<catDoorLocations.length;level++)this.door(`cat-${level}`,catPortOpening(cat?.motion?.portal,level),catDoorLocations[level],.40);
    this.hungryCat(dt,cat);
    this.bunk(dt,brain.bunkVisit);
    const feedStep=droid?.step,feedRate=feedStep?.actionRate??1,feedAge=(droid?.age??0)*feedRate;
    const pouring=feedStep?.action==='food-pour'&&Boolean(droid.carriedFood)&&!droid.waiting&&
      feedAge>=KIBBLE_STREAM.start+KIBBLE_CONTACT_DELAY&&feedAge<feedStep.duration*feedRate-KIBBLE_STREAM.finishLead+KIBBLE_CONTACT_DELAY;
    // One recorded stream at the bowl, independent of the approved bag rustle.
    // Reuse the voice while active; no source or random sound per visible grain.
    audio.setLoop('kibble-pour','kibblePour',Boolean(pouring),{position:bowlLocation});
    audio.setLoop('shower','shower',bathroom?.id==='shower'&&bathroom.phase==='use',{position:locations.shower});
    if(bathroom===this.previousBathroom&&bathroom?.id==='toilet'&&this.previousBathroomPhase==='use'&&bathroom.phase==='reopen')audio.play('flush',{position:locations.toilet});
    this.previousBathroom=bathroom;this.previousBathroomPhase=bathroom?.phase;
    const milo={x:(actor.x-700)*.022,y:(870-actor.y)*.016+.1,z:pose?.depth??.78};
    const walking=actor.busy&&!actor.climbing&&!actor.waitingForHatch&&!actor.waitingForCat&&!actor.waitingForDroid;
    this.stride('milo',(actor.walkDistance??0)*.022,walking,walkCycle.cycleDistance/2,milo);
    this.stride('bathroom',pose?.walkDistance??0,Boolean(pose?.moving),walkCycle.cycleDistance/2,milo);
    // Count ladder rungs from height, not time; waiting on the ladder is silent.
    // Height can increase or decrease; use travelled height for rung contacts.
    if(actor.climbing&&this.lastY!==undefined&&Math.abs(actor.y-this.lastY)<20){
      this.ladderDistance=(this.ladderDistance??0)+Math.abs(actor.y-this.lastY)*.016;
      this.stride('rungs',this.ladderDistance,true,.28,milo,'ladder');
    }else this.stride('rungs',this.ladderDistance??0,false,.28,milo,'ladder');
    this.lastY=actor.y;
    if(droid!==this.lidDroid){this.lids.clear();this.lidDroid=droid;}
    if(droid){
      const step=droid.step,p=droid.position,position={x:p.x,y:p.y+.65,z:p.z};
      const moving=step?.kind==='walk'&&!droid.waiting;
      this.droidFootfall(droid.walkDistance??0,moving,position);
      // One quiet stroke per pivot pair / rung, with silence between strokes.
      // Climbing follows travelled height, never a running buzz or wall clock.
      const driveProgress=step?.kind==='turn'&&step.turn?droid.age/step.duration*(step.turn.steps/2):
        step?.kind==='climb'&&step.from?Math.abs(p.y-step.from.y)/.28:
        step?.kind==='wake'?droid.age/Math.max(step.duration,1):-1;
      this.beat('droid-drive',step,Math.floor(driveProgress-.12),!droid.waiting&&driveProgress>=0,'servo',position);
      audio.setLoop('washer','washer',droid.washingUntil>droid.time,{position:locations.washer});
      this.applianceLid('washer',droid.washerOpening,locations.washer,dt);
      this.applianceLid('waste',droid.incineratorOpen,wasteLocation,dt,.75);
      // The case meets the shelf halfway through cargo-place in droid-service.
      // Do not play a heavy case impact for greens, plates or at the next step.
      this.beat('cargo-place',step,droid.age>(step?.duration??0)*.5?1:0,step?.action==='cargo-place'&&!droid.waiting&&dt<=.1,'metal',position,.45);
      if(step!==this.previousDroidStep&&step){
        if(step.action==='washer-start')audio.tone(740,.07,.009);
        if(step.action==='food-pick')audio.play('bag',{position});
      }
      const age=droid.age*(step?.actionRate??1);
      this.beat('bag',step,Math.floor((age-1.5)/.7),step?.action==='food-pour'&&Boolean(droid.carriedFood)&&age>1.5&&age<(step.duration*(step.actionRate??1)-1),'bag',position,.7);
      // The knife's authored y = 1.19 + .045*sin(age*6); contact is its low point.
      this.beat('chop',step,Math.floor((age*6+Math.PI/2)/(2*Math.PI)),step?.action==='cook-chop'&&!droid.waiting,'chop',position);
      this.previousDroidStep=step;
    }else{this.steps.delete('droid');this.beats.delete('droid-drive');this.beats.delete('cargo-place');audio.setLoop('washer','washer',false);}
    if(care.phase==='unloading'&&care.delivery===this.previousDelivery){
      const age=care.delivery.age;
      for(const impact of [1.35,1.53,1.71])if(this.deliveryAge<impact&&age>=impact&&age-this.deliveryAge<.2)audio.play('metal',{position:locations.hatch,volume:.85});
    }
    this.previousDelivery=care.delivery;this.deliveryAge=care.delivery?.age??0;
  }
}
