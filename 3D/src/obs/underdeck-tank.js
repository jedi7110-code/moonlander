import {Group} from 'three';
import {box,cylinder,pipe} from './materials.js';
import {addTankCaution} from './equipment-labels.js';

// Decorative service vessel connected to the underdeck pipework. The scene
// does not specify a fluid or operating pressure; the stencil makes no such claim.
export function createUnderdeckServiceTank(m,length=2.6){
  const root=new Group();root.name='Underdeck service tank';
  const tank=cylinder(root,m.pipeSteel,0,0,0,.28,length,.28,16);tank.rotation.z=Math.PI/2;
  for(const x of [-length*.34,length*.34]){
    const strap=cylinder(root,m.dark,x,0,0,.296,.10,.296,16);strap.rotation.z=Math.PI/2;
    box(root,m.dark,x,.38,0,.09,.25,.67);
  }
  for(const side of [-1,1]){
    const cap=cylinder(root,m.enamel,side*length/2,0,0,.24,.09,.24,16);cap.rotation.z=Math.PI/2;
    pipe(root,m.brass,[[side*length/2,0,0],[side*(length/2+.19),0,0],[side*(length/2+.19),.37,0]],.048);
  }
  addTankCaution(root,m);return root;
}
