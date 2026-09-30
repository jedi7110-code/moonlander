import{M as H,p as W,S as X,ai as V,G as Z,z as j,C as q,V as J}from"./three-Civ3LItn.js";import{J as k,am as Q,a4 as ee,aK as w,aL as u}from"./cabin-toon-CyXgux1W.js";import{q as te}from"./ship-Bd86bCKD.js";const P={firstX:-11.8,spacing:1.52,count:16,width:1.34,height:.018,y:.105,inset:.045,wallFaceZ:k.deckFront-.098};function oe(o,e){o.onBeforeCompile=t=>{t.uniforms.povFootlights=e,t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vPovDeckPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vPovDeckPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vPovDeckPosition;
uniform float povFootlights;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        float slot = clamp(floor((vPovDeckPosition.x - (${P.firstX})) / ${P.spacing} + 0.5), 0.0, ${P.count-1}.0);
        float dx = abs(vPovDeckPosition.x - ((${P.firstX}) + slot * ${P.spacing}));
        float across = 1.0 - smoothstep(${P.width/2-.08}, ${P.width/2+.16}, dx);
        float away = 1.0 - smoothstep(0.0, 0.60, max(0.0, ${P.wallFaceZ.toFixed(3)} - vPovDeckPosition.z));
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.85, 0.56, 0.30) * across * away * away * povFootlights;
      `)},o.customProgramCacheKey=()=>"pov-recessed-footlight-wash-v1"}const G={grey:{panel:5264981,frame:6976369,grille:3489855},brown:{panel:3419431,frame:5327168,grille:2630943}};function ae(o){const e=[],n=k.deckBack,r=k.deckFront,m=(12.88-.565)/8,s=.38;for(const c of[-1,1])for(let l=0;l<8;l++)for(const[S,g,p]of[[0,n,s],[1,s,r]])e.push({x:c*(.565+(l+.5)*m),z:(g+p)/2,w:m-.014,d:p-g-.014,grate:S===1&&l%2===0});const i=o===2?n:.94;return e.push({x:0,z:(i+r)/2,w:1.12,d:r-i-.014,grate:!1}),e}function ie(){if(typeof document>"u")return null;const o=document.createElement("canvas");o.width=o.height=512;const e=o.getContext("2d");e.fillStyle="#d4d6d3",e.fillRect(0,0,512,512);let t=3817;const a=()=>(t=Math.imul(t,1664525)+1013904223>>>0,t/4294967296);for(let r=0;r<16e3;r++){const m=150+Math.floor(a()*90);e.fillStyle=`rgba(${m},${m},${m},.12)`,e.fillRect(a()*512,a()*512,1,1)}for(let r=0;r<40;r++){const m=a()*512,s=a()*512;e.strokeStyle="#ffffff10",e.lineWidth=.5,e.beginPath(),e.moveTo(m,s),e.lineTo(m+a()*5-2.5,s+a()*5-2.5),e.stroke()}const n=new W(o);return n.colorSpace=X,n.wrapS=n.wrapT=V,n.anisotropy=4,n}function Se({tone:o="brown"}={}){const e=ie(),t={},a={value:0};for(const[s,i,c]of[["panel",.82,.48],["frame",.66,.62],["grille",.77,.62]]){const l=new H({name:`POV metal deck / ${s}`,map:e,roughness:i,metalness:c,envMapIntensity:.38});l.userData.cabinKeepSurface=!0,t[s]=l,oe(l,a)}const n=new H({name:"POV metal deck / recessed backing",color:725267,roughness:1,metalness:0});n.userData.cabinKeepSurface=!0;function r(s){const i=G[s]??G.grey;for(const c of Object.keys(t))t[c].color.setHex(i[c])}r(o);function m(s,i,c){const l=new Z;l.name=`Inset metal deck ${c}`;const{deckBack:S,deckFront:g}=k,p=g-S,h=(x,f,B,F,C,_,b=0,L=.04)=>{const y=ee(l,f,B,i+b-L/2,F,C,L,_);return y.name=x,y};for(const x of[-1,1])h("Deck structure",s.dark,x*6.73,(S+g)/2,12.37,p,-.09,.24);const d=c===2?S:.94;h("Bridge structure",s.dark,0,(g+d)/2,1.12,g-d,-.09,.24),h("Deck front fascia",s.dark,0,g-.01,26.22,.2,-.025,.305);for(const x of ae(c)){const{x:f,z:B,w:F,d:C,grate:_}=x;if(!_){h("Solid service plate",t.panel,f,B,F,C);continue}const b=1.08/3,L=1.32/3,y=.065/3,N=b+y*2,D=L+y*2;for(const Y of[-1,1]){const A=B+Y*C/4,E=C/2;for(const v of[-1,1])h("Grille surround",t.panel,f+v*(F+N)/4,A,(F-N)/2,E),h("Grille surround",t.panel,f,A+v*(E+D)/4,N,(E-D)/2),h("Recess frame",t.frame,f+v*(b+y)/2,A,y,D),h("Recess frame",t.frame,f,A+v*(L+y)/2,b,y);h("Recessed grille tray",n,f,A,b,L,-.072,.008);for(let v=0;v<=6;v++)h("Grille bearing bar",t.grille,f-b/2+v*b/6,A,.014,L,-.002,.022);for(let v=0;v<=4;v++)h("Grille cross tie",t.grille,f,A-L/2+v*L/4,b,.012,-.016,.016);for(const v of[-1,1])for(const U of[-1,1]){const K=Q(l,t.frame,f+v*(b+y)/2,i-.001,A+U*(L+y)/2,.006,.004,.006,6);K.name="Flush grille fastener"}}}return l}return{buildFloor:m,setTone:r,setFootlightsVisible:s=>{a.value=Number(s)}}}const M='"Helvetica Neue", Helvetica, Arial, sans-serif',ne=new Set(["TARAIRON","EVA","WC","H2O","UV","EC","pH","OK","ERG","A","B"]),re=new Map([["MED SUPPLIES","Medical Supplies"],["NUTRIENT / RETURN","Nutrient Return"]]);function se(o){return re.get(o)??o.replace(/[A-Za-z][A-Za-z0-9]*/g,e=>ne.has(e)?e:e[0].toUpperCase()+e.slice(1).toLowerCase())}function ce(o,e,{light:t=!1}={}){const a=o.getContext("2d"),n=se(e).split(`
`),r=Math.min(o.width*.08,o.height*.24),m=o.width-r*2;let s=o.height*.82/(n.length*1.18);a.fontKerning="normal",a.letterSpacing="0px",a.textAlign="left",a.textBaseline="alphabetic";const i=()=>{a.font=`500 ${s}px ${M}`};i(),s*=Math.min(1,(m-1)/Math.max(...n.map(d=>a.measureText(d).width))),i();const c=n.map(d=>a.measureText(d)),l=Math.max(...c.map(d=>d.actualBoundingBoxAscent)),S=Math.max(...c.map(d=>d.actualBoundingBoxDescent)),g=s*1.18,p=l+S+g*(n.length-1),h=(o.height-p)/2;return a.fillStyle=t?"#eeeae2":"#222220",a.fillRect(0,0,o.width,o.height),n.forEach((d,x)=>{a.font=`${x>0&&e.startsWith("TARAIRON")?400:500} ${s}px ${M}`,a.fillStyle=t?x===0&&e.startsWith("TARAIRON")?"#cf3f2a":"#222220":"#f4f1e9",a.fillText(d,r,h+l+x*g)}),{text:n.join(`
`),font:M,weight:500,tracking:0,align:"left",fits:c.every(d=>d.width<=m+.01)&&h>=0&&h+p<=o.height}}async function ye(o){await Promise.all([document.fonts.load(`500 32px ${M}`),document.fonts.load(`400 32px ${M}`)]);const e=[],t=new Map,a=[];for(const n of o)n.traverse(r=>{if(!r.isMesh)return;const m=Array.isArray(r.material)?r.material:[r.material];if(m.some(s=>s.name.startsWith("Sign: ")&&s.map?.image)){e.push({mesh:r,source:r.material});for(const s of m){if(t.has(s)||!s.name.startsWith("Sign: ")||!s.map?.image)continue;const i=s.map.image,c=document.createElement("canvas");c.width=i.width,c.height=i.height;const l=i.getContext("2d").getImageData(0,0,1,1).data,S=(l[0]+l[1]+l[2])/3>128,g=ce(c,s.name.slice(6),{light:S}),p=new W(c);p.colorSpace=s.map.colorSpace,p.anisotropy=s.map.anisotropy;const h=s.clone();h.map=p,h.userData.signage=g,t.set(s,h),a.push({before:i,after:c,spec:g})}r.material=Array.isArray(r.material)?m.map(s=>t.get(s)??s):t.get(r.material)}});return{samples:a,dispose(){for(const{mesh:n,source:r}of e)n.material=r;for(const n of t.values())n.map.dispose(),n.dispose()}}}const R=1,$=1.6,I=R+$,O=24,le=o=>Math.max(0,Math.min(1,o)),T=o=>{const e=le(o);return e*e*(3-2*e)},z=o=>{const e=Math.sin(o*127.1+37.7)*43758.5453;return e-Math.floor(e)},fe=o=>z(o)*.065;async function we({draw:o,reveal:e,nextFrame:t=()=>new Promise(a=>requestAnimationFrame(a))}){o(),await t(),o(),e(),await t()}function me(o,e,t=!1){if(e>=I)return 1;const a=fe(o),n=e-R-a;if(n<=0)return 0;if(t)return T(n/($-a));const r=.23+z(o+31)*.025,m=.4+z(o+79)*.065;return n<.15?.68*T(n/.025)*(1-T((n-.085)/.065)):n>=r&&n<r+.12?.82*T((n-r)/.025)*(1-T((n-r-.07)/.05)):T((n-m)/($-a-m))}const he=`
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
      if (abs(p.x) > 1.3 || abs(p.z - ${w.sourceZ.toFixed(2)}) > 0.8) return 0.0;
      float row = clamp(floor((p.y - ${w.firstY.toFixed(2)}) / ${w.spacing.toFixed(2)} + 0.5), 0.0, ${(w.count-1).toFixed(1)});
      float lightY = ${w.firstY.toFixed(2)} + row * ${w.spacing.toFixed(2)} + (${w.sourceYOffset.toFixed(2)});
      vec3 left = vec3(-${w.sourceX.toFixed(2)}, lightY, ${w.sourceZ.toFixed(2)}) - p;
      vec3 right = vec3(${w.sourceX.toFixed(2)}, lightY, ${w.sourceZ.toFixed(2)}) - p;
      float leftFacing = max(0.0, dot(surfaceNormal, left / max(length(left), 0.001)));
      float rightFacing = max(0.0, dot(surfaceNormal, right / max(length(right), 0.001)));
      return cabinSoftPool(left / vec3(0.82, 0.62, 0.80)) * leftFacing
        + cabinSoftPool(right / vec3(0.82, 0.62, 0.80)) * rightFacing;
    }
    float cabinEVASpill(vec3 p, vec3 surfaceNormal) {
      // Three fixed overhead spots: evaluate only the closest suit's cone.
      // Masked to the upper deck so no light leaks through into the cabin below.
      if (p.x < 7.15 || p.x > 10.95 || p.y < ${u.floorY.toFixed(3)} || p.y > ${(u.floorY+u.sourceY).toFixed(3)}) return 0.0;
      float slot = clamp(floor((p.x - ${u.suitX[0].toFixed(2)}) / ${(u.suitX[1]-u.suitX[0]).toFixed(2)} + 0.5), 0.0, 2.0);
      vec3 source = vec3(${u.suitX[0].toFixed(2)} + slot * ${(u.suitX[1]-u.suitX[0]).toFixed(2)}, ${(u.floorY+u.sourceY).toFixed(3)}, ${u.sourceZ.toFixed(2)});
      vec3 delta = source - p;
      float distanceToLight = length(delta);
      vec3 toLight = delta / max(distanceToLight, 0.001);
      vec3 reverseAxis = normalize(vec3(0.0, ${(u.sourceY-u.targetY).toFixed(2)}, ${(u.sourceZ-u.targetZ).toFixed(2)}));
      float cone = smoothstep(${Math.cos(u.outerAngle*Math.PI/180).toFixed(6)}, ${Math.cos(u.innerAngle*Math.PI/180).toFixed(6)}, dot(toLight, reverseAxis));
      float fade = 1.0 - smoothstep(0.8, ${u.range.toFixed(2)}, distanceToLight);
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
`,ge=o=>`
  #define CABIN_SHADER_LIGHTS ${o}
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
`;class Le{constructor(e,{reducedMotion:t=!1,start:a=!0,waitForActivation:n=!1}={}){this.reducedMotion=t,this.time=0,this.done=!1,this.waiting=a&&n,this.materials=[],this.active={value:1},this.levels={value:new Float32Array(O)},this.roomLevels={value:new Float32Array(O)};const r=[],m=[];for(const i of e)i?.traverse(c=>{c.isPointLight&&c.userData.cabinShaderLight&&r.push(c),c.userData.bathroomLighting&&m.push(c.userData.bathroomLighting)});this.shaderLights={on:{value:1},positions:{value:r.map(i=>i.getWorldPosition(new J))},colors:{value:r.map(i=>new q().copy(i.color).multiplyScalar(i.intensity))},falloff:{value:r.map(i=>new j(i.distance,i.decay))}};const s=new Set;for(const i of e)i?.traverse(c=>{if(!(!c.isMesh||/toon outline$/.test(c.name)))for(const l of Array.isArray(c.material)?c.material:[c.material])l.userData.cabinAlwaysPowered||(l.isMeshStandardMaterial||l.isMeshToonMaterial||l.isMeshBasicMaterial)&&s.add(l)});for(const i of s){const c=i.onBeforeCompile,l=i.customProgramCacheKey,S=l.call(i),g=i.emissiveIntensity>1||/diffuser|light lens/i.test(i.name),p=!g&&!i.isMeshBasicMaterial,h=r.length&&!i.isMeshBasicMaterial,d=this,x=function(f,B){if(c.call(this,f,B),f.uniforms.cabinBootActive!==d.active&&!(!f.vertexShader.includes("#include <project_vertex>")||!f.fragmentShader.includes("#include <tonemapping_fragment>"))){if(f.uniforms.cabinBootActive=d.active,f.uniforms.cabinBootLevels=d.levels,f.uniforms.cabinBootRoomLevels=d.roomLevels,f.vertexShader=he+f.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
`+de),h&&f.fragmentShader.includes("#include <lights_fragment_end>")){const{on:F,positions:C,colors:_,falloff:b}=d.shaderLights;Object.assign(f.uniforms,{cabinShaderLightsOn:F,cabinShaderLightPositions:C,cabinShaderLightColors:_,cabinShaderLightFalloff:b}),f.fragmentShader=ge(r.length)+f.fragmentShader.replace("#include <lights_fragment_end>",pe)}f.fragmentShader=(g?`#define CABIN_BOOT_FIXTURE
`:"")+(p?`#define CABIN_PRACTICAL_SPILL
`:"")+ue+f.fragmentShader.replace("#include <tonemapping_fragment>",`if (cabinBootActive > 0.5) gl_FragColor.rgb *= cabinBootPower();
          #ifdef CABIN_PRACTICAL_SPILL
            gl_FragColor.rgb += diffuseColor.rgb * cabinPracticalSpill(inverseTransformDirection(normal, viewMatrix));
          #endif
          #include <tonemapping_fragment>`),p&&te(f,m)}};i.onBeforeCompile=x,i.customProgramCacheKey=()=>S+"-cabin-boot-v10-"+Number(g)+"-"+Number(p)+"-"+(h?r.length:0)+"-"+m.length,i.needsUpdate=!0,this.materials.push({material:i,compile:c,key:l,wrapped:x})}a||this.update(I)}restart(e=this.reducedMotion,{waitForActivation:t=!1}={}){this.reducedMotion=e,this.time=0,this.done=!1,this.waiting=t,this.active.value=1,this.levels.value.fill(0),this.roomLevels.value.fill(0)}activate(){return!this.waiting||this.done?!1:(this.waiting=!1,this.time=R,this.update(0),!0)}update(e){if(!(this.done||this.waiting)){Number.isFinite(e)&&(this.time=Math.min(I,this.time+Math.max(0,e)));for(let t=0;t<O;t++){const a=me(t,this.time,this.reducedMotion);this.levels.value[t]=a,this.roomLevels.value[t]=this.reducedMotion?a:.88*T((this.time-R)/$)+.12*a}this.time>=I&&(this.done=!0,this.active.value=0)}}dispose(){this.active.value=0,this.done=!0,this.waiting=!1;for(const{material:e,compile:t,key:a,wrapped:n}of this.materials)e.onBeforeCompile===n&&(e.onBeforeCompile=t,e.customProgramCacheKey=a,e.needsUpdate=!0);this.materials=[]}}export{Le as C,P as F,ye as a,Se as c,we as r};
