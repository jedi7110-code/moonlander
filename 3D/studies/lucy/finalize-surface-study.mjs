// Offline, study-only correctives measured after the same skinning and IK as OBS.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Matrix3,Matrix4,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
const [input,output]=process.argv.slice(2);
assert(input&&output,'Usage: node finalize-surface-study.mjs input.glb output.glb');
assert(input!==output,'Keep the original study for comparison');
const bytes=fs.readFileSync(input),jsonSize=bytes.readUInt32LE(12);
const json=JSON.parse(bytes.subarray(20,20+jsonSize));
const binary=bytes.subarray(28+jsonSize,28+jsonSize+bytes.readUInt32LE(20+jsonSize));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const cat=createLucy(gltf,{random:()=>.5});
animateLucy(cat,{dt:.1,time:9,mode:'look',actionTime:9,remaining:100,yaw:0});
cat.updateMatrixWorld(true);
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const parts=[binary];let length=binary.length;
function accessor(values){
  if(length%4){const pad=Buffer.alloc(4-length%4);parts.push(pad);length+=pad.length;}
  const data=Buffer.from(values.buffer,values.byteOffset,values.byteLength),view=json.bufferViews.length;
  json.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length,target:34962});
  parts.push(data);length+=data.length;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  values.forEach((v,i)=>{min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v);});
  json.accessors.push({bufferView:view,componentType:5126,count:values.length/3,type:'VEC3',min,max});
  return json.accessors.length-1;
}
const report=[];
cat.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  mesh.skeleton.update();
  const association=gltf.parser.associations.get(mesh);
  const primitive=json.meshes[association.meshes].primitives[association.primitives];
  const a=mesh.geometry.attributes,count=a.position.count;
  const corrections=Array.from({length:3},()=>new Float32Array(count*3));
  if(mesh.material.name==='Lucy calico coat'){
    const groups=[],ids=[],lookup=new Map(),source=[],original=[],inverse=[];
    for(let i=0;i<count;i++){
      const v=new Vector3().fromBufferAttribute(a.position,i),key=v.toArray().map(n=>n.toFixed(7)).join(',');
      let id=lookup.get(key);
      if(id===undefined){id=groups.length;lookup.set(key,id);groups.push(new Set());source.push(v);original.push(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));}
      ids.push(id);
      const blended=new Matrix4();blended.elements.fill(0);
      for(let k=0;k<4;k++){
        const bone=a.skinIndex.getComponent(i,k),weight=a.skinWeight.getComponent(i,k);
        const matrix=new Matrix4().multiplyMatrices(mesh.skeleton.bones[bone].matrixWorld,mesh.skeleton.boneInverses[bone]);
        matrix.elements.forEach((n,j)=>blended.elements[j]+=n*weight);
      }
      const matrix=mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse).multiply(blended).multiply(mesh.bindMatrix);
      inverse.push(new Matrix3().setFromMatrix4(matrix).invert());
    }
    const idx=mesh.geometry.index;
    for(let i=0;i<idx.count;i+=3){const tri=[0,1,2].map(k=>ids[idx.getX(i+k)]);for(const x of tri)for(const y of tri)if(x!==y)groups[x].add(y);}
    const masks=source.map((v,i)=>{
      const y=-v.z,z=v.y,p=original[i];
      return smooth(-.240,-.190,y)*(1-smooth(-.050,.015,y))*smooth(.035,.080,z)*(1-smooth(.145,.185,z))*smooth(.12,.19,p.y)*(1-smooth(.33,.42,p.y))*smooth(.010,.030,Math.abs(v.x));
    });
    let relaxed=original.map(p=>p.clone());
    for(let step=0;step<60;step++)relaxed=relaxed.map((p,i)=>{
      if(!groups[i].size)return p;
      const mean=new Vector3();for(const j of groups[i])mean.add(relaxed[j]);mean.divideScalar(groups[i].size);
      return p.clone().lerp(mean,.48*masks[i]);
    });
    // Rear-foot underside profile in actual seated world coordinates. Shift
    // the complete cross-section down by that profile, preserving thickness.
    const sole=source.map((v,i)=>({v,p:original[i]})).filter(({v,p})=>v.z<.055&&v.z>-.060&&v.y<.044&&Math.abs(v.x)>.016&&p.y<.085);
    const zMin=Math.min(...sole.map(({p})=>p.z)),zMax=Math.max(...sole.map(({p})=>p.z));
    const bins=Array.from({length:18},()=>[]);
    const bin=z=>Math.max(0,Math.min(17,Math.floor((z-zMin)/(zMax-zMin)*18)));
    sole.forEach(({p})=>bins[bin(p.z)].push(p.y));
    const profile=bins.map(v=>v.length?Math.min(...v):null);
    for(let i=0;i<profile.length;i++)if(profile[i]===null){let j=i;while(j>0&&profile[j]===null)j--;profile[i]=profile[j]??0;}
    const groundAt=z=>{const t=Math.max(0,Math.min(17,(z-zMin)/(zMax-zMin)*18-.5)),i=Math.floor(t);return profile[i]+((profile[Math.min(i+1,17)]??profile[i])-profile[i])*(t-i);};
    const hockDelta=source.map((v,i)=>{
      const p=original[i],y=-v.z;
      const mask=smooth(-.065,-.025,y)*(1-smooth(.055,.085,y))*(1-smooth(.046,.085,v.y))*(1-smooth(.07,.12,p.y));
      return new Vector3(0,-Math.max(0,groundAt(p.z)-.002)*mask,0);
    });
    // Supersedes SitFlanks: use the user's drawn front silhouette, not a
    // generic inflation. Broaden the neck root, draw the protruding hips in.
    // Screenshot feet=1630, ear tips=130; modeled height=.46044. The two red
    // outlines are averaged about the body's center to keep bilateral balance.
    const outline=[
      [.020,.060],[.040,.067],[.060,.075],[.080,.081],[.100,.087],
      [.120,.091],[.140,.094],[.160,.095],[.180,.094],[.200,.090],
      [.220,.084],[.240,.075],[.260,.067],[.280,.067],[.300,.063],
      [.320,.055],[.340,.047],[.360,.047],
    ];
    const widthSamples=outline.map(([y])=>[y,Math.max(...relaxed.filter((p,i)=>{
      const v=source[i];return Math.abs(p.y-y)<.006&&v.z>-.060&&v.z<.190&&v.y>.065;
    }).map(p=>Math.abs(p.x)),.030)]);
    function curve(samples,y){
      if(y<=samples[0][0])return samples[0][1];
      if(y>=samples.at(-1)[0])return samples.at(-1)[1];
      const i=samples.findIndex((s,k)=>k<samples.length-1&&s[0]<=y&&samples[k+1][0]>=y);
      const a=samples[i],b=samples[i+1],previous=samples[Math.max(0,i-1)],next=samples[Math.min(samples.length-1,i+2)];
      const t=(y-a[0])/(b[0]-a[0]),d=b[0]-a[0];
      const m0=(b[1]-previous[1])/(b[0]-previous[0]),m1=(next[1]-a[1])/(next[0]-a[0]);
      return (2*t**3-3*t*t+1)*a[1]+(t**3-2*t*t+t)*d*m0+(-2*t**3+3*t*t)*b[1]+(t**3-t*t)*d*m1;
    }
    const outlineDelta=source.map((v,i)=>{
      const p=relaxed[i];
      const mask=smooth(.025,.055,p.y)*(1-smooth(.335,.360,p.y))
        *smooth(.025,.045,p.y+hockDelta[i].y)
        *smooth(-.080,-.045,v.z)*(1-smooth(.165,.205,v.z))
        *smooth(.045,.075,v.y)*(1-smooth(.065,.110,p.z))
        *smooth(.010,.035,Math.abs(p.x));
      const ratio=curve(outline,p.y)/curve(widthSamples,p.y);
      return new Vector3(p.x*(ratio-1)*mask,0,0);
    });
    for(let i=0;i<count;i++){
      const id=ids[i],d=relaxed[id].clone().sub(original[id]).applyMatrix3(inverse[i]);
      d.toArray(corrections[0],i*3);
      hockDelta[id].clone().applyMatrix3(inverse[i]).toArray(corrections[1],i*3);
      outlineDelta[id].clone().applyMatrix3(inverse[i]).toArray(corrections[2],i*3);
    }
    report.push({vertices:count,welded:groups.length,profile,zMin,zMax,maxShoulderShift:Math.max(...relaxed.map((p,i)=>p.distanceTo(original[i]))),maxHockLowering:Math.max(...hockDelta.map(p=>-p.y))});
  }
  // Retain the established smooth shading; do not attach corrective normals
  // baked against Blender's different IK solution.
  for(const values of corrections)primitive.targets.push({POSITION:accessor(values)});
});
for(const mesh of json.meshes){mesh.extras.targetNames.push('SitSurface','SitHocks','SitOutline');mesh.weights.push(0,0,0);}
for(const node of json.nodes)if(node.weights)node.weights.push(0,0,0);
assert(json.animations.every(a=>a.channels.every(c=>c.target.path!=='weights')));
json.buffers[0].byteLength=length;
const encoded=Buffer.from(JSON.stringify(json)),jsonChunk=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(jsonChunk);
const binChunk=Buffer.concat(parts),padded=Buffer.alloc(Math.ceil(binChunk.length/4)*4);binChunk.copy(padded);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+padded.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(padded.length);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(output,Buffer.concat([header,jsonChunk,binHeader,padded]));
console.log(JSON.stringify(report));
