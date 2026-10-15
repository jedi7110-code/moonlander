import * as THREE from 'three';

// One shared spacecraft and renderer, two independently rendered viewpoints.
// Grade each image before mixing: a dissolve must not dim to black, blend
// camera positions, or brighten the overlapping engine emissions.
export function createExteriorDissolve(renderer,{samples=0}={}){
  const type=renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  const targets=[0,1].map(()=>new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedIntType)}));
  for(const target of targets)target.samples=renderer.capabilities.isWebGL2?Math.min(samples,renderer.capabilities.maxSamples):0;
  const gasTargets=[0,1].map(()=>new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false}));
  const emptyGas=new THREE.DataTexture(new Uint8Array(4),1,1);emptyGas.needsUpdate=true;
  const size=new THREE.Vector2(),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const material=new THREE.ShaderMaterial({
    uniforms:{outgoing:{value:targets[0].texture},incoming:{value:targets[0].texture},blend:{value:0},
      outgoingGas:{value:emptyGas},incomingGas:{value:emptyGas}},
    depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`uniform sampler2D outgoing;
      uniform sampler2D incoming;
      uniform sampler2D outgoingGas;
      uniform sampler2D incomingGas;
      uniform float blend;
      varying vec2 vUv;
      void main(){
        vec4 a=texture2D(outgoing,vUv),b=texture2D(incoming,vUv);
        #ifdef TONE_MAPPING
          a.rgb=mix(a.rgb,toneMapping(a.rgb),a.a);b.rgb=mix(b.rgb,toneMapping(b.rgb),b.a);
        #endif
        // Gas targets contain premultiplied RGB from normal alpha blending.
        // Composite after grading, matching the gas's unlit material.
        vec4 ga=texture2D(outgoingGas,vUv),gb=texture2D(incomingGas,vUv);
        a.rgb=a.rgb*(1.0-ga.a)+ga.rgb;b.rgb=b.rgb*(1.0-gb.a)+gb.rgb;
        a.a=1.0;b.a=1.0;
        gl_FragColor=mix(linearToOutputTexel(a),linearToOutputTexel(b),blend);
      }`,
  });
  material.name='Exterior cinema / graded cross dissolve';
  const geometry=new THREE.PlaneGeometry(2,2),quad=new THREE.Mesh(geometry,material);quad.frustumCulled=false;scene.add(quad);
  function resize(target){if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);}
  return{
    render(frame,drawView){
      renderer.getDrawingBufferSize(size);resize(targets[0]);
      try{
        renderer.setRenderTarget(targets[0]);
        const fromGas=drawView(frame.from,targets[0],gasTargets[0]);
        let toGas=false;
        if(frame.to){resize(targets[1]);renderer.setRenderTarget(targets[1]);toGas=drawView(frame.to,targets[1],gasTargets[1]);}
        material.uniforms.outgoingGas.value=fromGas?gasTargets[0].texture:emptyGas;
        material.uniforms.incomingGas.value=frame.to?(toGas?gasTargets[1].texture:emptyGas):material.uniforms.outgoingGas.value;
        material.uniforms.incoming.value=frame.to?targets[1].texture:targets[0].texture;
        material.uniforms.blend.value=frame.mix;
        renderer.setRenderTarget(null);renderer.render(scene,camera);
      }finally{renderer.setRenderTarget(null);}
    },
    dispose(){[...targets,...gasTargets].forEach(target=>target.dispose());emptyGas.dispose();geometry.dispose();material.dispose();}
  };
}
