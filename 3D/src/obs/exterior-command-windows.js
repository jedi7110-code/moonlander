import * as THREE from 'three';

const cross=(start,end,point)=>(end[0]-start[0])*(point[1]-start[1])-(end[1]-start[1])*(point[0]-start[0]);

function insetPolygon(polygon,distance){
  return polygon.map((point,index)=>{
    const previous=polygon[(index+polygon.length-1)%polygon.length],next=polygon[(index+1)%polygon.length];
    const before=new THREE.Vector2(previous[1]-point[1],point[0]-previous[0]).normalize();
    const after=new THREE.Vector2(point[1]-next[1],next[0]-point[0]).normalize();
    const offset=before.clone().add(after).multiplyScalar(distance/(1+before.dot(after)));
    return [point[0]+offset.x,point[1]+offset.y];
  });
}

function outline(Type,points){
  const shape=new Type();
  points.forEach((point,index)=>index?shape.lineTo(...point):shape.moveTo(...point));shape.closePath();
  return shape;
}

function cutAperture(skin,window,opening){
  skin.updateWorldMatrix(true,false);window.updateWorldMatrix(true,false);
  const transform=window.matrixWorld.clone().invert().multiply(skin.matrixWorld);
  const source=skin.geometry,attributes=Object.entries(source.attributes),indices=source.index;
  const count=indices?.count??source.attributes.position.count,output=Object.fromEntries(attributes.map(([name])=>[name,[]]));
  const append=polygon=>{
    for(let corner=1;corner<polygon.length-1;corner++)for(const vertex of [polygon[0],polygon[corner],polygon[corner+1]]){
      for(const [name]of attributes)output[name].push(...vertex.values[name]);
    }
  };
  for(let offset=0;offset<count;offset+=3){
    const triangle=[0,1,2].map(corner=>{
      const index=indices?indices.getX(offset+corner):offset+corner;
      const values=Object.fromEntries(attributes.map(([name,attribute])=>[name,Array.from({length:attribute.itemSize},(_,component)=>attribute.array[index*attribute.itemSize+component])]));
      return {values,point:new THREE.Vector3(...values.position).applyMatrix4(transform)};
    });
    if(triangle.some(vertex=>Math.abs(vertex.point.z)>1e-4)){append(triangle);continue;}
    let inside=triangle;
    for(let edge=0;edge<opening.length&&inside.length;edge++){
      const start=opening[edge],end=opening[(edge+1)%opening.length],kept=[],outside=[];
      for(let index=0;index<inside.length;index++){
        const current=inside[index],next=inside[(index+1)%inside.length];
        const from=cross(start,end,[current.point.x,current.point.y]),to=cross(start,end,[next.point.x,next.point.y]);
        (from>=0?kept:outside).push(current);
        if((from>=0)!==(to>=0)){
          const fraction=from/(from-to),intersection={point:current.point.clone().lerp(next.point,fraction),values:{}};
          for(const [name]of attributes)intersection.values[name]=current.values[name].map((value,component)=>THREE.MathUtils.lerp(value,next.values[name][component],fraction));
          kept.push(intersection);outside.push(intersection);
        }
      }
      append(outside);inside=kept;
    }
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute]of attributes)geometry.setAttribute(name,new THREE.Float32BufferAttribute(output[name],attribute.itemSize,attribute.normalized));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();skin.geometry=geometry;source.dispose();
}

export function addCommandSideWindows(parent,{skin,hull,sections,materials,addMesh}){
  parent.updateWorldMatrix(true,true);
  const inverse=parent.matrixWorld.clone().invert(),windows=[];
  const rear=sections[sections.length-2],front=sections[sections.length-1];
  const exposedBottom=(section,side)=>{
    const [axial,bottom,top,width,cut]=section;
    const origin=parent.localToWorld(new THREE.Vector3(axial,top+5,side*width));
    const direction=new THREE.Vector3(0,-1,0).transformDirection(parent.matrixWorld);
    const hit=new THREE.Raycaster(origin,direction).intersectObject(hull,false)[0];
    return Math.max(bottom+cut,hit?hit.point.clone().applyMatrix4(inverse).y+.04:bottom+cut);
  };
  for(const side of [-1,1])for(const face of ['chamfer','side']){
    const corners=[rear,front].flatMap(section=>{
      const [axial,,top,width,cut]=section;
      return face==='chamfer'?[new THREE.Vector3(axial,top,side*(width-cut)),new THREE.Vector3(axial,top-cut,side*width)]:
        [new THREE.Vector3(axial,top-cut,side*width),new THREE.Vector3(axial,exposedBottom(section,side),side*width)];
    });
    const normal=corners[1].clone().sub(corners[0]).cross(corners[2].clone().sub(corners[0])).normalize();
    if(normal.z*side<0)normal.negate();
    const horizontal=new THREE.Vector3(side,0,0).addScaledVector(normal,-side*normal.x).normalize();
    const vertical=new THREE.Vector3().crossVectors(normal,horizontal);
    const center=corners.reduce((total,point)=>total.add(point),new THREE.Vector3()).multiplyScalar(.25);
    const polygon=corners.map(point=>{const relative=point.clone().sub(center);return [relative.dot(horizontal),relative.dot(vertical)];});
    polygon.sort((first,second)=>Math.atan2(first[1],first[0])-Math.atan2(second[1],second[0]));
    const outer=insetPolygon(polygon,.08),opening=insetPolygon(outer,.065);
    const window=new THREE.Group();window.name=`Command ${face} pressure window / ${side>0?'starboard':'port'}`;
    window.position.copy(center);window.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(horizontal,vertical,normal));parent.add(window);
    window.userData.commandWindow={face,side,outer,opening};windows.push(window);
    cutAperture(skin,window,opening);
    const rim=outline(THREE.Shape,outer);rim.holes.push(outline(THREE.Path,opening));
    const frame=new THREE.ExtrudeGeometry(rim,{depth:.07,bevelEnabled:false,curveSegments:1});frame.translate(0,0,-.014);
    addMesh(window,frame,materials.steel,'Command side pressure rim');
    const seal=outline(THREE.Shape,insetPolygon(outer,.059));seal.holes.push(outline(THREE.Path,insetPolygon(outer,.076)));
    addMesh(window,new THREE.ShapeGeometry(seal),materials.dark,'Command side glazing seal',[0,0,.024]);
    const glass=new THREE.ExtrudeGeometry(outline(THREE.Shape,insetPolygon(outer,.064)),{depth:.012,bevelEnabled:false,curveSegments:1});
    addMesh(window,glass,materials.glass,'Command side recessed pressure glass',[0,0,.010]);
  }
  return windows;
}
