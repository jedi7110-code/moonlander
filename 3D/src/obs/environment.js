// Cabin ambience and occasional maintenance use running seconds, so pause,
// hidden tabs and lounge games cannot advance a warning off screen.
export const HATCH_FAULT_INTERVAL={min:12*60,max:20*60};

export class CabinEnvironment {
  constructor({random=Math.random,onEvent=()=>{}}={}){
    this.random=random;this.onEvent=onEvent;this.clock=0;this.serial=0;
    this.temperature=21.4;this.pressure=101.3;this.fault=null;this.schedule();
  }
  schedule(){this.nextFault=this.clock+HATCH_FAULT_INTERVAL.min+this.random()*(HATCH_FAULT_INTERVAL.max-HATCH_FAULT_INTERVAL.min);}
  triggerFault(){
    if(this.fault)return false;
    this.fault={id:'airlock',serial:++this.serial,stage:'detected'};
    this.onEvent({type:'fault',...this.fault});return true;
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    this.clock+=dt;
    this.temperature=21.4+.38*Math.sin(this.clock/83)+.16*Math.sin(this.clock/27);
    this.pressure=101.3+.17*Math.sin(this.clock/61)+.08*Math.sin(this.clock/21);
    if(!this.fault&&this.clock>=this.nextFault)this.triggerFault();
  }
  setStage(serial,stage){
    if(this.fault?.serial!==serial||this.fault.stage===stage)return;
    this.fault.stage=stage;this.onEvent({type:'stage',...this.fault});
  }
  resolve(serial){
    if(this.fault?.serial!==serial)return false;
    this.fault=null;this.schedule();this.onEvent({type:'restored',serial});return true;
  }
}

export function environmentDisplay(environment,lang='ja'){
  const abnormal=Boolean(environment.fault),ja=lang==='ja';
  return{state:abnormal?'abnormal':'normal',
    label:ja?(abnormal?'船内環境 異常':'船内環境 正常'):(abnormal?'LIFE SUPPORT ALERT':'LIFE SUPPORT NOMINAL'),
    temperature:`${environment.temperature.toFixed(1)}°C`,pressure:`${environment.pressure.toFixed(1)} kPa`,
    detail:abnormal?(ja?'船外ハッチのロック異常 — 点検・修理待ち':'EVA hatch lock fault — inspection and repair required'):''};
}
