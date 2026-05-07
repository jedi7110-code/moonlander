// Phaser scene の update フック本体。
import { fadeStopSound, startSoundCancelFade } from './audio.js';
import { steppedClimb, spawnDissolveStain, createGroundShadow } from './shadows.js';
import { gameOver } from './gameover.js';
import { enterCockpitMode, updateCockpit } from './cockpit.js?v=97';

// ローカル開発環境判定（localhost / 127.x / 192.168.x.x / 10.x / 172.16-31.x）
// または本番環境でコナミコマンド (window.__testMode) で起動したテストモードでも
// 無敵モード（プレイヤー捕獲・デブリ衝突を無効化）が有効になる。
const IS_LOCAL_HOST = (() => {
    try {
        const h = window.location.hostname;
        return h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h);
    } catch (e) { return false; }
})();
const isInvincible = () => IS_LOCAL_HOST || (typeof window !== 'undefined' && window.__testMode === true);

function restartGame(scene) {
    scene.gameStarted = false;
    scene.spaceship.setVisible(true);
    scene.spaceship.setPosition(scene.game.config.width / 2, -280);
    scene.spaceship.setVelocity(0);
    scene.spaceship.setAcceleration(0);
    scene.spaceship.setGravityY(80);
    scene.scene.resume();
    scene.scene.restart();
    scene.fuel = 200;
}

export function update(scene, time, delta) {
// コックピット視点モード中は専用ループを回し、通常の物理処理はスキップ
if (scene.cockpitMode) {
    updateCockpit(scene, delta);
    return;
}

// 手動降下：下キーで一段ずつ降りる、上キーで一段戻る。
// 各ステップ位置はハシゴの段に正確に対応（足が rung に乗る）。
// 影は step index の進捗に応じて 0→1 に変化
if (scene.playerDescendingManual && scene.astronautDescending && scene.descendStepPositions) {
    const positions = scene.descendStepPositions;
    const totalIdx = positions.length - 1;
    if (scene.astronautDescending.shadow && totalIdx > 0) {
        const progress = scene.descendStepIndex / totalIdx;
        scene.astronautDescending.shadow.alpha = Math.max(0, Math.min(1, progress));
    }
    if (!scene.descendStepInProgress) {
        let nextIdx = scene.descendStepIndex;
        if (scene.cursors.down.isDown) nextIdx = Math.min(totalIdx, nextIdx + 1);
        else if (scene.cursors.up.isDown) nextIdx = Math.max(0, nextIdx - 1);
        if (nextIdx !== scene.descendStepIndex) {
            scene.descendStepIndex = nextIdx;
            scene.descendStepInProgress = true;
            scene.tweens.add({
                targets: scene.astronautDescending,
                y: positions[nextIdx],
                duration: 100,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    if (nextIdx === totalIdx) {
                        // 地面に到達 → コールバック起動
                        const cb = scene.descendCallback;
                        scene.playerDescendingManual = false;
                        scene.descendCallback = null;
                        scene.astronautDescending = null;
                        scene.descendStepInProgress = false;
                        scene.descendStepPositions = null;
                        if (cb) cb();
                    } else {
                        scene.time.delayedCall(70, () => { scene.descendStepInProgress = false; });
                    }
                }
            });
        }
    }
}

// 宇宙飛行士操作モード（手動制御、物理エンジン不使用）
if (scene.astronautMode && scene.astronaut) {
    const dt = delta / 1000;
    const moveSpeed = 80;
    const gravity = 200;
    const jumpPower = -150;
    const onGround = scene.astronaut.y >= scene.astronautGroundY;

    // 捕獲後はプレイヤー操作不可（ビーム関連を停止し、レーザーだけ飛び続ける）
    // ※敵の移動・追加捕獲判定は継続させるため return しない
    if (scene.astronautGameOver) {
        if (scene.beamTameSound && scene.beamTameSound.isPlaying) scene.beamTameSound.stop();
        if (scene.beamChargeEmitter) scene.beamChargeEmitter.on = false;
        if (scene.lasers) {
            scene.lasers = scene.lasers.filter(l => {
                const dx = l.dir * l.speed * dt;
                l.beam.x += dx;
                l.glow.x += dx;
                if (scene.time.now - l.born > l.life) {
                    l.beam.destroy();
                    l.glow.destroy();
                    return false;
                }
                return true;
            });
        }
    }

    // 手動登り：上下キーで一段ずつ進む。各ステップ位置はハシゴの段に正確に対応
    // 影は step index の進捗に応じて 1→0 に変化（地面で標準、登るほど薄く）
    if (scene.playerClimbingManual && !scene.astronautGameOver && scene.climbStepPositions) {
        const positions = scene.climbStepPositions;
        const totalIdx = positions.length - 1;
        if (scene.astronaut && scene.astronaut.shadow && totalIdx > 0) {
            const progress = 1 - (scene.climbStepIndex / totalIdx);
            scene.astronaut.shadow.alpha = Math.max(0, Math.min(1, progress));
        }
        if (!scene.climbStepInProgress) {
            let nextIdx = scene.climbStepIndex;
            if (scene.cursors.up.isDown) nextIdx = Math.min(totalIdx, nextIdx + 1);
            else if (scene.cursors.down.isDown) nextIdx = Math.max(0, nextIdx - 1);
            if (nextIdx !== scene.climbStepIndex) {
                scene.climbStepIndex = nextIdx;
                scene.climbStepInProgress = true;
                scene.tweens.add({
                    targets: scene.astronaut,
                    y: positions[nextIdx],
                    duration: 100,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        if (nextIdx === totalIdx) {
                            // ハッチ内に到達 → コールバック起動
                            const cb = scene.playerClimbCallback;
                            scene.playerClimbingManual = false;
                            scene.playerClimbCallback = null;
                            scene.climbStepInProgress = false;
                            scene.climbStepPositions = null;
                            if (cb) cb();
                        } else {
                            scene.time.delayedCall(70, () => { scene.climbStepInProgress = false; });
                        }
                    }
                });
            }
        }
    }

    // 左右移動（捕獲後は操作不可）
    // 地上：入力中は即時に最大速度、キー離し時は摩擦減速（惰性モード）
    // 空中：同方向キーは向きの切替のみで vx 維持、逆方向キーは減速ブレーキ（0までで止まる、逆方向には加速しない）
    const frictionRate = 600;   // 地上のキー離し減速度 (px/s²)
    const airBrakeRate = 178;   // 空中の逆方向ブレーキ減速度 (px/s²) — 飛びすぎ調整用（最高速 80 → 0 まで約 0.45 秒）
    if (scene.astronautVX === undefined) scene.astronautVX = 0;
    const leftDown = !scene.astronautGameOver && !scene.playerClimbing && scene.cursors.left.isDown;
    const rightDown = !scene.astronautGameOver && !scene.playerClimbing && scene.cursors.right.isDown;
    const isMoving = leftDown || rightDown;
    const prevFacing = scene.astronautFacing;
    if (leftDown) {
        if (onGround) {
            scene.astronautVX = -moveSpeed; // 地上は即時最大速度
        } else if (scene.astronautVX > 0) {
            // 空中で右へ進んでいるとき左キー：ブレーキ（0 までで止まる、逆向きには加速しない）
            scene.astronautVX = Math.max(0, scene.astronautVX - airBrakeRate * dt);
        }
        scene.astronaut.setFlipX(false); // 元画像は左向き
        scene.astronautFacing = 'left';
        // 切替時のアニメ
        if (prevFacing === 'right' && onGround) {
            scene.astronaut.anims.play('astronaut_turn_flip_RtoL');
        } else if (prevFacing === 'front' && onGround) {
            scene.astronaut.anims.play('astronaut_turn_front_to_L');
        }
    } else if (rightDown) {
        if (onGround) {
            scene.astronautVX = moveSpeed; // 地上は即時最大速度
        } else if (scene.astronautVX < 0) {
            // 空中で左へ進んでいるとき右キー：ブレーキ
            scene.astronautVX = Math.min(0, scene.astronautVX + airBrakeRate * dt);
        }
        scene.astronaut.setFlipX(true); // 右向きは左右反転
        scene.astronautFacing = 'right';
        // 切替時のアニメ
        if (prevFacing === 'left' && onGround) {
            scene.astronaut.anims.play('astronaut_turn_flip_LtoR');
        } else if (prevFacing === 'front' && onGround) {
            scene.astronaut.anims.play('astronaut_turn_front_to_R');
        }
    } else if (!scene.astronautGameOver && !scene.playerClimbing && onGround) {
        // 接地中・キー離し時：摩擦で 0 に減速（惰性モード）
        if (scene.astronautVX > 0) scene.astronautVX = Math.max(0, scene.astronautVX - frictionRate * dt);
        else if (scene.astronautVX < 0) scene.astronautVX = Math.min(0, scene.astronautVX + frictionRate * dt);
    } else if (scene.astronautGameOver || scene.playerClimbing) {
        scene.astronautVX = 0; // 捕獲・ハシゴ中は即停止
    }
    // 空中で入力なしの時はジャンプ時の速度をそのまま維持（friction 適用しない）
    // 速度から位置を更新
    scene.astronaut.x += scene.astronautVX * dt;

    // 初回の移動で通常ズームへ戻す（ハシゴ降り時のアップからゲームプレイ用ズームへ）
    if (isMoving && scene.astronautHasMoved === false) {
        scene.astronautHasMoved = true;
        scene.tweens.add({
            targets: scene.cameras.main,
            zoom: 2.75,
            duration: 800,
            ease: 'Sine.easeInOut'
        });
    }

    // アニメーション制御（地上で動いているときだけ歩行、空中は開脚で固定）
    // 振り向きアニメ再生中は何も触らない
    const currentAnimKey = scene.astronaut.anims.currentAnim ? scene.astronaut.anims.currentAnim.key : null;
    const playingTurn = scene.astronaut.anims.isPlaying && currentAnimKey &&
        (currentAnimKey.startsWith('astronaut_turn_'));
    if (!scene.playerClimbing && !playingTurn) {
        if (!onGround) {
            // ジャンプ中：アニメ停止、開脚ポーズ（L2）で固定
            if (scene.astronaut.anims.isPlaying) scene.astronaut.anims.stop();
            if (scene.astronaut.texture.key !== 'player_L2') scene.astronaut.setTexture('player_L2');
        } else if (isMoving) {
            // 地上で移動中：歩行アニメ
            if (!scene.astronaut.anims.isPlaying || scene.astronaut.anims.currentAnim.key !== 'astronaut_walk') {
                scene.astronaut.anims.play('astronaut_walk');
            }
        } else if (scene.astronautHasMoved) {
            // 一度動いた後の静止：横向きベースフレーム（0）
            if (scene.astronaut.anims.isPlaying) scene.astronaut.anims.stop();
            if (scene.astronaut.texture.key !== 'player_0') scene.astronaut.setTexture('player_0');
        } else {
            // まだ動いていない状態：正面向き
            if (scene.astronaut.anims.isPlaying) scene.astronaut.anims.stop();
            if (scene.astronaut.texture.key !== 'spaceman') scene.astronaut.setTexture('spaceman');
        }
    }
    if (scene.astronautMinX !== undefined) {
        scene.astronaut.x = Phaser.Math.Clamp(scene.astronaut.x, scene.astronautMinX, scene.astronautMaxX);
        // モノリス接触でビームゲージ満タン
        const atMonolith = scene.astronaut.x <= scene.astronautMinX + 0.5
            || scene.astronaut.x >= scene.astronautMaxX - 0.5;
        if (atMonolith) {
            scene.beamEnergy = 100;
        }
    }

    // 足音（移動中かつ接地時、ランダムで間隔再生）
    if (isMoving && onGround && scene.time.now - scene.lastFootstepTime > 320) {
        const step = Phaser.Utils.Array.GetRandom(scene.footstepSounds);
        step.play();
        scene.lastFootstepTime = scene.time.now;
    } else if (!isMoving) {
        scene.lastFootstepTime = 0; // 停止時リセットで次の歩き出しが即鳴る
    }

    // ビーム残量の自動回復（宇宙船 or 月面車の近くで急速充電）
    const underShip = scene.spaceship && Math.abs(scene.astronaut.x - scene.spaceship.x) < 30;
    const nearCar = scene.moonCar && Math.abs(scene.astronaut.x - scene.moonCar.x) < 60;
    const regenRate = (underShip || nearCar) ? 90 : 15;
    scene.beamEnergy = Math.min(100, scene.beamEnergy + regenRate * dt);

    // ビーム残量ゲージ更新（宇宙飛行士上部、色も残量に追従）
    const gx = scene.astronaut.x;
    const gy = scene.astronaut.y - 14;
    scene.beamGaugeBg.setPosition(gx, gy);
    const gaugeRatio = Phaser.Math.Clamp(scene.beamEnergy / 100, 0, 1);
    const fillW = 10 * gaugeRatio;
    scene.beamGaugeFill.setPosition(gx - (10 - fillW) / 2, gy);
    scene.beamGaugeFill.width = fillW;
    const gr = Math.round(0xff * (1 - gaugeRatio));
    const gg = Math.round(0xff * gaugeRatio);
    const gb = Math.round(0xcc * gaugeRatio);
    const normalColor = (gr << 16) | (gg << 8) | gb;
    // 長押し中はゲージが点滅（チャージ中表示）
    const charging = scene.cursors.space.isDown && scene.beamHoldStart && scene.chargeAllowed;
    if (charging) {
        const flashOn = (Math.floor(scene.time.now / 80) % 2) === 0;
        scene.beamGaugeFill.fillColor = flashOn ? 0xffffff : normalColor;
    } else {
        scene.beamGaugeFill.fillColor = normalColor;
    }
    if (charging && !scene.chargedFired && !scene.beamTameSound.isPlaying) {
        scene.beamTameSound.play();
    } else if ((!charging || scene.chargedFired) && scene.beamTameSound.isPlaying) {
        scene.beamTameSound.stop();
    }

    // ビームチャージ中、銃口前方の半円状エリアに明滅粒がランダム出現
    // チャージ進行で最大半径が縮み、近くほど粒が密集する
    if (scene.beamChargeEmitter) {
        const chargeHoldMs = scene.beamHoldStart ? scene.time.now - scene.beamHoldStart : 0;
        const isChargingParticles = charging && !scene.chargedFired && chargeHoldMs > 300;
        if (isChargingParticles) {
            const pdir = scene.astronautFacing === 'left' ? -1 : 1;
            const focusX = scene.astronaut.x + pdir * 7;
            const focusY = scene.astronaut.y - 3;
            scene._chargeFocus.x = focusX;
            scene._chargeFocus.y = focusY;
            scene._chargeDir = pdir;
            scene._chargeProgress = Phaser.Math.Clamp((chargeHoldMs - 300) / 1200, 0, 1);
            scene.beamChargeEmitter.setPosition(focusX, focusY);
            scene.beamChargeEmitter.on = true;
        } else {
            scene.beamChargeEmitter.on = false;
        }
    }

    // スペース押下：チャージ計測開始（ここでは発射しない）
    if (!scene.astronautGameOver && !scene.playerClimbing && scene.astronautFacing && Phaser.Input.Keyboard.JustDown(scene.cursors.space)) {
        scene.beamHoldStart = scene.time.now;
        scene.chargedFired = false;
        // 押下時のエネルギーでチャージ可否をロック（回復による途中チャージ可能化を防ぐ）
        scene.chargeAllowed = scene.beamEnergy >= 50;
    }
    // スペース離した瞬間：チャージが発火してなければ通常ビーム
    if (!scene.astronautGameOver && !scene.playerClimbing && Phaser.Input.Keyboard.JustUp(scene.cursors.space)) {
        if (scene.astronautFacing && scene.beamHoldStart && !scene.chargedFired && scene.beamEnergy >= 5) {
            const ratio = Phaser.Math.Clamp(scene.beamEnergy / 100, 0, 1);
            const dir = scene.astronautFacing === 'left' ? -1 : 1;
            const startX = scene.astronaut.x + dir * 6;
            const startY = scene.astronaut.y - 3;
            const r = Math.round(0xff * (1 - ratio));
            const g = Math.round(0xff * ratio);
            const b = Math.round(0xcc * ratio);
            const beamColor = (r << 16) | (g << 8) | b;
            const beamLen = 6 + 14 * ratio;
            const glowLen = 4 + 10 * ratio;
            const beam = scene.add.rectangle(startX, startY, beamLen, 1, beamColor);
            beam.setDepth(9);
            const glow = scene.add.rectangle(startX, startY, glowLen, 1, 0xffffff);
            glow.setDepth(10);
            const power = ratio >= 0.67 ? 3 : ratio >= 0.34 ? 2 : 1;
            scene.lasers.push({ beam, glow, dir, speed: 620, born: scene.time.now, life: 1200, power, beamColor });
            scene.beamSound.play();
            scene.beamEnergy = Math.max(0, scene.beamEnergy - 22);
        }
        scene.beamHoldStart = null;
    }

    // 長押し1.5秒 + 押下時に既にエネルギー50以上 → チャージビーム（画面端まで貫通）
    if (!scene.astronautGameOver && !scene.playerClimbing && scene.astronautFacing && scene.cursors.space.isDown && scene.beamHoldStart
        && !scene.chargedFired && scene.time.now - scene.beamHoldStart >= 1500 && scene.chargeAllowed) {
        scene.chargedFired = true;
        const dir = scene.astronautFacing === 'left' ? -1 : 1;
        const startX = scene.astronaut.x + dir * 6;
        const startY = scene.astronaut.y - 3;
        // 画面端までの距離
        const camW = scene.cameras.main.width / scene.cameras.main.zoom;
        const beamLen = camW;
        const beam = scene.add.rectangle(startX, startY, beamLen, 1, 0x00ffff);
        beam.setOrigin(dir < 0 ? 1 : 0, 0.5);
        beam.setDepth(9);
        const glow = scene.add.rectangle(startX, startY - 0.5, beamLen, 0.5, 0xffffff);
        glow.setOrigin(dir < 0 ? 1 : 0, 0.5);
        glow.setDepth(10);
        scene.lasers.push({ beam, glow, dir, speed: 0, born: scene.time.now, life: 250, power: 6, charged: true, hitSet: new Set() });
        scene.beamSound.play();
        scene.beamEnergy = Math.max(0, scene.beamEnergy - 50);

        // ビーム経路にキラキラ残像（1pxドットが時差でチカチカ）
        const sparkleCount = 50;
        for (let i = 0; i < sparkleCount; i++) {
            const t = i / sparkleCount;
            const sx = startX + dir * beamLen * t + Phaser.Math.Between(-2, 2);
            const sy = startY + Phaser.Math.Between(-3, 3);
            const sparkle = scene.add.rectangle(sx, sy, 1, 1, 0xffffff);
            sparkle.setDepth(11);
            sparkle.setAlpha(0);
            scene.tweens.add({
                targets: sparkle,
                alpha: 1,
                duration: 60,
                delay: Phaser.Math.Between(50, 500),
                yoyo: true,
                hold: Phaser.Math.Between(100, 400),
                repeat: Phaser.Math.Between(0, 2),
                onComplete: () => sparkle.destroy()
            });
        }
    }

    // レーザー更新＋標的との衝突判定
    if (scene.lasers) {
        scene.lasers = scene.lasers.filter(l => {
            const dx = l.dir * l.speed * dt;
            l.beam.x += dx;
            l.glow.x += dx;
            // 当たり判定（地底人）。チャージビームは小さい敵を貫通
            let hit = false;
            if (scene.enemies && scene.enemies.length) {
                const beamBounds = l.beam.getBounds();
                scene.enemies = scene.enemies.filter(e => {
                    const emergedEnough = !e.emerging || e.y <= scene.groundFeetY + e.displayHeight * 2 / 3;
                    const canHit = emergedEnough && Phaser.Geom.Intersects.RectangleToRectangle(beamBounds, e.getBounds());
                    if (!canHit) return true;
                    // チャージビーム：各敵に1回だけダメージ（フレーム跨ぎで重複ヒット防止）
                    if (l.charged) {
                        if (l.hitSet && l.hitSet.has(e)) return true;
                    } else if (hit) {
                        return true; // 通常ビームは1体のみ
                    }
                    if (l.charged && l.hitSet) l.hitSet.add(e);
                    e.hp -= l.power;
                    scene.beamHitSound.play();
                    hit = true;

                    // ヒット時の 1px ドット弾けエフェクト（溶接火花風：放物線で飛び、地面で跳ね返る）
                    {
                        // ヒット位置 X：敵中心からビーム侵入方向（プレイヤー側）へ寄せる。
                        // displayWidth/3 だけプレイヤー寄り、奥（敵中心側）への戻し量を雑魚/ボスで微調整
                        const inset = e.isBoss ? 3 : 4; // 雑魚はさらに 1px 奥
                        const hx = e.x - l.dir * (e.displayWidth / 3 - inset);
                        // ビーム（=プレイヤーが撃った高さ）でヒット位置 Y を取る。
                        // 敵中心だとボスは大きいので火花が高く出てしまうため。
                        const hy = l.beam.y;
                        const burstCount = l.charged ? 28 : 16;
                        // 火花の色はビームの色に追従（残量低 → 赤、満タン → 緑、チャージ → シアン）
                        const lighten = (c, t) => {
                            const cr = (c >> 16) & 0xff, cg = (c >> 8) & 0xff, cb = c & 0xff;
                            const nr = Math.round(cr + (255 - cr) * t);
                            const ng = Math.round(cg + (255 - cg) * t);
                            const nb = Math.round(cb + (255 - cb) * t);
                            return (nr << 16) | (ng << 8) | nb;
                        };
                        const colors = l.charged
                            ? [0xffffff, 0xc8ffd8, 0x88ffaa, 0xaaffff]
                            : [0xffffff, lighten(l.beamColor || 0xffffff, 0.6), l.beamColor || 0xffffff, lighten(l.beamColor || 0xffffff, 0.3)];
                        const groundY = scene.groundFeetY;
                        const sparkGravity = 320;   // 重力 (px/s²)
                        const bounceDamp = 0.55;    // 跳ね返りエネルギー保持率
                        const frictionDamp = 0.7;   // 跳ねた時の横速度減衰
                        for (let bi = 0; bi < burstCount; bi++) {
                            // 逆方向中心に ±約 86° の扇状（ビーム進行と逆向きを基本）
                            const baseAng = l.dir > 0 ? Math.PI : 0;
                            const ang = baseAng + Phaser.Math.FloatBetween(-1.5, 1.5);
                            const speed = Phaser.Math.FloatBetween(60, 160);
                            const life = Phaser.Math.Between(180, 360);
                            const c = Phaser.Math.RND.pick(colors);
                            const dot = scene.add.rectangle(hx, hy, 1, 1, c);
                            dot.setDepth(11);
                            // 物理パラメータ
                            let vx = Math.cos(ang) * speed;
                            let vy = Math.sin(ang) * speed;
                            let elapsed = 0;
                            const onTick = (time, delta) => {
                                if (!dot.active) {
                                    scene.events.off('update', onTick);
                                    return;
                                }
                                const dt = delta / 1000;
                                elapsed += delta;
                                vy += sparkGravity * dt;
                                let ny = dot.y + vy * dt;
                                if (ny >= groundY && vy > 0) {
                                    // 地面に当たったら火花のように跳ねる
                                    ny = groundY;
                                    vy = -Math.abs(vy) * bounceDamp;
                                    vx *= frictionDamp;
                                }
                                dot.x += vx * dt;
                                dot.y = ny;
                                dot.alpha = Math.max(0, 1 - elapsed / life);
                                if (elapsed >= life) {
                                    scene.events.off('update', onTick);
                                    dot.destroy();
                                }
                            };
                            scene.events.on('update', onTick);
                        }
                    }
                    if (e.hp <= 0) {
                        const abSize = e.isBoss ? 90 : 45;
                        const ab = scene.add.sprite(e.x, e.y - 5, 'bloodAlien');
                        ab.setDisplaySize(abSize, abSize);
                        ab.setDepth(10);
                        ab.play('bloodAlienSplat');
                        if (e.shadow) e.shadow.destroy();
                        e.destroy();
                        scene.enemyKills++;
                        if (scene.enemyKills % 5 === 0) scene.bossesDue++;
                        return false;
                    }
                    // 連続ヒット時に半透明のまま固まらないよう、ヒットフラッシュ専用tweenだけ
                    // 個別管理する（emerge等の他tweenはキルしない）
                    const prev = e._hitFlashTween;
                    e._hitFlashTween = null;
                    if (prev) {
                        prev.stop();
                        if (prev.remove) prev.remove();
                    }
                    e._hitFlashTween = scene.tweens.add({
                        targets: e,
                        alpha: 0.3,
                        duration: 80,
                        yoyo: true,
                        onComplete: () => { if (e.active) e.alpha = 1; e._hitFlashTween = null; },
                        onStop: () => { if (e.active) e.alpha = 1; }
                    });
                    return true;
                });
            }
            // チャージビームは貫通するので寿命まで残す、通常は命中で消滅
            const shouldDestroy = l.charged ? (scene.time.now - l.born > l.life) : (hit || scene.time.now - l.born > l.life);
            if (shouldDestroy) {
                l.beam.destroy();
                l.glow.destroy();
                return false;
            }
            return true;
        });
    }

    // ジャンプ（押し始めで初速、離したら上昇を切って強弱をつける）
    if (Phaser.Input.Keyboard.JustDown(scene.cursors.up) && onGround && !scene.astronautGameOver && !scene.playerClimbing) {
        scene.astronautVY = jumpPower;
        // 追従中の仲間も同じ初速でジャンプ（chain感のため段階的にdelay）
        if (scene.crewFollowing && scene.crews) {
            scene.crews.forEach((c, idx) => {
                scene.time.delayedCall((idx + 1) * 110, () => {
                    if (!c.captured && c.y >= scene.groundFeetY - 0.5) c.vy = jumpPower;
                });
            });
        }
    }
    if (Phaser.Input.Keyboard.JustUp(scene.cursors.up) && scene.astronautVY < 0) {
        scene.astronautVY *= 0.35;
        // 仲間も同様に上昇打ち切り（同じdelayでプレイヤーの動きを模倣）
        if (scene.crewFollowing && scene.crews) {
            scene.crews.forEach((c, idx) => {
                scene.time.delayedCall((idx + 1) * 110, () => {
                    if (c.vy && c.vy < 0) c.vy *= 0.35;
                });
            });
        }
    }

    // 重力＋位置更新（帰還時・捕獲後・手動登り中はtween/手動操作任せで物理停止）
    if (!scene.returningToShip && !scene.astronautGameOver && !scene.playerClimbingManual) {
        scene.astronautVY += gravity * dt;
        scene.astronaut.y += scene.astronautVY * dt;

        // 地面で止まる（着地した瞬間に足音）
        if (scene.astronaut.y >= scene.astronautGroundY) {
            scene.astronaut.y = scene.astronautGroundY;
            if (!onGround) {
                Phaser.Utils.Array.GetRandom(scene.footstepSounds).play();
                scene.lastFootstepTime = scene.time.now;
            }
            scene.astronautVY = 0;
        }
    }

    // 影は X方向のみ追従（Yは地面に固定済み）
    if (scene.astronaut.shadow) scene.astronaut.shadow.x = scene.astronaut.x;
    // ジャンプ中は高さに応じて影を薄くする（地面で標準、高く跳ぶほど薄く）
    // playerClimbingManual / playerDescendingManual 中は専用ロジックがあるためスキップ
    if (scene.astronaut.shadow && !scene.playerClimbingManual && !scene.playerDescendingManual && scene.astronautGroundY != null) {
        const heightAboveGround = Math.max(0, scene.astronautGroundY - scene.astronaut.y);
        const maxJumpH = 60;
        scene.astronaut.shadow.alpha = Math.max(0.1, 1 - heightAboveGround / maxJumpH);
    }
    // 仲間も同様にジャンプ中は影が薄くなる
    if (scene.crews && scene.crews.length && scene.groundFeetY != null) {
        scene.crews.forEach(c => {
            if (!c.shadow || c.captured || !c.visible) return;
            const heightAboveGround = Math.max(0, scene.groundFeetY - c.y);
            const maxJumpH = 60;
            c.shadow.alpha = Math.max(0.1, 1 - heightAboveGround / maxJumpH);
        });
    }

    // 地底人の移動＋宇宙飛行士との衝突
    if (scene.enemies && scene.enemies.length) {
        const enemySpeed = 50;
        // 接触判定用の縮小ボックス（透過余白を除外）
        const shrink = (obj, px, py) => {
            const b = obj.getBounds();
            return new Phaser.Geom.Rectangle(b.x + px, b.y + py, b.width - px * 2, b.height - py * 2);
        };
        const astroBox = shrink(scene.astronaut, 3, 2);
        // 生存中（=未捕獲）のターゲット候補を集める
        const liveTargets = [];
        if (scene.astronaut && scene.astronaut.visible && !scene.astronaut.captured) liveTargets.push(scene.astronaut);
        if (scene.crews) scene.crews.forEach(c => { if (c.visible && !c.captured) liveTargets.push(c); });

        for (const e of scene.enemies) {
            // 完全に地上に出るまで（emerge tween 完了まで）は捕獲対象外
            if (e.emerging) continue;
            // 出現中・捕獲動作中は移動・方向転換しない
            if (!e.emerging && !e.capturing) {
                // 最寄りの未捕獲ターゲットを追う（捕まったキャラには寄って来ない）
                let targetX = null;
                let minDist = Infinity;
                for (const t of liveTargets) {
                    const d = Math.abs(t.x - e.x);
                    if (d < minDist) { minDist = d; targetX = t.x; }
                }
                // 主人公が空中の間は方向転換しない（飛び越え後すぐ捕まるのを防止）。
                // ただしゲームオーバー後は常に最寄り未捕獲を追う。
                const prevDir = e.lastDir || 1;
                if ((onGround || scene.astronautGameOver) && targetX !== null && !e.turning && !e.emergeTransitioning) {
                    const dx = targetX - e.x;
                    e.lastDir = dx === 0 ? prevDir : Math.sign(dx);
                }
                const sign = e.lastDir || 1;
                // 個体ごとに spawn 時に固定された速度（base ±2 ランダム）
                const sp = e.speed != null ? e.speed : (e.isBoss ? 30 : enemySpeed);
                const animPrefix = e.isBoss ? 'bossAlien_' : 'alien_';
                const walkKey = animPrefix + 'walk';
                // 振り向き／出現トランジション中は移動・アニメ切替しない
                if (!e.turning && !e.emergeTransitioning && sign !== prevDir
                    && e.anims.currentAnim && e.anims.currentAnim.key === walkKey) {
                    e.turning = true;
                    e.setFlipX(false); // FL/FR は絶対向き
                    const turnKey = animPrefix + (sign > 0 ? 'turn_LtoR' : 'turn_RtoL');
                    e.anims.play(turnKey);
                    e.once('animationcomplete', () => {
                        if (!e.active) return;
                        e.turning = false;
                        e.setFlipX(e.lastDir > 0);
                        e.anims.play(walkKey);
                    });
                } else if (!e.turning && !e.emergeTransitioning) {
                    e.x += sign * sp * dt;
                    if (e.anims.currentAnim && e.anims.currentAnim.key === walkKey) {
                        e.setFlipX(sign > 0);
                        // ボスの walk フレームは影との隙間を埋めるため 2px 下げる
                        if (e.isBoss) e.y = scene.groundFeetY + 2;
                        else e.y = scene.groundFeetY;
                    }
                }
            }
            // 影をX方向に追従
            if (e.shadow) e.shadow.x = e.x;
            const enemyBox = e.isBoss ? shrink(e, 6, 5) : shrink(e, 2, 3);
            // 仲間が捕まった場合もゲームオーバー（救出失敗）。ハシゴ登り中も対象
            // 既に捕獲済みの仲間と、既に捕獲動作中の敵は対象外
            const hitCrew = !e.capturing && scene.crews && scene.crews.length
                ? scene.crews.find(c => c.visible && !c.captured && c.landed && Phaser.Geom.Intersects.RectangleToRectangle(shrink(c, 3, 2), enemyBox))
                : null;
            if (hitCrew) {
                const isFirstCapture = !scene.astronautGameOver;
                hitCrew.captured = true;
                e.capturing = true;
                // 捕まった仲間はその場で停止（落下・横移動の進行中tweenを切る）
                scene.tweens.killTweensOf(hitCrew);
                if (hitCrew.anims && hitCrew.anims.isPlaying) hitCrew.anims.stop();
                // 攻撃モーション（雑魚 A1→A2、ボス A1→A2→A3、最終フレームで停止）
                e.setFlipX(e.lastDir > 0); // A 系は左向き、右向き時のみ反転
                e.anims.play(e.isBoss ? 'bossAlien_attack' : 'alien_attack');
                scene.bloodSound.play(); // 各捕獲で鳴らす
                if (scene.deadSound) scene.deadSound.play();

                if (isFirstCapture) {
                    scene.astronautGameOver = true;
                    scene.crewFollowing = false;
                    scene.beamGaugeBg.setVisible(false);
                    scene.beamGaugeFill.setVisible(false);
                    if (scene.beamGaugeEmpty) scene.beamGaugeEmpty.setVisible(false);
                    if (scene.astronaut && scene.astronaut.anims && scene.astronaut.anims.isPlaying) scene.astronaut.anims.stop();
                    // 進行中の人間tweenを全停止（捕獲された仲間のtweenは下で新規作成）
                    scene.tweens.killTweensOf(scene.astronaut);
                    scene.crews.forEach(c => scene.tweens.killTweensOf(c));
                    scene.crews.forEach(c => { if (c.anims && c.anims.isPlaying) c.anims.stop(); });
                    // ぎゅーんとズームイン → ザ・ザ・ザーーーで scene 再起動
                    scene.cameras.main.pan(hitCrew.x, hitCrew.y, 600, 'Sine.easeInOut');
                    scene.cameras.main.zoomTo(4.5, 600, 'Sine.easeInOut');
                    scene.time.delayedCall(600, () => {
                        if (window.GlitchOverlay) window.GlitchOverlay.triggerSequence({
                            onComplete: () => scene.scene.restart()
                        });
                    });
                }

                // 空中の他の仲間を自然に地面へ落下（重力風のtween）
                scene.crews.forEach(c => {
                    if (c !== hitCrew && !c.captured && c.y < scene.groundFeetY - 1) {
                        const dur = Math.min(400, (scene.groundFeetY - c.y) * 8);
                        scene.tweens.add({ targets: c, y: scene.groundFeetY, duration: dur, ease: 'Quad.easeIn' });
                    }
                });
                // プレイヤーも空中なら自然に地面へ落下（仲間捕獲時に重力停止で空中固定になるバグ対策）
                if (scene.astronaut && scene.astronaut.y < scene.astronautGroundY - 1) {
                    scene.astronautVY = 0;
                    const dur = Math.min(400, (scene.astronautGroundY - scene.astronaut.y) * 8);
                    scene.tweens.add({ targets: scene.astronaut, y: scene.astronautGroundY, duration: dur, ease: 'Quad.easeIn' });
                }

                // 着地後に捕獲アニメ開始（自然な着地）
                const startCaptureAnim = () => {
                    const captureX = hitCrew.x;
                    const captureY = hitCrew.y - hitCrew.displayHeight / 2;
                    // 重なりは中心一致ではなく約2/3。エイリアンを進行方向の手前側に寄せる
                    const overlapOffset = (e.displayWidth || 33) / 3;
                    const enemyTargetX = hitCrew.x - Math.sign(e.lastDir || 1) * overlapOffset;
                    hitCrew.setDepth(9);
                    hitCrew.setMask(scene.groundMask);
                    e.setDepth(10);
                    e.setMask(scene.groundMask);

                    const cBubbles = [];
                    const cTotal = 60;
                    for (let i = 0; i < cTotal; i++) {
                        scene.time.delayedCall(i * 33, () => {
                            if (!hitCrew.captured) return;
                            const bx = captureX + Phaser.Math.Between(-7, 7);
                            const by = captureY + Phaser.Math.Between(-8, 8);
                            const r = Phaser.Math.FloatBetween(0.5, 2);
                            const b = scene.add.circle(bx, by, r, 0x33dd33, Phaser.Math.FloatBetween(0.5, 0.9));
                            b.setDepth(11);
                            b.setMask(scene.groundMask);
                            cBubbles.push(b);
                            scene.tweens.add({
                                targets: b,
                                x: b.x + Phaser.Math.Between(-2, 2),
                                y: b.y + Phaser.Math.Between(-2, 2),
                                scaleX: Phaser.Math.FloatBetween(0.7, 1.3),
                                scaleY: Phaser.Math.FloatBetween(0.7, 1.3),
                                duration: Phaser.Math.Between(250, 450),
                                ease: 'Sine.easeInOut',
                                yoyo: true,
                                repeat: -1
                            });
                        });
                    }

                    // エイリアンを捕獲点に寄せる（2/3重なりの位置へ）
                    scene.tweens.add({
                        targets: e,
                        x: enemyTargetX,
                        duration: 500,
                        ease: 'Sine.easeOut'
                    });

                    scene.time.delayedCall(cTotal * 33 + 300, () => {
                        // 影を消して緑のシミを地面に残す
                        if (hitCrew.shadow) { hitCrew.shadow.destroy(); hitCrew.shadow = null; }
                        spawnDissolveStain(scene, captureX, scene.groundFeetY);
                        const sinkY = scene.groundFeetY + 50;
                        // 仲間も一緒に地中へ引きずり込む
                        scene.tweens.add({
                            targets: [...cBubbles, e, hitCrew],
                            y: sinkY,
                            duration: 1000,
                            ease: 'Sine.easeIn',
                            onComplete: () => {
                                cBubbles.forEach(b => b.destroy());
                                if (e.shadow) e.shadow.destroy();
                                e.destroy();
                                hitCrew.destroy();
                                if (isFirstCapture) {
                                    scene.time.delayedCall(2500, () => { scene.scene.restart(); });
                                }
                            }
                        });
                    });
                };

                // その場で捕獲開始（空中でも待たずに止めて引きずり込む）
                startCaptureAnim();
                break; // このフレームで以降の処理は不要
            }
            if (!isInvincible() && !e.capturing && !scene.astronaut.captured && scene.astronaut.visible && Phaser.Geom.Intersects.RectangleToRectangle(astroBox, enemyBox)) {
                const isFirstCapture = !scene.astronautGameOver;
                scene.astronaut.captured = true;
                e.capturing = true;
                // 攻撃モーション（雑魚 A1→A2、ボス A1→A2→A3、最終フレームで停止）
                e.setFlipX(e.lastDir > 0); // A 系は左向き、右向き時のみ反転
                e.anims.play(e.isBoss ? 'bossAlien_attack' : 'alien_attack');
                scene.bloodSound.play(); // 各捕獲で鳴らす
                if (scene.deadSound) scene.deadSound.play();

                if (isFirstCapture) {
                    scene.astronautGameOver = true;
                    scene.crewFollowing = false;
                    scene.beamGaugeBg.setVisible(false);
                    scene.beamGaugeFill.setVisible(false);
                    if (scene.beamGaugeEmpty) scene.beamGaugeEmpty.setVisible(false);
                    if (scene.astronaut.anims && scene.astronaut.anims.isPlaying) scene.astronaut.anims.stop();
                    // 進行中の人間tweenを全停止（捕獲演出は下で新規作成）
                    scene.tweens.killTweensOf(scene.astronaut);
                    if (scene.crews) {
                        scene.crews.forEach(c => scene.tweens.killTweensOf(c));
                        scene.crews.forEach(c => { if (c.anims && c.anims.isPlaying) c.anims.stop(); });
                    }
                    // ぎゅーんとズームイン → ザ・ザ・ザーーーで scene 再起動
                    scene.cameras.main.pan(scene.astronaut.x, scene.astronaut.y, 600, 'Sine.easeInOut');
                    scene.cameras.main.zoomTo(4.5, 600, 'Sine.easeInOut');
                    scene.time.delayedCall(600, () => {
                        if (window.GlitchOverlay) window.GlitchOverlay.triggerSequence({
                            onComplete: () => scene.scene.restart()
                        });
                    });
                }

                // 空中の仲間を自然落下tweenで地面へ
                if (scene.crews) scene.crews.forEach(c => {
                    if (!c.captured && c.y < scene.groundFeetY - 1) {
                        const dur = Math.min(400, (scene.groundFeetY - c.y) * 8);
                        scene.tweens.add({ targets: c, y: scene.groundFeetY, duration: dur, ease: 'Quad.easeIn' });
                    }
                });

                // 着地後に捕獲アニメ開始（プレイヤーは重力で自然落下）
                const startCaptureAnim = () => {
                    const captureX = scene.astronaut.x;
                    const captureY = scene.astronaut.y;
                    // 重なりは中心一致ではなく約2/3。エイリアンを進行方向の手前側に寄せる
                    const overlapOffset = (e.displayWidth || 33) / 3;
                    const enemyTargetX = scene.astronaut.x - Math.sign(e.lastDir || 1) * overlapOffset;
                    scene.astronaut.setDepth(10.5);
                    scene.astronaut.setMask(scene.groundMask);
                    e.setDepth(10);
                    e.setMask(scene.groundMask);

                    const bubbles = [];
                    const totalBubbles = 60;
                    for (let i = 0; i < totalBubbles; i++) {
                        scene.time.delayedCall(i * 33, () => {
                            if (!scene.astronaut.captured) return;
                            const bx = captureX + Phaser.Math.Between(-7, 7);
                            const by = captureY + Phaser.Math.Between(-8, 8);
                            const r = Phaser.Math.FloatBetween(0.5, 2);
                            const b = scene.add.circle(bx, by, r, 0x33dd33, Phaser.Math.FloatBetween(0.5, 0.9));
                            b.setDepth(11);
                            b.setMask(scene.groundMask);
                            bubbles.push(b);
                            scene.tweens.add({
                                targets: b,
                                x: b.x + Phaser.Math.Between(-2, 2),
                                y: b.y + Phaser.Math.Between(-2, 2),
                                scaleX: Phaser.Math.FloatBetween(0.7, 1.3),
                                scaleY: Phaser.Math.FloatBetween(0.7, 1.3),
                                duration: Phaser.Math.Between(250, 450),
                                ease: 'Sine.easeInOut',
                                yoyo: true,
                                repeat: -1
                            });
                        });
                    }

                    // エイリアンを捕獲点に寄せる（2/3重なりの位置へ）
                    scene.tweens.add({
                        targets: e,
                        x: enemyTargetX,
                        duration: 500,
                        ease: 'Sine.easeOut'
                    });

                    // 泡が覆い尽くしたら地中へ
                    scene.time.delayedCall(totalBubbles * 33 + 300, () => {
                        // プレイヤーの影を消して緑のシミに置き換える
                        if (scene.astronaut.shadow) { scene.astronaut.shadow.destroy(); scene.astronaut.shadow = null; }
                        spawnDissolveStain(scene, captureX, scene.groundFeetY);
                        const sinkY = scene.groundFeetY + 50;
                        scene.tweens.add({
                            targets: [...bubbles, e],
                            y: sinkY,
                            duration: 1000,
                            ease: 'Sine.easeIn',
                            onComplete: () => {
                                bubbles.forEach(b => b.destroy());
                                if (e.shadow) e.shadow.destroy();
                                e.destroy();
                                if (isFirstCapture) {
                                    scene.time.delayedCall(2500, () => { scene.scene.restart(); });
                                }
                            }
                        });
                        scene.tweens.add({
                            targets: scene.astronaut,
                            y: sinkY,
                            duration: 1000,
                            delay: 120,
                            ease: 'Sine.easeIn'
                        });
                    });
                };

                // プレイヤーが空中なら自然落下tween → 着地後に捕獲アニメ開始
                if (scene.astronaut.y >= scene.astronautGroundY) {
                    startCaptureAnim();
                } else {
                    scene.astronautVY = 0; // gravity停止後に残ったVYをクリア
                    const dur = Math.min(400, (scene.astronautGroundY - scene.astronaut.y) * 8);
                    scene.tweens.add({ targets: scene.astronaut, y: scene.astronautGroundY, duration: dur, ease: 'Quad.easeIn', onComplete: startCaptureAnim });
                }
            }
        }
    }

    // 仲間：車に近づくと2人が車のドア（高さ30px）からぴょんと降りてくる
    if (scene.moonCar && !scene.crewFound && Math.abs(scene.astronaut.x - scene.moonCar.x) < 80) {
        scene.crewFound = true;
        // 仲間が出てくる前のSE → 終わった後にキューを消化
        if (scene.rescueIntroSound) {
            scene.rescueIntroSound.once('complete', () => scene.tryPlayRescueLand && scene.tryPlayRescueLand());
            scene.rescueIntroSound.play();
        }
        const exitDir = scene.astronaut.x < scene.moonCar.x ? -1 : 1;
        const doorY = scene.groundFeetY - 30;
        const crewCount = 2 + scene.playthroughCount; // 1週目2人、2週目3人、...
        for (let i = 0; i < crewCount; i++) {
            // Sprite で作成（アニメーション再生のため）。元画像は左向き、右降下時は反転
            // 空中のため開脚ポーズ（L2）で出現
            const c = scene.add.sprite(scene.moonCar.x, doorY, 'crew_L2');
            c.setFlipX(exitDir > 0);
            c.setDisplaySize(15, 19);
            c.landed = true; // 出てきた瞬間から捕獲対象
            c.setOrigin(0.5, 1);
            c.setDepth(7);
            // 影は地面に固定（生成時はドア上、降下後は地面）
            c.shadow = createGroundShadow(scene, c.x, scene.groundFeetY, 14);
            scene.crews.push(c);
            scene.time.delayedCall(i * 400, () => {
                // ぴょんと降りる：横に出つつY方向はバウンドで着地
                scene.tweens.add({
                    targets: c,
                    x: scene.moonCar.x + exitDir * (30 + i * 12),
                    duration: 600,
                    ease: 'Sine.easeOut'
                });
                scene.tweens.add({
                    targets: c,
                    y: scene.groundFeetY,
                    duration: 350,
                    ease: 'Quad.easeIn', // 重力で加速して落下（プレイヤーと同じ感じ）
                    onComplete: () => {
                        // 着地：アイドルポーズに（landed=true は追従開始時に一括で立てる。
                        // 着地フレームで捕獲される競合・他仲間のゴースト化を防止）
                        c.setTexture('crew_0');
                        // 着地時のSE（rescue-2/3/4 のランダム1つ）。
                        // 「会話」感を出すため、最初の1人の着地でのみ返事して残りはスキップ。
                        if (!scene.rescueResponded) {
                            scene.rescueResponded = true;
                            scene.rescueLandQueue++;
                            if (scene.tryPlayRescueLand) scene.tryPlayRescueLand();
                        }
                    }
                });
            });
        }
        scene.time.delayedCall(400 + 600 + 200, () => {
            scene.crewFollowing = true;

            // 宇宙船方向の >>> + 「Return to the ship」ラベル表示（1週目のみ）
            if (scene.spaceship && scene.playthroughCount === 0) {
                const isRight = scene.spaceship.x > scene.astronaut.x;
                const arrow = isRight ? '>' : '<';
                const arrows = [arrow, arrow + arrow, arrow + arrow + arrow];
                const offsetX = (isRight ? 1 : -1) * 25;
                const originX = isRight ? 0 : 1;
                const labelY = scene.astronaut.y - 34;
                const arrowY = scene.astronaut.y - 26;
                const ARROW_LOOPS = 1; // STAGES=7 で 7 steps × 440ms = 3080ms（4秒以内）
                const STAGES = 10;
                const STEP_DUR = 160;
                const STEP_HOLD = 80; // STAGES=10 で 10 steps × 400ms = 4000ms（4秒以内）
                const STEP_TOTAL = STEP_DUR * 2 + STEP_HOLD;
                const totalSteps = ARROW_LOOPS * STAGES;
                const totalDuration = STEP_TOTAL * totalSteps;

                // 文字が読めるようにズームイン → ラベル消滅と同期して通常に戻す
                const ZOOM_IN = 4.2;
                const ZOOM_BACK = 2.7;
                const prevZoom = scene.cameras.main.zoom;
                scene.cameras.main.zoomTo(ZOOM_IN, 600, 'Sine.easeInOut');

                const baseAstro = scene.astronaut;
                const labelImg = scene.add.image(
                    baseAstro.x + offsetX, labelY, 'label_returnship'
                ).setOrigin(originX, 0.5).setDepth(12).setAlpha(0).setScale(scene._labelDisplayScale || 0.25);
                // 吹き出し枠：中心から左右に開くアニメ（scaleX 0→1）
                const bubble2 = scene.makeGuideBubble(
                    baseAstro.x + offsetX, labelY, arrowY, labelImg, isRight, 0x88ffaa, 11.5
                ).setScale(0, 1);
                scene.tweens.add({ targets: labelImg, alpha: 1, duration: 250, ease: 'Sine.easeInOut' });
                scene.tweens.add({ targets: bubble2, scaleX: 1, duration: 300, ease: 'Sine.easeInOut' });

                // >, >>, >>> サイクルは残す。ただし位置は固定（プレイヤー移動に追従しない）
                const fixedAnchorX2 = baseAstro.x + offsetX;
                // 矢印は makeLabelSVG の左右 padding (8px in canvas → 表示 2px) 分内側に寄せて、
                // ラベルのテキスト端と矢印端を揃える
                const arrowAnchorX2 = fixedAnchorX2 + (isRight ? 1 : -1) * 8 * (scene._labelDisplayScale || 0.25);
                // 矢印の間隔を枠（=ラベル）幅に合わせて等分
                const arrowScale2 = (scene._labelDisplayScale || 0.25) / 6;
                const arrowImgW2 = (scene.textures.get('arrow_unit').getSourceImage().width) * arrowScale2;
                const arrowVisibleW2 = arrowImgW2 * (40 / 60);
                const arrowSpan2 = (labelImg.displayWidth || 0) - 4; // 内側 2px 寄せ × 2
                const computed2 = STAGES > 1 ? (arrowSpan2 - arrowImgW2) / (STAGES - 1) : 0;
                const arrowSlotSpacing2 = Math.max(arrowVisibleW2, computed2); // 最低でも密着
                let step = 0;
                const showArrow2 = () => {
                    if (step >= totalSteps) return;
                    const count = (step % STAGES) + 1;
                    const group = scene.makeArrowGroup(
                        arrowAnchorX2, arrowY, count, isRight, 12, arrowScale2, arrowSlotSpacing2
                    );
                    scene.tweens.add({
                        targets: group, alpha: 1, duration: STEP_DUR, yoyo: true, hold: STEP_HOLD,
                        onComplete: () => { group.forEach(a => a.destroy()); step++; showArrow2(); }
                    });
                };
                showArrow2();

                scene.time.delayedCall(totalDuration + 100, () => {
                    scene.tweens.add({
                        targets: labelImg, alpha: 0, duration: 300, ease: 'Sine.easeInOut',
                        onComplete: () => labelImg.destroy()
                    });
                    // 枠は中心へ閉じる
                    scene.tweens.add({
                        targets: bubble2, scaleX: 0, duration: 300, ease: 'Sine.easeInOut',
                        onComplete: () => bubble2.destroy()
                    });
                    // ラベル消えるのと同時に元のズームへ戻す
                    scene.cameras.main.zoomTo(ZOOM_BACK, 600, 'Sine.easeInOut');
                });
            }
        });
    }

    // 仲間：P→C1→C2 と鎖状に追従（各自が前走者を追う＝自然な時差）
    // 仲間を連れて宇宙船に戻ったら、2人が先に乗り込み、プレイヤーは最後
    if (!scene.returningToShip && scene.crewFollowing && scene.crews.length > 0
        && scene.spaceship && Math.abs(scene.astronaut.x - scene.spaceship.x) < 20) {
        scene.returningToShip = true;
        scene.crewFollowing = false;
        // 「早く登れ」の指示音（仲間がハシゴを登り始める前）
        if (scene.climbSound) scene.climbSound.play();
        const ladderX = scene.spaceship.x - 3;
        const ladderTop = scene.spaceship.y + 10; // 宇宙船の内部から伸ばす
        const ladderBottom = scene.spaceship.y + 56; // プレイヤー足元の少し上まで
        const crews = scene.crews.slice();
        // 待機列の方向（アストロノート進行方向と反対側）
        const queueDir = scene.astronautFacing === 'right' ? -1 : 1;
        const queueSpacing = 13;
        const queueY = scene.groundFeetY; // ハシゴの根元（地面）まで移動してから登る
        // 仲間を順にハシゴ下まで移動→登って船内へ
        crews.forEach((c, idx) => {
            scene.time.delayedCall(idx * 900, () => {
                if (scene.astronautGameOver) return;
                const face = ladderX < c.x ? 'L' : 'R';
                // 歩行アニメでハシゴへ
                c.setFlipX(face === 'R');
                c.anims.play('crew_walk');
                scene.tweens.add({
                    targets: c,
                    x: ladderX,
                    y: queueY,
                    duration: 400,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        if (scene.astronautGameOver) return;
                        c.anims.stop();
                        c.setFlipX(false);
                        c.setTexture('crew');
                        // 振り向き：正面 → (FL/FR) → (L/R) → (BL/BR)
                        c.anims.play('crew_turn_to_back_' + face);
                        c.once('animationcomplete-crew_turn_to_back_' + face, () => {
                            if (scene.astronautGameOver) return;
                            c.setTexture('crew_B');
                            // 影を登りに合わせてフェードアウト
                            if (c.shadow) {
                                const sh = c.shadow;
                                c.shadow = null;
                                scene.tweens.add({ targets: sh, alpha: 0, duration: 1500, ease: 'Sine.easeInOut', onComplete: () => sh.destroy() });
                            }
                            // ハッチ下端より上の部分（船内に入った部分）を非表示にするマスク
                            const crewHatchBottomY = scene.spaceship.y + 7;
                            const crewMask = scene.make.graphics({ x: 0, y: 0, add: false });
                            crewMask.fillStyle(0xffffff);
                            crewMask.fillRect(-5000, crewHatchBottomY, 10000, 10000);
                            c.setMask(crewMask.createGeometryMask());
                            // 登る目標：足元がハッチ下端 → 全身が船内に消える
                            const crewTopY = crewHatchBottomY - c.displayHeight / 2;
                            steppedClimb(scene, c, crewTopY, 8, 100, 70, () => {
                                if (c.mask) c.clearMask(true);
                                c.setVisible(false);
                            }, 1);
                        });
                    }
                });
                // 後続の仲間は1つ前の待機スロットへシフト
                for (let j = idx + 1; j < crews.length; j++) {
                    const t = crews[j];
                    const slot = j - idx; // 1,2,3...（ハシゴ直後の位置から）
                    const tx = ladderX + queueDir * queueSpacing * slot;
                    const faceJ = tx < t.x ? 'L' : 'R';
                    t.setFlipX(faceJ === 'R');
                    if (!t.anims.isPlaying || t.anims.currentAnim.key !== 'crew_walk') t.anims.play('crew_walk');
                    scene.tweens.add({
                        targets: t,
                        x: tx,
                        y: queueY,
                        duration: 400,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            t.anims.stop();
                            t.setFlipX(false);
                            t.setTexture('crew');
                        }
                    });
                }
            });
        });
        // 2人が乗り込んだ後、プレイヤーがハシゴを登る
        const playerStart = crews.length * 900 + 1400;
        scene.time.delayedCall(playerStart, () => {
            // 捕獲されている場合は登らない（地中から復活してしまうバグ対策）
            if (scene.astronautGameOver) return;
            scene.playerClimbing = true;
            scene.beamGaugeBg.setVisible(false);
            scene.beamGaugeFill.setVisible(false);
                    if (scene.beamGaugeEmpty) scene.beamGaugeEmpty.setVisible(false);
            scene.beamHoldStart = null;
            scene.chargeAllowed = false;
            if (scene.beamTameSound.isPlaying) scene.beamTameSound.stop();
            scene.astronaut.anims.stop();
            scene.astronaut.setFlipX(false);
            // ハシゴまで歩いて移動（横向き歩行アニメ）
            // 移動スピードは最大でも通常移動の 1.2 倍に制限（遠くにいる時に不自然に速くならない）
            const face = ladderX < scene.astronaut.x ? 'L' : 'R';
            scene.astronaut.setFlipX(face === 'R');
            scene.astronaut.anims.play('astronaut_walk');
            const walkDist = Math.abs(scene.astronaut.x - ladderX);
            const maxWalkSpeed = 80 * 1.2; // px/sec
            const walkDuration = Math.max(200, (walkDist / maxWalkSpeed) * 1000);
            scene.tweens.add({
                targets: scene.astronaut,
                x: ladderX,
                duration: walkDuration,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    scene.astronaut.anims.stop();
                    scene.astronaut.setFlipX(false);
                    // 振り向きアニメ：正面→(L or R)→後ろ、降りた時と同じ方向
                    scene.astronaut.setTexture('spaceman');
                    const turnDir = scene.astronautTurnDir || 'L';
                    scene.astronaut.anims.play('astronaut_turn_to_back_' + turnDir);
                    // 振り向き完了後に登り開始
                    scene.astronaut.once('animationcomplete-astronaut_turn_to_back_' + turnDir, () => {
                        scene.astronaut.setTexture('spaceman_B');
                        // 影は Y 座標進捗に応じて update ループで動的にアルファを更新
                        // （地面で標準、ハシゴの上ほど薄く）
                        // ハッチ下端より上の部分（船内に入った部分）は非表示にするマスクを設定
                        // → 登るに従って体が下から徐々に船内に消えていく演出
                        const climbHatchBottomY = scene.spaceship.y + 7;
                        const climbVisMask = scene.make.graphics({ x: 0, y: 0, add: false });
                        climbVisMask.fillStyle(0xffffff);
                        climbVisMask.fillRect(-5000, climbHatchBottomY, 10000, 10000);
                        scene.astronaut.setMask(climbVisMask.createGeometryMask());
                        // ハッチは降下時から開いたまま。万が一閉じている場合のみ作成（下から上へ開く）
                        if (!scene.shipHatch) {
                            const hatchW = 8;
                            const hatchH = 6;
                            const hatchBottomY = scene.spaceship.y + 7;
                            scene.shipHatch = scene.add.rectangle(ladderX, hatchBottomY, hatchW, 0, 0x000000)
                                .setOrigin(0.5, 1)
                                .setDepth(6);
                            scene.tweens.add({
                                targets: scene.shipHatch,
                                height: hatchH,
                                duration: 400,
                                ease: 'Sine.easeInOut'
                            });
                        }
                        // 手動登り：上下キーで操作。ladderTop に到達で onClimbComplete 起動
                        const onClimbComplete = () => {
                            // マスクを解除してから非表示に
                            if (scene.astronaut.mask) scene.astronaut.clearMask(true);
                            scene.astronaut.setVisible(false);
                            // 影は完全消去（登りきって船内に入ったので不要）
                            if (scene.astronaut.shadow) {
                                scene.astronaut.shadow.destroy();
                                scene.astronaut.shadow = null;
                            }
                            // ハッチを閉じる：下から上へ黒い穴が縮んで消える
                            if (scene.shipHatch) {
                                const hatchRef = scene.shipHatch;
                                scene.tweens.add({
                                    targets: hatchRef,
                                    height: 0,
                                    duration: 400,
                                    ease: 'Sine.easeInOut',
                                    onComplete: () => { hatchRef.destroy(); if (scene.shipHatch === hatchRef) scene.shipHatch = null; }
                                });
                            }
                            // 登り終えたら徐々にズームアウト（ポッド上昇中も続く）
                            scene.tweens.add({
                                targets: scene.cameras.main,
                                zoom: 1.8,
                                duration: 5000,
                                ease: 'Sine.easeInOut'
                            });
                            // 発射前2秒：ハッチ開
                            scene.sound.play('hatchopen', { volume: 0.25 });
                            // 2秒後：宇宙船上部からポッド打ち上げ
                            scene.time.delayedCall(2000, () => {
                                // 脱出音：点火とジェットを同時再生
                                scene.sound.play('escape-injection', { volume: 0.8 });
                                scene.escapeJetSound = scene.sound.add('escape-jet', { loop: true, volume: 0.6 });
                                scene.escapeJetSound.play();
                                const podX = scene.spaceship.x;
                                const podY = scene.spaceship.y - 10;
                                const pod = scene.add.image(podX, podY, 'pod');
                                pod.setDisplaySize(24, 24);
                                pod.setDepth(3); // 宇宙船(5)より下のレイヤーから出現

                                // エイリアンたちは地中へ散り散りに退却
                                scene.enemiesRetreating = true;
                                scene.enemies.forEach(e => {
                                    e.setMask(scene.groundMask);
                                    const rx = e.x + Phaser.Math.Between(-140, 140);
                                    scene.tweens.add({
                                        targets: e,
                                        x: rx,
                                        duration: Phaser.Math.Between(1400, 2200),
                                        ease: 'Sine.easeInOut'
                                    });
                                    scene.tweens.add({
                                        targets: e,
                                        y: e.y + e.displayHeight + 20,
                                        delay: Phaser.Math.Between(200, 1000),
                                        duration: Phaser.Math.Between(900, 1400),
                                        ease: 'Sine.easeIn',
                                        onComplete: () => {
                                            if (e.shadow) e.shadow.destroy();
                                            e.destroy();
                                        }
                                    });
                                    // 影をフェードアウト
                                    if (e.shadow) {
                                        scene.tweens.add({ targets: e.shadow, alpha: 0, duration: 800, ease: 'Sine.easeInOut' });
                                    }
                                });
                                scene.enemies = [];

                                // 発射マズル：着陸粉塵と同じ要領で左右へ舞い上がる煙
                                const muzzle = scene.add.particles('dustLarge');
                                muzzle.setDepth(3); // 宇宙船(5)の背後
                                const makeSide = (sx, angleRange) => muzzle.createEmitter({
                                    x: sx,
                                    y: podY + 2,
                                    speed: { min: 40, max: 160 },
                                    angle: angleRange,
                                    scale: { start: 0.25, end: 2.2 },
                                    alpha: { start: 0.7, end: 0 },
                                    tint: [0xffffff, 0xeeeeee, 0xdddddd],
                                    lifespan: { min: 700, max: 1400 },
                                    quantity: 1,
                                    on: false
                                });
                                const leftEm = makeSide(podX - 10, { min: 155, max: 205 });
                                const rightEm = makeSide(podX + 10, { min: -25, max: 25 });
                                leftEm.explode(26);
                                rightEm.explode(26);
                                // 炎のチラッとした赤味（少量）
                                const flame = scene.add.particles('jetParticle');
                                flame.setDepth(3); // 宇宙船(5)の背後
                                const flameL = flame.createEmitter({
                                    x: podX - 8, y: podY + 2,
                                    speed: { min: 80, max: 200 },
                                    angle: { min: 165, max: 195 },
                                    scale: { start: 0.5, end: 0 },
                                    alpha: { start: 0.9, end: 0 },
                                    tint: [0xff4422, 0xff8833, 0xffcc44],
                                    lifespan: { min: 200, max: 400 },
                                    on: false
                                });
                                const flameR = flame.createEmitter({
                                    x: podX + 8, y: podY + 2,
                                    speed: { min: 80, max: 200 },
                                    angle: { min: -15, max: 15 },
                                    scale: { start: 0.5, end: 0 },
                                    alpha: { start: 0.9, end: 0 },
                                    tint: [0xff4422, 0xff8833, 0xffcc44],
                                    lifespan: { min: 200, max: 400 },
                                    on: false
                                });
                                flameL.explode(10);
                                flameR.explode(10);
                                scene.time.delayedCall(1800, () => { muzzle.destroy(); flame.destroy(); });

                                // 下部の噴射ノズル炎（ポッドに追従し、上昇中は常時噴射）
                                const nozzle = scene.add.graphics();
                                nozzle.setDepth(3); // 宇宙船(5)の背後
                                const drawNozzle = () => {
                                    nozzle.clear();
                                    const nx = pod.x;
                                    const ny = pod.y + 12;
                                    const flick = Phaser.Math.FloatBetween(0.8, 1.2);
                                    // 外炎（オレンジ）
                                    nozzle.fillStyle(0xff8822, 0.9);
                                    nozzle.fillTriangle(nx - 5, ny, nx + 5, ny, nx, ny + 14 * flick);
                                    // 内炎（黄）
                                    nozzle.fillStyle(0xffee66, 0.95);
                                    nozzle.fillTriangle(nx - 3, ny, nx + 3, ny, nx, ny + 9 * flick);
                                    // 芯（白）
                                    nozzle.fillStyle(0xffffff, 1);
                                    nozzle.fillTriangle(nx - 1.5, ny, nx + 1.5, ny, nx, ny + 5 * flick);
                                };
                                const nozzleTimer = scene.time.addEvent({
                                    delay: 30,
                                    loop: true,
                                    callback: drawNozzle
                                });

                                // カメラも上昇（ポッドより遅い。消えた後もスーッと余韻で減速）
                                scene.cameraRising = true;
                                scene.tweens.add({
                                    targets: scene.cameras.main,
                                    scrollY: scene.cameras.main.scrollY - 700,
                                    duration: 3000,
                                    ease: 'Cubic.easeIn',
                                    onComplete: () => {
                                        scene.tweens.add({
                                            targets: scene.cameras.main,
                                            scrollY: scene.cameras.main.scrollY - 180,
                                            duration: 1600,
                                            ease: 'Cubic.easeOut',
                                            onComplete: () => {
                                                // カメラ停止後にエンディングメッセージ表示 → Enterでタイトルへ
                                                const camW = scene.cameras.main.width;
                                                const camH = scene.cameras.main.height;
                                                // 文字間に hair space (U+200A) を挟んで字間を空ける
                                                // (Phaser 3.55 の Text は letterSpacing 未対応で context 直設定もリセットされるため)
                                                const spaceText = (str) => str;  // 字間挿入は廃止（Helvetica は標準字間で良いため）
                                                const toBeContinued = scene.add.text(camW / 2, camH / 2, spaceText('Other crew are still out there...'), {
                                                    fontSize: '32px',
                                                    fill: '#FFF',
                                                    fontFamily: "Courier New, Menlo, monospace"
                                                }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
                                                const pressEnter = scene.add.text(camW / 2, camH / 2 + 50, spaceText('Press ENTER to return to title'), {
                                                    fontSize: '18px',
                                                    fill: '#AAA',
                                                    fontFamily: "Courier New, Menlo, monospace"
                                                }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
                                                scene.tweens.add({
                                                    targets: [toBeContinued, pressEnter],
                                                    alpha: 1,
                                                    duration: 1500,
                                                    ease: 'Sine.easeIn',
                                                    onComplete: () => {
                                                        const advance = () => {
                                                            scene.input.keyboard.off('keydown-ENTER', advance);
                                                            scene.input.off('pointerdown', advance);
                                                            document.removeEventListener('touchend', docAdvance, true);
                                                            scene.playthroughCount++;
                                                            scene.scene.restart();
                                                        };
                                                        const docAdvance = (e) => {
                                                            // タッチコントロール上のタップは無視
                                                            if (e.target && e.target.closest && e.target.closest('.touch-btn')) return;
                                                            advance();
                                                        };
                                                        scene.input.keyboard.once('keydown-ENTER', advance);
                                                        scene.input.once('pointerdown', advance);
                                                        document.addEventListener('touchend', docAdvance, { capture: true, passive: true });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });

                                scene.tweens.add({
                                    targets: pod,
                                    y: pod.y - 1050,
                                    duration: 3000,
                                    ease: 'Cubic.easeIn',
                                    onComplete: () => {
                                        pod.destroy();
                                        nozzleTimer.remove();
                                        nozzle.destroy();
                                        if (scene.escapeJetSound) fadeStopSound(scene, scene.escapeJetSound, 0.6, 300);
                                    }
                                });
                            });
                        };
                        scene.playerClimbingManual = true;
                        scene.playerClimbStartY = scene.astronaut.y;
                        // 登りきった位置：宇宙飛行士の足元がハッチ下端 → 体が完全に船内に隠れる
                        const astroDispH = scene.astronaut.displayHeight;
                        scene.playerClimbTopY = climbHatchBottomY - astroDispH / 2;
                        scene.playerClimbCallback = onClimbComplete;
                        // 登りのステップ位置を「ハシゴの段」と一致させる：
                        //   index 0: 地面（開始位置）
                        //   index 1〜8: 8 段の各 rung に足が乗る位置（下から rung 8 → rung 1 へ）
                        //   index 9: ハッチ内（playerClimbTopY）
                        const climbNumRungs = 8;
                        const climbLadderLen = ladderBottom - ladderTop;
                        const climbPositions = [scene.astronaut.y]; // index 0: ground
                        for (let k = climbNumRungs; k >= 1; k--) {
                            const rungFootY = ladderTop + (k / (climbNumRungs + 1)) * climbLadderLen;
                            climbPositions.push(rungFootY - astroDispH / 2);
                        }
                        climbPositions.push(scene.playerClimbTopY); // index 9: in hatch
                        scene.climbStepPositions = climbPositions;
                        scene.climbStepIndex = 0;
                    });
                }
            });
        });
    }

    if (scene.crewFollowing && scene.crews.length) {
        const yOffset = scene.astronaut.displayHeight / 2;
        const backDir = scene.astronautFacing === 'left' ? 1 : (scene.astronautFacing === 'right' ? -1 : -1);

        scene.crews.forEach((c, idx) => {
            // 既に捕まった／破棄済みの仲間はスキップ
            if (!c.active || c.captured) return;
            // 前走者：最初はプレイヤー、以降は一つ前の生きてる仲間
            let leaderX = scene.astronaut.x;
            for (let k = idx - 1; k >= 0; k--) {
                const prev = scene.crews[k];
                if (prev && prev.active && !prev.captured) { leaderX = prev.x; break; }
            }
            const targetX = leaderX + backDir * 13;
            const prevX = c.x;
            c.x = Phaser.Math.Linear(c.x, targetX, 0.06);
            // Y方向：ジャンプは別途 delayedCall で c.vy を設定。ここは重力で落下のみ
            if (c.vy === undefined) c.vy = 0;
            c.vy += 200 * dt;
            c.y += c.vy * dt;
            if (c.y >= scene.groundFeetY) {
                c.y = scene.groundFeetY;
                c.vy = 0;
            }
            const dx = c.x - prevX;
            const moving = Math.abs(dx) > 0.15;
            const airborne = c.y < scene.groundFeetY - 0.5;
            const playingTurn = c.anims.isPlaying && c.anims.currentAnim && c.anims.currentAnim.key.startsWith('crew_turn_');
            if (airborne) {
                // 空中（車降り中など）：開脚ポーズ（L2）で固定
                if (c.anims.isPlaying) c.anims.stop();
                if (c.texture.key !== 'crew_L2') c.setTexture('crew_L2');
            } else if (playingTurn) {
                // 振り向きアニメ再生中は触らない
            } else if (moving) {
                const newFacing = dx > 0 ? 'right' : 'left';
                if (c.facing && c.facing !== newFacing) {
                    // 方向転換：FL/FR を挟む flip アニメを再生
                    c.setFlipX(newFacing === 'right');
                    const flipAnim = newFacing === 'right' ? 'crew_turn_flip_LtoR' : 'crew_turn_flip_RtoL';
                    c.anims.play(flipAnim);
                } else {
                    c.setFlipX(newFacing === 'right'); // 元画像は左向き
                    if (!c.anims.isPlaying || c.anims.currentAnim.key !== 'crew_walk') {
                        c.anims.play('crew_walk');
                    }
                }
                c.facing = newFacing;
            } else {
                if (c.anims.isPlaying && c.anims.currentAnim.key === 'crew_walk') c.anims.stop();
                if (c.texture.key !== 'crew_0') c.setTexture('crew_0');
            }
        });
    }
    // 仲間の影は X方向に追従、可視状態も同期
    if (scene.crews) scene.crews.forEach(c => {
        if (c.shadow) {
            c.shadow.x = c.x;
            c.shadow.setVisible(c.visible);
        }
    });

    // カメラを宇宙飛行士に追従（ポッド打ち上げ中・捕獲後はスキップ）
    const cam = scene.cameras.main;
    if (!scene.cameraRising && !scene.astronautGameOver) {
        const currentX = cam.scrollX + cam.width / 2;
        const currentY = cam.scrollY + cam.height / 2;
        cam.centerOn(
            Phaser.Math.Linear(currentX, scene.astronaut.x, 0.04),
            Phaser.Math.Linear(currentY, scene.astronaut.y, 0.04)
        );
    }

    // デブリは飛び続ける
    const camLeft = cam.worldView.left;
    const camRight = cam.worldView.right;
    scene.debrisGroup.getChildren().forEach((debris) => {
        debris.x += debris.getData('speed') * scene.sys.game.loop.delta / 500;
        const margin = debris.displayWidth;
        if (debris.x > camRight + margin) {
            debris.x = camLeft - margin;
        } else if (debris.x < camLeft - margin) {
            debris.x = camRight + margin;
        }
    });
    scene.debrisGroup.getChildren().forEach((debris) => {
        debris.angle += debris.getData('rotationSpeed');
    });
    return;
}

if (!scene.gameStarted) {
    scene.spaceship.setVelocity(0);
    scene.spaceship.setAcceleration(0);
    scene.spaceship.setGravityY(0);

    // タイトル/降下中もデブリは流れ続ける
    if (scene.debrisGroup) {
        const cam = scene.cameras.main;
        const camLeft = cam.worldView.left;
        const camRight = cam.worldView.right;
        scene.debrisGroup.getChildren().forEach((debris) => {
            debris.x += debris.getData('speed') * scene.sys.game.loop.delta / 500;
            const margin = debris.displayWidth;
            if (debris.x > camRight + margin) {
                debris.x = camLeft - margin;
            } else if (debris.x < camLeft - margin) {
                debris.x = camRight + margin;
            }
            debris.angle += debris.getData('rotationSpeed');
        });
    }
    return;
}

if (scene.gameStarted) {
    // コックピット成功直後（着陸→ハシゴ降下シーンに切り替わる直前）は、
    // 自動ズーム/ラープがフェード後の宇宙船アップを上書きしてしまうため、
    // _cockpitJustExited フラグが立っている間はカメラ操作をスキップする。
    if (!scene._cockpitJustExited) {
        // 宇宙船の速度に基づいてカメラの位置を調整（パララックス効果）
        const maxCameraOffset = 100;
        const offsetX = Phaser.Math.Clamp(-scene.spaceship.body.velocity.x / 50, -maxCameraOffset, maxCameraOffset);
        const offsetY = Phaser.Math.Clamp(-scene.spaceship.body.velocity.y / 50, -maxCameraOffset, maxCameraOffset);

        // カメラの遅延追従（宇宙船が中心からズレ、カメラが遅れてついてくる）
        const targetX = scene.spaceship.x + offsetX;
        const targetY = scene.spaceship.y + offsetY;
        const cam = scene.cameras.main;
        const currentX = cam.scrollX + cam.width / 2;
        const currentY = cam.scrollY + cam.height / 2;
        const lerpSpeed = 0.04;
        cam.centerOn(
            Phaser.Math.Linear(currentX, targetX, lerpSpeed),
            Phaser.Math.Linear(currentY, targetY, lerpSpeed)
        );

        // ズーム効果を設定
        const zoomSpeed = 0.0003 * delta;
        const lowerThirdBoundary = scene.game.config.height * (2 / 3);
        let zoomTarget;

        if (scene.spaceship.y > lowerThirdBoundary) {
            zoomTarget = 2.0;
        } else {
            zoomTarget = 0.8;
        }

        scene.cameras.main.setZoom(Phaser.Math.Linear(scene.cameras.main.zoom, zoomTarget, zoomSpeed));
    }

    // 燃料ゲージを宇宙船の右側に追従させる
    const gaugeX = scene.spaceship.x + 35;
    const gaugeY = scene.spaceship.y - 25;
    const fuelRatio = scene.fuel / 250;
    const fuelHeight = fuelRatio * 48;

    scene.fuelGaugeBorder.setPosition(gaugeX, gaugeY);
    scene.fuelGauge.clear().fillStyle(0xaf3035).fillRect(1, 1 + (48 - fuelHeight), 6, fuelHeight);
    scene.fuelGauge.setPosition(gaugeX, gaugeY);

    
    // ジェット音の再生タイミング（フェードでプチノイズ防止）
    if (scene.cursors.up.isDown || scene.cursors.down.isDown || scene.cursors.left.isDown || scene.cursors.right.isDown) {
        startSoundCancelFade(scene.jetSound, 0.5);
    } else {
        fadeStopSound(scene, scene.jetSound, 0.5);
    }

    // 燃料を消費
    if ((scene.input.keyboard.createCursorKeys().up.isDown ||
        scene.input.keyboard.createCursorKeys().down.isDown ||
        scene.input.keyboard.createCursorKeys().left.isDown ||
        scene.input.keyboard.createCursorKeys().right.isDown) && scene.fuel > 0) {
        // 燃料を消費（無限モードは一旦解除）
        scene.fuel -= 1;
    }

    // 燃料がなくなったら操作を無効にする
    if (scene.fuel <= 0) {
        scene.cursors.up.isDown = false;
        scene.cursors.down.isDown = false;
        scene.cursors.left.isDown = false;
        scene.cursors.right.isDown = false;
    }

    // 燃料が90以下になったら点滅させる
    if (scene.fuel <= 90) {
        const blinkColor = (Math.floor(Date.now() / 400) % 2) === 0 ? 0xaf3035 : 0xffe8f1;
        const blinkFuelHeight = (scene.fuel / 250) * 48;
        scene.fuelGauge.clear().fillStyle(blinkColor).fillRect(1, 1 + (48 - blinkFuelHeight), 6, blinkFuelHeight);

        // 燃料が90以下でサウンドが再生されていない場合、emptysoundを再生
        if (!scene.emptySound.isPlaying) {
            scene.emptySound.play();
        }
    }

    if (scene.cursors.up.isDown) {
        scene.spaceship.setAccelerationY(-500);
    } else if (scene.cursors.down.isDown) {
        scene.spaceship.setAccelerationY(500);
    } else {
        scene.spaceship.setAccelerationY(0);
    }

    if (scene.cursors.left.isDown) {
        scene.spaceship.setAccelerationX(-500);
        scene.spaceship.angle = Math.max(scene.spaceship.angle - 2, -35); // 左へ最大35度傾ける
    } else if (scene.cursors.right.isDown) {
        scene.spaceship.setAccelerationX(500);
        scene.spaceship.angle = Math.min(scene.spaceship.angle + 2, 35); // 右へ最大35度傾ける
    } else {
        scene.spaceship.setAccelerationX(0);
        // 宇宙船の角度を徐々に0度に戻す
        if (scene.spaceship.angle < 0) {
            scene.spaceship.angle = Math.min(scene.spaceship.angle + 2, 0);
        } else if (scene.spaceship.angle > 0) {
            scene.spaceship.angle = Math.max(scene.spaceship.angle - 2, 0);
        }
    }

    // ジェット噴射パーティクルの位置更新とon/off
    const sx = scene.spaceship.x;
    const sy = scene.spaceship.y;
    const hasFuel = scene.fuel > 0;

    scene.jetParticles.up.setPosition(sx, sy + 25);
    // 下降スラスター：左右の足の付け根から斜め上に噴射
    scene.jetParticles.downLeft.setPosition(sx - 15, sy + 5);
    scene.jetParticles.downRight.setPosition(sx + 15, sy + 5);
    scene.jetParticles.left.setPosition(sx + 25, sy);
    scene.jetParticles.right.setPosition(sx - 25, sy);

    scene.jetParticles.up.on = scene.cursors.up.isDown && hasFuel;
    const downFiring = scene.cursors.down.isDown && hasFuel;
    const leftFiring = scene.cursors.left.isDown && hasFuel;
    const rightFiring = scene.cursors.right.isDown && hasFuel;
    // 下降スラスターは通常は左右両方を噴射するが、横移動と組み合わせ時は
    // 動きの方向に逆らう側を消し、見た目上「同じ側のスラスターのみ噴射」にする
    // 右下移動 → 左側 (downLeft) のみ、左下移動 → 右側 (downRight) のみ
    let downLeftOn = downFiring;
    let downRightOn = downFiring;
    if (downFiring && rightFiring && !leftFiring) {
        downRightOn = false;
    } else if (downFiring && leftFiring && !rightFiring) {
        downLeftOn = false;
    }
    scene.jetParticles.downLeft.on = downLeftOn;
    scene.jetParticles.downRight.on = downRightOn;
    scene.jetParticles.left.on = leftFiring;
    scene.jetParticles.right.on = rightFiring;

    // 宇宙船の影：着陸台用と月面用を別々に配置し、マスクで自然に段差を表現
    // 宇宙船の脚がパッドに乗っている部分はパッド上面、はみ出している部分は月面に影が落ちる
    const groundLineY = scene.game.config.height - 63;
    const padSurfaceY = scene.moon.y + scene.moon.displayHeight / 2;
    scene.spaceshipShadow.x = scene.spaceship.x;
    scene.spaceshipShadow.y = padSurfaceY;
    if (scene.spaceshipShadowGround) {
        scene.spaceshipShadowGround.x = scene.spaceship.x;
        scene.spaceshipShadowGround.y = groundLineY;
    }

    // 影が落ちる面からの高さを計算（透明度・サイズ用 — 月面基準）
    const heightAboveGoal = Math.max(scene.spaceship.y - (groundLineY - 260), 0);

    // 透明度を計算（高さに応じて0〜1の範囲）
    const shadowAlpha = heightAboveGoal / 260;
    scene.spaceshipShadow.alpha = shadowAlpha;
    if (scene.spaceshipShadowGround) scene.spaceshipShadowGround.alpha = shadowAlpha;

    // 影のサイズを計算（高さに応じて50〜100の範囲）
    const shadowSize = 110 - (heightAboveGoal / 4.6);
    scene.spaceshipShadow.setScale(shadowSize / 100); // ベース直径 100 を縮尺
    if (scene.spaceshipShadowGround) scene.spaceshipShadowGround.setScale(shadowSize / 100);

    // デバッグ：当たり判定の枠を描画（赤=台座範囲, 黄=着陸ゾーン, 緑=宇宙船 bounds）
    if (scene.debugBounds) {
        scene.debugBounds.clear();
        // 着陸台の水平範囲（fullyOnPad 判定）
        scene.debugBounds.lineStyle(2, 0xff0000, 1);
        scene.debugBounds.strokeRect(scene.moon.x - 50, padSurfaceY - 30, 100, 60);
        // 着陸ゾーン（landingZone — RectangleToRectangle 用、5px の薄い帯。赤枠と同じ幅）
        scene.debugBounds.lineStyle(2, 0xffff00, 1);
        scene.debugBounds.strokeRect(scene.moon.x - 50, padSurfaceY, 100, 5);
        // 宇宙船 bounds（4本足の外側より少し内側に縮めた当たり判定）
        scene.debugBounds.lineStyle(2, 0x00ff00, 1);
        const sb = scene.spaceship.getBounds();
        const SHIP_FOOT_INSET = 7;
        scene.debugBounds.strokeRect(sb.x + SHIP_FOOT_INSET, sb.y, sb.width - SHIP_FOOT_INSET * 2, sb.height);
    }

    // 地面に近い＋ジェット噴射中の時だけ粉塵を左右に舞い上がらせる
    // 着陸台の真上は月面ではないので粉塵は出さない
    const groundDistance = (scene.game.config.height - 63) - (scene.spaceship.y + 25);
    const isThrusting = scene.cursors.up.isDown || scene.cursors.down.isDown || scene.cursors.left.isDown || scene.cursors.right.isDown;
    const overPadForDust = Math.abs(scene.spaceship.x - scene.moon.x) < 50;
    if (groundDistance < 150 && groundDistance > 0 && isThrusting && scene.fuel > 0 && !overPadForDust) {
        const dustY = scene.game.config.height - 65;
        const intensity = 1 - (groundDistance / 150); // 0(遠い)〜1(地面すれすれ)
        const freq = Math.max(5, 30 - intensity * 25);
        const qty = Math.ceil(1 + intensity * 3);
        const spd = 30 + intensity * 80;

        const offsets = [-8, -3, 3, 8];
        scene.dustEmitters.forEach((e, i) => {
            e.setPosition(scene.spaceship.x + offsets[i], dustY);
            e.on = true;
            e.setFrequency(freq);
            e.setQuantity(qty);
            e.setSpeed({ min: spd * 0.5, max: spd });
        });
    } else {
        scene.dustEmitters.forEach(e => e.on = false);
    }
}

// 着陸台の水平範囲（赤デバッグ枠と一致させる）
const PAD_LANDING_HALF_WIDTH = 50;
// パッド上面の Y 座標（着陸の Y 基準）
const padSurfaceY = scene.moon.y + scene.moon.displayHeight / 2;

// 着陸エリアに接触した時にクリア（赤枠＝台座の幅と一致）
const landingZone = new Phaser.Geom.Rectangle(
    scene.moon.x - PAD_LANDING_HALF_WIDTH,
    scene.moon.y + scene.moon.displayHeight / 2,
    PAD_LANDING_HALF_WIDTH * 2,
    5
);

// ターゲットマークの色フェード（ゴール上空に近づくほど緑→黄）
const inGoalX = Math.abs(scene.spaceship.x - scene.moon.x) < PAD_LANDING_HALF_WIDTH;
const distY = scene.moon.y - scene.spaceship.y;

// コックピット視点への切替：パッド上空 200px 以内・水平範囲内・降下中で SPACE キー
// が押された瞬間だけ発火（押さなければ従来通り自力で着陸できる）。
const cockpitConditionsMet =
    scene.gameStarted &&
    !scene.cockpitMode &&
    !scene._cockpitTriggered &&
    !scene.tippingOver &&
    inGoalX &&
    distY > 0 && distY < 200 &&
    scene.spaceship.body && scene.spaceship.body.velocity.y > -10;

// 切替可能ゾーン内なら DOM オーバーレイで画面下中央に控えめなヒントを表示。
// Phaser テキストはカメラ zoom/scroll の影響を受けて位置がずれるため、
// canvas に被せた DOM 要素のほうが確実かつ邪魔にならない位置に出せる。
{
    let hintEl = document.getElementById('cockpit-hint');
    if (!hintEl) {
        hintEl = document.createElement('div');
        hintEl.id = 'cockpit-hint';
        hintEl.textContent = '[SPACE]  COCKPIT VIEW';
        const container = document.getElementById('game-container') || document.body;
        container.appendChild(hintEl);
    }
    if (cockpitConditionsMet) {
        hintEl.classList.add('show');
    } else {
        hintEl.classList.remove('show');
    }
}

if (
    cockpitConditionsMet &&
    scene.cursors && scene.cursors.space &&
    Phaser.Input.Keyboard.JustDown(scene.cursors.space)
) {
    scene._cockpitTriggered = true;
    // ヒントを即座にフェードアウト
    const hintEl = document.getElementById('cockpit-hint');
    if (hintEl) hintEl.classList.remove('show');
    enterCockpitMode(scene);
    return; // 残りの物理判定はスキップ。次フレームから updateCockpit が走る
}

// デバッグ：URL に ?cockpit を付けると起動直後にコックピット視点へ直行
if (
    !scene._cockpitTriggered &&
    !scene.cockpitMode &&
    typeof window !== 'undefined' &&
    window.location && window.location.search.includes('cockpit')
) {
    scene.gameStarted = true;
    scene._cockpitTriggered = true;
    scene.spaceship.x = scene.moon.x;
    scene.spaceship.y = scene.moon.y - 150;
    if (scene.spaceship.body) {
        scene.spaceship.body.allowGravity = false;
        scene.spaceship.setVelocity(0, 30);
    }
    enterCockpitMode(scene);
    return;
}

let markerT = 0; // 0=緑, 1=黄
if (inGoalX && distY < 300 && distY > 0) {
    markerT = 1 - (distY / 300); // 近いほど1に
} else if (inGoalX && distY <= 0) {
    markerT = 1;
}
// 緑(0x00ff00)→黄(0xffff00)を補間
const r = Math.round(0x00 + (0xff - 0x00) * markerT);
const g = 0xff;
const b = Math.round(0x00 + (0x00 - 0x00) * markerT);
const newColor = (r << 16) | (g << 8) | b;
if (newColor !== scene.currentMarkerColor) {
    scene.currentMarkerColor = newColor;
    scene.drawLandingMarker(newColor);
}

const isLevel = Math.abs(scene.spaceship.angle) <= 5; // 水平から±5度以内
const speed = Math.sqrt(
    scene.spaceship.body.velocity.x * scene.spaceship.body.velocity.x +
    scene.spaceship.body.velocity.y * scene.spaceship.body.velocity.y
);
const isSlow = speed < 85; // ゆっくり降下中のみ

// 着陸台の水平範囲。宇宙船の4本足分（getBounds から数px縮めた範囲）がこの範囲に収まっていないと「片足はずれ」で転倒・爆発
const SHIP_FOOT_INSET = 7;
const sbRaw = scene.spaceship.getBounds();
const shipLandingBounds = new Phaser.Geom.Rectangle(
    sbRaw.x + SHIP_FOOT_INSET,
    sbRaw.y,
    sbRaw.width - SHIP_FOOT_INSET * 2,
    sbRaw.height
);
const padLeftX = scene.moon.x - PAD_LANDING_HALF_WIDTH;
const padRightX = scene.moon.x + PAD_LANDING_HALF_WIDTH;
const fullyOnPad = shipLandingBounds.left >= padLeftX && shipLandingBounds.right <= padRightX;

// パッド上面に到達したか（高速降下による landingZone のすり抜け対策：
// 矩形交差ではなく宇宙船下端が padSurfaceY を越えたかで判定）
const shipReachedPadY = shipLandingBounds.bottom >= padSurfaceY;
const overPadHorizontal = shipLandingBounds.right > padLeftX && shipLandingBounds.left < padRightX;
const padTouchdown = shipReachedPadY && overPadHorizontal;

if (padTouchdown && (!isSlow || !isLevel) && !scene.tippingOver && scene.gameStarted) {
    // 勢いよく/傾きすぎで着陸台に衝突：すり抜けずに即爆発
    gameOver(scene, '');
} else if (isLevel && isSlow && padTouchdown && !fullyOnPad && !scene.tippingOver) {
    // 片足が着陸台からはみ出している：バランスを崩して月面に倒れる演出 → 爆発
    scene.tippingOver = true;
    scene.gameStarted = false;
    if (scene.spaceship.body) {
        scene.spaceship.body.allowGravity = false;
        scene.spaceship.setVelocity(0);
        scene.spaceship.setAcceleration(0);
    }

    // 着陸台のどちら側にはみ出しているかで倒れる方向を決める
    const overhangRight = shipLandingBounds.right - padRightX;
    const overhangLeft = padLeftX - shipLandingBounds.left;
    const fallDirection = overhangRight > overhangLeft ? 1 : -1;
    const fallAngle = 92 * fallDirection;
    const groundLineY = scene.game.config.height - 63;

    // ジェット噴射・粉塵を停止
    fadeStopSound(scene, scene.jetSound, 0.3);
    if (scene.emptySound.isPlaying) scene.emptySound.stop();
    scene.jetParticles.up.on = false;
    scene.jetParticles.downLeft.on = false; scene.jetParticles.downRight.on = false;
    scene.jetParticles.left.on = false;
    scene.jetParticles.right.on = false;
    scene.dustEmitters.forEach(e => e.on = false);

    // 倒れる演出（傾く → 月面に倒れる）— 月重力なのでゆっくりめ
    scene.tweens.add({
        targets: scene.spaceship,
        angle: fallAngle,
        x: scene.spaceship.x + 30 * fallDirection,
        y: groundLineY - 10,
        duration: 1200,
        ease: 'Sine.easeIn',
        onComplete: () => {
            scene.tippingOver = false;
            gameOver(scene, '');
        }
    });
} else if (isLevel && isSlow && padTouchdown && fullyOnPad) {
    // コトンと着地：即座に停止し、足元を pad 上面にスナップして接地感を出す
    scene.spaceship.setVelocity(0);
    scene.spaceship.setAcceleration(0);
    scene.spaceship.setGravityY(0);
    scene.spaceship.angle = 0;
    scene.spaceship.y = padSurfaceY - scene.spaceship.displayHeight / 2;

    scene.goalSound.play();

    // ゴール時にjet音を停止（フェード）
    fadeStopSound(scene, scene.jetSound, 0.5);

    // エンプティー音を停止
    if (scene.emptySound.isPlaying) {
        scene.emptySound.stop();
    }

    // ジェット噴射・粉塵パーティクルを停止
    scene.jetParticles.up.on = false;
    scene.jetParticles.downLeft.on = false; scene.jetParticles.downRight.on = false;
    scene.jetParticles.left.on = false;
    scene.jetParticles.right.on = false;
    scene.dustEmitters.forEach(e => e.on = false);

    // 燃料ゲージ・ターゲットマーク・デブリを非表示（マーク・デブリはふんわりフェードアウト）
    scene.fuelGaugeBorder.setVisible(false);
    scene.fuelGauge.setVisible(false);
    scene.tweens.add({
        targets: scene.landingMarker,
        alpha: 0,
        duration: 800,
        ease: 'Sine.easeInOut',
        onComplete: () => scene.landingMarker.setVisible(false)
    });
    scene.debrisGroup.getChildren().forEach(d => {
        scene.tweens.add({
            targets: d,
            alpha: 0,
            duration: 800,
            ease: 'Sine.easeInOut',
            onComplete: () => d.setVisible(false)
        });
    });

    scene.gameStarted = false; // 操作を無効化

    // コックピット視点を経由してきた場合は、フェード明けの瞬間に必ず close-up
    // で出ているよう、後段の 1秒待ち pan/zoomTo（line 1928）を待たずに即スナップ。
    // 宇宙空間から自力で着陸した場合は、後段の pan/zoomTo（2 秒）でゆっくり
    // ズームインしていく従来の演出を残す。
    if (scene._cockpitTriggered) {
        const cam = scene.cameras.main;
        if (cam.panEffect && cam.panEffect.isRunning) cam.panEffect.reset();
        if (cam.zoomEffect && cam.zoomEffect.isRunning) cam.zoomEffect.reset();
        cam.setZoom(4.5);
        cam.centerOn(scene.spaceship.x, scene.spaceship.y + 30);
    }

    // ハシゴが出てきて、宇宙飛行士が降りてくる演出
    scene.time.delayedCall(1000, () => {
        // ハシゴを描画（宇宙船の下から伸びる）
        const ladderX = scene.spaceship.x - 3;
        const ladderTop = scene.spaceship.y + 10; // 宇宙船の内部から伸ばす
        const ladderBottom = scene.spaceship.y + 56; // プレイヤー足元の少し上まで
        const astronautDestY = scene.spaceship.y + 50; // 着地中心位置（地面）は据え置き
        const ladder = scene.add.graphics({ lineStyle: { width: 1, color: 0xcccccc } });
        ladder.setDepth(7);

        // ハッチ（出入り口の黒い四角）を作成。下から上へ広がる開き方
        const hatchW = 8;
        const hatchH = 6;
        const hatchBottomY = scene.spaceship.y + 7; // ハッチ下端
        scene.shipHatch = scene.add.rectangle(ladderX, hatchBottomY, hatchW, 0, 0x000000)
            .setOrigin(0.5, 1) // 下端固定
            .setDepth(6);
        // 開く：下から上へ黒い穴が広がる
        scene.tweens.add({
            targets: scene.shipHatch,
            height: hatchH,
            duration: 400,
            ease: 'Sine.easeInOut'
        });

        // ハシゴが出てくるタイミングで、宇宙船の足元（ハシゴ付近）にカメラをパン＋ズーム
        const targetPanX = scene.spaceship.x;
        const targetPanY = scene.spaceship.y + 30; // ハシゴ中央あたり
        scene.cameras.main.pan(targetPanX, targetPanY, 2000, 'Sine.easeInOut');
        scene.cameras.main.zoomTo(4.5, 2000, 'Sine.easeInOut');

        // ハシゴがスッと伸びるアニメーション（ハッチが完全に開いてから開始）
        let ladderProgress = 0;
        const ladderTween = scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 800,
            delay: 400, // ハッチオープン (400ms) 完了後にハシゴ伸展を開始
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                ladderProgress = tween.getValue();
                const currentBottom = ladderTop + (ladderBottom - ladderTop) * ladderProgress;
                ladder.clear();
                ladder.lineStyle(1, 0xcccccc);
                // 2本の縦線
                ladder.lineBetween(ladderX - 3, ladderTop, ladderX - 3, currentBottom);
                ladder.lineBetween(ladderX + 3, ladderTop, ladderX + 3, currentBottom);
                // 横棒：始端と終端は閉じない（H形）。コマ数 +2
                const steps = 9;
                for (let s = 1; s < steps; s++) {
                    const stepY = ladderTop + (currentBottom - ladderTop) * (s / steps);
                    if (stepY <= currentBottom) {
                        ladder.lineBetween(ladderX - 3, stepY, ladderX + 3, stepY);
                    }
                }
            },
            onComplete: () => {
                // ハシゴが伸びきったら宇宙飛行士が降りてくる（後ろ向き、足から）
                // ハッチ下端から足が出てきて、降下するに従って体が現れる
                const hatchTopY = scene.spaceship.y + 1;
                const hatchBottomY = hatchTopY + 6;
                const astroH = 19;
                // 初期位置：足元がハッチ下端に揃うよう上にオフセット（頭は船内 = ハッチで隠れる）
                const initialY = hatchBottomY - astroH / 2;
                const astronaut = scene.add.sprite(ladderX, initialY, 'spaceman_B');
                // 元画像は 725x904（縦長、アスペクト比 ~0.8）。アスペクト維持
                astronaut.setDisplaySize(15, astroH);
                astronaut.setDepth(8);

                // ハッチ下端より上の部分（船内に居る部分）を非表示にするマスクを設定
                // → 降下するに従って足から体が見えてくる「足から出てくる」演出
                const visMask = scene.make.graphics({ x: 0, y: 0, add: false });
                visMask.fillStyle(0xffffff);
                visMask.fillRect(-5000, hatchBottomY, 10000, 10000);
                astronaut.setMask(visMask.createGeometryMask());

                // 影を先に作成。降下のY座標進捗に応じて update ループで動的にアルファを更新
                // （ハシゴの上では薄く、地面に近づくにつれて濃くなる）
                const destFootY = astronautDestY + astroH / 2;
                astronaut.shadow = createGroundShadow(scene, astronaut.x, destFootY, 14);
                astronaut.shadow.alpha = 0;

                // 手動降下：下キーで降りる、上キーで戻る。astronautDestY 到達で onDescendComplete 起動
                const onDescendComplete = () => {
                        // 完全に降りきったので「足から出てくる」マスクを解除
                        if (astronaut.mask) astronaut.clearMask(true);
                        // ハッチは開けっぱなし（クルーが救出後に入るため、脱出シーケンス完了まで開いたまま）
                        // 故障車の方向を先に決める。振り向きは車と逆方向（自然な視線の動き）
                        const carDirEarly = Phaser.Math.Between(0, 1) ? 1 : -1;
                        scene.astronautCarDir = carDirEarly;
                        scene.astronautTurnDir = carDirEarly > 0 ? 'L' : 'R';
                        // 降りきったら振り向いて正面を向く（方向に応じてR/L版）
                        astronaut.setFlipX(false);
                        astronaut.anims.play('astronaut_turn_to_front_' + scene.astronautTurnDir);
                        // 正面状態を記録（次の左右移動時に front→FL/FR→L/R アニメを再生）
                        scene.astronautFacing = 'front';
                        // そのまま操作可能にする（物理不要、手動制御）
                        scene.astronaut = astronaut;
                        scene.astronautGroundY = astronaut.y; // 地面のY座標を記憶
                        // 影は降下開始時に既に作成済み（フェードイン中）
                        // 移動範囲を背景画像内にクランプ（ズーム2.75での可視域を背景内に収める）
                        const bgTex = scene.textures.get('background').getSourceImage();
                        const bgCenterX = scene.scale.width / 2;
                        const camHalfW = scene.scale.width / 2.75 / 2;
                        scene.astronautMinX = (bgCenterX - bgTex.width / 2) + camHalfW;
                        scene.astronautMaxX = (bgCenterX + bgTex.width / 2) - camHalfW;
                        // 仮：移動限界の外側に2001モノリス（立体感あり）
                        const monoY = scene.astronautGroundY + scene.astronaut.displayHeight / 2;
                        const monoW = 20;
                        const monoH = 140;
                        const depthX = 6;
                        const depthY = -4;
                        const gap = monoW / 2 + scene.astronaut.displayWidth / 2;
                        [
                            { x: scene.astronautMinX - gap, innerDir: 1 },
                            { x: scene.astronautMaxX + gap, innerDir: -1 }
                        ].forEach(p => {
                            const g = scene.add.graphics();
                            g.setDepth(7);
                            const topY = monoY - monoH;
                            const innerX = p.x + p.innerDir * monoW / 2;
                            // 側面（プレイヤー側に見える面・わずかに明るく）
                            g.fillStyle(0x2a2a2a);
                            g.beginPath();
                            g.moveTo(innerX, topY);
                            g.lineTo(innerX + p.innerDir * depthX, topY + depthY);
                            g.lineTo(innerX + p.innerDir * depthX, monoY + depthY);
                            g.lineTo(innerX, monoY);
                            g.closePath();
                            g.fillPath();
                            // 上面（蓋）：光が当たるので側面より明るめ
                            g.fillStyle(0x3a3a3a);
                            g.beginPath();
                            g.moveTo(p.x - monoW / 2, topY);
                            g.lineTo(p.x + monoW / 2, topY);
                            g.lineTo(p.x + monoW / 2 + p.innerDir * depthX, topY + depthY);
                            g.lineTo(p.x - monoW / 2 + p.innerDir * depthX, topY + depthY);
                            g.closePath();
                            g.fillPath();
                            // 前面
                            g.fillStyle(0x000000);
                            g.fillRect(p.x - monoW / 2, topY, monoW, monoH);
                            // アウトライン
                            g.lineStyle(1, 0x111111);
                            g.strokeRect(p.x - monoW / 2, topY, monoW, monoH);
                        });
                        scene.astronautVY = 0; // 縦方向の速度
                        scene.astronautFacing = null; // 向き（左右移動後に確定、未確定時は発射不可）
                        scene.lasers = []; // 発射中のレーザー
                        scene.beamEnergy = 100; // ビーム残量（0-100）
                        scene.enemies = []; // 地底人
                        scene.enemyKills = 0;
                        scene.bossesDue = 0;
                        scene.astronautGameOver = false;

                        // ビーム残量ゲージ（宇宙飛行士上部に追従、小さめ＆コントラスト色）
                        scene.beamGaugeBg = scene.add.rectangle(0, 0, 10, 1, 0x000000).setDepth(11);
                        scene.beamGaugeFill = scene.add.rectangle(0, 0, 10, 1, 0x00ffcc).setDepth(12);

                        // 大破した月面探査車（振り向き方向の逆側に配置）
                        const carDir = scene.astronautCarDir;
                        const carX = astronaut.x + carDir * Phaser.Math.Between(800, 1200);
                        const carFeetY = astronaut.y + astronaut.displayHeight / 2;
                        scene.moonCar = scene.add.image(carX, carFeetY, 'mooncar');
                        scene.moonCar.setOrigin(0.5, 1);
                        scene.moonCar.setDisplaySize(120, 60);
                        scene.moonCar.setDepth(6);

                        // 仲間の状態管理（2人救出）
                        scene.crewFound = false;
                        scene.crewFollowing = false;
                        scene.crews = []; // 仲間スプライト配列

                        // 地面マスク（地面より上だけ表示。出現・引きずり込みに使用）
                        scene.groundFeetY = scene.astronautGroundY + scene.astronaut.displayHeight / 2;
                        const maskGfx = scene.make.graphics();
                        maskGfx.fillStyle(0xffffff);
                        maskGfx.fillRect(-2000, -2000, 6000, scene.groundFeetY + 2000);
                        scene.groundMask = maskGfx.createGeometryMask();

                        // 地底人スポーン（地面から頭→体→足の順で這い出す）
                        scene.spawnEnemy = () => {
                            if (scene.astronautGameOver || !scene.astronautMode || scene.enemiesRetreating) return;
                            const side = Phaser.Math.Between(0, 1) ? -1 : 1;
                            const distance = Phaser.Math.Between(160, 360);
                            const spawnX = scene.astronaut.x + side * distance;
                            const isBoss = scene.bossesDue > 0;
                            if (isBoss) scene.bossesDue--;
                            const dirFace = spawnX < scene.astronaut.x ? 'R' : 'L';
                            const enemyH = isBoss ? 56 : 24;
                            // 雑魚もボスも sprite で生成（出現中は正面固定）
                            const enemy = scene.add.sprite(spawnX, scene.groundFeetY + enemyH, isBoss ? 'alienB_F' : 'alien_F');
                            enemy.setOrigin(0.5, 1);
                            if (isBoss) {
                                // 元画像比率 1100:770 を維持（h=56 → w=80）
                                enemy.setDisplaySize(80, 56);
                                enemy.hp = 10;
                            } else {
                                // 元画像比率 1000:600 (10:6) を維持（h=24 → w=40）
                                enemy.setDisplaySize(40, 24);
                                enemy.hp = 3;
                            }
                            enemy.lastDir = dirFace === 'R' ? 1 : -1;
                            // 出現中は正面固定。emerging 完了後に walk を開始（下の tween onComplete）
                            enemy.isBoss = isBoss;
                            // 速度は spawn 時に固定。雑魚は 48〜55 のランダム、ボスは 28〜35 のランダム
                            enemy.speed = isBoss
                                ? Phaser.Math.Between(28, 35)
                                : Phaser.Math.Between(48, 55);
                            enemy.setDepth(8);
                            enemy.setMask(scene.groundMask);
                            enemy.emerging = true;
                            // 影：地中から出てくる瞬間から地面に表示（フェードインで予兆を演出）
                            enemy.shadow = createGroundShadow(scene, enemy.x, scene.groundFeetY, isBoss ? 60 : 24, isBoss ? 2 : 0);
                            enemy.shadow.alpha = 0;
                            scene.tweens.add({ targets: enemy.shadow, alpha: 1, duration: 900, ease: 'Sine.easeOut' });

                            // 出現時：地面が割れて飛び出すイメージで2種類のパーティクルを同時発射
                            const groundY = scene.groundFeetY;
                            // 砂埃の最大到達高さ＝エイリアン身長の半分くらい
                            const dustGravity = 500;
                            const dustMaxV = Math.sqrt(2 * dustGravity * (enemyH / 2)); // 物理計算で初速を決める

                            // (1) 砂埃の煙（白ベース＋グレーtintで正確な月面色、地面で消滅）
                            const dustBurst = scene.add.particles('dustWhite');
                            dustBurst.setDepth(7);
                            const dustEm = dustBurst.createEmitter({
                                x: spawnX,
                                y: groundY - 1, // 地面直前から
                                speed: { min: dustMaxV * 0.5, max: dustMaxV },
                                angle: { min: 240, max: 300 },
                                scale: { start: 0.25, end: 1.0 },
                                alpha: { start: 0.7, end: 0 },
                                tint: [0xaaaaaa, 0x999999, 0x888888, 0xbbbbbb],
                                lifespan: { min: 500, max: 900 },
                                gravityY: dustGravity,
                                quantity: 1,
                                on: false,
                                // 地面ラインに戻ったら消滅
                                deathZone: {
                                    type: 'onEnter',
                                    source: new Phaser.Geom.Rectangle(spawnX - 400, groundY, 800, 800)
                                }
                            });
                            const dustCount = isBoss ? 26 : 16;
                            dustEm.explode(dustCount, spawnX, groundY);
                            scene.time.delayedCall(1200, () => dustBurst.destroy());

                            // (2) 小石・砂粒（暗めグレーで、出てきた地面位置で消滅）
                            const stoneBurst = scene.add.particles('chargeParticle');
                            stoneBurst.setDepth(8);
                            const stoneEm = stoneBurst.createEmitter({
                                x: spawnX,
                                y: groundY - 1, // 地面直前から発生（即時消滅を回避）
                                speed: { min: 25, max: 70 },
                                angle: { min: 250, max: 290 },
                                scale: { min: 1, max: 2.5 },
                                alpha: { start: 1, end: 1 },
                                tint: [0x666666, 0x888888, 0x555555, 0x777777],
                                lifespan: { min: 350, max: 700 },
                                gravityY: 320,
                                quantity: 1,
                                on: false,
                                // 地面ラインに戻ったら即消滅
                                deathZone: {
                                    type: 'onEnter',
                                    source: new Phaser.Geom.Rectangle(spawnX - 400, groundY, 800, 800)
                                }
                            });
                            const stoneCount = isBoss ? 28 : 18;
                            stoneEm.explode(stoneCount, spawnX, groundY);
                            scene.time.delayedCall(1500, () => stoneBurst.destroy());
                            scene.tweens.add({
                                targets: enemy,
                                y: scene.groundFeetY,
                                duration: 900,
                                ease: 'Sine.easeOut',
                                onComplete: () => {
                                    // 出現中にビームで撃破されている可能性あり
                                    if (!enemy.active) return;
                                    enemy.emerging = false;
                                    enemy.clearMask();
                                    // 出現完了 → F→FR/FL で振り向き → walk ループへ
                                    enemy.setFlipX(false); // F/FL/FR は絶対向き
                                    enemy.emergeTransitioning = true;
                                    const animPrefix = enemy.isBoss ? 'bossAlien_' : 'alien_';
                                    const emergeKey = animPrefix + (enemy.lastDir > 0 ? 'emerge_R' : 'emerge_L');
                                    enemy.anims.play(emergeKey);
                                    enemy.once('animationcomplete', () => {
                                        if (!enemy.active) return;
                                        enemy.emergeTransitioning = false;
                                        enemy.setFlipX(enemy.lastDir > 0); // walk フレームは左向き基準
                                        enemy.anims.play(animPrefix + 'walk');
                                    });
                                }
                            });
                            scene.enemies.push(enemy);
                            scene.time.delayedCall(Phaser.Math.Between(700, 1800), scene.spawnEnemy);
                        };
                        scene.time.delayedCall(1500, scene.spawnEnemy);

                        scene.astronautMode = true; // 宇宙飛行士操作モード
                        scene.astronautHasMoved = false; // 初回移動で通常ズームへ切り替え
                        // ズームはハシゴが伸び始める時から既に進行中

                        // 大破車の方向を >>> で表示＋上に英語ラベル（1週目のみ）
                        // 宇宙船のトップに合わせて配置し、車のある側へ左右に出す
                        if (scene.moonCar && scene.playthroughCount === 0) {
                            const isRight = scene.moonCar.x > scene.spaceship.x;
                            const arrow = isRight ? '>' : '<';
                            const arrows = [arrow, arrow + arrow, arrow + arrow + arrow];
                            const shipHalfW = scene.spaceship.displayWidth / 2;
                            const offsetX = (isRight ? 1 : -1) * (shipHalfW + 6);
                            const originX = isRight ? 0 : 1; // 右向き=左揃え、左向き=右揃え
                            // メッセージ枠の上端を宇宙船の上端に揃える（bubble.top = labelY - labelH/2 - padY を相殺）
                            const labelY = scene.spaceship.y - scene.spaceship.displayHeight / 2 + 18;
                            const arrowY = labelY + 8;
                            const ARROW_LOOPS = 1; // STAGES=7 で 7 steps × 440ms = 3080ms（4秒以内）
                            const STAGES = 10;
                            const STEP_DUR = 160; // フェードイン
                            const STEP_HOLD = 80; // STAGES=10 で 10 steps × 400ms = 4000ms（4秒以内）
                            const STEP_TOTAL = STEP_DUR * 2 + STEP_HOLD; // 1ステップの総時間 (in+hold+out)
                            const totalSteps = ARROW_LOOPS * STAGES;
                            const totalDuration = STEP_TOTAL * totalSteps;

                            // ラベル＆矢印は同じアンカー位置で固定（宇宙船基準）
                            const fixedAnchorX = scene.spaceship.x + offsetX;
                            // 0.5秒だけ遅らせて出す（操作開始の直後すぎないように）
                            scene.time.delayedCall(500, () => {
                                const label = scene.add.image(
                                    fixedAnchorX, labelY, 'label_rescue'
                                ).setOrigin(originX, 0.5).setDepth(12).setAlpha(0).setScale(scene._labelDisplayScale || 0.25);
                                const bubble = scene.makeGuideBubble(
                                    fixedAnchorX, labelY, arrowY, label, isRight, 0x88ffaa, 11.5
                                ).setScale(0, 1);
                                scene.tweens.add({ targets: label, alpha: 1, duration: 250, ease: 'Sine.easeInOut' });
                                scene.tweens.add({ targets: bubble, scaleX: 1, duration: 300, ease: 'Sine.easeInOut' });
                                scene.time.delayedCall(totalDuration + 100, () => {
                                    scene.tweens.add({
                                        targets: label, alpha: 0, duration: 300, ease: 'Sine.easeInOut',
                                        onComplete: () => label.destroy()
                                    });
                                    scene.tweens.add({
                                        targets: bubble, scaleX: 0, duration: 300, ease: 'Sine.easeInOut',
                                        onComplete: () => bubble.destroy()
                                    });
                                });
                            });

                            // 矢印：>, >>, >>> サイクルは残し、位置は固定（プレイヤー移動に追従しない）
                            // ラベルの内側 padding 分（表示 2px）を矢印を内側に寄せて端を揃える
                            const arrowAnchorX = fixedAnchorX + (isRight ? 1 : -1) * 8 * (scene._labelDisplayScale || 0.25);
                            // 矢印の間隔を枠（=ラベル）幅に合わせて等分。label sprite は delayedCall 内で生成
                            // されるためテクスチャから直接サイズを取得
                            const arrowScale = (scene._labelDisplayScale || 0.25) / 6;
                            const arrowImgW = (scene.textures.get('arrow_unit').getSourceImage().width) * arrowScale;
                            const arrowVisibleW = arrowImgW * (40 / 60);
                            const labelTexW = scene.textures.get('label_rescue').getSourceImage().width;
                            const labelDisplayW = labelTexW * (scene._labelDisplayScale || 0.25);
                            const arrowSpan = labelDisplayW - 4;
                            const computed = STAGES > 1 ? (arrowSpan - arrowImgW) / (STAGES - 1) : 0;
                            const arrowSlotSpacing = Math.max(arrowVisibleW, computed);
                            let step = 0;
                            const showArrow = () => {
                                if (step >= totalSteps) return;
                                const count = (step % STAGES) + 1;
                                const group = scene.makeArrowGroup(
                                    arrowAnchorX, arrowY, count, isRight, 12, arrowScale, arrowSlotSpacing
                                );
                                scene.tweens.add({
                                    targets: group,
                                    alpha: 1,
                                    duration: STEP_DUR,
                                    yoyo: true,
                                    hold: STEP_HOLD,
                                    onComplete: () => {
                                        group.forEach(a => a.destroy());
                                        step++;
                                        showArrow();
                                    }
                                });
                            };
                            scene.time.delayedCall(500, showArrow);
                        }
                };
                // 降下のステップ位置を「ハシゴの段」と一致させる：
                //   index 0: 初期スポーン位置（ハッチ内）
                //   index 1〜8: 8 段の各 rung に足が乗る位置
                //   index 9: 月面（ladderBottom より少し下、astronautDestY）
                const numRungs = 8;
                const ladderLen = ladderBottom - ladderTop;
                const stepPositions = [astronaut.y]; // index 0: spawn
                for (let k = 1; k <= numRungs; k++) {
                    const rungFootY = ladderTop + (k / (numRungs + 1)) * ladderLen;
                    stepPositions.push(rungFootY - astroH / 2);
                }
                stepPositions.push(astronautDestY); // index 9: 地面
                scene.descendStepPositions = stepPositions;
                scene.descendStepIndex = 0;
                scene.descendStartY = astronaut.y;
                scene.descendDestY = astronautDestY;
                scene.descendCallback = onDescendComplete;
                // 1段目は自動：index 0 → 1（最初の rung へ）
                scene.descendStepInProgress = true;
                scene.descendStepIndex = 1;
                scene.tweens.add({
                    targets: astronaut,
                    y: stepPositions[1],
                    duration: 100,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        scene.time.delayedCall(70, () => {
                            scene.descendStepInProgress = false;
                            scene.astronautDescending = astronaut;
                            scene.playerDescendingManual = true;
                        });
                    }
                });
            }
        });
    });
} else {
    scene.goalTimer = 0; // 触れていない場合、タイマーをリセットする
}

// 宇宙船が月面に達した：着陸台の上ではないのでバランスを崩して爆発
if (scene.gameStarted && scene.spaceship.y + scene.spaceship.displayHeight / 2 >= scene.game.config.height - 63) {
    gameOver(scene, '');
}

// デブリの移動
const cam = scene.cameras.main;
const camLeft = cam.worldView.left;
const camRight = cam.worldView.right;
scene.debrisGroup.getChildren().forEach((debris) => {
    debris.x += debris.getData('speed') * scene.sys.game.loop.delta / 500;

    // カメラの表示範囲の端から端へ折り返す
    const margin = debris.displayWidth;
    if (debris.x > camRight + margin) {
        debris.x = camLeft - margin;
    } else if (debris.x < camLeft - margin) {
        debris.x = camRight + margin;
    }
});

// デブリの回転
scene.debrisGroup.getChildren().forEach((debris) => {
    debris.angle += debris.getData('rotationSpeed');
});

// 宇宙船とデブリとの衝突をチェック（ローカル開発時は無効化＝無敵）
if (!isInvincible()) {
    scene.physics.overlap(scene.spaceship, scene.debrisGroup, () => {
        gameOver(scene, '');
    });
}

}
