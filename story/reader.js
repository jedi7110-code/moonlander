/* ============================================================
   THE FALL series ── 共通リーダー JS
   saga.html / blackhexa.html 両方で共有
   ヘッダ機能：ハンバーガー・文字サイズ・しおり・前回続きトースト
   使い方：
     Reader.init({
       getScroll: () => window,      // window/body スクロール。旧式の独自スクロール要素も可
       bmKey: 'mira-bm-saga',        // しおりの localStorage キー
     });
   ページ固有（章ナビのスクロール、進捗ゲージ、分岐選択など）は
   各ビルドの inline <script> に残す。
   ============================================================ */
(function(){
  'use strict';

  // ────────── ハンバーガー（モバイル時のドロワー開閉） ──────────
  function setupHamburger(){
    var bar = document.getElementById('bar');
    var toggle = document.getElementById('barToggle');
    if (!bar || !toggle) return;
    function close(){
      bar.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', function(e){
      e.stopPropagation();
      var op = bar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', op ? 'true' : 'false');
    });
    // 章ナビをタップしたら閉じる（動的に増えるアンカーにも効くよう delegation）
    bar.addEventListener('click', function(e){
      if (e.target.closest('nav a')) close();
    });
    // バー外タップで閉じる
    document.addEventListener('click', function(e){
      if (!bar.contains(e.target)) close();
    });
    // ESC で閉じる
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && bar.classList.contains('open')) close();
    });
  }

  // ────────── 文字サイズ A-/A+（--fs を 0.8〜1.6 で操作） ──────────
  function setupFontSize(){
    var dec = document.getElementById('fontDec');
    var inc = document.getElementById('fontInc');
    if (!dec || !inc) return;
    var KEY = 'mira-fs', fs = 1;
    try { var s = parseFloat(localStorage.getItem(KEY)); if (s) fs = s; } catch(e){}
    function apply(){ document.documentElement.style.setProperty('--fs', fs); }
    function set(v){
      fs = Math.min(1.6, Math.max(0.8, Math.round(v * 10) / 10));
      apply();
      try { localStorage.setItem(KEY, String(fs)); } catch(e){}
    }
    apply();
    inc.addEventListener('click', function(){ set(fs + 0.1); });
    dec.addEventListener('click', function(){ set(fs - 0.1); });
  }

  // ────────── スクロール抽象 ──────────
  // iOS Safari の「画面上部タップで先頭へ戻る」を効かせるため、
  // FALL-LINE は window/body スクロールを使う。旧ページ用に要素スクロールも残す。
  function rootScroller(){
    return document.scrollingElement || document.documentElement || document.body;
  }
  function isWindowScroller(sc){
    return sc === window || sc === document || sc === document.body ||
           sc === document.documentElement || sc === rootScroller();
  }
  function scrollTopOf(sc){
    if (isWindowScroller(sc)) {
      return window.pageYOffset || rootScroller().scrollTop || 0;
    }
    return sc.scrollTop || 0;
  }
  function scrollMaxOf(sc){
    if (isWindowScroller(sc)) {
      var root = rootScroller();
      return Math.max(0, root.scrollHeight - window.innerHeight);
    }
    return Math.max(0, sc.scrollHeight - sc.clientHeight);
  }
  function scrollToTop(sc, top, behavior){
    var opts = {top: top, behavior: behavior || 'auto'};
    if (isWindowScroller(sc)) {
      window.scrollTo(opts);
    } else {
      sc.scrollTo(opts);
    }
  }
  function addScrollHandler(sc, handler){
    (isWindowScroller(sc) ? window : sc).addEventListener(
      'scroll', handler, {passive: true}
    );
  }

  // ────────── しおり ──────────
  //  クリック：いま見ている位置を保存（フィードバック「📑 保存」）。
  //   ただし保存位置から離れている時は、保存位置へジャンプ（「📑 戻る」）。
  //  スクロール中もデバウンスで自動保存（起動 1.5 秒後から）。
  function setupBookmark(getScroll, key){
    var btn = document.getElementById('bmBtn');
    key = key || 'mira-bm';
    function get(){
      try { return parseInt(localStorage.getItem(key) || '0', 10); }
      catch(e){ return 0; }
    }
    function setVal(v){
      try { localStorage.setItem(key, String(v)); } catch(e){}
    }
    // 自動保存（スクロールデバウンス）
    var ready = false;
    setTimeout(function(){ ready = true; }, 1500);
    var t = 0;
    function attach(sc){
      if (!sc || sc.__bmAttached) return;
      sc.__bmAttached = true;
      addScrollHandler(sc, function(){
        if (!ready) return;
        clearTimeout(t);
        t = setTimeout(function(){ setVal(scrollTopOf(sc)); }, 500);
      });
    }
    // 初回 + 100ms 後（遅延生成ペイン対策）
    attach(getScroll());
    setTimeout(function(){ attach(getScroll()); }, 100);
    // クリック挙動（ボタンがあるページだけ）
    if (btn) {
      btn.addEventListener('click', function(){
        var sc = getScroll(); if (!sc) return;
        attach(sc);  // 別ペインになっていたら今のペインで自動保存も繋ぎ直す
        var cur = scrollTopOf(sc);
        var saved = get();
        var orig = btn.textContent;
        if (saved > 0 && Math.abs(cur - saved) > 40) {
          // 別の場所にいる → 保存位置へ戻る
          scrollToTop(sc, saved, 'smooth');
          btn.textContent = '📑 戻る';
        } else {
          // いまの位置を保存
          setVal(cur);
          btn.textContent = '📑 保存';
        }
        setTimeout(function(){ btn.textContent = orig; }, 900);
      });
    }
    // 前回の続き案内トースト（ロード時に1回だけ）
    window.addEventListener('load', function(){
      var sc = getScroll(); if (!sc) return;
      var saved = get();
      var max = scrollMaxOf(sc);
      if (max <= 0 || saved < Math.max(80, max * 0.05)) return;
      var toast = document.getElementById('resume');
      if (!toast) return;
      var pct = toast.querySelector('.pct');
      if (pct) pct.textContent = Math.min(100, Math.round(saved / max * 100)) + '%';
      toast.classList.add('show');
      toast.onclick = function(e){
        e.preventDefault();
        scrollToTop(sc, saved, 'smooth');
        toast.classList.remove('show');
      };
      setTimeout(function(){ toast.classList.remove('show'); }, 8000);
    });
  }

  // ────────── public ──────────
  window.Reader = {
    init: function(opts){
      opts = opts || {};
      setupHamburger();
      setupFontSize();
      if (opts.getScroll) setupBookmark(opts.getScroll, opts.bmKey);
    }
  };
})();
