import * as THREE from 'three';
import {DECK} from './layout.js';
import {box,cylinder,rod,pipe} from './materials.js';

function tin(root,m,x,y,z,h=.22,r=.09,paint=m.enamel){
  cylinder(root,paint,x,y+h/2,z,r,h,r,12);
  cylinder(root,m.metal,x,y+h,z,r*1.05,.022,r*1.05,12);
  box(root,m.cloth,x,y+h*.52,z+r,.10,h*.35,.008);
}

function mug(root,m,x,y,z){
  cylinder(root,m.enamel,x,y+.09,z,.078,.18,.088,12);
  cylinder(root,m.dark,x,y+.184,z,.067,.007,.067,12);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.060,.016,6,12),m.enamel);
  handle.position.set(x+.098,y+.10,z);root.add(handle);
}

function softBag(root,m,x,y,z,w=.66,h=.48){
  box(root,m.olive,x,y+h/2,z,w,h,.38,.09);
  for(const dx of [-w*.3,w*.3]){
    box(root,m.rubber,x+dx,y+h/2,z+.199,.043,h,.024);
    box(root,m.brass,x+dx,y+h*.6,z+.217,.067,.063,.014);
    rod(root,m.rubber,[x+dx,y+h,z-.15],[x+dx,y+h,z+.15],.018);
  }
  pipe(root,m.rubber,[[x-.13,y+h,z],[x-.1,y+h+.11,z],[x+.1,y+h+.11,z],[x+.13,y+h,z]],.021);
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

function serviceBoard(root,m,x,y,w=.73){
  box(root,m.dark,x,y,-1.27,w,1.09,.17);
  box(root,m.enamel,x,y,-1.17,w-.07,1.02,.04);
  for(let i=0;i<3;i++){
    const xx=x-w*.32+i*w*.32;
    rod(root,m.pipeSteel,[xx,y-.36,-1.10],[xx,y+.15,-1.10],.026);
    const jaw=new THREE.Mesh(new THREE.TorusGeometry(.053,.020,6,10,Math.PI*1.45),m.metal);
    jaw.position.set(xx,y+.20,-1.10);jaw.rotation.z=-.7+i*.12;root.add(jaw);
  }
  const gauge=cylinder(root,m.metal,x,y+.38,-1.10,.10,.04,.10,16);gauge.rotation.x=Math.PI/2;
  const face=cylinder(root,m.cloth,x,y+.38,-1.072,.079,.008,.079,16);face.rotation.x=Math.PI/2;
  rod(root,m.dark,[x,y+.38,-1.06],[x+.035,y+.43,-1.06],.008);
  pipe(root,m.cable,[[x-w*.45,y+.36,-1.16],[x-w*.61,y+.1,-1.06],[x-w*.56,y-.64,-1.04],[x+w*.22,y-.63,-1.04],[x+w*.45,y-.3,-1.15]],.026);
}

function wallCards(root,m,x,y){
  for(let i=0;i<4;i++){
    const card=new THREE.Group();card.position.set(x+(i%2)*.32,y-Math.floor(i/2)*.29,-1.20);card.rotation.z=(i-1.3)*.035;root.add(card);
    box(card,m.cloth,0,0,0,.25,.23,.006);
    box(card,i%2?m.teal:m.olive,0,.033,.007,.19,.10,.004);
    for(let j=0;j<2;j++)box(card,m.dark,-.015,-.045-j*.026,.008,.15-j*.04,.006,.003);
    box(card,m.yellow,0,.115,.013,.08,.033,.005);
  }
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
      box(tanks,m.dark,x+dx,-.53,.74,.10,.25,.67);
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

export function addCabinDressing(parent,m,floors){
  const root=new THREE.Group();root.name='Cabin dressing';parent.add(root);
  const [habitation,operations,bottom]=[floors[DECK.HABITATION],floors[DECK.OPERATIONS],floors[DECK.LIFE_SUPPORT]];
  floors.forEach(y=>heavyServices(root,m,y));underdeck(root,m);

  // Keep the wall above the lounge clear of shelves and stored objects.
  wallCards(root,m,6.96,habitation+2.34);
  softBag(root,m,10.14,habitation+.04,-.18,.83,.43);
  cloth(root,m,10.20,habitation+1.63,-1.02,.47,.81);
  box(root,m.dark,10.19,habitation+1.69,-1.10,.68,.08,.10);
  for(const [x,y,w]of [[-11.94,habitation+1.73,.62],[-8.57,habitation+1.64,.70],[-12.02,operations+1.7,.67],[-5.74,operations+1.42,.48]])serviceBoard(root,m,x,y,w);
  wallCards(root,m,-5.64,habitation+2.20);
  softBag(root,m,-8.56,habitation+.12,-.85,.66,.46);
  box(root,m.dark,-11.89,habitation+.80,-.99,.63,.065,.53);
  tin(root,m,-11.89,habitation+.84,-.99,.29,.115,m.red);

  // Keep the kitchen worktop props, without an overhead provision shelf.
  mug(root,m,-10.42,bottom+1.085,-.05);
  tin(root,m,-10.03,bottom+1.085,-.26,.33,.13,m.metal);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.15,.024,6,16,Math.PI),m.dark);handle.position.set(-10.03,bottom+1.43,-.26);root.add(handle);
  rod(root,m.metal,[-9.94,bottom+1.29,-.26],[-9.81,bottom+1.37,-.26],.034);
  cloth(root,m,-9.52,bottom+.99,.23,.37,.57);
  softBag(root,m,-12.07,bottom+.08,-.79,.71,.43);
  for(let i=0;i<3;i++)box(root,m.enamel,-12.06,bottom+.58+i*.13,-.84,.66,.10,.42);

  // Strapped stores and a rope net give the cargo bay a worked-in foreground.
  for(const x of [11.30,12.20]){
    box(root,m.rubber,x,bottom+.86,-.02,.055,1.22,.036);
    box(root,m.brass,x,bottom+.72,.006,.09,.09,.028);
  }
  for(let i=0;i<6;i++)rod(root,m.rope,[10.99+i*.26,bottom+.12,.04],[11.13+i*.26,bottom+1.40,.04],.011);
  for(let i=0;i<5;i++)rod(root,m.rope,[11.01,bottom+.18+i*.26,.05],[12.45,bottom+.18+i*.26,.05],.011);
  softBag(root,m,12.00,bottom+1.47,-.53,.60,.30);
  for(const [x,y]of [[1.8,bottom+.45],[10.02,operations+.38]]){
    box(root,m.olive,x,y,-.89,.94,.58,.55);
    for(const dx of [-.29,.29])box(root,m.rubber,x+dx,y,-.602,.047,.58,.026);
    box(root,m.metal,x,y+.30,-.89,.23,.04,.10);
  }
}
