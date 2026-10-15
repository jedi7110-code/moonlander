import {createExteriorMothership} from './exterior-mothership.js';
import {createExteriorPanelStudy} from './exterior-panel-study.js';
import {createProbeLineStudy} from './exterior-probe-line-study.js';

// The approved finish is shared by the OBS opening and movie previews.
// Probe construction stays lazy; its finish is ready before shader warm-up.
export function createProductionExterior({original=false}={}){
  const ship=createExteriorMothership();
  if(original)return ship;
  const panels=createExteriorPanelStudy(ship,{replaceSkin:true});
  panels.setEnabled(true);panels.setWeathering(true);
  ship.finish={mothership:'B',probe:'A / dark seams',panels:panels.stats};
  const prepare=ship.prepareProbe.bind(ship),dispose=ship.dispose.bind(ship);
  let probeLines=null,disposed=false;
  ship.prepareProbe=async()=>{
    await prepare();
    if(!disposed&&!probeLines&&ship.dockedLander){probeLines=createProbeLineStudy(ship);probeLines.setEnabled(true);}
    return ship;
  };
  ship.dispose=()=>{disposed=true;probeLines?.dispose();panels.dispose();dispose();};
  return ship;
}
