import {CanvasTexture} from 'three';

// NHB 1430.2, sections 5.3 and 6.1–6.2: Helvetica Medium, normal spacing,
// flush left/ragged right, simple plates without decorative borders.
export const SIGN_FONT='"Helvetica Neue", Helvetica, Arial, sans-serif';
const KEEP_CASE=new Set(['TARAIRON','EVA','WC','H2O','UV','EC','pH','OK','ERG','A','B']);
const REWORD=new Map([
  ['MED SUPPLIES','Medical Supplies'],['NUTRIENT / RETURN','Nutrient Return'],
]);
function signText(text){
  return REWORD.get(text)??text.replace(/[A-Za-z][A-Za-z0-9]*/g,word=>KEEP_CASE.has(word)?word:word[0].toUpperCase()+word.slice(1).toLowerCase());
}

export function drawSign(canvas,text,{light=false}={}){
  const ctx=canvas.getContext('2d'),lines=signText(text).split('\n');
  const pad=Math.min(canvas.width*.08,canvas.height*.24),available=canvas.width-pad*2;
  let size=canvas.height*.82/(lines.length*1.18);
  ctx.fontKerning='normal';ctx.letterSpacing='0px';ctx.textAlign='left';ctx.textBaseline='alphabetic';
  const font=()=>{ctx.font=`500 ${size}px ${SIGN_FONT}`;};font();
  size*=Math.min(1,(available-1)/Math.max(...lines.map(line=>ctx.measureText(line).width)));font();
  const metrics=lines.map(line=>ctx.measureText(line));
  const ascent=Math.max(...metrics.map(m=>m.actualBoundingBoxAscent));
  const descent=Math.max(...metrics.map(m=>m.actualBoundingBoxDescent));
  const lineHeight=size*1.18,blockHeight=ascent+descent+lineHeight*(lines.length-1);
  const top=(canvas.height-blockHeight)/2;
  ctx.fillStyle=light?'#eeeae2':'#222220';ctx.fillRect(0,0,canvas.width,canvas.height);
  lines.forEach((line,i)=>{
    ctx.font=`${i>0&&text.startsWith('TARAIRON')?400:500} ${size}px ${SIGN_FONT}`;
    ctx.fillStyle=light?(i===0&&text.startsWith('TARAIRON')?'#cf3f2a':'#222220'):'#f4f1e9';
    ctx.fillText(line,pad,top+ascent+i*lineHeight);
  });
  return {text:lines.join('\n'),font:SIGN_FONT,weight:500,tracking:0,align:'left',
    fits:metrics.every(m=>m.width<=available+.01)&&top>=0&&top+blockHeight<=canvas.height};
}

export async function createCabinSignage(roots){
  await Promise.all([document.fonts.load(`500 32px ${SIGN_FONT}`),document.fonts.load(`400 32px ${SIGN_FONT}`)]);
  const originals=[],replacements=new Map(),samples=[];
  for(const root of roots)root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const sources=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(!sources.some(m=>m.name.startsWith('Sign: ')&&m.map?.image))return;
    originals.push({mesh,source:mesh.material});
    for(const source of sources){
      if(replacements.has(source)||!source.name.startsWith('Sign: ')||!source.map?.image)continue;
      const before=source.map.image,canvas=document.createElement('canvas');
      canvas.width=before.width;canvas.height=before.height;
      const pixel=before.getContext('2d').getImageData(0,0,1,1).data;
      const light=(pixel[0]+pixel[1]+pixel[2])/3>128;
      const spec=drawSign(canvas,source.name.slice(6),{light});
      const map=new CanvasTexture(canvas);map.colorSpace=source.map.colorSpace;map.anisotropy=source.map.anisotropy;
      const material=source.clone();material.map=map;material.userData.signage=spec;
      replacements.set(source,material);samples.push({before,after:canvas,spec});
    }
    mesh.material=Array.isArray(mesh.material)?sources.map(m=>replacements.get(m)??m):replacements.get(mesh.material);
  });
  return {samples,dispose(){
    for(const {mesh,source}of originals)mesh.material=source;
    for(const material of replacements.values()){material.map.dispose();material.dispose();}
  }};
}
