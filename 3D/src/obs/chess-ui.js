import {ChessMatch,CHESS_SAVE_KEY} from './chess-match.js';
import {pieceSVG} from './chess-pieces.js';
import {getLang} from '../../../js/obs/i18n.js?v=15';
import './chess.css';

const words=(ja,en)=>getLang()==='ja'?ja:en;
const names={p:['ポーン','Pawn'],r:['ルーク','Rook'],n:['ナイト','Knight'],b:['ビショップ','Bishop'],q:['クイーン','Queen'],k:['キング','King']};
const icon=name=>`<i data-lucide="${name}"></i>`;

export class CabinChess {
  constructor({parent,onClose,onMove,onResult,refreshIcons}){
    this.onClose=onClose;this.onMove=onMove;this.onResult=onResult;this.refreshIcons=refreshIcons;
    this.worker=null;this.epoch=0;this.selected=null;this.promotion=null;this.flipped=false;this.error=false;
    let saved=null;try{saved=JSON.parse(localStorage.getItem(CHESS_SAVE_KEY));}catch{}
    this.match=new ChessMatch(saved);
    this.dialog=document.createElement('dialog');this.dialog.id='cabin-chess';this.dialog.setAttribute('aria-labelledby','chess-title');
    this.dialog.innerHTML=`
      <header class="chess-header"><div><span>RECREATION / TARAIRON</span><h2 id="chess-title"></h2></div><button data-action="close" class="icon-button">${icon('x')}</button></header>
      <div class="chess-layout">
        <section class="chess-table">
          <div class="chess-player"><span class="chess-side carbon-dot"></span><strong>MILO JARVIS</strong><span id="chess-turn" role="status" aria-live="polite"></span></div>
          <div class="chess-board" role="grid" aria-label="Chess board"></div>
          <div class="chess-player"><span class="chess-side ivory-dot"></span><strong id="chess-you"></strong><span id="chess-last-move"></span></div>
        </section>
        <aside class="chess-sidebar">
          <label class="chess-level"><span id="chess-level-label"></span><select id="chess-level" aria-labelledby="chess-level-label"><option value="1"></option><option value="2"></option><option value="3"></option></select></label>
          <div class="chess-comms"><span>MILO</span><p id="chess-comment" role="status" aria-live="polite"></p><button data-action="retry" hidden>${icon('rotate-cw')}<span></span></button></div>
          <section class="chess-score"><h3 id="chess-score-title"></h3><ol id="chess-moves"></ol></section>
          <div class="chess-paused">${icon('pause')}<span id="chess-paused-label"></span></div>
        </aside>
      </div>
      <div id="chess-promotion" class="chess-promotion" role="group" hidden><strong id="chess-promotion-label"></strong><div></div></div>
      <div id="chess-confirm" class="chess-confirm" hidden><span></span><button data-action="cancel-confirm"></button><button data-action="confirm"></button></div>
      <footer class="chess-footer"><button data-action="close" class="chess-return">${icon('arrow-left')}<span></span></button><div>
        <button data-action="undo" class="icon-button">${icon('undo-2')}</button><button data-action="flip" class="icon-button">${icon('arrow-down-up')}</button><button data-action="resign" class="icon-button">${icon('flag')}</button><button data-action="new" class="icon-button">${icon('rotate-ccw')}</button>
      </div></footer>`;
    parent.append(this.dialog);
    this.board=this.dialog.querySelector('.chess-board');this.cells=[];
    for(let i=0;i<64;i++){
      const button=document.createElement('button');button.type='button';button.className='chess-square';button.setAttribute('role','gridcell');button.tabIndex=i===52?0:-1;
      button.addEventListener('click',()=>this.choose(button.dataset.square));this.cells.push(button);this.board.append(button);
    }
    this.board.addEventListener('keydown',event=>{
      const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];if(!delta)return;
      const index=this.cells.indexOf(document.activeElement);if(index<0)return;
      event.preventDefault();const target=this.cells[Math.max(0,Math.min(63,index+delta))];this.cells.forEach(cell=>cell.tabIndex=cell===target?0:-1);target.focus();
    });
    this.dialog.addEventListener('click',event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action)this.action(action);});
    this.dialog.querySelector('#chess-level').addEventListener('change',event=>{this.match.level=Number(event.target.value);this.save();this.cancelAI();this.think();this.render();});
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.dialog.addEventListener('close',()=>{
      this.cancelAI();this.save();this.onClose?.();
      if(this.returnFocus?.isConnected)this.returnFocus.focus();
    });
    this.visibility=()=>{if(document.hidden)this.cancelAI();else this.think();};document.addEventListener('visibilitychange',this.visibility);
  }
  get open(){return this.dialog.open;}
  $(id){return this.dialog.querySelector('#chess-'+id);}
  save(){try{localStorage.setItem(CHESS_SAVE_KEY,JSON.stringify(this.match.serialize()));this.saveFailed=false;}catch{this.saveFailed=true;}}
  show(){
    if(this.open)return;
    this.returnFocus=document.activeElement;this.selected=null;this.promotion=null;this.confirmation=null;
    this.dialog.showModal();this.render();this.think();this.cells.find(cell=>cell.dataset.square==='e2').focus();
  }
  close(){if(this.open)this.dialog.close();}
  cancelAI(){this.epoch++;this.worker?.terminate();this.worker=null;clearTimeout(this.watchdog);clearTimeout(this.replyTimer);this.thinking=false;}
  think(){
    if(!this.open||document.hidden||this.match.result||this.match.humanTurn||this.confirmation||this.thinking)return;
    this.cancelAI();this.thinking=true;this.error=false;const epoch=this.epoch,fen=this.match.game.fen();
    const fail=()=>{if(epoch!==this.epoch)return;this.cancelAI();this.error=true;this.render();};
    try{
      this.worker=new Worker(new URL('./chess-worker.js',import.meta.url),{type:'module'});
      this.worker.onerror=event=>{event.preventDefault();fail();};
      this.worker.onmessage=({data})=>{
        if(epoch!==this.epoch||fen!==this.match.game.fen()||!this.open)return;
        clearTimeout(this.watchdog);this.worker?.terminate();this.worker=null;
        if(data.error||data.fen!==fen){fail();return;}
        this.replyTimer=setTimeout(()=>{
          if(epoch!==this.epoch||!this.open)return;
          this.thinking=false;
          const move=this.match.move(data.move,'b');if(!move){fail();return;}
          this.afterMove(move);
        },450);
      };
      this.watchdog=setTimeout(fail,12000);this.worker.postMessage({fen,level:this.match.level});
    }catch{fail();}
    this.render();
  }
  choose(square){
    if(!this.match.humanTurn||this.promotion||this.confirmation)return;
    if(this.selected===square){this.selected=null;this.render();return;}
    if(this.selected){
      const moves=this.match.legal(this.selected).filter(move=>move.to===square);
      if(moves.length){
        if(moves.some(move=>move.promotion)){this.promotion={from:this.selected,to:square};this.render();this.$('promotion').querySelector('button').focus();return;}
        const move=this.match.move({from:this.selected,to:square});if(move)this.afterMove(move);return;
      }
    }
    this.selected=this.match.game.get(square)?.color==='w'?square:null;this.render();
  }
  afterMove(move){
    this.selected=null;this.promotion=null;this.error=false;
    if(this.match.claimResult())this.onResult?.(this.match.result);
    this.save();this.onMove?.(move);this.render();this.think();
  }
  action(action){
    if(action==='close'){this.close();return;}
    if(action==='flip'){this.flipped=!this.flipped;this.render();return;}
    if(action==='retry'){this.think();return;}
    if(action==='undo'){
      this.cancelAI();this.match.undoTurn();this.selected=null;this.promotion=null;this.confirmation=null;this.error=false;this.save();this.render();this.think();return;
    }
    if(action==='new'||action==='resign'){this.cancelAI();this.confirmation=action;this.render();this.dialog.querySelector('[data-action="cancel-confirm"]').focus();return;}
    if(action==='cancel-confirm'){this.confirmation=null;this.render();this.think();return;}
    if(action==='confirm'){
      if(this.confirmation==='new')this.match.reset();else this.match.resign();
      this.confirmation=null;this.selected=null;this.promotion=null;this.error=false;
      if(this.match.claimResult())this.onResult?.(this.match.result);
      this.save();this.render();this.think();
    }
  }
  render(){
    const game=this.match.game,history=this.match.history,last=history.at(-1),result=this.match.result;
    this.$('title').textContent=words('マイロとチェス','Chess with Milo');this.$('you').textContent=words('あなた / 白','YOU / WHITE');
    this.$('paused-label').textContent=this.saveFailed?words('保存不可 / このページ内で継続','Save unavailable / keep this page open'):words('船内時間 停止中','SHIP TIME PAUSED');
    this.$('score-title').textContent=words('棋譜','MOVES');this.$('level-label').textContent=words('マイロの強さ','Milo’s level');
    this.$('level').value=String(this.match.level);[...this.$('level').options].forEach((option,i)=>option.textContent=words(...[['気軽に','Casual'],['ふつう','Regular'],['真剣勝負','Challenging']][i]));
    this.$('turn').textContent=result?words('対局終了','Game over'):this.match.humanTurn?words('あなたの手番','Your move'):words('マイロの手番','Milo’s move');
    this.$('last-move').textContent=last?`${last.color==='w'?words('あなた','YOU'):'MILO'}  ${last.san}`:'';
    this.$('comment').textContent=this.error?words('通信が途切れた。もう一度つないでくれ。','The link dropped. Connect me again.'):result?result.reason==='resigned'?words('また時間があるときに、一局やろう。','Another game when you have time.'):result.winner==='w'?words('参った。君の勝ちだ。','You got me. Your game.'):result.winner==='b'?words('チェックメイト。また相手をしてくれ。','Checkmate. Play me again sometime.'):words('引き分けか。いい勝負だった。','A draw. Well played.'):game.isCheck()?this.match.humanTurn?words('チェックだ。','Check.'):words('チェックか。少し考えさせてくれ。','Check. Let me think.'):this.thinking?words('さて、どう指すかな。','Let me see…'):!history.length?words('白をどうぞ。先手は君だ。','Take white. You move first.'):last?.captured?words('その駒、もらった。','I will take that piece.'):words('君の番だ。','Your move.');
    const retry=this.dialog.querySelector('[data-action="retry"]');retry.hidden=!this.error;retry.querySelector('span').textContent=words('再接続','Reconnect');
    const resultNames={mate:['チェックメイト','Checkmate'],resigned:['投了','Resigned'],stalemate:['ステイルメイト','Stalemate'],repetition:['同一局面の反復','Threefold repetition'],material:['戦力不足','Insufficient material'],draw:['引き分け','Draw']};
    if(result)this.$('turn').textContent=words(...resultNames[result.reason]);
    const targets=new Set(this.selected?this.match.legal(this.selected).map(move=>move.to):[]);
    this.board.dataset.turn=game.turn();this.board.dataset.ply=String(history.length);this.board.setAttribute('aria-label',words('チェス盤','Chess board'));
    this.cells.forEach((cell,index)=>{
      const file=this.flipped?7-index%8:index%8,rank=this.flipped?Math.floor(index/8)+1:8-Math.floor(index/8),square='abcdefgh'[file]+rank,piece=game.get(square),selected=this.selected===square;
      cell.dataset.square=square;cell.className=`chess-square ${(file+rank)%2?'light':'dark'}${selected?' selected':''}${targets.has(square)?' legal':''}${last&&(last.from===square||last.to===square)?' last':''}${game.isCheck()&&piece?.type==='k'&&piece.color===game.turn()?' check':''}`;
      cell.setAttribute('aria-label',`${square}${piece?' '+words(piece.color==='w'?'白':'黒',piece.color==='w'?'White':'Black')+' '+words(...names[piece.type]):''}${targets.has(square)?words(' 移動可能',' Legal move'):''}`);
      cell.setAttribute('aria-selected',String(selected));
      const markup=`${piece?pieceSVG(piece.type,piece.color):''}<span class="square-file">${index>=56?'abcdefgh'[file]:''}</span><span class="square-rank">${index%8===0?rank:''}</span>`;
      if(cell.innerHTML!==markup)cell.innerHTML=markup;
    });
    const moveList=this.$('moves'),wasAtEnd=moveList.scrollHeight-moveList.scrollTop-moveList.clientHeight<30;
    const rows=[];for(let i=0;i<history.length;i+=2)rows.push(`<li><span>${i/2+1}.</span><b>${history[i].san}</b><b>${history[i+1]?.san||''}</b></li>`);
    const markup=rows.join('');if(moveList.innerHTML!==markup){moveList.innerHTML=markup;if(wasAtEnd)moveList.scrollTop=moveList.scrollHeight;}
    this.dialog.querySelector('[data-action="undo"]').disabled=!history.length;
    this.dialog.querySelector('[data-action="resign"]').disabled=Boolean(result);
    for(const [action,ja,en]of [['undo','一手戻す','Take back a turn'],['flip','盤を反転','Flip board'],['resign','投了','Resign'],['new','新しい対局','New game'],['close','船内へ戻る','Back to cabin']]){
      this.dialog.querySelectorAll(`[data-action="${action}"]`).forEach(button=>{button.setAttribute('aria-label',words(ja,en));button.title=words(ja,en);});
    }
    this.dialog.querySelector('.chess-return span').textContent=words('船内へ','Back to cabin');
    this.$('promotion').hidden=!this.promotion;this.$('promotion-label').textContent=words('昇格する駒','Promote to');
    if(this.promotion){
      const choices=this.$('promotion').querySelector('div');choices.replaceChildren();
      for(const type of ['q','r','b','n']){const button=document.createElement('button');button.innerHTML=pieceSVG(type,'w');button.setAttribute('aria-label',words(...names[type]));button.title=words(...names[type]);button.onclick=()=>{const move=this.match.move({...this.promotion,promotion:type});if(move){this.afterMove(move);this.cells.find(cell=>cell.dataset.square===move.to).focus();}};choices.append(button);}
    }
    this.$('confirm').hidden=!this.confirmation;
    this.$('confirm').querySelector('span').textContent=this.confirmation==='new'?words('今の対局を終えて、最初から始める？','End this game and start a new one?'):words('この対局を投了する？','Resign this game?');
    this.dialog.querySelector('[data-action="cancel-confirm"]').textContent=words('戻る','Cancel');
    this.dialog.querySelector('[data-action="confirm"]').textContent=this.confirmation==='new'?words('新しい対局','New game'):words('投了する','Resign');
    this.refreshIcons();
  }
  dispose(){this.cancelAI();document.removeEventListener('visibilitychange',this.visibility);this.dialog.remove();}
}
