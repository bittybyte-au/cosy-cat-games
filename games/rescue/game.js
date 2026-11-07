/* Cat Rescue (ages 10+): a match-3 where every level is a rescue. Swap neighbouring pieces to make lines of three;
   matches break the cardboard boxes next to them, and kittens hiding in boxes pop out and scamper up to safety.
   Above the board (one picture with it) a cat is stuck somewhere, and the level's rescue is built step by step:
   rescue parts (ladder rungs...) drop onto the board with the refills, a match made next to one collects it, and it
   flies up into the scene and is added to the rescue (one more rung on the ladder) while the cat cheers. Build it
   all (and finish any other goals) before the moves run out and the cat climbs down to the basket. Not in time is
   a soft card, with Try again and (once per go) 5 more moves, both free.
   PROTOTYPE: rescue 1 (the tree and the ladder) is the new kind; the other rescues still have the older scenes,
   where a little peril creeps forward with each move.
   No stars, scores, lives, timers or rewards: the rescuing is the point.
   The rules live in engine.js (shared with the test bot), levels in levels.js, the scenes in scenes.js.
   Saves GG.setProgress('rescue', { done: [level numbers rescued], last }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK, TAU = Math.PI * 2;
  var E = window.RescueEngine, LEVELS = window.RescueLevels, SC = window.RescueScenes;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KITTENS = ['ginger', 'white', 'black', 'pink', 'blue', 'purple'];
  var NAMES = ['fish', 'yarn ball', 'paw print', 'bell', 'milk bottle', 'toy mouse'];
  var COLS = ['#5DB6F5', '#FF7EB6', '#A77BFF', '#FFC93C', '#FFFFFF', '#7BD389'];
  var BOX = '#E2A866';
  var SPEED = 1, freeze = null; // freeze: tests hold the scene at one moment

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eout(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function back(t) { t = clamp(t, 0, 1); var s = 1.9; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  /* ================= sound: soft and synthesised ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null, on = GG.getSetting('sound', true), lastLand = 0;
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.85 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function ok() { return ac && on; }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function tone(o) {
      if (!ok()) return;
      var t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(), g = ac.createGain();
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      env(g, t, o.attack || 0.006, o.gain || 0.12, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.006) + (o.dur || 0.15) + 0.05);
    }
    function noise(o) {
      if (!ok()) return;
      var t = ac.currentTime + (o.delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 1;
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.attack || 0.004) + (o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.004, o.gain || 0.15, o.dur || 0.1);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + (o.attack || 0.004) + (o.dur || 0.1) + 0.05);
    }
    var SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
    return {
      init: init, isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.85 : 0, ac.currentTime, 0.02); },
      swap: function () { noise({ freq: 1300, to: 2400, q: 0.8, attack: 0.03, dur: 0.09, gain: 0.07 }); },
      nope: function () { tone({ f: 330, to: 270, dur: 0.1, gain: 0.07, type: 'triangle' }); tone({ f: 300, to: 240, dur: 0.1, gain: 0.06, type: 'triangle', delay: 0.11 }); },
      pop: function (chain, delay) { var f = SCALE[Math.min(7, chain)]; tone({ f: f * 0.6, to: f, dur: 0.1, gain: 0.11, slide: 0.05, delay: delay }); tone({ f: f * 2, dur: 0.05, gain: 0.02, type: 'triangle', delay: (delay || 0) + 0.02 }); },
      thud: function () { noise({ type: 'lowpass', freq: 380, q: 1, dur: 0.08, gain: 0.22 }); tone({ f: 150, to: 95, dur: 0.1, gain: 0.1, type: 'triangle' }); },
      crunch: function () { noise({ freq: 900, q: 0.9, dur: 0.12, gain: 0.2 }); for (var i = 0; i < 4; i++) noise({ freq: 1400 + i * 300, q: 2, dur: 0.03, gain: 0.08, delay: 0.03 + i * 0.035 }); tone({ f: 120, to: 80, dur: 0.12, gain: 0.08, type: 'triangle' }); },
      rip: function () { noise({ type: 'highpass', freq: 1500, to: 5000, q: 0.7, attack: 0.01, dur: 0.16, gain: 0.08 }); },
      mew: function (delay) { var k = rand(0.92, 1.12); tone({ f: 700 * k, to: 1150 * k, dur: 0.12, gain: 0.07, type: 'triangle', slide: 0.1, delay: delay }); tone({ f: 1150 * k, to: 820 * k, dur: 0.18, gain: 0.06, type: 'triangle', slide: 0.16, delay: (delay || 0) + 0.11 }); },
      mrrp: function (delay) { var k = rand(0.9, 1.15); tone({ f: 480 * k, to: 760 * k, dur: 0.1, gain: 0.06, type: 'triangle', delay: delay }); tone({ f: 760 * k, to: 620 * k, dur: 0.12, gain: 0.05, type: 'triangle', delay: (delay || 0) + 0.09 }); },
      zoom: function (delay) { noise({ freq: 500, to: 3200, q: 1.2, attack: 0.02, dur: 0.3, gain: 0.1, delay: delay }); },
      poof: function (delay) { noise({ type: 'lowpass', freq: 700, q: 0.8, attack: 0.01, dur: 0.25, gain: 0.2, delay: delay }); tone({ f: 330, to: 200, dur: 0.2, gain: 0.07, delay: delay }); },
      shimmer: function (delay) { [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { tone({ f: f, dur: 0.3, gain: 0.05, delay: (delay || 0) + i * 0.06 }); }); },
      made: function () { tone({ f: 880, dur: 0.18, gain: 0.07 }); tone({ f: 1320, dur: 0.26, gain: 0.05, delay: 0.07 }); },
      pluck: function (delay) { tone({ f: 520, to: 500, dur: 0.12, gain: 0.08, type: 'triangle', delay: delay }); tone({ f: 780, dur: 0.1, gain: 0.05, type: 'triangle', delay: (delay || 0) + 0.06 }); },
      land: function () { var n = performance.now(); if (n - lastLand < 70) return; lastLand = n; noise({ type: 'lowpass', freq: 420, q: 1.2, dur: 0.035, gain: 0.05 }); },
      chime: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.7, gain: 0.1, delay: i * 0.1 }); tone({ f: f * 2, dur: 0.3, gain: 0.025, delay: i * 0.1, type: 'triangle' }); }); },
      purr: function (delay) { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.2, delay: (delay || 0) + i * 0.085 }); },
      splash: function () { noise({ type: 'lowpass', freq: 2200, to: 400, q: 0.6, attack: 0.01, dur: 0.5, gain: 0.2 }); },
      flump: function () { noise({ type: 'lowpass', freq: 320, q: 0.8, attack: 0.01, dur: 0.3, gain: 0.25 }); tone({ f: 240, to: 120, dur: 0.25, gain: 0.08, slide: 0.2, delay: 0.05 }); },
      rustle: function () { for (var i = 0; i < 6; i++) noise({ freq: 3000 + i * 200, q: 1.5, dur: 0.05, gain: 0.07, delay: i * 0.05 }); },
      boing: function (delay) { tone({ f: 300, to: 520, dur: 0.18, gain: 0.07, slide: 0.15, delay: delay }); },
      whoosh: function (delay) { noise({ freq: 900, to: 2600, q: 1, attack: 0.04, dur: 0.22, gain: 0.06, delay: delay }); },
      knock: function (n) { var f = SCALE[Math.min(7, n || 0)]; noise({ type: 'lowpass', freq: 600, q: 1.5, dur: 0.04, gain: 0.18 }); tone({ f: f * 0.5, to: f * 0.48, dur: 0.07, gain: 0.1, type: 'triangle' }); tone({ f: f, dur: 0.16, gain: 0.07, delay: 0.06 }); tone({ f: f * 1.5, dur: 0.2, gain: 0.05, delay: 0.12 }); }
    };
  })();

  /* ================= the pieces, boxes and yarn, drawn in a 100-unit cell ================= */
  function tube(c, path, w, col) { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = w + 5 * LWK; c.stroke(path); c.strokeStyle = col; c.lineWidth = w; c.stroke(path); }
  var LWK = 1; // line weights scale with the cell so outlines stay about 3–4.5px
  function lw(n) { return n * LWK; }
  function P(fn) { var p = new Path2D(); fn(p); return p; }

  var PIECES = [
    function fish(c) {
      var body = P(function (p) { p.moveTo(-38, 2); p.bezierCurveTo(-30, -26, 8, -28, 22, -6); p.lineTo(40, -22); p.quadraticCurveTo(33, 2, 40, 24); p.lineTo(22, 8); p.bezierCurveTo(8, 28, -30, 28, -38, 2); p.closePath(); });
      D.shape(c, body, D.tone(c, COLS[0], -26, 26), { lw: lw(5), depth: 7, shine: [-18, -14, 10, 4.5, -0.3, 0.5], inside: function (c) {
        c.fillStyle = '#BFE4FF'; c.beginPath(); c.ellipse(-8, 15, 24, 8, 0, 0, TAU); c.fill();
        c.strokeStyle = '#2F8BD6'; c.lineWidth = lw(3); c.beginPath(); c.moveTo(-2, -16); c.quadraticCurveTo(4, 2, -2, 18); c.moveTo(9, -12); c.quadraticCurveTo(14, 2, 9, 14); c.stroke();
        c.strokeStyle = INK; c.lineWidth = lw(3); c.beginPath(); c.moveTo(-15, -12); c.quadraticCurveTo(-9, 0, -15, 12); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(-25, -3, 6.5, 0, TAU); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(-26, -3, 3.4, 0, TAU); c.fill();
      } });
    },
    function yarn(c) {
      tube(c, P(function (p) { p.moveTo(18, 24); p.quadraticCurveTo(30, 44, 42, 34); }), lw(4.5), COLS[1]);
      D.shape(c, D.ellPath(-2, -2, 33, 33), D.tone(c, COLS[1], -35, 31), { lw: lw(5), depth: 7, shine: [-14, -18, 9, 5, -0.6, 0.5], inside: function (c) {
        c.strokeStyle = '#E2508F'; c.lineWidth = lw(3.2);
        for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-36, i * 11 - 8); c.quadraticCurveTo(-2, i * 11 + 12, 32, i * 11 - 10); c.stroke(); }
        c.beginPath(); c.moveTo(-12, -36); c.quadraticCurveTo(12, -4, -8, 32); c.stroke();
      } });
    },
    function paw(c) {
      var pad = P(function (p) { p.moveTo(0, 4); p.bezierCurveTo(18, 4, 32, 18, 28, 30); p.bezierCurveTo(24, 40, 8, 37, 0, 37); p.bezierCurveTo(-8, 37, -24, 40, -28, 30); p.bezierCurveTo(-32, 18, -18, 4, 0, 4); p.closePath(); });
      [[-27, -10, -0.35], [-10, -27, -0.1], [10, -27, 0.1], [27, -10, 0.35]].forEach(function (t) {
        D.shape(c, D.ellPath(t[0], t[1], 10, 12.5, t[2]), D.tone(c, COLS[2], t[1] - 12, t[1] + 12), { lw: lw(4), depth: 3, shine: [t[0] - 3, t[1] - 5, 3, 2, 0, 0.5] });
      });
      D.shape(c, pad, D.tone(c, COLS[2], 4, 38), { lw: lw(5), depth: 6, shine: [-8, 12, 8, 4, -0.2, 0.45] });
    },
    function bell(c) {
      D.shape(c, D.ellPath(0, 27, 8, 7), '#E0A21C', { lw: lw(4), depth: 2 });
      var body = P(function (p) { p.moveTo(-31, 22); p.bezierCurveTo(-31, -6, -24, -30, 0, -30); p.bezierCurveTo(24, -30, 31, -6, 31, 22); p.quadraticCurveTo(36, 26, 31, 28); p.lineTo(-31, 28); p.quadraticCurveTo(-36, 26, -31, 22); p.closePath(); });
      tube(c, P(function (p) { p.ellipse(0, -36, 9, 7, 0, 0, TAU); }), lw(4.5), '#FF6B57');
      D.shape(c, body, D.tone(c, COLS[3], -30, 28), { lw: lw(5), depth: 7, shine: [-14, -14, 6, 10, 0.3, 0.55], inside: function (c) {
        c.fillStyle = '#E0A21C'; c.fillRect(-40, 12, 80, 6);
        c.strokeStyle = INK; c.lineWidth = lw(3); c.beginPath(); c.moveTo(-12, -2); c.lineTo(12, -2); c.stroke();
      } });
    },
    function milk(c) {
      var body = P(function (p) { p.moveTo(-10, -30); p.lineTo(10, -30); p.lineTo(10, -20); p.bezierCurveTo(10, -12, 25, -9, 25, 6); p.lineTo(25, 30); p.quadraticCurveTo(25, 38, 17, 38); p.lineTo(-17, 38); p.quadraticCurveTo(-25, 38, -25, 30); p.lineTo(-25, 6); p.bezierCurveTo(-25, -9, -10, -12, -10, -20); p.closePath(); });
      D.shape(c, body, D.tone(c, '#FFFFFF', -30, 38), { lw: lw(5), depth: 6, shine: [-15, 4, 4, 10, 0, 0.9], inside: function (c) {
        c.fillStyle = '#7CC4FF'; c.fillRect(-30, 10, 60, 18);
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(7, 20, 4, 24); c.arc(0, 23, 4.2, 0.2, Math.PI - 0.2); c.quadraticCurveTo(-7, 20, 0, 12); c.fill();
        c.fillStyle = 'rgba(42,35,64,.1)'; c.fillRect(-30, -30, 60, 6);
      } });
      D.shape(c, D.rrPath(-13, -41, 26, 13, 5), '#5DB6F5', { lw: lw(4), depth: 3 });
    },
    function mouse(c) {
      tube(c, P(function (p) { p.moveTo(24, 12); p.bezierCurveTo(40, 14, 44, -4, 36, -12); }), lw(4), '#FF9EC4');
      D.shape(c, D.ellPath(-2, -20, 12, 12), COLS[5], { lw: lw(4), depth: 0, inside: function (c) { c.fillStyle = '#FFB3C7'; c.beginPath(); c.arc(-2, -19, 6.5, 0, TAU); c.fill(); } });
      var body = P(function (p) { p.moveTo(-38, 10); p.bezierCurveTo(-32, -14, -6, -22, 14, -16); p.bezierCurveTo(32, -10, 36, 14, 26, 22); p.bezierCurveTo(16, 30, -12, 28, -38, 10); p.closePath(); });
      D.shape(c, body, D.tone(c, COLS[5], -20, 28), { lw: lw(5), depth: 7, shine: [-8, -10, 10, 4, -0.2, 0.45], inside: function (c) {
        c.setLineDash([lw(4), lw(5)]); c.strokeStyle = '#3E9E57'; c.lineWidth = lw(2.6); c.beginPath(); c.moveTo(-26, 16); c.quadraticCurveTo(0, 30, 26, 14); c.stroke(); c.setLineDash([]);
        c.fillStyle = INK; c.beginPath(); c.arc(-20, 0, 3.6, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-19, -1.2, 1.2, 0, TAU); c.fill();
      } });
      D.shape(c, D.ellPath(-38, 9, 5, 5), '#FF7FA6', { lw: lw(3), depth: 0 });
    }
  ];
  function rainbow(c) {
    tube(c, P(function (p) { p.moveTo(18, 24); p.quadraticCurveTo(30, 44, 42, 34); }), lw(4.5), '#FF6B57');
    D.shape(c, D.ellPath(-2, -2, 34, 34), '#fff', { lw: lw(5), depth: 7, shine: [-14, -18, 9, 5, -0.6, 0.6], inside: function (c) {
      ['#FF6B57', '#FF9A2E', '#FFD23F', '#7BD389', '#5DB6F5', '#A77BFF'].forEach(function (col, i) { c.strokeStyle = col; c.lineWidth = 11; c.beginPath(); c.moveTo(-40, i * 12 - 34); c.quadraticCurveTo(-2, i * 12 - 12, 36, i * 12 - 38); c.stroke(); });
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = lw(2.5); c.beginPath(); c.moveTo(-10, -36); c.quadraticCurveTo(14, -4, -6, 32); c.stroke();
    } });
  }
  /* specials: zoomies sit on a bright racing stripe with arrows at both ends (the way they'll run);
     catnip sprouts leaves all round. The piece shrinks a little so its kind still shows clearly. */
  function stripe(c, vertical) {
    c.save(); if (vertical) c.rotate(Math.PI / 2);
    D.shape(c, D.rrPath(-49, -18, 98, 36, 18), '#FFF1A8', { lw: lw(3.5), depth: 0, inside: function (c) {
      c.strokeStyle = '#FFD23F'; c.lineWidth = lw(3); c.beginPath(); c.moveTo(-40, -8); c.lineTo(-26, -8); c.moveTo(-42, 8); c.lineTo(-30, 8); c.moveTo(26, -8); c.lineTo(40, -8); c.moveTo(30, 8); c.lineTo(42, 8); c.stroke();
    } });
    [-1, 1].forEach(function (s) {
      D.shape(c, P(function (p) { p.moveTo(s * 33, -16); p.lineTo(s * 50, 0); p.lineTo(s * 33, 16); p.closePath(); }), '#FF8A5B', { lw: lw(3.5), depth: 0 });
    });
    c.restore();
  }
  function leaves(c) {
    for (var i = 0; i < 6; i++) {
      c.save(); c.rotate(i * Math.PI / 3 + Math.PI / 6);
      D.shape(c, P(function (p) { p.moveTo(0, -20); p.quadraticCurveTo(17, -36, 0, -51); p.quadraticCurveTo(-17, -36, 0, -20); p.closePath(); }), i % 2 ? '#5CCB75' : '#7BD389', { lw: lw(3.2), depth: 0, inside: function (c) { c.strokeStyle = '#3E9E57'; c.lineWidth = lw(2.2); c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -46); c.stroke(); } });
      c.restore();
    }
  }
  function small(c, k, f) { c.save(); c.scale(f, f); PIECES[k](c); c.restore(); }
  function drawPiece(c, k, sp) {
    if (sp === 'rain') { rainbow(c); return; }
    if (sp === 'zh' || sp === 'zv') { stripe(c, sp === 'zv'); small(c, k, 0.74); return; }
    if (sp === 'nip') { leaves(c); small(c, k, 0.72); return; }
    PIECES[k](c);
  }
  /* a cardboard box; a kitten's ears poke out of the lid and its eyes peek from a hole; taped boxes are crossed with tape */
  function drawBox(c, hp, kit, part) {
    if (kit >= 0) {
      var o = GGCat.PRESETS[KITTENS[kit]];
      [-1, 1].forEach(function (s) {
        c.save(); c.translate(0, -18); c.scale(0.58, 0.58);
        D.shape(c, new Path2D(GGCat.earPath(s)), o.color, { lw: lw(5) / 0.58, depth: 0, inside: function (c) { c.fillStyle = o.inner; c.fill(new Path2D(GGCat.earInner(s))); } });
        c.restore();
      });
    }
    var body = D.rrPath(-45, -33, 90, 79, 8);
    D.shape(c, body, D.tone(c, BOX, -33, 46), { lw: lw(5), depth: 8, shine: [-26, -22, 12, 4, 0, 0.35], inside: function (c) {
      c.fillStyle = '#F3C88E'; c.fillRect(-45, -33, 90, 14);
      c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = lw(3); c.beginPath(); c.moveTo(-45, -19); c.lineTo(45, -19); c.moveTo(0, -33); c.lineTo(0, -19); c.stroke();
      if (kit >= 0) {
        c.fillStyle = '#5A3A22'; c.beginPath(); c.arc(0, 10, 13, 0, TAU); c.fill();
        var eye = GGCat.PRESETS[KITTENS[kit]].eyes === 'green' ? '#9BFF6E' : '#FFFFFF';
        c.fillStyle = eye; c.beginPath(); c.arc(-5, 9, 3, 0, TAU); c.arc(5, 9, 3, 0, TAU); c.fill();
      } else {
        // a box with a rescue part inside has a torn hole, and the part pokes out of it, so you can see which boxes
        // to break into; a plain box has a paw print
        if (part) {
          var hole = new Path2D('M-24 -4L-16 -12L-8 -6L0 -14L9 -7L18 -13L25 -3L22 10L27 22L16 33L4 28L-8 35L-19 28L-27 16L-22 6Z');
          c.fillStyle = '#5A3A22'; c.fill(hole); c.strokeStyle = 'rgba(42,35,64,.6)'; c.lineWidth = lw(2.5); c.stroke(hole);
        }
        else {
          c.fillStyle = 'rgba(156,106,58,.45)';
          c.beginPath(); c.ellipse(0, 16, 9, 7, 0, 0, TAU); c.fill();
          [[-10, 3], [-3.5, -1], [3.5, -1], [10, 3]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 3.4, 4, 0, 0, TAU); c.fill(); });
        }
      }
      if (hp > 1) {
        c.fillStyle = '#C98B5B'; c.fillRect(-45, -6, 90, 15); c.fillRect(-26, -33, 15, 79);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-45, -6, 90, 3); c.fillRect(-26, -33, 3, 79);
        c.strokeStyle = 'rgba(42,35,64,.25)'; c.lineWidth = lw(2); c.strokeRect(-45, -6, 90, 15); c.strokeRect(-26, -33, 15, 79);
      }
    } });
    if (part) { c.save(); c.translate(2, 6); c.rotate(-0.5); c.scale(0.68, 0.68); drawPart(c, partKind()); c.restore(); }
  }
  var YARN = '#F2545B';
  function drawTangle(c) {
    [function (p) { p.moveTo(-46, -18); p.bezierCurveTo(-10, -48, 18, 8, 46, -16); },
     function (p) { p.moveTo(-46, 20); p.bezierCurveTo(-12, -12, 14, 44, 46, 14); },
     function (p) { p.moveTo(-20, -46); p.bezierCurveTo(-36, 0, 30, 8, 14, 46); }].forEach(function (f) { tube(c, P(f), lw(5), YARN); });
    D.shape(c, D.ellPath(22, -24, 8, 8), YARN, { lw: lw(3.5), depth: 2, inside: function (c) { c.strokeStyle = '#B83A40'; c.lineWidth = lw(2); c.beginPath(); c.arc(22, -24, 4, 0.5, 4); c.stroke(); } });
  }
  function drawCushion(c, kit) {
    D.shape(c, D.ellPath(0, 32, 46, 15), D.tone(c, '#FF8FAB', 17, 47), { lw: lw(5), depth: 5, inside: function (c) { c.fillStyle = '#E8558E'; c.beginPath(); c.arc(0, 34, 3.5, 0, TAU); c.fill(); } });
    SC.catAt(c, 0, 28, { preset: KITTENS[kit], pose: 'sit', size: 41, face: 'open' });
  }

  /* sprites, so the board stays smooth on older tablets */
  var sprites = {}, spritePx = 0;
  function sprite(key, fn) {
    if (sprites[key]) return sprites[key];
    var cv = document.createElement('canvas'), s = Math.ceil(spritePx * 1.12);
    cv.width = cv.height = s;
    var c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(s / 2, s / 2); c.scale(spritePx / 100, spritePx / 100);
    fn(c);
    return (sprites[key] = cv);
  }
  function buildSprites(px, T) {
    px = Math.max(24, Math.round(px));
    if (px === spritePx) return;
    spritePx = px; sprites = {};
    LWK = clamp(T * 0.072, 2.4, 4.6) * 100 / T / 5; // a 5 in the drawings is about 3.2–4.6px on screen
  }
  function blit(c, cv, x, y, size, rot, sx, sy) {
    var w = size * 1.12;
    if (rot || sx !== undefined) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(sx || 1, sy || sx || 1); c.drawImage(cv, -w / 2, -w / 2, w, w); c.restore(); }
    else c.drawImage(cv, x - w / 2, y - w / 2, w, w);
  }
  function pieceSprite(v) {
    if (v.sp === 'res') return partSprite();
    return sprite('p' + v.k + (v.sp || '') + (v.sp === 'cush' ? v.kit : ''), function (c) { if (v.sp === 'cush') drawCushion(c, v.kit); else drawPiece(c, v.k, v.sp); });
  }
  /* a rescue part, from the shared kit (shared/things.js GGThings.part) */
  function drawPart(c, kind) { GGThings.part(c, 0, 0, { kind: kind, size: 1.22, ls: 1 / LWK }); }
  function partKind() { return (level && level.job && level.job.part) || 'rung'; }
  function partSprite() { var k = partKind(); return sprite('part' + k, function (c) { drawPart(c, k); }); }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), dpr = 1, W = 0, H = 0;
  var T = 40, BX = 0, BY = 0, SX = 0, SY = 0, SW = 300, SH = 180, side = false;
  var R = 8, C = 8;
  var SV = 100;   // how much of the scene's height shows (on a short screen the sky is cut off its top)
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5); W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var top = $('topbar').getBoundingClientRect().bottom + 4, bottom = H - Math.max(10, safeBottom());
    var hudH = Math.max(56, $('hud').getBoundingClientRect().height || 0);
    side = false;
    // one picture, top to bottom: the scene, then the board; the goals and moves below. The board is as wide as the
    // screen allows; if it's tall, the scene loses some sky (down to about four fifths of its height).
    T = Math.floor(Math.min((W - 12) / C, 78));
    var fit = function () { SW = T * C; SH = SW * 0.6; var room = bottom - top - (R * T + 8 + hudH); SV = Math.min(SH, room); return SV >= SW * 0.47; };
    while (T > 16 && !fit()) T--;
    var bw = T * C, used = SV + R * T + 8 + hudH, y0 = top + Math.max(0, (bottom - top - used) / 2);
    SX = Math.round((W - bw) / 2); SY = Math.round(y0 - (SH - SV));   // SY is the top of the whole scene (some may be cut)
    BX = SX; BY = Math.round(y0 + SV);
    placeHud(BX, BY + R * T + 8, bw);
    buildSprites(T * dpr, T);
    placeSay(); placeCards();
  }
  function safeBottom() { var d = document.createElement('div'); d.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px)'; document.body.appendChild(d); var h = d.getBoundingClientRect().height; d.remove(); return h; }
  function placeHud(x, y, w) { var h = $('hud'); h.style.left = x + 'px'; h.style.top = y + 'px'; h.style.width = w + 'px'; }
  /* the win and not-in-time cards sit over the board, so the scene above stays in view */
  function placeCards() {
    ['win', 'fail'].forEach(function (id) {
      var w = $(id);
      if (side) { w.style.paddingTop = BY + 'px'; w.style.paddingLeft = BX + 'px'; w.style.paddingRight = Math.max(16, W - BX - C * T) + 'px'; w.style.paddingBottom = Math.max(16, H - BY - R * T) + 'px'; }
      else { w.style.paddingTop = Math.round(BY) + 'px'; w.style.paddingLeft = w.style.paddingRight = ''; w.style.paddingBottom = ''; }
    });
  }
  function placeSay() { var s = $('say'); s.style.left = (SX + SW / 2) + 'px'; s.style.top = (BY + 10) + 'px'; s.style.maxWidth = Math.min(SW - 20, 440) + 'px'; }
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe($('topbar'));

  function cx(c) { return BX + (c + 0.5) * T; }
  function cy(r) { return BY + (r + 0.5) * T; }

  /* ================= a little timing system, run by the frame loop ================= */
  var tasks = [];
  function wait(s) { return new Promise(function (res) { tasks.push({ t: 0, dur: s, res: res }); }); }
  function tween(s, fn) { return new Promise(function (res) { tasks.push({ t: 0, dur: s, fn: fn, res: res }); }); }
  function until(test) { return new Promise(function (res) { tasks.push({ test: test, res: res }); }); }
  function later(s, fn) { if (s <= 0) { fn(); return; } tasks.push({ t: 0, dur: s, res: fn }); }
  function runTasks(dt) {
    var list = tasks; tasks = [];
    var keep = [];
    for (var i = 0; i < list.length; i++) {
      var k = list[i];
      if (k.test) { if (k.test()) k.res(); else keep.push(k); continue; }
      k.t += dt; var p = Math.min(1, k.t / k.dur);
      if (k.fn) k.fn(p);
      if (p >= 1) k.res(); else keep.push(k);
    }
    tasks = keep.concat(tasks);
  }

  /* ================= state ================= */
  var st = null, level = null, lvN = 1;
  var V = {}, boxes = {};                 // what's on screen: pieces by id, boxes by cell
  var parts = [], fx = [], actors = [];   // particles, specials' effects, kittens running to safety
  var flyers = [];                        // rescue parts flying up from the board to the rescue
  var scn = { mode: 'play', mt: 0, t: 0, saved: [], reserved: 0, built: 0, added: -9 };
  var shown = { job: 0, kittens: 0, boxes: 0, yarn: 0, down: 0 };
  var pDisp = 0, busy = false, phase = 'list', sel = null, cursor = null, idle = 0, hint = null, hintT = 0, plusUsed = false;
  var PG = (function () { var p = {}; try { p = GG.getProgress('rescue') || {}; } catch (e) {} if (!Array.isArray(p.done)) p.done = []; p.done = p.done.filter(function (n) { return n >= 1 && n <= LEVELS.length; }); return p; })();
  function save() { try { GG.setProgress('rescue', PG); } catch (e) {} }
  function maxDone() { return PG.done.length ? Math.max.apply(null, PG.done) : 0; }
  function nextLevel() { for (var i = 1; i <= LEVELS.length; i++) if (PG.done.indexOf(i) < 0) return Math.min(i, maxDone() + 1); return LEVELS.length; }
  function unlocked(n) { return n <= maxDone() + 1; }

  function newV(id, k, sp, r, c) { return { id: id, k: k, sp: sp, tg: false, kit: 0, x: c, y: r, path: null, pt: 0, pop: null, land: 1, made: 1, rot: 0 }; }
  function syncView() {
    var seen = {};
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var p = st.g[r][c];
      if (p) {
        var v = V[p.id] || (V[p.id] = newV(p.id, p.k, p.sp, r, c));
        v.k = p.k; v.sp = p.sp; v.tg = p.tg; v.kit = p.kit; v.pop = null;
        if (!v.path) { v.x = c; v.y = r; }
        seen[p.id] = 1;
      }
      var b = st.box[r][c], key = r * 64 + c;
      if (b) { var vb = boxes[key]; if (!vb || vb.id !== b.id) boxes[key] = { id: b.id, hp: b.hp, kit: b.kit, part: b.part, shake: 0 }; else vb.hp = b.hp; }
      else delete boxes[key];
    }
    for (var id in V) if (!seen[id] && !V[id].pop) delete V[id];
  }

  /* ================= starting a rescue ================= */
  function goalText(g) {
    var parts = [];
    if (g.boxes) parts.push('break ' + g.boxes + ' boxes');
    if (g.yarn) parts.push('untangle ' + g.yarn + ' yarn' + (g.yarn > 1 ? 's' : ''));
    if (g.kittens) parts.push(g.kittens === 1 ? 'free the kitten' : 'free ' + g.kittens + ' kittens');
    if (g.down) parts.push(g.down === 1 ? 'bring the cushion kitten down' : 'bring ' + g.down + ' cushion kittens down');
    if (!parts.length) return '';
    var s = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  var BEFORE = { bath: 'before the bath fills up', tree: 'before the branch bends down', rain: 'before the rain cloud arrives', tide: 'before the tide comes in', laundry: 'before the washing topples' };
  /* each rescue job, in words: % is the cat's name, # how many parts */
  var JOBS = {
    tree: { part: 'ladder rung', parts: 'ladder rungs', goal: 'Break open the boxes to find the ladder rungs!', where: 'up the tree',
            tip: 'Make matches next to the boxes to break them. Boxes with a rung peeking out of a hole hold the ladder: find all # rungs and % can climb down!',
            done: '% climbed down the ladder, safe and cosy' }
  };
  function job() { return level && level.job ? JOBS[level.job.scene] : null; }
  function fill(t) { return t.replace(/%/g, level.cat.name).replace(/#/g, st.goal.job); }
  function start(n, quiet) {
    lvN = clamp(n | 0, 1, LEVELS.length); level = LEVELS[lvN - 1];
    st = E.make(level, Math.floor(Math.random() * 2147483647));
    R = st.R; C = st.C;
    V = {}; boxes = {}; parts = []; fx = []; actors = []; tasks = []; flyers = [];
    scn = { mode: 'play', mt: 0, t: scn.t || 0, saved: [], reserved: 0, built: 0, added: -9 };
    shown = { job: 0, kittens: 0, boxes: 0, yarn: 0, down: 0 };
    pDisp = 0; busy = false; sel = null; hint = null; idle = 0; plusUsed = false; phase = 'play';
    syncView();
    // the board arrives with a little drop
    for (var id in V) { var v = V[id]; v.path = [[0, v.y - R - 1 + (reduceMotion ? R : 0), v.x], [R + 1 - v.y * 0.3, v.y, v.x]]; v.pt = -v.x * 0.02; }
    PG.last = lvN; save();
    $('levelLabel').textContent = 'Rescue ' + lvN;
    $('win').hidden = true; $('fail').hidden = true; $('hud').hidden = false;
    renderHud(true);
    var j = job();
    if (j) { var more = goalText(level.goal); say(fill(j.goal), fill(j.tip) + (more ? ' And: ' + more.charAt(0).toLowerCase() + more.slice(1) + '.' : '') + (level.tip ? ' ' + level.tip : ''), 7); }
    else say(goalText(level.goal) + ' ' + BEFORE[level.peril] + '!', level.tip, 4.5);
    if (!quiet && window.GG && GG.track) GG.track('Start level', { game: 'rescue', level: lvN });
    layout();
  }

  /* ================= the bar: goal and moves ================= */
  var icons = {};
  function icon(key, fn) {
    if (icons[key]) return icons[key];
    var cv = document.createElement('canvas'); cv.width = cv.height = 72;
    var c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; c.translate(36, 36); c.scale(0.62, 0.62);
    var keep = LWK; LWK = 1.1; fn(c); LWK = keep;
    return (icons[key] = cv.toDataURL());
  }
  var GOAL_ICONS = {
    job: function (c) { c.scale(1.15, 1.15); drawPart(c, partKind()); },
    kittens: function (c) { c.translate(0, 8); GGCat.draw(c, { preset: 'ginger', size: 92, face: 'happy' }); },
    boxes: function (c) { drawBox(c, 1, -1); },
    yarn: function (c) { c.scale(0.9, 0.9); PIECES[3](c); drawTangle(c); },
    down: function (c) { drawCushion(c, 1); }
  };
  var GOAL_WORDS = { kittens: 'kittens freed', boxes: 'boxes broken', yarn: 'yarns untangled', down: 'cushion kittens brought down' };
  var goalEls = {};
  function renderHud(rebuild) {
    var box = $('goals');
    if (rebuild) {
      box.innerHTML = ''; goalEls = {};
      ['job', 'kittens', 'boxes', 'yarn', 'down'].forEach(function (k) {
        if (!st.goal[k]) return;
        var d = document.createElement('div'); d.className = 'goal';
        d.innerHTML = '<img alt="" src="' + icon(k === 'job' ? 'job' + partKind() : k, GOAL_ICONS[k]) + '"><b></b><small></small>';
        box.appendChild(d); goalEls[k] = d;
      });
    }
    Object.keys(goalEls).forEach(function (k) {
      var d = goalEls[k], got = Math.min(shown[k], st.goal[k]);
      d.querySelector('b').textContent = got; d.querySelector('small').textContent = '/' + st.goal[k];
      d.classList.toggle('done', got >= st.goal[k]);
      d.setAttribute('aria-label', got + ' of ' + st.goal[k] + ' ' + (k === 'job' ? (job() ? job().parts : 'parts') + ' sent up' : GOAL_WORDS[k]));
    });
    var left = Math.max(0, E.movesLeft(st));
    $('movesN').textContent = left; $('movesL').textContent = left === 1 ? 'move left' : 'moves left';
    $('moves').classList.toggle('low', left <= 3 && phase === 'play');
  }
  function bumpGoal(k) { var d = goalEls[k]; if (!d || reduceMotion) return; d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); }
  function count(k) { shown[k]++; renderHud(false); bumpGoal(k); }

  var sayTimer = 0;
  function say(text, small, secs) {
    var s = $('say');
    s.innerHTML = ''; s.appendChild(document.createTextNode(text));
    if (small) { var m = document.createElement('small'); m.textContent = small; s.appendChild(m); }
    s.classList.remove('hide'); sayTimer = secs || 2.5;
  }

  /* ================= effects ================= */
  function burst(x, y, col, n, shape, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 220) * (spd || 1) * (T / 60);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80 * (T / 60), life: 0, max: rand(0.4, 0.8), r: rand(2.5, 5.5) * (T / 60), col: col, shape: shape || (Math.random() < 0.4 ? 'star' : 'dot'), rot: rand(0, TAU), vr: rand(-8, 8), g: 520 });
    }
  }
  function drawParts(c, dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i]; q.life += dt;
      if (q.life >= q.max) { parts.splice(i, 1); continue; }
      q.vy += q.g * dt; q.vx *= 0.98; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      var a = 1 - q.life / q.max;
      c.save(); c.globalAlpha = Math.min(1, a * 1.8); c.translate(q.x, q.y); c.rotate(q.rot);
      if (q.shape === 'card') { D.shape(c, D.rrPath(-q.r * 1.6, -q.r, q.r * 3.2, q.r * 2, 2), BOX, { lw: 2, depth: 0 }); }
      else if (q.shape === 'tape') { D.shape(c, D.rrPath(-q.r * 3, -q.r * 0.8, q.r * 6, q.r * 1.6, 2), '#C98B5B', { lw: 2, depth: 0 }); }
      else if (q.shape === 'leaf') { D.shape(c, D.ellPath(0, 0, q.r * 1.6, q.r * 0.8), q.col, { lw: 1.8, depth: 0 }); }
      else if (q.shape === 'yarn') { c.beginPath(); c.moveTo(-q.r * 2, 0); c.quadraticCurveTo(0, -q.r * 2, q.r * 2, 0); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = YARN; c.lineWidth = 2.6; c.stroke(); }
      else if (q.shape === 'puff') { c.fillStyle = 'rgba(255,248,236,.9)'; c.beginPath(); c.arc(0, 0, q.r * (1 + q.life * 3), 0, TAU); c.fill(); }
      else if (q.shape === 'heart') { SC.heart(c, 0, 0, q.r, '#FF7EA8', 1); }
      else if (q.shape === 'star') { c.beginPath(); for (var k = 0; k < 10; k++) { var an = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? q.r * 0.6 : q.r * 1.4; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fillStyle = q.col; c.fill(); }
      else { c.beginPath(); c.arc(0, 0, q.r, 0, TAU); c.fillStyle = q.col; c.fill(); }
      c.restore();
    }
  }
  function startFx(f) {
    var o = { f: f, age: 0 };
    if (f.t === 'beam') { Sound.zoom(); buzz(12); }
    else if (f.t === 'poof') { Sound.poof(); buzz(18); burst(cx(f.c), cy(f.r), '#7BD389', 14, 'leaf', 1.4); }
    else if (f.t === 'rain' || f.t === 'bigrain') { Sound.shimmer(); buzz([10, 30, 10]); }
    fx.push(o);
  }
  function drawFx(c, dt) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var o = fx[i], f = o.f; o.age += dt;
      if (f.t === 'beam') {
        // two zoomies cats dash out along the line, leaving a soft streak
        var run = o.age / 0.035, done = 0;
        c.save();
        [-1, 1].forEach(function (s) {
          var len = f.dir === 'h' ? (s < 0 ? f.c + 1 : C - f.c) : (s < 0 ? f.r + 1 : R - f.r);
          var d = Math.min(run, len + 1), fade = clamp(1 - (o.age - (len + 1) * 0.035) / 0.3, 0, 1);
          if (fade <= 0) { done++; return; }
          var x0 = cx(f.c), y0 = cy(f.r), x1 = f.dir === 'h' ? x0 + s * d * T : x0, y1 = f.dir === 'v' ? y0 + s * d * T : y0;
          c.globalAlpha = 0.55 * fade; c.strokeStyle = '#FFF6C9'; c.lineCap = 'round'; c.lineWidth = T * 0.5;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
          c.globalAlpha = fade;
          if (run < len + 1) {
            c.save(); c.translate(x1, y1);
            if (f.dir === 'v') c.rotate(s > 0 ? Math.PI / 2 : -Math.PI / 2);
            GGCat.draw(c, { preset: f.k >= 0 ? KITTENS[f.k] : 'ginger', pose: 'walk', moving: true, step: o.age * 40, wag: o.age * 20, dir: f.dir === 'v' ? 1 : s, size: T * 0.42, face: 'happy' });
            c.restore();
          }
        });
        c.restore();
        if (done === 2) fx.splice(i, 1);
      } else if (f.t === 'poof') {
        var u = o.age / 0.4, rad = T * (f.s === 2 ? 2.6 : 1.6) * eout(u);
        c.save(); c.globalAlpha = clamp(1 - u, 0, 1) * 0.6; c.fillStyle = '#C9F2C9'; c.beginPath(); c.arc(cx(f.c), cy(f.r), rad, 0, TAU); c.fill();
        c.globalAlpha = clamp(1 - u, 0, 1); c.strokeStyle = '#5CCB75'; c.lineWidth = 4; c.stroke(); c.restore();
        if (u >= 1) fx.splice(i, 1);
      } else if (f.t === 'rain') {
        var all = f.cells || [], life = 0.7 + all.length * 0.025;
        c.save(); c.lineCap = 'round';
        all.forEach(function (q, j) {
          var a0 = 0.2 + j * 0.025, u2 = clamp((o.age - a0 + 0.2) / 0.2, 0, 1);
          if (u2 <= 0) return;
          var x0 = cx(f.c), y0 = cy(f.r), x1 = cx(q[1]), y1 = cy(q[0]);
          c.globalAlpha = clamp(1.4 - (o.age - a0) * 2, 0, 1);
          c.strokeStyle = ['#FF6B57', '#FFD23F', '#7BD389', '#5DB6F5', '#A77BFF'][j % 5]; c.lineWidth = 4;
          c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - T, lerp(x0, x1, u2), lerp(y0, y1, u2)); c.stroke();
        });
        c.restore();
        if (o.age > life) fx.splice(i, 1);
      } else if (f.t === 'bigrain') {
        c.save(); c.globalAlpha = clamp(0.6 - o.age, 0, 1); c.fillStyle = '#FFFFFF'; c.fillRect(BX, BY, C * T, R * T); c.restore();
        if (o.age > 0.7) fx.splice(i, 1);
      } else fx.splice(i, 1);
    }
  }

  /* boxes: a hit shakes a box (a taped one loses its tape); a broken one bursts into bits, and its kitten pops out */
  function boxHit(b) {
    var key = b.r * 64 + b.c, vb = boxes[key], x = cx(b.c), y = cy(b.r);
    if (!b.broke) {
      if (vb) { vb.hp = b.hp; vb.shake = 0.35; }
      Sound.thud(); Sound.rip(); buzz(8);
      parts.push({ x: x, y: y, vx: rand(-60, 60), vy: -260 * (T / 60), life: 0, max: 0.8, r: T * 0.08, col: '#C98B5B', shape: 'tape', rot: 0.3, vr: rand(-10, 10), g: 700 });
      burst(x, y, '#F3C88E', 4, 'dot', 0.6);
      return;
    }
    delete boxes[key];
    Sound.crunch(); buzz(14);
    for (var i = 0; i < (reduceMotion ? 3 : 7); i++) parts.push({ x: x + rand(-T * 0.3, T * 0.3), y: y + rand(-T * 0.3, T * 0.3), vx: rand(-180, 180) * (T / 60), vy: rand(-320, -120) * (T / 60), life: 0, max: rand(0.6, 0.9), r: T * rand(0.06, 0.1), shape: 'card', rot: rand(0, TAU), vr: rand(-10, 10), g: 900 });
    for (var j = 0; j < 4; j++) parts.push({ x: x + rand(-T * 0.3, T * 0.3), y: y + rand(-T * 0.2, T * 0.3), vx: rand(-30, 30), vy: rand(-40, -10), life: 0, max: 0.5, r: T * 0.1, shape: 'puff', rot: 0, vr: 0, g: 0 });
    if (b.kit >= 0) freeKitten(KITTENS[b.kit], b.r, b.c, 'kittens');
    if (b.part) sendPart({ id: -1, r: b.r, c: b.c, n: b.n });
  }
  function freeKitten(preset, r, c, goal) {
    actors.push({ preset: preset, r: r, c: c, t: 0, slot: scn.reserved++, goal: goal });
    Sound.mew(0.08); buzz([20, 40, 20]);
    burst(cx(c), cy(r), '#FF9EC4', 6, 'heart', 0.7);
  }
  var POP = 0.5, BOUNCE = 0.45, RUN = 1.15;
  function drawActors(c, dt) {
    for (var i = actors.length - 1; i >= 0; i--) {
      var a = actors[i]; a.t += dt;
      var x0 = cx(a.c), y0 = cy(a.r) + T * 0.38, t = a.t, size = T * 0.56;
      var tgt = SC.slotAt(a.slot, SX, SY, SW);
      if (t < POP) {
        var u = t / POP, s = reduceMotion ? 1 : back(u);
        SC.catAt(c, x0, y0 - T * 0.15 * eout(u), { preset: a.preset, pose: 'sit', size: size * Math.max(0.2, s), face: 'happy' });
      } else if (t < POP + BOUNCE) {
        var h = reduceMotion ? 0 : Math.abs(Math.sin((t - POP) / BOUNCE * Math.PI * 2)) * T * 0.25;
        SC.catAt(c, x0, y0 - T * 0.15 - h, { preset: a.preset, pose: 'sit', size: size, face: 'happy' });
      } else if (t < POP + BOUNCE + RUN) {
        var q = ease((t - POP - BOUNCE) / RUN), x = lerp(x0, tgt.x, q), y = lerp(y0 - T * 0.15, tgt.y, q);
        y -= reduceMotion ? 0 : Math.abs(Math.sin(q * Math.PI * 3)) * T * 0.55;
        var sz = lerp(size, SC.KSIZE * tgt.k, q);
        SC.catAt(c, x, y, { preset: a.preset, pose: 'walk', moving: true, step: t * 22, wag: t * 8, dir: tgt.x >= x0 ? 1 : -1, size: sz * 0.85, face: 'happy' });
      } else {
        actors.splice(i, 1);
        scn.saved[a.slot] = a.preset;
        for (var k = 0; k < scn.saved.length; k++) if (!scn.saved[k]) scn.saved[k] = null;
        Sound.mrrp(); count(a.goal);
        burst(tgt.x, tgt.y - 14 * tgt.k, '#FF9EC4', 4, 'heart', 0.5);
      }
    }
  }

  /* ================= playing out a move ================= */
  var TK = 0.052; // seconds per cell of fall
  async function playLog(log) {
    for (var i = 0; i < log.length; i++) {
      var ev = log[i];
      if (ev.type === 'nope') {
        var a = pieceAt(ev.a), b = pieceAt(ev.b);
        Sound.nope();
        if (a && b) {
          var ax = a.x, ay = a.y, bx = b.x, by = b.y;
          await tween(0.24, function (p) { var k = Math.sin(p * Math.PI) * 0.35; a.x = lerp(ax, bx, k); a.y = lerp(ay, by, k); b.x = lerp(bx, ax, k); b.y = lerp(by, ay, k); });
          a.x = ax; a.y = ay; b.x = bx; b.y = by;
        }
      } else if (ev.type === 'swap') {
        var va = V[ev.ida], vb = V[ev.idb];
        Sound.swap(); buzz(6);
        renderHud(false);
        await tween(reduceMotion ? 0.08 : 0.17, function (p) { var k = ease(p); va.x = lerp(ev.a[1], ev.b[1], k); va.y = lerp(ev.a[0], ev.b[0], k); vb.x = lerp(ev.b[1], ev.a[1], k); vb.y = lerp(ev.b[0], ev.a[0], k); });
      } else if (ev.type === 'pass') await playPass(ev);
      else if (ev.type === 'fall') await playFall(ev);
      else if (ev.type === 'down') {
        ev.list.forEach(function (d) { delete V[d.id]; burst(cx(d.c), cy(d.r), '#FF8FAB', 8, 'star', 0.8); freeKitten(KITTENS[d.kit], d.r, d.c, 'down'); });
        Sound.chime();
        await wait(0.25);
      } else if (ev.type === 'shuffle') {
        say('No swaps left, so the pieces mix themselves up', null, 2);
        var from = {};
        ev.list.forEach(function (q) { var v = V[q.id]; if (v) { from[q.id] = [v.x, v.y]; v.k = q.k; v.sp = q.sp; } });
        await tween(reduceMotion ? 0.1 : 0.6, function (p) { var k = ease(p); ev.list.forEach(function (q) { var v = V[q.id], f = from[q.id]; if (!v || !f) return; v.x = lerp(f[0], q.c, k); v.y = lerp(f[1], q.r, k) - Math.sin(p * Math.PI) * 0.4; }); });
      }
    }
    syncView();
  }
  function pieceAt(rc) { for (var id in V) { var v = V[id]; if (!v.pop && Math.round(v.x) === rc[1] && Math.round(v.y) === rc[0]) return v; } return null; }
  async function playPass(ev) {
    var maxD = 0, slots = {};
    ev.convert.forEach(function (cv) { maxD = Math.max(maxD, cv.d); later(cv.d, function () { var v = V[cv.id]; if (v) { v.sp = cv.sp; v.made = 0; burst(cx(v.x), cy(v.y), '#FFE680', 5, 'star', 0.6); } }); });
    ev.fx.forEach(function (f) { maxD = Math.max(maxD, f.d); later(f.d, function () { startFx(f); }); });
    ev.removed.forEach(function (rm) {
      var v = V[rm.id]; if (!v) return;
      v.x = rm.c; v.y = rm.r; v.pop = -rm.d; v.merge = rm.merge || null;
      maxD = Math.max(maxD, rm.d);
      var slot = Math.round(rm.d * 14);
      if (!slots[slot]) { slots[slot] = 1; Sound.pop(Math.min(7, ev.chain + Math.floor(rm.d * 6)), rm.d); }
    });
    ev.boxes.forEach(function (b) { maxD = Math.max(maxD, b.d); later(b.d, function () { boxHit(b); if (b.broke) count('boxes'); }); });
    ev.untangled.forEach(function (u) {
      maxD = Math.max(maxD, u.d);
      later(u.d, function () {
        var v = V[u.id]; if (v) v.tg = false;
        Sound.pluck(); buzz(8); count('yarn');
        for (var i = 0; i < (reduceMotion ? 2 : 5); i++) parts.push({ x: cx(u.c), y: cy(u.r), vx: rand(-160, 160) * (T / 60), vy: rand(-260, -80) * (T / 60), life: 0, max: 0.7, r: T * 0.08, shape: 'yarn', rot: rand(0, TAU), vr: rand(-8, 8), g: 700 });
      });
    });
    ev.parts.forEach(function (q) { maxD = Math.max(maxD, q.d); later(q.d, function () { sendPart(q); }); });
    if (ev.removed.length >= 5 || ev.chain >= 2) Sound.purr(0.12);
    await wait(maxD + 0.27);
    ev.made.forEach(function (m) { var v = V[m.id]; if (v) { v.sp = m.sp; v.k = m.k; v.made = 0; burst(cx(m.c), cy(m.r), '#FFE680', 8, 'star', 0.8); } });
    if (ev.made.length) { Sound.made(); buzz(10); await wait(0.12); }
  }
  async function playFall(ev) {
    ev.spawned.forEach(function (s) { V[s.id] = newV(s.id, s.k, s.sp || null, -1, 0); });
    var moving = [];
    for (var id in ev.paths) { var v = V[id]; if (!v) continue; v.path = ev.paths[id]; v.pt = 0; moving.push(v); }
    await until(function () { for (var i = 0; i < moving.length; i++) if (moving[i].path) return false; return true; });
  }
  function stepPaths(dt) {
    for (var id in V) {
      var v = V[id];
      if (v.land < 1) v.land = Math.min(1, v.land + dt / 0.28);
      if (v.made < 1) v.made = Math.min(1, v.made + dt / 0.35);
      if (!v.path) continue;
      v.pt += dt;
      var tk = v.pt / TK, pth = v.path, last = pth[pth.length - 1];
      if (tk >= last[0]) { v.x = last[2]; v.y = last[1]; v.path = null; v.land = reduceMotion ? 1 : 0; Sound.land(); continue; }
      if (tk <= pth[0][0]) { v.x = pth[0][2]; v.y = pth[0][1]; continue; }
      for (var i = 0; i < pth.length - 1; i++) {
        var a = pth[i], b = pth[i + 1];
        if (tk >= a[0] && tk < b[0]) { var u = (tk - a[0]) / (b[0] - a[0]); v.x = lerp(a[2], b[2], u); v.y = lerp(a[1], b[1], u); break; }
      }
    }
  }

  async function doSwap(r1, c1, r2, c2) {
    if (busy || phase !== 'play' || !st) return false;
    Sound.init();
    busy = true; sel = null; hint = null; idle = 0; $('say').classList.add('hide');
    var log = E.swap(st, r1, c1, r2, c2);
    await playLog(log);
    busy = false;
    renderHud(false);
    if (log[0].type !== 'nope') await checkEnd();
    return log[0].type !== 'nope';
  }
  async function checkEnd() {
    var calm = function () { return !actors.length && !flyers.length; };
    if (E.won(st)) { phase = 'winning'; await until(calm); await wait(0.35); winSeq(); return; }
    if (E.movesLeft(st) <= 0) { phase = 'failing'; await until(calm); if (E.won(st)) { phase = 'winning'; winSeq(); } else failSeq(); }
  }

  /* ================= rescued, or not quite in time ================= */
  function winSeq() {
    phase = 'win'; scn.mode = 'win'; scn.mt = 0; sel = null; hint = null;
    if (PG.done.indexOf(lvN) < 0) PG.done.push(lvN);
    PG.last = lvN; save();
    if (window.GG && GG.track) GG.track('Finish level', { game: 'rescue', level: lvN });
    later(0.3, function () { Sound.mew(); });
    later(1.0, function () { Sound.chime(); buzz([20, 50, 30]); });
    later(1.25, function () { Sound.purr(); });
    later(1.6, function () { scn.saved.forEach(function (k, i) { if (k) Sound.mrrp(i * 0.12); }); });
    var j = job();
    if (j) { var tw = SC.winTime(level.peril, st.goal.job) - 1.1; later(0.55, function () { Sound.boing(); }); for (var i = 0; i < st.goal.job; i++) later(0.55 + i * 0.2, function () { Sound.land(); }); later(tw - 0.75, function () { Sound.boing(); }); }
    later(SC.winTime(level.peril, st.goal.job), function () {
      var n = scn.saved.filter(Boolean).length;
      $('winTitle').textContent = 'Rescued!';
      $('winNote').textContent = (j ? fill(j.done) : level.cat.name + ' is safe and cosy') + (n ? ', and so ' + (n === 1 ? 'is the kitten' : 'are the ' + n + ' kittens') + ' you freed.' : '.');
      var last = lvN >= LEVELS.length;
      $('nextLabel').textContent = last ? 'All rescues' : 'Next rescue';
      $('win').hidden = false; $('nextBtn').focus();
    });
  }
  var FAIL = {
    bath: ['Splish splash!', 'a bit soggy', function () { Sound.splash(); later(0.8, Sound.rustle); }],
    tree: ['Into the leaves!', 'a bit leafy', function () { later(0.75, Sound.flump); later(0.8, Sound.rustle); later(1.4, function () { Sound.boing(); }); }],
    rain: ['Pitter patter!', 'a bit drippy', function () { Sound.splash(); later(1.0, Sound.rustle); }],
    tide: ['Sploosh!', 'a bit wet and sandy', function () { later(0.4, Sound.splash); later(1.0, Sound.rustle); }],
    laundry: ['Flump!', 'wearing a sock', function () { later(0.6, Sound.flump); later(1.1, function () { Sound.boing(); }); }]
  };
  function failSeq() {
    phase = 'fail'; scn.mode = 'fail'; scn.mt = 0; sel = null; hint = null;
    var f = FAIL[level.peril], j = job();
    if (j) { later(0.3, function () { Sound.mrrp(); }); }
    else { f[2](); buzz(30); later(1.9, function () { Sound.mrrp(); }); }
    later(SC.failTime(level.peril), function () {
      var left = st.goal.job - st.got.job;
      $('failTitle').textContent = j ? 'Nearly there!' : f[0];
      $('failNote').textContent = j ? level.cat.name + ' is still waiting ' + j.where + (left > 0 ? ' for ' + (left === 1 ? 'one more ' + j.part : left + ' more ' + j.parts) : '') + '. Have another go?' : level.cat.name + ' is fine, just ' + f[1] + '. Have another go?';
      $('plusBtn').hidden = plusUsed;
      $('fail').hidden = false; (plusUsed ? $('retryBtn') : $('plusBtn')).focus();
    });
  }
  function fiveMore() {
    plusUsed = true; st.extra += 5;
    $('fail').hidden = true; scn.mode = 'play'; scn.mt = 0; phase = 'play'; idle = 0;
    renderHud(false);
    var m = $('moves'); m.classList.add('plus'); setTimeout(function () { m.classList.remove('plus'); }, 1200);
    say('5 more moves. You can do it!', null, 2);
  }

  /* ================= the list of rescues ================= */
  var TICK = '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#2A2340" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var LOCK = '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="2" fill="#FFC93C" stroke="#2A2340" stroke-width="1.8"/><path d="M5 7 V5 Q5 2 8 2 Q11 2 11 5 V7" fill="none" stroke="#2A2340" stroke-width="1.8"/></svg>';
  function openList(canClose) {
    var nx = nextLevel(), all = PG.done.length >= LEVELS.length;
    $('levels').innerHTML = LEVELS.map(function (lv) {
      var n = lv.n, done = PG.done.indexOf(n) >= 0, open = unlocked(n), next = n === nx && !done;
      return '<button class="lv' + (done ? ' done' : '') + (next ? ' next' : '') + '" type="button" data-n="' + n + '"' + (open ? '' : ' disabled') +
        ' aria-label="Rescue ' + n + (done ? ', rescued' : next ? ', next' : open ? '' : ', locked') + '">' + n + (done ? '<span class="tick">' + TICK + '</span>' : open ? '' : '<span class="lock">' + LOCK + '</span>') + '</button>';
    }).join('');
    $('listNote').textContent = all ? 'Every cat is rescued! Play any of them again.' : PG.done.length ? PG.done.length + ' of ' + LEVELS.length + ' cats rescued. Rescues open one after another.' : 'Pick a rescue. Each one saves a cat from a little bit of trouble.';
    $('listClose').hidden = !canClose;
    $('listWrap').hidden = false;
    var b = $('levels').querySelector('.next') || $('levels').querySelector('.lv:not(:disabled)'); if (b) b.focus();
  }
  $('levels').addEventListener('click', function (e) {
    var b = e.target.closest('[data-n]'); if (!b || b.disabled) return;
    Sound.init(); $('listWrap').hidden = true; start(+b.dataset.n);
  });
  $('listBtn').addEventListener('click', function () { openList(phase === 'play' || phase === 'fail'); });
  $('listClose').addEventListener('click', function () { $('listWrap').hidden = true; });
  $('winListBtn').addEventListener('click', function () { $('win').hidden = true; openList(false); });
  $('nextBtn').addEventListener('click', function () { Sound.init(); if (lvN >= LEVELS.length) { $('win').hidden = true; openList(false); } else start(lvN + 1); });
  $('retryBtn').addEventListener('click', function () { Sound.init(); start(lvN); });
  $('plusBtn').addEventListener('click', function () { Sound.init(); fiveMore(); });
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); });
  renderSound();

  /* ================= input: tap or drag to swap; arrows and space/enter on a keyboard ================= */
  function cellAt(x, y) {
    var c = Math.floor((x - BX) / T), r = Math.floor((y - BY) / T);
    if (r < 0 || c < 0 || r >= R || c >= C || !st.mask[r][c]) return null;
    return [r, c];
  }
  function canPick(rc) { var p = st.g[rc[0]][rc[1]]; return !!p && !p.tg && p.sp !== 'cush'; }
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (phase !== 'play' || busy) return;
    $('say').classList.add('hide');
    var rc = cellAt(e.clientX, e.clientY);
    idle = 0; hint = null; cursor = null;
    if (!rc) { sel = null; return; }
    if (sel && Math.abs(sel[0] - rc[0]) + Math.abs(sel[1] - rc[1]) === 1) { var s = sel; sel = null; doSwap(s[0], s[1], rc[0], rc[1]); return; }
    if (!canPick(rc)) { sel = null; nudge(rc); return; }
    sel = (sel && sel[0] === rc[0] && sel[1] === rc[1]) ? null : rc;
    drag = { rc: rc, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || busy || phase !== 'play') return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < T * 0.35) return;
    var rc = drag.rc, to = Math.abs(dx) > Math.abs(dy) ? [rc[0], rc[1] + (dx > 0 ? 1 : -1)] : [rc[0] + (dy > 0 ? 1 : -1), rc[1]];
    drag = null; sel = null;
    if (to[0] < 0 || to[1] < 0 || to[0] >= R || to[1] >= C) return;
    doSwap(rc[0], rc[1], to[0], to[1]);
  });
  ['pointerup', 'pointercancel'].forEach(function (t) { canvas.addEventListener(t, function () { drag = null; }); });
  function nudge(rc) { var p = st.g[rc[0]] && st.g[rc[0]][rc[1]]; var v = p && V[p.id]; if (v) v.wig = 0.3; var b = boxes[rc[0] * 64 + rc[1]]; if (b) b.shake = 0.2; }
  window.addEventListener('keydown', function (e) {
    if (!$('listWrap').hidden || !$('win').hidden || !$('fail').hidden || phase !== 'play' || !st) return;
    var dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }, d = dirs[e.key];
    if (!d && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Escape') return;
    e.preventDefault(); Sound.init(); idle = 0; hint = null; $('say').classList.add('hide');
    if (!cursor) { cursor = sel ? sel.slice() : [Math.floor(R / 2), Math.floor(C / 2) - 1]; if (!d) return; }
    if (e.key === 'Escape') { sel = null; return; }
    if (d) {
      var to = [clamp(cursor[0] + d[0], 0, R - 1), clamp(cursor[1] + d[1], 0, C - 1)];
      if (sel && !busy) { var s = sel; sel = null; cursor = to; if (to[0] !== s[0] || to[1] !== s[1]) doSwap(s[0], s[1], to[0], to[1]); return; }
      cursor = to; return;
    }
    if (busy) return;
    if (sel && sel[0] === cursor[0] && sel[1] === cursor[1]) sel = null;
    else if (st.mask[cursor[0]][cursor[1]] && canPick(cursor)) { sel = cursor.slice(); Sound.swap(); }
    else nudge(cursor);
  });

  /* ================= drawing ================= */
  function boardPath() {
    var p = new Path2D();
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (st.mask[r][c]) p.rect(BX + c * T, BY + r * T, T, T);
    return p;
  }
  /* just the board's outer edge (every cell side with no cell beyond it) */
  function edgePath() {
    var p = new Path2D(), m = function (r, c) { return r >= 0 && c >= 0 && r < R && c < C && st.mask[r][c]; };
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      if (!m(r, c)) continue;
      var x = BX + c * T, y = BY + r * T;
      if (!m(r - 1, c)) { p.moveTo(x, y); p.lineTo(x + T, y); }
      if (!m(r + 1, c)) { p.moveTo(x, y + T); p.lineTo(x + T, y + T); }
      if (!m(r, c - 1)) { p.moveTo(x, y); p.lineTo(x, y + T); }
      if (!m(r, c + 1)) { p.moveTo(x + T, y); p.lineTo(x + T, y + T); }
    }
    return p;
  }
  function drawBoard(c, dt, now) {
    var bp = boardPath(), ep = edgePath();
    D.shadow(c, BX + C * T / 2, BY + R * T + 6, C * T * 0.5, 10);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 9; c.stroke(ep);
    c.fillStyle = '#FFF8EC'; c.fill(bp);
    c.fillStyle = '#F6E8D2';
    for (var r = 0; r < R; r++) for (var q = 0; q < C; q++) if (st.mask[r][q] && (r + q) % 2) c.fillRect(BX + q * T, BY + r * T, T, T);
    // where the cushion kittens are going: soft arrows in the bottom row
    if (st.goal.down) {
      c.save(); c.fillStyle = 'rgba(255,143,171,.35)';
      for (var cc = 0; cc < C; cc++) { var br = st.bottom[cc]; if (br < 0) continue; var x = cx(cc), y = cy(br) + T * 0.1; c.beginPath(); c.moveTo(x - T * 0.22, y - T * 0.1); c.lineTo(x, y + T * 0.16); c.lineTo(x + T * 0.22, y - T * 0.1); c.closePath(); c.fill(); }
      c.restore();
    }
    // selection and keyboard cursor sit under the piece
    if (sel) { c.save(); c.fillStyle = 'rgba(255,201,60,.55)'; D.rr(c, BX + sel[1] * T + 3, BY + sel[0] * T + 3, T - 6, T - 6, T * 0.2); c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.restore(); }
    c.save(); c.clip(bp);
    // boxes
    for (var key in boxes) {
      var b = boxes[key], br2 = Math.floor(key / 64), bc = key % 64;
      if (b.shake > 0) b.shake -= dt;
      var sx = b.shake > 0 && !reduceMotion ? Math.sin(b.shake * 60) * T * 0.05 : 0;
      blit(c, sprite('b' + b.hp + ':' + b.kit + (b.part ? 'p' + partKind() : ''), function (cc) { drawBox(cc, b.hp, b.kit, b.part); }), cx(bc) + sx, cy(br2), T);
    }
    // pieces
    var hintIds = hint ? [hint.a, hint.b] : [];
    for (var id in V) {
      var v = V[id], x = cx(v.x), y = cy(v.y), s = T, rot = 0, sxk = 1, syk = 1;
      if (v.pop !== null) {
        v.pop += dt;
        if (v.pop >= 0.26) { delete V[id]; continue; }
        if (v.pop < 0) { /* waiting for a blast to reach it */ }
        else {
          if (v.pop - dt < 0) burst(x, y, v.k >= 0 ? COLS[v.k] : '#FFE680', reduceMotion ? 2 : 5, null, 0.8);
          var u = v.pop / 0.26; s = T * (u < 0.35 ? lerp(1, 1.2, u / 0.35) : lerp(1.2, 0, (u - 0.35) / 0.65));
          if (v.merge) { x = lerp(x, cx(v.merge[1]), u); y = lerp(y, cy(v.merge[0]), u); }
        }
      }
      if (v.land < 1) { var l = Math.sin(v.land * Math.PI); syk = 1 - l * 0.12; sxk = 1 + l * 0.08; y += l * T * 0.05; }
      if (v.made < 1) s *= back(v.made);
      if (v.wig > 0) { v.wig -= dt; rot = Math.sin(v.wig * 50) * 0.15; }
      if (sel && Math.round(v.x) === sel[1] && Math.round(v.y) === sel[0] && !v.path) s *= 1 + Math.sin(now * 8) * 0.04;
      if (hintIds.indexOf(v.id) >= 0 && !reduceMotion) { var hp = (hintT % 2.2); if (hp < 1) rot = Math.sin(hp * TAU * 3) * 0.14 * (1 - hp); }
      if (s <= 0) continue;
      if (v.sp === 'res') {
        var gl = 0.8 + Math.sin(now * 3 + v.id) * (reduceMotion ? 0 : 0.2), gg = c.createRadialGradient(x, y, T * 0.05, x, y, T * 0.52);
        gg.addColorStop(0, 'rgba(255,236,150,' + gl + ')'); gg.addColorStop(1, 'rgba(255,226,120,0)');
        c.fillStyle = gg; c.beginPath(); c.arc(x, y, T * 0.52, 0, TAU); c.fill();
      }
      if (E.isSp({ sp: v.sp }) && v.pop === null) {
        var g = 0.5 + Math.sin(now * 4 + v.id) * 0.15;
        c.save(); c.globalAlpha = g; c.fillStyle = v.sp === 'rain' ? '#FFFFFF' : '#FFF1A8'; c.beginPath(); c.arc(x, y, T * 0.46, 0, TAU); c.fill(); c.restore();
      }
      blit(c, pieceSprite(v), x, y, s, rot, sxk, syk);
      if (v.tg) blit(c, sprite('tangle', drawTangle), x, y, s, rot);
    }
    c.restore();
    if (cursor && phase === 'play') { c.save(); c.setLineDash([6, 5]); c.lineWidth = 3.5; c.strokeStyle = INK; D.rr(c, BX + cursor[1] * T + 2, BY + cursor[0] * T + 2, T - 4, T - 4, T * 0.2); c.stroke(); c.restore(); }
    c.lineWidth = 4; c.strokeStyle = INK; c.stroke(ep);
  }

  /* the scene: the top of one picture that the board finishes */
  function drawPicture(c) {
    var x = SX, w = SW, vy = SY + SH - SV, yb = BY, r = 18;
    D.shadow(c, x + w / 2, BY + R * T + 6, w * 0.5, 10);
    var outline = new Path2D(); outline.moveTo(x, yb + 2); outline.lineTo(x, vy + r); outline.arcTo(x, vy, x + r, vy, r); outline.lineTo(x + w - r, vy); outline.arcTo(x + w, vy, x + w, vy + r, r); outline.lineTo(x + w, yb + 2);
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 9; c.stroke(outline); c.restore();
    var j = !!job(), since = scn.t - scn.added;
    SC.draw(c, level.peril, { p: j ? 0 : pDisp, built: scn.built, n: st.goal.job, pop: reduceMotion ? 1 : back(since / 0.4), cheer: since, t: scn.t, mode: scn.mode, mt: scn.mt, cat: level.cat, saved: scn.saved, reduce: reduceMotion }, SX, SY, SW, true, SV);
    c.save(); c.strokeStyle = INK; c.lineWidth = 4; c.stroke(outline); c.restore();
  }

  /* ================= rescue parts flying up to the rescue =================
     A collected part pops off the board, flies in an arc to its place in the scene (shrinking to the scene's size),
     and clicks into the rescue: one more rung on the ladder, with sparkles, a knock and a cheer from the cat. */
  var FLY = 0.62;
  function sendPart(q) {
    delete V[q.id];
    var x0 = cx(q.c), y0 = cy(q.r);
    burst(x0, y0, '#FFE680', reduceMotion ? 2 : 6, 'star', 0.7);
    Sound.whoosh();
    flyers.push({ x0: x0, y0: y0, i: q.n - 1, t: 0, dur: reduceMotion ? 0.3 : FLY + Math.min(0.25, (BY - SY) / 4000) });
  }
  function drawFlyers(c, dt) {
    for (var i = flyers.length - 1; i >= 0; i--) {
      var f = flyers[i]; f.t += dt;
      var tg = SC.partAt(level.peril, f.i, st.goal.job, SX, SY, SW), u = clamp(f.t / f.dur, 0, 1), k = ease(u);
      if (u >= 1) {
        flyers.splice(i, 1);
        scn.built = Math.max(scn.built, f.i + 1); scn.added = scn.t;
        count('job');
        burst(tg.x, tg.y, '#FFE680', reduceMotion ? 3 : 10, 'star', 0.9);
        Sound.knock(f.i); buzz(12); later(0.12, function () { Sound.mrrp(); });
        continue;
      }
      // up and over in an arc, turning to lie flat, shrinking to the rung's size
      var x = lerp(f.x0, tg.x, k), y = lerp(f.y0, tg.y, k) - Math.sin(u * Math.PI) * T * 1.6;
      var size = lerp(T * 1.05, Math.max(tg.w * 1.6, T * 0.5), k), rot = Math.sin(u * Math.PI) * 0.5;
      c.save(); c.globalAlpha = 0.5 * (1 - u); c.fillStyle = '#FFF1A8'; c.beginPath(); c.arc(x, y, size * 0.5, 0, TAU); c.fill(); c.restore();
      blit(c, partSprite(), x, y, size, rot);
      if (!reduceMotion && Math.random() < dt * 20) parts.push({ x: x, y: y, vx: rand(-30, 30), vy: rand(-20, 20), life: 0, max: 0.4, r: T * 0.05, col: '#FFE680', shape: 'star', rot: 0, vr: rand(-6, 6), g: 0 });
    }
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000) * SPEED; last = now;
    runTasks(dt);
    stepPaths(dt);
    scn.t += dt; scn.mt += dt;
    if (freeze) { scn.mode = freeze.mode; scn.mt = freeze.mt; if (freeze.p !== undefined) pDisp = freeze.p; }
    if (sayTimer > 0) { sayTimer -= dt; if (sayTimer <= 0) $('say').classList.add('hide'); }
    if (st) {
      var target = clamp(st.used / (st.moves + st.extra), 0, 1);
      if (!freeze) pDisp += (target - pDisp) * Math.min(1, dt * 3);
      if (phase === 'play' && !busy) {
        idle += dt;
        if (idle > 5 && !hint) { var m = E.bestMove(st); if (m) { var a = st.g[m[0]][m[1]], b = st.g[m[2]][m[3]]; hint = { a: a.id, b: b.id }; hintT = 0; } }
      }
      if (hint) hintT += dt;
    }
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (st) {
      drawPicture(c);
      drawBoard(c, dt, scn.t);
      c.save(); c.clip(boardPath()); drawFx(c, dt); c.restore();
      drawParts(c, dt);
      drawActors(c, dt);
      drawFlyers(c, dt);
    }
    requestAnimationFrame(frame);
  }

  /* ================= go ================= */
  layout();
  start(nextLevel(), true);
  phase = 'list';
  $('say').classList.add('hide');
  openList(false);
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  /* ================= test hook ================= */
  window.__rescue = {
    state: function () {
      return { level: lvN, phase: phase, busy: busy, moves: st.moves, used: st.used, extra: st.extra, left: E.movesLeft(st), goal: st.goal, got: st.got, shown: shown, won: E.won(st), actors: actors.length, flyers: flyers.length, built: scn.built, onBoard: E.partsOnBoard(st), saved: scn.saved.filter(Boolean).length, progress: JSON.parse(JSON.stringify(PG)) };
    },
    jump: function (n) { $('listWrap').hidden = true; start(n); return until(function () { for (var id in V) if (V[id].path) return false; return true; }); },
    swap: function (r1, c1, r2, c2) { return doSwap(r1, c1, r2, c2); },
    moves: function () { return E.allMoves(st); },
    best: function () { return E.bestMove(st); },
    settled: function () { return !busy && !actors.length && !flyers.length && !tasks.length; },
    parts: function () { var out = []; for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) { var p = st.g[r][c]; if (p && p.sp === 'res') out.push([r, c]); } return out; },
    hit: async function (cells) { busy = true; await playLog(E.blast(st, cells)); busy = false; renderHud(false); await checkEnd(); },
    special: function (r, c, sp) { var p = st.g[r][c]; if (p) { p.sp = sp; if (sp === 'rain') p.k = -1; syncView(); } },
    setUsed: function (n) { st.used = n; renderHud(false); },
    speed: function (k) { SPEED = k; },
    engine: E, levels: LEVELS, st: function () { return st; },
    layout: function () { return { T: T, BX: BX, BY: BY, SX: SX, SY: SY, SW: SW, SH: SH, side: side }; },
    list: function () { openList(false); },
    saved: function (list) { scn.saved = list.slice(); scn.reserved = list.length; },
    freeze: function (mode, mt, p) { freeze = mode ? { mode: mode, mt: mt, p: p } : null; $('say').classList.add('hide'); }
  };
})();
