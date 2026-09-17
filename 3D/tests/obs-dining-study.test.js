import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo} from '../src/obs/characters.js';
import {getStation} from '../src/obs/layout.js';
import {diningPhase} from '../src/obs/dining.js';
import {createDiningStudy,applyDiningStudy,diningStudyDuration} from '../studies/milo/dining-study.js';

test('water and kitchen studies use production durations, dock positions and continuous prop contact',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const mat=new MeshStandardMaterial(),m=new Proxy({},{get:()=>mat});let study;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{study=createDiningStudy(m);}finally{delete globalThis.document;}
  const milo=createMilo(m);
  for(const id of ['hydro','galley','hydro']){
    const duration=diningStudyDuration(id);assert.equal(duration,getStation(id).dur/1000);
    for(const fraction of [0,.15,.3,.5,.75,.9,1]){
      const time=fraction*duration;assert(applyDiningStudy(study,milo,id,time));
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
