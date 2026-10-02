import {BoxGeometry,ExtrudeGeometry,Group,Matrix4,Mesh,MeshBasicMaterial,Path,PlaneGeometry,Shape,ShapeGeometry,Vector3} from 'three';
import {createSpaceStars,SPACE_COLOR} from './space-stars.js';
import {box,cylinder,batchStatic} from './materials.js';
import {CABIN_AISLE,DECK} from './layout.js';
import {FLOOR_Y} from './ship.js';
import {EVA_BAY,EVA_HATCH_FIT} from './eva.js';
import {FOOTLIGHT} from './viewing-footlights.js';
import {addViewingWallDressing} from './viewing-wall-dressing.js';
import {addViewingWallDetails} from './viewing-wall-details.js';
import {VIEWING_WALL as PROFILE,viewingWallWindow,viewingWallPanelX,viewingWallFaceZ} from './viewing-wall-profile.js';

function octagon(path,w,h,corner=.12,cy=0,cx=0){
  const points=[[-w/2+corner,-h/2],[w/2-corner,-h/2],[w/2,-h/2+corner],[w/2,h/2-corner],[w/2-corner,h/2],[-w/2+corner,h/2],[-w/2,h/2-corner],[-w/2,-h/2+corner]];
  points.forEach(([x,y],i)=>i?path.lineTo(cx+x,cy+y):path.moveTo(cx+x,cy+y));path.closePath();return path;
}
function rectangle(w,h){
  const shape=new Shape();shape.moveTo(-w/2,-h/2).lineTo(w/2,-h/2).lineTo(w/2,h/2).lineTo(-w/2,h/2).closePath();return shape;
}
function extrusion(parent,name,shape,material,x,y,z,depth){
  const mesh=new Mesh(new ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1}),material);
  mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=material.userData.castShadow!==false;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function slope(parent,name,m,x,floor,width,from,to,offset=0,depth=.045){
  const height=to-from,low=viewingWallFaceZ(from),high=viewingWallFaceZ(to),geometry=new BoxGeometry(width,height,depth);
  const positions=geometry.attributes.position,gradient=(high-low)/height;
  for(let i=0;i<positions.count;i++)positions.setZ(i,positions.getZ(i)+gradient*positions.getY(i));
  geometry.computeVertexNormals();
  const mesh=new Mesh(geometry,m);mesh.name=name;mesh.position.set(x,floor+(from+to)/2,(low+high)/2+offset+depth/2);mesh.receiveShadow=mesh.castShadow=true;parent.add(mesh);return mesh;
}
function surfaceMount(parent,name,x,floor,from,to){
  const gradient=(viewingWallFaceZ(to)-viewingWallFaceZ(from))/(to-from),y=(from+to)/2;
  const root=new Group();root.name=name;root.position.set(x,floor+y,viewingWallFaceZ(y));
  root.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(-1,0,0),new Vector3(0,1,gradient).normalize(),new Vector3(0,gradient,-1).normalize()));
  parent.add(root);return root;
}
function upperEquipment(parent,m,diffuser,x,floor,index){
  const mount=surfaceMount(parent,'POV / upper service bay',x,floor,PROFILE.shoulder,PROFILE.top);
  if(index%3===2){
    box(mount,m.dark,0,0,.032,1.16,.43,.05).name='Upper light recess';
    box(mount,diffuser,0,0,.062,1.03,.30,.018).name='Upper louvered diffuser';
    for(let i=0;i<7;i++)box(mount,m.metal,-.45+i*.15,0,.085,.027,.34,.032).name='Upper light guard';
  }else{
    box(mount,m.rubber,0,0,.022,1.20,.47,.032).name='Upper pipe recess';
    for(let i=0;i<3;i++){
      const tube=cylinder(mount,i===1?m.metal:m.dark,0,(i-1)*.14,.082,.031,1.13,.031,8);
      tube.rotation.z=Math.PI/2;tube.name='Upper service pipe';
    }
    for(const dx of [-.48,.48])box(mount,m.metal,dx,0,.073,.052,.44,.105).name='Upper pipe saddle';
    for(const dx of [-.58,.58])box(mount,m.dark,dx,0,.065,.055,.48,.10).name='Upper pipe manifold';
  }
}
function viewport(parent,m,x,floor){
  const {windowWidth:w,windowHeight:h,windowY:y,faceZ:z}=PROFILE;
  const frame=octagon(new Shape(),w+.20,h+.20,.18);
  frame.holes.push(octagon(new Path(),w-.025,h-.025,.11));
  extrusion(parent,'POV / pressure window frame',frame,m.metal,x,floor+y,z-.082,.09);
  const seal=octagon(new Shape(),w+.035,h+.035,.14);
  seal.holes.push(octagon(new Path(),w-.070,h-.070,.105));
  extrusion(parent,'POV / window seal',seal,m.rubber,x,floor+y,z+.014,.06);
  const glass=new Mesh(new ShapeGeometry(octagon(new Shape(),w,h)),m.windowGlass);
  glass.name='POV / pressure window glass';glass.position.set(x,floor+y,z+.145);glass.rotation.y=Math.PI;parent.add(glass);
  for(const dx of [-.54,.54])for(const dy of [-.37,.37]){
    const bolt=cylinder(parent,m.dark,x+dx,floor+y+dy,z-.091,.019,.014,.019,6);bolt.rotation.x=Math.PI/2;bolt.name='Window frame fastener';
  }
}
function exteriorSpace(){
  const root=new Group();root.name='POV / space beyond windows';
  const background=new Mesh(new PlaneGeometry(240,140),new MeshBasicMaterial({name:'POV / deep space',color:SPACE_COLOR,toneMapped:false,depthWrite:false}));
  background.renderOrder=-1;
  background.position.set(0,6,90);background.rotation.y=Math.PI;root.add(background);
  root.add(createSpaceStars());return root;
}

function pressureReturns(parent,m,floor){
  // Continue the existing pressure partitions into the new recess. The old
  // partitions remain part of the cutaway ship; these strips close the POV shell.
  for(const x of [EVA_BAY.innerX,EVA_BAY.hatchX]){
    const top=x===EVA_BAY.innerX?3.396:3.242,edge=PROFILE.edgeZ+.20,face=PROFILE.faceZ+.20;
    const shape=new Shape();
    const points=[[CABIN_AISLE.deckFront,0],[edge,0],[edge,PROFILE.bottom],[face,PROFILE.knee],[face,PROFILE.shoulder],[edge,PROFILE.top],[edge,top],[CABIN_AISLE.deckFront,top]];
    points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
    const returnWall=extrusion(parent,'POV / pressure partition extension',shape,m.enamel,x+.155,floor,0,.20);
    returnWall.rotation.y=-Math.PI/2;
  }
}

export function cabinWallMaterials(ship){
  const found=new Map();
  ship.traverse(mesh=>{for(const material of Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[])found.set(material.name,material);});
  const pick=name=>{
    const material=found.get(`Cabin toon / Industrial / ${name}`)??found.get(`Industrial / ${name}`);
    if(!material)throw new Error(`Missing cabin wall material: ${name}`);
    return material;
  };
  const materials={enamel:pick('worn ivory'),dark:pick('structural iron'),metal:pick('brushed steel'),rubber:pick('rubber')};
  if(ship.userData.viewingWallFixtures){
    materials.fixtures=Object.fromEntries(Object.entries(ship.userData.viewingWallFixtures).map(([key,source])=>{
      const copy=source.clone();
      copy.traverse(mesh=>{if(mesh.isMesh){
        const match=material=>found.get(`Cabin toon / ${material.name}`)??found.get(material.name)??material;
        mesh.material=Array.isArray(mesh.material)?mesh.material.map(match):match(mesh.material);
      }});
      return[key,copy];
    }));
  }
  return materials;
}

export function createViewingWall(m,{mergeStatic=true}={}){
  const root=new Group();root.name='POV / matching cabin enclosure';
  const front=CABIN_AISLE.deckFront,operations=FLOOR_Y[DECK.OPERATIONS];
  const diffuser=new MeshBasicMaterial({name:'POV / concealed footlight diffuser',color:0xffdfb3,toneMapped:false});
  diffuser.userData.castShadow=false;
  const overhead=new MeshBasicMaterial({name:'POV / upper diffuser',color:0xe0e8e2,toneMapped:false});overhead.userData.castShadow=false;
  const windowGlass=new MeshBasicMaterial({name:'POV / pressure glass',color:0x8aa4b0,transparent:true,opacity:.065,depthWrite:false,toneMapped:false});windowGlass.userData.castShadow=false;
  const solid=(name,material,x,y,z,w,h,d,r=0)=>{const part=box(root,material,x,y,z,w,h,d,r);part.name=name;return part;};
  const footlight=(name,material,x,floor,y,z,width,height,depth)=>{
    let spans=[[x-width/2,x+width/2]];
    if(floor===operations){
      const clearance=.22*EVA_HATCH_FIT.scale+.02;
      for(const hatchX of [EVA_BAY.innerX,EVA_BAY.hatchX])spans=spans.flatMap(([left,right])=>{
        const a=hatchX-clearance,b=hatchX+clearance;
        if(right<=a||left>=b)return[[left,right]];
        return[[left,Math.min(right,a)],[Math.max(left,b),right]].filter(([l,r])=>r-l>.01);
      });
    }
    // End the strip and its recess before the pressure housing, not through it.
    for(const [left,right]of spans)solid(name,material,(left+right)/2,floor+y,z,right-left,height,depth);
  };
  // Three connected faces, with real holes through both the lining and backing.
  // No full-height sheet sits behind the windows.
  for(const floor of FLOOR_Y){
    const mid=(PROFILE.knee+PROFILE.shoulder)/2,height=PROFILE.shoulder-PROFILE.knee;
    const backing=rectangle(PROFILE.halfWidth*2,height);
    for(let i=0;i<PROFILE.count;i++)if(viewingWallWindow(i))backing.holes.push(octagon(new Path(),PROFILE.windowWidth,PROFILE.windowHeight,.12,PROFILE.windowY-mid,viewingWallPanelX(i)));
    extrusion(root,'Front pressure backing',backing,m.rubber,0,floor+mid,PROFILE.faceZ+.052,.16);
    slope(root,'Lower pressure backing',m.dark,0,floor,PROFILE.halfWidth*2,PROFILE.bottom,PROFILE.knee,.052,.16);
    slope(root,'Upper pressure backing',m.dark,0,floor,PROFILE.halfWidth*2,PROFILE.shoulder,PROFILE.top,.052,.16);
    for(let i=0;i<FOOTLIGHT.count;i++){
      const x=FOOTLIGHT.firstX+i*FOOTLIGHT.spacing;
      const face=rectangle(1.48,height);
      if(viewingWallWindow(i))face.holes.push(octagon(new Path(),PROFILE.windowWidth,PROFILE.windowHeight,.12,PROFILE.windowY-mid));
      extrusion(root,'Front cabin panel',face,m.enamel,x,floor+mid,PROFILE.faceZ,.045);
      slope(root,'Lower angled panel',m.enamel,x,floor,1.48,PROFILE.bottom,PROFILE.knee);
      slope(root,'Upper angled panel',m.enamel,x,floor,1.48,PROFILE.shoulder,PROFILE.top);
      if(viewingWallWindow(i))viewport(root,{...m,windowGlass},x,floor);
      upperEquipment(root,m,overhead,x,floor,i);
      const vent=surfaceMount(root,'POV / lower ventilation',x,floor,PROFILE.bottom,PROFILE.knee);
      box(vent,m.dark,0,0,.022,1.10,.23,.028).name='Lower vent recess';
      for(let n=0;n<4;n++)box(vent,m.metal,0,(n-1.5)*.05,.047,1.03,.016,.026).name='Lower vent louver';
      footlight('Footlight recess',m.rubber,x,floor,.104,front-.009,1.47,.077,.012);
      footlight('Concealed footlight strip',diffuser,x,floor,FOOTLIGHT.y,FOOTLIGHT.wallFaceZ+FOOTLIGHT.inset,FOOTLIGHT.width,FOOTLIGHT.height,.008);
      for(const dx of [-.69,.69])for(const dy of [-height/2+.09,height/2-.09]){
        const bolt=cylinder(root,m.metal,x+dx,floor+mid+dy,PROFILE.faceZ-.012,.018,.015,.018,6);bolt.rotation.x=Math.PI/2;
      }
    }
    // Close the narrow end bays using the same cross-section as the panels.
    for(const [left,right]of [[-PROFILE.halfWidth,FOOTLIGHT.firstX-.76],[FOOTLIGHT.firstX+(FOOTLIGHT.count-1)*FOOTLIGHT.spacing+.76,PROFILE.halfWidth]]){
      const width=right-left,x=(left+right)/2;
      solid('Front end bay',m.enamel,x,floor+mid,PROFILE.faceZ+.0225,width,height,.045);
      slope(root,'Lower end bay',m.enamel,x,floor,width,PROFILE.bottom,PROFILE.knee);
      slope(root,'Upper end bay',m.enamel,x,floor,width,PROFILE.shoulder,PROFILE.top);
    }
    solid('Front skirting',m.dark,0,floor+.029,front-.049,26.2,.064,.09);
    solid('Front sill backing',m.dark,0,floor+.069,front+.104,26.3,.154,.20);
    solid('Front ceiling seam',m.dark,0,floor+3.02,front-.073,26.2,.16,.14);
    solid('Front interdeck closure',m.dark,0,floor+3.21,PROFILE.edgeZ+.105,26.3,.22,.21);
  }
  // Side walls stop at z=1.595; the roof now reaches the forward deck edge.
  for(const side of [-1,1]){
    const spans=side===1?[[-.365,operations],[operations+3.242,10.245]]:[[-.365,10.245]];
    const outside=PROFILE.faceZ+.226;
    for(const [bottom,top]of spans)solid('Side wall return',m.enamel,side*13.07,(bottom+top)/2,(1.57+outside)/2,.40,top-bottom,outside-1.57);
    solid('Roof return',m.dark,side*7,10.31,(front-.03+outside+.014)/2,12.9,.26,outside+.014-front+.03);
  }
  const roofOutside=PROFILE.faceZ+.24;
  solid('Central roof return',m.dark,0,10.31,(front+roofOutside)/2,1.10,.26,roofOutside-front);
  pressureReturns(root,m,operations);
  addViewingWallDressing(root,m.fixtures,FLOOR_Y);
  addViewingWallDetails(root,m,FLOOR_Y,overhead);
  const result=mergeStatic?batchStatic(root):root;result.add(exteriorSpace());result.name=root.name;result.visible=false;return result;
}
