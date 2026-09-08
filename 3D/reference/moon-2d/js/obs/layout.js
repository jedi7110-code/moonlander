// 船の横断面ドールハウス・レイアウト（データ駆動）
// プロト段階の見た目はプレースホルダ図形。LCP 断面の本番アートは後工程。

import { t, onLangChange } from './i18n.js?v=15';

// 上端を下げて y0–214 を HUD/顔のヘッダー帯として空ける（パラメータが船に被らない）
export const INTERIOR = { left: 130, right: 1270, top: 230, bottom: 880 };

// 各フロアの「床（足元）Y」。actor は origin(0.5,1) で足をこの Y に置く。
export const FLOORS = [
  { name: 'HABITATION', y: 446 },   // 居住（上段）
  { name: 'OPERATIONS', y: 658 },   // 作業（中段）
  { name: 'ENGINEERING', y: 870 },  // 機関／調理（下段）
];

// フロア間移動の唯一の縦動線（ハシゴ／リフト）
export const LADDER_X = 700;

// 活動拠点。
//  need        : この拠点が満たす欲求（null = 欲求と無関係）
//  supply      : 使用に必要な消耗品（補給ハッチ経由で届く）。なければ自由に使える
//  role        : 'console'（通信・対話・ノック対象） / 'hatch'（補給投入口）
export const STATIONS = [
  { id: 'shower', floor: 0, x: 240,  need: 'hygiene', label: 'SHOWER', dur: 6000 },
  { id: 'toilet', floor: 0, x: 380,  need: 'bladder', label: 'TOILET', dur: 4000 },
  { id: 'bunk',   floor: 0, x: 510,  need: 'energy',  label: 'BUNK',   dur: 9000 },
  { id: 'lounge', floor: 0, x: 1080, need: 'fun',     label: 'LOUNGE', dur: 8000 },
  { id: 'console', floor: 1, x: 300, need: null,      label: 'CONSOLE', dur: 9000, role: 'console' },
  { id: 'stereo', floor: 1, x: 1080, need: 'fun',     label: 'STEREO', dur: 7000, supply: 'music' },
  { id: 'galley', floor: 2, x: 300,  need: 'hunger',  label: 'GALLEY', dur: 6000, supply: 'food' },
  { id: 'hydro',  floor: 2, x: 560,  need: 'thirst',  label: 'HYDRO',  dur: 5000, supply: 'water' },
  { id: 'hatch',  floor: 2, x: 1110, need: null,      label: 'SUPPLY HATCH', dur: 0, role: 'hatch' },
];

export function getStation(id) {
  return STATIONS.find(s => s.id === id);
}

// プレースホルダの船内断面を描画する
export function drawShip(scene) {
  const g = scene.add.graphics().setDepth(1);
  const { left, right, top, bottom } = INTERIOR;

  // 外殻
  g.fillStyle(0x0a0e16, 1).fillRect(left - 16, top - 16, (right - left) + 32, (bottom - top) + 32);
  g.lineStyle(3, 0x2c3a52, 1).strokeRect(left - 16, top - 16, (right - left) + 32, (bottom - top) + 32);

  // 各フロアの床帯 + 区切り + ラベル
  FLOORS.forEach((fl, i) => {
    const bandTop = i === 0 ? top : FLOORS[i - 1].y + 8;
    g.fillStyle(0x0f1626, 1).fillRect(left, bandTop, right - left, fl.y - bandTop);
    g.fillStyle(0x33425e, 1).fillRect(left, fl.y, right - left, 6);
    const flText = scene.add.text(left + 12, bandTop + 8, t('fl_' + fl.name), {
      fontFamily: 'monospace', fontSize: '15px', color: '#43597d',
    }).setDepth(2);
    onLangChange(() => flText.setText(t('fl_' + fl.name)));
  });

  // ハシゴ縦シャフト
  g.fillStyle(0x07101a, 1).fillRect(LADDER_X - 26, top, 52, bottom - top);
  g.lineStyle(2, 0x33d0ff, 0.5).strokeRect(LADDER_X - 26, top, 52, bottom - top);
  for (let y = top + 18; y < bottom; y += 26) {
    g.lineStyle(3, 0x2d6d86, 0.8).lineBetween(LADDER_X - 22, y, LADDER_X + 22, y);
  }

  // 各ステーションの什器（プレースホルダ矩形 + ラベル）
  STATIONS.forEach(st => {
    const fy = FLOORS[st.floor].y;
    const w = 84, h = 56;
    let col = 0x1b2740, line = 0x4a6a8f;
    if (st.role === 'console') { col = 0x123040; line = 0x39d0ff; }
    if (st.role === 'hatch') { col = 0x2a1d12; line = 0xffae4a; }
    g.fillStyle(col, 1).fillRect(st.x - w / 2, fy - h, w, h);
    g.lineStyle(2, line, 1).strokeRect(st.x - w / 2, fy - h, w, h);
    const stText = scene.add.text(st.x, fy - h - 6, t('st_' + st.id), {
      fontFamily: 'monospace', fontSize: '12px',
      color: st.role === 'hatch' ? '#d99a4e' : '#7d97bd',
    }).setOrigin(0.5, 1).setDepth(2);
    onLangChange(() => stText.setText(t('st_' + st.id)));
  });
}
