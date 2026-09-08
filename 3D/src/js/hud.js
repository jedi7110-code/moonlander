import {terrainHeight,CRATERS} from './scene.js';
import {RULES} from './game.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const timeString=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const PHASES={landing:['01 / DESCENT','指定地点に軟着陸せよ','SPACEで逆噴射。降下速度を1.4m/s以下に。',0],disembark:['02 / EGRESS','ハシゴを降りて月面へ','S / ↓で降下、W / ↑で戻る。E / SPACEで一気に降りる。',1],surface:['02 / SURFACE OPERATIONS','探査車の生存者を捜索せよ','ビーコンへ向かえ。SPACEで射撃、SHIFTでジャンプ。',1],return:['03 / CREW RECOVERY','クルーを船まで護衛せよ','船に近づくと順番に乗船。敵との接触を避けよ。',2],boarding:['03 / BOARDING','最後の一人まで、護衛せよ','全員が乗り込んだら、船へ戻って E で脱出。',2],launch:['04 / ASCENT','月面を離脱、軌道へ帰還中','全員の乗船を確認。脱出ポッド、上昇。',3],complete:['04 / MISSION COMPLETE','全員、帰還。','救出作戦完了。',3],failed:['SIGNAL LOST','ミッション失敗','',0]};
export class HUD {
  constructor(view,coarse){this.view=view;this.coarse=coarse;this.elements=Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));this.toastUntil=0;}
  show(id,visible){this.elements[id].classList.toggle('hidden',!visible);}
  notify(message,seconds=4){this.elements['event-message'].textContent=message;this.elements['event-message'].classList.add('visible');this.toastUntil=performance.now()+seconds*1000;}
  result(s){
    const e=this.elements,success=s.phase==='complete';this.show('result-screen',true);this.show('touch-controls',false);this.show('interact',false);
    e['result-eyebrow'].textContent=success?'MISSION COMPLETE':s.failureType==='crew'?'RESCUE FAILED':'MISSION FAILED';
    e['result-eyebrow'].style.color=success?'var(--accent)':'var(--red)';e['result-title'].textContent=success?'全員、帰還。':s.failureType==='crew'?'仲間との通信、途絶。':'ミッション失敗';
    e['result-description'].textContent=success?`${s.crews.length}名のクルーを救出し、月面を脱出しました。次の作戦では、救出対象が1人増えます。`:s.failure;
    e.retry.querySelector('span').textContent=success?`次のミッションへ · ${s.crews.length+1}名を救出`:'このミッションに再挑戦';
    e['result-stats'].innerHTML=`<div>${s.boarded} / ${s.crews.length}<small>CREW RESCUED</small></div><div>${s.kills}<small>HOSTILES</small></div><div>${timeString(s.time)}<small>MISSION TIME</small></div>`;
    e.retry.focus();
  }
  update(s,paused){
    if(s.phase==='title')return;
    const e=this.elements,flight=s.phase==='landing',p=s.player,phase=PHASES[s.phase];
    e['phase-label'].textContent=phase[0];e.objective.textContent=phase[1];e['objective-detail'].textContent=phase[2];e.round.textContent=`MISSION ${String(s.round).padStart(2,'0')}`;
    [...e.stages.children].forEach((el,i)=>{el.classList.toggle('active',i===phase[3]);el.classList.toggle('done',i<phase[3]);});
    if(flight){
      e['readout-a-label'].textContent='高度 / ALTITUDE';e['readout-a'].innerHTML=`${s.ship.y.toFixed(1)}<small>m</small>`;
      e['readout-b-label'].textContent=s.ship.vy<=0?'降下速度 / DESCENT':'上昇速度 / ASCENT';e['readout-b'].innerHTML=`${Math.abs(s.ship.vy).toFixed(1)}<small>m/s</small>`;
      e['readout-b'].className=Math.abs(s.ship.vy)<=RULES.maxLandingSpeed?'safe':s.ship.y<14?'danger':'';
      const tilt=Math.hypot(s.ship.pitch,s.ship.roll)*180/Math.PI;e['readout-c-label'].textContent='機体の傾き / TILT';e['readout-c'].innerHTML=`${tilt.toFixed(1)}<small>°</small>`;e['readout-c'].className=tilt<=5?'safe':'danger';
      e['resource-label'].textContent='FUEL';e['resource-value'].textContent=`${Math.ceil(s.ship.fuel)}%`;e['resource-fill'].style.width=`${s.ship.fuel}%`;e['resource-fill'].style.background=s.ship.fuel<20?'var(--red)':'var(--accent)';
      e['resource-note'].textContent=`横速度 ${Math.hypot(s.ship.vx,s.ship.vz).toFixed(1)} m/s · 上限1.4`;
      e['controls-hint'].innerHTML='<kbd>W A S D</kbd> 水平移動 <kbd>SPACE</kbd> 逆噴射 <kbd>SHIFT</kbd> 降下';
    }else{
      const target=s.rescued?s.ship:s.rover;e['readout-a-label'].textContent=s.rescued?'船まで / DISTANCE':'探査車まで / DISTANCE';e['readout-a'].innerHTML=`${Math.round(distance(p,target))}<small>m</small>`;
      e['readout-b-label'].textContent='乗船済 / CREW';e['readout-b'].innerHTML=`${String(s.boarded).padStart(2,'0')}<small>/ ${s.crews.length}</small>`;e['readout-b'].className=s.boarded===s.crews.length?'safe':'';
      e['readout-c-label'].textContent='撃破 / HOSTILES';e['readout-c'].innerHTML=`${String(s.kills).padStart(2,'0')}<small>KILLS</small>`;e['readout-c'].className='';
      e['resource-label'].textContent='BEAM';e['resource-value'].textContent=`${Math.floor(s.energy)}%`;e['resource-fill'].style.width=`${s.energy}%`;e['resource-fill'].style.background=s.energy<22?'var(--red)':'var(--cyan)';
      e['resource-note'].textContent=distance(p,s.ship)<6||distance(p,s.rover)<7?'急速充電中':`威力 ${s.energy>=67?'III':s.energy>=34?'II':'I'} · 長押しで貫通`;
      e['controls-hint'].innerHTML='<kbd>W A S D</kbd> 移動 <kbd>SPACE</kbd> 射撃・長押し <kbd>SHIFT</kbd> ジャンプ <kbd>E</kbd> 乗降';
    }
    this.show('charge',!flight&&s.charge>.2&&s.chargeAllowed&&!s.chargedFired);e['charge-fill'].style.width=`${Math.min(100,s.charge/1.5*100)}%`;
    const canEscape=s.boarded===s.crews.length&&distance(p,s.ship)<5.3&&!['launch','complete','failed'].includes(s.phase),onLadder=s.phase==='disembark';
    this.show('interact',onLadder||canEscape);e.interact.querySelector('span').textContent=onLadder?'ハシゴを降りる':'全員を乗せて月面脱出';
    e['touch-main'].textContent=flight?'逆噴射':onLadder?'降りる':'ビーム';e['touch-alt'].textContent=flight?'降下':'ジャンプ';
    this.show('touch-controls',this.coarse&&!paused&&!['launch','failed','complete'].includes(s.phase));e.clock.textContent=`T+ ${timeString(s.time)}`;this.drawRadar(s);
  }
  project(s,mouse,paused){
    if(performance.now()>this.toastUntil)this.elements['event-message'].classList.remove('visible');
    if(s.phase==='title')return;
    const e=this.elements,flight=s.phase==='landing',target=flight?s.pad:s.rescued?s.ship:s.rover;
    if(['launch','complete','failed'].includes(s.phase)){this.show('waypoint',false);this.show('reticle',false);return;}
    const projected=this.view.project(target.x,terrainHeight(target.x,target.z)+(flight?.3:s.rescued?5:4.4),target.z);
    this.show('waypoint',true);const rect=e.hud.getBoundingClientRect();
    const edge=this.coarse?40:180,left=clamp(projected.x-rect.left,edge,Math.max(edge,rect.width-100)),top=clamp(projected.y-rect.top,100,rect.height-155);
    e.waypoint.style.left=`${left}px`;e.waypoint.style.top=`${top}px`;e.waypoint.style.opacity=projected.visible?'1':'.55';
    e['waypoint-name'].textContent=flight?'LANDING ZONE':s.rescued?'BARRAMUNDI':'CREW SIGNAL';e.waypoint.style.color=flight||s.rescued?'var(--accent)':'var(--cyan)';
    e['waypoint-distance'].textContent=`${Math.round(distance(flight?s.ship:s.player,target))} m`;
    const aiming=mouse.active&&!this.coarse&&['surface','return','boarding'].includes(s.phase)&&!paused;this.show('reticle',aiming);if(aiming){e.reticle.style.left=`${mouse.x}px`;e.reticle.style.top=`${mouse.y}px`;}
  }
  drawRadar(s){
    const c=this.elements.radar.getContext('2d'),size=320,m=size/2,scale=2.32,p=s.phase==='landing'?s.ship:s.player;
    c.clearRect(0,0,size,size);c.save();c.beginPath();c.arc(m,m,145,0,Math.PI*2);c.clip();c.fillStyle='#091714';c.fillRect(0,0,size,size);c.strokeStyle='#aacfab20';c.lineWidth=1;
    for(let i=-6;i<=6;i++){const x=m+i*46.4-(p.x*scale)%46.4,z=m+i*46.4-(p.z*scale)%46.4;c.beginPath();c.moveTo(x,0);c.lineTo(x,320);c.moveTo(0,z);c.lineTo(320,z);c.stroke();}
    for(const crater of CRATERS){c.beginPath();c.ellipse(m+(crater.x-p.x)*scale,m+(crater.z-p.z)*scale,crater.r*scale,crater.r*scale,0,0,Math.PI*2);c.strokeStyle='#bac5b917';c.stroke();}
    const dot=(entity,color,r)=>{c.fillStyle=color;c.beginPath();c.arc(m+(entity.x-p.x)*scale,m+(entity.z-p.z)*scale,r,0,Math.PI*2);c.fill();};
    dot(s.ship,'#bdff6b',5);if(!s.rescued)dot(s.rover,'#84e6ee',5);for(const enemy of s.enemies)dot(enemy,'#ff7974',enemy.boss?5:3.4);for(const crew of s.crews)if(!['waiting','aboard'].includes(crew.mode))dot(crew,'#84e6ee',3);
    if(s.phase==='landing')for(const d of s.debris)dot(d,'#e4b687',3);
    c.strokeStyle='#bdff6b55';c.beginPath();c.arc(m,m,144,0,Math.PI*2);c.stroke();c.save();c.translate(m,m);c.rotate(Math.PI-(s.phase==='landing'?0:p.facing));c.beginPath();c.moveTo(0,-8);c.lineTo(-5,5);c.lineTo(0,2);c.lineTo(5,5);c.closePath();c.fillStyle='#f0f8e9';c.fill();c.restore();
    c.restore();c.fillStyle='#a1bd9d';c.font='18px monospace';c.textAlign='center';c.fillText('N',m,15);
  }
}
