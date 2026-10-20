import {createExteriorCargoHatches} from './exterior-cargo-hatch.js';

export function createCargoHatchStudy(ship){
  return createExteriorCargoHatches(ship,{referenceHuman:true});
}
