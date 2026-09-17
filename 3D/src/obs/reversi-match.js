const directions=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
export function flips(board,index,side){
  if(!Number.isInteger(index)||index<0||index>63||board[index])return[];
  const found=[];
  for(const [dr,dc]of directions){
    let r=(index>>3)+dr,c=index%8+dc;const line=[];
    while(r>=0&&r<8&&c>=0&&c<8&&board[r*8+c]===-side){line.push(r*8+c);r+=dr;c+=dc;}
    if(line.length&&r>=0&&r<8&&c>=0&&c<8&&board[r*8+c]===side)found.push(...line);
  }
  return found;
}
export const legalMoves=(board,side)=>Array.from({length:64},(_,i)=>i).filter(i=>flips(board,i,side).length);
function placed(board,index,side){const copy=board.slice();for(const i of [index,...flips(board,index,side)])copy[i]=side;return copy;}
export class ReversiMatch{
  constructor(saved){
    this.reset();
    if(saved)try{
      if(saved.version!==1||!Array.isArray(saved.moves)||saved.moves.length>60)throw Error('save');
      for(const index of saved.moves)if(!this.move(index,this.turn))throw Error('move');
      this.rewarded=saved.rewarded===true;
    }catch{this.reset();}
  }
  reset(){this.board=Array(64).fill(0);this.board[27]=this.board[36]=-1;this.board[28]=this.board[35]=1;this.turn=1;this.moves=[];this.passed=null;this.rewarded=false;}
  get counts(){return{you:this.board.filter(v=>v===1).length,milo:this.board.filter(v=>v===-1).length};}
  get result(){if(this.turn)return null;const {you,milo}=this.counts;return{winner:you===milo?null:you>milo?'you':'milo'};}
  legal(){return this.turn?legalMoves(this.board,this.turn):[];}
  move(index,side=1){
    if(!this.turn||side!==this.turn||!flips(this.board,index,side).length)return false;
    this.board=placed(this.board,index,side);this.moves.push(index);this.passed=null;this.turn=-side;
    if(!this.legal().length){this.passed=this.turn;this.turn=side;if(!this.legal().length)this.turn=0;}
    return true;
  }
  claimResult(){if(!this.result||this.rewarded)return false;this.rewarded=true;return true;}
  serialize(){return{version:1,moves:this.moves.slice(),rewarded:this.rewarded};}
}
const weights=[120,-25,20,5,5,20,-25,120,-25,-45,-5,-5,-5,-5,-45,-25,20,-5,15,3,3,15,-5,20,5,-5,3,3,3,3,-5,5,5,-5,3,3,3,3,-5,5,20,-5,15,3,3,15,-5,20,-25,-45,-5,-5,-5,-5,-45,-25,120,-25,20,5,5,20,-25,120];
export function chooseReversiMove(board,side=-1){
  function score(b,player,depth,alpha=-Infinity,beta=Infinity){
    const moves=legalMoves(b,player),other=legalMoves(b,-player);
    if(!moves.length&&!other.length)return b.reduce((sum,v)=>sum+v*side,0)*10000;
    if(!depth)return b.reduce((sum,v,i)=>sum+v*side*weights[i],0)+4*(legalMoves(b,side).length-legalMoves(b,-side).length);
    if(!moves.length)return score(b,-player,depth-1,alpha,beta);
    let best=player===side?-Infinity:Infinity;
    for(const move of moves){const value=score(placed(b,move,player),-player,depth-1,alpha,beta);
      if(player===side){best=Math.max(best,value);alpha=Math.max(alpha,best);}else{best=Math.min(best,value);beta=Math.min(beta,best);}if(beta<=alpha)break;
    }return best;
  }
  let best=null,value=-Infinity;
  for(const move of legalMoves(board,side)){const next=score(placed(board,move,side),-side,2);if(next>value){best=move;value=next;}}
  return best;
}
