import test from 'node:test';
import assert from 'node:assert/strict';
import {BackSide,Group,Matrix4,Object3D,PerspectiveCamera,Raycaster,Vector3} from 'three';
import {createCutawayStars,createRearWindowStars,createSpaceBackdrop,createSpaceStars} from '../src/obs/space-stars.js';
import {VIEWING_WALL,viewingWallPanelX} from '../src/obs/viewing-wall-profile.js';
import {FLOOR_Y} from '../src/obs/ship.js';

const renderer={getPixelRatio:()=>1.75};
const rear=()=>{
  const root=new Group(),window=new Object3D();
  window.position.set(-1.9,8.3,-4.2);window.userData.spaceWindow={width:1.2,height:1,cut:.1};root.add(window);
  return createRearWindowStars(root);
};

for(const [name,create,count,front]of [['passage',createSpaceStars,1900,true],['rear windows',rear,1900,false],['cutaway',createCutawayStars,420,false]]){
  test(`${name} stars retain their pattern and apparent sizes through camera translation`,()=>{
    const stars=create(),parent=new Group(),camera=new PerspectiveCamera(46,1.5,.025,150);
    parent.position.set(2,3,-1);parent.add(stars);parent.updateMatrixWorld(true);
    camera.rotation.y=front?Math.PI:0;
    const positions=stars.geometry.getAttribute('position'),weights=stars.geometry.getAttribute('starSize');
    assert.equal(positions.count,count,'keep the existing point budget');
    const capture=eye=>{
      camera.position.set(...eye);camera.updateMatrixWorld(true);stars.onBeforeRender(renderer,null,camera);
      return Array.from({length:positions.count},(_,i)=>{
        const world=stars.localToWorld(new Vector3().fromBufferAttribute(positions,i));
        const cameraSpace=world.clone().applyMatrix4(camera.matrixWorldInverse),screen=world.project(camera);
        return [screen.x,screen.y,weights.getX(i)/Math.abs(cameraSpace.z)];
      });
    };
    try{
      const baseline=capture([0,5,0]);
      // Walking, changing decks, dollying the cutaway, and separate XR eyes.
      for(const eye of [[-11,1.6,1.3],[11,8.4,-2],[0,6.35,85],[-.032,5,0],[.032,5,0]]){
        const moved=capture(eye);
        for(let i=0;i<count;i++)for(let k=0;k<3;k++)assert.ok(Math.abs(moved[i][k]-baseline[i][k])<1e-10,
          'translation must not shift individual stars or change their apparent size');
      }
      const radii=Array.from({length:count},(_,i)=>new Vector3().fromBufferAttribute(positions,i).length());
      assert.ok(Math.max(...radii)-Math.min(...radii)<.00001,'all points belong to one sky shell');
      camera.rotation.y+=.16;const turned=capture([0,5,0]);
      assert.ok(turned.some((point,i)=>Math.abs(point[0]-baseline[i][0])>.02),'the sky responds when the view rotates');
    }finally{stars.geometry.dispose();stars.material.dispose();}
  });
}

test('space backdrop follows each render eye and covers every angle without finite card edges',()=>{
  const sky=createSpaceBackdrop(),parent=new Group(),camera=new PerspectiveCamera(70,1.5,.025,150);
  parent.position.set(2,3,-1);parent.rotation.y=.3;parent.add(sky);parent.updateMatrixWorld(true);
  try{
    assert.equal(sky.material.side,BackSide);assert.equal(sky.material.depthWrite,false);
    assert.equal(sky.geometry.index.count/3,12,'the all-direction background only needs 12 triangles');
    assert.equal(sky.material.map,null);assert.equal(sky.frustumCulled,false);
    assert.ok(sky.renderOrder>0&&sky.renderOrder<1,'opaque cabin depth rejects hidden background pixels before stars');
    const shader={vertexShader:'#include <project_vertex>'};sky.material.onBeforeCompile(shader);
    assert.match(shader.vertexShader,/gl_Position.z = gl_Position.w \* 0.999999/,'sky cannot be clipped by the camera far plane');
    for(const eye of [[0,5,0],[-11,1.6,1.3],[11,8.4,-2],[-.032,5,0],[.032,5,0],[0,6.35,85]]){
      camera.position.set(...eye);camera.updateMatrixWorld(true);sky.onBeforeRender(renderer,null,camera);
      assert.ok(sky.getWorldPosition(new Vector3()).distanceTo(camera.position)<1e-10);
      for(let yaw=-180;yaw<=180;yaw+=10)for(const pitch of [-89,-65,0,65,89]){
        const y=yaw*Math.PI/180,p=pitch*Math.PI/180,direction=new Vector3(Math.sin(y)*Math.cos(p),Math.sin(p),Math.cos(y)*Math.cos(p));
        const hit=new Raycaster(camera.position,direction).intersectObject(sky)[0];
        assert.ok(hit&&hit.distance>=95.99,`uncovered direction ${yaw}, ${pitch}`);
      }
    }
  }finally{sky.geometry.dispose();sky.material.dispose();}
});

const corridorWindows=FLOOR_Y.flatMap(floor=>[2,5,8,11,14].map(i=>({x:viewingWallPanelX(i),y:floor+VIEWING_WALL.windowY,z:VIEWING_WALL.faceZ+.145,width:VIEWING_WALL.windowWidth,height:VIEWING_WALL.windowHeight,cut:.12})));

test('contiguous corridor sky submits only visible directions, without deleting stars at grazing/XR/mirror views',()=>{
  const stars=createSpaceStars({panoramic:true,windows:corridorWindows});
  const before=createSpaceStars({panoramic:true,windows:corridorWindows,optimizeWindows:false});
  const positions=stars.geometry.attributes.position,buffer=positions.array;
  const ray=new Vector3(),adjusted=new Vector3(),target=new Vector3(),reflection=new Matrix4().makeScale(-1,1,1);
  try{
    const catalogue=field=>Array.from({length:6000},(_,i)=>['position','color','starSize'].flatMap(name=>{
      const attribute=field.geometry.attributes[name];return Array.from(attribute.array.slice(i*attribute.itemSize,(i+1)*attribute.itemSize));
    }).join(',')).sort();
    assert.deepEqual(catalogue(stars),catalogue(before),'keep every star and its brightness unchanged');
    assert.equal(stars.geometry.index,null,'contiguous point reads need no random index fetch');
    for(const aspect of [.7,2.5])for(const fov of [28,70,100])for(const pitch of [-75,0,75])for(const yaw of [-180,-120,-85,-65,-52,0,52,65,85,120,180])for(const rear of [false,true]){
      const camera=new PerspectiveCamera(fov,aspect,.025,150),p=pitch*Math.PI/180,y=yaw*Math.PI/180;
      camera.position.set(-.032,5,rear?4:.78);target.set(Math.sin(y)*Math.cos(p),Math.sin(p),Math.cos(y)*Math.cos(p)).add(camera.position);camera.lookAt(target);
      camera.setViewOffset(1000,1000,30,0,970,1000);camera.updateMatrixWorld(true);
      if(yaw<0){camera.matrixWorld.premultiply(reflection);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();}
      stars.onBeforeRender(renderer,null,camera);
      const {start,count}=stars.geometry.drawRange;
      const projection=camera.projectionMatrix.elements,scale=Math.min(1,1.428148/Math.abs(projection[5]));
      if(scale>=.999999)assert.ok(count<3100,'normal POV never submits the invisible hemisphere');
      else assert.equal(count,6000,'narrow/cropped projections preserve warped stars across hemispheres');
      if(pitch===0&&fov===70&&((yaw===180&&!rear)||(yaw===0&&rear)))assert.equal(count,0,'looking away from the corridor sends no stars');
      for(let i=0;i<positions.count;i++){
        ray.fromBufferAttribute(positions,i).transformDirection(camera.matrixWorldInverse);
        if(ray.z>=0)continue;
        adjusted.copy(ray);adjusted.x*=scale;adjusted.y*=scale;adjusted.transformDirection(camera.matrixWorld);
        if((adjusted.z>=0)===rear)continue;
        const x=projection[0]*ray.x*scale/-ray.z-projection[8],v=projection[5]*ray.y*scale/-ray.z-projection[9];
        if(Math.abs(x)<=1&&Math.abs(v)<=1)assert.ok(i>=start&&i<start+count,`missing star ${i}, yaw ${yaw}, pitch ${pitch}, FOV ${fov}, aspect ${aspect}, outside ${rear}`);
      }
    }
    assert.equal(positions.array,buffer,'camera changes never reallocate/upload the star buffers');
  }finally{for(const field of [stars,before]){field.geometry.dispose();field.material.dispose();}}
});

test('regular corridor windows share a single ray-plane test; irregular rear windows retain their masks',()=>{
  for(const [windows,optimize,count]of [[corridorWindows,true,1],[corridorWindows,false,15],[[corridorWindows[0],{...corridorWindows[1],z:-4}],true,2]]){
    const stars=createSpaceStars({panoramic:true,windows,optimizeWindows:optimize}),shader={uniforms:{},vertexShader:'#include <common>\n#include <project_vertex>\n#include <logdepthbuf_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
    try{stars.material.onBeforeCompile(shader);assert.equal((shader.vertexShader.match(/float t =/g)??[]).length,count);}
    finally{stars.geometry.dispose();stars.material.dispose();}
  }
});

test('panoramic corridor stars cover grazing views while keeping the same pattern through translation',()=>{
  const stars=createSpaceStars({panoramic:true}),positions=stars.geometry.getAttribute('position'),camera=new PerspectiveCamera();
  try{
    assert.equal(positions.count,6000,'one point draw, with no extra textures');
    for(let yaw=-180;yaw<180;yaw+=15)for(const pitch of [-70,0,70]){
      const y=yaw*Math.PI/180,p=pitch*Math.PI/180,direction=new Vector3(Math.sin(y)*Math.cos(p),Math.sin(p),Math.cos(y)*Math.cos(p));
      let count=0;
      for(let i=0;i<positions.count;i++)if(new Vector3().fromBufferAttribute(positions,i).normalize().dot(direction)>Math.cos(Math.PI/12))count++;
      assert.ok(count>60,`empty patch near ${yaw}, ${pitch}: ${count} stars`);
    }
    for(const eye of [[0,5,0],[11,8,-2],[-11,1.6,2.2]]){
      camera.position.set(...eye);camera.updateMatrixWorld(true);stars.onBeforeRender(renderer,null,camera);
      for(let i=0;i<positions.count;i++){
        const local=new Vector3().fromBufferAttribute(positions,i),direction=stars.localToWorld(local.clone()).sub(camera.position);
        assert.ok(direction.distanceTo(local)<1e-10,'walking cannot move stars relative to one another');
      }
    }
  }finally{stars.geometry.dispose();stars.material.dispose();}
});
