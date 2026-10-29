// Shared by the first lightweight loading frame and both Three.js viewers.
// All coordinates describe directions at infinity, never nearby particles.
export const STAR_COUNT=48000;
const normal=[.52,-.64,.56],length=Math.hypot(...normal);
const n=normal.map(value=>value/length),t=[n[2],0,-n[0]],tl=Math.hypot(...t);
const tangent=t.map(value=>value/tl),bitangent=[n[1]*tangent[2],n[2]*tangent[0]-n[0]*tangent[2],-n[1]*tangent[0]];
const randomFrom=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

export function createStarCatalog({count=STAR_COUNT,seed=735}={}){
  const random=randomFrom(seed),stars=[];
  for(let i=0;i<count;i++){
    const longitude=random()*Math.PI*2;
    let p;
    if(i<count*.75){
      const y=2*random()-1,r=Math.sqrt(1-y*y);p=[r*Math.cos(longitude),y,r*Math.sin(longitude)];
    }else{
      const latitude=Math.max(-.6,Math.min(.6,Math.sqrt(-2*Math.log(Math.max(1e-8,random())))*Math.cos(2*Math.PI*random())*.16));
      p=n.map((v,k)=>Math.sin(latitude)*v+Math.cos(latitude)*(tangent[k]*Math.cos(longitude)+bitangent[k]*Math.sin(longitude)));
    }
    const magnitude=random(),level=random(),temperature=random();
    const brightness=magnitude<.88?.01+.18*level**2:magnitude<.994?.22+.55*level**2:1.2+.9*level;
    const size=magnitude<.88?1+.45*random():magnitude<.994?1.3+.6*random():2+1.2*random();
    const tint=temperature<.1?[1,.86,.72]:temperature>.68?[.76,.87,1]:[.93,.96,1];
    stars.push({p,color:tint.map(value=>value*brightness),size,brightness});
  }
  return stars;
}

const fade=value=>value*value*(3-2*value),mix=(a,b,u)=>a+(b-a)*u;
function hash(x,y,z){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
function noise(x,y,z){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=fade(x-ix),v=fade(y-iy),w=fade(z-iz);
  return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),u),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),u),v),
    mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),u),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),u),v),w);
}
export function skyHazeColor([x,y,z]){
  const latitude=x*n[0]+y*n[1]+z*n[2],band=Math.exp(-((latitude/.26)**2));
  const broad=noise(x*3+31,y*3+13,z*3+47),detail=noise(x*11+19,y*11+37,z*11+23),dust=noise(x*7+73,y*7+41,z*7+59);
  const veil=band*(.15+broad*.65+detail*.20)*(1-dust*.70);
  return[.00045+veil*.0025,.00070+veil*.0075,.0015+veil*.018];
}
export const starGlow=radius=>radius>=1?0:.84*Math.exp(-radius*radius*12)+.16*Math.exp(-radius*radius*2.8);
export const srgbByte=value=>Math.round(255*Math.max(0,Math.min(1,value<=.0031308?12.92*value:1.055*value**(1/2.4)-.055)));
export const linearByte=byte=>{const value=byte/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;};
