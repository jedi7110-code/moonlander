import {CABIN_SOUNDS,LOUNGE_VOICE_IDS} from './sound-library.js';

// One shuffled, finite conversation per seated visit. Simulation time owns the
// sequence; mute and late loading can only join its current clip, never a queue.
export function loungeVoiceSequence(duration,random=Math.random,previousId=null){
  const clips=[];let bag=[],start=.65,last=previousId;
  while(start<duration-1){
    if(!bag.length)bag=[...LOUNGE_VOICE_IDS];
    const remaining=duration-start-.25;
    let candidates=bag.filter(id=>id!==last&&CABIN_SOUNDS[id].duration<=remaining);
    if(!candidates.length)candidates=LOUNGE_VOICE_IDS.filter(id=>id!==last&&CABIN_SOUNDS[id].duration<=remaining);
    if(!candidates.length){
      if(remaining<2.5)break;
      candidates=LOUNGE_VOICE_IDS.filter(id=>id!==last&&CABIN_SOUNDS[id].duration===5);
    }
    const id=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
    const end=Math.min(duration-.25,start+CABIN_SOUNDS[id].duration);
    clips.push({id,start,end});bag=bag.filter(key=>key!==id);last=id;
    start=end+.30+random()*.45;
  }
  return clips;
}
export class LoungeConversationAudio {
  constructor(audio,{random=Math.random}={}){this.audio=audio;this.random=random;this.plan=null;this.voice=null;this.clip=null;this.previousId=null;}
  stop(){if(this.voice&&!this.voice.stopping&&!this.voice.ended)this.audio.stopVoice(this.voice);this.voice=null;}
  update(dt,brain){
    if(!(dt>0))return;
    const plan=brain?.loungeCompanion,audio=this.audio;
    if(this.plan!==plan){this.stop();this.plan=plan;this.clips=null;this.clip=null;this.finishedClip=null;this.prepared=false;}
    if(plan&&audio.enabled&&!this.prepared){
      this.prepared=true;
      // Load beside the final approach, never during the cabin connection.
      for(const id of LOUNGE_VOICE_IDS)void audio.loadDeferred?.(id);
    }
    const active=plan&&brain.state==='performing'&&brain.leisure==='conversation'&&plan.peer.active&&plan.peer.step?.kind==='relax';
    if(!active){this.stop();return;}
    this.clips??=loungeVoiceSequence(plan.age+brain.performT,this.random,this.previousId);
    const clip=this.clips.find(clip=>plan.age>=clip.start&&plan.age<clip.end);
    if(this.voice?.ended&&!this.voice.stopping){this.finishedClip=this.clip;this.voice=null;}
    if(this.clip!==clip||this.voice?.stopping){this.stop();this.clip=clip;}
    if(!clip||this.finishedClip===clip)return;
    const position={x:(plan.seatX+plan.peer.position.x)/2,y:plan.peer.position.y+1.3,z:.06};
    if(!this.voice){
      this.voice=audio.play(clip.id,{position,offset:plan.age-clip.start});
      if(this.voice)this.previousId=clip.id;
    }
    if(this.voice){
      const fade=Math.max(0,Math.min(1,(clip.end-plan.age)/.3));
      this.voice.volume=CABIN_SOUNDS[clip.id].gain*fade;
      audio.positionVoice?.(this.voice);
    }
  }
}
