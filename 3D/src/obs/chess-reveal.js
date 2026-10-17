// Finish each horizontal pass from left to right before starting the next layer.
export const CHESS_REVEAL=Object.freeze({duration:2.4,layers:24,halfWidth:.55});
export function sampleChessReveal(seconds,maxHeight){
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const progress=Math.min(1,time/CHESS_REVEAL.duration);
  const passes=progress*CHESS_REVEAL.layers,layer=Math.floor(passes+1e-9),done=layer===CHESS_REVEAL.layers;
  const sweep=done?1:Math.max(0,passes-layer);
  return{layer,baseHeight:maxHeight*(layer/CHESS_REVEAL.layers),
    height:maxHeight*(Math.min(layer+1,CHESS_REVEAL.layers)/CHESS_REVEAL.layers),
    sweep,cursor:(sweep*2-1)*CHESS_REVEAL.halfWidth,done};
}

// Share the same mask with the surface, depth prepass and shadow. Removing only
// the unfinished part of the current layer keeps completed layers intact.
export function applyChessLayerReveal(material,uniforms){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 vChessLayerPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvChessLayerPosition=mat3(modelMatrix)*transformed;');
    shader.fragmentShader='varying vec3 vChessLayerPosition;\nuniform float chessLayerActive;\nuniform float chessLayerBase;\nuniform float chessLayerCursor;\nuniform vec3 chessLayerRight;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',[
      '#include <clipping_planes_fragment>',
      'if(chessLayerActive>0.5 && vChessLayerPosition.y>chessLayerBase+0.00001 && dot(vChessLayerPosition,chessLayerRight)>chessLayerCursor)discard;'
    ].join('\n'));
  };
  material.customProgramCacheKey=()=>key+'-chess-layer-scan-1';
}
