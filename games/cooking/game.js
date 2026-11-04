/* Cosy Kitchen – sushi handroll.
   Everything is drawn in code on one canvas. Sounds are made with Web Audio (no files).
   The play area is a 640 x 640 square (logical units) scaled to fit between the top bar and tool tray. */
(function () {
  'use strict';

  var INK = '#2A2340';
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
  function seeded(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ink(c, w) { c.lineWidth = w || 5; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
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
        if (kind === 'stir') { l.f.type = 'lowpass'; l.f.frequency.value = 520; l.f.Q.value = 2.5; l.max = 0.55; }
        if (kind === 'rub') { l.f.type = 'bandpass'; l.f.frequency.value = 2600; l.f.Q.value = 0.9; l.max = 0.16; }
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
    var bot = tray.hidden ? ch - 8 : tray.getBoundingClientRect().top + 24;
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

  /* ---------- shared food drawings ---------- */
  var NORI = '#2E4A3A', NORI_LIGHT = '#3D6450';

  function drawPiece(c, kind, len, scale) {
    /* a long strip of filling, centred at 0,0, lying along the x axis */
    scale = scale || 1;
    c.save(); c.scale(scale, scale);
    if (kind === 'cucumber') {
      rr(c, -len / 2, -8, len, 16, 7); c.fillStyle = '#4FAE5E'; c.fill(); ink(c, 3.5);
      rr(c, -len / 2 + 6, -3, len - 12, 6, 3); c.fillStyle = '#C9EDB4'; c.fill();
    } else if (kind === 'avocado') {
      rr(c, -len / 2, -10, len, 20, 10); c.fillStyle = '#C8E26F'; c.fill(); ink(c, 3.5);
      c.beginPath(); c.moveTo(-len / 2 + 8, 7); c.lineTo(len / 2 - 8, 7); c.strokeStyle = '#7FB23D'; c.lineWidth = 4; c.stroke();
    } else {
      rr(c, -len / 2, -11, len, 22, 6); c.fillStyle = '#FF8A5B'; c.fill();
      c.save(); c.clip(); c.strokeStyle = '#FFD3BD'; c.lineWidth = 4;
      for (var x = -len / 2 - 20; x < len / 2 + 20; x += 22) { c.beginPath(); c.moveTo(x, -12); c.lineTo(x + 14, 12); c.stroke(); }
      c.restore(); rr(c, -len / 2, -11, len, 22, 6); ink(c, 3.5);
    }
    c.restore();
  }

  function drawMini(c, kind, x, y, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    if (kind === 'cucumber') {
      c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fillStyle = '#4FAE5E'; c.fill(); ink(c, 3);
      c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fillStyle = '#DDF6CF'; c.fill();
      c.fillStyle = '#9CCB86'; for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(Math.cos(i * 2.1) * 3.5, Math.sin(i * 2.1) * 3.5, 1.6, 0, TAU); c.fill(); }
    } else if (kind === 'avocado') {
      c.beginPath(); c.ellipse(0, 0, 18, 10, 0, 0, TAU); c.fillStyle = '#C8E26F'; c.fill(); ink(c, 3);
      c.beginPath(); c.ellipse(0, 3, 14, 4, 0, 0, Math.PI); c.strokeStyle = '#7FB23D'; c.lineWidth = 3; c.stroke();
    } else {
      rr(c, -15, -9, 30, 18, 4); c.fillStyle = '#FF8A5B'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(-8, -7); c.lineTo(0, 7); c.moveTo(4, -7); c.lineTo(11, 6); c.strokeStyle = '#FFD3BD'; c.lineWidth = 3; c.stroke();
    }
    c.restore();
  }

  var BOWL_POS = [{ x: 170, y: 586 }, { x: 320, y: 586 }, { x: 470, y: 586 }];
  var BOWL_COLORS = ['#3FA7F5', '#FF7EB6', '#FFC93C'];
  var FILLINGS = ['cucumber', 'avocado', 'salmon'];

  function drawBowl(c, i, kind, amount, highlight) {
    var b = BOWL_POS[i], r = 58;
    c.save(); c.translate(b.x, b.y);
    if (highlight) { c.beginPath(); c.ellipse(0, 10, r + 16, r * 0.62 + 16, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.65)'; c.fill(); }
    c.beginPath(); c.moveTo(-r, 0); c.bezierCurveTo(-r, 46, r, 46, r, 0); c.closePath(); c.fillStyle = BOWL_COLORS[i]; c.fill(); ink(c, 4.5);
    c.beginPath(); c.ellipse(0, 0, r, r * 0.3, 0, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 4.5);
    if (amount > 0) {
      var rnd = seeded(i * 31 + 5), n = Math.round(6 * amount);
      for (var k = 0; k < n; k++) drawMini(c, kind, (rnd() - 0.5) * 70, -2 + (rnd() - 0.5) * 12 - k * 1.2, rnd() * TAU);
    }
    c.restore();
  }

  /* Rice grains, drawn as tiny white ovals */
  function grain(c, x, y, a, l) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.ellipse(0, 0, l / 2, l / 4.2, 0, 0, TAU); c.fill(); c.stroke();
    c.restore();
  }
  /* Many grains at once: a soft shadow pass, then the white grains on top. Fast enough for hundreds per frame. */
  function grainBatch(c, list, getX, getY, getA, scale) {
    scale = scale || 1;
    for (var pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (var i = 0; i < list.length; i++) {
        var g = list[i], x = getX(g), y = getY(g) + (pass ? 0 : 1.4), a = getA(g), l = g.l * scale;
        c.moveTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2);
        c.ellipse(x, y, l / 2, l / 4.2, a, 0, TAU);
      }
      c.fillStyle = pass ? '#FFFFFF' : '#D9CDB4'; c.fill();
    }
  }

  /* The finished hand roll: a nori-wrapped cylinder lying on its side, the way they're sold in Australia.
     We see its side and one open end, where the rice ring and the fillings inside show. Local origin is the middle. */
  var ROLL_R = 62;
  function rollEnd(c, x, r) {
    // open end: nori ring, rice, fillings in the middle. Drawn in a circle space squashed into perspective.
    c.save(); c.translate(x, 0); c.scale(0.62, 1);
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = NORI; c.fill(); ink(c, 5 / 0.8);
    c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
    var rnd = seeded(21), gs = [];
    for (var i = 0; i < 70; i++) { var rr2 = r * (0.42 + rnd() * 0.42), th = rnd() * TAU; gs.push({ x: Math.cos(th) * rr2, y: Math.sin(th) * rr2, a: rnd() * Math.PI, l: r * (0.17 + rnd() * 0.05) }); }
    grainBatch(c, gs, function (g) { return g.x; }, function (g) { return g.y; }, function (g) { return g.a; });
    var k = r / 62;
    c.save(); c.scale(k, k);
    // salmon
    rr(c, -24, -26, 34, 22, 5); c.fillStyle = '#FF8A5B'; c.fill(); ink(c, 3.5);
    c.beginPath(); c.moveTo(-18, -24); c.lineTo(-10, -6); c.moveTo(-4, -24); c.lineTo(4, -6); c.strokeStyle = '#FFD3BD'; c.lineWidth = 3.5; c.stroke();
    // avocado
    c.beginPath(); c.ellipse(-8, 12, 18, 11, 0.3, 0, TAU); c.fillStyle = '#C8E26F'; c.fill(); ink(c, 3.5);
    c.beginPath(); c.ellipse(-8, 15, 13, 5, 0.3, 0, Math.PI); c.strokeStyle = '#7FB23D'; c.lineWidth = 3; c.stroke();
    // cucumber
    rr(c, 10, -6, 20, 20, 4); c.fillStyle = '#4FAE5E'; c.fill(); ink(c, 3.5);
    rr(c, 14, -2, 12, 12, 2); c.fillStyle = '#DDF6CF'; c.fill();
    c.restore();
    c.restore();
  }
  function drawHandroll(c, x, y, scale, rot, len, r) {
    len = len || 330; r = r || ROLL_R;
    var L = len / 2, cap = r * 0.62;
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
    // shadow
    c.beginPath(); c.ellipse(0, r * 0.92, L + cap, r * 0.28, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.2)'; c.fill();
    // body
    c.beginPath(); c.moveTo(L, -r); c.lineTo(-L, -r); c.ellipse(-L, 0, cap, r, 0, -Math.PI / 2, Math.PI / 2, true); c.lineTo(L, r); c.closePath();
    c.fillStyle = NORI; c.fill();
    c.save(); c.clip();
    rr(c, -L - cap, -r * 0.7, len + cap, r * 0.26, r * 0.13); c.fillStyle = NORI_LIGHT; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 3;
    var rnd = seeded(5); for (var i = 0; i < 18; i++) { var tx = (rnd() - 0.5) * len, ty = (rnd() - 0.5) * r * 1.6; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + 26, ty + 4); c.stroke(); }
    // where the nori overlaps itself
    c.beginPath(); c.moveTo(-L - cap, r * 0.38); c.quadraticCurveTo(0, r * 0.5, L, r * 0.36); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 4; c.stroke();
    c.restore();
    c.beginPath(); c.moveTo(L, -r); c.lineTo(-L, -r); c.ellipse(-L, 0, cap, r, 0, -Math.PI / 2, Math.PI / 2, true); c.lineTo(L, r);
    ink(c, 5);
    rollEnd(c, L, r);
    c.restore();
  }

  function drawSeed(c, x, y, a, dark) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.ellipse(0, 0, 4.2, 2.4, 0, 0, TAU);
    c.fillStyle = dark ? '#2A2340' : '#F7E7C4'; c.fill();
    if (!dark) { c.strokeStyle = '#B79A6A'; c.lineWidth = 1; c.stroke(); }
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
  function newDish() { return { plate: 0, leaves: [], ginger: [], wasabi: [], seeds: [], soy: 0 }; }

  /* =============== STEP 1: RICE =============== */
  function RiceScene() {
    var cx = 320, cy = 300, RX = 214, RY = 64, rx = 186, ry = 50;
    var rnd = seeded(7), grains = [];
    for (var i = 0; i < 1100; i++) grains.push({ r: Math.sqrt(rnd()) * 0.96, th: rnd() * TAU, a: rnd() * Math.PI, l: 10 + rnd() * 3 });
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
        if (stir >= 1 && !done) {
          done = true; stirLoop.set(0); Sound.chime(); buzz(20);
          burst(cx, cy, 26, { colors: ['#FFC93C', '#FFFFFF', '#FF7EB6'], speed: 260, life: 0.9 });
          Cat.show('Fluffy rice!');
          say('Shiny sushi rice!');
          showNext('Next', function () { goStep(1); });
        }
      },
      draw: function (c) {
        // shadow + bowl body
        c.beginPath(); c.ellipse(cx, cy + 230, 150, 22, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
        c.beginPath(); c.ellipse(cx, cy + 214, 96, 20, 0, 0, TAU); c.fillStyle = '#E25C49'; c.fill(); ink(c, 5);
        c.beginPath(); c.moveTo(cx - RX, cy); c.bezierCurveTo(cx - RX, cy + 180, cx - 110, cy + 216, cx, cy + 216);
        c.bezierCurveTo(cx + 110, cy + 216, cx + RX, cy + 180, cx + RX, cy); c.closePath();
        c.fillStyle = '#FF7E6B'; c.fill(); ink(c, 5);
        // dots pattern on bowl
        c.save(); c.clip(); c.fillStyle = '#FFFFFF';
        for (var k = 0; k < 9; k++) { c.beginPath(); c.arc(cx - 170 + k * 42, cy + 96 + Math.sin(k) * 8, 9, 0, TAU); c.fill(); }
        c.restore();
        // inside
        c.beginPath(); c.ellipse(cx, cy, RX, RY, 0, 0, TAU); c.fillStyle = '#FFE1D9'; c.fill(); ink(c, 5);
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
        if (phase === 'stir') {
          c.beginPath(); c.arc(cx, cy - 150, 34, -Math.PI / 2, -Math.PI / 2 + TAU * stir);
          c.strokeStyle = '#7BD389'; c.lineWidth = 12; c.lineCap = 'round'; c.stroke();
          c.beginPath(); c.arc(cx, cy - 150, 34, 0, TAU); c.strokeStyle = 'rgba(42,35,64,.15)'; c.lineWidth = 12; c.stroke();
          c.save(); c.translate(cx, cy - 150); c.fillStyle = '#FFFFFF';
          c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); ink(c, 3.5);
          c.fillStyle = INK; c.font = '800 22px ' + getComputedStyle(document.body).getPropertyValue('--display');
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(done ? '✓' : Math.round(stir * 100) + '', 0, 1);
          c.restore();
        }
        if (paddle && !done) drawPaddle(c, paddle);
      }
    };
  }

  /* =============== STEP 2: CHOP =============== */
  var ING = {
    cucumber: { len: 440, h: 96, cuts: 5, body: '#4FAE5E', face: '#DDF6CF', ring: '#4FAE5E', round: 48, label: 'cucumber' },
    avocado: { len: 390, h: 116, cuts: 4, body: '#C8E26F', face: '#E7F2A0', ring: '#7FB23D', round: 58, label: 'avocado' },
    salmon: { len: 420, h: 104, cuts: 4, body: '#FF8A5B', face: '#FFA27E', ring: '#FF8A5B', round: 20, label: 'salmon' }
  };

  function ChopScene() {
    var cx = 320, cy = 290;
    var idx = 0, cur = null, filled = [0, 0, 0], knife = null, trail = [], stroke = null, allDone = false;
    var timers = [];

    function later(sec, fn) { timers.push({ t: sec, fn: fn }); }

    function load(i) {
      var k = FILLINGS[i], d = ING[k], guides = [];
      var span = d.len * 0.78;
      for (var g = 0; g < d.cuts; g++) guides.push({ x: -span / 2 + span * (g + 0.5) / d.cuts, cut: false, neat: false, open: 0 });
      cur = { kind: k, d: d, guides: guides, enter: 0, leave: -1, neat: 0, cuts: 0 };
      say(i === 0 ? 'Swipe down to slice!' : 'Slice the ' + d.label + '!');
    }

    function halfH(d, x) {
      var L = d.len / 2, R = d.round, h = d.h / 2;
      var ax = Math.abs(x);
      if (ax <= L - R) return h;
      var dx = ax - (L - R);
      return Math.max(0, (h - R) + Math.sqrt(Math.max(0, R * R - dx * dx)));
    }

    function bodyPath(c, d) { rr(c, -d.len / 2, -d.h / 2, d.len, d.h, d.round); }

    function drawBody(c, cur) {
      var d = cur.d, k = cur.kind;
      bodyPath(c, d); c.fillStyle = d.body; c.fill();
      c.save(); bodyPath(c, d); c.clip();
      if (k === 'cucumber') {
        c.fillStyle = '#6CC67A'; c.fillRect(-d.len / 2, -d.h / 2 + 12, d.len, 14);
        c.fillStyle = '#2F7D3E';
        var rnd = seeded(3); for (var i = 0; i < 26; i++) { c.beginPath(); c.arc((rnd() - 0.5) * d.len * 0.95, (rnd() - 0.5) * d.h * 0.8, 3, 0, TAU); c.fill(); }
      } else if (k === 'avocado') {
        c.strokeStyle = '#3D6B2C'; c.lineWidth = 16; bodyPath(c, d); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-60, -22, 110, 14, 0, 0, TAU); c.fill();
      } else {
        c.strokeStyle = '#FFD3BD'; c.lineWidth = 7;
        for (var x = -d.len / 2 - 60; x < d.len / 2 + 60; x += 34) { c.beginPath(); c.moveTo(x, -d.h / 2); c.quadraticCurveTo(x + 30, 0, x + 10, d.h / 2); c.stroke(); }
      }
      c.restore();
      bodyPath(c, d); ink(c, 5);
    }

    function drawCutFace(c, cur, x) {
      var d = cur.d, hh = halfH(d, x) * 0.92;
      if (hh < 4) return;
      c.beginPath(); c.ellipse(x, 0, 7, hh, 0, 0, TAU); c.fillStyle = d.face; c.fill(); ink(c, 3);
    }

    function drawIngredient(c) {
      if (!cur) return;
      var d = cur.d;
      var slide = cur.leave >= 0 ? 0 : (1 - easeBack(cur.enter)) * -600;
      var lt = cur.leave >= 0 ? easeOut(cur.leave) : 0;
      var target = BOWL_POS[idx];
      c.save();
      c.translate(lerp(cx + slide, target.x, lt), lerp(cy, target.y - 10, lt));
      c.scale(1 - 0.8 * lt, 1 - 0.8 * lt);
      c.globalAlpha = 1 - lt * 0.6;
      // shadow
      c.beginPath(); c.ellipse(0, d.h / 2 + 8, d.len / 2, 12, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.15)'; c.fill();
      var cutXs = cur.guides.filter(function (g) { return g.cut; }).sort(function (a, b) { return a.x - b.x; });
      var bounds = [-d.len / 2 - 2].concat(cutXs.map(function (g) { return g.x; }), [d.len / 2 + 2]);
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
      c.fillStyle = '#E3E9F0'; c.fill(); ink(c, 4.5);
      c.beginPath(); c.moveTo(2, -136); c.lineTo(2, -40); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4; c.stroke();
      rr(c, -8, -238, 34, 92, 12); c.fillStyle = '#FF6B57'; c.fill(); ink(c, 4.5);
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
            burst(BOWL_POS[idx].x, BOWL_POS[idx].y - 10, 10, { colors: ['#FFFFFF', '#FFC93C'], speed: 140, life: 0.5 });
            idx++;
            if (idx < 3) load(idx);
            else {
              cur = null; allDone = true; Sound.chime();
              say('All chopped!');
              showNext('Next', function () { goStep(2); });
            }
          }
        }
      },
      draw: function (c) {
        // cutting board
        c.beginPath(); rr(c, 50, 120, 540, 360, 34); c.fillStyle = 'rgba(42,35,64,.15)'; c.save(); c.translate(0, 10); c.fill(); c.restore();
        rr(c, 50, 120, 540, 360, 34); c.fillStyle = '#F2C48D'; c.fill(); ink(c, 5);
        c.strokeStyle = '#E0AD72'; c.lineWidth = 4;
        for (var y = 160; y < 460; y += 46) { c.beginPath(); c.moveTo(90, y); c.quadraticCurveTo(320, y + 12, 550, y); c.stroke(); }
        c.beginPath(); c.arc(548, 160, 14, 0, TAU); c.fillStyle = '#FFE3CC'; c.fill(); ink(c, 4);
        for (var b = 0; b < 3; b++) drawBowl(c, b, FILLINGS[b], filled[b], false);
        drawIngredient(c);
        if (trail.length > 1) {
          c.beginPath(); c.moveTo(trail[0].x, trail[0].y);
          for (var i = 1; i < trail.length; i++) c.lineTo(trail[i].x, trail[i].y);
          c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 10; c.lineCap = 'round'; c.stroke();
        }
        if (knife) drawKnife(c, knife);
        if (allDone) { c.save(); c.globalAlpha = 0.9; drawHandIcon(c, 320, 290); c.restore(); }
      }
    };
  }

  function drawHandIcon(c, x, y) {
    // a little smiling onigiri-style sticker for "all done"
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(0, -80); c.quadraticCurveTo(90, 40, 60, 70); c.lineTo(-60, 70); c.quadraticCurveTo(-90, 40, 0, -80); c.closePath();
    c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 5);
    rr(c, -40, 30, 80, 40, 6); c.fillStyle = NORI; c.fill(); ink(c, 4);
    c.fillStyle = INK; c.beginPath(); c.arc(-18, 0, 5, 0, TAU); c.arc(18, 0, 5, 0, TAU); c.fill();
    c.beginPath(); c.arc(0, 8, 9, 0.2, Math.PI - 0.2); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
    c.fillStyle = '#FF8FAB'; c.beginPath(); c.ellipse(-32, 14, 8, 5, 0, 0, TAU); c.ellipse(32, 14, 8, 5, 0, 0, TAU); c.fill();
    c.restore();
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
    var rubSpeed = 0, lastP = null;
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
      rr(c, NX, NY, NW, NH, 8); c.fillStyle = NORI; c.fill(); ink(c, 5);
      c.save(); rr(c, NX, NY, NW, NH, 8); c.clip(); c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 3;
      var r2 = seeded(4); for (var i = 0; i < 26; i++) { var x = NX + r2() * NW, y = NY + r2() * NH; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y + 6); c.stroke(); }
      c.restore();
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
          showNext('Next', function () { goStep(3); });
        }
      },
      draw: function (c) {
        // bamboo mat
        rr(c, 60, 120, 520, 356, 14); c.fillStyle = '#EED9A4'; c.fill(); ink(c, 5);
        c.save(); rr(c, 60, 120, 520, 356, 14); c.clip(); c.strokeStyle = '#D6B877'; c.lineWidth = 3;
        for (var y = 136; y < 476; y += 20) { c.beginPath(); c.moveTo(60, y); c.lineTo(580, y); c.stroke(); }
        c.strokeStyle = '#B9935A'; c.lineWidth = 4; c.beginPath(); c.moveTo(140, 120); c.lineTo(140, 476); c.moveTo(500, 120); c.lineTo(500, 476); c.stroke();
        c.restore();
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
  var PLATES = [
    { fill: '#FFFFFF', rim: '#3FA7F5' }, { fill: '#FFD6E0', rim: '#FF7EB6' }, { fill: '#D7EEFF', rim: '#2A2340' },
    { fill: '#FFF1B8', rim: '#FF6B57' }, { fill: '#DDF6CF', rim: '#4FAE5E' }, { fill: '#2A2340', rim: '#FFC93C' }
  ];
  var PCX = 300, PCY = 300, PR = 226, SOY = { x: 405, y: 420, r: 50 };

  function drawPlateScene(c, d, extra) {
    extra = extra || {};
    var pl = PLATES[d.plate];
    c.beginPath(); c.ellipse(PCX, PCY + 16, PR, PR * 0.96, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.arc(PCX, PCY, PR, 0, TAU); c.fillStyle = pl.fill; c.fill(); ink(c, 5);
    c.beginPath(); c.arc(PCX, PCY, PR - 34, 0, TAU); c.strokeStyle = pl.rim; c.globalAlpha = 0.35; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = pl.rim;
    for (var i = 0; i < 24; i++) { var a = i / 24 * TAU; c.beginPath(); c.arc(PCX + Math.cos(a) * (PR - 17), PCY + Math.sin(a) * (PR - 17), 4.5, 0, TAU); c.fill(); }
    d.leaves.forEach(function (l) { drawLeaf(c, l.x, l.y, l.a); });
    drawHandroll(c, PCX + 4, PCY - 6, 1, -0.3, 320);
    d.ginger.forEach(function (g) { drawGinger(c, g.x, g.y, g.a); });
    d.wasabi.forEach(function (w) { drawWasabi(c, w.x, w.y); });
    d.seeds.forEach(function (s) { drawSeed(c, s.x, s.y, s.a, s.dark); });
    // soy dish
    c.beginPath(); c.ellipse(SOY.x, SOY.y + 8, SOY.r, SOY.r * 0.9, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.arc(SOY.x, SOY.y, SOY.r, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 5);
    c.beginPath(); c.arc(SOY.x, SOY.y, SOY.r - 12, 0, TAU); c.strokeStyle = '#3FA7F5'; c.lineWidth = 4; c.stroke();
    if (d.soy > 0) {
      c.beginPath(); c.arc(SOY.x, SOY.y, (SOY.r - 16) * Math.sqrt(d.soy), 0, TAU); c.fillStyle = '#5A2A12'; c.fill();
      c.beginPath(); c.ellipse(SOY.x - 12 * d.soy, SOY.y - 14 * d.soy, 12 * d.soy, 5 * d.soy, -0.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
      if (extra.ripple) { c.beginPath(); c.arc(SOY.x, SOY.y, (SOY.r - 16) * Math.sqrt(d.soy) * extra.ripple, 0, TAU); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.stroke(); }
    }
  }

  function drawLeaf(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(-70, 0); c.quadraticCurveTo(0, -46, 70, 0); c.quadraticCurveTo(0, 46, -70, 0); c.closePath();
    c.fillStyle = '#5CC46B'; c.fill(); ink(c, 4);
    c.beginPath(); c.moveTo(-64, 0); c.lineTo(62, 0); c.strokeStyle = '#3E9B54'; c.lineWidth = 3; c.stroke();
    for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 20, 0); c.lineTo(i * 20 + 14, -18); c.moveTo(i * 20, 0); c.lineTo(i * 20 + 14, 18); c.stroke(); }
    c.restore();
  }
  function drawGinger(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    for (var i = 0; i < 5; i++) {
      c.save(); c.rotate(i / 5 * TAU);
      c.beginPath(); c.ellipse(0, -14, 11, 17, 0, 0, TAU); c.fillStyle = i % 2 ? '#FFB3C7' : '#FFC9D6'; c.fill(); ink(c, 2.5);
      c.restore();
    }
    c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fillStyle = '#FF9AB4'; c.fill(); ink(c, 2.5);
    c.restore();
  }
  function drawWasabi(c, x, y) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-24, 10); c.quadraticCurveTo(-26, -8, -8, -12); c.quadraticCurveTo(0, -30, 10, -12); c.quadraticCurveTo(28, -8, 24, 10); c.quadraticCurveTo(0, 18, -24, 10); c.closePath();
    c.fillStyle = '#9BD45A'; c.fill(); ink(c, 3.5);
    c.beginPath(); c.arc(-6, -6, 4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
    c.restore();
  }

  var TOOL_ICONS = {
    plate: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#fff" stroke="#2A2340" stroke-width="3"/><circle cx="20" cy="20" r="10" fill="none" stroke="#3FA7F5" stroke-width="3"/></svg>',
    leaf: '<svg viewBox="0 0 40 40"><path d="M4 22 Q20 2 36 18 Q20 38 4 22 Z" fill="#5CC46B" stroke="#2A2340" stroke-width="3"/><path d="M6 22 L34 18" stroke="#3E9B54" stroke-width="2.5"/></svg>',
    sesame: '<svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="26" rx="6" fill="#FFF4D6" stroke="#2A2340" stroke-width="3"/><rect x="11" y="4" width="18" height="8" rx="3" fill="#FF6B57" stroke="#2A2340" stroke-width="3"/><ellipse cx="17" cy="24" rx="3" ry="1.8" fill="#2A2340"/><ellipse cx="23" cy="28" rx="3" ry="1.8" fill="#E8D3A6" stroke="#2A2340"/><ellipse cx="22" cy="20" rx="3" ry="1.8" fill="#E8D3A6" stroke="#2A2340"/></svg>',
    soy: '<svg viewBox="0 0 40 40"><path d="M14 4 H26 V10 Q34 14 33 24 V34 Q33 37 30 37 H10 Q7 37 7 34 V24 Q6 14 14 10 Z" fill="#5A2A12" stroke="#2A2340" stroke-width="3"/><rect x="12" y="2" width="16" height="6" rx="2" fill="#FF6B57" stroke="#2A2340" stroke-width="2.5"/><rect x="11" y="20" width="18" height="10" rx="2" fill="#fff"/></svg>',
    ginger: '<svg viewBox="0 0 40 40"><g stroke="#2A2340" stroke-width="2"><ellipse cx="20" cy="11" rx="7" ry="9" fill="#FFC9D6"/><ellipse cx="29" cy="20" rx="9" ry="7" fill="#FFB3C7"/><ellipse cx="20" cy="29" rx="7" ry="9" fill="#FFC9D6"/><ellipse cx="11" cy="20" rx="9" ry="7" fill="#FFB3C7"/><circle cx="20" cy="20" r="5" fill="#FF9AB4"/></g></svg>',
    wasabi: '<svg viewBox="0 0 40 40"><path d="M6 26 Q4 14 15 13 Q20 2 26 13 Q37 14 34 26 Q20 33 6 26 Z" fill="#9BD45A" stroke="#2A2340" stroke-width="3"/></svg>'
  };
  var TOOL_SAY = { leaf: 'Tap the plate for a leaf', sesame: 'Drag to sprinkle sesame', soy: 'Hold to pour soy sauce', ginger: 'Tap to add ginger', wasabi: 'Tap to add wasabi' };

  function PlateScene() {
    var tool = 'sesame', down = false, pointer = null, emit = 0, soyHold = false, bottleT = 0, ripple = 0, praised = false, actions = 0;
    var falling = [];
    var pourLoop = Sound.loop('pour');

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
            if (b.dataset.tool === 'plate') { dish.plate = (dish.plate + 1) % PLATES.length; Sound.pop(); burst(PCX, PCY - PR + 10, 8, { colors: ['#FFFFFF', '#FFC93C'], speed: 140, life: 0.5 }); say('New plate!'); return; }
            Sound.pop(); setTool(b.dataset.tool);
          });
        });
        setTool('sesame');
        say('Decorate your plate!');
        showNext('Done', finishDish);
      },
      leave: function () { pourLoop.stop(); toolsEl.innerHTML = ''; },
      hint: function (t) {
        if (actions > 0) return null;
        var k = (t % 2) / 2; return { x: PCX - 120 + k * 240, y: PCY - 40 + Math.sin(k * TAU) * 40, press: true };
      },
      down: function (p) {
        down = true; pointer = p;
        if (tool === 'leaf' && onPlate(p, 50)) { place(dish.leaves, { x: p.x, y: p.y, a: Math.random() * TAU }, 3); Sound.plop(); countAction(); }
        if (tool === 'ginger' && onPlate(p, 30)) { place(dish.ginger, { x: p.x, y: p.y, a: Math.random() * TAU }, 4); Sound.pop(); countAction(); }
        if (tool === 'wasabi' && onPlate(p, 30)) { place(dish.wasabi, { x: p.x, y: p.y }, 3); Sound.plop(); countAction(); }
        if (tool === 'soy') soyHold = true;
        if (tool === 'sesame') emit = 1;
      },
      move: function (p) { pointer = p; },
      up: function () { down = false; soyHold = false; emit = 0; },
      update: function (dt) {
        for (var i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { var f = timers[i].fn; timers.splice(i, 1); f(); } }
        // sesame
        if (down && tool === 'sesame' && pointer) {
          emit += dt * 30;
          while (emit >= 1) {
            emit -= 1;
            if (falling.length + dish.seeds.length < 500) falling.push({ x: pointer.x + (Math.random() - 0.5) * 34, y: pointer.y - 30 + (Math.random() - 0.5) * 10, vy: 40 + Math.random() * 40, land: pointer.y + 10 + Math.random() * 30, a: Math.random() * TAU, dark: Math.random() < 0.3 });
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
        if (pouring) { dish.soy = Math.min(1, dish.soy + dt * 0.4); ripple = (ripple + dt * 1.5) % 1; if (dish.soy >= 1) { countAction(); countAction(); } }
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

  /* ---------- finishing ---------- */
  function snapshot() {
    var out = document.createElement('canvas'); out.width = 360; out.height = 360;
    var c = out.getContext('2d');
    c.fillStyle = '#E9B57F'; c.fillRect(0, 0, 360, 360);
    var span = PR * 2 + 24, k = 360 / span; c.scale(k, k); c.translate(-(PCX - span / 2), -(PCY - span / 2));
    drawPlateScene(c, dish);
    try { return out.toDataURL('image/jpeg', 0.82); } catch (e) { return ''; }
  }

  function finishDish() {
    var img = snapshot();
    var prog = GG.getProgress('cooking');
    prog.made = (prog.made || 0) + 1;
    prog.book = Array.isArray(prog.book) ? prog.book : [];
    prog.book.unshift({ dish: 'handroll', at: Date.now(), img: img });
    prog.book = prog.book.slice(0, 12);
    var saved = GG.setProgress('cooking', prog);
    if (!saved) { prog.book = prog.book.slice(0, 4); saved = GG.setProgress('cooking', prog); }
    leaveScene();
    var p = GG.current();
    $('dishImg').src = img;
    $('finishNote').textContent = saved ? (p ? 'Saved to ' + p.name + '’s cookbook.' : 'Saved to your cookbook.') : 'Yum! (This device could not save it.)';
    showScreen('finish');
    Sound.chime();
    for (var i = 0; i < 4; i++) setTimeout(function () { burst(Math.random() * SIZE, -20, 14, { colors: ['#FF6B57', '#FFC93C', '#7BD389', '#3FA7F5', '#FF7EB6'], shape: 'confetti', size: 16, speed: 120, gravity: 420, life: 2.2 }); }, i * 220);
    setTimeout(function () { Cat.show('Great job!', 3000); }, 500);
  }

  /* ---------- scene flow ---------- */
  var STEPS = [
    { name: 'Rice', make: RiceScene, icon: '<svg viewBox="0 0 24 24"><path d="M3 11 H21 Q20 20 12 20 Q4 20 3 11 Z" fill="#FF7E6B" stroke="#2A2340" stroke-width="2"/><path d="M5 11 Q12 4 19 11" fill="#fff" stroke="#2A2340" stroke-width="2"/></svg>' },
    { name: 'Chop', make: ChopScene, icon: '<svg viewBox="0 0 24 24"><path d="M4 18 L16 6 L19 9 L8 20 Z" fill="#E3E9F0" stroke="#2A2340" stroke-width="2" stroke-linejoin="round"/><rect x="15" y="2" width="5" height="8" rx="2" transform="rotate(45 17.5 6)" fill="#FF6B57" stroke="#2A2340" stroke-width="2"/></svg>' },
    { name: 'Roll', make: RollScene, icon: '<svg viewBox="0 0 24 24"><g transform="rotate(-22 12 12)"><path d="M16 6.5 H6 A3 5.5 0 0 0 6 17.5 H16 Z" fill="#2E4A3A" stroke="#2A2340" stroke-width="2" stroke-linejoin="round"/><ellipse cx="16" cy="12" rx="4.2" ry="5.5" fill="#2E4A3A" stroke="#2A2340" stroke-width="2"/><ellipse cx="16" cy="12" rx="3" ry="4.2" fill="#fff"/><circle cx="16" cy="11" r="1.3" fill="#FF8A5B"/><circle cx="16.3" cy="13.4" r="1.1" fill="#4FAE5E"/></g></svg>' },
    { name: 'Plate', make: PlateScene, icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#fff" stroke="#2A2340" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="#3FA7F5" stroke-width="2"/></svg>' }
  ];
  var scene = null, stepIdx = -1, hintT = 0, idle = 0, pointerId = null;

  function renderSteps() {
    $('steps').innerHTML = STEPS.map(function (s, i) {
      return '<div class="step ' + (i < stepIdx ? 'done' : i === stepIdx ? 'now' : '') + '"><i>' + s.icon + '</i><span>' + s.name + '</span></div>';
    }).join('');
  }
  function leaveScene() { if (scene && scene.leave) scene.leave(); scene = null; Cat.hide(); hideNext(); pointerId = null; }
  function goStep(i) {
    leaveScene();
    stepIdx = i; renderSteps();
    toolsEl.innerHTML = '';
    scene = STEPS[i].make(); idle = 0; hintT = 0; parts = [];
    if (scene.enter) scene.enter();
  }

  /* ---------- screens ---------- */
  var mode = 'menu';
  function showScreen(m) {
    mode = m;
    Cat.hide();
    $('menu').hidden = m !== 'menu';
    $('finish').hidden = m !== 'finish';
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
    { id: 'pancakes', name: 'Pancakes' },
    { id: 'omurice', name: 'Omurice' },
    { id: 'brigadeiros', name: 'Brigadeiros' }
  ];
  var RECIPE_ART = {
    handroll: '<svg viewBox="16 46 208 102"><ellipse cx="120" cy="122" rx="100" ry="22" fill="#fff" stroke="#2A2340" stroke-width="4"/><ellipse cx="120" cy="119" rx="74" ry="12" fill="#FFE3EC"/><g transform="rotate(-14 120 90)"><path d="M168 62 H70 A17 28 0 0 0 70 118 H168 Z" fill="#2E4A3A" stroke="#2A2340" stroke-width="4" stroke-linejoin="round"/><rect x="62" y="69" width="100" height="8" rx="4" fill="#3D6450"/><ellipse cx="168" cy="90" rx="17.5" ry="28" fill="#2E4A3A" stroke="#2A2340" stroke-width="4"/><ellipse cx="168" cy="90" rx="14.5" ry="23.5" fill="#fff"/><rect x="160" y="77" width="11" height="9" rx="2" fill="#FF8A5B" stroke="#2A2340" stroke-width="2"/><rect x="168" y="88" width="7" height="8" rx="1.5" fill="#4FAE5E" stroke="#2A2340" stroke-width="2"/><ellipse cx="164" cy="98" rx="6" ry="4" fill="#C8E26F" stroke="#2A2340" stroke-width="2"/></g><ellipse cx="178" cy="125" rx="18" ry="7" fill="#fff" stroke="#2A2340" stroke-width="3"/><ellipse cx="178" cy="124.5" rx="11.5" ry="4" fill="#5A2A12"/></svg>',
    pancakes: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="102" rx="76" ry="14" fill="#fff" stroke="#2A2340" stroke-width="4"/><g stroke="#2A2340" stroke-width="4"><ellipse cx="90" cy="88" rx="56" ry="14" fill="#F2B45E"/><ellipse cx="90" cy="72" rx="56" ry="14" fill="#F6C273"/><ellipse cx="90" cy="56" rx="56" ry="14" fill="#F9CF85"/></g><rect x="78" y="36" width="24" height="14" rx="3" fill="#FFF1B8" stroke="#2A2340" stroke-width="3"/></svg>',
    omurice: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="98" rx="78" ry="16" fill="#fff" stroke="#2A2340" stroke-width="4"/><path d="M30 90 Q30 36 90 34 Q150 36 150 90 Z" fill="#FFD84D" stroke="#2A2340" stroke-width="4"/><path d="M60 60 Q75 50 90 62 Q105 50 120 60" fill="none" stroke="#FF4D3D" stroke-width="6" stroke-linecap="round"/></svg>',
    brigadeiros: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="100" rx="78" ry="16" fill="#fff" stroke="#2A2340" stroke-width="4"/><g stroke="#2A2340" stroke-width="4"><circle cx="60" cy="74" r="22" fill="#6B3A22"/><circle cx="120" cy="74" r="22" fill="#6B3A22"/><circle cx="90" cy="56" r="22" fill="#7A4428"/></g></svg>'
  };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderMenu() {
    GG.reload();
    var p = GG.current();
    $('menuTitle').textContent = p ? 'What shall we cook, ' + p.name + '?' : 'What shall we cook?';
    $('recipes').innerHTML = RECIPES.map(function (r) {
      return r.ready
        ? '<button class="recipe hero" type="button" data-id="' + r.id + '">' + RECIPE_ART[r.id] + '<span>' + r.name + '</span><small>Rice · Chop · Roll · Plate</small></button>'
        : '<div class="recipe locked"><span class="soon">Soon</span>' + RECIPE_ART[r.id] + '<span>' + r.name + '</span></div>';
    }).join('');
    $('recipes').querySelectorAll('button.recipe').forEach(function (b) {
      b.addEventListener('click', function () { Sound.init(); Sound.pop(); startCooking(); });
    });
    var prog = GG.getProgress('cooking'), book = Array.isArray(prog.book) ? prog.book : [];
    $('book').innerHTML = book.length
      ? book.map(function (e) {
        var d = new Date(e.at);
        return '<figure>' + (e.img ? '<img alt="Sushi handroll" src="' + esc(e.img) + '">' : '') + '<figcaption>' + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + '</figcaption></figure>';
      }).join('')
      : '<p class="empty">Dishes you make will show up here.</p>';
  }

  function startCooking() { dish = newDish(); showScreen('play'); goStep(0); }

  /* Leaving mid-dish takes two taps so a stray finger doesn't lose the dish. */
  var leaveArmed = false, leaveTimer = null;
  $('backBtn').addEventListener('click', function () {
    if (mode === 'finish' || leaveArmed) { leaveScene(); showScreen('menu'); return; }
    leaveArmed = true; $('backLabel').textContent = 'Leave? Tap again';
    clearTimeout(leaveTimer); leaveTimer = setTimeout(function () { leaveArmed = false; $('backLabel').textContent = 'Kitchen'; }, 2500);
  });
  $('againBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); startCooking(); });
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
  window.__kitchen = { goStep: function (i) { if (!dish) dish = newDish(); showScreen('play'); goStep(i); }, finish: function () { finishDish(); } };
})();
