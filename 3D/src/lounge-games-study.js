import {CabinLoungeGames} from './obs/lounge-games.js';
import {createIcons,X,Pause,RotateCw,Undo2,ArrowDownUp,Flag,RotateCcw,ArrowLeft} from 'lucide';

const icons={X,Pause,RotateCw,Undo2,ArrowDownUp,Flag,RotateCcw,ArrowLeft};
const games=new CabinLoungeGames({parent:document.body,refreshIcons:()=>createIcons({icons})});
document.querySelectorAll('[data-game]').forEach(button=>{
  button.addEventListener('click',()=>games.show(button.dataset.game==='menu'?null:button.dataset.game));
});

const initialGame=new URLSearchParams(location.search).get('game');
games.show(['chess','poker','reversi'].includes(initialGame)?initialGame:null);
