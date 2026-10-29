export function visibleInScene(object){
  for(let node=object;node;node=node.parent)if(!node.visible)return false;
  return true;
}

export async function runDeferredPreparation(tasks,{canPrepare=()=>true,cancelled=()=>false,nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve))}={}){
  const yieldFrame=async()=>{
    do{
      await nextFrame();
      if(cancelled())throw new DOMException('Preparation cancelled','AbortError');
    }while(!canPrepare());
  };
  try{
    for(const task of tasks){await yieldFrame();await task(yieldFrame);}
    return true;
  }catch(error){if(error?.name==='AbortError'&&cancelled())return false;throw error;}
}
