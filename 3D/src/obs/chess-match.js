import {Chess,DEFAULT_POSITION} from 'chess.js';

export const CHESS_SAVE_KEY='barramundi-chess-v1';

export class ChessMatch {
  constructor(saved=null){
    this.reset();
    if(saved){
      try{
        if(saved.version!==1||!Array.isArray(saved.moves)||saved.moves.length>3000)throw new Error('Invalid saved game');
        this.reset(saved.initialFen);
        for(const move of saved.moves)this.game.move(move);
        this.level=[1,2,3].includes(saved.level)?saved.level:1;
        this.resigned=saved.resigned===true;this.rewarded=saved.rewarded===true;
      }catch{this.reset();}
    }
  }
  reset(initialFen=DEFAULT_POSITION){
    this.game=new Chess(initialFen);this.initialFen=initialFen;this.resigned=false;this.rewarded=false;this.level=this.level||1;
  }
  get history(){return this.game.history({verbose:true});}
  get result(){
    if(this.resigned)return{reason:'resigned',winner:'b'};
    if(this.game.isCheckmate())return{reason:'mate',winner:this.game.turn()==='w'?'b':'w'};
    if(this.game.isStalemate())return{reason:'stalemate',winner:null};
    if(this.game.isThreefoldRepetition())return{reason:'repetition',winner:null};
    if(this.game.isInsufficientMaterial())return{reason:'material',winner:null};
    if(this.game.isDraw())return{reason:'draw',winner:null};
    return null;
  }
  get humanTurn(){return !this.result&&this.game.turn()==='w';}
  legal(square){return this.humanTurn?this.game.moves({square,verbose:true}):[];}
  move(input,side='w'){
    if(this.result||this.game.turn()!==side)return null;
    try{return this.game.move(input);}catch{return null;}
  }
  undoTurn(){
    if(!this.history.length)return false;
    this.resigned=false;this.game.undo();
    if(this.game.turn()==='b'&&this.history.length)this.game.undo();
    return true;
  }
  resign(){if(!this.result)this.resigned=true;}
  claimResult(){
    if(!this.result||this.rewarded||this.history.length<4)return false;
    this.rewarded=true;return true;
  }
  serialize(){
    return{version:1,initialFen:this.initialFen,moves:this.history.map(({from,to,promotion})=>({from,to,...(promotion?{promotion}:{})})),level:this.level,resigned:this.resigned,rewarded:this.rewarded};
  }
}
