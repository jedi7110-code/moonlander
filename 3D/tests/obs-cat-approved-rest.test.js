import test from 'node:test';
import assert from 'node:assert/strict';
import {APPROVED_RESTS,approvedRestTime} from '../src/obs/cat-approved-rest.js';
import {CatRoutine,Supplies} from '../src/obs/state.js';

test('approved rest clips hold and return before locomotion, including early interruption',()=>{
  for(const [mode,clip]of Object.entries(APPROVED_RESTS)){
    assert.equal(approvedRestTime(mode,100,100),clip.hold);
    assert.equal(approvedRestTime(mode,100,0),clip.duration);
    const cat=new CatRoutine(new Supplies(),{random:()=>.5});cat.motion.onSofa=false;
    cat.rest(mode,20);assert(cat.remaining>=clip.duration);assert(Number.isFinite(cat.poseYaw));
    cat.modeTime=.5;let left=false;cat.depart(()=>{left=true;},'test');
    assert(!left);assert.equal(cat.remaining,clip.entry-.5+clip.exit);
    for(let i=0;i<1000&&!left;i++)cat.update(.01);
    assert(left,'deferred move resumes after the return');
  }
});
test('both approved actions can be selected by the autonomous routine',()=>{
  const modes=new Set();
  for(let i=0;i<1000;i++){
    const cat=new CatRoutine(new Supplies(),{random:()=>.5});cat.random=()=>i/1000;cat.choose();modes.add(cat.mode);
  }
  assert(modes.has('stretch'));assert(modes.has('prone'));
});
