import {DataTexture,RGBAFormat,SRGBColorSpace,LinearFilter,LinearMipmapLinearFilter} from 'three';

// Small deterministic bitmap atlases. Rivets, vents, scratches and tube glass
// are pixels, not additional geometry or transparent render passes.
function bitmap(width,height){
  const data=new Uint8Array(width*height*4);
  const pixel=(x,y,color,alpha=1)=>{
    x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=width||y>=height)return;
    const i=(y*width+x)*4;for(let k=0;k<3;k++)data[i+k]=data[i+k]*(1-alpha)+color[k]*alpha;data[i+3]=255;
  };
  const rect=(x,y,w,h,c,a=1)=>{for(let j=Math.floor(y);j<y+h;j++)for(let i=Math.floor(x);i<x+w;i++)pixel(i,j,c,a);};
  const line=(x1,y1,x2,y2,r,c,a=1)=>{
    const dx=x2-x1,dy=y2-y1,d=dx*dx+dy*dy;
    for(let y=Math.floor(Math.min(y1,y2)-r-1);y<=Math.max(y1,y2)+r+1;y++)for(let x=Math.floor(Math.min(x1,x2)-r-1);x<=Math.max(x1,x2)+r+1;x++){
      const t=d?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/d)):0;
      const cover=Math.max(0,Math.min(1,r+.5-Math.hypot(x-x1-t*dx,y-y1-t*dy)));if(cover)pixel(x,y,c,cover*a);
    }
  };
  const disc=(cx,cy,r,c,a=1)=>{for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++){const f=Math.max(0,Math.min(1,r+.5-Math.hypot(x-cx,y-cy)));if(f)pixel(x,y,c,f*a);}};
  const ring=(cx,cy,r,w,c,a=1)=>{for(let y=Math.floor(cy-r-w);y<=cy+r+w;y++)for(let x=Math.floor(cx-r-w);x<=cx+r+w;x++){const f=Math.max(0,Math.min(1,w+.5-Math.abs(Math.hypot(x-cx,y-cy)-r)));if(f)pixel(x,y,c,f*a);}};
  const texture=()=>{
    const t=new DataTexture(data,width,height,RGBAFormat);t.colorSpace=SRGBColorSpace;t.magFilter=LinearFilter;t.minFilter=LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
  };
  return {width,height,data,pixel,rect,line,disc,ring,texture};
}

export const DROID_TILES=Object.freeze({paint:0,dark:1,steel:2,bright:3,copper:4,rubber:5,bearing:6,vent:7,circuit:8,panel:9,limb:10,neck:11,brass:12,cloth:13,strap:14,foot:15});

export function createDroidSurfaceAtlas(){
  const b=bitmap(512,512),n=128;
  // Muted grey-green covers separate the droid from the pale cabin wall panels.
  const colors=[[128,136,126],[39,45,40],[96,106,103],[155,169,167],[116,70,47],[26,31,28],[74,82,76],[116,125,116],[48,57,48],[132,140,126],[119,130,120],[79,91,84],[165,137,69],[174,177,156],[52,60,51],[106,117,106]];
  let seed=3817;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  for(let tile=0;tile<16;tile++){
    const x0=tile%4*n,y0=Math.floor(tile/4)*n,c=colors[tile];
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const edge=Math.min(x,y,127-x,127-y),grain=(random()-.5)*9,stain=Math.sin(x*.08+y*.03)*Math.sin(y*.07)*6;
      const shade=(edge<4?-.12:0)+(tile===3?Math.sin(x*.027)*.16:0);
      b.pixel(x0+x,y0+y,c.map(v=>v*(1+shade)+grain+stain));
    }
    if([0,6,7,8,9,10,15].includes(tile)){
      b.line(x0+6,y0+6,x0+121,y0+6,1,[196,198,175],.5);b.line(x0+121,y0+7,x0+121,y0+121,1,[35,42,34],.5);
      for(const x of [12,115])for(const y of [12,115]){
        b.disc(x0+x,y0+y,4,[40,45,36]);b.disc(x0+x-.5,y0+y-.7,2.7,[114,121,105]);b.line(x0+x-2,y0+y,x0+x+2,y0+y,1,[26,33,27]);
      }
      for(let i=0;i<45;i++){
        const x=x0+4+random()*118,y=y0+4+random()*118;b.line(x,y,x+random()*7,y+(random()-.5)*2,.6,[41,47,38],.45);
      }
    }
    if(tile===6){
      for(const [r,w,c]of [[49,5,[25,31,27]],[43,2,[137,146,129]],[31,4,[39,46,39]],[25,1,[161,161,137]],[12,7,[116,99,63]],[5,4,[27,35,28]]])b.ring(x0+64,y0+64,r,w,c);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;b.disc(x0+64+Math.cos(a)*43,y0+64+Math.sin(a)*43,2,[28,34,28]);}
    }
    if([7,11].includes(tile))for(let y=26;y<108;y+=9){b.rect(x0+23,y0+y,82,4,[25,33,28]);b.line(x0+24,y0+y+5,x0+105,y0+y+5,.6,[193,195,168],.55);}
    if([8,10].includes(tile))for(let i=0;i<4;i++){
      const x=x0+27+i*22;b.line(x,y0+22,x+8,y0+39,1.4,i%2?[110,75,43]:[162,151,104]);b.line(x+8,y0+39,x+8,y0+96,1.4,[35,40,31]);b.disc(x+8,y0+100,4,[167,141,82]);
    }
    if(tile===9){b.rect(x0+24,y0+30,80,22,[44,54,45]);for(let i=0;i<6;i++)b.rect(x0+30+i*11,y0+35,6,10,[169,178,143]);b.rect(x0+26,y0+80,61,3,[65,74,60]);b.rect(x0+26,y0+88,42,3,[65,74,60]);}
    if([13,14,15].includes(tile))for(let y=25;y<112;y+=11)b.line(x0+14,y0+y,x0+113,y0+y,1,[43,54,43],.4);
  }
  return b.texture();
}

export function createDroidFaceAtlas(names,paths){
  const b=bitmap(1024,512),size=256;
  names.forEach((name,index)=>{
    const ox=index%4*size,oy=Math.floor(index/4)*size;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const light=Math.max(0,1-Math.hypot((x-128)/160,(y-123)/140));b.pixel(ox+x,oy+y,[10+light*10,13+light*4,12+light*1]);
    }
    // Two amber tube envelopes, dark sockets and the horizontal mouth module.
    for(const cx of [68,188]){
      for(let y=27;y<190;y++)for(let x=cx-41;x<=cx+41;x++){
        const round=Math.max(0,Math.abs(x-cx)-29)**2+Math.max(0,Math.abs(y-106)-68)**2;
        if(round<144){const sheen=Math.exp(-(((x-cx+25)/3)**2));b.pixel(ox+x,oy+y,[24+sheen*38,18+sheen*30,14+sheen*20]);}
      }
      b.rect(ox+cx-27,oy+182,54,8,[15,18,15]);b.line(ox+cx-23,oy+181,ox+cx+23,oy+181,1,[85,71,47]);
      b.line(ox+cx-29,oy+43,ox+cx-29,oy+167,1.1,[183,146,100],.32);
      for(let i=0;i<5;i++){
        b.line(ox+cx-22,oy+44+i*22,ox+cx+20,oy+64+i*20,.6,[113,64,30],.32);
        b.line(ox+cx+20,oy+45+i*23,ox+cx-20,oy+66+i*19,.6,[102,64,32],.25);
      }
      for(let x=cx-18;x<=cx+18;x+=12)b.line(ox+x,oy+187,ox+x,oy+197,1,[79,68,43]);
    }
    b.rect(ox+82,oy+208,92,21,[19,23,19]);b.line(ox+89,oy+210,ox+167,oy+210,1,[88,68,42],.6);
    const convert=([x,y])=>[ox+128+x*.8/.208*256,oy+128-(y<-.030?y-.005:y)/.172*256];
    for(const path of paths(name))for(let i=1;i<path.length;i++){
      const a=convert(path[i-1]),c=convert(path[i]);
      b.line(...a,...c,9,[218,56,8],.07);b.line(...a,...c,5,[255,84,14],.16);b.line(...a,...c,2.7,[255,125,33],.65);b.line(...a,...c,1.1,[255,214,139]);
    }
  });
  return b.texture();
}
