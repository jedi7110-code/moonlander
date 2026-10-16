import {Vector3} from 'three';
import {AU_KM,EXTERIOR_SYSTEM} from './exterior-system.js';

export function createExteriorSystemUI(ephemeris){
  const system=EXTERIOR_SYSTEM,button=document.getElementById('system-map');
  const dialog=document.createElement('dialog');dialog.className='system-dialog';dialog.setAttribute('aria-label','S-01 恒星系の配置');
  const years=seconds=>{const days=seconds/86400;return days<1000?`${days.toFixed(1)}日`:`${(days/365.25).toFixed(2)}地球年`;};
  dialog.innerHTML=`<div class="system-heading"><div><p class="eyebrow">${system.region} · STUDY</p><h2>${system.name}</h2></div><button class="system-close">閉じる</button></div>
    <p class="description">中央の光る恒星が公転の中心。K型恒星・太陽の0.8倍の質量、約5,100 K。4惑星の距離・大きさ・軌道は、このスタディーの架空設定です。</p>
    <div class="system-layout"><div><svg class="system-map" viewBox="-350 -345 700 690" role="img" aria-label="恒星を中心にした4つの惑星の軌道図"></svg><p class="description">軌道は共通の距離縮尺、恒星系を上から見た図です。点は位置を示す記号で、天体の直径は下表を参照してください。</p></div>
    <div class="system-details"><h3>恒星からの距離と実寸</h3><div class="system-table-wrap"><table><thead><tr><th>惑星</th><th>恒星から</th><th>直径</th><th>公転周期</th></tr></thead><tbody>${system.planets.map(p=>`<tr><th>${p.name}<small>${p.kind}</small></th><td>${p.orbitAU} AU<small>${(p.orbitKm/1e8).toFixed(2)}億 km</small></td><td>${(p.radiusKm*2).toLocaleString('ja-JP')} km</td><td>${years(p.periodSeconds)}</td></tr>`).join('')}</tbody></table></div>
    <p class="description">母艦は b の高軌道：中心から13,600 km、地表から9,400 km。約${(system.shipOrbit.periodSeconds/3600).toFixed(2)}時間で周回します。</p>
    <p class="description">b の自転は30時間。公転・自転・母艦の周回を、共通の時計で実時間1倍にしています。</p>
    <p class="description">「実寸」は直径と距離から見かけの大きさを計算するため、遠い3惑星は点状です。「見た目強調」は遠方の円盤を拡大する比較表示で、位置や公転の設定は共通です。</p>
    <a href="./exterior-planet-study.html" target="_blank" rel="noopener">4種類の表面サンプルを見る ↗</a>
    <p class="description system-model-note">円軌道のケプラーモデル。惑星同士の摂動は省略しています。</p></div></div>`;
  document.body.append(dialog);
  const ns='http://www.w3.org/2000/svg',svg=dialog.querySelector('svg'),v=new Vector3();
  const point=position=>[position.dot(ephemeris.radial)/AU_KM*42,-position.dot(ephemeris.tangent)/AU_KM*42];
  const element=(name,attributes)=>{const node=document.createElementNS(ns,name);Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,value));svg.append(node);return node;};
  system.planets.forEach((p,i)=>{
    const coordinates=Array.from({length:129},(_,j)=>point(ephemeris.planetPosition(i,system.epoch+j*p.periodSeconds/128,v)));
    element('path',{d:coordinates.map(([x,y],j)=>`${j?'L':'M'}${x},${y}`).join('')+'Z',fill:'none',stroke:'#485248','stroke-width':1});
  });
  element('circle',{cx:0,cy:0,r:6,fill:'#fff0bd'});
  const starLabel=element('text',{x:-12,y:5,fill:'#fff0bd','font-size':12,'text-anchor':'end'});starLabel.textContent='S-01';
  const markers=system.planets.map(p=>({
    dot:element('circle',{r:4,fill:`#${p.color.toString(16)}`}),
    text:element('text',{fill:'#d9dfd0','font-size':12})
  }));
  markers.forEach((marker,i)=>{marker.text.textContent=system.planets[i].name;});
  let last=0;
  function update(force=false){
    if(!dialog.open&&!force)return;
    const frame=ephemeris.sample();if(!force&&Math.abs(frame.time-last)<1)return;last=frame.time;
    frame.planetPositions.forEach((position,i)=>{
      const [x,y]=point(position),marker=markers[i];
      marker.dot.setAttribute('cx',x);marker.dot.setAttribute('cy',y);
      marker.text.setAttribute('x',x+9);marker.text.setAttribute('y',y-8);
    });
  }
  button.onclick=()=>{dialog.showModal();update(true);};
  dialog.querySelector('.system-close').onclick=()=>dialog.close();
  return{update,dispose(){button.onclick=null;dialog.remove();}};
}
