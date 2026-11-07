/* Sneaky Cat – a stealth game for older kids (11+). It's the middle of the night and your cat wants the snack at the
   far end of the house. Dogs are asleep along the way. Hold (or hold → / D) to tiptoe; let go to freeze.
   Each dog sleeps, then stirs (its ear goes up: a warning), then looks along the floor in front of it (the glow
   shows how far it can see). Move inside that glow while it's looking and it woofs: your cat scurries back to the
   last safe spot (the last hiding place, or floor no dog can see) — not the start. Boxes, plant pots and armchairs
   are hiding places, safe even when a dog looks. Squeaky floorboards make the nearest dog check straight away, so hop
   over them (the Hop button, or space / ↑). Fish to collect. Three stars: reach the snack, get every fish, never
   get spotted. Levels get longer, with more dogs, shorter naps, dogs facing the other way, and dogs that share a
   room. Saves GG.setProgress('sneaky', { best, cur, stars: { level: n } }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function track(n, d) { if (window.GG && GG.track) GG.track(n, d); }

  var P = (function () {
    var p = {}; try { p = GG.getProgress('sneaky') || {}; } catch (e) {}
    if (typeof p.best !== 'number' || p.best < 1) p.best = 1;
    if (typeof p.cur !== 'number') p.cur = 1;
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    return p;
  })();
  function save() { try { GG.setProgress('sneaky', P); } catch (e) {} }

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

  /* ================= the house =================
     World units, side view. y down; the back of the floor is at FLOOR. Dogs lie a little further back (DOG_Y),
     the cat walks along CAT_Y, hiding places stand in front (SPOT_Y). */
  var FLOOR = 470, DOG_Y = FLOOR + 26, CAT_Y = FLOOR + 50, SPOT_Y = FLOOR + 70;
  var SIZE = 66, K0 = SIZE / 88;
  var SPEED = 170, BACK = 560, HOP_D = 118, HOP_T = 0.46, HOP_COOL = 0.3, GRACE = 0.12;
  var SPOT_W = { box: 116, plant: 118, chair: 168 };
  var DOG_COLS = [
    { body: '#C98B5B', dark: '#9A6440', ear: '#7E4E30' },
    { body: '#EBD7B0', dark: '#CDB281', ear: '#B8925E' },
    { body: '#9C97AE', dark: '#77728C', ear: '#5C5874' },
    { body: '#4A4262', dark: '#342E4A', ear: '#2A2340', spots: false },
    { body: '#FFFFFF', dark: '#DCD6E6', ear: '#4A4262', spots: true }
  ];
  var WALLS = ['#4B4378', '#3E4C75', '#58456F', '#4A5472'];

  /* each level from its number: the same house every time you play it */
  function plan(lv) {
    var warn = Math.max(0.5, 1.3 - lv * 0.035);
    var sleep = [Math.max(2, 3.8 - lv * 0.08), Math.max(3, 5.4 - lv * 0.09)];
    var look = [Math.min(2.6, 1.4 + lv * 0.05), Math.min(3.4, 2.2 + lv * 0.06)];
    return {
      dogs: Math.min(1 + Math.floor((lv - 1) / 3), 6),
      warn: warn, sleep: sleep, look: look,
      boards: lv >= 3 ? Math.min(1 + Math.floor((lv - 3) / 4), 3) : 0,
      backwards: lv >= 5 ? 0.35 : 0,     // dogs that face the snack: they see you once you're past them
      share: lv >= 7 ? 0.5 : 0,          // the next dog's room starts before you're out of this one's sight
      fish: lv >= 2 ? 1 : 0
    };
  }
  function makeLevel(lv) {
    var pl = plan(lv), R = D.seeded(lv * 7717 + 13);
    function rr(a, b) { return a + R() * (b - a); }
    var L = { lv: lv, dogs: [], spots: [], boards: [], fish: [], pl: pl };
    // 1. the dogs, and the stretch of floor each one can see
    var x = 420, prevShare = false;
    for (var i = 0; i < pl.dogs; i++) {
      var zl = clamp(340 + lv * 12 + rr(0, 140), 340, 760);
      var face = (!prevShare && R() < pl.backwards) ? 1 : -1;
      var dog = { face: face, col: DOG_COLS[Math.floor(R() * DOG_COLS.length)], seed: R() };
      if (face === -1) { dog.x = x + zl; dog.z0 = x; dog.z1 = dog.x + 40; }
      else { dog.x = x + 40; dog.z0 = dog.x - 40; dog.z1 = dog.x + zl; }
      L.dogs.push(dog);
      // where the next dog's room starts: sometimes before you're out of this one's sight
      prevShare = face === -1 && i < pl.dogs - 1 && R() < pl.share;
      x = prevShare ? dog.x - rr(90, 200) : (face === -1 ? dog.x + 200 : dog.z1 + rr(120, 220));
    }
    var bodies = L.dogs.map(function (d) { return [d.x - 125, d.x + 125]; });
    function inBody(px, pad) { return bodies.some(function (b) { return px > b[0] - pad && px < b[1] + pad; }); }
    function seenBy(px) { return L.dogs.filter(function (d) { return px >= d.z0 && px <= d.z1; }).length; }
    // 2. the stretches some dog can see (overlapping ones joined up)
    var zs = L.dogs.map(function (d) { return [d.z0, d.z1]; }).sort(function (p, q) { return p[0] - q[0]; }), runs = [];
    zs.forEach(function (z) { var r = runs[runs.length - 1]; if (r && z[0] <= r[1]) r[1] = Math.max(r[1], z[1]); else runs.push([z[0], z[1]]); });
    // 3. hiding places along each one, so every open stretch can be crossed in one nap. Where two dogs watch the
    //    same floor they both have to be asleep, so those stretches are shorter.
    var lim1 = (pl.sleep[0] + pl.warn) * SPEED * 0.8, kinds = ['box', 'plant', 'chair'];
    runs.forEach(function (run) {
      var cur = run[0], placed = 0;
      for (var guard = 0; guard < 20; guard++) {
        var kind = kinds[Math.floor(R() * 3)], w = SPOT_W[kind], half = w / 2 - 20;
        var lim = lim1;
        for (var px = cur; px < Math.min(run[1], cur + lim1); px += 20) if (seenBy(px) > 1) { lim = lim1 * 0.55; break; }
        if (run[1] - cur <= lim && !(lv <= 2 && !placed)) break;
        var target = Math.min(cur + lim * 0.9 + half, lv <= 2 && !placed ? (run[0] + run[1]) / 2 : 1e9), sx = target;
        while (inBody(sx, w / 2 + 6) && sx > cur + half + 30) sx -= 10;
        // no room between the dogs: a low box right in front of one (its warnings still show above it)
        if (inBody(sx, w / 2 + 6)) { sx = target; kind = 'box'; w = SPOT_W.box; half = w / 2 - 20; }
        if (sx > run[1] - 30) break;
        L.spots.push({ x: sx, kind: kind, w: w, seed: R() });
        bodies.push([sx - w / 2 + 125, sx + w / 2 - 125]);   // (keeps other things off it too)
        cur = sx + half; placed++;
      }
    });
    L.spots.sort(function (p, q) { return p.x - q.x; });
    function clear(px, pad) {
      return !inBody(px, pad) && !L.spots.some(function (s) { return Math.abs(px - s.x) < s.w / 2 + pad; }) &&
        !L.boards.some(function (b) { return Math.abs(px - b.x) < 150; }) && seenBy(px) > 0;
    }
    // 4. squeaky boards and fish out in the open, where it's risky
    runs.forEach(function (run) {
      var nb = Math.min(pl.boards, Math.floor((run[1] - run[0]) / 320));
      for (var bI = 0; bI < nb; bI++) for (var t = 0; t < 30; t++) { var bx = rr(run[0] + 70, run[1] - 70); if (clear(bx, 70)) { L.boards.push({ x: bx, w: 64, cool: 0 }); break; } }
    });
    if (pl.fish) L.dogs.forEach(function (d) {
      for (var t = 0; t < 40; t++) {
        var fx = rr(d.z0 + 40, d.z1 - 40);
        if (clear(fx, t < 20 ? 30 : 0) && !L.fish.some(function (f) { return Math.abs(f.x - fx) < 120; }) && !L.boards.some(function (b) { return Math.abs(b.x - fx) < 60; })) { L.fish.push({ x: fx, got: false }); break; }
      }
    });
    L.boards.sort(function (p, q) { return p.x - q.x; });
    var lastEnd = Math.max.apply(null, L.dogs.map(function (d) { return Math.max(d.z1, d.x + 120); }));
    L.goal = lastEnd + 260;
    L.end = L.goal + 220;
    // windows, pictures and lamps on the walls
    var R2 = D.seeded(lv * 31 + 5); L.deco = [];
    for (var dx = 160; dx < L.end; dx += 300 + R2() * 220) if (Math.abs(((dx + 550) % 1100) - 550) > 170) L.deco.push({ x: dx, kind: R2() < 0.45 ? 'window' : R2() < 0.6 ? 'picture' : 'lamp', seed: R2() });
    return L;
  }

  /* ================= state ================= */
  var L = null, G = null;   // the level, and this go at it
  var state = 'card';       // 'card' | 'play' | 'won'
  function newGo() {
    G = { x: 120, mode: 'play', held: false, step: 0, hop: null, cool: 0, check: 120, spotted: 0, got: 0, hidden: null,
      eatT: 0, parts: [], pops: [], shake: 0, frozeT: 0, lastStepT: 0, startT: time };
    L.dogs.forEach(function (d, i) {
      d.st = 'sleep'; d.t = 0; d.dur = rand(L.pl.sleep[0], L.pl.sleep[1]) + (i === 0 ? 0.6 : rand(0, 1.5)); d.seen = 0; d.mark = 0; d.snore = rand(0, 2);
    });
    L.fish.forEach(function (f) { f.got = false; });
    L.boards.forEach(function (b) { b.cool = 0; b.wob = 0; });
    camX = 0;
  }
  function loadLevel(lv) {
    lv = clamp(lv, 1, P.best);
    P.cur = lv; save();
    L = makeLevel(lv); newGo();
    $('levelLabel').textContent = 'Level ' + lv;
    $('prevBtn').disabled = lv <= 1; $('nextBtn').disabled = lv >= P.best;
    $('hopBtn').hidden = !L.boards.length;
    track('Start level', { game: 'sneaky', level: lv });
  }
  function inZone(d, x) { return x >= d.z0 && x <= d.z1; }
  function spotAt(x) {
    var s = null; L.spots.forEach(function (o) { if (Math.abs(x - o.x) < o.w / 2 - 20) s = o; }); return s;
  }

  /* ================= input ================= */
  var canvas = $('stage'), keys = {};
  function holdOn() { Sound.init(); if (state === 'play') G.held = true; }
  function holdOff() { if (G) G.held = false; }
  var pointers = {};
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); pointers[e.pointerId] = 1; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} holdOn(); });
  function pUp(e) { delete pointers[e.pointerId]; if (!Object.keys(pointers).length && !keys.walk) holdOff(); }
  canvas.addEventListener('pointerup', pUp);
  canvas.addEventListener('pointercancel', pUp);
  function hop() {
    Sound.init();
    if (state !== 'play' || G.mode !== 'play' || G.hop || G.cool > 0) return;
    G.hop = { t: 0, x0: G.x }; Sound.hop();
  }
  var hopBtn = $('hopBtn');
  hopBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); hopBtn.classList.add('on'); hop(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { hopBtn.addEventListener(t, function () { hopBtn.classList.remove('on'); }); });
  hopBtn.addEventListener('click', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); keys.walk = true; holdOn(); }
    else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault(); if (e.repeat) return;
      if (state === 'card' && !$('cardWrap').hidden) { $('goBtn').click(); return; }
      hop();
    }
  });
  window.addEventListener('keyup', function (e) { if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.walk = false; if (!Object.keys(pointers).length) holdOff(); } });

  $('prevBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); loadLevel(L.lv - 1); state = 'play'; levelSay(); });
  $('nextBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); loadLevel(L.lv + 1); state = 'play'; levelSay(); });
  $('resetBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); newGo(); state = 'play'; });
  $('goBtn').addEventListener('click', function () {
    Sound.init(); Sound.click(); hideCard();
    if (cardMode === 'won') loadLevel(L.lv + 1);
    else if (cardMode === 'again') newGo();
    state = 'play'; levelSay();
  });
  $('againBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); newGo(); state = 'play'; });

  /* ================= playing ================= */
  function update(dt) {
    if (!L || !G) return;
    sayT -= dt; if (sayT <= 0 && !$('say').classList.contains('hide')) $('say').classList.add('hide');
    updateParts(dt);
    if (state === 'won') { G.eatT += dt; if (G.eatT > 1.7 && !G.carded) { G.carded = true; showCard('won'); } return; }
    if (state !== 'play') return;
    L.dogs.forEach(function (d) { updateDog(d, dt); });
    L.boards.forEach(function (b) { b.cool -= dt; b.wob = Math.max(0, b.wob - dt * 3); });
    G.shake = Math.max(0, G.shake - dt * 3);
    if (G.mode === 'run') {
      // scurrying back to the last safe spot
      G.x -= BACK * dt; G.step += dt * BACK / 22;
      if (G.x <= G.check) { G.x = G.check; G.mode = 'play'; G.held = false; G.frozeT = 0; }
      if (Math.random() < dt * 20) Sound.patter();
      return;
    }
    var moving = false;
    G.cool -= dt;
    if (G.hop) {
      G.hop.t += dt; G.x = G.hop.x0 + HOP_D * Math.min(1, G.hop.t / HOP_T); moving = true;
      if (G.hop.t >= HOP_T) { G.hop = null; G.cool = HOP_COOL; Sound.land(); }
    } else if (G.held) {
      G.x += SPEED * dt; moving = true; G.step += dt * SPEED / 22;
      if (time - G.lastStepT > 0.28) { G.lastStepT = time; Sound.step(); }
    }
    G.x = Math.min(G.x, L.goal);
    G.frozeT = moving ? 0 : G.frozeT + dt;
    G.moving = moving;
    // squeaky boards (not when hopping over them)
    if (moving && !G.hop) L.boards.forEach(function (b) {
      if (b.cool > 0 || Math.abs(G.x - b.x) > b.w / 2 + 4) return;
      b.cool = 1.2; b.wob = 1; Sound.squeak(); buzz(20);
      G.pops.push({ x: b.x, y: CAT_Y - 30, t: 0, txt: 'SQUEAK!' });
      L.dogs.forEach(function (d) { if (inZone(d, b.x) && (d.st === 'sleep' || d.st === 'settle')) { d.st = 'stir'; d.t = 0; d.dur = 0.35; d.mark = 1; } });
    });
    // fish
    L.fish.forEach(function (f) {
      if (f.got || Math.abs(f.x - G.x) > 30) return;
      f.got = true; G.got++; Sound.fish();
      for (var i = 0; i < 6; i++) G.parts.push({ x: f.x, y: CAT_Y - 20, vx: rand(-110, 110), vy: rand(-170, -50), life: 0, max: 0.5, r: rand(4, 7), col: '#BFE6FF', kind: 'star' });
    });
    // hidden? safe floor? (both become the place you scurry back to)
    G.hidden = spotAt(G.x);
    var seen = L.dogs.some(function (d) { return inZone(d, G.x); });
    if (G.hidden) G.check = G.hidden.x; else if (!seen) G.check = G.x;
    // spotted?
    for (var i = 0; i < L.dogs.length; i++) {
      var d = L.dogs[i];
      if (d.st === 'look' && moving && !G.hidden && inZone(d, G.x)) {
        d.seen += dt;
        if (d.seen > GRACE) { spotted(d); return; }
      } else d.seen = 0;
    }
    if (G.x >= L.goal - 1) win();
  }
  function updateDog(d, dt) {
    d.t += dt; d.mark = Math.max(0, d.mark - dt);
    if (d.st === 'sleep') {
      d.snore -= dt; if (d.snore <= 0) { d.snore = 2.2; if (onScreen(d.x)) Sound.snore(); }
      if (d.t >= d.dur) { d.st = 'stir'; d.t = 0; d.dur = L.pl.warn; if (onScreen(d.x)) Sound.stir(); }
    } else if (d.st === 'stir') {
      if (d.t >= d.dur) { d.st = 'look'; d.t = 0; d.dur = rand(L.pl.look[0], L.pl.look[1]); }
    } else if (d.st === 'look') {
      if (d.t >= d.dur) { d.st = 'settle'; d.t = 0; d.dur = 0.6; }
    } else if (d.st === 'bark') {
      if (d.t >= d.dur) { d.st = 'settle'; d.t = 0; d.dur = 0.8; }
    } else if (d.st === 'settle') {
      if (d.t >= d.dur) { d.st = 'sleep'; d.t = 0; d.dur = rand(L.pl.sleep[0], L.pl.sleep[1]); }
    }
  }
  function spotted(d) {
    G.spotted++; G.mode = 'run'; G.hop = null; G.held = false; G.shake = 1;
    d.st = 'bark'; d.t = 0; d.dur = 1.3;
    Sound.woof(); buzz([40, 40, 60]);
    G.pops.push({ x: d.x + d.face * 70, y: DOG_Y - 110, t: 0, txt: 'WOOF!', big: true });
    say(G.spotted === 1 ? 'Spotted! Back to the last safe spot…' : 'Woof! Back you go…', 1.8);
    track('Spotted', { game: 'sneaky', level: L.lv });
  }
  function win() {
    state = 'won'; G.eatT = 0; G.carded = false; G.held = false;
    var stars = 1 + (G.got >= L.fish.length ? 1 : 0) + (G.spotted === 0 ? 1 : 0);
    G.stars = stars;
    var prev = P.stars[L.lv] || 0;
    if (stars > prev) P.stars[L.lv] = stars;
    G.newBest = stars > prev && prev > 0;
    if (L.lv >= P.best) P.best = L.lv + 1;
    save();
    Sound.win(); buzz(25);
    for (var i = 0; i < 14; i++) G.parts.push({ x: L.goal, y: CAT_Y - 60, vx: rand(-160, 160), vy: rand(-280, -80), life: 0, max: 0.9, r: rand(5, 9), col: ['#FFD23F', '#FF8FAB', '#7CC4FF'][i % 3], kind: 'star' });
    track('Finish level', { game: 'sneaky', level: L.lv, stars: stars, spotted: Math.min(G.spotted, 10) });
    if (GG.stat) GG.stat('sneaky', 'levels', 1);
  }
  function updateParts(dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) { var p = G.parts[i]; p.life += dt; if (p.life > p.max) { G.parts.splice(i, 1); continue; } p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (var j = G.pops.length - 1; j >= 0; j--) { G.pops[j].t += dt; if (G.pops[j].t > 1.1) G.pops.splice(j, 1); }
  }

  /* ================= messages and cards ================= */
  var sayT = 0;
  function say(t, s) { var el = $('say'); el.innerHTML = '<span class="pill">' + t + '</span>'; el.classList.remove('hide'); sayT = s || 2.2; }
  function levelSay() {
    var pl = L.pl, prev = L.lv > 1 ? plan(L.lv - 1) : null;
    if (L.lv === 1) say('Hold to tiptoe. Let go to freeze.', 3);
    else if (pl.boards && !(prev && prev.boards)) say('Squeaky floorboards! Hop over them.', 3);
    else if (pl.backwards && !(prev && prev.backwards)) say('Some dogs face the other way. Careful once you’re past!', 3.2);
    else if (pl.share && !(prev && prev.share)) say('Two dogs can watch the same spot now.', 3);
    else if (pl.dogs > (prev ? prev.dogs : 0)) say('Level ' + L.lv + ': ' + pl.dogs + ' dogs', 2);
    else say('Level ' + L.lv, 1.6);
  }
  var cardMode = 'intro';
  function showCard(mode) {
    cardMode = mode;
    $('againBtn').hidden = mode !== 'won';
    if (mode === 'won') {
      $('cardTitle').textContent = G.stars === 3 ? 'Purr-fectly sneaky!' : 'Snack time!';
      var bits = [];
      if (L.fish.length) bits.push(G.got >= L.fish.length ? 'every fish' : G.got + ' of ' + L.fish.length + ' fish');
      bits.push(G.spotted ? 'spotted ' + G.spotted + (G.spotted === 1 ? ' time' : ' times') : 'never spotted');
      $('cardNote').textContent = 'Level ' + L.lv + ' done: ' + bits.join(', ') + '.';
      $('cardTip').textContent = G.stars < 3 ? (G.spotted ? 'For three stars, don’t get spotted at all.' : 'For three stars, get every fish too.') : (G.newBest ? 'Three stars on this one now!' : '');
      $('goBtn').textContent = 'Level ' + (L.lv + 1);
    } else {
      $('cardTitle').textContent = 'Sneaky Cat';
      $('cardNote').textContent = 'Sneak past the sleeping dogs to your midnight snack.';
      $('cardTip').textContent = 'Hold to tiptoe. Let go to freeze. When a dog’s ear goes up, it’s about to look!';
      $('goBtn').textContent = P.best > 1 ? 'Play level ' + L.lv : 'Sneak!';
    }
    drawCardPic(mode === 'won' ? G.stars : 0);
    $('cardWrap').hidden = false;
  }
  function hideCard() { $('cardWrap').hidden = true; }

  /* ================= drawing ================= */
  var ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, K = 1, VW = 800, FS = 400, camX = 0, topGap = 70;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    // a wide screen sees 900 units across, an upright phone 700 (enough to see the dog ahead); at least 560 tall
    K = Math.min(ch / 560, cw / (cw < ch ? 700 : 900));
    VW = cw / K;
    topGap = $('topbar').getBoundingClientRect().bottom || 70;
    // where the back of the floor sits on screen: low enough for the wall, with the floor below
    FS = clamp(ch * 0.6, topGap + 330 * K, ch - 150 * K);
  }
  function wx(x) { return (x - camX) * K; }
  function wy(y) { return FS + (y - FLOOR) * K; }
  function onScreen(x) { return x > camX - 100 && x < camX + VW + 100; }
  function at(c, x, y) { c.save(); c.translate(wx(x), wy(y)); c.scale(K, K); }

  function drawRoom(c) {
    // walls: a different colour per room, with door frames between
    var roomW = 1100, r0 = Math.floor(camX / roomW), r1 = Math.floor((camX + VW) / roomW);
    for (var r = r0; r <= r1; r++) {
      var x0 = Math.max(wx(r * roomW), 0), x1 = Math.min(wx((r + 1) * roomW), cw);
      var g = c.createLinearGradient(0, 0, 0, wy(FLOOR));
      var col = WALLS[((r % WALLS.length) + WALLS.length) % WALLS.length];
      g.addColorStop(0, D.darker(col, 0.25)); g.addColorStop(1, col);
      c.fillStyle = g; c.fillRect(x0, 0, x1 - x0 + 1, wy(FLOOR) + 1);
      // wallpaper stripes
      c.fillStyle = 'rgba(255,255,255,.035)';
      for (var sx = r * roomW; sx < (r + 1) * roomW; sx += 60) { var a = wx(sx); if (a > -30 && a < cw) c.fillRect(a, 0, 26 * K, wy(FLOOR)); }
    }
    for (var d = r0; d <= r1 + 1; d++) {
      var fx = d * roomW; if (fx <= 0 || !onScreen(fx)) continue;
      at(c, fx, FLOOR);
      D.shape(c, D.rrPath(-60, -300, 22, 300, 3), '#7A5C6E', { lw: D.LW.mid, depth: 4 });
      D.shape(c, D.rrPath(38, -300, 22, 300, 3), '#7A5C6E', { lw: D.LW.mid, depth: 4 });
      D.shape(c, D.rrPath(-66, -320, 132, 26, 4), '#8C6B7E', { lw: D.LW.mid, depth: 4 });
      c.restore();
    }
    // windows (with the moon), pictures and lamps
    L.deco.forEach(function (o) {
      if (!onScreen(o.x)) return;
      at(c, o.x, FLOOR);
      if (o.kind === 'window') {
        var g2 = c.createLinearGradient(0, -330, 0, -170); g2.addColorStop(0, '#1C1838'); g2.addColorStop(1, '#3D3170');
        D.shape(c, D.rrPath(-70, -340, 140, 170, 8), g2, { lw: D.LW.big, depth: 0, inside: function (c) {
          c.fillStyle = '#FFF6D8'; [[-40, -310, 1.6], [30, -300, 1.2], [10, -230, 1.4], [-20, -260, 1]].forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], s[2], 0, TAU); c.fill(); });
          if (o.seed < 0.5) { c.beginPath(); c.arc(28, -300, 18, 0, TAU); c.fillStyle = '#FFF1C9'; c.fill(); D.ink(c, 2.5); }
        } });
        c.beginPath(); c.moveTo(0, -340); c.lineTo(0, -170); c.moveTo(-70, -255); c.lineTo(70, -255); D.ink(c, 4);
        D.shape(c, D.rrPath(-82, -176, 164, 14, 4), '#E9DCC8', { lw: D.LW.mid, depth: 3 });
        // moonlight on the floor
        c.fillStyle = 'rgba(255,240,200,.07)'; c.beginPath(); c.moveTo(-70, -170); c.lineTo(70, -170); c.lineTo(150, 130); c.lineTo(-10, 130); c.closePath(); c.fill();
      } else if (o.kind === 'picture') {
        D.shape(c, D.rrPath(-46, -320, 92, 72, 4), '#C9A15B', { lw: D.LW.mid, depth: 3, inside: function (c) {
          c.fillStyle = o.seed < 0.75 ? '#9ED9C0' : '#FFB4A2'; c.fillRect(-36, -310, 72, 52);
          c.beginPath(); c.moveTo(-36, -266); c.quadraticCurveTo(-10, -300, 14, -272); c.quadraticCurveTo(24, -290, 36, -276); c.lineTo(36, -258); c.lineTo(-36, -258); c.closePath(); c.fillStyle = '#5EA47E'; c.fill();
          c.beginPath(); c.arc(20, -296, 7, 0, TAU); c.fillStyle = '#FFF1C9'; c.fill();
        } });
      } else {
        // a little table lamp (switched off) on a side table
        D.shape(c, D.rrPath(-34, -80, 68, 10, 3), '#A07A5E', { lw: D.LW.mid, depth: 2 });
        D.shape(c, D.rrPath(-26, -70, 8, 70, 3), '#8A6650', { lw: D.LW.fine, depth: 0 });
        D.shape(c, D.rrPath(18, -70, 8, 70, 3), '#8A6650', { lw: D.LW.fine, depth: 0 });
        D.shape(c, D.rrPath(-4, -120, 8, 40, 3), '#C3CBD4', { lw: D.LW.fine, depth: 0 });
        D.shape(c, function (p) { p.moveTo(-28, -118); p.lineTo(28, -118); p.lineTo(18, -158); p.lineTo(-18, -158); p.closePath(); }, '#E9B8C8', { lw: D.LW.mid, depth: 4 });
      }
      c.restore();
    });
    // skirting board and floor
    var fy = wy(FLOOR);
    c.fillStyle = '#E9DCC8'; c.fillRect(0, fy - 18 * K, cw, 18 * K);
    c.fillStyle = '#7A5560'; c.fillRect(0, fy, cw, ch - fy);
    var rows = [[FLOOR, FLOOR + 38, '#84606A'], [FLOOR + 38, FLOOR + 80, '#7A5560'], [FLOOR + 80, FLOOR + 130, '#704D58'], [FLOOR + 130, FLOOR + 400, '#664650']];
    rows.forEach(function (row, i) {
      c.fillStyle = row[2]; c.fillRect(0, wy(row[0]), cw, (row[1] - row[0]) * K + 1);
      c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, wy(row[0])); c.lineTo(cw, wy(row[0])); c.stroke();
      var len = 150 + i * 30, off = i * 57;
      for (var bx = Math.floor((camX - off) / len) * len + off; bx < camX + VW + len; bx += len) { c.beginPath(); c.moveTo(wx(bx), wy(row[0])); c.lineTo(wx(bx), wy(row[1])); c.stroke(); }
    });
    c.beginPath(); c.moveTo(0, fy - 18 * K); c.lineTo(cw, fy - 18 * K); c.moveTo(0, fy); c.lineTo(cw, fy); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  }
  function drawBoard(c, b) {
    if (!onScreen(b.x)) return;
    var wob = Math.sin(time * 40) * b.wob * 3;
    at(c, b.x, FLOOR + 38);
    c.translate(0, wob * 0.3);
    D.shape(c, D.rrPath(-b.w / 2, 0, b.w, 42, 4), '#B58A6A', { lw: 3, depth: 0, inside: function (c) {
      c.strokeStyle = 'rgba(42,35,64,.5)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-b.w / 2 + 10, 14); c.lineTo(-6, 20); c.lineTo(6, 14); c.lineTo(b.w / 2 - 10, 22); c.stroke();
      c.fillStyle = INK; [[-b.w / 2 + 7, 8], [b.w / 2 - 7, 8], [-b.w / 2 + 7, 34], [b.w / 2 - 7, 34]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], 2.2, 0, TAU); c.fill(); });
    } });
    // little squeak lines above it, so you can see it's the squeaky one
    c.strokeStyle = 'rgba(255,246,216,' + (0.35 + b.wob * 0.6) + ')'; c.lineWidth = 3; c.lineCap = 'round';
    [-14, 0, 14].forEach(function (dx, i) { var lift = 10 + b.wob * 10; c.beginPath(); c.moveTo(dx * 1.4, -lift - 4); c.lineTo(dx * 1.9, -lift - 14 - (i === 1 ? 4 : 0)); c.stroke(); });
    c.restore();
  }
  function drawZone(c, d) {
    // how far the dog can see: a soft glow on the floor; bright while it's looking
    var a = d.st === 'look' || d.st === 'bark' ? 0.28 : d.st === 'stir' ? 0.1 + 0.08 * Math.sin(time * 14) : 0.045;
    var x0 = wx(d.z0), x1 = wx(d.z1), y0 = wy(FLOOR + 6), y1 = wy(FLOOR + 110);
    if (x1 < 0 || x0 > cw) return;
    var g = c.createLinearGradient(d.face < 0 ? x1 : x0, 0, d.face < 0 ? x0 : x1, 0);
    g.addColorStop(0, 'rgba(255,226,140,' + a + ')'); g.addColorStop(1, 'rgba(255,226,140,' + a * 0.45 + ')');
    c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (a > 0.08) { c.setLineDash([8, 8]); c.strokeStyle = 'rgba(255,226,140,' + Math.min(0.9, a * 2.6) + ')'; c.lineWidth = 2.5; c.strokeRect(x0, y0, x1 - x0, y1 - y0); c.setLineDash([]); }
  }
  function drawDog(c, d) {
    if (!onScreen(d.x)) return;
    var col = d.col, st = d.st, awake = st === 'look' || st === 'bark';
    var lift = st === 'look' || st === 'bark' ? 1 : st === 'stir' ? clamp(d.t / Math.max(0.2, d.dur), 0, 1) * 0.35 : st === 'settle' ? 1 - clamp(d.t / d.dur, 0, 1) : 0;
    var breathe = st === 'sleep' ? Math.sin(time * 2 + d.seed * 10) * 0.03 : 0;
    at(c, d.x, DOG_Y);
    c.scale(-d.face, 1);   // drawn facing left (head at -x) when face is -1
    c.scale(1, 1);
    // its bed
    D.shape(c, D.ellPath(0, -4, 104, 22), '#B05F7C', { lw: D.LW.mid, depth: 0 });
    D.shape(c, D.ellPath(0, -10, 88, 14), '#D27C9A', { lw: 0, depth: 0 });
    // tail (wags a bit when awake)
    var wag = awake ? Math.sin(time * 12) * 0.4 : 0;
    c.save(); c.translate(58, -36); c.rotate(0.5 + wag);
    D.shape(c, function (p) { p.moveTo(0, -6); p.quadraticCurveTo(26, -20, 40, -6); p.quadraticCurveTo(28, -8, 2, 6); p.closePath(); }, col.body, { lw: D.LW.fine, depth: 0 });
    c.restore();
    // body
    c.save(); c.translate(0, -34); c.scale(1, 1 + breathe);
    D.shape(c, D.ellPath(0, 0, 70, 30), col.body, { lw: D.LW.mid, depth: 6, inside: col.spots ? function (c) { c.fillStyle = '#4A4262'; [[10, -14, 16, 11], [-28, 6, 12, 9], [40, 4, 10, 8]].forEach(function (s) { c.beginPath(); c.ellipse(s[0], s[1], s[2], s[3], 0.3, 0, TAU); c.fill(); }); } : null });
    c.restore();
    // back leg
    D.shape(c, D.ellPath(38, -24, 24, 20), col.body, { lw: D.LW.mid, depth: 4 });
    D.shape(c, D.rrPath(34, -12, 36, 14, 7), col.body, { lw: D.LW.fine, depth: 0 });
    // front paws stretched out in front
    D.shape(c, D.rrPath(-104, -16, 56, 16, 8), col.body, { lw: D.LW.fine, depth: 0 });
    D.shape(c, D.rrPath(-96, -10, 50, 14, 7), col.dark, { lw: D.LW.fine, depth: 0 });
    // head: resting on the paws when asleep, up when awake
    var hx = -74 - lift * 6, hy = -34 - lift * 38;
    c.save(); c.translate(hx, hy); c.rotate(lerp(0.12, -0.05, lift));
    D.shape(c, D.ellPath(0, 0, 30, 25), col.body, { lw: D.LW.mid, depth: 4 });
    // snout and nose
    var open = st === 'bark' ? Math.abs(Math.sin(d.t * 18)) : 0;
    D.shape(c, D.ellPath(-28, 6 + open * 2, 18, 12 + open * 3), col.body, { lw: D.LW.fine, depth: 0 });
    if (open > 0.2) { c.beginPath(); c.ellipse(-30, 14 + open * 4, 10, 4 + open * 5, 0, 0, TAU); c.fillStyle = '#A3405C'; c.fill(); D.ink(c, 2.5); }
    c.beginPath(); c.ellipse(-44, 2, 6, 5, 0, 0, TAU); c.fillStyle = INK; c.fill();
    // eye: closed, peeking, or wide open
    if (st === 'sleep' || (st === 'settle' && d.t > d.dur * 0.5)) {
      c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(-8, -1, -2, -6); D.ink(c, 3);
    } else if (st === 'stir') {
      c.beginPath(); c.moveTo(-15, -6); c.lineTo(-1, -6); D.ink(c, 3);
      c.beginPath(); c.arc(-8, -4, 3, 0, Math.PI); c.fillStyle = INK; c.fill();
    } else {
      c.beginPath(); c.arc(-8, -6, 6.5, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); D.ink(c, 2.5);
      c.beginPath(); c.arc(-10, -6, 3.4, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.moveTo(-17, -16); c.lineTo(-2, -15); D.ink(c, 3);
    }
    // the floppy ear: hangs down asleep, perks up when it stirs
    var perk = st === 'stir' || awake ? 1 : st === 'settle' ? 1 - clamp(d.t / d.dur, 0, 1) : 0;
    c.save(); c.translate(10, -16); c.rotate(lerp(0.2, -0.9, perk) + (st === 'stir' ? Math.sin(time * 30) * 0.08 : 0));
    D.shape(c, function (p) { p.moveTo(-6, 0); p.quadraticCurveTo(14, -6, 16, 14); p.quadraticCurveTo(16, 34, 6, 36); p.quadraticCurveTo(-4, 30, -6, 0); p.closePath(); }, col.ear, { lw: D.LW.fine, depth: 0 });
    c.restore();
    c.restore();
    c.restore();
  }
  // what a dog is doing, over its head (drawn on top of everything, the right way round)
  function drawDogBubble(c, d) {
    if (!onScreen(d.x)) return;
    var st = d.st, lift = st === 'look' || st === 'bark' ? 1 : st === 'stir' ? clamp(d.t / Math.max(0.2, d.dur), 0, 1) * 0.35 : st === 'settle' ? 1 - clamp(d.t / d.dur, 0, 1) : 0;
    var bx = d.x + d.face * 70, by = DOG_Y - 104 - lift * 30;
    if (st === 'sleep') {
      for (var i = 0; i < 3; i++) {
        var ph = (time * 0.6 + i / 3 + d.seed) % 1;
        at(c, bx + d.face * -10 + ph * 28 * -d.face * -1, by + 30 - ph * 50);
        c.globalAlpha = Math.sin(ph * Math.PI);
        c.font = '800 ' + (16 + ph * 10) + 'px ' + displayFont; c.textAlign = 'center';
        c.lineWidth = 5; c.strokeStyle = INK; c.strokeText('z', 0, 0); c.fillStyle = '#BFE6FF'; c.fillText('z', 0, 0);
        c.restore();
      }
    } else if (st === 'stir' || st === 'look') {
      at(c, bx, by + (st === 'stir' ? 10 : 0));
      var s2 = st === 'stir' ? 0.85 + Math.sin(time * 16) * 0.08 : 1;
      c.scale(s2, s2);
      D.shape(c, D.ellPath(0, -6, 20, 20), st === 'look' ? '#FFD23F' : '#FFF6D8', { lw: D.LW.fine, depth: 0 });
      c.font = '800 26px ' + displayFont; c.textAlign = 'center'; c.fillStyle = INK; c.fillText(st === 'look' ? '!' : '?', 0, 3);
      c.restore();
    }
  }
  var displayFont = 'sans-serif';
  function drawSpot(c, o, front) {
    if (!onScreen(o.x)) return;
    at(c, o.x, SPOT_Y);
    var w = o.w;
    if (o.kind === 'box') {
      D.shadow(c, 0, 4, w * 0.52, 8);
      D.shape(c, function (p) { p.moveTo(-w / 2, -84); p.lineTo(-w / 2 - 22, -104); p.lineTo(-w / 2 + 8, -98); p.lineTo(-w / 2 + 16, -84); p.closePath(); }, '#C9935E', { lw: D.LW.fine, depth: 0 });
      D.shape(c, function (p) { p.moveTo(w / 2, -84); p.lineTo(w / 2 + 22, -104); p.lineTo(w / 2 - 8, -98); p.lineTo(w / 2 - 16, -84); p.closePath(); }, '#C9935E', { lw: D.LW.fine, depth: 0 });
      D.shape(c, D.rrPath(-w / 2, -86, w, 88, 4), '#DDA86F', { lw: D.LW.mid, depth: 6, inside: function (c) {
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-14, -86, 28, 88);
        c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-w / 2 + 14, -30); c.lineTo(-w / 2 + 34, -30); c.moveTo(-w / 2 + 14, -22); c.lineTo(-w / 2 + 28, -22); c.stroke();
      } });
    } else if (o.kind === 'plant') {
      D.shadow(c, 0, 4, 46, 8);
      var leaves = [[-0.9, 120], [-0.45, 140], [0, 150], [0.45, 140], [0.9, 120], [-0.65, 100], [0.65, 100]];
      leaves.forEach(function (lf, i) {
        c.save(); c.translate(0, -60); c.rotate(lf[0] * 0.75 + Math.sin(time * 1.3 + i) * 0.015);
        D.shape(c, function (p) { p.moveTo(0, 0); p.quadraticCurveTo(-30, -lf[1] * 0.5, 0, -lf[1]); p.quadraticCurveTo(30, -lf[1] * 0.5, 0, 0); p.closePath(); }, i % 2 ? '#4FB868' : '#3E9C58', { lw: D.LW.fine, depth: 0, inside: function (c) { c.beginPath(); c.moveTo(0, -6); c.lineTo(0, -lf[1] + 14); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2.5; c.stroke(); } });
        c.restore();
      });
      D.shape(c, function (p) { p.moveTo(-46, -66); p.lineTo(46, -66); p.lineTo(36, 0); p.lineTo(-36, 0); p.closePath(); }, '#E07A5F', { lw: D.LW.mid, depth: 6 });
      D.shape(c, D.rrPath(-52, -74, 104, 16, 5), '#C8654B', { lw: D.LW.mid, depth: 0 });
    } else {
      // an armchair, seen from the side a little
      D.shadow(c, 0, 4, w * 0.5, 9);
      D.shape(c, D.rrPath(-w / 2 + 10, -150, w - 20, 110, 26), '#7C8FD6', { lw: D.LW.mid, depth: 6 });
      D.shape(c, D.rrPath(-w / 2 + 8, -66, w - 16, 44, 12), '#94A6EA', { lw: D.LW.mid, depth: 4 });
      D.shape(c, D.rrPath(-w / 2 - 6, -100, 34, 90, 14), '#6A7CC4', { lw: D.LW.mid, depth: 4 });
      D.shape(c, D.rrPath(w / 2 - 28, -100, 34, 90, 14), '#6A7CC4', { lw: D.LW.mid, depth: 4 });
      D.shape(c, D.rrPath(-w / 2 + 6, -12, 12, 14, 3), '#5A4A60', { lw: D.LW.fine, depth: 0 });
      D.shape(c, D.rrPath(w / 2 - 18, -12, 12, 14, 3), '#5A4A60', { lw: D.LW.fine, depth: 0 });
    }
    c.restore();
  }
  function drawFish(c, f) {
    if (f.got || !onScreen(f.x)) return;
    at(c, f.x, CAT_Y - 26 + Math.sin(time * 4 + f.x) * 4);
    c.globalAlpha = 0.3 + 0.15 * Math.sin(time * 5); c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fillStyle = '#BFE6FF'; c.fill(); c.globalAlpha = 1;
    D.shape(c, function (p) { p.moveTo(-16, 0); p.quadraticCurveTo(-4, -12, 8, -5); p.lineTo(17, -11); p.lineTo(17, 11); p.lineTo(8, 5); p.quadraticCurveTo(-4, 12, -16, 0); p.closePath(); }, '#7CC4FF', { lw: D.LW.fine, depth: 3 });
    c.beginPath(); c.arc(-8, -1.5, 2, 0, TAU); c.fillStyle = INK; c.fill();
    c.restore();
  }
  function drawGoal(c) {
    if (!onScreen(L.goal)) return;
    // a cushion and the midnight snack
    at(c, L.goal + 60, CAT_Y + 4);
    D.shadow(c, 0, 2, 70, 9);
    D.shape(c, D.ellPath(0, -14, 68, 20), '#FF8FAB', { lw: D.LW.mid, depth: 5 });
    D.shape(c, D.ellPath(0, -20, 50, 11), '#FFB3C8', { lw: 0, depth: 0 });
    c.restore();
    at(c, L.goal + 6, CAT_Y + 8);
    D.shape(c, function (p) { p.moveTo(-30, -24); p.lineTo(30, -24); p.lineTo(22, 0); p.lineTo(-22, 0); p.closePath(); }, '#7CC4FF', { lw: D.LW.mid, depth: 4 });
    if (state !== 'won' || G.eatT < 1) {
      c.save(); c.translate(0, -30); c.rotate(-0.3);
      D.shape(c, function (p) { p.moveTo(-16, 0); p.quadraticCurveTo(-4, -12, 8, -5); p.lineTo(17, -11); p.lineTo(17, 11); p.lineTo(8, 5); p.quadraticCurveTo(-4, 12, -16, 0); p.closePath(); }, '#FFB070', { lw: D.LW.fine, depth: 3 });
      c.restore();
    }
    c.restore();
    // a sparkle so you can see where you're going
    var sx = L.goal + 6, sy = CAT_Y - 70 + Math.sin(time * 3) * 5;
    at(c, sx, sy); c.rotate(time); starPath(c, 12); c.fillStyle = '#FFD23F'; c.fill(); D.ink(c, 2.5); c.restore();
  }
  function starPath(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawCat(c) {
    var hopY = G.hop ? -Math.sin(Math.min(1, G.hop.t / HOP_T) * Math.PI) * 54 : 0;
    var x = G.x, eating = state === 'won';
    at(c, x, CAT_Y);
    if (!G.hop) D.shadow(c, -8, 2, 30, 6); else D.shadow(c, -8, 2, 24, 5);
    c.translate(G.shake ? Math.sin(time * 60) * G.shake * 4 : 0, hopY);
    var watched = L.dogs.some(function (d) { return (d.st === 'look' || d.st === 'stir') && inZone(d, G.x); });
    var o = {}; for (var k in CAT) o[k] = CAT[k];
    o.size = SIZE; o.dir = G.mode === 'run' ? -1 : 1; o.step = G.step;
    if (eating) {
      o.pose = 'sit'; o.face = G.eatT > 0.4 ? 'happy' : 'open';
      c.translate(-8, -100 * K0 + Math.sin(G.eatT * 14) * (G.eatT < 1 ? 2 : 0));
    } else {
      o.pose = 'walk'; o.moving = G.moving || G.mode === 'run';
      o.face = G.mode === 'run' ? 'surprised' : G.hidden ? 'happy' : (watched && !G.moving ? 'surprised' : 'open');
      // a low, sneaky crouch while tiptoeing; stiller still when frozen
      var crouch = G.mode === 'run' ? 1 : G.moving ? 0.92 : 0.88;
      c.scale(1 / Math.sqrt(crouch), crouch);
      c.translate(0, -78 * K0);
    }
    try { GGCat.draw(c, o); } catch (e) { c.beginPath(); c.arc(0, 0, 30, 0, TAU); c.fillStyle = '#FFA94D'; c.fill(); }
    c.restore();
    if (eating && G.eatT > 0.6) {
      var ph = (G.eatT - 0.6) % 1;
      at(c, x + 30, CAT_Y - 120 - ph * 40); c.globalAlpha = 1 - ph;
      c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-13, -1, -6, -11, 0, -4); c.bezierCurveTo(6, -11, 13, -1, 0, 8); c.closePath(); c.fillStyle = '#FF7EB6'; c.fill(); D.ink(c, 2.5);
      c.restore();
    }
  }
  function drawHud(c) {
    // the fish for this level, top left under the bar: filled once caught
    if (!L.fish.length) return;
    var x = 16, y = topGap + 18;
    L.fish.forEach(function (f, i) {
      c.save(); c.translate(x + 22 + i * 44, y + 14); c.scale(0.9, 0.9);
      D.shape(c, function (p) { p.moveTo(-16, 0); p.quadraticCurveTo(-4, -12, 8, -5); p.lineTo(17, -11); p.lineTo(17, 11); p.lineTo(8, 5); p.quadraticCurveTo(-4, 12, -16, 0); p.closePath(); }, f.got ? '#7CC4FF' : 'rgba(255,255,255,.15)', { lw: 3, depth: 0, line: f.got ? INK : 'rgba(255,246,216,.6)' });
      c.restore();
    });
  }
  function draw(c) {
    if (!L) return;
    var target = clamp(G.x - VW * (VW < 800 ? 0.16 : 0.26), -40, Math.max(-40, L.end - VW));
    camX += (target - camX) * (G.mode === 'run' ? 0.25 : 0.18);
    if (Math.abs(target - camX) > VW) camX = target;
    drawRoom(c);
    L.dogs.forEach(function (d) { drawZone(c, d); });
    L.boards.forEach(function (b) { drawBoard(c, b); });
    L.dogs.forEach(function (d) { drawDog(c, d); });
    drawGoal(c);
    L.fish.forEach(function (f) { drawFish(c, f); });
    drawCat(c);
    L.spots.forEach(function (o) { drawSpot(c, o); });
    L.dogs.forEach(function (d) { drawDogBubble(c, d); });
    // darken the edges a little: it's night
    var vg = c.createRadialGradient(cw / 2, ch * 0.55, Math.min(cw, ch) * 0.35, cw / 2, ch * 0.55, Math.max(cw, ch) * 0.8);
    vg.addColorStop(0, 'rgba(20,16,40,0)'); vg.addColorStop(1, 'rgba(20,16,40,.45)');
    c.fillStyle = vg; c.fillRect(0, 0, cw, ch);
    G.parts.forEach(function (p) {
      var k = 1 - p.life / p.max; at(c, p.x, p.y); c.globalAlpha = k;
      c.rotate(p.life * 6); starPath(c, p.r); c.fillStyle = p.col; c.fill(); D.ink(c, 1.5);
      c.restore();
    });
    G.pops.forEach(function (p) {
      var k = p.t / 1.1; at(c, p.x, p.y - k * 40); c.globalAlpha = 1 - k * k;
      var s = p.big ? 1 + Math.max(0, 0.3 - p.t) * 2 : 1; c.scale(s, s);
      c.font = '800 ' + (p.big ? 38 : 24) + 'px ' + displayFont; c.textAlign = 'center';
      c.lineWidth = 7; c.strokeStyle = INK; c.strokeText(p.txt, 0, 0); c.fillStyle = p.big ? '#FFD23F' : '#FFF6D8'; c.fillText(p.txt, 0, 0);
      c.restore();
    });
    drawHud(c);
  }
  function drawCardPic(stars) {
    var c = $('cardPic').getContext('2d');
    c.clearRect(0, 0, 440, 300);
    c.save(); D.rr(c, 6, 6, 428, 288, 26); c.clip();
    var g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#2E2852'); g.addColorStop(1, '#4B4378'); c.fillStyle = g; c.fillRect(0, 0, 440, 300);
    c.fillStyle = '#7A5560'; c.fillRect(0, 220, 440, 80); c.fillStyle = '#E9DCC8'; c.fillRect(0, 208, 440, 12);
    c.beginPath(); c.moveTo(0, 220); c.lineTo(440, 220); D.ink(c, 3);
    // a sleeping dog and a tiptoeing cat
    var fake = { x: 0, face: -1, col: DOG_COLS[0], st: stars ? 'sleep' : 'sleep', t: 0, dur: 1, seed: 0.3 };
    var saveK = K, saveCam = camX, saveFS = FS; K = 0.8; camX = -330 / K; FS = 210 + (FLOOR - DOG_Y) * 0.8 + 18;
    try { drawDog(c, fake); } catch (e) {}
    K = saveK; camX = saveCam; FS = saveFS;
    c.save(); c.translate(120, 196); var o = {}; for (var k in CAT) o[k] = CAT[k]; o.pose = stars ? 'sit' : 'walk'; o.size = 74; o.dir = 1; o.step = 1.3; o.moving = !stars; o.face = stars ? 'happy' : 'open';
    if (stars) c.translate(0, -36); else { c.scale(1.06, 0.9); c.translate(0, -66); }
    try { GGCat.draw(c, o); } catch (e) {} c.restore();
    if (stars) for (var i = 0; i < 3; i++) {
      c.save(); c.translate(150 + i * 70, 70 - (i === 1 ? 14 : 0)); starPath(c, 26); c.fillStyle = i < stars ? '#FFD23F' : 'rgba(255,255,255,.18)'; c.fill(); c.lineWidth = 4; c.strokeStyle = i < stars ? INK : 'rgba(255,246,216,.5)'; c.stroke(); c.restore();
    } else { c.beginPath(); c.arc(360, 60, 24, 0, TAU); c.fillStyle = '#FFF1C9'; c.fill(); D.ink(c, 3); }
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
      step: function () { noise({ type: 'bandpass', freq: rand(1800, 2600), q: 3, dur: 0.02, gain: 0.025 }); },
      patter: function () { noise({ type: 'bandpass', freq: rand(1500, 2500), q: 2, dur: 0.02, gain: 0.05 }); },
      hop: function () { tone({ f: 420, to: 760, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); },
      land: function () { noise({ type: 'lowpass', freq: 380, dur: 0.05, gain: 0.06 }); },
      squeak: function () { tone({ f: 900, to: 1500, dur: 0.12, gain: 0.08, type: 'sawtooth', slide: 0.08 }); tone({ f: 1400, to: 800, dur: 0.14, gain: 0.06, type: 'sawtooth', delay: 0.1, slide: 0.12 }); },
      snore: function () { noise({ type: 'lowpass', freq: 220, q: 3, attack: 0.5, dur: 0.6, gain: 0.05 }); },
      stir: function () { tone({ f: 260, to: 320, dur: 0.12, gain: 0.06, type: 'triangle' }); tone({ f: 330, to: 400, dur: 0.14, gain: 0.05, type: 'triangle', delay: 0.14 }); },
      woof: function () {
        [0, 0.24].forEach(function (dl) {
          tone({ f: 330, to: 170, dur: 0.16, gain: 0.14, type: 'square', delay: dl, slide: 0.14 });
          noise({ type: 'bandpass', freq: 700, q: 1.2, dur: 0.12, gain: 0.12, delay: dl });
        });
      },
      fish: function () { tone({ f: 1046.5, dur: 0.08, gain: 0.06 }); tone({ f: 1568, dur: 0.1, gain: 0.05, delay: 0.05 }); },
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
  var time = 0, last = performance.now(), paused = false;
  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (!paused) { time += dt; update(dt); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    draw(ctx);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', function () { paused = document.hidden; last = performance.now(); if (G) G.held = false; pointers = {}; keys = {}; });
  try { displayFont = getComputedStyle(document.body).getPropertyValue('--display') || 'sans-serif'; } catch (e) {}
  layout();
  loadLevel(P.cur || 1);
  showCard('intro');
  requestAnimationFrame(frame);

  /* test hooks */
  window.__sneak = {
    state: function () { return { state: state, mode: G.mode, x: G.x, goal: L.goal, lv: L.lv, best: P.best, spotted: G.spotted, got: G.got, fish: L.fish.length, hidden: !!G.hidden, check: G.check, stars: G.stars }; },
    level: function (lv) { return makeLevel(lv); },
    load: function (lv) { hideCard(); P.best = Math.max(P.best, lv); loadLevel(lv); state = 'play'; },
    hold: function (b) { if (b) holdOn(); else holdOff(); },
    hop: hop,
    dogs: function () { return L.dogs.map(function (d) { return { x: d.x, face: d.face, z0: d.z0, z1: d.z1, st: d.st, left: d.dur - d.t }; }); },
    boards: function () { return L.boards.map(function (b) { return b.x; }); },
    tick: function (n, autoOn) { for (var i = 0; i < n; i++) { time += 1 / 60; if (autoOn) this.auto(); update(1 / 60); if (state !== 'play') break; } return this.state(); },
    // a careful autopilot for testing that levels can be done: walks only when every dog that can see the next
    // stretch is asleep with time to spare, hops the squeaky boards, and waits in hiding places
    auto: function () {
      if (state !== 'play' || G.mode !== 'play') return;
      var x = G.x;
      var b = L.boards.filter(function (q) { return q.x - x > 0 && q.x - x < q.w / 2 + 26; })[0];
      // how far to the next safe place (a hiding spot or floor no dog sees)
      var nextSafe = null;
      for (var px = x + 10; px < L.goal + 10; px += 10) { if (spotAt(px) || !L.dogs.some(function (d) { return inZone(d, px); }) || px >= L.goal) { nextSafe = px; break; } }
      var need = (nextSafe - x) / SPEED + 0.25;
      var ok = L.dogs.every(function (d) {
        var sees = d.z1 >= x - 5 && d.z0 <= nextSafe;
        if (!sees) return true;
        if (d.st === 'sleep') return d.dur - d.t + L.pl.warn > need;
        return false;
      });
      if (G.hidden || !L.dogs.some(function (d) { return inZone(d, x); })) { if (ok) { if (b && !G.hop && G.cool <= 0) { holdOff(); hop(); } else holdOn(); } else holdOff(); }
      else {
        // out in the open: keep going unless a dog that sees us is stirring
        var danger = L.dogs.some(function (d) { return inZone(d, x) && d.st !== 'sleep' && d.st !== 'settle'; });
        if (danger) holdOff(); else if (b && !G.hop && G.cool <= 0) { holdOff(); hop(); } else holdOn();
      }
    }
  };
})();
