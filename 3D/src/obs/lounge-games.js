import {CabinChess} from './chess-ui.js';
import {ReversiMatch,chooseReversiMove} from './reversi-match.js';
import {PokerMatch,cardLabel,evaluateHand,POKER_HAND_NAMES} from './poker-match.js';
import {getLang} from '../../../js/obs/i18n.js?v=15';
import './lounge-games.css';

const words=(ja,en)=>getLang()==='ja'?ja:en;
const labels={chess:['チェス','Chess'],poker:['ポーカー','Poker'],reversi:['リバーシ','Reversi']};
const keys={poker:'tarairon-poker-v1',reversi:'tarairon-reversi-v1'};
const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const button=(action,text,disabled=false)=>`<button type="button" data-action="${action}"${disabled?' disabled':''}>${text}</button>`;

export class CabinLoungeGames{
  constructor({parent,onClose,onMove,onResult,refreshIcons}){
    this.onClose=onClose;this.onMove=onMove;this.onResult=onResult;this.active=false;this.kind=null;this.selected=new Set();this.epoch=0;
    this.matches={reversi:new ReversiMatch(read(keys.reversi)),poker:new PokerMatch(read(keys.poker))};
    this.chess=new CabinChess({parent,onMove,onResult,refreshIcons,onClose:()=>{
      if(this.returningToMenu){this.returningToMenu=false;this.showMenu();queueMicrotask(()=>this.dialog.querySelector('button').focus());}
      else this.finish();
    }});
    this.backButton=document.createElement('button');this.backButton.type='button';this.backButton.className='lounge-chess-back';
    this.backButton.onclick=()=>{this.returningToMenu=true;this.chess.close();};this.chess.dialog.querySelector('.chess-footer').prepend(this.backButton);
    this.dialog=document.createElement('dialog');this.dialog.id='cabin-games';this.dialog.setAttribute('aria-labelledby','lounge-title');parent.append(this.dialog);
    this.dialog.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;
      if(target.dataset.game)this.select(target.dataset.game);
      else if(target.dataset.square!==undefined)this.moveReversi(Number(target.dataset.square));
      else if(target.dataset.card!==undefined)this.toggleCard(Number(target.dataset.card));
      else if(target.dataset.action)this.action(target.dataset.action);
    });
    this.dialog.addEventListener('keydown',event=>{
      if(!event.target.matches('[data-square]'))return;
      const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];if(!delta)return;
      event.preventDefault();const i=Math.max(0,Math.min(63,Number(event.target.dataset.square)+delta));
      this.dialog.querySelectorAll('[data-square]').forEach(b=>b.tabIndex=Number(b.dataset.square)===i?0:-1);this.dialog.querySelector(`[data-square="${i}"]`).focus();
    });
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.dialog.addEventListener('close',()=>{if(this.switchingToChess){this.switchingToChess=false;return;}this.finish();});
    this.visibility=()=>{this.cancelAI();if(!document.hidden)this.think();};document.addEventListener('visibilitychange',this.visibility);
  }
  get open(){return this.active;}
  get title(){return this.kind?words(...labels[this.kind]):words('ラウンジゲーム','Lounge games');}
  show(kind=null){if(this.active)return;this.returnFocus=document.activeElement;this.active=true;this.showMenu();if(labels[kind])this.select(kind);}
  showMenu(){this.cancelAI();this.kind=null;this.confirmation=false;this.render();if(!this.dialog.open)this.dialog.showModal();this.dialog.querySelector('[data-game]').focus();}
  select(kind){
    if(!labels[kind])return;this.cancelAI();this.save();this.kind=kind;this.confirmation=false;this.selected.clear();
    if(kind==='chess'){this.switchingToChess=true;this.dialog.close();this.chess.show();this.backButton.textContent=words('ゲームを選ぶ','Choose game');}
    else{this.render();this.dialog.querySelector('[data-action="menu"]').focus();this.think();}
  }
  close(){this.cancelAI();this.save();if(this.chess.open)this.chess.close();else this.dialog.close();}
  finish(){if(!this.active)return;this.active=false;this.cancelAI();this.save();this.onClose?.();if(this.returnFocus?.isConnected)this.returnFocus.focus();}
  save(){if(!keys[this.kind])return;try{localStorage.setItem(keys[this.kind],JSON.stringify(this.matches[this.kind].serialize()));this.saveFailed=false;}catch{this.saveFailed=true;}}
  cancelAI(){this.epoch++;clearTimeout(this.timer);this.thinking=false;}
  think(){
    const match=this.matches.reversi;
    if(!this.active||this.kind!=='reversi'||document.hidden||this.confirmation||match.turn!==-1||this.thinking)return;
    this.thinking=true;const epoch=this.epoch;this.render();
    this.timer=setTimeout(()=>{
      if(epoch!==this.epoch||!this.active||this.kind!=='reversi')return;
      this.thinking=false;match.move(chooseReversiMove(match.board),-1);this.afterMove();
    },450);
  }
  afterMove(){const match=this.matches[this.kind];if(match.claimResult())this.onResult?.(match.result);this.save();this.onMove?.();this.render();this.think();}
  moveReversi(index){if(this.kind==='reversi'&&!this.confirmation&&this.matches.reversi.move(index))this.afterMove();}
  toggleCard(index){
    if(this.kind!=='poker'||this.matches.poker.phase!=='draw'||this.confirmation)return;
    if(this.selected.has(index))this.selected.delete(index);else if(this.selected.size<3)this.selected.add(index);
    this.render();this.dialog.querySelector(`[data-card="${index}"]`).focus();
  }
  action(action){
    if(action==='close'){this.close();return;}
    if(action==='menu'){this.save();this.showMenu();return;}
    if(action==='new'){this.cancelAI();this.confirmation=true;this.render();this.dialog.querySelector('[data-action="cancel"]').focus();return;}
    if(action==='cancel'){this.confirmation=false;this.render();this.think();return;}
    if(action==='confirm'){this.matches[this.kind].reset();this.selected.clear();this.confirmation=false;this.save();this.render();this.think();return;}
    if(this.confirmation||this.kind!=='poker')return;
    const match=this.matches.poker;
    if(action==='draw'){if(match.draw([...this.selected])){this.selected.clear();this.afterMove();}}
    else if(action==='next'){if(match.nextHand())this.afterMove();}
    else if(match.act(action))this.afterMove();
  }
  render(){
    if(this.chess.open){this.chess.render();this.backButton.textContent=words('ゲームを選ぶ','Choose game');return;}
    const focus=document.activeElement?.dataset,oldSquare=focus?.square;
    let content='';
    if(!this.kind){
      const descriptions={chess:words('白を持って先手。3段階のマイロと対局。','Take white. Three opponent levels.'),poker:words('5枚ドロー・1回交換。ゲーム内チップで一対一。','Five-card draw. Heads-up with play chips.'),reversi:words('あなたは黒。置ける場所を見ながら一局。','You play black. Legal moves are highlighted.')};
      content=`<p class="lounge-intro">${words('何で遊ぼうか。続きの対局も、ここから。','What shall we play? Your saved games are here, too.')}</p><div class="lounge-choices">${Object.keys(labels).map((kind,i)=>`<button data-game="${kind}"><span class="lounge-game-symbol" aria-hidden="true">${['♞','♠','●○'][i]}</span><strong>${words(...labels[kind])}</strong><span>${descriptions[kind]}</span><small>${words('選ぶ →','Play →')}</small></button>`).join('')}</div>`;
    }else content=this.kind==='reversi'?this.renderReversi():this.renderPoker();
    this.dialog.innerHTML=`<header class="lounge-header"><div><span>RECREATION / TARAIRON</span><h2 id="lounge-title">${this.title}</h2></div>${button('close',words('船内へ戻る','Back to cabin'))}</header><div class="lounge-content">${content}</div>${this.confirmation?`<div class="lounge-confirm" role="alert">${words('現在の対局を終えて最初から始めますか？','End this game and start over?')}${this.kind==='poker'?words('チップは双方500に戻ります。','Both stacks return to 500.'):''}${button('cancel',words('続ける','Continue'))}${button('confirm',words('最初から','Start over'))}</div>`:''}<footer class="lounge-footer">${this.kind?button('menu',words('← ゲームを選ぶ','← Choose game')):''}<span>${this.saveFailed?words('保存できません。このページ内で継続できます。','Save unavailable. Keep this page open.'):words('船内時間は停止中・対局は自動保存','Ship time paused · Games saved automatically')}</span>${this.kind?button('new',words('新しい対局','New game')):''}</footer>`;
    if(oldSquare!==undefined)this.dialog.querySelector(`[data-square="${oldSquare}"]`)?.focus();
  }
  renderReversi(){
    const match=this.matches.reversi,{you,milo}=match.counts,result=match.result,legal=match.turn===1?match.legal():[];
    const state=result?result.winner===null?words('引き分け。いい勝負だった。','A draw. Well played.'):result.winner==='you'?words('あなたの勝ち！','You win!'):words('マイロの勝ち。また一局。','Milo wins. Another round?'):match.turn===1?words('あなたの手番です。点のある場所に置けます。','Your turn. Place a disc on a marked square.'):words('マイロが考えています…','Milo is thinking…');
    return`<div class="lounge-scores"><span>● ${words('あなた','YOU')} <b>${you}</b></span><span>○ MILO <b>${milo}</b></span></div><p class="lounge-status" role="status" aria-live="polite">${state}${match.passed?words(match.passed===1?' あなたはパス。':' マイロはパス。',match.passed===1?' You pass.':' Milo passes.'):''}</p><div class="reversi-board" role="grid" aria-label="${words('リバーシ盤','Reversi board')}">${match.board.map((v,i)=>`<button role="gridcell" data-square="${i}" tabindex="${i===(legal[0]??0)?0:-1}" aria-disabled="${!legal.includes(i)}" aria-label="${'abcdefgh'[i%8]}${(i>>3)+1} ${v===1?words('黒','Black'):v===-1?words('白','White'):legal.includes(i)?words('置けます','Legal move'):words('空き','Empty')}" class="${legal.includes(i)?'legal':''}">${v?`<span class="reversi-disc ${v===1?'black':'white'}"></span>`:''}</button>`).join('')}</div><p class="lounge-rules">${words('挟んだ石が裏返ります。置けないときは自動パス。双方が置けなくなった時、多い方が勝ち。','Bracket opposing discs to flip them. No moves means an automatic pass. When neither player can move, most discs wins.')}</p>`;
  }
  renderPoker(){
    const m=this.matches.poker,reveal=m.result?.reason==='showdown';
    const hand=(cards,hidden=false,selectable=false)=>`<div class="poker-hand">${cards.map((c,i)=>hidden?'<span class="playing-card card-back" aria-label="伏せたカード">T</span>':`<${selectable?'button':'span'} ${selectable?`data-card="${i}" aria-pressed="${this.selected.has(i)}"`:''} class="playing-card ${[1,2].includes(Math.floor(c/13))?'red':''} ${selectable&&this.selected.has(i)?'selected':''}" aria-label="${cardLabel(c)}${selectable?words(' 交換を選択',' Select to exchange'):''}"><b>${cardLabel(c)}</b><span aria-hidden="true">${cardLabel(c).slice(-1)}</span></${selectable?'button':'span'}>`).join('')}</div>`;
    const status=m.result?(m.result.winner===null?words('引き分け。ポットを山分け。','Tie. Split pot.'):words(m.result.winner==='you'?'あなたの勝ち！':'マイロの勝ち。',m.result.winner==='you'?'You win!':'Milo wins.'))+(m.result.reason==='fold'?words(m.result.winner==='you'?' マイロがフォールド。':' あなたがフォールド。',' Hand ended by a fold.'):words(` ポット ${m.result.pot}。`,` Pot ${m.result.pot}.`)):m.phase==='draw'?words(`交換するカードを0〜3枚選択（選択中 ${this.selected.size} 枚）。`,`Select 0–3 cards to exchange (${this.selected.size} selected).`):m.toCall?words('マイロが10ベット。コールかフォールドを選んでください。','Milo bets 10. Call or fold.'):words(m.round?'交換後のベット。チェックか10ベット。':'最初のベット。チェックか10ベット。',m.round?'Final betting. Check or bet 10.':'First betting round. Check or bet 10.');
    const controls=m.phase==='showdown'?button('next',words('次のハンド','Next hand'),Math.min(m.chips.you,m.chips.milo)<10):m.phase==='draw'?button('draw',words(this.selected.size?`${this.selected.size}枚交換`:'交換しない',this.selected.size?`Exchange ${this.selected.size}`:'Stand pat')):m.toCall?button('call',words('コール 10','Call 10'))+button('fold',words('フォールド','Fold')):button('check',words('チェック','Check'))+button('bet',words('ベット 10','Bet 10'),!m.canBet)+button('fold',words('フォールド','Fold'));
    return`<div class="lounge-scores"><span>MILO <b>${m.chips.milo}</b></span><span>HAND ${m.handNumber} · POT <b>${m.pot}</b></span></div><div class="poker-table">${hand(m.milo,!reveal)}<p class="poker-note">${reveal?words(...POKER_HAND_NAMES[evaluateHand(m.milo).category]):m.miloDraw===null?words('マイロの手札','Milo’s hand'):words(`マイロは${m.miloDraw}枚交換。`,`Milo drew ${m.miloDraw}.`)}</p><p class="lounge-status" role="status" aria-live="polite">${status}</p>${hand(m.you,false,m.phase==='draw')}<p class="poker-note">${words(...POKER_HAND_NAMES[evaluateHand(m.you).category])}</p></div><div class="lounge-scores"><span>${words('あなたのチップ','YOUR CHIPS')} <b>${m.chips.you}</b></span></div><div class="poker-actions">${controls}</div>${m.phase==='showdown'&&Math.min(m.chips.you,m.chips.milo)<10?`<p>${words('チップ不足です。「新しい対局」で双方500から再開できます。','Not enough chips. Choose New game to restart with 500 each.')}</p>`:''}<details class="lounge-rules"><summary>${words('遊び方・役の順番','Rules & hand rankings')}</summary><p>${words('5枚ドロー。参加料は各10、交換は一度・最大3枚。交換前後に各1回、10の固定ベット。レイズなし。双方が払える時だけベット可能。現金・購入・換金はありません。','Five-card draw. Ante 10 each, one draw of up to 3 cards. One fixed bet of 10 before and after drawing; no raises. Bets require both players to cover them. No real money, purchases or cash-out.')}</p><p>${POKER_HAND_NAMES.slice().reverse().map(n=>words(...n)).join(' → ')}</p></details>`;
  }
  dispose(){this.cancelAI();document.removeEventListener('visibilitychange',this.visibility);this.chess.dispose();this.dialog.remove();}
}
