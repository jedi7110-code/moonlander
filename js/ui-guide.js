// ガイド吹き出し・方向矢印・着陸マーカー描画ヘルパー。
// create() 内で attachUiGuide(scene) を呼ぶと scene.makeGuideBubble / makeArrowGroup / drawLandingMarker が生える。
export function attachUiGuide(scene) {
    // ラベル＋矢印を囲む4隅ブラケット（[ ] 風の L字マーク4つ）を描画。
    // anchorX = ラベル/矢印の origin 基準 x、isRight = ラベルが右側に伸びるか。
    scene.makeGuideBubble = (anchorX, labelY, arrowY, label, isRight, color, depth) => {
        const STAGES = 10;
        const scale = (scene._labelDisplayScale || 0.25) / 6;
        const tex = scene.textures.get('arrow_unit');
        const srcW = tex.getSourceImage().width;
        const srcH = tex.getSourceImage().height;
        const arrowVisibleW = srcW * scale * (40 / 60);
        const arrowImgH = srcH * scale;
        const arrowsTotalW = arrowVisibleW * STAGES;
        const labelW = label.displayWidth;
        const labelH = label.displayHeight;
        const contentW = Math.max(labelW, arrowsTotalW);
        const left = isRight ? anchorX : anchorX - contentW;
        const right = isRight ? anchorX + contentW : anchorX;
        const top = labelY - labelH / 2;
        const bottom = arrowY + arrowImgH / 2;
        const padX = 6;
        const padY = 5;
        const bx = left - padX;
        const by = top - padY;
        const bw = (right - left) + padX * 2;
        const bh = (bottom - top) + padY * 2;
        const stroke = 1;
        // ブラケット1辺の長さ（横と縦で同じ長さ。bw/bh のうち短い方の 1/4 程度）
        const arm = Math.max(3, Math.min(8, Math.min(bw, bh) / 4));

        // Graphics を中心 (centerX, centerY) に配置し、ローカル座標 (-bw/2..+bw/2)
        // で描画する。これで scaleX 0→1 のアニメで「中心から左右に開く」演出ができる。
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const lx = -bw / 2, rxp = bw / 2;
        const typ = -bh / 2, byp = bh / 2;
        const g = scene.add.graphics();
        g.x = cx;
        g.y = cy;
        g.setDepth(depth);
        // 背景：線と同じ色を 10% 透過で塗りつぶし
        g.fillStyle(color, 0.2);
        g.fillRect(lx, typ, bw, bh);
        g.lineStyle(stroke, color, 1);
        // 左右は全長で繋ぐ
        g.lineBetween(lx, typ, lx, byp);
        g.lineBetween(rxp, typ, rxp, byp);
        // 上下は四隅の短い arm のみ
        g.lineBetween(lx, typ, lx + arm, typ);
        g.lineBetween(rxp - arm, typ, rxp, typ);
        g.lineBetween(lx, byp, lx + arm, byp);
        g.lineBetween(rxp - arm, byp, rxp, byp);
        return g;
    };

    // arrow.svg を 1〜3 個並べて方向矢印を作るヘルパー。
    // SVG: viewBox 0-60, 矢印の見える幅は 0-40 (= 全体の 2/3)。
    // 右向き＝そのまま、左向き＝flipX で反転。
    scene.makeArrowGroup = (anchorX, anchorY, count, isRight, depth, scale, slotSpacing) => {
        const dir = isRight ? 1 : -1;
        const tex = scene.textures.get('arrow_unit');
        const srcW = tex.getSourceImage().width;     // 実ラスタ幅
        const imageW = srcW * scale;                 // 表示時の画像本体幅
        const arrowVisibleW = imageW * (40 / 60);    // 既定の間隔（密着）
        const spacing = (slotSpacing != null && slotSpacing > 0) ? slotSpacing : arrowVisibleW;
        // 右向き: anchorX を矢印群の左端に。左向き: anchorX を矢印群の右端に。
        const baseX = isRight ? anchorX : anchorX - imageW;
        const arrows = [];
        for (let i = 0; i < count; i++) {
            const ax = baseX + dir * spacing * i;
            arrows.push(scene.add.image(ax, anchorY, 'arrow_unit')
                .setOrigin(0, 0.5)
                .setDepth(depth)
                .setAlpha(0)
                .setScale(scale)
                .setFlipX(!isRight));
        }
        return arrows;
    };

    // 的マーカーの描画ヘルパー
    scene.drawLandingMarker = (color) => {
        scene.landingMarker.clear();
        scene.landingMarker.lineStyle(1, color);
        scene.landingMarker.strokeEllipse(scene.markerX, scene.markerY, 60, 16);
        scene.landingMarker.strokeEllipse(scene.markerX, scene.markerY, 35, 10);
        scene.landingMarker.lineBetween(scene.markerX - 35, scene.markerY, scene.markerX + 35, scene.markerY);
        scene.landingMarker.lineBetween(scene.markerX, scene.markerY - 10, scene.markerX, scene.markerY + 10);
    };
}
