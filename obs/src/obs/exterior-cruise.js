export const EXTERIOR_CRUISE_SPEED=2;
export const EXTERIOR_CRUISE_SPAN=3600;

// A following camera retains the inspection framing. An origin reset shared by
// ship, camera and lights keeps long-running previews precise. Distant stars
// are handled independently and have no local flight parallax.
export function createExteriorCruise({ship,camera,controls,lights=[],speed=EXTERIOR_CRUISE_SPEED}){
  let enabled=true,distance=0,offset=0;
  return{
    get offset(){return offset;},
    get distance(){return distance;},
    setEnabled(value){enabled=Boolean(value);},
    step(seconds){
      if(!enabled||!Number.isFinite(seconds)||seconds<=0)return;
      distance+=seconds*speed;const next=distance%EXTERIOR_CRUISE_SPAN,shift=next-offset;offset=next;
      ship.root.position.x+=shift;camera.position.x+=shift;controls.target.x+=shift;
      for(const light of lights){light.position.x+=shift;light.target.position.x+=shift;}
    }
  };
}
