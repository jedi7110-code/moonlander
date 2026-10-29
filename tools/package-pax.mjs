// Assemble the FTP upload for https://www.paxcreation.com/moon/.
//
//   node tools/package-pax.mjs            -> pax-upload/moon/
//
// paxcreation.com is a plain nginx host: vercel.json rewrites do not apply and
// unknown paths answer 200 with the company top page. So the cabin is built
// with base /moon/obs/ and its output is placed at moon/obs/ directly, where
// every URL it requests exists as a real file. The game and story use only
// relative paths. Of their tracked files only what a browser loads is copied
// (pages, scripts, styles, images, audio, fonts and licence texts), so working
// notes, manuscripts and build scripts never reach the public host even when
// .vercelignore does not list them.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'pax-upload','moon');
if(fs.existsSync(out)){
  console.error(`${path.relative(root,out)} already exists. Move or delete it, then run again.`);
  process.exit(1);
}

execFileSync('npm',['run','build:pax'],{cwd:path.join(root,'obs'),stdio:'inherit'});

const privatePatterns=fs.readFileSync(path.join(root,'.vercelignore'),'utf8').split('\n')
  .map(line=>line.trim()).filter(line=>line&&!line.startsWith('#'));
const WEB=/\.(html|css|js|ico|png|jpe?g|gif|svg|webp|avif|mp3|wav|ogg|m4a|otf|ttf|woff2?)$/i;
const LICENCE=/(licen[cs]e|credits|attribution)[^/]*\.(txt|md)$/i;
const hidden=file=>{
  const parts=file.split('/');
  if(parts[0]==='obs'||parts[0]==='tools')return true; // obs comes from the pax build
  if(!WEB.test(file)&&!LICENCE.test(file))return true;
  if(parts.some(part=>part.startsWith('.')||part==='tests'))return true;
  return privatePatterns.some(pattern=>pattern.endsWith('/')
    ?parts.slice(0,-1).includes(pattern.slice(0,-1))
    :file===pattern);
};

const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
let files=0,bytes=0;
const copy=(from,to)=>{
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);files++;bytes+=fs.statSync(to).size;
};
for(const file of tracked)if(!hidden(file))copy(path.join(root,file),path.join(out,file));

const built=path.join(root,'obs','dist-pax');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).filter(entry=>!entry.name.startsWith('.')).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?walk(full):[full];
});
for(const file of walk(built))copy(file,path.join(out,'obs',path.relative(built,file)));

// Any root-absolute /obs/ URL left in the cabin build would miss /moon/.
const stray=walk(path.join(out,'obs')).filter(file=>/\.(html|js|css|json)$/.test(file))
  .flatMap(file=>[...fs.readFileSync(file,'utf8').matchAll(/(?<![\w/.-])\/obs\/[\w./-]*/g)]
    .map(match=>`${path.relative(out,file)}: ${match[0]}`));
console.log(`\n${path.relative(root,out)}: ${files} files, ${(bytes/1048576).toFixed(1)} MB`);
if(stray.length){
  console.error(`Root-absolute /obs/ URLs that will not resolve under /moon/:\n${stray.slice(0,20).join('\n')}`);
  process.exit(1);
}
