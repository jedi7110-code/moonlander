// 文章入力での対話（原典の Keyboard Communication の翻案）。
// 下部の入力欄に文章を打つ → brain.handleChat が礼儀・意図を解釈して返答＆行動。

import { typeText } from './typewriter.js?v=15';

export function initChat(scene, brain) {
  const input = document.getElementById('chat-input');
  const form = document.getElementById('chat-form');
  if (!input || !form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const reply = brain.handleChat(text);
    typeText(scene, reply, { hold: 4500 });
  });
}
