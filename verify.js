// Сверка собранных страниц с данными: у каждой позиции есть data-key,
// каждая цена на кнопках совпадает с data/menu.json, цены набраны с неразрывными пробелами.
// Запуск: node verify.js
const fs = require('fs');
const path = require('path');
const M = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/menu.json'), 'utf8'));
const PRICE = {};
let sum = 0, count = 0;
for (const s of M.sections) for (const c of s.categories) for (const d of c.cards) for (const o of d.options) {
  PRICE[o.key] = o.price; sum += o.price || 0; count++;
}
let failed = false;
for (const file of ['index.html', 'kk/index.html']) {
  const f = path.join(__dirname, file);
  if (!fs.existsSync(f)) { console.log(`${file}: нет файла`); continue; }
  const html = fs.readFileSync(f, 'utf8');
  const errs = [];
  for (const k of Object.keys(PRICE)) if (!html.includes(`data-key="${k}"`)) errs.push(`нет data-key="${k}"`);
  const re = /data-key="(\d+-\d+-\d+)"[^>]*?data-price="(\d+)"/g;
  let m, checked = 0;
  while ((m = re.exec(html))) { checked++; if (+m[2] !== PRICE[m[1]]) errs.push(`${m[1]}: на странице ${m[2]}, в данных ${PRICE[m[1]]}`); }
  const plainSpace = html.match(/\d \d{3}(?: |&nbsp;)?₸|\d ₸/g);
  if (plainSpace) errs.push(`цены с обычным пробелом: ${plainSpace.slice(0, 3).join(', ')}`);
  if (!/data-key="3-0-7"[^>]*disabled/.test(html)) errs.push('кнопка у позиции 3-0-7 (нет в наличии) не отключена');
  console.log(`${file}: позиций ${count}, сумма ${sum}, проверено цен на кнопках ${checked}${errs.length ? `, ОШИБОК ${errs.length}` : ', OK'}`);
  errs.slice(0, 20).forEach(e => console.log('  - ' + e));
  if (errs.length) failed = true;
}
process.exit(failed ? 1 : 0);
