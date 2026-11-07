/* Fish Maze – a maze chase for 5-10. Your cat runs round a garden hedge maze munching fish; playful puppies wander
   about. A puppy that catches the cat gives it a big lick: a heart is used up and everyone pops back to the start
   (three hearts; run out and the level starts again, with nothing lost). Catnip makes the puppies sleepy for a few
   seconds: they wander away slowly, and booping one sends it trotting home for a nap. Eat every fish to finish.
   Levels go round three mazes with more puppies, quicker puppies and shorter catnip naps.
   Drawn only with the shared kits: GGScene (lawn, hedge maze, rug), GGThings (fish, catnip, puppy faces), GGCat.
   Saves GG.setProgress('fishmaze', { best, cur }). */
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

  var P = (function () { var p = {}; try { p = GG.getProgress('fishmaze') || {}; } catch (e) {} if (typeof p.best !== 'number' || p.best < 1) p.best = 1; if (typeof p.cur !== 'number') p.cur = 1; return p; })();
  function save() { try { GG.setProgress('fishmaze', P); } catch (e) {} }

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

  /* ================= the mazes ('#' hedge, '.' fish, 'o' catnip, 'h' the puppies' garden bed, 'C' the cat) ================= */
  var MAZES = [
    ['###############', '#o...........o#', '#.###.#.#.###.#', '#.............#', '#.##.#####.##.#', '#....#hhh#....#', '###.##hhh##.###',
     '#.............#', '#.##.#.#.#.##.#', '#....#...#....#', '##.#...#...#.##', '#o.#.#####.#.o#', '#......C......#', '#..##.....##..#', '###############'],
    ['###############', '#o...........o#', '#.##.##.##.##.#', '#.#.........#.#', '#.#.##.#.##.#.#', '#......#......#', '#.###.hhh.###.#',
     '#.#...hhh...#.#', '#.#.#######.#.#', '#.............#', '#.##.#.#.#.##.#', '#o...#.C.#...o#', '#.####.#.####.#', '#.............#', '###############'],
    ['###############', '#o...........o#', '#.#.#.###.#.#.#', '#.#.#.....#.#.#', '#...#.#.#.#...#', '###.#.#.#.#.###', '#.....hhh.....#',
     '#.#.#.hhh.#.#.#', '#.#.#######.#.#', '#.............#', '##.#...#...#.##', '#o.#.#####.#.o#', '#......C......#', '#.............#', '###############']
  ];
  var N = 15;
  var PUPS = [
    { body: '#C98B5B', dark: '#9A6440', ear: '#7E4E30' }, { body: '#EBD7B0', dark: '#CDB281', ear: '#B8925E' },
    { body: '#9C97AE', dark: '#77728C', ear: '#5C5874' }, { body: '#FFFFFF', dark: '#DCD6E6', ear: '#4A4262', spots: true }
  ];
  function plan(lv) {
    return {
      maze: (lv - 1) % MAZES.length,
      pups: Math.min(2 + Math.floor((lv - 1) / 2), 4),
      speed: Math.min(0.62 + lv * 0.04, 0.95),     // puppies' speed, as a share of the cat's
      chase: Math.min(0.25 + lv * 0.06, 0.7),      // how often a puppy heads your way at a junction
      nap: Math.max(8 - lv * 0.4, 4.5)             // how long catnip keeps them sleepy (seconds)
    };
  }

  /* ================= state ================= */
  var L = null, G = null, state = 'card';
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var CAT_SPEED = 4.4;   // cells a second
  function open(gx, gy) { return gx >= 0 && gy >= 0 && gx < N && gy < N && L.grid[gy].charAt(gx) !== '#'; }
  function loadLevel(lv) {
    lv = clamp(lv, 1, P.best); P.cur = lv; save();
    var pl = plan(lv), grid = MAZES[pl.maze], fish = {}, nip = {}, home = [], start = null;
    grid.forEach(function (row, y) { for (var x = 0; x < N; x++) { var ch = row.charAt(x); if (ch === '.') fish[x + ',' + y] = 1; if (ch === 'o') nip[x + ',' + y] = 1; if (ch === 'h') home.push([x, y]); if (ch === 'C') start = [x, y]; } });
    L = { lv: lv, pl: pl, grid: grid, fish: fish, nip: nip, home: home, start: start, total: Object.keys(fish).length };
    G = { hearts: 3, left: L.total, sleepy: 0, freeze: 0, parts: [], pops: [], t: 0, munch: 0, caught: null, done: false };
    resetPositions(true);
    $('levelLabel').textContent = 'Level ' + lv;
    renderHud();
    track('Start level', { game: 'fishmaze', level: lv });
  }
  function resetPositions(first) {
    G.cat = { x: L.start[0], y: L.start[1], tx: L.start[0], ty: L.start[1], dir: [0, 0], want: [0, 0], face: 1 };
    G.pups = [];
    for (var i = 0; i < L.pl.pups; i++) {
      var h = L.home[(i * 2 + 1) % L.home.length];
      G.pups.push({ x: h[0], y: h[1], tx: h[0], ty: h[1], dir: [0, -1], col: PUPS[i % PUPS.length], wait: (first ? 2.2 : 1.2) + i * 2.2, napT: 0 });
    }
    G.sleepy = 0;
  }

  /* ================= input ================= */
  function steer(name) { Sound.init(); if (state !== 'play') return; var d = DIRS[name]; G.cat.want = [d[0], d[1]]; }
  var pad = $('pad');
  pad.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); b.classList.add('on'); steer(b.dataset.d); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { b.addEventListener(t, function () { b.classList.remove('on'); }); });
  });
  window.addEventListener('keydown', function (e) {
    var k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
    if (k) { e.preventDefault(); steer(k); }
    else if ((e.key === ' ' || e.key === 'Enter') && !$('cardWrap').hidden) { e.preventDefault(); $('goBtn').click(); }
  });
  // a swipe on the maze (or a tap to one side of the cat) steers too
  var canvas = $('stage'), sw = null;
  canvas.addEventListener('pointerdown', function (e) { Sound.init(); sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  canvas.addEventListener('pointermove', function (e) {
    if (!sw || sw.id !== e.pointerId) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    sw = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  canvas.addEventListener('pointerup', function (e) {
    if (sw && Math.hypot(e.clientX - sw.x, e.clientY - sw.y) < 10 && state === 'play') {
      var cx = BX + (G.cat.x + 0.5) * CS, cy = BY + (G.cat.y + 0.5) * CS, dx = e.clientX - cx, dy = e.clientY - cy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > CS * 0.6) steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }
    sw = null;
  });
  $('goBtn').addEventListener('click', function () {
    Sound.init(); Sound.click(); $('cardWrap').hidden = true;
    if (cardMode === 'won') loadLevel(L.lv + 1); else if (cardMode === 'lost') loadLevel(L.lv);
    state = 'play'; say(L.lv === 1 ? 'Munch all the fish!' : 'Level ' + L.lv + (L.pl.pups > plan(L.lv - 1).pups ? ': one more puppy!' : ''), 1.8);
  });

  /* ================= moving round the maze ================= */
  /* one walker (cat or puppy) heads for the middle of its next cell; there it picks where to go next */
  function step(w, speed, dt, choose) {
    var left = speed * dt;
    for (var guard = 0; guard < 4 && left > 0; guard++) {
      var dx = w.tx - w.x, dy = w.ty - w.y, d = Math.abs(dx) + Math.abs(dy);
      if (d > 1e-6) {
        var m = Math.min(d, left); w.x += Math.sign(dx) * m; w.y += Math.sign(dy) * m; left -= m;
        if (d - m > 1e-6) return;
      }
      w.x = w.tx; w.y = w.ty;
      var nd = choose(w);
      if (!nd) { w.dir = [0, 0]; return; }
      w.dir = nd; w.tx = w.x + nd[0]; w.ty = w.y + nd[1];
    }
  }
  function catChoose(w) {
    if ((w.want[0] || w.want[1]) && open(w.x + w.want[0], w.y + w.want[1])) return w.want.slice();
    if ((w.dir[0] || w.dir[1]) && open(w.x + w.dir[0], w.y + w.dir[1])) return w.dir;
    return null;
  }
  function pupChoose(p) {
    var opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) { return open(p.x + d[0], p.y + d[1]); });
    if (opts.length > 1) opts = opts.filter(function (d) { return !(d[0] === -p.dir[0] && d[1] === -p.dir[1]); });
    if (!opts.length) return null;
    var cat = G.cat, far = function (d) { return Math.abs(p.x + d[0] - cat.x) + Math.abs(p.y + d[1] - cat.y); };
    if (G.sleepy > 0) return opts.sort(function (a, b) { return far(b) - far(a); })[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * opts.length)];
    if (Math.random() < L.pl.chase) return opts.sort(function (a, b) { return far(a) - far(b); })[0];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  function update(dt) {
    if (!L) return;
    G.t += dt;
    sayT -= dt; if (sayT <= 0 && !$('say').classList.contains('hide')) $('say').classList.add('hide');
    for (var i = G.parts.length - 1; i >= 0; i--) { var q = G.parts[i]; q.life += dt; if (q.life > q.max) { G.parts.splice(i, 1); continue; } q.vy += 300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    for (var j = G.pops.length - 1; j >= 0; j--) { G.pops[j].t += dt; if (G.pops[j].t > 1) G.pops.splice(j, 1); }
    if (state !== 'play') return;
    if (G.freeze > 0) { G.freeze -= dt; if (G.freeze <= 0) afterCatch(); return; }
    // the cat: reverse straight away, otherwise turn at the next middle of a cell
    var c = G.cat;
    if ((c.want[0] || c.want[1]) && c.want[0] === -c.dir[0] && c.want[1] === -c.dir[1]) { var ox = c.tx, oy = c.ty; c.tx = ox - c.dir[0]; c.ty = oy - c.dir[1]; c.dir = c.want.slice(); }
    step(c, CAT_SPEED, dt, catChoose);
    if (c.dir[0]) c.face = c.dir[0];
    G.munch = c.dir[0] || c.dir[1] ? G.munch + dt : 0;
    // eat what's under the cat
    var gx = Math.round(c.x), gy = Math.round(c.y), key = gx + ',' + gy;
    if (Math.abs(c.x - gx) < 0.3 && Math.abs(c.y - gy) < 0.3) {
      if (L.fish[key]) { delete L.fish[key]; G.left--; Sound.munch(); renderHud(); if (Math.random() < 0.3) sparkle(gx, gy, '#BFE6FF', 3); if (!G.left) return win(); }
      if (L.nip[key]) { delete L.nip[key]; G.sleepy = L.pl.nap; Sound.nip(); buzz(15); sparkle(gx, gy, '#C4FFB0', 10); say('Catnip! The puppies are sleepy: boop them!', 1.8); }
    }
    G.sleepy = Math.max(0, G.sleepy - dt);
    // the puppies
    G.pups.forEach(function (p) {
      if (p.wait > 0) { p.wait -= dt; return; }
      if (p.napT > 0) { p.napT -= dt; return; }
      step(p, CAT_SPEED * L.pl.speed * (G.sleepy > 0 ? 0.55 : 1), dt, pupChoose);
      if (Math.hypot(p.x - c.x, p.y - c.y) < 0.62) {
        if (G.sleepy > 0) boop(p); else if (!G.freeze) caught(p);
      }
    });
  }
  function boop(p) {
    Sound.boop(); buzz(12);
    sparkle(p.x, p.y, '#FFD23F', 8);
    G.pops.push({ x: p.x, y: p.y, t: 0, txt: 'Boop!' });
    var h = L.home[Math.floor(Math.random() * L.home.length)];
    p.x = p.tx = h[0]; p.y = p.ty = h[1]; p.dir = [0, -1]; p.napT = 3.5;
  }
  function caught(p) {
    G.freeze = 1.3; G.caught = p; G.hearts--; renderHud();
    Sound.lick(); buzz([30, 40, 30]);
    for (var i = 0; i < 6; i++) G.parts.push({ x: (G.cat.x + 0.5) * CS, y: (G.cat.y + 0.2) * CS, vx: rand(-80, 80), vy: rand(-180, -80), life: 0, max: 0.9, r: rand(6, 10), col: '#FF8FAB', kind: 'heart' });
    say(G.hearts > 0 ? 'A big puppy lick! Back to the start.' : 'Puppy party!', 1.6);
  }
  function afterCatch() {
    G.caught = null;
    if (G.hearts <= 0) { state = 'card'; Sound.aww(); track('Lose level', { game: 'fishmaze', level: L.lv }); showCard('lost'); return; }
    resetPositions(false);
  }
  function win() {
    state = 'won'; G.done = true;
    if (L.lv >= P.best) P.best = L.lv + 1;
    save(); Sound.win(); buzz(25);
    for (var i = 0; i < 18; i++) G.parts.push({ x: (G.cat.x + 0.5) * CS, y: (G.cat.y + 0.5) * CS, vx: rand(-180, 180), vy: rand(-300, -80), life: 0, max: 1, r: rand(5, 9), col: ['#FFD23F', '#FF8FAB', '#7CC4FF'][i % 3], kind: 'star' });
    track('Finish level', { game: 'fishmaze', level: L.lv, hearts: G.hearts });
    if (GG.stat) GG.stat('fishmaze', 'levels', 1);
    var me = G; setTimeout(function () { if (G === me) showCard('won'); }, 1100);
  }
  function sparkle(gx, gy, col, n) { for (var i = 0; i < (reduceMotion ? 2 : n); i++) { var a = rand(0, TAU), sp = rand(60, 160); G.parts.push({ x: (gx + 0.5) * CS, y: (gy + 0.5) * CS, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.55, r: rand(4, 7), col: col, kind: 'star' }); } }

  /* ================= hud, cards ================= */
  var HEART = '<svg viewBox="0 0 32 32"><path d="M16 27 C4 18 4 9 10 7 C13 6 15 8 16 10 C17 8 19 6 22 7 C28 9 28 18 16 27 Z" fill="#FF7EA8" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/></svg>';
  function renderHud() {
    $('fishLeft').textContent = G.left;
    var h = ''; for (var i = 0; i < 3; i++) h += HEART.replace('<svg', '<svg class="' + (i < G.hearts ? '' : 'gone') + '"'); $('hearts').innerHTML = h;
  }
  var sayT = 0;
  function say(t, s) { var el = $('say'); el.textContent = t; el.classList.remove('hide'); sayT = s || 2; }
  var cardMode = 'intro';
  function showCard(mode) {
    cardMode = mode;
    if (mode === 'won') { $('cardTitle').textContent = 'Yum, every fish!'; $('cardNote').textContent = 'Level ' + L.lv + ' done' + (G.hearts === 3 ? ' without a single lick!' : '.'); $('cardTip').textContent = plan(L.lv + 1).pups > L.pl.pups ? 'Next level: one more puppy!' : 'Next level: the puppies are a little quicker.'; $('goBtn').textContent = 'Level ' + (L.lv + 1); }
    else if (mode === 'lost') { $('cardTitle').textContent = 'Puppy party!'; $('cardNote').textContent = 'The puppies just wanted to play. Have another go?'; $('cardTip').textContent = 'Tip: save the catnip for when a puppy is close by.'; $('goBtn').textContent = 'Try again'; }
    else { $('cardTitle').textContent = 'Fish Maze'; $('cardNote').textContent = 'Munch every fish in the maze! Watch out for the playful puppies.'; $('cardTip').textContent = 'Steer with the arrows (or swipe). Eat the catnip and the puppies get sleepy: boop them home for a nap!'; $('goBtn').textContent = P.cur > 1 ? 'Play level ' + L.lv : 'Let’s go!'; }
    drawCardPic(mode);
    $('cardWrap').hidden = false;
  }

  /* ================= drawing ================= */
  var ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, CS = 30, BX = 0, BY = 0, bg = null;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = $('topbar').getBoundingClientRect().bottom + 6, pr = pad.getBoundingClientRect(), side = getComputedStyle(pad).right !== 'auto' && pr.left > cw * 0.6;
    var bottom = side ? ch - 12 : pr.top - 10, right = side ? pr.left - 12 : cw - 8;
    CS = Math.floor(Math.min((right - 8) / N, (bottom - top) / N));
    BX = Math.round(side ? Math.max(8, (right - CS * N) / 2) : (cw - CS * N) / 2); BY = Math.round(top + Math.max(0, (bottom - top - CS * N) / 2));
    $('say').style.top = (BY + 10) + 'px';
    bg = null;
  }
  function background() {
    // the lawn and the hedges never change in a level, so they're drawn once
    if (bg && bg.lv === L.lv && bg.cs === CS) return bg.cv;
    var cv = document.createElement('canvas'); cv.width = Math.round(CS * N * dpr); cv.height = cv.width;
    var c = cv.getContext('2d'); c.scale(dpr, dpr); c.lineJoin = 'round'; c.lineCap = 'round';
    S.lawn(c, 0, 0, CS * N, CS * N, { stripe: CS * 1.5, seed: L.lv });
    // the puppies' garden bed in the middle
    var hx = 0, hy = 0; L.home.forEach(function (h) { hx += h[0]; hy += h[1]; }); hx /= L.home.length; hy /= L.home.length;
    S.rug(c, (hx + 0.5) * CS, (hy + 0.5) * CS, CS * 1.7, CS * 1.15, { kind: 'stitch', col: '#FFD3E4', col2: '#FF8FAB' });
    S.maze(c, L.grid, 0, 0, CS, { col: '#5CCB75', seed: L.lv });
    bg = { lv: L.lv, cs: CS, cv: cv };
    return cv;
  }
  function px(x) { return BX + (x + 0.5) * CS; }
  function py(y) { return BY + (y + 0.5) * CS; }
  function draw(c) {
    c.fillStyle = '#CDEBC0'; c.fillRect(0, 0, cw, ch);
    if (!L) return;
    c.save(); D.rr(c, BX - 4, BY - 4, CS * N + 8, CS * N + 8, 16); c.clip();
    c.drawImage(background(), BX, BY, CS * N, CS * N);
    // fish and catnip
    var fs = CS / 34 * 0.62;
    for (var k in L.fish) { var p = k.split(','); T.fish(c, px(+p[0]), py(+p[1]), { size: fs }); }
    for (var n in L.nip) { var q = n.split(','), b = reduceMotion ? 1 : 1 + Math.sin(G.t * 4) * 0.08; T.catnip(c, px(+q[0]), py(+q[1]), { size: CS / 40 * 0.95 * b, glow: 0.6 + 0.4 * Math.sin(G.t * 3) }); }
    // puppies
    G.pups.forEach(function (pp, i) {
      var sleepy = G.sleepy > 0 || pp.napT > 0, s = CS / 70 * 0.98, bob = reduceMotion || pp.wait > 0 || pp.napT > 0 ? 0 : Math.abs(Math.sin(G.t * 9 + i)) * CS * 0.05;
      var flash = G.sleepy > 0 && G.sleepy < 1.5 && Math.sin(G.t * 18) > 0;   // waking up soon
      c.save(); if (sleepy && !flash) c.globalAlpha = 0.85;
      T.dog(c, px(pp.x), py(pp.y) - bob, { view: 'face', size: s, col: pp.col, eyes: pp.napT > 0 ? 'closed' : sleepy && !flash ? 'peek' : 'open', tongue: G.caught === pp ? 1 : 0, flop: Math.sin(G.t * 8 + i) * 0.1 });
      c.restore();
      if (sleepy) { c.save(); c.font = '800 ' + Math.round(CS * 0.4) + 'px "Baloo 2", sans-serif'; c.fillStyle = '#7A6F8E'; var zt = (G.t * 0.7 + i * 0.3) % 1; c.globalAlpha = 1 - zt; c.fillText('z', px(pp.x) + CS * 0.3, py(pp.y) - CS * 0.4 - zt * CS * 0.4); c.restore(); }
    });
    // the cat: its head, munching as it goes
    var cat = G.cat, o = {}; for (var kk in CAT) o[kk] = CAT[kk];
    var chomp = G.munch > 0 && Math.floor(G.munch * 7) % 2 === 0;
    o.pose = 'head'; o.size = CS * 0.98; o.face = G.caught ? 'happy' : G.done ? 'happy' : chomp ? 'surprised' : 'open';
    c.save(); c.translate(px(cat.x), py(cat.y) + CS * 0.02);
    if (!reduceMotion && (cat.dir[0] || cat.dir[1])) c.rotate(Math.sin(G.munch * 14) * 0.06);
    c.translate(0, -o.size * 6 / 88);
    try { GGCat.draw(c, o); } catch (e) {}
    c.restore();
    c.restore();
    D.rr(c, BX - 4, BY - 4, CS * N + 8, CS * N + 8, 16); D.ink(c, 4);
    G.parts.forEach(function (q) {
      var k2 = 1 - q.life / q.max; c.save(); c.globalAlpha = k2; c.translate(BX + q.x, BY + q.y);
      if (q.kind === 'heart') { c.beginPath(); c.moveTo(0, q.r * 0.8); c.bezierCurveTo(-q.r * 1.3, -q.r * 0.1, -q.r * 0.6, -q.r * 1.1, 0, -q.r * 0.4); c.bezierCurveTo(q.r * 0.6, -q.r * 1.1, q.r * 1.3, -q.r * 0.1, 0, q.r * 0.8); c.closePath(); c.fillStyle = q.col; c.fill(); D.ink(c, 2); }
      else { T.star(c, q.r); c.fillStyle = q.col; c.fill(); D.ink(c, 1.5); }
      c.restore();
    });
    G.pops.forEach(function (q) { c.save(); c.globalAlpha = 1 - q.t; c.font = '800 ' + Math.round(CS * 0.55) + 'px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = INK; var x = px(q.x), y = py(q.y) - CS * 0.6 - q.t * CS * 0.6; c.strokeText(q.txt, x, y); c.fillStyle = '#FFD23F'; c.fillText(q.txt, x, y); c.restore(); });
  }
  function drawCardPic(mode) {
    var c = $('cardPic').getContext('2d'), cs = 44;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 440, 300);
    c.save(); D.rr(c, 6, 6, 428, 288, 26); c.clip();
    S.lawn(c, 0, 0, 440, 300, { stripe: 60 });
    S.maze(c, ['##########', '#........#', '#.####.#.#', '#......#.#', '##########'], 0, 40, cs, {});
    for (var x = 2; x < 6; x++) T.fish(c, (x + 0.5) * cs, 40 + 3.5 * cs, { size: 0.6 });
    T.catnip(c, 7.5 * cs, 40 + 1.5 * cs, { size: 1, glow: 1 });
    var o = {}; for (var k in CAT) o[k] = CAT[k]; o.pose = 'head'; o.size = 56; o.face = mode === 'lost' ? 'happy' : 'surprised';
    c.save(); c.translate(1.5 * cs, 40 + 3.5 * cs - 4); try { GGCat.draw(c, o); } catch (e) {} c.restore();
    T.dog(c, 8.5 * cs, 40 + 3.5 * cs, { view: 'face', size: 0.7, col: PUPS[1], tongue: mode === 'lost' ? 1 : 0 });
    T.dog(c, 4.5 * cs, 40 + 1.5 * cs, { view: 'face', size: 0.7, col: PUPS[0], eyes: mode === 'won' ? 'closed' : 'open' });
    c.restore();
    D.rr(c, 6, 6, 428, 288, 26); D.ink(c, 5);
  }

  /* ================= sound ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null, on = GG.getSetting('sound', true), lastM = 0, flip = 0;
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
      munch: function () { if (!ac || ac.currentTime - lastM < 0.07) return; lastM = ac.currentTime; flip = 1 - flip; tone({ f: flip ? 520 : 660, dur: 0.05, gain: 0.05, type: 'triangle' }); },
      nip: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone({ f: f, dur: 0.12, gain: 0.06, delay: i * 0.05, type: 'triangle' }); }); },
      boop: function () { tone({ f: 300, to: 700, dur: 0.14, gain: 0.1, type: 'triangle', slide: 0.1 }); },
      lick: function () { noise({ type: 'bandpass', freq: 1800, q: 1.2, attack: 0.03, dur: 0.25, gain: 0.08 }); tone({ f: 500, to: 300, dur: 0.25, gain: 0.05, type: 'triangle' }); },
      aww: function () { [520, 440, 360].forEach(function (f, i) { tone({ f: f, dur: 0.22, gain: 0.07, delay: i * 0.15, type: 'triangle' }); }); },
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
    if (!paused) update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    draw(ctx);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', function () { paused = document.hidden; last = performance.now(); });
  layout();
  loadLevel(P.cur || 1);
  showCard('intro');
  requestAnimationFrame(frame);

  /* test hooks */
  window.__fm = {
    state: function () { return { state: state, lv: L.lv, left: G.left, hearts: G.hearts, cat: [G.cat.x, G.cat.y], pups: G.pups.map(function (p) { return [p.x, p.y]; }), sleepy: G.sleepy }; },
    load: function (lv) { $('cardWrap').hidden = true; P.best = Math.max(P.best, lv); loadLevel(lv); state = 'play'; },
    steer: steer,
    tick: function (n, autoOn) { for (var i = 0; i < n; i++) { if (autoOn) this.auto(); update(1 / 60); if (state !== 'play') break; } return this.state(); },
    // a simple player for tests: heads for the nearest fish, away from awake puppies that are close
    auto: function () {
      var c = G.cat; if (state !== 'play' || G.freeze > 0) return;
      if (Math.abs(c.x - Math.round(c.x)) > 0.05 || Math.abs(c.y - Math.round(c.y)) > 0.05) return;
      var sx = Math.round(c.x), sy = Math.round(c.y), prev = {}, q = [[sx, sy]], goal = null; prev[sx + ',' + sy] = null;
      var danger = function (x, y) { return G.sleepy <= 0 && G.pups.some(function (p) { return p.wait <= 0 && p.napT <= 0 && Math.abs(p.x - x) + Math.abs(p.y - y) < 2.2; }); };
      while (q.length && !goal) { var cur = q.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = cur[0] + d[0], ny = cur[1] + d[1], k = nx + ',' + ny; if (goal || !open(nx, ny) || k in prev || danger(nx, ny)) return; prev[k] = cur; if (L.fish[k] || L.nip[k]) goal = [nx, ny]; q.push([nx, ny]); }); }
      if (!goal) return;
      var at = goal; while (prev[at[0] + ',' + at[1]] && (prev[at[0] + ',' + at[1]][0] !== sx || prev[at[0] + ',' + at[1]][1] !== sy)) at = prev[at[0] + ',' + at[1]];
      c.want = [at[0] - sx, at[1] - sy];
    }
  };
})();
