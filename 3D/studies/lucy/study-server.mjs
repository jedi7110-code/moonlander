import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const study=path.dirname(fileURLToPath(import.meta.url)),project=path.resolve(study,'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.css':'text/css'};
const port=Number(process.env.PORT??8767);
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    let target;
    if(url.pathname==='/'||url.pathname==='/review/all-actions.html')target=path.join(study,'all-actions.html');
    else if(url.pathname==='/review/outline-study.glb')target=path.join(project,'public/assets/obs/lucy/lucy-cabin.glb');
    else if(url.pathname==='/review/sleep-side.glb')target=path.join(study,'assets/sleep-side.glb');
    else if(['/js/obs/layout.js','/js/obs/i18n.js'].includes(url.pathname))target=path.resolve(project,'..'+url.pathname);
    else if(url.pathname.startsWith('/3D/'))target=path.resolve(project,decodeURIComponent(url.pathname.slice(4)));
    if(!target)throw new Error('Not found');
    target=await realpath(target);
    const relative=path.relative(project,target);
    const sharedLayout=['layout.js','i18n.js'].some(name=>target===path.resolve(project,'../js/obs',name));
    if(!sharedLayout&&(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(s=>s.startsWith('.'))))throw new Error('Not found');
    const data=await readFile(target);
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Lucy study: http://127.0.0.1:${port}/review/all-actions.html`));
