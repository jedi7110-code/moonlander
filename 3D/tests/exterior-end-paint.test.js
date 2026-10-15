import test from 'node:test';
import assert from 'node:assert/strict';
import {createExteriorMothership,EXTERIOR} from '../src/obs/exterior-mothership.js';

function checkEnd(group,material,x,uRange,vRange){
  let triangles=0;
  group.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material.name!==material)return;
    const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
    for(let i=0;i<p.count;i+=3){
      if(![0,1,2].every(j=>Math.abs(p.getX(i+j)-x)<1e-5))continue;
      triangles++;
      const a=i,b=i+1,c=i+2;
      const area=(uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getX(c)-uv.getX(a))*(uv.getY(b)-uv.getY(a));
      assert.ok(Math.abs(area)>1e-5,'end UV must have area, not collapse into side paint');
      for(let j=0;j<3;j++){
        assert.ok(uv.getX(i+j)>=uRange[0]-1e-6&&uv.getX(i+j)<=uRange[1]+1e-6);
        assert.ok(uv.getY(i+j)>=vRange[0]-1e-6&&uv.getY(i+j)<=vRange[1]+1e-6);
      }
    }
  });
  assert.equal(triangles,6,'the complete eight-sided face maps to its own sheet');
}
test('all six habitat ends use full two-dimensional hatch panel sheets',()=>{
  const ship=createExteriorMothership();
  try{for(const pod of ship.pods)for(const sign of [-1,1])checkEnd(pod,'Habitat service skin',sign*(EXTERIOR.podLength/2+1.8),[1,2],[0,2]);}
  finally{ship.dispose();}
});
test('bow and command end faces use separate atlas regions',()=>{
  const ship=createExteriorMothership();
  try{
    checkEnd(ship.core,'Aged Macintosh beige',17.3,[1,2],[0,1]);
    checkEnd(ship.core,'Aged Macintosh beige',15.6,[1,2],[1,2]);
  }finally{ship.dispose();}
});
