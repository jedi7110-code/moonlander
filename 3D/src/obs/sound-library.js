// Only local CC0 recordings. Provenance and edit recipes: assets/obs/audio/CREDITS.md.
export const CABIN_SOUNDS=Object.freeze({
  doorOpen:{file:'door-open-air-motor.wav',label:'ハッチ / 開く',description:'バシュッ → ゴウン / 空気圧＋低いモーター',gain:.65},
  doorClose:{file:'door-close-air-motor.wav',label:'ハッチ / 閉じる',description:'バシュッ → ゴウン / 空気圧＋重めのモーター',gain:.58},
  latch:{file:'latch.wav',label:'ロック・洗濯機の蓋',gain:.38},
  step1:{file:'step-metal-boots-1.wav',label:'足音 / 1',description:'実録：金属床をブーツで歩く / 控えめ・低音',gain:.20,rate:.84},
  step2:{file:'step-metal-boots-2.wav',label:'足音 / 2',description:'実録：金属床をブーツで歩く / 控えめ・低音',gain:.185,rate:.84},
  step3:{file:'step-metal-boots-3.wav',label:'足音 / 3',description:'実録：金属床をブーツで歩く / 控えめ・低音',gain:.20,rate:.84},
  ladderStep1:{file:'step-ladder-boots-1.wav',label:'マイロ / ハシゴ 1',description:'実録ブーツの接地を短く・鈍く / 金属の踏み段用',gain:.13,rate:.88},
  ladderStep2:{file:'step-ladder-boots-2.wav',label:'マイロ / ハシゴ 2',description:'実録ブーツの接地を短く・鈍く / 金属の踏み段用',gain:.12,rate:.88},
  ladderStep3:{file:'step-ladder-boots-3.wav',label:'マイロ / ハシゴ 3',description:'実録ブーツの接地を短く・鈍く / 金属の踏み段用',gain:.13,rate:.88},
  rubberStep1:{file:'step-rubber-1.wav',label:'ドロイド / ゴム底 1',description:'実録：柔らかいゴム底の接地音',gain:.30},
  rubberStep2:{file:'step-rubber-2.wav',label:'ドロイド / ゴム底 2',description:'実録：柔らかいゴム底の接地音',gain:.28},
  rubberStep3:{file:'step-rubber-3.wav',label:'ドロイド / ゴム底 3',description:'実録：柔らかいゴム底の接地音',gain:.30},
  metal:{file:'metal.wav',label:'荷物の着地・金属の衝突',gain:.28},
  servo:{file:'servo-stroke.wav',label:'ドロイド / 関節の短い駆動音',description:'実録サーボ / 0.2秒・小音量・ループなし',gain:.055},
  shower:{file:'shower.wav',label:'シャワー / 流水',gain:.35,loop:true},
  flush:{file:'flush.wav',label:'トイレ / 排水',gain:.36},
  washer:{file:'washer.wav',label:'洗濯機 / 運転',gain:.27,loop:true},
  bag:{file:'bag.wav',label:'猫餌 / 袋の扱い',gain:.24},
  catMeow:{file:'cat-meow.wav',label:'ルーシー / 空腹の小さな鳴き声',description:'実録：空腹の猫 / 控えめ・たまに一声',gain:.14},
  chop:{file:'chop.wav',label:'調理 / 刻む',gain:.23},
});
export const CABIN_AUDIO_BASE='/3D/assets/obs/audio/';
