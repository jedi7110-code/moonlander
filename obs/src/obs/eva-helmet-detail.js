import * as THREE from 'three';
import {box,cylinder,pipe} from './materials.js';

export const HELMET_WINDOW={bottom:-.71,top:.48,angle:1.04};
export function windowSpan(v,angle){
  const corner=Math.max(0,1-Math.min(v,1-v)/.13);
  // A short diagonal cheek shoulder steps the lower glass inward. These two
  // knots align with the glass, frame and retention-rail sampling grids.
  const cheek=v<=.25?.80:v<.375?THREE.MathUtils.lerp(.80,1,(v-.25)/.125):1;
  return angle*cheek*(1-(v<.5?.05:.18)*corner*corner);
}
const browDrop=longitude=>.20*(longitude/1.04)**2;
export function windowPoint(point,u,v,spec){
  const longitude=(u*2-1)*windowSpan(v,spec.angle);
  const latitude=THREE.MathUtils.lerp(spec.bottom,spec.top,v)-browDrop(longitude)*THREE.MathUtils.smoothstep(v,.35,1);
  return point(latitude,longitude,spec.offset);
}
export function windowContains(latitude,longitude,margin=0){
  const bottom=HELMET_WINDOW.bottom-margin,top=HELMET_WINDOW.top+margin;
  if(latitude<bottom||latitude>top-browDrop(longitude))return false;
  let low=0,high=1;
  for(let i=0;i<16;i++){
    const v=(low+high)/2,y=THREE.MathUtils.lerp(bottom,top,v)-browDrop(longitude)*THREE.MathUtils.smoothstep(v,.35,1);
    if(y<latitude)low=v;else high=v;
  }
  return Math.abs(longitude)<windowSpan((low+high)/2,HELMET_WINDOW.angle+margin);
}

function surface(material,name,rows,columns,sample){
  const vertices=[],uvs=[],indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    vertices.push(...sample(col/columns,row/rows));uvs.push(col/columns,row/rows);
    if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1;indices.push(a,b,c,b,c+1,c);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function boundary(point,t,spec){
  const section=Math.min(3,Math.floor(t*4)),p=t*4-section;
  const [u,v]=section===0?[p,0]:section===1?[1,p]:section===2?[1-p,1]:[0,1-p];
  return windowPoint(point,u,v,spec);
}
function frame(root,point,material,name,inner,outer){
  const mesh=surface(material,name,192,4,(u,v)=>boundary(point,v,inner).lerp(boundary(point,v,outer),u));root.add(mesh);return mesh;
}
function patch(root,point,material,name,bottom,top,left,right,offset=.006){
  const mesh=surface(material,name,12,40,(u,v)=>point(THREE.MathUtils.lerp(bottom,top,v),THREE.MathUtils.lerp(left,right,u),offset));root.add(mesh);return mesh;
}
function mounting(root,point,latitude,longitude,offset=.013){
  const group=new THREE.Group(),along=point(latitude,longitude+.001).sub(point(latitude,longitude-.001)).normalize();
  const up=point(latitude+.001,longitude).sub(point(latitude-.001,longitude)).normalize();
  const normal=along.clone().cross(up).normalize();up.crossVectors(normal,along);
  group.position.copy(point(latitude,longitude,offset));group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along,up,normal));root.add(group);return group;
}
function screw(parent,material,x,y,z,r=.0038){
  const bolt=cylinder(parent,material,x,y,z,r,.003,r,10);bolt.rotation.x=Math.PI/2;bolt.name='Helmet recessed fastener';return bolt;
}
function panelJoint(root,point,material,name,knots,side,r=.0012){
  // Interpolate in angular space before projecting onto the shell. A sparse
  // spline through world-space points can peel away from the rounded crown.
  const curve=new THREE.CatmullRomCurve3(knots.map(([lat,lon])=>new THREE.Vector3(lat,lon,0)));
  const points=Array.from({length:49},(_,i)=>{const p=curve.getPoint(i/48);return point(p.x,p.y*side,.0012).toArray();});
  pipe(root,material,points,r).name=name;
}

export function helmetFrame(root,point,m){
  // Lap over the glass by a few millimetres. Equal angular edges at different
  // radii would leave a hairline opening between the window and its seal.
  const glassEdge={bottom:-.685,top:.455,angle:1.015,offset:.017};
  const gasket={bottom:-.765,top:.535,angle:1.095,offset:.019};
  frame(root,point,m.paint,'Continuous white visor surround',
    {bottom:-.755,top:.525,angle:1.085,offset:.016},
    {bottom:-.91,top:.65,angle:1.28,offset:.009});
  frame(root,point,m.rubber,'Visor perimeter gasket',glassEdge,gasket);
  const perimeter=Array.from({length:129},(_,i)=>boundary(point,i/128,{...HELMET_WINDOW,offset:.020}).toArray());
  pipe(root,m.metal,perimeter,.0031).name='Visor inner retention rail';

  // Thick curved metal brow: a real retaining lip, not a stripe painted on a dome.
  root.add(surface(m.metal,'Brushed metal brow shield',8,64,(u,v)=>{
    const longitude=THREE.MathUtils.lerp(-1.04,1.04,u);
    return point(THREE.MathUtils.lerp(.50,.635,v)-browDrop(longitude),longitude,.029);
  }));
  for(const latitude of [.505,.636])pipe(root,m.edge,Array.from({length:33},(_,i)=>{
    const longitude=THREE.MathUtils.lerp(-1.04,1.04,i/32);return point(latitude-browDrop(longitude),longitude,.030).toArray();
  }),.0026).name='Brow machined edge';
  const topLock=mounting(root,point,.72,0,.015);
  box(topLock,m.paint,0,0,0,.047,.022,.012,.004).name='Brow centre sensor housing';
  box(topLock,m.black,0,0,.007,.025,.008,.004,.003).name='Brow sensor aperture';
  for(const x of [-.018,.018])screw(topLock,m.black,x,0,.008,.0022);

  // White bolted chin rail follows the same rounded opening as the visor.
  patch(root,point,m.paint,'Bolted chin guard',-.89,-.74,-1.10,1.10,.022);
  pipe(root,m.edge,Array.from({length:33},(_,i)=>point(-.855,THREE.MathUtils.lerp(-1.10,1.10,i/32),.028).toArray()),.0032).name='Chin guard metal edge';
  for(const longitude of [-.95,-.65,-.32,0,.32,.65,.95]){
    const base=mounting(root,point,-.80,longitude,.027);screw(base,m.black,0,0,.001,.0032);
  }
  for(const side of [-1,1]){
    for(const latitude of [-.55,-.22,.15,.43]){
      const base=mounting(root,point,latitude,side*1.16,.016);screw(base,m.black,0,0,0,.0028);
    }
    const latch=mounting(root,point,-.93,side*.83,.016);
    box(latch,m.black,0,0,0,.042,.035,.024,.005).name='Chin locking latch';
    box(latch,m.metal,0,0,.015,.028,.017,.008,.003);
    screw(latch,m.edge,-.015,0,.017,.0022);screw(latch,m.edge,.015,0,.017,.0022);
  }
}

export function helmetPanels(root,point,m){
  // A horizontal cap joint and broad rear cover replace the decorative stripes.
  const rearLeft=1.79,rearRight=2*Math.PI-rearLeft;
  patch(root,point,m.panel,'Rear lower service shell',-.30,.23,rearLeft,rearRight,.0045);
  patch(root,point,m.paint,'Rear cap locking band',.19,.32,rearLeft,rearRight,.0085);
  for(const latitude of [.18,.33])pipe(root,m.seam,Array.from({length:49},(_,i)=>point(latitude,THREE.MathUtils.lerp(rearLeft,rearRight,i/48),.010).toArray()),.0015).name='Rear cap panel seam';
  const rearCover=mounting(root,point,.03,Math.PI,.013);
  box(rearCover,m.panel,0,0,0,.135,.113,.016,.009).name='Rear rectangular access cover';
  box(rearCover,m.paint,0,-.047,.010,.111,.007,.006,.002);
  for(const longitude of [Math.PI-.48,Math.PI+.48]){
    const base=mounting(root,point,.29,longitude,.014);screw(base,m.black,0,0,.002,.006);
    screw(base,m.metal,0,0,.004,.0025);
  }
  for(const side of [-1,1]){
    // Side panel joints are inset, shallow lines; no raised diagonal cheek bars.
    const sideJoint=[[.91,1.90],[.69,2.12],[.41,2.37],[.06,2.45],[-.23,2.24],[-.40,1.91]];
    panelJoint(root,point,m.seam,'Side shell panel seam',sideJoint,side);
    panelJoint(root,point,m.panel,'Crown assembly joint',[[.49,1.40],[.66,1.72],[.62,2.08],[.44,2.35]],side,.0018);
    panelJoint(root,point,m.panel,'Crown moulded seam',[[.91,1.85],[1.15,1.85],[1.45,1.85]],side,.0012);
    const earCover=mounting(root,point,-.29,side*2.02,.010);
    box(earCover,m.panel,0,0,0,.074,.099,.012,.012).name='Side service cover';
    screw(earCover,m.seam,0,-.034,.009,.003);
    // Two separate dark switches sit in pale, recessed side housings.
    for(const [latitude,longitude,width,height]of [[-.36,1.43,.040,.066],[-.55,1.71,.025,.042]]){
      const socket=mounting(root,point,latitude,side*longitude,.012);
      box(socket,m.panel,0,0,0,width+.016,height+.013,.012,.008).name='Side control housing';
      box(socket,m.black,0,0,.008,width,height,.016,.006).name='Side release control';
      box(socket,m.metal,0,-height*.25,.017,width*.65,.006,.004,.001);
    }
    const rearClip=mounting(root,point,.12,side*2.51,.017);
    box(rearClip,m.paint,0,0,0,.026,.11,.022,.004).name='Rear cap side clip';
    for(const y of [-.037,.037])screw(rearClip,m.black,0,y,.014,.0034);
  }
}

export function helmetLiner(root,point,m,centre){
  const geometry=new THREE.SphereGeometry(1,56,40),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const latitude=Math.asin(THREE.MathUtils.clamp(positions.getY(i),-1,1)),longitude=Math.atan2(positions.getX(i),positions.getZ(i));
    const p=point(latitude,longitude,-.024);positions.setXYZ(i,p.x,p.y,p.z);
  }
  geometry.computeVertexNormals();
  const material=m.padding.clone();material.side=THREE.BackSide;
  const liner=new THREE.Mesh(geometry,material);liner.name='Recessed helmet inner liner';root.add(liner);
  for(const side of [-1,1]){
    const pad=box(root,m.padding,side*.128,centre.y-.005,centre.z-.128,.072,.230,.060,.020);pad.rotation.y=side*.22;pad.name='Helmet interior cheek pad';
    for(let i=0;i<3;i++)box(root,m.black,side*.128,centre.y-.073+i*.064,centre.z-.091,.050,.005,.003,.001).name='Interior pad stitched division';
  }
  box(root,m.padding,0,centre.y+.174,centre.z-.043,.208,.046,.118,.018).name='Helmet interior crown pad';
  box(root,m.padding,0,centre.y-.149,centre.z-.058,.184,.044,.085,.015).name='Helmet interior nape pad';
}
