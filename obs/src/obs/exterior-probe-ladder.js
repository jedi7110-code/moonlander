import * as THREE from 'three';

// Exterior-only replacement: the playable Moonlander keeps its boarding ladder.
export function createProbeLadder(lander,m,{box,rod,bake}){
  const old=lander.userData.ladder;
  old.removeFromParent();
  const retired=new Set();old.traverse(mesh=>{if(mesh.isMesh&&!retired.has(mesh.geometry)){retired.add(mesh.geometry);mesh.geometry.dispose();}});
  const root=new THREE.Group();root.name='Probe telescopic boarding ladder';lander.add(root);
  const stages=[];
  // An open cassette leaves the original inspection cover accessible from below.
  for(const side of [-1,1]){
    box(root,m.steel,[side*.64,2.20,2.19],[.12,1.02,.35],'Ladder cassette cheek');
    rod(root,m.steel,[side*.55,2.61,1.93],[side*.55,2.61,2.23],.05,'Ladder cassette bracket');
    box(root,m.dark,[side*.64,1.82,2.39],[.14,.13,.07],'Ladder stowage latch');
    box(root,m.patch,[side*.64,2.51,2.39],[.08,.12,.025],'Ladder lock witness');
  }
  box(root,m.steel,[0,2.67,2.22],[1.40,.12,.38],'Ladder cassette head');
  rod(root,m.pipe,[-.52,2.60,2.25],[.52,2.60,2.25],.065,'Ladder drive shaft');
  for(let index=0;index<3;index++){
    const stage=new THREE.Group(),width=1.08-index*.14;
    stage.name=`Ladder sliding stage ${index+1}`;root.add(stage);
    for(const side of [-1,1]){
      box(stage,m.steel,[side*width/2,-.44,0],[.065,.88,.065],'Ladder telescopic rail');
      box(stage,m.dark,[side*width/2,-.10,0],[.082,.10,.082],'Ladder guide shoe');
    }
    for(let rung=0;rung<3;rung++){
      const y=-.15-rung*.28;
      box(stage,m.pipe,[0,y,.02],[width,.065,.10],'Ladder anti-slip tread');
      box(stage,m.dark,[0,y+.035,.02],[width-.13,.008,.07],'Ladder tread grip');
    }
    bake(stage);stages.push(stage);
  }
  bake(root);
  let extension=0;
  const setExtension=value=>{
    extension=THREE.MathUtils.clamp(Number(value)||0,0,1);
    for(let index=0;index<stages.length;index++)stages[index].position.set(0,2.65-index*.80*extension,2.25+index*.10);
    root.userData.extension=extension;root.updateMatrixWorld(true);return extension;
  };
  setExtension(0);lander.userData.ladder=root;
  return{root,stages,setExtension,get extension(){return extension;}};
}
