/* Kitten Crossing – a toddler game. A road with a zebra crossing and a crossing-guard cat with a lollipop sign.
   Kittens wander up and wait at the kerb. Press the red STOP button: the cars stop at the line and the kittens hop
   across to the park. Press the green GO button: the cars drive again. Cars never drive while a kitten is on the
   crossing, whatever button is pressed, so nothing can go wrong. When kittens are waiting the STOP button gives a
   little nudge; when the road's been stopped a while with nobody waiting, GO does.
   Saves a count to GG.setProgress('crossing', { crossed }). */
(function () {
  'use strict';

  var D = window.GGDraw, INK = D.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  var rr = D.rr, ink = D.ink;
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function fillInk(c, col, w) { c.fillStyle = col; c.fill(); ink(c, w || 4); }

  /* the STOP picture: a cat's paw (four toe beans and a round pad), in a 60-unit box. One drawing for the
     button and the lollipop sign. */
  var PAW = ['M30 30C39 30 46 38 45 45C44 51 37 51 30 49C23 51 16 51 15 45C14 38 21 30 30 30Z',
    'M10.5 27a5.5 6.5 0 1 0 11 0a5.5 6.5 0 1 0 -11 0Z', 'M19 17a6 7 0 1 0 12 0a6 7 0 1 0 -12 0Z',
    'M29 17a6 7 0 1 0 12 0a6 7 0 1 0 -12 0Z', 'M38.5 27a5.5 6.5 0 1 0 11 0a5.5 6.5 0 1 0 -11 0Z'];
  var PAW2D = PAW.map(function (d) { return new Path2D(d); });
  $('stopBtn').innerHTML = '<svg viewBox="0 0 60 60">' + PAW.map(function (d, i) {
    return '<path d="' + d + '" fill="#fff" stroke="' + INK + '" stroke-width="3.2" stroke-linejoin="round"/>' + (i ? '' : '<path d="M30 36C36 36 40 41 39.5 44.5C39 47 35 47 30 46C25 47 21 47 20.5 44.5C20 41 24 36 30 36Z" fill="#FFB3C7"/>');
  }).join('') + '</svg>';

  var P = (function () { var p = {}; try { p = GG.getProgress('crossing') || {}; } catch (e) {} if (typeof p.crossed !== 'number') p.crossed = 0; return p; })();
  var saveT = 0;
  function save() { try { GG.setProgress('crossing', P); } catch (e) {} }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar'), controls = $('controls');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 640, R = null;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6, bottom = controls.getBoundingClientRect().top - 8;
    var aw = cw - 16, ah = Math.max(120, bottom - top);
    var tall = aw / ah < 1.05;
    W = tall ? 600 : 1000; H = tall ? clamp(Math.round(600 * ah / aw), 700, 1000) : clamp(Math.round(1000 * ah / aw), 560, 700);
    // the road: two lanes across the middle; the zebra crossing in the middle of it
    var roadTop = H * 0.4, roadH = Math.min(220, H * 0.3);
    R = { top: roadTop, bot: roadTop + roadH, lane1: roadTop + roadH * 0.27, lane2: roadTop + roadH * 0.73, zx: W / 2, zw: tall ? 150 : 170, kerb: roadTop + roadH + 34, park: roadTop - 40 };
    K = Math.min(aw / W, ah / H);
    OX = (cw - W * K) / 2; OY = top + (ah - H * K) / 2;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  /* ================= state ================= */
  var stopped = false, time = 0, parts = [], cars = [], kittens = [], carT = 0.5, kitT = 1.0, idleStop = 0;
  var CAR_COLS = ['#FF5A5F', '#3D8BFF', '#FFD23F', '#3FC46A', '#B48CFF', '#FF9F43'];
  var LOOKS = [{ preset: 'ginger' }, { preset: 'pink' }, { preset: 'blue' }, { preset: 'purple' }, { preset: 'white' }, { preset: 'black' }, { color: '#C9C2D6', markings: 'tabby' }, { color: '#FFFFFF', markings: 'calico' }];
  function setStopped(v) {
    if (stopped === v) return;
    stopped = v; idleStop = 0;
    $('stopBtn').setAttribute('aria-pressed', String(v)); $('goBtn').setAttribute('aria-pressed', String(!v));
    (v ? Sound.stop : Sound.go)(); buzz(15);
    signFlip = 0.35;
  }
  var signFlip = 0;
  $('stopBtn').addEventListener('click', function () { Sound.init(); setStopped(true); });
  $('goBtn').addEventListener('click', function () { Sound.init(); setStopped(false); });

  function onCrossing(k) { return k.state === 'cross'; }
  function crossingBusy() { return kittens.some(onCrossing); }
  function spawnCar() {
    var dir = Math.random() < 0.5 ? 1 : -1, lane = dir > 0 ? R.lane2 : R.lane1;
    // don't spawn on top of a car that's still at the start
    var start = dir > 0 ? -140 : W + 140;
    if (cars.some(function (c) { return c.dir === dir && Math.abs(c.x - start) < 230; })) return;
    cars.push({ x: start, y: lane, dir: dir, v: 150, col: pick(CAR_COLS), driver: pick(LOOKS), len: rand(150, 175), beeped: false });
  }
  function spawnKitten() {
    var waiting = kittens.filter(function (k) { return k.state === 'walk' || k.state === 'wait'; }).length;
    if (waiting >= 4) return;
    var slot = waiting;
    kittens.push({ look: pick(LOOKS), x: R.zx + rand(-1, 1) * (W * 0.4), y: H + 60, tx: R.zx - (slot - 1.5) * 0, state: 'walk', t: 0, slot: slot, hop: 0, bounce: 0 });
  }
  function waitSpot(i) { var n = 4, sp = Math.min(46, R.zw * 0.3); return { x: R.zx + (i - (n - 1) / 2) * sp, y: R.kerb + 10 + (i % 2) * 18 }; }

  function update(dt) {
    time += dt; signFlip = Math.max(0, signFlip - dt);
    saveT -= dt; if (saveT < 0 && saveT > -1) { saveT = -2; save(); }
    // traffic
    carT -= dt; if (carT <= 0) { spawnCar(); carT = rand(1.4, 2.6); }
    var busy = crossingBusy();
    cars.forEach(function (c) {
      var front = c.x + c.dir * c.len / 2;
      var stopLine = c.dir > 0 ? R.zx - R.zw / 2 - 14 : R.zx + R.zw / 2 + 14;
      var target = 150;
      var before = c.dir > 0 ? front <= stopLine + 2 : front >= stopLine - 2;
      if ((stopped || busy) && before) {
        var d = Math.abs(stopLine - front);
        target = d < 4 ? 0 : Math.min(150, d * 2.2);
      }
      // keep a gap behind the car in front
      cars.forEach(function (o) {
        if (o === c || o.dir !== c.dir) return;
        var ahead = (o.x - c.x) * c.dir;
        if (ahead > 0) { var gap = ahead - (o.len + c.len) / 2; if (gap < 120) target = Math.min(target, Math.max(0, (gap - 30) * 2)); }
      });
      c.v += clamp(target - c.v, -400 * dt, 200 * dt);
      c.x += c.dir * c.v * dt;
      if (c.v < 5 && !c.beeped && Math.random() < dt * 0.15) { c.beeped = true; Sound.beep(); }
      if (c.v > 60) c.beeped = false;
    });
    cars = cars.filter(function (c) { return c.x > -260 && c.x < W + 260; });
    // the road is clear at the crossing when no car is in the crossing (or right on its edge)
    var clear = !cars.some(function (c) { return Math.abs(c.x - R.zx) < R.zw / 2 + c.len / 2 + 6; }) && cars.every(function (c) { return c.v < 30 || Math.abs(c.x - R.zx) > R.zw / 2 + c.len / 2 + 60; });
    // kittens
    kitT -= dt; if (kitT <= 0) { spawnKitten(); kitT = rand(3, 6); }
    var waitingIdx = 0;
    kittens.forEach(function (k) {
      k.t += dt; if (k.bounce > 0) k.bounce -= dt;
      if (k.state === 'walk' || k.state === 'wait') {
        var spot = waitSpot(waitingIdx++);
        var dx = spot.x - k.x, dy = spot.y - k.y, d = Math.hypot(dx, dy);
        if (d > 3) { var sp = Math.min(110 * dt, d); k.x += dx / d * sp; k.y += dy / d * sp; k.hop += dt * 10; }
        else { k.state = 'wait'; k.hop = 0; }
        if (k.state === 'wait' && stopped && clear) {
          // off they go, a little after each other
          k.state = 'cross'; k.t = -waitingIdx * 0.35 + 0.35; k.sx = k.x; k.sy = k.y; k.ex = R.zx + rand(-R.zw * 0.25, R.zw * 0.25); k.ey = R.park; Sound.meow();
        }
      } else if (k.state === 'cross') {
        if (k.t < 0) return;
        var dur = 2.2, f = clamp(k.t / dur, 0, 1);
        k.x = lerp(k.sx, k.ex, f); k.y = lerp(k.sy, k.ey, f); k.hop += dt * 12;
        if (Math.floor(k.hop / Math.PI) !== Math.floor((k.hop - dt * 12) / Math.PI)) Sound.hop();
        if (f >= 1) { k.state = 'park'; k.t = 0; P.crossed++; saveT = 1; if (GG.stat) GG.stat('crossing', 'crossed', 1); Sound.safe(); heart(k.x, k.y - 70); sparkle(k.x, k.y - 30, '#FFD23F', 8, 0.8); }
      } else if (k.state === 'park') {
        k.y -= 40 * dt; k.x += (k.x < W / 2 ? -1 : 1) * 30 * dt; k.hop += dt * 8;
        if (k.t > 2.2) k.gone = true;
      }
    });
    kittens = kittens.filter(function (k) { return !k.gone; });
    // gentle nudges on the buttons
    var waiting = kittens.some(function (k) { return k.state === 'wait'; });
    if (stopped && !waiting && !crossingBusy()) idleStop += dt; else idleStop = 0;
    $('stopBtn').classList.toggle('nudge', !stopped && waiting);
    $('goBtn').classList.toggle('nudge', stopped && idleStop > 3);
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 300) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  }

  /* tapping a kitten makes it meow and bounce; tapping the sign flips it */
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    var r = toScene(e.clientX, e.clientY);
    var g = guardPos();
    if (Math.hypot(r.x - g.sx, r.y - g.sy) < 70) { setStopped(!stopped); return; }
    for (var i = kittens.length - 1; i >= 0; i--) { var k = kittens[i]; if (Math.hypot(r.x - k.x, r.y - (k.y - 30)) < 50) { k.bounce = 0.5; Sound.meow(); return; } }
  });

  /* ================= drawing ================= */
  function drawWorld(c) {
    // park at the top, grass at the bottom
    c.fillStyle = '#A8DF95'; c.fillRect(0, 0, W, R.top - 30);
    c.fillStyle = '#9BD486'; c.fillRect(0, R.bot + 30, W, H - R.bot - 30);
    [[0.12, 0.12], [0.85, 0.08], [0.3, 0.2], [0.72, 0.22]].forEach(function (q) {
      var x = W * q[0], y = (R.top - 30) * (0.3 + q[1]);
      D.shadow(c, x, y + 40, 22, 6);
      c.beginPath(); c.moveTo(x - 6, y + 40); c.lineTo(x + 6, y + 40); c.lineTo(x + 5, y); c.lineTo(x - 5, y); c.closePath(); fillInk(c, '#A86B3C', D.LW.fine);
      D.shape(c, D.ellPath(x, y - 10, 34, 34), '#5CCB75', { lw: D.LW.mid, depth: 8, shine: [x - 12, y - 26, 10, 6, -0.5, 0.35] });
    });
    // pavements
    c.fillStyle = '#E3DDEB'; c.fillRect(0, R.top - 30, W, 30); c.fillRect(0, R.bot, W, 30);
    c.beginPath(); c.moveTo(0, R.top - 30); c.lineTo(W, R.top - 30); c.moveTo(0, R.bot + 30); c.lineTo(W, R.bot + 30); ink(c, 3);
    // road
    c.fillStyle = '#5E5675'; c.fillRect(0, R.top, W, R.bot - R.top);
    c.beginPath(); c.moveTo(0, R.top); c.lineTo(W, R.top); c.moveTo(0, R.bot); c.lineTo(W, R.bot); ink(c, 4);
    c.strokeStyle = '#FFE14D'; c.lineWidth = 6; c.setLineDash([36, 28]); c.beginPath(); c.moveTo(0, (R.top + R.bot) / 2); c.lineTo(W, (R.top + R.bot) / 2); c.stroke(); c.setLineDash([]);
    // the zebra crossing
    c.fillStyle = '#FFFFFF'; for (var y = R.top + 8; y < R.bot - 8; y += 30) rr(c, R.zx - R.zw / 2, y, R.zw, 18, 4), c.fill();
    // stop lines
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(R.zx - R.zw / 2 - 18, (R.top + R.bot) / 2, 6, R.bot - (R.top + R.bot) / 2 - 4); c.fillRect(R.zx + R.zw / 2 + 12, R.top + 4, 6, (R.bot - R.top) / 2 - 4);
  }
  function drawCar(c, car) {
    c.save(); c.translate(car.x, car.y); c.scale(car.dir, 1);
    var L = car.len, h = 54;
    D.shadow(c, 0, h * 0.42, L * 0.5, 9);
    // body (shaded inside, outline last)
    if (!car.body) {
      car.body = new Path2D(); var b = car.body;
      b.moveTo(-L / 2, h * 0.3); b.lineTo(-L / 2, -h * 0.05); b.quadraticCurveTo(-L / 2, -h * 0.2, -L * 0.36, -h * 0.22); b.lineTo(-L * 0.2, -h * 0.62); b.lineTo(L * 0.18, -h * 0.62); b.lineTo(L * 0.34, -h * 0.22); b.lineTo(L * 0.46, -h * 0.18); b.quadraticCurveTo(L / 2, -h * 0.1, L / 2, h * 0.05); b.lineTo(L / 2, h * 0.3); b.closePath();
      car.win = new Path2D(); var w = car.win;
      w.moveTo(-L * 0.16, -h * 0.55); w.lineTo(L * 0.14, -h * 0.55); w.lineTo(L * 0.26, -h * 0.24); w.lineTo(-L * 0.28, -h * 0.24); w.closePath();
    }
    D.shape(c, car.body, car.col, { lw: D.LW.mid, depth: 7 });
    // window: glass, the driver clipped inside it, then the window's outline on top
    c.fillStyle = '#BFE6FF'; c.fill(car.win);
    c.save(); c.clip(car.win); D.shine(c, -L * 0.1, -h * 0.48, 10, 4, 0, 0.6); c.translate(L * 0.02, -h * 0.28); c.scale(car.dir, 1); try { var o = {}; for (var k2 in car.driver) o[k2] = car.driver[k2]; o.size = 40; o.face = car.v < 5 ? 'open' : 'happy'; GGCat.draw(c, o); } catch (e) {} c.restore();
    c.lineWidth = D.LW.fine; c.strokeStyle = INK; c.stroke(car.win);
    // lights
    circle(c, L / 2 - 9, -h * 0.02, 6); c.fillStyle = '#FFF3B0'; c.fill(); ink(c, 2.5);
    // wheels
    [-L * 0.3, L * 0.3].forEach(function (x) { circle(c, x, h * 0.3, 15); fillInk(c, '#3D3650', D.LW.mid); circle(c, x, h * 0.3, 5); c.fillStyle = '#C9C2D6'; c.fill(); });
    c.restore();
  }
  function guardPos() { return { x: R.zx - R.zw / 2 - 70, y: R.bot + 70, sx: R.zx - R.zw / 2 - 30, sy: R.bot - 10 }; }
  function drawGuard(c) {
    var g = guardPos();
    // the crossing-guard cat holding the lollipop sign up in its raised paw (the shared cat's 'wave' pose)
    var gk = 80 / 88, px = g.x + 47 * gk, py = g.y + 38 * gk;
    var flip = signFlip > 0 ? Math.cos(signFlip / 0.35 * Math.PI) : 1;
    D.shadow(c, g.x, g.y + 88 * gk, 40, 8);
    c.beginPath(); c.moveTo(px, py + 6); c.lineTo(g.sx, g.sy); ink(c, 9); c.strokeStyle = '#C9C2D6'; c.lineWidth = 4; c.stroke();
    c.save(); c.translate(g.x, g.y);
    try { GGCat.draw(c, { preset: 'ginger', pose: 'wave', size: 80, face: stopped ? 'open' : 'happy' }); } catch (e) {}
    c.restore();
    c.save(); c.translate(g.sx, g.sy - 34); c.scale(Math.abs(flip) * 0.9 + 0.1, 1);
    D.shape(c, D.ellPath(0, 0, 34, 34), stopped ? '#FF5A5F' : '#3FC46A', { lw: D.LW.big, depth: 6, inside: function (c) {
      circle(c, 0, 0, 26); c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
      if (stopped) {
        // the paw: white beans and pad with a fine ink edge, so it reads at phone size
        c.save(); c.scale(0.8, 0.8); c.translate(-30, -31);
        PAW2D.forEach(function (p) { c.fillStyle = '#fff'; c.fill(p); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(p); });
        c.restore();
      } else { c.beginPath(); c.moveTo(-10, -14); c.lineTo(14, 0); c.lineTo(-10, 14); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); }
    } });
    c.restore();
  }
  function drawKitten(c, k) {
    var hop = Math.abs(Math.sin(k.hop)) * 10 + (k.bounce > 0 ? Math.sin(k.bounce / 0.5 * Math.PI) * 24 : 0);
    var o = {}; for (var key in k.look) o[key] = k.look[key];
    o.pose = k.state === 'park' && k.t < 1.5 ? 'wave' : 'sit'; o.size = 62; o.face = k.state === 'cross' || k.state === 'park' ? 'happy' : (k.bounce > 0 ? 'happy' : 'open');
    c.save(); c.translate(k.x, k.y - 40 - hop);
    D.shadow(c, 0, 40 + hop, 22, 6);
    try { GGCat.draw(c, o); } catch (e) {}
    c.restore();
  }
  function frameScene(c) {
    drawWorld(c);
    // depth order: park kittens, top lane cars, crossing kittens, bottom lane cars, kerb kittens, guard
    var all = [];
    cars.forEach(function (car) { all.push({ y: car.y + 20, f: function () { drawCar(c, car); } }); });
    kittens.forEach(function (k) { all.push({ y: k.y, f: function () { drawKitten(c, k); } }); });
    all.push({ y: guardPos().y + 40, f: function () { drawGuard(c); } });
    all.sort(function (a, b) { return a.y - b.y; }).forEach(function (e) { e.f(); });
    parts.forEach(function (p) {
      var q = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, q * 1.6); c.translate(p.x, p.y);
      if (p.heart) { var r = p.r; c.beginPath(); c.moveTo(0, r * 0.4); c.bezierCurveTo(-r * 1.2, -r * 0.4, -r * 0.5, -r * 1.2, 0, -r * 0.5); c.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.2, -r * 0.4, 0, r * 0.4); c.fillStyle = p.color; c.fill(); ink(c, 2); }
      else { c.rotate(p.life * 4); c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, s = i % 2 ? p.r * 0.6 : p.r * 1.3; c.lineTo(Math.cos(a) * s, Math.sin(a) * s); } c.closePath(); c.fillStyle = p.color; c.fill(); ink(c, 2); }
      c.restore();
    });
  }
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.6, 1), r: rand(5, 9), color: Math.random() < 0.3 ? '#fff' : color }); }
  }
  function heart(x, y) { parts.push({ x: x, y: y, vx: rand(-20, 20), vy: -80, life: 0, max: 1.2, r: 16, color: '#FF7EB6', heart: true, g: -10 }); }

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
      stop: function () { tone({ f: 660, dur: 0.12, gain: 0.1, type: 'square' }); tone({ f: 660, dur: 0.12, gain: 0.08, type: 'square', delay: 0.18 }); },
      go: function () { tone({ f: 523, to: 784, dur: 0.18, gain: 0.1, slide: 0.12 }); },
      beep: function () { var p = rand(0.85, 1.2); tone({ f: 440 * p, dur: 0.09, gain: 0.05, type: 'square' }); tone({ f: 440 * p, dur: 0.12, gain: 0.05, type: 'square', delay: 0.13 }); },
      hop: function () { var p = rand(0.95, 1.3); tone({ f: 700 * p, to: 1050 * p, dur: 0.07, gain: 0.05, type: 'triangle' }); },
      meow: function () { var p = rand(0.95, 1.3); tone({ f: 600 * p, to: 900 * p, dur: 0.16, gain: 0.07, type: 'triangle', slide: 0.12 }); tone({ f: 900 * p, to: 560 * p, dur: 0.22, gain: 0.06, type: 'triangle', delay: 0.14, slide: 0.2 }); },
      safe: function () { [659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.3, gain: 0.08, delay: i * 0.07 }); }); },
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
    frameScene(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, W * K, H * K, 24); ink(ctx, 5);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(controls); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  // a couple of cars already on the road and a kitten on its way
  spawnCar(); cars[0].x = W * 0.25; spawnKitten();
  requestAnimationFrame(frame);

  /* test hook */
  window.__cross = {
    state: function () { return { stopped: stopped, cars: cars.map(function (c) { return { x: Math.round(c.x), v: Math.round(c.v), dir: c.dir }; }), kittens: kittens.map(function (k) { return k.state; }), crossed: P.crossed, zx: R.zx, zw: R.zw }; },
    kitten: spawnKitten
  };
})();
