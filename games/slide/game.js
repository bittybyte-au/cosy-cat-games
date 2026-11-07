/* Slide Puzzle (ages about 5–10): a cosy picture cut into squares with one gap. Tap a square in the gap's
   row or column and it slides (with any squares between) into the gap. Put the picture back together.
   Two sizes (3×3, 4×4) and two levels, all open. Shuffles are made by sliding from the finished picture, so every
   puzzle can be solved. Hard: 80 (3×3) or 220 (4×4) random slides, never straight back, until at least 60% of the
   squares are out of place, which is as mixed up as a random board. Easy: a short walk of 5 (3×3) or 8 (4×4)
   slides that never returns to an earlier arrangement, so it is at most that many slides from done. A peek button shows the picture; a 123 button numbers the squares.
   No timer, no move counter. Pictures are drawn from the shared cat, food and drawing kit.
   Saves GG.setProgress('slide', { solved: { picId: [3, 4] }, n3, n4, pic, size, diff, nums }). */
(function () {
  'use strict';

  var D = window.GGDraw, INK = D.INK, TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function cat(c, x, y, o) { c.save(); c.translate(x, y); GGCat.draw(c, o); c.restore(); }

  /* ================= the pictures (drawn once, 600 square) ================= */
  /* all the scenery (walls, floors, sky, hills, flowers, windows, lamps...) comes from the shared kit, shared/scene.js */
  var PS = 600, G = window.GGScene;
  function yarnBall(c, x, y, r, col) { GGThings.yarnBall(c, x, y, { r: r, col: col }); }   // shared/things.js
  var PICTURES = [
    { id: 'teacup', name: 'Cat in a teacup', draw: function (c) {
      G.wall(c, 0, 0, PS, 420, { pattern: 'dots', col: '#FFE6F0', col2: 'rgba(255,255,255,.8)', size: 44 });
      // a shelf of little jars behind
      [['#7CC4FF', 70], ['#FFC93C', 160], ['#B48CFF', 420], ['#7BD389', 500]].forEach(function (j) {
        D.shape(c, D.rrPath(j[1], 62, 54, 62, 12), j[0], { lw: 4, depth: 5, shine: [j[1] + 16, 76, 6, 10, 0] });
        D.shape(c, D.rrPath(j[1] - 4, 54, 62, 14, 6), '#FFFFFF', { lw: 3.5, depth: 2 });
      });
      G.shelf(c, 40, 560, 120, { kind: 'plain', col: '#E6B98A', thick: 18 });
      G.table(c, 0, PS, 420, PS, { kind: 'top', col: '#E6B98A', grain: '#D9A877', size: 60 });
      // saucer, then the handle (behind the cup), the tea, the cat, and the cup's front
      D.shadow(c, 300, 500, 230, 30);
      D.shape(c, D.ellPath(300, 478, 220, 40), '#FFFFFF', { lw: 5, depth: 6 });
      D.shape(c, D.ellPath(300, 474, 150, 22), '#F4EEF8', { lw: 3, depth: 0 });
      var handle = new Path2D(); handle.moveTo(420, 330); handle.bezierCurveTo(520, 320, 520, 430, 400, 420);
      c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 34; c.stroke(handle); c.strokeStyle = '#7CC4FF'; c.lineWidth = 24; c.stroke(handle);
      D.shape(c, D.ellPath(300, 300, 160, 30), '#B8E0FF', { lw: 5, depth: 0 });
      D.shape(c, D.ellPath(300, 304, 140, 22), '#C98B5B', { lw: 0, depth: 0 });
      cat(c, 300, 236, { preset: 'ginger', size: 210, face: 'happy' });
      var front = new Path2D(); front.moveTo(140, 300); front.bezierCurveTo(140, 400, 210, 466, 300, 466); front.bezierCurveTo(390, 466, 460, 400, 460, 300); front.ellipse(300, 300, 160, 30, 0, 0, Math.PI);
      D.shape(c, front, '#7CC4FF', { lw: 5, depth: 14, inside: function (c) {
        c.fillStyle = '#FFFFFF'; [[200, 360], [260, 410], [330, 372], [400, 352], [380, 420], [230, 430]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], 9, 0, TAU); c.fill(); });
        D.shine(c, 196, 334, 12, 30, 0.4, 0.5);
      } });
      // steam hearts
      [[150, 200, 0.9], [470, 170, 1.1], [520, 250, 0.7]].forEach(function (h) {
        var p = new Path2D(), s = 20 * h[2], x = h[0], y = h[1];
        p.moveTo(x, y + s); p.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.4, x, y - s * 0.4); p.bezierCurveTo(x + s * 0.6, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s); p.closePath();
        D.shape(c, p, '#FF8FAB', { lw: 3.5, depth: 3 });
      });
    } },
    { id: 'garden', name: 'Garden', draw: function (c) {
      G.sky(c, 0, 0, PS, 380, { col: '#9EDCFF' });
      G.cloud(c, 140, 96, { size: 124 }); G.cloud(c, 330, 66, { size: 124 });
      G.sun(c, 496, 108, { kind: 'cat', size: 96 });
      G.hills(c, 0, 262, PS, 338, { kind: 'one', col: '#9BDC8C' });
      G.fence(c, 0, PS, 420, { kind: 'picket', h: 96 });
      G.ground(c, 0, 410, PS, 190, { kind: 'grass', col: '#7BD389', edge: 'wave', tufts: 26, seed: 4 });
      [[80, 530, '#FF8FAB', 110], [150, 570, '#B48CFF', 96], [470, 548, '#FFFFFF', 106], [540, 590, '#FF6B57', 96]].forEach(function (f) { G.flower(c, f[0], f[1], { kind: 'daisy', size: f[3], col: f[2] }); });
      // a cat sitting in the grass, and a butterfly
      cat(c, 300, 330, { preset: 'pink', pose: 'sit', size: 150 });
      c.save(); c.translate(140, 300); c.rotate(-0.3);
      var w = new Path2D(); w.ellipse(-18, -10, 20, 15, -0.4, 0, TAU); w.moveTo(34, -10); w.ellipse(18, -10, 20, 15, 0.4, 0, TAU); w.moveTo(-2, 12); w.ellipse(-14, 12, 12, 10, 0.4, 0, TAU); w.moveTo(26, 12); w.ellipse(14, 12, 12, 10, -0.4, 0, TAU);
      D.shape(c, w, '#FFD23F', { lw: 3.5, depth: 3 }); D.shape(c, D.rrPath(-5, -20, 10, 40, 5), '#3D3650', { lw: 3, depth: 0 });
      c.restore();
    } },
    { id: 'night', name: 'Sleepy night', draw: function (c) {
      G.sky(c, 0, 0, PS, 420, { col: '#3B3F8C' });
      G.stars(c, 0, 0, PS, 380, { n: 40, kind: 'twinkle', size: 5, seed: 9 });
      G.moon(c, 470, 120, { kind: 'full', size: 124 });
      // the window sill, and the wall under it
      G.wall(c, 0, 420, PS, PS - 420, { pattern: 'stripes', col: '#C7B3E8', col2: 'rgba(255,255,255,.18)', size: 60, edge: 'top' });
      G.shelf(c, -10, 610, 404, { kind: 'sill', col: '#E6B98A', thick: 26 });
      // a cushion and a sleeping cat
      D.shadow(c, 300, 560, 230, 24);
      D.shape(c, D.ellPath(300, 520, 230, 52), '#FF8FAB', { lw: 5, depth: 12, inside: function (c) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 4; c.beginPath(); c.ellipse(300, 516, 190, 36, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } });
      cat(c, 320, 420, { preset: 'white', pose: 'lie', face: 'sleep', zzz: true, size: 240 });
      // a hanging star
      G.star(c, 120, 196, { r: 36, string: 160 });
    } },
    { id: 'pizza', name: 'Pizza party', draw: function (c) {
      G.table(c, 0, PS, 0, PS, { kind: 'top', pattern: 'gingham', col: '#FFFFFF', col2: 'rgba(255,107,87,.55)', size: 60, edge: false });
      c.save(); c.translate(300, 350);
      GGDish.draw(c, { id: 'pizza', data: { pz: [
        { k: 'pepperoni', x: -120, y: -40, r: 0 }, { k: 'pepperoni', x: 40, y: -110, r: 0 }, { k: 'pepperoni', x: 130, y: 40, r: 0 }, { k: 'pepperoni', x: -40, y: 110, r: 0 },
        { k: 'mushroom', x: -40, y: -60, r: 20 }, { k: 'mushroom', x: 90, y: 110, r: -30 }, { k: 'olive', x: 10, y: 20, r: 0 }, { k: 'olive', x: -150, y: 60, r: 0 },
        { k: 'basil', x: 120, y: -50, r: 40 }, { k: 'basil', x: -90, y: 40, r: -20 }, { k: 'capsicum', x: -60, y: -140, r: 10 }, { k: 'pineapple', x: 60, y: 60, r: 30 }
      ] } }, 560);
      c.restore();
      // two cats peeking over the table edge
      cat(c, 110, 90, { preset: 'purple', pose: 'peek', size: 120, face: 'happy' });
      cat(c, 490, 90, { preset: 'black', pose: 'peek', size: 120 });
    } },
    { id: 'yarn', name: 'Yarn play', draw: function (c) {
      G.wall(c, 0, 0, PS, 300, { pattern: 'stripes', col: '#FFF1B8', col2: 'rgba(255,201,60,.3)', size: 60 });
      // a window
      G.window(c, 380, 40, 170, 150, { view: 'sky', sky: '#9EDCFF', bars: 'cross', cloud: 0.03, sill: '#E6B98A', r: 14 });
      G.floor(c, 0, 300, PS, PS - 300, { kind: 'planks', col: '#E6B98A', col2: '#D9A877', size: 50 });
      // round striped rug
      G.rug(c, 300, 470, 270, 92, { kind: 'rings', col: '#B48CFF', col2: '#DCC8FF' });
      // a loose strand from the red ball to the cat's paw
      c.beginPath(); c.moveTo(150, 470); c.bezierCurveTo(220, 540, 300, 380, 360, 300); c.strokeStyle = INK; c.lineWidth = 8; c.lineCap = 'round'; c.stroke(); c.strokeStyle = '#FF5A7A'; c.lineWidth = 4; c.stroke();
      cat(c, 300, 230, { preset: 'blue', pose: 'wave', size: 150 });
      yarnBall(c, 120, 470, 46, '#FF5A7A'); yarnBall(c, 470, 500, 40, '#FFC93C'); yarnBall(c, 520, 420, 30, '#7BD389');
    } },
    { id: 'sofa', name: 'Sofa cats', draw: function (c) {
      G.wall(c, 0, 0, PS, 470, { pattern: 'dots', col: '#E6F2FF', col2: 'rgba(124,196,255,.35)', size: 44 });
      // picture on the wall
      G.picture(c, 210, 40, 180, 120, { view: 'hills', frame: '#FFC93C', string: false });
      G.floor(c, 0, 470, PS, PS - 470, { kind: 'planks', col: '#E6B98A', size: 50 });
      // the shared sofa (front view), with three cats sitting on it and a cushion
      G.sofa(c, 300, 540, { w: 520, col: '#FF8FAB', col2: '#FF9EC4', pillow: '#FFD23F', seat: function (c) {
        [[170, 300, 'white'], [300, 286, 'ginger'], [430, 300, 'black']].forEach(function (k) { cat(c, k[0], k[1], { preset: k[2], pose: 'sit', size: 104, face: k[2] === 'ginger' ? 'happy' : undefined }); });
      } });
      G.lamp(c, 562, 474, { kind: 'floor', size: 300, shade: '#7BD389', stand: '#8E7FA8' });
    } }
  ];
  function picById(id) { for (var i = 0; i < PICTURES.length; i++) if (PICTURES[i].id === id) return PICTURES[i]; return PICTURES[0]; }
  var picCache = {};
  function picCanvas(id) {
    if (picCache[id]) return picCache[id];
    var cv = document.createElement('canvas'); cv.width = cv.height = PS;
    var c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    picById(id).draw(c);
    return (picCache[id] = cv);
  }

  /* ================= sound (small, soft) ================= */
  var Sound = (function () {
    var ac = null, master = null, on = GG.getSetting('sound', true);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ac.destination);
    }
    function tone(f, to, dur, gain, delay, type) {
      if (!ac || !on) return;
      var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      init: init, isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.value = v ? 0.8 : 0; },
      slide: function () { tone(320, 240, 0.09, 0.08, 0, 'triangle'); },
      bonk: function () { tone(180, 140, 0.08, 0.05, 0, 'triangle'); },
      chime: function () { [660, 830, 990, 1320].forEach(function (f, i) { tone(f, 0, 0.35, 0.09, i * 0.09); }); }
    };
  })();

  /* ================= saved progress ================= */
  var P = (function () {
    var p = {}; try { p = GG.getProgress('slide') || {}; } catch (e) {}
    if (!p.solved || typeof p.solved !== 'object') p.solved = {};
    p.n3 = p.n3 | 0; p.n4 = p.n4 | 0;
    if (p.size !== 3 && p.size !== 4) p.size = 3;
    if (typeof p.pic !== 'string') p.pic = PICTURES[0].id;
    p.nums = !!p.nums;
    if (p.diff !== 'easy' && p.diff !== 'hard') p.diff = 'easy';
    return p;
  })();
  function save() { try { GG.setProgress('slide', P); } catch (e) {} }
  var UNLOCK4 = 0;                      // everything is open
  function bigOpen() { return true; }

  /* ================= the board ================= */
  var n = 3, cells = [], tiles = [], gap = 0, solved = false, joinT = 0, peek = false, picId = P.pic;
  function idx(r, col) { return r * n + col; }
  function newPuzzle(id, size) {
    picId = id || picId; n = size || n; solved = false; joinT = 0;
    if (window.GG && GG.track) GG.track('Start puzzle', { game: 'slide', picture: picId, size: n + 'x' + n, level: P.diff });
    P.pic = picId; P.size = n; save();
    cells = []; for (var i = 0; i < n * n - 1; i++) cells.push(i); cells.push(-1);
    gap = n * n - 1;
    if (P.diff === 'easy') { easyShuffle(); }
    // hard: shuffle by sliding from the finished picture (so it can always be solved), never straight back
    else { var moves = n === 3 ? 80 : 220, prev = -1;
    for (var m = 0; m < moves || isSolved() || misplaced() < n * n * 0.6; m++) {
      var gr = Math.floor(gap / n), gc = gap % n, opts = [];
      if (gr > 0) opts.push(gap - n); if (gr < n - 1) opts.push(gap + n); if (gc > 0) opts.push(gap - 1); if (gc < n - 1) opts.push(gap + 1);
      opts = opts.filter(function (o) { return o !== prev; });
      var pick = opts[Math.floor(Math.random() * opts.length)];
      cells[gap] = cells[pick]; cells[pick] = -1; prev = gap; gap = pick;
      if (m > 2000) break;
    } }
    tiles = [];
    for (var p = 0; p < cells.length; p++) if (cells[p] >= 0) tiles[cells[p]] = { pos: p, x: p % n, y: Math.floor(p / n) };
    renderSizes(); layout();
  }
  // easy: a short walk that never comes back to an arrangement it has already made
  function easyShuffle() {
    var steps = n === 3 ? 7 : 10, minOut = n === 3 ? 4 : 5;
    for (var tries = 0; tries < 60; tries++) {
      cells = []; for (var i = 0; i < n * n - 1; i++) cells.push(i); cells.push(-1); gap = n * n - 1;
      var seen = {}; seen[cells.join(',')] = 1;
      for (var m = 0; m < steps; m++) {
        var gr = Math.floor(gap / n), gc = gap % n, opts = [];
        if (gr > 0) opts.push(gap - n); if (gr < n - 1) opts.push(gap + n); if (gc > 0) opts.push(gap - 1); if (gc < n - 1) opts.push(gap + 1);
        opts = opts.filter(function (o) { var c = cells.slice(); c[gap] = c[o]; c[o] = -1; return !seen[c.join(',')]; });
        if (!opts.length) break;
        var pick = opts[Math.floor(Math.random() * opts.length)];
        cells[gap] = cells[pick]; cells[pick] = -1; gap = pick; seen[cells.join(',')] = 1;
      }
      if (!isSolved() && misplaced() >= minOut) return;
    }
  }
  function isSolved() { for (var i = 0; i < n * n - 1; i++) if (cells[i] !== i) return false; return true; }
  function misplaced() { var k = 0; for (var i = 0; i < n * n - 1; i++) if (cells[i] !== i) k++; return k; }
  // tap a square in the gap's row or column: it and any squares between it and the gap slide over
  function tapCell(p) {
    if (solved) return;
    var r = Math.floor(p / n), col = p % n, gr = Math.floor(gap / n), gc = gap % n;
    if (p === gap || (r !== gr && col !== gc)) { Sound.bonk(); wiggle = { p: p, t: 0 }; return; }
    var step = r === gr ? (col < gc ? -1 : 1) : (r < gr ? -n : n);
    while (gap !== p) {
      var from = gap + step;
      cells[gap] = cells[from]; tiles[cells[gap]].pos = gap; cells[from] = -1; gap = from;
    }
    Sound.init(); Sound.slide(); buzz(6);
    if (isSolved()) win();
  }
  var wiggle = null;

  /* ================= winning ================= */
  var parts = [];
  function win() {
    solved = true;
    if (window.GG && GG.track) GG.track('Finish puzzle', { game: 'slide', picture: picId, size: n + 'x' + n, level: P.diff });
    var s = P.solved[picId] = Array.isArray(P.solved[picId]) ? P.solved[picId] : [];
    if (s.indexOf(n) < 0) s.push(n);
    var opened = false;
    if (n === 3) P.n3++; else P.n4++;
    save();
    setTimeout(function () {
      Sound.chime(); buzz(30);
      for (var i = 0; i < 60; i++) parts.push({ x: board.x + Math.random() * board.s, y: board.y + board.s * 0.3, vx: (Math.random() - 0.5) * 500, vy: -200 - Math.random() * 500, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, col: ['#FF8FAB', '#FFC93C', '#7CC4FF', '#7BD389', '#B48CFF'][i % 5], life: 1.6 });
    }, 350);
    setTimeout(function () {
      $('winNote').textContent = opened ? 'The bigger 4×4 puzzles are open now!' : picById(picId).name + ' is back together.';
      $('win').hidden = false; $('nextBtn').focus();
    }, 2600);   // time to enjoy the finished picture first
  }
  function nextPicture() {
    var i = PICTURES.indexOf(picById(picId));
    $('win').hidden = true;
    newPuzzle(PICTURES[(i + 1) % PICTURES.length].id, n);
  }

  /* ================= layout and drawing ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), dpr = 1, W = 0, H = 0, board = { x: 0, y: 0, s: 100 };
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5); W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var top = $('topbar').getBoundingClientRect().bottom + 14, bottom = document.querySelector('.tools').getBoundingClientRect().top - 14;
    var s = Math.min(W - 28, bottom - top, 640);
    board = { x: (W - s) / 2, y: top + (bottom - top - s) / 2, s: s };
  }
  function draw(dt) {
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    c.lineJoin = 'round'; c.lineCap = 'round';
    var pad = Math.max(8, board.s * 0.025), inner = board.s - pad * 2, ts = inner / n;
    var gapPx = lerp(Math.max(3, ts * 0.04), 0, joinT);
    // the tray
    D.shadow(c, board.x + board.s / 2, board.y + board.s + 6, board.s * 0.52, 14);
    D.shape(c, D.rrPath(board.x, board.y, board.s, board.s, 22), '#FFF8EC', { lw: 5, depth: 8 });
    D.shape(c, D.rrPath(board.x + pad - 2, board.y + pad - 2, inner + 4, inner + 4, 12), '#D9CFE8', { lw: 3, depth: 0, inside: function (c) { c.fillStyle = 'rgba(42,35,64,.12)'; c.fillRect(board.x, board.y, board.s, pad + 8); } });
    var pic = picCanvas(picId), sl = PS / n;
    var k = Math.min(1, dt * 18);
    for (var t = 0; t < tiles.length; t++) {
      var T = tiles[t], tx = T.pos % n, ty = Math.floor(T.pos / n);
      T.x = reduceMotion ? tx : lerp(T.x, tx, k); T.y = reduceMotion ? ty : lerp(T.y, ty, k);
      var x = board.x + pad + T.x * ts + gapPx / 2, y = board.y + pad + T.y * ts + gapPx / 2, s = ts - gapPx;
      if (wiggle && wiggle.p === T.pos) x += Math.sin(wiggle.t * 40) * 4 * (1 - wiggle.t / 0.3);
      var r = lerp(Math.min(10, s * 0.1), 0, joinT);
      var p = D.rrPath(x, y, s, s, r);
      c.save(); c.clip(p);
      c.drawImage(pic, (t % n) * sl, Math.floor(t / n) * sl, sl, sl, x, y, s, s);
      if (joinT < 1) {
        // a little raised edge on each square, gone once the picture joins up
        c.globalAlpha = 1 - joinT; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 2, y + s - 2); c.lineTo(x + 2, y + 2); c.lineTo(x + s - 2, y + 2); c.stroke();
        c.strokeStyle = 'rgba(42,35,64,.22)'; c.beginPath(); c.moveTo(x + s - 2, y + 2); c.lineTo(x + s - 2, y + s - 2); c.lineTo(x + 2, y + s - 2); c.stroke();
        if (P.nums) {
          var br = Math.max(11, s * 0.12);
          c.globalAlpha = 1 - joinT; c.fillStyle = '#FFF8EC'; c.beginPath(); c.arc(x + br + 4, y + br + 4, br, 0, TAU); c.fill(); D.ink(c, 2.5);
          c.fillStyle = INK; c.font = '800 ' + Math.round(br * 1.25) + 'px "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(t + 1), x + br + 4, y + br + 5);
        }
        c.globalAlpha = 1;
      }
      c.restore();
      if (joinT < 1) { c.globalAlpha = 1 - joinT; c.strokeStyle = INK; c.lineWidth = 3; c.stroke(p); c.globalAlpha = 1; }
    }
    // the last square drops into the gap once it's solved
    if (solved) {
      joinT = Math.min(1, joinT + dt * 2.2);
      var last = n * n - 1, lx = board.x + pad + (last % n) * ts, ly = board.y + pad + Math.floor(last / n) * ts;
      c.save(); c.globalAlpha = joinT; c.beginPath(); c.rect(lx, ly, ts, ts); c.clip();
      c.drawImage(pic, (last % n) * sl, Math.floor(last / n) * sl, sl, sl, lx, ly - (1 - joinT) * ts * 0.3, ts, ts); c.restore();
      if (joinT >= 1) { c.beginPath(); c.rect(board.x + pad, board.y + pad, inner, inner); D.ink(c, 4); }
    }
    if (peek) {
      c.save(); c.globalAlpha = 0.95; c.drawImage(pic, board.x + pad, board.y + pad, inner, inner); c.restore();
      c.beginPath(); c.rect(board.x + pad, board.y + pad, inner, inner); D.ink(c, 4);
    }
    if (wiggle) { wiggle.t += dt; if (wiggle.t > 0.3) wiggle = null; }
    // confetti
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i]; q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt; q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      c.save(); c.translate(q.x, q.y); c.rotate(q.r); c.globalAlpha = Math.min(1, q.life * 2); c.fillStyle = q.col; c.fillRect(-6, -3, 12, 6); c.restore();
    }
  }

  /* ================= input ================= */
  function cellAt(x, y) {
    var pad = Math.max(8, board.s * 0.025), inner = board.s - pad * 2, ts = inner / n;
    var cx = Math.floor((x - board.x - pad) / ts), cy = Math.floor((y - board.y - pad) / ts);
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return -1;
    return idx(cy, cx);
  }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    var p = cellAt(e.clientX, e.clientY);
    if (p >= 0) tapCell(p);
  });
  // arrow keys move the square next to the gap into it
  window.addEventListener('keydown', function (e) {
    if (!$('pickWrap').hidden || !$('win').hidden) return;
    var gr = Math.floor(gap / n), gc = gap % n, p = -1;
    if (e.key === 'ArrowLeft' && gc < n - 1) p = gap + 1;
    if (e.key === 'ArrowRight' && gc > 0) p = gap - 1;
    if (e.key === 'ArrowUp' && gr < n - 1) p = gap + n;
    if (e.key === 'ArrowDown' && gr > 0) p = gap - n;
    if (p >= 0) { e.preventDefault(); tapCell(p); }
  });

  /* ================= buttons ================= */
  function renderSizes() {
    document.querySelectorAll('.size[data-n]').forEach(function (b) {
      var k = +b.dataset.n, locked = k === 4 && !bigOpen();
      b.setAttribute('aria-pressed', String(k === n));
      b.disabled = locked;
      b.innerHTML = (locked ? '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="#FFC93C" stroke="#2A2340" stroke-width="1.8"/><path d="M5 7 V5 Q5 2 8 2 Q11 2 11 5 V7" fill="none" stroke="#2A2340" stroke-width="1.8"/></svg>' : '') + k + '×' + k;
      b.setAttribute('aria-label', k + ' by ' + k + (locked ? ', opens after ' + UNLOCK4 + ' small puzzles' : ''));
    });
  }
  document.querySelectorAll('.size[data-n]').forEach(function (b) { b.addEventListener('click', function () { var k = +b.dataset.n; if (k !== n && !b.disabled) newPuzzle(picId, k); }); });
  $('shuffleBtn').addEventListener('click', function () { newPuzzle(picId, n); });
  function renderDiff() { document.querySelectorAll('.diff').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.d === P.diff)); }); }
  document.querySelectorAll('.diff').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.d === P.diff) return; P.diff = b.dataset.d; save(); renderDiff(); newPuzzle(picId, n); }); });
  renderDiff();
  function renderNums() { $('numBtn').setAttribute('aria-pressed', String(P.nums)); }
  $('numBtn').addEventListener('click', function () { P.nums = !P.nums; save(); renderNums(); });
  var peekBtn = $('peekBtn');
  function peekOn(e) { e.preventDefault(); peek = true; peekBtn.setAttribute('aria-pressed', 'true'); }
  function peekOff() { peek = false; peekBtn.setAttribute('aria-pressed', 'false'); }
  peekBtn.addEventListener('pointerdown', peekOn);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { peekBtn.addEventListener(t, peekOff); });
  peekBtn.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') peekOn(e); });
  peekBtn.addEventListener('keyup', peekOff);
  // the picture chooser
  var thumbs = {};
  function thumb(id) {
    if (thumbs[id]) return thumbs[id];
    var cv = document.createElement('canvas'); cv.width = cv.height = 220;
    cv.getContext('2d').drawImage(picCanvas(id), 0, 0, 220, 220);
    return (thumbs[id] = cv.toDataURL());
  }
  var TICK = '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function openPicker() {
    $('pics').innerHTML = PICTURES.map(function (p) {
      var done = Array.isArray(P.solved[p.id]) && P.solved[p.id].indexOf(n) >= 0;
      return '<button class="pic" type="button" data-pic="' + p.id + '" aria-label="' + p.name + (done ? ', done' : '') + '"><img alt="" src="' + thumb(p.id) + '">' + (done ? '<span class="done">' + TICK + '</span>' : '') + '</button>';
    }).join('');
    $('lockNote').textContent = '';
    $('pickWrap').hidden = false;
  }
  $('picBtn').addEventListener('click', openPicker);
  $('pics').addEventListener('click', function (e) { var b = e.target.closest('[data-pic]'); if (!b) return; $('pickWrap').hidden = true; $('win').hidden = true; newPuzzle(b.dataset.pic, n); });
  $('pickWrap').addEventListener('click', function (e) { if (e.target === $('pickWrap')) $('pickWrap').hidden = true; });
  $('nextBtn').addEventListener('click', nextPicture);
  $('againBtn').addEventListener('click', function () { $('win').hidden = true; newPuzzle(picId, n); });
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); });
  renderSound(); renderNums();

  /* ================= go ================= */
  window.addEventListener('resize', layout);
  var last = performance.now();
  function frame(now) { var dt = Math.min(0.05, (now - last) / 1000); last = now; draw(dt); requestAnimationFrame(frame); }
  newPuzzle(P.pic, P.size);
  requestAnimationFrame(frame);
  // fonts can arrive after the first layout
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  // test hook
  window.__slide = {
    state: function () { return { n: n, cells: cells.slice(), gap: gap, solved: solved, pic: picId, saved: JSON.parse(JSON.stringify(P)) }; },
    solveAllButOne: function () { cells = []; for (var i = 0; i < n * n - 1; i++) cells.push(i); cells.push(-1); gap = n * n - 1; tiles.forEach(function (T, i) { T.pos = i; }); var a = n * n - 2; cells[a + 1] = a; cells[a] = -1; tiles[a].pos = a + 1; gap = a; },
    tap: tapCell, pictures: PICTURES.map(function (p) { return p.id; }), picture: function (id) { return picCanvas(id).toDataURL(); }
  };
})();
