import {exteriorCinema} from './exterior-session.js';
import {shouldPlayExteriorOpening} from './exterior-cinema-policy.js';

async function boot(){
  const opening=shouldPlayExteriorOpening(location.search);
  if(opening){
    exteriorCinema.show({opening:true,waitForHost:true,waitForEntry:true});
    // No cabin fetches or assembly compete with the opening. The entry click
    // disposes the film renderer before the original connection screen loads.
    await exteriorCinema.whenEntryRequested();
    document.getElementById('space-boot').hidden=true;
    document.getElementById('loading').hidden=false;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }else document.getElementById('space-boot').hidden=true;
  document.documentElement.dataset.cabinLoadStartedMs=performance.now().toFixed(1);
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
