import {exteriorCinema} from './exterior-session.js';
import {shouldPlayExteriorOpening} from './exterior-cinema-policy.js';

async function boot(){
  const opening=shouldPlayExteriorOpening(location.search);
  if(opening){
    exteriorCinema.show({opening:true,waitForHost:true});
    // The lightweight sky and shader-ready signal precede actual playback.
    // Cabin preloads and its module graph must wait for moving film frames.
    await exteriorCinema.whenPlaying();
    exteriorCinema.hostProgress(.05);
  }else document.getElementById('space-boot').hidden=true;
  document.documentElement.dataset.cabinLoadStartedMs=performance.now().toFixed(1);
  const preloads=document.getElementById('cabin-preloads');
  if(preloads)document.head.append(preloads.content.cloneNode(true));
  // Fetch during the reveal; begin cooperative assembly once the complete
  // logo has reached the screen. CPU and GPU batches yield to moving film.
  if(opening)await exteriorCinema.whenLogoResolved();
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
