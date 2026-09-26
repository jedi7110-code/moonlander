import {sampleCondensate} from './condensate.js';

export class CabinAudio {
  constructor(){this.enabled=false;this.context=null;this.stepTime=0;this.dripClock=0;this.dripImpact=-1;this.dripState={};}
  async toggle(){
    if(!this.context){
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return false;
      this.context=new Context();this.master=this.context.createGain();this.master.gain.value=0;this.master.connect(this.context.destination);
      for(const frequency of [48,96]){const oscillator=this.context.createOscillator(),gain=this.context.createGain();oscillator.frequency.value=frequency;gain.gain.value=frequency===48?.055:.018;oscillator.connect(gain).connect(this.master);oscillator.start();}
      const buffer=this.context.createBuffer(1,this.context.sampleRate*2,this.context.sampleRate),samples=buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      const fan=this.context.createBufferSource(),filter=this.context.createBiquadFilter();
      fan.buffer=buffer;fan.loop=true;filter.type='lowpass';filter.frequency.value=380;
      this.fanGain=this.context.createGain();this.fanGain.gain.value=.012;
      fan.connect(filter).connect(this.fanGain).connect(this.master);fan.start();
    }
    await this.context.resume();this.enabled=!this.enabled;this.master.gain.setTargetAtTime(this.enabled?.55:0,this.context.currentTime,.2);return this.enabled;
  }
  tone(frequency,duration=.12,volume=.025,type='sine'){
    if(!this.enabled)return;
    const now=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type;osc.frequency.value=frequency;gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(this.master);osc.start();osc.stop(now+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  waterDrop(index,proximity){
    if(!this.enabled)return;
    const now=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain();
    // Brief resonant water plip; a soft attack avoids a mechanical click.
    const pitch=[760,1080,850,960,710,1020][index%6],volume=.007+.012*Math.max(0,Math.min(1,proximity));
    osc.type='sine';osc.frequency.setValueAtTime(pitch,now);osc.frequency.exponentialRampToValueAtTime(pitch*1.65,now+.055);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+.20);
    osc.connect(gain).connect(this.master);osc.start(now);osc.stop(now+.21);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  update(dt,walking,plantProximity=0,elapsed=this.dripClock+dt){
    if(this.fanGain)this.fanGain.gain.setTargetAtTime(.012+.028*Math.max(0,Math.min(1,plantProximity)),this.context.currentTime,.4);
    this.stepTime-=dt;
    if(walking&&this.stepTime<=0){this.tone(83,.06,.055,'triangle');this.stepTime=.47;}
    this.dripClock=elapsed;
    const state=sampleCondensate(elapsed,this.dripState);
    if(state.impactIndex>this.dripImpact&&state.impactAge<Math.min(.12,Math.max(0,dt)+.002))this.waterDrop(state.impactIndex,plantProximity);
    // Advance even when muted: enabling sound must not replay previous drops.
    this.dripImpact=state.impactIndex;
  }
  pause(paused){if(this.context)this.master.gain.setTargetAtTime(this.enabled&&!paused?.55:0,this.context.currentTime,.15);}
  dispose(){this.context?.close();}
}
