export class CabinAudio {
  constructor(){this.enabled=false;this.context=null;this.stepTime=0;}
  async toggle(){
    if(!this.context){
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return false;
      this.context=new Context();this.master=this.context.createGain();this.master.gain.value=0;this.master.connect(this.context.destination);
      for(const frequency of [48,96]){const oscillator=this.context.createOscillator(),gain=this.context.createGain();oscillator.frequency.value=frequency;gain.gain.value=frequency===48?.055:.018;oscillator.connect(gain).connect(this.master);oscillator.start();}
    }
    await this.context.resume();this.enabled=!this.enabled;this.master.gain.setTargetAtTime(this.enabled?.55:0,this.context.currentTime,.2);return this.enabled;
  }
  tone(frequency,duration=.12,volume=.025,type='sine'){
    if(!this.enabled)return;
    const now=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type;osc.frequency.value=frequency;gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(this.master);osc.start();osc.stop(now+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  update(dt,walking){
    this.stepTime-=dt;
    if(walking&&this.stepTime<=0){this.tone(83,.06,.055,'triangle');this.stepTime=.47;}
  }
  pause(paused){if(this.context)this.master.gain.setTargetAtTime(this.enabled&&!paused?.55:0,this.context.currentTime,.15);}
  dispose(){this.context?.close();}
}
