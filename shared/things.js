/* Cosy Cat Games: the creatures and little things every game shares (mice, dogs, yarn balls, fish). The scenery
   kit (shared/scene.js) does rooms and outdoors; this does the things that live in them. A game never draws one of
   these itself: it calls one and passes parameters. A new kind of thing (or a new view of one) is added here, with a
   cell in tools/scene-gallery.html, before a game uses it. Needs shared/draw.js first.

   House style (shared/draw.js): one ink, outline last with details clipped inside, light from the top left.
   Outlines are the house weights on screen whatever the size: pass `ls`, the scale the canvas is already drawn at
   when you call inside your own c.scale() (default 1).

   Views: 'top' is seen from straight above (games played on a floor or board: Mouse Pop, Yarn Dash, Laser Bounce);
   'side' is seen side-on (games with a floor line: Sneaky Cat, Yarn Defence's runners). Each thing faces +x
   (to the right) unless it says otherwise; pass `dir: -1` or rotate to turn it.

     GGThings.mouse(c, x, y, { view: 'top' | 'side', size (1 = about 70 long), col, a (top: the way it faces, radians),
                    run (a phase: paws/body bob; leave out when still), tail (a phase for the tail), toy (a wind-up key
                    on its back, turning at this angle), sleepy (side: eyes shut), crown (side: a little gold crown),
                    dir (side: 1 right, -1 left), tilt (side: up to ±0.5 when climbing), shadow (default true), ls })
         centred on its body; the side view stands on y (its feet at y + a little)
     GGThings.dog(c, x, y, { view: 'side' | 'top', col: { body, dark, ear, spots }, bed (a colour, or false),
                  lift (0..1 head up), perk (0..1 ear up), open (0..1 mouth, a bark), eyes: 'closed' | 'peek' | 'open',
                  wag (a phase), breathe (a small squash, e.g. sin(t) * 0.03), dir (side: 1 head right, -1 head left), ls })
         side: lying on its bed, (x, y) the floor under its middle; top: curled up in a round bed seen from above,
         (x, y) the bed's middle
     GGThings.dog(c, x, y, { view: 'face', size (1 = about 70 across), col, eyes, tongue (0..1, a happy lick), ls })
         a puppy's face looking at you (for games where the characters are faces, like Fish Maze), centred
     GGThings.catnip(c, x, y, { size (1 = about 40 tall), glow (0..1), ls })   a sprig of catnip, centred
     GGThings.yarnBall(c, x, y, { r, col, gold, spin, end (a loose end), shadow, ls })   centred
     GGThings.fish(c, x, y, { size (1 = 34 long), col, gold (a soft glow), a (turn), ls })   centred, facing left
    GGThings.umbrella(c, x, y, { size (1 = about 60 across, 70 tall), col, open (0 furled .. 1 open), a (tilt), ls })
        (x, y) is the hook of the handle, where a paw holds it
   More at the end of this file: the dog walking (and turned in its bed) from above, a pet bowl, a squeaky toy. */
(function () {
  'use strict';
  var D = window.GGDraw, INK = D.INK, LW = D.LW, TAU = Math.PI * 2;
  function W(o, w, k) { return w / (((o && o.ls) || 1) * (k || 1)); }   // a house line weight, at the scale we're drawn at
  function pick(v, d) { return v === undefined || v === null ? d : v; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }

  /* ================= mouse ================= */
  var MOUSE_TOP = new Path2D('M-32 0Q-30 -22 0 -21Q30 -18 38 0Q30 18 0 21Q-30 22 -32 0Z');
  function mouse(c, x, y, o) {
    o = o || {};
    if (o.view === 'side') return mouseSide(c, x, y, o);
    var s = pick(o.size, 1), a = o.a || 0, col = o.col || '#C9C2D6', run = o.run || 0, tl = pick(o.tail, 0);
    var lm = W(o, LW.mid, s), lf = W(o, LW.fine, s);
    if (o.shadow !== false) { c.save(); c.translate(x + 3, y + 6); c.rotate(a); c.scale(s, s); c.fillStyle = 'rgba(42,35,64,.16)'; c.beginPath(); c.ellipse(2, 0, 38, 24, 0, 0, TAU); c.fill(); c.restore(); }
    c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
    // the crescent of shade sits to the lower right on screen, whichever way the mouse faces
    var cs = Math.cos(-a), sn = Math.sin(-a), ox = -5 / s, oy = -7 / s;
    // tail (starts under the body), outlined
    c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(-54, -8 + Math.sin(tl) * 10, -70, 4);
    c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 5 + lf * 2; c.stroke(); c.strokeStyle = '#FF8FAB'; c.lineWidth = 5; c.stroke();
    // little paws peeking out from under the body (a toy mouse runs on wheels: none)
    if (!o.toy && o.toy !== 0) [[-14, -20, 1], [14, -19, -1], [-14, 20, -1], [14, 19, 1]].forEach(function (f) { c.beginPath(); c.ellipse(f[0] + Math.sin(run) * 4 * f[2], f[1], 7, 5, 0, 0, TAU); c.fillStyle = '#FFB3C7'; c.fill(); D.ink(c, lf); });
    D.shape(c, MOUSE_TOP, col, { lw: lm, depth: 1, dx: ox * cs - oy * sn, dy: ox * sn + oy * cs, shade: 'rgba(42,35,64,.14)' });
    [-20, 20].forEach(function (ey) { D.shape(c, D.ellPath(10, ey, 11, 11), col, { lw: lf, depth: 0, inside: function (c) { c.beginPath(); c.arc(10, ey, 6, 0, TAU); c.fillStyle = '#FFB3C7'; c.fill(); } }); });
    // face: eyes inside; whiskers and nose out at the tip, so nothing crosses the outline
    c.fillStyle = INK; c.beginPath(); c.arc(26, -7, 3.6, 0, TAU); c.fill(); c.beginPath(); c.arc(26, 7, 3.6, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(42, -4); c.lineTo(52, -11); c.moveTo(42, 4); c.lineTo(52, 11); c.strokeStyle = 'rgba(42,35,64,.5)'; c.lineWidth = 2 / s; c.stroke();
    c.beginPath(); c.arc(39, 0, 5, 0, TAU); c.fillStyle = '#FF7FA6'; c.fill(); D.ink(c, lf);
    if (o.toy || o.toy === 0) {
      // the wind-up key on its back
      c.save(); c.translate(-8, 0); c.rotate(o.toy);
      c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.strokeStyle = INK; c.lineWidth = 4 + lf * 2; c.stroke(); c.strokeStyle = '#E0A100'; c.lineWidth = 4; c.stroke();
      [-12, 12].forEach(function (kx) { D.shape(c, D.ellPath(kx, 0, 5, 5), '#FFD23F', { lw: lf, depth: 0 }); });
      c.restore();
    }
    c.restore();
  }
  /* side on: a plump body, one ear, a long tail; drawn in a 36-long space and scaled up to match the top view */
  function mouseSide(c, x, y, o) {
    var s = pick(o.size, 1) * 2, col = o.col || '#B8B3C9', dir = o.dir === -1 ? -1 : 1;
    var lm = W(o, LW.fine, s), lf = W(o, 2.5, s), bob = Math.sin(o.run || 0) * 1.5;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (o.shadow !== false) D.shadow(c, 0, 9, 14, 4);
    c.save(); if (dir < 0) c.scale(-1, 1); c.rotate(clamp(o.tilt || 0, -0.5, 0.5) * 0.5);
    c.beginPath(); c.moveTo(-14, 2); c.quadraticCurveTo(-26, -2 + Math.sin(pick(o.tail, 0)) * 5, -30, 6); c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 1.8 + lf * 0.9; c.stroke(); c.strokeStyle = '#FFB4C6'; c.lineWidth = 1.8; c.stroke();
    D.shape(c, function (p) { p.moveTo(-16, 4 + bob); p.quadraticCurveTo(-16, -12 + bob, 2, -12 + bob); p.quadraticCurveTo(16, -12 + bob, 20, 2 + bob); p.quadraticCurveTo(18, 8 + bob, 4, 8 + bob); p.lineTo(-12, 8 + bob); p.quadraticCurveTo(-16, 8 + bob, -16, 4 + bob); p.closePath(); }, col, { lw: lm, depth: 3 });
    D.shape(c, D.ellPath(6, -12 + bob, 6, 6), '#FFB4C6', { lw: lf, depth: 0 });
    c.beginPath(); c.arc(21, 2 + bob, 2.4, 0, TAU); c.fillStyle = '#FF8FAB'; c.fill();
    if (o.sleepy) { c.beginPath(); c.moveTo(10, -3 + bob); c.lineTo(15, -3 + bob); c.strokeStyle = INK; c.lineWidth = lf * 0.8; c.stroke(); }
    else { c.beginPath(); c.arc(13, -3 + bob, 2, 0, TAU); c.fillStyle = INK; c.fill(); }
    if (o.crown) D.shape(c, function (p) { p.moveTo(-4, -12 + bob); p.lineTo(10, -12 + bob); p.lineTo(8, -20 + bob); p.lineTo(3, -15 + bob); p.lineTo(-2, -20 + bob); p.closePath(); }, '#FFD23F', { lw: lf * 0.9, depth: 0 });
    c.restore();
    c.restore();
  }

  /* ================= dog ================= */
  var DOG_COL = { body: '#C98B5B', dark: '#9A6440', ear: '#7E4E30' };
  function dog(c, x, y, o) {
    o = o || {};
    return o.view === 'top' ? dogTop(c, x, y, o) : o.view === 'face' ? dogFace(c, x, y, o) : dogSide(c, x, y, o);
  }
  function eyesSide(c, o, lf) {
    var e = o.eyes || 'closed';
    if (e === 'closed') { c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(-8, -1, -2, -6); D.ink(c, lf); }
    else if (e === 'peek') { c.beginPath(); c.moveTo(-15, -6); c.lineTo(-1, -6); D.ink(c, lf); c.beginPath(); c.arc(-8, -4, 3, 0, Math.PI); c.fillStyle = INK; c.fill(); }
    else {
      c.beginPath(); c.arc(-8, -6, 6.5, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); D.ink(c, lf * 0.85);
      c.beginPath(); c.arc(-10, -6, 3.4, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.moveTo(-17, -16); c.lineTo(-2, -15); D.ink(c, lf);
    }
  }
  /* lying on its bed, side on; drawn with its head on the left (-x) and turned by dir */
  function dogSide(c, x, y, o) {
    var col = o.col || DOG_COL, lift = clamp(o.lift || 0, 0, 1), perk = clamp(o.perk || 0, 0, 1), open = clamp(o.open || 0, 0, 1);
    var lm = W(o, LW.mid), lf = W(o, LW.fine), breathe = o.breathe || 0;
    c.save(); c.translate(x, y); c.scale(o.dir === 1 ? -1 : 1, 1);
    if (o.bed !== false) {
      var bed = o.bed || '#B05F7C';
      D.shape(c, D.ellPath(0, -4, 104, 22), bed, { lw: lm, depth: 0 });
      D.shape(c, D.ellPath(0, -10, 88, 14), D.lighter(bed, 0.18), { lw: 0, depth: 0 });
    }
    // tail (wags a little when awake)
    c.save(); c.translate(58, -36); c.rotate(0.5 + Math.sin(o.wag || 0) * 0.4 * (lift > 0.5 ? 1 : 0));
    D.shape(c, function (p) { p.moveTo(0, -6); p.quadraticCurveTo(26, -20, 40, -6); p.quadraticCurveTo(28, -8, 2, 6); p.closePath(); }, col.body, { lw: lf, depth: 0 });
    c.restore();
    c.save(); c.translate(0, -34); c.scale(1, 1 + breathe);
    D.shape(c, D.ellPath(0, 0, 70, 30), col.body, { lw: lm, depth: 6, inside: col.spots ? function (c) { c.fillStyle = '#4A4262'; [[10, -14, 16, 11], [-28, 6, 12, 9], [40, 4, 10, 8]].forEach(function (s) { c.beginPath(); c.ellipse(s[0], s[1], s[2], s[3], 0.3, 0, TAU); c.fill(); }); } : null });
    c.restore();
    D.shape(c, D.ellPath(38, -24, 24, 20), col.body, { lw: lm, depth: 4 });
    D.shape(c, D.rrPath(34, -12, 36, 14, 7), col.body, { lw: lf, depth: 0 });
    D.shape(c, D.rrPath(-104, -16, 56, 16, 8), col.body, { lw: lf, depth: 0 });
    D.shape(c, D.rrPath(-96, -10, 50, 14, 7), col.dark, { lw: lf, depth: 0 });
    // head: resting on the paws asleep, up when awake
    c.save(); c.translate(-74 - lift * 6, -34 - lift * 38); c.rotate(lerp(0.12, -0.05, lift));
    D.shape(c, D.ellPath(0, 0, 30, 25), col.body, { lw: lm, depth: 4 });
    D.shape(c, D.ellPath(-28, 6 + open * 2, 18, 12 + open * 3), col.body, { lw: lf, depth: 0 });
    if (open > 0.2) { c.beginPath(); c.ellipse(-30, 14 + open * 4, 10, 4 + open * 5, 0, 0, TAU); c.fillStyle = '#A3405C'; c.fill(); D.ink(c, lf * 0.85); }
    c.beginPath(); c.ellipse(-44, 2, 6, 5, 0, 0, TAU); c.fillStyle = INK; c.fill();
    eyesSide(c, o, lf);
    // the floppy ear: hangs down asleep, perks up as it wakes
    c.save(); c.translate(10, -16); c.rotate(lerp(0.2, -0.9, perk) + (o.twitch || 0));
    D.shape(c, function (p) { p.moveTo(-6, 0); p.quadraticCurveTo(14, -6, 16, 14); p.quadraticCurveTo(16, 34, 6, 36); p.quadraticCurveTo(-4, 30, -6, 0); p.closePath(); }, col.ear, { lw: lf, depth: 0 });
    c.restore();
    c.restore();
    c.restore();
  }
  /* curled up in a round bed, seen from above; the head lifts towards the viewer when it wakes */
  var BED = D.ellPath(0, 10, 92, 70), BED_IN = D.ellPath(0, 10, 72, 52), BODY = D.ellPath(6, 18, 56, 38), HEAD = D.ellPath(0, 0, 34, 28);
  function dogTop(c, x, y, o) {
    var col = o.col || DOG_COL, up = clamp(o.lift || 0, 0, 1), lm = W(o, LW.mid), lf = W(o, LW.fine);
    c.save(); c.translate(x, y);
    if (o.bed !== false) {
      var bed = o.bed || '#B48CFF';
      D.shadow(c, 4, 22, 92, 64);
      D.shape(c, BED, D.tone(c, bed, -60, 80), { lw: lm, depth: 10 });
      D.shape(c, BED_IN, D.lighter(bed, 0.55), { lw: lf, depth: 0, inside: function (c) { c.fillStyle = 'rgba(42,35,64,.1)'; c.beginPath(); c.ellipse(8, 20, 72, 52, 0, 0, TAU); c.rect(-200, -200, 400, 400); c.fill('evenodd'); } });
    }
    // tail first, starting inside the body, so the body covers the join
    c.beginPath(); c.moveTo(50, 20); c.quadraticCurveTo(78, 8 + Math.sin(o.wag || 0) * 6, 70, -6); c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 6 + lm * 2; c.stroke(); c.strokeStyle = col.body; c.lineWidth = 6; c.stroke();
    var light = D.lighter(col.body, 0.3);
    D.shape(c, BODY, D.tone(c, col.body, -20, 56), { lw: lm, depth: 8, inside: function (c) { c.beginPath(); c.ellipse(18, 30, 26, 12, 0.3, 0, TAU); c.fillStyle = light; c.fill(); } });
    c.save(); c.translate(-30, 10 - up * 26);
    D.shape(c, HEAD, D.tone(c, col.body, -28, 28), { lw: lm, depth: 6, inside: function (c) { c.beginPath(); c.ellipse(0, 12, 16, 12, 0, 0, TAU); c.fillStyle = light; c.fill(); } });
    var flop = o.flop || 0;
    [[-28, 0.4 + flop], [28, -0.4 - flop]].forEach(function (e) { D.shape(c, D.ellPath(e[0], 4, 12, 22, e[1]), col.ear, { lw: lf, depth: 3 }); });
    c.beginPath(); c.ellipse(0, 6, 6, 4.5, 0, 0, TAU); c.fillStyle = INK; c.fill();
    var e = o.eyes || 'closed';
    if (e === 'closed') { c.beginPath(); c.moveTo(-16, -6); c.quadraticCurveTo(-10, -1, -4, -6); c.moveTo(4, -6); c.quadraticCurveTo(10, -1, 16, -6); D.ink(c, lf); }
    else if (e === 'peek') { c.beginPath(); c.moveTo(-16, -6); c.quadraticCurveTo(-10, -1, -4, -6); D.ink(c, lf); c.beginPath(); c.arc(10, -6, 4.5, 0, TAU); c.fillStyle = INK; c.fill(); }
    else { c.fillStyle = INK; c.beginPath(); c.arc(-10, -6, 5, 0, TAU); c.fill(); c.beginPath(); c.arc(10, -6, 5, 0, TAU); c.fill(); if (o.open) { c.beginPath(); c.ellipse(0, 20, 7, 6, 0, 0, TAU); c.fillStyle = '#FF7FA6'; c.fill(); D.ink(c, lf); } }
    c.restore();
    c.restore();
  }

  /* a puppy's face, looking at you: the top view's head, with its floppy ears and a happy mouth */
  function dogFace(c, x, y, o) {
    var s = pick(o.size, 1), col = o.col || DOG_COL, lm = W(o, LW.mid, s), lf = W(o, LW.fine, s), light = D.lighter(col.body, 0.3);
    c.save(); c.translate(x, y); c.scale(s, s);
    var flop = o.flop || 0;
    [[-30, 0.35 + flop], [30, -0.35 - flop]].forEach(function (e) { D.shape(c, D.ellPath(e[0], 2, 13, 24, e[1]), col.ear, { lw: lf, depth: 3 }); });
    D.shape(c, D.ellPath(0, 0, 32, 28), D.tone(c, col.body, -28, 28), { lw: lm, depth: 6, inside: function (c) {
      c.beginPath(); c.ellipse(0, 12, 17, 12, 0, 0, TAU); c.fillStyle = light; c.fill();
      if (col.spots) { c.beginPath(); c.ellipse(-14, -12, 9, 7, 0.4, 0, TAU); c.fillStyle = '#4A4262'; c.fill(); }
    } });
    c.beginPath(); c.ellipse(0, 6, 6.5, 5, 0, 0, TAU); c.fillStyle = INK; c.fill();
    var e = o.eyes || 'open';
    if (e === 'closed') { c.beginPath(); c.moveTo(-17, -6); c.quadraticCurveTo(-11, -1, -5, -6); c.moveTo(5, -6); c.quadraticCurveTo(11, -1, 17, -6); D.ink(c, lf); }
    else if (e === 'peek') { c.beginPath(); c.moveTo(-17, -6); c.lineTo(-5, -6); c.moveTo(5, -6); c.lineTo(17, -6); D.ink(c, lf); }
    else { c.fillStyle = INK; [-11, 11].forEach(function (ex) { c.beginPath(); c.arc(ex, -6, 5, 0, TAU); c.fill(); }); c.fillStyle = '#fff'; [-9.5, 12.5].forEach(function (ex) { c.beginPath(); c.arc(ex, -7.5, 1.6, 0, TAU); c.fill(); }); }
    c.beginPath(); c.moveTo(-7, 13); c.quadraticCurveTo(-3.5, 17, 0, 13); c.quadraticCurveTo(3.5, 17, 7, 13); D.ink(c, lf * 0.9);
    if (o.tongue) { c.save(); c.translate(0, 16); c.scale(1, o.tongue); D.shape(c, D.rrPath(-5, 0, 10, 12, 5), '#FF7FA6', { lw: lf * 0.8, depth: 0 }); c.restore(); }
    c.restore();
  }

  /* ================= catnip ================= */
  function catnip(c, x, y, o) {
    o = o || {};
    var s = pick(o.size, 1), lf = W(o, LW.fine, s);
    c.save(); c.translate(x, y); c.scale(s, s);
    if (o.glow) { c.save(); c.globalAlpha = 0.5 * o.glow; var g = c.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, 'rgba(190,255,170,1)'); g.addColorStop(1, 'rgba(190,255,170,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 30, 0, TAU); c.fill(); c.restore(); }
    c.beginPath(); c.moveTo(0, 18); c.lineTo(0, -16); c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 4 + lf * 2; c.stroke(); c.strokeStyle = '#4FB868'; c.lineWidth = 4; c.stroke();
    [[-1, 8, 0.5], [1, 2, -0.5], [-1, -6, 0.6], [1, -12, -0.6]].forEach(function (l) {
      c.save(); c.translate(0, l[1]); c.rotate(l[2] + (l[0] < 0 ? Math.PI : 0));
      D.shape(c, D.ellPath(11, 0, 11, 6), l[1] < 0 ? '#7BD389' : '#5CCB75', { lw: lf, depth: 0, inside: function (c) { c.beginPath(); c.moveTo(2, 0); c.lineTo(19, 0); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.5; c.stroke(); } });
      c.restore();
    });
    D.shape(c, D.ellPath(0, -19, 4, 4), '#B48CFF', { lw: lf, depth: 0 });
    c.restore();
  }

  /* ================= yarn ball ================= */
  function yarnBall(c, x, y, o) {
    o = o || {};
    var r = o.r || 20, col = o.gold ? '#FFD23F' : (o.col || '#FF8FAB'), lw = W(o, r > 26 ? LW.mid : LW.fine);
    c.save(); c.translate(x, y);
    if (o.shadow) D.shadow(c, 3, r * 0.9, r * 0.9, r * 0.3);
    c.rotate(o.spin || 0);
    if (o.end) {
      // a loose end, starting under the ball so the ball covers the join
      c.beginPath(); c.moveTo(r * 0.45, r * 0.5); c.quadraticCurveTo(r * 1.3, r * 0.9, r * 1.1, r * 1.3); c.lineCap = 'round';
      var tw = Math.max(1.5, r * 0.15);
      c.strokeStyle = INK; c.lineWidth = tw + W(o, LW.fine) * 2; c.stroke(); c.strokeStyle = o.gold ? '#FFC21A' : col; c.lineWidth = tw; c.stroke();
    }
    D.shape(c, D.ellPath(0, 0, r, r), D.tone(c, col, -r, r), { lw: lw, depth: r * 0.2, shade: 'rgba(42,35,64,.15)', inside: function (c) {
      c.strokeStyle = o.gold ? '#C98A00' : 'rgba(42,35,64,.32)'; c.lineWidth = Math.max(1.2, r * 0.1);
      for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r, i * r * 0.32 - r * 0.3); c.quadraticCurveTo(0, i * r * 0.32 + r * 0.3, r, i * r * 0.32 - r * 0.3); c.stroke(); }
      c.beginPath(); c.moveTo(-r * 0.2, -r); c.quadraticCurveTo(r * 0.5, 0, -r * 0.2, r); c.stroke();
    }, shine: [-r * 0.4, -r * 0.45, r * 0.32, r * 0.18, -0.6, 0.6] });
    c.restore();
  }

  /* ================= fish ================= */
  var FISH = new Path2D('M-16 0Q-4 -12 8 -5L17 -11L17 11L8 5Q-4 12 -16 0Z');
  function fish(c, x, y, o) {
    o = o || {};
    var s = pick(o.size, 1), col = o.gold ? '#FFD23F' : (o.col || '#7CC4FF');
    c.save(); c.translate(x, y); if (o.a) c.rotate(o.a); c.scale(s, s);
    if (o.gold) { c.save(); c.globalAlpha = 0.45; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fillStyle = '#FFE58A'; c.fill(); c.restore(); }
    D.shape(c, FISH, col, { lw: W(o, LW.fine, s), depth: 3 });
    c.beginPath(); c.arc(-8, -1.5, 2, 0, TAU); c.fillStyle = INK; c.fill();
    c.restore();
  }

  /* ================= umbrella (a kitten's brolly) ================= */
  function umbrella(c, x, y, o) {
    o = o || {};
    var s = pick(o.size, 1), col = o.col || '#7CC4FF', op = clamp(pick(o.open, 1), 0, 1), lf = W(o, LW.fine, s), lm = W(o, LW.mid, s);
    c.save(); c.translate(x, y); if (o.a) c.rotate(o.a); c.scale(s, s);
    // the handle: (x, y) is the hook a paw holds
    c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -3); c.arc(-4, -3, 4, 0, Math.PI); c.strokeStyle = INK; c.lineWidth = 3 + lf * 2; c.lineCap = 'round'; c.stroke(); c.strokeStyle = '#A86B3C'; c.lineWidth = 3; c.stroke();
    var rw = lerp(6, 30, op), rh = lerp(26, 18, op);
    var p = new Path2D(); p.moveTo(-rw, -38); p.quadraticCurveTo(-rw, -38 - rh * 1.2, 0, -38 - rh * 1.1); p.quadraticCurveTo(rw, -38 - rh * 1.2, rw, -38);
    var n = 4; for (var i = n; i > 0; i--) { var x0 = -rw + (i / n) * rw * 2, x1 = -rw + ((i - 1) / n) * rw * 2; p.quadraticCurveTo((x0 + x1) / 2, -38 - lerp(2, 7, op), x1, -38); } p.closePath();
    D.shape(c, p, col, { lw: lm, depth: 4, inside: function (c) { c.strokeStyle = D.darker(col, 0.2); c.lineWidth = lf * 0.8; c.beginPath(); for (var k = 1; k < n; k++) { var xx = -rw + (k / n) * rw * 2; c.moveTo(0, -38 - rh * 1.1); c.lineTo(xx, -38); } c.stroke(); } });
    c.beginPath(); c.arc(0, -38 - rh * 1.1 - 2, 2.5, 0, TAU); c.fillStyle = INK; c.fill();
    c.restore();
  }

  window.GGThings = {
    VARIANTS: { mouse: ['top', 'side'], dog: ['side', 'top', 'face'], yarnBall: ['plain', 'gold'], fish: ['plain', 'gold'], catnip: ['sprig'], umbrella: ['open', 'closed'] },
    mouse: mouse, dog: dog, yarnBall: yarnBall, fish: fish, catnip: catnip, umbrella: umbrella, star: star
  };
})();

/* ================= added for Sneaky Cat: a walking dog from above, a turned dog in its bed, a pet bowl, a squeaky toy =================
   (its own block; the looks above are unchanged)
     GGThings.dog(c, x, y, { view: 'top', a })          the curled-up dog in its bed, turned so its face points along a
                                                        (radians; without a it is drawn exactly as above)
     GGThings.dog(c, x, y, { view: 'top', walk, a, col, eyes, wag, size (1 = about 130 long), shadow, ls })
         a dog up and walking, seen from above, facing a: walk is a phase for the legs (leave out or null for the
         curled-up dog), still: true stands it still; centred on its body
     GGThings.bowl(c, x, y, { view: 'top', r, col, food: 'fish' | 'kibble' | false, ls })   a pet bowl from above
     GGThings.toy(c, x, y, { kind: 'bone', view: 'top', a, col, squeeze (0..1, it squashes as it squeaks), ls })
         a rubber bone, with little squeak lines (brighter while it squeezes) */
(function (T) {
  'use strict';
  var D = window.GGDraw, INK = D.INK, LW = D.LW, TAU = Math.PI * 2;
  function W(o, w, k) { return w / (((o && o.ls) || 1) * (k || 1)); }
  // the crescent of shade on a shape turned by a, kept to the lower right of the screen
  function turned(dep, a) { var x = -0.7 * dep, y = -dep, cs = Math.cos(-a), sn = Math.sin(-a); return { dx: x * cs - y * sn, dy: x * sn + y * cs }; }
  T.VARIANTS.dog = T.VARIANTS.dog.concat(['topWalk']); T.VARIANTS.bowl = ['top']; T.VARIANTS.toy = ['bone'];
  var dogBase = T.dog;
  T.dog = function (c, x, y, o) {
    o = o || {};
    if (o.view !== 'top' || (o.walk === undefined || o.walk === null) && o.a === undefined) return dogBase(c, x, y, o);
    if (o.walk === undefined || o.walk === null) {
      c.save(); c.translate(x, y); c.rotate(o.a - Math.PI / 2); dogBase(c, 0, 0, o); c.restore();
      return;
    }
    var col = o.col || { body: '#C98B5B', dark: '#9A6440', ear: '#7E4E30' }, a = o.a || 0, s = o.size || 1;
    var lm = W(o, LW.mid, s), lf = W(o, LW.fine, s), ph = o.walk || 0, still = !!o.still, wag = Math.sin(o.wag || 0);
    var light = D.lighter(col.body, 0.3);
    if (o.shadow !== false) { c.save(); c.translate(x + 4, y + 7); c.rotate(a); c.scale(s, s); c.fillStyle = 'rgba(20,14,36,.22)'; c.beginPath(); c.ellipse(4, 0, 64, 30, 0, 0, TAU); c.fill(); c.restore(); }
    c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
    // the tail first (the body covers its root), then the paws stepping out from under the body
    c.beginPath(); c.moveTo(-40, 0); c.quadraticCurveTo(-62, wag * 10, -72, wag * 18 - 4); c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 7 + lf * 2; c.stroke(); c.strokeStyle = col.body; c.lineWidth = 7; c.stroke();
    [[24, -1, 0], [24, 1, Math.PI], [-28, -1, Math.PI], [-28, 1, 0]].forEach(function (l) {
      var sw = still ? 0 : Math.sin(ph + l[2]) * 7;
      D.shape(c, D.ellPath(l[0] + sw, l[1] * 22, 9, 7), col.dark, { lw: lf, depth: 0 });
    });
    var bc = turned(7, a);
    D.shape(c, D.ellPath(-4, 0, 48, 25), D.tone(c, col.body, -25, 25), { lw: lm, depth: 1, dx: bc.dx, dy: bc.dy, inside: function (c) {
      c.fillStyle = light; c.beginPath(); c.ellipse(-8, 0, 26, 8, 0, 0, TAU); c.fill();
      if (col.spots) { c.fillStyle = '#4A4262'; [[4, -12, 12, 8], [-26, 9, 10, 7], [16, 10, 8, 6]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], q[2], q[3], 0.3, 0, TAU); c.fill(); }); }
    } });
    // the head: floppy ears tucked under it, a muzzle, the nose at the front
    [-1, 1].forEach(function (sg) { D.shape(c, D.ellPath(34, sg * 18, 13, 8, sg * 0.5), col.ear, { lw: lf, depth: 0 }); });
    var hc = turned(5, a);
    D.shape(c, D.ellPath(42, 0, 21, 19), D.tone(c, col.body, -19, 19), { lw: lm, depth: 1, dx: hc.dx, dy: hc.dy });
    D.shape(c, D.ellPath(60, 0, 12, 9), light, { lw: lf, depth: 0 });
    c.beginPath(); c.ellipse(70, 0, 5, 6, 0, 0, TAU); c.fillStyle = INK; c.fill();
    [-1, 1].forEach(function (sg) {
      if ((o.eyes || 'open') === 'open') { c.beginPath(); c.arc(48, sg * 8, 4.4, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); D.ink(c, lf * 0.7); c.beginPath(); c.arc(49.6, sg * 8, 2.3, 0, TAU); c.fillStyle = INK; c.fill(); }
      else { c.beginPath(); c.moveTo(45, sg * 8 - 3); c.quadraticCurveTo(49, sg * 8, 45, sg * 8 + 3); D.ink(c, lf * 0.8); }
    });
    c.restore();
  };

  T.bowl = function (c, x, y, o) {
    o = o || {};
    var r = o.r || 24, col = o.col || '#7CC4FF', lm = W(o, LW.mid), food = o.food === undefined ? 'fish' : o.food;
    D.shadow(c, x + 3, y + 5, r * 1.05, r * 0.9);
    D.shape(c, D.ellPath(x, y, r, r * 0.84), D.tone(c, col, y - r, y + r), { lw: lm, depth: r * 0.16, inside: function (c) {
      c.fillStyle = D.darker(col, 0.3); c.beginPath(); c.ellipse(x, y + r * 0.04, r * 0.68, r * 0.56, 0, 0, TAU); c.fill();
      if (food === 'kibble') { c.fillStyle = '#B97A4A'; for (var i = 0; i < 9; i++) { var an = i * 2.4, rr = r * 0.4 * Math.sqrt((i + 0.5) / 9); c.beginPath(); c.arc(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.8, r * 0.12, 0, TAU); c.fill(); } }
    }, shine: [x - r * 0.45, y - r * 0.5, r * 0.22, r * 0.1, -0.5, 0.45] });
    if (food === 'fish' && T.fish) T.fish(c, x, y, { size: r / 30, col: '#FFB070', a: -0.3, ls: o.ls });
  };

  T.toy = function (c, x, y, o) {
    o = o || {};
    var a = o.a || 0, sq = Math.max(0, Math.min(1, o.squeeze || 0)), col = o.col || '#FF8FAB', lf = W(o, LW.fine);
    D.shadow(c, x + 3, y + 6, 22, 8);
    c.save(); c.translate(x, y); c.rotate(a); c.scale(1 + sq * 0.15, 1 - sq * 0.2);
    var bone = new Path2D();
    [[-15, -6], [-15, 6], [15, -6], [15, 6]].forEach(function (q) { bone.moveTo(q[0] + 7, q[1]); bone.arc(q[0], q[1], 7, 0, TAU); });
    bone.rect(-15, -5, 30, 10);
    // one outline round the whole bone: the ink twice as wide, the fill over its inner half
    c.save(); c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = lf * 2; c.stroke(bone); c.restore();
    c.fillStyle = col; c.fill(bone);
    var cr = turned(3, a); c.save(); c.clip(bone);
    var hole = new Path2D(); hole.rect(-100, -100, 200, 200); hole.addPath(bone, new DOMMatrix().translate(cr.dx, cr.dy));
    c.fillStyle = 'rgba(42,35,64,.15)'; c.fill(hole, 'evenodd'); c.restore();
    c.restore();
    c.save(); c.translate(x, y); c.strokeStyle = 'rgba(255,246,216,' + (0.3 + sq * 0.6) + ')'; c.lineWidth = W(o, 3); c.lineCap = 'round';
    [-1, 0, 1].forEach(function (i) { var r0 = 20 + sq * 8, an = -Math.PI / 2 + i * 0.55; c.beginPath(); c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); c.lineTo(Math.cos(an) * (r0 + 8), Math.sin(an) * (r0 + 8)); c.stroke(); });
    c.restore();
  };
})(window.GGThings);
