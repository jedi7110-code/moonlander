import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const study=path.dirname(fileURLToPath(import.meta.url)),project=path.resolve(study,'../..'),port=Number(process.env.PORT??8768);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.webp':'image/webp','.css':'text/css'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(process.env.DEBUG_REQUESTS)console.log(req.method,url.pathname);
    let target=url.pathname==='/'?path.join(study,'index.html')
      :url.pathname.startsWith('/3D/assets/')?path.resolve(project,'public/assets',decodeURIComponent(url.pathname.slice('/3D/assets/'.length)))
      :['/js/obs/layout.js','/js/obs/i18n.js'].includes(url.pathname)?path.resolve(project,'..'+url.pathname)
      :url.pathname.startsWith('/3D/')?path.resolve(project,decodeURIComponent(url.pathname.slice(4))):null;
    if(!target)throw new Error('Not found');
    target=await realpath(target);const relative=path.relative(project,target);
    const sharedLayout=['layout.js','i18n.js'].some(name=>target===path.resolve(project,'../js/obs',name));
    if(!sharedLayout&&(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(s=>s.startsWith('.'))))throw new Error('Not found');
    const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Milo study: http://127.0.0.1:${port}/`));
