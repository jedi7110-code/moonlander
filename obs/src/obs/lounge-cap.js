import {Group,Mesh,MeshStandardMaterial,BufferGeometry,Float32BufferAttribute,Vector3,CatmullRomCurve3,TubeGeometry,SphereGeometry,DoubleSide} from 'three';

// Local +Z is the bill/front. Modest asymmetry suggests washed, softened cotton.
const CROWN_HEIGHT=.100,CROWN_ROUNDNESS=.55;
function crownPoint(angle,v){
  const radius=Math.pow(Math.cos(v*Math.PI/2),CROWN_ROUNDNESS);
  const dent=1-.038*Math.sin(angle*3+.7)**2*Math.sin(v*Math.PI);
  return new Vector3(.102*Math.sin(angle)*radius*dent,
    .010+CROWN_HEIGHT*v-.003*Math.sin(angle)*Math.sin(v*Math.PI),
    .108*Math.cos(angle)*radius*dent-.005*v);
}

function grid(columns,rows,point){
  const positions=[],uv=[],indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    positions.push(...point(col/columns,row/rows).toArray());uv.push(col/columns,row/rows);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function billPoint(u,v){
  const x=u*2-1,round=Math.sqrt(Math.max(0,1-x*x));
  const root=crownPoint(Math.asin(x),0);
  // Pre-curved baseball bill: a broad, shallow leading arc with downturned wings.
  // Both sides taper all the way into the hem, instead of ending in squared
  // corners. The crosswise roll eases out of the crown attachment.
  const bend=v*(.55+.45*v),shoulderRound=Math.sqrt(Math.max(0,1-x**4));
  // Keep the centre short and retain width through the shoulders. A stretched
  // ellipse made the front read as a pointed beak when the cap was hanging.
  const leadingZ=.167*round*(1+.42*x*x);
  return new Vector3(
    root.x*(1-.11*v*round),
    root.y-.014*v*shoulderRound-.128*x**4*round*bend,
    root.z+v*(leadingZ-root.z)
  );
}

export function createLoungeCap(m={}){
  const root=new Group();root.name='Lounge / baseball cap';
  const cloth=new MeshStandardMaterial({name:'Cap / faded navy cotton',color:0x2a3548,roughness:.97,metalness:0,
    bumpMap:m.cloth?.bumpMap??m.cushion?.bumpMap??null,bumpScale:.00035,side:DoubleSide,
    userData:{cabinKeepSurface:true}});
  const thread=cloth.clone();thread.name='Cap / washed navy seams';thread.color.setHex(0x3c485b);
  const add=(name,geometry,material=cloth)=>{
    const mesh=new Mesh(geometry,material);mesh.name=`Cap / ${name}`;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const crown=grid(36,12,(u,v)=>crownPoint(-Math.PI+u*Math.PI*2,v));
  // Follow the existing cotton surface rather than using a smooth plastic dome.
  const colors=[],p=crown.attributes.position;
  for(let i=0;i<p.count;i++){
    const fade=.88+.12*Math.min(1,p.getY(i)/(.010+CROWN_HEIGHT))+.025*Math.sin(p.getX(i)*70+p.getZ(i)*24);
    colors.push(fade,fade,fade);
  }
  crown.setAttribute('color',new Float32BufferAttribute(colors,3));cloth.vertexColors=true;
  add('soft six-panel crown',crown);
  // A bent bill with a real rim; the second skin is its underside, not a decal.
  for(const underside of [false,true]){
    const geometry=grid(24,5,(u,v)=>billPoint(u,v).add(new Vector3(0,underside?-.003:0,0)));
    if(!underside){
      const index=geometry.index.array;
      for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];
      geometry.computeVertexNormals();
    }
    const white=new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(underside?.78:1),3);
    geometry.setAttribute('color',white);add(underside?'bill underside':'curved bill',geometry);
  }
  const stitch=(name,points,radius=.00055)=>add(name,new TubeGeometry(new CatmullRomCurve3(points),points.length-1,radius,3,false),thread);
  for(let panel=0;panel<6;panel++){
    const angle=panel*Math.PI/3,points=Array.from({length:15},(_,i)=>crownPoint(angle,i/14*.97).add(new Vector3(Math.sin(angle)*.0007,.0002,Math.cos(angle)*.0007)));
    stitch('panel seam',points);
  }
  for(const v of [.70,.87])stitch('bill topstitch',Array.from({length:21},(_,i)=>billPoint(.035+i/20*.93,v).add(new Vector3(0,.0006,0))),.0004);
  stitch('bound bill edge',Array.from({length:25},(_,i)=>billPoint(i/24,1).add(new Vector3(0,-.0015,0))),.0015);
  const button=add('covered top button',new SphereGeometry(.0075,12,6),thread);button.position.set(0,.010+CROWN_HEIGHT,-.005);button.scale.y=.34;

  const map=m.taraironLogo?.map;
  if(map?.isTexture){
    // Reuse the original white artwork. A raised, curved cotton surface with
    // fine bump reads as embroidery, without a rectangular backing/sticker.
    const embroidery=new MeshStandardMaterial({name:'Cap / ivory TARAIRON embroidery',color:0xf1eee3,map,
      alphaTest:.4,roughness:1,metalness:0,bumpMap:cloth.bumpMap,bumpScale:.00045,side:DoubleSide,
      userData:{cabinKeepSurface:true,cabinNoOutline:true,castShadow:false}});
    embroidery.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float stitchPhase = vMapUv.x * 90.0 + vMapUv.y * 12.0;
        float stitchDetail = 1.0 - smoothstep(0.4, 1.0, fwidth(stitchPhase));
        diffuseColor.rgb *= 1.0 - 0.18 * (0.5 + 0.5 * cos(stitchPhase * 6.2831853)) * stitchDetail;
      `);
    };
    embroidery.customProgramCacheKey=()=> 'tarairon-cap-embroidery-v1';
    const geometry=grid(16,8,(u,v)=>{
      const height=.30+v*.40,radius=Math.pow(Math.cos(height*Math.PI/2),CROWN_ROUNDNESS);
      const angle=Math.asin((u-.5)*.076/(.102*radius));
      return crownPoint(angle,height).add(new Vector3(Math.sin(angle)*.0011,.0002,Math.cos(angle)*.0011));
    });
    const logo=add('white embroidered TARAIRON logo',geometry,embroidery);logo.castShadow=false;
  }
  return root;
}
