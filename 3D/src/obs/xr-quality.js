import {Box3,Vector3} from 'three';
import {CAT_PORT} from './layout.js';
import {createXRInstances,isWorldVisible} from './xr-instances.js';

export const XR_FRAMEBUFFER_SCALE=.6;
const isInk=mesh=>/^(Cabin|Milo|Lucy) toon outline$/.test(mesh.name);

// Apply only around the XR draw, after animation/toon updates. Restoring every
// value afterwards keeps live light/prop state and desktop rendering intact.
export class ObservationXRQuality {
  constructor(view){
    this.view=view;this.changes=[];this.lights=[];this.ink=[];this.staticMeshes=[];this.details=[];
    view.scene.updateMatrixWorld(true);
    view.scene.traverse(o=>{
      if(o.isPointLight||o.isSpotLight||o.isRectAreaLight)this.lights.push(o);
      if(isInk(o))this.ink.push(o);
    });
    view.ship?.staticMesh?.traverse(mesh=>{if(mesh.userData.xrWideGeometry)this.staticMeshes.push(mesh);});
    view.ship?.animated?.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isSkinnedMesh||isInk(mesh))return;
      mesh.geometry.computeBoundingBox();
      const size=mesh.geometry.boundingBox.getSize(new Vector3()).multiply(mesh.getWorldScale(new Vector3()));
      if(size.length()<.10)this.details.push(mesh);
    });
    this.batches=createXRInstances(view.ship?.animated,view.scene);
  }
  set(object,key,value){
    if(object[key]===value)return;
    this.changes.push([object,key,object[key]]);object[key]=value;
  }
  beginFrame(mode){
    this.endFrame();
    if(this.view.renderer.shadowMap)this.set(this.view.renderer.shadowMap,'enabled',false);
    for(const light of this.lights)this.set(light,'visible',false);
    const wide=mode==='all';
    for(const mesh of this.ink){
      // Only the selected character keeps its ink pass in VR.
      const keep=(mode==='milo'&&mesh.name==='Milo toon outline')||(mode==='cat'&&mesh.name==='Lucy toon outline');
      if(!keep)this.set(mesh,'visible',false);
    }
    if(wide){
      for(const mesh of this.staticMeshes){
        const geometry=mesh.userData.xrWideGeometry;
        if(geometry.attributes.position.count)this.set(mesh,'geometry',geometry);
        else this.set(mesh,'visible',false);
      }
      for(const mesh of this.details)this.set(mesh,'visible',false);
    }
    if(this.batches.length){
      this.view.scene.updateMatrixWorld(true);
      for(const {mesh,sources} of this.batches){
        let count=0;
        for(const source of sources){
          if(!isWorldVisible(source)||!source.layers.test(this.view.camera.layers))continue;
          mesh.setMatrixAt(count++,source.matrixWorld);
          // Unlike visible=false, a zero layer mask keeps any child droplets
          // or fittings traversable. Original layers return after the draw.
          this.set(source.layers,'mask',0);
        }
        mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
        this.set(mesh,'visible',count>0);
      }
    }
  }
  endFrame(){
    for(let i=this.changes.length-1;i>=0;i--){const [object,key,value]=this.changes[i];object[key]=value;}
    this.changes.length=0;
  }
  dispose(){this.endFrame();for(const {mesh} of this.batches){mesh.removeFromParent();mesh.dispose();}this.batches=[];}
}

// Controller hover never intersects the scan/fur triangles. Use conservative
// boxes from rigid surfaces and live bone positions; refresh once per poll for
// both hands. No GPU skinning readback or per-vertex CPU deformation is needed.
export class XRCharacterPicker {
  constructor(view){
    this.view=view;this.bounds=new Box3();this.point=new Vector3();this.scale=new Vector3();
    this.characters=[['milo',view.milo],['cat',view.cat],['droid',view.droidService?.actorRoot]]
      .filter(([,root])=>root).map(([id,root])=>({id,root,box:new Box3()}));
  }
  update(){
    for(const item of this.characters){
      item.box.makeEmpty();
      item.root.traverseVisible(mesh=>{
        if(!mesh.isMesh||isInk(mesh))return;
        const geometry=mesh.geometry;
        if(mesh.isSkinnedMesh&&mesh.skeleton){
          if(!geometry.boundingSphere)geometry.computeBoundingSphere();
          this.bounds.makeEmpty();
          for(const bone of mesh.skeleton.bones)this.bounds.expandByPoint(this.point.setFromMatrixPosition(bone.matrixWorld));
          const radius=geometry.boundingSphere.radius*mesh.getWorldScale(this.scale).length()/Math.sqrt(3)*.15;
          this.bounds.expandByScalar(radius);
        }else{
          if(!geometry.boundingBox)geometry.computeBoundingBox();
          this.bounds.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        }
        item.box.union(this.bounds);
      });
    }
  }
  pick(raycaster){
    let closest=null;
    for(const {id,box} of this.characters){
      if(box.isEmpty()||!raycaster.ray.intersectBox(box,this.point))continue;
      const distance=raycaster.ray.origin.distanceTo(this.point);
      if(distance<raycaster.near||distance>raycaster.far||(id==='cat'&&this.point.z<CAT_PORT.wallZ))continue;
      if(!closest||distance<closest.distance)closest={type:'character',id,distance,point:this.point.clone()};
    }
    if(closest)return closest;
    const hit=raycaster.intersectObjects(this.view.ship?.targets??[])[0];
    return hit?{type:'station',id:hit.object.userData.station,distance:hit.distance,point:hit.point}:null;
  }
}
