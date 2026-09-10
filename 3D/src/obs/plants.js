import * as THREE from 'three';
import {box,ball,cylinder,rod,pipe,label} from './materials.js';

function waterRecovery(root,m){
  const glass=new THREE.MeshStandardMaterial({color:0xc5e1d9,transparent:true,opacity:.23,roughness:.12,metalness:.05,depthWrite:false});
  const water=new THREE.MeshStandardMaterial({color:0x9bd7c8,roughness:.10,metalness:.15});
  const hood=box(root,m.metal,0,2.56,-.68,2.90,.16,.70,.025);hood.name='Humidity recovery hood';
  for(let i=0;i<24;i++)box(root,m.black,-1.31+i*.114,2.56,-.318,.06,.06,.012);
  pipe(root,m.metal,[[1.34,2.56,-.73],[1.93,2.56,-.73],[1.93,2.16,-.73]],.09).name='Air return duct';
  box(root,m.dark,2.03,1.29,-.91,.93,2.46,.25,.025);
  const fan=new THREE.Group();fan.name='Recovery fan';fan.position.set(2.03,2.18,-.65);root.add(fan);
  cylinder(fan,m.black,0,0,0,.23,.03).rotation.x=Math.PI/2;
  const rotor=new THREE.Group();rotor.position.z=.025;fan.add(rotor);
  for(let i=0;i<5;i++){
    const blade=box(rotor,m.metal,0,.11,0,.10,.19,.025,.025);
    blade.rotation.z=i*Math.PI*2/5;blade.position.set(Math.sin(-blade.rotation.z)*.11,Math.cos(blade.rotation.z)*.11,0);
  }
  for(let i=-2;i<=2;i++)rod(fan,m.dark,[-.22,i*.075,.065],[.22,i*.075,.065],.012);
  box(root,m.metal,2.03,1.86,-.60,.65,.055,.37,.015).name='Condensate tray';
  box(root,water,2.03,1.893,-.60,.52,.007,.23).name='Recovered condensate';
  // Only the condensate inspection segment is transparent; nutrient lines are opaque.
  const sight=rod(root,glass,[1.73,.50,-.53],[1.73,.88,-.53],.044);sight.name='Condensate sight tube';
  for(const y of [.50,.88])cylinder(root,m.metal,1.73,y,-.53,.058,.045);
  pipe(root,m.black,[[1.73,.50,-.53],[1.73,.42,-.76],[.53,.32,-.76]],.034).name='Filtered condensate return';
  const drops=[];
  for(let i=0;i<3;i++)drops.push(ball(root,water,1.73,.55+i*.10,-.53,.025,.025,.025));
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
  return{rotor,drops,water};
}

// Curved leaf surface, with a raised midrib and a softly corrugated edge.
function leafGeometry(){
  const points=[],indices=[],rows=12,cols=6;
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const t=i/rows,s=j/cols*2-1,w=Math.pow(Math.sin(Math.PI*t),.7)*(.085+.004*Math.sin(t*27));
    points.push(s*w,.26*t-.06*t*t-.024*s*s*Math.sin(Math.PI*t),.14*t*t+.008*Math.sin(t*25)*s*s);
    if(i<rows&&j<cols){const a=i*(cols+1)+j;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function createPlantRack(m,x){
  const root=new THREE.Group();root.name='Wall vegetable rack';root.position.x=x;
  const leaf=leafGeometry(),greens=[0x39651b,0x254f2a,0x315e28].map(color=>new THREE.MeshStandardMaterial({color,roughness:.84,envMapIntensity:.14,side:THREE.DoubleSide}));
  box(root,m.dark,0,1.27,-1.03,2.90,2.48,.15,.03);
  for(const side of [-1,1]){
    box(root,m.metal,side*1.42,1.27,-.76,.045,2.46,.53);
    rod(root,m.black,[side*1.35,.18,-.83],[side*1.35,2.43,-.83],.028);
  }
  box(root,m.dark,0,2.38,-.35,2.60,.19,.09,.01);
  label(root,'BOTANICS / 03',0,2.38,-.29,2.60,.19,{size:40});
  const recovery=waterRecovery(root,m),rows=[];
  for(let i=0;i<3;i++){
    const y=1.80-i*.62,plants=[];
    box(root,m.enamel,-.16,y,-.66,2.32,.14,.54,.025);
    box(root,m.dark,-.16,y+.078,-.65,2.22,.014,.42);
    box(root,m.metal,-.16,y+.47,-.66,2.32,.04,.49);
    box(root,m.lamp,-.16,y+.444,-.60,2.20,.014,.30);
    for(const side of [-1,1])rod(root,m.black,[side*1.35,y,-.83],[side*1.18,y,-.70],.020);
    for(let p=0;p<6;p++){
      const plant=new THREE.Group();plant.position.set(-1.08+p*.37,y+.09,-.58);root.add(plant);plants.push(plant);
      for(let l=0;l<9;l++){
        const pivot=new THREE.Group();pivot.rotation.y=l*2.399;plant.add(pivot);
        pivot.rotation.x=.15+(l%3)*.30;
        const mesh=new THREE.Mesh(leaf,greens[i]);mesh.scale.setScalar(.8+(l%3)*.15);
        mesh.scale.x*=i===0?1.2:i===1?.8:.75;mesh.scale.y*=i===2?.78:1;
        mesh.castShadow=true;pivot.add(mesh);
        if(l===2||l===5){
          const drop=ball(mesh,recovery.water,.024,.14,.067,.008,.012,.008);
          drop.name='Leaf underside droplet';drop.castShadow=false;
        }
        rod(pivot,greens[i],[0,0,0],[0,.20,.075],.003);
      }
    }
    box(root,m.black,1.20,y+.20,-.59,.17,.43,.045,.015);
    const segments=[];
    for(let k=0;k<8;k++)segments.push(box(root,new THREE.MeshBasicMaterial({color:0x243b31}),1.20,y+.035+k*.040,-.56,.10,.025,.01));
    const lampMat=new THREE.MeshBasicMaterial({color:0x568771});
    const lamp=cylinder(root,lampMat,1.20,y+.425,-.57,.035,.024,.035,16);lamp.rotation.x=Math.PI/2;
    rows.push({plants,segments,lamp});
  }
  box(root,m.teal,0,.23,-.80,1.24,.33,.42,.025).name='Nutrient reservoir';
  label(root,'NUTRIENT / RETURN',0,.23,-.585,1.08,.13,{size:40});
  for(const side of [-1,1])pipe(root,m.black,[[side*1.35,.18,-.83],[side*.80,.15,-.83],[side*.62,.23,-.83]],.028);
  return{root,rows,recovery};
}
export function animatePlants(rack,bed,time){
  rack.recovery.rotor.rotation.z=-time*3.2;
  rack.recovery.drops.forEach((drop,i)=>{drop.position.y=.83-((time*.12+i*.10)%.28);});
  rack.rows.forEach((row,i)=>{
    const growth=bed.rows[i].growth,ready=growth>=1;
    row.plants.forEach((plant,j)=>{plant.scale.setScalar(.25+.75*growth);plant.rotation.z=Math.sin(time*.65+j+i)*.008;});
    row.segments.forEach((segment,k)=>segment.material.color.setHex(k<Math.ceil(growth*8)?ready?0xb5e477:0x72b9a2:0x243b31));
    row.lamp.material.color.setHex(ready?0xc7f58c:0x568771);
  });
}
