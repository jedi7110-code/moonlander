import {FLOORS as sharedFloors,LADDER_X,STATIONS as sharedStations} from '../../../js/obs/layout.js?v=15';

export const DECK={OPERATIONS:0,HABITATION:1,LIFE_SUPPORT:2};
export const FLOORS=sharedFloors.map((floor,index)=>({...floor,name:['OPERATIONS','HABITATION','LIFE SUPPORT'][index]}));
const cabinFloor=floor=>floor===0?DECK.HABITATION:floor===1?DECK.OPERATIONS:floor;

export const GYM={id:'gym',floor:2,x:840,need:'exercise',dur:16000};
export const PLANT={id:'plant',floor:2,x:385,need:null,dur:9000};
export const MEDICAL={id:'medical',floor:DECK.OPERATIONS,x:912,need:null,dur:14000};
export const CABIN_AISLE={crewZ:.78,catZ:1.92,deckBack:-1.81,deckFront:2.55,crossingClearance:48};
export const HYDRO_TRAY={depth:.40,z:-.40,cupZ:-.28,standZ:.10};
export const CAT_PORT={x:744,walkZ:CABIN_AISLE.catZ,insideZ:-2.8,wallZ:-1.48,width:.50,height:.66};
export const CAT_SCALE=.8;
export const CAT_BOWL={floor:2,x:490,depth:.89,approachX:490+18*CAT_SCALE,foodHeight:.14,foodColor:0x7e5532};
export const WASTE_INCINERATOR={floor:2,x:-12.10,z:-.39,width:.80,height:.96,depth:.86,approachZ:.68,depositAt:1.7,insertDuration:3.1,burnDuration:3};
export const LOUNGE_SEAT={depth:.06,top:.48,centerDepth:-.10,cushionDepth:.60};
export const CAT_SOFA={floor:DECK.HABITATION,floorX:1005,seatX:1035,approachZ:.89};
export const EVA={id:'eva',floor:DECK.OPERATIONS,x:1111,need:null,dur:8000};
export const AIRLOCK={id:'airlock',floor:DECK.OPERATIONS,x:1260,need:null,dur:8000};
export const INNER_HATCH={id:'innerHatch',floor:DECK.OPERATIONS,x:990,need:null,dur:8000};
export const EVA_PASSAGE={floor:DECK.OPERATIONS,x:1022,approach:48,clearance:27,openTime:.7};
export const STATIONS=[...sharedStations.filter(station=>station.id!=='stereo').map(station=>({...station,floor:cabinFloor(station.floor),...(station.id==='hydro'?{x:528}:{}),...(['galley','hydro'].includes(station.id)?{dur:station.id==='galley'?10000:8000}:{})})),GYM,MEDICAL,EVA,AIRLOCK,INNER_HATCH,PLANT];
export const getStation=id=>STATIONS.find(station=>station.id===id);
export {LADDER_X};
