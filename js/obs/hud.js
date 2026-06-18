// 乗員テレメトリ HUD（ヘッダー帯）。角ブラケット枠 + 色分けゲージ + 顔パネル。
// プレーンな文字＋ASCIIバーの代わりに、サイバーSF調の計器パネルとして描く。

import { t, onLangChange } from './i18n.js?v=15';
import { faceTexture } from './mood.js?v=15';

const NEED_KEYS = ['hunger', 'thirst', 'energy', 'hygiene', 'fun', 'bladder'];

function pad(n) { return String(n).padStart(2, '0'); }

function lvlColor(v) {
  if (v >= 66) return 0x5fe39a;   // 良好＝グリーン
  if (v >= 38) return 0xffc24a;   // 中＝アンバー
  return 0xff5f52;                // 低＝レッド
}

function drawPanel(g, x, y, w, h) {
  g.fillStyle(0x07121d, 0.72).fillRoundedRect(x, y, w, h, 7);
  g.lineStyle(1, 0x2a4a63, 0.9).strokeRoundedRect(x, y, w, h, 7);
  // 角ブラケット（アクセント）
  g.lineStyle(2, 0x39d0ff, 0.85);
  const L = 13;
  g.beginPath(); g.moveTo(x, y + L); g.lineTo(x, y); g.lineTo(x + L, y); g.strokePath();
  g.beginPath(); g.moveTo(x + w - L, y); g.lineTo(x + w, y); g.lineTo(x + w, y + L); g.strokePath();
  g.beginPath(); g.moveTo(x, y + h - L); g.lineTo(x, y + h); g.lineTo(x + L, y + h); g.strokePath();
  g.beginPath(); g.moveTo(x + w - L, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - L); g.strokePath();
}

function drawGauge(g, x, y, w, h, value, color) {
  const r = h / 2;
  g.fillStyle(0x0c1a26, 1).fillRoundedRect(x, y, w, h, r);
  const fw = Math.max(h, w * Math.max(0, Math.min(100, value)) / 100);
  g.fillStyle(color, 1).fillRoundedRect(x, y, fw, h, r);
  g.fillStyle(0xffffff, 0.22).fillRoundedRect(x + 1, y + 1, fw - 2, h * 0.4, r); // 上ハイライト
  g.lineStyle(1, 0x33506b, 0.8).strokeRoundedRect(x, y, w, h, r);
}

export function createHud(scene) {
  const PX = 14, PY = 10, PW = 486, PH = 196;
  const rowY0 = 44, rowH = 18, barX = PX + 80, barW = 300, barH = 10;
  const ROWS = NEED_KEYS.concat(['rapport']);

  const frame = scene.add.graphics().setDepth(38);
  drawPanel(frame, PX, PY, PW, PH);
  const bars = scene.add.graphics().setDepth(39);

  const mk = (x, y, size, color, ox = 0) =>
    scene.add.text(x, y, '', { fontFamily: 'monospace', fontSize: size + 'px', color })
      .setOrigin(ox, 0).setDepth(40);

  const headText = mk(PX + 18, PY + 13, 14, '#bfe9ff');
  const labels = {}, vals = {};
  ROWS.forEach((k, i) => {
    const y = rowY0 + i * rowH;
    labels[k] = mk(PX + 18, y, 13, '#8fb0cf');
    vals[k] = mk(barX + barW + 12, y, 12, '#cfe4ff');
  });
  const supY = rowY0 + ROWS.length * rowH + 4;
  const supLabel = mk(PX + 18, supY, 13, '#8fb0cf');
  const supText = mk(PX + 80, supY - 2, 15, '#dfe9ff');

  // 顔パネル（右）
  const FX = 1092, FY = 16, FW = 168, FH = 156;
  const fframe = scene.add.graphics().setDepth(38);
  drawPanel(fframe, FX, FY, FW, FH);
  const faceImg = scene.add.image(FX + FW / 2, FY + 70, faceTexture('content')).setDepth(40);
  const nameText = mk(FX + FW / 2, FY + 106, 15, '#bcd4ef', 0.5);
  const moodText = mk(FX + FW / 2, FY + 128, 13, '#7fe9ff', 0.5);

  function stateText(b) {
    if (b.actKey === 'going') return '→ ' + t('st_' + b.actStation);
    if (b.actKey === 'perform') return t('st_' + b.actStation);
    return t('state_' + b.actKey);
  }

  function applyLang() {
    NEED_KEYS.forEach(k => labels[k].setText(t('need_' + k)));
    labels.rapport.setText(t('hud_rapport'));
    supLabel.setText(t('hud_supplies'));
  }
  onLangChange(applyLang);
  applyLang();

  function update(brain, care) {
    const h = Math.floor(brain.hour), m = Math.floor((brain.hour % 1) * 60);
    headText.setText(`${t('hud_time')} ${pad(h)}:${pad(m)}     ${t('hud_state')} ${stateText(brain)}`);

    bars.clear();
    ROWS.forEach((k, i) => {
      const y = rowY0 + i * rowH;
      const v = k === 'rapport' ? brain.rapport : brain.needs[k];
      drawGauge(bars, barX, y + 2, barW, barH, v, k === 'rapport' ? 0x6fb6ff : lvlColor(v));
      vals[k].setText(Math.round(v));
    });

    const s = care.supplies;
    supText.setText(`🍱 ${s.food}    💧 ${s.water}    🐟 ${s.catfood}    💿 ${s.music}`);

    faceImg.setTexture(faceTexture(brain.mood));
    nameText.setText(brain.name);
    moodText.setText(t('mood_' + brain.mood));
  }

  return { update };
}
