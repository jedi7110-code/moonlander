import * as THREE from 'three';
import {createDiningStation} from '../../src/obs/ship.js';
import {getStation,CABIN_AISLE} from '../../src/obs/layout.js';
import {animateMilo} from '../../src/obs/characters.js';
import {diningPhase,DINING_APPROACH} from '../../src/obs/dining.js';

export const DINING_ACTIONS=['hydro','galley'];
export const diningStudyDuration=id=>getStation(id).dur/1000;

export function createDiningStudy(m){
  const root=new THREE.Group();root.name='Dining study';
  const stations=Object.fromEntries(DINING_ACTIONS.map(id=>{
    const station=createDiningStation(m,id),group=new THREE.Group();
    group.add(station.root,station.propsRoot);group.position.x=-station.stationX;root.add(group);
    // The animated character carries the visible props; these are placement anchors.
    for(const name of ['mug','bowl','spoon'])station.docks[name].visible=false;
    return[id,{...station,group}];
  }));
  return{root,stations};
}

export function applyDiningStudy(study,milo,id,time){
  const duration=diningStudyDuration(id),phase=diningPhase(time,duration);
  for(const [key,station]of Object.entries(study.stations))station.group.visible=key===id;
  milo.rotation.y=Math.PI;
  milo.position.z=CABIN_AISLE.crewZ-DINING_APPROACH*phase.approach;
  animateMilo(milo,{action:id,moving:false,climbing:false,facing:1,time,actionTime:time,actionDuration:duration,diningDocks:study.stations[id].docks});
  return time/duration<.15?'手を伸ばす':time/duration<.27?'食器を取る':time/duration<.73?(id==='hydro'?'水を飲む':'スプーンで食べる'):time/duration<.85?'食器を戻す':'手を離す';
}
