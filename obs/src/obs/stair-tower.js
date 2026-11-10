import * as THREE from 'three';
import {box,rod,pipe,cylinder,batchStatic} from './materials.js';
import {STAIRS} from './stair-route.js';
import {CABIN_AISLE} from './layout.js';
import {CABIN_LIGHT_COLOR} from './lighting.js';
import {cableRun} from './industrial.js';

function beam(parent,mat,a,b,w=.10,d=.14){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),mesh=box(parent,mat,...from.clone().add(to).multiplyScalar(.5).toArray(),w,from.distanceTo(to),d);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());return mesh;
}
// Batched tower for the stair study.
export function createStairStructure(m){
  const root=createStairTowerGroup(m);
  const mesh=batchStatic(root);mesh.name=root.name;return mesh;
}
// The tower continues the cabin aisle on the same lines: its rear lining is
// flush with the cabin's rear wall and its floors reach the same deck front,
// where the character view's window wall continues across it.
export const STAIR_TOWER=Object.freeze({
  rearWallZ:-1.62,                 // cabin rear wall face is at z=-1.606
  deckBack:CABIN_AISLE.deckBack,deckFront:CABIN_AISLE.deckFront,
  cabinEdgeX:-12.873,              // left edge of the cabin's deck plates
  innerLeft:STAIRS.outerLeft+.065, // inner face of the outer wall lining
});
const DECK_HEIGHT=STAIRS.rise*20;
// Heights of a tower serving `levels` decks from the bottom one: its decks,
// the top of its walls and the ceiling over its top deck. The full tower
// reaches the cabin roof; a two-deck tower (the right one) ends under the
// operations deck, whose floor slab becomes its roof.
function towerLevels(levels){
  const deckY=[...Array(levels).keys()].map(level=>level*DECK_HEIGHT),topLevel=levels-1;
  const full=levels===3,roofFloor=levels*DECK_HEIGHT;
  // The walls end under the roof (cabin roof / deck slab), never inside it:
  // faces of two parts in one plane flicker when the camera moves.
  const ceiling=full?10.18:roofFloor-.33;
  return {deckY,topLevel,topY:topLevel*DECK_HEIGHT,full,roofFloor,
    wallTop:ceiling,  // linings, ribs and columns end here
    ceiling};         // underside of the roof
}

// Unbatched tower, for a ship builder that batches its whole static root.
// `levels`: 3 = the left tower between all decks; 2 = between LEVEL 3 and
// LEVEL 2 only (built on the left and mirrored to the right end).
export function createStairTowerGroup(materials,{levels=3}={}){
  const root=new THREE.Group();root.name=levels===3?'Left pressure stair tower / 20 risers per deck':'Two-deck pressure stair tower / 20 risers per deck';
  const {deckY:DECK_Y,topLevel,topY,full,wallTop,roofFloor}=towerLevels(levels);
  // A deck: structure with the walking surface on top of it (stacked, not
  // sunk into it, and a few millimetres inside its edges where they show).
  const slab=(x0,x1,y,z0,z1,name)=>{
    const structure=box(root,dark,(x0+x1)/2,y-.183,(z0+z1)/2,x1-x0,.294,z1-z0),surface=box(root,steel,(x0+x1)/2,y-.01825,(z0+z1)/2,x1-x0-.008,.0355,z1-z0-.008);
    if(name){structure.name=`${name} structure`;surface.name=name==='Level landing'?'Level landing walking surface':name;}
    return surface;
  };
  const m=Object.assign(Object.create(materials),{
    cable:materials.cable??materials.dark,pipeSteel:materials.pipeSteel??materials.metal,
    rubber:materials.rubber??materials.dark,brass:materials.brass??materials.metal,
  });
  const {right,left,front,back,width,rise,outerLeft}=STAIRS,zc=(front+back)/2;
  const {rearWallZ,deckBack,deckFront,cabinEdgeX,innerLeft}=STAIR_TOWER;
  const steel=m.metal,paint=m.enamel,dark=m.dark,safety=m.yellow;
  const slabEdge=-12.915,plateEdge=-12.880; // left edges of the cabin's own deck slabs and deck plates
  // Pressure linings: rear wall on the cabin's rear wall line, outer end wall.
  // It ends behind the cabin's first rear rib, where the cabin's own wall panels begin.
  const liningRight=-12.62;
  // The rear lining, the outer lining and the dark outer wall meet edge to
  // edge (no part inside another), and the dark wall stops just behind the
  // linings' front edge.
  const wallMid=(wallTop-.40)/2,wallHeight=wallTop+.40,liningOuter=outerLeft-.035;
  box(root,paint,(liningOuter+liningRight)/2,wallMid,rearWallZ-.09,liningRight-liningOuter,wallHeight,.18);
  box(root,dark,liningOuter-.09,wallMid,(rearWallZ-.37+deckFront-.006)/2,.18,wallHeight,deckFront-.006-rearWallZ+.37);
  box(root,paint,outerLeft+.015,wallMid,(rearWallZ+deckFront)/2,.10,wallHeight,deckFront-rearWallZ);
  const roofLeft=outerLeft-.225,roofBack=-1.92,roofFront=deckFront,roofZ=(roofBack+roofFront)/2;
  if(full){
    // Continue the cabin's structural roof and ivory skin at their exact heights.
    // Their left edges differ in the original roof; meet each layer separately.
    box(root,dark,(roofLeft-13.45)/2,10.31,roofZ,-13.45-roofLeft,.26,roofFront-roofBack,.05);
    // (the skin overhangs the structure's end by 12 mm, so their end faces are not in one plane)
    box(root,paint,(roofLeft-.012-13.30)/2,10.48,(roofFront-1.87)/2,-13.30-roofLeft+.012,.19,roofFront+1.87,.035);
  }else{
    // The deck slab above closes the tower: the same structure as a landing,
    // from the cabin edge to the outer wall, over the full aisle depth.
    // (it meets the cabin's own deck slab at x=slabEdge and leaves the top 3.6 cm to the deck plates)
    box(root,dark,(roofLeft+slabEdge)/2,roofFloor-.183,roofZ,slabEdge-roofLeft,.294,roofFront-roofBack,.025).name='Tower roof slab';
  }
  // Corner columns at the outer wall only: the cabin side stays fully open.
  const columnX=outerLeft+.16;
  for(const z of [rearWallZ+.09,2.42]){
    beam(root,dark,[columnX,-.22,z],[columnX,wallTop,z],.16,.17);
    for(const y of DECK_Y){
      box(root,steel,columnX,y-.18,z,.36,.10,.34);
      for(const dx of [-.12,.12])for(const dz of [-.12,.12])box(root,dark,columnX+dx,y-.12,z+dz,.035,.028,.035);
    }
  }
  // LEVEL 3: extend the existing cabin aisle under the whole stair tower.
  // End at the landing edge so the two flush surfaces never overlap.
  const floorLeft=outerLeft+.065,floorRight=-13.575;
  const floorX=(floorLeft+floorRight)/2,floorZ=(deckBack+deckFront)/2;
  slab(floorLeft,floorRight,0,deckBack,deckFront);
  box(root,dark,(floorLeft-13.11)/2,-.18,deckFront-.01,-13.11-floorLeft,.38,.20,.02);
  for(let x=-13.64;x>floorLeft+.12;x-=.42){
    for(const z of [-1.40,-.75,.1,.8,2.20])box(root,m.rubber,x,.005,z,.18,.012,.021);
    box(root,m.rubber,x,-.19,deckFront+.11,.20,.105,.012,.009);
  }
  DECK_Y.forEach((y,level)=>{
    // The rear flight arrives at x=right. Its floor must start there:
    // extending the slab left over the ninth tread buries a small animal.
    // Each landing meets the cabin deck plates edge to edge over the full
    // aisle depth, so the entrance has no step, slot or narrowing.
    const arrivalFront=back+width/2+.035;
    const landingParts=level===0?
      [{left:-13.575,back:deckBack,front:deckFront}]:
      [{left:right,back:deckBack,front:arrivalFront},{left:-13.575,back:arrivalFront,front:deckFront}];
    // (structure up to the cabin's deck slab, surface up to the cabin's deck plates)
    for(const part of landingParts){
      const zz=(part.back+part.front)/2,depth=part.front-part.back;
      box(root,dark,(part.left+slabEdge)/2,y-.183,zz,slabEdge-part.left,.294,depth).name='Level landing structure';
      box(root,steel,(part.left+plateEdge)/2,y-.01825,zz,plateEdge-part.left,.0355,depth-.008).name='Level landing walking surface';
    }
    // On the upper decks a narrow sill carries the front wall across the stairwell.
    if(level>0){
      const sillBack=front+width/2+.09,x=(innerLeft-13.575)/2,w=-13.575-innerLeft,zz=(sillBack+deckFront)/2;
      box(root,dark,x,y-.183,zz,w,.294,deckFront-sillBack).name='Front wall sill structure';
      box(root,steel,x,y-.01825,zz,w-.008,.0355,deckFront-sillBack-.008).name='Front wall sill';
      box(root,safety,x,y+.002,sillBack+.03,w,.004,.05);
      // A ledge closes the slot between the arriving rear flight and the wall.
      const ledgeFront=back-width/2-.09,lx=(innerLeft+right)/2,lw=right-innerLeft,lz=(rearWallZ+ledgeFront)/2;
      box(root,dark,lx,y-.183,lz,lw,.294,ledgeFront-rearWallZ).name='Rear wall ledge structure';
      box(root,steel,lx,y-.01825,lz,lw-.008,.0355,ledgeFront-rearWallZ-.008).name='Rear wall ledge';
    }
    for(const z of [deckBack+.26,deckFront-.08])beam(root,dark,[outerLeft,y-.17,z],[-12.42,y-.17,z],.15,.15);
    if(level===topLevel)return;
    const mid=y+rise*10;
    // Half landing reaches the rear lining, so no slot opens behind it.
    const landingBack=rearWallZ,landingFront=front+width/2+.10;
    // (from the outer lining's inner face; the plate on top of the structure)
    box(root,dark,(innerLeft+left)/2,mid-.162,(landingBack+landingFront)/2,left-innerLeft,.236,landingFront-landingBack);
    box(root,steel,(innerLeft+left)/2,mid-.022,(landingBack+landingFront)/2,left-innerLeft-.008,.044,landingFront-landingBack-.008);
    for(const half of [0,1]){
      const start=half===0?right:left,end=half===0?left:right,z=half===0?front:back,base=y+half*rise*10,sign=Math.sign(end-start);
      for(let i=1;i<=9;i++){
        const x=start+sign*(i-.5)*STAIRS.tread,top=base+i*rise;
        // Open risers, as on a ship's steel stair: treads only, carried by the stringers.
        box(root,steel,x,top-.028,z,STAIRS.tread,.056,width);
        box(root,safety,start+sign*((i-1)*STAIRS.tread+.024),top+.003,z,.028,.006,width-.06);
        if(i%2===1)for(const side of [-1,1]){
          const zz=z+side*(width/2+.035);
          rod(root,dark,[x,top-.04,zz],[x,top+.98,zz],.022);
          box(root,steel,x,top-.044,zz,.12,.055,.11);
        }
      }
      for(const side of [-1,1]){
        const zz=z+side*(width/2+.035);
        beam(root,dark,[start,base-.13,zz],[end,base+rise*10-.13,zz],.10,.17);
        rod(root,steel,[start,base+.96,zz],[end,base+rise*10+.96,zz],.028);
        // Low continuous curb keeps paws and dropped objects inside the stair.
        beam(root,paint,[start,base+.09,zz],[end,base+rise*10+.09,zz],.10,.10);
      }
    }
  });
  // Top deck: guard the unused front edge, leaving the rear stair arrival open.
  const guardX=-13.54,guardBack=.435,guardFront=2.30;
  rod(root,steel,[guardX,topY+.98,guardBack],[guardX,topY+.98,guardFront],.028);
  rod(root,steel,[guardX,topY+.98,guardBack],[right,topY+.96,guardBack],.028);
  for(const z of [guardBack,1.05,1.67,guardFront]){
    rod(root,dark,[guardX,topY,z],[guardX,topY+.98,z],.022);
    box(root,steel,guardX,topY+.012,z,.13,.024,.13);
  }
  box(root,paint,guardX,topY+.055,(guardBack+guardFront)/2,.075,.11,guardFront-guardBack);
  const services=new THREE.Group();services.name='Stair tower services';root.add(services);
  addTowerServices(services,m,levels);
  return root;
}

// Industrial fit-out: ribs, seams, pipe and cable runs and caged wall lamps.
// Everything stays outside the walking paths (stair flights, turn landings and
// the entrance arcs reach z>-1.09 and x>-17.2).
function addTowerServices(root,m,levels=3){
  const {rise,outerLeft,right,left}=STAIRS;
  const {rearWallZ:wall,innerLeft,deckFront}=STAIR_TOWER;
  const {deckY:DECK_Y,topLevel,ceiling:top}=towerLevels(levels),turnLandings=DECK_Y.slice(0,topLevel).map(y=>y+rise*10);
  const lens=new THREE.MeshBasicMaterial({name:'Stair tower lamp lens',color:CABIN_LIGHT_COLOR,toneMapped:false});
  lens.userData.castShadow=false;
  // Rear wall: frame ribs, seams and a deck band at every level.
  for(const x of [-14.62,-16.38]){
    box(root,m.dark,x,(top-.18)/2,wall+.13,.22,top+.22,.26).name='Stair tower rear rib';
    box(root,m.enamel,x,(top-.18)/2,wall+.27,.12,top+.12,.05);
    for(let y=.6;y<top-.18;y+=1.13){
      box(root,m.pipeSteel,x,y,wall+.32,.28,.12,.08);
      for(const dx of [-.09,.09]){const bolt=cylinder(root,m.metal,x+dx,y,wall+.37,.022,.02,.022,6);bolt.rotation.x=Math.PI/2;}
    }
  }
  for(const x of [-13.85,-15.5,-17.1])box(root,m.dark,x,(top-.12)/2,wall+.006,.015,top+.12,.009);
  for(const y of [...DECK_Y,...turnLandings])box(root,m.dark,(innerLeft+STAIR_TOWER.cabinEdgeX)/2,y+2.98,wall+.03,STAIR_TOWER.cabinEdgeX-innerLeft,.16,.06);
  // Outer wall: corner frames out of the turn landings' reach and a deck band.
  for(const z of [wall+.30,2.12]){
    box(root,m.dark,innerLeft+.11,(top-.18)/2,z,.22,top+.22,.24).name='Stair tower end frame';
    box(root,m.enamel,innerLeft+.24,(top-.18)/2,z,.05,top+.12,.12);
  }
  for(const y of DECK_Y)box(root,m.dark,innerLeft+.03,y+2.98,(wall+deckFront)/2,.06,.16,deckFront-wall);
  // Main riser: three insulated pipes from the bottom deck to the roof, clear
  // of the arriving rear flights, with collars and brackets.
  for(const [i,x] of [-14.02,-14.18,-14.34].entries()){
    const r=i===1?.052:.042,z=wall+.17;
    rod(root,i===1?m.brass:m.pipeSteel,[x,-.25,z],[x,top+.10,z],r);
    for(const y of DECK_Y)cylinder(root,m.metal,x,y+.30,z,r*1.45,.07,r*1.45,12).name='Riser collar';
  }
  for(let y=.75;y<top;y+=1.12){
    box(root,m.dark,-14.18,y,wall+.07,.52,.07,.10).name='Riser bracket';
    box(root,m.metal,-14.18,y,wall+.17,.50,.035,.14);
  }
  // Black cable bundle up the rear wall to the roof.
  for(let i=0;i<5;i++){
    const x=-15.89-i*.055;
    rod(root,m.cable,[x,-.20,wall+.10+(i%2)*.012],[x,top,wall+.10+(i%2)*.012],.018+(i%2)*.006);
  }
  for(let y=.55;y<top;y+=1.05)box(root,m.metal,-16.0,y,wall+.12,.36,.06,.10).name='Cable bundle clamp';
  DECK_Y.forEach((y,level)=>{
    const ceiling=level===topLevel?top:y+3.062;
    // The hoses removed with the old side wall come back on the rear corner:
    // up from the floor, then over the doorway along the rear wall.
    for(let i=0;i<4;i++){
      const x=-13.04-i*.062,z=wall+.11+(i%2)*.012,turn=y+2.62-i*.045,end=-13.70+i*.02;
      pipe(root,m.cable,[[x,y+.02,wall+.40],[x,y+.30,z],[x,turn-.14,z],[x-.14,turn,z],[end,turn,z]],.022+(i%2)*.005);
    }
    for(const h of [.49,1.69])box(root,m.metal,-13.133,y+h,wall+.12,.276,.08,.10);
    box(root,m.dark,-13.80,y+2.55,wall+.10,.28,.36,.16).name='Cable junction box';
    // Overhead bundle continues the cabin's front cable run into the tower.
    const z=CABIN_AISLE.deckFront-.21;
    cableRun(root,m,-12.95,-15.25,y+3.18,z,4,.40,ceiling);
    cableRun(root,m,-15.25,innerLeft+.05,y+3.12,z+.02,3,.32,ceiling);
    if(level===topLevel)return;
    // Cable tray on the outer wall, high above each turn landing.
    const trayY=y+rise*10+2.75,z0=wall+.48,z1=1.96;
    box(root,m.dark,innerLeft+.12,trayY,(z0+z1)/2,.22,.05,z1-z0).name='Outer wall cable tray';
    for(let zz=z0+.1;zz<z1;zz+=.5)box(root,m.metal,innerLeft+.12,trayY-.05,zz,.24,.12,.04);
    for(let i=0;i<2;i++){
      const x=innerLeft+.06+i*.07,yy=trayY+.05+i*.035;
      pipe(root,m.cable,[[x,yy,z0],[x+.02,yy-.03,(z0*2+z1)/3],[x+.02,yy-.02,(z0+z1*2)/3],[x,yy,z1]],.02+(i%2)*.006);
    }
  });
  // Guarded tube lights: upright beside each entrance, level over each rear
  // flight and on the outer wall above each turn landing. They are fittings
  // only: their tubes glow, but they add no light source and no pool of light.
  const lamps=[];
  for(const y of DECK_Y)lamps.push({x:-13.45,y:y+1.72,z:wall,upright:true});
  for(const y of DECK_Y.slice(0,topLevel)){
    const x=-15.275,flight=y+rise*10+rise*10*(x-left)/(right-left);
    lamps.push({x,y:flight+2.25,z:wall});
    lamps.push({x:innerLeft,y:y+rise*10+2.15,z:.65,outer:true});
  }
  for(const lamp of lamps){
    const group=guardedTubeLight(root,m,lens,{upright:lamp.upright});
    group.position.set(lamp.x,lamp.y,lamp.z);
    if(lamp.outer)group.rotation.y=Math.PI/2;
  }
}

// Wall-mounted tube light behind a wire guard, as fitted in plant rooms: a
// channel on the wall, a round cast end cap at each end, the glowing tube, and
// a guard of half hoops joined by three long wires. Local frame: the tube runs
// along x and the wall is the plane z=0.
const TUBE_LIGHT=Object.freeze({length:1.0,tubeZ:.10,guardZ:.05,guardRadius:.10,hoops:8});
let hoopGeometry=null;
const HOOP_BASIS=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0));
export function guardedTubeLight(parent,m,lens,{upright=false}={}){
  const {length,tubeZ,guardZ,guardRadius,hoops}=TUBE_LIGHT,capX=length/2-.035,guardHalf=capX-.075;
  const group=new THREE.Group();group.name='Stair tower guarded tube light';parent.add(group);
  box(group,m.dark,0,0,.022,length,.14,.044).name='Tube light wall channel';
  box(group,m.enamel,0,0,.05,length-.16,.11,.012).name='Tube light reflector';
  for(const side of [-1,1]){
    const cap=cylinder(group,m.dark,side*capX,0,tubeZ,.082,.07,.082,12);cap.rotation.z=Math.PI/2;cap.name='Tube light end cap';
    box(group,m.metal,side*(capX-.12),0,.012,.05,.20,.024).name='Tube light wall lug';
  }
  const tube=cylinder(group,lens,0,0,tubeZ,.03,capX*2-.07,.03,8);tube.rotation.z=Math.PI/2;tube.name='Stair tower lamp lens';
  hoopGeometry??=new THREE.TorusGeometry(guardRadius,.006,3,6,Math.PI);
  for(let i=0;i<hoops;i++){
    const hoop=new THREE.Mesh(hoopGeometry,m.metal);hoop.name='Tube light guard hoop';
    hoop.position.set(-guardHalf+i*guardHalf*2/(hoops-1),0,guardZ);hoop.quaternion.setFromRotationMatrix(HOOP_BASIS);group.add(hoop);
  }
  for(const angle of [Math.PI/4,Math.PI/2,Math.PI*3/4])
    box(group,m.metal,0,Math.cos(angle)*guardRadius,guardZ+Math.sin(angle)*guardRadius,guardHalf*2+.07,.009,.009).name='Tube light guard wire';
  // Supply conduit runs up the wall: from the right-hand cap of a level
  // light, straight on from the top cap of an upright one.
  if(upright){box(group,m.pipeSteel,length/2+.13,0,.03,.26,.03,.03).name='Tube light conduit';group.rotation.z=Math.PI/2;}
  else box(group,m.pipeSteel,capX,.31,.03,.03,.50,.03).name='Tube light conduit';
  return group;
}

export function openCabinLeft(ship){return openStairTowerWall(ship.staticMesh);}

// The right stair tower: the left tower's two lower decks seen in a mirror,
// at the right end of LEVEL 3 and LEVEL 2. LEVEL 1 ends there in the airlock,
// so the tower stops under it. Batched geometry is re-wound for the mirror
// (materials.js batchStatic).
export const RIGHT_STAIR_TOWER=Object.freeze({levels:2,floors:[1,2],cabinEdgeX:-STAIR_TOWER.cabinEdgeX});
export function createRightStairTowerGroup(materials){
  const root=new THREE.Group();root.name='Right pressure stair tower / LEVEL 3 to LEVEL 2';
  root.scale.x=-1;root.add(createStairTowerGroup(materials,{levels:RIGHT_STAIR_TOWER.levels}));
  return root;
}
// Remove the right end wall below the operations deck where the right tower
// meets the cabin (the mirror of openStairTowerWall). The airlock end of
// LEVEL 1 and everything above it stays.
export function openRightStairTowerWall(staticRoot,operationsFloor){
  const removed=[];
  for(const object of [...staticRoot.children]){
    const bounds=new THREE.Box3().setFromObject(object);
    if(bounds.isEmpty()||bounds.max.y>operationsFloor+.01)continue;
    const oldWall=bounds.min.x>12.75&&bounds.max.x<14.1;
    const rightHose=object.name==='Side wall thin service pipe'&&bounds.min.x>0;
    const rightHoseClamp=bounds.max.x<12.89&&bounds.min.x>12.55&&
      bounds.min.z>.73&&bounds.max.z<.87&&bounds.max.y-bounds.min.y<.10;
    const height=bounds.max.y-bounds.min.y,braceRod=bounds.max.x<13.06&&bounds.max.x>12.9&&bounds.min.x>12.25&&
      height>.6&&height<.9&&bounds.max.z-bounds.min.z<.12;
    const ribBracket=bounds.max.x<12.8&&bounds.min.x>12.44&&bounds.min.z>-.8&&bounds.max.z<-.6&&
      /pipe casing|brushed steel/i.test(object.material?.name??'');
    const chain=/chain/i.test(object.material?.name??'');
    if((oldWall||rightHose||rightHoseClamp||braceRod||ribBracket)&&!chain){staticRoot.remove(object);removed.push(object.name||object.type);}
  }
  return removed;
}

// Remove the old left wall where the tower meets the cabin, from the direct
// children of an unbatched static root (matrices up to date).
export function openStairTowerWall(staticRoot){
  const removed=[];
  for(const object of [...staticRoot.children]){
    const bounds=new THREE.Box3().setFromObject(object);
    const oldWall=bounds.max.x<-12.75&&bounds.min.x>-14.1;
    // Each deck's exposed hose bundle used to terminate in the removed wall.
    const leftHose=object.name==='Side wall thin service pipe'&&bounds.max.x<0;
    const leftHoseClamp=bounds.min.x>-12.86&&bounds.max.x<-12.55&&
      bounds.min.z>.73&&bounds.max.z<.87&&bounds.max.y-bounds.min.y<.10;
    // The diagonal knee-brace rod of the removed wall section reaches into the
    // cabin; without the wall it would hang in the air at the doorway.
    const height=bounds.max.y-bounds.min.y,braceRod=bounds.min.x>-13.06&&bounds.min.x<-12.9&&bounds.max.x<-12.25&&
      height>.6&&height<.9&&bounds.max.z-bounds.min.z<.12;
    // The rear rib beside the doorway keeps its column; the pipe brackets that
    // stick out of it toward the aisle would brush walkers on the turn landing.
    const ribBracket=bounds.min.x>-12.8&&bounds.max.x<-12.44&&bounds.min.z>-.8&&bounds.max.z<-.6&&
      /pipe casing|brushed steel/i.test(object.material?.name??'');
    // The hanging chain beside the doorway stays whole (its links straddle the cut line).
    const chain=/chain/i.test(object.material?.name??'');
    if((oldWall||leftHose||leftHoseClamp||braceRod||ribBracket)&&!chain){staticRoot.remove(object);removed.push(object.name||object.type);}
  }
  // Keep the stair entrance and turning space clear of the small service bin.
  // The landing enters through the clear forward aisle; rear fixtures stay clear.
  return removed;
}
