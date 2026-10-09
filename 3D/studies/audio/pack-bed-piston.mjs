// CC0 cylinder (tray) and Pixabay gas strut (lid); see CREDITS.md.
// Usage: node studies/audio/pack-bed-piston.mjs CYLINDER_MP3 GAS_STRUT_MP3
// Source and license are recorded in public/assets/obs/audio/CREDITS.md.
import {spawnSync} from 'node:child_process';
import {readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const source=process.argv[2],strutSource=process.argv[3];
if(!source||!strutSource)throw new Error('Usage: node studies/audio/pack-bed-piston.mjs CYLINDER_MP3 GAS_STRUT_MP3');
const strutHash=createHash('sha256').update(await readFile(strutSource)).digest('hex');
if(strutHash!=='c8959326b07b18ccbb1d5d3d859afe0a53ae8a6c5990c485842efd925e1bcf59')throw new Error('Expected Pixabay gas strut #255504; do not substitute a hiss recording');
const rate=22050,start=.40,sourceDuration=1.05,pitch=.90;
const output=fileURLToPath(new URL('../../public/assets/obs/audio/',import.meta.url));
await mkdir(output,{recursive:true});
for(const [name,duration,attack,release]of [['bed-piston',.52,.045,.065],['bed-slide',1.4,.12,.20]]){
  const lid=name==='bed-piston',cutStart=lid?1.74:start,cutDuration=lid?.52:sourceDuration;
  // The user-selected extension around second 2, excluding handling/impacts.
  // Discard the first 160 ms of the former cut, whose rendered onset the user
  // reported as voice-like. Preserve only the later sliding portion.
  // The lid stays at its original speed and duration: no time stretch, padding,
  // repeated strokes, loop, synthetic motor or added hiss.
  // The tray recipe is intentionally unchanged.
  const tempo=lid?1:Math.sqrt(sourceDuration/pitch/duration);
  const filter=lid?`atrim=duration=${cutDuration},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=6500`:
    `atrim=duration=${sourceDuration},asetpts=PTS-STARTPTS,aresample=${rate},asetrate=${Math.round(rate*pitch)},aresample=${rate},atempo=${tempo},atempo=${tempo},highpass=f=160,lowpass=f=3200,apad,atrim=duration=${duration}`;
  const result=spawnSync('ffmpeg',['-v','error','-ss',String(cutStart),'-i',lid?strutSource:source,'-ac','1','-af',filter,'-ar',String(rate),'-f','f32le','pipe:1'],{maxBuffer:1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(result.stderr.toString());
  const samples=new Float32Array(Math.round(rate*duration));
  const raw=Float32Array.from({length:result.stdout.length/4},(_,i)=>result.stdout.readFloatLE(i*4));
  if(raw.some(value=>!Number.isFinite(value)))throw new Error('Non-finite source sample');
  if(raw.length!==samples.length)throw new Error('Unexpected rendered duration');
  samples.set(raw);
  let peak=0;
  for(let i=0;i<samples.length;i++){
    const value=samples[i];
    if(!Number.isFinite(value))throw new Error('Non-finite sample');
    const envelope=Math.sin(Math.min(1,i/rate/attack)*Math.PI/2)**2*Math.sin(Math.min(1,(samples.length-1-i)/rate/release)*Math.PI/2)**2;
    samples[i]=value*envelope;peak=Math.max(peak,Math.abs(samples[i]));
  }
  if(peak<.001)throw new Error('Silent source');
  const pcm=Buffer.alloc(samples.length*2);
  samples.forEach((value,i)=>pcm.writeInt16LE(Math.round(value/peak*.3548*32767),i*2));
  const header=Buffer.alloc(44);
  header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);
  header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
  header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);
  header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  const target=path.join(output,name+'.wav'),temporary=target+`.${process.pid}.tmp`;
  try{await writeFile(temporary,Buffer.concat([header,pcm]));await rename(temporary,target);}
  finally{await rm(temporary,{force:true});}
  console.log(JSON.stringify({name,duration,start:cutStart,sourceDuration:cutDuration,pitch:lid?1:pitch,tempo,attack,release,bytes:44+pcm.length}));
}
for(const file of [source,strutSource])console.log(path.basename(file),'SHA-256:',createHash('sha256').update(await readFile(file)).digest('hex'));
