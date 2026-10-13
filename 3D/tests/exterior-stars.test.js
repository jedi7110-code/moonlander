import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,ZeroFactor} from 'three';
import {createDistantStars} from '../src/obs/exterior-stars.js';
import {createStarCatalog,skyHazeColor,STAR_COUNT} from '../public/assets/obs/exterior-star-catalog.js';

test('star directions stay identical during camera translations and dolly zoom instead of acquiring nearby parallax',()=>{
  const stars=createDistantStars(),camera=new PerspectiveCamera(38,1,.1,2400),position=stars.field.geometry.attributes.position;
  const project=()=>{
    camera.updateMatrixWorld(true);stars.follow(camera);stars.field.updateMatrixWorld(true);
    return Array.from({length:30},(_,i)=>stars.field.localToWorld(new Vector3().fromBufferAttribute(position,i)).project(camera));
  };
  try{
    const initial=project();
    for(const eye of [new Vector3(260,30,-60),new Vector3(-80,-140,500),new Vector3(3600,40,20)]){
      camera.position.copy(eye);const moved=project();
      moved.forEach((p,i)=>assert.ok(p.distanceTo(initial[i])<1e-8,'moving the camera must not shift a star direction'));
      assert.ok(stars.haze.position.distanceTo(camera.position)<1e-10,'the diffuse sky is also infinitely distant');
    }
    assert.equal(stars.field.material.sizeAttenuation,false);
    assert.equal(stars.field.material.depthWrite,false);
    camera.rotation.y=.3;const turned=project();assert.ok(turned.some((p,i)=>p.distanceTo(initial[i])>.01),'changing the viewing direction still moves the sky naturally');
  }finally{stars.dispose();}
});

test('photographic star density combines many faint pinpoints with only a few bright stars',()=>{
  const catalog=createStarCatalog();assert.equal(catalog.length,STAR_COUNT);
  const faint=catalog.filter(star=>star.brightness<.20),bright=catalog.filter(star=>star.brightness>=.8);
  assert.ok(faint.length/catalog.length>.85,'fine faint stars dominate');
  assert.ok(bright.length/catalog.length<.01&&bright.length>100,'large bright stars remain rare');
  const camera=new PerspectiveCamera(42,16/9,.1,2400);camera.lookAt(new Vector3(-.71,-.70,-.079));camera.updateMatrixWorld(true);
  let visible=0;
  for(const star of catalog){
    assert.ok(Math.abs(Math.hypot(...star.p)-1)<1e-12,'catalogue coordinates are directions, not a volume of particles');
    const point=new Vector3(...star.p).multiplyScalar(1200).project(camera);
    if(point.z>=-1&&point.z<=1&&Math.abs(point.x)<1&&Math.abs(point.y)<.84)visible++;
  }
  assert.ok(visible>1800,'the introductory frame has thousands of small stars rather than a few dozen');
  assert.deepEqual(createStarCatalog({count:80,seed:123}),createStarCatalog({count:80,seed:123}));
});

test('the loading catalogue matches the Three.js field and stars cannot paint over the ship or planet',()=>{
  const stars=createDistantStars({count:80,seed:123}),catalog=createStarCatalog({count:80,seed:123});
  try{
    const position=stars.field.geometry.attributes.position,color=stars.field.geometry.attributes.color,size=stars.field.geometry.attributes.starSize;
    assert.equal(size.itemSize,1);assert.equal(size.count,catalog.length,'the GPU must receive one size per star');
    catalog.forEach((star,index)=>{
      assert.ok(new Vector3().fromBufferAttribute(position,index).distanceTo(new Vector3(...star.p).multiplyScalar(1200))<.0001);
      for(let channel=0;channel<3;channel++)assert.ok(Math.abs(color.array[index*3+channel]-star.color[channel])<1e-6);
      assert.ok(Math.abs(size.array[index]-star.size)<1e-6);
    });
    assert.ok(stars.haze.renderOrder<stars.field.renderOrder&&stars.field.renderOrder<0);
    assert.equal(stars.field.material.transparent,false);assert.equal(stars.haze.material.transparent,false);
    assert.equal(stars.haze.material.opacity,0,'the cinema keeps the background outside the ship exposure grade');
    assert.equal(stars.field.material.blendSrcAlpha,ZeroFactor);
  }finally{stars.dispose();}
  const colors=[[1,0,0],[0,1,0],[0,0,1],[-.71,-.70,-.079]].map(p=>skyHazeColor(new Vector3(...p).normalize().toArray()));
  assert.ok(colors.every(color=>color.every(value=>value>=0&&value<.04)),'haze stays faint and blue-black');
  assert.ok(colors.every(color=>color[2]>color[0]));
});
