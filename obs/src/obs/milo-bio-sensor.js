import * as THREE from 'three';
import {wristSections,strapGeometry} from './milo-watch.js';

const bandWidth=.022,segments=48;
const displayMaps=new Map();
function screenTexture(alert=false){
  if(typeof document==='undefined')return null;
  if(displayMaps.has(alert))return displayMaps.get(alert);
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;
  const c=canvas.getContext('2d');
  // Neutral phosphor is tinted by the live material, including toon clones.
  c.fillStyle='#080808';c.fillRect(0,0,384,256);
  c.fillStyle='#ffffff';c.shadowColor='#ffffff';c.shadowBlur=5;
  c.font='bold 24px monospace';c.fillText(alert?'BIO / ALERT':'BIO / PULSE',22,35);
  c.font=`bold ${alert?72:106}px monospace`;c.fillText(alert?'HIGH':'072',18,144);
  c.font='22px monospace';c.fillText(alert?'TEMP':'BPM',267,133);
  c.strokeStyle='#e4e4e4';c.lineWidth=3.5;c.lineJoin='round';c.beginPath();
  [[22,181],[111,181],[129,172],[143,188],[157,155],[172,205],[186,181],[222,181],[232,173],[248,181],[356,181]].forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  c.font='21px monospace';c.fillText(alert?'CHECK HEALTH':'TEMP 36.6',22,238);c.fillText(alert?'!':'OK',315,238);
  const displayMap=new THREE.CanvasTexture(canvas);displayMap.colorSpace=THREE.SRGBColorSpace;displayMap.anisotropy=4;
  displayMaps.set(alert,displayMap);
  return displayMap;
}
function panelPath(width,height,corner,Path=THREE.Shape){
  const p=new Path(),x=width/2,y=height/2;
  p.moveTo(-x+corner,-y);p.lineTo(x-corner,-y);p.lineTo(x,-y+corner);p.lineTo(x,y-corner);
  p.lineTo(x-corner,y);p.lineTo(-x+corner,y);p.lineTo(-x,y-corner);p.lineTo(-x,-y+corner);p.closePath();return p;
}
function part(parent,geometry,material,name){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function attachMiloBioSensor(root){
  const {arms,bodySkin:skin}=root.userData;
  // Anatomical left is +X; the imported skeleton uses the legacy R prefix.
  const left=arms.find(rig=>rig.side===1),parent=skin?.skeleton.bones.find(bone=>bone.name==='Milo skin R_wrist2')?.parent??left.hand;
  const previous=left.hand.quaternion.clone();left.hand.rotation.set(0,Math.PI/2,0);root.userData.updateWristTwists?.();
  const group=new THREE.Group();group.name='Milo left wrist bio sensor';parent.add(group);
  group.position.set(skin ? .020 : 0,.004,skin ? -.013 : 0);group.rotation.y=skin?Math.PI/6:0;
  root.updateMatrixWorld(true);
  const radii=wristSections(skin,group,bandWidth,segments)??[0,1].map(()=>Array.from({length:segments},(_,i)=>1/Math.hypot(Math.cos(i/segments*Math.PI*2)/.029,Math.sin(i/segments*Math.PI*2)/.024)));
  const rubber=new THREE.MeshStandardMaterial({color:0x202927,roughness:.9,side:THREE.DoubleSide});
  part(group,strapGeometry(radii,{width:bandWidth,thickness:.0018}),rubber,'Fitted bio sensor band');
  const housing=new THREE.Group();housing.name='Bio sensor 34 mm monitor';group.add(housing);
  housing.rotation.z=-Math.PI/2;housing.position.z=Math.max(radii[0][segments/4],radii[1][segments/4])+.0018;
  const shell=panelPath(.034,.027,.004);shell.holes.push(panelPath(.026,.019,.0015,THREE.Path));
  const frame=part(housing,new THREE.ExtrudeGeometry(shell,{depth:.006,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.0006,bevelThickness:.0006,curveSegments:1}),new THREE.MeshStandardMaterial({color:0x394744,roughness:.44,metalness:.65}),'Chamfered bio sensor bezel');
  frame.position.z=-.003;
  const back=part(housing,new THREE.BoxGeometry(.030,.023,.002),rubber,'Bio sensor backing');back.position.z=-.0035;
  // One opaque image carries all phosphor detail; no extra light, bloom pass,
  // glass overlay or stacked text planes that could flicker in the OBS camera.
  const display=part(housing,new THREE.ShapeGeometry(panelPath(.026,.019,.0015)),new THREE.MeshBasicMaterial({map:screenTexture(),color:0x76eea0,toneMapped:false,depthWrite:false}),'Bio sensor phosphor display');
  // ShapeGeometry UVs are in metres. Normalize them into the screen image.
  const uv=display.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/.026+.5,uv.getY(i)/.019+.5);
  display.position.z=.0037;display.renderOrder=1;display.castShadow=false;display.receiveShadow=false;
  root.userData.bioSensor={group,parent,radii,display,side:1};
  left.hand.quaternion.copy(previous);root.userData.updateWristTwists?.();root.updateMatrixWorld(true);
  return group;
}

export function updateMiloBioSensor(root,health=null){
  const sensor=root.userData.bioSensor;if(!sensor)return;
  const alert=health?.condition?.kind==='fever'||health?.treatment?.kind==='fever';
  const material=sensor.display.material;
  if(sensor.alert===alert&&sensor.lastMaterial===material)return;
  sensor.alert=alert;sensor.lastMaterial=material;
  material.color.setHex(alert?0xff5147:0x76eea0);
  material.map=screenTexture(alert);
}
