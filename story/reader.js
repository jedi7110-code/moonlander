/* ============================================================
   THE FALL series ── 共通リーダー JS
   saga.html / blackhexa.html 両方で共有
   ヘッダ機能：ハンバーガー・文字サイズ・しおり・前回続きトースト
   使い方：
     Reader.init({
       getScroll: () => window,      // window/body スクロール。旧式の独自スクロール要素も可
       bmKey: 'mira-bm-saga',        // 作品・章ごとのしおりCookie名
     });
   ページ固有（章ナビのスクロール、進捗ゲージ、分岐選択など）は
   各ビルドの inline <script> に残す。
   ============================================================ */
(function(){
  'use strict';
  var cookiePath = document.currentScript ? new URL('.', document.currentScript.src).pathname : '/';
  var saveBookmark = function(){};

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
  // Cookieは1年間保持。画面幅や文字サイズが変わっても同じ段落へ戻す。
  // スクロール時に位置を取得し、モーダルの破棄前にも同期保存できる。
  function setupBookmark(getScroll, key){
    var btn = document.getElementById('bmBtn');
    key = key || 'mira-bm';
    function normalize(value){
      if (typeof value === 'number') value = {top:value};
      if (!value || !Number.isFinite(value.top) || value.top < 0) return null;
      var result = {top:value.top};
      if (Number.isInteger(value.block) && value.block >= 0 &&
          Number.isFinite(value.fraction) && value.fraction >= 0 && value.fraction <= 1 &&
          typeof value.sample === 'string' && value.sample.length <= 48) {
        result.block = value.block; result.fraction = value.fraction; result.sample = value.sample;
        result.gap = Number.isFinite(value.gap) && value.gap >= 0 ? Math.min(10000,value.gap) : 0;
      }
      return result;
    }
    function get(){
      try {
        var prefix = encodeURIComponent(key) + '=';
        var entry = document.cookie.split(';').map(function(v){ return v.trim(); }).find(function(v){ return v.indexOf(prefix) === 0; });
        if (entry) {
          var value = normalize(JSON.parse(decodeURIComponent(entry.slice(prefix.length))));
          if (value) return value;
        }
      } catch(e){}
      // 以前の読書位置を最初の一度だけ引き継ぐ。
      try {
        var legacy = localStorage.getItem(key);
        var old = legacy === null ? null : normalize(Number(legacy));
        if (old) { setVal(old); return old; }
      } catch(e){}
      return null;
    }
    function setVal(v){
      if (!v) return;
      try {
        document.cookie = encodeURIComponent(key) + '=' + encodeURIComponent(JSON.stringify(v)) +
          '; Max-Age=31536000; Path=' + cookiePath + '; SameSite=Lax' +
          (location.protocol === 'https:' ? '; Secure' : '');
      } catch(e){}
    }
    function blocks(){ return Array.from(document.querySelectorAll('.book > *')); }
    function sample(el){
      var text = (el.textContent.trim() || el.querySelector('img')?.getAttribute('src') || el.tagName).slice(0,96), hash = 2166136261;
      for (var i=0;i<text.length;i++) hash = Math.imul(hash ^ text.charCodeAt(i),16777619);
      return (hash >>> 0).toString(16);
    }
    function readingLine(sc){
      var bar = document.getElementById('bar');
      return Math.max(isWindowScroller(sc) ? 0 : sc.getBoundingClientRect().top, bar ? bar.getBoundingClientRect().bottom : 0) + 8;
    }
    function capture(sc){
      var top = Math.max(0,Math.min(scrollTopOf(sc),scrollMaxOf(sc))), value = {top:top};
      if (top === 0) return value;
      var line = readingLine(sc), items = blocks();
      for (var i=0;i<items.length;i++) {
        var rect = items[i].getBoundingClientRect();
        if (rect.top > line) break;
        if (rect.height > 0) {
          value.block = i; value.fraction = Math.min(1,Math.max(0,(line-rect.top)/rect.height)); value.sample = sample(items[i]);
          value.gap = Math.max(0,line-rect.bottom);
        }
      }
      return value;
    }
    function position(sc, value){
      var items = blocks(), block = items[value.block];
      if (value.sample && (!block || sample(block) !== value.sample)) block = items.find(function(el){ return sample(el) === value.sample; });
      if (!block || value.fraction === undefined) return Math.min(value.top,scrollMaxOf(sc));
      var rect = block.getBoundingClientRect();
      return Math.max(0,Math.min(scrollMaxOf(sc),scrollTopOf(sc)+rect.top+rect.height*value.fraction+(value.gap||0)-readingLine(sc)));
    }
    var saved = get(), lastPosition = saved, ready = false, restoring = false, interacted = false, dirty = false, t = 0;
    function persist(){
      if (!dirty) return;
      setVal(lastPosition); dirty = false;
    }
    function flush(){
      clearTimeout(t);
      var sc = getScroll();
      if (ready && sc) {
        var current = capture(sc);
        if (!lastPosition || current.top !== lastPosition.top) dirty = true;
        lastPosition = current; persist();
      }
    }
    saveBookmark = flush;
    function attach(sc){
      if (!sc || sc.__bmAttached) return;
      sc.__bmAttached = true;
      addScrollHandler(sc, function(){
        if (!ready || restoring) return;
        lastPosition = capture(sc);
        dirty = true;
        clearTimeout(t);
        t = setTimeout(persist, 400);
      });
    }
    attach(getScroll());
    setTimeout(function(){ attach(getScroll()); }, 100);
    // 読者の操作を優先し、読み始めた後に遅れて位置を戻さない。
    function userStarted(){ interacted = true; restoring = false; ready = true; }
    ['wheel','touchstart','pointerdown','keydown'].forEach(function(event){
      window.addEventListener(event,userStarted,{passive:true,capture:true});
    });
    // iframeを外した後は寸法を再計算せず、最後に取得した位置を保存。
    window.addEventListener('pagehide',function(){ clearTimeout(t); persist(); });
    document.addEventListener('visibilitychange',function(){
      if (document.hidden) { clearTimeout(t); persist(); }
    });
    if (btn) {
      btn.addEventListener('click', function(){
        var sc = getScroll(); if (!sc) return;
        attach(sc);
        var bookmark = get(), target = bookmark ? position(sc,bookmark) : 0;
        var orig = btn.textContent;
        if (target > 0 && Math.abs(scrollTopOf(sc) - target) > 40) {
          scrollToTop(sc, target, 'smooth');
          btn.textContent = '📑 戻る';
        } else {
          flush();
          btn.textContent = '📑 保存';
        }
        setTimeout(function(){ btn.textContent = orig; }, 900);
      });
    }
    var resume = saved && saved.top > 0 && !location.hash;
    if (resume && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
    function restore(){
      var sc = getScroll(); if (!sc || !restoring) return;
      scrollToTop(sc,position(sc,saved),'instant');
      lastPosition = capture(sc);
      var pct = document.getElementById('resume')?.querySelector('.pct');
      if (pct) pct.textContent = Math.round(scrollTopOf(sc)/Math.max(1,scrollMaxOf(sc))*100) + '%';
    }
    function loaded(){
      Promise.resolve(document.fonts?.ready).then(function(){
        if (!resume || interacted) { ready = true; return; }
        restoring = true; restore();
        requestAnimationFrame(function(){
          restore(); ready = true;
          var toast = document.getElementById('resume'), sc = getScroll();
          if (toast && sc && !interacted) {
            toast.firstChild.nodeValue = '栞の位置から再開 ';
            var pct = toast.querySelector('.pct');
            if (pct) pct.textContent = Math.round(scrollTopOf(sc)/Math.max(1,scrollMaxOf(sc))*100) + '%';
            toast.classList.add('show');
            toast.onclick = function(e){ e.preventDefault(); scrollToTop(sc,position(sc,saved),'smooth'); toast.classList.remove('show'); };
            setTimeout(function(){ toast.classList.remove('show'); },4000);
          }
        });
        // 遅延画像が読み込まれて段落が動いた場合も、操作開始までは追従。
        document.addEventListener('load',function(e){ if (e.target.tagName === 'IMG') restore(); },true);
        window.addEventListener('resize',restore);
        setTimeout(function(){ restoring = false; },3000);
      });
    }
    if (document.readyState === 'complete') loaded(); else window.addEventListener('load',loaded,{once:true});
  }

  // ────────── public ──────────
  window.Reader = {
    saveBookmark: function(){ saveBookmark(); },
    init: function(opts){
      opts = opts || {};
      setupHamburger();
      setupFontSize();
      if (opts.getScroll) setupBookmark(opts.getScroll, opts.bmKey);
    }
  };
})();
