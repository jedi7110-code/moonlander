import {Group} from 'three';
import {box} from './materials.js';

// Four solid sides leave a real aperture: the glass can sit BEHIND the front
// panel without being hidden by a solid plate or painted onto the bezel.
export function displayFrame(parent,material,{x,y,z,width,height,depth,holeWidth,holeHeight,offsetX=0,offsetY=0}){
  const left=-width/2,right=width/2,bottom=-height/2,top=height/2;
  const a=offsetX-holeWidth/2,b=offsetX+holeWidth/2,c=offsetY-holeHeight/2,d=offsetY+holeHeight/2;
  if(!(a>left&&b<right&&c>bottom&&d<top))throw new Error('Display aperture must fit inside its frame');
  const root=new Group();root.name='Recessed display frame';root.position.set(x,y,z);parent.add(root);
  box(root,material,(left+a)/2,0,0,a-left,height,depth);
  box(root,material,(b+right)/2,0,0,right-b,height,depth);
  box(root,material,(a+b)/2,(bottom+c)/2,0,b-a,c-bottom,depth);
  box(root,material,(a+b)/2,(d+top)/2,0,b-a,top-d,depth);
  return root;
}
