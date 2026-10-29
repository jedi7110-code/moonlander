import {CanvasTexture,SRGBColorSpace} from 'three';

// Printed artwork only: this adds no geometry, light or per-frame update.
export function createCautionLabelTexture(){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=576;
  const c=canvas.getContext('2d');
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const text=(value,y,size=11,color='#28271c',bold=false)=>{
    c.fillStyle=color;c.font=`${bold?'bold ':''}${size}px Arial`;c.textAlign='center';c.fillText(value,128,y);
  };
  rect(10,8,236,440,'#4c4325');rect(14,12,228,432,'#d8b737');
  rect(18,17,220,52,'#24251b');text('CAUTION',55,34,'#e1c550',true);
  c.beginPath();c.moveTo(128,93);c.lineTo(81,174);c.lineTo(175,174);c.closePath();
  c.strokeStyle='#302e20';c.lineWidth=4;c.stroke();text('!',160,49,'#302e20',true);
  text('MOVING LOADS',204,20,'#28271c',true);
  text('KEEP CLEAR OF',231,14,'#28271c',true);
  text('SUSPENDED CARGO',250,14,'#28271c',true);
  rect(29,264,198,2,'#665621');
  [
    'SECURE CARGO BEFORE',
    'OPERATING THE HATCH.',
    'CHECK ALL RESTRAINTS',
    'AND LIFTING EQUIPMENT.',
    '',
    'DO NOT STAND BENEATH',
    'THE HOIST OR MOVING LOAD.',
  ].forEach((line,i)=>text(line,284+i*16,11));
  rect(18,415,220,22,'#2c2b1e');text('AUTHORIZED PERSONNEL ONLY',430,9,'#dfc453',true);
  rect(10,462,236,106,'#574923');rect(14,466,228,98,'#d8b737');
  rect(18,471,220,24,'#2c2b1e');text('CAUTION',489,16,'#dfc453',true);
  text('KEEP THIS AREA',521,12,'#28271c',true);text('CLEAR AT ALL TIMES',541,12,'#28271c',true);
  // Fine wear remains inside the two pieces of paper.
  c.save();c.beginPath();c.rect(10,8,236,440);c.rect(10,462,236,106);c.clip();
  let seed=7110;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1600;i++)rect(random()*256,random()*576,1+random()*4,1+random()*2,i%2?'#362b1d18':'#f4e4a21c');
  for(const y of [9,445,463,565])for(let i=0;i<32;i++)rect(10+random()*236,y-2,1+random()*5,2+random()*3,'#e5d8aa99');
  c.restore();
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
  texture.name='Cargo hatch / worn yellow caution label';return texture;
}
