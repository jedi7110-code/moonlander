import {createXRInstances,isWorldVisible} from './xr-instances.js';

// Repeated animated fittings (rack hardware, leaves, gym and capsule parts)
// render through one instanced draw each, on the desktop as well as in XR.
// Sources keep their transforms, picking and visibility; only the main and
// shadow draws are shared, with matrices refreshed right before each render.
export class FixtureInstances {
  constructor(root,scene){
    this.scene=scene;this.changes=[];this.enabled=true;
    this.batches=createXRInstances(root,scene,{shadows:true,name:'Repeated fixture instances'});
    // Stay visible so the startup compile covers the instanced programs, but
    // draw nothing until a frame has copied matrices in.
    for(const {mesh} of this.batches){mesh.visible=true;mesh.count=0;}
  }
  get instancedMeshes(){return this.batches.reduce((count,{sources})=>count+sources.length,0);}
  set(object,key,value){
    if(object[key]===value)return;
    this.changes.push([object,key,object[key]]);object[key]=value;
  }
  // World matrices must be current (renderScene updates them first).
  beginFrame(camera){
    this.endFrame();
    if(!this.enabled){for(const {mesh} of this.batches)this.set(mesh,'visible',false);return;}
    for(const {mesh,sources,geometries} of this.batches){
      // Style swaps replace materials and shadow proxies hand caster flags back
      // per source. The batch follows its first visible source; any source
      // that differs from it this frame keeps its own draw.
      let lead=null,count=0;
      for(const [i,source] of sources.entries()){
        if(source.geometry!==geometries[i]||source.receiveShadow!==mesh.receiveShadow||source.renderOrder!==mesh.renderOrder||source.layers.mask!==mesh.layers.mask)continue;
        if(!isWorldVisible(source)||!source.layers.test(camera.layers))continue;
        if(!lead){lead=source;if(mesh.material!==source.material)mesh.material=source.material;mesh.castShadow=source.castShadow;}
        else if(source.material!==lead.material||source.castShadow!==lead.castShadow)continue;
        mesh.setMatrixAt(count++,source.matrixWorld);
        // A zero layer mask hides the source from every pass while leaving its
        // children traversable. Original layers return after the draw.
        this.set(source.layers,'mask',0);
      }
      mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
      this.set(mesh,'visible',count>0);
    }
  }
  endFrame(){
    for(let i=this.changes.length-1;i>=0;i--){const [object,key,value]=this.changes[i];object[key]=value;}
    this.changes.length=0;
  }
  dispose(){this.endFrame();for(const {mesh} of this.batches){mesh.removeFromParent();mesh.dispose();}this.batches=[];}
}
