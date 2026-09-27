import {Group,CanvasTexture,MeshStandardMaterial,RepeatWrapping,SRGBColorSpace} from 'three';
import {box,cylinder} from './materials.js';
import {CABIN_AISLE} from './layout.js';
import {addFootlightWash} from './viewing-footlights.js';

export const DECK_TONES={
  grey:{panel:0x505655,frame:0x6a7371,grille:0x35403f},
  brown:{panel:0x342d27,frame:0x514940,grille:0x28251f},
};

// Square service plates, with actual recesses. Neither the stairwell nor the
// forward bridge changes position; the walking surface stays at authored y=0.
export function metalDeckPlan(level){
  const tiles=[],left=.565,right=12.88,back=CABIN_AISLE.deckBack,front=CABIN_AISLE.deckFront;
  const width=(right-left)/8,split=.38;
  for(const side of [-1,1])for(let i=0;i<8;i++)for(const [row,z0,z1]of [[0,back,split],[1,split,front]]){
    tiles.push({x:side*(left+(i+.5)*width),z:(z0+z1)/2,w:width-.014,d:z1-z0-.014,grate:row===1&&i%2===0});
  }
  const bridgeBack=level===2?back:.94;
  tiles.push({x:0,z:(bridgeBack+front)/2,w:1.12,d:front-bridgeBack-.014,grate:false});
  return tiles;
}

function finishTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#d4d6d3';ctx.fillRect(0,0,512,512);
  let seed=3817;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Fine shot-blasted metal, with no directional grain or long plank streaks.
  for(let i=0;i<16000;i++){
    const shade=150+Math.floor(random()*90);ctx.fillStyle=`rgba(${shade},${shade},${shade},.12)`;
    ctx.fillRect(random()*512,random()*512,1,1);
  }
  for(let i=0;i<40;i++){
    const x=random()*512,z=random()*512;ctx.strokeStyle='#ffffff10';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,z);ctx.lineTo(x+random()*5-2.5,z+random()*5-2.5);ctx.stroke();
  }
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.wrapS=texture.wrapT=RepeatWrapping;texture.anisotropy=4;return texture;
}

export function createMetalDeckStyle({tone='brown'}={}){
  const texture=finishTexture(),materials={},footlights={value:0};
  for(const [id,roughness,metalness]of [['panel',.82,.48],['frame',.66,.62],['grille',.77,.62]]){
    const material=new MeshStandardMaterial({name:`POV metal deck / ${id}`,map:texture,roughness,metalness,envMapIntensity:.38});
    material.userData.cabinKeepSurface=true;materials[id]=material;
    addFootlightWash(material,footlights);
  }
  const backing=new MeshStandardMaterial({name:'POV metal deck / recessed backing',color:0x0b1113,roughness:1,metalness:0});
  backing.userData.cabinKeepSurface=true;
  function setTone(id){const palette=DECK_TONES[id]??DECK_TONES.grey;for(const key of Object.keys(materials))materials[key].color.setHex(palette[key]);}
  setTone(tone);
  function buildFloor(m,y,level){
    const root=new Group();root.name=`Inset metal deck ${level}`;
    const {deckBack:back,deckFront:front}=CABIN_AISLE,depth=front-back;
    const plate=(name,material,x,z,w,d,top=0,thickness=.04)=>{
      const mesh=box(root,material,x,y+top-thickness/2,z,w,thickness,d);mesh.name=name;return mesh;
    };
    for(const side of [-1,1])plate('Deck structure',m.dark,side*6.73,(back+front)/2,12.37,depth,-.09,.24);
    const bridgeBack=level===2?back:.94;
    plate('Bridge structure',m.dark,0,(front+bridgeBack)/2,1.12,front-bridgeBack,-.09,.24);
    plate('Deck front fascia',m.dark,0,front-.01,26.22,.20,-.025,.305);
    for(const tile of metalDeckPlan(level)){
      const{x,z,w,d,grate}=tile;
      if(!grate){plate('Solid service plate',materials.panel,x,z,w,d);continue;}
      const gw=1.08/3,gd=1.32/3,border=.065/3,fw=gw+border*2,fd=gd+border*2;
      // Two small inset grilles share one panel, with solid metal between them.
      for(const end of [-1,1]){
        const gz=z+end*d/4,sectionDepth=d/2;
        for(const side of [-1,1]){
          plate('Grille surround',materials.panel,x+side*(w+fw)/4,gz,(w-fw)/2,sectionDepth);
          plate('Grille surround',materials.panel,x,gz+side*(sectionDepth+fd)/4,fw,(sectionDepth-fd)/2);
          plate('Recess frame',materials.frame,x+side*(gw+border)/2,gz,border,fd);
          plate('Recess frame',materials.frame,x,gz+side*(gd+border)/2,gw,border);
        }
        plate('Recessed grille tray',backing,x,gz,gw,gd,-.072,.008);
        // Keep the mesh spacing readable instead of miniaturizing every bar.
        for(let i=0;i<=6;i++)plate('Grille bearing bar',materials.grille,x-gw/2+i*gw/6,gz,.014,gd,-.002,.022);
        for(let i=0;i<=4;i++)plate('Grille cross tie',materials.grille,x,gz-gd/2+i*gd/4,gw,.012,-.016,.016);
        for(const sx of [-1,1])for(const sz of [-1,1]){
          const bolt=cylinder(root,materials.frame,x+sx*(gw+border)/2,y-.001,gz+sz*(gd+border)/2,.006,.004,.006,6);bolt.name='Flush grille fastener';
        }
      }
    }
    return root;
  }
  return{buildFloor,setTone,setFootlightsVisible:visible=>{footlights.value=Number(visible);}};
}
