// 日本語／英語の言語切り替え。デフォルト日本語。
// t(key, vars) で文字列取得。setLang/toggleLang で切替＋登録済みの更新関数を一斉実行。

let lang = 'ja';
const localizers = [];

const DICT = {
  ja: {
    // フロア（FLOORS[].name をキーに）
    fl_HABITATION: '居住区', fl_OPERATIONS: '作業区', fl_ENGINEERING: '機関区',
    // 設備（station.id をキーに）
    st_shower: 'シャワー', st_toilet: 'トイレ', st_bunk: '寝台', st_lounge: 'ラウンジ',
    st_console: 'コンソール', st_stereo: 'ステレオ', st_galley: '調理室',
    st_hydro: '給水', st_hatch: '補給ハッチ',
    // HUD
    hud_time: '時刻', hud_state: '状態', hud_rapport: '親愛', hud_supplies: '補給',
    need_hunger: '食料', need_thirst: '水分', need_energy: '体力', need_hygiene: '清潔', need_fun: '娯楽', need_bladder: 'トイレ',
    sup_food: '食料', sup_water: '水', sup_cat: '猫餌', sup_music: '音楽',
    // 気分
    mood_happy: '上機嫌', mood_content: '満足', mood_sad: '不満', mood_sick: '不調',
    // 状態ラベル
    state_idle: '待機', state_wants: '要求中', state_summon: '呼びかけ中', state_reading: '通信閲覧',
    // 補給パネル / 対話
    btn_food: 'F 食料', btn_water: 'W 水', btn_catfood: 'C 猫餌', btn_music: 'M 音楽',
    chat_ph: 'クルーに話しかける（please で機嫌が上がる）', chat_send: '送信',
    lang_btn: 'EN',
    // 呼びかけ
    want_supply: '{name} が補給を要求しています — {item}', want_play: '{name} がゲームに誘っています',
    want_social: '{name} が話したがっています', want_hint: '　— クリック / 補給キーで応答',
    item_food: '食料（FOOD）', item_water: '水（WATER）',
    // 司令部メッセージ
    hq: [
      'AUTH:PAX // 軌道補正シーケンス完了。\n機関部の冷却ログを確認せよ。',
      'AUTH:PAX // 補給ポッドの到達まで残り 6 時間。\nハッチ気密の自己診断を実行のこと。',
      'AUTH:PAX // 月面サンプルの解析結果を受領。\n異常値なし。通常勤務を継続せよ。',
      'AUTH:PAX // 通信中継の遅延を検知。\n次回同期まで手動ログを保持されたい。',
    ],
    // クルーの返答（配列はランダムで1つ選ぶ）
    r_greet: ['やあ。{tip}', 'おっ、来たね。{tip}', 'やあ、調子はどう？', 'よお、見ててくれるのか。'],
    r_bye: ['またね。', 'うん、また話そう。', '気をつけて。', 'いってらっしゃい、と言うべきかな。'],
    r_name: ['{name} だよ。この船で暮らしてる。', '{name}。よろしく。', '{name} さ。覚えておいて。'],
    r_mood: ['{mood}。{low}けどね。', '今は{mood}かな。{low}んだ。', '{mood}だよ。{low}のが難点だけど。'],
    r_thanks: ['どういたしまして。{tip}', 'いいってことよ。', 'こちらこそ。'],
    r_sorry: ['気にしてないよ。', '謝らなくていいさ。', 'もう忘れた。'],
    r_love: ['…照れるな。{tip}', '私もここが好きだよ。', 'ありがとう、嬉しいよ。'],
    r_praise: ['へへ、ありがとう。{tip}', 'そう言われると照れる。', '頑張った甲斐があった。'],
    r_joke: ['宇宙船の食堂はなぜ静か？ … 真空だからさ。', 'ブラックホールのジョークは…重すぎてオチない。', 'うーん、笑いの在庫も切らしててね。'],
    r_pax: ['PAX か。命令は的確だが、無口でね。', '司令部とは定時通信だけさ。', 'PAX が見てると思うと、背筋が伸びるよ。'],
    r_ship: ['古い船だけど、よく持ちこたえてる。', 'この船が今の私の世界さ。', '配管の音にもすっかり慣れたよ。'],
    r_cat: ['あいつか。気まぐれだが、いい相棒だ。', '猫は勝手に船中を歩き回ってる。', '餌を切らすと拗ねるから頼むよ。'],
    r_earth: ['地球か…たまに夜空で探すよ。', '帰れる日が来るのかな。', '故郷の海をよく夢に見る。'],
    r_space: ['星はいくら見ても飽きないね。', '月の影は、何度見ても静かだ。', '宇宙は広すぎて、たまに足がすくむ。'],
    r_mission: ['任務は淡々とこなすさ。', '記録を取り、機関を保つ。それが仕事だ。', '派手じゃないが、誰かがやらないとね。'],
    r_lonely: ['…正直、少しね。話してくれて助かる。', '一人じゃないと思えるよ、君がいると。', '寂しさには慣れたつもりだけど。'],
    r_bored: ['退屈なら、音楽でもかけようか。', 'ラウンジで気晴らしでもするよ。', '退屈は宇宙の友だちさ。'],
    r_scared: ['怖くない、と言えば嘘になる。', '不安なときは手を動かすに限る。', '大丈夫、まだ船は無事だ。'],
    r_dream: ['夢か…また地球の雨の匂いを嗅ぎたい。', '無事に任務を終えること、かな。', '叶うなら、もう一度故郷を歩きたい。'],
    r_time: ['宇宙だと時間の感覚は曖昧になるよ。', '船の時計だけが頼りさ。', '昼も夜も、自分で決めるしかない。'],
    r_hobby: ['記録を読み返すのが好きでね。', '音楽を聴くこと、かな。', '星の位置を眺めてるよ。'],
    r_age: ['歳の話か…宇宙では数えるのをやめたよ。', '気持ちはまだ若いさ。', 'さあね、時間が曖昧でね。'],
    r_meaning: ['難しいことを聞くね。', 'なぜ、か。考え出すと眠れなくなる。', '意味は後からついてくるさ、たぶん。'],
    r_help: ['ありがとう、でも今は大丈夫。{tip}', '手伝ってくれるのかい？心強いよ。', '困ったら声をかけるよ。'],
    r_sing: ['音痴だけど…ふんふん♪', '歌は得意じゃなくてね。', 'レコードに任せたいところだ。'],
    r_exercise: ['よし、少し体を動かすか。{tip}', '鈍らないようにしないとな。', '運動は大事だね。'],
    r_eat_ok: ['ありがたい、頂くよ。{tip}', 'ちょうど腹が減ってた。{tip}', '頂きます。'],
    r_eat_none: ['配給が切れてる。Fキー（か補給パネル）で食料を送ってくれ。', '食料がないんだ。Fキーで頼むよ。'],
    r_drink_ok: ['水だ、助かる。{tip}', '喉が渇いてたんだ。{tip}', 'ありがたく頂くよ。'],
    r_drink_none: ['水がない。Wキーで水を送ってくれないか。', '飲み水を切らしてる。Wキーで頼む。'],
    r_sleep: ['そうだね、少し休むよ。{tip}', '少し横になるか。{tip}', '眠気には勝てないな。'],
    r_shower: ['さっぱりしてくる。{tip}', 'ひと浴びしてくるよ。{tip}', '汗を流してくる。'],
    r_toilet: ['ちょっと失礼。{tip}', 'すぐ戻るよ。', '…お手洗いへ。'],
    r_music_ok: ['一曲かけよう。{tip}', '音楽は心の栄養さ。{tip}', 'いいレコードだ。'],
    r_music_none: ['レコードがない。Mキーで音楽を送ってくれ。', '音楽がほしいな。Mキーで頼むよ。'],
    r_play: ['いいね、息抜きしよう。{tip}', 'ゲームで気分転換だ。{tip}', 'たまには遊ばないとね。'],
    r_rude: ['そういう言い方はないだろう。', '…悲しくなるよ。', 'もう少し優しく頼む。'],
    r_polite: ['ありがとう、覚えておくよ。', '丁寧だね、助かるよ。', 'そう言ってもらえると嬉しい。'],
    r_default: ['うん、聞いてるよ。', 'なるほどね。', 'ふむ、続けて。', 'そうかい。', '聞こえてるよ。'],
    r_default_q: ['さあ、どうだろうね。', 'うーん、考えたこともなかった。', 'いい質問だ。答えに困るよ。', 'どうかな、君はどう思う？'],
    r_default_excl: ['おお、元気だね。', 'はは、いいね。', 'その勢い、嫌いじゃない。'],
    r_agree: ['だね。', 'うん、その通り。', '同感だよ。'],
    r_deny: ['そうか…まあいいさ。', 'なるほど、違うのか。', 'ふむ、了解。'],
    r_ok: ['了解。{tip}', 'わかった。', 'オーケー。'],
    r_surprise: ['だろう？驚くよな。', 'ああ、本当さ。', 'へえ、と思うだろ。'],
    r_laugh: ['ふふ。', 'はは、いいね。', '笑ってくれたか。'],
    r_weather: ['宇宙に天気はないけど、船内は快適さ。', '窓の外はいつも星空だよ。', '気圧も温度も、今は安定してる。'],
    r_like_q: ['ああ、好きだよ。', 'どちらかと言えば好きだね。', 'うーん、悪くない。'],
    r_favorite: ['一番か…難しいな。', 'どれも捨てがたいよ。', '強いて言えば、静かな時間かな。'],
    r_congrats: ['ありがとう。{tip}', '祝ってくれるのか、嬉しいよ。', 'へへ、照れるな。'],
    r_goodluck: ['ありがとう、頑張るよ。{tip}', 'その言葉、力になる。', '応援、感謝するよ。'],
    r_meta_ai: ['さあ、どうだろうね。私は私さ。', '本物かどうかは、君が決めることさ。', 'ここに居る。それで十分だろう？'],
    r_likeme: ['もちろん、君は大事な相手だよ。{tip}', '嫌いなわけがないだろう。', '君がいないと退屈でね。'],
    r_come: ['今行くよ。', 'どうした？', 'はいはい、すぐに。'],
    r_wait: ['ああ、待つよ。', 'ゆっくりでいい。', '急がないさ。'],
    r_look: ['ん、どこだい？', 'おっ、何かあったか。', 'どれどれ。'],
    r_family: ['家族か…元気にしてるといいが。', '故郷に置いてきた者を、よく思い出すよ。', '便りは届かないけど、信じてる。'],
    r_friend: ['友か。君もその一人さ。', '船では貴重な存在だよ。', 'ありがたいね、そういう相手は。'],
    r_color: ['青かな。地球の海の色だ。', '深い藍が好きでね。', '宇宙の黒も、嫌いじゃない。'],
    r_playerTired: ['無理するなよ。{tip}', '君も休んだ方がいい。', 'お互い、ほどほどにな。'],
    r_miss: ['その気持ち、よく分かるよ。', '懐かしさは、宝物さ。', '私もだよ。'],
    r_secret: ['…ここだけの話にしておこう。', '内緒の話は嫌いじゃない。', 'ふっ、墓場まで持っていくよ。'],
    r_doing_idle: ['今は手が空いてるよ。', 'ぶらぶらしてるだけさ。', '特に何も。君と話してる。'],
    r_doing_act: ['今は{station}にいるよ。', '{station}の最中さ。', 'ちょうど{station}でね。'],
    tip_polite: '（喜んで）', pre_rude: '…',
    mw_happy: 'すこぶる good', mw_content: 'まあまあ', mw_sad: '正直しんどい', mw_sick: '体調が悪い',
    low_hunger: '腹が減ってる', low_thirst: '喉が渇いた', low_energy: '眠い', low_hygiene: 'シャワー浴びたい', low_fun: '退屈だ', low_bladder: 'トイレに行きたい',
    // 応答
    ack_play: '{name}: やった、付き合ってくれるんだね。', ack_social: '{name}: 顔を見られて安心したよ。',
    ack_supply: '{name}: 気づいてくれた？ {item}を切らしてるんだ。',
    plain_food: '食料', plain_water: '水',
  },
  en: {
    fl_HABITATION: 'HABITATION', fl_OPERATIONS: 'OPERATIONS', fl_ENGINEERING: 'ENGINEERING',
    st_shower: 'SHOWER', st_toilet: 'TOILET', st_bunk: 'BUNK', st_lounge: 'LOUNGE',
    st_console: 'CONSOLE', st_stereo: 'STEREO', st_galley: 'GALLEY',
    st_hydro: 'HYDRO', st_hatch: 'SUPPLY HATCH',
    hud_time: 'TIME', hud_state: 'STATE', hud_rapport: 'RAPPORT', hud_supplies: 'SUPPLIES',
    need_hunger: 'HUNGER', need_thirst: 'THIRST', need_energy: 'ENERGY', need_hygiene: 'HYGIENE', need_fun: 'FUN', need_bladder: 'RELIEF',
    sup_food: 'food', sup_water: 'water', sup_cat: 'cat', sup_music: 'music',
    mood_happy: 'HAPPY', mood_content: 'CONTENT', mood_sad: 'SAD', mood_sick: 'SICK',
    state_idle: 'IDLE', state_wants: 'WANTS HELP', state_summon: 'CALLING', state_reading: 'READING',
    btn_food: 'F Food', btn_water: 'W Water', btn_catfood: 'C Cat food', btn_music: 'M Music',
    chat_ph: 'Talk to the crew (saying "please" helps)', chat_send: 'Send',
    lang_btn: 'JP',
    want_supply: '{name} is asking for supplies — {item}', want_play: '{name} wants to play a game',
    want_social: '{name} wants to talk', want_hint: '　— click / press a supply key to answer',
    item_food: 'FOOD', item_water: 'WATER',
    hq: [
      'AUTH:PAX // Orbital correction complete.\nReview the engine-bay coolant logs.',
      'AUTH:PAX // Supply pod ETA: 6 hours.\nRun the hatch seal self-diagnostic.',
      'AUTH:PAX // Lunar sample analysis received.\nNo anomalies. Continue routine duty.',
      'AUTH:PAX // Relay latency detected.\nHold manual logs until next sync.',
    ],
    r_greet: ['Hey.{tip}', 'Oh, you’re here.{tip}', 'Hey, how’s it going?', 'So you’re watching, huh.'],
    r_bye: ['See you.', 'Let’s talk again.', 'Take care.', 'Off you go, then.'],
    r_name: ["I'm {name}. I live on this ship.", "{name}. Nice to meet you.", "{name}. Don't forget it."],
    r_mood: ['{mood}. {low}, though.', 'Right now? {mood}. {low}.', '{mood}, aside from {low}.'],
    r_thanks: ["You're welcome.{tip}", 'Anytime.', 'My pleasure.'],
    r_sorry: ["It's fine.", 'No need to apologize.', 'Already forgotten.'],
    r_love: ['…you’re making me blush.{tip}', 'I’m fond of this place too.', 'Thanks, that means a lot.'],
    r_praise: ['Heh, thanks.{tip}', 'You flatter me.', 'It was worth the effort.'],
    r_joke: ['Why is the galley so quiet in space? … It’s a vacuum.', 'I had a black-hole joke, but it was too dense.', 'I’m fresh out of punchlines, sorry.'],
    r_pax: ['PAX. Precise orders, few words.', 'I only get scheduled comms from command.', 'Knowing PAX is watching keeps me sharp.'],
    r_ship: ['Old ship, but she holds together.', 'This vessel is my whole world now.', 'I’ve gotten used to the pipes groaning.'],
    r_cat: ['That one? Fickle, but good company.', 'The cat wanders the whole ship.', 'Run out of its food and it sulks—please don’t.'],
    r_earth: ['Earth… I look for it in the dark sometimes.', 'I wonder if I’ll make it back.', 'I dream of the sea back home.'],
    r_space: ['I never tire of the stars.', 'The shadow of the moon is so quiet.', 'Space is so vast it makes my knees weak.'],
    r_mission: ['I just work the mission, steadily.', 'Keep the logs, keep the engines. That’s the job.', 'Not glamorous, but someone has to.'],
    r_lonely: ['…honestly, a little. Glad you’re here.', 'With you around, I don’t feel so alone.', 'I thought I was used to the solitude.'],
    r_bored: ['If you’re bored, I’ll put on some music.', 'I’ll unwind in the lounge.', 'Boredom is an old friend out here.'],
    r_scared: ['I’d be lying if I said I wasn’t afraid.', 'When uneasy, I keep my hands busy.', 'It’s okay—the ship still holds.'],
    r_dream: ['A dream? To smell rain on Earth again.', 'To finish the mission safely, I suppose.', 'If I could, I’d walk my hometown once more.'],
    r_time: ['Time gets blurry out in space.', 'The ship’s clock is all I’ve got.', 'Day or night, I decide it myself.'],
    r_hobby: ['I like re-reading old logs.', 'Listening to music, I’d say.', 'I watch the position of the stars.'],
    r_age: ['My age? I stopped counting out here.', 'Young at heart, at least.', 'Who knows—time’s fuzzy.'],
    r_meaning: ['That’s a heavy question.', 'Why, huh. Think too hard and I can’t sleep.', 'Meaning catches up later, maybe.'],
    r_help: ['Thanks, but I’m okay for now.{tip}', 'You’d help me? That’s reassuring.', 'I’ll call if I’m stuck.'],
    r_sing: ['I’m tone-deaf, but… hmm-hmm♪', 'Singing isn’t my strong suit.', 'I’d leave that to the records.'],
    r_exercise: ['Right, time to move a little.{tip}', 'Got to stay sharp.', 'Exercise matters.'],
    r_eat_ok: ["Thanks, I'll eat.{tip}", 'I was just getting hungry.{tip}', 'Much obliged.'],
    r_eat_none: ['Out of rations. Send food with the F key (or the panel).', 'No food here. The F key, please.'],
    r_drink_ok: ['Water, thanks.{tip}', 'I was parched.{tip}', 'Gratefully accepted.'],
    r_drink_none: ['No water. Could you send some with the W key?', 'Out of drinking water. W key, please.'],
    r_sleep: ["Right, I'll rest a bit.{tip}", 'I’ll lie down for a while.{tip}', 'Can’t fight the drowsiness.'],
    r_shower: ["I'll freshen up.{tip}", 'Going for a quick wash.{tip}', 'I’ll rinse off.'],
    r_toilet: ['Excuse me a moment.{tip}', 'Be right back.', '…off to the head.'],
    r_music_ok: ["Let's put on a track.{tip}", 'Music feeds the soul.{tip}', 'A fine record.'],
    r_music_none: ['No records. Send music with the M key.', 'I’d love some music. M key, please.'],
    r_play: ["Sure, let's unwind.{tip}", 'A game to clear my head.{tip}', 'Need to play once in a while.'],
    r_rude: ["That's no way to talk to me.", '…that stings.', 'Please, a little kindness.'],
    r_polite: ["Thank you, I'll remember that.", 'Polite as ever—appreciated.', 'That’s kind of you to say.'],
    r_default: ["Yeah, I'm listening.", 'I see.', 'Hm, go on.', 'Is that so.', 'Mm, I hear you.'],
    r_default_q: ['Hard to say.', 'Hm, never thought about it.', 'Good question. I’m stumped.', 'Dunno—what do you think?'],
    r_default_excl: ['Oh, you’re lively.', 'Haha, nice.', 'I like that energy.'],
    r_agree: ['Right.', 'Yeah, exactly.', 'Agreed.'],
    r_deny: ['I see… well, alright.', 'Not so, huh. Noted.', 'Hm, understood.'],
    r_ok: ['Got it.{tip}', 'Alright.', 'Okay.'],
    r_surprise: ['Right? It’s something.', 'Yeah, it’s true.', 'Makes you think, huh.'],
    r_laugh: ['Heh.', 'Haha, nice.', 'Glad that landed.'],
    r_weather: ['No weather in space, but it’s comfy inside.', 'Always starry outside the window.', 'Pressure and temp are stable right now.'],
    r_like_q: ['Yeah, I like it.', 'I’d say I do.', 'Hm, not bad at all.'],
    r_favorite: ['A favorite, huh… tough one.', 'Hard to pick just one.', 'If anything, the quiet hours.'],
    r_congrats: ['Thanks.{tip}', 'Kind of you to celebrate.', 'Heh, you’re making me blush.'],
    r_goodluck: ['Thanks, I’ll do my best.{tip}', 'That gives me strength.', 'I appreciate the support.'],
    r_meta_ai: ['Who’s to say? I’m just me.', 'Real or not—that’s yours to decide.', 'I’m here. Isn’t that enough?'],
    r_likeme: ['Of course, you matter to me.{tip}', 'How could I not?', 'It’d be dull here without you.'],
    r_come: ['Coming.', 'What is it?', 'Alright, on my way.'],
    r_wait: ['Sure, I’ll wait.', 'Take your time.', 'No rush.'],
    r_look: ['Hm, where?', 'Oh, something there?', 'Let’s see.'],
    r_family: ['Family… I hope they’re well.', 'I often think of those I left home.', 'No word reaches me, but I trust they’re fine.'],
    r_friend: ['A friend, huh. You’re one of them.', 'Rare company out here.', 'I’m grateful for that.'],
    r_color: ['Blue. The color of Earth’s sea.', 'I like a deep indigo.', 'The black of space isn’t bad either.'],
    r_playerTired: ['Don’t overdo it.{tip}', 'You should rest too.', 'Easy does it, for both of us.'],
    r_miss: ['I know that feeling well.', 'Nostalgia is a treasure.', 'Me too.'],
    r_secret: ['…let’s keep it between us.', 'I don’t mind a secret.', 'Heh, I’ll take it to the grave.'],
    r_doing_idle: ['I’m free at the moment.', 'Just wandering about.', 'Nothing much—talking with you.'],
    r_doing_act: ['I’m at the {station} right now.', 'In the middle of {station}.', 'Just at the {station}.'],
    tip_polite: ' (gladly)', pre_rude: '…',
    mw_happy: 'Great', mw_content: 'So-so', mw_sad: 'Honestly rough', mw_sick: 'I feel ill',
    low_hunger: "I'm hungry", low_thirst: "I'm thirsty", low_energy: "I'm sleepy", low_hygiene: 'I want a shower', low_fun: "I'm bored", low_bladder: 'I need the toilet',
    ack_play: "{name}: Yes! You'll join me.", ack_social: '{name}: Good to see your face.',
    ack_supply: "{name}: You noticed? I'm out of {item}.",
    plain_food: 'food', plain_water: 'water',
  },
};

export function t(key, vars) {
  let s = DICT[lang][key];
  if (s === undefined) s = DICT.en[key] !== undefined ? DICT.en[key] : key;
  if (vars && typeof s === 'string') {
    for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  }
  return s;
}

// 値が配列ならランダムで1つ選ぶ。返答のバリエーション用。
export function line(key, vars) {
  let v = DICT[lang][key];
  if (v === undefined) v = DICT.en[key];
  if (v === undefined) v = key;
  let s = Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;
  if (vars && typeof s === 'string') {
    for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  }
  return s;
}

export function hqList() { return DICT[lang].hq; }
export function getLang() { return lang; }
export function onLangChange(fn) { localizers.push(fn); }

export function setLang(l) {
  lang = l;
  localizers.forEach(f => f());
}
export function toggleLang() {
  setLang(lang === 'ja' ? 'en' : 'ja');
  return lang;
}
