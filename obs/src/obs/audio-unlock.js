// iOS normally treats bare Web Audio as ambient audio (Ring/Silent applies).
// Prefer AudioSession; older iOS gets one silent media element, never another
// SE player. All audible cabin sounds still go through the Web Audio mixer.
export function silentWav(){
  const rate=8000,bytes=new Uint8Array(44+rate*2),view=new DataView(bytes.buffer);
  const text=(at,value)=>{for(let i=0;i<value.length;i++)bytes[at+i]=value.charCodeAt(i);};
  text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVEfmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,rate*2,true);
  return bytes;
}

export class CabinPlaybackSession {
  constructor({navigator=globalThis.navigator,document=globalThis.document,url=globalThis.URL}={}){
    this.navigator=navigator;this.document=document;this.url=url;this.media=null;this.src=null;this.active=false;
  }
  start(){
    if(this.disposed)return;
    const session=this.navigator?.audioSession;
    if(session){
      try{
        if(this.active&&session.type==='playback')return;
        if(!this.active)this.previousType=session.type;
        session.type='playback';this.active=true;return;
      }catch{/* Older implementations can expose the API but reject the type. */}
    }
    const ios=/iPad|iPhone|iPod/.test(this.navigator?.userAgent??'')||
      (this.navigator?.platform==='MacIntel'&&this.navigator?.maxTouchPoints>1);
    if(!ios||!this.document?.body)return;
    if(!this.media){
      this.src=this.url.createObjectURL(new Blob([silentWav()],{type:'audio/wav'}));
      this.media=this.document.createElement('audio');
      this.media.src=this.src;this.media.loop=true;this.media.preload='auto';this.media.volume=.001;
      this.media.hidden=true;this.media.setAttribute('playsinline','');
      this.media.setAttribute('webkit-playsinline','');this.media.setAttribute('aria-hidden','true');
      this.document.body.appendChild(this.media);
    }
    // Invoke synchronously in the gesture. A denied play retries on the next
    // gesture, without a timer, an extra media element or changing mute intent.
    if(this.media.paused){try{this.media.play()?.catch(()=>{});}catch{}}
  }
  pause(){
    this.media?.pause();
    if(this.active){
      try{if(this.navigator.audioSession.type==='playback')this.navigator.audioSession.type=this.previousType??'auto';}catch{}
      this.active=false;
    }
  }
  dispose(){
    this.pause();this.disposed=true;this.media?.remove();this.media=null;
    if(this.src)this.url.revokeObjectURL(this.src);this.src=null;
  }
}

export function bindCabinAudioGestures(audio,{target=globalThis.document,ignore=()=>false,onError=()=>{}}={}){
  const unlock=event=>{
    if(ignore(event)||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.button>0)return;
    try{audio.unlock();}catch(error){onError(error);}
  };
  // Capture sees taps even if a canvas/control stops bubbling. Neither prevent
  // default nor propagation changes are needed, so scrolling still works.
  const events=['pointerdown','touchstart','touchend','click','keydown'];
  for(const name of events)target.addEventListener(name,unlock,{capture:true,passive:true});
  return()=>{for(const name of events)target.removeEventListener(name,unlock,true);};
}
