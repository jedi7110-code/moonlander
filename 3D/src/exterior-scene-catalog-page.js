import {EXTERIOR_SCENE_CATALOG as entries,exteriorSceneURL} from './obs/exterior-scene-catalog.js';
const $=id=>document.getElementById(id);
const number=entry=>String(entry.number).padStart(2,'0');
let selected=entries.find(entry=>entry.id===new URLSearchParams(location.search).get('take'))??entries.find(entry=>entry.id==='05-b-ending-current');
function show(time=selected.time,paused=true){
  const url=exteriorSceneURL(selected,{time,paused});$('film').src=url;$('full').href=url;
  $('selected-label').textContent=`${number(selected)} / ${selected.label} — ${selected.status}`;
  $('far').hidden=selected.options.ending!=='underside';
  for(const row of $('cuts').children){const active=row.dataset.take===selected.id;row.dataset.selected=String(active);row.querySelector('[data-preview]').setAttribute('aria-pressed',String(active));}
  const page=new URL(location.href);page.searchParams.set('take',selected.id);history.replaceState(null,'',page);
}
for(const entry of entries){
  const row=document.createElement('tr');row.dataset.take=entry.id;
  for(const value of [number(entry),entry.label,entry.status]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
  const controls=document.createElement('td'),preview=document.createElement('button'),play=document.createElement('button');
  preview.textContent='構図';preview.dataset.preview=entry.id;preview.setAttribute('aria-label',`${number(entry)} ${entry.label}の構図`);
  play.textContent='再生';play.setAttribute('aria-label',`${number(entry)} ${entry.label}から再生`);
  preview.onclick=()=>{selected=entry;show();};play.onclick=()=>{selected=entry;show(Math.max(0,entry.start-.75),false);};
  controls.append(preview,' ',play);row.append(controls);$('cuts').append(row);
}
$('play').onclick=()=>show(Math.max(0,selected.start-.75),false);
$('still').onclick=()=>show();$('far').onclick=()=>show(150,true);
$('current-opening').href=exteriorSceneURL(entries.find(entry=>entry.id==='05-b-ending-current'),{time:0,paused:false});
$('saved-opening').href=exteriorSceneURL(entries.find(entry=>entry.id==='05-b-ending-r1'),{time:0,paused:false});
show();
