import {build} from 'esbuild';
import {parseArgs} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const {values}=parseArgs({options:{model:{type:'string'},out:{type:'string'}}});
const local=path.join(root,'local');
const modelPath=path.resolve(values.model??path.join(local,'lucy-combined.glb'));
const output=path.resolve(values.out??path.join(local,'lucy-preview.html')),project=path.resolve(root,'../../..');
const relative=path.relative(project,output);
const localRelative=path.relative(local,output);
const insideProject=!relative||(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative));
const insideLocal=localRelative&&!localRelative.startsWith('..'+path.sep)&&!path.isAbsolute(localRelative);
if(insideProject&&!insideLocal)throw new Error('Keep the embedded preview in this study local/ folder or outside the game repository.');
const bundled=await build({entryPoints:[path.join(root,'preview.js')],bundle:true,format:'esm',target:'es2022',write:false,minify:true});
const model=fs.readFileSync(modelPath).toString('base64');
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ルーシー / 歩行確認</title>
<style>*{box-sizing:border-box;letter-spacing:0}html,body{margin:0;width:100%;height:100%;overflow:hidden;font:14px system-ui;color:#172326}canvas{display:block;width:100%;height:100%;touch-action:none}header{position:fixed;top:16px;left:16px;right:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;pointer-events:none}strong{font-size:16px}nav{display:flex;gap:3px}button,select{font:inherit;color:inherit;border:1px solid #667b7a;background:#eaf0ed;border-radius:4px;min-height:38px;padding:6px 12px;cursor:pointer;pointer-events:auto}button[aria-pressed=true]{background:#253e3e;color:white}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #2367a1;outline-offset:3px}button.icon{width:38px;height:38px;padding:8px;display:grid;place-items:center}svg{width:20px;height:20px}footer{position:fixed;bottom:16px;left:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}label{display:flex;align-items:center;gap:5px}input{accent-color:#235a56}small{position:fixed;bottom:18px;right:16px;font-size:11px;opacity:.7}@media(max-width:600px){header{gap:9px}strong{width:100%}button,select{padding:6px 9px}small{display:none}}</style>
<canvas id="view" aria-label="ルーシーの3Dモデル"></canvas>
<header><strong>ルーシー</strong><nav aria-label="動作"><button data-motion="Rest">静止</button><button data-motion="Idle">待機</button><button data-motion="Walk" aria-pressed="true">歩行</button></nav><button id="pause" class="icon"></button><select id="angle" aria-label="視点"><option value="side">真横</option><option value="front">正面</option><option value="oblique">斜め</option></select></header>
<footer><label><input type="checkbox" id="bones">骨格</label><label><input type="checkbox" id="mesh">メッシュ</label></footer><small>LOCAL STUDY</small>
<script>window.LUCY_MODEL=${JSON.stringify(model)}</script><script type="module">${bundled.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`;
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,html);
console.log('Self-contained preview:',html.length,'bytes');
