// Study gait: diagonal pairs and a short, low paw recovery follow the healthy
// controls in Machado et al. (2015), https://doi.org/10.7554/eLife.07892.
// These distances are authored for this model, not measurements from the paper.
// Longer steps match the faster crossing at the existing footfall tempo.
// Three complete cycles in the 58 cm emergence leave all paws grounded.
export const MOUSE_STRIDE=.58/3;
const DUTY=.52;
const wrap=n=>{const p=((n%1)+1)%1;return p>1-1e-9||p<1e-9?0:p;};
const ease=t=>t*t*t*(10+t*(-15+6*t));

export function mouseRunCycle(distance){
  const phase=wrap(distance/MOUSE_STRIDE),feet={};
  for(const [key,offset]of Object.entries({frontL:0,frontR:.5,rearL:.5,rearR:0})){
    const p=wrap(phase-offset),planted=p<=DUTY,rear=key.startsWith('rear');
    let z=MOUSE_STRIDE*(DUTY/2-p),lift=0,roll=0;
    if(!planted){
      const u=(p-DUTY)/(1-DUTY),arc=16*u*u*(1-u)*(1-u);
      // The -p term cancels body travel throughout stance. During swing the
      // paw's world position only moves forward, easing out of and into contact.
      z+=MOUSE_STRIDE*ease(u);
      lift=(rear?.009:.007)*arc;roll=(rear?.18:.30)*arc;
    }
    feet[key]={z,lift,roll,planted};
  }
  return {phase,feet};
}
