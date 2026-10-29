// 間接的な世話（原典の CTRL+F/W/D/R の翻案）。
// プレイヤーは品を「補給ハッチ」に投入するだけ。クルー／猫が取りに来て消費する。
// 操作: キーボード F=食料 / W=水 / C=猫餌 / M=音楽、または画面下の補給パネルのボタン。
//
// 生命維持（食料・水）は船の循環設備が自動で補充する（基本は飢え死にしない）。
// 消費が早く一時的に尽きるとクルーが呼びかけ → プレイヤーが差し入れると即補充。
// 猫餌・音楽は自動補充しない＝任意の世話アイテム。

import { getStation, FLOORS } from './layout.js?v=15';

const SYMBOL = { food: '🍱', water: '💧', catfood: '🐟', music: '💿' };
const KEYMAP = { F: 'food', W: 'water', C: 'catfood', M: 'music' };
// 船が自動補充する生命維持物資と、その補充間隔(秒)。在庫が尽きてからこの秒数で1個生成。
const AUTO = { food: 50, water: 45 };

export function createCare(scene) {
  const hatch = getStation('hatch');
  const fy = FLOORS[hatch.floor].y;

  const care = {
    supplies: { food: 0, water: 0, catfood: 0, music: 0 },
    icons: { food: [], water: [], catfood: [], music: [] },
    regen: { food: 0, water: 0 },   // 在庫切れからの経過(秒)
    hatch,
    onDeliver: null,
  };

  function layoutIcons() {
    let slot = 0;
    ['food', 'water', 'catfood', 'music'].forEach(type => {
      care.icons[type].forEach(ic => {
        ic.setPosition(hatch.x - 60 + slot * 22, fy - 70);
        slot++;
      });
    });
  }

  // src: 'player'（差し入れ）/ 'ship'（自動補充）。ship はやや控えめな演出。
  care.deliver = (type, src = 'player') => {
    if (!SYMBOL[type]) return;
    if (care.supplies[type] > 0) return; // 既に出ている品は重複させない（各種1個まで）
    care.supplies[type]++;
    const ic = scene.add.text(0, 0, SYMBOL[type], {
      fontFamily: 'monospace', fontSize: '20px',
    }).setOrigin(0.5, 1).setDepth(18);
    if (src === 'ship') ic.setAlpha(0.85).setTint(0x9fd0e0); // 船製は少し淡く
    care.icons[type].push(ic);
    layoutIcons();
    ic.y -= 40; ic.alpha = 0.2;
    scene.tweens.add({ targets: ic, y: fy - 70, alpha: src === 'ship' ? 0.85 : 1, duration: 260, ease: 'Quad.in' });
    if (care.onDeliver) care.onDeliver(type);
  };

  care.has = (type) => care.supplies[type] > 0;

  care.take = (type) => {
    if (care.supplies[type] <= 0) return false;
    care.supplies[type]--;
    const ic = care.icons[type].pop();
    if (ic) ic.destroy();
    layoutIcons();
    return true;
  };

  // 毎フレーム：生命維持の自動補充タイマー
  care.update = (dt) => {
    for (const type in AUTO) {
      if (care.supplies[type] > 0) { care.regen[type] = 0; continue; }
      care.regen[type] += dt;
      if (care.regen[type] >= AUTO[type]) {
        care.regen[type] = 0;
        care.deliver(type, 'ship');
      }
    }
  };

  // キーボード（チャット入力中は無効化）
  Object.keys(KEYMAP).forEach(k => {
    scene.input.keyboard.on('keydown-' + k, () => {
      const el = document.activeElement;
      if (el && el.tagName === 'INPUT') return;
      care.deliver(KEYMAP[k]);
    });
  });

  // 画面下の補給パネルのボタン
  document.querySelectorAll('#supply-panel [data-supply]').forEach(btn => {
    btn.addEventListener('click', () => care.deliver(btn.getAttribute('data-supply')));
  });

  // 初期在庫（アイコン付き）：生命維持＋猫の最初の一食
  care.deliver('food', 'ship');
  care.deliver('water', 'ship');
  care.deliver('catfood', 'player');

  return care;
}
