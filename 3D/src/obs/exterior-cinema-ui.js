import './exterior-cinema-ui.css';
import {cinemaMessageAccepted} from './exterior-cinema-policy.js';

// A lazy, disposable renderer. The host suspends simulation/render/audio while
// open. Each visit removes its iframe, releasing its own WebGL context.
export class ExteriorCinemaUI{
  constructor({parent=document.body,onChange=()=>{},words=(ja)=>ja}={}){
    this.parent=parent;this.onChange=onChange;this.words=words;this.open=false;
    this.message=event=>{if(this.frame&&cinemaMessageAccepted(event,this.frame,location.origin)){
      if(event.data.action==='space'||event.data.action==='ready')document.getElementById('space-boot')?.setAttribute('hidden','');
      if(event.data.action==='playing'){
        this.playing=true;document.documentElement.dataset.openingStartedMs=performance.now().toFixed(1);this.resolvePlaying?.();
      }
      if(event.data.action==='logo-resolved'){
        document.documentElement.dataset.openingLogoResolvedMs=performance.now().toFixed(1);this.resolveLogoResolved?.();
      }
      if(event.data.action==='intro-finished'){
        document.documentElement.dataset.openingIntroFinishedMs=performance.now().toFixed(1);this.resolveIntroFinished?.();
      }
      if(event.data.action==='failed'){
        const error=new Error('Opening renderer could not start');this.rejectPlaying?.(error);this.rejectLogoResolved?.(error);this.rejectIntroFinished?.(error);
      }
      if(event.data.action==='exit')this.close();
    }};
    this.key=event=>{if(!this.open)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.close();}
      else if(event.key==='Tab'){
        if(!this.hostIsReady&&!this.waitForEntry){event.preventDefault();this.shell.focus();}
        else if(event.target===this.shell){event.preventDefault();this.closeButton.focus();}
        else if(event.target===this.closeButton){event.preventDefault();this.frame.focus();}
      }};
    window.addEventListener('message',this.message);document.addEventListener('keydown',this.key,true);
  }
  buttonText(){return this.opening?this.words('船内映像に接続','Connect to cabin feed'):this.cinematic?this.words('戻る','Return'):this.words('船内に戻る','Return to cabin');}
  show({opening=false,cinematic=false,core=2.6,phase=55,rpm,waitForHost=false,waitForEntry=false}={}){
    if(this.open)return;this.open=true;this.opening=opening;this.cinematic=opening||cinematic;this.focus=document.activeElement;
    this.hostIsReady=!waitForHost;
    this.waitForEntry=opening&&waitForEntry;
    this.entryRequestedPromise=new Promise(resolve=>{this.resolveEntryRequested=resolve;});
    this.playing=false;
    this.playingPromise=new Promise((resolve,reject)=>{this.resolvePlaying=resolve;this.rejectPlaying=reject;});
    this.logoResolvedPromise=new Promise((resolve,reject)=>{this.resolveLogoResolved=resolve;this.rejectLogoResolved=reject;});
    this.logoResolvedPromise.catch(()=>{});
    this.introFinishedPromise=new Promise((resolve,reject)=>{this.resolveIntroFinished=resolve;this.rejectIntroFinished=reject;});
    // A free exterior view has no boot consumer waiting for this promise.
    this.playingPromise.catch(()=>{});
    this.introFinishedPromise.catch(()=>{});
    this.shell=document.createElement('section');this.shell.className=`exterior-cinema-modal${opening?' opening':''}`;this.shell.tabIndex=-1;
    this.shell.setAttribute('role','dialog');this.shell.setAttribute('aria-modal','true');this.shell.setAttribute('aria-label',this.words('船体外観','Ship exterior'));
    this.frame=document.createElement('iframe');this.frame.title=this.cinematic?this.words('宇宙船の自動画角','Cinematic ship exterior'):this.words('船体外観の自由視点','Free view of the ship exterior');this.frame.allow='fullscreen';
    const query=new URLSearchParams({embedded:'1',core:String(core),phase:String(phase)});if(rpm!==undefined)query.set('rpm',String(rpm));
    if(this.cinematic){
      query.set('mode',opening?'opening':'view');
      if(opening&&new URLSearchParams(location.search).get('from')==='moonlander')query.set('logo','0');
      // Adopt the approved study take in OBS and the cabin's movie viewer.
      query.set('approach','bow');query.set('ending','underside');query.set('docking','probe-follow');
    }else{
      query.set('viewer','free');
      query.set('panelLines','soft');query.set('planetScale','enhanced');
    }
    // Vite bundle locations differ from source modules. Resolve the HTML entry
    // relative to the current page rather than the hashed JS asset directory.
    const page=this.cinematic?'ship-exterior-cinema.html':'ship-exterior-study.html';
    this.frame.src=new URL(`./${page}?${query}`,location.href).href;
    this.closeButton=document.createElement('button');this.closeButton.type='button';this.closeButton.className='exterior-cinema-close';
    this.closeButton.textContent=this.buttonText();
    this.closeButton.hidden=!this.hostIsReady&&!this.waitForEntry;
    this.closeButton.onclick=()=>{
      if(this.waitForEntry){this.close({force:true});this.resolveEntryRequested();}
      else this.close();
    };
    this.loadingIndicator=null;this.loadProgress=0;
    if(opening&&!this.hostIsReady&&!this.waitForEntry){
      // Reuse the original cabin connection frame rather than a second design.
      const original=document.getElementById('loading')?.querySelector('.loading-frame');
      if(original){
        this.loadingIndicator=document.createElement('div');this.loadingIndicator.className='exterior-cinema-loading';
        this.loadingIndicator.setAttribute('role','progressbar');
        this.loadingIndicator.setAttribute('aria-label',this.words('船内映像に接続中','Connecting to habitat'));
        this.loadingIndicator.setAttribute('aria-valuemin','0');this.loadingIndicator.setAttribute('aria-valuemax','100');
        this.loadingIndicator.append(original.cloneNode(true));this.hostProgress(0);
      }
    }
    this.inert=[...this.parent.children].map(element=>[element,element.inert]);this.inert.forEach(([el])=>{el.inert=true;});
    this.shell.append(this.frame,this.closeButton);if(this.loadingIndicator)this.shell.append(this.loadingIndicator);this.parent.append(this.shell);
    (opening?this.shell:this.hostIsReady?this.closeButton:this.shell).focus({preventScroll:true});this.onChange(true);
  }
  hostProgress(value){
    if(this.hostIsReady||!Number.isFinite(value))return;
    this.loadProgress=Math.max(this.loadProgress??0,Math.min(.99,Math.max(0,value)));
    this.loadingIndicator?.style.setProperty('--cabin-load-progress',String(this.loadProgress));
    this.loadingIndicator?.setAttribute('aria-valuenow',String(Math.round(this.loadProgress*100)));
  }
  hostReady(){
    this.hostIsReady=true;
    this.loadProgress=1;
    if(this.open){
      if(this.loadingIndicator){this.loadingIndicator.setAttribute('aria-valuenow','100');this.loadingIndicator.hidden=true;}
      this.closeButton.textContent=this.buttonText();this.closeButton.hidden=false;
    }
  }
  whenPlaying(){return this.playingPromise;}
  whenEntryRequested(){return this.entryRequestedPromise;}
  whenLogoResolved(){return this.logoResolvedPromise;}
  whenIntroFinished(){return this.introFinishedPromise;}
  close({force=false}={}){
    if(!this.open)return;
    if(!force&&!this.hostIsReady)return;
    this.open=false;this.shell.remove();this.frame=null;this.loadingIndicator=null;
    this.inert.forEach(([el,value])=>{el.inert=value;});this.focus?.focus?.({preventScroll:true});this.onChange(false);
  }
  dispose(){this.close({force:true});window.removeEventListener('message',this.message);document.removeEventListener('keydown',this.key,true);}
}
