# Lucy: Biological Study

2026-09-11に確認したルーシーの体型・三毛模様・歩行・尻尾を再現する調整コードです。
ゲーム本体への差し替えはまだ行っていません。

## 確定した形

- Free3Dのローポリ猫を外側に使い、胴体・首・脚の比率を保つ。
- 表面を1段階細分化し、三毛模様、小さく浅い目、鼻、細いヒゲを加える。
- BlenderKit猫の32本の骨格を外側に合わせ、既存の足先IKと階層を活かす。
- 歩幅を広げ、低く足を運ぶ。歩行周期1.2秒、接地幅0.112、1周期の移動距離0.175モデル単位。
- 尻尾は根元を後ろへ少し傾け、先端まで弧を描く。先端は丸く、揺れは小さくする。
- 尻尾の5関節の基準角は `[0.88, 0.32, 0.37, 0.44, 0.49]` ラジアン。

Web用GLBには確認済みの `Idle` と `Walk` のみ含みます。
Blenderファイル内の寝る・食べる等のポーズは調整途中です。

## ファイル

- `build.py`: 外側と骨格の組み合わせ、配色、変形設定、モーション、GLB出力。
- `preview.js`: Three.jsによる回転・ズーム・動作切替・骨格表示。
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

## 元素材

元モデル、骨格ファイル、モデルを埋め込んだHTMLはこのコミットには含みません。
このスタディの `local/` に保持し、再現用コードと資料をバージョン管理します。

- 外側: snippysnappets, [Low poly cat / Free3D #46138](https://free3d.com/3d-model/low-poly-cat-46138.html)
- 骨格: Pawel Walasiewicz, [Domestic cat (rigged) / BlenderKit](https://www.blendkit.com/asset-gallery-detail/6b3bbcc7-db99-4424-9436-8e6678ee9354/)

素材の出典・利用条件は `local/SOURCES.md` にも記録しています。
素材を含む生成物の公開は、この調整コードのプッシュとは別の扱いです。
