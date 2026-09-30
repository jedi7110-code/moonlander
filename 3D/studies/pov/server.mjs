import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const host=process.env.POV_HOST??'127.0.0.1',port=Number(process.env.POV_PORT??8772);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try{
    const {pathname}=new URL(req.url,'http://localhost');let base,relative;
    if(pathname==='/'){res.writeHead(302,{Location:'/3D/studies/pov/index.html'});res.end();return;}
    else if(pathname.startsWith('/3D/assets/')){base=path.join(project,'public/assets');relative=decodeURIComponent(pathname.slice(11));}
    else if(pathname.startsWith('/3D/')){base=project;relative=decodeURIComponent(pathname.slice(4));}
    else if(pathname.startsWith('/js/obs/')){base=path.resolve(project,'../js/obs');relative=decodeURIComponent(pathname.slice(8));}
    else throw new Error('Not found');
    const file=await realpath(path.resolve(base,relative)),within=path.relative(base,file);
    if(within.startsWith('..')||path.isAbsolute(within)||within.split(path.sep).some(s=>s.startsWith('.')))throw new Error('Not found');
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,host,()=>console.log(`POV study: http://${host}:${port}/3D/studies/pov/index.html`));
