#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""物語-長編版.md を縦書き小説HTMLへ変換する。
単一ソース（.md）から生成するので、本文を直すときは .md を編集して再実行する。
  $ python3 build_html.py
"""
import re, html, pathlib

SRC = pathlib.Path(__file__).with_name("物語-長編版.md")
OUT = pathlib.Path(__file__).with_name("物語-長編版.html")

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
    t = re.sub(r"[0-9A-Za-z]+", tcy, t)
    return t

# ---- HTML 生成 ----
body, nav, title, chap_i = [], [], "水惑星ターラ", 0
for typ, pay in blocks:
    if typ == "h1":
        title = pay
        body.append(f'<h1 class="title">{inline(pay)}</h1>')
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
  :root {{
    --bg:#0d0f14; --bg2:#11141b; --ink:#e7e3d6; --dim:#8b93a3;
    --accent:#6fd0c8; --rule:#2a2f3a; --quote:#1a1e27;
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
  .bar button {{
    background:transparent; color:var(--dim); border:1px solid var(--rule);
    border-radius:6px; padding:5px 10px; cursor:pointer; font:inherit;
  }}
  .bar button:hover {{ color:var(--ink); border-color:var(--accent); }}

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
  .book .title {{
    font-size:30px; font-weight:700; letter-spacing:.12em;
    margin:.4em 0 1.6em; line-height:1.5; text-align:center;
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

  /* 縦書き用の縦中横ラッパは横書きでは無効化（素のテキスト表示） */
  .tcy, .upr {{ all:unset; }}

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
    <button id="themeBtn" title="配色切替">夜 / 紙</button>
  </div>
  <div class="scroll" id="scroll">
    <div class="book">
      {''.join(body)}
    </div>
  </div>
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

  // 先頭（最上部＝冒頭）から開始
  sc.scrollTop = 0;
</script>
</body>
</html>
"""

OUT.write_text(DOC, encoding="utf-8")
print(f"wrote {OUT}  ({len(DOC):,} bytes, {len(nav)} chapters, {len(blocks)} blocks)")
