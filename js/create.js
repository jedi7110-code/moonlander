// Phaser scene の create フック本体。
import { generateLabels, SVG_SCALE } from './ui-text.js';
import { attachUiGuide } from './ui-guide.js?v=2';
import { registerAnimations } from './animations.js';
import { createCockpitObjects } from './cockpit.js?v=90';

export function create(scene) {
// Helvetica はシステムフォントなので待機不要
generateLabels(scene);
// 4x で描画したビットマップを 1/4 で表示するためのスケール
scene._labelDisplayScale = 1 / SVG_SCALE;

attachUiGuide(scene);
scene.currentMarkerColor = 0x00ff00;
scene.astronautMode = false;
scene.gameStarted = false; // showTitle → ENTER で true に
// playthroughCount は scene.scene.restart() を跨いで保持（Phaser は同じ scene インスタンスを再利用）
if (scene.playthroughCount === undefined) scene.playthroughCount = 0;

// 2週目以降に前回の状態が残らないよう、リスタート時に必ず初期化
scene.astronaut = null;
scene.moonCar = null;
scene.playerClimbing = false;
scene.enemiesRetreating = false;
scene.cameraRising = false;
scene.returningToShip = false;
scene.crewFound = false;
scene.crewFollowing = false;
scene.crews = [];
scene.enemies = [];
scene.lasers = [];
scene.astronautGameOver = false;
scene.chargedFired = false;
scene.beamHoldStart = null;
scene.beamEnergy = 100;
scene.chargeAllowed = false; // 押下時のエネルギーで判定（>=50でtrue）
scene.astronautFacing = null;
scene.astronautVY = 0;
scene.astronautVX = 0;
scene.escapeJetSound = null;

// キーボード入力の設定
const enterKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

scene.add.image(0, 0, 'background').setOrigin(0, 0);

// 背景画像の幅と高さを取得
const backgroundImage = scene.textures.get('background').getSourceImage();
const imageWidth = backgroundImage.width;
const imageHeight = backgroundImage.height;

// シーンの幅と高さを取得
const sceneWidth = scene.scale.width;
const sceneHeight = scene.scale.height;

// 背景画像をシーンの中心に配置
scene.add.image(sceneWidth / 2, sceneHeight / 2, 'background').setDisplaySize(imageWidth, imageHeight);
// 宇宙船の移動範囲を拡張（背景・ゴール位置はそのまま、カメラは自由追従）
scene.physics.world.setBounds(-800, -500, 3000, 1400);
scene.physics.world.gravity.y = 0; // 全体の重力値を設定
scene.fuel = 250; // 燃料の最大値を設定

// デブリの設定
scene.debrisGroup = scene.physics.add.group();
for (let i = 0; i < Phaser.Math.Between(5, 10); i++) { // デブリのランダム数
    const debrisIndex = Phaser.Math.Between(1, 15); // デブリの表示画像数
    const debris = scene.physics.add.sprite(
        Phaser.Math.Between(0, 2000), // デブリの表示位置の X 座標を 0 から 1400 の範囲に変更
        Phaser.Math.Between(scene.cameras.main.height * 1.5 / 5, scene.cameras.main.height * 4 / 5), // デブリの表示位置
        `debris${debrisIndex}`
    );

    const originalWidth = debris.width;
    const originalHeight = debris.height;
    const newWidth = Phaser.Math.Between(20, 40); //デブリのランダムサイズ
    const newHeight = (newWidth * originalHeight) / originalWidth;

    debris.setDisplaySize(newWidth, newHeight);
    debris.setData('speed', Phaser.Math.FloatBetween(-235, 235)); // デブリの左右のスピードをランダム設定
    debris.setData('rotationSpeed', Phaser.Math.FloatBetween(-5, 5)); // デブリの左右の回転を設定

    scene.debrisGroup.add(debris);
}

// 燃料ゲージの枠を作成（縦型、宇宙船に追従）
scene.fuelGaugeBorder = scene.add.graphics({ lineStyle: { width: 2, color: 0xFFFFFF }, fillStyle: { color: 0xFFFFFF } });
scene.fuelGaugeBorder.strokeRect(0, 0, 8, 50);
scene.fuelGaugeBorder.setDepth(9);
scene.fuelGaugeBorder.setAlpha(0);
scene.fuelGaugeBorder.setScale(0);

// 燃料ゲージを作成（縦型、宇宙船に追従）
scene.fuelGauge = scene.add.graphics({ fillStyle: { color: 0xaf3035 } });
scene.fuelGauge.fillRect(1, 1, 6, 48);
scene.fuelGauge.setDepth(9);
scene.fuelGauge.setAlpha(0);
scene.fuelGauge.setScale(0);


// 着陸台ビジュアルのサイズ（俯瞰イメージ）
const PAD_DISPLAY_WIDTH = 120;
const PAD_DISPLAY_HEIGHT = 96;
// 画像内のパッド上面（楕円の着陸面）の位置 — 画像下端から測ったオフセット
const PAD_SURFACE_OFFSET_FROM_BOTTOM = 57;
// 月面と着陸面の段差
const PAD_SURFACE_STEP = 22;

// 月面のグランドレベル
const groundLineY = scene.game.config.height - 63;
// 着陸台の上面（ロケットが着地する高さ）
const padSurfaceY = groundLineY - PAD_SURFACE_STEP;
// 画像の楕円着陸面が padSurfaceY と一致するよう、台座画像を下げて配置
// （台座は月面に半分埋まったような俯瞰表現になる）
// PAD_IMAGE_VISUAL_LIFT は画像だけ更に上に持ち上げる量（着陸判定は変更しない）
const PAD_IMAGE_VISUAL_LIFT = 7;
const flagBottomY = padSurfaceY + PAD_SURFACE_OFFSET_FROM_BOTTOM - PAD_IMAGE_VISUAL_LIFT;

// 着陸エリアのスプライトを作成（当たり判定用、描画は別スプライトへ）
// scene.moon は着陸台の上面を基準にした衝突判定用の不可視スプライト
// scene.moon.y + displayHeight/2 = padSurfaceY となるように配置
scene.moon = scene.add.sprite(Phaser.Math.Between(100, scene.game.config.width - 100), padSurfaceY - 35, 'flag');
scene.physics.add.existing(scene.moon, true);
scene.moon.body.allowGravity = false;
scene.moon.displayWidth = 80;
scene.moon.displayHeight = 70;
scene.moon.body.setSize(30, 5, false).setOffset(0, scene.moon.displayHeight - 5 + 5);
scene.moon.setVisible(false);

// 着陸台の見た目（持ち上げた位置に bottom-center 基準で配置）
scene.flagVisual = scene.add.image(scene.moon.x, flagBottomY, 'flag');
scene.flagVisual.setOrigin(0.5, 1);
scene.flagVisual.setDisplaySize(PAD_DISPLAY_WIDTH, PAD_DISPLAY_HEIGHT);

// 点滅エフェクト（同位置・同サイズで重ね、ふんわりON/OFF）
scene.flagFlash = scene.add.image(scene.moon.x, flagBottomY, 'flag-flash');
scene.flagFlash.setOrigin(0.5, 1);
scene.flagFlash.setDisplaySize(PAD_DISPLAY_WIDTH, PAD_DISPLAY_HEIGHT);
scene.flagFlash.setDepth(scene.flagVisual.depth + 1);
scene.flagFlash.setAlpha(0);
scene.tweens.add({
    targets: scene.flagFlash,
    alpha: 1,
    duration: 900,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1
});

// ゴール地面の的（楕円＋十字線）を着陸台の上面中央に配置して点滅させる
scene.markerX = scene.moon.x;
scene.markerY = padSurfaceY + 2;
scene.landingMarker = scene.add.graphics();
scene.drawLandingMarker(0x00ff00);
scene.tweens.add({
    targets: scene.landingMarker,
    alpha: 0.2,
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
});

// 宇宙船のスプライトを作成（タイトル中は画面外・上空の母艦付近で待機）
const spaceshipTexture = 'spaceship';
scene.spaceship = scene.physics.add.sprite(scene.game.config.width / 2, -280, spaceshipTexture);
scene.spaceship.setCollideWorldBounds(true); // 画面外に出ないように設定
scene.spaceship.setDrag(0); // 慣性の設定
scene.spaceship.setAngularDrag(8); // 慣性の設定
scene.spaceship.setMaxVelocity(100000); // 最大速度の設定
scene.spaceship.setGravityY(80);
scene.spaceship.displayWidth = 50;
scene.spaceship.displayHeight = 50;
scene.spaceship.setDepth(5); // 脱出ポッドより手前に
const bodyRadius = Math.floor(scene.spaceship.width / 3);
scene.spaceship.body.setCircle(bodyRadius);
scene.spaceship.body.setOffset(scene.spaceship.width / 2 - bodyRadius, scene.spaceship.height / 2 - bodyRadius);
scene.spaceship.defaultTextureName = 'spaceship';

// 着陸の影を作成（Graphics で 5 段階の多重楕円ソフトシャドウを描く）
// ベース横幅 110 で描き、setScale で実サイズに合わせる
// パッドの上に乗っている部分はパッド上面、はみ出した部分は月面に落ちるよう
// 同じ形の影を2つ用意し、パッドの水平範囲でマスクで切り分ける
const buildShadowGfx = () => {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.05);
    g.fillEllipse(0, 0, 110, 30);
    g.fillStyle(0x000000, 0.06);
    g.fillEllipse(0, 0, 106, 29);
    g.fillStyle(0x000000, 0.075);
    g.fillEllipse(0, 0, 100, 27);
    g.fillStyle(0x000000, 0.09);
    g.fillEllipse(0, 0, 92, 25);
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(0, 0, 72, 20);
    g.x = scene.spaceship.x;
    g.y = scene.game.config.height - 63;
    g.setScale(50 / 100);
    return g;
};
scene.spaceshipShadow = buildShadowGfx();       // 着陸台に落ちる用（パッド範囲のみ表示）
scene.spaceshipShadowGround = buildShadowGfx(); // 月面に落ちる用（パッド範囲外のみ表示）

// 当たり判定デバッグ用の枠（毎フレーム update で再描画）
// 有効にするには setVisible(true) で表示、または scene.debugBoundsEnabled = true
scene.debugBounds = scene.add.graphics();
scene.debugBounds.setDepth(20);
scene.debugBounds.setVisible(false);

// 台座画像の形そのものをマスクとして使う（ビットマップマスク）
// → 矩形カットではなく、画像の輪郭・透明度に沿って影が切り替わる
const padBitmapMask = scene.flagVisual.createBitmapMask();
scene.spaceshipShadow.setMask(padBitmapMask);
const groundBitmapMask = scene.flagVisual.createBitmapMask();
groundBitmapMask.invertAlpha = true;
scene.spaceshipShadowGround.setMask(groundBitmapMask);

scene.cursors = scene.input.keyboard.createCursorKeys();
// WASD でも上下左右と同じ挙動。W/A/S/D の keydown/keyup を矢印キーの内部状態に
// 反映させることで、isDown だけでなく JustDown / JustUp も透過的に動く。
const wasdMap = { W: scene.cursors.up, A: scene.cursors.left, S: scene.cursors.down, D: scene.cursors.right };
for (const [letter, arrowKey] of Object.entries(wasdMap)) {
    scene.input.keyboard.on(`keydown-${letter}`, (e) => arrowKey.onDown(e));
    scene.input.keyboard.on(`keyup-${letter}`, (e) => arrowKey.onUp(e));
}
scene.goalSound = scene.sound.add('goal', { loop: false, volume: 0.025 });
scene.goalTimer = 0;
scene.explosionSound = scene.sound.add('explosion', { loop: false, volume: 1 });
scene.emptySound = scene.sound.add('empty', { loop: true, volume: 0.1 });
scene.endSound = scene.sound.add('end', { loop: false, volume: 0.075 });
scene.footstepSounds = [];
for (let i = 1; i <= 5; i++) {
    scene.footstepSounds.push(scene.sound.add(`footsteps${i}`, { loop: false, volume: 0.2 }));
}
scene.lastFootstepTime = 0;
scene.beamSound = scene.sound.add('beam', { loop: false, volume: 0.35 });
scene.beamHitSound = scene.sound.add('beamhit', { loop: false, volume: 0.5 });
scene.beamTameSound = scene.sound.add('beam-tame', { loop: true, volume: 0.1 });
scene.bloodSound = scene.sound.add('blood', { loop: false, volume: 0.5 });
scene.deadSound = scene.sound.add('dead', { loop: false, volume: 0.15 });
scene.rescueIntroSound = scene.sound.add('rescue1', { loop: false, volume: 0.15 });
scene.climbSound = scene.sound.add('climb', { loop: false, volume: 0.075 });
scene.cockpitSound = scene.sound.add('cockpit', { loop: true, volume: 0.22 });
scene.cockpitLandingSound = scene.sound.add('cockpitLanding', { loop: false, volume: 0.6 });
scene.testModeSound = scene.sound.add('testmode', { loop: false, volume: 0.7 });
scene.rescueLandSounds = [
    scene.sound.add('rescue2', { loop: false, volume: 0.15 }),
    scene.sound.add('rescue3', { loop: false, volume: 0.15 }),
    scene.sound.add('rescue4', { loop: false, volume: 0.15 })
];
// 「会話」のように rescue1 終了後に rescue2/3/4 を順次再生するためのキュー
scene.rescueLandQueue = 0;
scene.rescueLandPlaying = false;
scene.rescueResponded = false; // scene.restart 後も初期化されるよう明示リセット
scene.tryPlayRescueLand = () => {
    if (scene.rescueLandPlaying) return;
    if (scene.rescueIntroSound && scene.rescueIntroSound.isPlaying) return;
    if (scene.rescueLandQueue <= 0) return;
    scene.rescueLandQueue--;
    scene.rescueLandPlaying = true;
    const snd = Phaser.Utils.Array.GetRandom(scene.rescueLandSounds);
    snd.once('complete', () => {
        scene.rescueLandPlaying = false;
        scene.tryPlayRescueLand();
    });
    snd.play();
};
scene.jetSound = scene.sound.add('jet', { loop: true, volume: 0.5 });

// ジェット噴射用パーティクルテクスチャを生成
const jetGfx = scene.make.graphics({ add: false });
jetGfx.fillStyle(0xffffff);
jetGfx.fillCircle(3, 3, 3);
jetGfx.generateTexture('jetParticle', 6, 6);
jetGfx.destroy();

// ビームチャージ用パーティクルテクスチャ（1px 白ドット）
const chargeGfx = scene.make.graphics({ add: false });
chargeGfx.fillStyle(0xffffff);
chargeGfx.fillRect(0, 0, 1, 1);
chargeGfx.generateTexture('chargeParticle', 1, 1);
chargeGfx.destroy();

// 粉塵パーティクル用テクスチャ（薄いベージュの丸）
const dustGfx = scene.make.graphics({ add: false });
dustGfx.fillStyle(0xc8b89a);
dustGfx.fillCircle(3, 3, 3);
dustGfx.generateTexture('dustParticle', 6, 6);
dustGfx.destroy();

// 白ベースの粉塵パーティクル（tint で正確に色変更可能）
const dustWhiteGfx = scene.make.graphics({ add: false });
dustWhiteGfx.fillStyle(0xffffff);
dustWhiteGfx.fillCircle(3, 3, 3);
dustWhiteGfx.generateTexture('dustWhite', 6, 6);
dustWhiteGfx.destroy();

// 粉塵パーティクル用テクスチャ（大きめの煙）
const dustGfxLarge = scene.make.graphics({ add: false });
dustGfxLarge.fillStyle(0xa8a8a8);
dustGfxLarge.fillCircle(8, 8, 8);
dustGfxLarge.generateTexture('dustLarge', 16, 16);
dustGfxLarge.destroy();

// 粉塵パーティクルエミッター（中央・左・右から舞い上がる煙）
const dustParticles = scene.add.particles('dustLarge');

// 粉塵エミッター5つ（左→左中→中央→右中→右）
const dustAngles = [
    { min: 190, max: 220 },  // 左
    { min: 230, max: 260 },  // 左中
    { min: 280, max: 310 },  // 右中
    { min: 320, max: 350 },  // 右
];
scene.dustEmitters = dustAngles.map(angle => {
    return dustParticles.createEmitter({
        speed: { min: 30, max: 80 },
        angle: angle,
        scale: { start: 0.2, end: 1.8 },
        alpha: { start: 0.4, end: 0 },
        lifespan: { min: 600, max: 1300 },
        frequency: 20,
        quantity: 2,
        on: false
    });
});

// ジェット噴射パーティクルエミッター（方向ごと）
const emitterConfig = (angle) => ({
    speed: { min: 60, max: 140 },
    angle: angle,
    scale: { start: 0.5, end: 0 },
    alpha: { start: 0.7, end: 0 },
    lifespan: 200,
    frequency: 25,
    quantity: 2,
    on: false
});

// 下降スラスターは左右の足の付け根から斜め上に噴射する（左=up-left ~225°, 右=up-right ~315°）
scene.jetParticles = {
    up: scene.add.particles('jetParticle').createEmitter(emitterConfig({ min: 75, max: 105 })),
    downLeft: scene.add.particles('jetParticle').createEmitter(emitterConfig({ min: 210, max: 240 })),
    downRight: scene.add.particles('jetParticle').createEmitter(emitterConfig({ min: 300, max: 330 })),
    left: scene.add.particles('jetParticle').createEmitter(emitterConfig({ min: -15, max: 15 })),
    right: scene.add.particles('jetParticle').createEmitter(emitterConfig({ min: 165, max: 195 }))
};

// ビームチャージ用パーティクルエミッター
// 銃口の前に半円状に分布、中心近くほど密度高・遠くほど疎。明滅しながらその場で消える
const chargeParticles = scene.add.particles('chargeParticle');
chargeParticles.setDepth(11);
scene._chargeFocus = { x: 0, y: 0 };
scene._chargeDir = 1;         // 1 or -1（銃の向き）
scene._chargeProgress = 0;    // 0→1（長押し時間の進行度）
const sceneRef = scene;
scene.beamChargeEmitter = chargeParticles.createEmitter({
    x: 0,
    y: 0,
    lifespan: { min: 160, max: 280 }, // 短寿命で明滅感
    scale: { start: 1, end: 1 },
    alpha: { start: 0, end: 0 },      // 下のonUpdateで 0→peak→0
    frequency: 18,
    quantity: 1,
    on: false,
    emitCallback: function (particle, emitter) {
        // 長押し進行度
        const progress = sceneRef._chargeProgress;
        // リング（環状）分布：内側の空洞半径がチャージで縮み、徐々に銃口寄りへ寄せる
        const outerRadius = 15 - progress * 3; // 15 → 12
        const innerRadius = (1 - progress) * 10; // 10 → 0（内側が縮んで埋まっていく）
        // リング内で内側エッジ寄りに偏らせる（t^2 で 0 近辺が濃い）
        const t = Math.pow(Math.random(), 2);
        const radius = innerRadius + t * (outerRadius - innerRadius);
        // 前方扇形（角度 ±60°）+ 銃の向き dir で左右反転
        const halfFan = Math.PI / 3;
        const angle = (Math.random() * 2 - 1) * halfFan;
        const dx = Math.cos(angle) * radius * sceneRef._chargeDir;
        const dy = Math.sin(angle) * radius;
        particle.x = emitter.x.propertyValue + dx;
        particle.y = emitter.y.propertyValue + dy;
    }
});
// アルファを寿命の半ばでピークにする明滅カーブ
scene.beamChargeEmitter.alpha.onUpdate = (particle, key, t) => {
    return Math.sin(Math.PI * t);
};

registerAnimations(scene);

// 旧オンスクリーンコントロール（#left/#up/#down/#right）は廃止。
// 新コントロール（.touch-btn）は main.js 側で KeyboardEvent ディスパッチして処理。

// カメラの初期位置とズームを設定（タイトル中は固定・宇宙船の最終位置付近）
scene.cameras.main.centerOn(scene.spaceship.x, 150);
scene.cameras.main.setZoom(1.2);
// 8bitエフェクトを全体にかける
// scene.cameras.main.setPostPipeline('PixelArt'); // 一旦OFF（マスクとの干渉）

// カメラのズームが変更されたときにタイトル画像のスケールを調整するリスナーを追加
scene.cameras.main.addListener('zoomchange', (cam, newZoom) => {
    title.setScale(1 / newZoom);
});

// コックピット視点（着陸時）用のオーバーレイ要素を初期化（全て非表示で待機）
createCockpitObjects(scene);

}
