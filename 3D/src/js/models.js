import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const materials = new Map();
export function material(color, metalness = 0, roughness = .65, emissive = 0) {
  const key = `${color}/${metalness}/${roughness}/${emissive}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({color, metalness, roughness, emissive, emissiveIntensity: emissive ? 1.2 : 0}));
  return materials.get(key);
}
const white = material(0xd7d7cb,.35,.42), dark = material(0x242e31,.6,.4), black = material(0x111a1e,.7,.25);
const gold = material(0xac7828,.78,.38), silver = material(0x8d9899,.8,.3), cyan = material(0x82efff,.3,.2,0x25c0d5);
const green = material(0xc2ff6e,.2,.4,0x8bc34b);
const boxGeo = new THREE.BoxGeometry(1,1,1), sphereGeo = new THREE.SphereGeometry(1,20,14);
const cylinderGeo = new THREE.CylinderGeometry(1,1,1,12);

// Merge the static pieces sharing one material. Animated limbs and the ascent
// module remain separate; this keeps the articulated models affordable on mobile.
function mergeStatic(parent) {
  const groups=new Map();
  for(const child of [...parent.children]){
    if(!child.isMesh||Array.isArray(child.material))continue;
    if(!groups.has(child.material))groups.set(child.material,[]);groups.get(child.material).push(child);
  }
  for(const [mat,children]of groups){
    if(children.length<2)continue;
    const parts=children.map(child=>{child.updateMatrix();const copy=child.geometry.clone();const geometry=copy.index?copy.toNonIndexed():copy;if(geometry!==copy)copy.dispose();geometry.applyMatrix4(child.matrix);return geometry;});
    const geometry=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());
    if(!geometry)continue;geometry.userData.owned=true;
    const combined=new THREE.Mesh(geometry,mat);combined.castShadow=true;combined.receiveShadow=true;parent.add(combined);children.forEach(child=>parent.remove(child));
  }
}

export function mesh(parent, geo, mat, x=0,y=0,z=0,sx=1,sy=1,sz=1) {
  const m = new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export const box = (p,m,x,y,z,sx,sy,sz) => mesh(p,boxGeo,m,x,y,z,sx,sy,sz);
export const sphere = (p,m,x,y,z,sx,sy=sx,sz=sx) => mesh(p,sphereGeo,m,x,y,z,sx,sy,sz);
export function rod(p,a,b,r,mat=silver) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),mid=start.clone().add(end).multiplyScalar(.5);
  const m=mesh(p,cylinderGeo,mat,mid.x,mid.y,mid.z,r,start.distanceTo(end),r);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return m;
}
function panelText(text,width=512,height=128,color='#d7e8da',bg=null) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
  if(bg){c.fillStyle=bg;c.fillRect(0,0,width,height);}c.fillStyle=color;c.font=`500 ${Math.round(height*.46)}px monospace`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,width/2,height/2,width*.92);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:tex,transparent:!bg,side:THREE.DoubleSide,depthWrite:!!bg});
}

/** Reference: assets/spaceship.png — white octagonal cabin, gold insulation, four piston legs. */
export function createLander() {
  const g=new THREE.Group();
  box(g,gold,0,1.85,0,3.8,1.25,3.5);
  box(g,dark,0,1.05,0,2.5,.5,2.8);
  const foilGeo=new THREE.IcosahedronGeometry(1,2);
  for(const x of [-1,1]) for(const z of [-1,1]){
    sphere(g,gold,x*1.48,1.95,z*1.42,.7,.75,.66);
    const blanket=mesh(g,foilGeo,gold,x*1.52,1.85,z*.6,.45,.64,.6);blanket.rotation.z=x*.16;
    const foot=[x*2.95,.18,z*2.65],hip=[x*1.7,2.3,z*1.5];
    rod(g,hip,foot,.16,gold);rod(g,[x*.9,1.05,z*1.2],foot,.08,dark);
    rod(g,[x*2.55,.3,z*2.3],[x*2.72,1.18,z*2.45],.19,silver);
    mesh(g,cylinderGeo,dark,...foot,.5,.14,.5);
    for(let i=0;i<5;i++)mesh(g,cylinderGeo,silver,x*2.66,.4+i*.11,z*2.4,.21,.027,.21);
  }
  const engine=mesh(g,new THREE.CylinderGeometry(.45,.73,.8,20,1,true),dark,0,.8,0);engine.material.side=THREE.DoubleSide;
  const ascent=new THREE.Group();g.add(ascent);
  const cabin=mesh(ascent,new THREE.CylinderGeometry(1.45,1.9,2.6,8),white,0,3.75,0,1,1,.9);cabin.rotation.y=Math.PI/8;
  const roof=mesh(ascent,new THREE.CylinderGeometry(1.05,1.44,.3,8),white,0,5.2,0,1,1,.9);roof.rotation.y=Math.PI/8;
  box(ascent,gold,0,3.85,1.58,1.18,2.64,.075);
  box(ascent,black,0,3.7,1.64,.92,2.24,.09);
  box(ascent,silver,0,2.55,1.68,1.08,.12,.15);
  for(const x of [-1,1]) {
    const w=box(ascent,black,x*1.12,4.36,1.3,.66,.52,.05);w.rotation.y=x*.43;
    const trim=box(ascent,silver,x*1.12,4.68,1.31,.76,.055,.07);trim.rotation.y=x*.43;
    box(ascent,dark,x*1.69,3.14,.3,.23,.48,.57);
    rod(ascent,[x*1.78,3.18,.25],[x*2.03,3.18,.25],.07);
    for(let i=0;i<6;i++)box(ascent,material(0xa9afac,.3,.5),x*1.77,3.2+i*.23,-.54,.04,.02,.72);
    for(let j=0;j<4;j++)sphere(ascent,silver,x*.38,2.92+j*.45,1.72,.032);
  }
  sphere(ascent,material(0x698778,.7,.18),0,4.4,1.74,.17,.17,.025);
  rod(ascent,[.8,5.2,-.5],[.8,6.15,-.5],.03);
  const dish=mesh(ascent,new THREE.SphereGeometry(.47,20,12,0,Math.PI*2,0,.85),silver,.8,6.12,-.5);dish.rotation.x=.55;
  rod(ascent,[-.85,5.22,-.8],[-.85,6.02,-.8],.025);sphere(ascent,green,-.85,6.04,-.8,.06);
  const name=mesh(ascent,new THREE.PlaneGeometry(1.45,.22),panelText('BARRAMUNDI'),0,3.12,-1.76);name.rotation.y=Math.PI;
  const ladder=new THREE.Group();g.add(ladder);
  rod(ladder,[-.55,.18,2.7],[-.55,2.63,1.76],.045);rod(ladder,[.55,.18,2.7],[.55,2.63,1.76],.045);
  for(let i=0;i<9;i++){const f=i/8;rod(ladder,[-.57,.22+f*2.4,2.7-f*.93],[.57,.22+f*2.4,2.7-f*.93],.045);}
  const flame=new THREE.Group();flame.position.set(0,.48,0);g.add(flame);
  const outer=new THREE.Mesh(new THREE.ConeGeometry(.52,3.3,20,1,true),new THREE.MeshBasicMaterial({color:0x79daff,transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));outer.rotation.x=Math.PI;outer.position.y=-1.6;flame.add(outer);
  const inner=new THREE.Mesh(new THREE.ConeGeometry(.25,2.6,16),new THREE.MeshBasicMaterial({color:0xe6ffef,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));inner.rotation.x=Math.PI;inner.position.y=-1.3;flame.add(inner);
  flame.visible=false;
  mergeStatic(g);mergeStatic(ascent);mergeStatic(ladder);g.userData={ascent,flame,ladder};return g;
}

/** Reference: assets/player-f.png / crew-f.png — suit, dark visor, cyan beam rifle. */
export function createAstronaut(crew=false,index=0) {
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const cloth=material(crew?0xc9c9b6:0xdddcd2,.04,.9),trim=material(0x414b4a,.35,.65),accent=material(crew?0x8cceb9:0xd1aa55,.4,.5);
  box(body,cloth,0,1.23,0,.63,.74,.43);
  sphere(body,cloth,0,1.85,0,.37,.39,.34);
  sphere(body,black,0,1.87,.22,.295,.265,.16);
  const reflection=material(0x668389,.75,.15);sphere(body,reflection,-.13,1.99,.34,.032,.12,.012);
  mesh(body,cylinderGeo,trim,0,1.59,0,.3,.09,.28);
  box(body,trim,0,1.39,.242,.41,.23,.05);box(body,accent,-.12,1.39,.273,.085,.07,.012);
  for(let i=0;i<3;i++)box(body,cyan,.05+i*.07,1.39,.275,.025,.018,.008);
  box(body,cloth,0,1.22,-.35,.55,.8,.29);box(body,accent,0,1.51,-.51,.46,.09,.03);
  const limbs=[];
  for(const s of [-1,1]){
    const leg=new THREE.Group();leg.position.set(s*.19,.94,0);body.add(leg);limbs.push(leg);
    sphere(leg,cloth,0,-.23,0,.17,.29,.18);mesh(leg,cylinderGeo,trim,0,-.45,.01,.155,.12,.16);
    sphere(leg,cloth,0,-.66,.01,.14,.24,.16);box(leg,trim,0,-.84,.07,.29,.15,.4);
    const arm=new THREE.Group();arm.position.set(s*.4,1.48,0);body.add(arm);limbs.push(arm);
    sphere(arm,cloth,0,-.17,0,.15,.26,.16);sphere(arm,trim,0,-.39,.02,.13);
    sphere(arm,cloth,0,-.51,.09,.12,.2,.13);sphere(arm,trim,0,-.66,.16,.12);
    if(!crew){arm.rotation.x=-.72;arm.rotation.z=s*.1;}
    box(body,accent,s*.4,1.45,.14,.18,.12,.02);
  }
  if(!crew){
    const gun=new THREE.Group();gun.position.set(.3,1.2,.38);body.add(gun);
    box(gun,dark,0,0,.15,.2,.22,.78);box(gun,silver,0,.13,.17,.13,.04,.6);
    rod(gun,[0,0,.42],[0,0,.94],.055,dark);box(gun,cyan,0,.015,.93,.095,.065,.025);
    for(let i=0;i<4;i++)box(gun,cyan,.107,.02,-.1+i*.11,.01,.06,.065);
    g.userData.muzzle=new THREE.Vector3(.3,1.2,1.34);
  }
  limbs.forEach(mergeStatic);mergeStatic(body);g.userData={...g.userData,limbs,body,crew,index};return g;
}

/** Reference: assets/alien-s-f.png — elongated carapace, hunched body, claws and tail. */
export function createAlien(boss=false) {
  const g=new THREE.Group(),shell=material(boss?0x4e4b43:0x354448,.5,.38),rib=material(0x68777a,.6,.4),joint=material(0x141d22,.65,.4);
  const core=new THREE.Group();g.add(core);
  sphere(core,shell,0,.94,0,.37,.57,.46);sphere(core,joint,0,.76,.22,.3,.38,.28);
  sphere(core,shell,0,1.39,.26,.4,.31,.73);sphere(core,black,0,1.39,.69,.3,.24,.37);
  sphere(core,rib,0,1.15,.87,.19,.11,.17);
  for(let i=0;i<6;i++){
    const ribMesh=mesh(core,new THREE.TorusGeometry(.32,.026,5,14,Math.PI),rib,0,.72+i*.11,.17,1,1,.7);ribMesh.rotation.x=Math.PI/2;
    for(const s of [-1,1])rod(core,[s*.23,.78+i*.12,-.1],[s*.41,.89+i*.12,-.31],.033,rib);
  }
  for(let i=0;i<7;i++)sphere(core,rib,0,1.58,.73-i*.16,.025,.035,.07);
  const limbs=[];
  for(const s of [-1,1]){
    const arm=new THREE.Group();arm.position.set(s*.31,1.12,.19);core.add(arm);limbs.push(arm);
    rod(arm,[0,0,0],[s*.44,-.28,.2],.09,shell);sphere(arm,joint,s*.44,-.28,.2,.12);
    rod(arm,[s*.44,-.28,.2],[s*.63,-.93,.55],.066,shell);
    for(let i=0;i<3;i++)rod(arm,[s*.62,-.91,.55],[s*(.5+i*.12),-1.03,.85-i*.06],.018,rib);
    const leg=new THREE.Group();leg.position.set(s*.27,.73,-.13);core.add(leg);limbs.push(leg);
    rod(leg,[0,0,0],[s*.19,-.18,-.44],.12,shell);rod(leg,[s*.19,-.18,-.44],[s*.22,-.65,.02],.065,shell);
    rod(leg,[s*.22,-.65,.02],[s*.22,-.7,.3],.052,rib);
    rod(core,[s*.23,1.15,-.3],[s*.45,1.65,-.6],.065,shell);
  }
  const tailPoints=[new THREE.Vector3(0,.62,-.3),new THREE.Vector3(.2,.5,-1),new THREE.Vector3(.7,.22,-1.8),new THREE.Vector3(1.1,.5,-2.25),new THREE.Vector3(1.13,.85,-2.6)];
  mesh(core,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPoints),20,.067,7,false),shell);
  const tip=mesh(core,new THREE.ConeGeometry(.14,.48,4),rib,1.13,1,-2.7);tip.rotation.x=-.65;
  if(boss){g.scale.setScalar(1.7);for(const s of [-1,1]){const horn=mesh(core,new THREE.ConeGeometry(.15,.85,5),shell,s*.33,1.61,-.14);horn.rotation.z=s*.9;}}
  mergeStatic(core);limbs.forEach(mergeStatic);g.userData={limbs,core,boss};return g;
}

/** Reference: assets/moon-car.png — fractured, industrial tracked rover. */
export function createRover() {
  const g=new THREE.Group(),hull=material(0x858778,.5,.7),edge=material(0x545c55,.6,.65);
  box(g,dark,0,.75,0,3.1,.5,6.1);box(g,hull,0,2.03,-.6,3.15,2.15,4.4);
  box(g,edge,0,1.7,2.1,2.5,1.55,1.5);box(g,black,0,2.18,2.89,2.14,.57,.045);
  box(g,dark,1.59,1.75,-.2,.04,1.9,1.35);
  for(let i=0;i<5;i++)rod(g,[1.67,.85+i*.33,-1.45],[1.67,.85+i*.33,-.87],.035);
  for(const s of [-1,1]){
    box(g,dark,s*1.85,.59,.1,.75,.91,5.2);
    for(let i=0;i<7;i++){
      const wheel=mesh(g,cylinderGeo,edge,s*1.86,.56,-2+i*.67,.38,.83,.38);wheel.rotation.z=Math.PI/2;
      const hub=mesh(g,cylinderGeo,dark,s*2.29,.56,-2+i*.67,.19,.07,.19);hub.rotation.z=Math.PI/2;
    }
    for(let i=0;i<17;i++)box(g,edge,s*1.85,.14,-2.55+i*.32,.94,.14,.18);
    const plate=box(g,hull,s*1.97,1.13,.3,.94,.14,4.8);plate.rotation.z=s*.1;
    for(let i=0;i<8;i++)box(g,dark,s*1.6,2.35,-1.9+i*.25,.04,.39,.065);
  }
  const door=box(g,hull,2.18,1.53,.3,.15,2,1.4);door.rotation.y=-.8;door.rotation.z=-.18;
  for(let i=0;i<7;i++){const scrap=box(g,i%2?edge:hull,2.1+Math.sin(i*4)*1.8,.1,-.4+Math.cos(i*2)*2,.2+i*.05,.15,1.1);scrap.rotation.y=i*1.9;}
  const label=mesh(g,new THREE.PlaneGeometry(1.7,.7),panelText('LUNAR\nINDUSTRIES',512,160,'#dadbce'),1.62,2.23,1.25);label.rotation.y=Math.PI/2;
  rod(g,[-1,3.2,-1],[-1,5,-1],.035);sphere(g,material(0xff9666,0,.4,0xaa3211),-1,5,-1,.08);
  mergeStatic(g);g.rotation.y=-.55;return g;
}

export function createPad() {
  const g=new THREE.Group();
  mesh(g,new THREE.CylinderGeometry(6.7,6.9,.19,48),material(0x363d3d,.35,.85),0,.01,0);
  const ring=mesh(g,new THREE.RingGeometry(6.2,6.29,64),green,0,.113,0);ring.rotation.x=-Math.PI/2;
  const inner=mesh(g,new THREE.RingGeometry(5.4,5.44,64),material(0xa3ac95,0,.8),0,.116,0);inner.rotation.x=-Math.PI/2;
  box(g,material(0x88927d),0,.118,0,2.8,.012,.15);box(g,material(0x88927d),0,.12,0,.15,.012,2.8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const x=Math.cos(a)*6.5,z=Math.sin(a)*6.5;mesh(g,cylinderGeo,dark,x,.2,z,.13,.35,.13);sphere(g,green,x,.39,z,.09,.045,.09);}
  const pole=new THREE.Group();pole.position.set(-8,0,-3);g.add(pole);rod(pole,[0,0,0],[0,3.1,0],.03,silver);
  const flag=mesh(pole,new THREE.PlaneGeometry(1.3,.65),panelText('PAX',256,128,'#badc86','#25322e'),.65,2.68,0);flag.material.side=THREE.DoubleSide;
  mergeStatic(g);return g;
}

export function animateAstronaut(g,entity,time) {
  const moving=entity.speed>.1,phase=time*8.5-(g.userData.index||0)*.4,legs=g.userData.limbs;
  const airborne=entity.y>.15,climbing=entity.mode==='boarding'||entity.mode==='ladder';
  const a=climbing?Math.sin(time*7)*.48:airborne?.5: moving?Math.sin(phase)*.57:Math.sin(time*1.5)*.018;
  legs[0].rotation.x=a;legs[2].rotation.x=-a;
  if(g.userData.crew||climbing){legs[1].rotation.x=-a*.8-(climbing?1.7:0);legs[3].rotation.x=a*.8-(climbing?1.7:0);}
  g.userData.body.position.y=moving&&!airborne?Math.abs(Math.sin(phase))*.042:Math.sin(time*1.7)*.014;
}

export function animateAlien(g,time,moving=true) {
  const phase=time*(g.userData.boss?5:8),a=Math.sin(phase)*(moving?.28:.04);
  g.userData.limbs.forEach((l,i)=>{l.rotation.x=a*(i%2?1:-1)*(i<2?1:-1);});g.userData.core.rotation.z=a*.06;
}
