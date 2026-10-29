import {ai} from 'js-chess-engine';

self.onmessage=({data})=>{
  try{
    const result=ai(data.fen,{level:data.level,randomness:30,ttSizeMB:2});
    const [from,to]=Object.entries(result.move)[0];
    self.postMessage({fen:data.fen,move:{from:from.toLowerCase(),to:to.toLowerCase(),promotion:'q'}});
  }catch{
    self.postMessage({fen:data.fen,error:true});
  }
};
