/* Sneaky Cat – a stealth game for older kids (10+), seen from above. It's the middle of the night and your cat wants
   the midnight snack on the far side of the room. Dogs are asleep in their beds.
   Press and hold where you want to go and your cat walks there at its own speed, around the furniture (a quick tap
   sends it to that spot; arrow keys / WASD work too). Each dog sleeps (zzz), then stirs (an ear goes up and its "?"
   shows: a warning), then looks: a soft glow shows everything it can see. Sofas, armchairs, tables, bookshelves, plant
   pots and boxes block its view, so hide behind them. Stay in the glow of a looking dog and it woofs: your cat
   scurries back to the last safe spot (anywhere no dog could see), not the start. Later: dogs that turn their heads,
   dogs that cover each other, squeaky toys that wake the nearest dog, and a dog that wanders a short path.
   Fish to collect. Three stars: reach the snack, get every fish, never get spotted. 20 hand-made rooms.
   Saves GG.setProgress('sneaky', { best, cur, stars: { level: n } }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function angDiff(a, b) { var d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
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

  /* ================= the rooms =================
     Each room is a grid of 40-unit squares, the cat starting on the left and the snack on the right (on an upright
     phone the whole room is turned so you walk up the screen). One letter per square; squares of the same letter next
     to each other make one piece of furniture:
       .  floor          c  your cat        G  the midnight snack     f  a fish       k  a squeaky toy
       s  sofa           a  armchair        t  table                  o  round table  b  bookshelf
       p  plant pot      x  box             l  floor lamp             #  wall
       < > ^ v  a dog asleep in its bed, facing that way      w  a dog that walks (its path is in the level's dogs)
     dogs: one entry per dog, in reading order: { turn: degrees its head sweeps while it looks, range, path: [[col, row], ...] }
     rugs: [[col0, row0, col1, row1, colour]], just to look at. */
  var CELL = 40;
  var LEVELS = [
    { // 1: one dog, one sofa to hide behind
      say: 'Press and hold where you want to go.',
      map: [
        'bbbbbbbbb.vvv.bbbbbbbbbb',
        '..........vvv',
        '..........vvv',
        '',
        '',
        '',
        '',
        '..........ssss',
        '..........ssss',
        '',
        '.c....................G',
        '',
        '',
        'p......................p'],
      rugs: [[2, 8, 7, 12, '#5C7FC4']] },
    { // 2: a fish out in the open
      say: 'Grab the fish on the way!',
      map: [
        '',
        '.....................G',
        'pp',
        'pp...................',
        '....................<<<',
        '.........aa.........<<<',
        '.........aa.........<<<',
        '',
        '...............f',
        '',
        '.........ssss',
        '.........ssss',
        '.c',
        'bbbbbbbbbbbbbbbbbbbbbbbb'],
      rugs: [[12, 3, 18, 9, '#6FAE8E']] },
    { // 3: two dogs, one after the other
      say: 'Two dogs tonight.',
      map: [
        'bbbbbb.vvv.bbbbbb.......',
        '.......vvv..............',
        '.......vvv..............',
        '........................',
        '.......xx...............',
        '.......xx......f........',
        '........................',
        '.c..............tttt..G.',
        '.....f..........tttt....',
        '........................',
        '..........aa............',
        '..........aa.....^^^....',
        'p................^^^...p',
        'pp...............^^^..pp'],
      rugs: [[2, 9, 8, 12, '#C77DA0']] },
    { // 4: a long look along the room, and a row of things to hop between
      say: 'Hide behind one thing, then the next.',
      map: [
        '........................',
        '.....................G..',
        '..pp......xx......pp....',
        '..pp......xx......pp....',
        '........................',
        '.....................<<<',
        '.c...................<<<',
        '.....................<<<',
        '........f...............',
        '...aa.......ss..........',
        '...aa.......ss.....f....',
        '........................',
        '........................',
        'bbbbbbbbbbbbbbbbbbbbb...'],
      rugs: [[4, 4, 16, 8, '#5C7FC4']] },
    { // 5: squeaky toys
      say: 'Squeaky toys wake the dogs. Walk round them!',
      map: [
        '............vvv.........',
        '............vvv......G..',
        '............vvv.........',
        '........................',
        '.......k........k.......',
        '...xx..........f........',
        '...xx...oooo............',
        '.c......oooo.....ss.....',
        '........oooo.....ss.....',
        '........oooo..k.........',
        '...........f............',
        '....k...................',
        '...................bbbbb',
        'pp..................... '],
      rugs: [[16, 9, 22, 12, '#E0A458']] },
    { // 6: a dog that turns its head
      say: 'This one turns its head when it looks!',
      map: [
        'bbbbbbbbbbb...bbbbbbbbbb',
        '...........vvv..........',
        '...........vvv..........',
        '...........vvv..........',
        '........................',
        '.....pp..........pp.....',
        '.....pp...f......pp.....',
        '........................',
        '..........ssss..........',
        '.c........ssss........G.',
        '........................',
        '...aa...............aa..',
        '...aa.......f.......aa..',
        '........................'],
      dogs: [{ turn: 40 }], rugs: [[8, 10, 15, 13, '#6FAE8E']] },
    { // 7: two dogs watching the same floor
      say: 'Two dogs can watch the same spot: wait till both are asleep.',
      map: [
        '.....................<<<',
        '.....................<<<',
        '..pp.................<<<',
        '..pp.......xx...........',
        '...........xx.....f.....',
        '........................',
        '.c.......ssss...........',
        '.........ssss.......aa..',
        '....................aa..',
        '.....aa.................',
        '.....aa....f............',
        '...........^^^.......G..',
        'pp.........^^^..........',
        'pp.........^^^.....bbbbb'],
      rugs: [[3, 7, 9, 11, '#C77DA0']] },
    { // 8: two rooms and a doorway
      say: 'Two rooms tonight. Through the doorway!',
      map: [
        'bbbbbbbbbb....##..............',
        '..............##...vvv......G.',
        '......vvv.....##...vvv.......',
        '......vvv.....##...vvv.......',
        '......vvv.....##.............',
        '..............##.....xx......',
        '.c.....aa.....##.....xx..f...',
        '.......aa.....................',
        '..............................',
        '..f...........##...............',
        '..............##....ssss.......',
        '.....ssss.....##....ssss.......',
        '.....ssss.....##...............',
        'pp............##.............pp'],
      rugs: [[2, 9, 10, 13, '#5C7FC4'], [17, 8, 27, 12, '#E0A458']] },
    { // 9: a dog that walks
      say: 'This dog is awake, walking up and down. Cross behind it!',
      map: [
        'bbbbbbbb................',
        '.....................G..',
        '..pp.......w............',
        '..pp....................',
        '........................',
        '......aa.........xx.....',
        '.c....aa.........xx.....',
        '........................',
        '........................',
        '........f...............',
        '.................aa.....',
        '.................aa.....',
        'pp......................',
        'pp.....................p'],
      dogs: [{ path: [[11, 2], [11, 12]], pause: 1.6, range: 260 }], rugs: [[13, 7, 20, 12, '#6FAE8E']] },
    { // 10: a head-turner and a sleepy friend, with squeaky toys about
      map: [
        '.............vvv........',
        '.............vvv........',
        '..pp.........vvv........',
        '..pp....................',
        '..............k.........',
        '.......ssss.........f...',
        '.c.....ssss.............',
        '.................oo.....',
        '....k............oo.....',
        '..........f.............',
        '...xx...........k.......',
        '...xx.......aa......^^^.',
        '............aa....G.^^^.',
        'bbbbbbbbb...........^^^.'],
      dogs: [{ turn: 35 }, {}], rugs: [[5, 8, 11, 12, '#5C7FC4']] },
    { // 11: two rooms, a head-turner in the first
      say: 'Level 11: a bigger house.',
      map: [
        'bbbbbbbbb.......##..........',
        '..........vvv...##....<<<...',
        '..........vvv...##....<<<...',
        '..........vvv...##....<<<...',
        '................##..........',
        '..pp....xx......##...f......',
        '.cpp....xx......##..........',
        '.............................',
        '.....f.......................',
        '......ssss......##...tttt....',
        '......ssss......##...tttt....',
        '................##.......G...',
        'pp..............##...........',
        'pp..............##......^^^..',
        '................##......^^^..',
        '................##......^^^..'],
      dogs: [{ turn: 35 }, {}, {}], rugs: [[3, 11, 11, 15, '#6FAE8E'], [19, 5, 26, 10, '#C77DA0']] },
    { // 12: a dog walking up and down while another sleeps
      map: [
        '..........................',
        '..........................',
        '.pp.......w.........>>>...',
        '.pp.................>>>...',
        '....................>>>...',
        '..........................',
        '.c.....aa.....ssss.....G..',
        '.......aa.....ssss........',
        '..........................',
        '...........f..............',
        '..xx...............aa.....',
        '..xx........k......aa.....',
        '..........................',
        'bbbbbbbbbbbbbbbbbbbb......'],
      dogs: [{ path: [[10, 2], [10, 11]], pause: 1.4 }, { range: 520 }], rugs: [[14, 9, 22, 12, '#E0A458']] },
    { // 13: three dogs
      map: [
        '>>>.................vvv.....',
        '>>>.................vvv.....',
        '>>>.................vvv.....',
        '..........f.................',
        '.......xx..........aa.......',
        '.......xx..........aa.......',
        '.c...........oo.........f...',
        '.............oo.............',
        '......tttt..................',
        '......tttt.........ssss.....',
        '...................ssss.....',
        '..............^^^.......G...',
        'pp............^^^...........',
        'pp............^^^......bbbbb'],
      rugs: [[9, 3, 17, 9, '#5C7FC4']] },
    { // 14: a dog that walks round the table
      say: 'This dog walks round and round the table. Keep it between you!',
      map: [
        '..........................',
        '..pp..................pp..',
        '..pp..................pp..',
        '.......w..................',
        '.........tttttt...........',
        '.........tttttt.......G...',
        '.........tttttt...........',
        '..........................',
        '..........................',
        '....aa..........f...aa....',
        '....aa..............aa....',
        '.c........................',
        '..........................',
        'bbbbbbbb.........bbbbbbbbb'],
      dogs: [{ path: [[7, 3], [17, 3], [17, 7], [7, 7], [7, 3]], range: 260 }], rugs: [[3, 8, 9, 12, '#6FAE8E']] },
    { // 15: two rooms, a walker by the doorway
      map: [
        'bbbbbbbb.......##.............',
        '...............##.......vvv...',
        '...vvv.........##.......vvv...',
        '...vvv.........##.......vvv...',
        '...vvv.........##.............',
        '...............##.w.xx........',
        '.c.....aa...........xx...f....',
        '.......aa.....................',
        '..............................',
        '...f...........##.........oo..',
        '...........ssss##.........oo..',
        '...........ssss##.....G.......',
        'pp.............##.............',
        'pp.............##........bbbbb'],
      dogs: [{}, {}, { path: [[19, 5], [19, 12]], pause: 1.4, range: 260 }], rugs: [[4, 8, 11, 12, '#C77DA0']] },
    { // 16: two head-turners keeping watch together
      map: [
        '...........vvv.............',
        '...........vvv.............',
        '..pp.......vvv.....pp......',
        '..pp...............pp......',
        '...........................',
        '.......ssss......xx........',
        '.c.....ssss......xx.....G..',
        '...........................',
        '.....f.......aa.....f......',
        '.............aa............',
        '...........................',
        '..xx...........^^^.....pp..',
        '..xx...........^^^.....pp..',
        '...............^^^.........'],
      dogs: [{ turn: 30 }, { turn: 30, phase: 0.5 }], rugs: [[6, 8, 12, 12, '#5C7FC4']] },
    { // 17: a floor full of squeaky toys
      map: [
        'bbbbbbbbbbbb...........vvv....',
        '.......................vvv....',
        '...vvv......k..........vvv....',
        '...vvv...........k............',
        '...vvv.....xx.......f.........',
        '...........xx...........k.....',
        '.c....k..........ssss......G..',
        '.................ssss.........',
        '.......k.....f............aa..',
        '..pp..........k...........aa..',
        '..pp......tttt.......k........',
        '..........tttt................',
        '...................^^^....pp..',
        'pp.......k.........^^^....pp..',
        'pp.................^^^........'],
      rugs: [[13, 9, 20, 13, '#E0A458']] },
    { // 18: three rooms
      say: 'Level 18: three rooms!',
      map: [
        'bbbbbbbb....##..........##...........',
        '............##..vvv.....##.....<<<...',
        '....vvv.....##..vvv.....##.....<<<...',
        '....vvv.....##..vvv.....##.....<<<...',
        '....vvv.....##..........##...........',
        '............##.....xx...##...f.......',
        '.c...aa.....##.....xx...##.....tttt..',
        '.....aa.............................',
        '.....................................',
        '..f.........##..........##..oo.......',
        '............##.ssss.....##..oo....G..',
        '.......ssss.##.ssss..f..##...........',
        '.......ssss.##..........##.....^^^...',
        'pp..........##..........##.....^^^...',
        'pp..........##..........##.....^^^...'],
      dogs: [{}, { turn: 30 }, {}, {}], rugs: [[1, 9, 8, 14, '#6FAE8E'], [27, 4, 35, 9, '#C77DA0']] },
    { // 19: two dogs walking, one asleep
      map: [
        '................................',
        '..pp.....w.................f....',
        '..pp.............bbbbbbb........',
        '........................vvv.....',
        '........................vvv.....',
        '.......aa.....xx........vvv.....',
        '.c.....aa.....xx..............G.',
        '................................',
        '..........f............aa.......',
        '.....................w.aa.......',
        '...xx...........ssss............',
        '...xx...........ssss............',
        '................................',
        'bbbbbbbbbb..............bbbbbbbb'],
      dogs: [{ path: [[9, 1], [9, 12]], pause: 1.2 }, { path: [[21, 9], [21, 12], [28, 12], [28, 9]], pause: 0.8 }, { turn: 25 }], rugs: [[10, 6, 16, 10, '#5C7FC4']] },
    { // 20: the big night
      say: 'The last room. The sneakiest cat in town!',
      map: [
        'bbbbbbbbbb.....##.................',
        '...............##.vvv.......>>>...',
        '..>>>..........##.vvv.......>>>...',
        '..>>>....k.....##.vvv.......>>>...',
        '..>>>..........##.................',
        '...........xx..##......xx.....f...',
        '.c...aa....xx..........xx.........',
        '.....aa..............w............',
        '...............##.........tttt....',
        '...f.....oo....##..k......tttt....',
        '.........oo....##.................',
        '...k...........##..ssss.......G...',
        'pp.....ssss....##..ssss...........',
        'pp.....ssss....##..........^^^....',
        '...............##....f.....^^^....',
        '...............##..........^^^....'],
      dogs: [{ turn: 30 }, {}, {}, { path: [[22, 7], [22, 10], [25, 10]], pause: 1 }, {}], rugs: [[3, 12, 12, 15, '#C77DA0'], [24, 3, 32, 9, '#6FAE8E']] }
  ];


  /* how long the dogs nap, warn and look: shorter naps and longer looks as the levels go on */
  function timing(n) {
    return { sleep: [Math.max(2.4, 5.2 - n * 0.14), Math.max(3.4, 7 - n * 0.18)], warn: Math.max(0.8, 1.5 - n * 0.035),
      look: [Math.min(2.6, 1.7 + n * 0.05), Math.min(3.4, 2.5 + n * 0.05)] };
  }
  var DOG_COLS = [
    { body: '#C98B5B', dark: '#9A6440', ear: '#7E4E30', muzzle: '#E6B98A' },
    { body: '#EBD7B0', dark: '#CDB281', ear: '#B8925E', muzzle: '#FFF1DC' },
    { body: '#9C97AE', dark: '#77728C', ear: '#5C5874', muzzle: '#C9C2D6' },
    { body: '#5A5274', dark: '#3E3858', ear: '#2E2846', muzzle: '#8E86A0' },
    { body: '#FFFFFF', dark: '#DCD6E6', ear: '#4A4262', muzzle: '#FFFFFF', spots: true }
  ];
  var SOFA_COLS = ['#7C8FD6', '#C77DA0', '#6FAE8E', '#E0A458'];
  var BED_COLS = ['#B05F7C', '#5C7FC4', '#6FAE8E', '#C9935E'];

  var CAT_SIZE = 46, CAT_K = CAT_SIZE / 88, CAT_R = 16, SPEED = 165, BACK = 520, GRACE = 0.28;
  var HALF = 30 * Math.PI / 180, RANGE = 480, WALK = 55, SG = 20;

  function parse(n) {
    var def = LEVELS[n - 1], H = def.map.length, Wc = Math.max.apply(null, def.map.map(function (r) { return r.length; }));
    var rows = def.map.map(function (r) { while (r.length < Wc) r += '.'; return r; });   // short rows end in floor
    var L = { n: n, def: def, cols: Wc, rows: H, W: Wc * CELL, H: H * CELL, furn: [], walls: [], dogs: [], fish: [], toys: [],
      moveB: [], sightB: [], rugs: def.rugs || [], tm: timing(n) };
    for (var k in (def.timing || {})) L.tm[k] = def.timing[k];
    var used = rows.map(function (r) { return r.split('').map(function () { return false; }); });
    function ch(c, r) { return r >= 0 && r < H && c >= 0 && c < Wc ? rows[r].charAt(c) : ''; }
    var dogDefs = def.dogs || [], di = 0, fi = 0, seed = n * 31;
    for (var r = 0; r < H; r++) for (var c = 0; c < Wc; c++) {
      var t = ch(c, r), cx = (c + 0.5) * CELL, cy = (r + 0.5) * CELL;
      if (t === 'c') L.start = { x: cx, y: cy };
      else if (t === 'G') L.goal = { x: cx, y: cy };
      else if (t === 'f') L.fish.push({ x: cx, y: cy, got: false, i: fi++ });
      else if (t === 'k') L.toys.push({ x: cx, y: cy, wob: 0, inside: false, a: (seed++ % 5) * 0.7 });
      else if (t === 'w') {
        var wd = dogDefs[di++] || {};
        L.dogs.push(makeDog({ walk: true, x: cx, y: cy, path: (wd.path || [[c, r]]).map(function (q) { return { x: (q[0] + 0.5) * CELL, y: (q[1] + 0.5) * CELL }; }), o: wd, i: L.dogs.length }));
      } else if ('sabtopxl#<>^v'.indexOf(t) >= 0 && !used[r][c]) {
        // the biggest box of this letter starting here
        var w = 1, h = 1;
        while (ch(c + w, r) === t && !used[r][c + w]) w++;
        grow: while (r + h < H) { for (var q = c; q < c + w; q++) if (ch(q, r + h) !== t || used[r + h][q]) break grow; h++; }
        for (var yy = r; yy < r + h; yy++) for (var xx = c; xx < c + w; xx++) used[yy][xx] = true;
        var rect = { x: c * CELL, y: r * CELL, w: w * CELL, h: h * CELL };
        if ('<>^v'.indexOf(t) >= 0) {
          var dd = dogDefs[di++] || {}, a = { '>': 0, 'v': Math.PI / 2, '<': Math.PI, '^': -Math.PI / 2 }[t];
          L.dogs.push(makeDog({ bed: rect, x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, a: a, o: dd, i: L.dogs.length }));
          L.moveB.push({ e: true, x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, rx: rect.w / 2 - 4, ry: rect.h / 2 - 4 });
        } else {
          var kind = { s: 'sofa', a: 'armchair', t: 'table', o: 'round', b: 'bookshelf', p: 'plant', x: 'box', l: 'lamp', '#': 'wall' }[t];
          var f = { kind: kind, x: rect.x, y: rect.y, w: rect.w, h: rect.h, seed: seed++ };
          if (kind === 'sofa' || kind === 'armchair') {
            f.back = rect.w >= rect.h ? (rect.y + rect.h / 2 < L.H / 2 ? 'top' : 'bottom') : (rect.x + rect.w / 2 < L.W / 2 ? 'left' : 'right');
            if (def.backs && def.backs[L.furn.filter(function (q) { return q.kind === 'sofa' || q.kind === 'armchair'; }).length]) f.back = { t: 'top', b: 'bottom', l: 'left', r: 'right' }[def.backs[L.furn.filter(function (q) { return q.kind === 'sofa' || q.kind === 'armchair'; }).length]];
            f.col = SOFA_COLS[(f.seed * 7) % SOFA_COLS.length];
          }
          if (kind === 'wall') L.walls.push(f); else L.furn.push(f);
          // round things block as circles, the rest as boxes
          var round = kind === 'plant' || kind === 'round' || kind === 'lamp';
          var b = round ? { e: true, x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, rx: Math.min(rect.w, rect.h) * (kind === 'plant' ? 0.44 : 0.5), ry: Math.min(rect.w, rect.h) * (kind === 'plant' ? 0.44 : 0.5) } : { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
          L.moveB.push(b); L.sightB.push(b);
        }
      }
    }
    L.dogs.forEach(function (d, i) { d.col = DOG_COLS[(n * 3 + i * 2) % DOG_COLS.length]; d.bedCol = BED_COLS[(n + i) % BED_COLS.length]; });
    buildGrids(L);
    return L;
  }
  function makeDog(s) {
    var o = s.o || {};
    var d = { walk: !!s.walk, x: s.x, y: s.y, bed: s.bed || null, a0: s.a || 0, a: s.a || 0, turn: (o.turn || 0) * Math.PI / 180,
      range: o.range || (s.walk ? 300 : RANGE), half: (o.half || (s.walk ? 28 : 30)) * Math.PI / 180, i: s.i, phase: o.phase || 0 };
    if (d.bed) {
      // the shared curled-up dog (GGThings, top view) is about 190 across in its bed; its head sits at (-30, 10)
      // with its face pointing down (+y) before it's turned to face a0
      d.size = Math.min(d.bed.w, d.bed.h) / 190;
      var t = d.a0 - Math.PI / 2, hx = -30 * d.size, hy = 10 * d.size;
      d.eye = { x: d.x + hx * Math.cos(t) - hy * Math.sin(t), y: d.y + hx * Math.sin(t) + hy * Math.cos(t) };
    }
    if (d.walk) {
      d.path = s.path; d.size = 0.95; d.legs = [];
      // the walk: there and back along the path, with a sniff and a turn at each end
      // a path that ends where it starts is walked round and round; any other there and back
      var loop = d.path.length > 2 && d.path[0].x === d.path[d.path.length - 1].x && d.path[0].y === d.path[d.path.length - 1].y;
      var pts = loop ? d.path.slice() : d.path.concat(d.path.slice(0, -1).reverse()), t = 0;
      if (pts.length < 2) pts = [d.path[0], d.path[0]];
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i], p1 = pts[i + 1], len = Math.hypot(p1.x - p0.x, p1.y - p0.y), a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        if (len > 1) { d.legs.push({ t0: t, t1: t + len / WALK, p0: p0, p1: p1, a: a }); t += len / WALK; }
      }
      // pauses where the path turns round (each end) and at corners
      var legs = [], tt = 0;
      d.legs.forEach(function (lg, j) {
        var dur = lg.t1 - lg.t0; legs.push({ t0: tt, t1: tt + dur, p0: lg.p0, p1: lg.p1, a: lg.a }); tt += dur;
        var nx = d.legs[(j + 1) % d.legs.length], turnBy = Math.abs(angDiff(lg.a, nx.a));
        var pause = turnBy > 2.5 ? (o.pause || 1.4) : turnBy > 0.3 ? 0.5 : 0;
        if (pause) { legs.push({ t0: tt, t1: tt + pause, p0: lg.p1, p1: lg.p1, a: lg.a, a1: lg.a + angDiff(lg.a, nx.a), pause: true }); tt += pause; }
      });
      d.legs = legs; d.cycle = tt || 1;
    }
    return d;
  }
  /* where a walking dog is at time t on its own clock */
  function walkPose(d, t) {
    t = ((t % d.cycle) + d.cycle) % d.cycle;
    for (var i = 0; i < d.legs.length; i++) {
      var lg = d.legs[i];
      if (t <= lg.t1 || i === d.legs.length - 1) {
        var k = clamp((t - lg.t0) / Math.max(0.001, lg.t1 - lg.t0), 0, 1);
        if (lg.pause) { var e = k < 0.35 ? 0 : (k - 0.35) / 0.65; e = e * e * (3 - 2 * e); return { x: lg.p0.x, y: lg.p0.y, a: lerp(lg.a, lg.a1, e), moving: false }; }
        return { x: lerp(lg.p0.x, lg.p1.x, k), y: lerp(lg.p0.y, lg.p1.y, k), a: lg.a, moving: true };
      }
    }
    return { x: d.x, y: d.y, a: d.a, moving: false };
  }
  var WALK_SIZE = 0.72;
  function walkEye(p) { return { x: p.x + Math.cos(p.a) * 48 * WALK_SIZE, y: p.y + Math.sin(p.a) * 48 * WALK_SIZE }; }

  /* ================= geometry: who can see what, and where the cat fits ================= */
  // does the segment (x0,y0)-(x1,y1) pass through blocker b?
  function segHits(b, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    if (b.e) {
      // a circle (or ellipse, scaled to a circle)
      var sx = 1 / b.rx, sy = 1 / b.ry, ax = (x0 - b.x) * sx, ay = (y0 - b.y) * sy, ex = dx * sx, ey = dy * sy;
      var A = ex * ex + ey * ey, B = 2 * (ax * ex + ay * ey), C = ax * ax + ay * ay - 1;
      if (C < 0) return 0;
      var disc = B * B - 4 * A * C; if (disc < 0 || A < 1e-9) return -1;
      var t = (-B - Math.sqrt(disc)) / (2 * A);
      return t >= 0 && t <= 1 ? t : -1;
    }
    var t0 = 0, t1 = 1, p = [-dx, dx, -dy, dy], q = [x0 - b.x, b.x + b.w - x0, y0 - b.y, b.y + b.h - y0];
    for (var i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) return -1; continue; }
      var r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return -1; if (r > t0) t0 = r; } else { if (r < t0) return -1; if (r < t1) t1 = r; }
    }
    return t0;
  }
  function clearLine(x0, y0, x1, y1) {
    for (var i = 0; i < L.sightB.length; i++) if (segHits(L.sightB[i], x0, y0, x1, y1) >= 0) return false;
    return true;
  }
  // can a dog looking from eye along angle a see the point (x, y)?
  function seesFrom(eye, a, range, half, x, y) {
    var dx = x - eye.x, dy = y - eye.y, dd = Math.hypot(dx, dy);
    if (dd > range) return false;
    if (dd > 6 && Math.abs(angDiff(a, Math.atan2(dy, dx))) > half) return false;
    return clearLine(eye.x, eye.y, x, y);
  }
  function dogEye(d) { return d.walk ? walkEye(d.pose) : d.eye; }
  // what a dog could ever see from where it is (its head sweeping, or all along its walk): for safe spots
  function couldSee(d, x, y) {
    if (d.walk) {
      for (var i = 0; i < d.samples.length; i++) { var p = d.samples[i]; if (Math.hypot(x - p.x, y - p.y) < 70 || seesFrom(walkEye(p), p.a, d.range, d.half, x, y)) return true; }
      return false;
    }
    return seesFrom(d.eye, d.a0, d.range, d.half + d.turn, x, y);
  }
  function blockedAt(x, y, r) {
    if (x < r || y < r || x > L.W - r || y > L.H - r) return true;
    for (var i = 0; i < L.moveB.length; i++) {
      var b = L.moveB[i];
      if (b.e) { var nx = (x - b.x) / (b.rx + r), ny = (y - b.y) / (b.ry + r); if (nx * nx + ny * ny < 1) return true; }
      else if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) {
        var qx = clamp(x, b.x, b.x + b.w), qy = clamp(y, b.y, b.y + b.h);
        if (Math.hypot(x - qx, y - qy) < r) return true;
      }
    }
    return false;
  }
  function buildGrids(L0) {
    var keep = L; L = L0;
    var gw = Math.round(L.W / SG), gh = Math.round(L.H / SG);
    L.gw = gw; L.gh = gh; L.free = new Uint8Array(gw * gh); L.safe = new Uint8Array(gw * gh);
    L.dogs.forEach(function (d) {
      if (!d.walk) return;
      d.samples = []; for (var t = 0; t < d.cycle; t += 0.2) d.samples.push(walkPose(d, t));
    });
    for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
      var x = (i + 0.5) * SG, y = (j + 0.5) * SG, k = j * gw + i;
      L.free[k] = blockedAt(x, y, CAT_R + 2) ? 0 : 1;
      // safe only if no dog could see any part of the square (its middle and corners)
      L.safe[k] = L.dogs.some(function (d) { return [[0, 0], [-9, -9], [9, -9], [-9, 9], [9, 9]].some(function (o) { return couldSee(d, x + o[0], y + o[1]); }); }) ? 0 : 1;
    }
    L = keep;
  }
  function cellOf(x, y) { return { i: clamp(Math.floor(x / SG), 0, L.gw - 1), j: clamp(Math.floor(y / SG), 0, L.gh - 1) }; }
  function isSafe(x, y) { var q = cellOf(x, y); return !!L.safe[q.j * L.gw + q.i]; }
  function isFree(x, y) { var q = cellOf(x, y); return !!L.free[q.j * L.gw + q.i]; }
  // the path from (x0,y0) to (x1,y1), round the furniture (A* on the 20-unit grid), as points to walk through
  function findPath(x0, y0, x1, y1, avoid) {
    var gw = L.gw, gh = L.gh, s = cellOf(x0, y0), e = cellOf(x1, y1);
    var ok = function (i, j) { var k = j * gw + i; return L.free[k] && !(avoid && avoid[k]); };
    if (!ok(e.i, e.j)) {
      // aiming at furniture: the nearest open floor to it
      var best = null, bd = 1e9;
      for (var rr = 1; rr < 12 && !best; rr++) for (var dj = -rr; dj <= rr; dj++) for (var di = -rr; di <= rr; di++) {
        var ii = e.i + di, jj = e.j + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh || !ok(ii, jj)) continue;
        var dd = Math.hypot((ii + 0.5) * SG - x1, (jj + 0.5) * SG - y1); if (dd < bd) { bd = dd; best = { i: ii, j: jj }; }
      }
      if (!best) return null; e = best; x1 = (e.i + 0.5) * SG; y1 = (e.j + 0.5) * SG;
    }
    var N = gw * gh, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [];
    var sk = s.j * gw + s.i, ek = e.j * gw + e.i;
    g[sk] = 0; open.push([0, sk]);
    function h(k) { var dx = Math.abs(k % gw - e.i), dy = Math.abs(Math.floor(k / gw) - e.j); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); }
    while (open.length) {
      // a small heap would be quicker; the grid is small enough for a sorted pick
      var bi = 0; for (var q = 1; q < open.length; q++) if (open[q][0] < open[bi][0]) bi = q;
      var cur = open[bi][1]; open[bi] = open[open.length - 1]; open.pop();
      if (closed[cur]) continue; closed[cur] = 1;
      if (cur === ek) break;
      var ci = cur % gw, cj = (cur - ci) / gw;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var ni = ci + dx, nj = cj + dy; if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
        if (!ok(ni, nj) && !(cur === sk && false)) continue;
        if (dx && dy && (!ok(ci + dx, cj) || !ok(ci, cj + dy))) continue;
        var nk = nj * gw + ni, ng = g[cur] + (dx && dy ? 1.414 : 1);
        if (ng < g[nk]) { g[nk] = ng; from[nk] = cur; open.push([ng + h(nk), nk]); }
      }
    }
    if (from[ek] < 0 && ek !== sk) return null;
    var cells = [], k2 = ek; while (k2 >= 0 && k2 !== sk) { cells.push(k2); k2 = from[k2]; }
    cells.reverse();
    var pts = cells.map(function (k) { return { x: (k % gw + 0.5) * SG, y: (Math.floor(k / gw) + 0.5) * SG }; });
    if (pts.length) pts[pts.length - 1] = { x: x1, y: y1 }; else pts.push({ x: x1, y: y1 });
    return pts;
  }
  function walkable(x0, y0, x1, y1) {
    var n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
    for (var i = 1; i <= n; i++) if (blockedAt(lerp(x0, x1, i / n), lerp(y0, y1, i / n), CAT_R)) return false;
    return true;
  }
  // straighten a grid path: skip ahead to the furthest point the cat can walk to in a straight line
  function smooth(x, y, pts) {
    var out = [], cx = x, cy = y, i = 0;
    while (i < pts.length) {
      var j = pts.length - 1;
      while (j > i && !walkable(cx, cy, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]); cx = pts[j].x; cy = pts[j].y; i = j + 1;
    }
    return out;
  }
  // push a circle out of the furniture and walls
  function collide(p) {
    for (var it = 0; it < 3; it++) {
      L.moveB.forEach(function (b) {
        if (b.e) {
          var dx = p.x - b.x, dy = p.y - b.y, nx = dx / (b.rx + CAT_R), ny = dy / (b.ry + CAT_R), d = Math.hypot(nx, ny);
          if (d < 1 && d > 1e-6) { p.x = b.x + dx / d; p.y = b.y + dy / d; }
        } else {
          var qx = clamp(p.x, b.x, b.x + b.w), qy = clamp(p.y, b.y, b.y + b.h), ex = p.x - qx, ey = p.y - qy, dd = Math.hypot(ex, ey);
          if (dd < CAT_R) {
            if (dd > 1e-6) { p.x = qx + ex / dd * CAT_R; p.y = qy + ey / dd * CAT_R; }
            else {
              // inside: out the nearest side
              var l = p.x - b.x, r = b.x + b.w - p.x, t = p.y - b.y, bo = b.y + b.h - p.y, m = Math.min(l, r, t, bo);
              if (m === l) p.x = b.x - CAT_R; else if (m === r) p.x = b.x + b.w + CAT_R; else if (m === t) p.y = b.y - CAT_R; else p.y = b.y + b.h + CAT_R;
            }
          }
        }
      });
      p.x = clamp(p.x, CAT_R, L.W - CAT_R); p.y = clamp(p.y, CAT_R, L.H - CAT_R);
    }
  }

  /* ================= state ================= */
  var L = null, G = null;   // the level, and this go at it
  var state = 'card';       // 'card' | 'play' | 'won'
  function newGo() {
    G = { cat: { x: L.start.x, y: L.start.y, dir: 1, step: 0, moving: false }, route: null, mode: 'play', check: { x: L.start.x, y: L.start.y },
      trail: [], spotted: 0, got: 0, safe: true, seenK: 0, eatT: 0, parts: [], pops: [], shake: 0, lastStepT: 0, auto: null };
    L.dogs.forEach(function (d, i) {
      if (d.walk) { d.clock = d.phase * d.cycle; d.st = 'walk'; d.bark = 0; d.pose = walkPose(d, d.clock); d.a = d.pose.a; d.seen = 0; d.step = 0; return; }
      d.st = 'sleep'; d.t = 0; d.dur = rand(L.tm.sleep[0], L.tm.sleep[1]) + (i === 0 ? 1 : rand(0, 1.6)); d.seen = 0; d.snore = rand(0, 2); d.a = d.a0; d.lookT = 0;
    });
    L.fish.forEach(function (f) { f.got = false; });
    L.toys.forEach(function (k) { k.wob = 0; k.inside = false; });
    camSnap = true;
  }
  function lastLevel() { return Math.min(P.best, LEVELS.length); }
  function loadLevel(n) {
    n = clamp(n, 1, lastLevel());
    P.cur = n; save();
    L = parse(n); newGo();
    $('levelLabel').textContent = 'Level ' + n;
    $('prevBtn').disabled = n <= 1; $('nextBtn').disabled = n >= lastLevel();
    layout();
    track('Start level', { game: 'sneaky', level: n });
  }

  /* ================= input ================= */
  var canvas = $('stage'), keys = {}, hold = null;
  function setTarget(x, y) {
    var C = G.cat, pts = findPath(C.x, C.y, x, y);
    G.route = pts ? smooth(C.x, C.y, pts) : null;
  }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init(); e.preventDefault();
    if (state !== 'play' || !G || G.mode !== 'play') return;
    // lead the cat with your finger: it walks (at its own speed, round the furniture) to wherever your finger is.
    // Lift your finger and it stops, unless it was a quick tap, which sends it walking to that spot.
    hold = { id: e.pointerId, t: performance.now(), x: e.clientX, y: e.clientY, moved: false, at: 0 };
    var p = toLevel(e.clientX, e.clientY); hold.tx = p.x; hold.ty = p.y; setTarget(p.x, p.y);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!hold || hold.id !== e.pointerId || !G) return;
    if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 12) hold.moved = true;
    var p = toLevel(e.clientX, e.clientY); hold.tx = p.x; hold.ty = p.y; hold.dirty = true;
  });
  function release(e) {
    if (!hold || hold.id !== e.pointerId) return;
    var tap = !hold.moved && performance.now() - hold.t < 300;
    if (!tap && G && G.mode === 'play') G.route = null;
    hold = null;
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  var KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
  window.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && state === 'card' && !$('cardWrap').hidden) { e.preventDefault(); $('goBtn').click(); return; }
    var k = KEYMAP[e.key]; if (k && state === 'play') { keys[k] = true; e.preventDefault(); Sound.init(); if (G) G.route = null; }
  });
  window.addEventListener('keyup', function (e) { var k = KEYMAP[e.key]; if (k) keys[k] = false; });
  window.addEventListener('blur', function () { keys = {}; hold = null; });

  function startPlay() { hideCard(); state = 'play'; levelSay(); }
  $('prevBtn').addEventListener('click', function () { Sound.init(); Sound.click(); loadLevel(L.n - 1); startPlay(); });
  $('nextBtn').addEventListener('click', function () { Sound.init(); Sound.click(); loadLevel(L.n + 1); startPlay(); });
  $('resetBtn').addEventListener('click', function () { Sound.init(); Sound.click(); newGo(); hideCard(); state = 'play'; });
  $('goBtn').addEventListener('click', function () {
    Sound.init(); Sound.click();
    if (cardMode === 'won') loadLevel(L.n >= LEVELS.length ? 1 : L.n + 1);
    startPlay();
  });
  $('againBtn').addEventListener('click', function () { Sound.init(); Sound.click(); newGo(); hideCard(); state = 'play'; });

  /* ================= playing ================= */
  function update(dt) {
    if (!L || !G) return;
    sayT -= dt; if (sayT <= 0 && !$('say').classList.contains('hide')) $('say').classList.add('hide');
    updateParts(dt);
    if (state === 'won') { G.eatT += dt; if (G.eatT > 1.7 && !G.carded) { G.carded = true; showCard('won'); } return; }
    if (state !== 'play') return;
    L.dogs.forEach(function (d) { updateDog(d, dt); });
    L.toys.forEach(function (k) { k.wob = Math.max(0, k.wob - dt * 2.5); });
    G.shake = Math.max(0, G.shake - dt * 3);
    var C = G.cat;
    if (G.mode === 'run') {
      // scurrying back the way it came, to the last safe spot
      var goal = G.trail.length ? G.trail[G.trail.length - 1] : G.check;
      var dx = goal.x - C.x, dy = goal.y - C.y, dd = Math.hypot(dx, dy), stepL = BACK * dt;
      if (dd <= stepL) { C.x = goal.x; C.y = goal.y; if (G.trail.length) G.trail.pop(); else { G.mode = 'play'; G.route = null; } }
      else { C.x += dx / dd * stepL; C.y += dy / dd * stepL; }
      if (Math.abs(dx) > 2) C.dir = viewDir(dx, dy);
      C.step += dt * 26; C.moving = true;
      if (Math.random() < dt * 20) Sound.patter();
      return;
    }
    if (hold && hold.dirty && time - (hold.at || 0) > 0.12) { hold.dirty = false; hold.at = time; setTarget(hold.tx, hold.ty); }
    // walking: keys go straight; a finger walks the route round the furniture
    var kx = 0, ky = 0;
    if (keys.left) kx -= 1; if (keys.right) kx += 1; if (keys.up) ky -= 1; if (keys.down) ky += 1;
    var vx = 0, vy = 0, ox = C.x, oy = C.y;
    if (kx || ky) { var lv = keyToLevel(kx, ky), ll = Math.hypot(lv.x, lv.y); vx = lv.x / ll * SPEED; vy = lv.y / ll * SPEED; }
    else if (G.route && G.route.length) {
      var w0 = G.route[0], tx = w0.x - C.x, ty = w0.y - C.y, td = Math.hypot(tx, ty);
      if (td < 3) { G.route.shift(); if (!G.route.length) G.route = null; }
      else { var sp = Math.min(SPEED, td / dt); vx = tx / td * sp; vy = ty / td * sp; }
    }
    C.x += vx * dt; C.y += vy * dt;
    collide(C);
    var mdx = C.x - ox, mdy = C.y - oy, moved = Math.hypot(mdx, mdy);
    C.moving = moved > SPEED * dt * 0.25;
    if (C.moving) {
      C.step += dt * 14;
      var vd = viewDir(mdx, mdy); if (vd) C.dir = vd;
      if (time - G.lastStepT > 0.3) { G.lastStepT = time; Sound.step(); }
    }
    // squeaky toys: step on one and the nearest sleeping dog stirs straight away
    L.toys.forEach(function (k) {
      var on = Math.hypot(C.x - k.x, C.y - k.y) < 26;
      if (on && !k.inside) {
        k.wob = 1; Sound.squeak(); buzz(20);
        G.pops.push({ x: k.x, y: k.y - 30, t: 0, txt: 'SQUEAK!' });
        var near = null, nd = 1e9;
        L.dogs.forEach(function (d) { if (d.walk || d.st !== 'sleep' && d.st !== 'settle') return; var q = Math.hypot(d.x - k.x, d.y - k.y); if (q < nd) { nd = q; near = d; } });
        if (near) { near.st = 'stir'; near.t = 0; near.dur = Math.max(0.6, L.tm.warn * 0.7); Sound.stir(); }
      }
      k.inside = on;
    });
    // fish
    L.fish.forEach(function (f) {
      if (f.got || Math.hypot(f.x - C.x, f.y - C.y) > 32) return;
      f.got = true; G.got++; Sound.fish();
      for (var i = 0; i < (reduceMotion ? 3 : 7); i++) G.parts.push({ x: f.x, y: f.y - 10, vx: rand(-110, 110), vy: rand(-170, -50), life: 0, max: 0.5, r: rand(4, 7), col: '#BFE6FF' });
    });
    // safe here? (then it's the spot to scurry back to)
    G.safe = isSafe(C.x, C.y);
    if (G.safe) { G.check = { x: C.x, y: C.y }; G.trail = []; }
    else { var lt = G.trail[G.trail.length - 1] || G.check; if (Math.hypot(lt.x - C.x, lt.y - C.y) > 12) G.trail.push({ x: C.x, y: C.y }); }
    // spotted? A looking dog has to see you for a moment (a quick graze of the glow is let off)
    G.seenK = 0;
    for (var i = 0; i < L.dogs.length; i++) {
      var d = L.dogs[i], looking = d.walk ? d.bark <= 0 : d.st === 'look';
      var bump = d.walk && Math.hypot(C.x - d.pose.x, C.y - d.pose.y) < 52;
      if ((looking && seesFrom(dogEye(d), d.a, d.range, d.half, C.x, C.y)) || bump) {
        d.seen += dt * (bump ? 10 : 1); G.seenK = Math.max(G.seenK, d.seen / GRACE);
        if (d.seen > GRACE) { spotted(d); return; }
      } else d.seen = Math.max(0, d.seen - dt * 2);
    }
    if (Math.hypot(C.x - L.goal.x, C.y - L.goal.y) < 34) win();
  }
  function updateDog(d, dt) {
    if (d.walk) {
      if (d.bark > 0) { d.bark -= dt; return; }
      d.clock += dt; d.pose = walkPose(d, d.clock); d.a = d.pose.a; if (d.pose.moving) d.step += dt * 9;
      return;
    }
    d.t += dt;
    if (d.st === 'sleep') {
      d.snore -= dt; if (d.snore <= 0) { d.snore = 2.4; Sound.snore(); }
      if (d.t >= d.dur) { d.st = 'stir'; d.t = 0; d.dur = L.tm.warn; Sound.stir(); }
    } else if (d.st === 'stir') {
      if (d.t >= d.dur) { d.st = 'look'; d.t = 0; d.dur = rand(L.tm.look[0], L.tm.look[1]); d.lookT = 0; }
    } else if (d.st === 'look') {
      d.lookT += dt;
      if (d.t >= d.dur) { d.st = 'settle'; d.t = 0; d.dur = 0.6; }
    } else if (d.st === 'bark') {
      if (d.t >= d.dur) { d.st = 'settle'; d.t = 0; d.dur = 0.8; }
    } else if (d.st === 'settle') {
      if (d.t >= d.dur) { d.st = 'sleep'; d.t = 0; d.dur = rand(L.tm.sleep[0], L.tm.sleep[1]); }
    }
    // a dog that turns its head sweeps slowly from side to side while it looks, and turns back as it settles
    if (d.turn) {
      var want = d.st === 'look' || d.st === 'bark' ? d.a0 + d.turn * Math.sin(d.lookT * TAU / 3.4 + d.phase * TAU) : d.a0;
      d.a += angDiff(d.a, want) * Math.min(1, dt * (d.st === 'look' ? 20 : 4));
    }
  }
  function spotted(d) {
    if (window.__sneakLog) window.__sneakLog.push({ x: Math.round(G.cat.x), y: Math.round(G.cat.y), dog: d.i, walk: d.walk, st: d.st });
    G.spotted++; G.mode = 'run'; G.route = null; G.shake = reduceMotion ? 0 : 1; hold = null;
    L.dogs.forEach(function (q) { q.seen = 0; });
    if (d.walk) d.bark = 1.3; else { d.st = 'bark'; d.t = 0; d.dur = 1.3; }
    Sound.woof(); buzz([40, 40, 60]);
    var e = dogEye(d);
    G.pops.push({ x: e.x, y: e.y - 40, t: 0, txt: 'WOOF!', big: true });
    say(G.spotted === 1 ? 'Spotted! Back to the last safe spot…' : 'Woof! Back you go…', 1.8);
    track('Spotted', { game: 'sneaky', level: L.n });
  }
  function win() {
    state = 'won'; G.eatT = 0; G.carded = false; G.route = null; hold = null;
    var stars = 1 + (G.got >= L.fish.length ? 1 : 0) + (G.spotted === 0 ? 1 : 0);
    G.stars = stars;
    var prev = P.stars[L.n] || 0;
    if (stars > prev) P.stars[L.n] = stars;
    G.newBest = stars > prev && prev > 0;
    if (L.n >= P.best) P.best = L.n + 1;
    save();
    Sound.win(); buzz(25);
    for (var i = 0; i < (reduceMotion ? 5 : 14); i++) G.parts.push({ x: L.goal.x, y: L.goal.y - 40, vx: rand(-160, 160), vy: rand(-280, -80), life: 0, max: 0.9, r: rand(5, 9), col: ['#FFD23F', '#FF8FAB', '#7CC4FF'][i % 3] });
    track('Finish level', { game: 'sneaky', level: L.n, stars: stars, spotted: Math.min(G.spotted, 10) });
    if (GG.stat) GG.stat('sneaky', 'levels', 1);
  }
  function updateParts(dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) { var p = G.parts[i]; p.life += dt; if (p.life > p.max) { G.parts.splice(i, 1); continue; } p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (var j = G.pops.length - 1; j >= 0; j--) { G.pops[j].t += dt; if (G.pops[j].t > 1.1) G.pops.splice(j, 1); }
  }

  /* ================= messages and cards ================= */
  var sayT = 0;
  function say(t, s) { var el = $('say'); el.textContent = t; el.classList.remove('hide'); sayT = s || 2.2; }
  function levelSay() { say(L.def.say || 'Level ' + L.n, L.def.say ? 3.2 : 1.6); }
  var cardMode = 'intro';
  function showCard(mode) {
    cardMode = mode; hold = null; keys = {};
    $('againBtn').hidden = mode !== 'won';
    if (mode === 'won') {
      var all = L.n >= LEVELS.length;
      $('cardTitle').textContent = all ? 'Every room done!' : G.stars === 3 ? 'Purr-fectly sneaky!' : 'Snack time!';
      var bits = [];
      if (L.fish.length) bits.push(G.got >= L.fish.length ? 'every fish' : G.got + ' of ' + L.fish.length + ' fish');
      bits.push(G.spotted ? 'spotted ' + G.spotted + (G.spotted === 1 ? ' time' : ' times') : 'never spotted');
      $('cardNote').textContent = 'Level ' + L.n + ' done: ' + bits.join(', ') + '.';
      $('cardTip').textContent = G.stars < 3 ? (G.spotted ? 'For three stars, don’t get spotted at all.' : 'For three stars, get every fish too.') : (G.newBest ? 'Three stars on this one now!' : all ? 'What a sneaky cat. Try for three stars in every room!' : '');
      $('goBtn').textContent = all ? 'Level 1' : 'Level ' + (L.n + 1);
    } else {
      $('cardTitle').textContent = 'Sneaky Cat';
      $('cardNote').textContent = 'Sneak past the sleeping dogs to your midnight snack.';
      $('cardTip').textContent = 'Press and hold where you want to go. When a dog’s ear goes up, hide behind the furniture!';
      $('goBtn').textContent = P.best > 1 ? 'Play level ' + L.n : 'Sneak!';
    }
    drawCardPic(mode === 'won' ? G.stars : 0);
    $('cardWrap').hidden = false;
    try { $('goBtn').focus({ preventScroll: true }); } catch (e) {}
  }
  function hideCard() { $('cardWrap').hidden = true; }

  /* ================= the view =================
     Everything is worked out in level units (the cat walks left to right). On a screen taller than it is wide the
     room is turned a quarter so the cat walks up the screen: V() takes a level point to the view, and each piece is
     then drawn the right way up there, so the light still comes from the top left. */
  var ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, rot = false, VW = 1000, VH = 600, camX = 0, camY = 0, camSnap = true, topGap = 70;
  var EDGE = 26;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    if (!L) return;
    topGap = $('topbar').getBoundingClientRect().bottom || 70;
    var top = topGap + 6, aw = cw - 16, ah = Math.max(120, ch - top - 10);
    rot = aw < ah * 0.95;
    VW = (rot ? L.H : L.W) + EDGE * 2; VH = (rot ? L.W : L.H) + EDGE * 2;
    var kFit = Math.min(aw / VW, ah / VH);
    // a short screen (a phone on its side): a little bigger than fitting it all, with the view following the cat
    var kLong = rot ? ah / VH : aw / VW;
    K = kFit < 0.55 ? Math.max(kFit, Math.min(kLong, kFit * 1.35)) : kFit;
    OX = 8 + Math.max(0, (aw - VW * K) / 2); OY = top + Math.max(0, (ah - VH * K) / 2);
    viewW = Math.min(aw, VW * K); viewH = Math.min(ah, VH * K);
    camSnap = true;
  }
  var viewW = 0, viewH = 0;
  function V(x, y) { return rot ? { x: y + EDGE, y: L.W - x + EDGE } : { x: x + EDGE, y: y + EDGE }; }
  function VR(r) { return rot ? { x: r.y + EDGE, y: L.W - r.x - r.w + EDGE, w: r.h, h: r.w } : { x: r.x + EDGE, y: r.y + EDGE, w: r.w, h: r.h }; }
  function VA(a) { return rot ? a - Math.PI / 2 : a; }
  function VBack(b) { return rot ? { top: 'left', bottom: 'right', left: 'bottom', right: 'top' }[b] : b; }
  function viewDir(dx, dy) { var vx = rot ? dy : dx; return Math.abs(vx) < 0.01 ? 0 : vx > 0 ? 1 : -1; }
  function toLevel(sx, sy) {
    var X = (sx - OX) / K + camX, Y = (sy - OY) / K + camY;
    return rot ? { x: L.W - (Y - EDGE), y: X - EDGE } : { x: X - EDGE, y: Y - EDGE };
  }
  function keyToLevel(kx, ky) { return rot ? { x: -ky, y: kx } : { x: kx, y: ky }; }
  function updateCam() {
    var p = V(G.cat.x, G.cat.y), tw = viewW / K, th = viewH / K;
    var tx = clamp(p.x - tw / 2, 0, Math.max(0, VW - tw)), ty = clamp(p.y - th / 2, 0, Math.max(0, VH - th));
    if (camSnap) { camX = tx; camY = ty; camSnap = false; }
    else { camX += (tx - camX) * 0.08; camY += (ty - camY) * 0.08; }
  }

  /* ================= drawing ================= */
  var displayFont = 'sans-serif';

  function drawRoom(c) {
    var S = GGScene, x0 = EDGE, y0 = EDGE, w = VW - EDGE * 2, h = VH - EDGE * 2;
    S.floor(c, x0, y0, w, h, { kind: 'boards', col: '#6E4E5C', size: 40, len: 170, edge: false, seed: L.n });
    L.rugs.forEach(function (r, i) {
      var q = VR({ x: r[0] * CELL, y: r[1] * CELL, w: (r[2] - r[0] + 1) * CELL, h: (r[3] - r[1] + 1) * CELL });
      S.rug(c, q.x + q.w / 2, q.y + q.h / 2, q.w / 2, q.h / 2, { kind: i % 2 ? 'stitch' : 'rings', col: r[4] || '#5C7FC4', col2: D.lighter(r[4] || '#5C7FC4', 0.25) });
    });
    var g = V(L.goal.x, L.goal.y);
    S.light(c, x0, y0, w, h, { kind: 'pool', at: [(g.x - x0) / w, (g.y - y0) / h] });
  }
  function drawWalls(c) {
    GGScene.skirting(c, 0, 0, VW, VH, { kind: 'around', size: EDGE, col: '#3B3360', r: 8, outer: 16 });
    L.walls.forEach(function (f) { var q = VR(f); GGScene.skirting(c, q.x - 2, q.y - 2, q.w + 4, q.h + 4, { kind: 'block', col: '#3B3360', shadow: 0.3 }); });
  }
  /* the furniture, all from the shared kit's top views; each is placed by its middle and turned to fit its spot */
  var TURN = { top: 0, right: Math.PI / 2, bottom: Math.PI, left: -Math.PI / 2 };
  function drawPiece(c, kind, q, f) {
    var S = GGScene, x = q.x + q.w / 2, y = q.y + q.h / 2, long = Math.max(q.w, q.h), short = Math.min(q.w, q.h), up = q.h > q.w;
    function turned(a, fn) { c.save(); c.translate(x, y); c.rotate(a); fn(); c.restore(); }
    if (kind === 'sofa' || kind === 'armchair') {
      var back = f.back || 'top', side = back === 'left' || back === 'right';
      turned(TURN[back], function () { S.sofa(c, 0, 0, { kind: kind, view: 'top', w: (side ? q.h : q.w) - 6, col: f.col, col2: D.lighter(f.col, 0.18), pillow: kind === 'sofa' && f.seed % 3 === 0 ? '#FFD23F' : false }); });
    } else if (kind === 'table') turned(up ? Math.PI / 2 : 0, function () { S.diningTable(c, 0, 0, { view: 'top', w: long - 6, d: short - 6, seed: f.seed, cloth: ['#E9B8C8', '#9FD8B2', '#BFE6FF'][f.seed % 3] }); });
    else if (kind === 'round') S.diningTable(c, x, y, { kind: 'round', view: 'top', w: short - 6 });
    else if (kind === 'bookshelf') turned(up ? Math.PI / 2 : 0, function () { S.bookcase(c, 0, 0, { view: 'top', w: long - 4, d: short - 6, seed: f.seed }); });
    else if (kind === 'plant') S.plant(c, x, y, { view: 'top', size: Math.max(short * 1.02, 54), pot: ['#E58B5E', '#7CC4FF', '#FF9EC4'][f.seed % 3] });
    else if (kind === 'box') S.box(c, x, y, { view: 'top', w: short * 0.7 });
    else if (kind === 'lamp') S.lamp(c, x, y, { view: 'top', size: short * 0.9, on: true });
  }
  function drawFurniture(c) {
    L.furn.slice().sort(function (p, q) { return VR(p).y - VR(q).y; }).forEach(function (f) {
      drawPiece(c, f.kind, VR(f), { back: f.back && VBack(f.back), col: f.col, seed: f.seed });
    });
  }
  /* the glow of what a dog can see, cast out from its eyes and stopped by the furniture */
  function conePoints(eye, a, range, half) {
    var angs = [], N = 40;
    for (var i = 0; i <= N; i++) angs.push(a - half + 2 * half * i / N);
    L.sightB.forEach(function (b) {
      var cs = b.e ? [[b.x - b.rx, b.y], [b.x + b.rx, b.y], [b.x, b.y - b.ry], [b.x, b.y + b.ry], [b.x - b.rx * 0.7, b.y - b.ry * 0.7], [b.x + b.rx * 0.7, b.y - b.ry * 0.7], [b.x - b.rx * 0.7, b.y + b.ry * 0.7], [b.x + b.rx * 0.7, b.y + b.ry * 0.7]] : [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
      cs.forEach(function (p) {
        if (Math.hypot(p[0] - eye.x, p[1] - eye.y) > range + 60) return;
        var an = Math.atan2(p[1] - eye.y, p[0] - eye.x), df = angDiff(a, an);
        if (Math.abs(df) < half) { angs.push(a + df - 0.002, a + df + 0.002); }
      });
    });
    angs.sort(function (p, q) { return p - q; });
    var pts = [eye];
    angs.forEach(function (an) {
      var ex = eye.x + Math.cos(an) * range, ey = eye.y + Math.sin(an) * range, t = 1;
      L.sightB.forEach(function (b) { var h = segHits(b, eye.x, eye.y, ex, ey); if (h >= 0 && h < t) t = h; });
      // the walls of the room
      var dx = ex - eye.x, dy = ey - eye.y;
      if (dx < 0) t = Math.min(t, -eye.x / dx); if (dx > 0) t = Math.min(t, (L.W - eye.x) / dx);
      if (dy < 0) t = Math.min(t, -eye.y / dy); if (dy > 0) t = Math.min(t, (L.H - eye.y) / dy);
      pts.push({ x: eye.x + dx * t, y: eye.y + dy * t });
    });
    return pts;
  }
  function drawCone(c, d) {
    var looking = d.walk ? d.bark <= 0 : d.st === 'look' || d.st === 'bark', stir = !d.walk && d.st === 'stir';
    var a = looking ? (d.walk ? 0.24 : 0.3) : stir ? 0.11 + 0.07 * Math.sin(time * 12) : d.st === 'settle' ? 0.12 * (1 - d.t / d.dur) + 0.04 : 0.075;
    var eye = dogEye(d), pts = conePoints(eye, d.a, d.range, d.half);
    var e = V(eye.x, eye.y), path = new Path2D();
    pts.forEach(function (p, i) { var v = V(p.x, p.y); if (i) path.lineTo(v.x, v.y); else path.moveTo(v.x, v.y); });
    path.closePath();
    var seen = d.seen > 0 || d.st === 'bark' || d.bark > 0;
    var col = seen ? '255,150,110' : '255,226,140';
    var g = c.createRadialGradient(e.x, e.y, 10, e.x, e.y, d.range);
    g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',' + a * 0.35 + ')');
    c.fillStyle = g; c.fill(path);
    if (a > 0.07 || !d.walk) {
      c.save(); if (!looking) c.setLineDash([10, 10]);
      c.strokeStyle = 'rgba(' + col + ',' + Math.min(0.85, 0.16 + a * 2.2) + ')'; c.lineWidth = 2.5; c.lineJoin = 'round'; c.stroke(path); c.restore();
    }
  }
  function drawToy(c, k) {
    // a squeaky rubber bone (shared things kit), squashing as it squeaks
    var p = V(k.x, k.y);
    GGThings.toy(c, p.x, p.y, { a: k.a + (reduceMotion ? 0 : Math.sin(time * 40) * k.wob * 0.15), squeeze: k.wob });
  }
  function drawFish(c, f) {
    if (f.got) return;
    var p = V(f.x, f.y), bob = reduceMotion ? 0 : Math.sin(time * 4 + f.i) * 3;
    D.shadow(c, p.x, p.y + 10, 14, 4);
    c.save(); c.globalAlpha = 0.3 + 0.15 * Math.sin(time * 5); c.beginPath(); c.arc(p.x, p.y - 6 + bob, 24, 0, TAU); c.fillStyle = '#BFE6FF'; c.fill(); c.restore();
    GGThings.fish(c, p.x, p.y - 6 + bob, {});
  }
  function drawGoal(c) {
    var p = V(L.goal.x, L.goal.y);
    // a mat, a bowl with the midnight snack in it, and a sparkle so you can see where you're going
    GGScene.rug(c, p.x, p.y + 4, 40, 30, { kind: 'mat', col: '#FFB3C8', col2: 'rgba(255,255,255,.6)' });
    GGThings.bowl(c, p.x, p.y, { r: 24, food: state !== 'won' || G.eatT < 1 ? 'fish' : false });
    var sy = p.y - 46 + (reduceMotion ? 0 : Math.sin(time * 3) * 4);
    c.save(); c.translate(p.x, sy); c.rotate(reduceMotion ? 0 : time); starPath(c, 11); c.fillStyle = '#FFD23F'; c.fill(); D.ink(c, 2.5); c.restore();
  }
  function starPath(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }

  /* the dogs come from the shared things kit: curled up in a bed (top view, turned to face its way), or walking */
  function dogLook(st, t, dur) {
    var o = { eyes: 'closed', lift: 0, flop: 0 };
    if (st === 'stir') { o.eyes = 'peek'; o.lift = 0.2; o.flop = -0.7 + (reduceMotion ? 0 : Math.sin(time * 30) * 0.1); }
    else if (st === 'look' || st === 'bark') { o.eyes = 'open'; o.lift = 0.35; o.flop = -0.5; o.open = st === 'bark' && Math.sin(t * 18) > 0; o.wag = time * 12; }
    else if (st === 'settle') { o.eyes = t > dur * 0.5 ? 'closed' : 'peek'; o.flop = -0.3; }
    else o.breathe = 0;
    return o;
  }
  function drawDog(c, d) {
    var p, s = d.size;
    if (d.walk) {
      p = V(d.pose.x, d.pose.y);
      GGThings.dog(c, p.x, p.y, { view: 'top', walk: d.step, still: !d.pose.moving || d.bark > 0, a: VA(d.a), size: WALK_SIZE, col: d.col, wag: time * 10, eyes: 'open' });
      return;
    }
    p = V(d.x, d.y);
    var o = dogLook(d.st, d.t, d.dur); o.view = 'top'; o.a = VA(d.a); o.col = d.col; o.bed = d.bedCol; o.ls = s;
    c.save(); c.translate(p.x, p.y); c.scale(s, s); GGThings.dog(c, 0, 0, o); c.restore();
  }
  // what a dog is doing, over its head (always the right way up)
  function drawBubble(c, d) {
    var e = dogEye(d), p = V(e.x, e.y), st = d.walk ? (d.bark > 0 ? 'bark' : 'walk') : d.st;
    var bx = p.x, by = p.y - (d.walk ? 44 : 62);
    if (st === 'sleep') {
      for (var i = 0; i < 3; i++) {
        var ph = reduceMotion ? i / 3 : (time * 0.6 + i / 3 + d.i * 0.37) % 1;
        c.save(); c.translate(bx + 10 + ph * 24, by + 24 - ph * 46); c.globalAlpha = Math.sin(ph * Math.PI);
        c.font = '800 ' + (16 + ph * 10) + 'px ' + displayFont; c.textAlign = 'center';
        c.lineWidth = 5; c.lineJoin = 'round'; c.strokeStyle = INK; c.strokeText('z', 0, 0); c.fillStyle = '#BFE6FF'; c.fillText('z', 0, 0);
        c.restore();
      }
    } else if (st === 'stir' || st === 'look') {
      c.save(); c.translate(bx, by + (st === 'stir' ? 8 : 0));
      var s2 = st === 'stir' && !reduceMotion ? 0.85 + Math.sin(time * 16) * 0.08 : 1;
      c.scale(s2, s2);
      D.shape(c, D.ellPath(0, -6, 18, 18), st === 'look' ? '#FFD23F' : '#FFF6D8', { lw: D.LW.fine, depth: 0 });
      c.font = '800 24px ' + displayFont; c.textAlign = 'center'; c.fillStyle = INK; c.fillText(st === 'look' ? '!' : '?', 0, 2);
      c.restore();
    }
    if (d.seen > 0 && G.mode === 'play') {
      // it's noticed something: a filling ring
      c.save(); c.translate(bx + 26, by - 6); c.beginPath(); c.arc(0, 0, 9, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(d.seen / GRACE, 0, 1));
      c.strokeStyle = '#FF6B57'; c.lineWidth = 5; c.lineCap = 'round'; c.stroke(); c.restore();
    }
  }
  function drawCat(c) {
    var C = G.cat, p = V(C.x, C.y), eating = state === 'won';
    c.save(); c.translate(p.x + (G.shake ? Math.sin(time * 60) * G.shake * 4 : 0), p.y);
    D.shadow(c, 0, 2, 28, 8);
    var o = {}; for (var k in CAT) o[k] = CAT[k];
    o.size = CAT_SIZE; o.dir = C.dir || 1; o.step = C.step; o.wag = time * 3;
    if (eating) {
      o.pose = 'sit'; o.face = G.eatT > 0.4 ? 'happy' : 'open';
      c.translate(0, -60 * CAT_K + (reduceMotion ? 0 : Math.sin(G.eatT * 14) * (G.eatT < 1 ? 1.5 : 0)));
    } else {
      o.pose = 'walk'; o.moving = C.moving;
      o.face = G.mode === 'run' || G.seenK > 0.2 ? 'surprised' : G.safe ? 'happy' : 'open';
      // a low, sneaky crouch while tiptoeing
      var crouch = G.mode === 'run' ? 1 : C.moving ? 0.92 : 0.88;
      c.translate(o.dir * 30 * CAT_K, 0); c.scale(1 / Math.sqrt(crouch), crouch);
      c.translate(0, -67 * CAT_K);
    }
    try { GGCat.draw(c, o); } catch (e) { c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fillStyle = '#FFA94D'; c.fill(); }
    c.restore();
    if (eating && G.eatT > 0.6) {
      var ph = (G.eatT - 0.6) % 1;
      c.save(); c.translate(p.x + 24, p.y - 84 - ph * 34); c.globalAlpha = 1 - ph;
      c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-13, -1, -6, -11, 0, -4); c.bezierCurveTo(6, -11, 13, -1, 0, 8); c.closePath(); c.fillStyle = '#FF7EB6'; c.fill(); D.ink(c, 2.5);
      c.restore();
    }
  }
  function drawRoute(c) {
    if (!G.route || !G.route.length || G.mode !== 'play') return;
    // a soft dotted line to where you're sending your cat
    var pts = [G.cat].concat(G.route);
    c.save(); c.setLineDash([2, 12]); c.lineCap = 'round'; c.strokeStyle = 'rgba(255,246,216,.45)'; c.lineWidth = 5;
    c.beginPath(); pts.forEach(function (q, i) { var v = V(q.x, q.y); if (i) c.lineTo(v.x, v.y); else c.moveTo(v.x, v.y); }); c.stroke(); c.restore();
    var e = G.route[G.route.length - 1], v = V(e.x, e.y);
    c.beginPath(); c.arc(v.x, v.y, 10 + (reduceMotion ? 0 : Math.sin(time * 8) * 2), 0, TAU); c.strokeStyle = 'rgba(255,246,216,.7)'; c.lineWidth = 3; c.stroke();
  }
  function drawHud(c) {
    // the fish for this level, top left under the bar: filled once caught
    if (!L.fish.length) return;
    var x = OX + 8, y = OY - 2;
    L.fish.forEach(function (f, i) {
      c.save(); c.translate(x + 16 + i * 32, y + 16); c.scale(0.75, 0.75);
      GGThings.fish(c, 0, 0, { col: f.got ? '#7CC4FF' : 'rgba(255,255,255,.18)' });
      c.restore();
    });
  }
  function draw(c) {
    c.fillStyle = '#2B2550'; c.fillRect(0, 0, cw, ch);
    if (!L) return;
    updateCam();
    c.save();
    c.beginPath(); c.rect(OX, OY, viewW, viewH); c.clip();
    c.translate(OX, OY); c.scale(K, K); c.translate(-camX, -camY);
    drawRoom(c);
    L.dogs.forEach(function (d) { drawCone(c, d); });
    if (debug) drawDebug(c);
    drawRoute(c);
    L.toys.forEach(function (k) { drawToy(c, k); });
    drawGoal(c);
    L.fish.forEach(function (f) { drawFish(c, f); });
    drawWalls(c);
    drawFurniture(c);
    // the dogs and the cat, the nearer (lower) ones last
    var ents = L.dogs.map(function (d) { return { y: d.walk ? V(d.pose.x, d.pose.y).y : V(d.x, d.y).y, d: d }; });
    ents.push({ y: V(G.cat.x, G.cat.y).y + 6, cat: true });
    ents.sort(function (p, q) { return p.y - q.y; }).forEach(function (e) { if (e.cat) drawCat(c); else drawDog(c, e.d); });
    L.dogs.forEach(function (d) { drawBubble(c, d); });
    G.parts.forEach(function (p) {
      var k = 1 - p.life / p.max, v = V(p.x, p.y); c.save(); c.translate(v.x, v.y + (p.y - p.y)); c.globalAlpha = k;
      c.rotate(p.life * 6); starPath(c, p.r); c.fillStyle = p.col; c.fill(); D.ink(c, 1.5);
      c.restore();
    });
    G.pops.forEach(function (p) {
      var k = p.t / 1.1, v = V(p.x, p.y); c.save(); c.translate(v.x, v.y - 30 - k * 40); c.globalAlpha = 1 - k * k;
      var s = p.big ? 1 + Math.max(0, 0.3 - p.t) * 2 : 1; c.scale(s, s);
      c.font = '800 ' + (p.big ? 36 : 22) + 'px ' + displayFont; c.textAlign = 'center';
      c.lineWidth = 7; c.lineJoin = 'round'; c.strokeStyle = INK; c.strokeText(p.txt, 0, 0); c.fillStyle = p.big ? '#FFD23F' : '#FFF6D8'; c.fillText(p.txt, 0, 0);
      c.restore();
    });
    c.restore();
    // darken the edges a little: it's night
    var vg = c.createRadialGradient(cw / 2, ch * 0.55, Math.min(cw, ch) * 0.4, cw / 2, ch * 0.55, Math.max(cw, ch) * 0.8);
    vg.addColorStop(0, 'rgba(20,16,40,0)'); vg.addColorStop(1, 'rgba(20,16,40,.4)');
    c.fillStyle = vg; c.fillRect(0, 0, cw, ch);
    drawHud(c);
  }
  var debug = /[?&]debug/.test(location.search);
  function drawDebug(c) {
    for (var j = 0; j < L.gh; j++) for (var i = 0; i < L.gw; i++) {
      var k = j * L.gw + i; if (!L.free[k]) continue;
      var v = V((i + 0.5) * SG, (j + 0.5) * SG);
      c.fillStyle = L.safe[k] ? 'rgba(120,255,140,.35)' : 'rgba(255,90,90,.25)'; c.fillRect(v.x - 3, v.y - 3, 6, 6);
    }
    L.dogs.forEach(function (d) {
      if (d.walk) return;
      var pts = conePoints(d.eye, d.a0, d.range, d.half + d.turn), path = new Path2D();
      pts.forEach(function (p, i) { var v = V(p.x, p.y); if (i) path.lineTo(v.x, v.y); else path.moveTo(v.x, v.y); });
      path.closePath(); c.strokeStyle = 'rgba(255,80,80,.8)'; c.lineWidth = 2; c.stroke(path);
    });
  }
  function drawCardPic(stars) {
    var cv = $('cardPic'), c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 440, 300); c.lineJoin = 'round'; c.lineCap = 'round';
    c.save(); D.rr(c, 6, 6, 428, 288, 26); c.clip();
    GGScene.floor(c, 0, 0, 440, 300, { kind: 'boards', col: '#6E4E5C', size: 40, len: 170, edge: false, seed: 2 });
    GGScene.rug(c, 150, 200, 110, 60, { kind: 'rings', col: '#5C7FC4', col2: '#7D98D0' });
    GGScene.light(c, 0, 0, 440, 300, { kind: 'pool', at: [0.2, 0.8] });
    // a dog asleep in its bed, its glow stopped by the sofa, and a cat tiptoeing past behind it
    var eye = { x: 330, y: 100 }, g = c.createRadialGradient(eye.x, eye.y, 10, eye.x, eye.y, 260);
    g.addColorStop(0, 'rgba(255,226,140,.2)'); g.addColorStop(1, 'rgba(255,226,140,.06)');
    c.fillStyle = g; c.beginPath(); c.moveTo(eye.x, eye.y); c.lineTo(eye.x - 250, eye.y + 40); c.lineTo(eye.x - 120, eye.y + 230); c.closePath(); c.fill();
    c.save(); c.translate(350, 78); c.scale(0.62, 0.62); GGThings.dog(c, 0, 0, { view: 'top', a: Math.PI * 0.8, col: DOG_COLS[0], bed: BED_COLS[0], ls: 0.62 }); c.restore();
    GGScene.sofa(c, 205, 150, { view: 'top', w: 130, col: '#7C8FD6', col2: '#94A6EA' });
    GGScene.plant(c, 62, 238, { view: 'top', size: 76 });
    c.save(); c.translate(stars ? 210 : 170, 236);
    D.shadow(c, 0, 2, 32, 9);
    var o = {}; for (var k in CAT) o[k] = CAT[k]; o.size = 62; o.dir = 1; o.step = 1.3; o.moving = !stars; o.face = stars ? 'happy' : 'happy';
    if (stars) { o.pose = 'sit'; c.translate(0, -50); } else { o.pose = 'walk'; c.translate(26, 0); c.scale(1.05, 0.9); c.translate(0, -67 * 62 / 88); }
    try { GGCat.draw(c, o); } catch (e) {}
    c.restore();
    if (stars) for (var i = 0; i < 3; i++) {
      c.save(); c.translate(80 + i * 70, 62 - (i === 1 ? 12 : 0)); starPath(c, 26); c.fillStyle = i < stars ? '#FFD23F' : 'rgba(255,255,255,.18)'; c.fill(); c.lineWidth = 4; c.strokeStyle = i < stars ? INK : 'rgba(255,246,216,.5)'; c.stroke(); c.restore();
    } else {
      [0, 1, 2].forEach(function (i) { c.save(); c.translate(298 + i * 14, 44 - i * 16); c.font = '800 ' + (18 + i * 5) + 'px ' + displayFont; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = INK; c.strokeText('z', 0, 0); c.fillStyle = '#BFE6FF'; c.fillText('z', 0, 0); c.restore(); });
    }
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
      squeak: function () { tone({ f: 900, to: 1500, dur: 0.12, gain: 0.08, type: 'sawtooth', slide: 0.08 }); tone({ f: 1400, to: 800, dur: 0.14, gain: 0.06, type: 'sawtooth', delay: 0.1, slide: 0.12 }); },
      snore: function () { noise({ type: 'lowpass', freq: 220, q: 3, attack: 0.5, dur: 0.6, gain: 0.035 }); },
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
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe($('topbar'));
  document.addEventListener('visibilitychange', function () { paused = document.hidden; last = performance.now(); hold = null; keys = {}; if (G && G.mode === 'play') G.route = null; });
  try { displayFont = getComputedStyle(document.body).getPropertyValue('--display') || 'sans-serif'; } catch (e) {}
  loadLevel(P.cur || 1);
  showCard('intro');
  requestAnimationFrame(frame);

  /* ================= test hooks ================= */
  var AUTO = null;
  // the nearest safe square you can walk to from (x, y) (for the autopilot)
  function nearestSafe(x, y, avoid) {
    var s = cellOf(x, y), gw = L.gw, seen = new Uint8Array(gw * L.gh), q = [s.j * gw + s.i]; seen[q[0]] = 1;
    while (q.length) {
      var k = q.shift(), i = k % gw, j = (k - i) / gw;
      if (L.safe[k] && L.free[k] && !(avoid && avoid[k])) return { x: (i + 0.5) * SG, y: (j + 0.5) * SG };
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var ni = i + o[0], nj = j + o[1], nk = nj * gw + ni; if (ni >= 0 && nj >= 0 && ni < gw && nj < L.gh && !seen[nk] && L.free[nk]) { seen[nk] = 1; q.push(nk); } });
    }
    return null;
  }
  window.__sneak = {
    count: LEVELS.length,
    state: function () { return { state: state, mode: G.mode, x: G.cat.x, y: G.cat.y, lv: L.n, best: P.best, spotted: G.spotted, got: G.got, fish: L.fish.length, safe: G.safe, stars: G.stars, rot: rot, K: K, startSafe: isSafe(L.start.x, L.start.y) }; },
    load: function (n) { hideCard(); P.best = Math.max(P.best, n); loadLevel(n); state = 'play'; AUTO = null; },
    dogs: function () { return L.dogs.map(function (d) { return { x: d.x, y: d.y, st: d.st, walk: d.walk, left: d.dur - d.t, a: d.a }; }); },
    toScreen: function (x, y) { var v = V(x, y); return { x: OX + (v.x - camX) * K, y: OY + (v.y - camY) * K }; },
    teleport: function (x, y) { G.cat.x = x; G.cat.y = y; G.route = null; G.trail = []; G.safe = isSafe(x, y); if (G.safe) G.check = { x: x, y: y }; camSnap = true; },
    walkTo: function (x, y) { setTarget(x, y); },
    force: function (i, st, t) { var d = L.dogs[i]; d.st = st; d.t = 0; d.dur = t || 30; d.lookT = 0; },
    // somewhere a dog could see but furniture is in the way: the cat hiding behind it
    hideSpot: function (i) {
      var d = L.dogs[i || 0], best = null, bd = -1;
      for (var j = 0; j < L.gh; j++) for (var q = 0; q < L.gw; q++) {
        var x = (q + 0.5) * SG, y = (j + 0.5) * SG; if (!L.free[j * L.gw + q] || !isFree(x, y)) continue;
        var dx = x - d.eye.x, dy = y - d.eye.y, dd = Math.hypot(dx, dy);
        if (dd > d.range * 0.9 || Math.abs(angDiff(d.a0, Math.atan2(dy, dx))) > d.half * 0.6) continue;
        if (clearLine(d.eye.x, d.eye.y, x, y)) continue;
        // snug against the furniture, not far behind it
        var near = 0; for (var a = 0; a < 8; a++) if (blockedAt(x + Math.cos(a * TAU / 8) * 34, y + Math.sin(a * TAU / 8) * 34, 2)) near++;
        var sc = near * 10 - dd * 0.01; if (sc > bd) { bd = sc; best = { x: x, y: y }; }
      }
      return best;
    },
    debugInfo: function () { return { cat: [Math.round(G.cat.x), Math.round(G.cat.y)], why: AUTO && AUTO.why, fish: L.fish.filter(function (f) { return !f.got; }).map(function (f) { return [f.x, f.y, isFree(f.x, f.y)]; }), dogs: this.dogs() }; },
    tick: function (n, autoOn) { for (var i = 0; i < n; i++) { time += 1 / 60; if (autoOn) this.auto(); update(1 / 60); if (state !== 'play') break; } return this.state(); },
    // a careful autopilot for testing that every room can be done with three stars: it waits somewhere safe until
    // every dog that could see the next open stretch will stay asleep (or walk past) for long enough, then goes
    auto: function () {
      if (state !== 'play' || G.mode !== 'play') { AUTO = null; return; }
      var C = G.cat;
      if (!AUTO || AUTO.lv !== L.n) {
        AUTO = { lv: L.n, avoid: new Uint8Array(L.gw * L.gh), go: null };
        L.toys.forEach(function (k) { for (var j = 0; j < L.gh; j++) for (var i = 0; i < L.gw; i++) if (Math.hypot((i + 0.5) * SG - k.x, (j + 0.5) * SG - k.y) < 50) AUTO.avoid[j * L.gw + i] = 1; });
      }
      if (AUTO.go) {
        // on the way across: keep going
        if (G.route && G.route.length) return;
        AUTO.go = null;
      }
      var left = L.fish.filter(function (f) { return !f.got; });
      var tgt = left.length ? left.sort(function (p, q) { return Math.hypot(p.x - C.x, p.y - C.y) - Math.hypot(q.x - C.x, q.y - C.y); })[0] : L.goal;
      var avoid = AUTO.avoid;
      if (left.length) {
        // fish first: keep off the snack until they're all caught
        avoid = avoid.slice();
        for (var gj = 0; gj < L.gh; gj++) for (var gi = 0; gi < L.gw; gi++) if (Math.hypot((gi + 0.5) * SG - L.goal.x, (gj + 0.5) * SG - L.goal.y) < 56) avoid[gj * L.gw + gi] = 1;
      }
      var pts = findPath(C.x, C.y, tgt.x, tgt.y, avoid); if (!pts) { AUTO.why = 'no path'; return; }
      // walk the path in small steps: how long to each point, and is it somewhere safe?
      var dense = [], px = C.x, py = C.y, tt = 0;
      function addPts(list) { list.forEach(function (q) { var dd = Math.hypot(q.x - px, q.y - py), n = Math.max(1, Math.ceil(dd / 10)); for (var s = 1; s <= n; s++) { tt += dd / n / SPEED; dense.push({ x: lerp(px, q.x, s / n), y: lerp(py, q.y, s / n), t: tt }); } px = q.x; py = q.y; }); }
      addPts(pts);
      // a fish out in the open: plan on past it, to the next safe spot on the way to the snack
      if (tgt !== L.goal && !isSafe(tgt.x, tgt.y)) { var ns = nearestSafe(tgt.x, tgt.y, avoid), on = ns && findPath(tgt.x, tgt.y, ns.x, ns.y, avoid); if (on) addPts(on); }
      var k0 = -1; for (var a = 0; a < dense.length; a++) if (!isSafe(dense[a].x, dense[a].y)) { k0 = a; break; }
      var end;
      if (k0 < 0) end = dense.length - 1;
      else if (k0 > 3) end = k0 - 1;
      else {
        end = dense.length - 1;
        for (var b = k0; b < dense.length; b++) if (isSafe(dense[b].x, dense[b].y)) { end = b; break; }
        for (var e = k0; e <= end; e++) if (danger(dense[e].t + 0.15, dense[e].x, dense[e].y)) { G.route = null; AUTO.why = 'waiting'; return; }
      }
      AUTO.why = 'going';
      G.route = dense.slice(0, end + 1).filter(function (q, i, arr) { return i % 3 === 2 || i === arr.length - 1; });
      AUTO.go = k0 >= 0 && k0 <= 3;
      function danger(t, x, y) {
        return L.dogs.some(function (d) {
          if (d.walk) {
            var pz = walkPose(d, d.clock + Math.max(0, t - Math.max(0, d.bark)));
            return Math.hypot(x - pz.x, y - pz.y) < 80 || seesFrom(walkEye(pz), pz.a, d.range + 40, d.half + 0.12, x, y);
          }
          var from = d.st === 'sleep' ? d.dur - d.t + L.tm.warn : d.st === 'settle' ? d.dur - d.t + L.tm.sleep[0] + L.tm.warn : 0;
          return t > from - 0.4 && seesFrom(d.eye, d.a0, d.range + 20, d.half + d.turn + 0.06, x, y);
        });
      }
    }
  };
})();
