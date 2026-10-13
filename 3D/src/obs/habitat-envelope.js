import {CABIN_FLOOR_Y,getStation} from './layout.js';
import {VIEWING_WALL,viewingWallWindow,viewingWallPanelX} from './viewing-wall-profile.js';
import {BATHROOM_WINDOW,OPERATIONS_REAR_WINDOW} from './bathroom-window-layout.js';
import {BULKHEAD_GATE} from './bulkhead-gate-layout.js';

// This is a one-to-one enclosure for the existing OBS cabin, in metres.
// Cabin +Y points toward the rotation axis. Rotate it by PI about X so the
// floors, underdeck tanks and windows keep a right-handed coordinate system.
export const HABITAT_FLOORS=CABIN_FLOOR_Y;
export const HABITAT_ENVELOPE=Object.freeze({
  left:-13.92,right:13.92,bottom:-1.50,top:10.775,
  front:VIEWING_WALL.faceZ+.24,back:2.50, // back is a distance behind cabin zero
  rearRoomBack:-(BULKHEAD_GATE.back-.30),
  centerY:(10.775-1.50)/2,
});
export const cabinToHabitat=({x,y,z})=>({x,y:HABITAT_ENVELOPE.centerY-y,z:-z});
export const habitatToCabin=({x,y,z})=>({x,y:HABITAT_ENVELOPE.centerY-y,z:-z});
const windows=[];
for(const [level,floor]of HABITAT_FLOORS.entries())for(let i=0;i<VIEWING_WALL.count;i++)if(viewingWallWindow(i))windows.push({
  id:`corridor-${level}-${i}`,face:'corridor',level,x:viewingWallPanelX(i),y:floor+VIEWING_WALL.windowY,
  z:VIEWING_WALL.faceZ+.145,width:VIEWING_WALL.windowWidth,height:VIEWING_WALL.windowHeight,cut:.12,
});
for(const id of ['shower','toilet']){
  const station=getStation(id);windows.push({id,face:'rear',level:station.floor,x:(station.x-700)*.022,
    y:HABITAT_FLOORS[station.floor]+BATHROOM_WINDOW.y,z:BATHROOM_WINDOW.wallBack+.012,
    width:BATHROOM_WINDOW.width,height:BATHROOM_WINDOW.height,cut:.12});
}
windows.push({id:'operations-room',face:'rear',level:0,x:BULKHEAD_GATE.x,
  y:HABITAT_FLOORS[0]+OPERATIONS_REAR_WINDOW.y,z:BULKHEAD_GATE.back-.08+.012,
  width:OPERATIONS_REAR_WINDOW.width,height:OPERATIONS_REAR_WINDOW.height,cut:.12});
export const HABITAT_WINDOWS=Object.freeze(windows.map(window=>Object.freeze(window)));
export const HABITAT_REAR_ROOMS=Object.freeze([
  {id:'rear-service-room',x:BULKHEAD_GATE.x,y:.025,width:2.65,height:9.93,back:HABITAT_ENVELOPE.rearRoomBack},
  ...['shower','toilet'].map(id=>{const s=getStation(id);return{id,x:(s.x-700)*.022,
    y:HABITAT_FLOORS[s.floor]+.12,width:1.90,height:2.78,back:-BATHROOM_WINDOW.wallBack+.22};}),
]);
