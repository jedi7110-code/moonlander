const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

export const HATCH_TRAVEL=1.98;
export function hatchOpening(age){return smooth(age/.32)*(1-smooth((age-2.8)/.45));}

export function cargoPose(age,index){
  const time=age-(.65+index*.18),fall=.7;
  if(time<0)return{visible:false,x:-(index-1)*.20,y:.75,z:-.95,tilt:0};
  if(time<fall){const t=time/fall;return{visible:true,x:-(index-1)*.20*(1-smooth((t-.6)/.4)),y:.75*(1-t*t),z:-.95+.95*smooth(t),tilt:(index%2?1:-1)*.09*Math.sin(t*Math.PI)};}
  const settling=time-fall;
  return{visible:true,y:settling<.3?.065*Math.sin(settling/.3*Math.PI):0,z:0,tilt:0};
}

export function animateDelivery(ship,care,reducedMotion=false){
  const unloading=care.phase==='unloading',age=care.delivery?.age||0;
  const opening=unloading?(reducedMotion&&age<2.8?1:hatchOpening(age)):0;
  ship.hatchDoor.rotation.set(0,0,0);
  ship.hatchDoor.position.y=(ship.hatchDoor.userData.closedY??0)+HATCH_TRAVEL*opening;
  ship.hatchLamp.color.setHex(unloading?0x85e3af:care.delivery?0xf3bd62:0x4b6658);
  ship.cargo.forEach((group,index)=>{
    const pose=unloading?cargoPose(reducedMotion?(age<2.1?0:2.5):age,index):{visible:care.lastDelivery!==null,y:0,z:0,tilt:0};
    group.userData.deliveryX??=group.position.x;
    group.visible=pose.visible;group.position.x=group.userData.deliveryX+(pose.x??0);group.position.y=.675+pose.y;group.position.z=.32+pose.z;group.rotation.z=pose.tilt;
  });
}
