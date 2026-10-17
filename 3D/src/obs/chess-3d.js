import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createChessPieceGeometry,chessSquarePosition,chessSquareAt,chessGridMatrix} from './chess-geometry.js';
import {createChessHologram,createChessFootGlowMaterial} from './chess-hologram.js';
import {chessMoveTransition,chessArcPosition,chessCaptureScale} from './chess-motion.js';
import {createChessOrbit} from './chess-camera.js';

export function createChess3DView({stage,board,onSquare,onSettled,appearance={}}){
  const canvas=document.createElement('canvas');canvas.className='chess-3d-canvas';canvas.setAttribute('aria-hidden','true');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1b1d);
  const camera=new THREE.PerspectiveCamera(34,1,.1,200),target=new THREE.Vector3(0,.3,0),defaultDirection=new THREE.Vector3(0,15,14).normalize(),direction=defaultDirection.clone();
  camera.position.copy(target).addScaledVector(direction,24);
  const controls=createChessOrbit(camera,canvas,target);
  const composer=new EffectComposer(renderer),renderPass=new RenderPass(scene,camera);
  const bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.48,.4,.85),output=new OutputPass();
  composer.addPass(renderPass);composer.addPass(bloom);composer.addPass(output);
  const resources=new Set(),keep=value=>(resources.add(value),value);
  const basic=(color,intensity=1)=>keep(new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity)}));
  const metal=keep(new THREE.MeshStandardMaterial({color:0x142b32,metalness:.74,roughness:.36}));
  const light=keep(new THREE.MeshLambertMaterial({color:0x18434a}));
  const dark=keep(new THREE.MeshLambertMaterial({color:0x09272e}));
  const whiteHologram=createChessHologram(appearance),blackHologram=createChessHologram({...appearance,color:0x075979,emissive:0x034763,tint:new THREE.Color(.10,.42,.9)});
  const white=keep(whiteHologram.material),black=keep(blackHologram.material);
  const depth=keep(new THREE.MeshBasicMaterial({colorWrite:false}));
  const neon=basic(0x2de9f3,.6);
  function mesh(geometry,material,parent=scene,position=[0,0,0]){
    const object=new THREE.Mesh(keep(geometry),material);object.position.set(...position);parent.add(object);return object;
  }
  mesh(new RoundedBoxGeometry(8.55,.26,8.55,3,.08),metal,scene,[0,-.19,0]).receiveShadow=true;
  mesh(new RoundedBoxGeometry(8.7,.10,8.7,2,.04),metal,scene,[0,-.35,0]);
  const tile=keep(new THREE.BoxGeometry(.994,.06,.994));
  for(let row=0;row<8;row++)for(let file=0;file<8;file++){
    const square=new THREE.Mesh(tile,(file+row)%2?dark:light);square.position.set(file-3.5,-.03,row-3.5);square.receiveShadow=true;scene.add(square);
  }
  for(const side of [-1,1]){
    mesh(new THREE.BoxGeometry(8.4,.016,.018),neon,scene,[0,-.018,side*4.18]);
    mesh(new THREE.BoxGeometry(.018,.016,8.4),neon,scene,[side*4.18,-.018,0]);
  }
  const screw=keep(new THREE.CylinderGeometry(.045,.045,.014,20)),screwMaterial=keep(new THREE.MeshStandardMaterial({color:0x708386,metalness:.9,roughness:.38}));
  for(const x of [-4.25,4.25])for(const z of [-4.25,0,4.25]){
    const object=new THREE.Mesh(screw,screwMaterial);object.position.set(x,-.045,z);scene.add(object);
  }
  scene.add(new THREE.HemisphereLight(0xc6e4ef,0x12313c,1.1));
  const sun=new THREE.DirectionalLight(0xdaeeff,2.9);sun.position.set(-3,10,6);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:30});
  sun.shadow.bias=-.0001;sun.shadow.normalBias=.014;sun.shadow.radius=2;scene.add(sun);
  const fill=new THREE.DirectionalLight(0x22bde5,1.4);fill.position.set(5,5,-6);scene.add(fill);
  const pieceRoot=new THREE.Group(),markerRoot=new THREE.Group();scene.add(pieceRoot,markerRoot);
  const geometries=Object.fromEntries('prnbqk'.split('').map(type=>[type,keep(createChessPieceGeometry(type))]));
  const footGlowPlane=keep(new THREE.PlaneGeometry(1.2,1.2));
  const footGlowMaterials={w:keep(createChessFootGlowMaterial(undefined,appearance.glow)),b:keep(createChessFootGlowMaterial(0x278fc9,appearance.glow))};
  const markerMaterial=keep(new THREE.MeshBasicMaterial({color:0x66eaff,transparent:true,opacity:.75,depthWrite:false}));
  const lastMaterial=keep(new THREE.MeshBasicMaterial({color:0x459bb6,transparent:true,opacity:.23,depthWrite:false}));
  const selectedMaterial=basic(0x77eeff,1.4),checkMaterial=basic(0xff6b68,1.3);
  const borderShape=new THREE.Shape();borderShape.moveTo(-.485,-.485);borderShape.lineTo(.485,-.485);borderShape.lineTo(.485,.485);borderShape.lineTo(-.485,.485);borderShape.closePath();
  const hole=new THREE.Path();hole.moveTo(-.455,-.455);hole.lineTo(-.455,.455);hole.lineTo(.455,.455);hole.lineTo(.455,-.455);hole.closePath();borderShape.holes.push(hole);
  const border=keep(new THREE.ShapeGeometry(borderShape)),dot=keep(new THREE.CircleGeometry(.095,32)),capture=keep(new THREE.RingGeometry(.39,.42,48)),wash=keep(new THREE.PlaneGeometry(.97,.97));
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state={pieces:[],flipped:false,targets:[],last:[]},disposed=false,frame=0,animation=null,width=0,height=0,fitDistance=0;
  function invalidate(){
    if(disposed||frame)return;
    frame=requestAnimationFrame(time=>{
      frame=0;if(disposed||document.hidden)return;
      let settled=false;
      if(animation){
        animation.start??=time;
        const progress=Math.min(1,(time-animation.start)/(animation.duration*1000));
        for(const mover of animation.movers){
          chessArcPosition(mover,progress,mover.object.position);
          const glow=mover.object.userData.footGlow;glow.position.y=.012-mover.object.position.y;
          glow.scale.setScalar(1+mover.object.position.y*.25);
        }
        if(animation.victim){const scale=chessCaptureScale(progress);animation.victim.scale.setScalar(Math.max(.001,scale));animation.victim.visible=scale>.001;}
        if(progress>=1){animation=null;buildPieces();board.setAttribute('aria-busy','false');settled=true;}
      }
      composer.render();
      if(animation)invalidate();
      if(settled)onSettled?.();
    });
  }
  function createPiece(piece){
      const root=new THREE.Group();root.name=piece.color+' '+piece.type+' '+piece.square;root.userData.square=piece.square;
      root.position.copy(chessSquarePosition(piece.square));root.rotation.y=(piece.color==='b'?Math.PI:0)+(piece.type==='n'?Math.PI/2:0);
      // Match the study's single visible surface, without revealing intersecting
      // crowns/necks or drawing the back of a neighbouring piece through it.
      const prepass=new THREE.Mesh(geometries[piece.type],depth);prepass.renderOrder=1;root.add(prepass);
      const body=new THREE.Mesh(geometries[piece.type],piece.color==='w'?white:black);body.renderOrder=2;body.castShadow=true;body.receiveShadow=true;root.add(body);
      const glow=new THREE.Mesh(footGlowPlane,footGlowMaterials[piece.color]);glow.rotation.x=-Math.PI/2;glow.position.y=.012;
      glow.raycast=()=>{};root.userData.footGlow=glow;root.add(glow);
      pieceRoot.add(root);return root;
  }
  function buildPieces(transition=null){
    pieceRoot.clear();
    const movers=[];
    for(const piece of state.pieces){
      const mover=transition?.movers.find(move=>move.to===piece.square);
      const root=createPiece(mover?.promotion?{...piece,type:mover.type}:piece);
      if(mover){root.position.copy(mover.fromPosition);movers.push({...mover,object:root});}
    }
    const victim=transition?.captured?createPiece(transition.captured):null;
    return transition?{...transition,movers,victim,start:null}:null;
  }
  function update(next){
    const changed=state.positionKey!==next.positionKey;
    const transition=changed&&!reducedMotion?chessMoveTransition(state,next):null;
    state=next;markerRoot.clear();
    pieceRoot.rotation.y=markerRoot.rotation.y=state.flipped?Math.PI:0;
    if(changed||!pieceRoot.children.length){animation=buildPieces(transition);board.setAttribute('aria-busy',String(Boolean(animation)));}
    const occupied=new Set(state.pieces.map(piece=>piece.square));
    const mark=(square,geometry,material,y)=>{
      if(!square)return;const object=new THREE.Mesh(geometry,material);object.rotation.x=-Math.PI/2;
      object.position.copy(chessSquarePosition(square));object.position.y=y;markerRoot.add(object);
    };
    for(const square of state.last??[])mark(square,wash,lastMaterial,.009);
    for(const square of state.targets??[])mark(square,occupied.has(square)?capture:dot,markerMaterial,.018);
    mark(state.selected,border,selectedMaterial,.024);mark(state.check,border,checkMaterial,.025);
    scene.updateMatrixWorld(true);invalidate();
  }
  function resize(){
    const rect=stage.getBoundingClientRect();if(!rect.width||!rect.height)return;
    width=rect.width;height=rect.height;
    const zoom=fitDistance?camera.position.distanceTo(controls.target)/fitDistance:.87;
    direction.copy(camera.position).sub(controls.target).normalize();
    renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;
    camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld(true);
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),tan=Math.tan(camera.fov*Math.PI/360);
    let distance=0;
    for(const x of [-4.45,4.45])for(const y of [-.4,1.7])for(const z of [-4.45,4.45]){
      const p=new THREE.Vector3(x,y,z).sub(target),depth=p.dot(direction);
      distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tan*camera.aspect*.93),depth+Math.abs(p.dot(up))/(tan*.93));
    }
    fitDistance=distance;controls.minDistance=distance*.36;controls.maxDistance=distance*1.65;
    camera.position.copy(target).addScaledVector(direction,distance*THREE.MathUtils.clamp(zoom,.36,1.65));
    camera.updateProjectionMatrix();controls.update();syncCamera();
  }
  function syncCamera(){
    if(!width||!height)return;
    camera.updateMatrixWorld(true);
    board.style.transform='matrix3d('+chessGridMatrix(camera,width,height).join(',')+')';invalidate();
  }
  function resetCamera(){
    controls.target.copy(target);camera.position.copy(target).addScaledVector(defaultDirection,24);fitDistance=0;resize();
  }
  function setAppearance({translucency,glow}){
    for(const {uniforms} of [whiteHologram,blackHologram]){
      if(Number.isFinite(translucency))uniforms.holoOpacity.value=1-THREE.MathUtils.clamp(translucency,0,75)/100;
      if(Number.isFinite(glow))uniforms.holoGlow.value=THREE.MathUtils.clamp(glow,0,100)/100;
    }
    if(Number.isFinite(glow))for(const material of Object.values(footGlowMaterials))material.uniforms.strength.value=.25*Math.sqrt(THREE.MathUtils.clamp(glow,0,100)/100);
    invalidate();
  }
  controls.addEventListener('change',syncCamera);
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();
  let down=null;const pointers=new Set();
  const pointerDown=event=>{
    pointers.add(event.pointerId);
    if(pointers.size===1&&event.button===0){down={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};canvas.classList.add('is-dragging');}
    else if(down)down.moved=true;
  };
  const pointerMove=event=>{
    if(down?.id===event.pointerId&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>7)down.moved=true;
  };
  const pointerUp=event=>{
    pointers.delete(event.pointerId);if(!pointers.size)canvas.classList.remove('is-dragging');
    if(!down||down.id!==event.pointerId)return;const gesture=down;down=null;
    if(gesture.moved||pointers.size||event.button!==0||Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7||animation)return;
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    const hit=ray.intersectObjects(pieceRoot.children,true)[0];let square=null;
    if(hit){let object=hit.object;while(object&&!object.userData.square)object=object.parent;square=object?.userData.square;}
    if(!square&&ray.ray.intersectPlane(plane,point))square=chessSquareAt(point,state.flipped);
    if(square)onSquare(square);
  };
  const pointerCancel=event=>{pointers.delete(event.pointerId);down=null;canvas.classList.remove('is-dragging');};
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerCancel);
  const visibility=()=>{if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',visibility);
  stage.prepend(canvas);stage.classList.add('is-3d');
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();
  return{update,resetCamera,setAppearance,get animating(){return animation!==null;},dispose(){
    disposed=true;animation=null;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);controls.dispose();
    canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerCancel);
    stage.classList.remove('is-3d');board.style.removeProperty('transform');board.removeAttribute('aria-busy');canvas.remove();
    resources.forEach(resource=>resource.dispose());sun.shadow.map?.dispose();
    bloom.dispose();output.dispose();composer.dispose();renderer.dispose();renderer.forceContextLoss();
  }};
}
