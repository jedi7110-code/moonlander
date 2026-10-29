import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createWallControlMaterials,createWallControlPanel} from '../src/obs/wall-control-panel.js';
import {createWallSwitchMaterials,createWallSwitchPanel,WALL_SWITCH_PANELS} from '../src/obs/wall-switch-panels.js';
import {addViewingWallDetails} from '../src/obs/viewing-wall-details.js';

const SWITCH_SPECS=[...WALL_SWITCH_PANELS,
  {w:.44,h:.70,style:0},{w:.70,h:.40,style:1},{w:.32,h:.65,style:2},
];

test('wall panel artwork replaces solid front caps, including behind raised controls',()=>{
  const examples=[{root:createWallControlPanel(createWallControlMaterials(),.62),w:.62,h:1.09},
    ...SWITCH_SPECS.map(spec=>({root:createWallSwitchPanel(createWallSwitchMaterials(),spec),w:spec.w,h:spec.h}))];
  const ray=new Raycaster(new Vector3(),new Vector3(0,0,-1));
  for(const {root,w,h} of examples){
    root.updateMatrixWorld(true);
    for(let row=0;row<37;row++)for(let col=0;col<29;col++){
      ray.ray.origin.set(((col+.37)/29-.5)*w*.88,((row+.23)/37-.5)*h*.88,1);
      const front=ray.intersectObject(root,true).filter(hit=>hit.face.normal.z>.999);
      assert.equal(front.length,1,`${root.name} at ${ray.ray.origin.toArray()}: ${front.length} layered front faces`);
    }
  }
});

test('installed and sample switch faces keep equal artwork scale on both axes',()=>{
  const materials=createWallSwitchMaterials();
  for(const spec of SWITCH_SPECS){
    const root=createWallSwitchPanel(materials,spec);
    for(const mesh of root.children.filter(child=>child.material===materials.face)){
      const {position,uv}=mesh.geometry.attributes;
      const span=(attribute,axis)=>{
        const values=Array.from({length:attribute.count},(_,i)=>axis?attribute.getY(i):attribute.getX(i));
        return Math.max(...values)-Math.min(...values);
      };
      const width=span(position,0),height=span(position,1);
      const scaleX=width/span(uv,0),scaleY=height/span(uv,1);
      assert.ok(Math.abs(scaleX/scaleY-1)<.00001,`distorted artwork: ${JSON.stringify(spec)} / ${mesh.name}`);
      if(mesh.name==='Switch cap face'){
        const aspect=spec.style===1?1.6:1;
        assert.ok(Math.abs(height/width-aspect)<.00001,'switch caps retain their physical shape');
      }
    }
  }
});

test('navigation monitor has one face at each control, and its globe artwork keeps equal pixel scale',()=>{
  const metal=new MeshBasicMaterial(),parent=new Group();
  const details=addViewingWallDetails(parent,{enamel:metal,dark:metal,metal,rubber:metal},[6.784,3.392,0],metal);
  const monitor=details.children.find(child=>child.name.endsWith('/ monitor'));
  monitor.position.set(0,0,0);monitor.rotation.set(0,0,0);monitor.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(),new Vector3(0,0,-1));
  for(let row=0;row<37;row++)for(let col=0;col<41;col++){
    ray.ray.origin.set(((col+.37)/41-.5)*.94,((row+.23)/37-.5)*.58,1);
    const front=ray.intersectObject(monitor,true).filter(hit=>hit.face.normal.z>.999);
    assert.equal(front.length,1,`monitor front surfaces overlap at ${ray.ray.origin.toArray()}`);
  }
  for(const mesh of monitor.children.filter(child=>child.name==='Navigation monitor face')){
    const {position,uv}=mesh.geometry.attributes;
    const span=(a,axis)=>{
      const values=Array.from({length:a.count},(_,i)=>axis?a.getY(i):a.getX(i));
      return Math.max(...values)-Math.min(...values);
    };
    const pixelX=span(position,0)/(span(uv,0)*640),pixelY=span(position,1)/(span(uv,1)*400);
    assert.ok(Math.abs(pixelX/pixelY-1)<.00001,'the blue globe must not be squeezed or stretched');
  }
  const geometries=new Set(),materials=new Set();
  details.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>{material.map?.dispose();material.dispose();});
});
