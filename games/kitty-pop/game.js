/* Kitty Pop – a gentle match-3 with cat heads.
   Swap two neighbouring cats to line up three or more of the same colour. No move limits, no losing.
   Everything is drawn in code on one canvas; sounds are made with Web Audio (no files).
   Special cats are an optional add-on in specials.js (see the notes there). */
(function () {
  'use strict';

  var INK = '#2A2340';
  var TAU = Math.PI * 2;
  var ROWS = 8, COLS = 7;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function seeded(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, rnd) { rnd = rnd || Math.random; for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ---------- the six cats ----------
     Each colour has its own face detail so they can be told apart without relying on colour. */
  var CATS = [
    { id: 'ginger', name: 'ginger', fill: '#FFA94D', dark: '#E07B1F', inner: '#FFC7A0', line: INK },
    { id: 'pink',   name: 'pink',   fill: '#FF9EC4', dark: '#E8558E', inner: '#FFD3E4', line: INK },
    { id: 'blue',   name: 'blue',   fill: '#7CC4FF', dark: '#3B8FD6', inner: '#CDE8FF', line: INK },
    { id: 'purple', name: 'purple', fill: '#B48CFF', dark: '#7E55D6', inner: '#E2D3FF', line: INK },
    { id: 'black',  name: 'black',  fill: '#4A4160', dark: '#2E2840', inner: '#8E7FA8', line: '#F3EEFF' },
    { id: 'white',  name: 'white',  fill: '#FFFFFF', dark: '#D9D3E6', inner: '#FFC4D6', line: INK }
  ];

  /* Draw one cat head centred on (0,0), about `s` wide. face: open | blink | happy | surprised | yawn.
     fillOverride lets the add-on draw a rainbow cat with the same shape. */
  function drawCat(c, kind, face, s, fillOverride) {
    // the shared cat (shared/cat.js): same head, ears and face as every cat on the site.
    // `s` is this game's cat size; the shared cat's size is its head width (0.88 of that).
    GGCat.draw(c, { preset: GGCat.GAME_ORDER[kind] || 'ginger', face: face, size: s * 0.88, color: fillOverride || undefined, plain: !!fillOverride });
  }

  /* Pre-drawn sprites so the board stays smooth on older tablets. */
  var FACES = ['open', 'blink', 'happy', 'surprised', 'yawn'];
  var sprites = {}, spriteSize = 0;
  function buildSprites(px) {
    px = Math.max(24, Math.round(px));
    if (px === spriteSize) return;
    spriteSize = px;
    sprites = {};
    for (var k = 0; k < CATS.length; k++) {
      for (var f = 0; f < FACES.length; f++) {
        var cv = document.createElement('canvas');
        cv.width = cv.height = Math.ceil(px * 1.15);
        var c = cv.getContext('2d');
        c.translate(cv.width / 2, cv.height / 2 + px * 0.03);
        drawCat(c, k, FACES[f], px);
        sprites[k + ':' + FACES[f]] = cv;
      }
    }
  }
  function catImageURL(kind, face, px) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(px * 1.15);
    var c = cv.getContext('2d');
    c.translate(cv.width / 2, cv.height / 2 + px * 0.03);
    drawCat(c, kind, face || 'open', px);
    return cv.toDataURL('image/png');
  }
  /* Draw a cat at (x, y), `size` wide, using the cached sprite. */
  function blitCat(c, kind, face, x, y, size) {
    var img = sprites[kind + ':' + face];
    if (!img) { c.save(); c.translate(x, y); drawCat(c, kind, face, size); c.restore(); return; }
    var w = size * 1.15;
    c.drawImage(img, x - w / 2, y - w / 2 - size * 0.03, w, w);
  }

  /* ---------- sound (synthesised, soft) ---------- */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null;
    var on = GG.getSetting('sound', true);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function ready() { return ac && on; }
    function env(g, t, a, peak, dec) {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    function noise(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 1;
      if (o.toFreq) f.frequency.exponentialRampToValueAtTime(o.toFreq, t + (o.attack || 0.003) + (o.dur || 0.08));
      var g = ac.createGain(); env(g, t, o.attack || 0.003, o.gain || 0.2, o.dur || 0.08);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t, Math.random()); src.stop(t + (o.attack || 0.003) + (o.dur || 0.08) + 0.05);
    }
    function tone(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var osc = ac.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.005, o.gain || 0.15, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.005) + (o.dur || 0.15) + 0.05);
    }
    var SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
    return {
      init: init, tone: tone, noise: noise,
      isOn: function () { return on; },
      setOn: function (v) { on = v; if (GG.setSetting) GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      /* a soft bubbly pop; each step of a chain goes a note higher */
      pop: function (chain, delay) {
        var f = SCALE[Math.min(SCALE.length - 1, chain)];
        tone({ f: f * 0.6, to: f, dur: 0.1, gain: 0.13, slide: 0.05, delay: delay });
        tone({ f: f * 2, dur: 0.06, gain: 0.025, type: 'triangle', delay: (delay || 0) + 0.02 });
      },
      /* a little purr: low, rumbly noise pulsing a few times */
      purr: function (delay) {
        for (var i = 0; i < 5; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.22, delay: (delay || 0) + i * 0.085 });
      },
      mrrp: function (delay) {
        var p = rand(0.9, 1.2);
        tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1, delay: delay });
        tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', slide: 0.12, delay: (delay || 0) + 0.1 });
      },
      pick: function () { tone({ f: 660, to: 760, dur: 0.06, gain: 0.07, type: 'triangle', slide: 0.04 }); },
      swish: function () { noise({ freq: 1400, toFreq: 2600, q: 0.8, attack: 0.03, dur: 0.1, gain: 0.08 }); },
      nope: function () { tone({ f: 330, to: 260, dur: 0.1, gain: 0.08, type: 'triangle' }); tone({ f: 300, to: 240, dur: 0.1, gain: 0.07, type: 'triangle', delay: 0.12 }); },
      land: function () { noise({ type: 'lowpass', freq: 420, q: 1.2, dur: 0.04, gain: 0.07 }); },
      chime: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 });
          tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' });
        });
      },
      tick: function () { tone({ f: 1400, dur: 0.05, gain: 0.04, type: 'triangle' }); }
    };
  })();

  /* ---------- canvas & layout ---------- */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1, T = 60, BX = 0, BY = 0;

  var sideLayout = window.matchMedia('(min-width: 700px) and (min-aspect-ratio: 1/1)');
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var bottom = ch - 24;
    var panel = $('goalPanel');
    if (sideLayout.matches) {
      // goal card on the left, board on the right, the pair centred together
      var SW = cw >= 1100 ? 240 : 210, GAP = 24;
      var rowBottom = topbar.getBoundingClientRect().bottom + 10;
      var fit = function (top) {
        var availH = bottom - top - 8, availW = cw - SW - GAP - 40;
        T = Math.max(34, Math.floor(Math.min(availW / COLS, availH / ROWS, 96)));
        return { top: top, availH: availH, gx: Math.round((cw - (SW + GAP + T * COLS)) / 2) };
      };
      // use the space beside the corner buttons when there's room, otherwise start below them
      var f = fit(24);
      if (f.gx < 84) f = fit(rowBottom);
      BX = f.gx + SW + GAP;
      BY = Math.round(f.top + Math.max(0, (f.availH - T * ROWS) / 2));
      panel.style.left = f.gx + 'px'; panel.style.top = BY + 'px'; panel.style.width = SW + 'px';
    } else {
      panel.style.left = panel.style.top = panel.style.width = '';
      var top = topbar.getBoundingClientRect().bottom + 10;
      var availW = cw - 24, availH = bottom - top - 4;
      T = Math.max(34, Math.floor(Math.min(availW / COLS, availH / ROWS, 96)));
      BX = Math.round((cw - T * COLS) / 2);
      BY = Math.round(top + Math.max(0, (availH - T * ROWS) / 2));
    }
    buildSprites(T * 0.86 * dpr);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  // the goal panel changes height (new level, fonts loading), so re-place the board whenever the top bar changes size
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(topbar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  function cellCenter(r, c) { return { x: BX + (c + 0.5) * T, y: BY + (r + 0.5) * T }; }
  function cellAt(x, y) {
    var c = Math.floor((x - BX) / T), r = Math.floor((y - BY) / T);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    return { r: r, c: c };
  }

  /* ---------- tiny timing system (driven by the frame loop, so it pauses with the tab) ---------- */
  var tasks = [];
  function wait(sec) { return new Promise(function (res) { tasks.push({ t: 0, dur: sec, fn: null, res: res }); }); }
  function tween(sec, fn) { return new Promise(function (res) { tasks.push({ t: 0, dur: sec, fn: fn, res: res }); }); }
  function until(test) { return new Promise(function (res) { tasks.push({ test: test, res: res }); }); }
  function runTasks(dt) {
    var keep = [];
    var list = tasks; tasks = [];
    for (var i = 0; i < list.length; i++) {
      var k = list[i];
      if (k.test) { if (k.test()) k.res(); else keep.push(k); continue; }
      k.t += dt;
      var p = Math.min(1, k.t / k.dur);
      if (k.fn) k.fn(p);
      if (p >= 1) k.res(); else keep.push(k);
    }
    tasks = keep.concat(tasks);
  }

  /* ---------- particles and things flying to the goals ---------- */
  var parts = [], fliers = [];
  function sparkle(x, y, color, n) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(80, 260) * (T / 70);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: rand(0.35, 0.7), r: rand(2.5, 6) * (T / 70), color: Math.random() < 0.35 ? '#FFFFFF' : color, star: Math.random() < 0.4, spin: rand(-6, 6) });
    }
  }
  function updateParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += 420 * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (var j = fliers.length - 1; j >= 0; j--) {
      var f = fliers[j]; f.t += dt;
      if (f.t >= f.delay + f.dur) { fliers.splice(j, 1); if (f.done) f.done(); }
    }
  }
  function star(c, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath();
  }
  function drawParts(c) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y); c.rotate(p.life * p.spin);
      if (p.star) star(c, p.r * 1.4); else { c.beginPath(); c.arc(0, 0, p.r, 0, TAU); }
      c.fillStyle = p.color; c.fill();
      c.restore();
    }
    for (var j = 0; j < fliers.length; j++) {
      var f = fliers[j];
      if (f.t < f.delay) continue;
      var q = easeInOut((f.t - f.delay) / f.dur);
      var x = lerp(f.x0, f.x1, q), y = lerp(f.y0, f.y1, q) - Math.sin(q * Math.PI) * T * 1.2;
      var s = lerp(T * 0.7, T * 0.4, q);
      blitCat(c, f.kind, 'happy', x, y, s);
    }
  }

  /* ---------- levels ----------
     Gentle ramp: more colours and bigger goals as levels go up. There is no move limit. */
  /* Goal sizes: mixed amounts that grow slowly.
     Levels 1-2: one goal (15, 18). Levels 3-8: two goals (8 & 14 up to 13 & 24).
     Level 9 on: three goals (8, 12, 18), each creeping up to a cap. */
  function goalAmounts(n) {
    if (n <= 2) return [12 + n * 3];
    if (n <= 8) return [8 + (n - 3), 14 + (n - 3) * 2];
    var k = Math.min(n - 9, 12);
    return [8 + k, 12 + k, 18 + Math.round(k * 1.5)];
  }
  function levelDef(n) {
    var rnd = seeded(n * 7919 + 13);
    var colours = n <= 8 ? 5 : 6;
    var amounts = shuffle(goalAmounts(n), rnd);
    var pool = shuffle([0, 1, 2, 3, 4, 5], rnd).slice(0, colours);
    var goals = amounts.map(function (each, i) { return { kind: pool[i], target: each, left: each, shown: each }; });
    return { n: n, colours: pool, goals: goals };
  }

  /* ---------- board ---------- */
  var grid = [];
  var level = null;
  var nextId = 1;
  var busy = false, won = false;
  var selected = null;
  var idle = 0, hintMove = null;
  var pass = 0;

  function newTile(kind, r, c) {
    return { id: nextId++, kind: kind, special: null, r: r, c: c, dr: r, dc: c, vy: 0, falling: false, land: 1, face: 'open', blinkIn: rand(1.5, 7), blinkT: 0, pop: null, born: 1, wig: 0 };
  }
  function get(r, c) { return r >= 0 && c >= 0 && r < ROWS && c < COLS ? grid[r][c] : null; }
  function kindAt(r, c) { var t = get(r, c); return t && !t.pop && t.kind >= 0 ? t.kind : -1; }
  function randomKind() { return level.colours[Math.floor(Math.random() * level.colours.length)]; }

  function fillFresh() {
    for (var tries = 0; tries < 60; tries++) {
      grid = [];
      for (var r = 0; r < ROWS; r++) {
        grid.push([]);
        for (var c = 0; c < COLS; c++) {
          var k, guard = 0;
          do {
            k = randomKind(); guard++;
          } while (guard < 30 && ((c >= 2 && grid[r][c - 1].kind === k && grid[r][c - 2].kind === k) || (r >= 2 && grid[r - 1][c].kind === k && grid[r - 2][c].kind === k)));
          grid[r].push(newTile(k, r, c));
        }
      }
      if (!findGroups().length && findMove()) return;
    }
  }

  /* Runs of 3+ the same colour, joined into groups where they touch (for L and T shapes). */
  function findGroups() {
    var runs = [];
    var r, c, k, len;
    for (r = 0; r < ROWS; r++) {
      c = 0;
      while (c < COLS) {
        k = kindAt(r, c); len = 1;
        while (k >= 0 && c + len < COLS && kindAt(r, c + len) === k) len++;
        if (k >= 0 && len >= 3) { var cells = []; for (var i = 0; i < len; i++) cells.push({ r: r, c: c + i }); runs.push({ dir: 'h', kind: k, cells: cells }); }
        c += len;
      }
    }
    for (c = 0; c < COLS; c++) {
      r = 0;
      while (r < ROWS) {
        k = kindAt(r, c); len = 1;
        while (k >= 0 && r + len < ROWS && kindAt(r + len, c) === k) len++;
        if (k >= 0 && len >= 3) { var cells2 = []; for (var j = 0; j < len; j++) cells2.push({ r: r + j, c: c }); runs.push({ dir: 'v', kind: k, cells: cells2 }); }
        r += len;
      }
    }
    // join runs that share a cell
    var owner = {}, groups = [];
    runs.forEach(function (run) {
      var hit = null;
      run.cells.forEach(function (p) { var g = owner[p.r + ',' + p.c]; if (g && !hit) hit = g; });
      if (!hit) { hit = { kind: run.kind, runs: [], cells: [], keys: {} }; groups.push(hit); }
      hit.runs.push(run);
      run.cells.forEach(function (p) {
        var key = p.r + ',' + p.c;
        if (!hit.keys[key]) { hit.keys[key] = true; hit.cells.push(p); }
        owner[key] = hit;
      });
    });
    return groups;
  }

  /* Would swapping these two make a line of three? (or a special combo, via the add-on) */
  function lineAt(r, c, k) {
    var h = 1, v = 1, i;
    for (i = c - 1; i >= 0 && kindAt(r, i) === k; i--) h++;
    for (i = c + 1; i < COLS && kindAt(r, i) === k; i++) h++;
    for (i = r - 1; i >= 0 && kindAt(i, c) === k; i--) v++;
    for (i = r + 1; i < ROWS && kindAt(i, c) === k; i++) v++;
    return h >= 3 || v >= 3;
  }
  function swapWorks(r1, c1, r2, c2) {
    var a = get(r1, c1), b = get(r2, c2);
    if (!a || !b) return false;
    if (SP && SP.swapActivates(a, b)) return true;
    grid[r1][c1] = b; grid[r2][c2] = a;
    var ok = (b.kind >= 0 && lineAt(r1, c1, b.kind)) || (a.kind >= 0 && lineAt(r2, c2, a.kind));
    grid[r1][c1] = a; grid[r2][c2] = b;
    return ok;
  }
  function findMove() {
    var moves = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (c + 1 < COLS && swapWorks(r, c, r, c + 1)) moves.push([r, c, r, c + 1]);
      if (r + 1 < ROWS && swapWorks(r, c, r + 1, c)) moves.push([r, c, r + 1, c]);
    }
    return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
  }

  /* ---------- the special cats add-on ---------- */
  var SP = window.KittySpecials && window.KittySpecials.enabled ? window.KittySpecials : null;
  if (SP) {
    try {
      SP.setup({
        ROWS: ROWS, COLS: COLS, CATS: CATS,
        get: get, cellCenter: cellCenter,
        tileSize: function () { return T; },
        drawCat: drawCat, blitCat: blitCat,
        sparkle: sparkle, sound: Sound, reduceMotion: reduceMotion,
        coloursInPlay: function () { return level.colours.slice(); },
        countKind: function (k) { var n = 0; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (kindAt(r, c) === k) n++; return n; }
      });
    } catch (e) { SP = null; }
  }

  /* ---------- clearing, falling, refilling ---------- */
  function isSettled() {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var t = grid[r][c]; if (t && (t.pop || t.falling)) return false; }
    return true;
  }

  /* Pop a set of cells. Specials hit along the way set off their own blasts. */
  function clearCells(list, chain) {
    var queue = list.slice();
    var popped = 0, soundAt = {};
    while (queue.length) {
      var item = queue.shift();
      var t = get(item.r, item.c);
      if (!t || t.pop || t.fresh === pass) continue;
      var delay = item.delay || 0;
      t.pop = { t: 0, delay: delay };
      popped++;
      var slot = Math.round(delay * 20);
      if (!soundAt[slot]) { soundAt[slot] = true; Sound.pop(Math.min(7, chain + Math.floor(delay * 8)), delay); }
      if (t.kind >= 0) countGoal(t, delay);
      if (t.special && SP) {
        var more = SP.blast(t, item.r, item.c, delay) || [];
        for (var i = 0; i < more.length; i++) queue.push({ r: more[i].r, c: more[i].c, delay: delay + (more[i].delay || 0) });
      }
    }
    if (popped >= 4 || chain >= 2) Sound.purr(0.15);
    return until(function () {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var t = grid[r][c];
        if (t && t.pop && t.pop.t >= t.pop.delay + 0.32) grid[r][c] = null;
      }
      for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) if (grid[r2][c2] && grid[r2][c2].pop) return false;
      return true;
    });
  }

  /* New cats that drop in usually avoid making a line by themselves, so the player's own swaps do the work.
     Now and then (LUCKY_CHANCE) a lucky chain is allowed, which keeps it fun. */
  var LUCKY_CHANCE = 0.12;
  function refillKind(r, c) {
    if (Math.random() < LUCKY_CHANCE) return randomKind();
    var options = shuffle(level.colours.slice());
    for (var i = 0; i < options.length; i++) if (!lineAt(r, c, options[i])) return options[i];
    return options[0];
  }

  function dropAndRefill() {
    for (var c = 0; c < COLS; c++) {
      var write = ROWS - 1;
      for (var r = ROWS - 1; r >= 0; r--) {
        var t = grid[r][c];
        if (!t) continue;
        if (write !== r) { grid[write][c] = t; grid[r][c] = null; t.r = write; t.falling = true; t.vy = 0; }
        write--;
      }
      var spawn = 0;
      for (var r2 = write; r2 >= 0; r2--) {
        spawn++;
        var n = newTile(refillKind(r2, c), r2, c);
        n.dr = -spawn - 0.15; n.falling = true; n.vy = 0;
        grid[r2][c] = n;
      }
    }
    return until(function () { for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r][c] && grid[r][c].falling) return false; return true; });
  }

  async function resolve(swapped, comboCells) {
    var chain = 0;
    var first = comboCells || null;
    for (var guard = 0; guard < 40; guard++) {
      pass++;
      var groups = findGroups();
      if (!groups.length && !first) break;
      var list = [];
      if (first) { list = first; first = null; }
      // the add-on may turn some matched cells into special cats
      var made = [];
      if (SP && groups.length) { try { made = SP.creations(groups, swapped) || []; } catch (e) { made = []; } }
      var keep = {};
      made.forEach(function (m) {
        var t = get(m.r, m.c);
        if (!t) return;
        keep[m.r + ',' + m.c] = true;
        if (t.kind >= 0 && m.kind !== t.kind) countGoal(t, 0);
        t.kind = m.kind; t.special = m.special; t.dir = m.dir; t.fresh = pass; t.born = 0;
      });
      groups.forEach(function (g) { g.cells.forEach(function (p) { if (!keep[p.r + ',' + p.c]) list.push({ r: p.r, c: p.c, delay: 0 }); }); });
      if (made.length && SP && SP.madeSound) SP.madeSound();
      await clearCells(list, chain);
      await dropAndRefill();
      swapped = null;
      chain++;
    }
    if (!findMove()) await reshuffle();
  }

  async function reshuffle() {
    say('Shuffle!');
    Sound.swish();
    await tween(0.25, function (p) { eachTile(function (t) { t.scale = 1 - easeOut(p); }); });
    var tiles = [];
    eachTile(function (t) { tiles.push(t); });
    for (var tries = 0; tries < 80; tries++) {
      shuffle(tiles);
      var i = 0;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var t = tiles[i++]; grid[r][c] = t; t.r = r; t.c = c; t.dr = r; t.dc = c; }
      if (!findGroups().length && findMove()) break;
      if (tries === 79) { fillFresh(); eachTile(function (t) { t.scale = 0; }); }
    }
    await tween(0.3, function (p) { eachTile(function (t) { t.scale = easeOut(p); }); });
    eachTile(function (t) { t.scale = 1; });
  }

  function eachTile(fn) { for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r][c]) fn(grid[r][c], r, c); }

  /* ---------- goals ---------- */
  var goalEls = [];
  function countGoal(t, delay) {
    if (!level) return;
    for (var i = 0; i < level.goals.length; i++) {
      var g = level.goals[i];
      if (g.kind !== t.kind || g.left <= 0) continue;
      g.left--;
      var p = cellCenter(t.r, t.c);
      var el = goalEls[i] && goalEls[i].img;
      var box = el ? el.getBoundingClientRect() : { left: cw / 2, top: 0, width: 0, height: 0 };
      (function (g, i) {
        fliers.push({ kind: t.kind, x0: p.x, y0: p.y, x1: box.left + box.width / 2, y1: box.top + box.height / 2, t: 0, delay: delay + 0.12 + Math.random() * 0.08, dur: 0.55,
          done: function () { g.shown = Math.max(0, g.shown - 1); renderGoal(i, true); if (g.shown === 0) { Sound.mrrp(); } else Sound.tick(); } });
      })(g, i);
      return;
    }
  }
  function renderGoals() {
    var box = $('goals');
    box.innerHTML = '';
    goalEls = level.goals.map(function (g) {
      var d = document.createElement('div');
      d.className = 'goal';
            var img = document.createElement('img'); img.alt = ''; img.src = catImageURL(g.kind, 'open', 64);
      var info = document.createElement('div'); info.className = 'info';
      info.innerHTML = '<span class="count"><b></b><small>/ ' + g.target + '</small></span><span class="bar"><i></i></span>';
      var b = info.querySelector('b'), bar = info.querySelector('.bar i');
      var tick = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tick.setAttribute('viewBox', '0 0 24 24'); tick.setAttribute('class', 'tick');
      tick.innerHTML = '<path d="M4 13 L10 19 L20 6" fill="none" stroke="#2A2340" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
      d.appendChild(img); d.appendChild(info); d.appendChild(tick);
      box.appendChild(d);
      return { el: d, img: img, b: b, bar: bar };
    });
    level.goals.forEach(function (g, i) { renderGoal(i, false); });
    resize();
  }
  function renderGoal(i, bump) {
    var g = level.goals[i], e = goalEls[i];
    if (!e) return;
    var got = g.target - g.shown;
    e.b.textContent = got;
    e.bar.style.width = (100 * got / g.target) + '%';
    e.el.classList.toggle('done', g.shown <= 0);
    e.el.setAttribute('aria-label', g.shown <= 0 ? 'All ' + g.target + ' ' + CATS[g.kind].name + ' cats popped' : got + ' of ' + g.target + ' ' + CATS[g.kind].name + ' cats popped');
    if (bump && !reduceMotion) { e.el.classList.remove('bump'); void e.el.offsetWidth; e.el.classList.add('bump'); }
  }
  function goalsMet() { return level.goals.every(function (g) { return g.left <= 0; }); }

  /* ---------- speech bubble ---------- */
  var sayTimer = 0;
  function say(text, secs) {
    var el = $('say');
    el.textContent = text;
    el.classList.remove('hide');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { el.classList.add('hide'); }, (secs || 1.6) * 1000);
  }

  /* ---------- playing a turn ---------- */
  async function trySwap(r1, c1, r2, c2) {
    if (busy || won) return;
    var a = get(r1, c1), b = get(r2, c2);
    if (!a || !b) return;
    busy = true; selected = null; idle = 0; hintMove = null; wakeAll();
    Sound.swish();
    await animateSwap(a, b, r1, c1, r2, c2);
    var combo = SP ? SP.onSwap(a, r2, c2, b, r1, c1) : null;
    var works = combo || findGroups().length;
    if (!works) {
      Sound.nope();
      a.wig = b.wig = 0.4;
      await animateSwap(a, b, r2, c2, r1, c1);
      busy = false;
      return;
    }
    await resolve([{ r: r1, c: c1 }, { r: r2, c: c2 }], combo || null);
    busy = false;
    if (goalsMet()) celebrate();
  }

  function animateSwap(a, b, r1, c1, r2, c2) {
    grid[r1][c1] = b; grid[r2][c2] = a;
    a.r = r2; a.c = c2; b.r = r1; b.c = c1;
    return tween(reduceMotion ? 0.08 : 0.17, function (p) {
      var q = easeInOut(p);
      a.dr = lerp(r1, r2, q); a.dc = lerp(c1, c2, q);
      b.dr = lerp(r2, r1, q); b.dc = lerp(c2, c1, q);
      a.lift = b.lift = Math.sin(q * Math.PI);
    }).then(function () { a.lift = b.lift = 0; });
  }

  /* ---------- level flow ---------- */
  function progress() { var p = GG.getProgress('kittypop'); p.level = p.level || 1; return p; }

  /* levels past the free ones need the pass: the last free level replays underneath.
     Uses GG.allows from the new shared layer, or the older GGPass while that's still in place. */
  function passBlocks(n) {
    if (window.GG && typeof GG.allows === 'function') return !GG.allows('kitty-pop', n);
    return !!(window.GGPass && !window.GGPass.allows('kitty-pop', n));
  }
  function lastFreeLevel(n) { while (n > 1 && passBlocks(n)) n--; return n; }
  function showPassLock() {
    if (!window.GGPass || !window.GGPass.lockScreen) return;
    window.GGPass.lockScreen({ title: 'You\u2019ve finished the free levels!', text: 'A grown-up can unlock every Kitty Pop level, and all the other games, for a year.', backLabel: 'Keep playing' });
  }

  function startLevel(n) {
    if (passBlocks(n)) { n = lastFreeLevel(n); showPassLock(); }
    level = levelDef(n);
    won = false; busy = true; selected = null; idle = 0; hintMove = null;
    $('levelLabel').textContent = $('sideLevel').textContent = 'Level ' + n;
    $('win').hidden = true;
    renderGoals();
    fillFresh();
    // cats drop in from the top, column by column
    eachTile(function (t, r, c) { t.dr = r - ROWS - 1 - (COLS - c) * 0.15; t.falling = true; t.vy = 0; });
    until(function () { var any = false; eachTile(function (t) { if (t.falling) any = true; }); return !any; }).then(function () { busy = false; });
    var names = level.goals.map(function (g) { return CATS[g.kind].name; });
    say(level.goals.length === 1 ? 'Pop ' + level.goals[0].target + ' ' + names[0] + ' cats!' : 'Pop the cats at the top!', 2.6);
  }

  async function celebrate() {
    if (won) return;
    won = true;
    await until(function () { return !fliers.length; });
    Sound.chime(); Sound.purr(0.5); buzz(30);
    var p = progress();
    var n = level.n;
    p.level = Math.max(p.level, n + 1);
    p.done = (p.done || 0) + 1;
    GG.setProgress('kittypop', p);
    if (GG.stat) GG.stat('kitty-pop', 'levels', 1);
    // every cat cheers in a wave
    eachTile(function (t) { t.face = 'happy'; t.cheer = -(t.c * 0.07 + t.r * 0.04); });
    for (var i = 0; i < 6; i++) { var q = cellCenter(Math.floor(Math.random() * ROWS), Math.floor(Math.random() * COLS)); sparkle(q.x, q.y, CATS[level.colours[i % level.colours.length]].fill, 10); }
    await wait(1.1);
    $('winNote').textContent = 'Level ' + n + ' done';
    var faces = $('winFaces'); faces.innerHTML = '';
    level.colours.forEach(function (k) { var im = document.createElement('img'); im.alt = ''; im.src = catImageURL(k, 'happy', 64); faces.appendChild(im); });
    $('win').hidden = false;
    $('nextBtn').focus();
  }
  $('nextBtn').addEventListener('click', function () { Sound.init(); Sound.pick(); startLevel(level.n + 1); });

  /* ---------- sleepy cats ---------- */
  var asleep = false;
  function wakeAll() { if (!asleep) return; asleep = false; eachTile(function (t) { t.face = 'surprised'; t.faceT = 0.3; }); }

  /* ---------- input: drag a cat onto a neighbour, or tap one then the other ---------- */
  var down = null;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (down && down.id !== e.pointerId) return;
    idle = 0;
    if (asleep) { wakeAll(); Sound.mrrp(); }
    if (busy || won) return;
    var cell = cellAt(e.clientX, e.clientY);
    if (!cell) { selected = null; return; }
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, cell: cell, moved: false };
    Sound.pick(); buzz(8);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down || down.id !== e.pointerId || down.moved) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    down.dx = dx; down.dy = dy;
    if (Math.hypot(dx, dy) < T * 0.4) return;
    down.moved = true;
    var r = down.cell.r, c = down.cell.c, r2 = r, c2 = c;
    if (Math.abs(dx) > Math.abs(dy)) c2 += dx > 0 ? 1 : -1; else r2 += dy > 0 ? 1 : -1;
    if (r2 < 0 || c2 < 0 || r2 >= ROWS || c2 >= COLS) return;
    trySwap(r, c, r2, c2);
  });
  function release(e) {
    if (!down || down.id !== e.pointerId) return;
    var d = down; down = null;
    if (d.moved || busy || won) return;
    var cell = d.cell;
    if (selected && (selected.r !== cell.r || selected.c !== cell.c) && Math.abs(selected.r - cell.r) + Math.abs(selected.c - cell.c) === 1) {
      var s = selected; selected = null; trySwap(s.r, s.c, cell.r, cell.c);
    } else if (selected && selected.r === cell.r && selected.c === cell.c) {
      selected = null;
    } else {
      selected = cell;
    }
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', function (e) { if (down && down.id === e.pointerId) down = null; });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  /* ---------- sound button ---------- */
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.pick(); });
  renderSound();

  /* ---------- update ---------- */
  var time = 0;
  function update(dt) {
    time += dt;
    runTasks(dt);
    updateParts(dt);
    if (SP && SP.update) SP.update(dt);
    if (!busy && !won && !down) idle += dt;

    // gentle hint: after a few quiet seconds, two cats wiggle to show a swap
    if (!busy && !won && idle > 5 && !asleep) {
      if (!hintMove) hintMove = findMove();
    } else if (busy || idle < 5) hintMove = null;

    // after a long quiet spell the cats doze off; a tap wakes them
    if (!busy && !won && idle > 30 && !asleep) { asleep = true; hintMove = null; }

    var gravity = 38;
    eachTile(function (t) {
      if (t.falling) {
        t.vy += gravity * dt;
        t.dr += t.vy * dt;
        if (t.dr >= t.r) {
          t.dr = t.r; t.falling = false;
          if (t.vy > 4) { t.land = 0; if (landingSoundCooldown <= 0) { Sound.land(); landingSoundCooldown = 0.07; } }
          t.vy = 0;
        }
        t.dc = t.c;
      }
      if (t.land < 1) t.land = Math.min(1, t.land + dt * 3.2);
      if (t.born < 1) t.born = Math.min(1, t.born + dt * 2.5);
      if (t.wig > 0) t.wig = Math.max(0, t.wig - dt);
      if (t.pop) t.pop.t += dt;
      if (t.cheer !== undefined) t.cheer += dt;
      if (t.faceT > 0) { t.faceT -= dt; if (t.faceT <= 0) { t.faceT = 0; t.face = 'open'; } }
      // blinking
      if (!asleep && !won && !t.faceT) {
        t.blinkIn -= dt;
        if (t.blinkIn <= 0) { t.blinkT = 0.14; t.blinkIn = rand(2, 9); }
        if (t.blinkT > 0) t.blinkT -= dt;
      }
    });
    if (landingSoundCooldown > 0) landingSoundCooldown -= dt;
  }
  var landingSoundCooldown = 0;

  /* ---------- drawing ---------- */
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function drawBoard(c) {
    var pad = T * 0.14;
    // cushion
    rr(c, BX - pad, BY - pad + 6, T * COLS + pad * 2, T * ROWS + pad * 2, T * 0.4);
    c.fillStyle = INK; c.fill();
    rr(c, BX - pad, BY - pad, T * COLS + pad * 2, T * ROWS + pad * 2, T * 0.4);
    c.fillStyle = '#FFF8EC'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    // soft checker squares
    for (var r = 0; r < ROWS; r++) for (var col = 0; col < COLS; col++) {
      rr(c, BX + col * T + 2, BY + r * T + 2, T - 4, T - 4, T * 0.22);
      c.fillStyle = (r + col) % 2 ? '#FFE9D6' : '#FFF1E2'; c.fill();
    }
  }

  function tileFace(t) {
    if (t.pop) return 'happy';
    if (asleep) return 'blink';
    if (t.face !== 'open') return t.face;
    if (t.falling && t.vy > 6) return 'surprised';
    if (t.blinkT > 0) return 'blink';
    return 'open';
  }

  function heldInfo() {
    if (!down || down.moved || busy || won) return null;
    var dx = down.dx, dy = down.dy, d = Math.hypot(dx, dy);
    var info = { r: down.cell.r, c: down.cell.c, ox: 0, oy: 0, tr: -1, tc: -1 };
    if (d > T * 0.12) {
      var horiz = Math.abs(dx) > Math.abs(dy);
      var amt = Math.min(d, T * 0.4);
      if (horiz) { info.ox = (dx > 0 ? 1 : -1) * amt; info.tc = down.cell.c + (dx > 0 ? 1 : -1); info.tr = down.cell.r; }
      else { info.oy = (dy > 0 ? 1 : -1) * amt; info.tr = down.cell.r + (dy > 0 ? 1 : -1); info.tc = down.cell.c; }
      if (info.tr < 0 || info.tc < 0 || info.tr >= ROWS || info.tc >= COLS) { info.tr = info.tc = -1; info.ox *= 0.4; info.oy *= 0.4; }
    }
    return info;
  }

  function drawTiles(c) {
    c.save();
    // keep falling cats inside the board
    rr(c, BX - 2, BY - 2, T * COLS + 4, T * ROWS + 4, T * 0.3); c.clip();
    var size = T * 0.86;
    var hint = hintMove && !busy ? hintMove : null;
    var held = heldInfo();
    // light up the square the held cat is heading to
    if (held && held.tr >= 0) {
      var tx = BX + held.tc * T, ty = BY + held.tr * T;
      rr(c, tx + 3, ty + 3, T - 6, T - 6, T * 0.22);
      c.fillStyle = 'rgba(255,201,60,.6)'; c.fill();
      c.lineWidth = 3; c.setLineDash([T * 0.12, T * 0.08]); c.lineDashOffset = -time * 30; c.strokeStyle = '#E8A400'; c.stroke(); c.setLineDash([]);
    }
    var lifted = [], heldTile = null;
    for (var r = 0; r < ROWS; r++) for (var col = 0; col < COLS; col++) {
      var t = grid[r][col];
      if (!t) continue;
      if (held && held.r === r && held.c === col) { heldTile = t; continue; }
      if (t.lift > 0) { lifted.push(t); continue; }
      drawTile(c, t, size, hint);
    }
    lifted.forEach(function (t) { drawTile(c, t, size, hint); });
    if (heldTile) drawTile(c, heldTile, size, null, held);
    c.restore();
  }

  function drawTile(c, t, size, hint, held) {
    var x = BX + (t.dc + 0.5) * T, y = BY + (t.dr + 0.5) * T;
    var sx = 1, sy = 1, rot = 0, alpha = 1;
    // picked up: glow under the cat, a little bigger, nudging along with the finger
    if (held) {
      x += held.ox; y += held.oy;
      c.save(); c.beginPath(); c.arc(x, y, T * 0.58, 0, TAU); c.fillStyle = 'rgba(255,201,60,.6)'; c.fill();
      c.lineWidth = 3; c.strokeStyle = '#E8A400'; c.stroke(); c.restore();
      sx = sy = 1.14;
      c.save(); c.beginPath(); c.ellipse(x, y + T * 0.36, T * 0.32, T * 0.08, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill(); c.restore();
    }
    // landing squash and bounce
    if (t.land < 1 && !reduceMotion) { var k = Math.sin(t.land * Math.PI) * (1 - t.land); sx += k * 0.35; sy -= k * 0.35; y += k * T * 0.08; }
    // a newly made special pops in
    if (t.born < 1) { var b = t.born; sx *= 0.6 + 0.4 * easeOut(b) + Math.sin(b * Math.PI) * 0.25; sy = sx; }
    if (t.scale !== undefined && t.scale !== 1) { sx *= t.scale; sy *= t.scale; }
    if (t.lift > 0) { sx *= 1 + t.lift * 0.15; sy *= 1 + t.lift * 0.15; }
    // selected cat bobs
    if (selected && selected.r === t.r && selected.c === t.c && !t.pop) {
      var bob = Math.sin(time * 8);
      sx *= 1.1 + bob * 0.03; sy *= 1.1 - bob * 0.03;
      c.save(); c.beginPath(); c.arc(x, y, T * 0.47, 0, TAU); c.fillStyle = 'rgba(255,201,60,.55)'; c.fill(); c.restore();
    }
    // hint wiggle
    if (hint && ((hint[0] === t.r && hint[1] === t.c) || (hint[2] === t.r && hint[3] === t.c))) {
      var w = Math.max(0, Math.sin(time * 3)) ;
      rot = Math.sin(time * 22) * 0.12 * w;
      var dirx = hint[3] - hint[1], diry = hint[2] - hint[0];
      var sign = hint[0] === t.r && hint[1] === t.c ? 1 : -1;
      x += dirx * sign * w * T * 0.06; y += diry * sign * w * T * 0.06;
    }
    // "nope" head shake
    if (t.wig > 0) rot += Math.sin(t.wig * 40) * 0.18 * (t.wig / 0.4);
    // celebration hop
    if (t.cheer !== undefined && t.cheer > 0 && !reduceMotion) { y -= Math.abs(Math.sin(t.cheer * 6)) * T * 0.18 * Math.max(0, 1 - t.cheer / 3); }
    // popping: puff up, then shrink away in sparkles
    if (t.pop) {
      var pt = t.pop.t - t.pop.delay;
      if (pt < 0) { /* waiting its turn */ }
      else if (pt < 0.14) { var g = easeOut(pt / 0.14); sx *= 1 + g * 0.22; sy *= 1 + g * 0.22; }
      else {
        if (!t.pop.burst) { t.pop.burst = true; sparkle(x, y, t.kind >= 0 ? CATS[t.kind].fill : '#FFC93C', 9); }
        var s2 = 1 - easeOut((pt - 0.14) / 0.18); sx *= 1.22 * s2; sy *= 1.22 * s2; alpha = s2;
      }
    }
    if (sx <= 0.01) return;
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y); c.rotate(rot); c.scale(sx, sy);
    var face = tileFace(t);
    var handled = t.special && SP ? SP.drawTile(c, t, size, face, time) : false;
    if (!handled) blitCat(c, t.kind, face, 0, 0, size);
    c.restore();
  }

  function drawZzz(c) {
    if (!asleep) return;
    c.save();
    c.font = '800 ' + Math.round(T * 0.4) + 'px "Baloo 2", ui-rounded, sans-serif';
    c.fillStyle = '#6E6080'; c.textAlign = 'center';
    for (var i = 0; i < 3; i++) {
      var ph = (time * 0.5 + i / 3) % 1;
      c.globalAlpha = Math.sin(ph * Math.PI);
      c.fillText(i === 1 ? 'Z' : 'z', BX + T * COLS - T * 0.4 + ph * T * 0.5, BY - T * 0.05 - ph * T * 0.6 + T * 0.4);
    }
    c.restore();
  }

  /* ---------- main loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (level) {
      drawBoard(ctx);
      drawTiles(ctx);
      if (SP && SP.draw) SP.draw(ctx);
      drawParts(ctx);
      drawZzz(ctx);
    }
    requestAnimationFrame(frame);
  }

  resize();
  startLevel(progress().level);
  function recheck() { if (level && passBlocks(level.n)) startLevel(level.n); }
  window.addEventListener('gg-change', recheck);
  window.addEventListener('ggpass', recheck); // older shared code; harmless once it's gone
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  /* test hook for automated checks */
  window.__kitty = {
    grid: function () { return grid.map(function (row) { return row.map(function (t) { return t ? (t.special ? t.special[0].toUpperCase() : t.kind) : '.'; }).join(''); }); },
    busy: function () { return busy; },
    level: function () { return level; },
    move: function () { return findMove(); },
    swap: function (a, b, c, d) { return trySwap(a, b, c, d); },
    cell: cellCenter,
    set: function (r, c, kind, special, dir) { var t = grid[r][c]; t.kind = kind; t.special = special || null; t.dir = dir; },
    win: function () { level.goals.forEach(function (g) { g.left = 0; g.shown = 0; }); celebrate(); },
    start: function (n) { startLevel(n); },
    specials: function () { return !!SP; }
  };
})();
