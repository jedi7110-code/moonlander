# Lucy: Biological Study

2026-09-11に確認したルーシーの体型・三毛模様・歩行・尻尾を再現する調整コードです。
ゲーム本体への差し替えはまだ行っていません。

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

## ファイル

- `build.py`: 外側と骨格の組み合わせ、配色、変形設定、モーション、GLB出力。
- `preview.js`: Three.jsによる回転・ズーム・動作切替・骨格表示。
- `tail-variation.js`: 尻尾のランダム選択、保持時間、滑らかな切り替え。
- `build-preview.mjs`: ローカルGLBを埋め込んだ、単体で開けるHTMLを作成。
- `verify.cjs`: 全メッシュの変形、接地、PC・スマートフォン表示を検証。

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
素材を含む生成物の公開は、この調整コードのプッシュとは別の扱いです。
