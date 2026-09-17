import test from 'node:test';
import assert from 'node:assert/strict';
import {ReversiMatch,chooseReversiMove,flips} from '../src/obs/reversi-match.js';
import {PokerMatch,evaluateHand} from '../src/obs/poker-match.js';
import {CabinBrain,requestedGame} from '../src/obs/brain.js';
import {CrewMotion,Supplies} from '../src/obs/state.js';

test('reversi starts with four legal moves and flips only bracketed discs',()=>{
  const m=new ReversiMatch();assert.deepEqual(m.legal(),[19,26,37,44]);
  assert(!m.move(0));assert(!m.move(19,-1));assert(m.move(19));assert.deepEqual(m.counts,{you:4,milo:1});
  assert(!m.move(18));assert(m.move(18,-1));assert.deepEqual(m.counts,{you:3,milo:3});
  const edge=Array(64).fill(0);edge[7]=-1;edge[8]=1;assert.deepEqual(flips(edge,6,1),[],'no row wrapping');
});
test('reversi AI plays complete legal games, including automatic passes and saved replay',()=>{
  let passes=0;
  for(let game=0;game<5;game++){
    const m=new ReversiMatch();let n=0;
    while(m.turn){const legal=m.legal(),move=m.turn===-1?chooseReversiMove(m.board):legal[(n+game)%legal.length];assert(legal.includes(move));assert(m.move(move,m.turn));if(m.passed)passes++;assert(++n<=60);}
    assert(m.result);assert(m.claimResult());assert(!m.claimResult());assert(!m.move(0));
    const restored=new ReversiMatch(m.serialize());assert.deepEqual(restored.board,m.board);assert.deepEqual(restored.result,m.result);assert(!restored.claimResult());
  }
  assert(passes>0);assert.equal(new ReversiMatch({version:1,moves:[99]}).moves.length,0);
});
const hand=text=>text.split(' ').map(c=>'23456789TJQKA'.indexOf(c[0])+'shdc'.indexOf(c[1])*13);
test('poker orders all categories and handles wheel straights, kickers and ties',()=>{
  const hands=['2s 5h 7d 9c Js','2s 2h 7d 9c Js','2s 2h 7d 7c Js','2s 2h 2d 9c Js','2s 3h 4d 5c 6s','2s 5s 7s 9s Js','2s 2h 2d Jc Js','2s 2h 2d 2c Js','Ts Js Qs Ks As'];
  hands.forEach((h,i)=>{assert.equal(evaluateHand(hand(h)).category,i);if(i)assert(evaluateHand(hand(h)).score>evaluateHand(hand(hands[i-1])).score);});
  assert(evaluateHand(hand('As 2h 3d 4c 5s')).score<evaluateHand(hand('2s 3h 4d 5c 6s')).score);
  assert(evaluateHand(hand('As Ah Kd 8c 2s')).score>evaluateHand(hand('As Ah Qd Jc 9s')).score);
  assert.equal(evaluateHand(hand('As Kh Qd Jc 9s')).score,evaluateHand(hand('Ah Kd Qc Js 9h')).score);
  assert.throws(()=>evaluateHand([0,0,1,2,3]));
});
test('poker enforces betting, one draw, hidden hand integrity and conserved chips across rounds',()=>{
  let seed=13;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  const m=new PokerMatch(null,{random});
  for(let n=0;n<300;n++){
    assert.equal(m.chips.you+m.chips.milo+m.pot,1000);
    assert(!m.draw([0]));assert(!m.act('call'));
    assert(m.act(n%2&&m.canBet?'bet':'check'));
    if(m.toCall)assert(m.act('call'));
    if(m.phase==='draw'){
      const before=m.you.slice();assert(!m.draw([0,0]));assert(!m.draw([0,1,2,3]));assert(!m.draw([-1]));
      assert(m.draw([0,1,2]));assert.equal(m.you[3],before[3]);assert(!m.draw([]));
      assert.equal(new Set([...m.you,...m.milo]).size,10);
      assert(m.act(m.canBet?'bet':'check'));if(m.toCall)assert(m.act('call'));
    }
    assert.equal(m.phase,'showdown');assert.equal(m.pot,0);assert.equal(m.chips.you+m.chips.milo,1000);
    assert(!m.act('bet'));const copy=new PokerMatch(m.serialize());assert.deepEqual(copy.serialize(),m.serialize());
    if(m.result.reason==='showdown'){assert(m.claimResult());assert(!m.claimResult());}
    if(!m.nextHand())m.reset();
  }
});
test('poker saves resume a pending bet or draw, rejects corruption, and folds pay only the pot',()=>{
  const m=new PokerMatch(null,{random:()=>.99});
  const initial=m.serialize();const copy=new PokerMatch(initial);assert.deepEqual(copy.serialize(),initial);
  m.act('check');const pending=new PokerMatch(m.serialize());assert.deepEqual(pending.serialize(),m.serialize());
  if(m.toCall)m.act('call');if(m.phase==='draw'){m.draw([]);assert.equal(m.round,1);}
  const amount=m.pot,chips=m.chips.milo;m.act('fold');assert.equal(m.chips.milo,chips+amount);assert.equal(m.pot,0);assert(!m.claimResult());
  initial.chips.you=1;const recovered=new PokerMatch(initial);assert.equal(recovered.chips.you,490);assert.equal(recovered.phase,'bet');
});
test('named games reach the lounge before opening and freeze the shared cabin state',()=>{
  for(const [text,kind]of [['チェスしよう','chess'],['ポーカーで遊ぼう','poker'],['リバーシしよう','reversi'],['オセロ','reversi'],['ゲームしよう',null]]){
    assert.equal(requestedGame(text),kind);let opened=false,selected;
    const actor=new CrewMotion({floor:0,x:1030}),brain=new CabinBrain({obsUI:{hideWant(){},openGame(game){opened=true;selected=game;}}},actor,{care:new Supplies(),random:()=>.9});
    brain.health.nextIncident=Infinity;brain.handleChat(text);assert(!opened);
    for(let i=0;i<600&&!opened;i++){actor.update(1/60);brain.update(1/60);}
    assert(opened,text);assert.equal(selected,kind);assert.equal(brain.state,'playingGame');
    const needs={...brain.needs},hour=brain.hour;brain.update(90);assert.deepEqual(brain.needs,needs);assert.equal(brain.hour,hour);
    brain.finishGame();assert.equal(brain.state,'leavingLounge');
  }
});
