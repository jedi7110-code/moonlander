import {buildSurfaceFixture,disposeSurfaceFixture} from './cabin-surface-fixture.js';
import {coplanarSurfaces,describeFace} from './coplanar-surfaces.js';

const ship=buildSurfaceFixture();
const overlaps=coplanarSurfaces([ship.staticMesh,ship.animated]);
const groups=new Map();
for(const overlap of overlaps.sort((a,b)=>b.area-a.area)){
  const {a,b,point,area}=overlap,aa=describeFace(a),bb=describeFace(b);
  const key=JSON.stringify([a.axis,a.sign,aa.material,bb.material,aa.size,bb.size,aa.position.map((v,i)=>+(v-bb.position[i]).toFixed(4))]);
  if(!groups.has(key))groups.set(key,{n:0,axis:a.axis,sign:a.sign,point:point.toArray().map(v=>+v.toFixed(4)),area:+area.toFixed(6),a:aa,b:bb});
  groups.get(key).n++;
}
console.log('Total face overlaps:',overlaps.length,'Repeated patterns:',groups.size);
for(const group of groups.values())console.log(JSON.stringify(group));
disposeSurfaceFixture(ship);
