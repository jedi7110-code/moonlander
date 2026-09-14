# EVA 宇宙服の形状

## 現在の船内モデル

作者提供の `tripo_convert_2a20ad97-234c-4ab1-a73e-5588a893d5b5.obj` は**比率と輪郭の参照専用**です。荒いメッシュを船内へ直接使う方針は作者により取り消されました。元OBJを読み込んで色を付けるだけの変更を再導入しないでください。

船内では独自の衣服断面をBlenderで接合した `public/assets/obs/eva/pressure-garment.glb` と、別設計のヘルメット・バイザー・首リング・装具を使います。OBJにある頭の低さ、顎幅、肩の傾斜、股下位置を基準に、滑らかな外殻と布地として再構成しています。白・赤・白の三着は共通のカスタム形状です。

`build-reference-suit.py` と `reference-suit-study.glb` は不採用になった比較用データです。`public` に配置しません。作者の元OBJは変更していません。`tests/obs-eva-custom.test.js` はカスタム衣服の実GLBを読み、別設計のヘルメット、三着の色分け・配置・船内描画との結合を確認します。

## カスタムモデルの構成

2026-09-14 の作者提示画像と 13:00〜13:01 の正面・背面・側面のワイヤーフレームを形状の基準にしています。頭部と手足の比率、肩の傾斜、腰の絞り、縦長の胸当て、背面装置の厚みを調整しました。白・赤・白の三着は同じ形状を使用します。

`src/obs/eva-anatomy.js` に参照OBJから再設計した関節位置と衣服断面を定義しています。全高約2mを基準とし、肘から手首は前へ11cm、膝に対して足首は後ろへ8.1cm。以前の一本線の腕・脚を廃し、曲線に沿って断面を生成します。肩の付け根は胴の内部から始め、Blender 4.4で胴・両袖・ズボンを接合、平滑化、軽量化します。腰から両脚は股の共有縫い目でつなぎ、胴体の尖った底面を重ねません。

`src/obs/eva-suit.js` は新しい体形に合わせた装具と手足を組み立てます。手袋は前腕軸に接続し、手のひらを腿側、親指を前へ向けています。四指はそれぞれ長さが異なり、手のひら側へ軽く曲がります。手首計器は手の甲側、膝当てと脚のバンドは脛の傾きに沿って取り付けます。胸当て・背面装置も新しい胴の厚みに合わせて配置しています。

船内では `public/assets/obs/eva/pressure-garment.glb` を読み込みます。ヘルメット・装具・手袋・靴は同じ座標系の別部品です。ラック上で縦方向だけ縮める処理は使用しません。関節位置や衣服断面の変更後はGLBを必ず再生成してください。

## 再生成

3D ディレクトリを作業場所として、Node 22.12 以降と Blender 4.4 を使用します。一時ファイルと `.blend` は確認用フォルダに出力してください。

```sh
node studies/eva/export-garment.mjs /tmp/eva-garment-source.json
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python studies/eva/build-garment.py -- /tmp/eva-garment-source.json /tmp/pressure-garment.glb /tmp/eva-garment.blend
```

形状を確認した後、GLB を `public/assets/obs/eva/pressure-garment.glb` にコピーして本番ビルドします。胴・袖・脚の断面を変更したときは必ず再生成してください。装具やヘルメットだけの変更は再生成不要です。

`export-garment.mjs` は読み込み前の断面を抽出するため、ブラウザや生成済みGLBに依存しません。`build-garment.py` は画像や外部の人体モデルを使用しません。
