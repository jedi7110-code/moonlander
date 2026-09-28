// Shared by the cabin and its run study. Speeds/distances are authored, not measured
// values from the papers. Forelimb landing, hindlimb propulsion and a flexible
// trunk follow Bertram & Gutmann (2009), doi:10.1098/rsif.2008.0328.
// Cover more ground per cycle without spinning the approved gait faster.
const CAT_PACE=1.6,MOUSE_PACE=5/3;
export const RUN_STRIDE=.58*CAT_PACE;
export const RUN_SPEED=1.65*CAT_PACE;
export const MOUSE_RUN_SPEED=1.70*MOUSE_PACE;
export const MOUSE_WALK_SPEED=.22;
const CAT_ACCELERATION=3.0*CAT_PACE,CAT_BRAKING=4.2*CAT_PACE;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const approach=(a,b,d)=>a<b?Math.min(b,a+d):Math.max(b,a-d);
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
export const MOUSE_TIMING={emerge:4,survey:2.6,settle:.5,notice:1.2};
export const CHASE_PREVIEW_DURATION=48;
const MOUSE_WALK_AT=MOUSE_TIMING.emerge+MOUSE_TIMING.survey+MOUSE_TIMING.settle;

export function mousePose(mouse){
  const t=mouse.phaseTime??0;
  const upright=mouse.phase==='survey'?smooth(0,.55,t):mouse.phase==='settle'?1-smooth(0,MOUSE_TIMING.settle,t):0;
  // Two deliberate glances with a pause at either end, then face the route.
  const glance=-.72*smooth(.35,.90,t)+1.24*smooth(1.15,1.80,t)-.52*smooth(2.05,2.55,t);
  return {upright,look:mouse.phase==='survey'?glance:0};
}
const hermite=(a,b,da,db,t,span)=>
  (2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*span*da
  +(-2*t**3+3*t*t)*b+(t**3-t*t)*span*db;
// Muybridge's running-cat sequence: recover the forepaw below the chest,
// unfold the elbow, reach forward, then land. The wrist flexes toes-down during
// recovery; lifting the wrist all the way up to the shoulder collapses the elbow.
// The shoulder slides with the scapula; bone lengths stay unchanged.
// Columns: phase, z, lift, dz/dphase, dlift/dphase, paw pitch, shoulder travel.
const FORE_SWING=[
  [.24,-RUN_STRIDE*.12,0,-RUN_STRIDE,0,0,-.012],
  [.34,-.055,.040,.40,.62,.70,-.010],
  [.44,.025,.095,.65,.28,1.40,-.004],
  [.54,.075,.118,.80,.12,1.00,.012],
  [.64,.170,.150,1.20,.34,.45,.028],
  [.76,.257,.167,0,-.10,.08,.045],
  [.84,.228,.108,-.46,-.78,.18,.034],
  [1,RUN_STRIDE*.12,0,-RUN_STRIDE,0,0,.016],
];
function foreSwing(phase){
  const i=FORE_SWING.findIndex((k,index)=>index>0&&phase<=k[0]);
  const a=FORE_SWING[i-1],b=FORE_SWING[i],span=b[0]-a[0],t=(phase-a[0])/span;
  const ease=t*t*(3-2*t),shoulderSlope=-.028/.24;
  return {
    z:hermite(a[1],b[1],a[3],b[3],t,span),
    lift:hermite(a[2],b[2],a[4],b[4],t,span),
    roll:a[5]+(b[5]-a[5])*ease,
    shoulder:hermite(a[6],b[6],i===1?shoulderSlope:0,i===FORE_SWING.length-1?shoulderSlope:0,t,span),
  };
}
export function runCycle(phase){
  phase=((phase%1)+1)%1;
  const feet={};
  // Rotary gallop: the two forefeet land in sequence, then the hindfeet.
  // Two short suspension intervals separate these pairs.
  for(const [key,offset]of Object.entries({frontL:0,frontR:.08,rearR:.50,rearL:.58})){
    const p=(phase-offset+1)%1,duty=.24,planted=p<duty;
    let z,lift=0,roll=0,shoulder=0,hock=.40;
    if(planted){z=RUN_STRIDE*(duty/2-p);if(key.startsWith('front'))shoulder=.016-.028*p/duty;}
    else if(key.startsWith('front'))({z,lift,roll,shoulder}=foreSwing(p));
    else{
      const t=(p-duty)/(1-duty),a=-RUN_STRIDE*duty/2,b=-a,m=-RUN_STRIDE*(1-duty);
      z=(2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*m+(-2*t**3+3*t*t)*b+(t**3-t*t)*m;
      // Widen the planted stroke, then blend back to the approved airborne
      // reach so the longer stride does not pull the hind paws off their legs.
      const contact=1-smooth(.24,.34,p)+smooth(.82,1,p);
      z*=1/CAT_PACE+(1-1/CAT_PACE)*contact;
      lift=.071*Math.sin(Math.PI*t)**1.4;roll=-.48*Math.sin(Math.PI*t);
      hock=.40+roll*.4;
      // Hold the hindlimb behind the pelvis after toe-off (inspection frames
      // 2–3), then gather it under the abdomen. Opening the hock as well as
      // reaching backward avoids leaving a hooked ankle below the rump.
      const extension=smooth(.24,.35,p)*(1-smooth(.42,.67,p));
      z-=.115*extension;
      lift+=(.071-lift)*extension;
      roll+=(2.2-roll)*extension;
      hock+=(-.94-hock)*extension;
    }
    feet[key]={z,lift,roll,shoulder,hock,planted};
  }
  return{phase,feet,flex:.06+.30*Math.sin(2*Math.PI*(phase-.06)),
    bodyY:-.018+.009*Math.cos(4*Math.PI*(phase-.05)),
    bodyZ:.009*Math.sin(2*Math.PI*phase)};
}

// The study uses a straight crossing; OBS supplies a route around its furniture.
export class MouseChase {
  constructor({random=Math.random,catFloor=0,mouseFloor=null,direction=1}={}){
    this.random=random;this.direction=direction;this.time=0;this.wait=75+random()*85;
    this.cat={x:-3.65*direction,floor:catFloor,z:-.18,speed:0,distance:0,yaw:direction*Math.PI/2,phase:'idle',age:0};
    this.mouse={x:-2.7*direction,floor:0,z:-.67,visible:false,speed:0,age:0,distance:0,phase:'hidden',phaseTime:0,spotted:false};
    this.active=false;this.events=0;this.mouseFloor=mouseFloor;
  }
  appear(floor=this.mouseFloor??Math.floor(this.random()*2)){
    if(this.active)return false;
    // Next crossing starts from the side Lucy is watching; it never teleports
    // her to another deck. It is fine for a mouse to pass on a different deck.
    this.direction=this.cat.x>0?-1:1;
    const d=this.direction;
    Object.assign(this.mouse,{x:-4.42*d,floor,z:-.67,yaw:d*Math.PI/2,visible:true,speed:0,age:0,distance:0,travel:0,phase:'emerge',phaseTime:0,spotted:false});
    if(this.route)Object.assign(this.mouse,this.route.sample(0,d));
    this.active=true;this.events++;this.cat.age=0;
    this.cat.phase=this.cat.floor===floor?'watch':'idle';
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
      const previous=mouse.travel,length=this.route?.length??8.84;
      if(mouse.age<MOUSE_TIMING.emerge){
        const u=mouse.age/MOUSE_TIMING.emerge;
        mouse.phase='emerge';mouse.phaseTime=mouse.age;
        mouse.travel=.58*smooth(0,1,u);
        mouse.speed=.58*6*u*(1-u)/MOUSE_TIMING.emerge;
      }else if(mouse.age<MOUSE_WALK_AT){
        mouse.travel=.58;mouse.speed=0;
        mouse.phase=mouse.age<MOUSE_TIMING.emerge+MOUSE_TIMING.survey?'survey':'settle';
        mouse.phaseTime=mouse.age-MOUSE_TIMING.emerge-(mouse.phase==='settle'?MOUSE_TIMING.survey:0);
      }else{
        if(mouse.phase!=='walk'&&mouse.phase!=='run'){mouse.phase='walk';mouse.phaseTime=0;}
        mouse.phaseTime+=dt;
        // The cat noticing the mouse starts the escape, not elapsed time alone.
        // An unseen mouse (including one on another deck) keeps walking.
        if(!mouse.spotted&&mouse.phaseTime>=MOUSE_TIMING.notice&&mouse.travel>=(this.route?.noticeDistance??0)&&cat.floor===mouse.floor&&cat.phase==='watch'){
          mouse.spotted=true;mouse.phase='run';mouse.phaseTime=0;cat.phase='notice';cat.age=0;
        }
        const beat=mouse.phaseTime%1.37;
        const desired=mouse.spotted?(beat>1.14&&beat<1.30?.12*MOUSE_PACE:MOUSE_RUN_SPEED+.32*MOUSE_PACE*Math.sin(mouse.phaseTime*17)):MOUSE_WALK_SPEED;
        mouse.speed=approach(mouse.speed,desired,dt*(mouse.spotted?9*MOUSE_PACE:.35));
        mouse.travel=Math.min(length,mouse.travel+mouse.speed*dt);
      }
      mouse.distance+=mouse.travel-previous;
      if(this.route)Object.assign(mouse,this.route.sample(mouse.travel,d));
      else{mouse.x=(-4.42+mouse.travel)*d;mouse.z=-.67;}
      if(mouse.travel>=length){mouse.visible=false;mouse.phase='hidden';cat.age=0;if(cat.phase!=='idle')cat.phase='braking';}
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
      desired=Math.min(RUN_SPEED,Math.max(0,(gap-.64)*3*CAT_PACE),Math.sqrt(2*3.4*CAT_PACE*Math.max(0,(this.route?.stopX(d)??3.65)-cat.x*d)));
    }
    cat.speed=approach(cat.speed,desired,dt*(desired>cat.speed?CAT_ACCELERATION:CAT_BRAKING));
    const distance=cat.speed*dt;cat.x+=distance*d;cat.distance+=distance;
    if(cat.phase==='braking'&&cat.speed===0&&cat.age>2.0)this.finish();
  }
  finish(){this.active=false;this.cat.phase='idle';this.cat.age=0;this.cat.speed=0;this.wait=75+this.random()*85;}
}
