// Study only. Speeds/distances below are authored for the cabin, not measured
// values from the papers. Forelimb landing, hindlimb propulsion and a flexible
// trunk follow Bertram & Gutmann (2009), doi:10.1098/rsif.2008.0328.
export const RUN_STRIDE=.58;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const approach=(a,b,d)=>a<b?Math.min(b,a+d):Math.max(b,a-d);
export function runCycle(phase){
  phase=((phase%1)+1)%1;
  const feet={};
  // Rotary gallop: the two forefeet land in sequence, then the hindfeet.
  // Two short suspension intervals separate these pairs.
  for(const [key,offset]of Object.entries({frontL:0,frontR:.08,rearR:.50,rearL:.58})){
    const p=(phase-offset+1)%1,duty=.24,planted=p<duty;
    let z,lift=0,roll=0;
    if(planted)z=RUN_STRIDE*(duty/2-p);
    else{
      const t=(p-duty)/(1-duty),a=-RUN_STRIDE*duty/2,b=-a,m=-RUN_STRIDE*(1-duty);
      z=(2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*m+(-2*t**3+3*t*t)*b+(t**3-t*t)*m;
      lift=.071*Math.sin(Math.PI*t)**1.4;roll=-.48*Math.sin(Math.PI*t);
    }
    feet[key]={z,lift,roll,planted};
  }
  return{phase,feet,flex:.06+.30*Math.sin(2*Math.PI*(phase-.06)),
    bodyY:-.018+.009*Math.cos(4*Math.PI*(phase-.05)),
    bodyZ:.009*Math.sin(2*Math.PI*phase)};
}

// No navigation/AI changes are installed in OBS by this study.
export class MouseChase {
  constructor({random=Math.random,catFloor=0,direction=1}={}){
    this.random=random;this.direction=direction;this.time=0;this.wait=75+random()*85;
    this.cat={x:-3.65*direction,floor:catFloor,z:-.18,speed:0,distance:0,yaw:direction*Math.PI/2,phase:'idle',age:0};
    this.mouse={x:-2.7*direction,floor:0,z:-.67,visible:false,speed:0,age:0};
    this.active=false;this.events=0;
  }
  appear(floor=Math.floor(this.random()*2)){
    if(this.active)return false;
    // Next crossing starts from the side Lucy is watching; it never teleports
    // her to another deck. It is fine for a mouse to pass on a different deck.
    this.direction=this.cat.x>0?-1:1;
    const d=this.direction;
    Object.assign(this.mouse,{x:-4.1*d,floor,z:-.67,visible:true,speed:0,age:0});
    this.active=true;this.events++;this.cat.age=0;
    this.cat.phase=this.cat.floor===floor?'notice':'idle';
    this.startYaw=this.cat.yaw;this.turnAge=0;
    this.turnDelta=Math.atan2(Math.sin(d*Math.PI/2-this.startYaw),Math.cos(d*Math.PI/2-this.startYaw));
    return true;
  }
  update(dt){
    if(!(dt>0))return;
    // A fixed small integration step makes slow motion, replay and dropped
    // frames share the same acceleration and stopping distance.
    for(let left=Math.min(dt,5);left>1e-9;){const h=Math.min(left,1/120);this.step(h);left-=h;}
  }
  step(dt){
    this.time+=dt;const cat=this.cat,mouse=this.mouse,d=this.direction;
    if(!this.active){this.wait-=dt;if(this.wait<=0)this.appear();return;}
    mouse.age+=dt;cat.age+=dt;
    if(mouse.visible){
      const beat=mouse.age%1.37;
      const desired=beat>1.14&&beat<1.30?.12:1.70+.32*Math.sin(mouse.age*17);
      mouse.speed=approach(mouse.speed,desired,dt*9);
      mouse.x+=mouse.speed*dt*d;
      mouse.z=-.67+Math.sin(mouse.age*12)*.014;
      if(mouse.x*d>=4.12){mouse.visible=false;cat.age=0;if(cat.phase!=='idle')cat.phase='braking';}
    }
    if(cat.floor!==mouse.floor){cat.speed=0;if(!mouse.visible)this.finish();return;}
    if(cat.phase==='notice'&&cat.age>.35){cat.phase=Math.abs(this.turnDelta)>.1?'turn':'chase';cat.age=0;}
    if(cat.phase==='turn'){
      this.turnAge+=dt;const u=clamp(this.turnAge/1.15,0,1);cat.yaw=this.startYaw+this.turnDelta*u*u*(3-2*u);
      if(u===1){cat.phase='chase';cat.age=0;}
    }
    let desired=0;
    if(cat.phase==='chase'){
      const gap=(mouse.x-cat.x)*d;
      // Lucy waits until the mouse is ahead. Keep a nose-to-mouse clearance,
      // and decelerate before the wall even if the mouse has already escaped.
      desired=Math.min(1.65,Math.max(0,(gap-.64)*3),Math.sqrt(2*3.4*Math.max(0,3.65-cat.x*d)));
    }
    cat.speed=approach(cat.speed,desired,dt*(desired>cat.speed?3.0:4.2));
    const distance=cat.speed*dt;cat.x+=distance*d;cat.distance+=distance;
    if(cat.phase==='braking'&&cat.speed===0&&cat.age>2.0)this.finish();
  }
  finish(){this.active=false;this.cat.phase='idle';this.cat.age=0;this.cat.speed=0;this.wait=75+this.random()*85;}
}
