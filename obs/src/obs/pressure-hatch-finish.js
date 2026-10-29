import * as THREE from 'three';
import {box,cylinder,batchStatic} from './materials.js';

const finishes=new WeakMap();
const TILES={service:[0,0,512,128],warning:[512,0,512,128],release:[0,128,512,128],serial:[512,128,512,128]};

function printTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');
  const text=(value,x,y,size,color='#26302c')=>{ctx.fillStyle=color;ctx.font=`600 ${size}px monospace`;ctx.fillText(value,x,y);};
  text('DRIVE ACCESS',16,34,24);text('28 VDC / ISOLATE BEFORE SERVICE',16,64,16);text('CAPTIVE FASTENERS  /  M4',16,91,15);
  ctx.fillStyle='#9d813a';ctx.fillRect(528,12,8,96);
  text('CAUTION',550,36,26);text('KEEP CLEAR OF CLOSING EDGE',550,65,16);text('DO NOT OBSTRUCT GUIDE TRACK',550,92,16);
  text('MANUAL RELEASE',16,162,24,'#c8c7b8');text('ISOLATE DRIVE / TURN TO UNLOCK',16,189,15,'#c8c7b8');text('SERVICE PORT  /  HEX 04',16,215,15,'#c8c7b8');
  text('TARAIRON / PL-07',528,161,23);text('ACTUATOR / SEAL ASSEMBLY',528,190,15);text('S/N 07-2049-031  REV.02',528,214,15);
  // Small, shared direct-print artwork, not a separate sign or emissive screen.
  const map=new THREE.CanvasTexture(canvas);map.name='Pressure hatch / service stencil atlas';map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}

export function pressureHatchFinish(source){
  if(source&&finishes.has(source))return finishes.get(source);
  const material=(key,name,color,roughness,metalness)=>{
    const result=source?.[key]?.clone()??new THREE.MeshStandardMaterial({color,roughness,metalness});
    result.name=`Pressure hatch / ${name}`;return result;
  };
  const finish={
    paint:material('enamel','worn cabin ivory',0xd3d2c5,.91,.35),
    graphite:material('rubber','graphite seals',0x202621,.9,.04),
    metal:material('metal','brushed cabin steel',0xb5b0a0,.68,.82),
    red:material('red','muted safety oxide',0x963f32,.76,.25),
    glass:new THREE.MeshStandardMaterial({name:'Pressure hatch / narrow safety glass',color:0x476e76,roughness:.18,metalness:.12,transparent:true,opacity:.58,depthWrite:false,side:THREE.DoubleSide}),
  };
  finish.glass.userData.castShadow=false;
  finish.panel=finish.paint.clone();finish.panel.color.multiplyScalar(.92);finish.panel.name='Pressure hatch / removable service panels';
  finish.print=new THREE.MeshStandardMaterial({name:'Pressure hatch / direct service printing',map:printTexture(),color:0xffffff,transparent:true,depthWrite:false,roughness:.88,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  finish.print.userData={cabinKeepSurface:true,cabinNoOutline:true,castShadow:false};
  if(source)finishes.set(source,finish);return finish;
}

function stencil(root,material,tile,x,y,z,width,height,side){
  const geometry=new THREE.PlaneGeometry(width,height),uv=geometry.attributes.uv,[u,v,w,h]=TILES[tile];
  for(let i=0;i<uv.count;i++)uv.setXY(i,(u+uv.getX(i)*w)/1024,1-(v+(1-uv.getY(i))*h)/256);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,side*z);if(side<0)mesh.rotation.y=Math.PI;
  mesh.name='Direct stencil / '+tile;mesh.receiveShadow=true;root.add(mesh);
}

function fastener(root,m,x,y,z,side){
  const bolt=cylinder(root,m,x,y,side*z,.009,.006,.009,6);bolt.rotation.x=Math.PI/2;bolt.name='Captive panel fastener';
}

function panel(root,material,x,y,z,width,height,depth,side){
  const w=width/2,h=height/2,c=Math.min(.025,width*.08),shape=new THREE.Shape();
  shape.moveTo(-w+c,-h).lineTo(w-c,-h).lineTo(w,-h+c).lineTo(w,h-c).lineTo(w-c,h).lineTo(-w+c,h).lineTo(-w,h-c).lineTo(-w,-h+c).closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.translate(0,0,-depth/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,side*z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
}

// Bake repeated screws, seams and trim by material, separately for fixed walls
// and each moving leaf. Detail never adds a new animation or lighting pass.
function attachDetails(parent,detail,name){
  const baked=batchStatic(detail);baked.name=name;parent.add(baked);
  for(const part of baked.children)if(part.material.transparent){part.castShadow=false;part.renderOrder=1;}
}

export function finishPressureHatch(root,left,right,m,leafFace,cassette){
  const fixed=new THREE.Group();
  const extraWidth=(cassette.width-2.60)/2,extraHeight=cassette.height-2.26,cy=cassette.offsetY;
  for(const side of [-1,1]){
    for(const direction of [-1,1]){
      const x=direction*(.92+extraWidth/2),skinWidth=.58+extraWidth;
      // Gasket-backed removable cassette skins, with distinct access hatches.
      panel(fixed,m.graphite,x,cy,.171,skinWidth,1.98+extraHeight,.008,side);
      panel(fixed,m.panel,x,cy,.180,skinWidth-.02,1.96+extraHeight,.008,side);
      for(const yy of [-1,1])for(const dx of [-1,1])fastener(fixed,m.metal,x+dx*(skinWidth/2-.06),cy+yy*(.88+extraHeight/2),.189,side);
      panel(fixed,m.graphite,x,-.57,.188,.44+extraWidth*.6,.40,.006,side);
      panel(fixed,m.paint,x,-.57,.195,.42+extraWidth*.6,.38,.006,side);
      for(const yy of [-.70,-.44])for(const dx of [-1,1])fastener(fixed,m.metal,x+dx*(.16+extraWidth*.3),yy,.203,side);
      stencil(fixed,m.print,'service',x,.70+cy,.187,.44,.11,side);
      stencil(fixed,m.print,'serial',x,-.57,.201,.34,.085,side);
      for(const yy of [.44,.395,.35,.305])box(fixed,m.graphite,x,yy+cy,side*.187,.27+extraWidth*.65,.010,.002);
      // Folded longitudinal pressings give the tall panels readable relief.
      for(const dx of [-1,1])box(fixed,m.metal,x+dx*(.19+extraWidth*.35),-.005,side*.192,.014,.43,.012);
    }
    if(extraHeight>0){
      const y=1.13+extraHeight/2;
      panel(fixed,m.graphite,0,y,.171,1.03,extraHeight-.10,.008,side);
      panel(fixed,m.panel,0,y,.180,1.01,extraHeight-.12,.008,side);
      stencil(fixed,m.print,'service',-.16,y+.07,.187,.40,.10,side);
      for(const x of [-.43,.43])for(const dy of [-.12,.12])fastener(fixed,m.metal,x,y+dy,.189,side);
      for(const dy of [-.06,-.095,-.13])box(fixed,m.graphite,.11,y+dy,side*.187,.51,.009,.002);
    }
    for(const x of [-.573,.573]){
      for(const yy of [-.81,.81])box(fixed,m.red,x,yy,side*.183,.025,.19,.005);
      for(const yy of [-.57,.57])fastener(fixed,m.metal,x,yy,.185,side);
    }
    // Scuffed metal threshold, kept out of the clear passage.
    box(fixed,m.metal,0,-1.112,side*.176,.88,.018,.012);
  }
  attachDetails(root,fixed,'Fixed pocket finish');
  for(const [leaf,x]of [[left,-.29],[right,.32]]){
    const detail=new THREE.Group(),panelWidth=leaf===left?.36:.31;
    for(const side of [-1,1]){
      // Shallow pressed skins: the lock, glass and center seam remain exposed.
      for(const [y,height]of [[.78,.35],[-.66,.23]]){
        panel(detail,m.graphite,x,y,leafFace+.004,panelWidth,height,.004,side);
        panel(detail,m.panel,x,y,leafFace+.008,panelWidth-.014,height-.014,.003,side);
        for(const dx of [-1,1])fastener(detail,m.metal,x+dx*(panelWidth/2-.036),y,leafFace+.015,side);
      }
      stencil(detail,m.print,'warning',x,.78,leafFace+.012,panelWidth-.048,.078,side);
      box(detail,m.metal,x,-.92,side*(leafFace+.009),panelWidth,.16,.013);
      for(const dx of [-1,1])fastener(detail,m.graphite,x+dx*(panelWidth/2-.028),-.92,leafFace+.019,side);
      if(leaf===right){
        box(detail,m.graphite,.35,-.105,side*(leafFace+.007),.226,.126,.008);
        stencil(detail,m.print,'release',.35,-.105,leafFace+.013,.21,.09,side);
      }
    }
    attachDetails(leaf,detail,'Leaf surface finish');
  }
}
