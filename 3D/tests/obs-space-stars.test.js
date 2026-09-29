import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Object3D,PerspectiveCamera,Vector3} from 'three';
import {createCutawayStars,createRearWindowStars,createSpaceStars} from '../src/obs/space-stars.js';

const renderer={getPixelRatio:()=>1.75};
const rear=()=>{
  const root=new Group(),window=new Object3D();
  window.position.set(-1.9,8.3,-4.2);window.userData.spaceWindow={width:1.2,height:1,cut:.1};root.add(window);
  return createRearWindowStars(root);
};

for(const [name,create,count,front]of [['passage',createSpaceStars,1900,true],['rear windows',rear,1900,false],['cutaway',createCutawayStars,420,false]]){
  test(`${name} stars retain their pattern and apparent sizes through camera translation`,()=>{
    const stars=create(),parent=new Group(),camera=new PerspectiveCamera(46,1.5,.025,150);
    parent.position.set(2,3,-1);parent.add(stars);parent.updateMatrixWorld(true);
    camera.rotation.y=front?Math.PI:0;
    const positions=stars.geometry.getAttribute('position'),weights=stars.geometry.getAttribute('starSize');
    assert.equal(positions.count,count,'keep the existing point budget');
    const capture=eye=>{
      camera.position.set(...eye);camera.updateMatrixWorld(true);stars.onBeforeRender(renderer,null,camera);
      return Array.from({length:positions.count},(_,i)=>{
        const world=stars.localToWorld(new Vector3().fromBufferAttribute(positions,i));
        const cameraSpace=world.clone().applyMatrix4(camera.matrixWorldInverse),screen=world.project(camera);
        return [screen.x,screen.y,weights.getX(i)/Math.abs(cameraSpace.z)];
      });
    };
    try{
      const baseline=capture([0,5,0]);
      // Walking, changing decks, dollying the cutaway, and separate XR eyes.
      for(const eye of [[-11,1.6,1.3],[11,8.4,-2],[0,6.35,85],[-.032,5,0],[.032,5,0]]){
        const moved=capture(eye);
        for(let i=0;i<count;i++)for(let k=0;k<3;k++)assert.ok(Math.abs(moved[i][k]-baseline[i][k])<1e-10,
          'translation must not shift individual stars or change their apparent size');
      }
      const radii=Array.from({length:count},(_,i)=>new Vector3().fromBufferAttribute(positions,i).length());
      assert.ok(Math.max(...radii)-Math.min(...radii)<.00001,'all points belong to one sky shell');
      camera.rotation.y+=.16;const turned=capture([0,5,0]);
      assert.ok(turned.some((point,i)=>Math.abs(point[0]-baseline[i][0])>.02),'the sky responds when the view rotates');
    }finally{stars.geometry.dispose();stars.material.dispose();}
  });
}
