import {BackSide,BoxGeometry,BufferGeometry,Color,Float32BufferAttribute,Matrix3,Mesh,MeshBasicMaterial,Points,PointsMaterial,Vector3} from 'three';

export const SPACE_COLOR=0x010307;

// A finite card at z=90 exposes its edge when looking along the aisle. This
// closed sky box follows the actual render eye, including mirrors/XR. Its
// constant colour has no cube-map seams; 12 triangles cover every direction.
export function createSpaceBackdrop(){
  const material=new MeshBasicMaterial({name:'POV / deep space',color:SPACE_COLOR,side:BackSide,toneMapped:false,depthWrite:false});
  material.userData.cabinAlwaysPowered=true;material.userData.castShadow=false;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n gl_Position.z = gl_Position.w * 0.999999;');
  };
  material.customProgramCacheKey=()=> 'infinite-space-backdrop-v1';
  const sky=new Mesh(new BoxGeometry(192,192,192),material),eye=new Vector3();
  // Draw after the opaque cabin, before stars: the depth buffer rejects the
  // wall/furniture pixels, so only actual openings need the sky colour.
  sky.name='POV / seamless space backdrop';sky.renderOrder=.5;sky.frustumCulled=false;
  sky.onBeforeRender=(_renderer,_scene,camera)=>{
    eye.setFromMatrixPosition(camera.matrixWorld);sky.position.copy(eye);sky.parent?.worldToLocal(sky.position);sky.updateMatrixWorld(true);
  };
  return sky;
}

// The corridor openings form one regular 5-by-3 grid on a single plane. Test
// only the nearest opening, not all 15 rectangles for every star. Irregular
// rear-room windows keep their original individual masks.
function windowIntersections(windows,optimize=true){
  if(!windows?.length)return '';
  const first=windows[0],same=(a,b)=>Math.abs(a-b)<1e-6;
  const xs=[...new Set(windows.map(w=>w.x))].sort((a,b)=>a-b),ys=[...new Set(windows.map(w=>w.y))].sort((a,b)=>a-b);
  const dx=xs.length>1?xs[1]-xs[0]:1,dy=ys.length>1?ys[1]-ys[0]:1;
  const regular=windows.length===xs.length*ys.length&&new Set(windows.map(w=>`${w.x},${w.y}`)).size===windows.length
    &&windows.every(w=>['z','width','height','cut'].every(key=>same(w[key],first[key])))
    &&xs.every((x,i)=>same(x,xs[0]+i*dx))&&ys.every((y,i)=>same(y,ys[0]+i*dy));
  if(regular&&optimize){
    const f=n=>n.toFixed(6);
    return `
      float t = (${f(first.z)} - eye.z) / ray.z;
      vec2 gridHit = eye.xy + ray.xy * t - vec2(${f(xs[0])}, ${f(ys[0])});
      vec2 cell = clamp(floor(gridHit / vec2(${f(dx)}, ${f(dy)}) + 0.5), vec2(0.0), vec2(${f(xs.length-1)}, ${f(ys.length-1)}));
      vec2 p = abs(gridHit - cell * vec2(${f(dx)}, ${f(dy)}));
      if (t > 0.0 && p.x < ${f(first.width/2)} && p.y < ${f(first.height/2)}
          && p.x + p.y < ${f(first.width/2+first.height/2-first.cut)}) throughWindow = true;
    `;
  }
  return windows.map(w=>`{
      float t = (${w.z.toFixed(6)} - eye.z) / ray.z;
      vec2 p = abs(eye.xy + ray.xy * t - vec2(${w.x.toFixed(6)}, ${w.y.toFixed(6)}));
      if (t > 0.0 && p.x < ${(w.width/2).toFixed(6)} && p.y < ${(w.height/2).toFixed(6)}
          && p.x + p.y < ${(w.width/2+w.height/2-w.cut).toFixed(6)}) throughWindow = true;
    }`).join('\n');
}

// Sort the unchanged catalogue by hemisphere and azimuth. Each active render
// eye submits one contiguous slice (including XR/mirror eyes), never scans or
// uploads all stars per frame. Looking away from every window submits zero.
function windowStarRange(stars,windows){
  if(!windows?.length||!windows.every(w=>Math.abs(w.z-windows[0].z)<1e-6))return;
  const z=windows[0].z,positions=stars.geometry.attributes.position,halves=[[],[]];
  for(let i=0;i<positions.count;i++){
    const side=positions.getZ(i)>=0?0:1;
    halves[side].push({index:i,angle:Math.atan2(positions.getX(i),Math.abs(positions.getZ(i)))});
  }
  halves.forEach(half=>half.sort((a,b)=>a.angle-b.angle));
  // Keep a contiguous non-indexed stream: scattered indexed point fetches can
  // cost more than the saved vertices on mobile/integrated GPUs.
  const order=halves.flatMap(half=>half.map(star=>star.index));
  for(const attribute of Object.values(stars.geometry.attributes)){
    const sorted=new attribute.array.constructor(attribute.array.length);
    for(let i=0;i<order.length;i++)for(let k=0;k<attribute.itemSize;k++)sorted[i*attribute.itemSize+k]=attribute.array[order[i]*attribute.itemSize+k];
    attribute.copyArray(sorted);attribute.needsUpdate=true;
  }
  const angles=halves.map(half=>Float32Array.from(half,star=>star.angle));
  const before=stars.onBeforeRender;
  const lower=(half,value)=>{let lo=0,hi=half.length;while(lo<hi){const mid=(lo+hi)>>>1;if(half[mid]<value)lo=mid+1;else hi=mid;}return lo;};
  stars.onBeforeRender=(renderer,scene,camera)=>{
    before(renderer,scene,camera);
    const world=camera.matrixWorld.elements,projection=camera.projectionMatrix.elements;
    const side=world[14]<z?0:1,half=angles[side],offset=side?angles[0].length:0;
    // Include the shader's wide-angle density compensation and asymmetric XR
    // projections. A diagonal cone conservatively encloses all four corners.
    const scale=Math.min(1,1.428148/Math.abs(projection[5]));
    // A narrow/cropped mirror projection warps sky directions toward its view
    // axis. That can pull stars across the original hemisphere boundary, so
    // retain the full catalogue for that uncommon projection (POV is 70–78°).
    if(scale<.999999){stars.geometry.setDrawRange(0,positions.count);return;}
    const tx=(1+Math.abs(projection[8]))/Math.abs(projection[0])/scale;
    const ty=(1+Math.abs(projection[9]))/Math.abs(projection[5])/scale;
    const tangent=Math.hypot(tx,ty),sinCone=tangent/Math.sqrt(1+tangent*tangent);
    const length=Math.hypot(world[8],world[9],world[10]),horizontal=Math.hypot(world[8],world[10])/length;
    // When the cone includes a pole, every azimuth is potentially visible.
    if(horizontal<=sinCone||!camera.isPerspectiveCamera){stars.geometry.setDrawRange(offset,half.length);return;}
    const centre=Math.atan2(-world[8],(side?1:-1)*world[10]),span=Math.asin(Math.min(1,sinCone/horizontal))+.01;
    let low=centre-span,high=centre+span;
    if(low>Math.PI/2){low-=Math.PI*2;high-=Math.PI*2;}
    if(high<-Math.PI/2){low+=Math.PI*2;high+=Math.PI*2;}
    const start=lower(half,low),end=lower(half,high);
    stars.geometry.setDrawRange(offset+start,Math.max(0,end-start));
  };
}

// Store directions on one shell, then centre it on the active camera/VR eye.
// Camera translation cannot change the constellation; only its rotation can.
// The reference eye preserves the density and brightness of the existing view.
function distantSky(stars,{reference=[0,5,0],windows=null,matchPov=false,optimizeWindows=true}={}){
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
    const openings=windowIntersections(windows,optimizeWindows);
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
  stars.material.customProgramCacheKey=()=>`distant-sky-v7-${matchPov}-${optimizeWindows}-${JSON.stringify(windows)}`;
  return stars;
}

// Both sides use the POV window's catalog, density, colours, and point sizes.
// Rotate the rear field to face the opposite side without changing its look.
export function createSpaceStars({rear=false,windows=null,panoramic=false,optimizeWindows=true}={}){
  let seed=73191;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const positions=[],colors=[],color=new Color();
  for(let i=0;i<(panoramic?6000:1900);i++){
    let x,y,z;
    if(panoramic){
      // Uniform solid-angle density across the whole sky, rather than a box of
      // points solely ahead. Keep the former central view's approximate density
      // and sub-pixel brightness; all 6,000 points still share one draw call.
      const vertical=random()*2-1,azimuth=random()*Math.PI*2,radius=45+random()*40,horizontal=Math.sqrt(1-vertical*vertical);
      x=Math.cos(azimuth)*horizontal*radius;y=vertical*radius+5;z=Math.sin(azimuth)*horizontal*radius;
    }else{x=(random()-.5)*155;y=(random()-.5)*90+5;z=40+random()*35;}
    positions.push(rear?-x:x,y,rear?-z:z);
    color.setHSL(.56+random()*.09,.08+random()*.23,.46+random()*.42);colors.push(...color.toArray());
  }
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3)).setAttribute('color',new Float32BufferAttribute(colors,3));
  const material=new PointsMaterial({name:rear?'Rear windows / distant stars':'POV / distant stars',size:.055,vertexColors:true,toneMapped:false});
  material.userData.cabinAlwaysPowered=true;material.userData.castShadow=false;
  const stars=new Points(geometry,material);stars.name=rear?'Rear windows / stars':'POV / stars';
  stars.userData.panoramic=panoramic;
  distantSky(stars,{windows,matchPov:true,optimizeWindows});
  if(panoramic&&optimizeWindows)windowStarRange(stars,windows);
  return stars;
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
