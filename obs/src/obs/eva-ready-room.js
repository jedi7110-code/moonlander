// The EVA ready room: the last pressure compartment before open space, at the
// right end of LEVEL 1 on top of the right stair tower. The crew waits here,
// suited, between the EVA bay's hatch (which opens into this room) and the
// outer hatch in the room's end wall.
//
// It is deliberately unlike the stair towers below it: no exposed pipes, ribs
// or plant-room lamps. The room is an octagonal tube from hatch to hatch
// (sloped panels where the rear wall meets floor and ceiling; the character
// view's front wall has the same slopes), in dark graphite with pale slopes
// and thin cool light lines. A large octagonal viewport in the rear wall
// is a real opening onto the ship's star field, like the cabin's other
// space windows; an octagonal stand pad on the floor and an
// octagonal light panel above it mark where the crew waits. The lights are
// glowing surfaces only: no light source, no pool of light.
//
// The sloped panels carry the room's own plant: gas tanks in saddles, the
// lines that feed the equalisation panel, and access panels. The door to space
// is not one of the ship's sliding cassettes but a heavy hand-closed plug
// hatch: hinged, dogged all round, locked by bars thrown from a hand wheel.
// It goes right through the end wall, whose outside is the stair tower's dark
// outer wall carried up, so the door shows on the outside of the ship too.
import * as THREE from 'three';
import {box,ball,rod,pipe,cylinder} from './materials.js';
import {STAIR_TOWER} from './stair-tower.js';
import {EVA_BAY} from './eva.js';
import {SPACE_COLOR} from './space-stars.js';

// x: inside faces of the two bulkheads; hatchX: the outer hatch (at the same
// depth as the EVA bay's hatch, so the two doors line up); height: floor to
// the underside of the cabin roof. Profile of the octagonal section (above the
// floor): the rear wall is vertical between `knee` and `shoulder` and slopes
// `toe` metres into the room below and above them.
export const READY_ROOM=Object.freeze({left:EVA_BAY.hatchX+.155,right:17.50,hatchX:17.545,height:3.396,
  toe:.62,knee:.74,shoulder:2.40,liner:3.16,
  viewport:Object.freeze({width:2.30,height:1.30,corner:.36,centerY:1.57}),pad:.72,
  // The outer hatch: leaf and coaming (width, height, corner cut), centre above the floor.
  hatch:Object.freeze({centerY:1.33,leaf:Object.freeze([1.24,2.10,.25]),coaming:Object.freeze([1.56,2.42,.30]),wheel:.23})});

function octagon(path,w,h,corner,cx=0,cy=0){
  const points=[[-w/2+corner,-h/2],[w/2-corner,-h/2],[w/2,-h/2+corner],[w/2,h/2-corner],[w/2-corner,h/2],[-w/2+corner,h/2],[-w/2,h/2-corner],[-w/2,-h/2+corner]];
  points.forEach(([x,y],i)=>i?path.lineTo(cx+x,cy+y):path.moveTo(cx+x,cy+y));path.closePath();return path;
}
// The door to space. Local axes: x across the door, y up, z out of the
// bulkhead into the room (whose inner face is at z=`face`); `thickness`: of the
// whole end wall, inner face to outer skin.
function createOuterHatch(m,steel,indicator,thickness){
  const root=new THREE.Group(),face=.045,{leaf,coaming,wheel}=READY_ROOM.hatch;
  const add=(mesh,name)=>{mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
  const slab=(shape,material,z,thickness,name)=>{const mesh=add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:1}),material),name);mesh.position.z=z;return mesh;};
  const along=(mesh,name)=>{mesh.rotation.x=Math.PI/2;if(name)mesh.name=name;return mesh;};      // a cylinder whose axis points into the room
  // Coaming welded to the bulkhead, the leaf seated on it, a raised centre and two stiffeners.
  const ring=octagon(new THREE.Shape(),...coaming);ring.holes.push(octagon(new THREE.Path(),coaming[0]-.40,coaming[1]-.40,coaming[2]-.08));
  slab(ring,m.dark,face,.09,'Outer hatch coaming');
  slab(octagon(new THREE.Shape(),...leaf),steel,face+.035,.13,'Outer hatch leaf');
  slab(octagon(new THREE.Shape(),leaf[0]-.32,leaf[1]-.40,leaf[2]-.07),steel,face+.165,.03,'Outer hatch leaf boss');
  for(const yy of [-.56,.56])box(root,m.dark,0,yy,face+.20,leaf[0]-.10,.07,.05,.01).name='Outer hatch stiffener';
  // Coaming bolts, evenly along the middle of the ring.
  const [bw,bh,bc]=[coaming[0]-.20,coaming[1]-.20,coaming[2]-.04],corners=[[-bw/2+bc,-bh/2],[bw/2-bc,-bh/2],[bw/2,-bh/2+bc],[bw/2,bh/2-bc],[bw/2-bc,bh/2],[-bw/2+bc,bh/2],[-bw/2,bh/2-bc],[-bw/2,-bh/2+bc]];
  corners.forEach(([x0,y0],i)=>{
    const [x1,y1]=corners[(i+1)%8],count=Math.max(1,Math.round(Math.hypot(x1-x0,y1-y0)/.19));
    for(let k=0;k<count;k++){const t=(k+.5)/count;along(cylinder(root,m.metal,x0+(x1-x0)*t,y0+(y1-y0)*t,face+.096,.017,.014,.017,6),'Outer hatch coaming bolt');}
  });
  // Hand wheel on its shaft; it throws four lock bars into keepers on the coaming.
  along(cylinder(root,m.metal,0,0,face+.23,.085,.07,.085,8),'Outer hatch gear box');
  rod(root,m.metal,[0,0,face+.26],[0,0,face+.285],.03);
  const rim=add(new THREE.Mesh(new THREE.TorusGeometry(wheel,.02,8,28),m.yellow),'Outer hatch hand wheel');rim.position.z=face+.275;
  for(let k=0;k<5;k++){const a=Math.PI/2+k*Math.PI*.4;rod(root,m.yellow,[0,0,face+.262],[Math.cos(a)*wheel,Math.sin(a)*wheel,face+.275],.014).name='Outer hatch wheel spoke';}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const reach=(dx?leaf[0]:leaf[1])/2,from=.08,to=reach+.05,mid=(from+to)/2,length=to-from;
    box(root,m.metal,dx*mid,dy*mid,face+.237,dx?length:.05,dy?length:.05,.02).name='Outer hatch lock bar';
    box(root,m.dark,dx*(reach-.10),dy*(reach-.10),face+.232,dx?.07:.12,dy?.07:.12,.05,.008).name='Outer hatch bar guide';
    box(root,m.metal,dx*(reach+.09),dy*(reach+.09),face+.165,dx?.12:.15,dy?.12:.15,.15,.012).name='Outer hatch bar keeper';
  }
  // Two hinges on the rear side, each a barrel on the coaming and a strap across the leaf.
  for(const yy of [-.66,.66]){
    cylinder(root,m.metal,-leaf[0]/2-.07,yy,face+.15,.05,.32,.05,12).name='Outer hatch hinge';
    box(root,m.dark,-leaf[0]/2-.07,yy,face+.07,.13,.36,.10,.012).name='Outer hatch hinge bracket';
    box(root,m.dark,-leaf[0]/2+.16,yy,face+.185,.46,.11,.04,.01).name='Outer hatch hinge strap';
  }
  // Six swing dogs: a pivot on the coaming, a wedge arm over the edge of the leaf, a red grip.
  const dogs=[[leaf[0]/2+.07,.66,Math.PI],[leaf[0]/2+.07,-.66,Math.PI],[-.34,leaf[1]/2+.07,-Math.PI/2],[.34,leaf[1]/2+.07,-Math.PI/2],[-.34,-leaf[1]/2-.07,Math.PI/2],[.34,-leaf[1]/2-.07,Math.PI/2]];
  for(const [x,yy,angle] of dogs){
    const dog=new THREE.Group();dog.name='Outer hatch dog';dog.position.set(x,yy,face+.09);dog.rotation.z=angle;root.add(dog);
    along(cylinder(dog,m.metal,0,0,.065,.034,.13,.034,8));
    box(dog,m.metal,.09,0,.105,.24,.06,.035,.008).name='Outer hatch dog arm';
    box(dog,m.red,-.065,0,.105,.10,.045,.045,.012).name='Outer hatch dog grip';
  }
  // The leaf is a plug right through the end wall: its outer face, an outer coaming, a second
  // hand wheel on the same shaft and two grab bars are what the ship shows to space.
  const out=face-thickness;
  slab(octagon(new THREE.Shape(),coaming[0]-.42,coaming[1]-.42,coaming[2]-.085),steel,out-.03,face+.035-out+.03,'Outer hatch plug');
  const outer=octagon(new THREE.Shape(),coaming[0]-.12,coaming[1]-.12,coaming[2]-.03);outer.holes.push(octagon(new THREE.Path(),coaming[0]-.40,coaming[1]-.40,coaming[2]-.08));
  slab(outer,m.dark,out-.06,.06,'Outer hatch outside coaming');
  for(const yy of [-.56,.56])box(root,m.dark,0,yy,out-.045,coaming[0]-.50,.07,.04,.01).name='Outer hatch outside stiffener';
  along(cylinder(root,m.metal,0,0,out-.06,.07,.06,.07,8),'Outer hatch outside gear box');
  const outsideRim=add(new THREE.Mesh(new THREE.TorusGeometry(wheel*.74,.018,8,24),m.yellow),'Outer hatch outside hand wheel');outsideRim.position.z=out-.12;
  for(let k=0;k<3;k++){const a=Math.PI/2+k*Math.PI*2/3;rod(root,m.yellow,[0,0,out-.10],[Math.cos(a)*wheel*.74,Math.sin(a)*wheel*.74,out-.12],.013).name='Outer hatch wheel spoke';}
  for(const side of [-1,1]){
    const x=side*(coaming[0]/2+.06);
    rod(root,m.metal,[x,-.45,out-.09],[x,.45,out-.09],.018).name='Outer hatch outside grab bar';
    for(const yy of [-.45,.45])rod(root,m.dark,[x,yy,out],[x,yy,out-.09],.012);
  }
  box(root,m.metal,0,-coaming[1]/2-.05,out-.08,coaming[0]-.20,.05,.16,.01).name='Outer hatch outside step';
  // Raised sill to step over, and the sealed lamp above the door.
  const bottom=-coaming[1]/2,floor=-READY_ROOM.hatch.centerY;
  box(root,m.dark,0,(bottom+floor)/2-.004,face+.07,coaming[0]-.10,bottom-floor-.008,.14).name='Outer hatch sill';
  box(root,m.yellow,0,bottom+.012,face+.142,coaming[0]-.10,.045,.012).name='Outer hatch sill edge';
  box(root,m.dark,0,coaming[1]/2+.17,face+.04,.36,.16,.08,.012).name='Outer hatch status box';
  box(root,indicator,-.09,coaming[1]/2+.17,face+.083,.10,.06,.008).name='Outer hatch sealed lamp';
  box(root,m.rubber,.09,coaming[1]/2+.17,face+.083,.10,.06,.008).name='Outer hatch open lamp';
  return root;
}

export function createEVAReadyRoom(materials,y){
  const root=new THREE.Group();root.name='EVA ready room / LEVEL 1 above the right stair tower';
  const m=Object.assign(Object.create(materials),{rubber:materials.rubber??materials.dark});
  const {rearWallZ:wall,deckBack,deckFront}=STAIR_TOWER,{left,right,hatchX,height,toe,knee,shoulder,liner,viewport,pad}=READY_ROOM;
  const top=y+height,cx=(left+right)/2,width=right-left,depth=EVA_BAY.depth;
  // The end wall continues the right stair tower's outer wall straight up: the ivory lining out to
  // `lining`, then the same dark outer wall out to `skin` (the tower's own x positions, mirrored).
  const lining=-STAIR_TOWER.innerLeft+.10,skin=lining+.18,end=lining;
  // The room's own surfaces.
  const graphite=new THREE.MeshStandardMaterial({name:'Ready room / graphite panel',color:0x2a3036,roughness:.62,metalness:.35});
  const mat=new THREE.MeshStandardMaterial({name:'Ready room / deck mat',color:0x1a1e21,roughness:.9,metalness:.05});
  const glow=new THREE.MeshBasicMaterial({name:'Ready room light line',color:0xbfe9ff,toneMapped:false});
  const panelGlow=new THREE.MeshBasicMaterial({name:'Ready room ceiling light',color:0x9fd2e4,toneMapped:false});
  const glass=new THREE.MeshBasicMaterial({name:'Ready room viewport glass',color:0x8fb4c4,transparent:true,opacity:.07,depthWrite:false,toneMapped:false});
  const space=new THREE.MeshBasicMaterial({name:'Ready room viewport deep space',color:SPACE_COLOR,depthWrite:false,toneMapped:false});space.userData.cabinAlwaysPowered=true;
  const steel=new THREE.MeshStandardMaterial({name:'Ready room / hatch steel',color:0x596168,roughness:.46,metalness:.72});
  const shell=new THREE.MeshStandardMaterial({name:'Ready room / tank shell',color:0xc9cdc6,roughness:.42,metalness:.45});
  const indicator=new THREE.MeshBasicMaterial({name:'Ready room hatch sealed lamp',color:0xff5a3c,toneMapped:false});
  for(const material of [glow,panelGlow,glass,space,indicator])material.userData.castShadow=false;
  const add=(mesh,name)=>{mesh.name=name;mesh.castShadow=mesh.material.userData.castShadow!==false;mesh.receiveShadow=true;root.add(mesh);return mesh;};
  const extrude=(shape,material,z,thickness,name)=>{const mesh=add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:1}),material),name);mesh.position.z=z;return mesh;};
  // A flat panel along x between two points of the section ([z,y] above the floor).
  const panel=(material,x0,x1,[z0,y0],[z1,y1],thickness,name)=>{
    const dz=z1-z0,dy=y1-y0,mesh=box(root,material,(x0+x1)/2,y+(y0+y1)/2,(z0+z1)/2,x1-x0,Math.hypot(dz,dy),thickness);
    mesh.rotation.x=Math.atan2(dz,dy);mesh.name=name;return mesh;
  };

  // ---- Shell: cabin roof layers continued at their exact heights, the octagonal section inside
  const roofBack=-1.92,roofRight=skin+.01;
  box(root,m.dark,(13.45+roofRight)/2,10.31,(roofBack+deckFront)/2,roofRight-13.45,.26,deckFront-roofBack,.05).name='Ready room roof structure';
  box(root,m.enamel,(13.30+roofRight+.012)/2,10.48,(deckFront-1.87)/2,roofRight+.012-13.30,.19,deckFront+1.87,.035).name='Ready room roof skin';
  const vy=y+viewport.centerY,structure=new THREE.Shape(),face=new THREE.Shape();
  structure.moveTo(12.62,y);structure.lineTo(end,y);structure.lineTo(end,top);structure.lineTo(12.62,top);structure.closePath();
  structure.holes.push(octagon(new THREE.Path(),viewport.width+.02,viewport.height+.02,viewport.corner+.006,cx,vy));
  extrude(structure,m.dark,wall-.38,.18,'Ready room rear structure');
  face.moveTo(left,y+knee);face.lineTo(right,y+knee);face.lineTo(right,y+shoulder);face.lineTo(left,y+shoulder);face.closePath();
  face.holes.push(octagon(new THREE.Path(),viewport.width,viewport.height,viewport.corner,cx,vy));
  extrude(face,graphite,wall-.20,.20,'Ready room rear wall');
  panel(m.enamel,left,right,[wall+toe,.02],[wall,knee],.05,'Ready room lower slope');
  panel(m.enamel,left,right,[wall,shoulder],[wall+toe,liner],.05,'Ready room upper slope');
  box(root,graphite,cx,y+liner+.03,(wall+toe+deckFront)/2,width,.06,deckFront-wall-toe).name='Ready room ceiling liner';
  box(root,mat,cx,y-.01825,(deckBack+deckFront)/2,width-.008,.0355,deckFront-deckBack-.008).name='Ready room walking surface';
  // Octagonal portal frames at both ends, following the section.
  for(const x of [left+.08,right-.08]){
    panel(m.dark,x-.07,x+.07,[wall+toe+.04,.02],[wall+.04,knee+.02],.10,'Ready room portal frame');
    panel(m.dark,x-.07,x+.07,[wall+.05,knee],[wall+.05,shoulder],.10,'Ready room portal frame');
    panel(m.dark,x-.07,x+.07,[wall+.04,shoulder-.02],[wall+toe+.04,liner-.02],.10,'Ready room portal frame');
    box(root,m.dark,x,y+liner-.05,(wall+toe+deckFront)/2,.14,.10,deckFront-wall-toe-.02).name='Ready room portal frame';
  }
  // Thin light lines where the slopes meet the wall.
  for(const yy of [knee+.035,shoulder-.035])box(root,glow,cx,y+yy,wall+.009,width-.40,.022,.018).name='Ready room light line';

  // ---- End wall: a solid pressure bulkhead with the heavy outer hatch on it
  const {coaming,centerY}=READY_ROOM.hatch,bulkhead=new THREE.Shape();
  // (both layers stand on the tower's roof slab, whose top is 3.6 cm under the deck plates)
  const outBottom=-.034;
  bulkhead.moveTo(-1.87,outBottom);bulkhead.lineTo(deckFront,outBottom);bulkhead.lineTo(deckFront,height);bulkhead.lineTo(-1.87,height);bulkhead.closePath();
  const doorway=()=>octagon(new THREE.Path(),coaming[0]-.40,coaming[1]-.40,coaming[2]-.08,depth,centerY);
  bulkhead.holes.push(doorway());
  const endWall=extrude(bulkhead,m.enamel,0,lining-right,'Outer bulkhead');endWall.position.set(lining,y,0);endWall.rotation.y=-Math.PI/2;
  const outside=new THREE.Shape(),outBack=wall-.37,outFront=deckFront-.006;
  outside.moveTo(outBack,outBottom);outside.lineTo(outFront,outBottom);outside.lineTo(outFront,height);outside.lineTo(outBack,height);outside.closePath();
  outside.holes.push(doorway());
  const outerWall=extrude(outside,m.dark,0,skin-lining,'Ready room outer wall');outerWall.position.set(skin,y,0);outerWall.rotation.y=-Math.PI/2;
  const hatch=createOuterHatch(m,steel,indicator,skin-right);hatch.name='Outer airlock / sealed';
  hatch.position.set(hatchX,y+READY_ROOM.hatch.centerY,depth);hatch.rotation.y=EVA_BAY.hatchYaw;root.add(hatch);

  // ---- Octagonal viewport in the rear wall
  const {width:vw,height:vh,corner:vc}=viewport;
  const frame=octagon(new THREE.Shape(),vw+.26,vh+.26,vc+.06,cx,vy);frame.holes.push(octagon(new THREE.Path(),vw,vh,vc,cx,vy));
  extrude(frame,m.dark,wall-.30,.34,'Ready room viewport frame');
  const lip=octagon(new THREE.Shape(),vw,vh,vc,cx,vy);lip.holes.push(octagon(new THREE.Path(),vw-.06,vh-.06,vc-.018,cx,vy));
  extrude(lip,glow,wall+.034,.008,'Ready room viewport light');
  add(new THREE.Mesh(new THREE.ShapeGeometry(octagon(new THREE.Shape(),vw,vh,vc,cx,vy)),glass),'Ready room viewport glass').position.z=wall-.03;
  // The opening goes right through the wall. This dark backing writes no depth: the ship's
  // star field (space-stars.js) is drawn through every mesh that carries `spaceWindow`.
  const sky=add(new THREE.Mesh(new THREE.ShapeGeometry(octagon(new THREE.Shape(),vw+.30,vh+.30,vc+.10)),space),'Ready room viewport space');
  sky.position.set(cx,vy,wall-.385);sky.userData.spaceWindow={width:vw+.30,height:vh+.30,cut:vc+.10};

  // ---- Waiting bench under the viewport
  const benchW=2.0,seatZ=wall+.50;
  box(root,graphite,cx,y+.45,seatZ,benchW,.05,.40,.02).name='Ready room bench';
  for(const dx of [-.75,-.25,.25,.75])box(root,m.rubber,cx+dx,y+.49,seatZ,.44,.035,.34,.014).name='Bench seat pad';
  for(const dx of [-.92,0,.92])box(root,m.dark,cx+dx,y+.30,wall+.44,.05,.26,.26).name='Bench bracket';

  // ---- Instrument plate (left of the viewport): pressure gauges and the equalisation valve
  const plateX=left+.44,plateY=y+1.57,plateFace=wall+.05;
  extrude(octagon(new THREE.Shape(),.58,.82,.15,plateX,plateY),m.dark,wall,.05,'Pressure equalisation panel');
  for(const [i,dx] of [-.15,0,.15].entries()){
    const rim=cylinder(root,m.metal,plateX+dx,plateY+.19,plateFace+.012,.062,.028,.062,8);rim.rotation.x=Math.PI/2;rim.rotation.y=Math.PI/8;rim.name='Pressure gauge';
    const dial=cylinder(root,m.enamel,plateX+dx,plateY+.19,plateFace+.028,.05,.006,.05,20);dial.rotation.x=Math.PI/2;
    // (the needle turns about the dial's centre; box() shares one geometry, so it is placed, not edited)
    const angle=(i-1)*.9-.3,needle=box(root,m.red,plateX+dx-Math.sin(angle)*.018,plateY+.19+Math.cos(angle)*.018,plateFace+.033,.007,.042,.003);needle.rotation.z=angle;
  }
  const wheel=add(new THREE.Mesh(new THREE.TorusGeometry(.085,.012,6,8),m.red),'Equalisation valve wheel');
  wheel.position.set(plateX,plateY-.17,plateFace+.085);wheel.rotation.z=Math.PI/8;
  for(const angle of [0,Math.PI/2])box(root,m.red,plateX,plateY-.17,plateFace+.085,.165,.014,.012).rotation.z=angle;
  rod(root,m.metal,[plateX,plateY-.17,plateFace],[plateX,plateY-.17,plateFace+.09],.014);
  box(root,glow,plateX,plateY-.345,plateFace+.004,.30,.014,.006).name='Ready room light line';

  // ---- Plant on the sloped panels: tanks in saddles, the lines they feed, access panels.
  // A point of a slope: s runs up the slope (0..1), `off` stands off it into the room.
  const lowLen=Math.hypot(toe,knee-.02),upLen=Math.hypot(toe,liner-shoulder),lowTilt=Math.atan2(-toe,knee-.02);
  const lower=(s,off=0)=>[wall+toe*(1-s)+(knee-.02)/lowLen*off,.02+(knee-.02)*s+toe/lowLen*off];
  const upper=(s,off=0)=>[wall+toe*s+(liner-shoulder)/upLen*off,shoulder+(liner-shoulder)*s-toe/upLen*off];
  const at=(x,[z,yy])=>[x,y+yy,z];
  const stud=(x,point)=>{const [,py,pz]=at(x,point);ball(root,m.metal,x,py,pz,.011,.011,.011).name='Panel fastener';};
  const accessPanel=(slope,x0,x1,s0,s1,name)=>{
    panel(graphite,x0,x1,slope(s0,.012),slope(s1,.012),.024,name);
    const ds=.035/(slope===lower?lowLen:upLen);
    for(const x of [x0+.03,x1-.03])for(const s of [s0+ds,s1-ds])stud(x,slope(s,.026));
  };
  // Upper slope: two long tanks lying along the room, strapped into saddles.
  const tankR=.15,tankS=.42,[tankZ,tankY]=upper(tankS,tankR+.035);
  const lineA=upper(.84,.04),lineB=upper(.93,.032);
  for(const [x0,x1,band,valveSide] of [[13.82,14.94,m.yellow,1],[15.76,16.88,m.teal??m.yellow,-1]]){
    const body=cylinder(root,shell,(x0+x1)/2,y+tankY,tankZ,tankR,x1-x0-tankR*1.2,tankR,20);body.rotation.z=Math.PI/2;body.name='Ready room gas tank';
    for(const x of [x0+tankR*.6,x1-tankR*.6])ball(root,shell,x,y+tankY,tankZ,tankR*.6,tankR,tankR).name='Gas tank end';
    const mark=cylinder(root,band,(x0+x1)/2-valveSide*.30,y+tankY,tankZ,tankR+.003,.13,tankR+.003,20);mark.rotation.z=Math.PI/2;mark.name='Gas tank band';
    for(const x of [x0+.26,x1-.26]){
      const strap=cylinder(root,m.metal,x,y+tankY,tankZ,tankR+.007,.045,tankR+.007,20);strap.rotation.z=Math.PI/2;strap.name='Gas tank strap';
      panel(m.dark,x-.045,x+.045,upper(tankS-.17,.03),upper(tankS+.17,.03),.06,'Gas tank saddle');
    }
    // valve at the inner end, and the line up to the main
    const vx=valveSide>0?x1:x0,neck=cylinder(root,m.metal,vx+valveSide*.035,y+tankY,tankZ,.035,.07,.035,10);neck.rotation.z=Math.PI/2;neck.name='Gas tank valve';
    const hand=add(new THREE.Mesh(new THREE.TorusGeometry(.045,.008,6,10),m.red),'Gas tank valve wheel');hand.position.set(vx+valveSide*.075,y+tankY,tankZ);hand.rotation.y=Math.PI/2;
    pipe(root,m.metal,[[vx+valveSide*.05,y+tankY,tankZ],at(vx+valveSide*.11,upper(tankS+.10,tankR+.035)),at(vx+valveSide*.13,upper(.66,.06)),at(vx+valveSide*.13,lineA)],.014).name='Gas tank feed line';
  }
  // Two mains along the top of the slope, clamped; one drops to the equalisation panel.
  rod(root,m.metal,at(left+.15,lineA),at(right-.15,lineA),.022).name='Ready room gas main';
  rod(root,m.yellow,at(left+.15,lineB),at(right-.15,lineB),.015).name='Ready room gas main';
  for(let x=left+.42;x<right-.3;x+=.69)panel(m.dark,x-.025,x+.025,upper(.79,.035),upper(.97,.035),.07,'Gas main clamp');
  pipe(root,m.metal,[at(plateX,lineA),at(plateX,upper(.45,.035)),at(plateX,upper(.06,.035)),[plateX,y+shoulder-.12,wall+.035],[plateX,y+1.985,wall+.035]],.016).name='Equalisation feed line';
  const tee=cylinder(root,m.dark,plateX,y+lineA[1],lineA[0],.032,.07,.032,10);tee.rotation.z=Math.PI/2;tee.name='Gas main tee';
  // Between the tanks: three access panels, the middle one with a status slit.
  for(const [i,x0] of [15.05,15.26,15.47].entries()){
    accessPanel(upper,x0,x0+.17,.12,.66,'Ready room access panel');
    if(i===1)panel(glow,x0+.045,x0+.125,upper(.50,.027),upper(.53,.027),.006,'Ready room light line');
    else for(let k=0;k<4;k++)panel(m.dark,x0+.03,x0+.14,upper(.22+k*.10,.03),upper(.27+k*.10,.03),.012,'Access panel louvre');
  }
  // At the outer end: the junction box the mains run into.
  panel(m.dark,16.99,17.30,upper(.18,.055),upper(.62,.055),.11,'Gas main junction box');
  panel(glow,17.05,17.24,upper(.50,.113),upper(.525,.113),.006,'Ready room light line');
  for(const x of [17.08,17.21])pipe(root,m.metal,[at(x,upper(.62,.06)),at(x,upper(.74,.07)),at(x,lineA)],.012).name='Gas tank feed line';
  // Lower slope, left of the bench: two bottles leaning in a cradle, piped to the panel above.
  const bottleR=.095,bottleL=.46,slopeDir=[-toe/lowLen,(knee-.02)/lowLen];
  for(const [i,x] of [13.50,13.76].entries()){
    const [cz,cy]=lower(.52,bottleR+.03),tip=d=>[x,y+cy+slopeDir[1]*d,cz+slopeDir[0]*d];
    const body=cylinder(root,shell,x,y+cy,cz,bottleR,bottleL,bottleR,16);body.rotation.x=lowTilt;body.name='Ready room gas bottle';
    for(const d of [-bottleL/2,bottleL/2]){const cap=ball(root,shell,...tip(d),bottleR,bottleR*.6,bottleR);cap.rotation.x=lowTilt;cap.name='Gas bottle end';}
    const mark=cylinder(root,i?m.red:m.yellow,...tip(.10),bottleR+.003,.09,bottleR+.003,16);mark.rotation.x=lowTilt;mark.name='Gas bottle band';
    const strap=cylinder(root,m.metal,...tip(-.08),bottleR+.007,.04,bottleR+.007,16);strap.rotation.x=lowTilt;strap.name='Gas bottle strap';
    const neck=cylinder(root,m.metal,...tip(bottleL/2+.085),.028,.07,.028,10);neck.rotation.x=lowTilt;neck.name='Gas bottle valve';
    const end=plateX+(i?.07:-.07);
    pipe(root,m.metal,[tip(bottleL/2+.11),[x,y+knee+.10,wall+.07],[end,y+1.0,wall+.04],[end,y+1.165,wall+.04]],.012).name='Gas bottle feed line';
  }
  panel(m.dark,13.37,13.89,lower(.16,.02),lower(.26,.02),.07,'Gas bottle cradle');
  panel(m.dark,13.37,13.89,lower(.44,.02),lower(.50,.02),.05,'Gas bottle cradle');
  accessPanel(lower,13.97,14.27,.16,.84,'Ready room access panel');
  rod(root,m.metal,at(14.03,lower(.62,.06)),at(14.21,lower(.62,.06)),.012).name='Access panel handle';
  for(const x of [14.03,14.21])rod(root,m.metal,at(x,lower(.62,.024)),at(x,lower(.62,.06)),.008);
  // Right of the bench: a louvred panel and a service panel with handles.
  accessPanel(lower,16.44,16.84,.14,.86,'Ready room access panel');
  for(let k=0;k<5;k++)panel(m.dark,16.50,16.78,lower(.26+k*.11,.03),lower(.32+k*.11,.03),.012,'Access panel louvre');
  accessPanel(lower,16.92,17.30,.14,.86,'Ready room access panel');
  for(const s of [.36,.70]){
    rod(root,m.metal,at(17.00,lower(s,.06)),at(17.22,lower(s,.06)),.012).name='Access panel handle';
    for(const x of [17.00,17.22])rod(root,m.metal,at(x,lower(s,.024)),at(x,lower(s,.06)),.008);
  }
  panel(glow,17.02,17.20,lower(.52,.027),lower(.545,.027),.006,'Ready room light line');
  // A conduit along the foot of the slope, behind the bench.
  rod(root,m.metal,at(left+.15,lower(.07,.045)),at(right-.15,lower(.07,.045)),.03).name='Ready room conduit';
  for(let x=left+.42;x<right-.3;x+=.69)panel(m.dark,x-.025,x+.025,lower(.02,.04),lower(.12,.04),.085,'Conduit clamp');

  // ---- Tether station (right of the viewport): three safety tethers on a rail
  const railY=y+1.98,railZ=wall+.07,railX=right-.44;
  rod(root,m.metal,[railX-.30,railY,railZ],[railX+.30,railY,railZ],.016).name='Harness rail';
  for(const dx of [-.27,.27])rod(root,m.dark,[railX+dx,railY,railZ],[railX+dx,railY,wall],.012);
  for(const dx of [-.20,0,.20]){
    const x=railX+dx;
    box(root,m.metal,x,railY-.03,railZ+.012,.03,.06,.02).name='Tether hook';
    pipe(root,m.yellow,[[x-.012,railY-.05,railZ+.02],[x-.05,railY-.36,railZ+.04],[x,railY-.60,railZ+.05],[x+.05,railY-.36,railZ+.04],[x+.012,railY-.05,railZ+.02]],.011).name='Safety tether';
    box(root,m.metal,x,railY-.625,railZ+.05,.035,.07,.018).name='Tether carabiner';
  }

  // ---- Octagonal stand pad on the floor and the light panel above it
  const side=2*pad*Math.tan(Math.PI/8);
  for(let k=0;k<8;k++){
    const a=k*Math.PI/4,segment=box(root,m.yellow,cx+pad*Math.cos(a),y+.004,depth+pad*Math.sin(a),side+.045,.006,.045);
    segment.rotation.y=Math.atan2(-Math.cos(a),-Math.sin(a));segment.name='Ready room stand pad';
  }
  const lightSize=2*pad*.80,trim=octagon(new THREE.Shape(),lightSize+.14,lightSize+.14,(lightSize+.14)*.293,cx,depth);
  trim.holes.push(octagon(new THREE.Path(),lightSize,lightSize,lightSize*.293,cx,depth));
  const ring=extrude(trim,m.dark,0,.03,'Ready room ceiling light trim');ring.rotation.x=Math.PI/2;ring.position.set(0,y+liner+.004,0);
  const lamp=add(new THREE.Mesh(new THREE.ShapeGeometry(octagon(new THREE.Shape(),lightSize,lightSize,lightSize*.293,cx,depth)),panelGlow),'Ready room ceiling light');
  lamp.rotation.x=Math.PI/2;lamp.position.y=y+liner-.004;

  // ---- At the outer hatch: hazard blocks on the floor, grab rails either side
  for(let i=0;i<6;i++)box(root,i%2?m.dark:m.yellow,right-.34,y+.004,depth-.625+i*.25,.16,.008,.25).name='Outer hatch hazard marking';
  for(const z of [depth-.86,depth+.86]){
    rod(root,m.metal,[right-.06,y+.95,z],[right-.06,y+1.75,z],.018).name='Outer hatch grab rail';
    for(const yy of [y+.95,y+1.75])rod(root,m.dark,[right-.06,yy,z],[right-.06+.06,yy,z],.012);
  }
  return root;
}
