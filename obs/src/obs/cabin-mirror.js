import {Matrix4,PerspectiveCamera,PlaneGeometry,Vector2,Vector3,Vector4} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {createMirrorBatchFilter} from './mirror-batches.js';

export const MIRROR_BUDGET=Object.freeze({maxEdge:512,maxPixels:131072,samples:2});

// Only Milo's actual first-person camera pays for the extra scene render.
// Do not enable it for follow/overview cameras, Lucy, the droid or Quest.
export function isMiloMirrorView(characterCamera,xrPresenting=false){
  return !xrPresenting&&Boolean(characterCamera?.active&&characterCamera.selected==='milo');
}

export function mirrorTargetSize(width,height){
  const scale=Math.min(1,MIRROR_BUDGET.maxEdge/Math.max(width,height),Math.sqrt(MIRROR_BUDGET.maxPixels/(width*height)));
  // Stable allocation steps while approaching the mirror. Round down to keep
  // the pixel/edge budgets hard limits, even on Retina/large monitors.
  return {width:Math.max(32,Math.floor(width*scale/32)*32),height:Math.max(32,Math.floor(height*scale/32)*32)};
}

// Project the mirror, clipping its edges against the camera's near plane first.
// This also handles a partly offscreen mirror or an eye very close to its edge.
export function createMirrorProjection(){
  const matrix=new Matrix4(),normal=new Vector3(),eye=new Vector3(),origin=new Vector3(),crossing=new Vector4();
  const corners=Array.from({length:4},()=>new Vector4()),rect={left:0,right:0,bottom:0,top:0,width:0,height:0};
  return (mirror,camera,width,height)=>{
    normal.set(0,0,1).transformDirection(mirror.matrixWorld);
    origin.setFromMatrixPosition(mirror.matrixWorld);eye.setFromMatrixPosition(camera.matrixWorld).sub(origin);
    if(eye.dot(normal)<=0||width<=0||height<=0)return null;
    matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mirror.matrixWorld);
    const {width:w,height:h}=mirror.geometry.parameters;
    corners[0].set(-w/2,-h/2,0,1).applyMatrix4(matrix);corners[1].set(w/2,-h/2,0,1).applyMatrix4(matrix);
    corners[2].set(w/2,h/2,0,1).applyMatrix4(matrix);corners[3].set(-w/2,h/2,0,1).applyMatrix4(matrix);
    let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
    const include=p=>{if(p.w<=1e-6)return;left=Math.min(left,p.x/p.w);right=Math.max(right,p.x/p.w);bottom=Math.min(bottom,p.y/p.w);top=Math.max(top,p.y/p.w);};
    for(let i=0;i<4;i++){
      const a=corners[i],b=corners[(i+1)%4],da=a.z+a.w,db=b.z+b.w;
      if(da>=0)include(a);
      if((da<0)!==(db<0))include(crossing.copy(a).lerp(b,da/(da-db)));
    }
    if(right<=-1||left>=1||top<=-1||bottom>=1)return null;
    // Two screen pixels of guard space keep filtered edges inside the capture.
    rect.left=Math.max(-1,left-4/width);rect.right=Math.min(1,right+4/width);
    rect.bottom=Math.max(-1,bottom-4/height);rect.top=Math.min(1,top+4/height);
    rect.width=(rect.right-rect.left)*width/2;rect.height=(rect.top-rect.bottom)*height/2;
    return rect.width>=2&&rect.height>=2?rect:null;
  };
}

export function createCabinMirror({cullStatic=true,room=null}={}){
  const mirror=new Reflector(new PlaneGeometry(.72,.89),{color:0xa8b5b5,textureWidth:32,textureHeight:32,clipBias:.002,multisample:MIRROR_BUDGET.samples});
  mirror.name='POV laundry mirror';mirror.visible=false;
  const target=mirror.getRenderTarget();target.stencilBuffer=true;
  const reflect=mirror.onBeforeRender,project=createMirrorProjection(),size=new Vector2();
  const captureCamera=new PerspectiveCamera(),crop=new Matrix4();
  const stats=mirror.userData.mirrorQuality={width:32,height:32,samples:MIRROR_BUDGET.samples,frames:0};
  const batches=cullStatic?createMirrorBatchFilter({room}):null;
  if(batches)stats.batches=batches.stats;
  const dispose=mirror.dispose;
  mirror.dispose=()=>{batches?.dispose();dispose();};
  mirror.onBeforeRender=function(renderer,scene,camera){
    if(!mirror.visible||renderer.xr.isPresenting)return;
    renderer.getDrawingBufferSize(size);
    const rect=project(mirror,camera,size.x,size.y);if(!rect)return;
    const next=mirrorTargetSize(rect.width,rect.height);
    // Shrink only with headroom, avoiding reallocations on small head motions.
    if(next.width>target.width||next.height>target.height||next.width<target.width*.65||next.height<target.height*.65){
      target.setSize(next.width,next.height);stats.width=next.width;stats.height=next.height;
    }
    const samples=Math.min(MIRROR_BUDGET.samples,renderer.capabilities.maxSamples??0);
    if(target.samples!==samples){target.samples=samples;target.dispose();stats.samples=samples;}
    const sx=2/(rect.right-rect.left),sy=2/(rect.top-rect.bottom);
    crop.set(sx,0,0,-(rect.right+rect.left)*sx/2,0,sy,0,-(rect.top+rect.bottom)*sy/2,0,0,1,0,0,0,0,1);
    // Give Three's reflector a cropped source camera. Its existing oblique
    // clipping, reflected-camera transform and projective UVs stay consistent.
    // The real POV camera (including its self-head mask) is never modified.
    captureCamera.copy(camera,false);captureCamera.projectionMatrix.premultiply(crop);
    captureCamera.projectionMatrixInverse.copy(captureCamera.projectionMatrix).invert();
    const previous=renderer.getRenderTarget(),xr=renderer.xr.enabled,shadows=renderer.shadowMap.autoUpdate,beforeScene=scene.onBeforeRender,autoMatrix=scene.matrixWorldAutoUpdate;
    // Three has now reflected/cropped the camera when the nested scene hook
    // runs. Filter static batches for that exact frustum, not the POV camera.
    if(batches){
      scene.onBeforeRender=function(...args){beforeScene.apply(this,args);batches.begin(scene,args[2]);};
      // The outer render already updated every world matrix for this frame.
      scene.matrixWorldAutoUpdate=false;
    }
    try{reflect.call(mirror,renderer,scene,captureCamera);stats.frames++;}
    finally{batches?.end();scene.onBeforeRender=beforeScene;scene.matrixWorldAutoUpdate=autoMatrix;mirror.visible=true;renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadows;renderer.setRenderTarget(previous);}
  };
  return mirror;
}
