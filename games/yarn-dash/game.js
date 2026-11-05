/* Yarn Dash – run your cat around the room and collect yarn balls before they roll away (fade out).
   Gold yarn is worth 3, a wind-up toy mouse is worth 5. Fill the basket to finish the level.
   Things to avoid arrive a level at a time, each introduced on a card:
     2 cucumbers (a fright!), 3 toy mice (a bonus), 4 puddles (slippery and slow), 5 a spray bottle (watch it shake),
     6 a robot vacuum (it eats yarn too), 7 a sleeping dog (it wakes up and barks).
   A fright makes the cat jump and drop a couple of yarn balls nearby, which can be picked up again. Nothing to lose.
   Your cat is your own avatar. Saves to GG.setProgress('yarndash', { level, best }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK, rr = D.rr;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }

  /* ================= levels ================= */
  var NEW_THING = {
    1: { kind: 'yarn', title: 'Yarn Dash', note: 'Run around and collect the yarn before it rolls away! Gold yarn is worth 3.' },
    2: { kind: 'cucumber', title: 'Cucumbers!', note: 'Cats get a fright from cucumbers. Run around them!' },
    3: { kind: 'mouse', title: 'Toy mouse!', note: 'Catch the wind-up mouse when it zooms past. It’s worth 5!' },
    4: { kind: 'puddle', title: 'Puddles!', note: 'Splish splash! Puddles make your paws slow and soggy.' },
    5: { kind: 'spray', title: 'Spray bottle!', note: 'When the bottle shakes, it’s about to spray. Get out of the way!' },
    6: { kind: 'vacuum', title: 'Robot vacuum!', note: 'It zooms around and gobbles up yarn. Don’t bump into it!' },
    7: { kind: 'dog', title: 'Sleeping dog!', note: 'Shh! When the dog wakes up it barks. Stay out of its way when it stirs.' }
  };
  function rules(n) {
    return {
      goal: Math.min(45, 12 + 3 * (n - 1)),
      maxYarn: Math.min(7, 4 + Math.floor(n / 2)),
      life: Math.max(4.5, 8.5 - 0.3 * (n - 1)),
      cucumbers: n >= 8 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : 0,
      mouse: n >= 3,
      puddles: n >= 7 ? 3 : n >= 4 ? 2 : 0,
      spray: n >= 5,
      vacuums: n >= 10 ? 2 : n >= 6 ? 1 : 0,
      vacSpeed: Math.min(220, 120 + 10 * (n - 6)),
      dog: n >= 7
    };
  }

  /* ================= saved progress ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('yarndash') || {}; } catch (e) {} if (typeof p.level !== 'number' || p.level < 1) p.level = 1; if (typeof p.best !== 'number') p.best = 0; return p; })();
  function save() { try { GG.setProgress('yarndash', P); } catch (e) {} }

  /* ================= your cat (your avatar) ================= */
  var CAT = { preset: 'ginger' }, catImg = null, catKey = '';
  function catSetup() {
    var p = null;
    try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) { CAT = { preset: 'ginger' }; catImg = null; catKey = ''; return; }
    var av = GGAvatar.normalise(p.avatar, p.color);
    var key = JSON.stringify(av);
    if (key === catKey) return;
    catKey = key;
    // the same cat as the avatar picture (markings matter: a tuxedo cat is black AND white)
    CAT = { color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none' };
    try {
      var svg = GGAvatar.svg(av, 240, { bare: true });
      var img = new Image();
      img.onload = function () { catImg = img; };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch (e) { catImg = null; }
  }
  catSetup();
  window.addEventListener('gg-change', catSetup);
  function bodyColour() { return CAT.color || (window.GGCat && GGCat.PRESETS && GGCat.PRESETS[CAT.preset] && GGCat.PRESETS[CAT.preset].color) || '#FFA94D'; }
  // the avatar picture is 120 wide with the cat's head centred at (60, 66.36), 68 wide
  function drawHead(c, x, y, size, face) {
    if (catImg && !face) { var k = size / 68; c.drawImage(catImg, x - 60 * k, y - 66.36 * k, 120 * k, 120 * k); return; }
    c.save(); c.translate(x, y);
    try { var o = {}; for (var key in CAT) o[key] = CAT[key]; o.size = size * 88 / 104 * 1.05; o.face = face || 'open'; GGCat.draw(c, o); } catch (e) { circle(c, 0, 0, size / 2); c.fillStyle = bodyColour(); c.fill(); D.ink(c, D.LW.mid); }
    c.restore();
  }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 620;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6, bottom = ch - 10;
    var availW = cw - 16, availH = Math.max(120, bottom - top);
    var tall = availW / availH < 1.05;
    var nW = tall ? 600 : 1000, nH = tall ? clamp(Math.round(600 * availH / availW), 760, 1100) : clamp(Math.round(1000 * availH / availW), 560, 720);
    if (G && (nW !== W || nH !== H)) rescale(nW / W, nH / H);
    W = nW; H = nH;
    K = Math.min(availW / W, availH / H);
    OX = (cw - W * K) / 2; OY = top + (availH - H * K) / 2;
  }
  function toRoom(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }
  var EDGE = 34;   // the skirting board
  /* if the room changes shape mid-level (a phone turned), move everything with it */
  function rescale(fx, fy) {
    function m(o) { if (o) { o.x *= fx; o.y *= fy; } }
    m(G.cat); if (G.cat.target) m(G.cat.target);
    G.yarn.forEach(m); G.cukes.forEach(m); G.puddles.forEach(m); G.vacs.forEach(m); m(G.dog); m(G.mouse);
    if (G.spray) G.spray.y *= fy;
  }

  /* ================= game state ================= */
  var G = null, time = 0, parts = [], running = false;
  var CAT_R = 30;
  var YARN_COLS = ['#FF8FAB', '#7CC4FF', '#B48CFF', '#7BD389', '#FF9F43', '#FF5A5F'];
  function freeSpot(minCat, avoid) {
    for (var tries = 0; tries < 60; tries++) {
      var p = { x: rand(EDGE + 50, W - EDGE - 50), y: rand(EDGE + 50, H - EDGE - 50) };
      if (G.cat && dist(p, G.cat) < minCat) continue;
      if (blocked(p, avoid || 0)) continue;
      return p;
    }
    return { x: W / 2, y: H / 2 };
  }
  function blocked(p, pad) {
    for (var i = 0; i < G.cukes.length; i++) if (dist(p, G.cukes[i]) < 70 + pad) return true;
    for (var j = 0; j < G.puddles.length; j++) if (dist(p, G.puddles[j]) < G.puddles[j].r + 20 + pad) return true;
    if (G.dog && dist(p, G.dog) < 110 + pad) return true;
    return false;
  }
  function startLevel(n) {
    var R = rules(n);
    G = { n: n, R: R, got: 0, done: false, cat: { x: W / 2, y: H / 2, vx: 0, vy: 0, dir: 0, target: null, fright: 0, safe: 0, step: 0, slow: false },
      yarn: [], cukes: [], puddles: [], vacs: [], dog: null, mouse: null, spray: null, spawnT: 0.2, mouseT: rand(6, 10) };
    if (R.dog) {
      var corner = pick([[1, 1], [0, 1], [1, 0], [0, 0]]);
      G.dog = { x: corner[0] ? W - 140 : 140, y: corner[1] ? H - 125 : 125, state: 'sleep', t: rand(4, 7), bark: 0 };
    }
    for (var i = 0; i < R.cucumbers; i++) { var p = freeSpot(170, 60); G.cukes.push({ x: p.x, y: p.y, a: rand(0, Math.PI), jig: 0 }); }
    for (var j = 0; j < R.puddles; j++) { var q = freeSpot(170, 50); G.puddles.push({ x: q.x, y: q.y, r: rand(62, 80), seed: Math.random() * 10, in: false }); }
    if (R.spray) G.spray = { side: Math.random() < 0.5 ? 0 : 1, y: rand(H * 0.3, H * 0.7), state: 'wait', t: rand(3, 5) };
    for (var v = 0; v < R.vacuums; v++) { var s = freeSpot(260, 40), a = rand(0, TAU); G.vacs.push({ x: s.x, y: s.y, a: a, turnT: rand(2, 4), spin: 0 }); }
    for (var y = 0; y < 3; y++) addYarn(false);
    renderHud();
    $('levelLabel').textContent = 'Level ' + n;
  }
  function addYarn(near, at) {
    var gold = Math.random() < 0.15;
    var p = at || (G.dog && Math.random() < 0.2 ? nearDog() : freeSpot(110));
    G.yarn.push({ x: p.x, y: p.y, col: pick(YARN_COLS), gold: gold, t: 0, life: (gold ? 0.65 : 1) * G.R.life * (at ? 0.6 : 1), spin: rand(0, TAU), drop: !!at });
  }
  function nearDog() {
    for (var i = 0; i < 20; i++) { var a = rand(0, TAU), r = rand(130, 200), p = { x: G.dog.x + Math.cos(a) * r, y: G.dog.y + Math.sin(a) * r }; if (p.x > EDGE + 40 && p.x < W - EDGE - 40 && p.y > EDGE + 40 && p.y < H - EDGE - 40 && !blocked(p, -100)) return p; }
    return freeSpot(110);
  }

  function renderHud(kind) {
    if (!G) return;
    var g = Math.min(G.got, G.R.goal);
    $('barFill').style.width = (g / G.R.goal * 100) + '%';
    $('count').textContent = g + '/' + G.R.goal;
    if (kind) { var b = $('basket'); b.classList.remove('bump', 'ouch'); void b.offsetWidth; b.classList.add(kind); }
  }

  /* a fright: the cat jumps, drops a couple of yarn balls nearby (which can be picked up again) */
  function fright(from, what) {
    var C = G.cat;
    if (C.safe > 0 || C.fright > 0 || G.done) return;
    C.fright = 0.8; C.safe = 1.8;
    var a = Math.atan2(C.y - from.y, C.x - from.x);
    C.vx = Math.cos(a) * 420; C.vy = Math.sin(a) * 420; C.target = null;
    var lose = Math.min(2, G.got);
    G.got -= lose;
    for (var i = 0; i < lose; i++) {
      var b = a + rand(-1.2, 1.2), r = rand(80, 120);
      var p = { x: clamp(C.x + Math.cos(b) * r, EDGE + 30, W - EDGE - 30), y: clamp(C.y + Math.sin(b) * r, EDGE + 30, H - EDGE - 30) };
      addYarn(false, p);
    }
    Sound.fright(); buzz([30, 40, 30]);
    renderHud(lose ? 'ouch' : null);
    if (what) say(what, 1.4);
  }

  function collect(y) {
    var pts = y.gold ? 3 : 1;
    G.got += pts;
    sparkle(y.x, y.y, y.gold ? '#FFD23F' : y.col, y.gold ? 14 : 7, y.gold ? 1.2 : 0.8);
    textPart('+' + pts, y.x, y.y - 30, y.gold ? '#E0A100' : '#5E5675');
    (y.gold ? Sound.gold : Sound.grab)();
    renderHud('bump');
    if (G.got >= G.R.goal) levelDone();
  }

  function levelDone() {
    G.done = true; running = false;
    var n = G.n;
    if (n >= P.level) P.level = n + 1;
    if (n > P.best) P.best = n;
    save();
    if (GG.stat) GG.stat('yarn-dash', 'levels', 1);
    Sound.win(); buzz(40);
    for (var i = 0; i < 4; i++) sparkle(rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.6), pick(YARN_COLS), 16, 1.3);
    setTimeout(function () { showCard(n + 1, true); }, 1300);
  }

  /* ================= update ================= */
  var keys = {}, hold = null;
  function update(dt) {
    if (!G || !running) return;
    var C = G.cat, R = G.R;
    C.safe = Math.max(0, C.safe - dt);
    // movement
    var speed = 340;
    C.slow = G.puddles.some(function (p) { return dist(p, C) < p.r; });
    if (C.slow) speed *= 0.45;
    if (C.zoom > 0) { C.zoom -= dt; speed *= 1.35; }
    var dx = 0, dy = 0;
    if (keys.left) dx -= 1; if (keys.right) dx += 1; if (keys.up) dy -= 1; if (keys.down) dy += 1;
    if (C.fright > 0) {
      C.fright -= dt;
      C.x += C.vx * dt; C.y += C.vy * dt; C.vx *= Math.pow(0.02, dt); C.vy *= Math.pow(0.02, dt);
    } else {
      if (dx || dy) { var l = Math.hypot(dx, dy); C.vx = dx / l * speed; C.vy = dy / l * speed; C.target = null; }
      else if (C.target) {
        var tx = C.target.x - C.x, ty = C.target.y - C.y, d = Math.hypot(tx, ty);
        if (d < 6) { C.vx = C.vy = 0; if (!hold) C.target = null; }
        else { var s = Math.min(speed, d / dt); C.vx = tx / d * s; C.vy = ty / d * s; }
      } else { C.vx = C.vy = 0; }
      C.x += C.vx * dt; C.y += C.vy * dt;
    }
    C.x = clamp(C.x, EDGE + CAT_R, W - EDGE - CAT_R); C.y = clamp(C.y, EDGE + CAT_R, H - EDGE - CAT_R);
    var moving = Math.hypot(C.vx, C.vy) > 20;
    if (moving) { C.dir = Math.atan2(C.vy, C.vx); C.step += dt * (C.slow ? 8 : 16); }
    // puddle splashes
    G.puddles.forEach(function (p) {
      var inside = dist(p, C) < p.r;
      if (inside && !p.in) { Sound.splash(); for (var i = 0; i < 6; i++) parts.push({ x: C.x, y: C.y, vx: rand(-120, 120), vy: rand(-200, -60), life: 0, max: 0.5, r: rand(4, 7), color: '#9EDCFF', kind: 'dot' }); }
      p.in = inside;
    });
    // yarn: spawn, fade, collect
    G.spawnT -= dt;
    if (G.spawnT <= 0 && G.yarn.length < R.maxYarn) { addYarn(); G.spawnT = rand(0.6, 1.2); }
    for (var i = G.yarn.length - 1; i >= 0; i--) {
      var y = G.yarn[i]; y.t += dt;
      if (dist(y, C) < CAT_R + 22 && C.fright <= 0) { G.yarn.splice(i, 1); collect(y); if (G.done) return; continue; }
      if (y.t > y.life) { G.yarn.splice(i, 1); puff(y.x, y.y); }
    }
    // cucumbers
    G.cukes.forEach(function (k) { k.jig = Math.max(0, k.jig - dt); if (dist(k, C) < CAT_R + 30) { k.jig = 0.5; fright(k, 'Eek, a cucumber!'); } });
    // toy mouse
    if (R.mouse) {
      if (!G.mouse) { G.mouseT -= dt; if (G.mouseT <= 0) launchMouse(); }
      else {
        var M = G.mouse; M.t += dt;
        M.x += Math.cos(M.a) * M.sp * dt; M.y += Math.sin(M.a) * M.sp * dt;
        M.wob = Math.sin(M.t * 14) * 0.2;
        if (Math.random() < dt * 0.8) M.a += rand(-0.6, 0.6);
        if (M.x < EDGE + 20 || M.x > W - EDGE - 20) { if (M.t > 1.5) G.mouse = null; else M.a = Math.PI - M.a; }
        if (G.mouse && (M.y < EDGE + 20 || M.y > H - EDGE - 20)) { M.a = -M.a; M.y = clamp(M.y, EDGE + 21, H - EDGE - 21); }
        if (G.mouse && dist(M, C) < CAT_R + 20 && C.fright <= 0) {
          G.mouse = null; G.mouseT = rand(9, 14); G.got += 5; C.zoom = 3;
          sparkle(M.x, M.y, '#C9C2D6', 14, 1.2); textPart('+5', M.x, M.y - 30, '#7E55D6'); Sound.gold(); renderHud('bump');
          say('You caught the mouse! Zoom!', 1.4);
          if (G.got >= R.goal) { levelDone(); return; }
        }
        if (G.mouse && G.mouse.t > 9) { G.mouse = null; G.mouseT = rand(8, 12); }
      }
    }
    // spray bottle: wait, shake (a warning), spray
    if (G.spray) {
      var S = G.spray; S.t -= dt;
      if (S.state === 'wait' && S.t <= 0) { S.state = 'shake'; S.t = 1.3; S.y = clamp(S.y + rand(-140, 140), H * 0.2, H * 0.8); Sound.rattle(); }
      else if (S.state === 'shake' && S.t <= 0) { S.state = 'spray'; S.t = 1.0; Sound.spray(); }
      else if (S.state === 'spray') {
        if (Math.random() < dt * 40) { var o = sprayOrigin(), aa = sprayAngle() + rand(-0.3, 0.3), sp = rand(250, 520); parts.push({ x: o.x, y: o.y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: 0, max: 0.8, r: rand(4, 8), color: '#BFE6FF', kind: 'dot', g: 0 }); }
        if (inSpray(C)) fright(sprayOrigin(), 'Splash! Spray bottle!');
        if (S.t <= 0) { S.state = 'wait'; S.t = rand(3.5, 6); }
      }
    }
    // robot vacuums: roll about, bounce off walls, eat yarn, bump the cat
    G.vacs.forEach(function (v) {
      v.turnT -= dt; v.spin += dt * 8;
      if (v.turnT <= 0) { v.a += rand(-1.2, 1.2); v.turnT = rand(2, 4); }
      v.x += Math.cos(v.a) * R.vacSpeed * dt; v.y += Math.sin(v.a) * R.vacSpeed * dt;
      if (v.x < EDGE + 40 || v.x > W - EDGE - 40) { v.a = Math.PI - v.a; v.x = clamp(v.x, EDGE + 41, W - EDGE - 41); Sound.bonk(); }
      if (v.y < EDGE + 40 || v.y > H - EDGE - 40) { v.a = -v.a; v.y = clamp(v.y, EDGE + 41, H - EDGE - 41); Sound.bonk(); }
      for (var k = G.yarn.length - 1; k >= 0; k--) if (dist(G.yarn[k], v) < 50) { var yy = G.yarn.splice(k, 1)[0]; puff(yy.x, yy.y); Sound.slurp(); }
      if (dist(v, C) < CAT_R + 38) fright(v, 'Bonk! The robot vacuum!');
    });
    // the dog: sleeps, stirs (a warning), wakes and barks
    if (G.dog) {
      var D = G.dog; D.t -= dt; D.bark = Math.max(0, D.bark - dt);
      if (D.state === 'sleep' && D.t <= 0) { D.state = 'stir'; D.t = 1.6; Sound.snuffle(); }
      else if (D.state === 'stir' && D.t <= 0) { D.state = 'awake'; D.t = 2.4; D.bark = 0.6; Sound.woof(); if (dist(D, C) < 200) fright(D, 'Woof! The dog woke up!'); }
      else if (D.state === 'awake') { if (dist(D, C) < 120) fright(D, 'Woof!'); if (D.t <= 0) { D.state = 'sleep'; D.t = rand(6, 10); } }
    }
  }
  function launchMouse() {
    var fromLeft = Math.random() < 0.5;
    G.mouse = { x: fromLeft ? EDGE + 22 : W - EDGE - 22, y: rand(H * 0.2, H * 0.8), a: fromLeft ? rand(-0.4, 0.4) : Math.PI + rand(-0.4, 0.4), sp: 230, t: 0, wob: 0 };
    Sound.wind();
  }
  function sprayOrigin() { var S = G.spray; return { x: S.side ? W - EDGE - 6 : EDGE + 6, y: S.y }; }
  function sprayAngle() { return G.spray.side ? Math.PI : 0; }
  var SPRAY_LEN = 0.55, SPRAY_HALF = 0.32;
  function inSpray(p) {
    var o = sprayOrigin(), dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    if (d > W * SPRAY_LEN) return false;
    var a = Math.atan2(dy, dx) - sprayAngle();
    while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU;
    return Math.abs(a) < SPRAY_HALF + 18 / Math.max(d, 1);
  }

  /* ================= drawing ================= */
  /* Outline weights are divided by LS, the scale things are being drawn at (1 in the room; the card pictures
     set it while they draw bigger), so every outline is the house weight on screen. */
  var LS = 1;
  function ink(c, w) { D.ink(c, (w || D.LW.mid) / LS); }
  function lw(w) { return w / LS; }
  /* a soft shadow that turns with a long thing (the shared one is always level) */
  function turnedShadow(c, x, y, rx, ry, a) { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = 'rgba(42,35,64,.16)'; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill(); c.restore(); }

  /* the floor, rug and skirting never change, so they're drawn once into a picture (redrawn when the screen changes) */
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
    c.fillStyle = D.tone(c, '#E8C9A0', EDGE, H - EDGE); c.fillRect(0, 0, W, H);
    c.strokeStyle = '#D9B68A'; c.lineWidth = 3; c.lineCap = 'butt';
    for (var y = EDGE; y < H; y += 56) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); var off = ((y / 56) % 2) * 120; for (var x = off; x < W; x += 240) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 56); c.stroke(); } }
    // a big round rug in the middle, its stitching inside the edge
    var rx = Math.min(W, H) * 0.34, ry = Math.min(W, H) * 0.26;
    D.shadow(c, W / 2 + 4, H / 2 + 8, rx, ry);
    D.shape(c, D.ellPath(W / 2, H / 2, rx, ry), D.tone(c, '#C7EBD2', H / 2 - ry, H / 2 + ry), { lw: D.LW.mid, depth: 12, inside: function (c) {
      c.beginPath(); c.ellipse(W / 2, H / 2, rx * 0.8, ry * 0.73, 0, 0, TAU); c.strokeStyle = '#9FD8B2'; c.lineWidth = 6; c.lineCap = 'round'; c.setLineDash([16, 12]); c.stroke(); c.setLineDash([]);
    } });
    // skirting boards, with a soft shade where they meet the floor
    var room = D.rrPath(EDGE, EDGE, W - EDGE * 2, H - EDGE * 2, 10);
    var frame = new Path2D(); frame.rect(0, 0, W, H); frame.addPath(room);
    c.fillStyle = D.tone(c, '#FFF1DC', 0, H); c.fill(frame, 'evenodd');
    c.save(); c.clip(room); c.lineWidth = 14; c.strokeStyle = 'rgba(42,35,64,.08)'; c.stroke(room); c.restore();
    c.lineWidth = D.LW.mid; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(room);
  }
  function drawYarnBall(c, x, y, r, col, gold, spin) {
    c.save(); c.translate(x, y);
    D.shadow(c, 3, r * 0.9, r * 0.9, r * 0.3);
    c.rotate(spin || 0);
    // a loose end, starting under the ball so the ball covers the join
    c.beginPath(); c.moveTo(r * 0.45, r * 0.5); c.quadraticCurveTo(r * 1.3, r * 0.9, r * 1.1, r * 1.3); c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 3 + lw(D.LW.fine) * 2; c.stroke(); c.strokeStyle = gold ? '#FFC21A' : col; c.lineWidth = 3; c.stroke();
    D.shape(c, D.ellPath(0, 0, r, r), D.tone(c, gold ? '#FFD23F' : col, -r, r), { lw: lw(D.LW.fine), depth: r * 0.2, shade: 'rgba(42,35,64,.15)', inside: function (c) {
      c.strokeStyle = gold ? '#C98A00' : 'rgba(42,35,64,.35)'; c.lineWidth = 2.5;
      for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r, i * r * 0.32 - r * 0.3); c.quadraticCurveTo(0, i * r * 0.32 + r * 0.3, r, i * r * 0.32 - r * 0.3); c.stroke(); }
      c.beginPath(); c.moveTo(-r * 0.2, -r); c.quadraticCurveTo(r * 0.5, 0, -r * 0.2, r); c.stroke();
    }, shine: gold ? [-r * 0.4, -r * 0.45, r * 0.32, r * 0.18, -0.6, 0.6] : null });
    c.restore();
  }
  var CUKE = D.rrPath(-46, -17, 92, 34, 17);
  function drawCucumber(c, x, y, a, jig) {
    a += jig > 0 ? Math.sin(jig * 40) * 0.15 : 0;
    turnedShadow(c, x + 3, y + 10, 48, 14, a);
    c.save(); c.translate(x, y); c.rotate(a);
    // the shade sits lower right on screen however it's turned
    var cs = Math.cos(-a), sn = Math.sin(-a);
    D.shape(c, CUKE, '#4FAE5E', { lw: lw(D.LW.mid), depth: 1, dx: -4 * cs + 6 * sn, dy: -4 * sn - 6 * cs, inside: function (c) {
      c.strokeStyle = '#7BD389'; c.lineWidth = 4; c.lineCap = 'round'; [-8, 4].forEach(function (yy) { c.beginPath(); c.moveTo(-34, yy); c.lineTo(34, yy); c.stroke(); });
      c.fillStyle = '#2E7D3A'; [[-26, -8], [-6, 9], [14, -9], [30, 6]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], 2.2, 0, TAU); c.fill(); });
      // the cut end, inside the tip
      c.beginPath(); c.ellipse(41, 0, 4, 11, 0, 0, TAU); c.fillStyle = '#DDF6CF'; c.fill(); ink(c, D.LW.fine);
    } });
    c.restore();
  }
  function puddlePath(p) {
    var q = new Path2D();
    for (var i = 0; i <= 20; i++) { var a = i / 20 * TAU, r = p.r * (0.86 + 0.14 * Math.sin(a * 3 + p.seed)); q.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.78); }
    q.closePath(); return q;
  }
  function drawPuddle(c, p) {
    c.save(); c.translate(p.x, p.y);
    if (!p.path) p.path = puddlePath(p);
    D.shape(c, p.path, 'rgba(126,196,255,.8)', { lw: lw(D.LW.fine), depth: 8, shade: 'rgba(59,143,214,.25)', inside: function (c) {
      var rp = (time * 0.6 + p.seed) % 1;
      c.beginPath(); c.ellipse(0, 0, p.r * 0.6 * rp + 0.1, p.r * 0.45 * rp + 0.1, 0, 0, TAU); c.strokeStyle = 'rgba(255,255,255,' + (1 - rp) * 0.8 + ')'; c.lineWidth = 3; c.stroke();
    }, shine: [-p.r * 0.3, -p.r * 0.25, p.r * 0.18, p.r * 0.07, -0.4, 0.7] });
    c.restore();
  }
  /* the spray bottle, facing right with its nozzle at (42, -4) */
  function drawBottle(c) {
    // nozzle head first, so the bottle covers the join
    D.shape(c, D.rrPath(12, -12, 30, 16, 5), '#FF6B57', { lw: lw(D.LW.fine), depth: 3 });
    c.beginPath(); c.moveTo(22, 4); c.lineTo(27, 20); ink(c, D.LW.mid);
    D.shape(c, D.rrPath(-10, -26, 34, 52, 10), D.tone(c, '#7CC4FF', -26, 26), { lw: lw(D.LW.mid), depth: 6, inside: function (c) {
      c.fillStyle = '#fff'; c.fill(D.rrPath(-4, -10, 22, 18, 4)); c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 2; c.stroke(D.rrPath(-4, -10, 22, 18, 4));
    }, shine: [-3, -16, 4, 6, 0, 0.5] });
  }
  function drawSprayBottle(c) {
    var S = G.spray, o = sprayOrigin();
    if (S.state === 'shake' || S.state === 'spray') {
      // the area it sprays: dotted while it shakes, misty while it sprays
      c.save(); c.translate(o.x, o.y); c.rotate(sprayAngle());
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, W * SPRAY_LEN, -SPRAY_HALF, SPRAY_HALF); c.closePath();
      if (S.state === 'shake') { c.fillStyle = 'rgba(126,196,255,' + (0.12 + 0.1 * Math.sin(time * 20)) + ')'; c.fill(); c.setLineDash([12, 10]); c.strokeStyle = '#3B8FD6'; c.lineWidth = 3; c.stroke(); c.setLineDash([]); }
      else { c.fillStyle = 'rgba(190,230,255,.45)'; c.fill(); }
      c.restore();
    }
    var shake = S.state === 'shake' ? Math.sin(time * 50) * 5 : 0;
    c.save(); c.translate(o.x + (S.side ? 10 : -10), o.y + shake); if (S.side) c.scale(-1, 1);
    drawBottle(c);
    c.restore();
  }
  var VAC = D.ellPath(0, 0, 40, 40), VAC_TOP = D.ellPath(0, 0, 30, 30);
  function drawVacuum(c, v) {
    c.save(); c.translate(v.x, v.y);
    D.shadow(c, 4, 10, 42, 36);
    // spinning side brush, peeking out from underneath
    c.save(); c.rotate(v.a); c.translate(28, 24); c.rotate(v.spin);
    c.strokeStyle = INK; c.lineWidth = lw(D.LW.fine); c.lineCap = 'round'; for (var i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(16, 0); c.stroke(); }
    c.restore();
    D.shape(c, VAC, D.tone(c, '#5E5675', -40, 40), { lw: lw(D.LW.mid), depth: 6, inside: function (c) {
      // the bumper along the front, inside the body
      c.save(); c.rotate(v.a); c.fillStyle = '#3D3650'; c.fillRect(31, -30, 12, 60); c.restore();
    } });
    D.shape(c, VAC_TOP, '#8E86A0', { lw: lw(D.LW.fine), depth: 5, inside: function (c) {
      c.save(); c.rotate(v.a); c.beginPath(); c.arc(16, 0, 6, 0, TAU); c.fillStyle = Math.sin(time * 6) > 0 ? '#7BD389' : '#4FAE5E'; c.fill(); ink(c, D.LW.fine); c.restore();
    }, shine: [-12, -14, 10, 6, -0.6, 0.35] });
    c.restore();
  }
  var DOG_BED = D.ellPath(0, 10, 92, 70), DOG_BED_IN = D.ellPath(0, 10, 72, 52), DOG_BODY = D.ellPath(6, 18, 56, 38), DOG_HEAD = D.ellPath(0, 0, 34, 28);
  function drawDog(c) {
    var D0 = G.dog;
    c.save(); c.translate(D0.x, D0.y);
    // bed
    D.shadow(c, 4, 22, 92, 64);
    D.shape(c, DOG_BED, D.tone(c, '#B48CFF', -60, 80), { lw: lw(D.LW.mid), depth: 10 });
    D.shape(c, DOG_BED_IN, '#E2D3FF', { lw: lw(D.LW.fine), depth: 0, inside: function (c) { c.fillStyle = 'rgba(42,35,64,.1)'; c.beginPath(); c.ellipse(8, 20, 72, 52, 0, 0, TAU); c.rect(-200, -200, 400, 400); c.fill('evenodd'); } });
    var up = D0.state === 'awake' ? 1 : D0.state === 'stir' ? 0.4 : 0;
    // tail first, starting inside the body, so the body covers the join
    c.beginPath(); c.moveTo(50, 20); c.quadraticCurveTo(78, 8 + Math.sin(time * (up ? 14 : 2)) * 6, 70, -6); c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 6 + lw(D.LW.mid) * 2; c.stroke(); c.strokeStyle = '#C98B5B'; c.lineWidth = 6; c.stroke();
    // body curled
    D.shape(c, DOG_BODY, D.tone(c, '#C98B5B', -20, 56), { lw: lw(D.LW.mid), depth: 8, inside: function (c) { c.beginPath(); c.ellipse(18, 30, 26, 12, 0.3, 0, TAU); c.fillStyle = '#E6B98A'; c.fill(); } });
    // head (lifts when awake)
    c.save(); c.translate(-30, 10 - up * 26);
    D.shape(c, DOG_HEAD, D.tone(c, '#C98B5B', -28, 28), { lw: lw(D.LW.mid), depth: 6, inside: function (c) {
      c.beginPath(); c.ellipse(0, 12, 16, 12, 0, 0, TAU); c.fillStyle = '#E6B98A'; c.fill();
    } });
    var flop = up ? Math.sin(time * 10) * 0.15 : 0;
    [[-28, 0.4 + flop], [28, -0.4 - flop]].forEach(function (e) { D.shape(c, D.ellPath(e[0], 4, 12, 22, e[1]), '#7A4E2D', { lw: lw(D.LW.fine), depth: 3 }); });
    c.beginPath(); c.ellipse(0, 6, 6, 4.5, 0, 0, TAU); c.fillStyle = INK; c.fill();
    if (D0.state === 'sleep') { c.beginPath(); c.moveTo(-16, -6); c.quadraticCurveTo(-10, -1, -4, -6); c.moveTo(4, -6); c.quadraticCurveTo(10, -1, 16, -6); ink(c, D.LW.fine); }
    else if (D0.state === 'stir') { c.beginPath(); c.moveTo(-16, -6); c.quadraticCurveTo(-10, -1, -4, -6); ink(c, D.LW.fine); c.beginPath(); c.arc(10, -6, 4.5, 0, TAU); c.fillStyle = INK; c.fill(); }
    else { c.fillStyle = INK; c.beginPath(); c.arc(-10, -6, 5, 0, TAU); c.fill(); c.beginPath(); c.arc(10, -6, 5, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, 20, 7, 6, 0, 0, TAU); c.fillStyle = '#FF7FA6'; c.fill(); ink(c, D.LW.fine); }
    c.restore();
    c.restore();
    if (D0.state === 'sleep') {
      c.font = '800 30px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#7A6F8E'; c.textAlign = 'center';
      var zt = (time * 0.5) % 1; c.globalAlpha = 1 - zt; c.fillText('z', D0.x + 30 + zt * 20, D0.y - 50 - zt * 40); c.globalAlpha = 1;
    }
    if (D0.state === 'stir') { c.font = '800 40px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#FF6B57'; c.textAlign = 'center'; c.fillText('!', D0.x - 30, D0.y - 60 + Math.sin(time * 12) * 4); }
    if (D0.bark > 0) {
      var k = 1 - D0.bark / 0.6;
      circle(c, D0.x, D0.y, 60 + k * 150); c.strokeStyle = 'rgba(255,107,87,' + (1 - k) + ')'; c.lineWidth = 8; c.stroke();
      c.font = '800 44px "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.lineWidth = 7; c.lineJoin = 'round'; c.strokeStyle = '#fff'; c.strokeText('WOOF!', D0.x, D0.y - 90); c.fillStyle = '#FF6B57'; c.fillText('WOOF!', D0.x, D0.y - 90);
    }
    if (D0.state === 'awake' && D0.bark <= 0) { circle(c, D0.x, D0.y, 120); c.setLineDash([10, 10]); c.strokeStyle = 'rgba(255,107,87,.5)'; c.lineWidth = 4; c.stroke(); c.setLineDash([]); }
  }
  var TOY_MOUSE = new Path2D('M-26 0Q-24 -18 4 -16Q28 -12 30 0Q28 12 4 16Q-24 18 -26 0Z');
  function drawMouse(c, M) {
    var a = M.a + M.wob;
    turnedShadow(c, M.x + 2, M.y + 6, 30, 18, a);
    c.save(); c.translate(M.x, M.y); c.rotate(a);
    var cs = Math.cos(-a), sn = Math.sin(-a);
    // tail, starting under the body
    c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(-46, -4 + Math.sin(time * 20) * 6, -56, 6); c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 4 + lw(D.LW.fine) * 2; c.stroke(); c.strokeStyle = '#FF8FAB'; c.lineWidth = 4; c.stroke();
    D.shape(c, TOY_MOUSE, '#C9C2D6', { lw: lw(D.LW.mid), depth: 1, dx: -4 * cs + 6 * sn, dy: -4 * sn - 6 * cs, shade: 'rgba(42,35,64,.14)', inside: function (c) {
      c.fillStyle = INK; c.beginPath(); c.arc(20, -6, 2.6, 0, TAU); c.fill(); c.beginPath(); c.arc(20, 6, 2.6, 0, TAU); c.fill();
    } });
    [-16, 16].forEach(function (y) { D.shape(c, D.ellPath(8, y, 8, 8), '#FFB3C7', { lw: lw(D.LW.fine), depth: 0 }); });
    c.beginPath(); c.arc(30, 0, 3.5, 0, TAU); c.fillStyle = '#FF7FA6'; c.fill(); ink(c, D.LW.fine);
    // the wind-up key on its back
    c.save(); c.translate(-8, 0); c.rotate(time * 10);
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.strokeStyle = INK; c.lineWidth = 4 + lw(D.LW.fine) * 2; c.stroke(); c.strokeStyle = '#E0A100'; c.lineWidth = 4; c.stroke();
    [-12, 12].forEach(function (x) { D.shape(c, D.ellPath(x, 0, 5, 5), '#FFD23F', { lw: lw(D.LW.fine), depth: 0 }); });
    c.restore();
    c.restore();
  }
  /* your cat, from above-ish: body and tail pointing where it's running, your avatar's head on top */
  var CAT_BODY = D.ellPath(0, 10, 34, 20);
  function drawCat(c, C, size) {
    var col = bodyColour();
    var hop = C.fright > 0 ? Math.sin((0.8 - C.fright) / 0.8 * Math.PI) * 40 : 0;
    var blink = C.safe > 0 && C.fright <= 0 && Math.sin(time * 30) > 0.3;
    c.save(); c.translate(C.x, C.y);
    D.shadow(c, 0, 26, 36 - hop * 0.2, 12);
    if (blink) c.globalAlpha = 0.55;
    c.translate(0, -hop);
    var face = Math.cos(C.dir) >= 0 ? 1 : -1;
    var run = Math.hypot(C.vx, C.vy) > 20 ? Math.sin(C.step) : 0;
    c.save(); c.scale(face, 1);
    // tail, starting inside the body
    c.beginPath(); c.moveTo(-22, 4); c.quadraticCurveTo(-56, -6 + run * 8, -50, -34 + Math.sin(time * 4) * 4); c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 13; c.stroke(); c.strokeStyle = col; c.lineWidth = 7; c.stroke();
    // legs, tucked under the body
    [[-16, 1], [-4, -1], [10, 1], [22, -1]].forEach(function (l) { D.shape(c, D.ellPath(l[0] + run * 5 * l[1], 26 - Math.max(0, run * l[1]) * 4, 7, 6), col, { lw: D.LW.fine, depth: 0 }); });
    // body, shaded lower right on screen whichever way it runs
    D.shape(c, CAT_BODY, D.tone(c, col, -10, 30), { lw: D.LW.mid, depth: 1, dx: -5 * face, dy: -7 });
    c.restore();
    var hx = face * 22, hy = -12 + (run ? Math.abs(run) * -3 : 0);
    drawHead(c, hx, hy, size, C.fright > 0 ? 'surprised' : null);
    if (C.fright > 0) { c.font = '800 40px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#FF6B57'; c.textAlign = 'center'; c.fillText('!', hx + 30, hy - 40); }
    c.restore();
    if (C.zoom > 0) for (var i = 0; i < 3; i++) { c.beginPath(); var za = C.dir + Math.PI, r = 40 + i * 10; c.moveTo(C.x + Math.cos(za) * r, C.y + Math.sin(za) * r + (i - 1) * 12); c.lineTo(C.x + Math.cos(za) * (r + 24), C.y + Math.sin(za) * (r + 24) + (i - 1) * 12); c.strokeStyle = 'rgba(255,210,63,.8)'; c.lineWidth = 4; c.lineCap = 'round'; c.stroke(); }
  }
  function drawScene(c) {
    drawFloor(c);
    if (!G) return;
    G.puddles.forEach(function (p) { drawPuddle(c, p); });
    if (G.dog) drawDog(c);
    if (G.spray) drawSprayBottle(c);
    G.cukes.forEach(function (k) { drawCucumber(c, k.x, k.y, k.a, k.jig); });
    G.yarn.forEach(function (y) {
      var left = y.life - y.t, a = left < 1.6 ? (Math.sin(time * 18) > 0 ? 0.35 : 0.9) * Math.max(0.2, left / 1.6) : 1;
      var s = y.drop ? 1 : easeOut(y.t / 0.3);
      c.save(); c.globalAlpha = a;
      if (y.gold) { var tw = (time * 2 + y.spin) % 1; c.save(); c.translate(y.x, y.y); c.rotate(time); for (var i = 0; i < 4; i++) { c.rotate(TAU / 4); star(c, 6, 30 + tw * 6); c.fillStyle = '#FFE14D'; c.fill(); } c.restore(); }
      drawYarnBall(c, y.x, y.y, 20 * s, y.col, y.gold, y.spin + time * 0.3);
      c.restore();
    });
    if (G.mouse) drawMouse(c, G.mouse);
    G.vacs.forEach(function (v) { drawVacuum(c, v); });
    drawCat(c, G.cat, 62);
    if (G.cat.target && hold) { circle(c, G.cat.target.x, G.cat.target.y, 14 + Math.sin(time * 8) * 3); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 4; c.stroke(); }
  }

  /* ================= particles ================= */
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.5, 0.9), r: rand(4, 8), color: Math.random() < 0.4 ? '#fff' : color, kind: Math.random() < 0.5 ? 'star' : 'dot', spin: rand(-5, 5) }); }
  }
  function puff(x, y) { for (var i = 0; i < 5; i++) parts.push({ x: x + rand(-10, 10), y: y + rand(-10, 10), vx: rand(-40, 40), vy: rand(-60, -20), life: 0, max: 0.5, r: rand(8, 12), color: 'rgba(255,255,255,.8)', kind: 'dot', g: 0 }); }
  function textPart(text, x, y, color) { parts.push({ x: x, y: y, vx: 0, vy: -60, life: 0, max: 0.9, r: 30, color: color, kind: 'text', text: text, g: 0 }); }
  function star(c, r, at) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo((at || 0) + Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y);
      if (p.kind === 'text') { c.font = '800 ' + p.r + 'px "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.strokeText(p.text, 0, 0); c.fillStyle = p.color; c.fillText(p.text, 0, 0); c.restore(); return; }
      c.rotate(p.life * (p.spin || 0));
      if (p.kind === 'star') star(c, p.r * 1.3); else { c.beginPath(); c.arc(0, 0, p.r * 0.6, 0, TAU); }
      c.fillStyle = p.color; c.fill();
      c.restore();
    });
  }

  /* ================= cards between levels ================= */
  /* The card picture is a 440 x 300 canvas shown about 220 wide, so it draws at twice the size;
     LS keeps every outline at the house weight however big each thing is drawn. */
  function drawCardPic(kind) {
    var cv = $('cardPic'), c = cv.getContext('2d'), px = 2;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.lineJoin = 'round'; c.lineCap = 'round';
    LS = 1 / px;
    D.shape(c, D.rrPath(5, 5, cv.width - 10, cv.height - 10, 26), D.tone(c, '#E8C9A0', 0, cv.height), { lw: D.LW.big * px, depth: 0 });
    c.save(); c.translate(cv.width / 2, cv.height / 2 + 10);
    function big(k) { c.scale(k, k); LS = k / px; }
    if (kind === 'yarn') { drawYarnBall(c, -110, 30, 34, '#FF8FAB', false, 0.3); drawYarnBall(c, 0, -30, 34, '#FFD23F', true, 1); drawYarnBall(c, 110, 30, 34, '#7CC4FF', false, 2); }
    else if (kind === 'cucumber') { big(2); drawCucumber(c, 0, 0, -0.3, 0); }
    else if (kind === 'mouse') { big(2.2); drawMouse(c, { x: 0, y: 0, a: 0, wob: 0 }); }
    else if (kind === 'puddle') { big(1.6); drawPuddle(c, { x: 0, y: 0, r: 80, seed: 2 }); }
    else if (kind === 'spray') { big(2.4); c.translate(-16, 0); drawBottle(c); for (var i = 0; i < 6; i++) { circle(c, 54 + i * 8, -4 + Math.sin(i * 2) * 8, 3); c.fillStyle = '#7CC4FF'; c.fill(); } }
    else if (kind === 'vacuum') { big(2); drawVacuum(c, { x: 0, y: 0, a: 0, spin: 0.5 }); }
    else if (kind === 'dog') { var keep = G; G = { dog: { x: 0, y: 0, state: 'sleep', t: 1, bark: 0 } }; big(1.3); drawDog(c); G = keep; }
    else { drawYarnBall(c, 0, 0, 50, '#B48CFF', false, 0); }
    c.restore();
    LS = 1;
  }
  var cardLevel = 1;
  function showCard(n, after) {
    running = false; hold = null; keys = {};
    cardLevel = n;
    var nt = NEW_THING[n];
    if (after) {
      $('cardTitle').textContent = 'Level ' + (n - 1) + ' done!';
      $('cardNote').textContent = nt ? 'Next up: ' + nt.title.replace('!', '').toLowerCase() + '!' : 'Basket full! Ready for level ' + n + '?';
      $('cardTip').textContent = nt ? nt.note : 'More yarn to catch, and it rolls away a little faster.';
      drawCardPic(nt ? nt.kind : 'basket');
    } else {
      var show = nt || NEW_THING[1];
      $('cardTitle').textContent = n === 1 ? 'Yarn Dash' : 'Level ' + n;
      $('cardNote').textContent = n === 1 ? NEW_THING[1].note : nt ? nt.note : 'Fill the basket with ' + rules(n).goal + ' yarn!';
      $('cardTip').textContent = 'Press and hold where you want to go, or use the arrow keys.';
      drawCardPic(nt ? show.kind : 'yarn');
    }
    $('goBtn').textContent = after ? 'Level ' + n + '!' : 'Go!';
    $('cardWrap').hidden = false;
    $('goBtn').focus();
  }
  $('goBtn').addEventListener('click', function () {
    Sound.init(); Sound.grab();
    $('cardWrap').hidden = true;
    startLevel(cardLevel);
    running = true;
    if (cardLevel > 1) say('Fill the basket with ' + G.R.goal + ' yarn!', 1.8);
  });

  /* ================= input ================= */
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (!G || !running) return;
    hold = { id: e.pointerId };
    G.cat.target = toRoom(e.clientX, e.clientY);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) { if (hold && hold.id === e.pointerId && G) G.cat.target = toRoom(e.clientX, e.clientY); });
  function release(e) { if (hold && hold.id === e.pointerId) hold = null; }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  var KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
  window.addEventListener('keydown', function (e) { var k = KEYMAP[e.key]; if (k && running) { keys[k] = true; e.preventDefault(); Sound.init(); } });
  window.addEventListener('keyup', function (e) { var k = KEYMAP[e.key]; if (k) keys[k] = false; });
  window.addEventListener('blur', function () { keys = {}; hold = null; });

  /* ================= speech bubble ================= */
  var sayTimer = 0;
  function say(text, secs) { var el = $('say'); el.textContent = text; el.classList.remove('hide'); clearTimeout(sayTimer); sayTimer = setTimeout(function () { el.classList.add('hide'); }, (secs || 1.6) * 1000); }

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
      grab: function () { tone({ f: 520, to: 880, dur: 0.09, gain: 0.12, slide: 0.06 }); },
      gold: function () { [880, 1174.66, 1567.98].forEach(function (f, i) { tone({ f: f, dur: 0.22, gain: 0.09, delay: i * 0.06 }); }); },
      fright: function () { tone({ f: 900, to: 1500, dur: 0.12, gain: 0.08, type: 'triangle', slide: 0.08 }); tone({ f: 300, to: 160, dur: 0.18, gain: 0.1, type: 'triangle', delay: 0.1 }); },
      splash: function () { noise({ type: 'bandpass', freq: 1800, q: 0.8, attack: 0.01, dur: 0.18, gain: 0.12 }); },
      rattle: function () { for (var i = 0; i < 6; i++) noise({ type: 'bandpass', freq: 2600, q: 2, attack: 0.005, dur: 0.03, gain: 0.07, delay: i * 0.12 }); },
      spray: function () { noise({ type: 'highpass', freq: 4000, q: 0.7, attack: 0.03, dur: 0.6, gain: 0.08 }); },
      bonk: function () { tone({ f: 200, to: 150, dur: 0.07, gain: 0.05, type: 'triangle' }); },
      slurp: function () { noise({ type: 'bandpass', freq: 700, q: 3, attack: 0.02, dur: 0.15, gain: 0.08 }); },
      snuffle: function () { for (var i = 0; i < 3; i++) noise({ type: 'lowpass', freq: 500, q: 1, attack: 0.02, dur: 0.08, gain: 0.12, delay: i * 0.16 }); },
      woof: function () { tone({ f: 260, to: 180, dur: 0.14, gain: 0.16, type: 'sawtooth' }); tone({ f: 250, to: 170, dur: 0.16, gain: 0.14, type: 'sawtooth', delay: 0.22 }); },
      wind: function () { for (var i = 0; i < 5; i++) noise({ type: 'bandpass', freq: 3000, q: 4, attack: 0.003, dur: 0.02, gain: 0.06, delay: i * 0.05 }); },
      win: function () { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { tone({ f: f, dur: 0.5, gain: 0.1, delay: i * 0.09 }); }); },
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
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.grab(); });
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= main loop ================= */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    update(dt);
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 380) * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    rr(ctx, OX, OY, W * K, H * K, 22); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    drawScene(ctx);
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, W * K, H * K, 22); D.ink(ctx, D.LW.big);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(topbar);
  document.addEventListener('visibilitychange', function () { last = performance.now(); keys = {}; hold = null; });

  layout();
  startLevel(P.level);      // a level behind the first card, so the room isn't empty
  showCard(P.level, false);
  requestAnimationFrame(frame);

  /* test hook */
  window.__dash = {
    state: function () { return G && { n: G.n, got: G.got, goal: G.R.goal, done: G.done, running: running, cat: { x: G.cat.x, y: G.cat.y, fright: G.cat.fright }, yarn: G.yarn.map(function (y) { return { x: y.x, y: y.y, gold: y.gold }; }), cukes: G.cukes.length, puddles: G.puddles.length, vacs: G.vacs.length, dog: G.dog && G.dog.state, spray: G.spray && G.spray.state, mouse: !!G.mouse }; },
    saved: function () { return JSON.parse(JSON.stringify(P)); },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    room: function () { return { W: W, H: H }; },
    jump: function (n) { $('cardWrap').hidden = true; startLevel(n); running = true; },
    teleport: function (x, y) { G.cat.x = x; G.cat.y = y; },
    setGot: function (n) { G.got = n; renderHud(); },
    fright: function () { G.cat.safe = 0; fright({ x: G.cat.x + 10, y: G.cat.y }); },
    force: function (what) { if (what === 'dog' && G.dog) { G.dog.state = 'stir'; G.dog.t = 0.01; } if (what === 'spray' && G.spray) { G.spray.state = 'shake'; G.spray.t = 0.01; } if (what === 'mouse') launchMouse(); }
  };
})();
