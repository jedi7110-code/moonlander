export function loungeGamePromptAvailable(brain,gamesOpen=false){
  return !gamesOpen&&brain.isSeatedInLounge()&&!brain.loungeEntry&&!brain.loungeExit&&!brain.gamePending;
}

// Screen pixels relative to the canvas/viewport, not to the browser window.
export function loungeGamePromptPosition(point,width,height,popupWidth,popupHeight){
  if(!point||![point.x,point.y,point.z,width,height,popupWidth,popupHeight].every(Number.isFinite))return null;
  if(point.z< -1||point.z>1||point.x<0||point.x>width||point.y<0||point.y>height)return null;
  const inset=12,bottom=point.y-10;
  if(popupWidth>width-inset*2||bottom-popupHeight<inset)return null;
  return{x:Math.max(inset+popupWidth/2,Math.min(width-inset-popupWidth/2,point.x)),y:bottom};
}

export function updateLoungeGamePrompt(element,brain,gamesOpen,view){
  if(!view||!loungeGamePromptAvailable(brain,gamesOpen)){element.hidden=true;return;}
  element.hidden=false;
  const position=loungeGamePromptPosition(view.miloHeadScreenPosition(),view.width,view.height,element.offsetWidth,element.offsetHeight);
  element.hidden=!position;
  if(position){element.style.left=`${position.x}px`;element.style.top=`${position.y}px`;}
}
