import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Texture,Vector3,Raycaster,ShaderLib} from 'three';
import {createLoungeCap} from '../src/obs/lounge-cap.js';
import {createLoungeSofa} from '../src/obs/ship.js';
import {LOUNGE_SEAT,CAT_SOFA} from '../src/obs/layout.js';
import {batchStatic} from '../src/obs/materials.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';

function fixture(t){
  const weave=new Texture(),logo=new Texture(),standard=new MeshStandardMaterial();
  const m={cloth:{bumpMap:weave},taraironLogo:{map:logo},cushion:standard,dark:standard,olive:standard,enamel:standard};
  const geometries=new Set(),materials=new Set(),textures=new Set([weave,logo]);
  const track=root=>{root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});return root;};
  t.after(()=>{for(const material of materials)for(const v of Object.values(material))if(v?.isTexture)textures.add(v);for(const resource of [...geometries,...materials,...textures])resource.dispose();});
  return{m,track};
}

test('washed cotton cap reuses the real white logo with raised, filtered embroidery and a bounded mesh',t=>{
  const {m,track}=fixture(t),cap=track(createLoungeCap(m));
  const crown=cap.getObjectByName('Cap / soft six-panel crown'),logo=cap.getObjectByName('Cap / white embroidered TARAIRON logo');
  assert.equal(crown.material.color.getHex(),0x2a3548);assert.equal(crown.material.metalness,0);assert.ok(crown.material.roughness>.9);
  assert.equal(crown.material.bumpMap,m.cloth.bumpMap);assert.equal(logo.material.map,m.taraironLogo.map);
  assert.ok(logo.material.color.r>.8&&logo.material.color.g>.8&&logo.material.color.b>.7,'warm white thread');
  assert.equal(logo.material.transparent,false);assert.ok(logo.material.alphaTest>0,'no rectangular backing');
  assert.ok(crown.geometry.attributes.color,'subtle washed panel variation');
  crown.geometry.computeBoundingBox();
  assert.ok(Math.abs(crown.geometry.boundingBox.max.y-.110)<1e-7,'lower, rounder crown rather than a tall dome');
  assert.equal(cap.getObjectByName('Cap / covered top button').position.y,.110,'button follows the lowered crown');
  assert.equal(cap.children.filter(o=>o.name==='Cap / panel seam').length,6);
  let triangles=0,lights=0;cap.traverse(o=>{if(o.isLight)lights++;if(o.geometry){
    triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));assert.ok(o.geometry.attributes.normal.array.every(Number.isFinite));
  }});
  assert.ok(triangles<2800,`${triangles} triangles`);assert.equal(lights,0);
  const shader={fragmentShader:ShaderLib.standard.fragmentShader};logo.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/fwidth\(stitchPhase\)/,'fine stitches fade out instead of shimmering at distance');
  cap.updateMatrixWorld(true);
  for(const x of [-.025,0,.025])for(const y of [.052,.067,.078]){
    const hits=new Raycaster(new Vector3(x,y,.3),new Vector3(0,0,-1)).intersectObjects([crown,logo]);
    assert.equal(hits[0].object,logo,'embroidery lies outside the crown');
    assert.ok(hits.find(hit=>hit.object===crown).distance-hits[0].distance>.00025,'positive geometric clearance');
  }
  const batch=track(batchStatic(cap,{xrLOD:true}));assert.equal(batch.children.length,3);
  const toon=createCabinToon([batch]);t.after(()=>toon.dispose());toon.setStyle('cartoon');
  assert.ok(batch.children.some(o=>o.material===logo.material),'white stitching survives OBS cartoon material selection');
});

test('cap hooks over the left arm tip with its curved bill hanging clear of the seat and access route',t=>{
  const {m,track}=fixture(t),sofa=track(createLoungeSofa(m));sofa.updateMatrixWorld(true);
  const cap=sofa.getObjectByName('Lounge / baseball cap'),bounds=new Box3().setFromObject(cap,true),seat=sofa.getObjectByName('Study seat with returned front edge');
  const arm=sofa.children.find(o=>o.name==='Study wraparound arm cushion'&&o.position.x<6);
  assert.equal(cap.position.x,arm.position.x,'aligned with the left arm, not a cushion');
  assert.ok(cap.rotation.x>.7&&cap.rotation.y<-.15&&Math.abs(cap.rotation.z)>.08,'brim hangs down at a casual angle');
  const bill=cap.getObjectByName('Cap / curved bill'),billTip=bill.localToWorld(new Vector3().fromBufferAttribute(bill.geometry.attributes.position,5*25+12));
  assert.ok(billTip.y<cap.position.y-.11&&billTip.z>cap.position.z+.08,'bill hangs down in front of the arm');
  const metal=sofa.children.find(o=>o.name==='Sofa floor-reaching arm'&&o.position.x<6);
  const ray=new Raycaster(),down=new Vector3(0,-1,0);let contactGap=Infinity,metalGap=Infinity;
  // Sample triangle interiors as well as vertices: no cloth crosses the pad,
  // but the rear rim stays within 4 mm of its supporting rounded corner.
  cap.traverse(o=>{if(!o.geometry)return;const p=o.geometry.attributes.position,index=o.geometry.index;
    for(let i=0;i<(index?.count??p.count);i+=3){
      const vertices=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(o.matrixWorld));
      if(vertices.every(v=>v.z>.31))continue;
      for(let a=0;a<=6;a++)for(let b=0;b<=6-a;b++){
        const point=vertices[0].clone().multiplyScalar(a/6).addScaledVector(vertices[1],b/6).addScaledVector(vertices[2],1-(a+b)/6);
        ray.set(new Vector3(point.x,1.5,point.z),down);const hit=ray.intersectObject(arm,false)[0];
        if(hit)contactGap=Math.min(contactGap,point.y-hit.point.y);
        const metalHit=ray.intersectObject(metal,false)[0];
        if(metalHit)metalGap=Math.min(metalGap,point.y-metalHit.point.y);
      }
    }
  });
  assert.ok(contactGap>.0003&&contactGap<.004,`rim contact clearance ${contactGap}`);
  assert.ok(metalGap>.0003,`bill clears the projecting metal corner: ${metalGap}`);
  assert.ok(bounds.min.x>5.20&&bounds.max.x<5.45,'stays within the arm width, clear of Milo and the access route');
  assert.ok(bounds.max.x<(CAT_SOFA.seatX-700)*.022-.7,'clear of Lucy’s sofa position');
  assert.ok(bounds.min.y>LOUNGE_SEAT.top+.10&&bounds.max.z<.41,'above the seat and behind the front aisle');
  assert.ok(!bounds.intersectsBox(new Box3().setFromObject(seat)),'seat stays empty');
  for(const name of ['Sofa backrest']){
    sofa.traverse(o=>{if(o.name===name)assert.ok(!bounds.intersectsBox(new Box3().setFromObject(o)),name);});
  }
});

test('bill rolls downward on both sides with a continuous crown attachment and matching stitching',t=>{
  const {m,track}=fixture(t),cap=track(createLoungeCap(m));
  const bill=cap.getObjectByName('Cap / curved bill').geometry,under=cap.getObjectByName('Cap / bill underside').geometry;
  const p=bill.attributes.position,q=under.attributes.position,columns=24;
  const point=(col,row)=>new Vector3().fromBufferAttribute(p,row*(columns+1)+col);
  const nose=point(12,5);
  assert.ok(Math.abs(nose.z-.167)<1e-7,'shortened nose rather than the former elongated .192 m tip');
  for(const col of [6,18]){
    const shoulder=point(col,5);
    assert.ok(nose.z-shoulder.z<.008,'broad shallow leading arc across the middle half of the bill');
    assert.ok(Math.abs(shoulder.x)>.045,'retain shoulder width instead of narrowing to a point');
  }
  for(let row=1;row<=5;row++){
    const left=point(2,row),center=point(12,row),right=point(22,row);
    assert.ok(center.y>left.y&&center.y>right.y,'edges curl down rather than turning up');
    if(row===5)assert.ok(center.y-left.y>.027&&center.y-right.y>.027,'visible deep pre-curved cross-section');
    for(let col=3;col<12;col++)assert.ok(point(col+1,row).y>point(col,row).y,'smooth roll up to the centre');
  }
  for(const col of [0,columns])for(let row=1;row<=5;row++)assert.ok(point(col,row).distanceTo(point(col,0))<1e-8,'rounded bill tapers back into the hem, with no square end tabs');
  for(let col=0;col<=columns;col++){
    const rear=point(col,0);
    assert.ok(Math.abs(rear.y-.010)<1e-8);
    assert.ok(Math.abs((rear.x/.102)**2+(rear.z/.108)**2-1)<1e-6,'root follows the existing oval crown hem');
  }
  for(let i=0;i<p.count;i++){
    assert.ok(Math.abs(p.getY(i)-q.getY(i)-.003)<1e-8,'bill retains a real, even thickness');
    assert.equal(p.getX(i),q.getX(i));assert.equal(p.getZ(i),q.getZ(i));
  }
  assert.equal(bill.index.count/3,240,'shape correction adds no bill polygons');
  for(const seam of cap.children.filter(o=>o.name==='Cap / bill topstitch')){
    const points=seam.geometry.parameters.path.points,center=points[Math.floor(points.length/2)];
    assert.ok(center.y>points[1].y+.015&&center.y>points.at(-2).y+.015,'topstitch follows the downturned outer shoulders of the broader bill');
  }
});

test('actual OBS cabin contains one cap in the shared lounge sofa',()=>{
  const ship=buildSurfaceFixture();try{
    const caps=[];ship.staticMesh.traverse(o=>{if(o.name==='Lounge / baseball cap')caps.push(o);});
    assert.equal(caps.length,1);assert.equal(caps[0].parent.name,'Lounge furniture');
  }finally{disposeSurfaceFixture(ship);}
});
