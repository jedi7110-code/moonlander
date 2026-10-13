// Catalog labels and stable links only: browsing the list does not build ships.
export const CAMERA_REVISION='20261013-r1';
const saved={revision:CAMERA_REVISION};
const bow={approach:'bow'};
const ending={...bow,ending:'underside'};
export const EXTERIOR_SCENE_CATALOG=Object.freeze([
  {id:'01-tilt',number:1,label:'ティルト・母艦の接近',status:'保存版',start:0,time:15,options:saved},
  {id:'02-planet',number:2,label:'惑星背景・横移動',status:'保存版',start:38,time:43,options:saved},
  {id:'03-bow',number:3,label:'船首斜め下・03の画角',status:'現行案',start:50,time:54,options:bow},
  {id:'03-original',number:3,label:'元の遠景カメラ',status:'旧案・保存版',start:50,time:54,options:saved},
  {id:'07-docking',number:7,label:'小型船のドッキング',status:'保存版',start:58,time:64.8,options:saved},
  {id:'04-crossing',number:4,label:'超望遠・惑星を横切る母艦',status:'保存版',start:68.75,time:73.75,options:saved},
  {id:'05-b-ending-current',number:5,label:'Bをラストに・09なし',status:'現行案・速度＋5%',start:78.75,time:82.75,options:ending},
  {id:'05-b-ending-r1',number:5,label:'Bラスト・速度変更前',status:'直近保存版・元の速度',start:78.75,time:82.75,options:{...ending,...saved}},
  {id:'05-mounted',number:5,label:'元の船体固定カメラ',status:'旧案・保存版',start:78.75,time:82.75,options:saved},
  {id:'05-bow',number:5,label:'船首斜め下の全体像',status:'旧案・保存版',start:78.75,time:82.75,options:{...saved,penultimate:'bow'}},
  {id:'05-a',number:5,label:'A・船首越しの横移動',status:'別案・保存版',start:78.75,time:82.75,options:{...saved,penultimate:'bow-slide'}},
  {id:'05-b',number:5,label:'B・8秒カットから09へ',status:'別案・保存版',start:78.75,time:82.75,options:{...saved,penultimate:'underside'}},
  {id:'05-c',number:5,label:'C・小型船越しの母艦',status:'別案・保存版',start:78.75,time:82.75,options:{...saved,penultimate:'probe-wide'}},
  {id:'09-flyby',number:9,label:'背後から通過・彼方へ航行',status:'旧ラスト・保存版',start:86.75,time:100,options:saved},
]);
export function exteriorSceneURL(entry,{time=entry.time,paused=true}={}){
  const params=new URLSearchParams({mode:'opening',...entry.options,time:time.toFixed(3),...(paused?{paused:'1'}:{})});
  return `./ship-exterior-cinema.html?${params}`;
}
