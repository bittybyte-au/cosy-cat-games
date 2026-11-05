/* Kitten in a Box – a shell game. A kitten waves from one of the boxes, hops in, and the boxes slide about.
   Tap the box you think it's in. Found it: the kitten pops out happy and you go up a level. Not that one: that box
   is empty, the kitten peeks out of the right one, and you try the same level again (nothing is lost).
   Levels add swaps, speed and boxes (3, then 4, then 5); from level 3 the boxes are all the same colour.
   Saves GG.setProgress('kittenbox', { found, level, best }). */
(function () {
  'use strict';

  var D = window.GGDraw;
  var TAU = Math.PI * 2;
  var B = window.GGBoxes;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 640, TALL = false;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var aw = cw - 16, ah = Math.max(120, ch - top - 12);
    TALL = aw / ah < 1.05;
    W = TALL ? 600 : 1000; H = TALL ? clamp(Math.round(600 * ah / aw), 760, 1100) : clamp(Math.round(1000 * ah / aw), 560, 720);
    K = Math.min(aw / W, ah / H);
    OX = (cw - W * K) / 2; OY = top + (ah - H * K) / 2;
    if (typeof onLayout === 'function') onLayout();
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }
  var bits = B.bits();

  var P = (function () { var p = {}; try { p = GG.getProgress('kittenbox') || {}; } catch (e) {} if (typeof p.found !== 'number') p.found = 0; if (typeof p.level !== 'number') p.level = 1; if (typeof p.best !== 'number') p.best = p.level; return p; })();
  function save() { try { GG.setProgress('kittenbox', P); } catch (e) {} }

  var boxes = [], slots = [], kitten = 0, look = null, phase = 'show', pt = 0, round = 0, swaps = [], swap = null, time = 0, idleT = 0, picked = -1, lastLook = null;
  function boxW() { var n = boxes.length || 3; return TALL ? [0, 0, W * 0.4, W * 0.28, W * 0.21, W * 0.17][n] : [0, 0, 220, 220, 180, 150][n]; }
  function boxCount(l) { return l < 4 ? 3 : l < 8 ? 4 : 5; }
  function swapCount(l) { return Math.min(3 + l, 16); }
  function renderLevel() { $('levelLabel').textContent = 'Level ' + P.level; $('foundCount').textContent = P.found; }
  function onLayout() {
    var n = boxes.length || 2, w = boxW(), gapX = TALL ? (W - n * w) / (n + 1) : Math.min(90, (W - n * w) / (n + 1));
    slots = []; for (var i = 0; i < n; i++) slots.push(W / 2 + (i - (n - 1) / 2) * (w + gapX));
    boxes.forEach(function (b) { if (!swap || swap.a !== b && swap.b !== b) b.x = slots[b.slot]; b.w = w; });
  }
  function baseY() { return TALL ? H * 0.74 : H * 0.62 + (H - H * 0.62) * 0.55; }
  function newRound() {
    var n = boxCount(P.level), same = P.level >= 3;
    boxes = []; for (var i = 0; i < n; i++) boxes.push({ slot: i, x: 0, w: 0, open: 0, col: B.BOX_COLS[same ? 0 : i % B.BOX_COLS.length], lift: 0, wob: 0, empty: false });
    renderLevel();
    onLayout();
    kitten = Math.floor(Math.random() * n);
    do { look = pick(B.KITTEN_COLS); } while (look === lastLook); lastLook = look;
    var m = swapCount(P.level);
    swaps = []; var lastPair = '';
    for (var s = 0; s < m; s++) {
      var a, b2, key; do { a = Math.floor(Math.random() * n); b2 = Math.floor(Math.random() * n); key = Math.min(a, b2) + '-' + Math.max(a, b2); } while (a === b2 || (key === lastPair && n > 2));
      lastPair = key; swaps.push([a, b2]);
    }
    phase = 'show'; pt = 0; picked = -1; idleT = 0;
    Sound.open();
  }
  function boxInSlot(s) { for (var i = 0; i < boxes.length; i++) if (boxes[i].slot === s) return boxes[i]; return null; }
  function swapDur() { return Math.max(0.26, 0.7 - P.level * 0.04) * (swapLong ? 1.2 : 1); }
  var swapLong = false;

  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (phase !== 'pick') return;
    var r = toScene(e.clientX, e.clientY), y = baseY();
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (Math.abs(r.x - b.x) < b.w * 0.6 && r.y < y + 20 && r.y > y - b.w * 1.3) { choose(i); return; }
    }
  });
  function choose(i) {
    picked = i; idleT = 0;
    if (i === kitten) { phase = 'found'; pt = 0; Sound.open(); Sound.meow(); buzz(25); P.found++; P.level++; P.best = Math.max(P.best, P.level); save(); renderLevel(); if (GG.stat) GG.stat('kitten-box', 'found', 1); round++; }
    else { phase = 'empty'; pt = 0; boxes[i].empty = true; Sound.open(); Sound.empty(); }
  }

  function update(dt) {
    time += dt; pt += dt;
    boxes.forEach(function (b) { if (b.wob > 0) b.wob -= dt; });
    var K0 = boxes[kitten];
    if (phase === 'show') {
      // the kitten peeks out of its box and waves, then ducks in
      K0.open = easeBack(pt / 0.35);
      if (pt > 0.35 && pt - dt <= 0.35) Sound.meow();
      if (pt > 1.7) { phase = 'hide'; pt = 0; Sound.close(); }
    } else if (phase === 'hide') {
      K0.open = 1 - easeOut(pt / 0.4);
      if (pt > 0.9) { phase = 'shuffle'; pt = 0; nextSwap(); }
    } else if (phase === 'shuffle') {
      if (swap) {
        var k = easeInOut(pt / swap.dur);
        swap.a.x = lerp(slots[swap.sa], slots[swap.sb], k); swap.a.lift = -Math.sin(k * Math.PI) * 50;
        swap.b.x = lerp(slots[swap.sb], slots[swap.sa], k); swap.b.lift = Math.sin(k * Math.PI) * 26;
        if (pt >= swap.dur) { swap.a.slot = swap.sb; swap.b.slot = swap.sa; swap.a.lift = swap.b.lift = 0; swap = null; pt = 0; if (!nextSwap()) { phase = 'pick'; pt = 0; } }
      }
    } else if (phase === 'pick') {
      idleT += dt;
    } else if (phase === 'found') {
      K0.open = easeBack(pt / 0.35);
      if (pt > 0.35 && !fx) { fx = true; Sound.win(); bits.sparkle(K0.x, baseY() - K0.w, '#FFD23F', 16, 1.2); bits.heart(K0.x + K0.w * 0.3, baseY() - K0.w * 1.2); }
      if (pt > 2.2) { fx = false; closeAll(); }
    } else if (phase === 'empty') {
      var e = boxes[picked];
      e.open = easeBack(pt / 0.35);
      // then the right one wiggles and the kitten peeks out
      if (pt > 0.8) { K0.open = easeBack((pt - 0.8) / 0.35); if (pt - dt <= 0.8) { Sound.open(); Sound.meow(); } }
      if (pt > 2.6) closeAll();
    } else if (phase === 'closing') {
      boxes.forEach(function (b) { b.open = Math.min(b.open, 1 - easeOut(pt / 0.35)); });
      if (pt > 0.7) newRound();
    }
  }
  var fx = false;
  function closeAll() { phase = 'closing'; pt = 0; Sound.close(); boxes.forEach(function (b) { b.open = Math.max(b.open, 0); }); }
  function nextSwap() {
    if (!swaps.length) return false;
    var s = swaps.shift(), a = boxInSlot(s[0]), b = boxInSlot(s[1]);
    swapLong = Math.abs(s[0] - s[1]) > 1;
    swap = { a: a, b: b, sa: s[0], sb: s[1], dur: swapDur() };
    Sound.slide();
    return true;
  }

  function draw(c) {
    var y0 = baseY();
    // boxes further up (lifted) are drawn first so the one sliding in front stays in front
    var order = boxes.slice().sort(function (a, b) { return a.lift - b.lift; });
    order.forEach(function (b) {
      var i = boxes.indexOf(b), y = y0 + b.lift, top = y - b.w * 0.78, w = b.wob > 0 ? Math.sin(b.wob * 30) * 0.05 : 0;
      D.shadow(c, b.x, y0 + 6, b.w * 0.5, 12);
      B.drawBack(c, b.x, y, b.w, b.open, b.col);
      if (b.open > 0.05) {
        c.save(); c.beginPath(); c.rect(b.x - b.w, top - b.w * 2, b.w * 2, b.w * 2 + b.w * 0.3); c.clip();
        var rise = clamp(b.open, 0, 1);
        if (i === kitten) B.drawSurprise(c, { kind: phase === 'show' ? 'wave' : 'kitten', look: look }, b.x, top + (1 - rise) * b.w * 0.6, b.w, time);
        else if (b.empty) { c.font = '800 ' + Math.round(b.w * 0.3) + 'px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#7A6F8E'; c.textAlign = 'center'; c.globalAlpha = rise; c.fillText('?', b.x, top - b.w * 0.05); c.globalAlpha = 1; }
        c.restore();
      }
      B.drawFront(c, b.x, y, b.w, b.open, b.col, w);
    });
    if (phase === 'pick') {
      // a little bobbing paw over the boxes: "your turn"
      c.save(); c.globalAlpha = 0.5 + 0.3 * Math.sin(time * 4);
      c.fillStyle = '#FF8FAB'; var px = W / 2, py = y0 - boxW() * 1.2 + Math.sin(time * 4) * 6;
      c.beginPath(); c.ellipse(px, py, 18, 15, 0, 0, TAU); c.fill(); [[-16, -16], [-6, -24], [6, -24], [16, -16]].forEach(function (q) { c.beginPath(); c.ellipse(px + q[0], py + q[1], 6, 7, 0, 0, TAU); c.fill(); });
      c.restore();
    }
  }
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
      pop: function () { tone({ f: 420, to: 920, dur: 0.1, gain: 0.12, slide: 0.06 }); },
      open: function () { tone({ f: 300, to: 760, dur: 0.14, gain: 0.12, type: 'triangle', slide: 0.1 }); },
      close: function () { tone({ f: 500, to: 260, dur: 0.12, gain: 0.06, type: 'triangle' }); },
      slide: function () { noise({ type: 'bandpass', freq: 700, q: 0.8, attack: 0.05, dur: 0.25, gain: 0.05 }); },
      meow: function () { var p = rand(0.95, 1.3); tone({ f: 600 * p, to: 900 * p, dur: 0.16, gain: 0.07, type: 'triangle', slide: 0.12 }); tone({ f: 900 * p, to: 560 * p, dur: 0.22, gain: 0.06, type: 'triangle', delay: 0.14, slide: 0.2 }); },
      empty: function () { tone({ f: 330, to: 260, dur: 0.16, gain: 0.07, type: 'triangle' }); },
      win: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.4, gain: 0.09, delay: i * 0.08 }); }); },
      chime: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 }); tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' }); }); },
      purr: function () { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.22, delay: i * 0.085 }); },
      mrrp: function () { var p = rand(0.9, 1.2); tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', delay: 0.1, slide: 0.12 }); },
      brush: function () { noise({ freq: 1600, q: 0.6, attack: 0.04, dur: 0.18, gain: 0.08 }); }
    };
  })();


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
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= main loop ================= */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); bits.update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    D.rr(ctx, OX, OY, W * K, H * K, 24); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    B.room(ctx, W, H);
    draw(ctx);
    bits.draw(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    D.rr(ctx, OX, OY, W * K, H * K, 24); D.ink(ctx, D.LW.big);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  newRound();
  requestAnimationFrame(frame);

  /* test hook */
  window.__kbox = {
    state: function () { return { level: P.level, phase: phase, kitten: kitten, round: round, found: P.found, boxes: boxes.map(function (b) { return { x: b.x, slot: b.slot }; }), y: baseY() }; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; }
  };
})();
