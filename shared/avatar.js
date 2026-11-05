/* Cosy Cat Games: cat avatars.
   An avatar is { type, color, bg, head, face }, drawn as SVG in code.
   Some items are earned by things done in the games (levels finished, dishes cooked), never by
   days played, streaks or paying. Unlock rules read the progress games already save.
   New games add 2–3 earned items of their own here. */
(function () {
  var INK = '#2A2340';

  var CAT_COLOURS = ['#FFA94D', '#FFE3B8', '#FFFFFF', '#B9B4C7', '#5B5470', '#C98B5B', '#FFB3C7', '#9ED8FF'];
  var BG_COLOURS = ['#FF6B57', '#3FA7F5', '#FFC93C', '#7BD389', '#FF7EB6', '#9B7BFF', '#BFE0FF', '#FFF1B8'];

  /* ---------- colour helpers ---------- */
  function rgb(hex) { var h = String(hex || '#ffffff').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hex(r, g, b) { return '#' + [r, g, b].map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function shade(c, k) { var a = rgb(c); return hex(a[0] * (1 - k), a[1] * (1 - k), a[2] * (1 - k)); }
  function isDark(c) { var a = rgb(c); return (0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]) < 110; }
  function validColour(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c); }

  /* ---------- the progress games already save, boiled down for unlock rules ---------- */
  function stats(GG) {
    // levels finished: games save { level, done }; older saves only have level (the next one to play)
    var lv = function (k) { var p = GG.getProgress(k) || {}; return Math.max(p.done || 0, (p.level || 1) - 1); };
    var cook = GG.getProgress('cooking') || {};
    var by = cook.byDish || {};
    var s = {
      kittypop: lv('kittypop'), cubbies: lv('cubbies'), yarn: lv('yarn'),
      dishes: cook.made || 0,
      handroll: by.handroll || 0, pancakes: by.pancakes || 0, burger: by.burger || 0
    };
    s.levels = s.kittypop + s.cubbies + s.yarn;
    s.games = [s.kittypop, s.cubbies, s.yarn, s.dishes].filter(function (n) { return n > 0; }).length;
    return s;
  }

  /* ---------- the catalogue ---------- */
  // earn: { hint, test(stats) } for earned items; none = standard (everyone has it)
  var TYPES = [
    { id: 'short', name: 'Short hair' },
    { id: 'chubby', name: 'Chubby' },
    { id: 'fluffy', name: 'Fluffy' },
    { id: 'tabby', name: 'Tabby stripes' },
    { id: 'calico', name: 'Calico', earn: { hint: 'Finish your first level or dish', test: function (s) { return s.levels + s.dishes >= 1; } } },
    { id: 'tuxedo', name: 'Tuxedo', earn: { hint: 'Finish a level in 3 different games', test: function (s) { return s.games >= 3; } } }
  ];
  var HEADS = [
    { id: 'none', name: 'Nothing' },
    { id: 'party', name: 'Party hat' },
    { id: 'bow', name: 'Bow' },
    { id: 'ponytail', name: 'Ponytail' },
    { id: 'pigtails', name: 'Pigtails' },
    { id: 'spiky', name: 'Spiky hair' },
    { id: 'chef', name: 'Chef’s hat', earn: { hint: 'Cook 5 dishes in Cosy Kitchen', test: function (s) { return s.dishes >= 5; } } },
    { id: 'tophat', name: 'Top hat' },
    { id: 'fireman', name: 'Firefighter’s helmet' },
    { id: 'witch', name: 'Witch’s hat', earn: { hint: 'Finish 10 Yarn Sort levels', test: function (s) { return s.yarn >= 10; } } },
    { id: 'tiara', name: 'Tiara', earn: { hint: 'Finish 10 Cosy Cubbies levels', test: function (s) { return s.cubbies >= 10; } } },
    { id: 'unicorn', name: 'Unicorn horn' },
    { id: 'mohawk', name: 'Mohawk', earn: { hint: 'Finish 25 levels in any games', test: function (s) { return s.levels >= 25; } } },
    { id: 'braid', name: 'Rapunzel braid', earn: { hint: 'Finish 50 levels in any games', test: function (s) { return s.levels >= 50; } } }
  ];
  var FACES = [
    { id: 'none', name: 'Nothing' },
    { id: 'glasses', name: 'Round glasses' },
    { id: 'sunglasses', name: 'Sunglasses' },
    { id: 'cheeks', name: 'Rosy cheeks' },
    { id: 'freckles', name: 'Freckles' },
    { id: 'moustache', name: 'Moustache', earn: { hint: 'Cook 3 burgers', test: function (s) { return s.burger >= 3; } } },
    { id: 'beard', name: 'Beard', earn: { hint: 'Cook 3 pancake stacks', test: function (s) { return s.pancakes >= 3; } } },
    { id: 'mask', name: 'Superhero mask', earn: { hint: 'Finish 25 Kitty Pop levels', test: function (s) { return s.kittypop >= 25; } } }
  ];
  var ALL = TYPES.concat(HEADS, FACES);
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* ---------- drawing (viewBox 0 0 120 120, head centred near 60,70) ---------- */
  /* where the shared cat's head sits in the 120 box, for placing hats and hair */
  function headGeom(type) {
    if (type === 'chubby') return { cx: 60, cy: 71.8, rx: 38.6, ry: 30.1 };
    if (type === 'fluffy') return { cx: 60, cy: 71, rx: 32.5, ry: 27 };
    return { cx: 60, cy: 71, rx: 34, ry: 28.6 };
  }
  function drawBack(head, hair) {
    if (head === 'ponytail') return '<path d="M84 44 Q112 38 108 76 Q104 96 92 102 Q100 80 90 62 Z" fill="' + hair + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><rect x="82" y="40" width="12" height="10" rx="4" fill="#FF7EB6" stroke="' + INK + '" stroke-width="2.5" transform="rotate(25 88 45)"/>';
    if (head === 'pigtails') return '<g fill="' + hair + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><path d="M28 60 Q6 62 8 86 Q12 100 22 96 Q16 80 30 72 Z"/><path d="M92 60 Q114 62 112 86 Q108 100 98 96 Q104 80 90 72 Z"/></g><g fill="#7BD389" stroke="' + INK + '" stroke-width="2.5"><circle cx="27" cy="64" r="5"/><circle cx="93" cy="64" r="5"/></g>';
    if (head === 'braid') {
      var b = '<g fill="' + hair + '" stroke="' + INK + '" stroke-width="2.5">';
      for (var i = 0; i < 6; i++) b += '<ellipse cx="' + (92 + (i % 2) * 3) + '" cy="' + (58 + i * 11) + '" rx="8" ry="7"/>';
      return b + '</g><circle cx="95" cy="116" r="4" fill="#FF7EB6" stroke="' + INK + '" stroke-width="2"/>';
    }
    return '';
  }

  function drawFront(head, hair, g) {
    var top = g.cy - g.ry;
    switch (head) {
      case 'party': return '<path d="M46 ' + (top + 6) + ' L60 ' + (top - 30) + ' L74 ' + (top + 6) + ' Z" fill="#9B7BFF" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M51 ' + (top - 6) + ' L69 ' + (top - 6) + ' M55 ' + (top - 17) + ' L65 ' + (top - 17) + '" stroke="#FFC93C" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="' + (top - 31) + '" r="6" fill="#FF7EB6" stroke="' + INK + '" stroke-width="2.5"/>';
      case 'bow': return '<g transform="translate(76 ' + (top + 3) + ') rotate(18)" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round">' +
        '<path d="M-3 4 L-9 16 L-3 14 L0 18 L1 6 M3 4 L9 16 L3 14 L0 18" fill="#FF4F86"/>' +
        '<path d="M0 0 C-5 -12 -22 -13 -20 0 C-22 13 -5 12 0 0 Z M0 0 C5 -12 22 -13 20 0 C22 13 5 12 0 0 Z" fill="#FF7EB6"/>' +
        '<path d="M-6 -4 Q-12 -6 -15 -2 M6 -4 Q12 -6 15 -2" fill="none" stroke="#FFC4DA" stroke-width="2" stroke-linecap="round"/>' +
        '<ellipse cx="0" cy="0" rx="5" ry="6" fill="#FF4F86"/></g>';
      case 'ponytail': case 'pigtails': case 'braid':
        return '<path d="M38 ' + (top + 14) + ' Q42 ' + (top - 4) + ' 60 ' + (top - 3) + ' Q78 ' + (top - 4) + ' 82 ' + (top + 14) + ' Q74 ' + (top + 6) + ' 66 ' + (top + 12) + ' Q60 ' + (top + 4) + ' 54 ' + (top + 12) + ' Q46 ' + (top + 6) + ' 38 ' + (top + 14) + ' Z" fill="' + hair + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
      case 'spiky': return '<path d="M38 ' + (top + 12) + ' Q35 ' + (top - 2) + ' 41 ' + (top - 12) + ' Q44 ' + (top - 3) + ' 49 ' + (top - 1) + ' Q47 ' + (top - 16) + ' 55 ' + (top - 22) + ' Q56 ' + (top - 8) + ' 61 ' + (top - 4) + ' Q65 ' + (top - 18) + ' 75 ' + (top - 19) + ' Q69 ' + (top - 8) + ' 71 ' + (top - 2) + ' Q80 ' + (top - 8) + ' 86 ' + (top - 2) + ' Q80 ' + (top + 2) + ' 82 ' + (top + 12) + ' Q72 ' + (top + 3) + ' 64 ' + (top + 8) + ' Q57 ' + (top + 2) + ' 50 ' + (top + 9) + ' Q44 ' + (top + 4) + ' 38 ' + (top + 12) + ' Z" fill="' + hair + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M48 ' + (top + 2) + ' Q50 ' + (top - 6) + ' 54 ' + (top - 12) + ' M64 ' + (top) + ' Q66 ' + (top - 8) + ' 71 ' + (top - 12) + '" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.2" stroke-linecap="round"/>';
      case 'mohawk': return '<path d="M50 ' + (top + 6) + ' L48 ' + (top - 14) + ' L55 ' + (top - 6) + ' L57 ' + (top - 26) + ' L62 ' + (top - 8) + ' L68 ' + (top - 22) + ' L68 ' + (top - 4) + ' L74 ' + (top - 12) + ' L71 ' + (top + 6) + ' Z" fill="#9B7BFF" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M53 ' + (top - 2) + ' L57 ' + (top - 18) + ' M63 ' + (top - 2) + ' L67 ' + (top - 14) + '" stroke="#FF7EB6" stroke-width="3" stroke-linecap="round"/>';
      case 'tophat': return '<g stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><ellipse cx="60" cy="' + (top + 4) + '" rx="26" ry="6" fill="#3A3350"/><rect x="45" y="' + (top - 26) + '" width="30" height="30" rx="3" fill="#3A3350"/></g><rect x="46.5" y="' + (top - 6) + '" width="27" height="6" fill="#FF6B57"/>';
      case 'fireman': return '<g stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><path d="M28 ' + (top + 12) + ' Q30 ' + (top + 2) + ' 40 ' + (top + 6) + ' Q42 ' + (top - 20) + ' 60 ' + (top - 20) + ' Q78 ' + (top - 20) + ' 80 ' + (top + 6) + ' Q90 ' + (top + 2) + ' 92 ' + (top + 12) + ' Z" fill="#E8413B"/><path d="M60 ' + (top - 20) + ' L60 ' + (top + 6) + '" fill="none"/></g><path d="M52 ' + (top - 8) + ' L60 ' + (top - 14) + ' L68 ' + (top - 8) + ' L66 ' + (top) + ' L54 ' + (top) + ' Z" fill="#FFC93C" stroke="' + INK + '" stroke-width="2"/>';
      case 'witch': return '<g stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><ellipse cx="58" cy="' + (top + 6) + '" rx="34" ry="7" fill="#6B4FC7"/><path d="M42 ' + (top + 4) + ' Q50 ' + (top - 18) + ' 54 ' + (top - 26) + ' Q60 ' + (top - 38) + ' 80 ' + (top - 34) + ' Q66 ' + (top - 26) + ' 74 ' + (top + 4) + ' Z" fill="#6B4FC7"/></g><path d="M44 ' + (top - 2) + ' Q58 ' + (top + 2) + ' 73 ' + (top - 2) + '" fill="none" stroke="#FFC93C" stroke-width="5"/><circle cx="76" cy="' + (top - 33) + '" r="3.5" fill="#FFC93C" stroke="' + INK + '" stroke-width="2"/>';
      case 'tiara': return '<g stroke="' + INK + '" stroke-linejoin="round">' +
        '<path d="M38 ' + (top + 10) + ' Q41 ' + (top - 1) + ' 48 ' + (top + 2) + ' Q53 ' + (top - 13) + ' 60 ' + (top - 17) + ' Q67 ' + (top - 13) + ' 72 ' + (top + 2) + ' Q79 ' + (top - 1) + ' 82 ' + (top + 10) + ' Q60 ' + (top + 3) + ' 38 ' + (top + 10) + ' Z" fill="#FFD34D" stroke-width="2.5"/>' +
        '<path d="M42 ' + (top + 7) + ' Q60 ' + (top + 1) + ' 78 ' + (top + 7) + '" fill="none" stroke="#E0A800" stroke-width="2"/>' +
        '<path d="M60 ' + (top - 10) + ' Q65 ' + (top - 4) + ' 60 ' + (top + 1) + ' Q55 ' + (top - 4) + ' 60 ' + (top - 10) + ' Z" fill="#FF4F86" stroke-width="1.6"/>' +
        '<circle cx="49" cy="' + (top + 4) + '" r="2.8" fill="#3FA7F5" stroke-width="1.4"/><circle cx="71" cy="' + (top + 4) + '" r="2.8" fill="#3FA7F5" stroke-width="1.4"/>' +
        '<circle cx="60" cy="' + (top - 18) + '" r="2.6" fill="#fff" stroke-width="1.4"/><circle cx="40" cy="' + (top + 2) + '" r="2" fill="#fff" stroke-width="1.2"/><circle cx="80" cy="' + (top + 2) + '" r="2" fill="#fff" stroke-width="1.2"/>' +
        '</g>';
      case 'unicorn': return '<path d="M53 ' + (top + 8) + ' L60 ' + (top - 26) + ' L67 ' + (top + 8) + ' Z" fill="#FFE27A" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M55 ' + (top) + ' L65 ' + (top - 4) + ' M56 ' + (top - 8) + ' L64 ' + (top - 12) + ' M58 ' + (top - 16) + ' L62 ' + (top - 18) + '" stroke="#FF7EB6" stroke-width="2.5" stroke-linecap="round"/>';
      default: return '';
    }
  }

  function drawFaceAcc(face) {
    switch (face) {
      case 'glasses': return '<g fill="#fff" fill-opacity=".25" stroke="' + INK + '" stroke-width="3"><circle cx="47.6" cy="68" r="9"/><circle cx="72.4" cy="68" r="9"/></g><path d="M56.6 67 Q60 65 63.4 67" fill="none" stroke="' + INK + '" stroke-width="3"/>';
      case 'sunglasses': return '<g stroke="' + INK + '" stroke-width="2.5"><rect x="36.5" y="61.5" width="21" height="13" rx="5" fill="#2A2340"/><rect x="62.5" y="61.5" width="21" height="13" rx="5" fill="#2A2340"/></g><path d="M57.5 65.5 L62.5 65.5" stroke="' + INK + '" stroke-width="3"/><path d="M40.5 65.5 L45.5 65.5 M66.5 65.5 L71.5 65.5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>';
      case 'cheeks': return '<ellipse cx="40" cy="80" rx="8" ry="5" fill="#FF6B8A" opacity=".75"/><ellipse cx="80" cy="80" rx="8" ry="5" fill="#FF6B8A" opacity=".75"/>';
      case 'freckles': return '<g fill="#B5651D"><circle cx="45" cy="78" r="1.6"/><circle cx="49" cy="81" r="1.6"/><circle cx="42" cy="82" r="1.6"/><circle cx="75" cy="78" r="1.6"/><circle cx="71" cy="81" r="1.6"/><circle cx="78" cy="82" r="1.6"/></g>';
      case 'moustache': return '<path d="M60 79 Q52 76 46 80 Q44 86 50 84 Q55 82 60 81 Q65 82 70 84 Q76 86 74 80 Q68 76 60 79 Z" fill="#6B4226" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
      case 'beard': return '<path d="M34 80 Q36 96 48 102 Q60 108 72 102 Q84 96 86 80 Q80 90 70 90 Q60 94 50 90 Q40 90 34 80 Z" fill="#8B5A3C" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
      default: return '';
    }
  }

  /* the whole avatar as an SVG string: the shared cat (GGCat) on a coloured circle, with hats, hair and face extras.
     The cat sits with its head centred at (60, 71) in a 120 box, 68 wide (the extras below are drawn in that space). */
  var CAT_X = 60, CAT_Y = 66.36, CAT_SIZE = 68, K = CAT_SIZE / 88;
  // turns the box's coordinates into the cat's own 100-unit space, for extras that sit between the head and the eyes
  var TO_CAT = '<g transform="matrix(' + (1 / K).toFixed(4) + ' 0 0 ' + (1 / K).toFixed(4) + ' ' + (-CAT_X / K).toFixed(3) + ' ' + (-CAT_Y / K).toFixed(3) + ')">';
  function svg(av, size) {
    av = normalise(av);
    size = size || 64;
    // calico cats are always white with patches; tuxedo cats always black and white
    var col = av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color, dark = isDark(col);
    var g = headGeom(av.type), hair = shade(av.type === 'tuxedo' || av.type === 'calico' ? '#8B5A3C' : col, dark ? -0.6 : 0.35);
    if (dark) hair = '#2E2A3A';
    if (av.head === 'braid') hair = '#F2C14E';   // Rapunzel's golden hair
    var cat = window.GGCat.g({
      x: CAT_X, y: CAT_Y, size: CAT_SIZE,
      color: col,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none',
      eyes: 'happy', mouth: 'w',
      hat: av.head === 'chef' ? 'chef' : 'none',
      noEyes: av.face === 'sunglasses',
      noMouth: av.face === 'moustache' || av.face === 'beard',
      noCheeks: av.face === 'cheeks',
      eyeColor: av.face === 'mask' ? '#FFF8EC' : undefined,
      svgOverHead: av.face === 'mask' ? TO_CAT + '<path d="M30 63 Q34 55 46 58 Q60 62 74 58 Q86 55 90 63 Q88 75 76 75 Q66 75 60 69 Q54 75 44 75 Q32 75 30 63 Z" fill="#E8413B" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/></g>' : ''
    });
    var o = '<svg viewBox="0 0 120 120" width="' + size + '" height="' + size + '" aria-hidden="true" style="overflow:visible">';
    o += '<circle cx="60" cy="60" r="57" fill="' + av.bg + '" stroke="' + INK + '" stroke-width="3"/>';
    o += drawBack(av.head, hair);
    o += cat;
    o += drawFaceAcc(av.face);
    if (av.head !== 'chef') o += drawFront(av.head, hair, g);
    return o + '</svg>';
  }

  var DEFAULT = { type: 'short', color: '#FFA94D', bg: '#BFE0FF', head: 'none', face: 'none' };
  /* old players had an animal name and a colour; they become a short-haired cat on that colour */
  var FROM_ANIMAL = { cat: '#FFE3B8', bunny: '#FFFFFF', bear: '#C98B5B', frog: '#B9B4C7', panda: '#FFFFFF', fox: '#FFA94D' };
  function normalise(av, oldColor) {
    if (typeof av === 'string') return { type: 'short', color: FROM_ANIMAL[av] || DEFAULT.color, bg: validColour(oldColor) ? oldColor : DEFAULT.bg, head: 'none', face: 'none' };
    av = av && typeof av === 'object' ? av : {};
    return {
      type: find(TYPES, av.type) ? av.type : DEFAULT.type,
      color: validColour(av.color) ? av.color : DEFAULT.color,
      bg: validColour(av.bg) ? av.bg : DEFAULT.bg,
      head: find(HEADS, av.head) ? av.head : 'none',
      face: find(FACES, av.face) ? av.face : 'none'
    };
  }
  function random() {
    var pick = function (l) { return l[Math.floor(Math.random() * l.length)]; };
    return { type: pick(['short', 'chubby', 'fluffy', 'tabby']), color: pick(CAT_COLOURS), bg: pick(BG_COLOURS), head: 'none', face: 'none' };
  }
  /* ids of every earned item this player has unlocked so far (standard items aren't listed) */
  function unlocked(GG) {
    var s = stats(GG);
    return ALL.filter(function (it) { return it.earn && it.earn.test(s); }).map(function (it) { return it.id; });
  }

  window.GGAvatar = {
    TYPES: TYPES, HEADS: HEADS, FACES: FACES, CAT_COLOURS: CAT_COLOURS, BG_COLOURS: BG_COLOURS,
    svg: svg, normalise: normalise, random: random, unlocked: unlocked, stats: stats,
    item: function (id) { return find(ALL, id); }
  };
})();
