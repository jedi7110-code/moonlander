import * as THREE from 'three';
import {createDroid} from './droid-model.js';
import {box,rod,pipe,batchStatic} from './materials.js';
import {DECK} from './layout.js';

export const DROID_DOCK=Object.freeze({x:-11.92,z:-.52,floor:DECK.OPERATIONS,baseHeight:.020});

// A supported, powered-down pose. The charger stays live; the droid's face and
// actuators rest, so no idle animation or per-frame IK is needed at the dock.
export function createDroidChargingBay(floorY){
  const root=new THREE.Group();root.name='Droid charging bay / console left';
  const dark=new THREE.MeshStandardMaterial({name:'Droid dock / graphite',color:0x252b28,metalness:.68,roughness:.56});
  const metal=new THREE.MeshStandardMaterial({name:'Droid dock / machined steel',color:0x737c75,metalness:.84,roughness:.43});
  metal.userData.cabinKeepSurface=true;
  const rubber=new THREE.MeshStandardMaterial({name:'Droid dock / rubber',color:0x101714,roughness:.95});
  const lamp=new THREE.MeshBasicMaterial({name:'Droid dock / charge indicator',color:0x889c69,toneMapped:false});
  const fixture=new THREE.Group();fixture.name='Charging stand and back support';root.add(fixture);
  box(fixture,dark,0,-.01,-.10,.82,.020,.92,.007);
  for(const x of [-.137,.137])box(fixture,rubber,x,.002,.04,.18,.006,.30,.006);
  box(fixture,dark,0,.66,-.67,.68,1.29,.07,.018);
  box(fixture,metal,0,.66,-.621,.60,1.20,.016,.014);
  for(const x of [-.255,.255]){
    rod(fixture,dark,[x,.03,-.57],[x,1.24,-.57],.024);
    rod(fixture,metal,[x,.94,-.57],[x,1.12,-.25],.014);
    box(fixture,rubber,x,1.11,-.25,.065,.16,.07,.012);
  }
  box(fixture,dark,0,1.105,-.253,.42,.17,.066,.012);
  box(fixture,rubber,0,1.105,-.2075,.27,.12,.025,.009);
  // The droid rests against fixed charging contacts; no detachable body lead.
  for(const x of [-.075,.075])box(fixture,metal,x,1.105,-.191,.026,.064,.009);
  box(fixture,dark,-.435,.88,-.65,.23,.36,.15,.015);
  box(fixture,metal,-.435,.88,-.564,.18,.30,.023,.006);
  for(let i=0;i<4;i++)box(fixture,rubber,-.435,.80+i*.025,-.545,.13,.008,.006);
  box(fixture,rubber,-.435,.973,-.541,.088,.031,.01,.004);
  box(fixture,lamp,-.435,.973,-.533,.031,.009,.005,.002);
  const droid=createDroid({detail:'obs'});root.add(droid.root);droid.update(0,'charging');
  const cable=new THREE.Group();cable.name='Fixed charging stand cable';root.add(cable);
  // Both ends are attached to the stand: power unit below, contact support above.
  // It stays in place and visible through waking, departure and return.
  pipe(cable,rubber,[[-.435,.74,-.555],[-.43,.49,-.45],[-.31,.47,-.33],[-.32,.86,-.27],[-.255,1.035,-.25]],.011);
  const dock=batchStatic(fixture);dock.name=fixture.name;root.remove(fixture);root.add(dock);
  root.position.set(DROID_DOCK.x,floorY+DROID_DOCK.baseHeight,DROID_DOCK.z);
  root.updateMatrixWorld(true);
  return {root,droid,dock,cable,mode:'charging'};
}
