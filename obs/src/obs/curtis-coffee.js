const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=(value,start,end)=>{const progress=clamp((value-start)/(end-start));return progress*progress*(3-2*progress);};

const button=3.6,machineSeconds=20,pourEnd=button+machineSeconds,drinkStart=pourEnd+.4;
export const CURTIS_COFFEE=Object.freeze({button,machineSeconds,pourStart:3.8,pourEnd,drinkStart,duration:drinkStart+11.6});

export function curtisCoffeePose(time){
  const age=Math.max(0,Math.min(CURTIS_COFFEE.duration,time));
  const drinking=clamp((age-CURTIS_COFFEE.drinkStart)/(CURTIS_COFFEE.duration-CURTIS_COFFEE.drinkStart));
  const progress=.15+.85*drinking;
  return{
    brewing:age<CURTIS_COFFEE.drinkStart,
    reach:smooth(age,0,1.4),transfer:smooth(age,1.4,3),
    press:smooth(age,3,CURTIS_COFFEE.button)*(1-smooth(age,CURTIS_COFFEE.button,4.2)),
    pouring:age>=CURTIS_COFFEE.pourStart&&age<CURTIS_COFFEE.pourEnd,
    fill:smooth(age,CURTIS_COFFEE.pourStart,CURTIS_COFFEE.pourEnd),
    drinkTime:progress*18,drinkDuration:18,returning:smooth(progress,.65,.73),
    machineTime:age-CURTIS_COFFEE.button,
    machineActive:time>=CURTIS_COFFEE.button&&time<CURTIS_COFFEE.pourEnd,
  };
}
