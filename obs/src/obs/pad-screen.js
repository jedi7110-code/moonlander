export const FALL_LINE_URL='/story/saga.html';
export const PAD_FINISH=Object.freeze({color:'#3d4849',wear:0,brightness:.85,on:true});
export const PAD_SCREENS=Object.freeze(['log','lounge','novel']);

export function nextPadScreen(previous,random=Math.random){
  const choices=PAD_SCREENS.filter(id=>id!==previous);
  return choices[Math.min(choices.length-1,Math.max(0,Math.floor(random()*choices.length)))];
}
export function padCanvas(width,height){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  return canvas.getContext?.('2d')?canvas:null;
}

// A static page changes only when picked up, never on every animation frame.
export function paintPadScreen(canvas,{page='lounge',on=true}={}){
  const ctx=canvas?.getContext('2d');if(!ctx)return;
  const w=canvas.width,h=canvas.height,ink='#becab0',muted='#789982';
  const text=(str,x,y,size=28,color=ink,font='monospace')=>{ctx.fillStyle=color;ctx.font=`500 ${size}px ${font}`;ctx.fillText(str,x,y);};
  ctx.fillStyle=on?'#1b3028':'#10201b';ctx.fillRect(0,0,w,h);if(!on)return;
  text(page==='log'?'HABITAT / LOCAL':page==='lounge'?'LOUNGE / RECREATION':'LIBRARY / THE FALL',42,63,24);
  ctx.fillStyle=muted;ctx.fillRect(40,90,w-80,2);
  if(page==='lounge'){
    text('ラウンジ',42,167,49,ink,'sans-serif');text('ゲーム・読書を選ぶ',42,217,26,muted,'sans-serif');
    [['01','チェス','CHESS'],['02','ポーカー','POKER'],['03','リバーシ','REVERSI'],['04','小説を読む','FALL-LINE']].forEach(([n,title,sub],i)=>{
      const y=278+i*144;ctx.strokeStyle=muted;ctx.lineWidth=2;ctx.strokeRect(40,y,688,122);
      text(n,62,y+48,25,muted);text(title,128,y+51,34,ink,'sans-serif');text(sub,130,y+92,23,muted);text('›',675,y+72,40);
    });
  }else if(page==='novel'){
    text('FALL-LINE',42,167,62);text('フォールライン',42,219,28,muted,'sans-serif');
    text('残響　ウィリアムズバーグ',42,311,29,ink,'serif');
    const lines=['「ねえ、ミラ。昨日のオーディション', 'どうだったの？」','','　声をかけてきたのは、同じシフトの','ノーラだった。エプロンの紐を首の後ろで','結び直しながら、カウンター越しに身を','乗り出してくる。'];
    lines.forEach((line,i)=>text(line,42,392+i*53,28,ink,'serif'));
    text('THE FALL / READING',42,854,23,muted);
  }else{
    text('SHIFT NOTES',40,158,49);text('WATCH 01',42,203,23,muted);
    [['01','AIR FILTER','INSPECTED'],['02','WATER RECOVERY','NOMINAL'],['03','GROWTH LIGHTS','06:00 - 22:00']].forEach(([n,title,value],i)=>{
      const y=282+i*130;text(n,44,y,24,muted);text(title,105,y,30);text(value,105,y+45,24,muted);ctx.fillStyle=muted;ctx.fillRect(104,y+67,615,1);
    });
    text('NEXT / LOWER DECK',42,723,23,muted);text('Check supply inventory.',42,766,29);
    ctx.fillStyle='#98ad91';ctx.fillRect(40,821,688,60);text('LOG SAVED LOCALLY',58,860,25,'#1b3028');
  }
  text(page==='lounge'?'04 OPTIONS':page==='novel'?'FALL-LINE / 001':'03 RECORDS',42,914,20,muted);text('BAT 82%',610,914,20,muted);
}
