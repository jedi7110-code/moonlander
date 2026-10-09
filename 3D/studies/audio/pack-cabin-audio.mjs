// Run with Node 20+ and ffmpeg. Input is a scratch directory containing the
// downloaded/extracted CC0 sources named in public/assets/obs/audio/CREDITS.md.
// No original multi-minute recordings or complete source packs are shipped.
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const input=process.argv[2];if(!input)throw new Error('Usage: node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY [CLIP_NAME ...]');
const selected=new Set(process.argv.slice(3));
const output=fileURLToPath(new URL('../../public/assets/obs/audio/',import.meta.url));
const recipes=[
  // One dry engagement, not the source's two separated metal clicks.
  ['latch','foley/sfx-cc0/handcuffs-metal-lock-01.wav',.065,.16,false,true,'highpass=f=180,lowpass=f=3800'],
  // Actual washer door contact, excluding the earlier handling and later bounce.
  ['appliance-lid','washer-door.mp3',.46,.22,false,true,'highpass=f=60,lowpass=f=1800'],
  ...[6.665,7.625,8.455].map((start,n)=>[`step-metal-boots-${n+1}`,'boots-metal.mp3',start,.52,false,true]),
  // Derive rung contacts from the shipped real boot recordings, not a generic
  // metal impact. Selected ladder clips can be rebuilt without downloading.
  ...[1,2,3].map(n=>[`step-ladder-boots-${n}`,new URL(`../../public/assets/obs/audio/step-metal-boots-${n}.wav`,import.meta.url),0,.30,false,true,'highpass=f=75,lowpass=f=2400']),
  ...[.615,1.270,2.555].map((start,n)=>[`step-rubber-${n+1}`,'rubber-sole.mp3',start,.42,false,true,'highpass=f=70,lowpass=f=4200']),
  // One real toolbox landing; cut before the lingering shell rattle.
  ['metal','toolbox-drop.mp3',2.555,.30,false,'cargo','highpass=f=45,lowpass=f=1800'],
  ['servo-stroke','servo-sweep.mp3',4.675,.20,false,'motor','highpass=f=100,lowpass=f=1800'],
  ['shower','shower.mp3',30,4,true],
  ['flush','flush.mp3',0,5],
  ['washer','washer.mp3',2,4,true],
  ['bag','foley/sfx-cc0/plastic-bag-pickup-01.wav',0,1.5],
  ['kibble-pour','cat-biscuit-pour.mp3',.60,3.12,true,false,'highpass=f=140,lowpass=f=6000'],
  ['cat-meow','cat-meow.mp3',0,1.544,false,true,'highpass=f=100,lowpass=f=6500'],
  ['chop','foley/sfx-cc0/apple-cut-01.wav',0,1.2],
];
const knownNames=new Set([...recipes.map(([name])=>name),'door-open-air-motor','door-close-air-motor']);
for(const name of selected)if(!knownNames.has(name))throw new Error(`Unknown clip: ${name}`);
const rate=22050;
function decode(file,start,duration,filter='highpass=f=75,lowpass=f=8000'){
  const source=file instanceof URL?fileURLToPath(file):path.join(input,file);
  const result=spawnSync('ffmpeg',['-v','error','-ss',String(start),'-i',source,'-t',String(duration),'-ac','1','-ar',String(rate),'-af',filter,'-f','f32le','pipe:1'],{maxBuffer:8*1024*1024});
  if(result.status!==0)throw new Error(result.stderr.toString());
  return Array.from({length:result.stdout.length/4},(_,i)=>result.stdout.readFloatLE(i*4));
}
const peakOf=samples=>samples.reduce((peak,sample)=>Math.max(peak,Math.abs(sample)),0);
async function writeWave(name,samples){
  const peak=peakOf(samples);if(peak<.001)throw new Error(`Silent sound: ${name}`);
  const gain=.3548/peak,pcm=Buffer.alloc(samples.length*2);
  samples.forEach((sample,i)=>pcm.writeInt16LE(Math.round(sample*gain*32767),i*2));
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  const target=path.join(output,name+'.wav'),temporary=target+`.${process.pid}.tmp`;
  try{await writeFile(temporary,Buffer.concat([header,pcm]));await rename(temporary,target);}
  finally{await rm(temporary,{force:true});}
  console.log(`${name}: ${(samples.length/rate).toFixed(3)} s, ${pcm.length+44} bytes`);
}
await mkdir(output,{recursive:true});
for(const [name,file,start,duration,loop,envelope,filter]of recipes){
  if(selected.size&&!selected.has(name))continue;
  const raw=decode(file,start,duration,filter);
  let samples=raw;
  if(loop){
    const fade=Math.min(Math.round(.12*rate),Math.floor(raw.length/4));
    samples=raw.slice(0,-fade);
    for(let i=0;i<fade;i++){const t=.5-.5*Math.cos(Math.PI*i/(fade-1));samples[i]=raw[raw.length-fade+i]*(1-t)+raw[i]*t;}
  }else if(envelope){
    // Preserve recorded contacts and short motor strokes instead of trimming
    // them into clicks. Motor strokes ease in/out more gently than footsteps.
    samples=raw.slice();
    const attack=Math.round((envelope==='motor'?.020:envelope==='cargo'?.003:.004)*rate),release=Math.round((envelope==='motor'?.080:envelope==='cargo'?.10:.045)*rate);
    for(let i=0;i<attack;i++)samples[i]*=i/(attack-1);
    for(let i=0;i<release;i++)samples[samples.length-1-i]*=i/(release-1);
  }else{
    let first=0,last=raw.length-1;
    while(first<last&&Math.abs(raw[first])<.002)first++;
    while(last>first&&Math.abs(raw[last])<.002)last--;
    samples=raw.slice(Math.max(0,first-110),Math.min(raw.length,last+330));
    const fade=Math.min(110,Math.floor(samples.length/4));
    for(let i=0;i<fade;i++){samples[i]*=i/fade;samples[samples.length-1-i]*=i/fade;}
  }
  await writeWave(name,samples);
}

// The user wants only the existing "bashu" air burst, not the trailing motor.
// Keep the legacy filenames so every hatch consumer receives the same change.
for(const name of ['door-open-air-motor','door-close-air-motor']){
  if(selected.size&&!selected.has(name))continue;
  const duration=.38;
  const samples=new Array(Math.round(duration*rate)).fill(0);
  const air=decode('foley/sfx-cc0/compressed-air-spray-02.wav',.15,.43,'highpass=f=320,lowpass=f=5800');
  if(air.length<samples.length)throw new Error(`Incomplete air source: ${name}`);
  for(let i=0;i<samples.length;i++){
    const t=i/rate,end=(samples.length-1-i)/rate;
    const fadeIn=Math.sin(Math.min(1,t/.008)*Math.PI/2)**2;
    const fadeOut=Math.sin(Math.min(1,end/.20)*Math.PI/2)**2;
    samples[i]=air[i]*fadeIn*fadeOut;
  }
  await writeWave(name,samples);
}
