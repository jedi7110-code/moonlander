import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Chess} from 'chess.js';
import {chessMoveTransition,chessArcPosition,chessCaptureScale} from '../src/obs/chess-motion.js';

const state=game=>({pieces:game.board().flat().filter(Boolean),positionKey:game.fen()});
function transition(game,san){
  const before=state(game),move=game.move(san),after={...state(game),move};
  return{before,after,plan:chessMoveTransition(before,after)};
}
test('both sides lift off, follow a continuous arc and land exactly on their legal squares',()=>{
  const game=new Chess();
  for(const san of ['e4','Nf6','Nf3','d5']){
    const {plan}=transition(game,san);assert.ok(plan);assert.ok(plan.duration>=.62&&plan.duration<=.92);
    const mover=plan.movers[0],point=new THREE.Vector3();
    assert.deepEqual(chessArcPosition(mover,0,point).toArray(),mover.fromPosition.toArray());
    assert.deepEqual(chessArcPosition(mover,1,point).toArray(),mover.toPosition.toArray());
    assert.ok(Math.abs(chessArcPosition(mover,.5,point).y-mover.lift)<1e-10);
    let previous=mover.fromPosition.clone();
    for(let frame=1;frame<=240;frame++){
      const sample=chessArcPosition(mover,frame/240,new THREE.Vector3());
      assert.ok(sample.y>=0);assert.ok(sample.distanceTo(previous)<.06,'no abrupt jumps at high or low frame rates');previous=sample;
    }
    const edge=chessArcPosition(mover,1e-4,new THREE.Vector3());assert.ok(edge.distanceTo(mover.fromPosition)<1e-6,'takeoff eases in');
    if(mover.type==='n')assert.ok(mover.lift>1,'knights clear intervening pawn heads');
  }
});
test('captures retain the correct victim, including en passant, and clear it before landing',()=>{
  const normal=new Chess();for(const san of ['e4','d5'])normal.move(san);
  assert.equal(transition(normal,'exd5').plan.captured.square,'d5');
  const special=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  const {plan}=transition(special,'exd6');assert.equal(plan.captured.square,'d5');assert.equal(plan.movers[0].to,'d6');
  assert.equal(chessCaptureScale(0),1);assert.ok(chessCaptureScale(.4)>0&&chessCaptureScale(.4)<1);assert.equal(chessCaptureScale(.7),0);assert.equal(chessCaptureScale(1),0);
});
test('castling carries both pieces and promotions keep the pawn until landing',()=>{
  for(const [fen,san,rookFrom,rookTo]of [
    ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','O-O','h1','f1'],
    ['r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1','O-O-O','a8','d8'],
  ]){
    const {plan}=transition(new Chess(fen),san);assert.equal(plan.movers.length,2);
    assert.deepEqual(plan.movers.map(({from,to})=>[from,to]).at(1),[rookFrom,rookTo]);
  }
  for(const promotion of ['q','r','b','n']){
    const {plan}=transition(new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'),{from:'a7',to:'a8',promotion});
    assert.equal(plan.movers[0].type,'p');assert.equal(plan.movers[0].promotion,promotion);
  }
});
test('selection, flip, reopening, undo and reset never replay a stale move',()=>{
  const game=new Chess(),{before,after}=transition(game,'e4');
  assert.equal(chessMoveTransition(after,{...after,flipped:true,selected:'e4'}),null);
  assert.equal(chessMoveTransition({pieces:[]},after),null);
  assert.equal(chessMoveTransition(after,before),null);
  assert.equal(chessMoveTransition(after,state(new Chess())),null);
  assert.equal(chessMoveTransition({...before,positionKey:'unrelated'},after),null);
});
