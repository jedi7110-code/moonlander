// 着陸シーケンスのコックピット視点モード（DOM ベース）
// 既存の loading-screen DOM を briefing と同じ scale 1.4 で再表示し、
// .cockpit-monitor 内に俯瞰映像 + HUD をオーバーレイする。

import { gameOver } from './gameover.js';
import { fadeStopSound } from './audio.js';

// ─────────── 物理パラメータ ───────────
const INITIAL_ALTITUDE = 200;
const ALTITUDE_FT_FACTOR = 3.28;

const DESCENT_INC = 2.0;
const DESCENT_DEC = 1.5;
const DESCENT_MIN = 0.0;
const DESCENT_MAX = 4.0;
const DESCENT_INITIAL = 1.2;

const X_MOVE_SPEED = 35;
const X_OFFSET_LIMIT = 70;

const TILT_LIMIT = 30;
const TILT_CORRECT_RATE = 70;             // L/R 押下中の補正速度（度/秒）
const TILT_DRIFT_TARGET_HALF = 22;         // ぶれの目標到達範囲（広い）
const TILT_DRIFT_PULL = 8.0;              // 引っ張り速度（速い）
const TILT_DRIFT_RETARGET_INTERVAL = [0.25, 0.55]; // 短い間隔で目標切替（神経質）

const OK_X_BUFFER = 12;
const OK_TILT_MAX = 5;
const OK_DESCENT_MAX = 1.8;

const SAFE_DESCENT_MIN = 0.5;
const SAFE_DESCENT_MAX = OK_DESCENT_MAX;

// 画像 native = 2400x1400（横長）。モニターは 4:3 のまま、
// 画像の高さを monitor 高さに合わせて表示し、余った左右でパン可能にする
const IMG_NATIVE_W = 2400;
const IMG_NATIVE_H = 1400;
const IMG_MIN_SCALE = 1.0;
const IMG_MAX_SCALE = 4.0;
const SOURCE_SHIFT_PER_PX = 3.5;
const IMG_ASPECT = IMG_NATIVE_W / IMG_NATIVE_H; // 12/7 ≒ 1.714

// ─────────── ユーティリティ ───────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// VSI（タコメーター）：descent=0 → 9時方向(180°)、descent=DESCENT_MAX → 3時方向(0°)
const VSI_CX = 50, VSI_CY = 55, VSI_R = 40;
function vsiAngleDeg(d) {
    // 0 → 180°、DESCENT_MAX → 360°
    return 180 + clamp(d / DESCENT_MAX, 0, 1) * 180;
}
function vsiPoint(d, r) {
    const a = vsiAngleDeg(d) * Math.PI / 180;
    return { x: VSI_CX + r * Math.cos(a), y: VSI_CY + r * Math.sin(a) };
}
function setupVsiGauge(ck) {
    if (!ck.vsiSafeArc || !ck.vsiTicks) return;
    // 安全帯アーク
    const p1 = vsiPoint(SAFE_DESCENT_MIN, VSI_R);
    const p2 = vsiPoint(SAFE_DESCENT_MAX, VSI_R);
    const path = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${VSI_R} ${VSI_R} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    ck.vsiSafeArc.setAttribute('d', path);
    // 目盛：0、SAFE_MIN、SAFE_MAX、MAX の 4 つ
    ck.vsiTicks.innerHTML = '';
    const tickVals = [0, SAFE_DESCENT_MIN, SAFE_DESCENT_MAX, DESCENT_MAX];
    tickVals.forEach((d, i) => {
        const inner = vsiPoint(d, VSI_R - 4);
        const outer = vsiPoint(d, VSI_R + 2);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', inner.x.toFixed(2));
        line.setAttribute('y1', inner.y.toFixed(2));
        line.setAttribute('x2', outer.x.toFixed(2));
        line.setAttribute('y2', outer.y.toFixed(2));
        line.setAttribute('stroke-width', i === 0 || i === tickVals.length - 1 ? '1.5' : '1');
        ck.vsiTicks.appendChild(line);
    });
}

// 互換のため createCockpitObjects は残すが、何もしない（DOM 側で完結）
export function createCockpitObjects(scene) {
    scene._cockpitTriggered = false;
    scene.cockpitMode = false;
    scene._cockpitExiting = false;
    // DOM 要素への参照
    const shadowEl = document.querySelector('.cockpit-shadow');
    // 影は 10 段階の重ね（外周薄く大きく → 中心濃く小さく）
    if (shadowEl && !shadowEl.dataset.built) {
        shadowEl.innerHTML = '';
        const N = 10;
        for (let i = 0; i < N; i++) {
            const layer = document.createElement('div');
            layer.className = 'sh-layer';
            // size: 100% → 14% に線形減少
            const sizePct = 100 - (i * (86 / (N - 1)));
            // alpha: 0.06 → 0.85 に線形増加
            const alpha = 0.06 + (i / (N - 1)) * 0.79;
            layer.style.width = sizePct + '%';
            layer.style.height = sizePct + '%';
            layer.style.opacity = alpha.toFixed(3);
            shadowEl.appendChild(layer);
        }
        shadowEl.dataset.built = '1';
    }
    scene.cockpit = {
        ls: document.getElementById('loading-screen'),
        monitor: document.querySelector('.cockpit-monitor'),
        inner: document.querySelector('.cockpit-monitor-inner'),
        image: document.querySelector('.cockpit-image'),
        shadow: shadowEl,
        vsiVal: document.querySelector('.cockpit-vsi .vsi-val'),
        vsiNeedle: document.querySelector('.cockpit-vsi .vsi-needle'),
        vsiSafeArc: document.querySelector('.cockpit-vsi .vsi-safe-arc'),
        vsiTicks: document.querySelector('.cockpit-vsi .vsi-ticks'),
        attHorizon: document.querySelector('.cockpit-horizon .att-horizon'),
        attAltVal: document.querySelector('.cockpit-attitude .att-alt-val'),
        fuelFill: document.querySelector('.cockpit-fuel .fuel-fill')
    };

    // タコメーター：安全帯アーク・目盛を一度だけ生成
    setupVsiGauge(scene.cockpit);
}

// ─────────── 入場 ───────────
export function enterCockpitMode(scene) {
    if (scene.cockpitMode) return;
    scene.cockpitMode = true;

    // 物理を凍結する前に侵入時の角度・速度を捕獲（state 初期値で使用）
    scene._cockpitEntryAngle = (scene.spaceship && typeof scene.spaceship.angle === 'number')
        ? scene.spaceship.angle : 0;
    scene._cockpitEntryVy = (scene.spaceship && scene.spaceship.body)
        ? (scene.spaceship.body.velocity.y || 0) : 0;

    if (scene.spaceship && scene.spaceship.body) {
        scene.spaceship.body.allowGravity = false;
        scene.spaceship.setVelocity(0);
        scene.spaceship.setAcceleration(0);
    }

    if (scene.jetParticles) {
        scene.jetParticles.up.on = false;
        scene.jetParticles.downLeft.on = false;
        scene.jetParticles.downRight.on = false;
        scene.jetParticles.left.on = false;
        scene.jetParticles.right.on = false;
    }
    if (scene.dustEmitters) scene.dustEmitters.forEach(e => e.on = false);
    if (scene.jetSound && scene.jetSound.isPlaying) fadeStopSound(scene, scene.jetSound, 0.3);
    if (scene.emptySound && scene.emptySound.isPlaying) scene.emptySound.stop();

    if (scene.landingMarker) scene.landingMarker.setVisible(false);
    if (scene.fuelGaugeBorder) scene.fuelGaugeBorder.setVisible(false);
    if (scene.fuelGauge) scene.fuelGauge.setVisible(false);

    // デバッグ：?cockpit 付き起動時はホバー（descent 0）で開始
    let debugInit = false;
    try {
        debugInit = (typeof window !== 'undefined') && window.location &&
            window.location.search.includes('cockpit');
    } catch (e) {}

    // 侵入時の宇宙船の状態を初期値として引き継ぐ（凍結前に捕獲した値を使用）
    const initTilt = clamp(scene._cockpitEntryAngle || 0, -TILT_LIMIT, TILT_LIMIT);
    // velocity.y は px/sec（正＝下）、descentRate * 30 が altitude/sec に対応
    const initDescent = clamp((scene._cockpitEntryVy || 0) / 30, DESCENT_MIN, DESCENT_MAX);

    scene.cockpitState = {
        altitude: INITIAL_ALTITUDE,
        descentRate: debugInit ? 0 : initDescent,
        xOffset: 0,
        tilt: debugInit ? 0 : initTilt,
        driftTarget: initTilt, // 初期 drift 目標も侵入時 tilt 起点
        driftTimer: TILT_DRIFT_RETARGET_INTERVAL[0] + Math.random() *
            (TILT_DRIFT_RETARGET_INTERVAL[1] - TILT_DRIFT_RETARGET_INTERVAL[0]),
        blinkPhase: 0,
        shakeTime: 0
    };

    // DOM：loading-screen を hidden 解除して cockpit-mode へ
    const ck = scene.cockpit;
    if (ck.ls) {
        ck.ls.classList.remove('hidden', 'title', 'briefing');
        ck.ls.classList.add('cockpit-mode');
    }
}

// ─────────── 更新（毎フレーム） ───────────
export function updateCockpit(scene, delta) {
    if (!scene.cockpitMode || scene._cockpitExiting) return;
    const dt = delta / 1000;
    const st = scene.cockpitState;
    const ck = scene.cockpit;
    const cur = scene.cursors;

    const upDown = cur && cur.up && cur.up.isDown;
    const downDown = cur && cur.down && cur.down.isDown;
    const leftDown = cur && cur.left && cur.left.isDown;
    const rightDown = cur && cur.right && cur.right.isDown;

    if (upDown) st.descentRate -= DESCENT_DEC * dt;
    if (downDown) st.descentRate += DESCENT_INC * dt;
    st.descentRate = clamp(st.descentRate, DESCENT_MIN, DESCENT_MAX);

    if (leftDown) {
        st.xOffset -= X_MOVE_SPEED * dt;
        st.tilt -= TILT_CORRECT_RATE * dt;
    }
    if (rightDown) {
        st.xOffset += X_MOVE_SPEED * dt;
        st.tilt += TILT_CORRECT_RATE * dt;
    }
    st.xOffset = clamp(st.xOffset, -X_OFFSET_LIMIT, X_OFFSET_LIMIT);

    // ジェット噴射音：何かキーが押されている間だけ鳴らす（燃料も消費）
    const anyInput = upDown || downDown || leftDown || rightDown;
    if (anyInput && scene.fuel > 0) {
        if (scene.jetSound && !scene.jetSound.isPlaying) {
            try {
                if (scene.jetSound.volumeNode && scene.jetSound.manager) {
                    const ctx = scene.jetSound.manager.context;
                    scene.jetSound.volumeNode.gain.cancelScheduledValues(ctx.currentTime);
                    scene.jetSound.volumeNode.gain.setValueAtTime(0.5, ctx.currentTime);
                }
                scene.jetSound.play({ loop: true });
            } catch (e) {}
        }
        // 燃料消費（既存の感覚に近い率：0.4/sec）
        scene.fuel = Math.max(0, scene.fuel - 0.4 * dt * 60);
    } else {
        if (scene.jetSound && scene.jetSound.isPlaying) {
            fadeStopSound(scene, scene.jetSound, 0.15);
        }
    }

    st.driftTimer -= dt;
    if (st.driftTimer <= 0) {
        st.driftTarget = (Math.random() * 2 - 1) * TILT_DRIFT_TARGET_HALF;
        st.driftTimer = TILT_DRIFT_RETARGET_INTERVAL[0] + Math.random() *
            (TILT_DRIFT_RETARGET_INTERVAL[1] - TILT_DRIFT_RETARGET_INTERVAL[0]);
    }
    const driftDir = Math.sign(st.driftTarget - st.tilt);
    st.tilt += driftDir * TILT_DRIFT_PULL * dt;
    st.tilt = clamp(st.tilt, -TILT_LIMIT, TILT_LIMIT);

    st.altitude -= st.descentRate * dt * 30;
    if (st.altitude < 0) st.altitude = 0;

    st.blinkPhase += dt * 4;
    const blink = (st.blinkPhase % 1) < 0.5;

    // ── DOM 更新 ──
    if (!ck.monitor) return;

    const monitorRect = ck.monitor.getBoundingClientRect();
    const mW = monitorRect.width;
    const mH = monitorRect.height;

    // land-point.jpg のズーム：シフト付き反比例で altitude=INITIAL→1.0、altitude=0→4.0
    //   公式：zoom = a / (altitude + b)
    //   b = IMG_MIN_SCALE * INITIAL_ALTITUDE / (IMG_MAX_SCALE - IMG_MIN_SCALE)
    //   a = IMG_MAX_SCALE * b
    const _b = IMG_MIN_SCALE * INITIAL_ALTITUDE / (IMG_MAX_SCALE - IMG_MIN_SCALE);
    const _a = IMG_MAX_SCALE * _b;
    const altSafe = Math.max(0, st.altitude);
    const zoom = _a / (altSafe + _b);
    const tProg = (zoom - IMG_MIN_SCALE) / (IMG_MAX_SCALE - IMG_MIN_SCALE);

    // 画像は横長（12:7）、モニターは 4:3。
    // 画像の高さをモニター高さ × zoom に合わせ、幅は aspect 維持で広めに（パン余裕）
    const imgH = mH * zoom;
    const imgW = imgH * IMG_ASPECT;

    // パン量：xOffset に比例（横移動しても画像端に届かない範囲でクランプ）
    const maxPan = Math.max(0, (imgW - mW) / 2);
    let panX = -st.xOffset * SOURCE_SHIFT_PER_PX * (imgW / IMG_NATIVE_W);
    panX = clamp(panX, -maxPan, maxPan);

    // ジェット噴射シェイク（image のみ。マスク枠は揺らさない）
    st.shakeTime += dt;
    const shakeAmp = lerp(1.2, 3.2, st.descentRate / DESCENT_MAX);
    const sx = Math.sin(st.shakeTime * 17 * Math.PI * 2) * shakeAmp +
               Math.sin(st.shakeTime * 6.3 * Math.PI * 2) * shakeAmp * 0.4;
    const sy = Math.cos(st.shakeTime * 23 * Math.PI * 2) * shakeAmp +
               Math.cos(st.shakeTime * 9.4 * Math.PI * 2) * shakeAmp * 0.4;

    if (ck.image) {
        ck.image.style.width = imgW + 'px';
        ck.image.style.height = imgH + 'px';
        // tilt（バンク）に応じて perspective + rotateY で台形パース表現
        // 左バンク（tilt 負）→ rotateY 負 → 左辺が奥で短く・右辺が手前で長く
        const persp = `perspective(900px) rotateY(${(st.tilt * 0.7).toFixed(2)}deg)`;
        ck.image.style.transform =
            `translate(calc(-50% + ${(panX + sx).toFixed(2)}px), calc(-50% + ${sy.toFixed(2)}px)) ${persp}`;
    }

    // 影（モニター中央、高度低下で大きく濃く、傾きで perspective 変形）
    const shadowMaxR = Math.min(mW, mH) * 0.55;
    const shadowR = lerp(8, shadowMaxR, tProg);
    const shadowAlpha = lerp(0.15, 0.55, tProg);
    if (ck.shadow) {
        ck.shadow.style.width = (shadowR * 2) + 'px';
        ck.shadow.style.height = (shadowR * 2) + 'px';
        ck.shadow.style.opacity = shadowAlpha.toFixed(2);
        // 画像と同じ perspective + rotateY を影にも適用（傾きパース）
        const persp = `perspective(900px) rotateY(${(st.tilt * 0.7).toFixed(2)}deg)`;
        ck.shadow.style.transform = `translate(-50%, -50%) ${persp}`;
    }

    // 水平インジケーター線：tilt で回転（十字と同じ中心）
    if (ck.attHorizon) {
        ck.attHorizon.style.transform = `translate(-50%, -50%) rotate(${st.tilt.toFixed(2)}deg)`;
    }

    // 高度（水平線の上に表示）
    if (ck.attAltVal) ck.attAltVal.textContent = String(Math.ceil(st.altitude * ALTITUDE_FT_FACTOR));

    // VSI：対地速度。タコメーター針回転 + 数値表示
    if (ck.vsiVal) ck.vsiVal.textContent = (st.descentRate * 3.0).toFixed(1);
    if (ck.vsiNeedle) {
        // 針は 12時方向に伸びている → -90° で 9時、+90° で 3時
        const needleDeg = -90 + clamp(st.descentRate / DESCENT_MAX, 0, 1) * 180;
        ck.vsiNeedle.style.transform = `rotate(${needleDeg.toFixed(2)}deg)`;
    }

    const isSafe = st.descentRate >= SAFE_DESCENT_MIN && st.descentRate <= SAFE_DESCENT_MAX;
    ck.monitor.classList.toggle('spd-fast', st.descentRate > SAFE_DESCENT_MAX);
    ck.monitor.classList.toggle('spd-slow', st.descentRate < SAFE_DESCENT_MIN && st.descentRate > 0);
    ck.monitor.classList.toggle('spd-safe', isSafe);

    // 燃料計（既存の scene.fuel: 0..200）
    const fuelMax = 200;
    const fuelPct = clamp((scene.fuel || 0) / fuelMax, 0, 1) * 100;
    if (ck.fuelFill) ck.fuelFill.style.height = fuelPct.toFixed(1) + '%';
    ck.monitor.classList.toggle('fuel-low', fuelPct < 35 && fuelPct >= 15);
    ck.monitor.classList.toggle('fuel-crit', fuelPct < 15);

    // 十字 OK
    const isOnTarget = Math.abs(st.xOffset) < OK_X_BUFFER;
    ck.monitor.classList.toggle('on-target', isOnTarget);

    // 点滅クラス
    ck.monitor.classList.toggle('blink', blink);

    // 着地判定
    if (st.altitude <= 0) {
        const isLevel = Math.abs(st.tilt) < OK_TILT_MAX;
        const isSlow = st.descentRate < OK_DESCENT_MAX;
        const isCenter = Math.abs(st.xOffset) < OK_X_BUFFER;
        const success = isLevel && isSlow && isCenter;
        exitCockpitMode(scene, success);
    }
}

// ─────────── 退場 ───────────
export function exitCockpitMode(scene, success) {
    if (!scene.cockpitMode || scene._cockpitExiting) return;
    scene._cockpitExiting = true;

    const ck = scene.cockpit;
    if (ck.ls) {
        ck.ls.classList.remove('cockpit-mode');
        ck.ls.classList.add('hidden');
    }

    const padSurfaceY = scene.moon.y + scene.moon.displayHeight / 2;
    if (scene.spaceship) {
        scene.spaceship.x = scene.moon.x;
        scene.spaceship.y = padSurfaceY - scene.spaceship.displayHeight / 2;
        scene.spaceship.angle = 0;
        if (scene.spaceship.body) {
            scene.spaceship.body.allowGravity = true;
            scene.spaceship.setVelocity(0);
            scene.spaceship.setAcceleration(0);
        }
    }

    if (scene.fuelGaugeBorder) scene.fuelGaugeBorder.setVisible(true);
    if (scene.fuelGauge) scene.fuelGauge.setVisible(true);

    // ジェット音停止
    if (scene.jetSound && scene.jetSound.isPlaying) fadeStopSound(scene, scene.jetSound, 0.2);

    if (success) {
        // 成功：少しだけ間を置いて既存の着陸成功フローへ繋ぐ
        setTimeout(() => {
            scene.cockpitMode = false;
            scene._cockpitExiting = false;
        }, 300);
    } else {
        // 失敗：即爆発
        scene.cockpitMode = false;
        scene._cockpitExiting = false;
        gameOver(scene, '');
    }
}
