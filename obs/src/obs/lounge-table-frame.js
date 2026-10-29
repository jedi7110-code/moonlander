import {ExtrudeGeometry,Group,Mesh,Shape} from 'three';
import {box,cylinder} from './materials.js';
import {LOUNGE_SEAT,LOUNGE_TABLE} from './layout.js';

function panelGeometry(width,depth,radius,sections){
  const x=width/2,z=depth/2,r=radius,shape=new Shape();
  shape.moveTo(-x+r,-z);shape.lineTo(x-r,-z);shape.quadraticCurveTo(x,-z,x,-z+r);
  shape.lineTo(x,z-r);shape.quadraticCurveTo(x,z,x-r,z);
  shape.lineTo(-x+r,z);shape.quadraticCurveTo(-x,z,-x,z-r);
  shape.lineTo(-x,-z+r);shape.quadraticCurveTo(-x,-z,-x+r,-z);shape.closePath();
  const height=sections.at(-1)[0],steps=sections.length-1;
  const geometry=new ExtrudeGeometry(shape,{depth:height,steps,curveSegments:6,bevelEnabled:false});
  const {position}=geometry.attributes;
  // Shallow grooves are cut into a vertical metal edge, not rolled onto its face.
  for(let i=0;i<position.count;i++){
    const [y,inset]=sections[Math.round(position.getZ(i)/height*steps)];
    position.setXYZ(i,position.getX(i)*(width-2*inset)/width,position.getY(i)*(depth-2*inset)/depth,y);
  }
  geometry.rotateX(-Math.PI/2);geometry.computeVertexNormals();
  return geometry;
}

export function createLoungeTableFrame(titanium,topMaterial){
  const root=new Group();root.name='Lounge table';
  const top=LOUNGE_SEAT.top+.32,underside=top-.08,baseThickness=.028;
  box(root,titanium,0,baseThickness/2,0,.34,baseThickness,.30,.004).name='Table floor mounting plate';
  cylinder(root,titanium,0,(baseThickness+underside)/2,0,.056,underside-baseThickness,.056,24).name='Table pedestal';
  for(const x of[-.12,.12])for(const z of[-.10,.10]){
    cylinder(root,titanium,x,baseThickness+.002,z,.021,.004,.021,16).name='Table anchor washer';
    const bolt=cylinder(root,titanium,x,baseThickness+.010,z,.014,.012,.014,6);
    bolt.name='Table floor anchor bolt';bolt.rotation.y=Math.PI/6;
  }
  // Keep the existing overall dimensions, top height and resting props unchanged.
  const tabletop=new Group();tabletop.name='Tabletop';tabletop.position.y=underside;root.add(tabletop);
  const add=(name,material,geometry,y=0)=>{
    const part=new Mesh(geometry,material);part.name=name;part.position.y=y;
    part.castShadow=part.receiveShadow=true;tabletop.add(part);
  };
  const {width,depth}=LOUNGE_TABLE;
  add('Table satin titanium edge',titanium,panelGeometry(width,depth,.055,[
    [0,.0015],[.002,0],[.017,0],[.019,.002],[.022,.002],[.024,0],
    [.044,0],[.046,.002],[.049,.002],[.051,0],[.072,0],[.074,.0015],
  ]));
  add('Table ivory top',topMaterial,panelGeometry(width-.003,depth-.003,.0535,[[0,0],[.006,0]]),.074);
  return root;
}
