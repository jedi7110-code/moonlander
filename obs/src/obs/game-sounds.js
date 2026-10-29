// Short, dry contact sounds. Generated locally, with no media downloads.
const contacts={
  chessYou:{duration:.19,modes:[[420,.52,32],[760,.22,46],[1230,.10,65]],noise:.30,decay:110},
  chessMilo:{duration:.22,modes:[[310,.55,27],[615,.21,43],[1080,.10,62]],noise:.32,decay:95},
  reversiYou:{duration:.13,modes:[[790,.40,48],[1470,.23,72],[2260,.11,100]],noise:.44,decay:170},
  reversiMilo:{duration:.14,modes:[[610,.43,45],[1160,.22,68],[1820,.10,95]],noise:.40,decay:155},
};
export function gameContactSamples(kind,sampleRate){
  const contact=contacts[kind];if(!contact)return null;
  const samples=new Float32Array(Math.ceil(contact.duration*sampleRate));
  let seed=71237,low=0,peak=0;
  const pitch=.975;
  for(let i=0;i<samples.length;i++){
    const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const noise=seed/2147483648-1;low+=.25*(noise-low);
    let value=(noise-low)*contact.noise*Math.exp(-t*contact.decay);
    for(const [frequency,amplitude,decay]of contact.modes)value+=amplitude*Math.sin(2*Math.PI*frequency*pitch*t)*Math.exp(-decay*t);
    value*=Math.min(1,t/.0015)*Math.min(1,(contact.duration-t)/.012);
    samples[i]=value;peak=Math.max(peak,Math.abs(value));
  }
  for(let i=0;i<samples.length;i++)samples[i]*=.35/Math.max(peak,.001);
  samples[samples.length-1]=0;return samples;
}
export function gameSoundSequence({game,move,side=1}={}){
  if(game==='chess')return[{kind:move?.color==='b'?'chessMilo':'chessYou',delay:0,volume:1}];
  if(game!=='reversi')return[];
  return[{kind:side===-1?'reversiMilo':'reversiYou',delay:0,volume:.85}];
}
