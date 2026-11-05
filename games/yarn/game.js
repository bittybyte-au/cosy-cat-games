/* Yarn Sort – a cosy cat take on water sort.
   Tubes hold stacks of yarn balls. Tap a tube, then another, to move the yarn on top.
   Yarn can only go onto the same colour or into an empty tube, and all matching balls on top move together.
   A tube that's full of one colour gets a sleepy cat on top. Sort every tube to finish the level.
   Every level is checked by a solver before it's shown, so it can always be solved.
   Undo is unlimited; one extra tube can be added per level. No timers, no fails.
   Everything is drawn in code on one canvas; sounds are made with Web Audio (no files). */
(function () {
  'use strict';

  var INK = '#2A2340';
  var TAU = Math.PI * 2;
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
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  /* The six cats, shared with Kitty Pop (copied so each game stands alone). */
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


  /* ---------- yarn ----------
     Eight colours, each with its own wrap pattern so they can be told apart without relying on colour. */
  var YARN = [
    { name: 'red',    fill: '#FF5A5F', dark: '#C7343A', angle: 0.0 },
    { name: 'orange', fill: '#FF9F43', dark: '#D46F12', angle: 0.6 },
    { name: 'yellow', fill: '#FFD93F', dark: '#C9A20C', angle: -0.6 },
    { name: 'green',  fill: '#5CCB75', dark: '#2E9447', angle: 1.2 },
    { name: 'blue',   fill: '#4D8BFF', dark: '#2459C2', angle: -1.2 },
    { name: 'purple', fill: '#A77BFF', dark: '#6D45C9', angle: 0.3 },
    { name: 'pink',   fill: '#FF8FC8', dark: '#D9539A', angle: -0.3 },
    { name: 'teal',   fill: '#33C9C1', dark: '#168F89', angle: 0.9 }
  ];

  function drawYarn(c, k, r) {
    var Y = YARN[k];
    c.save();
    // loose tail of wool
    c.beginPath(); c.moveTo(r * 0.55, r * 0.7); c.quadraticCurveTo(r * 1.0, r * 0.95, r * 0.85, r * 1.15);
    c.lineWidth = r * 0.16; c.lineCap = 'round'; c.strokeStyle = INK; c.stroke();
    c.lineWidth = r * 0.09; c.strokeStyle = Y.fill; c.stroke();
    // ball
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = Y.fill; c.fill();
    c.save(); c.clip();
    // wraps of wool: a band of curved strands at the colour's own angle, plus a cross band
    c.lineCap = 'round';
    c.strokeStyle = Y.dark; c.lineWidth = r * 0.085;
    c.save(); c.rotate(Y.angle);
    for (var i = -3; i <= 3; i++) { c.beginPath(); c.ellipse(0, i * r * 0.28, r * 1.05, r * 0.32, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
    c.restore();
    c.save(); c.rotate(Y.angle + 1.9); c.globalAlpha = 0.55;
    for (var j = -1; j <= 1; j++) { c.beginPath(); c.ellipse(0, j * r * 0.3, r * 0.95, r * 0.4, 0, 0.15, Math.PI - 0.15); c.stroke(); }
    c.restore();
    // soft highlight
    c.globalAlpha = 0.35; c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-r * 0.35, -r * 0.42, r * 0.32, r * 0.18, -0.6, 0, TAU); c.fill();
    c.restore();
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.lineWidth = Math.max(2, r * 0.1); c.strokeStyle = INK; c.stroke();
    c.restore();
  }

  var yarnSprites = [], yarnPx = 0, catSprites = {}, catPx = 0;
  function makeSprite(px, fn) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(px * 1.5);
    var c = cv.getContext('2d');
    c.translate(cv.width / 2, cv.height / 2);
    fn(c);
    return cv;
  }
  function buildSprites(r, catS) {
    r = Math.max(8, Math.round(r));
    if (r !== yarnPx) { yarnPx = r; yarnSprites = YARN.map(function (y, k) { return makeSprite(r * 2, function (c) { drawYarn(c, k, r); }); }); }
    catS = Math.max(16, Math.round(catS));
    if (catS !== catPx) {
      catPx = catS; catSprites = {};
      for (var k = 0; k < CATS.length; k++) ['blink', 'happy', 'open'].forEach(function (f) { catSprites[k + ':' + f] = makeSprite(catS, function (c) { drawCat(c, k, f, catS); }); });
    }
  }
  function blitYarn(c, k, x, y, r) { var img = yarnSprites[k]; if (img) { var w = r * 3; c.drawImage(img, x - w / 2, y - w / 2, w, w); } }
  function blitCat(c, k, face, x, y, s) { var img = catSprites[k + ':' + face]; if (img) { var w = s * 1.5; c.drawImage(img, x - w / 2, y - w / 2, w, w); } }
  function catImageURL(kind, face, px) { return makeSprite(px, function (c) { drawCat(c, kind, face || 'open', px); }).toDataURL('image/png'); }

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
    var SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99];
    return {
      init: init,
      isOn: function () { return on; },
      setOn: function (v) { on = v; if (GG.setSetting) GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      lift: function () { tone({ f: 520, to: 700, dur: 0.07, gain: 0.07, type: 'triangle', slide: 0.05 }); },
      /* soft woolly thump, each ball in a group a note higher */
      land: function (i, delay) {
        var f = SCALE[Math.min(SCALE.length - 1, i)];
        tone({ f: f * 0.75, to: f, dur: 0.1, gain: 0.11, slide: 0.04, delay: delay });
        noise({ type: 'lowpass', freq: 500, dur: 0.05, gain: 0.07, delay: delay });
      },
      drop: function () { tone({ f: 600, to: 480, dur: 0.07, gain: 0.05, type: 'triangle' }); },
      nope: function () { tone({ f: 330, to: 260, dur: 0.1, gain: 0.08, type: 'triangle' }); tone({ f: 300, to: 240, dur: 0.1, gain: 0.07, type: 'triangle', delay: 0.12 }); },
      purr: function (delay) { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.22, delay: (delay || 0) + i * 0.085 }); },
      mrrp: function (delay) {
        var p = rand(0.9, 1.2);
        tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1, delay: delay });
        tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', slide: 0.12, delay: (delay || 0) + 0.1 });
      },
      undo: function () { tone({ f: 700, to: 450, dur: 0.1, gain: 0.07, type: 'triangle' }); },
      pop: function () { tone({ f: 420, to: 920, dur: 0.11, gain: 0.14, slide: 0.06 }); },
      chime: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 });
          tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' });
        });
      }
    };
  })();

  /* ---------- rules (shared by the game and the solver) ---------- */
  var CAP = 4;
  function topRun(t) { if (!t.length) return 0; var k = t[t.length - 1], n = 0; for (var i = t.length - 1; i >= 0 && t[i] === k; i--) n++; return n; }
  function isDone(t, cap) { return t.length === cap && topRun(t) === cap; }
  function canMove(tubes, a, b, cap) {
    if (a === b) return 0;
    var A = tubes[a], B = tubes[b];
    if (!A.length || B.length >= cap || isDone(A, cap)) return 0;
    if (B.length && B[B.length - 1] !== A[A.length - 1]) return 0;
    return Math.min(topRun(A), cap - B.length);
  }
  function solvedAll(tubes, cap) { return tubes.every(function (t) { return !t.length || isDone(t, cap); }); }

  /* Depth-first search with memory. Returns the list of moves, or null if it can't find one in time. */
  function solve(start, cap, limit) {
    var seen = {}, nodes = 0;
    function key(ts) { return ts.map(function (t) { return t.join(','); }).sort().join('|'); }
    var path = [];
    function dfs(ts) {
      if (solvedAll(ts, cap)) return true;
      if (++nodes > limit) return false;
      var k = key(ts);
      if (seen[k]) return false;
      seen[k] = true;
      var moves = [];
      for (var a = 0; a < ts.length; a++) {
        var A = ts[a];
        if (!A.length) continue;
        var uniform = topRun(A) === A.length;
        for (var b = 0; b < ts.length; b++) {
          var n = canMove(ts, a, b, cap);
          if (!n) continue;
          if (uniform && !ts[b].length) continue; // moving a one-colour tube into an empty one gets nowhere
          // prefer moves that complete or extend a tube
          var score = ts[b].length ? ts[b].length + (n === topRun(A) ? 2 : 0) : -1;
          moves.push([score, a, b, n]);
        }
      }
      moves.sort(function (x, y) { return y[0] - x[0]; });
      for (var i = 0; i < moves.length; i++) {
        var m = moves[i];
        var next = ts.map(function (t) { return t.slice(); });
        for (var j = 0; j < m[3]; j++) next[m[2]].push(next[m[1]].pop());
        path.push([m[1], m[2]]);
        if (dfs(next)) return true;
        path.pop();
        if (nodes > limit) return false;
      }
      return false;
    }
    var ok = dfs(start.map(function (t) { return t.slice(); }));
    return ok ? path.slice() : null;
  }

  /* ---------- levels ---------- */
  function levelDef(n) {
    var colours = n <= 1 ? 3 : n <= 3 ? 4 : n <= 6 ? 5 : n <= 10 ? 6 : n <= 15 ? 7 : 8;
    return { n: n, colours: colours, empties: 2, cap: 4 };
  }
  /* Deal a puzzle for level n: shuffle the yarn into tubes, then keep only deals the solver can finish
     and that aren't too easy (no tube starts finished, and it takes a fair number of moves). */
  function makePuzzle(def) {
    for (var attempt = 0; attempt < 400; attempt++) {
      var rnd = seeded(def.n * 7907 + attempt * 131 + 17);
      var pick = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rnd).slice(0, def.colours);
      var balls = [];
      pick.forEach(function (k) { for (var i = 0; i < def.cap; i++) balls.push(k); });
      shuffle(balls, rnd);
      var tubes = [];
      for (var t = 0; t < def.colours; t++) tubes.push(balls.slice(t * def.cap, (t + 1) * def.cap));
      for (var e = 0; e < def.empties; e++) tubes.push([]);
      if (tubes.some(function (tb) { return topRun(tb) >= 3; })) continue;
      var sol = solve(tubes, def.cap, 30000);
      if (!sol) continue;
      if (sol.length < def.colours * 2) continue;
      return tubes;
    }
    return tubes;
  }

  /* ---------- layout ---------- */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var topbar = $('topbar'), bottombar = $('bottombar');
  var cw = 0, ch = 0, dpr = 1;
  var L = { r: 20, tubeW: 50, tubeH: 200, pos: [] };

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var n = tubes.length || 5, cap = level ? level.cap : 4;
    var top = topbar.getBoundingClientRect().bottom + 10;
    var bottom = bottombar.getBoundingClientRect().top - 10;
    var availW = Math.min(cw - 20, 1000), availH = bottom - top;
    // try one row, then two, then three; keep whichever gives the biggest yarn
    var best = null;
    for (var rows = 1; rows <= 3; rows++) {
      var perRow = Math.ceil(n / rows);
      // tube width w, ball radius ~0.4w, tube height ~ (cap * 0.82 + 1.0) * w, plus room above for the lifted yarn
      var w = Math.min(availW / (perRow * 1.32), 92);
      var tubeH = function (w) { return w * (cap * 0.84 + 0.55); };
      var rowH = function (w) { return tubeH(w) + w * 1.25; };
      if (rows * rowH(w) > availH) w = availH / (rows * (cap * 0.84 + 0.55 + 1.25));
      if (!best || w > best.w + 0.5) best = { w: w, rows: rows, perRow: perRow };
    }
    var w = Math.max(30, best.w);
    L.tubeW = w; L.r = w * 0.4; L.tubeH = w * (cap * 0.84 + 0.55);
    var rowH = L.tubeH + w * 1.25;
    var blockH = best.rows * rowH;
    var y0 = top + Math.max(0, (availH - blockH) / 2) + w * 1.05;
    L.pos = [];
    var idx = 0;
    for (var r = 0; r < best.rows; r++) {
      var inRow = Math.min(best.perRow, n - idx);
      var gap = w * 0.32;
      var rowW = inRow * w + (inRow - 1) * gap;
      for (var i = 0; i < inRow; i++) {
        L.pos.push({ x: (cw - rowW) / 2 + w / 2 + i * (w + gap), y: y0 + r * rowH });
        idx++;
      }
    }
    buildSprites(L.r * dpr, w * 0.95 * dpr);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(bottombar); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  // where a ball sits: slot 0 is the bottom of the tube
  /* A tube being dragged is drawn away from its home spot by this much. */
  var drag = null;   // { t, ox, oy, target, back }
  function off(t) { return drag && drag.t === t ? { x: drag.ox, y: drag.oy } : { x: 0, y: 0 }; }
  function slotXY(t, s) {
    var p = L.pos[t], o = off(t);
    return { x: p.x + o.x, y: p.y + o.y + L.tubeH - L.tubeW * 0.48 - s * L.tubeW * 0.84 };
  }
  function liftXY(t, i) {
    if (drag && drag.t === t && drag.target >= 0) {
      var tp = L.pos[drag.target];
      return { x: tp.x + drag.side * L.tubeW * 0.15 * (1 + i * 0.5), y: tp.y - L.tubeW * 0.35 - i * L.tubeW * 0.2 };
    }
    var p = L.pos[t], o = off(t);
    return { x: p.x + o.x, y: p.y + o.y - L.tubeW * 0.5 - i * L.tubeW * 0.25 };
  }

  /* ---------- state ---------- */
  var level = null;
  var tubes = [];          // arrays of colour numbers, bottom first
  var balls = [];          // matching arrays of ball objects (for animation)
  var history = [];
  var selected = -1;
  var busy = false, won = false;
  var extraUsed = false;
  var flying = [];
  var parts = [];
  var doneCats = {};       // tube index -> { kind, t }
  var time = 0, idle = 0;
  var hint = null;
  var shakeT = {};
  var nextId = 1;

  function snapshot() { return { tubes: tubes.map(function (t) { return t.slice(); }), extra: extraUsed }; }
  function rebuildBalls() {
    balls = tubes.map(function (t) { return t.map(function (k) { return { id: nextId++, k: k, land: 1 }; }); });
  }
  function refreshDone(animate) {
    var was = doneCats; doneCats = {};
    tubes.forEach(function (t, i) {
      if (isDone(t, level.cap)) doneCats[i] = was[i] && was[i].k === t[0] ? was[i] : { kind: catFor(t[0]), t: animate ? 0 : 1, k: t[0] };
    });
  }
  function catFor(k) { return [0, 1, 4, 2, 3, 5, 1, 2][k] % CATS.length; }

  function renderButtons() {
    $('undoBtn').disabled = !history.length || busy || won;
    $('extraBtn').disabled = extraUsed || won;
    $('restartBtn').disabled = busy || won;
  }

  /* ---------- speech bubble ---------- */
  var sayTimer = 0;
  function say(text, secs) {
    var el = $('say');
    el.textContent = text;
    el.classList.remove('hide');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { el.classList.add('hide'); }, (secs || 1.6) * 1000);
  }

  /* ---------- level flow ---------- */
  function progress() { var p = GG.getProgress('yarn'); p.level = p.level || 1; return p; }

  function startLevel(n) {
    level = levelDef(n);
    tubes = makePuzzle(level);
    level.start = tubes.map(function (t) { return t.slice(); });
    reset();
    $('levelLabel').textContent = 'Level ' + n;
    if (n === 1) say('Tap a tube, then another, to move the yarn!', 2.8);
  }
  function reset() {
    tubes = level.start.map(function (t) { return t.slice(); });
    history = []; selected = -1; drag = null; busy = false; won = false; extraUsed = false; flying = []; doneCats = {}; hint = null; idle = 0;
    rebuildBalls();
    $('cardWrap').hidden = true;
    clearNudge();
    layout();
    refreshDone(false);
    renderButtons();
  }

  function celebrate() {
    won = true;
    renderButtons();
    var p = progress();
    p.level = Math.max(p.level, level.n + 1);
    p.done = (p.done || 0) + 1;
    GG.setProgress('yarn', p);
    if (GG.stat) GG.stat('yarn', 'levels', 1);
    Sound.chime(); Sound.purr(0.45); buzz(30);
    Object.keys(doneCats).forEach(function (i) { var q = L.pos[i]; sparkle(q.x, q.y, '#FFE58A', 10); });
    setTimeout(function () {
      $('cardNote').textContent = 'Level ' + level.n + ' done';
      var faces = $('cardFaces'); faces.innerHTML = '';
      [0, 4, 1, 3].forEach(function (k) { var im = document.createElement('img'); im.alt = ''; im.src = catImageURL(k, 'happy', 64); faces.appendChild(im); });
      $('cardWrap').hidden = false;
      $('nextBtn').focus();
    }, 1200);
  }
  $('nextBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); startLevel(level.n + 1); });

  /* ---------- moving yarn ---------- */
  function tryMove(a, b) {
    var n = canMove(tubes, a, b, level.cap);
    if (!n) {
      shakeT[b] = 0.4; Sound.nope();
      if (tubes[b].length >= level.cap) say('That tube is full', 1.2);
      else if (tubes[b].length) say('Only on the same colour', 1.2);
      selected = -1;
      return;
    }
    history.push(snapshot());
    busy = true; selected = -1; hint = null; idle = 0;
    clearNudge();
    renderButtons();
    for (var i = 0; i < n; i++) {
      var ball = balls[a].pop(); var k = tubes[a].pop();
      var from = liftXY(a, n - 1 - i);
      tubes[b].push(k); balls[b].push(ball);
      var to = slotXY(b, tubes[b].length - 1);
      ball.hidden = true;
      flying.push({ ball: ball, k: k, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: -i * 0.07, dur: reduceMotion ? 0.12 : 0.34, i: i, tube: b });
    }
  }
  function afterMove(b) {
    busy = false;
    var wasDone = !!doneCats[b];
    refreshDone(true);
    if (!wasDone && doneCats[b]) {
      var q = L.pos[b];
      Sound.purr(0.05); Sound.mrrp(0.25);
      sparkle(q.x, q.y + L.tubeH * 0.3, YARN[tubes[b][0]].fill, 14);
    }
    renderButtons();
    if (solvedAll(tubes, level.cap)) { celebrate(); return; }
    if (!anyMove()) nudge();
  }
  function anyMove() {
    for (var a = 0; a < tubes.length; a++) for (var b = 0; b < tubes.length; b++) {
      if (!canMove(tubes, a, b, level.cap)) continue;
      // moving a one-colour stack into an empty tube doesn't really help
      if (topRun(tubes[a]) === tubes[a].length && !tubes[b].length) continue;
      return true;
    }
    return false;
  }
  function nudge() {
    say(extraUsed ? 'Stuck? Try Undo!' : 'Stuck? Try Undo or an extra tube!', 2.4);
    $('undoBtn').classList.add('nudge');
    if (!extraUsed) $('extraBtn').classList.add('nudge');
  }
  function clearNudge() { $('undoBtn').classList.remove('nudge'); $('extraBtn').classList.remove('nudge'); }

  /* ---------- buttons ---------- */
  $('undoBtn').addEventListener('click', function () {
    Sound.init();
    if (!history.length || busy || won) return;
    var s = history.pop();
    tubes = s.tubes; extraUsed = s.extra; drag = null;
    rebuildBalls(); selected = -1; hint = null; idle = 0;
    clearNudge(); layout(); refreshDone(false); renderButtons();
    Sound.undo();
  });
  $('restartBtn').addEventListener('click', function () {
    Sound.init();
    if (busy || won) return;
    Sound.undo();
    reset();
  });
  $('extraBtn').addEventListener('click', function () {
    Sound.init();
    if (extraUsed || won || busy) return;
    history.push(snapshot());
    extraUsed = true;
    tubes.push([]); balls.push([]);
    clearNudge(); layout(); renderButtons();
    var q = L.pos[tubes.length - 1]; sparkle(q.x, q.y + L.tubeH / 2, '#7BD389', 12);
    Sound.pop();
  });

  /* ---------- input: tap a tube then another, or drag from one tube to another ---------- */
  function tubeAt(x, y) {
    var best = -1, bd = Infinity;
    for (var i = 0; i < L.pos.length && i < tubes.length; i++) {
      var p = L.pos[i];
      var padX = L.tubeW * 0.45, top = p.y - L.tubeW * 1.0, bot = p.y + L.tubeH + L.tubeW * 0.3;
      if (x < p.x - L.tubeW / 2 - padX || x > p.x + L.tubeW / 2 + padX || y < top || y > bot) continue;
      var d = Math.abs(x - p.x);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  var down = null;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (down || busy || won) return;
    idle = 0; hint = null;
    var t = tubeAt(e.clientX, e.clientY);
    down = { id: e.pointerId, t: t, x: e.clientX, y: e.clientY, wasSelected: selected, dragging: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    if (t < 0) { if (selected >= 0) { selected = -1; Sound.drop(); } return; }
    if (selected < 0) {
      if (tubes[t].length && !doneCats[t]) { selected = t; Sound.lift(); }
      else if (doneCats[t]) { Sound.mrrp(); shakeT[t] = 0.25; }
    }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down || down.id !== e.pointerId || busy || won) return;
    // pressing on the lifted tube and moving picks the whole tube up
    if (!down.dragging) {
      if (selected < 0 || down.t !== selected) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) return;
      down.dragging = true;
      drag = { t: selected, ox: 0, oy: 0, fx: 0, fy: 0, tilt: 0, target: -1, back: false };
    }
    drag.fx = e.clientX - down.x; drag.fy = e.clientY - down.y;
    if (reduceMotion) { drag.ox = drag.fx; drag.oy = drag.fy; }
    drag.side = 1;
    // the tube under the finger (ignoring the one being carried) is where it would pour
    var hit = -1, bd = Infinity;
    for (var i = 0; i < tubes.length; i++) {
      if (i === drag.t || !L.pos[i]) continue;
      var p = L.pos[i];
      var cx = p.x, cy = p.y + L.tubeH / 2;
      var d = Math.hypot((e.clientX - cx) / (L.tubeW * 1.1), (e.clientY - cy) / (L.tubeH * 0.75));
      if (d < 1 && d < bd) { bd = d; hit = i; }
    }
    if (hit !== drag.target && hit >= 0) Sound.lift();
    drag.target = hit;
    if (hit >= 0) drag.side = e.clientX < L.pos[hit].x ? -1 : 1;
  });
  canvas.addEventListener('pointerup', function (e) {
    if (!down || down.id !== e.pointerId) return;
    var d = down; down = null;
    if (busy || won) return;
    if (d.dragging && drag) {
      var target = drag.target, from = drag.t;
      if (target >= 0) tryMove(from, target);
      else { selected = -1; Sound.drop(); }
      if (drag) { drag.back = true; drag.target = -1; }
      return;
    }
    var t = tubeAt(e.clientX, e.clientY);
    var moved = Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14;
    if (d.wasSelected >= 0) {
      // second tap: move to this tube, or put it back if it's the same tube
      if (t < 0 || t === d.wasSelected) { selected = -1; Sound.drop(); return; }
      tryMove(d.wasSelected, t);
      return;
    }
    // drag from one tube to another
    if (moved && selected >= 0 && t >= 0 && t !== selected) tryMove(selected, t);
  });
  canvas.addEventListener('pointercancel', function () { down = null; if (drag) { drag.back = true; drag.target = -1; selected = -1; } });
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
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.pop(); });
  renderSound();

  /* ---------- particles ---------- */
  function sparkle(x, y, color, n) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(80, 240) * (L.tubeW / 60);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: rand(0.4, 0.75), r: rand(2.5, 5.5) * (L.tubeW / 60), color: Math.random() < 0.35 ? '#FFFFFF' : color, star: Math.random() < 0.45, spin: rand(-6, 6) });
    }
  }
  function star(c, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    c.closePath();
  }

  /* ---------- update ---------- */
  function update(dt) {
    time += dt;
    if (!busy && !won && selected < 0 && !down) idle += dt;
    // a gentle hint after a quiet spell: the solver's next move glows
    if (!busy && !won && idle > 9 && !hint) {
      var sol = solve(tubes, level.cap, 6000);
      hint = sol && sol.length ? { a: sol[0][0], b: sol[0][1] } : { none: true };
    }
    for (var i = flying.length - 1; i >= 0; i--) {
      var f = flying[i];
      f.t += dt;
      if (f.t >= f.dur) {
        flying.splice(i, 1);
        f.ball.hidden = false; f.ball.land = 0;
        Sound.land(f.i);
        if (!flying.length) afterMove(f.tube);
      }
    }
    tubes.forEach(function (t, i) {
      (balls[i] || []).forEach(function (b) { if (b.land < 1) b.land = Math.min(1, b.land + dt * 4); });
      if (shakeT[i] > 0) shakeT[i] = Math.max(0, shakeT[i] - dt);
      if (drag && !drag.back && drag.t === i) {
        // follow the finger; over a tube, hop up beside it and lean in as if pouring
        var gx = drag.fx, gy = drag.fy, gt = 0;
        if (drag.target >= 0) {
          // tip the tube so its open top sits just above the target's mouth, body off to one side
          var tp = L.pos[drag.target], sp = L.pos[i];
          gt = -drag.side * 0.75;
          var mx = tp.x + drag.side * L.tubeW * 0.15, my = tp.y - L.tubeW * 0.5;
          var hh = L.tubeH / 2;
          var cx = mx - hh * Math.sin(gt), cy = my + hh * Math.cos(gt);
          gx = cx - sp.x; gy = cy - (sp.y + hh);
        } else gt = clamp(drag.fx / (L.tubeW * 8), -0.18, 0.18);
        var kk = Math.min(1, dt * 18);
        drag.ox = lerp(drag.ox, gx, kk); drag.oy = lerp(drag.oy, gy, kk); drag.tilt = lerp(drag.tilt, gt, kk);
      }
      if (drag && drag.back && drag.t === i) {
        drag.tilt = lerp(drag.tilt, 0, Math.min(1, dt * 14));
        var k = Math.min(1, dt * 14);
        drag.ox = lerp(drag.ox, 0, k); drag.oy = lerp(drag.oy, 0, k);
        if (Math.abs(drag.ox) < 0.5 && Math.abs(drag.oy) < 0.5) drag = null;
      }
      if (doneCats[i] && doneCats[i].t < 1) doneCats[i].t = Math.min(1, doneCats[i].t + dt * 2.2);
    });
    for (var j = parts.length - 1; j >= 0; j--) {
      var p = parts[j]; p.life += dt;
      if (p.life >= p.max) { parts.splice(j, 1); continue; }
      p.vy += 420 * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  /* ---------- drawing ---------- */
  function drawTube(c, i) {
    var p = L.pos[i]; if (!p) return;
    var w = L.tubeW, h = L.tubeH;
    var sx = shakeT[i] > 0 ? Math.sin(shakeT[i] * 45) * w * 0.08 * (shakeT[i] / 0.4) : 0;
    var o = off(i);
    var x = p.x - w / 2 + sx + o.x, y = p.y + o.y;
    var isHint = hint && !hint.none && (hint.a === i || hint.b === i);
    // a tube that a carried tube is hovering over: green if the yarn can go there
    if (drag && !drag.back && drag.target === i) {
      var okMove = canMove(tubes, drag.t, i, level.cap) > 0;
      c.save(); c.globalAlpha = 0.75;
      rr(c, x - 8, y - 8, w + 16, h + 16, w * 0.6); c.fillStyle = okMove ? '#9BE8A8' : 'rgba(255,255,255,.6)'; c.fill();
      c.restore();
    }
    var carried = drag && drag.t === i && !drag.back;
    if (carried) {
      // lean a little in the direction it's being carried, around the tube's middle
      c.save();
      var tilt = drag.tilt;
      c.translate(x + w / 2, y + h / 2); c.rotate(tilt); c.translate(-(x + w / 2), -(y + h / 2));
    }
    // glow for selection and hints
    if (selected === i || isHint) {
      c.save();
      c.globalAlpha = selected === i ? 0.7 : 0.35 + Math.sin(time * 5) * 0.25;
      rr(c, x - 7, y - 7, w + 14, h + 14, w * 0.6); c.fillStyle = selected === i ? '#FFD84D' : '#FFFFFF'; c.fill();
      c.restore();
    }
    // shadow and glass
    rr(c, x, y + 5, w, h, w / 2); c.fillStyle = 'rgba(42,35,64,.25)'; c.fill();
    rr(c, x, y, w, h, w / 2); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    // a little woven rim at the top
    c.save(); rr(c, x - w * 0.08, y - w * 0.06, w * 1.16, w * 0.28, w * 0.14); c.fillStyle = '#E6B98A'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.restore();
    // yarn inside
    var bs = balls[i] || [];
    for (var s = 0; s < bs.length; s++) {
      var b = bs[s];
      if (b.hidden) continue;
      if (selected === i && !(drag && drag.t === i) && s >= bs.length - topRun(tubes[i])) continue; // lifted ones are drawn above
      var q = slotXY(i, s);
      var sq = b.land < 1 && !reduceMotion ? Math.sin(b.land * Math.PI) * (1 - b.land) * 0.16 : 0;
      c.save(); c.translate(q.x + sx, q.y + sq * L.r * 0.4); c.scale(1 + sq, 1 - sq);
      blitYarn(c, b.k, 0, 0, L.r);
      c.restore();
    }
    // glass outline and shine on top of the yarn
    rr(c, x, y, w, h, w / 2); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
    c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#fff'; c.lineWidth = w * 0.08; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + w * 0.22, y + w * 0.5); c.lineTo(x + w * 0.22, y + h - w * 0.6); c.stroke(); c.restore();
    // the rim drawn again over the glass edge
    rr(c, x - w * 0.08, y - w * 0.06, w * 1.16, w * 0.28, w * 0.14); c.fillStyle = '#E6B98A'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    // a finished tube gets a sleepy cat peeking over the top
    var dc = doneCats[i];
    if (dc) {
      var pop = reduceMotion ? 1 : easeOut(dc.t) + Math.sin(dc.t * Math.PI) * 0.15;
      var cs = w * 0.95;
      var cy = y - cs * 0.22 * pop + cs * 0.15 * (1 - pop);
      c.save();
      c.beginPath(); c.rect(x - w, y - cs * 1.2, w * 3, cs * 1.25 + w * 0.05); c.clip();
      var face = won ? 'happy' : (Math.sin(time * 0.9 + i * 1.7) > 0.93 ? 'open' : 'blink');
      c.translate(p.x + sx, cy + Math.sin(time * 1.5 + i) * w * 0.02);
      c.scale(pop, pop);
      blitCat(c, dc.kind, face, 0, 0, cs);
      c.restore();
      // paws on the rim
      c.save(); c.globalAlpha = pop;
      [-1, 1].forEach(function (d) {
        c.beginPath(); c.ellipse(p.x + sx + d * w * 0.24, y + w * 0.02, w * 0.14, w * 0.1, 0, 0, TAU);
        c.fillStyle = CATS[dc.kind].fill; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
      });
      c.restore();
    }
    if (carried) c.restore();
  }

  function drawLifted(c) {
    if (selected < 0 || (drag && drag.t === selected)) return;
    var t = tubes[selected], bs = balls[selected];
    var n = topRun(t);
    // the lifted group hovers above the tube; the top ball of the stack sits highest
    for (var j = 0; j < n; j++) {
      var b = bs[bs.length - n + j];
      var q = liftXY(selected, j);
      var bob = Math.sin(time * 6 + j * 0.6) * L.r * 0.08;
      blitYarn(c, b.k, q.x, q.y + bob, L.r * 1.05);
    }
  }

  function drawFlying(c) {
    flying.forEach(function (f) {
      if (f.t < 0) { // waiting its turn: still hovering over the tube it came from
        blitYarn(c, f.k, f.x0, f.y0, L.r * 1.05); return;
      }
      var p = easeInOut(f.t / f.dur);
      var x = lerp(f.x0, f.x1, p), y = lerp(f.y0, f.y1, p) - Math.sin(p * Math.PI) * L.tubeW * 0.9;
      c.save(); c.translate(x, y); c.rotate(p * TAU * 0.6);
      blitYarn(c, f.k, 0, 0, L.r * 1.05);
      c.restore();
    });
  }

  function drawParts(c) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y); c.rotate(p.life * p.spin);
      if (p.star) star(c, p.r * 1.4); else { c.beginPath(); c.arc(0, 0, p.r, 0, TAU); }
      c.fillStyle = p.color; c.fill();
      c.restore();
    }
  }

  /* ---------- main loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (level) update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (level) {
      for (var i = 0; i < tubes.length; i++) if (!drag || drag.t !== i) drawTube(ctx, i);
      if (drag && drag.t < tubes.length) drawTube(ctx, drag.t);
      drawLifted(ctx);
      drawFlying(ctx);
      drawParts(ctx);
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  startLevel(progress().level);
  requestAnimationFrame(frame);

  /* test hook for automated checks */
  window.__yarn = {
    tubes: function () { return tubes.map(function (t) { return t.slice(); }); },
    level: function () { return level.n; },
    busy: function () { return busy || flying.length > 0; },
    won: function () { return won; },
    solve: function () { return solve(tubes, level.cap, 60000); },
    pos: function (i) { return L.pos[i]; },
    dragging: function () { return drag; },
    tubeH: function () { return L.tubeH; },
    start: function (n) { startLevel(n); }
  };
})();
