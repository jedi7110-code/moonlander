// テキストを SVG → 画像化してテクスチャ登録
// 4x解像度で描画→1/4で表示するスーパーサンプリングでクッキリさせる（コントラストはそのまま）
export const SVG_SCALE = 4;

// テキストを Canvas 2D で描画して PNG dataURL に。
// SVGデータURIだと@font-faceフォントが反映されないことがあるため Canvas に変更。
export function makeLabelSVG(text, opts = {}) {
    const fontSize = (opts.fontSize || 9) * SVG_SCALE;
    const fill = opts.fill || '#cceedd';
    const fontWeight = opts.fontWeight || 'bold';
    const fontStyle = opts.fontStyle || 'normal';
    const fontFamily = opts.fontFamily || "Courier New, Menlo, monospace";
    const stroke = opts.stroke;
    const strokeWidth = opts.strokeWidth != null ? opts.strokeWidth * SVG_SCALE : 0;
    const letterSpacing = opts.letterSpacing != null ? opts.letterSpacing * SVG_SCALE : 0;
    const pad = SVG_SCALE * 2 + Math.ceil(strokeWidth);

    // 計測用キャンバスでテキストの実幅を取得
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    mctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    const baseWidth = mctx.measureText(text).width;
    const totalWidth = baseWidth + letterSpacing * Math.max(0, text.length - 1);
    const w = Math.ceil(totalWidth) + pad * 2;
    const h = fontSize + pad * 2;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    let cursorX = pad;
    const baseY = fontSize + pad - SVG_SCALE;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.lineJoin = 'round';
            ctx.strokeText(ch, cursorX, baseY);
        }
        ctx.fillStyle = fill;
        ctx.fillText(ch, cursorX, baseY);
        cursorX += ctx.measureText(ch).width + letterSpacing;
    }
    return canvas.toDataURL('image/png');
}

// 失敗テキスト用ヘルパー（プレーンな白文字）
export function makeFailLabel(scene, key, text) {
    if (scene.textures.exists(key)) return;
    scene.textures.addBase64(key, makeLabelSVG(text, {
        fontSize: 28,
        fontWeight: '600',
        fontFamily: "Courier New, Menlo, monospace",
        fill: '#ffffff',
        letterSpacing: 0.5
    }));
}

// Bebas Neue が読み込まれてから SVG をラスタライズ（フォント未読込だとフォールバック表示になる）
export function generateLabels(scene) {
    if (!scene.textures.exists('label_rescue')) {
        scene.textures.addBase64('label_rescue', makeLabelSVG('Go rescue the crew', { fontSize: 5, fill: '#cceedd', fontWeight: '600', fontFamily: "Courier New, Menlo, monospace", letterSpacing: 0.3 }));
    }
    if (!scene.textures.exists('label_returnship')) {
        scene.textures.addBase64('label_returnship', makeLabelSVG('Return to the ship', { fontSize: 5, fill: '#cceedd', fontWeight: '600', fontFamily: "Courier New, Menlo, monospace", letterSpacing: 0.3 }));
    }
    makeFailLabel(scene, 'label_missionfailed', 'Mission Failed');
    makeFailLabel(scene, 'label_rescuefailed', 'Rescue Failed');

    // 方向矢印は assets/arrow.svg を直接使う（右向き1個分）。
    // 1〜3個の矢印を横に並べ、左向きは flipX で反転。
    const arrowOpts = { fill: '#88ffaa' }; // label_offtarget の流用元として残す
    // ゴール外着地メッセージ（矢印と同サイズ・赤寄りピンク）
    if (!scene.textures.exists('label_offtarget')) {
        scene.textures.addBase64('label_offtarget', makeLabelSVG('Landed too far from target', { ...arrowOpts, fill: '#ff6688' }));
    }
}
