/* Cosy Kitchen: sushi hand roll, pancakes, burger, pizza and cat-shaped waffles.
   Everything is drawn in code on one canvas. Sounds are made with Web Audio (no files).
   The play area is a 640 x 640 square (logical units) scaled to fit between the top bar and tool tray. */
(function () {
  'use strict';

  var INK = GGDraw.INK;
  var TAU = Math.PI * 2;
  var SIZE = 640;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  /* drawing: the shared kit (shared/draw.js) keeps every game in one style */
  var D = GGDraw, rr = D.rr, ink = D.ink, seeded = D.seeded, shape = D.shape;
  /* Finished dishes and the food on them are drawn by shared/dishes.js (Cosy Home draws them too). */
  var DISH = GGDish.parts;
  var NORI = DISH.NORI, ROLL_R = DISH.ROLL_R, PLATES = DISH.PLATES, TONES = DISH.TONES, PATTY_TONES = DISH.PATTY_TONES, LAYER_H = DISH.LAYER_H;
  var PCX = DISH.PCX, PCY = DISH.PCY, PR = DISH.PR, SOY = DISH.SOY;
  var SX = DISH.SX, SY0 = DISH.SY0, SRY = DISH.SRY, STH = DISH.STH, PLATE2 = DISH.PLATE2, BX = DISH.BX, BY = DISH.BY;
  var drawMini = DISH.drawMini, grainBatch = DISH.grainBatch, drawHandroll = DISH.drawHandroll, drawSeed = DISH.drawSeed, drawPlateScene = DISH.drawPlateScene;
  var cakeInfo = DISH.cakeInfo, drawStackCake = DISH.drawStackCake;
  var stackOf = DISH.stackOf, drawStackScene = DISH.drawStackScene;
  var drawBunBottom = DISH.drawBunBottom, drawLayer = DISH.drawLayer, drawBurgerScene = DISH.drawBurgerScene;
  var ZX = DISH.ZX, ZY = DISH.ZY, ZRX = DISH.ZRX, ZRY = DISH.ZRY, ZSQ = ZRY / ZRX, PIZZA_TOPS = DISH.PIZZA_TOPS, drawPizzaTopping = DISH.drawPizzaTopping, drawPizzaScene = DISH.drawPizzaScene;
  function stackTop(d) { return DISH.stackTop(d || dish); }

  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ---------- sound (synthesised, soft) ---------- */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null;
    var on = GG.getSetting('sound', true);
    var loops = [];
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      loops.forEach(function (l) { l.build(); });
    }
    function ready() { return ac && on; }
    function env(g, t, a, peak, dec) {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    function noise(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
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
    /* A looping, filtered noise bed whose volume follows the player's movement. */
    function loop(kind) {
      var l = { src: null, g: null, f: null, level: 0 };
      l.build = function () {
        if (!ac || l.src) return;
        l.src = ac.createBufferSource(); l.src.buffer = noiseBuf; l.src.loop = true;
        l.f = ac.createBiquadFilter(); l.g = ac.createGain(); l.g.gain.value = 0;
        if (kind === 'stir') { l.f.type = 'lowpass'; l.f.frequency.value = 380; l.f.Q.value = 1.5; l.max = 0.16; }
        if (kind === 'sizzle') { l.f.type = 'highpass'; l.f.frequency.value = 3800; l.f.Q.value = 0.5; l.max = 0.09; }
        if (kind === 'rub') { l.f.type = 'bandpass'; l.f.frequency.value = 2600; l.f.Q.value = 0.9; l.max = 0.06; }
        if (kind === 'pour') {
          l.f.type = 'bandpass'; l.f.frequency.value = 900; l.f.Q.value = 4; l.max = 0.5;
          var lfo = ac.createOscillator(); lfo.frequency.value = 9; var lg = ac.createGain(); lg.gain.value = 350;
          lfo.connect(lg); lg.connect(l.f.frequency); lfo.start(); l.lfo = lfo;
        }
        l.src.connect(l.f); l.f.connect(l.g); l.g.connect(master); l.src.start();
      };
      l.set = function (v) {
        l.level = v;
        if (!ac) return; if (!l.src) l.build();
        l.g.gain.setTargetAtTime(clamp(v, 0, 1) * l.max, ac.currentTime, 0.05);
      };
      l.stop = function () {
        try { if (l.src) { l.src.stop(); l.src.disconnect(); } if (l.lfo) l.lfo.stop(); } catch (e) {}
        l.src = null; l.lfo = null;
        loops = loops.filter(function (x) { return x !== l; });
      };
      loops.push(l);
      if (ac) l.build();
      return l;
    }
    return {
      init: init,
      loop: loop,
      isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      chop: function () {
        var p = 0.9 + Math.random() * 0.2;
        tone({ f: 190 * p, to: 80, dur: 0.09, gain: 0.45 });
        noise({ freq: 2400 * p, q: 1.4, dur: 0.045, gain: 0.25 });
        noise({ type: 'highpass', freq: 6000, dur: 0.02, gain: 0.08, delay: 0.01 });
      },
      /* sticky rice: lots of tiny grainy clicks, with the odd soft squish */
      riceTick: function () { noise({ freq: 1800 + Math.random() * 3600, q: 3 + Math.random() * 5, dur: 0.006 + Math.random() * 0.016, gain: 0.05 + Math.random() * 0.08 }); },
      squish: function () { noise({ type: 'lowpass', freq: 260 + Math.random() * 260, q: 1.5, attack: 0.012, dur: 0.08 + Math.random() * 0.06, gain: 0.16 }); },
      clink: function () { tone({ f: 2300 + Math.random() * 900, dur: 0.04, gain: 0.03, type: 'triangle' }); },
      crack: function () { noise({ type: 'highpass', freq: 2500, dur: 0.03, gain: 0.25 }); noise({ type: 'highpass', freq: 3200, dur: 0.025, gain: 0.18, delay: 0.05 }); tone({ f: 260, to: 150, dur: 0.06, gain: 0.12 }); },
      whoosh: function () { noise({ freq: 1800, q: 0.7, attack: 0.04, dur: 0.12, gain: 0.07 }); },
      pop: function () { tone({ f: 420, to: 920, dur: 0.11, gain: 0.18, slide: 0.06 }); },
      plop: function () { tone({ f: 300, to: 140, dur: 0.12, gain: 0.25 }); noise({ type: 'lowpass', freq: 700, dur: 0.06, gain: 0.12 }); },
      sprinkle: function () {
        for (var i = 0; i < 3; i++) noise({ type: 'highpass', freq: 5000 + Math.random() * 3000, dur: 0.012, gain: 0.05 + Math.random() * 0.04, delay: Math.random() * 0.08 });
      },
      chime: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.09 });
          tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.09, type: 'triangle' });
        });
      },
      mew: function () {
        tone({ f: 700, to: 1050, dur: 0.16, gain: 0.07, type: 'triangle', slide: 0.12 });
        tone({ f: 1050, to: 760, dur: 0.22, gain: 0.07, type: 'triangle', delay: 0.14, slide: 0.2 });
      }
    };
  })();

  /* ---------- canvas setup ---------- */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var topbar = $('topbar'), tray = $('tray');
  var cw = 0, ch = 0, dpr = 1, S = 1, OX = 0, OY = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 4;
    // the play area stops above the tray so nothing at the bottom is hidden behind it
    var bot = tray.hidden ? ch - 8 : tray.getBoundingClientRect().top - 4;
    // the bar sizes itself to its buttons; the cat sits just above it
    if (!tray.hidden) document.documentElement.style.setProperty('--tray-h', Math.round(ch - tray.getBoundingClientRect().top) + 'px');
    var avail = Math.max(160, bot - top);
    S = Math.min((cw - 8) / SIZE, avail / SIZE);
    OX = (cw - SIZE * S) / 2; OY = top + (avail - SIZE * S) / 2;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });

  function toLogical(e) { return { x: (e.clientX - OX) / S, y: (e.clientY - OY) / S }; }

  /* ---------- particles (sparkles, crumbs, confetti) ---------- */
  var parts = [];
  function burst(x, y, n, opts) {
    opts = opts || {};
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, sp = (opts.speed || 160) * (0.4 + Math.random() * 0.8);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0), g: opts.gravity || 0,
        life: 0, max: (opts.life || 0.7) * (0.7 + Math.random() * 0.6), size: (opts.size || 9) * (0.6 + Math.random() * 0.8),
        color: opts.colors ? pick(opts.colors) : '#FFC93C', shape: opts.shape || 'star', rot: Math.random() * TAU
      });
    }
  }
  function updateParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.rot += dt * 4;
    }
  }
  function star(c, r) {
    c.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rad = i % 2 ? r * 0.42 : r; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    c.closePath();
  }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = Math.min(1, k * 1.5);
      c.fillStyle = p.color;
      if (p.shape === 'star') { star(c, p.size * (0.5 + k * 0.5)); c.fill(); }
      else if (p.shape === 'confetti') { c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      else { c.beginPath(); c.arc(0, 0, p.size / 2, 0, TAU); c.fill(); }
      c.restore();
    });
  }


  /* ---------- kitchen things several steps share ---------- */
  /* a progress ring, with an optional number in the middle */
  function drawRing(c, x, y, k, label) {
    c.beginPath(); c.arc(x, y, 34, 0, TAU); c.strokeStyle = 'rgba(42,35,64,.15)'; c.lineWidth = 12; c.stroke();
    if (k > 0) { c.beginPath(); c.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k, 0, 1)); c.strokeStyle = '#7BD389'; c.lineWidth = 12; c.lineCap = 'round'; c.stroke(); }
    if (label === undefined) return;
    c.save(); c.translate(x, y); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); ink(c, 3.5);
    c.fillStyle = INK; c.font = '800 22px ' + getComputedStyle(document.body).getPropertyValue('--display');
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, 0, 1); c.restore();
  }
  /* the cooking gauge: too early, just right (star), too late. cols: [early, burnt] colours */
  function drawGauge(c, x, t, T_OK, T_BURN, T_MAX, cols) {
    var x0 = x - 165, w = 330, y = 62, h = 34, z1 = w * T_OK / T_MAX, z2 = w * T_BURN / T_MAX;
    c.save(); rr(c, x0, y, w, h, 12); c.clip();
    c.fillStyle = cols[0]; c.fillRect(x0, y, z1, h); c.fillStyle = '#7BD389'; c.fillRect(x0 + z1, y, z2 - z1, h); c.fillStyle = cols[1]; c.fillRect(x0 + z2, y, w - z2, h);
    c.restore(); rr(c, x0, y, w, h, 12); ink(c, 3.5);
    c.save(); c.translate(x0 + (z1 + z2) / 2, y + h / 2); c.fillStyle = '#FFFFFF'; star(c, 12); c.fill(); c.restore();
    var mx = x0 + w * clamp(t / T_MAX, 0, 1);
    c.beginPath(); c.moveTo(mx, y - 4); c.lineTo(mx - 10, y - 18); c.lineTo(mx + 10, y - 18); c.closePath(); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 3);
    c.beginPath(); c.moveTo(mx, y - 2); c.lineTo(mx, y + h + 2); c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
  }
  /* a frying pan seen from above; grill = ridges for the burger pan; butter = a buttery shine */
  function drawPan(c, x, y, r, handle, grill, butter) {
    D.shadow(c, x + 6, y + 16, r + 8, r * 0.98);
    c.save(); c.translate(x, y); c.rotate(2.39);
    rr(c, r - 20, -16, 190, 32, 16); c.fillStyle = INK; c.fill();
    shape(c, D.rrPath(r + 60, -11, 100, 22, 11), handle, { lw: 4, depth: 4, dx: 0 });
    c.restore();
    shape(c, D.ellPath(x, y, r, r), D.tone(c, '#3B3F4A', y - r, y + r), {
      lw: 5, depth: 0, inside: function (c) {
        // the floor of the pan: in the shade of its wall at the top left, as a hollow is
        c.beginPath(); c.arc(x, y, r - 18, 0, TAU); c.fillStyle = '#4C5260'; c.fill();
        D.crescent(c, D.ellPath(x, y, r - 18, r - 18), 10, 'rgba(20,18,30,.22)', 7, 10);
        c.save(); c.beginPath(); c.arc(x, y, r - 18, 0, TAU); c.clip();
        if (grill) {
          c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 6; c.lineCap = 'round';
          for (var g = -3; g <= 3; g++) { var gx = x + g * 40, hh = Math.sqrt(Math.max(0, (r - 24) * (r - 24) - (g * 40) * (g * 40))); c.beginPath(); c.moveTo(gx, y - hh); c.lineTo(gx, y + hh); c.stroke(); }
        }
        if (butter) {
          c.beginPath(); c.arc(x, y, (r - 26) * butter, 0, TAU); c.fillStyle = 'rgba(255,236,170,.12)'; c.fill();
          c.fillStyle = 'rgba(255,240,190,.4)'; [[-50, 30, 26], [40, -40, 18], [60, 50, 12]].forEach(function (q) { c.beginPath(); c.ellipse(x + q[0] * butter, y + q[1] * butter, q[2] * butter, q[2] * 0.5 * butter, -0.5, 0, TAU); c.fill(); });
        }
        c.restore();
        c.beginPath(); c.arc(x, y, r - 9, -2.6, -1.6); c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
      }
    });
  }
  /* the big mixing bowl (rice, batter, washing, rising dough). Returns nothing; the inside is an ellipse at (cx, cy) RX x RY */
  var BOWLS = {
    rice: { base: '#E25C49', body: '#FF7E6B', inside: '#FFE1D9', dots: true },
    blue: { base: '#2E86C9', body: '#5EB7F0', inside: '#DDF0FF' },
    green: { base: '#3E9B54', body: '#7BD389', inside: '#E6F7E3', dots: true }
  };
  function drawBigBowl(c, cx, cy, kind) {
    var b = BOWLS[kind], RX = 214;
    D.shadow(c, cx, cy + 230, 150, 22);
    shape(c, D.ellPath(cx, cy + 214, 96, 20), D.darker(b.base, 0.05), { lw: 5, depth: 0 });
    shape(c, function (p) {
      p.moveTo(cx - RX, cy); p.bezierCurveTo(cx - RX, cy + 180, cx - 110, cy + 216, cx, cy + 216);
      p.bezierCurveTo(cx + 110, cy + 216, cx + RX, cy + 180, cx + RX, cy); p.closePath();
    }, D.tone(c, b.body, cy, cy + 216), {
      lw: 5, depth: 16, inside: function (c) {
        c.fillStyle = '#FFFFFF'; c.strokeStyle = '#FFFFFF'; c.lineWidth = 8;
        if (b.dots) for (var k = 0; k < 9; k++) { c.beginPath(); c.arc(cx - 170 + k * 42, cy + 96 + Math.sin(k) * 8, 9, 0, TAU); c.fill(); }
        else for (var j = 0; j < 3; j++) { c.beginPath(); c.ellipse(cx, cy + 34 + j * 38, RX + 4, 52 - j * 6, 0, 0.08, Math.PI - 0.08); c.stroke(); }
      }, shine: [cx - 160, cy + 60, 12, 40, 0.4, 0.2]
    });
    // the inside of the bowl: a hollow, so its shade is at the top left
    shape(c, D.ellPath(cx, cy, RX, 64), b.inside, { lw: 5, depth: 12, dx: 8, dy: 12, shade: 'rgba(42,35,64,.08)' });
  }
  /* the front of a little bowl, drawn over what's in it (x, y: the middle of its rim, r: half its width) */
  function drawBowlFront(c, x, y, r, col) {
    var k = r / 64;
    shape(c, function (p) { p.moveTo(x - r, y); p.bezierCurveTo(x - r, y + 46 * k, x + r, y + 46 * k, x + r, y); p.bezierCurveTo(x + 40 * k, y + 14 * k, x - 40 * k, y + 14 * k, x - r, y); p.closePath(); }, D.tone(c, col, y, y + 36 * k), { lw: 4, depth: 6 });
  }
  /* the little white plate at the side of the pan */
  function drawSidePlate(c, x, y, rx) {
    D.shadow(c, x, y + 8, rx, 24);
    shape(c, D.ellPath(x, y, rx, 26), '#FFFFFF', { lw: 4, depth: 5, dx: 0 });
  }
  /* the wooden chopping board (chopping, shaping the patty); hole: the hanging hole in its corner */
  function drawCuttingBoard(c, x, y, w, h, hole) {
    rr(c, x, y + 10, w, h, 34); c.fillStyle = 'rgba(42,35,64,.16)'; c.fill();
    shape(c, D.rrPath(x, y, w, h, 34), '#F2C48D', {
      lw: 5, depth: 10, inside: function (c) {
        c.strokeStyle = '#E0AD72'; c.lineWidth = 4; c.lineCap = 'round';
        for (var gy = y + 40; gy < y + h - 20; gy += 46) { c.beginPath(); c.moveTo(x + 40, gy); c.quadraticCurveTo(x + w / 2, gy + 12, x + w - 40, gy); c.stroke(); }
        if (hole) { c.beginPath(); c.arc(x + w - 42, y + 40, 14, 0, TAU); c.fillStyle = '#FFE3CC'; c.fill(); ink(c, 4); }
      }
    });
  }
  /* something held to pour (a jug, the flour bag): it tips over while held. spout: where the pour comes out, in its own space */
  function Pourer(o) {
    var t = 0;
    function pos() { var k = easeOut(t); return { x: lerp(o.rest.x, o.pour.x, k), y: lerp(o.rest.y, o.pour.y, k), a: lerp(0, o.tilt, k) }; }
    function mouth() { var q = pos(); return { x: q.x + Math.cos(q.a) * o.spout.x - Math.sin(q.a) * o.spout.y, y: q.y + Math.sin(q.a) * o.spout.x + Math.cos(q.a) * o.spout.y }; }
    return {
      near: function (p) { return dist(p, o.rest) < 110 || dist(p, pos()) < 110; },
      shown: function () { return t > 0.02; },
      update: function (hold, dt) { t += ((hold ? 1 : 0) - t) * Math.min(1, dt * 7); return hold && t > 0.75; },
      draw: function (c, pouring, toY, level) {
        var q = pos();
        if (pouring) {
          var m = mouth(); c.beginPath(); c.moveTo(m.x, m.y);
          for (var yy = m.y; yy < toY; yy += 8) c.lineTo(m.x + Math.sin(yy * 0.12 + performance.now() / 60) * 2.5, yy);
          c.strokeStyle = o.stream; c.lineWidth = o.width || 10; c.lineCap = 'round'; c.stroke();
        }
        o.draw(c, q.x, q.y, q.a, level);
      }
    };
  }
  var FLOUR_BAG = new Path2D();
  FLOUR_BAG.moveTo(-42, -50); FLOUR_BAG.lineTo(-30, -70); FLOUR_BAG.lineTo(30, -70); FLOUR_BAG.lineTo(42, -50); FLOUR_BAG.lineTo(42, 62); FLOUR_BAG.quadraticCurveTo(42, 70, 34, 70); FLOUR_BAG.lineTo(-34, 70); FLOUR_BAG.quadraticCurveTo(-42, 70, -42, 62); FLOUR_BAG.closePath();
  var FLOUR_LABEL = D.rrPath(-30, -16, 60, 54, 10);
  function drawFlourBag(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    shape(c, FLOUR_BAG, '#F6EBD6', {
      lw: 5, depth: 8, inside: function (c) {
        // the open top, full of flour
        c.beginPath(); c.ellipse(0, -66, 30, 7, 0, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 3);
      }
    });
    shape(c, FLOUR_LABEL, '#3FA7F5', {
      lw: 3, depth: 0, inside: function (c) {
        c.strokeStyle = '#FFE29A'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 30); c.lineTo(0, -6); c.stroke();
        [-2, 6, 14].forEach(function (yy) { c.beginPath(); c.moveTo(0, yy); c.lineTo(-9, yy - 8); c.moveTo(0, yy); c.lineTo(9, yy - 8); c.stroke(); });
      }
    });
    c.restore();
  }
  function flourPourer(rest, pour) { return Pourer({ rest: rest, pour: pour, tilt: -2.0, spout: { x: 0, y: -70 }, stream: 'rgba(255,255,255,.95)', width: 14, draw: drawFlourBag }); }
  function jugPourer(rest, pour, liquid, stream) {
    return Pourer({ rest: rest, pour: pour, tilt: -1.7, spout: { x: -52, y: -66 }, stream: stream, draw: function (c, x, y, a, level) { drawJug(c, x, y, a, liquid, level === undefined ? 1 : level); } });
  }
  /* a list of little timed callbacks a scene can run */
  function Timers() {
    var list = [];
    return { add: function (s, fn) { list.push({ t: s, fn: fn }); }, tick: function (dt) { for (var i = list.length - 1; i >= 0; i--) { list[i].t -= dt; if (list[i].t <= 0) { var f = list[i].fn; list.splice(i, 1); f(); } } } };
  }

  /* ---------- the kawaii cat ---------- */
  var Cat = (function () {
    var el = $('cat'), says = $('catSays'), timer = null, busyUntil = 0;
    return {
      show: function (text, ms) {
        var now = performance.now();
        if (now < busyUntil) return;
        busyUntil = now + (ms || 2200) + 400;
        says.textContent = text || 'Great job!';
        el.classList.add('show');
        Sound.mew();
        clearTimeout(timer);
        timer = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
      },
      hide: function () { clearTimeout(timer); el.classList.remove('show'); busyUntil = 0; }
    };
  })();

  /* ---------- tray (instructions, Next, tools) ---------- */
  var sayEl = $('say'), nextBtn = $('nextBtn'), toolsEl = $('tools');
  var onNext = null;
  function say(text) { sayEl.textContent = text; }
  function showNext(label, fn) { $('nextLabel').textContent = label || 'Next'; nextBtn.hidden = false; onNext = fn; }
  function hideNext() { nextBtn.hidden = true; onNext = null; }
  nextBtn.addEventListener('click', function () { Sound.init(); Sound.pop(); var f = onNext; hideNext(); if (f) f(); });



  /* ---------- food drawings (finished dishes and the little pieces on them: shared/dishes.js) ---------- */
  function drawPiece(c, kind, len, scale) {
    /* a long strip of filling, centred at 0,0, lying along the x axis */
    scale = scale || 1;
    c.save(); c.scale(scale, scale);
    if (kind === 'cucumber') {
      shape(c, D.rrPath(-len / 2, -8, len, 16, 7), '#4FAE5E', { lw: 4, depth: 3, dx: 0, inside: function (c) { rr(c, -len / 2 + 6, -3, len - 12, 6, 3); c.fillStyle = '#C9EDB4'; c.fill(); } });
    } else if (kind === 'avocado') {
      // pale flesh shading to green at the skin, which runs along the bottom inside the outline
      shape(c, D.rrPath(-len / 2, -11, len, 22, 11), D.tone(c, '#DCEA86', -11, 11), { lw: 4, depth: 0, inside: function (c) { c.beginPath(); c.moveTo(-len / 2, 9); c.lineTo(len / 2, 9); c.strokeStyle = '#5E8F33'; c.lineWidth = 5; c.stroke(); } });
    } else {
      shape(c, D.rrPath(-len / 2, -11, len, 22, 6), '#FF8A5B', {
        lw: 4, depth: 3, dx: 0, inside: function (c) {
          c.strokeStyle = '#FFD3BD'; c.lineWidth = 4;
          for (var x = -len / 2 - 20; x < len / 2 + 20; x += 22) { c.beginPath(); c.moveTo(x, -12); c.lineTo(x + 14, 12); c.stroke(); }
        }
      });
    }
    c.restore();
  }



  var BOWL_POS = [{ x: 170, y: 586 }, { x: 320, y: 586 }, { x: 470, y: 586 }];
  var BOWL_COLORS = ['#3FA7F5', '#FF7EB6', '#FFC93C'];
  var FILLINGS = ['cucumber', 'avocado', 'salmon'];

  var SMALL_BOWL = new Path2D(); SMALL_BOWL.moveTo(-58, 0); SMALL_BOWL.bezierCurveTo(-58, 46, 58, 46, 58, 0); SMALL_BOWL.closePath();
  function drawBowl(c, i, kind, amount, highlight, pos) {
    var b = pos || BOWL_POS[i], r = 58;
    c.save(); c.translate(b.x, b.y);
    if (highlight) { c.beginPath(); c.ellipse(0, 10, r + 16, r * 0.62 + 16, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.65)'; c.fill(); }
    D.shadow(c, 0, 36, r * 0.8, 8);
    shape(c, SMALL_BOWL, D.tone(c, BOWL_COLORS[i], 0, 36), { lw: 4, depth: 6 });
    shape(c, D.ellPath(0, 0, r, r * 0.3), '#FFFFFF', { lw: 4, depth: 5, dx: 4, dy: 5, shade: 'rgba(42,35,64,.1)' });
    if (amount > 0) {
      var rnd = seeded(i * 31 + 5), n = Math.round(6 * amount);
      for (var k = 0; k < n; k++) {
        var mx = (rnd() - 0.5) * 70, my = -2 + (rnd() - 0.5) * 12 - k * 1.2, mr = rnd() * TAU;
        if (PIZZA_TOPS.indexOf(kind) >= 0) { c.save(); c.translate(mx, my); c.scale(0.5, 0.5); drawPizzaTopping(c, { k: kind, r: Math.round(mr * 57) }); c.restore(); }
        else drawMini(c, kind, mx, my, mr);
      }
    }
    c.restore();
  }









  /* ---------- background: wall tiles + wooden counter, in screen space ---------- */
  function drawBackground(c) {
    c.fillStyle = '#FFE3CC'; c.fillRect(0, 0, cw, ch);
    var counterY = OY + 70 * S;
    var t = Math.max(26, 54 * S);
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3;
    for (var x = (cw / 2) % t; x < cw; x += t) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, counterY); c.stroke(); }
    for (var y = counterY % t; y < counterY; y += t) { c.beginPath(); c.moveTo(0, y); c.lineTo(cw, y); c.stroke(); }
    c.fillStyle = '#E9B57F'; c.fillRect(0, counterY, cw, ch - counterY);
    c.fillStyle = '#DDA36C';
    var plank = Math.max(40, 120 * S);
    for (var py = counterY + plank; py < ch; py += plank) c.fillRect(0, py, cw, 3);
    c.fillStyle = '#F4C995'; c.fillRect(0, counterY, cw, 10);
    c.fillStyle = INK; c.fillRect(0, counterY + 10, cw, 3);
  }

  /* ---------- the dish being made ---------- */
  var dish = null;
  function newDish() {
    var d = { plate: 0, leaves: [], ginger: [], wasabi: [], seeds: [], soy: 0, syrup: [], drips: [], tops: [], sugar: [], cakes: [], layers: [], patty: 'perfect', topBun: false };
    // a recipe can start from its own blank dish (pizza starts as plain dough)
    var f = recipe && recipe.fresh; if (f) for (var k in f) d[k] = JSON.parse(JSON.stringify(f[k]));
    return d;
  }

  /* =============== STEP: WASH THE RICE =============== */
  function WashScene() {
    var cx = 320, cy = 300, rx = 186, ry = 50;
    var rnd = seeded(5), grains = [];
    for (var i = 0; i < 700; i++) grains.push({ r: Math.sqrt(rnd()) * 0.9, th: rnd() * TAU, a: rnd() * Math.PI, l: 10 + rnd() * 3 });
    var phase = 'swish', clean = 0, lastAng = null, speed = 0, tilt = 0, water = 1, swipe = null, splash = Sound.loop('stir'), pour = Sound.loop('pour');
    return {
      enter: function () { say('Swish the rice to wash it'); },
      leave: function () { splash.stop(); pour.stop(); },
      hint: function (t) {
        if (phase === 'swish') { var a = t * 2.6; return { x: cx + Math.cos(a) * 130, y: cy + 8 + Math.sin(a) * 45, press: true }; }
        if (phase === 'tip') { var k = (t % 1.4) / 1.4; return { x: cx + 120 - k * 240, y: cy, press: k < 0.9 }; }
        return null;
      },
      down: function (p) { lastAng = null; swipe = p; },
      move: function (p) {
        if (phase === 'swish') {
          var nx = (p.x - cx) / rx, ny = (p.y - cy) / (ry * 2.2), rad = Math.hypot(nx, ny);
          if (rad < 0.12 || rad > 2.4) { lastAng = null; return; }
          var ang = Math.atan2(ny, nx);
          if (lastAng !== null) {
            var d = wrapAngle(ang - lastAng);
            if (Math.abs(d) < 1.2) {
              clean = Math.min(1, clean + Math.abs(d) / (TAU * 4)); speed = Math.min(1, speed + Math.abs(d) * 2.2);
              for (var i = 0; i < grains.length; i++) grains[i].th += d * (1.15 - grains[i].r * 0.55);
              if (Math.random() < Math.abs(d)) burst(p.x, p.y, 1, { colors: ['rgba(255,255,255,.9)'], shape: 'dot', size: 9, speed: 40, gravity: -60, life: 0.6 });
            }
          }
          lastAng = ang;
          if (clean >= 1) { phase = 'tip'; swipe = null; splash.set(0); Sound.pop(); say('Clean! Swipe sideways to tip out the water'); }
        } else if (phase === 'tip' && swipe && Math.abs(p.x - swipe.x) > 90) { phase = 'pour'; swipe = null; Sound.whoosh(); }
      },
      up: function () { lastAng = null; swipe = null; },
      update: function (dt) {
        speed *= Math.pow(0.08, dt); splash.set(phase === 'swish' ? speed : 0);
        if (phase === 'pour') {
          tilt = Math.min(1, tilt + dt * 2); if (tilt >= 1) water = Math.max(0, water - dt * 0.8);
          pour.set(tilt >= 1 && water > 0 ? 0.9 : 0);
          if (water <= 0) { phase = 'back'; pour.set(0); }
        }
        if (phase === 'back') {
          tilt = Math.max(0, tilt - dt * 2);
          if (tilt <= 0) { phase = 'done'; Sound.chime(); buzz(20); Cat.show('Squeaky clean!'); say('Washed rice!'); showNext('Next', nextStep); }
        }
      },
      draw: function (c) {
        var a = -0.35 * easeOut(tilt);
        c.save(); c.translate(cx, cy + 210); c.rotate(a); c.translate(-cx, -cy - 210);
        drawBigBowl(c, cx, cy, 'green');
        c.beginPath(); c.ellipse(cx, cy + 8, rx, ry, 0, 0, TAU); c.fillStyle = '#F1EAD9'; c.fill();
        grainBatch(c, grains, function (g) { return cx + Math.cos(g.th) * g.r * rx; }, function (g) { return cy + 8 + Math.sin(g.th) * g.r * ry; }, function (g) { return g.a + g.th; });
        // the water: milky at first, clear once the rice is clean
        if (water > 0) {
          c.beginPath(); c.ellipse(cx, cy + 6, (rx + 10) * (0.6 + 0.4 * water), (ry + 6) * (0.6 + 0.4 * water), 0, 0, TAU);
          c.fillStyle = 'rgba(' + (phase === 'swish' ? Math.round(lerp(245, 170, clean)) + ',' + Math.round(lerp(243, 222, clean)) + ',' + Math.round(lerp(236, 255, clean)) + ',' + lerp(0.85, 0.45, clean) : '170,222,255,.45') + ')';
          c.fill();
          c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(cx - 70, cy - 10, 50, 7, -0.1, 0, TAU); c.fill();
        }
        c.restore();
        // water pouring out over the rim into the sink
        if (phase === 'pour' && tilt >= 1 && water > 0) {
          var mx = cx - 205, my = cy + 70;
          c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(mx - 30, my + 60, mx - 26, 620); c.strokeStyle = 'rgba(170,222,255,.85)'; c.lineWidth = 16 * water + 4; c.lineCap = 'round'; c.stroke();
        }
        if (phase === 'swish') drawRing(c, cx, cy - 150, clean, Math.round(clean * 100) + '');
      }
    };
  }

  /* =============== STEP: COOK THE RICE =============== */
  function CookerScene() {
    var X = 320, Y = 330, phase = 'load', fly = 0, lid = 1, t = 0, COOK = 4.5, bubble = Sound.loop('stir');
    var BOWL = { x: 540, y: 560 }, BTN = { x: X, y: Y + 98 };
    function drawRice(c, x, y, s, fluffy) {
      c.save(); c.translate(x, y); c.scale(s, s);
      c.beginPath(); c.ellipse(0, 0, 110, 28, 0, 0, TAU); c.fillStyle = fluffy ? '#FFFFFF' : '#F1EAD9'; c.fill();
      var r = seeded(9); c.fillStyle = fluffy ? '#F4EEE2' : '#E3D9C2';
      for (var i = 0; i < 40; i++) { c.beginPath(); c.ellipse((r() - 0.5) * 190, (r() - 0.5) * 40, 5, 2.2, r() * 3, 0, TAU); c.fill(); }
      c.restore();
    }
    return {
      enter: function () { say('Tap the rice to put it in the cooker'); },
      leave: function () { bubble.stop(); },
      hint: function (k) {
        if (phase === 'load') return { x: BOWL.x, y: BOWL.y - 10, press: (k % 1.2) < 0.6 };
        if (phase === 'button') return { x: BTN.x, y: BTN.y, press: (k % 1.2) < 0.6 };
        if (phase === 'ready') return { x: X, y: Y - 90, press: (k % 1.2) < 0.6 };
        return null;
      },
      down: function (p) {
        if (phase === 'load' && dist(p, BOWL) < 100) { phase = 'fly'; fly = 0; Sound.whoosh(); }
        else if (phase === 'button' && dist(p, BTN) < 60) { phase = 'cook'; t = 0; Sound.pop(); buzz(10); say('Cooking...'); }
        else if (phase === 'ready' && Math.abs(p.x - X) < 200 && p.y < Y + 40) { phase = 'open'; Sound.whoosh(); }
      },
      update: function (dt) {
        bubble.set(phase === 'cook' ? 0.35 : 0);
        if (phase === 'fly') { fly = Math.min(1, fly + dt * 2); if (fly >= 1) { phase = 'close'; Sound.plop(); } }
        if (phase === 'close') { lid = Math.max(0, lid - dt * 2.5); if (lid <= 0) { phase = 'button'; Sound.pop(); say('Press the button!'); } }
        if (phase === 'cook') {
          t += dt;
          if (Math.random() < dt * 5) burst(X + 40, Y - 120, 1, { colors: ['rgba(255,255,255,.8)'], shape: 'dot', size: 22, speed: 20, gravity: -120, life: 1.2 });
          if (t >= COOK) { phase = 'ready'; Sound.chime(); say('Ding! Tap the lid to open it'); }
        }
        if (phase === 'open') {
          lid = Math.min(1, lid + dt * 2.5);
          if (lid >= 1) { phase = 'done'; burst(X, Y - 70, 20, { colors: ['rgba(255,255,255,.9)'], shape: 'dot', size: 24, speed: 120, gravity: -200, life: 1 }); Cat.show('Fluffy rice!'); say('Hot fluffy rice!'); showNext('Next', nextStep); }
        }
      },
      draw: function (c) {
        // little bowl of washed rice
        if (phase === 'load' || phase === 'fly') {
          c.beginPath(); c.ellipse(BOWL.x, BOWL.y, 64, 18, 0, 0, TAU); c.fillStyle = '#E6F7E3'; c.fill(); ink(c, 4);
          if (phase === 'load') drawRice(c, BOWL.x, BOWL.y - 2, 0.5, false);
          drawBowlFront(c, BOWL.x, BOWL.y, 64, '#7BD389');
        }
        // the cooker
        D.shadow(c, X, Y + 150, 190, 26);
        // the pink band runs right round the pot, so it's drawn inside the body and meets its outline exactly
        shape(c, D.rrPath(X - 180, Y - 60, 360, 210, 70), D.tone(c, '#FFFFFF', Y - 60, Y + 150), {
          lw: 5, depth: 14, inside: function (c) {
            c.fillStyle = '#FF9EC4'; c.fillRect(X - 190, Y + 40, 380, 26);
            c.beginPath(); c.moveTo(X - 190, Y + 40); c.lineTo(X + 190, Y + 40); c.moveTo(X - 190, Y + 66); c.lineTo(X + 190, Y + 66); ink(c, 3);
          }
        });
        shape(c, D.rrPath(X - 60, Y + 76, 120, 46, 18), '#EDE8F5', { lw: 4, depth: 5, dx: 4, dy: 5 });
        var lit = phase === 'cook' ? (Math.sin(performance.now() / 200) > 0 ? '#FF6B57' : '#FFB3A8') : phase === 'ready' || phase === 'open' || phase === 'done' ? '#7BD389' : '#FFC93C';
        shape(c, D.ellPath(BTN.x, BTN.y, 16, 16), lit, { lw: 3, depth: 4, shine: [BTN.x - 5, BTN.y - 5, 4, 3, -0.5] });
        // the lid is hinged at the back: open, it stands up behind the pot; closed, it's a dome over it
        var open = easeOut(lid);
        function drawLid(k) {
          c.save(); c.translate(X, lerp(Y - 58, Y - 150, k)); c.scale(1, lerp(1, 0.9, k));
          if (k > 0.5) { shape(c, D.ellPath(0, 0, 166, 70), '#E4E0EC', { lw: 5, depth: 8, inside: function (c) { c.beginPath(); c.ellipse(0, 0, 130, 48, 0, 0, TAU); c.fillStyle = '#C3CBD4'; c.fill(); ink(c, 3); } }); }
          else {
            var h = lerp(70, 10, k * 2);
            shape(c, function (p) { p.moveTo(-170, 0); p.bezierCurveTo(-170, -h * 1.4, 170, -h * 1.4, 170, 0); p.ellipse(0, 0, 170, 36, 0, 0, Math.PI); p.closePath(); }, '#F4F2F8', { lw: 5, depth: 10 });
            shape(c, D.rrPath(-22, -h * 1.05 - 10, 44, 20, 8), '#FF9EC4', { lw: 4, depth: 4 });
          }
          c.restore();
        }
        if (open > 0.5) drawLid(open);
        c.beginPath(); c.ellipse(X, Y - 58, 150, 40, 0, 0, TAU); c.fillStyle = '#C3CBD4'; c.fill(); ink(c, 4.5);
        c.beginPath(); c.ellipse(X, Y - 54, 132, 32, 0, 0, TAU); c.fillStyle = '#7E8794'; c.fill();
        if (phase !== 'load' && phase !== 'fly') drawRice(c, X, Y - 54, 1.1, phase === 'open' || phase === 'done');
        if (phase === 'fly') { var k = easeOut(fly); drawRice(c, lerp(BOWL.x, X, k), lerp(BOWL.y - 2, Y - 54, k) - Math.sin(k * Math.PI) * 120, lerp(0.5, 1.1, k), false); }
        if (open <= 0.5) drawLid(open);
        if (phase === 'cook') drawRing(c, X - 230, Y - 160, t / COOK);
      }
    };
  }

  /* =============== STEP: SEASON THE RICE =============== */
  function RiceScene() {
    var cx = 320, cy = 300, RX = 214, RY = 64, rx = 186, ry = 50;
    var rnd = seeded(7), grains = [];
    for (var i = 0; i < 1100; i++) grains.push({ r: Math.sqrt(rnd()) * 0.96, th: rnd() * TAU, a: rnd() * Math.PI, l: 10 + rnd() * 3 });
    var tickAcc = 0;
    var phase = 'pour', pour = 0, stir = 0, holding = false, bottleT = 0, lastAng = null, paddle = null, speed = 0, done = false;
    var stirLoop = Sound.loop('stir'), pourLoop = Sound.loop('pour');
    var REST = { x: 560, y: 190 }, POUR = { x: 440, y: 168 };

    function bottlePos() { return { x: lerp(REST.x, POUR.x, easeOut(bottleT)), y: lerp(REST.y, POUR.y, easeOut(bottleT)), a: lerp(0, -2.1, easeOut(bottleT)) }; }
    function mouth() { var b = bottlePos(); return { x: b.x + 96 * Math.sin(b.a), y: b.y - 96 * Math.cos(b.a) }; }

    function drawBottle(c) {
      var b = bottlePos();
      c.save(); c.translate(b.x, b.y); c.rotate(b.a);
      rr(c, -12, -84, 24, 46, 6); c.fillStyle = '#FFF4D6'; c.fill(); ink(c, 4.5);
      rr(c, -15, -100, 30, 18, 6); c.fillStyle = '#FF6B57'; c.fill(); ink(c, 4.5);
      rr(c, -32, -42, 64, 116, 18); c.fillStyle = '#FFF4D6'; c.fill(); ink(c, 5);
      c.save(); rr(c, -32, -42, 64, 116, 18); c.clip();
      c.fillStyle = '#F5D77A'; c.fillRect(-40, lerp(-10, 60, pour), 80, 120); c.restore();
      rr(c, -32, -42, 64, 116, 18); ink(c, 5);
      rr(c, -24, 4, 48, 40, 8); c.fillStyle = '#3FA7F5'; c.fill(); ink(c, 3.5);
      c.beginPath(); c.moveTo(-14, 26); c.quadraticCurveTo(-7, 16, 0, 26); c.quadraticCurveTo(7, 36, 14, 26); c.strokeStyle = '#FFFFFF'; c.lineWidth = 4; c.stroke();
      c.restore();
    }

    function drawPaddle(c, p) {
      var px = clamp(p.x, cx - rx + 20, cx + rx - 20), py = clamp(p.y, cy - 60, cy + 50);
      c.save(); c.translate(px, py); c.rotate(0.55);
      rr(c, -9, -190, 18, 150, 8); c.fillStyle = '#E8B26E'; c.fill(); ink(c, 4.5);
      c.beginPath(); c.ellipse(0, -20, 34, 44, 0, 0, TAU); c.fillStyle = '#F1C88E'; c.fill(); ink(c, 5);
      c.beginPath(); c.ellipse(-8, -30, 8, 16, 0.2, 0, TAU); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
      c.restore();
    }

    return {
      enter: function () { say('Hold the bottle to pour'); },
      leave: function () { stirLoop.stop(); pourLoop.stop(); },
      hint: function (t) {
        if (phase === 'pour') return { x: REST.x - 10, y: REST.y + 20, press: (t % 1.4) < 0.9 };
        if (phase === 'stir' && !done) { var a = t * 2.6; return { x: cx + Math.cos(a) * 130, y: cy + 8 + Math.sin(a) * 45, press: true }; }
        return null;
      },
      down: function (p) {
        if (phase === 'pour') { if (dist(p, REST) < 110 || dist(p, bottlePos()) < 110) holding = true; }
        else if (phase === 'stir' && !done) { lastAng = null; paddle = p; this.move(p); }
      },
      move: function (p) {
        if (phase !== 'stir' || done) return;
        paddle = p;
        var nx = (p.x - cx) / rx, ny = (p.y - cy) / (ry * 2.2), rad = Math.hypot(nx, ny);
        if (rad < 0.12 || rad > 2.4) { lastAng = null; return; }
        var ang = Math.atan2(ny, nx);
        if (lastAng !== null) {
          var d = wrapAngle(ang - lastAng);
          if (Math.abs(d) < 1.2) {
            stir = Math.min(1, stir + Math.abs(d) / (TAU * 5));
            speed = Math.min(1, speed + Math.abs(d) * 2.2);
            for (var i = 0; i < grains.length; i++) grains[i].th += d * (1.15 - grains[i].r * 0.55);
            if (Math.random() < Math.abs(d) * 0.8) burst(p.x, p.y, 1, { colors: ['#FFFFFF'], shape: 'dot', size: 6, speed: 40, life: 0.4 });
          }
        }
        lastAng = ang;
      },
      up: function () { holding = false; lastAng = null; paddle = null; },
      update: function (dt) {
        bottleT += ((holding && phase === 'pour' ? 1 : 0) - bottleT) * Math.min(1, dt * 7);
        if (phase === 'pour') {
          var pouring = holding && bottleT > 0.75;
          if (pouring) pour = Math.min(1, pour + dt * 0.45);
          pourLoop.set(pouring ? 0.8 : 0);
          if (pour >= 1) {
            phase = 'stir'; holding = false; pourLoop.set(0); Sound.pop();
            say('Stir in circles!');
          }
        }
        speed *= Math.pow(0.08, dt);
        stirLoop.set(speed);
        if (speed > 0.05 && !done) {
          tickAcc += dt * 80 * speed;
          while (tickAcc >= 1) { tickAcc -= 1; Sound.riceTick(); }
          if (Math.random() < dt * 5 * speed) Sound.squish();
        }
        if (stir >= 1 && !done) {
          done = true; stirLoop.set(0); Sound.chime(); buzz(20);
          burst(cx, cy, 26, { colors: ['#FFC93C', '#FFFFFF', '#FF7EB6'], speed: 260, life: 0.9 });
          Cat.show('Fluffy rice!');
          say('Shiny sushi rice!');
          showNext('Next', nextStep);
        }
      },
      draw: function (c) {
        drawBigBowl(c, cx, cy, 'rice');
        c.beginPath(); c.ellipse(cx, cy + 8, rx, ry, 0, 0, TAU); c.fillStyle = '#F1EAD9'; c.fill();
        // grains
        grainBatch(c, grains, function (g) { return cx + Math.cos(g.th) * g.r * rx; }, function (g) { return cy + 8 + Math.sin(g.th) * g.r * ry; }, function (g) { return g.a + g.th; });
        // vinegar soaks in as the rice is mixed
        var vin = pour * (1 - stir);
        if (vin > 0.01) { c.beginPath(); c.ellipse(cx + 20, cy + 8, rx * 0.6 * Math.sqrt(pour), ry * 0.6 * Math.sqrt(pour), 0, 0, TAU); c.fillStyle = 'rgba(245,200,80,' + (0.5 * vin + 0.05) + ')'; c.fill(); }
        // shine grows as the rice is mixed
        if (stir > 0.05) {
          c.globalAlpha = stir * 0.9; c.fillStyle = '#FFFFFF';
          for (var s = 0; s < 24; s++) { var g2 = grains[s * 37]; c.beginPath(); c.arc(cx + Math.cos(g2.th) * g2.r * rx, cy + 6 + Math.sin(g2.th) * g2.r * ry, 2.6, 0, TAU); c.fill(); }
          c.globalAlpha = 1;
        }
        // pouring stream
        if (phase === 'pour' && holding && bottleT > 0.75) {
          var m = mouth(); c.beginPath(); c.moveTo(m.x, m.y);
          for (var yy = m.y; yy < cy + 10; yy += 8) c.lineTo(m.x + Math.sin(yy * 0.12 + performance.now() / 60) * 2.5, yy);
          c.strokeStyle = 'rgba(240,195,70,.85)'; c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
        }
        if (phase === 'pour' || bottleT > 0.02) drawBottle(c);
        // progress ring for stirring
        if (phase === 'stir') drawRing(c, cx, cy - 150, stir, done ? '✓' : Math.round(stir * 100) + '');
        if (paddle && !done) drawPaddle(c, paddle);
      }
    };
  }

  /* =============== STEP 2: CHOP =============== */
  var ING = {
    cucumber: { len: 440, h: 96, cuts: 5, body: '#4FAE5E', face: '#DDF6CF', ring: '#4FAE5E', round: 48, label: 'cucumber' },
    avocado: { len: 380, h: 136, cuts: 4, body: '#3E6B2A', face: '#E2EC8C', ring: '#3E6B2A', round: 60, label: 'avocado', shape: 'pear' },
    salmon: { len: 420, h: 104, cuts: 4, body: '#FF8A5B', face: '#FFA27E', ring: '#FF8A5B', round: 20, label: 'salmon' },
    tomato: { len: 230, h: 200, cuts: 4, body: '#FF4D3D', face: '#FF8A70', face2: '#FFC9B0', ring: '#E8322B', round: 100, label: 'tomato' },
    onion: { len: 230, h: 200, cuts: 4, body: '#F4E9D8', face: '#FBF6EA', ring: '#E2CFAF', round: 100, label: 'onion', rings: true },
    banana: { len: 440, h: 84, cuts: 6, body: '#FFF0A8', face: '#FFF7D6', face2: '#F3E2A0', ring: '#E9D27A', round: 42, label: 'banana' },
    strawberry: { len: 280, h: 170, cuts: 3, body: '#FF4D5E', face: '#FF8F9C', face2: '#FFE0E4', ring: '#E83A4E', round: 60, label: 'strawberry', shape: 'pear', ratio: 0.2 },
    mushroom: { len: 250, h: 190, cuts: 3, body: '#F3E3CF', face: '#FBF3E6', ring: '#C9A882', round: 95, label: 'mushroom' },
    capsicum: { len: 300, h: 180, cuts: 4, body: '#3FB950', face: '#BFF0B0', face2: '#F2FFE6', ring: '#2E9A40', round: 80, label: 'capsicum' },
    pineapple: { len: 400, h: 150, cuts: 5, body: '#F2B43C', face: '#FFE680', face2: '#FFF6C0', ring: '#D99A1E', round: 56, label: 'pineapple' }
  };

  function ChopScene(list, onDone) {
    var cx = 320, cy = 290;
    var POS = list.length === 3 ? BOWL_POS : [{ x: 245, y: 586 }, { x: 395, y: 586 }];
    var idx = 0, cur = null, filled = list.map(function () { return 0; }), knife = null, trail = [], stroke = null, allDone = false;
    var timers = [];

    function later(sec, fn) { timers.push({ t: sec, fn: fn }); }

    function load(i) {
      var k = list[i], d = ING[k], guides = [];
      var span = d.len * 0.78;
      for (var g = 0; g < d.cuts; g++) guides.push({ x: -span / 2 + span * (g + 0.5) / d.cuts, cut: false, neat: false, open: 0 });
      cur = { kind: k, d: d, guides: guides, enter: 0, leave: -1, neat: 0, cuts: 0 };
      say(i === 0 ? 'Swipe down to slice!' : 'Slice the ' + d.label + '!');
    }

    /* avocado half: a pear shape with a big round end (right) and a smaller round end (left) */
    function pearH(d, x) {
      var L = d.len / 2, Rb = d.h / 2, Rs = Rb * (d.ratio || 0.62), xb = L - Rb, xs = -L + Rs, h = 0;
      if (Math.abs(x - xb) < Rb) h = Math.max(h, Math.sqrt(Rb * Rb - (x - xb) * (x - xb)));
      if (Math.abs(x - xs) < Rs) h = Math.max(h, Math.sqrt(Rs * Rs - (x - xs) * (x - xs)));
      if (x >= xs && x <= xb) h = Math.max(h, lerp(Rs, Rb, (x - xs) / (xb - xs)));
      return h;
    }
    function halfH(d, x) {
      if (d.shape === 'pear') return pearH(d, x);
      var L = d.len / 2, R = d.round, h = d.h / 2;
      var ax = Math.abs(x);
      if (ax <= L - R) return h;
      var dx = ax - (L - R);
      return Math.max(0, (h - R) + Math.sqrt(Math.max(0, R * R - dx * dx)));
    }

    function bodyPath(c, d) {
      if (d.shape !== 'pear') { rr(c, -d.len / 2, -d.h / 2, d.len, d.h, d.round); return; }
      var L = d.len / 2, n = 96, i, x;
      c.beginPath();
      for (i = 0; i <= n; i++) { x = -L + 2 * L * i / n; c.lineTo(x, -pearH(d, x)); }
      for (i = n; i >= 0; i--) { x = -L + 2 * L * i / n; c.lineTo(x, pearH(d, x)); }
      c.closePath();
    }

    function drawBody(c, cur) {
      var d = cur.d, k = cur.kind;
      bodyPath(c, d); c.fillStyle = d.body; c.fill();
      c.save(); bodyPath(c, d); c.clip();
      if (k === 'cucumber') {
        c.fillStyle = '#6CC67A'; c.fillRect(-d.len / 2, -d.h / 2 + 12, d.len, 14);
        c.fillStyle = '#2F7D3E';
        var rnd = seeded(3); for (var i = 0; i < 26; i++) { c.beginPath(); c.arc((rnd() - 0.5) * d.len * 0.95, (rnd() - 0.5) * d.h * 0.8, 3, 0, TAU); c.fill(); }
      } else if (k === 'avocado') {
        // cut side up: dark skin rim, creamy flesh, and the hollow where the stone was
        var pitX = d.len / 2 - d.h / 2 - 2, pitR = d.h * 0.25;
        c.save(); c.translate(pitX * 0.3, 0); c.scale(0.9, 0.8); c.translate(-pitX * 0.3, 0);
        var fg = c.createRadialGradient(pitX, 0, pitR * 0.6, pitX, 0, d.len * 0.5);
        fg.addColorStop(0, '#F7F3AE'); fg.addColorStop(0.45, '#E2EC8C'); fg.addColorStop(1, '#9CCB52');
        bodyPath(c, d); c.fillStyle = fg; c.fill();
        c.restore();
        c.beginPath(); c.arc(pitX, 0, pitR, 0, TAU); c.fillStyle = '#D9D47C'; c.fill();
        c.beginPath(); c.arc(pitX - 3, -4, pitR - 5, 0, TAU); c.fillStyle = '#EFEBA4'; c.fill();
        c.beginPath(); c.arc(pitX, 0, pitR, 0, TAU); c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 2.5; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-d.len * 0.18, -d.h * 0.16, d.len * 0.16, 6, -0.12, 0, TAU); c.fill();
      } else if (k === 'tomato') {
        c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-40, -50, 40, 16, -0.5, 0, TAU); c.fill();
      } else if (k === 'onion') {
        c.strokeStyle = '#E2CFAF'; c.lineWidth = 4;
        [-60, -25, 25, 60].forEach(function (ox) { c.beginPath(); c.moveTo(ox * 0.3, -d.h / 2); c.quadraticCurveTo(ox * 1.5, 0, ox * 0.3, d.h / 2); c.stroke(); });
        c.fillStyle = 'rgba(181,87,155,.18)'; c.beginPath(); c.ellipse(30, 20, 60, 50, 0, 0, TAU); c.fill();
      } else if (k === 'banana') {
        c.strokeStyle = '#F2DE8C'; c.lineWidth = 4;
        [-0.2, 0.15].forEach(function (f) { c.beginPath(); c.moveTo(-d.len / 2, d.h * f); c.quadraticCurveTo(0, d.h * f - 8, d.len / 2, d.h * f); c.stroke(); });
        c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-30, -d.h * 0.26, d.len * 0.3, 6, 0, 0, TAU); c.fill();
      } else if (k === 'strawberry') {
        c.fillStyle = '#FFF2A8';
        var sr = seeded(8); for (var si = 0; si < 34; si++) { var sx = (sr() - 0.5) * d.len, sy = (sr() - 0.5) * d.h; c.beginPath(); c.ellipse(sx, sy, 2.2, 3.2, 0.4, 0, TAU); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(10, -d.h * 0.22, d.len * 0.22, 9, -0.1, 0, TAU); c.fill();
      } else if (k === 'mushroom') {
        // brown cap on top, pale stalk underneath
        c.fillStyle = '#C98B5B'; c.beginPath(); c.ellipse(0, -d.h * 0.12, d.len * 0.56, d.h * 0.42, 0, Math.PI, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-30, -d.h * 0.34, 40, 12, -0.2, 0, TAU); c.fill();
        c.strokeStyle = '#C9A882'; c.lineWidth = 4; c.beginPath(); c.moveTo(-d.len / 2, -d.h * 0.12); c.quadraticCurveTo(0, -d.h * 0.02, d.len / 2, -d.h * 0.12); c.stroke();
      } else if (k === 'capsicum') {
        c.strokeStyle = '#2E9A40'; c.lineWidth = 5;
        [-0.18, 0.18].forEach(function (f) { c.beginPath(); c.moveTo(-d.len / 2, d.h * f); c.quadraticCurveTo(0, d.h * f * 1.6, d.len / 2, d.h * f); c.stroke(); });
        c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-40, -d.h * 0.28, 60, 10, -0.1, 0, TAU); c.fill();
      } else if (k === 'pineapple') {
        c.strokeStyle = '#C98420'; c.lineWidth = 3.5;
        for (var px = -d.len / 2 - 80; px < d.len / 2 + 80; px += 34) { c.beginPath(); c.moveTo(px, -d.h / 2); c.lineTo(px + 70, d.h / 2); c.moveTo(px + 70, -d.h / 2); c.lineTo(px, d.h / 2); c.stroke(); }
        c.fillStyle = '#8A5A2B'; for (var py = -d.len / 2 + 17; py < d.len / 2; py += 34) { c.beginPath(); c.arc(py + 18, 0, 3, 0, TAU); c.arc(py, -d.h / 4, 3, 0, TAU); c.arc(py, d.h / 4, 3, 0, TAU); c.fill(); }
      } else {
        c.strokeStyle = '#FFD3BD'; c.lineWidth = 7;
        for (var x = -d.len / 2 - 60; x < d.len / 2 + 60; x += 34) { c.beginPath(); c.moveTo(x, -d.h / 2); c.quadraticCurveTo(x + 30, 0, x + 10, d.h / 2); c.stroke(); }
      }
      // the banana's brown tips sit inside its outline
      if (k === 'banana') { c.fillStyle = '#8A5A2B'; c.beginPath(); c.ellipse(-d.len / 2 + 4, 0, 9, 12, 0, 0, TAU); c.ellipse(d.len / 2 - 4, 0, 9, 12, 0, 0, TAU); c.fill(); }
      // soft shade along the lower edge
      c.save(); c.translate(0, -12); bodyPath(c, d); c.restore(); c.rect(-d.len, -d.h, d.len * 2, d.h * 2); c.fillStyle = 'rgba(42,35,64,.1)'; c.fill('evenodd');
      c.restore();
      bodyPath(c, d); ink(c, 5);
      if (k === 'tomato') {
        c.save(); c.translate(0, -d.h / 2 + 6);
        for (var ti = 0; ti < 5; ti++) { c.save(); c.rotate(ti / 5 * TAU); c.beginPath(); c.ellipse(0, -12, 6, 14, 0, 0, TAU); c.fillStyle = '#4FAE5E'; c.fill(); ink(c, 2.5); c.restore(); }
        c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fillStyle = '#3E9B54'; c.fill(); ink(c, 2.5); c.restore();
      }
      if (k === 'onion') { c.save(); c.translate(0, -d.h / 2); c.beginPath(); c.moveTo(-8, 4); c.quadraticCurveTo(0, -22, 8, 4); c.closePath(); c.fillStyle = '#C9A26E'; c.fill(); ink(c, 2.5); c.restore(); }
      if (k === 'capsicum') { c.save(); c.translate(d.len / 2 - 4, 0); rr(c, -2, -9, 26, 18, 7); c.fillStyle = '#2E7D3A'; c.fill(); ink(c, 3); c.restore(); }
      if (k === 'pineapple') {
        c.save(); c.translate(d.len / 2 - 2, 0);
        for (var pl = 0; pl < 5; pl++) { c.save(); c.rotate(-0.9 + pl * 0.45); c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(30, -10, 52, 0); c.quadraticCurveTo(30, 10, 0, 6); c.closePath(); c.fillStyle = '#5CC46B'; c.fill(); ink(c, 3); c.restore(); }
        c.restore();
      }
      if (k === 'strawberry') {
        // leafy green top on the wide end
        c.save(); c.translate(d.len / 2 - 4, 0);
        for (var li = 0; li < 5; li++) {
          c.save(); c.rotate(-1.1 + li * 0.55);
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(16, -12, 34, 0); c.quadraticCurveTo(16, 12, 0, 0); c.closePath();
          c.fillStyle = '#5CC46B'; c.fill(); ink(c, 3); c.restore();
        }
        rr(c, 10, -5, 26, 10, 5); c.fillStyle = '#4FAE5E'; c.fill(); ink(c, 3);
        c.restore();
      }
    }

    function drawCutFace(c, cur, x) {
      var d = cur.d, hh = halfH(d, x) * 0.92;
      if (hh < 4) return;
      c.beginPath(); c.ellipse(x, 0, 7, hh, 0, 0, TAU); c.fillStyle = d.face; c.fill();
      if (d.shape === 'pear') { c.strokeStyle = d.ring; c.lineWidth = 5; c.stroke(); }
      ink(c, 3);
      if (d.face2) { c.beginPath(); c.ellipse(x, 0, 4, hh * 0.5, 0, 0, TAU); c.fillStyle = d.face2; c.fill(); }
      if (d.rings) { [0.72, 0.45, 0.2].forEach(function (f) { c.beginPath(); c.ellipse(x, 0, 6 * f + 1, hh * f, 0, 0, TAU); c.strokeStyle = 'rgba(181,87,155,.55)'; c.lineWidth = 2; c.stroke(); }); }
    }

    function drawIngredient(c) {
      if (!cur) return;
      var d = cur.d;
      var slide = cur.leave >= 0 ? 0 : (1 - easeBack(cur.enter)) * -600;
      var lt = cur.leave >= 0 ? easeOut(cur.leave) : 0;
      var target = POS[idx];
      c.save();
      c.translate(lerp(cx + slide, target.x, lt), lerp(cy, target.y - 10, lt));
      c.scale(1 - 0.8 * lt, 1 - 0.8 * lt);
      c.globalAlpha = 1 - lt * 0.6;
      // shadow
      D.shadow(c, 0, d.h / 2 + 8, d.len / 2, 12);
      var cutXs = cur.guides.filter(function (g) { return g.cut; }).sort(function (a, b) { return a.x - b.x; });
      var bounds = [-d.len / 2 - 70].concat(cutXs.map(function (g) { return g.x; }), [d.len / 2 + 70]);
      for (var s = 0; s < bounds.length - 1; s++) {
        var mid = (bounds[s] + bounds[s + 1]) / 2, off = 0;
        cutXs.forEach(function (g) { off += (mid > g.x ? 1 : -1) * 7 * easeOut(g.open); });
        c.save(); c.translate(off, 0);
        c.beginPath(); c.rect(bounds[s], -200, bounds[s + 1] - bounds[s], 400); c.clip();
        drawBody(c, cur);
        if (s > 0) drawCutFace(c, cur, bounds[s]);
        c.restore();
      }
      // guide lines
      if (cur.leave < 0) {
        cur.guides.forEach(function (g) {
          if (g.cut) return;
          c.setLineDash([12, 10]); c.lineDashOffset = -performance.now() / 40;
          c.beginPath(); c.moveTo(g.x, -d.h / 2 - 26); c.lineTo(g.x, d.h / 2 + 26);
          c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 5; c.stroke(); c.setLineDash([]);
          c.beginPath(); c.moveTo(g.x - 9, -d.h / 2 - 40); c.lineTo(g.x + 9, -d.h / 2 - 40); c.lineTo(g.x, -d.h / 2 - 28); c.closePath();
          c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 3);
        });
      }
      c.restore();
    }

    function drawKnife(c, p) {
      c.save(); c.translate(p.x, p.y); c.rotate(-0.12);
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(-6, -150); c.lineTo(30, -150); c.quadraticCurveTo(32, -40, -6, 0); c.closePath();
      c.fillStyle = '#E3E9F0'; c.fill(); ink(c, 4);
      c.beginPath(); c.moveTo(2, -136); c.lineTo(2, -40); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4; c.lineCap = 'round'; c.stroke();
      shape(c, D.rrPath(-8, -238, 34, 92, 12), D.tone(c, '#FF6B57', -238, -146), { lw: 4, depth: 5 });
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(9, -210, 4, 0, TAU); c.arc(9, -176, 4, 0, TAU); c.fill();
      c.restore();
    }

    function doCut(lx) {
      var best = null, bd = 1e9;
      cur.guides.forEach(function (g) { if (!g.cut) { var dd = Math.abs(g.x - lx); if (dd < bd) { bd = dd; best = g; } } });
      if (!best || bd > 85) { Sound.whoosh(); return; }
      best.cut = true; best.neat = bd < 24; best.open = 0; cur.cuts++;
      if (best.neat) cur.neat++;
      Sound.chop(); buzz(12);
      var wx = cx + best.x, wy = cy;
      burst(wx, wy - cur.d.h / 2, 5, { colors: [cur.d.face, cur.d.body], shape: 'dot', size: 8, speed: 120, gravity: 500, up: 80, life: 0.5 });
      if (best.neat) burst(wx, wy - cur.d.h / 2 - 20, 6, { colors: ['#FFC93C', '#FFFFFF'], speed: 150, life: 0.6 });
      if (cur.guides.every(function (g) { return g.cut; })) finishIngredient();
    }

    function finishIngredient() {
      var neatEnough = cur.neat >= Math.ceil(cur.guides.length / 2);
      later(0.45, function () {
        if (neatEnough) Cat.show(pick(['So neat!', 'Perfect slices!', 'Great job!']));
        cur.leave = 0;
      });
    }

    return {
      enter: function () { load(0); },
      leave: function () { },
      hint: function (t) {
        if (!cur || cur.leave >= 0 || cur.enter < 1) return null;
        var g = cur.guides.filter(function (q) { return !q.cut; })[0]; if (!g) return null;
        var k = (t % 1.4) / 1.4;
        return { x: cx + g.x, y: cy - cur.d.h / 2 - 50 + k * (cur.d.h + 100), press: k < 0.95 };
      },
      down: function (p) {
        knife = p; trail = [p];
        stroke = { minY: p.y - cy, maxY: p.y - cy, xs: [p.x - cx] };
      },
      move: function (p) {
        if (!knife) return;
        knife = p; trail.push(p); if (trail.length > 10) trail.shift();
        if (!cur || cur.leave >= 0 || cur.enter < 0.9 || !stroke) return;
        var lx = p.x - cx, ly = p.y - cy, d = cur.d;
        if (Math.abs(lx) > d.len / 2 + 50) { stroke = { minY: ly, maxY: ly, xs: [lx] }; return; }
        stroke.minY = Math.min(stroke.minY, ly); stroke.maxY = Math.max(stroke.maxY, ly);
        if (Math.abs(ly) < d.h / 2 + 10) stroke.xs.push(lx);
        if (stroke.minY < -d.h * 0.3 && stroke.maxY > d.h * 0.3) {
          var xs = stroke.xs.length ? stroke.xs : [lx];
          var avg = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
          doCut(avg);
          stroke = { minY: ly, maxY: ly, xs: [] };
        }
      },
      up: function () { knife = null; trail = []; stroke = null; },
      update: function (dt) {
        for (var i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { var f = timers[i].fn; timers.splice(i, 1); f(); } }
        if (!cur) return;
        cur.enter = Math.min(1, cur.enter + dt * 1.8);
        cur.guides.forEach(function (g) { if (g.cut) g.open = Math.min(1, g.open + dt * 5); });
        if (cur.leave >= 0) {
          cur.leave = Math.min(1, cur.leave + dt * 1.8);
          if (cur.leave >= 1) {
            filled[idx] = 1; Sound.plop();
            burst(POS[idx].x, POS[idx].y - 10, 10, { colors: ['#FFFFFF', '#FFC93C'], speed: 140, life: 0.5 });
            idx++;
            if (idx < list.length) load(idx);
            else {
              cur = null; allDone = true; Sound.chime();
              say('All chopped!');
              showNext('Next', onDone);
            }
          }
        }
      },
      draw: function (c) {
        // cutting board
        drawCuttingBoard(c, 50, 120, 540, 360, true);
        for (var b = 0; b < list.length; b++) drawBowl(c, b, list[b], filled[b], false, POS[b]);
        drawIngredient(c);
        if (trail.length > 1) {
          c.beginPath(); c.moveTo(trail[0].x, trail[0].y);
          for (var i = 1; i < trail.length; i++) c.lineTo(trail[i].x, trail[i].y);
          c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 10; c.lineCap = 'round'; c.stroke();
        }
        if (knife) drawKnife(c, knife);
      }
    };
  }

  /* =============== STEP 3: ROLL =============== */
  function RollScene() {
    var NX = 96, NY = 150, NW = 448, NH = 296;
    // rice covers the nori except a bare strip at the top, which seals the roll
    var ZX = 108, ZY = 198, ZW = 424, ZH = 236, COLS = 10, ROWS = 6, CW = ZW / COLS, CH = ZH / ROWS;
    var cells = [], rnd = seeded(11);
    for (var r = 0; r < ROWS; r++) for (var q = 0; q < COLS; q++) {
      var gx = ZX + (q + 0.5) * CW, gy = ZY + (r + 0.5) * CH, gs = [];
      for (var k = 0; k < 34; k++) gs.push({ x: gx + (rnd() - 0.5) * CW * 1.15, y: gy + (rnd() - 0.5) * CH * 1.15, a: rnd() * Math.PI, l: 10 + rnd() * 3 });
      cells.push({ x: gx, y: gy, on: false, t: 0, baked: false, grains: gs });
    }
    // finished rice is painted once into its own layer so hundreds of grains stay cheap to draw
    var RS = 2, riceCv = document.createElement('canvas'); riceCv.width = riceCv.height = SIZE * RS;
    var rc = riceCv.getContext('2d'); rc.scale(RS, RS);
    function riceBase(c, cell, k) { c.beginPath(); c.ellipse(cell.x, cell.y, CW * 0.66 * k, CH * 0.66 * k, 0, 0, TAU); c.fillStyle = '#F3ECDC'; c.fill(); }
    function bake(cell) { riceBase(rc, cell, 1); grainBatch(rc, cell.grains, function (g) { return g.x; }, function (g) { return g.y; }, function (g) { return g.a; }); cell.baked = true; }

    var phase = 'rice', bowls = [1, 1, 1], placed = [], roll = 0, rollStart = null, rollBase = 0, rubbing = null, done = false, settle = 0;
    var rubLoop = Sound.loop('rub');
    var rubSpeed = 0, lastP = null, tickAcc = 0;
    var LINE = { salmon: 290, cucumber: 316, avocado: 342 }, FILL_X = 320, FILL_LEN = 380;

    function coverage() { return cells.filter(function (c) { return c.on; }).length / cells.length; }
    function rub(p) {
      cells.forEach(function (cell) { if (!cell.on && Math.hypot(cell.x - p.x, (cell.y - p.y) * 1.1) < 50) cell.on = true; });
      if (lastP) rubSpeed = Math.min(1, rubSpeed + dist(p, lastP) / 60);
      lastP = p;
      if (coverage() >= 0.85 && phase === 'rice') {
        cells.forEach(function (c) { c.on = true; });
        phase = 'fill'; rubLoop.set(0); Sound.chime();
        Cat.show('So fluffy!');
        say('Tap a bowl to add it');
      }
    }

    function drawFlat(c) {
      shape(c, D.rrPath(NX, NY, NW, NH, 8), NORI, {
        lw: 5, depth: 8, shade: 'rgba(16,26,22,.3)', inside: function (c) {
          c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 3;
          var r2 = seeded(4); for (var i = 0; i < 26; i++) { var x = NX + r2() * NW, y = NY + r2() * NH; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y + 6); c.stroke(); }
        }
      });
      if (phase === 'rice') {
        c.setLineDash([12, 10]); rr(c, ZX - 4, ZY - 4, ZW + 8, ZH + 8, 18); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4; c.stroke(); c.setLineDash([]);
      }
      c.drawImage(riceCv, 0, 0, SIZE * RS, SIZE * RS, 0, 0, SIZE, SIZE);
      cells.forEach(function (cell) {
        if (!cell.on || cell.baked) return;
        var k = easeBack(cell.t);
        riceBase(c, cell, Math.max(0.05, k));
        grainBatch(c, cell.grains, function (g) { return cell.x + (g.x - cell.x) * k; }, function (g) { return cell.y + (g.y - cell.y) * k; }, function (g) { return g.a; }, Math.max(0.2, k));
      });
      placed.forEach(function (pl) {
        var t = easeOut(pl.t), from = BOWL_POS[pl.bowl];
        var x = lerp(from.x, FILL_X, t), y = lerp(from.y, LINE[pl.kind], t) - Math.sin(t * Math.PI) * 90;
        c.save(); c.translate(x, y); drawPiece(c, pl.kind, FILL_LEN, lerp(0.35, 1, t)); c.restore();
      });
    }

    function edgeY() { return lerp(NY + NH, NY + 50, easeOut(roll)); }
    function rollR() { return lerp(12, ROLL_R, easeOut(roll)); }

    return {
      enter: function () { say('Rub to spread the rice'); },
      leave: function () { rubLoop.stop(); },
      hint: function (t) {
        if (phase === 'rice') { var k = (t % 2.4) / 2.4; return { x: ZX + 60 + (Math.sin(k * TAU * 2) * 0.5 + 0.5) * (ZW - 120), y: ZY + 30 + k * (ZH - 60), press: true }; }
        if (phase === 'fill') { var i = bowls.indexOf(1); if (i < 0) return null; return { x: BOWL_POS[i].x, y: BOWL_POS[i].y - 10, press: (t % 1.2) < 0.6 }; }
        if (phase === 'roll' && !done) { var k2 = (t % 1.6) / 1.6; return { x: 320, y: 430 - k2 * 250, press: k2 < 0.9 }; }
        return null;
      },
      down: function (p) {
        if (phase === 'rice') { rubbing = true; lastP = null; rub(p); }
        else if (phase === 'fill') {
          for (var i = 0; i < 3; i++) {
            if (bowls[i] && Math.hypot(p.x - BOWL_POS[i].x, p.y - BOWL_POS[i].y) < 80) {
              bowls[i] = 0; placed.push({ kind: FILLINGS[i], bowl: i, t: 0, landed: false }); Sound.whoosh();
              break;
            }
          }
        } else if (phase === 'roll' && !done) { rollStart = p; rollBase = roll; }
      },
      move: function (p) {
        if (phase === 'rice' && rubbing) rub(p);
        else if (phase === 'roll' && rollStart && !done) {
          var nr = clamp(rollBase + (rollStart.y - p.y) / 240, roll, 1);
          if (nr > roll) rubSpeed = Math.min(1, rubSpeed + (nr - roll) * 8);
          roll = nr;
        }
      },
      up: function () { rubbing = null; lastP = null; rollStart = null; },
      update: function (dt) {
        cells.forEach(function (cell) {
          if (cell.on && cell.t < 1) { cell.t = Math.min(1, cell.t + dt * 4); }
          if (cell.on && cell.t >= 1 && !cell.baked) bake(cell);
        });
        rubSpeed *= Math.pow(0.05, dt); rubLoop.set(rubSpeed);
        if (rubSpeed > 0.05 && phase === 'rice') {
          tickAcc += dt * 45 * rubSpeed;
          while (tickAcc >= 1) { tickAcc -= 1; Sound.riceTick(); }
          if (Math.random() < dt * 2.5 * rubSpeed) Sound.squish();
        }
        placed.forEach(function (pl) {
          pl.t = Math.min(1, pl.t + dt * 2.2);
          if (pl.t >= 1 && !pl.landed) { pl.landed = true; Sound.pop(); burst(FILL_X, LINE[pl.kind], 6, { colors: ['#FFC93C', '#FFFFFF'], speed: 120, life: 0.5 }); }
        });
        if (phase === 'fill' && placed.length === 3 && placed.every(function (p) { return p.landed; })) {
          phase = 'roll'; say('Swipe up to roll!');
        }
        if (done) settle = Math.min(1, settle + dt * 2);
        if (phase === 'roll' && roll >= 1 && !done) {
          done = true; rubLoop.set(0); Sound.chime(); buzz(25);
          burst(320, 300, 30, { colors: ['#FFC93C', '#FF7EB6', '#7BD389', '#FFFFFF'], speed: 300, life: 1 });
          Cat.show('Perfect roll!');
          say('You made a hand roll!');
          showNext('Next', nextStep);
        }
      },
      draw: function (c) {
        // bamboo mat
        rr(c, 60, 130, 520, 356, 14); c.fillStyle = 'rgba(42,35,64,.16)'; c.fill();
        shape(c, D.rrPath(60, 120, 520, 356, 14), '#EED9A4', {
          lw: 5, depth: 8, inside: function (c) {
            c.strokeStyle = '#D6B877'; c.lineWidth = 3;
            for (var y = 136; y < 476; y += 20) { c.beginPath(); c.moveTo(60, y); c.lineTo(580, y); c.stroke(); }
            c.strokeStyle = '#B9935A'; c.lineWidth = 4; c.beginPath(); c.moveTo(140, 120); c.lineTo(140, 476); c.moveTo(500, 120); c.lineTo(500, 476); c.stroke();
          }
        });
        for (var b = 0; b < 3; b++) drawBowl(c, b, FILLINGS[b], bowls[b], phase === 'fill' && bowls[b]);
        if (roll <= 0) { drawFlat(c); }
        else {
          var ye = edgeY(), r = rollR();
          if (roll < 1) { c.save(); c.beginPath(); c.rect(0, 0, SIZE, ye); c.clip(); drawFlat(c); c.restore(); }
          var yc = done ? lerp(ye, 300, easeOut(settle)) : ye;
          drawHandroll(c, 320, yc, 1, 0, 400, r);
        }
        if (phase === 'roll' && !done) {
          var pulse = 0.6 + 0.4 * Math.sin(performance.now() / 250);
          c.save(); c.globalAlpha = (1 - roll) * pulse;
          [200, 440].forEach(function (x) {
            c.beginPath(); c.moveTo(x, 430); c.lineTo(x, 200);
            c.strokeStyle = '#FFFFFF'; c.lineWidth = 12; c.lineCap = 'round'; c.setLineDash([22, 16]); c.lineDashOffset = performance.now() / 30; c.stroke(); c.setLineDash([]);
            c.beginPath(); c.moveTo(x, 172); c.lineTo(x - 22, 204); c.lineTo(x + 22, 204); c.closePath(); c.fillStyle = '#FFFFFF'; c.fill();
          });
          c.restore();
        }
      }
    };
  }


  /* =============== STEP 4: PLATE =============== */
  /* Undo history for the decorating steps: snapshots of the parts of the dish a step can change */
  function History(keys) {
    var stack = [], pending = null;
    function snap() { var o = {}; keys.forEach(function (k) { o[k] = JSON.parse(JSON.stringify(dish[k])); }); return o; }
    var h = {
      snap: snap,
      push: function (o) { stack.push(o); if (stack.length > 60) stack.shift(); refreshUndo(); },
      now: function () { h.push(snap()); },
      begin: function () { pending = snap(); },
      end: function (changed) { if (pending && changed) h.push(pending); pending = null; },
      canUndo: function () { return stack.length > 0; },
      undo: function () { if (!stack.length) return false; var o = stack.pop(); keys.forEach(function (k) { dish[k] = o[k]; }); refreshUndo(); return true; }
    };
    return h;
  }
  var undoBtn = $('undoBtn'), undoHandler = null;
  function setUndo(hd) { undoHandler = hd; undoBtn.hidden = !hd; refreshUndo(); }
  function refreshUndo() { if (undoHandler) undoBtn.disabled = !undoHandler.canUndo(); }
  undoBtn.addEventListener('click', function () { Sound.init(); if (undoHandler && undoHandler.canUndo()) { undoHandler.undo(); Sound.pop(); } });










  var TOOL_ICONS = {
    plate: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#fff" stroke="#2A2340" stroke-width="3"/><circle cx="20" cy="20" r="10" fill="none" stroke="#3FA7F5" stroke-width="3"/></svg>',
    leaf: '<svg viewBox="0 0 40 40"><path d="M4 22 Q20 2 36 18 Q20 38 4 22 Z" fill="#5CC46B" stroke="#2A2340" stroke-width="3"/><path d="M6 22 L34 18" stroke="#3E9B54" stroke-width="2.5"/></svg>',
    sesame: '<svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="26" rx="6" fill="#FFF4D6" stroke="#2A2340" stroke-width="3"/><rect x="11" y="4" width="18" height="8" rx="3" fill="#FF6B57" stroke="#2A2340" stroke-width="3"/><ellipse cx="17" cy="24" rx="3" ry="1.8" fill="#2A2340"/><ellipse cx="23" cy="28" rx="3" ry="1.8" fill="#E8D3A6" stroke="#2A2340"/><ellipse cx="22" cy="20" rx="3" ry="1.8" fill="#E8D3A6" stroke="#2A2340"/></svg>',
    soy: '<svg viewBox="0 0 40 40"><path d="M14 4 H26 V10 Q34 14 33 24 V34 Q33 37 30 37 H10 Q7 37 7 34 V24 Q6 14 14 10 Z" fill="#5A2A12" stroke="#2A2340" stroke-width="3"/><rect x="12" y="2" width="16" height="6" rx="2" fill="#FF6B57" stroke="#2A2340" stroke-width="2.5"/><rect x="11" y="20" width="18" height="10" rx="2" fill="#fff"/></svg>',
    ginger: '<svg viewBox="0 0 40 40"><g stroke="#D9839A" stroke-width="2" fill="#FFD6DE"><path d="M4 24 Q6 15 15 16 Q22 14 24 22 Q22 30 13 29 Q5 30 4 24 Z" transform="rotate(20 14 23)"/><path d="M16 26 Q18 17 27 18 Q35 18 36 26 Q33 33 25 32 Q17 33 16 26 Z" transform="rotate(-25 26 25)"/><path d="M10 15 Q12 6 21 7 Q29 7 30 14 Q28 21 20 21 Q11 22 10 15 Z"/></g></svg>',
    wasabi: '<svg viewBox="0 0 40 40"><path d="M6 26 Q4 14 15 13 Q20 2 26 13 Q37 14 34 26 Q20 33 6 26 Z" fill="#9BD45A" stroke="#2A2340" stroke-width="3"/></svg>'
  };
  var TOOL_SAY = { leaf: 'Tap the plate for a leaf', sesame: 'Drag to sprinkle sesame', soy: 'Hold to pour soy sauce', ginger: 'Tap to add ginger', wasabi: 'Tap to add wasabi' };

  function PlateScene() {
    var tool = 'sesame', down = false, pointer = null, emit = 0, soyHold = false, bottleT = 0, ripple = 0, praised = false, actions = 0;
    var falling = [];
    var pourLoop = Sound.loop('pour');
    var hist = History(['leaves', 'ginger', 'wasabi', 'seeds', 'soy', 'plate']), changed = false;

    function setTool(t) {
      tool = t;
      toolsEl.querySelectorAll('.tool').forEach(function (b) { if (b.dataset.tool !== 'plate') b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
      say(TOOL_SAY[t]);
    }
    function onPlate(p, pad) { return Math.hypot(p.x - PCX, p.y - PCY) < PR - (pad || 0); }
    function countAction() {
      actions++;
      if (!praised && actions >= 6) { praised = true; later(0.3, function () { Cat.show(pick(['So pretty!', 'Looks yummy!'])); }); }
    }
    var timers = [];
    function later(s, fn) { timers.push({ t: s, fn: fn }); }

    function place(list, item, max) { list.push(item); if (list.length > max) list.shift(); }

    return {
      enter: function () {
        toolsEl.innerHTML = ['plate', 'leaf', 'sesame', 'soy', 'ginger', 'wasabi'].map(function (t) {
          var lbl = { plate: 'Plate', leaf: 'Leaf', sesame: 'Sesame', soy: 'Soy', ginger: 'Ginger', wasabi: 'Wasabi' }[t];
          return '<button class="tool" type="button" data-tool="' + t + '"' + (t === 'plate' ? '' : ' aria-pressed="false"') + '>' + TOOL_ICONS[t] + '<span>' + lbl + '</span></button>';
        }).join('');
        toolsEl.querySelectorAll('.tool').forEach(function (b) {
          b.addEventListener('click', function () {
            Sound.init();
            if (b.dataset.tool === 'plate') { hist.now(); dish.plate = (dish.plate + 1) % PLATES.length; Sound.pop(); burst(PCX, PCY - PR + 10, 8, { colors: ['#FFFFFF', '#FFC93C'], speed: 140, life: 0.5 }); say('New plate!'); return; }
            Sound.pop(); setTool(b.dataset.tool);
          });
        });
        setTool('sesame');
        say('Decorate your plate!');
        showNext('Done', finishDish);
        setUndo({ canUndo: hist.canUndo, undo: function () { if (hist.undo()) { falling.length = 0; say('Undone'); } } });
      },
      leave: function () { pourLoop.stop(); toolsEl.innerHTML = ''; },
      hint: function (t) {
        if (actions > 0) return null;
        var k = (t % 2) / 2; return { x: PCX - 120 + k * 240, y: PCY - 40 + Math.sin(k * TAU) * 40, press: true };
      },
      down: function (p) {
        down = true; pointer = p;
        if ((tool === 'leaf' && onPlate(p, 50)) || ((tool === 'ginger' || tool === 'wasabi') && onPlate(p, 30))) hist.now();
        if (tool === 'soy' || tool === 'sesame') { hist.begin(); changed = false; }
        if (tool === 'leaf' && onPlate(p, 50)) { place(dish.leaves, { x: p.x, y: p.y, a: Math.random() * TAU }, 12); Sound.plop(); countAction(); }
        if (tool === 'ginger' && onPlate(p, 30)) { place(dish.ginger, { x: p.x, y: p.y, a: Math.random() * TAU }, 10); Sound.pop(); countAction(); }
        if (tool === 'wasabi' && onPlate(p, 30)) { place(dish.wasabi, { x: p.x, y: p.y }, 8); Sound.plop(); countAction(); }
        if (tool === 'soy') soyHold = true;
        if (tool === 'sesame') emit = 1;
      },
      move: function (p) { pointer = p; },
      up: function () { if (tool === 'soy' || tool === 'sesame') hist.end(changed); down = false; soyHold = false; emit = 0; },
      update: function (dt) {
        for (var i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { var f = timers[i].fn; timers.splice(i, 1); f(); } }
        // sesame
        if (down && tool === 'sesame' && pointer) {
          emit += dt * 30;
          while (emit >= 1) {
            emit -= 1;
            if (falling.length + dish.seeds.length < 500) changed = true, falling.push({ x: pointer.x + (Math.random() - 0.5) * 34, y: pointer.y - 30 + (Math.random() - 0.5) * 10, vy: 40 + Math.random() * 40, land: pointer.y + 10 + Math.random() * 30, a: Math.random() * TAU, dark: Math.random() < 0.3 });
          }
          if (Math.random() < dt * 10) Sound.sprinkle();
        }
        for (var j = falling.length - 1; j >= 0; j--) {
          var s = falling[j]; s.vy += 900 * dt; s.y += s.vy * dt; s.a += dt * 6;
          if (s.y >= s.land) {
            falling.splice(j, 1);
            if (onPlate(s, 8)) { dish.seeds.push({ x: s.x, y: s.y, a: s.a, dark: s.dark }); if (dish.seeds.length % 40 === 0) countAction(); }
          }
        }
        // soy
        bottleT += ((soyHold ? 1 : 0) - bottleT) * Math.min(1, dt * 8);
        var pouring = soyHold && bottleT > 0.7 && dish.soy < 1;
        if (pouring) { changed = true; dish.soy = Math.min(1, dish.soy + dt * 0.4); ripple = (ripple + dt * 1.5) % 1; if (dish.soy >= 1) { countAction(); countAction(); } }
        pourLoop.set(pouring ? 0.7 : 0);
      },
      draw: function (c) {
        drawPlateScene(c, dish, { ripple: bottleT > 0.7 ? ripple : 0 });
        falling.forEach(function (s) { drawSeed(c, s.x, s.y, s.a, s.dark); });
        if (down && tool === 'sesame' && pointer) {
          c.save(); c.translate(pointer.x, pointer.y - 70); c.rotate(Math.PI + Math.sin(performance.now() / 70) * 0.25);
          rr(c, -22, -30, 44, 60, 12); c.fillStyle = '#FFF4D6'; c.fill(); ink(c, 4);
          rr(c, -20, 26, 40, 16, 5); c.fillStyle = '#FF6B57'; c.fill(); ink(c, 4);
          c.restore();
        }
        if (bottleT > 0.02) {
          var a = lerp(0, -1.9, easeOut(bottleT));
          c.save(); c.translate(SOY.x + 40, SOY.y - 130 + 40 * (1 - bottleT)); c.rotate(a); c.globalAlpha = Math.min(1, bottleT * 2);
          c.beginPath(); c.moveTo(-12, -70); c.lineTo(12, -70); c.lineTo(12, -50); c.quadraticCurveTo(34, -36, 32, -6); c.lineTo(32, 40); c.quadraticCurveTo(32, 48, 24, 48); c.lineTo(-24, 48); c.quadraticCurveTo(-32, 48, -32, 40); c.lineTo(-32, -6); c.quadraticCurveTo(-34, -36, -12, -50); c.closePath();
          c.fillStyle = '#5A2A12'; c.fill(); ink(c, 4.5);
          rr(c, -16, -82, 32, 16, 5); c.fillStyle = '#FF6B57'; c.fill(); ink(c, 4);
          rr(c, -22, 4, 44, 28, 5); c.fillStyle = '#FFFFFF'; c.fill();
          c.restore();
          if (bottleT > 0.7 && soyHold && dish.soy < 1) {
            var mx = SOY.x + 40 + 80 * Math.sin(a), my = SOY.y - 130 - 80 * Math.cos(a);
            c.beginPath(); c.moveTo(mx, my); c.lineTo(SOY.x - 4, SOY.y); c.strokeStyle = '#5A2A12'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
          }
        }
      }
    };
  }

  /* =============== PANCAKES =============== */
  var BATTER = '#F7DFA0';

  /* A milk or batter jug. (x, y) is the jug's middle, a is the tilt. */
  var JUG = new Path2D(); JUG.moveTo(-40, -52); JUG.lineTo(-52, -66); JUG.lineTo(-28, -60); JUG.lineTo(38, -60); JUG.lineTo(34, 50); JUG.quadraticCurveTo(0, 62, -34, 50); JUG.closePath();
  function drawJug(c, x, y, a, liquid, level) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(36, -30); c.quadraticCurveTo(70, -26, 66, 4); c.quadraticCurveTo(62, 30, 34, 28);
    c.strokeStyle = INK; c.lineWidth = 16; c.lineCap = 'round'; c.stroke(); c.strokeStyle = '#FFFFFF'; c.lineWidth = 8; c.stroke();
    shape(c, JUG, '#FFFFFF', {
      lw: 5, depth: 8, inside: function (c) {
        c.fillStyle = liquid; c.fillRect(-60, lerp(-46, 52, 1 - level), 120, 140);
        c.fillStyle = '#3FA7F5'; c.beginPath(); c.arc(-4, 6, 9, 0, TAU); c.arc(16, -10, 6, 0, TAU); c.fill();
      }
    });
    c.restore();
  }
  function jugMouth(x, y, a) { return { x: x + Math.cos(a) * -52 - Math.sin(a) * -66, y: y + Math.sin(a) * -52 + Math.cos(a) * -66 }; }

  /* ---- Step: mix the batter ---- */
  function BatterScene() {
    var cx = 320, cy = 300, RX = 214, RY = 64, rx = 186, ry = 50;
    var phase = 'flour', flourAmt = 0, spoons = 0, spoon = null, sugar = [], milk = 0, holding = false, whisk = 0, spin = 0, lastAng = null, tool = null, speed = 0, done = false, tickAcc = 0;
    var EB = { x: 566, y: 552 }, eggs = [{ x: 545, y: 520, rot: -0.25, state: 'wait', t: 0 }, { x: 589, y: 516, rot: 0.25, state: 'wait', t: 0 }], yolks = [];
    var pourLoop = Sound.loop('pour'), slosh = Sound.loop('stir');
    var REST = { x: 560, y: 210 }, POUR = { x: 470, y: 160 }, SB = { x: 90, y: 552 };
    var flourBag = flourPourer(REST, { x: 440, y: 150 }), jug = jugPourer(REST, POUR, '#EAF3FF', 'rgba(250,250,255,.95)');
    var rnd = seeded(13), flour = [];
    for (var i = 0; i < 160; i++) { var r = Math.sqrt(rnd()), th = rnd() * TAU; flour.push({ x: Math.cos(th) * r * 92, y: Math.sin(th) * r * 30 - (1 - r) * 22 }); }

    function eggTarget(i) { return { x: cx - 30 + i * 70, y: cy - 120 }; }

    function drawEgg(c, x, y, rot, open) {
      c.save(); c.translate(x, y); c.rotate(rot);
      if (!open) {
        c.beginPath(); c.ellipse(0, 0, 26, 33, 0, 0, TAU); c.fillStyle = '#FFF6E8'; c.fill(); ink(c, 4.5);
        c.beginPath(); c.ellipse(-8, -12, 6, 9, -0.3, 0, TAU); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill();
      } else {
        [-1, 1].forEach(function (sgn) {
          c.save(); c.translate(sgn * open * 30, -open * 10); c.rotate(sgn * open * 0.6);
          c.beginPath(); c.ellipse(0, 0, 26, 33, 0, sgn < 0 ? Math.PI / 2 : -Math.PI / 2, sgn < 0 ? Math.PI * 1.5 : Math.PI / 2);
          c.lineTo(0, -33); c.lineTo(sgn * 6, -20); c.lineTo(sgn * -4, -6); c.lineTo(sgn * 6, 8); c.lineTo(0, 33); c.closePath();
          c.fillStyle = '#FFF6E8'; c.fill(); ink(c, 4); c.restore();
        });
      }
      c.restore();
    }
    function drawWhisk(c, p) {
      var px = clamp(p.x, cx - rx + 30, cx + rx - 30), py = clamp(p.y, cy - 50, cy + 40);
      c.save(); c.translate(px, py); c.rotate(0.35 + Math.sin(spin * 3) * 0.08);
      rr(c, -10, -210, 20, 90, 9); c.fillStyle = '#FF7EB6'; c.fill(); ink(c, 4.5);
      c.strokeStyle = '#9AA6B2'; c.lineWidth = 4;
      [30, 20, 10].forEach(function (w) { c.beginPath(); c.ellipse(0, -60, w, 62, 0, 0, TAU); c.stroke(); });
      c.beginPath(); c.ellipse(0, -60, 34, 64, 0, 0, TAU); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
      c.restore();
    }

    return {
      enter: function () { say('Hold the bag to pour the flour'); },
      leave: function () { pourLoop.stop(); slosh.stop(); },
      hint: function (t) {
        if (phase === 'sugar') return spoon ? null : { x: SB.x, y: SB.y - 10, press: (t % 1.2) < 0.6 };
        if (phase === 'flour' || phase === 'milk') return { x: REST.x, y: REST.y + 10, press: (t % 1.4) < 0.9 };
        if (phase === 'eggs') { var e = eggs.filter(function (q) { return q.state === 'wait'; })[0]; return e ? { x: e.x, y: e.y, press: (t % 1.2) < 0.5 } : null; }
        if (phase === 'whisk' && !done) { var a = t * 2.6; return { x: cx + Math.cos(a) * 130, y: cy + 8 + Math.sin(a) * 45, press: true }; }
        return null;
      },
      down: function (p) {
        if (phase === 'flour') { if (flourBag.near(p)) holding = true; }
        else if (phase === 'sugar') { if (!spoon && dist(p, SB) < 90) { spoon = { t: 0 }; Sound.whoosh(); } }
        else if (phase === 'milk') { if (jug.near(p)) holding = true; }
        else if (phase === 'eggs') {
          // one egg at a time: only the egg nearest the finger, and only when no other egg is cracking
          var busy = eggs.some(function (e) { return e.state === 'fly' || e.state === 'crack'; });
          var best = null;
          eggs.forEach(function (e) { if (e.state === 'wait' && dist(p, e) < 60 && (!best || dist(p, e) < dist(p, best))) best = e; });
          if (best && !busy) { best.state = 'fly'; best.t = 0; Sound.whoosh(); }
        } else if (phase === 'whisk' && !done) { lastAng = null; tool = p; this.move(p); }
      },
      move: function (p) {
        if (phase !== 'whisk' || done) return;
        tool = p;
        var nx = (p.x - cx) / rx, ny = (p.y - cy) / (ry * 2.2), rad = Math.hypot(nx, ny);
        if (rad < 0.12 || rad > 2.4) { lastAng = null; return; }
        var ang = Math.atan2(ny, nx);
        if (lastAng !== null) {
          var d = wrapAngle(ang - lastAng);
          if (Math.abs(d) < 1.2) { whisk = Math.min(1, whisk + Math.abs(d) / (TAU * 6)); speed = Math.min(1, speed + Math.abs(d) * 2.2); spin += d; }
        }
        lastAng = ang;
      },
      up: function () { holding = false; lastAng = null; tool = null; },
      update: function (dt) {
        var flowing = flourBag.update(holding && phase === 'flour', dt), pouring = jug.update(holding && phase === 'milk', dt);
        if (flowing) { flourAmt = Math.min(1, flourAmt + dt * 0.5); if (Math.random() < dt * 20) Sound.sprinkle(); }
        if (phase === 'flour' && flourAmt >= 1) { phase = 'sugar'; holding = false; Sound.pop(); say('Tap the sugar: two spoons!'); }
        if (spoon) {
          spoon.t = Math.min(1, spoon.t + dt * 1.6);
          if (spoon.t >= 0.6 && !spoon.tipped) {
            spoon.tipped = true; Sound.sprinkle(); Sound.sprinkle();
            for (var si = 0; si < 26; si++) sugar.push({ x: (Math.random() - 0.5) * 120, y: -20 + (Math.random() - 0.5) * 30 });
          }
          if (spoon.t >= 1) { spoon = null; spoons++; if (spoons >= 2) { phase = 'milk'; Sound.pop(); say('Hold the jug to pour milk'); } else say('One more spoon!'); }
        }
        if (pouring) milk = Math.min(1, milk + dt * 0.45);
        pourLoop.set(pouring ? 0.8 : flowing ? 0.3 : 0);
        if (phase === 'milk' && milk >= 1) { phase = 'eggs'; holding = false; pourLoop.set(0); Sound.pop(); say('Tap the eggs to crack them'); }
        eggs.forEach(function (e, i) {
          if (e.state === 'fly') { e.t = Math.min(1, e.t + dt * 2.5); if (e.t >= 1) { e.state = 'crack'; e.t = 0; Sound.crack(); buzz(10); } }
          else if (e.state === 'crack') {
            e.t = Math.min(1, e.t + dt * 1.6);
            if (e.t >= 0.5 && !e.dropped) { e.dropped = true; yolks.push({ x: eggTarget(i).x, y: cy + 4, t: 0, wt: 0, seed: i * 3 + 1 }); }
            if (e.t >= 1) e.state = 'gone';
          }
        });
        yolks.forEach(function (y) { if (y.t < 1) { y.t = Math.min(1, y.t + dt * 3); if (y.t >= 1) Sound.plop(); } else if (y.wt < 1) y.wt = Math.min(1, y.wt + dt * 3); });
        if (phase === 'eggs' && eggs.every(function (e) { return e.state === 'gone'; })) { phase = 'whisk'; say('Whisk in circles!'); }
        speed *= Math.pow(0.08, dt); slosh.set(speed * 0.8);
        if (speed > 0.05 && !done) { tickAcc += dt * 14 * speed; while (tickAcc >= 1) { tickAcc -= 1; Sound.clink(); } if (Math.random() < dt * 3 * speed) Sound.squish(); }
        if (whisk >= 1 && !done) {
          done = true; slosh.set(0); Sound.chime(); buzz(20);
          burst(cx, cy, 26, { colors: ['#FFC93C', '#FFFFFF', '#FF7EB6'], speed: 260, life: 0.9 });
          Cat.show('Smooth batter!');
          say('Silky smooth!');
          showNext('Next', nextStep);
        }
      },
      draw: function (c) {
        // little bowl holding the eggs until it's their turn
        D.shadow(c, EB.x, EB.y + 34, 62, 12);
        c.beginPath(); c.ellipse(EB.x, EB.y, 64, 18, 0, 0, TAU); c.fillStyle = '#FFE7C2'; c.fill(); ink(c, 4.5);
        eggs.forEach(function (e) { if (e.state === 'wait') drawEgg(c, e.x, e.y, e.rot, 0); });
        drawBowlFront(c, EB.x, EB.y, 64, '#FF9F6B');
        drawBigBowl(c, cx, cy, 'blue');
        // milk / batter
        if (milk > 0) {
          c.beginPath(); c.ellipse(cx, cy + 8, rx * (0.4 + 0.6 * Math.sqrt(milk)), ry * (0.4 + 0.6 * Math.sqrt(milk)), 0, 0, TAU);
          c.fillStyle = D.mix('#FBF8F1', BATTER, easeOut(whisk)); c.fill();
        }
        // flour mound (with its sugar) grows as it's poured and melts away as you whisk
        if (whisk < 1 && flourAmt > 0) {
          var fs = (0.25 + 0.75 * easeOut(flourAmt)) * (1 - whisk * 0.6);
          c.save(); c.globalAlpha = 1 - whisk; c.translate(cx, cy + 6); c.scale(fs, fs);
          c.beginPath(); c.ellipse(0, -6, 96, 34, 0, Math.PI, 0); c.quadraticCurveTo(80, 12, 0, 12); c.quadraticCurveTo(-80, 12, -96, -6); c.fillStyle = '#FFFFFF'; c.fill();
          c.fillStyle = '#EDE6D6'; flour.forEach(function (f) { c.fillRect(f.x, f.y - 6, 2, 2); });
          c.fillStyle = '#FFFDF5'; c.strokeStyle = 'rgba(42,35,64,.25)'; c.lineWidth = 1;
          sugar.forEach(function (q) { c.beginPath(); c.rect(q.x - 2, q.y - 2, 4, 4); c.fill(); c.stroke(); });
          c.restore();
        }
        // egg whites: clear, glossy puddles around each yolk, mixed away by whisking
        yolks.forEach(function (y) {
          var drop = easeOut(y.t), yy = lerp(cy - 120, y.y, drop);
          c.save(); c.globalAlpha = 1 - whisk;
          if (y.t < 1) {
            c.beginPath(); c.ellipse(y.x, yy - 16, 13, 24, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
            c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 2.5; c.stroke();
          } else {
            var wr = 14 + 24 * easeOut(y.wt);
            c.beginPath();
            for (var wi = 0; wi <= 20; wi++) { var wa = wi / 20 * TAU, wk = 1 + 0.13 * Math.sin(wa * 3 + y.seed) + 0.07 * Math.sin(wa * 5 + y.seed); c.lineTo(y.x + Math.cos(wa) * wr * 1.35 * wk, y.y + Math.sin(wa) * wr * 0.55 * wk); }
            c.closePath(); c.fillStyle = 'rgba(255,255,255,.82)'; c.fill();
            c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 2.5; c.stroke();
            c.beginPath(); c.ellipse(y.x - wr * 0.6, y.y - wr * 0.18, wr * 0.3, 3, -0.2, 0, TAU); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill();
          }
          c.restore();
        });
        // yolks, smeared into swirls while whisking
        yolks.forEach(function (y, i) {
          var drop = easeOut(y.t), yy = lerp(cy - 120, y.y, drop);
          var rad = 17 * (1 - whisk * 0.85);
          c.save(); c.globalAlpha = 1 - whisk * 0.9;
          var a = spin * (0.8 + i * 0.3);
          var x = y.x + Math.cos(a) * whisk * 40 - (y.x - cx) * whisk * 0.6, yy2 = yy + Math.sin(a) * whisk * 10;
          c.beginPath(); c.ellipse(x, yy2, rad * (1 + whisk), rad, a, 0, TAU); c.fillStyle = '#FFB21F'; c.fill();
          if (whisk < 0.3) { ink(c, 3); c.beginPath(); c.arc(x - 5, yy2 - 5, 4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); }
          c.restore();
        });
        // swirl lines
        if (phase === 'whisk' && whisk > 0.02) {
          c.save(); c.globalAlpha = 0.55 * (1 - whisk * 0.6); c.strokeStyle = '#FFF4D2'; c.lineWidth = 5; c.lineCap = 'round';
          for (var sw = 0; sw < 3; sw++) {
            c.beginPath();
            for (var st = 0; st < 28; st++) { var tt = st / 27, ang = spin + sw * 2.1 + tt * 3.2, rr2 = 20 + tt * 140; c.lineTo(cx + Math.cos(ang) * rr2, cy + 8 + Math.sin(ang) * rr2 * ry / rx); }
            c.stroke();
          }
          c.restore();
        }
        // flour bag, sugar bowl and spoon, milk jug
        if (phase === 'flour' || flourBag.shown()) flourBag.draw(c, holding && phase === 'flour', cy);
        if (phase === 'milk' || jug.shown()) jug.draw(c, holding && phase === 'milk', cy + 10, 1 - milk * 0.8);
        if (phase === 'flour' || phase === 'sugar') {
          c.beginPath(); c.ellipse(SB.x, SB.y, 58, 16, 0, 0, TAU); c.fillStyle = '#FFFDF5'; c.fill(); ink(c, 4);
          drawBowlFront(c, SB.x, SB.y, 58, '#FF7EB6');
          if (!spoon && phase === 'sugar') { c.save(); c.translate(SB.x + 20, SB.y - 30); c.rotate(-0.6); rr(c, -5, -70, 10, 60, 5); c.fillStyle = '#9AA6B2'; c.fill(); ink(c, 3); c.beginPath(); c.ellipse(0, -2, 16, 11, 0, 0, TAU); c.fillStyle = '#C3CBD4'; c.fill(); ink(c, 3.5); c.restore(); }
        }
        if (spoon) {
          var sk = easeOut(Math.min(1, spoon.t / 0.5)), sx = lerp(SB.x, cx - 40, sk), sy = lerp(SB.y - 30, cy - 70, sk) - Math.sin(sk * Math.PI) * 90, tip = spoon.t > 0.5 ? (spoon.t - 0.5) * 4 : 0;
          c.save(); c.translate(sx, sy); c.rotate(-0.6 + Math.min(1.6, tip)); rr(c, -5, -70, 10, 60, 5); c.fillStyle = '#9AA6B2'; c.fill(); ink(c, 3);
          c.beginPath(); c.ellipse(0, -2, 16, 11, 0, 0, TAU); c.fillStyle = '#C3CBD4'; c.fill(); ink(c, 3.5);
          if (!spoon.tipped) { c.beginPath(); c.ellipse(0, -5, 12, 6, 0, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); }
          c.restore();
        }
        // eggs
        eggs.forEach(function (e, i) {
          if (e.state === 'gone') return;
          var tg = eggTarget(i);
          if (e.state === 'wait') return;
          if (e.state === 'fly') { var k2 = easeOut(e.t); drawEgg(c, lerp(e.x, tg.x, k2), lerp(e.y, tg.y, k2) - Math.sin(k2 * Math.PI) * 80, lerp(e.rot, 0, k2), 0); }
          else { c.save(); c.globalAlpha = 1 - Math.max(0, e.t - 0.6) / 0.4; drawEgg(c, tg.x, tg.y, 0, easeOut(Math.min(1, e.t * 2))); c.restore(); }
        });
        // progress ring
        if (phase === 'whisk') drawRing(c, cx, cy - 150, whisk, done ? '✓' : Math.round(whisk * 100) + '');
        if (tool && !done) drawWhisk(c, tool);
      }
    };
  }




  /* Top-down pancake in the pan. side: 0 = batter side up, 1 = cooked side up. burn: 0..1 darkening edge while cooking */
  function drawPanPancake(c, x, y, r, cook, side, holes, tone, burn) {
    c.save(); c.translate(x, y);
    if (side) {
      var T = TONES[tone || 'perfect'];
      var g = c.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
      g.addColorStop(0, T.c1); g.addColorStop(0.75, T.c2); g.addColorStop(1, T.edge);
      shape(c, D.ellPath(0, 0, r, r), g, {
        lw: 4, depth: 6, inside: function (c) {
          c.fillStyle = T.spots; var sr = seeded(31);
          for (var i = 0; i < 9; i++) { c.beginPath(); c.arc((sr() - 0.5) * r * 1.2, (sr() - 0.5) * r * 1.2, 3 + sr() * 5, 0, TAU); c.fill(); }
        }
      });
    } else {
      // the browning edge creeps in from the outline, inside it
      var edge = burn > 0 ? D.mix('#D99A48', '#4E2A13', burn) : D.mix('#F3D995', '#D99A48', cook);
      shape(c, D.ellPath(0, 0, r, r), D.mix('#F8E6B0', '#F0D08A', cook), {
        lw: 4, depth: 0, inside: function (c) {
          c.beginPath(); c.arc(0, 0, r, 0, TAU); c.lineWidth = (6 + cook * 4 + burn * 8) * 2; c.strokeStyle = edge; c.stroke();
          c.fillStyle = 'rgba(200,140,60,.6)';
          (holes || []).forEach(function (h) { c.beginPath(); c.arc(h.x * r, h.y * r, h.r, 0, TAU); c.fill(); });
        }
      });
    }
    c.restore();
  }



  /* ---- Step: butter the pan ---- */
  function ButterScene() {
    var PX = 290, PY = 300, PR2 = 180, SIDE = { x: 548, y: 568 };
    var phase = 'wait', fly = 0, melt = 0, last = null, sizzle = Sound.loop('sizzle'), knob = { x: PX, y: PY };
    function drawKnob(c, x, y, k) {
      c.save(); c.translate(x, y); c.scale(k, k);
      c.beginPath(); c.moveTo(-26, 0); c.lineTo(-26, 12); c.lineTo(0, 26); c.lineTo(26, 12); c.lineTo(26, 0); c.lineTo(0, 14); c.closePath(); c.fillStyle = '#F2D66B'; c.fill(); ink(c, 3.5);
      c.beginPath(); c.moveTo(-26, 0); c.lineTo(0, -14); c.lineTo(26, 0); c.lineTo(0, 14); c.closePath(); c.fillStyle = '#FFF3A6'; c.fill(); ink(c, 3.5);
      c.restore();
    }
    return {
      enter: function () { say('Tap the butter to put it in the pan'); },
      leave: function () { sizzle.stop(); },
      hint: function (t) {
        if (phase === 'wait') return { x: SIDE.x, y: SIDE.y - 10, press: (t % 1.2) < 0.6 };
        if (phase === 'melt') { var a = t * 2.4; return { x: PX + Math.cos(a) * 100, y: PY + Math.sin(a) * 100, press: true }; }
        return null;
      },
      down: function (p) { if (phase === 'wait' && dist(p, SIDE) < 90) { phase = 'fly'; Sound.whoosh(); } last = p; },
      move: function (p) {
        if (phase !== 'melt') return;
        if (last && Math.hypot(p.x - PX, p.y - PY) < PR2 - 20) { melt = Math.min(1, melt + dist(p, last) / 1400); knob = { x: lerp(knob.x, p.x, 0.25), y: lerp(knob.y, p.y, 0.25) }; }
        last = p;
        if (melt >= 1) {
          phase = 'done'; Sound.chime(); buzz(15); Cat.show('Shiny pan!'); say('All buttery!');
          burst(PX, PY, 16, { colors: ['#FFE29A', '#FFFFFF'], speed: 200, life: 0.7 });
          showNext('Next', nextStep);
        }
      },
      up: function () { last = null; },
      update: function (dt) {
        if (phase === 'fly') { fly = Math.min(1, fly + dt * 2.2); if (fly >= 1) { phase = 'melt'; Sound.plop(); say('Swirl it round to melt it'); } }
        sizzle.set(phase === 'melt' ? 0.6 + melt * 0.6 : phase === 'done' ? 0.4 : 0);
        if (phase === 'melt' && Math.random() < dt * 12) Sound.riceTick();
      },
      draw: function (c) {
        drawPan(c, PX, PY, PR2, '#FF6B57', false, phase === 'done' ? 1 : melt);
        drawSidePlate(c, SIDE.x, SIDE.y + 10, 76);
        if (phase === 'wait') drawKnob(c, SIDE.x, SIDE.y - 4, 1.4);
        else if (phase === 'fly') { var k = easeOut(fly); drawKnob(c, lerp(SIDE.x, PX, k), lerp(SIDE.y - 4, PY, k) - Math.sin(k * Math.PI) * 90, 1.4); }
        else if (phase === 'melt') {
          // a melting puddle spreads out behind the knob as it shrinks
          c.beginPath(); c.ellipse(knob.x, knob.y, 30 + melt * 60, 26 + melt * 54, 0, 0, TAU); c.fillStyle = 'rgba(255,214,90,.55)'; c.fill();
          drawKnob(c, knob.x, knob.y, 1.4 * (1 - melt * 0.8));
        }
      }
    };
  }

  /* ---- Step: cook and flip ---- */
  function PanScene() {
    var PX = 290, PY = 300, PR2 = 180, NEED = 3;
    // flip too early and it's pale, too late and it burns
    var T_OK = 2.6, T_BURN = 5.4, T_MAX = 8;
    var cake = null, made = 0, holding = false, jugT = 0, swipe = null;
    var pourLoop = Sound.loop('pour'), sizzle = Sound.loop('sizzle');
    var SIDE = { x: 548, y: 568 }, REST = { x: 560, y: 160 };

    function newCake() { return { r: 0, amt: 0, phase: 'pour', t: 0, flip: 0, holes: [], bubbles: [], said: 0, tone: 'perfect' }; }
    function jugPos() { var k = easeOut(jugT); return { x: lerp(REST.x, PX + 120, k), y: lerp(REST.y, PY - 150, k), a: lerp(0, -1.7, k) }; }
    function startCooking() { cake.phase = 'cook1'; cake.t = 0; cake.said = 0; say('Wait until it turns golden...'); }

    return {
      enter: function () { cake = null; say('Hold to pour the batter'); },
      leave: function () { pourLoop.stop(); sizzle.stop(); },
      hint: function (t) {
        if (!cake || cake.phase === 'pour') return { x: PX, y: PY, press: (t % 1.6) < 1.1 };
        if (cake.phase === 'cook1' && cake.t >= T_OK) { var k = (t % 1.3) / 1.3; return { x: PX, y: PY + 90 - k * 200, press: k < 0.9 }; }
        return null;
      },
      down: function (p) {
        if ((!cake || cake.phase === 'pour') && made < NEED) holding = true;
        if (cake && cake.phase === 'cook1' && cake.t > 0.4) swipe = p;
      },
      move: function (p) {
        if (swipe && cake && cake.phase === 'cook1' && swipe.y - p.y > 60) {
          cake.tone = cake.t < T_OK ? 'pale' : cake.t <= T_BURN ? 'perfect' : 'burnt';
          cake.phase = 'flip'; cake.flip = 0; swipe = null; Sound.whoosh(); buzz(15);
        }
      },
      up: function () {
        holding = false; swipe = null;
        if (cake && cake.phase === 'pour' && cake.amt > 0.18) startCooking();
      },
      update: function (dt) {
        jugT += ((holding && (!cake || cake.phase === 'pour') ? 1 : 0) - jugT) * Math.min(1, dt * 7);
        var pouring = holding && jugT > 0.75 && (!cake || cake.phase === 'pour');
        if (pouring) {
          if (!cake) cake = newCake();
          cake.amt = Math.min(1, cake.amt + dt * 0.6); cake.r = 45 + 100 * cake.amt;
          if (cake.amt >= 1) { holding = false; startCooking(); }
        }
        pourLoop.set(pouring ? 0.7 : 0);
        var cooking = cake && (cake.phase === 'cook1' || cake.phase === 'cook2');
        sizzle.set(cooking ? (cake.t > T_BURN && cake.phase === 'cook1' ? 1.6 : 1) : 0);
        if (cooking && Math.random() < dt * (cake.t > T_BURN && cake.phase === 'cook1' ? 30 : 14)) Sound.riceTick();
        if (!cake) return;
        if (cake.phase === 'cook1') {
          cake.t = Math.min(T_MAX + 4, cake.t + dt);
          if (Math.random() < dt * 9) { var a = Math.random() * TAU, rr3 = Math.sqrt(Math.random()) * 0.78; cake.bubbles.push({ x: Math.cos(a) * rr3, y: Math.sin(a) * rr3, life: 0, max: 0.6 + Math.random() * 0.6 }); }
          if (cake.t >= T_OK && cake.said < 1) { cake.said = 1; say('Golden! Swipe up to flip!'); Sound.pop(); burst(PX, PY - cake.r, 8, { colors: ['#FFFFFF', '#FFC93C'], speed: 120, life: 0.6 }); }
          if (cake.t >= T_BURN && cake.said < 2) { cake.said = 2; say('Quick, it’s burning!'); }
          if (cake.t > T_BURN && Math.random() < dt * 6) burst(PX + (Math.random() - 0.5) * cake.r, PY - cake.r * 0.3, 1, { colors: ['rgba(120,110,125,.55)'], shape: 'dot', size: 26, speed: 25, gravity: -90, life: 1.4 });
        }
        cake.bubbles.forEach(function (b) { b.life += dt; if (b.life >= b.max && !b.popped) { b.popped = true; cake.holes.push({ x: b.x, y: b.y, r: 2 + Math.random() * 2.5 }); } });
        cake.bubbles = cake.bubbles.filter(function (b) { return !b.popped; });
        if (cake.phase === 'flip') {
          cake.flip = Math.min(1, cake.flip + dt * 1.6);
          if (cake.flip >= 1) {
            cake.phase = 'cook2'; cake.t = 0; Sound.plop();
            if (cake.tone === 'perfect') { say('Golden brown!'); Cat.show(pick(['Perfect flip!', 'So golden!'])); burst(PX, PY, 16, { colors: ['#FFC93C', '#FFFFFF'], speed: 200, life: 0.7 }); }
            else if (cake.tone === 'pale') say('Too early! A bit pale.');
            else say('Oops, a bit burnt!');
          }
        }
        if (cake.phase === 'cook2') { cake.t += dt; if (cake.t > 1.8) { cake.phase = 'slide'; cake.t = 0; Sound.whoosh(); } }
        if (cake.phase === 'slide') {
          cake.t = Math.min(1, cake.t + dt * 1.8);
          if (cake.t >= 1) {
            dish.cakes.push({ r: cake.r, tone: cake.tone }); made++; Sound.plop(); burst(SIDE.x, SIDE.y - 20 - made * 10, 8, { colors: ['#FFFFFF', '#FFC93C'], speed: 120, life: 0.5 });
            cake = null;
            if (made < NEED) say(made === 1 ? 'Pour another one' : 'One more!');
            else {
              var golden = dish.cakes.filter(function (q) { return cakeInfo(q).tone === 'perfect'; }).length;
              Sound.chime(); Cat.show(golden === NEED ? 'All golden!' : 'Yum, pancakes!');
              say(golden === NEED ? 'Three perfect pancakes!' : golden + ' of 3 golden'); showNext('Next', nextStep);
            }
          }
        }
      },
      draw: function (c) {
        drawPan(c, PX, PY, PR2, '#FF6B57', false, 1);
        // side plate with the finished stack
        drawSidePlate(c, SIDE.x, SIDE.y + 10, 76);
        for (var i = 0; i < made; i++) { var ci = cakeInfo(dish.cakes[i]), sc = ci.r / 145; drawStackCake(c, SIDE.x, SIDE.y - i * 13, 58 * sc, 17 * sc, 12, ci.tone); }
        if (cake) {
          var cookAmt = cake.phase === 'pour' ? 0 : cake.phase === 'cook1' ? Math.min(1, cake.t / T_OK) : 1;
          var burn = cake.phase === 'cook1' ? clamp((cake.t - T_BURN) / 2, 0, 1) : 0;
          if (cake.phase === 'cook1') drawGauge(c, PX, cake.t, T_OK, T_BURN, T_MAX, ['#F7E4AE', '#7E4826']);
          if (cake.phase === 'flip') {
            var f = cake.flip, sy = Math.abs(Math.cos(f * Math.PI)), lift = Math.sin(f * Math.PI) * 140;
            c.save(); c.translate(PX, PY - lift); c.scale(1, Math.max(0.04, sy)); drawPanPancake(c, 0, 0, cake.r, cookAmt, f > 0.5 ? 1 : 0, cake.holes, cake.tone, 0); c.restore();
          } else if (cake.phase === 'slide') {
            var k = easeOut(cake.t);
            c.save(); c.translate(lerp(PX, SIDE.x, k), lerp(PY, SIDE.y - made * 13 - 20, k) - Math.sin(k * Math.PI) * 80); c.scale(1 - 0.55 * k, 1 - 0.75 * k);
            drawPanPancake(c, 0, 0, cake.r, 1, 1, null, cake.tone, 0); c.restore();
          } else {
            drawPanPancake(c, PX, PY, cake.r, cookAmt, cake.phase === 'cook2' ? 1 : 0, cake.holes, cake.tone, burn);
            if (cake.phase !== 'cook2') {
              cake.bubbles.forEach(function (b) {
                var bk = b.life / b.max;
                c.beginPath(); c.arc(PX + b.x * cake.r, PY + b.y * cake.r, 2 + bk * 4, 0, TAU); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.stroke();
              });
            }
            if (cake.phase === 'cook1' && cake.t >= T_OK) {
              var pulse = 0.5 + 0.5 * Math.sin(performance.now() / (cake.t > T_BURN ? 90 : 180));
              var col = cake.t > T_BURN ? '255,107,87' : '255,201,60';
              c.beginPath(); c.arc(PX, PY, cake.r + 10 + pulse * 6, 0, TAU); c.strokeStyle = 'rgba(' + col + ',' + (0.5 + pulse * 0.4) + ')'; c.lineWidth = 6; c.stroke();
            }
          }
        }
        // batter jug
        if (made < NEED && (!cake || cake.phase === 'pour' || jugT > 0.02)) {
          var j = jugPos();
          if (holding && jugT > 0.75 && (!cake || cake.phase === 'pour')) {
            var m = jugMouth(j.x, j.y, j.a);
            c.beginPath(); c.moveTo(m.x, m.y); c.quadraticCurveTo(m.x - 10, (m.y + PY) / 2, PX, PY);
            c.strokeStyle = BATTER; c.lineWidth = 12; c.lineCap = 'round'; c.stroke();
          }
          drawJug(c, j.x, j.y, j.a, BATTER, 1 - (made + (cake ? cake.amt : 0)) / NEED * 0.85);
        }
      }
    };
  }




  function onStackTop(p, pad) { var t = stackTop(); var nx = (p.x - t.x) / (t.rx - (pad || 0)), ny = (p.y - t.y) / (t.ry - (pad || 0) * 0.3); return nx * nx + ny * ny < 1; }







  /* ---- Step: cook a cat-shaped waffle ----
     Hold to pour batter into the cat-shaped iron, tap to close the lid, wait for the light to turn green, tap to open.
     Open it too soon and it's pale, too late and it's a bit burnt. The waffle then goes on the plate. */
  function WaffleIronScene() {
    var IX = 300, IY = 380, S = 0.8, HINGE = IY - 190 * S;            // the base plate's cat outline, and the lid's hinge
    var T_OK = 3.6, T_BURN = 7.4, T_MAX = 10;
    var OPEN = 2.0, phase = 'pour', fill = 0, holding = false, jugT = 0, lid = 2.0, lidTo = 2.0, t = 0, said = 0, tone = 'perfect', lift = 0, steam = 0;
    var pourLoop = Sound.loop('pour'), sizzle = Sound.loop('sizzle');
    var REST = { x: 560, y: 170 };
    function jugPos() { var k = easeOut(jugT); return { x: lerp(REST.x, IX + 120, k), y: lerp(REST.y, IY - 150, k), a: lerp(0, -1.7, k) }; }
    function base(c) {
      // the iron: a chunky pink body with the cat-shaped plate in the middle
      shape(c, D.rrPath(IX - 200, IY - 175, 400, 330, 70), '#FF8FB1', { lw: 5, depth: 10 });
      var mould = DISH.catWafflePath(new DOMMatrix().translate(IX, IY).scale(S * 1.06, S * 1.06));
      shape(c, mould, '#4A4458', { lw: 4, depth: 0 });
      c.save(); c.clip(DISH.catWafflePath(new DOMMatrix().translate(IX, IY).scale(S, S)));
      c.translate(IX, IY); c.scale(S, S); DISH.waffleGrid(c, '#5D566E', '#423C51', '#3A3448'); c.restore();
      // batter spreading out from the middle as it's poured, then cooking
      if (fill > 0 && phase !== 'lifted') {
        c.save(); c.clip(DISH.catWafflePath(new DOMMatrix().translate(IX, IY).scale(S, S)));
        var cook = phase === 'cook' || phase === 'open' || phase === 'done' ? clamp(t / T_OK, 0, 1) : 0;
        if (phase === 'open' || phase === 'done') { c.restore(); DISH.drawWaffleFlat(c, IX, IY - lift * 120, S * (1 + lift * 0.08), tone, 1); }
        else {
          var r = 40 + 230 * Math.sqrt(fill);
          c.beginPath(); for (var i = 0; i <= 24; i++) { var a = i / 24 * TAU, w = 1 + 0.05 * Math.sin(a * 5 + fill * 9); c.lineTo(IX + Math.cos(a) * r * w, IY + Math.sin(a) * r * w * 0.85); }
          c.fillStyle = D.mix(BATTER, '#EDB15E', cook * 0.6); c.fill();
          c.restore();
        }
      }
      // the little light: red while cooking, green when it's ready, flashing red when it's burning
      // (off until the lid is shut)
      var lightCol = phase === 'cook' ? (t < T_OK ? '#FF6B57' : t <= T_BURN ? '#7BD389' : (Math.floor(performance.now() / 180) % 2 ? '#FF6B57' : '#FFC2B8')) : phase === 'pour' || phase === 'close' || phase === 'closing' ? '#C9C2D6' : '#7BD389';
      c.beginPath(); c.arc(IX + 160, IY + 120, 13, 0, TAU); c.fillStyle = lightCol; c.fill(); ink(c, 3.5);
      if (lightCol === '#7BD389' && phase === 'cook') { c.beginPath(); c.arc(IX + 160, IY + 120, 22, 0, TAU); c.strokeStyle = 'rgba(123,211,137,.5)'; c.lineWidth = 6; c.stroke(); }
    }
    function drawLid(c) {
      // the lid swings on its hinge: lid = 0 is shut, OPEN (2 radians) is open, seen from inside
      var sy = Math.cos(lid);
      if (Math.abs(sy) < 0.03) sy = sy < 0 ? -0.03 : 0.03;
      c.save(); c.translate(IX, HINGE); c.scale(1, sy); c.translate(0, IY - HINGE);
      if (sy > 0) {
        shape(c, D.rrPath(-205, -180, 410, 340, 72), '#FF8FB1', { lw: 5 / sy, depth: 0, inside: function (c) {
          c.beginPath(); c.ellipse(-40, -110, 120, 28, -0.1, 0, TAU); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
        } });
        // a cat face on the lid, and the handle at the front
        var face = DISH.catWafflePath(new DOMMatrix().scale(0.45, 0.45));
        c.save(); c.lineWidth = 4 / sy; c.fillStyle = '#FFC2D6'; c.fill(face); c.strokeStyle = INK; c.stroke(face); c.restore();
        rr(c, -70, 140, 140, 34, 16); c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = 4 / sy; c.strokeStyle = INK; c.stroke();
      } else {
        // the inside of the lid: the other cat-shaped plate
        rr(c, -205, -180, 410, 340, 72); c.fillStyle = '#E8789B'; c.fill(); c.lineWidth = 5 / -sy; c.strokeStyle = INK; c.stroke();
        var m = DISH.catWafflePath(new DOMMatrix().scale(S * 1.06, S * 1.06));
        c.fillStyle = '#4A4458'; c.fill(m); c.lineWidth = 4 / -sy; c.stroke(m);
      }
      c.restore();
      // the hinge
      rr(c, IX - 90, HINGE - 10, 180, 20, 9); c.fillStyle = '#C9C2D6'; c.fill(); ink(c, 3.5);
    }
    return {
      enter: function () { say('Hold to pour the batter in'); },
      leave: function () { pourLoop.stop(); sizzle.stop(); },
      hint: function (tt) {
        if (phase === 'pour') return { x: IX, y: IY, press: (tt % 1.6) < 1.1 };
        if (phase === 'close') return { x: IX, y: HINGE - 80, press: (tt % 1.2) < 0.5 };
        if (phase === 'cook' && t >= T_OK) return { x: IX, y: IY + 150, press: (tt % 1.2) < 0.5 };
        return null;
      },
      down: function () {
        if (phase === 'pour') holding = true;
        else if (phase === 'close') { phase = 'closing'; lidTo = 0; Sound.whoosh(); }
        else if (phase === 'cook' && t > 0.5) {
          tone = t < T_OK ? 'pale' : t <= T_BURN ? 'perfect' : 'burnt';
          phase = 'opening'; lidTo = OPEN; Sound.whoosh(); buzz(12);
        }
      },
      move: function () {},
      up: function () { holding = false; if (phase === 'pour' && fill > 0.25 && fill < 1) say('Keep going, fill it right up!'); },
      update: function (dt) {
        jugT += ((holding && phase === 'pour' ? 1 : 0) - jugT) * Math.min(1, dt * 7);
        var pouring = holding && jugT > 0.75 && phase === 'pour';
        if (pouring) fill = Math.min(1, fill + dt * 0.42);
        pourLoop.set(pouring ? 0.7 : 0);
        if (phase === 'pour' && fill >= 1) { phase = 'close'; holding = false; Sound.pop(); say('Full! Tap the lid to close it'); }
        // the lid swings smoothly
        var dl = lidTo - lid; lid += clamp(dl, -dt * 7, dt * 7);
        if (phase === 'closing' && Math.abs(lid) < 0.01) { phase = 'cook'; t = 0; said = 0; Sound.plop(); buzz(10); say('Wait for the green light...'); }
        if (phase === 'cook') {
          t = Math.min(T_MAX + 3, t + dt);
          steam += dt;
          if (Math.random() < dt * (t > T_BURN ? 8 : 4)) burst(IX + (Math.random() - 0.5) * 300, HINGE + 10, 1, { colors: [t > T_BURN ? 'rgba(120,110,125,.55)' : 'rgba(255,255,255,.8)'], shape: 'dot', size: 24, speed: 30, gravity: -110, life: 1.3 });
          if (t >= T_OK && said < 1) { said = 1; Sound.chime(); say('Green light! Tap to open it'); }
          if (t >= T_BURN && said < 2) { said = 2; say('Quick, it’s burning!'); }
        }
        sizzle.set(phase === 'cook' ? (t > T_BURN ? 1.4 : 0.8) : 0);
        if (phase === 'opening' && Math.abs(lid - OPEN) < 0.01) {
          phase = 'open'; lift = 0;
          if (tone === 'perfect') { Cat.show(pick(['Purr-fect waffle!', 'So golden!'])); say('A golden cat waffle!'); burst(IX, IY, 18, { colors: ['#FFC93C', '#FFFFFF'], speed: 220, life: 0.8 }); }
          else if (tone === 'pale') say('Too early! A bit pale.');
          else say('Oops, a bit burnt!');
        }
        if (phase === 'open') {
          lift = Math.min(1, lift + dt * 1.4);
          if (lift >= 1) { phase = 'done'; dish.waffle = tone; Sound.plop(); showNext('Next', nextStep); }
        }
      },
      draw: function (c) {
        if (phase === 'cook') drawGauge(c, IX, t, T_OK, T_BURN, T_MAX, ['#F7E4AE', '#7E4826']);
        var lidOpen = Math.cos(lid) < 0;
        if (lidOpen) { drawLid(c); base(c); } else { base(c); drawLid(c); }
        if (phase === 'pour' || jugT > 0.02) {
          var j = jugPos();
          if (holding && jugT > 0.75 && phase === 'pour') {
            var m = jugMouth(j.x, j.y, j.a);
            c.beginPath(); c.moveTo(m.x, m.y); c.quadraticCurveTo(m.x - 10, (m.y + IY) / 2, IX, IY);
            c.strokeStyle = BATTER; c.lineWidth = 12; c.lineCap = 'round'; c.stroke();
          }
          drawJug(c, j.x, j.y, j.a, BATTER, 1 - fill * 0.85);
        }
        if (phase === 'pour' && fill > 0) drawRing(c, 86, 300, fill, Math.round(fill * 100) + '');
      }
    };
  }

  /* ---- Step: decorate the stack (or the waffle) ---- */
  var PAN_TOOL_ICONS = {
    plate: TOOL_ICONS.plate,
    syrup: GGDish.icons.syrup,
    butter: GGDish.icons.butter,
    strawberry: GGDish.icons.strawberry,
    blueberry: GGDish.icons.blueberry,
    banana: GGDish.icons.banana,
    sugar: GGDish.icons.sugar
  };
  var PAN_TOOL_SAY = { syrup: 'Drag to pour syrup', butter: 'Tap to add butter', strawberry: 'Tap to add strawberries', blueberry: 'Tap to add blueberries', banana: 'Tap to add banana', sugar: 'Drag to dust icing sugar' };

  function DecorateScene() {
    // the same decorating works for the pancake stack and the cat waffle: only the shape on the plate differs
    var WAF = recipe.id === 'waffles', hitCtx = document.createElement('canvas').getContext('2d');
    var topOf = WAF ? DISH.waffleTop : function () { return stackTop(); };
    function onTop(p, pad) { if (!WAF) return onStackTop(p, pad); hitCtx.setTransform(1, 0, 0, 1, 0, 0); return hitCtx.isPointInPath(DISH.waffleTopPath(pad || 0), p.x, p.y); }
    var drawScene = WAF ? DISH.drawWaffleScene : drawStackScene;
    var tool = 'syrup', down = false, pointer = null, emit = 0, actions = 0, praised = false, lastSyrup = null, falling = [];
    var pourLoop = Sound.loop('pour');
    var hist = History(['plate', 'syrup', 'drips', 'tops', 'sugar']), changed = false;
    var timers = [];
    function later(s, fn) { timers.push({ t: s, fn: fn }); }
    function setTool(t) {
      tool = t;
      toolsEl.querySelectorAll('.tool').forEach(function (b) { if (b.dataset.tool !== 'plate') b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
      say(PAN_TOOL_SAY[t]);
    }
    function countAction() { actions++; if (!praised && actions >= 6) { praised = true; later(0.3, function () { Cat.show(pick(['Looks yummy!', 'So pretty!'])); }); } }
    function onPlate(p) { var nx = (p.x - PLATE2.x) / (PLATE2.rx - 24), ny = (p.y - PLATE2.y) / (PLATE2.ry - 10); return nx * nx + ny * ny < 1; }
    function overStackSide(p) {
      if (WAF) return Math.abs(p.x - DISH.WX) < DISH.WRX && p.y > DISH.WY && p.y < DISH.WY + DISH.WRY * DISH.WSQ + DISH.WTH;
      var st = stackOf(dish), w = Math.max.apply(null, st.map(function (q) { return q.rx; })); return Math.abs(p.x - SX) < w && p.y > SY0 - st.length * STH && p.y < SY0 + SRY;
    }
    function place(kind, p, max) {
      var top = onTop(p, 16);
      if (!top && (!onPlate(p) || overStackSide(p))) return false;
      var list = dish.tops.filter(function (t) { return t.kind === kind; });
      hist.now();
      if (list.length >= max) dish.tops.splice(dish.tops.indexOf(list[0]), 1);
      dish.tops.push({ kind: kind, x: p.x, y: p.y, a: (Math.random() - 0.5) * 1.2, onTop: top });
      return true;
    }
    function addSyrup(p) {
      if (!onTop(p, 10)) { lastSyrup = null; return; }
      if (!lastSyrup) { lastSyrup = []; dish.syrup.push(lastSyrup); }
      if (GGDish.syrupStep(dish, lastSyrup, p, topOf())) changed = true;
    }
    return {
      enter: function () {
        toolsEl.innerHTML = ['plate', 'syrup', 'butter', 'strawberry', 'blueberry', 'banana', 'sugar'].map(function (t) {
          var lbl = { plate: 'Plate', syrup: 'Syrup', butter: 'Butter', strawberry: 'Berry', blueberry: 'Blueberry', banana: 'Banana', sugar: 'Sugar' }[t];
          return '<button class="tool" type="button" data-tool="' + t + '"' + (t === 'plate' ? '' : ' aria-pressed="false"') + '>' + PAN_TOOL_ICONS[t] + '<span>' + lbl + '</span></button>';
        }).join('');
        toolsEl.querySelectorAll('.tool').forEach(function (b) {
          b.addEventListener('click', function () {
            Sound.init();
            if (b.dataset.tool === 'plate') { hist.now(); dish.plate = (dish.plate + 1) % PLATES.length; Sound.pop(); burst(PLATE2.x, PLATE2.y + 60, 8, { colors: ['#FFFFFF', '#FFC93C'], speed: 140, life: 0.5 }); say('New plate!'); return; }
            Sound.pop(); setTool(b.dataset.tool);
          });
        });
        setTool('syrup');
        say(WAF ? 'Decorate your waffle!' : 'Decorate your pancakes!');
        showNext('Done', finishDish);
        setUndo({ canUndo: hist.canUndo, undo: function () { if (hist.undo()) { falling.length = 0; lastSyrup = null; say('Undone'); } } });
      },
      leave: function () { pourLoop.stop(); toolsEl.innerHTML = ''; },
      hint: function (t) {
        if (actions > 0 || dish.syrup.length) return null;
        var k = (t % 2) / 2, top = topOf();
        return { x: top.x - 110 + k * 220, y: top.y + Math.sin(k * TAU) * 22, press: true };
      },
      down: function (p) {
        down = true; pointer = p; lastSyrup = null;
        if (tool === 'syrup' || tool === 'sugar') { hist.begin(); changed = false; }
        if (tool === 'syrup') addSyrup(p);
        if (tool === 'butter' && place('butter', p, 3)) { Sound.plop(); countAction(); }
        if (tool === 'strawberry' && place('strawberry', p, 16)) { Sound.pop(); countAction(); }
        if (tool === 'blueberry' && place('blueberry', p, 30)) { Sound.pop(); countAction(); }
        if (tool === 'banana' && place('banana', p, 16)) { Sound.pop(); countAction(); }
      },
      move: function (p) { pointer = p; if (down && tool === 'syrup') addSyrup(p); },
      up: function () {
        if (down && tool === 'syrup' && lastSyrup && lastSyrup.length > 3) countAction();
        if (down && (tool === 'syrup' || tool === 'sugar')) hist.end(changed);
        down = false; lastSyrup = null;
      },
      update: function (dt) {
        for (var i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { var f = timers[i].fn; timers.splice(i, 1); f(); } }
        pourLoop.set(down && tool === 'syrup' && lastSyrup ? 0.45 : 0);
        dish.drips.forEach(function (dr) { if (dr.len < dr.max) dr.len = Math.min(dr.max, dr.len + dt * 30); });
        if (down && tool === 'sugar' && pointer) {
          emit += dt * 40;
          while (emit >= 1) { emit -= 1; if (dish.sugar.length + falling.length < 700) changed = true, falling.push({ x: pointer.x + (Math.random() - 0.5) * 40, y: pointer.y - 30, vy: 20 + Math.random() * 30, land: pointer.y + Math.random() * 26, r: 1.6 + Math.random() * 1.6 }); }
          if (Math.random() < dt * 8) Sound.sprinkle();
        }
        for (var j = falling.length - 1; j >= 0; j--) {
          var s = falling[j]; s.vy += 500 * dt; s.y += s.vy * dt;
          if (s.y >= s.land) { falling.splice(j, 1); if (onTop(s, 0) || onPlate(s)) { dish.sugar.push({ x: s.x, y: s.y, r: s.r }); if (dish.sugar.length % 60 === 0) countAction(); } }
        }
      },
      draw: function (c) {
        drawScene(c, dish);
        c.fillStyle = 'rgba(255,255,255,.95)';
        falling.forEach(function (s) { c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill(); });
        if (down && pointer && tool === 'sugar') {
          c.save(); c.translate(pointer.x, pointer.y - 70); c.rotate(Math.PI + Math.sin(performance.now() / 70) * 0.25);
          rr(c, -22, -30, 44, 60, 12); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 4);
          c.beginPath(); c.moveTo(-22, 26); c.quadraticCurveTo(0, 50, 22, 26); c.fillStyle = '#9EDCFF'; c.fill(); ink(c, 4);
          c.restore();
        }
        if (down && pointer && tool === 'syrup') {
          c.save(); c.translate(pointer.x + 30, pointer.y - 70); c.rotate(-2.3);
          rr(c, -20, -34, 40, 68, 12); c.fillStyle = '#C8721F'; c.fill(); ink(c, 4);
          rr(c, -12, -46, 24, 14, 4); c.fillStyle = '#FF7EB6'; c.fill(); ink(c, 3.5);
          c.restore();
        }
      }
    };
  }



  /* =============== BURGER =============== */
  /* top-down patty in the pan. cooked: tone of the side facing up, or null if raw. edge: 0..1 browning, burn: 0..1 */
  function drawPattyTop(c, x, y, r, cooked, edge, burn) {
    c.save(); c.translate(x, y);
    var p = new Path2D();
    for (var i = 0; i <= 28; i++) { var a = i / 28 * TAU, w = 1 + 0.035 * Math.sin(a * 7) + 0.02 * Math.sin(a * 11); p.lineTo(Math.cos(a) * r * w, Math.sin(a) * r * w); }
    p.closePath();
    if (cooked) {
      var T = PATTY_TONES[cooked];
      shape(c, p, T.top, {
        lw: 4, depth: 6, inside: function (c) {
          c.strokeStyle = 'rgba(30,15,8,.55)'; c.lineWidth = 9;
          for (var k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(-r, k * 30 - 20); c.lineTo(r, k * 30 + 20); c.stroke(); }
          c.fillStyle = T.spots; var sr = seeded(17);
          for (var s = 0; s < 14; s++) { c.beginPath(); c.arc((sr() - 0.5) * r * 1.3, (sr() - 0.5) * r * 1.3, 2 + sr() * 3, 0, TAU); c.fill(); }
        }
      });
    } else {
      // raw mince, browning in from the edge (inside the outline)
      shape(c, p, '#E37C86', {
        lw: 4, depth: 0, inside: function (c) {
          c.lineWidth = (6 + edge * 10 + burn * 6) * 2; c.strokeStyle = burn > 0 ? D.mix('#8A5030', '#2E190F', burn) : D.mix('#E37C86', '#8A5030', edge); c.stroke(p);
          c.fillStyle = 'rgba(255,220,225,.7)'; var mr = seeded(23);
          for (var m = 0; m < 22; m++) { c.beginPath(); c.arc((mr() - 0.5) * r * 1.4, (mr() - 0.5) * r * 1.4, 2 + mr() * 2.5, 0, TAU); c.fill(); }
        }
      });
    }
    c.restore();
  }

  /* ---- Step: cook the patty, both sides ---- */
  function GrillScene() {
    var PX = 290, PY = 300, PR2 = 180, R = 112;
    var T_OK = 2.6, T_BURN = 5.4, T_MAX = 8;
    var SIDE = { x: 548, y: 560 };
    var phase = 'wait', t = 0, fly = 0, flip = 0, side = 1, tones = [], said = 0, swipe = null;
    var sizzle = Sound.loop('sizzle');

    function grade(tt) { return tt < T_OK ? 'rare' : tt <= T_BURN ? 'perfect' : 'burnt'; }
    function swipeDone() {
      var g = grade(t);
      tones.push(g);
      if (g === 'perfect') { Cat.show(side === 1 ? 'Perfect flip!' : 'Juicy!'); burst(PX, PY, 14, { colors: ['#FFC93C', '#FFFFFF'], speed: 200, life: 0.7 }); }
      if (side === 1) { phase = 'flip'; flip = 0; Sound.whoosh(); buzz(15); }
      else {
        phase = 'done'; Sound.chime();
        dish.patty = tones.indexOf('burnt') >= 0 ? 'burnt' : tones.indexOf('rare') >= 0 ? 'rare' : 'perfect';
        say(dish.patty === 'perfect' ? 'Perfectly cooked!' : dish.patty === 'rare' ? 'A bit pink inside!' : 'A little crispy!');
        showNext('Next', nextStep);
        return;
      }
      say(g === 'perfect' ? (side === 1 ? 'Nicely browned!' : 'Perfectly cooked!') : g === 'rare' ? 'Too early! Still pink.' : 'Oops, a bit burnt!');
    }

    return {
      enter: function () { say('Tap the patty to cook it'); },
      leave: function () { sizzle.stop(); },
      hint: function (k) {
        if (phase === 'wait') return { x: SIDE.x, y: SIDE.y - 10, press: (k % 1.2) < 0.6 };
        if (phase === 'cook' && t >= T_OK) { var q = (k % 1.3) / 1.3; return { x: PX, y: PY + 90 - q * 200, press: q < 0.9 }; }
        return null;
      },
      down: function (p) {
        if (phase === 'wait' && dist(p, SIDE) < 90) { phase = 'fly'; fly = 0; Sound.whoosh(); }
        if (phase === 'cook' && t > 0.4) swipe = p;
      },
      move: function (p) { if (swipe && phase === 'cook' && swipe.y - p.y > 60) { swipe = null; swipeDone(); } },
      up: function () { swipe = null; },
      update: function (dt) {
        var hot = phase === 'cook' || phase === 'flip';
        sizzle.set(hot ? (t > T_BURN && phase === 'cook' ? 1.8 : 1.3) : 0);
        if (hot && Math.random() < dt * (t > T_BURN ? 34 : 20)) Sound.riceTick();
        if (phase === 'fly') {
          fly = Math.min(1, fly + dt * 2.2);
          if (fly >= 1) { phase = 'cook'; t = 0; said = 0; Sound.squish(); buzz(12); say('Wait until it’s brown...'); }
        }
        if (phase === 'cook') {
          t = Math.min(T_MAX + 4, t + dt);
          if (t >= T_OK && said < 1) { said = 1; Sound.pop(); say(side === 1 ? 'Brown! Swipe up to flip!' : 'Done! Swipe up to serve!'); }
          if (t >= T_BURN && said < 2) { said = 2; say('Quick, it’s burning!'); }
          if (t > T_BURN && Math.random() < dt * 6) burst(PX + (Math.random() - 0.5) * R, PY - R * 0.3, 1, { colors: ['rgba(120,110,125,.55)'], shape: 'dot', size: 26, speed: 25, gravity: -90, life: 1.4 });
          if (Math.random() < dt * 4) burst(PX + (Math.random() - 0.5) * R * 2, PY + (Math.random() - 0.5) * R * 2, 1, { colors: ['rgba(255,255,255,.7)'], shape: 'dot', size: 5, speed: 60, gravity: 200, up: 60, life: 0.4 });
        }
        if (phase === 'flip') {
          flip = Math.min(1, flip + dt * 1.6);
          if (flip >= 1) { phase = 'cook'; side = 2; t = 0; said = 0; Sound.plop(); say('Now cook the other side...'); }
        }
      },
      draw: function (c) {
        drawPan(c, PX, PY, PR2, '#3FA7F5', true);
        drawSidePlate(c, SIDE.x, SIDE.y + 10, 80);
        if (phase === 'cook') drawGauge(c, PX, t, T_OK, T_BURN, T_MAX, ['#F2A3AB', '#3A2015']);
        var burn = phase === 'cook' ? clamp((t - T_BURN) / 2, 0, 1) : 0;
        var edge = phase === 'cook' ? clamp(t / T_OK, 0, 1) : 0;
        if (phase === 'wait') drawPattyTop(c, SIDE.x, SIDE.y - 4, R * 0.52, null, 0, 0);
        else if (phase === 'fly') {
          var k = easeOut(fly); c.save(); c.translate(lerp(SIDE.x, PX, k), lerp(SIDE.y - 4, PY, k) - Math.sin(k * Math.PI) * 90); c.scale(lerp(0.52, 1, k), lerp(0.52, 1, k)); drawPattyTop(c, 0, 0, R, null, 0, 0); c.restore();
        } else if (phase === 'cook') {
          drawPattyTop(c, PX, PY, R, side === 2 ? tones[0] : null, edge, burn);
          if (t >= T_OK) {
            var pulse = 0.5 + 0.5 * Math.sin(performance.now() / (t > T_BURN ? 90 : 180)), col = t > T_BURN ? '255,107,87' : '255,201,60';
            c.beginPath(); c.arc(PX, PY, R + 14 + pulse * 6, 0, TAU); c.strokeStyle = 'rgba(' + col + ',' + (0.5 + pulse * 0.4) + ')'; c.lineWidth = 6; c.stroke();
          }
        } else if (phase === 'flip') {
          var sy = Math.abs(Math.cos(flip * Math.PI)), lift = Math.sin(flip * Math.PI) * 140;
          c.save(); c.translate(PX, PY - lift); c.scale(1, Math.max(0.04, sy)); drawPattyTop(c, 0, 0, R, flip > 0.5 ? tones[0] : null, 1, 0); c.restore();
        } else if (phase === 'done') drawPattyTop(c, PX, PY, R, tones[1] || tones[0], 1, 0);
      }
    };
  }









  /* ---- Step: shape the patty ---- */
  function drawMince(c, x, y, flat, dimple) {
    var rx = 70 + 62 * flat, ry = 66 - 30 * flat, top = 26 - 14 * flat;
    c.save(); c.translate(x, y);
    D.shadow(c, 0, top * 0.6 + ry * 0.55 + 6, rx * 0.95, 14);
    shape(c, D.ellPath(0, top * 0.6, rx, ry * 0.55 + 10), '#D9656F', { lw: 5, depth: 6, dx: 0 });
    shape(c, D.ellPath(0, -top * 0.4, rx, ry * 0.55 + 10), '#E37C86', {
      lw: 5, depth: 0, inside: function (c) {
        var r = seeded(23); c.fillStyle = 'rgba(255,220,225,.75)';
        for (var i = 0; i < 26; i++) { var a = r() * TAU, k = Math.sqrt(r()); c.beginPath(); c.arc(Math.cos(a) * rx * 0.85 * k, -top * 0.4 + Math.sin(a) * (ry * 0.55 + 6) * k, 2 + r() * 2.5, 0, TAU); c.fill(); }
        if (dimple) { c.beginPath(); c.ellipse(0, -top * 0.4, 26 * dimple, 9 * dimple, 0, 0, TAU); c.fillStyle = '#C9505C'; c.fill(); }
      }
    });
    c.restore();
  }
  function ShapeScene() {
    var X = 320, Y = 320, flat = 0, squish = 0, dimple = 0, phase = 'press', taps = 0, NEED = 7;
    return {
      enter: function () { say('Tap to squash the mince flat'); },
      leave: function () { },
      hint: function (t) { if (phase === 'done') return null; return { x: X, y: Y - 10, press: (t % 1) < 0.5 }; },
      down: function (p) {
        if (Math.abs(p.x - X) > 190 || Math.abs(p.y - Y) > 130) return;
        if (phase === 'press') {
          taps++; flat = Math.min(1, taps / NEED); squish = 1; Sound.squish(); buzz(8);
          burst(p.x, p.y, 3, { colors: ['#FFFFFF'], shape: 'dot', size: 6, speed: 80, life: 0.4 });
          if (taps >= NEED) { phase = 'thumb'; say('Press a thumbprint in the middle'); }
        } else if (phase === 'thumb' && Math.abs(p.x - X) < 70 && Math.abs(p.y - Y) < 60) {
          phase = 'done'; Sound.pop(); Sound.chime(); Cat.show('Perfect patty!'); say('Ready to cook!');
          showNext('Next', nextStep);
        }
      },
      update: function (dt) { squish = Math.max(0, squish - dt * 5); if (phase === 'done') dimple = Math.min(1, dimple + dt * 4); },
      draw: function (c) {
        drawCuttingBoard(c, 70, 170, 500, 320, false);
        c.save(); c.translate(X, Y); c.scale(1 + squish * 0.08, 1 - squish * 0.12); drawMince(c, 0, 0, flat, dimple); c.restore();
        if (phase === 'press') drawRing(c, X, 110, flat);
      }
    };
  }

  /* ---- Step: melt the cheese on, then onto the bun ---- */
  function MeltScene() {
    var PX = 290, PY = 300, R = 112, SIDE = { x: 548, y: 560 }, CH = { x: 548, y: 420 };
    var phase = 'wait', fly = 0, melt = 0, off = 0, sizzle = Sound.loop('sizzle');
    function drawSlice(c, x, y, s, m) {
      // a square slice that softens and drips over the edges as it melts
      c.save(); c.translate(x, y); c.scale(s, s); c.rotate(0.2);
      var h = 80 + m * 14;
      shape(c, function (p) {
        p.moveTo(-h, -h + m * 30);
        [[-h, -h], [h, -h], [h, h], [-h, h]].forEach(function (q, i, all) {
          var nx = all[(i + 1) % 4], mx = (q[0] + nx[0]) / 2, my = (q[1] + nx[1]) / 2, out = 1 + m * 0.35;
          p.quadraticCurveTo(q[0] * (1 - m * 0.25), q[1] * (1 - m * 0.25), mx * out, my * out);
        });
        p.closePath();
      }, 'rgba(255,201,60,.92)', { lw: 4, depth: 8, shine: [-24, -30, 26, 8, -0.4] });
      c.restore();
    }
    return {
      enter: function () { say('Tap the cheese to put it on'); },
      leave: function () { sizzle.stop(); },
      hint: function (t) { return phase === 'wait' ? { x: CH.x, y: CH.y, press: (t % 1.2) < 0.6 } : null; },
      down: function (p) { if (phase === 'wait' && dist(p, CH) < 90) { phase = 'fly'; Sound.whoosh(); } },
      update: function (dt) {
        sizzle.set(phase === 'off' || phase === 'done' ? 0 : 0.7);
        if (phase === 'fly') { fly = Math.min(1, fly + dt * 2.2); if (fly >= 1) { phase = 'melt'; Sound.plop(); say('Watch it melt...'); } }
        if (phase === 'melt') { melt = Math.min(1, melt + dt * 0.6); if (melt >= 1) { phase = 'off'; Sound.whoosh(); } }
        if (phase === 'off') {
          off = Math.min(1, off + dt * 1.6);
          if (off >= 1) {
            phase = 'done'; Sound.plop(); Sound.chime();
            dish.layers.unshift({ kind: 'cheese' });
            Cat.show('Cheesy!'); say(dish.patty === 'perfect' ? 'Perfect cheeseburger patty!' : 'Melty cheese!');
            showNext('Next', nextStep);
          }
        }
      },
      draw: function (c) {
        drawPan(c, PX, PY, 180, '#3FA7F5', true);
        drawSidePlate(c, SIDE.x, SIDE.y + 10, 80);
        drawBunBottom(c, SIDE.x, SIDE.y + 4, 0.42);
        if (phase === 'wait') { c.beginPath(); c.ellipse(CH.x, CH.y + 36, 60, 14, 0, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 3.5); drawSlice(c, CH.x, CH.y, 0.42, 0); }
        if (phase === 'done') { drawLayer(c, { kind: 'patty', tone: dish.patty }, SIDE.x, SIDE.y - 10, 0.42); drawLayer(c, { kind: 'cheese' }, SIDE.x, SIDE.y - 27, 0.42); return; }
        var k = phase === 'off' ? easeOut(off) : 0;
        c.save(); c.translate(lerp(PX, SIDE.x, k), lerp(PY, SIDE.y - 14, k) - Math.sin(k * Math.PI) * 90); c.scale(lerp(1, 0.5, k), lerp(1, 0.3, k));
        drawPattyTop(c, 0, 0, R, dish.patty, 1, 0);
        if (phase === 'melt' || phase === 'off') drawSlice(c, 0, 0, 1, easeOut(melt));
        c.restore();
        if (phase === 'fly') { var f = easeOut(fly); drawSlice(c, lerp(CH.x, PX, f), lerp(CH.y, PY, f) - Math.sin(f * Math.PI) * 80, lerp(0.42, 1, f), 0); }
      }
    };
  }

  /* ---- Step: wash the lettuce ---- */
  var LETTUCE_LEAF = new Path2D();
  LETTUCE_LEAF.moveTo(-60, 10);
  for (var li = 0; li <= 8; li++) { var lt = li / 8, lx = -60 + 120 * lt; LETTUCE_LEAF.quadraticCurveTo(lx - 7, -44 - Math.sin(lt * Math.PI) * 14 + (li % 2) * 12, lx, -30 - Math.sin(lt * Math.PI) * 16); }
  LETTUCE_LEAF.quadraticCurveTo(70, 20, 30, 38); LETTUCE_LEAF.quadraticCurveTo(0, 50, -30, 38); LETTUCE_LEAF.quadraticCurveTo(-70, 20, -60, 10); LETTUCE_LEAF.closePath();
  function drawLettuce(c, x, y, s, dirt, a) {
    c.save(); c.translate(x, y); c.rotate(a || 0); c.scale(s, s);
    shape(c, LETTUCE_LEAF, '#7BD389', {
      lw: 4, depth: 6, inside: function (c) {
        c.strokeStyle = '#B8EBA8'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 40); c.lineTo(0, -30); c.moveTo(0, 10); c.lineTo(-28, -16); c.moveTo(0, 10); c.lineTo(28, -16); c.stroke();
        if (dirt > 0) { c.globalAlpha = dirt; c.fillStyle = '#8A5A2B'; var r = seeded(61); for (var j = 0; j < 9; j++) { c.beginPath(); c.arc((r() - 0.5) * 90, (r() - 0.5) * 50, 3 + r() * 4, 0, TAU); c.fill(); } c.globalAlpha = 1; }
      }
    });
    c.restore();
  }
  function LettuceScene() {
    var BX2 = 380, BY2 = 250, leaves = [0, 1, 2].map(function (i) { return { home: { x: 92, y: 210 + i * 130 }, x: 92, y: 210 + i * 130, clean: 0, state: 'dirty', t: 0, a: -0.2 + i * 0.2 }; });
    var held = null, last = null, splash = Sound.loop('stir'), speed = 0, TOWEL = { x: 380, y: 590 };
    function inWater(p) { var nx = (p.x - BX2) / 200, ny = (p.y - BY2) / 120; return nx * nx + ny * ny < 1; }
    return {
      enter: function () { say('Drag a leaf into the water and swish it'); },
      leave: function () { splash.stop(); },
      hint: function (t) {
        var l = leaves.filter(function (q) { return q.state === 'dirty'; })[0]; if (!l || held) return null;
        var k = (t % 1.8) / 1.8; return { x: lerp(l.x, BX2, Math.min(1, k * 1.6)), y: lerp(l.y, BY2, Math.min(1, k * 1.6)), press: true };
      },
      down: function (p) {
        held = null; leaves.forEach(function (l) { if (l.state === 'dirty' && dist(p, l) < 80 && !held) held = l; });
        if (held) { Sound.pop(); last = p; }
      },
      move: function (p) {
        if (!held) return;
        held.x = p.x; held.y = p.y;
        if (inWater(p) && last) {
          var d = dist(p, last); held.clean = Math.min(1, held.clean + d / 900); speed = Math.min(1, speed + d / 60);
          if (Math.random() < d / 30) burst(p.x + (Math.random() - 0.5) * 60, p.y, 1, { colors: ['rgba(255,255,255,.9)', 'rgba(170,222,255,.9)'], shape: 'dot', size: 10, speed: 70, gravity: -40, life: 0.6 });
          if (held.clean >= 1) { held.state = 'fly'; held.t = 0; held.from = { x: p.x, y: p.y }; held = null; Sound.chime(); }
        }
        last = p;
      },
      up: function () { if (held && !inWater(held)) { held.x = held.home.x; held.y = held.home.y; } held = null; last = null; },
      update: function (dt) {
        speed *= Math.pow(0.08, dt); splash.set(speed);
        leaves.forEach(function (l, i) {
          if (l.state === 'fly') { l.t = Math.min(1, l.t + dt * 2); if (l.t >= 1) { l.state = 'clean'; Sound.plop(); burst(TOWEL.x - 120 + i * 120, TOWEL.y - 20, 6, { colors: ['rgba(170,222,255,.9)'], shape: 'dot', size: 7, speed: 120, gravity: 300, life: 0.5 }); } }
        });
        if (leaves.every(function (l) { return l.state === 'clean'; }) && !this.done) {
          this.done = true; Cat.show('Crunchy and clean!'); say('All washed!'); showNext('Next', nextStep);
        }
      },
      draw: function (c) {
        // a wide bowl of water and a tea towel to dry the leaves on
        rr(c, TOWEL.x - 200, TOWEL.y - 40, 400, 74, 14); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 4);
        c.save(); rr(c, TOWEL.x - 200, TOWEL.y - 40, 400, 74, 14); c.clip(); c.fillStyle = '#FF9EB0';
        for (var tx = TOWEL.x - 200; tx < TOWEL.x + 200; tx += 40) c.fillRect(tx, TOWEL.y - 40, 20, 74);
        c.restore(); rr(c, TOWEL.x - 200, TOWEL.y - 40, 400, 74, 14); ink(c, 4);
        D.shadow(c, BX2, BY2 + 112, 170, 18);
        shape(c, function (p) { p.moveTo(BX2 - 230, BY2); p.bezierCurveTo(BX2 - 230, BY2 + 150, BX2 + 230, BY2 + 150, BX2 + 230, BY2); p.closePath(); }, D.tone(c, '#C3CBD4', BY2, BY2 + 112), { lw: 5, depth: 14, shine: [BX2 - 170, BY2 + 50, 12, 30, 0.5, 0.35] });
        shape(c, D.ellPath(BX2, BY2, 230, 70), '#E8ECF2', {
          lw: 5, depth: 0, inside: function (c) {
            c.beginPath(); c.ellipse(BX2, BY2 + 6, 206, 56, 0, 0, TAU); c.fillStyle = 'rgba(140,205,250,.85)'; c.fill();
            c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(BX2 - 90, BY2 - 14, 60, 8, -0.1, 0, TAU); c.fill();
          }
        });
        leaves.forEach(function (l, i) {
          if (l.state === 'clean') drawLettuce(c, TOWEL.x - 120 + i * 120, TOWEL.y - 6, 0.7, 0, l.a);
          else if (l.state === 'fly') { var k = easeOut(l.t); drawLettuce(c, lerp(l.from.x, TOWEL.x - 120 + i * 120, k), lerp(l.from.y, TOWEL.y - 6, k) - Math.sin(k * Math.PI) * 120, lerp(0.9, 0.7, k), 0, l.a); }
          else if (l !== held) drawLettuce(c, l.x, l.y, 0.9, 1 - l.clean, l.a);
        });
        if (held) {
          c.save(); if (inWater(held)) { c.beginPath(); c.ellipse(BX2, BY2 + 6, 206, 56, 0, 0, TAU); c.rect(0, 0, 640, BY2 - 20); c.clip('evenodd'); }
          drawLettuce(c, held.x, held.y, 0.9, 1 - held.clean, held.a); c.restore();
          if (inWater(held)) { c.save(); c.beginPath(); c.ellipse(BX2, BY2 + 6, 206, 56, 0, 0, TAU); c.clip(); c.globalAlpha = 0.6; drawLettuce(c, held.x, held.y, 0.9, 1 - held.clean, held.a); c.restore(); }
        }
      }
    };
  }

  /* ---- Step: fry the chips ---- */
  var CHIP_TONE = DISH.CHIP_COLOURS;
  function ChipsScene() {
    var FX = 320, FY = 380, T_OK = 2.6, T_BURN = 5.4, T_MAX = 8;
    var phase = 'wait', drop = 0, t = 0, said = 0, swipe = null, lift = 0, fry = Sound.loop('sizzle');
    var chips = []; var r = seeded(77); for (var i = 0; i < 16; i++) { var q = { x: (r() - 0.5) * 170, y: (r() - 0.5) * 30, a: (r() - 0.5) * 0.9, l: 46 + r() * 22 }; q.path = D.rrPath(-q.l / 2, -7, q.l, 14, 4); chips.push(q); }
    function colour() { return t < T_OK ? D.mix('#FFF4CC', CHIP_TONE.perfect, t / T_OK) : t <= T_BURN ? CHIP_TONE.perfect : D.mix(CHIP_TONE.perfect, CHIP_TONE.burnt, clamp((t - T_BURN) / 2, 0, 1)); }
    function basketY() { return lerp(FY - 150, FY - 10, easeOut(drop)) - easeOut(lift) * 150; }
    return {
      enter: function () { say('Tap the basket to fry the chips'); },
      leave: function () { fry.stop(); },
      hint: function (k) {
        if (phase === 'wait') return { x: FX, y: basketY(), press: (k % 1.2) < 0.6 };
        if (phase === 'fry' && t >= T_OK) { var q = (k % 1.3) / 1.3; return { x: FX, y: FY + 60 - q * 200, press: q < 0.9 }; }
        return null;
      },
      down: function (p) {
        if (phase === 'wait' && Math.abs(p.x - FX) < 160 && Math.abs(p.y - basketY()) < 110) { phase = 'drop'; Sound.whoosh(); }
        if (phase === 'fry' && t > 0.4) swipe = p;
      },
      move: function (p) {
        if (swipe && phase === 'fry' && swipe.y - p.y > 60) {
          swipe = null; phase = 'lift'; Sound.whoosh();
          dish.chips = t < T_OK ? 'pale' : t <= T_BURN ? 'perfect' : 'burnt';
        }
      },
      up: function () { swipe = null; },
      update: function (dt) {
        fry.set(phase === 'fry' ? 1.4 : 0);
        if (phase === 'fry' && Math.random() < dt * 26) Sound.riceTick();
        if (phase === 'drop') { drop = Math.min(1, drop + dt * 2.2); if (drop >= 1) { phase = 'fry'; t = 0; Sound.squish(); say('Fry until golden...'); } }
        if (phase === 'fry') {
          t = Math.min(T_MAX + 4, t + dt);
          if (Math.random() < dt * 14) burst(FX + (Math.random() - 0.5) * 300, FY - 30, 1, { colors: ['rgba(255,250,220,.9)'], shape: 'dot', size: 9, speed: 40, gravity: -60, life: 0.4 });
          if (t >= T_OK && said < 1) { said = 1; Sound.pop(); say('Golden! Swipe up to lift them out'); }
          if (t >= T_BURN && said < 2) { said = 2; say('Quick, they’re burning!'); }
        }
        if (phase === 'lift') {
          lift = Math.min(1, lift + dt * 1.8);
          if (lift >= 1) {
            phase = 'done'; Sound.chime(); buzz(15);
            if (dish.chips === 'perfect') Cat.show('Crispy chips!');
            say(dish.chips === 'perfect' ? 'Golden chips!' : dish.chips === 'pale' ? 'A bit soft!' : 'Extra crunchy!');
            showNext('Done', finishDish);
          }
        }
      },
      draw: function (c) {
        if (phase === 'done') { drawBurgerScene(c, dish); return; }
        if (phase === 'fry') drawGauge(c, FX, t, T_OK, T_BURN, T_MAX, ['#FFF4CC', '#6A3A1E']);
        // the fryer: a steel pot of hot oil
        D.shadow(c, FX, FY + 200, 240, 26);
        // the red band goes right round the pot: drawn inside it, so its ends meet the pot's outline
        shape(c, D.rrPath(FX - 230, FY - 40, 460, 240, 30), D.tone(c, '#C3CBD4', FY - 40, FY + 200), {
          lw: 5, depth: 14, inside: function (c) {
            c.fillStyle = '#FF6B57'; c.fillRect(FX - 240, FY + 120, 480, 24);
            c.beginPath(); c.moveTo(FX - 240, FY + 120); c.lineTo(FX + 240, FY + 120); c.moveTo(FX - 240, FY + 144); c.lineTo(FX + 240, FY + 144); ink(c, 3);
          }
        });
        shape(c, D.ellPath(FX, FY - 40, 230, 54), '#E8ECF2', { lw: 5, depth: 0 });
        c.beginPath(); c.ellipse(FX, FY - 34, 206, 42, 0, 0, TAU); c.fillStyle = '#F6C445'; c.fill();
        // basket with chips
        var by = basketY(), col = colour();
        c.save(); c.translate(FX, by);
        rr(c, 120, -60, 140, 20, 10); c.fillStyle = '#2A2340'; c.fill();
        c.beginPath(); c.moveTo(-150, -40); c.lineTo(-136, 30); c.lineTo(136, 30); c.lineTo(150, -40); c.closePath(); c.fillStyle = 'rgba(160,170,184,.35)'; c.fill(); ink(c, 4.5);
        chips.forEach(function (q) { shape(c, q.path, col, { m: new DOMMatrix().translate(q.x, q.y - 14).rotate((q.a + Math.PI / 2) * 180 / Math.PI), lw: 3, depth: 3 }); });
        c.strokeStyle = 'rgba(42,35,64,.5)'; c.lineWidth = 2;
        for (var gx = -130; gx <= 130; gx += 20) { c.beginPath(); c.moveTo(gx, -38); c.lineTo(gx * 0.92, 28); c.stroke(); }
        c.restore();
        // the oil covers the basket once it's in
        if (drop > 0 && lift < 0.6) { c.save(); c.globalAlpha = 0.55 * easeOut(drop) * (1 - lift); c.beginPath(); c.ellipse(FX, FY - 34, 206, 42, 0, 0, TAU); c.fillStyle = '#F6C445'; c.fill(); c.restore(); }
      }
    };
  }

  var BURGER_TOOLS = ['lettuce', 'tomato', 'cheese', 'onion', 'ketchup', 'mustard'];
  var BURGER_LABEL = { lettuce: 'Lettuce', tomato: 'Tomato', cheese: 'Cheese', onion: 'Onion', ketchup: 'Sauce', mustard: 'Mustard' };
  var BURGER_ICONS = {
    lettuce: '<svg viewBox="0 0 40 40"><path d="M4 22 Q8 12 14 16 Q18 8 24 14 Q30 8 34 16 Q38 20 36 26 Q20 34 4 26 Z" fill="#7BD389" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><path d="M10 24 Q20 20 30 24" fill="none" stroke="#B8EBA8" stroke-width="2.5"/></svg>',
    tomato: '<svg viewBox="0 0 40 40"><circle cx="20" cy="21" r="15" fill="#FF4D3D" stroke="#2A2340" stroke-width="3"/><circle cx="20" cy="21" r="9" fill="#FF9A80"/><g fill="#FFE7A0"><ellipse cx="16" cy="19" rx="1.6" ry="2.6"/><ellipse cx="24" cy="19" rx="1.6" ry="2.6"/><ellipse cx="20" cy="25" rx="2.6" ry="1.6"/></g></svg>',
    cheese: '<svg viewBox="0 0 40 40"><path d="M4 10 H36 V24 L30 24 L27 33 L24 24 L12 24 L9 34 L6 24 L4 24 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="16" r="2.5" fill="#F2A900"/><circle cx="27" cy="14" r="2" fill="#F2A900"/></svg>',
    onion: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#2A2340" stroke-width="7"/><circle cx="20" cy="20" r="15" fill="none" stroke="#F7F0E3" stroke-width="3.5"/><circle cx="20" cy="20" r="8" fill="none" stroke="#2A2340" stroke-width="6"/><circle cx="20" cy="20" r="8" fill="none" stroke="#E9C6E2" stroke-width="2.5"/></svg>',
    ketchup: '<svg viewBox="0 0 40 40"><path d="M15 3 H25 L24 9 Q33 12 32 22 V34 Q32 37 29 37 H11 Q8 37 8 34 V22 Q7 12 16 9 Z" fill="#E8322B" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><rect x="11" y="20" width="18" height="9" rx="2" fill="#fff"/></svg>',
    mustard: '<svg viewBox="0 0 40 40"><path d="M15 3 H25 L24 9 Q33 12 32 22 V34 Q32 37 29 37 H11 Q8 37 8 34 V22 Q7 12 16 9 Z" fill="#F2C200" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><rect x="11" y="20" width="18" height="9" rx="2" fill="#fff"/></svg>'
  };

  /* ---- Step: build it, any toppings, any order ---- */
  function BuildScene() {
    var MAX = 10, timers = [], praised = false;
    function later(s, fn) { timers.push({ t: s, fn: fn }); }
    function add(kind) {
      if (dish.topBun) return;
      if (dish.layers.length >= MAX) { say('That’s a huge burger!'); return; }
      var prev = dish.layers[dish.layers.length - 1];
      dish.layers.push({ kind: kind, t: 0, dx: (Math.random() - 0.5) * 10 }); refreshUndo();
      if (kind === 'ketchup' || kind === 'mustard') Sound.squish(); else Sound.whoosh();
      say(pick(['Yum!', 'Stack it up!', 'Ooh, nice!', 'What next?']));
      if (!praised && dish.layers.length >= 4) { praised = true; later(0.6, function () { Cat.show('Looks tasty!'); }); }
      if (prev && prev.kind === kind) say('Double ' + BURGER_LABEL[kind].toLowerCase() + '!');
    }
    function undo() {
      if (dish.topBun || !dish.layers.length) return;
      dish.layers.pop(); Sound.pop(); say('Taken off'); refreshUndo();
    }
    return {
      enter: function () {
        toolsEl.innerHTML = BURGER_TOOLS.map(function (t) {
          return '<button class="tool" type="button" data-tool="' + t + '">' + BURGER_ICONS[t] + '<span>' + BURGER_LABEL[t] + '</span></button>';
        }).join('');
        toolsEl.querySelectorAll('.tool').forEach(function (b) {
          b.addEventListener('click', function () { Sound.init(); add(b.dataset.tool); });
        });
        say('Tap to add toppings!');
        setUndo({ canUndo: function () { return !dish.topBun && dish.layers.length > 0; }, undo: undo });
        showNext('Done', function () {
          if (!dish.topBun) { dish.topBun = true; dish.topBunT = 0; Sound.whoosh(); refreshUndo(); }
          later(0.9, nextStep);
        });
      },
      leave: function () { toolsEl.innerHTML = ''; },
      hint: function () { return null; },
      down: function (p) {
        // tap the top of the burger to take the last topping off
        var topY = BY - 44 - LAYER_H.patty - dish.layers.reduce(function (n, L) { return n + (LAYER_H[L.kind] || 12); }, 0);
        if (dish.layers.length && Math.abs(p.x - BX) < 170 && p.y > topY - 30 && p.y < topY + 30) undo();
      },
      update: function (dt) {
        for (var i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { var f = timers[i].fn; timers.splice(i, 1); f(); } }
        dish.layers.forEach(function (L) { if (L.t !== undefined && L.t < 1) { L.t = Math.min(1, L.t + dt * 3); if (L.t >= 1) { Sound.plop(); delete L.t; } } });
        if (dish.topBun && dish.topBunT !== undefined) { dish.topBunT = Math.min(1, dish.topBunT + dt * 2.2); if (dish.topBunT >= 1) { delete dish.topBunT; Sound.plop(); buzz(15); } }
      },
      draw: function (c) { drawBurgerScene(c, dish); }
    };
  }

  /* =============== PIZZA =============== */
  /* the pizza on its own (no plate), at (x, y) and scale s: the shared drawing clipped to the pizza */
  function drawPizzaOnly(c, d, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.translate(-ZX, -ZY);
    c.beginPath(); c.ellipse(ZX, ZY + 6, ZRX + 4, ZRY + 13, 0, 0, TAU); c.clip();
    drawPizzaScene(c, d);
    c.restore();
  }
  /* the floury wooden board the pizza is made on */
  function drawBoard(c) {
    D.shadow(c, ZX, ZY + 34, 290, 80);
    shape(c, D.rrPath(ZX + 270, ZY - 4, 70, 30, 14), '#C98B4B', { lw: 4, depth: 4, dx: 0 });
    shape(c, D.ellPath(ZX, ZY + 20, 290, 80), '#E3AE6E', {
      lw: 5, depth: 0, inside: function (c) {
        c.beginPath(); c.ellipse(ZX, ZY + 14, 280, 74, 0, 0, TAU); c.fillStyle = '#F0C489'; c.fill();
        c.fillStyle = 'rgba(255,255,255,.55)'; var r = seeded(41);
        for (var i = 0; i < 40; i++) { var a = r() * TAU, k = Math.sqrt(r()) * 0.95; c.beginPath(); c.arc(ZX + Math.cos(a) * 270 * k, ZY + 14 + Math.sin(a) * 70 * k, 1.5 + r() * 2.5, 0, TAU); c.fill(); }
      }
    });
  }
  /* screen point -> flat pizza coordinates (-200..200 from the middle) */
  function toPizza(p) { return { x: p.x - ZX, y: (p.y - ZY) / ZSQ }; }
  function onPizza(p, pad) { var q = toPizza(p); return Math.hypot(q.x, q.y) < ZRX - (pad || 0); }

  /* a ball of pizza dough: shaggy and floury at first, smooth when kneaded */
  function drawDoughBall(c, x, y, r, smooth, squash) {
    c.save(); c.translate(x, y); c.scale(1 + (squash || 0) * 0.25, 1 - (squash || 0) * 0.3);
    shape(c, function (p) {
      for (var i = 0; i <= 30; i++) { var a = i / 30 * TAU, w = 1 + (1 - smooth) * (0.09 * Math.sin(a * 5) + 0.06 * Math.sin(a * 9 + 1)); p.lineTo(Math.cos(a) * r * 1.2 * w, Math.sin(a) * r * 0.8 * w); }
      p.closePath();
    }, D.mix('#E9D3A6', '#F6E3BC', smooth), {
      lw: 5, depth: r * 0.14, inside: function (c) {
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.35, r * 0.4, r * 0.14, -0.2, 0, TAU); c.fill();
        if (smooth < 1) { c.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - smooth)) + ')'; var q = seeded(3); for (var j = 0; j < 22; j++) { c.beginPath(); c.arc((q() - 0.5) * r * 1.8, (q() - 0.5) * r, 2 + q() * 4, 0, TAU); c.fill(); } }
      }
    });
    c.restore();
  }

  /* ---- Step: make the dough (flour, water, yeast, knead) ---- */
  function KneadScene() {
    var phase = 'flour', flour = 0, water = 0, holding = false, yeast = null, pushes = 0, NEED = 8, squash = 0, swipe = null;
    var bag = flourPourer({ x: 560, y: 220 }, { x: 430, y: 170 }), jug = jugPourer({ x: 560, y: 220 }, { x: 450, y: 180 }, '#CFEFFF', 'rgba(170,222,255,.95)');
    var YS = { x: 96, y: 560 }, pour = Sound.loop('pour');
    return {
      enter: function () { say('Hold the bag to pour the flour'); },
      leave: function () { pour.stop(); },
      hint: function (t) {
        if (phase === 'flour' || phase === 'water') return { x: 560, y: 230, press: (t % 1.4) < 0.9 };
        if (phase === 'yeast') return yeast ? null : { x: YS.x, y: YS.y, press: (t % 1.2) < 0.6 };
        if (phase === 'knead') { var k = (t % 1.2) / 1.2; return { x: ZX, y: ZY - 60 + k * 120, press: k < 0.9 }; }
        return null;
      },
      down: function (p) {
        if (phase === 'flour' && bag.near(p)) holding = true;
        if (phase === 'water' && jug.near(p)) holding = true;
        if (phase === 'yeast' && !yeast && dist(p, YS) < 80) { yeast = { t: 0 }; Sound.whoosh(); }
        if (phase === 'knead') swipe = p;
      },
      move: function (p) {
        // each push (a swipe up or down over the dough) kneads it a little
        if (phase === 'knead' && swipe && Math.abs(p.y - swipe.y) > 70 && Math.abs(p.x - ZX) < 260) {
          swipe = p; pushes++; squash = 1; Sound.squish(); buzz(8);
          burst(ZX + (Math.random() - 0.5) * 120, ZY - 40, 3, { colors: ['#FFFFFF'], shape: 'dot', size: 6, speed: 90, life: 0.5 });
          if (pushes >= NEED) { phase = 'done'; Sound.chime(); Cat.show('Smooth dough!'); say('A lovely ball of dough!'); showNext('Next', nextStep); }
        }
      },
      up: function () { holding = false; swipe = null; },
      update: function (dt) {
        var a = bag.update(holding && phase === 'flour', dt), b = jug.update(holding && phase === 'water', dt);
        if (a) flour = Math.min(1, flour + dt * 0.5);
        if (b) water = Math.min(1, water + dt * 0.55);
        pour.set(b ? 0.8 : a ? 0.3 : 0);
        if (a && Math.random() < dt * 20) Sound.sprinkle();
        if (phase === 'flour' && flour >= 1) { phase = 'water'; holding = false; Sound.pop(); say('Now hold the jug to pour the water'); }
        if (phase === 'water' && water >= 1) { phase = 'yeast'; holding = false; Sound.pop(); say('Tap the yeast to add it'); }
        if (yeast) {
          yeast.t = Math.min(1, yeast.t + dt * 1.6);
          if (yeast.t >= 0.6 && !yeast.tipped) { yeast.tipped = true; Sound.sprinkle(); }
          if (yeast.t >= 1) { yeast = null; phase = 'knead'; Sound.pop(); say('Swipe up and down to knead it!'); }
        }
        squash = Math.max(0, squash - dt * 4);
      },
      draw: function (c) {
        drawBoard(c);
        var cx = ZX, cy = ZY - 10;
        if (phase === 'knead' || phase === 'done') { D.shadow(c, cx, cy + 36, 96, 14); drawDoughBall(c, cx, cy - 20, 76, pushes / NEED, squash); }
        else {
          // a mound of flour with a well in the middle, filling with water
          if (flour > 0) {
            var fs = 0.3 + 0.7 * easeOut(flour);
            c.save(); c.translate(cx, cy); c.scale(fs, fs);
            c.beginPath(); c.ellipse(0, 0, 190, 64, 0, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); c.strokeStyle = 'rgba(42,35,64,.25)'; c.lineWidth = 3; c.stroke();
            c.beginPath(); c.ellipse(0, -6, 90, 28, 0, 0, TAU); c.fillStyle = '#F1ECE2'; c.fill();
            if (water > 0) { c.beginPath(); c.ellipse(0, -6, 80 * Math.sqrt(water), 24 * Math.sqrt(water), 0, 0, TAU); c.fillStyle = 'rgba(150,210,250,.85)'; c.fill(); }
            if (yeast && yeast.tipped) { c.fillStyle = '#C9A26E'; var q = seeded(12); for (var i = 0; i < 20; i++) { c.beginPath(); c.arc((q() - 0.5) * 120, -6 + (q() - 0.5) * 30, 2.2, 0, TAU); c.fill(); } }
            c.restore();
          }
          if (phase === 'flour' || bag.shown()) bag.draw(c, holding && phase === 'flour', cy);
          if (phase === 'water' || jug.shown()) jug.draw(c, holding && phase === 'water', cy, 1 - water * 0.8);
          // the yeast packet
          var yk = yeast ? easeOut(Math.min(1, yeast.t / 0.6)) : 0, yx = lerp(YS.x, cx - 30, yk), yy = lerp(YS.y, cy - 90, yk) - Math.sin(yk * Math.PI) * 90;
          c.save(); c.translate(yx, yy); c.rotate(yeast && yeast.t > 0.6 ? 2.2 : -0.2);
          shape(c, D.rrPath(-34, -26, 68, 52, 6), '#FFC93C', {
            lw: 4, depth: 5, inside: function (c) {
              // the crimped strip along the top
              c.beginPath(); c.moveTo(-34, -15); c.lineTo(34, -15); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
              c.beginPath(); for (var z = -34; z <= 34; z += 8.5) { c.moveTo(z, -26); c.lineTo(z, -15); } c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 2; c.stroke();
              c.fillStyle = '#FF6B57'; c.beginPath(); c.arc(0, 4, 10, 0, TAU); c.fill();
            }
          });
          c.restore();
        }
        if (phase === 'knead') drawRing(c, ZX, 160, pushes / NEED);
      }
    };
  }

  /* ---- Step: let it rise under a tea towel ---- */
  function RiseScene() {
    var cx = 320, cy = 300, phase = 'cover', towel = 0, t = 0, RISE = 5, puff = 0;
    function ballTop() { return cy - 10 - puff * 26 - (80 + puff * 46) * 0.8; }
    function drawTowel(c, k) {
      // red and white check, draped over the bowl; its middle sits just over the top of the dough, so it bulges as the dough rises
      var y = lerp(-140, cy - 10, easeOut(k)), peak = ballTop() - 14 + (y - (cy - 10)), ctl = 2 * peak - (y + 60);
      c.save(); c.beginPath(); c.moveTo(cx - 240, y + 60); c.quadraticCurveTo(cx, ctl, cx + 240, y + 60); c.lineTo(cx + 220, y + 130); c.quadraticCurveTo(cx, y + 90, cx - 220, y + 130); c.closePath();
      c.fillStyle = '#FFFFFF'; c.fill(); c.save(); c.clip(); c.fillStyle = 'rgba(255,107,87,.75)';
      for (var gx = cx - 260; gx < cx + 260; gx += 40) c.fillRect(gx, y - 300, 20, 500);
      for (var gy = y - 300; gy < y + 200; gy += 40) c.fillRect(cx - 260, gy, 520, 20);
      c.restore(); ink(c, 5); c.restore();
    }
    return {
      enter: function () { say('Tap to cover the dough'); },
      leave: function () { },
      hint: function (k) { return phase === 'cover' || phase === 'ready' ? { x: cx, y: cy - 40, press: (k % 1.2) < 0.6 } : null; },
      down: function (p) {
        if (Math.abs(p.x - cx) > 240 || p.y > cy + 220) return;
        if (phase === 'cover') { phase = 'covering'; Sound.whoosh(); }
        else if (phase === 'ready') { phase = 'uncover'; Sound.whoosh(); }
      },
      update: function (dt) {
        if (phase === 'covering') { towel = Math.min(1, towel + dt * 2); if (towel >= 1) { phase = 'rise'; t = 0; say('Shh... the dough is rising'); Cat.show('Zzz...', 2600); } }
        if (phase === 'rise') { t += dt; puff = Math.min(1, t / RISE); if (t >= RISE) { phase = 'ready'; Sound.chime(); say('Tap to peek!'); } }
        if (phase === 'uncover') { towel = Math.max(0, towel - dt * 2); if (towel <= 0) { phase = 'done'; burst(cx, cy - 40, 18, { colors: ['#FFC93C', '#FFFFFF'], speed: 200, life: 0.8 }); Cat.show('So puffy!'); say('Big and puffy!'); showNext('Next', nextStep); } }
      },
      draw: function (c) {
        drawBigBowl(c, cx, cy, 'blue');
        drawDoughBall(c, cx, cy - 10 - puff * 26, 80 + puff * 46, 1);
        if (towel > 0) drawTowel(c, towel);
        if (phase === 'rise') drawRing(c, cx, 80, puff);
      }
    };
  }

  /* ---- Step: grate the cheese over the pizza ---- */
  var GRATER = new Path2D(); GRATER.moveTo(-46, 60); GRATER.lineTo(-36, -80); GRATER.lineTo(36, -80); GRATER.lineTo(46, 60); GRATER.closePath();
  function GrateScene() {
    var cells = [], STEP = 40, R = ZRX - 46, shreds = [], falling = [], down = false, grater = null, lastY = null, acc = 0, done = false, fade = 0, rub = Sound.loop('rub');
    for (var x = -R; x <= R; x += STEP) for (var y = -R; y <= R; y += STEP) if (Math.hypot(x, y) < R) cells.push({ x: x, y: y, on: false });
    function coverage() { return cells.filter(function (q) { return q.on; }).length / cells.length; }
    function drawGrater(c, p) {
      c.save(); c.translate(p.x, p.y);
      shape(c, D.rrPath(-30, -110, 60, 30, 12), '#FF6B57', { lw: 4, depth: 4 });
      shape(c, GRATER, D.tone(c, '#D5DBE3', 0, 0, -46, 46), {
        lw: 4, depth: 0, inside: function (c) {
          // the holes stay clear of the edges
          c.fillStyle = '#8A93A0'; for (var gy = -66; gy < 50; gy += 16) { var half = 36 + (gy + 80) / 14 - 9; for (var gx = -28; gx <= 28; gx += 14) { var hx = gx + (gy / 16 % 2) * 7; if (Math.abs(hx) > half) continue; c.beginPath(); c.ellipse(hx, gy, 4, 2.5, 0, 0, TAU); c.fill(); } }
        }
      });
      // the block of cheese rubbing up and down the front
      var off = Math.sin(performance.now() / 70) * (down ? 22 : 0);
      shape(c, D.rrPath(22, -30 + off, 58, 70, 8), '#FFD86A', { lw: 4, depth: 5, inside: function (c) { c.fillStyle = '#F2B400'; c.beginPath(); c.arc(44, -6 + off, 5, 0, TAU); c.arc(62, 18 + off, 4, 0, TAU); c.fill(); } });
      c.restore();
    }
    return {
      enter: function () { say('Rub the cheese up and down over the pizza'); },
      leave: function () { rub.stop(); },
      hint: function (t) { if (done) return null; return { x: ZX + Math.sin(t * 0.8) * 140, y: ZY - 160 + Math.sin(t * 6) * 30, press: true }; },
      down: function (p) { if (done) return; down = true; grater = p; lastY = p.y; },
      move: function (p) {
        if (!down || done) return;
        acc += Math.abs(p.y - lastY) + Math.abs(p.x - grater.x) * 0.3; lastY = p.y; grater = p;
        while (acc > 10) {
          acc -= 10;
          for (var i = 0; i < 2; i++) falling.push({ x: p.x + (Math.random() - 0.5) * 80, y: p.y + 60, vy: 40 + Math.random() * 60, land: p.y + 150 + Math.random() * 60, a: Math.random() * 3 });
        }
      },
      up: function () { down = false; },
      update: function (dt) {
        rub.set(down && !done ? 0.8 : 0);
        for (var j = falling.length - 1; j >= 0; j--) {
          var f = falling[j]; f.vy += 700 * dt; f.y += f.vy * dt;
          if (f.y >= f.land) {
            falling.splice(j, 1);
            if (onPizza(f, 40)) {
              if (shreds.length < 600) shreds.push(f);
              var q = toPizza(f); cells.forEach(function (cell) { if (Math.hypot(cell.x - q.x, cell.y - q.y) < 46) cell.on = true; });
            }
          }
        }
        if (!done && coverage() >= 0.8) { done = true; dish.cheese = 1; down = false; Sound.chime(); Cat.show('So cheesy!'); say('Lots of cheese!'); showNext('Next', nextStep); }
        if (done) fade = Math.min(1, fade + dt * 1.5);
      },
      draw: function (c) {
        drawBoard(c); drawPizzaOnly(c, dish, ZX, ZY, 1);
        c.save(); c.globalAlpha = 1 - fade * 0.7; c.strokeStyle = '#FFE38A'; c.lineWidth = 4; c.lineCap = 'round';
        shreds.concat(falling).forEach(function (f) { c.beginPath(); c.moveTo(f.x - Math.cos(f.a) * 8, f.y - Math.sin(f.a) * 4); c.lineTo(f.x + Math.cos(f.a) * 8, f.y + Math.sin(f.a) * 4); c.stroke(); });
        c.restore();
        if (!done) { drawGrater(c, grater && down ? grater : { x: 560, y: 190 }); drawRing(c, 80, 120, coverage() / 0.8); }
      }
    };
  }

  /* ---- Step: slice it with the pizza wheel ---- */
  var SLICE_ANGLES = DISH.PIZZA_CUTS;
  function SliceScene() {
    var cut = [false, false, false], wheel = null, stroke = null, done = false, roll = 0;
    function lineEnds(deg, r) { var a = deg * Math.PI / 180; return [{ x: ZX - Math.cos(a) * r, y: ZY - Math.sin(a) * r * ZSQ }, { x: ZX + Math.cos(a) * r, y: ZY + Math.sin(a) * r * ZSQ }]; }
    return {
      enter: function () { say('Roll the cutter along a line'); },
      leave: function () { },
      hint: function (t) { var i = cut.indexOf(false); if (i < 0) return null; var e = lineEnds(SLICE_ANGLES[i], ZRX - 30), k = (t % 1.4) / 1.4; return { x: lerp(e[0].x, e[1].x, k), y: lerp(e[0].y, e[1].y, k), press: k < 0.9 }; },
      down: function (p) { wheel = p; stroke = [toPizza(p)]; },
      move: function (p) {
        if (!wheel || done) return;
        roll += dist(p, wheel) / 20; wheel = p; stroke.push(toPizza(p));
        // a stroke that runs along an uncut line (measured on the flat pizza) cuts it
        SLICE_ANGLES.forEach(function (deg, i) {
          if (cut[i]) return;
          var a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), lo = 1e9, hi = -1e9, ok = true;
          stroke.forEach(function (q) { var along = q.x * ux + q.y * uy; if (Math.abs(-q.x * uy + q.y * ux) > 55) ok = false; lo = Math.min(lo, along); hi = Math.max(hi, along); });
          if (ok && hi - lo > 260) { cut[i] = true; stroke = [toPizza(p)]; Sound.chop(); buzz(12); burst(p.x, p.y, 6, { colors: ['#FFC93C', '#FFFFFF'], speed: 150, life: 0.5 }); }
        });
        // keep only the recent part of the stroke so a wobble at the start doesn't spoil a cut
        if (stroke.length > 40) stroke.shift();
        if (cut.every(Boolean) && !done) { done = true; dish.cut = 1; Sound.chime(); Cat.show('Pizza party!'); say('Six slices!'); showNext('Done', finishDish); }
      },
      up: function () { wheel = null; stroke = null; },
      draw: function (c) {
        drawPizzaScene(c, dish);
        if (!done) SLICE_ANGLES.forEach(function (deg, i) {
          var e = lineEnds(deg, ZRX - 12);
          c.beginPath(); c.moveTo(e[0].x, e[0].y); c.lineTo(e[1].x, e[1].y);
          if (cut[i]) { c.strokeStyle = 'rgba(42,35,64,.55)'; c.lineWidth = 4; c.stroke(); }
          else { c.setLineDash([12, 10]); c.lineDashOffset = -performance.now() / 40; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 5; c.stroke(); c.setLineDash([]); }
        });
        if (wheel && !done) {
          c.save(); c.translate(wheel.x, wheel.y);
          rr(c, 8, -110, 22, 80, 10); c.fillStyle = '#3FA7F5'; c.fill(); ink(c, 4);
          c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.fillStyle = '#E3E9F0'; c.fill(); ink(c, 4.5);
          c.save(); c.rotate(roll); c.beginPath(); c.moveTo(-20, 0); c.lineTo(20, 0); c.moveTo(0, -20); c.lineTo(0, 20); c.strokeStyle = '#9AA6B2'; c.lineWidth = 4; c.stroke(); c.restore();
          c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fillStyle = INK; c.fill();
          c.restore();
        }
      }
    };
  }

  /* ---- Step: roll the dough flat ---- */
  function RollDoughScene() {
    var k = 0, NEED = 2200, down = false, last = null, pin = null, done = false, rubLoop = Sound.loop('rub'), speed = 0;
    function size() { return 0.34 + 0.66 * easeOut(k); }
    return {
      enter: function () { say('Roll the dough flat!'); },
      leave: function () { rubLoop.stop(); },
      hint: function (t) { if (done) return null; var q = (t % 1.6) / 1.6; return { x: ZX - 140 + q * 280, y: ZY + Math.sin(q * TAU * 2) * 20, press: true }; },
      down: function (p) { down = true; last = p; pin = p; },
      move: function (p) {
        if (!down || done) return;
        pin = p;
        var s = size(), nx = (p.x - ZX) / (ZRX * s + 60), ny = (p.y - ZY) / (ZRY * s + 60);
        if (last && nx * nx + ny * ny < 1.4) {
          var dd = dist(p, last); k = Math.min(1, k + dd / NEED); speed = Math.min(1, speed + dd / 50);
          if (Math.random() < dd / 60) burst(p.x + (Math.random() - 0.5) * 120, p.y, 1, { colors: ['#FFFFFF'], shape: 'dot', size: 6, speed: 50, life: 0.5 });
        }
        last = p;
        if (k >= 1 && !done) {
          done = true; pin = null; rubLoop.set(0); Sound.chime(); buzz(20);
          burst(ZX, ZY, 24, { colors: ['#FFC93C', '#FFFFFF', '#FF7EB6'], speed: 260, life: 0.9 });
          Cat.show('Nice and flat!'); say('Perfect pizza base!');
          showNext('Next', nextStep);
        }
      },
      up: function () { down = false; last = null; pin = null; },
      update: function (dt) { speed *= Math.pow(0.05, dt); rubLoop.set(speed); },
      draw: function (c) {
        drawBoard(c);
        var s = size(), lift = (1 - easeOut(k)) * 46;
        // a thick ball of dough that spreads out and gets thinner as it's rolled
        c.save(); c.translate(ZX, ZY);
        c.beginPath(); c.ellipse(0, 12, ZRX * s, ZRY * s + lift * 0.3, 0, 0, TAU); c.fillStyle = '#E2C08A'; c.fill(); ink(c, 5);
        c.beginPath(); c.ellipse(0, 12 - lift, ZRX * s, ZRY * s + lift * 0.3, 0, Math.PI, TAU); c.lineTo(ZRX * s, 12); c.ellipse(0, 12, ZRX * s, ZRY * s + lift * 0.3, 0, 0, Math.PI); c.closePath(); c.fillStyle = '#EED3A2'; c.fill();
        c.beginPath(); c.ellipse(0, -lift, ZRX * s, ZRY * s + lift * 0.3, 0, 0, TAU); c.fillStyle = '#F3DDB0'; c.fill(); ink(c, 5);
        c.beginPath(); c.ellipse(-ZRX * s * 0.3, -lift - ZRY * s * 0.35, ZRX * s * 0.25, 8, -0.1, 0, TAU); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
        c.restore();
        // the rolling pin follows the finger
        if (pin && !done) {
          c.save(); c.translate(clamp(pin.x, 150, 490), pin.y - 20);
          D.shadow(c, 0, 34, 150, 10);
          shape(c, D.rrPath(-170, -10, 50, 20, 10), '#C98B4B', { lw: 4, depth: 4, dx: 0 });
          shape(c, D.rrPath(120, -10, 50, 20, 10), '#C98B4B', { lw: 4, depth: 4, dx: 0 });
          shape(c, D.rrPath(-124, -24, 248, 48, 22), D.tone(c, '#F1C88E', -24, 24), {
            lw: 5, depth: 8, dx: 0, inside: function (c) { c.beginPath(); c.moveTo(-100, -12); c.lineTo(100, -12); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 5; c.lineCap = 'round'; c.stroke(); }
          });
          c.restore();
        }
        // progress ring
        if (!done) drawRing(c, ZX, 160, k);
      }
    };
  }

  /* ---- Step: spread the tomato sauce ---- */
  function SauceScene() {
    var cells = [], STEP = 34, R = ZRX - 30;
    for (var x = -R; x <= R; x += STEP) for (var y = -R; y <= R; y += STEP) if (Math.hypot(x, y) < R - 8) cells.push({ x: x, y: y, on: false, t: 0 });
    var down = false, ladle = null, done = false, rubLoop = Sound.loop('rub'), speed = 0, last = null;
    function coverage() { return cells.filter(function (q) { return q.on; }).length / cells.length; }
    return {
      enter: function () { say('Swirl the sauce around!'); },
      leave: function () { rubLoop.stop(); },
      hint: function (t) { if (done) return null; var a = t * 2.4; return { x: ZX + Math.cos(a) * 140, y: ZY + Math.sin(a) * 50, press: true }; },
      down: function (p) { down = true; ladle = p; last = p; this.move(p); },
      move: function (p) {
        if (!down || done) return;
        ladle = p;
        var q = toPizza(p);
        cells.forEach(function (cell) { if (!cell.on && Math.hypot(cell.x - q.x, cell.y - q.y) < 56) { cell.on = true; if (Math.random() < 0.3) Sound.squish(); } });
        if (last) speed = Math.min(1, speed + dist(p, last) / 60);
        last = p;
        if (coverage() >= 0.85) {
          done = true; dish.sauce = 1; ladle = null; rubLoop.set(0); Sound.chime(); buzz(20);
          burst(ZX, ZY, 22, { colors: ['#FF6B57', '#FFC93C', '#FFFFFF'], speed: 240, life: 0.9 });
          Cat.show('Saucy!'); say('Yummy tomato sauce!');
          showNext('Next', nextStep);
        }
      },
      up: function () { down = false; ladle = null; last = null; },
      update: function (dt) {
        cells.forEach(function (cell) { if (cell.on && cell.t < 1) cell.t = Math.min(1, cell.t + dt * 5); });
        speed *= Math.pow(0.05, dt); rubLoop.set(speed * 0.7);
      },
      draw: function (c) {
        drawBoard(c);
        drawPizzaOnly(c, dish, ZX, ZY, 1);
        if (!dish.sauce) {
          c.save(); c.translate(ZX, ZY);
          c.beginPath(); c.ellipse(0, -2, ZRX - 30, ZRY - 14, 0, 0, TAU); c.clip();
          c.fillStyle = '#E8362B';
          cells.forEach(function (cell) { if (!cell.on) return; var r = 40 * easeBack(cell.t); c.beginPath(); c.ellipse(cell.x, cell.y * ZSQ - 2, r, r * ZSQ * 1.3, 0, 0, TAU); c.fill(); });
          c.restore();
        }
        if (ladle && !done) {
          c.save(); c.translate(ladle.x, ladle.y - 10); c.rotate(-0.5);
          rr(c, -7, -170, 14, 150, 7); c.fillStyle = '#9AA6B2'; c.fill(); ink(c, 4);
          c.beginPath(); c.ellipse(0, -8, 40, 22, 0, 0, TAU); c.fillStyle = '#C3CBD4'; c.fill(); ink(c, 5);
          c.beginPath(); c.ellipse(0, -12, 30, 13, 0, 0, TAU); c.fillStyle = '#E8362B'; c.fill();
          c.restore();
        }
      }
    };
  }

  /* ---- Step: toppings, anywhere on the pizza ---- */
  var PIZZA_TOOLS = ['pepperoni', 'mushroom', 'capsicum', 'pineapple', 'ham', 'olive', 'basil'];
  var PIZZA_LABEL = { pepperoni: 'Salami', mushroom: 'Mushroom', capsicum: 'Capsicum', pineapple: 'Pineapple', ham: 'Ham', olive: 'Olive', basil: 'Basil' };
  /* tool icons are the same toppings that go on the pizza, drawn small */
  function pizzaIcon(k) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 80;
    var c = cv.getContext('2d'); c.translate(40, 40); c.scale(1.05, 1.6); drawPizzaTopping(c, { k: k, x: 0, y: 0, r: 0 });
    return '<img alt="" src="' + cv.toDataURL() + '" width="40" height="40">';
  }
  function ToppingScene() {
    var tool = 'pepperoni', hist = History(['pz']), praised = false;
    function setTool(t) {
      tool = t;
      toolsEl.querySelectorAll('.tool').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
      say('Tap to add ' + PIZZA_LABEL[t].toLowerCase());
    }
    return {
      enter: function () {
        toolsEl.innerHTML = PIZZA_TOOLS.map(function (t) { return '<button class="tool" type="button" data-tool="' + t + '" aria-pressed="false">' + pizzaIcon(t) + '<span>' + PIZZA_LABEL[t] + '</span></button>'; }).join('');
        toolsEl.querySelectorAll('.tool').forEach(function (b) { b.addEventListener('click', function () { Sound.init(); Sound.pop(); setTool(b.dataset.tool); }); });
        setTool('pepperoni');
        showNext('Bake it', nextStep);
        setUndo({ canUndo: hist.canUndo, undo: function () { if (hist.undo()) say('Undone'); } });
      },
      leave: function () { toolsEl.innerHTML = ''; },
      hint: function (t) { if (dish.pz.length) return null; return { x: ZX + 60, y: ZY - 10, press: (t % 1.2) < 0.6 }; },
      down: function (p) {
        if (!onPizza(p, 30)) return;
        var q = toPizza(p);
        hist.now();
        if (dish.pz.length >= 40) dish.pz.shift();
        dish.pz.push({ k: tool, x: Math.round(q.x), y: Math.round(q.y), r: Math.round((Math.random() - 0.5) * 120) });
        Sound.pop(); buzz(8);
        if (!praised && dish.pz.length >= 6) { praised = true; Cat.show(pick(['Looks yummy!', 'Pizza time!'])); }
      },
      draw: function (c) { drawBoard(c); drawPizzaOnly(c, dish, ZX, ZY, 1); }
    };
  }

  /* ---- Step: bake it in the oven ---- */
  function OvenScene() {
    var OX2 = 320, OY2 = 230, phase = 'wait', t = 0, slide = 0, BAKE = 5, sizzle = Sound.loop('sizzle');
    var MOUTH = { x: OX2, y: OY2 + 60 };
    function drawOven(c, glow) {
      // a round brick pizza oven with a fire inside
      // the chimney stands on the dome: it's drawn first and runs down behind it, so there's no gap
      shape(c, D.rrPath(OX2 + 70, OY2 - 160, 50, 100, 6), D.tone(c, '#B8B2C4', 0, 0, OX2 + 70, OX2 + 120), { lw: 4, depth: 0 });
      shape(c, function (p) { p.moveTo(OX2 - 230, OY2 + 120); p.bezierCurveTo(OX2 - 240, OY2 - 160, OX2 + 240, OY2 - 160, OX2 + 230, OY2 + 120); p.closePath(); }, '#D9774F', {
        lw: 5, depth: 18, inside: function (c) {
          c.strokeStyle = 'rgba(42,35,64,.18)'; c.lineWidth = 3;
          for (var y = OY2 - 120; y < OY2 + 120; y += 30) { c.beginPath(); c.moveTo(OX2 - 240, y); c.lineTo(OX2 + 240, y); c.stroke(); for (var x = OX2 - 240 + ((y / 30) % 2) * 30; x < OX2 + 240; x += 60) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 30); c.stroke(); } }
        }, shine: [OX2 - 120, OY2 - 50, 50, 18, -0.6, 0.16]
      });
      shape(c, D.rrPath(OX2 - 260, OY2 + 110, 520, 30, 10), '#B8B2C4', { lw: 4, depth: 5, dx: 0 });
      // the opening
      c.beginPath(); c.moveTo(OX2 - 150, OY2 + 110); c.lineTo(OX2 - 150, OY2 + 20); c.bezierCurveTo(OX2 - 150, OY2 - 80, OX2 + 150, OY2 - 80, OX2 + 150, OY2 + 20); c.lineTo(OX2 + 150, OY2 + 110); c.closePath();
      var g = c.createRadialGradient(OX2, OY2 + 80, 10, OX2, OY2 + 40, 170);
      g.addColorStop(0, glow ? '#FFD34D' : '#7A3B2A'); g.addColorStop(0.5, glow ? '#FF8A3D' : '#4A2620'); g.addColorStop(1, '#2A1A1E');
      c.fillStyle = g; c.fill(); ink(c, 5);
      // flames at the back
      var fl = performance.now() / 120;
      [[-90, 1], [-50, 1.3], [-10, 0.9], [60, 1.2], [100, 0.8]].forEach(function (f, i) {
        var h = (34 + Math.sin(fl + i * 1.7) * 10) * f[1];
        c.beginPath(); c.moveTo(OX2 + f[0] - 16, OY2 + 60); c.quadraticCurveTo(OX2 + f[0] - 14, OY2 + 60 - h * 0.7, OX2 + f[0], OY2 + 60 - h); c.quadraticCurveTo(OX2 + f[0] + 14, OY2 + 60 - h * 0.7, OX2 + f[0] + 16, OY2 + 60); c.closePath();
        c.fillStyle = i % 2 ? '#FFC93C' : '#FF6B57'; c.fill();
      });
    }
    return {
      enter: function () { say('Tap the pizza to bake it!'); },
      leave: function () { sizzle.stop(); },
      hint: function (k) { if (phase === 'wait') return { x: ZX, y: ZY + 40, press: (k % 1.2) < 0.6 }; if (phase === 'ready') return { x: MOUTH.x, y: MOUTH.y + 20, press: (k % 1.2) < 0.6 }; return null; },
      down: function (p) {
        if (phase === 'wait' && onPizza({ x: p.x, y: p.y - 20 }, -40)) { phase = 'in'; slide = 0; Sound.whoosh(); }
        else if (phase === 'ready' && Math.abs(p.x - MOUTH.x) < 180 && Math.abs(p.y - MOUTH.y) < 120) { phase = 'out'; slide = 0; Sound.whoosh(); }
      },
      update: function (dt) {
        sizzle.set(phase === 'bake' || phase === 'ready' ? 0.9 : 0);
        if (phase === 'in') { slide = Math.min(1, slide + dt * 1.8); if (slide >= 1) { phase = 'bake'; t = 0; say('Baking...'); Sound.plop(); } }
        if (phase === 'bake') {
          t += dt; dish.bake = Math.round(Math.min(1, t / BAKE) * 100) / 100;
          if (Math.random() < dt * 4) burst(MOUTH.x + (Math.random() - 0.5) * 120, MOUTH.y - 30, 1, { colors: ['rgba(255,201,60,.8)'], shape: 'dot', size: 8, speed: 30, gravity: -120, life: 0.8 });
          if (t >= BAKE) { phase = 'ready'; dish.bake = 1; Sound.chime(); Cat.show('Smells yummy!'); say('Golden! Tap to take it out'); }
        }
        if (phase === 'out') {
          slide = Math.min(1, slide + dt * 1.8);
          if (slide >= 1) {
            phase = 'done'; Sound.plop(); buzz(20);
            burst(ZX, ZY, 30, { colors: ['#FFC93C', '#FF7EB6', '#7BD389', '#FFFFFF'], speed: 300, life: 1 });
            say('Hot pizza!'); showNext('Next', nextStep);
          }
        }
      },
      draw: function (c) {
        var inside = phase === 'bake' || phase === 'ready';
        drawOven(c, inside || phase === 'in' || phase === 'out');
        // the pizza travels between the plate and the oven, getting smaller as it goes in
        if (phase === 'wait' || phase === 'done') drawPizzaScene(c, dish);
        else {
          var k = phase === 'in' ? easeOut(slide) : phase === 'out' ? 1 - easeOut(slide) : 1;
          drawPizzaOnly(c, dish, lerp(ZX, MOUTH.x, k), lerp(ZY, MOUTH.y + 30, k) - Math.sin(k * Math.PI) * 60, lerp(1, 0.5, k));
        }
        if (phase === 'bake') drawRing(c, OX2 - 190, OY2 - 120, t / BAKE);
      }
    };
  }

  /* ---------- finishing ---------- */
  function snapshot() {
    var out = document.createElement('canvas'); out.width = 360; out.height = 360;
    var c = out.getContext('2d');
    c.fillStyle = '#E9B57F'; c.fillRect(0, 0, 360, 360);
    var f = recipe.frame, k = 360 / f.span; c.scale(k, k); c.translate(-(f.x - f.span / 2), -(f.y - f.span / 2));
    recipe.draw(c, dish);
    try { return out.toDataURL('image/jpeg', 0.82); } catch (e) { return ''; }
  }

  function finishDish() {
    if (window.GG && GG.track) GG.track('Finish dish', { game: 'cooking', dish: recipe && recipe.id ? recipe.id : '' });
    var img = snapshot();
    var prog = GG.getProgress('cooking');
    prog.made = (prog.made || 0) + 1;
    prog.book = Array.isArray(prog.book) ? prog.book : [];
    // dishes cooked per recipe (avatar items unlock from these); older saves start from the cookbook
    if (!prog.byDish) { prog.byDish = {}; prog.book.forEach(function (b) { prog.byDish[b.dish] = (prog.byDish[b.dish] || 0) + 1; }); }
    prog.byDish[recipe.id] = (prog.byDish[recipe.id] || 0) + 1;
    // the dish also goes in the player's collection (small description, no picture) so Cosy Home can show it
    var uid = GG.collect('cooking', { type: 'dish', id: recipe.id, data: GGDish.pack(dish) });
    prog.book.unshift({ dish: recipe.id, at: Date.now(), img: img, uid: uid });
    prog.book = prog.book.slice(0, 12);
    var saved = GG.setProgress('cooking', prog);
    if (!saved) { prog.book = prog.book.slice(0, 4); saved = GG.setProgress('cooking', prog); }
    leaveScene();
    var p = GG.current();
    $('dishImg').src = img; $('dishImg').alt = 'Your ' + recipe.name.toLowerCase();
    $('finishTitle').textContent = recipe.title;
    $('finishNote').textContent = saved ? (p ? 'Saved to ' + p.name + '’s cookbook.' : 'Saved to your cookbook.') : 'Yum! (This device could not save it.)';
    showScreen('finish');
    Sound.chime();
    for (var i = 0; i < 4; i++) setTimeout(function () { burst(Math.random() * SIZE, -20, 14, { colors: ['#FF6B57', '#FFC93C', '#7BD389', '#3FA7F5', '#FF7EB6'], shape: 'confetti', size: 16, speed: 120, gravity: 420, life: 2.2 }); }, i * 220);
    // the chef cat only pops up if there's room below the buttons (on a phone it used to cover them)
    setTimeout(function () { if (mode === 'finish' && $('finish').querySelector('.btnrow').getBoundingClientRect().bottom < innerHeight - 214) Cat.show('Great job!', 3000); }, 500);
  }

  /* ---------- recipes ---------- */
  var ICONS = {
    rice: '<svg viewBox="0 0 24 24"><path d="M3 11 H21 Q20 20 12 20 Q4 20 3 11 Z" fill="#FF7E6B" stroke="#2A2340" stroke-width="2"/><path d="M5 11 Q12 4 19 11" fill="#fff" stroke="#2A2340" stroke-width="2"/></svg>',
    chop: '<svg viewBox="0 0 24 24"><path d="M4 18 L16 6 L19 9 L8 20 Z" fill="#E3E9F0" stroke="#2A2340" stroke-width="2" stroke-linejoin="round"/><rect x="15" y="2" width="5" height="8" rx="2" transform="rotate(45 17.5 6)" fill="#FF6B57" stroke="#2A2340" stroke-width="2"/></svg>',
    roll: '<svg viewBox="0 0 24 24"><g transform="rotate(-22 12 12)"><path d="M16 6.5 H6 A3 5.5 0 0 0 6 17.5 H16 Z" fill="#2E4A3A" stroke="#2A2340" stroke-width="2" stroke-linejoin="round"/><ellipse cx="16" cy="12" rx="4.2" ry="5.5" fill="#2E4A3A" stroke="#2A2340" stroke-width="2"/><ellipse cx="16" cy="12" rx="3" ry="4.2" fill="#fff"/><circle cx="16" cy="11" r="1.3" fill="#FF8A5B"/><circle cx="16.3" cy="13.4" r="1.1" fill="#4FAE5E"/></g></svg>',
    plate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#fff" stroke="#2A2340" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="#3FA7F5" stroke-width="2"/></svg>',
    mix: '<svg viewBox="0 0 24 24"><rect x="10.5" y="1" width="3" height="8" rx="1.5" fill="#FF7EB6" stroke="#2A2340" stroke-width="1.5"/><ellipse cx="12" cy="15" rx="6" ry="8" fill="none" stroke="#2A2340" stroke-width="2"/><ellipse cx="12" cy="15" rx="3" ry="8" fill="none" stroke="#9AA6B2" stroke-width="1.6"/></svg>',
    cook: '<svg viewBox="0 0 24 24"><rect x="15" y="11" width="9" height="3.5" rx="1.7" fill="#2A2340"/><circle cx="10" cy="12.5" r="8" fill="#3B3F4A" stroke="#2A2340" stroke-width="2"/><circle cx="10" cy="12.5" r="5" fill="#F2C46D"/></svg>',
    wash: '<svg viewBox="0 0 24 24"><path d="M3 11 H21 Q20 20 12 20 Q4 20 3 11 Z" fill="#7BD389" stroke="#2A2340" stroke-width="2"/><ellipse cx="12" cy="11" rx="9" ry="2.5" fill="#BFE6FF" stroke="#2A2340" stroke-width="1.6"/><path d="M12 2 Q15 6 12 7.5 Q9 6 12 2 Z" fill="#3FA7F5" stroke="#2A2340" stroke-width="1.4"/></svg>',
    cooker: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="5" fill="#fff" stroke="#2A2340" stroke-width="1.8"/><path d="M4 10 Q12 1 20 10 Z" fill="#F4F2F8" stroke="#2A2340" stroke-width="1.8"/><rect x="3" y="14" width="18" height="2.5" fill="#FF9EC4"/><circle cx="12" cy="18.5" r="1.4" fill="#FF6B57"/></svg>',
    butter: '<svg viewBox="0 0 24 24"><path d="M3 11 L3 15 L12 20 L21 15 L21 11 L12 16 Z" fill="#F2D66B" stroke="#2A2340" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 11 L12 6 L21 11 L12 16 Z" fill="#FFF3A6" stroke="#2A2340" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    decorate: '<svg viewBox="0 0 24 24"><g stroke="#2A2340" stroke-width="1.6"><ellipse cx="12" cy="18" rx="9" ry="3" fill="#D38A3E"/><ellipse cx="12" cy="14" rx="9" ry="3" fill="#DE9A48"/><ellipse cx="12" cy="10" rx="9" ry="3" fill="#F2C06C"/></g><path d="M8 9 Q12 12 16 9" stroke="#A85814" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="12" cy="6" r="2.6" fill="#FF5A6A" stroke="#2A2340" stroke-width="1.4"/></svg>'
  };
  var RECIPE_DEFS = {
    handroll: {
      id: 'handroll', name: 'Sushi Handroll', title: 'Sushi hand roll!',
      steps: [
        { name: 'Wash', icon: ICONS.wash, make: function () { return WashScene(); } },
        { name: 'Cook', icon: ICONS.cooker, make: function () { return CookerScene(); } },
        { name: 'Mix', icon: ICONS.rice, make: function () { return RiceScene(); } },
        { name: 'Chop', icon: ICONS.chop, make: function () { return ChopScene(['cucumber', 'avocado', 'salmon'], nextStep); } },
        { name: 'Roll', icon: ICONS.roll, make: function () { return RollScene(); } },
        { name: 'Plate', icon: ICONS.plate, make: function () { return PlateScene(); } }
      ],
      draw: function (c, d) { drawPlateScene(c, d); }, frame: { x: PCX, y: PCY, span: PR * 2 + 24 }
    },
    pancakes: {
      id: 'pancakes', name: 'Pancakes', title: 'Pancakes!',
      steps: [
        { name: 'Mix', icon: ICONS.mix, make: function () { return BatterScene(); } },
        { name: 'Butter', icon: ICONS.butter, make: function () { return ButterScene(); } },
        { name: 'Cook', icon: ICONS.cook, make: function () { return PanScene(); } },
        { name: 'Chop', icon: ICONS.chop, make: function () { return ChopScene(['banana', 'strawberry'], nextStep); } },
        { name: 'Decorate', icon: ICONS.decorate, make: function () { return DecorateScene(); } }
      ],
      draw: function (c, d) { drawStackScene(c, d); }, frame: { x: 320, y: 420, span: 556 }
    }
  };
  ICONS.grill = '<svg viewBox="0 0 24 24"><rect x="15" y="11" width="9" height="3.5" rx="1.7" fill="#2A2340"/><circle cx="10" cy="12.5" r="8" fill="#3B3F4A" stroke="#2A2340" stroke-width="2"/><circle cx="10" cy="12.5" r="5" fill="#7A4425"/><path d="M7 10 L13 15 M7 13 L11 16.5" stroke="#2E190F" stroke-width="1.5"/></svg>';
  ICONS.build = '<svg viewBox="0 0 24 24"><path d="M3 11 Q12 0 21 11 Z" fill="#E9A85A" stroke="#2A2340" stroke-width="1.6"/><path d="M2 13 Q6 11 9 13 Q12 11 15 13 Q18 11 22 13" fill="none" stroke="#4FB868" stroke-width="2.5"/><rect x="3" y="14" width="18" height="4" rx="2" fill="#7A4425" stroke="#2A2340" stroke-width="1.4"/><rect x="3" y="18.5" width="18" height="3.5" rx="1.7" fill="#E3A057" stroke="#2A2340" stroke-width="1.4"/></svg>';
  ICONS.shape = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="15" rx="9" ry="5" fill="#E37C86" stroke="#2A2340" stroke-width="1.8"/><path d="M8 4 Q12 1 16 4 L15 10 L9 10 Z" fill="#FFE0CC" stroke="#2A2340" stroke-width="1.5"/></svg>';
  ICONS.melt = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="15" rx="9" ry="5" fill="#7A4425" stroke="#2A2340" stroke-width="1.6"/><path d="M5 12 H19 V15 Q17 15 16 18 Q15 15 12 15 Q10 15 9 19 Q8 15 5 15 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  ICONS.lettuce = '<svg viewBox="0 0 24 24"><path d="M3 13 Q5 6 9 9 Q12 4 15 9 Q19 6 21 13 Q12 20 3 13 Z" fill="#7BD389" stroke="#2A2340" stroke-width="1.6"/><path d="M6 3 Q8 6 6 7 Q4 6 6 3 Z M17 2 Q19 5 17 6 Q15 5 17 2 Z" fill="#3FA7F5"/></svg>';
  ICONS.chips = '<svg viewBox="0 0 24 24"><g fill="#F2B84B" stroke="#2A2340" stroke-width="1.3"><rect x="6" y="3" width="3" height="12" rx="1" transform="rotate(-12 7 9)"/><rect x="10.5" y="2" width="3" height="13" rx="1"/><rect x="15" y="3" width="3" height="12" rx="1" transform="rotate(12 16 9)"/></g><path d="M4 11 H20 L18 21 H6 Z" fill="#FF6B57" stroke="#2A2340" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  RECIPE_DEFS.burger = {
    id: 'burger', name: 'Burger', title: 'Burger!',
    steps: [
      { name: 'Shape', icon: ICONS.shape, make: function () { return ShapeScene(); } },
      { name: 'Cook', icon: ICONS.grill, make: function () { return GrillScene(); } },
      { name: 'Cheese', icon: ICONS.melt, make: function () { return MeltScene(); } },
      { name: 'Wash', icon: ICONS.lettuce, make: function () { return LettuceScene(); } },
      { name: 'Chop', icon: ICONS.chop, make: function () { return ChopScene(['tomato', 'onion'], nextStep); } },
      { name: 'Build', icon: ICONS.build, make: function () { return BuildScene(); } },
      { name: 'Chips', icon: ICONS.chips, make: function () { return ChipsScene(); } }
    ],
    draw: function (c, d) { drawBurgerScene(c, d); }, frame: { x: 320, y: 410, span: 540 }
  };
  ICONS.dough = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="9" ry="6" fill="#F6E3BC" stroke="#2A2340" stroke-width="1.8"/><ellipse cx="9" cy="11.5" rx="3" ry="1.2" fill="#fff"/></svg>';
  ICONS.rise = '<svg viewBox="0 0 24 24"><path d="M3 13 H21 Q20 21 12 21 Q4 21 3 13 Z" fill="#5EB7F0" stroke="#2A2340" stroke-width="1.8"/><path d="M4 13 Q12 2 20 13 Z" fill="#fff" stroke="#2A2340" stroke-width="1.8"/><path d="M8 9 V13 M12 6 V13 M16 9 V13" stroke="#FF6B57" stroke-width="2"/></svg>';
  ICONS.grate = GGDish.icons.grate;
  ICONS.slice = '<svg viewBox="0 0 24 24"><path d="M3 20 L12 3 L21 20 Z" fill="#FFD86A" stroke="#2A2340" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 20 Q12 23 21 20" fill="none" stroke="#C98A3E" stroke-width="3"/><circle cx="10" cy="13" r="1.8" fill="#D83A3A"/><circle cx="14" cy="16" r="1.8" fill="#D83A3A"/></svg>';
  ICONS.pin = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="16" rx="9" ry="4" fill="#F3DDB0" stroke="#2A2340" stroke-width="1.8"/><rect x="3" y="6" width="18" height="5" rx="2.5" fill="#F1C88E" stroke="#2A2340" stroke-width="1.6"/></svg>';
  ICONS.sauce = GGDish.icons.sauce;
  ICONS.toppings = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="10" ry="6" fill="#F3DDB0" stroke="#2A2340" stroke-width="1.8"/><ellipse cx="12" cy="13.5" rx="7" ry="3.8" fill="#FFD86A"/><circle cx="9" cy="13" r="1.8" fill="#D83A3A"/><circle cx="14" cy="12" r="1.8" fill="#D83A3A"/><circle cx="13" cy="15.5" r="1.4" fill="#4FB868"/></svg>';
  ICONS.oven = '<svg viewBox="0 0 24 24"><path d="M2 20 Q2 3 12 3 Q22 3 22 20 Z" fill="#D9774F" stroke="#2A2340" stroke-width="1.8"/><path d="M7 20 V14 Q12 7 17 14 V20 Z" fill="#FF8A3D" stroke="#2A2340" stroke-width="1.6"/></svg>';
  RECIPE_DEFS.pizza = {
    id: 'pizza', name: 'Pizza', title: 'Pizza!',
    fresh: { plate: 0, sauce: 0, cheese: 0, bake: 0, pz: [], cut: 0 },
    steps: [
      { name: 'Dough', icon: ICONS.dough, make: function () { return KneadScene(); } },
      { name: 'Rise', icon: ICONS.rise, make: function () { return RiseScene(); } },
      { name: 'Roll', icon: ICONS.pin, make: function () { return RollDoughScene(); } },
      { name: 'Sauce', icon: ICONS.sauce, make: function () { return SauceScene(); } },
      { name: 'Chop', icon: ICONS.chop, make: function () { return ChopScene(['mushroom', 'capsicum', 'pineapple'], nextStep); } },
      { name: 'Cheese', icon: ICONS.grate, make: function () { return GrateScene(); } },
      { name: 'Toppings', icon: ICONS.toppings, make: function () { return ToppingScene(); } },
      { name: 'Bake', icon: ICONS.oven, make: function () { return OvenScene(); } },
      { name: 'Slice', icon: ICONS.slice, make: function () { return SliceScene(); } }
    ],
    draw: function (c, d) { drawPizzaScene(c, d); }, frame: { x: 320, y: 440, span: 560 }
  };
  ICONS.waffle = '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="16" rx="5" fill="#FF8FB1" stroke="#2A2340" stroke-width="1.8"/><path d="M6.5 11 L6 6.5 L9 8.6 Q12 7.8 15 8.6 L18 6.5 L17.5 11 Q18.5 17 12 17.5 Q5.5 17 6.5 11 Z" fill="#EDB15E" stroke="#2A2340" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 10 V16 M12 9 V17 M15 10 V16 M7 12.5 H17 M7.5 15 H16.5" stroke="#C8823A" stroke-width="1.1"/><circle cx="19" cy="18.5" r="1.3" fill="#7BD389"/></svg>';
  ICONS.waffleDeco = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="19" rx="10" ry="3.5" fill="#fff" stroke="#2A2340" stroke-width="1.6"/><path d="M5 12 L4.5 5 L8.5 8 Q12 7 15.5 8 L19.5 5 L19 12 Q20 18 12 18 Q4 18 5 12 Z" fill="#EDB15E" stroke="#2A2340" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 11 Q12 14 16 11" stroke="#A85814" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="12" cy="8.5" r="2.2" fill="#FF5A6A" stroke="#2A2340" stroke-width="1.2"/></svg>';
  RECIPE_DEFS.waffles = {
    id: 'waffles', name: 'Cat Waffles', title: 'Cat waffle!',
    steps: [
      { name: 'Mix', icon: ICONS.mix, make: function () { return BatterScene(); } },
      { name: 'Cook', icon: ICONS.waffle, make: function () { return WaffleIronScene(); } },
      { name: 'Chop', icon: ICONS.chop, make: function () { return ChopScene(['banana', 'strawberry'], nextStep); } },
      { name: 'Decorate', icon: ICONS.waffleDeco, make: function () { return DecorateScene(); } }
    ],
    draw: function (c, d) { DISH.drawWaffleScene(c, d); }, frame: { x: 320, y: 420, span: 556 }
  };
  var recipe = RECIPE_DEFS.handroll;
  var scene = null, stepIdx = -1, hintT = 0, idle = 0, pointerId = null;

  function renderSteps() {
    // long recipes show the other steps as small dots so the bar fits on a phone
    $('steps').classList.toggle('many', recipe.steps.length > 4);
    $('steps').innerHTML = recipe.steps.map(function (s, i) {
      return '<div class="step ' + (i < stepIdx ? 'done' : i === stepIdx ? 'now' : '') + '"><i>' + s.icon + '</i><span>' + s.name + '</span></div>';
    }).join('');
  }
  function leaveScene() { if (scene && scene.leave) scene.leave(); scene = null; Cat.hide(); hideNext(); setUndo(null); pointerId = null; }
  function nextStep() { goStep(stepIdx + 1); }
  /* the tray is shorter on steps without a tool row, which leaves more room for the food */
  function fitTray() { tray.classList.toggle('notools', !toolsEl.children.length); resize(); }
  function goStep(i) {
    leaveScene();
    stepIdx = i; renderSteps();
    toolsEl.innerHTML = '';
    scene = recipe.steps[i].make(); idle = 0; hintT = 0; parts = [];
    if (scene.enter) scene.enter();
    fitTray();
  }

  /* ---------- screens ---------- */
  var mode = 'menu';
  function showScreen(m) {
    mode = m;
    Cat.hide();
    if (viewer) viewer.hidden = true;
    $('menu').hidden = m !== 'menu';
    $('finish').hidden = m !== 'finish';
    $('cat').classList.toggle('low', m === 'finish');   // no tool tray on the finish screen, so the cat sits right at the bottom
    tray.hidden = m !== 'play';
    $('steps').hidden = m !== 'play';
    $('title').hidden = m === 'play';
    $('homeBtn').hidden = m !== 'menu';
    $('backBtn').hidden = m === 'menu';
    $('backLabel').textContent = 'Kitchen';
    leaveArmed = false;
    if (m === 'menu') renderMenu();
    resize();
  }

  var RECIPES = [
    { id: 'handroll', name: 'Sushi Handroll', ready: true },
    { id: 'pancakes', name: 'Pancakes', ready: true },
    { id: 'burger', name: 'Burger', ready: true },
    { id: 'pizza', name: 'Pizza', ready: true },
    { id: 'waffles', name: 'Cat Waffles', ready: true }
  ];
  var RECIPE_ART = {
    handroll: '<svg viewBox="10 8 220 147"><ellipse cx="120" cy="122" rx="100" ry="22" fill="#fff" stroke="#2A2340" stroke-width="4"/><ellipse cx="120" cy="119" rx="74" ry="12" fill="#FFE3EC"/><g transform="rotate(-14 120 90)"><path d="M168 62 H70 A17 28 0 0 0 70 118 H168 Z" fill="#2E4A3A" stroke="#2A2340" stroke-width="4" stroke-linejoin="round"/><rect x="62" y="69" width="100" height="8" rx="4" fill="#3D6450"/><ellipse cx="168" cy="90" rx="17.5" ry="28" fill="#2E4A3A" stroke="#2A2340" stroke-width="4"/><ellipse cx="168" cy="90" rx="14.5" ry="23.5" fill="#fff"/><rect x="160" y="77" width="11" height="9" rx="2" fill="#FF8A5B" stroke="#2A2340" stroke-width="2"/><rect x="168" y="88" width="7" height="8" rx="1.5" fill="#4FAE5E" stroke="#2A2340" stroke-width="2"/><ellipse cx="164" cy="98" rx="6" ry="4" fill="#C8E26F" stroke="#2A2340" stroke-width="2"/></g><ellipse cx="178" cy="125" rx="18" ry="7" fill="#fff" stroke="#2A2340" stroke-width="3"/><ellipse cx="178" cy="124.5" rx="11.5" ry="4" fill="#5A2A12"/></svg>',
    pancakes: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="102" rx="78" ry="15" fill="#fff" stroke="#2A2340" stroke-width="4"/><g stroke="#2A2340" stroke-width="3.5"><path d="M36 86 V94 A54 13 0 0 0 144 94 V86 Z" fill="#D38A3E"/><ellipse cx="90" cy="86" rx="54" ry="13" fill="#DE9A48"/><path d="M34 72 V80 A54 13 0 0 0 142 80 V72 Z" fill="#D38A3E"/><ellipse cx="88" cy="72" rx="54" ry="13" fill="#E3A552"/><path d="M38 58 V66 A54 13 0 0 0 146 66 V58 Z" fill="#D38A3E"/><ellipse cx="92" cy="58" rx="54" ry="13" fill="#F2C06C"/></g><path d="M62 56 Q76 64 92 56 Q108 50 120 60" fill="none" stroke="#A85814" stroke-width="6" stroke-linecap="round"/><path d="M130 62 V74" stroke="#A85814" stroke-width="5" stroke-linecap="round"/><path d="M80 52 L80 47 L94 43 L104 47 L104 52 L94 56 Z" fill="#FFF3A6" stroke="#2A2340" stroke-width="2.5" stroke-linejoin="round"/><path d="M66 60 Q58 54 62 50 Q66 48 70 50 Q74 54 66 60 Z" fill="#FF5A6A" stroke="#2A2340" stroke-width="2"/><path d="M114 58 Q106 52 110 48 Q114 46 118 48 Q122 52 114 58 Z" fill="#FF5A6A" stroke="#2A2340" stroke-width="2"/></svg>',
    omurice: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="98" rx="78" ry="16" fill="#fff" stroke="#2A2340" stroke-width="4"/><path d="M30 90 Q30 36 90 34 Q150 36 150 90 Z" fill="#FFD84D" stroke="#2A2340" stroke-width="4"/><path d="M60 60 Q75 50 90 62 Q105 50 120 60" fill="none" stroke="#FF4D3D" stroke-width="6" stroke-linecap="round"/></svg>',
    burger: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="104" rx="80" ry="13" fill="#fff" stroke="#2A2340" stroke-width="4"/><path d="M40 86 H140 Q144 98 128 100 H52 Q36 98 40 86 Z" fill="#E3A057" stroke="#2A2340" stroke-width="3.5"/><path d="M38 80 L142 80 Q150 90 138 88 L42 88 Q30 90 38 80 Z" fill="#6A3A1E" stroke="#2A2340" stroke-width="3.5"/><path d="M36 76 H144 V80 H136 L132 90 L128 80 H52 L47 92 L42 80 H36 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><rect x="44" y="68" width="34" height="8" rx="4" fill="#FF4D3D" stroke="#2A2340" stroke-width="2.5"/><rect x="102" y="68" width="34" height="8" rx="4" fill="#FF4D3D" stroke="#2A2340" stroke-width="2.5"/><path d="M34 66 Q40 60 46 66 Q52 60 58 66 Q64 60 70 66 Q76 60 82 66 Q88 60 94 66 Q100 60 106 66 Q112 60 118 66 Q124 60 130 66 Q136 60 146 66 L146 70 L34 70 Z" fill="#7BD389" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><path d="M36 62 Q34 22 90 20 Q146 22 144 62 Z" fill="#EBA65A" stroke="#2A2340" stroke-width="4"/><g fill="#FFF4D6"><ellipse cx="70" cy="36" rx="3" ry="2"/><ellipse cx="92" cy="30" rx="3" ry="2"/><ellipse cx="112" cy="38" rx="3" ry="2"/><ellipse cx="80" cy="48" rx="3" ry="2"/><ellipse cx="104" cy="50" rx="3" ry="2"/></g></svg>',
    pizza: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="98" rx="80" ry="18" fill="#fff" stroke="#2A2340" stroke-width="4"/><ellipse cx="90" cy="80" rx="72" ry="28" fill="#C98A3E" stroke="#2A2340" stroke-width="4"/><ellipse cx="90" cy="74" rx="72" ry="28" fill="#E3A050" stroke="#2A2340" stroke-width="4"/><ellipse cx="90" cy="73" rx="60" ry="21" fill="#E8362B"/><path d="M36 72 Q42 56 62 56 Q80 50 98 55 Q122 52 138 62 Q148 74 136 84 Q112 94 88 92 Q58 94 42 84 Z" fill="#FFD86A"/><g stroke="#2A2340" stroke-width="2.5"><ellipse cx="66" cy="68" rx="10" ry="6" fill="#D83A3A"/><ellipse cx="106" cy="64" rx="10" ry="6" fill="#D83A3A"/><ellipse cx="92" cy="82" rx="10" ry="6" fill="#D83A3A"/><ellipse cx="124" cy="76" rx="9" ry="5" fill="#4FB868"/><ellipse cx="56" cy="80" rx="9" ry="5" fill="#4FB868"/></g></svg>',
    waffles: '<svg viewBox="0 0 180 120"><defs><clipPath id="wfc"><path d="M32 78 Q33 56 42 38 Q46 34 51 38 L65 55 Q90 49 115 55 L129 38 Q134 34 138 38 Q147 56 148 78 A58 23 0 0 1 32 78 Z"/></clipPath></defs><ellipse cx="90" cy="102" rx="80" ry="15" fill="#fff" stroke="#2A2340" stroke-width="4"/><path transform="translate(0 10)" d="M32 78 Q33 56 42 38 Q46 34 51 38 L65 55 Q90 49 115 55 L129 38 Q134 34 138 38 Q147 56 148 78 A58 23 0 0 1 32 78 Z" fill="#C47F37" stroke="#2A2340" stroke-width="4" stroke-linejoin="round"/><path d="M32 78 Q33 56 42 38 Q46 34 51 38 L65 55 Q90 49 115 55 L129 38 Q134 34 138 38 Q147 56 148 78 A58 23 0 0 1 32 78 Z" fill="#EDB15E"/><g clip-path="url(#wfc)" fill="#C8823A"><rect x="30" y="36" width="9" height="6" rx="2"/><rect x="43" y="36" width="9" height="6" rx="2"/><rect x="56" y="36" width="9" height="6" rx="2"/><rect x="69" y="36" width="9" height="6" rx="2"/><rect x="82" y="36" width="9" height="6" rx="2"/><rect x="95" y="36" width="9" height="6" rx="2"/><rect x="108" y="36" width="9" height="6" rx="2"/><rect x="121" y="36" width="9" height="6" rx="2"/><rect x="134" y="36" width="9" height="6" rx="2"/><rect x="147" y="36" width="9" height="6" rx="2"/><rect x="30" y="46" width="9" height="6" rx="2"/><rect x="43" y="46" width="9" height="6" rx="2"/><rect x="56" y="46" width="9" height="6" rx="2"/><rect x="69" y="46" width="9" height="6" rx="2"/><rect x="82" y="46" width="9" height="6" rx="2"/><rect x="95" y="46" width="9" height="6" rx="2"/><rect x="108" y="46" width="9" height="6" rx="2"/><rect x="121" y="46" width="9" height="6" rx="2"/><rect x="134" y="46" width="9" height="6" rx="2"/><rect x="147" y="46" width="9" height="6" rx="2"/><rect x="30" y="56" width="9" height="6" rx="2"/><rect x="43" y="56" width="9" height="6" rx="2"/><rect x="56" y="56" width="9" height="6" rx="2"/><rect x="69" y="56" width="9" height="6" rx="2"/><rect x="82" y="56" width="9" height="6" rx="2"/><rect x="95" y="56" width="9" height="6" rx="2"/><rect x="108" y="56" width="9" height="6" rx="2"/><rect x="121" y="56" width="9" height="6" rx="2"/><rect x="134" y="56" width="9" height="6" rx="2"/><rect x="147" y="56" width="9" height="6" rx="2"/><rect x="30" y="66" width="9" height="6" rx="2"/><rect x="43" y="66" width="9" height="6" rx="2"/><rect x="56" y="66" width="9" height="6" rx="2"/><rect x="69" y="66" width="9" height="6" rx="2"/><rect x="82" y="66" width="9" height="6" rx="2"/><rect x="95" y="66" width="9" height="6" rx="2"/><rect x="108" y="66" width="9" height="6" rx="2"/><rect x="121" y="66" width="9" height="6" rx="2"/><rect x="134" y="66" width="9" height="6" rx="2"/><rect x="147" y="66" width="9" height="6" rx="2"/><rect x="30" y="76" width="9" height="6" rx="2"/><rect x="43" y="76" width="9" height="6" rx="2"/><rect x="56" y="76" width="9" height="6" rx="2"/><rect x="69" y="76" width="9" height="6" rx="2"/><rect x="82" y="76" width="9" height="6" rx="2"/><rect x="95" y="76" width="9" height="6" rx="2"/><rect x="108" y="76" width="9" height="6" rx="2"/><rect x="121" y="76" width="9" height="6" rx="2"/><rect x="134" y="76" width="9" height="6" rx="2"/><rect x="147" y="76" width="9" height="6" rx="2"/><rect x="30" y="86" width="9" height="6" rx="2"/><rect x="43" y="86" width="9" height="6" rx="2"/><rect x="56" y="86" width="9" height="6" rx="2"/><rect x="69" y="86" width="9" height="6" rx="2"/><rect x="82" y="86" width="9" height="6" rx="2"/><rect x="95" y="86" width="9" height="6" rx="2"/><rect x="108" y="86" width="9" height="6" rx="2"/><rect x="121" y="86" width="9" height="6" rx="2"/><rect x="134" y="86" width="9" height="6" rx="2"/><rect x="147" y="86" width="9" height="6" rx="2"/><rect x="30" y="96" width="9" height="6" rx="2"/><rect x="43" y="96" width="9" height="6" rx="2"/><rect x="56" y="96" width="9" height="6" rx="2"/><rect x="69" y="96" width="9" height="6" rx="2"/><rect x="82" y="96" width="9" height="6" rx="2"/><rect x="95" y="96" width="9" height="6" rx="2"/><rect x="108" y="96" width="9" height="6" rx="2"/><rect x="121" y="96" width="9" height="6" rx="2"/><rect x="134" y="96" width="9" height="6" rx="2"/><rect x="147" y="96" width="9" height="6" rx="2"/></g><g fill="#A9662A"><ellipse cx="72" cy="70" rx="6" ry="5"/><ellipse cx="108" cy="70" rx="6" ry="5"/><path d="M85 80 H95 L90 85 Z"/></g><path d="M32 78 Q33 56 42 38 Q46 34 51 38 L65 55 Q90 49 115 55 L129 38 Q134 34 138 38 Q147 56 148 78 A58 23 0 0 1 32 78 Z" fill="none" stroke="#2A2340" stroke-width="4" stroke-linejoin="round"/><path d="M52 64 Q66 76 82 66 Q98 58 112 70 Q122 78 132 68" fill="none" stroke="#A85814" stroke-width="6" stroke-linecap="round"/><path d="M120 80 V92" stroke="#A85814" stroke-width="5" stroke-linecap="round"/><path d="M90 64 Q82 58 86 54 Q90 52 94 54 Q98 58 90 64 Z" fill="#FF5A6A" stroke="#2A2340" stroke-width="2"/><circle cx="60" cy="84" r="6.5" fill="#FFF4C2" stroke="#2A2340" stroke-width="2"/><circle cx="124" cy="60" r="6" fill="#FFF4C2" stroke="#2A2340" stroke-width="2"/></svg>',
    brigadeiros: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="100" rx="78" ry="16" fill="#fff" stroke="#2A2340" stroke-width="4"/><g stroke="#2A2340" stroke-width="4"><circle cx="60" cy="74" r="22" fill="#6B3A22"/><circle cx="120" cy="74" r="22" fill="#6B3A22"/><circle cx="90" cy="56" r="22" fill="#7A4428"/></g></svg>'
  };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderMenu() {
    GG.reload();
    var p = GG.current();
    $('menuTitle').textContent = p ? 'What shall we cook, ' + p.name + '?' : 'What shall we cook?';
    $('recipes').innerHTML = RECIPES.map(function (r) {
      var lockedR = window.GGPass && !window.GGPass.allows('cooking', r.id);
      if (r.ready && lockedR) return '<button class="recipe hero needs-pass" type="button" data-id="' + r.id + '"><span class="soon">' + PADLOCK + 'Unlock</span>' + RECIPE_ART[r.id] + '<span>' + r.name + '</span><small>Needs a pass</small></button>';
      return r.ready
        ? (function (steps) {
          // how long a recipe is: a "6 steps" sticker and a row of the steps' little icons
          return '<button class="recipe hero" type="button" data-id="' + r.id + '" aria-label="' + r.name + ', ' + steps.length + ' steps: ' + steps.map(function (st) { return st.name; }).join(', ') + '">' +
            '<span class="count">' + steps.length + ' steps</span>' + RECIPE_ART[r.id] + '<span>' + r.name + '</span>' +
            '<span class="step-icons" aria-hidden="true">' + steps.map(function (st) { return '<i title="' + st.name + '">' + st.icon + '</i>'; }).join('') + '</span></button>';
        })(RECIPE_DEFS[r.id].steps)
        : '<div class="recipe locked"><span class="soon">Soon</span>' + RECIPE_ART[r.id] + '<span>' + r.name + '</span></div>';
    }).join('');
    $('recipes').querySelectorAll('button.recipe').forEach(function (b) {
      b.addEventListener('click', function () { Sound.init(); Sound.pop(); startCooking(b.dataset.id); });
    });
    var prog = GG.getProgress('cooking'), book = Array.isArray(prog.book) ? prog.book : [];
    bookList = book;
    $('book').innerHTML = book.length
      ? book.map(function (e, i) {
        var nm = (RECIPE_DEFS[e.dish] || RECIPE_DEFS.handroll).name;
        return '<div class="bookitem"><button class="entry" type="button" data-i="' + i + '" aria-label="Open ' + esc(nm) + ' from ' + esc(niceDate(e.at)) + '"><figure>' + (e.img ? '<img alt="" src="' + esc(e.img) + '">' : '') + '<figcaption>' + esc(niceDate(e.at, true)) + '</figcaption></figure></button>' +
          '<button class="del" type="button" data-del="' + i + '" aria-label="Delete ' + esc(nm) + ' from ' + esc(niceDate(e.at)) + '"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5 L15 15 M15 5 L5 15" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/></svg><span>Delete?</span></button></div>';
      }).join('')
      : '<p class="empty">Dishes you make will show up here.</p>';
    $('book').querySelectorAll('.entry').forEach(function (b) {
      b.addEventListener('click', function () { Sound.init(); Sound.pop(); openViewer(+b.dataset.i); });
    });
    // the little cross deletes a dish: first tap asks "Delete?", a second tap removes it
    $('book').querySelectorAll('.del').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation(); Sound.init();
        if (!b.classList.contains('ask')) {
          $('book').querySelectorAll('.del.ask').forEach(function (o) { o.classList.remove('ask'); });
          b.classList.add('ask'); Sound.pop();
          clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove('ask'); }, 3000);
          return;
        }
        var pr = GG.getProgress('cooking');
        if (Array.isArray(pr.book)) { var gone = pr.book.splice(+b.dataset.del, 1)[0]; if (gone && gone.uid) GG.uncollect(gone.uid); GG.setProgress('cooking', pr); }
        Sound.plop();
        renderMenu();
      });
    });
  }

  /* ---------- cookbook viewer: tap a dish to see it big ---------- */
  var bookList = [], viewIdx = 0, viewer = $('viewer');
  function niceDate(at, short) {
    var d = new Date(at);
    return short ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function showView() {
    var e = bookList[viewIdx]; if (!e) return;
    var nm = (RECIPE_DEFS[e.dish] || RECIPE_DEFS.handroll).name;
    $('viewImg').src = e.img || ''; $('viewImg').alt = nm;
    $('viewTitle').textContent = nm;
    $('viewDate').textContent = 'Made on ' + niceDate(e.at);
    $('viewPrev').disabled = viewIdx <= 0;
    $('viewNext').disabled = viewIdx >= bookList.length - 1;
  }
  function openViewer(i) { viewIdx = i; showView(); viewer.hidden = false; $('viewClose').focus(); }
  function closeViewer() { viewer.hidden = true; }
  $('viewClose').addEventListener('click', function () { Sound.pop(); closeViewer(); });
  $('viewPrev').addEventListener('click', function () { if (viewIdx > 0) { viewIdx--; Sound.pop(); showView(); } });
  $('viewNext').addEventListener('click', function () { if (viewIdx < bookList.length - 1) { viewIdx++; Sound.pop(); showView(); } });
  viewer.addEventListener('click', function (e) { if (e.target === viewer) closeViewer(); });
  document.addEventListener('keydown', function (e) {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') $('viewPrev').click();
    if (e.key === 'ArrowRight') $('viewNext').click();
  });
  var swipeX = null;
  viewer.addEventListener('pointerdown', function (e) { swipeX = e.clientX; });
  viewer.addEventListener('pointerup', function (e) {
    if (swipeX === null) return; var dx = e.clientX - swipeX; swipeX = null;
    if (dx > 60) $('viewPrev').click(); else if (dx < -60) $('viewNext').click();
  });

  var PADLOCK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><rect x="4" y="10" width="16" height="12" rx="3" fill="#2A2340"/><path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none" stroke="#2A2340" stroke-width="2.6"/></svg>';
  function startCooking(id) {
    // recipes other than the free one need the one-year pass (shared/pass.js)
    if (window.GGPass && !window.GGPass.allows('cooking', id)) {
      window.GGPass.lockScreen({ title: (RECIPE_DEFS[id] ? RECIPE_DEFS[id].name : 'This recipe') + ' needs a pass', text: 'The sushi hand roll is free. A grown-up can unlock every recipe and game for a year.' });
      return;
    }
    recipe = RECIPE_DEFS[id] || recipe; dish = newDish(); showScreen('play'); goStep(0);
    if (window.GG && GG.track) GG.track('Pick dish', { game: 'cooking', dish: id });
  }
  window.addEventListener('ggpass', function () { if (mode === 'menu') renderMenu(); });

  /* Leaving mid-dish takes two taps so a stray finger doesn't lose the dish. */
  var leaveArmed = false, leaveTimer = null;
  $('backBtn').addEventListener('click', function () {
    if (mode === 'finish' || leaveArmed) { leaveScene(); showScreen('menu'); return; }
    leaveArmed = true; $('backLabel').textContent = 'Leave? Tap again';
    clearTimeout(leaveTimer); leaveTimer = setTimeout(function () { leaveArmed = false; $('backLabel').textContent = 'Kitchen'; }, 2500);
  });
  $('againBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); startCooking(recipe.id); });
  $('toMenuBtn').addEventListener('click', function () { Sound.pop(); showScreen('menu'); });

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

  /* ---------- input ---------- */
  canvas.addEventListener('pointerdown', function (e) {
    if (mode !== 'play' || !scene) return;
    if (pointerId !== null && pointerId !== e.pointerId) return;
    Sound.init();
    pointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    idle = 0;
    if (scene.down) scene.down(toLogical(e));
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== pointerId || !scene) return;
    idle = 0;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    for (var i = 0; i < evs.length; i++) if (scene && scene.move) scene.move(toLogical(evs[i]));
  });
  function release(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (scene && scene.up) scene.up(toLogical(e));
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && scene && scene.up) { pointerId = null; scene.up({ x: 0, y: 0 }); } });

  /* ---------- hint finger ---------- */
  function drawHint(c, dt) {
    if (!scene || !scene.hint || pointerId !== null) return;
    idle += dt;
    if (idle < 2.2) { hintT = 0; return; }
    hintT += dt;
    var h = scene.hint(hintT);
    if (!h) return;
    var a = Math.min(1, (idle - 2.2) * 2);
    c.save(); c.globalAlpha = a * 0.92;
    c.beginPath(); c.arc(h.x, h.y, h.press ? 26 : 32, 0, TAU); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    c.beginPath(); c.arc(h.x, h.y, h.press ? 17 : 20, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 4);
    c.restore();
  }

  /* ---------- main loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (scene && scene.update) scene.update(dt);
    updateParts(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(ctx);
    ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * OX, dpr * OY);
    if (scene) scene.draw(ctx);
    drawHint(ctx, dt);
    drawParts(ctx);
    requestAnimationFrame(frame);
  }

  showScreen('menu');
  resize();
  requestAnimationFrame(frame);

  /* test hook for automated checks */
  window.__kitchen = { toScreen: function (x, y) { return { x: OX + x * S, y: OY + y * S }; }, dish: function () { return dish; }, goStep: function (i, id) { if (id) recipe = RECIPE_DEFS[id]; if (!dish || id) dish = newDish(); showScreen('play'); goStep(i); }, finish: function () { finishDish(); } };
})();
