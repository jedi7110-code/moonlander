// 着陸シーケンスのコックピット視点モード（DOM ベース）
// 既存の loading-screen DOM を briefing と同じ scale 1.4 で再表示し、
// .cockpit-monitor 内に俯瞰映像 + HUD をオーバーレイする。

import { gameOver } from './gameover.js';
import { fadeStopSound } from './audio.js';

// ─────────── 物理パラメータ ───────────
const INITIAL_ALTITUDE = 200;       // 高度の上限（zoom 計算の anchor 兼天井）= 200m
const START_ALTITUDE = 150;         // 開始時の高度（INITIAL の 75%）
const ALTITUDE_M_FACTOR = 1.0;      // 表示も m
const SPEED_KMH_FACTOR = 3.6;       // descentRate (m/s) → km/h

// 重力（常時下向きに加速）と上下キー推力。
// 反応速度は元の値（GRAVITY=1.5, DESCENT_INC=2.5, DESCENT_DEC=4.5, DESCENT_MIN=-2）と
// キビキビ版（0.8 / 6.0 / 8.0 / -4）の中間に揃えた。
const GRAVITY = 1.2;       // m/s²（常時 descentRate に加算）
const DESCENT_INC = 4.0;   // 下キー押下時の追加加速（gravity に上乗せ）
const DESCENT_DEC = 6.0;   // 上キー押下時の減速（gravity を上回る上向き推力）
const DESCENT_MIN = -3.0;  // 上昇方向（負）の限界
const DESCENT_MAX = 7.0;   // 約 25km/h（SPEED_KMH_FACTOR=3.6）
const DESCENT_INITIAL = 1.2;

// 横移動：左右キーで加速、無入力時は弱い摩擦でだらだら滑る（横滑り感）
const X_ACCEL = 220;       // px/s² L/R 押下時の横加速
const X_FRICTION = 25;     // px/s² 無入力時の弱い摩擦（小さくすると慣性が長く続く）
const X_MAX_VEL = 90;      // 横速度の上限 px/s
// 横移動の限界。OK_X_BUFFER（=90）より外まで行けるようにする。
// 最大高度近辺では land-point.jpg のモニター枠端で切れる場合があるが、
// 通常プレイ域（150m 以下）では問題ない範囲。
const X_OFFSET_LIMIT = 115;

const TILT_LIMIT = 30;
const TILT_CORRECT_RATE = 70;             // L/R 押下中の傾け量（度/秒）
const TILT_AUTO_LEVEL_RATE = 14;          // 無入力時に drift target へ戻る速度（度/秒）
// 水平軸のゆらぎ：完全な水平を保たず、±5° の範囲をのんびり揺れる。
// 「ちょっとぶれるけど致命的ではない」最初期の挙動を控えめに復活。
const TILT_DRIFT_TARGET_HALF = 5;         // ぶれの目標到達範囲（小さめ）
const TILT_DRIFT_RETARGET_INTERVAL = [0.7, 1.4]; // 目標切替間隔（ゆったり）

// 横位置 OK：着陸台の半幅。X_OFFSET_LIMIT より小さくして「外へも行けるが
// OK 範囲外は失敗」という難易度を作る。赤線の位置と一致させて調整可能。
const OK_X_BUFFER = 90;
const OK_X_VEL_MAX = 14;                  // 着地 OK の横滑り速度上限 px/s
const OK_TILT_MAX = 5;
const OK_DESCENT_MAX = 1.4;               // 着地 OK の降下速度上限 m/s（≈5 km/h）

const SAFE_DESCENT_MIN = 0;               // OK エリアの下限：0 km/h
const SAFE_DESCENT_MAX = OK_DESCENT_MAX;  // OK エリアの上限：5 km/h

// 画像 native = 2400x1400（横長）。モニターは 4:3 のまま、
// 画像の高さを monitor 高さに合わせて表示し、余った左右でパン可能にする
const IMG_NATIVE_W = 2400;
const IMG_NATIVE_H = 1400;
const IMG_MIN_SCALE = 1.0;
const IMG_MAX_SCALE = 8.0;
const SOURCE_SHIFT_PER_PX = 3.5;
const IMG_ASPECT = IMG_NATIVE_W / IMG_NATIVE_H; // 12/7 ≒ 1.714

// ─────────── ユーティリティ ───────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// VSI（タコメーター）：3 区間ピースワイズ・マッピング。
// 着陸 OK ゾーン（降下側）だけを拡大、上昇は圧縮（上昇しながら着陸は不可）。
//   ascent  : 42° / 3 m/s   = 14.0°/m/s（圧縮、粗い目盛）
//   safe    : 60° / 1.4 m/s ≈ 42.9°/m/s（拡大、精密目盛 = 着陸 OK 範囲）
//   excess  : 78° / 5.6 m/s ≈ 13.9°/m/s（圧縮、粗い目盛 = 過剰降下警告）
//
// 上昇と過剰降下の針スピードはほぼ同じ（14°/m/s）に揃えている。
//
//   DESCENT_MIN（上昇上限）  → 180°（9時、左）
//   0 m/s（水平）             → 222°
//   SAFE_DESCENT_MAX (1.4)    → 282°
//   DESCENT_MAX（降下上限）   → 360°（3時、右）
const VSI_CX = 50, VSI_CY = 55, VSI_R = 40;
const VSI_ASCENT_DEG = 42;       // 上昇圧縮区間
const VSI_SAFE_DEG = 60;         // 安全帯拡大区間（OK 範囲の白アーク幅）
// 過剰降下: 180 - 42 - 60 = 78°
function vsiAngleDeg(d) {
    if (d <= 0) {
        const n = clamp((d - DESCENT_MIN) / (0 - DESCENT_MIN), 0, 1);
        return 180 + n * VSI_ASCENT_DEG;
    }
    if (d <= SAFE_DESCENT_MAX) {
        const n = clamp(d / SAFE_DESCENT_MAX, 0, 1);
        return (180 + VSI_ASCENT_DEG) + n * VSI_SAFE_DEG;
    }
    const n = clamp((d - SAFE_DESCENT_MAX) / (DESCENT_MAX - SAFE_DESCENT_MAX), 0, 1);
    return (180 + VSI_ASCENT_DEG + VSI_SAFE_DEG) + n * (180 - VSI_ASCENT_DEG - VSI_SAFE_DEG);
}
function vsiPoint(d, r) {
    const a = vsiAngleDeg(d) * Math.PI / 180;
    return { x: VSI_CX + r * Math.cos(a), y: VSI_CY + r * Math.sin(a) };
}
function setupVsiGauge(ck) {
    if (!ck.vsiSafeArc || !ck.vsiTicks) return;
    // 安全帯アーク（0 → SAFE_DESCENT_MAX、12時のすぐ右の細い帯）
    const p1 = vsiPoint(SAFE_DESCENT_MIN, VSI_R);
    const p2 = vsiPoint(SAFE_DESCENT_MAX, VSI_R);
    const path = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${VSI_R} ${VSI_R} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    ck.vsiSafeArc.setAttribute('d', path);
    // 目盛：上昇上限・0・SAFE_MAX・降下上限の 4 つ。両端は太線。
    ck.vsiTicks.innerHTML = '';
    const tickVals = [DESCENT_MIN, 0, SAFE_DESCENT_MAX, DESCENT_MAX];
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
    // 影：CSS radial-gradient による滑らかなグラデーション（単一要素）
    const shadowEl = document.querySelector('.cockpit-shadow');
    if (shadowEl) shadowEl.innerHTML = '';

    // 高度ラダー：0m〜700m の 100m 刻みの線。0m は太い着地ライン
    const ladderEl = document.querySelector('.cockpit-altladder');
    if (ladderEl && !ladderEl.dataset.built) {
        ladderEl.innerHTML = '';
        const altsM = [0, 100, 200, 300, 400, 500, 600, 700];
        altsM.forEach(m => {
            const line = document.createElement('div');
            line.className = 'alt-line' + (m === 0 ? ' alt-zero' : '');
            line.dataset.alt = String(m);
            const label = document.createElement('span');
            label.className = 'alt-label';
            label.textContent = m + 'm';
            line.appendChild(label);
            ladderEl.appendChild(line);
        });
        ladderEl.dataset.built = '1';
    }
    scene.cockpit = {
        ls: document.getElementById('loading-screen'),
        monitor: document.querySelector('.cockpit-monitor'),
        inner: document.querySelector('.cockpit-monitor-inner'),
        image: document.querySelector('.cockpit-image'),
        shadow: shadowEl,
        ladder: ladderEl,
        altLines: ladderEl ? Array.from(ladderEl.querySelectorAll('.alt-line')) : [],
        okzoneLeft: document.querySelector('.cockpit-okzone .okzone-line-l'),
        okzoneRight: document.querySelector('.cockpit-okzone .okzone-line-r'),
        csAngVal: document.querySelector('.cockpit-status .cs-ang-val'),
        csSpdVal: document.querySelector('.cockpit-status .cs-spd-val'),
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
    scene._cockpitEntryVx = (scene.spaceship && scene.spaceship.body)
        ? (scene.spaceship.body.velocity.x || 0) : 0;

    if (scene.spaceship && scene.spaceship.body) {
        scene.spaceship.body.allowGravity = false;
        scene.spaceship.setVelocity(0);
        scene.spaceship.setAcceleration(0);
    }

    // ※宇宙船と影の着地位置スナップは fade-in 完了後（コックピット完全不透明後）に
    //   遅延実行する。fade-in 中に snap するとふんわり遷移中にワープが見えてしまう。
    //   下の setTimeout(..., FADE_IN_MS) で実行。

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
    // velocity.y は px/sec（正＝下）。altitude 倍率 8 と整合させて変換
    const initDescent = clamp((scene._cockpitEntryVy || 0) / 50, DESCENT_MIN, DESCENT_MAX);
    // 横滑り：侵入時の宇宙船の横速度を引き継ぐ（宇宙空間移動の慣性が残る）
    const initXVel = clamp(scene._cockpitEntryVx || 0, -X_MAX_VEL, X_MAX_VEL);

    scene.cockpitState = {
        altitude: START_ALTITUDE,
        descentRate: debugInit ? 0 : initDescent,
        xOffset: 0,
        xVel: debugInit ? 0 : initXVel,
        tilt: debugInit ? 0 : initTilt,
        // ぶれの目標値とリタゲットタイマー
        driftTarget: 0,
        driftTimer: TILT_DRIFT_RETARGET_INTERVAL[0] + Math.random() *
            (TILT_DRIFT_RETARGET_INTERVAL[1] - TILT_DRIFT_RETARGET_INTERVAL[0]),
        blinkPhase: 0,
        shakeTime: 0
    };

    // DOM：loading-screen を hidden 解除し、cockpit-mode + ふんわり fade-in
    const ck = scene.cockpit;
    if (ck.ls) {
        ck.ls.classList.remove('hidden', 'title', 'briefing', 'cockpit-fade-out');
        ck.ls.classList.add('cockpit-mode', 'cockpit-fade-in');
    }

    // コックピット環境音をループ再生（着陸成功 / 爆発で停止）
    if (scene.cockpitSound && !scene.cockpitSound.isPlaying) {
        try { scene.cockpitSound.play({ loop: true }); } catch (e) {}
    }

    const FADE_IN_MS = 600;
    setTimeout(() => {
        // fade-in 完了：cockpit が完全不透明になったので、隠れている canvas 上で
        // 宇宙船と影を着地位置にスナップ。ユーザーには見えない。
        if (ck.ls) ck.ls.classList.remove('cockpit-fade-in');
        if (scene.spaceship && scene.moon) {
            const padSurfaceY = scene.moon.y + scene.moon.displayHeight / 2;
            scene.spaceship.x = scene.moon.x;
            scene.spaceship.y = padSurfaceY - scene.spaceship.displayHeight / 2;
            scene.spaceship.angle = 0;
            if (scene.spaceshipShadow) {
                const groundLineY = scene.game.config.height - 63;
                const heightAboveGoal = Math.max(scene.spaceship.y - (groundLineY - 260), 0);
                const shadowAlpha = heightAboveGoal / 260;
                const shadowSize = 110 - (heightAboveGoal / 4.6);
                scene.spaceshipShadow.x = scene.spaceship.x;
                scene.spaceshipShadow.y = padSurfaceY;
                scene.spaceshipShadow.alpha = shadowAlpha;
                scene.spaceshipShadow.setScale(shadowSize / 100);
                if (scene.spaceshipShadowGround) {
                    scene.spaceshipShadowGround.x = scene.spaceship.x;
                    scene.spaceshipShadowGround.y = groundLineY;
                    scene.spaceshipShadowGround.alpha = shadowAlpha;
                    scene.spaceshipShadowGround.setScale(shadowSize / 100);
                }
            }
        }
    }, FADE_IN_MS);
}

// ─────────── 更新（毎フレーム） ───────────
export function updateCockpit(scene, delta) {
    if (!scene.cockpitMode || scene._cockpitExiting) return;
    const dt = delta / 1000;
    const st = scene.cockpitState;
    const ck = scene.cockpit;
    const cur = scene.cursors;

    // 燃料切れ時は推進入力を無効化（重力のみで落下、左右ドリフトも止まる）
    const hasFuel = (scene.fuel || 0) > 0;
    const upDown = hasFuel && cur && cur.up && cur.up.isDown;
    const downDown = hasFuel && cur && cur.down && cur.down.isDown;
    const leftDown = hasFuel && cur && cur.left && cur.left.isDown;
    const rightDown = hasFuel && cur && cur.right && cur.right.isDown;

    // 重力を常時加算（無入力時はだんだん速く落下）
    st.descentRate += GRAVITY * dt;
    if (upDown) st.descentRate -= DESCENT_DEC * dt;
    if (downDown) st.descentRate += DESCENT_INC * dt;
    st.descentRate = clamp(st.descentRate, DESCENT_MIN, DESCENT_MAX);

    // 横方向：左右キーで加速、無入力時は弱い摩擦で慣性が残る（横滑り感）
    if (leftDown) {
        st.xVel -= X_ACCEL * dt;
        st.tilt -= TILT_CORRECT_RATE * dt;
    }
    if (rightDown) {
        st.xVel += X_ACCEL * dt;
        st.tilt += TILT_CORRECT_RATE * dt;
    }
    if (!leftDown && !rightDown) {
        // 摩擦は弱め — 横滑り感を出すためすぐには止まらない
        if (st.xVel > 0) st.xVel = Math.max(0, st.xVel - X_FRICTION * dt);
        else if (st.xVel < 0) st.xVel = Math.min(0, st.xVel + X_FRICTION * dt);
    }
    st.xVel = clamp(st.xVel, -X_MAX_VEL, X_MAX_VEL);
    st.xOffset += st.xVel * dt;
    // X_OFFSET_LIMIT を超えたら速度も削いで「壁にぶつかる」挙動
    if (st.xOffset > X_OFFSET_LIMIT) {
        st.xOffset = X_OFFSET_LIMIT;
        if (st.xVel > 0) st.xVel = 0;
    } else if (st.xOffset < -X_OFFSET_LIMIT) {
        st.xOffset = -X_OFFSET_LIMIT;
        if (st.xVel < 0) st.xVel = 0;
    }

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

    // 水平軸のゆらぎ：driftTarget が ±TILT_DRIFT_TARGET_HALF のランダム値で切り替わり、
    // 横入力が無い時は driftTarget へゆっくり追従。完全な 0° 固定ではなく
    // 微かに揺れる「最初の頃」の挙動を控えめに再現。
    st.driftTimer -= dt;
    if (st.driftTimer <= 0) {
        st.driftTarget = (Math.random() * 2 - 1) * TILT_DRIFT_TARGET_HALF;
        st.driftTimer = TILT_DRIFT_RETARGET_INTERVAL[0] + Math.random() *
            (TILT_DRIFT_RETARGET_INTERVAL[1] - TILT_DRIFT_RETARGET_INTERVAL[0]);
    }
    if (!leftDown && !rightDown) {
        if (st.tilt > st.driftTarget) {
            st.tilt = Math.max(st.driftTarget, st.tilt - TILT_AUTO_LEVEL_RATE * dt);
        } else if (st.tilt < st.driftTarget) {
            st.tilt = Math.min(st.driftTarget, st.tilt + TILT_AUTO_LEVEL_RATE * dt);
        }
    }
    st.tilt = clamp(st.tilt, -TILT_LIMIT, TILT_LIMIT);

    // altitude は m 単位、descentRate は m/s。ゲーム性のため少し早めの倍率を掛ける
    st.altitude -= st.descentRate * dt * 8;
    if (st.altitude < 0) st.altitude = 0;
    // 天井：上昇は INITIAL_ALTITUDE（=200m）まで。突き抜けたら descentRate を 0 にして止める
    if (st.altitude > INITIAL_ALTITUDE) {
        st.altitude = INITIAL_ALTITUDE;
        if (st.descentRate < 0) st.descentRate = 0;
    }

    st.blinkPhase += dt * 4;
    const blink = (st.blinkPhase % 1) < 0.5;

    // ── DOM 更新 ──
    if (!ck.monitor) return;

    // 親 loading-screen の transform: scale を含めない CSS 座標を使う
    // （子要素の top/left は親の CSS 座標系で解釈されるため）
    const mW = ck.monitor.offsetWidth;
    const mH = ck.monitor.offsetHeight;

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
        // tilt（バンク）に応じて rotateY で台形パース表現。
        // 透視点は親 .cockpit-monitor-inner の `perspective: 900px` で共有しており、
        // 影と同じ 3D ステージ上で同一 vanishing point に向かう。
        // 左バンク（tilt 負）→ rotateY 負 → 左辺が奥で短く・右辺が手前で長く
        const persp = `rotateY(${(st.tilt * 0.7).toFixed(2)}deg)`;
        ck.image.style.transform =
            `translate(calc(-50% + ${(panX + sx).toFixed(2)}px), calc(-50% + ${sy.toFixed(2)}px)) ${persp}`;
    }

    // HUD：着陸ゾーン左右端ガイドライン（緑）。陸地と同じ panRate で地面に貼り付き、
    // 機体の傾きにも追従。地面 x = ±OK_X_BUFFER の位置を screen pixel に変換。
    if (ck.okzoneLeft && ck.okzoneRight) {
        const panRate = SOURCE_SHIFT_PER_PX * (imgW / IMG_NATIVE_W);
        const leftPx = (-OK_X_BUFFER - st.xOffset) * panRate;
        const rightPx = (OK_X_BUFFER - st.xOffset) * panRate;
        const ry = (st.tilt * 0.7).toFixed(2);
        ck.okzoneLeft.style.transform =
            `translate(calc(-50% + ${leftPx.toFixed(2)}px), 0) rotateY(${ry}deg)`;
        ck.okzoneRight.style.transform =
            `translate(calc(-50% + ${rightPx.toFixed(2)}px), 0) rotateY(${ry}deg)`;
    }

    // 影（モニター中央、高度低下で大きく濃く、傾きで perspective 変形）
    const shadowMaxR = Math.min(mW, mH) * 0.72;
    const shadowR = lerp(10, shadowMaxR, tProg);
    const shadowAlpha = lerp(0.15, 0.55, tProg);
    // ぼかし量も高度連動：上空ではぼけて、着地が近づくほどシャープに
    const shadowBlur = lerp(8, 3, tProg);
    if (ck.shadow) {
        ck.shadow.style.width = (shadowR * 2) + 'px';
        ck.shadow.style.height = (shadowR * 2) + 'px';
        ck.shadow.style.opacity = shadowAlpha.toFixed(2);
        ck.shadow.style.filter = `blur(${shadowBlur.toFixed(1)}px)`;
        // 陸地（cockpit-image）と完全に同じ rotateY を影にも適用。
        // 親 .cockpit-monitor-inner の共有 perspective に乗ることで、
        // 影と陸地が同じ vanishing point の同一 3D 平面に貼り付いて見える
        const persp = `rotateY(${(st.tilt * 0.7).toFixed(2)}deg)`;
        ck.shadow.style.transform = `translate(-50%, -50%) ${persp}`;
    }

    // 水平インジケーター線：tilt で回転（十字と同じ中心）
    if (ck.attHorizon) {
        ck.attHorizon.style.transform = `translate(-50%, -50%) rotate(${st.tilt.toFixed(2)}deg)`;
    }

    // 高度（水平線の上に表示、単位 m）
    if (ck.attAltVal) ck.attAltVal.textContent = String(Math.ceil(st.altitude * ALTITUDE_M_FACTOR));

    // 高度ラダー：各 100m 線の screenY = monitor 中心 + (現在高度 - 線高度) * scale
    if (ck.altLines && ck.altLines.length) {
        const ladderCenterY = mH / 2;
        const pxPerMeter = 1.0;
        for (const line of ck.altLines) {
            const m = parseFloat(line.dataset.alt);
            const y = ladderCenterY + (st.altitude - m) * pxPerMeter;
            // モニター外のラインは display 切り替えで非表示（高速で大量に出ない）
            if (y < -10 || y > mH + 10) {
                line.style.display = 'none';
            } else {
                line.style.display = 'block';
                line.style.top = y.toFixed(1) + 'px';
            }
        }
    }

    // VSI：対地速度。タコメーター針回転 + 数値表示（km/h）
    if (ck.vsiVal) ck.vsiVal.textContent = (st.descentRate * SPEED_KMH_FACTOR).toFixed(1);
    if (ck.vsiNeedle) {
        // 針は 12時方向に伸びている → -90° で 9時、+90° で 3時
        // ゲージ角度（180°〜360°）→ CSS rotate（-90°〜+90°）
        // d=DESCENT_MIN → -90°（9時）、d=0 → 0°（12時）、d=DESCENT_MAX → +90°（3時）
        const needleDeg = vsiAngleDeg(st.descentRate) - 270;
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

    // 十字（緑点滅）：xOffset が中央バッファ内
    const isCenterOk = Math.abs(st.xOffset) < OK_X_BUFFER;
    ck.monitor.classList.toggle('on-target', isCenterOk);
    // OK バッジ：着地判定と完全一致した全条件（角度＋速度＋中央＋横滑り）
    const isLevelOk = Math.abs(st.tilt) < OK_TILT_MAX;
    const isSpeedOk = st.descentRate < OK_DESCENT_MAX && st.descentRate >= SAFE_DESCENT_MIN;
    const isSlideOk = Math.abs(st.xVel) < OK_X_VEL_MAX;
    const isLandable = isLevelOk && isSpeedOk && isCenterOk && isSlideOk;
    ck.monitor.classList.toggle('landable', isLandable);
    // 個別ステータス（ANG / SPD）— OK の時は "OK"、NG なら "--" に切替＋点滅
    ck.monitor.classList.toggle('ang-ng', !isLevelOk);
    ck.monitor.classList.toggle('spd-ng', !isSpeedOk);
    if (ck.csAngVal) ck.csAngVal.textContent = isLevelOk ? 'OK' : '--';
    if (ck.csSpdVal) ck.csSpdVal.textContent = isSpeedOk ? 'OK' : '--';

    // 点滅クラス
    ck.monitor.classList.toggle('blink', blink);

    // 着地判定
    if (st.altitude <= 0) {
        const isLevel = Math.abs(st.tilt) < OK_TILT_MAX;
        const isSlow = st.descentRate < OK_DESCENT_MAX;
        const isCenter = Math.abs(st.xOffset) < OK_X_BUFFER;
        const isSlide = Math.abs(st.xVel) < OK_X_VEL_MAX;
        const success = isLevel && isSlow && isCenter && isSlide;
        exitCockpitMode(scene, success);
    }
}

// ─────────── 退場 ───────────
export function exitCockpitMode(scene, success) {
    if (!scene.cockpitMode || scene._cockpitExiting) return;
    scene._cockpitExiting = true;

    const ck = scene.cockpit;
    // 成功時：コックピットはすぐ消さず、settle アニメ → 1秒固定 → ふんわりフェード
    // 失敗時：コックピットを残したまま爆破
    // 宇宙船の位置は enterCockpitMode で着地位置にスナップ済みだが、
    // 万が一ずれていた場合のために exit 時にも明示的に再スナップする。
    // allowGravity は false のまま（フェード 2.6 秒の落下を防ぐ）。
    // gravity の最終的な復元は update.js の着陸成功ブランチに任せる。
    if (scene.spaceship && scene.spaceship.body && scene.moon) {
        const padSurfaceY = scene.moon.y + scene.moon.displayHeight / 2;
        scene.spaceship.x = scene.moon.x;
        scene.spaceship.y = padSurfaceY - scene.spaceship.displayHeight / 2;
        scene.spaceship.angle = 0;
        scene.spaceship.setVelocity(0);
        scene.spaceship.setAcceleration(0);
        // allowGravity = true にしない（フェード 2.6 秒の間に gravity:80 で落下するのを防ぐ）
    }

    // 燃料ゲージは敢えて再表示しない：success branch（update.js line 1879）
    // 側で着地時に非表示処理されるため、フェード明けに一瞬だけ「白い枠」が
    // 残って見えてしまう現象を防ぐ。失敗時は restart で全部リセットされる。

    // ジェット音停止
    if (scene.jetSound && scene.jetSound.isPlaying) fadeStopSound(scene, scene.jetSound, 0.2);

    // コックピット環境音は exit の瞬間には止めない：
    //   - 成功時: cockpit-landing.mp3 と重ねて鳴り続け、フェード明け（cockpitMode=false）で停止
    //   - 失敗時: 爆発が始まる瞬間に停止（爆破でこの音は止まる）

    if (success) {
        // 着陸成功 SE を 1 度だけ再生（cockpitSound は背後で鳴り続ける）
        if (scene.cockpitLandingSound) {
            try { scene.cockpitLandingSound.play(); } catch (e) {}
        }
        // 成功：機体が沈むように一瞬ズームして戻すアニメ → 1秒固定 → ふんわりフェード → ハシゴ降下シーンへ
        const img = ck.image;
        if (img && ck.monitor) {
            // 着地時のパン位置（プレイヤーが滑り込んで停止した X オフセット）を計算し、
            // CSS 変数 --land-pan-x として渡す。これで settle アニメは中央へワープせず
            // 着陸視点のまま沈み込む。
            const mW = ck.monitor.offsetWidth;
            const mH = ck.monitor.offsetHeight;
            const _b = IMG_MIN_SCALE * INITIAL_ALTITUDE / (IMG_MAX_SCALE - IMG_MIN_SCALE);
            const _a = IMG_MAX_SCALE * _b;
            const zoomLand = _a / (0 + _b); // altitude=0 時の zoom
            const imgH = mH * zoomLand;
            const imgW = imgH * IMG_ASPECT;
            const maxPan = Math.max(0, (imgW - mW) / 2);
            let landPanX = -scene.cockpitState.xOffset * SOURCE_SHIFT_PER_PX * (imgW / IMG_NATIVE_W);
            landPanX = Math.max(-maxPan, Math.min(maxPan, landPanX));
            // 画像サイズも着地時の最終値に揃える（最後のフレームが alt=0 ぴったりとは限らないので明示）
            img.style.width = imgW + 'px';
            img.style.height = imgH + 'px';
            img.style.setProperty('--land-pan-x', landPanX.toFixed(2) + 'px');
            // JS-driven transform をリセットし、CSS keyframe に引き継ぐ
            img.style.transform = '';
            img.classList.remove('landing-settle');
            void img.offsetWidth;
            img.classList.add('landing-settle');
        }
        const SETTLE_MS = 900;
        const HOLD_MS = 1000;
        const FADE_MS = 700;
        // ゲーム側カメラを「宇宙船アップ」状態に固定するヘルパー。
        // 進行中の pan/zoomTo tween があると上書きできないので必ず stop してから
        // setZoom + centerOn でスナップさせる（ハシゴ降下シーンの zoomTo(4.5,...) と一致）。
        const lockCloseUpCamera = () => {
            if (!scene.cameras || !scene.cameras.main || !scene.spaceship) return;
            const cam = scene.cameras.main;
            const TARGET_ZOOM = 4.5;
            // ハシゴ中央寄りに合わせる（update.js の targetPanY と同じ +30 オフセット）
            const targetX = scene.spaceship.x;
            const targetY = scene.spaceship.y + 30;
            // 既存のカメラ tween を打ち切り（pan/zoomTo のような effect を強制終了）
            if (cam.panEffect && cam.panEffect.isRunning) cam.panEffect.reset();
            if (cam.zoomEffect && cam.zoomEffect.isRunning) cam.zoomEffect.reset();
            cam.setZoom(TARGET_ZOOM);
            cam.centerOn(targetX, targetY);
        };
        // 1) settle 開始時点で先にロック（cockpit が透けて canvas が見えても安全）
        lockCloseUpCamera();
        setTimeout(() => {
            if (ck.ls) ck.ls.classList.add('cockpit-fade-out');
            // 2) フェード開始の直前にも再ロック（ship.y やカメラ内部状態の再計算ズレを潰す）
            lockCloseUpCamera();
            setTimeout(() => {
                if (ck.ls) {
                    ck.ls.classList.remove('cockpit-fade-out', 'cockpit-mode');
                    ck.ls.classList.add('hidden');
                }
                if (img) {
                    img.classList.remove('landing-settle');
                    img.style.transform = '';
                }
                // 3) cockpitMode 解除の直前にもう一度ロックし、main update が
                //    走り出した最初のフレームでも close-up を保つ
                lockCloseUpCamera();
                // update.js のラープ/オートズームが寄り絵を上書きしないよう、
                // ハシゴ降下シーンが本格化するまでガードフラグを立てる。
                scene._cockpitJustExited = true;
                // 既存のラダー演出は gameStarted=false 経由で 1 秒後に pan/zoomTo
                // を呼ぶため、それを十分カバーする時間が経ったらフラグを下ろす。
                setTimeout(() => { scene._cockpitJustExited = false; }, 1500);
                // フェード明けで cockpit を抜けるタイミングで環境音を停止
                if (scene.cockpitSound && scene.cockpitSound.isPlaying) {
                    try { scene.cockpitSound.stop(); } catch (e) {}
                }
                scene.cockpitMode = false;
                scene._cockpitExiting = false;
            }, FADE_MS);
        }, SETTLE_MS + HOLD_MS);
    } else {
        // 失敗：モニターのグリッチと爆発を「同時」に発火。グリッチ終了時にモニターを黒に固定。
        // → 爆発完了後 scene.restart で直接ロゴへ
        const monitor = ck.monitor;
        if (monitor) {
            monitor.classList.remove('monitor-glitch', 'monitor-dead');
            // reflow でアニメ再開
            void monitor.offsetWidth;
            monitor.classList.add('monitor-glitch');
        }
        // 爆発と同時にコックピット環境音を停止（爆破でこの音は止まる）
        if (scene.cockpitSound && scene.cockpitSound.isPlaying) {
            try { scene.cockpitSound.stop(); } catch (e) {}
        }
        // グリッチと同フレームで爆発を発火（同時発生）
        playFullscreenExplosion(scene, () => {
            if (monitor) monitor.classList.remove('monitor-glitch', 'monitor-dead');
            if (ck.ls) {
                ck.ls.classList.remove('cockpit-mode');
                ck.ls.classList.add('hidden');
            }
            scene.cockpitMode = false;
            scene._cockpitExiting = false;
            scene.scene.restart();
        });
        // グリッチ終了の瞬間にモニターを黒に固定（爆発進行中に並行で切り替え）
        const GLITCH_MS = 560; // CSS keyframe と同じ
        setTimeout(() => {
            if (monitor) monitor.classList.add('monitor-dead');
        }, GLITCH_MS);
    }
}

// 画面全体爆破：5 個の爆破スプライトをランダム位置・大きさで再生（隙間を埋める）
function playFullscreenExplosion(scene, onComplete) {
    const blast = document.getElementById('cockpit-blast');
    if (!blast) { onComplete(); return; }
    blast.innerHTML = '';
    blast.classList.add('active');
    // 機内を暗転フェード（爆破スプライトより下のレイヤー）
    const lsEl = scene.cockpit && scene.cockpit.ls;
    if (lsEl) lsEl.classList.add('cockpit-fading');
    try { if (scene.explosionSound) scene.explosionSound.play(); } catch (e) {}

    const N = 8;
    const totalFrames = 64;
    const fps = 24;
    const interval = 1000 / fps;
    const COUNT = 5;
    // 1 つ目はモニター中央寄りの大型、残りは画面内ランダム
    const sprites = [];
    for (let i = 0; i < COUNT; i++) {
        const sp = document.createElement('div');
        sp.className = 'blast-sprite';
        const size = 900 + Math.random() * 700; // 900〜1600
        sp.style.width = size + 'px';
        sp.style.height = size + 'px';
        // loading-screen は 1200x800。中心 600,400 から ±400/±300 でランダム
        const offX = (i === 0) ? 0 : (Math.random() * 800 - 400);
        const offY = (i === 0) ? 0 : (Math.random() * 600 - 300);
        sp.style.left = (600 + offX) + 'px';
        sp.style.top = (400 + offY) + 'px';
        // 開始フレームを少しずらす（カスケード感）
        const startDelay = i === 0 ? 0 : Math.floor(Math.random() * 8);
        sprites.push({ el: sp, startDelay, frame: 0, done: false });
        blast.appendChild(sp);
    }

    let tick = 0;
    const id = setInterval(() => {
        tick++;
        let allDone = true;
        for (const s of sprites) {
            if (s.done) continue;
            if (tick < s.startDelay) { allDone = false; continue; }
            s.frame = tick - s.startDelay;
            if (s.frame >= totalFrames) {
                s.done = true;
                s.el.style.display = 'none';
                continue;
            }
            allDone = false;
            const col = s.frame % N;
            const row = Math.floor(s.frame / N);
            const x = (col * 100 / (N - 1)).toFixed(3);
            const y = (row * 100 / (N - 1)).toFixed(3);
            s.el.style.backgroundPosition = x + '% ' + y + '%';
        }
        if (allDone) {
            clearInterval(id);
            blast.classList.remove('active');
            blast.innerHTML = '';
            if (lsEl) lsEl.classList.remove('cockpit-fading');
            onComplete();
        }
    }, interval);
}
