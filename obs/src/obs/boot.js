import {exteriorCinema} from './exterior-session.js';
import {shouldPlayExteriorOpening} from './exterior-cinema-policy.js';
import {CABIN_SOUNDS,CABIN_AUDIO_BASE} from './sound-library.js';

// While the film plays, a worker pulls the cabin's chunks and assets into the
// HTTP cache: one low-priority request at a time, starting only once the film
// has finished its own probe download, so the picture never waits on the
// network and the main thread does no decoding or compiling before entry.
function prefetchDuringOpening(){
  const mode=new URLSearchParams(location.search).get('prefetch');
  if(mode==='0'||typeof Worker==='undefined')return null;
  const base=import.meta.env?.BASE_URL??'/obs/',dataset=document.documentElement.dataset;
  // Template content belongs to an about:blank document, so resolve by hand.
  const hrefs=id=>[...(document.getElementById(id)?.content?.querySelectorAll?.('link')??[])].map(link=>new URL(link.getAttribute('href'),location.href).href);
  // Critical assets first, then what the cabin fetches right after it appears
  // (wall prints, sound clips) and finally the deferred grooming cache, which
  // #cabin-prefetch keeps as its last entry.
  const urls=[...hrefs('cabin-preloads'),...hrefs('cabin-prefetch').slice(0,-1),
    ...Object.values(CABIN_SOUNDS).map(sound=>new URL(CABIN_AUDIO_BASE+sound.file,location.href).href),...hrefs('cabin-prefetch').slice(-1)];
  let worker=null,stopped=false;
  const start=()=>{
    if(stopped||!urls.length)return;
    try{worker=new Worker(new URL('./prefetch-worker.js',import.meta.url),{type:'module'});}
    catch(error){console.warn('Cabin prefetch unavailable.',error.message);return;}
    worker.onmessage=({data})=>{
      if(data.type!=='finished')return;
      dataset.cabinPrefetch=JSON.stringify({...data,type:undefined,ms:Math.round(performance.now()-Number(dataset.cabinPrefetchStartedMs))});
      worker.terminate();worker=null;
    };
    worker.onerror=error=>{console.warn('Cabin prefetch stopped.',error.message);worker?.terminate();worker=null;};
    dataset.cabinPrefetchStartedMs=performance.now().toFixed(1);
    worker.postMessage({base,manifest:`${base}assets/obs-manifest.json`,entry:'obs/main.js',urls,cache:mode==='reload'?'reload':'default'});
  };
  // Never ahead of the film's own loads; a film without the signal still gets one.
  Promise.race([exteriorCinema.whenProbeReady?.()??Promise.resolve(),new Promise(resolve=>setTimeout(resolve,20000))]).then(start,()=>{});
  // Entry starts the real loads; the request in flight completes and lands in
  // the same cache, so nothing is downloaded twice.
  return {stop(){stopped=true;worker?.postMessage({type:'stop'});}};
}

async function boot(){
  const opening=shouldPlayExteriorOpening(location.search);
  if(opening){
    exteriorCinema.show({opening:true,waitForHost:true,waitForEntry:true});
    const prefetch=prefetchDuringOpening();
    // No cabin assembly competes with the opening. The entry click disposes
    // the film renderer before the original connection screen loads.
    await exteriorCinema.whenEntryRequested();
    prefetch?.stop();
    document.getElementById('space-boot').hidden=true;
    document.getElementById('loading').hidden=false;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }else document.getElementById('space-boot').hidden=true;
  document.documentElement.dataset.cabinLoadStartedMs=performance.now().toFixed(1);
  // The gauge follows real milestones from here; show the first step at once.
  document.getElementById('loading')?.style?.setProperty('--cabin-load-progress','.04');
  const preloads=document.getElementById('cabin-preloads');
  if(preloads)document.head.append(preloads.content.cloneNode(true));
  document.documentElement.dataset.cabinBuildStartedMs=performance.now().toFixed(1);
  if(opening)exteriorCinema.hostProgress(.12);
  await import('./main.js');
}
void boot().catch(error=>{
  console.error(error);exteriorCinema.hostReady();exteriorCinema.close();
  document.getElementById('space-boot').hidden=true;
  document.getElementById('loading').hidden=true;
  const message=document.getElementById('obs-error');message.hidden=false;
  message.textContent='船内映像を開けませんでした。ページを再読み込みしてください。';
});
