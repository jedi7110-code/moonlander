import test from 'node:test';
import assert from 'node:assert/strict';
import {ai} from 'js-chess-engine';
import {ChessMatch} from '../src/obs/chess-match.js';
import {CabinBrain,isGameAcceptance,isChessRequest} from '../src/obs/brain.js';
import {CrewMotion,Supplies,currentAction,getStation} from '../src/obs/state.js';
import {StationFeedback} from '../src/obs/feedback.js';

test('chess enforces turns, legal squares, and king safety',()=>{
  const match=new ChessMatch();
  assert.deepEqual(match.legal('e2').map(move=>move.to),['e3','e4']);
  assert.equal(match.move({from:'e2',to:'e5'}),null);
  assert.equal(match.move({from:'e7',to:'e5'},'b'),null);
  assert.ok(match.move({from:'e2',to:'e4'}));assert.equal(match.humanTurn,false);
  assert.equal(match.move({from:'d2',to:'d4'}),null);
  assert.ok(match.move({from:'e7',to:'e5',promotion:'q'},'b'));
  match.reset('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.equal(match.move({from:'e2',to:'d2'}),null);
});
test('castling, en passant, and all four promotions use the rule engine',()=>{
  const match=new ChessMatch();match.reset('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.ok(match.move({from:'e1',to:'g1'}));assert.equal(match.game.get('f1').type,'r');
  match.reset('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  assert.ok(match.move({from:'e5',to:'d6'}));assert.equal(match.game.get('d5'),undefined);
  for(const promotion of ['q','r','b','n']){
    match.reset('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    assert.equal(match.legal('a7').length,4);assert.ok(match.move({from:'a7',to:'a8',promotion}));assert.equal(match.game.get('a8').type,promotion);
  }
});
test('checkmate and drawn positions finish the game without extra moves',()=>{
  const match=new ChessMatch();
  for(const [san,side]of [['f3','w'],['e5','b'],['g4','w'],['Qh4#','b']])assert.ok(match.move(san,side));
  assert.deepEqual(match.result,{reason:'mate',winner:'b'});assert.equal(match.move('a3'),null);
  assert.equal(match.claimResult(),true);assert.equal(match.claimResult(),false);
  match.reset('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');assert.equal(match.result.reason,'stalemate');
  match.reset('7k/8/6K1/8/8/8/8/8 w - - 0 1');assert.equal(match.result.reason,'material');
});
test('saved move history retains repetition and undo works before or after an AI reply',()=>{
  const match=new ChessMatch();
  for(let i=0;i<2;i++)for(const [san,side]of [['Nf3','w'],['Nf6','b'],['Ng1','w'],['Ng8','b']])match.move(san,side);
  assert.equal(match.result.reason,'repetition');
  const restored=new ChessMatch(match.serialize());assert.equal(restored.result.reason,'repetition');
  assert.equal(restored.undoTurn(),true);assert.equal(restored.humanTurn,true);assert.equal(restored.history.length,6);
  restored.reset();restored.move('e4');restored.undoTurn();assert.equal(restored.history.length,0);
  restored.move('e4');restored.move('e5','b');restored.undoTurn();assert.equal(restored.history.length,0);
});
test('corrupt saves recover, resignation persists, and reset preserves the level',()=>{
  assert.equal(new ChessMatch({version:1,moves:[{from:'a1',to:'h8'}]}).history.length,0);
  const match=new ChessMatch();match.level=3;match.move('e4');match.resign();
  const copy=new ChessMatch(match.serialize());assert.equal(copy.result.reason,'resigned');assert.equal(copy.level,3);
  copy.reset();assert.equal(copy.result,null);assert.equal(copy.level,3);assert.equal(copy.history.length,0);
});
test('the packaged opponent chooses moves accepted by the independent rule engine',()=>{
  const match=new ChessMatch();
  for(let ply=0;ply<24&&!match.result;ply++){
    const side=match.game.turn(),answer=ai(match.game.fen(),{level:1,ttSizeMB:.5});
    const [from,to]=Object.entries(answer.move)[0];
    assert.ok(match.move({from:from.toLowerCase(),to:to.toLowerCase(),promotion:'q'},side),`${from}-${to}`);
  }
  assert.ok(match.history.length>=10);
});

function cabin(){
  let opened=0;
  const actor=new CrewMotion({floor:0,x:1030}),care=new Supplies(),scene={obsUI:{hideWant(){},showWant(){},openGame(){opened++;}}};
  const brain=new CabinBrain(scene,actor,{care});return{actor,care,brain,get opened(){return opened;}};
}
test('accepting Milo’s invitation opens a real match only after arriving at the lounge',()=>{
  const c=cabin();c.brain.state='knocking';c.brain.want={kind:'play'};
  c.brain.acknowledge();assert.equal(c.brain.gamePending,true);assert.equal(c.opened,0);
  for(let i=0;i<300;i++){c.actor.update(1/60);c.brain.update(1/60);}
  assert.equal(c.opened,1);assert.equal(c.brain.state,'playingGame');assert.equal(currentAction(c.brain),'lounge');
  const needs={...c.brain.needs},hour=c.brain.hour;c.brain.update(600);assert.deepEqual(c.brain.needs,needs);assert.equal(c.brain.hour,hour);
  c.brain.finishGame();assert.equal(c.brain.state,'leavingLounge');assert.equal(c.brain.gamePending,false);
  c.brain.update(2.8);assert.equal(c.brain.state,'idle');
});
test('retargeting cancels a pending match and never opens it from a stale arrival',()=>{
  const c=cabin();c.brain.requestGame();c.brain._go(getStation('eva'));
  for(let i=0;i<300;i++){c.actor.update(1/60);c.brain.update(1/60);}
  assert.equal(c.opened,0);assert.equal(c.brain.gamePending,false);
  c.brain.requestGame();c.care.take('water');c.brain.requestSupplies();assert.equal(c.brain.gamePending,false);
});
test('manual chess requests work, refusing an invitation does not launch a game',()=>{
  for(const text of ['チェスしよう','ゲームで遊ぼう','play chess','a game please']){
    const c=cabin();assert.equal(isChessRequest(text),true);c.brain.handleChat(text);assert.equal(c.brain.gamePending,true);
  }
  for(const text of ['いいよ','はい','やろう！','Sure!'])assert.equal(isGameAcceptance(text),true);
  assert.equal(isGameAcceptance('あとで'),false);
  const c=cabin();c.brain.state='knocking';c.brain.want={kind:'play'};c.brain.declineGame();assert.equal(c.brain.want,null);assert.equal(c.brain.gamePending,false);assert.equal(c.brain.state,'idle');
});
test('the lounge light stays active during a match despite the frozen cabin',()=>{
  const feedback=new StationFeedback();feedback.accept('lounge');
  feedback.update(1,{state:'playingGame',actStation:'lounge'},{busy:false},true);assert.equal(feedback.summary.phase,'active');
});
