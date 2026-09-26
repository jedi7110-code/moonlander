import * as THREE from 'three';
import {box,cylinder,rod,pipe} from './materials.js';
import {createMiloBoot} from './characters.js';

function ring(root,material,x,y,z,r,tube){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,32),material);
  mesh.position.set(x,y,z);root.add(mesh);return mesh;
}

function crumpledLaundry(source){
  // Three overlapping fabric folds, baked into one lightweight mesh. Wavy hems,
  // drooping corners and shaded valleys read as cloth without a cloth simulation.
  const positions=[],colors=[],uvs=[],indices=[],cols=10,rows=4;
  const pieces=[
    {x:-.015,y:-.105,w:.29,h:.085,angle:-.16,phase:.3},
    {x:.025,y:-.065,w:.27,h:.09,angle:.31,phase:1.8},
    {x:-.025,y:-.023,w:.25,h:.09,angle:-.25,phase:3.1},
  ];
  for(const [layer,piece]of pieces.entries()){
    const start=positions.length/3,c=Math.cos(piece.angle),s=Math.sin(piece.angle);
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows,edge=Math.abs(2*u-1);
      const wave=Math.sin(u*Math.PI*3+v*.9+piece.phase);
      const x=(u-.5)*piece.w+.008*Math.sin(v*Math.PI+piece.phase);
      const y=(v-.5)*piece.h*(1-.28*edge)+.012*wave-.017*edge*edge;
      const z=.003+layer*.008+.006*(1+wave)+.004*Math.sin(v*Math.PI);
      const px=piece.x+c*x-s*y,py=piece.y+s*x+c*y;
      const inset=Math.min(1,.198/Math.hypot(px,py));
      positions.push(px*inset,py*inset,z);
      // Subtle self-shadow in folded-under edges survives the cabin toon bands.
      const shade=.69+.24*(wave+1)/2-.12*(1-v)**3;
      colors.push(shade,shade,shade);uvs.push(u,v);
      if(row<rows&&col<cols){const a=start+row*(cols+1)+col,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=source.clone();material.name='Laundry / crumpled cotton';
  material.color.setHex(0xf1f0e8);material.vertexColors=true;material.side=THREE.DoubleSide;
  material.metalness=0;material.roughness=1;material.map=null;material.bumpScale=.0007;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Crumpled laundry';mesh.castShadow=mesh.receiveShadow=true;
  return mesh;
}

function sweatshirtTrim(shirt,cloth,print){
  const rib=cloth.clone();rib.name='Laundry / navy rib knit';rib.color.setHex(0x202a43);
  // A crew-neck band follows the actual opening instead of covering the hanger.
  const collar=new THREE.Shape();collar.moveTo(-.035,1.51);collar.lineTo(-.043,1.505);
  collar.bezierCurveTo(-.040,1.425,.040,1.425,.043,1.505);collar.lineTo(.035,1.51);
  collar.bezierCurveTo(.030,1.450,-.030,1.450,-.035,1.51);collar.closePath();
  const neck=new THREE.Mesh(new THREE.ShapeGeometry(collar,12),rib);neck.name='Sweatshirt crew-neck rib';neck.position.z=.083;shirt.add(neck);
  box(shirt,rib,0,.825,.041,.143,.056,.084,.002).name='Sweatshirt hem rib';
  for(const side of [-1,1])box(shirt,rib,side*.101,.802,.041,.033,.050,.084,.002).name='Sweatshirt cuff rib';
  // Keep the supplied transparent artwork's aspect ratio; the print sits just
  // above the fabric so it cannot flicker with the front face.
  const chest=new THREE.Mesh(new THREE.PlaneGeometry(.132,.132*1195/1366),print);
  chest.name='PAXCREATION / MEGURO WARD chest print';chest.position.set(0,1.31,.084);shirt.add(chest);
}

function workShirtTrim(shirt,cloth,leftPatch,rightPatch){
  const seam=cloth.clone();seam.name='Laundry / brown work shirt seams';seam.color.multiplyScalar(.64);
  const trim=cloth.clone();trim.name='Laundry / brown work shirt collar and flaps';trim.color.multiplyScalar(.91);
  const panel=(name,points,z,material=cloth)=>{
    const shape=new THREE.Shape();shape.moveTo(...points[0]);for(const point of points.slice(1))shape.lineTo(...point);shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.002,bevelEnabled:false,steps:1,curveSegments:1}),material);
    mesh.name=name;mesh.position.z=z;mesh.castShadow=mesh.receiveShadow=true;shirt.add(mesh);return mesh;
  };
  const button=(x,y,z)=>{
    const mesh=cylinder(shirt,seam,x,y,z,.0036,.002,.0036,8);mesh.rotation.x=Math.PI/2;mesh.name='Work shirt button';
  };
  box(shirt,trim,0,1.127,.083,.014,.652,.004).name='Work shirt button placket';
  for(const y of [1.432,1.333,1.235,1.137,1.039,.941,.843])button(0,y,.089);
  for(const side of [-1,1]){
    const x=side*.046;
    const collar=panel('Work shirt pointed collar',[[side*.035,1.51],[side*.053,1.467],[side*.026,1.406],[side*.004,1.451]],.084,trim);
    const positions=collar.geometry.attributes.position;
    for(let i=0;i<positions.count;i++)positions.setZ(i,positions.getZ(i)+(1.51-positions.getY(i))*.13);
    collar.geometry.computeVertexNormals();
    panel('Work shirt pocket seam',[[x-.034,1.337],[x-.034,1.245],[x-.021,1.227],[x+.021,1.227],[x+.034,1.245],[x+.034,1.337]],.083,seam);
    panel('Work shirt chest pocket',[[x-.032,1.335],[x-.032,1.246],[x-.020,1.230],[x+.020,1.230],[x+.032,1.246],[x+.032,1.335]],.085);
    panel('Work shirt pocket flap',[[x-.034,1.338],[x-.034,1.315],[x-.022,1.302],[x+.022,1.302],[x+.034,1.315],[x+.034,1.338]],.088,trim);
    button(x,1.318,.093);
    // Anatomical right appears on the viewer's left, matching the supplied shirt.
    const width=side<0?.060:.074,aspect=side<0?544/1097:648/1574;
    const patch=new THREE.Mesh(new THREE.PlaneGeometry(width,width*aspect),side<0?rightPatch:leftPatch);
    patch.name=side<0?'Work shirt / PXC right chest patch':'Work shirt / PAX CREATION left chest patch';
    patch.position.set(x,1.374,.084);shirt.add(patch);
  }
}

function laundry(root,m,wearMaterials){
  // Stacked front-loading washer/dryer: round doors face the cabin entrance.
  for(const [i,name]of ['Washing machine','Dryer'].entries()){
    const unit=new THREE.Group();unit.name=name;unit.position.set(-.46,.14+i*.94,-4.72);root.add(unit);
    box(unit,m.enamel,0,.45,0,.88,.90,.76,.045);
    box(unit,m.dark,0,.75,.39,.74,.13,.025,.01);
    box(unit,m.teal,-.16,.75,.408,.24,.055,.012);
    const knob=cylinder(unit,m.metal,.25,.75,.416,.042,.025,.042,16);knob.rotation.x=Math.PI/2;
    const drum=cylinder(unit,m.dark,0,.36,.391,.265,.024,.265,32);drum.rotation.x=Math.PI/2;
    const door=new THREE.Group();door.name=i===0?'Washer service door':'Dryer door';door.position.set(-.28,.36,.425);unit.add(door);
    ring(door,m.metal,.28,0,0,.258,.028);
    ring(door,m.rubber,.28,0,.007,.219,.016);
    box(door,m.metal,.51,0,.035,.05,.12,.055,.01);
    // Only the washer receives a load in the service routine. The unused dryer
    // stays empty, and the washer contents are animated separately from the room.
    if(i===0){
      const clothes=new THREE.Group();clothes.position.set(0,.36,.416);clothes.name='Washer rotating clothes';clothes.visible=false;unit.add(clothes);
      clothes.add(crumpledLaundry(m.cloth));
    }
  }
  const closet=new THREE.Group();closet.name='Open clothes closet';closet.position.set(.51,.14,-4.77);root.add(closet);
  box(closet,m.dark,0,1.02,-.39,.845,2.00,.06);
  for(const side of [-1,1])box(closet,m.enamel,side*.45,1.02,0,.055,2.04,.72);
  for(const h of [.03,.37,2.01])box(closet,m.enamel,0,h,0,.845,.055,.72);
  rod(closet,m.metal,[-.38,1.76,.12],[.38,1.76,.12],.018);
  const whiteCloth=m.cloth.clone();whiteCloth.name='Laundry / white cotton';
  whiteCloth.color.setHex(0xffffff);whiteCloth.map=null;
  const navyCloth=whiteCloth.clone();navyCloth.name='Laundry / indigo navy sweatshirt';navyCloth.color.setHex(0x28334e);
  const brownCloth=whiteCloth.clone();brownCloth.name='Laundry / brown cotton work shirt';brownCloth.color.setHex(0x746448);brownCloth.roughness=1;
  for(let i=0;i<3;i++){
    const garment=new THREE.Group();garment.name='Hanging garment';garment.position.x=-.27+i*.27;closet.add(garment);
    const hanger=new THREE.Group();hanger.name='Shirt hanger';garment.add(hanger);
    // The hook wraps over the rail; its stem passes through the neck opening.
    pipe(hanger,m.metal,[[0,1.746,.097],[0,1.784,.10],[0,1.789,.137],[0,1.763,.16],[0,1.70,.16],[0,1.615,.16]],.007);
    hanger.userData.shoulderContacts=[[-.075,1.581,.16],[.075,1.581,.16]];
    for(const tip of hanger.userData.shoulderContacts)rod(hanger,m.metal,[0,1.615,.16],tip,.007);
    rod(hanger,m.metal,...hanger.userData.shoulderContacts,.007);
    // The middle garment has long, hanging sleeves with a clear underarm gap.
    // Keep all three silhouettes separated within the existing wardrobe.
    const sweatshirt=i===1,workShirt=i===0;
    const points=sweatshirt?[[-.035,1.51],[-.075,1.49],[-.102,1.43],[-.119,1.20],[-.118,.778],[-.084,.778],[-.080,1.23],[-.070,1.34],[-.070,.798],
      [.070,.798],[.070,1.34],[.080,1.23],[.084,.778],[.118,.778],[.119,1.20],[.102,1.43],[.075,1.49],[.035,1.51],[.028,1.47],[.015,1.455],[-.015,1.455],[-.028,1.47]]:
      workShirt?[[-.035,1.51],[-.075,1.49],[-.12,1.38],[-.093,1.315],[-.083,1.35],[-.087,.84],[-.075,.80],[-.046,.79],
      [.046,.79],[.075,.80],[.087,.84],[.083,1.35],[.093,1.315],[.12,1.38],[.075,1.49],[.035,1.51],[.025,1.465],[0,1.44],[-.025,1.465]]:
      [[-.035,1.51],[-.075,1.49],[-.12,1.38],[-.085,1.32],[-.07,1.37],[-.07,.74],
      [.07,.74],[.07,1.37],[.085,1.32],[.12,1.38],[.075,1.49],[.035,1.51],[.026,1.46],[-.026,1.46]];
    const shape=new THREE.Shape();shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
    const shirt=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:sweatshirt||workShirt,bevelThickness:.0015,bevelSize:.0015,bevelSegments:1,steps:1,curveSegments:1}),sweatshirt?navyCloth:workShirt?brownCloth:whiteCloth);
    shirt.name=sweatshirt?'Hanging sweatshirt':workShirt?'Hanging work shirt':'Seamless T-shirt';shirt.position.set(0,.10,.12);shirt.castShadow=shirt.receiveShadow=true;garment.add(shirt);
    if(sweatshirt)sweatshirtTrim(shirt,navyCloth,m.sweatshirtPrint);
    if(workShirt)workShirtTrim(shirt,brownCloth,m.workShirtPatchLeft,m.workShirtPatchRight);
  }
  for(let i=0;i<3;i++)box(closet,whiteCloth,0,.45+i*.08,.12,.59,.075,.39,.018).name='Folded clothing';
  // Use Milo's actual left/right boots, at their worn size, without a separate prop model.
  for(const side of [-1,1]){
    const pair=new THREE.Group();pair.name='Wardrobe boot';pair.userData.side=side;
    const boot=createMiloBoot(pair,wearMaterials,side);boot.position.set(0,0,0);
    boot.position.y=-new THREE.Box3().setFromObject(boot).min.y;
    pair.position.set(.43+side*.12,.11,-3.98);root.add(pair);
  }
  const basket=new THREE.Group();basket.name='Laundry basket';basket.position.set(.84,.13,-3.45);root.add(basket);
  box(basket,m.enamel,0,.04,0,.42,.08,.48);
  for(const side of [-1,1])for(let i=0;i<5;i++)box(basket,m.enamel,side*.20,.11+i*.045,0,.025,.018,.47);
  for(const side of [-1,1])box(basket,m.enamel,0,.22,side*.23,.42,.025,.026);
  box(basket,m.cloth,0,.27,0,.33,.11,.36,.045);
}

function stores(root,m){
  const rack=new THREE.Group();rack.name='Food and household storage rack';rack.position.z=-4.70;root.add(rack);
  for(const x of [-.93,.04,.93])for(const z of [-.34,.35])box(rack,m.metal,x,1.16,z,.045,2.12,.045);
  for(const y of [.18,.69,1.20,1.71,2.22])box(rack,m.metal,0,y,0,1.94,.045,.78);
  // Strapped ration cases and tins occupy the left half of the rack.
  for(let row=0;row<3;row++){
    const y=.38+row*.51;
    box(rack,m.olive,-.46,y,.04,.78,.34,.56,.025).name='Food ration case';
    box(rack,m.cloth,-.46,y,.327,.31,.13,.009);
    for(const dx of [-.27,.27])box(rack,m.yellow,-.46+dx,y,.333,.04,.34,.016);
  }
  for(let i=0;i<4;i++){
    const x=-.78+i*.21;
    cylinder(rack,m.enamel,x,1.89,.12,.077,.28,.077,16).name='Preserved food tin';
    cylinder(rack,m.metal,x,2.035,.12,.080,.015,.080,16);
    box(rack,m.olive,x,1.90,.198,.11,.12,.01);
  }
  // Household supplies: detergent, folded linen and paper rolls.
  for(let i=0;i<3;i++){
    const x=.25+i*.24;
    box(rack,m.teal,x,.41,.04,.19,.40,.29,.025).name='Household detergent';
    box(rack,m.dark,x,.63,.04,.085,.055,.10,.01);
    box(rack,m.cloth,x,.42,.192,.11,.16,.01);
  }
  for(let i=0;i<4;i++)box(rack,i%2?m.cloth:m.enamel,.49,.77+i*.09,.04,.69,.075,.55,.02).name='Stored linen';
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
    const x=.25+col*.24,y=1.34+row*.23;
    const roll=cylinder(rack,m.cloth,x,y,.07,.105,.30,.105,20);roll.rotation.x=Math.PI/2;roll.name='Paper roll';
    const core=cylinder(rack,m.dark,x,y,.225,.030,.012,.030,12);core.rotation.x=Math.PI/2;
  }
  for(let i=0;i<2;i++)box(rack,m.enamel,.29+i*.38,1.93,.03,.33,.36,.54,.02).name='Household supply box';
}

export function createRearRoomFurnishings(m,g,wearMaterials=m){
  const root=new THREE.Group();root.name=g.room==='laundry'?'Laundry and wardrobe room':'Food and household storeroom';
  root.position.set(g.x,g.floor,0);
  if(g.room==='laundry')laundry(root,m,wearMaterials);else stores(root,m);
  return root;
}
