import {createExteriorMothership} from './exterior-mothership.js';
import {createExteriorProbe} from './exterior-probe.js';
export {EXTERIOR,exteriorAngle,rotationGravity} from './exterior-mothership.js';

// The free study and synchronous model consumers still request both craft.
export function createExteriorShip(){
  return createExteriorMothership().addProbe(createExteriorProbe);
}
