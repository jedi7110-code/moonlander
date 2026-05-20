#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""月面のモノリス-分岐譚.md を「選択できる縦書きHTML」へ変換する。

マーカー:
  @@CHOICE            … ここに分岐選択画面を置く（直前までが共通の序章）
  @@ROUTE A｜ラベル    … ルートA本文の開始
  @@ROUTE B｜ラベル    … ルートB本文の開始
  @@END               … ルート本文の終わり（以降は共通のあとがき＝ネタバレ）

本文を直すときは .md を編集して再実行する:
  $ python3 build_branch.py
"""
import re, html, pathlib

SRC = pathlib.Path(__file__).with_name("monolith.md")
OUT = pathlib.Path(__file__).with_name("monolith.html")
raw_lines = SRC.read_text(encoding="utf-8").splitlines()


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

title = "月面のモノリス"
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

    return re.sub(r"[0-9A-Za-z]+", tcy, t)


def render(blocks, hids=None):
    """blocks -> html。hids には (id,label) の見出し一覧を集める。"""
    out = []
    for typ, pay in blocks:
        if typ == "h1":
            out.append(f'<h1 class="title">{inline(pay)}</h1>')
        elif typ == "h2":
            hid = f"h{len(hids)}" if hids is not None else ""
            if hids is not None:
                hids.append((hid, pay))
            out.append(f'<h2 id="{hid}">{inline(pay)}</h2>')
        elif typ == "h3":
            out.append(f"<h3>{inline(pay)}</h3>")
        elif typ == "p":
            out.append(f"<p>{inline(pay)}</p>")
        elif typ == "hr":
            out.append('<hr class="scene">')
        elif typ == "quote":
            inner = "".join(f"<p>{inline(x)}</p>" for x in pay)
            out.append(f"<blockquote>{inner}</blockquote>")
        elif typ == "ul":
            items = "".join(f"<li>{inline(x)}</li>" for x in pay)
            out.append(f"<ul>{items}</ul>")
    return "".join(out)


hidsA, hidsB = [], []
head_html = render(head_blocks)
A_html = render(A_blocks, hidsA)
B_html = render(B_blocks, hidsB)
post_html = render(post_blocks)


def navlist(hids, route):
    return "".join(
        f'<a data-go="{route}:{hid}">{html.escape(lbl)}</a>' for hid, lbl in hids
    )


navA, navB = navlist(hidsA, "A"), navlist(hidsB, "B")

DOC = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} ── 分岐譚</title>
<style>
  :root {{
    --bg:#0d0f14; --bg2:#11141b; --ink:#e7e3d6; --dim:#8b93a3;
    --accent:#6fd0c8; --warn:#d8736b; --rule:#2a2f3a; --quote:#1a1e27;
  }}
  html.paper {{
    --bg:#efe7d6; --bg2:#f5efe1; --ink:#2a2620; --dim:#7a7060;
    --accent:#9a5b3b; --warn:#a23b2f; --rule:#d8cdb4; --quote:#e7dcc4;
  }}
  *{{box-sizing:border-box}} html,body{{height:100%;margin:0}}
  body{{
    background:var(--bg);color:var(--ink);
    font-family:"Hiragino Mincho ProN","Yu Mincho","YuMincho",
                "Noto Serif JP","Shippori Mincho",serif;
    -webkit-font-smoothing:antialiased;
  }}
  .bar{{
    position:fixed;inset:0 0 auto 0;height:46px;z-index:20;display:flex;
    align-items:center;gap:12px;padding:0 14px;font-size:13px;
    background:linear-gradient(180deg,var(--bg2),rgba(0,0,0,0));
    backdrop-filter:blur(6px);
  }}
  .bar .nm{{color:var(--accent);letter-spacing:.12em;font-weight:600;
           white-space:nowrap}}
  .bar .rt{{color:var(--dim);white-space:nowrap}}
  .bar nav{{display:flex;gap:8px;overflow-x:auto;flex:1;
           scrollbar-width:none;white-space:nowrap}}
  .bar nav::-webkit-scrollbar{{display:none}}
  .bar nav a{{color:var(--dim);cursor:pointer;padding:4px 7px;
             border-radius:6px;text-decoration:none}}
  .bar nav a:hover{{color:var(--ink);background:var(--quote)}}
  .bar button, .bar a.xlink{{background:transparent;color:var(--dim);
    border:1px solid var(--rule);border-radius:6px;padding:5px 9px;
    cursor:pointer;font:inherit;white-space:nowrap;text-decoration:none}}
  .bar button:hover, .bar a.xlink:hover{{color:var(--ink);
    border-color:var(--accent)}}
  .bar button.hide{{display:none}}

  .scroll{{position:fixed;inset:46px 0 0 0;overflow-y:auto;
    overflow-x:hidden;-webkit-overflow-scrolling:touch;display:none}}
  .scroll.on{{display:block}}
  .book{{
    max-width:42rem;margin:0 auto;padding:5vh 6vw 16vh;
    font-size:18px;line-height:1.95;letter-spacing:.02em;
    text-align:justify;
  }}
  @media (max-width:640px){{.book{{font-size:16px;padding:4vh 7vw 14vh}}}}
  .book .title{{font-size:30px;font-weight:700;letter-spacing:.12em;
    margin:.4em 0 1.6em;line-height:1.5;text-align:center}}
  .book h2{{font-size:22px;font-weight:700;letter-spacing:.05em;
    margin:2.8em 0 1.2em;padding:.15em 0 .15em .7em;color:var(--ink);
    border-left:3px solid var(--accent)}}
  .book h3{{font-size:16px;font-weight:600;letter-spacing:.05em;
    margin:2.2em 0 1em;color:var(--dim)}}
  .book p{{margin:0 0 1.05em}}
  .book hr.scene{{border:0;border-top:1px solid var(--rule);
    width:36%;margin:2.6em auto}}
  .book blockquote{{margin:1.6em 0;padding:1em 1.1em;
    background:var(--quote);border-left:2px solid var(--accent);
    color:var(--dim);font-size:14px;line-height:1.9}}
  .book blockquote p{{margin:0 0 .5em}}
  .book blockquote p:last-child{{margin:0}}
  .book ul{{margin:1.2em 0;padding:0;list-style:none}}
  .book li{{margin:0 0 .8em;padding-left:.85em;
    border-left:1px solid var(--rule);
    font-size:15px;line-height:1.85}}
  .book strong{{color:var(--accent);font-weight:700}}
  .book em{{font-style:normal;border-bottom:1px dotted var(--dim)}}
  .tcy,.upr{{all:unset}}

  /* 分岐選択（序章末尾に本文と一体で配置・固定しない） */
  #choice{{display:flex;flex-direction:column;align-items:center;
    gap:24px;margin:3.5em 0 1em;padding:2.4em 1em 1em;
    border-top:1px solid var(--rule)}}
  #choice .mono{{width:44px;height:120px;background:#04060a;
    border:1px solid var(--rule);
    box-shadow:0 0 36px rgba(111,208,200,.16);}}
  #choice .ask{{color:var(--ink);font-size:18px;letter-spacing:.12em;
    text-align:center;line-height:2}}
  #choice .ask small{{display:block;color:var(--dim);font-size:13px;
    letter-spacing:.08em;margin-top:8px}}
  #choice .opts{{display:flex;gap:20px;flex-wrap:wrap;
    justify-content:center}}
  .card{{width:260px;border:1px solid var(--rule);background:var(--bg2);
    border-radius:12px;padding:22px;cursor:pointer;text-align:center;
    transition:.18s;}}
  .card:hover{{transform:translateY(-3px);border-color:var(--accent)}}
  .card.b:hover{{border-color:var(--warn)}}
  .card h3{{margin:0 0 8px;font-size:19px;letter-spacing:.14em;
    color:var(--accent)}}
  .card.b h3{{color:var(--warn)}}
  .card p{{margin:0;color:var(--dim);font-size:13px;line-height:1.9}}
  .hint{{position:fixed;left:14px;bottom:12px;z-index:15;
    color:var(--dim);font-size:12px;letter-spacing:.08em;
    font-family:system-ui,sans-serif;opacity:.7;pointer-events:none}}
  .spoiler{{margin:0 1.1em}}
  .spoiler>button{{writing-mode:horizontal-tb;background:var(--quote);
    color:var(--dim);border:1px solid var(--rule);border-radius:8px;
    padding:8px 14px;cursor:pointer;font:inherit}}
  .spoiler.open .sp-body{{display:block}}
  .spoiler .sp-body{{display:none}}

  /* 本編／別冊 往来案内 */
  .next-read{{margin:3.5em auto 0;padding-top:2em;max-width:42rem;
    border-top:1px solid var(--rule)}}
  .next-read .nr-label{{color:var(--accent);font-size:12px;
    letter-spacing:.18em;text-align:center;margin-bottom:1em;
    font-family:system-ui,-apple-system,sans-serif}}
  .next-read .nr-card{{display:block;text-decoration:none;color:inherit;
    border:1px solid var(--rule);border-radius:12px;padding:18px 20px;
    background:var(--bg2);transition:.18s}}
  .next-read .nr-card:hover{{transform:translateY(-2px);
    border-color:var(--accent)}}
  .next-read.dead .nr-card:hover{{border-color:var(--warn)}}
  .next-read .nr-card h3{{margin:0 0 .4em;font-size:18px;
    letter-spacing:.06em;color:var(--ink)}}
  .next-read .nr-card p{{margin:0;color:var(--dim);font-size:14px;
    line-height:1.85}}
  .next-read .nr-back{{display:block;text-align:center;margin-top:1.4em;
    color:var(--dim);font-size:12px;letter-spacing:.12em;
    text-decoration:none;
    font-family:system-ui,-apple-system,sans-serif}}
  .next-read .nr-back:hover{{color:var(--accent)}}

  /* 右端の進捗ゲージ（現在表示中のペインのみ反映） */
  .progress{{position:fixed;top:54px;right:6px;bottom:24px;width:14px;
    z-index:9;pointer-events:none;
    font-family:system-ui,-apple-system,sans-serif}}
  .progress .track{{position:absolute;right:6px;top:0;bottom:0;width:1px;
    background:var(--rule)}}
  .progress .fill{{position:absolute;right:4px;top:0;width:3px;
    background:var(--accent);opacity:.6;border-radius:2px;
    height:0;transition:height .12s linear}}
  .progress .ticks{{position:absolute;inset:0}}
  .progress .ticks i{{position:absolute;right:0;width:10px;height:1px;
    background:var(--dim);opacity:.5}}
  .progress .pct{{position:fixed;right:6px;bottom:6px;color:var(--dim);
    font-size:10px;letter-spacing:.08em;
    font-family:system-ui,-apple-system,sans-serif}}
  @media (max-width:640px){{
    .progress{{right:3px;width:12px}}
    .progress .pct{{right:4px}}
  }}
</style>
</head>
<body>
  <div class="bar">
    <span class="nm">{html.escape(title)}</span>
    <span class="rt" id="rt">分岐譚</span>
    <nav id="nav"></nav>
    <button id="rebtn" class="hide">分岐をやり直す</button>
    <button id="othbtn" class="hide">もう一方を読む</button>
    <a class="xlink" href="saga.html" title="本編『水惑星ターラ』へ">▷ 本編</a>
    <a class="xlink" href="index.html" title="入口へ">⌂</a>
    <button id="thbtn">夜 / 紙</button>
  </div>

  <!-- 共通：序章 ＋ 末尾に分岐選択（本文と一体・上下自由スクロール） -->
  <div class="scroll on" id="sc-head">
    <div class="book">
      {head_html}
      <div id="choice">
        <div class="mono"></div>
        <div class="ask">触れるか。触れないか。<small>選んだ先で、物語は二度と交わらない</small></div>
        <div class="opts">
          <div class="card a" data-pick="A">
            <h3>触れる</h3>
            <p>黒い面に、手をつく。<br>― ルートA「{html.escape(labelA)}」へ</p>
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
          <h3>水惑星ターラ ── 電脳の継承（本編）</h3>
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
  <div class="hint">↓ 上から下へスクロールして読み進めます</div>

<script>
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

  // 状態は 'head'（序章＋末尾に選択）/ 'A' / 'B' の三つ。
  // 序章は固定せず、上下に自由スクロールできる。
  function gotoState(st, keepPos){{
    if (st==='head'){{
      showScroll('sc-head');
      rt.textContent='序章';
      nav.innerHTML='';
      reb.classList.add('hide'); oth.classList.add('hide');
      if (!keepPos) toTop(document.getElementById('sc-head'));
    }} else {{ // 'A' or 'B'
      showScroll(panes[st]);
      rt.textContent = (st==='A'?'ルートA 触れた者':'ルートB 触れなかった者');
      nav.innerHTML = (st==='A'?NAVA:NAVB);
      reb.classList.remove('hide'); oth.classList.remove('hide');
      toTop(document.getElementById(panes[st]));
      try{{localStorage.setItem('mono-route',st);}}catch(e){{}}
    }}
    try{{localStorage.setItem('mono-state',st);}}catch(e){{}}
  }}

  // 触れる／触れない＝明示クリックでのみルートへ。自動遷移はしない。
  document.querySelectorAll('.card').forEach(function(c){{
    c.addEventListener('click', function(){{ gotoState(c.dataset.pick); }});
  }});
  // 「分岐をやり直す」＝序章へ戻り、末尾の選択まで滑らかに移動
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

  // 章ナビ：通常の縦スクロールで見出しの先頭へ
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

  // 配色トグル（記憶）
  var th=document.getElementById('thbtn');
  try{{ if(localStorage.getItem('mira-paper')==='1')
        document.documentElement.classList.add('paper'); }}catch(e){{}}
  th.addEventListener('click', function(){{
    document.documentElement.classList.toggle('paper');
    try{{localStorage.setItem('mira-paper',
      document.documentElement.classList.contains('paper')?'1':'0');}}catch(e){{}}
  }});

  // 進捗ゲージ：表示中のペインを監視し、見出し位置に目盛
  var pgFill = document.getElementById('fill');
  var pgTicks = document.getElementById('ticks');
  var pgPct = document.getElementById('pct');
  function activeScroll(){{ return document.querySelector('.scroll.on'); }}
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
  window.addEventListener('resize', function(){{
    rebuildTicks(); updateProgress();
  }});

  // ペイン切替時に再計算する gotoState のラッパ
  var _goto = gotoState;
  gotoState = function(st, keepPos){{
    _goto(st, keepPos);
    requestAnimationFrame(function(){{
      requestAnimationFrame(function(){{
        rebuildTicks(); updateProgress();
      }});
    }});
  }};

  // 最初は序章から（毎回選び直せる）
  window.addEventListener('load', function(){{
    gotoState('head');
    requestAnimationFrame(function(){{
      requestAnimationFrame(function(){{
        rebuildTicks(); updateProgress();
      }});
    }});
  }});
  gotoState('head');
</script>
</body>
</html>
"""

OUT.write_text(DOC, encoding="utf-8")
print(f"wrote {OUT}")
print(f"  routeA headings={len(hidsA)}  routeB headings={len(hidsB)}  "
      f"size={len(DOC):,} chars")
