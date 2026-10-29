// Rebind the user-supplied continuous FinalBaseMesh to the existing cabin rig.
// Usage: node studies/milo/build-body.mjs source.obj output.json
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
const [source,output]=process.argv.slice(2);
if(!source||!output)throw new Error('Expected source OBJ and output JSON');
const vertices=[],faces=[];
for(const line of fs.readFileSync(source,'utf8').split(/\r?\n/)){
  const fields=line.trim().split(/\s+/);
  if(fields[0]==='v')vertices.push(new THREE.Vector3(...fields.slice(1).map(Number)));
  if(fields[0]==='f')faces.push(fields.slice(1).map(v=>Number(v.split('/')[0])-1));
}
const bounds=new THREE.Box3().setFromPoints(vertices),scale=1.82/(bounds.max.y-bounds.min.y);
vertices.forEach(v=>{v.y-=bounds.min.y;v.multiplyScalar(scale);});
const smooth=(v,a,b)=>THREE.MathUtils.smoothstep(v,a,b);
const bones=[{name:'body',target:[0,0,0]},{name:'chest',target:[0,0,0]},{name:'head',target:[0,1.637,-.009]}];
const limbs=[];
for(const side of [-1,1]){
  const prefix=side<0?'L':'R';
  const arm={side,shoulder:new THREE.Vector3(side*.192,1.475,-.038),elbow:new THREE.Vector3(side*.327,1.231,-.024),wrist:new THREE.Vector3(side*.441,1.039,-.004)};
  const leg={hip:new THREE.Vector3(side*.120,.970,-.035),knee:new THREE.Vector3(side*.151,.535,-.026),ankle:new THREE.Vector3(side*.157,.110,-.066)};
  const definitions=[
    ['arm',[side*.207,1.488,0],arm.shoulder,arm.elbow,.310],
    ['elbow',[side*.207,1.178,0],arm.elbow,arm.wrist,.274],
    ['hand',[side*.207,.904,0],arm.wrist,arm.wrist.clone().add(new THREE.Vector3(side*.042,-.145,0)),.145],
    ['leg',[side*.100,.970,0],leg.hip,leg.knee,.435],
    ['knee',[side*.100,.535,0],leg.knee,leg.ankle,.425],
    ['boot',[side*.100,.110,.013],leg.ankle,leg.ankle.clone().add(new THREE.Vector3(0,-.10,0)),.10],
  ];
  for(const [name,target,a,b,length]of definitions){
    const direction=b.clone().sub(a),rotation=new THREE.Quaternion().setFromUnitVectors(direction.clone().normalize(),new THREE.Vector3(0,-1,0));
    arm[name+'Index']=bones.length;bones.push({name:prefix+'_'+name,target,source:a.toArray(),rotation:rotation.toArray(),lengthScale:length/direction.length()});
  }
  arm.fingerIndices=[];
  for(let finger=0;finger<4;finger++){
    const x=(finger-1.5)*.014,y=-.078+Math.abs(finger-1.5)*.009;
    const chain=[];
    for(const [link,dy]of [0,-.028,-.052].entries()){
      chain.push(bones.length);bones.push({name:`${prefix}_finger${finger}_${link}`,target:[side*.207+x,.904+y+dy,.012]});
    }
    arm.fingerIndices.push(chain);
  }
  arm.thumbIndex=bones.length;bones.push({name:prefix+'_thumb',target:[side*.207-side*.029,.904-.051,.025]});
  limbs.push({arm,leg});
}
for(const {arm}of limbs){
  const prefix=arm.side<0?'L':'R';arm.wristIndices=[];
  for(let j=1;j<=2;j++){arm.wristIndices.push(bones.length);bones.push({name:`${prefix}_wrist${j}`,target:[arm.side*.207,.904,0]});}
}
function transformed(v,index){
  if(index<3){
    const out=v.clone();out.y=v.y<.970?v.y: v.y<1.475?.970+(v.y-.970)*(.518/.505):1.488+(v.y-1.475)*(.127/.125);
    out.z+=.030;return out;
  }
  const bone=bones[index],out=v.clone().sub(new THREE.Vector3(...bone.source)).applyQuaternion(new THREE.Quaternion(...bone.rotation));
  out.y*=bone.lengthScale;
  if(bone.name.endsWith('_hand')){
    out.z+=.020;out.multiply(new THREE.Vector3(.75,.85,.70));
    out.applyAxisAngle(new THREE.Vector3(0,1,0),bone.name.startsWith('R')?-Math.PI/2:Math.PI/2);
  }
  return out.add(new THREE.Vector3(...bone.target));
}
const positions=[],weights=[],joints=[],uvs=[],regions=[],armRegions=[],remap=new Map();
for(const [i,v]of vertices.entries()){
  // Keep a neck overlap below the separately animated scan and an ankle overlap
  // inside the boots. No cuts are made at shoulders, elbows, hips or knees.
  if(v.y>1.595||v.y<.075)continue;
  const {arm,leg}=limbs[v.x<0?0:1],x=Math.abs(v.x),influence=new Map();
  const put=(id,w)=>{if(w>1e-6)influence.set(id,(influence.get(id)||0)+w);};
  const armStart=.145+Math.max(0,1.46-v.y)*.20;
  const armWeight=smooth(v.y,.70,.81)*smooth(x,armStart,armStart+.085);
  const pelvisCentre=smooth(v.y,.73,.91)*(1-smooth(x,.025,.100));
  const legWeight=(1-armWeight)*(1-smooth(v.y,.91,1.09))*(1-pelvisCentre);
  const torsoWeight=Math.max(0,1-armWeight-legWeight),chestWeight=smooth(v.y,1.06,1.31);
  put(0,torsoWeight*(1-chestWeight));put(1,torsoWeight*chestWeight);
  if(armWeight){
    const upper=arm.elbow.clone().sub(arm.shoulder),u=v.clone().sub(arm.shoulder).dot(upper)/upper.lengthSq();
    const fore=arm.wrist.clone().sub(arm.elbow),f=v.clone().sub(arm.elbow).dot(fore)/fore.lengthSq();
    const elbowBlend=smooth(u,.76,1.20),handBlend=smooth(f,.82,1.10);
    put(arm.armIndex,armWeight*(1-elbowBlend));put(arm.elbowIndex,armWeight*elbowBlend*(1-handBlend));put(arm.handIndex,armWeight*elbowBlend*handBlend);
  }
  if(legWeight){
    const kneeBlend=1-smooth(v.y,.47,.60),footBlend=1-smooth(v.y,.12,.19);
    put(arm.legIndex,legWeight*(1-kneeBlend));put(arm.kneeIndex,legWeight*kneeBlend*(1-footBlend));put(arm.bootIndex,legWeight*kneeBlend*footBlend);
  }
  const selected=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4),total=selected.reduce((s,[,w])=>s+w,0),p=new THREE.Vector3();
  for(const [id,w]of selected)p.addScaledVector(transformed(v,id),w/total);
  const handWeight=influence.get(arm.handIndex)||0,local=p.clone().sub(new THREE.Vector3(...bones[arm.handIndex].target));
  if(handWeight>.95&&local.y<-.045){
    const thumb=smooth(-arm.side*local.x,.023,.040)*(1-smooth(-local.y,.075,.110));
    const finger=THREE.MathUtils.clamp(Math.round(local.x/.014+1.5),0,3),base=-.078+Math.abs(finger-1.5)*.009;
    const curl=smooth(-local.y,.058,.090)*(1-thumb),middle=smooth(base-local.y,.017,.037),tip=smooth(base-local.y,.043,.063);
    influence.set(arm.handIndex,handWeight*(1-curl-thumb));
    put(arm.thumbIndex,handWeight*thumb);
    put(arm.fingerIndices[finger][0],handWeight*curl*(1-middle));
    put(arm.fingerIndices[finger][1],handWeight*curl*middle*(1-tip));
    put(arm.fingerIndices[finger][2],handWeight*curl*middle*tip);
  }
  const skin=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4),skinTotal=skin.reduce((s,[,w])=>s+w,0);
  const ids=skin.map(([id])=>id),ws=skin.map(([,w])=>w/skinTotal);while(ids.length<4){ids.push(0);ws.push(0);}
  remap.set(i,positions.length/3);positions.push(...p.toArray().map(n=>+n.toFixed(6)));joints.push(...ids);weights.push(...ws.map(n=>+n.toFixed(6)));
  uvs.push(+(Math.atan2(v.z+.03,v.x)/(2*Math.PI)+.5).toFixed(5),+(v.y/1.82).toFixed(5));
  const side=Math.abs(p.x),front=p.z>0;
  const neckline=front?1.535+.050*smooth(side,0,.075):1.558+.027*smooth(side,0,.075);
  const shirt=p.y<neckline&&(armWeight<.35||p.y>1.295);
  regions.push(p.y<1.075&&armWeight<.5?2:shirt?1:0);
  armRegions.push(+armWeight.toFixed(6));
}
const indices=[],materials=[];
for(const face of faces){
  if(face.some(i=>!remap.has(i)))continue;
  const ids=face.map(i=>remap.get(i));
  const region=ids.map(i=>regions[i]).sort((a,b)=>ids.filter(i=>regions[i]===b).length-ids.filter(i=>regions[i]===a).length)[0];
  for(let j=1;j<ids.length-1;j++){indices.push(ids[0],ids[j],ids[j+1]);materials.push(region);}
}
// Relax anatomical surface detail under the trousers; retain shared vertices.
const neighbours=Array.from({length:positions.length/3},()=>new Set());
for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
  const a=indices[i+j],b=indices[i+(j+1)%3];neighbours[a].add(b);neighbours[b].add(a);
}
for(let pass=0;pass<180;pass++){
  const old=positions.slice();
  for(let i=0;i<regions.length;i++){
    if(regions[i]!==2||!neighbours[i].size)continue;
    const y=old[i*3+1],seat=pass<32?1:smooth(y,.73,.81)*(1-smooth(y,.97,1.04));
    const strength=.5*smooth(y,.15,.25)*(1-smooth(y,1.02,1.075))*seat;
    for(let a=0;a<3;a++)positions[i*3+a]=THREE.MathUtils.lerp(old[i*3+a],[...neighbours[i]].reduce((s,j)=>s+old[j*3+a],0)/neighbours[i].size,strength);
  }
}
// Tailor trousers around roomy cross-sections rather than offsetting the naked
// anatomy. Keep the original shared topology and rig weights at every joint.
const trouserSections=[
  [.11,.058,.065], [.22,.077,.087], [.40,.080,.095],
  [.55,.087,.103], [.72,.098,.117], [.86,.108,.132],
];
function trouserSection(y){
  for(let i=1;i<trouserSections.length;i++){
    const a=trouserSections[i-1],b=trouserSections[i];
    if(y<=b[0]){const t=smooth(y,a[0],b[0]);return [THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t)];}
  }
  return trouserSections.at(-1).slice(1);
}
for(let i=0;i<regions.length;i++){
  if(regions[i]!==2)continue;
  const [x,y,z]=positions.slice(i*3,i*3+3),side=x<0?-1:1;
  const [rx,rz]=trouserSection(y),hip=smooth(y,.84,.97);
  // Map each leg to a near-straight cloth tube; round the seat as a single
  // envelope so gluteal/groin details do not print through the fabric.
  const theta=Math.atan2(z/.095,(x-side*.100)/.077);
  const legX=side*.100+Math.cos(theta)*rx,legZ=Math.sin(theta)*rz;
  const seatAngle=Math.atan2(z/.115,x/.160);
  const seatRx=THREE.MathUtils.lerp(.190,.174,smooth(y,.96,1.075));
  const seatRz=THREE.MathUtils.lerp(.150,.128,smooth(y,.96,1.075));
  const seatX=Math.cos(seatAngle)*seatRx,seatZ=Math.sin(seatAngle)*seatRz;
  const blend=smooth(y,.11,.20)*(1-smooth(y,1.045,1.077));
  positions[i*3]=THREE.MathUtils.lerp(x,THREE.MathUtils.lerp(legX,seatX,hip),blend);
  positions[i*3+2]=THREE.MathUtils.lerp(z,THREE.MathUtils.lerp(legZ,seatZ,hip),blend);
  // A modest dropped crotch provides ease instead of tracing the pelvis.
  positions[i*3+1]-=.012*(1-smooth(Math.abs(x),.02,.10))*smooth(y,.76,.85)*(1-smooth(y,.88,.97));
}
// Ease the seat-to-leg transition without introducing separate clothing pieces.
for(let pass=0;pass<40;pass++){
  const old=positions.slice();
  for(let i=0;i<regions.length;i++){
    if(regions[i]!==2||!neighbours[i].size)continue;
    const strength=.35*smooth(old[i*3+1],.72,.81)*(1-smooth(old[i*3+1],.97,1.04));
    for(let a=0;a<3;a++)positions[i*3+a]=THREE.MathUtils.lerp(old[i*3+a],[...neighbours[i]].reduce((s,j)=>s+old[j*3+a],0)/neighbours[i].size,strength);
  }
}
// The roomier seat has shorter surface edges than the anatomical source.
// Spread hip influence over neighbouring cloth vertices to prevent pinching
// when one knee lifts, while keeping the waistband anchored to the torso.
for(let pass=0;pass<24;pass++){
  const oldWeights=weights.slice(),oldJoints=joints.slice();
  for(let i=0;i<regions.length;i++){
    const y=positions[i*3+1];
    if(regions[i]!==2||y<.72||y>1.06||!neighbours[i].size)continue;
    const strength=.5*smooth(y,.72,.81)*(1-smooth(y,1.00,1.06)),mix=new Map();
    const add=(vertex,factor)=>{for(let j=0;j<4;j++){const id=oldJoints[vertex*4+j];mix.set(id,(mix.get(id)||0)+oldWeights[vertex*4+j]*factor);}};
    add(i,1-strength);for(const n of neighbours[i])add(n,strength/neighbours[i].size);
    const selected=[...mix].sort((a,b)=>b[1]-a[1]).slice(0,4),total=selected.reduce((s,[,w])=>s+w,0);
    for(let j=0;j<4;j++){joints[i*4+j]=selected[j]?.[0]||0;weights[i*4+j]=+(selected[j]?.[1]/total||0).toFixed(6);}
  }
}
// Smooth the chest beneath cotton, and give the shirt a relaxed torso and
// short sleeves. Shared vertices still span the shoulder and underarm.
for(let pass=0;pass<64;pass++){
  const old=positions.slice();
  for(let i=0;i<regions.length;i++){
    if(regions[i]!==1||!neighbours[i].size)continue;
    const y=old[i*3+1],strength=.4*smooth(y,1.08,1.13)*(1-smooth(y,1.46,1.53));
    for(let a=0;a<3;a++)positions[i*3+a]=THREE.MathUtils.lerp(old[i*3+a],[...neighbours[i]].reduce((s,j)=>s+old[j*3+a],0)/neighbours[i].size,strength);
  }
}
for(let i=0;i<regions.length;i++){
  if(regions[i]!==1)continue;
  const [x,y,z]=positions.slice(i*3,i*3+3);
  const torso=(1-smooth(armRegions[i],.05,.40))*smooth(y,1.075,1.14)*(1-smooth(y,1.39,1.49));
  const angle=Math.atan2(z/.110,x/.155),rx=THREE.MathUtils.lerp(.176,.184,smooth(y,1.15,1.40));
  positions[i*3]=THREE.MathUtils.lerp(x,Math.cos(angle)*rx,torso*.85);
  positions[i*3+2]=THREE.MathUtils.lerp(z,Math.sin(angle)*.126,torso*.85);
}
// Sleeve ease fades at the cuff, making a small cloth lip above bare upper arms.
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
const normal=geometry.attributes.normal;
for(let i=0;i<regions.length;i++){
  const y=positions[i*3+1];
  const sleeve=smooth(armRegions[i],.2,.6)*smooth(y,1.293,1.303);
  const offset=regions[i]===1?(.004+.014*sleeve)*(1-smooth(y,1.53,1.58)):0;
  for(let a=0;a<3;a++)positions[i*3+a]=+(positions[i*3+a]+normal.array[i*3+a]*offset).toFixed(6);
}
// The sample includes the underside of its original jaw below the head cut.
// Tuck that residual surface inside the scanned neck, not out under its chin.
for(let i=0;i<positions.length/3;i++){
  const [x,y,z]=positions.slice(i*3,i*3+3);
  const blend=smooth(y,1.530,1.560)*Math.max(1-smooth(Math.abs(x),.070,.110),smooth(y,1.565,1.582));if(!blend)continue;
  const radius=Math.hypot(x/.024,(z+.008)/.022),shrink=radius>1?1/radius:1;
  positions[i*3]=THREE.MathUtils.lerp(x,x*shrink,blend);
  positions[i*3+2]=THREE.MathUtils.lerp(z,(z+.008)*shrink-.008,blend);
}
// Build the wrist in the actual palms-in neutral pose, then invert its blended
// skin transform. Blending the forearm with a 90-degree hand rotation directly
// had pinched the joint into a thin twisted strip (linear-skinning volume loss).
const wristSections=[
  [.855,.024,.033,-.009], [.880,.024,.030,-.010],
  [.904,.024,.025,-.014], [.930,.027,.032,-.032],
  [.965,.032,.043,-.053], [1.01,.038,.047,-.048],
];
function wristSection(y){
  for(let i=1;i<wristSections.length;i++){
    const a=wristSections[i-1],b=wristSections[i];
    if(y<=b[0]){const t=smooth(y,a[0],b[0]);return a.slice(1).map((v,k)=>THREE.MathUtils.lerp(v,b[k+1],t));}
  }
  return wristSections.at(-1).slice(1);
}
for(let i=0;i<positions.length/3;i++){
  const [x,y,z]=positions.slice(i*3,i*3+3);
  if(armRegions[i]<.95||y<.855||y>1.01)continue;
  const side=x<0?-1:1,pivot=side*.207,prefix=side<0?'L':'R';let handWeight=0;
  for(let j=0;j<4;j++)if(bones[joints[i*4+j]].name.startsWith(prefix+'_')&&/hand|finger|thumb/.test(bones[joints[i*4+j]].name))handWeight+=weights[i*4+j];
  const a=1-handWeight,b=side*handWeight;
  const neutralX=a*(x-pivot)+b*z,neutralZ=-b*(x-pivot)+a*z;
  const [rx,rz,centreZ]=wristSection(y),angle=Math.atan2((neutralZ-centreZ)/rz,neutralX/rx);
  const blend=smooth(y,.855,.882)*(1-smooth(y,.962,1.01));
  const qx=THREE.MathUtils.lerp(neutralX,Math.cos(angle)*rx,blend);
  const qz=THREE.MathUtils.lerp(neutralZ,centreZ+Math.sin(angle)*rz,blend);
  // Two intermediate rotations keep neighbouring skin transforms within 60
  // degrees even when a grasp turns the palm through a half turn.
  const {arm}=limbs[side<0?0:1],influence=new Map();
  for(let j=0;j<4;j++){const id=joints[i*4+j];influence.set(id,(influence.get(id)||0)+weights[i*4+j]);}
  const foreWeight=influence.get(arm.elbowIndex)||0,tipWeight=influence.get(arm.handIndex)||0,total=foreWeight+tipWeight;
  if(total>.99){
    influence.delete(arm.elbowIndex);influence.delete(arm.handIndex);
    const t=(1-smooth(y,.884,.965))*3,lower=Math.min(2,Math.floor(t)),fraction=t-lower,chain=[arm.elbowIndex,...arm.wristIndices,arm.handIndex];
    influence.set(chain[lower],total*(1-fraction));influence.set(chain[lower+1],total*fraction);
    const selected=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=selected.reduce((s,[,w])=>s+w,0);
    for(let j=0;j<4;j++){joints[i*4+j]=selected[j]?.[0]||0;weights[i*4+j]=+(selected[j]?.[1]/sum||0).toFixed(6);}
  }
  let ca=0,cb=0;
  for(let j=0;j<4;j++){
    const id=joints[i*4+j],name=bones[id].name;
    const turn=id===arm.wristIndices[0]?1/3:id===arm.wristIndices[1]?2/3:/hand|finger|thumb/.test(name)?1:0;
    ca+=weights[i*4+j]*Math.cos(turn*side*Math.PI/2);cb+=weights[i*4+j]*Math.sin(turn*side*Math.PI/2);
  }
  const determinant=ca*ca+cb*cb;
  positions[i*3]=+(pivot+(ca*qx-cb*qz)/determinant).toFixed(6);
  positions[i*3+2]=+((cb*qx+ca*qz)/determinant).toFixed(6);
}
const data={source:path.basename(source),bones:bones.map(({name,target})=>({name,target})),positions,indices,weights,joints,uvs,armRegions};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(data));
console.log(JSON.stringify({vertices:positions.length/3,triangles:indices.length/3,bones:bones.length,output}));
