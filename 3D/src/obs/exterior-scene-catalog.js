// Catalog labels and stable links only: browsing the list does not build ships.
export const BEFORE_EXIT_REVISION='20261014-r8';
export const CAMERA_REVISION='20261013-r1';
export const ENTRY_CAMERA_REVISION='20261013-r7';
export const LEVEL_CAMERA_REVISION='20261013-r6';
export const FULL_CAMERA_REVISION='20261013-r5';
export const FAST_CAMERA_REVISION='20261013-r4';
export const LOW_CAMERA_REVISION='20261013-r3';
export const PREVIOUS_CAMERA_REVISION='20261013-r2';
const saved={revision:CAMERA_REVISION};
const bow={approach:'bow'};
const ending={...bow,ending:'underside'};
export const EXTERIOR_SCENE_CATALOG=Object.freeze([
  {id:'01-tilt-current',number:1,label:'38.4秒から・02へ2.2秒フェード',status:'採用・現行',start:0,time:15,options:ending},
  {id:'01-camera-tilt-up',number:1,label:'最初から上ティルト・母艦の通過を確認',status:'比較用・現行',start:0,time:25,options:{...ending,openingCamera:'tilt-up'}},
  {id:'01-before-exit',number:1,label:'退出に合わせる前・35.85秒からフェード',status:'直前保存版',start:0,time:35.85,options:{...ending,revision:BEFORE_EXIT_REVISION}},
  {id:'01-dissolve-comparison',number:1,label:'全編ディゾルブ切り替え',status:'比較用・現行',start:0,time:15,options:{...ending,transition:'dissolve'}},
  {id:'01-tilt-r2',number:1,label:'上向き調整前のティルト',status:'直前保存版',start:0,time:15,options:{...ending,revision:PREVIOUS_CAMERA_REVISION}},
  {id:'01-tilt',number:1,label:'ティルト・母艦の接近',status:'保存版',start:0,time:15,options:saved},
  {id:'02-planet-current',number:2,label:'惑星背景・横移動（14秒）',status:'採用・現行',start:39.5,time:44.5,options:ending},
  {id:'02-planet',number:2,label:'惑星背景・横移動',status:'保存版',start:38,time:43,options:saved},
  {id:'03-bow',number:3,label:'船首斜め下・03の画角',status:'採用・現行',start:53.5,time:57.5,options:ending},
  {id:'03-original',number:3,label:'元の遠景カメラ',status:'旧案・保存版',start:50,time:54,options:saved},
  {id:'07-docking',number:7,label:'左下・小型船のドッキング',status:'保存版',start:58,time:64.8,options:saved},
  {id:'07-docking-left-current',number:7,label:'左下・居住区あり',status:'比較用・現行',start:61.5,time:62.612,options:{...ending,docking:'left'}},
  {id:'07-docking-right',number:7,label:'右下・小型船のドッキング',status:'採用・現行',start:61.5,time:68.3,options:ending},
  {id:'04-crossing-current',number:4,label:'超望遠・惑星を横切る母艦',status:'採用・現行',start:71.75,time:77,options:ending},
  {id:'04-crossing',number:4,label:'超望遠・惑星を横切る母艦',status:'保存版',start:68.75,time:73.75,options:saved},
  {id:'05-b-ending-current',number:5,label:'80秒のアングルから・船体より少し下で停止',status:'採用・現行・船の速度を5%調整',start:82.25,time:86.25,options:ending},
  {id:'05-b-ending-r7',number:5,label:'開始アングル変更前・80秒の構図',status:'直前保存版',start:77.5,time:80,options:{...ending,revision:ENTRY_CAMERA_REVISION}},
  {id:'05-b-ending-r6',number:5,label:'停止位置変更前・船体と同じ高さから見送り',status:'直前保存版',start:77.5,time:99.5,options:{...ending,revision:LEVEL_CAMERA_REVISION}},
  {id:'05-b-ending-r5',number:5,label:'開始アングル変更前・5%減速した05',status:'直前保存版',start:77.5,time:79.5,options:{...ending,revision:FULL_CAMERA_REVISION}},
  {id:'05-b-ending-r4',number:5,label:'5%減速前・船体の高さから見送り',status:'直前保存版',start:77.5,time:96,options:{...ending,revision:FAST_CAMERA_REVISION}},
  {id:'05-b-ending-r3',number:5,label:'上昇前・船底から加速して見送り',status:'直前保存版',start:77.5,time:96,options:{...ending,revision:LOW_CAMERA_REVISION}},
  {id:'05-b-ending-r2',number:5,label:'加速前・2.1 m/s一定のBラスト',status:'直前保存版',start:76.5,time:80.5,options:{...ending,revision:PREVIOUS_CAMERA_REVISION}},
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
