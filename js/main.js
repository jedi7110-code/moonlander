        import { fadeStopSound } from './audio.js';
        import { createGlitchOverlay } from './glitch-overlay.js';
        import { preload as preloadAssets, startBriefing } from './preload.js?v=18';
        import { create as createScene } from './create.js?v=75';
        import { update as updateScene } from './update.js?v=109';

        // #game-container を視覚的にビューポートに合わせて縮小（比率維持・拡大はしない）
        // 内部レイアウト（CRT/ローディング画面/ブリーフィング）は 1200x800 想定のまま、
        // CSS の transform: scale(var(--game-scale)) で全体を同率に縮める。
        const GAME_BASE_W = 1200;
        const GAME_BASE_H = 800;
        function fitGameContainer() {
            // 横画面タッチデバイスではオンスクリーンコントロール分の幅を確保
            const isTouchLandscape = window.matchMedia('(orientation: landscape) and (pointer: coarse)').matches;
            // D-pad/アクション含めて両端それぞれ約 18vh ぶんの余白を確保（vhベース換算）
            const reservedW = isTouchLandscape ? Math.round(window.innerHeight * 0.36) : 0;
            const availW = Math.max(320, window.innerWidth - reservedW);
            const s = Math.min(availW / GAME_BASE_W, window.innerHeight / GAME_BASE_H, 1);
            document.documentElement.style.setProperty('--game-scale', s);
        }
        fitGameContainer();
        window.addEventListener('resize', fitGameContainer);

        // 横画面スマホ用オンスクリーンコントロール：ボタン押下をキーイベントに変換
        (function setupTouchControls() {
            const buttons = document.querySelectorAll('.touch-btn');
            // data-key 属性に対応する KeyboardEvent.code / key
            const keyCodeMap = {
                ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, Enter: 13
            };
            const keyMap = {
                ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Space: ' ', Enter: 'Enter'
            };
            const pressed = new Map(); // code -> count（複数ボタンが同じキーを送る場合の参照カウント）
            function dispatch(type, code) {
                const ev = new KeyboardEvent(type, {
                    key: keyMap[code] || code,
                    code: code === 'Space' ? 'Space' : code,
                    keyCode: keyCodeMap[code] || 0,
                    which: keyCodeMap[code] || 0,
                    bubbles: true,
                    cancelable: true
                });
                window.dispatchEvent(ev);
                document.dispatchEvent(ev);
            }
            function press(code) {
                const c = (pressed.get(code) || 0) + 1;
                pressed.set(code, c);
                if (c === 1) dispatch('keydown', code);
            }
            function release(code) {
                const c = (pressed.get(code) || 0) - 1;
                if (c <= 0) {
                    pressed.delete(code);
                    dispatch('keyup', code);
                } else {
                    pressed.set(code, c);
                }
            }
            buttons.forEach((b) => {
                const code = b.getAttribute('data-key');
                if (!code) return;
                let down = false;
                const onDown = (e) => { e.preventDefault(); if (down) return; down = true; press(code); };
                const onUp   = (e) => { e.preventDefault(); if (!down) return; down = false; release(code); };
                b.addEventListener('touchstart', onDown, { passive: false });
                b.addEventListener('touchend',   onUp,   { passive: false });
                b.addEventListener('touchcancel', onUp,  { passive: false });
                // PCでも動作確認できるようマウスでも反応
                b.addEventListener('mousedown', onDown);
                b.addEventListener('mouseup',   onUp);
                b.addEventListener('mouseleave', onUp);
            });
        })();

        // 8bitエフェクト用PostFXパイプライン（ピクセル化・減色・スキャンライン）
        const PixelArtPipeline = new Phaser.Class({
            Extends: Phaser.Renderer.WebGL.Pipelines.PostFXPipeline,
            initialize: function PixelArtPipeline(game) {
                Phaser.Renderer.WebGL.Pipelines.PostFXPipeline.call(this, {
                    game: game,
                    renderTarget: true,
                    fragShader: [
                        'precision mediump float;',
                        'uniform sampler2D uMainSampler;',
                        'uniform vec2 uResolution;',
                        'varying vec2 outTexCoord;',
                        'void main() {',
                        '  float pixelSize = 2.0;',
                        '  vec2 px = pixelSize / uResolution;',
                        '  vec2 coord = floor(outTexCoord / px) * px + px * 0.5;',
                        '  vec4 color = texture2D(uMainSampler, coord);',
                        '  float levels = 32.0;',
                        '  color.rgb = floor(color.rgb * levels) / (levels - 1.0);',
                        '  float scan = mod(gl_FragCoord.y, 3.0) < 1.0 ? 0.82 : 1.0;',
                        '  color.rgb *= scan;',
                        '  gl_FragColor = color;',
                        '}'
                    ].join('\n')
                });
            },
            onPreRender: function () {
                this.set2f('uResolution', this.renderer.width, this.renderer.height);
            }
        });

        const config = {
            type: Phaser.WEBGL,
            width: 1400,
            height: 900,
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 80 }, // 重力を強く設定
                    debug: false
                }
            },
            pipeline: { 'PixelArt': PixelArtPipeline },
            parent: 'game-container',
            loader: {
                maxParallelDownloads: 100  // ローダーのパラレルダウンロード上限を上げる（Phaser 3.55の停止対策）
            },
            scene: {
                preload: preload,
                create: create,
                update: update
            }
        };

        const game = new Phaser.Game(config);
        window.__game = game;

        const GlitchOverlay = createGlitchOverlay(game);
        window.GlitchOverlay = GlitchOverlay;

        // ─────────────────────────────────────────────────────────────
        // iOS サイレントスイッチ回避トリック
        // 隠し <audio> 要素で無音 WAV をループ再生することで iOS の
        // audio session を「playback」カテゴリへ昇格させ、WebAudio が
        // サイレントスイッチを無視してメディア音声系で鳴るようにする。
        // 動作要件：
        //  - playsinline / webkit-playsinline 属性必須（インライン再生）
        //  - 必ずユーザー操作の中で .play() を呼ぶ
        //  - loop=true で常時鳴らし続ける（停止すると session が戻る）
        // ─────────────────────────────────────────────────────────────
        (function setupSilentAudioBypass() {
            // 1秒の無音 WAV を Blob として生成
            const sampleRate = 22050;
            const duration = 1;
            const numSamples = sampleRate * duration;
            const buf = new ArrayBuffer(44 + numSamples * 2);
            const view = new DataView(buf);
            const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
            writeStr(0, 'RIFF');
            view.setUint32(4, 36 + numSamples * 2, true);
            writeStr(8, 'WAVE');
            writeStr(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);   // PCM
            view.setUint16(22, 1, true);   // mono
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);  // 16bit
            writeStr(36, 'data');
            view.setUint32(40, numSamples * 2, true);
            const blob = new Blob([buf], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            const silent = document.createElement('audio');
            silent.src = url;
            silent.loop = true;
            silent.preload = 'auto';
            silent.setAttribute('playsinline', '');
            silent.setAttribute('webkit-playsinline', '');
            silent.style.display = 'none';
            // ボリュームは0にすると一部 iOS で session 昇格が起きないので極小値
            silent.volume = 0.001;
            document.body.appendChild(silent);

            let primed = false;
            const prime = () => {
                if (primed) return;
                const p = silent.play();
                if (p && p.then) {
                    p.then(() => { primed = true; }).catch(() => { /* 次のタップで再試行 */ });
                } else {
                    primed = true;
                }
            };
            // 最初のユーザー操作で必ず再生開始（capture phase で取りこぼし防止）
            ['touchstart', 'touchend', 'mousedown', 'click'].forEach((ev) => {
                document.addEventListener(ev, prime, { capture: true, passive: true });
            });
            // ページ復帰時にも再開（背景タブから戻ったとき等）
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && primed && silent.paused) {
                    silent.play().catch(() => {});
                }
            });
        })();



        function showTitle(scene) {
            // 状態判定：初回（HTML側） / クリア後の周回 or 死亡後リスタート（Phaserロゴ + HTMLプロンプト）
            // 着陸シーケンスで loading-screen を再利用するため remove ではなく hidden 化している。
            // hidden 状態は「初回のローディング画面ではない」=「リスタート/周回」として扱う
            const loadingScreenEl = document.getElementById('loading-screen');
            const loadingScreen = (loadingScreenEl && !loadingScreenEl.classList.contains('hidden') && !loadingScreenEl.classList.contains('cockpit-mode'))
                ? loadingScreenEl : null;
            const restartPrompt = document.getElementById('restart-prompt');
            let oldTitle = null;

            if (!loadingScreen) {
                // 旧 title.png を Phaser で表示
                const titleY = 410;
                oldTitle = scene.add.image(scene.game.config.width / 2, titleY, 'title');
                // 比率 1192x592 を維持してリサイズ
                oldTitle.setDisplaySize(800, 800 * 592 / 1192);
                oldTitle.setScrollFactor(0).setDepth(100);
                // PRESS ENTER は HTML 側の #restart-prompt（CRT 緑グロー＋点滅）を再利用
                if (restartPrompt) {
                    restartPrompt.textContent = 'PRESS ENTER';
                    restartPrompt.classList.add('below-logo', 'show');
                }
            }

            scene.spaceshipShadow.setAlpha(0);
            if (scene.spaceshipShadowGround) scene.spaceshipShadowGround.setAlpha(0);

            // iOS Safari 対策：WebAudio context が suspended のままだと
            // Phaser の SE が無音になる。canvas 以外（HTMLタイトル/ブリーフィング）で
            // タップが発生した場合 Phaser の自動 unlock が効かないことがあるため、
            // document へ張ったハンドラで context.resume + 無音バッファ再生で確実に
            // unlock する。
            // 注：iPhone 本体のサイレントスイッチが ON だと WebAudio は OS 側で
            // ミュートされるため、本コードでは復旧不可（サイレント解除で鳴る）。
            const resumeAudioContext = () => {
                try {
                    const sm = scene.sound;
                    if (!sm) return;
                    const ctx = sm.context;
                    if (!ctx) return;
                    if (ctx.state === 'suspended') {
                        const p = ctx.resume();
                        if (p && p.catch) p.catch(() => {});
                    }
                    if (ctx.createBuffer) {
                        const buffer = ctx.createBuffer(1, 1, 22050);
                        const src = ctx.createBufferSource();
                        src.buffer = buffer;
                        src.connect(ctx.destination);
                        if (src.start) src.start(0); else src.noteOn(0);
                    }
                    if (sm.unlock && sm.locked) sm.unlock();
                } catch (e) {}
            };
            ['touchend', 'touchstart', 'mousedown', 'click'].forEach((ev) => {
                document.addEventListener(ev, resumeAudioContext, { capture: true, passive: true });
            });

            let started = false;
            function startGame() {
                if (started) return;
                started = true;
                resumeAudioContext();

                const fadeOverlay = document.getElementById('fade-overlay');
                const FADE_MS = 400;
                // 初回タイトルからのスタートのみ黒フェード切替。リスタート時は即時切替
                const useFade = !!loadingScreen;

                if (useFade) {
                    if (fadeOverlay) fadeOverlay.classList.add('fade-in');
                    setTimeout(() => {
                        // 着陸時のコックピット視点で再利用するため、remove せず hidden 化
                        if (loadingScreen) loadingScreen.classList.add('hidden');
                        if (restartPrompt) restartPrompt.classList.remove('show');
                        if (fadeOverlay) fadeOverlay.classList.remove('fade-in');
                    }, FADE_MS);
                } else {
                    if (restartPrompt) {
                        restartPrompt.classList.remove('show', 'below-logo');
                    }
                }

                // 周回/リスタート開始：旧タイトルをフェードアウトして除去
                if (oldTitle) {
                    scene.tweens.add({
                        targets: oldTitle,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => oldTitle.destroy()
                    });
                }

                scene.spaceshipShadow.setAlpha(1);
                if (scene.spaceshipShadowGround) scene.spaceshipShadowGround.setAlpha(1);
                // ENTER 開始時の SE：landing.wav（goal キーと共用、開始音 0.075）
                if (scene.goalSound) scene.goalSound.play({ volume: 0.075 });

                // Phase 1: 母艦から降下（中心を少し行き過ぎて上に戻るビヨーン挙動。スラスター噴射しながら）
                scene.tweens.add({
                    targets: scene.spaceship,
                    y: 150,
                    duration: 4200,
                    ease: 'Back.easeOut',
                    easeParams: [2.4],
                    onUpdate: () => {
                        scene.jetParticles.up.setPosition(scene.spaceship.x, scene.spaceship.y + 25);
                    },
                    onComplete: () => {
                        // 中心到達と同時に操作可能へ（スナップ感を消すため残存モメンタムを付与）
                        scene.jetParticles.up.on = false;
                        fadeStopSound(scene, scene.jetSound, 0.5);
                        scene.spaceship.setVelocityY(-25); // わずかに上向きの残存速度
                        scene.spaceship.setGravityY(80);
                        scene.gameStarted = true;

                        // 燃料ゲージをポップイン表示
                        scene.tweens.add({
                            targets: [scene.fuelGaugeBorder, scene.fuelGauge],
                            alpha: 1,
                            scale: 1,
                            duration: 280,
                            ease: 'Back.easeOut'
                        });
                    }
                });

                // 降下序盤からスラスター点火（早めに噴射を見せる。loopなしで1回だけ再生）
                scene.time.delayedCall(600, () => {
                    scene.jetParticles.up.setPosition(scene.spaceship.x, scene.spaceship.y + 25);
                    scene.jetParticles.up.on = true;
                    if (!scene.jetSound.isPlaying) {
                        // 前回 fade で gain=0 のままになっている可能性があるため復元してから再生
                        if (scene.jetSound.volumeNode && scene.jetSound.manager) {
                            const ctx = scene.jetSound.manager.context;
                            scene.jetSound.volumeNode.gain.cancelScheduledValues(ctx.currentTime);
                            scene.jetSound.volumeNode.gain.setValueAtTime(0.5, ctx.currentTime);
                        }
                        scene.jetSound.play({ loop: false });
                    }
                });
            }

            // HTMLタイトル画面のクリック/タップでもブリーフィングへ遷移（ゲームは直接開始しない）
            // iOS Safari は cursor:pointer のない非ボタン要素で click が発火しないことがあるため touchend も併用
            if (loadingScreen) {
                let titleAdvanced = false;
                const onTitleTap = (e) => {
                    resumeAudioContext();
                    if (titleAdvanced) return;
                    if (!loadingScreen.classList.contains('title')) return;
                    titleAdvanced = true;
                    if (e && e.cancelable) e.preventDefault();
                    startBriefing(loadingScreen, () => startGame(), scene);
                };
                loadingScreen.addEventListener('click', onTitleTap);
                loadingScreen.addEventListener('touchend', onTitleTap, { passive: false });
            }
            // デバッグ：?cockpit 付きで起動した場合、title/briefing をスキップして即ゲーム開始
            try {
                if (window.location && window.location.search.includes('cockpit')) {
                    if (loadingScreen) {
                        loadingScreen.classList.remove('title', 'briefing');
                        loadingScreen.classList.add('hidden');
                    }
                    setTimeout(() => startGame(), 50);
                }
            } catch (e) {}

            // ENTER 状態遷移：title → briefing → game
            const enterAdvance = () => {
                resumeAudioContext();
                if (!loadingScreen) {
                    // 死亡後リスタート / クリア後周回：そのまま開始
                    startGame();
                    return;
                }
                const cls = loadingScreen.classList;
                if (cls.contains('briefing')) return; // ブリーフィング自身が処理
                const dismissedAt = loadingScreen._briefingDismissedAt || 0;
                if (Date.now() - dismissedAt < 300) return; // ブリーフィング離脱直後の同一ENTER無視
                if (cls.contains('title')) {
                    // タイトル → ブリーフィングへ遷移
                    startBriefing(loadingScreen, () => startGame(), scene);
                    return;
                }
                // ローディング中（lit のみ／title 前）はゲーム開始を許可しない
            };
            scene.input.keyboard.on('keydown-ENTER', enterAdvance);

            // ─── コナミコマンド：タイトル画面で ↑↑↓↓←→←→ + Enter でテストモード起動 ───
            // 起動後は本番でも無敵モード（プレイヤー捕獲・デブリ衝突無効）になり、
            // ブリーフィング前に "> TEST MODE" を 2 秒表示してから通常 briefing が始まる。
            (() => {
                const KONAMI_SEQ = [
                    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
                    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'
                ];
                let buf = [];
                document.addEventListener('keydown', (e) => {
                    if (e.code === 'Enter') {
                        // タイトル画面でだけ判定。バッファの末尾が KONAMI と一致したら発動
                        const onTitle = loadingScreen && loadingScreen.classList.contains('title');
                        if (onTitle && buf.length >= KONAMI_SEQ.length &&
                            KONAMI_SEQ.every((k, i) => buf[buf.length - KONAMI_SEQ.length + i] === k)) {
                            window.__testMode = true;
                            try { if (scene.testModeSound) scene.testModeSound.play(); } catch (err) {}
                            buf = [];
                        }
                        // 通常の Enter ハンドラは別途 enterAdvance が処理するのでここでは何もしない
                    } else {
                        buf.push(e.code);
                        if (buf.length > KONAMI_SEQ.length * 2) buf.shift();
                    }
                });
            })();
            // 死亡後リスタート / クリア後周回：Phaser キャンバスへのタップでも開始
            // (HTML タイトル画面のタップは loadingScreen のリスナーで処理済み)
            scene.input.on('pointerdown', () => {
                if (!loadingScreen) startGame();
            });
            // モバイル：レターボックス領域（canvas 外）のタップでも再スタートできるよう
            // document へも touchend ハンドラを張る。
            // ※ once:true だとタッチコントロール (D-pad/BEAM/JUMP) を誤タップした瞬間に
            //    「対象外なので何もしない」状態でリスナーが消費されてしまうので、
            //    startGame が実際に呼ばれた時だけ removeEventListener する。
            if (!loadingScreen) {
                const opts = { capture: true, passive: true };
                const docRestartTap = (e) => {
                    // タッチコントロールのボタン上のタップは無視（pointer-events:auto で別途処理される）
                    if (e.target && e.target.closest && e.target.closest('.touch-btn')) return;
                    document.removeEventListener('touchend', docRestartTap, true);
                    document.removeEventListener('mousedown', docRestartTap, true);
                    startGame();
                };
                document.addEventListener('touchend', docRestartTap, opts);
                document.addEventListener('mousedown', docRestartTap, opts);
            }
        }

        function preload() {
            preloadAssets(this);
        }

        function create() {
            createScene(this);
            showTitle(this);
        }

        function update(time, delta) {
            updateScene(this, time, delta);
        }


