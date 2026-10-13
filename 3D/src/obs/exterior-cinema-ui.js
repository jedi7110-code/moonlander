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
      if(event.data.action==='intro-finished'){
        document.documentElement.dataset.openingIntroFinishedMs=performance.now().toFixed(1);this.resolveIntroFinished?.();
      }
      if(event.data.action==='failed'){
        const error=new Error('Opening renderer could not start');this.rejectPlaying?.(error);this.rejectIntroFinished?.(error);
      }
      if(event.data.action==='exit')this.close();
    }};
    this.key=event=>{if(!this.open)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.close();}
      else if(event.key==='Tab'){
        if(!this.hostIsReady){event.preventDefault();this.shell.focus();}
        else if(event.target===this.shell){event.preventDefault();this.closeButton.focus();}
        else if(event.target===this.closeButton){event.preventDefault();this.frame.focus();}
      }};
    window.addEventListener('message',this.message);document.addEventListener('keydown',this.key,true);
  }
  buttonText(){return this.opening?this.words('クリックして船内映像を表示','Click to enter the cabin'):this.cinematic?this.words('戻る','Return'):this.words('船内に戻る','Return to cabin');}
  show({opening=false,cinematic=false,core=2.6,phase=55,rpm,waitForHost=false}={}){
    if(this.open)return;this.open=true;this.opening=opening;this.cinematic=opening||cinematic;this.focus=document.activeElement;
    this.hostIsReady=!waitForHost;
    this.playing=false;
    this.playingPromise=new Promise((resolve,reject)=>{this.resolvePlaying=resolve;this.rejectPlaying=reject;});
    this.introFinishedPromise=new Promise((resolve,reject)=>{this.resolveIntroFinished=resolve;this.rejectIntroFinished=reject;});
    // A free exterior view has no boot consumer waiting for this promise.
    this.playingPromise.catch(()=>{});
    this.introFinishedPromise.catch(()=>{});
    this.shell=document.createElement('section');this.shell.className=`exterior-cinema-modal${opening?' opening':''}`;this.shell.tabIndex=-1;
    this.shell.setAttribute('role','dialog');this.shell.setAttribute('aria-modal','true');this.shell.setAttribute('aria-label',this.words('船体外観','Ship exterior'));
    this.frame=document.createElement('iframe');this.frame.title=this.cinematic?this.words('宇宙船の自動画角','Cinematic ship exterior'):this.words('船体外観の自由視点','Free view of the ship exterior');this.frame.allow='fullscreen';
    const query=new URLSearchParams({embedded:'1',core:String(core),phase:String(phase)});if(rpm!==undefined)query.set('rpm',String(rpm));
    if(this.cinematic)query.set('mode',opening?'opening':'view');else query.set('viewer','free');
    // Vite bundle locations differ from source modules. Resolve the HTML entry
    // relative to the current page rather than the hashed JS asset directory.
    const page=this.cinematic?'ship-exterior-cinema.html':'ship-exterior-study.html';
    this.frame.src=new URL(`./${page}?${query}`,location.href).href;
    this.closeButton=document.createElement('button');this.closeButton.type='button';this.closeButton.className='exterior-cinema-close';
    this.closeButton.textContent=this.buttonText();
    this.closeButton.hidden=!this.hostIsReady;this.closeButton.onclick=()=>this.close();
    this.inert=[...this.parent.children].map(element=>[element,element.inert]);this.inert.forEach(([el])=>{el.inert=true;});
    this.shell.append(this.frame,this.closeButton);this.parent.append(this.shell);
    (this.hostIsReady?this.closeButton:this.shell).focus({preventScroll:true});this.onChange(true);
  }
  hostReady(){
    this.hostIsReady=true;
    if(this.open){this.closeButton.textContent=this.buttonText();this.closeButton.hidden=false;}
  }
  whenPlaying(){return this.playingPromise;}
  whenIntroFinished(){return this.introFinishedPromise;}
  close({force=false}={}){
    if(!this.open)return;
    if(!force&&!this.hostIsReady)return;
    this.open=false;this.shell.remove();this.frame=null;
    this.inert.forEach(([el,value])=>{el.inert=value;});this.focus?.focus?.({preventScroll:true});this.onChange(false);
  }
  dispose(){this.close({force:true});window.removeEventListener('message',this.message);document.removeEventListener('keydown',this.key,true);}
}
