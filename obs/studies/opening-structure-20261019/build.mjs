import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const project=new URL('./',import.meta.url);
await mkdir(new URL('./assets/',project),{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('./entry.js',project))],bundle:true,format:'esm',target:'es2022',
  minify:true,outfile:fileURLToPath(new URL('./assets/film.js',project)),logLevel:'info'});
await copyFile(new URL('../../public/assets/obs/tarairon-wordmark.svg',project),new URL('./assets/tarairon-wordmark.svg',project));
