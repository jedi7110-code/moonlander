import {createExteriorMothership} from './exterior-mothership.js';
import {createExteriorPanelStudy} from './exterior-panel-study.js';
import {createProbeLineStudy} from './exterior-probe-line-study.js';

// The approved finish is shared by the OBS opening, free exterior and previews.
// Probe construction stays lazy; its finish is ready before shader warm-up.
export function createProductionExterior({original=false,panelLines=null}={}){
  const ship=createExteriorMothership();
  if(original)return ship;
  const panels=createExteriorPanelStudy(ship,{replaceSkin:true,seamWidth:panelLines?.width??1,seamColor:panelLines?.color??0x50564f});
  panels.setEnabled(true);panels.setWeathering(true);
  ship.finish={mothership:'B',probe:'A / dark seams',panels:panels.stats};
  const prepare=ship.prepareProbe.bind(ship),dispose=ship.dispose.bind(ship),setWear=ship.setWear.bind(ship);
  let probeLines=null,disposed=false,wear=true;
  const finishProbe=()=>{
    if(!disposed&&!probeLines&&ship.dockedLander){probeLines=createProbeLineStudy(ship);probeLines.setEnabled(true);}
  };
  ship.prepareProbe=async()=>{
    await prepare();
    if(!disposed&&!probeLines){setWear(wear);finishProbe();}
    return ship;
  };
  // Free-view wear controls must update B's paint while retaining A's dark ink.
  ship.setWear=value=>{
    wear=Boolean(value);probeLines?.dispose();probeLines=null;
    setWear(wear);panels.setWeathering(wear);finishProbe();
  };
  ship.dispose=()=>{disposed=true;probeLines?.dispose();panels.dispose();dispose();};
  return ship;
}
