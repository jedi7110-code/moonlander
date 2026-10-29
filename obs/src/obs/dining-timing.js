const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

export function diningPhase(time,duration){
  const p=clamp(time/Math.max(duration,.1));
  return{progress:clamp((p-.27)/.46),hold:smooth((p-.15)/.12)*(1-smooth((p-.73)/.12)),reach:smooth(p/.15)*(1-smooth((p-.85)/.15)),approach:smooth(p/.10)*(1-smooth((p-.90)/.10))};
}

// Two spoonfuls: start scooping, return to the bowl, final return.
// Animation and sound share this clock, including custom meal durations.
export const MEAL_SPOON_CONTACTS=Object.freeze([.13,.50,.87]);
export function mealSpoonPhase(progress){
  const cycle=clamp((progress-MEAL_SPOON_CONTACTS[0])/(MEAL_SPOON_CONTACTS[2]-MEAL_SPOON_CONTACTS[0]))*2;
  return{cycle,phase:cycle===2?1:cycle%1};
}
