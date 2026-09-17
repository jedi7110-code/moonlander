export const POKER_ANTE=10,POKER_BET=10;
export const POKER_HAND_NAMES=[['ハイカード','High card'],['ワンペア','One pair'],['ツーペア','Two pair'],['スリーカード','Three of a kind'],['ストレート','Straight'],['フラッシュ','Flush'],['フルハウス','Full house'],['フォーカード','Four of a kind'],['ストレートフラッシュ','Straight flush']];
export const cardRank=card=>card%13+2;
export const cardLabel=card=>`${['2','3','4','5','6','7','8','9','10','J','Q','K','A'][card%13]}${['♠','♥','♦','♣'][Math.floor(card/13)]}`;
export function evaluateHand(cards){
  if(cards.length!==5||new Set(cards).size!==5||cards.some(c=>!Number.isInteger(c)||c<0||c>51))throw Error('Invalid hand');
  const ranks=cards.map(cardRank).sort((a,b)=>b-a),counts=new Map();for(const r of ranks)counts.set(r,(counts.get(r)??0)+1);
  const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),flush=cards.every(c=>Math.floor(c/13)===Math.floor(cards[0]/13));
  const straight=counts.size===5?(ranks[0]-ranks[4]===4?ranks[0]:ranks.join(',')==='14,5,4,3,2'?5:0):0;
  const category=flush&&straight?8:groups[0][1]===4?7:groups[0][1]===3&&groups[1][1]===2?6:flush?5:straight?4:groups[0][1]===3?3:groups[0][1]===2&&groups[1][1]===2?2:groups[0][1]===2?1:0;
  const kickers=straight&&(category===4||category===8)?[straight]:groups.map(([rank])=>rank);
  return{category,score:[category,...kickers,...Array(5-kickers.length).fill(0)].reduce((value,n)=>value*15+n,0)};
}
export class PokerMatch{
  constructor(saved=null,{random=Math.random}={}){
    this.random=random;this.reset();
    if(saved)try{
      const s=saved;
      if(s.version!==1||!['bet','draw','showdown'].includes(s.phase)||![0,1].includes(s.round)||![0,10].includes(s.toCall))throw Error('save');
      if(!Array.isArray(s.deck)||s.deck.length!==52||new Set(s.deck).size!==52||s.deck.some(c=>!Number.isInteger(c)||c<0||c>51))throw Error('deck');
      if(!Number.isInteger(s.cursor)||s.cursor<10||s.cursor>16)throw Error('cursor');
      if(!Number.isInteger(s.handNumber)||s.handNumber<1||s.handNumber>1000000)throw Error('hand number');
      if(s.round===0?(s.cursor!==10||s.miloDraw!==null):(!Number.isInteger(s.miloDraw)||s.miloDraw<0||s.miloDraw>3))throw Error('draw');
      if(s.phase==='draw'&&s.round!==0||s.toCall&&(s.phase!=='bet'||s.chips?.you<s.toCall))throw Error('phase');
      evaluateHand(s.you);evaluateHand(s.milo);
      if(new Set([...s.you,...s.milo]).size!==10||[...s.you,...s.milo].some(c=>!s.deck.slice(0,s.cursor).includes(c)))throw Error('hands');
      if(![s.chips?.you,s.chips?.milo,s.pot].every(n=>Number.isInteger(n)&&n>=0)||s.chips.you+s.chips.milo+s.pot!==1000)throw Error('chips');
      if(s.phase==='showdown'?!s.result||!['you','milo',null].includes(s.result.winner)||!['fold','showdown'].includes(s.result.reason)||s.pot!==0:s.result!==null)throw Error('result');
      for(const key of ['deck','cursor','you','milo','chips','pot','phase','round','toCall','result','handNumber','miloDraw','rewarded'])this[key]=structuredClone(s[key]);
    }catch{this.reset();}
  }
  reset(){this.chips={you:500,milo:500};this.handNumber=0;this.phase='showdown';this.nextHand();}
  nextHand(){
    if(this.phase!=='showdown'||Math.min(this.chips.you,this.chips.milo)<POKER_ANTE)return false;
    this.deck=Array.from({length:52},(_,i)=>i);
    for(let i=51;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.deck[i],this.deck[j]]=[this.deck[j],this.deck[i]];}
    this.you=this.deck.slice(0,5);this.milo=this.deck.slice(5,10);this.cursor=10;
    this.pot=0;this.pay('you',POKER_ANTE);this.pay('milo',POKER_ANTE);this.phase='bet';this.round=0;this.toCall=0;this.result=null;this.miloDraw=null;this.rewarded=false;this.handNumber++;return true;
  }
  pay(side,amount){this.chips[side]-=amount;this.pot+=amount;}
  get canBet(){return this.phase==='bet'&&!this.toCall&&Math.min(this.chips.you,this.chips.milo)>=POKER_BET;}
  act(action){
    if(this.phase!=='bet')return false;
    if(action==='fold'){this.finish('milo','fold');return true;}
    if(this.toCall){if(action!=='call'||this.chips.you<this.toCall)return false;this.pay('you',this.toCall);this.toCall=0;this.advance();return true;}
    if(action!=='check'&&action!=='bet'||action==='bet'&&!this.canBet)return false;
    const strength=evaluateHand(this.milo).category;
    if(action==='bet'){
      this.pay('you',POKER_BET);
      if(strength===0&&this.random()<.22){this.finish('you','fold');return true;}
      this.pay('milo',POKER_BET);this.advance();
    }else if(this.canBet&&(strength>=2||this.random()<(strength===1?.45:.12))){this.pay('milo',POKER_BET);this.toCall=POKER_BET;}
    else this.advance();
    return true;
  }
  advance(){if(this.round===0)this.phase='draw';else{const a=evaluateHand(this.you).score,b=evaluateHand(this.milo).score;this.finish(a===b?null:a>b?'you':'milo','showdown');}}
  draw(indices){
    if(this.phase!=='draw'||!Array.isArray(indices)||indices.length>3||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>4))return false;
    for(const i of indices)this.you[i]=this.deck[this.cursor++];
    const rank=evaluateHand(this.milo),counts=new Map();for(const c of this.milo)counts.set(cardRank(c),(counts.get(cardRank(c))??0)+1);
    const change=rank.category>=4?[]:this.milo.map((c,i)=>({c,i})).filter(({c})=>counts.get(cardRank(c))===1).sort((a,b)=>cardRank(a.c)-cardRank(b.c)).slice(0,3);
    for(const {i}of change)this.milo[i]=this.deck[this.cursor++];
    this.miloDraw=change.length;this.round=1;this.phase='bet';return true;
  }
  finish(winner,reason){
    const pot=this.pot;if(winner)this.chips[winner]+=pot;else{this.chips.you+=pot/2;this.chips.milo+=pot/2;}
    this.pot=0;this.toCall=0;this.phase='showdown';this.result={winner,reason,pot};
  }
  claimResult(){if(this.result?.reason!=='showdown'||this.rewarded)return false;this.rewarded=true;return true;}
  serialize(){const out={version:1};for(const key of ['deck','cursor','you','milo','chips','pot','phase','round','toCall','result','handNumber','miloDraw','rewarded'])out[key]=structuredClone(this[key]);return out;}
}
