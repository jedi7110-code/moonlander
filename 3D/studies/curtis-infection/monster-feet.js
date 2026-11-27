import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';

const smoothMin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};

function sculptFoot(floorY){
  // Fuse heel, arch, ankle and articulated toes into one continuous surface.
  const forms=[
    [[0,-.040,-.035],[.075,.066,.082]],
    [[-.008,-.024,.055],[.080,.071,.107]],
    [[0,-.054,.137],[.110,.049,.078]],
    [[0,.022,.005],[.064,.105,.063]],
    [[0,.104,.043],[.061,.076,.061]],
  ];
  const toes=[];
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.061,length=[.090,.110,.100,.078][i],width=[.030,.026,.024,.022][i];
    forms.push([[x,-.067,.178+length*.25],[width,.034,length*.64]]);
    forms.push([[x+(i-1.5)*.004,-.073,.205+length*.48],[width*.91,.028,length*.52]]);
    toes.push({x:x+(i-1.5)*.004,z:.205+length*.84,width});
  }
  const resolution=60,span=new THREE.Vector3(.36,.42,.60),centre=new THREE.Vector3(0,.04,.11);
  const mc=new MarchingCubes(resolution,new THREE.MeshBasicMaterial(),false,false,35000);mc.isolation=0;
  for(let iz=0;iz<resolution;iz++)for(let iy=0;iy<resolution;iy++)for(let ix=0;ix<resolution;ix++){
    const x=(ix/resolution-.5)*span.x+centre.x,y=(iy/resolution-.5)*span.y+centre.y,z=(iz/resolution-.5)*span.z+centre.z;
    let distance=1;
    for(let f=0;f<forms.length;f++){
      const [p,r]=forms[f];
      const d=(Math.hypot((x-p[0])/r[0],(y-p[1])/r[1],(z-p[2])/r[2])-1)*Math.min(...r);
      distance=smoothMin(distance,d,f<5?.014:.005);
    }
    distance=Math.max(distance,floorY-y);
    mc.field[ix+resolution*(iy+resolution*iz)]=-distance;
  }
  mc.update();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(mc.positionArray.slice(0,mc.count*3),3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(mc.normalArray.slice(0,mc.count*3),3));
  geometry.scale(span.x/2,span.y/2,span.z/2);geometry.translate(...centre.toArray());mc.geometry.dispose();mc.material.dispose();
  const p=geometry.attributes.position,n=geometry.attributes.normal,colors=new Float32Array(p.count*3);
  const dark=new THREE.Color('#354331'),light=new THREE.Color('#7b7d59'),color=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),top=THREE.MathUtils.smoothstep(n.getY(i),.1,.8);
    const fold=Math.pow(.5+.5*Math.sin(z*180+x*43+Math.sin(y*110)),7);
    const tendons=Math.pow(.5+.5*Math.cos(x*112+z*8),6)*Math.exp(-Math.pow((z-.085)/.11,2));
    const displacement=(tendons*.0035-fold*.0023)*top;
    p.setXYZ(i,x+n.getX(i)*displacement,y+n.getY(i)*displacement,z+n.getZ(i)*displacement);
    color.copy(dark).lerp(light,.50+tendons*.35-fold*.30);colors.set(color.toArray(),i*3);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeBoundingBox();geometry.translate(0,floorY-geometry.boundingBox.min.y,0);geometry.computeBoundingSphere();
  return {geometry,toes};
}

export function createMonsterFeet(root){
  const hide=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.88});
  const plateMaterial=new THREE.MeshStandardMaterial({color:'#535d3d',roughness:.83,flatShading:true});
  const nailMaterial=new THREE.MeshStandardMaterial({color:'#363e2b',roughness:.67});
  const sourceSole=root.userData.legs[0].boot.getObjectByName('Anatomical combat boot sole');
  sourceSole.geometry.computeBoundingBox();const floorY=sourceSole.geometry.boundingBox.min.y;
  const {geometry,toes}=sculptFoot(floorY);
  const probe=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  function topY(x,z){ray.ray.origin.set(x,.4,z);return ray.intersectObject(probe,false)[0]?.point.y??-.045;}
  const feet=root.userData.legs.map(({boot,side})=>{
    const clothing=boot.children.map(object=>[object,object.visible]);
    const foot=new THREE.Group();foot.name='Curtis bare creature foot';boot.add(foot);
    const flesh=new THREE.Mesh(geometry,hide);flesh.name='Continuous sculpted creature foot';flesh.castShadow=true;flesh.receiveShadow=true;foot.add(flesh);
    function plate(name,x,z,scale,material=plateMaterial){
      const part=new THREE.Mesh(material===nailMaterial?new THREE.SphereGeometry(1,20,12):new THREE.IcosahedronGeometry(1,1),material);
      part.name=name;part.position.set(x,topY(x,z)+.002,z);part.scale.set(...scale);part.castShadow=true;foot.add(part);return part;
    }
    for(let i=0;i<3;i++)plate('Layered instep scute',-.006,.02+i*.043,[.047-i*.004,.012,.037]);
    toes.forEach(({x,z,width})=>{
      plate('Blunt toe nail',x,z,[width*.74,.005,.021],nailMaterial);
      plate('Toe joint plate',x,.176,[width*.78,.009,.018]);
    });
    for(const sign of [-1,1])for(let i=0;i<3;i++)plate('Ankle hide nodule',sign*(.047+i*.003),-.013+i*.024,[.016,.012,.018]);
    boot.userData.creatureFoot=foot;return {foot,clothing,side};
  });
  probe.material.dispose();
  return {update(progress){
    for(const {foot,clothing,side}of feet){
      const amount=THREE.MathUtils.smoothstep(progress,.54+(side>0?.04:0),.94),transformed=amount>.025;
      clothing.forEach(([object,visible])=>{object.visible=visible&&!transformed;});foot.visible=transformed;
      const scale=THREE.MathUtils.lerp(.86,1,amount);foot.scale.set(side*scale,1,scale);foot.userData.floorY=floorY;
    }
  }};
}
