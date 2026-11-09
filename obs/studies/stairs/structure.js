import * as THREE from 'three';
import {box,rod,batchStatic} from '../../src/obs/materials.js';
import {STAIRS} from './route.js';

function beam(parent,mat,a,b,w=.10,d=.14){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),mesh=box(parent,mat,...from.clone().add(to).multiplyScalar(.5).toArray(),w,from.distanceTo(to),d);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());return mesh;
}
export function createStairStructure(m){
  const root=new THREE.Group();root.name='Left pressure stair tower / 20 risers per deck';
  const {right,left,front,back,width,rise,outerLeft}=STAIRS,zc=(front+back)/2;
  const steel=m.metal,paint=m.enamel,dark=m.dark,safety=m.yellow;
  // Continuous pressure lining, structural columns and floor-edge ties.
  box(root,paint,(outerLeft+right)/2,5.05,-1.16,right-outerLeft+.45,10.90,.18);
  box(root,dark,outerLeft-.10,5.05,zc,.18,10.90,3.65);
  box(root,paint,outerLeft+.015,5.05,zc,.10,10.90,3.45);
  // Continue the cabin's structural roof and ivory skin at their exact heights.
  // Their left edges differ in the original roof; meet each layer separately.
  const roofLeft=outerLeft-.225,roofBack=-1.92,roofFront=2.55,roofZ=(roofBack+roofFront)/2;
  box(root,dark,(roofLeft-13.45)/2,10.31,roofZ,-13.45-roofLeft,.26,roofFront-roofBack,.05);
  box(root,paint,(roofLeft-13.30)/2,10.48,(roofFront-1.87)/2,-13.30-roofLeft,.19,roofFront+1.87,.035);
  for(const x of [outerLeft+.16,-13.18])for(const z of [-1.05,2.30]){
    beam(root,dark,[x,-.22,z],[x,10.52,z],.16,.17);
    for(const y of [0,3.392,6.784]){
      box(root,steel,x,y-.18,z,.36,.10,.40);
      for(const dx of [-.12,.12])for(const dz of [-.14,.14])box(root,dark,x+dx,y-.12,z+dz,.035,.028,.035);
    }
  }
  // LEVEL 3: extend the existing cabin aisle under the whole stair tower.
  // End at the landing edge so the two flush surfaces never overlap.
  const floorLeft=outerLeft+.065,floorRight=-13.575,floorBack=-1.04,floorFront=2.55;
  const floorX=(floorLeft+floorRight)/2,floorZ=(floorBack+floorFront)/2;
  box(root,dark,floorX,-.17,floorZ,floorRight-floorLeft,.32,floorFront-floorBack,.025);
  box(root,steel,floorX,-.01825,floorZ,floorRight-floorLeft,.0355,floorFront-floorBack);
  box(root,dark,(floorLeft-13.11)/2,-.18,floorFront-.01,-13.11-floorLeft,.38,.20,.02);
  for(let x=-13.64;x>floorLeft+.12;x-=.42){
    for(const z of [-.75,.1,.8,2.20])box(root,m.rubber??dark,x,.005,z,.18,.012,.021);
    box(root,m.rubber??dark,x,-.19,floorFront+.11,.20,.105,.012,.009);
  }
  for(let level=0;level<3;level++){
    const y=level*rise*20;
    // The rear flight arrives at x=right. Its floor must start there:
    // extending the slab left over the ninth tread buries a small animal.
    // Keep the wider forward deck underneath the approved LEVEL 1 guardrail.
    const landingBack=zc-3.25/2,landingFront=zc+3.25/2,arrivalFront=back+width/2+.035;
    const landingParts=level===0?
      [{left:-13.575,back:landingBack,front:landingFront}]:
      [{left:right,back:landingBack,front:arrivalFront},{left:-13.575,back:arrivalFront,front:landingFront}];
    for(const part of landingParts){
      const zz=(part.back+part.front)/2,depth=part.front-part.back;
      box(root,dark,(part.left-12.915)/2,y-.17,zz,-12.915-part.left,.32,depth).name='Level landing structure';
      box(root,steel,(part.left-12.88)/2,y-.01825,zz,-12.88-part.left,.0355,depth).name='Level landing walking surface';
    }
    for(const z of [-1.04,2.34])beam(root,dark,[outerLeft,y-.17,z],[-12.42,y-.17,z],.15,.15);
    // Reinforced openings replace the old continuous left wall.
    for(const [a,b]of [[-1.85,-1.04],[2.30,2.55]])box(root,paint,-13.18,y+1.60,(a+b)/2,.27,3.20,b-a);
    box(root,paint,-13.18,y+2.98,.63,.27,.46,3.34);
    for(const z of [-1.00,2.26]){
      box(root,dark,-13.01,y+1.33,z,.34,2.66,.12);
      box(root,safety,-12.82,y+1.33,z,.025,2.60,.044);
    }
    box(root,dark,-13.01,y+2.66,.63,.34,.12,3.38);
    if(level===2)continue;
    const mid=y+rise*10;
    box(root,dark,(outerLeft+left)/2,mid-.14,zc,left-outerLeft,.28,3.28);
    box(root,steel,(outerLeft+left)/2,mid-.022,zc,left-outerLeft,.044,3.28);
    for(const half of [0,1]){
      const start=half===0?right:left,end=half===0?left:right,z=half===0?front:back,base=y+half*rise*10,sign=Math.sign(end-start);
      for(let i=1;i<=9;i++){
        const x=start+sign*(i-.5)*STAIRS.tread,top=base+i*rise;
        box(root,steel,x,top-.028,z,STAIRS.tread,.056,width);
        box(root,dark,start+sign*(i-1)*STAIRS.tread,top-rise/2-.028,z,.018,rise-.056,width);
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

  }
  // LEVEL 1: guard the unused front edge, leaving the rear stair arrival open.
  const topY=rise*40,guardX=-13.54,guardBack=.435,guardFront=2.30;
  rod(root,steel,[guardX,topY+.98,guardBack],[guardX,topY+.98,guardFront],.028);
  rod(root,steel,[guardX,topY+.98,guardBack],[right,topY+.96,guardBack],.028);
  for(const z of [guardBack,1.05,1.67,guardFront]){
    rod(root,dark,[guardX,topY,z],[guardX,topY+.98,z],.022);
    box(root,steel,guardX,topY+.012,z,.13,.024,.13);
  }
  box(root,paint,guardX,topY+.055,(guardBack+guardFront)/2,.075,.11,guardFront-guardBack);
  // A few seam lines in the new lining; no random replacement panels.
  for(const x of [outerLeft+1.2,outerLeft+2.4,outerLeft+3.6])box(root,dark,x,5.03,-1.055,.015,10.3,.009);
  const mesh=batchStatic(root);mesh.name=root.name;return mesh;
}

export function openCabinLeft(ship){
  const removed=[];
  for(const object of [...ship.staticMesh.children]){
    const bounds=new THREE.Box3().setFromObject(object);
    const oldWall=bounds.max.x<-12.75&&bounds.min.x>-14.1;
    // Each deck's exposed hose bundle used to terminate in the removed wall.
    const leftHose=object.name==='Side wall thin service pipe'&&bounds.max.x<0;
    const leftHoseClamp=bounds.min.x>-12.86&&bounds.max.x<-12.55&&
      bounds.min.z>.73&&bounds.max.z<.87&&bounds.max.y-bounds.min.y<.10;
    if(oldWall||leftHose||leftHoseClamp){ship.staticMesh.remove(object);removed.push(object.name||object.type);}
  }
  // Keep the stair entrance and turning space clear of the small service bin.
  // The landing enters through the clear forward aisle; rear fixtures stay clear.
  return removed;
}
