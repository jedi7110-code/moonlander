// 観察モード「船内の日常」プロトタイプ ── Phaser ブートストラップ + scene。
// 本編から完全独立（obs.html から読み込む）。

import { drawShip } from './layout.js?v=15';
import { Actor } from './actor.js?v=15';
import { Brain } from './brain.js?v=15';
import { initConsole } from './console.js?v=15';
import { createCare } from './care.js?v=15';
import { Cat } from './companion.js?v=15';
import { initChat } from './chat.js?v=15';
import { makeFaceTextures } from './mood.js?v=15';
import { t, onLangChange, toggleLang } from './i18n.js?v=15';
import { createHud } from './hud.js?v=15';

const config = {
  type: Phaser.WEBGL,
  width: 1400,
  height: 900,
  backgroundColor: '#05070d',
  parent: 'obs-container',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { preload, create, update },
};

new Phaser.Game(config);

function preload() {
  this.load.image('p_f', 'assets/player-f.png');
  this.load.image('p_b', 'assets/player-b.png');
  this.load.image('p_l', 'assets/player-l.png');
  this.load.image('p_l1', 'assets/player-l1.png');
  this.load.image('p_l2', 'assets/player-l2.png');
  this.load.image('p_r', 'assets/player-r.png');
  this.load.image('p_r1', 'assets/player-r1.png');
  this.load.image('p_r2', 'assets/player-r2.png');
  this.load.audio('command', 'assets/sound/command.wav');
  for (let i = 1; i <= 5; i++) this.load.audio('foot' + i, 'assets/sound/footsteps' + i + '.wav');
}

function create() {
  const scene = this;

  // 本編準拠：L/R は左足／右足フレーム（向きではない）。元画像は左向き、右はflipXで反転。
  scene.anims.create({
    key: 'walk',
    frames: [{ key: 'p_l1' }, { key: 'p_l2' }, { key: 'p_l1' }, { key: 'p_r1' }, { key: 'p_r2' }, { key: 'p_r1' }],
    frameRate: 10, repeat: -1,
  });
  makeFaceTextures(scene);

  drawShip(scene);
  scene.care = createCare(scene);
  scene.actor = new Actor(scene);
  scene.cat = new Cat(scene, scene.care);
  scene.brain = new Brain(scene, scene.actor, { care: scene.care });
  scene.care.onDeliver = (type) => scene.brain.onSupplyDelivered(type);

  initConsole(scene, scene.brain);
  initChat(scene, scene.brain);

  // 乗員テレメトリ HUD（パネル＝ヘッダー帯）
  scene.hudObj = createHud(scene);

  // DOM の言語適用（補給ボタン / 入力欄 / 送信 / 言語トグル）
  const applyDomLang = () => {
    document.querySelectorAll('#supply-panel [data-supply]').forEach(btn => {
      btn.textContent = t('btn_' + (btn.getAttribute('data-supply') === 'catfood' ? 'catfood' : btn.getAttribute('data-supply')));
    });
    const ph = document.getElementById('chat-input'); if (ph) ph.placeholder = t('chat_ph');
    const send = document.querySelector('#chat-form button'); if (send) send.textContent = t('chat_send');
    const lng = document.getElementById('lang-toggle'); if (lng) lng.textContent = t('lang_btn');
  };
  onLangChange(applyDomLang);
  applyDomLang();
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.addEventListener('click', () => toggleLang());

  // 検証用ハンドル
  window.OBS = scene;
}

function update(time, delta) {
  const dt = Math.min(delta / 1000, 0.05);
  this.care.update(dt);
  this.actor.update(dt);
  this.cat.update(dt);
  this.brain.update(dt);
  this.hudObj.update(this.brain, this.care);
}
