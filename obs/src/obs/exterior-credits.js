import {OPENING_DURATION} from './exterior-cinematic.js';

// Keep the original MOONLANDER staff list and order (js/preload.js).
export const OPENING_CREDIT_ROLES=Object.freeze([
  "Executive Producer",
  "Game Director",
  "Lead Designer",
  "Lead Programmer",
  "Gameplay Programmer",
  "Graphics & VFX Programmer",
  "Physics Programmer",
  "UI / HUD Programmer",
  "Lead Artist",
  "Pixel Artist",
  "Environment Artist",
  "Lead Animator",
  "VFX Artist",
  "Lead Sound Designer",
  "Composer",
  "Audio Engineer",
  "Narrative Designer",
  "Level Designer",
  "Quality Assurance Lead",
  "Localization",
  "Build & Release Engineer",
  "Marketing",
  "Late-Night Debugging Specialist",
  "Coffee Procurement Officer",
  "Special Thanks"
]);
export const OPENING_CREDIT_NAME='DAISUKE ABE';

export function sampleOpeningCredits(seconds,options={}){
  if(!options.opening||options.ending!=='underside'||options.revision)
    return {visible:false,progress:0,start:null,end:null};
  // Hold the settled final camera until the approved 98-second cue.
  const start=98;
  const end=OPENING_DURATION,time=Number.isFinite(seconds)?seconds:0;
  return {visible:time>=start&&time<end,progress:Math.max(0,Math.min(1,(time-start)/(end-start))),start,end};
}

export function createOpeningCredits(host,options){
  const viewport=document.createElement('section');viewport.className='opening-credits';viewport.hidden=true;
  viewport.setAttribute('aria-label','Credits');
  const roll=document.createElement('div');roll.className='opening-credits-roll';
  for(const role of OPENING_CREDIT_ROLES){
    const entry=document.createElement('p');entry.className='opening-credit';
    const label=document.createElement('span');label.className='opening-credit-role';label.textContent=role;
    const name=document.createElement('span');name.className='opening-credit-name';name.textContent=OPENING_CREDIT_NAME;
    entry.append(label,name);roll.append(entry);
  }
  viewport.append(roll);host.append(viewport);
  let height=0,rollHeight=0;
  const measure=()=>{height=viewport.clientHeight;rollHeight=roll.scrollHeight;};
  const resize=new ResizeObserver(measure);resize.observe(host);
  return {
    update(seconds){
      const sample=sampleOpeningCredits(seconds,options);
      const wasHidden=viewport.hidden;viewport.hidden=!sample.visible;
      if(!sample.visible)return;
      if(wasHidden||!height)measure();
      // One transform, driven by the film clock. No independent timer, DOM
      // reflow per frame, texture, or additional WebGL draw call.
      roll.style.transform=`translate3d(0,${height-(height+rollHeight)*sample.progress}px,0)`;
    },
    dispose(){resize.disconnect();viewport.remove();},
  };
}
