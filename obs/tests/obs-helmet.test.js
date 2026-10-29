import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {createEVAHelmet,EVA_HELMET} from '../src/obs/eva-helmet.js';
import {hangingSuit} from '../src/obs/eva-suit.js';

function materials(){const material=new MeshStandardMaterial();return new Proxy({},{get:()=>material});}
function helmet(){const root=createEVAHelmet(materials());root.updateMatrixWorld(true);return root;}
function dispose(root){root.traverse(mesh=>mesh.geometry?.dispose());}
function suit(index){
  const previous=globalThis.document;
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*16};}};}};}};
  try{const root=hangingSuit(materials(),index);root.updateMatrixWorld(true);return root;}
  finally{if(previous)globalThis.document=previous;else delete globalThis.document;}
}

test('the rounded-square visor covers the face while leaving a visible white surround',()=>{
  const root=helmet(),visor=root.getObjectByName('Continuous face visor');
  const bounds=new Box3().setFromObject(visor),shellBounds=new Box3().setFromObject(root.getObjectByName('Metal helmet shell'));
  const scale=EVA_HELMET.scale,width=bounds.max.x-bounds.min.x,shellWidth=shellBounds.max.x-shellBounds.min.x;
  assert.ok(width>shellWidth*.88&&width<shellWidth*.97,'leave a white border without narrowing the full-face opening');
  assert.ok(bounds.max.y-bounds.min.y>EVA_HELMET.height*scale*.55,'full face opening below the rounded crown and arched brow');
  assert.ok(bounds.min.y>shellBounds.min.y&&bounds.max.y<shellBounds.max.y);
  assert.equal(visor.material.color.getHex(),0x101a13);
  assert.equal(visor.material.transparent,true);assert.ok(visor.material.opacity>.75&&visor.material.opacity<.9);
  assert.equal(visor.material.depthWrite,false);
  const ray=new Raycaster();
  for(const x of [-.15,0,.15])for(const y of [.12,.25,.30]){
    ray.set(new Vector3(x*scale,EVA_HELMET.base+y*scale,2),new Vector3(0,0,-1));
    assert.equal(ray.intersectObject(root,true)[0]?.object,visor,`visor is covered at ${x}, ${y}`);
  }
  for(const [x,y]of [[-.252,.12],[.252,.12],[.1,.42],[0,-.04]]){
    ray.set(new Vector3(x*scale,EVA_HELMET.base+y*scale,2),new Vector3(0,0,-1));
    assert.equal(ray.intersectObject(root,true)[0]?.object.material.color.getHex(),0xd4d7d2,`white surround at ${x}, ${y}`);
  }
  dispose(root);
});

test('the rounded shell has finite outward surfaces and mirrored circular visor hinges',()=>{
  const root=helmet();root.updateMatrixWorld(true);
  const hinges=[];root.traverse(mesh=>{if(mesh.name==='Circular visor hinge')hinges.push(mesh);});assert.equal(hinges.length,2);
  const positions=hinges.map(mesh=>mesh.getWorldPosition(new Vector3()));assert.equal(positions[0].x,-positions[1].x);
  for(const hinge of hinges){
    const box=new Box3().setFromObject(hinge);assert.ok(Math.abs((box.max.y-box.min.y)-(box.max.z-box.min.z))<1e-6);
    assert.ok(hinge.geometry.parameters.radialSegments>=32,'smooth circular hardware, not an octagonal plate');
  }
  root.traverse(mesh=>{
    if(!mesh.geometry)return;
    for(const key of ['position','normal','uv'])for(const value of mesh.geometry.attributes[key].array)assert.ok(Number.isFinite(value));
  });
  const visor=root.getObjectByName('Continuous face visor'),normal=visor.geometry.attributes.normal;
  for(let i=0;i<normal.count;i++)assert.ok(normal.getZ(i)>0);
  assert.equal(root.getObjectByName('Cheek visor surround'),undefined,'do not restore the old raised cheek braces');
  dispose(root);
});

test('the current reference has an arched metal brow, recessed controls and a rear access panel instead of red paint',()=>{
  const root=helmet(),brow=root.getObjectByName('Brushed metal brow shield');
  assert.equal(root.getObjectByName('Red crown-to-rear stripe'),undefined);
  assert.equal(root.getObjectByName('Red angular temple stripe -1'),undefined);
  const vertices=brow.geometry.attributes.position;
  assert.ok(vertices.getY(32)-vertices.getY(0)>.035,'brow arches downward toward the sides, not a straight flat bar');
  assert.ok(brow.material.metalness>.65);
  assert.ok(root.getObjectByName('Bolted chin guard'));
  assert.ok(root.getObjectByName('Rear rectangular access cover'));
  let fasteners=0,controls=0;root.traverse(o=>{if(o.name==='Helmet recessed fastener')fasteners++;if(o.name==='Side release control')controls++;});
  assert.ok(fasteners>=30);assert.equal(controls,4);
  const ray=new Raycaster();
  for(const x of [-.15,.15]){
    ray.set(new Vector3(x*EVA_HELMET.scale,EVA_HELMET.base+.32*EVA_HELMET.scale,2),new Vector3(0,0,-1));
    assert.equal(ray.intersectObject(root,true)[0]?.object.name,'Visor perimeter gasket','seal must bridge the curved glass edge without a gap');
  }
  dispose(root);
});

test('the translucent visor has a real shell opening and a recessed padded interior',()=>{
  const root=helmet(),visor=root.getObjectByName('Continuous face visor'),ray=new Raycaster();
  const positions=visor.geometry.attributes.position;
  for(let row=4;row<=36;row+=4)for(let col=6;col<=58;col+=4){
    const p=visor.localToWorld(new Vector3().fromBufferAttribute(positions,row*65+col));
    ray.set(p.clone().add(new Vector3(0,0,.10)),new Vector3(0,0,-1));
    const hits=ray.intersectObject(root,true),front=hits[0];
    assert.equal(front?.object,visor,'white shell facets must not show through the dark glass');
    const interior=hits.find(h=>h.object!==visor);
    assert.ok(interior&&interior.distance>front.distance+.025,'the glass must not sit over a solid shell or opaque decal');
  }
  assert.ok(root.getObjectByName('Recessed helmet inner liner'));
  let pads=0;root.traverse(o=>{if(o.name==='Helmet interior cheek pad')pads++;});assert.equal(pads,2);
  dispose(root);
});

test('the glass and its retaining rail share mirrored diagonal cheek steps',()=>{
  const root=helmet(),glass=root.getObjectByName('Continuous face visor').geometry.attributes.position;
  const point=(row,col)=>new Vector3().fromBufferAttribute(glass,row*65+col);
  // The lower quarter steps inward; the upper three-eighths stays full width.
  const lower=point(10,64),upper=point(15,64);
  assert.ok(upper.x-lower.x>.02,'lower glass narrows in the front view');
  assert.ok(lower.z-upper.z>.02,'cheek ledge turns forward in the side view');
  for(const row of [0,4,10,11,12,13,14,15,24,40]){
    const left=point(row,0),right=point(row,64);
    assert.equal(left.x,-right.x);assert.equal(left.y,right.y);assert.equal(left.z,right.z);
  }
  const rail=root.getObjectByName('Visor inner retention rail').geometry.parameters.path;
  for(const [row,railIndex]of [[10,40],[15,44]]){
    assert.ok(point(row,64).distanceTo(rail.points[railIndex])<.01,'metal rail follows the glass step, not the old straight edge');
  }
  dispose(root);
});

test('the lower helmet rim follows the tilted locking collar instead of a horizontal base value',()=>{
  const root=suit(0),rim=root.getObjectByName('Lower helmet rim'),collar=root.getObjectByName('Wide helmet locking collar');
  const collarTop=collar.geometry.parameters.height/2,rimRadius=rim.geometry.parameters.radius*EVA_HELMET.scale;
  assert.ok(Math.abs(collar.parent.rotation.x-Math.atan(.30))<1e-9);
  for(let i=0;i<64;i++){
    const point=collar.parent.worldToLocal(rim.localToWorld(rim.geometry.parameters.path.getPoint(i/64)));
    assert.ok(point.y>=collarTop-.004,'rim cannot sink through the collar');
    assert.ok(point.y-rimRadius<=collarTop+.002,'rim must meet the sloped collar within 2 mm');
    assert.ok(Math.abs(Math.hypot(point.x,point.z)-collar.geometry.parameters.radiusTop)<.002,'spherical cut seats concentrically on the collar');
  }
  dispose(root);
});

test('the fitted shell reduces horizontal bulge without raising or sharpening the round crown',()=>{
  const root=helmet(),shell=root.getObjectByName('Metal helmet shell');
  const vertices=shell.geometry.attributes.position,centre=new Vector3(0,EVA_HELMET.centreHeight,EVA_HELMET.axisDepth),point=new Vector3();
  let crownSamples=0;
  for(let i=0;i<vertices.count;i++){
    point.fromBufferAttribute(vertices,i).sub(centre);
    if(point.y<.08)continue;
    point.x/=EVA_HELMET.lateralFit;point.z/=EVA_HELMET.depthFit;
    assert.ok(Math.abs(point.length()-EVA_HELMET.radius)<1e-7,'crown remains a smooth round arc, with no cone or rearward shear');
    crownSamples++;
  }
  assert.ok(crownSamples>1000,'cover the entire crown, not only its peak');
  const size=new Box3().setFromObject(shell).getSize(new Vector3());
  assert.ok(Math.abs(size.y-EVA_HELMET.radius*2*EVA_HELMET.scale)<1e-6,'do not stretch the head upward');
  assert.ok(size.x/size.y>.89&&size.x/size.y<.91,'front width is reduced by about ten percent');
  assert.ok(size.z/size.y>.87&&size.z/size.y<.92,'side depth is reduced without restoring the narrow pointed head');
  dispose(root);
});

test('helmet paint matches each suit while hardware, glazing and connected rear hoses stay unchanged',()=>{
  for(const index of [0,1,2]){
    const root=suit(index),ports=[],hoses=[];
    const paint=index===1?0x962229:0xd4d7d2;
    for(const name of ['Metal helmet shell','Continuous white visor surround','Bolted chin guard'])assert.equal(root.getObjectByName(name).material.color.getHex(),paint);
    assert.equal(root.getObjectByName('Rear rectangular access cover').material.color.getHex(),index===1?0x7e2025:0xc3c6bb);
    assert.equal(root.getObjectByName('Continuous face visor').material.color.getHex(),0x101a13);
    assert.equal(root.getObjectByName('Brushed metal brow shield').material.color.getHex(),0x62655d);
    root.traverse(object=>{if(object.name==='Rear helmet hose port')ports.push(object);if(object.name==='Rear helmet breathing hose')hoses.push(object);});
    assert.equal(ports.length,2);assert.equal(hoses.length,2);
    for(const port of ports){
      const hose=hoses.find(h=>h.userData.side===port.userData.side),tube=hose.children.find(m=>m.geometry?.type==='TubeGeometry');
      const end=tube.localToWorld(tube.geometry.parameters.path.getPoint(1));
      assert.ok(end.distanceTo(port.getObjectByName('Helmet hose outlet').getWorldPosition(new Vector3()))<1e-8,'hose ends exactly at helmet socket');
      const start=hose.parent.worldToLocal(tube.localToWorld(tube.geometry.parameters.path.getPoint(0)));
      assert.ok(Math.abs(start.y-1.6115)<.005&&Math.abs(start.x)<.153&&start.z>-.273&&start.z<-.194,'lower hose enters the backpack top');
    }
    dispose(root);
  }
});
