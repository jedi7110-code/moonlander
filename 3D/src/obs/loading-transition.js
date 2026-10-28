// The cabin has already drawn behind the loader. Keep it covered until the
// CRT line has collapsed to a point and the last glow has faded.
export async function closeLoadingScreen(root){
  if(!root||root.hidden)return;
  root.classList.add('is-switching');
  try{
    root.ownerDocument?.defaultView?.getComputedStyle(root).animationName;
    await Promise.allSettled((root.getAnimations?.({subtree:true})??[]).map(animation=>animation.finished));
  }finally{
    root.hidden=true;
    root.classList.remove('is-switching');
  }
}
