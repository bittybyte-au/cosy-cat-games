/* Mouse Pop – a toddler game. Little toy mice in bright colours scurry about the floor; tap one and it pops away
   in a puff of bubbles (with a buzz on phones that can). Now and then a cat strolls through and the mice scatter;
   tapping the cat just gets a purr. Never too many mice, never too fast. No score, no winning, no losing.
   Saves a count to GG.setProgress('mousepop', { popped }). */
(function () {
  'use strict';

  var INK = GGDraw.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function angDiff(a, b) { var d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
  var D = GGDraw, rr = D.rr, ink = D.ink;
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }

  /* ================= a little buzz ================= */
  var hapticLabel = $('hapticLabel');
  function buzz(ms) {
    try {
      if (navigator.vibrate && navigator.vibrate(ms)) return;
    } catch (e) {}
    // iPhone (iOS 18+): flipping a switch control gives a small haptic tap
    try { hapticLabel.click(); } catch (e) {}
  }

  /* ================= saved count ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('mousepop') || {}; } catch (e) {} if (typeof p.popped !== 'number') p.popped = 0; return p; })();
  var saveT = 0;
  function save() { try { GG.setProgress('mousepop', P); } catch (e) {} }

  /* ================= layout: the floor fills the screen ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 700;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var aw = cw - 16, ah = Math.max(120, ch - top - 10);
    // mice are the same size on any screen: about 520 units across the short side
    K = Math.min(aw, ah) / 520;
    W = aw / K; H = ah / K;
    OX = 8; OY = top;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  /* ================= mice ================= */
  var COLS = ['#FF8FAB', '#7CC4FF', '#FFD23F', '#7BD389', '#B48CFF', '#FF9F43', '#C9C2D6', '#FFFFFF'];
  var mice = [], parts = [], cat = null, time = 0, spawnT = 0.3, catT = rand(14, 20);
  var MAX_MICE = 5, MIN_MICE = 2;
  function spawnMouse() {
    var side = Math.floor(Math.random() * 4), x, y, a;
    if (side === 0) { x = -50; y = rand(80, H - 80); a = rand(-0.5, 0.5); }
    else if (side === 1) { x = W + 50; y = rand(80, H - 80); a = Math.PI + rand(-0.5, 0.5); }
    else if (side === 2) { x = rand(80, W - 80); y = -50; a = Math.PI / 2 + rand(-0.5, 0.5); }
    else { x = rand(80, W - 80); y = H + 50; a = -Math.PI / 2 + rand(-0.5, 0.5); }
    mice.push({ x: x, y: y, a: a, turn: 0, sp: rand(70, 110), col: pick(COLS), t: 0, pause: 0, nextPause: rand(1.5, 3.5), stay: rand(6, 12), size: rand(1.2, 1.4), squeaked: false });
  }
  function update(dt) {
    time += dt;
    // keep a few mice about, never too many
    spawnT -= dt;
    if (mice.length < MIN_MICE) spawnT = Math.min(spawnT, 0.4);
    if (spawnT <= 0 && mice.length < MAX_MICE) { spawnMouse(); spawnT = rand(0.9, 1.8); }
    mice.forEach(function (m) {
      m.t += dt;
      if (m.pause > 0) { m.pause -= dt; return; }
      m.nextPause -= dt;
      if (m.nextPause <= 0 && !m.flee) { m.pause = rand(0.5, 1.3); m.nextPause = rand(2, 4); if (Math.random() < 0.3) Sound.squeak(); return; }
      // wander: gentle turns; stay on screen for a while, then wander off
      var sp = m.sp * (m.flee > 0 ? 1.8 : 1);
      if (m.flee > 0) m.flee -= dt;
      if (Math.random() < dt * 1.5) m.turn = rand(-1.4, 1.4);
      var inside = m.x > 60 && m.x < W - 60 && m.y > 60 && m.y < H - 60;
      if (m.t < m.stay && !m.flee) {
        // steer back in from the edges
        var toMid = Math.atan2(H / 2 - m.y, W / 2 - m.x);
        if (!inside && m.t > 1.2) m.turn = clamp(angDiff(m.a, toMid) * 2, -2.5, 2.5);
      }
      m.a += m.turn * dt;
      m.x += Math.cos(m.a) * sp * dt; m.y += Math.sin(m.a) * sp * dt;
    });
    // mice that have wandered right off the screen go home
    mice = mice.filter(function (m) { return m.x > -120 && m.x < W + 120 && m.y > -120 && m.y < H + 120; });
    // now and then a cat strolls through and the mice scatter
    catT -= dt;
    if (!cat && catT <= 0) {
      var ltr = Math.random() < 0.5;
      cat = { x: ltr ? -120 : W + 120, y: rand(H * 0.3, H * 0.75), dir: ltr ? 1 : -1, sp: 70, look: pick([{ preset: 'ginger' }, { preset: 'black' }, { preset: 'white' }, { preset: 'blue' }, { color: '#C9C2D6', markings: 'tabby' }]), t: 0, happy: 0 };
      Sound.steps();
    }
    if (cat) {
      cat.t += dt; cat.happy = Math.max(0, cat.happy - dt);
      cat.x += cat.dir * cat.sp * dt;
      if (Math.random() < dt * 0.8) Sound.steps();
      mice.forEach(function (m) {
        var d = Math.hypot(m.x - cat.x, m.y - cat.y);
        if (d < 220 && !m.flee) { m.flee = 1.4; m.pause = 0; m.a = Math.atan2(m.y - cat.y, m.x - cat.x) + rand(-0.4, 0.4); m.turn = 0; Sound.squeak(); }
      });
      if (cat.x < -160 || cat.x > W + 160) { cat = null; catT = rand(16, 26); }
    }
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 300) * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; }
    saveT -= dt; if (saveT < 0 && saveT > -1) { saveT = -2; save(); }
  }

  /* ================= tapping ================= */
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    var r = toScene(e.clientX, e.clientY);
    var best = null, bd = 1e9;
    mice.forEach(function (m) { var d = Math.hypot(r.x - m.x, r.y - m.y); if (d < 62 * m.size && d < bd) { bd = d; best = m; } });
    if (best) { popMouse(best); return; }
    if (cat && Math.abs(r.x - cat.x) < 90 && r.y > cat.y - 130 && r.y < cat.y + 50) {
      cat.happy = 1.2; Sound.purr(); heart(cat.x + cat.dir * 40, cat.y - 120);
      return;
    }
    // a tap on the floor: a tiny ripple
    parts.push({ x: r.x, y: r.y, vx: 0, vy: 0, life: 0, max: 0.4, kind: 'ring', g: 0 });
  });
  function popMouse(m) {
    mice.splice(mice.indexOf(m), 1);
    Sound.pop(); buzz(25);
    P.popped++; saveT = 0.8;
    if (GG.stat) GG.stat('mouse-pop', 'popped', 1);
    // a puff of bubbles in the mouse's colour, and the mouse spins up and away
    var n = reduceMotion ? 6 : 14;
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + rand(-0.2, 0.2), sp = rand(120, 260);
      parts.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: rand(0.5, 0.8), r: rand(7, 14), color: i % 3 ? m.col : '#FFFFFF', kind: 'bubble', g: 80 });
    }
    parts.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 0, max: 0.35, kind: 'burst', color: m.col, g: 0 });
    parts.push({ x: m.x, y: m.y, vx: rand(-40, 40), vy: -380, life: 0, max: 0.7, kind: 'mouse', m: m, spin: rand(-8, 8), g: 700 });
  }

  /* ================= drawing ================= */
  /* the floor and rug never change, so they're drawn once into a picture (redrawn when the screen changes) */
  var floorCv = null, floorKey = '';
  function drawFloor(c) {
    var key = [W, H, K, dpr].join(',');
    if (key !== floorKey) {
      floorKey = key;
      floorCv = floorCv || document.createElement('canvas');
      floorCv.width = Math.ceil(W * K * dpr); floorCv.height = Math.ceil(H * K * dpr);
      var f = floorCv.getContext('2d');
      f.setTransform(K * dpr, 0, 0, K * dpr, 0, 0);
      paintFloor(f);
    }
    c.drawImage(floorCv, 0, 0, W, H);
  }
  function paintFloor(c) {
    c.fillStyle = D.tone(c, '#F2DDC0', 0, H); c.fillRect(0, 0, W, H);
    c.strokeStyle = '#E6CBA6'; c.lineWidth = 4; c.lineCap = 'butt';
    for (var y = 0; y < H; y += 70) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); var off = ((y / 70) % 2) * 150; for (var x = off; x < W; x += 300) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 70); c.stroke(); } }
    // a soft round rug, its dashed stitching inside the edge
    var rx = Math.min(W * 0.36, 420), ry = Math.min(H * 0.32, 260);
    D.shadow(c, W / 2 + 4, H / 2 + 8, rx, ry);
    D.shape(c, D.ellPath(W / 2, H / 2, rx, ry), D.tone(c, '#FFE7F0', H / 2 - ry, H / 2 + ry), { lw: D.LW.mid, depth: 12, inside: function (c) {
      c.beginPath(); c.ellipse(W / 2, H / 2, rx * 0.83, ry * 0.81, 0, 0, TAU); c.setLineDash([16, 12]); c.strokeStyle = '#FFC2DA'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke(); c.setLineDash([]);
    } });
  }
  var MOUSE_BODY = new Path2D('M-32 0Q-30 -22 0 -21Q30 -18 38 0Q30 18 0 21Q-30 22 -32 0Z');
  function drawMouse(c, m, spin) {
    var run = m.pause > 0 ? 0 : Math.sin(time * 26 + m.x * 0.05);
    var a = m.a + (spin || 0), s = m.size;
    // the shadow stays under the mouse whichever way it's facing
    if (!spin) { c.save(); c.translate(m.x + 3, m.y + 6); c.rotate(a); c.scale(s, s); c.fillStyle = 'rgba(42,35,64,.16)'; c.beginPath(); c.ellipse(2, 0, 38, 24, 0, 0, TAU); c.fill(); c.restore(); }
    c.save(); c.translate(m.x, m.y); c.rotate(a); c.scale(s, s);
    // outlines are given in screen units, so they stay even however big the mouse is
    var lw = D.LW.mid / s, lf = D.LW.fine / s;
    // the crescent of shade sits to the lower right on screen, whichever way the mouse faces
    var cs = Math.cos(-a), sn = Math.sin(-a), ox = -5 / s, oy = -7 / s;
    // tail (starts under the body), outlined like the cat's
    c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(-54, -8 + Math.sin(time * 9 + m.y) * 10, -70, 4);
    c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 5 + lf * 2; c.stroke(); c.strokeStyle = '#FF8FAB'; c.lineWidth = 5; c.stroke();
    // little paws peeking out from under the body
    [[-14, -20, 1], [14, -19, -1], [-14, 20, -1], [14, 19, 1]].forEach(function (f) { c.beginPath(); c.ellipse(f[0] + run * 4 * f[2], f[1], 7, 5, 0, 0, TAU); c.fillStyle = '#FFB3C7'; c.fill(); D.ink(c, lf); });
    // body
    D.shape(c, MOUSE_BODY, m.col, { lw: lw, depth: 1, dx: ox * cs - oy * sn, dy: ox * sn + oy * cs, shade: 'rgba(42,35,64,.14)' });
    // ears
    [-20, 20].forEach(function (y) {
      D.shape(c, D.ellPath(10, y, 11, 11), m.col, { lw: lf, depth: 0, inside: function (c) { c.beginPath(); c.arc(10, y, 6, 0, TAU); c.fillStyle = '#FFB3C7'; c.fill(); } });
    });
    // face: eyes inside; whiskers and nose out at the tip, so nothing crosses the outline
    c.fillStyle = INK; c.beginPath(); c.arc(26, -7, 3.6, 0, TAU); c.fill(); c.beginPath(); c.arc(26, 7, 3.6, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(42, -4); c.lineTo(52, -11); c.moveTo(42, 4); c.lineTo(52, 11); c.strokeStyle = 'rgba(42,35,64,.5)'; c.lineWidth = 2 / s; c.stroke();
    c.beginPath(); c.arc(39, 0, 5, 0, TAU); c.fillStyle = '#FF7FA6'; c.fill(); D.ink(c, lf);
    c.restore();
  }
  /* a cat strolling across, seen from the side: the shared cat's head on a body shaded the same way */
  var CAT_BODY = D.ellPath(0, 0, 72, 36);
  function drawCat(c, k) {
    var step = Math.sin(k.t * 7);
    var o = {}; for (var key in k.look) o[key] = k.look[key];
    var col = o.color || (GGCat.PRESETS && GGCat.PRESETS[o.preset] && GGCat.PRESETS[o.preset].color) || '#FFA94D';
    D.shadow(c, k.x, k.y + 52, 80, 14);
    c.save(); c.translate(k.x, k.y); c.scale(k.dir, 1);
    // tail starts inside the body, so the body covers the join
    c.beginPath(); c.moveTo(-56, -8); c.quadraticCurveTo(-110, -20, -100, -80 + Math.sin(time * 3) * 6); c.strokeStyle = INK; c.lineWidth = 18; c.lineCap = 'round'; c.stroke(); c.strokeStyle = col; c.lineWidth = 10; c.stroke();
    // legs go up under the body
    [[-44, 1], [-22, -1], [24, 1], [46, -1]].forEach(function (l) { D.shape(c, D.rrPath(l[0] - 8 + step * 8 * l[1], 0, 18, 52, 9), col, { lw: D.LW.mid, depth: 4, dx: -3 * k.dir, dy: -4 }); });
    // the shade falls to the lower right on screen, so it flips with the cat
    D.shape(c, CAT_BODY, D.tone(c, col, -36, 36), { lw: D.LW.big, depth: 9, dx: -6 * k.dir, dy: -9 });
    c.restore();
    c.save(); c.translate(k.x + k.dir * 66, k.y - 46 + Math.abs(step) * -3);
    o.size = 104; o.face = k.happy > 0 ? 'happy' : 'open';
    try { GGCat.draw(c, o); } catch (e) {}
    c.restore();
  }
  function heart(x, y) { parts.push({ x: x, y: y, vx: rand(-20, 20), vy: -80, life: 0, max: 1.2, r: 18, color: '#FF7EB6', kind: 'heart', g: -10 }); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.8);
      if (p.kind === 'mouse') { var m = p.m, ox = m.x, oy = m.y; m.x = p.x; m.y = p.y; c.translate(p.x, p.y); c.scale(k, k); c.translate(-p.x, -p.y); drawMouse(c, m, p.life * p.spin); m.x = ox; m.y = oy; c.restore(); return; }
      c.translate(p.x, p.y);
      if (p.kind === 'ring') { circle(c, 0, 0, 10 + (1 - k) * 34); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 5; c.stroke(); }
      else if (p.kind === 'burst') { circle(c, 0, 0, 30 + (1 - k) * 60); c.strokeStyle = p.color; c.lineWidth = 10 * k; c.stroke(); }
      else if (p.kind === 'bubble') { circle(c, 0, 0, p.r); c.fillStyle = p.color; c.globalAlpha *= 0.85; c.fill(); c.globalAlpha = Math.min(1, k * 1.8); circle(c, -p.r * 0.35, -p.r * 0.35, p.r * 0.28); c.fillStyle = '#fff'; c.fill(); circle(c, 0, 0, p.r); ink(c, D.LW.fine); }
      else if (p.kind === 'heart') { var r = p.r; c.beginPath(); c.moveTo(0, r * 0.4); c.bezierCurveTo(-r * 1.2, -r * 0.4, -r * 0.5, -r * 1.2, 0, -r * 0.5); c.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.2, -r * 0.4, 0, r * 0.4); c.fillStyle = p.color; c.fill(); ink(c, D.LW.fine); }
      c.restore();
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
      pop: function () { var p = rand(0.85, 1.25); tone({ f: 380 * p, to: 1100 * p, dur: 0.09, gain: 0.16, slide: 0.05 }); noise({ type: 'highpass', freq: 2500, q: 0.7, attack: 0.002, dur: 0.04, gain: 0.08 }); },
      squeak: function () { var p = rand(0.9, 1.3); tone({ f: 1500 * p, to: 2100 * p, dur: 0.06, gain: 0.04, type: 'triangle' }); },
      steps: function () { for (var i = 0; i < 2; i++) noise({ type: 'lowpass', freq: 300, q: 1, attack: 0.01, dur: 0.05, gain: 0.08, delay: i * 0.25 }); },
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
    update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    rr(ctx, OX, OY, W * K, H * K, 24); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawFloor(ctx);
    mice.forEach(function (m) { drawMouse(ctx, m); });
    if (cat) drawCat(ctx, cat);
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, W * K, H * K, 24); ink(ctx, D.LW.big);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  document.addEventListener('visibilitychange', function () { last = performance.now(); if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  layout();
  for (var s = 0; s < 3; s++) { spawnMouse(); var m = mice[mice.length - 1]; m.x = rand(150, W - 150); m.y = rand(120, H - 120); }
  requestAnimationFrame(frame);

  /* test hook */
  window.__mouse = {
    state: function () { return { mice: mice.map(function (m) { return { x: m.x, y: m.y }; }), cat: cat && { x: cat.x, y: cat.y }, popped: P.popped, W: W, H: H }; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    callCat: function () { catT = 0; }
  };
})();
