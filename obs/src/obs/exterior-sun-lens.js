// Source: KMZ/Zenit archive, Jupiter-8: 6 elements / 3 cemented groups,
// single-layer coating, 9 iris blades. Group layout is Sonnar 1 + 3 + 2.
// https://www.zenitcamera.com/archive/lenses/jupiter-8.html
// Only the topology is historical data. Normalised axial spacing, residual
// reflectances and ghost footprints below are an authored optical approximation,
// NOT the unpublished radii/glass prescription of a particular Jupiter-8.
export const EXTERIOR_SUN_LENS=Object.freeze({
  name:'Jupiter-8 / Sonnar',elements:6,blades:9,coating:'single-layer',
  groups:Object.freeze([
    Object.freeze({elements:1,front:0,back:.14}),
    Object.freeze({elements:3,front:.24,back:.60}),
    Object.freeze({elements:2,front:.72,back:1}),
  ]),
});
export const SUN_GHOST_COUNT=9;

export function sunLensGhosts(lens=EXTERIOR_SUN_LENS){
  const surfaces=[];
  for(const [groupIndex,group] of lens.groups.entries()){
    for(let boundary=0;boundary<=group.elements;boundary++){
      const air=boundary===0||boundary===group.elements;
      surfaces.push({group:groupIndex,air,z:group.front+(group.back-group.front)*boundary/group.elements,
        reflectance:air?.018:.0004});
    }
  }
  const paths=[];
  for(let front=0;front<surfaces.length-1;front++)for(let rear=front+1;rear<surfaces.length;rear++){
    const a=surfaces[front],b=surfaces[rear],span=b.z-a.z,mid=(a.z+b.z)/2;
    const energy=a.reflectance*b.reflectance*Math.pow(.98,2*(rear-front));
    paths.push({front,rear,air:a.air&&b.air,groupPair:`${a.group}/${b.group}`,energy,
      axis:.85-4.4*mid+.50*span,radius:.008+.12*span+.017*(1-mid),
      softness:.06+.12*span});
  }
  // Keep every path for inspection. The visible approximation takes one
  // same-group ghost and two cross-group ghosts per group pair. Weaker paths
  // are omitted from individually drawn ghosts in this real-time approximation.
  const selected=[],pairs=new Map();
  for(const path of paths.filter(path=>path.air).sort((a,b)=>b.energy-a.energy)){
    const [a,b]=path.groupPair.split('/'),limit=a===b?1:2,count=pairs.get(path.groupPair)??0;
    if(count>=limit)continue;
    selected.push(path);pairs.set(path.groupPair,count+1);
  }
  const peak=Math.max(...selected.map(path=>path.energy));
  const ghosts=selected.map(path=>({...path,strength:.062*path.energy/peak/(.7+path.radius*6)}));
  return{surfaces,paths,ghosts};
}
