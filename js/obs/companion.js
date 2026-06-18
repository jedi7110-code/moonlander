// 相棒：船猫（原典の犬の翻案）。クルー同様ハシゴで全フロアを徘徊・睡眠する。
// 腹が減ると補給ハッチへ猫餌を取りに行く。アセットが無いため簡易な手描きスプライト。

import { FLOORS, INTERIOR, LADDER_X, getStation } from './layout.js?v=15';

const SPEED = 70;   // px/sec（横移動）
const CLIMB = 60;   // px/sec（ハシゴ）

function makeCatTexture(scene) {
  if (scene.textures.exists('cat_tex')) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // 体（横向き・うずくまり気味、頭は右）── 白猫
  g.fillStyle(0xeef1f5, 1);
  g.fillEllipse(20, 16, 30, 16);      // 胴
  g.fillCircle(33, 12, 8);            // 頭
  g.fillTriangle(28, 6, 33, -4, 36, 6);   // 耳
  g.fillTriangle(34, 6, 39, -4, 42, 6);
  g.fillRect(4, 12, 4, 12);          // 後脚
  g.fillRect(30, 16, 4, 10);         // 前脚
  g.fillStyle(0xeef1f5, 1).fillRect(2, 4, 4, 12); // しっぽ
  g.fillStyle(0x3a6ea5, 1).fillCircle(35, 11, 2); // 目（青）
  g.generateTexture('cat_tex', 46, 30);
  g.destroy();
}

export class Cat {
  constructor(scene, care) {
    this.scene = scene;
    this.care = care;
    makeCatTexture(scene);

    this.floor = 2;
    this.x = INTERIOR.left + 220;
    this.y = FLOORS[this.floor].y;
    this.spr = scene.add.image(this.x, this.y, 'cat_tex').setOrigin(0.5, 1).setDepth(19);
    this.spr.setDisplaySize(40, 26);

    this.hunger = 70;
    this.state = 'idle';     // idle / wander / sleep / fetch
    this.timer = 1 + Math.random() * 2;
    this.queue = [];
    this.symbol = scene.add.text(this.x, this.y - 30, '', {
      fontFamily: 'monospace', fontSize: '16px',
    }).setOrigin(0.5, 1).setDepth(20);
  }

  // {floor,x} へ：別フロアならハシゴ経由
  goTo(floor, x) {
    const segs = [];
    if (floor !== this.floor) {
      segs.push({ type: 'walk', floor: this.floor, x: LADDER_X });
      segs.push({ type: 'climb', toFloor: floor });
      segs.push({ type: 'walk', floor, x });
    } else {
      segs.push({ type: 'walk', floor, x });
    }
    this.queue = segs;
  }

  // 経路を1ステップ進める。到着（キュー空）で true
  _advance(dt) {
    const seg = this.queue[0];
    if (!seg) return true;
    if (seg.type === 'walk') {
      this.y = FLOORS[seg.floor].y;
      const dx = seg.x - this.x, step = SPEED * dt;
      if (Math.abs(dx) <= step) { this.x = seg.x; this.queue.shift(); }
      else { this.x += Math.sign(dx) * step; this.spr.setFlipX(dx < 0); }
    } else { // climb
      this.x = LADDER_X;
      const ty = FLOORS[seg.toFloor].y, dy = ty - this.y, step = CLIMB * dt;
      if (Math.abs(dy) <= step) { this.y = ty; this.floor = seg.toFloor; this.queue.shift(); }
      else this.y += Math.sign(dy) * step;
    }
    return this.queue.length === 0;
  }

  update(dt) {
    this.hunger = Math.max(0, this.hunger - 0.8 * dt);

    // 腹が減って猫餌があるなら取りに行く
    if (this.state !== 'fetch' && this.hunger < 35 && this.care.has('catfood')) {
      this.state = 'fetch';
      this.symbol.setText('🐟');
      const hatch = getStation('hatch');
      this.goTo(hatch.floor, hatch.x);
    }

    if (this.state === 'fetch') {
      if (this._advance(dt)) {
        if (this.care.take('catfood')) this.hunger = 100;
        this.symbol.setText('');
        this.state = 'idle';
        this.timer = 1 + Math.random() * 2;
      }
    } else if (this.state === 'wander') {
      if (this._advance(dt)) { this.state = 'idle'; this.timer = 1.5 + Math.random() * 3; }
    } else if (this.state === 'sleep') {
      this.symbol.setText('💤');
      this.timer -= dt;
      if (this.timer <= 0) { this.symbol.setText(''); this.state = 'idle'; this.timer = 1 + Math.random() * 2; }
    } else { // idle
      this.timer -= dt;
      if (this.timer <= 0) {
        if (Math.random() < 0.35) {
          this.state = 'sleep'; this.timer = 4 + Math.random() * 5;
        } else {
          const f = Math.floor(Math.random() * FLOORS.length);
          const lo = INTERIOR.left + 40, hi = INTERIOR.right - 40;
          this.goTo(f, lo + Math.random() * (hi - lo));
          this.state = 'wander';
        }
      }
    }

    this.spr.setPosition(this.x, this.y);
    this.symbol.setPosition(this.x, this.y - 28);
  }
}
