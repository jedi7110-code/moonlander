import {CanvasTexture,SRGBColorSpace} from 'three';
import {SIGN_FONT} from './cabin-signage.js';
import {ACCESS_LADDER} from './layout.js';

// Paint the actual deck surfaces, including their seams and recessed grilles.
// No floating sign plane: the existing floor geometry receives the stencil.
export function paintFloorLevel(root,text,floorY){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=480;
  const ctx=canvas.getContext('2d');
  ctx.font=`700 315px ${SIGN_FONT}`;
  const size=315*Math.min(1,1440/ctx.measureText(text).width);
  ctx.font=`700 ${size}px ${SIGN_FONT}`;ctx.textAlign='center';ctx.textBaseline='alphabetic';
  const metrics=ctx.measureText(text);
  const ascent=metrics.actualBoundingBoxAscent??size*.72,descent=metrics.actualBoundingBoxDescent??0;
  ctx.fillStyle='#d9d6c7';ctx.fillText(text,768,240+(ascent-descent)/2);
  // Stable chipped paint and shoe scuffs reveal the real metal beneath it.
  // Each deck has its own wear, without changing on reload.
  let seed=Array.from(text).reduce((value,char)=>Math.imul(value,31)+char.charCodeAt(0),3817)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  ctx.globalCompositeOperation='destination-out';
  ctx.fillStyle='#000';
  for(let i=0;i<3600;i++){
    const x=random()*1536,y=90+random()*310,w=1+random()*8,h=1+random()*6;
    ctx.globalAlpha=.45+random()*.55;
    ctx.save();ctx.translate(x,y);ctx.rotate(random()*Math.PI*2);
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,-h*.3);
    ctx.lineTo(w*.75,h);ctx.lineTo(-w*.2,h*.7);ctx.closePath();ctx.fill();ctx.restore();
  }
  // Foot traffic crosses the landing in every direction, not in parallel bands.
  for(let i=0;i<150;i++){
    const x=70+random()*1396,y=135+random()*220;
    const length=18+random()*85,thickness=2+random()*7;
    ctx.globalAlpha=.35+random()*.65;
    ctx.save();ctx.translate(x,y);ctx.rotate(random()*Math.PI*2);
    ctx.beginPath();ctx.moveTo(-length*.5,0);ctx.lineTo(length*.5,-2-random()*5);
    ctx.lineTo(length*.3,thickness);ctx.lineTo(-length*.5-3,thickness*.6);ctx.closePath();ctx.fill();ctx.restore();
  }
  // Larger irregular flakes break up areas repeatedly crossed by boots.
  for(let i=0;i<42;i++){
    const x=70+random()*1396,y=135+random()*220,w=10+random()*24,h=4+random()*12;
    ctx.globalAlpha=.65+random()*.35;
    ctx.save();ctx.translate(x,y);ctx.rotate(random()*Math.PI*2);
    ctx.beginPath();ctx.moveTo(-w*.5,0);ctx.lineTo(-w*.15,-h*.5);
    ctx.lineTo(w*.2,-h*.35);ctx.lineTo(w*.5,h*.15);
    ctx.lineTo(w*.05,h*.5);ctx.lineTo(-w*.4,h*.3);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
  texture.name=`Floor paint / ${text}`;
  const painted=new Map();
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const paint=source=>{
      if(painted.has(source))return painted.get(source);
      if(!source.isMeshStandardMaterial)return source;
      const material=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey.call(source);
      material.color=source.color;
      // Keep ownership visible to ObservationView's texture disposal pass.
      material.floorLevelMap=texture;
      material.name=`Floor paint / ${text} / ${source.name||'deck'}`;
      material.userData={...source.userData,cabinKeepSurface:true,floorLevel:text};
      material.onBeforeCompile=function(shader,renderer){
        compile.call(this,shader,renderer);
        shader.uniforms.floorLevelMap={value:texture};shader.uniforms.floorLevelY={value:floorY};
        shader.vertexShader='varying vec3 vFloorLevelWorld;\nvarying vec3 vFloorLevelNormal;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
          vec4 floorLevelPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            floorLevelPosition = instanceMatrix * floorLevelPosition;
          #endif
          vFloorLevelWorld = (modelMatrix * floorLevelPosition).xyz;
          vFloorLevelNormal = inverseTransformDirection(transformedNormal, viewMatrix);`);
        shader.fragmentShader='uniform sampler2D floorLevelMap;\nuniform float floorLevelY;\nvarying vec3 vFloorLevelWorld;\nvarying vec3 vFloorLevelNormal;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          // Center the lettering between the front panel seams at z=.38 and 2.55.
          // It reads from the forward aisle toward the ladder.
          vec2 floorLevelUV = vec2(vFloorLevelWorld.x / 4.50 + 0.5, (1.465 - vFloorLevelWorld.z) / 1.50 + 0.5);
          float floorSurfaceMask = step(0.9, vFloorLevelNormal.y)
            * (1.0 - smoothstep(0.003, 0.012, abs(vFloorLevelWorld.y - floorLevelY)));
          float floorLevelMask = step(0.0, floorLevelUV.x) * step(floorLevelUV.x, 1.0)
            * step(0.0, floorLevelUV.y) * step(floorLevelUV.y, 1.0)
            * floorSurfaceMask;
          vec4 floorLevelPaint = texture2D(floorLevelMap, floorLevelUV);
          float floorLevelCoverage = floorLevelPaint.a * floorLevelMask;
          diffuseColor.rgb = mix(diffuseColor.rgb, floorLevelPaint.rgb, floorLevelCoverage);
          // A flush U-shaped warning stencil: left, right and front of the
          // well, open at the rear wall. It paints only the existing top faces.
          vec2 wellPaintPoint = vFloorLevelWorld.xz;
          float wellPaintSide = (1.0 - smoothstep(0.067, 0.075, abs(abs(wellPaintPoint.x) - 0.64)))
            * step(${ACCESS_LADDER.rearPanelZ.toFixed(3)}, wellPaintPoint.y)
            * step(wellPaintPoint.y, ${(ACCESS_LADDER.wellEdge+.155).toFixed(3)});
          float wellPaintFront = (1.0 - smoothstep(0.067, 0.075, abs(wellPaintPoint.y - ${(ACCESS_LADDER.wellEdge+.08).toFixed(3)})))
            * (1.0 - smoothstep(0.707, 0.715, abs(wellPaintPoint.x)));
          float wellPaintMask = max(wellPaintSide, wellPaintFront) * floorSurfaceMask;
          float wellPaintStripe = step(0.5, fract((wellPaintPoint.x + wellPaintPoint.y) / 0.26));
          vec3 wellPaintColor = mix(vec3(0.012, 0.016, 0.012), vec3(0.75, 0.58, 0.04), wellPaintStripe);
          diffuseColor.rgb = mix(diffuseColor.rgb, wellPaintColor, wellPaintMask);
          floorLevelCoverage = max(floorLevelCoverage, wellPaintMask);
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.95, floorLevelCoverage);`)
          .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 0.02, floorLevelCoverage);`);
      };
      material.customProgramCacheKey=()=>key+'-floor-level-v5';
      painted.set(source,material);return material;
    };
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(paint):paint(mesh.material);
  });
}
