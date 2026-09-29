const clamp=value=>Math.max(5,Math.min(100,value));
const INCIDENT_MIN_SECONDS=30*60,INCIDENT_SPREAD_SECONDS=30*60;
const RECOVERY_GRACE_SECONDS=20*60,FATIGUE_EXPOSURE_SECONDS=5*60;
const PROTECTED_ACTIVITIES=new Set(['medical','bunk','shower','toilet']);

// Game balance only: these thresholds and recovery rates are not a medical model.
export class CrewHealth {
  constructor({random=Math.random,onEvent=()=>{}}={}){
    this.random=random;this.onEvent=onEvent;this.value=100;this.condition=null;this.treatment=null;
    this.clock=0;this.exposure=0;this.serial=0;this.bandageTime=0;this.cooldown=0;
    this.smoking=false;
    this.scheduleIncident();this.lastStage='healthy';
  }
  get stage(){return this.treatment?'treating':!this.condition?this.value<99?'recovering':'healthy':this.value<=30?'critical':this.value<=55?'urgent':'warning';}
  get needsCare(){return Boolean(this.condition);}
  get urgent(){return Boolean(this.condition&&this.value<=55);}
  get critical(){return Boolean(this.condition&&this.value<=30);}
  get speedFactor(){return this.critical?.48:this.urgent?.68:this.condition?.kind==='fever'?.85:this.condition?.kind==='injury'?.92:1;}
  get duration(){return !this.condition?14:this.critical?36:this.condition.kind==='fever'?30:24;}
  // Running seconds, not cabin days. A missed opportunity also waits 30–60 minutes.
  scheduleIncident(){this.nextIncident=this.clock+INCIDENT_MIN_SECONDS+this.random()*INCIDENT_SPREAD_SECONDS;}
  emit(type){this.onEvent({type,kind:this.condition?.kind||null,source:this.condition?.source||null,stage:this.stage,value:this.value});}
  startCondition(kind,source='routine'){
    if(this.condition||this.treatment||!['injury','fever'].includes(kind))return false;
    this.condition={id:++this.serial,kind,source,age:0};this.value=Math.min(this.value,kind==='injury'?76:72);
    this.exposure=0;this.lastStage=this.stage;this.emit('onset');return true;
  }
  beginTreatment(){
    if(!this.condition||this.treatment)return false;
    this.treatment={id:this.condition.id,kind:this.condition.kind,elapsed:0,duration:this.duration};
    this.lastStage='treating';this.emit('treatment');return true;
  }
  cancelTreatment(){
    if(!this.treatment)return;
    this.treatment=null;this.lastStage=this.stage;this.emit('interrupted');
  }
  finishTreatment(){
    const course=this.treatment;
    if(!course||course.id!==this.condition?.id||course.elapsed<course.duration-.1)return false;
    this.value=Math.max(this.value,course.kind==='injury'?88:84);
    if(course.kind==='injury')this.bandageTime=180;
    this.condition=null;this.treatment=null;this.cooldown=RECOVERY_GRACE_SECONDS;this.exposure=0;
    this.scheduleIncident();this.lastStage=this.stage;this.emit('recovered');return true;
  }
  update(dt,{needs,activity=null,moving=false,climbing=false,treatmentTime=dt,smokingTime=0}={}){
    if(!(dt>0))return;
    const smoked=Number.isFinite(smokingTime)?Math.max(0,Math.min(dt,smokingTime)):0;
    this.smoking=smoked>0;
    if(this.smoking)this.value=clamp(this.value-smoked*.4);
    const exposedTime=Math.max(0,dt-this.cooldown);
    this.clock+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.bandageTime=Math.max(0,this.bandageTime-dt);
    if(this.condition){
      this.condition.age+=dt;
      if(this.treatment){
        this.treatment.elapsed+=treatmentTime;
        if(this.treatment.elapsed>2)this.value=Math.min(94,this.value+treatmentTime*2.0);
      }else{
        const strain=Math.max(0,30-needs.energy)+Math.max(0,25-needs.thirst);
        this.value=clamp(this.value-dt*((this.condition.kind==='fever'?.16:.11)+strain*.006+(activity==='gym'?.25:0)));
      }
      if(this.stage!==this.lastStage){this.lastStage=this.stage;if(this.urgent)this.emit('worsened');}
      return;
    }
    if(needs.energy>40&&needs.thirst>35&&needs.hunger>30)this.value=clamp(this.value+(dt-smoked)*.16);
    if(!exposedTime||PROTECTED_ACTIVITIES.has(activity)){
      // Rest and recovery must not bank fatigue or defer an overdue roll until departure.
      this.exposure=0;
      if(this.clock>=this.nextIncident)this.scheduleIncident();
      return;
    }
    const stressed=needs.hygiene<25||needs.energy<18||needs.thirst<15;
    this.exposure=Math.max(0,Math.min(FATIGUE_EXPOSURE_SECONDS,this.exposure+exposedTime*(stressed?1:-2)));
    if(this.clock<this.nextIncident)return;
    const fitting=['eva','airlock','innerHatch'].includes(activity);
    const exerting=fitting||climbing||(moving&&needs.energy<55)||activity==='gym';
    const fatigued=this.exposure>=FATIGUE_EXPOSURE_SECONDS;
    const injuryChance=exerting?(needs.energy<30?.2:.1):0;
    const feverChance=fatigued?.5:.35,roll=this.random();
    this.scheduleIncident();
    if(roll<injuryChance)this.startCondition('injury',fitting?'fitting':'stumble');
    else if(roll<injuryChance+feverChance)this.startCondition('fever',fatigued?'fatigue':'chills');
  }
}
