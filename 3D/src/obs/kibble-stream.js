import {DynamicDrawUsage,Euler,InstancedMesh,Matrix4,Quaternion,SphereGeometry,Vector3} from 'three';

export const KIBBLE_STREAM={capacity:64,start:1.5,finishLead:1,gravity:9.8};

// Seeded per refill, not per frame: pause and study seeking preserve trajectories.
export function kibbleDrops(seed,duration=6){
  let state=(Math.imul(seed+1,0x9e3779b1)^0x85ebca6b)>>>0;
  const random=()=>{state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const drops=[];
  for(let birth=KIBBLE_STREAM.start;birth<duration-KIBBLE_STREAM.finishLead;birth+=.011+random()*.027){
    const angle=random()*Math.PI*2,radius=Math.sqrt(random())*.105;
    drops.push({birth,sourceX:(random()-.5)*.034,sourceZ:(random()-.5)*.014,
      x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,down:.08+random()*.22,
      radius:.009+random()*.004,aspect:.7+random()*.5,
      rotation:[random()*6.28,random()*6.28,random()*6.28],spin:[(random()-.5)*12,(random()-.5)*12,(random()-.5)*12],
      bounce:.009+random()*.015,settle:.10+random()*.10});
  }
  return drops;
}

// An analytic drop avoids frame-rate-dependent simulation and particle respawns.
// The short final bounce settles below the bowl rim before recycling the slot.
export function sampleKibbleDrop(drop,age,source,bowl,out=new Vector3()){
  const t=age-drop.birth;if(t<0)return false;
  const height=Math.max(.01,source.y-bowl.y),g=KIBBLE_STREAM.gravity;
  const flight=(Math.sqrt(drop.down**2+2*g*height)-drop.down)/g;
  const after=t-flight;if(after>drop.settle)return false;
  const u=Math.min(1,t/flight);
  out.set(source.x+drop.sourceX+(bowl.x+drop.x-source.x-drop.sourceX)*u,
    source.y-drop.down*Math.min(t,flight)-g*Math.min(t,flight)**2/2,
    source.z+drop.sourceZ+(bowl.z+drop.z-source.z-drop.sourceZ)*u);
  if(after>=0){
    const v=after/drop.settle;
    out.y=bowl.y+drop.bounce*Math.sin(Math.PI*v)-.025*v*v;
  }
  return true;
}

export function createKibbleStream(material){
  material.userData.cabinNoOutline=true;
  // 48 triangles per grain, one draw call, no per-grain meshes or shadows.
  const mesh=new InstancedMesh(new SphereGeometry(1,6,5),material,KIBBLE_STREAM.capacity);
  mesh.name='Cat food / loose falling grains';mesh.count=0;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  const point=new Vector3(),scale=new Vector3(),rotation=new Euler(),quaternion=new Quaternion(),matrix=new Matrix4();
  let lastSeed,lastDuration,drops=[];
  function update(age,duration,seed,source,bowl){
    if(seed!==lastSeed||duration!==lastDuration){drops=kibbleDrops(seed,duration);lastSeed=seed;lastDuration=duration;}
    let count=0;
    for(const drop of drops){
      if(drop.birth>age)break;
      if(!sampleKibbleDrop(drop,age,source,bowl,point))continue;
      const t=age-drop.birth;
      rotation.set(drop.rotation[0]+drop.spin[0]*t,drop.rotation[1]+drop.spin[1]*t,drop.rotation[2]+drop.spin[2]*t);quaternion.setFromEuler(rotation);
      scale.set(drop.radius,drop.radius*drop.aspect,drop.radius*.86);
      matrix.compose(point,quaternion,scale);mesh.setMatrixAt(count++,matrix);
      if(count===KIBBLE_STREAM.capacity)break;
    }
    mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;
    return count;
  }
  return {mesh,update};
}
