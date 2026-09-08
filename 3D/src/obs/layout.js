import {FLOORS,LADDER_X,STATIONS as sharedStations} from '../../../js/obs/layout.js?v=15';

export const GYM={id:'gym',floor:2,x:840,need:'exercise',dur:16000};
export const MEDICAL={id:'medical',floor:1,x:912,need:null,dur:14000};
export const CAT_PORT={x:744,walkZ:.89,insideZ:-2.8,wallZ:-1.48,width:.50,height:.66};
export const CAT_BOWL={floor:2,x:490,depth:CAT_PORT.walkZ,approachX:508};
export const EVA={id:'eva',floor:1,x:1111,need:null,dur:8000};
export const AIRLOCK={id:'airlock',floor:1,x:1260,need:null,dur:8000};
export const INNER_HATCH={id:'innerHatch',floor:1,x:990,need:null,dur:8000};
export const EVA_PASSAGE={floor:1,x:1022,approach:48,clearance:27,openTime:.7};
export const STATIONS=[...sharedStations.filter(station=>station.id!=='stereo'),GYM,MEDICAL,EVA,AIRLOCK,INNER_HATCH];
export const getStation=id=>STATIONS.find(station=>station.id===id);
export {FLOORS,LADDER_X};
