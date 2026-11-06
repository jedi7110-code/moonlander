import {CABIN_FLOOR_Y} from '../../src/obs/layout.js';

export const STAIRS=Object.freeze({right:-13.3,left:-15.91,outerLeft:-17.76,front:1.6,back:-.3,width:1.4,radius:.95,tread:.29,risers:20,rise:(CABIN_FLOOR_Y[0]-CABIN_FLOOR_Y[1])/20,headroom:2.10});
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const segments=[];
const line=(a,b,kind='landing',extra={})=>segments.push({a,b,kind,length:Math.hypot(...a.map((v,i)=>b[i]-v)),...extra});
line([-11.85,0,STAIRS.front],[STAIRS.right,0,STAIRS.front]);
for(let level=0;level<2;level++){
  const y=level*STAIRS.rise*20;
  line([STAIRS.right,y,STAIRS.front],[STAIRS.left,y+STAIRS.rise*10,STAIRS.front],'flight',{level,half:0});
  segments.push({kind:'turn',left:true,x:STAIRS.left,y:y+STAIRS.rise*10,length:Math.PI*STAIRS.radius});
  line([STAIRS.left,y+STAIRS.rise*10,STAIRS.back],[STAIRS.right,y+STAIRS.rise*20,STAIRS.back],'flight',{level,half:1});
  segments.push({kind:'turn',left:false,x:STAIRS.right,y:y+STAIRS.rise*20,length:Math.PI*STAIRS.radius});
}
line([STAIRS.right,CABIN_FLOOR_Y[0],STAIRS.front],[-11.85,CABIN_FLOOR_Y[0],STAIRS.front]);
let offset=0;
export const STAIR_SEGMENTS=Object.freeze(segments.map(s=>{const out={...s,start:offset,end:offset+s.length};offset+=s.length;return Object.freeze(out);}));
export const STAIR_ROUTE_LENGTH=offset;

export function stairPoint(distance,{contact=false}={}){
  const d=Math.max(0,Math.min(STAIR_ROUTE_LENGTH,distance));
  const segment=STAIR_SEGMENTS.find(s=>d<s.end-1e-10)??STAIR_SEGMENTS.at(-1);
  const u=Math.max(0,Math.min(1,(d-segment.start)/segment.length));
  if(segment.kind==='turn'){
    const theta=u*Math.PI,sign=segment.left?-1:1;
    return {x:segment.x+sign*STAIRS.radius*Math.sin(theta),y:segment.y,z:.65-sign*STAIRS.radius*Math.cos(theta),
      dx:sign*Math.cos(theta),dz:sign*Math.sin(theta),pitch:0,kind:'landing',segment};
  }
  let point=segment.a.map((v,i)=>mix(v,segment.b[i],u));
  const sign=Math.sign(segment.b[0]-segment.a[0])||-1;
  if(contact&&segment.kind==='flight'){
    const step=Math.min(9,Math.floor(u*9)+1);
    point=[segment.a[0]+sign*(step-.5)*STAIRS.tread,segment.a[1]+step*STAIRS.rise,segment.a[2]];
  }
  const pitch=segment.kind==='flight'?Math.atan2(segment.b[1]-segment.a[1],Math.abs(segment.b[0]-segment.a[0])):0;
  return{x:point[0],y:point[1],z:point[2],dx:sign,dz:0,pitch,kind:segment.kind,segment};
}

export function stairContact(distance,direction=1,lateral=0){
  const p=stairPoint(distance,{contact:true}),dx=p.dx*direction,dz=p.dz*direction;
  return {...p,x:p.x+dz*lateral,z:p.z-dx*lateral,dx,dz,yaw:Math.atan2(dx,dz)};
}

export function stairFoot(distance,direction,side,{cycle=.65,stance=.62,forward=0,lane=.32,spread=.10,lift=.16,phase=side<0?.5:0}={}){
  const travel=direction>0?distance:STAIR_ROUTE_LENGTH-distance;
  const q=(travel+forward)/cycle+phase,index=Math.floor(q),u=q-index;
  const plantTravel=(index-phase)*cycle+cycle*.28;
  const swing=u<stance?0:(u-stance)/(1-stance);
  const a=stairContact(direction>0?plantTravel:STAIR_ROUTE_LENGTH-plantTravel,direction,lane+side*spread);
  const b=stairContact(direction>0?plantTravel+cycle:STAIR_ROUTE_LENGTH-plantTravel-cycle,direction,lane+side*spread);
  const t=smooth(swing);
  return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)+Math.sin(Math.PI*swing)*lift,z:mix(a.z,b.z,t),planted:u<stance,phase:u,swing};
}

export class StairTraffic {
  constructor(){this.reset();}
  reset(){this.agents=[{id:'human',s:0,direction:1,speed:.66,wait:0},{id:'robot',s:STAIR_ROUTE_LENGTH,direction:-1,speed:.58,wait:0},{id:'cat',s:STAIR_ROUTE_LENGTH*.48,direction:1,speed:.88,wait:0}];}
  update(dt){
    for(const a of this.agents){
      a.waiting=false;
      if(a.wait>0){a.wait=Math.max(0,a.wait-dt);a.exit=Math.min(1,(a.exit??0)+dt*.6);continue;}
      let travel=a.speed*dt;
      for(const b of this.agents)if(a!==b&&b.wait!==Infinity&&a.direction===b.direction){
        const gap=(b.s-a.s)*a.direction,clearance=a.id==='cat'||b.id==='cat'?.75:1.12;
        if(gap>0)travel=Math.min(travel,Math.max(0,gap-clearance));
      }
      a.waiting=travel<a.speed*dt*.5;
      a.s=Math.max(0,Math.min(STAIR_ROUTE_LENGTH,a.s+a.direction*travel));
      if(a.s===0||a.s===STAIR_ROUTE_LENGTH)a.wait=Infinity;
    }
  }
}
