import * as THREE from 'three';
import {box,cylinder} from './materials.js';
import {createGalleyFinishes,galleyPanel,galleyFastener} from './galley.js';

const labels=['S / 03   PROVISIONS','L / 02   CREW SERVICE','01  RATIONS','02  LINEN',
  '03  CLEANING','04  HYGIENE','OPS / SERVICE STORES','GARMENT STOWAGE'];
const hardwareByPalette=new WeakMap();
function serviceInk(){
  let map=null;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const c=canvas.getContext('2d');
    for(const [i,text]of labels.entries()){
      const y=i*64;c.fillStyle='#3e4845';c.font='600 27px Arial';c.fillText(text,12,y+29);
      c.font='13px Arial';c.fillText(i<2?'TARAIRON / RETAINED SERVICE MODULE':'CHECK RESTRAINT / MAX 12 KG',12,y+49);
      c.fillStyle='#727c73';c.fillRect(12,y+58,990,1);
    }
    map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
    map.name='Storage / shared service markings';
  }
  return new THREE.MeshStandardMaterial({name:'Storage / direct service print',map,alphaTest:.2,roughness:1,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    userData:{cabinKeepSurface:true,cabinNoOutline:true,castShadow:false}});
}

export function createStorageHardware(m){
  if(hardwareByPalette.has(m))return hardwareByPalette.get(m);
  const f=createGalleyFinishes(m),{metal,paint,dark,red,metals}=f,ink=serviceInk();
  const panel=(root,name,x,y,z,w,h,d=.022,mat=paint)=>galleyPanel(root,mat,name,x,y,z,w,h,d);
  function print(root,tile,x,y,z,w=.70,h=.044){
    const geometry=new THREE.PlaneGeometry(w,h),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(12+uv.getX(i)*990)/1024,1-(tile*64+2+(1-uv.getY(i))*60)/512);
    const mesh=new THREE.Mesh(geometry,ink);mesh.name='Storage / service marking';mesh.position.set(x,y,z);root.add(mesh);
  }
  function handle(root,x,y,z){
    panel(root,'storage recessed handle',x,y,z,.174,.072,.008,dark);
    for(const side of [-1,1])box(root,metal,x+side*.064,y+.002,z+.014,.014,.034,.020);
    box(root,metal,x,y-.016,z+.024,.126,.014,.019).name='Storage / flush U handle';
  }
  function latch(root,x,y,z){
    const pivot=cylinder(root,metals.shell,x,y,z,.021,.012,.021,12);pivot.rotation.x=Math.PI/2;
    panel(root,'storage red restraint',x,y-.021,z+.014,.025,.067,.012,red);
    galleyFastener(root,metal,x,y,z+.026);
  }
  function frame(root,{width,height,bottom=.13,back=-.43,front=.405,divisions=[],shelves=[],liner=paint}){
    const mid=bottom+height/2,depth=front-back;
    box(root,dark,0,bottom+.031,(front+back)/2,width-.088,.050,depth-.06).name='Storage / recessed plinth';
    // Butt the liner and cheeks into the top extrusion instead of stacking
    // coincident top faces, which shimmer when the rack is viewed from above.
    box(root,liner,0,mid+.009,back+.016,width-.084,height-.094,.032).name='Storage / washable rear liner';
    for(const x of [-width/2+.021,width/2-.021]){
      box(root,paint,x,mid-.019,(front+back-.012)/2,.042,height-.038,depth-.012).name='Storage / modular side cheek';
      box(root,metal,x,mid-.019,front+.007,.044,height-.038,.038).name='Storage / corner extrusion';
      for(const y of [bottom+.12,mid,bottom+height-.12])galleyFastener(root,metals.shell,x,y,front+.029);
    }
    for(const x of divisions)box(root,metal,x,mid-.019,front,.035,height-.038,.047).name='Storage / insert divider';
    for(const y of shelves){
      box(root,metal,0,y,(front+back)/2,width-.055,.027,depth-.025).name='Storage / tray carrier';
      box(root,metals.shell,0,y-.0245,front+.005,width-.055,.022,.051).name='Storage / carrier channel';
    }
    box(root,metal,0,bottom+height-.019,(front+back)/2,width,.038,depth+.02).name='Storage / top extrusion';
  }
  function tray(root,x,bottom,w,front=.417,tile=2,{depth=.67,centerZ=.06}={}){
    // Low retaining fronts leave labels and the existing hand contacts exposed.
    panel(root,'retained storage tray',x,bottom+.068,front,w,.108);
    handle(root,x,bottom+.066,front+.017);
    for(const side of [-1,1])latch(root,x+side*(w/2-.041),bottom+.074,front+.024);
    print(root,tile,x-w*.29,bottom+.080,front+.013,w*.29,.041);
    for(const side of [-1,1])box(root,metal,x+side*(w/2-.015),bottom+.089,centerZ,.020,.11,depth).name='Storage / tray side rail';
  }
  function door(root,x,y,w,h,front=.423,tile=5){
    panel(root,'stowage seal',x,y,front-.016,w+.014,h+.014,.012,dark);
    panel(root,'stowage aluminium rim',x,y,front,w,h,.027,metal);
    panel(root,'stowage insert face',x,y,front+.019,w-.024,h-.024,.012);
    handle(root,x,y-.022,front+.032);
    print(root,tile,x,y+h*.29,front+.028,w-.10,.048);
    for(const side of [-1,1]){
      latch(root,x+side*w*.34,y-h/2+.026,front+.040);
      box(root,metal,x-w/2+.009,y+side*h*.27,front+.027,.018,.047,.016).name='Storage / captive hinge';
    }
  }
  const hardware={...f,ink,frame,tray,door,panel,print,latch,handle};
  hardwareByPalette.set(m,hardware);return hardware;
}

export function fitStoresGalley(rack,hardware){
  const h=hardware;
  h.frame(rack,{width:2.04,height:2.115,bottom:.125,divisions:[.04],shelves:[.18,.69,1.20,1.71],liner:h.dark});
  for(const y of [.18,.69,1.20]){
    h.tray(rack,-.47,y,.945,.417,2);
    h.tray(rack,.515,y,.865,.417,y===.18?4:3);
  }
  for(const [x,w,tile]of [[-.47,.945,2],[.515,.865,5]])h.door(rack,x,1.955,w,.422,.423,tile);
  h.print(rack,0,0,2.202,.432,1.12,.060);
}

export function createOperationsStorage(m,hardware=createStorageHardware(m)){
  const root=new THREE.Group();root.name='Operations / galley service rack';
  const h=hardware;root.userData.storageHardware=h;
  const shelves=[.55,.89,1.23,1.57];
  h.frame(root,{width:1.32,height:1.49,bottom:.43,back:0,front:.38,shelves,liner:h.dark});
  for(const [i,y]of shelves.entries()){
    h.tray(root,0,y,1.22,.398,6,{depth:.32,centerZ:.19});
    for(const x of [-.44,0,.44])box(root,i%2?m.olive:m.enamel,x,y+.13,.19,.30,.23,.25,.012).name='Operations / retained service case';
  }
  h.panel(root,'operations service header',0,1.858,.38,1.226,.072);
  h.print(root,6,0,1.86,.394,.85,.046);
  return root;
}

// Room-local coordinates, shared by OBS and the isolated furniture study.
export function createOperationsFurnishings(m){
  const root=new THREE.Group();root.name='Operations / galley furnishings';
  const h=createStorageHardware(m);root.userData.storageHardware=h;
  const rack=createOperationsStorage(m,h);rack.position.set(-1.11,0,-3.79);rack.rotation.y=Math.PI/2;root.add(rack);

  const desk=new THREE.Group();desk.name='Operations / window-centred desk';desk.position.set(0,0,-5.17);root.add(desk);
  // The worktop is centred on the pressure window, below its sill. Extruded
  // legs and a shallow drawer leave a real knee opening, not a solid cupboard.
  box(desk,h.metal,0,.885,0,1.30,.046,.72,.012).name='Operations / desk worktop';
  box(desk,h.dark,0,.911,.015,1.19,.005,.60,.012).name='Operations / desk work mat';
  box(desk,h.metal,0,.9355,-.347,1.30,.055,.026).name='Operations / desk rear retaining lip';
  for(const x of [-.604,.604]){
    for(const z of [-.282,.282]){
      box(desk,h.metal,x,.492,z,.044,.758,.046).name='Operations / desk leg';
      box(desk,h.metals.shell,x,.132,z,.072,.042,.074);
    }
    box(desk,h.metal,x,.30,0,.032,.040,.56);
    box(desk,h.paint,x,.677,-.005,.018,.334,.45).name='Operations / desk side insert';
  }
  box(desk,h.metals.shell,0,.81,-.27,1.20,.070,.045);
  h.panel(desk,'operations shallow utility drawer',0,.795,.303,1.17,.123);
  h.handle(desk,0,.795,.322);
  h.print(desk,6,-.355,.809,.317,.35,.039);
  for(const x of [-.534,.534])h.latch(desk,x,.81,.332);

  const cabinet=new THREE.Group();cabinet.name='Operations / galley right cabinet';
  cabinet.position.set(1.08,0,-3.87);cabinet.rotation.y=-Math.PI/2;root.add(cabinet);
  h.frame(cabinet,{width:1.74,height:.749,bottom:.13,back:0,front:.435,divisions:[0],liner:h.dark});
  for(const x of [-.423,.423])h.door(cabinet,x,.501,.783,.629,.452,6);
  box(cabinet,h.metal,0,.892,.209,1.79,.026,.48,.008).name='Operations / right cabinet worktop';
  box(cabinet,h.metals.shell,0,.914,.014,1.72,.024,.021).name='Operations / right cabinet retaining lip';
  // Keep the service cases and their established top height, seated on the
  // new carrier rather than hovering over a decorative domestic shelf.
  for(const z of [-3.48,-4.30])box(root,m.olive,.74,1.06,z,.34,.31,.47,.035).name='Operations / bench service case';
  return root;
}

export function fitLaundryGalley(root,closet,hardware){
  const h=hardware,{metal,paint,metals}=h;
  // A common appliance carrier frames the washer and dryer without changing
  // their drums, doors, hinges or loading coordinates.
  const chassis=new THREE.Group();chassis.name='Laundry / galley appliance carrier';chassis.position.set(-.46,.14,-4.72);root.add(chassis);
  h.frame(chassis,{width:.952,height:1.95,bottom:0,back:-.415,front:.463,shelves:[.0,.932,1.931]});
  for(const y of [.945,1.945])for(const x of [-.35,.35])h.latch(chassis,x,y,.489);
  h.panel(chassis,'laundry service header',0,2.032,.448,.952,.138);
  h.print(chassis,1,0,2.037,.462,.835,.055);
  for(const x of [-.453,.453])box(chassis,metal,x,2.029,.445,.044,.148,.06);

  h.frame(closet,{width:.946,height:2.04,bottom:0,back:-.405,front:.377,shelves:[.03,.37],liner:h.dark});
  h.door(closet,0,.203,.834,.272,.395,3);
  // Retain the open garment bay; the lower linen tray and overhead cassette
  // supply the galley hardware without covering any of the hanging shirts.
  h.tray(closet,0,.37,.834,.397,3);
  h.panel(closet,'garment header',0,1.963,.379,.852,.147);
  h.print(closet,7,0,1.97,.393,.73,.056);
  for(const side of [-1,1]){
    h.latch(closet,side*.411,1.925,.413);
    box(closet,metals.shell,side*.416,1.10,.369,.020,1.58,.020).name='Laundry / garment insert guide';
  }
  // Replace the domestic wire basket by a retained, perforated service bin.
  const basket=root.getObjectByName('Laundry basket');
  if(basket){
    // Keep the load itself and the established pickup position.
    box(basket,metals.shell,0,.042,0,.42,.072,.48);
    for(const side of [-1,1])box(basket,paint,side*.201,.195,0,.023,.234,.48);
    h.panel(basket,'laundry retained bin front',0,.184,.241,.418,.252);
    box(basket,paint,0,.184,-.231,.418,.252,.022);
    h.handle(basket,0,.22,.257);h.latch(basket,.166,.094,.274);
    for(let i=0;i<7;i++)box(basket,metals.shell,-.15+i*.05,.115,.254,.026,.009,.002);
  }
}
