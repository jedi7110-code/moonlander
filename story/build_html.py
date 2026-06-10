#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""saga.md を小説HTMLへ変換する。
単一ソース（.md）から全文版と章別版を生成するので、本文を直すときは .md を編集して再実行する。
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
CHAPTER_DIR = pathlib.Path(__file__).with_name("fall-line")
PUBLIC_CHAPTER_PREFIXES = ("残響", "プロローグ", "第一章")

def is_absolute_url(src: str) -> bool:
    return bool(re.match(r"^(?:[a-z]+:)?//|^/|^data:", src))

def prefixed_path(src: str, prefix: str) -> str:
    if not prefix or is_absolute_url(src) or src.startswith("../"):
        return src
    return prefix + src

def title_html(pay: str):
    if "──" in pay:
        en_part, jp_part = [p.strip() for p in pay.split("──", 1)]
        return en_part, (
            '<div class="series">THE FALL</div>'
            '<h1 class="title">'
            f'<span class="ttl-en">{inline(en_part)}</span>'
            f'<span class="ttl-jp">{inline(jp_part)}</span>'
            '</h1>'
        )
    return pay, '<div class="series">THE FALL</div>' f'<h1 class="title">{inline(pay)}</h1>'

def render_block(typ, pay, asset_prefix="", cid=None):
    if typ == "h1":
        return title_html(pay)[1]
    if typ == "h2":
        id_attr = f' id="{cid}"' if cid else ""
        return f"<h2{id_attr}>{inline(pay)}</h2>"
    if typ == "h3":
        return f"<h3>{render_text(pay)}</h3>"
    if typ == "p":
        return f"<p>{render_text(pay)}</p>"
    if typ == "hr":
        return '<hr class="scene">'
    if typ == "quote":
        inner = "".join(f"<p>{render_text(x)}</p>" for x in pay)
        return f"<blockquote>{inner}</blockquote>"
    if typ == "ul":
        items = "".join(f"<li>{render_text(x)}</li>" for x in pay)
        return f"<ul>{items}</ul>"
    if typ == "img":
        alt, src = pay
        src = prefixed_path(src, asset_prefix)
        return (
            f'<figure class="ill"><img src="{html.escape(src)}" '
            f'alt="{html.escape(alt)}" loading="lazy"></figure>'
        )
    return ""

def slug_for(idx: int, label: str) -> str:
    if label.startswith("残響"):
        return "resonance.html"
    if label.startswith("プロローグ"):
        return "prologue.html"
    if label.startswith("第一章"):
        return "chapter-01.html"
    if label.startswith("第二章"):
        return "chapter-02.html"
    if label.startswith("第三章"):
        return "chapter-03.html"
    if label.startswith("第四章"):
        return "chapter-04.html"
    if label.startswith("第五章"):
        return "chapter-05.html"
    if label.startswith("第六章"):
        return "chapter-06.html"
    if label.startswith("エピローグ"):
        return "epilogue.html"
    if label.startswith("外伝"):
        return "appendix-fall-landing.html"
    if label.startswith("主要登場人物"):
        return "characters.html"
    if label.startswith("主題とモチーフ"):
        return "motifs.html"
    return f"section-{idx:02d}.html"

title = "FALL-LINE"
title_block = None
front_blocks = []
chapters = []
current = None

for typ, pay in blocks:
    if typ == "h1":
        title, title_block = title_html(pay)
        continue
    if typ == "h2":
        idx = len(chapters) + 1
        current = {
            "idx": idx,
            "cid": f"c{idx}",
            "label": pay,
            "file": slug_for(idx, pay),
            "blocks": [(typ, pay)],
        }
        chapters.append(current)
        continue
    if current is None:
        front_blocks.append((typ, pay))
    else:
        current["blocks"].append((typ, pay))

def render_blocks_for_page(page_blocks, asset_prefix="", include_ids=False):
    global gloss_seen_in_chapter
    gloss_seen_in_chapter.clear()
    out = []
    for typ, pay in page_blocks:
        if typ == "h2":
            gloss_seen_in_chapter.clear()
            cid = None
            if include_ids:
                for ch in chapters:
                    if ch["label"] == pay:
                        cid = ch["cid"]
                        break
            out.append(render_block(typ, pay, asset_prefix=asset_prefix, cid=cid))
        else:
            out.append(render_block(typ, pay, asset_prefix=asset_prefix))
    return "".join(out)

def without_trailing_scene(page_blocks):
    page_blocks = page_blocks[:]
    while page_blocks and page_blocks[-1][0] == "hr":
        page_blocks.pop()
    return page_blocks

def build_reading_pages():
    pages = []
    for ch in chapters:
        pages.append({
            "label": ch["label"],
            "file": ch["file"],
            "blocks": without_trailing_scene(ch["blocks"]),
        })
    return pages

reading_pages = build_reading_pages()

def is_public_chapter(ch):
    return ch["label"].startswith(PUBLIC_CHAPTER_PREFIXES)

def full_nav_items():
    items = []
    for ch in chapters:
        items.append({"href": f"#{ch['cid']}", "label": ch["label"]})
    return items

def chapter_nav_html(root_prefix="", full=False):
    links = []
    items = full_nav_items() if full else reading_pages
    for ch in items:
        href = ch["href"] if full else ch["file"]
        if full or is_public_chapter(ch):
            links.append(f'<a href="{html.escape(href)}">{html.escape(ch["label"])}</a>')
        else:
            links.append(
                f'<span class="locked" aria-disabled="true">{html.escape(ch["label"])}</span>'
            )
    return "".join(links)

def render_full_chapter(ch):
    return render_blocks_for_page(ch["blocks"], include_ids=True)

def glossary_json_for(prefix=""):
    if not prefix:
        return json.dumps(gloss_data, ensure_ascii=False)
    data = json.loads(json.dumps(gloss_data, ensure_ascii=False))
    for item in data.values():
        image = item.get("image")
        if image:
            item["image"] = prefixed_path(image, prefix)
    return json.dumps(data, ensure_ascii=False)

def progress_script(bm_key, scroll_nav=False):
    nav_script = ""
    if scroll_nav:
        nav_script = """
  // 章ナビ：見出しの先頭へ（ハンバーガー側で delegation により自動で閉じる）
  document.querySelectorAll('.bar nav a').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      var t = document.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
"""
    return f"""<script>
  var sc = document.getElementById('scroll');

  Reader.init({{
    getScroll: function(){{ return sc; }},
    bmKey: '{bm_key}'
  }});
{nav_script}
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
  sc.scrollTop = 0;
</script>"""

def gloss_modal(prefix=""):
    gloss_json = glossary_json_for(prefix)
    return f"""
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
</script>"""

def next_read_html(root_prefix=""):
    return f"""
      <aside class="next-read">
        <div class="nr-label">▷ 次に読む（別冊）</div>
        <a class="nr-card" href="{root_prefix}blackhexa.html">
          <h3>FALL-LANDING ── フォールランディング</h3>
          <p>本編の前史にあたる外伝。月面に立つ六角柱の黒い鏡面体〈黒筐（こっきょう）〉に「触れる／触れない」を選ぶと、物語は二つに裂け、二度と交わらない。ルートAの〈退ける手つき〉が、本編のミラたちの背中に書き写されていく前史として接続する。</p>
        </a>
        <a class="nr-back" href="{root_prefix}index.html">⌂ 入口へ戻る</a>
      </aside>"""

def page_doc(page_title, nav_html, body_html, root_prefix="", bm_key="mira-bm-saga", scroll_nav=False, reader=True):
    if reader:
        progress_aside = """<aside class="progress" aria-hidden="true">
    <div class="track"></div>
    <div class="ticks" id="ticks"></div>
    <div class="fill" id="fill"></div>
    <div class="pct" id="pct">0%</div>
  </aside>
  <a class="resume" id="resume" href="#">▷ 前回の続き <small class="pct">--%</small></a>"""
        page_script = progress_script(bm_key, scroll_nav=scroll_nav)
    else:
        # 目次ページ: スクロールメモリ・進捗レール・resumeトーストなし
        progress_aside = ""
        page_script = "<script>\n  Reader.init({});\n</script>"
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(page_title)}</title>
<link rel="stylesheet" href="{root_prefix}reader.css">
<style>
  /* ───── saga (FALL-LINE) 固有 ───── */
  .book .title .ttl-en {{ font-size:min(6vw, 40px); }}
  .next-read .nr-card:hover {{ border-color:#a99fe0; }}
  .chapter-links {{
    display:grid; gap:12px; margin:2.5em 0 3em;
  }}
  .chapter-links a {{
    display:block; color:inherit; text-decoration:none;
    border:1px solid var(--rule); border-radius:8px;
    padding:14px 16px; background:var(--bg2); transition:.18s;
  }}
  .chapter-links .locked {{
    display:block; color:var(--dim); opacity:.45;
    border:1px solid var(--rule); border-radius:8px;
    padding:14px 16px; background:var(--bg2);
  }}
  .chapter-links a:hover {{ border-color:var(--accent); transform:translateY(-1px); }}
  .chapter-pager {{
    display:flex; justify-content:space-between; gap:14px;
    margin:3em 0 0; padding-top:1.6em; border-top:1px solid var(--rule);
  }}
  .chapter-pager a {{
    color:var(--dim); text-decoration:none; border:1px solid var(--rule);
    border-radius:8px; padding:8px 12px; font-size:13px;
  }}
  .chapter-pager a:hover {{ color:var(--ink); border-color:var(--accent); }}
  .bar nav .locked {{ opacity:.38; cursor:default; }}
  .release-note {{
    text-align:center; color:var(--dim);
    font-family:system-ui,-apple-system,sans-serif;
  }}
  .release-note h3 {{
    margin:0 0 .45em; color:var(--ink); font-size:18px;
  }}
  .release-note p {{ margin:0; font-size:14px; line-height:1.85; }}
</style>
</head>
<body>
  <div class="bar" id="bar">
    <button id="barToggle" type="button" aria-label="メニュー" aria-expanded="false" title="メニュー">☰</button>
    <span class="nm">{html.escape(title)}</span>
    <nav>{nav_html}</nav>
    <a class="xlink" href="{root_prefix}index.html" title="入口へ">⌂</a>
    <button id="fontDec" title="文字を小さく" aria-label="文字を小さく">A-</button>
    <button id="fontInc" title="文字を大きく" aria-label="文字を大きく">A+</button>
  </div>
  <div class="scroll" id="scroll">
    <div class="book">
      {body_html}
    </div>
  </div>
  {progress_aside}
<script src="{root_prefix}reader.js"></script>
{page_script}
{gloss_modal(root_prefix)}
</body>
</html>
"""

full_body = []
if title_block:
    full_body.append(title_block)
full_body.append(render_blocks_for_page(front_blocks, include_ids=False))
for ch in chapters:
    full_body.append(render_full_chapter(ch))
full_body.append(next_read_html(""))

DOC = page_doc(
    f"{title} ── 長編小説版",
    chapter_nav_html(full=True),
    "".join(full_body),
    root_prefix="",
    bm_key="mira-bm-saga",
    scroll_nav=True,
)

OUT.write_text(DOC, encoding="utf-8")

CHAPTER_DIR.mkdir(exist_ok=True)
for stale_name in ("chapter-01-2.html", "chapter-01-3.html"):
    stale_path = CHAPTER_DIR / stale_name
    if stale_path.exists():
        stale_path.unlink()

index_links = "".join(
    (
        f'<a href="{html.escape(ch["file"])}">{html.escape(ch["label"])}</a>'
        if is_public_chapter(ch)
        else f'<span class="locked" aria-disabled="true">{html.escape(ch["label"])}</span>'
    )
    for ch in reading_pages
)
chapter_index_body = (
    (title_block or "")
    + render_blocks_for_page(front_blocks, asset_prefix="../", include_ids=False)
    + '<h2>章別ページ</h2>'
    + f'<div class="chapter-links">{index_links}</div>'
    + '<aside class="next-read">'
    + '<div class="nr-label">公開範囲</div>'
    + '<div class="release-note">'
    + '<h3>第一章まで公開中</h3>'
    + '<p>第二章以降は改稿中です。</p>'
    + '</div>'
    + '<a class="nr-back" href="../index.html">⌂ 入口へ戻る</a>'
    + '</aside>'
)
chapter_index_doc = page_doc(
    f"{title} ── 章別ページ",
    chapter_nav_html(full=False),
    chapter_index_body,
    root_prefix="../",
    bm_key="mira-bm-saga-index",
    scroll_nav=False,
    reader=False,
)
(CHAPTER_DIR / "index.html").write_text(chapter_index_doc, encoding="utf-8")

for i, ch in enumerate(reading_pages):
    prev_ch = reading_pages[i - 1] if i > 0 else None
    next_ch = reading_pages[i + 1] if i + 1 < len(reading_pages) else None
    pager = ['<nav class="chapter-pager" aria-label="章送り">']
    if prev_ch:
        pager.append(f'<a href="{html.escape(prev_ch["file"])}">← {html.escape(prev_ch["label"])}</a>')
    else:
        pager.append('<span></span>')
    if next_ch:
        if is_public_chapter(next_ch):
            pager.append(f'<a href="{html.escape(next_ch["file"])}">{html.escape(next_ch["label"])} →</a>')
        else:
            pager.append('<span></span>')
    else:
        pager.append('<span></span>')
    pager.append('</nav>')

    chapter_body = []
    if title_block:
        chapter_body.append(title_block)
    if i == 0:
        chapter_body.append(render_blocks_for_page(front_blocks, asset_prefix="../", include_ids=False))
    chapter_body.append(render_blocks_for_page(ch["blocks"], asset_prefix="../", include_ids=False))
    chapter_body.append("".join(pager))
    if i == len(reading_pages) - 1:
        chapter_body.append(next_read_html("../"))

    doc = page_doc(
        f"{title} ── {ch['label']}",
        chapter_nav_html(full=False),
        "".join(chapter_body),
        root_prefix="../",
        bm_key=f"mira-bm-saga-{ch['file'].replace('.html', '')}",
        scroll_nav=False,
    )
    (CHAPTER_DIR / ch["file"]).write_text(doc, encoding="utf-8")

print(
    f"wrote {OUT}  ({len(DOC):,} bytes, {len(chapters)} chapters, {len(blocks)} blocks)"
)
print(f"wrote {CHAPTER_DIR}/index.html and {len(reading_pages)} chapter pages")
