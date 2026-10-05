import {AlwaysDepth,AlwaysStencilFunc,Color,DoubleSide,EqualStencilFunc,KeepStencilOp,Matrix4,Mesh,MeshBasicMaterial,NotEqualStencilFunc,PerspectiveCamera,Plane,PlaneGeometry,ReplaceStencilOp,Scene,ShaderMaterial,Vector2,Vector3,Vector4,ZeroStencilOp} from 'three';
import {createMirrorProjection} from '../../src/obs/cabin-mirror.js';
import {createMirrorBatchFilter} from '../../src/obs/mirror-batches.js';

const APERTURE=0x80,INK=1;

// Reflect the camera instead of cloning the ship/skin/skeleton. The improper
// (negative-determinant) view matrix is precisely the reflected world seen by
// the real camera. Unlike Reflector's texture projection, no resampling or tint
// is involved. The pass reverses front-face winding, NOT material normals.
export function createDirectMirrorCamera(){
  const camera=new PerspectiveCamera(),reflection=new Matrix4(),plane=new Plane();
  const normal=new Vector3(),origin=new Vector3(),clip=new Vector4(),q=new Vector4();
  camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;
  return {camera,update(mirror,source){
    normal.set(0,0,1).transformDirection(mirror.matrixWorld);origin.setFromMatrixPosition(mirror.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal,origin);
    const {x,y,z}=normal,d=plane.constant;
    reflection.set(1-2*x*x,-2*x*y,-2*x*z,-2*d*x,-2*y*x,1-2*y*y,-2*y*z,-2*d*y,-2*z*x,-2*z*y,1-2*z*z,-2*d*z,0,0,0,1);
    camera.matrixWorld.multiplyMatrices(reflection,source.matrixWorld);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();camera.position.setFromMatrixPosition(camera.matrixWorld);
    camera.near=source.near;camera.far=source.far;camera.layers.mask=source.layers.mask;
    camera.projectionMatrix.copy(source.projectionMatrix);
    // Oblique near plane rejects the real wall/back of the mirror. Applying
    // the same clipping to every material also covers custom ink/hair shaders.
    plane.applyMatrix4(camera.matrixWorldInverse);clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    q.set(Math.sign(clip.x),Math.sign(clip.y),1,1).applyMatrix4(source.projectionMatrixInverse);
    clip.multiplyScalar(2/clip.dot(q));
    const p=camera.projectionMatrix.elements;
    p[2]=clip.x-p[3];p[6]=clip.y-p[7];p[10]=clip.z-p[11]-.002;p[14]=clip.w-p[15];
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return camera;
  }};
}

// OBS currently uses bit 0 for filled characters vs expanded ink. Keep that
// test inside bit 7's mirror aperture; simply locking stencil would lose ink.
export function directMirrorStencil(material){
  if(material.stencilWrite&&material.stencilFunc===NotEqualStencilFunc&&material.stencilRef===INK)
    return {ref:APERTURE,mask:APERTURE|INK,writeMask:0,pass:KeepStencilOp};
  return {ref:APERTURE|(material.stencilWrite?material.stencilRef&INK:0),mask:APERTURE,
    writeMask:material.stencilWrite?material.stencilWriteMask&INK:0,pass:material.stencilWrite?material.stencilZPass:KeepStencilOp};
}

// Study-only early opaque pass. Restore physical mirror depth, then let the
// normal scene draw over it. This preserves foreground non-depth-writing dial
// decals, ink and transparent surfaces without a second foreground replay.
// No render targets, texture copies, reflected meshes or animation rigs.
export function createDirectMirror({room=null}={}){
  const geometry=new PlaneGeometry(.72,.89),material=new MeshBasicMaterial({colorWrite:false,depthWrite:true});
  const mirror=new Mesh(geometry,material);mirror.name='Study / direct mirror aperture';mirror.visible=false;
  mirror.renderOrder=-1000000;
  const rig=createDirectMirrorCamera(),filterCamera=new PerspectiveCamera(),crop=new Matrix4();
  const project=createMirrorProjection(),size=new Vector2(),scissor=new Vector4(),batches=createMirrorBatchFilter({room});
  const maskScene=new Scene(),maskMaterial=new MeshBasicMaterial({colorWrite:false,depthWrite:false,
    stencilWrite:true,stencilRef:APERTURE,stencilFunc:AlwaysStencilFunc,stencilZPass:ReplaceStencilOp});
  const mask=new Mesh(geometry,maskMaterial);mask.matrixAutoUpdate=false;mask.frustumCulled=false;maskScene.add(mask);maskScene.matrixWorldAutoUpdate=false;
  const clearScene=new Scene(),clearMaterial=new ShaderMaterial({depthFunc:AlwaysDepth,depthWrite:true,side:DoubleSide,toneMapped:false,
    stencilWrite:true,stencilRef:APERTURE,stencilFunc:EqualStencilFunc,stencilFuncMask:APERTURE,stencilWriteMask:0,
    uniforms:{background:{value:new Color()}},vertexShader:'void main(){gl_Position=vec4(position.xy,1.0,1.0);}',
    fragmentShader:'uniform vec3 background; void main(){gl_FragColor=vec4(background,1.0);\n#include <colorspace_fragment>\n}'});
  const clearQuad=new Mesh(new PlaneGeometry(2,2),clearMaterial);clearQuad.frustumCulled=false;clearScene.add(clearQuad);
  const stats=mirror.userData.mirrorQuality={direct:true,width:0,height:0,samples:0,frames:0,batches:batches.stats};
  mirror.renderReflection=(renderer,scene,camera)=>{
    if(!mirror.visible||renderer.xr.isPresenting)return false;
    renderer.getDrawingBufferSize(size);
    const rect=project(mirror,camera,size.x,size.y);if(!rect)return false;
    const reflected=rig.update(mirror,camera),gl=renderer.getContext(),state=renderer.state,stencil=state.buffers.stencil;
    const saved={autoClear:renderer.autoClear,background:scene.background,autoMatrix:scene.matrixWorldAutoUpdate,
      xr:renderer.xr.enabled,shadows:renderer.shadowMap.autoUpdate,scissorTest:renderer.getScissorTest(),setMaterial:state.setMaterial};
    renderer.getScissor(scissor);
    const ratio=renderer.getPixelRatio(),left=Math.floor((rect.left+1)*size.x/2),bottom=Math.floor((rect.bottom+1)*size.y/2);
    const right=Math.ceil((rect.right+1)*size.x/2),top=Math.ceil((rect.top+1)*size.y/2);
    stats.width=right-left;stats.height=top-bottom;
    // This capability query can flush the GPU queue. Do it once, never on the
    // hot path (the study renders to the same antialiased canvas throughout).
    if(stats.frames===0)stats.samples=gl.getParameter(gl.SAMPLES);
    const sx=2/(rect.right-rect.left),sy=2/(rect.top-rect.bottom);
    crop.set(sx,0,0,-(rect.right+rect.left)*sx/2,0,sy,0,-(rect.top+rect.bottom)*sy/2,0,0,1,0,0,0,0,1);
    filterCamera.copy(reflected,false);filterCamera.projectionMatrix.premultiply(crop);
    filterCamera.projectionMatrixInverse.copy(filterCamera.projectionMatrix).invert();
    try{
      renderer.autoClear=false;renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;
      scene.matrixWorldAutoUpdate=false;scene.background=null;mirror.visible=false;
      renderer.setScissor(left/ratio,bottom/ratio,(right-left)/ratio,(top-bottom)/ratio);renderer.setScissorTest(true);
      stencil.setMask(0xff);stencil.setClear(0);renderer.clear(false,false,true);
      // Restrict the reflected scene to the aperture. Foreground geometry is
      // rendered normally after this early pass (including depthWrite=false).
      mask.matrixWorld.copy(mirror.matrixWorld);
      renderer.render(maskScene,camera);
      // gl.clear ignores stencil: draw a far-depth quad instead, through only
      // the visible aperture. Foreground depth/colour outside it stay intact.
      if(saved.background?.isColor)clearMaterial.uniforms.background.value.copy(saved.background);
      else renderer.getClearColor(clearMaterial.uniforms.background.value);
      renderer.render(clearScene,camera);
      batches.begin(scene,filterCamera);
      state.setMaterial=function(surface,frontFaceCW){
        saved.setMaterial.call(this,surface,!frontFaceCW);
        const gate=directMirrorStencil(surface);
        stencil.setTest(true);stencil.setMask(gate.writeMask);
        stencil.setFunc(gl.EQUAL,gate.ref,gate.mask);stencil.setOp(gl.KEEP,gl.KEEP,gate.pass);
      };
      renderer.render(scene,reflected);stats.frames++;
      state.setMaterial=saved.setMaterial;
      // Restore physical depth and discard reflection-only ink bits. Otherwise
      // reflected silhouettes can suppress a foreground character's outline.
      maskMaterial.depthFunc=AlwaysDepth;maskMaterial.depthWrite=true;maskMaterial.stencilFunc=EqualStencilFunc;
      maskMaterial.stencilFuncMask=APERTURE;maskMaterial.stencilWriteMask=0xff;maskMaterial.stencilZPass=ZeroStencilOp;
      renderer.render(maskScene,camera);
      return true;
    }finally{
      state.setMaterial=saved.setMaterial;batches.end();mirror.visible=true;
      maskMaterial.depthFunc=material.depthFunc;maskMaterial.depthWrite=false;maskMaterial.stencilFunc=AlwaysStencilFunc;
      maskMaterial.stencilFuncMask=0xff;maskMaterial.stencilWriteMask=0xff;maskMaterial.stencilZPass=ReplaceStencilOp;
      stencil.setMask(0xff);stencil.setTest(false);
      renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadows;
      scene.background=saved.background;scene.matrixWorldAutoUpdate=saved.autoMatrix;
      renderer.setScissor(scissor);renderer.setScissorTest(saved.scissorTest);
    }
  };
  mirror.onBeforeRender=(renderer,scene,camera)=>mirror.renderReflection(renderer,scene,camera);
  mirror.dispose=()=>{batches.dispose();maskMaterial.dispose();clearMaterial.dispose();clearQuad.geometry.dispose();material.dispose();};
  return mirror;
}
