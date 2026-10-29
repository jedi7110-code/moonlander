// 共有タイプライター：#cmd-message オーバーレイに1文字ずつ表示（ブリーフィングの作法）。
// HQメッセージ・クルーの返答の両方で使う。

export function typeText(scene, text, { hold = 5000, onDone } = {}) {
  const el = document.getElementById('cmd-message');
  if (!el) return;
  el.classList.add('typing', 'show');
  el.textContent = '';
  let i = 0;

  if (scene && scene.sound) {
    const snd = scene.sound.add('command', { volume: 0.4 });
    snd.play();
    snd.once('complete', () => snd.destroy());
  }

  const tick = () => {
    if (i < text.length) {
      const ch = text[i++];
      el.textContent += ch;
      el.scrollTop = el.scrollHeight;
      setTimeout(tick, ch === '\n' ? 170 : 28);
    } else {
      el.classList.remove('typing');
      setTimeout(() => {
        el.classList.remove('show');
        if (onDone) onDone();
      }, hold);
    }
  };
  tick();
}
