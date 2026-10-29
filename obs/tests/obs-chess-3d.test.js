import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Chess} from 'chess.js';
import {createChessPieceGeometry,chessSquarePosition,chessSquareAt,chessGridMatrix} from '../src/obs/chess-geometry.js';
import {createChessOrbit} from '../src/obs/chess-camera.js';

test('all six chess pieces have solid depth, finite normals and supported bases inside their squares',()=>{
  const heights={};
  for(const type of 'prnbqk'){
    const geometry=createChessPieceGeometry(type),box=geometry.boundingBox,size=box.getSize(new THREE.Vector3());
    try{
      assert.ok(size.x>.3&&size.z>.25,'pieces have volume in both horizontal axes');
      assert.ok(size.x<.8&&size.z<1.05,'each piece fits its board spacing');
      assert.ok(box.min.y>=0&&box.min.y<.04,'the base rests immediately over the projector surface');
      assert.ok(box.max.y<1.7,'crowns fit the camera envelope');
      for(const name of ['position','normal'])assert.ok(geometry.attributes[name].array.every(Number.isFinite));
      heights[type]=box.max.y;
      if(type==='n')assert.ok(size.z>size.x*1.2,'the horse has a projecting muzzle and sculpted neck');
    }finally{geometry.dispose();}
  }
  assert.ok(heights.k>heights.q&&heights.q>heights.p&&heights.r>heights.p);
});
test('the bishop notch and the rook battlement gaps are real open geometry',()=>{
  const bishop=createChessPieceGeometry('b'),rook=createChessPieceGeometry('r'),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  try{
    const b=new THREE.Mesh(bishop,material),r=new THREE.Mesh(rook,material);
    const bishopRay=new THREE.Raycaster(new THREE.Vector3(0,1.12,1),new THREE.Vector3(0,0,-1));
    assert.equal(bishopRay.intersectObject(b).length,0,'light passes through the diagonal bishop notch');
    bishopRay.ray.origin.y=1.01;assert.ok(bishopRay.intersectObject(b).length>0,'the lower mitre remains solid');
    const gap=new THREE.Vector3(.5,0,Math.sqrt(3)/2);
    const rookRay=new THREE.Raycaster(gap.clone().multiplyScalar(2).setY(1.045),gap.clone().negate());
    assert.equal(rookRay.intersectObject(r).length,0,'battlement gaps extend through the crown');
    rookRay.ray.origin.set(0,1.045,2);rookRay.ray.direction.set(0,0,-1);
    assert.ok(rookRay.intersectObject(r).length>0,'the neighboring merlon is a solid volume');
  }finally{bishop.dispose();rook.dispose();material.dispose();}
});
test('ray square picking and the accessible focus grid agree with the same perspective at every square and orientation',()=>{
  const camera=new THREE.PerspectiveCamera(34,1,1,100);camera.position.set(3,19,13);camera.lookAt(0,.3,0);camera.updateMatrixWorld(true);
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),ray=new THREE.Raycaster(),hit=new THREE.Vector3();
  for(const [width,height]of [[640,620],[328,318],[900,520]])for(const flipped of [false,true]){
    camera.aspect=width/height;camera.updateProjectionMatrix();
    const matrix=new THREE.Matrix4().fromArray(chessGridMatrix(camera,width,height));
    for(let row=0;row<8;row++)for(let col=0;col<8;col++){
      const square='abcdefgh'[flipped?7-col:col]+(flipped?row+1:8-row);
      const world=chessSquarePosition(square);if(flipped)world.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
      const projected=world.clone().project(camera),css=new THREE.Vector3((col+.5)*100,(row+.5)*100,0).applyMatrix4(matrix);
      assert.ok(Math.abs(css.x-(projected.x+1)*width/2)<1e-8);
      assert.ok(Math.abs(css.y-(1-projected.y)*height/2)<1e-8);
      ray.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);ray.ray.intersectPlane(plane,hit);
      assert.equal(chessSquareAt(hit,flipped),square);
    }
  }
  assert.equal(chessSquareAt(new THREE.Vector3(4.1,0,0)),null);
  const game=new Chess();assert.equal(game.board().flat().filter(Boolean).length,32);
  assert.ok(game.board().flat().filter(Boolean).every(piece=>/^[a-h][1-8]$/.test(piece.square)));
});

test('drag limits keep the camera in the player half and above the board, while wheel zoom stops at its limits',()=>{
  const listeners=new Map(),canvas={style:{},addEventListener(name,handler){listeners.set(name,handler);},removeEventListener(name){listeners.delete(name);}};
  const camera=new THREE.PerspectiveCamera(34,1,.1,200),target=new THREE.Vector3(0,.3,0);camera.position.set(3,19,13);
  const controls=createChessOrbit(camera,canvas,target);
  try{
    for(const azimuth of [-Math.PI,-2,-1,0,1,2,Math.PI])for(const polar of [.01,.6,1.4,3]){
      camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(20,polar,azimuth));controls.update();
      assert.ok(camera.position.z>=-1e-8,'the camera never enters the opponent half');
      const angle=new THREE.Spherical().setFromVector3(camera.position.clone().sub(target)).phi;
      assert.ok(angle>=THREE.MathUtils.degToRad(15)-1e-8&&angle<=THREE.MathUtils.degToRad(74)+1e-8);
    }
    controls.minDistance=8;controls.maxDistance=30;
    const wheel=deltaY=>listeners.get('wheel')({deltaY,preventDefault(){}});
    for(let i=0;i<80;i++)wheel(-100);
    assert.ok(Math.abs(camera.position.distanceTo(target)-8)<1e-8,'zoom reaches its close limit');
    for(let i=0;i<100;i++)wheel(100);
    assert.ok(Math.abs(camera.position.distanceTo(target)-30)<1e-8,'zoom reaches its far limit');
  }finally{controls.dispose();}
  assert.equal(listeners.size,0,'closing the board releases the gesture listeners');
});

test('all squares remain pickable and keyboard outlines remain aligned across orbit and zoom angles',()=>{
  const camera=new THREE.PerspectiveCamera(34,640/620,.1,200),target=new THREE.Vector3(0,.3,0);
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),ray=new THREE.Raycaster(),hit=new THREE.Vector3();
  for(const azimuth of [-Math.PI/2,-.8,0,.8,Math.PI/2])for(const polar of [15,45,74])for(const radius of [10,22,36])for(const flipped of [false,true]){
    camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(radius,THREE.MathUtils.degToRad(polar),azimuth));
    camera.lookAt(target);camera.updateMatrixWorld(true);
    const matrix=new THREE.Matrix4().fromArray(chessGridMatrix(camera,640,620));
    for(let row=0;row<8;row++)for(let col=0;col<8;col++){
      const square='abcdefgh'[flipped?7-col:col]+(flipped?row+1:8-row),world=chessSquarePosition(square);
      if(flipped)world.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
      const projected=world.clone().project(camera),css=new THREE.Vector3((col+.5)*100,(row+.5)*100,0).applyMatrix4(matrix);
      assert.ok(Math.abs(css.x-(projected.x+1)*320)<1e-7&&Math.abs(css.y-(1-projected.y)*310)<1e-7);
      ray.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);assert.ok(ray.ray.intersectPlane(plane,hit));
      assert.equal(chessSquareAt(hit,flipped),square);
    }
  }
});
