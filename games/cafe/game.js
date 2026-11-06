/* Cat Café – you're the server. Cat customers wait at the counter, each with an order (sushi, burger, pizza
   or pancakes, with its ingredients shown in their bubble). Tap ingredients onto the tray, ring the bell and the
   chef cooks it; then drag the dish (or tap it, then tap the cat) to the cat who ordered it.
   - Right dish: the cat is happy and you get a star.
   - Wrong dish: the cat sends it back and you lose a star. The dish goes back on the pass (or in the bin).
   - Fun: no timers, two cats at a time, cats just doze off if they wait a long time.
   - Challenge: days with more cats, three at the counter and a longer queue. Cats get grumpy as they wait and
     eventually leave, and you lose a star. Finish the day with enough stars to open the next one.
   Saves to GG.setProgress('cafe', { day, best: { day: stars }, served }). */
(function () {
  'use strict';

  var D = window.GGDraw, INK = D.INK, LW = D.LW;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  var rr = D.rr, ink = D.ink;
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }

  /* ================= menu ================= */
  var ING = ['rice', 'fish', 'seaweed', 'bun', 'patty', 'cheese', 'dough', 'sauce', 'batter', 'berries', 'syrup'];
  var ING_NAME = { rice: 'Rice', fish: 'Fish', seaweed: 'Seaweed', bun: 'Bun', patty: 'Patty', cheese: 'Cheese', dough: 'Dough', sauce: 'Tomato sauce', batter: 'Batter', berries: 'Berries', syrup: 'Syrup' };
  var DISHES = [
    { id: 'sushi', name: 'Sushi', need: ['rice', 'fish', 'seaweed'] },
    { id: 'burger', name: 'Burger', need: ['bun', 'patty', 'cheese'] },
    { id: 'pizza', name: 'Pizza', need: ['dough', 'sauce', 'cheese'] },
    { id: 'pancakes', name: 'Pancakes', need: ['batter', 'berries', 'syrup'] }
  ];
  function dishDef(id) { for (var i = 0; i < DISHES.length; i++) if (DISHES[i].id === id) return DISHES[i]; return null; }
  /* what the chef makes from a tray: the dish whose ingredients match exactly (any order), or null */
  function cook(items) {
    var a = items.slice().sort().join();
    for (var i = 0; i < DISHES.length; i++) if (DISHES[i].need.slice().sort().join() === a) return DISHES[i].id;
    return null;
  }

  /* ================= drawing: ingredients (centred, about 100 wide) =================
     House style (shared/draw.js): fill, details clipped inside, outline last. Handles, spoons and whisks start
     inside what holds them and are drawn first, so the bowl (or the food in it) covers the join. */
  /* a blue bowl: `fill` is what's in it. `stuck` (spoon, whisk) is drawn first so the food covers its end;
     `heap` is food piled above the rim, drawn before the bowl's front. */
  function bowl(c, fill, stuck, heap) {
    if (stuck) stuck(c);
    D.shape(c, D.ellPath(0, -6, 40, 11), fill, { lw: LW.mid, depth: 0, shine: [-14, -9, 10, 2.5, 0, 0.5] });
    if (heap) heap(c);
    D.shape(c, function (p) { p.moveTo(40, -6); p.quadraticCurveTo(38, 38, 0, 38); p.quadraticCurveTo(-38, 38, -40, -6); p.ellipse(0, -6, 40, 11, 0, Math.PI, 0, true); p.closePath(); },
      D.tone(c, '#7CC4FF', -6, 38), { lw: LW.mid, depth: 7, inside: function (c) {
        c.beginPath(); c.moveTo(-26, 14); c.quadraticCurveTo(0, 24, 26, 14); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3; c.stroke();
      } });
  }
  function drawIng(c, id) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (id === 'rice') {
      bowl(c, '#FFFFFF', null, function (c) {
        // a heap of rice: filled down to the rim (the bowl's front covers its base), outlined only along the top
        var dome = function (p) { p.moveTo(-36, -6); p.quadraticCurveTo(-30, -34, 0, -34); p.quadraticCurveTo(30, -34, 36, -6); };
        D.shape(c, function (p) { dome(p); p.ellipse(0, -6, 36, 12, 0, 0, Math.PI); p.closePath(); }, D.tone(c, '#FFFFFF', -34, 4), { lw: 0, depth: 5, inside: function (c) {
          c.fillStyle = '#D9CDB4'; [[-16, -16], [-4, -24], [10, -18], [20, -10], [-24, -8], [2, -10]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 4, 2, 0.5, 0, TAU); c.fill(); });
        } });
        c.beginPath(); dome(c); D.ink(c, LW.mid);
      });
    } else if (id === 'fish') {
      c.save(); c.rotate(-0.2);
      D.shape(c, D.rrPath(-40, -20, 80, 40, 14), D.tone(c, '#FF8A5B', -20, 20), { lw: LW.mid, depth: 6, inside: function (c) {
        c.strokeStyle = '#FFD3BD'; c.lineWidth = 5; [-18, 0, 18].forEach(function (x) { c.beginPath(); c.moveTo(x - 6, -24); c.quadraticCurveTo(x + 6, 0, x - 4, 24); c.stroke(); });
      } });
      c.restore();
    } else if (id === 'seaweed') {
      c.save(); c.rotate(0.1);
      D.shape(c, D.rrPath(-36, -36, 72, 72, 6), '#2E4A3A', { lw: LW.mid, depth: 8, shade: 'rgba(0,0,0,.2)', inside: function (c) {
        c.strokeStyle = '#3D6450'; c.lineWidth = 3; for (var i = -24; i <= 24; i += 12) { c.beginPath(); c.moveTo(i, -40); c.lineTo(i, 40); c.stroke(); }
      } });
      c.restore();
    } else if (id === 'bun') {
      // the dome sits on the base, which is drawn over its bottom edge
      D.shape(c, function (p) { p.moveTo(-44, 16); p.quadraticCurveTo(-44, -36, 0, -36); p.quadraticCurveTo(44, -36, 44, 16); p.closePath(); }, D.tone(c, '#F2B25C', -36, 16), { lw: LW.mid, depth: 7, inside: function (c) {
        c.fillStyle = '#FFF6DE'; [[-20, -18], [0, -26], [18, -16], [-6, -10], [28, -4], [-30, -2]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 4, 2.2, 0.6, 0, TAU); c.fill(); });
      } });
      D.shape(c, D.rrPath(-44, 12, 88, 18, 8), D.tone(c, '#FFE2A8', 12, 30), { lw: LW.mid, depth: 4 });
    } else if (id === 'patty') {
      D.shape(c, D.rrPath(-44, -16, 88, 32, 16), D.tone(c, '#8A5034', -16, 16), { lw: LW.mid, depth: 6, shade: 'rgba(0,0,0,.15)', inside: function (c) {
        c.strokeStyle = '#5E3220'; c.lineWidth = 4; [-24, -4, 16].forEach(function (x) { c.beginPath(); c.moveTo(x, -10); c.lineTo(x + 10, 10); c.stroke(); });
      } });
    } else if (id === 'cheese') {
      D.shape(c, function (p) { p.moveTo(-42, 26); p.lineTo(42, 26); p.lineTo(42, -10); p.lineTo(-42, -30); p.closePath(); }, D.tone(c, '#FFD23F', -30, 26), { lw: LW.mid, depth: 6, inside: function (c) {
        // the lighter top face, then the holes
        c.beginPath(); c.moveTo(-50, -34); c.lineTo(50, -12); c.lineTo(50, -2); c.lineTo(-50, -24); c.closePath(); c.fillStyle = '#FFE98A'; c.fill();
        c.fillStyle = '#E8AE00'; circle(c, -16, 8, 7); c.fill(); circle(c, 16, 12, 5); c.fill(); circle(c, 24, -2, 4); c.fill();
      } });
    } else if (id === 'dough') {
      D.shape(c, D.ellPath(0, 6, 44, 22), D.tone(c, '#F7E3C2', -16, 28), { lw: LW.mid, depth: 6, inside: function (c) {
        c.beginPath(); c.ellipse(-8, 0, 22, 9, 0, 0, TAU); c.fillStyle = '#FFF3DD'; c.fill();
        c.fillStyle = '#FFFFFF'; [[-26, 10], [18, -2], [24, 14], [-6, 18]].forEach(function (q) { circle(c, q[0], q[1], 2.5); c.fill(); });
      } });
    } else if (id === 'sauce') {
      bowl(c, '#E8362B', function (c) {
        // a wooden spoon standing in the sauce
        c.save(); c.translate(22, -24); c.rotate(0.6); D.shape(c, D.rrPath(-5, -30, 10, 44, 5), D.tone(c, '#E6B98A', -30, 14), { lw: LW.fine, depth: 3 }); c.restore();
      });
    } else if (id === 'batter') {
      bowl(c, '#FFE7A0', function (c) {
        // a whisk dipped in the batter: wires first, then the handle over their ends
        c.save(); c.translate(16, -20); c.rotate(0.5);
        c.beginPath(); c.ellipse(0, 12, 9, 14, 0, 0, TAU); c.moveTo(0, -2); c.ellipse(0, 12, 4, 14, 0, -Math.PI / 2, Math.PI * 1.5); D.ink(c, LW.fine);
        D.shape(c, D.rrPath(-4, -34, 8, 34, 4), '#C9C2D6', { lw: LW.fine, depth: 2 });
        c.restore();
      });
    } else if (id === 'berries') {
      // back row first, so the front berries overlap them
      [[0, -14, '#FF4D6A'], [-26, -14, '#FF4D6A'], [26, -12, '#4D6BFF'], [-16, 8, '#4D6BFF'], [16, 8, '#4D6BFF']].forEach(function (b) {
        D.shape(c, D.ellPath(b[0], b[1], 15, 15), b[2], { lw: LW.fine, depth: 5, shine: [b[0] - 5, b[1] - 5, 4, 3, -0.5, 0.7] });
      });
    } else if (id === 'syrup') {
      // the cap goes on first; the bottle's neck covers its lower edge
      D.shape(c, D.rrPath(-10, -44, 20, 14, 4), '#FF6B57', { lw: LW.fine, depth: 3 });
      D.shape(c, function (p) { p.moveTo(-22, 40); p.lineTo(-22, -4); p.quadraticCurveTo(-22, -18, -8, -22); p.lineTo(-8, -34); p.lineTo(8, -34); p.lineTo(8, -22); p.quadraticCurveTo(22, -18, 22, -4); p.lineTo(22, 40); p.closePath(); },
        D.tone(c, '#C9711A', -34, 40), { lw: LW.mid, depth: 7, inside: function (c) {
          D.shape(c, D.rrPath(-16, 2, 32, 24, 5), '#FFF3E4', { lw: LW.fine, depth: 0 });
          c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(8, 16, 0, 22); c.quadraticCurveTo(-8, 16, 0, 6); c.fillStyle = '#C9711A'; c.fill();
          c.beginPath(); c.moveTo(-15, -6); c.lineTo(-15, -2); c.moveTo(-15, 30); c.lineTo(-15, 36); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 4; c.stroke();
        } });
    }
  }

  /* the four dishes, drawn in the same style: a plate, then the food. Centred, about 200 wide. */
  function plate(c) {
    D.shadow(c, 0, 36, 92, 30);
    D.shape(c, D.ellPath(0, 30, 96, 34), D.tone(c, '#FFFFFF', -4, 64), { lw: LW.big, depth: 8, inside: function (c) {
      c.beginPath(); c.ellipse(0, 28, 70, 22, 0, 0, TAU); c.strokeStyle = '#E9E3F2'; c.lineWidth = 3; c.stroke();
    } });
  }
  function drawSushi(c) {
    plate(c);
    [[-52, 20], [52, 20], [0, 8]].sort(function (a, b) { return a[1] - b[1]; }).forEach(function (q) {
      c.save(); c.translate(q[0], q[1]);
      // a maki roll standing up: the nori side, then its top with the rice and filling inside it
      D.shape(c, function (p) { p.moveTo(-30, -14); p.lineTo(-30, 14); p.ellipse(0, 14, 30, 11, 0, Math.PI, 0, true); p.lineTo(30, -14); p.closePath(); }, '#2E4A3A', { lw: LW.mid, depth: 6, shade: 'rgba(0,0,0,.2)' });
      D.shape(c, D.ellPath(0, -14, 30, 11), '#2E4A3A', { lw: LW.mid, depth: 0, inside: function (c) {
        c.beginPath(); c.ellipse(0, -14, 25, 8.5, 0, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
        c.beginPath(); c.ellipse(-3, -15, 9, 4, 0, 0, TAU); c.fillStyle = '#FF8A5B'; c.fill();
        c.beginPath(); c.ellipse(8, -13, 4, 2.5, 0, 0, TAU); c.fillStyle = '#7BD389'; c.fill();
      } });
      c.restore();
    });
  }
  function drawBurger(c) {
    plate(c);
    c.save(); c.translate(0, 20);
    D.shape(c, D.rrPath(-58, -10, 116, 26, 12), D.tone(c, '#F2B25C', -10, 16), { lw: LW.mid, depth: 5 });
    D.shape(c, D.rrPath(-64, -34, 128, 28, 14), D.tone(c, '#8A5034', -34, -6), { lw: LW.mid, depth: 5, shade: 'rgba(0,0,0,.15)' });
    D.shape(c, function (p) { p.moveTo(-60, -38); p.lineTo(60, -38); p.lineTo(58, -30); p.lineTo(44, -30); p.lineTo(38, -14); p.lineTo(30, -30); p.lineTo(-10, -30); p.lineTo(-18, -16); p.lineTo(-26, -30); p.lineTo(-60, -30); p.closePath(); }, '#FFD23F', { lw: LW.fine, depth: 0 });
    D.shape(c, function (p) { p.moveTo(-62, -36); p.quadraticCurveTo(-62, -96, 0, -96); p.quadraticCurveTo(62, -96, 62, -36); p.closePath(); }, D.tone(c, '#F2B25C', -96, -36), { lw: LW.mid, depth: 9,
      shine: [-26, -76, 16, 6, -0.4, 0.4], inside: function (c) {
        c.fillStyle = '#FFF6DE'; [[-30, -64], [-6, -80], [20, -70], [38, -54], [-42, -48], [4, -56]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 5, 2.6, 0.5, 0, TAU); c.fill(); });
      } });
    c.restore();
  }
  function drawPancakes(c) {
    plate(c);
    for (var i = 0; i < 4; i++) {
      var y = 22 - i * 16;
      D.shape(c, D.ellPath(0, y + 6, 66, 18), '#D9913F', { lw: LW.mid, depth: 0 });
      D.shape(c, D.ellPath(0, y, 66, 18), D.tone(c, '#F4C16A', y - 18, y + 18), { lw: LW.mid, depth: 0, inside: i < 3 ? null : function (c) {
        // syrup on the top pancake (its drips run down over the edge in front)
        c.beginPath(); c.ellipse(0, -26, 44, 11, 0, 0, TAU); c.fillStyle = '#C9711A'; c.fill();
      } });
    }
    c.fillStyle = '#C9711A';
    c.beginPath(); c.moveTo(30, -22); c.quadraticCurveTo(40, 0, 36, 10); c.quadraticCurveTo(30, 6, 24, -18); c.fill();
    c.beginPath(); c.moveTo(-36, -24); c.quadraticCurveTo(-46, -6, -42, 2); c.quadraticCurveTo(-36, 0, -28, -20); c.fill();
    D.shape(c, D.rrPath(-10, -46, 20, 12, 3), '#FFF3B0', { lw: LW.fine, depth: 0 });
    [[-14, -32, '#4D6BFF'], [6, -36, '#FF4D6A'], [18, -28, '#4D6BFF'], [-2, -24, '#4D6BFF']].forEach(function (b) { D.shape(c, D.ellPath(b[0], b[1], 8, 8), b[2], { lw: LW.fine, depth: 3, shine: [b[0] - 3, b[1] - 3, 2.5, 2, 0, 0.7] }); });
  }
  function drawPizza(c) {
    plate(c);
    c.save(); c.translate(0, 18);
    D.shape(c, D.ellPath(0, 2, 82, 32), D.tone(c, '#E8A85C', -30, 34), { lw: LW.big, depth: 6, inside: function (c) {
      c.beginPath(); c.ellipse(0, 0, 70, 25, 0, 0, TAU); c.fillStyle = '#E8362B'; c.fill();
      c.beginPath();
      for (var i = 0; i <= 24; i++) { var a = i / 24 * TAU, r = 62 + Math.sin(i * 2.7) * 4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.36); }
      c.closePath(); c.fillStyle = '#FFE07A'; c.fill();
      [[-32, -6], [10, -12], [36, 4], [-8, 9], [-48, 6], [24, -2]].forEach(function (q) { D.shape(c, D.ellPath(q[0], q[1], 9, 4), '#D83A3A', { lw: 2.5, depth: 0 }); });
      c.fillStyle = '#4FB868'; [[-18, -2], [28, -12], [4, 3]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 4, 2, 0.5, 0, TAU); c.fill(); });
    } });
    c.restore();
  }
  var DRAW_DISH = { sushi: drawSushi, burger: drawBurger, pizza: drawPizza, pancakes: drawPancakes };
  function drawDish(c, id, size) {
    c.save(); var k = size / 200; c.scale(k, k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    (DRAW_DISH[id] || drawPizza)(c);
    c.restore();
  }

  /* pictures, drawn once and reused */
  var pics = {};
  function picture(key, w, h, fn) {
    if (pics[key]) return pics[key];
    var cv = document.createElement('canvas'), s = 2;
    cv.width = w * s; cv.height = h * s;
    var c = cv.getContext('2d'); c.scale(s, s); c.translate(w / 2, h / 2); fn(c);
    pics[key] = cv; return cv;
  }
  function ingPic(id) { return picture('i-' + id, 110, 110, function (c) { drawIng(c, id); }); }
  function dishPic(id) { return picture('d-' + id, 210, 170, function (c) { c.translate(0, 10); drawDish(c, id, 200); }); }
  function blit(c, cv, x, y, w) { var h = w * cv.height / cv.width; c.drawImage(cv, x - w / 2, y - h / 2, w, h); }

  /* ================= saved progress ================= */
  var MAX_DAY = 15;
  var P = (function () {
    var p = {};
    try { p = GG.getProgress('cafe') || {}; } catch (e) {}
    if (typeof p.day !== 'number' || p.day < 1) p.day = 1;
    if (!p.best || typeof p.best !== 'object') p.best = {};
    if (typeof p.served !== 'number') p.served = 0;
    return p;
  })();
  function save() { try { GG.setProgress('cafe', P); } catch (e) {} }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var topbar = $('topbar'), shelf = $('shelf');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, L = null;
  function makeLayout(tall, n, aspect) {
    // tall screens: the scene is 600 wide and as tall as the space allows (750..900), so it fills a phone's width;
    // shorter scenes use a slightly smaller hatch, customers and bubbles to make the room
    var tH = tall ? clamp(Math.round(600 / (aspect || 0.667)), 750, 900) : 900, cmp = tH < 860;
    var l = tall ? (cmp ? {
      W: 600, H: tH, tall: true, CY: tH - 130, size: 114,
      hatch: { x: 150, y: 28, w: 300, h: 180 }, ledgeY: 214, pass: [{ x: 228, y: 214 }, { x: 372, y: 214 }],
      queue: { x: 300, y: 276 }, bin: { x: 300, y: tH - 50 }, bubbleW: 150, bubbleH: 116
    } : {
      W: 600, H: tH, tall: true, CY: tH - 130, size: 128,
      hatch: { x: 140, y: 34, w: 320, h: 214 }, ledgeY: 262, pass: [{ x: 228, y: 262 }, { x: 372, y: 262 }],
      queue: { x: 300, y: 372 }, bin: { x: 300, y: tH - 50 }, bubbleW: 156, bubbleH: 128
    }) : {
      W: 1000, H: 600, tall: false, CY: 450, size: 142,
      hatch: { x: 40, y: 40, w: 320, h: 222 }, ledgeY: 276, pass: [{ x: 128, y: 276 }, { x: 272, y: 276 }],
      queue: { x: 700, y: 48 }, bin: { x: 300, y: 530 }, bubbleW: 160, bubbleH: 128
    };
    var x0 = tall ? 104 : 500, x1 = tall ? 496 : 880;
    l.slots = [];
    for (var i = 0; i < n; i++) l.slots.push(n === 1 ? (x0 + x1) / 2 : n === 2 ? lerp(x0, x1, 0.2 + i * 0.6) : lerp(x0, x1, i / (n - 1)));
    return l;
  }
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var bottom = shelf.getBoundingClientRect().top - 8;
    document.documentElement.style.setProperty('--bar-h', Math.round(ch - shelf.getBoundingClientRect().top) + 'px');
    var availW = cw - 16, availH = Math.max(120, bottom - top);
    L = makeLayout(availW / availH < 1.15, G ? G.nSlots : 3, availW / availH);
    K = Math.min(availW / L.W, availH / L.H);
    OX = (cw - L.W * K) / 2; OY = top + (availH - L.H * K) / 2;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  /* ================= game state ================= */
  var G = null;            // the current shift
  var time = 0, parts = [];
  var CUSTOMER_LOOKS = [
    { preset: 'ginger' }, { preset: 'pink' }, { preset: 'blue' }, { preset: 'purple' }, { preset: 'black' }, { preset: 'white' },
    { color: '#C9C2D6', markings: 'tabby', dark: '#8E86A0' }, { color: '#FFFFFF', markings: 'calico' }, { color: '#FFD9A8', build: 'chubby' },
    { color: '#A7E3B8', extra: 'bow' }, { color: '#8A5034', inner: '#E8A07A', markings: 'tabby', dark: '#5E3220' }
  ];
  var nextId = 1;
  function dayRules(d) {
    return {
      total: Math.min(26, 6 + 2 * d),
      gap: Math.max(3.2, 9 - 0.6 * d),          // seconds between new cats joining the queue
      patience: Math.max(32, 80 - 5 * d),       // seconds a cat waits at the counter
      menu: d === 1 ? ['sushi', 'burger', 'pizza'] : DISHES.map(function (x) { return x.id; })
    };
  }
  function newCustomer() {
    var look = pick(CUSTOMER_LOOKS);
    var last = G.lastOrder, order;
    do { order = pick(G.menu); } while (order === last && G.menu.length > 1 && Math.random() < 0.6);
    G.lastOrder = order;
    return { id: nextId++, look: look, order: order, state: 'queue', t: 0, pat: G.patience, patMax: G.patience, wait: 0, shake: 0, mood: '' };
  }
  function start(mode, day) {
    if (window.GG && GG.track) GG.track('Start day', { game: 'cafe', mode: mode, day: day || 0 });
    var chal = mode === 'chal';
    var R = chal ? dayRules(day) : null;
    G = {
      mode: mode, day: day || 0, stars: 0, served: 0, wrong: 0, left: 0,
      nSlots: chal ? 3 : 2, total: chal ? R.total : Infinity, spawned: 0, gap: chal ? R.gap : 2.5, patience: chal ? R.patience : 0,
      menu: chal ? R.menu : DISHES.map(function (x) { return x.id; }),
      queue: [], slots: [], pass: [null, null], tray: [], chef: { state: 'idle', t: 0, items: [] },
      spawnT: 0.4, ended: false, lastOrder: null, sel: -1
    };
    for (var i = 0; i < G.nSlots; i++) G.slots.push(null);
    // a couple of cats are already waiting when the café opens
    var first = chal ? 3 : 2;
    for (var j = 0; j < first; j++) { G.queue.push(newCustomer()); G.spawned++; }
    drag = null;
    $('startWrap').hidden = true; $('endWrap').hidden = true;
    $('menuBtn').hidden = false;
    $('leftPill').hidden = !chal;
    layout(); renderTray(); renderHud();
    say(chal ? 'Day ' + day + '. Here come the customers!' : 'The café is open!', 1.8);
  }
  function remaining() { return G.total === Infinity ? 0 : G.total - G.served - G.left; }

  function renderHud(kind) {
    $('stars').textContent = G ? G.stars : 0;
    if (G && G.mode === 'chal') $('left').textContent = remaining();
    var pill = $('starPill');
    if (kind) { pill.classList.remove('bump', 'ouch'); void pill.offsetWidth; pill.classList.add(kind); }
  }
  function addStars(n, x, y) {
    var before = G.stars;
    G.stars = Math.max(0, G.stars + n);
    if (n > 0) { textPart('+' + n, x, y, '#E0A100'); sparkle(x, y, '#FFD23F', 10, 1); renderHud('bump'); }
    else { textPart(before > 0 ? '−' + (-n) : '−', x, y, '#FF5A5F'); renderHud('ouch'); }
  }

  /* ================= the shelf and the tray ================= */
  function renderShelf() {
    var html = '';
    ING.forEach(function (id) {
      html += '<button class="ing" type="button" data-ing="' + id + '" aria-label="' + ING_NAME[id] + '"><img alt="" src="' + ingPic(id).toDataURL() + '"></button>';
    });
    $('ings').innerHTML = html;
  }
  function renderTray() {
    var html = '';
    for (var i = 0; i < 3; i++) {
      var id = G && G.tray[i];
      html += id ? '<button class="slot full" type="button" data-slot="' + i + '" aria-label="' + ING_NAME[id] + ' on the tray, tap to take it off"><img alt="" src="' + ingPic(id).toDataURL() + '"></button>'
        : '<span class="slot" aria-hidden="true"></span>';
    }
    $('tray').innerHTML = html;
    updateBell();
  }
  function passFull() { return G.pass[0] && G.pass[1]; }
  function updateBell() {
    var ok = G && !G.ended && G.tray.length > 0 && G.chef.state === 'idle' && !passFull();
    $('bell').disabled = !ok;
  }
  $('ings').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ing]'); if (!b || !G || G.ended) return;
    Sound.init();
    if (G.tray.length >= 3) { Sound.nope(); say('The tray is full! Ring the bell.', 1.6); return; }
    G.tray.push(b.dataset.ing); Sound.pop(); buzz(5);
    renderTray();
  });
  $('tray').addEventListener('click', function (e) {
    var b = e.target.closest('[data-slot]'); if (!b || !G) return;
    Sound.init(); Sound.putAway();
    G.tray.splice(+b.dataset.slot, 1); renderTray();
  });
  $('bell').addEventListener('click', function () {
    if (!G || $('bell').disabled) return;
    Sound.init(); Sound.bell(); buzz(10);
    G.chef = { state: 'cook', t: 0, items: G.tray.slice(), dish: cook(G.tray) };
    G.tray = []; renderTray();
  });

  /* ================= customers ================= */
  function freeSlot() { for (var i = 0; i < G.slots.length; i++) if (!G.slots[i]) return i; return -1; }
  function custXY(i) { return { x: L.slots[i], y: L.CY }; }
  function update(dt) {
    if (!G || G.ended) return;
    // new cats join the queue
    var waitingRoom = G.mode === 'chal' ? 8 : 1;
    if (G.spawned < G.total && G.queue.length < waitingRoom) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) { G.queue.push(newCustomer()); G.spawned++; G.spawnT = G.gap * rand(0.8, 1.2); }
    }
    // the cat at the front of the queue steps up to a free spot at the counter
    G.stepT = (G.stepT || 0) - dt;
    var f = freeSlot();
    if (f >= 0 && G.queue.length && G.stepT <= 0) {
      var cu = G.queue.shift(); cu.state = 'in'; cu.t = 0; cu.slot = f; G.slots[f] = cu; G.stepT = 0.7;
      Sound.mrrp();
    }
    G.slots.forEach(function (cu, i) {
      if (!cu) return;
      cu.t += dt;
      if (cu.shake > 0) cu.shake -= dt;
      if (cu.state === 'in' && cu.t > 0.6) { cu.state = 'wait'; cu.t = 0; }
      else if (cu.state === 'wait') {
        cu.wait += dt;
        if (G.mode === 'chal') {
          cu.pat -= dt;
          var r = cu.pat / cu.patMax;
          if (r < 0.4 && cu.mood !== 'grumpy') { cu.mood = 'grumpy'; Sound.huff(); }
          if (cu.pat <= 0) {
            cu.state = 'out'; cu.t = 0; cu.mood = 'cross'; G.left++;
            var q = custXY(i); addStars(-1, q.x, q.y - 200);
            Sound.leave(); say('That cat got tired of waiting…', 1.6);
            renderHud();
          }
        } else if (cu.wait > 30 && cu.mood !== 'doze') cu.mood = 'doze';
      } else if (cu.state === 'eat' && cu.t > 1.3) { cu.state = 'out'; cu.t = 0; }
      else if (cu.state === 'out' && cu.t > 0.6) { G.slots[i] = null; }
    });
    // the chef
    var C = G.chef;
    if (C.state !== 'idle') {
      C.t += dt;
      if (C.state === 'cook') {
        if (Math.random() < dt * 8) Sound.sizzle();
        if (C.t > (reduceMotion ? 0.8 : 1.6)) {
          if (C.dish) {
            var s = G.pass[0] ? 1 : 0;
            G.pass[s] = { id: C.dish, t: 0 };
            var p = L.pass[s]; sparkle(p.x, p.y - 30, '#FFD23F', 8, 0.8);
            Sound.ready(); C.state = 'idle'; C.t = 0;
          } else {
            C.state = 'huh'; C.t = 0; Sound.nope();
            say('Hmm, that’s not on the menu!', 1.8);
          }
        }
      } else if (C.state === 'huh' && C.t > 1.3) { C.state = 'idle'; C.t = 0; }
      updateBell();
    }
    G.pass.forEach(function (d) { if (d) d.t += dt; });
    // end of a challenge day
    if (G.mode === 'chal' && G.spawned >= G.total && !G.queue.length && G.slots.every(function (x) { return !x; })) endDay();
  }

  /* serve dish in pass spot `s` to the cat at counter spot `i` */
  function serve(s, i) {
    var d = G.pass[s], cu = G.slots[i];
    if (!d || !cu || cu.state !== 'wait') return false;
    var q = custXY(i);
    if (d.id === cu.order) {
      G.pass[s] = null; cu.state = 'eat'; cu.t = 0; cu.mood = 'happy'; cu.got = d.id;
      G.served++; P.served++; save();
      if (GG.stat) GG.stat('cafe', 'served', 1);
      addStars(1, q.x, q.y - 200);
      heart(q.x - 20, q.y - 150); heart(q.x + 24, q.y - 170);
      Sound.yum(); buzz(20);
    } else {
      // sent back: the dish stays on the pass
      cu.shake = 0.6; cu.mood = cu.mood === 'grumpy' ? 'grumpy' : 'huh'; cu.huhT = 1.2;
      G.wrong++;
      addStars(-1, q.x, q.y - 200);
      Sound.nope(); buzz([20, 40, 20]);
      say('That’s not what I ordered!', 1.6);
      d.back = 0.5;
    }
    G.sel = -1; updateBell(); renderHud();
    return true;
  }
  function trash(s) {
    if (!G.pass[s]) return;
    var p = L.bin; sparkle(p.x, p.y - 40, '#C9C2D6', 6, 0.6);
    G.pass[s] = null; G.sel = -1; Sound.putAway(); updateBell();
  }

  function endDay() {
    G.ended = true;
    if (window.GG && GG.track) GG.track('Finish day', { game: 'cafe', mode: G.mode, day: G.day });
    var ratio = G.stars / G.total;
    var rating = ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.35 ? 1 : 0;
    var d = G.day;
    if (rating > (P.best[d] || 0)) P.best[d] = rating;
    var opened = rating > 0 && d === P.day && d < MAX_DAY;
    if (opened) P.day = d + 1;
    save();
    if (rating > 0 && GG.stat) GG.stat('cafe', 'days', 1);
    setTimeout(function () {
      var html = '';
      for (var i = 0; i < 3; i++) html += '<svg viewBox="0 0 32 32"><path d="M16 3 L19.8 11.6 L29 12.4 L22 18.6 L24.2 27.8 L16 22.8 L7.8 27.8 L10 18.6 L3 12.4 L12.2 11.6 Z" fill="' + (i < rating ? '#FFD23F' : '#EEE8F3') + '" stroke="#2A2340" stroke-width="2.4" stroke-linejoin="round"/></svg>';
      $('bigStars').innerHTML = html;
      $('endTitle').textContent = rating === 3 ? 'Amazing day!' : rating ? 'Day ' + d + ' done!' : 'Busy day!';
      $('endNote').textContent = 'You served ' + G.served + ' of ' + G.total + ' cats and kept ' + G.stars + ' star' + (G.stars === 1 ? '' : 's') + '.' +
        (rating ? (opened ? ' Day ' + (d + 1) + ' is open!' : '') : ' Try again to open the next day.');
      $('nextBtn').hidden = !(rating > 0 && d < MAX_DAY && d + 1 <= P.day);
      $('endWrap').hidden = false;
      (rating ? Sound.chime : Sound.leave)();
      ($('nextBtn').hidden ? $('againBtn') : $('nextBtn')).focus();
    }, 700);
  }
  $('nextBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); start('chal', Math.min(G.day + 1, P.day)); });
  $('againBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); start('chal', G.day); });
  $('endMenuBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); showMenu(); });
  $('menuBtn').addEventListener('click', function () { Sound.init(); Sound.putAway(); showMenu(); });

  function showMenu() {
    G = null; drag = null;
    $('endWrap').hidden = true; $('startWrap').hidden = false; $('days').hidden = true;
    $('menuBtn').hidden = true; $('leftPill').hidden = true;
    renderTray(); renderHud(); layout();
  }
  $('funBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); start('fun'); });
  $('chalBtn').addEventListener('click', function () {
    Sound.init(); Sound.pop();
    if (P.day <= 1) { start('chal', 1); return; }
    var html = '';
    for (var d = 1; d <= P.day; d++) {
      var b = P.best[d] || 0;
      html += '<button class="day' + (d === P.day ? ' now' : '') + '" type="button" data-day="' + d + '" aria-label="Day ' + d + (b ? ', ' + b + ' stars' : '') + '">Day ' + d + '<small>' + '★★★'.slice(0, b) + '</small></button>';
    }
    $('days').innerHTML = html; $('days').hidden = false;
    var now = $('days').querySelector('.now'); if (now) now.focus();
  });
  $('days').addEventListener('click', function (e) { var b = e.target.closest('[data-day]'); if (!b) return; Sound.init(); Sound.pop(); start('chal', +b.dataset.day); });

  /* ================= input: drag (or tap) a dish to a cat ================= */
  var drag = null;
  function passHit(x, y) {
    for (var s = 0; s < 2; s++) { var p = L.pass[s]; if (G.pass[s] && Math.abs(x - p.x) < 68 && y > p.y - 90 && y < p.y + 30) return s; }
    return -1;
  }
  function custHit(x, y) {
    var half = (L.slots.length > 1 ? Math.abs(L.slots[1] - L.slots[0]) : 300) / 2;
    for (var i = 0; i < G.slots.length; i++) {
      var cu = G.slots[i]; if (!cu || cu.state !== 'wait') continue;
      if (Math.abs(x - L.slots[i]) < Math.min(half, 120) && y > L.CY - L.size * 1.25 - L.bubbleH - 30 && y < L.CY + 40) return i;
    }
    return -1;
  }
  function binHit(x, y) { return Math.abs(x - L.bin.x) < 60 && Math.abs(y - (L.bin.y - 40)) < 60; }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (!G || G.ended) return;
    var r = toScene(e.clientX, e.clientY);
    var s = passHit(r.x, r.y);
    if (s >= 0) {
      drag = { s: s, id: e.pointerId, x: r.x, y: r.y, sx: e.clientX, sy: e.clientY, moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      Sound.pick();
      return;
    }
    if (G.sel >= 0) {
      var i = custHit(r.x, r.y);
      if (i >= 0) { serve(G.sel, i); return; }
      if (binHit(r.x, r.y)) { trash(G.sel); return; }
      G.sel = -1;
    } else {
      var j = custHit(r.x, r.y);
      if (j >= 0) { G.slots[j].shake = 0.25; Sound.mrrp(); say('Make the ' + dishDef(G.slots[j].order).name.toLowerCase() + ', then bring it to me!', 2); }
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var r = toScene(e.clientX, e.clientY);
    drag.x = r.x; drag.y = r.y;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    if (!G) return;
    if (!d.moved) { G.sel = G.sel === d.s ? -1 : d.s; Sound.pop(); return; }
    var i = custHit(d.x, d.y);
    if (i >= 0) { serve(d.s, i); return; }
    if (binHit(d.x, d.y)) { trash(d.s); return; }
    Sound.putAway(); G.sel = -1;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', function (e) { if (drag && drag.id === e.pointerId) drag = null; });

  /* ================= particles ================= */
  function textPart(text, x, y, color) { parts.push({ x: x, y: y, vx: 0, vy: -60, life: 0, max: 1.1, r: 30, color: color, kind: 'text', text: text, g: 0 }); }

  /* ================= drawing the café ================= */
  function catOpts(look, extra) { var o = {}; var k; for (k in look) o[k] = look[k]; for (k in extra) o[k] = extra[k]; return o; }
  /* a cat peeking over a ledge at y, centre x */
  function peekCat(c, x, y, size, opts) {
    var k = size / 88;
    c.save(); c.translate(x, y - 50 * k);
    GGCat.draw(c, catOpts(opts, { pose: 'peek', size: size }));
    c.restore();
  }
  function drawWall(c) {
    var W = L.W, H = L.H;
    c.fillStyle = '#FFF1DC'; c.fillRect(0, 0, W, L.CY);
    c.fillStyle = '#FFE4C4'; for (var x = 20; x < W; x += 64) c.fillRect(x, 0, 30, L.CY);
    // bunting: the flags first, then the string over their tops.
    // tall screens: two short strings either side of the hatch (clear of the queue and the order bubbles)
    var runs = L.tall ? [[8, L.hatch.x - 34, L.hatch.y + 30], [L.hatch.x + L.hatch.w + 34, W - 8, L.hatch.y + 30]] : [[380, W - 20, 24]];
    var cols = ['#FF8FAB', '#FFD23F', '#7CC4FF', '#7BD389', '#B48CFF'];
    runs.forEach(function (r, ri) {
      var xs = r[0], xe = r[1], y0 = r[2], sag = L.tall ? 18 : 30;
      var n = Math.max(2, Math.floor((xe - xs) / 46));
      for (var i = 0; i <= n; i++) {
        var t = (i + 0.5) / (n + 1), bx = lerp(xs, xe, t), by = y0 + sag * 2 * t * (1 - t);
        D.shape(c, function (p) { p.moveTo(bx - 13, by - 1); p.lineTo(bx + 13, by - 1); p.lineTo(bx, by + 24); p.closePath(); }, cols[(i + ri * 2) % cols.length], { lw: LW.fine, depth: 4 });
      }
      c.beginPath(); c.moveTo(xs, y0); c.quadraticCurveTo((xs + xe) / 2, y0 + sag, xe, y0); D.ink(c, LW.fine);
    });
  }
  function drawHatch(c) {
    var h = L.hatch, C = G ? G.chef : { state: 'idle', t: 0 };
    // kitchen through the hatch
    rr(c, h.x, h.y, h.w, h.h, 16); c.fillStyle = '#E3F1F6'; c.fill();
    c.save(); rr(c, h.x, h.y, h.w, h.h, 16); c.clip();
    c.strokeStyle = '#C8E2EC'; c.lineWidth = 3;
    for (var x = h.x; x < h.x + h.w; x += 32) { c.beginPath(); c.moveTo(x, h.y); c.lineTo(x, h.y + h.h); c.stroke(); }
    for (var y = h.y; y < h.y + h.h; y += 32) { c.beginPath(); c.moveTo(h.x, y); c.lineTo(h.x + h.w, y); c.stroke(); }
    // pots hanging on hooks: the hook line and the side handles tuck in behind each pot
    [[h.x + 40, '#FF6B57'], [h.x + h.w - 44, '#7CC4FF']].forEach(function (p) {
      c.beginPath(); c.moveTo(p[0], h.y); c.lineTo(p[0], h.y + 34); D.ink(c, LW.fine);
      [-1, 1].forEach(function (s) { D.shape(c, D.rrPath(p[0] + s * 17 - 7, h.y + 32, 14, 8, 4), D.darker(p[1], 0.2), { lw: LW.fine, depth: 0 }); });
      D.shape(c, D.rrPath(p[0] - 20, h.y + 26, 40, 30, 8), D.tone(c, p[1], h.y + 26, h.y + 56), { lw: LW.fine, depth: 5, shine: [p[0] - 10, h.y + 33, 5, 2.5, 0, 0.55] });
    });
    // the chef
    var bob = C.state === 'cook' ? Math.sin(time * 18) * 3 : Math.sin(time * 2) * 1.5;
    var face = C.state === 'cook' ? 'happy' : C.state === 'huh' ? 'surprised' : (Math.sin(time * 0.8) > 0.97 ? 'blink' : 'open');
    var cx = h.x + h.w / 2, ly = h.y + h.h;
    c.save(); c.translate(0, bob);
    peekCat(c, cx, ly + 2, L.tall ? 120 : 126, { preset: 'chef', face: face });
    c.restore();
    // a pan while cooking, with steam: the handle goes in first and the pan covers its end
    if (C.state === 'cook') {
      var px = cx + 74, py = ly - 18 + Math.sin(time * 20) * 3;
      c.save(); c.translate(px, py); c.rotate(Math.sin(time * 10) * 0.08);
      D.shape(c, D.rrPath(22, -4, 48, 9, 4.5), '#8E7FA8', { lw: LW.fine, depth: 0 });
      D.shape(c, D.ellPath(0, 0, 34, 12), '#4A4458', { lw: LW.fine, depth: 4, shade: 'rgba(0,0,0,.25)', shine: [-12, -4, 10, 2.5, 0, 0.25] });
      c.restore();
      for (var i = 0; i < 3; i++) {
        var ph = (time * 1.2 + i / 3) % 1;
        c.globalAlpha = 0.7 * (1 - ph); circle(c, px - 14 + i * 14 + Math.sin(time * 3 + i) * 6, py - 20 - ph * 60, 9 + ph * 8); c.fillStyle = '#fff'; c.fill(); c.globalAlpha = 1;
      }
    }
    if (C.state === 'huh') {
      c.font = '800 46px "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = INK;
      c.fillText('?', cx + 70, h.y + 70 + Math.sin(time * 6) * 4);
    }
    c.restore();
    rr(c, h.x, h.y, h.w, h.h, 16); D.ink(c, LW.big);
    // awning: one scalloped strip, its stripes clipped inside, outlined once
    var aw = h.w + 40, ax = h.x - 20, ay = h.y - 22, nS = 8, sw = aw / nS;
    D.shape(c, function (p) {
      p.moveTo(ax, ay); p.lineTo(ax + aw, ay); p.lineTo(ax + aw, ay + 26);
      for (var s = nS - 1; s >= 0; s--) p.arc(ax + s * sw + sw / 2, ay + 26, sw / 2, 0, Math.PI);
      p.closePath();
    }, '#FFFFFF', { lw: LW.fine, depth: 6, inside: function (c) {
      c.fillStyle = '#FF8FAB'; for (var s = 0; s < nS; s += 2) c.fillRect(ax + s * sw, ay - 2, sw, 60);
      c.strokeStyle = INK; c.lineWidth = LW.fine; for (var s2 = 1; s2 < nS; s2++) { c.beginPath(); c.moveTo(ax + s2 * sw, ay); c.lineTo(ax + s2 * sw, ay + 26); c.stroke(); }
    } });
    // the pass: a ledge where finished dishes wait, on brackets that tuck in under it
    [h.x + 10, h.x + h.w - 10].forEach(function (bx) { c.beginPath(); c.moveTo(bx, L.ledgeY + 10); c.lineTo(bx + (bx < h.x + h.w / 2 ? 18 : -18), L.ledgeY + 40); D.ink(c, LW.mid); });
    D.shape(c, D.rrPath(h.x - 26, L.ledgeY, h.w + 52, 18, 6), D.tone(c, '#E6B98A', L.ledgeY, L.ledgeY + 18), { lw: LW.mid, depth: 5 });
  }
  function drawPass(c) {
    if (!G) return;
    G.pass.forEach(function (d, s) {
      if (!d) return;
      if (drag && drag.s === s && drag.moved) return;
      var p = L.pass[s];
      var k = easeBack(d.t / 0.4);
      var dx = 0;
      if (d.back > 0) { d.back -= 1 / 60; dx = Math.sin(d.back * 40) * 6; }
      c.save(); c.translate(p.x + dx, p.y - 26); c.scale(k, k);
      if (G.sel === s) { c.globalAlpha = 0.5 + 0.3 * Math.sin(time * 6); ell(c, 0, 4, 76, 46); c.fillStyle = '#FFE14D'; c.fill(); c.globalAlpha = 1; }
      blit(c, dishPic(d.id), 0, 0, 124);
      c.restore();
    });
  }
  function drawCounter(c) {
    var W = L.W, y = L.CY;
    c.fillStyle = D.tone(c, '#C98B5B', y, L.H); c.fillRect(0, y, W, L.H - y);
    c.strokeStyle = '#B57A4C'; c.lineWidth = 4;
    for (var x = 60; x < W; x += 150) { rr(c, x, y + 34, 110, L.H - y - 50, 10); c.stroke(); }
    D.shape(c, D.rrPath(-10, y - 4, W + 20, 26, 8), D.tone(c, '#E6B98A', y - 4, y + 22), { lw: LW.mid, depth: 6 });
    // bin for unwanted dishes: the lid sits on the bin, the slats are inside it
    var b = L.bin;
    c.save(); c.translate(b.x, b.y);
    D.shadow(c, 0, 2, 34, 7);
    D.shape(c, function (p) { p.moveTo(-30, -70); p.lineTo(30, -70); p.lineTo(24, 0); p.lineTo(-24, 0); p.closePath(); }, D.tone(c, '#9BD7C4', -70, 0), { lw: LW.mid, depth: 7, inside: function (c) {
      c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 3; [-12, 0, 12].forEach(function (x) { c.beginPath(); c.moveTo(x, -54); c.lineTo(x * 0.8, -12); c.stroke(); });
    } });
    D.shape(c, D.rrPath(-36, -78, 72, 14, 6), D.tone(c, '#7CC4AE', -78, -64), { lw: LW.fine, depth: 4 });
    var hot = drag && drag.moved && binHit(drag.x, drag.y);
    if (hot) { rr(c, -44, -88, 88, 96, 16); c.strokeStyle = '#7BD389'; c.lineWidth = 5; c.stroke(); }
    c.restore();
  }
  function drawQueue(c) {
    if (!G) return;
    var q = G.queue, n = Math.min(q.length, 6), sp = 52, size = 46;
    if (!n) return;
    var x0 = L.tall ? L.queue.x - (n - 1) * sp / 2 : L.queue.x + 220 - (n - 1) * sp;
    for (var i = 0; i < n; i++) {
      var cu = q[i], x = L.tall ? x0 + i * sp : x0 + (n - 1 - i) * sp, y = L.queue.y + Math.sin(time * 3 + cu.id) * 2;
      c.save(); c.translate(x, y);
      GGCat.draw(c, catOpts(cu.look, { size: size, face: 'open' }));
      c.restore();
    }
    c.font = '800 20px Nunito, system-ui, sans-serif'; c.fillStyle = '#7A6F8E'; c.textAlign = 'center';
    var lx = L.tall ? L.queue.x : L.queue.x + 220 - (n - 1) * sp / 2;
    c.fillText(q.length > 6 ? 'waiting: ' + q.length : 'waiting', lx, L.queue.y + 48);
  }
  function drawCustomers(c) {
    if (!G) return;
    c.save();
    c.beginPath(); c.rect(0, 0, L.W, L.CY + 14); c.clip();
    G.slots.forEach(function (cu, i) {
      if (!cu) return;
      var x = L.slots[i], y = L.CY, dy = 0, alpha = 1;
      if (cu.state === 'in') dy = (1 - easeOut(cu.t / 0.6)) * L.size * 1.3;
      if (cu.state === 'eat') dy = -Math.abs(Math.sin(cu.t * 9)) * 10;
      if (cu.state === 'out') { dy = easeOut(cu.t / 0.6) * L.size * 1.4; }
      var dx = cu.shake > 0 ? Math.sin(cu.shake * 50) * 7 : 0;
      if (cu.huhT > 0) { cu.huhT -= 1 / 60; if (cu.huhT <= 0 && cu.mood === 'huh') cu.mood = ''; }
      var face = 'open', extra = {};
      if (cu.mood === 'happy') face = 'happy';
      else if (cu.mood === 'huh') face = 'surprised';
      else if (cu.mood === 'doze') face = 'blink';
      else if (cu.mood === 'grumpy' || cu.mood === 'cross') { extra.eyes = 'sleepy'; extra.mouth = 'o'; }
      else if (Math.sin(time * 0.9 + cu.id * 2) > 0.985) face = 'blink';
      extra.face = face;
      c.save(); c.globalAlpha = alpha;
      peekCat(c, x + dx, y + dy, L.size, catOpts(cu.look, extra));
      var k = L.size / 88, headTop = y + dy - 50 * k - 60 * k;
      if (cu.mood === 'grumpy' || cu.mood === 'cross') {
        // a little cross mark
        c.save(); c.translate(x + dx + 40 * k, headTop + 6 * k); c.rotate(0.2);
        c.strokeStyle = '#FF4D4D'; c.lineWidth = 5; c.lineCap = 'round';
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) { c.beginPath(); c.moveTo(q[0] * 4, q[1] * 12); c.quadraticCurveTo(q[0] * 4, q[1] * 4, q[0] * 12, q[1] * 4); c.stroke(); });
        c.restore();
      }
      if (cu.mood === 'doze') {
        c.font = '800 30px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#7A6F8E'; c.textAlign = 'left';
        var zt = (time * 0.8) % 1; c.globalAlpha = 1 - zt;
        c.fillText('z', x + 44 * k, headTop + 10 - zt * 30); c.globalAlpha = 1;
      }
      if (cu.state === 'eat') { c.save(); c.translate(x, y - 14); blit(c, dishPic(cu.got), 0, 0, L.size * 0.85); c.restore(); }
      c.restore();
    });
    c.restore();
  }
  /* a speech bubble with its pointer as one shape, so there's no line across the join */
  function bubblePath(x0, y0, w, h, r, tx) {
    return function (p) {
      var x1 = x0 + w, y1 = y0 + h;
      p.moveTo(x0 + r, y0); p.arcTo(x1, y0, x1, y1, r); p.arcTo(x1, y1, x0, y1, r);
      p.lineTo(tx + 12, y1); p.lineTo(tx, y1 + 16); p.lineTo(tx - 12, y1);
      p.arcTo(x0, y1, x0, y0, r); p.arcTo(x0, y0, x1, y0, r); p.closePath();
    };
  }
  function drawBubbles(c) {
    if (!G) return;
    G.slots.forEach(function (cu, i) {
      if (!cu || cu.state !== 'wait') return;
      var x = L.slots[i] + (cu.shake > 0 ? Math.sin(cu.shake * 50) * 5 : 0);
      var k = L.size / 88, bw = L.bubbleW, bh = L.bubbleH;
      var by = L.CY - 50 * k - 76 * k - bh - 14;
      var hot = drag && drag.moved && custHit(drag.x, drag.y) === i;
      c.save();
      if (cu.mood === 'doze') c.globalAlpha = 0.55;
      D.shape(c, bubblePath(x - bw / 2, by, bw, bh, 22, x), hot ? '#E6FBE9' : '#FFFFFF', { lw: LW.mid, depth: 6 });
      blit(c, dishPic(cu.order), x, by + 40, 104);
      var need = dishDef(cu.order).need;
      need.forEach(function (id, j) { blit(c, ingPic(id), x + (j - 1) * 42, by + 92, 36); });
      if (G.mode === 'chal') {
        var r = clamp(cu.pat / cu.patMax, 0, 1);
        D.shape(c, D.rrPath(x - bw / 2 + 14, by + bh - 16, bw - 28, 10, 5), '#EEE8F3', { lw: 2.5, depth: 0, inside: function (c) {
          c.fillStyle = r > 0.6 ? '#7BD389' : r > 0.4 ? '#FFD23F' : '#FF6B57'; c.fillRect(x - bw / 2 + 14, by + bh - 16, (bw - 28) * r, 10);
        } });
      }
      if (hot) { rr(c, x - bw / 2 - 6, by - 6, bw + 12, bh + 12, 26); c.strokeStyle = '#7BD389'; c.lineWidth = 6; c.stroke(); }
      c.restore();
    });
  }
  function drawDrag(c) {
    if (!drag || !drag.moved || !G || !G.pass[drag.s]) return;
    c.save(); c.translate(drag.x, drag.y - 20); c.rotate(Math.sin(time * 8) * 0.04);
    blit(c, dishPic(G.pass[drag.s].id), 0, 0, 130);
    c.restore();
  }

  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.5, 0.9), r: rand(4, 8), color: Math.random() < 0.4 ? '#fff' : color, kind: Math.random() < 0.5 ? 'star' : 'dot', spin: rand(-5, 5) });
    }
  }
  function heart(x, y) { parts.push({ x: x, y: y, vx: rand(-20, 20), vy: -70, life: 0, max: 1.2, r: 14, color: '#FF7EB6', kind: 'heart', g: -10 }); }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y);
      if (p.kind === 'text') {
        c.font = '800 ' + p.r + 'px "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 6; c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.strokeText(p.text, 0, 0); c.fillStyle = p.color; c.fillText(p.text, 0, 0);
        c.translate(p.r * 0.95, 0); star(c, p.r * 0.45); c.fillStyle = p.color === '#FF5A5F' ? '#C9C2D6' : '#FFD23F'; c.fill(); ink(c, LW.fine);
        c.restore(); return;
      }
      c.rotate(p.kind === 'heart' ? 0 : p.life * p.spin);
      if (p.kind === 'star') star(c, p.r * 1.3);
      else if (p.kind === 'heart') { c.beginPath(); c.moveTo(0, p.r * 0.4); c.bezierCurveTo(-p.r * 1.2, -p.r * 0.4, -p.r * 0.5, -p.r * 1.2, 0, -p.r * 0.5); c.bezierCurveTo(p.r * 0.5, -p.r * 1.2, p.r * 1.2, -p.r * 0.4, 0, p.r * 0.4); }
      else { c.beginPath(); c.arc(0, 0, p.r * 0.6, 0, TAU); }
      c.fillStyle = p.color; c.fill();
      if (p.kind === 'heart') ink(c, LW.fine);
      c.restore();
    });
  }

  /* ================= speech bubble ================= */
  var sayTimer = 0;
  function say(text, secs) {
    var el = $('say'); el.textContent = text; el.classList.remove('hide');
    clearTimeout(sayTimer); sayTimer = setTimeout(function () { el.classList.add('hide'); }, (secs || 1.6) * 1000);
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
      pick: function () { tone({ f: 600, to: 820, dur: 0.07, gain: 0.08, type: 'triangle', slide: 0.05 }); },
      place: function () { tone({ f: 300, to: 180, dur: 0.1, gain: 0.16 }); noise({ type: 'lowpass', freq: 600, dur: 0.05, gain: 0.08 }); },
      putAway: function () { tone({ f: 700, to: 420, dur: 0.1, gain: 0.07, type: 'triangle' }); },
      pop: function () { tone({ f: 420, to: 920, dur: 0.11, gain: 0.14, slide: 0.06 }); },
      nope: function () { tone({ f: 260, to: 180, dur: 0.16, gain: 0.12, type: 'triangle' }); tone({ f: 220, to: 150, dur: 0.18, gain: 0.1, type: 'triangle', delay: 0.14 }); },
      bell: function () { tone({ f: 1568, dur: 0.9, gain: 0.12 }); tone({ f: 3136, dur: 0.4, gain: 0.04, type: 'triangle' }); tone({ f: 2093, dur: 0.6, gain: 0.05, delay: 0.01 }); },
      sizzle: function () { noise({ type: 'highpass', freq: 3500, q: 0.7, attack: 0.02, dur: 0.12, gain: 0.05 }); },
      ready: function () { [783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.3, gain: 0.1, delay: i * 0.09 }); }); },
      yum: function () { [659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.35, gain: 0.1, delay: i * 0.08 }); }); for (var i = 0; i < 5; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.18, delay: 0.3 + i * 0.085 }); },
      huff: function () { noise({ type: 'bandpass', freq: 900, q: 0.8, attack: 0.02, dur: 0.2, gain: 0.1 }); },
      leave: function () { tone({ f: 523.25, to: 392, dur: 0.22, gain: 0.08, type: 'triangle' }); tone({ f: 392, to: 293.66, dur: 0.3, gain: 0.08, type: 'triangle', delay: 0.2 }); },
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
  window.addEventListener('gg-change', function () { renderSound(); });
  renderSound();

  /* ================= main loop ================= */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 380) * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; }
    update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    rr(ctx, OX, OY, L.W * K, L.H * K, 22); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    drawWall(ctx);
    drawHatch(ctx);
    drawQueue(ctx);
    drawCounter(ctx);
    drawCustomers(ctx);
    drawPass(ctx);
    drawBubbles(ctx);
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, L.W * K, L.H * K, 22); ink(ctx, LW.big);
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    drawDrag(ctx);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(shelf); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  renderShelf();
  renderTray();
  layout();
  requestAnimationFrame(frame);
  $('funBtn').focus();

  /* test hook */
  window.__cafe = {
    state: function () {
      if (!G) return null;
      return { sel: G.sel, mode: G.mode, day: G.day, stars: G.stars, served: G.served, wrong: G.wrong, left: G.left, total: G.total, ended: G.ended, tray: G.tray.slice(), chef: G.chef.state,
        pass: G.pass.map(function (d) { return d && d.id; }), queue: G.queue.length, slots: G.slots.map(function (c) { return c && { order: c.order, state: c.state, mood: c.mood, pat: c.pat }; }) };
    },
    saved: function () { return JSON.parse(JSON.stringify(P)); },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    layout: function () { return { slots: L.slots, CY: L.CY, pass: L.pass, bin: L.bin, size: L.size }; },
    hurry: function (sec) { if (G) G.slots.forEach(function (c) { if (c) c.pat = Math.min(c.pat, sec); }); },
    skipQueue: function () { if (G) G.spawnT = 0; }
  };
})();
