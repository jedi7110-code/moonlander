import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {box,ball,cylinder,rod,pipe,label} from './materials.js';
import {CABIN_LIGHT_COLOR} from './lighting.js';
import {createCondensateSight} from './condensate.js';

function waterRecovery(root,m){
  const water=new THREE.MeshStandardMaterial({color:0x9bd7c8,roughness:.10,metalness:.15});
  const hood=box(root,m.metal,0,2.56,-.68,2.90,.16,.70,.025);hood.name='Humidity recovery hood';
  for(let i=0;i<24;i++)box(root,m.black,-1.31+i*.114,2.56,-.318,.06,.06,.012);
  pipe(root,m.metal,[[1.34,2.56,-.73],[1.93,2.56,-.73],[1.93,2.16,-.73]],.09).name='Air return duct';
  box(root,m.dark,2.03,1.29,-.91,.93,2.46,.25,.025);
  const fan=new THREE.Group();fan.name='Recovery fan';fan.position.set(2.03,2.18,-.65);root.add(fan);
  cylinder(fan,m.black,0,0,0,.23,.03).rotation.x=Math.PI/2;
  const rotor=new THREE.Group();rotor.position.z=.025;fan.add(rotor);
  for(let i=0;i<5;i++){
    const blade=box(rotor,m.metal,0,.15,0,.08,.13,.025,.012);
    blade.rotation.z=i*Math.PI*2/5;blade.position.set(Math.sin(-blade.rotation.z)*.15,Math.cos(blade.rotation.z)*.15,0);
  }
  for(let i=-2;i<=2;i++)rod(fan,m.dark,[-.22,i*.075,.065],[.22,i*.075,.065],.012);
  box(root,m.metal,2.03,1.86,-.60,.65,.055,.37,.015).name='Condensate tray';
  box(root,water,2.03,1.893,-.60,.52,.007,.23).name='Recovered condensate';
  // Only the condensate inspection segment is transparent; nutrient lines are opaque.
  const condensate=createCondensateSight(root,m.metal);
  pipe(root,m.black,[[1.73,.50,-.53],[1.73,.42,-.76],[.53,.32,-.76]],.034).name='Filtered condensate return';
  cylinder(root,m.enamel,2.18,1.53,-.54,.12,.40).name='Replaceable filter cartridge';
  for(const y of [1.32,1.74])cylinder(root,m.metal,2.18,y,-.54,.14,.04);
  label(root,'FILTER',2.18,1.53,-.407,.19,.10,{size:40});
  pipe(root,m.black,[[2.03,1.87,-.70],[2.18,1.76,-.70],[2.18,1.75,-.54]],.025);
  box(root,m.metal,2.16,1.05,-.59,.40,.29,.29,.02).name='Enclosed UV treatment';
  label(root,'UV / SEALED',2.16,1.065,-.435,.34,.08,{size:48});
  ball(root,m.green,2.16,.99,-.428,.017,.017,.01);
  pipe(root,m.black,[[2.18,1.30,-.54],[2.18,1.22,-.54],[2.16,1.19,-.54]],.025);
  pipe(root,m.black,[[2.16,.90,-.54],[1.73,.88,-.53]],.025);
  box(root,m.black,2.10,.66,-.60,.65,.28,.16,.02).name='Nutrient conductivity sensor';
  label(root,'EC / pH\nLOOP OK',2.10,.66,-.511,.59,.21,{fg:'#a2d9c7',size:48});
  for(const [i,text]of ['A','B'].entries()){
    cylinder(root,m.enamel,1.87+i*.30,.29,-.57,.09,.26);
    cylinder(root,m.black,1.87+i*.30,.45,-.57,.07,.045);
    label(root,text,1.87+i*.30,.30,-.472,.10,.10,{size:48});
    pipe(root,m.black,[[1.87+i*.30,.45,-.57],[1.87+i*.30,.48,-.83],[1.25,.24,-.83],[.6,.24,-.83]],.012);
  }
  return{rotor,condensate,water};
}

function plantRandom(seed){
  return()=>{
    seed+=0x6D2B79F5;let n=seed;
    n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);
    return((n^n>>>14)>>>0)/4294967296;
  };
}

// Round, lance-shaped and softly lobed young leaves. A narrow petiole is part
// of each surface, so varied foliage needs no separate stem meshes.
const LEAF_FORMS=[
  {width:.078,length:.255,roundness:.57,lobes:.035},
  {width:.045,length:.295,roundness:.92,lobes:.025},
  {width:.076,length:.265,roundness:.72,lobes:.25},
];
function leafPoint(t,s,form){
  const u=Math.max(0,(t-form.petiole)/(1-form.petiole)),blade=Math.sin(Math.PI*u);
  const wave=Math.sin(u*Math.PI*6+form.phase+s*.35);
  const width=t<form.petiole?.0022:Math.max(.0002,
    form.width*Math.pow(blade,form.roundness)*(.80+.35*u)*(1-form.lobes*(.5+.5*wave)));
  return new THREE.Vector3(
    s*width*(1+form.asymmetry*s)+form.sideBend*t*t,
    form.length*t-form.curl*t*t*t-.018*s*s*blade,
    form.bow*t*t+form.twist*s*width*t+.005*wave*s*s*blade
  );
}
function createBabyLeafPlant(material,water,seed){
  const random=plantRandom(seed),plant=new THREE.Group();plant.name='Baby leaf rosette';
  const points=[],colors=[],indices=[],rows=14,cross=[-1,-.62,-.10,0,.10,.62,1],cols=cross.length-1;
  const count=7+Math.floor(random()*5),family=Math.floor(random()*LEAF_FORMS.length);
  const vigor=.82+random()*.28,start=random()*Math.PI*2;
  const shade=new THREE.Color(),vein=new THREE.Color(.94,1.12,.69);
  plant.userData.swayPhase=random()*Math.PI*2;plant.userData.lean=(random()-.5)*.10;
  for(let l=0;l<count;l++){
    const age=l/(count-1),form={...LEAF_FORMS[family],
      petiole:.14+random()*.08,phase:random()*Math.PI*2,
      asymmetry:(random()-.5)*.24,sideBend:(random()-.5)*.035,
      curl:.025+random()*.055,bow:.055+random()*.060,twist:(random()-.5)*.9};
    const size=vigor*(.91+random()*.25)*(1-age*.38),angle=start+l*2.399+(random()-.5)*.58;
    const transform=new THREE.Matrix4().makeRotationY(angle)
      .multiply(new THREE.Matrix4().makeRotationX(.12+(1-age)*(.28+random()*.35)))
      .multiply(new THREE.Matrix4().makeRotationZ((random()-.5)*.27))
      .scale(new THREE.Vector3(size*(.84+random()*.32),size,size));
    const color=new THREE.Color(.75+random()*.32,.80+random()*.24,.71+random()*.32),offset=points.length/3;
    for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
      const t=i/rows,s=cross[j],point=leafPoint(t,s,form).applyMatrix4(transform);
      points.push(point.x,point.y,point.z);
      shade.copy(color).multiplyScalar(.88+t*.12).lerp(vein,t<form.petiole?.5:Math.abs(s)<.05?.22:0);
      colors.push(shade.r,shade.g,shade.b);
      if(i<rows&&j<cols){const a=offset+i*(cols+1)+j;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
    }
    // Occasional tiny beads sit on the actual bent leaf, not a fixed point in air.
    if(l===1&&random()>.45){
      const point=leafPoint(.58,(random()-.5)*.8,form).applyMatrix4(transform),radius=.005+random()*.002;
      const drop=ball(plant,water,point.x,point.y-.002,point.z,radius,radius*1.3,radius);
      drop.name='Leaf underside droplet';drop.castShadow=false;
    }
  }
  // One draw per plant. Growth and the existing gentle sway still move the root.
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const canopy=new THREE.Mesh(geometry,material);canopy.name='Baby leaf canopy';canopy.castShadow=true;canopy.receiveShadow=true;
  plant.add(canopy);return plant;
}
export function createPlantRack(m,x){
  if(!THREE.UniformsLib.LTC_HALF_1)RectAreaLightUniformsLib.init();
  const root=new THREE.Group();root.name='Wall vegetable rack';root.position.x=x;
  const greens=[0x39651b,0x254f2a,0x315e28].map(color=>new THREE.MeshStandardMaterial({color,roughness:.84,envMapIntensity:.14,side:THREE.DoubleSide,vertexColors:true}));
  box(root,m.dark,0,1.27,-1.03,2.90,2.48,.15,.03);
  for(const side of [-1,1]){
    box(root,m.metal,side*1.42,1.27,-.76,.045,2.46,.53);
    rod(root,m.black,[side*1.35,.18,-.83],[side*1.35,2.43,-.83],.028);
  }
  box(root,m.dark,0,2.38,-.35,2.60,.19,.09,.01);
  label(root,'HYDROPONICS',0,2.38,-.29,2.60,.19,{size:40});
  const recovery=waterRecovery(root,m),rows=[];
  const growDiffuser=new THREE.MeshBasicMaterial({name:'Full-spectrum grow diffuser',color:CABIN_LIGHT_COLOR,toneMapped:false});
  growDiffuser.userData.cabinAlwaysPowered=true;
  for(let i=0;i<3;i++){
    const y=1.80-i*.62,plants=[];
    box(root,m.enamel,-.16,y,-.66,2.32,.14,.54,.025);
    box(root,m.dark,-.16,y+.078,-.65,2.22,.014,.42);
    box(root,m.metal,-.16,y+.47,-.66,2.32,.04,.49);
    box(root,growDiffuser,-.16,y+.444,-.60,2.20,.014,.30).name=`Grow light diffuser ${i+1}`;
    box(root,growDiffuser,-.16,y+.426,-.393,2.16,.026,.018).name=`Grow light front lens ${i+1}`;
    const growLight=new THREE.RectAreaLight(CABIN_LIGHT_COLOR,5.5,2.20,.30);
    growLight.name=`Plant grow light ${i+1}`;growLight.position.set(-.16,y+.431,-.60);growLight.rotation.x=-Math.PI/2;root.add(growLight);
    for(const z of [-.83,-.39])box(root,m.metal,-.16,y+.452,z,2.30,.06,.025);
    for(const side of [-1,1])rod(root,m.black,[side*1.35,y,-.83],[side*1.18,y,-.70],.020);
    for(let p=0;p<6;p++){
      const seed=7141+i*311+p*97,random=plantRandom(seed+83);
      const plant=createBabyLeafPlant(greens[i],recovery.water,seed);
      plant.position.set(-1.08+p*.37+(random()-.5)*.055,y+.09,-.59+(random()-.5)*.07);
      plant.rotation.z=plant.userData.lean;root.add(plant);plants.push(plant);
    }
    box(root,m.black,1.20,y+.20,-.59,.17,.43,.045,.015);
    const segments=[];
    for(let k=0;k<8;k++)segments.push(box(root,new THREE.MeshBasicMaterial({color:0x243b31}),1.20,y+.035+k*.040,-.56,.10,.025,.01));
    const lampMat=new THREE.MeshBasicMaterial({color:0x568771});
    const lamp=cylinder(root,lampMat,1.20,y+.425,-.57,.035,.024,.035,16);lamp.rotation.x=Math.PI/2;
    rows.push({plants,segments,lamp,growLight});
  }
  box(root,m.teal,0,.23,-.80,1.24,.33,.42,.025).name='Nutrient reservoir';
  label(root,'NUTRIENT / RETURN',0,.23,-.585,1.08,.13,{size:40});
  for(const side of [-1,1])pipe(root,m.black,[[side*1.35,.18,-.83],[side*.80,.15,-.83],[side*.62,.23,-.83]],.028);
  return{root,rows,recovery};
}
export function animatePlants(rack,bed,time){
  rack.recovery.rotor.rotation.z=-time*3.2;
  rack.recovery.condensate.update(time);
  rack.rows.forEach((row,i)=>{
    const growth=bed.rows[i].growth,ready=growth>=1;
    row.plants.forEach(plant=>{plant.scale.setScalar(.25+.75*growth);plant.rotation.z=plant.userData.lean+Math.sin(time*.65+plant.userData.swayPhase)*.008;});
    row.segments.forEach((segment,k)=>segment.material.color.setHex(k<Math.ceil(growth*8)?ready?0xb5e477:0x72b9a2:0x243b31));
    row.lamp.material.color.setHex(ready?0xc7f58c:0x568771);
  });
}
