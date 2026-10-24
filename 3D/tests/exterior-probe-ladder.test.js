import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {createLander} from '../src/js/models.js';

test('flight ladder is stowed in a short cassette, clears the service cover, and extends without scaling its treads',()=>{
  const ship=createExteriorShip(),probe=ship.dockedLander,ladder=ship.probeLadder;
  try{
    probe.removeFromParent();probe.updateMatrixWorld(true);
    assert.equal(ladder.extension,0);assert.equal(probe.userData.ladder,ladder.root);
    const lengths=ladder.stages.map(stage=>new Box3().setFromObject(stage).getSize(new Vector3()).y);
    const stowed=new Box3().setFromObject(ladder.root);
    assert.ok(stowed.min.y>1.65,'nothing trails below the short storage cassette');
    assert.ok(stowed.max.y<2.75,'cassette stays below the pressure hatch');
    for(const stage of ladder.stages)assert.ok(new Box3().setFromObject(stage).min.z>2.20,'treads stay outside the inspection cover');
    for(const amount of [0,.25,.5,.75,1]){
      ladder.setExtension(amount);
      assert.deepEqual(ladder.stages.map(stage=>new Box3().setFromObject(stage).getSize(new Vector3()).y),lengths);
      assert.ok(ladder.stages[0].position.y===2.65,'upper section stays attached to the drive head');
      for(let i=1;i<3;i++)assert.ok(ladder.stages[i-1].position.y-ladder.stages[i].position.y<=.80,'adjacent rails retain overlap');
    }
    assert.ok(Math.abs(new Box3().setFromObject(ladder.root).min.y-.17)<.01,'deployed rail reaches landing height');
    ladder.setExtension(-1);assert.equal(ladder.extension,0);
    ladder.setExtension(2);assert.equal(ladder.extension,1);
  }finally{ship.probeDock.add(probe);ship.dispose();}
});
test('game boarding ladder retains its original full height',()=>{
  const game=createLander({labels:false}),bounds=new Box3().setFromObject(game.userData.ladder);
  assert.ok(bounds.getSize(new Vector3()).y>2.4);
});
