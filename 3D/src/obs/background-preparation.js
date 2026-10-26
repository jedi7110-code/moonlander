// Leave a complete film frame between preparation batches. A resolved promise
// alone keeps running in the same task and can starve the opening iframe.
export function createPreparationScheduler({budgetMs=4,frameCount=2,now=()=>performance.now(),requestFrame=callback=>requestAnimationFrame(callback)}={}){
  let lastYield=0;
  return()=>{
    if(now()-lastYield<budgetMs)return Promise.resolve();
    return new Promise(resolve=>{
      let remaining=frameCount;
      const frame=()=>{if(--remaining>0)requestFrame(frame);else{lastYield=now();resolve();}};
      requestFrame(frame);
    });
  };
}
export const nextPreparationFrame=createPreparationScheduler();

export async function runPreparationSteps(steps,{nextFrame=nextPreparationFrame,onStep=()=>{}}={}){
  try{
    for(;;){
      const start=performance.now(),step=steps.next();
      onStep(step.value,performance.now()-start);
      if(step.done)return step.value;
      await nextFrame();
    }
  }finally{steps.return?.();}
}

// Studies and geometry checks consume the same steps without scheduling.
export function finishPreparationSteps(steps){
  let step;do{step=steps.next();}while(!step.done);return step.value;
}
