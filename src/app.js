/* Mandi Center — меню «Карак». Без библиотек.
   Список хранится только в localStorage этого телефона и никуда не отправляется. */
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("menu-data").textContent);
  var UI = DATA.ui, ITEMS = DATA.items, COOK = DATA.cook;
  var KEY = "mandi-chaynaya-list";
  var NB = " ";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + "₸"; }
  function t(key, vars) {
    var s = UI[key] || "";
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function countText(n) {
    var tpl = UI.listItems;
    var m = tpl.match(/\{([^{}]*\|[^{}]*)\}/);
    if (!m) return tpl.split("{n}").join(n);
    var f = m[1].split("|"), a = n % 10, b = n % 100;
    var w = (a === 1 && b !== 11) ? f[0] : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? f[1] : f[2];
    return tpl.replace(m[0], w).split("{n}").join(n);
  }
  var live = $("#live");
  function say(msg) { live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 30); }

  /* ───────── Высота навигации для якорей ───────── */
  var nav = $(".nav");
  function setNavH() { root.style.setProperty("--nav-h", nav.offsetHeight + "px"); }
  setNavH();
  window.addEventListener("resize", setNavH);

  /* ───────── Тема ───────── */
  var themeBtn = $("#theme-btn");
  function syncThemeBtn() {
    var light = root.getAttribute("data-theme") === "light";
    themeBtn.setAttribute("aria-label", light ? UI.themeToDark : UI.themeToLight);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#F6F4F0" : "#16181A");
  }
  themeBtn.addEventListener("click", function () {
    var light = root.getAttribute("data-theme") !== "light";
    root.setAttribute("data-theme", light ? "light" : "dark");
    try { localStorage.setItem("mandi-theme", light ? "light" : "dark"); } catch (e) {}
    syncThemeBtn();
  });
  syncThemeBtn();

  /* ───────── Открыто или нет: 11:00–01:00 по Астане (UTC+5) ───────── */
  (function () {
    var st = $("#status"); if (!st) return;
    var h = (new Date().getUTCHours() + 5) % 24;
    var open = h >= 11 || h < 1;
    st.lastChild.textContent = open ? UI.statusOpen : UI.statusClosed;
    st.classList.toggle("status--closed", !open);
  })();

  /* ───────── Манди: порции, «Сколько вас?», способ ───────── */
  function selectPortion(dish, btn) {
    $$(".portion", dish).forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
    var sum = $(".dish__sum", dish), add = $(".add", sum);
    var cook = dish.getAttribute("data-cook") || "";
    var label = btn.getAttribute("data-label") + (cook ? ", " + (COOK[cook] || cook) : "");
    $(".sum-label", sum).textContent = label;
    $(".sum-price", sum).textContent = fmt(+btn.getAttribute("data-price"));
    add.setAttribute("data-key", btn.getAttribute("data-key"));
    add.setAttribute("data-price", btn.getAttribute("data-price"));
    add.setAttribute("data-cook", cook);
    add.setAttribute("data-label", t("addTo", { name: dish.getAttribute("data-title") + ", " + label + ", " + fmt(+btn.getAttribute("data-price")) }));
    syncAdd(add);
    var fig = $(".photo", dish), src = btn.getAttribute("data-photo");
    if (fig && src) {
      var img = $("img", fig), w = +btn.getAttribute("data-w"), h = +btn.getAttribute("data-h");
      if (img.getAttribute("src") !== src) { img.src = src; img.width = w; img.height = h; }
      img.alt = dish.getAttribute("data-title") + ", " + btn.getAttribute("data-label");
      fig.classList.toggle("photo--lg", w >= 600);
    }
  }
  function applyN(n, announce) {
    $$(".seg__opt").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.getAttribute("data-n") === n)); });
    $$(".dish").forEach(function (dish) {
      var ps = $$(".portion", dish), note = $(".dish__note", dish);
      var best = ps.filter(function (p) { return +p.getAttribute("data-n") === n; })[0];
      if (!best) {
        best = ps.reduce(function (a, b) { return Math.abs(+b.getAttribute("data-n") - n) < Math.abs(+a.getAttribute("data-n") - n) ? b : a; });
        if (note) note.hidden = false;
      } else if (note) note.hidden = true;
      selectPortion(dish, best);
    });
    if (announce) say(t("portionsSet", { n: n }));
  }

  /* ───────── Список ───────── */
  var list = [];
  try { list = JSON.parse(localStorage.getItem(KEY) || "[]").filter(function (l) { return ITEMS[l.k] && l.q > 0; }); } catch (e) { list = []; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
  function totals() {
    var n = 0, sum = 0;
    list.forEach(function (l) { n += 1; sum += l.q * ITEMS[l.k].p; });
    return { n: n, sum: sum };
  }
  var bar = $("#listbar");
  function renderBar() {
    var s = totals();
    bar.hidden = s.n === 0;
    document.body.classList.toggle("has-list", s.n > 0);
    $("#lb-count").textContent = countText(s.n);
    $("#lb-total").textContent = fmt(s.sum);
    $$(".add[data-key]").forEach(syncAdd);
  }
  // «+» показывает, сколько этой позиции уже в списке
  function syncAdd(b) {
    if (b.disabled) return;
    var k = b.getAttribute("data-key"), hasCook = b.hasAttribute("data-cook"), c = b.getAttribute("data-cook") || "", n = 0;
    list.forEach(function (l) { if (l.k === k && (!hasCook || (l.c || "") === c)) n += l.q; });
    b.classList.toggle("is-in", n > 0);
    $(".add__n", b).textContent = n > 0 ? n : "";
    b.setAttribute("aria-label", (b.getAttribute("data-label") || "") + (n > 0 ? ", " + t("inList", { n: n }) : ""));
  }
  function addLine(k, cook) {
    var id = k + "|" + (cook || "");
    var line = list.filter(function (l) { return l.k + "|" + (l.c || "") === id; })[0];
    if (line) line.q += 1; else list.push({ k: k, c: cook || "", q: 1 });
    save(); renderBar();
  }
  function lineLabel(l, lang) {
    var it = ITEMS[l.k];
    var parts = [];
    var lab = lang === "ru" ? it.lru : it.l;
    if (lab) parts.push(lab);
    if (l.c) parts.push(lang === "ru" ? l.c : (COOK[l.c] || l.c));
    return parts.join(", ");
  }

  /* ───────── Шторка ───────── */
  var sheet = $("#sheet"), lastFocus = null;
  function renderSheet() {
    var ol = $("#sheet-lines");
    if (!list.length) {
      ol.innerHTML = '<li class="ol__empty t-body">' + UI.listEmpty + "</li>";
    } else {
      ol.innerHTML = list.map(function (l, i) {
        var it = ITEMS[l.k], sub = lineLabel(l);
        return '<li class="ol__item"><div class="ol__name"><span class="t-dish">' + it.t + "</span>" +
          (sub ? '<span class="t-meta">' + sub + "</span>" : "") + (l.q > 1 ? '<span class="t-meta">' + t("unitPrice", { n: l.q, price: fmt(it.p) }) + "</span>" : "") + "</div>" +
          '<div class="ol__end"><span class="t-price">' + fmt(it.p * l.q) + "</span>" +
          '<span class="qty"><button class="qty__btn" type="button" data-dec="' + i + '" aria-label="' + t("listDecrease", { name: it.t }) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button>' +
          '<span class="qty__n">' + l.q + "</span>" +
          '<button class="qty__btn" type="button" data-inc="' + i + '" aria-label="' + t("listIncrease", { name: it.t }) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg></button></span></div></li>';
      }).join("");
    }
    $("#sheet-total").textContent = fmt(totals().sum);
    $("#show-waiter").disabled = !list.length;
    disarmClear();
  }
  function trap(container, e) {
    if (e.key !== "Tab") return;
    var f = $$('button:not([disabled]), a[href], input, [tabindex="0"]', container).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function openSheet() {
    lastFocus = document.activeElement;
    renderSheet();
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    $("#sheet-close").focus();
  }
  function closeSheet() {
    sheet.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && document.contains(lastFocus) && lastFocus.offsetParent !== null) lastFocus.focus();
    else $("#lb-open").focus();
  }
  var clearBtn = $("#clear"), clearTimer = 0;
  function disarmClear() { clearBtn.removeAttribute("data-armed"); clearBtn.textContent = UI.listClear; clearTimeout(clearTimer); }

  /* ───────── Экран официанта ───────── */
  var waiter = $("#waiter");
  function openWaiter() {
    var html = list.map(function (l) {
      var it = ITEMS[l.k], sub = lineLabel(l), ru = "";
      if (DATA.lang !== "ru") ru = '<span class="wl__ru" lang="ru">' + it.ru + (lineLabel(l, "ru") ? ", " + lineLabel(l, "ru") : "") + "</span>";
      return '<li class="wl__item"><span class="wl__qty">' + l.q + " ×</span>" +
        '<span class="wl__name"><span class="wl__title">' + it.t + "</span>" + (sub ? '<span class="wl__sub">' + sub + "</span>" : "") + ru + "</span>" +
        '<span class="wl__price">' + fmt(it.p * l.q) + "</span></li>";
    }).join("");
    $("#w-lines").innerHTML = html;
    $("#w-total").textContent = fmt(totals().sum);
    sheet.hidden = true;
    waiter.hidden = false;
    document.body.style.overflow = "hidden";
    $("#waiter-close").focus();
  }
  function closeWaiter() {
    waiter.hidden = true;
    document.body.style.overflow = "";
    openSheet();
  }

  /* ───────── Навигация и подсветка текущей категории ───────── */
  var tabs = $$(".tab"), chipSets = $$(".chips");
  var cur = { sec: "", cat: "" }, lock = 0;
  function showSection(sec) {
    if (cur.sec === sec) return;
    cur.sec = sec;
    tabs.forEach(function (x) { x.setAttribute("aria-current", String(x.getAttribute("data-sec") === sec)); });
    chipSets.forEach(function (c) { c.hidden = c.getAttribute("data-sec") !== sec; });
    setNavH();
  }
  function markChip(cat) {
    if (cur.cat === cat) return;
    cur.cat = cat;
    $$(".chip").forEach(function (c) {
      var on = c.getAttribute("data-cat") === cat;
      c.setAttribute("aria-current", String(on));
      if (on && !c.parentElement.hidden) {
        var row = c.parentElement;
        row.scrollTo({ left: Math.max(0, c.offsetLeft - row.offsetLeft - 16), behavior: reduce ? "auto" : "smooth" });
      }
    });
  }
  var cats = $$(".cat");
  var ticking = false;
  function spy() {
    ticking = false;
    if (Date.now() - lock < 800 || document.body.classList.contains("is-searching")) return;
    var y = nav.getBoundingClientRect().bottom + 48, c = cats[0];
    cats.forEach(function (x) { if (!x.hidden && x.getBoundingClientRect().top <= y) c = x; });
    if (!c) return;
    showSection(c.getAttribute("data-sec"));
    markChip(c.id);
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });

  /* ───────── Поиск ───────── */
  var searchBtn = $("#search-btn"), search = $("#search"), q = $("#q"), qResult = $("#q-result");
  function norm(s) { return String(s || "").toLowerCase().replace(/ё/g, "е"); }
  var searchY = 0;
  function runSearch() {
    var v = norm(q.value).trim(), found = 0;
    document.body.classList.toggle("is-searching", !!v);
    $$("[data-search]").forEach(function (el) {
      var hit = !v || norm(el.getAttribute("data-search")).indexOf(v) !== -1;
      el.hidden = !hit; if (hit && v) found++;
    });
    $$(".cat").forEach(function (c) { c.hidden = !!v && !$$("[data-search]:not([hidden])", c).length; });
    $$(".sec").forEach(function (s) { s.hidden = !!v && !$$(".cat:not([hidden])", s).length; });
    qResult.textContent = !v ? "" : found ? t("searchFound", { n: found }) : UI.searchEmpty;
    setNavH();
    if (v) window.scrollTo({ top: $(".masthead").offsetHeight, behavior: "instant" });
  }
  function openSearch() {
    searchY = window.scrollY;
    search.hidden = false; searchBtn.setAttribute("aria-expanded", "true");
    setNavH(); q.focus();
  }
  function closeSearch() {
    q.value = ""; runSearch();
    search.hidden = true; searchBtn.setAttribute("aria-expanded", "false");
    setNavH(); window.scrollTo({ top: searchY, behavior: "instant" }); searchBtn.focus();
  }
  searchBtn.addEventListener("click", function () { if (search.hidden) openSearch(); else closeSearch(); });
  q.addEventListener("input", runSearch);

  /* ───────── Один обработчик кликов ───────── */
  document.addEventListener("click", function (e) {
    var el = e.target;
    var b;
    if ((b = el.closest(".seg__opt"))) { applyN(+b.getAttribute("data-n"), true); return; }
    if ((b = el.closest(".portion"))) {
      var dish = b.closest(".dish"), note = $(".dish__note", dish);
      if (note) note.hidden = true;
      selectPortion(dish, b); return;
    }
    if ((b = el.closest(".opt"))) {
      var group = b.closest(".opts");
      $$(".opt", group).forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
      if (group.classList.contains("cook")) {
        var d = b.closest(".dish");
        d.setAttribute("data-cook", b.getAttribute("data-cook"));
        selectPortion(d, $('.portion[aria-pressed="true"]', d));
      } else {
        var item = b.closest(".item"), add = $(".pick .add", item);
        add.setAttribute("data-key", b.getAttribute("data-key"));
        add.setAttribute("data-price", b.getAttribute("data-price"));
        add.setAttribute("data-label", t("addTo", { name: item.getAttribute("data-title") + ", " + b.getAttribute("data-label") + ", " + fmt(+b.getAttribute("data-price")) }));
        syncAdd(add);
      }
      return;
    }
    if ((b = el.closest(".photo-toggle"))) {
      var fig = document.getElementById(b.getAttribute("aria-controls"));
      var open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open)); fig.hidden = !open; return;
    }
    if ((b = el.closest(".add")) && !b.disabled && b.hasAttribute("data-key")) {
      var k = b.getAttribute("data-key");
      addLine(k, b.getAttribute("data-cook") || "");
      var it = ITEMS[k];
      say(t("added", { name: it.t + (it.l ? ", " + it.l : "") }));
      return;
    }
    if ((b = el.closest(".tab"))) {
      e.preventDefault();
      var target = document.getElementById(b.getAttribute("data-first"));
      showSection(b.getAttribute("data-sec")); markChip(target.id); lock = Date.now();
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); return;
    }
    if ((b = el.closest(".chip"))) {
      e.preventDefault();
      var cat = document.getElementById(b.getAttribute("data-cat"));
      markChip(cat.id); lock = Date.now();
      cat.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); return;
    }
    if (el.closest("#search-close")) { closeSearch(); return; }
    if (el.closest("#lb-open")) { openSheet(); return; }
    if (el.closest("#sheet-close") || el.closest(".sheet__scrim")) { closeSheet(); return; }
    if ((b = el.closest("[data-inc]"))) { list[+b.getAttribute("data-inc")].q += 1; save(); renderBar(); renderSheet(); focusQty("data-inc", b); return; }
    if ((b = el.closest("[data-dec]"))) {
      var i = +b.getAttribute("data-dec");
      list[i].q -= 1; if (list[i].q <= 0) list.splice(i, 1);
      save(); renderBar(); renderSheet();
      if (!list.length) { $("#sheet-close").focus(); } else focusQty("data-dec", b);
      return;
    }
    if (el.closest("#clear")) {
      if (clearBtn.hasAttribute("data-armed")) {
        list = []; save(); renderBar(); renderSheet(); say(UI.listCleared); $("#sheet-close").focus();
      } else {
        clearBtn.setAttribute("data-armed", ""); clearBtn.textContent = UI.listClearConfirm;
        clearTimer = setTimeout(disarmClear, 4000);
      }
      return;
    }
    if (el.closest("#show-waiter")) { if (list.length) openWaiter(); return; }
    if (el.closest("#waiter-close")) { closeWaiter(); return; }
  });
  function focusQty(attr, old) {
    var idx = old.getAttribute(attr);
    var nb = $("[" + attr + '="' + idx + '"]', sheet) || $("#sheet-close");
    nb.focus();
  }
  document.addEventListener("keydown", function (e) {
    if (!waiter.hidden) { if (e.key === "Escape") closeWaiter(); else trap(waiter, e); return; }
    if (!sheet.hidden) { if (e.key === "Escape") closeSheet(); else trap(sheet, e); return; }
    if (e.key === "Escape" && !search.hidden) closeSearch();
  });

  renderBar();
  spy();
})();
