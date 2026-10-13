// Leave a complete film frame between preparation batches. A resolved promise
// alone keeps running in the same task and can starve the opening iframe.
let lastYield=0;
export function nextPreparationFrame(){
  // Several very small geometry steps can share a 4ms slice. Awaiting two
  // frames for every vertex batch would needlessly extend cabin readiness.
  if(performance.now()-lastYield<4)return Promise.resolve();
  return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{lastYield=performance.now();resolve();})));
}

export async function runPreparationSteps(steps,{nextFrame=nextPreparationFrame,onStep=()=>{}}={}){
  for(;;){
    const start=performance.now(),step=steps.next();
    onStep(step.value,performance.now()-start);
    if(step.done)return step.value;
    await nextFrame();
  }
}

// Studies and geometry checks consume the same steps without scheduling.
export function finishPreparationSteps(steps){
  let step;do{step=steps.next();}while(!step.done);return step.value;
}
