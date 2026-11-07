/* Yarn Defence – a gentle tower-defence for older kids (10+). Mice come out of their hole and run along the path
   to your basket of yarn. Put cats on the floor beside the path to send them home: nobody gets hurt, a mouse that's
   been batted enough just tumbles back to its hole, a bit dizzy. Cats cost fish; every mouse sent home earns fish,
   and so does each new wave.
     Swatter: bats one mouse at a time, quick.        Pouncer: pounces on a bunch of mice at once, slower.
     Napper: mice near it get sleepy and slow down.     Yarn tosser: throws yarn balls a long way.
   Tap a cat you've placed to make it better (up to three times) or send it home (most of its fish back).
   Each mouse that reaches the basket takes a ball of yarn (a big one takes three). Three stars for keeping all your
   yarn. Levels use six floor plans, with more waves, quicker and tougher mice as they go on.
   Saves GG.setProgress('yarndefence', { best, cur, stars: { level: n } }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function track(n, d) { if (window.GG && GG.track) GG.track(n, d); }

  var P = (function () {
    var p = {}; try { p = GG.getProgress('yarndefence') || {}; } catch (e) {}
    if (typeof p.best !== 'number' || p.best < 1) p.best = 1;
    if (typeof p.cur !== 'number') p.cur = 1;
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    return p;
  })();
  function save() { try { GG.setProgress('yarndefence', P); } catch (e) {} }

  /* ================= your cat (the swatter) ================= */
  var MINE = { preset: 'ginger' };
  function catSetup() {
    var p = null; try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) { MINE = { preset: 'ginger' }; return; }
    var av = GGAvatar.normalise(p.avatar, p.color);
    MINE = { color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none' };
    TYPES.swat.look = MINE;
    if (window.__ydTray) renderTray();
  }

  /* ================= the cats ================= */
  var TYPES = {
    swat: { name: 'Swatter', blurb: 'Bats one mouse at a time', cost: 20, up: [25, 40], range: [1.6, 1.75, 1.95], rate: [0.7, 0.55, 0.42], dmg: [1, 1.5, 2.2], unlock: 1, look: MINE, cushion: '#FFD23F' },
    pounce: { name: 'Pouncer', blurb: 'Pounces on a bunch of mice', cost: 35, up: [40, 60], range: [1.8, 1.95, 2.15], rate: [1.8, 1.6, 1.35], dmg: [2, 3, 4.2], splash: [0.85, 0.95, 1.15], unlock: 2, look: { color: '#8F8AA0', markings: 'tabby' }, cushion: '#7CC4FF' },
    nap: { name: 'Napper', blurb: 'Mice nearby get sleepy and slow', cost: 30, up: [30, 45], range: [1.5, 1.85, 2.25], slow: [0.42, 0.55, 0.66], unlock: 3, look: { color: '#F1E3CB', build: 'fluffy' }, cushion: '#B48CFF' },
    toss: { name: 'Tosser', blurb: 'Throws yarn balls a long way', cost: 45, up: [45, 70], range: [3, 3.4, 3.9], rate: [1.25, 1.05, 0.85], dmg: [1.6, 2.4, 3.3], unlock: 5, look: { color: '#3D3650', markings: 'tuxedo' }, cushion: '#7BD389' }
  };
  var ORDER = ['swat', 'pounce', 'nap', 'toss'];
  catSetup(); window.addEventListener('gg-change', catSetup);

  /* ================= the mice ================= */
  var MICE = {
    grey: { hp: 3, speed: 1.0, fish: 3, col: '#B8B3C9', size: 1 },
    quick: { hp: 2, speed: 1.75, fish: 3, col: '#D2AE86', size: 0.82 },
    chunky: { hp: 10, speed: 0.66, fish: 7, col: '#9C97AE', size: 1.3 },
    big: { hp: 42, speed: 0.48, fish: 25, col: '#8A85A0', size: 1.75 }
  };

  /* ================= the floor plans =================
     Corners of the path on a 12 x 8 floor (x, y), from the mouse hole to the basket. On an upright screen the plan
     is turned on its side (8 x 12). */
  var MAPS = [
    [[0, 1], [3, 1], [3, 6], [7, 6], [7, 2], [10, 2], [10, 6], [11, 6]],
    [[0, 6], [2, 6], [2, 1], [5, 1], [5, 5], [8, 5], [8, 1], [11, 1]],
    [[0, 2], [9, 2], [9, 5], [2, 5], [2, 7]],
    [[0, 4], [2, 4], [2, 1], [6, 1], [6, 6], [9, 6], [9, 3], [11, 3]],
    [[0, 6], [10, 6], [10, 4], [1, 4], [1, 1], [11, 1]],
    [[0, 0], [10, 0], [10, 6], [2, 6], [2, 2], [7, 2], [7, 4], [5, 4]]
  ];
  function plan(lv) {
    var waves = Math.min(5 + Math.floor((lv - 1) / 2), 10);
    return { map: (lv - 1) % MAPS.length, waves: waves, fish: 60 + Math.min(lv, 25) * 8, yarn: 10 };
  }
  function waveList(lv, w, W) {
    var n = 4 + w * 2 + Math.floor(lv * 0.4), out = [];
    var gap = Math.max(0.42, 1.05 - lv * 0.025 - w * 0.03);
    var hpk = (1 + (lv - 1) * 0.09) * (1 + w * 0.08);
    for (var i = 0; i < n; i++) {
      var t = 'grey';
      if (lv >= 2 && w >= 1 && i % 3 === 2) t = 'quick';
      if (lv >= 4 && w >= 2 && i % 5 === 4) t = 'chunky';
      out.push({ type: t, at: i * gap * (t === 'chunky' ? 1.3 : 1), hpk: hpk });
    }
    if (w === W - 1 && lv >= 3) out.push({ type: 'big', at: n * gap + 1.2, hpk: lv === 3 ? hpk * 0.6 : hpk });
    // later waves: a quick rush in the middle
    if (lv >= 6 && w >= 3) for (var j = 0; j < 3; j++) out.push({ type: 'quick', at: n * gap * 0.5 + j * 0.25, hpk: hpk });
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }

  /* ================= the level ================= */
  var L = null, G = null, COLS = 12, ROWS = 8, portrait = false;
  function buildPath(lv) {
    var pts = MAPS[plan(lv).map].map(function (q) { return portrait ? [q[1], q[0]] : [q[0], q[1]]; });
    var cells = {}, poly = [];
    for (var i = 0; i < pts.length; i++) {
      poly.push({ x: pts[i][0] + 0.5, y: pts[i][1] + 0.5 });
      if (i) {
        var a = pts[i - 1], b = pts[i], dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]), x = a[0], y = a[1];
        cells[x + ',' + y] = 1;
        while (x !== b[0] || y !== b[1]) { x += dx; y += dy; cells[x + ',' + y] = 1; }
      }
    }
    var d0x = Math.sign(pts[1][0] - pts[0][0]), d0y = Math.sign(pts[1][1] - pts[0][1]);
    poly.unshift({ x: poly[0].x - d0x * 1.1, y: poly[0].y - d0y * 1.1 });
    var segs = [], total = 0;
    for (var j = 1; j < poly.length; j++) { var l = Math.hypot(poly[j].x - poly[j - 1].x, poly[j].y - poly[j - 1].y); segs.push({ a: poly[j - 1], b: poly[j], s0: total, len: l }); total += l; }
    return { cells: cells, poly: poly, segs: segs, total: total, hole: { x: poly[1].x - d0x * 0.5, y: poly[1].y - d0y * 0.5, dx: d0x, dy: d0y }, basket: poly[poly.length - 1] };
  }
  function posAt(s) {
    var segs = L.path.segs;
    for (var i = 0; i < segs.length; i++) {
      var g = segs[i];
      if (s <= g.s0 + g.len || i === segs.length - 1) { var t = clamp((s - g.s0) / g.len, 0, 1); return { x: g.a.x + (g.b.x - g.a.x) * t, y: g.a.y + (g.b.y - g.a.y) * t, dx: (g.b.x - g.a.x) / g.len, dy: (g.b.y - g.a.y) / g.len }; }
    }
    return { x: 0, y: 0, dx: 1, dy: 0 };
  }
  function loadLevel(lv) {
    lv = clamp(lv, 1, P.best);
    P.cur = lv; save();
    var pl = plan(lv);
    L = { lv: lv, pl: pl, path: buildPath(lv) };
    G = { fish: pl.fish, yarn: pl.yarn, wave: 0, queue: [], waveT: 0, next: -1, started: false, mice: [], cats: {}, shots: [], fx: [], gone: [], over: null, sel: null, type: null, lost: 0, spent: 0, id: 0, t: 0 };
    $('levelLabel').textContent = 'Level ' + lv;
    $('prevBtn').disabled = lv <= 1; $('nextBtn').disabled = lv >= P.best;
    G.type = 'swat';
    renderTray(); renderHud();
    track('Start level', { game: 'yarn-defence', level: lv });
  }
  function relayoutPath() { if (!L) return; var keep = G.cats, was = portrait; L.path = buildPath(L.lv); void keep; void was; }

  /* ================= waves ================= */
  function sendWave() {
    if (G.over || G.wave >= L.pl.waves) return;
    var w = G.wave;
    if (w > 0) { var bonus = 6 + 2 * w + (G.next > 0 ? Math.ceil(G.next) : 0); G.fish += bonus; pop(L.path.hole.x, L.path.hole.y - 0.4, '+' + bonus); }
    G.started = true;
    var list = waveList(L.lv, w, L.pl.waves);
    list.forEach(function (q) { G.queue.push({ type: q.type, at: G.t + q.at + 0.3, hpk: q.hpk }); });
    G.wave++; G.next = -1;
    Sound.wave();
    if (w === L.pl.waves - 1) say(L.lv >= 3 ? 'Last wave… and here comes a big one!' : 'Last wave!', 2.2);
    renderHud();
  }
  function spawn(q) {
    var m = MICE[q.type];
    var hp = Math.round(m.hp * q.hpk * 10) / 10;
    G.mice.push({ id: ++G.id, type: q.type, hp: hp, max: hp, s: 0, speed: m.speed * (1 + Math.min(L.lv, 20) * 0.012), slowT: 0, hitT: 0, step: rand(0, 6) });
  }

  /* ================= playing ================= */
  var speed = 1;
  function update(dt) {
    if (!L) return;
    sayT -= dt; if (sayT <= 0 && !$('say').classList.contains('hide')) $('say').classList.add('hide');
    updateFx(dt);
    if (G.over || !G.started) return;
    G.t += dt;
    // spawn
    while (G.queue.length && G.queue[0].at <= G.t) spawn(G.queue.shift());
    // the next wave comes by itself after a short break (or sooner if you send it)
    if (!G.queue.length && G.wave < L.pl.waves) {
      if (G.next < 0) G.next = G.mice.length ? 9 : 6;
      G.next -= dt;
      if (G.next <= 0) { G.next = 0; sendWave(); }
    }
    // mice move (sleepy near a napper)
    var naps = [];
    for (var k in G.cats) if (G.cats[k].type === 'nap') naps.push(G.cats[k]);
    for (var i = G.mice.length - 1; i >= 0; i--) {
      var mo = G.mice[i], p = posAt(mo.s), slow = 0;
      naps.forEach(function (c) { var T = TYPES.nap; if (Math.hypot(c.x + 0.5 - p.x, c.y + 0.5 - p.y) <= T.range[c.lvl]) slow = Math.max(slow, T.slow[c.lvl]); });
      if (mo.slowT > 0) { mo.slowT -= dt; slow = Math.max(slow, 0.4); }
      mo.sleepy = slow > 0;
      mo.s += mo.speed * (1 - slow) * dt; mo.step += dt * mo.speed * (1 - slow) * 9;
      mo.hitT = Math.max(0, mo.hitT - dt);
      if (mo.s >= L.path.total) { G.mice.splice(i, 1); steal(mo); if (G.over) return; }
    }
    // cats act
    for (var key in G.cats) actCat(G.cats[key], dt);
    // yarn balls in the air
    for (var j = G.shots.length - 1; j >= 0; j--) {
      var sh = G.shots[j], tgt = G.mice.filter(function (m) { return m.id === sh.target; })[0];
      if (tgt) { var tp = posAt(tgt.s); sh.tx = tp.x; sh.ty = tp.y; }
      var dx = sh.tx - sh.x, dy = sh.ty - sh.y, dd = Math.hypot(dx, dy), stepD = 7 * dt;
      sh.spin += dt * 12;
      if (dd <= stepD + 0.05) {
        G.shots.splice(j, 1);
        if (tgt) { hit(tgt, sh.dmg, 'toss'); if (sh.tangle) tgt.slowT = 1.2; }
        continue;
      }
      sh.x += dx / dd * stepD; sh.y += dy / dd * stepD;
    }
    // done?
    if (G.wave >= L.pl.waves && !G.queue.length && !G.mice.length) win();
  }
  function inRange(c, r) {
    // mice in range, furthest along the path first
    var cx = c.x + 0.5, cy = c.y + 0.5, out = [];
    G.mice.forEach(function (m) { var p = posAt(m.s); if (m.s > 0.6 && Math.hypot(p.x - cx, p.y - cy) <= r) out.push(m); });
    return out.sort(function (a, b) { return b.s - a.s; });
  }
  function actCat(c, dt) {
    var T = TYPES[c.type];
    c.anim = Math.max(0, c.anim - dt); c.cd -= dt;
    if (c.type === 'nap') return;
    if (c.cd > 0) return;
    var list = inRange(c, T.range[c.lvl]);
    if (!list.length) return;
    var m = list[0], p = posAt(m.s);
    c.cd = T.rate[c.lvl]; c.face = p.x < c.x + 0.5 ? -1 : 1; c.tx = p.x; c.ty = p.y;
    if (c.type === 'swat') { c.anim = 0.25; hit(m, T.dmg[c.lvl], 'swat'); Sound.pap(); }
    else if (c.type === 'pounce') {
      c.anim = 0.42; c.leapX = p.x; c.leapY = p.y;
      var hitList = G.mice.filter(function (o) { var q = posAt(o.s); return Math.hypot(q.x - p.x, q.y - p.y) <= T.splash[c.lvl]; });
      hitList.forEach(function (o) { hit(o, T.dmg[c.lvl], 'pounce'); });
      G.fx.push({ kind: 'ring', x: p.x, y: p.y, r: T.splash[c.lvl], t: 0, max: 0.45 });
      Sound.thump();
    } else if (c.type === 'toss') {
      c.anim = 0.3;
      G.shots.push({ x: c.x + 0.5, y: c.y + 0.35, tx: p.x, ty: p.y, target: m.id, dmg: T.dmg[c.lvl], tangle: c.lvl === 2, spin: 0 });
      Sound.toss();
    }
  }
  function hit(m, dmg, how) {
    if (m.hp <= 0) return;
    m.hp -= dmg; m.hitT = 0.3;
    var p = posAt(m.s);
    if (how === 'swat') G.fx.push({ kind: 'pap', x: p.x, y: p.y - 0.15, t: 0, max: 0.3 });
    if (m.hp <= 0) {
      var i = G.mice.indexOf(m); if (i >= 0) G.mice.splice(i, 1);
      var r = Math.round(MICE[m.type].fish * (1 + (L.lv - 1) * 0.05)); G.fish += r;
      G.gone.push({ x: p.x, y: p.y, type: m.type, t: 0, dx: -p.dx, dy: -p.dy });
      pop(p.x, p.y - 0.3, '+' + r);
      Sound.squeak(m.type);
      renderHud(true);
      refreshTrayMoney();
    }
  }
  function steal(m) {
    var n = m.type === 'big' ? 3 : 1;
    G.yarn = Math.max(0, G.yarn - n); G.lost += n;
    var b = L.path.basket;
    for (var i = 0; i < n; i++) G.fx.push({ kind: 'ball', x: b.x, y: b.y - 0.2, vx: rand(-1.5, 1.5), vy: rand(-3.5, -2.5), t: 0, max: 0.9 });
    Sound.steal(); buzz(30);
    var yp = $('yarnPill'); yp.classList.remove('bump'); void yp.offsetWidth; yp.classList.add('bump');
    if (G.yarn <= 0) lose();
    renderHud();
  }
  function win() {
    if (G.over) return;
    G.over = 'won';
    var stars = G.lost === 0 ? 3 : G.yarn >= L.pl.yarn * 0.6 ? 2 : 1;
    G.stars = stars;
    var prev = P.stars[L.lv] || 0;
    if (stars > prev) P.stars[L.lv] = stars;
    if (L.lv >= P.best) P.best = L.lv + 1;
    save();
    Sound.win();
    track('Finish level', { game: 'yarn-defence', level: L.lv, stars: stars });
    if (GG.stat) GG.stat('yarndefence', 'levels', 1);
    var me = G; setTimeout(function () { if (G === me) showCard('won'); }, 900);
  }
  function lose() {
    G.over = 'lost';
    Sound.lose();
    track('Lose level', { game: 'yarn-defence', level: L.lv, wave: G.wave });
    var me = G; setTimeout(function () { if (G === me) showCard('lost'); }, 900);
  }
  function updateFx(dt) {
    for (var i = G.fx.length - 1; i >= 0; i--) { var f = G.fx[i]; f.t += dt; if (f.t > f.max) { G.fx.splice(i, 1); continue; } if (f.kind === 'ball' || f.kind === 'star') { f.vy += 9 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } }
    for (var j = G.gone.length - 1; j >= 0; j--) { var g = G.gone[j]; g.t += dt; g.x += g.dx * dt * 3; g.y += g.dy * dt * 3; if (g.t > 0.8) G.gone.splice(j, 1); }
  }
  function pop(x, y, txt) { G.fx.push({ kind: 'txt', x: x, y: y, txt: txt, t: 0, max: 0.9 }); }

  /* ================= placing and choosing cats ================= */
  function buildable(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && !L.path.cells[x + ',' + y] && !G.cats[x + ',' + y]; }
  function spentOn(c) { var T = TYPES[c.type], s = T.cost; for (var i = 0; i < c.lvl; i++) s += T.up[i]; return s; }
  function place(x, y, type) {
    var T = TYPES[type];
    if (!buildable(x, y) || G.fish < T.cost || G.over) return false;
    G.fish -= T.cost;
    G.cats[x + ',' + y] = { type: type, lvl: 0, x: x, y: y, cd: 0.2, anim: 0, face: 1, born: time };
    Sound.place(); buzz(8);
    renderHud(); refreshTrayMoney();
    return true;
  }
  function upgrade(c) {
    var T = TYPES[c.type]; if (c.lvl >= 2 || G.fish < T.up[c.lvl]) return false;
    G.fish -= T.up[c.lvl]; c.lvl++; c.born = time;
    Sound.upgrade(); buzz(10);
    G.fx.push({ kind: 'ring', x: c.x + 0.5, y: c.y + 0.5, r: 0.7, t: 0, max: 0.4, col: '#FFD23F' });
    renderHud(); renderTray();
    return true;
  }
  function sendHome(c) {
    var back = Math.floor(spentOn(c) * 0.7);
    delete G.cats[c.x + ',' + c.y]; G.fish += back; G.sel = null;
    pop(c.x + 0.5, c.y + 0.2, '+' + back); Sound.home();
    renderHud(); renderTray();
  }

  /* ================= tray (cats to place, or the picked cat) ================= */
  var tray = $('tray');
  var FISH_SVG = '<svg viewBox="0 0 32 32"><path d="M4 16 Q12 7 21 12 L28 7 V25 L21 20 Q12 25 4 16 Z" fill="#7CC4FF" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/></svg>';
  function catPic(type, pose) {
    var o = {}, b = TYPES[type].look; for (var k in b) o[k] = b[k];
    o.pose = pose || (type === 'nap' ? 'lie' : type === 'swat' ? 'wave' : 'sit'); o.face = type === 'nap' ? 'sleep' : 'happy'; o.fluid = true; o.cls = 'pic';
    return GGCat.svg(o);
  }
  window.__ydTray = true;
  function renderTray() {
    if (!L) return;
    if (G.sel) {
      var c = G.sel, T = TYPES[c.type], upCost = c.lvl < 2 ? T.up[c.lvl] : 0;
      tray.innerHTML = '<div class="info"><div class="name">' + T.name + ' ' + '★★★'.slice(0, c.lvl + 1) + '<small>' + T.blurb + '</small></div>' +
        (c.lvl < 2 ? '<button class="act" type="button" data-act="up"' + (G.fish < upCost ? ' disabled' : '') + '>Make better ' + FISH_SVG + upCost + '</button>' : '<span class="name"><small>As good as it gets!</small></span>') +
        '<button class="act home" type="button" data-act="home">Send home +' + Math.floor(spentOn(c) * 0.7) + '</button>' +
        '<button class="act home" type="button" data-act="close" aria-label="Done">Done</button></div>';
      return;
    }
    tray.innerHTML = ORDER.filter(function (t) { return TYPES[t].unlock <= L.lv; }).map(function (t) {
      var T = TYPES[t];
      return '<button class="cat' + (G.fish < T.cost ? ' poor' : '') + '" type="button" data-type="' + t + '" aria-pressed="' + (G.type === t) + '" aria-label="' + T.name + ', ' + T.cost + ' fish. ' + T.blurb + '">' +
        (T.unlock === L.lv && L.lv > 1 ? '<span class="new">New</span>' : '') + catPic(t) + '<span>' + T.name + '</span><span class="cost">' + FISH_SVG + T.cost + '</span></button>';
    }).join('');
  }
  function refreshTrayMoney() {
    if (G.sel) { var b = tray.querySelector('[data-act="up"]'); if (b) b.disabled = G.fish < TYPES[G.sel.type].up[G.sel.lvl]; return; }
    tray.querySelectorAll('.cat').forEach(function (b) { b.classList.toggle('poor', G.fish < TYPES[b.dataset.type].cost); });
  }
  tray.addEventListener('click', function (e) {
    Sound.init();
    var b = e.target.closest('[data-type]');
    if (b) {
      G.type = G.type === b.dataset.type ? null : b.dataset.type; Sound.click();
      tray.querySelectorAll('.cat').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.type === G.type)); });
      if (G.type && G.fish < TYPES[G.type].cost) say('Not enough fish yet: send some mice home first.', 2);
      else if (G.type) say('Tap a spot beside the path', 1.6);
      return;
    }
    var a = e.target.closest('[data-act]'); if (!a || !G.sel) return;
    if (a.dataset.act === 'up') upgrade(G.sel);
    else if (a.dataset.act === 'home') sendHome(G.sel);
    else { G.sel = null; Sound.click(); renderTray(); }
  });

  /* ================= input on the floor ================= */
  var canvas = $('stage');
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (!L || G.over) return;
    var cx = Math.floor((e.clientX - BX) / CS), cy = Math.floor((e.clientY - BY) / CS);
    var c = G.cats[cx + ',' + cy];
    if (c) { G.sel = G.sel === c ? null : c; Sound.click(); renderTray(); return; }
    if (G.sel) { G.sel = null; renderTray(); return; }
    if (G.type && cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) {
      if (L.path.cells[cx + ',' + cy]) { say('Cats go beside the path, not on it', 1.6); Sound.nope(); return; }
      if (G.fish < TYPES[G.type].cost) { say('Not enough fish yet', 1.4); Sound.nope(); return; }
      place(cx, cy, G.type);
    }
  });
  $('goBtn2').addEventListener('click', function () { Sound.init(); if (!L || G.over) return; sendWave(); });
  var speedBtn = $('speedBtn');
  speedBtn.addEventListener('click', function () { Sound.init(); speed = speed === 1 ? 2 : 1; speedBtn.setAttribute('aria-pressed', String(speed === 2)); speedBtn.setAttribute('aria-label', speed === 2 ? 'Normal speed' : 'Double speed'); Sound.click(); });
  $('prevBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); loadLevel(L.lv - 1); });
  $('nextBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); loadLevel(L.lv + 1); });
  $('goBtn').addEventListener('click', function () {
    Sound.init(); Sound.click(); hideCard();
    if (cardMode === 'won') loadLevel(L.lv + 1);
    else if (cardMode === 'lost') loadLevel(L.lv);
    levelSay();
  });
  $('againBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); loadLevel(L.lv); levelSay(); });

  /* ================= hud, messages, cards ================= */
  var lastFish = -1;
  function renderHud(bumpFish) {
    $('fish').textContent = G.fish; $('yarn').textContent = G.yarn;
    $('wave').textContent = G.wave + '/' + L.pl.waves;
    $('yarnPill').classList.toggle('low', G.yarn <= 3);
    if (bumpFish) { var fp = $('fishPill'); fp.classList.remove('bump'); void fp.offsetWidth; fp.classList.add('bump'); }
    var b = $('goBtn2');
    b.hidden = !!G.over || G.wave >= L.pl.waves || (G.started && G.queue.length > 0);
    b.textContent = !G.started ? 'Send mice ▶' : 'Next wave ▶' + (G.next > 0 ? ' ' + Math.ceil(G.next) : '');
    lastFish = G.fish;
  }
  var sayT = 0;
  function say(t, s) { var el = $('say'); el.textContent = t; el.classList.remove('hide'); sayT = s || 2.2; }
  function levelSay() {
    var newType = ORDER.filter(function (t) { return TYPES[t].unlock === L.lv && L.lv > 1; })[0];
    if (L.lv === 1) say('Pick a cat below, then tap beside the path', 3);
    else if (newType) say('New cat: the ' + TYPES[newType].name + '! ' + TYPES[newType].blurb + '.', 3.2);
    else say('Level ' + L.lv + ': ' + L.pl.waves + ' waves', 2);
  }
  var cardMode = 'intro';
  function showCard(mode) {
    cardMode = mode;
    $('againBtn').hidden = mode !== 'won';
    if (mode === 'won') {
      $('cardTitle').textContent = G.stars === 3 ? 'Not a strand lost!' : 'Yarn saved!';
      $('cardNote').textContent = 'Level ' + L.lv + ' done with ' + G.yarn + ' of ' + L.pl.yarn + ' balls of yarn left.';
      $('cardTip').textContent = G.stars < 3 ? 'For three stars, don’t let a single mouse reach the basket.' : '';
      $('goBtn').textContent = 'Level ' + (L.lv + 1);
    } else if (mode === 'lost') {
      $('cardTitle').textContent = 'The mice got the yarn!';
      $('cardNote').textContent = 'They made it to wave ' + G.wave + ' of ' + L.pl.waves + '.';
      $('cardTip').textContent = 'Tip: put cats where the path bends, so they can reach it twice. Nappers slow the mice down for the others.';
      $('goBtn').textContent = 'Try again';
    } else {
      $('cardTitle').textContent = 'Yarn Defence';
      $('cardNote').textContent = 'Mice are after your yarn! Put cats beside the path to send them home.';
      $('cardTip').textContent = 'Pick a cat below, then tap a spot beside the path. Cats cost fish, and every mouse sent home gives you more.';
      $('goBtn').textContent = P.best > 1 ? 'Play level ' + L.lv : 'Let’s go!';
    }
    drawCardPic(mode === 'won' ? G.stars : 0, mode);
    $('cardWrap').hidden = false;
  }
  function hideCard() { $('cardWrap').hidden = true; }

  /* ================= drawing ================= */
  var ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, CS = 60, BX = 0, BY = 0;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var tb = $('topbar').getBoundingClientRect().bottom || 64;
    var hud = $('hud'); hud.style.top = (tb + 4) + 'px';
    var top = hud.getBoundingClientRect().bottom + 8, bottom = tray.getBoundingClientRect().top - 8;
    var aw = cw - 16, ah = Math.max(100, bottom - top);
    var wasPortrait = portrait;
    portrait = aw / ah < 1.0;
    COLS = portrait ? 8 : 12; ROWS = portrait ? 12 : 8;
    CS = Math.floor(Math.min(aw / COLS, ah / ROWS));
    BX = Math.round((cw - CS * COLS) / 2); BY = Math.round(top + (ah - CS * ROWS) / 2);
    $('say').style.bottom = (ch - bottom + 14) + 'px';
    if (L && wasPortrait !== portrait) {
      // the floor plan turns on its side: cats move with it
      L.path = buildPath(L.lv);
      var cats = {}; for (var k in G.cats) { var c = G.cats[k], nx = c.y, ny = c.x; c.x = nx; c.y = ny; cats[nx + ',' + ny] = c; } G.cats = cats;
    }
  }
  function sx(x) { return BX + x * CS; }
  function sy(y) { return BY + y * CS; }
  function drawFloor(c) {
    c.fillStyle = '#F3D9B8'; c.fillRect(0, 0, cw, ch);
    // the floor: warm boards
    c.save(); D.rr(c, BX - 6, BY - 6, CS * COLS + 12, CS * ROWS + 12, 18); c.clip();
    c.fillStyle = '#D9A574'; c.fillRect(BX - 6, BY - 6, CS * COLS + 12, CS * ROWS + 12);
    var bh = CS * 0.5, R = D.seeded(7);
    for (var r = 0; r * bh < CS * ROWS + 12; r++) {
      var y = BY - 6 + r * bh;
      c.fillStyle = r % 2 ? '#D49E6C' : '#DCAA7A'; c.fillRect(BX - 6, y, CS * COLS + 12, bh);
      c.strokeStyle = 'rgba(42,35,64,.16)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(BX - 6, y); c.lineTo(BX + CS * COLS + 6, y); c.stroke();
      for (var x = BX - 6 + R() * CS * 2; x < BX + CS * COLS; x += CS * (2.2 + R())) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + bh); c.stroke(); }
    }
    // a round rug or two (just for looks)
    c.restore();
    D.rr(c, BX - 6, BY - 6, CS * COLS + 12, CS * ROWS + 12, 18); D.ink(c, 4);
    // spots you can use, while a cat is picked
    if (G.type && !G.sel && !G.over) {
      c.fillStyle = 'rgba(255,255,255,.35)';
      for (var gx = 0; gx < COLS; gx++) for (var gy = 0; gy < ROWS; gy++) if (buildable(gx, gy)) { c.beginPath(); c.arc(sx(gx + 0.5), sy(gy + 0.5), CS * 0.09, 0, TAU); c.fill(); }
    }
  }
  function drawPath(c) {
    var pl = L.path.poly;
    function line() { c.beginPath(); pl.forEach(function (p, i) { if (i) c.lineTo(sx(p.x), sy(p.y)); else c.moveTo(sx(p.x), sy(p.y)); }); }
    c.save(); D.rr(c, BX - 6, BY - 6, CS * COLS + 12, CS * ROWS + 12, 18); c.clip();
    c.lineJoin = 'round'; c.lineCap = 'round';
    line(); c.strokeStyle = INK; c.lineWidth = CS * 0.82 + 8; c.stroke();
    line(); c.strokeStyle = '#E9837A'; c.lineWidth = CS * 0.82; c.stroke();
    line(); c.strokeStyle = '#F2A08E'; c.lineWidth = CS * 0.56; c.stroke();
    // little paw prints along the middle
    c.setLineDash([2, CS * 0.32]); line(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = CS * 0.08; c.stroke(); c.setLineDash([]);
    c.restore();
    // the mouse hole, in a bit of skirting at the edge
    var h = L.path.hole;
    c.save(); c.translate(sx(h.x), sy(h.y)); c.rotate(Math.atan2(h.dy, h.dx) - Math.PI / 2); c.scale(CS / 60, CS / 60);
    D.shape(c, D.rrPath(-40, -16, 80, 22, 6), '#E9DCC8', { lw: D.LW.mid, depth: 0 });
    D.shape(c, function (p) { p.moveTo(-18, 6); p.lineTo(-18, -6); p.arc(0, -6, 18, Math.PI, 0); p.lineTo(18, 6); p.closePath(); }, '#2A2340', { lw: D.LW.mid, depth: 0 });
    c.restore();
  }
  function drawBasket(c) {
    var b = L.path.basket, s = CS / 60;
    c.save(); c.translate(sx(b.x), sy(b.y) + 6 * s); c.scale(s, s);
    D.shadow(c, 0, 18, 34, 7);
    var n = Math.min(G.yarn, 10), cols = ['#FF8FAB', '#7CC4FF', '#FFD23F', '#7BD389', '#B48CFF'];
    var spots = [[-16, -6], [0, -9], [16, -6], [-8, -16], [8, -16], [0, -24], [-20, -14], [20, -14], [-12, -26], [12, -26]];
    for (var i = 0; i < n; i++) {
      var q = spots[i];
      D.shape(c, D.ellPath(q[0], q[1], 11, 11), cols[i % cols.length], { lw: D.LW.fine, depth: 3, inside: function (c) { c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(q[0] - 9, q[1] - 3); c.quadraticCurveTo(q[0], q[1] - 8, q[0] + 9, q[1] - 2); c.moveTo(q[0] - 9, q[1] + 3); c.quadraticCurveTo(q[0], q[1] - 2, q[0] + 9, q[1] + 4); c.stroke(); } });
    }
    D.shape(c, function (p) { p.moveTo(-32, -6); p.lineTo(32, -6); p.lineTo(26, 18); p.lineTo(-26, 18); p.closePath(); }, '#C9935E', { lw: D.LW.mid, depth: 5, inside: function (c) {
      c.strokeStyle = 'rgba(42,35,64,.28)'; c.lineWidth = 2.5;
      for (var x = -26; x < 30; x += 9) { c.beginPath(); c.moveTo(x, -6); c.lineTo(x + 3, 18); c.stroke(); }
      c.beginPath(); c.moveTo(-30, 4); c.lineTo(30, 4); c.stroke();
    } });
    D.shape(c, D.rrPath(-35, -10, 70, 8, 4), '#B07C4C', { lw: D.LW.fine, depth: 0 });
    c.restore();
  }
  function drawMouse(c, m, x, y, dirx, diry, alpha, spin) {
    var M = MICE[m.type], s = CS / 60 * M.size;
    c.save(); c.translate(sx(x), sy(y)); c.globalAlpha = alpha === undefined ? 1 : alpha;
    if (spin) c.rotate(spin);
    var ang = Math.atan2(diry, dirx), flip = dirx < -0.1;
    c.scale(s, s);
    D.shadow(c, 0, 9, 14, 4);
    var bob = Math.sin(m.step || 0) * 1.5;
    c.save(); if (flip) c.scale(-1, 1);
    var tilt = flip ? -Math.atan2(diry, -dirx) : Math.atan2(diry, dirx);
    c.rotate(clamp(tilt, -0.5, 0.5) * 0.5);
    // tail
    c.beginPath(); c.moveTo(-14, 2); c.quadraticCurveTo(-26, -2 + Math.sin((m.step || 0) * 0.7) * 5, -30, 6); c.strokeStyle = INK; c.lineWidth = 4; c.stroke(); c.strokeStyle = '#FFB4C6'; c.lineWidth = 1.8; c.stroke();
    // body
    D.shape(c, function (p) { p.moveTo(-16, 4 + bob); p.quadraticCurveTo(-16, -12 + bob, 2, -12 + bob); p.quadraticCurveTo(16, -12 + bob, 20, 2 + bob); p.quadraticCurveTo(18, 8 + bob, 4, 8 + bob); p.lineTo(-12, 8 + bob); p.quadraticCurveTo(-16, 8 + bob, -16, 4 + bob); p.closePath(); }, M.col, { lw: 3, depth: 3 });
    // ear, eye and nose
    D.shape(c, D.ellPath(6, -12 + bob, 6, 6), '#FFB4C6', { lw: 2.5, depth: 0 });
    c.beginPath(); c.arc(21, 2 + bob, 2.4, 0, TAU); c.fillStyle = '#FF8FAB'; c.fill();
    if (m.sleepy) { c.beginPath(); c.moveTo(10, -3 + bob); c.lineTo(15, -3 + bob); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); }
    else { c.beginPath(); c.arc(13, -3 + bob, 2, 0, TAU); c.fillStyle = INK; c.fill(); }
    if (m.type === 'big') { D.shape(c, function (p) { p.moveTo(-4, -12 + bob); p.lineTo(10, -12 + bob); p.lineTo(8, -20 + bob); p.lineTo(3, -15 + bob); p.lineTo(-2, -20 + bob); p.closePath(); }, '#FFD23F', { lw: 2.2, depth: 0 }); }
    c.restore();
    // dizzy stars when batted
    if (m.hitT > 0 || spin) {
      for (var i = 0; i < 3; i++) { var a = time * 8 + i * TAU / 3; c.save(); c.translate(Math.cos(a) * 12, -18 + Math.sin(a) * 4); starPath(c, 4); c.fillStyle = '#FFD23F'; c.fill(); D.ink(c, 1.2); c.restore(); }
    }
    if (m.sleepy && !spin) { c.font = '800 10px ' + displayFont; c.fillStyle = '#B48CFF'; c.fillText('z', 10, -16 - (time * 10 % 6)); }
    c.restore();
    // how much bop is left (only once it's been batted)
    if (!spin && m.hp < m.max) {
      var w = CS * 0.42 * Math.max(1, M.size * 0.8), hx = sx(x) - w / 2, hy = sy(y) - CS * 0.36 * M.size;
      D.rr(c, hx, hy, w, 5, 2.5); c.fillStyle = 'rgba(42,35,64,.45)'; c.fill();
      D.rr(c, hx, hy, w * clamp(m.hp / m.max, 0, 1), 5, 2.5); c.fillStyle = '#7BD389'; c.fill();
    }
  }
  function starPath(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawCat(c, cat) {
    var T = TYPES[cat.type], s = CS / 60;
    var cx = sx(cat.x + 0.5), cy = sy(cat.y + 0.5);
    // its cushion, with a dot for each time it's been made better
    c.save(); c.translate(cx, cy + CS * 0.26); c.scale(s, s);
    D.shape(c, D.ellPath(0, 0, 25, 9), T.cushion, { lw: 3, depth: 3 });
    for (var i = 0; i <= cat.lvl; i++) { c.save(); c.translate((i - cat.lvl / 2) * 11, 1); starPath(c, 4.5); c.fillStyle = '#FFF6D8'; c.fill(); D.ink(c, 1.4); c.restore(); }
    c.restore();
    // the cat
    var o = {}, b = T.look; for (var k in b) o[k] = b[k];
    o.face = 'open'; o.pose = 'sit';
    var size = CS * 0.62, k2 = size / 88, dx = 0, dy = 0, grow = clamp((time - cat.born) / 0.3, 0, 1);
    if (cat.type === 'nap') { o.pose = 'lie'; o.face = 'sleep'; size = CS * 0.66; k2 = size / 88; }
    if (cat.type === 'swat' && cat.anim > 0) { o.pose = 'wave'; o.face = 'happy'; }
    if (cat.type === 'pounce' && cat.anim > 0) {
      // a leap out to the mouse and back
      var t = 1 - cat.anim / 0.42, out = Math.sin(t * Math.PI);
      dx = (sx(cat.leapX) - cx) * out * 0.8; dy = (sy(cat.leapY) - cy) * out * 0.8 - out * CS * 0.3; o.face = 'happy';
    }
    if (cat.type === 'toss' && cat.anim > 0) { o.pose = 'wave'; o.face = 'happy'; }
    c.save(); c.translate(cx + dx, cy + dy);
    var sc = grow < 1 ? 0.6 + 0.4 * (1 + 2.7 * Math.pow(grow - 1, 3) + 1.7 * Math.pow(grow - 1, 2)) : 1; c.scale(sc, sc);
    if (o.pose === 'lie') c.translate(0, CS * 0.2 - 30 * k2);
    else c.translate(0, CS * 0.24 - 100 * k2);
    if (cat.face === -1 && o.pose !== 'lie') c.scale(-1, 1);
    o.size = size;
    try { GGCat.draw(c, o); } catch (e) { c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fillStyle = '#FFA94D'; c.fill(); }
    c.restore();
    if (cat.type === 'toss') { c.save(); c.translate(cx + CS * 0.26, cy + CS * 0.18); c.scale(s, s); yarnBall(c, 8, '#FF8FAB', 0); c.restore(); }
    if (cat.type === 'nap') { c.save(); c.translate(cx + CS * 0.18, cy - CS * 0.2 - (time * 8 % 8) * s); c.globalAlpha = 0.85; c.font = '800 ' + Math.round(14 * s) + 'px ' + displayFont; c.lineWidth = 4 * s; c.strokeStyle = INK; c.strokeText('z', 0, 0); c.fillStyle = '#D8C8FF'; c.fillText('z', 0, 0); c.restore(); }
  }
  function yarnBall(c, r, col, spin) {
    c.save(); c.rotate(spin || 0);
    D.shape(c, D.ellPath(0, 0, r, r), col, { lw: 2.5, depth: 2, inside: function (c) { c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-r, -r * 0.3); c.quadraticCurveTo(0, -r * 0.9, r, -r * 0.2); c.moveTo(-r, r * 0.35); c.quadraticCurveTo(0, -r * 0.2, r, r * 0.45); c.stroke(); } });
    c.restore();
  }
  function drawNapAuras(c) {
    for (var k in G.cats) {
      var cat = G.cats[k]; if (cat.type !== 'nap') continue;
      var r = TYPES.nap.range[cat.lvl] * CS;
      var g = c.createRadialGradient(sx(cat.x + 0.5), sy(cat.y + 0.5), r * 0.2, sx(cat.x + 0.5), sy(cat.y + 0.5), r);
      g.addColorStop(0, 'rgba(180,140,255,.16)'); g.addColorStop(1, 'rgba(180,140,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(sx(cat.x + 0.5), sy(cat.y + 0.5), r, 0, TAU); c.fill();
    }
  }
  function draw(c) {
    if (!L) return;
    drawFloor(c);
    drawNapAuras(c);
    drawPath(c);
    drawBasket(c);
    // range of the picked cat
    if (G.sel) {
      var T = TYPES[G.sel.type], r = T.range[G.sel.lvl] * CS;
      c.beginPath(); c.arc(sx(G.sel.x + 0.5), sy(G.sel.y + 0.5), r, 0, TAU); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill();
      c.setLineDash([8, 8]); c.lineWidth = 3; c.strokeStyle = 'rgba(42,35,64,.6)'; c.stroke(); c.setLineDash([]);
    }
    // mice and cats, back to front
    var list = [];
    G.mice.forEach(function (m) { var p = posAt(m.s); list.push({ y: p.y, f: function () { drawMouse(c, m, p.x, p.y, p.dx, p.dy); } }); });
    for (var k in G.cats) (function (cat) { list.push({ y: cat.y + 0.5 + (cat.anim > 0 && cat.type === 'pounce' ? 0.8 : 0), f: function () { drawCat(c, cat); } }); })(G.cats[k]);
    list.sort(function (a, b) { return a.y - b.y; }).forEach(function (q) { q.f(); });
    G.gone.forEach(function (g) { drawMouse(c, { type: g.type, step: 0, hp: 1, max: 1, hitT: 0 }, g.x, g.y, -g.dx || 1, -g.dy, 1 - g.t / 0.8, g.t * 10); });
    // yarn balls in the air, each with its trailing strand
    G.shots.forEach(function (sh) { c.save(); c.translate(sx(sh.x), sy(sh.y)); c.scale(CS / 60, CS / 60); yarnBall(c, 7, sh.tangle ? '#B48CFF' : '#FF8FAB', sh.spin); c.restore(); });
    G.fx.forEach(function (f) {
      var k = f.t / f.max;
      if (f.kind === 'ring') { c.beginPath(); c.arc(sx(f.x), sy(f.y), f.r * CS * (0.4 + 0.6 * k), 0, TAU); c.lineWidth = 5 * (1 - k) + 1; c.strokeStyle = f.col || 'rgba(255,255,255,.9)'; c.stroke(); }
      else if (f.kind === 'pap') { c.save(); c.translate(sx(f.x), sy(f.y)); c.globalAlpha = 1 - k; c.scale(0.7 + k * 0.6, 0.7 + k * 0.6); starPath(c, CS * 0.16); c.fillStyle = '#FFF6D8'; c.fill(); D.ink(c, 2); c.restore(); }
      else if (f.kind === 'ball') { c.save(); c.translate(sx(f.x), sy(f.y)); c.globalAlpha = 1 - k * k; c.scale(CS / 60, CS / 60); yarnBall(c, 9, '#FF8FAB', f.t * 8); c.restore(); }
      else if (f.kind === 'txt') {
        c.save(); c.translate(sx(f.x), sy(f.y) - k * CS * 0.5); c.globalAlpha = 1 - k * k;
        c.font = '800 ' + Math.round(CS * 0.32) + 'px ' + displayFont; c.textAlign = 'center';
        c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(f.txt, 0, 0); c.fillStyle = '#FFF6D8'; c.fillText(f.txt, 0, 0); c.restore();
      }
    });
  }
  function drawCardPic(stars, mode) {
    var c = $('cardPic').getContext('2d');
    c.clearRect(0, 0, 440, 300);
    c.save(); D.rr(c, 6, 6, 428, 288, 26); c.clip();
    c.fillStyle = '#DCAA7A'; c.fillRect(0, 0, 440, 300);
    c.strokeStyle = 'rgba(42,35,64,.14)'; c.lineWidth = 2; for (var y = 0; y < 300; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(440, y); c.stroke(); }
    c.lineCap = 'round'; c.beginPath(); c.moveTo(-20, 210); c.lineTo(300, 210); c.lineTo(300, 120); c.lineTo(460, 120);
    c.strokeStyle = INK; c.lineWidth = 58; c.stroke(); c.strokeStyle = '#E9837A'; c.lineWidth = 50; c.stroke(); c.strokeStyle = '#F2A08E'; c.lineWidth = 34; c.stroke();
    var saveCS = CS, sBX = BX, sBY = BY; CS = 80; BX = 0; BY = 0;
    try {
      if (mode !== 'lost') { drawMouse(c, { type: 'grey', step: 1, hp: 1, max: 1, hitT: 1 }, 1.7, 2.62, 1, 0); drawMouse(c, { type: 'quick', step: 3, hp: 1, max: 1, hitT: 0 }, 0.8, 2.62, 1, 0); }
      else { drawMouse(c, { type: 'grey', step: 1, hp: 1, max: 1, hitT: 0 }, 4.5, 1.5, 1, 0); }
      drawCat(c, { type: 'swat', lvl: stars ? 2 : 0, x: 2.4, y: 1.0, anim: mode === 'lost' ? 0 : 0.2, face: -1, born: -9 });
      drawCat(c, { type: 'nap', lvl: 0, x: 3.9, y: 2.6, anim: 0, face: 1, born: -9 });
    } catch (e) {}
    CS = saveCS; BX = sBX; BY = sBY;
    if (stars) for (var i = 0; i < 3; i++) { c.save(); c.translate(150 + i * 70, 56 - (i === 1 ? 12 : 0)); starPath(c, 26); c.fillStyle = i < stars ? '#FFD23F' : 'rgba(255,255,255,.4)'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); c.restore(); }
    c.restore();
    D.rr(c, 6, 6, 428, 288, 26); D.ink(c, 5);
  }
  var displayFont = 'sans-serif';

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
    var lastPap = 0;
    return {
      init: init, isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      click: function () { tone({ f: 900, dur: 0.04, gain: 0.06, type: 'triangle' }); },
      nope: function () { tone({ f: 300, to: 220, dur: 0.12, gain: 0.07, type: 'triangle' }); },
      place: function () { tone({ f: 520, to: 880, dur: 0.12, gain: 0.08, type: 'triangle', slide: 0.08 }); noise({ type: 'lowpass', freq: 500, dur: 0.05, gain: 0.06 }); },
      upgrade: function () { [660, 880, 1175].forEach(function (f, i) { tone({ f: f, dur: 0.12, gain: 0.07, delay: i * 0.07, type: 'triangle' }); }); },
      home: function () { tone({ f: 700, to: 420, dur: 0.16, gain: 0.07, type: 'triangle' }); },
      pap: function () { if (!ac || ac.currentTime - lastPap < 0.06) return; lastPap = ac.currentTime; noise({ type: 'bandpass', freq: rand(1400, 2200), q: 2, dur: 0.04, gain: 0.08 }); },
      thump: function () { noise({ type: 'lowpass', freq: 300, q: 1, dur: 0.12, gain: 0.16 }); tone({ f: 160, to: 90, dur: 0.12, gain: 0.08 }); },
      toss: function () { noise({ type: 'bandpass', freq: 900, q: 0.7, attack: 0.04, dur: 0.12, gain: 0.05 }); },
      squeak: function (t) { var p = t === 'big' ? 0.6 : t === 'quick' ? 1.3 : 1; tone({ f: 1500 * p, to: 2300 * p, dur: 0.08, gain: 0.04, type: 'triangle' }); },
      steal: function () { tone({ f: 500, to: 260, dur: 0.3, gain: 0.08, type: 'triangle', slide: 0.3 }); },
      wave: function () { tone({ f: 880, dur: 0.15, gain: 0.06, type: 'triangle' }); tone({ f: 1320, dur: 0.2, gain: 0.05, type: 'triangle', delay: 0.12 }); },
      win: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone({ f: f, dur: 0.22, gain: 0.07, delay: i * 0.1, type: 'triangle' }); }); },
      lose: function () { [520, 440, 360].forEach(function (f, i) { tone({ f: f, dur: 0.25, gain: 0.07, delay: i * 0.16, type: 'triangle' }); }); }
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
  var time = 0, last = performance.now(), paused = false, hudT = 0;
  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (!paused && $('cardWrap').hidden) {
      time += dt;
      for (var i = 0; i < speed; i++) update(dt);
      hudT -= dt; if (hudT <= 0) { hudT = 0.25; if (L) renderHud(); }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    draw(ctx);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(tray); ro.observe($('topbar')); }
  document.addEventListener('visibilitychange', function () { paused = document.hidden; last = performance.now(); });
  try { displayFont = getComputedStyle(document.body).getPropertyValue('--display') || 'sans-serif'; } catch (e) {}
  layout();
  loadLevel(P.cur || 1);
  layout();
  showCard('intro');
  requestAnimationFrame(frame);

  /* test hooks */
  window.__yd = {
    state: function () { return { over: G.over, lv: L.lv, fish: G.fish, yarn: G.yarn, wave: G.wave, waves: L.pl.waves, mice: G.mice.length, cats: Object.keys(G.cats).length, stars: G.stars, best: P.best, portrait: portrait }; },
    load: function (lv) { hideCard(); P.best = Math.max(P.best, lv); loadLevel(lv); },
    place: function (x, y, t) { return place(x, y, t); },
    send: sendWave,
    cellToScreen: function (x, y) { return { x: BX + (x + 0.5) * CS, y: BY + (y + 0.5) * CS }; },
    // run the game quickly with a simple player: places the best affordable cat where it covers most path, and
    // makes cats better once it has plenty of fish
    tick: function (n, autoOn) {
      for (var i = 0; i < n; i++) { time += 1 / 60; if (autoOn) this.auto(); update(1 / 60); if (G.over) break; }
      return this.state();
    },
    auto: function () {
      if (G.over) return;
      if (!G.started) { if (Object.keys(G.cats).length >= 2 || G.fish < 20) sendWave(); }
      var plan = ['swat', 'pounce', 'swat', 'nap', 'toss', 'pounce', 'swat', 'toss'], n = Object.keys(G.cats).length;
      var want = plan[n % plan.length];
      while (TYPES[want].unlock > L.lv) want = 'swat';
      var cats = Object.keys(G.cats).map(function (k) { return G.cats[k]; });
      if (cats.length >= 6 && G.fish >= 40) { var up = cats.filter(function (c) { return c.lvl < 2 && c.type !== 'nap'; }).sort(function (a, b) { return a.lvl - b.lvl; })[0]; if (up && upgrade(up)) return; }
      if (G.fish < TYPES[want].cost) return;
      var best = null, r = TYPES[want].range[0];
      for (var x = 0; x < COLS; x++) for (var y = 0; y < ROWS; y++) {
        if (!buildable(x, y)) continue;
        var cover = 0; for (var s = 0; s < L.path.total; s += 0.25) { var p = posAt(s); if (Math.hypot(p.x - x - 0.5, p.y - y - 0.5) <= r) cover++; }
        if (!best || cover > best.c) best = { x: x, y: y, c: cover };
      }
      if (best) place(best.x, best.y, want);
    }
  };
})();
