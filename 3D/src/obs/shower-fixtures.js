import * as THREE from 'three';
import {box,cylinder} from './materials.js';

export function createShowerFixtures(m){
  const root=new THREE.Group();root.name='Ceiling rain shower and toiletries';
  // The supply enters the ceiling; there is no exposed wall hose.
  box(root,m.metal,0,2.478,-2.8,.12,.030,.12).name='Shower ceiling mount';
  cylinder(root,m.metal,0,2.437,-2.8,.022,.070,.022,8);
  box(root,m.metal,0,2.393,-2.8,.58,.028,.58).name='Square rainfall shower head';
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#a9b3b2';ctx.fillRect(0,0,128,128);
  ctx.fillStyle='#646e6d';ctx.fillRect(5,5,118,118);ctx.fillStyle='#a9b3b2';ctx.fillRect(7,7,114,114);
  ctx.fillStyle='#202c2c';
  for(let row=0;row<9;row++)for(let column=0;column<9;column++){
    ctx.beginPath();ctx.arc(16+column*12,16+row*12,1.8,0,Math.PI*2);ctx.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(.56,.56),new THREE.MeshStandardMaterial({name:'Rain shower nozzle face',map:texture,roughness:.48,metalness:.65}));
  // Keep a real 3 mm offset from the head underside (y=2.379), never coplanar.
  face.name='Rainfall nozzle underside';face.rotation.x=Math.PI/2;face.position.set(0,2.376,-2.8);root.add(face);

  // One shallow shelf along the right wall, behind the standing position.
  box(root,m.metal,.646,1.265,-3.20,.256,.030,.62).name='Shower single wall shelf';
  for(const z of [-3.42,-2.98])box(root,m.dark,.755,1.195,z,.032,.11,.045);
  const profile=[[0,0],[.040,0],[.052,.012],[.052,.182],[.027,.213],[.021,.225],[0,.225]];
  const bottleGeometry=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),8);
  for(const [i,z] of [-3.34,-3.10].entries()){
    const bottle=new THREE.Group();bottle.name=`Shampoo bottle ${i+1}`;bottle.position.set(.65,1.280,z);root.add(bottle);
    const body=new THREE.Mesh(bottleGeometry,i===0?m.white:m.teal);body.scale.z=.8;body.castShadow=true;body.receiveShadow=true;bottle.add(body);
    cylinder(bottle,m.dark,0,.227,0,.026,.030,.026,8);
    cylinder(bottle,m.metal,0,.251,0,.009,.026,.009,6);
    box(bottle,m.dark,0,.265,.018,.033,.013,.069);
    // Small paper label stands clear of the bottle's faceted front.
    box(bottle,i===0?m.teal:m.white,0,.105,.043,.049,.072,.002);
  }
  return root;
}
