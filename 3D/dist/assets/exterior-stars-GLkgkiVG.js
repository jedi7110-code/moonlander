import{c as A,e as K,V as b,z as j,J as R,v as re,h as U,C as T,K as le,N as ce,U as Y,j as $,X as ue,Y as L,Z as O,f as pe,F as W,r as fe,_ as H,$ as he,a0 as Z,a1 as de,a2 as me,q as ve,l as xe,a3 as ge,w as ye,S as Me,a4 as be}from"./three-DQ4xDlKG.js";class E extends A{constructor(){super(E.Geometry,new K({opacity:0,transparent:!0})),this.isLensflare=!0,this.type="Lensflare",this.frustumCulled=!1,this.renderOrder=1/0;const o=new b,n=new b,i=new j(16,16),t=new j(16,16);let s=Y;const a=E.Geometry,r=new R({uniforms:{scale:{value:null},screenPosition:{value:null}},vertexShader:`

				precision highp float;

				uniform vec3 screenPosition;
				uniform vec2 scale;

				attribute vec3 position;

				void main() {

					gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );

				}`,fragmentShader:`

				precision highp float;

				void main() {

					gl_FragColor = vec4( 1.0, 0.0, 1.0, 1.0 );

				}`,depthTest:!0,depthWrite:!1,transparent:!1}),l=new R({uniforms:{map:{value:i},scale:{value:null},screenPosition:{value:null}},vertexShader:`

				precision highp float;

				uniform vec3 screenPosition;
				uniform vec2 scale;

				attribute vec3 position;
				attribute vec2 uv;

				varying vec2 vUV;

				void main() {

					vUV = uv;

					gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );

				}`,fragmentShader:`

				precision highp float;

				uniform sampler2D map;

				varying vec2 vUV;

				void main() {

					gl_FragColor = texture2D( map, vUV );

				}`,depthTest:!1,depthWrite:!1,transparent:!1}),u=new A(a,r),c=[],f=B.Shader,m=new R({name:f.name,uniforms:{map:{value:null},occlusionMap:{value:t},color:{value:new T(16777215)},scale:{value:new U},screenPosition:{value:new b}},vertexShader:f.vertexShader,fragmentShader:f.fragmentShader,blending:re,transparent:!0,depthWrite:!1}),h=new A(a,m);this.addElement=function(v){c.push(v)};const p=new U,x=new U,I=new le,d=new ce;this.onBeforeRender=function(v,k,w){v.getCurrentViewport(d);const N=v.getRenderTarget(),V=N!==null?N.texture.type:Y;s!==V&&(i.dispose(),t.dispose(),i.type=t.type=V,s=V);const ne=d.w/d.z,q=d.z/2,X=d.w/2;let S=16/d.w;if(p.set(S*ne,S),I.min.set(d.x,d.y),I.max.set(d.x+(d.z-16),d.y+(d.w-16)),n.setFromMatrixPosition(this.matrixWorld),n.applyMatrix4(w.matrixWorldInverse),!(n.z>0)&&(o.copy(n).applyMatrix4(w.projectionMatrix),x.x=d.x+o.x*q+q-8,x.y=d.y+o.y*X+X-8,I.containsPoint(x))){v.copyFramebufferToTexture(x,i);let z=r.uniforms;z.scale.value=p,z.screenPosition.value=o,v.renderBufferDirect(w,null,a,r,u,null),v.copyFramebufferToTexture(x,t),z=l.uniforms,z.scale.value=p,z.screenPosition.value=o,v.renderBufferDirect(w,null,a,l,u,null);const oe=-o.x*2,ie=-o.y*2;for(let F=0,ae=c.length;F<ae;F++){const C=c[F],D=m.uniforms;D.color.value.copy(C.color),D.map.value=C.texture,D.screenPosition.value.x=o.x+oe*C.distance,D.screenPosition.value.y=o.y+ie*C.distance,S=C.size/d.w;const se=d.w/d.z;D.scale.value.set(S*se,S),m.uniformsNeedUpdate=!0,v.renderBufferDirect(w,null,a,m,h,null)}}},this.dispose=function(){r.dispose(),l.dispose(),m.dispose(),i.dispose(),t.dispose();for(let v=0,k=c.length;v<k;v++)c[v].texture.dispose()}}}class B{constructor(o,n=1,i=0,t=new T(16777215)){this.texture=o,this.size=n,this.distance=i,this.color=t}}B.Shader={name:"LensflareElementShader",uniforms:{map:{value:null},occlusionMap:{value:null},color:{value:null},scale:{value:null},screenPosition:{value:null}},vertexShader:`

		precision highp float;

		uniform vec3 screenPosition;
		uniform vec2 scale;

		uniform sampler2D occlusionMap;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUV;
		varying float vVisibility;

		void main() {

			vUV = uv;

			vec2 pos = position.xy;

			vec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.5 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.1, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.1, 0.5 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.5 ) );

			vVisibility =        visibility.r / 9.0;
			vVisibility *= 1.0 - visibility.g / 9.0;
			vVisibility *=       visibility.b / 9.0;

			gl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D map;
		uniform vec3 color;

		varying vec2 vUV;
		varying float vVisibility;

		void main() {

			vec4 texture = texture2D( map, vUV );
			texture.a *= vVisibility;
			gl_FragColor = texture;
			gl_FragColor.rgb *= color;

		}`};E.Geometry=(function(){const e=new $,o=new Float32Array([-1,-1,0,0,0,1,-1,0,1,0,1,1,0,1,1,-1,1,0,0,1]),n=new ue(o,5);return e.setIndex([0,1,2,0,2,3]),e.setAttribute("position",new L(n,3,0,!1)),e.setAttribute("uv",new L(n,2,3,!1)),e})();function J(e){const o=document.createElement("canvas");o.width=o.height=512;const n=o.getContext("2d");if(n.translate(256,256),e==="streak"){n.scale(1,.014);const t=n.createRadialGradient(0,0,0,0,0,256);t.addColorStop(0,"rgba(240,250,255,.78)"),t.addColorStop(.08,"rgba(170,220,255,.36)"),t.addColorStop(.42,"rgba(95,170,255,.14)"),t.addColorStop(1,"rgba(70,145,255,0)"),n.fillStyle=t,n.fillRect(-256,-256,512,512)}else{const t=n.createRadialGradient(0,0,0,0,0,230);t.addColorStop(0,"rgba(210,240,255,.35)"),t.addColorStop(.12,"rgba(130,195,255,.12)"),t.addColorStop(.45,"rgba(85,155,255,.025)"),t.addColorStop(1,"rgba(65,140,255,0)"),n.fillStyle=t,n.fillRect(-256,-256,512,512)}const i=new O(o);return i.name="Engine lens / "+e,i}function we(e,o){const n=o.x-e.x,i=o.y-e.y,t=o.z-e.z,s=Math.hypot(n,i,t);return s?pe.smoothstep(n/s,.65,.96):0}function Se(e,o){const n=Math.hypot(o.x-e.x,o.y-e.y,o.z-e.z);return Math.min(1,(200/Math.max(200,n))**2)}function ze(e,o,n){o.updateMatrixWorld(!0);const i=new b;let t=1/0,s=-1/0,a=1/0,r=-1/0;for(const l of e.engines)for(const u of[-1,1])for(const c of[-1,1]){const f=l.userData.throatRadius/.24;i.set(l.userData.glowPoint[0],u*f,c*f),l.localToWorld(i).applyMatrix4(o.matrixWorldInverse),!(i.z>=-o.near)&&(i.applyMatrix4(o.projectionMatrix),t=Math.min(t,i.x),s=Math.max(s,i.x),a=Math.min(a,i.y),r=Math.max(r,i.y))}return Number.isFinite(t)?Math.max((s-t)*n.x/2,(r-a)*n.y/2):0}function Ce(e,o,n,{strength:i=.65,streakRatio:t=2.4,haloRatio:s=.16}={}){const a=ze(e,o,n),r=new b;return e.engines.map(l=>{r.fromArray(l.userData.glowPoint),l.localToWorld(r);const u=we(o.position,r)*Se(o.position,r);return{strength:i*u,visible:a>0&&u>.002,streakSize:a*t,haloSize:a*s}})}function Ge(e){const o={streak:J("streak"),halo:J("halo")},n=e.engines.map((t,s)=>{const a=new E;a.name="Blue anamorphic engine flare / "+s,a.position.fromArray(t.userData.glowPoint),a.castShadow=!1,t.add(a);const r=[new B(o.streak,340,0,new T(8436479)),new B(o.halo,54,0,new T(9554687))];return r.forEach(l=>a.addElement(l)),{flare:a,elements:r,colors:r.map(l=>l.color.clone()),position:new b,index:s}});let i=!0;return{setEnabled(t){i=!!t},update(t,s,a){const r=Ce(e,t,s,a);for(const[l,u]of n.entries()){const c=r[l];u.flare.visible=i&&c.visible,u.elements.forEach((f,m)=>{f.color.copy(u.colors[m]).multiplyScalar(c.strength),f.size=m===0?c.streakSize:c.haloSize})}},dispose(){n.forEach(({flare:t})=>{t.removeFromParent(),t.dispose(),t.material.dispose()}),Object.values(o).forEach(t=>t.dispose())}}}const De=2,Pe=3600;function Oe({ship:e,camera:o,controls:n,lights:i=[],speed:t=De}){let s=!0,a=0,r=0;return{get offset(){return r},get distance(){return a},setEnabled(l){s=!!l},step(l){if(!s||!Number.isFinite(l)||l<=0)return;a+=l*t;const u=a%Pe,c=u-r;r=u,e.root.position.x+=c,o.position.x+=c,n.target.x+=c;for(const f of i)f.position.x+=c,f.target.position.x+=c}}}const Q=48e3,ee=[.52,-.64,.56],Ee=Math.hypot(...ee),g=ee.map(e=>e/Ee),te=[g[2],0,-g[0]],Ae=Math.hypot(...te),P=te.map(e=>e/Ae),Te=[g[1]*P[2],g[2]*P[0]-g[0]*P[2],-g[1]*P[0]],Be=e=>()=>(e=Math.imul(e,1664525)+1013904223>>>0,e/4294967296);function Ie({count:e=Q,seed:o=735}={}){const n=Be(o),i=[];for(let t=0;t<e;t++){const s=n()*Math.PI*2;let a;if(t<e*.75){const h=2*n()-1,p=Math.sqrt(1-h*h);a=[p*Math.cos(s),h,p*Math.sin(s)]}else{const h=Math.max(-.6,Math.min(.6,Math.sqrt(-2*Math.log(Math.max(1e-8,n())))*Math.cos(2*Math.PI*n())*.16));a=g.map((p,x)=>Math.sin(h)*p+Math.cos(h)*(P[x]*Math.cos(s)+Te[x]*Math.sin(s)))}const r=n(),l=n(),u=n(),c=r<.88?.01+.18*l**2:r<.994?.22+.55*l**2:1.2+.9*l,f=r<.88?1+.45*n():r<.994?1.3+.6*n():2+1.2*n(),m=u<.1?[1,.86,.72]:u>.68?[.76,.87,1]:[.93,.96,1];i.push({p:a,color:m.map(h=>h*c),size:f,brightness:c})}return i}const _=e=>e*e*(3-2*e),M=(e,o,n)=>e+(o-e)*n;function y(e,o,n){let i=Math.imul(e,374761393)^Math.imul(o,668265263)^Math.imul(n,2147483647);return i=Math.imul(i^i>>>13,1274126177),((i^i>>>16)>>>0)/4294967296}function G(e,o,n){const i=Math.floor(e),t=Math.floor(o),s=Math.floor(n),a=_(e-i),r=_(o-t),l=_(n-s);return M(M(M(y(i,t,s),y(i+1,t,s),a),M(y(i,t+1,s),y(i+1,t+1,s),a),r),M(M(y(i,t,s+1),y(i+1,t,s+1),a),M(y(i,t+1,s+1),y(i+1,t+1,s+1),a),r),l)}function Ve([e,o,n]){const i=e*g[0]+o*g[1]+n*g[2],t=Math.exp(-((i/.26)**2)),s=G(e*3+31,o*3+13,n*3+47),a=G(e*11+19,o*11+37,n*11+23),r=G(e*7+73,o*7+41,n*7+59),l=t*(.15+s*.65+a*.2)*(1-r*.7);return[45e-5+l*.0025,7e-4+l*.0075,.0015+l*.018]}const Fe=e=>e>=1?0:.84*Math.exp(-e*e*12)+.16*Math.exp(-e*e*2.8),Re=e=>Math.round(255*Math.max(0,Math.min(1,e<=.0031308?12.92*e:1.055*e**(1/2.4)-.055)));function Ue(){if(typeof document>"u")return null;const e=document.createElement("canvas");e.width=512,e.height=256;const o=e.getContext("2d"),n=o.createImageData(e.width,e.height);for(let t=0;t<e.height;t++)for(let s=0;s<e.width;s++){const a=(t+.5)/e.height*Math.PI,r=(s+.5)/e.width*Math.PI*2,l=Ve([-Math.sin(a)*Math.cos(r),Math.cos(a),Math.sin(a)*Math.sin(r)]),u=(t*e.width+s)*4;for(let c=0;c<3;c++)n.data[u+c]=Re(l[c]);n.data[u+3]=255}o.putImageData(n,0,0);const i=new O(e);return i.colorSpace=Me,i.wrapS=be,i}function We(){if(typeof document>"u")return null;const e=document.createElement("canvas");e.width=e.height=64;const o=e.getContext("2d"),n=o.createImageData(64,64);for(let i=0;i<64;i++)for(let t=0;t<64;t++){const s=Math.hypot((t+.5)/32-1,(i+.5)/32-1),a=(i*64+t)*4;n.data[a]=n.data[a+1]=n.data[a+2]=255,n.data[a+3]=Math.round(Fe(s)*255)}return o.putImageData(n,0,0),new O(e)}function ke({count:e=Q,radius:o=1200,seed:n=735}={}){const i=[],t=[],s=[];for(const p of Ie({count:e,seed:n}))i.push(...p.p.map(x=>x*o)),t.push(...p.color),s.push(p.size);const a=new $;a.setAttribute("position",new W(i,3)),a.setAttribute("color",new W(t,3)),a.setAttribute("starSize",new W(s,1));const r=We(),l=Ue(),u=new fe({size:1,map:r,vertexColors:!0,sizeAttenuation:!1,depthTest:!1,depthWrite:!1,toneMapped:!1,blending:me,blendEquation:Z,blendSrc:de,blendDst:H,blendEquationAlpha:Z,blendSrcAlpha:he,blendDstAlpha:H});u.onBeforeCompile=p=>{p.vertexShader=`attribute float starSize;
`+p.vertexShader,p.vertexShader=p.vertexShader.replace("gl_PointSize = size;","gl_PointSize = size * starSize;")};const c=new ve(a,u);c.name="Distant photographic stars",c.frustumCulled=!1,c.renderOrder=-9;const f=new xe(o*1.08,48,24),m=new K({map:l,color:l?16777215:198153,side:ye,depthTest:!1,depthWrite:!1,toneMapped:!1,opacity:0,blending:ge}),h=new A(f,m);return h.name="Distant blue-black stellar haze",h.frustumCulled=!1,h.renderOrder=-10,{field:c,haze:h,follow(p){c.position.copy(p.position),h.position.copy(p.position)},dispose(){c.removeFromParent(),h.removeFromParent(),a.dispose(),u.dispose(),f.dispose(),m.dispose(),r?.dispose(),l?.dispose()}}}export{De as E,ke as a,Oe as b,Ge as c,ze as p,Ce as s};
