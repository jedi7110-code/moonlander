import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
// Production already serves /story/. Give Vite the same local, read-only route
// so the modal uses one URL in development, preview and on the deployed site.
export function storyPreview({root=fileURLToPath(new URL('../story/',import.meta.url))}={}){
  const serve=async(req,res,next)=>{
    const raw=(req.url??'').split('?')[0];if(!raw.startsWith('/story/'))return next();
    try{
      if(!['GET','HEAD'].includes(req.method))throw new Error('Not found');
      let relative=decodeURIComponent(raw.slice('/story/'.length));
      if(relative.endsWith('/')||!relative)relative+='index.html';
      if(relative.split(/[\\/]/).some(part=>part.startsWith('.')))throw new Error('Not found');
      const base=await realpath(root),file=await realpath(path.resolve(base,relative)),within=path.relative(base,file),type=types[path.extname(file).toLowerCase()];
      if(!type||within.startsWith('..')||path.isAbsolute(within))throw new Error('Not found');
      const info=await stat(file);if(!info.isFile())throw new Error('Not found');
      res.setHeader('Content-Type',type);res.setHeader('Content-Length',info.size);res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');
      if(req.method==='HEAD'){res.end();return;}
      const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
    }catch{res.statusCode=404;res.end('Not found');}
  };
  const mount=server=>{server.middlewares.use(serve);};
  return{name:'local-story-preview',configureServer:mount,configurePreviewServer:mount};
}
