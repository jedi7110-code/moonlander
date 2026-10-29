// 自律AI（ユーティリティAI + 状態機械）+ 感情・欲求・呼びかけ・対話。
// 原典LCPの DNA を翻案:
//  - needs 減衰 → 最枯渇の「満たせる」欲求を選んで自分で過ごす
//  - 消耗品が要る欲求（食料/水）で在庫が切れると → こちらをモニターで叩いて要求（四の壁）
//  - 4気分（mood.js）・rapport（礼儀／応答で上下）
//  - 文章入力に礼儀込みで応答（handleChat）

import { STATIONS, getStation } from './layout.js?v=15';
import { moodFromState } from './mood.js?v=15';
import { t, line } from './i18n.js?v=15';

// ゆっくり・バランス良く減る。水/食料/体力はほぼ同ペース。
const DECAY = { hunger: 0.5, thirst: 0.5, energy: 0.5, hygiene: 0.45, fun: 0.6, bladder: 0.6 }; // /sec
const ACT_SYM = { shower: '🚿', toilet: '🚽', bunk: '💤', lounge: '🎮', stereo: '🎵', galley: '🍽', hydro: '🚰' };
const CARRY_SYM = { food: '🍱', water: '💧', music: '💿' };

const SOCIAL_INTERVAL = 30;   // 構ってほしくなるまで(秒)
const KNOCK_TIMEOUT = 16;     // 無視され続けると諦める(秒)
const KNOCK_BEAT = 1.3;       // ノック間隔(秒)
const WANT_COOLDOWN = 18;     // 応答/諦め後、次に呼ぶまでの猶予(秒)

export class Brain {
  constructor(scene, actor, opts = {}) {
    this.scene = scene;
    this.actor = actor;
    this.care = opts.care;
    this.name = opts.name || 'MILO';

    this.needs = { hunger: 72, thirst: 70, energy: 82, hygiene: 78, fun: 70, bladder: 75 };
    this.rapport = 60;
    this.sick = false; this.sickT = 0;
    this.mood = 'content';

    this.state = 'idle';
    this.idleT = 0; this.idleDelay = 1.6;
    this.performT = 0; this.curDurSec = 1; this.recoverNeed = null; this.cur = null;

    this.want = null;            // { kind:'supply'|'social'|'play', supply, stationId }
    this.knockT = 0; this.knockBeat = 0;
    this.socialT = 0; this.wantCoolT = 0;

    this.dayMs = 240000;
    this.clock = 8 * this.dayMs / 24;
    this.actKey = 'idle';     // HUD 状態（言語非依存キー）
    this.actStation = null;   // going/perform 時の station id
  }

  get hour() { return (this.clock / this.dayMs * 24) % 24; }
  isCalling() { return this.state === 'summoning' || this.state === 'knocking'; }

  _decayMul(n) {
    const h = this.hour;
    if (n === 'energy' && (h >= 22 || h < 6)) return 1.4;
    if (n === 'hunger' && ((h >= 11 && h < 13) || (h >= 18 && h < 20))) return 1.4;
    if (n === 'fun' && h >= 20 && h < 22) return 1.4;
    return 1;
  }

  update(dt) {
    this.clock = (this.clock + dt * 1000) % this.dayMs;
    if (this.wantCoolT > 0) this.wantCoolT -= dt;

    // 欲求の減衰（実行中の回復対象は除く）
    for (const k in this.needs) {
      if (this.state === 'performing' && this.recoverNeed === k) continue;
      this.needs[k] = Math.max(0, this.needs[k] - DECAY[k] * this._decayMul(k) * dt);
    }

    // 体調（継続枯渇で sick、回復で戻る）
    const lowest = Math.min(...Object.values(this.needs));
    if (lowest < 10) this.sickT += dt; else this.sickT = Math.max(0, this.sickT - dt * 2);
    this.sick = this.sickT > 6;

    this.mood = moodFromState(this.needs, this.rapport, this.sick);

    // 状態機械
    if (this.state === 'idle') {
      this.idleT += dt;
      this._maybeWant(dt);
      if (!this.want && this.idleT >= this.idleDelay) this._choose();
      this.actKey = this.want ? 'wants' : 'idle';
    } else if (this.state === 'performing') {
      this.performT -= dt;
      if (this.recoverNeed) {
        this.needs[this.recoverNeed] = Math.min(100, this.needs[this.recoverNeed] + (100 / this.curDurSec) * dt);
      }
      if (this.performT <= 0) this._endPerform();
    } else if (this.state === 'reading') {
      this.performT -= dt;
      if (this.performT <= 0) { this.actor.setSymbol(''); this._toIdle(); }
    } else if (this.state === 'knocking') {
      this.knockT += dt; this.knockBeat -= dt;
      if (this.knockBeat <= 0) {
        this.knockBeat = KNOCK_BEAT;
        this.actor.knock();
        if (this.scene.obsUI) this.scene.obsUI.flashMonitor();
        const s = this.scene.sound.add('command', { volume: 0.3 });
        s.play(); s.once('complete', () => s.destroy());
      }
      if (this.knockT >= KNOCK_TIMEOUT) this._giveUp();
    }
  }

  // --- 欲求生成（四の壁の呼びかけ） ---
  _maybeWant() {
    if (this.want || this.wantCoolT > 0) return;
    this.socialT += 1 / 60; // ざっくり加算（idle毎フレーム）
    if (this.needs.hunger < 28 && !this.care.has('food')) return this._setWant('supply', 'food', 'galley');
    if (this.needs.thirst < 28 && !this.care.has('water')) return this._setWant('supply', 'water', 'hydro');
    if (this.socialT > SOCIAL_INTERVAL) {
      this.socialT = 0;
      this._setWant(Math.random() < 0.5 ? 'play' : 'social');
    }
  }

  _setWant(kind, supply = null, stationId = null) {
    this.want = { kind, supply, stationId };
    this._summon();
  }

  _wantText() {
    if (!this.want) return '';
    if (this.want.kind === 'supply') {
      const item = this.want.supply === 'food' ? t('item_food') : t('item_water');
      return t('want_supply', { name: this.name, item }) + t('want_hint');
    }
    if (this.want.kind === 'play') return t('want_play', { name: this.name }) + t('want_hint');
    return t('want_social', { name: this.name }) + t('want_hint');
  }

  _summon() {
    if (this.isCalling()) return;
    this.state = 'summoning';
    this.actKey = 'summon'; this.actStation = null;
    this.actor.setSymbol('❗');
    this.actor.goTo(getStation('console'), () => {
      this.state = 'knocking';
      this.knockT = 0; this.knockBeat = 0;
      if (this.scene.obsUI) this.scene.obsUI.showWant(this._wantText());
    });
  }

  // --- 自律的な活動選択 ---
  _usable(st) {
    if (!st.supply) return true;
    return this.care.has(st.supply);
  }

  _choose() {
    const order = Object.keys(this.needs).sort((a, b) => this.needs[a] - this.needs[b]);
    for (const need of order) {
      const opts = STATIONS.filter(s => s.need === need && this._usable(s));
      if (opts.length) {
        // 消耗品の要らない拠点を優先（在庫温存）
        opts.sort((a, b) => (a.supply ? 1 : 0) - (b.supply ? 1 : 0));
        return this._go(opts[0]);
      }
    }
    this.idleT = 0; // 何も選べない（基本起きない）
  }

  _go(station) {
    this.cur = station;
    this.actKey = 'going'; this.actStation = station.id;
    if (station.supply) {
      // 補給ハッチへ取りに行き、運んでから使う
      this.state = 'goingTo';
      this.actor.setSymbol('');
      this.actor.goTo(getStation('hatch'), () => {
        if (this.care.take(station.supply)) this.actor.setSymbol(CARRY_SYM[station.supply] || '');
        this.actor.goTo(station, () => this._startPerform(station));
      });
    } else {
      this.state = 'goingTo';
      this.actor.goTo(station, () => this._startPerform(station));
    }
  }

  _startPerform(station) {
    this.state = 'performing';
    this.recoverNeed = station.need;
    this.performT = station.dur / 1000;
    this.curDurSec = station.dur / 1000;
    this.actor.setSymbol(ACT_SYM[station.id] || '•');
    this.actKey = 'perform'; this.actStation = station.id;
  }

  _endPerform() {
    this.actor.setSymbol('');
    this.recoverNeed = null; this.cur = null;
    this._toIdle();
  }

  _toIdle() {
    this.state = 'idle';
    this.idleT = 0;
    this.idleDelay = 1.4 + Math.random() * 2.4;
    this.actKey = 'idle'; this.actStation = null;
  }

  _giveUp() {
    this.rapport = Math.max(0, this.rapport - 8);
    if (this.scene.obsUI) this.scene.obsUI.hideWant();
    // 食料/水の要求は満たされるまで残す（クールダウン後また呼ぶ）
    if (this.want && this.want.kind !== 'supply') this.want = null;
    this.wantCoolT = WANT_COOLDOWN;
    this.actor.setSymbol('😞');
    this.scene.time.delayedCall(1500, () => { if (this.state === 'idle') this.actor.setSymbol(''); });
    this._toIdle();
  }

  // --- プレイヤー応答 ---
  // モニタークリックで呼びかけに応える。返答文字列を返す（あれば console が表示）。
  acknowledge() {
    if (!this.isCalling()) return null;
    const w = this.want;
    if (this.scene.obsUI) this.scene.obsUI.hideWant();
    this.rapport = Math.min(100, this.rapport + 10);
    this.socialT = 0;
    this.wantCoolT = WANT_COOLDOWN;

    if (w && w.kind === 'play') {
      this.want = null;
      this._go(getStation('lounge'));
      return t('ack_play', { name: this.name });
    }
    if (w && w.kind === 'social') {
      this.want = null;
      this._toIdle();
      return t('ack_social', { name: this.name });
    }
    // supply: 注目は嬉しいが、品が届くまで要求は残る
    this._toIdle();
    return w && w.kind === 'supply'
      ? t('ack_supply', { name: this.name, item: w.supply === 'food' ? t('plain_food') : t('plain_water') })
      : null;
  }

  // 補給投入の通知（care から）
  onSupplyDelivered(type) {
    if (this.want && this.want.kind === 'supply' && this.want.supply === type) {
      if (this.scene.obsUI) this.scene.obsUI.hideWant();
      this.rapport = Math.min(100, this.rapport + 5);
      const stationId = this.want.stationId;
      this.want = null; this.wantCoolT = 0;
      this._go(getStation(stationId));
    }
  }

  // HQ メッセージ受信のためコンソールへ（player がノック以外でクリックした時）
  requestCommand() {
    if (this.state === 'reading' || this.state === 'goingToConsole' || this.isCalling()) return false;
    this.state = 'goingToConsole';
    this.actKey = 'going'; this.actStation = 'console';
    this.actor.setSymbol('✉');
    this.actor.goTo(getStation('console'), () => {
      this.state = 'reading'; this.performT = 10; this.actKey = 'reading'; this.actStation = null; this.actor.setSymbol('✉');
    });
    return true;
  }

  // --- 文章入力に応答（礼儀込み・言語連動・返答はランダム選択） ---
  handleChat(text) {
    const polite = /please|thank|ありがと|お願|ください|くれ\b/i.test(text);
    const rude = /stupid|idiot|shut up|hurry|now!|うざ|黙れ|バカ|死ね/i.test(text);

    this.rapport = Math.min(100, Math.max(0, this.rapport + (polite ? 7 : rude ? -9 : 1)));
    this.socialT = 0;
    const pre = rude ? t('pre_rude') : '';
    const tip = polite ? t('tip_polite') : '';
    const reply = (key, vars) => `${this.name}: ${pre}` + line(key, Object.assign({ tip, name: this.name }, vars));

    // 在庫依存（食事・水・音楽）：あるかどうかで返答が変わる
    if (/eat|food|hungry|食べ|食事|腹|めし|ごはん/i.test(text)) {
      if (this.care.has('food')) { this._go(getStation('galley')); return reply('r_eat_ok'); }
      return reply('r_eat_none');
    }
    if (/drink|water|thirst|水|喉|のど/i.test(text)) {
      if (this.care.has('water')) { this._go(getStation('hydro')); return reply('r_drink_ok'); }
      return reply('r_drink_none');
    }
    if (/music|音楽|曲|レコード|tune/i.test(text)) {
      if (this.care.has('music')) { this._go(getStation('stereo')); return reply('r_music_ok'); }
      return reply('r_music_none');
    }
    // 気分（変数あり）
    if (/how are you|how do you|feeling|調子|元気|気分/i.test(text)) {
      const mood = t('mw_' + this.mood);
      const low = Object.keys(this.needs).sort((a, b) => this.needs[a] - this.needs[b])[0];
      return reply('r_mood', { mood, low: t('low_' + low) });
    }
    // 「今なにしてる？」→ 現在の状態を答える（状態連動）
    if (/what are you doing|what're you|what you up to|なにして|何して|今なにを|なにやって/i.test(text)) {
      if ((this.actKey === 'perform' || this.actKey === 'going') && this.actStation) {
        return reply('r_doing_act', { station: t('st_' + this.actStation) });
      }
      return reply('r_doing_idle');
    }
    // プレイヤーが「疲れた」→ いたわり（クルーが寝るのとは別）
    if (/i'?m tired|so tired|疲れた|つかれた|くたびれ/i.test(text)) return reply('r_playerTired');

    // その他の意図（最初に一致したもの。station があればそこへ移動）
    for (const it of INTENTS) {
      if (it.re.test(text)) {
        if (it.station) this._go(getStation(it.station));
        return reply('r_' + it.id);
      }
    }

    // フォールバック（文型で返し分け）
    if (rude) return reply('r_rude');
    if (polite) return reply('r_polite');
    if (/[?？]|\bか$|のか|なの\b|だろうか/.test(text.trim())) return reply('r_default_q');
    if (/[!！]{1,}$|すご|やった|うおお|わーい/.test(text.trim())) return reply('r_default_excl');
    return reply('r_default');
  }
}

// 文章入力で認識する意図（上から順に最初の一致を採用）。station があればそこへ歩く。
const INTENTS = [
  { id: 'greet', re: /hello|hi\b|hey\b|こんにち|やあ|おはよ|よお|こんばん|どうも/i },
  { id: 'bye', re: /\bbye|goodbye|see you|またね|じゃあね|おやすみ|さよなら|さらば/i },
  { id: 'name', re: /your name|who are you|だれ|誰|名前|なまえ/i },
  { id: 'thanks', re: /thank|thanks|ありがと|感謝/i },
  { id: 'sorry', re: /sorry|apolog|ごめん|すまな|悪かった/i },
  { id: 'love', re: /love you|i love you|大好き|だいすき|愛してる|愛して/i },
  { id: 'praise', re: /good job|well done|\bnice\b|great|amazing|すごい|偉い|えらい|上手|さすが|最高/i },
  { id: 'joke', re: /joke|funny|laugh|笑わせ|冗談|ジョーク|おもしろ/i },
  { id: 'pax', re: /\bpax\b|command|司令|組織|本部/i },
  { id: 'ship', re: /this ship|the ship|この船|船は|どこにいる/i },
  { id: 'cat', re: /\bcat\b|kitty|猫|ねこ|ニャ/i },
  { id: 'earth', re: /earth|地球|故郷|帰りた|ふるさと/i },
  { id: 'space', re: /\bstar|space|\bmoon|宇宙|星|月|銀河/i },
  { id: 'mission', re: /mission|task|duty|\bjob|\bwork|任務|仕事|使命/i },
  { id: 'lonely', re: /lonely|alone|寂し|さみし|ひとり|孤独/i },
  { id: 'bored', re: /bored|boring|退屈|つまらな|ひま/i },
  { id: 'scared', re: /scared|afraid|fear|怖|不安|こわ/i },
  { id: 'dream', re: /dream|夢|願い|ねがい/i },
  { id: 'time', re: /what time|time now|今何時|何時|時間|時刻/i },
  { id: 'hobby', re: /hobby|趣味|好きなこと/i },
  { id: 'age', re: /how old|your age|年齢|いくつ|何歳|歳/i },
  { id: 'meaning', re: /\bwhy\b|meaning|purpose|なぜ|意味|どうして|なんで/i },
  { id: 'help', re: /\bhelp|手伝|助け|たすけ/i },
  { id: 'sing', re: /\bsing|歌って|歌え|歌を/i },
  // 話題・小話
  { id: 'family', re: /\bfamily|parents|地球の家族|家族|両親|妻|夫|子供|子ども/i },
  { id: 'friend', re: /\bfriend|友達|ともだち|仲間/i },
  { id: 'color', re: /favou?rite colou?r|好きな色|何色|色は/i },
  { id: 'favorite', re: /favou?rite|一番好き|お気に入り|イチオシ/i },
  { id: 'likeme', re: /like me\b|私のこと|わたしのこと|俺のこと|僕のこと/i },
  { id: 'like_q', re: /do you like|do you enjoy|好きなの|好き\?|好き？|嫌いなの/i },
  { id: 'weather', re: /weather|天気|晴れ|雨\b|雪\b|寒い|暑い/i },
  { id: 'congrats', re: /congrat|おめでと|お祝い/i },
  { id: 'goodluck', re: /good luck|頑張って|がんばって|応援|ファイト/i },
  { id: 'meta_ai', re: /are you (an? )?ai|are you real|are you human|本物なの|ロボット|人間なの|ai なの|ai\?/i },
  { id: 'miss', re: /i miss|懐かし|なつかし|恋しい/i },
  { id: 'secret', re: /secret|秘密|内緒|ないしょ/i },
  // 依頼・指示
  { id: 'come', re: /come here|come over|follow me|こっち来|こっちおいで|ついてき|来て/i },
  { id: 'wait', re: /\bwait\b|hold on|待って|止まって|ストップ/i },
  { id: 'look', re: /look at|look there|見て|ほら|あれ見/i },
  { id: 'exercise', re: /exercise|workout|運動|筋トレ|体操/i, station: 'lounge' },
  { id: 'sleep', re: /\bsleep|go to bed|寝て|寝る|眠|休んで|休む/i, station: 'bunk' },
  { id: 'shower', re: /shower|wash|clean|浴|シャワー|洗っ/i, station: 'shower' },
  { id: 'toilet', re: /toilet|bathroom|restroom|トイレ|便所|手洗|用足/i, station: 'toilet' },
  { id: 'play', re: /\bplay|\bgame|遊|ゲーム|踊|dance/i, station: 'lounge' },
  // 相づち・反応（具体的な話題の後＝最後に判定）
  { id: 'agree', re: /^(yes|yeah|yep|sure|right)\b|うん$|はい$|そうだね|そうそう|だよね|同感|確かに|わかる/i },
  { id: 'deny', re: /^(no|nope)\b|not really|いや|違う|ちがう|そうじゃ|嫌だ/i },
  { id: 'ok', re: /\bok\b|okay|alright|got it|了解|わかった|オーケー|オッケ/i },
  { id: 'surprise', re: /wow|whoa|woah|really\?|マジ|まじ|本当\?|ほんと\?|へえ|うそ|えっ/i },
  { id: 'laugh', re: /\blol\b|haha|hehe|\bww+|笑|わら/i },
];
