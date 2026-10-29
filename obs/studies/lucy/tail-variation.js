export const TAIL_POSES=['Walk','WalkLevel','WalkLow'];

const smooth=t=>t*t*t*(t*(t*6-15)+10);

export class TailVariation {
  constructor(random=Math.random){this.reset(random);}
  reset(random=this.random){
    this.random=random;
    this.index=Math.min(2,Math.floor(random()*3));
    this.weights=TAIL_POSES.map((_,i)=>Number(i===this.index));
    this.remaining=6+random()*7;
    this.transition=null;
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    while(dt>1e-9){
      if(!this.transition){
        const step=Math.min(dt,this.remaining);dt-=step;this.remaining-=step;
        if(this.remaining>1e-9)continue;
        const next=(this.index+1+Math.min(1,Math.floor(this.random()*2)))%3;
        this.transition={from:this.weights.slice(),next,age:0,duration:2.4+this.random()*1.4};
      }
      const t=this.transition,step=Math.min(dt,t.duration-t.age);t.age+=step;dt-=step;
      const amount=smooth(Math.min(1,t.age/t.duration));
      this.weights=t.from.map((w,i)=>w+(Number(i===t.next)-w)*amount);
      if(t.age>=t.duration-1e-9){
        this.index=t.next;this.transition=null;this.remaining=6+this.random()*7;
      }
    }
  }
}
