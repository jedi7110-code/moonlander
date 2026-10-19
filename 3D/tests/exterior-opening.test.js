import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {sampleExteriorCinemaFrame} from '../src/obs/exterior-cinematic.js';
import {sampleExteriorExportFrame} from '../src/obs/exterior-export.js';
import {EXTERIOR_LOGO} from '../src/obs/exterior-logo.js';
import {createExteriorDissolve} from '../src/obs/exterior-dissolve.js';

test('only the opening fades in over its first second and seeking restores the exact fade',()=>{
  const options={opening:true,approach:'bow',ending:'underside',docking:'probe-follow'};
  for(const [time,fade]of [[0,1],[.25,.84375],[.5,.5],[.75,.15625],[1,0],[2.4,0],[29.6,0],[140.65,0]]){
    const frame=sampleExteriorCinemaFrame(time,options);
    assert.equal(frame.shot.fade,fade);
    assert.equal(sampleExteriorExportFrame(time,options).shot.fade,fade);
    assert.equal(sampleExteriorCinemaFrame(time,{opening:false}).shot.fade,0);
    if(time<EXTERIOR_LOGO.start)assert.equal(frame.shot.titleOpacity,0);
  }
  const beginning=sampleExteriorCinemaFrame(0,options);
  sampleExteriorCinemaFrame(80,options);
  assert.deepEqual(sampleExteriorCinemaFrame(0,options),beginning);
  assert.deepEqual(EXTERIOR_LOGO,{start:2.4,resolve:1.2,steps:10,glowPadding:40,hold:5.8,end:7.4});
});

test('the existing final compositor applies the fade once without an extra render pass',()=>{
  const records=[];
  let target=null;
  const renderer={extensions:{has:()=>false},capabilities:{isWebGL2:false},
    getDrawingBufferSize:size=>size.set(160,90),setRenderTarget:value=>{target=value;},
    render:scene=>records.push({target,uniforms:scene.children[0].material.uniforms}),
  };
  const compositor=createExteriorDissolve(renderer);
  let views=0;
  try{
    for(const time of [0,.5,1,54,0]){
      const frame=sampleExteriorCinemaFrame(time,{opening:true});
      compositor.render(frame,()=>{views++;return false;});
      assert.equal(records.at(-1).uniforms.fade.value,frame.shot.fade);
      assert.equal(records.at(-1).target,null);
      assert.equal(records.at(-1).uniforms.fadeColor.value.getHex(),0x030609);
    }
    assert.equal(records.length,5);
    assert.equal(views,5);
    compositor.render({from:{},to:null,mix:0},()=>false);
    assert.equal(records.at(-1).uniforms.fade.value,0,'ordinary model studies never inherit an old fade');
  }finally{compositor.dispose();}
});

const loadingSource=(await readFile(new URL('../public/assets/obs/exterior-loading.js',import.meta.url),'utf8'))
  .replace(/^import .*;$/m,'');
function loadingFixture(search,spaceScene='film'){
  const cover={hidden:false},painted=[],callbacks=[],dataset={};
  const pixels=()=>({data:new Uint8ClampedArray(400)});
  const context={createImageData:pixels,getImageData:pixels,putImageData(){painted.push(canvas.style.visibility);},drawImage(){}};
  const canvas={style:{},getContext:()=>context};
  runInNewContext(loadingSource,{
    document:{body:{dataset:{spaceScene}},documentElement:{dataset},
      getElementById:id=>id==='space-boot'?cover:canvas,createElement:()=>({getContext:()=>context})},
    location:{search,origin:'http://localhost'},URLSearchParams,performance:{now:()=>100},
    innerWidth:10,innerHeight:10,devicePixelRatio:1,addEventListener(){},removeEventListener(){},
    requestAnimationFrame:callback=>callbacks.push(callback),MutationObserver:class{observe(){}disconnect(){}},
    parent:{postMessage(){}},createStarCatalog:()=>[],skyHazeColor:()=>[0,0,0],
    starGlow:()=>0,srgbByte:()=>0,linearByte:()=>0,
  });
  return{cover,canvas,painted,dataset};
}

test('neither the OBS host nor the film loading sky flashes ahead of the opening fade',()=>{
  for(const [search,spaceScene]of [['?mode=opening','film'],['?mode=opening&time=.5&paused=1','film'],['','cabin']]){
    const fixture=loadingFixture(search,spaceScene);
    assert.equal(fixture.canvas.style.visibility,'hidden');
    assert.ok(fixture.painted.length>0);
    assert.ok(fixture.painted.every(visibility=>visibility==='hidden'),'hide the temporary sky before its first paint');
  }
  for(const search of ['?mode=opening&time=1&paused=1','?mode=view']){
    assert.equal(loadingFixture(search).canvas.style.visibility,'visible');
  }
  for(const search of ['?opening=0','?preview=1']){
    const fixture=loadingFixture(search,'cabin');
    assert.equal(fixture.cover.hidden,true);
    assert.equal(fixture.painted.length,0);
  }
});
