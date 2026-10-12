/* Sokoview landing page — renders live market data from /api/landing
   (a Netlify function that reads the Supabase functions market_snapshot()
   and growth_since_jan_2025()). Falls back to /data/fallback.json. */
(function () {
  'use strict';

  // Logos bundled in /logos. Stocks without one show a ticker badge.
  var LOGOS = { DCB: 1, MKCB: 1, NMB: 1, KCB: 1, TTP: 1, MBP: 1 };
  var AMOUNTS = [100000, 500000, 1000000, 5000000];
  var AMOUNT_LABELS = ['100K', '500K', '1M', '5M'];
  var MAX_AMOUNT = 50000000;
  var DEFAULT_STOCK = 'CRDB';

  var $ = function (id) { return document.getElementById(id); };
  var num = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var tzs = function (n) { return 'TZS ' + num(n); };
  var date = function (iso, opts) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', opts); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pctText(p) {
    var a = Math.abs(p).toFixed(2);
    return p > 0 ? '▲ +' + a + '%' : p < 0 ? '▼ −' + a + '%' : '0.00%';
  }

  /* ---------- Theme ---------- */
  var root = document.documentElement;
  function syncThemeButton() {
    var dark = root.getAttribute('data-theme') === 'dark';
    var label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    $('theme-toggle').setAttribute('aria-label', label);
    $('theme-toggle').setAttribute('title', label);
  }
  $('theme-toggle').addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('sv-theme', next); } catch (e) {}
    syncThemeButton();
  });
  syncThemeButton();

  /* ---------- Market strip + movers ---------- */
  function renderMarket(market) {
    if (!market.length) return;
    var closeDate = market[0].trade_date;
    $('strip-label').textContent = 'DSE · ' + date(closeDate, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') + ' close';

    var setA = $('strip-set'), setB = $('strip-copy');
    setA.textContent = ''; setB.textContent = '';
    market.forEach(function (m) {
      [setA, setB].forEach(function (set) {
        var t = el('div', 'tick');
        t.appendChild(el('b', null, m.symbol));
        t.appendChild(el('span', 'p', tzs(m.close)));
        var cls = !m.traded || m.pct_change === 0 ? 'flat' : m.pct_change > 0 ? 'up' : 'down';
        t.appendChild(el('span', 'c ' + cls, m.traded ? pctText(m.pct_change) : 'No trades'));
        set.appendChild(t);
      });
    });

    var traded = market.filter(function (m) { return m.traded; });
    var byPct = traded.slice().sort(function (a, b) { return b.pct_change - a.pct_change; });
    var gainers = byPct.filter(function (m) { return m.pct_change > 0; }).slice(0, 3);
    var losers = byPct.filter(function (m) { return m.pct_change < 0; }).reverse().slice(0, 3);
    function fill(box, list, cls) {
      box.textContent = '';
      if (!list.length) { box.appendChild(el('p', 'small-muted', 'No moves at the last close.')); return; }
      list.forEach(function (m) {
        var row = el('div', 'mover');
        var badge = el('span', 'badge', m.symbol); badge.setAttribute('aria-hidden', 'true');
        var info = el('div', 'info');
        info.appendChild(el('div', 'nm', m.name));
        info.appendChild(el('div', 'pr', tzs(m.close)));
        row.appendChild(badge); row.appendChild(info);
        row.appendChild(el('span', 'pct ' + cls, pctText(m.pct_change)));
        box.appendChild(row);
      });
    }
    fill($('gainers'), gainers, 'up');
    fill($('losers'), losers, 'down');

    var ups = traded.filter(function (m) { return m.pct_change > 0; }).length;
    var downs = traded.filter(function (m) { return m.pct_change < 0; }).length;
    var idle = market.length - traded.length;
    $('movers-breadth').textContent = ups + ' up · ' + (traded.length - ups - downs) + ' unchanged · ' + downs + ' down' + (idle ? ' · ' + idle + ' didn’t trade' : '');
    $('movers-date').textContent = 'Market close · ' + date(closeDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('movers-title').textContent = date(closeDate, { weekday: 'long' }) + ' on the DSE';

    var flats = traded.length - ups - downs;
    var bar = $('breadth-bar').children;
    [ups, flats, downs, idle].forEach(function (n, i) { bar[i].style.flexGrow = n; });
    $('stat-stocks').textContent = market.length;
    startSignal({
      up: ups, flat: flats, down: downs,
      movers: gainers.concat(losers).map(function (m) { return { sym: m.symbol, up: m.pct_change > 0, move: pctText(m.pct_change) }; })
    }, closeDate);
  }

  /* ---------- Hero totem: hand the day's counts and movers to signal.js and print the counts as text ---------- */
  function startSignal(counts, closeDate) {
    var stamp = date(closeDate, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
    var line = $('hero-data');
    line.textContent = stamp + ' close: ';
    [['up', ' rose'], ['flat', ' held'], ['down', ' fell']].forEach(function (part, i) {
      if (i) line.appendChild(document.createTextNode(' · '));
      var span = el('span', null, counts[part[0]] + part[1]);
      span.setAttribute('data-k', part[0]);
      line.appendChild(span);
    });
    // The mood of the day colours the page even where the 3D signal can't run.
    document.documentElement.setAttribute('data-mood', counts.up > counts.down ? 'up' : counts.down > counts.up ? 'down' : 'flat');
    counts.stamp = stamp;
    window.svSignal = counts;
    window.dispatchEvent(new CustomEvent('sv:signal', { detail: counts }));
  }

  /* ---------- Nav gets a hairline once the page scrolls ---------- */
  var nav = $('nav');
  function syncNav() { nav.classList.toggle('stuck', window.scrollY > 8); }
  window.addEventListener('scroll', syncNav, { passive: true });
  syncNav();

  /* ---------- What-if calculator ---------- */
  var calc = { stocks: [], sym: DEFAULT_STOCK, amount: 1000000 };
  var amountInput = $('calc-amount');

  function renderCalc() {
    var g = calc.stocks.filter(function (s) { return s.symbol === calc.sym; })[0] || calc.stocks[0];
    if (!g) return;
    calc.sym = g.symbol;
    var amount = calc.amount;
    var worth = amount * g.latest_close / g.start_close;
    var gain = worth - amount;
    var pct = (g.latest_close / g.start_close - 1) * 100;
    var sign = gain >= 0 ? '+' : '−';
    var short = { day: 'numeric', month: 'short', year: 'numeric' };

    $('calc-name').textContent = g.name;
    $('calc-value').textContent = tzs(worth);
    $('calc-gain').textContent = amount > 0
      ? sign + 'TZS ' + num(Math.abs(gain)) + ' (' + sign + Math.abs(pct).toFixed(1) + '%)'
      : sign + Math.abs(pct).toFixed(1) + '%';
    $('calc-detail').textContent = 'Bought at TZS ' + num(g.start_close) + (g.split ? ' (split-adjusted)' : '') +
      ' on ' + date(g.start_date, short) + '. TZS ' + num(g.latest_close) + ' at the ' + date(g.latest_date, short) + ' close.';
    $('calc-cta').textContent = 'Track ' + g.symbol + ' free';

    Array.prototype.forEach.call($('calc-amounts').children, function (b, i) { b.setAttribute('aria-pressed', String(AMOUNTS[i] === calc.amount)); });
    Array.prototype.forEach.call($('stock-grid').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.sym === calc.sym)); });
  }

  function buildCalc(growth) {
    // Random order, shuffled once per page load so it doesn't read as a ranking.
    var list = growth.slice();
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    calc.stocks = list;

    var chips = $('calc-amounts'); chips.textContent = '';
    AMOUNTS.forEach(function (a, idx) {
      var b = el('button', 'chip press', AMOUNT_LABELS[idx]);
      b.type = 'button';
      b.setAttribute('aria-label', 'TZS ' + num(a));
      b.addEventListener('click', function () { setAmount(a); amountInput.value = num(a); renderCalc(); });
      chips.appendChild(b);
    });

    var grid = $('stock-grid'); grid.textContent = '';
    list.forEach(function (s) {
      var b = el('button', 'tile press');
      b.type = 'button';
      b.dataset.sym = s.symbol;
      b.setAttribute('aria-label', s.name);
      if (LOGOS[s.symbol]) {
        var img = el('img');
        img.src = '/logos/' + s.symbol + '.png';
        img.alt = ''; img.width = 34; img.height = 34; img.loading = 'lazy';
        b.appendChild(img);
      } else {
        var mono = el('span', 'mono', s.symbol.length > 4 ? s.symbol.slice(0, 3) : s.symbol);
        mono.setAttribute('aria-hidden', 'true');
        b.appendChild(mono);
      }
      b.appendChild(el('span', 'sym', s.symbol));
      b.addEventListener('click', function () { calc.sym = s.symbol; renderCalc(); });
      grid.appendChild(b);
    });
    renderCalc();
  }

  /* Open-ended amount: digits only, formatted with commas, capped at 50M. */
  var hint = $('calc-hint');
  var HINT_DEFAULT = hint.textContent;
  function setAmount(n) {
    var capped = Math.min(Math.max(0, Math.floor(n) || 0), MAX_AMOUNT);
    var over = n > MAX_AMOUNT;
    hint.textContent = over ? 'The maximum is TZS 50M' : HINT_DEFAULT;
    hint.classList.toggle('limit', over);
    calc.amount = capped;
    return capped;
  }
  amountInput.addEventListener('input', function () {
    var raw = amountInput.value;
    var caret = amountInput.selectionStart || raw.length;
    var digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length;
    var digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    var n = setAmount(Number(digits || 0));
    var formatted = digits ? num(n) : '';
    amountInput.value = formatted;
    // Keep the caret after the same number of digits once commas are re-inserted.
    var pos = 0, seen = 0;
    while (pos < formatted.length && seen < digitsBeforeCaret) { if (/\d/.test(formatted[pos])) seen++; pos++; }
    try { amountInput.setSelectionRange(pos, pos); } catch (e) {}
    renderCalc();
  });
  amountInput.addEventListener('blur', function () {
    if (!amountInput.value) { setAmount(0); amountInput.value = '0'; renderCalc(); }
  });
  amountInput.addEventListener('focus', function () { if (amountInput.value === '0') amountInput.value = ''; });

  /* ---------- Bond calculator ---------- */
  var bond = $('bond');
  function renderBond() {
    var v = Number(bond.value);
    $('bond-amount').textContent = tzs(v);
    $('bond-year').textContent = tzs(v * 0.125);
    $('bond-half').textContent = tzs(v * 0.0625);
  }
  bond.addEventListener('input', renderBond);
  renderBond();

  /* ---------- Share toggle (example portfolio) ---------- */
  var SHARE = [['CRDB Bank', 1428000, '34%'], ['NMB Bank', 1092000, '26%'], ['Govt bond', 924000, '22%'], ['Tanzania Breweries', 756000, '18%']];
  var sw = $('share-switch');
  function renderShare(animate) {
    var show = sw.getAttribute('aria-checked') === 'true';
    var box = $('share-rows'); box.textContent = '';
    SHARE.forEach(function (r) {
      var row = el('div', 'share-row');
      row.appendChild(el('span', null, r[0]));
      row.appendChild(el('span', animate ? 'val wipe' : 'val', show ? tzs(r[1]) : r[2]));
      box.appendChild(row);
    });
  }
  sw.addEventListener('click', function () {
    sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
    renderShare(true);
  });
  renderShare();

  /* ---------- FAQ ---------- */
  var FAQ = [
    ['Is it really free?', 'Yes. Sokoview is free, with the full portfolio dashboard, stock and bond tracking and performance charts included. No card and no time limit.'],
    ['Which investments can I track?', 'Every equity listed on the DSE plus government bonds, with prices, dividends and historical performance.'],
    ['Does Sokoview connect to my broker?', 'No. You add holdings yourself. There is no broker connection, no automatic trading and no third-party access to your accounts.'],
    ['Is my data private?', 'Your portfolio is private to your account and is never sold or shared. It only becomes public if you publish a share link.'],
    ['Can I delete my account?', 'Yes, at any time from settings, in one step.']
  ];
  var faqBox = $('faq-list');
  FAQ.forEach(function (f, i) {
    var item = el('div', 'faq-item');
    var q = el('button', 'faq-q press');
    q.type = 'button';
    q.setAttribute('aria-expanded', String(i === 0));
    q.setAttribute('aria-controls', 'faq-' + i);
    q.appendChild(el('span', null, f[0]));
    q.insertAdjacentHTML('beforeend', '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>');
    var a = el('div', 'faq-a'); a.id = 'faq-' + i;
    var inner = el('div'); inner.appendChild(el('p', null, f[1])); a.appendChild(inner);
    q.addEventListener('click', function () {
      var open = q.getAttribute('aria-expanded') === 'true';
      Array.prototype.forEach.call(faqBox.querySelectorAll('.faq-q'), function (o) { o.setAttribute('aria-expanded', 'false'); });
      q.setAttribute('aria-expanded', String(!open));
    });
    item.appendChild(q); item.appendChild(a);
    faqBox.appendChild(item);
  });

  /* ---------- Scroll: fade sections in once, light up the statements ---------- */
  var reveals = document.querySelectorAll('.rv, .redact');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    Array.prototype.forEach.call(reveals, function (n) { io.observe(n); });
  } else {
    Array.prototype.forEach.call(reveals, function (n) { n.classList.add('in'); });
  }
  var says = document.querySelectorAll('.say');
  var saysQueued = false;
  function lightSays() {
    saysQueued = false;
    var line = window.innerHeight * 0.62;
    Array.prototype.forEach.call(says, function (n) { n.classList.toggle('on', n.getBoundingClientRect().top < line); });
  }
  window.addEventListener('scroll', function () { if (!saysQueued) { saysQueued = true; requestAnimationFrame(lightSays); } }, { passive: true });
  lightSays();

  /* ---------- Data ---------- */
  function normalise(data) {
    var market = (data.market || []).map(function (m) {
      return { symbol: m.symbol, name: m.name, close: Number(m.close), pct_change: Number(m.pct_change) || 0, traded: m.traded !== false, trade_date: m.trade_date };
    });
    var growth = (data.growth || []).map(function (g) {
      return { symbol: g.symbol, name: g.name, start_date: g.start_date, start_close: Number(g.start_close), latest_date: g.latest_date, latest_close: Number(g.latest_close), split: g.symbol === 'NMB' };
    }).filter(function (g) { return g.latest_close > g.start_close; });
    return { market: market, growth: growth };
  }
  function load(url) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
  load('/api/landing')
    .catch(function (err) { console.warn('Live data unavailable, using fallback:', err); return load('/data/fallback.json'); })
    .then(function (raw) {
      var d = normalise(raw);
      renderMarket(d.market);
      buildCalc(d.growth);
    })
    .catch(function (err) { console.error('Could not load market data', err); });
})();
