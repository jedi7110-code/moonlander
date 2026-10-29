// プチノイズ防止：Web Audio API の setTargetAtTime で指数関数的なエンベロープ減衰
// 終端に向かって変化速度がゼロに漸近するためクリックが原理的に出ない
// 重要：fade完了後 gain は 0 のまま放置（瞬時ジャンプを作らない）。次回 play 前に復元。
export function fadeStopSound(scene, sound, originalVolume, duration = 250) {
    if (!sound || !sound.isPlaying) return;
    if (sound._fadeActive) return; // 二重フェード防止

    if (sound.volumeNode && sound.manager && sound.manager.context) {
        const ctx = sound.manager.context;
        const gain = sound.volumeNode.gain;
        const t = ctx.currentTime;
        const timeConstant = duration / 5000; // 5τ で gain≈0.7% (約-43dB) まで減衰
        gain.cancelScheduledValues(t);
        gain.setValueAtTime(gain.value, t);
        gain.setTargetAtTime(0, t, timeConstant);
        sound._fadeActive = true;
        sound._fadeTimer = scene.time.delayedCall(duration + 30, () => {
            // この時点で gain は -43dB 以下（実質無音）。stop() しても聴感上クリックなし
            sound.stop();
            sound._fadeActive = false;
            sound._fadeTimer = null;
        });
    } else {
        // フォールバック (HTML5 Audio)
        sound._fadeActive = true;
        sound._fadeTween = scene.tweens.add({
            targets: sound,
            volume: 0,
            duration: duration,
            onComplete: () => {
                sound.stop();
                sound.setVolume(originalVolume);
                sound._fadeActive = false;
                sound._fadeTween = null;
            }
        });
    }
}

// 再生開始：fade中ならキャンセルして短い ramp で復帰、停止中なら gain を復元してから play
export function startSoundCancelFade(sound, originalVolume) {
    if (sound._fadeActive) {
        if (sound._fadeTimer) { sound._fadeTimer.remove(); sound._fadeTimer = null; }
        if (sound._fadeTween) { sound._fadeTween.stop(); sound._fadeTween = null; }
        if (sound.volumeNode && sound.manager) {
            const ctx = sound.manager.context;
            const gain = sound.volumeNode.gain;
            const t = ctx.currentTime;
            gain.cancelScheduledValues(t);
            gain.setValueAtTime(gain.value, t); // 現在値で固定
            gain.linearRampToValueAtTime(originalVolume, t + 0.05); // 50msで復帰
        } else {
            sound.setVolume(originalVolume);
        }
        sound._fadeActive = false;
        return; // 既に Playing 状態なので play() 不要
    }
    if (!sound.isPlaying) {
        // play する前に gain を originalVolume に確実にセット（前回 fade で 0 のままになっている）
        if (sound.volumeNode && sound.manager) {
            const ctx = sound.manager.context;
            sound.volumeNode.gain.cancelScheduledValues(ctx.currentTime);
            sound.volumeNode.gain.setValueAtTime(originalVolume, ctx.currentTime);
        }
        sound.play();
    }
}
