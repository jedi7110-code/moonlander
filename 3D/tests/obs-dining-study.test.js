import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {createMilo} from '../src/obs/characters.js';
import {getStation,CABIN_AISLE,HYDRO_TRAY} from '../src/obs/layout.js';
import {diningPhase,diningApproach} from '../src/obs/dining.js';
import {createDiningStudy,applyDiningStudy,diningStudyDuration} from '../studies/milo/dining-study.js';

test('water and kitchen studies use production durations, dock positions and continuous prop contact',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const mat=new MeshStandardMaterial(),m=new Proxy({},{get:()=>mat});let study;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{study=createDiningStudy(m);}finally{delete globalThis.document;}
  const hydro=study.stations.hydro,tray=new Box3().setFromObject(hydro.root.getObjectByName('Shallow cup tray'));
  const cup=new Box3().setFromObject(hydro.docks.mug);
  assert.ok(Math.abs(tray.max.z-tray.min.z-.40)<1e-6,'the compact tray leaves room to lift the cup clear of the taps');
  assert.ok(tray.min.z<=-.59&&tray.max.z<=-.19,'the tray remains attached at the fixture, not floating in the aisle');
  assert.ok(cup.min.z>tray.min.z+.02&&cup.max.z<tray.max.z-.02,'the entire cup fits with a small margin');
  assert.ok(Math.abs(cup.min.y-tray.max.y)<1e-6,'the cup sits on the tray surface');
  assert.equal(hydro.docks.mug.position.z,HYDRO_TRAY.cupZ);
  const milo=createMilo(m);
  for(const id of ['hydro','galley','hydro']){
    const duration=diningStudyDuration(id);assert.equal(duration,getStation(id).dur/1000);
    for(const fraction of [0,.15,.3,.5,.75,.9,1]){
      const time=fraction*duration;assert(applyDiningStudy(study,milo,id,time));
      assert.ok(Math.abs(milo.position.z-(CABIN_AISLE.crewZ-diningApproach(id)*diningPhase(time,duration).approach))<1e-9);
      if(id==='hydro'&&diningPhase(time,duration).approach===1)assert.ok(Math.abs(milo.position.z-HYDRO_TRAY.standZ)<1e-9,'keep the body back while the arm reaches to the tray');
      assert.equal(milo.rotation.y,Math.PI);
      assert.equal(study.stations[id].group.visible,true);
      assert.equal(study.stations[id==='hydro'?'galley':'hydro'].group.visible,false);
      const docks=study.stations[id].docks;
      milo.updateMatrixWorld(true);
      for(const key of id==='hydro'?['mug']:['bowl','spoon']){
        assert(!docks[key].visible,'no duplicate stationary dish behind the animated one');
        const prop=milo.userData.dining[key];assert(prop.visible);
        if(diningPhase(time,duration).hold===0){
          const p=prop.getWorldPosition(new Vector3()),dock=docks[key].getWorldPosition(new Vector3());
          assert(p.distanceTo(dock)<1e-8,'props return to their original equipment surface');
          assert(Math.abs(dock.x)<.2,'study equipment and props are recentered together');
        }
      }
    }
  }
  for(const root of [study.root,milo])root.traverse(o=>o.geometry?.dispose());mat.dispose();
});
