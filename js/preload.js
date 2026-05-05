// ミッションブリーフィング（タイトル後にターミナル風タイピング表示）
// onDismiss: ENTER で抜けた時に呼ばれるコールバック
// scene: Phaser scene（command/comstart 音を Phaser sound 経由で再生するため必要）
export function startBriefing(loadingScreen, onDismiss, scene) {
    // ENTER 連打で多重起動するのを防ぐガード
    if (loadingScreen._briefingStarted) return;
    loadingScreen._briefingStarted = true;
    const briefingEl = loadingScreen.querySelector('.briefing-screen');
    const textEl = loadingScreen.querySelector('.briefing-text');
    const titleScreen = loadingScreen.querySelector('.title-screen');
    if (!briefingEl || !textEl) {
        if (onDismiss) onDismiss();
        return;
    }
    // タイトル表示中なら、まずロゴを中心に潰れて消える演出を再生
    if (titleScreen && loadingScreen.classList.contains('title')) {
        const TITLE_OFF_MS = 500;
        titleScreen.classList.add('off');
        setTimeout(() => {
            titleScreen.classList.remove('off');
            run();
        }, TITLE_OFF_MS);
        return;
    }
    run();

    function run() {
    loadingScreen.classList.remove('title');
    loadingScreen.classList.add('briefing');
    textEl.textContent = '';
    briefingEl.classList.remove('done');

    const texts = {
        E: [
            '> SECURE LINK ESTABLISHED',
            '> SIGNAL: UAC-7710-A3',
            '> AUTH: PAX',
            '> FROM: PERCIVAL',
            '> TO:   BARRAMUNDI',
            '',
            'CLASSIFIED MEMO TO LANDER COMMANDER:',
            '',
            'UNKNOWN ARTIFACT DETECTED ON LUNAR SURFACE.',
            'SCIENCE TEAM SENT FOR INVESTIGATION.',
            'ALL CONTACT LOST 47 HOURS AGO.',
            '',
            'MISSION OBJECTIVES:',
            '- PERFORM A SOFT LANDING ON THE MARKED ZONE',
            '- LOCATE AND RETRIEVE SURVIVING CREW',
            '- NEUTRALIZE HOSTILE ENTITIES IF ENGAGED',
            '- RETURN TO ORBIT BEFORE ENERGY DEPLETION',
            '',
            'WARNING: SUBSURFACE BIO-SIGNATURES DETECTED.',
            'ASSUME ALL CONTACT IS HOSTILE.',
            '',
            'GOOD LUCK, COMMANDER.'
        ].join('\n'),
        J: [
            '> セキュアリンク確立',
            '> シグナル：UAC-7710-A3',
            '> 認証：PAX',
            '> 発信：パーシヴァル',
            '> 宛先：バラマンディ号',
            '',
            '機密通信 着陸船指揮官へ：',
            '',
            '月面にて未確認の遺物を検出。',
            '調査のため科学チームを派遣したが、47時間前に全通信が途絶した。',
            '',
            '作戦目標：',
            '・指定ゾーンへポッドを軟着陸（ソフトランディング）させよ',
            '・生存しているクルーを捜索、および回収せよ',
            '・交戦時には、敵対存在を排除せよ',
            '・エネルギーが尽きる前に軌道上へ帰還せよ',
            '',
            '警告：地表下に生体反応を検知。',
            '接触するものはすべて敵対存在と見なせ。',
            '',
            '武運を祈る、指揮官。'
        ].join('\n')
    };
    let text = texts.E;

    // タイピング中はコマンド音を行ごとに再生＋開始SE（単発、小音量）
    // iOS のサイレントスイッチ尊重のため Phaser sound（WebAudio）に統一
    const COMMAND_VOL = 0.2;
    const START_VOL = 0.15;
    const commandSound = scene && scene.sound ? scene.sound.add('command', { loop: false, volume: COMMAND_VOL }) : null;
    const startSound   = scene && scene.sound ? scene.sound.add('comstart', { loop: false, volume: START_VOL }) : null;

    let commandFadeTween = null;
    function fadeOutCommand(ms = 120) {
        try {
            if (!commandSound || !commandSound.isPlaying) return;
            if (commandFadeTween) return;
            commandFadeTween = scene.tweens.add({
                targets: commandSound,
                volume: 0,
                duration: ms,
                onComplete: () => {
                    try { commandSound.stop(); commandSound.setVolume(COMMAND_VOL); } catch (e) {}
                    commandFadeTween = null;
                }
            });
        } catch (e) { /* 音声不能でもタイピングは続行 */ }
    }
    function startCommand() {
        try {
            if (!commandSound) return;
            if (commandFadeTween) { commandFadeTween.stop(); commandFadeTween = null; }
            try { commandSound.stop(); } catch (e) {}
            try { commandSound.setVolume(0); } catch (e) {}
            try { commandSound.play(); } catch (e) {}
            // ポップノイズ対策：0からクイックフェードイン
            scene.tweens.add({ targets: commandSound, volume: COMMAND_VOL, duration: 40 });
        } catch (e) { /* 音声不能でもタイピングは続行 */ }
    }

    let startFadeTween = null;
    function fadeOutStart(ms) {
        try {
            if (!startSound || !startSound.isPlaying) return;
            if (startFadeTween) return;
            startFadeTween = scene.tweens.add({
                targets: startSound,
                volume: 0,
                duration: ms,
                onComplete: () => {
                    try { startSound.stop(); startSound.setVolume(START_VOL); } catch (e) {}
                    startFadeTween = null;
                }
            });
        } catch (e) {}
    }
    try {
        if (startSound) {
            try { startSound.play(); } catch (e) {}
            if (scene && scene.time) {
                scene.time.delayedCall(Math.max(0, ((startSound.duration || 1.2) - 0.6) * 1000), () => {
                    if (startSound.isPlaying) fadeOutStart(600);
                });
            }
        }
    } catch (e) {}

    let i = 0;
    let timer = null;
    let prevWasNewline = true; // 行頭判定（最初の文字も「行頭」扱いで再生開始）
    let currentLang = 'E';
    function step() {
        if (i < text.length) {
            const ch = text[i++];
            textEl.textContent += ch;
            // 古い行は自動的に上にスクロールアウト
            textEl.scrollTop = textEl.scrollHeight;
            if (ch === '\n') {
                // 改行：ブツ切りノイズを避けるためフェードアウトで停止
                fadeOutCommand(120);
                prevWasNewline = true;
            } else if (prevWasNewline) {
                // 行頭：command音を頭から再生し直す
                startCommand();
                prevWasNewline = false;
            }
            const delay = (ch === '\n') ? 60 : 20;
            timer = setTimeout(step, delay);
        } else {
            briefingEl.classList.add('done');
            fadeOutCommand(120);
            // com-start.wav はタイピング完了後も鳴り続ける（ゲーム開始時にフェードで止める）
        }
    }
    function restartTyping(lang) {
        currentLang = lang;
        text = texts[lang];
        if (timer) { clearTimeout(timer); timer = null; }
        textEl.textContent = '';
        textEl.scrollTop = 0;
        briefingEl.classList.remove('done');
        i = 0;
        prevWasNewline = true;
        // 進行中のフェードがあればキャンセルして即停止
        if (commandFadeTween) { commandFadeTween.stop(); commandFadeTween = null; }
        if (commandSound) { try { commandSound.stop(); commandSound.setVolume(COMMAND_VOL); } catch (e) {} }
        // 進行中のフェードがあればキャンセルしてリセット
        if (startFadeTween) { startFadeTween.stop(); startFadeTween = null; }
        if (startSound) {
            try { startSound.stop(); startSound.setVolume(START_VOL); startSound.play(); } catch (e) {}
        }
        step();
    }
    step();

    // ブリーフィング画面の左下 [J/E] と右下 [PRESS ENTER] のクリックでも操作可能
    const langEl = loadingScreen.querySelector('.briefing-lang');
    const skipEl = loadingScreen.querySelector('.briefing-skip');
    if (langEl && !langEl._wired) {
        langEl._wired = true;
        langEl.style.pointerEvents = 'auto';
        langEl.style.cursor = 'pointer';
        langEl.addEventListener('click', (e) => {
            e.stopPropagation();
            restartTyping(currentLang === 'E' ? 'J' : 'E');
        });
    }
    if (skipEl && !skipEl._wired) {
        skipEl._wired = true;
        skipEl.style.pointerEvents = 'auto';
        skipEl.style.cursor = 'pointer';
        skipEl.addEventListener('click', (e) => {
            e.stopPropagation();
            advance();
        });
    }

    let advanced = false;
    function advance() {
        if (advanced) return;
        advanced = true;
        if (timer) { clearTimeout(timer); timer = null; }
        document.removeEventListener('keydown', onKey);
        // タイピング音をフェードアウト、開始SEは0.6秒でフェードアウト
        fadeOutCommand(150);
        fadeOutStart(600);
        // 同じENTER押下でゲーム開始まで進まないよう短時間ガードを立てる
        loadingScreen._briefingDismissedAt = Date.now();
        // briefing クラスは startGame の黒フェード完了で loading-screen ごと消えるまで保持
        // （途中で外すと .loading-frame が一瞬表示される）
        if (onDismiss) onDismiss();
    }
    function onKey(e) {
        if (e.code === 'Enter') {
            advance();
        } else if (e.code === 'KeyJ') {
            restartTyping('J');
        } else if (e.code === 'KeyE') {
            restartTyping('E');
        } else if (e.code === 'ArrowUp') {
            e.preventDefault();
            textEl.scrollTop -= 24;
        } else if (e.code === 'ArrowDown') {
            e.preventDefault();
            textEl.scrollTop += 24;
        }
    }
    document.addEventListener('keydown', onKey);
    }
}

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
        loadingScreen.classList.add('lit');
        setTimeout(() => loadingScreen.classList.add('title'), 800);
    }
});

scene.load.image('background', 'assets/background.jpg');
scene.load.image('arrow_unit', 'assets/arrow.svg?v=2'); // 右向き矢印1個分（左向きは flipX）
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
scene.load.image('flag', 'assets/flag.webp');
scene.load.image('flag-flash', 'assets/flag-flash.webp');
scene.load.image('landPointG', 'assets/land-point.jpg'); // 着陸時のコックピットモニター映像（俯瞰、4:3 = 1120x840）
scene.load.image('cockpitTitle', 'assets/opening-title.webp'); // コックピット内装（モニター周囲）
scene.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 256, frameHeight: 256 });
scene.load.image('title', 'assets/title.png?v=2');
scene.load.audio('command', 'assets/sound/command.wav'); // ブリーフィングのタイピング音
scene.load.audio('comstart', 'assets/sound/com-start.wav'); // ブリーフィング開始SE
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
