import {Group,Mesh,CylinderGeometry,LatheGeometry,Vector2,CircleGeometry,CanvasTexture,SRGBColorSpace,MeshStandardMaterial} from 'three';
import {cylinder} from './materials.js';

export function createMaintenanceSprayPrint(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d'),paper='#d7d0b2',ink='#263533',yellow='#c4a34b';
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const text=(value,y,size=10,color=ink,weight=600)=>{
    c.fillStyle=color;c.font=`${weight} ${size}px Arial`;c.textAlign='center';c.textBaseline='alphabetic';c.fillText(value,128,y);
  };
  rect(0,0,256,256,paper);rect(0,0,256,52,ink);rect(0,52,256,53,yellow);
  text('TARAIRON',27,14,paper,700);text('WORKSHOP / SERVICE',42,8,paper);
  text('M-04',89,32,ink,800);text('MAINTENANCE',125,13,ink,800);
  text('DRY FILM',148,18,ink,800);text('PRECISION LUBRICANT',165,8);
  rect(77,175,102,1,ink);text('HINGES / LATCHES / GUIDES',189,7);
  text('NON-FOOD CONTACT',207,8,ink,700);
  text('PRESSURIZED / KEEP FROM HEAT',221,6);
  text('DO NOT PUNCTURE OR INCINERATE',232,6);
  text('250 mL  /  LOT 07-041',248,8);
  const map=new CanvasTexture(canvas);map.name='Maintenance spray / static 256 print';map.colorSpace=SRGBColorSpace;map.anisotropy=4;
  return map;
}

export function createMaintenanceSprayCan(m,metal){
  const root=new Group();root.name='Maintenance spray can';
  const label=new MeshStandardMaterial({name:'Maintenance spray / printed enamel',map:createMaintenanceSprayPrint(),roughness:.63,metalness:.12,
    userData:{cabinKeepSurface:true,cabinNoOutline:true}});
  const add=(name,geometry,material)=>{
    const mesh=new Mesh(geometry,material);mesh.name=`Maintenance spray / ${name}`;
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  // Print is the can wall itself: no almost-coplanar sticker or extra shell.
  const body=add('printed can',new CylinderGeometry(.032,.032,.157,24,1,true,-Math.PI),label);body.position.y=.0845;
  const lathe=points=>new LatheGeometry(points.map(p=>new Vector2(...p)),24);
  add('rolled foot',lathe([[0,0],[.029,0],[.033,.0015],[.033,.004],[.032,.006]]),metal);
  add('metal shoulder',lathe([[.032,.163],[.033,.165],[.033,.168],[.029,.170],[.023,.181],[.010,.184],[.008,.187]]),metal);
  cylinder(root,m.dark,0,.195,0,.012,.019,.012,16).name='Maintenance spray / actuator';
  const nozzle=add('nozzle insert',new CircleGeometry(.0032,8),metal);nozzle.position.set(0,.195,.0122);
  const opening=add('nozzle opening',new CircleGeometry(.0013,8),m.dark);opening.position.set(0,.195,.0124);
  return root;
}
