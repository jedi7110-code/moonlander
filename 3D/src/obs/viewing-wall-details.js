import {CanvasTexture,Group,Mesh,MeshBasicMaterial,SRGBColorSpace} from 'three';
import {box,cylinder} from './materials.js';
import {openPanelBox,panelFaceGeometry} from './panel-surfaces.js';
import {VIEWING_WALL,viewingWallPanelX} from './viewing-wall-profile.js';

// Reuse the five bays vacated by extinguishers; windows and existing controls
// keep their positions. These details live only on the three-face POV wall.
export const VIEWING_WALL_DETAILS=[
  {deck:0,panel:7,kind:'service'},{deck:0,panel:15,kind:'service'},
  {deck:1,panel:7,kind:'monitor'},
  {deck:2,panel:3,kind:'monitor'},{deck:2,panel:15,kind:'service'},
];

const W=640,H=400,MONITOR_WIDTH=.96,MONITOR_HEIGHT=.60,FRONT=.145;
const SCREEN=[28,42,410,281,-.028];
const CONTROLS=[
  SCREEN,[469,34,143,90,.012],
  [471,162,24,56,.022],[505,162,24,56,.022],[539,162,24,56,.022],
  [574,164,38,52,.017],[487,285,38,54,.024],[550,285,38,54,.024],
];

function monitorTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d');
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const text=(s,x,y,size=10,color='#8c9a98')=>{c.fillStyle=color;c.font=`${size}px monospace`;c.fillText(s,x,y);};
  rect(0,0,W,H,'#303936');rect(7,7,W-14,H-14,'#46504c');rect(11,11,W-22,H-22,'#262f2e');
  rect(16,30,434,305,'#7a8580');rect(21,35,424,295,'#111b20');
  rect(28,42,410,281,'#030d1d');
  const cx=224,cy=182,r=119;
  c.strokeStyle='#225798';c.lineWidth=1.2;
  c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();
  // Project a fixed point cloud onto a globe. The sphere stays round because
  // every face below samples this one atlas at the same physical pixel scale.
  for(let i=0;i<780;i++){
    const y=1-2*(i+.5)/780,phi=i*2.3999632297,rr=Math.sqrt(1-y*y);
    const x=Math.cos(phi)*rr,z=Math.sin(phi)*rr;if(z<-.12)continue;
    c.fillStyle=z>.55?'#69b9ff':z>.05?'#3a85d5':'#214c88';
    const size=z>.55?2.2:1.5;c.fillRect(cx+x*r,cy+y*r,size,size);
  }
  c.strokeStyle='#326faf';c.lineWidth=1.2;
  for(const tilt of [-.54,0,.54]){
    c.beginPath();
    for(let i=0;i<=80;i++){
      const t=i/80*Math.PI*2,x=Math.cos(t)*r, y=Math.sin(t)*r*.19+tilt*r;
      if(i)c.lineTo(cx+x*Math.sqrt(1-tilt*tilt),cy+y);else c.moveTo(cx+x*Math.sqrt(1-tilt*tilt),cy+y);
    }c.stroke();
  }
  c.strokeStyle='#7bbbeb';c.beginPath();c.moveTo(63,184);c.lineTo(375,184);c.stroke();
  text('ORBIT / LOCAL',41,60,9,'#669aca');text('RNG 0048',42,306,9,'#669aca');text('LINK  03',350,306,9,'#669aca');
  rect(469,34,143,90,'#475550');
  for(let row=0;row<5;row++)for(let col=0;col<7;col++){
    const x=478+col*18,y=42+row*15;c.strokeStyle='#101b1d';c.lineWidth=5;
    c.beginPath();c.moveTo(x,y+7);c.lineTo(x+7,y);c.stroke();
  }
  for(const x of [471,505,539]){
    rect(x,162,24,56,'#792f30');rect(x+3,165,18,48,'#bd5a57');rect(x+3,165,4,48,'#dc7a6d');
  }
  rect(574,164,38,52,'#4b5650');
  c.strokeStyle='#121c1b';c.lineWidth=4;c.beginPath();c.arc(593,190,13,0,Math.PI*2);c.stroke();
  c.strokeStyle='#aeb8a9';c.lineWidth=3;c.beginPath();c.moveTo(593,190);c.lineTo(599,181);c.stroke();
  for(const x of [487,550]){
    rect(x,285,38,54,'#748787');rect(x+3,288,31,47,'#d5e4dd');rect(x+6,291,3,36,'#f0f3dc');
  }
  text('LOCAL  /  REMOTE',472,261,10);text('AUX NAVIGATION',475,366,10);
  for(let i=0;i<7;i++)rect(45+i*17,12,11,8,i===5?'#6baddb':'#b9ceca');
  for(let i=0;i<3;i++){
    c.fillStyle=['#ae5651','#abc3b7','#7ba3bd'][i];c.beginPath();c.arc(33+i*21,365,5,0,Math.PI*2);c.fill();
  }
  text('VECTOR  /  02',227,367,12);
  for(const [x,y]of [[13,15],[626,15],[13,385],[626,385],[456,144],[457,351]]){
    rect(x-3,y-3,6,6,'#83918a');rect(x-2,y,4,1,'#182323');
  }
  // Small fixed edge chips, not a high-resolution asset or animated canvas.
  for(let i=0;i<65;i++){
    const x=13+(i*79)%610,y=i%2?14:382;
    rect(x,y,2+i%5,1,'#8c9990');
  }
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
  texture.name='POV / shared navigation monitor atlas';return texture;
}

function navigationMonitor(m,artwork){
  const root=new Group();root.name='POV / navigation monitor';
  openPanelBox(root,m.dark,0,0,FRONT/2,MONITOR_WIDTH,MONITOR_HEIGHT,FRONT).name='Monitor open-front enclosure';
  const face=(x,y,w,h,z,holes=[])=>{
    const geometry=panelFaceGeometry(w/W*MONITOR_WIDTH,h/H*MONITOR_HEIGHT,holes),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i)*w)/W,1-(y+(1-uv.getY(i))*h)/H);
    const mesh=new Mesh(geometry,artwork);mesh.name='Navigation monitor face';
    mesh.position.set(((x+w/2)/W-.5)*MONITOR_WIDTH,(.5-(y+h/2)/H)*MONITOR_HEIGHT,z);root.add(mesh);
  };
  face(0,0,W,H,FRONT,CONTROLS.map(([x,y,w,h])=>[x/W,y/H,w/W,h/H]));
  for(const [x,y,w,h,depth]of CONTROLS){
    const cx=((x+w/2)/W-.5)*MONITOR_WIDTH,cy=(.5-(y+h/2)/H)*MONITOR_HEIGHT;
    openPanelBox(root,m.rubber,cx,cy,FRONT+depth/2,w/W*MONITOR_WIDTH,h/H*MONITOR_HEIGHT,Math.abs(depth)).name='Monitor control surround';
    face(x,y,w,h,FRONT+depth);
  }
  // A vented lower rack gives the small monitor a serviceable mounting assembly.
  box(root,m.dark,0,-.405,.029,.78,.14,.05).name='Monitor lower vent recess';
  for(let i=0;i<3;i++)box(root,m.metal,0,-.448+i*.044,.065,.69,.013,.022).name='Monitor lower vent blade';
  return root;
}

function servicePanel(m,diffuser){
  const root=new Group();root.name='POV / slotted service panel';
  box(root,m.dark,.105,0,.018,.65,1.22,.036).name='Service panel backplate';
  for(const y of [-.526,.526])box(root,m.enamel,.105,y,.050,.63,.13,.034).name='Service panel end cover';
  openPanelBox(root,m.metal,.105,0,.057,.57,.57,.054).name='Service access door edge';
  const door=new Mesh(panelFaceGeometry(.57,.57),m.enamel);door.name='Service access door';door.position.set(.105,0,.084);root.add(door);
  box(root,m.dark,.29,0,.098,.032,.14,.018).name='Access door latch socket';
  box(root,m.metal,.29,0,.120,.021,.095,.026).name='Access door latch';
  for(const y of [-.375,.375]){
    box(root,m.rubber,.105,y,.051,.55,.145,.026).name='Service vent well';
    for(let i=0;i<4;i++)box(root,m.metal,.105,y+(i-1.5)*.033,.082,.48,.013,.025).name='Service vent blade';
  }
  for(const x of [-.135,.345])for(const y of [-.23,.23]){
    const bolt=cylinder(root,m.dark,x,y,.091,.012,.014,.012,6);bolt.rotation.x=Math.PI/2;bolt.name='Service access fastener';
  }
  const lights=new Group();lights.name='POV / narrow light slots';lights.position.x=-.375;root.add(lights);
  box(lights,m.dark,0,0,.025,.18,1.18,.050).name='Slot light backplate';
  for(const x of [-.042,.042])for(const [y,h]of [[-.46,.13],[-.195,.30],[.195,.30],[.46,.13]]){
    const frame=openPanelBox(lights,m.metal,x,y,.064,.041,h+.022,.024);frame.name='Light slot rim';
    const glow=new Mesh(panelFaceGeometry(.032,h,[],.014),diffuser);
    glow.name='Service light slot';glow.position.set(x,y,.077);lights.add(glow);
  }
  return root;
}

export function addViewingWallDetails(parent,m,floors,diffuser){
  const root=new Group();root.name='POV / recessed wall details';parent.add(root);
  const artwork=new MeshBasicMaterial({name:'POV / navigation monitor artwork',map:monitorTexture(),color:0xffffff,toneMapped:false});
  artwork.userData.castShadow=false;
  const templates={service:servicePanel(m,diffuser),monitor:navigationMonitor(m,artwork)};
  for(const {deck,panel,kind}of VIEWING_WALL_DETAILS){
    const detail=templates[kind].clone();detail.name=`POV detail / ${deck} / ${kind}`;
    detail.position.set(viewingWallPanelX(panel),floors[deck]+1.54,VIEWING_WALL.faceZ-.008);detail.rotation.y=Math.PI;
    root.add(detail);
  }
  return root;
}
