/* Hot Paws (ages 5-10 and 10+): a light-up floor, like the one at the games arcade, seen from above. Each round
   has its own fixed green tiles, always safe; the other tiles sit dark until a pattern lights them: blue squares
   are diamonds to collect, orange warns that lava is coming and red is lava. Your cat walks one tile at a time:
   swipe (hold to keep walking), tap a tile, or use the arrow keys / WASD. Lava under the paws is "Hot paws!": the
   cat hops up and lands on the nearest safe tile, dropping a diamond on the floor nearby. No lives, no game over,
   no timers or scores; the patterns set the pace.
   The rules live in engine.js (shared with the test bot), the rounds in levels.js.
   Saves GG.setProgress('hotpaws', { done: [round numbers finished], last }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK, TAU = Math.PI * 2;
  var E = window.HotPawsEngine, LEVELS = window.HotPawsLevels;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = 1, paused = false;

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function eout(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function track(n, d) { if (window.GG && GG.track) GG.track(n, d); }

  /* ================= your cat: the player's own cat if they made one ================= */
  var CAT = { preset: 'ginger' };
  function catSetup() {
    var p = null; try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) { CAT = { preset: 'ginger' }; return; }
    var av = GGAvatar.normalise(p.avatar, p.color);
    CAT = { color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none' };
  }
  catSetup(); window.addEventListener('gg-change', catSetup);

  /* ================= sound: soft and synthesised ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null, on = GG.getSetting('sound', true), lastStep = 0, stepN = 0;
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.85 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function ok() { return ac && on; }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function tone(o) {
      if (!ok()) return;
      var t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(), g = ac.createGain();
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      env(g, t, o.attack || 0.006, o.gain || 0.12, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.006) + (o.dur || 0.15) + 0.05);
    }
    function noise(o) {
      if (!ok()) return;
      var t = ac.currentTime + (o.delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 1;
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.attack || 0.004) + (o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.004, o.gain || 0.15, o.dur || 0.1);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + (o.attack || 0.004) + (o.dur || 0.1) + 0.05);
    }
    var SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98];
    return {
      init: init, isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.85 : 0, ac.currentTime, 0.02); },
      step: function () { var n = performance.now(); if (n - lastStep < 60) return; lastStep = n; stepN++; noise({ type: 'lowpass', freq: 700, q: 1, dur: 0.04, gain: 0.08 }); tone({ f: stepN % 2 ? 330 : 294, to: 260, dur: 0.05, gain: 0.035, type: 'triangle' }); },
      bump: function () { tone({ f: 220, to: 170, dur: 0.09, gain: 0.07, type: 'triangle' }); },
      collect: function (n) { var f = SCALE[Math.min(SCALE.length - 1, n % 9)]; tone({ f: f, dur: 0.22, gain: 0.11 }); tone({ f: f * 2, dur: 0.12, gain: 0.03, type: 'triangle', delay: 0.03 }); tone({ f: f * 1.5, dur: 0.18, gain: 0.05, delay: 0.07 }); },
      gold: function () { [1046.5, 1318.5, 1567.98, 2093].forEach(function (f, i) { tone({ f: f, dur: 0.25, gain: 0.08, delay: i * 0.07 }); }); },
      spawn: function () { tone({ f: 620, to: 930, dur: 0.12, gain: 0.025, slide: 0.08 }); },
      sizzle: function () { noise({ type: 'highpass', freq: 2600, q: 0.7, attack: 0.01, dur: 0.38, gain: 0.12 }); for (var i = 0; i < 5; i++) noise({ freq: 3200 + i * 500, q: 3, dur: 0.025, gain: 0.05, delay: 0.04 + i * 0.05 }); },
      yowl: function () { tone({ f: 620, to: 1250, dur: 0.14, gain: 0.08, type: 'triangle', slide: 0.12 }); tone({ f: 1250, to: 760, dur: 0.22, gain: 0.07, type: 'triangle', slide: 0.2, delay: 0.13 }); },
      boing: function () { tone({ f: 280, to: 620, dur: 0.22, gain: 0.07, slide: 0.18 }); },
      land: function () { noise({ type: 'lowpass', freq: 380, q: 1, dur: 0.08, gain: 0.18 }); tone({ f: 160, to: 110, dur: 0.08, gain: 0.06, type: 'triangle' }); },
      drop: function (d) { tone({ f: 1700, to: 1350, dur: 0.12, gain: 0.05, delay: d }); tone({ f: 2100, dur: 0.08, gain: 0.025, type: 'triangle', delay: (d || 0) + 0.05 }); },
      slide: function () { noise({ freq: 900, to: 2600, q: 1.1, attack: 0.02, dur: 0.18, gain: 0.08 }); },
      freeze: function () { [2093, 1760, 1568, 1318.5, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.3, gain: 0.05, delay: i * 0.06 }); }); noise({ type: 'highpass', freq: 4000, q: 0.5, attack: 0.05, dur: 0.5, gain: 0.05 }); },
      thaw: function () { tone({ f: 400, to: 620, dur: 0.3, gain: 0.04, slide: 0.25 }); },
      party: function () {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { tone({ f: f, dur: 0.5, gain: 0.1, delay: i * 0.11 }); tone({ f: f * 2, dur: 0.2, gain: 0.025, delay: i * 0.11, type: 'triangle' }); });
        for (var i = 0; i < 8; i++) tone({ f: [784, 988, 1175, 988][i % 4], dur: 0.12, gain: 0.05, delay: 0.75 + i * 0.22, type: 'triangle' });
      },
      purr: function (delay) { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.2, delay: (delay || 0) + i * 0.085 }); },
      mrrp: function (delay) { var k = rand(0.92, 1.1); tone({ f: 480 * k, to: 760 * k, dur: 0.1, gain: 0.06, type: 'triangle', delay: delay }); tone({ f: 760 * k, to: 620 * k, dur: 0.12, gain: 0.05, type: 'triangle', delay: (delay || 0) + 0.09 }); }
    };
  })();

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), dpr = 1, W = 0, H = 0;
  var T = 50, BX = 0, BY = 0, C = 7, R = 9, PAD = 10;
  function landscape() { return innerWidth > innerHeight * 1.05; }
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5); W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var top = $('topbar').getBoundingClientRect().bottom + 4, hudH = 52, sayH = 56, bottom = H - Math.max(12, safeBottom());
    var availW = W - 24, availH = bottom - top - hudH - sayH - 8;
    T = Math.floor(Math.min(availW / (C + 0.5), availH / (R + 0.5), 104));
    T = Math.max(26, T);
    PAD = Math.round(T * 0.22);
    BX = Math.round((W - C * T) / 2);
    BY = Math.round(top + hudH + Math.max(PAD, (availH - R * T) * 0.4));
    var hud = $('hud'); hud.style.top = Math.round(top + 2) + 'px';
    var s = $('say'); s.style.top = Math.round(Math.min(BY + R * T + PAD + 10, bottom - 50)) + 'px';
    buildSprites();
    buildRoom();
  }
  var safeB = null;
  function safeBottom() { if (safeB !== null) return safeB; var d = document.createElement('div'); d.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px)'; document.body.appendChild(d); safeB = d.getBoundingClientRect().height; d.remove(); return safeB; }
  window.addEventListener('resize', function () { safeB = null; layout(); });
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe($('topbar'));
  function tx(c) { return BX + (c + 0.5) * T; }
  function ty(r) { return BY + (r + 0.5) * T; }

  /* ================= the tiles ================= */
  // each kind: [light centre, colour, deep edge, glow]
  var KIND = {
    off:  ['#4E4579', '#3A3262', '#2B2550', null],
    on:   ['#C4FFD3', '#5FE08B', '#2FB063', '#5FE08B'],
    warn: ['#FFEBA8', '#FFB547', '#EC8519', '#FFA53D'],
    lava: ['#FFB14A', '#FF5B3A', '#D2342B', '#FF5B3A'],
    d:    ['#D7F0FF', '#5DB6F5', '#2F86D2', '#5DB6F5'],
    g:    ['#FFF6BF', '#FFD23F', '#E09A12', '#FFD23F'],
    f:    ['#FFFFFF', '#A8E8FF', '#5DBDE8', '#A8E8FF'],
    ice:  ['#FFFFFF', '#D6F1FF', '#A3D8F2', null]
  };
  var sprites = {}, halos = {};
  function lwk() { return clamp(T * 0.055, 2.4, 4.4); }
  function tilePath(s) { var g = s * 0.07; return D.rrPath(-s / 2 + g, -s / 2 + g, s - 2 * g, s - 2 * g, s * 0.2); }
  function gemPath(u) {
    var p = new Path2D();
    p.moveTo(-0.55 * u, -0.72 * u); p.lineTo(0.55 * u, -0.72 * u); p.lineTo(1.0 * u, -0.22 * u); p.lineTo(0, 0.95 * u); p.lineTo(-1.0 * u, -0.22 * u); p.closePath();
    return p;
  }
  /* a gem, light from the top left: a pale crown, a lit left side, a shaded right side, facets in ink */
  function drawGem(c, u, cols, lw) {
    var p = gemPath(u);
    D.shape(c, p, cols[1], { lw: lw, depth: 0, inside: function (c) {
      c.fillStyle = cols[0]; c.beginPath(); c.moveTo(-0.55 * u, -0.72 * u); c.lineTo(0.55 * u, -0.72 * u); c.lineTo(1.0 * u, -0.22 * u); c.lineTo(-1.0 * u, -0.22 * u); c.closePath(); c.fill();
      c.fillStyle = cols[2]; c.beginPath(); c.moveTo(0.3 * u, -0.22 * u); c.lineTo(1.0 * u, -0.22 * u); c.lineTo(0, 0.95 * u); c.closePath(); c.fill();
      c.strokeStyle = INK; c.lineWidth = lw * 0.55; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-1.0 * u, -0.22 * u); c.lineTo(1.0 * u, -0.22 * u);
      c.moveTo(-0.55 * u, -0.72 * u); c.lineTo(-0.3 * u, -0.22 * u); c.lineTo(0, 0.95 * u); c.lineTo(0.3 * u, -0.22 * u); c.lineTo(0.55 * u, -0.72 * u); c.stroke();
      D.shine(c, -0.42 * u, -0.48 * u, 0.16 * u, 0.09 * u, -0.3, 0.9);
    } });
  }
  function sparkle(c, x, y, r, col) {
    c.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 - Math.PI / 2, q = i % 2 ? r * 0.32 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    c.closePath(); c.fillStyle = col; c.fill();
  }
  function snowflake(c, r, lw) {
    var arms = new Path2D();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 - Math.PI / 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
      arms.moveTo(0, 0); arms.lineTo(x, y);
      var bx = Math.cos(a) * r * 0.58, by = Math.sin(a) * r * 0.58;
      [-0.6, 0.6].forEach(function (k) { arms.moveTo(bx, by); arms.lineTo(bx + Math.cos(a + k) * r * 0.32, by + Math.sin(a + k) * r * 0.32); });
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = INK; c.lineWidth = lw * 2.1; c.stroke(arms);
    c.strokeStyle = '#FFFFFF'; c.lineWidth = lw * 0.9; c.stroke(arms);
    D.shape(c, D.ellPath(0, 0, r * 0.2, r * 0.2), '#FFFFFF', { lw: lw * 0.7, depth: 0 });
  }
  function warnIcon(c, s, lw) {
    var r = s * 0.24, p = new Path2D();
    p.moveTo(0, -r * 1.05); p.lineTo(r * 1.12, r * 0.85); p.lineTo(-r * 1.12, r * 0.85); p.closePath();
    c.lineJoin = 'round';
    c.save(); c.lineWidth = lw * 2.4; c.strokeStyle = INK; c.stroke(p); c.lineWidth = lw * 1.0; c.strokeStyle = '#FFF6D8'; c.stroke(p); c.fillStyle = '#FFF6D8'; c.fill(p); c.restore();
    c.strokeStyle = INK; c.lineCap = 'round'; c.lineWidth = lw * 0.95;
    c.beginPath(); c.moveTo(0, -r * 0.35); c.lineTo(0, r * 0.25); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(0, r * 0.58, lw * 0.55, 0, TAU); c.fill();
  }
  /* one tile, drawn at the origin in a box s wide; the moving parts (lava ripples, pulses) are added each frame */
  function drawTileArt(c, key, s) {
    var k = KIND[key], lw = lwk() * s / T, p = tilePath(s);
    var g = c.createRadialGradient(-s * 0.12, -s * 0.16, s * 0.05, 0, 0, s * 0.62);
    g.addColorStop(0, k[0]); g.addColorStop(0.55, k[1]); g.addColorStop(1, k[2]);
    D.shape(c, p, g, { lw: lw, depth: s * 0.07, shade: key === 'off' ? 'rgba(0,0,0,.18)' : 'rgba(42,35,64,.14)', inside: function (c) {
      if (key === 'off') {
        // a sleeping light panel: a few dim LEDs
        c.fillStyle = 'rgba(255,255,255,.07)';
        for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) { c.beginPath(); c.arc(i * s * 0.22, j * s * 0.22, s * 0.045, 0, TAU); c.fill(); }
        D.shine(c, -s * 0.2, -s * 0.27, s * 0.17, s * 0.06, -0.2, 0.1);
        return;
      }
      if (key === 'warn') {
        c.strokeStyle = 'rgba(255,240,170,.75)'; c.lineWidth = s * 0.1;
        for (var x = -s; x < s; x += s * 0.3) { c.beginPath(); c.moveTo(x, s * 0.6); c.lineTo(x + s * 0.6 * 1.2, -s * 0.6); c.stroke(); }
      }
      if (key === 'ice') {
        c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineCap = 'round';
        c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(-s * 0.3, s * 0.05); c.lineTo(-s * 0.05, -s * 0.22); c.stroke();
        c.lineWidth = s * 0.045; c.beginPath(); c.moveTo(-s * 0.18, s * 0.22); c.lineTo(s * 0.18, -s * 0.12); c.stroke();
        c.strokeStyle = 'rgba(42,35,64,.28)'; c.lineWidth = lw * 0.5;
        c.beginPath(); c.moveTo(s * 0.12, s * 0.3); c.lineTo(s * 0.2, s * 0.15); c.lineTo(s * 0.32, s * 0.12); c.moveTo(s * 0.2, s * 0.15); c.lineTo(s * 0.18, s * 0.02); c.stroke();
      }
      D.shine(c, -s * 0.2, -s * 0.26, s * 0.16, s * 0.07, -0.25, key === 'lava' ? 0.3 : 0.45);
    } });
    if (key === 'warn') warnIcon(c, s, lw);
    if (key === 'd') drawGem(c, s * 0.3, ['#F2FAFF', '#B5E2FF', '#7CC4F2'], lw);
    if (key === 'g') { drawGem(c, s * 0.32, ['#FFFDF0', '#FFF0A8', '#F2C94C'], lw); sparkle(c, s * 0.3, -s * 0.28, s * 0.1, '#FFFFFF'); sparkle(c, -s * 0.31, s * 0.22, s * 0.07, '#FFFFFF'); }
    if (key === 'f') snowflake(c, s * 0.3, lw);
  }
  function makeCanvas(px) { var cv = document.createElement('canvas'); cv.width = cv.height = px; return cv; }
  function buildSprites() {
    sprites = {}; halos = {}; tileAt = {};
    var px = Math.ceil(T * dpr);
    Object.keys(KIND).forEach(function (key) {
      var cv = makeCanvas(px), c = cv.getContext('2d');
      c.translate(px / 2, px / 2); c.scale(dpr, dpr); c.lineJoin = 'round'; c.lineCap = 'round';
      drawTileArt(c, key, T);
      sprites[key] = cv;
      var col = KIND[key][3];
      if (col) {
        var hp = Math.ceil(T * 2.2 * dpr), hv = makeCanvas(hp), hc = hv.getContext('2d'), gr = hc.createRadialGradient(hp / 2, hp / 2, 0, hp / 2, hp / 2, hp / 2);
        gr.addColorStop(0, hexA(col, 0.55)); gr.addColorStop(0.45, hexA(col, 0.22)); gr.addColorStop(1, hexA(col, 0));
        hc.fillStyle = gr; hc.fillRect(0, 0, hp, hp);
        halos[key] = hv;
      }
    });
  }
  function hexA(hex, a) { var v = parseInt(hex.slice(1), 16); return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')'; }

  /* ================= the room: a cosy games room at night, drawn once per size ================= */
  var room = null;
  function buildRoom() {
    room = makeCanvas(1); room.width = canvas.width; room.height = canvas.height;
    var c = room.getContext('2d'); c.scale(dpr, dpr);
    // the wall with soft wallpaper dots, and a string of warm fairy lights along each side wall, out of the way of
    // the floor (shared scenery kit)
    GGScene.wall(c, 0, 0, W, H, { pattern: 'dots', col: '#1D1734', top: '#2C2350', col2: 'rgba(255,255,255,.035)', size: 44 });
    var gx = [Math.max(14, BX - PAD - 26), Math.min(W - 14, BX + C * T + PAD + 26)];
    if (BX - PAD > 40) gx.forEach(function (x0, side) {
      GGScene.lights(c, x0, BY - 10, x0, BY + R * T + 10, { kind: 'fairy', wave: side ? 6 : -6, first: side });
    });
    // the floor's raised frame
    var fx = BX - PAD, fy = BY - PAD, fw = C * T + PAD * 2, fh = R * T + PAD * 2;
    D.shadow(c, fx + fw / 2, fy + fh + 6, fw * 0.52, 12);
    D.shape(c, D.rrPath(fx, fy, fw, fh, PAD + T * 0.18), D.tone(c, '#4A3F78', fy, fy + fh), { lw: 5, depth: 8, shade: 'rgba(0,0,0,.2)',
      shine: [fx + fw * 0.2, fy + PAD * 0.45, fw * 0.16, PAD * 0.18, 0, 0.18] });
    D.shape(c, D.rrPath(BX - 3, BY - 3, C * T + 6, R * T + 6, T * 0.22), '#1A1530', { lw: 3, depth: 0 });
  }

  /* ================= state ================= */
  var st = null, level = null, lvN = 1, phase = 'list';
  var view = [];          // per tile: { key, prev, at } for soft cross-fades between looks
  var parts = [], flyers = [], bubbles = [], hidden = {};
  var clock = 0, partyT = 0, hotT = -9, freezeVis = 0, sayTimer = 0;
  var PG = (function () { var p = {}; try { p = GG.getProgress('hotpaws') || {}; } catch (e) {} if (!Array.isArray(p.done)) p.done = []; p.done = p.done.filter(function (n) { return n >= 1 && n <= LEVELS.length; }); return p; })();
  function save() { try { GG.setProgress('hotpaws', PG); } catch (e) {} }
  function maxDone() { return PG.done.length ? Math.max.apply(null, PG.done) : 0; }
  function nextLevel() { for (var i = 1; i <= LEVELS.length; i++) if (PG.done.indexOf(i) < 0) return Math.min(i, maxDone() + 1); return LEVELS.length; }
  function unlocked(n) { return n <= maxDone() + 1; }

  function start(n, quiet) {
    lvN = clamp(n | 0, 1, LEVELS.length); level = LEVELS[lvN - 1];
    if (landscape()) { C = 9; R = 7; } else { C = 7; R = 9; }
    st = E.make(level, Math.floor(Math.random() * 2147483647), C, R);
    view = []; for (var i = 0; i < C * R; i++) view.push({ key: 'off', prev: 'off', at: -9 });
    parts = []; flyers = []; bubbles = []; hidden = {}; partyT = 0; hotT = -9; freezeVis = 0;
    phase = 'play'; paused = false;
    PG.last = lvN; save();
    $('levelLabel').textContent = 'Round ' + lvN;
    $('win').hidden = true; $('hud').hidden = false; $('listWrap').hidden = true;
    renderHud();
    say('Collect ' + level.goal + ' blue diamonds!', level.tip || null, level.tip ? 5 : 3);
    if (!quiet) track('Start level', { game: 'hotpaws', level: lvN });
    layout();
  }

  /* ================= the diamond count ================= */
  function renderHud() {
    var got = st ? st.got : 0, goal = st ? st.goal : 1;
    $('gotN').textContent = got; $('goalN').textContent = ' / ' + goal;
    var f = $('barFill'); f.style.width = Math.round(got / goal * 100) + '%'; f.classList.toggle('full', got >= goal);
    $('hud').setAttribute('aria-label', got + ' of ' + goal + ' diamonds');
  }
  function bumpHud(cls) { var h = $('hud'); if (reduceMotion && cls === 'bump') return; h.classList.remove(cls); void h.offsetWidth; h.classList.add(cls); if (cls === 'ouch') setTimeout(function () { h.classList.remove('ouch'); }, 900); }
  function say(text, small, secs) {
    var s = $('say');
    s.innerHTML = ''; s.appendChild(document.createTextNode(text));
    if (small) { var m = document.createElement('small'); m.textContent = small; s.appendChild(m); }
    s.classList.remove('hide'); sayTimer = secs || 2.5;
  }

  /* ================= what the engine says happened ================= */
  function hudPoint() { var r = $('hud').getBoundingClientRect(); return { x: r.left + 24, y: r.top + r.height / 2 }; }
  function handle(ev) {
    if (ev.type === 'step') Sound.step();
    else if (ev.type === 'bump') { Sound.bump(); buzz(8); }
    else if (ev.type === 'slide') { Sound.slide(); }
    else if (ev.type === 'spawn') { Sound.spawn(); }
    else if (ev.type === 'collect') {
      var it = ev.item, gold = it.kind === 'g';
      if (gold) { Sound.gold(); buzz([12, 40, 12]); } else { Sound.collect(ev.got); buzz(12); }
      burst(tx(it.c), ty(it.r), gold ? '#FFE27A' : '#9ED8FF', gold ? 14 : 9, 'star', 1);
      var hp = hudPoint();
      for (var i = 0; i < ev.value; i++) flyers.push({ kind: gold ? 'g' : 'd', x0: tx(it.c), y0: ty(it.r), x1: hp.x, y1: hp.y, t: -i * 0.08, dur: 0.55, done: function () { renderHud(); bumpHud('bump'); } });
      if (ev.value === 3) say('Golden diamond: 3 at once!', null, 1.6);
    } else if (ev.type === 'freeze') {
      Sound.freeze(); buzz([10, 30, 10]); freezeVis = 0.01;
      burst(tx(ev.item.c), ty(ev.item.r), '#FFFFFF', 12, 'flake', 1.2);
      say('Brrr! The lava is frozen.', null, 1.6);
    } else if (ev.type === 'thaw') Sound.thaw();
    else if (ev.type === 'hot') {
      hotT = clock;
      Sound.sizzle(); Sound.yowl(); setTimeout(Sound.boing, 120); buzz([40, 60, 40]);
      var x = tx(ev.c), y = ty(ev.r);
      for (var j = 0; j < (reduceMotion ? 3 : 8); j++) parts.push({ x: x + rand(-T * 0.3, T * 0.3), y: y + rand(-T * 0.1, T * 0.3), vx: rand(-30, 30), vy: rand(-90, -40) * (T / 60), life: 0, max: rand(0.6, 0.9), r: T * rand(0.09, 0.14), shape: 'puff', g: -20 });
      burst(x, y, '#FFB14A', reduceMotion ? 3 : 8, 'dot', 0.8);
      bubbles.push({ x: x, y: y - T * 0.6, t: 0, text: 'Hot paws!' });
      renderHud(); if (ev.lost) bumpHud('ouch');
      ev.drops.forEach(function (it, i) {
        hidden[it.id] = 1;
        Sound.drop(0.35 + i * 0.1);
        flyers.push({ kind: 'd', x0: x, y0: y - T * 0.3, x1: tx(it.c), y1: ty(it.r), t: -0.25 - i * 0.1, dur: 0.6, arc: T * 1.4, done: function () { delete hidden[it.id]; } });
      });
    } else if (ev.type === 'land') { Sound.land(); buzz(10); }
    else if (ev.type === 'win') winSeq();
  }

  /* ================= effects ================= */
  function burst(x, y, col, n, shape, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1) * (T / 60);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * (T / 60), life: 0, max: rand(0.45, 0.8), r: rand(2.5, 5) * (T / 60), col: col, shape: shape, rot: rand(0, TAU), vr: rand(-6, 6), g: 380 });
    }
  }
  function drawParts(c, dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i]; q.life += dt;
      if (q.life >= q.max) { parts.splice(i, 1); continue; }
      q.vy += q.g * dt; q.vx *= 0.98; q.x += q.vx * dt; q.y += q.vy * dt; q.rot = (q.rot || 0) + (q.vr || 0) * dt;
      var a = 1 - q.life / q.max;
      c.save(); c.globalAlpha = Math.min(1, a * 1.8); c.translate(q.x, q.y); c.rotate(q.rot);
      if (q.shape === 'puff') { c.fillStyle = 'rgba(255,246,232,.85)'; c.beginPath(); c.arc(0, 0, q.r * (1 + q.life * 2.2), 0, TAU); c.fill(); }
      else if (q.shape === 'star') sparkle(c, 0, 0, q.r * 1.6, q.col);
      else if (q.shape === 'flake') { c.strokeStyle = q.col; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); for (var k = 0; k < 3; k++) { var an = k * Math.PI / 3; c.moveTo(-Math.cos(an) * q.r * 1.4, -Math.sin(an) * q.r * 1.4); c.lineTo(Math.cos(an) * q.r * 1.4, Math.sin(an) * q.r * 1.4); } c.stroke(); }
      else if (q.shape === 'confetti') { c.fillStyle = q.col; c.fillRect(-q.r, -q.r * 0.5, q.r * 2, q.r); }
      else { c.beginPath(); c.arc(0, 0, q.r, 0, TAU); c.fillStyle = q.col; c.fill(); }
      c.restore();
    }
  }
  var gemIcons = {};
  function gemIcon(kind) {
    if (gemIcons[kind + T]) return gemIcons[kind + T];
    var px = Math.ceil(T * 0.8 * dpr), cv = makeCanvas(px), c = cv.getContext('2d');
    c.translate(px / 2, px / 2); c.scale(dpr, dpr); c.lineJoin = 'round';
    drawGem(c, T * 0.3, kind === 'g' ? ['#FFFDF0', '#FFE27A', '#E8B53A'] : ['#F2FAFF', '#7CC4FF', '#3B8FD6'], lwk());
    return (gemIcons[kind + T] = cv);
  }
  function drawFlyers(c, dt) {
    for (var i = flyers.length - 1; i >= 0; i--) {
      var f = flyers[i]; f.t += dt;
      if (f.t < 0) continue;
      var u = clamp(f.t / f.dur, 0, 1), k = ease(u), x = lerp(f.x0, f.x1, k), y = lerp(f.y0, f.y1, k) - Math.sin(u * Math.PI) * (f.arc || T * 0.8);
      var s = T * 0.8 * (f.arc ? 0.9 : lerp(1, 0.6, u));
      c.drawImage(gemIcon(f.kind), x - s / 2, y - s / 2, s, s);
      if (u >= 1) { flyers.splice(i, 1); if (f.done) f.done(); }
    }
  }
  function drawBubbles(c, dt) {
    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i]; b.t += dt;
      if (b.t > 1.4) { bubbles.splice(i, 1); continue; }
      var a = clamp((1.4 - b.t) / 0.35, 0, 1), rise = reduceMotion ? 0 : eout(b.t / 0.6) * T * 0.5;
      var size = Math.round(clamp(T * 0.42, 17, 34));
      c.save(); c.globalAlpha = a;
      c.font = '800 ' + size + 'px "Baloo 2", ui-rounded, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var w = c.measureText(b.text).width + size * 0.9, h = size * 1.35;
      var x = clamp(b.x, w / 2 + 8, W - w / 2 - 8), y = Math.max(h, b.y - rise - T * 0.4);
      D.shape(c, D.rrPath(x - w / 2, y - h / 2, w, h, h / 2), '#FFF8EC', { lw: 3, depth: 4 });
      c.fillStyle = '#E2452F'; c.fillText(b.text, x, y + size * 0.06);
      c.restore();
    }
  }

  /* ================= how each tile looks right now ================= */
  function keyFor(k) {
    if (st.heat[k] === 2) return 'lava';
    if (st.heat[k] === 1) return 'warn';
    var it = E.itemAt(st, k);
    if (it && !hidden[it.id]) return it.kind;
    if (st.safe[k]) return 'on';
    if (st.ice[k]) return 'ice';
    return 'off';
  }
  var FADE = 0.22;
  function drawFloor(c, now) {
    var party = phase === 'party' || phase === 'won';
    for (var k = 0; k < C * R; k++) {
      var v = view[k], key = keyFor(k);
      if (key !== v.key) { v.prev = v.key; v.key = key; v.at = now; }
    }
    // glow halos first, so light spills into the gaps between the tiles
    c.save(); c.globalCompositeOperation = 'lighter';
    var hs = T * 2.2;
    for (k = 0; k < C * R; k++) {
      var vv = view[k], x = tx(k % C), y = ty(Math.floor(k / C)), a = clamp((now - vv.at) / FADE, 0, 1);
      if (party) continue;
      if (halos[vv.key]) { c.globalAlpha = a * 0.75; c.drawImage(halos[vv.key], x - hs / 2, y - hs / 2, hs, hs); }
      if (a < 1 && halos[vv.prev]) { c.globalAlpha = (1 - a) * 0.75; c.drawImage(halos[vv.prev], x - hs / 2, y - hs / 2, hs, hs); }
    }
    c.restore();
    for (k = 0; k < C * R; k++) {
      var w = view[k], cx = tx(k % C), cy = ty(Math.floor(k / C)), al = clamp((now - w.at) / FADE, 0, 1);
      if (party) { drawRainbow(c, k, cx, cy, now); continue; }
      if (al < 1) drawTile(c, w.prev, cx, cy, now, 1, k);
      drawTile(c, w.key, cx, cy, now, al, k);
    }
    if (freezeVis > 0) drawFrost(c, now);
  }
  function drawTile(c, key, x, y, now, alpha, k) {
    if (alpha <= 0) return;
    c.save(); c.globalAlpha = alpha;
    var spr = sprites[key];
    c.drawImage(spr, x - T / 2, y - T / 2, T, T);
    if (key === 'lava') drawLava(c, x, y, now, k);
    else if (key === 'warn' && !reduceMotion && !(st && st.freeze > 0)) {
      // a slow, smooth glow (two beats a second, never a flash)
      var pulse = 0.5 + 0.5 * Math.sin(now * TAU * 2);
      c.globalAlpha = alpha * pulse * 0.28; c.fillStyle = '#FFF4C2'; c.fill(tilePathAt(x, y));
    } else if ((key === 'd' || key === 'g') && !reduceMotion) {
      var tw = (now * 0.7 + k * 0.37) % 2.4;
      if (tw < 0.5) { c.globalAlpha = alpha * Math.sin(tw / 0.5 * Math.PI); sparkle(c, x + T * 0.22, y - T * 0.24, T * 0.09, '#FFFFFF'); }
    }
    c.restore();
  }
  // tilePath is made at the origin; the pulse needs it at the tile
  var tileAt = {};
  function tilePathAt(x, y) {
    var key = x + ',' + y, p = tileAt[key];
    if (p) return p;
    p = new Path2D(); p.addPath(tilePath(T), new DOMMatrix().translate(x, y));
    return (tileAt[key] = p);
  }
  function drawLava(c, x, y, now, k) {
    var p = tilePathAt(x, y), t = reduceMotion ? 0 : now;
    c.save(); c.clip(p);
    c.strokeStyle = 'rgba(255,190,80,.85)'; c.lineWidth = T * 0.09; c.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var yy = y - T * 0.26 + i * T * 0.26, ph = t * 1.6 + i * 1.7 + k;
      c.beginPath();
      for (var j = 0; j <= 8; j++) { var xx = x - T * 0.5 + j * T / 8, w = Math.sin(ph + j * 0.9) * T * 0.05; if (j) c.lineTo(xx, yy + w); else c.moveTo(xx, yy + w); }
      c.stroke();
    }
    // bubbles that swell and pop, slowly
    for (var b = 0; b < 2; b++) {
      var cyc = ((t * 0.55 + b * 0.5 + (k * 0.618) % 1) % 1), bx = x + (b ? T * 0.18 : -T * 0.16), by = y + (b ? -T * 0.12 : T * 0.16);
      var rr = T * (0.04 + cyc * 0.07);
      c.fillStyle = '#FFD45A'; c.beginPath(); c.arc(bx, by, rr, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(42,35,64,.55)'; c.lineWidth = Math.max(1.2, lwk() * 0.45); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(bx - rr * 0.35, by - rr * 0.35, rr * 0.3, 0, TAU); c.fill();
    }
    c.restore();
    c.lineWidth = lwk(); c.strokeStyle = INK; c.stroke(p);
  }
  function drawFrost(c, now) {
    var a = clamp(freezeVis, 0, 1) * 0.5;
    c.save(); c.globalAlpha = a;
    var fx = BX - PAD, fy = BY - PAD, fw = C * T + PAD * 2, fh = R * T + PAD * 2;
    var g = c.createLinearGradient(fx, fy, fx, fy + fh); g.addColorStop(0, 'rgba(200,240,255,.55)'); g.addColorStop(1, 'rgba(200,240,255,.25)');
    c.fillStyle = g; c.fill(D.rrPath(fx, fy, fw, fh, PAD + T * 0.18));
    c.globalAlpha = a * 1.6; c.fillStyle = '#FFFFFF';
    for (var i = 0; i < 14; i++) {
      var sx = fx + ((i * 97.3) % fw), sy = fy + (((i * 53.1) + (reduceMotion ? 0 : now * 18)) % fh);
      c.save(); c.translate(sx, sy); snowflakeDots(c, T * 0.08); c.restore();
    }
    c.restore();
  }
  function snowflakeDots(c, r) { c.beginPath(); for (var k = 0; k < 6; k++) { var an = k * Math.PI / 3; c.moveTo(0, 0); c.lineTo(Math.cos(an) * r, Math.sin(an) * r); } c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.6; c.lineCap = 'round'; c.stroke(); }
  /* the celebration: a rainbow that rolls slowly across the floor (fixed for reduced motion) */
  function drawRainbow(c, k, x, y, now) {
    var r = Math.floor(k / C), q = k % C, hue = ((r + q) * 28 - (reduceMotion ? 0 : partyT * 110)) % 360;
    if (hue < 0) hue += 360;
    var fade = clamp(partyT / 0.5, 0, 1);
    var p = tilePathAt(x, y);
    c.save();
    var g = c.createRadialGradient(x - T * 0.12, y - T * 0.16, T * 0.05, x, y, T * 0.62);
    g.addColorStop(0, 'hsl(' + hue + ',100%,88%)'); g.addColorStop(0.55, 'hsl(' + hue + ',85%,64%)'); g.addColorStop(1, 'hsl(' + hue + ',70%,48%)');
    c.globalAlpha = fade; c.fillStyle = g; c.fill(p);
    D.shine(c, x - T * 0.2, y - T * 0.26, T * 0.16, T * 0.07, -0.25, 0.45 * fade);
    c.globalAlpha = 1; c.lineWidth = lwk(); c.strokeStyle = INK; c.stroke(p);
    c.restore();
  }

  /* ================= the cat ================= */
  var catStep = 0, catSize = 0;
  function catPose() {
    var cat = st.cat, x, y, lift = 0, moving = false, face = 'open', scale = 1, dir = cat.dir, tilt = 0;
    if (cat.hop) {
      var u = clamp(cat.hop.t / cat.hop.dur, 0, 1), k = ease(u);
      x = lerp(tx(cat.hop.fc), tx(cat.hop.tc), k); y = lerp(ty(cat.hop.fr), ty(cat.hop.tr), k);
      lift = Math.sin(u * Math.PI) * T * (reduceMotion ? 0.35 : 1.0); scale = 1 + Math.sin(u * Math.PI) * (reduceMotion ? 0.05 : 0.22);
      moving = true; face = 'surprised'; tilt = reduceMotion ? 0 : Math.sin(u * Math.PI * 4) * 0.12;
    } else if (cat.m) {
      var m = cat.m, p = clamp(m.t / m.dur, 0, 1), e2 = m.slide ? p : ease(p);
      x = lerp(tx(m.fc), tx(m.tc), e2); y = lerp(ty(m.fr), ty(m.tr), e2);
      lift = m.slide ? 0 : Math.sin(p * Math.PI) * T * 0.16; moving = !m.slide; tilt = m.slide ? (dir || 1) * -0.12 : 0;
    } else { x = tx(cat.c); y = ty(cat.r); }
    var k0 = cat.r * C + cat.c;
    if (!cat.hop && st.heat[k0] === 1) face = 'surprised';
    if (phase === 'party' || phase === 'won') {
      face = 'happy';
      if (!reduceMotion) { var bt = partyT % 0.5; lift = Math.sin(bt / 0.5 * Math.PI) * T * 0.3; dir = Math.floor(partyT / 0.5) % 2 ? -1 : 1; moving = true; }
    }
    return { x: x, y: y, lift: lift, moving: moving, face: face, scale: scale, dir: dir || 1, tilt: tilt };
  }
  function drawCat(c, dt) {
    var p = catPose();
    if (p.moving) catStep += dt * 18;
    var size = T * 0.62 * p.scale, kk = size / 88;
    D.shadow(c, p.x, p.y + T * 0.3, T * 0.38 * (1 - p.lift / (T * 2.5)), T * 0.1);
    c.save();
    c.translate(p.x, p.y + T * 0.3 - p.lift);
    if (p.tilt) c.rotate(p.tilt);
    c.translate(33 * kk * p.dir, -67 * kk);
    var o = {}; for (var key in CAT) o[key] = CAT[key];
    o.pose = 'walk'; o.size = size; o.dir = p.dir; o.step = catStep; o.moving = p.moving; o.wag = clock * 3; o.face = p.face;
    GGCat.draw(c, o);
    c.restore();
  }

  /* ================= winning: the floor's rainbow light show, a dance, then Next round ================= */
  function winSeq() {
    phase = 'party'; partyT = 0;
    if (PG.done.indexOf(lvN) < 0) PG.done.push(lvN);
    PG.last = lvN; save();
    track('Finish level', { game: 'hotpaws', level: lvN });
    $('say').classList.add('hide');
    setTimeout(function () { Sound.party(); Sound.purr(1.4); Sound.mrrp(2.2); buzz([20, 50, 30, 50, 60]); }, 450);
    setTimeout(function () { renderHud(); }, 700);
  }
  function showWinCard() {
    phase = 'won';
    var hits = st.hits;
    $('winTitle').textContent = lvN >= LEVELS.length ? 'You did them all!' : 'Round ' + lvN + ' done!';
    $('winNote').textContent = level.goal + ' blue diamonds collected' + (hits === 0 ? ', and not one hot paw!' : '. Cool paws!');
    var last = lvN >= LEVELS.length;
    $('nextLabel').textContent = last ? 'All rounds' : 'Next round';
    $('win').hidden = false; $('nextBtn').focus();
  }

  /* ================= the list of rounds ================= */
  var TICK = '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#2A2340" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var LOCK = '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="2" fill="#FFC93C" stroke="#2A2340" stroke-width="1.8"/><path d="M5 7 V5 Q5 2 8 2 Q11 2 11 5 V7" fill="none" stroke="#2A2340" stroke-width="1.8"/></svg>';
  var listFrom = null;
  function openList(canClose) {
    var nx = nextLevel(), all = PG.done.length >= LEVELS.length;
    $('levels').innerHTML = LEVELS.map(function (lv) {
      var n = lv.n, done = PG.done.indexOf(n) >= 0, open = unlocked(n), next = n === nx && !done;
      return '<button class="lv' + (done ? ' done' : '') + (next ? ' next' : '') + '" type="button" data-n="' + n + '"' + (open ? '' : ' disabled') +
        ' aria-label="Round ' + n + (done ? ', done' : next ? ', next' : open ? '' : ', locked') + '">' + n + (done ? '<span class="tick">' + TICK + '</span>' : open ? '' : '<span class="lock">' + LOCK + '</span>') + '</button>';
    }).join('');
    $('listNote').textContent = all ? 'Every round done! Play any of them again.' : PG.done.length ? PG.done.length + ' of ' + LEVELS.length + ' rounds done. Rounds open one after another.' : 'Step on the blue diamonds. Keep your paws off the red lava!';
    $('listClose').hidden = !canClose;
    listFrom = phase; if (phase === 'play') phase = 'paused';
    $('listWrap').hidden = false;
    var b = $('levels').querySelector('.next') || $('levels').querySelector('.lv:not(:disabled)'); if (b) b.focus();
  }
  function closeList() { $('listWrap').hidden = true; if (phase === 'paused') phase = 'play'; }
  $('levels').addEventListener('click', function (e) {
    var b = e.target.closest('[data-n]'); if (!b || b.disabled) return;
    Sound.init(); start(+b.dataset.n);
  });
  $('listBtn').addEventListener('click', function () { openList(phase === 'play'); });
  $('listClose').addEventListener('click', closeList);
  $('winListBtn').addEventListener('click', function () { $('win').hidden = true; openList(false); });
  $('nextBtn').addEventListener('click', function () { Sound.init(); if (lvN >= LEVELS.length) { $('win').hidden = true; openList(false); } else start(lvN + 1); });
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); });
  renderSound();

  /* ================= input: swipe (hold to keep walking), tap a tile, arrow keys or WASD ================= */
  var held = null, holdFrom = 0, lastGo = -9;
  function canPlay() { return st && phase === 'play' && $('listWrap').hidden && $('win').hidden; }
  function go(dir) {
    if (!canPlay()) return;
    Sound.init();
    E.move(st, dir); lastGo = clock;
  }
  var ptr = null;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (!canPlay()) return;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, ax: e.clientX, ay: e.clientY, at: clock, swiped: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var dx = e.clientX - ptr.ax, dy = e.clientY - ptr.ay, th = clamp(T * 0.35, 16, 30);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
    var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    ptr.ax = e.clientX; ptr.ay = e.clientY;
    if (!ptr.swiped || held !== dir) { go(dir); holdFrom = clock; }
    ptr.swiped = true; held = dir;
  });
  function endPtr(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (!ptr.swiped && e.type === 'pointerup') tapAt(ptr.x, ptr.y);
    ptr = null; held = null;
  }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  function tapAt(x, y) {
    if (!canPlay()) return;
    // one step towards the tap (a tile next to the cat is exactly one step)
    var cat = st.cat, cx = tx(cat.c), cy = ty(cat.r), dx = x - cx, dy = y - cy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < T * 0.5) return;
    go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  }
  var KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
  var keyDir = null;
  window.addEventListener('keydown', function (e) {
    var d = KEYS[e.key];
    if (d === undefined || !canPlay()) return;
    e.preventDefault();
    if (e.repeat) return;
    keyDir = d; holdFrom = clock; go(d);
  });
  window.addEventListener('keyup', function (e) { if (KEYS[e.key] === keyDir) keyDir = null; });
  window.addEventListener('blur', function () { keyDir = null; held = null; });
  function holdWalk() {
    var d = keyDir !== null ? keyDir : held;
    if (d === null || !canPlay()) return;
    var cat = st.cat;
    if (cat.m || cat.hop) return;
    if (clock - holdFrom < 0.22 || clock - lastGo < 0.05) return;
    go(d);
  }

  /* ================= the frame ================= */
  var last = performance.now();
  function frame(now) {
    var real = Math.min(0.05, (now - last) / 1000); last = now;
    var dt = real * SPEED;
    clock += dt;
    if (sayTimer > 0) { sayTimer -= real; if (sayTimer <= 0) $('say').classList.add('hide'); }
    if (st && phase === 'play' && !paused) {
      holdWalk();
      E.update(st, dt);
      E.drain(st).forEach(handle);
    }
    if (st && (phase === 'party' || phase === 'won')) {
      partyT += dt;
      if (phase === 'party' && !reduceMotion && Math.random() < dt * 6) { var px = rand(BX, BX + C * T), py = rand(BY, BY + R * T * 0.6); burst(px, py, ['#FFD23F', '#FF8FAB', '#7CC4FF', '#7BD389', '#B48CFF'][Math.floor(rand(0, 5))], 6, Math.random() < 0.5 ? 'star' : 'confetti', 0.8); }
      if (phase === 'party' && partyT > 3.0) showWinCard();
    }
    if (st) {
      var target = st.freeze > 0 ? 1 : 0;
      freezeVis += (target - freezeVis) * Math.min(1, dt * 4); if (freezeVis < 0.01) freezeVis = 0;
    }
    var c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (room) c.drawImage(room, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (st) {
      drawFloor(c, clock);
      drawCat(c, dt);
      drawParts(c, dt);
      drawFlyers(c, dt);
      drawBubbles(c, dt);
    }
    requestAnimationFrame(frame);
  }

  /* ================= go ================= */
  layout();
  start(nextLevel(), true);
  phase = 'list';
  $('say').classList.add('hide'); sayTimer = 0;
  openList(false);
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  document.addEventListener('visibilitychange', function () { last = performance.now(); keyDir = null; held = null; });

  /* ================= test hook ================= */
  window.__hotpaws = {
    state: function () { return { level: lvN, phase: phase, got: st.got, goal: st.goal, hits: st.hits, t: st.t, rt: st.rt, cat: { r: st.cat.r, c: st.cat.c, busy: !!(st.cat.m || st.cat.hop) }, C: C, R: R, progress: JSON.parse(JSON.stringify(PG)) }; },
    jump: function (n) { start(n); },
    move: function (d) { go(d); },
    tap: function (r, c) { tapAt(tx(c), ty(r)); },
    st: function () { return st; },
    engine: E, levels: LEVELS,
    layout: function () { return { T: T, BX: BX, BY: BY, C: C, R: R, W: W, H: H }; },
    speed: function (k) { SPEED = k; },
    pause: function (v) { paused = !!v; },
    list: function () { openList(false); },
    hush: function () { $('say').classList.add('hide'); sayTimer = 0; }
  };
})();
