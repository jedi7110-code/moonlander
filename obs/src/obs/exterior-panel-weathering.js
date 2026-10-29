import * as THREE from 'three';

// Four restrained paint finishes. Scratches and chips stay on the painted
// faces; panel joints have crisp edges without a blurred grime halo.
export function createPanelWearMap(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const c=canvas.getContext('2d');let seed=74613;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let tile=0;tile<4;tile++){
    const ox=tile%2*512,oy=Math.floor(tile/2)*512;c.save();c.beginPath();c.rect(ox,oy,512,512);c.clip();c.translate(ox,oy);
    c.fillStyle='#fffdf8';c.fillRect(0,0,512,512);
    for(let i=0;i<9;i++){
      const x=random()*512,y=random()*512,r=65+random()*120;
      c.save();c.translate(x,y);c.rotate((random()-.5)*.65);c.scale(1,.18+random()*.25);
      const g=c.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,`rgba(66,61,49,${.025+random()*.065})`);g.addColorStop(1,'rgba(66,61,49,0)');
      c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);c.restore();
    }
    for(const side of [0,1,2,3]){
      c.save();c.translate(256,256);c.rotate(side*Math.PI/2);c.translate(-256,-256);
      for(let i=0;i<16;i++){
        const x=random()*512,y=1+random()*6,length=2+random()*13;
        c.strokeStyle=i%4?'#77776a':'#f1eee0';c.lineWidth=.4+random()*1.3;c.beginPath();c.moveTo(x,y);c.lineTo(x+length,y+(random()-.5)*4);c.stroke();
      }
      c.restore();
    }
    for(let i=0;i<140;i++){
      const x=random()*512,y=random()*512,len=2+random()**3*45,angle=-.3+random()*.6;
      c.strokeStyle=i%4?'rgba(86,83,69,.32)':'rgba(255,255,250,.75)';c.lineWidth=.6+random()*1.4;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(angle)*len,y+Math.sin(angle)*len);c.stroke();
    }
    c.restore();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  map.name='Study B / surface wear, edge chips and scratches';return map;
}

export function installPanelSoot(material,amount){
  material.onBeforeCompile=shader=>{
    shader.uniforms.panelWeathering=amount;
    shader.vertexShader='attribute float weatherRole;varying vec3 panelPosition;varying float panelRole;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npanelPosition=position;panelRole=weatherRole;');
    shader.fragmentShader='uniform float panelWeathering;varying vec3 panelPosition;varying float panelRole;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 p=panelPosition;
      float soot=0.;
      if(panelRole<.5){
        // Exhaust/service residue stays at the aft machinery and RCS outlets.
        vec3 aft=(vec3(p.x+13.4,p.y,abs(p.z)-7.8))/vec3(2.7,2.7,1.25);
        vec3 rcs=(vec3(p.x-11.1,abs(p.y)-2.45,p.z-1.6))/vec3(.9,.7,.85);
        soot=.50*exp(-dot(aft,aft)*1.4)+.33*exp(-dot(rcs,rcs)*1.5);
      }else if(panelRole>1.5){
        vec3 engine=(p-vec3(0.,.75,0.))/vec3(1.35,.8,1.35);
        vec3 rcs=(vec3(abs(p.x)-1.7,p.y-3.1,p.z))/vec3(.35,.38,.6);
        soot=.37*exp(-dot(engine,engine)*1.2)+.13*exp(-dot(rcs,rcs)*1.6);
      }
      diffuseColor.rgb*=1.-clamp(soot*panelWeathering,0.,.7);
    `);
  };
  material.customProgramCacheKey=()=> 'exterior-panel-study-soot-v1';
}
