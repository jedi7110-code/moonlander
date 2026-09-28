import * as THREE from 'three';
import {openPanelBox,panelFaceGeometry} from './panel-surfaces.js';
import {DECK} from './layout.js';

// Coordinates are the mounting face of fixed wall lining, outside door travel.
export const WALL_SWITCH_PANELS=[
  {name:'Console auxiliary',deck:DECK.OPERATIONS,x:-5.74,y:2.23,z:-1.605,w:.60,h:.35,style:1},
  {name:'Operations doorway',deck:DECK.OPERATIONS,x:-3.63,y:1.90,z:-1.605,w:.30,h:.58,style:2},
  {name:'Medical lighting',deck:DECK.OPERATIONS,x:1.06,y:2.22,z:-1.605,w:.42,h:.40,style:0},
  {name:'Bunk entrance',deck:DECK.HABITATION,x:-6.00,y:1.45,z:-1.869,w:.32,h:.58,style:2},
  {name:'Lounge lighting',deck:DECK.HABITATION,x:5.45,y:1.63,z:-1.605,w:.52,h:.52,style:0},
  {name:'Engine services',deck:DECK.LIFE_SUPPORT,x:7.47,y:1.56,z:-1.869,w:.40,h:.62,style:0},
  {name:'Cargo lighting',deck:DECK.LIFE_SUPPORT,x:10.75,y:2.05,z:-1.605,w:.38,h:.58,style:2},
];

const TILE=256,ATLAS=1024,COLUMNS=ATLAS/TILE;
const KEY_TONES=[
  ['white','blue','off','off','white','off'],
  ['white','off','blue','off','white'],
  ['white','off','off','blue'],
];

function controlLayout(w,h,style){
  const columns=[3,5,2][style],rows=style===1?1:2,aspect=style===1?1.6:1;
  const gap=Math.min(w,h)*.065;
  const width=Math.min((w*.78-gap*(columns-1))/columns,(h*.50-gap*(rows-1))/rows/aspect),height=width*aspect;
  const left=(w-columns*width-(columns-1)*gap)/2,top=h*.46-(rows*height+(rows-1)*gap)/2;
  // Artwork holes and raised caps share the same layout, measured in metres.
  return KEY_TONES[style].map((tone,i)=>[
    (left+i%columns*(width+gap))/w,(top+Math.floor(i/columns)*(height+gap))/h,width/w,height/h,tone,
  ]);
}

function drawSwitchFace(c,e,rect,keys,style){
  const {x:ox,y:oy,w,h}=rect,s=Math.min(w,h);
  const palette={white:'#e9eee0',blue:'#427eff',off:'#67716d',red:'#d85d49',amber:'#d3aa54'};
  const fill=(ctx,x,y,width,height,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,width,height);};
  c.save();e.save();c.translate(ox,oy);e.translate(ox,oy);
  c.strokeStyle='#6e7971';c.lineWidth=s*.006;c.strokeRect(s*.035,s*.035,w-s*.07,h-s*.07);
  c.strokeStyle='#58665d';c.lineWidth=s*.004;c.strokeRect(s*.068,h*.17,w-s*.136,h*.56);
  c.fillStyle='#a7ada0';c.font=`${s*.041}px monospace`;
  c.fillText(['LOCAL / LIGHTING','AUX / DISTRIBUTION','DOOR / SERVICES'][style],s*.078,h*.11);
  for(const [nx,ny,nw,nh,tone] of keys){
    const x=nx*w,y=ny*h,kw=nw*w,kh=nh*h,pad=Math.min(kw,kh)*.09;
    fill(c,x-s*.012,y-s*.012,kw+s*.024,kh+s*.024,'#090f10');
    fill(c,x,y,kw,kh,'#434f4b');
    fill(c,x+pad,y+pad,kw-pad*2,kh-pad*2,palette[tone]);
    fill(c,x+pad,y+pad,kw-pad*2,pad*.5,tone==='off'?'#97a299':'#f4f2da');
    fill(c,x+kw*.23,y+kh-pad*2,kw*.54,pad*.35,tone==='off'?'#29332e':'#768577');
    if(tone!=='off')fill(e,x+pad*1.2,y+pad*1.4,kw-pad*2.4,kh-pad*2.8,palette[tone]);
  }
  const row=(style===2?.77:.82)*h;
  for(let i=0;i<(style===2?4:8);i++){
    const x=(.17+i*(style===2?.21:.093))*w,r=(style===2?.017:.013)*s;
    c.beginPath();c.arc(x,row,r+s*.013,0,Math.PI*2);c.fillStyle='#101818';c.fill();
    const tone=i===0?'red':i===3?'blue':i%3===1?'white':'off';
    for(const ctx of tone==='off'?[c]:[c,e]){
      ctx.beginPath();ctx.arc(x,row,r,0,Math.PI*2);ctx.fillStyle=palette[tone];ctx.fill();
    }
  }
  c.fillStyle='#839086';c.font=`${s*.031}px monospace`;
  c.fillText(style===2?'LOCK  READY  LOCAL':'STBY   CIRCUIT  A / B',s*.093,h-s*.07);
  for(const x of [s*.065,w-s*.065])for(const y of [s*.064,h-s*.064]){
    fill(c,x-s*.008,y-s*.008,s*.016,s*.016,'#8a9184');fill(c,x-s*.008,y,s*.016,s*.004,'#19201e');
  }
  c.restore();e.restore();
}

function switchAtlas(){
  const entries=new Map(),canvases=typeof document==='undefined'?[]:[0,1].map(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=ATLAS;return canvas;
  });
  const contexts=canvases.map(canvas=>canvas.getContext('2d'));
  contexts.forEach((ctx,i)=>{ctx.fillStyle=i?'#000':'#252e2d';ctx.fillRect(0,0,ATLAS,ATLAS);});
  const maps={map:null,emissiveMap:null,...Object.fromEntries(canvases.map((canvas,i)=>{
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    texture.name=i?'Switch panel shared emissive mask':'Switch panel shared face atlas';
    return [i?'emissiveMap':'map',texture];
  }))};
  function region(w,h,style){
    const key=`${style}/${(w/h).toFixed(6)}`;
    if(entries.has(key))return entries.get(key);
    const index=entries.size;
    if(index>=COLUMNS*COLUMNS)throw new Error('Wall switch atlas capacity exceeded');
    // A rectangular tile with the panel's actual aspect, at one pixel scale
    // for both axes. Only empty margins vary; the artwork is never stretched.
    const scale=(TILE-16)/Math.max(w,h),pw=w*scale,ph=h*scale;
    const rect={x:index%COLUMNS*TILE+(TILE-pw)/2,y:Math.floor(index/COLUMNS)*TILE+(TILE-ph)/2,w:pw,h:ph};
    const entry={rect,keys:controlLayout(w,h,style)};entries.set(key,entry);
    if(contexts.length){
      drawSwitchFace(...contexts,rect,entry.keys,style);
      maps.map.needsUpdate=maps.emissiveMap.needsUpdate=true;
    }
    return entry;
  }
  return {maps,region};
}

export function createWallSwitchMaterials(){
  const atlas=switchAtlas();
  return {
    atlas,
    shell:new THREE.MeshStandardMaterial({name:'Wall switches / graphite enclosure',color:0x4c5853,roughness:.73,metalness:.35}),
    socket:new THREE.MeshStandardMaterial({name:'Wall switches / key sides',color:0x293630,roughness:.66,metalness:.12}),
    face:new THREE.MeshStandardMaterial({name:'Wall switches / illuminated face',color:0xffffff,...atlas.maps,emissive:0xffffff,emissiveIntensity:.85,roughness:.8,metalness:.12}),
  };
}

export function createWallSwitchPanel(m,{w=.40,h=.62,style=0}={}){
  const root=new THREE.Group();root.name='Illuminated wall switch panel';
  openPanelBox(root,m.shell,0,0,.019,w,h,.042).name='Open-front switch plate';
  const fw=w,fh=h,{rect,keys}=m.atlas.region(w,h,style);
  function face(x,y,width,height,z,holes=[]){
    const geometry=panelFaceGeometry(width*fw,height*fh,holes),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(rect.x+(x+uv.getX(i)*width)*rect.w)/ATLAS,1-(rect.y+(y+(1-uv.getY(i))*height)*rect.h)/ATLAS);
    const mesh=new THREE.Mesh(geometry,m.face);mesh.position.set((x+width/2-.5)*fw,(.5-y-height/2)*fh,z);
    mesh.name=holes.length?'Switch panel face':'Switch cap face';
    mesh.receiveShadow=true;root.add(mesh);
  }
  face(0,0,1,1,.040,keys);
  // A few plain caps supply real depth in oblique views. LEDs, screws and
  // legends stay in the atlas, with no lights or animated texture updates.
  for(const [x,y,width,height] of keys){
    openPanelBox(root,m.socket,(x+width/2-.5)*fw,(.5-y-height/2)*fh,.049,width*fw,height*fh,.018);
    face(x,y,width,height,.058);
  }
  return root;
}

export function addWallSwitchPanels(parent,floors){
  const materials=createWallSwitchMaterials(),root=new THREE.Group();root.name='Distributed wall switches';parent.add(root);
  for(const spec of WALL_SWITCH_PANELS){
    const panel=createWallSwitchPanel(materials,spec);panel.name=`Wall switches / ${spec.name}`;
    panel.position.set(spec.x,floors[spec.deck]+spec.y,spec.z);root.add(panel);
  }
  return root;
}
