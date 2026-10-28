// The chunks and stylesheets a Vite entry pulls in, from the build manifest.
// Keys are root-relative ('obs/main.js'); a suffix match tolerates the root.
export function chunkFiles(manifest,entry){
  const key=Object.keys(manifest).find(name=>name===entry||name.endsWith('/'+entry));
  if(!key)return [];
  const files=[],seen=new Set();
  const visit=name=>{
    // An HTML key is the page itself, whose own graph is already loaded.
    if(seen.has(name)||name.endsWith('.html'))return;seen.add(name);
    const item=manifest[name];if(!item)return;
    files.push(item.file);files.push(...(item.css??[]));
    for(const dependency of item.imports??[])visit(dependency);
  };
  visit(key);
  return [...new Set(files)];
}

// Pull every URL into the HTTP cache one at a time, lowest priority, so the
// opening film's own picture and loads are never contended. A `stop` message
// ends the run after the request in flight.
export async function prefetchSequence({urls,fetch:request=fetch,cache='default',isStopped=()=>false,onProgress=()=>{}}){
  const failed=[];let files=0,bytes=0;
  for(const url of urls){
    if(isStopped())break;
    onProgress(url,files,urls.length);
    try{
      const response=await request(url,{priority:'low',cache,credentials:'same-origin'});
      bytes+=(await response.arrayBuffer()).byteLength;
      if(!response.ok)failed.push(url);
    }catch{failed.push(url);}
    files++;
  }
  return {files,total:urls.length,bytes,failed,stopped:isStopped()};
}
