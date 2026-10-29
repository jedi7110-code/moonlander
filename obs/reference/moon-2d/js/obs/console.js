// コンソールのモニター（ノックの対象 / HQメッセージ / 応答）。
// クルーが呼んでいる時にクリック → acknowledge、それ以外 → HQメッセージ受信。
// scene.obsUI に flashMonitor / showWant / hideWant を生やし、brain から使う。

import { FLOORS, getStation } from './layout.js?v=15';
import { typeText } from './typewriter.js?v=15';
import { hqList } from './i18n.js?v=15';

let hqIdx = 0;

export function initConsole(scene, brain) {
  const con = getStation('console');
  const fy = FLOORS[con.floor].y;

  const mon = scene.add.rectangle(con.x, fy - 78, 60, 40, 0x0a2a3a)
    .setStrokeStyle(2, 0x39d0ff).setDepth(15)
    .setInteractive({ useHandCursor: true });
  scene.add.text(con.x, fy - 78, '▣', {
    fontFamily: 'monospace', fontSize: '20px', color: '#39d0ff',
  }).setOrigin(0.5).setDepth(16);

  const idleBlink = scene.tweens.add({
    targets: mon, alpha: { from: 1, to: 0.5 }, duration: 900, yoyo: true, repeat: -1,
  });

  const wantEl = document.getElementById('want-alert');

  // brain が使う UI フック
  scene.obsUI = {
    flashMonitor() {
      mon.setStrokeStyle(3, 0xff5a4a);
      scene.tweens.add({
        targets: mon, scaleX: 1.18, scaleY: 1.18, duration: 110, yoyo: true,
        onComplete: () => mon.setStrokeStyle(2, 0x39d0ff),
      });
    },
    showWant(text) {
      if (!wantEl) return;
      wantEl.textContent = text + '　— クリック / Fキー等で応答';
      wantEl.classList.add('show');
    },
    hideWant() { if (wantEl) wantEl.classList.remove('show'); },
  };

  mon.on('pointerdown', () => {
    if (brain.isCalling()) {
      const reply = brain.acknowledge();
      if (reply) typeText(scene, reply, { hold: 4000 });
      return;
    }
    const el = document.getElementById('cmd-message');
    if (el && el.classList.contains('typing')) return;
    if (brain.requestCommand() !== false) {
      idleBlink.pause(); mon.setAlpha(1);
      const list = hqList();
      typeText(scene, list[hqIdx++ % list.length], { hold: 5000, onDone: () => idleBlink.resume() });
    }
  });
}
