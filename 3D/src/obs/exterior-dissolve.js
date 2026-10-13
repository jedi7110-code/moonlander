import * as THREE from 'three';

// One shared spacecraft and renderer, two independently rendered viewpoints.
// Grade each image before mixing: a dissolve must not dim to black, blend
// camera positions, or brighten the overlapping engine emissions.
export function createExteriorDissolve(renderer){
  const type=renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  const targets=[0,1].map(()=>new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true}));
  const size=new THREE.Vector2(),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const material=new THREE.ShaderMaterial({
    uniforms:{outgoing:{value:targets[0].texture},incoming:{value:targets[0].texture},blend:{value:0}},
    depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`uniform sampler2D outgoing;
      uniform sampler2D incoming;
      uniform float blend;
      varying vec2 vUv;
      void main(){
        vec4 a=texture2D(outgoing,vUv),b=texture2D(incoming,vUv);
        #ifdef TONE_MAPPING
          a.rgb=mix(a.rgb,toneMapping(a.rgb),a.a);b.rgb=mix(b.rgb,toneMapping(b.rgb),b.a);
        #endif
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
        renderer.setRenderTarget(targets[0]);drawView(frame.from);
        if(frame.to){resize(targets[1]);renderer.setRenderTarget(targets[1]);drawView(frame.to);}
        material.uniforms.incoming.value=frame.to?targets[1].texture:targets[0].texture;
        material.uniforms.blend.value=frame.mix;
        renderer.setRenderTarget(null);renderer.render(scene,camera);
      }finally{renderer.setRenderTarget(null);}
    },
    dispose(){targets.forEach(target=>target.dispose());geometry.dispose();material.dispose();}
  };
}
