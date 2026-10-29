import test from 'node:test';
import assert from 'node:assert/strict';
import {gameContactSamples,gameSoundSequence} from '../src/obs/game-sounds.js';
import {CabinAudio} from '../src/obs/audio.js';

function harness(){
  const parameter=()=>({value:0,setValueAtTime(value){this.value=value;},setTargetAtTime(value){this.value=value;},cancelScheduledValues(){}});
  const sources=[],ctx={state:'suspended',currentTime:10,sampleRate:22050,destination:{},resume(){this.state='running';return Promise.resolve();},close(){this.state='closed';},
    createGain(){return{gain:parameter(),connect(to){return to;},disconnect(){}};},
    createBuffer(_channels,length){const data=new Float32Array(length);return{getChannelData:()=>data};},
    createBufferSource(){const source={connect(to){this.to=to;return to;},disconnect(){this.disconnected=true;},start(at){this.started=at;},stop(){this.stopped=true;}};sources.push(source);return source;}};
  const session={active:false,start(){this.active=true;},pause(){this.active=false;},dispose(){this.active=false;}};
  const audio=new CabinAudio({enabled:true,ambience:false,library:{},createContext:()=>ctx,playbackSession:session,fetchAudio(){assert.fail('game sounds must not fetch cabin recordings');}});
  return{audio,ctx,sources,session};
}
test('contact sounds are short, distinct, deterministic and faded without clipping',()=>{
  for(const rate of [22050,44100,48000])for(const kind of ['chessYou','chessMilo','reversiYou','reversiMilo']){
    const samples=gameContactSamples(kind,rate);
    assert.ok(samples.length/rate<.23);assert.ok(samples.every(Number.isFinite));
    assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
    assert.ok(Math.max(...samples.map(Math.abs))<=.351);
    assert.ok(samples.reduce((sum,value)=>sum+value*value,0)/samples.length>.0001);
    assert.deepEqual(samples,gameContactSamples(kind,rate));
  }
});
test('chess has exactly one fixed sound per side, including captures, promotion and castling',()=>{
  for(const color of ['w','b'])for(const move of [{flags:'n'},{flags:'c',captured:'p'},{flags:'e',captured:'p'},{flags:'k'},{flags:'q'},{flags:'np',promotion:'q'}]){
    assert.deepEqual(gameSoundSequence({game:'chess',move:{...move,color}}),[{kind:color==='w'?'chessYou':'chessMilo',delay:0,volume:1}]);
  }
});
test('reversi has exactly one fixed sound per side, regardless of the number of flipped discs',()=>{
  for(const side of [1,-1])for(const flipped of [1,3,8,18]){
    assert.deepEqual(gameSoundSequence({game:'reversi',side,flipped}),[{kind:side===1?'reversiYou':'reversiMilo',delay:0,volume:.85}]);
  }
  assert.deepEqual(gameSoundSequence({game:'poker'}),[]);
});
for(const game of ['chess','reversi'])test(`repeated ${game} turns reuse the same two audio buffers without cycling pitch or timbre`,()=>{
  const {audio,sources}=harness();
  try{
    audio.pause(true);audio.setGameActive(true);audio.unlock();
    const sounds={};
    for(let turn=0;turn<12;turn++)for(const color of ['w','b']){
      audio.playGameSound({game,side:color==='w'?1:-1,move:{color,flags:turn%2?'c':'n',captured:turn%2?'p':undefined}});
      const source=sources.at(-1);
      if(sounds[color])assert.equal(source.buffer,sounds[color]);else sounds[color]=source.buffer;
      source.onended();
    }
    assert.notEqual(sounds.w,sounds.b);assert.notDeepEqual(sounds.w.getChannelData(0),sounds.b.getChannelData(0));
    assert.equal(audio.gameBuffers.size,2);
  }finally{audio.dispose();}
});
test('games can sound while the cabin is paused, through a separate bus following the same mute preference',async()=>{
  const {audio,ctx,sources,session}=harness();
  try{
    audio.pause(true);audio.setGameActive(true);audio.playGameSound({game:'chess'});
    assert.equal(sources.length,0,'no audio before the first gesture');
    audio.unlock();const before=sources.length;assert.equal(session.active,true);
    assert.equal(audio.audible,false);assert.equal(audio.master.gain.value,0);assert.equal(audio.gameMaster.gain.value,.30);
    audio.playGameSound({game:'reversi',side:1});
    const gameSources=sources.slice(before);assert.equal(gameSources.length,1);
    assert.deepEqual(gameSources.map(s=>s.started),[10]);
    assert.ok(gameSources.every(s=>s.to!==audio.master));
    await audio.toggle();assert.equal(audio.gameMaster.gain.value,0);assert.equal(session.active,false);
    assert.ok(gameSources.every(s=>s.stopped&&s.disconnected));assert.equal(audio.gameVoices.size,0);
    const muted=sources.length;audio.playGameSound({game:'chess'});assert.equal(sources.length,muted);
    await audio.toggle();assert.equal(audio.gameMaster.gain.value,.30);assert.equal(audio.master.gain.value,0);
    assert.equal(audio.gameVoices.size,0,'unmuting cannot replay an old move');
    ctx.state='interrupted';audio.playGameSound({game:'chess'});assert.equal(audio.gameVoices.size,0);
    audio.unlock();audio.playGameSound({game:'chess'});assert.equal(audio.gameVoices.size,1);
  }finally{audio.dispose();}
});
test('leaving a game or hiding the page stops contact sounds; returning never queues old moves',()=>{
  const {audio,sources,session}=harness();
  try{
    audio.pause(true);audio.setGameActive(true);audio.unlock();audio.playGameSound({game:'reversi',side:-1});
    const voices=sources.slice(1);assert.equal(audio.gameVoices.size,1);
    audio.setGameActive(false);assert.equal(audio.gameMaster.gain.value,0);assert.equal(session.active,false);
    assert.ok(voices.every(source=>source.stopped));assert.equal(audio.gameVoices.size,0);
    const previous=sources.length;audio.setGameActive(true);assert.equal(sources.length,previous);assert.equal(session.active,true);
    audio.setGameActive(false);audio.pause(false);assert.equal(audio.master.gain.value,.55);assert.equal(audio.gameMaster.gain.value,0);
  }finally{audio.dispose();}
});
