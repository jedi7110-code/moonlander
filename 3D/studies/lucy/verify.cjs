const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=require('node:path').join(__dirname,'local');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('file://'+base+'/lucy-preview.html');await page.waitForFunction(()=>window.lucyCombined);await page.evaluate(()=>lucyCombined.pause(true));
 for(const [mode,t,angle]of [['Walk',0,'side'],['Walk',.3,'side'],['Walk',.8,'side'],['Walk',.8,'oblique'],['Idle',0,'front']]){
   await page.selectOption('#angle',angle);await page.evaluate(({mode,t})=>{lucyCombined.motion(mode);lucyCombined.setTime(t);},{mode,t});await page.waitForTimeout(100);
   await page.screenshot({path:base+`/new-${mode}-${angle}-${t}.png`});
 }
 const metrics=await page.evaluate(()=>{
   const s=lucyCombined,meshes=[];s.model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
   let vertices=0,invalidWeights=0,maxPosition=0,minHeight=Infinity,delta=0;const first=[];
   for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;vertices+=w.count;for(let i=0;i<w.count;i++)if(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)>.001)invalidWeights++;}
   s.motion('Walk');const v=s.camera.position.clone(),feet=[];
   for(let f=0;f<=36;f++){
     s.setTime(f/30);let index=0;
     for(const mesh of meshes){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=3){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('nonfinite');maxPosition=Math.max(maxPosition,v.length());minHeight=Math.min(minHeight,v.y);if(f===0)first.push(v.clone());if(f===18)delta=Math.max(delta,v.distanceTo(first[index]));index++;}}
     feet.push(s.model.getObjectByName('leg3_control_L').getWorldPosition(v).toArray());
   }
   s.renderer.render(s.scene,s.camera);const gl=s.renderer.getContext(),px=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,px);let contrast=0;for(let i=0;i<px.length;i+=64)if(Math.abs(px[i]-px[0])>20)contrast++;
   const stanceSlip=Math.abs((feet[6][2]+.175*.2/1.2)-feet[0][2]);
   return{vertices,invalidWeights,maxPosition,minHeight,delta,contrast,stanceSlip,materials:meshes.map(m=>m.material.name),clips:Object.keys(s.actions)};
 });
 assert.equal(metrics.invalidWeights,0);assert(metrics.delta>.02);assert(metrics.minHeight>-.006);assert(metrics.maxPosition<1);assert(metrics.contrast>100);assert(metrics.stanceSlip<.001);assert.deepEqual(errors,[]);
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('file://'+base+'/lucy-preview.html');await mobile.waitForFunction(()=>window.lucyCombined);await mobile.waitForTimeout(300);
 const mobileState=await mobile.evaluate(()=>{const s=lucyCombined,v=s.camera.position.clone();let maxX=0,maxY=0;s.model.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);s.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i+=5){o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld).project(s.camera);maxX=Math.max(maxX,Math.abs(v.x));maxY=Math.max(maxY,Math.abs(v.y));}});return{overflow:document.documentElement.scrollWidth>innerWidth,maxX,maxY};});
 await mobile.screenshot({path:base+'/new-mobile.png'});assert(!mobileState.overflow);assert(mobileState.maxX<.98&&mobileState.maxY<.9);assert.deepEqual(errors,[]);
 fs.writeFileSync(base+'/qa.json',JSON.stringify({metrics,mobileState,errors},null,2));console.log(JSON.stringify({metrics,mobileState,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
