import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {createCat} from '../src/obs/characters.js';
import {catFaceSurface,updateCatEyes} from '../src/obs/cat-face.js';

const makeCat=()=>{const material=new MeshStandardMaterial();return createCat(new Proxy({},{get:()=>material}));};

test('mirrored ears have outward forward-raked tips and diagonal roots buried in the skull',()=>{
  const {ears}=makeCat().userData,points=[];
  for(const ear of ears){
    ear.updateMatrix();
    const position=ear.children[0].geometry.attributes.position,side=Math.sign(ear.position.x);
    const point=index=>new Vector3().fromBufferAttribute(position,index).applyMatrix4(ear.matrix);
    const tip=point(24*21+10),base=point(10),outer=point(side<0?0:20),inner=point(side<0?20:0);
    assert.ok(side*(tip.x-base.x)>.03,'the tip leans outward');
    assert.ok(Math.abs(outer.x)<.10,'the root curves inward beneath the skull silhouette');
    assert.ok(tip.z-base.z>.010,'the tip leans toward the nose, not the back of the skull');
    assert.ok(tip.y-base.y>.08&&tip.y-base.y<.11);
    assert.ok(inner.y-outer.y>.04,'the root slopes down toward the outer skull rather than sticking out horizontally');
    points.push(tip);
  }
  assert.ok(Math.abs(points[0].x+points[1].x)<1e-7);
  assert.ok(Math.abs(points[0].z-points[1].z)<1e-7);
});

test('the shortened muzzle has a broad round profile and attached whiskers and tongue',()=>{
  const {head,tongue}=makeCat().userData;
  for(let y=-.060;y<=-.015;y+=.001)assert.ok(catFaceSurface(0,y)<.146,'no projecting muzzle spike');
  assert.ok(Math.abs(catFaceSurface(0,-.030)-catFaceSurface(0,-.055))<.004,'upper and lower muzzle form a blunt profile');
  for(const whisker of head.children.filter(mesh=>mesh.name==='Whisker')){
    const root=whisker.geometry.parameters.path.points[0];
    assert.ok(Math.abs(root.z-catFaceSurface(root.x,root.y)-.0007)<1e-8);
  }
  assert.ok(Math.abs(tongue.position.z-catFaceSurface(tongue.position.x,tongue.position.y)-.012)<1e-8);
});

test('the eyes sit inside a continuous face with separate furred eyelids and shallow corneas',()=>{
  const {head,eyes}=makeCat().userData,skull=head.getObjectByName('Contoured cat skull');
  assert.ok(skull.geometry.attributes.facePosition);
  assert.equal(head.children.filter(child=>child.name==='Contoured cat skull').length,1);
  const width=new Box3().setFromObject(skull).getSize(new Vector3()).x;
  assert.ok(Math.abs(eyes[0].position.x-eyes[1].position.x)<width*.5);
  for(const eye of eyes){
    assert.deepEqual(eye.children.map(mesh=>mesh.name),['Almond eye surface','Eyelid margin','Furred eyelids']);
    const surface=eye.children[0],position=surface.geometry.attributes.position;
    assert.ok(surface.geometry.attributes.color);assert.ok(surface.material.envMapIntensity<.2);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i)+eye.position.x,y=position.getY(i)+eye.position.y;
      const projection=position.getZ(i)-catFaceSurface(x,y);
      assert.ok(projection>-.0001&&projection<.016,`cornea projection ${projection}`);
    }
  }
});

test('nose vertices follow the muzzle instead of hovering above it or disappearing inside it',()=>{
  const nose=makeCat().userData.head.getObjectByName('Triangular cat nose'),position=nose.geometry.attributes.position;
  for(let i=0;i<position.count;i++){
    const point=new Vector3().fromBufferAttribute(position,i).add(nose.position);
    const thickness=point.z-catFaceSurface(point.x,point.y);
    assert.ok(thickness>=.00049&&thickness<=.00651,`nose thickness ${thickness}`);
  }
});

test('blinks cover the iris, retain the coat coordinates and restore exactly without replacing buffers',()=>{
  const {eyes}=makeCat().userData;
  const original=eyes.flatMap(eye=>eye.children.map(mesh=>({geometry:mesh.geometry,position:mesh.geometry.attributes.position.array.slice()})));
  for(const opening of [1,.7,.2,.025,.2,.7,1]){
    eyes.forEach(eye=>eye.scale.y=opening);updateCatEyes(eyes);
    let index=0;
    for(const eye of eyes){
      assert.equal(eye.scale.y,1);assert.equal(eye.children[0].visible,opening>.055);
      for(const mesh of eye.children){
        assert.equal(mesh.geometry,original[index++].geometry);
        for(const attribute of ['position','normal','uv','facePosition'])for(const value of mesh.geometry.attributes[attribute].array)assert.ok(Number.isFinite(value));
        if(mesh.name==='Furred eyelids'){
          const p=mesh.geometry.attributes.position,face=mesh.geometry.attributes.facePosition;
          for(let i=0;i<p.count;i++)assert.ok(Math.abs(face.getY(i)*.116-p.getY(i)-eye.position.y)<1e-7);
        }
      }
    }
  }
  let index=0;
  for(const eye of eyes)for(const mesh of eye.children)assert.deepEqual(mesh.geometry.attributes.position.array,original[index++].position);
  const versions=eyes.flatMap(eye=>eye.children.map(mesh=>mesh.geometry.attributes.position.version));
  updateCatEyes(eyes);assert.deepEqual(eyes.flatMap(eye=>eye.children.map(mesh=>mesh.geometry.attributes.position.version)),versions);
});
