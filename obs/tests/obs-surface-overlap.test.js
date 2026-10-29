import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,ExtrudeGeometry,Group,Mesh,MeshStandardMaterial,Path,Shape,Vector3} from 'three';
import {coplanarSurfaces,describeFace} from './helpers/coplanar-surfaces.js';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {animateBathroom} from '../src/obs/bathroom.js';
import {animatePocketShutter} from '../src/obs/shutter.js';
import {createViewingWall,cabinWallMaterials} from '../src/obs/viewing-wall.js';
import {CABIN_AISLE} from '../src/obs/layout.js';
import {FLOOR_Y} from '../src/obs/ship.js';
import {VIEWING_WALL} from '../src/obs/viewing-wall-profile.js';

test('surface audit distinguishes coincident faces, butt joints and separated surfaces',()=>{
  const root=new Group(),geometry=new BoxGeometry(1,1,1),material=new MeshStandardMaterial();
  const a=new Mesh(geometry,material),b=a.clone();root.add(a,b);
  assert.equal(coplanarSurfaces([root]).length,6);
  b.position.x=.8;assert.equal(coplanarSurfaces([root]).length,4);
  b.position.x=1;assert.equal(coplanarSurfaces([root]).length,0,'touching edges/back-to-back joints are safe');
  b.position.set(1.01,0,0);assert.equal(coplanarSurfaces([root]).length,0);
  geometry.dispose();material.dispose();
});

test('surface audit respects actual polygons, including holes in extruded walls',()=>{
  const shape=new Shape();shape.moveTo(-2,-2).lineTo(2,-2).lineTo(2,2).lineTo(-2,2);shape.closePath();
  const hole=new Path();hole.moveTo(-1,-1).lineTo(-1,1).lineTo(1,1).lineTo(1,-1);hole.closePath();shape.holes.push(hole);
  const material=new MeshStandardMaterial(),wall=new Mesh(new ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}),material);
  const block=new Mesh(new BoxGeometry(.5,.5,1),material);block.position.z=.5;
  const root=new Group();root.add(wall,block);
  assert.equal(coplanarSurfaces([root]).length,0,'empty doorway is not a filled bounding box');
  block.position.x=1.5;assert.equal(coplanarSurfaces([root]).length,2,'front and back overlap the solid wall');
  wall.geometry.dispose();block.geometry.dispose();material.dispose();
});

test('unmerged cabin has no coincident planar surfaces, including open pocket doors',t=>{
  const ship=buildSurfaceFixture();t.after(()=>disposeSurfaceFixture(ship));
  const materials=cabinWallMaterials(ship.staticMesh),wall=createViewingWall(materials,{mergeStatic:false});
  const equipment=wall.getObjectByName('POV / near wall equipment');
  assert.ok(equipment?.children.length,'the actual ship supplies near-wall fixtures');
  assert.equal(wall.visible,false,'wall and its fixtures stay hidden in the cutaway');
  wall.visible=true;
  const reusedMaterials=new Set();ship.staticMesh.traverse(mesh=>{if(mesh.material)reusedMaterials.add(mesh.material);});
  for(const item of equipment.children){
    const bounds=new Box3().setFromObject(item),floor=Math.max(...FLOOR_Y.filter(y=>y<item.position.y));
    assert.ok(bounds.min.y>floor+.8,'leave low cat passage and footlights clear');
    assert.ok(bounds.min.z>CABIN_AISLE.crewZ+.55,'keep equipment out of the crew aisle');
    if(item.userData.wallMountZ!=null){
      const tubes=item.children.filter(child=>child.name==='Rear wall thin service pipe');
      assert.equal(tubes.length,4,'each wall bundle retains all four pipes');
      for(const tube of tubes){
        const vertices=tube.geometry.attributes.position,{tubularSegments,radialSegments}=tube.geometry.parameters;
        for(const ring of [0,tubularSegments]){
          const end=new Vector3(),adjacent=new Vector3(),next=ring===0?1:ring-1;
          for(let i=0;i<radialSegments;i++){
            const point=tube.localToWorld(new Vector3().fromBufferAttribute(vertices,ring*(radialSegments+1)+i));
            assert.ok(point.z>VIEWING_WALL.faceZ+.004,'both pipe openings must be entirely buried behind the lining');
            end.add(point);
            adjacent.add(tube.localToWorld(new Vector3().fromBufferAttribute(vertices,next*(radialSegments+1)+i)));
          }
          assert.ok(end.sub(adjacent).divideScalar(radialSegments).z>.005,'both ends turn toward the wall, not the cabin');
        }
      }
      for(const clamp of item.children.filter(child=>child.name==='Rear pipe clamp')){
        assert.ok(new Box3().setFromObject(clamp).max.z<VIEWING_WALL.faceZ-.004,'buried tails must not move the clamps off the wall');
      }
    }else assert.ok(bounds.max.z<VIEWING_WALL.faceZ-.004,'hardware is separated from the wall face');
    item.traverse(mesh=>{assert.ok(!mesh.isLight);if(mesh.material)assert.ok(reusedMaterials.has(mesh.material),'reuse existing cabin materials and textures');});
  }
  const roots=[ship.staticMesh,ship.animated,wall];
  for(const opening of [0,.16,.32,.6,1]){
    for(const fixture of Object.values(ship.bathrooms))animateBathroom(fixture,{opening,inside:opening===0});
    animatePocketShutter(ship.hatchDoor,opening);
    const overlaps=coplanarSurfaces(roots);
    assert.equal(overlaps.length,0,`opening ${opening}: ${JSON.stringify(overlaps.slice(0,5).map(({a,b})=>[describeFace(a),describeFace(b)]))}`);
  }
  // Blades orbit as a rigid rotor; they never stack into duplicate diameters.
  const positions=ship.fan.children.map(part=>part.position.clone());
  for(const angle of [0,.2,.7,Math.PI/2,Math.PI]){
    ship.fan.rotation.z=angle;
    assert.equal(coplanarSurfaces([ship.fan]).length,0);
    ship.fan.children.forEach((part,i)=>assert.ok(part.position.equals(positions[i])));
  }
});
