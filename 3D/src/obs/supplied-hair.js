import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// Trim only the two low outer nape corners. Interpolate the cut through cards
// rather than deleting entire triangles, keeping their texture coordinates.
export function trimSuppliedNape(source){
  const attrs=['position','normal','uv'],arrays=Object.fromEntries(attrs.map(a=>[a,[]]));
  const vertex=i=>Object.fromEntries(attrs.map(a=>{const attr=source.attributes[a];return[a,Array.from(attr.array.slice(i*attr.itemSize,(i+1)*attr.itemSize))];}));
  const signed=v=>{
    const [x,y]=v.position;
    const side=THREE.MathUtils.smoothstep(Math.abs(x+.11),.65,1.20);
    return y-(-.65+1.35*side);
  };
  const blend=(a,b,t)=>Object.fromEntries(attrs.map(k=>[k,a[k].map((n,i)=>THREE.MathUtils.lerp(n,b[k][i],t))]));
  const indices=source.index.array;
  for(let i=0;i<indices.length;i+=3){
    const triangle=[vertex(indices[i]),vertex(indices[i+1]),vertex(indices[i+2])],polygon=[];
    for(let j=0;j<3;j++){
      const a=triangle[j],b=triangle[(j+1)%3],da=signed(a),db=signed(b);
      if(da>=0)polygon.push(a);
      if((da>=0)!==(db>=0)){
        let lo=0,hi=1;
        for(let step=0;step<24;step++){
          const t=(lo+hi)/2;
          if((signed(blend(a,b,t))>=0)===(da>=0))lo=t;else hi=t;
        }
        polygon.push(blend(a,b,(lo+hi)/2));
      }
    }
    for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]])for(const k of attrs)arrays[k].push(...v[k]);
  }
  const expanded=new THREE.BufferGeometry();
  for(const k of attrs)expanded.setAttribute(k,new THREE.Float32BufferAttribute(arrays[k],k==='uv'?2:3));
  const result=mergeVertices(expanded,1e-6);expanded.dispose();result.normalizeNormals();return result;
}

export function fitSuppliedHair(geometry){
  const fitted=geometry.clone();
  fitted.scale(.190,.180,.180);
  fitted.translate(-.11,-2.20,.78);
  fitted.computeBoundingBox();fitted.computeBoundingSphere();
  return fitted;
}

// Preserve distance above the original skull, transferring its root surface to
// Milo's skull. A shared angular field keeps adjacent hair cards continuous.
export function hairFitField(source,target){
  const cols=96,rows=64,center=new THREE.Vector3(-.11,1.7,0),delta=new Float32Array(cols*(rows+1));
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const original=new THREE.Mesh(source,material),destination=new THREE.Mesh(target,material);
  const ray=new THREE.Raycaster(),direction=new THREE.Vector3();
  for(let row=0;row<=rows;row++)for(let col=0;col<cols;col++){
    const polar=row/rows*Math.PI,angle=col/cols*Math.PI*2;
    direction.set(Math.sin(polar)*Math.cos(angle),Math.cos(polar),Math.sin(polar)*Math.sin(angle));
    ray.set(center.clone().addScaledVector(direction,8),direction.clone().negate());
    const a=ray.intersectObject(original)[0],b=ray.intersectObject(destination)[0];
    delta[row*cols+col]=a&&b?THREE.MathUtils.clamp(a.distance-b.distance,-.65,.65):0;
  }
  material.dispose();
  return geometry=>{
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      direction.fromBufferAttribute(p,i).sub(center);const radius=direction.length();direction.normalize();
      const u=(Math.atan2(direction.z,direction.x)/(2*Math.PI)+1)%1*cols,v=Math.acos(THREE.MathUtils.clamp(direction.y,-1,1))/Math.PI*rows;
      const x=Math.floor(u),y=Math.min(rows-1,Math.floor(v)),tx=u-x,ty=v-y;
      const at=(r,c)=>delta[r*cols+c%cols];
      const d=THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(y,x),at(y,x+1),tx),THREE.MathUtils.lerp(at(y+1,x),at(y+1,x+1),tx),ty);
      direction.multiplyScalar(radius+d+.012).add(center);p.setXYZ(i,direction.x,direction.y,direction.z);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  };
}

export async function loadSuppliedHair(base){
  const textures=new THREE.TextureLoader(),geometries=new THREE.BufferGeometryLoader();
  const [hair,scalp,color,opacity,normal,scalpColor,scalpOpacity]=await Promise.all([
    geometries.loadAsync(base+'hair-solid.json'),geometries.loadAsync(base+'scalp.json'),
    textures.loadAsync(base+'hair-color-2k.png'),textures.loadAsync(base+'hair-opacity-2k.jpg'),
    textures.loadAsync(base+'hair-normal-2k.png'),textures.loadAsync(base+'scalp-color.jpg'),textures.loadAsync(base+'scalp-opacity.jpg'),
  ]);
  for(const texture of [color,scalpColor])texture.colorSpace=THREE.SRGBColorSpace;
  for(const texture of [color,opacity,normal,scalpColor,scalpOpacity])texture.anisotropy=8;
  const group=new THREE.Group();group.name='Supplied Jacob hairstyle';
  for(const [geometry,map,alphaMap,normalMap,name] of [
    [scalp,scalpColor,scalpOpacity,null,'Supplied scalp'],[hair,color,opacity,normal,'Supplied hair cards'],
  ]){
    // Keep broader locks filled while reducing micro-normal/specular noise.
    const material=new THREE.MeshStandardMaterial({map,alphaMap,normalMap,normalScale:new THREE.Vector2(.18,.18),roughness:.84,metalness:0,side:THREE.DoubleSide,alphaTest:normalMap ? .22 : .35,alphaToCoverage:true});
    const trimmed=trimSuppliedNape(geometry);geometry.dispose();
    trimmed.computeBoundingBox();trimmed.computeBoundingSphere();
    const mesh=new THREE.Mesh(trimmed,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
