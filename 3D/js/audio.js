// Original Moonlander recordings share one Web Audio context.
const FILES={beam:'beam.wav',charge:'beam-tame.wav',hit:'beamhit.wav',jet:'jet.wav',landing:'landing.wav',explosion:'explosion.wav',rescue:'rescue-1.wav',hatch:'hatchopen.wav',launch:'escape-jet.wav',step:'footsteps1.wav'};
export class AudioBus {
  constructor(){this.context=null;this.buffers=new Map();this.pending=new Map();this.loops=new Map();this.voices=new Set();this.muted=false;this.paused=false;}
  unlock(){
    try{if(!this.context){this.context=new (window.AudioContext||window.webkitAudioContext)();this.master=this.context.createGain();this.master.gain.value=this.muted?0:.32;this.master.connect(this.context.destination);for(const key of Object.keys(FILES))this.load(key);}
      if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
    }catch{/* Unsupported audio must not interrupt play. */}
  }
  async load(name){
    if(this.buffers.has(name))return this.buffers.get(name);
    if(this.pending.has(name))return this.pending.get(name);
    const work=fetch(`/assets/sound/${FILES[name]}`).then(r=>{if(!r.ok)throw new Error('Audio unavailable');return r.arrayBuffer();}).then(data=>this.context.decodeAudioData(data)).then(buffer=>{this.buffers.set(name,buffer);return buffer;}).catch(()=>null);
    this.pending.set(name,work);return work;
  }
  play(name,volume=1,loop=false){
    if(!this.context||this.muted||this.paused||!this.buffers.has(name))return null;
    if(loop&&this.loops.has(name))return this.loops.get(name);
    if(this.voices.size>24)return null;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers.get(name);source.loop=loop;gain.gain.value=volume;source.connect(gain);gain.connect(this.master);source.start();
    const voice={source,gain};this.voices.add(voice);if(loop)this.loops.set(name,voice);
    source.onended=()=>{this.voices.delete(voice);source.disconnect();gain.disconnect();};return voice;
  }
  stopLoop(name){const v=this.loops.get(name);if(!v)return;this.loops.delete(name);const t=this.context.currentTime;v.gain.gain.setTargetAtTime(0,t,.03);try{v.source.stop(t+.18);}catch{}}
  update({thrust,charge,launch}){for(const [key,active,volume]of[['jet',thrust,.45],['charge',charge,.16],['launch',launch,.5]]){if(active)this.play(key,volume,true);else this.stopLoop(key);}}
  setMuted(value){this.muted=value;if(this.master)this.master.gain.setTargetAtTime(value||this.paused?0:.32,this.context.currentTime,.03);if(value)for(const key of this.loops.keys())this.stopLoop(key);}
  setPaused(value){this.paused=value;if(this.master)this.master.gain.setTargetAtTime(value||this.muted?0:.32,this.context.currentTime,.03);if(value)for(const key of this.loops.keys())this.stopLoop(key);}
  stop(){for(const key of this.loops.keys())this.stopLoop(key);for(const v of this.voices){try{v.source.stop();}catch{}}}
}
