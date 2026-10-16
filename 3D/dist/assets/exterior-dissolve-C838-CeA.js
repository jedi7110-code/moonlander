import{Y as x,Z as h,_ as p,$ as T,a0 as G,v as y,h as D,a as w,a1 as U,i as _,d as S,c as E}from"./three-ZnPhKgT8.js";function R(t,{samples:v=0}={}){const r=t.extensions.has("EXT_color_buffer_float")||t.extensions.has("EXT_color_buffer_half_float")?x:h,a=[0,1].map(()=>new p(1,1,{type:r,depthBuffer:!0,depthTexture:new T(1,1,G)}));for(const e of a)e.samples=t.capabilities.isWebGL2?Math.min(v,t.capabilities.maxSamples):0;const s=[0,1].map(()=>new p(1,1,{type:r,depthBuffer:!1})),i=new y(new Uint8Array(4),1,1);i.needsUpdate=!0;const o=new D,g=new w,b=new U(-1,1,1,-1,0,1),n=new _({uniforms:{outgoing:{value:a[0].texture},incoming:{value:a[0].texture},blend:{value:0},outgoingGas:{value:i},incomingGas:{value:i}},depthTest:!1,depthWrite:!1,vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,fragmentShader:`uniform sampler2D outgoing;
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
      }`});n.name="Exterior cinema / graded cross dissolve";const u=new S(2,2),l=new E(u,n);l.frustumCulled=!1,g.add(l);function m(e){(e.width!==o.x||e.height!==o.y)&&e.setSize(o.x,o.y)}return{render(e,f){t.getDrawingBufferSize(o),m(a[0]);try{t.setRenderTarget(a[0]);const d=f(e.from,a[0],s[0]);let c=!1;e.to&&(m(a[1]),t.setRenderTarget(a[1]),c=f(e.to,a[1],s[1])),n.uniforms.outgoingGas.value=d?s[0].texture:i,n.uniforms.incomingGas.value=e.to?c?s[1].texture:i:n.uniforms.outgoingGas.value,n.uniforms.incoming.value=e.to?a[1].texture:a[0].texture,n.uniforms.blend.value=e.mix,t.setRenderTarget(null),t.render(g,b)}finally{t.setRenderTarget(null)}},dispose(){[...a,...s].forEach(e=>e.dispose()),i.dispose(),u.dispose(),n.dispose()}}}export{R as c};
