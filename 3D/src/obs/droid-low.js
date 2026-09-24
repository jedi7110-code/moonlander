import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createDroidSurfaceAtlas,createDroidFaceAtlas,DROID_TILES as T} from './droid-textures.js';

const V=(...v)=>new THREE.Vector3(...v),UP=V(0,1,0);
function atlasUV(geometry,tile,columns=4,rows=4){
  const uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(tile%columns+.025+uv.getX(i)*.95)/columns,(Math.floor(tile/columns)+.025+(1-uv.getY(i))*.95)/rows);
  return geometry;
}
function part(parent,m,geometry,p,tile){
  const mesh=new THREE.Mesh(atlasUV(geometry,tile),m.body);mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
const box=(parent,m,p,size,tile=T.steel)=>part(parent,m,new THREE.BoxGeometry(...size),p,tile);
function bar(parent,m,a,b,r=.012,tile=T.steel){
  const start=V(...a),end=V(...b),delta=end.sub(start);
  const o=box(parent,m,start.clone().addScaledVector(delta,.5).toArray(),[r*2,delta.length(),r*2],tile);o.quaternion.setFromUnitVectors(UP,delta.normalize());return o;
}
function hub(parent,m,p,r=.035,width=.07){
  const g=new THREE.CylinderGeometry(r,r,width,8,1,false);g.rotateZ(Math.PI/2);
  // End faces carry the concentric bearing, fasteners and axle in the bitmap.
  const uv=g.attributes.uv,n=g.attributes.normal,a=g.attributes.position;
  for(let i=0;i<uv.count;i++)if(Math.abs(n.getX(i))>.9)uv.setXY(i,a.getZ(i)/(2*r)+.5,a.getY(i)/(2*r)+.5);
  const mesh=part(parent,m,g,p,T.bearing);
  for(let i=0;i<uv.count;i++)if(Math.abs(n.getX(i))<.9)uv.setXY(i,uv.getX(i)+(T.dark%4-T.bearing%4)/4,uv.getY(i)+(Math.floor(T.dark/4)-Math.floor(T.bearing/4))/4);
  return mesh;
}
function cable(parent,m,points,r,tile){for(let i=1;i<points.length;i++)bar(parent,m,points[i-1],points[i],r,tile);}
function plate(parent,m,points,z,depth,tile,hole){
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));shape.closePath();
  if(hole){const cut=new THREE.Path(hole.slice().reverse().map(p=>new THREE.Vector2(...p)));cut.closePath();shape.holes.push(cut);}
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});geometry.computeBoundingBox();
  const bounds=geometry.boundingBox,size=bounds.getSize(V()),p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)-bounds.min.x)/size.x,(p.getY(i)-bounds.min.y)/size.y);
  return part(parent,m,geometry,[0,0,z],tile);
}
function sidePlate(parent,m,side,x,points,depth,tile){
  const mesh=plate(parent,m,points.map(([z,y])=>[-side*z,y]),0,depth,tile);
  mesh.rotation.y=side*Math.PI/2;mesh.position.x=side*x;return mesh;
}
const outline=(w,h,c)=>[[-w,-h+c],[-w+c,-h],[w-c,-h],[w,-h+c],[w,h-c],[w-c,h],[-w+c,h],[-w,h-c]];
function folded(parent,m,points){
  const a=points.map(p=>V(...p)),n=a[1].clone().sub(a[0]).cross(a[2].clone().sub(a[0])).normalize();
  const p=[...a,...a.map(p=>p.clone().addScaledVector(n,-.006))],ids=[0,1,2,0,2,3,4,6,5,4,7,6];
  for(let i=0;i<4;i++){const j=(i+1)%4;ids.push(i,i+4,j+4,i,j+4,j);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(ids.flatMap(i=>p[i].toArray()),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(ids.flatMap(i=>[[0,0],[0,1],[1,1],[1,0]][i%4]),2));geometry.computeVertexNormals();return part(parent,m,geometry,[0,0,0],T.paint);
}
function group(parent,name,p=[0,0,0]){const g=new THREE.Group();g.name=name;g.position.set(...p);parent.add(g);return g;}

function profileHousing(parent,m,p,w,profile,tile){
  const shape=new THREE.Shape(profile.map(v=>new THREE.Vector2(...v)));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:w,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.rotateY(-Math.PI/2);geometry.translate(w/2,0,0);
  geometry.computeBoundingBox();const bounds=geometry.boundingBox,size=bounds.getSize(V());
  const position=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<position.count;i++){
    const x=(position.getX(i)-bounds.min.x)/size.x,y=(position.getY(i)-bounds.min.y)/size.y,z=(position.getZ(i)-bounds.min.z)/size.z;
    if(Math.abs(normal.getX(i))>.5)uv.setXY(i,z,y);
    else if(Math.abs(normal.getZ(i))>.5)uv.setXY(i,x,y);
    else uv.setXY(i,x,z);
  }
  return part(parent,m,geometry,p,tile);
}
function chestModule(parent,m,p,size,tile){
  const [w,h,d]=size;
  // A deep equipment housing with folded top/bottom edges, open between modules.
  const profile=[[-d/2,-h/2],[d*.16,-h/2],[d/2,-h*.36],[d/2,h*.36],[d*.16,h/2],[-d/2,h/2]];
  return profileHousing(parent,m,p,w,profile,tile);
}

function headAssembly(parent,m,names){
  const head=group(parent,'OBS droid / chamfered visor head');
  plate(head,m,outline(.116,.104,.025),-.105,.237,T.dark,outline(.103,.090,.016));
  plate(head,m,outline(.124,.107,.025),.139,.008,T.paint,outline(.104,.087,.014));
  box(head,m,[0,0,-.091],[.212,.179,.017],T.vent);
  box(head,m,[0,0,.113],[.211,.177,.020],T.dark);
  folded(head,m,[[-.088,.140,-.065],[-.095,.114,.180],[.095,.114,.180],[.088,.140,-.065]]);
  folded(head,m,[[-.088,.140,-.065],[-.121,.108,-.065],[-.128,.086,.174],[-.095,.114,.180]]);
  folded(head,m,[[.088,.140,-.065],[.095,.114,.180],[.128,.086,.174],[.121,.108,-.065]]);
  // Preserve the detailed head's cheek silhouette, with the upper/lower front
  // corners cut back; fasteners and surface wear remain in the shared atlas.
  const cheek=[[.134,.036],[.073,.097],[-.055,.098],[-.093,.067],[-.091,-.077],[-.061,-.105],[.075,-.100],[.108,-.062]];
  const mount=Array.from({length:8},(_,i)=>{const a=(i+.5)*Math.PI/4;return [-.022+Math.cos(a)*.066,-.008+Math.sin(a)*.066];});
  for(const side of [-1,1]){
    sidePlate(head,m,side,.114,cheek,.005,T.paint);
    sidePlate(head,m,side,.118,mount,.004,T.paint);
    hub(head,m,[side*.136,-.008,-.022],.049,.031);
    box(head,m,[side*.087,-.071,-.125],[.047,.058,.026],T.circuit);
  }
  box(head,m,[0,-.116,-.014],[.125,.025,.14],T.circuit);
  cable(head,m,[[-.074,.133,-.07],[-.07,.153,-.076],[.07,.153,-.076],[.074,.133,-.07]],.006,T.dark);
  cable(head,m,[[.094,-.039,-.108],[.08,-.099,-.144],[.044,-.126,-.092]],.005,T.copper);
  const faceMesh=new THREE.Mesh(new THREE.PlaneGeometry(.208,.172),m.amber);faceMesh.name='OBS droid / nixie expression image';faceMesh.position.z=.127;head.add(faceMesh);
  const expressions=Object.fromEntries(names.map(name=>[name,group(head,'Expression / '+name)]));
  const eyes=[-1,1].map(side=>{const eye=new THREE.Object3D();eye.position.set(side*.048,.026,.127);head.add(eye);return eye;});
  const original=faceMesh.geometry.attributes.uv.array.slice();let current=null;
  const setExpression=name=>{
    const tile=names.indexOf(name);if(tile<0)return false;if(name===current)return true;current=name;
    const uv=faceMesh.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(tile%4+original[i*2])/4,(Math.floor(tile/4)+1-original[i*2+1])/2);
    uv.needsUpdate=true;for(const [id,g]of Object.entries(expressions))g.visible=id===name;return true;
  };
  setExpression('neutral');return {head,face:{eyes,expressions,setExpression,get expression(){return current;}}};
}
function limb(parent,m,length,kind,side){
  const g=group(parent,kind),leg=kind.includes('leg'),w=leg?.043:.030;
  hub(g,m,[0,0,0],leg?.042:.034,leg?.082:.07);
  for(const x of [-w,w])bar(g,m,[x,-.035,-.013],[x,-length+.025,-.013],.009,T.dark);
  box(g,m,[0,-length*.42,.023],[leg?.044:.033,length*.44,.045],T.steel);
  box(g,m,[0,-length*.75,.023],[leg?.023:.018,length*.28,.023],T.bright);
  box(g,m,[side*w*.60,-length*.43,.051],[leg?.066:.053,length*.43,.011],T.limb);
  cable(g,m,[[side*w,-.025,-.016],[side*(w+.013),-length*.26,-.031],[side*(w+.013),-length*.8,-.03],[side*w,-length+.025,-.015]],.004,T.copper);
  return g;
}
function knee(parent,m,length,side){
  const g=group(parent,'Knee to reverse hock link');hub(g,m,[0,0,0],.047,.104);
  for(const x of [-.046,.046])box(g,m,[x,-length*.5,0],[.018,length-.075,.074],T.panel);
  bar(g,m,[0,-.04,-.028],[0,-length+.035,-.028],.009,T.dark);
  // Keep the red return line behind each reverse knee, attached to this link.
  cable(g,m,[[side*.060,-.021,-.014],[side*.070,-.075,-.047],[side*.073,-.20,-.050],[side*.059,-length+.015,-.008]],.006,T.copper);
  return g;
}
function hand(parent,m,side){
  const g=group(parent,side<0?'Left service hand':'Right service hand');hub(g,m,[0,0,0],.022,.051);
  box(g,m,[0,-.041,0],[.074,.071,.036],T.panel);const fingers=[];
  for(let i=0;i<4;i++){
    const chain=[];let joint=group(g,'Finger base',[(i-1.5)*.020,-.076,0]);
    for(let j=0;j<3;j++){
      const length=(j===0?.027:j===1?.023:.019)*(i===0||i===3?.87:1);
      box(joint,m,[0,-length/2,0],[.013,length-.003,.015],j===2?T.rubber:T.steel);chain.push(joint);joint=group(joint,'Finger joint',[0,-length,0]);
    }
    fingers.push(chain);
  }
  const thumb=group(g,'Opposed thumb',[side*.044,-.021,.004]);thumb.rotation.z=side*.7;
  box(thumb,m,[side*.006,-.032,.012],[.022,.051,.024],T.dark);
  const grip=new THREE.Object3D();grip.position.set(0,-.082,.018);g.add(grip);
  const carryGrip=new THREE.Object3D();carryGrip.name='Palm side contact';carryGrip.position.set(0,-.041,.018);g.add(carryGrip);
  const ladderGrip=new THREE.Object3D();ladderGrip.position.set(0,-.076,.036);g.add(ladderGrip);
  return {root:g,fingers,thumb,grip,carryGrip,ladderGrip};
}
function toeCap(parent,m,x){
  // A flat tread, a sloping nose and a short vertical lip above the sole.
  const profile=[[-.0695,-.020],[.0695,-.020],[.0695,-.004],[.0395,.020],[-.0695,.020]];
  const shape=new THREE.Shape(profile.map(p=>new THREE.Vector2(...p)));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.rotateY(-Math.PI/2);geometry.translate(.0325,0,0);
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    if(Math.abs(n.getY(i))>.5)uv.setXY(i,p.getX(i)/.065+.5,p.getZ(i)/.139+.5);
    else if(Math.abs(n.getX(i))>.5)uv.setXY(i,p.getZ(i)/.139+.5,p.getY(i)/.04+.5);
    else uv.setXY(i,p.getX(i)/.065+.5,p.getY(i)/.04+.5);
  }
  return part(parent,m,geometry,[x,-.052,.112],T.foot);
}
function foot(parent,m){
  const g=group(parent,'Grounded foot');hub(g,m,[0,0,0],.032,.077);
  box(g,m,[0,-.081,.030],[.145,.036,.274],T.dark);box(g,m,[0,-.052,-.038],[.140,.032,.131],T.foot);
  // Keep both heel braces at the detailed model's ankle-to-heel mounts.
  for(const side of [-1,1])bar(g,m,[side*.035,.005,-.015],[side*.052,-.047,-.077],.012,T.steel);
  for(const x of [-.038,.038])toeCap(g,m,x);return g;
}

export function createDroidLowParts(spec,expressions,expressionPaths){
  const texture=createDroidSurfaceAtlas(),faceTexture=createDroidFaceAtlas(Object.keys(expressions),expressionPaths);
  const body=new THREE.MeshStandardMaterial({name:'Droid OBS / textured machined frame',map:texture,color:0xffffff,metalness:.65,roughness:.62,flatShading:true});body.userData.cabinKeepSurface=true;
  const amber=new THREE.MeshBasicMaterial({name:'Droid OBS / nixie cathode bitmap',map:faceTexture,toneMapped:false});
  const m={body,amber,texture,faceTexture},root=new THREE.Group();root.name='OBS lightweight household droid 3817';root.userData.droidDetail='obs';
  const chassis=group(root,'Torso chassis');
  box(chassis,m,[0,.245,-.035],[.075,.49,.072],T.neck);box(chassis,m,[0,.035,0],[.245,.095,.115],T.dark);
  // Central pelvic cover: an upright face with a rearward lip and bevelled heel.
  // Mount it to the pelvis, clear of the independently moving hip joints.
  profileHousing(chassis,m,[0,0,0],.082,[
    [.018,.099],[.054,.099],[.082,.087],[.082,-.010],
    [.022,-.055],[-.017,-.055],[-.051,-.027],[-.051,-.011],[.018,-.011],
  ],T.paint).name='Pelvis / folded center cover';
  for(const side of [-1,1]){
    hub(chassis,m,[side*.125,0,0],.047,.065);
    box(chassis,m,[side*.084,.064,.065],[.074,.104,.024],T.panel);
    bar(chassis,m,[side*.09,.035,-.034],[side*.146,.46,-.039],.016,T.dark);
    box(chassis,m,[side*.076,.225,.052],[.033,.23,.035],T.bright);
    cable(chassis,m,[[side*.148,.46,-.05],[side*.12,.49,.064],[side*.10,.29,.095],[side*.115,.105,.068]],.007,T.copper);
    cable(chassis,m,[[side*.125,.44,.067],[side*.15,.40,.094],[side*.15,.25,.094],[side*.123,.220,.088]],.0045,T.brass);
  }
  bar(chassis,m,[-spec.shoulderHalfWidth,.47,0],[spec.shoulderHalfWidth,.47,0],.025,T.dark);
  chestModule(chassis,m,[-.072,.341,.094],[.103,.246,.126],T.panel);
  chestModule(chassis,m,[.098,.33,.087],[.058,.181,.112],T.circuit);
  box(chassis,m,[0,.306,-.156],[.242,.294,.080],T.vent);
  // Two collars and rearward brackets bridge the spine-to-backpack gap.
  // They share the torso joint so neither end separates when the body leans.
  for(const y of [.205,.410]){
    box(chassis,m,[0,y,-.035],[.094,.036,.090],T.steel);
    bar(chassis,m,[0,y,-.070],[0,y,-.124],.019,T.steel);
    box(chassis,m,[0,y,-.119],[.110,.060,.012],T.panel);
  }
  box(chassis,m,[0,.509,-.027],[.064,.08,.062],T.neck);
  for(const side of [-1,1]){
    bar(chassis,m,[side*.062,.469,-.012],[side*.055,.551,-.034],.008,T.bright);
    cable(chassis,m,[[side*.08,.441,.06],[side*.087,.506,.045],[side*.060,.544,.023],[side*.07,.603,-.07]],.006,T.copper);
  }
  const neckPivot=group(chassis,'Head support pivot',[0,.542,-.015]);
  const {head,face}=headAssembly(neckPivot,m,Object.keys(expressions));head.position.set(0,.125,.040);
  const arms=[],legs=[],actuators=[];
  for(const side of [-1,1]){
    arms.push({side,upper:limb(root,m,spec.upperArm,'Upper arm',side),lower:limb(root,m,spec.forearm,'Forearm',side),palm:hand(root,m,side)});
    legs.push({side,upper:limb(root,m,spec.upperLeg,'Upper leg / forward thigh',side),middle:knee(root,m,spec.middleLeg,side),lower:limb(root,m,spec.lowerLeg,'Lower leg / reverse hock',side),foot:foot(root,m)});
  }
  const tray=group(root,'Service tray',[0,1.058,.421]);tray.userData.noDroidSkin=true;
  box(tray,m,[0,0,0],[.52,.018,.29],T.steel);
  for(const side of [-1,1])bar(tray,m,[side*.283,.034,-.085],[side*.283,.034,.085],.008,T.dark);
  box(tray,m,[.10,.038,0],[.15,.06,.16],T.cloth);
  function actuator(startGroup,start,endGroup,end,radius){
    const housing=group(root,'Square actuator housing'),shaft=group(root,'Square actuator rod');
    box(housing,m,[0,0,0],[radius*2,1,radius*2],T.steel);box(shaft,m,[0,0,0],[radius,1,radius],T.bright);
    const a=new THREE.Object3D(),b=new THREE.Object3D();a.position.set(...start);b.position.set(...end);startGroup.add(a);endGroup.add(b);actuators.push({a,b,housing,shaft});
  }
  for(const a of arms)actuator(a.upper,[a.side*.055,-.115,-.025],a.lower,[a.side*.044,-.13,-.015],.015);
  for(const l of legs){actuator(l.upper,[l.side*.075,-.19,-.025],l.middle,[l.side*.075,-.095,-.025],.019);actuator(l.middle,[l.side*.077,-.19,.030],l.lower,[l.side*.077,-.125,.028],.018);}
  return {root,m,chassis,neckPivot,head,face,arms,legs,tray,actuators};
}

// All opaque parts share one atlas/material and one skinned draw. A vertex has
// exactly one joint weight: hinges and square pistons remain rigid, never rubbery.
export function batchDroidLow(root,material){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),sources=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material!==material)return;
    for(let p=mesh;p&&p!==root;p=p.parent)if(p.userData.noDroidSkin)return;
    sources.push(mesh);
  });
  const joints=new Map(),bones=[],parts=[];
  for(const source of sources){
    const owner=source.parent;
    if(!joints.has(owner)){const bone=new THREE.Bone();bone.name='Rigid skin / '+owner.name;owner.add(bone);joints.set(owner,bones.length);bones.push(bone);}
    const geometry=source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,source.matrixWorld));
    const count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4),index=joints.get(owner);
    for(let i=0;i<count;i++){indices[i*4]=index;weights[i*4]=1;}
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    parts.push(geometry);source.removeFromParent();source.geometry.dispose();
  }
  const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());root.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(bones),mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='OBS droid / rigid textured skin';mesh.userData.cabinRigidSkin=true;
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton);
  // A conservative sphere avoids rebuilding a bounds volume for every joint.
  mesh.boundingSphere=new THREE.Sphere(V(0,.90,.05),1.28);
  return {mesh,skeleton};
}
