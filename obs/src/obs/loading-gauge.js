// The connection screen's gauge follows the real startup milestones. It only
// ever advances; the stylesheet eases each step so sub-phase updates read as
// one continuous motion instead of a timed animation that waits at the end.
export function createLoadingGauge(root){
  const gauge=root?.querySelector?.('.loading-gauge')??null;
  let value=0;
  if(gauge){
    gauge.removeAttribute('aria-hidden');gauge.setAttribute('role','progressbar');
    gauge.setAttribute('aria-valuemin','0');gauge.setAttribute('aria-valuemax','100');gauge.setAttribute('aria-valuenow','0');
  }
  const set=next=>{
    if(!Number.isFinite(next))return value;
    value=Math.min(1,Math.max(value,next));
    root?.style?.setProperty('--cabin-load-progress',value.toFixed(4));
    gauge?.setAttribute('aria-valuenow',String(Math.round(value*100)));
    return value;
  };
  // Maps a sub-phase's own 0..1 onto the span between two milestones.
  const span=(from,to)=>fraction=>set(from+(to-from)*Math.min(1,Math.max(0,fraction)));
  const finish=async({nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve))}={})=>{
    set(1);
    const fill=root?.querySelector?.('.loading-gauge-fill');
    if(!fill)return;
    // Flush the final style change so getAnimations includes its transition.
    root.ownerDocument?.defaultView?.getComputedStyle(fill).transform;
    await Promise.allSettled((fill.getAnimations?.()??[]).map(animation=>animation.finished));
    // Present the full bar before the caller hides the connection screen.
    // With reduced motion there is no transition to wait for, only this paint.
    await nextFrame();
    await nextFrame();
  };
  return {set,span,finish,get value(){return value;}};
}
