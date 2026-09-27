import {Group,MeshBasicMaterial} from 'three';
import {box,cylinder,batchStatic} from './materials.js';
import {CABIN_AISLE,DECK} from './layout.js';
import {FLOOR_Y} from './ship.js';
import {FOOTLIGHT} from './viewing-footlights.js';

export function cabinWallMaterials(ship){
  const found=new Map();
  ship.traverse(mesh=>{for(const material of Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[])found.set(material.name,material);});
  const pick=name=>{
    const material=found.get(`Cabin toon / Industrial / ${name}`)??found.get(`Industrial / ${name}`);
    if(!material)throw new Error(`Missing cabin wall material: ${name}`);
    return material;
  };
  return{enamel:pick('worn ivory'),dark:pick('structural iron'),metal:pick('brushed steel'),rubber:pick('rubber')};
}

export function createViewingWall(m,{mergeStatic=true}={}){
  const root=new Group();root.name='POV / matching cabin enclosure';
  const front=CABIN_AISLE.deckFront,operations=FLOOR_Y[DECK.OPERATIONS];
  const diffuser=new MeshBasicMaterial({name:'POV / concealed footlight diffuser',color:0xffdfb3,toneMapped:false});
  diffuser.userData.castShadow=false;
  const solid=(name,material,x,y,z,w,h,d,r=0)=>{const part=box(root,material,x,y,z,w,h,d,r);part.name=name;return part;};
  solid('Front hull',m.dark,0,4.94,front+.30,26.8,10.69,.19);
  solid('Front lining',m.enamel,0,5,front+.11,26.3,10.2,.22);
  // Match ship.js panel spacing, rubber gasket, ivory face and four corner bolts.
  for(const floor of FLOOR_Y){
    for(let i=0;i<FOOTLIGHT.count;i++){
      const x=FOOTLIGHT.firstX+i*FOOTLIGHT.spacing;
      const y=floor+1.44,z=front-.004;
      // Lift only the panel's lower edge: the light sits behind its face,
      // between the lower panel edge and the flush skirting, with no fixture box.
      solid('Front panel gasket',m.rubber,x,y+.035,z,1.505,2.655,.10,.02);
      solid('Front cabin panel',m.enamel,x,y+.0325,z-.064,1.48,2.635,.06,.025);
      solid('Footlight recess',m.rubber,x,floor+.104,front-.006,1.47,.083,.012);
      solid('Concealed footlight strip',diffuser,x,floor+FOOTLIGHT.y,FOOTLIGHT.wallFaceZ+FOOTLIGHT.inset,FOOTLIGHT.width,FOOTLIGHT.height,.008);
      for(const dx of [-.70,.70])for(const dy of [-1.24,1.31]){
        const bolt=cylinder(root,m.metal,x+dx,y+dy,z-.102,.018,.015,.018,6);bolt.rotation.x=Math.PI/2;
      }
    }
    solid('Front skirting',m.dark,0,floor+.0325,front-.045,26.2,.065,.09);
    solid('Front ceiling seam',m.dark,0,floor+3.02,front-.07,26.2,.16,.14);
  }
  // The original cutaway side walls and roof stop at z=1.595/1.68.
  for(const side of [-1,1]){
    const spans=side===1?[[-.365,operations],[operations+3.242,10.245]]:[[-.365,10.245]];
    for(const [bottom,top]of spans)solid('Side wall return',m.enamel,side*13.07,(bottom+top)/2,(1.57+front)/2,.40,top-bottom,front-1.57);
    solid('Roof return',m.dark,side*7,10.31,(1.65+front)/2,12.9,.26,front-1.65);
  }
  const result=mergeStatic?batchStatic(root):root;result.name=root.name;result.visible=false;return result;
}
