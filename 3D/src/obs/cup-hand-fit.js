import {MathUtils} from 'three';
import {createGripHandGeometry} from './tablet-pose.js';

// Fit the imported fingers to their controllers before closing around the
// small handle. Blend in while reaching, so the idle hand never changes shape
// abruptly. The meal grip fits both hands; the cup still affects its side only.
export const setCupHandFit=(root,weight)=>setHandFit(root,weight,1);
export const setMealHandFit=(root,weight)=>setHandFit(root,weight,0);
function setHandFit(root,weight,side){
  const skin=root.userData.bodySkin;if(!skin)return;
  let cache=root.userData.diningHandFit;
  if(!cache&&weight>0)cache=root.userData.diningHandFit={original:skin.geometry,variants:{}};
  if(!cache)return;
  if(weight===0){skin.geometry=cache.original;return;}
  let fit=cache.variants[side];
  if(!fit){
    skin.geometry=cache.original;
    const original=cache.original,target=createGripHandGeometry(skin,side),geometry=original.clone(),vertices=[];
    const a=original.attributes,b=target.attributes;
    for(let i=0;i<a.position.count;i++){
      if(a.armRegion.getX(i)<.95||a.position.getY(i)>.934||(side&&a.position.getX(i)*side<0))continue;
      const influences=new Map();
      for(let k=0;k<4;k++){
        const old=a.skinIndex.array[i*4+k],next=b.skinIndex.array[i*4+k];
        if(!influences.has(old))influences.set(old,[0,0]);
        if(!influences.has(next))influences.set(next,[0,0]);
        influences.get(old)[0]+=a.skinWeight.array[i*4+k];
        influences.get(next)[1]+=b.skinWeight.array[i*4+k];
      }
      vertices.push({i,influences:[...influences].map(([id,[a,b]])=>({id,a,b,w:0}))});
    }
    fit=cache.variants[side]={original,target,geometry,vertices,weight:-1};
  }
  if(!fit)return;
  skin.geometry=weight>0?fit.geometry:fit.original;
  if(weight===0||weight===fit.weight)return;
  const a=fit.original.attributes,b=fit.target.attributes,out=fit.geometry.attributes;
  for(const {i,influences}of fit.vertices){
    for(let k=0;k<3;k++){
      const n=i*3+k;out.position.array[n]=MathUtils.lerp(a.position.array[n],b.position.array[n],weight);
      // The wrist normals are pre-baked for the distributed palm twist. Keep
      // those corrected normals; raw bind-space normals create a false ridge.
      const normalBlend=weight*(1-MathUtils.smoothstep(a.position.getY(i),.86,.91));
      out.normal.array[n]=MathUtils.lerp(a.normal.array[n],b.normal.array[n],normalBlend);
    }
    for(const p of influences)p.w=MathUtils.lerp(p.a,p.b,weight);
    influences.sort((a,b)=>b.w-a.w||a.id-b.id);const sum=influences.slice(0,4).reduce((s,p)=>s+p.w,0);
    for(let k=0;k<4;k++){out.skinIndex.array[i*4+k]=influences[k]?.id??0;out.skinWeight.array[i*4+k]=(influences[k]?.w??0)/sum;}
  }
  for(const name of ['position','normal','skinIndex','skinWeight'])out[name].needsUpdate=true;
  fit.geometry.boundingBox=null;fit.geometry.boundingSphere=null;fit.weight=weight;
}
