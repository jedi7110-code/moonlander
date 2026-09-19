import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const project=fileURLToPath(new URL('../..',import.meta.url));
const port=Number(process.env.PORT??8770);
const server=await createServer({
  configFile:false,root:project,base:'/',publicDir:path.join(project,'public'),
  optimizeDeps:{entries:['studies/cabin/index.html']},
  server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[path.dirname(project)]}},
  plugins:[{name:'cabin-study-entry',configureServer(server){
    server.middlewares.use((req,_res,next)=>{
      if(req.url==='/'||req.url?.startsWith('/?'))req.url='/studies/cabin/index.html'+req.url.slice(1);
      next();
    });
  }}],
});
await server.listen();
console.log(`Cabin study: http://127.0.0.1:${port}/`);
