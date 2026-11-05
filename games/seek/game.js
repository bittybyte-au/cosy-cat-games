/* Hide and Seek – a toddler game (about age 3). A picture (garden, bedroom, beach or kitchen) with a few things peeking out
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
  /* more things for the busier pictures */
  ITEMS.block = function (c, col) {
    rr(c, -34, -30, 64, 64, 8); fillInk(c, col || '#FF5A5F', 4.5);
    c.beginPath(); c.moveTo(-34, -30); c.lineTo(-22, -42); c.lineTo(42, -42); c.lineTo(30, -30); c.closePath(); fillInk(c, '#FFF3B0', 4);
    c.beginPath(); c.moveTo(30, -30); c.lineTo(42, -42); c.lineTo(42, 22); c.lineTo(30, 34); c.closePath(); fillInk(c, 'rgba(42,35,64,.25)', 4);
    c.font = '800 40px "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('A', -2, 6);
  };
  ITEMS.car = function (c, col) {
    c.beginPath(); c.moveTo(-46, 12); c.lineTo(-46, -6); c.lineTo(-24, -10); c.lineTo(-12, -30); c.lineTo(18, -30); c.lineTo(32, -10); c.lineTo(46, -6); c.lineTo(46, 12); c.closePath(); fillInk(c, col || '#3D8BFF', 4.5);
    c.beginPath(); c.moveTo(-8, -24); c.lineTo(14, -24); c.lineTo(24, -10); c.lineTo(-16, -10); c.closePath(); fillInk(c, '#BFE6FF', 3);
    circle(c, -26, 14, 11); fillInk(c, '#3D3650', 4); circle(c, 26, 14, 11); fillInk(c, '#3D3650', 4);
    circle(c, -26, 14, 4); c.fillStyle = '#C9C2D6'; c.fill(); circle(c, 26, 14, 4); c.fill();
  };
  ITEMS.book = function (c, col) {
    rr(c, -36, -40, 72, 80, 6); fillInk(c, col || '#B48CFF', 4.5);
    rr(c, 26, -36, 8, 72, 3); c.fillStyle = '#fff'; c.fill();
    rr(c, -24, -26, 44, 18, 4); fillInk(c, '#fff', 3);
    circle(c, -4, 16, 9); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill();
  };
  ITEMS.crayon = function (c, col) {
    c.save(); c.rotate(-0.5);
    rr(c, -40, -11, 64, 22, 5); fillInk(c, col || '#FF9F43', 4);
    c.beginPath(); c.moveTo(24, -11); c.lineTo(46, 0); c.lineTo(24, 11); c.closePath(); fillInk(c, '#FFE3C2', 3.5);
    c.beginPath(); c.moveTo(38, -4); c.lineTo(46, 0); c.lineTo(38, 4); c.closePath(); c.fillStyle = col || '#FF9F43'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; [-28, 10].forEach(function (x) { c.beginPath(); c.moveTo(x, -9); c.lineTo(x, 9); c.stroke(); });
    c.restore();
  };
  ITEMS.carrot = function (c) {
    c.save(); c.rotate(0.6);
    c.beginPath(); c.moveTo(-14, -30); c.quadraticCurveTo(0, -36, 14, -30); c.lineTo(2, 44); c.quadraticCurveTo(0, 48, -2, 44); c.closePath(); fillInk(c, '#FF9A2E', 4.5);
    c.strokeStyle = '#D9761A'; c.lineWidth = 3; [[-8, -10, 2, -8], [-4, 10, 6, 12]].forEach(function (l) { c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke(); });
    [[-10, -52], [0, -58], [10, -52]].forEach(function (q) { c.beginPath(); c.moveTo(0, -32); c.quadraticCurveTo(q[0] * 1.6, -44, q[0], q[1]); c.strokeStyle = INK; c.lineWidth = 9; c.stroke(); c.strokeStyle = '#4FB868'; c.lineWidth = 5; c.stroke(); });
    c.restore();
  };
  ITEMS.flower = function (c, col) {
    c.beginPath(); c.moveTo(0, 10); c.quadraticCurveTo(6, 30, 0, 48); c.strokeStyle = INK; c.lineWidth = 9; c.stroke(); c.strokeStyle = '#4FB868'; c.lineWidth = 5; c.stroke();
    for (var i = 0; i < 6; i++) { var a = i * TAU / 6; circle(c, Math.cos(a) * 20, -6 + Math.sin(a) * 20, 15); fillInk(c, col || '#FF8FAB', 3.5); }
    circle(c, 0, -6, 13); fillInk(c, '#FFD23F', 3.5);
  };
  ITEMS.ladybug = function (c) {
    circle(c, 0, -30, 13); fillInk(c, '#3D3650', 4);
    circle(c, 0, 4, 34); fillInk(c, '#FF4D4D', 4.5);
    c.beginPath(); c.moveTo(0, -30); c.lineTo(0, 38); ink(c, 3.5);
    c.fillStyle = INK; [[-16, -8], [16, -8], [-18, 16], [18, 16], [-6, 28], [8, 28]].forEach(function (q) { circle(c, q[0], q[1], 6); c.fill(); });
    circle(c, -5, -32, 3); c.fillStyle = '#fff'; c.fill(); circle(c, 5, -32, 3); c.fill();
  };
  ITEMS.snail = function (c) {
    c.beginPath(); c.moveTo(-46, 24); c.lineTo(36, 24); c.quadraticCurveTo(50, 24, 46, 6); c.lineTo(40, 6); c.lineTo(36, 16); c.lineTo(-40, 16); c.closePath(); fillInk(c, '#FFD9A8', 4);
    c.beginPath(); c.moveTo(40, 6); c.lineTo(36, -16); c.moveTo(46, 6); c.lineTo(52, -14); ink(c, 3);
    circle(c, 36, -18, 4); c.fillStyle = INK; c.fill(); circle(c, 52, -16, 4); c.fill();
    circle(c, -4, -6, 30); fillInk(c, '#C98B5B', 4.5);
    c.beginPath(); for (var i = 0; i < 40; i++) { var a = i * 0.35, r = 3 + i * 0.6; c.lineTo(-4 + Math.cos(a) * r, -6 + Math.sin(a) * r); } c.strokeStyle = '#7A4E2D'; c.lineWidth = 3.5; c.stroke();
  };
  ITEMS.leaf = function (c, col) {
    c.save(); c.rotate(-0.5);
    c.beginPath(); c.moveTo(-44, 0); c.quadraticCurveTo(-4, -36, 40, 0); c.quadraticCurveTo(-4, 36, -44, 0); c.closePath(); fillInk(c, col || '#7BD389', 4.5);
    c.beginPath(); c.moveTo(-50, 0); c.lineTo(34, 0); ink(c, 3); c.strokeStyle = 'rgba(42,35,64,.4)'; c.lineWidth = 2.5; [-20, 0, 16].forEach(function (x) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 10, -14); c.moveTo(x, 0); c.lineTo(x + 10, 14); c.stroke(); });
    c.restore();
  };
  ITEMS.butterfly = function (c, col) {
    [-1, 1].forEach(function (s) {
      c.save(); c.scale(s, 1);
      ell(c, 22, -14, 22, 18, -0.4); fillInk(c, col || '#B48CFF', 4); ell(c, 18, 18, 15, 13, 0.4); fillInk(c, col || '#B48CFF', 4);
      circle(c, 24, -16, 7); c.fillStyle = 'rgba(255,255,255,.65)'; c.fill();
      c.restore();
    });
    rr(c, -6, -26, 12, 52, 6); fillInk(c, '#3D3650', 3.5);
    c.beginPath(); c.moveTo(-3, -26); c.quadraticCurveTo(-8, -40, -14, -42); c.moveTo(3, -26); c.quadraticCurveTo(8, -40, 14, -42); ink(c, 3);
  };
  ITEMS.shell = function (c, col) {
    c.beginPath(); c.moveTo(0, 36); c.lineTo(-40, -4); c.quadraticCurveTo(-36, -40, 0, -42); c.quadraticCurveTo(36, -40, 40, -4); c.closePath(); fillInk(c, col || '#FFC2DA', 4.5);
    c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 3; [-24, -8, 8, 24].forEach(function (x) { c.beginPath(); c.moveTo(0, 32); c.quadraticCurveTo(x * 0.7, -10, x, -36); c.stroke(); });
    rr(c, -12, 30, 24, 10, 4); fillInk(c, col || '#FFC2DA', 3);
  };
  ITEMS.starfish = function (c) {
    c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 18 : 46; c.lineTo(Math.cos(a) * r, Math.sin(a) * r + 4); } c.closePath();
    fillInk(c, '#FF9F43', 4.5);
    c.fillStyle = '#FFD9A8'; [[0, -24], [-26, -4], [26, -4], [-16, 26], [16, 26], [0, 4]].forEach(function (q) { circle(c, q[0], q[1], 3.5); c.fill(); });
  };
  ITEMS.crab = function (c) {
    [-1, 1].forEach(function (s) {
      c.save(); c.scale(s, 1);
      [[30, 10, 44, 24], [32, 18, 42, 34]].forEach(function (l) { c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); ink(c, 4); });
      c.beginPath(); c.moveTo(26, -8); c.lineTo(38, -22); ink(c, 5);
      c.beginPath(); c.arc(42, -30, 12, 0.6, TAU - 0.2); c.closePath(); fillInk(c, '#FF5A5F', 3.5);
      c.beginPath(); c.moveTo(8, -18); c.lineTo(10, -32); ink(c, 3); circle(c, 10, -34, 5); fillInk(c, '#fff', 2.5); circle(c, 10, -34, 2); c.fillStyle = INK; c.fill();
      c.restore();
    });
    ell(c, 0, 4, 34, 22); fillInk(c, '#FF5A5F', 4.5);
    c.beginPath(); c.moveTo(-8, 10); c.quadraticCurveTo(0, 16, 8, 10); ink(c, 3);
  };
  ITEMS.icecream = function (c, col) {
    c.beginPath(); c.moveTo(-22, -4); c.lineTo(22, -4); c.lineTo(0, 46); c.closePath(); fillInk(c, '#E8A85C', 4);
    c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-14, 6); c.lineTo(8, 26); c.moveTo(14, 6); c.lineTo(-8, 26); c.stroke();
    circle(c, 0, -20, 24); fillInk(c, col || '#FF9EC4', 4.5);
    circle(c, -8, -26, 5); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
    circle(c, 4, -46, 7); fillInk(c, '#FF5A5F', 3);
  };
  ITEMS.sunglasses = function (c, col) {
    c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(0, -12, 14, -6); ink(c, 5);
    [-1, 1].forEach(function (s) { rr(c, s * 26 - 18, -14, 36, 26, 10); fillInk(c, '#3D3650', 4); c.beginPath(); c.moveTo(s * 26 - 10, -6); c.lineTo(s * 26 - 2, -10); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); });
    c.beginPath(); c.moveTo(-44, -10); c.lineTo(-50, -2); c.moveTo(44, -10); c.lineTo(50, -2); c.strokeStyle = col || '#FF5A5F'; c.lineWidth = 6; c.stroke();
    rr(c, -46, -18, 92, 8, 4); fillInk(c, col || '#FF5A5F', 3);
  };
  /* kitchen things */
  ITEMS.mug = function (c, col) {
    c.beginPath(); c.moveTo(24, -18); c.bezierCurveTo(60, -22, 60, 22, 24, 20); c.strokeStyle = INK; c.lineWidth = 15; c.stroke(); c.strokeStyle = col || '#FF8FAB'; c.lineWidth = 6; c.stroke();
    rr(c, -36, -34, 72, 72, 14); fillInk(c, col || '#FF8FAB', 4.5);
    ell(c, 0, -34, 36, 9); fillInk(c, '#8A5A2B', 3.5);
    circle(c, -6, 6, 10); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill(); circle(c, 12, 2, 6); c.fill();
  };
  ITEMS.egg = function (c) {
    c.beginPath(); c.moveTo(0, -46); c.bezierCurveTo(30, -46, 38, 2, 34, 18); c.bezierCurveTo(28, 44, -28, 44, -34, 18); c.bezierCurveTo(-38, 2, -30, -46, 0, -46); c.closePath(); fillInk(c, '#FFF6E8', 4.5);
    circle(c, -10, 2, 4); c.fillStyle = INK; c.fill(); circle(c, 10, 2, 4); c.fill();
    c.beginPath(); c.moveTo(-6, 14); c.quadraticCurveTo(0, 19, 6, 14); ink(c, 3);
    c.fillStyle = 'rgba(255,143,171,.5)'; circle(c, -20, 12, 6); c.fill(); circle(c, 20, 12, 6); c.fill();
  };
  ITEMS.cheese = function (c) {
    c.beginPath(); c.moveTo(-44, 26); c.lineTo(-44, -6); c.lineTo(40, -32); c.lineTo(44, 26); c.closePath(); fillInk(c, '#FFD23F', 4.5);
    c.beginPath(); c.moveTo(-44, -6); c.lineTo(40, -32); c.lineTo(44, -18); c.lineTo(-40, 2); c.closePath(); fillInk(c, '#FFE680', 3.5);
    c.fillStyle = '#E8B400'; [[-22, 12, 7], [8, 6, 9], [28, 16, 5], [-6, 20, 4]].forEach(function (q) { circle(c, q[0], q[1], q[2]); c.fill(); });
  };
  ITEMS.banana = function (c) {
    c.save(); c.rotate(-0.3);
    c.beginPath(); c.moveTo(-46, -12); c.quadraticCurveTo(-10, 40, 44, -14); c.quadraticCurveTo(46, -22, 40, -20); c.quadraticCurveTo(-6, 16, -38, -18); c.closePath(); fillInk(c, '#FFD23F', 4.5);
    c.beginPath(); c.moveTo(-40, -8); c.quadraticCurveTo(-6, 24, 36, -10); c.strokeStyle = '#E8B400'; c.lineWidth = 3; c.stroke();
    rr(c, -52, -22, 12, 12, 3); fillInk(c, '#8A5A2B', 3); circle(c, 44, -18, 3.5); c.fillStyle = INK; c.fill();
    c.restore();
  };
  ITEMS.teapot = function (c, col) {
    c.beginPath(); c.moveTo(20, 8); c.quadraticCurveTo(50, -2, 52, -30); c.lineTo(44, -32); c.quadraticCurveTo(42, -14, 20, -10); c.closePath(); fillInk(c, col || '#7CC4FF', 4);
    c.beginPath(); c.moveTo(-20, -14); c.bezierCurveTo(-58, -22, -58, 26, -20, 20); c.strokeStyle = INK; c.lineWidth = 14; c.stroke(); c.strokeStyle = col || '#7CC4FF'; c.lineWidth = 5; c.stroke();
    ell(c, 0, 4, 34, 30); fillInk(c, col || '#7CC4FF', 4.5);
    ell(c, 0, -24, 22, 7); fillInk(c, '#fff', 3.5); circle(c, 0, -34, 7); fillInk(c, col || '#7CC4FF', 3.5);
    c.fillStyle = '#fff'; [[-14, 6], [0, 14], [14, 6]].forEach(function (q) { circle(c, q[0], q[1], 5); c.fill(); });
  };
  ITEMS.spoon = function (c) {
    c.save(); c.rotate(-0.7);
    rr(c, -8, -4, 16, 54, 8); fillInk(c, '#C98B5B', 4);
    ell(c, 0, -26, 20, 26); fillInk(c, '#E6B98A', 4.5);
    ell(c, -5, -32, 6, 11, 0.2); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
    c.restore();
  };
  /* colours a thing can come in (one colour per thing in a picture) */
  var ITEM_COLS = {
    block: ['#FF5A5F', '#3D8BFF', '#3FC46A', '#FFC93C'], car: ['#3D8BFF', '#FF5A5F', '#3FC46A'], book: ['#B48CFF', '#FF8FAB', '#7CC4FF'],
    crayon: ['#FF9F43', '#3D8BFF', '#A86BFF', '#3FC46A'], flower: ['#FF8FAB', '#B48CFF', '#FFFFFF', '#7CC4FF'], leaf: ['#7BD389', '#FFC93C', '#FF9A2E'],
    butterfly: ['#B48CFF', '#7CC4FF', '#FF8FAB'], shell: ['#FFC2DA', '#FFE7A8', '#FFFFFF'], icecream: ['#FF9EC4', '#FFF3C4', '#A8E6CF'],
    sunglasses: ['#FF5A5F', '#3D8BFF', '#FFC93C'], mug: ['#FF8FAB', '#7CC4FF', '#FFD23F', '#7BD389'], teapot: ['#7CC4FF', '#FF9EC4', '#7BD389'], kitten: KITTEN_COLS
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
    }, cols: ['#FF6B57', '#3D8BFF', '#FFD23F'] },
    /* kitchen */
    fridge: { w: 150, h: 290, cols: ['#FFFFFF', '#BFE6FF', '#FFD6E5', '#D9F2D0'], draw: function (c, p) {
      rr(c, -75, -290, 150, 290, 22); fillInk(c, p.col, 5);
      c.beginPath(); c.moveTo(-75, -190); c.lineTo(75, -190); ink(c, 4);
      rr(c, 50, -260, 10, 50, 5); fillInk(c, '#C9C2D6', 3); rr(c, 50, -170, 10, 60, 5); fillInk(c, '#C9C2D6', 3);
      // magnets and a drawing on the door
      rr(c, -52, -150, 56, 44, 4); fillInk(c, '#fff', 3); c.beginPath(); c.moveTo(-44, -116); c.lineTo(-30, -136); c.lineTo(-20, -124); c.lineTo(-8, -140); c.strokeStyle = '#3D8BFF'; c.lineWidth = 3; c.stroke();
      circle(c, -24, -152, 6); fillInk(c, '#FF5A5F', 2.5); circle(c, -40, -240, 9); fillInk(c, '#FFD23F', 3); circle(c, -12, -226, 7); fillInk(c, '#7BD389', 3);
      rr(c, -66, -10, 132, 10, 4); c.fillStyle = 'rgba(42,35,64,.2)'; c.fill();
    } },
    counter: { w: 230, h: 130, cols: ['#7CC4FF', '#FF9EC4', '#7BD389', '#FFC93C'], draw: function (c, p) {
      rr(c, -108, -112, 216, 112, 8); fillInk(c, p.col, 5);
      c.beginPath(); c.moveTo(0, -112); c.lineTo(0, 0); ink(c, 4);
      rr(c, -98, -102, 88, 92, 8); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.stroke(); rr(c, 10, -102, 88, 92, 8); c.stroke();
      circle(c, -16, -56, 6); fillInk(c, '#fff', 3); circle(c, 16, -56, 6); fillInk(c, '#fff', 3);
      rr(c, -115, -130, 230, 22, 6); fillInk(c, '#F4E9DA', 4.5);
    } },
    oven: { w: 170, h: 140, cols: ['#FFFFFF', '#FFE7A8', '#C7EBD2'], draw: function (c, p) {
      rr(c, -82, -128, 164, 128, 10); fillInk(c, p.col, 5);
      rr(c, -66, -84, 132, 64, 10); fillInk(c, '#3D3650', 4); rr(c, -54, -74, 108, 44, 8); c.fillStyle = '#FF9F43'; c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
      rr(c, -50, -100, 100, 8, 4); fillInk(c, '#C9C2D6', 3);
      [-48, -18, 18, 48].forEach(function (x) { circle(c, x, -114, 6); fillInk(c, '#C9C2D6', 2.5); });
      rr(c, -86, -140, 172, 16, 5); fillInk(c, '#3D3650', 4);
      [-40, 40].forEach(function (x) { ell(c, x, -140, 26, 6); c.strokeStyle = '#8A8296'; c.lineWidth = 4; c.stroke(); });
    } },
    table: { w: 250, h: 120, cols: ['#E6B98A', '#C98B5B', '#FFFFFF'], draw: function (c, p) {
      [-100, 100].forEach(function (x) { rr(c, x - 8, -100, 16, 100, 6); fillInk(c, '#C98B5B', 4); });
      rr(c, -125, -122, 250, 26, 10); fillInk(c, p.col, 5);
      c.save(); rr(c, -125, -122, 250, 26, 10); c.clip(); c.fillStyle = 'rgba(255,90,95,.55)'; for (var x = -125; x < 125; x += 28) c.fillRect(x, -122, 14, 26); c.restore();
      rr(c, -125, -122, 250, 26, 10); ink(c, 5);
    } },
    stool: { w: 90, h: 110, cols: ['#FF6B57', '#FFC93C', '#7CC4FF'], draw: function (c, p) {
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-22, -96); c.moveTo(30, 0); c.lineTo(22, -96); c.moveTo(-26, -40); c.lineTo(26, -40); ink(c, 6);
      ell(c, 0, -100, 44, 14); fillInk(c, p.col, 4.5);
    } },
    bin: { w: 80, h: 100, cols: ['#C9C2D6', '#7BD389', '#FF9EC4'], draw: function (c, p) {
      c.beginPath(); c.moveTo(-34, -88); c.lineTo(34, -88); c.lineTo(28, 0); c.lineTo(-28, 0); c.closePath(); fillInk(c, p.col, 4.5);
      rr(c, -38, -100, 76, 14, 6); fillInk(c, p.col, 4); rr(c, -10, -108, 20, 8, 4); fillInk(c, '#3D3650', 3);
    } }
  };
  /* rocks belong at the beach and in the garden */
  var SCENES = [
    { id: 'garden', kinds: ['bush', 'bush', 'pot', 'rock', 'can', 'tree'], big: ['tree'], ground: 0.42 },
    { id: 'bedroom', kinds: ['bed', 'toybox', 'basket', 'armchair', 'plant', 'toybox'], big: ['bed', 'armchair'], ground: 0.5 },
    { id: 'beach', kinds: ['castle', 'bucket', 'rock', 'beachchair', 'boat', 'castle', 'bucket'], big: ['boat', 'beachchair'], ground: 0.5 },
    { id: 'kitchen', kinds: ['fridge', 'counter', 'oven', 'table', 'stool', 'bin'], big: ['fridge', 'table'], ground: 0.5 }
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
    } else if (S.def.id === 'kitchen') {
      c.fillStyle = S.wall; c.fillRect(0, 0, W, gy);
      // tiles behind the worktops
      var ty = gy - Math.min(120, gy * 0.32);
      c.fillStyle = '#FFFFFF'; c.fillRect(0, ty, W, gy - ty);
      c.strokeStyle = 'rgba(42,35,64,.14)'; c.lineWidth = 2;
      for (var tyy = ty; tyy < gy; tyy += 30) { c.beginPath(); c.moveTo(0, tyy); c.lineTo(W, tyy); c.stroke(); }
      for (var txx = 0; txx < W; txx += 30) { c.beginPath(); c.moveTo(txx, ty); c.lineTo(txx, gy); c.stroke(); }
      c.beginPath(); c.moveTo(0, ty); c.lineTo(W, ty); ink(c, 3);
      var kx = S.winX * W;
      rr(c, kx - 90, gy * 0.12, 180, ty - gy * 0.12 - 24, 12); fillInk(c, '#9EDCFF', 5);
      c.strokeStyle = '#fff'; c.lineWidth = 7; c.beginPath(); c.moveTo(kx, gy * 0.12 + 4); c.lineTo(kx, ty - 28); c.stroke();
      circle(c, kx + 50, gy * 0.24, 16); c.fillStyle = '#FFE14D'; c.fill();
      drawCurtains(c, kx - 90, gy * 0.12, 180, ty - gy * 0.12 - 24, S.curtain);
      // checked floor
      var tile = 60; c.fillStyle = '#F4E9DA'; c.fillRect(0, gy, W, H - gy); c.fillStyle = '#E3CDB1';
      for (var fy2 = gy, r2 = 0; fy2 < H; fy2 += tile, r2++) for (var fx2 = (r2 % 2) * tile; fx2 < W; fx2 += tile * 2) c.fillRect(fx2, fy2, tile, tile);
      c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); ink(c, 4);
      ell(c, W * S.rugX, gy + (H - gy) * 0.6, W * 0.2, (H - gy) * 0.16); fillInk(c, S.rug, 4);
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

  /* ================= making a round =================
     A picture is a few pieces of furniture plus lots of things scattered about: on the floor, on the bed, on the
     shelf, half behind a bush. A handful of them are the ones to find; the rest are other things (never the same
     kind as one to find, so there's no "which duck?"). Every thing to find is checked to be at least half showing. */
  var POOLS = {
    bedroom: ['yarn', 'ball', 'duck', 'star', 'teddy', 'block', 'car', 'book', 'crayon', 'sock', 'bell', 'mouse', 'kitten', 'cupcake'],
    garden: ['apple', 'carrot', 'flower', 'ladybug', 'snail', 'leaf', 'butterfly', 'ball', 'duck', 'mouse', 'kitten', 'yarn'],
    beach: ['shell', 'starfish', 'crab', 'icecream', 'sunglasses', 'fish', 'ball', 'duck', 'kitten', 'cupcake', 'yarn'],
    kitchen: ['mug', 'egg', 'cheese', 'banana', 'teapot', 'spoon', 'apple', 'carrot', 'cupcake', 'fish', 'mouse', 'kitten', 'yarn', 'duck']
  };
  var FURNITURE = {
    bedroom: [['bed', 1], ['toybox', 1], ['shelf', 2], ['armchair', 1], ['basket', 1], ['plant', 1]],
    garden: [['tree', 1], ['bush', 2], ['pot', 2], ['rock', 1], ['can', 1]],
    beach: [['castle', 2], ['beachchair', 1], ['bucket', 1], ['rock', 1], ['towel', 1]],
    kitchen: [['fridge', 1], ['counter', 2], ['oven', 1], ['shelf', 1], ['table', 1], ['stool', 1], ['bin', 1]]
  };
  /* where things can sit on top of furniture: [left, right, height] as fractions of its width/height */
  var SURF = { bed: [-0.42, 0.36, -0.69], toybox: [-0.4, 0.4, -1.0], shelf: [-0.42, 0.42, -1.0], rock: [-0.25, 0.15, -0.92], towel: [-0.4, 0.4, -0.2],
    counter: [-0.42, 0.42, -1.0], table: [-0.4, 0.4, -1.0], oven: [-0.36, 0.36, -1.0], stool: [-0.15, 0.15, -0.95] };
  PROPS.shelf = { w: 230, h: 22, peek: [], cols: ['#C98B5B', '#E6B98A'], draw: function (c, p) {
    rr(c, -115, -22, 230, 14, 5); fillInk(c, p.col, 4);
    [-80, 80].forEach(function (x) { c.beginPath(); c.moveTo(x, -8); c.lineTo(x, 8); c.lineTo(x + (x < 0 ? 14 : -14), -8); ink(c, 4); });
  } };
  PROPS.towel = { w: 220, h: 70, peek: [], cols: ['#FF8FAB', '#7CC4FF', '#FFD23F'], draw: function (c, p) {
    c.beginPath(); c.moveTo(-100, 0); c.lineTo(-80, -60); c.lineTo(110, -60); c.lineTo(100, 0); c.closePath(); c.fillStyle = '#fff'; c.fill();
    c.save(); c.clip(); c.fillStyle = p.col; for (var x = -120; x < 130; x += 44) c.fillRect(x, -70, 22, 80); c.restore();
    c.beginPath(); c.moveTo(-100, 0); c.lineTo(-80, -60); c.lineTo(110, -60); c.lineTo(100, 0); c.closePath(); ink(c, 4);
  } };

  function makeScene(id, W, H, nItems) {
    var best = null;
    for (var tries = 0; tries < 10; tries++) {
      var S = buildScene(id, W, H, nItems);
      var vis = visibility(S);
      S.minVis = Math.min.apply(null, vis.concat([1]));
      if (S.items.length === nItems && S.minVis >= 0.5) return S;
      if (!best || S.items.length > best.items.length || (S.items.length === best.items.length && S.minVis > best.minVis)) best = S;
    }
    return best;
  }
  function buildScene(id, W, H, nItems) {
    var def = sceneDef(id);
    var S = { def: def, W: W, H: H, props: [], items: [], clutter: [], tufts: [], shells: [],
      wall: pick(['#FFE6F0', '#E6F2FF', '#FFF3D6', '#EAF7E6']), rug: pick(['#FFC2DA', '#C7EBD2', '#DCC8FF', '#FFE7A8']), curtain: pick(CURTAINS), winX: rand(0.25, 0.75), rugX: rand(0.35, 0.65), wave: rand(0, 200) };
    var gy = H * def.ground, wide = W > 800;
    for (var t = 0; t < 30; t++) S.tufts.push({ x: rand(10, W - 10), y: rand(gy + 10, H - 10) });
    for (var s = 0; s < 4; s++) S.shells.push({ x: rand(30, W - 30), y: rand(gy + 30, H - 20), r: rand(-0.5, 0.5), col: pick(['#FFC2DA', '#FFFFFF', '#FFD9A8']) });
    function scaleAt(y) { return lerp(0.72, 1.05, clamp((y - gy) / (H - gy), 0, 1)); }
    // furniture
    FURNITURE[id].forEach(function (f) {
      var n = f[1]; if (!wide && n > 1 && Math.random() < 0.5) n = 1;
      for (var i = 0; i < n; i++) {
        for (var tries = 0; tries < 60; tries++) {
          var kind = f[0], P = PROPS[kind], y, k;
          if (kind === 'shelf') { y = rand(gy * 0.45, gy * 0.75); k = 0.95; }
          else { y = rand(gy + 40, H - 30); k = scaleAt(y); }
          var w = P.w * k, x = rand(w / 2 + 10, W - w / 2 - 10);
          if (kind === 'shelf' && (id === 'bedroom' || id === 'kitchen') && Math.abs(x - S.winX * W) < w / 2 + 130) continue;
          var clash = S.props.some(function (q) { return (q.kind === 'shelf') === (kind === 'shelf') && Math.abs(q.x - x) < (q.w + w) * 0.45 && Math.abs(q.y - y) < (kind === 'shelf' ? 80 : 110); });
          if (clash) continue;
          S.props.push({ kind: kind, x: x, y: y, s: k, w: w, h: P.h * k, col: pick(P.cols), flower: pick(['#B48CFF', '#FF5A5F', '#7CC4FF']), berries: Math.random() < 0.4 ? pick(['#FF5A5F', '#B48CFF']) : null });
          break;
        }
      }
    });
    var surfaces = S.props.filter(function (p) { return SURF[p.kind]; });
    // which kinds to find, and which make up the rest of the mess
    var pool = shuffle(POOLS[id].slice());
    var findIds = pool.slice(0, nItems), otherIds = pool.slice(nItems);
    var cols = {};
    pool.forEach(function (k) { cols[k] = ITEM_COLS[k] ? pick(ITEM_COLS[k]) : null; });
    function place(kind, target) {
      for (var tries = 0; tries < 40; tries++) {
        var it = { id: kind, col: cols[kind], found: false, t: 0, rot: rand(-0.5, 0.5) };
        if (surfaces.length && Math.random() < (target ? 0.35 : 0.3)) {
          var p = pick(surfaces), sf = SURF[p.kind];
          it.size = (target ? 62 : rand(50, 66)) * p.s;
          it.x = p.x + rand(sf[0], sf[1]) * p.w; it.y = p.y + sf[2] * p.h - it.size * 0.3;
          it.key = p.y + 0.5; it.on = p;
        } else {
          var y = rand(gy + 26, H - 26), k = scaleAt(y);
          it.size = (target ? 66 : rand(52, 70)) * k;
          it.x = rand(it.size * 0.6, W - it.size * 0.6); it.y = y - it.size * 0.3; it.key = y;
        }
        if (it.y - it.size * 0.5 < 20) continue;
        // not on top of something to find, and not piled too high on anything else
        var all = S.items.concat(S.clutter);
        var bad = all.some(function (o) {
          var d = Math.hypot(o.x - it.x, o.y - it.y);
          if (d < (o.size + it.size) * 0.3) return true;
          return S.items.indexOf(o) >= 0 && it.key > o.key && d < o.size * 0.62 + it.size * 0.2;
        });
        if (bad) continue;
        return it;
      }
      return null;
    }
    findIds.forEach(function (k) { var it = place(k, true); if (it) S.items.push(it); });
    var nOther = wide ? 26 : 17;
    for (var i = 0; i < nOther; i++) { var it = place(otherIds[i % otherIds.length], false); if (it) S.clutter.push(it); }
    return S;
  }

  /* how much of each thing to find shows (0..1), by drawing the picture small with them in flat colours */
  var maskCv = document.createElement('canvas'), soloCv = document.createElement('canvas');
  function silhouette(c, it, rgb) {
    var sz = Math.ceil(it.size * 1.6 * MS) + 4;
    soloCv.width = soloCv.height = sz;
    var s = soloCv.getContext('2d');
    s.save(); s.translate(sz / 2, sz / 2); s.scale(MS, MS); s.translate(-it.x, -it.y); drawItem(s, it); s.restore();
    s.globalCompositeOperation = 'source-in'; s.fillStyle = rgb; s.fillRect(0, 0, sz, sz);
    c.drawImage(soloCv, it.x * MS - sz / 2, it.y * MS - sz / 2);
  }
  var MS = 0.3;
  function countRGB(c, w, h, r, g, b) {
    var d = c.getImageData(0, 0, w, h).data, n = 0;
    for (var i = 0; i < d.length; i += 4) if (d[i] === r && d[i + 1] === g && d[i + 2] === b) n++;
    return n;
  }
  function visibility(S) {
    var w = Math.ceil(S.W * MS), h = Math.ceil(S.H * MS);
    maskCv.width = w; maskCv.height = h;
    var c = maskCv.getContext('2d');
    var ids = S.items.map(function (it, i) { return [250, 3, 10 + i * 20]; });
    // each alone
    var alone = S.items.map(function (it, i) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
      silhouette(c, it, 'rgb(' + ids[i].join(',') + ')');
      return countRGB(c, w, h, ids[i][0], ids[i][1], ids[i][2]);
    });
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.save(); c.scale(MS, MS);
    drawLayers(c, S, false, function (it) { var i = S.items.indexOf(it); c.restore(); silhouette(c, it, 'rgb(' + ids[i].join(',') + ')'); c.save(); c.scale(MS, MS); });
    c.restore();
    return S.items.map(function (it, i) { return alone[i] ? countRGB(c, w, h, ids[i][0], ids[i][1], ids[i][2]) / alone[i] : 0; });
  }

  function drawItem(c, it, extraScale) {
    c.save(); c.translate(it.x, it.y); c.rotate(it.rot || 0);
    var k = it.size / 100 * (extraScale || 1); c.scale(k, k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    ITEMS[it.id](c, it.col);
    c.restore();
  }
  function drawProp(c, p) {
    c.save(); c.translate(p.x, p.y); c.scale(p.s, p.s); c.lineJoin = 'round'; c.lineCap = 'round';
    if (p.kind !== 'shelf' && p.kind !== 'towel') { ell(c, 0, 2, PROPS[p.kind].w * 0.46, 10); c.fillStyle = 'rgba(42,35,64,.12)'; c.fill(); }
    PROPS[p.kind].draw(c, p);
    c.restore();
  }
  /* everything in depth order: further back first; things on furniture just after it; towels flat on the ground */
  function drawLayers(c, S, live, targetFn) {
    var list = [];
    S.props.forEach(function (p) { list.push({ key: p.kind === 'towel' ? -1 : p.y, prop: p }); });
    S.clutter.forEach(function (it) { list.push({ key: it.key, item: it }); });
    S.items.forEach(function (it) { list.push({ key: it.key, item: it, target: true }); });
    list.sort(function (a, b) { return a.key - b.key; });
    list.forEach(function (e) {
      if (e.prop) { drawProp(c, e.prop); return; }
      var it = e.item;
      if (e.target && targetFn) { targetFn(it); return; }
      if (live && it.found) return;
      if (live && (it.hint > 0 || it.wob > 0)) {
        var a = it.hint > 0 ? Math.sin(it.hint * 18) * 0.18 : Math.sin(it.wob * 30) * 0.12;
        c.save(); c.translate(it.x, it.y); c.rotate(a); c.translate(-it.x, -it.y); drawItem(c, it); c.restore();
      } else drawItem(c, it);
    });
  }
  function drawScene(c, S, live) {
    drawBackground(c, S, S.W, S.H);
    drawLayers(c, S, live);
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
    var key = it.id + (it.col || '');
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
      if (d < it.size * 0.62 && d < bd) { bd = d; best = it; }
    });
    if (best) found(best);
    else {
      // not one to find: whatever was tapped gives a little wobble
      var other = null; S.clutter.forEach(function (o) { if (Math.hypot(r.x - o.x, r.y - o.y) < o.size * 0.55) other = o; });
      if (other) other.wob = 0.4;
      parts.push({ x: r.x, y: r.y, life: 0, max: 0.45, kind: 'ring', r: 10, vx: 0, vy: 0, g: 0, color: '#fff' }); Sound.boop();
    }
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
    S.clutter.forEach(function (it) { if (it.wob > 0) it.wob -= dt; });
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
    state: function () { return S && { scene: S.def.id, W: W, H: H, props: S.props.length, clutter: S.clutter.length, minVis: S.minVis, items: S.items.map(function (it) { return { id: it.id, x: it.x, y: it.y, found: it.found }; }), party: party, picker: !$('pickWrap').hidden, saved: JSON.parse(JSON.stringify(P)) }; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; }
  };
})();
