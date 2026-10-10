import {CABIN_SOUNDS,CABIN_AUDIO_BASE} from './sound-library.js';
import {PLANT,FLOORS} from './layout.js';
import {CabinPlaybackSession} from './audio-unlock.js';

const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const plantFan={x:(PLANT.x-700)*.022+2.03,y:(870-FLOORS[PLANT.floor].y)*.016+2.18,z:-.65};

export class CabinAudio {
  constructor({createContext=()=>{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;return Context?new Context():null;},fetchAudio=(...args)=>fetch(...args),ambience=true,enabled=false,playbackSession=new CabinPlaybackSession()}={}){
    this.enabled=enabled;this.unlocked=false;this.paused=false;this.context=null;this.createContext=createContext;this.fetchAudio=fetchAudio;
    this.playbackSession=playbackSession;
    this.buffers=new Map();this.voices=new Set();this.loops=new Map();this.failures=[];this.disposed=false;
    this.ambience=ambience;
    this.listener={x:0,y:3.4,z:1,rightX:1,rightY:0,rightZ:0,overview:true,focus:0};
  }
  prepare(){
    if(this.disposed)return false;
    if(!this.context){
      this.context=this.createContext();if(!this.context)throw new Error('Web Audio unavailable');
      this.master=this.context.createGain();this.master.gain.value=0;this.master.connect(this.context.destination);
      if(this.ambience){
      this.ambientGain=this.context.createGain();this.ambientGain.gain.value=.4;this.ambientGain.connect(this.master);
      for(const frequency of [48,96]){const oscillator=this.context.createOscillator(),gain=this.context.createGain();oscillator.frequency.value=frequency;gain.gain.value=frequency===48?.055:.018;oscillator.connect(gain).connect(this.ambientGain);oscillator.start();}
      const buffer=this.context.createBuffer(1,this.context.sampleRate*2,this.context.sampleRate),samples=buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      const fan=this.context.createBufferSource(),filter=this.context.createBiquadFilter();
      fan.buffer=buffer;fan.loop=true;filter.type='lowpass';filter.frequency.value=380;
      this.fanGain=this.context.createGain();this.fanGain.gain.value=.012;
      fan.connect(filter).connect(this.fanGain).connect(this.ambientGain);fan.start();this.update();
      }
    }
    return true;
  }
  unlock({gesture=true}={}){
    if(this.disposed||!this.enabled||this.paused)return false;
    // Only an input gesture may start a fresh page's audio. Restoration is
    // allowed after activation, but never changes the user's on/off choice.
    if(!gesture&&!this.unlocked)return false;
    this.prepare();this.playbackSession.start();
    const needsResume=this.context.state!=='running';
    if(gesture&&(!this.unlocked||needsResume)){
      const prime=this.context.createBufferSource();
      prime.buffer=this.context.createBuffer(1,1,this.context.sampleRate);
      prime.connect(this.context.destination);prime.onended=()=>prime.disconnect();prime.start();
    }
    this.unlocked=true;
    // Do not await: iOS can leave resume pending until another touchend. A
    // pending promise must never disable the mute button or block downloads.
    if(needsResume){
      try{this.context.resume()?.catch(error=>{if(!this.disposed)this.onError?.(error);});}
      catch(error){this.onError?.(error);}
    }
    void this.load();this.syncMaster();return true;
  }
  async toggle(){
    if(this.disposed)return false;
    this.enabled=!this.enabled;
    if(this.enabled){
      try{this.prepare();this.unlock();void this.load();}
      catch(error){this.enabled=false;this.syncMaster();throw error;}
    }else{this.stopAll();this.playbackSession.pause();}
    this.syncMaster();return this.enabled;
  }
  // OBS preloads while connecting (enabled by default); manual studies remain
  // lazy until enabled. No playback, media-session claim or resume in load().
  // Three concurrent fetches, one decode per local file, no delayed one-shot queue.
  load(){
    if(this.loading)return this.loading;
    this.abort=new AbortController();const pending=Object.entries(CABIN_SOUNDS);
    const worker=async()=>{
      while(pending.length&&!this.disposed){
        const [id,definition]=pending.shift();
        try{
          const response=await this.fetchAudio(CABIN_AUDIO_BASE+definition.file,{signal:this.abort.signal});
          if(!response.ok)throw new Error(`HTTP ${response.status}`);
          const data=await response.arrayBuffer();if(this.disposed)return;
          const buffer=await this.context.decodeAudioData(data);if(!this.disposed)this.buffers.set(id,buffer);
        }catch(error){if(!this.disposed)this.failures.push({id,message:String(error.message??error)});}
      }
    };
    this.loading=Promise.all([worker(),worker(),worker()]);return this.loading;
  }
  get audible(){return this.enabled&&this.unlocked&&!this.paused&&!this.disposed&&this.context?.state==='running';}
  get stats(){return{loaded:this.buffers.size,total:Object.keys(CABIN_SOUNDS).length,active:this.voices.size,loops:this.loops.size,failed:this.failures.length};}
  syncMaster(){if(this.context&&!this.disposed)this.master.gain.setTargetAtTime(this.enabled&&this.unlocked&&!this.paused?.55:0,this.context.currentTime,.08);}
  get focus(){return this.listener.overview?clamp(this.listener.focus??0):1;}
  setViewListener(camera,view,firstPerson=false){
    const e=camera.matrixWorld.elements;
    // Desktop zoom changes FOV while its camera stays 40 m outside the ship.
    // Listen at the visible focus plane, using the eased (not target) framing.
    const ratio=(view.fitHeight??15)/Math.max(.1,view.viewHeight??15);
    this.setListener({x:firstPerson?e[12]:view.center.x,y:firstPerson?e[13]:view.center.y,z:firstPerson?e[14]:view.center.z+1,
      rightX:e[0],rightY:e[1],rightZ:e[2],overview:!firstPerson,focus:firstPerson?1:smooth(Math.log2(Math.max(1,ratio))/2)});
  }
  setListener(listener){Object.assign(this.listener,listener);for(const voice of this.voices)if(!voice.stopping)this.positionVoice(voice);this.update();}
  spatial(position){
    if(!position)return{gain:1,pan:0};
    const l=this.listener,dx=position.x-l.x,dy=position.y-l.y,dz=position.z-l.z;
    const distance=Math.hypot(dx,dy,dz),deck=1-.85*smooth((Math.abs(dy)-1.5)/1.5),focus=this.focus;
    const local=deck/(1+Math.pow(Math.max(0,distance-1.5)/4,2));
    const widePan=Math.max(-.8,Math.min(.8,dx/16)),nearPan=Math.max(-.9,Math.min(.9,(dx*l.rightX+dy*l.rightY+dz*l.rightZ)/Math.max(2,distance)));
    // Quiet whole-ship mix -> modest local lift, never boosting distant rooms.
    return{gain:.18*(1-focus)+.55*local*focus,pan:widePan*(1-focus)+nearPan*focus};
  }
  positionVoice(voice){
    const spatial=this.spatial(voice.position),now=this.context.currentTime;
    voice.gain.gain.setTargetAtTime(voice.volume*spatial.gain,now,.04);
    voice.pan?.pan.setTargetAtTime(spatial.pan,now,.04);
  }
  play(id,{position=null,volume=1,rate=1,loop=false,key=null}={}){
    const definition=CABIN_SOUNDS[id],buffer=this.buffers.get(id);
    if(!definition||!buffer||!this.audible||this.voices.size>=12)return null;
    if([...this.voices].filter(v=>v.id===id&&!v.stopping).length>=3)return null;
    if(this.spatial(position).gain*definition.gain*volume<.003)return null;
    const source=this.context.createBufferSource(),gain=this.context.createGain(),pan=this.context.createStereoPanner?.();
    source.buffer=buffer;source.loop=loop;source.playbackRate.value=Math.max(.7,Math.min(1.3,(definition.rate??1)*rate));
    gain.gain.value=0;source.connect(gain);if(pan)gain.connect(pan).connect(this.master);else gain.connect(this.master);
    const voice={id,source,gain,pan,position:position?{...position}:null,volume:definition.gain*volume,key,stopping:false,startedAt:this.context.currentTime};
    this.voices.add(voice);this.positionVoice(voice);
    source.onended=()=>{source.disconnect();gain.disconnect();pan?.disconnect();this.voices.delete(voice);if(key&&this.loops.get(key)===voice)this.loops.delete(key);this.onChange?.();};
    source.start(voice.startedAt);return voice;
  }
  // The running audio clock is authoritative for visuals that follow a loop.
  // A new voice after mute/pause starts a fresh phase; stopped/locked audio
  // cannot keep a stale clock driving the ship's emergency circuit.
  loopTime(key){
    const voice=this.loops.get(key),duration=voice?.source.buffer?.duration;
    if(!this.audible||!voice||voice.stopping||!(duration>0))return null;
    const elapsed=Math.max(0,this.context.currentTime-voice.startedAt)*voice.source.playbackRate.value;
    return elapsed%duration;
  }
  setLoop(key,id,active,options={}){
    let voice=this.loops.get(key);
    if(!active||!this.audible){if(voice)this.stopVoice(voice);return;}
    if(voice&&voice.id!==id){this.stopVoice(voice);voice=null;}
    if(!voice){voice=this.play(id,{...options,loop:true,key});if(voice)this.loops.set(key,voice);}
    else{if(options.position)Object.assign(voice.position??={},options.position);this.positionVoice(voice);}
  }
  stopVoice(voice){
    if(voice.stopping)return;voice.stopping=true;
    if(voice.key&&this.loops.get(voice.key)===voice)this.loops.delete(voice.key);
    const now=this.context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,.015);voice.source.stop(now+.08);
  }
  stopAll(){for(const voice of this.voices)this.stopVoice(voice);}
  stopLoop(key){const voice=this.loops.get(key);if(voice)this.stopVoice(voice);}
  tone(frequency,duration=.12,volume=.025,type='sine'){
    if(!this.audible)return;
    const now=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type;osc.frequency.value=frequency;gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(this.master);osc.start();osc.stop(now+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  update(){
    if(this.ambientGain)this.ambientGain.gain.setTargetAtTime(.4+.25*this.focus,this.context.currentTime,.4);
    if(this.fanGain)this.fanGain.gain.setTargetAtTime(.012+.028*this.spatial(plantFan).gain,this.context.currentTime,.4);
    // Condensate drops remain visual only; no synthetic pitched water plips.
  }
  pause(paused){
    const wasPaused=this.paused;this.paused=Boolean(paused);
    if(this.paused){this.stopAll();this.playbackSession.pause();}
    else if(wasPaused&&this.enabled&&this.unlocked)this.unlock({gesture:false});
    this.syncMaster();
  }
  dispose(){this.stopAll();this.disposed=true;this.enabled=false;this.playbackSession.dispose();this.abort?.abort();this.buffers.clear();this.loops.clear();this.voices.clear();this.context?.close();}
}
