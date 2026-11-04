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
  function mixHex(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp(pa >> 8 & 255, pb >> 8 & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
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
      var ag = c.createLinearGradient(0, -11, 0, 11); ag.addColorStop(0, '#F4F2A8'); ag.addColorStop(0.6, '#DCEA86'); ag.addColorStop(1, '#A6D05A');
      rr(c, -len / 2, -11, len, 22, 11); c.fillStyle = ag; c.fill();
      c.beginPath(); c.moveTo(-len / 2 + 10, 8); c.lineTo(len / 2 - 10, 8); c.strokeStyle = '#5E8F33'; c.lineWidth = 3; c.stroke();
      rr(c, -len / 2, -11, len, 22, 11); ink(c, 3.5);
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
      c.beginPath(); c.moveTo(-19, 5); c.quadraticCurveTo(0, -18, 19, 5); c.quadraticCurveTo(0, 12, -19, 5); c.closePath();
      c.fillStyle = '#E8EE98'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(-16, 6); c.quadraticCurveTo(0, 11, 16, 6); c.strokeStyle = '#4E7F2C'; c.lineWidth = 3.5; c.stroke();
    } else if (kind === 'tomato') {
      c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fillStyle = '#FF4D3D'; c.fill(); ink(c, 3);
      c.beginPath(); c.arc(0, 0, 8.5, 0, TAU); c.fillStyle = '#FF9A80'; c.fill();
      c.fillStyle = '#FFE7A0'; [[-3, -2], [3, -2], [0, 3.5]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 1.3, 2, 0, 0, TAU); c.fill(); });
    } else if (kind === 'onion') {
      c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.strokeStyle = INK; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#F7F0E3'; c.lineWidth = 3.5; c.stroke();
      c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.strokeStyle = 'rgba(181,87,155,.5)'; c.lineWidth = 1.2; c.stroke();
    } else if (kind === 'banana') {
      c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fillStyle = '#FFF4C2'; c.fill(); ink(c, 3);
      c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fillStyle = '#F3E2A0'; c.fill();
      c.fillStyle = '#8A5A2B'; for (var j = 0; j < 3; j++) { c.beginPath(); c.arc(Math.cos(j * 2.1) * 2.6, Math.sin(j * 2.1) * 2.6, 1.2, 0, TAU); c.fill(); }
    } else if (kind === 'strawberry') {
      c.beginPath(); c.moveTo(0, 13); c.quadraticCurveTo(-17, 1, -11, -8); c.quadraticCurveTo(0, -15, 11, -8); c.quadraticCurveTo(17, 1, 0, 13); c.closePath();
      c.fillStyle = '#FF5A6A'; c.fill(); ink(c, 3);
      c.save(); c.scale(0.55, 0.55); c.beginPath(); c.moveTo(0, 13); c.quadraticCurveTo(-17, 1, -11, -8); c.quadraticCurveTo(0, -15, 11, -8); c.quadraticCurveTo(17, 1, 0, 13); c.closePath(); c.fillStyle = '#FFD0D6'; c.fill(); c.restore();
      c.fillStyle = '#FFF2A8'; [[-6, 2], [5, 3], [0, -6], [-2, 8]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 1.3, 2, 0, 0, TAU); c.fill(); });
    } else {
      rr(c, -15, -9, 30, 18, 4); c.fillStyle = '#FF8A5B'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(-8, -7); c.lineTo(0, 7); c.moveTo(4, -7); c.lineTo(11, 6); c.strokeStyle = '#FFD3BD'; c.lineWidth = 3; c.stroke();
    }
    c.restore();
  }

  var BOWL_POS = [{ x: 170, y: 586 }, { x: 320, y: 586 }, { x: 470, y: 586 }];
  var BOWL_COLORS = ['#3FA7F5', '#FF7EB6', '#FFC93C'];
  var FILLINGS = ['cucumber', 'avocado', 'salmon'];

  function drawBowl(c, i, kind, amount, highlight, pos) {
    var b = pos || BOWL_POS[i], r = 58;
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
    c.beginPath(); c.ellipse(-8, 12, 18, 11, 0.3, 0, TAU); c.fillStyle = '#E8EE98'; c.fill(); ink(c, 3.5);
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
  function newDish() { return { plate: 0, leaves: [], ginger: [], wasabi: [], seeds: [], soy: 0, syrup: [], drips: [], tops: [], sugar: [], cakes: [], layers: [], patty: 'perfect', topBun: false }; }

  /* =============== STEP 1: RICE =============== */
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
    avocado: { len: 380, h: 136, cuts: 4, body: '#3E6B2A', face: '#E2EC8C', ring: '#3E6B2A', round: 60, label: 'avocado', shape: 'pear' },
    salmon: { len: 420, h: 104, cuts: 4, body: '#FF8A5B', face: '#FFA27E', ring: '#FF8A5B', round: 20, label: 'salmon' },
    tomato: { len: 230, h: 200, cuts: 4, body: '#FF4D3D', face: '#FF8A70', face2: '#FFC9B0', ring: '#E8322B', round: 100, label: 'tomato' },
    onion: { len: 230, h: 200, cuts: 4, body: '#F4E9D8', face: '#FBF6EA', ring: '#E2CFAF', round: 100, label: 'onion', rings: true },
    banana: { len: 440, h: 84, cuts: 6, body: '#FFF0A8', face: '#FFF7D6', face2: '#F3E2A0', ring: '#E9D27A', round: 42, label: 'banana' },
    strawberry: { len: 280, h: 170, cuts: 3, body: '#FF4D5E', face: '#FF8F9C', face2: '#FFE0E4', ring: '#E83A4E', round: 60, label: 'strawberry', shape: 'pear', ratio: 0.2 }
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
      } else {
        c.strokeStyle = '#FFD3BD'; c.lineWidth = 7;
        for (var x = -d.len / 2 - 60; x < d.len / 2 + 60; x += 34) { c.beginPath(); c.moveTo(x, -d.h / 2); c.quadraticCurveTo(x + 30, 0, x + 10, d.h / 2); c.stroke(); }
      }
      c.restore();
      bodyPath(c, d); ink(c, 5);
      if (k === 'tomato') {
        c.save(); c.translate(0, -d.h / 2 + 6);
        for (var ti = 0; ti < 5; ti++) { c.save(); c.rotate(ti / 5 * TAU); c.beginPath(); c.ellipse(0, -12, 6, 14, 0, 0, TAU); c.fillStyle = '#4FAE5E'; c.fill(); ink(c, 2.5); c.restore(); }
        c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fillStyle = '#3E9B54'; c.fill(); ink(c, 2.5); c.restore();
      }
      if (k === 'onion') { c.save(); c.translate(0, -d.h / 2); c.beginPath(); c.moveTo(-8, 4); c.quadraticCurveTo(0, -22, 8, 4); c.closePath(); c.fillStyle = '#C9A26E'; c.fill(); ink(c, 2.5); c.restore(); }
      if (k === 'banana') { c.fillStyle = '#8A5A2B'; c.beginPath(); c.ellipse(-d.len / 2 + 6, 0, 7, 10, 0, 0, TAU); c.ellipse(d.len / 2 - 6, 0, 7, 10, 0, 0, TAU); c.fill(); }
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
      c.beginPath(); c.ellipse(0, d.h / 2 + 8, d.len / 2, 12, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.15)'; c.fill();
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
        c.beginPath(); rr(c, 50, 120, 540, 360, 34); c.fillStyle = 'rgba(42,35,64,.15)'; c.save(); c.translate(0, 10); c.fill(); c.restore();
        rr(c, 50, 120, 540, 360, 34); c.fillStyle = '#F2C48D'; c.fill(); ink(c, 5);
        c.strokeStyle = '#E0AD72'; c.lineWidth = 4;
        for (var y = 160; y < 460; y += 46) { c.beginPath(); c.moveTo(90, y); c.quadraticCurveTo(320, y + 12, 550, y); c.stroke(); }
        c.beginPath(); c.arc(548, 160, 14, 0, TAU); c.fillStyle = '#FFE3CC'; c.fill(); ink(c, 4);
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
  /* pickled sushi ginger: a little pile of thin, wavy, pale pink slices */
  function gingerSlice(c, x, y, rx, ry, rot, seed) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath();
    for (var i = 0; i <= 24; i++) {
      var th = i / 24 * TAU, w = 1 + 0.12 * Math.sin(th * 3 + seed) + 0.06 * Math.sin(th * 5 + seed * 2);
      c.lineTo(Math.cos(th) * rx * w, Math.sin(th) * ry * w);
    }
    c.closePath(); c.fillStyle = 'rgba(255,214,222,.92)'; c.fill();
    c.strokeStyle = '#D9839A'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = 'rgba(232,140,165,.6)'; c.lineWidth = 1.5;
    for (var k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(-rx * 0.6, k * ry * 0.35); c.quadraticCurveTo(0, k * ry * 0.35 + 4, rx * 0.6, k * ry * 0.3); c.stroke(); }
    c.restore();
  }
  function drawGinger(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    gingerSlice(c, -9, 4, 22, 14, 0.4, 1);
    gingerSlice(c, 9, 2, 21, 13, -0.5, 2);
    gingerSlice(c, 0, -8, 20, 13, 0.1, 3);
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
  function drawJug(c, x, y, a, liquid, level) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(36, -30); c.quadraticCurveTo(70, -26, 66, 4); c.quadraticCurveTo(62, 30, 34, 28);
    c.strokeStyle = INK; c.lineWidth = 16; c.lineCap = 'round'; c.stroke(); c.strokeStyle = '#FFFFFF'; c.lineWidth = 8; c.stroke();
    c.beginPath(); c.moveTo(-40, -52); c.lineTo(-52, -66); c.lineTo(-28, -60); c.lineTo(38, -60); c.lineTo(34, 50); c.quadraticCurveTo(0, 62, -34, 50); c.closePath();
    c.fillStyle = '#FFFFFF'; c.fill();
    c.save(); c.clip(); c.fillStyle = liquid; c.fillRect(-60, lerp(-46, 52, 1 - level), 120, 140); c.restore();
    c.beginPath(); c.moveTo(-40, -52); c.lineTo(-52, -66); c.lineTo(-28, -60); c.lineTo(38, -60); c.lineTo(34, 50); c.quadraticCurveTo(0, 62, -34, 50); c.closePath();
    ink(c, 5);
    c.fillStyle = '#3FA7F5'; c.beginPath(); c.arc(-4, 6, 9, 0, TAU); c.arc(16, -10, 6, 0, TAU); c.fill();
    c.restore();
  }
  function jugMouth(x, y, a) { return { x: x + Math.cos(a) * -52 - Math.sin(a) * -66, y: y + Math.sin(a) * -52 + Math.cos(a) * -66 }; }

  /* ---- Step 1: mix the batter ---- */
  function BatterScene() {
    var cx = 320, cy = 300, RX = 214, RY = 64, rx = 186, ry = 50;
    var phase = 'milk', milk = 0, holding = false, jugT = 0, whisk = 0, spin = 0, lastAng = null, tool = null, speed = 0, done = false, tickAcc = 0;
    var EB = { x: 566, y: 552 }, eggs = [{ x: 545, y: 520, rot: -0.25, state: 'wait', t: 0 }, { x: 589, y: 516, rot: 0.25, state: 'wait', t: 0 }], yolks = [];
    var pourLoop = Sound.loop('pour'), slosh = Sound.loop('stir');
    var REST = { x: 560, y: 210 }, POUR = { x: 470, y: 160 };
    var rnd = seeded(13), flour = [];
    for (var i = 0; i < 160; i++) { var r = Math.sqrt(rnd()), th = rnd() * TAU; flour.push({ x: Math.cos(th) * r * 92, y: Math.sin(th) * r * 30 - (1 - r) * 22 }); }

    function jugPos() { var k = easeOut(jugT); return { x: lerp(REST.x, POUR.x, k), y: lerp(REST.y, POUR.y, k), a: lerp(0, -1.7, k) }; }
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
      enter: function () { say('Hold the jug to pour milk'); },
      leave: function () { pourLoop.stop(); slosh.stop(); },
      hint: function (t) {
        if (phase === 'milk') return { x: REST.x, y: REST.y + 10, press: (t % 1.4) < 0.9 };
        if (phase === 'eggs') { var e = eggs.filter(function (q) { return q.state === 'wait'; })[0]; return e ? { x: e.x, y: e.y, press: (t % 1.2) < 0.5 } : null; }
        if (phase === 'whisk' && !done) { var a = t * 2.6; return { x: cx + Math.cos(a) * 130, y: cy + 8 + Math.sin(a) * 45, press: true }; }
        return null;
      },
      down: function (p) {
        if (phase === 'milk') { if (dist(p, REST) < 110 || dist(p, jugPos()) < 110) holding = true; }
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
        jugT += ((holding && phase === 'milk' ? 1 : 0) - jugT) * Math.min(1, dt * 7);
        if (phase === 'milk') {
          var pouring = holding && jugT > 0.75;
          if (pouring) milk = Math.min(1, milk + dt * 0.45);
          pourLoop.set(pouring ? 0.8 : 0);
          if (milk >= 1) { phase = 'eggs'; holding = false; pourLoop.set(0); Sound.pop(); say('Tap the eggs to crack them'); }
        }
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
        c.beginPath(); c.ellipse(EB.x, EB.y + 34, 62, 12, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.15)'; c.fill();
        c.beginPath(); c.ellipse(EB.x, EB.y, 64, 18, 0, 0, TAU); c.fillStyle = '#FFE7C2'; c.fill(); ink(c, 4.5);
        eggs.forEach(function (e) { if (e.state === 'wait') drawEgg(c, e.x, e.y, e.rot, 0); });
        c.beginPath(); c.moveTo(EB.x - 64, EB.y); c.bezierCurveTo(EB.x - 64, EB.y + 46, EB.x + 64, EB.y + 46, EB.x + 64, EB.y);
        c.bezierCurveTo(EB.x + 40, EB.y + 14, EB.x - 40, EB.y + 14, EB.x - 64, EB.y); c.closePath();
        c.fillStyle = '#FF9F6B'; c.fill(); ink(c, 4.5);
        // bowl (same shape as the rice bowl, in blue)
        c.beginPath(); c.ellipse(cx, cy + 230, 150, 22, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
        c.beginPath(); c.ellipse(cx, cy + 214, 96, 20, 0, 0, TAU); c.fillStyle = '#2E86C9'; c.fill(); ink(c, 5);
        c.beginPath(); c.moveTo(cx - RX, cy); c.bezierCurveTo(cx - RX, cy + 180, cx - 110, cy + 216, cx, cy + 216);
        c.bezierCurveTo(cx + 110, cy + 216, cx + RX, cy + 180, cx + RX, cy); c.closePath(); c.fillStyle = '#5EB7F0'; c.fill(); ink(c, 5);
        c.save(); c.clip(); c.strokeStyle = '#FFFFFF'; c.lineWidth = 8;
        for (var k = 0; k < 3; k++) { c.beginPath(); c.ellipse(cx, cy + 34 + k * 38, RX + 4, 52 - k * 6, 0, 0.08, Math.PI - 0.08); c.stroke(); }
        c.restore();
        c.beginPath(); c.ellipse(cx, cy, RX, RY, 0, 0, TAU); c.fillStyle = '#DDF0FF'; c.fill(); ink(c, 5);
        // milk / batter
        if (milk > 0) {
          c.beginPath(); c.ellipse(cx, cy + 8, rx * (0.4 + 0.6 * Math.sqrt(milk)), ry * (0.4 + 0.6 * Math.sqrt(milk)), 0, 0, TAU);
          c.fillStyle = mixHex('#FBF8F1', BATTER, easeOut(whisk)); c.fill();
        }
        // flour mound melts away as you whisk
        if (whisk < 1) {
          c.save(); c.globalAlpha = 1 - whisk; c.translate(cx, cy + 6); c.scale(1 - whisk * 0.6, 1 - whisk * 0.6);
          c.beginPath(); c.ellipse(0, -6, 96, 34, 0, Math.PI, 0); c.quadraticCurveTo(80, 12, 0, 12); c.quadraticCurveTo(-80, 12, -96, -6); c.fillStyle = '#FFFFFF'; c.fill();
          c.fillStyle = '#EDE6D6'; flour.forEach(function (f) { c.fillRect(f.x, f.y - 6, 2, 2); });
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
        // milk jug
        if (phase === 'milk' || jugT > 0.02) {
          var j = jugPos();
          if (holding && jugT > 0.75 && phase === 'milk') {
            var m = jugMouth(j.x, j.y, j.a);
            c.beginPath(); c.moveTo(m.x, m.y);
            for (var yy3 = m.y; yy3 < cy + 10; yy3 += 8) c.lineTo(m.x + Math.sin(yy3 * 0.12 + performance.now() / 60) * 2.5, yy3);
            c.strokeStyle = 'rgba(250,250,255,.95)'; c.lineWidth = 10; c.lineCap = 'round'; c.stroke();
          }
          drawJug(c, j.x, j.y, j.a, '#EAF3FF', 1 - milk * 0.8);
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
        if (phase === 'whisk') {
          c.beginPath(); c.arc(cx, cy - 150, 34, -Math.PI / 2, -Math.PI / 2 + TAU * whisk); c.strokeStyle = '#7BD389'; c.lineWidth = 12; c.lineCap = 'round'; c.stroke();
          c.beginPath(); c.arc(cx, cy - 150, 34, 0, TAU); c.strokeStyle = 'rgba(42,35,64,.15)'; c.lineWidth = 12; c.stroke();
          c.save(); c.translate(cx, cy - 150); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); ink(c, 3.5);
          c.fillStyle = INK; c.font = '800 22px ' + getComputedStyle(document.body).getPropertyValue('--display');
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(done ? '✓' : Math.round(whisk * 100) + '', 0, 1); c.restore();
        }
        if (tool && !done) drawWhisk(c, tool);
      }
    };
  }

  /* How brown a pancake got depends on when it was flipped */
  var TONES = {
    pale: { c1: '#FBEAB6', c2: '#EFD08C', edge: '#F7E4AE', side: '#E4BE76', spots: 'rgba(255,255,255,.45)' },
    perfect: { c1: '#EDB15E', c2: '#D99140', edge: '#F2C27A', side: '#D38A3E', spots: 'rgba(255,230,170,.5)' },
    burnt: { c1: '#7E4826', c2: '#4E2A13', edge: '#8E5832', side: '#4E2A12', spots: 'rgba(25,12,5,.55)' }
  };
  function cakeInfo(q) { return typeof q === 'number' ? { r: q, tone: 'perfect' } : { r: q.r, tone: q.tone || 'perfect' }; }

  /* Top-down pancake in the pan. side: 0 = batter side up, 1 = cooked side up. burn: 0..1 darkening edge while cooking */
  function drawPanPancake(c, x, y, r, cook, side, holes, tone, burn) {
    c.save(); c.translate(x, y);
    if (side) {
      var T = TONES[tone || 'perfect'];
      var g = c.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
      g.addColorStop(0, T.c1); g.addColorStop(0.75, T.c2); g.addColorStop(1, T.edge);
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = g; c.fill(); ink(c, 4);
      c.fillStyle = T.spots; var sr = seeded(31);
      for (var i = 0; i < 9; i++) { c.beginPath(); c.arc((sr() - 0.5) * r * 1.2, (sr() - 0.5) * r * 1.2, 3 + sr() * 5, 0, TAU); c.fill(); }
    } else {
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = mixHex('#F8E6B0', '#F0D08A', cook); c.fill();
      var edge = burn > 0 ? mixHex('#D99A48', '#4E2A13', burn) : mixHex('#F3D995', '#D99A48', cook);
      c.lineWidth = 6 + cook * 4 + burn * 8; c.strokeStyle = edge; c.stroke(); ink(c, 3.5);
      c.fillStyle = 'rgba(200,140,60,.6)';
      (holes || []).forEach(function (h) { c.beginPath(); c.arc(h.x * r, h.y * r, h.r, 0, TAU); c.fill(); });
    }
    c.restore();
  }

  /* Side view of a short stack, used on the little plate and the decorate step */
  function drawStackCake(c, x, y, rx, ry, th, tone) {
    var T = TONES[tone || 'perfect'];
    c.beginPath(); c.moveTo(x - rx, y - th); c.lineTo(x - rx, y); c.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); c.lineTo(x + rx, y - th); c.closePath();
    c.fillStyle = T.side; c.fill(); ink(c, 4);
    c.beginPath(); c.moveTo(x - rx + 6, y - th * 0.35); c.ellipse(x, y - th * 0.35, Math.max(1, rx - 6), Math.max(1, ry - 4), 0, Math.PI, 0, true); c.strokeStyle = 'rgba(255,220,160,.5)'; c.lineWidth = 3; c.stroke();
    var g = c.createRadialGradient(x - rx * 0.2, y - th - ry * 0.3, 4, x, y - th, rx);
    g.addColorStop(0, T.c1); g.addColorStop(1, T.c2);
    c.beginPath(); c.ellipse(x, y - th, rx, ry, 0, 0, TAU); c.fillStyle = g; c.fill(); ink(c, 4);
    if (tone === 'burnt') { c.fillStyle = 'rgba(20,10,5,.5)'; var sr = seeded(Math.round(rx)); for (var i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (sr() - 0.5) * rx * 1.2, y - th + (sr() - 0.5) * ry, 3 + sr() * 3, 0, TAU); c.fill(); } }
  }

  /* ---- Step 2: cook and flip ---- */
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

    function drawGauge(c, t) {
      var x0 = PX - 165, w = 330, y = 62, h = 34;
      var z1 = w * T_OK / T_MAX, z2 = w * T_BURN / T_MAX;
      c.save(); rr(c, x0, y, w, h, 12); c.clip();
      c.fillStyle = '#F7E4AE'; c.fillRect(x0, y, z1, h);
      c.fillStyle = '#7BD389'; c.fillRect(x0 + z1, y, z2 - z1, h);
      c.fillStyle = '#7E4826'; c.fillRect(x0 + z2, y, w - z2, h);
      c.restore();
      rr(c, x0, y, w, h, 12); ink(c, 3.5);
      c.save(); c.translate(x0 + (z1 + z2) / 2, y + h / 2); c.fillStyle = '#FFFFFF'; star(c, 12); c.fill(); c.restore();
      var mx = x0 + w * clamp(t / T_MAX, 0, 1);
      c.beginPath(); c.moveTo(mx, y - 4); c.lineTo(mx - 10, y - 18); c.lineTo(mx + 10, y - 18); c.closePath(); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(mx, y - 2); c.lineTo(mx, y + h + 2); c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
    }

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
        // pan
        c.beginPath(); c.ellipse(PX + 6, PY + 16, PR2 + 8, PR2 * 0.98, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.2)'; c.fill();
        c.save(); c.translate(PX, PY); c.rotate(2.39);
        rr(c, PR2 - 20, -16, 190, 32, 16); c.fillStyle = '#2A2340'; c.fill();
        rr(c, PR2 + 60, -11, 100, 22, 11); c.fillStyle = '#FF6B57'; c.fill(); ink(c, 3.5);
        c.restore();
        c.beginPath(); c.arc(PX, PY, PR2, 0, TAU); c.fillStyle = '#3B3F4A'; c.fill(); ink(c, 5);
        c.beginPath(); c.arc(PX, PY, PR2 - 18, 0, TAU); c.fillStyle = '#4C5260'; c.fill();
        c.beginPath(); c.arc(PX, PY, PR2 - 30, -2.6, -1.6); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 10; c.lineCap = 'round'; c.stroke();
        // side plate with the finished stack
        c.beginPath(); c.ellipse(SIDE.x, SIDE.y + 10, 76, 26, 0, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 4);
        for (var i = 0; i < made; i++) { var ci = cakeInfo(dish.cakes[i]), sc = ci.r / 145; drawStackCake(c, SIDE.x, SIDE.y - i * 13, 58 * sc, 17 * sc, 12, ci.tone); }
        if (cake) {
          var cookAmt = cake.phase === 'pour' ? 0 : cake.phase === 'cook1' ? Math.min(1, cake.t / T_OK) : 1;
          var burn = cake.phase === 'cook1' ? clamp((cake.t - T_BURN) / 2, 0, 1) : 0;
          if (cake.phase === 'cook1') drawGauge(c, cake.t);
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

  /* ---- Step 4: decorate the stack ---- */
  var SX = 320, SY0 = 430, SRX = 172, SRY = 50, STH = 28;
  /* the stack uses the size of each pancake that was poured (bottom one first) */
  function stackOf(d) {
    var rs = d && d.cakes && d.cakes.length ? d.cakes : [145, 140, 144], jit = [0, -6, 5];
    return rs.map(function (q, k) { var ci = cakeInfo(q), f = clamp(ci.r / 145, 0.42, 1.05); return { dx: jit[k % 3], rx: SRX * f, ry: SRY * f, tone: ci.tone }; });
  }
  function stackTop(d) { var st = stackOf(d || dish), t = st[st.length - 1]; return { x: SX + t.dx, y: SY0 - st.length * STH, rx: t.rx, ry: t.ry }; }
  function onStackTop(p, pad) { var t = stackTop(); var nx = (p.x - t.x) / (t.rx - (pad || 0)), ny = (p.y - t.y) / (t.ry - (pad || 0) * 0.3); return nx * nx + ny * ny < 1; }
  var PLATE2 = { x: 320, y: 470, rx: 270, ry: 92 };

  function drawButter(c, x, y) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.ellipse(0, 6, 34, 12, 0, 0, TAU); c.fillStyle = 'rgba(255,233,140,.75)'; c.fill();
    c.beginPath(); c.moveTo(-24, -4); c.lineTo(-24, 6); c.lineTo(0, 16); c.lineTo(24, 6); c.lineTo(24, -4); c.lineTo(0, 6); c.closePath(); c.fillStyle = '#F2D66B'; c.fill(); ink(c, 3);
    c.beginPath(); c.moveTo(-24, -4); c.lineTo(0, -14); c.lineTo(24, -4); c.lineTo(0, 6); c.closePath(); c.fillStyle = '#FFF3A6'; c.fill(); ink(c, 3);
    c.restore();
  }
  function drawTopping(c, t) {
    if (t.kind === 'butter') drawButter(c, t.x, t.y);
    else { c.save(); c.translate(t.x, t.y); c.scale(1.7, 1.2); drawMini(c, t.kind, 0, 0, t.a); c.restore(); }
  }

  function drawStackScene(c, d) {
    var pl = PLATES[d.plate];
    c.beginPath(); c.ellipse(PLATE2.x, PLATE2.y + 14, PLATE2.rx, PLATE2.ry, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.ellipse(PLATE2.x, PLATE2.y, PLATE2.rx, PLATE2.ry, 0, 0, TAU); c.fillStyle = pl.fill; c.fill(); ink(c, 5);
    c.beginPath(); c.ellipse(PLATE2.x, PLATE2.y + 4, PLATE2.rx - 40, PLATE2.ry - 18, 0, 0, TAU); c.strokeStyle = pl.rim; c.globalAlpha = 0.35; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = pl.rim;
    for (var i = 0; i < 28; i++) { var a = i / 28 * TAU; c.beginPath(); c.arc(PLATE2.x + Math.cos(a) * (PLATE2.rx - 20), PLATE2.y + Math.sin(a) * (PLATE2.ry - 8), 4, 0, TAU); c.fill(); }
    // plate toppings behind the stack
    d.tops.filter(function (t) { return !t.onTop && t.y < SY0; }).forEach(function (t) { drawTopping(c, t); });
    stackOf(d).forEach(function (s, k) { drawStackCake(c, SX + s.dx, SY0 - k * STH, s.rx, s.ry, STH, s.tone); });
    // syrup
    var top = stackTop(d);
    d.drips.forEach(function (dr) {
      c.beginPath(); c.moveTo(dr.x, dr.y); c.lineTo(dr.x, dr.y + dr.len);
      c.strokeStyle = 'rgba(168,88,20,.92)'; c.lineWidth = 12; c.lineCap = 'round'; c.stroke();
      c.beginPath(); c.arc(dr.x, dr.y + dr.len + 2, 8, 0, TAU); c.fillStyle = 'rgba(168,88,20,.92)'; c.fill();
    });
    c.save(); c.beginPath(); c.ellipse(top.x, top.y, top.rx + 2, top.ry + 2, 0, 0, TAU); c.clip();
    d.syrup.forEach(function (stroke) {
      if (stroke.length < 1) return;
      c.beginPath(); c.moveTo(stroke[0].x, stroke[0].y); stroke.forEach(function (q) { c.lineTo(q.x, q.y); });
      if (stroke.length === 1) c.lineTo(stroke[0].x + 0.1, stroke[0].y);
      c.strokeStyle = 'rgba(168,88,20,.9)'; c.lineWidth = 20; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
      c.strokeStyle = 'rgba(255,210,140,.55)'; c.lineWidth = 4; c.stroke();
    });
    c.restore();
    d.tops.filter(function (t) { return t.onTop; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (t) { drawTopping(c, t); });
    d.tops.filter(function (t) { return !t.onTop && t.y >= SY0; }).forEach(function (t) { drawTopping(c, t); });
    c.fillStyle = 'rgba(255,255,255,.95)';
    d.sugar.forEach(function (s) { c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill(); });
  }

  var PAN_TOOL_ICONS = {
    plate: TOOL_ICONS.plate,
    syrup: '<svg viewBox="0 0 40 40"><path d="M14 4 H26 V10 Q34 14 33 24 V34 Q33 37 30 37 H10 Q7 37 7 34 V24 Q6 14 14 10 Z" fill="#C8721F" stroke="#2A2340" stroke-width="3"/><rect x="12" y="2" width="16" height="6" rx="2" fill="#FF7EB6" stroke="#2A2340" stroke-width="2.5"/><path d="M13 22 Q20 17 27 22 Q20 30 13 22 Z" fill="#FFE29A"/></svg>',
    butter: '<svg viewBox="0 0 40 40"><path d="M6 18 L6 26 L20 34 L34 26 L34 18 L20 26 Z" fill="#F2D66B" stroke="#2A2340" stroke-width="2.5" stroke-linejoin="round"/><path d="M6 18 L20 10 L34 18 L20 26 Z" fill="#FFF3A6" stroke="#2A2340" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    strawberry: '<svg viewBox="0 0 40 40"><path d="M20 36 Q4 22 9 13 Q20 6 31 13 Q36 22 20 36 Z" fill="#FF5A6A" stroke="#2A2340" stroke-width="3"/><path d="M20 30 Q11 22 14 17 Q20 13 26 17 Q29 22 20 30 Z" fill="#FFD0D6"/><path d="M12 11 Q20 2 28 11 Q20 8 12 11 Z" fill="#5CC46B" stroke="#2A2340" stroke-width="2"/></svg>',
    banana: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="#FFF4C2" stroke="#2A2340" stroke-width="3"/><circle cx="20" cy="20" r="5" fill="#F3E2A0"/><circle cx="18" cy="19" r="1.4" fill="#8A5A2B"/><circle cx="22" cy="19" r="1.4" fill="#8A5A2B"/><circle cx="20" cy="22.5" r="1.4" fill="#8A5A2B"/></svg>',
    sugar: '<svg viewBox="0 0 40 40"><rect x="10" y="12" width="20" height="24" rx="6" fill="#FFFFFF" stroke="#2A2340" stroke-width="3"/><path d="M12 12 Q20 2 28 12 Z" fill="#9EDCFF" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><g fill="#9AA6B2"><circle cx="16" cy="9" r="1.2"/><circle cx="20" cy="7" r="1.2"/><circle cx="24" cy="9" r="1.2"/></g></svg>'
  };
  var PAN_TOOL_SAY = { syrup: 'Drag to pour syrup', butter: 'Tap to add butter', strawberry: 'Tap to add strawberries', banana: 'Tap to add banana', sugar: 'Drag to dust icing sugar' };

  function DecorateScene() {
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
    function overStackSide(p) { var st = stackOf(dish), w = Math.max.apply(null, st.map(function (q) { return q.rx; })); return Math.abs(p.x - SX) < w && p.y > SY0 - st.length * STH && p.y < SY0 + SRY; }
    function place(kind, p, max) {
      var top = onStackTop(p, 16);
      if (!top && (!onPlate(p) || overStackSide(p))) return false;
      var list = dish.tops.filter(function (t) { return t.kind === kind; });
      hist.now();
      if (list.length >= max) dish.tops.splice(dish.tops.indexOf(list[0]), 1);
      dish.tops.push({ kind: kind, x: p.x, y: p.y, a: (Math.random() - 0.5) * 1.2, onTop: top });
      return true;
    }
    function addSyrup(p) {
      if (!onStackTop(p, 10)) { lastSyrup = null; return; }
      if (!lastSyrup) { lastSyrup = []; dish.syrup.push(lastSyrup); }
      var last = lastSyrup[lastSyrup.length - 1];
      if (last && dist(last, p) < 6) return;
      if (dish.syrup.reduce(function (n, s) { return n + s.length; }, 0) > 500) return;
      lastSyrup.push({ x: p.x, y: p.y }); changed = true;
      var t = stackTop(), nx = (p.x - t.x) / t.rx, ny = (p.y - t.y) / t.ry;
      if (ny > 0.1 && nx * nx + ny * ny > 0.5 && dish.drips.length < 16 && Math.random() < 0.25) {
        var ex = t.x + nx / Math.hypot(nx, ny) * t.rx * 0.98, ey = t.y + ny / Math.hypot(nx, ny) * t.ry * 0.98;
        dish.drips.push({ x: ex, y: ey, len: 0, max: 25 + Math.random() * 45 });
      }
    }
    return {
      enter: function () {
        toolsEl.innerHTML = ['plate', 'syrup', 'butter', 'strawberry', 'banana', 'sugar'].map(function (t) {
          var lbl = { plate: 'Plate', syrup: 'Syrup', butter: 'Butter', strawberry: 'Berry', banana: 'Banana', sugar: 'Sugar' }[t];
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
        say('Decorate your pancakes!');
        showNext('Done', finishDish);
        setUndo({ canUndo: hist.canUndo, undo: function () { if (hist.undo()) { falling.length = 0; lastSyrup = null; say('Undone'); } } });
      },
      leave: function () { pourLoop.stop(); toolsEl.innerHTML = ''; },
      hint: function (t) {
        if (actions > 0 || dish.syrup.length) return null;
        var k = (t % 2) / 2, top = stackTop();
        return { x: top.x - 110 + k * 220, y: top.y + Math.sin(k * TAU) * 22, press: true };
      },
      down: function (p) {
        down = true; pointer = p; lastSyrup = null;
        if (tool === 'syrup' || tool === 'sugar') { hist.begin(); changed = false; }
        if (tool === 'syrup') addSyrup(p);
        if (tool === 'butter' && place('butter', p, 3)) { Sound.plop(); countAction(); }
        if (tool === 'strawberry' && place('strawberry', p, 16)) { Sound.pop(); countAction(); }
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
          if (s.y >= s.land) { falling.splice(j, 1); if (onStackTop(s, 0) || onPlate(s)) { dish.sugar.push({ x: s.x, y: s.y, r: s.r }); if (dish.sugar.length % 60 === 0) countAction(); } }
        }
      },
      draw: function (c) {
        drawStackScene(c, dish);
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
  var PATTY_TONES = {
    rare: { top: '#C4707A', side: '#B5606A', spots: 'rgba(255,190,200,.55)' },
    perfect: { top: '#7A4425', side: '#6A3A1E', spots: 'rgba(160,100,60,.6)' },
    burnt: { top: '#3A2015', side: '#2E190F', spots: 'rgba(10,5,2,.6)' }
  };

  /* top-down patty in the pan. cooked: tone of the side facing up, or null if raw. edge: 0..1 browning, burn: 0..1 */
  function drawPattyTop(c, x, y, r, cooked, edge, burn) {
    c.save(); c.translate(x, y);
    c.beginPath();
    for (var i = 0; i <= 28; i++) { var a = i / 28 * TAU, w = 1 + 0.035 * Math.sin(a * 7) + 0.02 * Math.sin(a * 11); c.lineTo(Math.cos(a) * r * w, Math.sin(a) * r * w); }
    c.closePath();
    if (cooked) {
      var T = PATTY_TONES[cooked];
      c.fillStyle = T.top; c.fill(); ink(c, 4);
      c.save(); c.clip(); c.strokeStyle = 'rgba(30,15,8,.55)'; c.lineWidth = 9;
      for (var k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(-r, k * 30 - 20); c.lineTo(r, k * 30 + 20); c.stroke(); }
      c.restore();
      c.fillStyle = T.spots; var sr = seeded(17);
      for (var s = 0; s < 14; s++) { c.beginPath(); c.arc((sr() - 0.5) * r * 1.3, (sr() - 0.5) * r * 1.3, 2 + sr() * 3, 0, TAU); c.fill(); }
    } else {
      c.fillStyle = '#E37C86'; c.fill();
      c.lineWidth = 6 + edge * 10 + burn * 6; c.strokeStyle = burn > 0 ? mixHex('#8A5030', '#2E190F', burn) : mixHex('#E37C86', '#8A5030', edge); c.stroke();
      ink(c, 3.5);
      c.fillStyle = 'rgba(255,220,225,.7)'; var mr = seeded(23);
      for (var m = 0; m < 22; m++) { c.beginPath(); c.arc((mr() - 0.5) * r * 1.4, (mr() - 0.5) * r * 1.4, 2 + mr() * 2.5, 0, TAU); c.fill(); }
    }
    c.restore();
  }

  /* ---- Step 1: cook the patty, both sides ---- */
  function GrillScene() {
    var PX = 290, PY = 300, PR2 = 180, R = 112;
    var T_OK = 2.6, T_BURN = 5.4, T_MAX = 8;
    var SIDE = { x: 548, y: 560 };
    var phase = 'wait', t = 0, fly = 0, flip = 0, side = 1, tones = [], said = 0, swipe = null, offT = 0;
    var sizzle = Sound.loop('sizzle');

    function grade(tt) { return tt < T_OK ? 'rare' : tt <= T_BURN ? 'perfect' : 'burnt'; }
    function drawGauge(c) {
      var x0 = PX - 165, w = 330, y = 62, h = 34, z1 = w * T_OK / T_MAX, z2 = w * T_BURN / T_MAX;
      c.save(); rr(c, x0, y, w, h, 12); c.clip();
      c.fillStyle = '#F2A3AB'; c.fillRect(x0, y, z1, h); c.fillStyle = '#7BD389'; c.fillRect(x0 + z1, y, z2 - z1, h); c.fillStyle = '#3A2015'; c.fillRect(x0 + z2, y, w - z2, h);
      c.restore(); rr(c, x0, y, w, h, 12); ink(c, 3.5);
      c.save(); c.translate(x0 + (z1 + z2) / 2, y + h / 2); c.fillStyle = '#FFFFFF'; star(c, 12); c.fill(); c.restore();
      var mx = x0 + w * clamp(t / T_MAX, 0, 1);
      c.beginPath(); c.moveTo(mx, y - 4); c.lineTo(mx - 10, y - 18); c.lineTo(mx + 10, y - 18); c.closePath(); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(mx, y - 2); c.lineTo(mx, y + h + 2); c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
    }
    function swipeDone() {
      var g = grade(t);
      tones.push(g);
      if (g === 'perfect') { Cat.show(side === 1 ? 'Perfect flip!' : 'Juicy!'); burst(PX, PY, 14, { colors: ['#FFC93C', '#FFFFFF'], speed: 200, life: 0.7 }); }
      if (side === 1) { phase = 'flip'; flip = 0; Sound.whoosh(); buzz(15); }
      else { phase = 'off'; offT = 0; Sound.whoosh(); }
      say(g === 'perfect' ? 'Nicely browned!' : g === 'rare' ? 'Too early! Still pink.' : 'Oops, a bit burnt!');
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
        if (phase === 'off') {
          offT = Math.min(1, offT + dt * 1.6);
          if (offT >= 1) {
            phase = 'done'; Sound.plop();
            dish.patty = tones.indexOf('burnt') >= 0 ? 'burnt' : tones.indexOf('rare') >= 0 ? 'rare' : 'perfect';
            Sound.chime();
            if (dish.patty === 'perfect') { Cat.show('Juicy burger!'); say('Perfectly cooked!'); }
            else say(dish.patty === 'rare' ? 'A bit pink inside!' : 'A little crispy!');
            showNext('Next', nextStep);
          }
        }
      },
      draw: function (c) {
        c.beginPath(); c.ellipse(PX + 6, PY + 16, PR2 + 8, PR2 * 0.98, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.2)'; c.fill();
        c.save(); c.translate(PX, PY); c.rotate(2.39);
        rr(c, PR2 - 20, -16, 190, 32, 16); c.fillStyle = '#2A2340'; c.fill();
        rr(c, PR2 + 60, -11, 100, 22, 11); c.fillStyle = '#3FA7F5'; c.fill(); ink(c, 3.5);
        c.restore();
        c.beginPath(); c.arc(PX, PY, PR2, 0, TAU); c.fillStyle = '#3B3F4A'; c.fill(); ink(c, 5);
        c.beginPath(); c.arc(PX, PY, PR2 - 18, 0, TAU); c.fillStyle = '#4C5260'; c.fill();
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 6;
        for (var g = -3; g <= 3; g++) { var gx = PX + g * 40, hh = Math.sqrt(Math.max(0, (PR2 - 24) * (PR2 - 24) - (g * 40) * (g * 40))); c.beginPath(); c.moveTo(gx, PY - hh); c.lineTo(gx, PY + hh); c.stroke(); }
        // side plate with the bun waiting
        c.beginPath(); c.ellipse(SIDE.x, SIDE.y + 10, 80, 26, 0, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 4);
        var showBun = phase === 'off' || phase === 'done';
        if (showBun || phase === 'wait' || phase === 'fly') {
          if (showBun) drawBunBottom(c, SIDE.x, SIDE.y + 4, 0.42);
        }
        if (phase === 'cook') drawGauge(c);
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
        } else if (phase === 'off') {
          var k2 = easeOut(offT); c.save(); c.translate(lerp(PX, SIDE.x, k2), lerp(PY, SIDE.y - 14, k2) - Math.sin(k2 * Math.PI) * 90); c.scale(lerp(1, 0.5, k2), lerp(1, 0.3, k2));
          drawPattyTop(c, 0, 0, R, tones[1] || tones[0], 1, 0); c.restore();
        } else if (phase === 'done') {
          drawLayer(c, { kind: 'patty', tone: dish.patty }, SIDE.x, SIDE.y - 10, 0.42);
        }
      }
    };
  }

  /* ---- burger layers, side view. (x, y) is the bottom centre of the layer; returns the layer height ---- */
  var LAYER_H = { patty: 40, lettuce: 20, tomato: 16, cheese: 9, onion: 13, ketchup: 8, mustard: 7 };
  function drawBunBottom(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.moveTo(-150, -34); c.lineTo(150, -34); c.quadraticCurveTo(156, 0, 120, 4); c.lineTo(-120, 4); c.quadraticCurveTo(-156, 0, -150, -34); c.closePath();
    c.fillStyle = '#E3A057'; c.fill(); ink(c, 5);
    rr(c, -150, -40, 300, 16, 8); c.fillStyle = '#F7DDA8'; c.fill(); ink(c, 4);
    c.restore();
  }
  function drawBunTop(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -152, -16, 304, 18, 9); c.fillStyle = '#F7DDA8'; c.fill(); ink(c, 4);
    c.beginPath(); c.moveTo(-156, -10); c.bezierCurveTo(-160, -120, 160, -120, 156, -10); c.closePath();
    var g = c.createLinearGradient(0, -100, 0, -10); g.addColorStop(0, '#F2B866'); g.addColorStop(1, '#D98E3E');
    c.fillStyle = g; c.fill(); ink(c, 5);
    c.beginPath(); c.ellipse(-50, -70, 50, 12, -0.2, 0, TAU); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill();
    var sr = seeded(41); c.fillStyle = '#FFF4D6';
    for (var i = 0; i < 16; i++) { var a = sr() * Math.PI, rx = 130 * Math.cos(a) * (0.3 + 0.7 * sr()), ry = -20 - 70 * Math.sin(a) * (0.4 + 0.6 * sr()); c.beginPath(); c.ellipse(rx, ry, 5, 3, sr() * 2, 0, TAU); c.fill(); }
    c.restore();
  }
  function drawLayer(c, L, x, y, s) {
    s = s || 1;
    c.save(); c.translate(x, y); c.scale(s, s);
    var k = L.kind;
    if (k === 'patty') {
      var T = PATTY_TONES[L.tone || 'perfect'];
      c.beginPath(); c.moveTo(-148, -40);
      for (var i = 0; i <= 20; i++) c.lineTo(-148 + i * 14.8, -40 - (i % 2 ? 4 : 0));
      c.quadraticCurveTo(162, -20, 148, 0); c.lineTo(-148, 0); c.quadraticCurveTo(-162, -20, -148, -40); c.closePath();
      c.fillStyle = T.side; c.fill(); ink(c, 5);
      c.fillStyle = T.spots; var sr = seeded(13);
      for (var j = 0; j < 22; j++) { c.beginPath(); c.arc(-140 + sr() * 280, -34 + sr() * 30, 2 + sr() * 3, 0, TAU); c.fill(); }
    } else if (k === 'lettuce') {
      // soft, ruffled leaf edges: smooth waves, drooping a little over the sides
      var droop = function (x) { var o = Math.abs(x) - 130; return o > 0 ? o * 0.45 : 0; };
      c.beginPath();
      for (var a = 0; a <= 80; a++) { var lx = -172 + a * 4.3; var tip = Math.max(0, Math.abs(lx) - 156); c.lineTo(lx, -15 - 6 * Math.sin(lx / 11) - 2.5 * Math.sin(lx / 4.7 + 1) + droop(lx) + tip * 1.1); }
      for (var b = 80; b >= 0; b--) { var bx = -172 + b * 4.3; c.lineTo(bx, 2 + 4 * Math.sin(bx / 17 + 1) + droop(bx) * 1.2); }
      c.closePath(); c.fillStyle = '#7BD389'; c.fill(); ink(c, 4);
      c.beginPath();
      for (var v = 0; v <= 60; v++) { var vx = -150 + v * 5; c.lineTo(vx, -8 - 2.5 * Math.sin(vx / 11) + droop(vx) * 1.1); }
      c.strokeStyle = '#B8EBA8'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
    } else if (k === 'tomato') {
      [-92, 0, 92].forEach(function (tx, n) {
        rr(c, tx - 52, -16 + (n === 1 ? -2 : 0), 104, 16, 8); c.fillStyle = '#FF4D3D'; c.fill(); ink(c, 3.5);
        rr(c, tx - 42, -12 + (n === 1 ? -2 : 0), 84, 7, 3.5); c.fillStyle = '#FF9A80'; c.fill();
      });
    } else if (k === 'cheese') {
      c.beginPath(); c.moveTo(-158, -9); c.lineTo(158, -9); c.lineTo(158, 0); c.lineTo(132, 0); c.lineTo(120, 22); c.lineTo(108, 0); c.lineTo(-104, 0); c.lineTo(-120, 26); c.lineTo(-132, 0); c.lineTo(-158, 0); c.closePath();
      c.fillStyle = '#FFC93C'; c.fill(); ink(c, 3.5);
    } else if (k === 'onion') {
      [-100, -34, 34, 100].forEach(function (ox) {
        c.beginPath(); c.ellipse(ox, -6, 34, 6, 0, 0, TAU); c.strokeStyle = INK; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#F7F0E3'; c.lineWidth = 4; c.stroke();
        c.beginPath(); c.ellipse(ox, -6, 34, 6, 0, 0, TAU); c.strokeStyle = 'rgba(181,87,155,.5)'; c.lineWidth = 1.5; c.stroke();
      });
    } else if (k === 'ketchup' || k === 'mustard') {
      var col = k === 'ketchup' ? '#E8322B' : '#F2C200';
      // a smooth, wavy squeeze line
      c.beginPath();
      for (var z = 0; z <= 70; z++) { var zx = -140 + z * 4; c.lineTo(zx, -6 - 5 * Math.sin(zx / 13 + (k === 'mustard' ? 1.6 : 0))); }
      c.strokeStyle = INK; c.lineWidth = 11; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.strokeStyle = col; c.lineWidth = 6; c.stroke();
      if (k === 'ketchup') { [-80, 30, 110].forEach(function (dx) { c.beginPath(); c.moveTo(dx - 5, -2); c.quadraticCurveTo(dx, 18, dx + 5, -2); c.fillStyle = col; c.fill(); }); }
    }
    c.restore();
  }

  var BX = 320, BY = 548;
  function drawBurgerScene(c, d, extra) {
    extra = extra || {};
    var pl = PLATES[d.plate];
    c.beginPath(); c.ellipse(BX, BY + 14, 270, 70, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.ellipse(BX, BY, 270, 70, 0, 0, TAU); c.fillStyle = pl.fill; c.fill(); ink(c, 5);
    c.beginPath(); c.ellipse(BX, BY + 2, 228, 52, 0, 0, TAU); c.strokeStyle = pl.rim; c.globalAlpha = 0.35; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1;
    drawBunBottom(c, BX, BY - 4, 1);
    var y = BY - 44;
    var layers = [{ kind: 'patty', tone: d.patty }].concat(d.layers);
    layers.forEach(function (L, i) {
      var drop = L.t !== undefined ? easeBack(L.t) : 1;
      var yy = y - (1 - drop) * 260;
      if (drop > 0) { c.save(); c.globalAlpha = Math.min(1, drop * 2 + 0.2); drawLayer(c, L, BX + (L.dx || 0), yy); c.restore(); }
      y -= LAYER_H[L.kind] || 12;
    });
    if (d.topBun) { var tb = d.topBunT !== undefined ? easeBack(d.topBunT) : 1; drawBunTop(c, BX, y + 2 - (1 - tb) * 300); }
    return y;
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

  /* ---- Step 3: build it, any toppings, any order ---- */
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
          later(0.9, finishDish);
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
    var img = snapshot();
    var prog = GG.getProgress('cooking');
    prog.made = (prog.made || 0) + 1;
    prog.book = Array.isArray(prog.book) ? prog.book : [];
    prog.book.unshift({ dish: recipe.id, at: Date.now(), img: img });
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
    setTimeout(function () { if (mode === 'finish') Cat.show('Great job!', 3000); }, 500);
  }

  /* ---------- recipes ---------- */
  var ICONS = {
    rice: '<svg viewBox="0 0 24 24"><path d="M3 11 H21 Q20 20 12 20 Q4 20 3 11 Z" fill="#FF7E6B" stroke="#2A2340" stroke-width="2"/><path d="M5 11 Q12 4 19 11" fill="#fff" stroke="#2A2340" stroke-width="2"/></svg>',
    chop: '<svg viewBox="0 0 24 24"><path d="M4 18 L16 6 L19 9 L8 20 Z" fill="#E3E9F0" stroke="#2A2340" stroke-width="2" stroke-linejoin="round"/><rect x="15" y="2" width="5" height="8" rx="2" transform="rotate(45 17.5 6)" fill="#FF6B57" stroke="#2A2340" stroke-width="2"/></svg>',
    roll: '<svg viewBox="0 0 24 24"><g transform="rotate(-22 12 12)"><path d="M16 6.5 H6 A3 5.5 0 0 0 6 17.5 H16 Z" fill="#2E4A3A" stroke="#2A2340" stroke-width="2" stroke-linejoin="round"/><ellipse cx="16" cy="12" rx="4.2" ry="5.5" fill="#2E4A3A" stroke="#2A2340" stroke-width="2"/><ellipse cx="16" cy="12" rx="3" ry="4.2" fill="#fff"/><circle cx="16" cy="11" r="1.3" fill="#FF8A5B"/><circle cx="16.3" cy="13.4" r="1.1" fill="#4FAE5E"/></g></svg>',
    plate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#fff" stroke="#2A2340" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="#3FA7F5" stroke-width="2"/></svg>',
    mix: '<svg viewBox="0 0 24 24"><rect x="10.5" y="1" width="3" height="8" rx="1.5" fill="#FF7EB6" stroke="#2A2340" stroke-width="1.5"/><ellipse cx="12" cy="15" rx="6" ry="8" fill="none" stroke="#2A2340" stroke-width="2"/><ellipse cx="12" cy="15" rx="3" ry="8" fill="none" stroke="#9AA6B2" stroke-width="1.6"/></svg>',
    cook: '<svg viewBox="0 0 24 24"><rect x="15" y="11" width="9" height="3.5" rx="1.7" fill="#2A2340"/><circle cx="10" cy="12.5" r="8" fill="#3B3F4A" stroke="#2A2340" stroke-width="2"/><circle cx="10" cy="12.5" r="5" fill="#F2C46D"/></svg>',
    decorate: '<svg viewBox="0 0 24 24"><g stroke="#2A2340" stroke-width="1.6"><ellipse cx="12" cy="18" rx="9" ry="3" fill="#D38A3E"/><ellipse cx="12" cy="14" rx="9" ry="3" fill="#DE9A48"/><ellipse cx="12" cy="10" rx="9" ry="3" fill="#F2C06C"/></g><path d="M8 9 Q12 12 16 9" stroke="#A85814" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="12" cy="6" r="2.6" fill="#FF5A6A" stroke="#2A2340" stroke-width="1.4"/></svg>'
  };
  var RECIPE_DEFS = {
    handroll: {
      id: 'handroll', name: 'Sushi Handroll', title: 'Sushi hand roll!',
      steps: [
        { name: 'Rice', icon: ICONS.rice, make: function () { return RiceScene(); } },
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
        { name: 'Cook', icon: ICONS.cook, make: function () { return PanScene(); } },
        { name: 'Chop', icon: ICONS.chop, make: function () { return ChopScene(['banana', 'strawberry'], nextStep); } },
        { name: 'Decorate', icon: ICONS.decorate, make: function () { return DecorateScene(); } }
      ],
      draw: function (c, d) { drawStackScene(c, d); }, frame: { x: 320, y: 420, span: 556 }
    }
  };
  ICONS.grill = '<svg viewBox="0 0 24 24"><rect x="15" y="11" width="9" height="3.5" rx="1.7" fill="#2A2340"/><circle cx="10" cy="12.5" r="8" fill="#3B3F4A" stroke="#2A2340" stroke-width="2"/><circle cx="10" cy="12.5" r="5" fill="#7A4425"/><path d="M7 10 L13 15 M7 13 L11 16.5" stroke="#2E190F" stroke-width="1.5"/></svg>';
  ICONS.build = '<svg viewBox="0 0 24 24"><path d="M3 11 Q12 0 21 11 Z" fill="#E9A85A" stroke="#2A2340" stroke-width="1.6"/><path d="M2 13 Q6 11 9 13 Q12 11 15 13 Q18 11 22 13" fill="none" stroke="#4FB868" stroke-width="2.5"/><rect x="3" y="14" width="18" height="4" rx="2" fill="#7A4425" stroke="#2A2340" stroke-width="1.4"/><rect x="3" y="18.5" width="18" height="3.5" rx="1.7" fill="#E3A057" stroke="#2A2340" stroke-width="1.4"/></svg>';
  RECIPE_DEFS.burger = {
    id: 'burger', name: 'Burger', title: 'Burger!',
    steps: [
      { name: 'Cook', icon: ICONS.grill, make: function () { return GrillScene(); } },
      { name: 'Chop', icon: ICONS.chop, make: function () { return ChopScene(['tomato', 'onion'], nextStep); } },
      { name: 'Build', icon: ICONS.build, make: function () { return BuildScene(); } }
    ],
    draw: function (c, d) { drawBurgerScene(c, d); }, frame: { x: 320, y: 410, span: 540 }
  };
  var recipe = RECIPE_DEFS.handroll;
  var scene = null, stepIdx = -1, hintT = 0, idle = 0, pointerId = null;

  function renderSteps() {
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
    { id: 'burger', name: 'Burger', ready: true }
  ];
  var RECIPE_ART = {
    handroll: '<svg viewBox="10 8 220 147"><ellipse cx="120" cy="122" rx="100" ry="22" fill="#fff" stroke="#2A2340" stroke-width="4"/><ellipse cx="120" cy="119" rx="74" ry="12" fill="#FFE3EC"/><g transform="rotate(-14 120 90)"><path d="M168 62 H70 A17 28 0 0 0 70 118 H168 Z" fill="#2E4A3A" stroke="#2A2340" stroke-width="4" stroke-linejoin="round"/><rect x="62" y="69" width="100" height="8" rx="4" fill="#3D6450"/><ellipse cx="168" cy="90" rx="17.5" ry="28" fill="#2E4A3A" stroke="#2A2340" stroke-width="4"/><ellipse cx="168" cy="90" rx="14.5" ry="23.5" fill="#fff"/><rect x="160" y="77" width="11" height="9" rx="2" fill="#FF8A5B" stroke="#2A2340" stroke-width="2"/><rect x="168" y="88" width="7" height="8" rx="1.5" fill="#4FAE5E" stroke="#2A2340" stroke-width="2"/><ellipse cx="164" cy="98" rx="6" ry="4" fill="#C8E26F" stroke="#2A2340" stroke-width="2"/></g><ellipse cx="178" cy="125" rx="18" ry="7" fill="#fff" stroke="#2A2340" stroke-width="3"/><ellipse cx="178" cy="124.5" rx="11.5" ry="4" fill="#5A2A12"/></svg>',
    pancakes: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="102" rx="78" ry="15" fill="#fff" stroke="#2A2340" stroke-width="4"/><g stroke="#2A2340" stroke-width="3.5"><path d="M36 86 V94 A54 13 0 0 0 144 94 V86 Z" fill="#D38A3E"/><ellipse cx="90" cy="86" rx="54" ry="13" fill="#DE9A48"/><path d="M34 72 V80 A54 13 0 0 0 142 80 V72 Z" fill="#D38A3E"/><ellipse cx="88" cy="72" rx="54" ry="13" fill="#E3A552"/><path d="M38 58 V66 A54 13 0 0 0 146 66 V58 Z" fill="#D38A3E"/><ellipse cx="92" cy="58" rx="54" ry="13" fill="#F2C06C"/></g><path d="M62 56 Q76 64 92 56 Q108 50 120 60" fill="none" stroke="#A85814" stroke-width="6" stroke-linecap="round"/><path d="M130 62 V74" stroke="#A85814" stroke-width="5" stroke-linecap="round"/><path d="M80 52 L80 47 L94 43 L104 47 L104 52 L94 56 Z" fill="#FFF3A6" stroke="#2A2340" stroke-width="2.5" stroke-linejoin="round"/><path d="M66 60 Q58 54 62 50 Q66 48 70 50 Q74 54 66 60 Z" fill="#FF5A6A" stroke="#2A2340" stroke-width="2"/><path d="M114 58 Q106 52 110 48 Q114 46 118 48 Q122 52 114 58 Z" fill="#FF5A6A" stroke="#2A2340" stroke-width="2"/></svg>',
    omurice: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="98" rx="78" ry="16" fill="#fff" stroke="#2A2340" stroke-width="4"/><path d="M30 90 Q30 36 90 34 Q150 36 150 90 Z" fill="#FFD84D" stroke="#2A2340" stroke-width="4"/><path d="M60 60 Q75 50 90 62 Q105 50 120 60" fill="none" stroke="#FF4D3D" stroke-width="6" stroke-linecap="round"/></svg>',
    burger: '<svg viewBox="0 0 180 120"><ellipse cx="90" cy="104" rx="80" ry="13" fill="#fff" stroke="#2A2340" stroke-width="4"/><path d="M40 86 H140 Q144 98 128 100 H52 Q36 98 40 86 Z" fill="#E3A057" stroke="#2A2340" stroke-width="3.5"/><path d="M38 80 L142 80 Q150 90 138 88 L42 88 Q30 90 38 80 Z" fill="#6A3A1E" stroke="#2A2340" stroke-width="3.5"/><path d="M36 76 H144 V80 H136 L132 90 L128 80 H52 L47 92 L42 80 H36 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><rect x="44" y="68" width="34" height="8" rx="4" fill="#FF4D3D" stroke="#2A2340" stroke-width="2.5"/><rect x="102" y="68" width="34" height="8" rx="4" fill="#FF4D3D" stroke="#2A2340" stroke-width="2.5"/><path d="M34 66 Q40 60 46 66 Q52 60 58 66 Q64 60 70 66 Q76 60 82 66 Q88 60 94 66 Q100 60 106 66 Q112 60 118 66 Q124 60 130 66 Q136 60 146 66 L146 70 L34 70 Z" fill="#7BD389" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><path d="M36 62 Q34 22 90 20 Q146 22 144 62 Z" fill="#EBA65A" stroke="#2A2340" stroke-width="4"/><g fill="#FFF4D6"><ellipse cx="70" cy="36" rx="3" ry="2"/><ellipse cx="92" cy="30" rx="3" ry="2"/><ellipse cx="112" cy="38" rx="3" ry="2"/><ellipse cx="80" cy="48" rx="3" ry="2"/><ellipse cx="104" cy="50" rx="3" ry="2"/></g></svg>',
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
        ? '<button class="recipe hero" type="button" data-id="' + r.id + '">' + RECIPE_ART[r.id] + '<span>' + r.name + '</span><small>' + RECIPE_DEFS[r.id].steps.map(function (st) { return st.name; }).join(' \u00b7 ') + '</small></button>'
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
        return '<button class="entry" type="button" data-i="' + i + '" aria-label="Open ' + esc(nm) + ' from ' + esc(niceDate(e.at)) + '"><figure>' + (e.img ? '<img alt="" src="' + esc(e.img) + '">' : '') + '<figcaption>' + esc(niceDate(e.at, true)) + '</figcaption></figure></button>';
      }).join('')
      : '<p class="empty">Dishes you make will show up here.</p>';
    $('book').querySelectorAll('.entry').forEach(function (b) {
      b.addEventListener('click', function () { Sound.init(); Sound.pop(); openViewer(+b.dataset.i); });
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
  window.__kitchen = { goStep: function (i, id) { if (id) recipe = RECIPE_DEFS[id]; if (!dish) dish = newDish(); showScreen('play'); goStep(i); }, finish: function () { finishDish(); } };
})();
