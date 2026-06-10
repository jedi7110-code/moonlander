// 爆発演出 + シーン restart。scene.jetSound 停止と scene.gameStarted リセットを内包。
// 再生中フラグは scene プロパティ（create で毎回リセット）。モジュール変数にすると
// 爆発完了前に別経路の restart が走った場合に true のまま固着し、以後 gameOver が無効になる

export function gameOver(scene, message) {
    // 爆発時にjet音を停止
    if (scene.jetSound && scene.jetSound.isPlaying) {
        scene.jetSound.stop();
    }

    if (!scene._explosionPlaying) {
        scene._explosionPlaying = true;

        // 爆発アニメーションを作成して再生
        const explosion = scene.add.sprite(scene.spaceship.x, scene.spaceship.y, 'explosion');
        explosion.setDepth(10);
        explosion.play('explode');

        // 爆発音を再生
        scene.explosionSound.play();

        // ジェット噴射・粉塵パーティクルを停止
        scene.jetParticles.up.on = false;
        if (scene.jetParticles.downLeft) scene.jetParticles.downLeft.on = false;
        if (scene.jetParticles.downRight) scene.jetParticles.downRight.on = false;
        scene.jetParticles.left.on = false;
        scene.jetParticles.right.on = false;
        scene.dustEmitters.forEach(e => e.on = false);

        // 宇宙船・影・ゲージを非表示にする
        scene.spaceship.setVisible(false);
        scene.spaceshipShadow.setVisible(false);
        if (scene.spaceshipShadowGround) scene.spaceshipShadowGround.setVisible(false);
        scene.fuelGaugeBorder.setVisible(false);
        scene.fuelGauge.setVisible(false);
        // コックピット視点ヒント（DOM オーバーレイ）を即座に消す
        const hintEl = document.getElementById('cockpit-hint');
        if (hintEl) hintEl.classList.remove('show');

        explosion.on('animationcomplete', () => {
            scene._explosionPlaying = false;
            explosion.destroy();
        });

        // タイマーは scene.time に紐付け、restart 時に自動破棄されるようにする
        // （raw setTimeout だと restart 後の新しい周回に発火して二重 restart になる）
        // ゲームオーバーメッセージ（messageが空ならテキスト表示なし）
        if (message) {
            scene.time.delayedCall(1000, () => {
                const failKeyMap = {
                    'Mission Failed': 'label_missionfailed',
                    'Rescue Failed': 'label_rescuefailed'
                };
                const failKey = failKeyMap[message] || 'label_missionfailed';
                scene.add.image(scene.spaceship.x, scene.spaceship.y - 50, failKey).setOrigin(0.5, 0.5).setDepth(11).setScale((scene._labelDisplayScale || 0.25) * 1.6);
            });
        }

        scene.gameStarted = false; // 操作無効化

        // 爆発演出が終わってからスタート位置（待機画面）へ復帰
        scene.time.delayedCall(3000, () => {
            scene.scene.restart();
        });

        // 爆発時にエンプティー音を停止
        if (scene.emptySound.isPlaying) {
            scene.emptySound.stop();
        }
    }
}
