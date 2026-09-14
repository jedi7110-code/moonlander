import {writeFile} from 'node:fs/promises';
import {MeshStandardMaterial} from 'three';
import {hangingSuit} from '../../src/obs/eva-suit.js';
const material=new MeshStandardMaterial();
globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*16};}};}};}};
const suit=hangingSuit(new Proxy({},{get:()=>material}),0);delete globalThis.document;suit.updateMatrixWorld(true);
const parts=[];suit.traverse(mesh=>{if(mesh.name!=='Tailored pressure garment'||mesh.parent.parent!==suit)return;const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);parts.push({positions:Array.from(geometry.attributes.position.array),indices:Array.from(geometry.index.array)});geometry.dispose();});
await writeFile(process.argv[2],JSON.stringify({parts}));console.log('Exported garment sections:',parts.length);
