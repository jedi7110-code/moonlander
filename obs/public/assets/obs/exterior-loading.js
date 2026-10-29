// The opening's first sky uses the same seeded directions and view as the 3D
// star field, without downloading Three.js or constructing the spacecraft.
import {createStarCatalog,skyHazeColor,starGlow,srgbByte,linearByte} from './exterior-star-catalog.js';
(()=>{
  const cover=document.getElementById('space-boot'),canvas=document.getElementById('space-boot-sky');
  if(!cover||!canvas)return;
  const query=new URLSearchParams(location.search),isCabin=document.body.dataset.spaceScene==='cabin';
  if(isCabin&&(query.has('preview')||query.get('opening')==='0')){cover.hidden=true;return;}
  const seconds=Math.max(0,Number(query.get('time'))||0);
  canvas.style.visibility=(isCabin||query.get('mode')==='opening')&&seconds<1?'hidden':'visible';
  const started=performance.now();document.documentElement.dataset.spaceStartedMs=String(started);
  const context=canvas.getContext('2d'),linear=Array.from({length:256},(_,index)=>linearByte(index));
  let stars=createStarCatalog();
  const normalize=p=>{const l=Math.hypot(...p);return p.map(v=>v/l);},dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  // Match scene 01's oblique bearing and pitch, including a paused study seek,
  // so the lightweight loading sky hands over without changing direction.
  const duration=query.get('mode')==='opening'||isCabin?38:38*4/3;
  const elapsed=Math.max(0,Math.min(duration,seconds));
  const reveal=6.8,rate=.3,ease=1.2,steadyUntil=15*duration/38;
  const advance=t=>t<ease?rate*ease*((t/ease)**3-(t/ease)**4/2):rate*(t-ease/2);
  const initialPitch=44.8-advance(reveal),steadyPitch=initialPitch+advance(steadyUntil);
  const after=Math.max(0,elapsed-steadyUntil),remaining=duration-steadyUntil;
  const acceleration=(60-steadyPitch-rate*remaining)/(remaining*remaining);
  const pitchDegrees=elapsed<=steadyUntil?initialPitch+advance(elapsed):steadyPitch+rate*after+acceleration*after*after;
  const pitch=pitchDegrees*Math.PI/180;
  const bearing=Math.atan2(35,315),forward=[-Math.cos(pitch)*Math.cos(bearing),-Math.sin(pitch),-Math.cos(pitch)*Math.sin(bearing)];
  const right=normalize([-forward[2],0,forward[0]]);
  const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];
  function paint(){
    const width=innerWidth,height=innerHeight,ratio=Math.min(devicePixelRatio,1.6);
    canvas.width=Math.floor(width*ratio);canvas.height=Math.floor(height*ratio);
    const haze=document.createElement('canvas');haze.width=Math.ceil(width/10);haze.height=Math.ceil(height/10);
    const hazeContext=haze.getContext('2d'),hazePixels=hazeContext.createImageData(haze.width,haze.height),focal=canvas.height/(2*Math.tan(21*Math.PI/180));
    for(let y=0;y<haze.height;y++)for(let x=0;x<haze.width;x++){
      const dx=((x+.5)/haze.width-.5)*canvas.width/focal,dy=(.5-(y+.5)/haze.height)*canvas.height/focal;
      const direction=normalize(forward.map((value,index)=>value+right[index]*dx+up[index]*dy)),color=skyHazeColor(direction),index=(y*haze.width+x)*4;
      for(let channel=0;channel<3;channel++)hazePixels.data[index+channel]=srgbByte(color[channel]);hazePixels.data[index+3]=255;
    }
    hazeContext.putImageData(hazePixels,0,0);context.drawImage(haze,0,0,canvas.width,canvas.height);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height);
    for(const star of stars){
      const depth=dot(star.p,forward);if(depth<=0)continue;
      let x=canvas.width/2+dot(star.p,right)*focal/depth,y=canvas.height/2-dot(star.p,up)*focal/depth;
      if(x<0||x>canvas.width||y<0||y>canvas.height)continue;
      const diameter=Math.max(1,star.size*ratio);
      if(diameter<1.5){x=Math.floor(x)+.5;y=Math.floor(y)+.5;}
      for(let py=Math.max(0,Math.floor(y-diameter/2));py<Math.min(canvas.height,Math.ceil(y+diameter/2));py++){
        for(let px=Math.max(0,Math.floor(x-diameter/2));px<Math.min(canvas.width,Math.ceil(x+diameter/2));px++){
          const alpha=starGlow(Math.hypot((px+.5-x)*2/diameter,(py+.5-y)*2/diameter));if(!alpha)continue;
          const index=(py*canvas.width+px)*4;
          for(let channel=0;channel<3;channel++)pixels.data[index+channel]=srgbByte(linear[pixels.data[index+channel]]+star.color[channel]*alpha);
        }
      }
    }
    context.putImageData(pixels,0,0);
  }
  paint();addEventListener('resize',paint);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    document.documentElement.dataset.spacePaintedMs=performance.now().toFixed(1);
    if(!isCabin&&query.get('embedded')==='1')parent.postMessage({type:'tara-exterior',action:'space'},location.origin);
  }));
  const release=()=>{removeEventListener('resize',paint);stars=[];canvas.width=canvas.height=1;observer.disconnect();};
  const observer=new MutationObserver(()=>{if(cover.hidden)release();});observer.observe(cover,{attributes:true,attributeFilter:['hidden']});
  addEventListener('pagehide',release,{once:true});
})();
