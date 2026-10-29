import * as THREE from 'three';
import {box,label} from './materials.js';
import {CAT_PORT} from './layout.js';
import {configurePocketShutter,animatePocketShutter,addPocketShutterFrame} from './shutter.js';

export function catPort(parent,m,x,y,level,animated=parent){
  const port=new THREE.Group();port.name='Cat passage deck '+(level+1);port.position.set(x,y,CAT_PORT.wallZ);parent.add(port);
  const {width,height}=CAT_PORT;
  addPocketShutterFrame(port,m,0,.030,.09,{width,height,name:'Cat passage'});
  // The dark recessed mouth occludes the cat progressively, nose to tail.
  const mouth=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color:0x030605}));
  mouth.position.set(0,.045+height/2,.008);port.add(mouth);
  box(port,m.dark,0,.035,.13,width+.10,.035,.23,.008);
  const door=new THREE.Group();door.name='Pocket cat shutter deck '+(level+1);
  door.position.set(x,y,CAT_PORT.wallZ+.055);animated.add(door);
  box(door,m.white,0,.045+height/2,0,width+.02,height+.02,.028,.008).name='Cat passage door leaf';
  label(door,'DUCT / '+String(level+1).padStart(2,'0'),0,.045+height*.84,.025,.38,.075,{fg:'#c2cabe',size:46});
  // The bathroom grille, reduced to fit the bottom of the small moving leaf.
  const vent=new THREE.Group();vent.name='Cat door ventilation grille';vent.position.set(0,.14,.028);vent.scale.setScalar(.35);door.add(vent);
  box(vent,m.rubber,0,0,0,1.08,.27,.08,.018);
  for(let i=0;i<4;i++)box(vent,m.metal,0,-.10+i*.055,.065,1.035,.012,.018);
  // The small leaf uses the same unplug/slide motion, scaled to its thickness.
  configurePocketShutter(door,{left:x-width/2,right:x+width/2,travel:width+.11,inset:.03});
  return {root:port,door,level};
}

export function catPortOpening(portal,level){
  if(!portal)return 0;
  const {phase,from,to,age,duration}=portal,t=Math.max(0,Math.min(1,age/duration));
  const opening=phase==='open'&&level===from||phase==='reopen'&&level===to;
  const closing=phase==='close'&&level===from||phase==='shut'&&level===to;
  if(opening)return t*t*(3-2*t);
  if(closing)return 1-t*t*(3-2*t);
  return phase==='enter'&&level===from||phase==='exit'&&level===to?1:0;
}

export function animateCatPorts(ports,portal){
  for(const {door,level}of ports)animatePocketShutter(door,catPortOpening(portal,level));
}
