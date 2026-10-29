import {Box3,BufferGeometry,CanvasTexture,Group,Mesh,MeshStandardMaterial,RepeatWrapping,SRGBColorSpace} from 'three';

export function fitGateFrame(frame,g){
  const gate=frame.parent,rearFrame=gate.getObjectByName('Rear threshold frame');
  if(rearFrame){rearFrame.removeFromParent();rearFrame.geometry.dispose();}
  const trim=new Group();trim.name='Fitted gate trim';
  trim.position.set(g.x,g.floor+1.31,0);gate.add(trim);
  const close=(a,b)=>Math.abs(a-b)<1e-6;
  const parts=gate.children.filter(mesh=>mesh===frame||mesh.name==='Gate seal'||
    mesh.name==='Machined gate frame bolt'||
    (mesh.isMesh&&close(Math.abs(mesh.position.x-g.x),.93)&&close(mesh.position.y,g.floor+1.26)&&
      [g.front+.045,g.front+.08].some(z=>close(mesh.position.z,z))));
  // Keep the gasket, bolts and handles aligned while lifting the bottom above the deck.
  for(const part of parts)trim.attach(part);
  trim.scale.set(.97,.97,1);
  // Measure the full wall reveal, then reduce its depth while holding the front face.
  frame.updateWorldMatrix(true,false);
  const frameBounds=new Box3().setFromObject(frame);
  let frameBack=frameBounds.min.z;
  for(const wall of gate.parent.children){
    if(wall.name!=='Bulkhead with octagonal opening')continue;
    const bounds=new Box3().setFromObject(wall);
    if(bounds.min.x<g.x&&bounds.max.x>g.x&&bounds.min.y<g.floor+1.31&&bounds.max.y>g.floor+1.31)
      frameBack=Math.min(frameBack,bounds.min.z);
  }
  frameBack=frameBounds.max.z-(frameBounds.max.z-frameBack)*2/3;
  frame.scale.z*=(frameBounds.max.z-frameBack)/(frameBounds.max.z-frameBounds.min.z);
  frame.position.z+=frameBack-frameBounds.min.z;
  // Move the floor joint with the thinner reveal; neither layer covers the sill.
  for(const name of ['Recessed rear-room floor','Rear-room floor cap']){
    const floor=gate.getObjectByName(name),bounds=new Box3().setFromObject(floor);
    floor.scale.z*=(frameBack-bounds.min.z)/(bounds.max.z-bounds.min.z);
    floor.position.z+=(frameBack-bounds.max.z)/2;
  }
}

// Shared by the live cabin and the study. No runtime texture animation.
export function createGateFramePaint(revealMetal){
  const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  let seed=9341;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  ctx.fillStyle='#eeeae0';ctx.fillRect(0,0,size,size);
  ctx.fillStyle='#b33c28';
  for(let start=-size*2;start<size*2;start+=size){
    ctx.beginPath();ctx.moveTo(start,size);ctx.lineTo(start+size/2,size);
    for(let y=size;y>=0;y-=16)ctx.lineTo(start+size/2+size-y+Math.sin(y*.11)*.65,y);
    ctx.lineTo(start+size,0);
    for(let y=0;y<=size;y+=16)ctx.lineTo(start+size-y+Math.sin(y*.11)*.65,y);
    ctx.closePath();ctx.fill();
  }
  // Slight brush variation and small scuffs, with most of the paint intact.
  for(let i=0;i<3500;i++){
    ctx.fillStyle=random()>.5?'#fff4dd0a':'#30352e08';
    ctx.fillRect(random()*size,random()*size,.5+random(),4+random()*24);
  }
  for(let i=0;i<36;i++){
    ctx.strokeStyle=i%3?'#e4dfcd65':'#686d6740';ctx.lineWidth=.5+random();
    const x=random()*size,y=random()*size;ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+3+random()*12,y+random()*2);ctx.stroke();
  }
  const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;
  map.wrapS=map.wrapT=RepeatWrapping;map.anisotropy=4;
  const lining=document.createElement('canvas');lining.width=512;lining.height=8;
  const lines=lining.getContext('2d');lines.fillStyle='#919b9e';lines.fillRect(0,0,512,8);
  lines.fillStyle='#566065';lines.fillRect(512/3,0,512/3,8);
  for(const fraction of [1/3,2/3]){
    const x=Math.round(fraction*512);
    lines.fillStyle='#abb1b2';lines.fillRect(x-6,0,12,8);
    lines.fillStyle='#45514c';lines.fillRect(x-4,0,8,8);
    lines.fillStyle='#eff3f4';lines.fillRect(x+4,0,2,8);
  }
  const liningMap=new CanvasTexture(lining);liningMap.colorSpace=SRGBColorSpace;liningMap.anisotropy=4;
  const face=new MeshStandardMaterial({name:'Gate / vermilion and ivory frame paint',
    map,color:0xffffff,roughness:.82,metalness:.10,envMapIntensity:.24});
  const edge=revealMetal.clone();edge.name='Gate / satin three-band metal reveal';
  edge.map=liningMap;edge.color.setHex(0x929b9e);
  edge.roughness=.56;edge.roughnessMap=null;edge.bumpScale=.00015;edge.envMapIntensity=.85;
  edge.defines={...revealMetal.defines};
  face.userData.cabinKeepSurface=edge.userData.cabinKeepSurface=true;
  return {materials:[face,edge],dispose(){map.dispose();liningMap.dispose();face.dispose();edge.dispose();}};
}

export function paintGateFrameGeometry(source,{x,floor}){
  const geometry=source.clone(),position=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
  // Planar UVs keep the 45-degree stripes continuous around all eight corners.
  // ExtrudeGeometry group 0 is the striped face; group 1 supplies the lining.
  const pitch=.48;
  for(let i=0;i<position.count;i++)uv.setXY(i,(position.getX(i)-x)/pitch,(position.getY(i)-floor)/pitch);
  geometry.computeBoundingBox();
  const z0=geometry.boundingBox.min.z,depth=geometry.boundingBox.max.z-z0;
  // Two baked seams wrap around all eight inner faces without extra meshes or draws.
  // Outer edges and bevels sample the plain part of the same small texture.
  for(const group of geometry.groups){
    if(group.materialIndex!==1)continue;
    for(let i=group.start;i<group.start+group.count;i++){
      const inward=normal.getX(i)*(position.getX(i)-x)+normal.getY(i)*(position.getY(i)-floor-1.31)<0;
      uv.setXY(i,inward&&Math.abs(normal.getZ(i))<1e-5?(position.getZ(i)-z0)/depth:0,.5);
    }
  }
  return geometry;
}

function surfaceGeometry(source,materialIndex){
  const geometry=new BufferGeometry();
  for(const [name,attribute]of Object.entries(source.attributes)){
    const values=[];
    for(const group of source.groups){
      if(group.materialIndex!==materialIndex)continue;
      for(let i=group.start;i<group.start+group.count;i++){
        const index=source.index?source.index.getX(i):i;
        for(let j=0;j<attribute.itemSize;j++)values.push(attribute.array[index*attribute.itemSize+j]);
      }
    }
    geometry.setAttribute(name,new attribute.constructor(new attribute.array.constructor(values),attribute.itemSize,attribute.normalized));
  }
  return geometry;
}

export function finishGateFrames(root,gates){
  const meshes=root.getObjectsByProperty('name','Eight-sided gate frame');
  const paint=createGateFramePaint(meshes[0].material);
  const frames=meshes.map((mesh,index)=>{
    fitGateFrame(mesh,gates[index]);
    const metal=mesh.material,painted=paintGateFrameGeometry(mesh.geometry,gates[index]);
    // Separate the two surfaces before batching: material arrays are deliberately
    // excluded by batchStatic. All three gates then share just two material draws.
    const faceGeometry=surfaceGeometry(painted,0),edgeGeometry=surfaceGeometry(painted,1);
    mesh.geometry.dispose();painted.dispose();
    mesh.geometry=faceGeometry;mesh.material=paint.materials[0];
    const reveal=new Mesh(edgeGeometry,paint.materials[1]);reveal.name='Gate metal reveal';
    reveal.castShadow=reveal.receiveShadow=true;mesh.add(reveal);
    return {mesh,reveal,metal,paint:paint.materials};
  });
  return {frames,...paint};
}
