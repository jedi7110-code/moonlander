import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const input=process.argv[2]??fileURLToPath(new URL('./coffee-samples/A-nespresso-extraction.wav',import.meta.url));
const source=await readFile(input);
if(createHash('sha256').update(source).digest('hex')!=='9e3030e1f7dbd20b0028a8563e8c86b0205e20187d243d9798fcf1937e4284f7')throw Error('The input is not the approved A audition');
const directory=new URL('../../public/assets/obs/audio/',import.meta.url);await mkdir(directory,{recursive:true});
const output=fileURLToPath(new URL('coffee-machine-a-20s.wav',directory));
const result=spawnSync('ffmpeg',['-y','-v','error','-i',input,'-t','20','-ac','1','-ar','22050','-af','afade=t=out:st=19.92:d=0.08','-c:a','pcm_s16le','-bitexact',output],{encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr);
console.log(output);
