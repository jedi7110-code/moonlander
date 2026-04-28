// ===== 捕獲時グリッチ用のフルスクリーン WebGL オーバーレイ =====
// ykob/sketch-threejs glitch.html (CodePen GmEzoQ) のシェーダーをそのまま使用
export function createGlitchOverlay(game) {
    let initialized = false;
    let renderer, sceneG, cameraG, uniforms, tex, mesh, rafId = null;
    const overlay = document.getElementById('glitch-overlay');

    const fragmentShader = `
        precision highp float;
        uniform float time;
        uniform vec2 resolution;
        uniform vec2 imageResolution;
        uniform sampler2D tex;
        uniform float strength;
        uniform float darken;
        varying vec2 vUv;

        float random(vec2 c){ return fract(sin(dot(c.xy ,vec2(12.9898,78.233))) * 43758.5453); }
        vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
        vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
        vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise3(vec3 v){
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute(permute(permute(
                      i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);
            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main(){
            // ゲーム canvas をビューポートに収まるよう中央寄せでスケール
            vec2 ratio = vec2(
                min((resolution.x / resolution.y) / (imageResolution.x / imageResolution.y), 1.0),
                min((resolution.y / resolution.x) / (imageResolution.y / imageResolution.x), 1.0)
            );
            vec2 baseUv = vec2(
                vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
                vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
            );

            vec2 shake = vec2(strength * 8.0 + 0.5) * vec2(
                random(vec2(time)) * 2.0 - 1.0,
                random(vec2(time * 2.0)) * 2.0 - 1.0
            ) / resolution;

            float y = baseUv.y * resolution.y;
            float rgbWave = (
                snoise3(vec3(0.0, y * 0.01, time * 400.0)) * (2.0 + strength * 32.0)
                * snoise3(vec3(0.0, y * 0.02, time * 200.0)) * (1.0 + strength * 4.0)
                + step(0.9995, sin(y * 0.005 + time * 1.6)) * 12.0
                + step(0.9999, sin(y * 0.005 + time * 2.0)) * -18.0
            ) / resolution.x;
            float rgbDiff = (6.0 + sin(time * 500.0 + baseUv.y * 40.0) * (20.0 * strength + 1.0)) / resolution.x;
            float rgbUvX = baseUv.x + rgbWave;
            float r = texture2D(tex, vec2(rgbUvX + rgbDiff, baseUv.y) + shake).r;
            float gC = texture2D(tex, vec2(rgbUvX, baseUv.y) + shake).g;
            float b = texture2D(tex, vec2(rgbUvX - rgbDiff, baseUv.y) + shake).b;

            float whiteNoise = (random(baseUv + mod(time, 10.0)) * 2.0 - 1.0) * (0.15 + strength * 0.15);

            float bnTime = floor(time * 20.0) * 200.0;
            float noiseX = step((snoise3(vec3(0.0, baseUv.x * 3.0, bnTime)) + 1.0) / 2.0, 0.12 + strength * 0.3);
            float noiseY = step((snoise3(vec3(0.0, baseUv.y * 3.0, bnTime)) + 1.0) / 2.0, 0.12 + strength * 0.3);
            float bnMask = noiseX * noiseY;
            float bnUvX = baseUv.x + sin(bnTime) * 0.2 + rgbWave;
            float bnR = texture2D(tex, vec2(bnUvX + rgbDiff, baseUv.y)).r * bnMask;
            float bnG = texture2D(tex, vec2(bnUvX, baseUv.y)).g * bnMask;
            float bnB = texture2D(tex, vec2(bnUvX - rgbDiff, baseUv.y)).b * bnMask;
            vec4 blockNoise = vec4(bnR, bnG, bnB, 1.0);

            float bnTime2 = floor(time * 25.0) * 300.0;
            float noiseX2 = step((snoise3(vec3(0.0, baseUv.x * 2.0, bnTime2)) + 1.0) / 2.0, 0.12 + strength * 0.5);
            float noiseY2 = step((snoise3(vec3(0.0, baseUv.y * 8.0, bnTime2)) + 1.0) / 2.0, 0.12 + strength * 0.3);
            float bnMask2 = noiseX2 * noiseY2;
            float bnR2 = texture2D(tex, vec2(bnUvX + rgbDiff, baseUv.y)).r * bnMask2;
            float bnG2 = texture2D(tex, vec2(bnUvX, baseUv.y)).g * bnMask2;
            float bnB2 = texture2D(tex, vec2(bnUvX - rgbDiff, baseUv.y)).b * bnMask2;
            vec4 blockNoise2 = vec4(bnR2, bnG2, bnB2, 1.0);

            float waveNoise = (sin(baseUv.y * 1200.0) + 1.0) / 2.0 * (0.15 + strength * 0.2);

            vec4 col = vec4(r, gC, b, 1.0) * (1.0 - bnMask - bnMask2)
                     + (whiteNoise + blockNoise + blockNoise2 - waveNoise);
            // フェードアウトは画面が暗くなる方向（darken=1で完全に黒）
            gl_FragColor = vec4(col.rgb * (1.0 - darken), 1.0);
        }
    `;
    const vertexShader = `
        attribute vec3 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
    `;

    function syncOverlayToGameCanvas() {
        const gameCanvas = game.canvas;
        if (!gameCanvas) return;
        const r = gameCanvas.getBoundingClientRect();
        overlay.style.left = r.left + 'px';
        overlay.style.top = r.top + 'px';
        overlay.style.width = r.width + 'px';
        overlay.style.height = r.height + 'px';
        if (renderer) {
            renderer.setSize(r.width, r.height, false);
            uniforms.resolution.value.set(r.width, r.height);
        }
    }

    function init() {
        if (initialized) return;
        if (!window.THREE) { console.warn('THREE.js not loaded'); return; }
        const gameCanvas = game.canvas;
        if (!gameCanvas) return;
        renderer = new THREE.WebGLRenderer({ canvas: overlay, antialias: false, alpha: true });
        const r = gameCanvas.getBoundingClientRect();
        renderer.setSize(r.width, r.height, false);
        sceneG = new THREE.Scene();
        cameraG = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        tex = new THREE.CanvasTexture(gameCanvas);
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        uniforms = {
            time: { value: 0 },
            resolution: { value: new THREE.Vector2(r.width, r.height) },
            imageResolution: { value: new THREE.Vector2(gameCanvas.width, gameCanvas.height) },
            tex: { value: tex },
            strength: { value: 0 },
            darken: { value: 0 }
        };
        const mat = new THREE.RawShaderMaterial({ uniforms, vertexShader, fragmentShader });
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
        sceneG.add(mesh);
        syncOverlayToGameCanvas();
        window.addEventListener('resize', syncOverlayToGameCanvas);
        window.addEventListener('scroll', syncOverlayToGameCanvas, true);
        initialized = true;
    }

    function trigger(duration = 700) {
        init();
        if (!initialized) return;
        syncOverlayToGameCanvas(); // 表示直前に位置を再同期
        overlay.style.opacity = '1';
        overlay.style.display = 'block';
        uniforms.strength.value = 1.0;
        uniforms.time.value = 0;
        const start = performance.now();
        let last = start;
        if (rafId) cancelAnimationFrame(rafId);
        const loop = () => {
            const now = performance.now();
            const t = (now - start) / duration;
            if (t >= 1) {
                uniforms.strength.value = 0;
                overlay.style.display = 'none';
                rafId = null;
                return;
            }
            uniforms.strength.value = 1 - t;
            uniforms.time.value += (now - last) / 1000;
            tex.needsUpdate = true;
            renderer.render(sceneG, cameraG);
            last = now;
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
    }

    // 「ザーーー」：strength を最大維持したまま画面が黒くなっていく
    function triggerSustained(holdMs, fadeMs, onComplete) {
        init();
        if (!initialized) { if (onComplete) onComplete(); return; }
        syncOverlayToGameCanvas();
        overlay.style.opacity = '1';
        overlay.style.display = 'block';
        uniforms.strength.value = 1.0;
        uniforms.darken.value = 0;
        uniforms.time.value = 0;
        if (rafId) cancelAnimationFrame(rafId);
        const start = performance.now();
        let last = start;
        const total = holdMs + fadeMs;
        const loop = () => {
            const now = performance.now();
            const elapsed = now - start;
            if (elapsed >= total) {
                uniforms.darken.value = 0;
                overlay.style.display = 'none';
                rafId = null;
                if (onComplete) onComplete();
                return;
            }
            // hold 中は darken=0、fade 中に 0→1 で画面が黒くなる
            uniforms.darken.value = elapsed > holdMs ? (elapsed - holdMs) / fadeMs : 0;
            uniforms.strength.value = 1.0; // 強度キープ
            uniforms.time.value += (now - last) / 1000;
            tex.needsUpdate = true;
            renderer.render(sceneG, cameraG);
            last = now;
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
    }

    // 「ザ、ザ」と2回続けて発火
    function triggerDouble(opts) {
        const o = opts || {};
        const initialDelay = o.initialDelay != null ? o.initialDelay : 200;
        const burstDuration = o.burstDuration != null ? o.burstDuration : 250;
        const gap = o.gap != null ? o.gap : 120;
        setTimeout(() => trigger(burstDuration), initialDelay);
        setTimeout(() => trigger(burstDuration), initialDelay + burstDuration + gap);
    }

    // 「ザ、ザ、ザーーー」3連発：最後はサステイン+overlayフェードアウト
    function triggerSequence(opts) {
        const o = opts || {};
        const burstDuration = o.burstDuration != null ? o.burstDuration : 100;
        const gap = o.gap != null ? o.gap : 60;
        const sustainHold = o.sustainHold != null ? o.sustainHold : 250;
        const sustainFade = o.sustainFade != null ? o.sustainFade : 700;
        setTimeout(() => trigger(burstDuration), 0);
        setTimeout(() => trigger(burstDuration), burstDuration + gap);
        setTimeout(() => triggerSustained(sustainHold, sustainFade, o.onComplete),
            2 * (burstDuration + gap));
    }

    return { trigger, triggerDouble, triggerSequence, triggerSustained };
}
