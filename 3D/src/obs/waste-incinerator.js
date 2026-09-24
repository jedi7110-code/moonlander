import * as THREE from 'three';
import {box,cylinder,batchStatic} from './materials.js';
import {WASTE_INCINERATOR as WASTE} from './layout.js';

// Compact sealed unit under the existing galley wall equipment. The door
// opens beside the load; no added light, smoke pass or particle simulation.
export function createWasteIncinerator(m){
  const root=new THREE.Group();root.name='Galley waste incinerator';root.position.set(WASTE.x,0,WASTE.z);
  const body=new THREE.Group();root.add(body);
  const alloy=m.metal.clone();alloy.name='Waste incinerator / brushed titanium';alloy.color.setHex(0x777d75);alloy.userData.cabinKeepSurface=true;
  const dark=m.dark.clone();dark.name='Waste incinerator / graphite';dark.color.setHex(0x252a26);
  const w=WASTE.width,h=WASTE.height,d=WASTE.depth;
  box(body,dark,0,.05,0,w-.05,.10,d-.04,.014);
  box(body,alloy,0,h-.035,0,w,.07,d,.014);
  for(const side of [-1,1])box(body,alloy,side*(w/2-.03),h/2,0,.06,h-.1,d,.012);
  box(body,dark,0,.47,-d/2+.026,w-.10,.82,.052);
  box(body,dark,0,.20,0,w-.10,.05,d-.07);
  // Recessed chamber and a distinct door seal around the actual opening.
  for(const side of [-1,1])box(body,dark,side*.337,.56,d/2+.007,.05,.68,.04,.006);
  for(const y of [.235,.885])box(body,dark,0,y,d/2+.007,.70,.035,.04,.006);
  for(let i=0;i<5;i++)box(body,dark,-.19+i*.065,.115,d/2+.015,.041,.028,.009);
  for(const x of [-.355,.355])for(const y of [.09,.93]){
    const bolt=cylinder(body,dark,x,y,d/2+.02,.014,.012,.014,6);bolt.rotation.x=Math.PI/2;
  }
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#1d2522';ctx.fillRect(0,0,512,128);
    ctx.fillStyle='#deddd1';ctx.textAlign='left';ctx.font='500 42px Helvetica, Arial, sans-serif';ctx.fillText('WASTE',24,50);
    ctx.font='500 26px Helvetica, Arial, sans-serif';ctx.fillText('INCINERATOR',24,94);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(.45,.112),new THREE.MeshBasicMaterial({map,toneMapped:false}));
    sign.position.set(-.055,.795,d/2+.011);sign.name='Waste incinerator label';
    // Attached below to the moving door, so the open chamber stays clear.
    body.userData.sign=sign;
  }
  const door=new THREE.Group();door.name='Waste loading door';door.position.set(.345,.56,d/2+.036);root.add(door);
  box(door,alloy,-.345,0,0,.685,.63,.042,.018);
  box(door,dark,-.545,-.005,.034,.045,.20,.032,.007);
  for(const y of [-.205,.205])box(door,dark,.004,y,0,.054,.092,.071,.009);
  const sign=body.userData.sign;
  if(sign){delete body.userData.sign;sign.position.sub(door.position);sign.position.z=.024;door.add(sign);}
  const indicator=new THREE.MeshBasicMaterial({color:0x6e8c65,toneMapped:false});
  box(body,indicator,.255,.115,d/2+.018,.055,.025,.012,.003);
  root.remove(body);root.add(batchStatic(body));
  function update(open=0,burning=false){
    door.rotation.y=THREE.MathUtils.clamp(open,0,1)*1.63;
    indicator.color.setHex(burning?0xe18c37:open>0?0xb6aa73:0x6e8c65);
  }
  update();return {root,door,indicator,update};
}
