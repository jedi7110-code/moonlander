// Cabin ambience and occasional maintenance use running seconds, so pause,
// hidden tabs and lounge games cannot advance a warning off screen.
// First draw: 5–90 running minutes. After an incident, restart the draw
// only after 90 running minutes from detection, and after repair is complete.
export const HATCH_FAULT_INTERVAL={min:5*60,max:90*60};
export const HATCH_FAULT_RESET_DELAY=90*60;
// A restricted pinhole leak: slow pressure decay allows a short unsuited
// maintenance visit. The hatch's equalization valve only shares existing
// cabin gas; it never injects new air or seals the fault automatically.
export const EVA_PRESSURE={leakTimeConstant:36000,safeDifference:.25,cabinVolume:350,bayVolume:28,valveRate:1.6};
const ambientPressure=time=>101.3+.17*Math.sin(time/61)+.08*Math.sin(time/21);

export class CabinEnvironment {
  constructor({random=Math.random,onEvent=()=>{}}={}){
    this.random=random;this.onEvent=onEvent;this.clock=0;this.serial=0;this.pressureBias=0;this.equalizationRequested=false;this.faultResetAt=0;
    this.temperature=21.4;this.pressure=101.3;this.bayPressure=101.3;this.innerDoorOpening=0;this.fault=null;this.schedule();
  }
  schedule(){
    const start=Math.max(this.clock,this.faultResetAt);
    this.nextFault=start+HATCH_FAULT_INTERVAL.min+this.random()*(HATCH_FAULT_INTERVAL.max-HATCH_FAULT_INTERVAL.min);
  }
  triggerFault(){
    if(this.fault)return false;
    this.fault={id:'airlock',serviceStation:'airlock',kind:'depressurization',serial:++this.serial,stage:'detected',sealed:false};
    this.faultResetAt=this.clock+HATCH_FAULT_RESET_DELAY;
    this.onEvent({type:'fault',...this.fault});return true;
  }
  get airlockInterlocked(){return Math.abs(this.pressure-this.bayPressure)>EVA_PRESSURE.safeDifference;}
  get readyToVerify(){return Boolean(this.fault?.sealed)&&Math.abs(this.pressure-this.bayPressure)<=EVA_PRESSURE.safeDifference;}
  get leakFlow(){return this.fault&&!this.fault.sealed?this.bayPressure/101.3:0;}
  update(dt,{bayOccupied=false}={}){
    if(!Number.isFinite(dt)||dt<=0)return;
    const previousAmbient=ambientPressure(this.clock);
    this.clock+=dt;
    const ambient=ambientPressure(this.clock);
    this.temperature=21.4+.38*Math.sin(this.clock/83)+.16*Math.sin(this.clock/27);
    this.pressure=ambient+this.pressureBias;
    this.bayPressure=Math.max(0,this.bayPressure+ambient-previousAmbient);
    if(this.fault&&!this.fault.sealed)this.bayPressure*=Math.exp(-dt/EVA_PRESSURE.leakTimeConstant);
    if(this.equalizationRequested||this.innerDoorOpening>.01){
      // Pressure-volume transfer conserves the gas shared by both rooms.
      // The larger cabin loses exactly what the small compartment gains.
      const rate=this.innerDoorOpening>.01?20:EVA_PRESSURE.valveRate;
      const transfer=(this.pressure-this.bayPressure)*(1-Math.exp(-rate*dt))/(1+EVA_PRESSURE.bayVolume/EVA_PRESSURE.cabinVolume);
      this.bayPressure+=transfer;
      const cabinLoss=transfer*EVA_PRESSURE.bayVolume/EVA_PRESSURE.cabinVolume;
      this.pressure-=cabinLoss;this.pressureBias-=cabinLoss;
    }
    // Scripted incidents wait for an empty room. Never seal an unsuited crew
    // member inside a depressurizing compartment or close across a crossing.
    if(!this.fault&&!bayOccupied&&this.clock>=this.nextFault)this.triggerFault();
  }
  setStage(serial,stage){
    if(this.fault?.serial!==serial||this.fault.stage===stage)return;
    if(stage==='verify')this.fault.sealed=true;
    this.fault.stage=stage;this.onEvent({type:'stage',...this.fault});
  }
  resolve(serial){
    if(this.fault?.serial!==serial||Math.abs(this.pressure-this.bayPressure)>EVA_PRESSURE.safeDifference)return false;
    this.fault=null;this.schedule();this.onEvent({type:'restored',serial});return true;
  }
}

export function environmentDisplay(environment,lang='ja'){
  const abnormal=Boolean(environment.fault),ja=lang==='ja';
  return{state:abnormal?'abnormal':'normal',
    label:ja?(abnormal?'船内環境 異常':'船内環境 正常'):(abnormal?'LIFE SUPPORT ALERT':'LIFE SUPPORT NOMINAL'),
    issue:abnormal?(ja?`宇宙服室 ${environment.fault.sealed?'確認中':'漏気'} ${environment.bayPressure.toFixed(1)} kPa`:`EVA BAY ${environment.bayPressure.toFixed(1)} kPa`):'',
    temperature:`${environment.temperature.toFixed(1)}°C`,pressure:`${environment.pressure.toFixed(1)} kPa`,
    detail:abnormal?(ja?'船外ハッチの小さなシール漏れ。漏れは修理まで継続します。扉を開ける前に圧力差を確認します。':'Small outer hatch seal leak. Flow continues until repair. Verify differential pressure before opening the inner hatch.'):''};
}
