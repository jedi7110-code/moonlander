import {CABIN_SOUNDS,DROID_HUM_SOUND_IDS} from './sound-library.js';

// Mechanical transitions and travel are silent; every actual service task can
// hum, including cleaning, cooking, laundry, harvesting and handling supplies.
export function droidIsWorking(droid){
  const step=droid?.step;
  return Boolean(step?.kind==='work'&&step.action&&!droid.waiting&&!droid.returning&&
    !/^(door-|washer-(open|close|start)$|waste-(open|close)$)/.test(step.action));
}

export class DroidWorkAudio {
  constructor(audio,{random=Math.random}={}){
    this.audio=audio;this.random=random;this.time=0;this.nextAt=0;this.voice=null;this.lastId=null;
  }
  stop(){
    if(this.voice&&!this.voice.stopping&&!this.voice.ended)this.audio.stopVoice(this.voice);
    this.voice=null;
  }
  update(dt,droid){
    if(!(dt>0))return;
    this.time+=dt;
    if(this.droid!==droid){
      this.stop();this.droid=droid;this.active=false;this.prepared=false;this.nextAt=0;this.previous=null;
    }
    const active=droidIsWorking(droid),step=droid?.step,age=droid?.age??0;
    const previous=this.previous;
    this.previous={step,age};
    if(!active){this.stop();this.active=false;return;}
    if(active&&this.audio.enabled&&!this.prepared){
      this.prepared=true;
      for(const id of DROID_HUM_SOUND_IDS)void this.audio.loadDeferred?.(id);
    }
    const jump=dt>.1||(previous&&previous.step===step&&(age<previous.age||age-previous.age>dt+1e-6));
    if(jump){this.stop();this.nextAt=this.time+18+this.random()*22;}
    if(!this.active){this.nextAt=Math.max(this.nextAt,this.time+1+this.random()*2);this.active=true;}
    if(this.voice?.stopping){
      this.voice=null;this.nextAt=Math.max(this.nextAt,this.time+18+this.random()*22);
    }
    if(this.voice?.ended||this.time>=this.voiceEnd)this.voice=null;
    if(this.voice&&(this.audio.enabled===false||this.audio.audible===false))this.stop();
    if(jump)return;
    if(!this.voice&&this.time>=this.nextAt){
      // Let a melody finish naturally before this task ends. Short actions
      // simply stay silent rather than repeatedly cutting a tune mid-phrase.
      const remaining=step.duration-age;
      const candidates=DROID_HUM_SOUND_IDS.filter(id=>id!==this.lastId&&CABIN_SOUNDS[id].duration<=remaining);
      if(!candidates.length){this.nextAt=this.time+.5;return;}
      const id=candidates[Math.min(candidates.length-1,Math.floor(this.random()*candidates.length))];
      const duration=CABIN_SOUNDS[id].duration;
      this.lastId=id;this.voiceEnd=this.time+duration;
      // Consume unavailable/muted cues too: loading or unmuting never starts
      // an overdue song, and the robot never queues a backlog of melodies.
      this.nextAt=this.voiceEnd+18+this.random()*22;
      const p=droid.position;
      this.voice=this.audio.play(id,{position:{x:p.x,y:p.y+1.45,z:p.z}});
    }
    if(this.voice){
      const p=droid.position;Object.assign(this.voice.position??={},{x:p.x,y:p.y+1.45,z:p.z});
      this.audio.positionVoice?.(this.voice);
    }
  }
}
