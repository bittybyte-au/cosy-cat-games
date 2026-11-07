/* Pottery (ages about 5 and up): a cosy studio with a cat potter for company.
   1. Shape: a lump of clay spins on the wheel. Drag a finger in towards the middle to squeeze it, out to let it bulge,
      at whatever height the finger is; near the top, drag up or down to make it taller or shorter. The profile is a
      smooth radius curve (M samples from the base up), kept sensible: smoothed between neighbours, a firm base, walls
      and neck never too thin, gentle overhangs only. Helpers: starting shapes, Centre (smooths it out), undo.
   2. Paint: it turns slowly; touch it to glaze a band at that height in the chosen colour, add a pattern band
      (dots, stripes, zigzag, hearts, paws, bricks), or dip it all in one colour. Unfired glaze looks pale and chalky.
   3. Fire: tap the pot to slide it into the kiln, tap the door to shut it. It glows and comes out shiny. No way to fail.
   4. Done: on the shelf. Every finished pot goes in the player's collection so Grow can plant in it:
      GG.collect('pottery', { type: 'pot', id: 'pot', data: GGPot.pack(pot) }). My pots (top bar) shows them and can
      delete one (GG.uncollect). At most MAX_POTS are kept; the oldest goes when there are more (Grow keeps its own copy).
   Pots are drawn by shared/pots.js (GGPot), which Grow and Cosy Home use too.
   Saves GG.setProgress('pottery', { made }). Nothing to earn. */
(function () {
  'use strict';

  var D = window.GGDraw, INK = D.INK, TAU = Math.PI * 2, PO = window.GGPot;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  var MAX_POTS = 60;
  var P = GG.getProgress('pottery') || {};
  if (typeof P.made !== 'number') P.made = 0;
  function saveP() { GG.setProgress('pottery', P); }

  /* ================= sound (all made here, no files) ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null, on = GG.getSetting('sound', true);
    var hum = null, squish = null, roar = null;
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // the wheel's hum, the squish of wet clay and the kiln's roar: always running, faded in and out
      hum = loopNoise('lowpass', 140, 0.9); var o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = 58; var og = ac.createGain(); og.gain.value = 0.5; o.connect(og); og.connect(hum.g); o.start();
      squish = loopNoise('bandpass', 520, 1.4);
      roar = loopNoise('lowpass', 260, 0.7);
    }
    function loopNoise(type, freq, q) {
      var src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      var g = ac.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(master); src.start();
      return { g: g, f: f };
    }
    function level(x, v, tc) { if (ac && x) x.g.gain.setTargetAtTime(v, ac.currentTime, tc || 0.08); }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function noise(o) {
      if (!ac || !on) return;
      var t = ac.currentTime + (o.delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.004, o.gain || 0.2, o.dur || 0.08);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + (o.attack || 0.004) + (o.dur || 0.08) + 0.05);
    }
    function tone(o) {
      if (!ac || !on) return;
      var t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.006, o.gain || 0.12, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.006) + (o.dur || 0.15) + 0.05);
    }
    return {
      init: init, isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      hum: function (v) { level(hum, v * 0.05, 0.25); },
      squish: function (v) { level(squish, v * 0.09, 0.05); if (squish && ac) squish.f.frequency.setTargetAtTime(420 + v * 500, ac.currentTime, 0.05); },
      roar: function (v) { level(roar, v * 0.16, 0.3); if (roar && ac) roar.f.frequency.setTargetAtTime(200 + v * 260, ac.currentTime, 0.3); },
      silence: function () { level(hum, 0, 0.05); level(squish, 0, 0.05); level(roar, 0, 0.05); },
      pop: function () { tone({ f: 420, to: 900, dur: 0.1, gain: 0.12, slide: 0.06 }); },
      pick: function () { tone({ f: 620, to: 840, dur: 0.07, gain: 0.07, type: 'triangle', slide: 0.05 }); },
      plop: function () { tone({ f: 260, to: 130, dur: 0.12, gain: 0.16 }); noise({ type: 'lowpass', freq: 500, dur: 0.06, gain: 0.1 }); },
      brush: function () { noise({ freq: 1700, q: 0.7, attack: 0.02, dur: 0.12, gain: 0.07 }); },
      dab: function () { tone({ f: 700, to: 980, dur: 0.06, gain: 0.06, type: 'triangle' }); noise({ freq: 2200, q: 1, dur: 0.05, gain: 0.05 }); },
      dip: function () { noise({ type: 'lowpass', freq: 300, to: 1200, q: 2, attack: 0.05, dur: 0.5, gain: 0.2 }); tone({ f: 300, to: 520, dur: 0.3, gain: 0.05, slide: 0.3 }); },
      slide: function () { noise({ type: 'lowpass', freq: 700, to: 300, q: 1, attack: 0.05, dur: 0.6, gain: 0.12 }); },
      clunk: function () { tone({ f: 140, to: 80, dur: 0.18, gain: 0.25 }); noise({ type: 'lowpass', freq: 400, dur: 0.1, gain: 0.25 }); },
      ding: function () { tone({ f: 1320, dur: 0.8, gain: 0.08 }); tone({ f: 1980, dur: 0.5, gain: 0.03, delay: 0.01 }); },
      undo: function () { tone({ f: 700, to: 420, dur: 0.1, gain: 0.07, type: 'triangle' }); },
      chime: function () { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { tone({ f: f, dur: 0.7, gain: 0.1, delay: i * 0.09 }); tone({ f: f * 2, dur: 0.3, gain: 0.025, delay: i * 0.09, type: 'triangle' }); }); },
      mrrp: function () { var p = rand(0.9, 1.2); tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', delay: 0.1, slide: 0.12 }); }
    };
  })();

  /* ================= the pot being made ================= */
  var M = 40, MINR = 7, MINBASE = 14, MINTOP = 9, MINH = 30;
  function fromList(list, h) {
    var r = [];
    for (var i = 0; i < M; i++) { var t = i / (M - 1) * (list.length - 1), j = Math.floor(t), f = t - j; r.push(j >= list.length - 1 ? list[list.length - 1] : lerp(list[j], list[j + 1], f)); }
    return { h: h, r: r };
  }
  var STARTS = {
    lump: { h: 58, r: [40, 43, 44, 44, 43, 42, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22] },
    bowl: { h: 54, r: [18, 26, 33, 39, 44, 48, 51, 53, 55, 56, 57, 57, 58, 58, 58, 58], name: 'Bowl' },
    vase: { h: 132, r: [22, 28, 34, 38, 40, 40, 37, 31, 24, 17, 13, 12, 12, 14, 17, 19], name: 'Vase' },
    mug: { h: 74, r: [30, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 32], name: 'Mug' },
    tall: { h: 148, r: [24, 25, 25, 25, 24, 24, 23, 23, 23, 23, 23, 24, 24, 25, 26, 27], name: 'Tall pot' }
  };
  function blankRows() { var a = []; for (var i = 0; i < PO.ROWS; i++) a.push(-1); return a; }
  var pot, start = 'lump', touchedShape = false;
  function newPot() {
    var s = fromList(STARTS.lump.r, STARTS.lump.h);
    pot = { h: s.h, r: s.r, rows: blankRows(), pats: [] };
    start = 'lump'; touchedShape = false; wob = reduceMotion ? 0.8 : 3.2;
    undoStack = [];
  }
  /* keep it sensible: smooth between neighbours, a firm base, never too thin, gentle overhangs */
  function settle(passes) {
    var r = pot.r, h = pot.h = clamp(pot.h, MINH, PO.MAXH), dy = h / (M - 1), i, n;
    for (n = 0; n < (passes || 1); n++) {
      var s = r.slice();
      for (i = 1; i < M - 1; i++) s[i] = r[i] * 0.6 + (r[i - 1] + r[i + 1]) * 0.2;
      s[M - 1] = r[M - 1] * 0.7 + r[M - 2] * 0.3; s[0] = r[0] * 0.8 + r[1] * 0.2;
      for (i = 0; i < M; i++) r[i] = s[i];
    }
    for (i = 0; i < M; i++) r[i] = clamp(r[i], MINR, PO.MAXR);
    r[0] = Math.max(r[0], MINBASE); r[1] = Math.max(r[1], MINBASE * 0.95);
    r[M - 1] = Math.max(r[M - 1], MINTOP);
    var up = Math.max(1.6 * dy, 1.2), down = Math.max(2.2 * dy, 1.6);
    for (i = 1; i < M; i++) r[i] = clamp(r[i], r[i - 1] - down, r[i - 1] + up);
    for (i = M - 2; i >= 0; i--) r[i] = clamp(r[i], r[i + 1] - up, r[i + 1] + down);
    // a pot can only be so much wider than the foot it stands on
    var maxW = r[0] * 4.1;
    for (i = 0; i < M; i++) r[i] = Math.min(r[i], maxW);
  }
  function radiusAt(y) { var t = clamp(y / pot.h, 0, 1) * (M - 1), j = Math.min(M - 2, Math.floor(t)); return lerp(pot.r[j], pot.r[j + 1], t - j); }
  var undoStack = [];
  function pushUndo() { undoStack.push(copy(pot)); if (undoStack.length > 25) undoStack.shift(); renderUndo(); }
  function undo() {
    if (!undoStack.length) return;
    var prev = undoStack.pop(), keepGlaze = step === 'shape';
    if (keepGlaze) { pot.h = prev.h; pot.r = prev.r; } else { pot.rows = prev.rows; pot.pats = prev.pats; }
    dipping = null; Sound.undo(); buzz(6); renderUndo();
  }
  function setStart(id) {
    pushUndo();
    var s = fromList(STARTS[id].r, STARTS[id].h);
    morph = { from: copy(pot), to: s, t: 0 };
    start = id; touchedShape = true;
    Sound.plop(); buzz(10); catReact('happy', 1);
    say(STARTS[id].name + '!', 1.2);
  }
  var morph = null;
  function centre() {
    pushUndo();
    settle(6); wob = 0; Sound.brush(); buzz(8); catReact('happy', 0.8);
    say('Nice and smooth', 1.2);
  }
  function describe() {
    var mx = 0, mxAt = 0; pot.r.forEach(function (v, i) { if (v > mx) { mx = v; mxAt = i; } });
    var top = pot.r[M - 1], ratio = pot.h / (mx * 2);
    if (ratio < 0.62) return 'What a lovely bowl!';
    if (top < mx * 0.6 && ratio > 0.9) return 'Ooh, a vase!';
    if (ratio > 2) return 'So tall!';
    if (mxAt > M * 0.35 && mxAt < M * 0.8 && top < mx * 0.85) return 'A round, cosy pot!';
    return 'A lovely pot!';
  }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1, L = {};
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5); W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var top = $('topbar').getBoundingClientRect().bottom + 4, bot = $('bar').getBoundingClientRect().top;
    document.documentElement.style.setProperty('--top-h', Math.round(top) + 'px');
    var aH = Math.max(200, bot - top), narrow = W < 640;
    var floorY = bot - Math.min(64, aH * 0.1);
    var by = floorY - Math.max(56, aH * 0.16);
    var U = Math.min((by - top - 34) / (PO.MAXH + 12), (narrow ? W * 0.4 : W * 0.24) / 64, 3.1);
    var cx = narrow ? W * 0.5 : W * 0.48;
    var catS = clamp(U * (narrow ? 40 : 46), 62, 130);
    // the kiln
    var kw = Math.min(narrow ? W * 0.58 : W * 0.3, (floorY - top) * 0.58, 360), kh = kw * 1.08;
    var kx = narrow ? W * 0.63 : W * 0.56, ky = floorY - kh;   // top left of the kiln body is (kx - kw/2, ky)
    var ch = { x: kx - kw * 0.31, y: ky + kh * 0.2, w: kw * 0.62, h: kh * 0.56 };
    var stand = { x: narrow ? W * 0.2 : W * 0.32, y: floorY - Math.min(60, aH * 0.09) };
    L = { top: top, bot: bot, aH: aH, floorY: floorY, by: by, U: U, cx: cx, narrow: narrow, catS: catS,
      cat: { x: Math.min(W - catS * 0.5, cx + 74 * U + catS * (narrow ? 0.3 : 0.7)), y: floorY },
      kiln: { x: kx, y: ky, w: kw, h: kh, ch: ch }, stand: stand,
      shelf: { x0: 14, x1: Math.min(narrow ? W * 0.34 : W * 0.26, 280), y: top + aH * (narrow ? 0.16 : 0.22) } };
    var ww = narrow ? W * 0.36 : Math.min(W * 0.18, 260), wh = Math.min(aH * 0.2, ww * 0.8, 190);
    L.win = { x: narrow ? W - ww - 26 : W * 0.78 - ww / 2, y: top + Math.max(14, aH * 0.05), w: ww, h: wh };
    // on a phone the wheel fills the width, so the cat watches from the window sill
    if (narrow) { L.catS = clamp(ww * 0.5, 56, 90); L.cat = { x: L.win.x + ww * 0.62, y: L.win.y + wh + 8 }; }
  }
  function toClay(x, y) { return { x: (x - L.cx - wobX()) / L.U, y: (L.by - y) / L.U }; }

  /* ================= state and steps ================= */
  var step = 'shape', spin = 0, wob = 3, time = 0, touch = null, kb = { y: 0.5, on: false, t: 0 };
  var tool = 'band', colour = 7, dipping = null, kiln = null, done = null, parts = [];
  function wobX() { return step === 'shape' ? Math.sin(spin) * wob * L.U * 0.6 : 0; }

  var LABEL = {
    shape: 'Drag the clay in, out, up or down', paint: 'Pick a colour, then touch the pot to paint',
    kiln: 'Tap your pot to put it in the kiln', door: 'Tap the door to close it', firing: 'Firing…', reveal: 'Ta-da!', done: 'Your pot is ready!'
  };
  function setStep(s) {
    step = s; touch = null;
    document.querySelectorAll('#steps span').forEach(function (el) {
      var order = ['shape', 'paint', 'kiln'], me = order.indexOf(el.dataset.s), now = order.indexOf(s === 'done' ? 'kiln' : s);
      el.className = me === now ? 'on' : me < now ? 'done' : '';
    });
    $('stepLabel').textContent = LABEL[s];
    $('backBtn').hidden = !(s === 'paint' || s === 'kiln'); $('backSpacer').hidden = !$('backBtn').hidden;
    $('nextBtn').hidden = !(s === 'shape' || s === 'paint'); $('nextSpacer').hidden = !$('nextBtn').hidden;
    $('nextBtn').innerHTML = s === 'shape' ? 'Paint it ' + ARROW : 'Fire it ' + FLAME;
    renderTools();
    layout();
  }
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H18 M12 6 L18 12 L12 18" fill="none" stroke="#2A2340" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 Q18 9 17 15 Q16 21 12 21 Q7 21 7 15 Q7 11 10 8 Q10 12 12 12 Q14 9 12 3 Z" fill="#FF9A3D" stroke="#2A2340" stroke-width="2.4" stroke-linejoin="round"/></svg>';

  /* ---------- the tools strip ---------- */
  var iconCache = {};
  function potIcon(key, data, look, px) {
    if (iconCache[key]) return iconCache[key];
    px = px || 96;
    var cv = document.createElement('canvas'); cv.width = cv.height = px;
    var c = cv.getContext('2d');
    var sz = PO.size(data, px * 0.8, px * 0.8);
    c.translate(px / 2, px / 2 + sz.h / 2);
    PO.draw(c, data, { w: px * 0.8, h: px * 0.8, look: look, lw: px / 26, spin: 0.4 });
    return (iconCache[key] = cv.toDataURL());
  }
  function cylinder(rows, pats) { return { h: 46, r: [26, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 28], rows: rows, pats: pats || [] }; }
  var SVG = {
    centre: '<svg viewBox="0 0 32 32"><ellipse cx="16" cy="22" rx="12" ry="4.5" fill="#E6B98A" stroke="#2A2340" stroke-width="2.6"/><path d="M9 21 Q8 12 12 9 H20 Q24 12 23 21 Q16 24 9 21 Z" fill="#B97753" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/><path d="M3 12 Q6 9 8 12 M29 12 Q26 9 24 12" fill="none" stroke="#2A2340" stroke-width="2.4" stroke-linecap="round"/></svg>',
    undo: '<svg viewBox="0 0 32 32"><path d="M10 9 L5 14 L10 19" fill="none" stroke="#2A2340" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 14 H19 Q26 14 26 20.5 Q26 27 19 27 H13" fill="none" stroke="#2A2340" stroke-width="3.2" stroke-linecap="round"/></svg>',
    dip: '<svg viewBox="0 0 32 32"><path d="M5 13 H27 L24 28 H8 Z" fill="#fff" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/><path d="M6.3 17 H25.7 L24 28 H8 Z" fill="COL"/><path d="M5 13 H27 L24 28 H8 Z" fill="none" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/><path d="M12 9 Q12 4 16 4 Q20 4 20 9" fill="none" stroke="#2A2340" stroke-width="2.4" stroke-linecap="round"/></svg>'
  };
  function toolBtn(attrs, inner, label, pressed) {
    return '<button class="tool" type="button" ' + attrs + ' aria-label="' + label + '"' + (pressed !== undefined ? ' aria-pressed="' + pressed + '"' : '') + '>' + inner + '</button>';
  }
  function renderTools() {
    var a = '', b = '';
    if (step === 'shape') {
      ['bowl', 'vase', 'mug', 'tall'].forEach(function (id) {
        var s = fromList(STARTS[id].r, STARTS[id].h);
        a += toolBtn('data-start="' + id + '"', '<img alt="" src="' + potIcon('s' + id, { h: s.h, r: s.r, rows: blankRows(), pats: [] }, 'wet') + '">', 'Start from a ' + STARTS[id].name.toLowerCase());
      });
      a += '<span class="sep"></span>' + toolBtn('data-act="centre"', SVG.centre, 'Centre: smooth it out') + toolBtn('data-act="undo" id="undoBtn"', SVG.undo, 'Undo');
    } else if (step === 'paint') {
      a += '<button class="tool sw bare" type="button" data-col="-1" aria-label="Sponge: bare clay" aria-pressed="' + (colour === -1) + '"></button>';
      PO.COLOURS.forEach(function (col, i) { a += '<button class="tool sw" type="button" data-col="' + i + '" style="background:' + PO.glazeCol(i, 'raw') + '" aria-label="' + PO.NAMES[i] + '" aria-pressed="' + (colour === i) + '"></button>'; });
      var ci = colour < 0 ? 0 : colour, band = blankRows(); for (var i = 8; i < 16; i++) band[i] = colour;
      b += toolBtn('data-tool="band"', '<img alt="" src="' + potIcon('band' + colour, cylinder(band), 'raw') + '">', colour < 0 ? 'Sponge it clean' : 'Paint a band', tool === 'band');
      PO.PATTERNS.forEach(function (k) { b += toolBtn('data-tool="' + k + '"', '<img alt="" src="' + potIcon(k + ci, cylinder(blankRows(), [{ k: k, y: 0.5, c: ci }]), 'raw') + '">', 'Pattern: ' + k, tool === k); });
      b += '<span class="sep"></span>' + toolBtn('data-act="dip"', SVG.dip.replace('COL', colour < 0 ? '#E2B48E' : PO.glazeCol(colour, 'raw')), colour < 0 ? 'Wash it all off' : 'Dip it all in ' + PO.NAMES[colour].toLowerCase()) + toolBtn('data-act="undo" id="undoBtn"', SVG.undo, 'Undo');
    } else if (step === 'done') {
      a = '<div class="donebtns"><button class="big again" type="button" data-act="another">Make another</button><button class="big" type="button" data-act="keep">Keep it</button></div>';
    }
    $('tools').innerHTML = a; $('tools').hidden = !a;
    $('tools2').innerHTML = b; $('tools2').hidden = !b;
    renderUndo();
  }
  function renderUndo() { var u = $('undoBtn'); if (u) u.disabled = !undoStack.length; }
  function onTools(e) {
    var t = e.target.closest('button'); if (!t) return;
    Sound.init();
    if (t.dataset.start) setStart(t.dataset.start);
    else if (t.dataset.act === 'centre') centre();
    else if (t.dataset.act === 'undo') undo();
    else if (t.dataset.act === 'dip') startDip();
    else if (t.dataset.act === 'another') { Sound.pop(); newPot(); setStep('shape'); }
    else if (t.dataset.act === 'keep') { Sound.pop(); openPots(done && done.uid); }
    else if (t.dataset.col !== undefined) {
      colour = +t.dataset.col; Sound.pick(); buzz(5);
      var sc = $('tools').scrollLeft, sc2 = $('tools2').scrollLeft; renderTools(); $('tools').scrollLeft = sc; $('tools2').scrollLeft = sc2;
    } else if (t.dataset.tool) {
      tool = t.dataset.tool; Sound.pick(); buzz(5);
      document.querySelectorAll('[data-tool]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.tool === tool)); });
    }
  }
  $('tools').addEventListener('click', onTools);
  $('tools2').addEventListener('click', onTools);
  $('nextBtn').addEventListener('click', function () {
    Sound.init(); Sound.pop(); buzz(8);
    if (step === 'shape') { settle(1); morph = null; undoStack = []; setStep('paint'); say(touchedShape ? describe() : 'A lovely pot!', 1.6); catReact('happy', 1.2); }
    else if (step === 'paint') startKiln();
  });
  $('backBtn').addEventListener('click', function () {
    Sound.init(); Sound.undo(); buzz(6);
    if (step === 'paint') { dipping = null; undoStack = []; setStep('shape'); }
    else if (step === 'kiln' && kiln && kiln.phase === 'wait') { kiln = null; undoStack = []; setStep('paint'); }
  });

  /* ================= shaping ================= */
  function shapeDown(e) {
    var q = toClay(e.clientX, e.clientY), h = pot.h;
    if (q.y < -14 || q.y > h + 40 || Math.abs(q.x) > radiusAt(q.y) + 46) return false;
    if (morph) { pot.h = morph.to.h; pot.r = morph.to.r.slice(); morph = null; }
    pushUndo();
    touch = { id: e.pointerId, x: q.x, y: q.y, mode: q.y > h * 0.86 && Math.abs(q.x) < radiusAt(h) + 30 ? 'height' : 'side', speed: 0, px: e.clientX, py: e.clientY };
    touchedShape = true; start = start === 'lump' ? 'own' : start;
    Sound.plop(); buzz(8); catReact('happy', 1.4);
    return true;
  }
  function shapeMove(e) {
    var q = toClay(e.clientX, e.clientY);
    touch.speed = Math.min(1, touch.speed + Math.hypot(e.clientX - touch.px, e.clientY - touch.py) / 60);
    touch.px = e.clientX; touch.py = e.clientY; touch.x = q.x; touch.y = q.y;
  }
  function shapeUpdate(dt) {
    if (morph) {
      morph.t += dt / (reduceMotion ? 0.2 : 0.45);
      var k = ease(morph.t);
      pot.h = lerp(morph.from.h, morph.to.h, k);
      for (var i = 0; i < M; i++) pot.r[i] = lerp(morph.from.r[i], morph.to.r[i], k);
      if (morph.t >= 1) morph = null;
      return;
    }
    if (!touch) return;
    var r = pot.r, h = pot.h;
    // a hand on the clay settles the wobble
    wob = Math.max(0, wob - dt * 1.2);
    if (touch.mode === 'height') {
      var target = clamp(touch.y, MINH, PO.MAXH), nh = lerp(h, target, 1 - Math.exp(-dt * 5));
      // taller gets a little thinner, shorter a little wider, as if the clay moved
      var f = Math.pow(h / nh, 0.35);
      for (var j = 1; j < M; j++) r[j] = r[j] * lerp(1, f, j / (M - 1));
      pot.h = nh;
    } else {
      var want = clamp(Math.abs(touch.x), MINR, PO.MAXR), sig = Math.max(7, h * 0.1), yy = clamp(touch.y, 0, h);
      for (var i2 = 0; i2 < M; i2++) {
        var y = i2 / (M - 1) * h, w = Math.exp(-Math.pow((y - yy) / sig, 2));
        if (w < 0.01) continue;
        var rate = want < r[i2] ? 9 : 5;           // squeezing in is quicker than letting it out
        r[i2] = lerp(r[i2], want, w * (1 - Math.exp(-dt * rate)));
      }
    }
    settle(1);
    touch.speed = Math.max(0, touch.speed - dt * 3);
    // wet slip flicks off now and then
    if (!reduceMotion && Math.random() < dt * 6 * (0.3 + touch.speed)) {
      var side = touch.x < 0 ? -1 : 1, rr = radiusAt(clamp(touch.y, 0, pot.h));
      parts.push({ x: L.cx + side * rr * L.U, y: L.by - clamp(touch.y, 0, pot.h) * L.U, vx: side * rand(40, 140), vy: rand(-160, -40), life: 0, max: rand(0.4, 0.7), r: rand(2, 4), color: '#9C5E3C', kind: 'drop', g: 700 });
    }
  }

  /* ================= painting ================= */
  function bandH() { return clamp(pot.h * 0.075, 4, 9); }
  function paintDown(e) {
    var q = toClay(e.clientX, e.clientY);
    if (q.y < -6 || q.y > pot.h + 10 || Math.abs(q.x) > radiusAt(clamp(q.y, 0, pot.h)) + 12) return false;
    if (dipping) return true;
    pushUndo();
    touch = { id: e.pointerId, y: clamp(q.y, 0, pot.h), last: clamp(q.y, 0, pot.h), pat: null };
    if (tool === 'band' || colour < 0 && tool === 'band') paintRows(touch.y, touch.y);
    else {
      var y = touch.y / pot.h;
      if (colour < 0) { removePats(touch.y); paintRows(touch.y, touch.y); }
      else {
        removePats(touch.y);
        touch.pat = { k: tool, y: y, c: colour };
        pot.pats.push(touch.pat);
        if (pot.pats.length > 8) pot.pats.shift();
      }
    }
    if (colour < 0) Sound.brush(); else if (tool === 'band') Sound.brush(); else Sound.dab();
    buzz(6); catReact('happy', 0.8);
    glazeDrops(e.clientX, e.clientY);
    return true;
  }
  function removePats(y) { var bh = bandH(); pot.pats = pot.pats.filter(function (p) { return Math.abs(p.y * pot.h - y) > bh * 1.5; }); }
  function paintRows(y0, y1) {
    var lo = Math.min(y0, y1), hi = Math.max(y0, y1), half = Math.max(pot.h / PO.ROWS * 1.4, 5), rowH = pot.h / PO.ROWS;
    for (var i = 0; i < PO.ROWS; i++) { var yc = (i + 0.5) * rowH; if (yc >= lo - half && yc <= hi + half) pot.rows[i] = colour; }
  }
  function paintMove(e) {
    var q = toClay(e.clientX, e.clientY), y = clamp(q.y, 0, pot.h);
    if (touch.pat) { touch.pat.y = y / pot.h; return; }
    if (Math.abs(y - touch.last) > 0.5) {
      paintRows(touch.last, y); touch.last = y;
      if (Math.random() < 0.3) Sound.brush();
      if (Math.random() < 0.4) glazeDrops(e.clientX, e.clientY);
    }
  }
  function glazeDrops(x, y) {
    if (reduceMotion) return;
    var col = colour < 0 ? '#E2B48E' : PO.glazeCol(colour, 'raw');
    for (var i = 0; i < 3; i++) parts.push({ x: x, y: y, vx: rand(-60, 60), vy: rand(-120, -20), life: 0, max: rand(0.35, 0.6), r: rand(2.5, 4.5), color: col, kind: 'drop', g: 600 });
  }
  function startDip() {
    if (dipping) return;
    pushUndo();
    dipping = { t: 0, col: colour };
    Sound.dip(); buzz(12); catReact('surprised', 0.8);
  }
  function dipUpdate(dt) {
    if (!dipping) return;
    dipping.t += dt / (reduceMotion ? 0.3 : 0.9);
    var n = Math.ceil(ease(dipping.t) * PO.ROWS);
    for (var i = 0; i < n; i++) pot.rows[i] = dipping.col;
    if (dipping.col < 0 && dipping.t >= 1) pot.pats = [];
    if (dipping.t >= 1) { dipping = null; catReact('happy', 1); }
  }

  /* ================= the kiln ================= */
  function startKiln() {
    kiln = { phase: 'wait', t: 0, slide: 0, door: 1, heat: 0, fire: 0 };
    undoStack = [];
    setStep('kiln');
    say('Into the kiln!', 1.4);
  }
  function kilnTap(e) {
    if (!kiln) return false;
    var x = e.clientX, y = e.clientY, K = L.kiln;
    if (kiln.phase === 'wait') {
      // anywhere on the pot, the stand or the kiln
      var ps = standPot(), onPot = Math.abs(x - L.stand.x) < ps.w / 2 + 30 && y > L.stand.y - ps.h - 30 && y < L.floorY;
      var onKiln = x > K.x - K.w / 2 && x < K.x + K.w / 2 && y > K.y && y < K.y + K.h;
      if (onPot || onKiln) { kiln.phase = 'in'; kiln.t = 0; Sound.slide(); buzz(10); $('backBtn').hidden = true; $('backSpacer').hidden = false; $('stepLabel').textContent = LABEL.door; return true; }
    } else if (kiln.phase === 'shut?') {
      if (x > K.x - K.w / 2 && x < K.x + K.w / 2 && y > K.y && y < K.y + K.h) { kiln.phase = 'close'; kiln.t = 0; buzz(10); return true; }
    }
    return false;
  }
  function standPot() { return PO.size(pot, L.narrow ? W * 0.28 : W * 0.2, Math.min(L.aH * 0.34, L.kiln.h * 0.8, 230)); }
  function chamberFit() { var ch = L.kiln.ch; return { w: ch.w * 0.78, h: ch.h * 0.8 }; }
  function kilnUpdate(dt) {
    var k = kiln; if (!k) return;
    k.t += dt;
    var slow = reduceMotion ? 0.5 : 1;
    if (k.phase === 'in') { k.slide = Math.min(1, k.t / (0.9 * slow)); if (k.slide >= 1) { k.phase = 'shut?'; k.t = 0; catReact('open', 1); } }
    else if (k.phase === 'close') {
      k.door = 1 - ease(k.t / (0.45 * slow));
      if (k.t >= 0.45 * slow) { k.door = 0; k.phase = 'firing'; k.t = 0; Sound.clunk(); buzz(25); $('stepLabel').textContent = LABEL.firing; catReact('surprised', 1.5); }
    } else if (k.phase === 'firing') {
      var dur = reduceMotion ? 2 : 4.2;
      k.heat = Math.min(1, k.t / (dur * 0.6)) * (k.t > dur * 0.8 ? Math.max(0, 1 - (k.t - dur * 0.8) / (dur * 0.2)) * 0.6 + 0.4 : 1);
      k.fire = clamp(k.t / dur, 0, 1);
      Sound.roar(k.t < dur * 0.85 ? Math.min(1, k.t / 1.2) : 0);
      if (!reduceMotion && Math.random() < dt * 14) { var K = L.kiln; parts.push({ x: K.x + rand(-K.w * 0.3, K.w * 0.3), y: K.y + rand(0, 10), vx: rand(-10, 10), vy: rand(-60, -30), life: 0, max: rand(0.8, 1.4), r: rand(3, 6), color: 'rgba(255,170,90,.55)', kind: 'heat', g: -20 }); }
      if (k.t >= dur) { k.phase = 'open'; k.t = 0; k.fire = 1; Sound.roar(0); Sound.ding(); }
    } else if (k.phase === 'open') {
      k.heat = Math.max(0, k.heat - dt * 1.5);
      k.door = ease(k.t / (0.4 * slow));
      if (k.t >= 0.4 * slow) { k.phase = 'out'; k.t = 0; Sound.slide(); }
    } else if (k.phase === 'out') {
      k.heat = Math.max(0, k.heat - dt * 1.5);
      k.slide = 1 - ease(k.t / (0.8 * slow));
      if (k.t >= 0.8 * slow) { k.phase = 'shine'; k.t = 0; k.slide = 0; reveal(); }
    } else if (k.phase === 'shine') {
      k.shine = Math.min(1, k.t / (reduceMotion ? 0.3 : 1.2));
      if (k.t >= (reduceMotion ? 0.8 : 1.8)) { k.phase = 'gone'; finish(); }
    }
  }
  function reveal() {
    Sound.chime(); buzz([20, 40, 30]);
    var ps = standPot();
    sparkle(L.stand.x, L.stand.y - ps.h * 0.55, '#FFD23F', 22, 1.3);
    catReact('happy', 4); catHop = 1;
    $('stepLabel').textContent = LABEL.reveal;
    say('It’s so shiny!', 1.8);
  }

  /* ---------- finished: on the shelf, and into the collection ---------- */
  function finish() {
    var data = PO.pack(pot), uid = null;
    try { uid = GG.collect('pottery', { type: 'pot', id: 'pot', data: data }); } catch (e) {}
    // keep the shelf from overflowing the shared collection: drop the oldest pots past MAX_POTS
    try { var mine = GG.collection({ type: 'pot' }); while (mine.length > MAX_POTS) { GG.uncollect(mine.shift().uid); } } catch (e) {}
    P.made++; saveP();
    if (window.GG && GG.track) GG.track('Fire pot', { game: 'pottery', shape: start });
    done = { t: 0, uid: uid, data: data };
    kiln = null;
    setStep('done');
    shelfCache = null;
    sparkle(W / 2, L.top + L.aH * 0.4, '#FF8FB8', 14, 1);
  }

  /* ================= the cat potter ================= */
  var catFace = 'open', catT = 0, catHop = 0, blinkT = 2;
  function catReact(face, secs) { catFace = face; catT = secs; if (face === 'happy' && Math.random() < 0.3) Sound.mrrp(); }
  function drawCat(c, x, y, size, pose) {
    var face = catT > 0 ? catFace : (blinkT < 0.14 ? 'blink' : 'open');
    var hop = catHop > 0 ? Math.sin((1 - catHop) * Math.PI * 3) * Math.max(0, catHop) * size * 0.12 : 0;
    D.shadow(c, x, y - 2, size * 0.55, size * 0.1);
    c.save(); c.translate(x, y - size * 0.98 - Math.abs(hop));
    GGCat.draw(c, { preset: 'ginger', pose: pose || 'sit', face: face, size: size });
    c.restore();
  }

  /* ================= drawing ================= */
  var shelfCache = null;
  function shelfPots() {
    if (shelfCache) return shelfCache;
    var list = [];
    try { list = GG.collection({ type: 'pot' }).filter(function (it) { return PO.unpack(it.data); }); } catch (e) {}
    shelfCache = list.slice(-3).reverse().map(function (it) { return it.data; });
    if (!shelfCache.length) shelfCache = [
      { h: 46, r: [16, 20, 24, 27, 29, 30, 30, 29, 27, 24, 21, 18, 16, 15, 15, 16], g: 'ffffffffffffffffffffffff', p: [[0, 50, 0]] },
      { h: 70, r: [18, 22, 26, 28, 28, 26, 22, 17, 13, 11, 11, 12, 14, 16, 17, 18], g: 'hhhhhhhhhhhhhhhhhhhhhhhh', p: [] }
    ];
    return shelfCache;
  }
  /* a warm studio: dotty wall over panelling, a window on the garden with a sill, a wooden floor (shared/scene.js) */
  function drawRoom(c) {
    var G = GGScene, dado = L.floorY - Math.min(90, L.aH * 0.16), wn = L.win;
    G.wall(c, 0, 0, W, dado, { pattern: 'dots', col: '#F6E4D2', col2: 'rgba(255,255,255,.35)', size: 34 });
    G.wall(c, 0, dado, W, L.floorY - dado, { pattern: 'panels', col: '#E9C9A9', edge: 'top' });
    G.window(c, wn.x, wn.y, wn.w, wn.h, { view: 'garden', frame: '#FFF8EC', bars: 'cross', barCol: '#FFF8EC', sill: '#E6B98A', r: 10,
      sun: false, cloud: 0.07 + 0.02 * Math.sin(time * 0.05), hill: '#8FD88F' });
    G.floor(c, 0, L.floorY, W, H - L.floorY, { kind: 'planks', col: '#C9965F', col2: 'rgba(42,35,64,.12)', size: 20 });
  }
  function drawShelf(c, x0, x1, y, pots, fit) {
    // the pots stand on the board, so their shadows go on it first
    var n = pots.length, gap = (x1 - x0) / n;
    GGScene.shelf(c, x0, x1, y, { kind: 'pegs', col: '#E6B98A', thick: 12, on: function (c) {
      pots.forEach(function (d, i) { var s = PO.size(d, fit, fit * 1.1); D.shadow(c, x0 + gap * (i + 0.5) + 2, y + 1, s.w * 0.45, 3.5); });
    } });
    pots.forEach(function (d, i) { c.save(); c.translate(x0 + gap * (i + 0.5), y + 1); PO.draw(c, d, { w: fit, h: fit * 1.1, lw: 3 }); c.restore(); });
  }
  function drawWheel(c, spinning) {
    var U = L.U, cx = L.cx, by = L.by, fy = L.floorY;
    var headR = 64 * U, headT = 7 * U, panR = 74 * U;
    // the body of the wheel, standing on the floor
    D.shadow(c, cx, fy, panR * 1.05, 10);
    D.shape(c, function (p) { p.moveTo(cx - panR * 0.62, by + headT + 6 * U); p.lineTo(cx - panR * 0.78, fy - 4); p.quadraticCurveTo(cx, fy + 6, cx + panR * 0.78, fy - 4); p.lineTo(cx + panR * 0.62, by + headT + 6 * U); p.closePath(); },
      D.tone(c, '#7CC4FF', by, fy), { lw: 4, depth: 10, inside: function (c) {
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(cx - panR * 0.5, by + headT + 18 * U, panR * 0.16, fy - by);
      } });
    // the splash pan round the head
    D.shape(c, D.ellPath(cx, by + headT + 2 * U, panR, panR * PO.E + 6 * U), D.tone(c, '#DDE7F2', by - 10, by + headT + 30 * U), { lw: 4, depth: 6, inside: function (c) {
      c.fillStyle = 'rgba(42,35,64,.14)'; c.beginPath(); c.ellipse(cx, by + headT, panR * 0.9, panR * PO.E * 0.85, 0, 0, TAU); c.fill();
    } });
    // the wheel head: a flat disc, its side marked so you can see it go round
    var side = new Path2D(); side.moveTo(cx - headR, by); side.lineTo(cx - headR, by + headT); side.ellipse(cx, by + headT, headR, headR * PO.E, 0, Math.PI, 0, true); side.lineTo(cx + headR, by); side.ellipse(cx, by, headR, headR * PO.E, 0, 0, Math.PI); side.closePath();
    D.shape(c, side, '#9AA3B5', { lw: 0, depth: 0, inside: function (c) {
      for (var i = 0; i < 14; i++) {
        var a = (spin * 0.5 + i * TAU / 14) % TAU, s = Math.sin(a); if (Math.cos(a) < 0) continue;
        var x = cx + headR * s; c.fillStyle = i % 2 ? 'rgba(255,255,255,.45)' : 'rgba(42,35,64,.25)';
        c.fillRect(x - 2.5 * Math.cos(a) - 1, by - 2, 5 * Math.cos(a) + 2, headT + headR * PO.E + 4);
      }
    } });
    D.shape(c, D.ellPath(cx, by, headR, headR * PO.E), D.tone(c, '#C3CAD8', by - headR * PO.E, by + headR * PO.E), { lw: 0, depth: 0, inside: function (c) {
      c.strokeStyle = 'rgba(42,35,64,.12)'; c.lineWidth = 2;
      [0.45, 0.75].forEach(function (k) { c.beginPath(); c.ellipse(cx, by, headR * k, headR * k * PO.E, 0, 0, TAU); c.stroke(); });
      // a soft wet shadow where the clay sits
      var r0 = pot.r[0] * U + 4;
      c.fillStyle = 'rgba(80,45,30,.25)'; c.beginPath(); c.ellipse(cx + 3, by + 1, r0 * 1.1, r0 * PO.E * 1.1, 0, 0, TAU); c.fill();
    } });
    // outline the head last
    var head = new Path2D(); head.moveTo(cx - headR, by); head.lineTo(cx - headR, by + headT); head.ellipse(cx, by + headT, headR, headR * PO.E, 0, Math.PI, 0, true); head.lineTo(cx + headR, by); head.ellipse(cx, by, headR, headR * PO.E, 0, 0, TAU);
    c.lineWidth = 4; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(head);
  }
  function drawPotOnWheel(c, look) {
    c.save(); c.translate(L.cx + wobX(), L.by);
    PO.draw(c, pot, { k: L.U, look: look, spin: spin, lw: 5 });
    c.restore();
  }
  function drawFingerHint(c) {
    // gentle arrows either side of the clay until it's been touched
    if (touchedShape || step !== 'shape' || morph) return;
    var y = L.by - pot.h * L.U * 0.5, r = radiusAt(pot.h * 0.5) * L.U, off = Math.sin(time * 3) * 6;
    c.save(); c.globalAlpha = 0.85;
    [-1, 1].forEach(function (s) {
      var x = L.cx + s * (r + 34 + off);
      c.beginPath(); c.moveTo(x + s * 16, y); c.lineTo(x - s * 6, y); c.moveTo(x + s * 2, y - 9); c.lineTo(x - s * 7, y); c.lineTo(x + s * 2, y + 9);
      c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.lineWidth = 4.5; c.strokeStyle = '#fff'; c.stroke();
    });
    c.restore();
  }
  function drawTouch(c) {
    // a soft fingertip where the hand is (handy with a mouse)
    var y = null, x = null;
    if (touch && (step === 'shape' || step === 'paint')) {
      if (step === 'shape') { y = L.by - clamp(touch.y, -5, PO.MAXH + 20) * L.U; var rr = touch.mode === 'height' ? 0 : Math.max(Math.abs(touch.x), radiusAt(clamp(touch.y, 0, pot.h))) ; x = touch.mode === 'height' ? L.cx : L.cx + (touch.x < 0 ? -1 : 1) * (rr * L.U + 17); if (touch.mode === 'height') y = Math.min(y, L.by - pot.h * L.U - radiusAt(pot.h) * L.U * PO.E - 19); }
    } else if (kb.on && kb.t > 0 && (step === 'shape' || step === 'paint')) {
      var ky = kb.y * pot.h; y = L.by - ky * L.U; x = L.cx + radiusAt(ky) * L.U + 17;
    }
    if (x === null) return;
    c.save(); c.globalAlpha = 0.9;
    D.shape(c, D.ellPath(x, y, 11, 13), 'rgba(255,214,190,.9)', { lw: 3, depth: 3 });
    c.restore();
  }
  function drawKiln(c) {
    var K = L.kiln, ch = K.ch, k = kiln || { slide: 0, door: 1, heat: 0, fire: 0 };
    var heat = k.heat || 0, x0 = K.x - K.w / 2;
    // legs, then the brick body with an arched opening and a chimney
    D.shadow(c, K.x, L.floorY, K.w * 0.55, 9);
    [x0 + K.w * 0.12, x0 + K.w * 0.82].forEach(function (lx) { D.shape(c, D.rrPath(lx, K.y + K.h - 14, K.w * 0.06, 16, 3), '#6B6380', { lw: 3, depth: 0 }); });
    D.shape(c, D.rrPath(K.x + K.w * 0.16, K.y - K.h * 0.16, K.w * 0.16, K.h * 0.2, 4), '#B7AFC4', { lw: 4, depth: 4 });
    var bodyCol = D.mix('#D9A27F', '#FF9A5A', heat * 0.5);
    var arch = function (p, x, y, w, h) { p.moveTo(x, y + h); p.lineTo(x, y + w / 2); p.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); p.lineTo(x + w, y + h); p.closePath(); };
    D.shape(c, D.rrPath(x0, K.y, K.w, K.h - 10, K.w * 0.12), D.tone(c, bodyCol, K.y, K.y + K.h), { lw: 5, depth: 10, inside: function (c) {
      // bricks
      c.strokeStyle = 'rgba(42,35,64,.16)'; c.lineWidth = 2;
      var bh = K.h / 11;
      for (var r = 0, y = K.y + bh; y < K.y + K.h; y += bh, r++) {
        c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + K.w, y); c.stroke();
        for (var x = x0 + (r % 2) * bh; x < x0 + K.w; x += bh * 2) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + bh); c.stroke(); }
      }
      // the chamber: dark, then glowing
      var inner = new Path2D(); arch(inner, ch.x - 8, ch.y - 8, ch.w + 16, ch.h + 16);
      c.fillStyle = '#E8CDB6'; c.fill(inner); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(inner);
      var hole = new Path2D(); arch(hole, ch.x, ch.y, ch.w, ch.h);
      c.fillStyle = D.mix('#4A3A52', '#FF8A3D', heat); c.fill(hole);
      c.save(); c.clip(hole);
      c.fillStyle = 'rgba(42,35,64,.25)'; c.fillRect(ch.x, ch.y + ch.h - 10, ch.w, 10);
      c.restore();
    } });
    // the pot (in the chamber, or on its stand, or sliding between)
    var ps = standPot(), cf = chamberFit(), s = ease(k.slide);
    var cs = PO.size(pot, cf.w, cf.h), kScale = lerp(ps.k, cs.k, s);
    var px = lerp(L.stand.x, K.x, s), py = lerp(L.stand.y, ch.y + ch.h - 4, s) - Math.sin(s * Math.PI) * 30;
    // the stand: a little wooden stool
    var st = L.stand, sw = Math.max(ps.w * 0.7, 70);
    D.shape(c, function (p) { p.moveTo(st.x - sw * 0.4, st.y + 8); p.lineTo(st.x - sw * 0.46, L.floorY); p.lineTo(st.x - sw * 0.34, L.floorY); p.lineTo(st.x - sw * 0.26, st.y + 8); p.closePath(); p.moveTo(st.x + sw * 0.4, st.y + 8); p.lineTo(st.x + sw * 0.46, L.floorY); p.lineTo(st.x + sw * 0.34, L.floorY); p.lineTo(st.x + sw * 0.26, st.y + 8); p.closePath(); }, '#B57F4B', { lw: 3, depth: 0 });
    D.shape(c, D.rrPath(st.x - sw / 2, st.y, sw, 12, 5), D.tone(c, '#E6B98A', st.y, st.y + 12), { lw: 4, depth: 3, inside: function (c) { if (s < 0.05) D.shadow(c, st.x + 3, st.y + 1, ps.w * 0.42, 4); } });
    var inChamber = s > 0.6 && k.phase !== 'shine';
    var look = { look: 'raw', fire: k.phase === 'shine' ? ease(k.shine || 0) : 0 };
    function potDraw() {
      c.save(); c.translate(px, py);
      PO.draw(c, pot, { k: kScale, look: look.look, fire: look.fire, spin: 0.6, lw: 5 });
      c.restore();
    }
    if (inChamber) {
      c.save(); var hole2 = new Path2D(); arch(hole2, ch.x, ch.y, ch.w, ch.h); c.clip(hole2); potDraw();
      // glowing hot inside
      if (heat > 0.02) { c.fillStyle = 'rgba(255,140,60,' + heat * 0.45 + ')'; c.fillRect(ch.x, ch.y, ch.w, ch.h); }
      c.restore();
    }
    // the door, hinged on the left: swings out towards you when open
    // (the door is the arch of the opening, squashed towards its hinge as it turns; its back shows once it's past side-on)
    var ang = k.door * Math.PI * 0.82, hx = ch.x - 5, cosA = Math.cos(ang);
    if (k.door < 0.999 && Math.abs(cosA) > 0.02) {
      var door = new Path2D(); arch(door, ch.x - 5, ch.y - 5, ch.w + 10, ch.h + 10);
      var front = cosA > 0, m = new DOMMatrix().translate(hx, 0).scale(cosA, 1).translate(-hx, 0);
      D.shape(c, door, front ? D.tone(c, '#8C8AA8', ch.y, ch.y + ch.h) : '#6B6380', { lw: 4, depth: front ? 6 : 0, m: m, inside: function (c) {
        if (!front) return;
        // the peephole, glowing when it's hot, and a little handle
        var wx = ch.x + ch.w / 2, wy = ch.y + ch.h * 0.36, wr = Math.min(ch.w * 0.14, 18);
        D.shape(c, D.ellPath(wx, wy, wr, wr), D.mix('#3A3150', '#FFC24D', heat), { lw: 3, depth: 0, inside: function (c) {
          if (heat > 0.1) { c.fillStyle = 'rgba(255,240,180,' + heat * 0.8 + ')'; c.beginPath(); c.moveTo(wx - wr * 0.5, wy + wr * 0.7); c.quadraticCurveTo(wx, wy - wr * (0.6 + Math.sin(time * 14) * 0.2), wx + wr * 0.5, wy + wr * 0.7); c.fill(); }
        } });
        D.shape(c, D.ellPath(ch.x + ch.w * 0.86, ch.y + ch.h * 0.6, 5, 5), '#FFD23F', { lw: 2.5, depth: 0 });
        c.strokeStyle = 'rgba(42,35,64,.18)'; c.lineWidth = 3; c.beginPath(); c.moveTo(ch.x + ch.w * 0.12, ch.y + ch.h * 0.72); c.lineTo(ch.x + ch.w * 0.7, ch.y + ch.h * 0.72); c.stroke();
      } });
    }
    if (!inChamber) potDraw();
    // the heat dial on the front
    var gx = K.x + K.w * 0.3, gy = K.y + K.h * 0.88, gr = Math.min(18, K.w * 0.06);
    D.shape(c, D.ellPath(gx, gy, gr, gr), '#FFF8EC', { lw: 3, depth: 2, inside: function (c) {
      c.beginPath(); c.arc(gx, gy, gr * 0.7, Math.PI * 0.9, Math.PI * 1.4); c.strokeStyle = '#7BD389'; c.lineWidth = 3; c.stroke();
      c.beginPath(); c.arc(gx, gy, gr * 0.7, Math.PI * 1.6, Math.PI * 2.1); c.strokeStyle = '#FF6B57'; c.stroke();
      var a = Math.PI * (0.9 + 1.2 * (k.phase === 'firing' ? heat : k.heat || 0));
      c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(a) * gr * 0.75, gy + Math.sin(a) * gr * 0.75); D.ink(c, 3);
    } });
    // tap hints
    if (kiln && (kiln.phase === 'wait' || kiln.phase === 'shut?')) {
      var wait = kiln.phase === 'wait', tx = wait ? L.stand.x : K.x, ty = wait ? L.stand.y - ps.h * 0.5 : ch.y + ch.h * 0.5;
      var trx = wait ? ps.w / 2 + 14 : ch.w * 0.62, tr_y = wait ? ps.h / 2 + 14 : ch.h * 0.62;
      c.save(); c.setLineDash([8, 7]); c.lineDashOffset = -time * 20; c.beginPath(); c.ellipse(tx, ty, trx, tr_y, 0, 0, TAU); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); c.restore();
    }
    // a warm glow round the kiln while it fires
    if (heat > 0.02) {
      var g = c.createRadialGradient(K.x, K.y + K.h * 0.5, K.w * 0.3, K.x, K.y + K.h * 0.5, K.w * 0.95);
      g.addColorStop(0, 'rgba(255,170,80,' + heat * 0.3 + ')'); g.addColorStop(1, 'rgba(255,170,80,0)');
      c.fillStyle = g; c.fillRect(K.x - K.w, K.y - K.h * 0.5, K.w * 2, K.h * 2);
    }
  }
  function drawDone(c) {
    var t = done ? done.t : 1, fitW = Math.min(W * (L.narrow ? 0.56 : 0.3), 300), fitH = Math.min(L.aH * 0.52, 300);
    var sy = L.top + L.aH * 0.2 + fitH, sx0 = L.narrow ? 16 : W * 0.5 - Math.min(W * 0.36, 420), sx1 = L.narrow ? W - 16 : W * 0.5 + Math.min(W * 0.36, 420);
    var sz = PO.size(pot, fitW, fitH), cx = L.narrow ? W * 0.45 : W * 0.5;
    // the shelf: the pot's shadow on the board, brackets underneath
    D.shape(c, D.rrPath(sx0, sy, sx1 - sx0, 16, 5), D.tone(c, '#E6B98A', sy, sy + 16), { lw: 4, depth: 4, inside: function (c) { D.shadow(c, cx + 4, sy + 2, sz.w * 0.42, 5); } });
    [sx0 + 30, sx1 - 30].forEach(function (bx) { D.shape(c, function (p) { p.moveTo(bx - 6, sy + 16); p.lineTo(bx + 6, sy + 16); p.lineTo(bx + 3, sy + 40); p.lineTo(bx - 3, sy + 40); p.closePath(); }, '#B57F4B', { lw: 3, depth: 0 }); });
    var pop = reduceMotion ? 1 : easeBack(Math.min(1, t * 2.2));
    c.save(); c.translate(cx, sy + 1); c.scale(pop, pop);
    PO.draw(c, pot, { w: fitW, h: fitH, spin: 0.6 + Math.sin(time * 0.6) * 0.25, lw: 5 });
    c.restore();
    // twinkles on the glaze
    if (!reduceMotion) for (var i = 0; i < 3; i++) {
      var ph = (time * 0.7 + i / 3) % 1, a = Math.sin(ph * Math.PI);
      var x = cx - sz.w * 0.3 + (i * 0.37 % 1) * sz.w * 0.5, y = sy - sz.h * (0.3 + 0.2 * i);
      c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate(time); c.fillStyle = '#fff'; star(c, 7); c.fill(); c.restore();
    }
    drawCat(c, L.narrow ? W - L.catS * 0.6 : Math.min(W - L.catS, cx + sz.w / 2 + L.catS * 0.9), L.floorY, L.catS, 'wave');
  }

  /* ---------- particles ---------- */
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 220) * (spd || 1); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.6, 1), r: rand(4, 8), color: Math.random() < 0.4 ? '#fff' : color, kind: Math.random() < 0.6 ? 'star' : 'dot', spin: rand(-5, 5), g: 300 }); }
  }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawParts(c, dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.8); c.translate(p.x, p.y);
      if (p.kind === 'star') { c.rotate(p.life * p.spin); star(c, p.r * 1.3); c.fillStyle = p.color; c.fill(); }
      else if (p.kind === 'heat') { c.beginPath(); c.arc(0, 0, p.r * (1 + p.life), 0, TAU); c.fillStyle = p.color; c.fill(); }
      else { c.beginPath(); c.arc(0, 0, p.r, 0, TAU); c.fillStyle = p.color; c.fill(); }
      c.restore();
    }
  }

  function draw(dt) {
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineJoin = 'round'; c.lineCap = 'round';
    drawRoom(c);
    if (step === 'shape' || step === 'paint') {
      drawShelf(c, L.shelf.x0, L.shelf.x1, L.shelf.y, shelfPots(), Math.min(56, (L.shelf.x1 - L.shelf.x0) / 3.4));
      drawCat(c, L.cat.x, L.cat.y, L.catS);
      drawWheel(c, true);
      drawPotOnWheel(c, step === 'shape' ? 'wet' : 'raw');
      drawFingerHint(c); drawTouch(c);
    } else if (step === 'kiln') {
      drawKiln(c);
      // the cat keeps warm on top of the kiln
      drawCat(c, L.kiln.x - L.kiln.w * 0.18, L.kiln.y + 4, Math.min(L.catS, L.kiln.w * 0.36));
    } else if (step === 'done') drawDone(c);
    drawParts(c, dt);
  }

  /* ================= input ================= */
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init(); kb.t = 0;
    if (touch) return;
    var used = false;
    if (step === 'shape') used = shapeDown(e);
    else if (step === 'paint') used = paintDown(e);
    else if (step === 'kiln') used = kilnTap(e);
    else if (step === 'done') { sparkle(e.clientX, e.clientY, '#FFD23F', 6, 0.6); Sound.dab(); }
    if (used && touch) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!touch || touch.id !== e.pointerId) return;
    if (step === 'shape') shapeMove(e); else if (step === 'paint') paintMove(e);
  });
  function up(e) { if (touch && touch.id === e.pointerId) { touch = null; Sound.squish(0); } }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);

  /* keyboard: up/down choose a height, left/right squeeze or let out (shape), Enter/Space paints (paint),
     + and - make it taller or shorter, Enter/Space taps in the kiln, Ctrl+Z undoes */
  window.addEventListener('keydown', function (e) {
    if (!$('potsWrap').hidden) { if (e.key === 'Escape') closePots(); return; }
    var tag = (e.target && e.target.tagName) || '';
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (step === 'shape' || step === 'paint') {
      var hit = true;
      if (e.key === 'ArrowUp') kb.y = clamp(kb.y + 0.06, 0.02, 0.98);
      else if (e.key === 'ArrowDown') kb.y = clamp(kb.y - 0.06, 0.02, 0.98);
      else if (step === 'shape' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        if (!e.repeat) pushUndo();
        var yy = kb.y * pot.h, sig = Math.max(7, pot.h * 0.1), d = e.key === 'ArrowLeft' ? -3 : 3;
        for (var i = 0; i < M; i++) { var y = i / (M - 1) * pot.h; pot.r[i] += d * Math.exp(-Math.pow((y - yy) / sig, 2)); }
        settle(1); touchedShape = true; start = start === 'lump' ? 'own' : start; wob = Math.max(0, wob - 0.5); Sound.init(); Sound.plop();
      } else if (step === 'shape' && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
        if (!e.repeat) pushUndo();
        pot.h += (e.key === '-' || e.key === '_') ? -6 : 6; settle(1); touchedShape = true;
      } else if (step === 'paint' && (e.key === 'Enter' || e.key === ' ') && tag !== 'BUTTON' && tag !== 'A') {
        var yp = kb.y * pot.h; pushUndo();
        if (tool === 'band' || colour < 0) { paintRows(yp, yp); if (colour < 0) removePats(yp); } else { removePats(yp); pot.pats.push({ k: tool, y: kb.y, c: colour }); if (pot.pats.length > 8) pot.pats.shift(); }
        Sound.init(); Sound.dab();
      } else hit = false;
      if (hit) { e.preventDefault(); kb.on = true; kb.t = 4; }
    } else if (step === 'kiln' && (e.key === 'Enter' || e.key === ' ') && tag !== 'BUTTON' && tag !== 'A') {
      e.preventDefault(); Sound.init();
      var K = L.kiln;
      if (kiln && kiln.phase === 'wait') kilnTap({ clientX: L.stand.x, clientY: L.stand.y - 10 });
      else if (kiln && kiln.phase === 'shut?') kilnTap({ clientX: K.x, clientY: K.ch.y + K.ch.h / 2 });
    }
  });

  /* ================= My pots ================= */
  var picked = null, confirmDel = false;
  function myPots() { try { return GG.collection({ type: 'pot' }).filter(function (it) { return PO.unpack(it.data); }).reverse(); } catch (e) { return []; } }
  var thumbs = {};
  function potThumb(it, px) {
    var key = it.uid + ':' + (px || 160);
    if (thumbs[key]) return thumbs[key];
    px = px || 160;
    var cv = document.createElement('canvas'); cv.width = cv.height = px;
    var c = cv.getContext('2d'), sz = PO.size(it.data, px * 0.78, px * 0.78);
    c.translate(px / 2, px / 2 + sz.h / 2);
    D.shadow(c, 3, 0, sz.w * 0.42, px * 0.03);
    PO.draw(c, it.data, { w: px * 0.78, h: px * 0.78, lw: px / 40, spin: 0.5 });
    return (thumbs[key] = cv.toDataURL());
  }
  function openPots(highlight) { picked = highlight || null; confirmDel = false; renderPots(highlight); $('potsWrap').hidden = false; $('potsClose').focus(); }
  function closePots() { $('potsWrap').hidden = true; }
  function renderPots(isNew) {
    var list = myPots();
    $('potGrid').innerHTML = list.map(function (it) {
      return '<button class="potbtn' + (it.uid === isNew ? ' new' : '') + '" type="button" data-uid="' + it.uid + '" aria-pressed="' + (it.uid === picked) + '" aria-label="Pot made ' + new Date(it.at).toLocaleDateString() + '"><img alt="" src="' + potThumb(it, 160) + '"></button>';
    }).join('');
    $('potsNote').textContent = list.length ? 'Your pots are in Grow too, ready for a plant.' : 'No pots yet. Shape one on the wheel and fire it in the kiln!';
    var it = list.filter(function (x) { return x.uid === picked; })[0];
    $('preview').hidden = !it;
    if (it) {
      $('previewImg').src = potThumb(it, 300);
      $('previewActs').innerHTML = confirmDel ?
        '<p class="note">Delete this pot?</p><button class="big small delbtn" type="button" data-pact="yes">Yes, delete it</button><button class="big small again" type="button" data-pact="no">No, keep it</button>' :
        '<a class="big small" href="../grow/index.html">Plant in Grow</a><button class="big small delbtn" type="button" data-pact="del">Delete</button>';
    }
  }
  $('potsBtn').addEventListener('click', function () { Sound.init(); Sound.pick(); openPots(null); });
  $('potsClose').addEventListener('click', closePots);
  $('potsWrap').addEventListener('click', function (e) { if (e.target === $('potsWrap')) closePots(); });
  $('potGrid').addEventListener('click', function (e) { var b = e.target.closest('[data-uid]'); if (!b) return; picked = b.dataset.uid; confirmDel = false; Sound.pick(); renderPots(); });
  $('previewActs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pact]'); if (!b) return;
    if (b.dataset.pact === 'del') { confirmDel = true; Sound.pick(); }
    else if (b.dataset.pact === 'no') { confirmDel = false; Sound.pick(); }
    else if (b.dataset.pact === 'yes') { GG.uncollect(picked); picked = null; confirmDel = false; shelfCache = null; Sound.undo(); buzz(10); }
    renderPots();
  });

  /* ================= speech bubble ================= */
  var sayTimer = 0;
  function say(text, secs) {
    var el = $('say'); el.textContent = text; el.classList.remove('hide');
    clearTimeout(sayTimer); sayTimer = setTimeout(function () { el.classList.add('hide'); }, (secs || 1.6) * 1000);
  }

  /* ================= sound button ================= */
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.pop(); });
  renderSound();

  /* ================= main loop ================= */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    var speed = step === 'shape' ? (reduceMotion ? 3.2 : 7.5) : step === 'paint' ? (reduceMotion ? 0.8 : 1.6) : 0;
    spin += dt * speed;
    if (step === 'shape') { shapeUpdate(dt); if (!touch && wob > 0) wob = Math.max(0, wob - dt * 0.08); }
    if (step === 'paint') dipUpdate(dt);
    if (step === 'kiln') kilnUpdate(dt);
    if (done) done.t += dt;
    catT -= dt; blinkT -= dt; if (blinkT < 0) blinkT = rand(2.5, 5); if (catHop > 0) catHop = Math.max(0, catHop - dt * 0.8);
    if (kb.t > 0) kb.t -= dt;
    Sound.hum(step === 'shape' ? 1 : step === 'paint' ? 0.5 : 0);
    Sound.squish(step === 'shape' && touch ? 0.4 + touch.speed * 0.6 : 0);
    draw(dt);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe($('topbar')); ro.observe($('bar')); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); if (document.hidden) Sound.silence(); });

  newPot();
  setStep('shape');
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  requestAnimationFrame(frame);
  setTimeout(function () { if (step === 'shape' && !touchedShape) say('Drag the spinning clay to shape it!', 2.6); }, 500);

  /* test hook */
  window.__pottery = {
    state: function () { return { step: step, h: pot.h, r: pot.r.slice(), rows: pot.rows.slice(), pats: copy(pot.pats), kiln: kiln ? kiln.phase : null, made: P.made, wob: wob, packed: PO.pack(pot) }; },
    toScreen: function (x, y) { return { x: L.cx + x * L.U, y: L.by - y * L.U }; },
    layout: function () { return copy(L); },
    setColour: function (i) { colour = i; renderTools(); }, setTool: function (t) { tool = t; renderTools(); },
    pots: function () { return myPots(); }
  };
})();
