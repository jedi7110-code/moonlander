import * as THREE from 'three';
import {applyStudyCropHairline} from './crop-hairline.js';

export const GROWTH_DAYS=15;
// Hair ends at the previously approved supplied model, not a uniform mm offset.
// The 15-day timeline is an art direction target, not a biological growth rate.
export const GROWTH_LENGTH={beard:.0048};
export function growthAtDay(value){
  const day=THREE.MathUtils.clamp(Number.isFinite(Number(value))?Number(value):1,1,GROWTH_DAYS);
  const progress=(day-1)/(GROWTH_DAYS-1);
  return{day,progress,beardMm:GROWTH_LENGTH.beard*1000*progress};
}
export function studyDate(start,day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return null;
  const date=new Date(start+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==start)return null;
  const missionDay=Math.max(1,Number.isFinite(Number(day))?Number(day):1);
  date.setUTCDate(date.getUTCDate()+Math.floor(missionDay)-1);
  return date.toISOString().slice(0,10);
}

// The calendar keeps advancing: DAY 16 is the first freshly groomed day,
// followed by another 15-day growth cycle (next reset on DAY 31).
export function growthCycleAtDay(day){
  const missionDay=Math.max(1,Number.isFinite(Number(day))?Number(day):1);
  const cycle=Math.floor((missionDay-1)/GROWTH_DAYS);
  return{missionDay,cycle:cycle+1,resetDay:cycle*GROWTH_DAYS+1,...growthAtDay((missionDay-1)%GROWTH_DAYS+1)};
}

export const HAIR_LENGTH_STEPS=[.14,.30,.50,.70,.86,1];

// Each disconnected island in the supplied asset is one curved hair card.
// Its highest V edge is the root. Sample shorter distances along the card's
// existing UV flow, keeping its roots fixed and retaining the original DAY 15
// positions, normals and textures. No head/cap scaling or outward inflation.
export function addHairGrowthTargets(geometry){
  const position=geometry.attributes.position,uv=geometry.attributes.uv,index=geometry.index;
  const parents=Array.from({length:position.count},(_,i)=>i);
  const find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
  const join=(a,b)=>{parents[find(a)]=find(b);};
  for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
  const cards=new Map();
  for(let i=0;i<position.count;i++){
    const id=find(i);if(!cards.has(id))cards.set(id,{vertices:[],triangles:[]});cards.get(id).vertices.push(i);
  }
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    cards.get(find(ids[0])).triangles.push({ids,triangle:new THREE.Triangle(...ids.map(j=>new THREE.Vector3(uv.getX(j),uv.getY(j),0)))});
  }
  const positions=HAIR_LENGTH_STEPS.slice(0,-1).map(()=>position.clone());
  const query=new THREE.Vector3(),closest=new THREE.Vector3(),bary=new THREE.Vector3(),point=new THREE.Vector3(),vertex=new THREE.Vector3();
  for(const {vertices,triangles} of cards.values())for(const i of vertices){
    const u=uv.getX(i),v=uv.getY(i);let rootV=v;
    // Follow the actual root edge, including unequal UVs from simplification.
    for(const {triangle} of triangles){
      const corners=[triangle.a,triangle.b,triangle.c];
      for(let j=0;j<3;j++){
        const a=corners[j],b=corners[(j+1)%3];
        if(Math.abs(a.x-b.x)<1e-9){if(Math.abs(a.x-u)<1e-7)rootV=Math.max(rootV,a.y,b.y);}
        else{const t=(u-a.x)/(b.x-a.x);if(t>=-1e-7&&t<=1+1e-7)rootV=Math.max(rootV,THREE.MathUtils.lerp(a.y,b.y,THREE.MathUtils.clamp(t,0,1)));}
      }
    }
    positions.forEach((target,step)=>{
      if(rootV-v<1e-7)return; // The root edge is identical at every day.
      query.set(u,rootV+(v-rootV)*HAIR_LENGTH_STEPS[step],0);
      let best=Infinity;
      for(const {ids,triangle} of triangles){
        triangle.closestPointToPoint(query,closest);const distance=query.distanceToSquared(closest);
        if(distance>=best)continue;
        triangle.getBarycoord(closest,bary);if(!Number.isFinite(bary.x))continue;
        point.set(0,0,0);
        for(let j=0;j<3;j++)point.addScaledVector(vertex.fromBufferAttribute(position,ids[j]),bary.getComponent(j));
        target.setXYZ(i,point.x,point.y,point.z);best=distance;
        if(best<1e-14)break;
      }
    });
  }
  geometry.morphAttributes.position=positions;
  geometry.morphAttributes.normal=positions.map(attribute=>{
    const target=new THREE.BufferGeometry();target.setIndex(index);target.setAttribute('position',attribute);target.computeVertexNormals();
    const normal=target.attributes.normal;target.dispose();return normal;
  });
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
}

export function setHairGrowth(mesh,progress){
  const length=THREE.MathUtils.lerp(HAIR_LENGTH_STEPS[0],1,THREE.MathUtils.clamp(progress,0,1));
  mesh.morphTargetInfluences.fill(0);
  for(let i=0;i<HAIR_LENGTH_STEPS.length-1;i++)if(length<=HAIR_LENGTH_STEPS[i+1]){
    const t=(length-HAIR_LENGTH_STEPS[i])/(HAIR_LENGTH_STEPS[i+1]-HAIR_LENGTH_STEPS[i]);
    mesh.morphTargetInfluences[i]=1-t;
    if(i+1<mesh.morphTargetInfluences.length)mesh.morphTargetInfluences[i+1]=t;
    break;
  }
}

function studyCoverage(material,coverage){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);shader.uniforms.studyCoverage=coverage;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStudyHair;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvStudyHair=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float studyCoverage; varying vec3 vStudyHair;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float studyNoise=fract(sin(dot(floor(vStudyHair*310.0),vec3(127.1,311.7,74.7)))*43758.5453);
        if(studyNoise>=studyCoverage)discard;
      `);
  };
  material.customProgramCacheKey=()=>key+'-growth-coverage-v1';
}

export function beardCoverage(x,y,z){
  const s=THREE.MathUtils.smoothstep;
  const cheek=.53+s(Math.abs(x),.35,1.45)*.54;
  const beard=(1-s(y,cheek-.15,cheek+.13))*s(y,-.85,-.43)*s(z,.45,1.2);
  const moustache=s(y,.50,.64)*(1-s(y,.88,1.02))*(1-s(Math.abs(x+.11),.38,.69))*s(z,1.8,2.15);
  const lips=Math.exp(-(((y-.44)/.13)**2))*(1-s(Math.abs(x+.11),.35,.60))*s(z,1.8,2.1);
  return Math.max(beard*(1-lips),moustache);
}

export function createGrowingBeard(face,headScale=.055,forward=0){
  const source=face.index?face.toNonIndexed():face,p=source.attributes.position,n=source.attributes.normal;
  const positions=[],normals=[],coverage=[];
  for(let i=0;i<p.count;i+=3){
    const masks=[0,1,2].map(j=>beardCoverage(p.getX(i+j),p.getY(i+j),p.getZ(i+j)-forward));
    if(Math.max(...masks)<.015)continue;
    for(let j=0;j<3;j++){
      positions.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));
      normals.push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));coverage.push(masks[j]);
    }
  }
  if(source!==face)source.dispose();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('beardCoverage',new THREE.Float32BufferAttribute(coverage,1));
  const growth={value:0};
  const material=new THREE.MeshStandardMaterial({color:0x40372e,roughness:1,metalness:0});
  material.onBeforeCompile=shader=>{
    shader.uniforms.beardGrowth=growth;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute float beardCoverage; uniform float beardGrowth;
      varying float vBeardCoverage; varying vec3 vBeardPosition;
    `).replace('#include <begin_vertex>',`#include <begin_vertex>
      vBeardCoverage=beardCoverage; vBeardPosition=position;
      transformed+=normal*(0.0003+${GROWTH_LENGTH.beard.toFixed(5)}*beardGrowth)/${headScale.toFixed(6)}*smoothstep(.015,.65,beardCoverage);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float beardGrowth; varying float vBeardCoverage; varying vec3 vBeardPosition;
    `).replace('#include <color_fragment>',`#include <color_fragment>
      float grain=fract(sin(dot(floor(vBeardPosition*270.0),vec3(127.1,311.7,74.7)))*43758.5453);
      float density=vBeardCoverage*smoothstep(0.0,.72,beardGrowth);
      if(grain>density*.96 || vBeardCoverage<.035)discard;
      diffuseColor.rgb*=.70+grain*.45;
    `);
  };
  material.customProgramCacheKey=()=> 'milo-study-growing-beard-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Milo hair growth beard';mesh.visible=false;
  // Facial hair is a small surface layer, not an additional shadow-casting shell.
  mesh.frustumCulled=false;
  return{mesh,setProgress(value){growth.value=THREE.MathUtils.clamp(value,0,1);mesh.visible=growth.value>0;}};
}

export function attachGrowthStudy(head){
  // Use the already loaded approved hairstyle; setAppearance retains it when
  // switching back to A. Production defaults and source assets stay untouched.
  head.userData.setAppearance({hair:'reference',beard:'none'});
  const supplied=head.getObjectByName('Supplied Jacob hairstyle');
  head.userData.setAppearance({hair:'crop',beard:'none'});
  head.add(supplied);
  const crop=applyStudyCropHairline(head),face=head.getObjectByName('Milo scanned head'),cards=supplied.getObjectByName('Supplied hair cards');
  addHairGrowthTargets(cards.geometry);cards.updateMorphTargets();
  const cropCoverage={value:1},cardCoverage={value:0},scalpCoverage={value:0},proceduralHair={value:1};
  studyCoverage(crop.material,cropCoverage);studyCoverage(cards.material,cardCoverage);
  studyCoverage(supplied.getObjectByName('Supplied scalp').material,scalpCoverage);
  const compile=face.material.onBeforeCompile,key=face.material.customProgramCacheKey();
  face.material.onBeforeCompile=(shader,renderer)=>{compile.call(face.material,shader,renderer);shader.uniforms.proceduralHair=proceduralHair;};
  face.material.customProgramCacheKey=()=>key+'-growth-scalp-v1';
  const beard=createGrowingBeard(face.geometry,head.scale.x,head.userData.faceForward/head.scale.x);head.add(beard.mesh);
  function setGrowth(hairProgress,beardProgress=hairProgress){
    const p=THREE.MathUtils.clamp(hairProgress,0,1);
    cropCoverage.value=1-THREE.MathUtils.smoothstep(p,.04,.52);crop.visible=cropCoverage.value>0;
    cardCoverage.value=THREE.MathUtils.smoothstep(p,0,.22);supplied.visible=p>0;
    scalpCoverage.value=THREE.MathUtils.smoothstep(p,0,.42);proceduralHair.value=1-scalpCoverage.value;
    setHairGrowth(cards,p);beard.setProgress(beardProgress);
  }
  return{setGrowth,setDay(day){const state=growthAtDay(day);setGrowth(state.progress);return state;}};
}
