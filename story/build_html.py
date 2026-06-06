#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""物語-長編版.md を縦書き小説HTMLへ変換する。
単一ソース（.md）から生成するので、本文を直すときは .md を編集して再実行する。
  $ python3 build_html.py
"""
import re, html, json, pathlib

SRC = pathlib.Path(__file__).with_name("saga.md")
OUT = pathlib.Path(__file__).with_name("saga.html")
GLOSS = pathlib.Path(__file__).with_name("glossary.json")

# ---- 用語辞書（あれば読み込む。本文初出に辞書モーダルへのリンクを張る） ----
gloss_data = {}
if GLOSS.exists():
    try:
        raw = json.loads(GLOSS.read_text(encoding="utf-8"))
        # _format_notes など _ で始まるキーは除外
        gloss_data = {k: v for k, v in raw.items() if not k.startswith("_")}
    except Exception as e:
        print(f"warning: failed to parse {GLOSS}: {e}")

# (pattern, key) のリスト、長いパターンから先に試す
gloss_patterns = []
for k, v in gloss_data.items():
    for pat in v.get("patterns", [k]):
        gloss_patterns.append((pat, k))
gloss_patterns.sort(key=lambda x: -len(x[0]))

# 章ごとに「もうリンク済み」の key を記録（h2 で reset）
gloss_seen_in_chapter = set()

lines = SRC.read_text(encoding="utf-8").splitlines()

# ---- マークダウンをブロックへ ----
blocks = []          # (type, payload)
para, quote, ul = [], [], []

def flush_para():
    global para
    if para:
        blocks.append(("p", "".join(para)))
        para = []

def flush_quote():
    global quote
    if quote:
        blocks.append(("quote", quote[:]))
        quote = []

def flush_ul():
    global ul
    if ul:
        blocks.append(("ul", ul[:]))
        ul = []

def flush_all():
    flush_para(); flush_quote(); flush_ul()

for raw in lines:
    line = raw.rstrip("\n")
    s = line.strip()
    if s == "":
        flush_all(); continue
    if s.startswith("# "):
        flush_all(); blocks.append(("h1", s[2:].strip())); continue
    if s.startswith("## "):
        flush_all(); blocks.append(("h2", s[3:].strip())); continue
    if s.startswith("### "):
        flush_all(); blocks.append(("h3", s[4:].strip())); continue
    if s == "---":
        flush_all(); blocks.append(("hr", None)); continue
    if s.startswith(">"):
        flush_para(); flush_ul()
        quote.append(s.lstrip(">").strip()); continue
    if s.startswith("- "):
        flush_para(); flush_quote()
        ul.append(s[2:].strip()); continue
    # 画像挿入（行全体が ![alt](src) のとき）
    img_m = re.match(r'^!\[(.*?)\]\(([^)]+)\)$', s)
    if img_m:
        flush_all()
        blocks.append(("img", (img_m.group(1), img_m.group(2)))); continue
    # 通常本文：空行までを 1 段落に結合（md 内の改行は折り返し）
    flush_quote(); flush_ul()
    para.append(s)
flush_all()

# ---- 用語辞書：テキスト断片の初出を <a class="gloss"> でラップ ----
def gloss_wrap(text_segment: str) -> str:
    """text_segment（HTMLタグ非含有）内で、未リンクの用語の初出を一回だけ
    ラップする。長いパターンから貪欲に試す。"""
    if not gloss_patterns:
        return text_segment
    out, i = "", 0
    while i < len(text_segment):
        # 残り文字列から、未使用 key のうち最も早い出現位置を探す
        best = None  # (start_index, pattern, key)
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

# ---- インライン整形 ----
def inline(t: str) -> str:
    t = html.escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", t)
    # 半角英数の連なりは縦中横（4文字以下）／それ以上は正立回転回避
    def tcy(m):
        w = m.group(0)
        cls = "tcy" if len(w) <= 4 else "upr"
        return f'<span class="{cls}">{w}</span>'
    # HTMLタグ内の strong/em などを巻き込まないよう、タグとテキストを
    # 分離してテキスト部分にだけ適用する
    parts = re.split(r"(<[^>]+>)", t)
    for i, part in enumerate(parts):
        if not part.startswith("<"):
            parts[i] = re.sub(r"[0-9A-Za-z]+", tcy, part)
    return "".join(parts)

def render_text(pay: str) -> str:
    """inline() を適用した上で、テキスト部分にのみ用語辞書リンクを張る。
    既存の <a> タグ内側はネストを避けるためスキップ。"""
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

# ---- HTML 生成 ----
body, nav, title, chap_i = [], [], "FALL-LINE", 0
for typ, pay in blocks:
    if typ == "h1":
        # 「英語 ── 日本語」を分割して2段表示にする
        if "──" in pay:
            en_part, jp_part = [p.strip() for p in pay.split("──", 1)]
            title = en_part  # <title>タグやナビバーには英語部のみ使用
            body.append(
                '<div class="series">THE FALL</div>'
                '<h1 class="title">'
                f'<span class="ttl-en">{inline(en_part)}</span>'
                f'<span class="ttl-jp">{inline(jp_part)}</span>'
                '</h1>'
            )
        else:
            title = pay
            body.append(
                '<div class="series">THE FALL</div>'
                f'<h1 class="title">{inline(pay)}</h1>'
            )
    elif typ == "h2":
        chap_i += 1
        cid = f"c{chap_i}"
        nav.append((cid, pay))
        # 章の境界で「リンク済み」リセット → 各章の初出に再び1回ずつ付く
        gloss_seen_in_chapter.clear()
        body.append(f'<h2 id="{cid}">{inline(pay)}</h2>')
    elif typ == "h3":
        body.append(f"<h3>{render_text(pay)}</h3>")
    elif typ == "p":
        body.append(f"<p>{render_text(pay)}</p>")
    elif typ == "hr":
        body.append('<hr class="scene">')
    elif typ == "quote":
        inner = "".join(f"<p>{render_text(x)}</p>" for x in pay)
        body.append(f'<blockquote>{inner}</blockquote>')
    elif typ == "ul":
        items = "".join(f"<li>{render_text(x)}</li>" for x in pay)
        body.append(f"<ul>{items}</ul>")
    elif typ == "img":
        alt, src = pay
        body.append(
            f'<figure class="ill"><img src="{html.escape(src)}" '
            f'alt="{html.escape(alt)}" loading="lazy"></figure>'
        )

nav_html = "".join(
    f'<a href="#{cid}">{html.escape(label)}</a>' for cid, label in nav
)

# 用語辞書 JSON（モーダル本文用）。f文字列の {{}} 衝突を避けるため事前に文字列化
gloss_json = json.dumps(gloss_data, ensure_ascii=False)

DOC = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} ── 長編小説版</title>
<link rel="stylesheet" href="reader.css">
<style>
  /* ───── saga (FALL-LINE) 固有 ───── */
  /* タイトル文字サイズ：FALL-LINE は 9 字 */
  .book .title .ttl-en {{ font-size:min(6vw, 40px); }}
  /* 巻末「次に読む（別冊）」カードのホバー＝月夜の purple ティント */
  .next-read .nr-card:hover {{ border-color:#a99fe0; }}
</style>
</head>
<body>
  <div class="bar" id="bar">
    <button id="barToggle" type="button" aria-label="メニュー" aria-expanded="false" title="メニュー">☰</button>
    <span class="nm">{html.escape(title)}</span>
    <nav>{nav_html}</nav>
    <a class="xlink" href="index.html" title="入口へ">⌂</a>
    <button id="bmBtn" title="しおり：押した位置を記憶／戻る">📑 しおり</button>
    <button id="fontDec" title="文字を小さく" aria-label="文字を小さく">A-</button>
    <button id="fontInc" title="文字を大きく" aria-label="文字を大きく">A+</button>
  </div>
  <div class="scroll" id="scroll">
    <div class="book">
      {''.join(body)}
      <aside class="next-read">
        <div class="nr-label">▷ 次に読む（別冊）</div>
        <a class="nr-card" href="blackhexa.html">
          <h3>FALL-LANDING ── フォールランディング</h3>
          <p>本編の前史にあたる外伝。月面に立つ六角柱の黒い鏡面体〈黒筐（こっきょう）〉に「触れる／触れない」を選ぶと、物語は二つに裂け、二度と交わらない。ルートAの〈退ける手つき〉が、本編のミラたちの背中に書き写されていく前史として接続する。</p>
        </a>
        <a class="nr-back" href="index.html">⌂ 入口へ戻る</a>
      </aside>
    </div>
  </div>
  <aside class="progress" aria-hidden="true">
    <div class="track"></div>
    <div class="ticks" id="ticks"></div>
    <div class="fill" id="fill"></div>
    <div class="pct" id="pct">0%</div>
  </aside>
  <a class="resume" id="resume" href="#">▷ 前回の続き <small class="pct">--%</small></a>
<script>
  var sc = document.getElementById('scroll');

  // ハンバーガー：モバイル時にバーを引き出しとして開閉
  var bar = document.getElementById('bar');
  var barToggle = document.getElementById('barToggle');
  function closeBar(){{ bar.classList.remove('open'); barToggle.setAttribute('aria-expanded','false'); }}
  barToggle.addEventListener('click', function(e){{
    e.stopPropagation();
    var open = bar.classList.toggle('open');
    barToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }});
  document.addEventListener('click', function(e){{
    if (!bar.contains(e.target)) closeBar();
  }});
  document.addEventListener('keydown', function(e){{
    if (e.key === 'Escape' && bar.classList.contains('open')) closeBar();
  }});

  // 章ナビ：通常の縦スクロールで見出しの先頭へ（モバイルではタップ後にドロワーを閉じる）
  document.querySelectorAll('.bar nav a').forEach(function(a){{
    a.addEventListener('click', function(e){{
      e.preventDefault();
      var t = document.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({{behavior:'smooth', block:'start'}});
      closeBar();
    }});
  }});

  // 文字サイズ +/-（記憶）。html に --fs を設定し .book の calc に効かせる
  var FSKEY = 'mira-fs', fs = 1;
  try {{ var _s = parseFloat(localStorage.getItem(FSKEY)); if (_s) fs = _s; }} catch(e) {{}}
  function applyFs(){{ document.documentElement.style.setProperty('--fs', fs); }}
  function setFs(v){{
    fs = Math.min(1.6, Math.max(0.8, Math.round(v * 10) / 10));
    applyFs();
    try {{ localStorage.setItem(FSKEY, String(fs)); }} catch(e) {{}}
  }}
  applyFs();
  document.getElementById('fontInc').addEventListener('click', function(){{ setFs(fs + 0.1); }});
  document.getElementById('fontDec').addEventListener('click', function(){{ setFs(fs - 0.1); }});

  // 進捗ゲージ：現在位置と章ごとの目盛
  var book = sc.querySelector('.book');
  var fill = document.getElementById('fill');
  var ticks = document.getElementById('ticks');
  var pct = document.getElementById('pct');
  function rebuildTicks(){{
    ticks.innerHTML = '';
    var hs = book.querySelectorAll('h2');
    var total = sc.scrollHeight;
    if (total <= 0) return;
    hs.forEach(function(h){{
      var i = document.createElement('i');
      i.style.top = (h.offsetTop / total * 100) + '%';
      ticks.appendChild(i);
    }});
  }}
  function updateProgress(){{
    var max = sc.scrollHeight - sc.clientHeight;
    if (max <= 0){{ fill.style.height = '0%'; pct.textContent = '0%'; return; }}
    var r = Math.min(1, Math.max(0, sc.scrollTop / max));
    fill.style.height = (r * 100) + '%';
    pct.textContent = Math.round(r * 100) + '%';
  }}
  sc.addEventListener('scroll', updateProgress, {{passive:true}});
  window.addEventListener('resize', function(){{ rebuildTicks(); updateProgress(); }});
  window.addEventListener('load', function(){{ rebuildTicks(); updateProgress(); }});
  rebuildTicks(); updateProgress();

  // しおり：localStorage に現在位置を自動保存し、起動時に復帰を提示
  var BMKEY = 'mira-bm-saga';
  function bmGet(){{
    try {{ return parseInt(localStorage.getItem(BMKEY)||'0', 10); }}
    catch(e) {{ return 0; }}
  }}
  function bmSet(v){{
    try {{ localStorage.setItem(BMKEY, String(v)); }} catch(e) {{}}
  }}
  var _bmReady = false;
  setTimeout(function(){{ _bmReady = true; }}, 1500);
  var _bmT = 0;
  sc.addEventListener('scroll', function(){{
    if (!_bmReady) return;
    clearTimeout(_bmT);
    _bmT = setTimeout(function(){{ bmSet(sc.scrollTop); }}, 500);
  }}, {{passive:true}});

  // しおり：押した瞬間の位置を保存（既に保存位置近くにいるなら、その保存位置へジャンプ）
  document.getElementById('bmBtn').addEventListener('click', function(){{
    var btn = this;
    var cur = sc.scrollTop;
    var saved = bmGet();
    if (saved > 0 && Math.abs(cur - saved) > 40) {{
      // 別の場所にいる → 保存済みの位置へ戻る
      sc.scrollTo({{top: saved, behavior:'smooth'}});
      var orig = btn.textContent;
      btn.textContent = '📑 戻る';
      setTimeout(function(){{ btn.textContent = orig; }}, 900);
    }} else {{
      // いまの位置を保存
      bmSet(cur);
      var orig2 = btn.textContent;
      btn.textContent = '📑 保存';
      setTimeout(function(){{ btn.textContent = orig2; }}, 900);
    }}
  }});

  function _maybeResume(){{
    var p = bmGet();
    var max = sc.scrollHeight - sc.clientHeight;
    if (max <= 0 || p < Math.max(80, max * 0.05)) return;
    var t = document.getElementById('resume');
    t.querySelector('.pct').textContent = Math.round(p / max * 100) + '%';
    t.classList.add('show');
    t.onclick = function(e){{
      e.preventDefault();
      sc.scrollTo({{top:p, behavior:'smooth'}});
      t.classList.remove('show');
    }};
    setTimeout(function(){{ t.classList.remove('show'); }}, 8000);
  }}
  window.addEventListener('load', _maybeResume);

  // 先頭（最上部＝冒頭）から開始
  sc.scrollTop = 0;
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
    if (data.image){{
      imgEl.src = data.image; imgEl.alt = data.title || key;
      imgEl.hidden = false;
    }} else {{
      imgEl.removeAttribute('src'); imgEl.hidden = true;
    }}
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }}
  function closeGloss(){{
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }}

  // 本文中の a.gloss クリックでモーダル開く
  document.addEventListener('click', function(e){{
    var a = e.target.closest && e.target.closest('a.gloss');
    if (a){{
      e.preventDefault();
      openGloss(a.dataset.gloss);
      return;
    }}
    if (e.target.closest && e.target.closest('[data-gloss-close]')){{
      e.preventDefault(); closeGloss();
    }}
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
print(f"wrote {OUT}  ({len(DOC):,} bytes, {len(nav)} chapters, {len(blocks)} blocks)")
