# TARAIRON opening / structural connections

居住区の基礎・リングサドル・支柱のピン接合・回転ハブ基部・主エンジン取付金具に加え、有効内径1.20mの有人ドッキング通路と2枚の隔離ハッチを反映した、OBS共通モデルからの書き出しです。

- Vista: 1998×1080 (1.85:1)
- 全編140.65秒、30fps（MP4のフレーム境界で140.667秒）
- 音声なし、UI・シーン番号・黒帯なし。後編集用の全編。
- OBS採用テイクと同じ `approach=bow`、`ending=underside`、`docking=probe-follow`、Bパネル＋soft線。
- フレームごとに `sampleExteriorExportFrame` からサンプリング。実時間の録画ではありません。

Node 24以上で `node studies/opening-structure-20261019/build.mjs` を実行すると、現在の共通モデルとロゴをローカルの `assets/` へビルドします。
プロジェクトディレクトリで HyperFrames の `check`、`render --quality delivery` を実行します。2026-10-19の最終指定により、書き出すのはビスタ版のみです。
書き出し先は `renders/`。生成されたバンドル、ロゴのコピー、動画、HyperFramesの作業データはGit対象外です。

## 検証済み出力

- `renders/TARAIRON-opening-vista-1998x1080-docking.mp4`
- H.264 / yuv420p / 1998×1080 / 30fps / 4220フレーム / 140.666667秒 / 音声なし
- 107,808,814 bytes。HyperFrames 0.8.174、delivery品質、ローカルGPU、2ワーカーで書き出し。
- ロゴ・接続部・終盤の代表フレームを確認し、MP4全編をFFmpegでデコード検査済み（エラーなし）。
- SHA-256: `b2da5effe67be91b88b571f73a9e0ee63df97fbf50496154eaaf03f5689df9e8`

断面・確認人型はスタディー専用で、動画には含めていません。通常の閉じた隔離ハッチを使用しています。
