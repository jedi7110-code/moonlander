import {CabinLoungeGames} from './obs/lounge-games.js';
import {CHESS_HOLOGRAM_SETTINGS} from './obs/chess-hologram.js';
import {createIcons,X,Pause,RotateCw,Undo2,ArrowDownUp,Flag,RotateCcw,ArrowLeft,Rotate3d} from 'lucide';

const icons={X,Pause,RotateCw,Undo2,ArrowDownUp,Flag,RotateCcw,ArrowLeft,Rotate3d};
const games=new CabinLoungeGames({parent:document.body,refreshIcons:()=>createIcons({icons})});
const params=new URLSearchParams(location.search);
params.delete('translucency');params.delete('glow');
history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
games.chess.setAppearance(CHESS_HOLOGRAM_SETTINGS);
const pieceLink=document.createElement('a');pieceLink.className='chess-study-piece-link';
pieceLink.href='./chess-piece-study.html?material=hologram';pieceLink.textContent='駒を拡大して見る ↗';
games.chess.dialog.querySelector('.chess-sidebar').prepend(pieceLink);
document.querySelectorAll('[data-game]').forEach(button=>{
  button.addEventListener('click',()=>games.show(button.dataset.game==='menu'?null:button.dataset.game));
});

const initialGame=params.get('game');
games.show(['chess','poker','reversi'].includes(initialGame)?initialGame:null);
