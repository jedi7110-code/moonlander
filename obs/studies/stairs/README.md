# 左側階段室スタディー

起動: `node studies/milo/study-server.mjs` → http://127.0.0.1:8768/obs/studies/stairs/index.html

既存の船内、マイロ、ルーシー、ロボのモデルを使った配置・通行確認。階段室は本編の船内に組み込み済み（`obs/README.md` の「左側階段室」）。経路・形状・人と猫の歩き方の実体は `src/obs/` へ移した（`stair-route.js`、`stair-tower.js`、`human-stair-gait.js`、`cat-stair-gait.js`）。このフォルダの `route.js` などは、それらを読み直すだけの中継ファイル。

- 3フロアの床高 0 / 3.392 / 6.784 m に一致。
- 各階20蹴上げ、2フライト、幅1.4 m、踏面0.29 m、段差0.1696 m。
- 気密外壁、床の補強、両側の手すり、低い立ち上がり。段のあいだは蹴込み板を付けずに抜いてある（船の鉄骨階段の形）。
- 折り返し踊り場の手すりは撤去。旧左壁に接続していた3フロア分のホースは、各階の入口の奥の隅に付け直し。
- 奥の壁と床は船内通路と同じ線（奥 z≈-1.62、手前 z=2.55）。入口に柱・梁・段差なし。壁に配管・ケーブル・補強リブ・ガード付きの蛍光灯型の壁灯。
- LEVEL 1の天井は既存船内の構造層とアイボリー外皮を同じ高さ・厚みで延長。
- LEVEL 1の階段側の床端は手すりで保護し、奥の昇降口を残す。LEVEL 3の通路床は階段室の左端まで延長。
- 元の左壁を開き、各階の広い踊り場から船内の前側通路に接続。中央ハシゴは維持。
- 固定部は材質ごとに結合。接地用の経路と右側通行を共有し、同方向の追従は間隔を空ける。
- 再生 / 一時停止 / 上下反転 / 時間指定 / 個別表示 / 荷物 / 足の接地点 / 追従視点。
- 猫の動作調整と調査資料: [cat-motion-research.md](./cat-motion-research.md)。上り・下りの単独確認と半速再生付き。通常速度の確認: `?cat=up&view=cat&rate=1` / `?cat=down&view=cat&rate=1`。
- 猫の階段歩行は `cat-gait.js` が経路上の位置から毎フレーム計算する（事前生成データなし）。平地は本編の `animateLucy` と完全に同じで、階段の前後1.0〜1.4 mで階段用の足運びへ切り替わる。
- マイロの階段歩行と調査資料: [human-motion-research.md](./human-motion-research.md)。`human-gait.js` が経路上の位置から毎フレーム計算する。1段ずつ交互に上り下りし、上りは前足で体を引き上げ、下りは着地前に後ろ脚で体を下ろす。階段の上では歩調に合わせて減速する（`route.js` の `humanPace`）。追従視点: `?view=human`。
- 階段上端の出口は、経路の尖った折り返しの代わりに、なめらかな道筋を通る。猫は `route.js` の `walkPoint`、マイロは通路上の専用の道筋 `humanExitPoint` を使う。
- 検証: `node --test tests/obs-stair-study.test.js tests/obs-cat-stair-gait.test.js tests/obs-human-stair-gait.test.js`

外観の圧力殻（船体の外形）はまだ階段室を含んでいない。本編の検証: `node --test tests/obs-stair-crew.test.js tests/obs-stair-droid.test.js tests/obs-stair-cat.test.js tests/obs-stair-curtis.test.js`
