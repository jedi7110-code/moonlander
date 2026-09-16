import * as THREE from 'three';

const segments=64,bandWidth=.020,bandThickness=.0022;
function mesh(parent,geometry,material,name){
  const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function disc(parent,radius,depth,z,material,name){
  const m=mesh(parent,new THREE.CylinderGeometry(radius,radius,depth,64),material,name);
  m.rotation.x=Math.PI/2;m.position.z=z;return m;
}
function faceTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d');c.translate(256,256);
  c.fillStyle='#14191b';c.beginPath();c.arc(0,0,255,0,Math.PI*2);c.fill();
  c.fillStyle='#394548';c.beginPath();c.arc(0,0,252,Math.PI,Math.PI*2);c.arc(0,0,203,Math.PI*2,Math.PI,true);c.closePath();c.fill();
  c.strokeStyle='#818b8c';c.lineWidth=2;c.beginPath();c.arc(0,0,202,0,Math.PI*2);c.stroke();
  c.textAlign='center';c.textBaseline='middle';c.fillStyle='#e8eddb';c.font='bold 23px sans-serif';
  for(let h=2;h<=24;h+=2){const a=h/24*Math.PI*2;c.fillText(String(h),Math.sin(a)*226,-Math.cos(a)*226);}
  for(let i=0;i<60;i++){
    c.save();c.rotate(i/60*Math.PI*2);c.fillStyle=i%5?'#909c9c':'#f1f2da';
    c.fillRect(i%5?-1:-5,-185,i%5?2:10,i%5?7:22);c.restore();
  }
  c.fillStyle='#e3e9df';c.font='20px sans-serif';c.fillText('GMT',0,52);
  c.font='12px sans-serif';c.fillText('AUTOMATIC',0,76);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

// Intersect the actual skinned wrist with the two strap-edge planes. This
// avoids a circular cuff floating around the flattened, twisting forearm.
function wristSections(skin,watch){
  if(!skin)return null;
  skin.skeleton.update();const p=skin.geometry.attributes.position,index=skin.geometry.index.array;
  const inverse=watch.matrixWorld.clone().invert().multiply(skin.matrixWorld),points=[];
  for(let i=0;i<p.count;i++)points.push(skin.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(p,i)).applyMatrix4(inverse));
  return [-bandWidth/2,bandWidth/2].map(y=>{
    const edges=[];
    for(let i=0;i<index.length;i+=3){
      const tri=[points[index[i]],points[index[i+1]],points[index[i+2]]];
      if(tri.every(v=>v.y>y)||tri.every(v=>v.y<y)||tri.some(v=>Math.hypot(v.x,v.z)>.12))continue;
      const hits=[];
      for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))hits.push(a.clone().lerp(b,(y-a.y)/(b.y-a.y)));}
      if(hits.length===2)edges.push(hits);
    }
    return Array.from({length:segments},(_,i)=>{
      const a=i/segments*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a);let radius=Infinity;
      for(const [p,q] of edges){
        const ex=q.x-p.x,ez=q.z-p.z,det=dx*ez-dz*ex;if(Math.abs(det)<1e-10)continue;
        const t=(p.x*ez-p.z*ex)/det,u=(p.x*dz-p.z*dx)/det;
        if(t>.005&&u>=0&&u<=1)radius=Math.min(radius,t);
      }
      return Number.isFinite(radius)?radius:.032;
    });
  });
}
function strapGeometry(radii){
  const positions=[],indices=[];
  for(let ring=0;ring<4;ring++)for(let i=0;i<segments;i++){
    const edge=ring%2,a=i/segments*Math.PI*2,r=radii[edge][i]+.0005+(ring>=2?bandThickness:0);
    positions.push(Math.cos(a)*r,(edge-.5)*bandWidth,Math.sin(a)*r);
  }
  for(const [a,b] of [[0,1],[1,3],[3,2],[2,0]])for(let i=0;i<segments;i++){
    const j=(i+1)%segments,A=a*segments+i,B=a*segments+j,C=b*segments+j,D=b*segments+i;
    indices.push(A,B,D,B,C,D);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function hand(parent,name,length,width,z,material,arrow=false){
  const pivot=new THREE.Group();pivot.name=name;parent.add(pivot);pivot.position.z=z;
  const shape=new THREE.Shape();shape.moveTo(-width/2,-.002);shape.lineTo(width/2,-.002);
  if(arrow){shape.lineTo(width/2,length-.003);shape.lineTo(.0025,length-.003);shape.lineTo(0,length);shape.lineTo(-.0025,length-.003);shape.lineTo(-width/2,length-.003);}
  else{shape.lineTo(width/2,length-.002);shape.lineTo(0,length);shape.lineTo(-width/2,length-.002);}
  shape.closePath();mesh(pivot,new THREE.ShapeGeometry(shape),material,name+' blade');return pivot;
}
export function attachMiloWatch(root){
  const {arms,bodySkin:skin}=root.userData,left=arms.find(a=>a.side===-1);
  const parent=skin?.skeleton.bones.find(b=>b.name==='Milo skin L_wrist2').parent??left.hand;
  const previous=left.hand.quaternion.clone();left.hand.rotation.set(0,-Math.PI/2,0);root.userData.updateWristTwists?.();
  const watch=new THREE.Group();watch.name='Milo left mechanical GMT watch';parent.add(watch);
  watch.position.set(skin?-.020:0,.004,skin?-.013:0);watch.rotation.y=skin?-Math.PI/6:0;
  root.updateMatrixWorld(true);
  const radii=wristSections(skin,watch)??[0,1].map(()=>Array.from({length:segments},(_,i)=>1/Math.hypot(Math.cos(i/segments*Math.PI*2)/.029,Math.sin(i/segments*Math.PI*2)/.024)));
  const rubber=new THREE.MeshStandardMaterial({color:0x222829,roughness:.88,side:THREE.DoubleSide});
  const steel=new THREE.MeshStandardMaterial({color:0xa8b1b3,metalness:.82,roughness:.29});
  const darkSteel=new THREE.MeshStandardMaterial({color:0x434d50,metalness:.65,roughness:.38});
  const lume=new THREE.MeshStandardMaterial({color:0xe8efcf,roughness:.4,metalness:.12});
  const red=new THREE.MeshStandardMaterial({color:0xc84b37,roughness:.38,metalness:.22});
  mesh(watch,strapGeometry(radii),rubber,'Fitted graphite watch strap');
  const caseGroup=new THREE.Group();caseGroup.name='GMT case 42 mm';watch.add(caseGroup);
  caseGroup.rotation.z=Math.PI/2;
  caseGroup.position.z=Math.max(radii[0][16],radii[1][16])+.001;
  disc(caseGroup,.021,.008,.0025,steel,'Brushed steel case');
  disc(caseGroup,.0217,.002,.0073,darkSteel,'24-hour bezel');
  const face=mesh(caseGroup,new THREE.CircleGeometry(.0208,64),new THREE.MeshStandardMaterial({color:0xffffff,map:faceTexture(),roughness:.55,metalness:.12}),'GMT dial and 24-hour scale');face.position.z=.0084;
  for(const x of [-.008,.008])for(const y of [-.021,.021]){
    const lug=mesh(caseGroup,new THREE.BoxGeometry(.0045,.009,.006),steel,'Case lug');
    lug.position.set(x,y,-.003);lug.rotation.x=-Math.sign(y)*.55;
  }
  const crown=mesh(caseGroup,new THREE.CylinderGeometry(.003,.003,.004,16),steel,'Screw-down crown');crown.rotation.z=Math.PI/2;crown.position.set(.022,0,.0025);
  const gmt=hand(caseGroup,'GMT hand',.0148,.00065,.0087,red,true);
  const hour=hand(caseGroup,'Hour hand',.010,.0019,.0090,lume),minute=hand(caseGroup,'Minute hand',.015,.0011,.0093,lume);
  const second=hand(caseGroup,'Sweeping seconds',.0158,.00035,.0096,red);
  disc(caseGroup,.0012,.0007,.010,steel,'Hand pinion');
  root.userData.watch={group:watch,parent,hour,minute,second,gmt,radii,side:-1};updateMiloWatch(root,0);
  left.hand.quaternion.copy(previous);root.userData.updateWristTwists?.();root.updateMatrixWorld(true);
  return watch;
}
export function updateMiloWatch(root,time=0){
  const watch=root.userData.watch;if(!watch)return;
  const seconds=10*3600+8*60+37+time;
  watch.hour.rotation.z=-seconds/43200*Math.PI*2;watch.minute.rotation.z=-seconds/3600*Math.PI*2;
  watch.second.rotation.z=-seconds/60*Math.PI*2;watch.gmt.rotation.z=-(seconds+8*3600)/86400*Math.PI*2;
}
