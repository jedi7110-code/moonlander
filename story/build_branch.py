#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""blackhexa.md（FALL-LANDING ── フォールランディング）を「選択できる縦書きHTML」へ変換する。

マーカー:
  @@CHOICE            … ここに分岐選択画面を置く（直前までが共通の序章）
  @@ROUTE A｜ラベル    … ルートA本文の開始
  @@ROUTE B｜ラベル    … ルートB本文の開始
  @@END               … ルート本文の終わり（以降は共通のあとがき＝ネタバレ）

本文を直すときは .md を編集して再実行する:
  $ python3 build_branch.py
"""
import re, html, json, pathlib

SRC = pathlib.Path(__file__).with_name("blackhexa.md")
OUT = pathlib.Path(__file__).with_name("blackhexa.html")
GLOSS = pathlib.Path(__file__).with_name("glossary.json")
raw_lines = SRC.read_text(encoding="utf-8").splitlines()

# ---- 用語辞書（saga と共有） ----
gloss_data = {}
if GLOSS.exists():
    try:
        raw = json.loads(GLOSS.read_text(encoding="utf-8"))
        gloss_data = {k: v for k, v in raw.items() if not k.startswith("_")}
    except Exception as e:
        print(f"warning: failed to parse {GLOSS}: {e}")

gloss_patterns = []
for k, v in gloss_data.items():
    for pat in v.get("patterns", [k]):
        gloss_patterns.append((pat, k))
gloss_patterns.sort(key=lambda x: -len(x[0]))

gloss_seen_in_chapter = set()


def parse_blocks(lines):
    blocks, para, quote, ul = [], [], [], []

    def fp():
        nonlocal para
        if para:
            blocks.append(("p", "".join(para))); para = []

    def fq():
        nonlocal quote
        if quote:
            blocks.append(("quote", quote[:])); quote = []

    def fl():
        nonlocal ul
        if ul:
            blocks.append(("ul", ul[:])); ul = []

    def fa():
        fp(); fq(); fl()

    for raw in lines:
        s = raw.strip()
        if s == "":
            fa(); continue
        if s.startswith("# "):
            fa(); blocks.append(("h1", s[2:].strip())); continue
        if s.startswith("## "):
            fa(); blocks.append(("h2", s[3:].strip())); continue
        if s.startswith("### "):
            fa(); blocks.append(("h3", s[4:].strip())); continue
        if s == "---":
            fa(); blocks.append(("hr", None)); continue
        if s.startswith(">"):
            fp(); fl(); quote.append(s.lstrip(">").strip()); continue
        if s.startswith("- "):
            fp(); fq(); ul.append(s[2:].strip()); continue
        fq(); fl(); para.append(s)
    fa()
    return blocks


# ---- マーカーで4区画へ分割 ----
seg = {"head": [], "A": [], "B": [], "post": []}
labelA, labelB = "触れた者", "触れなかった者"
cur, started_routes = "head", False
for raw in raw_lines:
    s = raw.strip()
    if s == "@@CHOICE":
        continue
    if s.startswith("@@ROUTE A"):
        cur = "A"
        m = s.split("｜", 1)
        if len(m) == 2:
            labelA = m[1].strip()
        continue
    if s.startswith("@@ROUTE B"):
        cur = "B"
        m = s.split("｜", 1)
        if len(m) == 2:
            labelB = m[1].strip()
        continue
    if s == "@@END":
        cur = "post"
        continue
    seg[cur].append(raw)

title = "FALL-LANDING"
head_blocks = parse_blocks(seg["head"])
A_blocks = parse_blocks(seg["A"])
B_blocks = parse_blocks(seg["B"])
post_blocks = parse_blocks(seg["post"])


def inline(t):
    t = html.escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", t)

    def tcy(m):
        w = m.group(0)
        return f'<span class="{"tcy" if len(w) <= 4 else "upr"}">{w}</span>'

    # HTMLタグ内の strong/em などを巻き込まないよう、タグとテキストを
    # 分離してテキスト部分にだけ縦中横/正立を適用
    parts = re.split(r"(<[^>]+>)", t)
    for i, part in enumerate(parts):
        if not part.startswith("<"):
            parts[i] = re.sub(r"[0-9A-Za-z]+", tcy, part)
    return "".join(parts)


def gloss_wrap(text_segment):
    """text_segment（HTMLタグ非含有）内で、未リンクの用語の初出を一回だけ
    ラップする。長いパターンから貪欲に試す。"""
    if not gloss_patterns:
        return text_segment
    out, i = "", 0
    while i < len(text_segment):
        best = None
        for pat, key in gloss_patterns:
            if key in gloss_seen_in_chapter:
                continue
            idx = text_segment.find(pat, i)
            if idx == -1:
                continue
            if (best is None) or (idx < best[0]) or \
               (idx == best[0] and len(pat) > len(best[1])):
                best = (idx, pat, key)
        if best is None:
            out += text_segment[i:]
            break
        start, pat, key = best
        out += text_segment[i:start]
        out += f'<a class="gloss" data-gloss="{html.escape(key)}">{pat}</a>'
        gloss_seen_in_chapter.add(key)
        i = start + len(pat)
    return out


def render_text(pay):
    """inline() を適用した上で、テキスト部分にのみ用語辞書リンクを張る。"""
    out = inline(pay)
    if not gloss_patterns:
        return out
    parts = re.split(r"(<[^>]+>)", out)
    in_link = False
    for i, part in enumerate(parts):
        if part.startswith("<"):
            ps = part.lower()
            if ps.startswith("<a"):
                in_link = True
            elif ps.startswith("</a"):
                in_link = False
            continue
        if in_link:
            continue
        parts[i] = gloss_wrap(part)
    return "".join(parts)


def render(blocks, hids=None):
    """blocks -> html。hids には (id,label) の見出し一覧を集める。"""
    out = []
    for typ, pay in blocks:
        if typ == "h1":
            # 「英語 ── 日本語」を分割して2段表示
            if "──" in pay:
                en_part, jp_part = [p.strip() for p in pay.split("──", 1)]
                out.append(
                    '<div class="series">THE FALL</div>'
                    '<h1 class="title">'
                    f'<span class="ttl-en">{inline(en_part)}</span>'
                    f'<span class="ttl-jp">{inline(jp_part)}</span>'
                    '</h1>'
                )
            else:
                out.append(
                    '<div class="series">THE FALL</div>'
                    f'<h1 class="title">{inline(pay)}</h1>'
                )
        elif typ == "h2":
            hid = f"h{len(hids)}" if hids is not None else ""
            if hids is not None:
                hids.append((hid, pay))
            # 章境界で「リンク済み」リセット → 章ごとに初出1回ずつ
            gloss_seen_in_chapter.clear()
            out.append(f'<h2 id="{hid}">{inline(pay)}</h2>')
        elif typ == "h3":
            out.append(f"<h3>{render_text(pay)}</h3>")
        elif typ == "p":
            out.append(f"<p>{render_text(pay)}</p>")
        elif typ == "hr":
            out.append('<hr class="scene">')
        elif typ == "quote":
            inner = "".join(f"<p>{render_text(x)}</p>" for x in pay)
            out.append(f"<blockquote>{inner}</blockquote>")
        elif typ == "ul":
            items = "".join(f"<li>{render_text(x)}</li>" for x in pay)
            out.append(f"<ul>{items}</ul>")
    return "".join(out)


# 各区画の描画前に gloss_seen をリセット（区画＝独立した章扱い）
def _reset(): gloss_seen_in_chapter.clear()
hidsA, hidsB = [], []
_reset(); head_html = render(head_blocks)
_reset(); A_html = render(A_blocks, hidsA)
_reset(); B_html = render(B_blocks, hidsB)
_reset(); post_html = render(post_blocks)


def navlist(hids, route):
    return "".join(
        f'<a data-go="{route}:{hid}">{html.escape(lbl)}</a>' for hid, lbl in hids
    )


navA, navB = navlist(hidsA, "A"), navlist(hidsB, "B")

# 用語辞書 JSON（モーダル本文用）
gloss_json = json.dumps(gloss_data, ensure_ascii=False)

DOC = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} ── 分岐譚</title>
<link rel="stylesheet" href="reader.css">
<style>
  /* ───── blackhexa (FALL-LANDING) 固有 ───── */
  /* 警告色（B ルート用）— reader.css の :root に追加 */
  :root {{ --warn:#d8736b; }}
  html.paper {{ --warn:#a23b2f; }}

  /* タイトル文字サイズ：FALL-LANDING は 12 字（長いので小さめ） */
  .book .title .ttl-en {{ font-size:min(4.5vw, 30px); }}

  /* ルート選択UI：序章末尾の選択カードを表示するまで本文ペインは非表示 */
  .scroll {{ display:none; }}
  .scroll.on {{ display:block; }}

  /* バー：分岐譚サブタイトル */
  .bar .rt {{ color:var(--dim); white-space:nowrap; }}

  /* 分岐選択（序章末尾） */
  #choice {{ display:flex; flex-direction:column; align-items:center;
    gap:24px; margin:3.5em 0 1em; padding:2.4em 1em 1em;
    border-top:1px solid var(--rule); }}
  #choice .hexa {{ display:block; max-width:560px; width:100%; height:auto;
    border-radius:6px;
    box-shadow:0 0 48px rgba(0,0,0,.6), 0 0 24px rgba(111,208,200,.12); }}
  #choice .hexa-cap {{ color:var(--dim); font-size:11px; letter-spacing:.18em;
    text-align:center; margin-top:-12px;
    font-family:system-ui,-apple-system,sans-serif; }}
  #choice .ask {{ color:var(--ink); font-size:18px; letter-spacing:.12em;
    text-align:center; line-height:2; }}
  #choice .ask small {{ display:block; color:var(--dim); font-size:13px;
    letter-spacing:.08em; margin-top:8px; }}
  #choice .opts {{ display:flex; gap:20px; flex-wrap:wrap; justify-content:center; }}
  .card {{ width:260px; border:1px solid var(--rule); background:var(--bg2);
    border-radius:12px; padding:22px; cursor:pointer; text-align:center;
    transition:.18s; }}
  .card:hover {{ transform:translateY(-3px); border-color:var(--accent); }}
  .card.b:hover {{ border-color:var(--warn); }}
  .card h3 {{ margin:0 0 8px; font-size:19px; letter-spacing:.14em;
    color:var(--accent); }}
  .card.b h3 {{ color:var(--warn); }}
  .card p {{ margin:0; color:var(--dim); font-size:13px; line-height:1.9; }}

  /* スポイラ開閉 */
  .spoiler {{ margin:0 1.1em; }}
  .spoiler > button {{ writing-mode:horizontal-tb; background:var(--quote);
    color:var(--dim); border:1px solid var(--rule); border-radius:8px;
    padding:8px 14px; cursor:pointer; font:inherit; }}
  .spoiler.open .sp-body {{ display:block; }}
  .spoiler .sp-body {{ display:none; }}

  /* 行き止まり（B ルート末尾）の hover 色 */
  .next-read.dead .nr-card:hover {{ border-color:var(--warn); }}

  /* 左下ヒント（任意） */
  .hint {{ position:fixed; left:14px; bottom:12px; z-index:15;
    color:var(--dim); font-size:12px; letter-spacing:.08em;
    font-family:system-ui,sans-serif; opacity:.7; pointer-events:none; }}
</style>
</head>
<body>
  <div class="bar" id="bar">
    <button id="barToggle" type="button" aria-label="メニュー" aria-expanded="false" title="メニュー">☰</button>
    <span class="nm">{html.escape(title)}</span>
    <span class="rt" id="rt">分岐譚</span>
    <nav id="nav"></nav>
    <button id="rebtn" class="hide">分岐をやり直す</button>
    <button id="othbtn" class="hide">もう一方を読む</button>
    <a class="xlink" href="index.html" title="入口へ">⌂</a>
    <button id="bmBtn" title="しおり：前回読んだ位置へ">📑 しおり</button>
    <button id="fontDec" title="文字を小さく" aria-label="文字を小さく">A-</button>
    <button id="fontInc" title="文字を大きく" aria-label="文字を大きく">A+</button>
  </div>

  <!-- 共通：序章 ＋ 末尾に分岐選択（本文と一体・上下自由スクロール） -->
  <div class="scroll on" id="sc-head">
    <div class="book">
      {head_html}
      <div id="choice">
        <img class="hexa" src="img/blackhexa.webp"
             alt="月面に立つ六角柱の黒い鏡面体──〈黒筐（こっきょう）〉。鏡面の奥に何層もの偏光膜が深く透けて見える"
             loading="lazy">
        <div class="hexa-cap">〈黒筐（こっきょう）〉</div>
        <div class="ask">触れるか。触れないか。<small>選んだ先で、物語は二度と交わらない</small></div>
        <div class="opts">
          <div class="card a" data-pick="A">
            <h3>触れる</h3>
            <p>鏡面に、手をつく。<br>― ルートA「{html.escape(labelA)}」へ</p>
          </div>
          <div class="card b" data-pick="B">
            <h3>触れない</h3>
            <p>手を引き、背を向ける。<br>― ルートB「{html.escape(labelB)}」へ</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ルートA -->
  <div class="scroll" id="sc-A">
    <div class="book">
      {A_html}
      <aside class="next-read">
        <div class="nr-label">▷ この〈手〉が千年後どう書き写されたか</div>
        <a class="nr-card" href="saga.html">
          <h3>FALL-LINE ── フォールライン（本編）</h3>
          <p>先行者の〈退ける手つき〉が、雨の都市の潜行者ミラ、淀みの層に留まったライラ、そして千年後の子孫カイへと、名を変えながら書き写されていく。本編サーガへ。</p>
        </a>
        <a class="nr-back" href="index.html">⌂ 入口へ戻る</a>
      </aside>
      <div class="spoiler"><button>▸ 二つの結末について（ネタバレ）</button>
        <div class="sp-body">{post_html}</div></div>
    </div>
  </div>

  <!-- ルートB -->
  <div class="scroll" id="sc-B">
    <div class="book">
      {B_html}
      <aside class="next-read dead">
        <div class="nr-label">（袋小路。本編とは交わらない）</div>
        <a class="nr-back" href="index.html">⌂ 入口へ戻る</a>
      </aside>
      <div class="spoiler"><button>▸ 二つの結末について（ネタバレ）</button>
        <div class="sp-body">{post_html}</div></div>
    </div>
  </div>

  <aside class="progress" aria-hidden="true">
    <div class="track"></div>
    <div class="ticks" id="ticks"></div>
    <div class="fill" id="fill"></div>
    <div class="pct" id="pct">0%</div>
  </aside>
  <a class="resume" id="resume" href="#">▷ 前回の続き <small class="pct">--%</small></a>

<script src="reader.js"></script>
<script>
  // ────────── 分岐譚：序章＋ルートA/Bのペイン切替 ──────────
  var NAVA = `{navA}`, NAVB = `{navB}`;
  var panes = {{head:'sc-head', A:'sc-A', B:'sc-B'}};
  var rt = document.getElementById('rt'),
      nav = document.getElementById('nav'),
      reb = document.getElementById('rebtn'),
      oth = document.getElementById('othbtn');

  function showScroll(id){{
    document.querySelectorAll('.scroll').forEach(function(s){{
      s.classList.toggle('on', s.id===id);
    }});
  }}
  function toTop(el){{
    requestAnimationFrame(function(){{
      requestAnimationFrame(function(){{ if(el) el.scrollTop = 0; }}); }});
  }}
  function activeScroll(){{ return document.querySelector('.scroll.on'); }}

  // 状態は 'head'（序章＋末尾に選択）/ 'A' / 'B' の三つ。
  function gotoState(st, keepPos){{
    if (st==='head'){{
      showScroll('sc-head');
      rt.textContent='序章';
      nav.innerHTML='';
      reb.classList.add('hide'); oth.classList.add('hide');
      if (!keepPos) toTop(document.getElementById('sc-head'));
    }} else {{
      showScroll(panes[st]);
      rt.textContent = (st==='A'?'ルートA 触れた者':'ルートB 触れなかった者');
      nav.innerHTML = (st==='A'?NAVA:NAVB);
      reb.classList.remove('hide'); oth.classList.remove('hide');
      toTop(document.getElementById(panes[st]));
      try{{localStorage.setItem('mono-route',st);}}catch(e){{}}
    }}
    try{{localStorage.setItem('mono-state',st);}}catch(e){{}}
  }}

  // ────────── 共通ヘッダ機能（ハンバーガー・文字サイズ） ──────────
  // しおりは多ペイン対応の独自実装が下にあるため、ここでは渡さない
  Reader.init({{}});

  // ルート選択
  document.querySelectorAll('.card').forEach(function(c){{
    c.addEventListener('click', function(){{ gotoState(c.dataset.pick); }});
  }});
  reb.addEventListener('click', function(){{
    gotoState('head', true);
    requestAnimationFrame(function(){{
      var ch=document.getElementById('choice');
      if(ch) ch.scrollIntoView({{behavior:'smooth', block:'start'}});
    }});
  }});
  oth.addEventListener('click', function(){{
    gotoState(rt.textContent.indexOf('A')>=0 ? 'B' : 'A');
  }});

  // 章ナビ：見出しの先頭へ（ドロワーを閉じるのは reader.js が delegation で処理）
  nav.addEventListener('click', function(e){{
    var a=e.target.closest('a'); if(!a)return;
    var g=a.dataset.go.split(':'), t=document.getElementById(g[1]);
    if(t) t.scrollIntoView({{behavior:'smooth', block:'start'}});
  }});

  // ネタバレ開閉
  document.querySelectorAll('.spoiler>button').forEach(function(b){{
    b.addEventListener('click', function(){{
      b.parentElement.classList.toggle('open');
    }});
  }});

  // ────────── 進捗ゲージ：表示中のペインを監視 ──────────
  var pgFill = document.getElementById('fill');
  var pgTicks = document.getElementById('ticks');
  var pgPct = document.getElementById('pct');
  function rebuildTicks(){{
    pgTicks.innerHTML = '';
    var sc = activeScroll(); if(!sc) return;
    var book = sc.querySelector('.book'); if(!book) return;
    var hs = book.querySelectorAll('h2');
    var total = sc.scrollHeight;
    if (total <= 0) return;
    hs.forEach(function(h){{
      var i = document.createElement('i');
      i.style.top = (h.offsetTop / total * 100) + '%';
      pgTicks.appendChild(i);
    }});
  }}
  function updateProgress(){{
    var sc = activeScroll();
    if (!sc){{ pgFill.style.height='0%'; pgPct.textContent='0%'; return; }}
    var max = sc.scrollHeight - sc.clientHeight;
    if (max <= 0){{ pgFill.style.height='0%'; pgPct.textContent='0%'; return; }}
    var r = Math.min(1, Math.max(0, sc.scrollTop / max));
    pgFill.style.height = (r * 100) + '%';
    pgPct.textContent = Math.round(r * 100) + '%';
  }}
  document.querySelectorAll('.scroll').forEach(function(s){{
    s.addEventListener('scroll', updateProgress, {{passive:true}});
  }});
  window.addEventListener('resize', function(){{ rebuildTicks(); updateProgress(); }});

  // ────────── しおり（多ペイン：序章／A／B 独立に保存） ──────────
  function bmKey(){{
    var s = activeScroll();
    return s ? 'mira-bm-mono-' + s.id.replace('sc-','') : null;
  }}
  function bmGet(k){{
    try {{ return parseInt(localStorage.getItem(k)||'0',10); }}
    catch(e) {{ return 0; }}
  }}
  function bmSet(k,v){{
    try {{ localStorage.setItem(k, String(v)); }} catch(e) {{}}
  }}
  var _bmReady = false;
  setTimeout(function(){{ _bmReady = true; }}, 1500);
  var _bmT = 0;
  document.querySelectorAll('.scroll').forEach(function(s){{
    s.addEventListener('scroll', function(){{
      if (!_bmReady) return;
      if (!s.classList.contains('on')) return;
      var k = bmKey(); if (!k) return;
      clearTimeout(_bmT);
      _bmT = setTimeout(function(){{ bmSet(k, s.scrollTop); }}, 500);
    }}, {{passive:true}});
  }});

  // しおりボタン：saga と同じ「保存／戻る＋フィードバック」挙動
  document.getElementById('bmBtn').addEventListener('click', function(){{
    var btn = this;
    var sc = activeScroll(); var k = bmKey();
    if (!sc || !k) return;
    var cur = sc.scrollTop;
    var saved = bmGet(k);
    var orig = btn.textContent;
    if (saved > 0 && Math.abs(cur - saved) > 40) {{
      sc.scrollTo({{top: saved, behavior:'smooth'}});
      btn.textContent = '📑 戻る';
    }} else {{
      bmSet(k, cur);
      btn.textContent = '📑 保存';
    }}
    setTimeout(function(){{ btn.textContent = orig; }}, 900);
  }});

  function _maybeResume(){{
    var sc = activeScroll(); var k = bmKey();
    if (!sc || !k) return;
    var p = bmGet(k);
    var max = sc.scrollHeight - sc.clientHeight;
    var t = document.getElementById('resume');
    if (max <= 0 || p < Math.max(80, max * 0.05)) {{
      t.classList.remove('show'); return;
    }}
    t.querySelector('.pct').textContent = Math.round(p/max*100) + '%';
    t.classList.add('show');
    t.onclick = function(e){{
      e.preventDefault();
      sc.scrollTo({{top:p, behavior:'smooth'}});
      t.classList.remove('show');
    }};
    setTimeout(function(){{ t.classList.remove('show'); }}, 8000);
  }}

  // ペイン切替後に進捗とレジューム再評価
  var _goto = gotoState;
  gotoState = function(st, keepPos){{
    _goto(st, keepPos);
    requestAnimationFrame(function(){{
      requestAnimationFrame(function(){{
        rebuildTicks(); updateProgress(); _maybeResume();
      }});
    }});
  }};

  // 最初は序章から
  window.addEventListener('load', function(){{
    gotoState('head');
    requestAnimationFrame(function(){{
      requestAnimationFrame(function(){{ rebuildTicks(); updateProgress(); }});
    }});
  }});
  gotoState('head');
</script>

<!-- ────────── 用語辞書モーダル ────────── -->
<div id="gloss-modal" class="gloss-modal" hidden aria-hidden="true" role="dialog" aria-modal="true">
  <div class="gloss-overlay" data-gloss-close></div>
  <div class="gloss-panel">
    <button class="gloss-close" type="button" aria-label="閉じる" data-gloss-close>×</button>
    <img class="gloss-image" alt="" hidden>
    <h3 class="gloss-title"></h3>
    <div class="gloss-body"></div>
  </div>
</div>
<script>
window.GLOSS_DATA = {gloss_json};
(function(){{
  var modal = document.getElementById('gloss-modal');
  if (!modal) return;
  var titleEl = modal.querySelector('.gloss-title');
  var bodyEl  = modal.querySelector('.gloss-body');
  var imgEl   = modal.querySelector('.gloss-image');
  function openGloss(key){{
    var data = (window.GLOSS_DATA || {{}})[key];
    if (!data) return;
    titleEl.textContent = data.title || key;
    bodyEl.innerHTML = data.body || '';
    if (data.image){{ imgEl.src = data.image; imgEl.alt = data.title || key; imgEl.hidden = false; }}
    else {{ imgEl.removeAttribute('src'); imgEl.hidden = true; }}
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }}
  function closeGloss(){{
    modal.hidden = true; modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }}
  document.addEventListener('click', function(e){{
    var a = e.target.closest && e.target.closest('a.gloss');
    if (a){{ e.preventDefault(); openGloss(a.dataset.gloss); return; }}
    if (e.target.closest && e.target.closest('[data-gloss-close]')){{ e.preventDefault(); closeGloss(); }}
  }});
  document.addEventListener('keydown', function(e){{
    if (e.key === 'Escape' && !modal.hidden) closeGloss();
  }});
}})();
</script>
</body>
</html>
"""

OUT.write_text(DOC, encoding="utf-8")
print(f"wrote {OUT}")
print(f"  routeA headings={len(hidsA)}  routeB headings={len(hidsB)}  "
      f"size={len(DOC):,} chars")
