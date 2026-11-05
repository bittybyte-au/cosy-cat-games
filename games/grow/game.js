/* Grow – a little potting shed. Pick a pot and a seed, scoop in soil, plant it, water it, pick a flower colour
   and tap the sun to grow it. Grown plants are saved (games/grow/plants.js) and show up in Cosy Home to display.
   More seeds unlock as you grow more plants. Nothing to win or lose. */
(function () {
  'use strict';

  var INK = GGDraw.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GP = window.GGPlants;
  var FLOWER = GP.FLOWER, POTS = GP.POTS, PLANTS = GP.PLANTS;
  var drawPot = GP.drawPot, drawPlant = GP.drawPlant, soil = GP.soil, potLip = GP.potLip, leaf = GP.leaf;
  var P = GP.load();
  /* Toddler mode (set on the games page): pick a pot, pick a plant, and it pops up fully grown with a sparkle.
     Only seeds already open are shown; no soil, watering or waiting. Same save, so it lands in Cosy Home. */
  var TODDLER = false;
  try { TODDLER = !!(GG.getSetting && GG.getSetting('toddler', false)); } catch (e) {}
  if (TODDLER) document.body.classList.add('toddler');

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  var D = window.GGDraw, rr = D.rr, ink = D.ink;
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function findDef(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* ================= sound ================= */
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
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
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
    return {
      init: init,
      isOn: function () { return on; },
      setOn: function (v) { on = v; if (GG.setSetting) GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      pick: function () { tone({ f: 600, to: 820, dur: 0.07, gain: 0.08, type: 'triangle', slide: 0.05 }); },
      place: function () { tone({ f: 300, to: 180, dur: 0.1, gain: 0.16 }); noise({ type: 'lowpass', freq: 600, dur: 0.05, gain: 0.08 }); },
      putAway: function () { tone({ f: 700, to: 420, dur: 0.1, gain: 0.07, type: 'triangle' }); },
      pop: function () { tone({ f: 420, to: 920, dur: 0.11, gain: 0.14, slide: 0.06 }); },
      scoop: function () { noise({ type: 'lowpass', freq: 380, q: 1, attack: 0.01, dur: 0.12, gain: 0.25 }); },
      drip: function () { tone({ f: rand(900, 1400), to: rand(400, 600), dur: 0.05, gain: 0.04 }); },
      poke: function () { noise({ type: 'lowpass', freq: 300, dur: 0.06, gain: 0.2 }); tone({ f: 500, to: 300, dur: 0.06, gain: 0.06, type: 'triangle' }); },
      grow: function (i) { var f = [523.25, 659.25, 783.99, 1046.5][Math.min(3, i)]; tone({ f: f * 0.7, to: f, dur: 0.14, gain: 0.1, slide: 0.08 }); },
      chime: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 }); tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' }); }); },
      purr: function () { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.22, delay: i * 0.085 }); },
      mrrp: function () { var p = rand(0.9, 1.2); tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', delay: 0.1, slide: 0.12 }); },
      brush: function () { noise({ freq: 1600, q: 0.6, attack: 0.04, dur: 0.18, gain: 0.08 }); }
    };
  })();


  /* ================= layout: one screen-sized bench ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var topbar = $('topbar'), growbar = $('growbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, LAY = { W: 1000, H: 640 };
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var bottom = growbar.getBoundingClientRect().top - 8;
    document.documentElement.style.setProperty('--bar-h', Math.round(ch - growbar.getBoundingClientRect().top) + 'px');
    var availW = cw - 16, availH = Math.max(120, bottom - top);
    LAY = availW / availH < 1.05 ? { W: 600, H: 880 } : { W: 1000, H: 640 };
    K = Math.min(availW / LAY.W, availH / LAY.H);
    OX = (cw - LAY.W * K) / 2; OY = top + (availH - LAY.H * K) / 2;
  }
  function toBench(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  var parts = [], time = 0;
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.5, 0.9), r: rand(4, 8), color: Math.random() < 0.4 ? '#fff' : color, kind: Math.random() < 0.5 ? 'star' : 'dot', spin: rand(-5, 5) });
    }
  }
  function heart(x, y) { parts.push({ x: x, y: y, vx: rand(-20, 20), vy: -70, life: 0, max: 1.2, r: 12, color: '#FF7EB6', kind: 'heart', g: -10 }); }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y); c.rotate(p.kind === 'heart' ? 0 : p.life * p.spin);
      if (p.kind === 'star') star(c, p.r * 1.3);
      else if (p.kind === 'heart') { c.beginPath(); c.moveTo(0, p.r * 0.4); c.bezierCurveTo(-p.r * 1.2, -p.r * 0.4, -p.r * 0.5, -p.r * 1.2, 0, -p.r * 0.5); c.bezierCurveTo(p.r * 0.5, -p.r * 1.2, p.r * 1.2, -p.r * 0.4, 0, p.r * 0.4); }
      else { c.beginPath(); c.arc(0, 0, p.r * 0.6, 0, TAU); }
      c.fillStyle = p.color; c.fill();
      if (p.kind === 'heart') ink(c, 2);
      c.restore();
    });
  }

  /* small pictures for the choices */
  var thumbCache = {};
  function thumb(fn, w, h, px) {
    px = px || 132;
    var cv = document.createElement('canvas'); cv.width = cv.height = px;
    var c = cv.getContext('2d');
    var k = Math.min((px * 0.86) / w, (px * 0.86) / h);
    c.translate(px / 2, px / 2 + (h * k) / 2); c.scale(k, k);
    fn(c);
    return cv.toDataURL('image/png');
  }
  /* the little shelf of grown plants along the top of the choices bar */
  function renderShelf() {
    P = GP.load();
    var n = P.plants.length;
    $('grownCount').textContent = n ? n + (n === 1 ? ' plant grown' : ' plants grown') : '';
  }

  /* ================= the potting bench ================= */
  var grow = null;
  function seedsUnlocked() { return GP.seedsFor(P.grown); }
  function bench() {
    // positions on the bench, in room units for the current layout
    var tall = LAY.W < 700, W = LAY.W, H = LAY.H;
    var top = tall ? H * 0.66 : H * 0.7;
    // the sun is outside, seen through the window, so the window is wide enough to show it whole
    var win = tall ? { x: W * 0.14, y: H * 0.07, w: W * 0.72, h: H * 0.27 } : { x: W * 0.08, y: H * 0.08, w: W * 0.42, h: H * 0.3 };
    return {
      top: top, pot: { x: W * 0.5, y: top }, win: win,
      bag: { x: tall ? W * 0.17 : W * 0.2, y: top }, can: { x: tall ? W * 0.84 : W * 0.8, y: top },
      sun: { x: win.x + win.w / 2, y: win.y + win.h * 0.42 }
    };
  }
  var STEPS = {
    pot: 'Pick a pot', seed: 'Pick a seed', soil: 'Tap the soil bag to fill the pot', plant: 'Tap the pot to plant the seed',
    water: 'Drag the watering can over the pot', colour: 'Pick a flower colour', sun: 'Tap the sun to help it grow!', done: 'Ta-da!'
  };
  function startGrow() {
    grow = { step: 'pot', pot: -1, t: null, col: Math.floor(Math.random() * FLOWER.length), soil: 0, seed: false, water: 0, g: 0, anim: 0, can: null, canHeld: false, scoops: [], drops: [] };
    $('cardWrap').hidden = true;
    setStep('pot');
  }
  $('againBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); startGrow(); });

  function setStepChoicesOff() { $('choices').innerHTML = ''; $('choices').hidden = true; layout(); }
  function setStep(step) {
    grow.step = step;
    $('stepLabel').textContent = STEPS[step];
    var box = $('choices'), html = '';
    if (step === 'pot') POTS.forEach(function (p, i) { html += '<button class="choice" type="button" data-pot="' + i + '" aria-label="Pot ' + (i + 1) + '"><img alt="" src="' + potThumb(i) + '"></button>'; });
    else if (step === 'seed') PLANTS.forEach(function (p) {
      var ok = P.grown >= p.grown;
      if (TODDLER && !ok) return;
      html += '<button class="choice' + (ok ? '' : ' locked') + '" type="button" data-seed="' + p.id + '" aria-label="' + p.name + (ok ? '' : ': grow ' + (p.grown - P.grown) + ' more plants to unlock') + '"><img alt="" src="' + seedThumb(p.id) + '">' +
        (ok ? '' : '<span class="lock"><svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="2" fill="#2A2340"/><path d="M5 7 V5 A3 3 0 0 1 11 5 V7" fill="none" stroke="#2A2340" stroke-width="2"/></svg></span>') + '</button>';
    });
    else if (step === 'colour') FLOWER.forEach(function (col, i) { html += '<button class="choice swatch" type="button" data-col="' + i + '" style="background:' + col + '" aria-label="Colour ' + (i + 1) + '"></button>'; });
    box.innerHTML = html;
    box.hidden = !html;
    layout();
  }
  function potThumb(i) { var k = 'pot' + i; if (!thumbCache[k]) thumbCache[k] = thumb(function (c) { drawPot(c, i, 92); }, 104, 60); return thumbCache[k]; }
  function seedThumb(id) {
    var k = 'seed' + id;
    if (!thumbCache[k]) thumbCache[k] = thumb(function (c) {
      // a little seed packet showing the plant
      rr(c, -46, -120, 92, 120, 10); c.fillStyle = '#FFF3E4'; c.fill(); ink(c, 4);
      c.beginPath(); c.moveTo(-46, -104); c.lineTo(46, -104); c.lineWidth = 3; c.strokeStyle = INK; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
      c.save(); c.translate(0, -8); c.scale(0.5, 0.5); drawPlant(c, { t: id, col: 0, id: 0 }, 1, 0); c.restore();
    }, 100, 128);
    return thumbCache[k];
  }
  $('choices').addEventListener('click', function (e) {
    var b = e.target.closest('.choice'); if (!b || !grow) return;
    Sound.init();
    if (b.dataset.pot !== undefined) { grow.pot = +b.dataset.pot; grow.anim = 0; Sound.place(); setStep('seed'); }
    else if (b.dataset.seed) {
      var p = findDef(PLANTS, b.dataset.seed);
      if (P.grown < p.grown) { Sound.mrrp(); var n = p.grown - P.grown; say('Grow ' + n + ' more plant' + (n > 1 ? 's' : '') + ' to unlock this!', 2); return; }
      grow.t = p.id; Sound.pop();
      if (TODDLER) {
        // straight to a fully grown plant, in a colour of its own
        grow.soil = 3; grow.seed = true; grow.water = 1; grow.col = Math.floor(Math.random() * FLOWER.length);
        grow.step = 'growing'; grow.g = 0.62; $('stepLabel').textContent = ''; setStepChoicesOff();
        var B0 = bench(); sparkle(B0.pot.x, B0.pot.y - 100, '#7CC4FF', 10, 0.9);
        return;
      }
      setStep('soil');
    }
    else if (b.dataset.col !== undefined) { grow.col = +b.dataset.col; Sound.pop(); setStep('sun'); }
  });

  function growDown(e) {
    if (!grow) return;
    var r = toBench(e.clientX, e.clientY), B = bench();
    if (grow.step === 'soil' && Math.hypot(r.x - B.bag.x, r.y - (B.bag.y - 60)) < 90) {
      if (grow.soil + grow.scoops.length >= 3) return;
      grow.scoops.push({ t: 0 }); Sound.scoop(); buzz(6);
    } else if (grow.step === 'plant' && Math.abs(r.x - B.pot.x) < 70 && r.y > B.pot.y - 130 && r.y < B.pot.y + 10) {
      grow.seed = true; grow.poke = 0.5; Sound.poke(); buzz(10);
      sparkle(B.pot.x, B.pot.y - 60, '#8B5A3C', 6, 0.5);
      setTimeout(function () { if (grow && grow.step === 'plant') setStep('water'); }, 450);
    } else if (grow.step === 'water' && Math.hypot(r.x - (grow.can ? grow.can.x : B.can.x + 20), r.y - (grow.can ? grow.can.y : B.can.y - 35)) < 90) {
      grow.canHeld = e.pointerId; grow.can = { x: r.x, y: r.y };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      Sound.pick();
    } else if (grow.step === 'sun' && Math.hypot(r.x - B.sun.x, r.y - B.sun.y) < 90) {
      grow.step = 'growing'; grow.anim = 0; $('stepLabel').textContent = 'Growing…'; Sound.pop();
      sparkle(B.sun.x, B.sun.y, '#FFE14D', 12, 1.2);
    }
  }
  function growMove(e) {
    if (!grow || grow.canHeld !== e.pointerId) return;
    var r = toBench(e.clientX, e.clientY);
    grow.can = { x: r.x, y: r.y };
  }
  function growUp(e) { if (grow && grow.canHeld === e.pointerId) { grow.canHeld = false; } }

  function updateGrow(dt) {
    var B = bench();
    grow.anim += dt;
    // soil scoops fly from the bag into the pot
    grow.scoops = grow.scoops.filter(function (s) {
      s.t += dt / 0.45;
      if (s.t >= 1) { grow.soil++; Sound.place(); if (grow.soil >= 3 && grow.step === 'soil') setStep('plant'); return false; }
      return true;
    });
    if (grow.poke > 0) grow.poke -= dt;
    // watering: when the spout is over the pot
    if (grow.step === 'water' && grow.can && grow.canHeld !== false) {
      var spoutX = grow.can.x - 70, over = Math.abs(spoutX - B.pot.x) < 60 && grow.can.y < B.pot.y - 40;
      grow.pouring = over;
      if (over) {
        grow.water = Math.min(1, grow.water + dt / 1.6);
        if (Math.random() < dt * 30) { grow.drops.push({ x: spoutX + rand(-6, 6), y: grow.can.y - 10, vy: 60 }); }
        if (Math.random() < dt * 8) Sound.drip();
        if (grow.water >= 1) {
          grow.canHeld = false; grow.pouring = false; grow.can = null;
          sparkle(B.pot.x, B.pot.y - 70, '#7CC4FF', 8, 0.6); Sound.pop();
          setStep(findDef(PLANTS, grow.t).colour ? 'colour' : 'sun');
        }
      }
    } else grow.pouring = false;
    grow.drops = grow.drops.filter(function (d) { d.vy += 900 * dt; d.y += d.vy * dt; return d.y < B.pot.y - 52; });
    // growing after the sun is tapped
    if (grow.step === 'growing') {
      var before = grow.g;
      grow.g = Math.min(1, grow.g + dt / (reduceMotion || TODDLER ? 0.6 : 2.2));
      [0.25, 0.5, 0.75, 0.98].forEach(function (m, i) { if (before < m && grow.g >= m) { Sound.grow(i); sparkle(B.pot.x + rand(-40, 40), B.pot.y - 60 - grow.g * 120, FLOWER[grow.col], 5, 0.6); } });
      if (grow.g >= 1) finishGrow();
    }
  }
  function finishGrow() {
    grow.step = 'done';
    $('stepLabel').textContent = STEPS.done;
    P = GP.load();
    var before = seedsUnlocked().length;
    var pl = { id: P.next++, t: grow.t, pot: grow.pot, col: grow.col };
    P.plants.push(pl);
    if (P.plants.length > 60) P.plants.shift();
    P.grown++;
    GP.save(P);
    if (GG.stat) GG.stat('grow', 'plants', 1);
    Sound.chime(); buzz(30);
    var B = bench(); sparkle(B.pot.x, B.pot.y - 120, '#FFD23F', 16, 1.2);
    var d = findDef(PLANTS, pl.t);
    var unlocked = seedsUnlocked();
    var gotNew = unlocked.length > before ? unlocked[unlocked.length - 1] : null;
    setTimeout(function () {
      $('cardImg').src = thumb(function (c) { GP.drawPotted(c, pl, 1, 0); }, 110, d.h + 64, 400);
      $('cardTitle').textContent = 'You grew ' + d.grew + '!';
      $('cardNote').textContent = (gotNew ? 'New seed unlocked: ' + gotNew.name + '! ' : '') + 'It\u2019s waiting in your Cosy Home.';
      $('cardWrap').hidden = false;
      $('againBtn').focus();
      renderShelf();
    }, 900);
  }

  /* ---------- curtains for the window: two tied-back curtains on a rod (copied into each game that has a window) ---------- */
  var curtainTiles = {};
  function curtainTile(st) {
    var key = st.pat + st.col + st.col2;
    if (curtainTiles[key]) return curtainTiles[key];
    var cv = document.createElement('canvas'); cv.width = cv.height = 28;
    var c = cv.getContext('2d');
    c.fillStyle = st.col; c.fillRect(0, 0, 28, 28);
    c.fillStyle = st.col2;
    if (st.pat === 'gingham') { c.globalAlpha = 0.55; c.fillRect(0, 0, 14, 28); c.fillRect(0, 0, 28, 14); c.globalAlpha = 1; }
    else if (st.pat === 'stripes') { c.fillRect(0, 0, 10, 28); }
    else if (st.pat === 'dots') { c.beginPath(); c.arc(7, 7, 4, 0, Math.PI * 2); c.arc(21, 21, 4, 0, Math.PI * 2); c.fill(); }
    else if (st.pat === 'stars') {
      [[7, 8], [21, 22]].forEach(function (q) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 2.4 : 5.5; c.lineTo(q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r); } c.closePath(); c.fill(); });
    }
    return (curtainTiles[key] = cv);
  }
  function drawCurtains(c, x, y, w, h, st) {
    var pad = Math.min(26, w * 0.12), top = y - 12, bot = y + h + 14, cwid = w * 0.28 + pad;
    var fill = c.createPattern(curtainTile(st), 'repeat');
    [-1, 1].forEach(function (side) {
      var xo = side < 0 ? x - pad : x + w + pad;           // the outer edge
      var xi = xo - side * cwid;                           // the inner edge at the top
      var tieX = xo - side * cwid * 0.38, tieY = y + h * 0.6;
      c.beginPath();
      c.moveTo(xo, top); c.lineTo(xi, top);
      c.quadraticCurveTo(xi, y + h * 0.4, tieX, tieY);
      c.quadraticCurveTo(xo - side * cwid * 0.5, tieY + (bot - tieY) * 0.5, xo - side * cwid * 0.72, bot);
      c.lineTo(xo, bot); c.closePath();
      c.fillStyle = fill; c.fill(); ink(c, 3.5);
      // a couple of soft folds
      c.strokeStyle = 'rgba(42,35,64,.22)'; c.lineWidth = 3;
      [0.3, 0.62].forEach(function (f) { var fx = xo - side * cwid * f; c.beginPath(); c.moveTo(fx, top + 4); c.quadraticCurveTo(fx + side * cwid * 0.12, y + h * 0.35, tieX + side * cwid * (f - 0.3) * 0.4, tieY - 4); c.stroke(); });
      // the tie
      c.save(); c.translate(tieX + side * cwid * 0.18, tieY); c.rotate(side * 0.25);
      rr(c, -cwid * 0.3, -6, cwid * 0.6, 12, 6); c.fillStyle = st.tie; c.fill(); ink(c, 3);
      c.restore();
    });
    // the rod with round ends
    rr(c, x - pad - 14, top - 9, w + pad * 2 + 28, 10, 5); c.fillStyle = st.rod; c.fill(); ink(c, 3);
    [x - pad - 16, x + w + pad + 16].forEach(function (rx) { c.beginPath(); c.arc(rx, top - 4, 8, 0, Math.PI * 2); c.fillStyle = st.rod; c.fill(); ink(c, 3); });
  }

  function drawBench(c) {
    var B = bench(), W = LAY.W, H = LAY.H, win = B.win;
    // a sunny garden shed: striped wall, and a window looking out at the sun
    c.fillStyle = '#E3F4D9'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#D2EBC4'; for (var x = 0; x < W; x += 50) c.fillRect(x, 0, 24, B.top);
    var pane = D.rrPath(win.x, win.y, win.w, win.h, 14);
    D.shape(c, pane, D.tone(c, '#9EDCFF', win.y, win.y + win.h), { lw: 4, depth: 0, inside: function (c) {
      // the sun (the tap target in the sun step), rising from behind a hill outside
      var sunPulse = grow.step === 'sun' ? 1 + Math.sin(time * 5) * 0.08 : 1;
      c.save(); c.translate(B.sun.x, B.sun.y); c.scale(sunPulse, sunPulse);
      c.strokeStyle = '#FFC93C'; c.lineWidth = 7; c.lineCap = 'round';
      for (var i = 0; i < 10; i++) { var a = i * TAU / 10 + time * 0.3; c.beginPath(); c.moveTo(Math.cos(a) * 52, Math.sin(a) * 52); c.lineTo(Math.cos(a) * 70, Math.sin(a) * 70); c.stroke(); }
      try { GGCat.draw(c, { preset: 'sun', face: grow.step === 'growing' || grow.step === 'done' ? 'happy' : 'open', size: 90 }); } catch (e) { circle(c, 0, 0, 44); c.fillStyle = '#FFC93C'; c.fill(); }
      c.restore();
      c.beginPath(); c.moveTo(win.x - 10, win.y + win.h * 0.82); c.quadraticCurveTo(win.x + win.w * 0.35, win.y + win.h * 0.62, win.x + win.w + 10, win.y + win.h * 0.8);
      c.lineTo(win.x + win.w + 10, win.y + win.h + 10); c.lineTo(win.x - 10, win.y + win.h + 10); c.closePath();
      c.fillStyle = D.tone(c, '#8FD88F', win.y + win.h * 0.62, win.y + win.h); c.fill(); D.ink(c, 3);
    } });
    // the sill
    D.shape(c, D.rrPath(win.x - 14, win.y + win.h - 4, win.w + 28, 16, 6), D.tone(c, '#FFF3E4', win.y + win.h - 4, win.y + win.h + 12), { lw: 4, depth: 3 });
    drawCurtains(c, win.x, win.y, win.w, win.h, { pat: 'gingham', col: '#FF6B57', col2: '#FFFFFF', tie: '#7BD389', rod: '#A86B3C' });
    // bench, with soft shadows on its top board under the things standing on it
    var restCan = { x: B.can.x + 20, y: B.can.y - 20 };
    c.fillStyle = D.tone(c, '#C9965F', B.top + 26, H); c.fillRect(0, B.top + 26, W, H - B.top - 26);
    [W * 0.12, W * 0.88].forEach(function (lx) { D.shape(c, D.rrPath(lx - 12, B.top + 20, 24, H - B.top - 10, 4), '#B57F4B', { lw: 3, depth: 4 }); });
    D.shape(c, D.rrPath(-10, B.top, W + 20, 26, 6), D.tone(c, '#E6B98A', B.top, B.top + 26), { lw: 4, depth: 5, inside: function (c) {
      D.shadow(c, B.bag.x + 4, B.top + 2, 56, 9);
      if (!grow.can) D.shadow(c, restCan.x, B.top + 2, 46, 8);
      if (grow.pot >= 0 && (grow.step !== 'seed' && grow.step !== 'pot' || grow.anim > 0.33)) D.shadow(c, B.pot.x + 4, B.top + 2, 56, 9);
    } });
    // soil bag: the soil at the back of the open top, then the bag in front of it
    c.save(); c.translate(B.bag.x, B.bag.y);
    var bagBounce = grow.step === 'soil' ? Math.sin(time * 6) * 3 : 0;
    c.translate(0, -bagBounce);
    D.shape(c, D.ellPath(0, -112, 40, 11), '#7A4E2D', { lw: 3, depth: 0 });
    D.shape(c, function (p) { p.moveTo(-50, 0); p.lineTo(-44, -110); p.quadraticCurveTo(0, -98, 44, -110); p.lineTo(50, 0); p.closePath(); },
      D.tone(c, '#C48A55', -110, 0), { lw: 4, depth: 9, inside: function (c) {
        D.shape(c, D.rrPath(-30, -76, 60, 40, 8), '#FFF3E4', { lw: 2.5, depth: 0 });
        c.save(); c.translate(0, -50); leaf(c, 0, 0, 18, -2.4, '#5CCB75'); leaf(c, 0, 0, 18, -0.7, '#5CCB75'); c.restore();
      } });
    c.restore();
    // watering can (resting on the bench, or held)
    var can = grow.can || restCan;
    var tilt = grow.pouring ? -0.55 : grow.canHeld !== false && grow.can ? -0.2 : 0;
    c.save(); c.translate(can.x, can.y); c.rotate(tilt);
    if (grow.step === 'water' && !grow.can) { c.globalAlpha = 0.4 + 0.3 * Math.sin(time * 5); circle(c, 0, -15, 80); c.fillStyle = '#fff'; c.fill(); c.globalAlpha = 1; }
    // the handle and spout start inside the body, which is drawn over their ends
    c.beginPath(); c.arc(10, -44, 26, Math.PI, 0); D.ink(c, 10); c.strokeStyle = '#7CC4FF'; c.lineWidth = 4; c.stroke();
    D.shape(c, function (p) { p.moveTo(-30, -6); p.lineTo(-88, -48); p.lineTo(-82, -56); p.lineTo(-26, -26); p.closePath(); }, '#7CC4FF', { lw: 3, depth: 0 });
    D.shape(c, D.rrPath(-90, -61, 16, 12, 4), '#3B8FD6', { lw: 2.5, depth: 0 });
    D.shape(c, D.rrPath(-40, -50, 80, 70, 14), D.tone(c, '#7CC4FF', -50, 20), { lw: 4, depth: 8, inside: function (c) {
      c.fillStyle = '#fff'; circle(c, -14, -18, 6); c.fill(); circle(c, 8, -10, 5); c.fill();
    } });
    c.restore();
    // water drops
    grow.drops.forEach(function (d) { ell(c, d.x, d.y, 4, 7); c.fillStyle = '#7CC4FF'; c.fill(); });
    // water meter
    if (grow.step === 'water' || grow.water > 0 && grow.step !== 'done' && grow.step !== 'growing' && grow.step !== 'sun' && grow.step !== 'colour') {
      rr(c, B.pot.x - 60, B.pot.y + 40, 120, 16, 8); c.fillStyle = '#fff'; c.fill(); ink(c, 3);
      rr(c, B.pot.x - 58, B.pot.y + 42, 116 * grow.water, 12, 6); c.fillStyle = '#7CC4FF'; c.fill();
    }
    // the pot and plant
    if (grow.pot >= 0) {
      var drop = easeBack(Math.min(1, grow.anim * 3));
      c.save(); c.translate(B.pot.x, lerp(B.pot.y - 160, B.pot.y, grow.step === 'seed' || grow.step === 'pot' ? drop : 1));
      var sq = grow.poke > 0 ? Math.sin(grow.poke / 0.5 * Math.PI) * 0.08 : 0;
      c.scale(1.35 + sq, 1.35 - sq);
      var pl = { t: grow.t || 'catnip', pot: grow.pot, col: grow.col, id: 1, seed: grow.seed };
      var potH = 92 * 0.62;
      drawPot(c, grow.pot, 92);
      soil(c, 92, Math.min(3, grow.soil) / 3);
      if (grow.seed && grow.g <= 0) { ell(c, 0, -potH + potH * 0.08, 5, 3.5); c.fillStyle = '#4A2E1A'; c.fill(); }
      if (grow.g > 0 || grow.seed) drawPlant(c, pl, grow.g, time);
      potLip(c, grow.pot, 92);
      c.restore();
      // a dotted target where the pot wants tapping
      if (grow.step === 'plant') { c.save(); c.setLineDash([8, 7]); c.lineDashOffset = -time * 20; circle(c, B.pot.x, B.pot.y - 56, 60); c.lineWidth = 4; c.strokeStyle = '#FFFFFF'; c.stroke(); c.restore(); }
    }
    // scoops of soil in the air
    grow.scoops.forEach(function (s) {
      var p = easeOut(s.t), x = lerp(B.bag.x, B.pot.x, p), y = lerp(B.bag.y - 120, B.pot.y - 70, p) - Math.sin(p * Math.PI) * 120;
      ell(c, x, y, 16, 10); c.fillStyle = '#7A4E2D'; c.fill(); ink(c, 2);
    });
    // a pulsing ring on the bag for the soil step
    if (grow.step === 'soil') { c.save(); c.setLineDash([8, 7]); c.lineDashOffset = -time * 20; circle(c, B.bag.x, B.bag.y - 60, 80); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); c.restore(); }
  }

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
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.pop(); });
  renderSound();

  /* ================= input ================= */
  canvas.addEventListener('pointerdown', function (e) { Sound.init(); growDown(e); });
  canvas.addEventListener('pointermove', growMove);
  canvas.addEventListener('pointerup', growUp);
  canvas.addEventListener('pointercancel', growUp);

  /* ================= main loop ================= */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 380) * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; }
    if (grow) updateGrow(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    rr(ctx, OX, OY, LAY.W * K, LAY.H * K, 22); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    if (grow) drawBench(ctx);
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, LAY.W * K, LAY.H * K, 22); ink(ctx, 5);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(growbar); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  renderShelf();
  startGrow();
  requestAnimationFrame(frame);

  /* test hook */
  window.__grow = {
    grow: function () { return grow ? { step: grow.step, soil: grow.soil, water: grow.water, g: grow.g } : null; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    bench: function () { return bench(); },
    saved: function () { return GP.load(); }
  };
})();
