// Сборка меню Mandi Center «Карак»: index.html (русский) и kk/index.html (казахский).
// Запуск из папки проекта: node build.js
// Данные: data/menu.json (цены, названия), data/menu.kk.json и data/ui.*.json (тексты).
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const M = read('data/menu.json');
const UI = { ru: read('data/ui.ru.json') };
let KK = null;
try { KK = read('data/menu.kk.json'); UI.kk = read('data/ui.kk.json'); }
catch (e) { console.warn('Нет казахского перевода (data/menu.kk.json, data/ui.kk.json): /kk/ не собран.'); }

const NB = '\u00a0';
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₸';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tpl = (s, v) => Object.keys(v).reduce((a, k) => a.split('{' + k + '}').join(v[k]), s);

// ── Фото: копируем нужные и узнаём их размер ──
const SRC_IMAGES = path.join(ROOT, '..', '..', 'images');
fs.mkdirSync(path.join(ROOT, 'images'), { recursive: true });
function jpegSize(file) {
  const d = fs.readFileSync(file);
  let i = 2;
  while (i < d.length) {
    if (d[i] !== 0xFF) { i++; continue; }
    const m = d[i + 1];
    if (m >= 0xC0 && m <= 0xC3) return { w: d.readUInt16BE(i + 7), h: d.readUInt16BE(i + 5) };
    i += 2 + d.readUInt16BE(i + 2);
  }
  return { w: 140, h: 140 };
}
const SIZES = {};
// На этих фото в правом нижнем углу водяной знак 2ГИС: срезаем нижние 72px через object-fit
const WATERMARKED = new Set(['images/item-0-0-0.jpg', 'images/item-0-1-3.jpg', 'images/item-1-7-2.jpg']);
function img(rel) {
  if (!rel) return null;
  const dst = path.join(ROOT, rel);
  if (!fs.existsSync(dst)) fs.copyFileSync(path.join(SRC_IMAGES, path.basename(rel)), dst);
  if (!SIZES[rel]) {
    const s = jpegSize(dst);
    SIZES[rel] = WATERMARKED.has(rel) ? { w: s.w, h: s.h - 72 } : s;
  }
  return SIZES[rel];
}
const lbl = s => esc(s).replace(/ /g, NB);

const ICON = {
  plus: '<svg class="i-plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
  check: '<svg class="i-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  sun: '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>',
  moon: '<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  dot: '<svg viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4"/></svg>',
};

function build(lang) {
  const ui = UI[lang];
  const kk = lang === 'kk' ? KK : null;
  const P = lang === 'kk' ? '../' : '';
  const tr = {
    meta: k => (kk && kk.meta[k]) || M.meta[k],
    sec: s => (kk && kk.sections[s.id]) || s.label,
    cat: (c, k) => (kk && kk.categories[c.id] && kk.categories[c.id][k] !== undefined ? kk.categories[c.id][k] : c[k]) || '',
    pairing: (c, k) => (kk && kk.categories[c.id] && kk.categories[c.id][k === 'title' ? 'pairingTitle' : 'pairingSubtitle']) || c.pairing[k],
    card: (d, k) => (kk && kk.cards[d.id] && kk.cards[d.id][k] !== undefined ? kk.cards[d.id][k] : d[k]) || '',
    label: l => (kk && l && kk.optionLabels[l]) || l || '',
    cook: c => (kk && kk.cooking[c]) || c,
  };

  // Индекс позиций для списка и экрана официанта
  const ITEMS = {}, BYKEY = {};
  for (const s of M.sections) for (const c of s.categories) for (const d of c.cards) for (const o of d.options) {
    BYKEY[o.key] = { d, o };
    ITEMS[o.key] = { t: tr.card(d, 'title'), l: tr.label(o.label), p: o.price || 0, ru: d.title, lru: o.label || '' };
  }
  const COOK = { 'барбекю': tr.cook('барбекю'), 'фрай': tr.cook('фрай') };

  const addBtn = (key, price, label, cook, disabled) =>
    `<button class="add" type="button" data-key="${key}"${price != null ? ` data-price="${price}"` : ''}${cook !== undefined ? ` data-cook="${esc(cook)}"` : ''} aria-label="${esc(label)}" data-label="${esc(label)}"${disabled ? ' disabled' : ''}>${ICON.plus}<span class="add__n" aria-hidden="true"></span></button>`;
  const searchText = d => esc([tr.card(d, 'title'), tr.card(d, 'desc'), ...d.options.map(o => tr.label(o.label)), lang !== 'ru' ? d.title : ''].join(' ').toLowerCase().replace(/ё/g, 'е'));
  const photoFigure = (id, src, alt) => {
    const s = img(src);
    const big = s.w >= 600;
    return `<figure class="photo${big ? ' photo--lg' : ''}" id="ph-${id}" hidden><img src="${P}${src}" alt="${esc(alt)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async"></figure>`;
  };
  const photoBtn = id => `<button class="text-btn text-btn--quiet photo-toggle" type="button" aria-expanded="false" aria-controls="ph-${id}">${esc(ui.photo)}${ICON.chevron}</button>`;

  // ── Манди ──
  function dish(d) {
    const title = tr.card(d, 'title');
    const byN = {};
    for (const o of d.options) {
      const m = /^(\d+)\s*(.*)$/.exec(o.label || '');
      const n = o.persons || (m ? +m[1] : 1);
      byN[n] = o;
    }
    const def = byN[2] || d.options[0];
    const cook = (d.options.find(o => o.cookingOptions) || {}).cookingOptions;
    const slots = [1, 2, 5].map(n => {
      const o = byN[n];
      if (!o) return '<span class="portion portion--none" aria-hidden="true"></span>';
      const lab = tr.label(o.label);
      const m = /^(\d+)\s*(.*)$/.exec(lab) || [null, String(n), lab];
      const pp = o.perPerson ? tpl(ui.perPerson, { price: fmt(o.perPerson) }) : '';
      const save = o.perPersonVs && o.perPersonVs.pct >= 5 ? `−${o.perPersonVs.pct}${NB}%` : '';
      const ph = o.photo || d.photo; const s = img(ph);
      const aria = [lab, fmt(o.price), pp, save].filter(Boolean).join(', ');
      return `<button class="portion" type="button" aria-pressed="${o === def}" aria-label="${esc(aria)}" data-key="${o.key}" data-price="${o.price}" data-n="${n}" data-label="${esc(lab)}" data-photo="${P}${ph}" data-w="${s.w}" data-h="${s.h}">` +
        `<span class="portion__head" aria-hidden="true"><span class="portion__n">${esc(m[1])}</span><span class="portion__unit">${esc(m[2])}</span></span>` +
        `<span class="portion__price" aria-hidden="true">${fmt(o.price)}</span>` +
        (pp ? `<span class="portion__pp" aria-hidden="true">${esc(pp)}</span>` : '') +
        (save ? `<span class="save" aria-hidden="true">${save}</span>` : '') + '</button>';
    }).join('');
    const note = !byN[1] ? ui.fallbackNoOne : !byN[5] ? ui.fallbackNoFive : '';
    const defLab = tr.label(def.label) + (cook ? ', ' + tr.cook(cook[0]) : '');
    const ph = def.photo || d.photo;
    return `<article class="dish" id="card-${d.id}" data-title="${esc(title)}" data-search="${searchText(d)}"${cook ? ` data-cook="${esc(cook[0])}"` : ''}>
<div class="dish__head"><h4 class="dish__title">${esc(title)}</h4>${d.badge ? `<span class="badge">${esc(tr.card(d, 'badge'))}</span>` : ''}</div>
<div class="portions" role="group" aria-label="${esc(title)}">${slots}</div>
${note ? `<p class="dish__note t-meta" hidden>${esc(note)}</p>` : ''}
${cook ?`<div class="opts cook" role="group" aria-label="${esc(ui.cooking)}"><span class="t-meta">${esc(ui.cooking)}</span>${cook.map((c, i) => `<button class="opt" type="button" data-cook="${esc(c)}" aria-pressed="${i === 0}">${esc(tr.cook(c))}</button>`).join('')}</div>` : ''}
<p class="t-desc">${esc(tr.card(d, 'desc'))}${ph ? ' ' + photoBtn(d.id) : ''}</p>
${ph ? photoFigure(d.id, ph, title + ', ' + tr.label(def.label)) : ''}
<div class="line dish__sum"><span class="line__name t-meta"><span class="sum-label">${esc(defLab)}</span><span class="line__dots" aria-hidden="true"></span></span><span class="t-price-lg sum-price">${fmt(def.price)}</span>${addBtn(def.key, def.price, tpl(ui.addTo, { name: `${title}, ${defLab}, ${fmt(def.price)}` }), cook ? cook[0] : '')}</div>
</article>`;
  }

  // ── Обычная позиция ──
  function item(d) {
    const title = tr.card(d, 'title');
    const opts = d.options, first = opts[0], multi = opts.length > 1;
    const oos = !multi && (first.outOfStock || first.price == null);
    const single = !multi && first.label ? ` <span class="ilabel t-meta">${lbl(tr.label(first.label))}</span>` : '';
    const ph = d.photo || (opts.find(o => o.photo) || {}).photo;
    const label = multi ? `${title}, ${tr.label(first.label)}` : `${title}${first.label ? ', ' + tr.label(first.label) : ''}`;
    const priceEl = oos ? '' : `<span class="t-price">${fmt(first.price)}</span>`;
    const add = oos ? addBtn(first.key, null, `${title}, ${ui.outOfStock}`, undefined, true)
      : addBtn(first.key, first.price, tpl(ui.addTo, { name: `${label}, ${fmt(first.price)}` }));
    const desc = tr.card(d, 'desc');
    return `<article class="item${oos ? ' is-oos' : ''}" id="card-${d.id}" data-title="${esc(title)}" data-search="${searchText(d)}">
${multi ? `<h4 class="t-dish item__title">${esc(title)}</h4>` : `<div class="line${oos ? ' line--oos' : ''}"><h4 class="line__name t-dish">${esc(title)}${single}${oos ? '' : '<span class="line__dots" aria-hidden="true"></span>'}</h4>${priceEl}${add}</div>`}
${oos ? `<p class="oos">${esc(ui.outOfStock)}</p>` : ''}
${d.badge ? `<p class="item__more"><span class="badge">${esc(tr.card(d, 'badge'))}</span></p>` : ''}
${multi ? `<div class="pick"><div class="opts" role="group" aria-label="${esc(title)}">${opts.map((o, i) => `<button class="opt" type="button" aria-pressed="${i === 0}" data-key="${o.key}" data-price="${o.price}" data-label="${esc(tr.label(o.label))}"><span>${lbl(tr.label(o.label))}</span><span class="opt__price">${fmt(o.price)}</span></button>`).join('')}</div>${add}</div>` : ''}
${desc ? `<p class="t-desc">${esc(desc)}${ph ? ' ' + photoBtn(d.id) : ''}</p>` : (ph ? `<p class="item__more">${photoBtn(d.id)}</p>` : '')}
${ph ? photoFigure(d.id, ph, title) : ''}
</article>`;
  }

  function category(s, c) {
    const sub = tr.cat(c, 'subtitle'), lead = tr.cat(c, 'lead');
    return `<section class="cat" id="cat-${c.id}" data-sec="${s.id}" aria-labelledby="h-${c.id}">
<header class="cat__head"><h3 class="t-h1" id="h-${c.id}">${esc(tr.cat(c, 'label'))}</h3>${sub ? `<p class="t-meta cat__sub">${esc(sub)}</p>` : ''}${lead ? `<p class="t-desc cat__lead">${esc(lead)}</p>` : ''}</header>
<div class="items">${c.cards.map(item).join('\n')}</div>
</section>`;
  }

  function mandiBlock(s, c) {
    const p = c.pairing;
    const pairing = `<aside class="panel pairing" aria-labelledby="h-pairing"><h4 class="t-h2" id="h-pairing">${esc(tr.pairing(c, 'title'))}</h4><p class="t-meta pairing__sub">${esc(tr.pairing(c, 'subtitle'))}</p>
<div class="items">${p.keys.map(k => {
      const { d, o } = BYKEY[k]; const title = tr.card(d, 'title'); const lab = tr.label(o.label);
      return `<div class="line"><span class="line__name t-dish">${esc(title)}${lab ? ` <span class="ilabel t-meta">${lbl(lab)}</span>` : ''}<span class="line__dots" aria-hidden="true"></span></span><span class="t-price">${fmt(o.price)}</span>${addBtn(k, o.price, tpl(ui.addTo, { name: `${title}${lab ? ', ' + lab : ''}, ${fmt(o.price)}` }))}</div>`;
    }).join('')}</div></aside>`;
    const hero = img('images/item-0-0-0.jpg');
    return `<section class="cat cat--mandi" id="cat-${c.id}" data-sec="${s.id}" aria-labelledby="h-${c.id}">
<div class="mandi">
<div class="mandi__aside">
<figure class="mandi__photo"><img src="${P}images/item-0-0-0.jpg" alt="${esc(tr.cat(c, 'label'))}" width="${hero.w}" height="${hero.h}" fetchpriority="high" decoding="async"></figure>
<div class="mandi__head"><h3 class="t-display" id="h-${c.id}">${esc(tr.cat(c, 'label'))}</h3><p class="mandi__sub">${esc(tr.cat(c, 'subtitle'))}</p></div>
<p class="t-desc mandi__lead">${esc(tr.cat(c, 'lead'))}</p>
<div class="seg" role="group" aria-labelledby="seg-label"><span class="seg__label" id="seg-label">${esc(ui.howMany)}</span><div class="seg__opts">${[1, 2, 5].map(n => `<button class="seg__opt" type="button" data-n="${n}" aria-pressed="${n === 2}">${n}</button>`).join('')}</div></div>
</div>
<div class="dishes">
${c.cards.map(dish).join('\n')}
${pairing}
<details class="story"><summary>${esc(ui.whatIsMandi)}${ICON.chevron}</summary><p class="t-desc">${esc(tr.cat(c, 'descriptionFull'))}</p></details>
</div>
</div>
</section>`;
  }

  // Карак — фирменный напиток: открывает «Напитки» вторым и последним большим фото
  function featureBlock(s, c, photo, alt) {
    const sz = img(photo);
    const sub = tr.cat(c, 'subtitle'), lead = tr.cat(c, 'lead');
    return `<section class="cat cat--feature" id="cat-${c.id}" data-sec="${s.id}" aria-labelledby="h-${c.id}">
<div class="mandi">
<div class="mandi__aside">
<figure class="mandi__photo mandi__photo--pour"><img src="${P}${photo}" alt="${esc(alt)}" width="${sz.w}" height="${sz.h}" loading="lazy" decoding="async"></figure>
<div class="mandi__head"><h3 class="t-display" id="h-${c.id}">${esc(tr.cat(c, 'label'))}</h3>${sub ? `<p class="mandi__sub">${esc(sub)}</p>` : ''}</div>
${lead ? `<p class="t-desc mandi__lead">${esc(lead)}</p>` : ''}
</div>
<div class="dishes"><div class="items">${c.cards.map(item).join('\n')}</div></div>
</div>
</section>`;
  }

  const sections = M.sections.map((s, si) => {
    const [first, ...rest] = s.categories;
    const head = `<h2 class="t-display sec__title${si < 2 ? ' sr-only' : ''}" id="st-${s.id}">${esc(tr.sec(s))}</h2>`;
    const opener = first.layout === 'feature' ? mandiBlock(s, first)
      : first.id === 'karak' ? featureBlock(s, first, 'images/cover-bar-karak-karak-tea.jpg', tr.card(first.cards[0], 'title'))
      : null;
    const body = opener
      ? opener + `\n<div class="cats">${rest.map(c => category(s, c)).join('\n')}</div>`
      : `<div class="cats">${s.categories.map(c => category(s, c)).join('\n')}</div>`;
    return `<section class="sec" id="sec-${s.id}" aria-labelledby="st-${s.id}"><div class="container">\n${head}\n${body}\n</div></section>`;
  }).join('\n');

  const tabs = M.sections.map((s, i) => `<a class="tab" href="#cat-${s.categories[0].id}" data-sec="${s.id}" data-first="cat-${s.categories[0].id}" aria-current="${i === 0}">${esc(tr.sec(s))}</a>`).join('');
  const chips = M.sections.map((s, i) => `<div class="chips" data-sec="${s.id}" aria-label="${esc(ui.categoriesNav)}: ${esc(tr.sec(s))}"${i ? ' hidden' : ''}>${s.categories.map((c, j) => `<a class="chip" href="#cat-${c.id}" data-cat="cat-${c.id}" aria-current="${i === 0 && j === 0}">${esc(tr.cat(c, 'chip') || tr.cat(c, 'label'))}</a>`).join('')}</div>`).join('');

  const L = M.meta.links;
  const data = { lang, ui, items: ITEMS, cook: COOK };
  const langLink = (code, label, full) => `<a class="lang__btn" href="${code === 'ru' ? (lang === 'ru' ? './' : '../') : (lang === 'kk' ? './' : 'kk/')}" lang="${code}" hreflang="${code}" title="${esc(full)}"${code === lang ? ' aria-current="true"' : ''}>${esc(label)}</a>`;

  return `<!doctype html>
<html lang="${ui.htmlLang}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(ui.pageTitle)}</title>
<meta name="description" content="${esc(ui.metaDescription)}">
<meta name="theme-color" content="#16181A">
<link rel="alternate" hreflang="ru" href="/">
<link rel="alternate" hreflang="kk" href="/kk/">
<script>try{if(localStorage.getItem('mandi-theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Spectral:ital,wght@0,500;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${P}src/tokens.css">
<link rel="stylesheet" href="${P}src/components.css">
<link rel="stylesheet" href="${P}src/menu.css">
</head>
<body>
<a class="btn btn--primary skip" href="#menu">${esc(ui.skipToMenu)}</a>
<header class="masthead"><div class="container">
<div class="topbar">
<a class="wordmark" href="./">${esc(M.meta.brand)}</a>
<div class="topbar__tools">
<nav class="lang" aria-label="${esc(ui.langNav)}">${langLink('ru', ui.langRu, ui.langRuFull)}<span class="lang__sep" aria-hidden="true"></span>${langLink('kk', ui.langKk, ui.langKkFull)}</nav>
<button class="icon-btn" id="theme-btn" type="button" aria-label="${esc(ui.themeToLight)}">${ICON.sun}${ICON.moon}</button>
<button class="icon-btn" id="search-btn" type="button" aria-label="${esc(ui.searchOpen)}" aria-expanded="false" aria-controls="search">${ICON.search}</button>
</div>
</div>
<div class="intro">
<h1 class="intro__title">${esc(tr.meta('tagline'))}</h1>
<div class="intro__meta">
<p class="intro__facts t-meta"><span>${esc(tr.meta('cuisine'))}</span><span>${esc(tr.meta('halalNote'))}</span></p>
<p class="status" id="status">${ICON.dot}<span>${esc(ui.statusOpen)}</span></p>
</div>
</div>
</div></header>
<nav class="nav" aria-label="${esc(ui.sectionsNav)}"><div class="container">
<div class="search" id="search" role="search" hidden>
<div class="field">
<label class="sr-only" for="q">${esc(ui.searchLabel)}</label>
<div class="search__row"><div class="field__control">${ICON.search}<input id="q" type="search" placeholder="${esc(ui.searchPlaceholder)}" autocomplete="off" enterkeyhint="search" aria-describedby="q-result"></div><button class="icon-btn" id="search-close" type="button" aria-label="${esc(ui.searchClose)}">${ICON.close}</button></div>
<p class="field__hint search__result" id="q-result" aria-live="polite"></p>
</div>
</div>
<div class="tabs">${tabs}</div>
${chips}
</div></nav>
<main id="menu" tabindex="-1">
${sections}
<section class="about" aria-labelledby="h-about"><div class="container"><div class="panel">
<h2 class="t-h1" id="h-about">${esc(ui.about)}</h2>
<p class="t-body">${esc(tr.meta('cuisine'))}. ${esc(tr.meta('halalNote'))}.</p>
<p class="t-meta">${esc(tr.meta('address'))}</p>
<p class="t-meta">${esc(tr.meta('hours'))}</p>
<p class="t-body">${esc(ui.allergens)}</p>
<div class="about__links"><a class="btn btn--primary" href="tel:${esc(L.phone)}">${esc(ui.call)}</a><a class="btn btn--secondary" href="${esc(L.whatsapp)}" target="_blank" rel="noopener">${esc(ui.whatsapp)}</a><a class="btn btn--secondary" href="${esc(L.instagram)}" target="_blank" rel="noopener">${esc(ui.instagram)}</a><a class="btn btn--secondary" href="${esc(L.twogis)}" target="_blank" rel="noopener">${esc(ui.twogis)}</a></div>
</div></div></section>
</main>
<footer class="foot"><div class="container"><span class="wordmark">${esc(ui.footerBrand)}</span><p class="t-meta">${esc(ui.pricesNote)}</p></div></footer>

<div class="listbar" id="listbar" hidden><div class="listbar__in">
<div><p class="listbar__label">${esc(ui.listTitle)}</p><p class="listbar__sum"><span id="lb-count"></span><span id="lb-total"></span></p></div>
<button class="btn btn--primary" id="lb-open" type="button" aria-haspopup="dialog" aria-controls="sheet">${esc(ui.listOpen)}</button>
</div></div>

<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h" hidden>
<div class="sheet__scrim"></div>
<div class="sheet__panel">
<div class="sheet__head"><h2 class="t-h2" id="sheet-h">${esc(ui.listTitle)}</h2><button class="icon-btn" id="sheet-close" type="button" aria-label="${esc(ui.listClose)}">${ICON.close}</button></div>
<div class="sheet__body"><ul class="ol" id="sheet-lines"></ul></div>
<div class="sheet__foot">
<div class="sheet__total"><span class="t-h2">${esc(ui.listTotal)}</span><span class="t-price-lg" id="sheet-total"></span></div>
<p class="t-meta">${esc(ui.listNote)}</p>
<div class="sheet__actions"><button class="btn btn--secondary" id="clear" type="button">${esc(ui.listClear)}</button><button class="btn btn--primary btn--lg" id="show-waiter" type="button">${esc(ui.showWaiter)}</button></div>
</div>
</div>
</div>

<div class="waiter" id="waiter" role="dialog" aria-modal="true" aria-labelledby="w-h" data-theme="light" hidden><div class="waiter__in">
<div class="waiter__top"><span class="wordmark">${esc(M.meta.brand)}</span><button class="btn btn--secondary" id="waiter-close" type="button">${esc(ui.waiterBack)}</button></div>
<h2 class="t-display waiter__title" id="w-h">${esc(ui.waiterTitle)}</h2>
<ol class="wl" id="w-lines"></ol>
<div class="waiter__total"><span>${esc(ui.listTotal)}</span><span id="w-total"></span></div>
<p class="t-body waiter__note">${esc(ui.waiterNote)}</p>
</div></div>

<div class="sr-only" id="live" role="status" aria-live="polite"></div>
<script type="application/json" id="menu-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script src="${P}src/app.js" defer></script>
</body>
</html>
`;
}

const out = [['ru', 'index.html']];
if (KK) out.push(['kk', 'kk/index.html']);
for (const [lang, file] of out) {
  const html = build(lang);
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, file), html);
  console.log(`${file}: ${(html.length / 1024).toFixed(0)} КБ`);
}
console.log('Фото:', Object.keys(SIZES).length);
