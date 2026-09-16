import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AnimationMixer,Vector3} from 'three';
import {BVHLoader} from 'three/addons/loaders/BVHLoader.js';

const input=process.argv[2];
if(!input)throw new Error('Usage: node studies/milo/build-walk.mjs <source.bvh>');
const text=await readFile(input,'utf8'),{clip,skeleton}=new BVHLoader().parse(text);
const root=skeleton.bones[0],mixer=new AnimationMixer(root);mixer.clipAction(clip).play();
const bones=skeleton.bones.filter(b=>b.name!=='ENDSITE'),names=bones.map(b=>b.name);
const start=26.56,end=27.68,count=68,duration=end-start;
function positions(t){mixer.setTime(t);root.updateMatrixWorld(true);return bones.map(b=>b.getWorldPosition(new Vector3()));}
const first=positions(start),last=positions(end),travel=last[0].clone().sub(first[0]);travel.z=0;
const forward=travel.clone().normalize(),right=new Vector3(forward.y,-forward.x,0);
const scale=.860/(bones.find(b=>b.name==='RightLeg').position.length()+bones.find(b=>b.name==='RightFoot').position.length());
function local(points,u){
  const origin=first[0].clone().addScaledVector(travel,u);origin.z=0;
  return points.map(p=>{const d=p.clone().sub(origin);return new Vector3(d.dot(right),d.z,d.dot(forward)).multiplyScalar(scale);});
}
const a=local(first,0),b=local(last,1),frames=[];
for(let i=0;i<count;i++){
  const u=i/count,p=local(positions(start+u*duration),u);
  // Remove the small cycle-end residual, then use periodic interpolation at playback.
  frames.push(p.flatMap((v,j)=>v.addScaledVector(b[j].clone().sub(a[j]),-u).toArray().map(n=>Number(n.toFixed(6)))));
}
function lowHeight(suffix){
  const values=frames.flatMap(frame=>['Left','Right'].map(side=>frame[names.indexOf(side+suffix)*3+1])).sort((a,b)=>a-b);
  return values[Math.floor(values.length*.08)];
}
const data={version:1,source:'Walk_Card_noStops_Take001.bvh',sha256:createHash('sha256').update(text).digest('hex'),start,end,duration,count,sourceFrameRate:150,cycleDistance:travel.length()*scale,names,ankleHeight:lowHeight('Foot'),toeHeight:lowHeight('ToeBase'),frames};
await writeFile(new URL('../../src/obs/milo-walk-cycle.json',import.meta.url),JSON.stringify(data)+'\n');
console.log(`Exported ${count} samples, ${duration.toFixed(2)} s, ${data.cycleDistance.toFixed(2)} m per cycle`);
