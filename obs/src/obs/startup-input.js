// Only a deliberate canvas click/tap powers the ceilings. Camera buttons,
// wheel zoom, pointer looking and drag/pinch gestures stay usable in the dark.
export function bindStartupLightingInput(canvas,activate){
  const pointers=new Set();let press=null;
  const moved=event=>Math.abs(event.clientX-press.x)+Math.abs(event.clientY-press.y)>5;
  const cancel=event=>{pointers.delete(event.pointerId);press=null;};
  const handlers={
    pointerdown(event){
      pointers.add(event.pointerId);
      if(pointers.size!==1||event.button!==0||event.isPrimary===false){press=null;return;}
      press={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    },
    pointermove(event){if(press?.id===event.pointerId&&moved(event))press.moved=true;},
    pointerup(event){
      pointers.delete(event.pointerId);
      if(press?.id!==event.pointerId)return;
      const tap=!press.moved&&!moved(event)&&event.button===0&&event.isPrimary!==false;press=null;
      const r=canvas.getBoundingClientRect();
      if(tap&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom)activate();
    },
    pointercancel:cancel,
    lostpointercapture:cancel,
    keydown(event){if(event.key==='Enter'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey)activate();},
  };
  for(const [type,handler]of Object.entries(handlers))canvas.addEventListener(type,handler);
  return()=>{for(const [type,handler]of Object.entries(handlers))canvas.removeEventListener(type,handler);pointers.clear();press=null;};
}
// Consume the lighting transition once, even when muted/loading: never queue a
// delayed power-up sound after unmute. Desktop and XR share this entry point.
export function activateStartupLighting(lighting,{audio,onActivate}={}){
  if(!lighting.activate())return false;
  audio?.play('powerOn');
  onActivate?.();
  return true;
}
