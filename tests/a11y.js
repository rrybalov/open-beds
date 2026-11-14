// WCAG 2.2 AA audit for Open Beds: automated checks run in every page state, plus keyboard,
// focus, dialog, reflow and text-spacing passes. Usage: python3 -m http.server 8765 & node tests/a11y.js [stub-dir] [json-out]
const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2] || __dirname; // folder holding leaflet-stub.js
const BASE = 'http://localhost:8765/';

// ---------------- in-page checks ----------------
function pageChecks() {
  const out = [];
  const add = (crit, sev, msg, el) => out.push({ crit, sev, msg, where: el ? describe(el) : '' });
  function describe(el) {
    if (!el || !el.tagName) return '';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (c.length) s += '.' + c.join('.');
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return s + (t ? ' “' + t + '”' : '');
  }
  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      if (e.hidden) return false;
      if (e.tagName === 'DETAILS' && !e.open && !el.closest('summary')) return false;
    }
    return true;
  }
  function parse(c) { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; }
  function lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function blend(fg, bg) { const a = fg.a; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }; }
  function bgOf(el) {
    const layers = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/svg/.test(cs.backgroundImage)) return null; // image/gradient: manual
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg);
    return bg;
  }
  const inMap = (el) => !!el.closest('.map, .leaflet-container');

  // 1.4.3 text contrast
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || !visible(el) || inMap(el)) continue;
    if (el.closest('.sr, .sr-only, script, style, option, noscript')) continue;
    if (el.closest('[disabled], [aria-disabled="true"]')) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const fg = parse(cs.color), bg = bgOf(el);
    if (!fg || !bg) continue;
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const r = ratio(blend(fg, bg), bg), need = large ? 3 : 4.5;
    if (r < need - 0.01) add('1.4.3 Contrast (Minimum)', 'Critical', 'Text contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1), ' + cs.color + ' on rgb(' + [bg.r, bg.g, bg.b].map(Math.round) + ') at ' + size + 'px', el);
  }
  // Placeholder contrast
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
    if (!visible(el) || !el.placeholder || el.value) return;
    const fg = parse(getComputedStyle(el, '::placeholder').color), bg = bgOf(el);
    if (fg && bg) { const r = ratio(blend(fg, bg), bg); if (r < 4.49) add('1.4.3 Contrast (Minimum)', 'Major', 'Placeholder text contrast ' + r.toFixed(2) + ':1', el); }
  });

  // 1.4.11 non-text contrast: control boundaries (inputs, selects, outline buttons, checkboxes are UA)
  document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea, .btn:not(.primary), .cbtn:not(.primary), .selbtn').forEach((el) => {
    if (!visible(el) || inMap(el) || el.disabled) return;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.borderTopWidth) === 0) { if (!el.closest('.seg')) add('1.4.11 Non-text Contrast', 'Major', 'Control has no visible boundary', el); return; }
    const bc = parse(cs.borderTopColor), bg = bgOf(el.parentElement || el);
    if (bc && bg) { const r = ratio(blend(bc, bg), bg); if (r < 2.99) add('1.4.11 Non-text Contrast', 'Major', 'Control border ' + r.toFixed(2) + ':1 (needs 3:1)', el); }
  });

  // 4.1.2 / 1.3.1 / 2.4.4 names
  function name(el) {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\s+/).map((id) => { const t = document.getElementById(id); return t ? (t.innerText || t.textContent || '').trim() : ''; }).join(' ').trim();
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    if (el.labels && el.labels.length) return Array.from(el.labels).map((l) => l.innerText.trim()).join(' ');
    if (el.tagName === 'IMG') return el.alt || '';
    const t = (el.innerText || el.textContent || '').trim(); if (t) return t;
    const svgT = el.querySelector && el.querySelector('svg title'); if (svgT) return svgT.textContent;
    return el.getAttribute('title') || '';
  }
  document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=link], summary, [tabindex]:not([tabindex="-1"])').forEach((el) => {
    if (inMap(el) && !el.closest('.leaflet-control')) return;
    const vis = visible(el) || (el.matches('.seg input, .refer-opt input') && el.parentElement && visible(el.parentElement));
    if (!vis) return;
    if (!name(el)) add('4.1.2 Name, Role, Value', 'Critical', 'Interactive element has no accessible name', el);
    if (el.matches('input, select, textarea') && !el.matches('[type=submit],[type=button]') && !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
      add('3.3.2 Labels or Instructions', 'Major', 'Form field has no programmatic label', el);
  });
  // ARIA references and duplicate ids
  const ids = {};
  document.querySelectorAll('[id]').forEach((el) => { ids[el.id] = (ids[el.id] || 0) + 1; });
  Object.keys(ids).forEach((id) => { if (ids[id] > 1) add('4.1.1/4.1.2 Parsing (duplicate id)', 'Major', 'Duplicate id “' + id + '” (' + ids[id] + ')', document.getElementById(id)); });
  document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]').forEach((el) => {
    if (!visible(el) && !el.matches('[role=tab]')) return;
    ['aria-labelledby', 'aria-describedby', 'aria-controls'].forEach((a) => {
      const v = el.getAttribute(a); if (!v) return;
      v.split(/\s+/).forEach((id) => { if (!document.getElementById(id)) add('4.1.2 Name, Role, Value', 'Major', a + ' points to missing id “' + id + '”', el); });
    });
  });
  // Tabs: role tab needs tablist parent + aria-selected
  document.querySelectorAll('[role=tab]').forEach((el) => {
    if (!el.closest('[role=tablist]')) add('4.1.2 Name, Role, Value', 'Major', 'role=tab outside a tablist', el);
    if (!el.hasAttribute('aria-selected')) add('4.1.2 Name, Role, Value', 'Major', 'Tab missing aria-selected', el);
  });
  // Headings (1.3.1, 2.4.6)
  const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible);
  const h1s = hs.filter((h) => h.tagName === 'H1').length;
  if (h1s !== 1) add('1.3.1 Info and Relationships', 'Minor', h1s + ' visible h1 elements (expect 1)', hs[0]);
  let prev = 0;
  hs.forEach((h) => { const l = +h.tagName[1]; if (prev && l > prev + 1) add('1.3.1 Info and Relationships', 'Minor', 'Heading level skips from h' + prev + ' to h' + l, h); prev = l; if (!h.textContent.trim()) add('2.4.6 Headings and Labels', 'Major', 'Empty heading', h); });
  // Landmarks: visible text outside any landmark
  const landmark = 'main, nav, header, footer, aside, [role=main], [role=navigation], [role=banner], [role=contentinfo], [role=complementary], [role=region][aria-label], [role=dialog], [role=status], [role=alert], .toast, .dialog-wrap';
  if (!document.querySelector('main, [role=main]')) add('1.3.1 Info and Relationships', 'Major', 'No main landmark');
  Array.from(document.body.querySelectorAll('h1,h2,h3,p,button,a,table,form')).filter(visible).forEach((el) => {
    if (!el.closest(landmark) && !el.matches('.skip')) add('1.3.1 Info and Relationships', 'Minor', 'Content outside landmarks', el);
  });
  // 2.5.8 target size (24x24), skipping inline links inside sentences
  document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=tab]').forEach((el) => {
    if (inMap(el) && !el.closest('.leaflet-control')) return;
    let t = el;
    if (el.matches('input[type=checkbox], input[type=radio]')) t = el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]')) || el;
    if (!visible(t)) return;
    const r = t.getBoundingClientRect();
    if (r.width >= 24 && r.height >= 24) return;
    if (el.tagName === 'A' && el.closest('p, li, dd, span.contact-note') && el.parentElement && (el.parentElement.textContent.trim().length > el.textContent.trim().length + 3)) return; // inline exception
    add('2.5.8 Target Size (Minimum)', 'Major', 'Target ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px (needs 24×24)', el);
  });
  // 1.4.1 links in running text must not rely on color alone
  document.querySelectorAll('p a[href], li a[href], .hint a[href], dd a[href]').forEach((a) => {
    if (!visible(a) || a.matches('.btn, .cbtn, .side-link')) return;
    const p = a.parentElement; if (!p || p.textContent.trim().length <= a.textContent.trim().length + 3) return;
    const cs = getComputedStyle(a);
    if (!/underline/.test(cs.textDecorationLine)) {
      const fg = parse(cs.color), pc = parse(getComputedStyle(p).color);
      if (fg && pc && ratio(fg, pc) < 3) add('1.4.1 Use of Color', 'Major', 'Link in text not underlined and only ' + ratio(fg, pc).toFixed(2) + ':1 from surrounding text', a);
    }
  });
  // Images / svg
  document.querySelectorAll('img').forEach((el) => { if (!el.hasAttribute('alt')) add('1.1.1 Non-text Content', 'Critical', 'Image without alt', el); });
  document.querySelectorAll('svg').forEach((el) => { if (!visible(el) || inMap(el)) return; if (!el.getAttribute('aria-hidden') && !el.getAttribute('role') && !el.closest('[aria-hidden=true]') && !el.querySelector('title')) add('1.1.1 Non-text Content', 'Minor', 'SVG neither hidden nor labelled', el.parentElement); });
  // 3.1.1 language, 2.4.2 title
  if (!document.documentElement.lang) add('3.1.1 Language of Page', 'Major', 'html lang missing');
  if (!document.title.trim()) add('2.4.2 Page Titled', 'Major', 'Empty title');
  // Live regions for status messages
  ['status', 'a-status', 'map-msg', 'sim-result', 'form-err'].forEach((id) => { const el = document.getElementById(id); if (el && !el.closest('[aria-live], [role=status], [role=alert]')) add('4.1.3 Status Messages', 'Major', 'Status message container not announced', el); });
  // aria-hidden containing focusable
  document.querySelectorAll('[aria-hidden=true]').forEach((el) => { if (el.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')) add('4.1.2 Name, Role, Value', 'Major', 'aria-hidden contains focusable content', el); });
  // Dialog semantics
  document.querySelectorAll('.dialog').forEach((el) => { if (!visible(el)) return; if (el.getAttribute('role') !== 'dialog' || el.getAttribute('aria-modal') !== 'true') add('4.1.2 Name, Role, Value', 'Major', 'Dialog missing role/aria-modal', el); if (!name(el)) add('4.1.2 Name, Role, Value', 'Major', 'Dialog has no accessible name', el); });
  return out;
}

// ---------------- keyboard / focus pass ----------------
async function focusPass(page, label, steps) {
  const issues = [];
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.focus('body').catch(() => {});
  const seen = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      let el = document.activeElement;
      if (!el || el === document.body) return null;
      let show = el;
      if (el.matches('.seg input, input[type=radio], input[type=checkbox]')) { const l = el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]')); if (l && getComputedStyle(el).opacity === '0') show = l; }
      const cs = getComputedStyle(show), csEl = getComputedStyle(el);
      const ring = (s) => (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
      const r = show.getBoundingClientRect();
      const vis = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
      // 2.4.11: not entirely hidden by author content (sample 5 points)
      const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]];
      const covered = pts.every(([x, y]) => { const at = document.elementFromPoint(x, y); return at && !show.contains(at) && !at.contains(show) && !(el.contains(at)); });
      const d = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' “' + ((el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 36)) + '”';
      return { d, ring: ring(cs) || ring(csEl), vis, covered, key: d + Math.round(r.top) };
    });
    if (!info) continue;
    if (seen.length && seen[seen.length - 1] === info.key) break;
    seen.push(info.key);
    if (!info.vis) issues.push({ crit: '2.4.7 Focus Visible', sev: 'Major', msg: 'Focus lands on an off-screen or invisible element', where: info.d });
    else if (!info.ring) issues.push({ crit: '2.4.7 Focus Visible', sev: 'Critical', msg: 'No visible focus indicator', where: info.d });
    if (info.vis && info.covered) issues.push({ crit: '2.4.11 Focus Not Obscured (Minimum)', sev: 'Major', msg: 'Focused element hidden behind other content', where: info.d });
  }
  return { issues, count: seen.length };
}

async function dialogTrap(page, label) {
  const issues = [];
  const inside = async () => page.evaluate(() => { const d = document.querySelector('.dialog-wrap:not([hidden]) .dialog'); return !!(d && d.contains(document.activeElement)); });
  if (!(await inside())) issues.push({ crit: '2.4.3 Focus Order', sev: 'Major', msg: 'Focus not moved into the dialog when it opens', where: label });
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (!(await inside())) { issues.push({ crit: '2.4.3 Focus Order', sev: 'Major', msg: 'Tab moves focus out of the open modal dialog (page behind is reachable)', where: label }); break; } }
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Tab'); if (!(await inside())) { issues.push({ crit: '2.4.3 Focus Order', sev: 'Major', msg: 'Shift+Tab moves focus out of the modal dialog', where: label }); break; } }
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => !document.querySelector('.dialog-wrap:not([hidden]) .dialog'));
  if (!closed) issues.push({ crit: '2.1.1 Keyboard', sev: 'Major', msg: 'Escape does not close the dialog', where: label });
  return issues;
}

async function reflow(page, label) {
  return page.evaluate(() => {
    const out = [];
    const w = document.documentElement.scrollWidth;
    if (w > innerWidth + 1) {
      const wide = Array.from(document.querySelectorAll('body *')).filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && r.width > 0 && !e.closest('.gridwrap, .beds, .bedtbl, .maplist-wrap'); }).slice(0, 4).map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + (e.getAttribute('class') || '').split(' ')[0]);
      out.push({ crit: '1.4.10 Reflow', sev: 'Major', msg: 'Page scrolls sideways at ' + innerWidth + 'px (content ' + w + 'px wide)', where: wide.join(', ') });
    }
    return out;
  });
}
async function textSpacing(page) {
  await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
  await page.waitForTimeout(50);
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('body *').forEach((e) => {
      const cs = getComputedStyle(e);
      if (!/(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) return;
      if (e.closest('.map, .sr, .sr-only') || e.matches('.sr, .sr-only')) return;
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      if (!e.textContent.trim()) return;
      if (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) {
        if (/ellipsis/.test(cs.textOverflow) && e.title) return;
        out.push({ crit: '1.4.12 Text Spacing', sev: 'Major', msg: 'Text clipped when spacing is increased', where: e.tagName.toLowerCase() + '.' + (e.getAttribute('class') || '') + ' “' + e.textContent.trim().slice(0, 30) + '”' });
      }
    });
    return out;
  });
}

(async () => {
  const b = await chromium.launch();
  const all = [];
  const record = (state, list) => list.forEach((x) => all.push(Object.assign({ state }, x)));
  async function open(path, w, h) {
    const ctx = await b.newContext({ viewport: { width: w || 1360, height: h || 900 } });
    const p = await ctx.newPage();
    await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
    await p.route('**/leaflet.js', (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/leaflet-stub.js', 'utf8') }));
    await p.route('**/leaflet.css', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
    await p.route('**/nominatim.openstreetmap.org/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[{"lat":"40.44","lon":"-79.99","display_name":"15219, Pittsburgh"}]' }));
    await p.goto(BASE + path);
    return p;
  }
  const scan = async (p, state) => record(state, await p.evaluate(pageChecks));

  // Board
  let p = await open('index.html');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await scan(p, 'Board · list');
  const f = await focusPass(p, 'Board', 160); record('Board · keyboard', f.issues);
  await p.click('label[for="f-type-detox"]'); await p.click('label[for="f-sex-female"]'); await scan(p, 'Board · filtered detox/women');
  await p.click('label[for="f-type-any"]'); await p.click('label[for="f-sex-any"]');
  await p.click('#f-loc-btn'); await scan(p, 'Board · locations open');
  await p.keyboard.press('Escape');
  await p.click('#card-cove-forge [data-refer]'); await scan(p, 'Board · referral dialog'); record('Board · referral dialog', await dialogTrap(p, 'Referral dialog'));
  await p.click('#card-cove-forge [data-refer]'); await p.click('#refer-form button[type=submit]'); await scan(p, 'Board · toast + referral marked');
  await p.click('#card-cove-forge [data-report]'); await scan(p, 'Board · source dialog'); record('Board · source dialog', await dialogTrap(p, 'Source dialog'));
  await p.click('label[for="f-mode-map"]'); await p.fill('#map-q', '15219'); await p.click('#map-form button[type=submit]'); await p.waitForTimeout(200);
  await p.locator('.ml-head').first().click(); await scan(p, 'Board · map + selected');
  await p.click('label[for="f-mode-list"]');
  await p.click('#tab-grid'); await scan(p, 'Board · All sites');
  // tabs keyboard (arrow keys)
  await p.focus('#tab-grid'); await p.keyboard.press('ArrowRight');
  const tabOk = await p.evaluate(() => document.activeElement.id === 'tab-updates' && document.getElementById('tab-updates').getAttribute('aria-selected') === 'true');
  if (!tabOk) all.push({ state: 'Board · tabs', crit: '2.1.1 Keyboard', sev: 'Major', msg: 'Arrow keys do not move between tabs', where: '[role=tab]' });
  await p.click('#tab-updates'); await scan(p, 'Board · Updates');
  record('Board · text spacing', await textSpacing(p));

  // Update form
  p = await open('update.html?org=gaiser');
  await p.click('[data-profile="gaiser"] > summary'); await scan(p, 'Update · existing org + details');
  record('Update · keyboard', (await focusPass(p, 'Update', 140)).issues);
  await p.click('#cta-add'); await scan(p, 'Update · new facility');
  await p.selectOption('#org', '__new'); await scan(p, 'Update · new provider');
  await p.check('#confirm'); await p.click('#submit'); await scan(p, 'Update · errors shown');
  record('Update · text spacing', await textSpacing(p));
  // Multi-facility provider: collapsed facilities, jump list, confirm, review dialog
  p = await open('update.html?org=acadia'); await scan(p, 'Update · collapsed facilities + jump list');
  record('Update · multi keyboard', (await focusPass(p, 'Update multi', 80)).issues);
  await p.click('[data-jump="bradford"]'); await p.click('#sbody-bradford [data-copy]'); await scan(p, 'Update · confirmed last counts');
  await p.check('#confirm'); await p.click('#submit'); await scan(p, 'Update · review dialog'); record('Update · review dialog', await dialogTrap(p, 'Review dialog'));
  await p.keyboard.press('Escape');

  // Admin
  p = await open('admin.html');
  await scan(p, 'Admin · updates');
  record('Admin · keyboard', (await focusPass(p, 'Admin', 120)).issues);
  await p.click('details.sim > summary'); await scan(p, 'Admin · email simulator open');
  await p.selectOption('#pick-site', 'cove-forge'); await p.click('#pick-go'); await scan(p, 'Admin · update counts dialog'); record('Admin · update dialog', await dialogTrap(p, 'Admin update dialog'));
  await p.selectOption('#pick-site', 'cove-forge'); await p.click('#pick-details'); await scan(p, 'Admin · details dialog'); await p.keyboard.press('Escape');
  await p.click('#add-site'); await scan(p, 'Admin · add facility dialog'); await p.keyboard.press('Escape');
  await p.click('#t-settings'); await scan(p, 'Admin · settings');
  record('Admin · text spacing', await textSpacing(p));

  // Phone + reflow at 320px (= 400% zoom of 1280)
  for (const path of ['index.html', 'update.html?org=acadia', 'admin.html']) {
    const m = await open(path, 390, 844); await scan(m, 'Phone 390 · ' + path);
    const r = await open(path, 320, 640); record('Reflow 320 · ' + path, await reflow(r, path));
    if (path === 'index.html') { await r.click('#filters-toggle'); await r.click('#f-loc-btn'); record('Reflow 320 · locations', await reflow(r, 'loc')); await r.keyboard.press('Escape'); await r.click('#card-cove-forge [data-refer]'); record('Reflow 320 · referral dialog', await reflow(r, 'dlg')); }
  }
  await b.close();

  // de-duplicate by crit+msg+where, keep first state
  const key = (x) => x.crit + '|' + x.msg.replace(/[\d.]+:1.*$/, '') + '|' + x.where;
  const uniq = {}; all.forEach((x) => { const k = key(x); if (!uniq[k]) uniq[k] = Object.assign({}, x, { states: [x.state] }); else if (uniq[k].states.indexOf(x.state) < 0) uniq[k].states.push(x.state); });
  const list = Object.values(uniq);
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(list, null, 1));
  const by = {}; list.forEach((x) => { (by[x.crit] = by[x.crit] || []).push(x); });
  console.log('TOTAL unique issues:', list.length);
  Object.keys(by).sort().forEach((c) => { console.log('\n## ' + c + ' (' + by[c].length + ')'); by[c].slice(0, 14).forEach((x) => console.log(' - [' + x.sev + '] ' + x.msg + ' — ' + x.where + ' — ' + x.states[0] + (x.states.length > 1 ? ' (+' + (x.states.length - 1) + ')' : ''))); if (by[c].length > 14) console.log('   … ' + (by[c].length - 14) + ' more'); });
})().catch((e) => { console.error(e); process.exit(1); });
