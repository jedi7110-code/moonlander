export class PlantBed {
  constructor(){
    this.rows=[{ja:'リーフレタス',en:'Lettuce',growth:.62,seconds:180},{ja:'小松菜',en:'Mustard greens',growth:.35,seconds:240},{ja:'バジル',en:'Basil',growth:.15,seconds:300}];
    this.tendCooldown=0;
  }
  get ready(){return this.rows.filter(row=>row.growth>=1).length;}
  update(dt){
    this.tendCooldown=Math.max(0,this.tendCooldown-dt);
    for(const row of this.rows)row.growth=Math.min(1,row.growth+Math.max(0,dt)/row.seconds);
  }
  tend(){
    if(this.tendCooldown>0)return;
    for(const row of this.rows)row.growth=Math.min(1,row.growth+.04);
    this.tendCooldown=30;
  }
  harvest(supplies){
    let count=0;
    for(const row of this.rows){
      if(row.growth<1||supplies.supplies.food>=supplies.capacity.food)continue;
      supplies.supplies.food++;row.growth=.05;count++;
    }
    return count;
  }
}
