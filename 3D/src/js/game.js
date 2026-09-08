// Simulation is independent of rendering, audio and the browser. SI units replace
// Phaser pixels; the current cockpit's 1.4 m/s and ±5° landing rules are retained.
export const RULES = Object.freeze({gravity:1.2,thrust:6,maxDescent:7,maxAscent:3,maxTilt:5*Math.PI/180,maxLandingSpeed:1.4,maxHorizontalSpeed:1.4,padRadius:4.75,fuelBurn:2.8,walkSpeed:5.6,alienHP:3,bossHP:10,beamCost:22,chargeCost:50,chargeTime:1.5,regen:15,fastRegen:90});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const approach=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));

export function landingCheck(ship,pad) {
  if(distance(ship,pad)>RULES.padRadius)return 'zone';
  if(Math.abs(ship.vy)>RULES.maxLandingSpeed)return 'speed';
  if(Math.hypot(ship.vx,ship.vz)>RULES.maxHorizontalSpeed)return 'drift';
  if(Math.hypot(ship.roll,ship.pitch)>RULES.maxTilt)return 'tilt';
  return null;
}
export function beamPower(energy){return energy>=67?3:energy>=34?2:1;}

function segmentHit(start,end,target,radius){
  const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
  const denominator=dx*dx+dy*dy+dz*dz;
  const t=clamp(((target.x-start.x)*dx+(target.y-start.y)*dy+(target.z-start.z)*dz)/(denominator||1),0,1);
  return Math.hypot(start.x+dx*t-target.x,start.y+dy*t-target.y,start.z+dz*t-target.z)<=radius;
}

export class MoonGame {
  constructor({random=Math.random,height=()=>0,obstacles=[]}={}){
    this.random=random;this.height=height;this.obstacles=obstacles;this.events=[];this.nextId=1;this.reset(1);
  }
  reset(round=1) {
    const r=this.random,pad={x:(r()-.5)*9,z:(r()-.5)*9};
    const rover={x:39+(r()-.5)*9,z:-27+(r()-.5)*9};
    this.state={phase:'title',round,time:0,phaseTime:0,pad,rover,
      ship:{x:pad.x-9,y:40,z:pad.z+7,vx:0,vy:-1.2,vz:0,pitch:0,roll:0,fuel:100,thrust:0},
      player:{x:pad.x,y:0,z:pad.z+3,vx:0,vy:0,vz:0,facing:Math.PI,speed:0,boarded:false,mode:'ground',jumpHold:0},
      crews:Array.from({length:round+1},(_,i)=>({id:i,x:rover.x+(i%2)*1.2,y:0,z:rover.z+Math.floor(i/2),facing:0,speed:0,mode:'waiting',timer:0})),
      enemies:[],shots:[],debris:Array.from({length:8},(_,i)=>({x:-32+i*10,y:17+r()*37,z:pad.z-16+(i%3)*13,r:.8+r()*.55,vx:(r()-.5)*3.5,vz:(r()-.5)*1.6})),
      energy:100,charge:0,chargeAllowed:false,chargedFired:false,kills:0,bossesDue:0,boarded:0,rescued:false,spawnTimer:5.8,
      escapeAltitude:0,failure:null,failureType:null,trail:[],ladder:0,fastDescent:false,monolithTouched:false,landed:false};
    this.events=[];this.previousInput={};this.nextId=1;return this.state;
  }
  emit(type,data={}){this.events.push({type,...data});}
  drainEvents(){return this.events.splice(0);}
  start(round=1){this.reset(round);this.transition('landing');this.emit('start');return this.state;}
  transition(phase){this.state.phase=phase;this.state.phaseTime=0;this.emit('phase',{phase});}
  cancelInput(){this.previousInput={};this.state.charge=0;this.state.chargeAllowed=false;this.state.chargedFired=false;this.state.ship.thrust=0;}
  fail(reason,type='player') {
    if(['failed','complete','launch'].includes(this.state.phase))return;
    this.state.failure=reason;this.state.failureType=type;this.state.ship.thrust=0;
    this.transition('failed');this.emit('failure',{reason,kind:type});
  }
  update(delta,input={}) {
    const s=this.state,dt=clamp(delta,0,.05);
    if(['title','failed','complete'].includes(s.phase))return;
    s.time+=dt;s.phaseTime+=dt;
    if(s.phase==='landing')this.updateFlight(dt,input);
    else if(s.phase==='disembark')this.updateLadder(dt,input);
    else if(s.phase==='surface'||s.phase==='return'||s.phase==='boarding')this.updateSurface(dt,input);
    else if(s.phase==='launch'){
      s.escapeAltitude+=dt*(2+s.phaseTime*s.phaseTime*1.3);
      if(s.escapeAltitude>140){this.transition('complete');this.emit('complete');}
    }
    this.previousInput={fire:!!input.fire,jump:!!input.jump,interact:!!input.interact};
  }
  updateFlight(dt,input) {
    const s=this.state,p=s.ship;const x=clamp(input.x||0,-1,1),z=clamp(input.z||0,-1,1);
    const hasFuel=p.fuel>0,thrust=!!input.fire&&hasFuel;
    p.thrust=thrust?1:0;
    p.fuel=Math.max(0,p.fuel-dt*(thrust?RULES.fuelBurn:0)-dt*(hasFuel?.48*Math.hypot(x,z):0));
    p.vy=clamp(p.vy+dt*(-RULES.gravity+(thrust?RULES.thrust:0)-(input.jump?3:0)),-RULES.maxDescent,RULES.maxAscent);
    p.vx=approach(p.vx,hasFuel?x*5:0,hasFuel?2.3:.12,dt);p.vz=approach(p.vz,hasFuel?z*5:0,hasFuel?2.3:.12,dt);
    p.roll=approach(p.roll,-x*.27*(hasFuel?1:0),5,dt);p.pitch=approach(p.pitch,z*.27*(hasFuel?1:0),5,dt);
    p.x=clamp(p.x+p.vx*dt,-100,100);p.z=clamp(p.z+p.vz*dt,-100,100);p.y+=p.vy*dt;
    if(p.y>80){p.y=80;p.vy=Math.min(0,p.vy);}
    for(const d of s.debris){
      d.x+=d.vx*dt;d.z+=d.vz*dt;if(d.x>70)d.x=-70;if(d.x<-70)d.x=70;if(d.z>65)d.z=-65;if(d.z<-65)d.z=65;
      if(Math.hypot(p.x-d.x,p.y+3+this.height(p.x,p.z)-d.y,p.z-d.z)<d.r+1.55){this.fail('デブリに衝突しました。周辺の岩塊を避けて降下してください。','ship');return;}
    }
    if(p.y<=0){
      p.y=0;const issue=landingCheck(p,s.pad);
      const messages={zone:'指定の着陸地点から外れました。緑の円の中央を狙ってください。',speed:'着陸時の速度が大きすぎました。SPACEで逆噴射し、1.4m/s以下まで減速してください。',drift:'横滑りが残っていました。着地前に移動キーを離し、横速度を落としてください。',tilt:'機体が傾いていました。移動キーを離し、傾きを±5°以内に戻してください。'};
      if(issue){this.fail(messages[issue],'ship');return;}
      p.vx=p.vz=p.vy=p.roll=p.pitch=p.thrust=0;s.landed=true;
      // The actual touchdown point becomes the hatch and boarding location.
      s.player.x=p.x;s.player.z=p.z+1.95;s.player.y=2.4;s.player.facing=0;s.player.mode='ladder';s.ladder=0;
      this.transition('disembark');this.emit('landed');
    }
  }
  updateLadder(dt,input) {
    const s=this.state;
    if(input.interact||input.fire)s.fastDescent=true;
    const down=s.fastDescent?1:Math.max(0,input.rawZ||0),up=s.fastDescent?0:Math.max(0,-(input.rawZ||0));
    s.ladder=clamp(s.ladder+dt*(down*(s.fastDescent?1:.55)-up*.5),0,1);
    s.player.y=(1-s.ladder)*2.4;s.player.z=s.ship.z+1.95+s.ladder*1.35;s.player.speed=down||up?1:0;
    if(s.ladder>=1){s.player.y=0;s.player.mode='ground';s.player.facing=Math.atan2(s.rover.x-s.player.x,s.rover.z-s.player.z);s.trail=[{x:s.player.x,y:0,z:s.player.z}];this.transition('surface');this.emit('surface');}
  }
  moveWithObstacles(entity,x,z,radius=.38) {
    entity.x=clamp(x,-104,104);entity.z=clamp(z,-104,104);
    for(const rock of this.obstacles){const dx=entity.x-rock.x,dz=entity.z-rock.z,d=Math.hypot(dx,dz),limit=rock.r+radius;if(d<limit){entity.x=rock.x+(d?dx/d:1)*limit;entity.z=rock.z+(d?dz/d:0)*limit;}}
  }
  updateSurface(dt,input) {
    const s=this.state,p=s.player;
    let x=input.x||0,z=input.z||0;const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
    p.vx=approach(p.vx,x*RULES.walkSpeed,p.y>0?4:12,dt);p.vz=approach(p.vz,z*RULES.walkSpeed,p.y>0?4:12,dt);
    this.moveWithObstacles(p,p.x+p.vx*dt,p.z+p.vz*dt);
    p.speed=Math.hypot(p.vx,p.vz);
    const aim=input.aim;
    if(aim&&Math.hypot(aim.x-p.x,aim.z-p.z)>.3)p.facing=Math.atan2(aim.x-p.x,aim.z-p.z);
    else if(p.speed>.25)p.facing=Math.atan2(p.vx,p.vz);
    if(input.jump&&!this.previousInput.jump&&p.y<=.001){p.vy=4.25;p.jumpHold=0;this.emit('jump');}
    if(input.jump&&p.jumpHold<.28&&p.vy>0){p.vy+=dt*5;p.jumpHold+=dt;}
    p.vy-=dt*5.5;p.y=Math.max(0,p.y+p.vy*dt);if(p.y===0)p.vy=0;
    const last=s.trail[0];if(!last||distance(p,last)>.13||Math.abs(p.y-last.y)>.2){s.trail.unshift({x:p.x,y:p.y,z:p.z});if(s.trail.length>2000)s.trail.pop();}
    const nearStation=distance(p,s.ship)<6||distance(p,s.rover)<7;
    s.energy=Math.min(100,s.energy+(nearStation?RULES.fastRegen:RULES.regen)*dt);
    if(Math.hypot(p.x+37,p.z+35)<2.1){s.energy=100;if(!s.monolithTouched){s.monolithTouched=true;this.emit('monolith');}}
    this.updateWeapon(dt,input);
    this.updateShots(dt);
    if(s.phase==='failed')return;
    if(!s.rescued&&distance(p,s.rover)<6.2){
      s.rescued=true;
      s.crews.forEach((c,i)=>{c.mode='emerging';c.timer=.7+i*.25;c.y=1.3;c.x=s.rover.x+2.5;c.z=s.rover.z+(i-(s.crews.length-1)/2)*.9;});
      this.transition('return');this.emit('rescue',{count:s.crews.length});
    }
    this.updateCrew(dt);
    this.updateEnemies(dt);
    if(s.phase==='failed')return;
    if(s.rescued&&s.boarded===s.crews.length&&distance(p,s.ship)<5.3){
      if(input.interact&&!this.previousInput.interact){p.boarded=true;p.speed=0;this.transition('launch');s.enemies=[];s.shots=[];this.emit('launch');}
    }
  }
  updateWeapon(dt,input) {
    const s=this.state;
    if(input.fire&&!this.previousInput.fire){s.charge=0;s.chargeAllowed=s.energy>=50;s.chargedFired=false;this.emit('charge-start');}
    if(input.fire){s.charge+=dt;if(s.charge>=RULES.chargeTime&&s.chargeAllowed&&!s.chargedFired){this.fire(true,!!input.aim);s.chargedFired=true;}}
    if(!input.fire&&this.previousInput.fire){if(!s.chargedFired&&s.energy>=5)this.fire(false,!!input.aim);s.charge=0;s.chargeAllowed=false;s.chargedFired=false;this.emit('charge-stop');}
  }
  fire(charged=false,preciseAim=false) {
    const s=this.state,p=s.player;if(charged?s.energy<50:s.energy<5)return;
    const power=charged?6:beamPower(s.energy);let target=null,best=Infinity;
    // Cone assist permits keyboard/touch play without a pointer-lock requirement.
    for(const e of s.enemies){if(e.emerging>0)continue;const dist=distance(e,p),angle=Math.abs(angleDelta(Math.atan2(e.x-p.x,e.z-p.z),p.facing));
      if(angle<(preciseAim?.17:.75)&&dist<60){const score=dist+angle*20;if(score<best){target=e;best=score;}}}
    let dx=Math.sin(p.facing),dz=Math.cos(p.facing),dy=0;
    const startY=this.height(p.x,p.z)+p.y+1.2;
    if(target){const d=distance(target,p)||1;dx=(target.x-p.x)/d;dz=(target.z-p.z)/d;dy=(this.height(target.x,target.z)+(target.boss?1.5:1)-startY)/d;const l=Math.hypot(dx,dy,dz);dx/=l;dy/=l;dz/=l;}
    s.shots.push({id:this.nextId++,x:p.x+dx*.7,y:startY,z:p.z+dz*.7,dx,dy,dz,power,charged,range:charged?70:1.8,life:charged?.25:1.1,hitIds:[]});
    s.energy=Math.max(0,s.energy-(charged?RULES.chargeCost:RULES.beamCost));this.emit('fire',{charged,power});
  }
  updateShots(dt) {
    const s=this.state;
    for(const shot of s.shots){
      shot.life-=dt;const length=shot.charged?shot.range:65*dt;
      const from={x:shot.x,y:shot.y,z:shot.z},to={x:shot.x+shot.dx*length,y:shot.y+shot.dy*length,z:shot.z+shot.dz*length};
      const sorted=s.enemies.filter(e=>e.emerging<=0&&!shot.hitIds.includes(e.id)).sort((a,b)=>distance(a,from)-distance(b,from));
      for(const e of sorted){
        if(segmentHit(from,to,{x:e.x,y:this.height(e.x,e.z)+(e.boss?1.45:.95),z:e.z},e.boss?1.15:.72)){
          e.hp-=shot.power;shot.hitIds.push(e.id);this.emit('hit',{x:e.x,y:this.height(e.x,e.z)+1,z:e.z,boss:e.boss});
          if(e.hp<=0){s.kills++;if(s.kills%5===0)s.bossesDue++;this.emit('kill',{boss:e.boss});}
          if(!shot.charged){shot.life=0;break;}
        }
      }
      s.enemies=s.enemies.filter(e=>e.hp>0);
      if(!shot.charged){shot.x=to.x;shot.y=to.y;shot.z=to.z;}
    }
    s.shots=s.shots.filter(shot=>shot.life>0);
  }
  trailPoint(behind) {
    const trail=this.state.trail;let left=behind;
    for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i],d=distance(a,b);if(d>=left){const f=d?left/d:0;return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f};}left-=d;}
    return trail.at(-1)||this.state.player;
  }
  updateCrew(dt) {
    const s=this.state;
    let boardingBusy=s.crews.some(c=>c.mode==='boarding');
    s.crews.forEach((c,i)=>{
      if(c.mode==='waiting'||c.mode==='aboard')return;
      if(c.mode==='emerging'){
        c.timer-=dt;c.y=Math.max(0,c.y-dt*1.4);c.speed=0;
        if(c.timer<=0&&c.y<=0)c.mode='following';return;
      }
      if(c.mode==='boarding'){
        c.timer+=dt;c.y=clamp(c.timer/2.1,0,1)*2.4;c.speed=.7;c.facing=Math.PI;
        c.x=approach(c.x,s.ship.x,4,dt);c.z=approach(c.z,s.ship.z+1.95,3,dt);
        if(c.timer>=2.1){c.mode='aboard';c.speed=0;s.boarded++;this.emit('boarded',{count:s.boarded,total:s.crews.length});}
        return;
      }
      if(distance(c,s.ship)<4.7&&distance(s.player,s.ship)<6.5&&!boardingBusy&&c.y<.15){
        c.mode='boarding';c.timer=0;boardingBusy=true;if(s.phase!=='boarding')this.transition('boarding');this.emit('boarding');return;
      }
      const activeAhead=s.crews.slice(0,i).filter(c=>c.mode==='following').length;
      const dest=this.trailPoint((activeAhead+1)*1.65),d=distance(c,dest),speed=Math.min(RULES.walkSpeed*1.09,d*3);
      if(d>.08){const dx=(dest.x-c.x)/d,dz=(dest.z-c.z)/d;this.moveWithObstacles(c,c.x+dx*speed*dt,c.z+dz*speed*dt);c.facing=Math.atan2(dx,dz);}
      c.y=approach(c.y,dest.y,8,dt);if(c.y<.03)c.y=0;c.speed=speed;
    });
  }
  spawnEnemy(forceBoss=false,position=null) {
    const s=this.state,boss=forceBoss||s.bossesDue>0;if(boss&&s.bossesDue>0)s.bossesDue--;
    let x,z;
    if(position){x=position.x;z=position.z;}
    else{const a=this.random()*Math.PI*2,r=19+this.random()*13;x=clamp(s.player.x+Math.sin(a)*r,-97,97);z=clamp(s.player.z+Math.cos(a)*r,-97,97);}
    const e={id:this.nextId++,x,z,hp:boss?RULES.bossHP:RULES.alienHP,boss,speed:boss?2.05:3.25+this.random()*.25,emerging:1.15,facing:0};
    s.enemies.push(e);if(boss)this.emit('boss');this.emit('emerge',{x,y:this.height(x,z),z,boss});return e;
  }
  updateEnemies(dt) {
    const s=this.state;s.spawnTimer-=dt;
    if(s.spawnTimer<=0&&s.enemies.length<14){this.spawnEnemy();s.spawnTimer=Math.max(1.8,3.6-(s.round-1)*.12)+this.random()*1.8;}
    for(const e of s.enemies){
      if(e.emerging>0){e.emerging-=dt;continue;}
      let target=s.player,best=distance(e,target);
      for(const c of s.crews)if(['following','boarding'].includes(c.mode)&&distance(e,c)<best){target=c;best=distance(e,c);}
      const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||1;e.facing=Math.atan2(dx,dz);
      // Enemy separation avoids a visually unreadable stack of overlapping bodies.
      let repelX=0,repelZ=0;
      for(const other of s.enemies){if(other.id===e.id)continue;const gap=distance(e,other);if(gap>0&&gap<1.7){repelX+=(e.x-other.x)/gap*(1.7-gap);repelZ+=(e.z-other.z)/gap*(1.7-gap);}}
      this.moveWithObstacles(e,e.x+(dx/d*e.speed+repelX)*dt,e.z+(dz/d*e.speed+repelZ)*dt,e.boss?.78:.5);
      const touch=e.boss?1.48:1.04;
      if(distance(e,s.player)<touch&&s.player.y<(e.boss?2.3:1.6)){this.fail('エイリアンに捕まりました。ビームで距離を取り、ジャンプや回り込みで接触を避けてください。');return;}
      for(const c of s.crews)if(['following','boarding'].includes(c.mode)&&distance(e,c)<touch&&c.y<(e.boss?2.8:2.5)){this.fail('救出中のクルーが捕まりました。最後の一人が乗り込むまで、周囲を警戒してください。','crew');return;}
    }
  }
}
