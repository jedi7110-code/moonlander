# Lucy: Biological Study

## 現在の採用版（2026-09-15）

ユーザーの「全部OK、OBS反映」により、**伸び・伏せを含む全行動が採用済み・OBS本編反映済み**です。以下の「確認中」「本編未反映」は制作時の履歴で、現在の状態ではありません。

リポジトリ内の `3D` で `npm ci` の後、`node studies/lucy/study-server.mjs` を実行し、<http://127.0.0.1:8767/review/all-actions.html> を開きます。ドラッグ回転、ホイール拡大、視点選択、半速再生・時間スライダーで全動作を確認できます。`local/` やデスクトップ上の写真は不要です。起動にはNode 22.12以降を使用してください。

- 共通モデル: `public/assets/obs/lucy/lucy-cabin.glb`
- 横寝スタディーのクリップ供給元: `assets/sleep-side.glb`（同梱）
- 本編の姿勢と皮膚・瞼データ: `public/assets/obs/lucy/lucy-approved.json`
- 毛繕いの軽量補正: `public/assets/obs/lucy/lucy-groom.bin`
- 再生成: `node studies/lucy/build-approved-cabin.mjs` → `npm run build`
- 採用版検証: `node --test tests/obs-lucy-approved.test.js tests/obs-cat-approved-rest.test.js tests/obs-cat-turn.test.js studies/lucy/prone-study.test.js`
- 伸びの検証: `LUCY_SLEEP_BASE_ASSET=public/assets/obs/lucy/lucy-cabin.glb node --test studies/lucy/stretch-study.test.js`

本編では伸び・伏せも自律選択します。方向転換後に開始し、割り込み移動も立ち上がりまで待ちます。伸びの頭先行・閉じ目・接地、伏せの腹下面の追従先・水平な足根はスタディーと同じ採用版を60Hzで記録したデータから再生します。伏せのスキンウェイトと伸びの閉じ目形状は動作専用で、他の姿勢へ切り替わる際に元へ戻します。

## 制作履歴

伏せの赤線修正（2026-09-15）: 肘から先を床沿いに下げ、後ろ足は足根部から足先まで水平にし、足先を少し前へ。胸腹の皮膚が畳んだ脚に持ち上げられないよう、伏せ専用の複製ジオメトリで下腹中央のスキンウェイトを胴体へ寄せています。片側の太もも・足先・顔は対象外。頂点位置を床へ投影する補正は使わず、骨格と追従先で接地に近づけます。検証は全720フレームの床貫通・関節接続・往復スクラブ、腹下面の隙間、水平な足根、元ジオメトリへの非干渉。伸び・OBS本編は変更しません。

伸びのタイミング追記（2026-09-15）: 頭の引き始めは0.10秒、首は0.30秒、前足を置く準備は0.35秒、腰を後上方へ引くのは1.50秒。`headPull` / `neckPull` を胴体の `pull` から分離しました。頭の先行オフセットは首が追いつくと消えるため、伸び切りの位置・引く量・足の接地位置は変更しません。下記の旧「足を置いた後に頭も引く」タイミングを置き換えます。スタディー限定です。

2026-09-15 伏せスタディー: `all-actions.html#prone` の「伏せ（確認中）」は、写真を参考に前足を前へ伸ばし、後足を畳んで胸・腹・腰を下ろし、顔と目は起こしている姿勢です。12秒で伏せる→保持→立位へ戻るループ。尻尾は後足の横へ曲げます。骨長を維持した解析的IKと足裏の接地補正を使い、独立リグを毎フレーム復元するので他の動作に影響しません。OBS本編・配布GLBには未反映です。検証: `node --test studies/lucy/prone-study.test.js`。

2026-09-15 方向転換: OBSの3Dルーシーは `CatRoutine(care,{turns:true})` を使い、移動前・休息前・猫穴の出入りで踏み替えて向き直ります。`src/obs/cat-turn.js` が頭→前足→後ろ足→尻尾の順に遅れる回転位相を定義し、`lucy-turn.js` が胸と腰の向きの差で胴体を弧状に曲げ、頭から尻尾まで半回転を伝えます。骨盤直下に付いている前足の根元も胸へ追従させ、足裏の接地を処理。回転中は並進と休息時計を止め、前足の肘は一定側へ曲げます。既存の歩行・休息ポーズへは両端でブレンド。`all-actions.html#turn` の「方向転換」で左右の180度回転を確認できます。伸び・伏せは引き続きスタディー限定です。検証: `node --test tests/obs-cat-turn.test.js tests/obs-lucy-approved.test.js`。

2026-09-15 追加確認: `all-actions.html#stretch` の「伸び（確認中）」はスタディー限定、OBS本編・配布アセットには未反映。両前足を床に沿って置いた後、四つの足先の接地位置を固定し、頭と腰を後ろ上へ引く8秒のループです（設置0.35–1.5秒、引く1.5–2.6秒、保持、緩める4.7–5.6秒、その後戻る）。前足を逆折れさせていた上向きの肘補正を撤去。肩根元が胸郭上を滑ることで上腕・前腕の骨長と足先位置を維持し、伸び切りではほぼ一直線にします。目を閉じる面・肉球・ωは維持。前足を置く準備のみ伏せと同じ `forepawSlide` を使用し、伏せ自体は変更しません。独立したリグを毎フレーム絶対時刻で復元するため、逆方向スクラブや他の行動にも影響しません。マウス回転・視点切り替え・速度・時間スライダーで確認可能。検証: `LUCY_SLEEP_BASE_ASSET=studies/lucy/local/review/outline-study.glb node --test studies/lucy/stretch-study.test.js studies/lucy/prone-study.test.js`。接地・肘の向きと直線性・頭と腰の後上方移動・全周期の連続性を確認します。

2026-09-15: ユーザーの「obs内に反映で」により、全行動スタディーの採用版をOBS本編へ反映。顔幅・肩・胸と脇腹の輪郭・足根部、ωとひげの根元、縦楕円の黒目、肉球、横寝と閉じ目・呼吸・尻尾トントン、前足先行で足根関節から曲がるジャンプ、滑らかな毛繕いを含みます。

本編の入口は `src/obs/lucy-cabin.js`。通常動作は従来の `lucy.js` の歩行距離・休息制御を継続し、採用済みの造形と動作補正を重ねます。横寝は同じ連続メッシュと骨格で移行し、床／ソファーの高さへ接地。ジャンプの移動軌跡は船内の `CatMotion` が担当し、スタディー側の前進・高さを二重加算しません。毛繕いは配布済みの補正キャッシュを補間するため、ページ読み込み時や再生中に40回の平滑化計算をしません。

本編の座る・毛繕い・横寝は、休息に入るたびに正面・左右斜め・真横・後ろ斜め・真後ろの8方向から向きを選択します。直前の向きは続けず、動作中と立ち上がる間は選んだ向きを維持。食事・人と遊ぶ向き、歩行・ジャンプ・壁裏通路の進行方向は従来どおりです。`CatRoutine.poseYaw` を描画へ渡し、移動用の `motion.facing` は変更しません。

再生成: `node studies/lucy/build-approved-cabin.mjs` → `npm run build`。入力は `local/review/outline-study.glb` と `local/review/sleep/lucy-cabin.glb`、成果物は `public/assets/obs/lucy/lucy-cabin.glb`・`lucy-approved.json`・`lucy-groom.bin` と同じ `dist/` 配布物。3ファイルは組で扱ってください。旧 `export-cabin.py` のGLBを直接上書きすると採用済みの表面補正が失われるため、現行版の仕上げにはこの生成スクリプトを使用します。

検証: `node --test tests/obs-lucy-approved.test.js tests/obs-lucy.test.js`。以下の「未反映」等の記述はスタディー選定時の経緯であり、現在の配布状態はこの冒頭を優先してください。

2026-09-11に確認したルーシーの体型・三毛模様・歩行・尻尾を再現する調整コードです。
2026-09-13に本編へ接続し、ユーザーの公開指示により本編用GLBも配布対象にしました。

## 確定した形

- Free3Dのローポリ猫を外側に使い、胴体・首・脚の比率を保つ。
- 表面を1段階細分化し、三毛模様、小さく浅い目、鼻、細いヒゲを加える。
- BlenderKit猫の32本の骨格を外側に合わせ、既存の足先IKと階層を活かす。
- 歩幅を広げ、低く足を運ぶ。歩行周期1.2秒、接地幅0.112、1周期の移動距離0.175モデル単位。
- 歩行中の左右の接地間隔は前足0.020、後足0.024。体の中心寄りへ交互に置き、接地中は横へ滑らせない。
- 持ち上げた足は外へ0.003だけ弧を描いて戻す。足先を無理にねじらず、肘・かかとも体の下へ収める。
- 肩の付け根は左右交互に前後へ0.012動かし、上下動は小さくする。待機時の体型・歩幅・頭の高さ・尻尾は維持。
- 歩行時の胴体は待機時から0.012だけ下げる。以前より0.004上げ、低く警戒している姿勢を弱める。足裏の接地位置は維持。
- 前足は離地後、手首から後ろへ折り畳む。遊脚前半で最大1.55ラジアン曲げ、着地前に足裏の向きを戻す。
- 後ろ足は遊脚の頂点で、横から見たかかと〜足先の線を伸ばし、着地に向けて戻す。接地中は前後とも足先を回さない。
- 足先が床に当たらないよう、曲げ伸ばしを離地後に段階的に行う。足の持ち上げ量・接地位置・歩幅は変更しない。
- 歩行中だけ首を前へ低く伸ばし、頭を背中のラインへ近づける。止まっている間は元の高さ。
- 尻尾は根元を後ろへ少し傾け、先端まで弧を描く。先端は丸く、揺れは小さくする。
- 尻尾の5関節の基準角は `[0.88, 0.32, 0.37, 0.44, 0.49]` ラジアン。
- 歩行中の尻尾は上向き・中間・下向きからランダムに選ぶ。6〜13秒保ち、2.4〜3.8秒かけて次の形へ移る。
- 歩行中の左右の振れは前へ出る前脚側へ根元を向け、5関節に0.055秒ずつ遅れを付ける。先端の向きは根元より約0.22秒遅れる。
- 左右の角度は根元0.070〜先端0.110ラジアン。各節の絶対方向を調整し、上下の弧を保ちながら小さくしならせる。

Web用GLBには `Idle`、`Walk`、`WalkLevel`、`WalkLow` を含みます。
3種類の歩行は同じ足運び・位相で、尻尾だけが異なります。
確認画面ではそれらを重ね合わせ、足運びを変えずに尻尾を切り替えます。
Blenderファイル内の寝る・食べる等のポーズは調整途中です。

## 本編への接続

`export-cabin.py` は確認済みの `.blend` から、表面と4つの待機・歩行クリップを変えずに本編用GLBを作ります。
寝る・食べる・座る・毛づくろい・遊ぶ・しゃがむ・跳ぶの7動作とまばたきを追加しています。
本編の `src/obs/lucy.js` で移動距離に歩行位相を合わせ、休息の入り・終わりを補間し、足の接地をIKで補正します。
壁裏通路では壁面でクリップし、既存のジャンプ・食器・追従・休息の行動制御を使用します。

2026-09-14の座りシルエット調整: 首まわりはユーザーが指定し直した最初の赤線入り画像の調整へ戻しました。`SitRuff` は当時の最終値（前方0.020・下方0.016モデル単位を滑らかな範囲マスクで適用）を復元し、顎下から胸へ厚みをつなぎます。その後に試した胸中心の張り出し `SitChest` は残しません。座り姿勢で作った変位を元のメッシュ座標へ戻し、座る・毛づくろい・座って遊ぶときだけ適用。立ち姿・歩行・食事・睡眠の表面は変更しません。後ろ足の接地点を前へ0.026モデル単位移した調整と、下記の腹部・足裏の補正は維持します。

追加の実猫写真に合わせ、`SitBelly` で座ったときの腹部にも前方・左右の厚みを追加。元の連続メッシュの腹側を広げ、隣接頂点間で補正量をならして局所的な突起を抑えます。胸・顎・足先の形状はこの補正から除外し、座り系の動作だけに適用します。

`SitPaws` で後ろ足の甲・かかと寄りの上面を低くして、足先を少し前へ広げています。この足裏補正は首の復元とは独立して維持し、前脚・歩行時の形状を変えずに、座り系の足裏が床へめり込まないことを確認します。

### 確認中の猫スタディー（2026-09-15・船内未反映）

毛繕いの滑らかな再生 `groom-playback.js`: 全行動スタディーでは、読み込み時に一周9.6秒の胸・脇下補正だけを30Hzで事前計算（準備の進捗を表示）。各頂点の補正を骨の変形前へ戻して保存し、再生時は補間して現在の骨格へ適用する。頭・まばたき・足・尻尾を録画したメッシュで置換せず、現在時刻の動きを維持する。毛繕いの80ms更新制限を撤去し、描画フレームごとに更新。足回りの接地、形状、ωは維持。船内未反映。`canvas` の `data-pose-fps` / `data-pose-ms` で実行中の更新頻度・CPU時間を検証できる。テスト: `LUCY_GROOM_STUDY_ASSET=studies/lucy/local/review/outline-study.glb node --test studies/lucy/groom-playback.test.js studies/lucy/groom-surface.test.js`。

ジャンプ中の後ろ脚は足先だけを回す補正を撤回し、足根関節（`leg3`）から下を下向きにし、`feet` の向きをその延長へ揃える。上腿・下腿は長さを変えず二関節で解き、届かない目標は骨長内に収める。離地後に補間し、後足着地までに解除。前足先行の離地・着地と接地位置は維持。全行動スタディーのみ。

黒目の追加候補 `pupil-study.js`: 添付 `Unknown.jpeg` に合わせ、黒目だけを横に2.2倍広げた縦楕円に変更。眼窩と同じマテリアルなので、連結成分から左右の黒目だけを選択する。目の位置・虹彩・まばたきは維持し、横寝では従来通り閉じ目の下に隠す。全行動スタディーへ適用、船内未反映。検証: `LUCY_SLEEP_BASE_ASSET=studies/lucy/local/review/outline-study.glb node --test studies/lucy/pupil-study.test.js`。

現在の `export-cabin.py` は、喉と胸の間へ `SitRuff` の範囲を移した候補に、正面の肩の張り出しを抑える `SitShoulders` を追加した確認版を生成します。胸中央を前後に潰さず、上部胴体の左右幅を滑らかに絞り、頭・足先・低い腹部へは補正をかけません。立位・歩行では適用しません。`public/`・`dist/` のモデルはこの候補へ差し替えていません。確認前に下の本編コピー手順を実行しないでください。

候補検証: `LUCY_SHOULDER_STUDY_ASSET=/path/to/lucy-cabin.glb node --test studies/lucy/shoulder-study.test.js`。肩幅の減少、中央の喉・胸と足先の保護、座り系動作の有限値・接地、立位での補正解除を確認します。

顔の追加候補 `FaceRefine`: 顔幅を約10%、目の間隔を約15%狭める横方向の連続変形。眼球だけを移動せず、眼窩・頬・耳・ひげも同じ座標変換に通し、首へ滑らかに減衰します。顔の高さ・前後の奥行き・まばたきの上下変位は維持。表情ではなく造形なので全姿勢で適用します。これもスタディーのみで、船内モデルには未反映です。検証: `LUCY_FACE_STUDY_ASSET=/path/to/lucy-cabin.glb node --test studies/lucy/face-study.test.js`。

肩のマント状の折れ込み・足根部の接地の追加候補は、Blender書き出し後に `node studies/lucy/finalize-surface-study.mjs input.glb output.glb` で生成します。入力は上記の顔・肩幅調整まで含むGLB、出力は別名のスタディー用GLBを指定します。`SitSurface` はOBSと同じ座り姿勢・IKで連続面を平滑化し、`SitHocks` は後ろ足の底面の傾きを取り、断面の厚みを残して足根部側を下げます。補正をアニメーション前の座標へ戻して追加するので、基礎形状と既存動作・顔の補正は保持します。Blenderの姿勢だけを使うとOBS側のIKとずれるため、この後処理を省略しないでください。船内モデルには未反映です。

検証: `LUCY_SURFACE_STUDY_ASSET=/path/to/output.glb node --test studies/lucy/surface-study.test.js`。足根部側の底面の接地・足の厚み・顔と前足の保護・座り系動作と立位への復帰を確認します。

脇腹へ一律に足した `SitFlanks` はユーザーが位置の違いを指摘したため撤回。現在の後処理はそれを含まず、添付「スクリーンショット-2026-09-15-11.21.49.jpg」の左右の赤線を基準にした `SitOutline` に置き換えます。耳先〜足裏の高さで画像とモデルの縮尺を合わせ、高さごとの左右半幅を対称化して採寸。首の付け根のくびれを外へ広げ、腰・太ももの張り出しを内側へ引き、連続した輪郭に補正します。顔・前足・接地と既存の表面補正は保持。確認用GLBのみで船内未反映です。

赤線候補の検証: `LUCY_OUTLINE_STUDY_ASSET=/path/to/output.glb node --test studies/lucy/outline-study.test.js`。旧 `SitFlanks` が含まれないこと、首の付け根と腰の補正方向、赤線から採寸した複数高さの幅、顔と足先の保護を確認します。`flank-study.test.js` は撤回した候補を検証する履歴用で、現在の候補には使用しません。

```sh
blender --background --factory-startup --disable-autoexec --python studies/lucy/export-cabin.py
cp studies/lucy/local/cabin/lucy-cabin.glb public/assets/obs/lucy/lucy-cabin.glb
npm run build
```

本編用GLBは `public/assets/obs/lucy/` と生成済み `dist/assets/obs/lucy/` の両方でGit管理します。元素材・Blender編集データ・参考写真・ローカル確認画面は引き続き `local/` に保持します。
動作検証: `node --test tests/obs-lucy.test.js`。接地、寝起き、食器位置、停止を調べます。元のプレビューと本編の表面・歩行データの一致検証は、ローカルの `lucy-combined.glb` がある環境で追加実行します。
本編プレビューを起動して `node studies/lucy/verify-cabin.cjs` を実行すると、食事・ソファー上下・壁通路・クリック追従・一時停止を確認し、PCとスマートフォン幅の画像を `local/cabin/qa/` に保存します。URLは `CABIN_URL`、Playwrightの場所は `PLAYWRIGHT_MODULE` で指定できます。

## ファイル

- `build.py`: 外側と骨格の組み合わせ、配色、変形設定、モーション、GLB出力。
- `preview.js`: Three.jsによる回転・ズーム・動作切替・骨格表示。
- `tail-variation.js`: 尻尾のランダム選択、保持時間、滑らかな切り替え。
- `build-preview.mjs`: ローカルGLBを埋め込んだ、単体で開けるHTMLを作成。
- `verify.cjs`: 全メッシュの変形、接地、PC・スマートフォン表示を検証。
- `export-cabin.py`: 確認済みの外形・歩行を維持して本編用モーションを追加。
- `verify-cabin.cjs`: 本編の実際の行動制御・描画・操作・画面サイズを検証。

## ローカル再現

Blender 4.4、Node.js 22で確認。先に `3D` の依存パッケージをインストールしてください。
以下は `3D` ディレクトリから実行します。
入力と生成物もこのスタディ内の `local/` にまとめています。

```text
studies/lucy/
  build.py, preview.js, build-preview.mjs, README.md  # Gitで管理
  local/                                           # ローカルのみ
    source/cat.fbx
    source/domestic-cat-rigged.blend
    lucy-combined.blend
    lucy-combined.glb
    lucy-preview.html
    report.json, qa.json
    references/                                    # 歩行の参考写真
    archive/blender-rig-study/                      # 旧Blender単体の試作
```

```sh
blender --background --factory-startup --disable-autoexec \
  --python studies/lucy/build.py

node studies/lucy/build-preview.mjs
```

生成物は `lucy-combined.blend`、`lucy-combined.glb`、`report.json`、`lucy-preview.html`。
`local/lucy-preview.html` はそのままブラウザで開けます。サーバーは不要です。
別の入力・出力を使う場合、Blenderには `--` の後で `--source-rig`、`--source-mesh`、`--out` を、
プレビュービルドには `--model`、`--out` を指定できます。

検証は Playwright と Chrome を使います。Playwrightを利用できる環境で
`node studies/lucy/verify.cjs` を実行すると `local/qa.json` とスクリーンショットが生成されます。
別の場所にインストール済みの場合は `PLAYWRIGHT_MODULE` にそのモジュールのパスを指定できます。
尻尾のタイミング・連続性は `node --test studies/lucy/tail-variation.test.js` でも検証できます。
`verify.cjs` は全4肢の接地幅・横滑り・歩行ループの連続性・肘の張り出し・肩の交互運動も確認します。
尻尾は3つの高さすべてで、前脚との方向の一致・先端の遅れ・振れ幅・接続部の固定・ループの連続性を検証します。
足先も3つの歩行すべてで、手首の後ろへの折り畳み・後ろ足の頂点での伸び・接地中の向きの固定・回転の連続性を検証します。
足先に影響される全頂点を1周期120分割で調べ、床へのめり込みがないことを確認します。

## 毛づくろいの胸・脇下補正（確認中・船内未反映）

`groom-surface.js` は `outline-study.glb` の座り輪郭を変更せず、
`animateLucy()` の直後に現在のポーズで胸・脇下を局所的にならす比較用補正です。
`createGroomSurface(cat)` を一度作り、毎回 `update()` を呼びます。
座り・立ち・遊びでは元のスキンメッシュをそのまま表示します。
毛づくろい中だけ補正済みの面を表示し、編集箇所の法線も実際の面から再計算します。
元の位置・頂点色・GLB・アニメーションは書き換えません。
基本の平滑化はモデル空間で `.022` に制限します。胸下面の追加補正は、解決済みの
前足と肩の高さの差に連動して上方・胴体側へ引き戻します。胴体ボーンの影響量で
対象を絞り、前腕自体を細く引き込まないようにしています。補正境界はなだらかに減衰し、
合計の最大移動量は局所的に `.060` 以下です。顔・腰・足先は対象から外しています。
`update(true, {skinFit:false})` で前段階の平滑化のみを表示できます。
これはCPUでポーズを評価するスタディー用処理です。OBSへの採用前には負荷の評価と
必要に応じた補正モーフへの変換が必要です。

確認ページ: `http://127.0.0.1:8766/review/neck-study.html`。
同じ `outline-study.glb` 同士で胸下面の補正あり／なしを比較でき、再生・停止、
時刻スライダー、胸・脇下の拡大表示を備えます。

```sh
LUCY_GROOM_STUDY_ASSET=/tmp/moon-eva-review.J8so74/outline-study.glb \
  node --test studies/lucy/groom-surface.test.js
```

テストは修正対象の局所性、元データ保持、移動上限、法線、上げた前足周辺の面の折れの
低減を確認します。自己交差が全姿勢で完全にないことを保証するものではありません。

## 横向きの寝姿（比較候補／船内未反映）

2026-09-15、丸めた試作は不自然との指摘を受け、ユーザー提供 `yokone.jpg` の
横寝を代案として試作。現在の `http://127.0.0.1:8766/review/sleep-study.html` は
この横寝と以前の伏せ姿の比較です。アンモナイト型の完成版ではありません。

`export-cabin.py --sleep-side --out /tmp/lucy-side-sleep` で生成し、承認済みの
`outline-study.glb` に **Sleepクリップだけ** を移植します。`--sleep-curl` とは排他。
首・胴体を縮尺変形せず、前後肢を少しずらし、後ろ足の足首も緩めます。
`side-sleep.js` で全身を横倒しに配置し、ヒゲを除く体表から接地高を求めます。
閉眼は `sleep-eyelids.js` で開眼用パーツを非表示にし、実際の眼窩の縁に沿った
毛色付きのまぶた面と細い閉眼線に置き換えます。眼球を潰すだけの穴あき表現は廃止。
まぶたは頭の骨に追従し、元の顔・開眼形状は変更しません。
胸の上側だけに約3.8秒周期の小さな呼吸を付加。
`sleep-tail-tap.js` は約13〜18秒の間隔で尻尾の先を2回だけ上下させます。
動かす関節は `tail4` のみ（子の `tail5` は追従）。付け根・胴体・足・元の頂点は
変更しません。変形後の尻尾の表面から接地角を求め、床Y=-0.002の少し上へ
戻します。常時の揺れや音声は追加せず、比較ページの「尻尾の動きを見る」で再生可能。
`sleep-tail-tap.test.js` は2回の間隔、床への到達と非貫通、他部位の不変性を検査。
床へ体表を押し下げる `settleSideSleepContact` と追加の肢の折り畳みは、
造形が崩れたとの指摘で撤回しました。床へ頂点を押し潰す補正は再適用しないこと。
その後の「まだ浮いてる」への修正候補では、`side-sleep.js` で全体を約8.5度
腹側へ傾け、背骨・首・腰の回転と既存の脚IKで支持姿勢を調整しています。
胴体を基準に下げた後、脚のコントローラを床に合わせ、最後に全体の高さだけで
皮膚の床貫通を回避します。元の体表座標と、制御骨以外の関節位置・骨長は不変です。
候補の床との最短距離は胸約4.9mm、腰約3.8mm、頭約3.4mm。
腹中央のくびれには約12.9mmの空きが残ります（調整前は約28mm）。
全腹面が床に密着する状態ではありません。見た目はユーザー確認待ちです。
比較ページに「床すれすれ」の視点を追加し、横からの輪郭と通常の見下ろしを確認。
`side-sleep.test.js` は体表不変・骨長維持・各部の床距離・非貫通を検査します。
右前足の先端は `sleep-forepaw.js` で追加調整。肩・肘の位置と胴体を固定し、
前腕と手首を回して先端を床へ沿わせます。前腕長を保った到達位置を使うため、
手首の分離や脚の引き伸ばしはありません。先端の床距離1.5mm未満、体表の非貫通、
他の骨の不変性を同テストで確認しています。
`paw-pads.js` は四つの足裏に淡いピンクの肉球を追加します（中央1つ＋指4つ／足）。
足裏の実際の面をサンプリングした薄い丸いパッチで、表面からの膨らみは表示尺度で
約0.36mm。元の毛色・形状は書き換えません。交点のスキンウェイトとモーフ変位を
補間して共有リグに結び、手首の調整にも追従。寝姿スタディーのみで有効です。
`whisker-pads.js` は口元の左右に限定した `WhiskerPads` モーフを追加します。
前へ最大約4.4mm・左右へ約2.2mm（ソース尺度）ふくらませ、中央の鼻下、鼻、顎、
目と顔の外側は変えません。`whisker-roots.js` で左右4本ずつの髭を識別し、
狭めた顔とωモーフを評価したパッドの実表面へ根元を移します。根元は鼻より下の
高さ0.164〜0.170へ配置し、表面から0.12mmだけ埋めて隙間を防ぎます（ソース尺度）。
先端は固定し、根元の移動量を長さ方向へ滑らかに減衰。元の頂点・リグは保持します。
陰影は変形勾配から
元の滑らかな法線を変換し、分割頂点の三角形が目立つ再計算法は使用しません。
寝姿へ反映し、`/review/muzzle-study.html` に正面／自由回転・修正前比較の顔アップを用意。
これらは比較モデル専用。船内実装・入眠／起床遷移は未反映です。

```sh
LUCY_SLEEP_BASE_ASSET=/tmp/moon-eva-review.J8so74/outline-study.glb \
LUCY_SIDE_SLEEP_ASSET=/tmp/moon-eva-review.J8so74/sleep-side.glb \
  node --test studies/lucy/side-sleep.test.js
```

## 全姿勢・行動スタディー（船内未反映）

`all-actions.html` / `all-actions.js` は既存の11クリップを確認する共通ビューです。
待機、歩行3種、座り、毛繕い、食事、遊び、横寝、くぐり、ジャンプを切り替えます。
ωと肉球は共通。毛繕いでは `createGroomSurface`、横寝では既存の接地・閉眼・
呼吸・尻尾トントンを使用します。元の船内モデル・実装は変更しません。
自由回転、視点プリセット、顔アップ、一時停止、時間シーク、0.25/0.5倍速に対応。
歩行はその場の足運び。ジャンプは `jump-study.js` の独立したリグで、前足離床→
後ろ足の蹴り出し→前足接地→後ろ足接地を3秒のタイムラインで確認します。
胸・骨盤の傾きと四肢のIK目標を分離し、支持足は床に固定。足裏の実測高を使い、
皮膚や骨長は変更しません。少し前へ跳ぶため、終端から先頭へ瞬間移動しないよう
一回で停止します。「再生」または「最初から」で再確認できます。
船内の経路・段差・物理は未統合。姿勢切り替えも即時で、入眠／起床遷移は対象外。
`jump-study.test.js` は離床／着地順序、足裏の床クリアランス、IK接続、元頂点保持、
逆方向のシークでも同じ姿勢になることを検査します。
前脚は離床とともに前へ出し、空中では肘を開いて顔の前まで伸ばします。
下降時は前下方へ伸ばし、接地後は前足を固定したまま胴体が追いつく動きです。
空中の肩〜手首距離は腕長の94%以上を保つテストで、胸下へ畳まれる退行を防ぎます。
後脚も蹴り出し後は腰の後方へ伸ばし、膝・足根の伸びを保ちます。空中では足先を
軽く下げ、前足接地後に後脚を体の下へ戻して足裏を水平にします。腰〜足首の距離が
後脚長の94%以上になること、足が腰より後方にあることを離陸後〜下降中に検査します。

一時フォルダーの消失に備え、ページはこのフォルダー、生成物は無視対象の `local/review/`
に保持します。3Dディレクトリで次を実行（BlenderとNode 22以降を使用）:

```sh
blender --background --factory-startup --disable-autoexec --python studies/lucy/export-cabin.py -- --out studies/lucy/local/review/base
blender --background --factory-startup --disable-autoexec --python studies/lucy/export-cabin.py -- --sleep-side --out studies/lucy/local/review/sleep
node studies/lucy/finalize-surface-study.mjs studies/lucy/local/review/base/lucy-cabin.glb studies/lucy/local/review/outline-study.glb
node studies/lucy/study-server.mjs
```

URL: `http://127.0.0.1:8767/review/all-actions.html`。サーバーはMac内だけにバインドし、
停止後は最後のコマンドで再起動できます。既存の8766番サーバーとは独立しています。

## 丸まる寝姿（不採用の旧試作／船内未反映）

`export-cabin.py --sleep-curl` は通常の書き出しとは別に、丸まる `Sleep` クリップを
生成するオプションです。床に沿った脊柱の湾曲、軽い横倒し、首の引き込み、
前後の足の折り畳み、尻尾の外周へのカーブを含みます。省略時の寝姿は変えません。

```sh
blender --background --factory-startup --disable-autoexec \
  --python studies/lucy/export-cabin.py -- --out /tmp/lucy-curled-sleep --sleep-curl
```

以下は横寝への切り替え前の試作です。現在の比較ページでは使用しません。
承認済み候補の `outline-study.glb` に、生成したGLBの **Sleepクリップだけ** を読み込みます。
元のモデル・頂点色・座り・毛づくろいなど他のクリップは置き換えません。
`sleep-surface.js` は寝姿でのみ、内側胸郭の体積補正、折り畳み部の平滑化、
下面の接地と法線の再計算を行うCPU評価用の補正です。起立への遷移や実機負荷を含む
OBS統合は未実施です。プレビューは寝た状態の静止比較です。

```sh
LUCY_SLEEP_BASE_ASSET=/tmp/moon-eva-review.J8so74/outline-study.glb \
LUCY_SLEEP_STUDY_ASSET=/tmp/moon-eva-review.J8so74/sleep-curl.glb \
  node --test studies/lucy/sleep-study.test.js
```

テストは頭と腰の距離、平面の輪郭比、表面の接地・有限性・元データ保持を確認します。
写真との見た目の一致や、すべての自己交差を保証するものではありません。

## 歩行の参照

- [モーション動物園: 歩く猫のリファレンス動画](https://motionzoo.net/cat-walk-reference/)
- ユーザー提供の `110_CatRigWalk.gif`。足を中心寄りへ交互に置く動きと肩の前後運動を参照。
- ユーザー提供の `fe0e0c7b11c282d0b93459058c7af7a7.webp`。正面からの尻尾の傾きを参照し、根元から先端へ遅れる左右の振れを追加。
- ユーザー提供の `20200227_nekohurahura_nk_1.webp`、`images.large.jpg`、`手根骨.png`、`450-20170615223706253534.jpg`。手首から先の折り畳みと、後ろ足の伸びを参照。
- 接地位置の数値はこのモデル向けの調整値で、生体測定値ではありません。

## 元素材

元モデル、骨格ファイル、モデルを埋め込んだHTMLはこのコミットには含みません。
このスタディの `local/` に保持し、再現用コードと資料をバージョン管理します。

- 外側: snippysnappets, [Low poly cat / Free3D #46138](https://free3d.com/3d-model/low-poly-cat-46138.html)
- 骨格: Pawel Walasiewicz, [Domestic cat (rigged) / BlenderKit](https://www.blendkit.com/asset-gallery-detail/6b3bbcc7-db99-4424-9436-8e6678ee9354/)

素材の出典・利用条件は `local/SOURCES.md` にも記録しています。
配布する本編用GLBにも `ATTRIBUTION.txt` を添付しています。出典ページで記録した利用条件は変更していません。ユーザーの公開指示は、原作者による利用条件の変更を意味しません。
