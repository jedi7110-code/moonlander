// ハシゴをスムーズなトントンで登り降りさせる（ワープせず、短いtweenを連鎖）
// midOffset: 中間ステップだけYに足すオフセット。最終着地位置は変えない（足がステップに乗るよう微調整）
export function steppedClimb(scene, target, finalY, steps, stepDuration, pauseDuration, onComplete, midOffset = 0) {
    const startY = target.y;
    const stepDist = (finalY - startY) / steps;
    let currentStep = 0;
    const doStep = () => {
        if (currentStep >= steps) { if (onComplete) onComplete(); return; }
        currentStep++;
        const isLast = currentStep === steps;
        scene.tweens.add({
            targets: target,
            y: startY + stepDist * currentStep + (isLast ? 0 : midOffset),
            duration: stepDuration,
            ease: 'Sine.easeOut',
            onComplete: () => {
                if (pauseDuration > 0) scene.time.delayedCall(pauseDuration, doStep);
                else doStep();
            }
        });
    };
    doStep();
}

// 溶かされた人の緑のシミ（捕獲沈下後に影の替わりに広がる）
// 月面のシミなので、歩き回るキャラ（敵 depth 8、仲間 7、月面車 6）の全てより下に置く
// 形・サイズはランダム。複数のランダムな楕円が重なって有機的な形を作る。
export function spawnDissolveStain(scene, x, footY) {
    const g = scene.add.graphics();
    const blobCount = Phaser.Math.Between(3, 6);
    const colors = [0x33dd33, 0x66ee66, 0x88ee55, 0xaaff77];
    for (let i = 0; i < blobCount; i++) {
        const c = Phaser.Math.RND.pick(colors);
        const alpha = Phaser.Math.FloatBetween(0.25, 0.55);
        g.fillStyle(c, alpha);
        // 横長の楕円。中心からランダムにずらして重ねる。
        const w = Phaser.Math.Between(6, 18);
        const h = w * Phaser.Math.FloatBetween(0.25, 0.4);
        const ox = Phaser.Math.Between(-7, 7);
        const oy = Phaser.Math.Between(-2, 2);
        g.fillEllipse(ox, oy, w, h);
    }
    g.x = x;
    g.y = footY + 1;
    g.setDepth(4); // 月面背景より上、月面車・キャラの全てより下
    // インスタンスごとのランダム最大サイズ（0.5〜1.0、現状を1.0=最大とする）
    const maxScale = Phaser.Math.FloatBetween(0.5, 1.0);
    g.setScale(maxScale * 0.2); // 小さく開始
    scene.tweens.add({ targets: g, scaleX: maxScale, scaleY: maxScale, duration: 1800, ease: 'Sine.easeOut' });
    return g;
}

// 地上キャラクターの影（多層楕円で疑似ブラー）。深度 6.5 (moon car 6 と crews 7 の間)
export function createGroundShadow(scene, x, footY, width, heightBoost = 0) {
    const g = scene.add.graphics();
    // 外側ほど薄く広く（ぼかし表現）
    g.fillStyle(0x000000, 0.04);
    g.fillEllipse(0, 0, width * 1.5, 4.5 + heightBoost);
    g.fillStyle(0x000000, 0.06);
    g.fillEllipse(0, 0, width * 1.2, 3.6 + heightBoost);
    g.fillStyle(0x000000, 0.08);
    g.fillEllipse(0, 0, width, 3 + heightBoost);
    g.x = x;
    g.y = footY;
    g.setDepth(6.5);
    return g;
}
