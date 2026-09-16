export function relaxMiloHand({fingers,thumb,side}){
  for(const [i,finger] of fingers.entries()){
    // The thumb is on opposite sides of the left/right finger arrays.
    const rank=side<0?3-i:i;
    // Open the proximal segment; concentrate the relaxed bend at the PIP joint.
    finger.rotation.set([-.08,-.07,-.06,-.05][rank],0,0);
    finger.userData.links[0].rotation.set([.24,.28,.32,.36][rank],0,0);
    finger.userData.links[1].rotation.set([.02,.025,.03,.035][rank],0,0);
  }
  thumb.rotation.set(.16,0,side*.10);
  thumb.userData.ip.rotation.set(.28,0,0);
}
