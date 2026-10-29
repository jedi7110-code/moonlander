import * as THREE from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Equipment-specific original wording, informed by aircraft service stencils.
// One atlas per craft set; geometry is projected onto the actual opaque surface.
export const EXTERIOR_MARKINGS=Object.freeze({
  exhaust:['DANGER','THRUSTER EXHAUST','KEEP CLEAR','danger'],
  rcs:['DANGER','RCS OUTLET','KEEP CLEAR','danger'],
  pressure:['CAUTION','DEPRESSURIZE','BEFORE OPENING','caution'],
  service:['ACCESS','POWER OFF','BEFORE SERVICE','service'],
  blanket:['NO STEP','THERMAL BLANKET','DO NOT LOAD','caution'],
  tank:['CAUTION','PRESSURIZED GAS','SERVICE ONLY','caution'],
  rotate:['WARNING','ROTATING ASSEMBLY','KEEP CLEAR','danger'],
  sensor:['CAUTION','VIEWPORT','KEEP CLEAR','caution'],
  dock:['CAUTION','DOCKING LATCH','KEEP CLEAR','caution'],
  connector:['SERVICE','GAS / POWER','ISOLATE FIRST','service'],
  electrical:['WARNING','ISOLATE POWER','BEFORE OPENING','danger'],
});
// Local model metres: enough depth separation without a visibly floating label.
export const EXTERIOR_DECAL_CLEARANCE=.003;
export function createExteriorDecals(){
  const keys=Object.keys(EXTERIOR_MARKINGS),columns=4,cellW=512,cellH=192;
  let texture=null;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=columns*cellW;canvas.height=Math.ceil(keys.length/columns)*cellH;
    const c=canvas.getContext('2d');
    for(const [index,key]of keys.entries()){
      const [heading,line1,line2,kind]=EXTERIOR_MARKINGS[key],x=index%columns*cellW,y=Math.floor(index/columns)*cellH;
      const accent=kind==='danger'?'#8c332c':kind==='caution'?'#c2a450':'#d4d0ba';
      c.fillStyle=accent;c.fillRect(x+10,y+10,492,56);c.strokeStyle='#353a35';c.lineWidth=3;c.strokeRect(x+10,y+10,492,172);
      c.fillStyle=kind==='danger'?'#e8e1c9':'#242d2d';c.font='bold 43px monospace';c.textBaseline='middle';c.textAlign='center';c.fillText(heading,x+256,y+39,470);
      c.fillStyle='#d9d5bd';c.fillRect(x+12,y+69,488,110);c.fillStyle='#303932';c.font='bold 35px monospace';c.fillText(line1,x+256,y+104,460);c.font='bold 28px monospace';c.fillText(line2,x+256,y+151,460);
    }
    texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.name='Exterior equipment warnings atlas';
  }
  const material=new THREE.MeshStandardMaterial({map:texture,color:texture?0xffffff:0xc2a450,transparent:true,roughness:.92,metalness:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  material.name='Printed equipment warning ink';
  const batches=new Map();
  function add(parent,key,position,normal,width,height,{up=null}={}){
    if(!EXTERIOR_MARKINGS[key])throw new Error(`Unknown marking ${key}`);
    parent.updateWorldMatrix(true,true);
    const localNormal=new THREE.Vector3(...normal).normalize(),worldNormal=localNormal.clone().transformDirection(parent.matrixWorld);
    const point=parent.localToWorld(new THREE.Vector3(...position));
    const meshes=[];parent.traverseVisible(object=>{if(object.isMesh&&!object.isInstancedMesh&&!object.userData.exteriorDecal&&!Array.isArray(object.material)&&!object.material.transparent)meshes.push(object);});
    const ray=new THREE.Raycaster(point.clone().addScaledVector(worldNormal,.7),worldNormal.clone().negate(),0,1.4);
    const hit=ray.intersectObjects(meshes,false).find(hit=>hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(worldNormal)>.6);
    if(!hit)return false;
    const actualNormal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const orientation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),actualNormal));
    if(up){
      const projectorUp=new THREE.Vector3(...up).transformDirection(parent.matrixWorld).projectOnPlane(actualNormal).normalize();
      const projectorRight=new THREE.Vector3().crossVectors(projectorUp,actualNormal).normalize();
      projectorUp.crossVectors(actualNormal,projectorRight).normalize();
      orientation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(projectorRight,projectorUp,actualNormal));
    }
    const scale=parent.getWorldScale(new THREE.Vector3()),size=new THREE.Vector3(width*scale.x,height*scale.y,.035*Math.max(scale.x,scale.y,scale.z));
    const geometry=new DecalGeometry(hit.object,hit.point,orientation,size);
    if(!geometry.attributes.position.count){geometry.dispose();return false;}
    geometry.applyMatrix4(parent.matrixWorld.clone().invert());
    // Offset each clipped face along its geometric normal, including on sloped
    // panels. Polygon offset alone leaves coplanar geometry depth-dependent.
    const vertices=geometry.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),faceNormal=new THREE.Vector3();
    for(let i=0;i<vertices.count;i+=3){
      a.fromBufferAttribute(vertices,i);b.fromBufferAttribute(vertices,i+1);c.fromBufferAttribute(vertices,i+2);
      faceNormal.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
      for(let j=0;j<3;j++){
        const vertex=new THREE.Vector3().fromBufferAttribute(vertices,i+j).addScaledVector(faceNormal,EXTERIOR_DECAL_CLEARANCE);
        vertices.setXYZ(i+j,vertex.x,vertex.y,vertex.z);
      }
    }
    const index=keys.indexOf(key),rows=Math.ceil(keys.length/columns),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(index%columns+uv.getX(i))/columns,(rows-1-Math.floor(index/columns)+uv.getY(i))/rows);
    if(!batches.has(parent))batches.set(parent,{geometries:[],entries:[]});
    const batch=batches.get(parent),vertexStart=batch.geometries.reduce((sum,item)=>sum+item.attributes.position.count,0);
    batch.geometries.push(geometry);batch.entries.push({key,point:parent.worldToLocal(hit.point.clone()).toArray(),normal:localNormal.toArray(),width,height,vertexStart,vertexCount:vertices.count});return true;
  }
  function flush(){
    for(const [parent,{geometries,entries}]of batches){
      const geometry=mergeGeometries(geometries,false);geometries.forEach(geometry=>geometry.dispose());
      const mesh=new THREE.Mesh(geometry,material);mesh.name='Surface warning decals';mesh.userData.exteriorDecal=true;mesh.userData.markings=entries;mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);
    }batches.clear();
  }
  return{add,flush};
}
