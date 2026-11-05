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
    var lv = function (k) { var p = GG.getProgress(k) || {}; return Math.max(0, (p.level || 1) - 1); };
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
    { id: 'bow', name: 'Headband with bow' },
    { id: 'ponytail', name: 'Ponytail' },
    { id: 'pigtails', name: 'Pigtails' },
    { id: 'spiky', name: 'Spiky hair' },
    { id: 'chef', name: 'Chef’s hat', earn: { hint: 'Cook 5 dishes in Cosy Kitchen', test: function (s) { return s.dishes >= 5; } } },
    { id: 'tophat', name: 'Top hat', earn: { hint: 'Cook every Cosy Kitchen recipe', test: function (s) { return s.handroll && s.pancakes && s.burger; } } },
    { id: 'fireman', name: 'Firefighter’s helmet', earn: { hint: 'Finish 10 Kitty Pop levels', test: function (s) { return s.kittypop >= 10; } } },
    { id: 'witch', name: 'Witch’s hat', earn: { hint: 'Finish 10 Yarn Sort levels', test: function (s) { return s.yarn >= 10; } } },
    { id: 'tiara', name: 'Tiara', earn: { hint: 'Finish 10 Cosy Cubbies levels', test: function (s) { return s.cubbies >= 10; } } },
    { id: 'unicorn', name: 'Unicorn horn', earn: { hint: 'Finish 15 levels in any games', test: function (s) { return s.levels >= 15; } } },
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
  function headGeom(type) {
    if (type === 'chubby') return { cx: 60, cy: 72, rx: 40, ry: 31 };
    if (type === 'fluffy') return { cx: 60, cy: 71, rx: 35, ry: 30 };
    return { cx: 60, cy: 71, rx: 34, ry: 29 };
  }
  function headPath(type, g) {
    if (type !== 'fluffy') return null;
    // a scalloped outline for the fluffy cat
    var d = '', n = 16;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2, x = g.cx + Math.cos(a) * g.rx, y = g.cy + Math.sin(a) * g.ry;
      if (i === 0) d += 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
      else {
        var am = ((i - 0.5) / n) * Math.PI * 2, bx = g.cx + Math.cos(am) * (g.rx + 7), by = g.cy + Math.sin(am) * (g.ry + 7);
        d += ' Q' + bx.toFixed(1) + ' ' + by.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1);
      }
    }
    return d + 'Z';
  }
  function headShape(type, g, attrs) {
    var p = headPath(type, g);
    return p ? '<path d="' + p + '" ' + attrs + '/>' : '<ellipse cx="' + g.cx + '" cy="' + g.cy + '" rx="' + g.rx + '" ry="' + g.ry + '" ' + attrs + '/>';
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
      case 'bow': return '<path d="M30 ' + (top + 14) + ' Q60 ' + (top - 6) + ' 90 ' + (top + 14) + '" fill="none" stroke="#FF7EB6" stroke-width="7" stroke-linecap="round"/><path d="M30 ' + (top + 14) + ' Q60 ' + (top - 6) + ' 90 ' + (top + 14) + '" fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round" opacity=".35"/><g transform="translate(78 ' + (top + 2) + ')"><path d="M0 0 L-14 -10 L-14 10 Z M0 0 L14 -10 L14 10 Z" fill="#FF7EB6" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/><circle r="4.5" fill="#FFC93C" stroke="' + INK + '" stroke-width="2.5"/></g>';
      case 'ponytail': case 'pigtails': case 'braid':
        return '<path d="M38 ' + (top + 14) + ' Q42 ' + (top - 4) + ' 60 ' + (top - 3) + ' Q78 ' + (top - 4) + ' 82 ' + (top + 14) + ' Q74 ' + (top + 6) + ' 66 ' + (top + 12) + ' Q60 ' + (top + 4) + ' 54 ' + (top + 12) + ' Q46 ' + (top + 6) + ' 38 ' + (top + 14) + ' Z" fill="' + hair + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
      case 'spiky': return '<path d="M40 ' + (top + 10) + ' L42 ' + (top - 10) + ' L50 ' + (top + 2) + ' L56 ' + (top - 16) + ' L62 ' + (top + 1) + ' L70 ' + (top - 14) + ' L72 ' + (top + 3) + ' L82 ' + (top - 6) + ' L80 ' + (top + 12) + ' Q60 ' + (top + 2) + ' 40 ' + (top + 10) + ' Z" fill="' + hair + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
      case 'mohawk': return '<path d="M50 ' + (top + 6) + ' L48 ' + (top - 14) + ' L55 ' + (top - 6) + ' L57 ' + (top - 26) + ' L62 ' + (top - 8) + ' L68 ' + (top - 22) + ' L68 ' + (top - 4) + ' L74 ' + (top - 12) + ' L71 ' + (top + 6) + ' Z" fill="#9B7BFF" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M53 ' + (top - 2) + ' L57 ' + (top - 18) + ' M63 ' + (top - 2) + ' L67 ' + (top - 14) + '" stroke="#FF7EB6" stroke-width="3" stroke-linecap="round"/>';
      case 'chef': return '<g stroke="' + INK + '" stroke-width="3"><rect x="44" y="' + (top - 6) + '" width="32" height="14" rx="4" fill="#fff"/><circle cx="48" cy="' + (top - 12) + '" r="10" fill="#fff"/><circle cx="72" cy="' + (top - 12) + '" r="10" fill="#fff"/><circle cx="60" cy="' + (top - 19) + '" r="12" fill="#fff"/></g><rect x="45.5" y="' + (top - 8) + '" width="29" height="8" fill="#fff"/>';
      case 'tophat': return '<g stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><ellipse cx="60" cy="' + (top + 4) + '" rx="26" ry="6" fill="#3A3350"/><rect x="45" y="' + (top - 26) + '" width="30" height="30" rx="3" fill="#3A3350"/></g><rect x="46.5" y="' + (top - 6) + '" width="27" height="6" fill="#FF6B57"/>';
      case 'fireman': return '<g stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><path d="M28 ' + (top + 12) + ' Q30 ' + (top + 2) + ' 40 ' + (top + 6) + ' Q42 ' + (top - 20) + ' 60 ' + (top - 20) + ' Q78 ' + (top - 20) + ' 80 ' + (top + 6) + ' Q90 ' + (top + 2) + ' 92 ' + (top + 12) + ' Z" fill="#E8413B"/><path d="M60 ' + (top - 20) + ' L60 ' + (top + 6) + '" fill="none"/></g><path d="M52 ' + (top - 8) + ' L60 ' + (top - 14) + ' L68 ' + (top - 8) + ' L66 ' + (top) + ' L54 ' + (top) + ' Z" fill="#FFC93C" stroke="' + INK + '" stroke-width="2"/>';
      case 'witch': return '<g stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><ellipse cx="58" cy="' + (top + 6) + '" rx="34" ry="7" fill="#6B4FC7"/><path d="M42 ' + (top + 4) + ' Q50 ' + (top - 18) + ' 54 ' + (top - 26) + ' Q60 ' + (top - 38) + ' 80 ' + (top - 34) + ' Q66 ' + (top - 26) + ' 74 ' + (top + 4) + ' Z" fill="#6B4FC7"/></g><path d="M44 ' + (top - 2) + ' Q58 ' + (top + 2) + ' 73 ' + (top - 2) + '" fill="none" stroke="#FFC93C" stroke-width="5"/><circle cx="76" cy="' + (top - 33) + '" r="3.5" fill="#FFC93C" stroke="' + INK + '" stroke-width="2"/>';
      case 'tiara': return '<path d="M42 ' + (top + 8) + ' L44 ' + (top - 6) + ' L52 ' + (top + 1) + ' L60 ' + (top - 12) + ' L68 ' + (top + 1) + ' L76 ' + (top - 6) + ' L78 ' + (top + 8) + ' Z" fill="#FFC93C" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="' + (top + 1) + '" r="3.5" fill="#FF7EB6" stroke="' + INK + '" stroke-width="1.5"/><circle cx="48" cy="' + (top + 4) + '" r="2.5" fill="#3FA7F5"/><circle cx="72" cy="' + (top + 4) + '" r="2.5" fill="#3FA7F5"/>';
      case 'unicorn': return '<path d="M53 ' + (top + 8) + ' L60 ' + (top - 26) + ' L67 ' + (top + 8) + ' Z" fill="#FFE27A" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M55 ' + (top) + ' L65 ' + (top - 4) + ' M56 ' + (top - 8) + ' L64 ' + (top - 12) + ' M58 ' + (top - 16) + ' L62 ' + (top - 18) + '" stroke="#FF7EB6" stroke-width="2.5" stroke-linecap="round"/>';
      default: return '';
    }
  }

  function drawFaceAcc(face, line) {
    switch (face) {
      case 'glasses': return '<g fill="#fff" fill-opacity=".25" stroke="' + INK + '" stroke-width="3"><circle cx="49" cy="69" r="9"/><circle cx="71" cy="69" r="9"/></g><path d="M58 68 Q60 66 62 68" fill="none" stroke="' + INK + '" stroke-width="3"/>';
      case 'sunglasses': return '<g stroke="' + INK + '" stroke-width="2.5"><rect x="38" y="62" width="20" height="13" rx="5" fill="#2A2340"/><rect x="62" y="62" width="20" height="13" rx="5" fill="#2A2340"/></g><path d="M58 66 L62 66" stroke="' + INK + '" stroke-width="3"/><path d="M42 66 L47 66 M66 66 L71 66" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>';
      case 'cheeks': return '<ellipse cx="40" cy="80" rx="8" ry="5" fill="#FF6B8A" opacity=".75"/><ellipse cx="80" cy="80" rx="8" ry="5" fill="#FF6B8A" opacity=".75"/>';
      case 'freckles': return '<g fill="#B5651D"><circle cx="45" cy="78" r="1.6"/><circle cx="49" cy="81" r="1.6"/><circle cx="42" cy="82" r="1.6"/><circle cx="75" cy="78" r="1.6"/><circle cx="71" cy="81" r="1.6"/><circle cx="78" cy="82" r="1.6"/></g>';
      case 'moustache': return '<path d="M60 79 Q52 76 46 80 Q44 86 50 84 Q55 82 60 81 Q65 82 70 84 Q76 86 74 80 Q68 76 60 79 Z" fill="#6B4226" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
      case 'beard': return '<path d="M34 80 Q36 96 48 102 Q60 108 72 102 Q84 96 86 80 Q80 90 70 90 Q60 94 50 90 Q40 90 34 80 Z" fill="#8B5A3C" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
      default: return '';
    }
  }

  /* the whole avatar as an SVG string */
  function svg(av, size) {
    av = normalise(av);
    size = size || 64;
    var col = av.type === 'calico' ? '#FFFFFF' : av.color, dark = isDark(col), line = INK;   // calico cats are always white with patches
    var g = headGeom(av.type), hair = shade(av.type === 'tuxedo' || av.type === 'calico' ? '#8B5A3C' : col, dark ? -0.6 : 0.35);
    if (dark) hair = '#2E2A3A';
    if (av.head === 'braid') hair = '#F2C14E';   // Rapunzel's golden hair
    var uid = 'av' + Math.random().toString(36).slice(2, 8);
    var o = '<svg viewBox="0 0 120 120" width="' + size + '" height="' + size + '" aria-hidden="true" style="overflow:visible">';
    o += '<circle cx="60" cy="60" r="57" fill="' + av.bg + '" stroke="' + INK + '" stroke-width="3"/>';
    o += drawBack(av.head, hair);
    // ears
    var ear = av.type === 'chubby' ? ['M26 58 L26 26 L50 42 Z', 'M94 58 L94 26 L70 42 Z', 'M31 50 L31 33 L44 42 Z', 'M89 50 L89 33 L76 42 Z']
      : ['M30 56 L28 22 L52 40 Z', 'M90 56 L92 22 L68 40 Z', 'M34 48 L33 30 L46 40 Z', 'M86 48 L87 30 L74 40 Z'];
    var earCol = av.type === 'calico' ? ['#FFA94D', '#4A4458'] : [col, col];
    o += '<path d="' + ear[0] + '" fill="' + earCol[0] + '" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>';
    o += '<path d="' + ear[1] + '" fill="' + earCol[1] + '" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>';
    o += '<path d="' + ear[2] + ' ' + ear[3] + '" fill="#FFB3C7"/>';
    // head and markings, clipped to the head
    o += '<defs><clipPath id="' + uid + '">' + headShape(av.type, g, '') + '</clipPath></defs>';
    o += headShape(av.type, g, 'fill="' + col + '"');
    o += '<g clip-path="url(#' + uid + ')">';
    if (av.type === 'tabby') {
      var st = shade(col, dark ? -0.5 : 0.28);
      o += '<path d="M52 ' + (g.cy - g.ry) + ' L54 ' + (g.cy - g.ry + 12) + ' M60 ' + (g.cy - g.ry - 2) + ' L60 ' + (g.cy - g.ry + 14) + ' M68 ' + (g.cy - g.ry) + ' L66 ' + (g.cy - g.ry + 12) + ' M24 66 L36 70 M24 76 L35 76 M96 66 L84 70 M96 76 L85 76" stroke="' + st + '" stroke-width="4.5" stroke-linecap="round"/>';
    }
    if (av.type === 'calico') o += '<path d="M20 40 Q44 38 50 58 Q40 70 20 66 Z" fill="#FFA94D"/><path d="M100 44 Q78 40 72 56 Q80 68 100 64 Z" fill="#4A4458"/><ellipse cx="80" cy="100" rx="14" ry="8" fill="#FFA94D"/>';
    if (av.type === 'tuxedo') o += '<path d="M60 52 Q52 70 46 78 Q42 92 60 102 Q78 92 74 78 Q68 70 60 52 Z" fill="#FFFFFF"/>';
    o += '</g>';
    o += headShape(av.type, g, 'fill="none" stroke="' + INK + '" stroke-width="3.5"');
    // face
    var faceLine = dark && av.type !== 'tuxedo' ? '#FFF8EC' : line;
    if (av.face === 'mask') o += '<path d="M30 64 Q34 56 46 59 Q60 63 74 59 Q86 56 90 64 Q88 76 76 76 Q66 76 60 70 Q54 76 44 76 Q32 76 30 64 Z" fill="#E8413B" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
    var eyeLine = av.face === 'mask' ? '#FFF8EC' : (dark ? '#FFF8EC' : line);
    if (av.face !== 'sunglasses') o += '<path d="M44 70 Q49 63 54 70 M66 70 Q71 63 76 70" fill="none" stroke="' + eyeLine + '" stroke-width="3.5" stroke-linecap="round"/>';
    if (av.face !== 'cheeks') o += '<ellipse cx="41" cy="80" rx="6" ry="3.5" fill="#FF8FAB" opacity=".7"/><ellipse cx="79" cy="80" rx="6" ry="3.5" fill="#FF8FAB" opacity=".7"/>';
    o += '<path d="M57 75 L63 75 L60 78.5 Z" fill="#FF8FAB" stroke="' + faceLine + '" stroke-width="1.5" stroke-linejoin="round"/>';
    if (av.face !== 'moustache' && av.face !== 'beard') o += '<path d="M54 81 Q57 85 60 81 Q63 85 66 81" fill="none" stroke="' + faceLine + '" stroke-width="2.5" stroke-linecap="round"/>';
    o += '<g stroke="' + faceLine + '" stroke-width="2" stroke-linecap="round"><line x1="20" y1="76" x2="34" y2="78"/><line x1="21" y1="84" x2="34" y2="83"/><line x1="100" y1="76" x2="86" y2="78"/><line x1="99" y1="84" x2="86" y2="83"/></g>';
    o += drawFaceAcc(av.face, faceLine);
    o += drawFront(av.head, hair, g);
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
