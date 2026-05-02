# Moonlander - プロジェクトメモ

## 技術スタック
- Phaser 3.55.2（CDN）
- シングルHTML + CSS
- アセット: assets/ ディレクトリ

## 今後のビジョン（ゲーム展開）

### Stage 1: 月面着陸（現在のゲーム）✅
- 宇宙船を操作してデブリを避けながらゴールに着陸
- 水平＋低速で着地するとクリア

### Stage 2: 宇宙飛行士降下（次に実装）
- 着陸成功後、宇宙飛行士がハシゴを降りてくる演出
- spaceman.png アセットあり

### Stage 3: 地上戦アクション（将来）
- 横スクロールアクション
- ビーム銃撃で地中から出てくるエイリアンを倒す
- 大型車でエイリアンを引き倒す

### Stage 4: クルー救出ミッション（将来）
- 各地に散らばったクルーを救出していく
- マップ探索要素

## 実装済み機能
- 燃料ゲージ（宇宙船右側・縦型・追従）
- ジェット噴射パーティクル（4方向スラスター）
- 粉塵エフェクト（4方向扇状・距離連動・月面灰色）
- カメラ遅延追従（Lerp）
- ターゲットマーク（楕円＋十字・距離で緑→オレンジフェード）
- 着陸判定（水平±5度・低速80以下・コトンと接地）
- ゴール外ゆっくり着地→爆発せずミッション失敗
- デブリ衝突判定（円形body）
- タイトル画面で宇宙船固定（重力0）
- ゴール地点ランダム化（画面横全体）

## 注意事項
- 地面判定値 `game.config.height - 63` は調整済み。変更しない
- 影のY値（初期+55、更新+66）は元コードから。触らない
- `setCollideWorldBounds(true)` は維持
- デブリの折り返しはカメラ表示範囲基準

## 音声アーキテクチャ（重要）

### 統一方針
- **すべての SE は Phaser sound（WebAudio）に統一**
- ブリーフィングのタイピング音 (`command`) と開始 SE (`comstart`) も以前は HTML5 Audio だったが、サイレント挙動の不一致を避けるため Phaser sound に変更済み
- `preload.js` の `startBriefing(loadingScreen, onDismiss, scene)` は **scene 引数必須**（Phaser sound 呼び出しのため）

### iOS Safari 対策（main.js 内）

#### 1. WebAudio context unlock（document タップ → resume）
- `resumeAudioContext()` をグローバル touch/click リスナーで呼び出し
- `context.resume()` + 無音 1 サンプル buffer 再生 + `scene.sound.unlock()` のフルコース
- Phaser の自動 unlock は body リスナーだが、HTML オーバーレイの stopPropagation で届かない場合があるため **document capture phase** で確実に処理

#### 2. サイレントスイッチ回避（`setupSilentAudioBypass`）
- 1秒の無音 WAV を Blob で生成 → 隠し `<audio loop playsinline>` でループ再生
- volume=0.001（完全0だと一部 iOS で session 昇格が起きない）
- 最初のユーザー操作で `.play()` → iOS audio session が **playback** に昇格 → WebAudio がサイレントスイッチを無視
- visibilitychange でページ復帰時に再開
- 全 capture phase listener / passive で他のタッチ動作を阻害しない

### よくある落とし穴
- ES module は aggressive cache される。`main.js` / `preload.js` 編集後は `index.html` の `?v=N` と `main.js` 内 import の `?v=N` を **両方** bump する
- 現在は `?v=7`
- `loadingScreen` への click/touchend で `e.preventDefault()` するのは OK だが `e.stopPropagation()` は呼ばないこと（Phaser の body 自動 unlock が効かなくなる）

## 開発フロー
- ローカル: `python3 -m http.server 8080`（`.claude/launch.json` で `moon-dev` という名前）
- 実機テスト: 同じ Wi-Fi で `http://192.168.1.203:8080/` （Mac の en0 IP は変動）
- 本番: Vercel（origin = GitHub `jedi7110-code/moonlander`、bitbucket もミラー）
- リモート: `origin`（GitHub）と `bitbucket` の両方にプッシュする運用

## 着陸ベース（基地）配置メモ
- `flag` / `flag-flash` の Y は `scene.moon.y + 35`（足元基準）
- 一時期 +70 オフセットを付けて画像を下げる検討をしたが、最終的に **コミット 950af11 の状態に戻した**（ユーザー判断）
- もし再度オフセット調整する場合は `js/create.js` の `flagGroundY` を編集
