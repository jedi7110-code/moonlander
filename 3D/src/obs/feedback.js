export const SIGNAL_COLORS={hover:0xddece4,inspect:0xddece4,moving:0xf3bd62,waiting:0xf3bd62,active:0x85e3af,done:0x85e3af,unloading:0x85e3af,delivered:0x85e3af,stocked:0xf3bd62,blocked:0xf17d68,acknowledged:0x85e3af};

export class StationFeedback {
  constructor(){this.time=0;this.selected=null;this.notice=null;this.hovered=null;}
  accept(id){if(!id)return;this.selected={id,phase:'moving',started:this.time};this.notice=null;}
  notify(id,phase){this.notice={id,phase,started:this.time,until:this.time+2.4};}
  update(dt,brain,actor,paused){
    this.time+=dt;
    if(this.notice&&this.time>=this.notice.until)this.notice=null;
    if(!this.selected)return;
    const station=brain.state==='reading'?'console':brain.actStation;
    if(station!==this.selected.id){
      if(!station&&!this.notice)this.notify(this.selected.id,'done');
      this.selected=null;return;
    }
    this.selected.phase=brain.state==='playingGame'?'active':paused?'waiting':actor.busy?'moving':['performing','reading','orderingSupply'].includes(brain.state)?'active':'waiting';
  }
  get summary(){return this.notice||this.selected||(this.hovered?{id:this.hovered,phase:'hover'}:null);}
  signal(id,reducedMotion=false){
    const state=this.notice?.id===id?this.notice:this.selected?.id===id?this.selected:this.hovered===id?{phase:'hover'}:null;
    if(!state)return null;
    let intensity=1;
    if(state.phase==='hover')intensity=.38;
    else if(!reducedMotion){
      const age=this.time-state.started;
      if(age<1.4)intensity=.4+.6*(.5+.5*Math.cos(age*Math.PI*3));
      else if(state.phase==='moving')intensity=.72+.28*(.5+.5*Math.sin(this.time*Math.PI));
    }
    return{phase:state.phase,color:SIGNAL_COLORS[state.phase],intensity};
  }
}
