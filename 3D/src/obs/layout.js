import {FLOORS,LADDER_X,STATIONS as sharedStations} from '../../../js/obs/layout.js?v=15';

export const GYM={id:'gym',floor:2,x:840,need:'exercise',dur:16000};
export const PLANT={id:'plant',floor:2,x:385,need:null,dur:9000};
export const MEDICAL={id:'medical',floor:1,x:912,need:null,dur:14000};
export const CAT_PORT={x:744,walkZ:.89,insideZ:-2.8,wallZ:-1.48,width:.50,height:.66};
export const CAT_SCALE=.8;
export const CAT_BOWL={floor:2,x:490,depth:CAT_PORT.walkZ,approachX:490+18*CAT_SCALE,foodHeight:.14};
export const LOUNGE_SEAT={depth:.06,top:.48,centerDepth:-.10,cushionDepth:.60};
export const CAT_SOFA={floorX:1005,seatX:1035};
export const EVA={id:'eva',floor:1,x:1111,need:null,dur:8000};
export const AIRLOCK={id:'airlock',floor:1,x:1260,need:null,dur:8000};
export const INNER_HATCH={id:'innerHatch',floor:1,x:990,need:null,dur:8000};
export const EVA_PASSAGE={floor:1,x:1022,approach:48,clearance:27,openTime:.7};
export const STATIONS=[...sharedStations.filter(station=>station.id!=='stereo').map(station=>['galley','hydro'].includes(station.id)?{...station,dur:station.id==='galley'?10000:8000}:station),GYM,MEDICAL,EVA,AIRLOCK,INNER_HATCH,PLANT];
export const getStation=id=>STATIONS.find(station=>station.id===id);
export {FLOORS,LADDER_X};
