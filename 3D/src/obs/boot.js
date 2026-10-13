import {exteriorCinema} from './exterior-session.js';
import {shouldPlayExteriorOpening} from './exterior-cinema-policy.js';

if(shouldPlayExteriorOpening(location.search))exteriorCinema.show({opening:true,waitForHost:true});
else document.getElementById('space-boot').hidden=true;
// Give the lightweight sky a real paint before the cabin constructs its scene.
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
void import('./main.js').catch(error=>{
  console.error(error);exteriorCinema.hostReady();exteriorCinema.close();
  document.getElementById('space-boot').hidden=true;
  document.getElementById('loading').hidden=true;
  const message=document.getElementById('obs-error');message.hidden=false;
  message.textContent='船内映像を開けませんでした。ページを再読み込みしてください。';
});
