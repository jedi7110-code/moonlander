import {FLOORS,LADDER_X,CAT_BOWL,WASTE_INCINERATOR as WASTE} from './layout.js';
import {planDroidTurn,sampleDroidTurn} from './droid-turn.js';
import {DROID_STARTUP_SECONDS} from './droid-startup.js';
import {crewLadderPath,ladderPathsConflict} from './ladder-traffic.js';

export const DROID_JOBS=Object.freeze({
  cargo:'支援物資を倉庫へ運搬',harvest:'野菜を収穫',laundry:'衣類を洗濯',
  toilet:'トイレを清掃',shower:'シャワー室を清掃',cook:'料理',feed:'ルーシーの餌を補充'
});
export const DROID_HOME={x:-11.92,y:6.804,z:-.52,floor:0,yaw:0};
export const DROID_FLOORS=FLOORS.map(f=>(870-f.y)*.016);
// Metres from the shaft centre, with separate side holds for the two aisle depths.
export const DROID_LADDER_TRAFFIC=Object.freeze({droidWaitX:1.15,crewWaitX:1.35,crewClearX:1.5});
const STATIONS={cargo:'hatch',harvest:'plant',laundry:'grooming',toilet:'toilet',shower:'shower',cook:'galley'};
export const DROID_PACE=1.6;
export const DROID_LANE=1.48;
const LANE=DROID_LANE,SPEED=.58*DROID_PACE,CLIMB_SPEED=.40*DROID_PACE;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

// Scene-independent schedule. All inventory changes happen once, at the end
// of the corresponding hand action, never while travelling or while paused.
export class DroidRoutine {
  constructor({care,brain,actor,cat}={}){
    this.care=care;this.brain=brain;this.actor=actor;this.cat=cat;
    this.position={...DROID_HOME};this.time=0;this.steps=[];this.age=0;
    this.job=null;this.carrying=null;this.door=null;this.opening=0;
    this.washerOpening=0;this.washerLoaded=false;this.washingUntil=0;this.completed={};this.harvestRow=0;
    this.due={laundry:100,toilet:180,shower:270,cook:70};this.restUntil=12;
    this.stored=[];this.lastDelivery=null;this.walkDistance=0;this.returning=false;this.ladderClaim=false;
    this.wasteKind=null;this.binWaste=null;this.disposedWaste=0;this.incineratorOpen=0;this.incineratingUntil=0;
  }
  get step(){return this.steps[0]??null;}
  get docked(){return !this.job&&!this.steps.length;}
  get label(){return this.docked?'充電休止':this.waiting&&this.step?.ladderEntry?'ハシゴの空き待ち':this.returning?'充電台へ戻る':this.carrying==='waste'||this.step?.action?.startsWith('waste-')?'ごみを焼却ボックスへ':DROID_JOBS[this.job];}
  get station(){return this.returning?null:STATIONS[this.job];}
  get ladderPath(){return this.ladderClaim&&this.ladderRoute?{from:this.position.y,to:this.ladderRoute.to}:null;}
  get pose(){
    const s=this.step,u=s?smooth(this.age/s.duration):0;
    return {...this.position,mode:this.docked?'charging':s?.kind??'idle',job:this.job,
      // Keep authored gesture/contact timings together while shortening real time.
      action:s?.action??null,age:this.age*(s?.actionRate??1),duration:(s?.duration??1)*(s?.actionRate??1),time:this.time,
      carrying:this.carrying,walkDistance:this.walkDistance,harvestRow:s?.harvestRow??this.harvestRow,cargoIndex:s?.cargoIndex??this.cargoIndex??0,
      wasteKind:s?.wasteKind??this.wasteKind,
      walking:s?.kind==='walk'&&!this.waiting,
      turn:s?.turn??null,
      rest:this.docked?1:s?.kind==='wake'?1-u:s?.kind==='sleep'?u:0,
      climb:s?.kind==='climb'?{from:s.from.y,to:s.to.y,progress:u}:null};
  }
  occupied(job){
    const station=STATIONS[job];
    if(station&&(this.brain?.actStation===station||this.brain?.bathroom?.id===station))return true;
    if(job!=='feed')return false;
    const fetching=this.cat?.mode==='fetch'||this.cat?.pendingMove?.kind==='fetch';
    // A cat waiting outside our crossing is queued, not occupying the bowl.
    // Finish the current refill and leave so Lucy can enter; an active crossing
    // or a cat already eating keeps priority over the droid.
    const yielding=this.job==='feed'&&this.cat?.motion?.waitingForDroid&&!this.cat.motion.crossing?.active;
    return this.cat?.mode==='eat'||(fetching&&!yielding);
  }
  reserveForCrew(station,callback){
    if(this.station!==station){this.crewRequest=null;return false;}
    this.crewRequest=callback;return true;
  }
  blocksCrew(actor,dt=1/60){
    if(!this.ladderClaim)return false;
    if(!ladderPathsConflict(this.ladderPath,crewLadderPath(actor)))return false;
    if(actor.climbing)return true;
    const walk=actor.queue?.[0];
    if(walk?.type!=='walk')return false;
    const from=actor.x-LADDER_X,to=walk.x-LADDER_X;
    // Retargeting away from the shaft is always allowed, even from inside a hold.
    if(from*to>0&&Math.abs(to)>=Math.abs(from))return false;
    if(from*to>0&&Math.abs(to)*.022>DROID_LADDER_TRAFFIC.crewWaitX)return false;
    const next=Math.max(0,Math.abs(from)-actor.walkSpeed*Math.max(0,dt));
    return next*.022<=DROID_LADDER_TRAFFIC.crewWaitX;
  }
  available(job){
    if(this.occupied(job))return false;
    if(job==='cargo')return this.care.lastDelivery!==null&&this.care.phase!=='unloading'&&this.stored.length<3;
    if(job==='harvest')return this.brain.plants.ready>0&&this.care.supplies.food<this.care.capacity.food;
    if(job==='feed')return this.care.catBowl===0&&this.care.has('catfood');
    if(job==='cook')return this.care.has('food')&&!this.care.preparedMeals;
    return true;
  }
  observeDelivery(){
    if(this.lastDelivery===this.care.lastDelivery)return;
    this.lastDelivery=this.care.lastDelivery;this.stored=[];
    this.care.cargoHandling={delivery:this.lastDelivery,picked:[],stored:[]};
  }
  choose(){
    if(this.available('cargo'))return 'cargo';
    if(this.available('feed'))return 'feed';
    if(this.available('harvest'))return 'harvest';
    return Object.keys(this.due).filter(job=>this.time>=this.due[job]&&this.available(job))
      .sort((a,b)=>this.due[a]-this.due[b])[0]??null;
  }
  request(job){
    this.observeDelivery();
    if(!this.docked||!Object.hasOwn(DROID_JOBS,job)||!this.available(job))return false;
    this.job=job;this.returning=false;this.plan={...this.position};
    this.add('wake',DROID_STARTUP_SECONDS);this.walk(DROID_HOME.x,LANE,0);
    if(job==='cargo')this.planCargo();
    if(job==='harvest')this.planHarvest();
    if(job==='laundry')this.planLaundry();
    if(job==='toilet'||job==='shower')this.planCleaning(job);
    if(job==='cook')this.planCooking();
    if(job==='feed')this.planFeed();
    this.add('release',.1,()=>{
      this.returning=true;this.carrying=null;this.care.catBowlFilling=false;
      this.completed[job]=(this.completed[job]??0)+1;
      this.due[job]=this.time+({laundry:660,toilet:540,shower:720,cook:480}[job]??90);
      const resume=this.crewRequest;this.crewRequest=null;resume?.();
    });
    this.travel(0,DROID_HOME.x,LANE);this.walk(DROID_HOME.x,DROID_HOME.z,0,DROID_HOME.y);
    this.turn(0);this.add('sleep',2,()=>{
      this.job=null;this.returning=false;this.restUntil=this.time+24;
    });
    return true;
  }
  add(kind,duration,finish=null,extra={}){this.steps.push({kind,duration,finish,...extra});}
  act(action,duration,finish=null,extra={}){this.add('work',duration/DROID_PACE,finish,{action,actionRate:DROID_PACE,...extra});}
  turn(yaw){
    const d=angle(this.plan.yaw,yaw);if(Math.abs(d)<.01)return;
    const turn=planDroidTurn(this.plan.yaw,this.plan.yaw+d);
    turn.duration/=DROID_PACE;
    this.add('turn',turn.duration,null,{from:{...this.plan},to:{...this.plan,yaw:this.plan.yaw+d},turn});
    this.plan.yaw+=d;
  }
  walk(x,z,floor=this.plan.floor,y=DROID_FLOORS[floor]){
    const to={x,y,z,floor,yaw:this.plan.yaw};if(distance(this.plan,to)<.005)return;
    this.turn(Math.atan2(x-this.plan.x,z-this.plan.z));to.yaw=this.plan.yaw;
    this.add('walk',distance(this.plan,to)/SPEED,null,{from:{...this.plan},to});this.plan={...to};
  }
  travel(floor,x,z){
    this.walk(this.plan.x,LANE);
    if(floor!==this.plan.floor){
      const side=Math.sign(this.plan.x)||Math.sign(x)||-1;
      this.walk(side*DROID_LADDER_TRAFFIC.droidWaitX,LANE);
      this.add('ladder-wait',.1,null,{ladderEntry:true,ladderPath:{from:this.plan.y,to:DROID_FLOORS[floor]}});
      this.walk(0,LANE);this.walk(0,.34);this.turn(Math.PI);
      const to={...this.plan,floor,y:DROID_FLOORS[floor]};
      this.add('climb',Math.abs(to.y-this.plan.y)/CLIMB_SPEED,null,{from:{...this.plan},to});this.plan={...to};
      this.walk(0,LANE);
      this.walk((Math.sign(x)||side)*DROID_LADDER_TRAFFIC.droidWaitX,LANE);
      this.add('ladder-release',.01,()=>{this.ladderClaim=false;this.ladderRoute=null;});
    }
    this.walk(x,LANE);this.walk(x,z,floor);
  }
  enterRear(floor,x,z){
    this.travel(floor,-1.88,-1.22);this.walk(-1.88,-2.70,floor,DROID_FLOORS[floor]+.122);
    this.walk(x,z,floor,DROID_FLOORS[floor]+.122);this.turn(Math.PI);
  }
  leaveRear(){this.walk(-1.88,-2.70,this.plan.floor,DROID_FLOORS[this.plan.floor]+.122);this.walk(-1.88,-1.22);this.walk(-1.88,LANE);}
  guard(){this.add('guard',.1,null,{guard:true});}
  planCargo(){
    const delivery=this.lastDelivery;
    for(let i=0;i<3;i++){
      if(this.stored.includes(i))continue;
      this.travel(2,9.02+(i-1)*.70,1.05);this.turn(Math.PI);this.guard();
      this.act('cargo-pick',2.6,()=>{this.carrying='cargo';this.cargoIndex=i;if(this.lastDelivery===delivery)this.care.cargoHandling.picked.push(i);},{cargoIndex:i});
      this.enterRear(2,-1.20,-3.15);
      this.act('cargo-place',2.8,()=>{this.carrying=null;if(this.lastDelivery===delivery){this.stored.push(i);this.care.cargoHandling.stored.push(i);}},{cargoIndex:i});
      // Store sealed supplies as delivered; there is no unpacking or refuse.
      this.leaveRear();
    }
  }
  planHarvest(){
    this.harvestRow=Math.max(0,this.brain.plants.rows.findIndex(row=>row.growth>=1));
    this.travel(2,-7.27,-.04);this.turn(Math.PI);this.guard();
    this.brain.plants.rows.forEach((row,i)=>{
      if(row.growth<1)return;
      this.act('harvest',8,()=>{
        if(row.growth>=1&&this.care.supplies.food<this.care.capacity.food){row.growth=.05;this.care.supplies.food++;this.carrying='greens';}
      },{harvestRow:i});
    });
    this.travel(2,-10.6,.66);this.turn(Math.PI);this.act('greens-place',2.4,()=>{this.carrying=null;});
  }
  planLaundry(){
    this.enterRear(1,-1.04,-2.91);this.turn(Math.PI);
    this.act('laundry-pick',3,()=>{this.carrying='cloth';});
    this.walk(-2.34,-3.73,1,DROID_FLOORS[1]+.122);this.turn(Math.PI);this.guard();
    this.act('washer-open',1.8,()=>{this.washerOpening=1;});
    this.act('laundry-load',4,()=>{this.carrying=null;});
    this.act('washer-close',1.8,()=>{this.washerOpening=0;});
    this.act('washer-start',2,()=>{this.washingUntil=this.time+24/DROID_PACE;});
    this.act('wash',24);
    this.act('washer-open',1.8,()=>{this.washerOpening=1;});
    this.act('laundry-unload',4,()=>{this.carrying='cloth';});
    this.act('washer-close',1.8,()=>{this.washerOpening=0;});
    this.walk(-1.38,-3.90,1,DROID_FLOORS[1]+.122);this.turn(Math.PI);
    this.act('laundry-fold',7,()=>{this.carrying=null;});this.leaveRear();
  }
  planCleaning(job){
    const x=job==='toilet'?-7.04:-10.12;
    this.travel(1,x,.48);this.turn(Math.PI);this.guard();
    this.act('door-open',1.1,()=>{this.opening=1;},{door:job});
    this.walk(x,job==='toilet'?-2.74:-3.10,1,DROID_FLOORS[1]+.05);this.turn(Math.PI);
    this.act(job==='toilet'?'scrub-toilet':'scrub-shower',22);
    // Back out through the same open aperture before closing the door.
    this.walk(x,.48);this.turn(Math.PI);this.act('door-close',1.1,()=>{this.opening=0;this.door=null;},{door:job});
    this.walk(x,LANE);
  }
  planCooking(){
    // Chop beside the permanently placed saucepan, then step over to the hob.
    this.travel(2,-9.75,.66);this.turn(Math.PI);this.guard();
    this.act('cook-chop',9);
    this.walk(-10.25,.66);this.turn(Math.PI);this.act('cook-stir',16);
    this.act('cook-serve',3,()=>{this.preparedAt=this.time;if(this.care.has('food'))this.care.preparedMeals=1;});
    this.act('cook-cleanup',2.6,()=>{this.wasteKind='scraps';this.carrying='waste';},{wasteKind:'scraps'});
    this.planDisposal();
  }
  planFeed(){
    this.enterRear(2,-2.34,-3.90);this.act('food-pick',2,()=>{this.carriedFood=this.care.take('catfood');this.carrying=this.carriedFood?'food':null;});this.leaveRear();
    this.travel(2,(CAT_BOWL.x-700)*.022+.40,CAT_BOWL.depth+.48);this.turn(Math.atan2(-.40,-.48));this.guard();
    this.act('food-pour',6,()=>{
      this.carrying=null;
      if(this.carriedFood){
        if(this.care.catBowl===0){this.care.catBowl=1;this.wasteKind='wrapper';this.carrying='waste';}
        else this.care.supplies.catfood=Math.min(this.care.capacity.catfood,this.care.supplies.catfood+1);
      }
      this.carriedFood=false;this.care.catBowlFilling=false;
    });
    this.planDisposal();
  }
  planDisposal(){
    this.travel(WASTE.floor,WASTE.x,WASTE.approachZ);this.turn(Math.PI);
    this.act('waste-open',.9,()=>{this.incineratorOpen=1;});
    this.act('waste-insert',WASTE.insertDuration);
    this.act('waste-close',.9,()=>{
      this.incineratorOpen=0;if(this.binWaste)this.incineratingUntil=this.time+WASTE.burnDuration/DROID_PACE;
    });
    this.act('waste-burn',WASTE.burnDuration,()=>{this.binWaste=null;this.wasteKind=null;});
  }
  update(dt){
    if(!(dt>0))return;this.observeDelivery();
    // Small substeps also make accelerated studies and tests follow live timing.
    while(dt>1e-8){const tick=Math.min(dt,1/30);dt-=tick;this.advance(tick);}
  }
  advance(dt){
    this.time+=dt;
    if(this.docked){if(this.time>=this.restUntil){const job=this.choose();if(job)this.request(job);}return;}
    const s=this.step;if(!s)return;
    this.waiting=false;
    this.waitingForCat=Boolean(this.cat?.motion?.blocksDroid(this,dt));
    if(this.waitingForCat){this.waiting=true;return;}
    if(s.guard&&this.occupied(this.job)){this.waiting=true;return;}
    if(s.ladderEntry&&!this.ladderClaim){
      const crewNear=this.actor?.climbing||Math.abs((this.actor?.x??0)-LADDER_X)*.022<DROID_LADDER_TRAFFIC.crewClearX;
      if(crewNear&&ladderPathsConflict(s.ladderPath,crewLadderPath(this.actor))){this.waiting=true;return;}
      // Reserve only this remaining route. Separate decks can be used together,
      // and a vacated segment is reusable before the other climber has finished.
      this.ladderClaim=true;this.ladderRoute=s.ladderPath;
    }
    if(s.action==='food-pour')this.care.catBowlFilling=Boolean(this.carriedFood);
    this.age=Math.min(s.duration,this.age+dt);const u=this.age/s.duration;
    if(s.action==='waste-open')this.incineratorOpen=smooth(u);
    if(s.action==='waste-close')this.incineratorOpen=1-smooth(u);
    if(s.action==='waste-insert'&&!s.deposited&&this.age*s.actionRate>=WASTE.depositAt){
      s.deposited=true;
      if(this.carrying==='waste'){
        this.binWaste=this.wasteKind;this.wasteDroppedAt=this.time;this.carrying=null;this.disposedWaste++;
      }
    }
    if(s.from){
      for(const k of ['x','y','z','yaw'])this.position[k]=mix(s.from[k],s.to[k],u);
      if(s.turn)this.position.yaw=sampleDroidTurn(s.turn,this.age).yaw;
      if(s.kind==='walk')this.walkDistance+=SPEED*dt;
      if(u>=1)this.position.floor=s.to.floor;
    }
    if(s.action==='door-open'){this.door=s.door;this.opening=smooth(u);}
    if(s.action==='door-close')this.opening=1-smooth(u);
    if(s.action==='washer-open')this.washerOpening=smooth(u);
    if(s.action==='washer-close')this.washerOpening=1-smooth(u);
    if(!s.transferred&&((s.action==='laundry-load'&&u>=.65)||(s.action==='laundry-unload'&&u>=.35))){
      s.transferred=true;
      this.washerLoaded=s.action==='laundry-load';
      this.carrying=this.washerLoaded?null:'cloth';
    }
    if(this.age>=s.duration){
      // Carry the last walking footprints into the first pivot step.
      if(s.kind==='walk'&&this.steps[1]?.turn)this.steps[1].turn.entryWalk={distance:this.walkDistance,age:s.duration};
      this.steps.shift();this.age=0;s.finish?.();
    }
  }
}
