import * as THREE from 'three';
import {HABITAT_VIEW} from './ship.js';
import {ObservationXRQuality,XRCharacterPicker,XR_FRAMEBUFFER_SCALE} from './xr-quality.js';
import {XRNavigation} from './xr-navigation.js';

const Y=new THREE.Vector3(0,1,0);
const BUTTONS=[
  ['all','全景','Wide'],['milo','マイロ','Milo'],['cat','ルーシー','Lucy'],['droid','ドロイド','Droid'],
  ['food','食事','Eat'],['water','水','Drink'],['catfood','猫の餌','Feed Lucy'],['supply','補給','Supplies'],
  ['reply','応答 / HQ','Reply / HQ'],['pause','停止 / 再開','Pause / Play'],['recenter','正面に戻す','Recenter'],['exit','2Dへ戻る','Exit to 2D'],
];

// Scale the viewer, not the habitat: lights, physics and character rigs stay in
// their original units. One metre of head/controller motion maps to scale units.
export function frameXRViewer(rig,transform,target,scale,distance){
  const orientation=new THREE.Quaternion().copy(transform.orientation);
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(orientation);
  const yaw=Math.atan2(-forward.x,-forward.z);
  rig.quaternion.setFromAxisAngle(Y,-yaw);rig.scale.setScalar(scale);
  rig.position.copy(target).add(new THREE.Vector3(0,0,distance*scale))
    .sub(new THREE.Vector3().copy(transform.position).multiplyScalar(scale).applyQuaternion(rig.quaternion));
  rig.updateMatrixWorld(true);
  return yaw;
}

function createPanel(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const context=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,depthTest:false,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.44,.72),material);
  mesh.name='VR controls';mesh.renderOrder=10000;
  let last='';
  return{
    mesh,
    buttonAt(uv){
      const x=uv.x*1024,y=(1-uv.y)*512;
      for(let i=0;i<BUTTONS.length;i++){
        const left=20+(i%4)*248,top=258+Math.floor(i/4)*80;
        if(x>=left&&x<=left+240&&y>=top&&y<=top+72)return BUTTONS[i][0];
      }
      return null;
    },
    draw({lang,status,message,hover,mode}){
      const key=JSON.stringify([lang,status,message,hover,mode]);if(key===last)return;last=key;
      const ja=lang==='ja',c=context;
      c.fillStyle='#122126';c.fillRect(0,0,1024,512);
      c.strokeStyle='#617d76';c.lineWidth=3;c.strokeRect(2,2,1020,508);
      c.textAlign='left';c.textBaseline='top';c.fillStyle='#bee1c9';c.font='bold 25px sans-serif';
      c.fillText('TARAIRON / 3D',24,20);
      c.font='22px sans-serif';c.fillStyle='#e6e8df';c.fillText(status,24,60,976);
      c.fillStyle='#c3cfc7';c.font='23px sans-serif';
      const text=message||(ja?'光線を向けてトリガーで選択。人物に寄る・設備へ指示できます。':'Point and press the trigger to select a character or a station.');
      let line='',row=0;
      for(const char of text){
        if(char==='\n'||c.measureText(line+char).width>976){c.fillText(line,24,103+row*30);line='';row++;if(row>=4)break;}
        if(char!=='\n')line+=char;
      }
      if(row<4)c.fillText(line,24,103+row*30);
      c.fillStyle='#99b8ad';c.font='18px sans-serif';
      c.fillText(ja?'左スティック：旋回 / 右：移動　A・X：メニュー　B・Y・グリップ：全景':'Left stick: turn / Right: move   A/X: menu   B/Y or grip: wide',24,229,976);
      BUTTONS.forEach(([id,japanese,english],i)=>{
        const x=20+(i%4)*248,y=258+Math.floor(i/4)*80;
        c.fillStyle=hover.has(id)?'#537968':mode===id?'#344e47':'#24363b';c.fillRect(x,y,240,72);
        c.strokeStyle=hover.has(id)?'#d9eecb':'#526861';c.lineWidth=1;c.strokeRect(x,y,240,72);
        c.fillStyle='#eef0e3';c.font='24px sans-serif';c.textAlign='center';c.fillText(ja?japanese:english,x+120,y+24,224);
      });
      texture.needsUpdate=true;
    },
    dispose(){mesh.removeFromParent();mesh.geometry.dispose();material.dispose();texture.dispose();},
  };
}

export class ObservationXR {
  constructor(view,{button,words,getLang,status=()=>({}),action=()=>{},notify=()=>{},onChange=()=>{},xr=globalThis.navigator?.xr,secure=globalThis.isSecureContext,makePanel=createPanel}){
    Object.assign(this,{view,button,words,getLang,status,action,notify,onChange,xr,secure,makePanel});
    this.support='checking';this.pending=false;this.session=null;this.disposed=false;this.controllers=[];
    this.raycaster=new THREE.Raycaster();this.rotation=new THREE.Matrix4();
    const manager=view.renderer.xr;manager.enabled=true;manager.setReferenceSpaceType('local');
    manager.setFramebufferScaleFactor(XR_FRAMEBUFFER_SCALE);manager.setFoveation(1);
    this.click=()=>{void this.toggle();};button.addEventListener('click',this.click);
    this.deviceChange=()=>{if(!this.active&&!this.pending)void this.checkSupport();};
    xr?.addEventListener('devicechange',this.deviceChange);
    this.ready=this.checkSupport();
  }
  get active(){return Boolean(this.session);}
  get visible(){return this.active&&this.session.visibilityState==='visible';}
  async checkSupport(){
    this.support='checking';this.localize();
    try{this.support=!this.secure?'insecure':!this.xr?'unsupported':await this.xr.isSessionSupported('immersive-vr')?'ready':'unsupported';}
    catch{this.support='blocked';}
    if(!this.disposed)this.localize();
  }
  localize(){
    this.button.disabled=this.pending||this.support==='checking';
    this.button.setAttribute('aria-pressed',String(this.active));
    this.button.classList.toggle('active',this.active);
    const label=this.active?this.words('立体表示を終了','Exit immersive 3D'):this.words('立体表示 / Meta Quest','Immersive 3D / Meta Quest');
    this.button.setAttribute('aria-label',label);this.button.dataset.tip=label;
  }
  async toggle(){
    if(this.disposed||this.pending)return;
    if(this.active){await this.exit();return;}
    if(this.support!=='ready'){
      this.notify(this.support==='insecure'
        ?this.words('Questのブラウザで、HTTPSのページを開いて「3D」を押してください。MacのローカルHTTPアドレスでは立体表示を開始できません。','Open this page over HTTPS in the Quest browser, then press 3D. A Mac’s local HTTP address cannot start immersive VR.')
        :this.words('立体表示はMeta QuestなどのWebXR対応ヘッドセットで使えます。対応機器でHTTPSのページを開き、VRの利用を許可してください。','Immersive 3D needs a WebXR headset such as Meta Quest. Open this page over HTTPS on the headset and allow VR access.'));
      return;
    }
    this.pending=true;this.localize();
    let session;
    try{
      // Keep requestSession directly in the trusted button handler. An awaited
      // support check here would consume the browser's transient user activation.
      session=await this.xr.requestSession('immersive-vr');
      if(this.disposed){await session.end();return;}
      this.session=session;
      this.ended=()=>queueMicrotask(()=>this.finish(session));
      session.addEventListener('end',this.ended);
      this.visibility=()=>{this.navigation?.reset();this.onChange();};session.addEventListener('visibilitychange',this.visibility);
      this.prepare();
      await this.view.renderer.xr.setSession(session);
      if(this.session!==session)return;
      this.onChange();
    }catch(error){
      if(session){try{await session.end();}catch{}this.finish(session);}
      if(!this.disposed)this.notify(error?.name==='NotAllowedError'
        ?this.words('立体表示がキャンセルされました。「3D」から再開できます。','Immersive 3D was cancelled. Press 3D to try again.')
        :this.words('立体表示を開始できませんでした。QuestのブラウザでVRの利用許可とHTTPS接続を確認してください。','Could not start immersive 3D. Check HTTPS and VR permission in the Quest browser.'));
    }finally{this.pending=false;if(!this.disposed)this.localize();}
  }
  prepare(){
    const v=this.view,c=v.camera;
    this.quality=new ObservationXRQuality(v);this.picker=new XRCharacterPicker(v);
    this.saved={parent:c.parent,position:c.position.clone(),quaternion:c.quaternion.clone(),scale:c.scale.clone(),fov:c.fov,aspect:c.aspect,near:c.near,far:c.far,
      mode:v.mode,zoom:v.zoom,center:v.center.clone(),targetCenter:v.targetCenter.clone(),viewHeight:v.viewHeight,targetHeight:v.targetHeight};
    this.rig=new THREE.Group();this.rig.name='XR viewer';v.scene.add(this.rig);this.rig.add(c);
    this.navigation=new XRNavigation(this.rig);this.followPoint=new THREE.Vector3();this.followDelta=new THREE.Vector3();this.followRoot=null;this.menuOpen=false;
    c.position.set(0,0,0);c.quaternion.identity();c.scale.setScalar(1);
    this.panel=this.makePanel();this.rig.add(this.panel.mesh);this.rig.visible=false;
    this.controllers=[0,1].map(index=>{
      const controller=v.renderer.xr.getController(index);
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0xc6e4b6,toneMapped:false}));
      line.scale.z=4;
      const cursor=new THREE.Mesh(new THREE.SphereGeometry(.006,6,4),new THREE.MeshBasicMaterial({color:0xe3f4c9,toneMapped:false}));
      cursor.position.z=-4;controller.add(line,cursor);this.rig.add(controller);
      const select=()=>{if(this.visible){this.view.scene.updateMatrixWorld(true);this.picker.update();this.activate(this.pick(controller));}};
      const squeeze=()=>{if(this.visible)this.view.setMode('all');};
      controller.addEventListener('select',select);controller.addEventListener('squeeze',squeeze);
      return{controller,line,cursor,select,squeeze,target:null};
    });
    this.pose=null;this.pendingFocus='all';this.hoverAge=1;this.panelAge=1;v.setMode('all');
  }
  focus(mode){if(this.active&&['all','milo','cat','droid'].includes(mode))this.pendingFocus=mode;}
  frame(mode){
    const v=this.view,target=new THREE.Vector3(0,HABITAT_VIEW.centerY,0);
    let scale=9,distance=2.8;
    if(mode==='milo'){v.milo.getWorldPosition(target);target.y+=.95;scale=1.7;distance=1.9;}
    if(mode==='cat'){v.cat.getWorldPosition(target);target.y+=.37*v.cat.scale.y;scale=.9;distance=1.8;}
    if(mode==='droid'){v.droidService.actorRoot.getWorldPosition(target);target.y+=.9;scale=1.6;distance=1.9;}
    this.followRoot=mode==='milo'?v.milo:mode==='cat'?v.cat:mode==='droid'?v.droidService.actorRoot:null;
    this.followRoot?.getWorldPosition(this.followPoint);
    const yaw=frameXRViewer(this.rig,this.pose,target,scale,distance);
    this.menuOpen=false;this.panel.mesh.visible=mode==='all';
    this.panel.mesh.quaternion.setFromAxisAngle(Y,yaw);
    // Keep the panel below the ship's lowest deck, rather than covering it.
    this.panel.mesh.position.set(0,-1,-1.6).applyQuaternion(this.panel.mesh.quaternion).add(this.pose.position);
    this.rig.visible=true;this.rig.updateMatrixWorld(true);
  }
  follow(dt){
    if(!this.followRoot)return;
    this.followRoot.getWorldPosition(this.followDelta).sub(this.followPoint).multiplyScalar(1-Math.exp(-dt*6));
    this.followPoint.add(this.followDelta);this.rig.position.add(this.followDelta);
    // Translate only: preserve head orientation, room-scale motion and any
    // position/heading the user chose with the sticks while following.
  }
  toggleMenu(){
    if(!this.pose)return;
    this.menuOpen=!this.menuOpen;this.panel.mesh.visible=this.menuOpen;
    if(this.menuOpen){
      this.panel.mesh.quaternion.copy(this.pose.orientation);
      this.panel.mesh.position.set(0,-.08,-1.6).applyQuaternion(this.pose.orientation).add(this.pose.position);
    }
    this.hoverAge=1;this.panelAge=1;
  }
  pick(controller){
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.rotation.extractRotation(controller.matrixWorld);
    this.raycaster.ray.direction.set(0,0,-1).applyMatrix4(this.rotation).normalize();
    this.raycaster.far=40*this.rig.scale.x;
    const panelHit=this.panel.mesh.visible?this.raycaster.intersectObject(this.panel.mesh)[0]:null;
    if(panelHit)return{type:'control',id:this.panel.buttonAt(panelHit.uv),distance:panelHit.distance};
    return this.picker.pick(this.raycaster);
  }
  activate(target){
    if(!target?.id)return;
    if(target.type==='station'){this.view.onStation?.(target.id);return;}
    if(target.type==='character'||['all','milo','cat','droid'].includes(target.id)){this.view.setMode(target.id);return;}
    if(target.id==='exit'){void this.exit();return;}
    if(target.id==='recenter'){this.focus(this.view.mode);return;}
    this.action(target.id);
  }
  update(dt,frame){
    if(!this.active||!frame||!this.rig)return;
    if(!this.visible){this.navigation.reset();return;}
    const pose=frame.getViewerPose(this.view.renderer.xr.getReferenceSpace());
    if(!pose){this.navigation.reset();return;}
    this.pose=pose.transform;
    dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.05)):0;
    const input=this.navigation.read(this.session.inputSources);
    if(input.wide)this.view.setMode('all');
    const refocused=Boolean(this.pendingFocus);
    if(refocused){this.frame(this.pendingFocus);this.pendingFocus=null;}
    else this.follow(dt);
    // A reset wins over a held stick in the same frame.
    if(!refocused)this.navigation.move(this.pose,dt);
    if(input.menu&&!input.wide)this.toggleMenu();
    this.hoverAge+=dt;this.panelAge+=dt;
    if(this.hoverAge>=.1){
      this.hoverAge=0;this.view.scene.updateMatrixWorld(true);this.picker.update();
      for(const item of this.controllers){
        item.target=item.controller.visible?this.pick(item.controller):null;
        const length=item.target?item.target.distance/this.rig.scale.x:4;
        item.line.scale.z=length;item.cursor.position.z=-length;item.cursor.visible=Boolean(item.target?.id);
        item.line.material.color.setHex(item.target?.id?0xffd17e:0xc6e4b6);
      }
    }
    if(this.panelAge>=.2){
      this.panelAge=0;
      this.panel.draw({lang:this.getLang(),...this.status(),mode:this.view.mode,hover:new Set(this.controllers.map(c=>c.target?.type==='control'?c.target.id:null))});
    }
  }
  async exit(){
    if(!this.session||this.ending)return;
    this.ending=true;
    try{await this.session.end();}
    catch{this.notify(this.words('ヘッドセットのメニューからVRを終了してください。','Use the headset menu to exit VR.'));}
    finally{this.ending=false;}
  }
  finish(session){
    if(this.session!==session)return;
    session.removeEventListener('end',this.ended);session.removeEventListener('visibilitychange',this.visibility);
    this.session=null;
    this.navigation?.reset();this.navigation=null;this.followRoot=null;this.menuOpen=false;this.pose=null;
    this.quality?.dispose();this.quality=null;this.picker=null;
    for(const item of this.controllers){
      item.controller.removeEventListener('select',item.select);item.controller.removeEventListener('squeeze',item.squeeze);
      for(const object of [item.line,item.cursor]){object.removeFromParent();object.geometry.dispose();object.material.dispose();}
      item.controller.removeFromParent();
    }
    this.controllers=[];this.panel?.dispose();this.panel=null;
    if(this.saved){
      const v=this.view,c=v.camera,s=this.saved;c.removeFromParent();s.parent?.add(c);
      c.position.copy(s.position);c.quaternion.copy(s.quaternion);c.scale.copy(s.scale);
      for(const key of ['fov','aspect','near','far'])c[key]=s[key];c.updateProjectionMatrix();
      for(const key of ['mode','zoom','viewHeight','targetHeight'])v[key]=s[key];
      v.center.copy(s.center);v.targetCenter.copy(s.targetCenter);v.zoomAnchor=null;
      this.rig.removeFromParent();this.rig=null;this.saved=null;
      if(!this.disposed){v.resize();v.onModeChange?.(v.mode);}
    }
    if(!this.disposed){this.localize();this.onChange();}
  }
  dispose(){
    this.disposed=true;this.button.removeEventListener('click',this.click);this.xr?.removeEventListener('devicechange',this.deviceChange);
    if(this.session){const session=this.session;void session.end().catch(()=>{});this.finish(session);}
  }
}
