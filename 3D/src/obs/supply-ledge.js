import {DataTexture,RGBAFormat,RepeatWrapping,LinearFilter,LinearMipmapLinearFilter,SRGBColorSpace} from 'three';

const TILE_WIDTH=1.28,STRIPE_PERIOD=.32,BAND_CENTER=-.035,BAND_HEIGHT=.16;

function safetyPaint(height){
  const width=512,rows=256,data=new Uint8Array(width*rows*4);
  const bottom=height/2+BAND_CENTER-BAND_HEIGHT/2,top=bottom+BAND_HEIGHT;
  for(let y=0;y<rows;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/rows,h=v*height,s=u*TILE_WIDTH;
    const grain=((Math.imul(x+7,374761393)^Math.imul(y+11,668265263))>>>0)%101/100-.5;
    const wear=Math.sin(u*Math.PI*26+Math.sin(v*23)*2)+Math.sin(u*Math.PI*58-v*61)+.45*Math.sin(u*Math.PI*94+v*113);
    const inBand=h>=bottom&&h<=top;
    let color=[31,35,31];
    if(inBand){
      color=(s+h)%STRIPE_PERIOD<STRIPE_PERIOD/2?[219,177,51]:[22,27,24];
      const edge=Math.min(h-bottom,top-h);
      if(wear>1.94||(edge<.002+Math.max(0,wear)*.003&&wear>.25)){
        color=wear>2.25?[91,87,71]:[100,61,33];
      }
    }
    const offset=(y*width+x)*4;
    for(let channel=0;channel<3;channel++)data[offset+channel]=Math.round(color[channel]*(1+grain*.12));
    data[offset+3]=255;
  }
  const map=new DataTexture(data,width,rows,RGBAFormat);
  map.name='Supply ledge / worn diagonal safety paint';map.colorSpace=SRGBColorSpace;
  map.wrapS=RepeatWrapping;map.generateMipmaps=true;map.minFilter=LinearMipmapLinearFilter;map.magFilter=LinearFilter;
  map.anisotropy=4;map.needsUpdate=true;return map;
}

// Paint the original plinth faces: no decal planes or extra stripe geometry.
export function paintSupplyLedge(mesh,{width,height,depth,radius}){
  const material=mesh.material.clone();material.name='Industrial / supply ledge safety paint';
  material.color.setHex(0xffffff);material.map=safetyPaint(height);
  material.roughness=.85;material.metalness=.25;material.roughnessMap=null;material.bumpMap=null;
  mesh.material=material;
  const {position,uv}=mesh.geometry.attributes,a=width/2-radius,b=depth/2-radius;
  for(const group of mesh.geometry.groups){
    const painted=[0,1,4].includes(group.materialIndex);
    for(let i=group.start;i<group.start+group.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),side=Math.sign(x);
      let distance=x;
      // Arc length keeps the stripe continuous around the two rounded front corners.
      if(Math.abs(x)>a&&z>b)distance=side*(a+radius*Math.atan2(Math.abs(x)-a,z-b));
      else if(group.materialIndex===0||group.materialIndex===1)distance=side*(a+Math.PI*radius/2+b-z);
      uv.setXY(i,distance/TILE_WIDTH,painted?(y+height/2)/height:0);
    }
  }
  uv.needsUpdate=true;
}
