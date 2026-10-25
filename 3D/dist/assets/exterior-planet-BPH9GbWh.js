import{h as n,r as $,v as J,d as Z,f as ee,X as ae,Y as oe,ae as te,af as ie,w as re,Q as se,i as j}from"./three-CxW9jrRV.js";const H=1495978707e-1,ne=13271244004127942e-5,N=398600.435507,q=(i,s)=>2*Math.PI*Math.sqrt(i**3/s),_=(i,s)=>(i%s+s)%s/s*2*Math.PI,B=Object.freeze({name:"S-01",massSolar:.8,radiusKm:556560,luminositySolar:.4,temperatureK:5100,mu:ne*.8}),ce=[{id:"rust",name:"S-01 b",kind:"岩石惑星",orbitAU:.75,radiusKm:4200,massEarth:.32,dayHours:30,tilt:18,inclination:0,node:0,phase:0,albedo:.2,color:12753528},{id:"current",name:"S-01 c",kind:"海洋惑星",orbitAU:3.6,radiusKm:7200,massEarth:1.4,dayHours:27,tilt:21,inclination:1,node:190,phase:235,albedo:.3,color:9418445},{id:"ochre",name:"S-01 d",kind:"ガス惑星",orbitAU:1.35,radiusKm:58e3,massEarth:105,dayHours:11.4,tilt:7,inclination:2,node:45,phase:55,albedo:.45,color:13942414},{id:"ice",name:"S-01 e",kind:"氷の惑星",orbitAU:7.2,radiusKm:24500,massEarth:15,dayHours:18,tilt:28,inclination:4,node:290,phase:310,albedo:.5,color:12311780}],z=Object.freeze(ce.map(i=>Object.freeze({...i,orbitKm:i.orbitAU*H,mu:i.massEarth*N,periodSeconds:q(i.orbitAU*H,B.mu+i.massEarth*N)}))),M=Object.freeze({name:"S-01 恒星系",region:"架空銀河・外縁域",epoch:Date.UTC(2026,9,16,8)/1e3,star:B,planets:z,shipOrbit:Object.freeze({radiusKm:13600,periodSeconds:q(13600,z[0].mu)})});function le({sunDirection:i=new n(64,-110,92),planetDirection:s,clock:b=()=>Date.now()/1e3}={}){const a=i.clone().normalize().negate(),o=new n(0,1,0).addScaledVector(a,-a.y).normalize(),t=new n().crossVectors(o,a).normalize(),u=(s?.clone()??a.clone()).normalize().negate().multiplyScalar(M.shipOrbit.radiusKm),K=o.clone().addScaledVector(u,-o.dot(u)/u.lengthSq()).normalize(),l={time:0,star:new n,observer:new n,planetPositions:z.map(()=>new n),spinAngles:z.map(()=>0)};function w(f,h,S){const c=z[f],g=_(h-M.epoch,c.periodSeconds)+c.phase*Math.PI/180;return S.copy(a).multiplyScalar(Math.cos(g)*c.orbitKm).addScaledVector(t,Math.sin(g)*c.orbitKm).applyAxisAngle(a,c.inclination*Math.PI/180).applyAxisAngle(o,c.node*Math.PI/180)}return{normal:o,radial:a,tangent:t,planetPosition:w,sample(f=b()){l.time=f;const h=f-M.epoch;return z.forEach((S,c)=>{w(c,f,l.planetPositions[c]),l.spinAngles[c]=_(h,S.dayHours*3600)}),l.observer.copy(u).applyAxisAngle(K,_(h,M.shipOrbit.periodSeconds)).add(l.planetPositions[0]),l}}}function de(i,s,b){const a=i,o=s,t=b;if(t>=a+o)return 1;if(t<=Math.abs(o-a))return o>=a?0:1-o*o/(a*a);const u=a*a*Math.acos(Math.max(-1,Math.min(1,(t*t+a*a-o*o)/(2*t*a))))+o*o*Math.acos(Math.max(-1,Math.min(1,(t*t+o*o-a*a)/(2*t*o))))-.5*Math.sqrt(Math.max(0,(-t+a+o)*(t+a-o)*(t-a+o)*(t+a+o)));return Math.max(0,Math.min(1,1-u/(Math.PI*a*a)))}const me=Object.freeze([{id:"current",label:"青灰の海洋惑星",description:"暗い海と岩の大陸、薄い雲。"},{id:"ochre",label:"A · 琥珀色のガス惑星",description:"黄土色と灰褐色の大気。緩い帯状の雲が流れる印象。"},{id:"rust",label:"B · 赤褐色の岩石惑星",description:"乾いた赤い地表と暗い盆地。大気と雲を控えめに。"},{id:"ice",label:"C · 淡い氷の惑星",description:"青白い氷原と暗い亀裂。冷たい薄い大気。"}]),C=i=>Math.max(0,me.findIndex(s=>s.id===i)),pe=Object.freeze({ochre:.5,current:1.1,ice:.35});function ue({variant:i="current",background:s=!1}={}){const b=new $(4200,96,64),a=new J({depthTest:!s,depthWrite:!s,uniforms:{pattern:{value:C(i)},lightDirection:{value:new n(64,-110,92).normalize()}},vertexShader:`
      varying vec3 vSurface;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main(){
        vSurface=position;
        vec4 world=modelMatrix*vec4(position,1.0);
        vWorld=world.xyz;vNormal=mat3(modelMatrix)*normal;
        gl_Position=projectionMatrix*viewMatrix*world;
        ${s?"gl_Position.z=gl_Position.w*.99999;":""}
      }`,fragmentShader:`
      uniform vec3 lightDirection;
      uniform float pattern;
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
        vec3 atmosphere=vec3(.055,.135,.20);
        if(pattern>.5&&pattern<1.5){
          float latitude=surface.y*26.0+(warp.x-.5)*3.6;
          float bands=.5+.5*sin(latitude+fbm(surface*12.0)*1.8);
          float wisps=fbm(surface*32.0+warp);
          color=mix(vec3(.105,.078,.049),vec3(.38,.30,.19),smoothstep(.1,.9,bands));
          color=mix(color,vec3(.44,.40,.32),wisps*.3);
          atmosphere=vec3(.16,.12,.07);
        }else if(pattern>1.5&&pattern<2.5){
          float terrain=fbm(surface*7.0+warp*1.6);
          color=mix(vec3(.052,.034,.027),vec3(.30,.135,.068),smoothstep(.28,.7,terrain));
          color*=.86+.28*fbm(surface*55.0);
          color=mix(color,vec3(.36,.27,.18),clouds*.10);
          atmosphere=vec3(.055,.025,.012);
        }else if(pattern>2.5){
          float ice=fbm(surface*10.0+warp*2.6);
          float cracks=1.0-smoothstep(.012,.055,abs(ice-.48));
          color=mix(vec3(.16,.23,.26),vec3(.43,.49,.50),smoothstep(.28,.68,ice));
          color=mix(color,vec3(.045,.09,.115),cracks*.65);
          color=mix(color,vec3(.48,.51,.52),clouds*.22);
          atmosphere=vec3(.07,.16,.21);
        }
        float sun=max(0.0,dot(normal,normalize(lightDirection)));
        color*=.008+sun*1.6;
        float rim=pow(1.0-max(0.0,dot(normal,normalize(cameraPosition-vWorld))),5.0);
        color+=atmosphere*rim*(.15+sun*.6);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});a.name="Distant blue-grey planet / stationary sunlight";const o=new Z(b,a);return o.name="Planet background",o.visible=!1,o.renderOrder=s?-8:1,s&&(o.frustumCulled=!1),{body:o,setVariant(t){a.uniforms.pattern.value=C(t)},show(t){o.visible=!!t,t&&o.position.fromArray(t)},dispose(){b.dispose(),a.dispose()}}}function he({light:i=null,ship:s=null,clock:b=()=>Date.now()/1e3,emphasis:a=!1}={}){const o=new n(0,1,0),t=new n(64,-110,92).normalize(),u=new n;i&&(i.getWorldPosition(t),i.target.getWorldPosition(u),t.sub(u).normalize());const K=i?i.position.distanceTo(i.target.position):1,l=new n().crossVectors(o,t);l.lengthSq()<1e-6&&l.set(0,0,1).cross(t),l.normalize();const w=new n().crossVectors(t,l).normalize(),f=35*Math.PI/180,h=t.clone().multiplyScalar(-Math.cos(f)).addScaledVector(l,Math.sin(f)*Math.SQRT1_2).addScaledVector(w,-Math.sin(f)*Math.SQRT1_2);l.crossVectors(h,o).normalize(),w.crossVectors(l,h).normalize();const S=h.clone().addScaledVector(l,.22).addScaledVector(w,.07).normalize(),c=le({sunDirection:t,planetDirection:S,clock:b}),g=new ee;g.name="S-01 / four physical planetary orbits";const E=new Uint8Array(256*4);for(let r=0;r<16;r++)for(let m=0;m<16;m++){const d=(r*16+m)*4,P=Math.hypot(m-7.5,r-7.5)/7.5;E[d]=E[d+1]=E[d+2]=255,E[d+3]=Math.round(Math.exp(-P*P*6)*255)}const R=new ae(E,16,16);R.needsUpdate=!0,R.magFilter=R.minFilter=oe;const y=M.planets.map(r=>{const m=ue({variant:r.id,background:!0}),d=new te(new ie({map:R,color:r.color,transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,blending:re}));d.name=`${r.name} / unresolved reflected light`,d.renderOrder=-7,d.frustumCulled=!1;const P=c.normal.clone().applyAxisAngle(c.radial,r.tilt*Math.PI/180);return g.add(m.body,d),{...m,spec:r,marker:d,spinAxis:P,direction:new n,distanceKm:0,angularRadius:0,displayAngularRadius:0}}),A=new n,k=new n,D=new n,x=new n,F=new se;let p=c.sample(),I=1;function V(){return p=c.sample(),x.copy(p.planetPositions[0]).sub(p.observer).normalize(),x}function Q(r,m=1e3){V(),A.copy(p.observer),s&&(s.root.getWorldPosition(k),A.addScaledVector(x.copy(r.position).sub(k),.001)),D.copy(A).negate().normalize(),I=1;const d=A.length(),P=Math.asin(M.star.radiusKm/d),T=13600,W=Math.tan(r.fov*Math.PI/360)/r.zoom;y.forEach((e,v)=>{x.copy(p.planetPositions[v]).sub(A),e.distanceKm=x.length(),e.direction.copy(x).normalize(),e.angularRadius=Math.asin(e.spec.radiusKm/e.distanceKm);const L=a?pe[e.spec.id]??0:0;e.displayAngularRadius=Math.max(e.angularRadius,L*Math.PI/360),e.body.position.copy(r.position).addScaledVector(e.direction,T),e.body.scale.setScalar(T*Math.sin(e.displayAngularRadius)/4200),e.body.quaternion.setFromAxisAngle(e.spinAxis,p.spinAngles[v]),e.body.material.uniforms.lightDirection.value.copy(p.planetPositions[v]).negate().normalize(),e.distanceKm<d&&(I*=de(P,e.angularRadius,e.direction.angleTo(D)));const O=m*Math.tan(e.displayAngularRadius)/W;e.marker.position.copy(e.body.position),e.marker.scale.setScalar(2*T*W/m*2);const U=e.body.material.uniforms.lightDirection.value.angleTo(x.copy(A).sub(p.planetPositions[v]).normalize()),X=(Math.sin(U)+(Math.PI-U)*Math.cos(U))/Math.PI,G=M.star.luminositySolar/e.spec.orbitAU**2*e.spec.albedo*X*(e.spec.radiusKm/e.distanceKm)**2,Y=-26.74-2.5*Math.log10(Math.max(1e-30,G));e.marker.material.opacity=j.clamp(10**(-.4*(Y+1))*.7,0,.9)*(1-j.smoothstep(O,.5,2)),e.marker.visible=O<2,e.body.visible=O>=.5});for(const e of y)y.some(v=>v!==e&&v.distanceKm<e.distanceKm&&e.direction.angleTo(v.direction)+e.angularRadius<v.angularRadius)&&(e.body.visible=!1,e.marker.visible=!1);i&&i.position.copy(i.target.position).addScaledVector(D,K)}return{root:g,body:y[0].body,entries:y,ephemeris:c,setEmphasis(r){a=!!r},get sunVisibility(){return I},getDirection(r){return r.copy(V())},getBodyDirection(r,m){return V(),m.copy(p.planetPositions[r]).sub(p.observer).normalize()},getViewDirection(r){return F.setFromUnitVectors(S,V()),r.copy(h).applyQuaternion(F)},follow:Q,dispose(){y.forEach(r=>{r.dispose(),r.marker.material.dispose()}),R.dispose(),g.removeFromParent()}}}export{H as A,me as E,M as a,he as b,ue as c};
