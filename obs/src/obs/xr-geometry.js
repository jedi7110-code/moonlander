import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Vector3} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Only the distant, static cabin uses this geometry. Sample existing vertices
// so authored bends, UVs and normals survive; never decimate rigs or scan meshes.
export function makeXRWideGeometry(source){
  if(source instanceof RoundedBoxGeometry){
    source.computeBoundingBox();
    const size=source.boundingBox.getSize(new Vector3()),center=source.boundingBox.getCenter(new Vector3());
    return new BoxGeometry(size.x,size.y,size.z).translate(center.x,center.y,center.z);
  }
  const p=source.parameters??{};
  let columns,rows,columnLimit,rowLimit,reverse=false;
  if(source.type==='SphereGeometry'){
    columns=p.widthSegments;rows=p.heightSegments;columnLimit=12;rowLimit=8;
  }else if(source.type==='TubeGeometry'){
    columns=p.radialSegments;rows=p.tubularSegments;columnLimit=4;rowLimit=24;
  }else if(source.type==='TorusGeometry'){
    columns=p.tubularSegments;rows=p.radialSegments;columnLimit=16;rowLimit=6;reverse=true;
  }else return source.clone();
  if(!source.index||source.attributes.position.count!==(columns+1)*(rows+1)||Object.keys(source.morphAttributes).length)return source.clone();
  const steps=(n,limit)=>Array.from({length:Math.min(n,limit)+1},(_,i)=>Math.round(i*n/Math.min(n,limit)));
  const xs=steps(columns,columnLimit),ys=steps(rows,rowLimit),geometry=new BufferGeometry(),indices=[];
  for(const [name,attribute] of Object.entries(source.attributes)){
    const values=[];
    for(const y of ys)for(const x of xs)for(let c=0;c<attribute.itemSize;c++)values.push(attribute.array[(y*(columns+1)+x)*attribute.itemSize+c]);
    geometry.setAttribute(name,new Float32BufferAttribute(values,attribute.itemSize,attribute.normalized));
  }
  for(let y=0;y<ys.length-1;y++)for(let x=0;x<xs.length-1;x++){
    const a=y*xs.length+x,b=(y+1)*xs.length+x,c=b+1,d=a+1;
    // Match the winding of each Three.js parametric surface.
    if(reverse)indices.push(b,a,c,a,d,c);else indices.push(a,b,d,b,c,d);
  }
  geometry.setIndex(indices);return geometry;
}
