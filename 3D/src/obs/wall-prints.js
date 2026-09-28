import {Raycaster,Vector2,Vector3,TextureLoader,SRGBColorSpace} from 'three';
import {createCautionLabelTexture} from './caution-label.js';

export const LOCKER_CALENDAR={x:11.21925,height:1.68,width:.48,angle:4*Math.PI/180};
export const LOCKER_POSTER={x:11.88075,height:1.69,width:.48,angle:-2*Math.PI/180};
export const LOUNGE_POSTER={x:7.96,height:1.78,width:1.40,angle:0};
export const CARGO_CAUTION={x:10.66,height:1.32,width:.20,angle:0,floor:0,aspect:576/256};
// The cupboard left of the sofa: magazine covers at about 21 × 28 cm.
export const LOUNGE_LOCKER_MAGAZINES=[
  {x:2.3473,height:1.63,width:.21,angle:1*Math.PI/180,file:'time-mag.jpg',aspect:1442/1091},
  {x:2.6073,height:1.63,width:.21,angle:-1*Math.PI/180,file:'time2.jpg',aspect:1456/1080},
  {x:2.3473,height:1.25,width:.21,angle:-2*Math.PI/180,file:'newsweek.jpg',aspect:1456/1080},
  {x:2.6073,height:1.25,width:.21,angle:2*Math.PI/180,file:'newyorker.jpg',aspect:1442/1091},
];
export const BUNK_FAMILY_PHOTOS=[
  {x:-5.43,height:1.50,width:.19,angle:-4*Math.PI/180,file:'milo-family-01.png'},
  {x:-5.19,height:1.46,width:.19,angle:3*Math.PI/180,file:'milo-family-02.png'},
  {x:-5.34,height:1.26,width:.19,angle:-2*Math.PI/180,file:'milo-family-03.png'},
];

// Print on the existing wall surface; there is no overlapping decal mesh.
export function applyWallPrintSurface(material,prints){
  if(!prints?.length)return;
  const before=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  prints.forEach((spec,i)=>{material[`bunkPrintMap${i}`]=spec.map;});
  material.onBeforeCompile=(shader,renderer)=>{
    before.call(material,shader,renderer);
    let declarations='varying vec3 vBunkCalendarWorld;\n',layers='';
    prints.forEach((spec,i)=>{
      const prefix=`bunkPrint${i}`;
      Object.assign(shader.uniforms,{
        [`${prefix}Map`]:{value:spec.map},[`${prefix}Center`]:{value:spec.center},
        [`${prefix}Size`]:{value:spec.size},[`${prefix}Angle`]:{value:spec.angle},
      });
      declarations+=`uniform sampler2D ${prefix}Map;
        uniform vec3 ${prefix}Center;
        uniform vec2 ${prefix}Size;
        uniform float ${prefix}Angle;\n`;
      layers+=`{
        vec2 offset=vBunkCalendarWorld.xy-${prefix}Center.xy;
        float ca=cos(${prefix}Angle),sa=sin(${prefix}Angle);
        vec2 photoUV=vec2(ca*offset.x-sa*offset.y,sa*offset.x+ca*offset.y)/${prefix}Size+0.5;
        if(abs(vBunkCalendarWorld.z-${prefix}Center.z)<0.001 &&
          all(greaterThanEqual(photoUV,vec2(0.0))) && all(lessThanEqual(photoUV,vec2(1.0)))){
          vec4 photograph=texture2D(${prefix}Map,photoUV);
          diffuseColor.rgb=mix(diffuseColor.rgb,photograph.rgb,photograph.a);
        }
      }\n`;
    });
    shader.vertexShader='varying vec3 vBunkCalendarWorld;\n'+shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvBunkCalendarWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=declarations+shader.fragmentShader.replace(
      '#include <map_fragment>','#include <map_fragment>\n'+layers);
  };
  material.customProgramCacheKey=()=>`${cacheKey}/bunk-prints-v2/${prints.length}`;
}

export function finishWallPrints(root,m,floor){
  if(typeof Image==='undefined')return;
  root.updateMatrixWorld(true);
  const base=import.meta.env?.BASE_URL??'/3D/',walls=new Map();
  const prints=[
    {...LOCKER_CALENDAR,file:'bunk-calendar-1987.png',aspect:1261/1247},
    {...LOCKER_POSTER,file:'bunk-beach-poster.png',aspect:1427/1102},
    {...LOUNGE_POSTER,file:'lounge-paradise-poster.jpg',aspect:1200/1800},
    ...LOUNGE_LOCKER_MAGAZINES,
    ...BUNK_FAMILY_PHOTOS.map(photo=>({...photo,aspect:2/3})),
    {...CARGO_CAUTION,map:createCautionLabelTexture()},
  ];
  for(const {x,height,width,angle,file,aspect,map:artwork,floor:printFloor=floor} of prints){
    const ray=new Raycaster(new Vector3(x,printFloor+height,0),new Vector3(0,0,-1));
    const hit=ray.intersectObject(root,true).find(({object,face})=>
      object.material===m.enamel&&face.normal.z>.999);
    if(!hit)continue;
    const size=new Vector2(width,width*aspect);
    const map=artwork??new TextureLoader().load(`${base}assets/obs/${file}`,texture=>{
      size.y=width*texture.image.height/texture.image.width;
    });
    map.colorSpace=SRGBColorSpace;map.anisotropy=4;if(file)map.name=file;
    if(!walls.has(hit.object))walls.set(hit.object,[]);
    walls.get(hit.object).push({map,center:hit.point.clone(),size,angle});
  }
  for(const [wall,prints] of walls){
    const material=wall.material.clone();material.name='Cabin wall with supplied prints';
    material.userData.wallPrints=prints;
    applyWallPrintSurface(material,prints);
    wall.material=material;wall.name='Cabin calendar and poster wall';
  }
}
