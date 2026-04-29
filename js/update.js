// Phaser scene の update フック本体。
import { fadeStopSound, startSoundCancelFade } from './audio.js';
import { steppedClimb, spawnDissolveStain, createGroundShadow } from './shadows.js';
import { gameOver } from './gameover.js';

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

    // 左右移動（捕獲後は操作不可）
    const isMoving = !scene.astronautGameOver && !scene.playerClimbing && (scene.cursors.left.isDown || scene.cursors.right.isDown);
    const prevFacing = scene.astronautFacing;
    if (!scene.astronautGameOver && !scene.playerClimbing && scene.cursors.left.isDown) {
        scene.astronaut.x -= moveSpeed * dt;
        scene.astronaut.setFlipX(false); // 元画像は左向き
        scene.astronautFacing = 'left';
        // 切替時のアニメ
        if (prevFacing === 'right' && onGround) {
            scene.astronaut.anims.play('astronaut_turn_flip_RtoL');
        } else if (prevFacing === 'front' && onGround) {
            scene.astronaut.anims.play('astronaut_turn_front_to_L');
        }
    } else if (!scene.astronautGameOver && !scene.playerClimbing && scene.cursors.right.isDown) {
        scene.astronaut.x += moveSpeed * dt;
        scene.astronaut.setFlipX(true); // 右向きは左右反転
        scene.astronautFacing = 'right';
        // 切替時のアニメ
        if (prevFacing === 'left' && onGround) {
            scene.astronaut.anims.play('astronaut_turn_flip_LtoR');
        } else if (prevFacing === 'front' && onGround) {
            scene.astronaut.anims.play('astronaut_turn_front_to_R');
        }
    }

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
            scene.lasers.push({ beam, glow, dir, speed: 620, born: scene.time.now, life: 1200, power });
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
    if (Phaser.Input.Keyboard.JustDown(scene.cursors.up) && onGround && !scene.astronautGameOver) {
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

    // 重力＋位置更新（帰還時・捕獲後はtween任せで物理停止）
    if (!scene.returningToShip && !scene.astronautGameOver) {
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
            if (!e.capturing && !scene.astronaut.captured && scene.astronaut.visible && Phaser.Geom.Intersects.RectangleToRectangle(astroBox, enemyBox)) {
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
                scene.tweens.add({ targets: labelImg, alpha: 1, duration: 250, ease: 'Sine.easeOut' });
                scene.tweens.add({ targets: bubble2, scaleX: 1, duration: 300, ease: 'Sine.easeOut' });

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
                        targets: labelImg, alpha: 0, duration: 300, ease: 'Sine.easeIn',
                        onComplete: () => labelImg.destroy()
                    });
                    // 枠は中心へ閉じる
                    scene.tweens.add({
                        targets: bubble2, scaleX: 0, duration: 300, ease: 'Sine.easeIn',
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
        const ladderX = scene.spaceship.x - 5;
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
                            steppedClimb(scene, c, ladderTop, 8, 100, 70, () => c.setVisible(false), 1);
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
            scene.beamHoldStart = null;
            scene.chargeAllowed = false;
            if (scene.beamTameSound.isPlaying) scene.beamTameSound.stop();
            scene.astronaut.anims.stop();
            scene.astronaut.setFlipX(false);
            // ハシゴまで歩いて移動（横向き歩行アニメ）
            const face = ladderX < scene.astronaut.x ? 'L' : 'R';
            scene.astronaut.setFlipX(face === 'R');
            scene.astronaut.anims.play('astronaut_walk');
            scene.tweens.add({
                targets: scene.astronaut,
                x: ladderX,
                duration: 400,
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
                        // 影を登りに合わせてフェードアウト（上に行くほど薄く）
                        if (scene.astronaut.shadow) {
                            const sh = scene.astronaut.shadow;
                            scene.astronaut.shadow = null;
                            scene.tweens.add({ targets: sh, alpha: 0, duration: 1500, ease: 'Sine.easeInOut', onComplete: () => sh.destroy() });
                        }
                        steppedClimb(scene, scene.astronaut, ladderTop, 8, 100, 70, () => {
                            scene.astronaut.setVisible(false);
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
                                                        scene.input.keyboard.once('keydown-ENTER', () => {
                                                            scene.playthroughCount++;
                                                            scene.scene.restart();
                                                        });
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
                    }, 1);
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
        zoomTarget = 1.8;
    } else {
        zoomTarget = 0.8;
    }

    scene.cameras.main.setZoom(Phaser.Math.Linear(scene.cameras.main.zoom, zoomTarget, zoomSpeed));

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
    scene.jetParticles.down.setPosition(sx, sy - 25);
    scene.jetParticles.left.setPosition(sx + 25, sy);
    scene.jetParticles.right.setPosition(sx - 25, sy);

    scene.jetParticles.up.on = scene.cursors.up.isDown && hasFuel;
    scene.jetParticles.down.on = scene.cursors.down.isDown && hasFuel;
    scene.jetParticles.left.on = scene.cursors.left.isDown && hasFuel;
    scene.jetParticles.right.on = scene.cursors.right.isDown && hasFuel;

    // 宇宙船の影の位置を更新（宇宙船の真下、地面の高さ）
    scene.spaceshipShadow.x = scene.spaceship.x;
    scene.spaceshipShadow.y = scene.moon.y + 35; // 地面ライン

    // ゴールエリアからの高さを計算
    const heightAboveGoal = Math.max(scene.spaceship.y - (scene.moon.y - 260), 0);

    // 透明度を計算（高さに応じて0〜1の範囲）
    const shadowAlpha = heightAboveGoal / 260;
    scene.spaceshipShadow.alpha = shadowAlpha;

    // 影のサイズを計算（高さに応じて50〜100の範囲）
    const shadowSize = 110 - (heightAboveGoal / 4.6);
    scene.spaceshipShadow.setScale(shadowSize / 100); // ベース直径 100 を縮尺

    // 地面に近い＋ジェット噴射中の時だけ粉塵を左右に舞い上がらせる
    const groundDistance = (scene.game.config.height - 63) - (scene.spaceship.y + 25);
    const isThrusting = scene.cursors.up.isDown || scene.cursors.down.isDown || scene.cursors.left.isDown || scene.cursors.right.isDown;
    if (groundDistance < 150 && groundDistance > 0 && isThrusting && scene.fuel > 0) {
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

// 着陸エリアに接触した時にクリア
const landingZone = new Phaser.Geom.Rectangle(
    scene.moon.x - scene.moon.displayWidth / 2,
    scene.moon.y + scene.moon.displayHeight / 2 - 5 + 5,
    scene.moon.displayWidth,
    5
);

// ターゲットマークの色フェード（ゴール上空に近づくほど緑→オレンジ）
const inGoalX = Math.abs(scene.spaceship.x - scene.moon.x) < scene.moon.displayWidth / 2;
const distY = scene.moon.y - scene.spaceship.y;
let markerT = 0; // 0=緑, 1=オレンジ
if (inGoalX && distY < 300 && distY > 0) {
    markerT = 1 - (distY / 300); // 近いほど1に
} else if (inGoalX && distY <= 0) {
    markerT = 1;
}
// 緑(0x00ff00)→オレンジ(0xff8800)を補間
const r = Math.round(0x00 + (0xff - 0x00) * markerT);
const g = Math.round(0xff + (0x88 - 0xff) * markerT);
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

if (isLevel && isSlow && Phaser.Geom.Intersects.RectangleToRectangle(scene.spaceship.getBounds(), landingZone)) {
    // コトンと着地：即座に停止して接地感を出す
    scene.spaceship.setVelocity(0);
    scene.spaceship.setAcceleration(0);
    scene.spaceship.setGravityY(0);
    scene.spaceship.angle = 0;

    scene.goalSound.play();

    // ゴール時にjet音を停止（フェード）
    fadeStopSound(scene, scene.jetSound, 0.5);

    // エンプティー音を停止
    if (scene.emptySound.isPlaying) {
        scene.emptySound.stop();
    }

    // ジェット噴射・粉塵パーティクルを停止
    scene.jetParticles.up.on = false;
    scene.jetParticles.down.on = false;
    scene.jetParticles.left.on = false;
    scene.jetParticles.right.on = false;
    scene.dustEmitters.forEach(e => e.on = false);

    // 燃料ゲージ・ターゲットマーク・デブリを非表示
    scene.fuelGaugeBorder.setVisible(false);
    scene.fuelGauge.setVisible(false);
    scene.landingMarker.setVisible(false);
    scene.debrisGroup.getChildren().forEach(d => d.setVisible(false));

    scene.gameStarted = false; // 操作を無効化

    // ハシゴが出てきて、宇宙飛行士が降りてくる演出
    scene.time.delayedCall(1000, () => {
        // ハシゴを描画（宇宙船の下から伸びる）
        const ladderX = scene.spaceship.x - 5;
        const ladderTop = scene.spaceship.y + 10; // 宇宙船の内部から伸ばす
        const ladderBottom = scene.spaceship.y + 56; // プレイヤー足元の少し上まで
        const astronautDestY = scene.spaceship.y + 50; // 着地中心位置（地面）は据え置き
        const ladder = scene.add.graphics({ lineStyle: { width: 1, color: 0xcccccc } });
        ladder.setDepth(7);

        // ハシゴが出てくるタイミングで、宇宙船の足元（ハシゴ付近）にカメラをパン＋ズーム
        const targetPanX = scene.spaceship.x;
        const targetPanY = scene.spaceship.y + 30; // ハシゴ中央あたり
        scene.cameras.main.pan(targetPanX, targetPanY, 1500, 'Sine.easeInOut');
        scene.cameras.main.zoomTo(4.5, 1500, 'Sine.easeInOut');

        // ハシゴがスッと伸びるアニメーション
        let ladderProgress = 0;
        const ladderTween = scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 800,
            ease: 'Sine.easeOut',
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
                // ハシゴが伸びきったら宇宙飛行士が降りてくる（後ろ向き）
                const astronaut = scene.add.sprite(
                    ladderX,
                    ladderTop,
                    'spaceman_B'
                );
                // 元画像は 725x904（縦長、アスペクト比 ~0.8）。アスペクト維持
                astronaut.setDisplaySize(15, 19);
                astronaut.setDepth(8);

                // 影を先に作成し、降下中にフェードイン（着地予定位置に）
                const destFootY = astronautDestY + 19 / 2;
                astronaut.shadow = createGroundShadow(scene, astronaut.x, destFootY, 14);
                astronaut.shadow.alpha = 0;
                scene.tweens.add({ targets: astronaut.shadow, alpha: 1, duration: 1500, ease: 'Sine.easeInOut' });

                steppedClimb(scene, astronaut, astronautDestY, 8, 100, 70, () => {
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
                        if (scene.moonCar && scene.playthroughCount === 0) {
                            const arrow = scene.moonCar.x > astronaut.x ? '>' : '<';
                            const arrows = [arrow, arrow + arrow, arrow + arrow + arrow];
                            const isRight = scene.moonCar.x > astronaut.x;
                            const offsetX = (isRight ? 1 : -1) * 25;
                            const originX = isRight ? 0 : 1; // 右向き=左揃え、左向き=右揃え
                            const labelY = astronaut.y - 34;
                            const arrowY = astronaut.y - 26;
                            const ARROW_LOOPS = 1; // STAGES=7 で 7 steps × 440ms = 3080ms（4秒以内）
                            const STAGES = 10;
                            const STEP_DUR = 160; // フェードイン
                            const STEP_HOLD = 80; // STAGES=10 で 10 steps × 400ms = 4000ms（4秒以内）
                            const STEP_TOTAL = STEP_DUR * 2 + STEP_HOLD; // 1ステップの総時間 (in+hold+out)
                            const totalSteps = ARROW_LOOPS * STAGES;
                            const totalDuration = STEP_TOTAL * totalSteps;

                            // ラベル＆矢印は同じアンカー位置で固定（プレイヤー移動に追従しない）
                            const fixedAnchorX = astronaut.x + offsetX;
                            // 0.5秒だけ遅らせて出す（操作開始の直後すぎないように）
                            scene.time.delayedCall(500, () => {
                                const label = scene.add.image(
                                    fixedAnchorX, labelY, 'label_rescue'
                                ).setOrigin(originX, 0.5).setDepth(12).setAlpha(0).setScale(scene._labelDisplayScale || 0.25);
                                const bubble = scene.makeGuideBubble(
                                    fixedAnchorX, labelY, arrowY, label, isRight, 0x88ffaa, 11.5
                                ).setScale(0, 1);
                                scene.tweens.add({ targets: label, alpha: 1, duration: 250, ease: 'Sine.easeOut' });
                                scene.tweens.add({ targets: bubble, scaleX: 1, duration: 300, ease: 'Sine.easeOut' });
                                scene.time.delayedCall(totalDuration + 100, () => {
                                    scene.tweens.add({
                                        targets: label, alpha: 0, duration: 300, ease: 'Sine.easeIn',
                                        onComplete: () => label.destroy()
                                    });
                                    scene.tweens.add({
                                        targets: bubble, scaleX: 0, duration: 300, ease: 'Sine.easeIn',
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
                }, 1);
            }
        });
    });
} else {
    scene.goalTimer = 0; // 触れていない場合、タイマーをリセットする
}

// 宇宙船が地面に達したかどうかを確認（ゴール成功時は除外）
if (scene.gameStarted && scene.spaceship.y + scene.spaceship.displayHeight / 2 >= scene.game.config.height - 63) {
    const groundSpeed = Math.sqrt(
        scene.spaceship.body.velocity.x * scene.spaceship.body.velocity.x +
        scene.spaceship.body.velocity.y * scene.spaceship.body.velocity.y
    );
    const groundLevel = Math.abs(scene.spaceship.angle) <= 5;

    if (groundLevel && groundSpeed < 80) {
        // ゆっくり水平着地：爆発せずコトンと停止、ミッション失敗
        scene.spaceship.setVelocity(0);
        scene.spaceship.setAcceleration(0);
        scene.spaceship.setGravityY(0);
        scene.spaceship.angle = 0;

        fadeStopSound(scene, scene.jetSound, 0.5);
        if (scene.emptySound.isPlaying) { scene.emptySound.stop(); }
        scene.jetParticles.up.on = false;
        scene.jetParticles.down.on = false;
        scene.jetParticles.left.on = false;
        scene.jetParticles.right.on = false;
        scene.dustEmitters.forEach(e => e.on = false);

        // 成功着地と同様に船にカメラを寄せる
        scene.cameras.main.pan(scene.spaceship.x, scene.spaceship.y + 30, 1500, 'Sine.easeInOut');
        scene.cameras.main.zoomTo(4.5, 1500, 'Sine.easeInOut');

        scene.add.image(scene.spaceship.x, scene.spaceship.y - 30, 'label_offtarget').setOrigin(0.5, 0.5).setDepth(11).setScale(scene._labelDisplayScale || 0.25);
        scene.endSound.play();
        scene.gameStarted = false;

        scene.time.delayedCall(3000, () => {
            restartGame(scene);
        });
    } else {
        // 速すぎるor傾いている：爆発
        gameOver(scene, '');
    }
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

// 宇宙船とデブリとの衝突をチェック
scene.physics.overlap(scene.spaceship, scene.debrisGroup, () => {
    gameOver(scene, '');
});

}
