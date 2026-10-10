import{J as U,C as V,V as K,M as E,r as Z,S as j,a8 as q,G as J}from"./three-Cd8_WpuG.js";import{z as v,B as m,n as I,A as H,w as Q,e as ee}from"./lighting-DOoxJiDc.js";import{f as te}from"./grooming-RljRh_dm.js";const D=1,$=1.6,k=D+$,z=24,oe=a=>Math.max(0,Math.min(1,a)),_=a=>{const e=oe(a);return e*e*(3-2*e)},O=a=>{const e=Math.sin(a*127.1+37.7)*43758.5453;return e-Math.floor(e)},ae=a=>O(a)*.065;async function pe({draw:a,reveal:e,nextFrame:t=()=>new Promise(r=>requestAnimationFrame(r))}){a(),await t(),a(),e(),await t()}function ie(a,e,t=!1){if(e>=k)return 1;const r=ae(a),n=e-D-r;if(n<=0)return 0;if(t)return _(n/($-r));const s=.23+O(a+31)*.025,d=.4+O(a+79)*.065;return n<.15?.68*_(n/.025)*(1-_((n-.085)/.065)):n>=s&&n<s+.12?.82*_((n-s)/.025)*(1-_((n-s-.07)/.05)):_((n-d)/($-r-d))}const re=`
  uniform float cabinBootActive;
  varying vec3 vCabinBootWorld;
`,ne=`
  vec4 bootPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    bootPosition = instanceMatrix * bootPosition;
  #endif
  vCabinBootWorld = (modelMatrix * bootPosition).xyz;
`,se=`
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
      if (abs(p.x) > 1.3 || abs(p.z - ${v.sourceZ.toFixed(2)}) > 0.8) return 0.0;
      float row = clamp(floor((p.y - ${v.firstY.toFixed(2)}) / ${v.spacing.toFixed(2)} + 0.5), 0.0, ${(v.count-1).toFixed(1)});
      float lightY = ${v.firstY.toFixed(2)} + row * ${v.spacing.toFixed(2)} + (${v.sourceYOffset.toFixed(2)});
      vec3 left = vec3(-${v.sourceX.toFixed(2)}, lightY, ${v.sourceZ.toFixed(2)}) - p;
      vec3 right = vec3(${v.sourceX.toFixed(2)}, lightY, ${v.sourceZ.toFixed(2)}) - p;
      float leftFacing = max(0.0, dot(surfaceNormal, left / max(length(left), 0.001)));
      float rightFacing = max(0.0, dot(surfaceNormal, right / max(length(right), 0.001)));
      return cabinSoftPool(left / vec3(0.82, 0.62, 0.80)) * leftFacing
        + cabinSoftPool(right / vec3(0.82, 0.62, 0.80)) * rightFacing;
    }
    float cabinEVASpill(vec3 p, vec3 surfaceNormal) {
      // Three fixed overhead spots: evaluate only the closest suit's cone.
      // Masked to the upper deck so no light leaks through into the cabin below.
      if (p.x < 7.15 || p.x > 10.95 || p.y < ${m.floorY.toFixed(3)} || p.y > ${(m.floorY+m.sourceY).toFixed(3)}) return 0.0;
      float slot = clamp(floor((p.x - ${m.suitX[0].toFixed(2)}) / ${(m.suitX[1]-m.suitX[0]).toFixed(2)} + 0.5), 0.0, 2.0);
      vec3 source = vec3(${m.suitX[0].toFixed(2)} + slot * ${(m.suitX[1]-m.suitX[0]).toFixed(2)}, ${(m.floorY+m.sourceY).toFixed(3)}, ${m.sourceZ.toFixed(2)});
      vec3 delta = source - p;
      float distanceToLight = length(delta);
      vec3 toLight = delta / max(distanceToLight, 0.001);
      vec3 reverseAxis = normalize(vec3(0.0, ${(m.sourceY-m.targetY).toFixed(2)}, ${(m.sourceZ-m.targetZ).toFixed(2)}));
      float cone = smoothstep(${Math.cos(m.outerAngle*Math.PI/180).toFixed(6)}, ${Math.cos(m.innerAngle*Math.PI/180).toFixed(6)}, dot(toLight, reverseAxis));
      float fade = 1.0 - smoothstep(0.8, ${m.range.toFixed(2)}, distanceToLight);
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
      float shaft = (1.0 - smoothstep(0.38, 0.95, abs(p.x))) * (1.0 - smoothstep(0.35, 1.6, abs(p.z - ${(v.sourceZ-.06).toFixed(2)})));
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
      // Independent standby displays: small, surface-facing pools on each deck.
      vec3 medicalSource = vec3(clamp(p.x, 3.17, 4.33), clamp(p.y, 8.329, 8.979), -0.675);
      vec3 coffeeSource = vec3(clamp(p.x, 9.8235, 10.2765), clamp(p.y, 5.166, 5.438), -0.770);
      vec3 medicalOffset = vec3(max(abs(p.x - 3.75) - 0.58, 0.0), max(abs(p.y - 8.654) - 0.325, 0.0), p.z + 0.675);
      vec3 coffeeOffset = vec3(max(abs(p.x - 10.05) - 0.2265, 0.0), max(abs(p.y - 5.302) - 0.136, 0.0), p.z + 0.770);
      float medicalFacing = max(0.0, dot(surfaceNormal, normalize(medicalSource - p + vec3(0.0, 0.00001, 0.0))));
      float coffeeFacing = max(0.0, dot(surfaceNormal, normalize(coffeeSource - p + vec3(0.0, 0.00001, 0.0))));
      screens = max(screens, cabinSoftPool(medicalOffset / vec3(0.85, 0.85, 1.10)) * medicalFacing);
      screens = max(screens, cabinSoftPool(coffeeOffset / vec3(0.48, 0.48, 0.65)) * coffeeFacing);
      // Spill from the grow shelf reaches the near aisle floor, not just leaves.
      float growFloor = cabinSoftPool(vec3((p.x + 7.09) / 2.1, p.y / 0.30, (p.z - 0.75) / 2.0));
      growFloor *= max(0.0, surfaceNormal.y);
      return vec3(0.85, 0.58, 0.25) * emergency + vec3(0.16, 0.12, 0.075) * shaft + vec3(0.90, 0.80, 0.63) * cabinLadderSpill(p, surfaceNormal) + vec3(1.35, 1.18, 0.94) * cabinEVASpill(p, surfaceNormal) + vec3(0.028, 0.15, 0.055) * screens + vec3(0.35, 0.42, 0.24) * cabinGrowPower() + vec3(0.95, 1.08, 0.85) * growFloor;
    }
  #endif
`,ce=a=>`
  #define CABIN_SHADER_LIGHTS ${a}
  uniform float cabinShaderLightsOn;
  uniform vec3 cabinShaderLightPositions[CABIN_SHADER_LIGHTS];
  uniform vec3 cabinShaderLightColors[CABIN_SHADER_LIGHTS];
  uniform vec2 cabinShaderLightFalloff[CABIN_SHADER_LIGHTS];
`,le=`
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
          RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
        }
      }
    }
  #endif
  #include <lights_fragment_end>
`;class ve{constructor(e,{reducedMotion:t=!1,start:r=!0,waitForActivation:n=!1}={}){this.reducedMotion=t,this.time=0,this.done=!1,this.waiting=r&&n,this.materials=[],this.active={value:1},this.levels={value:new Float32Array(z)},this.roomLevels={value:new Float32Array(z)};const s=[],d=[];for(const o of e)o?.traverse(c=>{c.isPointLight&&c.userData.cabinShaderLight&&s.push(c),c.userData.bathroomLighting&&d.push(c.userData.bathroomLighting)});this.shaderLights={on:{value:1},positions:{value:s.map(o=>o.getWorldPosition(new K))},colors:{value:s.map(o=>new V().copy(o.color).multiplyScalar(o.intensity))},falloff:{value:s.map(o=>new U(o.distance,o.decay))}};const f=new Set;for(const o of e)o?.traverse(c=>{if(!(!c.isMesh||/toon outline$/.test(c.name)))for(const l of Array.isArray(c.material)?c.material:[c.material])l.userData.cabinAlwaysPowered||(l.isMeshStandardMaterial||l.isMeshToonMaterial||l.isMeshBasicMaterial)&&f.add(l)});for(const o of f){const c=o.onBeforeCompile,l=o.customProgramCacheKey,P=l.call(o),g=o.emissiveIntensity>1||/diffuser|light lens/i.test(o.name),S=!g&&!o.isMeshBasicMaterial,h=s.length&&!o.isMeshBasicMaterial,y=this,L=function(i,B){if(c.call(this,i,B),i.uniforms.cabinBootActive!==y.active&&!(!i.vertexShader.includes("#include <project_vertex>")||!i.fragmentShader.includes("#include <tonemapping_fragment>"))){if(i.uniforms.cabinBootActive=y.active,i.uniforms.cabinBootLevels=y.levels,i.uniforms.cabinBootRoomLevels=y.roomLevels,i.vertexShader=re+i.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
`+ne),h&&i.fragmentShader.includes("#include <lights_fragment_end>")){const{on:A,positions:C,colors:T,falloff:p}=y.shaderLights;Object.assign(i.uniforms,{cabinShaderLightsOn:A,cabinShaderLightPositions:C,cabinShaderLightColors:T,cabinShaderLightFalloff:p}),i.fragmentShader=ce(s.length)+i.fragmentShader.replace("#include <lights_fragment_end>",le)}i.fragmentShader=(g?`#define CABIN_BOOT_FIXTURE
`:"")+(S?`#define CABIN_PRACTICAL_SPILL
`:"")+se+i.fragmentShader.replace("#include <tonemapping_fragment>",`if (cabinBootActive > 0.5) gl_FragColor.rgb *= cabinBootPower();
          #ifdef CABIN_PRACTICAL_SPILL
            gl_FragColor.rgb += diffuseColor.rgb * cabinPracticalSpill(inverseTransformDirection(normal, viewMatrix));
          #endif
          #include <tonemapping_fragment>`),S&&te(i,d)}};o.onBeforeCompile=L,o.customProgramCacheKey=()=>P+"-cabin-boot-v11-"+Number(g)+"-"+Number(S)+"-"+(h?s.length:0)+"-"+d.length,o.needsUpdate=!0,this.materials.push({material:o,compile:c,key:l,wrapped:L})}r||this.update(k)}restart(e=this.reducedMotion,{waitForActivation:t=!1}={}){this.reducedMotion=e,this.time=0,this.done=!1,this.waiting=t,this.active.value=1,this.levels.value.fill(0),this.roomLevels.value.fill(0)}activate(){return!this.waiting||this.done?!1:(this.waiting=!1,this.time=D,this.update(0),!0)}update(e){if(!(this.done||this.waiting)){Number.isFinite(e)&&(this.time=Math.min(k,this.time+Math.max(0,e)));for(let t=0;t<z;t++){const r=ie(t,this.time,this.reducedMotion);this.levels.value[t]=r,this.roomLevels.value[t]=this.reducedMotion?r:.88*_((this.time-D)/$)+.12*r}this.time>=k&&(this.done=!0,this.active.value=0)}}dispose(){this.active.value=0,this.done=!0,this.waiting=!1;for(const{material:e,compile:t,key:r,wrapped:n}of this.materials)e.onBeforeCompile===n&&(e.onBeforeCompile=t,e.customProgramCacheKey=r,e.needsUpdate=!0);this.materials=[]}}const F={firstX:-11.8,spacing:1.52,count:16,width:1.34,height:.018,y:.105,inset:.045,wallFaceZ:I.deckFront-.098};function fe(a,e){a.onBeforeCompile=t=>{t.uniforms.povFootlights=e,t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vPovDeckPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vPovDeckPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vPovDeckPosition;
uniform float povFootlights;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        float slot = clamp(floor((vPovDeckPosition.x - (${F.firstX})) / ${F.spacing} + 0.5), 0.0, ${F.count-1}.0);
        float dx = abs(vPovDeckPosition.x - ((${F.firstX}) + slot * ${F.spacing}));
        float across = 1.0 - smoothstep(${F.width/2-.08}, ${F.width/2+.16}, dx);
        float away = 1.0 - smoothstep(0.0, 0.60, max(0.0, ${F.wallFaceZ.toFixed(3)} - vPovDeckPosition.z));
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.85, 0.56, 0.30) * across * away * away * povFootlights;
      `)},a.customProgramCacheKey=()=>"pov-recessed-footlight-wash-v1"}const G={grey:{panel:5264981,frame:6976369,grille:3489855},brown:{panel:3419431,frame:5327168,grille:2630943}};function me(a){const e=[],n=I.deckBack,s=I.deckFront,d=(12.88-.565)/8,f=.38;for(const c of[-1,1])for(let l=0;l<8;l++)for(const[P,g,S]of[[0,n,f],[1,f,s]])e.push({x:c*(.565+(l+.5)*d),z:(g+S)/2,w:d-.014,d:S-g-.014,grate:P===1&&l>0&&l%2===0});const o=a===2?n:H.wellEdge;return e.push({x:0,z:(o+s)/2,w:1.12,d:s-o-.014,grate:!1}),e}function de(){if(typeof document>"u")return null;const a=document.createElement("canvas");a.width=a.height=512;const e=a.getContext("2d");e.fillStyle="#d4d6d3",e.fillRect(0,0,512,512);let t=3817;const r=()=>(t=Math.imul(t,1664525)+1013904223>>>0,t/4294967296);for(let s=0;s<16e3;s++){const d=150+Math.floor(r()*90);e.fillStyle=`rgba(${d},${d},${d},.12)`,e.fillRect(r()*512,r()*512,1,1)}for(let s=0;s<40;s++){const d=r()*512,f=r()*512;e.strokeStyle="#ffffff10",e.lineWidth=.5,e.beginPath(),e.moveTo(d,f),e.lineTo(d+r()*5-2.5,f+r()*5-2.5),e.stroke()}const n=new Z(a);return n.colorSpace=j,n.wrapS=n.wrapT=q,n.anisotropy=4,n}function xe({tone:a="brown"}={}){const e=de(),t={},r={value:0};for(const[f,o,c]of[["panel",.82,.48],["frame",.66,.62],["grille",.77,.62]]){const l=new E({name:`POV metal deck / ${f}`,map:e,roughness:o,metalness:c,envMapIntensity:.38});l.userData.cabinKeepSurface=!0,t[f]=l,fe(l,r)}const n=new E({name:"POV metal deck / recessed backing",color:725267,roughness:1,metalness:0});n.userData.cabinKeepSurface=!0;function s(f){const o=G[f]??G.grey;for(const c of Object.keys(t))t[c].color.setHex(o[c])}s(a);function d(f,o,c){const l=new J;l.name=`Inset metal deck ${c}`;const{deckBack:P,deckFront:g}=I,S=g-P,h=(L,i,B,A,C,T,p=0,b=.04)=>{const x=ee(l,i,B,o+p-b/2,A,C,b,T);return x.name=L,x};for(const L of[-1,1])h("Deck structure",f.dark,L*6.73,(P+g)/2,12.37,S,-.09,.24);const y=c===2?P:H.wellEdge;h("Bridge structure",f.dark,0,(g+y)/2,1.12,g-y,-.09,.24),h("Deck front fascia",f.dark,0,g-.01,26.22,.2,-.025,.305);for(const L of me(c)){const{x:i,z:B,w:A,d:C,grate:T}=L;if(!T){h("Solid service plate",t.panel,i,B,A,C);continue}const p=1.08/3,b=1.32/3,x=.065/3,M=p+x*2,N=b+x*2;for(const Y of[-1,1]){const w=B+Y*C/4,R=C/2;for(const u of[-1,1])h("Grille surround",t.panel,i+u*(A+M)/4,w,(A-M)/2,R),h("Grille surround",t.panel,i,w+u*(R+N)/4,M,(R-N)/2),h("Recess frame",t.frame,i+u*(p+x)/2,w,x,N),h("Recess frame",t.frame,i,w+u*(b+x)/2,p,x);h("Recessed grille tray",n,i,w,p,b,-.072,.008);for(let u=0;u<=6;u++)h("Grille bearing bar",t.grille,i-p/2+u*p/6,w,.014,b,-.002,.022);for(let u=0;u<=4;u++)h("Grille cross tie",t.grille,i,w-b/2+u*b/4,p,.012,-.016,.016);for(const u of[-1,1])for(const W of[-1,1]){const X=Q(l,t.frame,i+u*(p+x)/2,o-.001,w+W*(b+x)/2,.006,.004,.006,6);X.name="Flush grille fastener"}}}return l}return{buildFloor:d,setTone:s,setFootlightsVisible:f=>{r.value=Number(f)}}}export{ve as C,F,xe as c,pe as r};
