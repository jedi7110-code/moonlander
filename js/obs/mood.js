// 4気分の顔アイコン（原典LCPの Happy / Content / Sad / Sick）。
// Phaser Graphics から一度だけテクスチャ生成し、以降は image の差し替えで使う。

export const MOODS = ['happy', 'content', 'sad', 'sick'];

const FACE_KEY = m => 'face_' + m;

export function makeFaceTextures(scene) {
  const R = 26, S = R * 2 + 8;
  MOODS.forEach(mood => {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const cx = S / 2, cy = S / 2;
    const skin = mood === 'sick' ? 0x8fd18a : 0xf2c97a;
    // 顔
    g.fillStyle(skin, 1).fillCircle(cx, cy, R);
    g.lineStyle(2, 0x1a1208, 1).strokeCircle(cx, cy, R);
    // 目
    g.fillStyle(0x1a1208, 1);
    if (mood === 'sick') {
      // ぐったり目（横線）
      g.lineStyle(2, 0x1a1208, 1);
      g.lineBetween(cx - 14, cy - 6, cx - 4, cy - 6);
      g.lineBetween(cx + 4, cy - 6, cx + 14, cy - 6);
    } else {
      g.fillCircle(cx - 9, cy - 6, 3);
      g.fillCircle(cx + 9, cy - 6, 3);
    }
    // 口
    g.lineStyle(3, 0x1a1208, 1);
    if (mood === 'happy') {
      g.beginPath(); g.arc(cx, cy + 2, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.strokePath();
    } else if (mood === 'content') {
      g.beginPath(); g.arc(cx, cy + 4, 9, 0.2 * Math.PI, 0.8 * Math.PI); g.strokePath();
    } else if (mood === 'sad') {
      g.beginPath(); g.arc(cx, cy + 16, 11, 1.15 * Math.PI, 1.85 * Math.PI); g.strokePath();
    } else { // sick: 波線の口
      g.beginPath();
      g.moveTo(cx - 11, cy + 12);
      g.lineTo(cx - 4, cy + 8);
      g.lineTo(cx + 3, cy + 12);
      g.lineTo(cx + 11, cy + 8);
      g.strokePath();
    }
    g.generateTexture(FACE_KEY(mood), S, S);
    g.destroy();
  });
}

// needs（5項目）と rapport から気分を決める。sickFlag は brain が継続枯渇で立てる。
export function moodFromState(needs, rapport, sick) {
  if (sick) return 'sick';
  const vals = Object.values(needs);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg < 38 || rapport < 28) return 'sad';
  if (avg < 68) return 'content';
  return 'happy';
}

export function faceTexture(mood) { return FACE_KEY(mood); }
