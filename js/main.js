        import { fadeStopSound } from './audio.js';
        import { createGlitchOverlay } from './glitch-overlay.js';
        import { preload as preloadAssets } from './preload.js';
        import { create as createScene } from './create.js';
        import { update as updateScene } from './update.js';

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


        function showTitle(scene) {
            const title = scene.add.image(scene.game.config.width / 2, scene.game.config.height / 2, 'title');
            title.setDisplaySize(800, 500); // タイトル画像のサイズ
            title.setInteractive();

            // タイトル画像をカメラに固定
            title.setScrollFactor(0);

            // 操作キーガイド（タイトル下）
            const keyGuide = scene.add.text(
                scene.game.config.width / 2,
                scene.game.config.height / 2 + 260,
                'USE ARROW KEYS + SPACE'.split('').join(' '),
                {
                    fontSize: '20px',
                    fill: '#88ffaa',
                    fontFamily: "Helvetica, Arial, sans-serif"
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(100);

            scene.spaceshipShadow.setAlpha(0);

            function startGame() {
                scene.spaceshipShadow.setAlpha(1);
                // ENTER 開始時の SE：landing.wav（goal キーと共用、開始音 0.15）
                if (scene.goalSound) scene.goalSound.play({ volume: 0.15 });
                scene.tweens.add({
                    targets: [title, keyGuide],
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        title.destroy();
                        keyGuide.destroy();
                    }
                });

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

            title.once('pointerup', startGame);
            scene.input.keyboard.once('keydown-ENTER', startGame);
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


