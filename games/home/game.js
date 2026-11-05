/* Cosy Home – a room to decorate with things you've grown, made and earned.
   - Plants come from the Grow game (games/grow/plants.js, window.GGPlants, which also draws them).
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
  /* plants and their drawing live with the Grow game (games/grow/plants.js) */
  var GP = window.GGPlants;
  var FLOWER = GP.FLOWER, PLANTS = GP.PLANTS, drawPotted = GP.drawPotted, drawPlant = GP.drawPlant;
  var PL = GP.load();                      // load first: it moves any plants out of an older home save
  function plants() { return PL.plants; }
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
    { id: 'cushions', name: 'Cushions', w: 120, h: 80, need: { save: 'kittypop', level: 3, text: 'Reach level 3 in Kitty Match' } },
    { id: 'fishbowl', name: 'Fish bowl', w: 100, h: 110, need: { save: 'kittypop', level: 6, text: 'Reach level 6 in Kitty Match' } },
    { id: 'teapot', name: 'Teapot', w: 100, h: 85, need: { save: 'cooking', made: 1, text: 'Cook a dish in Cosy Kitchen' } },
    { id: 'cake', name: 'Cake stand', w: 100, h: 125, need: { save: 'cooking', made: 5, text: 'Cook 5 dishes in Cosy Kitchen' } }
  ];
  var WALLS = [
    { wall: '#FFE7C2', pat: '#FFD9A3' }, { wall: '#FFD9E4', pat: '#FFC2D4' }, { wall: '#D7F2DF', pat: '#BFE8CB' },
    { wall: '#D9ECFF', pat: '#C0DEFF' }, { wall: '#E8DDFF', pat: '#D7C7FF' }, { wall: '#FFF3B8', pat: '#FFE88A' },
    { wall: '#FFFFFF', pat: '#F1EAF8' }, { wall: '#FFD3C4', pat: '#FFBCA6' }, { wall: '#CDEFF0', pat: '#AEE3E5' }, { wall: '#5E5675', pat: '#6E6687' }
  ];
  function findDef(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* Everything is open from the start (no locked items: the user's call, to keep clear of unlock-chasing).
     The `need` notes on THINGS are kept in case gentle surprise unlocks come back; set this to false to use them. */
  var ALL_OPEN = true;
  function thingUnlocked(t) {
    if (ALL_OPEN || !t.need) return true;
    var p = {};
    try { p = GG.getProgress(t.need.save) || {}; } catch (e) {}
    if (t.need.level) return (p.level || 1) >= t.need.level;
    if (t.need.made) return (p.made || 0) >= t.need.made;
    return false;
  }

  /* ================= saved state ================= */
  function blank() { return { v: 1, placed: [], wall: 0 }; }
  var S = (function () {
    var p = {};
    try { p = GG.getProgress('home') || {}; } catch (e) {}
    var b = blank();
    delete p.plants; delete p.next; delete p.grown;
    if (!Array.isArray(p.placed)) p.placed = b.placed;
    if (typeof p.wall !== 'number') p.wall = b.wall;
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
      var pls = plants();
      for (var i = 0; i < pls.length; i++) if ('p' + pls[i].id === u) {
        var pl = pls[i], d = findDef(PLANTS, pl.t);
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
  function makeLayout(tall) {
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
  var topbar = $('topbar'), drawer = $('drawer');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, LAY = makeLayout(false), SX = 0, VIEW_W = 1000, scrollTo = null;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var bar = drawer;
    var bottom = bar.getBoundingClientRect().top - 8;
    document.documentElement.style.setProperty('--bar-h', Math.round(ch - bar.getBoundingClientRect().top) + 'px');
    var availW = cw - 16, availH = Math.max(120, bottom - top);
    var tall = availW / availH < 1.05;
    LAY = makeLayout(tall);
    K = Math.min(availH / LAY.H, 1.3);
    VIEW_W = Math.min(LAY.W, availW / K);
    OX = (cw - VIEW_W * K) / 2;
    SX = clamp(SX, 0, LAY.W - VIEW_W);
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
  var mode = 'room';
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
      if (!plants().length) html = '<p class="empty">No plants yet. Grow some in the Grow game and they\u2019ll be here!</p>';
      plants().slice().reverse().forEach(function (pl) {
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
    if (pan && pan.id === e.pointerId) { setScroll(pan.sx - (e.clientX - pan.x) / K); return; }
    if (!roomPress || roomPress.id !== e.pointerId || drag) return;
    if (Math.hypot(e.clientX - roomPress.x, e.clientY - roomPress.y) < 8) return;
    drag = { u: roomPress.hit.p.u, it: roomPress.hit.it, x: e.clientX, y: e.clientY, from: 'room', pid: e.pointerId };
    S.placed = S.placed.filter(function (p) { return p.u !== drag.u; });
    Sound.pick(); roomPress = null;
  });
  canvas.addEventListener('pointerup', function (e) {
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
    }

    var vw = VIEW_W * K, vh = LAY.H * K;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    rr(ctx, OX, OY, vw, vh, 22); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * (OX - SX * K), dpr * OY);
    drawRoomScene(ctx);
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, vw, vh, 22); ink(ctx, 5);
    if (mode === 'room' && drag) { ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * (OX - SX * K), dpr * OY); drawDrag(ctx); }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(drawer); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  function refreshCat() { catSetup(); thumbCache = {}; renderDrawer(); }
  window.addEventListener('gg-change', refreshCat);
  window.addEventListener('focus', catSetup);

  // a starter room for a brand new home: a rug and a lamp, so it doesn't feel empty
  if (!S.placed.length && !plants().length && !S.started) {
    S.placed.push({ u: 't-rug', s: 'floor', f: 0.35 }, { u: 't-lamp', s: 'floor', f: 0.06 }, { u: 't-picture', s: 'wall', f: 0.12, g: 0.15 });
    S.started = true; save();
  }
  renderDrawer();
  layout();
  requestAnimationFrame(frame);
  // plants grown in another tab show up when you come back
  window.addEventListener('focus', function () { PL = GP.load(); renderDrawer(); });

  /* test hook for automated checks */
  window.__home = {
    state: function () { return JSON.parse(JSON.stringify(S)); },
    mode: function () { return mode; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    surface: function (k) { return LAY.surfaces[k]; },
    layout: function () { return { W: LAY.W, H: LAY.H, K: K }; },
    placeXY: function (u) { for (var i = 0; i < S.placed.length; i++) if (S.placed[i].u === u) return placeXY(S.placed[i]); return null; },
    cat: function () { return catXY(); },
    catState: function () { return cat.state; },
    forceNap: function (u) { var it = S.placed.filter(function (p) { return p.u === u; })[0]; if (it) { cat.target = it.f; cat.state = 'walk'; cat.then = 'nap'; cat.napU = u; } },
    scroll: function () { return SX; }
  };
})();
