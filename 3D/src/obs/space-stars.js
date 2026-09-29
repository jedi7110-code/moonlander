import {BufferGeometry,Color,Float32BufferAttribute,Matrix3,Points,PointsMaterial,Vector3} from 'three';

export const SPACE_COLOR=0x010307;

// Store directions on one shell, then centre it on the active camera/VR eye.
// Camera translation cannot change the constellation; only its rotation can.
// The reference eye preserves the density and brightness of the existing view.
function distantSky(stars,{reference=[0,5,0],windows=null,matchPov=false}={}){
  const geometry=stars.geometry,positions=geometry.getAttribute('position'),weights=geometry.getAttribute('starSize');
  const radius=64,origin=new Vector3(...reference),direction=new Vector3(),sizes=[];
  for(let i=0;i<positions.count;i++){
    direction.fromBufferAttribute(positions,i).sub(origin);
    const scale=radius/direction.length();
    sizes.push((weights?.getX(i)??1)*scale);
    direction.multiplyScalar(scale);positions.setXYZ(i,direction.x,direction.y,direction.z);
  }
  positions.needsUpdate=true;geometry.setAttribute('starSize',new Float32BufferAttribute(sizes,1));
  stars.frustumCulled=false;stars.renderOrder=1;stars.material.depthWrite=false;
  stars.material.userData.cabinAlwaysPowered=true;stars.material.userData.castShadow=false;
  // Three r155 omits cameraPosition/viewMatrix for PointsMaterial. Upload the
  // active eye and rotation explicitly, including each separate VR eye.
  const eye={value:new Vector3()},cameraRotation={value:new Matrix3()},pixelRatio={value:1};
  stars.onBeforeRender=(renderer,_scene,camera)=>{
    eye.value.setFromMatrixPosition(camera.matrixWorld);
    cameraRotation.value.setFromMatrix4(camera.matrixWorld);
    stars.position.copy(eye.value);stars.parent?.worldToLocal(stars.position);
    stars.updateMatrixWorld(true);pixelRatio.value=renderer.getPixelRatio();
  };
  stars.material.onBeforeCompile=shader=>{
    shader.uniforms.starEye=eye;shader.uniforms.starCameraRotation=cameraRotation;shader.uniforms.starPixelRatio=pixelRatio;
    const openings=windows?.map(w=>`{
      float t = (${w.z.toFixed(6)} - eye.z) / ray.z;
      vec2 p = abs(eye.xy + ray.xy * t - vec2(${w.x.toFixed(6)}, ${w.y.toFixed(6)}));
      if (t > 0.0 && p.x < ${(w.width/2).toFixed(6)} && p.y < ${(w.height/2).toFixed(6)}
          && p.x + p.y < ${(w.width/2+w.height/2-w.cut).toFixed(6)}) throughWindow = true;
    }`).join('\n');
    const mask=windows?`
      vec3 eye = starEye;
      vec3 ray = starCameraRotation * mvPosition.xyz;
      bool throughWindow = false;
      if (abs(ray.z) > 0.00001) { ${openings} }
      if (!throughWindow) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    `:'';
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform vec3 starEye;
      uniform mat3 starCameraRotation;
      uniform float starPixelRatio;
      attribute float starSize;
      varying float starCoverage;
    `).replace('#include <project_vertex>',`#include <project_vertex>
      ${matchPov?`
      // OBS frames the cutaway with a distant, very narrow lens. Keep the
      // POV sky's screen density instead of magnifying an almost empty patch.
      // Apply one angular scale to the whole field, never camera translation.
      mvPosition.xy *= min(1.0, 1.428148 / projectionMatrix[1][1]);
      gl_Position = projectionMatrix * mvPosition;
      `:''}
      // The shell is only a direction carrier: opaque scenery is always nearer.
      gl_Position.z = gl_Position.w * 0.999999;
      ${mask}
    `).replace('#include <logdepthbuf_vertex>',`
      float footprint = gl_PointSize * starSize;
      starCoverage = min(1.0, pow(footprint / starPixelRatio, 2.0));
      gl_PointSize = clamp(footprint, starPixelRatio, 1.8 * starPixelRatio);
      #include <logdepthbuf_vertex>
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float starCoverage;')
      .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= starCoverage;');
  };
  stars.material.customProgramCacheKey=()=>`distant-sky-v6-${matchPov}-${JSON.stringify(windows)}`;
  return stars;
}

// Both sides use the POV window's catalog, density, colours, and point sizes.
// Rotate the rear field to face the opposite side without changing its look.
export function createSpaceStars({rear=false,windows=null}={}){
  let seed=73191;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const positions=[],colors=[],color=new Color();
  for(let i=0;i<1900;i++){
    const x=(random()-.5)*155,y=(random()-.5)*90+5,z=40+random()*35;
    positions.push(rear?-x:x,y,rear?-z:z);
    color.setHSL(.56+random()*.09,.08+random()*.23,.46+random()*.42);colors.push(...color.toArray());
  }
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3)).setAttribute('color',new Float32BufferAttribute(colors,3));
  const material=new PointsMaterial({name:rear?'Rear windows / distant stars':'POV / distant stars',size:.055,vertexColors:true,toneMapped:false});
  material.userData.cabinAlwaysPowered=true;material.userData.castShadow=false;
  const stars=new Points(geometry,material);stars.name=rear?'Rear windows / stars':'POV / stars';
  return distantSky(stars,{windows,matchPov:true});
}

export function createCutawayStars(){
  const positions=new Float32Array(420*3);
  for(let i=0;i<420;i++){
    positions[i*3]=Math.sin(i*162.2)*45;positions[i*3+1]=Math.sin(i*714.1)*26+5;positions[i*3+2]=-9-Math.abs(Math.sin(i))*10;
  }
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));
  const stars=new Points(geometry,new PointsMaterial({name:'Cutaway / distant stars',color:0x9bafb5,size:.028,transparent:true,opacity:.36}));
  stars.name='Cutaway / stars';return distantSky(stars,{reference:[0,5,60]});
}

export function createRearWindowStars(root){
  const windows=[];
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(!mesh.userData.spaceWindow)return;
    const centre=mesh.getWorldPosition(new Vector3());
    windows.push({...mesh.userData.spaceWindow,x:centre.x,y:centre.y,z:centre.z});
  });
  // Keep the existing cutaway background intact. Only rays passing through a
  // real window opening reach this field. Opaque cabin furniture still occludes
  // it through the normal depth buffer, including the pocket doors.
  return createSpaceStars({rear:true,windows});
}
