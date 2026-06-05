#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""物語-長編版.md を縦書き小説HTMLへ変換する。
単一ソース（.md）から生成するので、本文を直すときは .md を編集して再実行する。
  $ python3 build_html.py
"""
import re, html, pathlib

SRC = pathlib.Path(__file__).with_name("saga.md")
OUT = pathlib.Path(__file__).with_name("saga.html")

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
        body.append(f'<h2 id="{cid}">{inline(pay)}</h2>')
    elif typ == "h3":
        body.append(f"<h3>{inline(pay)}</h3>")
    elif typ == "p":
        body.append(f"<p>{inline(pay)}</p>")
    elif typ == "hr":
        body.append('<hr class="scene">')
    elif typ == "quote":
        inner = "".join(f"<p>{inline(x)}</p>" for x in pay)
        body.append(f'<blockquote>{inner}</blockquote>')
    elif typ == "ul":
        items = "".join(f"<li>{inline(x)}</li>" for x in pay)
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

DOC = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} ── 長編小説版</title>
<style>
  /* ────────── Melete font family（THE FALL display 用） ────────── */
  @font-face {{font-family:"Melete";font-weight:200;font-style:normal;
    src:url("font/Melete-UltraLight.otf") format("opentype");
    font-display:swap}}
  @font-face {{font-family:"Melete";font-weight:300;font-style:normal;
    src:url("font/Melete-Light.otf") format("opentype");
    font-display:swap}}
  @font-face {{font-family:"Melete";font-weight:400;font-style:normal;
    src:url("font/Melete-Regular.otf") format("opentype");
    font-display:swap}}
  @font-face {{font-family:"Melete";font-weight:500;font-style:normal;
    src:url("font/Melete-Medium.otf") format("opentype");
    font-display:swap}}
  @font-face {{font-family:"Melete";font-weight:700;font-style:normal;
    src:url("font/Melete-Bold.otf") format("opentype");
    font-display:swap}}

  :root {{
    --bg:#0d0f14; --bg2:#11141b; --ink:#e7e3d6; --dim:#8b93a3;
    --accent:#E85A26; --rule:#2a2f3a; --quote:#1a1e27;
  }}
  html.paper {{
    --bg:#efe7d6; --bg2:#f5efe1; --ink:#2a2620; --dim:#7a7060;
    --accent:#9a5b3b; --rule:#d8cdb4; --quote:#e7dcc4;
  }}
  * {{ box-sizing:border-box; }}
  html,body {{ height:100%; margin:0; }}
  body {{
    background:var(--bg); color:var(--ink);
    font-family:"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",
                "Shippori Mincho",serif;
    -webkit-font-smoothing:antialiased;
  }}
  /* 上部バー（横書き） */
  .bar {{
    position:fixed; inset:0 0 auto 0; height:46px; z-index:10;
    display:flex; align-items:center; gap:14px; padding:0 16px;
    background:linear-gradient(180deg,var(--bg2),rgba(0,0,0,0));
    backdrop-filter:blur(6px); font-size:13px;
  }}
  .bar .nm {{ color:var(--accent); letter-spacing:.12em; font-weight:600; }}
  .bar nav {{
    display:flex; gap:10px; overflow-x:auto; white-space:nowrap;
    scrollbar-width:none; flex:1;
  }}
  .bar nav::-webkit-scrollbar {{ display:none; }}
  .bar nav a {{
    color:var(--dim); text-decoration:none; padding:4px 8px;
    border-radius:6px;
  }}
  .bar nav a:hover {{ color:var(--ink); background:var(--quote); }}
  .bar button, .bar a.xlink {{
    background:transparent; color:var(--dim); border:1px solid var(--rule);
    border-radius:6px; padding:5px 10px; cursor:pointer; font:inherit;
    text-decoration:none; white-space:nowrap;
  }}
  .bar button:hover, .bar a.xlink:hover {{
    color:var(--ink); border-color:var(--accent);
  }}

  /* 横書き本文（通常レイアウト・上から下へ読む） */
  .scroll {{
    position:fixed; inset:46px 0 0 0;
    overflow-y:auto; overflow-x:hidden;
    -webkit-overflow-scrolling:touch;
  }}
  .book {{
    max-width:42rem; margin:0 auto; padding:5vh 6vw 16vh;
    font-size:18px; line-height:1.95; letter-spacing:.02em;
    text-align:justify;
  }}
  @media (max-width:640px){{
    .book{{ font-size:16px; padding:4vh 7vw 14vh; }}
  }}
  .book .series {{
    color:var(--accent); font-size:12px; letter-spacing:.5em;
    text-align:center; margin:1.4em 0 .4em; text-indent:.5em;
    font-family:"Melete",system-ui,-apple-system,sans-serif;
    font-weight:500;
  }}
  .book .title {{
    margin:.2em 0 1.8em; text-align:center; line-height:1.2;
  }}
  .book .title .ttl-en {{
    display:block; font-size:44px; font-weight:700;
    letter-spacing:.16em; color:var(--ink);
    font-family:"Melete","Bahnschrift","Eurostile",
                "Helvetica Neue",system-ui,sans-serif;
  }}
  .book .title .ttl-jp {{
    display:block; font-size:17px; font-weight:400;
    letter-spacing:.36em; color:var(--dim);
    margin-top:1em; text-indent:.36em;
    font-family:"Hiragino Mincho ProN","Yu Mincho","YuMincho",
                "Noto Serif JP",serif;
  }}
  @media (max-width:640px){{
    .book .title .ttl-en {{ font-size:34px; letter-spacing:.12em; }}
    .book .title .ttl-jp {{ font-size:14px; letter-spacing:.28em; }}
  }}
  .book h2 {{
    font-size:22px; font-weight:700; letter-spacing:.05em;
    margin:2.8em 0 1.2em; padding:.15em 0 .15em .7em;
    color:var(--ink); border-left:3px solid var(--accent);
  }}
  .book h3 {{
    font-size:16px; font-weight:600; letter-spacing:.05em;
    margin:2.2em 0 1em; color:var(--dim);
  }}
  .book p {{ margin:0 0 1.05em; text-indent:0; }}
  .book hr.scene {{
    border:0; border-top:1px solid var(--rule);
    width:36%; margin:2.6em auto;
  }}
  .book blockquote {{
    margin:1.6em 0; padding:1em 1.1em; background:var(--quote);
    border-left:2px solid var(--accent);
    color:var(--dim); font-size:14px; line-height:1.9;
  }}
  .book blockquote p {{ margin:0 0 .5em; }}
  .book blockquote p:last-child {{ margin:0; }}
  .book ul {{ margin:1.2em 0; padding:0; list-style:none; }}
  .book li {{
    margin:0 0 .8em; padding-left:.85em;
    border-left:1px solid var(--rule);
    color:var(--ink); font-size:15px; line-height:1.85;
  }}
  .book strong {{ color:var(--accent); font-weight:700; }}
  .book em {{ font-style:normal; border-bottom:1px dotted var(--dim); }}
  .book figure.ill {{
    margin:2.4em -2vw; text-align:center;
  }}
  .book figure.ill img {{
    display:block; max-width:100%; height:auto; margin:0 auto;
    border-radius:6px;
    box-shadow:0 6px 32px rgba(0,0,0,.55),
               0 0 16px rgba(111,208,200,.08);
  }}
  html.paper .book figure.ill img {{
    box-shadow:0 4px 20px rgba(80,60,40,.25);
  }}

  /* 縦書き用の縦中横ラッパは横書きでは無効化（素のテキスト表示） */
  .tcy, .upr {{ all:unset; }}

  /* 本文末尾「次に読む」案内 */
  .next-read {{
    margin:4em auto 0; padding-top:2em; max-width:42rem;
    border-top:1px solid var(--rule);
  }}
  .next-read .nr-label {{
    color:var(--accent); font-size:12px; letter-spacing:.18em;
    text-align:center; margin-bottom:1em;
    font-family:system-ui,-apple-system,sans-serif;
  }}
  .next-read .nr-card {{
    display:block; text-decoration:none; color:inherit;
    border:1px solid var(--rule); border-radius:12px;
    padding:18px 20px; background:var(--bg2); transition:.18s;
  }}
  .next-read .nr-card:hover {{
    transform:translateY(-2px); border-color:#a99fe0;
  }}
  .next-read .nr-card h3 {{
    margin:0 0 .4em; font-size:18px; letter-spacing:.06em; color:var(--ink);
  }}
  .next-read .nr-card p {{
    margin:0; color:var(--dim); font-size:14px; line-height:1.85;
  }}
  .next-read .nr-back {{
    display:block; text-align:center; margin-top:1.4em;
    color:var(--dim); font-size:12px; letter-spacing:.12em;
    text-decoration:none;
    font-family:system-ui,-apple-system,sans-serif;
  }}
  .next-read .nr-back:hover {{ color:var(--accent); }}

  /* 右端の進捗ゲージ（目盛・現在位置・%） */
  .progress {{
    position:fixed; top:54px; right:6px; bottom:24px; width:14px;
    z-index:9; pointer-events:none;
    font-family:system-ui,-apple-system,sans-serif;
  }}
  .progress .track {{
    position:absolute; right:6px; top:0; bottom:0; width:1px;
    background:var(--rule);
  }}
  .progress .fill {{
    position:absolute; right:4px; top:0; width:3px;
    background:var(--accent); opacity:.6; border-radius:2px;
    height:0; transition:height .12s linear;
  }}
  .progress .ticks {{ position:absolute; inset:0; }}
  .progress .ticks i {{
    position:absolute; right:0; width:10px; height:1px;
    background:var(--dim); opacity:.5;
  }}
  .progress .pct {{
    position:fixed; right:6px; bottom:6px;
    color:var(--dim); font-size:10px; letter-spacing:.08em;
    font-family:system-ui,-apple-system,sans-serif;
  }}
  @media (max-width:640px) {{
    .progress {{ right:3px; width:12px; }}
    .progress .pct {{ right:4px; }}
  }}

  /* しおりトースト（前回の続き案内） */
  .resume {{
    position:fixed; right:24px; bottom:34px; z-index:18; display:none;
    background:var(--bg2); color:var(--ink);
    border:1px solid var(--accent); border-radius:8px;
    padding:8px 12px; cursor:pointer; text-decoration:none;
    font:13px/1.6 system-ui,-apple-system,sans-serif;
    letter-spacing:.06em; box-shadow:0 6px 18px rgba(0,0,0,.35);
  }}
  .resume.show {{ display:inline-block; }}
  .resume small {{ color:var(--dim); margin-left:.6em; font-size:11px; }}

  /* スクロールヒント */
  .hint {{
    position:fixed; left:14px; bottom:12px; z-index:10;
    color:var(--dim); font-size:12px; letter-spacing:.08em;
    font-family:system-ui,sans-serif; pointer-events:none; opacity:.7;
  }}
</style>
</head>
<body>
  <div class="bar">
    <span class="nm">{html.escape(title)}</span>
    <nav>{nav_html}</nav>
    <a class="xlink" href="blackhexa.html" title="別冊『FALL-LANDING』へ">▷ 別冊</a>
    <a class="xlink" href="index.html" title="入口へ">⌂</a>
    <button id="bmBtn" title="しおり：前回読んだ位置へ">📑 しおり</button>
    <button id="themeBtn" title="配色切替">夜 / 紙</button>
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
  <div class="hint">↓ 上から下へスクロールして読み進めます</div>
<script>
  var sc = document.getElementById('scroll');

  // 章ナビ：通常の縦スクロールで見出しの先頭へ
  document.querySelectorAll('.bar nav a').forEach(function(a){{
    a.addEventListener('click', function(e){{
      e.preventDefault();
      var t = document.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({{behavior:'smooth', block:'start'}});
    }});
  }});

  // 配色トグル（記憶）
  var btn = document.getElementById('themeBtn');
  try {{ if (localStorage.getItem('mira-paper')==='1')
        document.documentElement.classList.add('paper'); }} catch(e) {{}}
  btn.addEventListener('click', function(){{
    document.documentElement.classList.toggle('paper');
    try {{ localStorage.setItem('mira-paper',
      document.documentElement.classList.contains('paper') ? '1':'0'); }} catch(e) {{}}
  }});

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

  document.getElementById('bmBtn').addEventListener('click', function(){{
    var p = bmGet();
    if (p > 0) sc.scrollTo({{top:p, behavior:'smooth'}});
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
</body>
</html>
"""

OUT.write_text(DOC, encoding="utf-8")
print(f"wrote {OUT}  ({len(DOC):,} bytes, {len(nav)} chapters, {len(blocks)} blocks)")
