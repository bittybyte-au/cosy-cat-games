/* Kitten Parade – a walk-them-home puzzle for 10+ (in the spirit of Lemmings, with kittens).
   Kittens hop out of a box one after another and walk along on their own: they step up small bumps, turn round at
   walls and drop off edges. Pick a job and tap a kitten to give it that job:
     Stop    it sits with a paw up and the others turn round at it (tap it with Stop again and it walks on)
     Dig     it digs straight down through soil (not stone) until it breaks through
     Tunnel  the next soil wall it meets, it tunnels straight through
     Steps   it lays a little staircase of yarn-wrapped planks, going up
     Brolly  it keeps a brolly: any drop, it floats down gently
   A big drop without a brolly makes a kitten dizzy: it naps where it lands and is out of this go. Get enough kittens
   into the cat house to finish; all of them for three stars. Nothing is locked except levels past your best.
   Drawn only with the shared kits: GGScene (sky, hills, terrain, box, catHouse, cloud), GGThings (umbrella, yarnBall,
   star), GGCat. Saves GG.setProgress('parade', { best, cur, stars: { level: n } }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK, S = GGScene, T = GGThings;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function track(n, d) { if (window.GG && GG.track) GG.track(n, d); }

  var P = (function () { var p = {}; try { p = GG.getProgress('parade') || {}; } catch (e) {} if (typeof p.best !== 'number' || p.best < 1) p.best = 1; if (typeof p.cur !== 'number') p.cur = 1; if (!p.stars || typeof p.stars !== 'object') p.stars = {}; return p; })();
  function save() { try { GG.setProgress('parade', P); } catch (e) {} }

  /* ================= the kittens' looks ================= */
  var LOOKS = [{ preset: 'ginger' }, { preset: 'pink' }, { preset: 'blue' }, { preset: 'purple' }, { preset: 'white' }, { preset: 'black' }];
  function catSetup() {
    var p = null; try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) return;
    var av = GGAvatar.normalise(p.avatar, p.color);
    LOOKS[0] = { color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none' };
  }
  catSetup(); window.addEventListener('gg-change', catSetup);

  /* ================= levels =================
     World is 480 x 320. pieces: soil (diggable), stone (not), wood (not). start: where the box sits on the ground;
     exit: where the cat house sits. jobs: how many of each this level gives. */
  var W = 480, H = 320;
  var JOBS = ['stop', 'dig', 'tunnel', 'steps', 'brolly'];
  var JOB_NAME = { stop: 'Stop', dig: 'Dig', tunnel: 'Tunnel', steps: 'Steps', brolly: 'Brolly' };
  function soil(x, y, w, h) { return { x: x, y: y, w: w, h: h, kind: 'soil' }; }
  function stone(x, y, w, h) { return { x: x, y: y, w: w, h: h, kind: 'stone' }; }
  var LEVELS = [
    { name: 'Off we go', total: 5, need: 5, rate: 1.6, start: { x: 60, y: 250 }, exit: { x: 410, y: 250 }, jobs: {},
      hint: 'Kittens walk all by themselves. Just watch them parade home!', pieces: [soil(-20, 250, 520, 90)] },
    { name: 'Brollies up', total: 6, need: 5, rate: 1.8, start: { x: 50, y: 120 }, exit: { x: 400, y: 270 }, jobs: { brolly: 6 },
      hint: 'That drop is too big! Pick Brolly, then tap each kitten before it walks off the edge.',
      pieces: [soil(-20, 120, 220, 40), soil(-20, 270, 520, 70)] },
    { name: 'Dig down', total: 8, need: 6, rate: 1.7, start: { x: 60, y: 150 }, exit: { x: 240, y: 250 }, jobs: { dig: 2 },
      hint: 'The cat house is down below. Pick Dig and tap a kitten to dig a way down.',
      pieces: [soil(-20, 150, 520, 46), soil(-20, 250, 520, 90)] },
    { name: 'Through the hill', total: 8, need: 6, rate: 1.7, start: { x: 60, y: 250 }, exit: { x: 410, y: 250 }, jobs: { tunnel: 2 },
      hint: 'A hill is in the way. Give a kitten Tunnel and it digs through the next wall it meets.',
      pieces: [soil(200, 150, 90, 110), soil(-20, 250, 520, 90)] },
    { name: 'Up and over', total: 8, need: 6, rate: 1.8, start: { x: 60, y: 250 }, exit: { x: 410, y: 250 }, jobs: { steps: 3 },
      hint: 'Stone can’t be dug. Give a kitten Steps just before the wall and it builds a staircase.',
      pieces: [stone(240, 222, 30, 36), soil(-20, 250, 520, 90)] },
    { name: 'Stop!', total: 8, need: 7, rate: 1.6, start: { x: 250, y: 250 }, exit: { x: 60, y: 250 }, jobs: { stop: 1 },
      hint: 'Oh no, a big gap! Give the first kitten Stop near the edge so the others turn round.',
      pieces: [soil(-20, 250, 340, 90), soil(372, 250, 140, 90)] },
    { name: 'Long way down', total: 8, need: 6, rate: 2, start: { x: 50, y: 110 }, exit: { x: 380, y: 280 }, jobs: { dig: 1, brolly: 8 },
      hint: 'Dig a way through, and hand out brollies for the long drop.',
      pieces: [soil(-20, 110, 520, 40), soil(-20, 280, 520, 60)] },
    { name: 'Mind the gap', total: 8, need: 7, rate: 1.9, start: { x: 50, y: 230 }, exit: { x: 420, y: 230 }, jobs: { steps: 2 },
      hint: 'Build steps right at the edge and they reach over the gap.',
      pieces: [soil(-20, 230, 272, 110), soil(288, 230, 212, 110)] },
    { name: 'Stony ground', total: 8, need: 6, rate: 1.8, start: { x: 40, y: 150 }, exit: { x: 380, y: 250 }, jobs: { dig: 2 },
      hint: 'Only the soil can be dug. Find the soft patch.',
      pieces: [stone(-20, 150, 180, 46), soil(160, 150, 110, 46), stone(270, 150, 230, 46), soil(-20, 250, 520, 90)] },
    { name: 'Hold them back', total: 10, need: 8, rate: 1.6, start: { x: 40, y: 150 }, exit: { x: 420, y: 250 }, jobs: { stop: 1, dig: 1 },
      hint: 'Stop the first kitten near the edge, then give one behind it Dig.',
      pieces: [soil(-20, 150, 320, 46), soil(-20, 250, 520, 90)] },
    { name: 'Over and through', total: 10, need: 8, rate: 1.8, start: { x: 50, y: 250 }, exit: { x: 440, y: 250 }, jobs: { tunnel: 1, steps: 2 },
      hint: 'A hill, then a stone wall. Which job for which?',
      pieces: [soil(150, 160, 80, 100), stone(330, 222, 28, 36), soil(-20, 250, 520, 90)] },
    { name: 'The grand parade', total: 10, need: 8, rate: 2, start: { x: 50, y: 100 }, exit: { x: 440, y: 270 }, jobs: { brolly: 10, tunnel: 1, steps: 2 },
      hint: 'Everything at once! Brollies for the drop, then a hill and a wall.',
      pieces: [soil(-20, 100, 170, 36), soil(220, 180, 70, 100), stone(350, 242, 26, 36), soil(-20, 270, 520, 70)] }
  ];

  /* ================= state ================= */
  var L = null, G = null, state = 'card', fast = false, sel = null;
  var KS = 13;                       // kitten draw size (GGCat size): about 22 tall, 27 long
  var KK = KS / 88;
  var WALK = 22, FALL_MAX = 170, FLOAT_MAX = 38, DIZZY = 64, DIG = 13, TUNNEL = 15, STEP_T = 0.42, BRICKS = 12;
  function loadLevel(lv) {
    lv = clamp(lv, 1, Math.min(P.best, LEVELS.length)); P.cur = lv; save();
    var d = LEVELS[lv - 1];
    L = { lv: lv, d: d, pieces: d.pieces.map(function (p) { return { x: p.x, y: p.y, w: p.w, h: p.h, kind: p.kind }; }) };
    G = { kits: [], holes: [], steps: [], jobs: {}, spawned: 0, home: 0, out: 0, spawnT: 0.8, t: 0, parts: [], pops: [], dirty: true, flap: 0, quiet: 0, ended: false, hinted: false };
    JOBS.forEach(function (j) { G.jobs[j] = d.jobs[j] || 0; });
    sel = null; for (var i = 0; i < JOBS.length; i++) if (G.jobs[JOBS[i]]) { sel = JOBS[i]; break; }
    $('levelLabel').textContent = 'Level ' + lv;
    renderTools(); renderHud();
  }
  function begin() { state = 'play'; track('Start level', { game: 'parade', level: L.lv }); say(L.d.hint, 4); }

  /* ================= the ground ================= */
  function inHole(x, y) {
    for (var i = 0; i < G.holes.length; i++) {
      var h = G.holes[i], dx, dy;
      if (h.x0 === h.x1) { dx = x - h.x0; dy = y < Math.min(h.y0, h.y1) ? y - Math.min(h.y0, h.y1) : y > Math.max(h.y0, h.y1) ? y - Math.max(h.y0, h.y1) : 0; }
      else { dy = y - h.y0; dx = x < Math.min(h.x0, h.x1) ? x - Math.min(h.x0, h.x1) : x > Math.max(h.x0, h.x1) ? x - Math.max(h.x0, h.x1) : 0; }
      if (dx * dx + dy * dy < h.r * h.r) return true;
    }
    return false;
  }
  /* 0 nothing, 1 soil, 2 something hard (stone, wood, a plank of steps) */
  function at(x, y) {
    for (var s = 0; s < G.steps.length; s++) { var b = G.steps[s]; if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return 2; }
    var soft = false;
    for (var i = 0; i < L.pieces.length; i++) {
      var p = L.pieces[i];
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) { if (p.kind !== 'soil') return 2; soft = true; }
    }
    if (soft && !inHole(x, y)) return 1;
    return 0;
  }
  function solid(x, y) { return at(x, y) > 0; }

  /* ================= kittens ================= */
  function spawn() {
    var n = G.spawned++, s = L.d.start;
    G.kits.push({ id: n, x: s.x, y: s.y - 30, dir: 1, st: 'fall', vy: 0, fell: 0, brolly: false, open: 0, look: LOOKS[n % LOOKS.length], step: Math.random() * 6, t: 0, pending: null, job: null, bricks: 0, bt: 0, hole: null, gone: 0 });
    Sound.pop();
  }
  function turn(k) { k.dir = -k.dir; }
  function stoppers(k) { return G.kits.some(function (b) { return b !== k && b.st === 'stop' && Math.abs(b.x - (k.x + k.dir * 5)) < 6 && Math.abs(b.y - k.y) < 14 && Math.sign(b.x - k.x) === k.dir; }); }
  function startFall(k) { k.st = 'fall'; k.vy = 20; k.fell = 0; k.hole = null; }
  /* one unit along the ground */
  function walkStep(k) {
    var nx = k.x + k.dir;
    if (nx < 4 || nx > W - 4 || stoppers(k)) { turn(k); return; }
    if (solid(nx, k.y - 1)) {
      // a bump: step up it if it's small
      for (var up = 1; up <= 6; up++) if (!solid(nx, k.y - 1 - up)) { k.x = nx; k.y -= up; return; }
      // a wall: soil and a Tunnel job, start tunnelling; otherwise turn round
      if (k.pending === 'tunnel' && at(nx + k.dir * 2, k.y - 8) === 1) { k.pending = null; startTunnel(k); return; }
      turn(k); return;
    }
    if (solid(nx, k.y)) { k.x = nx; return; }
    for (var dn = 1; dn <= 4; dn++) if (solid(nx, k.y + dn)) { k.x = nx; k.y += dn; return; }
    k.x = nx; startFall(k);
  }
  function startTunnel(k) {
    k.st = 'tunnel'; k.job = null;
    k.hole = { x0: k.x, y0: k.y - 11, x1: k.x, y1: k.y - 11, r: 10.5 }; G.holes.push(k.hole); G.dirty = true;
    G.quiet = 0;
  }
  function update(dt) {
    if (!L) return;
    G.t += dt; G.flap = Math.max(0, G.flap - dt * 2.5);
    sayT -= dt; if (sayT <= 0 && !$('say').classList.contains('hide')) $('say').classList.add('hide');
    for (var i = G.parts.length - 1; i >= 0; i--) { var q = G.parts[i]; q.life += dt; if (q.life > q.max) { G.parts.splice(i, 1); continue; } q.vy += (q.g === undefined ? 300 : q.g) * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    for (var j = G.pops.length - 1; j >= 0; j--) { G.pops[j].t += dt; if (G.pops[j].t > 1.2) G.pops.splice(j, 1); }
    if (state !== 'play') return;
    if (G.spawned < L.d.total) { G.spawnT -= dt; if (G.spawnT <= 0) { spawn(); G.spawnT = L.d.rate; } }
    G.quiet += dt;
    G.kits.forEach(function (k) { kit(k, dt); });
    // when only stoppers are left, they walk home too
    var busy = G.kits.filter(function (k) { return k.st !== 'home' && k.st !== 'out' && k.st !== 'gone'; });
    if (G.spawned >= L.d.total && busy.length && busy.every(function (k) { return k.st === 'stop'; })) {
      busy.forEach(function (k) { k.st = 'walk'; k.dir = Math.sign(L.d.exit.x - k.x) || 1; });
      say('Off you go, little stoppers!', 2);
    }
    if (G.spawned >= L.d.total && !busy.length && !G.ended) { G.ended = true; var me = G; setTimeout(function () { if (G === me) finish(); }, 900); }
    // kittens pacing about with nothing happening for a long while: call it a day, so a level can always end
    if (G.quiet > 20 && !G.hinted && G.spawned >= L.d.total && busy.length) { G.hinted = true; say(G.home >= L.d.need ? 'Enough kittens are home! The rest are playing outside.' : 'Stuck? Tap the round arrow to have another go.', 3.5); }
    if (G.quiet > 26 && G.home >= L.d.need && busy.length && !G.ended) { G.ended = true; finish(); }
  }
  function kit(k, dt) {
    k.t += dt;
    if (k.st === 'home' || k.st === 'out') { k.gone += dt; return; }
    if (k.st === 'walk') {
      if (!solid(k.x, k.y)) { var dn = 0; while (dn < 4 && !solid(k.x, k.y + dn)) dn++; if (dn < 4) k.y += dn; else { startFall(k); return; } }
      k.acc = (k.acc || 0) + WALK * dt; k.step += dt * 14;
      while (k.acc >= 1 && k.st === 'walk') { k.acc -= 1; walkStep(k); if (atHome(k)) return; }
      return;
    }
    if (k.st === 'fall') {
      if (k.brolly && k.fell > 10) k.open = Math.min(1, k.open + dt * 4);
      var max = k.brolly && k.open > 0.5 ? FLOAT_MAX : FALL_MAX;
      k.vy = Math.min(k.vy + 420 * dt, max); if (k.vy > max) k.vy = max;
      var dy = k.vy * dt, y0 = Math.floor(k.y), y1 = Math.floor(k.y + dy);
      for (var row = y0 + 1; row <= y1; row++) if (solid(k.x, row)) { land(k, row); return; }
      k.y += dy; k.fell += dy;
      if (k.y > H + 30) { k.st = 'out'; k.lost = true; G.out++; G.quiet = 0; renderHud(); Sound.aww(); }
      return;
    }
    if (k.st === 'stop') { if (!solid(k.x, k.y) && !solid(k.x, k.y + 1)) startFall(k); return; }
    if (k.st === 'dig') {
      var h = k.hole, nb = h.y1 + DIG * dt;
      // what's under the paws next: hard, stop; nothing, drop through
      var below = at(k.x, Math.ceil(nb + h.r)), sideL = at(k.x - 4, Math.ceil(nb + h.r)), sideR = at(k.x + 4, Math.ceil(nb + h.r));
      if (below === 2 || sideL === 2 || sideR === 2) { k.st = 'walk'; k.hole = null; pop(k, 'Too hard!'); return; }
      h.y1 = nb; G.dirty = true; k.y = Math.ceil(h.y1 + h.r);
      if (Math.random() < dt * 14) dirt(k.x + rand(-6, 6), k.y - 4, -1);
      if (!solid(k.x, k.y) && !solid(k.x, k.y + 1) && !solid(k.x, k.y + 2)) { k.hole = null; startFall(k); }
      return;
    }
    if (k.st === 'tunnel') {
      var hh = k.hole, front = hh.x1 + k.dir * (hh.r + 1);
      if (!solid(k.x, k.y) && !solid(k.x, k.y + 1)) { k.hole = null; startFall(k); return; }
      var hard = false, any = false;
      for (var yy = k.y - 18; yy <= k.y - 3; yy += 3) for (var ax = 0; ax <= 10; ax += 2) { var a = at(front + k.dir * ax, yy); if (a === 1) any = true; if (a === 2 && ax <= 2) hard = true; }
      if (hard || !any) { if (!hard) { hh.x1 += k.dir * hh.r; G.dirty = true; } k.st = 'walk'; k.hole = null; return; }
      hh.x1 += k.dir * TUNNEL * dt; G.dirty = true; k.x = hh.x1; k.step += dt * 10;
      if (Math.random() < dt * 14) dirt(front, k.y - 10 + rand(-6, 6), k.dir);
      return;
    }
    if (k.st === 'steps') {
      k.bt -= dt; k.step += dt * 6;
      if (k.bt > 0) return;
      if (k.bricks >= BRICKS) { k.st = 'walk'; pop(k, 'Done!'); return; }
      if (solid(k.x + k.dir * 6, k.y - 7) || solid(k.x + k.dir * 6, k.y - 14)) { k.st = 'walk'; return; }
      var b = { x: k.dir > 0 ? k.x - 2 : k.x - 6, y: k.y - 3, w: 8, h: 3 };
      G.steps.push(b); G.dirty = true; k.bricks++; k.bt = STEP_T;
      k.x += k.dir * 5; k.y -= 3; Sound.brick(k.bricks);
      if (k.bricks === BRICKS - 2) pop(k, '2 more');
      return;
    }
  }
  function land(k, row) {
    k.y = row;
    var dizzy = k.fell > DIZZY && !k.brolly;
    k.open = 0; k.vy = 0;
    if (dizzy) { k.st = 'out'; k.dizzy = true; G.out++; G.quiet = 0; renderHud(); Sound.bonk(); buzz(20); pop(k, 'Dizzy!'); for (var i = 0; i < 5; i++) G.parts.push({ x: k.x, y: k.y - 16, vx: rand(-40, 40), vy: rand(-90, -40), life: 0, max: 0.8, r: 3, col: '#FFD23F', kind: 'star', g: 120 }); return; }
    k.st = 'walk'; k.fell = 0;
    atHome(k);
  }
  function atHome(k) {
    var e = L.d.exit;
    if (Math.abs(k.x - e.x) < 6 && Math.abs(k.y - e.y) < 5 && k.st === 'walk') {
      k.st = 'home'; G.home++; G.flap = 1; G.quiet = 0; renderHud(); Sound.home(); buzz(10);
      G.parts.push({ x: e.x, y: e.y - 44, vx: 0, vy: -30, life: 0, max: 1, r: 6, col: '#FF8FAB', kind: 'heart', g: 0 });
      return true;
    }
    return false;
  }
  function dirt(x, y, dir) { if (reduceMotion && Math.random() < 0.7) return; G.parts.push({ x: x, y: y, vx: rand(20, 70) * (dir === -1 ? (Math.random() < 0.5 ? -1 : 1) : -dir), vy: rand(-110, -50), life: 0, max: 0.5, r: rand(1.5, 2.6), col: '#8E5E3C', kind: 'dot' }); }
  function pop(k, txt) { G.pops.push({ x: k.x, y: k.y - 28, t: 0, txt: txt }); }

  /* ================= giving jobs ================= */
  function canDo(k, job) {
    if (k.st === 'home' || k.st === 'out') return false;
    if (job === 'brolly') return !k.brolly;
    if (job === 'stop') return k.st === 'walk' || k.st === 'stop';
    if (job === 'tunnel') return (k.st === 'walk' || k.st === 'steps') && k.pending !== 'tunnel';
    return k.st === 'walk' || k.st === 'tunnel' || k.st === 'steps';
  }
  function assign(k, job) {
    if (job === 'stop' && k.st === 'stop') { k.st = 'walk'; pop(k, 'Off I go!'); Sound.click(); return true; }
    if (!G.jobs[job]) { say('No ' + JOB_NAME[job] + ' jobs left this go.', 1.8); Sound.nope(); return false; }
    if (job === 'dig') {
      var under = at(k.x, k.y + 1);
      if (under !== 1) { pop(k, under === 2 ? 'Too hard!' : 'Nothing to dig'); Sound.nope(); return false; }
      k.st = 'dig'; k.hole = { x0: k.x, y0: k.y - 14, x1: k.x, y1: k.y - 9.5, r: 9.5 }; G.holes.push(k.hole); G.dirty = true;
    } else if (job === 'stop') { k.st = 'stop'; k.hole = null; }
    else if (job === 'tunnel') { if (k.st !== 'walk') k.st = 'walk'; k.pending = 'tunnel'; k.hole = null; }
    else if (job === 'steps') { k.st = 'steps'; k.bricks = 0; k.bt = 0.15; k.hole = null; }
    else if (job === 'brolly') { k.brolly = true; }
    G.jobs[job]--; G.quiet = 0; renderTools(); Sound.job(); buzz(8);
    pop(k, JOB_NAME[job] + '!');
    return true;
  }
  function tapAt(wx, wy) {
    if (state !== 'play' || !sel) return;
    var best = null, bd = Math.max(16, 30 / SC), near = null, nd = 1e9;
    G.kits.forEach(function (k) {
      if (k.st === 'home' || k.st === 'out') return;
      var d = Math.hypot(k.x - wx, k.y - 11 - wy);
      if (d < nd) { nd = d; near = k; }
      if (d < bd && canDo(k, sel)) { bd = d; best = k; }
    });
    if (best) assign(best, sel);
    else if (near && nd < Math.max(16, 30 / SC)) { pop(near, sel === 'brolly' ? 'Got one!' : sel === 'stop' ? 'Busy!' : near.st === 'fall' ? 'Wheee!' : 'Busy!'); Sound.nope(); }
  }

  /* ================= hud, tools, cards ================= */
  var ICON = {
    stop: '<svg viewBox="0 0 32 32"><path d="M10 28 V13 a2.6 2.6 0 0 1 5.2 0 V10 a2.6 2.6 0 0 1 5.2 0 V12 a2.6 2.6 0 0 1 5.2 0 V21 Q25.6 28 18 28 Z" fill="#FFB3C7" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/><path d="M10 18 Q6 14 6 19 Q7 23 10 25" fill="#FFB3C7" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/></svg>',
    dig: '<svg viewBox="0 0 32 32"><rect x="3" y="17" width="26" height="12" rx="3" fill="#C48A5A" stroke="#2A2340" stroke-width="2.6"/><path d="M16 3 V17 M10 11 L16 17 L22 11" fill="none" stroke="#2A2340" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tunnel: '<svg viewBox="0 0 32 32"><rect x="12" y="5" width="17" height="23" rx="3" fill="#C48A5A" stroke="#2A2340" stroke-width="2.6"/><path d="M3 18 H21 M15 12 L21 18 L15 24" fill="none" stroke="#2A2340" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    steps: '<svg viewBox="0 0 32 32"><path d="M3 28 V23 H10 V17 H17 V11 H24 V5 H29 V28 Z" fill="#FF8FAB" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/></svg>',
    brolly: '<svg viewBox="0 0 32 32"><path d="M16 15 V25 a3 3 0 0 1 -6 0" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/><path d="M3 15 Q3 4 16 4 Q29 4 29 15 Q25.7 12 22.5 15 Q19 12 16 15 Q13 12 9.5 15 Q6.3 12 3 15 Z" fill="#7CC4FF" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/></svg>'
  };
  function renderTools() {
    var el = $('tools'); el.innerHTML = '';
    JOBS.forEach(function (j) {
      if (!L.d.jobs[j]) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tool' + (sel === j ? ' sel' : '') + (G.jobs[j] ? '' : ' none');
      b.setAttribute('aria-label', JOB_NAME[j] + ', ' + G.jobs[j] + ' left'); b.setAttribute('aria-pressed', String(sel === j));
      b.innerHTML = ICON[j] + '<span class="nm">' + JOB_NAME[j] + '</span><span class="ct">' + G.jobs[j] + '</span>';
      b.addEventListener('click', function () { Sound.init(); Sound.click(); sel = j; renderTools(); });
      el.appendChild(b);
    });
    layout();
  }
  function renderHud() {
    $('homeCount').textContent = G.home + ' / ' + L.d.need;
    var pill = $('homePill'); pill.classList.remove('bump'); void pill.offsetWidth; if (G.home) pill.classList.add('bump');
  }
  var sayT = 0;
  function say(t, s) { var el = $('say'); el.textContent = t; el.classList.remove('hide'); sayT = s || 2; }
  var STAR = '<svg viewBox="0 0 32 32"><path d="M16 3 L19.8 11.5 L29 12.4 L22 18.6 L24.1 27.7 L16 23 L7.9 27.7 L10 18.6 L3 12.4 L12.2 11.5 Z" fill="FILL" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/></svg>';
  function starsFor() { var t = L.d.total; return G.home >= t ? 3 : G.home >= L.d.need + Math.ceil((t - L.d.need) / 2) ? 2 : G.home >= L.d.need ? 1 : 0; }
  var cardMode = 'intro', pickLv = 1;
  function finish() {
    var st = starsFor();
    if (st > 0) {
      if (L.lv >= P.best && L.lv < LEVELS.length) P.best = L.lv + 1;
      P.stars[L.lv] = Math.max(P.stars[L.lv] || 0, st); save();
      Sound.win(); track('Finish level', { game: 'parade', level: L.lv, home: G.home, stars: st });
      if (GG.stat) GG.stat('parade', 'levels', 1);
      showCard('won', st);
    } else { Sound.aww(); track('Lose level', { game: 'parade', level: L.lv, home: G.home }); showCard('lost'); }
  }
  function showCard(mode, st) {
    cardMode = mode; state = 'card';
    var lv = L.lv, d = L.d, starsEl = $('cardStars');
    starsEl.hidden = mode !== 'won';
    if (mode === 'won') {
      starsEl.innerHTML = [0, 1, 2].map(function (i) { return STAR.replace('FILL', i < st ? '#FFD23F' : '#E8E2F0'); }).join('');
      $('cardTitle').textContent = st === 3 ? 'Every kitten home!' : 'Home sweet home!';
      $('cardNote').textContent = G.home + ' of ' + d.total + ' kittens made it home.';
      $('cardTip').textContent = st < 3 ? 'Get all ' + d.total + ' home for three stars.' : lv < LEVELS.length ? 'On to the next one?' : 'That’s every level. What a parade!';
      pickLv = Math.min(lv + 1, P.best, LEVELS.length);
      $('goBtn').textContent = pickLv !== lv ? 'Next level' : 'Play again';
    } else if (mode === 'lost') {
      $('cardTitle').textContent = 'So close!';
      $('cardNote').textContent = G.home + ' of ' + d.need + ' kittens got home. The dizzy ones are just having a nap.';
      $('cardTip').textContent = 'Tip: ' + d.hint;
      pickLv = lv; $('goBtn').textContent = 'Try again';
    } else {
      pickLv = lv;
      $('cardTitle').textContent = 'Kitten Parade';
      $('cardNote').textContent = 'Kittens walk along by themselves. Pick a job, then tap a kitten to help them all get home.';
      $('cardTip').textContent = '';
      $('goBtn').textContent = 'Let’s go!';
      if (window.innerHeight > window.innerWidth * 1.2) $('cardNote').textContent += ' (Turn your phone sideways for a bigger garden.)';
    }
    renderPick(); drawCardPic(mode);
    $('cardWrap').hidden = false;
  }
  function renderPick() {
    var d = LEVELS[pickLv - 1];
    $('lvName').textContent = 'Level ' + pickLv + ': ' + d.name + (P.stars[pickLv] ? ' ' + '★'.repeat(P.stars[pickLv]) : '');
    $('lvPrev').disabled = pickLv <= 1; $('lvNext').disabled = pickLv >= Math.min(P.best, LEVELS.length);
    if (cardMode === 'intro' || pickLv !== L.lv) { $('cardTip').textContent = 'Get ' + d.need + ' of ' + d.total + ' kittens home.'; }
    if (cardMode !== 'intro') $('goBtn').textContent = pickLv === L.lv ? (cardMode === 'lost' ? 'Try again' : 'Play again') : pickLv === L.lv + 1 ? 'Next level' : 'Play level ' + pickLv;
  }
  $('lvPrev').addEventListener('click', function () { Sound.init(); Sound.click(); pickLv = Math.max(1, pickLv - 1); renderPick(); });
  $('lvNext').addEventListener('click', function () { Sound.init(); Sound.click(); pickLv = Math.min(Math.min(P.best, LEVELS.length), pickLv + 1); renderPick(); });
  $('goBtn').addEventListener('click', function () {
    Sound.init(); Sound.click(); $('cardWrap').hidden = true;
    if (cardMode !== 'intro' || pickLv !== L.lv) loadLevel(pickLv);
    begin();
  });
  $('againBtn').addEventListener('click', function (e) { e.stopPropagation(); Sound.init(); Sound.click(); if (!$('cardWrap').hidden) return; loadLevel(L.lv); begin(); });
  var fastBtn = $('fastBtn');
  function renderFast() {
    fastBtn.setAttribute('aria-pressed', String(fast)); fastBtn.setAttribute('aria-label', fast ? 'Normal speed' : 'Speed up');
    fastBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 8 L15 16 L5 24 Z M16 8 L26 16 L16 24 Z" fill="' + (fast ? '#FFD23F' : '#FFFDF8') + '" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/></svg>';
  }
  fastBtn.addEventListener('click', function (e) { e.stopPropagation(); Sound.init(); Sound.click(); fast = !fast; renderFast(); });
  renderFast();
  window.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && !$('cardWrap').hidden) { e.preventDefault(); $('goBtn').click(); return; }
    var n = parseInt(e.key, 10), avail = JOBS.filter(function (j) { return L.d.jobs[j]; });
    if (n >= 1 && n <= avail.length) { sel = avail[n - 1]; renderTools(); }
    if (e.key === 'f') fastBtn.click();
  });

  /* ================= input on the garden ================= */
  var canvas = $('stage');
  canvas.addEventListener('pointerdown', function (e) { Sound.init(); tapAt((e.clientX - OX) / SC, (e.clientY - OY) / SC); });
  var hover = null;
  canvas.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') hover = { x: (e.clientX - OX) / SC, y: (e.clientY - OY) / SC }; });
  canvas.addEventListener('pointerleave', function () { hover = null; });

  /* ================= drawing ================= */
  var ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, SC = 1, OX = 0, OY = 0, bgCv = null, terCv = null;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var tb = $('toolbar').getBoundingClientRect(), side = tb.left > cw * 0.55 && tb.height > tb.width;
    var top = $('topbar').getBoundingClientRect().bottom + 6, bottom = side ? ch - 10 : tb.top - 14, right = side ? tb.left - 10 : cw - 6;
    SC = Math.min((right - 6) / W, (bottom - top) / H);
    OX = Math.round(side ? Math.max(6, (right - W * SC) / 2) : (cw - W * SC) / 2); OY = Math.round(top + Math.max(0, (bottom - top - H * SC) / 2));
    $('say').style.top = (OY + 8) + 'px';
    bgCv = null; terCv = null; if (G) G.dirty = true;
  }
  function offscreen() { var cv = document.createElement('canvas'); cv.width = Math.round(W * SC * dpr); cv.height = Math.round(H * SC * dpr); var c = cv.getContext('2d'); c.scale(SC * dpr, SC * dpr); c.lineJoin = 'round'; c.lineCap = 'round'; return { cv: cv, c: c }; }
  function background() {
    if (bgCv && bgCv.lv === L.lv) return bgCv.cv;
    var o = offscreen(), c = o.c;
    S.sky(c, 0, 0, W, H, { kind: 'day', ls: SC });
    S.cloud(c, 90, 50, { size: 70, ls: SC }); S.cloud(c, 330, 34, { size: 56, ls: SC }); S.cloud(c, 430, 80, { size: 44, kind: 'cat', ls: SC });
    S.hills(c, 0, 190, W, 140, { kind: 'two', col: '#A8E0A0', back: '#C6ECC0', ls: SC });
    bgCv = { lv: L.lv, cv: o.cv };
    return o.cv;
  }
  function terrain() {
    if (terCv && !G.dirty) return terCv;
    if (!terCv) terCv = offscreen();
    var c = terCv.c; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, terCv.cv.width, terCv.cv.height); c.restore();
    S.terrain(c, L.pieces, G.holes, { steps: G.steps, ls: SC, seed: L.lv });
    G.dirty = false;
    return terCv;
  }
  function drawKit(c, k) {
    var o = {}, lk = k.look; for (var key in lk) o[key] = lk[key];
    o.size = KS; o.dir = k.dir;
    var a = k.st === 'home' ? clamp(1 - k.gone * 3, 0, 1) : k.st === 'out' && k.lost ? 0 : 1;
    if (a <= 0) return;
    c.save(); c.globalAlpha = a; c.translate(k.x, k.y);
    if (k.st === 'stop') { o.pose = 'wave'; o.face = 'open'; c.translate(0, -100 * KK); }
    else if (k.st === 'out') { o.pose = 'lie'; o.face = 'sleep'; c.translate(0, -52 * KK); }
    else if (k.st === 'dig') { o.pose = 'sit'; o.face = 'open'; c.translate(Math.sin(k.t * 30) * 0.8, -100 * KK + 2); }
    else {
      o.pose = 'walk'; o.step = k.step; o.wag = k.t;
      o.moving = k.st === 'walk' || k.st === 'tunnel' || (k.st === 'steps' && k.bt > STEP_T * 0.5);
      o.face = k.st === 'fall' && !(k.brolly && k.open > 0.5) ? 'surprised' : k.st === 'tunnel' ? 'open' : 'happy';
      c.translate(33 * KK * k.dir, -78 * KK);
      if (k.st === 'home') c.scale(1 - k.gone, 1 - k.gone);
    }
    try { GGCat.draw(c, o); } catch (e) { c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fillStyle = '#FFA94D'; c.fill(); }
    c.restore();
    if (k.st === 'fall' && k.brolly && k.open > 0) T.umbrella(c, k.x + k.dir * 2, k.y - 20, { size: 0.42, open: k.open, ls: SC * 1.8, col: '#7CC4FF' });
    if (k.st === 'steps') T.yarnBall(c, k.x + k.dir * 9, k.y - 4, { r: 4, col: '#FF8FAB', ls: SC * 2 });
    // little badges: a job waiting (Tunnel) or a brolly kept for later
    var bx = k.x, by = k.y - 30;
    if (k.st !== 'out' && k.st !== 'home') {
      if (k.pending === 'tunnel') badge(c, bx, by, '#C48A5A');
      if (k.brolly && k.st !== 'fall') T.umbrella(c, k.x - k.dir * 6, k.y - 6, { size: 0.3, open: 0.55, a: -k.dir * 0.35, ls: SC * 2.2 });
    }
    if (k.st === 'out' && k.dizzy) {
      c.save(); c.font = '800 9px "Baloo 2", sans-serif'; c.fillStyle = '#7A6F8E'; var zt = (G.t * 0.6 + k.id * 0.37) % 1; c.globalAlpha = 1 - zt; c.fillText('z', k.x + 10, k.y - 14 - zt * 10); c.restore();
    }
  }
  function badge(c, x, y, col) { c.beginPath(); c.arc(x, y, 3.6, 0, TAU); c.fillStyle = col; c.fill(); D.ink(c, 1.6 / Math.max(1, SC * 0.6)); }
  function draw(c) {
    c.fillStyle = '#BFE6FF'; c.fillRect(0, 0, cw, ch);
    if (!L) return;
    c.save(); D.rr(c, OX, OY, W * SC, H * SC, 16); c.clip();
    c.drawImage(background(), OX, OY, W * SC, H * SC);
    c.translate(OX, OY); c.scale(SC, SC);
    var d = L.d, ter = terrain();
    // the box they hop out of, the house they head for
    S.box(c, d.start.x, d.start.y, { w: 40, h: 26, col: '#DDA86F', ls: SC });
    S.catHouse(c, d.exit.x + 2, d.exit.y, { w: 54, door: G.flap, glow: 0.5 + 0.5 * Math.sin(G.t * 3), ls: SC });
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(ter.cv, OX * dpr, OY * dpr); c.restore();
    G.kits.forEach(function (k) { if (k.st === 'out') drawKit(c, k); });
    G.kits.forEach(function (k) { if (k.st !== 'out') drawKit(c, k); });
    // which kitten a click would pick
    if (hover && sel && state === 'play') {
      var hb = null, hd = Math.max(16, 30 / SC);
      G.kits.forEach(function (k) { var dd = Math.hypot(k.x - hover.x, k.y - 11 - hover.y); if (dd < hd && canDo(k, sel)) { hd = dd; hb = k; } });
      if (hb) { c.beginPath(); c.ellipse(hb.x, hb.y - 11, 15, 16, 0, 0, TAU); c.setLineDash([4, 3]); c.strokeStyle = '#FFFDF8'; c.lineWidth = 2.4; c.stroke(); c.setLineDash([]); }
    }
    G.parts.forEach(function (q) {
      var k2 = 1 - q.life / q.max; c.save(); c.globalAlpha = Math.min(1, k2 * 1.5); c.translate(q.x, q.y);
      if (q.kind === 'heart') { var r = q.r; c.beginPath(); c.moveTo(0, r * 0.8); c.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.4); c.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.3, -r * 0.1, 0, r * 0.8); c.closePath(); c.fillStyle = q.col; c.fill(); D.ink(c, 1.6); }
      else if (q.kind === 'star') { T.star(c, q.r); c.fillStyle = q.col; c.fill(); D.ink(c, 1); }
      else { c.beginPath(); c.arc(0, 0, q.r, 0, TAU); c.fillStyle = q.col; c.fill(); }
      c.restore();
    });
    G.pops.forEach(function (q) { c.save(); c.globalAlpha = clamp(1.4 - q.t * 1.2, 0, 1); c.font = '800 11px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.lineWidth = 3.2; c.strokeStyle = INK; var y = q.y - q.t * 12; c.strokeText(q.txt, q.x, y); c.fillStyle = '#FFE58A'; c.fillText(q.txt, q.x, y); c.restore(); });
    c.restore();
    D.rr(c, OX, OY, W * SC, H * SC, 16); D.ink(c, 4);
  }
  function drawCardPic(mode) {
    var c = $('cardPic').getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 480, 300);
    c.save(); D.rr(c, 6, 6, 468, 288, 26); c.clip();
    c.lineJoin = 'round'; c.lineCap = 'round';
    S.sky(c, 0, 0, 480, 300, { kind: 'day' }); S.cloud(c, 110, 60, { size: 90 }); S.cloud(c, 380, 46, { size: 70, kind: 'cat' });
    S.hills(c, 0, 170, 480, 140, { kind: 'two', col: '#A8E0A0', back: '#C6ECC0' });
    c.save(); c.scale(2, 2);
    S.terrain(c, [soil(-10, 112, 120, 50), soil(150, 128, 120, 40), stone(110, 136, 40, 30)], [{ x0: 80, y0: 104, x1: 80, y1: 128, r: 9.5 }], { steps: [{ x: 98, y: 109, w: 12, h: 3 }, { x: 103, y: 106, w: 12, h: 3 }, { x: 108, y: 103, w: 12, h: 3 }], ls: 2 });
    S.catHouse(c, 214, 128, { w: 46, door: 0.3, glow: 1, ls: 2 });
    var cats = [[34, 112, 0, 'walk'], [56, 112, 1, 'walk'], [108, 103, 2, 'walk'], [80, 128, 3, 'sit']];
    cats.forEach(function (q, i) {
      var o = {}; for (var k in LOOKS[q[2]]) o[k] = LOOKS[q[2]][k]; o.size = KS; o.pose = q[3]; o.dir = 1; o.step = i * 1.7; o.moving = true; o.face = mode === 'lost' ? 'open' : 'happy';
      c.save(); c.translate(q[0], q[1]); if (q[3] === 'walk') c.translate(33 * KK, -78 * KK); else c.translate(0, -100 * KK + 2);
      try { GGCat.draw(c, o); } catch (e) {} c.restore();
    });
    var o2 = {}; for (var k2 in LOOKS[4]) o2[k2] = LOOKS[4][k2]; o2.size = KS; o2.pose = 'walk'; o2.dir = 1; o2.face = 'happy';
    c.save(); c.translate(170, 52); T.umbrella(c, 2, 0, { size: 0.42, ls: 2 }); c.translate(0, 20); c.translate(33 * KK, -78 * KK); try { GGCat.draw(c, o2); } catch (e) {} c.restore();
    c.restore();
    c.restore();
    D.rr(c, 6, 6, 468, 288, 26); D.ink(c, 5);
  }

  /* ================= sound ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null, on = GG.getSetting('sound', true);
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
      pop: function () { tone({ f: 420, to: 760, dur: 0.1, gain: 0.05, type: 'triangle', slide: 0.08 }); },
      job: function () { tone({ f: 660, dur: 0.07, gain: 0.07, type: 'triangle' }); tone({ f: 990, dur: 0.09, gain: 0.06, delay: 0.06, type: 'triangle' }); },
      nope: function () { tone({ f: 300, to: 240, dur: 0.12, gain: 0.05, type: 'triangle' }); },
      brick: function (n) { tone({ f: 440 + n * 40, dur: 0.05, gain: 0.04, type: 'square' }); },
      bonk: function () { noise({ type: 'lowpass', freq: 500, dur: 0.12, gain: 0.12 }); tone({ f: 700, to: 300, dur: 0.3, gain: 0.05, type: 'triangle', slide: 0.3 }); },
      home: function () { [784, 1046].forEach(function (f, i) { tone({ f: f, dur: 0.12, gain: 0.06, delay: i * 0.07, type: 'triangle' }); }); },
      aww: function () { [520, 440, 360].forEach(function (f, i) { tone({ f: f, dur: 0.22, gain: 0.06, delay: i * 0.15, type: 'triangle' }); }); },
      win: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone({ f: f, dur: 0.2, gain: 0.07, delay: i * 0.1, type: 'triangle' }); }); }
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
  var last = performance.now(), paused = false;
  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (!paused) { update(dt); if (fast) update(dt); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    draw(ctx);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', function () { paused = document.hidden; last = performance.now(); });
  loadLevel(P.cur || 1);
  layout();
  showCard('intro');
  requestAnimationFrame(frame);

  /* test hooks */
  window.__kp = {
    LEVELS: LEVELS,
    state: function () { return { state: state, lv: L.lv, home: G.home, out: G.out, spawned: G.spawned, jobs: G.jobs, kits: G.kits.map(function (k) { return { x: Math.round(k.x), y: Math.round(k.y), st: k.st, dir: k.dir }; }) }; },
    load: function (lv) { $('cardWrap').hidden = true; P.best = Math.max(P.best, lv); loadLevel(lv); begin(); },
    give: function (i, job) { var k = G.kits[i]; return k && canDo(k, job) ? assign(k, job) : false; },
    kits: function () { return G.kits; },
    tick: function (n) { for (var i = 0; i < n; i++) update(1 / 60); },
    // run the level with a plan: [{ when: function (kits, G) -> kitten index or -1, job }] tried every tick
    run: function (lv, plan, secs) {
      this.load(lv); var used = plan.map(function () { return false; });
      for (var i = 0; i < (secs || 200) * 60; i++) {
        plan.forEach(function (p, j) { if (used[j]) return; var idx = p.when(G.kits, G); if (idx >= 0 && canDo(G.kits[idx], p.job)) { assign(G.kits[idx], p.job); used[j] = true; } });
        update(1 / 60);
        if (G.ended) break;
      }
      return { home: G.home, out: G.out, need: L.d.need, total: L.d.total, ended: G.ended, stars: starsFor(), used: used };
    }
  };
})();
