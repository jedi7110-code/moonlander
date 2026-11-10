// The droid's feet on a stair trip (stair-trip.js), as in the stair study:
// an alternating step of one tread per foot placement, planted on tread
// centres on the flights and on the lane on the floors, each foot lifted in
// an arc between its plants. Pure function of the trip's travel t.
import {stairContact,STAIR_SEGMENTS} from './stair-route.js';

export const DROID_STAIR_GAIT=Object.freeze({cycle:.65,stance:.62,spread:.137,lift:.20,plant:.28,ankle:.099,hipHeight:.88,lean:.11,handover:.5});
const G=DROID_STAIR_GAIT;
const mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const FLIGHTS=STAIR_SEGMENTS.filter(s=>s.kind==='flight');

function contact(trip,t,side){
  const lateral=side*G.spread,s=trip.routeS(t);
  if(s!==null&&FLIGHTS.some(f=>s>=f.start&&s<=f.end)){const p=stairContact(s,trip.direction,trip.lane+lateral);return {x:p.x,y:p.y,z:p.z};}
  const f=trip.frame(t);return {x:f.x+f.dz*lateral,y:f.y,z:f.z-f.dx*lateral};
}

// World positions of the left and right foot soles at travel t. On a
// right-tower trip: the left-tower trip's feet, reflected (they change sides).
export function droidStairFeet(trip,t){
  if(trip.mirrorOf)return droidStairFeet(trip.mirrorOf,t).map(f=>({...f,x:-f.x})).reverse();
  return [-1,1].map(side=>{
    const phase=side<0?.5:0,q=t/G.cycle+phase,index=Math.floor(q),u=q-index;
    const plant=(index-phase)*G.cycle+G.cycle*G.plant,swing=u<G.stance?0:(u-G.stance)/(1-G.stance);
    const a=contact(trip,plant,side),b=contact(trip,plant+G.cycle,side),k=smooth(swing);
    return {x:mix(a.x,b.x,k),y:mix(a.y,b.y,k)+Math.sin(Math.PI*swing)*G.lift,z:mix(a.z,b.z,k),planted:u<G.stance};
  });
}

// Model-space pose overrides for the droid at travel t: root placement and
// local foot targets, mixed with the cabin walking feet near the trip ends.
export function droidStairPose(trip,t,cabinFeet){
  const frame=trip.frame(t),feet=droidStairFeet(trip,t),y=Math.min(...feet.map(f=>f.y));
  const cos=Math.cos(-frame.yaw),sin=Math.sin(-frame.yaw);
  const local=feet.map(f=>{const dx=f.x-frame.x,dz=f.z-frame.z;return [dx*cos+dz*sin,f.y-y+G.ankle,-dx*sin+dz*cos];});
  const w=Math.min(smooth(t/G.handover),smooth((trip.length-t)/G.handover));
  const mixed=cabinFeet?local.map((p,i)=>p.map((v,k)=>mix(cabinFeet[i][k],v,w))):local;
  return {root:{x:frame.x,y,z:frame.z,yaw:frame.yaw},feet:mixed,walkPhase:t/G.cycle,weight:w,
    hipHeight:G.hipHeight,lean:G.lean,feetWorld:feet};
}
