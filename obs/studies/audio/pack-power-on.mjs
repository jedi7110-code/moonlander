// User-supplied source, not CC0. Only the short edit ships; leave the SSD intact.
// Usage: node studies/audio/pack-power-on.mjs '/path/to/sounds'
import {spawnSync} from 'node:child_process';
import {readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const input=process.argv[2];
if(!input)throw new Error('Usage: node studies/audio/pack-power-on.mjs SOURCE_DIRECTORY');
const source=path.join(input,'Glitch 13.wav'),rate=22050;
const samples=new Float32Array(Math.round(rate*1.05));
// Two short starter fragments follow the lamps at 0 and 0.25 s. A subdued,
// filtered fragment settles underneath the ramp; no sine ping or low impact.
const cuts=[
  {start:.32,duration:.125,offset:0,level:1,attack:.008,release:.045,lowpass:5400},
  {start:.62,duration:.13,offset:.25,level:.82,attack:.008,release:.05,lowpass:4800},
  {start:1.10,duration:.60,offset:.45,level:.36,attack:.035,release:.28,lowpass:2600},
];
for(const cut of cuts){
  const result=spawnSync('ffmpeg',['-v','error','-ss',String(cut.start),'-i',source,'-t',String(cut.duration),'-ac','1','-ar',String(rate),'-af',`highpass=f=650,lowpass=f=${cut.lowpass}`,'-f','f32le','pipe:1'],{maxBuffer:1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(result.stderr.toString());
  const count=result.stdout.length/4;
  if(count<Math.floor(rate*cut.duration)-2)throw new Error('Source is shorter than the edit recipe');
  for(let i=0;i<count;i++){
    const value=result.stdout.readFloatLE(i*4);
    if(!Number.isFinite(value))throw new Error('Non-finite source sample');
    const attack=Math.sin(Math.min(1,i/rate/cut.attack)*Math.PI/2)**2;
    const release=Math.sin(Math.min(1,(count-1-i)/rate/cut.release)*Math.PI/2)**2;
    const target=Math.round(cut.offset*rate)+i;
    if(target<samples.length)samples[target]+=value*cut.level*attack*release;
  }
}
const peak=samples.reduce((p,s)=>Math.max(p,Math.abs(s)),0);
if(peak<.001)throw new Error('Silent edit');
const pcm=Buffer.alloc(samples.length*2),gain=.3548/peak;
samples.forEach((value,i)=>pcm.writeInt16LE(Math.round(value*gain*32767),i*2));
const header=Buffer.alloc(44);
header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);
header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);
header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
const output=fileURLToPath(new URL('../../public/assets/obs/audio/power-on-glitch.wav',import.meta.url));
const temporary=output+`.${process.pid}.tmp`;
await mkdir(path.dirname(output),{recursive:true});
try{await writeFile(temporary,Buffer.concat([header,pcm]));await rename(temporary,output);}
finally{await rm(temporary,{force:true});}
console.log(JSON.stringify({source:path.basename(source),sha256:createHash('sha256').update(await readFile(source)).digest('hex'),cuts,output,duration:samples.length/rate,bytes:44+pcm.length},null,2));
