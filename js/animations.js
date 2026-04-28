// アニメーション登録（create() 内で scene 引数を渡して呼ぶ）
export function registerAnimations(scene) {
// 爆発アニメーションの作成
scene.anims.create({
    key: 'explode',
    frames: scene.anims.generateFrameNumbers('explosion', { start: 0, end: 64 }),
    frameRate: 24,
    repeat: 0,
    onUpdate: function (anim, frame, gameObject) {
        if (frame.prevFrame !== null) {
            gameObject.setTexture(frame.texture.key, frame.prevFrame.textureSourceIndex);
        }
    },
    onComplete: function (anim, frame, gameObject) {
        gameObject.destroy();
    }
});

// 被弾（血飛沫）アニメーションの作成
scene.anims.create({
    key: 'bloodSplat',
    frames: scene.anims.generateFrameNumbers('blood', { start: 0, end: 5 }),
    frameRate: 14,
    repeat: 0,
    hideOnComplete: true
});
// エイリアン撃破（緑血）アニメーション
scene.anims.create({
    key: 'bloodAlienSplat',
    frames: scene.anims.generateFrameNumbers('bloodAlien', { start: 0, end: 5 }),
    frameRate: 14,
    repeat: 0,
    hideOnComplete: true
});

// 宇宙飛行士の振り向きアニメーション
// ハシゴ降下後（左向き）: 後ろ → BL → L → FL → 正面
scene.anims.create({
    key: 'astronaut_turn_to_front_L',
    frames: [
        { key: 'spaceman_B' },
        { key: 'spaceman_BL' },
        { key: 'spaceman_L' },
        { key: 'spaceman_FL' },
        { key: 'spaceman' }
    ],
    frameRate: 12,
    repeat: 0
});
// ハシゴ降下後（右向き）: 後ろ → BR → R → FR → 正面
scene.anims.create({
    key: 'astronaut_turn_to_front_R',
    frames: [
        { key: 'spaceman_B' },
        { key: 'spaceman_BR' },
        { key: 'spaceman_R' },
        { key: 'spaceman_FR' },
        { key: 'spaceman' }
    ],
    frameRate: 12,
    repeat: 0
});
// ハシゴ登る前（左向き経由）: 正面 → FL → L → BL → 後ろ
scene.anims.create({
    key: 'astronaut_turn_to_back_L',
    frames: [
        { key: 'spaceman' },
        { key: 'spaceman_FL' },
        { key: 'spaceman_L' },
        { key: 'spaceman_BL' },
        { key: 'spaceman_B' }
    ],
    frameRate: 12,
    repeat: 0
});
// ハシゴ登る前（右向き経由）: 正面 → FR → R → BR → 後ろ
scene.anims.create({
    key: 'astronaut_turn_to_back_R',
    frames: [
        { key: 'spaceman' },
        { key: 'spaceman_FR' },
        { key: 'spaceman_R' },
        { key: 'spaceman_BR' },
        { key: 'spaceman_B' }
    ],
    frameRate: 12,
    repeat: 0
});

// 正面 → 横向きへの切替アニメ（FL/FR を挟む）
scene.anims.create({
    key: 'astronaut_turn_front_to_L',
    frames: [
        { key: 'spaceman' },
        { key: 'spaceman_FL' },
        { key: 'spaceman_L' }
    ],
    frameRate: 14,
    repeat: 0
});
scene.anims.create({
    key: 'astronaut_turn_front_to_R',
    frames: [
        { key: 'spaceman' },
        { key: 'spaceman_FR' },
        { key: 'spaceman_R' }
    ],
    frameRate: 14,
    repeat: 0
});

// 横移動中の左右切替アニメ（F を挟まず軽めに）
// L → R: FL → FR
scene.anims.create({
    key: 'astronaut_turn_flip_LtoR',
    frames: [
        { key: 'spaceman_FL' },
        { key: 'spaceman_FR' }
    ],
    frameRate: 18,
    repeat: 0
});
// R → L: FR → FL
scene.anims.create({
    key: 'astronaut_turn_flip_RtoL',
    frames: [
        { key: 'spaceman_FR' },
        { key: 'spaceman_FL' }
    ],
    frameRate: 18,
    repeat: 0
});

// 宇宙飛行士の歩行アニメーション（左向き基準。右向きは flipX で反転）
// 順序: 0 → L1 → L2 → L1 → 0 → R1 → R2 → R1 の繰り返し（8フレーム）
scene.anims.create({
    key: 'astronaut_walk',
    frames: [
        { key: 'player_0' },
        { key: 'player_L1' },
        { key: 'player_L2' },
        { key: 'player_L1' },
        { key: 'player_0' },
        { key: 'player_R1' },
        { key: 'player_R2' },
        { key: 'player_R1' }
    ],
    frameRate: 14,
    repeat: -1
});

// 地底人の歩行アニメ（6コマ・ループ）
scene.anims.create({
    key: 'alien_walk',
    frames: [
        { key: 'alien_1' },
        { key: 'alien_2' },
        { key: 'alien_3' },
        { key: 'alien_4' },
        { key: 'alien_5' },
        { key: 'alien_6' }
    ],
    frameRate: 8,
    repeat: -1
});
// 振り向きアニメ（FL/FR は絶対向きなので flipX しない）
scene.anims.create({
    key: 'alien_turn_LtoR',
    frames: [{ key: 'alien_FL' }, { key: 'alien_FR' }],
    frameRate: 14,
    repeat: 0
});
scene.anims.create({
    key: 'alien_turn_RtoL',
    frames: [{ key: 'alien_FR' }, { key: 'alien_FL' }],
    frameRate: 14,
    repeat: 0
});
// 出現直後のトランジション（F → FL / FR、ワンショット）
scene.anims.create({
    key: 'alien_emerge_L',
    frames: [{ key: 'alien_F' }, { key: 'alien_FL' }],
    frameRate: 8,
    repeat: 0
});
scene.anims.create({
    key: 'alien_emerge_R',
    frames: [{ key: 'alien_F' }, { key: 'alien_FR' }],
    frameRate: 8,
    repeat: 0
});
// 攻撃（捕獲）：A1 → A2、A2 で停止（元画像は左向き、右向きは flipX）
scene.anims.create({
    key: 'alien_attack',
    frames: [{ key: 'alien_A1' }, { key: 'alien_A2' }],
    frameRate: 10,
    repeat: 0
});
// ----- ボス用アニメ（雑魚と同形状）-----
scene.anims.create({
    key: 'bossAlien_walk',
    frames: [
        { key: 'alienB_W1' }, { key: 'alienB_W2' }, { key: 'alienB_W3' },
        { key: 'alienB_W4' }, { key: 'alienB_W5' }, { key: 'alienB_W6' },
        { key: 'alienB_W7' }
    ],
    frameRate: 8,
    repeat: -1
});
scene.anims.create({
    key: 'bossAlien_emerge_L',
    frames: [{ key: 'alienB_F' }, { key: 'alienB_FL' }],
    frameRate: 8,
    repeat: 0
});
scene.anims.create({
    key: 'bossAlien_emerge_R',
    frames: [{ key: 'alienB_F' }, { key: 'alienB_FR' }],
    frameRate: 8,
    repeat: 0
});
scene.anims.create({
    key: 'bossAlien_turn_LtoR',
    frames: [{ key: 'alienB_FL' }, { key: 'alienB_FR' }],
    frameRate: 14,
    repeat: 0
});
scene.anims.create({
    key: 'bossAlien_turn_RtoL',
    frames: [{ key: 'alienB_FR' }, { key: 'alienB_FL' }],
    frameRate: 14,
    repeat: 0
});
// ボスの攻撃（捕獲）：A1 → A7、A7 で停止
scene.anims.create({
    key: 'bossAlien_attack',
    frames: [
        { key: 'alienB_A1' }, { key: 'alienB_A2' }, { key: 'alienB_A3' },
        { key: 'alienB_A4' }, { key: 'alienB_A5' }, { key: 'alienB_A6' },
        { key: 'alienB_A7' }
    ],
    frameRate: 8,
    repeat: 0
});

// ----- 仲間（crew）のアニメーション群（プレイヤーと同形状）-----
// 仲間用ベース：crew には純粋な「後ろ向き」テクスチャがないため
// ハシゴ登り時の後ろ向きには crew_BL / crew_BR を流用する
scene.anims.create({
    key: 'crew_walk',
    frames: [
        { key: 'crew_0' },
        { key: 'crew_L1' },
        { key: 'crew_L2' },
        { key: 'crew_L1' },
        { key: 'crew_0' },
        { key: 'crew_R1' },
        { key: 'crew_R2' },
        { key: 'crew_R1' }
    ],
    frameRate: 14,
    repeat: -1
});
scene.anims.create({
    key: 'crew_turn_to_front_L',
    frames: [
        { key: 'crew_B' },
        { key: 'crew_BL' },
        { key: 'crew_L' },
        { key: 'crew_FL' },
        { key: 'crew' }
    ],
    frameRate: 12,
    repeat: 0
});
scene.anims.create({
    key: 'crew_turn_to_front_R',
    frames: [
        { key: 'crew_B' },
        { key: 'crew_BR' },
        { key: 'crew_R' },
        { key: 'crew_FR' },
        { key: 'crew' }
    ],
    frameRate: 12,
    repeat: 0
});
scene.anims.create({
    key: 'crew_turn_to_back_L',
    frames: [
        { key: 'crew' },
        { key: 'crew_FL' },
        { key: 'crew_L' },
        { key: 'crew_BL' },
        { key: 'crew_B' }
    ],
    frameRate: 12,
    repeat: 0
});
scene.anims.create({
    key: 'crew_turn_to_back_R',
    frames: [
        { key: 'crew' },
        { key: 'crew_FR' },
        { key: 'crew_R' },
        { key: 'crew_BR' },
        { key: 'crew_B' }
    ],
    frameRate: 12,
    repeat: 0
});
scene.anims.create({
    key: 'crew_turn_flip_LtoR',
    frames: [
        { key: 'crew_FL' },
        { key: 'crew_FR' }
    ],
    frameRate: 18,
    repeat: 0
});
scene.anims.create({
    key: 'crew_turn_flip_RtoL',
    frames: [
        { key: 'crew_FR' },
        { key: 'crew_FL' }
    ],
    frameRate: 18,
    repeat: 0
});
}
