/* Stack the Cats – a toddler game. Loaf-shaped cats stack into a wobbly tower on a cushion. The next cat waits
   at the top: move it left and right with your finger and let go to drop it. A cat dropped too far off the edge
   just slides down and sits on the floor. As the tower grows it wobbles more, and when it's too tall (or leaning
   too far) it gently topples – whee! – and you build again. No score, nothing to lose.
   Saves a count to GG.setProgress('stack', { towers }). */
(function () {
  'use strict';

  var D = window.GGDraw, INK = D.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }

  var P = (function () { var p = {}; try { p = GG.getProgress('stack') || {}; } catch (e) {} if (typeof p.towers !== 'number') p.towers = 0; return p; })();
  function save() { try { GG.setProgress('stack', P); } catch (e) {} }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 700;
  var CAT = 96;                 // cat size (GGCat units)
  var k = CAT / 88, CW = 176 * k, CH = 100 * k, STEP = 70 * k;   // cat width, height, and how much each cat adds
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var aw = cw - 16, ah = Math.max(120, ch - top - 12);
    var tall = aw / ah < 1.05;
    W = tall ? 600 : 1000; H = tall ? clamp(Math.round(600 * ah / aw), 800, 1150) : clamp(Math.round(1000 * ah / aw), 620, 760);
    // smaller cats on wide screens so the tower can still get tall
    CAT = tall ? 96 : 92; k = CAT / 88; CW = 176 * k; CH = 100 * k; STEP = 70 * k;
    K = Math.min(aw / W, ah / H);
    OX = (cw - W * K) / 2; OY = top + (ah - H * K) / 2;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }
  function floorY() { return H - 60; }
  function baseTop() { return floorY() - 46; }            // top of the cushion
  function hoverY() { return 60 + CH * 0.5; }
  function maxCats() { return 8; }
  /* As the tower grows the view gently zooms out (around the floor) so it always fits under the waiting cat. */
  var zoom = 1;
  function zoomTarget() { var need = floorY() - (baseTop() - stack.length * STEP - CH * 0.3); return Math.min(1, (floorY() - hoverY() - CH * 1.05) / need); }
  function hoverWorldY() { return floorY() - (floorY() - hoverY()) / zoom; }
  function toWorldX(x) { return W / 2 + (x - W / 2) / zoom; }

  /* ================= state ================= */
  var LOOKS = [{ preset: 'ginger' }, { preset: 'pink' }, { preset: 'blue' }, { preset: 'purple' }, { preset: 'white' }, { preset: 'black' }, { color: '#C9C2D6', markings: 'tabby' }, { color: '#FFFFFF', markings: 'calico' }, { color: '#A7E3B8' }, { color: '#FFD23F' }];
  var stack = [], floor = [], flying = [], hover = null, falling = null, time = 0, parts = [], topple = null, lastLook = -1, wob = 0;
  function newLook() { var i; do { i = Math.floor(Math.random() * LOOKS.length); } while (i === lastLook); lastLook = i; return LOOKS[i]; }
  function newHover() { hover = { look: newLook(), x: W / 2, t: 0 }; }
  function stackTopY() { return baseTop() - stack.length * STEP; }
  function topX() { return stack.length ? stack[stack.length - 1].x : W / 2; }

  /* ================= dropping ================= */
  var held = null;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (!hover || topple || falling) return;
    var r = toScene(e.clientX, e.clientY);
    held = { id: e.pointerId };
    hover.x = clamp(toWorldX(r.x), CW / 2 + 10, W - CW / 2 - 10);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!held || held.id !== e.pointerId || !hover) return;
    hover.x = clamp(toWorldX(toScene(e.clientX, e.clientY).x), CW / 2 + 10, W - CW / 2 - 10);
  });
  function release(e) {
    if (!held || held.id !== e.pointerId) return;
    held = null;
    if (!hover || topple || falling) return;
    // let go: the cat drops
    falling = { look: hover.look, x: hover.x, y: hoverWorldY(), vy: 0 };
    hover = null;
    Sound.whoops();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function land() {
    var f = falling; falling = null;
    var tx = topX(), off = f.x - tx;
    if (Math.abs(off) > CW * 0.62) {
      // missed the tower: it slides down to the floor and sits there
      floor.push({ look: f.look, x: clamp(f.x, CW / 2, W - CW / 2), y: floorY(), t: 0, face: 'surprised' });
      if (floor.length > 3) floor.shift();
      Sound.whoops(); setTimeout(newHover, 500);
      return;
    }
    // cats like to balance: they settle half way back towards the cat below
    var x = tx + off * 0.5;
    stack.push({ look: f.look, x: x, t: 0, squash: 1 });
    Sound.land(stack.length); buzz(12);
    sparkle(x, stackTopY() + STEP, '#FFF3B0', 6, 0.6);
    wob = Math.min(1, wob + 0.25 + Math.abs(off) / CW);
    // too tall or leaning too far? Whee!
    if (stack.length >= maxCats() || unbalanced()) { setTimeout(startTopple, 700); Sound.wobble(); }
    else setTimeout(newHover, 380);
  }
  function unbalanced() {
    for (var i = 1; i < stack.length; i++) {
      var sum = 0, n = 0; for (var j = i; j < stack.length; j++) { sum += stack[j].x; n++; }
      if (Math.abs(sum / n - stack[i - 1].x) > CW * 0.42) return true;
    }
    return false;
  }
  function startTopple() {
    var dir = stack.length > 1 && stack[stack.length - 1].x < stack[0].x ? -1 : stack.length > 1 && stack[stack.length - 1].x > stack[0].x ? 1 : (Math.random() < 0.5 ? -1 : 1);
    topple = { t: 0, dir: dir };
    Sound.whee(); buzz([20, 40, 20]);
    P.towers++; save(); if (GG.stat) GG.stat('stack', 'towers', 1);
    stack.forEach(function (s, i) {
      var y = baseTop() - i * STEP - CH * 0.5;
      flying.push({ look: s.look, x: s.x, y: y, vx: dir * rand(80, 200) * (0.5 + i * 0.25) + rand(-40, 40), vy: -rand(150, 320), rot: 0, vr: dir * rand(1.5, 4), bounces: 0 });
    });
    stack = [];
  }

  /* ================= update ================= */
  function update(dt) {
    time += dt;
    wob = Math.max(0, wob - dt * 0.35);
    zoom += (zoomTarget() - zoom) * Math.min(1, dt * 3);
    if (hover) hover.t += dt;
    if (falling) {
      falling.vy += 1800 * dt; falling.y += falling.vy * dt;
      var land_y = stackTopY() - CH * 0.5;
      var tx = topX();
      if (Math.abs(falling.x - tx) > CW * 0.62) land_y = floorY() - CH * 0.5;
      if (falling.y >= land_y) { falling.y = land_y; land(); }
    }
    stack.forEach(function (s) { s.t += dt; });
    floor.forEach(function (f) { f.t += dt; });
    floor = floor.filter(function (f) { return f.t < 6; });
    if (topple) {
      topple.t += dt;
      flying.forEach(function (f) {
        f.vy += 1400 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        var g = floorY() - CH * 0.45;
        if (f.y > g) { f.y = g; f.vy = -f.vy * 0.35; f.vx *= 0.6; f.vr *= 0.5; f.bounces++; if (f.bounces === 1) Sound.land(0); }
        if (f.x < CW / 2 || f.x > W - CW / 2) { f.vx = -f.vx * 0.5; f.x = clamp(f.x, CW / 2, W - CW / 2); }
      });
      if (topple.t > 2.4) { topple = null; flying = []; wob = 0; newHover(); Sound.pop(); }
    }
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  }

  /* ================= drawing ================= */
  /* The shared cat's 'lie' pose (a loaf with little paws). It's lifted by the paws' height so the paws rest where
     the tummy used to: on the cushion, or on the head of the cat below. */
  function drawLoaf(c, look, x, y, face, rot, sq) {
    c.save(); c.translate(x, y - 6 * k); if (rot) c.rotate(rot); if (sq && sq !== 1) c.scale(1 + (1 - sq) * 0.5, sq);
    c.translate(8 * k, 0);
    var o = {}; for (var key in look) o[key] = look[key]; o.pose = 'lie'; o.size = CAT; o.face = face;
    try { GGCat.draw(c, o); } catch (e) { ell(c, 0, 0, CW / 2, CH / 2); c.fillStyle = '#FFA94D'; c.fill(); D.ink(c, 4); }
    c.restore();
  }
  var cushion = null, cushionAt = '';
  function drawRoom(c) {
    // the cushion the tower stands on: shaded, its buttons inside, outline last
    var x = W / 2 - CW * 0.75, y = baseTop(), w = CW * 1.5, key = x + ',' + y + ',' + w;
    if (key !== cushionAt) { cushion = D.rrPath(x, y, w, 50, 22); cushionAt = key; }
    D.shadow(c, W / 2, y + 50, w * 0.52, 9);
    D.shape(c, cushion, '#FF8FAB', { lw: D.LW.big, depth: 8, shine: [x + w * 0.22, y + 12, w * 0.14, 5, 0, 0.4], inside: function (c) {
      c.fillStyle = '#FFC2DA'; [-0.45, 0, 0.45].forEach(function (f) { circle(c, W / 2 + f * CW, y + 25, 6); c.fill(); });
    } });
  }
  function frameScene(c) {
    // the room: striped wallpaper and a wooden floor (shared/scene.js)
    GGScene.wall(c, 0, 0, W, floorY(), { pattern: 'stripes', col: '#E8E0FF', col2: '#DCD2FA', size: 80 });
    GGScene.floor(c, 0, floorY(), W, H - floorY(), { kind: 'planks', col: '#E6B98A' });
    c.save(); c.translate(W / 2, floorY()); c.scale(zoom, zoom); c.translate(-W / 2, -floorY());
    drawRoom(c);
    // sway: the whole tower leans a little, more as it gets taller
    var sway = Math.sin(time * 3) * (0.006 * stack.length + 0.04 * wob);
    var lean = stack.length ? (stack[stack.length - 1].x - stack[0].x) / (CW * 6) : 0;
    c.save(); c.translate(W / 2, baseTop()); c.rotate(sway + lean * 0.3); c.translate(-W / 2, -baseTop());
    stack.forEach(function (s, i) {
      var y = baseTop() - i * STEP - CH * 0.5 + 6;
      var sq = s.t < 0.25 ? 1 - Math.sin(s.t / 0.25 * Math.PI) * 0.12 : 1;
      var face = topple ? 'surprised' : (i === stack.length - 1 && s.t < 0.5 ? 'happy' : (Math.sin(time * 0.8 + i * 1.7) > 0.97 ? 'blink' : (i % 3 === 1 ? 'sleep' : 'happy')));
      drawLoaf(c, s.look, s.x, y, face, 0, sq);
    });
    c.restore();
    floor.forEach(function (f) { c.save(); c.globalAlpha = f.t > 5 ? 6 - f.t : 1; drawLoaf(c, f.look, f.x, f.y - CH * 0.5 + 6, f.t < 1 ? 'surprised' : 'open'); c.restore(); });
    flying.forEach(function (f) { drawLoaf(c, f.look, f.x, f.y, 'surprised', f.rot); });
    if (falling) drawLoaf(c, falling.look, falling.x, falling.y, 'surprised');
    if (hover) {
      var bob = Math.sin(hover.t * 3) * 6, gy = stackTopY();
      // a dotted line down to where it would land
      var hy = hoverWorldY();
      c.save(); c.setLineDash([8, 10]); c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 4; c.beginPath(); c.moveTo(hover.x, hy + CH * 0.5); c.lineTo(hover.x, gy); c.stroke(); c.restore();
      var s = Math.min(1, hover.t / 0.3);
      c.save(); c.translate(hover.x, hy + bob); c.scale(s, s); c.translate(-hover.x, -(hy + bob));
      drawLoaf(c, hover.look, hover.x, hy + bob, held ? 'happy' : 'open');
      c.restore();
    }
    c.restore();
    drawParts(c);
  }
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) { var a = rand(Math.PI, TAU), sp = rand(60, 160) * (spd || 1); parts.push({ x: x + rand(-CW / 3, CW / 3), y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(0.4, 0.7), r: rand(4, 8), color: color }); }
  }
  function drawParts(c) {
    parts.forEach(function (p) { var q = 1 - p.life / p.max; c.save(); c.globalAlpha = q; circle(c, p.x, p.y, p.r); c.fillStyle = p.color; c.fill(); c.restore(); });
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
      land: function (n) { var f = 330 * Math.pow(1.122, n || 0); tone({ f: f, dur: 0.22, gain: 0.12 }); noise({ type: 'lowpass', freq: 400, q: 1, attack: 0.003, dur: 0.06, gain: 0.14 }); },
      whoops: function () { tone({ f: 500, to: 300, dur: 0.25, gain: 0.08, type: 'triangle' }); },
      wobble: function () { tone({ f: 260, to: 300, dur: 0.12, gain: 0.05, type: 'triangle' }); tone({ f: 300, to: 250, dur: 0.12, gain: 0.05, type: 'triangle', delay: 0.14 }); },
      whee: function () { tone({ f: 500, to: 1300, dur: 0.4, gain: 0.08, type: 'triangle', slide: 0.35 }); for (var i = 0; i < 5; i++) noise({ type: 'lowpass', freq: 380, q: 1, attack: 0.003, dur: 0.06, gain: 0.12, delay: 0.45 + i * 0.12 }); },
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
    D.rr(ctx, OX, OY, W * K, H * K, 24); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    frameScene(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    D.rr(ctx, OX, OY, W * K, H * K, 24); D.ink(ctx, D.LW.big);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  newHover();
  requestAnimationFrame(frame);

  /* test hook */
  window.__stack = {
    state: function () { return { stack: stack.length, max: maxCats(), floor: floor.length, hover: !!hover, topple: !!topple, falling: !!falling, towers: P.towers, top: topX() }; },
    toScreen: function (x, y) { var zx = W / 2 + (x - W / 2) * zoom; return { x: OX + zx * K, y: OY + y * K }; },
    room: function () { return { W: W, H: H, CW: CW }; }
  };
})();
