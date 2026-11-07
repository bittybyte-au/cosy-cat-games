/* Rooftop Run – a one-tap runner for older kids (10+). Your own cat runs across the city's rooftops at night.
   Tap (or space / up) to jump; tap again in the air for one more jump; hold for a higher jump. Fall into a gap or
   run into the side of a chimney or air-con box and the run is over; landing on top of them is fine (and often
   the best way). Fish to collect, gold fish worth 5. It speeds up as you go. The score is just how far you ran;
   the best is kept. No lives, no waiting: run again straight away.
   Saves GG.setProgress('rooftop', { best, runs, fish }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function track(n, d) { if (window.GG && GG.track) GG.track(n, d); }

  var P = (function () { var p = {}; try { p = GG.getProgress('rooftop') || {}; } catch (e) {} ['best', 'runs', 'fish'].forEach(function (k) { if (typeof p[k] !== 'number') p[k] = 0; }); return p; })();
  function save() { try { GG.setProgress('rooftop', P); } catch (e) {} }

  /* ================= your cat ================= */
  var CAT = { preset: 'ginger' };
  function catSetup() {
    var p = null; try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) { CAT = { preset: 'ginger' }; return; }
    var av = GGAvatar.normalise(p.avatar, p.color);
    CAT = { color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none' };
  }
  catSetup(); window.addEventListener('gg-change', catSetup);

  /* ================= world =================
     World units: y down, the street is far below (y > 640 is a fall). Rooftops sit between y 300 and 500.
     The camera follows the cat across; the view is at least 760 units wide (600 on an upright phone) and 560 tall. */
  var SIZE = 58, K0 = SIZE / 88;              // the cat's size, and its 100-unit scale
  var CAT_W = 64, CAT_H = 70;                   // the cat's body box for bumps (feet at the cat's y)
  var GRAV = 2500, GRAV_HOLD = 1150, JUMP = -860, JUMP2 = -760, HOLD_T = 0.22, COYOTE = 0.1, BUFFER = 0.13;
  var SPEED0 = 330, SPEED_MAX = 700, SPEED_UP = 5.5;

  var G = null;        // the current run
  var state = 'card';  // 'card' | 'run' | 'over'
  function newRun(x0) {
    x0 = x0 || 0;
    G = { x: x0, y: 400, clouds: [], vy: 0, speed: SPEED0, ground: true, jumps: 0, coyote: 0, buffer: 0, holdT: 0, held: false,
      bldgs: [], fishes: [], parts: [], pops: [], got: 0, dist: 0, dead: null, deadT: 0, step: 0, tilt: 0, nextMark: 100, landT: 0 };
    // a long first roof to get going
    G.bldgs.push(makeBldg(x0 - 400, 1100, 420, 0));
    while (lastEdge() < x0 + 2600) addBldg();
    G.y = 420;
    renderHud();
  }
  function lastEdge() { var b = G.bldgs[G.bldgs.length - 1]; return b.x + b.w; }
  var bldgCols = ['#7A5C8E', '#5E6B9E', '#8C5F6E', '#4F7C8C', '#6D5A99', '#8A6B5A'];
  function makeBldg(x, w, top, n) {
    var b = { x: x, w: w, top: top, col: pick(bldgCols), obs: [], n: n, seed: Math.random() * 1e6 | 0, lights: Math.random() < 0.35 };
    return b;
  }
  function addBldg() {
    var prev = G.bldgs[G.bldgs.length - 1];
    var dist = prev.x / 40, sp = clamp(SPEED0 + dist * SPEED_UP / 8, SPEED0, SPEED_MAX);
    // how far a cat can get: a single held jump covers about speed * 0.62s; a double jump much more
    var hard = clamp(dist / 1500, 0, 1);
    var gap = rand(70, lerp(0.42, 0.78, hard) * sp);
    if (Math.random() < 0.12 + hard * 0.2) gap = rand(0.7, lerp(0.85, 1.05, hard)) * sp;    // a big one: needs the second jump
    var rise = rand(-120, lerp(70, 120, hard));
    if (gap > sp * 0.62) rise = Math.min(rise, 20);                                            // big gaps don't also go up much
    var top = clamp(prev.top - rise, 300, 510);
    var w = rand(lerp(520, 300, hard), lerp(1100, 700, hard));
    // from 300 m: sometimes a staircase of clouds over a wide gap, up to a taller building
    var steps = dist >= 300 && prev.top > 330 && Math.random() < 0.22 + hard * 0.18;
    if (steps) {
      var cx = prev.x + prev.w, ctop = prev.top, nC = Math.random() < 0.5 ? 2 : 3;
      for (var ci = 0; ci < nC; ci++) {
        // wide, closely spaced steps: both a quick tap and a full held jump land on the next cloud
        // (tested in a simulation with the jump physics: the window to press is ~0.4 s for a tap and ~0.3 s for a hold)
        var cwid = rand(300, 380);
        cx += rand(0.22, 0.34) * sp; ctop -= rand(60, 85);
        G.clouds.push({ x: cx, w: cwid, top: ctop, seed: Math.random() });
        for (var cf = 0; cf < 2; cf++) G.fishes.push({ x: cx + cwid * (0.35 + cf * 0.3), y: ctop - 40, gold: ci === nC - 1 && cf === 1 && Math.random() < 0.4, got: false });
        cx += cwid;
      }
      gap = cx + rand(0.22, 0.34) * sp - (prev.x + prev.w);
      top = clamp(ctop - rand(-30, 50), 200, 510);
    }
    var b = makeBldg(prev.x + prev.w + gap, w, top, prev.n + 1);
    // things on the roof: chimneys and air-con boxes (hop over them or onto them)
    var x = b.x + rand(140, 220);
    while (x < b.x + b.w - 140) {
      if (Math.random() < 0.45 + hard * 0.25) {
        var kind = Math.random() < 0.6 ? 'chimney' : 'aircon';
        var ow = kind === 'chimney' ? 48 : 76, oh = kind === 'chimney' ? rand(54, 78 + hard * 22) : rand(40, 52);
        b.obs.push({ kind: kind, x: x, w: ow, h: oh, top: b.top - oh });
        // fish over the top of it
        if (Math.random() < 0.6) for (var f = 0; f < 3; f++) G.fishes.push({ x: x + ow / 2 + (f - 1) * 42, y: b.top - oh - 70 - (f === 1 ? 18 : 0), gold: false, got: false });
        x += ow + rand(Math.max(160, sp * 0.55), sp * 1.1);
      } else {
        // a row of fish to run through
        if (Math.random() < 0.5) for (var f2 = 0; f2 < 4; f2++) G.fishes.push({ x: x + f2 * 44, y: b.top - 34, gold: false, got: false });
        x += rand(220, 360);
      }
    }
    // fish along the jump over the gap; sometimes a gold one at the top
    var gx = prev.x + prev.w, gy = Math.min(prev.top, b.top);
    if (!steps && Math.random() < 0.7) for (var k = 0; k < 4; k++) {
      var t = (k + 0.5) / 4;
      G.fishes.push({ x: gx - 40 + (gap + 80) * t, y: gy - 60 - Math.sin(t * Math.PI) * (70 + Math.min(gap, 300) * 0.25), gold: k === 1 && Math.random() < 0.18, got: false });
    }
    G.bldgs.push(b);
  }

  /* ================= input ================= */
  function press() {
    Sound.init();
    if (state !== 'run') return;
    G.held = true; G.buffer = BUFFER;
  }
  function release() { if (G) G.held = false; }
  var canvas = $('stage');
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); if (state === 'over' && G.deadT > 0.8) { start(); return; } press(); });
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      if (state === 'card' && !$('cardWrap').hidden) { $('goBtn').click(); return; }
      if (state === 'over' && G.deadT > 0.8) { start(); return; }
      press();
    }
  });
  window.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') release(); });
  $('goBtn').addEventListener('click', function () { Sound.init(); Sound.click(); start(); });

  function start() {
    $('cardWrap').hidden = true;
    newRun(); state = 'run';
    P.runs++; save();
    track('Start run', { game: 'rooftop' });
  }

  /* ================= the run ================= */
  function groundAt(x, prevFeet, feet) {
    // the highest surface under the cat (between its back and front paws) that it was above last frame
    var best = null;
    G.clouds.forEach(function (o) {
      if (x + CAT_W * 0.3 < o.x || x - CAT_W * 0.45 > o.x + o.w) return;
      if (prevFeet <= o.top + 2 && feet >= o.top && (best === null || o.top < best)) best = o.top;
    });
    G.bldgs.forEach(function (b) {
      if (x + CAT_W * 0.3 < b.x || x - CAT_W * 0.45 > b.x + b.w) return;
      if (prevFeet <= b.top + 2 && feet >= b.top && (best === null || b.top < best)) best = b.top;
      b.obs.forEach(function (o) {
        if (x + CAT_W * 0.3 < o.x || x - CAT_W * 0.45 > o.x + o.w) return;
        if (prevFeet <= o.top + 2 && feet >= o.top && (best === null || o.top < best)) best = o.top;
      });
    });
    return best;
  }
  function supportAt(x, feet) {
    // is the cat standing on something right now?
    var on = false;
    G.clouds.forEach(function (o) { if (x + CAT_W * 0.3 >= o.x && x - CAT_W * 0.45 <= o.x + o.w && Math.abs(feet - o.top) < 1.5) on = true; });
    G.bldgs.forEach(function (b) {
      if (x + CAT_W * 0.3 >= b.x && x - CAT_W * 0.45 <= b.x + b.w && Math.abs(feet - b.top) < 1.5) on = true;
      b.obs.forEach(function (o) { if (x + CAT_W * 0.3 >= o.x && x - CAT_W * 0.45 <= o.x + o.w && Math.abs(feet - o.top) < 1.5) on = true; });
    });
    return on;
  }
  function bumped(x, feet) {
    // running into the side of a roof that's higher, or a chimney / air-con box
    var hit = null;
    G.bldgs.forEach(function (b) {
      if (x + CAT_W * 0.3 > b.x && x + CAT_W * 0.3 - b.x < 30 && feet > b.top + 6) hit = { x: b.x, y: Math.max(b.top, feet - CAT_H) };
      b.obs.forEach(function (o) {
        if (x + CAT_W * 0.3 > o.x && x - CAT_W * 0.45 < o.x + o.w && feet > o.top + 6 && feet - CAT_H < o.top + o.h) hit = { x: o.x, y: Math.max(o.top, feet - CAT_H * 0.6) };
      });
    });
    return hit;
  }
  function update(dt) {
    if (!G) return;
    followCam(dt);
    if (state === 'over') {
      G.deadT += dt;
      if (G.dead === 'bump') { G.vy += GRAV * dt; G.y += G.vy * dt; G.x -= 60 * dt; G.tilt -= dt * 6; }
      else { G.vy += GRAV * dt; G.y += G.vy * dt; G.x += G.speed * 0.3 * dt; }
      updateParts(dt);
      if (G.deadT > 0.9 && $('cardWrap').hidden && !G.carded) { G.carded = true; showOver(); }
      return;
    }
    if (state !== 'run') return;
    G.speed = Math.min(SPEED_MAX, G.speed + SPEED_UP * dt);
    var prevFeet = G.y;
    G.x += G.speed * dt;
    // jumping: a buffered press, coyote time after running off an edge, and one more jump in the air
    G.buffer -= dt; G.coyote -= dt;
    if (G.buffer > 0) {
      if (G.ground || G.coyote > 0) { G.vy = JUMP; G.ground = false; G.coyote = 0; G.jumps = 1; G.holdT = HOLD_T; G.buffer = 0; Sound.jump(); }
      else if (G.jumps < 2) { G.vy = JUMP2; G.jumps = 2; G.holdT = HOLD_T * 0.8; G.buffer = 0; Sound.jump2(); for (var i = 0; i < 6; i++) G.parts.push({ x: G.x - 10, y: G.y - 10, vx: rand(-90, 30), vy: rand(20, 120), life: 0, max: 0.4, r: rand(4, 7), col: '#fff', kind: 'puff' }); }
    }
    G.holdT -= dt;
    var g = (G.held && G.holdT > 0 && G.vy < 0) ? GRAV_HOLD : GRAV;
    if (!G.ground) { G.vy += g * dt; G.y += G.vy * dt; }
    // landing
    if (!G.ground && G.vy >= 0) {
      var land = groundAt(G.x, prevFeet, G.y);
      if (land !== null) { G.y = land; G.vy = 0; G.ground = true; G.jumps = 0; G.landT = 0.15; Sound.land(); }
    }
    // ran off an edge
    if (G.ground && !supportAt(G.x, G.y)) { G.ground = false; G.coyote = COYOTE; G.vy = 0; }
    // bumps
    var hit = bumped(G.x, G.y);
    if (hit) return die('bump', hit);
    if (G.y > 700) return die('fall');
    // fish
    G.fishes.forEach(function (f) {
      if (f.got) return;
      if (Math.abs(f.x - (G.x - 6)) < 34 && Math.abs(f.y - (G.y - CAT_H * 0.5)) < 44) {
        f.got = true; G.got += f.gold ? 5 : 1; renderHud(true);
        if (f.gold) { Sound.gold(); G.pops.push({ x: f.x, y: f.y, t: 0, txt: '+5' }); } else Sound.fish();
        for (var i = 0; i < 5; i++) G.parts.push({ x: f.x, y: f.y, vx: rand(-120, 120), vy: rand(-160, -40), life: 0, max: 0.5, r: rand(4, 7), col: f.gold ? '#FFD23F' : '#BFE6FF', kind: 'star' });
      }
    });
    G.dist = Math.max(0, Math.floor(G.x / 40));
    if (G.dist >= G.nextMark) { G.pops.push({ x: G.x + 160, y: 230, t: 0, txt: G.nextMark + ' m', big: true }); Sound.mark(); G.nextMark += 100; }
    G.step += dt * (G.ground ? G.speed / 26 : 0);
    G.landT = Math.max(0, G.landT - dt);
    // build ahead, tidy behind
    while (lastEdge() < G.x + 2400) addBldg();
    while (G.bldgs.length && G.bldgs[0].x + G.bldgs[0].w < G.x - 900) G.bldgs.shift();
    G.clouds = G.clouds.filter(function (o) { return o.x + o.w > G.x - 900; });
    G.fishes = G.fishes.filter(function (f) { return f.x > G.x - 600; });
    updateParts(dt);
    if (G.dist !== lastHud) renderHud();
  }
  function updateParts(dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) { var p = G.parts[i]; p.life += dt; if (p.life > p.max) { G.parts.splice(i, 1); continue; } p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (var j = G.pops.length - 1; j >= 0; j--) { G.pops[j].t += dt; if (G.pops[j].t > 1.1) G.pops.splice(j, 1); }
  }
  function die(how, hit) {
    state = 'over'; G.dead = how; G.deadT = 0; G.carded = false;
    if (how === 'bump') { G.vy = -500; Sound.bonk(); buzz([40, 30, 40]); for (var i = 0; i < 8; i++) G.parts.push({ x: hit.x, y: hit.y, vx: rand(-200, 0), vy: rand(-260, -60), life: 0, max: 0.6, r: rand(5, 8), col: '#FFD23F', kind: 'star' }); }
    else { Sound.fall(); buzz(60); }
    var newBest = G.dist > P.best;
    if (newBest) P.best = G.dist;
    P.fish += G.got; save();
    G.newBest = newBest;
    track('Finish run', { game: 'rooftop', distance: Math.floor(G.dist / 100) * 100, how: how });
    if (GG.stat) GG.stat('rooftop', 'runs', 1);
  }
  function showOver() {
    $('cardTitle').textContent = G.newBest ? 'New best!' : (G.dead === 'fall' ? 'Whoops!' : 'Bonk!');
    $('cardNote').textContent = 'You ran ' + G.dist + ' m and caught ' + G.got + (G.got === 1 ? ' fish.' : ' fish.');
    $('cardBest').textContent = G.newBest ? 'Your best run yet!' : 'Best: ' + P.best + ' m';
    $('cardTip').textContent = G.dead === 'fall' ? 'Tip: tap again in the air for a second jump over the big gaps.' : 'Tip: you can land on top of chimneys and boxes.';
    $('goBtn').textContent = 'Run again';
    drawCardPic(G.dead === 'bump' ? 'surprised' : 'happy');
    $('cardWrap').hidden = false;
  }
  var lastHud = -1;
  function renderHud(bumpFish) {
    lastHud = G ? G.dist : 0;
    $('dist').textContent = (G ? G.dist : 0) + ' m';
    $('fish').textContent = G ? G.got : 0;
    if (bumpFish) { var fp = $('fishPill'); fp.classList.remove('bump'); void fp.offsetWidth; fp.classList.add('bump'); }
  }

  /* ================= drawing ================= */
  var ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, K = 1, VW = 760, VH = 560, camX = 0, camY = 0, camBase = 0, topGap = 70;
  // the view rises when the cat climbs or jumps high, so it never leaves the top of the screen, and settles back
  function followCam(dt) {
    if (!G) return;
    // keep the cat's head clear of the top bar, with a little air above it
    var margin = (topGap + 24) / K, catTop = G.y - 115, target = Math.min(camBase, catTop - margin);
    if (catTop - margin < camY) camY = Math.min(camY, catTop - margin + 30);      // never let it get past the edge
    camY += (target - camY) * Math.min(1, dt * (target < camY ? 14 : 3));
  }
  var far = [], mid = [];
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    // wide screens see 760 units across; phones held upright see a bit less (600) so the cat isn't tiny
    // at least 700 units of height (room above the roofs for big jumps, e.g. on an iPad held sideways)
    K = Math.min(ch / 700, cw / (cw < ch ? 600 : 820));
    VW = cw / K; VH = ch / K;
    // the street level (world y 640) sits at the bottom of the screen
    camBase = 660 - VH; camY = camBase;
    topGap = document.getElementById('topbar').getBoundingClientRect().bottom || 70;
    if (!far.length) { var x = 0; while (x < 4000) { var w = rand(60, 160); far.push({ x: x, w: w, h: rand(80, 220), win: Math.random() }); x += w + rand(0, 20); } }
    if (!mid.length) { var x2 = 0; while (x2 < 5000) { var w2 = rand(90, 220); mid.push({ x: x2, w: w2, h: rand(120, 300), tank: Math.random() < 0.2, seed: Math.random() * 1e6 | 0 }); x2 += w2 + rand(10, 50); } }
  }
  /* the night sky, its stars and the moon come from the shared scenery kit (shared/scene.js); the stars twinkle in
     three groups, each fading in and out on its own beat */
  function sky(c) {
    GGScene.sky(c, 0, 0, cw, ch, { kind: 'city' });
    for (var i = 0; i < 3; i++) {
      c.globalAlpha = reduceMotion ? 0.8 : 0.4 + 0.6 * Math.abs(Math.sin(time * 1.3 + i * 2.1));
      GGScene.stars(c, 0, 0, cw, ch * 0.6, { n: 30, kind: 'dot', col: '#FFF6D8', size: 3.4, seed: 11 + i });
    }
    c.globalAlpha = 1;
    var mr = Math.max(26, Math.min(cw, ch) * 0.06);
    GGScene.moon(c, cw * 0.78, Math.min(ch * 0.2, 140), { kind: 'full', size: mr * 2, col: '#FFF1C9', glow: true });
  }
  function skyline(c, list, par, base, col, winCol, outline) {
    // parallax buildings: they slide past slower than the rooftops
    var span = list[list.length - 1].x + list[list.length - 1].w;
    var off = (camX * par) % span;
    for (var rep = 0; rep < 3; rep++) list.forEach(function (b) {
      var x = (b.x - off + rep * span) * K, w = b.w * K;
      if (x > cw || x + w < 0) return;
      var top = (base - b.h - camY) * K;
      c.fillStyle = col; c.fillRect(x, top, w + 1, ch - top);
      if (outline) { c.strokeStyle = 'rgba(42,35,64,.6)'; c.lineWidth = 2; c.strokeRect(x, top, w, ch - top); }
      if (winCol) {
        var R = D.seeded(b.seed || (b.x | 0));
        c.fillStyle = winCol;
        for (var wy = top + 14 * K; wy < ch; wy += 26 * K) for (var wx = x + 10 * K; wx < x + w - 12 * K; wx += 22 * K) if (R() < 0.25) c.fillRect(wx, wy, 8 * K, 11 * K);
      }
      if (b.tank) { var tx = x + w * 0.3, tw = 34 * K; c.fillStyle = col; c.fillRect(tx, top - 40 * K, tw, 34 * K); c.fillRect(tx + 4 * K, top - 8 * K, 4 * K, 8 * K); c.fillRect(tx + tw - 8 * K, top - 8 * K, 4 * K, 8 * K); c.beginPath(); c.moveTo(tx - 3 * K, top - 40 * K); c.lineTo(tx + tw / 2, top - 54 * K); c.lineTo(tx + tw + 3 * K, top - 40 * K); c.fill(); }
    });
  }
  function wx(x) { return (x - camX) * K; }
  function wy(y) { return (y - camY) * K; }
  var bldgCache = {};
  function bldgFront(b) {
    // the building's front, drawn once: bricks, windows (some lit), a ledge along the top
    var key = b.seed + ':' + Math.round(K * 100);
    if (bldgCache[key]) return bldgCache[key];
    var w = Math.ceil(b.w * K), h = Math.ceil((660 - b.top) * K);
    var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    var c = cv.getContext('2d'); c.scale(dpr * K, dpr * K);
    var W = b.w, H = 660 - b.top, R = D.seeded(b.seed);
    c.fillStyle = b.col; c.fillRect(0, 0, W, H);
    // brick hints
    c.strokeStyle = D.darker(b.col, 0.18); c.lineWidth = 1.5;
    for (var y = 22; y < H; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // windows
    var cols = Math.max(1, Math.floor((W - 40) / 70)), gapX = (W - cols * 40) / (cols + 1);
    for (var row = 0; 40 + row * 74 < H; row++) for (var col = 0; col < cols; col++) {
      var x = gapX + col * (40 + gapX), yy = 40 + row * 74, lit = R() < 0.45;
      var curtain = lit && R() < 0.3;
      GGScene.window(c, x, yy, 40, 50, { view: 'sky', sky: lit ? '#FFD98A' : D.darker(b.col, 0.45), cloud: false, sill: false, bars: 'cross', barCol: D.lighter(b.col, 0.25), r: 6,
        inside: curtain ? function (c) { c.fillStyle = '#FF8FAB'; c.fillRect(x, yy, 20, 25); } : null });   // a curtain drawn across one pane
    }
    // the ledge
    c.fillStyle = D.lighter(b.col, 0.25); c.fillRect(-2, 0, W + 4, 14);
    c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(0, 0, W, H + 10);
    c.beginPath(); c.moveTo(0, 14); c.lineTo(W, 14); c.lineWidth = 3; c.stroke();
    bldgCache[key] = cv;
    var keys = Object.keys(bldgCache); if (keys.length > 40) delete bldgCache[keys[0]];
    return cv;
  }
  function drawBldg(c, b) {
    var x = wx(b.x), y = wy(b.top);
    if (x > cw + 20 || x + b.w * K < -20) return;
    c.drawImage(bldgFront(b), x, y, b.w * K, (660 - b.top) * K);
    // string lights along the roof edge
    if (b.lights) {
      c.save(); c.translate(x, y); c.scale(K, K);
      c.beginPath(); c.moveTo(10, -26); c.quadraticCurveTo(b.w / 2, 4, b.w - 10, -26); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      var n = Math.floor(b.w / 40);
      for (var i = 1; i < n; i++) { var t = i / n, lx = lerp(10, b.w - 10, t), ly = -26 + 30 * 2 * t * (1 - t) * 1; c.beginPath(); c.arc(lx, ly + 5, 5, 0, TAU); c.fillStyle = ['#FFD23F', '#FF8FAB', '#7CC4FF', '#7BD389'][i % 4]; c.globalAlpha = 0.7 + 0.3 * Math.sin(time * 3 + i); c.fill(); c.globalAlpha = 1; c.lineWidth = 1.5; c.stroke(); }
      // little posts
      [8, b.w - 12].forEach(function (px) { c.fillStyle = '#5A5070'; c.fillRect(px, -30, 4, 30); });
      c.restore();
    }
    b.obs.forEach(function (o) {
      var ox = wx(o.x), oy = wy(o.top);
      if (ox > cw + 20 || ox + o.w * K < -20) return;
      c.save(); c.translate(ox, oy); c.scale(K, K);
      if (o.kind === 'chimney') {
        D.shape(c, D.rrPath(0, 8, o.w, o.h - 8, 3), '#B65A4B', { lw: D.LW.mid, depth: 6, inside: function (c) { c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 2; for (var yy = 20; yy < o.h; yy += 12) { c.beginPath(); c.moveTo(0, yy); c.lineTo(o.w, yy); c.stroke(); } } });
        D.shape(c, D.rrPath(-5, 0, o.w + 10, 12, 3), '#8E4438', { lw: D.LW.mid, depth: 0 });
        // a wisp of smoke
        for (var s = 0; s < 3; s++) { var ph = (time * 0.5 + s / 3 + o.x * 0.001) % 1; c.globalAlpha = (1 - ph) * 0.35; c.beginPath(); c.arc(o.w / 2 + Math.sin(ph * 6) * 8 - ph * 20, -10 - ph * 60, 8 + ph * 12, 0, TAU); c.fillStyle = '#D8D0E8'; c.fill(); }
        c.globalAlpha = 1;
      } else {
        D.shape(c, D.rrPath(0, 0, o.w, o.h, 6), '#B9C0D6', { lw: D.LW.mid, depth: 6, inside: function (c) {
          c.beginPath(); c.arc(o.w * 0.35, o.h * 0.5, o.h * 0.3, 0, TAU); c.fillStyle = '#8D94AD'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
          c.save(); c.translate(o.w * 0.35, o.h * 0.5); c.rotate(time * 8); c.beginPath(); c.moveTo(-o.h * 0.25, 0); c.lineTo(o.h * 0.25, 0); c.moveTo(0, -o.h * 0.25); c.lineTo(0, o.h * 0.25); c.stroke(); c.restore();
          c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 2; for (var gx = o.w * 0.66; gx < o.w - 6; gx += 6) { c.beginPath(); c.moveTo(gx, 8); c.lineTo(gx, o.h - 8); c.stroke(); }
        } });
      }
      c.restore();
    });
  }
  function drawCloud(c, o) {
    // a soft cloud to stand on: flat-ish on top (where the paws go), puffy below
    var x = wx(o.x), y = wy(o.top);
    if (x > cw + 20 || x + o.w * K < -20) return;
    c.save(); c.translate(x, y); c.scale(K, K);
    var bob = reduceMotion ? 0 : Math.sin(time * 2 + o.seed * 9) * 1.5;
    GGScene.cloud(c, o.w / 2, bob, { kind: 'flat', size: o.w, col: '#F3EEFF', ls: K });
    c.restore();
  }
  function drawFish(c, f) {
    if (f.got) return;
    var x = wx(f.x), y = wy(f.y + Math.sin(time * 4 + f.x * 0.01) * 4);
    if (x < -30 || x > cw + 30) return;
    c.save(); c.translate(x, y); c.scale(K, K);
    var col = f.gold ? '#FFD23F' : '#7CC4FF';
    if (f.gold) { c.globalAlpha = 0.35 + 0.2 * Math.sin(time * 6); c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fillStyle = '#FFE58A'; c.fill(); c.globalAlpha = 1; }
    GGThings.fish(c, 0, 0, { col: col });   // shared/things.js (the glow above is this game's)
    c.restore();
  }
  function drawCat(c) {
    var x = wx(G.x), y = wy(G.y);
    c.save(); c.translate(x, y); c.scale(K, K);
    if (G.ground) D.shadow(c, -12, 2, 30, 5);
    var squash = G.landT > 0 ? 1 - G.landT * 0.8 : 1;
    if (state === 'over' && G.dead === 'bump') c.rotate(G.tilt);
    else if (!G.ground) c.rotate(clamp(G.vy / 3000, -0.25, 0.3) + (G.jumps === 2 && G.vy < 0 ? (1 - Math.min(1, -G.vy / 760)) * TAU : 0));
    c.scale(1 / squash, squash);
    c.translate(0, -78 * K0);
    var o = {}; for (var k in CAT) o[k] = CAT[k];
    o.pose = 'walk'; o.size = SIZE; o.dir = 1; o.step = G.step; o.moving = G.ground && state === 'run'; o.wag = time * 2;
    o.face = state === 'over' ? (G.dead === 'bump' ? 'surprised' : 'surprised') : (!G.ground ? 'happy' : 'open');
    try { GGCat.draw(c, o); } catch (e) { c.beginPath(); c.arc(0, 0, 30, 0, TAU); c.fillStyle = '#FFA94D'; c.fill(); }
    c.restore();
  }
  function draw(c) {
    sky(c);
    if (!G) return;
    camX = G.x - VW * (VW < 700 ? 0.22 : 0.28);
    skyline(c, far, 0.15, 640, '#2D2752', 'rgba(255,217,138,.35)', false);
    skyline(c, mid, 0.4, 680, '#3C3366', 'rgba(255,217,138,.55)', true);
    G.bldgs.forEach(function (b) { drawBldg(c, b); });
    G.clouds.forEach(function (o) { drawCloud(c, o); });
    G.fishes.forEach(function (f) { drawFish(c, f); });
    drawCat(c);
    G.parts.forEach(function (p) {
      var k = 1 - p.life / p.max; c.save(); c.globalAlpha = k; c.translate(wx(p.x), wy(p.y)); c.scale(K, K);
      if (p.kind === 'puff') { c.beginPath(); c.arc(0, 0, p.r * (2 - k), 0, TAU); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill(); }
      else { c.rotate(p.life * 6); c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5, q = i % 2 ? p.r * 0.45 : p.r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); c.fillStyle = p.col; c.fill(); D.ink(c, 1.5); }
      c.restore();
    });
    G.pops.forEach(function (p) {
      var k = p.t / 1.1; c.save(); c.globalAlpha = 1 - k; c.translate(wx(p.x), wy(p.y - k * 40)); c.scale(K, K);
      c.font = '800 ' + (p.big ? 34 : 24) + 'px ' + getComputedStyle(document.body).getPropertyValue('--display'); c.textAlign = 'center';
      c.lineWidth = 6; c.strokeStyle = INK; c.strokeText(p.txt, 0, 0); c.fillStyle = p.big ? '#FFD23F' : '#FFF6D8'; c.fillText(p.txt, 0, 0);
      c.restore();
    });
  }
  function drawCardPic(face) {
    var c = $('cardPic').getContext('2d');
    c.clearRect(0, 0, 440, 300);
    c.save(); D.rr(c, 6, 6, 428, 288, 26); c.clip();
    var g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#1F1B3D'); g.addColorStop(1, '#5A447A'); c.fillStyle = g; c.fillRect(0, 0, 440, 300);
    c.beginPath(); c.arc(350, 70, 30, 0, TAU); c.fillStyle = '#FFF1C9'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    [[20, 200, 150], [230, 230, 210]].forEach(function (b, i) { c.fillStyle = ['#7A5C8E', '#5E6B9E'][i]; c.fillRect(b[0], b[1], b[2], 120); c.lineWidth = 4; c.strokeStyle = INK; c.strokeRect(b[0], b[1], b[2], 120); });
    c.save(); c.translate(300, 230); D.shape(c, D.rrPath(0, -50, 40, 50, 3), '#B65A4B', { lw: 4, depth: 5 }); c.restore();
    c.save(); c.translate(200, 150); c.rotate(-0.15); var o = {}; for (var k in CAT) o[k] = CAT[k]; o.pose = 'walk'; o.size = 80; o.dir = 1; o.step = 1; o.moving = true; o.face = face || 'happy'; try { GGCat.draw(c, o); } catch (e) {} c.restore();
    [[120, 120], [160, 100], [250, 110]].forEach(function (f) { c.save(); c.translate(f[0], f[1]); D.shape(c, function (p) { p.moveTo(-16, 0); p.quadraticCurveTo(-4, -12, 8, -5); p.lineTo(17, -11); p.lineTo(17, 11); p.lineTo(8, 5); p.quadraticCurveTo(-4, 12, -16, 0); p.closePath(); }, '#7CC4FF', { lw: 3, depth: 3 }); c.restore(); });
    c.restore();
    D.rr(c, 6, 6, 428, 288, 26); D.ink(c, 5);
  }

  /* ================= sound ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null;
    var on = GG.getSetting('sound', true);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function ready() { return ac && on; }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function tone(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.005, o.gain || 0.12, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.005) + (o.dur || 0.15) + 0.05);
    }
    function noise(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
      var g = ac.createGain(); env(g, t, o.attack || 0.003, o.gain || 0.15, o.dur || 0.08);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + (o.attack || 0.003) + (o.dur || 0.08) + 0.05);
    }
    return {
      init: init, isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      click: function () { tone({ f: 900, dur: 0.04, gain: 0.06, type: 'triangle' }); },
      jump: function () { tone({ f: 320, to: 640, dur: 0.12, gain: 0.08, type: 'triangle', slide: 0.1 }); },
      jump2: function () { tone({ f: 520, to: 1040, dur: 0.12, gain: 0.07, type: 'triangle', slide: 0.1 }); noise({ freq: 2000, q: 0.8, dur: 0.1, gain: 0.04 }); },
      land: function () { noise({ type: 'lowpass', freq: 400, q: 1, dur: 0.06, gain: 0.1 }); },
      fish: function () { tone({ f: 1046.5, dur: 0.08, gain: 0.06 }); tone({ f: 1568, dur: 0.1, gain: 0.04, delay: 0.05 }); },
      gold: function () { [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { tone({ f: f, dur: 0.15, gain: 0.06, delay: i * 0.05 }); }); },
      mark: function () { tone({ f: 784, dur: 0.12, gain: 0.06, type: 'triangle' }); tone({ f: 1046.5, dur: 0.2, gain: 0.06, type: 'triangle', delay: 0.09 }); },
      bonk: function () { tone({ f: 220, to: 110, dur: 0.25, gain: 0.12, type: 'square', slide: 0.2 }); noise({ type: 'lowpass', freq: 500, dur: 0.12, gain: 0.15 }); },
      fall: function () { tone({ f: 700, to: 140, dur: 0.6, gain: 0.08, type: 'triangle', slide: 0.6 }); }
    };
  })();
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function (e) { e.stopPropagation(); Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.click(); });
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= loop ================= */
  var time = 0, last = performance.now(), paused = false;
  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (!paused) { time += dt; update(dt); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', function () { layout(); bldgCache = {}; });
  document.addEventListener('visibilitychange', function () { paused = document.hidden; last = performance.now(); if (G) G.held = false; });
  layout();
  newRun();
  $('cardBest').textContent = P.best ? 'Your best: ' + P.best + ' m' : '';
  drawCardPic('happy');
  requestAnimationFrame(frame);

  /* test hooks */
  window.__roof = {
    state: function () { return { state: state, x: G.x, y: G.y, vy: G.vy, ground: G.ground, jumps: G.jumps, dist: G.dist, got: G.got, speed: G.speed, dead: G.dead, best: P.best }; },
    start: start,
    startAt: function (m) { $('cardWrap').hidden = true; newRun(m * 40); state = 'run'; },
    clouds: function () { return G.clouds.length; },
    screenY: function () { return { head: (G.y - 115 - camY) * K, feet: (G.y - camY) * K, h: ch, onCloud: G.clouds.some(function (o) { return G.ground && Math.abs(G.y - o.top) < 2 && G.x >= o.x - 30 && G.x <= o.x + o.w + 20; }) }; },
    // a simple autopilot for testing that runs are possible: jumps at edges and before obstacles
    auto: function () {
      if (state !== 'run') return;
      var ahead = null, edge = null;
      G.bldgs.concat(G.clouds).forEach(function (b) {
        if (b.x + b.w > G.x && b.x + b.w < G.x + G.speed * 0.35 && G.ground && Math.abs(G.y - b.top) < 2) edge = b;
        if (!b.obs) return;
        b.obs.forEach(function (o) { if (o.x > G.x && o.x - G.x < G.speed * 0.28) ahead = o; });
      });
      if ((edge || ahead) && G.ground) { press(); setTimeout(release, 200); }
      else if (!G.ground && G.vy > 120 && G.jumps < 2) {
        // falling with nothing under us: use the second jump
        var under = false; G.bldgs.concat(G.clouds).forEach(function (b) { if (G.x >= b.x - 20 && G.x <= b.x + b.w && b.top >= G.y) under = true; });
        if (!under) { press(); setTimeout(release, 200); }
      }
    }
  };
})();
