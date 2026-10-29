const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=require('node:path').join(__dirname,'local');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('file://'+base+'/lucy-preview.html');await page.waitForFunction(()=>window.lucyCombined);await page.evaluate(()=>lucyCombined.pause(true));
 for(const [mode,t,angle]of [['Walk',0,'side'],['Walk',.3,'side'],['Walk',.8,'side'],['Walk',.984,'side'],['Walk',.8,'oblique'],['Walk',.15,'front'],['Walk',.3,'front'],['Walk',.75,'front'],['Walk',.9,'front'],['Idle',0,'front']]){
   await page.selectOption('#angle',angle);await page.evaluate(({mode,t})=>{lucyCombined.motion(mode);lucyCombined.tailVariation.reset(()=>0);lucyCombined.setTime(t);},{mode,t});await page.waitForTimeout(100);
   await page.screenshot({path:base+`/new-${mode}-${angle}-${t}.png`});
 }
 for(const [pose,random]of [['high',0],['level',.5],['low',.99]]){
   await page.selectOption('#angle','side');await page.evaluate(random=>{lucyCombined.motion('Walk');lucyCombined.tailVariation.reset(()=>random);lucyCombined.setTime(.8);},random);
   await page.waitForTimeout(100);await page.screenshot({path:base+`/tail-${pose}.png`});
 }
 const metrics=await page.evaluate(()=>{
   const s=lucyCombined,meshes=[];s.model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
   let vertices=0,invalidWeights=0,maxPosition=0,minHeight=Infinity,delta=0;const first=[];
   for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;vertices+=w.count;for(let i=0;i<w.count;i++)if(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)>.001)invalidWeights++;}
   s.motion('Walk');s.tailVariation.reset(()=>0);const v=s.camera.position.clone(),feet=[];
   for(let f=0;f<=36;f++){
     s.setTime(f/30);let index=0;
     for(const mesh of meshes){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=3){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('nonfinite');maxPosition=Math.max(maxPosition,v.length());minHeight=Math.min(minHeight,v.y);if(f===0)first.push(v.clone());if(f===18)delta=Math.max(delta,v.distanceTo(first[index]));index++;}}
     feet.push(s.model.getObjectByName('leg3_control_L').getWorldPosition(v).toArray());
   }
   s.renderer.render(s.scene,s.camera);const gl=s.renderer.getContext(),px=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,px);let contrast=0;for(let i=0;i<px.length;i+=64)if(Math.abs(px[i]-px[0])>20)contrast++;
   const stanceSlip=Math.abs((feet[6][2]+.175*.2/1.2)-feet[0][2]);
   function eyeHeight(){let sum=0,count=0;for(const mesh of meshes){if(mesh.material.name!=='Hazel iris')continue;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);sum+=v.applyMatrix4(mesh.matrixWorld).y;count++;}}return sum/count;}
   s.motion('Idle');s.setTime(.8);const idleEyes=eyeHeight();s.motion('Walk');s.setTime(.8);const walkEyes=eyeHeight();
   const seen=new Set(),initial=meshes[0].skeleton.bones.find(b=>b.name==='tail5').quaternion.clone();let tailMovement=0,minTailHeight=Infinity,maxTailHeight=-Infinity;
   s.tailVariation.reset(()=>0);s.setTime(0);
   for(let frame=0;frame<1800;frame++){
     s.advance(1/30);seen.add(s.tailVariation.index);const tip=s.model.getObjectByName('tail5');tip.getWorldPosition(v);
     minTailHeight=Math.min(minTailHeight,v.y);maxTailHeight=Math.max(maxTailHeight,v.y);tailMovement=Math.max(tailMovement,initial.angleTo(tip.quaternion));
   }
   return{vertices,invalidWeights,maxPosition,minHeight,delta,contrast,stanceSlip,idleEyes,walkEyes,tailMovement,minTailHeight,maxTailHeight,tailProfiles:[...seen],materials:meshes.map(m=>m.material.name),clips:Object.keys(s.actions)};
 });
 assert.equal(metrics.invalidWeights,0);assert(metrics.delta>.02);assert(metrics.minHeight>0);assert(metrics.maxPosition<1);assert(metrics.contrast>100);assert(metrics.stanceSlip<.001);assert.deepEqual(errors,[]);
 assert(metrics.idleEyes-metrics.walkEyes>.02);assert(metrics.tailProfiles.length===3);assert(metrics.maxTailHeight-metrics.minTailHeight>.12);assert(metrics.minTailHeight>.015);
 const gait=await page.evaluate(()=>{
   const s=lucyCombined,v=s.camera.position.clone();
   const legs=[['L',true,0],['L',false,-.24],['R',true,-.5],['R',false,-.74]];
   const position=name=>s.model.getObjectByName(name).getWorldPosition(v).toArray();
   let skeleton;s.model.traverse(o=>{if(o.isSkinnedMesh&&!skeleton)skeleton=o.skeleton;});
   const bindPosition=name=>v.clone().setFromMatrixPosition(skeleton.boneInverses[skeleton.bones.findIndex(b=>b.name===name)].clone().invert());
   const segments=legs.map(([side,rear])=>{const lower=(rear?'leg3_':'paw2_')+side,foot=(rear?'feet_':'paw3_')+side;return{lower,foot,length:bindPosition(lower).distanceTo(bindPosition(foot))};});
   let ikReachError=0,ikKeyframeError=0;const q=s.model.quaternion.clone();
   s.motion('Idle');s.setTime(0);const idleHips=position('pelvis')[1];
   s.motion('Walk');s.setTime(.15);const bodyDrop=idleHips-position('pelvis')[1];
   const baseline=[],shoulders=[[],[]];let contactError=0,lateralSlip=0,forwardSlip=0,profileError=0,loopError=0,minTrack=Infinity,maxTrack=0,maxElbow=0,shoulderOpposition=0;
   s.motion('Walk');
   for(const [profile,random]of [0,.5,.99].entries()){
     s.tailVariation.reset(()=>random);s.setTime(0);const first=legs.map(([side,rear])=>position((rear?'leg3_control_':'paw_control_')+side)),previous={};
     for(let f=0;f<=72;f++){
       const phase=f/72;s.setTime(phase*1.2);
       legs.forEach(([side,rear,offset],i)=>{
         const t=((phase+offset)%1+1)%1,sign=side==='L'?1:-1,p=position((rear?'leg3_control_':'paw_control_')+side);
         minTrack=Math.min(minTrack,sign*p[0]);maxTrack=Math.max(maxTrack,sign*p[0]);
         // Ignore the contact-boundary interpolation frame when measuring stance slip.
         if(t>.04&&t<.60){
           contactError=Math.max(contactError,Math.abs(p[0]-sign*(rear?.012:.010)));
           if(previous[i]&&previous[i].t<t&&t-previous[i].t<.02){
             lateralSlip=Math.max(lateralSlip,Math.abs(p[0]-previous[i].p[0]));
             forwardSlip=Math.max(forwardSlip,Math.abs(p[2]-previous[i].p[2]+.175/72));
           }
           previous[i]={t,p};
         }else delete previous[i];
         if(profile===0)baseline.push(p);else profileError=Math.max(profileError,...p.map((x,axis)=>Math.abs(x-baseline[f*4+i][axis])));
         if(f===72)loopError=Math.max(loopError,...p.map((x,axis)=>Math.abs(x-first[i][axis])));
       });
       const left=position('paw1_L'),right=position('paw1_R');
       for(const {lower,foot,length}of segments){
         const bone=s.model.getObjectByName(lower),end=v.clone().set(0,length,0).applyQuaternion(bone.getWorldQuaternion(q)).add(bone.getWorldPosition(v));
         const error=end.distanceTo(s.model.getObjectByName(foot).getWorldPosition(v));
         ikReachError=Math.max(ikReachError,error);if(f%2===0)ikKeyframeError=Math.max(ikKeyframeError,error);
       }
       maxElbow=Math.max(maxElbow,Math.abs(position('paw2_L')[0]),Math.abs(position('paw2_R')[0]));
       if(profile===0){shoulders[0].push(left[2]);shoulders[1].push(right[2]);}
       shoulderOpposition=Math.max(shoulderOpposition,Math.abs(left[2]+right[2]-.288));
     }
   }
   return{contactError,lateralSlip,forwardSlip,profileError,loopError,minTrack,maxTrack,maxElbow,ikReachError,ikKeyframeError,bodyDrop,shoulderOpposition,shoulderTravel:shoulders.map(xs=>Math.max(...xs)-Math.min(...xs))};
 });
 assert(gait.contactError<.0002);assert(gait.lateralSlip<.0001);assert(gait.forwardSlip<.0002);
 assert(gait.minTrack>.008&&gait.maxTrack<.016);assert(gait.maxElbow<.033);
 assert(gait.profileError<.00001);assert(gait.loopError<.00001);
 assert(gait.shoulderTravel.every(x=>x>.010&&x<.014));assert(gait.shoulderOpposition<.0001);
 // Baked IK endpoints are exact; quaternion interpolation has a small chord error.
 assert(gait.ikKeyframeError<.00002,'raised body exceeds leg reach');assert(gait.ikReachError<.00055,'interpolated ankle alignment drift');
 assert(gait.bodyDrop>.0115&&gait.bodyDrop<.0125,'walking body height regressed');
 const tailFollow=await page.evaluate(()=>{
   const s=lucyCombined,v=s.camera.position.clone(),q=s.model.quaternion.clone();
   const position=name=>s.model.getObjectByName(name).getWorldPosition(v).clone();
   const direction=name=>v.set(0,1,0).applyQuaternion(s.model.getObjectByName(name).getWorldQuaternion(q)).clone();
   const phaseOf=xs=>Math.atan2(xs.reduce((n,x,i)=>n+x*Math.sin(i/72*Math.PI*2),0),xs.reduce((n,x,i)=>n+x*Math.cos(i/72*Math.PI*2),0));
   s.motion('Walk');return[0,.5,.99].map(random=>{
     s.tailVariation.reset(()=>random);let sameSide=0,steps=0,rootDrift=0,maxStep=0,loopError=0;const root=[],tip=[],points=[];
     for(let frame=0;frame<=72;frame++){
       s.setTime(frame/72*1.2);const rootPosition=position('tail1'),rootDirection=direction('tail1'),tipDirection=direction('tail5');
       const end=position('tail5').addScaledVector(tipDirection,.034),fore=position('paw_control_L').z-position('paw_control_R').z;
       rootDrift=Math.max(rootDrift,Math.abs(rootPosition.x));
       if(Math.abs(fore)>.05){steps++;if(rootDirection.x*fore>0)sameSide++;}
       if(frame<72){root.push(rootDirection.x);tip.push(tipDirection.x);}
       if(frame)maxStep=Math.max(maxStep,end.distanceTo(points[frame-1]));
       if(frame===72)loopError=end.distanceTo(points[0]);points.push(end);
     }
     const lag=(phaseOf(tip)-phaseOf(root)+Math.PI*2)%(Math.PI*2)*1.2/(Math.PI*2),xs=points.map(p=>p.x);
     return{lag,sameSide:sameSide/steps,rootDrift,maxStep,loopError,span:Math.max(...xs)-Math.min(...xs),minTipHeight:Math.min(...points.map(p=>p.y))};
   });
 });
 for(const tail of tailFollow){
   assert(tail.lag>.19&&tail.lag<.25);assert(tail.sameSide>.9);assert(tail.rootDrift<.0001);
   assert(tail.span>.025&&tail.span<.045);assert(tail.minTipHeight>.015);assert(tail.maxStep<.003);assert(tail.loopError<.00001);
 }
 const pawMotion=await page.evaluate(()=>{
   const s=lucyCombined,v=s.camera.position.clone(),q=s.model.quaternion.clone();
   const feet=[['paw3_L',-.24],['paw3_R',-.74],['feet_L',0],['feet_R',-.5]],meshes=[];
   const rotation=name=>s.model.getObjectByName(name).getWorldQuaternion(q).clone();
   const direction=name=>v.set(0,1,0).applyQuaternion(rotation(name)).clone();
   const at=(t,offset)=>s.setTime(((t-offset+1)%1)*1.2);
   // Check every vertex influenced by a paw, including between exported keyframes.
   s.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const a=mesh.geometry.attributes,indices=[];
     for(let i=0;i<a.position.count;i++)if([0,1,2,3].some(c=>a.skinWeight.getComponent(i,c)>.2&&feet.some(([name])=>name===mesh.skeleton.bones[a.skinIndex.getComponent(i,c)].name)))indices.push(i);
     if(indices.length)meshes.push({mesh,indices});
   });
   s.motion('Walk');return[0,.5,.99].map(random=>{
     s.tailVariation.reset(()=>random);
     const rest=feet.map(([name,offset])=>{at(.3,offset);return rotation(name);}),first=[],previous=[];
     let minPawHeight=Infinity,stanceRotation=0,maxStep=0,loopError=0,frontDirection=-Infinity,rearAlignment=1;
     for(let frame=0;frame<=120;frame++){
       s.setTime(frame/100);
       for(const {mesh,indices}of meshes){mesh.skeleton.update();for(const i of indices){mesh.getVertexPosition(i,v);minPawHeight=Math.min(minPawHeight,v.applyMatrix4(mesh.matrixWorld).y);}}
       feet.forEach(([name,offset],i)=>{
         const pose=rotation(name),t=((frame/120+offset)%1+1)%1;
         if(t>.04&&t<.60)stanceRotation=Math.max(stanceRotation,pose.angleTo(rest[i]));
         if(frame)maxStep=Math.max(maxStep,pose.angleTo(previous[i]));else first[i]=pose;
         if(frame===120)loopError=Math.max(loopError,pose.angleTo(first[i]));previous[i]=pose;
       });
     }
     feet.forEach(([name,offset])=>{
       const rear=name.startsWith('feet');at(.64+.36*(rear?.5:.45),offset);const d=direction(name);
       if(!rear)frontDirection=Math.max(frontDirection,d.z);
       else{const lower=direction('leg3_'+name.slice(-1));d.x=0;lower.x=0;rearAlignment=Math.min(rearAlignment,d.normalize().dot(lower.normalize()));}
     });
     return{minPawHeight,stanceRotation,maxStep,loopError,frontDirection,rearAlignment};
   });
 });
 for(const paw of pawMotion){
   assert(paw.minPawHeight>0,'paw intersects the floor');assert(paw.stanceRotation<.0001,'planted paw rotates');
   assert(paw.frontDirection<-.25,'carpus does not fold backward');assert(paw.rearAlignment>.998,'rear paw does not extend at swing apex');
   assert(paw.maxStep<.23,'paw rotation snaps');assert(paw.loopError<.0001,'paw loop is discontinuous');
 }
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('file://'+base+'/lucy-preview.html');await mobile.waitForFunction(()=>window.lucyCombined);await mobile.waitForTimeout(300);
 const mobileState=await mobile.evaluate(()=>{const s=lucyCombined,v=s.camera.position.clone();let maxX=0,maxY=0;s.model.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);s.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i+=5){o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld).project(s.camera);maxX=Math.max(maxX,Math.abs(v.x));maxY=Math.max(maxY,Math.abs(v.y));}});
   s.renderer.render(s.scene,s.camera);const gl=s.renderer.getContext(),px=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,px);let contrast=0;for(let i=0;i<px.length;i+=64)if(Math.abs(px[i]-px[0])>20)contrast++;
   return{overflow:document.documentElement.scrollWidth>innerWidth,maxX,maxY,contrast};});
 await mobile.screenshot({path:base+'/new-mobile.png'});assert(!mobileState.overflow);assert(mobileState.maxX<.98&&mobileState.maxY<.9);assert(mobileState.contrast>100);assert.deepEqual(errors,[]);
 fs.writeFileSync(base+'/qa.json',JSON.stringify({metrics,gait,tailFollow,pawMotion,mobileState,errors},null,2));console.log(JSON.stringify({metrics,gait,tailFollow,pawMotion,mobileState,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
