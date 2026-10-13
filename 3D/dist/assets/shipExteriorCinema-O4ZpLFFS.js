import"./modulepreload-polyfill-B5Qt9EMX.js";import{l as j,u as U,g as B,c as H,a as O,o as J,C as V,W as K,S as Q,A as Y,f as Z,H as ee,D as W,P as te,V as ie}from"./three-DjX1_1nQ.js";import{c as re,a as ae,b as oe,E as ne,d as se}from"./exterior-stars-DXt5OfsZ.js";import{c as ce,a as le,b as me}from"./exterior-dissolve-Dbz7OQtn.js";import"./BufferGeometryUtils-BFOy66kT.js";import"./lighting-DfNkRcpQ.js";import"./viewing-wall-profile-DKWEhHiw.js";import"./bathroom-window-BQs6MF5T.js";import"./bulkhead-gate-BLZMou8p.js";import"./rear-room-furnishings-kyfWqvCA.js";import"./characters-BqGlethP.js";import"./milo-body-BavQTKyq.js";import"./triangle-subset-BGB0udVJ.js";import"./eva-CqWsRMWW.js";import"./models-BHR3Lk83.js";function de(){const t=new j(4200,96,64),i=new U({uniforms:{lightDirection:{value:new B(64,-110,92).normalize()}},vertexShader:`
      varying vec3 vSurface;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main(){
        vSurface=position;
        vec4 world=modelMatrix*vec4(position,1.0);
        vWorld=world.xyz;vNormal=mat3(modelMatrix)*normal;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,fragmentShader:`
      uniform vec3 lightDirection;
      varying vec3 vSurface;
      varying vec3 vWorld;
      varying vec3 vNormal;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                       mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                       mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p){
        float value=0.0,weight=.5;
        for(int i=0;i<5;i++){value+=weight*noise(p);p=p*2.03+vec3(3.1,-1.7,2.4);weight*=.5;}
        return value;
      }
      void main(){
        vec3 surface=normalize(vSurface),normal=normalize(vNormal);
        vec3 warp=vec3(fbm(surface*3.7),fbm(surface*3.7+7.1),fbm(surface*3.7-5.3));
        float land=fbm(surface*3.0+warp*1.4);
        vec3 ocean=mix(vec3(.021,.048,.069),vec3(.037,.081,.104),land);
        vec3 rock=mix(vec3(.072,.082,.076),vec3(.151,.153,.126),fbm(surface*27.0));
        vec3 color=mix(ocean,rock,smoothstep(.49,.57,land));
        float clouds=smoothstep(.43,.66,fbm(surface*8.0+warp*2.3));
        color=mix(color,vec3(.43,.48,.49),clouds*.83);
        float sun=max(0.0,dot(normal,normalize(lightDirection)));
        color*=.008+sun*1.6;
        float rim=pow(1.0-max(0.0,dot(normal,normalize(cameraPosition-vWorld))),5.0);
        color+=vec3(.055,.135,.20)*rim*(.15+sun*.6);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});i.name="Distant blue-grey planet / stationary sunlight";const c=new H(t,i);return c.name="Planet background",c.visible=!1,c.renderOrder=1,{body:c,show(o){c.visible=!!o,o&&c.position.fromArray(o)},dispose(){t.dispose(),i.dispose()}}}function pe(t,i){const c=new O,o=new J(i.geometry,i.material,i.count);o.instanceMatrix=i.instanceMatrix,o.matrixAutoUpdate=!1,o.frustumCulled=!1,c.add(o);const g=new V;return{render(b,m,l,u){const y=i.visible;let f=y;for(let s=i.parent;s;s=s.parent)f=f&&s.visible;try{i.visible=!1,t.render(b,m)}finally{i.visible=y}if(!f)return!1;(u.width!==l.width||u.height!==l.height)&&u.setSize(l.width,l.height),o.matrix.copy(i.matrixWorld);const n=i.material.uniforms,S=i.material.depthTest;n.sceneDepth.value=l.depthTexture,n.depthEnabled.value=!0,n.viewport.value.set(l.width,l.height),n.cameraRange.value.set(m.near,m.far),t.getClearColor(g);const C=t.getClearAlpha();try{i.material.depthTest=!1,t.setRenderTarget(u),t.setClearColor(0,0),t.render(c,m)}finally{i.material.depthTest=S,n.depthEnabled.value=!1,t.setClearColor(g,C),t.setRenderTarget(l)}return!0}}}const r=t=>document.getElementById(t),p=new URLSearchParams(location.search),L=p.get("mode")==="opening",A=p.get("embedded")==="1",G=t=>{A&&parent.postMessage({type:"tara-exterior",action:t},location.origin)};A&&(r("cabin").hidden=!0);r("scene-number").hidden=A;document.addEventListener("keydown",t=>{t.key==="Escape"&&(t.preventDefault(),G("exit"))});let I=()=>{};await new Promise(t=>requestAnimationFrame(()=>requestAnimationFrame(t)));try{let _=function(e,a,d){o.root.position.x=e.shipX,o.root.visible=e.shipVisible,o.setAngle(e.angle),n.position.fromArray(e.eye),S.fromArray(e.target),se(o,e.probe);for(const w of o.pods)w.visible=e.habitatsVisible;return n.fov=e.fov,n.near=e.near,n.far=e.far,n.up.fromArray(e.up),n.updateProjectionMatrix(),n.lookAt(S),l.show(e.planet?.position),y.update(e),f.position.set(e.shipX-38,-15,-30),f.target.position.set(e.shipX,0,0),m.follow(n),i.getDrawingBufferSize(C),b.update(n,C,e.optics),g.render(t,n,a,d)},E=function(){const e=me(s,{...X,aspect:n.aspect}),a=e.shot;c.render(e,_),D.style.opacity=String(a.titleOpacity*.88),N.style.visibility=a.logoReveal>0?"visible":"hidden",N.style.clipPath=a.logoClip,r("cut").style.opacity=String(a.fade);const d=w=>String(w.number).padStart(2,"0");return r("scene-number").textContent=e.to?`SCENE ${d(e.from)} → ${d(e.to)}`:`SCENE ${d(a)}`,r("time").textContent=a.cruising?`航行中 ${a.time.toFixed(1)} 秒`:`${a.time.toFixed(1)} / ${a.duration.toFixed(0)} 秒`,r("timeline").max=Math.max(a.duration,a.time),r("timeline").value=a.time,a},x=function(e){h=e,v=performance.now(),r("play").textContent=e?"一時停止":"再開",r("play").setAttribute("aria-pressed",String(e));const a=new URLSearchParams(location.search);a.set("time",s.toFixed(3)),e?a.delete("paused"):a.set("paused","1"),history.replaceState(null,"",`?${a}`)},q=function(e){if(!R){if(F=requestAnimationFrame(q),document.hidden){v=0;return}h&&v&&(s+=Math.max(0,(e-v)/1e3)),v=e,E()}};const t=new O;t.background=new V("#030609");const i=new K({canvas:r("exterior-view"),antialias:!0,powerPreference:"high-performance"});i.setPixelRatio(Math.min(devicePixelRatio,1.6)),i.outputColorSpace=Q,i.toneMapping=Y,i.toneMappingExposure=1.18,i.shadowMap.enabled=!0,i.shadowMap.type=Z;const c=ce(i),o=re();o.setCoreScale(Number(p.get("core"))||2.6),t.add(o.root);const g=pe(i,o.probeThrusters.gas),b=ae(o),m=oe();t.add(m.haze,m.field,new ee(12899809,3754835,.68));const l=de();t.add(l.body);const u=new W(16773844,3.15),y=le(u,o),f=new W(9217981,.65);t.add(u,f,u.target,f.target);const n=new te(38,1,.1,2400),S=new B,C=new ie;let s=Math.max(0,Number(p.get("time"))||0),h=p.get("paused")!=="1",v=0,F=0,R=!1;const z=L&&s===0&&h;z||document.body.classList.remove("waiting-for-film");const X={opening:L,coreScale:o.coreScale,phase:(p.has("phase")?Number(p.get("phase")):55)*Math.PI/180,rpm:p.has("rpm")?Number(p.get("rpm")):ne.rpm},D=document.querySelector(".identity"),N=D.querySelector(".logo-reveal"),k=new ResizeObserver(()=>{const e=r("exterior-view").getBoundingClientRect();i.setSize(Math.max(1,e.width),Math.max(1,e.height),!1),n.aspect=e.width/Math.max(1,e.height),n.updateProjectionMatrix()});k.observe(r("exterior-view"));const M=r("exterior-view").getBoundingClientRect();i.setSize(M.width,M.height,!1),n.aspect=M.width/M.height,r("play").onclick=()=>x(!h),r("restart").onclick=()=>{s=0,x(!0)},x(h),r("timeline").oninput=()=>{s=Number(r("timeline").value),x(!1)},E(),o.root.visible=!0,await i.compileAsync(t,n),document.documentElement.dataset.shipReadyMs=performance.now().toFixed(1),z?await new Promise(e=>{let a=0,d=0;const w=performance.now();function T(P){E(),d=a&&P-a<=50?d+1:0,a=P,P-w>=550&&d>=4||P-w>=3e3?e():requestAnimationFrame(T)}requestAnimationFrame(T)}):s===0&&h&&(s=(performance.now()-Number(document.documentElement.dataset.spaceStartedMs||0))/1e3),E(),r("space-boot").hidden=!0,r("status").hidden=!0,r("cinema-controls").hidden=A&&L,G("ready"),z&&await new Promise(e=>requestAnimationFrame(e)),document.body.classList.remove("waiting-for-film"),v=performance.now(),F=requestAnimationFrame(q);const $=()=>{v=performance.now()};document.addEventListener("visibilitychange",$),I=()=>{R=!0,cancelAnimationFrame(F),document.removeEventListener("visibilitychange",$),k.disconnect(),c.dispose(),b.dispose(),m.dispose(),l.dispose(),o.dispose(),i.dispose(),i.forceContextLoss()},r("exterior-view").addEventListener("webglcontextlost",e=>{R||(e.preventDefault(),x(!1),r("status").hidden=!1,r("status").textContent="映像接続が中断されました。船内へ戻って再度お試しください。")})}catch(t){console.error(t),r("status").hidden=!1,r("cinema-controls").hidden=!1,r("status").textContent="船体映像を開けませんでした。船内へ戻って再度お試しください。"}window.addEventListener("pagehide",t=>{t.persisted||I()});
