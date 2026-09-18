import {Box3,Group,Vector3} from 'three';
import {hangingSuit} from '../../src/obs/eva-suit.js';

export const STUDY_FOCUS={
  body:{label:'全身',target:[0,1.08,0],height:2.65},
  helmet:{label:'ヘルメット・首',target:[0,1.78,-.04],height:.70},
  gloves:{label:'手袋・手首',target:[.34,1.08,.04],height:.62},
  boots:{label:'ブーツ',target:[0,.17,.035],height:.62},
  backpack:{label:'背面装置',target:[0,1.45,-.22],height:.92},
};
export const STUDY_VIEWS={oblique:{label:'斜め',direction:[.85,.23,1]},front:{label:'正面',direction:[0,0,1]},back:{label:'背面',direction:[0,0,-1]},left:{label:'左側',direction:[-1,0,0]},right:{label:'右側',direction:[1,0,0]}};

export function createStudyModel(materials){
  const root=new Group();root.name='Production EVA suit study';
  const suits=[0,1,2].map(index=>hangingSuit(materials,index));root.add(...suits);
  const hangers=[],surfaces=new Set();
  root.traverse(object=>{
    if(['Suspension support','Suspension hook'].includes(object.name))hangers.push(object);
    if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(!material.name.startsWith('Sign:'))surfaces.add(material);
  });
  function select(mode){
    const active=mode==='red'?1:0;
    suits.forEach((suit,i)=>{suit.visible=mode==='all'||i===active;suit.position.set(mode==='all'?(i-1)*1.06:0,0,0);});
  }
  select('white');hangers.forEach(hanger=>hanger.visible=false);
  return{root,suits,select,setHanger:visible=>hangers.forEach(hanger=>hanger.visible=visible),setWireframe:enabled=>surfaces.forEach(material=>material.wireframe=enabled)};
}

export function studyFraming({focus='body',view='oblique',mode='white',aspect=1,hanger=false}={}){
  const item=STUDY_FOCUS[focus]??STUDY_FOCUS.body,direction=new Vector3(...(STUDY_VIEWS[view]??STUDY_VIEWS.oblique).direction).normalize();
  const target=new Vector3(...item.target);
  if(mode==='all')target.x=0;
  // Keep three suits and the selected detail inside even a narrow viewport.
  const width=mode==='all'?3.12:focus==='body'?1.02:item.height;
  const height=Math.max(item.height+(hanger&&focus==='body'?.28:0),width/Math.max(.2,aspect));
  return{target,position:target.clone().addScaledVector(direction,6),height};
}

export function visibleBounds(root){
  root.updateMatrixWorld(true);const bounds=new Box3();
  root.traverseVisible(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));}});
  return bounds;
}
