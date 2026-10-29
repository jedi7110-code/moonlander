import * as THREE from 'three';
import {createStarCatalog,skyHazeColor,starGlow,srgbByte,STAR_COUNT} from '../../public/assets/obs/exterior-star-catalog.js';

function skyTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const context=canvas.getContext('2d'),pixels=context.createImageData(canvas.width,canvas.height);
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const theta=(y+.5)/canvas.height*Math.PI,phi=(x+.5)/canvas.width*Math.PI*2;
    const color=skyHazeColor([-Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)]),index=(y*canvas.width+x)*4;
    for(let channel=0;channel<3;channel++)pixels.data[index+channel]=srgbByte(color[channel]);pixels.data[index+3]=255;
  }
  context.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;return texture;
}
function glowTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const context=canvas.getContext('2d'),pixels=context.createImageData(64,64);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const radius=Math.hypot((x+.5)/32-1,(y+.5)/32-1),index=(y*64+x)*4;
    pixels.data[index]=pixels.data[index+1]=pixels.data[index+2]=255;pixels.data[index+3]=Math.round(starGlow(radius)*255);
  }
  context.putImageData(pixels,0,0);return new THREE.CanvasTexture(canvas);
}

// Star directions are fixed in space. Keeping their sphere centred on the
// observer removes translation/dolly parallax without changing camera rotation.
export function createDistantStars({count=STAR_COUNT,radius=1200,seed=735}={}){
  const positions=[],colors=[],sizes=[];
  for(const star of createStarCatalog({count,seed})){
    positions.push(...star.p.map(value=>value*radius));colors.push(...star.color);sizes.push(star.size);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('starSize',new THREE.Float32BufferAttribute(sizes,1));
  const glow=glowTexture(),map=skyTexture();
  const material=new THREE.PointsMaterial({size:1,map:glow,vertexColors:true,sizeAttenuation:false,depthTest:false,depthWrite:false,toneMapped:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneFactor,
    blendEquationAlpha:THREE.AddEquation,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float starSize;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;','gl_PointSize = size * starSize;');
  };
  const field=new THREE.Points(geometry,material);field.name='Distant photographic stars';field.frustumCulled=false;field.renderOrder=-9;
  // Opaque blending writes RGB even at alpha zero. The zero alpha tags this
  // background for the cinema compositor, which preserves its photographic
  // star brightness instead of applying the ship's exposure/tone mapping.
  const hazeGeometry=new THREE.SphereGeometry(radius*1.08,48,24),hazeMaterial=new THREE.MeshBasicMaterial({map,color:map?0xffffff:0x030609,
    side:THREE.BackSide,depthTest:false,depthWrite:false,toneMapped:false,opacity:0,blending:THREE.NoBlending});
  const haze=new THREE.Mesh(hazeGeometry,hazeMaterial);haze.name='Distant blue-black stellar haze';haze.frustumCulled=false;haze.renderOrder=-10;
  return{field,haze,
    follow(camera){field.position.copy(camera.position);haze.position.copy(camera.position);},
    dispose(){field.removeFromParent();haze.removeFromParent();geometry.dispose();material.dispose();hazeGeometry.dispose();hazeMaterial.dispose();glow?.dispose();map?.dispose();}
  };
}
