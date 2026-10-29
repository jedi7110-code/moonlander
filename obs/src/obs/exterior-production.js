import {createExteriorMothership} from './exterior-mothership.js';
import {createExteriorPanelStudy} from './exterior-panel-study.js';
import {createProbeLineStudy} from './exterior-probe-line-study.js';
import {createExteriorCargoHatches} from './exterior-cargo-hatch.js';

// Shared approved seam treatment for the free study and opening film.
export const EXTERIOR_SOFT_PANEL_LINES=Object.freeze({width:1.5,color:0x73796e,samples:4});

// The approved finish is shared by the OBS opening, free exterior and previews.
// Probe construction stays lazy; its finish is ready before shader warm-up.
export function createProductionExterior({original=false,panelLines=null}={}){
  const ship=createExteriorMothership();
  if(original)return ship;
  const panels=createExteriorPanelStudy(ship,{replaceSkin:true,seamWidth:panelLines?.width??1,seamColor:panelLines?.color??0x50564f});
  panels.setEnabled(true);panels.setWeathering(true);
  ship.finish={mothership:'B',probe:'A / dark seams',panels:panels.stats,
    panelLines:{width:panelLines?.width??1,color:panelLines?.color??0x50564f}};
  const prepare=ship.prepareProbe.bind(ship),dispose=ship.dispose.bind(ship),setWear=ship.setWear.bind(ship),setCoreScale=ship.setCoreScale.bind(ship);
  let probeLines=null,disposed=false,wear=true;
  ship.cargoHatches=null;
  ship.finish.cargoHatches=false;
  ship.setCoreScale=value=>{
    if(disposed)return ship.coreScale;
    const previous=ship.coreScale,scale=setCoreScale(value);
    if(scale!==previous){
      ship.cargoHatches?.dispose();
      ship.cargoHatches=scale>=2.3?createExteriorCargoHatches(ship):null;
      ship.cargoHatches?.setEnabled(true);
      ship.finish.cargoHatches=Boolean(ship.cargoHatches);
    }
    return scale;
  };
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
  ship.dispose=()=>{if(disposed)return;disposed=true;ship.cargoHatches?.dispose();probeLines?.dispose();panels.dispose();dispose();};
  return ship;
}
