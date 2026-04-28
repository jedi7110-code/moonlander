// アセットロード（Phaser scene の preload フックから呼ぶ）
export function preload(scene) {
// ロード進捗をローディング画面のゲージに反映
const loadingFill = document.querySelector('.loading-gauge-fill');
const loadingScreen = document.getElementById('loading-screen');
scene.load.on('progress', (value) => {
    if (loadingFill) loadingFill.style.width = (value * 100) + '%';
});
scene.load.on('complete', () => {
    if (loadingFill) loadingFill.style.width = '100%';
    if (loadingScreen) {
        // 黒80%オーバーレイを外して明るい状態へフェード → タイトル状態へ
        loadingScreen.classList.add('lit');
        setTimeout(() => loadingScreen.classList.add('title'), 800);
    }
});

scene.load.image('background', 'assets/background.jpg');
scene.load.image('arrow_unit', 'assets/arrow.svg'); // 右向き矢印1個分（左向きは flipX）
scene.load.image('pod', 'assets/pod.png');
scene.load.image('spaceship', 'assets/spaceship.png');
scene.load.image('spacemy', 'assets/spacemy.png');
scene.load.image('spaceman', 'assets/player-f.png');
scene.load.image('spaceman_B', 'assets/player-b.png');
scene.load.image('spaceman_BL', 'assets/player-bl.png');
scene.load.image('spaceman_BR', 'assets/player-br.png');
scene.load.image('spaceman_FL', 'assets/player-fl.png');
scene.load.image('spaceman_FR', 'assets/player-fr.png');
scene.load.image('spaceman_L', 'assets/player-l.png');
scene.load.image('spaceman_R', 'assets/player-r.png');
scene.load.image('player_0', 'assets/player-0.png');
scene.load.image('player_L1', 'assets/player-l1.png');
scene.load.image('player_L2', 'assets/player-l2.png');
scene.load.image('player_R1', 'assets/player-r1.png');
scene.load.image('player_R2', 'assets/player-r2.png');
scene.load.image('flag', 'assets/flag.png');
scene.load.image('flag-flash', 'assets/flag-flash.png');
scene.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 256, frameHeight: 256 });
scene.load.image('title', 'assets/title.png?v=2');
scene.load.audio('goal', 'assets/sound/landing.wav'); // ランディング音
scene.load.audio('explosion', 'assets/sound/explosion.wav'); // 爆発音
scene.load.audio('jet', 'assets/sound/jet.wav'); // ジェット音
scene.load.audio('empty', 'assets/sound/empty.wav'); // エンプティー音
scene.load.audio('end', 'assets/sound/end.wav'); // ミッション失敗音
scene.load.audio('beam', 'assets/sound/beam.wav'); // ビーム発射音
scene.load.audio('beamhit', 'assets/sound/beamhit.wav'); // ビーム命中音
scene.load.audio('beam-tame', 'assets/sound/beam-tame.wav'); // ビームチャージ音
scene.load.audio('blood', 'assets/sound/blood.wav'); // 被弾音
scene.load.audio('dead', 'assets/sound/dead.wav'); // 捕獲時の絶命音
scene.load.audio('hatchopen', 'assets/sound/hatchopen.wav'); // ハッチ開
scene.load.audio('escape-injection', 'assets/sound/escape-injection.wav'); // 脱出点火
scene.load.audio('escape-jet', 'assets/sound/escape-jet.wav'); // 脱出ジェット
scene.load.audio('rescue1', 'assets/sound/rescue-1.wav'); // 仲間出現前のSE
scene.load.audio('rescue2', 'assets/sound/rescue-2.wav'); // 仲間着地時(ランダム)
scene.load.audio('rescue3', 'assets/sound/rescue-3.wav');
scene.load.audio('rescue4', 'assets/sound/rescue-4.wav');
scene.load.audio('climb', 'assets/sound/climb.wav'); // 登れと指示する声
// 地底人 6コマアニメ（全コマ左向き。右向きは flipX で反転）
scene.load.image('alien_1', 'assets/alien-s-1.png');
scene.load.image('alien_2', 'assets/alien-s-2.png');
scene.load.image('alien_3', 'assets/alien-s-3.png');
scene.load.image('alien_4', 'assets/alien-s-4.png');
scene.load.image('alien_5', 'assets/alien-s-5.png');
scene.load.image('alien_6', 'assets/alien-s-6.png');
// 出現時(F=正面)、振り向き用 (FL=左寄り正面 / FR=右寄り正面)
scene.load.image('alien_F', 'assets/alien-s-f.png');
scene.load.image('alien_FL', 'assets/alien-s-fl.png');
scene.load.image('alien_FR', 'assets/alien-s-fr.png');
// 攻撃（捕獲）2コマ。A2 で停止
scene.load.image('alien_A1', 'assets/alien-s-a1.png');
scene.load.image('alien_A2', 'assets/alien-s-a2.png');
// ボス（雑魚と同じ仕組み）
scene.load.image('alienB_L', 'assets/alien-b-l.png');     // 横向き静止
scene.load.image('alienB_F', 'assets/alien-b-f.png');
scene.load.image('alienB_FL', 'assets/alien-b-fl.png');
scene.load.image('alienB_FR', 'assets/alien-b-fr.png');
// 歩行 7 コマ
scene.load.image('alienB_W1', 'assets/alien-b-w1.png');
scene.load.image('alienB_W2', 'assets/alien-b-w2.png');
scene.load.image('alienB_W3', 'assets/alien-b-w3.png');
scene.load.image('alienB_W4', 'assets/alien-b-w4.png');
scene.load.image('alienB_W5', 'assets/alien-b-w5.png');
scene.load.image('alienB_W6', 'assets/alien-b-w6.png');
scene.load.image('alienB_W7', 'assets/alien-b-w7.png');
scene.load.image('alienB_A1', 'assets/alien-b-a1.png');
scene.load.image('alienB_A2', 'assets/alien-b-a2.png');
scene.load.image('alienB_A3', 'assets/alien-b-a3.png');
scene.load.image('alienB_A4', 'assets/alien-b-a4.png');
scene.load.image('alienB_A5', 'assets/alien-b-a5.png');
scene.load.image('alienB_A6', 'assets/alien-b-a6.png');
scene.load.image('alienB_A7', 'assets/alien-b-a7.png');
scene.load.image('mooncar', 'assets/moon-car.png'); // 大破した月面探査車
scene.load.image('crew', 'assets/crew-f.png'); // 救出する仲間（正面）
scene.load.image('crew_0', 'assets/crew-0.png'); // 仲間（横向きアイドル）
scene.load.image('crew_B', 'assets/crew-b.png'); // 仲間（後ろ向き）
scene.load.image('crew_BL', 'assets/crew-bl.png'); // 仲間（左後ろ向き）
scene.load.image('crew_BR', 'assets/crew-br.png'); // 仲間（右後ろ向き）
scene.load.image('crew_FL', 'assets/crew-fl.png'); // 仲間（左斜め前）
scene.load.image('crew_FR', 'assets/crew-fr.png'); // 仲間（右斜め前）
scene.load.image('crew_L', 'assets/crew-l.png'); // 仲間（左向き）
scene.load.image('crew_L1', 'assets/crew-l1.png'); // 仲間（左歩行1）
scene.load.image('crew_L2', 'assets/crew-l2.png'); // 仲間（左歩行2）
scene.load.image('crew_R', 'assets/crew-r.png'); // 仲間（右向き）
scene.load.image('crew_R1', 'assets/crew-r1.png'); // 仲間（右歩行1）
scene.load.image('crew_R2', 'assets/crew-r2.png'); // 仲間（右歩行2）
scene.load.image('boss_L', 'assets/boss-l.png'); // ボス（左向き）
scene.load.image('boss_R', 'assets/boss-r.png'); // ボス（右向き）
scene.load.spritesheet('blood', 'assets/blood-p.png', { frameWidth: 512, frameHeight: 512 }); // 被弾エフェクト
scene.load.spritesheet('bloodAlien', 'assets/blood-a.png', { frameWidth: 512, frameHeight: 512 }); // エイリアン撃破エフェクト
for (let i = 1; i <= 5; i++) {
    scene.load.audio(`footsteps${i}`, `assets/sound/footsteps${i}.wav`);
}

for (let i = 1; i <= 15; i++) {
    const paddedIndex = i.toString().padStart(2, '0');
    scene.load.image(`debris${i}`, `assets/debris${paddedIndex}.png`); //デブリ
}
}
