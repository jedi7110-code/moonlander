export function registerGameTools(actions,context=globalThis.document?.modelContext){
  if(!context?.registerTool)return null;
  const lifecycle=new AbortController();
  const read=()=>{const s=actions.getState();return{phase:s.phase,paused:actions.isPaused(),mission:s.round,elapsedSeconds:Math.floor(s.time),crewTotal:s.crews.length,crewAboard:s.boarded,hostilesDefeated:s.kills,fuel:Math.round(s.ship.fuel),beamEnergy:Math.round(s.energy),failure:s.failure};};
  const tools=[
    {name:'read_moonlander_mission',title:'ミッション状況を確認',description:'現在の月面救出ミッションの段階、燃料、救出人数を読み取る。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');return read();}},
    {name:'set_moonlander_pause',title:'ミッションを一時停止・再開',description:'表示中のゲームを一時停止または再開する。',inputSchema:{type:'object',properties:{paused:{type:'boolean'}},required:['paused'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.paused!=='boolean'||Object.keys(input).length!==1)throw new Error('paused must be a boolean');if(['title','complete','failed'].includes(actions.getState().phase))throw new Error('No active mission');actions.pause(input.paused);return read();}}
  ];
  for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  globalThis.addEventListener?.('pagehide',()=>lifecycle.abort(),{once:true});
  if(import.meta.hot)import.meta.hot.dispose(()=>lifecycle.abort());return lifecycle;
}
