/* Cosy Home – a room to decorate with things you've grown, made and earned.
   - Plants are grown on the potting bench (Grow): pick a pot and a seed, fill with soil, plant, water, sunshine.
     More seeds unlock as you grow more plants.
   - Things are earned by playing the other games (reach a level, cook dishes).
   - Dishes from Cosy Kitchen appear once the shared collection exists (GG.collection + GGDish, both optional).
   Drag anything from the drawer into the room; it settles onto the nearest shelf, sill, table or the floor
   (pictures and clocks hang anywhere on the wall). Drag it back down to the drawer to put it away.
   Your own avatar cat lives here. Nothing to win or lose. Saves to GG.setProgress('home', ...). */
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
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ink(c, w) { c.lineWidth = w || 4; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }

  /* ================= catalogue ================= */
  var FLOWER = ['#FF5A7A', '#FFD23F', '#B48CFF', '#FF9F43', '#FFFFFF', '#5DB8FF'];
  var POTS = [
    { fill: '#E58B5B', dark: '#B9623A', deco: 'band' },
    { fill: '#FF9EC4', dark: '#E8558E', deco: 'dots' },
    { fill: '#7CC4FF', dark: '#3B8FD6', deco: 'stripes' },
    { fill: '#FFD93F', dark: '#C9A20C', deco: 'dots' },
    { fill: '#FFFFFF', dark: '#D9D3E6', deco: 'cat' },
    { fill: '#7BD389', dark: '#3E9E58', deco: 'stripes' }
  ];
  /* `grown` = how many plants you need to have grown before this seed appears */
  var PLANTS = [
    { id: 'catnip', name: 'Catnip', colour: true, h: 125, grown: 0 },
    { id: 'tulip', name: 'Tulips', colour: true, h: 150, grown: 0 },
    { id: 'cactus', name: 'Cactus', colour: true, h: 125, grown: 0 },
    { id: 'sunflower', name: 'Sunflower', h: 215, grown: 1 },
    { id: 'catgrass', name: 'Cat grass', h: 130, grown: 2 },
    { id: 'lavender', name: 'Lavender', h: 155, grown: 3 },
    { id: 'lemon', name: 'Lemon tree', h: 205, grown: 5 },
    { id: 'shroom', name: 'Glow mushrooms', colour: true, h: 120, grown: 7 }
  ];
  /* Things: some to start with, the rest earned in the other games (read from their saves). */
  var THINGS = [
    { id: 'rug', name: 'Rug', floor: true, flat: true, w: 300, h: 40 },
    { id: 'lamp', name: 'Lamp', floor: true, w: 90, h: 250 },
    { id: 'picture', name: 'My cat picture', wall: true, w: 120, h: 130 },
    { id: 'clock', name: 'Clock', wall: true, w: 100, h: 110 },
    { id: 'yarnbasket', name: 'Yarn basket', w: 110, h: 90, need: { save: 'yarn', level: 3, text: 'Reach level 3 in Yarn Sort' } },
    { id: 'giantyarn', name: 'Giant yarn ball', floor: true, w: 120, h: 115, need: { save: 'yarn', level: 6, text: 'Reach level 6 in Yarn Sort' } },
    { id: 'catbed', name: 'Cat bed', floor: true, w: 170, h: 75, need: { save: 'cubbies', level: 3, text: 'Reach level 3 in Cosy Cubbies' } },
    { id: 'scratch', name: 'Scratching post', floor: true, w: 110, h: 215, need: { save: 'cubbies', level: 6, text: 'Reach level 6 in Cosy Cubbies' } },
    { id: 'cushions', name: 'Cushions', w: 120, h: 80, need: { save: 'kittypop', level: 3, text: 'Reach level 3 in Kitty Pop' } },
    { id: 'fishbowl', name: 'Fish bowl', w: 100, h: 110, need: { save: 'kittypop', level: 6, text: 'Reach level 6 in Kitty Pop' } },
    { id: 'teapot', name: 'Teapot', w: 100, h: 85, need: { save: 'cooking', made: 1, text: 'Cook a dish in Cosy Kitchen' } },
    { id: 'cake', name: 'Cake stand', w: 100, h: 125, need: { save: 'cooking', made: 5, text: 'Cook 5 dishes in Cosy Kitchen' } }
  ];
  var WALLS = [
    { wall: '#FFE7C2', pat: '#FFD9A3' }, { wall: '#FFD9E4', pat: '#FFC2D4' }, { wall: '#D7F2DF', pat: '#BFE8CB' },
    { wall: '#D9ECFF', pat: '#C0DEFF' }, { wall: '#E8DDFF', pat: '#D7C7FF' }, { wall: '#FFF3B8', pat: '#FFE88A' },
    { wall: '#FFFFFF', pat: '#F1EAF8' }, { wall: '#FFD3C4', pat: '#FFBCA6' }, { wall: '#CDEFF0', pat: '#AEE3E5' }, { wall: '#5E5675', pat: '#6E6687' }
  ];
  function findDef(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function thingUnlocked(t) {
    if (!t.need) return true;
    var p = {};
    try { p = GG.getProgress(t.need.save) || {}; } catch (e) {}
    if (t.need.level) return (p.level || 1) >= t.need.level;
    if (t.need.made) return (p.made || 0) >= t.need.made;
    return false;
  }

  /* ================= saved state ================= */
  function blank() { return { v: 1, plants: [], placed: [], wall: 0, next: 1, grown: 0 }; }
  var S = (function () {
    var p = {};
    try { p = GG.getProgress('home') || {}; } catch (e) {}
    var b = blank();
    if (!Array.isArray(p.plants)) p.plants = b.plants;
    if (!Array.isArray(p.placed)) p.placed = b.placed;
    if (typeof p.wall !== 'number') p.wall = b.wall;
    if (typeof p.next !== 'number') p.next = p.plants.length + 1;
    if (typeof p.grown !== 'number') p.grown = p.plants.length;
    p.v = 1;
    return p;
  })();
  function save() { try { GG.setProgress('home', S); } catch (e) {} }

  /* ---------- dishes (only once the shared collection and dish drawing exist) ---------- */
  /* pictures finished in Colour Me (read from its save, through its shared pages.js) */
  function colourPics() { if (!window.ColourPages) return []; return ColourPages.pictures().filter(function (p) { return p && p.done; }); }
  function PAGE_NAME(id) { try { return ColourPages.get(id).name; } catch (e) { return 'My picture'; } }
  var DISH_NAMES = { handroll: 'Hand roll', pancakes: 'Pancakes', burger: 'Burger' };
  function dishesReady() { return !!(window.GG && typeof GG.collection === 'function' && window.GGDish && typeof GGDish.draw === 'function'); }
  function dishList() { if (!dishesReady()) return []; try { return GG.collection({ type: 'dish' }) || []; } catch (e) { return []; } }

  /* Every item in the room or drawer has a uid: 'p<n>' a plant, 't-<id>' a thing, 'd-<uid>' a dish. */
  function resolve(u) {
    if (!u) return null;
    if (u.charAt(0) === 'p') {
      for (var i = 0; i < S.plants.length; i++) if ('p' + S.plants[i].id === u) {
        var pl = S.plants[i], d = findDef(PLANTS, pl.t);
        if (d) return { u: u, kind: 'plant', def: d, data: pl, w: 100, h: d.h };
      }
      return null;
    }
    if (u.indexOf('t-') === 0) { var t = findDef(THINGS, u.slice(2)); return t && thingUnlocked(t) ? { u: u, kind: 'thing', def: t, w: t.w, h: t.h } : null; }
    if (u.indexOf('c-') === 0) {
      var pics = colourPics();
      for (var k = 0; k < pics.length; k++) if ('c-' + pics[k].id === u) return { u: u, kind: 'picture', def: { name: PAGE_NAME(pics[k].page), wall: true }, data: pics[k], w: 120, h: 138 };
      return null;
    }
    if (u.indexOf('d-') === 0) {
      var list = dishList();
      for (var j = 0; j < list.length; j++) if ('d-' + list[j].uid === u) return { u: u, kind: 'dish', def: { name: DISH_NAMES[list[j].id] || 'Dish' }, data: list[j], w: 110, h: 60 };
      return null;
    }
    return null;
  }
  function isPlaced(u) { for (var i = 0; i < S.placed.length; i++) if (S.placed[i].u === u) return true; return false; }

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
      scoop: function () { noise({ type: 'lowpass', freq: 380, q: 1, attack: 0.01, dur: 0.12, gain: 0.25 }); },
      drip: function () { tone({ f: rand(900, 1400), to: rand(400, 600), dur: 0.05, gain: 0.04 }); },
      poke: function () { noise({ type: 'lowpass', freq: 300, dur: 0.06, gain: 0.2 }); tone({ f: 500, to: 300, dur: 0.06, gain: 0.06, type: 'triangle' }); },
      grow: function (i) { var f = [523.25, 659.25, 783.99, 1046.5][Math.min(3, i)]; tone({ f: f * 0.7, to: f, dur: 0.14, gain: 0.1, slide: 0.08 }); },
      chime: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 }); tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' }); }); },
      purr: function () { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.22, delay: i * 0.085 }); },
      mrrp: function () { var p = rand(0.9, 1.2); tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', delay: 0.1, slide: 0.12 }); },
      brush: function () { noise({ freq: 1600, q: 0.6, attack: 0.04, dur: 0.18, gain: 0.08 }); }
    };
  })();

  /* ================= the player's cat =================
     The body is the shared cat with the same options the avatar uses; the head is the avatar picture itself
     (without its round background), laid over the body's head, so colours, hats, hair and glasses all match. */
  var CAT = { preset: 'ginger' }, catImg = null, catKey = '';
  function catSetup() {
    var p = null;
    try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) { CAT = { preset: 'ginger' }; catImg = null; catKey = ''; return; }
    var av = GGAvatar.normalise(p.avatar, p.color);
    var key = JSON.stringify(av);
    if (key === catKey) return;
    catKey = key;
    CAT = {
      color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none',
      eyes: 'happy', mouth: 'w', hat: av.head === 'chef' ? 'chef' : 'none',
      noEyes: av.face === 'sunglasses', noMouth: av.face === 'moustache' || av.face === 'beard', noCheeks: av.face === 'cheeks',
      eyeColor: av.face === 'mask' ? '#FFF8EC' : undefined
    };
    try {
      var svg = GGAvatar.svg(av, 240)
        .replace(/<circle cx="60" cy="60" r="57"[^>]*\/>/, '')
        .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      var img = new Image();
      img.onload = function () { catImg = img; };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch (e) { catImg = null; }
  }
  catSetup();
  // the avatar picture is 120 wide with the cat's head centred at (60, 66.36), 68 wide
  function drawAvatarHead(c, x, y, size) {
    if (!catImg) return;
    var k = size / 68;
    c.drawImage(catImg, x - 60 * k, y - 66.36 * k, 120 * k, 120 * k);
  }
  function drawCatPose(c, pose, face, size) {
    var o = {}; for (var k in CAT) o[k] = CAT[k];
    o.pose = pose; o.face = face; o.size = size;
    try { GGCat.draw(c, o); } catch (e) {}
    if (pose === 'sit') drawAvatarHead(c, 0, 0, size);
    else if (pose === 'lie') drawAvatarHead(c, 30 * size / 88, 2 * size / 88, size * 0.78);
  }

  /* ================= drawing plants, pots, things ================= */
  function drawPot(c, pot, w) {
    var P = POTS[pot] || POTS[0];
    var h = w * 0.62, top = -h;
    c.save();
    c.beginPath(); c.moveTo(-w * 0.5, top + h * 0.18); c.lineTo(-w * 0.38, 0); c.lineTo(w * 0.38, 0); c.lineTo(w * 0.5, top + h * 0.18); c.closePath();
    c.fillStyle = P.fill; c.fill();
    c.save(); c.clip();
    c.fillStyle = P.dark;
    if (P.deco === 'dots') for (var i = -2; i <= 2; i++) { circle(c, i * w * 0.18, top + h * 0.6 + (i % 2) * h * 0.12, w * 0.05); c.fill(); }
    if (P.deco === 'stripes') for (var j = 0; j < 3; j++) c.fillRect(-w, top + h * (0.4 + j * 0.2), w * 2, h * 0.07);
    if (P.deco === 'band') c.fillRect(-w, top + h * 0.55, w * 2, h * 0.12);
    if (P.deco === 'cat') {
      c.strokeStyle = INK; c.lineWidth = w * 0.03; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-w * 0.14, top + h * 0.56); c.quadraticCurveTo(-w * 0.1, top + h * 0.5, -w * 0.06, top + h * 0.56);
      c.moveTo(w * 0.06, top + h * 0.56); c.quadraticCurveTo(w * 0.1, top + h * 0.5, w * 0.14, top + h * 0.56); c.stroke();
      c.beginPath(); c.moveTo(-w * 0.05, top + h * 0.68); c.quadraticCurveTo(-w * 0.025, top + h * 0.74, 0, top + h * 0.68); c.quadraticCurveTo(w * 0.025, top + h * 0.74, w * 0.05, top + h * 0.68); c.stroke();
      c.fillStyle = 'rgba(255,120,160,.5)'; ell(c, -w * 0.22, top + h * 0.66, w * 0.05, w * 0.03); c.fill(); ell(c, w * 0.22, top + h * 0.66, w * 0.05, w * 0.03); c.fill();
    }
    c.restore();
    c.beginPath(); c.moveTo(-w * 0.5, top + h * 0.18); c.lineTo(-w * 0.38, 0); c.lineTo(w * 0.38, 0); c.lineTo(w * 0.5, top + h * 0.18); c.closePath(); ink(c, Math.max(2, w * 0.04));
    // rim
    rr(c, -w * 0.56, top, w * 1.12, h * 0.22, h * 0.08); c.fillStyle = P.fill; c.fill(); ink(c, Math.max(2, w * 0.04));
    c.restore();
    return h;
  }
  function leaf(c, x, y, len, ang, col) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); c.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); c.closePath();
    c.fillStyle = col || '#5CCB75'; c.fill(); ink(c, 2.5);
    c.restore();
  }
  function stem(c, x0, y0, x1, y1, w) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (x1 - x0) * 0.3, (y0 + y1) / 2, x1, y1); c.lineWidth = (w || 5) + 3; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = w || 5; c.strokeStyle = '#4FB868'; c.stroke(); }
  /* the soil showing in the mouth of the pot (drawn after the pot, before the plant) */
  function soil(c, w, amount) {
    var h = w * 0.62; amount = amount === undefined ? 1 : amount;
    if (amount <= 0) return;
    ell(c, 0, -h + h * 0.08, w * 0.5 * (0.55 + 0.45 * amount), h * 0.1); c.fillStyle = '#7A4E2D'; c.fill();
    c.fillStyle = '#5E3A1F'; circle(c, -w * 0.18, -h + h * 0.07, w * 0.025); c.fill(); circle(c, w * 0.14, -h + h * 0.1, w * 0.02); c.fill();
  }
  /* the front half of the pot's rim, drawn over the bottom of the plant so the stems go into the soil */
  function potLip(c, pot, w) {
    var P = POTS[pot] || POTS[0], h = w * 0.62;
    c.save();
    c.beginPath(); c.rect(-w, -h + h * 0.12, w * 2, h * 0.3); c.clip();
    rr(c, -w * 0.56, -h, w * 1.12, h * 0.22, h * 0.08); c.fillStyle = P.fill; c.fill(); ink(c, Math.max(2, w * 0.04));
    c.restore();
  }
  function drawPotted(c, pl, g, t, soilAmount) {
    drawPot(c, pl.pot, 92);
    soil(c, 92, soilAmount);
    drawPlant(c, pl, g, t);
    potLip(c, pl.pot, 92);
  }

  /* A potted plant, bottom centre at (0,0). g = how grown it is (0 nothing, 1 full). */
  function drawPlant(c, pl, g, t) {
    var d = findDef(PLANTS, pl.t) || PLANTS[0];
    var w = 92;
    var col = FLOWER[pl.col || 0];
    g = g === undefined ? 1 : g;
    t = t || 0;
    var potH = w * 0.62;
    c.save();
    // plants drawn first, pot rim drawn over their base
    c.save();
    c.translate(0, -potH + potH * 0.1);
    var sway = Math.sin(t * 1.3 + (pl.id || 0)) * 0.03;
    c.rotate(sway);
    var gg = easeOut(g);
    if (gg > 0.01) {
      c.scale(gg, gg);
      ({
        catnip: function () {
          [[-26, -18, -2.4], [24, -16, -0.7], [-14, -40, -2.0], [14, -42, -1.1], [0, -56, -1.57], [-30, -42, -2.7], [30, -40, -0.4]].forEach(function (L) { leaf(c, 0, -6, Math.hypot(L[0], L[1]) + 16, L[2], '#6BD58A'); });
          if (g > 0.7) [[-18, -66], [6, -74], [24, -60]].forEach(function (p) { for (var i = 0; i < 4; i++) { circle(c, p[0], p[1] + i * 7, 4.5); c.fillStyle = col === '#FFFFFF' ? '#E9DDFF' : col; c.fill(); ink(c, 1.8); } });
        },
        tulip: function () {
          [[-22, -96], [0, -118], [22, -100]].forEach(function (p, i) {
            stem(c, p[0] * 0.3, 0, p[0], p[1], 5);
            leaf(c, p[0] * 0.3, -14, 38, i === 1 ? -1.9 : (i ? -0.6 : -2.5), '#5CCB75');
            c.save(); c.translate(p[0], p[1]);
            c.beginPath(); c.moveTo(-15, -6); c.lineTo(-15, -26); c.lineTo(-7, -18); c.lineTo(0, -30); c.lineTo(7, -18); c.lineTo(15, -26); c.lineTo(15, -6); c.quadraticCurveTo(0, 12, -15, -6); c.closePath();
            c.fillStyle = col; c.fill(); ink(c, 3);
            c.restore();
          });
        },
        cactus: function () {
          rr(c, -24, -88, 48, 92, 24); c.fillStyle = '#5CCB75'; c.fill(); ink(c, 3.5);
          rr(c, -52, -60, 24, 40, 12); c.fill(); ink(c, 3.5);
          c.strokeStyle = '#3E9E58'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -80); c.lineTo(0, -4); c.moveTo(-12, -74); c.lineTo(-12, -6); c.moveTo(12, -74); c.lineTo(12, -6); c.stroke();
          c.fillStyle = INK; [[-18, -60], [18, -46], [-6, -30], [10, -70], [-40, -46]].forEach(function (p) { circle(c, p[0], p[1], 1.6); c.fill(); });
          // a cute face
          c.beginPath(); c.arc(-8, -54, 3.2, 0, TAU); c.arc(8, -54, 3.2, 0, TAU); c.fillStyle = INK; c.fill();
          c.beginPath(); c.moveTo(-5, -46); c.quadraticCurveTo(0, -42, 5, -46); ink(c, 2.2);
          if (g > 0.7) { for (var i = 0; i < 6; i++) { ell(c, Math.cos(i * TAU / 6) * 7, -92 + Math.sin(i * TAU / 6) * 7, 7, 4.5, i * TAU / 6); c.fillStyle = col; c.fill(); ink(c, 1.8); } circle(c, 0, -92, 4.5); c.fillStyle = '#FFD23F'; c.fill(); ink(c, 1.8); }
        },
        sunflower: function () {
          stem(c, 0, 0, 4, -168, 7);
          leaf(c, 2, -60, 46, -0.5, '#5CCB75'); leaf(c, 2, -95, 44, -2.6, '#5CCB75');
          c.save(); c.translate(4, -172);
          for (var i = 0; i < 14; i++) { ell(c, Math.cos(i * TAU / 14) * 30, Math.sin(i * TAU / 14) * 30, 16, 8, i * TAU / 14); c.fillStyle = '#FFD23F'; c.fill(); ink(c, 2.2); }
          circle(c, 0, 0, 22); c.fillStyle = '#8B5A3C'; c.fill(); ink(c, 3);
          c.beginPath(); c.moveTo(-10, -2); c.quadraticCurveTo(-6, -7, -2, -2); c.moveTo(2, -2); c.quadraticCurveTo(6, -7, 10, -2); c.lineWidth = 2.5; c.strokeStyle = '#FFE9B0'; c.stroke();
          c.beginPath(); c.moveTo(-5, 6); c.quadraticCurveTo(0, 11, 5, 6); c.stroke();
          c.restore();
        },
        catgrass: function () {
          for (var i = -7; i <= 7; i++) {
            var x = i * 5, h = 80 + ((i * 37) % 23) + Math.abs(i) * -2;
            c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + i * 1.5, -h * 0.6, x + i * 3.5, -h);
            c.lineWidth = 7; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = i % 2 ? '#7BD389' : '#5CCB75'; c.stroke();
          }
        },
        lavender: function () {
          [-24, -8, 8, 24].forEach(function (x, i) {
            var top = -110 - (i % 2) * 18;
            stem(c, x * 0.3, 0, x, top + 30, 4);
            for (var k = 0; k < 6; k++) { ell(c, x + (k % 2 ? 4 : -4), top + k * 8, 6, 5); c.fillStyle = k % 2 ? '#A77BFF' : '#B98FFF'; c.fill(); ink(c, 1.6); }
          });
          leaf(c, 0, -10, 40, -2.6, '#8FBF9A'); leaf(c, 0, -10, 40, -0.5, '#8FBF9A');
        },
        lemon: function () {
          c.beginPath(); c.moveTo(-7, 0); c.lineTo(-5, -96); c.lineTo(5, -96); c.lineTo(7, 0); c.closePath(); c.fillStyle = '#9A6B4A'; c.fill(); ink(c, 3);
          circle(c, 0, -140, 58); c.fillStyle = '#4FB868'; c.fill(); ink(c, 3.5);
          circle(c, -26, -152, 22); c.fillStyle = '#5CCB75'; c.fill();
          [[-30, -128], [22, -150], [6, -112], [30, -118], [-8, -170]].forEach(function (p) { ell(c, p[0], p[1], 10, 8, 0.4); c.fillStyle = '#FFE14D'; c.fill(); ink(c, 2.2); });
        },
        shroom: function () {
          [[-24, -46, 22], [16, -64, 28], [30, -30, 16]].forEach(function (m, i) {
            c.save(); c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2 + i); circle(c, m[0], m[1] - 6, m[2] * 1.6); c.fillStyle = col === '#FFFFFF' ? '#E4FFF9' : col; c.fill(); c.restore();
            rr(c, m[0] - m[2] * 0.25, m[1], m[2] * 0.5, -m[1], 5); c.fillStyle = '#FFF3E4'; c.fill(); ink(c, 2.5);
            c.beginPath(); c.arc(m[0], m[1] + 2, m[2], Math.PI, 0); c.closePath(); c.fillStyle = col === '#FFFFFF' ? '#7CE0D2' : col; c.fill(); ink(c, 3);
            c.fillStyle = '#fff'; circle(c, m[0] - m[2] * 0.4, m[1] - m[2] * 0.4, m[2] * 0.16); c.fill(); circle(c, m[0] + m[2] * 0.35, m[1] - m[2] * 0.55, m[2] * 0.12); c.fill();
          });
        }
      }[d.id] || function () {})();
    }
    c.restore();
    // seed sprout before it grows
    if (g <= 0.01 && pl.seed) { c.save(); c.translate(0, -potH + potH * 0.1); leaf(c, 0, 0, 14, -2.3, '#7BD389'); leaf(c, 0, 0, 14, -0.8, '#7BD389'); c.restore(); }
    c.restore();
  }
  function drawPottedPlant(c, pl, g, t, soilLevel) {
    c.save();
    var w = 92;
    drawPlantBack(c, pl, g, t);
    drawPot(c, pl.pot, w);
    if (soilLevel === undefined || soilLevel >= 1) { soil(c, w); }
    c.restore();
  }
  function drawPlantBack(c, pl, g, t) { drawPlant(c, pl, g, t); }

  function drawThing(c, id, t) {
    t = t || 0;
    c.save();
    ({
      rug: function () {
        ell(c, 0, -14, 150, 22); c.fillStyle = '#FF9EC4'; c.fill(); ink(c, 4);
        ell(c, 0, -14, 118, 16); c.fillStyle = '#FFD3E4'; c.fill(); ink(c, 2.5);
        ell(c, 0, -14, 80, 10); c.fillStyle = '#FF9EC4'; c.fill(); ink(c, 2);
      },
      lamp: function () {
        rr(c, -34, -10, 68, 12, 6); c.fillStyle = '#B9AED0'; c.fill(); ink(c, 3.5);
        c.beginPath(); c.moveTo(0, -10); c.lineTo(0, -180); c.lineWidth = 9; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#B9AED0'; c.stroke();
        c.save(); c.globalAlpha = 0.25 + 0.05 * Math.sin(t * 2); c.beginPath(); c.moveTo(-34, -186); c.lineTo(-90, 0); c.lineTo(90, 0); c.lineTo(34, -186); c.closePath(); c.fillStyle = '#FFF1A8'; c.fill(); c.restore();
        c.beginPath(); c.moveTo(-26, -248); c.lineTo(26, -248); c.lineTo(44, -180); c.lineTo(-44, -180); c.closePath(); c.fillStyle = '#FFD23F'; c.fill(); ink(c, 3.5);
        c.beginPath(); c.moveTo(-36, -200); c.lineTo(36, -200); c.lineWidth = 3; c.strokeStyle = '#FF9F43'; c.stroke();
      },
      picture: function () {
        rr(c, -58, -130, 116, 124, 12); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 4);
        rr(c, -46, -118, 92, 100, 8); c.fillStyle = '#BFE0FF'; c.fill(); ink(c, 2.5);
        c.save(); rr(c, -46, -118, 92, 100, 8); c.clip(); c.translate(0, -62); drawCatPose(c, 'head', 'happy', 64); c.restore();
        c.beginPath(); c.moveTo(-30, -130); c.lineTo(0, -150); c.lineTo(30, -130); ink(c, 2.5);
      },
      clock: function () {
        c.save(); c.translate(0, -55);
        c.beginPath(); c.moveTo(-40, -22); c.lineTo(-36, -54); c.lineTo(-16, -40); c.closePath(); c.moveTo(40, -22); c.lineTo(36, -54); c.lineTo(16, -40); c.closePath(); c.fillStyle = '#FF9F43'; c.fill(); ink(c, 3.5);
        circle(c, 0, 0, 46); c.fillStyle = '#FF9F43'; c.fill(); ink(c, 4);
        circle(c, 0, 0, 36); c.fillStyle = '#FFF8EC'; c.fill(); ink(c, 2.5);
        for (var i = 0; i < 12; i++) { var a = i * TAU / 12; circle(c, Math.cos(a) * 29, Math.sin(a) * 29, i % 3 ? 1.6 : 3); c.fillStyle = INK; c.fill(); }
        var now = new Date(), hr = (now.getHours() % 12 + now.getMinutes() / 60) * TAU / 12, mn = now.getMinutes() * TAU / 60;
        c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 4.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(hr) * 17, -Math.cos(hr) * 17); c.stroke();
        c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(mn) * 26, -Math.cos(mn) * 26); c.stroke();
        circle(c, 0, 0, 4); c.fillStyle = '#FF5A7A'; c.fill();
        c.restore();
      },
      yarnbasket: function () {
        [[-24, -66, '#FF5A5F'], [20, -70, '#4D8BFF'], [0, -84, '#FFD93F']].forEach(function (b) { circle(c, b[0], b[1], 22); c.fillStyle = b[2]; c.fill(); ink(c, 3); c.beginPath(); c.arc(b[0], b[1], 14, 3.6, 5.6); c.lineWidth = 2.5; c.strokeStyle = 'rgba(0,0,0,.2)'; c.stroke(); });
        c.beginPath(); c.moveTo(-54, -58); c.lineTo(-44, 0); c.lineTo(44, 0); c.lineTo(54, -58); c.closePath(); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 3.5);
        c.strokeStyle = '#C48A55'; c.lineWidth = 3; for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 18, -56); c.lineTo(i * 15, -2); c.stroke(); }
        c.beginPath(); c.moveTo(-50, -30); c.lineTo(50, -30); c.stroke();
      },
      giantyarn: function () {
        circle(c, 0, -56, 56); c.fillStyle = '#A77BFF'; c.fill(); ink(c, 4);
        c.save(); circle(c, 0, -56, 56); c.clip(); c.strokeStyle = '#6D45C9'; c.lineWidth = 5;
        for (var i = -3; i <= 3; i++) { c.beginPath(); c.ellipse(0, -56 + i * 16, 62, 18, 0.5, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
        c.restore();
        c.beginPath(); c.moveTo(40, -16); c.quadraticCurveTo(80, 0, 60, -2); c.lineWidth = 8; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#A77BFF'; c.stroke();
      },
      catbed: function () {
        ell(c, 0, -26, 84, 30); c.fillStyle = '#7CC4FF'; c.fill(); ink(c, 4);
        ell(c, 0, -32, 62, 18); c.fillStyle = '#CDE8FF'; c.fill(); ink(c, 2.5);
        c.beginPath(); c.moveTo(-84, -26); c.bezierCurveTo(-80, 6, 80, 6, 84, -26); c.bezierCurveTo(60, -10, -60, -10, -84, -26); c.closePath(); c.fillStyle = '#7CC4FF'; c.fill(); ink(c, 3.5);
      },
      scratch: function () {
        rr(c, -52, -14, 104, 16, 6); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 3.5);
        rr(c, -16, -190, 32, 178, 6); c.fillStyle = '#F2DCC3'; c.fill(); ink(c, 3.5);
        c.strokeStyle = '#C9A57E'; c.lineWidth = 3; for (var y = -184; y < -18; y += 10) { c.beginPath(); c.moveTo(-15, y); c.lineTo(15, y + 6); c.stroke(); }
        rr(c, -48, -206, 96, 18, 8); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 3.5);
        var sw = Math.sin(t * 2.2) * 8;
        c.beginPath(); c.moveTo(38, -190); c.lineTo(40 + sw, -140); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
        circle(c, 40 + sw, -132, 9); c.fillStyle = '#FF5A7A'; c.fill(); ink(c, 2.5);
      },
      cushions: function () {
        rr(c, -58, -40, 116, 40, 18); c.fillStyle = '#FF9F43'; c.fill(); ink(c, 3.5);
        rr(c, -46, -76, 92, 40, 18); c.fillStyle = '#B48CFF'; c.fill(); ink(c, 3.5);
        c.fillStyle = 'rgba(255,255,255,.5)'; circle(c, -20, -56, 4); c.fill(); circle(c, 0, -60, 4); c.fill(); circle(c, 20, -56, 4); c.fill();
      },
      fishbowl: function () {
        circle(c, 0, -52, 48); c.fillStyle = 'rgba(190,230,255,.75)'; c.fill();
        c.save(); circle(c, 0, -52, 48); c.clip(); c.fillStyle = 'rgba(77,139,255,.35)'; c.fillRect(-60, -64, 120, 70);
        var fx = Math.sin(t * 0.9) * 18;
        c.save(); c.translate(fx, -38); c.scale(Math.cos(t * 0.9) > 0 ? 1 : -1, 1);
        ell(c, 0, 0, 13, 9); c.fillStyle = '#FF9F43'; c.fill(); ink(c, 2.2);
        c.beginPath(); c.moveTo(-11, 0); c.lineTo(-22, -8); c.lineTo(-22, 8); c.closePath(); c.fill(); ink(c, 2.2);
        circle(c, 6, -2, 1.8); c.fillStyle = INK; c.fill();
        c.restore();
        c.restore();
        circle(c, 0, -52, 48); ink(c, 4);
        rr(c, -30, -104, 60, 10, 5); c.fillStyle = '#DDF2FF'; c.fill(); ink(c, 3);
        c.beginPath(); c.arc(-14, -66, 22, 3.6, 4.4); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke();
      },
      teapot: function () {
        ell(c, 0, -36, 38, 32); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 3.5);
        c.beginPath(); c.moveTo(34, -40); c.quadraticCurveTo(56, -46, 58, -66); ink(c, 7); c.beginPath(); c.moveTo(34, -40); c.quadraticCurveTo(56, -46, 58, -66); c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke();
        c.beginPath(); c.arc(-42, -38, 14, Math.PI * 0.5, Math.PI * 1.5); ink(c, 4);
        ell(c, 0, -66, 22, 6); c.fillStyle = '#FF9EC4'; c.fill(); ink(c, 3);
        circle(c, 0, -74, 6); c.fillStyle = '#FF9EC4'; c.fill(); ink(c, 2.5);
        c.fillStyle = '#FF9EC4'; [[-16, -30], [12, -24], [0, -44]].forEach(function (p) { circle(c, p[0], p[1], 4.5); c.fill(); });
        c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#fff'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(60, -74); c.quadraticCurveTo(54 + Math.sin(t * 2) * 4, -88, 62, -100); c.stroke(); c.restore();
      },
      cake: function () {
        rr(c, -6, -40, 12, 40, 4); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 3);
        ell(c, 0, -42, 50, 8); c.fillStyle = '#fff'; c.fill(); ink(c, 3);
        rr(c, -36, -100, 72, 56, 10); c.fillStyle = '#FFD3E4'; c.fill(); ink(c, 3.5);
        c.beginPath(); c.moveTo(-36, -84); for (var i = 0; i <= 6; i++) c.quadraticCurveTo(-36 + i * 12 - 6, -74, -36 + i * 12, -84); c.lineWidth = 3; c.strokeStyle = '#FF7EB6'; c.stroke();
        rr(c, -36, -104, 72, 10, 5); c.fillStyle = '#fff'; c.fill(); ink(c, 2.5);
        circle(c, 0, -112, 8); c.fillStyle = '#FF5A5F'; c.fill(); ink(c, 2.5);
      }
    }[id] || function () {})();
    c.restore();
  }

  function drawDish(c, data, size) {
    // the shared dish drawing is centred on its plate, which is fairly flat: lift it so the plate sits on the surface
    try { c.save(); c.translate(0, -size * 0.2); GGDish.draw(c, data, size); c.restore(); } catch (e) { c.restore(); }
  }

  /* An item in the room, bottom centre at (0,0). */
  function drawItem(c, it, t) {
    if (!it) return;
    if (it.kind === 'plant') drawPotted(c, it.data, 1, t);
    else if (it.kind === 'thing') drawThing(c, it.def.id, t);
    else if (it.kind === 'dish') drawDish(c, it.data, 100);
    else if (it.kind === 'picture') { try { ColourPages.drawFramed(c, it.data, 120); } catch (e) {} }
  }
  function itemWidth(it) { return it.kind === 'plant' ? 110 : it.w; }

  /* Small pictures for the drawer and choices. */
  function thumb(fn, w, h, px) {
    px = px || 132;
    var cv = document.createElement('canvas'); cv.width = cv.height = px;
    var c = cv.getContext('2d');
    var k = Math.min((px * 0.86) / w, (px * 0.86) / h);
    c.translate(px / 2, px / 2 + (h * k) / 2); c.scale(k, k);
    fn(c);
    return cv.toDataURL('image/png');
  }
  function itemThumb(it) { return thumb(function (c) { drawItem(c, it, 0); }, Math.max(itemWidth(it), 90), it.h + (it.kind === 'plant' ? 58 : 0) + 6); }

  /* ================= room layout =================
     The room is wider than the screen and scrolls left and right. Two shapes: wide (computers, tablets
     sideways) and tall (phones). Things are saved by surface + position along it, so a room looks the same
     on any screen. The potting bench uses a single-screen layout. */
  function buildSurfaces(L) {
    L.surfaces = { floor: L.floor };
    L.shelves.forEach(function (sh) { L.surfaces[sh.id] = sh; });
    L.sills = L.wins.map(function (w, i) { var id = i ? 'sill' + (i + 1) : 'sill'; var sl = { id: id, x0: w.x - 18, x1: w.x + w.w + 18, y: w.y + w.h + 20 }; L.surfaces[id] = sl; return sl; });
    L.tables.forEach(function (t) { L.surfaces[t.id] = { x0: t.x0 + 15, x1: t.x1 - 15, y: t.y }; });
    return L;
  }
  function makeLayout(tall, bench) {
    if (bench) return tall ? { W: 600, H: 880 } : { W: 1000, H: 640 };
    if (!tall) return buildSurfaces({
      W: 2400, H: 640, wallH: 540, floorY: 595,
      wins: [{ x: 390, y: 60, w: 220, h: 220 }, { x: 1560, y: 60, w: 220, h: 220 }],
      tables: [{ id: 'table', kind: 'table', x0: 640, x1: 900, y: 440 }, { id: 'sideboard', kind: 'sideboard', x0: 1140, x1: 1440, y: 420 }],
      shelves: [{ id: 'shelfA', x0: 70, x1: 320, y: 230 }, { id: 'shelfB', x0: 700, x1: 940, y: 250 }, { id: 'shelfC', x0: 1180, x1: 1420, y: 210 },
        { id: 'shelfD', x0: 1880, x1: 2120, y: 230 }, { id: 'shelfE', x0: 2000, x1: 2340, y: 400 }],
      floor: { x0: 50, x1: 2350, y: 595 }
    });
    return buildSurfaces({
      W: 1200, H: 880, wallH: 770, floorY: 830,
      wins: [{ x: 180, y: 50, w: 240, h: 210 }, { x: 790, y: 50, w: 240, h: 210 }],
      tables: [{ id: 'table', kind: 'table', x0: 320, x1: 570, y: 650 }, { id: 'sideboard', kind: 'sideboard', x0: 650, x1: 900, y: 630 }],
      shelves: [{ id: 'shelfA', x0: 30, x1: 270, y: 420 }, { id: 'shelfB', x0: 330, x1: 570, y: 470 }, { id: 'shelfC', x0: 940, x1: 1170, y: 430 },
        { id: 'shelfD', x0: 640, x1: 880, y: 400 }, { id: 'shelfE', x0: 950, x1: 1170, y: 600 }],
      floor: { x0: 40, x1: 1160, y: 830 }
    });
  }

  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var topbar = $('topbar'), drawer = $('drawer'), growbar = $('growbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, LAY = makeLayout(false), SX = 0, VIEW_W = 1000, scrollTo = null;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var bar = mode === 'grow' ? growbar : drawer;
    var bottom = bar.getBoundingClientRect().top - 8;
    document.documentElement.style.setProperty('--bar-h', Math.round(ch - bar.getBoundingClientRect().top) + 'px');
    var availW = cw - 16, availH = Math.max(120, bottom - top);
    var tall = availW / availH < 1.05;
    if (mode === 'grow') {
      LAY = makeLayout(tall, true);
      K = Math.min(availW / LAY.W, availH / LAY.H);
      VIEW_W = LAY.W; SX = 0;
      OX = (cw - LAY.W * K) / 2;
    } else {
      LAY = makeLayout(tall, false);
      K = Math.min(availH / LAY.H, 1.3);
      VIEW_W = Math.min(LAY.W, availW / K);
      OX = (cw - VIEW_W * K) / 2;
      SX = clamp(SX, 0, LAY.W - VIEW_W);
    }
    OY = top + (availH - LAY.H * K) / 2;
    placeArrows();
  }
  function toRoom(x, y) { return { x: (x - OX) / K + SX, y: (y - OY) / K }; }
  function maxScroll() { return Math.max(0, LAY.W - VIEW_W); }
  function setScroll(v) { SX = clamp(v, 0, maxScroll()); placeArrows(); }
  function placeArrows() {
    var l = $('scrollL'), r = $('scrollR');
    if (!l || !r) return;
    var show = mode === 'room' && maxScroll() > 4;
    l.hidden = r.hidden = !show;
    if (!show) return;
    var y = OY + LAY.H * K * 0.42;
    l.style.left = (OX + 8) + 'px'; l.style.top = y + 'px';
    r.style.left = (OX + VIEW_W * K - 8 - r.offsetWidth) + 'px'; r.style.top = y + 'px';
    l.classList.toggle('off', SX <= 1); r.classList.toggle('off', SX >= maxScroll() - 1);
  }

  /* where a placed item sits now, in room units */
  function placeXY(p) {
    if (p.s === 'wall') return { x: lerp(40, LAY.W - 40, p.f), y: lerp(150, LAY.wallH - 40, p.g) };
    var s = LAY.surfaces[p.s] || LAY.surfaces.floor;
    return { x: lerp(s.x0, s.x1, clamp(p.f, 0, 1)), y: s.y };
  }
  /* where an item dropped at (x, y) would settle */
  function snap(it, x, y) {
    if (it.def.wall) {
      return { s: 'wall', f: clamp((x - 40) / (LAY.W - 80), 0, 1), g: clamp((y + (it.h) / 2 - 150) / (LAY.wallH - 190), 0, 1) };
    }
    var best = null;
    if (!it.def.floor) {
      Object.keys(LAY.surfaces).forEach(function (k) {
        if (k === 'floor') return;
        var s = LAY.surfaces[k];
        if (x < s.x0 - 10 || x > s.x1 + 10) return;
        if (s.y < y - 40) return;            // only surfaces at or below the drop point
        if (!best || s.y < LAY.surfaces[best].y) best = k;
      });
    }
    if (!best) best = 'floor';
    var S2 = LAY.surfaces[best];
    return { s: best, f: clamp((x - S2.x0) / (S2.x1 - S2.x0), 0, 1) };
  }

  /* ================= room drawing ================= */
  var FLOORS = [
    { col: '#C98B5B', kind: 'planks' }, { col: '#E6C08F', kind: 'planks' }, { col: '#8E6A4E', kind: 'planks' },
    { col: '#F2B8C6', kind: 'tiles' }, { col: '#BFE0FF', kind: 'tiles' }, { col: '#9FD8A8', kind: 'carpet' }, { col: '#C9B8EE', kind: 'carpet' }
  ];
  function drawWindow(c, w, t, i) {
    rr(c, w.x - 10, w.y - 10, w.w + 20, w.h + 20, 18); c.fillStyle = '#fff'; c.fill(); ink(c, 4);
    rr(c, w.x, w.y, w.w, w.h, 10); c.fillStyle = '#9EDCFF'; c.fill();
    c.save(); rr(c, w.x, w.y, w.w, w.h, 10); c.clip();
    if (!i) { circle(c, w.x + w.w * 0.78, w.y + w.h * 0.26, 26); c.fillStyle = '#FFE14D'; c.fill(); }
    var cx = ((t * 8 + i * 90) % (w.w + 160)) - 80;
    [[cx, 0.45, 1], [cx - 140, 0.25, 0.8]].forEach(function (cl) {
      c.fillStyle = '#fff'; var bx = w.x + cl[0], by = w.y + w.h * cl[1], k2 = cl[2];
      circle(c, bx, by, 18 * k2); c.fill(); circle(c, bx + 20 * k2, by - 8 * k2, 22 * k2); c.fill(); circle(c, bx + 42 * k2, by, 17 * k2); c.fill();
    });
    c.fillStyle = i ? '#5CCB75' : '#7BD389'; c.beginPath(); c.ellipse(w.x + w.w * (i ? 0.7 : 0.3), w.y + w.h + 30, w.w * 0.7, 60, 0, 0, TAU); c.fill();
    c.restore();
    c.strokeStyle = '#fff'; c.lineWidth = 8;
    c.beginPath(); c.moveTo(w.x + w.w / 2, w.y); c.lineTo(w.x + w.w / 2, w.y + w.h); c.moveTo(w.x, w.y + w.h / 2); c.lineTo(w.x + w.w, w.y + w.h / 2); c.stroke();
    rr(c, w.x, w.y, w.w, w.h, 10); ink(c, 3);
    [-1, 1].forEach(function (side) {
      var x0 = side < 0 ? w.x - 34 : w.x + w.w + 34;
      c.beginPath(); c.moveTo(x0, w.y - 22); c.quadraticCurveTo(x0 - side * 30, w.y + w.h * 0.5, x0 + side * 6, w.y + w.h + 18); c.lineTo(x0 + side * 34, w.y + w.h + 18); c.quadraticCurveTo(x0 + side * 8, w.y + w.h * 0.5, x0 + side * 30, w.y - 22); c.closePath();
      c.fillStyle = i ? '#B48CFF' : '#FF9EC4'; c.fill(); ink(c, 3);
    });
    rr(c, w.x - 50, w.y - 30, w.w + 100, 12, 6); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 3);
  }
  function drawRoom(c, t) {
    var L = LAY, W = WALLS[S.wall] || WALLS[0], F = FLOORS[S.floor || 0] || FLOORS[0];
    // wall with a soft pattern (only the part on screen is drawn)
    var x0 = Math.max(0, SX - 60), x1 = Math.min(L.W, SX + VIEW_W + 60);
    c.fillStyle = W.wall; c.fillRect(0, 0, L.W, L.wallH);
    c.fillStyle = W.pat;
    for (var y = 30; y < L.wallH; y += 60) for (var x = 30 + (y / 60 % 2) * 30; x < x1; x += 60) {
      if (x < x0) continue;
      c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill();
    }
    L.wins.forEach(function (w, i) { drawWindow(c, w, t, i); });
    L.sills.forEach(function (sl) { rr(c, sl.x0, sl.y, sl.x1 - sl.x0, 16, 6); c.fillStyle = '#fff'; c.fill(); ink(c, 3.5); });
    L.shelves.forEach(function (s) {
      rr(c, s.x0, s.y, s.x1 - s.x0, 16, 5); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 3.5);
      [s.x0 + 26, s.x1 - 26].forEach(function (bx) { c.beginPath(); c.moveTo(bx - 10, s.y + 16); c.lineTo(bx + 10, s.y + 16); c.lineTo(bx - 10, s.y + 40); c.closePath(); c.fillStyle = '#C9965F'; c.fill(); ink(c, 3); });
    });
    // floor
    c.fillStyle = F.col; c.fillRect(0, L.wallH, L.W, L.H - L.wallH);
    c.strokeStyle = 'rgba(42,35,64,.18)'; c.lineWidth = 3;
    if (F.kind === 'planks') {
      for (var fy = L.wallH + 22; fy < L.H; fy += 26) { c.beginPath(); c.moveTo(0, fy); c.lineTo(L.W, fy); c.stroke(); }
      for (var i = 0; i < L.W / 80; i++) { var px = (i * 173) % L.W, py = L.wallH + 22 + (i % 4) * 26; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + 26); c.stroke(); }
    } else if (F.kind === 'tiles') {
      c.strokeStyle = 'rgba(255,255,255,.7)';
      for (var ty = L.wallH + 30; ty < L.H; ty += 30) { c.beginPath(); c.moveTo(0, ty); c.lineTo(L.W, ty); c.stroke(); }
      for (var tx = 0; tx < L.W; tx += 50) { c.beginPath(); c.moveTo(tx, L.wallH); c.lineTo(tx, L.H); c.stroke(); }
    } else {
      c.fillStyle = 'rgba(255,255,255,.35)';
      for (var cy = L.wallH + 18; cy < L.H; cy += 22) for (var cx2 = (cy % 44) ? 10 : 30; cx2 < L.W; cx2 += 40) { c.beginPath(); c.arc(cx2, cy, 2.5, 0, TAU); c.fill(); }
    }
    c.fillStyle = '#fff'; c.fillRect(0, L.wallH - 14, L.W, 16);
    c.beginPath(); c.moveTo(0, L.wallH - 14); c.lineTo(L.W, L.wallH - 14); c.moveTo(0, L.wallH + 2); c.lineTo(L.W, L.wallH + 2); ink(c, 3);
  }
  function drawFurniture(c) {
    var fy = LAY.floorY;
    LAY.tables.forEach(function (tb) {
      if (tb.kind === 'sideboard') {
        rr(c, tb.x0 + 10, tb.y + 14, tb.x1 - tb.x0 - 20, fy - tb.y - 14, 8); c.fillStyle = '#F2C38E'; c.fill(); ink(c, 3.5);
        var mid = (tb.x0 + tb.x1) / 2;
        rr(c, tb.x0 + 24, tb.y + 30, mid - tb.x0 - 32, fy - tb.y - 50, 6); c.fillStyle = '#FFD9A8'; c.fill(); ink(c, 2.5);
        rr(c, mid + 8, tb.y + 30, tb.x1 - mid - 32, fy - tb.y - 50, 6); c.fillStyle = '#FFD9A8'; c.fill(); ink(c, 2.5);
        circle(c, mid - 16, tb.y + 80, 5); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 2); circle(c, mid + 16, tb.y + 80, 5); c.fill(); ink(c, 2);
        rr(c, tb.x0, tb.y, tb.x1 - tb.x0, 18, 8); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 3.5);
        return;
      }
      [tb.x0 + 24, tb.x1 - 24].forEach(function (lx) { rr(c, lx - 8, tb.y + 10, 16, fy - tb.y - 10, 5); c.fillStyle = '#C9965F'; c.fill(); ink(c, 3); });
      rr(c, tb.x0, tb.y, tb.x1 - tb.x0, 20, 8); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 3.5);
      rr(c, tb.x0 + 12, tb.y + 20, tb.x1 - tb.x0 - 24, 14, 4); c.fillStyle = '#FFD3E4'; c.fill(); ink(c, 2.5);
    });
  }
  function isTableSurface(id) { return LAY.tables && LAY.tables.some(function (t) { return t.id === id; }); }

  /* ================= state for the room ================= */
  var mode = 'room';                       // room | grow
  var tab = 'plants';
  var time = 0;
  var drag = null;                         // { u, it, x, y, from, place }
  var wig = {};                            // uid -> wiggle time
  var parts = [];
  var newPlantU = null;

  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.5, 0.9), r: rand(4, 8), color: Math.random() < 0.4 ? '#fff' : color, kind: Math.random() < 0.5 ? 'star' : 'dot', spin: rand(-5, 5) });
    }
  }
  function heart(x, y) { parts.push({ x: x, y: y, vx: rand(-20, 20), vy: -70, life: 0, max: 1.2, r: 12, color: '#FF7EB6', kind: 'heart', g: -10 }); }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y); c.rotate(p.kind === 'heart' ? 0 : p.life * p.spin);
      if (p.kind === 'star') star(c, p.r * 1.3);
      else if (p.kind === 'heart') { c.beginPath(); c.moveTo(0, p.r * 0.4); c.bezierCurveTo(-p.r * 1.2, -p.r * 0.4, -p.r * 0.5, -p.r * 1.2, 0, -p.r * 0.5); c.bezierCurveTo(p.r * 0.5, -p.r * 1.2, p.r * 1.2, -p.r * 0.4, 0, p.r * 0.4); }
      else { c.beginPath(); c.arc(0, 0, p.r * 0.6, 0, TAU); }
      c.fillStyle = p.color; c.fill();
      if (p.kind === 'heart') ink(c, 2);
      c.restore();
    });
  }

  /* ================= the resident cat ================= */
  var cat = { f: 0.3, target: 0.3, state: 'sit', t: 2, face: 'open', dir: 1, happy: 0, napOn: null, blink: 3 };
  function floorItems() { return S.placed.filter(function (p) { return p.s === 'floor' && resolve(p.u); }); }
  function catPick() {
    var r = Math.random();
    var beds = floorItems().filter(function (p) { return p.u === 't-catbed' || p.u === 't-rug' || p.u === 't-cushions'; });
    if (r < 0.25 && beds.length) {
      var b = beds[Math.floor(Math.random() * beds.length)];
      cat.target = b.f; cat.state = 'walk'; cat.then = 'nap'; cat.napU = b.u;
    } else if (r < 0.55 && floorItems().length) {
      var it = floorItems()[Math.floor(Math.random() * floorItems().length)];
      cat.target = clamp(it.f + (Math.random() < 0.5 ? -0.04 : 0.04), 0.03, 0.97); cat.state = 'walk'; cat.then = 'sit'; cat.napU = null;
    } else {
      cat.target = clamp(cat.f + rand(-0.25, 0.25), 0.04, 0.96); cat.state = 'walk'; cat.then = 'sit'; cat.napU = null;
    }
  }
  function catXY() { var s = LAY.surfaces.floor; return { x: lerp(s.x0, s.x1, cat.f), y: s.y + 6 }; }
  function catSize() { return LAY.W < 700 ? 82 : 92; }
  function updateCat(dt) {
    cat.t -= dt;
    if (cat.happy > 0) { cat.happy -= dt; return; }
    cat.blink -= dt; if (cat.blink < -0.15) cat.blink = rand(2, 6);
    if (cat.state === 'walk') {
      var d = cat.target - cat.f, step = 0.12 * dt * 1000 / (LAY.surfaces.floor.x1 - LAY.surfaces.floor.x0);
      cat.dir = d > 0 ? 1 : -1;
      if (Math.abs(d) <= step) { cat.f = cat.target; cat.state = cat.then || 'sit'; cat.t = cat.state === 'nap' ? rand(6, 10) : rand(2.5, 5); }
      else cat.f += step * cat.dir;
    } else if (cat.t <= 0) catPick();
    // if its bed is moved away mid-nap, it wakes up
    if (cat.state === 'nap' && cat.napU && !S.placed.some(function (p) { return p.u === cat.napU && p.s === 'floor'; })) { cat.state = 'sit'; cat.t = rand(1, 2); cat.napU = null; }
  }
  function drawCat(c) {
    var p = catXY(), s = catSize();
    var face = cat.happy > 0 ? 'happy' : cat.state === 'nap' ? 'sleep' : (cat.blink < 0 ? 'blink' : 'open');
    c.save();
    if (cat.state === 'nap') {
      var lift = { 't-catbed': 36, 't-cushions': 68, 't-rug': 0 }[cat.napU] || 0;
      p = { x: p.x, y: p.y - lift };
      c.translate(p.x, p.y - s * 0.34);
      c.scale(cat.dir, 1);
      drawCatPose(c, 'lie', face, s);
      var ph = (time * 0.45) % 1;
      c.restore(); c.save();
      c.globalAlpha = Math.sin(ph * Math.PI); c.font = '800 ' + Math.round(s * 0.3) + 'px "Baloo 2", ui-rounded, sans-serif'; c.fillStyle = '#6E6080';
      c.fillText('z', p.x + s * 0.3 + ph * 20, p.y - s * 0.75 - ph * 30);
      c.restore();
      return;
    }
    var bob = cat.state === 'walk' ? Math.abs(Math.sin(time * 9)) * s * 0.07 : 0;
    var hop = cat.happy > 0 ? Math.sin(clamp(cat.happy / 1.2, 0, 1) * Math.PI) * s * 0.35 : 0;
    // shadow
    ell(c, p.x, p.y + 2, s * 0.5, s * 0.1); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.translate(p.x, p.y - s * 100 / 88 - bob - hop);
    c.scale(cat.dir, 1);
    drawCatPose(c, 'sit', face, s);
    c.restore();
  }
  function catHit(x, y) { var p = catXY(), s = catSize(); return Math.abs(x - p.x) < s * 0.6 && y < p.y + 10 && y > p.y - s * 1.9; }

  /* ================= drawer ================= */
  var thumbCache = {};
  function tileHTML(u, it, extra) {
    var key = u + ':' + (it.kind === 'plant' ? it.data.pot + '-' + it.data.col : it.kind === 'picture' ? (it.data.at || 0) + '-' + (it.data.fr || 0) : '');
    if (!thumbCache[key]) thumbCache[key] = itemThumb(it);
    var name = it.def.name;
    return '<div class="item' + (extra || '') + '" data-u="' + u + '" role="button" tabindex="0" aria-label="' + name + '"><img alt="" src="' + thumbCache[key] + '"><span>' + name + '</span></div>';
  }
  function renderDrawer() {
    document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    $('paintBtn').setAttribute('aria-pressed', String(tab === 'paint'));
    $('items').classList.toggle('painting', tab === 'paint');
    var box = $('items'), html = '';
    if (tab === 'plants') {
      if (!S.plants.length) html = '<p class="empty">No plants yet. Tap Grow to plant your first one!</p>';
      S.plants.slice().reverse().forEach(function (pl) {
        var u = 'p' + pl.id, it = resolve(u); if (!it) return;
        html += tileHTML(u, it, (isPlaced(u) ? ' placed' : '') + (u === newPlantU ? ' new' : ''));
      });
    } else if (tab === 'things') {
      colourPics().slice().reverse().forEach(function (pc) { var u = 'c-' + pc.id, it = resolve(u); if (it) html += tileHTML(u, it, isPlaced(u) ? ' placed' : ''); });
      THINGS.forEach(function (t) {
        var u = 't-' + t.id;
        if (thingUnlocked(t)) html += tileHTML(u, resolve(u), isPlaced(u) ? ' placed' : '');
        else {
          var key = 'lock-' + t.id;
          if (!thumbCache[key]) thumbCache[key] = thumb(function (c) { drawThing(c, t.id, 0); }, t.w, t.h);
          html += '<div class="item locked" data-lock="' + t.id + '" role="button" tabindex="0" aria-label="' + t.name + ': ' + t.need.text + '"><img alt="" src="' + thumbCache[key] + '"><span>' + t.need.text + '</span></div>';
        }
      });
    } else if (tab === 'paint') {
      html += '<div class="paintrow"><span class="plabel">Walls</span>' + WALLS.map(function (w, i) {
        return '<button class="sw" type="button" data-wall="' + i + '" aria-label="Wall colour ' + (i + 1) + '" aria-pressed="' + (i === S.wall) + '" style="background-color:' + w.wall + ';background-image:radial-gradient(circle,' + w.pat + ' 3px,transparent 4px);background-size:14px 14px"></button>';
      }).join('') + '</div>';
      html += '<div class="paintrow"><span class="plabel">Floor</span>' + FLOORS.map(function (f, i) {
        var bg = f.kind === 'planks' ? 'repeating-linear-gradient(0deg,rgba(42,35,64,.2) 0 2px,transparent 2px 10px)' : f.kind === 'tiles' ? 'linear-gradient(rgba(255,255,255,.7) 2px,transparent 2px) 0 0/12px 12px,linear-gradient(90deg,rgba(255,255,255,.7) 2px,transparent 2px) 0 0/12px 12px' : 'radial-gradient(circle,rgba(255,255,255,.5) 2px,transparent 3px) 0 0/9px 9px';
        return '<button class="sw" type="button" data-floor="' + i + '" aria-label="Floor ' + (i + 1) + '" aria-pressed="' + (i === (S.floor || 0)) + '" style="background:' + bg + ',' + f.col + '"></button>';
      }).join('') + '</div>';
    } else {
      var dl = dishList();
      if (!dishesReady()) html = '<p class="empty">Dishes you cook in Cosy Kitchen will appear here.</p>';
      else if (!dl.length) html = '<p class="empty">Cook something in Cosy Kitchen and it will appear here!</p>';
      else dl.slice().reverse().forEach(function (d) { var u = 'd-' + d.uid, it = resolve(u); if (it) html += tileHTML(u, it, isPlaced(u) ? ' placed' : ''); });
    }
    box.innerHTML = html;
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { Sound.init(); Sound.pick(); tab = b.dataset.tab; renderDrawer(); $('items').scrollLeft = 0; });
  });
  $('items').addEventListener('click', function (e) {
    var lock = e.target.closest('[data-lock]');
    if (lock) { var t = findDef(THINGS, lock.dataset.lock); Sound.init(); Sound.mrrp(); say(t.need.text + ' to get this!', 2); return; }
    var tile = e.target.closest('.item[data-u]');
    if (tile && !tile.classList.contains('placed') && !drag) say('Drag it up into your room!', 1.6);
  });

  /* ---------- dragging from the drawer: an upward drag lifts the item out (sideways scrolls the drawer) ---------- */
  var press = null;
  $('items').addEventListener('pointerdown', function (e) {
    var tile = e.target.closest('.item[data-u]');
    if (!tile || tile.classList.contains('placed') || mode !== 'room') return;
    Sound.init();
    press = { id: e.pointerId, u: tile.dataset.u, x: e.clientX, y: e.clientY, tile: tile };
  });
  window.addEventListener('pointermove', function (e) {
    if (press && press.id === e.pointerId && !drag) {
      var dx = e.clientX - press.x, dy = e.clientY - press.y;
      var mouse = e.pointerType === 'mouse';
      if (mouse ? Math.hypot(dx, dy) > 8 : (dy < -10 && Math.abs(dy) > Math.abs(dx) * 0.5)) {
        var it = resolve(press.u);
        if (it) { drag = { u: press.u, it: it, x: e.clientX, y: e.clientY, from: 'drawer', pid: e.pointerId }; Sound.pick(); buzz(8); }
        press = null;
      }
      return;
    }
    if (drag && drag.pid === e.pointerId) { drag.x = e.clientX; drag.y = e.clientY; e.preventDefault(); }
  }, { passive: false });
  function endDrag(e) {
    if (press && press.id === e.pointerId) press = null;
    if (!drag || drag.pid !== e.pointerId) return;
    var d = drag; drag = null;
    var overDrawer = e.clientY > drawer.getBoundingClientRect().top - 4;
    S.placed = S.placed.filter(function (p) { return p.u !== d.u; });
    if (overDrawer || e.type === 'pointercancel') {
      if (d.from === 'room') { Sound.putAway(); say('Put away', 1); }
    } else {
      var r = toRoom(d.x, d.y);
      var p = snap(d.it, r.x, r.y + itemHeightBelowFinger(d.it));
      p.u = d.u;
      S.placed.push(p);
      if (S.placed.length > 40) S.placed.shift();
      Sound.place(); buzz(10);
      var q = placeXY(p);
      sparkle(q.x, q.y - 20, '#FFD23F', 7, 0.7);
      wig[d.u] = 0.5;
      if (d.u === newPlantU) newPlantU = null;
    }
    save(); renderDrawer();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  // the finger holds the item a little above its base
  function itemHeightBelowFinger(it) { return it.def.wall ? 0 : Math.min(60, it.h * 0.35); }

  /* ---------- picking things up in the room, tapping the cat ---------- */
  function placedHit(x, y) {
    for (var i = S.placed.length - 1; i >= 0; i--) {
      var p = S.placed[i], it = resolve(p.u); if (!it) continue;
      var q = placeXY(p), w = itemWidth(it), h = it.h + (it.kind === 'plant' ? 58 : 0);
      if (x > q.x - w / 2 - 6 && x < q.x + w / 2 + 6 && y < q.y + 8 && y > q.y - h - 6) return { p: p, it: it };
    }
    return null;
  }
  var roomPress = null;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (mode === 'grow') { growDown(e); return; }
    var r = toRoom(e.clientX, e.clientY);
    if (catHit(r.x, r.y) && cat.state !== 'walk' || catHit(r.x, r.y) && !placedHit(r.x, r.y)) {
      cat.happy = 1.2; cat.state = 'sit'; cat.t = rand(2, 4); Sound.purr(); Sound.mrrp(); buzz(10);
      var q = catXY(); heart(q.x, q.y - catSize() * 1.6);
      return;
    }
    var hit = placedHit(r.x, r.y);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    if (!hit) { pan = { id: e.pointerId, x: e.clientX, sx: SX }; scrollTo = null; return; }
    roomPress = { id: e.pointerId, x: e.clientX, y: e.clientY, hit: hit };
  });
  var pan = null;
  canvas.addEventListener('wheel', function (e) {
    if (mode !== 'room' || maxScroll() <= 0) return;
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    scrollTo = null; setScroll(SX + d / K); e.preventDefault();
  }, { passive: false });
  function arrow(dir) { Sound.init(); Sound.pick(); scrollTo = clamp((scrollTo !== null ? scrollTo : SX) + dir * VIEW_W * 0.6, 0, maxScroll()); }
  $('scrollL').addEventListener('click', function () { arrow(-1); });
  $('scrollR').addEventListener('click', function () { arrow(1); });
  canvas.addEventListener('pointermove', function (e) {
    if (mode === 'grow') { growMove(e); return; }
    if (pan && pan.id === e.pointerId) { setScroll(pan.sx - (e.clientX - pan.x) / K); return; }
    if (!roomPress || roomPress.id !== e.pointerId || drag) return;
    if (Math.hypot(e.clientX - roomPress.x, e.clientY - roomPress.y) < 8) return;
    drag = { u: roomPress.hit.p.u, it: roomPress.hit.it, x: e.clientX, y: e.clientY, from: 'room', pid: e.pointerId };
    S.placed = S.placed.filter(function (p) { return p.u !== drag.u; });
    Sound.pick(); roomPress = null;
  });
  canvas.addEventListener('pointerup', function (e) {
    if (mode === 'grow') { growUp(e); return; }
    if (pan && pan.id === e.pointerId) { pan = null; return; }
    if (roomPress && roomPress.id === e.pointerId) {
      // a tap on a thing gives it a happy wiggle
      wig[roomPress.hit.p.u] = 0.5; Sound.pop();
      if (roomPress.hit.it.kind === 'plant') { var q = placeXY(roomPress.hit.p); sparkle(q.x, q.y - 110, FLOWER[roomPress.hit.it.data.col || 0], 5, 0.6); }
      roomPress = null;
    }
  });

  /* ---------- wall paint ---------- */
  $('paintBtn').addEventListener('click', function () {
    Sound.init(); Sound.pick();
    tab = tab === 'paint' ? 'plants' : 'paint'; renderDrawer(); $('items').scrollLeft = 0;
  });
  $('items').addEventListener('click', function (e) {
    var b = e.target.closest('[data-wall],[data-floor]'); if (!b) return;
    Sound.init(); Sound.brush();
    if (b.dataset.wall !== undefined) { S.wall = +b.dataset.wall; sparkle(SX + VIEW_W / 2, LAY.wallH / 2, WALLS[S.wall].pat, 12, 1.4); }
    else { S.floor = +b.dataset.floor; sparkle(SX + VIEW_W / 2, LAY.floorY, '#FFFFFF', 10, 1); }
    save(); renderDrawer();
  });

  /* ================= potting bench (Grow) ================= */
  var grow = null;
  function seedsUnlocked() { return PLANTS.filter(function (p) { return S.grown >= p.grown; }); }
  function bench() {
    // positions on the bench, in room units for the current layout
    var tall = LAY.W < 700, W = LAY.W, H = LAY.H;
    var top = tall ? H * 0.66 : H * 0.7;
    return {
      top: top, pot: { x: W * 0.5, y: top },
      bag: { x: tall ? W * 0.17 : W * 0.2, y: top }, can: { x: tall ? W * 0.84 : W * 0.8, y: top },
      sun: { x: tall ? W * 0.8 : W * 0.82, y: tall ? H * 0.16 : H * 0.18 }
    };
  }
  var STEPS = {
    pot: 'Pick a pot', seed: 'Pick a seed', soil: 'Tap the soil bag to fill the pot', plant: 'Tap the pot to plant the seed',
    water: 'Drag the watering can over the pot', colour: 'Pick a flower colour', sun: 'Tap the sun to help it grow!', done: 'Ta-da!'
  };
  function startGrow() {
    mode = 'grow';
    grow = { step: 'pot', pot: -1, t: null, col: Math.floor(Math.random() * FLOWER.length), soil: 0, seed: false, water: 0, g: 0, anim: 0, can: null, canHeld: false, scoops: [], drops: [] };
    drawer.hidden = true; growbar.hidden = false;
    $('homeBtn').hidden = true; $('backBtn').hidden = false;
    $('titleLabel').textContent = 'Grow a plant';
    $('say').classList.add('hide');
    setStep('pot');
    layout();
  }
  function endGrow() {
    mode = 'room'; grow = null;
    drawer.hidden = false; growbar.hidden = true;
    $('homeBtn').hidden = false; $('backBtn').hidden = true;
    $('titleLabel').textContent = 'Cosy Home';
    layout(); renderDrawer();
  }
  $('growBtn').addEventListener('click', function () { Sound.init(); Sound.pop(); startGrow(); });
  $('backBtn').addEventListener('click', function () { Sound.init(); Sound.putAway(); endGrow(); });

  function setStep(step) {
    grow.step = step;
    $('stepLabel').textContent = STEPS[step];
    var box = $('choices'), html = '';
    if (step === 'pot') POTS.forEach(function (p, i) { html += '<button class="choice" type="button" data-pot="' + i + '" aria-label="Pot ' + (i + 1) + '"><img alt="" src="' + potThumb(i) + '"></button>'; });
    else if (step === 'seed') PLANTS.forEach(function (p) {
      var ok = S.grown >= p.grown;
      html += '<button class="choice' + (ok ? '' : ' locked') + '" type="button" data-seed="' + p.id + '" aria-label="' + p.name + (ok ? '' : ': grow ' + (p.grown - S.grown) + ' more plants to unlock') + '"><img alt="" src="' + seedThumb(p.id) + '">' +
        (ok ? '' : '<span class="lock"><svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="2" fill="#2A2340"/><path d="M5 7 V5 A3 3 0 0 1 11 5 V7" fill="none" stroke="#2A2340" stroke-width="2"/></svg></span>') + '</button>';
    });
    else if (step === 'colour') FLOWER.forEach(function (col, i) { html += '<button class="choice swatch" type="button" data-col="' + i + '" style="background:' + col + '" aria-label="Colour ' + (i + 1) + '"></button>'; });
    box.innerHTML = html;
    box.hidden = !html;
    layout();
  }
  function potThumb(i) { var k = 'pot' + i; if (!thumbCache[k]) thumbCache[k] = thumb(function (c) { drawPot(c, i, 92); }, 104, 60); return thumbCache[k]; }
  function seedThumb(id) {
    var k = 'seed' + id;
    if (!thumbCache[k]) thumbCache[k] = thumb(function (c) {
      // a little seed packet showing the plant
      rr(c, -46, -120, 92, 120, 10); c.fillStyle = '#FFF3E4'; c.fill(); ink(c, 4);
      c.beginPath(); c.moveTo(-46, -104); c.lineTo(46, -104); c.lineWidth = 3; c.strokeStyle = INK; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
      c.save(); c.translate(0, -8); c.scale(0.5, 0.5); drawPlant(c, { t: id, col: 0, id: 0 }, 1, 0); c.restore();
    }, 100, 128);
    return thumbCache[k];
  }
  $('choices').addEventListener('click', function (e) {
    var b = e.target.closest('.choice'); if (!b || !grow) return;
    Sound.init();
    if (b.dataset.pot !== undefined) { grow.pot = +b.dataset.pot; grow.anim = 0; Sound.place(); setStep('seed'); }
    else if (b.dataset.seed) {
      var p = findDef(PLANTS, b.dataset.seed);
      if (S.grown < p.grown) { Sound.mrrp(); var n = p.grown - S.grown; say('Grow ' + n + ' more plant' + (n > 1 ? 's' : '') + ' to unlock this!', 2); return; }
      grow.t = p.id; Sound.pop(); setStep('soil');
    }
    else if (b.dataset.col !== undefined) { grow.col = +b.dataset.col; Sound.pop(); setStep('sun'); }
  });

  function growDown(e) {
    if (!grow) return;
    var r = toRoom(e.clientX, e.clientY), B = bench();
    if (grow.step === 'soil' && Math.hypot(r.x - B.bag.x, r.y - (B.bag.y - 60)) < 90) {
      if (grow.soil + grow.scoops.length >= 3) return;
      grow.scoops.push({ t: 0 }); Sound.scoop(); buzz(6);
    } else if (grow.step === 'plant' && Math.abs(r.x - B.pot.x) < 70 && r.y > B.pot.y - 130 && r.y < B.pot.y + 10) {
      grow.seed = true; grow.poke = 0.5; Sound.poke(); buzz(10);
      sparkle(B.pot.x, B.pot.y - 60, '#8B5A3C', 6, 0.5);
      setTimeout(function () { if (grow && grow.step === 'plant') setStep('water'); }, 450);
    } else if (grow.step === 'water' && Math.hypot(r.x - (grow.can ? grow.can.x : B.can.x), r.y - (grow.can ? grow.can.y : B.can.y - 50)) < 90) {
      grow.canHeld = e.pointerId; grow.can = { x: r.x, y: r.y };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      Sound.pick();
    } else if (grow.step === 'sun' && Math.hypot(r.x - B.sun.x, r.y - B.sun.y) < 90) {
      grow.step = 'growing'; grow.anim = 0; $('stepLabel').textContent = 'Growing…'; Sound.pop();
      sparkle(B.sun.x, B.sun.y, '#FFE14D', 12, 1.2);
    }
  }
  function growMove(e) {
    if (!grow || grow.canHeld !== e.pointerId) return;
    var r = toRoom(e.clientX, e.clientY);
    grow.can = { x: r.x, y: r.y };
  }
  function growUp(e) { if (grow && grow.canHeld === e.pointerId) { grow.canHeld = false; } }

  function updateGrow(dt) {
    var B = bench();
    grow.anim += dt;
    // soil scoops fly from the bag into the pot
    grow.scoops = grow.scoops.filter(function (s) {
      s.t += dt / 0.45;
      if (s.t >= 1) { grow.soil++; Sound.place(); if (grow.soil >= 3 && grow.step === 'soil') setStep('plant'); return false; }
      return true;
    });
    if (grow.poke > 0) grow.poke -= dt;
    // watering: when the spout is over the pot
    if (grow.step === 'water' && grow.can && grow.canHeld !== false) {
      var spoutX = grow.can.x - 70, over = Math.abs(spoutX - B.pot.x) < 60 && grow.can.y < B.pot.y - 40;
      grow.pouring = over;
      if (over) {
        grow.water = Math.min(1, grow.water + dt / 1.6);
        if (Math.random() < dt * 30) { grow.drops.push({ x: spoutX + rand(-6, 6), y: grow.can.y - 10, vy: 60 }); }
        if (Math.random() < dt * 8) Sound.drip();
        if (grow.water >= 1) {
          grow.canHeld = false; grow.pouring = false; grow.can = null;
          sparkle(B.pot.x, B.pot.y - 70, '#7CC4FF', 8, 0.6); Sound.pop();
          setStep(findDef(PLANTS, grow.t).colour ? 'colour' : 'sun');
        }
      }
    } else grow.pouring = false;
    grow.drops = grow.drops.filter(function (d) { d.vy += 900 * dt; d.y += d.vy * dt; return d.y < B.pot.y - 52; });
    // growing after the sun is tapped
    if (grow.step === 'growing') {
      var before = grow.g;
      grow.g = Math.min(1, grow.g + dt / (reduceMotion ? 0.6 : 2.2));
      [0.25, 0.5, 0.75, 0.98].forEach(function (m, i) { if (before < m && grow.g >= m) { Sound.grow(i); sparkle(B.pot.x + rand(-40, 40), B.pot.y - 60 - grow.g * 120, FLOWER[grow.col], 5, 0.6); } });
      if (grow.g >= 1) finishGrow();
    }
  }
  function finishGrow() {
    grow.step = 'done';
    $('stepLabel').textContent = STEPS.done;
    var before = seedsUnlocked().length;
    var pl = { id: S.next++, t: grow.t, pot: grow.pot, col: grow.col };
    S.plants.push(pl);
    if (S.plants.length > 60) S.plants.shift();
    S.grown++;
    save();
    if (GG.stat) GG.stat('home', 'plants', 1);
    newPlantU = 'p' + pl.id;
    Sound.chime(); buzz(30);
    var B = bench(); sparkle(B.pot.x, B.pot.y - 120, '#FFD23F', 16, 1.2);
    var it = resolve(newPlantU), d = findDef(PLANTS, pl.t);
    var unlocked = seedsUnlocked();
    var gotNew = unlocked.length > before ? unlocked[unlocked.length - 1] : null;
    setTimeout(function () {
      $('cardImg').src = itemThumb(it);
      $('cardTitle').textContent = 'You grew ' + (/s$/.test(d.name) ? d.name.toLowerCase() : (/^[aeiou]/i.test(d.name) ? 'an ' : 'a ') + d.name.toLowerCase()) + '!';
      $('cardNote').textContent = gotNew ? 'New seed unlocked: ' + gotNew.name + '!' : 'It’s in your drawer, ready to put in your room.';
      $('cardWrap').hidden = false;
      $('cardBtn').focus();
    }, 900);
  }
  $('cardBtn').addEventListener('click', function () {
    Sound.init(); Sound.pop();
    $('cardWrap').hidden = true;
    tab = 'plants';
    endGrow();
    say('Drag your new plant up into your room!', 2.4);
  });

  function drawBench(c) {
    var L = LAY, B = bench(), W = L.W, H = L.H;
    // a sunny garden shed: wall, window, bench
    c.fillStyle = '#E3F4D9'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#D2EBC4'; for (var x = 0; x < W; x += 50) c.fillRect(x, 0, 24, B.top);
    rr(c, W * 0.08, H * 0.08, W * 0.42, H * 0.3, 14); c.fillStyle = '#9EDCFF'; c.fill(); ink(c, 4);
    c.strokeStyle = '#fff'; c.lineWidth = 7; c.beginPath(); c.moveTo(W * 0.29, H * 0.08); c.lineTo(W * 0.29, H * 0.38); c.stroke();
    // sun (the tap target in the sun step)
    var sunPulse = grow.step === 'sun' ? 1 + Math.sin(time * 5) * 0.08 : 1;
    c.save(); c.translate(B.sun.x, B.sun.y); c.scale(sunPulse, sunPulse);
    c.strokeStyle = '#FFC93C'; c.lineWidth = 7; c.lineCap = 'round';
    for (var i = 0; i < 10; i++) { var a = i * TAU / 10 + time * 0.3; c.beginPath(); c.moveTo(Math.cos(a) * 52, Math.sin(a) * 52); c.lineTo(Math.cos(a) * 70, Math.sin(a) * 70); c.stroke(); }
    try { GGCat.draw(c, { preset: 'sun', face: grow.step === 'growing' || grow.step === 'done' ? 'happy' : 'open', size: 90 }); } catch (e) { circle(c, 0, 0, 44); c.fillStyle = '#FFC93C'; c.fill(); }
    c.restore();
    // bench
    rr(c, -10, B.top, W + 20, 26, 6); c.fillStyle = '#E6B98A'; c.fill(); ink(c, 4);
    c.fillStyle = '#C9965F'; c.fillRect(0, B.top + 26, W, H - B.top - 26);
    [W * 0.12, W * 0.88].forEach(function (lx) { rr(c, lx - 12, B.top + 26, 24, H - B.top - 26, 4); c.fillStyle = '#B57F4B'; c.fill(); ink(c, 3); });
    // soil bag
    c.save(); c.translate(B.bag.x, B.bag.y);
    var bagBounce = grow.step === 'soil' ? Math.sin(time * 6) * 3 : 0;
    c.translate(0, -bagBounce);
    c.beginPath(); c.moveTo(-50, 0); c.lineTo(-44, -110); c.quadraticCurveTo(0, -128, 44, -110); c.lineTo(50, 0); c.closePath(); c.fillStyle = '#C48A55'; c.fill(); ink(c, 4);
    ell(c, 0, -112, 40, 10); c.fillStyle = '#7A4E2D'; c.fill(); ink(c, 3);
    rr(c, -30, -76, 60, 40, 8); c.fillStyle = '#FFF3E4'; c.fill(); ink(c, 2.5);
    c.save(); c.translate(0, -50); leaf(c, 0, 0, 18, -2.4, '#5CCB75'); leaf(c, 0, 0, 18, -0.7, '#5CCB75'); c.restore();
    c.restore();
    // watering can (resting, or held)
    var can = grow.can || { x: B.can.x + 20, y: B.can.y - 60 };
    var tilt = grow.pouring ? -0.55 : grow.canHeld !== false && grow.can ? -0.2 : 0;
    c.save(); c.translate(can.x, can.y); c.rotate(tilt);
    if (grow.step === 'water' && !grow.can) { c.globalAlpha = 0.4 + 0.3 * Math.sin(time * 5); circle(c, 0, 0, 80); c.fillStyle = '#fff'; c.fill(); c.globalAlpha = 1; }
    c.beginPath(); c.moveTo(-36, -10); c.lineTo(-90, -48); c.lineTo(-84, -56); c.lineTo(-30, -24); c.closePath(); c.fillStyle = '#7CC4FF'; c.fill(); ink(c, 3);
    rr(c, -86, -60, 16, 12, 4); c.fillStyle = '#3B8FD6'; c.fill(); ink(c, 2.5);
    rr(c, -40, -50, 80, 70, 14); c.fillStyle = '#7CC4FF'; c.fill(); ink(c, 4);
    c.beginPath(); c.arc(10, -50, 26, Math.PI, 0); ink(c, 6);
    c.fillStyle = '#fff'; circle(c, -14, -18, 6); c.fill(); circle(c, 8, -10, 5); c.fill();
    c.restore();
    // water drops
    grow.drops.forEach(function (d) { ell(c, d.x, d.y, 4, 7); c.fillStyle = '#7CC4FF'; c.fill(); });
    // water meter
    if (grow.step === 'water' || grow.water > 0 && grow.step !== 'done' && grow.step !== 'growing' && grow.step !== 'sun' && grow.step !== 'colour') {
      rr(c, B.pot.x - 60, B.pot.y + 40, 120, 16, 8); c.fillStyle = '#fff'; c.fill(); ink(c, 3);
      rr(c, B.pot.x - 58, B.pot.y + 42, 116 * grow.water, 12, 6); c.fillStyle = '#7CC4FF'; c.fill();
    }
    // the pot and plant
    if (grow.pot >= 0) {
      var drop = easeBack(Math.min(1, grow.anim * 3));
      c.save(); c.translate(B.pot.x, lerp(B.pot.y - 160, B.pot.y, grow.step === 'seed' || grow.step === 'pot' ? drop : 1));
      var sq = grow.poke > 0 ? Math.sin(grow.poke / 0.5 * Math.PI) * 0.08 : 0;
      c.scale(1.35 + sq, 1.35 - sq);
      var pl = { t: grow.t || 'catnip', pot: grow.pot, col: grow.col, id: 1, seed: grow.seed };
      var potH = 92 * 0.62;
      drawPot(c, grow.pot, 92);
      soil(c, 92, Math.min(3, grow.soil) / 3);
      if (grow.seed && grow.g <= 0) { ell(c, 0, -potH + potH * 0.08, 5, 3.5); c.fillStyle = '#4A2E1A'; c.fill(); }
      if (grow.g > 0 || grow.seed) drawPlant(c, pl, grow.g, time);
      potLip(c, grow.pot, 92);
      c.restore();
      // a dotted target where the pot wants tapping
      if (grow.step === 'plant') { c.save(); c.setLineDash([8, 7]); c.lineDashOffset = -time * 20; circle(c, B.pot.x, B.pot.y - 56, 60); c.lineWidth = 4; c.strokeStyle = '#FFFFFF'; c.stroke(); c.restore(); }
    }
    // scoops of soil in the air
    grow.scoops.forEach(function (s) {
      var p = easeOut(s.t), x = lerp(B.bag.x, B.pot.x, p), y = lerp(B.bag.y - 120, B.pot.y - 70, p) - Math.sin(p * Math.PI) * 120;
      ell(c, x, y, 16, 10); c.fillStyle = '#7A4E2D'; c.fill(); ink(c, 2);
    });
    // a pulsing ring on the bag for the soil step
    if (grow.step === 'soil') { c.save(); c.setLineDash([8, 7]); c.lineDashOffset = -time * 20; circle(c, B.bag.x, B.bag.y - 60, 80); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); c.restore(); }
  }

  /* ================= speech bubble ================= */
  var sayTimer = 0;
  function say(text, secs) {
    var el = $('say');
    el.textContent = text; el.classList.remove('hide');
    clearTimeout(sayTimer); sayTimer = setTimeout(function () { el.classList.add('hide'); }, (secs || 1.6) * 1000);
  }

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
  renderSound();

  /* ================= main loop ================= */
  function drawRoomScene(c) {
    drawRoom(c, time);
    // draw order: wall things and shelves/sills, then furniture and what's on it, then the floor (rug first)
    var list = S.placed.map(function (p) { return { p: p, it: resolve(p.u) }; }).filter(function (e) { return e.it; });
    function drawPlaced(e) {
      var q = placeXY(e.p);
      if (q.x < SX - 200 || q.x > SX + VIEW_W + 200) return;
      c.save(); c.translate(q.x, q.y);
      if (wig[e.p.u] > 0) c.rotate(Math.sin(wig[e.p.u] * 30) * 0.06 * (wig[e.p.u] / 0.5));
      if (e.p.s !== 'wall' && !e.it.def.flat && e.it.kind !== 'dish') { ell(c, 0, 0, itemWidth(e.it) * 0.4, 6); c.fillStyle = 'rgba(42,35,64,.15)'; c.fill(); }
      drawItem(c, e.it, time);
      c.restore();
    }
    list.filter(function (e) { return e.p.s === 'wall'; }).forEach(drawPlaced);
    list.filter(function (e) { return e.p.s !== 'wall' && e.p.s !== 'floor' && !isTableSurface(e.p.s); }).forEach(drawPlaced);
    drawFurniture(c);
    list.filter(function (e) { return isTableSurface(e.p.s); }).forEach(drawPlaced);
    list.filter(function (e) { return e.p.s === 'floor' && e.it.def.flat; }).forEach(drawPlaced);
    var floorThings = list.filter(function (e) { return e.p.s === 'floor' && !e.it.def.flat; });
    // the cat goes behind tall things and in front of short ones; a napping cat lies on top of its bed
    floorThings.filter(function (e) { return e.it.h > 150; }).forEach(drawPlaced);
    floorThings.filter(function (e) { return e.it.h <= 150; }).forEach(drawPlaced);
    drawCat(c);
  }
  function drawDrag(c) {
    if (!drag) return;
    var r = toRoom(drag.x, drag.y);
    var below = itemHeightBelowFinger(drag.it);
    var overDrawer = drag.y > drawer.getBoundingClientRect().top - 4;
    if (!overDrawer) {
      // where it would land
      var p = snap(drag.it, r.x, r.y + below), q = placeXY(p);
      c.save(); c.globalAlpha = 0.35; c.translate(q.x, q.y); drawItem(c, drag.it, time); c.restore();
      if (p.s !== 'wall') { ell(c, q.x, q.y, itemWidth(drag.it) * 0.45, 8); c.fillStyle = 'rgba(255,201,60,.6)'; c.fill(); }
    }
    c.save(); c.translate(r.x, r.y + below); c.scale(1.08, 1.08); c.rotate(Math.sin(time * 8) * 0.04);
    drawItem(c, drag.it, time);
    c.restore();
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    time += dt;
    Object.keys(wig).forEach(function (k) { wig[k] -= dt; if (wig[k] <= 0) delete wig[k]; });
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 380) * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; }
    if (mode === 'room') {
      updateCat(dt);
      // smooth scrolling from the arrow buttons, and nudging along while carrying something near an edge
      if (scrollTo !== null) { var d = scrollTo - SX; if (Math.abs(d) < 1) { setScroll(scrollTo); scrollTo = null; } else setScroll(SX + d * Math.min(1, dt * 8)); }
      if (drag) {
        var edge = 70, vx = OX + VIEW_W * K;
        if (drag.x < OX + edge) setScroll(SX - 700 * dt * (1 - (drag.x - OX) / edge));
        else if (drag.x > vx - edge && drag.y < drawer.getBoundingClientRect().top) setScroll(SX + 700 * dt * (1 - (vx - drag.x) / edge));
      }
    } else if (grow) updateGrow(dt);

    var vw = (mode === 'room' ? VIEW_W : LAY.W) * K, vh = LAY.H * K;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    rr(ctx, OX, OY, vw, vh, 22); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * (OX - SX * K), dpr * OY);
    if (mode === 'room') drawRoomScene(ctx); else if (grow) drawBench(ctx);
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, vw, vh, 22); ink(ctx, 5);
    if (mode === 'room' && drag) { ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * (OX - SX * K), dpr * OY); drawDrag(ctx); }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(drawer); ro.observe(growbar); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  function refreshCat() { catSetup(); thumbCache = {}; renderDrawer(); }
  window.addEventListener('gg-change', refreshCat);
  window.addEventListener('focus', catSetup);

  // a starter room for a brand new home: a rug and a lamp, so it doesn't feel empty
  if (!S.placed.length && !S.plants.length && !S.started) {
    S.placed.push({ u: 't-rug', s: 'floor', f: 0.35 }, { u: 't-lamp', s: 'floor', f: 0.06 }, { u: 't-picture', s: 'wall', f: 0.12, g: 0.15 });
    S.started = true; save();
  }
  renderDrawer();
  layout();
  requestAnimationFrame(frame);
  setTimeout(function () { if (!S.plants.length) say('Tap Grow to plant your first plant!', 2.6); }, 700);

  /* test hook for automated checks */
  window.__home = {
    state: function () { return JSON.parse(JSON.stringify(S)); },
    mode: function () { return mode; },
    grow: function () { return grow ? { step: grow.step, soil: grow.soil, water: grow.water, g: grow.g } : null; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    bench: function () { return bench(); },
    surface: function (k) { return LAY.surfaces[k]; },
    layout: function () { return { W: LAY.W, H: LAY.H, K: K }; },
    placeXY: function (u) { for (var i = 0; i < S.placed.length; i++) if (S.placed[i].u === u) return placeXY(S.placed[i]); return null; },
    cat: function () { return catXY(); },
    catState: function () { return cat.state; },
    forceNap: function (u) { var it = S.placed.filter(function (p) { return p.u === u; })[0]; if (it) { cat.target = it.f; cat.state = 'walk'; cat.then = 'nap'; cat.napU = u; } },
    scroll: function () { return SX; }
  };
})();
