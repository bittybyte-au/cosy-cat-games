/* Hide and Seek – a toddler game (about age 3). A picture (garden, bedroom or beach) with a few things peeking out
   from behind the bushes, beds and sandcastles. The cards at the bottom show what to find; tap one in the picture
   and it pops out and its card gets a big tick. Find them all for a little party, then play the same picture again
   (everything moves around) or pick another. Every round is freshly made, so it's never quite the same.
   No words, no timers, nothing to lose. Saves a count to GG.setProgress('seek', { found, rounds }). */
(function () {
  'use strict';

  var INK = '#2A2340';
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ink(c, w) { c.lineWidth = w || 4; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function fillInk(c, col, w) { c.fillStyle = col; c.fill(); ink(c, w || 4); }

  /* ================= things to find (each drawn centred, about 100 wide) ================= */
  var KITTEN_COLS = ['#FF9EC4', '#7CC4FF', '#FFA94D', '#B48CFF', '#FFFFFF'];
  var ITEMS = {
    yarn: function (c) {
      circle(c, 0, 0, 40); fillInk(c, '#FF5A7A', 4.5);
      c.save(); circle(c, 0, 0, 38); c.clip(); c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 3;
      for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-40, i * 14 - 12); c.quadraticCurveTo(0, i * 14 + 12, 40, i * 14 - 12); c.stroke(); }
      c.restore();
      c.beginPath(); c.moveTo(30, 26); c.quadraticCurveTo(50, 36, 44, 50); c.strokeStyle = '#FF5A7A'; c.lineWidth = 5; c.stroke();
    },
    fish: function (c) {
      c.beginPath(); c.moveTo(-44, 0); c.quadraticCurveTo(-8, -34, 26, -6); c.lineTo(46, -24); c.lineTo(42, 4); c.lineTo(48, 26); c.lineTo(26, 8); c.quadraticCurveTo(-8, 32, -44, 0); c.closePath();
      fillInk(c, '#7CC4FF', 4.5);
      circle(c, -26, -4, 5); c.fillStyle = INK; c.fill();
      c.beginPath(); c.moveTo(-6, -14); c.quadraticCurveTo(2, 0, -6, 14); c.strokeStyle = '#3B8FD6'; c.lineWidth = 4; c.stroke();
    },
    mouse: function (c) {
      c.beginPath(); c.moveTo(-30, 10); c.quadraticCurveTo(-52, 4, -50, -16); c.strokeStyle = '#FF8FAB'; c.lineWidth = 5; c.stroke();
      c.beginPath(); c.moveTo(-34, 18); c.quadraticCurveTo(-34, -24, 4, -24); c.quadraticCurveTo(40, -20, 42, 14); c.quadraticCurveTo(10, 24, -34, 18); c.closePath(); fillInk(c, '#C9C2D6', 4.5);
      circle(c, 6, -26, 13); fillInk(c, '#FFB3C7', 4);
      circle(c, 26, -2, 4.5); c.fillStyle = INK; c.fill();
      circle(c, 44, 12, 5); c.fillStyle = '#FF7FA6'; c.fill();
    },
    bell: function (c) {
      c.beginPath(); c.moveTo(-36, 26); c.quadraticCurveTo(-34, -34, 0, -36); c.quadraticCurveTo(34, -34, 36, 26); c.closePath(); fillInk(c, '#FFD23F', 4.5);
      rr(c, -42, 22, 84, 12, 6); fillInk(c, '#FFC93C', 4);
      circle(c, 0, 40, 8); fillInk(c, '#E0A100', 3.5);
      circle(c, 0, -40, 6); fillInk(c, '#FFD23F', 3.5);
      c.beginPath(); c.moveTo(-18, -14); c.quadraticCurveTo(-16, -26, -6, -28); c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
    },
    duck: function (c) {
      c.beginPath(); c.moveTo(-44, 6); c.quadraticCurveTo(-44, 36, 0, 36); c.quadraticCurveTo(40, 36, 44, 8); c.quadraticCurveTo(20, 14, 10, 0); c.closePath(); fillInk(c, '#FFD23F', 4.5);
      circle(c, 14, -18, 22); fillInk(c, '#FFD23F', 4.5);
      c.beginPath(); c.moveTo(32, -18); c.lineTo(52, -12); c.lineTo(32, -6); c.closePath(); fillInk(c, '#FF9A2E', 3.5);
      circle(c, 18, -24, 4); c.fillStyle = INK; c.fill();
      c.beginPath(); c.moveTo(-26, 12); c.quadraticCurveTo(-12, 22, -2, 12); c.strokeStyle = '#E0A100'; c.lineWidth = 4; c.stroke();
    },
    ball: function (c) {
      circle(c, 0, 0, 40); c.fillStyle = '#fff'; c.fill();
      c.save(); circle(c, 0, 0, 40); c.clip();
      [['#FF5A5F', -1.9], ['#3D8BFF', -0.6], ['#FFD23F', 0.7]].forEach(function (s) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 44, s[1], s[1] + 0.75); c.closePath(); c.fillStyle = s[0]; c.fill(); });
      c.restore();
      circle(c, 0, 0, 40); ink(c, 4.5); circle(c, 0, 0, 8); fillInk(c, '#fff', 3);
    },
    sock: function (c) {
      c.beginPath(); c.moveTo(-14, -44); c.lineTo(18, -44); c.lineTo(18, 10); c.quadraticCurveTo(18, 34, -6, 36); c.lineTo(-30, 36); c.quadraticCurveTo(-46, 34, -44, 18); c.quadraticCurveTo(-42, 4, -14, 4); c.closePath();
      fillInk(c, '#7BD389', 4.5);
      rr(c, -18, -48, 40, 14, 5); fillInk(c, '#fff', 3.5);
      c.strokeStyle = '#4FB868'; c.lineWidth = 6; [-20, -6].forEach(function (y) { c.beginPath(); c.moveTo(-12, y); c.lineTo(16, y); c.stroke(); });
    },
    star: function (c) {
      c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 20 : 46; c.lineTo(Math.cos(a) * r, Math.sin(a) * r + 4); } c.closePath();
      fillInk(c, '#FFD23F', 4.5);
      circle(c, -8, 2, 3.5); c.fillStyle = INK; c.fill(); circle(c, 8, 2, 3.5); c.fill();
      c.beginPath(); c.moveTo(-6, 12); c.quadraticCurveTo(0, 17, 6, 12); ink(c, 3);
    },
    cupcake: function (c) {
      c.beginPath(); c.moveTo(-32, 0); c.lineTo(32, 0); c.lineTo(24, 40); c.lineTo(-24, 40); c.closePath(); fillInk(c, '#7CC4FF', 4.5);
      c.strokeStyle = '#3B8FD6'; c.lineWidth = 3; [-14, 0, 14].forEach(function (x) { c.beginPath(); c.moveTo(x, 4); c.lineTo(x * 0.8, 36); c.stroke(); });
      c.beginPath(); c.moveTo(-38, 2); c.quadraticCurveTo(-40, -26, -14, -26); c.quadraticCurveTo(-4, -46, 10, -30); c.quadraticCurveTo(40, -30, 38, 2); c.closePath(); fillInk(c, '#FF9EC4', 4.5);
      circle(c, 4, -42, 8); fillInk(c, '#FF5A5F', 3.5);
      c.fillStyle = '#FFF'; [[-20, -12], [12, -16], [24, -6], [-4, -6]].forEach(function (q) { rr(c, q[0], q[1], 7, 3, 1.5); c.fill(); });
    },
    apple: function (c) {
      c.beginPath(); c.moveTo(0, -24); c.bezierCurveTo(-26, -40, -46, -14, -40, 10); c.bezierCurveTo(-34, 36, -12, 42, 0, 34); c.bezierCurveTo(12, 42, 34, 36, 40, 10); c.bezierCurveTo(46, -14, 26, -40, 0, -24); c.closePath();
      fillInk(c, '#FF5A5F', 4.5);
      c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(2, -38, 8, -44); ink(c, 5);
      c.beginPath(); c.moveTo(6, -36); c.quadraticCurveTo(24, -50, 34, -36); c.quadraticCurveTo(20, -26, 6, -36); fillInk(c, '#7BD389', 3.5);
      c.beginPath(); c.moveTo(-24, -10); c.quadraticCurveTo(-26, 4, -20, 12); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 5; c.stroke();
    },
    teddy: function (c) {
      circle(c, -28, -28, 14); fillInk(c, '#C98B5B', 4); circle(c, 28, -28, 14); fillInk(c, '#C98B5B', 4);
      circle(c, 0, 0, 38); fillInk(c, '#C98B5B', 4.5);
      ell(c, 0, 12, 18, 14); fillInk(c, '#F3DDB0', 3.5);
      circle(c, -13, -8, 4.5); c.fillStyle = INK; c.fill(); circle(c, 13, -8, 4.5); c.fill();
      ell(c, 0, 6, 6, 4.5); c.fill();
      c.beginPath(); c.moveTo(-6, 16); c.quadraticCurveTo(0, 21, 6, 16); ink(c, 3);
    },
    kitten: function (c, col) {
      try { GGCat.draw(c, { color: col || '#FF9EC4', size: 84, face: 'happy' }); } catch (e) { circle(c, 0, 0, 40); fillInk(c, col || '#FF9EC4', 4); }
    }
  };
  var ITEM_IDS = Object.keys(ITEMS);

  /* ================= hiding places (drawn from the middle of their base, `w` wide and `h` tall) ================= */
  var PROPS = {
    /* garden */
    bush: { peek: [[-0.5, -0.4], [0.5, -0.4], [0, -1.02], [-0.3, -0.88]], w: 190, h: 120, draw: function (c, p) {
      c.beginPath(); c.moveTo(-95, 0);
      [[-95, -40, -70, -78], [-60, -115, -10, -105], [10, -128, 55, -100], [90, -96, 95, -50]].forEach(function (q, i) { c.quadraticCurveTo(q[0], q[1], q[2], q[3]); });
      c.quadraticCurveTo(100, -20, 95, 0); c.closePath(); fillInk(c, p.col, 5);
      c.fillStyle = 'rgba(255,255,255,.25)'; ell(c, -40, -78, 22, 12, -0.4); c.fill(); ell(c, 30, -86, 18, 10, 0.3); c.fill();
      if (p.berries) { c.fillStyle = p.berries; [[-50, -40], [-10, -70], [40, -50], [60, -24], [-30, -18]].forEach(function (q) { circle(c, q[0], q[1], 7); c.fill(); ink(c, 2.5); }); }
    }, cols: ['#5CCB75', '#4FB868', '#7BD389'] },
    pot: { peek: [[-0.5, -0.4], [0.5, -0.4], [0, -0.62]], w: 120, h: 160, draw: function (c, p) {
      [[-24, -150, '#FF8FAB'], [10, -164, '#FFD23F'], [36, -138, p.flower]].forEach(function (f) {
        c.beginPath(); c.moveTo(f[0] * 0.4, -80); c.quadraticCurveTo(f[0] * 0.7, -110, f[0], f[1] + 16); c.strokeStyle = INK; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#4FB868'; c.lineWidth = 4; c.stroke();
        for (var i = 0; i < 5; i++) { var a = i * TAU / 5; circle(c, f[0] + Math.cos(a) * 12, f[1] + Math.sin(a) * 12, 10); fillInk(c, f[2], 3); }
        circle(c, f[0], f[1], 8); fillInk(c, '#FFF3B0', 3);
      });
      c.beginPath(); c.moveTo(-56, -84); c.lineTo(56, -84); c.lineTo(44, 0); c.lineTo(-44, 0); c.closePath(); fillInk(c, p.col, 5);
      rr(c, -62, -96, 124, 20, 8); fillInk(c, p.col, 4.5);
    }, cols: ['#E8875A', '#FF9EC4', '#7CC4FF'] },
    rock: { peek: [[-0.48, -0.35], [0.48, -0.3], [-0.1, -1.0]], w: 150, h: 80, draw: function (c, p) {
      c.beginPath(); c.moveTo(-75, 0); c.quadraticCurveTo(-80, -50, -30, -74); c.quadraticCurveTo(20, -90, 56, -56); c.quadraticCurveTo(84, -30, 75, 0); c.closePath(); fillInk(c, p.col, 5);
      c.beginPath(); c.moveTo(-36, -50); c.quadraticCurveTo(-20, -64, 0, -62); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 6; c.stroke();
    }, cols: ['#C9C2D6', '#B5AEC4', '#D9D3E6'] },
    can: { peek: [[0.36, -0.45], [0, -0.85]], w: 150, h: 110, draw: function (c, p) {
      c.beginPath(); c.moveTo(-40, -50); c.lineTo(-92, -96); c.lineTo(-84, -104); c.lineTo(-34, -70); c.closePath(); fillInk(c, p.col, 4);
      rr(c, -98, -112, 22, 16, 5); fillInk(c, p.col, 3.5);
      rr(c, -50, -90, 100, 90, 18); fillInk(c, p.col, 5);
      c.beginPath(); c.arc(16, -90, 32, Math.PI, 0); ink(c, 8);
      circle(c, -18, -50, 7); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
    }, cols: ['#7CC4FF', '#FF6B57', '#B48CFF'] },
    tree: { peek: [[-0.5, -0.63], [0.5, -0.66], [0, -1.08]], w: 210, h: 300, draw: function (c, p) {
      c.beginPath(); c.moveTo(-26, 0); c.lineTo(-18, -150); c.lineTo(18, -150); c.lineTo(26, 0); c.closePath(); fillInk(c, '#A86B3C', 5);
      c.beginPath(); c.moveTo(-4, -60); c.quadraticCurveTo(4, -80, -2, -100); c.strokeStyle = '#7A4E2D'; c.lineWidth = 4; c.stroke();
      [[-60, -190, 64], [50, -200, 66], [0, -250, 74], [-10, -170, 60]].forEach(function (q) { circle(c, q[0], q[1], q[2]); c.fillStyle = INK; c.fill(); });
      [[-60, -190, 59], [50, -200, 61], [0, -250, 69], [-10, -170, 55]].forEach(function (q) { circle(c, q[0], q[1], q[2]); c.fillStyle = p.col; c.fill(); });
      if (p.berries) { c.fillStyle = p.berries; [[-60, -200], [30, -240], [60, -180], [-20, -260], [0, -190]].forEach(function (q) { circle(c, q[0], q[1], 9); c.fill(); ink(c, 2.5); }); }
    }, cols: ['#5CCB75', '#7BD389'] },
    /* bedroom */
    bed: { peek: [[0.5, -0.55], [-0.1, -0.75], [0.3, -0.75]], w: 300, h: 150, draw: function (c, p) {
      rr(c, -150, -150, 30, 150, 10); fillInk(c, '#C98B5B', 5);
      rr(c, -146, -80, 292, 60, 16); fillInk(c, '#E6B98A', 5);
      rr(c, -140, -104, 284, 46, 18); fillInk(c, p.col, 5);
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 5; [-80, -20, 40, 100].forEach(function (x) { c.beginPath(); c.moveTo(x, -98); c.lineTo(x, -64); c.stroke(); });
      rr(c, -118, -128, 76, 32, 14); fillInk(c, '#FFFFFF', 4.5);
      rr(c, 120, -110, 26, 110, 10); fillInk(c, '#C98B5B', 5);
    }, cols: ['#FF9EC4', '#7CC4FF', '#B48CFF', '#7BD389'] },
    toybox: { peek: [[-0.5, -0.4], [0.5, -0.4], [0, -1.0]], w: 170, h: 120, draw: function (c, p) {
      rr(c, -85, -100, 170, 100, 12); fillInk(c, p.col, 5);
      rr(c, -92, -120, 184, 28, 10); fillInk(c, p.col, 5);
      circle(c, -30, -50, 14); fillInk(c, '#FFD23F', 3.5); rr(c, 10, -64, 30, 30, 6); fillInk(c, '#FF5A5F', 3.5);
    }, cols: ['#FFC93C', '#7CC4FF', '#FF8FAB'] },
    basket: { peek: [[0, -1.0], [-0.5, -0.4], [0.5, -0.4]], w: 130, h: 120, draw: function (c, p) {
      c.beginPath(); c.moveTo(-62, -110); c.lineTo(62, -110); c.lineTo(52, 0); c.lineTo(-52, 0); c.closePath(); fillInk(c, p.col, 5);
      c.strokeStyle = 'rgba(42,35,64,.25)'; c.lineWidth = 3; for (var y = -90; y < 0; y += 18) { c.beginPath(); c.moveTo(-58, y); c.lineTo(58, y); c.stroke(); }
      rr(c, -68, -120, 136, 16, 8); fillInk(c, p.col, 4.5);
      c.beginPath(); c.moveTo(-40, -118); c.quadraticCurveTo(-10, -146, 20, -120); c.strokeStyle = '#FF9EC4'; c.lineWidth = 10; c.stroke();
    }, cols: ['#E6B98A', '#D9B68A'] },
    armchair: { peek: [[0, -1.0], [-0.5, -0.4], [0.5, -0.4]], w: 190, h: 170, draw: function (c, p) {
      rr(c, -78, -170, 156, 110, 30); fillInk(c, p.col, 5);
      rr(c, -95, -96, 44, 96, 18); fillInk(c, p.col, 5); rr(c, 51, -96, 44, 96, 18); fillInk(c, p.col, 5);
      rr(c, -60, -76, 120, 52, 16); fillInk(c, p.col, 5);
      rr(c, -64, -28, 128, 28, 8); fillInk(c, '#C98B5B', 4);
    }, cols: ['#B48CFF', '#FF8FAB', '#7BD389', '#FF9F43'] },
    plant: { peek: [[-0.46, -0.25], [0.46, -0.25], [0, -0.42]], w: 110, h: 180, draw: function (c, p) {
      [[-1.1, 70], [-0.6, 90], [0, 100], [0.6, 88], [1.1, 72]].forEach(function (l) {
        c.save(); c.translate(0, -70); c.rotate(l[0]);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-18, -l[1] * 0.6, 0, -l[1]); c.quadraticCurveTo(18, -l[1] * 0.6, 0, 0); fillInk(c, '#4FB868', 4); c.restore();
      });
      c.beginPath(); c.moveTo(-50, -76); c.lineTo(50, -76); c.lineTo(40, 0); c.lineTo(-40, 0); c.closePath(); fillInk(c, p.col, 5);
    }, cols: ['#FFFFFF', '#FFC93C', '#7CC4FF'] },
    /* beach */
    castle: { peek: [[-0.48, -0.3], [0.48, -0.3], [-0.25, -0.56]], w: 180, h: 150, draw: function (c, p) {
      var sand = '#F3D28A';
      rr(c, -86, -80, 172, 80, 6); fillInk(c, sand, 5);
      [-70, 40].forEach(function (x) { rr(c, x, -130, 34, 54, 4); fillInk(c, sand, 4.5); c.beginPath(); c.moveTo(x, -130); c.lineTo(x + 7, -140); c.lineTo(x + 14, -130); c.lineTo(x + 20, -140); c.lineTo(x + 27, -130); c.lineTo(x + 34, -140); ink(c, 4); });
      rr(c, -24, -150, 48, 76, 4); fillInk(c, sand, 4.5);
      c.beginPath(); c.moveTo(0, -150); c.lineTo(0, -184); ink(c, 4); c.beginPath(); c.moveTo(0, -184); c.lineTo(26, -176); c.lineTo(0, -168); c.closePath(); fillInk(c, p.col, 3);
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(-14, -30); c.arc(0, -30, 14, Math.PI, 0); c.lineTo(14, 0); fillInk(c, '#C9A050', 4);
    }, cols: ['#FF5A5F', '#3D8BFF', '#FFD23F'] },
    bucket: { peek: [[-0.5, -0.4], [0, -0.95]], w: 110, h: 100, draw: function (c, p) {
      c.beginPath(); c.moveTo(-50, -92); c.lineTo(50, -92); c.lineTo(40, 0); c.lineTo(-40, 0); c.closePath(); fillInk(c, p.col, 5);
      ell(c, 0, -92, 50, 12); fillInk(c, '#F3D28A', 4);
      c.beginPath(); c.arc(0, -92, 46, Math.PI * 1.05, Math.PI * 1.95); ink(c, 5);
      c.save(); c.translate(60, -20); c.rotate(0.6); rr(c, -6, -50, 12, 50, 4); fillInk(c, '#FFD23F', 3.5); c.beginPath(); c.moveTo(-14, -50); c.lineTo(14, -50); c.lineTo(10, -76); c.lineTo(-10, -76); c.closePath(); fillInk(c, '#FFD23F', 3.5); c.restore();
    }, cols: ['#FF5A5F', '#3D8BFF', '#3FC46A', '#B48CFF'] },
    beachchair: { peek: [[0.45, -0.25], [-0.5, -0.3]], w: 170, h: 150, draw: function (c, p) {
      c.beginPath(); c.moveTo(-70, 0); c.lineTo(10, -150); ink(c, 7); c.beginPath(); c.moveTo(70, 0); c.lineTo(-20, -80); ink(c, 7);
      c.beginPath(); c.moveTo(-60, -40); c.lineTo(4, -146); c.lineTo(50, -128); c.lineTo(0, -30); c.closePath(); c.fillStyle = '#fff'; c.fill();
      c.save(); c.clip(); c.fillStyle = p.col; for (var i = -200; i < 200; i += 36) { c.fillRect(i, -200, 18, 260); } c.restore();
      c.beginPath(); c.moveTo(-60, -40); c.lineTo(4, -146); c.lineTo(50, -128); c.lineTo(0, -30); c.closePath(); ink(c, 4.5);
      rr(c, -66, -44, 132, 20, 6); fillInk(c, p.col, 4.5);
    }, cols: ['#FF5A5F', '#3D8BFF', '#FF9F43'] },
    boat: { peek: [[-0.5, -0.4], [0.5, -0.4], [0, -0.68]], w: 230, h: 110, draw: function (c, p) {
      c.beginPath(); c.moveTo(-115, -70); c.lineTo(115, -70); c.quadraticCurveTo(100, 0, 60, 0); c.lineTo(-60, 0); c.quadraticCurveTo(-100, 0, -115, -70); c.closePath(); fillInk(c, p.col, 5);
      c.beginPath(); c.moveTo(-108, -48); c.lineTo(108, -48); c.strokeStyle = '#fff'; c.lineWidth = 8; c.stroke();
      c.beginPath(); c.moveTo(-20, -70); c.lineTo(-20, -110); c.moveTo(20, -70); c.lineTo(60, -112); ink(c, 6);
    }, cols: ['#FF6B57', '#3D8BFF', '#FFD23F'] }
  };
  /* rocks belong at the beach and in the garden */
  var SCENES = [
    { id: 'garden', kinds: ['bush', 'bush', 'pot', 'rock', 'can', 'tree'], big: ['tree'], ground: 0.42 },
    { id: 'bedroom', kinds: ['bed', 'toybox', 'basket', 'armchair', 'plant', 'toybox'], big: ['bed', 'armchair'], ground: 0.5 },
    { id: 'beach', kinds: ['castle', 'bucket', 'rock', 'beachchair', 'boat', 'castle', 'bucket'], big: ['boat', 'beachchair'], ground: 0.5 }
  ];
  function sceneDef(id) { for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return SCENES[i]; return SCENES[0]; }

  var CURTAINS = [
    { pat: 'stripes', col: '#7CC4FF', col2: '#FFFFFF', tie: '#FFD23F', rod: '#C98B5B' },
    { pat: 'dots', col: '#FF8FAB', col2: '#FFFFFF', tie: '#B48CFF', rod: '#C98B5B' },
    { pat: 'stars', col: '#B48CFF', col2: '#FFE14D', tie: '#FFD23F', rod: '#8E7FA8' },
    { pat: 'gingham', col: '#7BD389', col2: '#FFFFFF', tie: '#FF8FAB', rod: '#C98B5B' }
  ];
  /* ---------- curtains for the window: two tied-back curtains on a rod (copied into each game that has a window) ---------- */
  var curtainTiles = {};
  function curtainTile(st) {
    var key = st.pat + st.col + st.col2;
    if (curtainTiles[key]) return curtainTiles[key];
    var cv = document.createElement('canvas'); cv.width = cv.height = 28;
    var c = cv.getContext('2d');
    c.fillStyle = st.col; c.fillRect(0, 0, 28, 28);
    c.fillStyle = st.col2;
    if (st.pat === 'gingham') { c.globalAlpha = 0.55; c.fillRect(0, 0, 14, 28); c.fillRect(0, 0, 28, 14); c.globalAlpha = 1; }
    else if (st.pat === 'stripes') { c.fillRect(0, 0, 10, 28); }
    else if (st.pat === 'dots') { c.beginPath(); c.arc(7, 7, 4, 0, Math.PI * 2); c.arc(21, 21, 4, 0, Math.PI * 2); c.fill(); }
    else if (st.pat === 'stars') {
      [[7, 8], [21, 22]].forEach(function (q) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 2.4 : 5.5; c.lineTo(q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r); } c.closePath(); c.fill(); });
    }
    return (curtainTiles[key] = cv);
  }
  function drawCurtains(c, x, y, w, h, st) {
    var pad = Math.min(26, w * 0.12), top = y - 12, bot = y + h + 14, cwid = w * 0.28 + pad;
    var fill = c.createPattern(curtainTile(st), 'repeat');
    [-1, 1].forEach(function (side) {
      var xo = side < 0 ? x - pad : x + w + pad;           // the outer edge
      var xi = xo - side * cwid;                           // the inner edge at the top
      var tieX = xo - side * cwid * 0.38, tieY = y + h * 0.6;
      c.beginPath();
      c.moveTo(xo, top); c.lineTo(xi, top);
      c.quadraticCurveTo(xi, y + h * 0.4, tieX, tieY);
      c.quadraticCurveTo(xo - side * cwid * 0.5, tieY + (bot - tieY) * 0.5, xo - side * cwid * 0.72, bot);
      c.lineTo(xo, bot); c.closePath();
      c.fillStyle = fill; c.fill(); ink(c, 3.5);
      // a couple of soft folds
      c.strokeStyle = 'rgba(42,35,64,.22)'; c.lineWidth = 3;
      [0.3, 0.62].forEach(function (f) { var fx = xo - side * cwid * f; c.beginPath(); c.moveTo(fx, top + 4); c.quadraticCurveTo(fx + side * cwid * 0.12, y + h * 0.35, tieX + side * cwid * (f - 0.3) * 0.4, tieY - 4); c.stroke(); });
      // the tie
      c.save(); c.translate(tieX + side * cwid * 0.18, tieY); c.rotate(side * 0.25);
      rr(c, -cwid * 0.3, -6, cwid * 0.6, 12, 6); c.fillStyle = st.tie; c.fill(); ink(c, 3);
      c.restore();
    });
    // the rod with round ends
    rr(c, x - pad - 14, top - 9, w + pad * 2 + 28, 10, 5); c.fillStyle = st.rod; c.fill(); ink(c, 3);
    [x - pad - 16, x + w + pad + 16].forEach(function (rx) { c.beginPath(); c.arc(rx, top - 4, 8, 0, Math.PI * 2); c.fillStyle = st.rod; c.fill(); ink(c, 3); });
  }

  function drawBackground(c, S, W, H) {
    var gy = H * S.def.ground;
    if (S.def.id === 'garden') {
      c.fillStyle = '#BFE6FF'; c.fillRect(0, 0, W, gy);
      circle(c, W * 0.86, H * 0.1, 40); fillInk(c, '#FFE14D', 4);
      [[0.18, 0.12], [0.55, 0.08]].forEach(function (q) { var x = W * q[0], y = H * q[1]; c.fillStyle = '#fff'; circle(c, x, y, 26); c.fill(); circle(c, x + 30, y - 8, 30); c.fill(); circle(c, x + 60, y, 24); c.fill(); });
      // fence
      c.fillStyle = '#FFF1DC'; for (var x = 10; x < W; x += 46) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x, gy - 70); c.lineTo(x + 16, gy - 86); c.lineTo(x + 32, gy - 70); c.lineTo(x + 32, gy); c.closePath(); c.fill(); ink(c, 3); }
      rr(c, 0, gy - 56, W, 12, 4); c.fillStyle = '#FFF1DC'; c.fill(); ink(c, 3);
      c.fillStyle = '#9BDC8C'; c.fillRect(0, gy, W, H - gy); c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); ink(c, 4);
      c.strokeStyle = '#7BC96E'; c.lineWidth = 3; S.tufts.forEach(function (t) { c.beginPath(); c.moveTo(t.x - 8, t.y); c.lineTo(t.x - 4, t.y - 12); c.moveTo(t.x, t.y); c.lineTo(t.x, t.y - 16); c.moveTo(t.x + 8, t.y); c.lineTo(t.x + 4, t.y - 12); c.stroke(); });
    } else if (S.def.id === 'bedroom') {
      c.fillStyle = S.wall; c.fillRect(0, 0, W, gy);
      c.fillStyle = 'rgba(255,255,255,.45)'; for (var yy = 30; yy < gy; yy += 60) for (var xx = 30 + (yy / 60 % 2) * 30; xx < W; xx += 60) { circle(c, xx, yy, 6); c.fill(); }
      var wx = S.winX * W;
      rr(c, wx - 90, gy * 0.16, 180, gy * 0.56, 12); fillInk(c, '#9EDCFF', 5);
      c.strokeStyle = '#fff'; c.lineWidth = 7; c.beginPath(); c.moveTo(wx, gy * 0.16 + 4); c.lineTo(wx, gy * 0.72 - 4); c.stroke();
      circle(c, wx + 50, gy * 0.3, 18); c.fillStyle = '#FFE14D'; c.fill();
      drawCurtains(c, wx - 90, gy * 0.16, 180, gy * 0.56, S.curtain);
      c.fillStyle = '#E6B98A'; c.fillRect(0, gy, W, H - gy);
      c.strokeStyle = '#D9A877'; c.lineWidth = 3; for (var fy = gy + 40; fy < H; fy += 50) { c.beginPath(); c.moveTo(0, fy); c.lineTo(W, fy); c.stroke(); }
      c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); ink(c, 4);
      ell(c, W * S.rugX, gy + (H - gy) * 0.55, W * 0.28, (H - gy) * 0.22); fillInk(c, S.rug, 4);
    } else {
      c.fillStyle = '#BFE6FF'; c.fillRect(0, 0, W, gy * 0.7);
      circle(c, W * 0.14, H * 0.1, 40); fillInk(c, '#FFE14D', 4);
      c.fillStyle = '#4DB6E8'; c.fillRect(0, gy * 0.7, W, gy * 0.3 + 4);
      c.strokeStyle = '#fff'; c.lineWidth = 4; for (var i = 0; i < 6; i++) { var x0 = (i * 180 + S.wave) % (W + 100) - 50, y0 = gy * 0.8 + (i % 2) * 18; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + 20, y0 - 10, x0 + 40, y0); c.stroke(); }
      c.fillStyle = '#F7E1A8'; c.fillRect(0, gy, W, H - gy);
      c.beginPath(); c.moveTo(0, gy); for (var x2 = 0; x2 <= W; x2 += 40) c.lineTo(x2, gy + Math.sin(x2 / 40) * 5); ink(c, 4);
      c.fillStyle = '#E8CB86'; S.tufts.forEach(function (t) { circle(c, t.x, t.y, 3); c.fill(); });
      S.shells.forEach(function (s) { c.save(); c.translate(s.x, s.y); c.rotate(s.r); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 14, Math.PI, 0); c.closePath(); fillInk(c, s.col, 3); c.restore(); });
    }
  }

  /* ================= making a round ================= */
  function makeScene(id, W, H, nItems) {
    var def = sceneDef(id);
    var S = { def: def, W: W, H: H, props: [], items: [], tufts: [], shells: [],
      wall: pick(['#FFE6F0', '#E6F2FF', '#FFF3D6', '#EAF7E6']), rug: pick(['#FFC2DA', '#C7EBD2', '#DCC8FF', '#FFE7A8']), curtain: pick(CURTAINS), winX: rand(0.2, 0.8), rugX: rand(0.35, 0.65), wave: rand(0, 200) };
    var gy = H * def.ground;
    for (var t = 0; t < 30; t++) S.tufts.push({ x: rand(10, W - 10), y: rand(gy + 10, H - 10) });
    for (var s = 0; s < 4; s++) S.shells.push({ x: rand(30, W - 30), y: rand(gy + 30, H - 20), r: rand(-0.5, 0.5), col: pick(['#FFC2DA', '#FFFFFF', '#FFD9A8']) });
    // props: spread over the ground, smaller further back
    var count = W > 800 ? 9 : 8, bigUsed = 0;
    for (var tries = 0; S.props.length < count && tries < 400; tries++) {
      var kind = pick(def.kinds);
      var isBig = def.big.indexOf(kind) >= 0;
      if (isBig && (bigUsed >= 2 || S.props.some(function (q) { return q.kind === kind; }))) continue;
      var y = rand(gy + 30, H - 24), k = lerp(0.72, 1.08, (y - gy) / (H - gy));
      var P = PROPS[kind], w = P.w * k;
      var x = rand(w / 2 + 10, W - w / 2 - 10);
      var clash = S.props.some(function (q) { return Math.abs(q.x - x) < (q.w + w) * 0.42 && Math.abs(q.y - y) < 90; });
      if (clash) continue;
      if (isBig) bigUsed++;
      S.props.push({ kind: kind, x: x, y: y, s: k, w: w, h: P.h * k, col: pick(P.cols), flower: pick(['#B48CFF', '#FF5A5F', '#7CC4FF']), berries: Math.random() < 0.4 ? pick(['#FF5A5F', '#B48CFF']) : null });
    }
    S.props.sort(function (a, b) { return a.y - b.y; });
    // things to find, each peeking out from behind a different prop
    var ids = shuffle(ITEM_IDS.slice()).slice(0, nItems);
    var hosts = shuffle(S.props.slice());
    ids.forEach(function (id) {
      for (var h = 0; h < hosts.length; h++) {
        var p = hosts[h];
        var spots = shuffle(PROPS[p.kind].peek.slice());   // spots where about half of a thing shows
        for (var i = 0; i < spots.length; i++) {
          var size = 78 * p.s;
          var ix = p.x + spots[i][0] * p.w * 1.12, iy = p.y + spots[i][1] * p.h;
          if (ix < size * 0.6 || ix > W - size * 0.6 || iy < 30 + size * 0.5 || iy > H - size * 0.4) continue;
          // not covered by something standing in front of it
          var covered = S.props.some(function (q) { return q !== p && q.y > p.y && Math.abs(q.x - ix) < q.w * 0.5 && iy > q.y - q.h * 0.95 && iy < q.y + 10; });
          if (covered) continue;
          S.items.push({ id: id, col: pick(KITTEN_COLS), host: p, x: ix, y: iy, size: size, rot: spots[i][0] * 0.6, found: false, t: 0 });
          hosts.splice(h, 1);
          return;
        }
      }
    });
    return S;
  }

  function drawItem(c, it, extraScale) {
    c.save(); c.translate(it.x, it.y); c.rotate(it.rot || 0);
    var k = it.size / 100 * (extraScale || 1); c.scale(k, k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    ITEMS[it.id](c, it.col);
    c.restore();
  }
  function drawScene(c, S, live) {
    drawBackground(c, S, S.W, S.H);
    S.props.forEach(function (p) {
      // things hiding behind this prop go first, so the prop covers part of them
      S.items.forEach(function (it) {
        if (it.host !== p || (live && it.found)) return;
        var wig = live && it.hint > 0 ? Math.sin(it.hint * 18) * 0.18 : 0;
        c.save(); c.translate(it.x, it.y); c.rotate(wig); c.translate(-it.x, -it.y);
        drawItem(c, it); c.restore();
      });
      c.save(); c.translate(p.x, p.y); c.scale(p.s, p.s); c.lineJoin = 'round'; c.lineCap = 'round';
      ell(c, 0, 2, PROPS[p.kind].w * 0.46, 10); c.fillStyle = 'rgba(42,35,64,.12)'; c.fill();
      PROPS[p.kind].draw(c, p);
      c.restore();
    });
  }

  /* ================= saved count ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('seek') || {}; } catch (e) {} if (typeof p.found !== 'number') p.found = 0; if (typeof p.rounds !== 'number') p.rounds = 0; if (typeof p.scene !== 'string') p.scene = 'garden'; return p; })();
  function save() { try { GG.setProgress('seek', P); } catch (e) {} }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar'), listEl = $('list');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 640;
  function measure() {
    cw = window.innerWidth; ch = window.innerHeight;
    var top = topbar.getBoundingClientRect().bottom + 6, bottom = listEl.getBoundingClientRect().top - 8;
    return { top: top, availW: cw - 16, availH: Math.max(120, bottom - top) };
  }
  function sizeFor(m) {
    var tall = m.availW / m.availH < 1.05;
    return tall ? { W: 600, H: clamp(Math.round(600 * m.availH / m.availW), 700, 1000) } : { W: 1000, H: clamp(Math.round(1000 * m.availH / m.availW), 560, 720) };
  }
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var m = measure();
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var sz = sizeFor(m);
    // a big change of shape (a phone turned round) makes a fresh picture that fits
    if (S && (sz.W !== W || Math.abs(sz.H - H) > 60)) { W = sz.W; H = sz.H; newRound(S.def.id, true); }
    else if (!S) { W = sz.W; H = sz.H; }
    K = Math.min(m.availW / W, m.availH / H);
    OX = (cw - W * K) / 2; OY = m.top + (m.availH - H * K) / 2;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  /* ================= a round ================= */
  var S = null, time = 0, parts = [], idleT = 0, party = 0, picShown = false;
  var thumbCache = {};
  function itemThumb(it) {
    var key = it.id + (it.id === 'kitten' ? it.col : '');
    if (thumbCache[key]) return thumbCache[key];
    var cv = document.createElement('canvas'); cv.width = cv.height = 140;
    var c = cv.getContext('2d'); c.translate(70, 70); c.scale(1.15, 1.15); c.lineJoin = 'round'; c.lineCap = 'round';
    ITEMS[it.id](c, it.col);
    return (thumbCache[key] = cv.toDataURL());
  }
  var TICK = '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderList() {
    listEl.innerHTML = S.items.map(function (it, i) {
      return '<div class="find' + (it.found ? ' got' : '') + '" data-i="' + i + '" role="img" aria-label="' + (it.found ? 'Found the ' : 'Find the ') + it.id + '"><img alt="" src="' + itemThumb(it) + '"><span class="tick">' + TICK + '</span></div>';
    }).join('');
  }
  function newRound(id, keepQuiet) {
    var n = W > 800 ? 5 : 4;
    S = makeScene(id, W, H, n);
    P.scene = id; save();
    idleT = 0; party = 0; picShown = false;
    renderList();
    if (!keepQuiet) Sound.whoosh();
  }

  /* ================= input ================= */
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (!S || party > 0) return;
    idleT = 0;
    var r = toScene(e.clientX, e.clientY), best = null, bd = 1e9;
    S.items.forEach(function (it) {
      if (it.found) return;
      var d = Math.hypot(r.x - it.x, r.y - it.y);
      if (d < it.size * 0.72 && d < bd) { bd = d; best = it; }
    });
    if (best) found(best);
    else { parts.push({ x: r.x, y: r.y, life: 0, max: 0.45, kind: 'ring', r: 10, vx: 0, vy: 0, g: 0, color: '#fff' }); Sound.boop(); }
  });
  function found(it) {
    it.found = true; it.t = 0;
    P.found++; save();
    pops.push({ it: it, t: 0 });
    sparkle(it.x, it.y, '#FFD23F', 16, 1.1);
    Sound.found(); buzz(20);
    var i = S.items.indexOf(it);
    var card = listEl.querySelector('[data-i="' + i + '"]');
    if (card) { card.classList.add('got'); card.setAttribute('aria-label', 'Found the ' + it.id); }
    if (S.items.every(function (x) { return x.found; })) { party = 0.01; P.rounds++; save(); if (GG.stat) GG.stat('seek', 'rounds', 1); }
  }
  var pops = [];

  /* ================= picking a picture ================= */
  var sceneThumbs = {};
  function sceneThumb(id) {
    if (sceneThumbs[id]) return sceneThumbs[id];
    var cv = document.createElement('canvas'); cv.width = 330; cv.height = 240;
    var c = cv.getContext('2d'); var T = makeScene(id, 1000, 720, 4);
    c.scale(330 / 1000, 240 / 720); c.lineJoin = 'round'; c.lineCap = 'round';
    drawScene(c, T, false);
    return (sceneThumbs[id] = cv.toDataURL());
  }
  var AGAIN = '<svg viewBox="0 0 24 24"><path d="M19 12 A7 7 0 1 1 16 6.3" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/><path d="M13 5 L17 6 L16 10" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function showPicker(won) {
    $('pickTitle').textContent = won ? 'You found them all!' : 'Pick a picture';
    var cur = S ? S.def.id : P.scene;
    var order = [cur].concat(SCENES.map(function (s) { return s.id; }).filter(function (id) { return id !== cur; }));
    $('scenes').innerHTML = order.map(function (id, i) {
      return '<button class="scene' + (i === 0 ? ' same' : '') + '" type="button" data-scene="' + id + '" aria-label="' + (i === 0 ? 'Play the ' + id + ' again' : 'Play the ' + id) + '"><img alt="" src="' + sceneThumb(id) + '">' + (i === 0 ? '<span class="again">' + AGAIN + '</span>' : '') + '</button>';
    }).join('');
    $('pickWrap').hidden = false;
    var first = $('scenes').querySelector('button'); if (first) first.focus();
  }
  $('scenes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-scene]'); if (!b) return;
    Sound.init(); Sound.pop();
    $('pickWrap').hidden = true;
    newRound(b.dataset.scene);
  });
  $('pickWrap').addEventListener('click', function (e) { if (e.target === $('pickWrap') && S && !S.items.every(function (x) { return x.found; })) $('pickWrap').hidden = true; });
  $('sceneBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); showPicker(false); });

  /* ================= particles ================= */
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 220) * (spd || 1); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90, life: 0, max: rand(0.6, 1.1), r: rand(6, 11), color: Math.random() < 0.3 ? '#fff' : color, kind: Math.random() < 0.6 ? 'star' : 'dot', spin: rand(-5, 5) }); }
  }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y);
      if (p.kind === 'ring') { circle(c, 0, 0, 10 + (1 - k) * 40); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 5; c.stroke(); c.restore(); return; }
      c.rotate(p.life * (p.spin || 0));
      if (p.kind === 'star') star(c, p.r * 1.3); else { c.beginPath(); c.arc(0, 0, p.r * 0.6, 0, TAU); }
      c.fillStyle = p.color; c.fill(); if (p.kind === 'star') ink(c, 2);
      c.restore();
    });
  }

  /* ================= update and draw ================= */
  function update(dt) {
    time += dt;
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 380) * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (var j = pops.length - 1; j >= 0; j--) { pops[j].t += dt; if (pops[j].t > 0.9) pops.splice(j, 1); }
    if (!S) return;
    S.items.forEach(function (it) { if (it.hint > 0) it.hint -= dt; });
    if (party > 0) {
      party += dt;
      if (party > 0.3 && party < 1.6 && Math.random() < dt * 10) sparkle(rand(60, W - 60), rand(40, H * 0.5), pick(['#FF8FAB', '#FFD23F', '#7CC4FF', '#7BD389', '#B48CFF']), 8, 1);
      if (party > 0.3 && !S.cheered) { S.cheered = true; Sound.win(); }
      if (party > 1.9 && !picShown) { picShown = true; showPicker(true); }
      return;
    }
    if (!$('pickWrap').hidden) return;
    idleT += dt;
    // a gentle nudge: after a quiet while, one hidden thing wiggles and its card does too
    if (idleT > 8) {
      idleT = 4;
      var left = S.items.filter(function (x) { return !x.found; });
      if (left.length) {
        var it = pick(left); it.hint = 0.9; Sound.rustle();
        var card = listEl.querySelector('[data-i="' + S.items.indexOf(it) + '"]');
        if (card) { card.classList.remove('hint'); void card.offsetWidth; card.classList.add('hint'); }
      }
    }
  }
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (!S) return;
    ctx.save();
    rr(ctx, OX, OY, W * K, H * K, 24); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawScene(ctx, S, true);
    // found things pop up out of their hiding place, then fade
    pops.forEach(function (p) {
      var t = p.t / 0.9, it = p.it;
      ctx.save(); ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      var lift = easeOut(t) * 60;
      ctx.translate(0, -lift);
      drawItem(ctx, it, lerp(1, 1.45, easeBack(Math.min(1, t * 2))));
      ctx.restore();
    });
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, W * K, H * K, 24); ink(ctx, 5);
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
      pop: function () { tone({ f: 420, to: 920, dur: 0.11, gain: 0.14, slide: 0.06 }); },
      boop: function () { tone({ f: 330, to: 280, dur: 0.1, gain: 0.06, type: 'triangle' }); },
      whoosh: function () { noise({ type: 'bandpass', freq: 1400, q: 0.6, attack: 0.04, dur: 0.2, gain: 0.07 }); },
      rustle: function () { for (var i = 0; i < 4; i++) noise({ type: 'bandpass', freq: 2200, q: 1, attack: 0.01, dur: 0.05, gain: 0.05, delay: i * 0.07 }); },
      found: function () { [659.25, 987.77].forEach(function (f, i) { tone({ f: f, dur: 0.3, gain: 0.12, delay: i * 0.08 }); }); },
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
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.pop(); });
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= main loop ================= */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); render();
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(listEl); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  newRound(sceneDef(P.scene).id, true);
  layout();
  requestAnimationFrame(frame);

  /* test hook */
  window.__seek = {
    state: function () { return S && { scene: S.def.id, W: W, H: H, props: S.props.length, items: S.items.map(function (it) { return { id: it.id, x: it.x, y: it.y, found: it.found }; }), party: party, picker: !$('pickWrap').hidden, saved: JSON.parse(JSON.stringify(P)) }; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; }
  };
})();
