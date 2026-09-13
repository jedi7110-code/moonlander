const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'local/cabin/qa');
fs.mkdirSync(out,{recursive:true});

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const errors=[],results={};
  try{
    const page=await browser.newPage({viewport:{width:1200,height:800}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    // Expose the shipped view in this test response only, without shipping a debug API.
    await page.route('**/assets/obs-*.js',async route=>{
      const response=await route.fetch();let body=await response.text();
      assert(body.includes('this.renderer.setPixelRatio('));
      body=body.replace('this.renderer.setPixelRatio(','window.lucyView=this,this.renderer.setPixelRatio(');
      assert(/([\w$]+)\(this\.cat,\{/.test(body));
      body=body.replace(/([\w$]+)\(this\.cat,\{/,'(window.animateLucyForQA=$1,$1)(this.cat,{');
      const traffic=body.match(/function ([\w$]+)\([^)]*\)\{[^{}]*\.waitingForCat=[^{}]*\.blocksCrew/);
      assert(traffic,'traffic updater not found');body+=`\nwindow.advanceTrafficForQA=${traffic[1]};`;
      await route.fulfill({response,body});
    });
    await page.goto(process.env.CABIN_URL||'http://127.0.0.1:4173/3D/obs.html');
    await page.locator('#loading').waitFor({state:'hidden',timeout:60000});
    assert(!await page.locator('#obs-error').isVisible());
    await page.evaluate(()=>{
      const original=lucyView.render.bind(lucyView);
      lucyView.render=(...args)=>{window.lucyArgs=args;return original(...args);};
    });
    await page.waitForFunction(()=>window.lucyArgs);
    await page.locator('#obs-pause').click();
    await page.evaluate(()=>{
      const v=lucyView,a=lucyArgs;
      window.cabinQA={
        routine:a[4],actor:a[2],care:a[5],time:a[1],
        step(){advanceTrafficForQA(this.actor,this.routine,1/30);this.time+=1/30;v.render(1/30,this.time,a[2],a[3],this.routine,a[5],false,a[7]);},
        reset(floor,x){const r=this.routine;r.motion=new r.motion.constructor({floor,x});r.rest('look',100);r.hunger=80;r.pendingMove=null;r.playHost=null;r.playRelease=null;this.actor.floor=floor;this.actor.y=r.motion.y;this.actor.x=x-250;this.actor.queue=[];this.actor.waitingForCat=false;v.cat.userData.initialized=false;},
        frame(height=1.25){v.mode='manual';v.center.copy(v.cat.position);v.center.y+=.24;v.targetCenter.copy(v.center);v.viewHeight=v.targetHeight=height;v.setFrustum();v.camera.position.set(v.center.x,v.center.y+1.6,40);v.camera.lookAt(v.center.x,v.center.y,0);v.renderer.render(v.scene,v.camera);},
        pixels(){v.renderer.render(v.scene,v.camera);const gl=v.renderer.getContext(),px=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,px);let contrast=0;for(let i=0;i<px.length;i+=64)if(Math.abs(px[i]-px[0])>20)contrast++;return contrast;}
      };
    });
    const shot=async name=>{await page.waitForTimeout(100);await page.screenshot({path:path.join(out,name+'.png')});};
    results.eat=await page.evaluate(()=>{
      const q=cabinQA,r=q.routine;q.reset(2,550);r.remaining=0;q.care.supplies.catfood=3;r.fetch();
      for(let i=0;i<300&&r.mode!=='eat';i++)q.step();
      for(let i=0;i<90;i++)q.step();q.frame();
      return{mode:r.mode,x:r.motion.x,stock:q.care.supplies.catfood,contrast:q.pixels()};
    });
    assert.equal(results.eat.mode,'eat');assert.equal(results.eat.stock,2);assert(results.eat.contrast>100);
    await shot('eat');
    results.poses=[];
    for(const [mode,age]of [['walk',.8],['look',3],['sleep',3],['groom',1.8],['groom',4],['groom',7.5],['play',2]]){
      await page.evaluate(({mode,age})=>{
        const q=cabinQA,v=lucyView;q.reset(0,880);q.step();
        v.cat.userData.initialized=false;
        animateLucyForQA(v.cat,{dt:1/30,time:age,mode,moving:mode==='walk',actionTime:age,walkDistance:.19,facing:1,remaining:100});q.frame();
      },{mode,age});
      await shot(`${mode}-${age}`);
      results.poses.push({mode,age,contrast:await page.evaluate(()=>cabinQA.pixels())});
    }
    results.hops=[];
    for(const up of [true,false]){
      await page.evaluate(up=>{const q=cabinQA,r=q.routine;q.reset(0,up?985:1060);r.mode='fetch';r.motion.goTo({floor:0,x:up?1060:1000},()=>r.rest('look',100));},up);
      const phases=[];
      for(let stage=0;stage<4;stage++){
        const sample=await page.evaluate(()=>{
          const q=cabinQA,r=q.routine;
          for(let i=0;i<500;i++){q.step();const h=r.motion.hop;if(h&&h.phase!==q.lastPhase&&(h.phase!=='flight'||h.age/h.duration>.45)){q.lastPhase=h.phase;q.frame(1.7);return{phase:h.phase,elevation:r.motion.elevation};}if(!r.motion.busy){q.lastPhase=null;q.frame(1.7);return{phase:'complete',onSofa:r.motion.onSofa};}}
          throw Error('jump did not finish');
        });
        phases.push(sample);await shot(`hop-${up?'up':'down'}-${sample.phase}`);
        if(sample.phase==='complete')break;
      }
      assert.deepEqual(phases.map(p=>p.phase),['prepare','flight','land','complete']);assert.equal(phases.at(-1).onSofa,up);
      results.hops.push({up,phases});
    }
    results.passage=await page.evaluate(()=>{
      const q=cabinQA,r=q.routine;q.reset(1,744);r.mode='fetch';r.motion.goTo({floor:2,x:760},()=>r.rest('look',100));const phases=new Set();let hidden=false;
      for(let i=0;i<600;i++){q.step();if(r.motion.portal)phases.add(r.motion.portal.phase);if(!lucyView.cat.visible)hidden=true;if(i>0&&!r.motion.busy)break;}
      return{floor:r.motion.floor,phases:[...phases],hidden,visible:lucyView.cat.visible};
    });
    assert.deepEqual(results.passage.phases,['turnIn','enter','transit','exit','turnOut']);assert.equal(results.passage.floor,2);assert(results.passage.hidden&&results.passage.visible);
    results.yielding=[];
    for(const direction of [-1,1]){
      const metrics=await page.evaluate(direction=>{
        const q=cabinQA,r=q.routine,v=lucyView;q.reset(2,504.4);r.motion.z=.89;r.motion.facing=-1;r.rest('eat',8);r.modeTime=3;
        q.actor.x=r.motion.x-direction*140;q.actor.goTo({floor:2,x:r.motion.x+direction*140});
        const p=v.center.clone(),bounds=root=>{const b={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};root.updateMatrixWorld(true);root.traverse(m=>{if(!m.isMesh)return;m.skeleton?.update();for(let i=0;i<m.geometry.attributes.position.count;i+=3){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minZ=Math.min(b.minZ,p.z);b.maxZ=Math.max(b.maxZ,p.z);}});return b;};
        let waited=false,minGap=Infinity;
        for(let i=0;i<480;i++){
          q.step();waited||=q.actor.waitingForCat;
          if(i%3===0){const a=bounds(v.milo),b=bounds(v.cat);if(a.maxZ>b.minZ&&b.maxZ>a.minZ)minGap=Math.min(minGap,Math.max(a.minX-b.maxX,b.minX-a.maxX));}
        }
        return{direction,waited,minGap,arrived:!q.actor.busy,catZ:r.motion.z};
      },direction);
      assert(metrics.waited&&metrics.arrived);assert(metrics.minGap>0,JSON.stringify(metrics));results.yielding.push(metrics);
    }
    results.lanes=await page.evaluate(()=>{
      const q=cabinQA,r=q.routine,v=lucyView;q.reset(0,940);r.mode='fetch';r.motion.goTo({floor:0,x:820});q.actor.x=820;q.actor.goTo({floor:0,x:1000});
      let crossed=false,gap=0;
      for(let i=0;i<180;i++){q.step();if(Math.abs(r.motion.x-q.actor.x)<1.5){crossed=true;break;}}
      const p=v.center.clone(),bounds=root=>{let min=Infinity,max=-Infinity;root.updateMatrixWorld(true);root.traverse(m=>{if(!m.isMesh)return;m.skeleton?.update();for(let i=0;i<m.geometry.attributes.position.count;i+=2){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);min=Math.min(min,p.z);max=Math.max(max,p.z);}});return{min,max};};
      gap=bounds(v.cat).min-bounds(v.milo).max;q.frame(2.6);v.center.y=v.cat.position.y+.95;v.targetCenter.copy(v.center);
      return{crossed,gap,catZ:r.motion.z,miloZ:v.milo.position.z};
    });
    assert(results.lanes.crossed&&results.lanes.gap>.4);await shot('passing-lanes');
    results.click=await page.evaluate(()=>{
      const q=cabinQA,v=lucyView;q.reset(0,880);q.step();q.frame(1.8);
      const p=v.cat.userData.model.getObjectByName('pelvis').getWorldPosition(v.center.clone()).project(v.camera),r=v.canvas.getBoundingClientRect();
      const point={clientX:r.left+(p.x+1)*r.width/2,clientY:r.top+(1-p.y)*r.height/2};
      return{point,target:v.targetAt(point)};
    });
    assert.equal(results.click.target.id,'cat');
    await page.mouse.click(results.click.point.clientX,results.click.point.clientY);
    assert.equal(await page.evaluate(()=>lucyView.mode),'cat');
    results.pause=await page.evaluate(()=>{const b=[];lucyView.cat.traverse(o=>{if(o.isBone)b.push(...o.position.toArray(),...o.quaternion.toArray());});return b;});
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(()=>{const b=[];lucyView.cat.traverse(o=>{if(o.isBone)b.push(...o.position.toArray(),...o.quaternion.toArray());});return b;}),results.pause);
    delete results.pause;
    for(const viewport of [{width:1200,height:800},{width:472,height:1180},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(200);
      const metrics=await page.evaluate(()=>{
        const q=cabinQA,v=lucyView;q.frame(1.6);v.cat.updateMatrixWorld(true);v.camera.updateMatrixWorld(true);const p=v.center.clone();let maxX=0,maxY=0;
        v.cat.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i+=4){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld).project(v.camera);maxX=Math.max(maxX,Math.abs(p.x));maxY=Math.max(maxY,Math.abs(p.y));}});
        return{overflow:document.documentElement.scrollWidth>innerWidth,contrast:q.pixels(),maxX,maxY};
      });
      assert(!metrics.overflow);assert(metrics.contrast>100);assert(metrics.maxX<.98&&metrics.maxY<.95);results[`${viewport.width}x${viewport.height}`]=metrics;
      await shot(`viewport-${viewport.width}`);
    }
    assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
