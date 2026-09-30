import{M as H,p as W,S as K,ai as V,G as Z,z as j,C as q,V as J}from"./three-Ds_ff2Mx.js";import{I as k,ak as Q,a2 as ee,aI as y,aJ as d}from"./cabin-toon-BRYub9b5.js";import{q as te}from"./ship-7e1TfhiN.js";const P={firstX:-11.8,spacing:1.52,count:16,width:1.34,height:.018,y:.105,inset:.045,wallFaceZ:k.deckFront-.098};function oe(i,t){i.onBeforeCompile=o=>{o.uniforms.povFootlights=t,o.vertexShader=o.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vPovDeckPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vPovDeckPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`),o.fragmentShader=o.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vPovDeckPosition;
uniform float povFootlights;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        float slot = clamp(floor((vPovDeckPosition.x - (${P.firstX})) / ${P.spacing} + 0.5), 0.0, ${P.count-1}.0);
        float dx = abs(vPovDeckPosition.x - ((${P.firstX}) + slot * ${P.spacing}));
        float across = 1.0 - smoothstep(${P.width/2-.08}, ${P.width/2+.16}, dx);
        float away = 1.0 - smoothstep(0.0, 0.60, max(0.0, ${P.wallFaceZ.toFixed(3)} - vPovDeckPosition.z));
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.85, 0.56, 0.30) * across * away * away * povFootlights;
      `)},i.customProgramCacheKey=()=>"pov-recessed-footlight-wash-v1"}const G={grey:{panel:5264981,frame:6976369,grille:3489855},brown:{panel:3419431,frame:5327168,grille:2630943}};function ae(i){const t=[],a=k.deckBack,n=k.deckFront,f=(12.88-.565)/8,e=.38;for(const c of[-1,1])for(let h=0;h<8;h++)for(const[x,u,p]of[[0,a,e],[1,e,n]])t.push({x:c*(.565+(h+.5)*f),z:(u+p)/2,w:f-.014,d:p-u-.014,grate:x===1&&h%2===0});const s=i===2?a:.94;return t.push({x:0,z:(s+n)/2,w:1.12,d:n-s-.014,grate:!1}),t}function ie(){if(typeof document>"u")return null;const i=document.createElement("canvas");i.width=i.height=512;const t=i.getContext("2d");t.fillStyle="#d4d6d3",t.fillRect(0,0,512,512);let o=3817;const r=()=>(o=Math.imul(o,1664525)+1013904223>>>0,o/4294967296);for(let n=0;n<16e3;n++){const f=150+Math.floor(r()*90);t.fillStyle=`rgba(${f},${f},${f},.12)`,t.fillRect(r()*512,r()*512,1,1)}for(let n=0;n<40;n++){const f=r()*512,e=r()*512;t.strokeStyle="#ffffff10",t.lineWidth=.5,t.beginPath(),t.moveTo(f,e),t.lineTo(f+r()*5-2.5,e+r()*5-2.5),t.stroke()}const a=new W(i);return a.colorSpace=K,a.wrapS=a.wrapT=V,a.anisotropy=4,a}function Se({tone:i="brown"}={}){const t=ie(),o={},r={value:0};for(const[e,s,c]of[["panel",.82,.48],["frame",.66,.62],["grille",.77,.62]]){const h=new H({name:`POV metal deck / ${e}`,map:t,roughness:s,metalness:c,envMapIntensity:.38});h.userData.cabinKeepSurface=!0,o[e]=h,oe(h,r)}const a=new H({name:"POV metal deck / recessed backing",color:725267,roughness:1,metalness:0});a.userData.cabinKeepSurface=!0;function n(e){const s=G[e]??G.grey;for(const c of Object.keys(o))o[c].color.setHex(s[c])}n(i);function f(e,s,c){const h=new Z;h.name=`Inset metal deck ${c}`;const{deckBack:x,deckFront:u}=k,p=u-x,m=(l,b,B,F,C,_,L=0,w=.04)=>{const S=ee(h,b,B,s+L-w/2,F,C,w,_);return S.name=l,S};for(const l of[-1,1])m("Deck structure",e.dark,l*6.73,(x+u)/2,12.37,p,-.09,.24);const g=c===2?x:.94;m("Bridge structure",e.dark,0,(u+g)/2,1.12,u-g,-.09,.24),m("Deck front fascia",e.dark,0,u-.01,26.22,.2,-.025,.305);for(const l of ae(c)){const{x:b,z:B,w:F,d:C,grate:_}=l;if(!_){m("Solid service plate",o.panel,b,B,F,C);continue}const L=1.08/3,w=1.32/3,S=.065/3,$=L+S*2,N=w+S*2;for(const Y of[-1,1]){const A=B+Y*C/4,D=C/2;for(const v of[-1,1])m("Grille surround",o.panel,b+v*(F+$)/4,A,(F-$)/2,D),m("Grille surround",o.panel,b,A+v*(D+N)/4,$,(D-N)/2),m("Recess frame",o.frame,b+v*(L+S)/2,A,S,N),m("Recess frame",o.frame,b,A+v*(w+S)/2,L,S);m("Recessed grille tray",a,b,A,L,w,-.072,.008);for(let v=0;v<=6;v++)m("Grille bearing bar",o.grille,b-L/2+v*L/6,A,.014,w,-.002,.022);for(let v=0;v<=4;v++)m("Grille cross tie",o.grille,b,A-w/2+v*w/4,L,.012,-.016,.016);for(const v of[-1,1])for(const U of[-1,1]){const X=Q(h,o.frame,b+v*(L+S)/2,s-.001,A+U*(w+S)/2,.006,.004,.006,6);X.name="Flush grille fastener"}}}return h}return{buildFloor:f,setTone:n,setFootlightsVisible:e=>{r.value=Number(e)}}}const I='"Helvetica Neue", Helvetica, Arial, sans-serif',re=new Set(["TARAIRON","EVA","WC","H2O","UV","EC","pH","OK","ERG","A","B"]),ne=new Map([["MED SUPPLIES","Medical Supplies"],["NUTRIENT / RETURN","Nutrient Return"]]);function se(i){return ne.get(i)??i.replace(/[A-Za-z][A-Za-z0-9]*/g,t=>re.has(t)?t:t[0].toUpperCase()+t.slice(1).toLowerCase())}function ce(i,t,{light:o=!1}={}){const r=i.getContext("2d"),a=se(t).split(`
`),n=Math.min(i.width*.08,i.height*.24),f=i.width-n*2;let e=i.height*.82/(a.length*1.18);r.fontKerning="normal",r.letterSpacing="0px",r.textAlign="left",r.textBaseline="alphabetic";const s=()=>{r.font=`500 ${e}px ${I}`};s(),e*=Math.min(1,(f-1)/Math.max(...a.map(g=>r.measureText(g).width))),s();const c=a.map(g=>r.measureText(g)),h=Math.max(...c.map(g=>g.actualBoundingBoxAscent)),x=Math.max(...c.map(g=>g.actualBoundingBoxDescent)),u=e*1.18,p=h+x+u*(a.length-1),m=(i.height-p)/2;return r.fillStyle=o?"#eeeae2":"#222220",r.fillRect(0,0,i.width,i.height),a.forEach((g,l)=>{r.font=`${l>0&&t.startsWith("TARAIRON")?400:500} ${e}px ${I}`,r.fillStyle=o?l===0&&t.startsWith("TARAIRON")?"#cf3f2a":"#222220":"#f4f1e9",r.fillText(g,n,m+h+l*u)}),{text:a.join(`
`),font:I,weight:500,tracking:0,align:"left",fits:c.every(g=>g.width<=f+.01)&&m>=0&&m+p<=i.height}}async function ye(i){await Promise.all([document.fonts.load(`500 32px ${I}`),document.fonts.load(`400 32px ${I}`)]);const t=[],o=new Map,r=[];for(const a of i)a.traverse(n=>{if(!n.isMesh)return;const f=Array.isArray(n.material)?n.material:[n.material];if(f.some(e=>e.name.startsWith("Sign: ")&&e.map?.image)){t.push({mesh:n,source:n.material});for(const e of f){if(o.has(e)||!e.name.startsWith("Sign: ")||!e.map?.image)continue;const s=e.map.image,c=document.createElement("canvas");c.width=s.width,c.height=s.height;const h=s.getContext("2d").getImageData(0,0,1,1).data,x=(h[0]+h[1]+h[2])/3>128,u=ce(c,e.name.slice(6),{light:x}),p=new W(c);p.colorSpace=e.map.colorSpace,p.anisotropy=e.map.anisotropy;const m=e.clone();m.map=p,m.userData.signage=u,o.set(e,m),r.push({before:s,after:c,spec:u})}n.material=Array.isArray(n.material)?f.map(e=>o.get(e)??e):o.get(n.material)}});return{samples:r,dispose(){for(const{mesh:a,source:n}of t)a.material=n;for(const a of o.values())a.map.dispose(),a.dispose()}}}const z=1,R=1.6,M=z+R,E=24,le=i=>Math.max(0,Math.min(1,i)),T=i=>{const t=le(i);return t*t*(3-2*t)},O=i=>{const t=Math.sin(i*127.1+37.7)*43758.5453;return t-Math.floor(t)},fe=i=>O(i)*.065;async function Le({draw:i,reveal:t,nextFrame:o=()=>new Promise(r=>requestAnimationFrame(r))}){i(),await o(),i(),t(),await o()}function me(i,t,o=!1){if(t>=M)return 1;const r=fe(i),a=t-z-r;if(a<=0)return 0;if(o)return T(a/(R-r));const n=.23+O(i+31)*.025,f=.4+O(i+79)*.065;return a<.15?.68*T(a/.025)*(1-T((a-.085)/.065)):a>=n&&a<n+.12?.82*T((a-n)/.025)*(1-T((a-n-.07)/.05)):T((a-f)/(R-r-f))}const he=`
  uniform float cabinBootActive;
  varying vec3 vCabinBootWorld;
`,de=`
  vec4 bootPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    bootPosition = instanceMatrix * bootPosition;
  #endif
  vCabinBootWorld = (modelMatrix * bootPosition).xyz;
`,ue=`
  uniform float cabinBootActive;
  uniform float cabinBootLevels[24];
  uniform float cabinBootRoomLevels[24];
  varying vec3 vCabinBootWorld;
  float cabinGrowPower() {
    vec3 p = vCabinBootWorld;
    float row = clamp(floor((p.y - 0.78) / 0.62 + 0.5), 0.0, 2.0);
    float height = p.y - (0.78 + row * 0.62);
    return (1.0 - smoothstep(1.03, 1.42, abs(p.x + 7.09)))
      * (1.0 - smoothstep(0.24, 0.42, abs(height)))
      * (1.0 - smoothstep(0.36, 0.85, abs(p.z + 0.66)));
  }
  float cabinBootPower() {
    float column = clamp((vCabinBootWorld.x + 10.65) / 3.05, 0.0, 7.0);
    float deck = clamp(floor((vCabinBootWorld.y + 0.08) / 3.392), 0.0, 2.0);
    #ifdef CABIN_BOOT_FIXTURE
      return mix(0.002, 1.0, cabinBootLevels[int(deck * 8.0 + floor(column + 0.5))]);
    #else
      float left = floor(column);
      float a = cabinBootRoomLevels[int(deck * 8.0 + left)];
      float b = cabinBootRoomLevels[int(deck * 8.0 + min(left + 1.0, 7.0))];
      return max(cabinGrowPower(), mix(0.025, 1.0, mix(a, b, smoothstep(0.0, 1.0, fract(column)))));
    #endif
  }
  #ifdef CABIN_PRACTICAL_SPILL
    float cabinSoftPool(vec3 offset) {
      float falloff = max(0.0, 1.0 - dot(offset, offset));
      return falloff * falloff;
    }
    float cabinLadderSpill(vec3 p, vec3 surfaceNormal) {
      // Evaluate just the nearest pair, not 24 additional real-time lights.
      // Finite, rounded pools leave a dim interval between fixture heights.
      if (abs(p.x) > 1.3 || abs(p.z - ${y.sourceZ.toFixed(2)}) > 0.8) return 0.0;
      float row = clamp(floor((p.y - ${y.firstY.toFixed(2)}) / ${y.spacing.toFixed(2)} + 0.5), 0.0, ${(y.count-1).toFixed(1)});
      float lightY = ${y.firstY.toFixed(2)} + row * ${y.spacing.toFixed(2)} + (${y.sourceYOffset.toFixed(2)});
      vec3 left = vec3(-${y.sourceX.toFixed(2)}, lightY, ${y.sourceZ.toFixed(2)}) - p;
      vec3 right = vec3(${y.sourceX.toFixed(2)}, lightY, ${y.sourceZ.toFixed(2)}) - p;
      float leftFacing = max(0.0, dot(surfaceNormal, left / max(length(left), 0.001)));
      float rightFacing = max(0.0, dot(surfaceNormal, right / max(length(right), 0.001)));
      return cabinSoftPool(left / vec3(0.82, 0.62, 0.80)) * leftFacing
        + cabinSoftPool(right / vec3(0.82, 0.62, 0.80)) * rightFacing;
    }
    float cabinEVASpill(vec3 p, vec3 surfaceNormal) {
      // Three fixed overhead spots: evaluate only the closest suit's cone.
      // Masked to the upper deck so no light leaks through into the cabin below.
      if (p.x < 7.15 || p.x > 10.95 || p.y < ${d.floorY.toFixed(3)} || p.y > ${(d.floorY+d.sourceY).toFixed(3)}) return 0.0;
      float slot = clamp(floor((p.x - ${d.suitX[0].toFixed(2)}) / ${(d.suitX[1]-d.suitX[0]).toFixed(2)} + 0.5), 0.0, 2.0);
      vec3 source = vec3(${d.suitX[0].toFixed(2)} + slot * ${(d.suitX[1]-d.suitX[0]).toFixed(2)}, ${(d.floorY+d.sourceY).toFixed(3)}, ${d.sourceZ.toFixed(2)});
      vec3 delta = source - p;
      float distanceToLight = length(delta);
      vec3 toLight = delta / max(distanceToLight, 0.001);
      vec3 reverseAxis = normalize(vec3(0.0, ${(d.sourceY-d.targetY).toFixed(2)}, ${(d.sourceZ-d.targetZ).toFixed(2)}));
      float cone = smoothstep(${Math.cos(d.outerAngle*Math.PI/180).toFixed(6)}, ${Math.cos(d.innerAngle*Math.PI/180).toFixed(6)}, dot(toLight, reverseAxis));
      float fade = 1.0 - smoothstep(0.8, ${d.range.toFixed(2)}, distanceToLight);
      return cone * fade * fade * max(0.0, dot(surfaceNormal, toLight));
    }
    vec3 cabinPracticalSpill(vec3 surfaceNormal) {
      vec3 p = vCabinBootWorld;
      // The cutaway removes the near wall and its orange emergency fixtures.
      // Retain their soft pools on the INBOARD floor, not glowing front fascia.
      float deck = clamp(floor((p.y + 0.08) / 3.392), 0.0, 2.0);
      float height = p.y - deck * 3.392;
      float spacing = abs(mod(p.x + 1.4, 2.8) - 1.4);
      float emergency = cabinSoftPool(vec3(spacing / 1.65, height / 0.66, (p.z - 2.55) / 1.75));
      emergency *= smoothstep(0.7, 1.05, abs(p.x)) * (1.0 - smoothstep(12.6, 13.0, abs(p.x)));
      emergency *= 1.0 - smoothstep(2.52, 2.75, p.z);
      // The access shaft is on a separate, steady safety circuit.
      float shaft = (1.0 - smoothstep(0.38, 0.95, abs(p.x))) * (1.0 - smoothstep(0.35, 1.6, abs(p.z - 0.15)));
      shaft *= smoothstep(-0.08, 0.12, p.y) * (1.0 - smoothstep(13.1, 13.4, p.y));
      // Three console screens and the tall monitor stack immediately to their
      // right. Rounded falloff keeps the green glow off unrelated rooms.
      vec3 consoleOffset = vec3(max(abs(p.x + 8.67) - 2.22, 0.0), max(abs(p.y - 8.514) - 0.32, 0.0), p.z + 0.45);
      vec3 monitorOffset = vec3(max(abs(p.x + 4.57) - 0.55, 0.0), max(abs(p.y - 8.204) - 0.70, 0.0), p.z + 1.30);
      // A recessed screen cannot light a bezel whose front faces AWAY from it.
      // Keep only the cosine-weighted bounce on surfaces facing the glass.
      vec3 consoleSource = vec3(clamp(p.x, -10.8, -6.54), clamp(p.y, 8.209, 8.819), -0.45);
      vec3 monitorSource = vec3(clamp(p.x, -5.15, -3.99), clamp(p.y, 7.439, 8.969), -1.30);
      float consoleFacing = max(0.0, dot(surfaceNormal, normalize(consoleSource - p + vec3(0.0, 0.00001, 0.0))));
      float monitorFacing = max(0.0, dot(surfaceNormal, normalize(monitorSource - p + vec3(0.0, 0.00001, 0.0))));
      float screens = max(cabinSoftPool(consoleOffset / vec3(1.35, 1.25, 1.75)) * consoleFacing, cabinSoftPool(monitorOffset / vec3(1.15, 1.10, 1.75)) * monitorFacing);
      // Spill from the grow shelf reaches the near aisle floor, not just leaves.
      float growFloor = cabinSoftPool(vec3((p.x + 7.09) / 2.1, p.y / 0.30, (p.z - 0.75) / 2.0));
      growFloor *= max(0.0, surfaceNormal.y);
      return vec3(0.85, 0.58, 0.25) * emergency + vec3(0.16, 0.12, 0.075) * shaft + vec3(0.90, 0.80, 0.63) * cabinLadderSpill(p, surfaceNormal) + vec3(1.35, 1.18, 0.94) * cabinEVASpill(p, surfaceNormal) + vec3(0.028, 0.15, 0.055) * screens + vec3(0.35, 0.42, 0.24) * cabinGrowPower() + vec3(0.95, 1.08, 0.85) * growFloor;
    }
  #endif
`,ge=i=>`
  #define CABIN_SHADER_LIGHTS ${i}
  uniform float cabinShaderLightsOn;
  uniform vec3 cabinShaderLightPositions[CABIN_SHADER_LIGHTS];
  uniform vec3 cabinShaderLightColors[CABIN_SHADER_LIGHTS];
  uniform vec2 cabinShaderLightFalloff[CABIN_SHADER_LIGHTS];
`,pe=`
  #ifdef RE_Direct
    if (cabinShaderLightsOn > 0.5) {
      for (int i = 0; i < CABIN_SHADER_LIGHTS; i++) {
        vec3 toLight = cabinShaderLightPositions[i] - vCabinBootWorld;
        float lightDistance = length(toLight);
        // Both attenuation models reach exactly zero at the cutoff distance.
        if (lightDistance < cabinShaderLightFalloff[i].x) {
          directLight.direction = normalize((viewMatrix * vec4(toLight, 0.0)).xyz);
          directLight.color = cabinShaderLightColors[i] * getDistanceAttenuation(lightDistance, cabinShaderLightFalloff[i].x, cabinShaderLightFalloff[i].y);
          #ifdef LEGACY_LIGHTS
            directLight.color *= PI;
          #endif
          directLight.visible = true;
          RE_Direct(directLight, geometry, material, reflectedLight);
        }
      }
    }
  #endif
  #include <lights_fragment_end>
`;class we{constructor(t,{reducedMotion:o=!1,start:r=!0}={}){this.reducedMotion=o,this.time=0,this.done=!1,this.materials=[],this.active={value:1},this.levels={value:new Float32Array(E)},this.roomLevels={value:new Float32Array(E)};const a=[],n=[];for(const e of t)e?.traverse(s=>{s.isPointLight&&s.userData.cabinShaderLight&&a.push(s),s.userData.bathroomLighting&&n.push(s.userData.bathroomLighting)});this.shaderLights={on:{value:1},positions:{value:a.map(e=>e.getWorldPosition(new J))},colors:{value:a.map(e=>new q().copy(e.color).multiplyScalar(e.intensity))},falloff:{value:a.map(e=>new j(e.distance,e.decay))}};const f=new Set;for(const e of t)e?.traverse(s=>{if(!(!s.isMesh||/toon outline$/.test(s.name)))for(const c of Array.isArray(s.material)?s.material:[s.material])c.userData.cabinAlwaysPowered||(c.isMeshStandardMaterial||c.isMeshToonMaterial||c.isMeshBasicMaterial)&&f.add(c)});for(const e of f){const s=e.onBeforeCompile,c=e.customProgramCacheKey,h=c.call(e),x=e.emissiveIntensity>1||/diffuser|light lens/i.test(e.name),u=!x&&!e.isMeshBasicMaterial,p=a.length&&!e.isMeshBasicMaterial,m=this,g=function(l,b){if(s.call(this,l,b),!(!l.vertexShader.includes("#include <project_vertex>")||!l.fragmentShader.includes("#include <tonemapping_fragment>"))){if(l.uniforms.cabinBootActive=m.active,l.uniforms.cabinBootLevels=m.levels,l.uniforms.cabinBootRoomLevels=m.roomLevels,l.vertexShader=he+l.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
`+de),p&&l.fragmentShader.includes("#include <lights_fragment_end>")){const{on:B,positions:F,colors:C,falloff:_}=m.shaderLights;Object.assign(l.uniforms,{cabinShaderLightsOn:B,cabinShaderLightPositions:F,cabinShaderLightColors:C,cabinShaderLightFalloff:_}),l.fragmentShader=ge(a.length)+l.fragmentShader.replace("#include <lights_fragment_end>",pe)}l.fragmentShader=(x?`#define CABIN_BOOT_FIXTURE
`:"")+(u?`#define CABIN_PRACTICAL_SPILL
`:"")+ue+l.fragmentShader.replace("#include <tonemapping_fragment>",`if (cabinBootActive > 0.5) gl_FragColor.rgb *= cabinBootPower();
          #ifdef CABIN_PRACTICAL_SPILL
            gl_FragColor.rgb += diffuseColor.rgb * cabinPracticalSpill(inverseTransformDirection(normal, viewMatrix));
          #endif
          #include <tonemapping_fragment>`),u&&te(l,n)}};e.onBeforeCompile=g,e.customProgramCacheKey=()=>h+"-cabin-boot-v9-"+Number(x)+"-"+Number(u)+"-"+(p?a.length:0)+"-"+n.length,e.needsUpdate=!0,this.materials.push({material:e,compile:s,key:c,wrapped:g})}r||this.update(M)}restart(t=this.reducedMotion){this.reducedMotion=t,this.time=0,this.done=!1,this.active.value=1,this.levels.value.fill(0),this.roomLevels.value.fill(0)}update(t){if(!this.done){Number.isFinite(t)&&(this.time=Math.min(M,this.time+Math.max(0,t)));for(let o=0;o<E;o++){const r=me(o,this.time,this.reducedMotion);this.levels.value[o]=r,this.roomLevels.value[o]=this.reducedMotion?r:.88*T((this.time-z)/R)+.12*r}this.time>=M&&(this.done=!0,this.active.value=0)}}dispose(){this.active.value=0,this.done=!0;for(const{material:t,compile:o,key:r,wrapped:a}of this.materials)t.onBeforeCompile===a&&(t.onBeforeCompile=o,t.customProgramCacheKey=r,t.needsUpdate=!0);this.materials=[]}}export{we as C,P as F,ye as a,Se as c,Le as r};
