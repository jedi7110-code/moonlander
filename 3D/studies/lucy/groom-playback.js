import {Matrix3,Matrix4,Vector3} from 'three';
import {animateLucy} from '../../src/obs/lucy.js';

// Bake only the skin correction, not the animation. The head, blink, whiskers,
// paws and skeleton still use the live pose on every rendered frame.
export async function prepareGroomPlayback(root,surface,{fps=30,yieldFrame=async()=>{},onProgress=()=>{}}={}){
  const source=surface.source,a=source.geometry.attributes;
  const duration=root.userData.actions.Groom.getClip().duration,steps=Math.ceil(duration*fps);
  const indices=[],frames=[],skin=new Matrix4(),bone=new Matrix4(),inverse=new Matrix4(),normalInverse=new Matrix3();
  const before=new Vector3(),after=new Vector3(),originalNormal=new Vector3(),delta=new Vector3();
  function sample(time){animateLucy(root,{dt:1/fps,time:2*duration+time,actionTime:2*duration+time,mode:'groom',remaining:100,yaw:0});surface.update();}
  // Positional masks can be zero at some poses. Determine the complete local
  // neighborhood from the solver's authored masks instead of the current lift.
  for(let i=0;i<a.position.count;i++)if(surface.correctionMask[i]>0)indices.push(i);
  const morphNormal=source.geometry.morphAttributes.normal??[];
  for(let frame=0;frame<=steps;frame++){
    sample(frame===steps?0:frame*duration/steps);
    const values=new Float32Array(indices.length*6);
    for(let k=0;k<indices.length;k++){
      const i=indices[k];skin.elements.fill(0);
      for(let j=0;j<4;j++){
        const n=a.skinIndex.getComponent(i,j),w=a.skinWeight.getComponent(i,j);
        bone.multiplyMatrices(source.skeleton.bones[n].matrixWorld,source.skeleton.boneInverses[n]);
        for(let c=0;c<16;c++)skin.elements[c]+=bone.elements[c]*w;
      }
      skin.premultiply(source.bindMatrixInverse).multiply(source.bindMatrix);
      inverse.copy(skin).invert();normalInverse.setFromMatrix4(skin).invert();
      source.getVertexPosition(i,before).applyMatrix4(inverse);
      after.fromBufferAttribute(surface.display.geometry.attributes.position,i).applyMatrix4(inverse).sub(before);
      originalNormal.fromBufferAttribute(a.normal,i);
      for(let j=0;j<morphNormal.length;j++)if(source.morphTargetInfluences[j])
        originalNormal.addScaledVector(delta.fromBufferAttribute(morphNormal[j],i),source.morphTargetInfluences[j]);
      delta.fromBufferAttribute(surface.display.geometry.attributes.normal,i).applyMatrix3(normalInverse).normalize()
        .sub(originalNormal.normalize());
      values.set([after.x,after.y,after.z,delta.x,delta.y,delta.z],k*6);
    }
    frames.push(values);onProgress((frame+1)/(steps+1));
    if(frame%3===0)await yieldFrame();
  }
  // Identical endpoints make reverse scrubbing and the wrap deterministic.
  frames[steps]=frames[0];surface.update(false);root.userData.initialized=false;
  return createGroomPlayback(surface,{duration,steps,indices:new Int32Array(indices),frames});
}

export function createGroomPlayback(surface,cache){
  const {source,display}=surface,a=source.geometry.attributes,count=a.position.count;
  const positions=display.geometry.attributes.position,normals=display.geometry.attributes.normal;
  const lookup=new Int32Array(count).fill(-1);cache.indices.forEach((vertex,k)=>lookup[vertex]=k*6);
  const matrices=source.skeleton.bones.map(()=>new Matrix4()),bone=new Matrix4();
  const morphPositions=source.geometry.morphAttributes.position??[],morphNormals=source.geometry.morphAttributes.normal??[];
  function update(enabled,time=0,{weight=enabled?1:0}={}){
    weight=enabled?Math.max(0,Math.min(1,weight)):0;
    source.visible=weight<1e-5;display.visible=!source.visible;
    if(!display.visible)return;
    display.position.copy(source.position);display.quaternion.copy(source.quaternion);display.scale.copy(source.scale);
    const phase=((time%cache.duration)+cache.duration)%cache.duration/cache.duration*cache.steps;
    const frame=Math.floor(phase),blend=phase-frame,left=cache.frames[frame],right=cache.frames[frame+1];
    for(let j=0;j<matrices.length;j++){
      bone.multiplyMatrices(source.skeleton.bones[j].matrixWorld,source.skeleton.boneInverses[j]);
      matrices[j].copy(source.bindMatrixInverse).multiply(bone).multiply(source.bindMatrix);
    }
    const active=source.morphTargetInfluences.map((w,k)=>({w,p:morphPositions[k]?.array,n:morphNormals[k]?.array})).filter(m=>m.w);
    const p=a.position.array,n=a.normal.array,si=a.skinIndex.array,sw=a.skinWeight.array;
    for(let i=0;i<count;i++){
      const offset=i*3;let x=p[offset],y=p[offset+1],z=p[offset+2],nx=n[offset],ny=n[offset+1],nz=n[offset+2];
      for(const m of active){
        if(m.p){x+=m.p[offset]*m.w;y+=m.p[offset+1]*m.w;z+=m.p[offset+2]*m.w;}
        if(m.n){nx+=m.n[offset]*m.w;ny+=m.n[offset+1]*m.w;nz+=m.n[offset+2]*m.w;}
      }
      const k=lookup[i];
      if(k>=0){
        x+=(left[k]+(right[k]-left[k])*blend)*weight;
        y+=(left[k+1]+(right[k+1]-left[k+1])*blend)*weight;
        z+=(left[k+2]+(right[k+2]-left[k+2])*blend)*weight;
        const length=Math.hypot(nx,ny,nz);nx/=length;ny/=length;nz/=length;
        nx+=(left[k+3]+(right[k+3]-left[k+3])*blend)*weight;
        ny+=(left[k+4]+(right[k+4]-left[k+4])*blend)*weight;
        nz+=(left[k+5]+(right[k+5]-left[k+5])*blend)*weight;
      }
      let px=0,py=0,pz=0,ox=0,oy=0,oz=0;
      for(let j=0;j<4;j++){
        const w=sw[i*4+j];if(!w)continue;const m=matrices[si[i*4+j]].elements;
        px+=w*(m[0]*x+m[4]*y+m[8]*z+m[12]);py+=w*(m[1]*x+m[5]*y+m[9]*z+m[13]);pz+=w*(m[2]*x+m[6]*y+m[10]*z+m[14]);
        ox+=w*(m[0]*nx+m[4]*ny+m[8]*nz);oy+=w*(m[1]*nx+m[5]*ny+m[9]*nz);oz+=w*(m[2]*nx+m[6]*ny+m[10]*nz);
      }
      const length=Math.hypot(ox,oy,oz);positions.setXYZ(i,px,py,pz);normals.setXYZ(i,ox/length,oy/length,oz/length);
    }
    positions.needsUpdate=true;normals.needsUpdate=true;
  }
  return {update,cache};
}
