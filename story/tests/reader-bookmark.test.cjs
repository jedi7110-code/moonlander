const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../reader.js'), 'utf8');

function events(target = {}) {
  const listeners = new Map();
  target.addEventListener = (name, fn) => {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
  };
  target.emit = (name, event = {}) => (listeners.get(name) || []).forEach(fn => fn(event));
  return target;
}

function reader({jar = new Map(), legacy = {}, hash = '', protocol = 'https:', key = 'mira-bm-saga', layout = [[300,160,'first'],[500,600,'second'],[1200,500,'third']]} = {}) {
  let top = 0, now = 0, id = 0;
  const timers = new Map(), writes = [];
  const setTimeout = (fn, delay = 0) => { timers.set(++id, {fn, at: now + delay}); return id; };
  const clearTimeout = id => timers.delete(id);
  function tick(ms) {
    const end = now + ms;
    while (true) {
      const due = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = due[1].at; due[1].fn();
    }
    now = end;
  }
  const window = events({innerHeight:600, pageYOffset:0});
  const root = {scrollHeight:10000, scrollTop:0};
  window.scrollTo = ({top: next}) => { top = next; root.scrollTop = next; window.pageYOffset = next; window.emit('scroll'); };
  const blocks = layout.map(row => ({
    textContent:row[2], tagName:'P', querySelector:() => null,
    getBoundingClientRect:() => ({top:row[0]-top, bottom:row[0]+row[1]-top, height:row[1]})
  }));
  const document = events({
    currentScript:{src:'https://example.com/story/reader.js?v=3'},
    scrollingElement:root, documentElement:root, body:{}, readyState:'loading', hidden:false,
    fonts:{ready:Promise.resolve()},
    getElementById:id => id === 'bar' ? {getBoundingClientRect:() => ({bottom:46})} : null,
    querySelectorAll:selector => selector === '.book > *' ? blocks : []
  });
  Object.defineProperty(document, 'cookie', {
    get:() => [...jar].map(([k,v]) => k+'='+v).join('; '),
    set:value => { writes.push(value); const pair = value.split(';')[0], at = pair.indexOf('='); jar.set(pair.slice(0,at),pair.slice(at+1)); }
  });
  const context = {window,document,location:{hash,protocol},history:{scrollRestoration:'auto'},URL,
    localStorage:{getItem:k => legacy[k] ?? null},setTimeout,clearTimeout,requestAnimationFrame:fn => setTimeout(fn,16)};
  vm.runInNewContext(source, context);
  window.Reader.init({getScroll:() => window,bmKey:key});
  return {
    window,document,layout,jar,writes,tick,context,
    get top(){ return top; },
    bookmark:() => JSON.parse(decodeURIComponent(jar.get(key))),
    async load(){ document.readyState = 'complete'; window.emit('load'); await new Promise(resolve => setImmediate(resolve)); tick(20); },
    scroll(y){ window.emit('wheel'); window.scrollTo({top:y}); }
  };
}

test('a fast modal close saves the latest passage immediately to a persistent story cookie', async () => {
  const page = reader(); await page.load(); page.scroll(530);
  assert.equal(page.writes.length,0,'the debounce has not run');
  page.window.Reader.saveBookmark();
  assert.equal(page.bookmark().top,530);
  assert.match(page.writes.at(-1),/Max-Age=31536000; Path=\/story\/; SameSite=Lax; Secure$/);
  const next = reader({jar:page.jar}); await next.load();
  assert.equal(next.top,530,'including a bookmark near the beginning of a long book');
});

test('scrolling is saved on pagehide even before the debounce, without reading a detached frame layout', async () => {
  const page = reader({protocol:'http:'}); await page.load(); page.scroll(720);
  page.layout[1][0] = 0; page.layout[1][1] = 0;
  page.window.emit('pagehide');
  assert.equal(page.bookmark().top,720);
  assert.equal(page.bookmark().block,1);
  assert(!page.writes.at(-1).includes('Secure'));
});

test('the same paragraph is restored after reflow and late images, until the reader starts scrolling', async () => {
  const page = reader(); await page.load(); page.scroll(530); page.tick(400);
  const next = reader({jar:page.jar,layout:[[200,300,'first'],[550,800,'second'],[1400,600,'third']]});
  await next.load(); assert.equal(next.top,608);
  next.layout[1][0] += 180;
  next.document.emit('load',{target:{tagName:'IMG'}});
  assert.equal(next.top,788);
  next.scroll(950); next.layout[1][0] += 120;
  next.document.emit('load',{target:{tagName:'IMG'}});
  assert.equal(next.top,950,'late assets must not interrupt reading');
});

test('a bookmark in paragraph spacing returns to exactly the same position', async () => {
  const page = reader(); await page.load(); page.scroll(425); page.window.Reader.saveBookmark();
  const next = reader({jar:page.jar}); await next.load(); assert.equal(next.top,425);
});

test('legacy localStorage bookmarks migrate, and initial loading cannot replace them with zero', async () => {
  const page = reader({legacy:{'mira-bm-saga':'1200'}});
  page.window.scrollTo({top:0}); page.window.Reader.saveBookmark(); page.tick(800);
  assert.equal(page.bookmark().top,1200);
  await page.load(); assert.equal(page.top,1200);
  page.scroll(0); page.tick(400);
  const next = reader({jar:page.jar,legacy:{'mira-bm-saga':'1200'}}); await next.load();
  assert.equal(next.top,0,'a deliberate return to the beginning wins over the old bookmark');
});

test('chapter links and reading before load take precedence over automatic resume', async () => {
  const jar = new Map([['mira-bm-saga',encodeURIComponent(JSON.stringify({top:1500}))]]);
  const linked = reader({jar,hash:'#c3'}); linked.window.scrollTo({top:2500}); await linked.load();
  assert.equal(linked.top,2500);
  const early = reader({jar}); early.scroll(3100); await early.load();
  assert.equal(early.top,3100);
});

test('invalid cookies are ignored and separate reading pages keep their own bookmarks', async () => {
  const jar = new Map([['mira-bm-saga','%broken']]);
  const page = reader({jar}); await page.load(); assert.equal(page.top,0);
  page.scroll(530); page.window.Reader.saveBookmark();
  const chapter = reader({jar,key:'mira-bm-saga-chapter-01'}); await chapter.load();
  assert.equal(chapter.top,0); chapter.scroll(720); chapter.window.Reader.saveBookmark();
  const next = reader({jar}); await next.load(); assert.equal(next.top,530);
});

test('closing an idle older reader does not overwrite a newer tab bookmark', async () => {
  const older = reader(); await older.load(); older.scroll(530); older.tick(400);
  const newer = reader({jar:older.jar}); await newer.load(); newer.scroll(720); newer.tick(400);
  older.window.Reader.saveBookmark(); older.window.emit('pagehide');
  assert.equal(newer.bookmark().top,720);
});
