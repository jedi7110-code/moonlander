import{a0 as x,a1 as h,a2 as p,a3 as T,a4 as G,y,V as w,a as D,a5 as U,q as _,C,e as M,d as S,i as E}from"./three-BmZlQQoH.js";function B(t,{samples:v=0}={}){const r=t.extensions.has("EXT_color_buffer_float")||t.extensions.has("EXT_color_buffer_half_float")?x:h,a=[0,1].map(()=>new p(1,1,{type:r,depthBuffer:!0,depthTexture:new T(1,1,G)}));for(const e of a)e.samples=t.capabilities.isWebGL2?Math.min(v,t.capabilities.maxSamples):0;const n=[0,1].map(()=>new p(1,1,{type:r,depthBuffer:!1})),i=new y(new Uint8Array(4),1,1);i.needsUpdate=!0;const s=new w,l=new D,d=new U(-1,1,1,-1,0,1),o=new _({uniforms:{outgoing:{value:a[0].texture},incoming:{value:a[0].texture},blend:{value:0},fade:{value:0},fadeColor:{value:new C("#030609")},outgoingGas:{value:i},incomingGas:{value:i}},depthTest:!1,depthWrite:!1,vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,fragmentShader:`uniform sampler2D outgoing;
      uniform sampler2D incoming;
      uniform sampler2D outgoingGas;
      uniform sampler2D incomingGas;
      uniform float blend;
      uniform float fade;
      uniform vec3 fadeColor;
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
        vec4 picture=mix(linearToOutputTexel(a),linearToOutputTexel(b),blend);
        gl_FragColor=mix(picture,linearToOutputTexel(vec4(fadeColor,1.0)),fade);
      }`});o.name="Exterior cinema / graded cross dissolve";const u=new M(2,2),g=new S(u,o);g.frustumCulled=!1,l.add(g);function f(e){(e.width!==s.x||e.height!==s.y)&&e.setSize(s.x,s.y)}return{render(e,m){t.getDrawingBufferSize(s),f(a[0]);try{t.setRenderTarget(a[0]);const b=m(e.from,a[0],n[0]);let c=!1;e.to&&(f(a[1]),t.setRenderTarget(a[1]),c=m(e.to,a[1],n[1])),o.uniforms.outgoingGas.value=b?n[0].texture:i,o.uniforms.incomingGas.value=e.to?c?n[1].texture:i:o.uniforms.outgoingGas.value,o.uniforms.incoming.value=e.to?a[1].texture:a[0].texture,o.uniforms.blend.value=e.mix,o.uniforms.fade.value=E.clamp(e.shot?.fade??0,0,1),t.setRenderTarget(null),t.render(l,d)}finally{t.setRenderTarget(null)}},dispose(){[...a,...n].forEach(e=>e.dispose()),i.dispose(),u.dispose(),o.dispose()}}}export{B as c};
