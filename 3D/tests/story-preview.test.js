import test from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {storyPreview} from '../story-preview.js';

function request(url,method='GET',hook='configurePreviewServer'){
  return new Promise((resolve,reject)=>{
    let middleware;storyPreview()[hook]({middlewares:{use:fn=>{middleware=fn;}}});
    const chunks=[],headers={};const res=new Writable({write(chunk,encoding,done){chunks.push(chunk);done();}});
    res.statusCode=200;res.setHeader=(name,value)=>{headers[name]=value;};res.on('error',reject);
    res.on('finish',()=>resolve({status:res.statusCode,headers,body:Buffer.concat(chunks).toString()}));
    middleware({url,method},res,()=>{res.statusCode=418;res.end('next');});
  });
}
test('the modal reader and its relative stylesheet load from the existing story directory',async()=>{
  const page=await request('/story/saga.html');assert.equal(page.status,200);assert.match(page.body,/<title>FALL-LINE/);assert.match(page.headers['Content-Type'],/text\/html/);
  const css=await request('/story/reader.css?v=2','GET','configureServer');assert.equal(css.status,200);assert.match(css.headers['Content-Type'],/text\/css/);
  const head=await request('/story/img/barrys.jpg','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');assert.ok(head.headers['Content-Length']>0);
});
test('story preview does not serve source files, hidden paths, traversal or write requests',async()=>{
  for(const url of ['/story/saga.md','/story/../AGENTS.md','/story/%2e%2e/AGENTS.md','/story/%2fetc/passwd','/story/.git/config'])assert.equal((await request(url)).status,404,url);
  assert.equal((await request('/story/saga.html','POST')).status,404);assert.equal((await request('/3D/obs.html')).status,418);
});
