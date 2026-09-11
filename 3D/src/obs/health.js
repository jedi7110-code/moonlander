const clamp=value=>Math.max(5,Math.min(100,value));

// Game balance only: these thresholds and recovery rates are not a medical model.
export class CrewHealth {
  constructor({random=Math.random,onEvent=()=>{}}={}){
    this.random=random;this.onEvent=onEvent;this.value=100;this.condition=null;this.treatment=null;
    this.clock=0;this.exposure=0;this.serial=0;this.bandageTime=0;this.cooldown=90;
    this.nextIncident=150+random()*90;this.lastStage='healthy';
  }
  get stage(){return this.treatment?'treating':!this.condition?this.value<99?'recovering':'healthy':this.value<=30?'critical':this.value<=55?'urgent':'warning';}
  get needsCare(){return Boolean(this.condition);}
  get urgent(){return Boolean(this.condition&&this.value<=55);}
  get critical(){return Boolean(this.condition&&this.value<=30);}
  get speedFactor(){return this.critical?.48:this.urgent?.68:this.condition?.kind==='fever'?.85:this.condition?.kind==='injury'?.92:1;}
  get duration(){return !this.condition?14:this.critical?36:this.condition.kind==='fever'?30:24;}
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
    this.condition=null;this.treatment=null;this.cooldown=180;this.exposure=0;
    this.nextIncident=this.clock+240+this.random()*120;this.lastStage=this.stage;this.emit('recovered');return true;
  }
  update(dt,{needs,activity=null,moving=false,climbing=false,treatmentTime=dt}={}){
    if(!(dt>0))return;
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
    if(needs.energy>40&&needs.thirst>35&&needs.hunger>30)this.value=clamp(this.value+dt*.16);
    const stressed=needs.hygiene<25||needs.energy<18||needs.thirst<15;
    this.exposure=Math.max(0,this.exposure+dt*(stressed?1:-2));
    if(this.cooldown||['medical','bunk','shower','toilet'].includes(activity))return;
    if(this.exposure>=45){this.startCondition('fever','fatigue');return;}
    if(this.clock<this.nextIncident)return;
    if(['eva','airlock','innerHatch'].includes(activity))this.startCondition('injury','fitting');
    else if(climbing||(moving&&needs.energy<55)||activity==='gym')this.startCondition('injury','stumble');
    else if(this.random()<.5)this.startCondition('fever','chills');
    else this.nextIncident=this.clock+30;
  }
}
