import * as THREE from 'three';
import {DECK} from './layout.js';
import {box,cylinder,rod,pipe} from './materials.js';
import {finishStaticCups} from './cabin-fixtures.js';
import {addFireExtinguishers} from './fire-extinguishers.js';
import {createPilotSeat} from './pilot-seats.js';
import {createMachinedMetals,finishMachinedFixtures} from './machined-metals.js';
import {finishServicePanels} from './service-panel.js';
import {createWallControlMaterials,createWallControlPanel} from './wall-control-panel.js';
import {addWallSwitchPanels} from './wall-switch-panels.js';
import {finishWallPrints} from './wall-prints.js';
import {addSmokingAshtray} from './smoking-props.js';

function tin(root,m,x,y,z,h=.22,r=.09,paint=m.enamel){
  cylinder(root,paint,x,y+h/2,z,r,h,r,12);
  cylinder(root,m.metal,x,y+h,z,r*1.05,.022,r*1.05,12);
  box(root,m.cloth,x,y+h*.52,z+r,.10,h*.35,.008);
}

function casePart(root,material,x,y,z,w,h,d,corner=.025){
  // Flat clipped corners and one bevel segment keep the shell rigid and cheap.
  const a=w/2,b=h/2,c=Math.min(corner,w*.18,h*.18),shape=new THREE.Shape();
  const points=[[-a+c,-b],[a-c,-b],[a,-b+c],[a,b-c],[a-c,b],[-a+c,b],[-a,b-c],[-a,-b+c]];
  points.forEach(([px,py],i)=>i?shape.lineTo(px,py):shape.moveTo(px,py));shape.closePath();
  const bevel=Math.min(.006,d*.2),depth=d-2*bevel;
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:1});
  geometry.translate(0,0,-depth/2);
  const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);
  part.castShadow=part.receiveShadow=true;root.add(part);return part;
}

function equipmentCase(root,m,paint,x,y,z,w=.66,h=.48,wallZ=null){
  const group=new THREE.Group();group.name='Industrial / protective equipment case';
  group.position.set(x,y,z);root.add(group);
  // The rubber seam sits between separate body and lid shells, not on their faces.
  casePart(group,paint,0,h/2,-.04,w,h,.22,.040).name='Case body';
  casePart(group,m.rubber,0,h/2,.079,w+.006,h+.006,.014,.041).name='Case gasket';
  casePart(group,paint,0,h/2,.127,w+.012,h+.012,.082,.044).name='Case lid';

  // Moulded edge guards and shorter face ribs replace the old fabric straps.
  for(const side of [-1,1]){
    casePart(group,paint,side*(w/2-.038),h/2,.180,.047,h-.070,.040,.012);
    for(const yy of [.050,h-.050]){
      casePart(group,paint,side*(w/2-.078),yy,-.03,.11,.064,.258,.018);
    }
  }
  for(const fraction of [-.29,-.14,.14,.29]){
    casePart(group,paint,w*fraction,h*.44,.179,.025,h*.49,.028,.008);
  }
  for(const dx of [-w*.30,w*.30]){
    // Broad two-piece over-centre latches, with a recessed thumb pad.
    casePart(group,m.rubber,dx,h-.050,.183,.087,.112,.042,.012);
    box(group,m.dark,dx,h-.068,.207,.056,.040,.010);
    const pin=cylinder(group,m.metal,dx,h-.004,.193,.009,.085,.009,8);pin.rotation.z=Math.PI/2;
    box(group,m.rubber,dx,.028,-.024,.088,.055,.235);
  }

  // A rigid, hinged carry handle with an open hand space above the lid.
  for(const side of [-1,1]){
    box(group,m.rubber,side*w*.19,h+.012,-.027,.065,.040,.080);
    casePart(group,m.rubber,side*w*.18,h+.049,-.010,.027,.087,.043,.009);
  }
  casePart(group,m.rubber,0,h+.086,-.010,w*.39,.035,.051,.012);
  for(const dx of [-.047,0,.047])box(group,m.dark,dx,h+.086,.018,.008,.024,.005);

  const valve=cylinder(group,m.rubber,w*.38,h*.30,.179,.023,.022,.023,10);valve.rotation.x=Math.PI/2;
  box(group,m.dark,w*.38,h*.30,.192,.025,.005,.004);
  // Small, unlit inventory plate, so the hardware carries the silhouette.
  box(group,m.metal,0,h*.74,.174,w*.25,.052,.010);
  box(group,m.dark,-w*.025,h*.745,.181,w*.17,.008,.004);
  box(group,m.dark,-w*.044,h*.724,.181,w*.13,.004,.004);

  if(wallZ!==null){
    // Two short wall stand-offs and a lower retaining cradle visibly support it.
    const wall=wallZ-z,back=-.151;
    for(const dx of [-w*.32,w*.32]){
      box(group,m.dark,dx,h*.48,wall,.050,h+.075,.030);
      for(const yy of [.012,h-.025])box(group,m.dark,dx,yy,(wall+back)/2,.044,.032,back-wall);
      box(group,m.rubber,dx,-.020,-.025,.067,.034,.28);
    }
  }else{
    for(const dx of [-w*.32,w*.32])box(group,m.rubber,dx,-.022,-.027,.073,.036,.22);
  }
  return group;
}

function cloth(root,m,x,y,z,w=.36,h=.55){
  const geo=new THREE.PlaneGeometry(w,h,8,8),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const xx=p.getX(i),yy=p.getY(i),s=(h/2-yy)/h;
    p.setXYZ(i,xx+s*.025*Math.sin(yy*13),yy,Math.sin(xx*48)*.027+s*s*.06);
  }
  geo.computeVertexNormals();const mat=m.cloth.clone();mat.side=THREE.DoubleSide;
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y-h/2,z);mesh.castShadow=true;root.add(mesh);
  rod(root,m.metal,[x-w*.55,y,z],[x+w*.55,y,z],.02);
}

function heavyServices(root,m,y){
  for(const [left,right]of [[-12.7,-3.3],[1.05,12.65]]){
    const mid=(left+right)/2;
    rod(root,m.pipeSteel,[left,y-.37,2.95],[right,y-.37,2.95],.09);
    rod(root,m.rubber,[left,y-.55,2.86],[right,y-.55,2.86],.046);
    for(let x=left+.2;x<right;x+=1.23){
      const flange=cylinder(root,m.metal,x,y-.37,2.95,.145,.058,.145,12);flange.rotation.z=Math.PI/2;
      box(root,m.dark,x,y-.39,2.89,.085,.43,.40);
      for(const dz of [-.09,.09]){
        const bolt=cylinder(root,m.brass,x+.037,y-.37,2.95+dz,.018,.031,.018,6);bolt.rotation.z=Math.PI/2;
      }
    }
    box(root,m.enamel,mid,y-.27,2.98,.84,.24,.15);
    for(let i=0;i<5;i++)box(root,m.dark,mid-.31+i*.15,y-.27,3.061,.045,.15,.009);
  }
}

function underdeck(root,m){
  const tanks=new THREE.Group();tanks.name='Underdeck service tanks';root.add(tanks);
  for(const [x,length]of [[-10.6,2.6],[-6.7,2.8],[3.3,2.4],[7.45,2.5]]){
    const tank=cylinder(tanks,m.pipeSteel,x,-.91,.74,.28,length,.28,16);tank.rotation.z=Math.PI/2;
    for(const dx of [-length*.34,length*.34]){
      const strap=cylinder(tanks,m.dark,x+dx,-.91,.74,.296,.10,.296,16);strap.rotation.z=Math.PI/2;
      box(tanks,m.dark,x+dx,-.53,.74,.09,.25,.67);
    }
    for(const side of [-1,1]){
      const cap=cylinder(tanks,m.enamel,x+side*length/2,-.91,.74,.24,.09,.24,16);cap.rotation.z=Math.PI/2;
      pipe(tanks,m.brass,[[x+side*length/2,-.91,.74],[x+side*(length/2+.19),-.91,.74],[x+side*(length/2+.19),-.54,.74]],.048);
    }
    box(tanks,m.yellow,x,-.86,1.027,.40,.12,.01);
  }
  for(const x of [-3.9,10.4]){
    box(tanks,m.dark,x,-.84,.8,1.02,.62,.60);
    for(let i=0;i<7;i++)box(tanks,m.metal,x-.40+i*.13,-.84,1.12,.025,.43,.04);
    pipe(tanks,m.cable,[[x-.52,-.56,1],[x-.72,-1.2,1],[x+.64,-1.20,1],[x+.51,-.58,1]],.039);
  }
}

function arrangeConsoleChairs(parent,floor,metals){
  // The source ship's single console chair is an unnamed, unbatched group.
  const chair=parent.children.find(object=>object.isGroup&&object.position.x===-8.8&&
    object.position.y===floor&&object.position.z===.82&&object.rotation.y===Math.PI);
  chair?.removeFromParent();
  const pilot=createPilotSeat(metals);
  const chairs=[pilot,pilot.clone(),pilot.clone()];
  chairs.forEach((seat,index)=>{
    seat.name=`Console chair ${index+1}`;
    seat.position.set(-10.2+index*1.63,floor,.82);
    seat.rotation.y=Math.PI;
    parent.add(seat);
  });
}

export function addCabinDressing(parent,m,floors){
  const root=new THREE.Group();root.name='Cabin dressing';parent.add(root);
  const [habitation,operations,bottom]=[floors[DECK.HABITATION],floors[DECK.OPERATIONS],floors[DECK.LIFE_SUPPORT]];
  const casePaint=new THREE.MeshStandardMaterial({name:'Industrial / graphite polymer cases',color:0x62695b,roughness:.86,metalness:0,bumpMap:m.enamel.bumpMap,bumpScale:.0008});
  const metals=createMachinedMetals();
  arrangeConsoleChairs(parent,operations,metals);
  finishMachinedFixtures(parent,m,metals);
  finishServicePanels(parent,m,habitation,bottom);
  finishWallPrints(parent,m,habitation);
  floors.forEach(y=>heavyServices(root,m,y));underdeck(root,m);
  const extinguishers=addFireExtinguishers(root,m,floors);
  const switches=addWallSwitchPanels(root,floors);

  // Keep the wall above the lounge clear of shelves and stored objects.
  const loungeCase=equipmentCase(root,m,casePaint,10.14,habitation+.04,-.18,.83,.43);
  loungeCase.rotation.y=.28; // Right end toward the wall, left end toward the aisle.
  cloth(root,m,10.20,habitation+1.63,-1.02,.47,.81);
  box(root,m.dark,10.19,habitation+1.69,-1.10,.68,.08,.10);
  const controlMaterials=createWallControlMaterials();
  for(const [x,y,w]of [[-11.94,habitation+1.73,.62],[-8.57,habitation+1.64,.70],[-12.02,operations+1.7,.67],[-5.74,operations+1.42,.48]]){
    const cabinet=createWallControlPanel(controlMaterials,w);cabinet.position.set(x,y,-1.15);root.add(cabinet);
  }
  equipmentCase(root,m,casePaint,-8.56,habitation+.42,-1.69,.66,.46,-1.87);
  box(root,m.dark,-11.89,habitation+.80,-.99,.63,.065,.53);
  addSmokingAshtray(root,m,habitation);

  // Keep the kitchen worktop props, without an overhead provision shelf.
  const worktop=bottom+1.0+.07/2; // Counter centre and half its thickness.
  tin(root,m,-10.03,worktop,-.26,.33,.13,m.metal);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.15,.024,6,16,Math.PI),m.dark);handle.position.set(-10.03,worktop+.345,-.26);root.add(handle);
  rod(root,m.metal,[-9.94,worktop+.205,-.26],[-9.81,worktop+.285,-.26],.034);
  // The floor space left of the galley is reserved for the waste incinerator.

  // The cargo rack and its tensioned webbing are built together in cargo-bay.js.
  equipmentCase(root,m,casePaint,12.00,bottom+1.47,-.96,.60,.30,-1.24);
  const gymCase=equipmentCase(root,m,casePaint,1.8,bottom,-.89,.94,.48);
  gymCase.name='Life support cargo case';
  // Lay the lid upward and the handle toward the aisle, with a slight floor yaw.
  gymCase.rotation.set(-Math.PI/2,-.18,Math.PI,'YXZ');
  const caseBounds=new THREE.Box3().setFromObject(gymCase),caseCenter=caseBounds.getCenter(new THREE.Vector3());
  gymCase.position.x+=1.8-caseCenter.x;gymCase.position.z+=-.89-caseCenter.z;
  gymCase.position.y+=bottom-caseBounds.min.y;
  // Keep the EVA preparation aisle clear; the former case at x=10.02 sat
  // directly in front of the third hanging suit.
  finishStaticCups(parent);
  // Detached templates share the actual geometry and atlases, without retaining
  // the entire unbatched ship through a parent reference.
  root.userData.viewingWallFixtures=Object.fromEntries(Object.entries({
    switchWide:switches.getObjectByName('Wall switches / Console auxiliary'),
    switchTall:switches.getObjectByName('Wall switches / Operations doorway'),
    switchSquare:switches.getObjectByName('Wall switches / Medical lighting'),
    cabinet:root.getObjectByName('Wall auxiliary control cabinet'),
    extinguisher:extinguishers[0],
  }).map(([name,source])=>{const copy=source.clone();copy.position.set(0,0,0);return[name,copy];}));
  return root;
}
