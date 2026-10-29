import {chunkFiles,prefetchSequence} from './prefetch-plan.js';

// Runs beside the opening film: the main thread only posts the list and reads
// the summary, so the picture never pays for these downloads.
let stopped=false;
self.onmessage=async ({data})=>{
  if(data.type==='stop'){stopped=true;return;}
  const {base,manifest,entry,urls,cache}=data,list=[];
  if(manifest){
    try{
      const response=await fetch(manifest,{priority:'low',cache:'no-cache',credentials:'same-origin'});
      if(response.ok)list.push(...chunkFiles(await response.json(),entry).map(file=>base+file));
    }catch{/* dev server or missing manifest: assets only */}
  }
  list.push(...urls);
  const summary=await prefetchSequence({urls:list,cache,isStopped:()=>stopped,
    onProgress:(url,done,total)=>self.postMessage({type:'progress',url,done,total})});
  self.postMessage({type:'finished',...summary});
};
