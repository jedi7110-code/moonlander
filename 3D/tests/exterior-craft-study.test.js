import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../src/exterior-craft-study.js',import.meta.url),'utf8');
const html=await readFile(new URL('../src/exterior-craft-study.html',import.meta.url),'utf8');
const start=source.indexOf('  const panelStudy='),end=source.indexOf('  const inspectionBounds=');
assert.ok(start>=0&&end>start);
const finishSource=source.slice(start,end);

function fixture(search){
  const location={search},query=new URLSearchParams(search),probe=query.get('craft')==='probe';
  const elements=new Map(),panels=[],weathering=[],lines=[];
  const element=id=>{
    if(!elements.has(id))elements.set(id,{hidden:true,checked:false,textContent:''});
    return elements.get(id);
  };
  const links=['mothership','probe'].map(craft=>({dataset:{craft},href:`http://localhost/3D/exterior-craft-study.html?craft=${craft}`}));
  runInNewContext(finishSource,{
    $,query,probe,ship:{},location,URL,URLSearchParams,
    document:{querySelectorAll:selector=>{
      assert.equal(selector,'[data-craft]','the retired A/B controls are never queried');
      return links;
    }},
    history:{replaceState:(_state,_title,url)=>{location.search=new URL(url,'http://localhost').search;}},
    createExteriorPanelStudy:()=>({setEnabled:value=>panels.push(value),setWeathering:value=>weathering.push(value)}),
    createProbeLineStudy:()=>({setEnabled:value=>lines.push(value)}),
    createDockingClearanceStudy:()=>({}),
  });
  function $(id){return element(id);}
  return{element,location,links,panels,weathering,lines};
}

test('the craft study exposes only the current model, not an A/B comparison',()=>{
  assert.doesNotMatch(html,/data-detail=|A \/ 現状|B \/ パネル強化|外装比較/);
  assert.match(html,/現行モデル/);
});

test('default and legacy mothership links always show the adopted panel finish while preserving wear and inspection views',()=>{
  for(const detail of ['', '&detail=current','&detail=enhanced']){
    const study=fixture(`?craft=mothership&view=engine-base&wear=0${detail}`);
    assert.deepEqual(study.panels,[true]);
    assert.equal(study.element('panel-wear-control').hidden,false);
    assert.equal(study.element('probe-lines-control').hidden,true);
    assert.equal(new URLSearchParams(study.location.search).get('detail'),'enhanced');
    assert.equal(new URLSearchParams(study.location.search).get('view'),'engine-base');
    study.element('panel-wear').checked=true;study.element('panel-wear').onchange();
    assert.deepEqual(study.weathering,[false,true]);
    assert.deepEqual(study.panels,[true],'wear toggles never restore the retired A model');
    for(const link of study.links){
      assert.equal(new URL(link.href).searchParams.get('detail'),link.dataset.craft==='mothership'?'enhanced':'current');
      assert.equal(new URL(link.href).searchParams.get('wear'),'1');
    }
  }
});

test('the probe retains its existing model and line-strength control without obsolete A labels',()=>{
  const study=fixture('?craft=probe&detail=enhanced&lines=1&view=probe-port');
  assert.deepEqual(study.panels,[]);
  assert.equal(study.element('panel-wear-control').hidden,true);
  assert.equal(study.element('probe-lines-control').hidden,false);
  assert.equal(new URLSearchParams(study.location.search).get('detail'),'current');
  assert.equal(new URLSearchParams(study.location.search).get('view'),'probe-port');
  study.element('probe-lines').checked=false;study.element('probe-lines').onchange();
  assert.deepEqual(study.lines,[true,false]);
  assert.equal(new URLSearchParams(study.location.search).get('lines'),'0');
  assert.doesNotMatch(study.element('detail-note').textContent,/Aの|B案/);
});
