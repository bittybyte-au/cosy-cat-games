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
   More at the end of this file: the dog walking (and turned in its bed) from above, a pet bowl, a squeaky toy;
   the pet shop's things (a tin of cat food, a bag of dry food, kitty litter, a cat bed, a collar, a paw print);
   and (Tidy Paws's block, the very end) a broom, a dustpan and brush, and litter grains on the floor. */
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

/* ================= added for Pet Shop: things a pet shop sells, each seen from the front =================
   (its own block; the looks above are unchanged). Each stands on (x, y), the middle of its base, and draws its own
   soft shadow (shadow: false leaves it off). size scales the whole thing; outlines stay the house weights.
     GGThings.tin(c, x, y, { size (1 = about 60 wide, 68 tall), col (the label), fish (the fish's colour), shadow, ls })
         a tin of cat food with a fish on its label
     GGThings.foodBag(c, x, y, { size (1 = about 58 wide, 82 tall), col, shadow, ls })
         a bag of dry cat food, folded over at the top, with a bowl of kibble on the front
     GGThings.litter(c, x, y, { size (1 = about 64 wide, 78 tall), col, shadow, ls })
         a box of kitty litter with a carry handle, a paw print and a band of grains on the front
     GGThings.catBed(c, x, y, { w (about w * 0.43 tall), tall (stretches it upward, default 1), col, hollow, rim,
                     cat: fn(c) (drawn in the hollow, between the back of the bed and its front rim), shadow, ls })
         a round cat bed; with no colours it is Cosy Cubbies' cream bed. Without a cat it has a plump cushion in it
         (cushion: a colour, or false for an empty hollow)
     GGThings.collar(c, x, y, { size (1 = about 58 wide, 84 tall), col, bell (a colour, or false), shadow, ls })
         a cat collar stood up on its edge, the buckle at the top and a little bell at the bottom
     GGThings.paw(c, x, y, { r (about the print's half width), col })   a flat paw print (a pad and four toes), centred */
(function (T) {
  'use strict';
  var D = window.GGDraw, INK = D.INK, LW = D.LW, TAU = Math.PI * 2;
  function W(o, w, k) { return w / (((o && o.ls) || 1) * (k || 1)); }
  T.VARIANTS.tin = ['front']; T.VARIANTS.foodBag = ['front']; T.VARIANTS.litter = ['front']; T.VARIANTS.catBed = ['front']; T.VARIANTS.collar = ['front']; T.VARIANTS.paw = ['print'];
  function begin(c, x, y, o) { var s = o.size || 1; c.save(); c.translate(x, y); c.scale(s, s); return s; }

  T.paw = function (c, x, y, o) {
    o = o || {}; var r = o.r || 10;
    c.save(); c.fillStyle = o.col || INK;
    c.beginPath(); c.ellipse(x, y + r * 0.32, r * 0.58, r * 0.46, 0, 0, TAU); c.fill();
    [[-0.78, -0.18], [-0.3, -0.62], [0.3, -0.62], [0.78, -0.18]].forEach(function (t) { c.beginPath(); c.ellipse(x + t[0] * r, y + t[1] * r, r * 0.24, r * 0.29, t[0] * 0.5, 0, TAU); c.fill(); });
    c.restore();
  };

  T.tin = function (c, x, y, o) {
    o = o || {};
    var s = begin(c, x, y, o), col = o.col || '#FF6B8B', lm = W(o, LW.mid, s), lf = W(o, LW.fine, s), metal = '#DCD6E8';
    if (o.shadow !== false) D.shadow(c, 3, -1, 36, 7);
    var body = new Path2D(); body.moveTo(-30, -58); body.lineTo(-30, -7); body.ellipse(0, -7, 30, 7, 0, Math.PI, 0, true); body.lineTo(30, -58); body.ellipse(0, -58, 30, 8, 0, 0, Math.PI, false); body.closePath();
    D.shape(c, body, D.tone(c, metal, -66, 0), { lw: lm, depth: 0, inside: function (c) {
      var lab = new Path2D(); lab.moveTo(-31, -49); lab.ellipse(0, -49, 31, 7, 0, Math.PI, 0, true); lab.lineTo(31, -15); lab.ellipse(0, -15, 31, 7, 0, 0, Math.PI, false); lab.closePath();
      c.fillStyle = D.tone(c, col, -56, -8); c.fill(lab);
      c.strokeStyle = D.darker(col, 0.2); c.lineWidth = lf * 0.7; c.stroke(lab);
      c.beginPath(); c.ellipse(0, -31, 19, 11, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill();
      T.fish(c, 0, -31, { size: 0.95, col: o.fish || '#FFA94D', ls: (o.ls || 1) * s });
      c.strokeStyle = 'rgba(42,35,64,.18)'; c.lineWidth = lf * 0.7;
      c.beginPath(); c.ellipse(0, -10, 30, 7, 0, 0.2, Math.PI - 0.2); c.stroke();
      D.crescent(c, body, 6);
      D.shine(c, -21, -33, 3.5, 16, 0, 0.5);
    } });
    D.shape(c, D.ellPath(0, -58, 30, 8), D.lighter(metal, 0.3), { lw: lm, depth: 0, inside: function (c) {
      c.beginPath(); c.ellipse(0, -58, 23, 5.4, 0, 0, TAU); c.strokeStyle = 'rgba(42,35,64,.25)'; c.lineWidth = lf * 0.8; c.stroke();
      c.beginPath(); c.ellipse(9, -59, 6, 2.2, 0, 0, TAU); c.stroke();
    } });
    c.restore();
  };

  T.foodBag = function (c, x, y, o) {
    o = o || {};
    var s = begin(c, x, y, o), col = o.col || '#FF9A4D', lm = W(o, LW.mid, s), lf = W(o, LW.fine, s);
    if (o.shadow !== false) D.shadow(c, 3, -1, 34, 6);
    var body = new Path2D(); body.moveTo(-25, -70); body.lineTo(25, -70); body.lineTo(29, -6); body.quadraticCurveTo(29, 0, 23, 0); body.lineTo(-23, 0); body.quadraticCurveTo(-29, 0, -29, -6); body.closePath();
    D.shape(c, body, D.tone(c, col, -70, 0), { lw: lm, depth: 7, inside: function (c) {
      c.fillStyle = 'rgba(42,35,64,.08)'; c.beginPath(); c.moveTo(17, -70); c.lineTo(25, -70); c.lineTo(29, 0); c.lineTo(20, 0); c.closePath(); c.fill();
      D.shape(c, D.rrPath(-19, -57, 38, 40, 12), D.lighter(col, 0.78), { lw: lf, depth: 0 });
      T.bowl(c, 0, -37, { r: 14, col: '#7CC4FF', food: 'kibble', ls: (o.ls || 1) * s * 1.4 });
      D.shine(c, -18, -62, 6, 3, -0.3, 0.45);
    } });
    var top = new Path2D(); top.moveTo(-25, -69); top.lineTo(-25, -78);
    for (var i = 0; i < 6; i++) { top.lineTo(-25 + i * 50 / 6 + 25 / 6, -82); top.lineTo(-25 + (i + 1) * 50 / 6, -78); }
    top.lineTo(25, -69); top.closePath();
    D.shape(c, top, D.darker(col, 0.14), { lw: lf, depth: 0, inside: function (c) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-26, -75, 52, 2.5); } });
    c.restore();
  };

  T.litter = function (c, x, y, o) {
    o = o || {};
    var s = begin(c, x, y, o), col = o.col || '#4FC3B8', lm = W(o, LW.mid, s), lf = W(o, LW.fine, s), sand = '#F3E2BE';
    if (o.shadow !== false) D.shadow(c, 3, -1, 38, 6);
    // the handle starts inside the box, which covers its base
    var tab = new Path2D(); tab.moveTo(-17, -58); tab.lineTo(-13, -75); tab.quadraticCurveTo(0, -80, 13, -75); tab.lineTo(17, -58); tab.closePath();
    D.shape(c, tab, D.darker(col, 0.12), { lw: lf, depth: 0, inside: function (c) { D.rr(c, -8, -73, 16, 6, 3); c.fillStyle = 'rgba(42,35,64,.55)'; c.fill(); } });
    var box = D.rrPath(-32, -62, 64, 62, 7);
    D.shape(c, box, D.tone(c, col, -62, 0), { lw: lm, depth: 0, inside: function (c) {
      c.fillStyle = sand; c.fillRect(-33, -16, 66, 17);
      c.strokeStyle = D.darker(sand, 0.2); c.lineWidth = lf * 0.8; c.beginPath(); c.moveTo(-33, -16); c.lineTo(33, -16); c.stroke();
      var r = D.seeded(7); c.fillStyle = D.darker(sand, 0.22);
      for (var i = 0; i < 16; i++) { c.beginPath(); c.arc(-28 + r() * 56, -12 + r() * 9, 1.5 + r() * 1.2, 0, TAU); c.fill(); }
      c.beginPath(); c.arc(0, -38, 17, 0, TAU); c.fillStyle = 'rgba(255,255,255,.88)'; c.fill();
      T.paw(c, 0, -37, { r: 12, col: D.darker(col, 0.25) });
      D.crescent(c, box, 6);
      D.shine(c, -22, -52, 6, 3, -0.4, 0.45);
    } });
    c.restore();
  };

  T.catBed = function (c, x, y, o) {
    o = o || {};
    // v is the vertical unit: `tall` stretches the bed up from its base (a deeper bed that reads well when small)
    var w = o.w || 100, s = w / 1.12, v = s * (o.tall || 1), cy = y - v * 0.54, lw = W(o, LW.big);
    var col = o.col || '#F2DCC3', hollow = o.hollow || (o.col ? D.darker(col, 0.16) : '#E2C2A2'), rim = o.rim || (o.col ? D.lighter(col, 0.32) : '#F7E6D2');
    if (o.shadow !== false) D.shadow(c, x + 3, y - s * 0.01, s * 0.6, s * 0.07);
    // the back of the bed, with its hollow
    D.shape(c, D.ellPath(x, cy + v * 0.3, s * 0.56, v * 0.24), D.tone(c, col, cy + v * 0.06, cy + v * 0.54), { lw: lw, depth: 0, inside: function (c) {
      c.beginPath(); c.ellipse(x, cy + v * 0.32, s * 0.44, v * 0.15, 0, 0, TAU); c.fillStyle = hollow; c.fill();
    } });
    if (o.cat) o.cat(c);
    else if (o.cushion !== false) {
      // an empty bed has a plump cushion in its hollow, with a paw print on it
      var cu = o.cushion || D.lighter(col, 0.55);
      D.shape(c, D.ellPath(x, cy + v * 0.22, s * 0.42, v * 0.15), D.tone(c, cu, cy + v * 0.07, cy + v * 0.37), { lw: W(o, LW.fine), depth: v * 0.04, inside: function (c) {
        T.paw(c, x + s * 0.02, cy + v * 0.18, { r: Math.min(s, v) * 0.09, col: D.darker(cu, 0.2) });
      }, shine: [x - s * 0.2, cy + v * 0.13, s * 0.1, v * 0.03, -0.2, 0.6] });
    }
    // the front rim, tucked over whatever lies in it
    D.shape(c, function (p) {
      p.moveTo(x - s * 0.56, cy + v * 0.3);
      p.bezierCurveTo(x - s * 0.5, cy + v * 0.62, x + s * 0.5, cy + v * 0.62, x + s * 0.56, cy + v * 0.3);
      p.bezierCurveTo(x + s * 0.4, cy + v * 0.44, x - s * 0.4, cy + v * 0.44, x - s * 0.56, cy + v * 0.3);
      p.closePath();
    }, D.tone(c, rim, cy + v * 0.3, cy + v * 0.54), { lw: lw, depth: v * 0.05, shine: [x - s * 0.3, cy + v * 0.42, s * 0.1, v * 0.025, 0.25, 0.6] });
  };

  T.collar = function (c, x, y, o) {
    o = o || {};
    var s = begin(c, x, y, o), col = o.col || '#FF5C8A', lm = W(o, LW.mid, s), lf = W(o, LW.fine, s), bell = o.bell === false ? null : (o.bell || '#FFC93C');
    if (o.shadow !== false) D.shadow(c, 3, -1, 26, 5);
    var band = new Path2D(); band.arc(0, -48, 28, 0, TAU); band.moveTo(19, -48); band.arc(0, -48, 19, 0, TAU, true);
    D.shape(c, band, D.tone(c, col, -76, -20), { lw: lm, depth: 4, inside: function (c) {
      c.beginPath(); c.arc(0, -48, 23.5, 0, TAU); c.setLineDash([3.5, 4.5]); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = lf * 0.7; c.stroke(); c.setLineDash([]);
    }, shine: [-17, -66, 6, 3, -0.7, 0.5] });
    D.shape(c, D.rrPath(-10, -84, 20, 15, 4), D.tone(c, '#FFD23F', -84, -69), { lw: lf, depth: 0, inside: function (c) { D.rr(c, -5, -80, 10, 7, 2); c.fillStyle = D.darker(col, 0.1); c.fill(); } });
    if (bell) D.shape(c, D.ellPath(0, -11, 11, 11), D.tone(c, bell, -22, 0), { lw: lf, depth: 3, inside: function (c) {
      c.beginPath(); c.moveTo(-7, -8); c.lineTo(7, -8); c.strokeStyle = INK; c.lineWidth = lf * 0.8; c.stroke();
      c.beginPath(); c.arc(0, -4, 2, 0, TAU); c.fillStyle = INK; c.fill();
    }, shine: [-4, -16, 3.5, 2, -0.5, 0.6] });
    c.restore();
  };
})(window.GGThings);

/* ================= added for Tidy Paws: a broom, a dustpan and brush, and cat litter =================
   (its own block; the looks above are unchanged)
     GGThings.broom(c, x, y, { view: 'top' | 'front', size (1 = the bristles about 100 across), a (top: the way it
                    pushes, radians; front: a lean), sweep (0..1, the bristles bent back as it pushes), col (the
                    binding), straw (the bristles), stick (the handle), ls })
         top: (x, y) the middle of the bristles' front edge, the handle trailing behind; front: stood on its bristles,
         (x, y) where they touch the floor, about 240 tall
     GGThings.dustpan(c, x, y, { view: 'top' | 'front', size (1 = the pan about 80 across), a (top: the way its mouth
                      faces), fill (0..1, litter in the pan), col, brush (default true: the hand brush with it),
                      flick (0..1, the brush swept in towards the mouth), full (true: the heap glows a little), ls })
         top: (x, y) the middle of the pan's mouth (its front lip); front: the lip on the floor at (x, y)
     GGThings.litterGrains(c, grains, { r (a grain's size, default 4), cols: [...], glow (0..1, a soft gold glow behind each
                     grain, to find the last few), ls })
         cat litter on the floor: grains is a list of { x, y, z (height while flying: drawn up off its shadow), k (a
         0..1 random, for its colour and shape), s (size, default 1) }. Grains next to each other share one outline,
         so a swept pile reads as one heap. */
(function (T) {
  'use strict';
  var D = window.GGDraw, INK = D.INK, LW = D.LW, TAU = Math.PI * 2;
  function W(o, w, k) { return w / (((o && o.ls) || 1) * (k || 1)); }
  function turned(dep, a) { var x = -0.7 * dep, y = -dep, cs = Math.cos(-a), sn = Math.sin(-a); return { dx: x * cs - y * sn, dy: x * sn + y * cs }; }
  function stick(c, x0, y0, x1, y1, w, col, lf) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = w + lf * 2; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  var SANDS = ['#E8D3A8', '#D6BC8C', '#F3E6C8', '#CBAF80'];
  T.VARIANTS.broom = ['top', 'front']; T.VARIANTS.dustpan = ['top', 'front']; T.VARIANTS.litterGrains = ['scattered'];

  T.broom = function (c, x, y, o) {
    o = o || {};
    var s = o.size || 1, col = o.col || '#FF6B57', straw = o.straw || '#F5C75E', wood = o.stick || '#C98B5B', lm = W(o, LW.mid, s), lf = W(o, LW.fine, s);
    var bend = Math.max(0, Math.min(1, o.sweep || 0)) * 8;
    c.save(); c.translate(x, y);
    if (o.view === 'front') {
      c.rotate(o.a || 0); c.scale(s, s);
      D.shadow(c, 0, 2, 56, 7);
      stick(c, 0, -60, 0, -236, 10, wood, lf);
      D.shape(c, D.ellPath(0, -238, 8, 8), D.darker(wood, 0.15), { lw: lf, depth: 0 });
      D.shape(c, function (p) { p.moveTo(-26, -66); p.lineTo(26, -66); p.lineTo(50, 0); for (var i = 0; i < 10; i++) p.quadraticCurveTo(45 - i * 10, 7, 40 - i * 10, 0); p.closePath(); }, D.tone(c, straw, -66, 0), { lw: lm, depth: 6, inside: function (c) {
        c.strokeStyle = D.darker(straw, 0.25); c.lineWidth = W(o, 2, s); for (var k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(k * 5, -60); c.lineTo(k * 10, -4); c.stroke(); }
      } });
      D.shape(c, D.rrPath(-30, -78, 60, 16, 6), col, { lw: lm, depth: 3, inside: function (c) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-30, -76, 60, 4); } });
      c.restore(); return;
    }
    var a = o.a || 0; c.rotate(a); c.scale(s, s);
    // the handle trails back from the binding (towards the hands), then the bristles, then the binding over their roots
    stick(c, -22, 0, -110, 0, 10, wood, lf);
    D.shape(c, D.ellPath(-112, 0, 7, 7), D.darker(wood, 0.15), { lw: lf, depth: 0 });
    var tb = turned(5, a);
    D.shape(c, function (p) {
      p.moveTo(-14, -44); p.lineTo(-bend, -50 - bend * 0.5);
      for (var i = 0; i < 10; i++) { var y0 = -50 - bend * 0.5 + i * (100 + bend) / 10, y1 = y0 + (100 + bend) / 10; p.quadraticCurveTo(6 - bend + (i % 2) * 2, (y0 + y1) / 2, -bend, y1); }
      p.lineTo(-14, 44); p.closePath();
    }, D.tone(c, straw, -50, 50), { lw: lm, depth: 1, dx: tb.dx, dy: tb.dy, inside: function (c) {
      c.strokeStyle = D.darker(straw, 0.25); c.lineWidth = W(o, 2, s); for (var k = -40; k <= 40; k += 10) { c.beginPath(); c.moveTo(-14, k * 0.9); c.lineTo(-bend + 2, k * (1 + bend / 100)); c.stroke(); }
    } });
    var tc = turned(3, a);
    D.shape(c, D.rrPath(-26, -40, 14, 80, 6), col, { lw: lm, depth: 1, dx: tc.dx, dy: tc.dy, inside: function (c) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-24, -40, 4, 80); } });
    c.restore();
  };

  function heap(c, cx, cy, rx, ry, fill, o, s, glow) {
    if (fill <= 0) return;
    var hx = rx * (0.35 + 0.65 * Math.sqrt(fill)), hy = ry * (0.35 + 0.65 * Math.sqrt(fill)), r = D.seeded(11);
    if (glow) { c.save(); c.fillStyle = 'rgba(255,226,120,.55)'; c.beginPath(); c.ellipse(cx, cy, hx + 6, hy + 6, 0, 0, TAU); c.fill(); c.restore(); }
    D.shape(c, function (p) { for (var i = 0; i <= 24; i++) { var t = i / 24 * TAU, wob = 1 + 0.08 * Math.sin(t * 7); var px = cx + Math.cos(t) * hx * wob, py = cy + Math.sin(t) * hy * wob; if (i) p.lineTo(px, py); else p.moveTo(px, py); } p.closePath(); }, SANDS[0], { lw: W(o, 2.5, s), depth: 3, inside: function (c) {
      for (var i = 0; i < 26; i++) { c.fillStyle = i % 3 ? SANDS[1] : '#FFFFFF'; c.beginPath(); c.arc(cx + (r() - 0.5) * hx * 1.8, cy + (r() - 0.5) * hy * 1.8, 2.2, 0, TAU); c.fill(); }
    } });
  }
  function handBrush(c, x, y, rot, o, s, lm, lf) {
    c.save(); c.translate(x, y); c.rotate(rot);
    // seen from above, its bristles facing -x (towards the pan): the wooden back, the handle out to one side
    stick(c, 0, -26, 0, -62, 9, '#C98B5B', lf);
    D.shape(c, D.rrPath(-15, -36, 8, 72, 3), '#F5C75E', { lw: lf, depth: 0, inside: function (c) { c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = W(o, 1.5, s); for (var k = -30; k <= 30; k += 6) { c.beginPath(); c.moveTo(-15, k); c.lineTo(-7, k); c.stroke(); } } });
    D.shape(c, D.rrPath(-9, -38, 18, 76, 8), '#E0A15E', { lw: lm, depth: 3, inside: function (c) { c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-7, -38, 4, 76); } });
    c.restore();
  }
  T.dustpan = function (c, x, y, o) {
    o = o || {};
    var s = o.size || 1, col = o.col || '#B48CFF', fill = Math.max(0, Math.min(1, o.fill || 0)), lm = W(o, LW.mid, s), lf = W(o, LW.fine, s);
    var flick = Math.max(0, Math.min(1, o.flick || 0));
    c.save(); c.translate(x, y);
    if (o.view === 'front') {
      c.scale(s, s);
      D.shadow(c, 0, 2, 50, 6);
      stick(c, 0, -40, 0, -96, 12, D.darker(col, 0.15), lf);
      D.shape(c, D.rrPath(-40, -50, 80, 30, 8), D.tone(c, D.darker(col, 0.12), -50, -20), { lw: lm, depth: 3 });
      D.shape(c, function (p) { p.moveTo(-40, -26); p.lineTo(40, -26); p.lineTo(46, 0); p.lineTo(-46, 0); p.closePath(); }, D.lighter(col, 0.35), { lw: lm, depth: 0 });
      if (fill > 0) heap(c, 0, -12, 34, 10, fill, o, s, o.full);
      D.shape(c, D.rrPath(-48, -5, 96, 8, 4), '#9C97AE', { lw: lf, depth: 0 });
      if (o.brush !== false) {
        c.save(); c.translate(64, 0); c.rotate(0.25);
        stick(c, 0, -40, 0, -80, 9, '#C98B5B', lf);
        D.shape(c, D.rrPath(-12, -46, 24, 28, 8), '#E0A15E', { lw: lm, depth: 3 });
        D.shape(c, function (p) { p.moveTo(-12, -20); p.lineTo(12, -20); p.lineTo(15, 0); p.lineTo(-15, 0); p.closePath(); }, '#F5C75E', { lw: lf, depth: 0 });
        c.restore();
      }
      c.restore(); return;
    }
    var a = o.a || 0; c.rotate(a); c.scale(s, s);
    // the handle out of the back, the pan, its floor, the litter in it, the rubber lip along the mouth
    stick(c, -40, 0, -84, 0, 13, D.darker(col, 0.15), lf);
    D.shape(c, D.ellPath(-76, 0, 3.5, 3.5), INK, { lw: 0, depth: 0 });
    var tp = turned(6, a);
    var pan = function (p) { p.moveTo(0, -42); p.lineTo(-30, -42); p.quadraticCurveTo(-46, -42, -46, -26); p.lineTo(-46, 26); p.quadraticCurveTo(-46, 42, -30, 42); p.lineTo(0, 42); p.closePath(); };
    D.shape(c, pan, D.tone(c, col, -42, 42), { lw: lm, depth: 1, dx: tp.dx, dy: tp.dy });
    D.shape(c, function (p) { p.moveTo(0, -35); p.lineTo(-28, -35); p.quadraticCurveTo(-38, -35, -38, -24); p.lineTo(-38, 24); p.quadraticCurveTo(-38, 35, -28, 35); p.lineTo(0, 35); p.closePath(); }, D.lighter(col, 0.4), { lw: lf, depth: 0, inside: function (c) {
      heap(c, -18, 0, 18, 30, fill, o, s, o.full);
    } });
    D.shape(c, D.rrPath(-3, -44, 9, 88, 4), '#9C97AE', { lw: lf, depth: 0 });
    if (o.brush !== false) handBrush(c, 58 - flick * 22, 6, -0.12 + flick * 0.1, o, s, lm, lf);
    c.restore();
  };

  T.litterGrains = function (c, grains, o) {
    o = o || {};
    if (!grains || !grains.length) return;
    var r = o.r || 4, cols = o.cols || SANDS, lw = W(o, 1.6), i, g;
    // flying grains: a shadow on the floor under each
    c.save(); c.fillStyle = 'rgba(42,35,64,.18)'; c.beginPath();
    for (i = 0; i < grains.length; i++) { g = grains[i]; if (g.z > 0.5) { var sr = r * (g.s || 1) * Math.max(0.4, 1 - g.z / (r * 30)); c.moveTo(g.x + sr, g.y + r * 0.4); c.ellipse(g.x, g.y + r * 0.4, sr, sr * 0.6, 0, 0, TAU); } }
    c.fill(); c.restore();
    if (o.glow) {
      c.save(); c.globalAlpha = Math.min(1, o.glow); c.fillStyle = 'rgba(255,214,90,.55)'; c.beginPath();
      for (i = 0; i < grains.length; i++) { g = grains[i]; c.moveTo(g.x + r * 3.2, g.y - (g.z || 0)); c.arc(g.x, g.y - (g.z || 0), r * 3.2, 0, TAU); }
      c.fill(); c.restore();
    }
    var all = new Path2D(), byCol = cols.map(function () { return new Path2D(); }), hi = new Path2D();
    for (i = 0; i < grains.length; i++) {
      g = grains[i];
      var k = g.k || 0, gs = r * (g.s || 1), gx = g.x, gy = g.y - (g.z || 0), rx = gs * (1 + k * 0.25), ry = gs * (0.85 - k * 0.1), rot = k * 6;
      all.moveTo(gx + rx, gy); all.ellipse(gx, gy, rx, ry, rot, 0, TAU);
      var pc = byCol[Math.floor(k * 997) % cols.length]; pc.moveTo(gx + rx, gy); pc.ellipse(gx, gy, rx, ry, rot, 0, TAU);
      if (gs > 2.5) { hi.moveTo(gx - gs * 0.2, gy - gs * 0.32); hi.arc(gx - gs * 0.38, gy - gs * 0.32, gs * 0.18, 0, TAU); }
    }
    c.save(); c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = lw * 2; c.stroke(all);
    byCol.forEach(function (p, j) { c.fillStyle = cols[j]; c.fill(p); });
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fill(hi); c.restore();
  };
})(window.GGThings);
