/* Peekaboo Boxes – a toddler game. A pile of cardboard boxes. Tap one and its flaps pop open: inside might be a
   kitten (or two, or a sleepy one, or one that waves), a ball of yarn, a toy mouse, a fish, a butterfly that flutters
   off, or a burst of stars. After a moment it tucks back in and the box closes, ready with a new surprise.
   Pure cause and effect: no goal, no words, nothing to get wrong. Saves a count to GG.setProgress('peekaboo', { opened }). */
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
  var fx = B.bits();

  var P = (function () { var p = {}; try { p = GG.getProgress('peekaboo') || {}; } catch (e) {} if (typeof p.opened !== 'number') p.opened = 0; return p; })();
  function save() { try { GG.setProgress('peekaboo', P); } catch (e) {} }

  /* ================= the pile of boxes ================= */
  var boxes = [], time = 0, saveT = 0;
  function onLayout() {
    // rows of boxes on the floor, further back = higher up and a little smaller. Rows never overlap, so whatever
    // pops out of a back box is never hidden by a front one.
    var rows = TALL ? [2, 2, 2] : [3, 3];
    var wmax = TALL ? Math.min(210, W * 0.36) : Math.min(210, (W - 120) / 3.6);
    var gap = wmax * 0.78 + (TALL ? Math.min(90, (H - 60 - 3 * wmax * 0.78) / 3) : 26), list = [];
    rows.forEach(function (n, r) {
      var back = rows.length - 1 - r, w = wmax * (1 - back * 0.1), y = H - 30 - back * gap;
      for (var i = 0; i < n; i++) list.push({ x: W / 2 + (i - (n - 1) / 2) * (w + (TALL ? 40 : 70)) + (TALL && r === 1 ? (i ? 30 : -30) : 0), y: y, w: w });
    });
    if (!boxes.length) boxes = list.map(function (b, i) { return { x: b.x, y: b.y, w: b.w, col: B.BOX_COLS[i % B.BOX_COLS.length], open: 0, state: 'shut', t: 0, s: B.pickSurprise(), wob: 0 }; });
    else boxes.forEach(function (b, i) { b.x = list[i].x; b.y = list[i].y; b.w = list[i].w; });
  }

  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    var r = toScene(e.clientX, e.clientY);
    // the box on top (drawn last) wins
    for (var i = boxes.length - 1; i >= 0; i--) {
      var b = boxes[i], h = b.w * 0.78;
      if (Math.abs(r.x - b.x) < b.w * 0.55 && r.y < b.y + 6 && r.y > b.y - h - b.w * 0.3) {
        if (b.state === 'shut') { b.state = 'opening'; b.t = 0; Sound.open(); buzz(15); P.opened++; saveT = 1; if (GG.stat) GG.stat('peekaboo', 'opened', 1); }
        else if (b.state === 'open') { b.t = Math.min(b.t, 0.4); b.wob = 0.4; Sound.pop(); }   // tap again: it stays a little longer
        else { b.wob = 0.3; }
        return;
      }
    }
  });

  function update(dt) {
    time += dt;
    saveT -= dt; if (saveT < 0 && saveT > -1) { saveT = -2; save(); }
    boxes.forEach(function (b) {
      b.t += dt; if (b.wob > 0) b.wob -= dt;
      if (b.state === 'opening') { b.open = easeBack(b.t / 0.35); if (b.t > 0.35) { b.state = 'open'; b.t = 0; reveal(b); } }
      else if (b.state === 'open') { b.open = 1; if (b.t > (b.s.kind === 'butterfly' ? 2.2 : 2.6)) { b.state = 'closing'; b.t = 0; } }
      else if (b.state === 'closing') { b.open = 1 - easeOut(b.t / 0.35); if (b.t > 0.35) { b.state = 'shut'; b.t = 0; b.open = 0; Sound.close(); b.s = B.pickSurprise(); } }
    });
  }
  function reveal(b) {
    var top = b.y - b.w * 0.78;
    if (/kitten|two|sleepy|wave/.test(b.s.kind)) { Sound.meow(); fx.heart(b.x + b.w * 0.25, top - b.w * 0.4); }
    else Sound.twinkle();
    fx.sparkle(b.x, top - b.w * 0.1, pick(['#FFD23F', '#FF8FAB', '#7CC4FF']), 8, 0.8);
  }

  function draw(c) {
    boxes.forEach(function (b) {
      var top = b.y - b.w * 0.78, w = b.wob > 0 ? Math.sin(b.wob * 40) * 0.04 : 0;
      D.shadow(c, b.x, b.y + 4, b.w * 0.5, 10);
      B.drawBack(c, b.x, b.y, b.w, b.open, b.col);
      if (b.state !== 'shut') {
        // the surprise rises out as the box opens and sinks back as it closes
        var rise = b.state === 'opening' ? easeOut(b.t / 0.35) : b.state === 'closing' ? 1 - easeOut(b.t / 0.3) : 1;
        c.save(); c.beginPath(); c.rect(b.x - b.w, top - b.w * 2, b.w * 2, b.w * 2 + b.w * 0.3); c.clip();
        B.drawSurprise(c, b.s, b.x, top + (1 - rise) * b.w * 0.6, b.w, b.state === 'open' ? b.t : 0);
        c.restore();
      }
      B.drawFront(c, b.x, b.y, b.w, b.open, b.col, w);
    });
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
      open: function () { var p = rand(0.9, 1.2); tone({ f: 300 * p, to: 760 * p, dur: 0.14, gain: 0.12, type: 'triangle', slide: 0.1 }); noise({ type: 'bandpass', freq: 1200, q: 0.8, attack: 0.005, dur: 0.06, gain: 0.07 }); },
      close: function () { tone({ f: 500, to: 260, dur: 0.12, gain: 0.06, type: 'triangle' }); },
      meow: function () { var p = rand(0.95, 1.3); tone({ f: 600 * p, to: 900 * p, dur: 0.16, gain: 0.07, type: 'triangle', slide: 0.12 }); tone({ f: 900 * p, to: 560 * p, dur: 0.22, gain: 0.06, type: 'triangle', delay: 0.14, slide: 0.2 }); },
      twinkle: function () { [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { tone({ f: f, dur: 0.25, gain: 0.06, delay: i * 0.06 }); }); },
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
    update(dt); fx.update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    D.rr(ctx, OX, OY, W * K, H * K, 24); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    B.room(ctx, W, H);
    draw(ctx);
    fx.draw(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    D.rr(ctx, OX, OY, W * K, H * K, 24); D.ink(ctx, D.LW.big);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  requestAnimationFrame(frame);

  /* test hook */
  window.__peek = {
    boxes: function () { return boxes.map(function (b) { return { x: b.x, y: b.y - b.w * 0.39, state: b.state, kind: b.s.kind }; }); },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    opened: function () { return P.opened; }
  };
})();
