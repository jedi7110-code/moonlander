import * as THREE from 'three';
import {createLander,createAstronaut,createAlien,createRover,createPad,material,mesh,box,sphere,animateAstronaut,animateAlien} from './models.js';

function seeded(seed=8128){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const rand=seeded();
export const CRATERS=Array.from({length:37},(_,i)=>({x:(rand()-.5)*270,z:(rand()-.5)*270,r:4+rand()*15,depth:1+rand()*2.4})).filter(c=>Math.hypot(c.x,c.z)>17);
export function terrainHeight(x,z) {
  const flat=Math.min(1,Math.max(0,(Math.hypot(x,z)-14)/16));
  let h=(Math.sin(x*.094)*Math.cos(z*.076)*.72+Math.sin(x*.21+z*.17)*.22)*flat;
  for(const c of CRATERS){const d=Math.hypot(x-c.x,z-c.z)/c.r;if(d<1.45)h+=(Math.exp(-Math.pow((d-.98)*6,2))*.65-Math.max(0,1-d*d)*c.depth)*flat;}
  return h;
}

export class MoonScene {
  constructor(canvas) {
    this.canvas=canvas;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x020608);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.camera=new THREE.PerspectiveCamera(47,1,.1,2200);this.camera.position.set(23,13,28);
    this.scene.add(new THREE.HemisphereLight(0xbccbd0,0x383c3c,1.05));
    this.sun=new THREE.DirectionalLight(0xffefd4,3.2);this.sun.position.set(-55,70,35);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:200});this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.05;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sun);this.scene.add(this.sun.target);
    const rim=new THREE.DirectionalLight(0x8eaabd,.6);rim.position.set(50,20,-70);this.scene.add(rim);
    this.makeTerrain();this.makeSky();
    this.pad=createPad();this.scene.add(this.pad);this.lander=createLander();this.scene.add(this.lander);
    this.rover=createRover();this.rover.position.set(39,terrainHeight(39,-27),-27);this.scene.add(this.rover);
    this.player=createAstronaut();this.player.visible=false;this.scene.add(this.player);
    this.crew=[];this.enemies=new Map();this.beams=new Map();this.asteroids=[];this.effects=[];
    this.monolith=new THREE.Group();this.monolith.position.set(-37,terrainHeight(-37,-35),-35);
    mesh(this.monolith,new THREE.CylinderGeometry(.85,.85,5.9,6),material(0x111c28,.95,.09),0,2.95,0);
    for(let i=0;i<3;i++){const line=mesh(this.monolith,new THREE.CylinderGeometry(.854,.854,.018,6),material(0x507b84,.5,.2,0x123440),0,1.1+i*1.5,0);line.rotation.y=.001;}
    this.scene.add(this.monolith);
    this.ray=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.projected=new THREE.Vector3();
    this.target=new THREE.Vector3();this.cameraTarget=new THREE.Vector3();this.cameraYaw=.43;this.cameraMode=0;this.cameraPitch=.53;this.lastPhase='title';
    this.resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.resize();
  }
  makeTerrain() {
    const geo=new THREE.PlaneGeometry(480,480,240,240);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;const colors=[];
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=terrainHeight(x,z);pos.setY(i,h);const v=.39+(rand()-.5)*.13+Math.min(0,h)*.016;colors.push(v*.97,v,v*1.01);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:.025}));ground.receiveShadow=true;this.scene.add(ground);
    const rockGeo=new THREE.IcosahedronGeometry(1,1),rockMat=material(0x717779,.08,.97);
    this.rocks=new THREE.InstancedMesh(rockGeo,rockMat,650);const dummy=new THREE.Object3D();
    this.obstacles=[];
    for(let i=0;i<650;i++){
      const x=(rand()-.5)*230,z=(rand()-.5)*230;let r=.13+rand()*.78;if(i<42)r=1.2+rand()*2.8;
      const reserved=Math.hypot(x,z)<15||Math.hypot(x-39,z+27)<10||Math.abs(z+x*.65)<4||Math.hypot(x+37,z+35)<4;
      if(reserved)r=.07;
      dummy.position.set(x,terrainHeight(x,z)+r*.18,z);dummy.scale.set(r,r*(.4+rand()*.55),r*(.6+rand()*.6));dummy.rotation.set(rand(),rand()*6,rand());dummy.updateMatrix();this.rocks.setMatrixAt(i,dummy.matrix);
      if(r>1)this.obstacles.push({x,z,r:r*.68});
    }
    this.rocks.castShadow=true;this.rocks.receiveShadow=true;this.scene.add(this.rocks);
    // Jagged distant crater wall: continuous silhouette, no atmospheric fog on the airless Moon.
    const mountainGeo=new THREE.PlaneGeometry(1300,1300,100,100);mountainGeo.rotateX(-Math.PI/2);const mp=mountainGeo.attributes.position;
    for(let i=0;i<mp.count;i++){const x=mp.getX(i),z=mp.getZ(i),d=Math.hypot(x,z);mp.setY(i,d<220?-14:4+Math.pow(Math.sin(x*.013+z*.006)*Math.cos(z*.019),2)*47+Math.sin(x*.055)*4);}
    mountainGeo.computeVertexNormals();this.scene.add(new THREE.Mesh(mountainGeo,material(0x5f666b,.03,1)));
    // Parallel wheel tracks lead naturally from the landing site to the wreck.
    for(const side of [-1,1]){const points=[];for(let j=0;j<=70;j++){const t=j/70,x=8+t*30+side*.7,z=-5-t*21;points.push(new THREE.Vector3(x,terrainHeight(x,z)+.035,z));}const track=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),70,.065,3,false),material(0x4d5455,0,1));this.scene.add(track);}
  }
  makeSky() {
    const p=[],colors=[];for(let i=0;i<3000;i++){const theta=rand()*Math.PI*2,phi=Math.acos(rand()),r=900;p.push(r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));const v=.3+rand()*.6;colors.push(v,v*.99,v*.96);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.scene.add(new THREE.Points(geo,new THREE.PointsMaterial({size:1.3,vertexColors:true,sizeAttenuation:true,transparent:true,opacity:.8})));
    const texWidth=512,texHeight=256,data=new Uint8Array(texWidth*texHeight*4);
    for(let y=0;y<texHeight;y++)for(let x=0;x<texWidth;x++){
      const u=x/texWidth*Math.PI*2,v=y/texHeight*Math.PI,lat=Math.cos(v);
      const n=Math.sin(u*2.4+Math.sin(v*5))*Math.cos(v*3.2)+Math.sin(u*6-v*4)*.3+Math.sin(u*13+v*11)*.13;
      const cloud=Math.pow(Math.max(0,Math.sin(u*14+v*25+Math.sin(v*16)*2)*Math.cos(u*5-v*8)),4)*.65;
      const land=n>.46,ice=Math.abs(lat)>.93;let rgb=ice?[165,187,192]:land?[65,95,87]:[20,59,87];const i=(y*texWidth+x)*4;
      for(let c=0;c<3;c++)data[i+c]=rgb[c]*(1-cloud)+220*cloud;data[i+3]=255;
    }
    const texture=new THREE.DataTexture(data,texWidth,texHeight);texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;
    this.earth=new THREE.Mesh(new THREE.SphereGeometry(26,48,32),new THREE.MeshStandardMaterial({map:texture,roughness:.8,emissive:0x07121a,emissiveIntensity:.5}));
    this.earth.position.set(-30,120,-350);this.earth.rotation.z=.3;this.scene.add(this.earth);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(26.55,48,32),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:'varying vec3 vN; varying vec3 vV; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 vN; varying vec3 vV; void main(){float a=pow(1.0-abs(dot(normalize(vN),normalize(vV))),3.5);gl_FragColor=vec4(.18,.48,.75,a*.5);}'}));glow.position.copy(this.earth.position);this.scene.add(glow);
  }
  configure(state) {
    this.pad.position.set(state.pad.x,terrainHeight(state.pad.x,state.pad.z),state.pad.z);
    this.rover.position.set(state.rover.x,terrainHeight(state.rover.x,state.rover.z),state.rover.z);
    for(const c of this.crew)this.removeModel(c);this.crew=state.crews.map((_,i)=>{const m=createAstronaut(true,i);m.visible=false;this.scene.add(m);return m;});
    for(const m of this.enemies.values())this.removeModel(m);this.enemies.clear();
    for(const b of this.beams.values()){this.scene.remove(b);b.geometry.dispose();b.material.dispose();}this.beams.clear();
    for(const a of this.asteroids){this.scene.remove(a);a.geometry.dispose();}this.asteroids=state.debris.map((_,i)=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),material(0x6c7475,.35,.7));m.castShadow=true;this.scene.add(m);return m;});
    for(const effect of this.effects){this.scene.remove(effect.mesh);effect.mesh.geometry.dispose();effect.mesh.material.dispose();}this.effects=[];
    this.lander.userData.ascent.position.y=0;this.lander.userData.ladder.visible=true;this.lander.visible=true;this.cameraYaw=.43;this.cameraPitch=.53;this.lastPhase='title';
  }
  removeModel(model){this.scene.remove(model);model.traverse(child=>{if(child.geometry?.userData.owned)child.geometry.dispose();});}
  aim(clientX,clientY) {
    const rect=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);
    return this.ray.ray.intersectPlane(this.plane,this.projected)?.clone();
  }
  project(x,y,z) {
    const p=new THREE.Vector3(x,y,z).project(this.camera),rect=this.canvas.getBoundingClientRect();return {x:(p.x*.5+.5)*rect.width,y:(-p.y*.5+.5)*rect.height,visible:p.z<1&&p.z>-1};
  }
  title(time,dt) {
    this.lander.position.set(0,.14,0);this.lander.rotation.set(0,0,0);this.lander.visible=true;this.player.visible=false;
    this.lander.userData.flame.visible=false;this.lander.userData.ascent.position.y=0;
    const portrait=this.camera.aspect<1;const yaw=.42+Math.sin(time*.08)*.07;
    const target=new THREE.Vector3(portrait?-3.2:-5.6,portrait?4.4:3.4,0),distance=portrait?28:21;
    this.camera.position.set(target.x+Math.sin(yaw)*distance,portrait?12:10.5,Math.cos(yaw)*distance);this.camera.lookAt(target);
    this.camera.fov=47;this.camera.updateProjectionMatrix();this.earth.rotation.y=time*.005;
    this.renderer.render(this.scene,this.camera);
  }
  render(state,dt) {
    const time=state.time,ground=terrainHeight(state.ship.x,state.ship.z)+.13;
    this.lander.position.set(state.ship.x,ground+state.ship.y,state.ship.z);this.lander.rotation.set(state.ship.pitch,0,state.ship.roll);
    this.lander.visible=!(state.phase==='failed'&&state.failureType==='ship');
    const flame=this.lander.userData.flame;flame.visible=state.ship.thrust>0||state.phase==='launch';flame.scale.y=.78+Math.sin(time*75)*.16+state.ship.thrust*.18;
    this.lander.userData.ascent.position.y=state.escapeAltitude||0;flame.position.y=state.phase==='launch'?(state.escapeAltitude||0)+2.6:.48;
    const showPlayer=['disembark','surface','return','boarding','failed'].includes(state.phase)&&!state.player.boarded;
    this.player.visible=showPlayer;
    this.player.position.set(state.player.x,terrainHeight(state.player.x,state.player.z)+state.player.y,state.player.z);this.player.rotation.y=state.player.facing;animateAstronaut(this.player,state.player,time);
    state.crews.forEach((c,i)=>{const m=this.crew[i];m.visible=c.mode!=='waiting'&&c.mode!=='aboard';m.position.set(c.x,terrainHeight(c.x,c.z)+c.y,c.z);m.rotation.y=c.facing;animateAstronaut(m,c,time);});
    const livingIds=new Set();
    for(const e of state.enemies){livingIds.add(e.id);let m=this.enemies.get(e.id);if(!m){m=createAlien(e.boss);this.enemies.set(e.id,m);this.scene.add(m);}m.position.set(e.x,terrainHeight(e.x,e.z)-Math.max(0,e.emerging)*(e.boss?2.5:1.7),e.z);m.rotation.y=e.facing;animateAlien(m,time,e.emerging<=0);}
    for(const [id,m]of this.enemies)if(!livingIds.has(id)){this.removeModel(m);this.enemies.delete(id);}
    const beamIds=new Set();
    for(const b of state.shots){beamIds.add(b.id);let m=this.beams.get(b.id);if(!m){m=new THREE.Mesh(new THREE.CylinderGeometry(b.charged?.065:.035,b.charged?.065:.035,1,6),new THREE.MeshBasicMaterial({color:b.power>=3?0x97ffff:0xfccf6b,transparent:true,opacity:.92,blending:THREE.AdditiveBlending,depthWrite:false}));this.scene.add(m);this.beams.set(b.id,m);}const length=b.charged?b.range:1.8;m.position.set(b.x+b.dx*length*.5,b.y+b.dy*length*.5,b.z+b.dz*length*.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(b.dx,b.dy,b.dz));m.scale.y=length;}
    for(const[id,m]of this.beams)if(!beamIds.has(id)){this.scene.remove(m);m.geometry.dispose();m.material.dispose();this.beams.delete(id);}
    state.debris.forEach((d,i)=>{const m=this.asteroids[i];m.visible=state.phase==='landing';m.position.set(d.x,d.y,d.z);m.scale.setScalar(d.r);m.rotation.set(time*.13+i,time*.2+i,time*.08);});
    for(let i=this.effects.length-1;i>=0;i--){const f=this.effects[i];f.life-=dt;if(f.life<=0){this.scene.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();this.effects.splice(i,1);continue;}const a=f.mesh.geometry.attributes.position;for(let j=0;j<a.count;j++){f.vel[j*3+1]-=2*dt;a.setXYZ(j,a.getX(j)+f.vel[j*3]*dt,a.getY(j)+f.vel[j*3+1]*dt,a.getZ(j)+f.vel[j*3+2]*dt);}a.needsUpdate=true;f.mesh.material.opacity=f.life/f.maxLife;}
    if(flame.visible&&state.ship.y<12&&Math.random()<dt*14)this.burst(state.ship.x,ground+.2,state.ship.z,0xc4c4b4,14,.85,2.8);
    this.updateCamera(state,dt);
    this.earth.rotation.y=time*.004;this.renderer.render(this.scene,this.camera);
  }
  updateCamera(state,dt) {
    const flight=state.phase==='landing',launch=state.phase==='launch'||state.phase==='complete';
    const p=flight||launch?state.ship:state.player;
    const baseY=terrainHeight(p.x,p.z);const y=baseY+(launch?state.escapeAltitude+3.8:flight?p.y+2.5:p.y+1.2);
    this.target.set(p.x,y,p.z);
    const portrait=this.camera.aspect<1;
    const distance=flight?(portrait?42:33):launch?23:this.cameraMode?25:portrait?17:13.5;
    const pitch=this.cameraMode&&!flight&&!launch?.98:this.cameraPitch;
    const desired=new THREE.Vector3(p.x+Math.sin(this.cameraYaw)*distance,Math.max(baseY+4,y+Math.sin(pitch)*distance),p.z+Math.cos(this.cameraYaw)*distance);
    const phaseChanged=state.phase!==this.lastPhase;const lerp=phaseChanged&&this.lastPhase==='title'?1:1-Math.exp(-dt*3.8);
    this.camera.position.lerp(desired,lerp);this.cameraTarget.lerp(this.target,lerp);this.camera.lookAt(this.cameraTarget);this.lastPhase=state.phase;
    this.sun.position.set(p.x-55,70+baseY,p.z+35);this.sun.target.position.set(p.x,baseY,p.z);this.sun.target.updateMatrixWorld();
  }
  burst(x,y,z,color=0xafff85,count=32,life=1,speed=5) {
    if(this.effects.length>24)return;
    const a=[],v=[];for(let i=0;i<count;i++){a.push(x,y,z);const angle=Math.random()*Math.PI*2,s=Math.random()*speed;v.push(Math.cos(angle)*s,Math.random()*speed*.7,Math.sin(angle)*s);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(a,3));const m=new THREE.Points(geo,new THREE.PointsMaterial({color,size:.1,transparent:true,opacity:1,depthWrite:false}));this.scene.add(m);this.effects.push({mesh:m,vel:v,life,maxLife:life});
  }
}
