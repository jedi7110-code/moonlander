// Motion seam audit for Milo in the real cabin (2026-11-13).
//
// Runs the cabin page several times faster than real time without drawing, and
// records every frame in which Milo's pose, place or heading changes faster than
// a person's could: joints turning tens of radians per second (a pose swapped in
// one frame), the root moving faster than 2 m/s or turning faster than 7 rad/s,
// and planted feet travelling over the floor. Each event is filed under what
// Milo was doing before and after it (brain state, station, kind of movement,
// phase of a visit), so the list reads as "which hand-over between two
// motions jumps, and by how much".
//
// Use: start the dev server (launch entry "moon-obs-dev"), open any page of it,
// paste this file into the console, then
//   const audit=await startSeamAudit();      // boots obs.html in a hidden frame
//   await audit.run(40);                      // seconds of real time; repeat as needed
//   audit.report();                           // transitions and spots inside one motion
// A ship's day is 15 minutes; 40 s of real time covers about 5 minutes of it.
// Results of the first run: studies/milo/motion-seams.md.
globalThis.startSeamAudit=async function(){
  const frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:0;top:0;width:960px;height:540px;border:0;opacity:.01;pointer-events:none';
  document.body.append(frame);frame.src='/obs/obs.html?debug&opening=0&audit=1';
  const A={on:true,synthetic:false,now:0,queue:[],after:null,frame};
  // The frame's animation loop is driven from here, so that it runs when hidden and as fast as it can.
  const hook=()=>{try{const w=frame.contentWindow;if(w&&w.location.href.includes('audit=1')&&!w.__patched){w.__patched=true;
    Object.defineProperty(w.document,'hidden',{get:()=>false});Object.defineProperty(w.document,'visibilityState',{get:()=>'visible'});
    const channel=new w.MessageChannel();A.kick=()=>channel.port2.postMessage(0);
    channel.port1.onmessage=()=>{if(!A.on)return;const batch=A.queue.splice(0);if(!batch.length)return;A.now=A.synthetic?A.now+1000/60:w.performance.now();for(const callback of batch)callback(A.now);A.after?.();};
    w.requestAnimationFrame=callback=>{A.queue.push(callback);channel.port2.postMessage(0);return A.queue.length;};w.cancelAnimationFrame=()=>{};}}catch{}
    if(!frame.contentWindow?.__patched)setTimeout(hook,0);};
  hook();
  for(let i=0;i<240&&!(frame.contentWindow?.cabinView?.ship?.staticMesh&&frame.contentWindow.cabinSim);i++)await new Promise(r=>setTimeout(r,250));
  const w=frame.contentWindow,S=w.cabinSim,view=w.cabinView;
  view.startupLighting?.activate?.();S.brain.releaseOpeningSleep?.();
  // pose everything, draw nothing (render's last argument)
  const render=view.render.bind(view);view.render=(dt,time,actor,brain,cat,care,paused,airlock,xr)=>render(dt,time,actor,brain,cat,care,paused,airlock,xr,true);
  const milo=view.milo,U=milo.userData,Vector3=milo.position.constructor,Quaternion=milo.quaternion.constructor;
  const side=s=>s<0?'L':'R';
  // [name, object, limit in rad/s]
  const joints=[['body',U.body,10],['chest',U.chest,10],['head',U.head,10],...U.arms.flatMap(a=>[['arm'+side(a.side),a.arm,26],['elbow'+side(a.side),a.elbow,26]]),
    ...U.legs.flatMap(l=>[['leg'+side(l.side),l.leg,26],['knee'+side(l.side),l.knee,30],['boot'+side(l.side),l.boot,30]])];
  // [name, object, limit in m/s]; the first two are the ankles
  const points=[...U.legs.map(l=>['boot'+side(l.side),l.boot,6.5]),...U.arms.map(a=>['hand'+side(a.side),a.hand,5.5]),['head',U.head,3],['hips',U.body,2.4]];
  const context=()=>{const b=S.brain,a=S.actor,bits=[b.state,b.cur?.id??b.actKey??''];
    if(a.busy)bits.push('move:'+(a.queue[0]?.type??'')+(a.gait?'+walking':a.turn?'+turning':''));if(a.onStairs)bits.push('stairs');
    if(b.bathroom)bits.push('bath:'+b.bathroom.phase);
    for(const key of ['loungeEntry','loungeExit','loungeStow','reclineExit'])if(b[key])bits.push(key);
    for(const [key,label] of [['gymVisit','gym'],['bunkVisit','bunk'],['smokingVisit','smoke'],['hatchRepair','repair'],['grooming','groom']])if(b[key])bits.push(label+':'+(b[key].phase??''));
    for(const key of ['waitingForVisitor','waitingForHatch','waitingForCat','waitingForDroid','waitingForStairs','stairWaiting'])if(a[key])bits.push(key);
    return bits.join('|');};
  const result=A.result={events:new Map(),frames:{},slide:{},seconds:0};
  let previous=null;
  const note=(kind,part,value,from,to)=>{const key=`${kind} ${part.replace(/[LR]$/,'')} :: ${from}${from===to?'':'  =>  '+to}`,event=result.events.get(key)??{count:0,max:0,times:[]};
    event.count++;event.max=Math.max(event.max,value);if(event.times.length<4)event.times.push(+result.seconds.toFixed(2));result.events.set(key,event);};
  A.after=()=>{
    if(!A.sampling)return;
    milo.updateMatrixWorld(true);
    const now={context:context(),place:milo.getWorldPosition(new Vector3()),heading:milo.getWorldQuaternion(new Quaternion()),joints:joints.map(([,o])=>o.quaternion.clone()),
      points:points.map(([,o])=>o.getWorldPosition(new Vector3())),offFloor:Boolean(S.actor.climbing||S.actor.onStairs)};
    result.seconds+=1/60;result.frames[now.context]=(result.frames[now.context]??0)+1;
    if(previous){
      const from=previous.context,to=now.context,speed=now.place.distanceTo(previous.place)*60,turn=now.heading.angleTo(previous.heading)*60;
      if(speed>2)note('rootJump','root',speed,from,to);if(turn>7)note('rootTurn','root',turn,from,to);
      joints.forEach(([name,,limit],i)=>{const rate=now.joints[i].angleTo(previous.joints[i])*60;if(rate>limit)note('joint',name,rate,from,to);});
      points.forEach(([name,,limit],i)=>{const rate=now.points[i].distanceTo(previous.points[i])*60;if(rate>limit)note('point',name,rate,from,to);});
      // a foot whose ankle is at standing height in both frames is planted: it should not travel
      if(!now.offFloor&&!previous.offFloor)for(const i of [0,1]){const a=now.points[i],b=previous.points[i];
        if(a.y-now.place.y<.119&&b.y-previous.place.y<.119){const d=Math.hypot(a.x-b.x,a.z-b.z);if(d*60>.10){const slide=result.slide[to]??={metres:0,frames:0,fastest:0};slide.metres+=d;slide.frames++;slide.fastest=Math.max(slide.fastest,d*60);}}}
    }
    previous=now;
  };
  A.run=async seconds=>{A.sampling=true;A.synthetic=true;A.now=A.now||w.performance.now();A.on=true;A.kick();await new Promise(r=>setTimeout(r,seconds*1000));A.sampling=false;A.on=false;return `${(result.seconds/60).toFixed(1)} minutes of ship time, ${result.events.size} kinds of event`;};
  A.report=()=>{
    const rows=[...result.events].map(([key,e])=>({key,count:e.count,max:+e.max.toFixed(0),at:e.times[0]})).sort((a,b)=>b.max-a.max);
    console.table(rows.filter(r=>r.key.includes('  =>  ')));console.table(rows.filter(r=>!r.key.includes('  =>  ')));
    console.table(Object.entries(result.slide).map(([context,s])=>({context,metres:+s.metres.toFixed(2),seconds:+(s.frames/60).toFixed(1),of:+((result.frames[context]??0)/60).toFixed(0),fastest:+s.fastest.toFixed(2)})).sort((a,b)=>b.metres-a.metres));
    return rows;};
  return A;
};
