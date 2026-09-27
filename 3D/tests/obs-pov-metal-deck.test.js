import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Box3,Vector3,Raycaster,MeshStandardMaterial} from 'three';
import {createMetalDeckStyle,metalDeckPlan,DECK_TONES} from '../studies/pov/metal-deck.js';
import {addIndustrialDeck} from '../src/obs/industrial.js';

test('metal grilles are recessed, with flush frames and an unobstructed ladder well',()=>{
  const style=createMetalDeckStyle(),material=new MeshStandardMaterial(),m={dark:material};
  for(const level of [0,1,2]){
    const floor=style.buildFloor(m,level*3.392,level),y=level*3.392;floor.updateMatrixWorld(true);
    const hit=(x,z)=>new Raycaster(new Vector3(x,y+1,z),new Vector3(0,-1,0)).intersectObject(floor,true)[0];
    assert.ok(Math.abs(hit(2,-.5).point.y-y)<1e-6,'panel top stays at the original walking height');
    assert.ok(Math.abs(hit(0,1.5).point.y-y)<1e-6,'forward crossing remains solid');
    if(level!==2)assert.equal(hit(0,0),undefined,'do not cap the ladder well');
    const tile=metalDeckPlan(level).find(t=>t.grate);
    for(const end of [-1,1]){
      const z=tile.z+end*tile.d/4;
      const hole=hit(tile.x+.03,z+.055);
      assert.ok(hole.point.y<y-.05,'both openings reveal the tray below, not a flat painted grille');
      const bar=hit(tile.x,z+.055);assert.ok(Math.abs(bar.point.y-(y-.002))<1e-6);
    }
    assert.ok(Math.abs(hit(tile.x,tile.z).point.y-y)<1e-6,'solid panel separates the front and rear grilles');
    const trays=floor.children.filter(mesh=>mesh.name==='Recessed grille tray');
    assert.equal(trays.length,metalDeckPlan(level).filter(tile=>tile.grate).length*2);
    for(const tray of trays){
      const size=new Box3().setFromObject(tray).getSize(new Vector3());
      assert.ok(Math.abs(size.x-1.08/3)<1e-6&&Math.abs(size.z-1.32/3)<1e-6,'grille width and depth are one third of the original');
    }
    floor.traverse(mesh=>{if(mesh.name==='Recess frame'||mesh.name==='Grille bearing bar')assert.ok(new Box3().setFromObject(mesh).max.y<=y+.000001,'no raised loose bars');});
    const panel=floor.children.find(mesh=>mesh.name==='Solid service plate');
    style.setTone('brown');assert.equal(panel.material.color.getHex(),DECK_TONES.brown.panel);
    style.setTone('grey');assert.equal(panel.material.color.getHex(),DECK_TONES.grey.panel);
    floor.traverse(mesh=>mesh.geometry?.dispose());
  }
  material.dispose();
});

test('a custom floor replaces the old exposed edge bars instead of drawing two floors together',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  for(const floorDetails of [true,false]){
    const root=new Group();addIndustrialDeck(root,m,0,0,{floorDetails});
    const edgeBars=root.children.filter(mesh=>mesh.position.y===.009&&mesh.position.z===2.19);
    assert.equal(edgeBars.length,floorDetails?114:0);
    root.traverse(mesh=>mesh.geometry?.dispose());
  }
  material.dispose();
});
