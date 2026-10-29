// クルー：横歩き(L/R) + ハシゴ昇降。位置は {floor, x} で管理し、
// 経路はウェイポイント（walk / climb セグメント）のキューで処理する。
// 頭上に活動シンボル（☕ など）/ 運搬物、別途モニターを叩く knock 演出を持つ。

import { FLOORS, LADDER_X } from './layout.js?v=15';

const WALK_SPEED = 150;  // px/sec
const CLIMB_SPEED = 95;  // px/sec
const FOOT_INTERVAL = 0.32; // sec

export class Actor {
  constructor(scene) {
    this.scene = scene;
    this.floor = 1;
    this.x = LADDER_X;
    this.y = FLOORS[1].y;

    this.spr = scene.add.sprite(this.x, this.y, 'p_f').setOrigin(0.5, 1).setDepth(20);
    this.spr.setDisplaySize(40, 56);

    // 頭上の活動／運搬シンボル
    this.symbol = scene.add.text(this.x, this.y - 60, '', {
      fontFamily: 'monospace', fontSize: '26px',
    }).setOrigin(0.5, 1).setDepth(21);

    this.queue = [];
    this.onArrive = null;
    this.facing = 'r';
    this.footT = 0;
  }

  get busy() { return this.queue.length > 0; }

  // {floor, x} を持つ任意の目標へ向かう。別フロアならハシゴ経由。
  goTo(target, onArrive) {
    const segs = [];
    if (target.floor !== this.floor) {
      segs.push({ type: 'walk', floor: this.floor, x: LADDER_X });
      segs.push({ type: 'climb', toFloor: target.floor });
      segs.push({ type: 'walk', floor: target.floor, x: target.x });
    } else {
      segs.push({ type: 'walk', floor: this.floor, x: target.x });
    }
    this.queue = segs;
    this.onArrive = onArrive || null;
  }

  setSymbol(s) { this.symbol.setText(s || ''); }

  // モニターを叩く演出（横に小刻みに揺れる）
  knock() {
    if (this._knocking) return;
    this._knocking = true;
    const baseX = this.x;
    this.scene.tweens.add({
      targets: this.spr, x: baseX + 6, duration: 70, yoyo: true, repeat: 3,
      onComplete: () => { this._knocking = false; this.spr.x = this.x; },
    });
  }

  _foot(dt) {
    this.footT -= dt;
    if (this.footT <= 0) {
      this.footT = FOOT_INTERVAL;
      const i = 1 + Math.floor(Math.random() * 5);
      const s = this.scene.sound.add('foot' + i, { volume: 0.2 });
      s.play();
      s.once('complete', () => s.destroy());
    }
  }

  update(dt) {
    const seg = this.queue[0];

    if (!seg) {
      if (!this._knocking) {
        this.spr.anims.stop();
        this.spr.setFlipX(false);
        if (this.spr.texture.key !== 'p_f') this.spr.setTexture('p_f');
      }
      this._sync();
      return;
    }

    if (seg.type === 'walk') {
      this.y = FLOORS[seg.floor].y;
      const dx = seg.x - this.x;
      const step = WALK_SPEED * dt;
      if (Math.abs(dx) <= step) {
        this.x = seg.x;
        this.queue.shift();
        this._afterSeg();
      } else {
        this.x += Math.sign(dx) * step;
        this.facing = dx < 0 ? 'l' : 'r';
        if (!this.spr.anims.isPlaying || this.spr.anims.currentAnim.key !== 'walk') {
          this.spr.play('walk');
        }
        this.spr.setFlipX(this.facing === 'r'); // 元画像は左向き、右はflipX
        this._foot(dt);
      }
    } else if (seg.type === 'climb') {
      this.x = LADDER_X;
      this.spr.anims.stop();
      this.spr.setFlipX(false);
      if (this.spr.texture.key !== 'p_b') this.spr.setTexture('p_b');
      const ty = FLOORS[seg.toFloor].y;
      const dy = ty - this.y;
      const step = CLIMB_SPEED * dt;
      if (Math.abs(dy) <= step) {
        this.y = ty;
        this.floor = seg.toFloor;
        this.queue.shift();
        this._afterSeg();
      } else {
        this.y += Math.sign(dy) * step;
      }
    }

    this._sync();
  }

  _afterSeg() {
    if (this.queue.length === 0 && this.onArrive) {
      const cb = this.onArrive;
      this.onArrive = null;
      cb();
    }
  }

  _sync() {
    if (!this._knocking) this.spr.x = this.x;
    this.spr.y = this.y;
    this.symbol.setPosition(this.x, this.y - 58);
  }
}
