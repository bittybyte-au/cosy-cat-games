/* Cosy Cat Games: the game list.
   One entry per game drives the home tiles, age filters, padlocks, the toddler home
   and (later) the parent allow/block lists. Adding a game = one entry here + its folder.

   id        folder name under /games/ (also used by the pass and allow/block lists)
   save      the key the game uses with GG.getProgress / GG.setProgress
   ages      one or more of 'under5', '5-10', '11+' (suggestions only, used by filters)
   toddler   true = shown on the toddler home
   free      what guests and expired passes can play: 'all', a list of parts, or a number of levels
   status    'live' playable, 'soon' greyed "Coming soon" tile while testing, 'dev' hidden on the live site
   season    null, or a season id (e.g. 'christmas') for games that only appear in that season
   badge     optional: progress -> short text for the tile badge, or '' for none */
(function () {
  /* cat heads in the tile pictures are drawn by the shared cat (shared/cat.js, loaded first) */
  function cat(o) { return window.GGCat ? window.GGCat.g(o) : ''; }
  function level(p) { return p && p.level > 1 ? 'Level ' + p.level : ''; }

  var GAMES = [
    {
      id: 'cooking', save: 'cooking', name: 'Cosy Kitchen', blurb: 'Chop, mix and cook yummy dishes',
      ages: ['5-10'], toddler: false, free: ['handroll'], status: 'live', season: null, colour: '#FFB4A2',
      badge: function (p) { var n = (p && p.made) || 0; return n ? n + (n === 1 ? ' dish made' : ' dishes made') : ''; },
      art: "<svg viewBox=\"0 0 240 150\"><ellipse cx=\"120\" cy=\"122\" rx=\"100\" ry=\"22\" fill=\"#fff\" stroke=\"#2A2340\" stroke-width=\"4\"/><ellipse cx=\"120\" cy=\"119\" rx=\"74\" ry=\"12\" fill=\"#FFE3EC\"/><g transform=\"rotate(-14 120 90)\"><path d=\"M168 62 H70 A17 28 0 0 0 70 118 H168 Z\" fill=\"#2E4A3A\" stroke=\"#2A2340\" stroke-width=\"4\" stroke-linejoin=\"round\"/><rect x=\"62\" y=\"69\" width=\"100\" height=\"8\" rx=\"4\" fill=\"#3D6450\"/><ellipse cx=\"168\" cy=\"90\" rx=\"17.5\" ry=\"28\" fill=\"#2E4A3A\" stroke=\"#2A2340\" stroke-width=\"4\"/><ellipse cx=\"168\" cy=\"90\" rx=\"14.5\" ry=\"23.5\" fill=\"#fff\"/><rect x=\"160\" y=\"77\" width=\"11\" height=\"9\" rx=\"2\" fill=\"#FF8A5B\" stroke=\"#2A2340\" stroke-width=\"2\"/><rect x=\"168\" y=\"88\" width=\"7\" height=\"8\" rx=\"1.5\" fill=\"#4FAE5E\" stroke=\"#2A2340\" stroke-width=\"2\"/><ellipse cx=\"164\" cy=\"98\" rx=\"6\" ry=\"4\" fill=\"#C8E26F\" stroke=\"#2A2340\" stroke-width=\"2\"/></g><ellipse cx=\"178\" cy=\"125\" rx=\"18\" ry=\"7\" fill=\"#fff\" stroke=\"#2A2340\" stroke-width=\"3\"/><ellipse cx=\"178\" cy=\"124.5\" rx=\"11.5\" ry=\"4\" fill=\"#5A2A12\"/></svg>"
    },
    {
      id: 'kitty-pop', save: 'kittypop', name: 'Kitty Pop', blurb: 'Line up cats to pop them',
      ages: ['5-10'], toddler: false, free: 3, status: 'live', season: null, colour: '#FFC2DA',
      badge: level, art: "<svg viewBox=\"0 0 240 150\"><rect x=\"14\" y=\"36\" width=\"212\" height=\"92\" rx=\"26\" fill=\"#FFF8EC\" stroke=\"#2A2340\" stroke-width=\"4\"/>" + cat({ preset: 'ginger', face: 'happy', x: 52, y: 78, size: 66 }) + "" + cat({ preset: 'ginger', face: 'happy', x: 120, y: 78, size: 66 }) + "" + cat({ preset: 'ginger', face: 'happy', x: 188, y: 78, size: 66 }) + "<g fill=\"#FFC93C\" stroke=\"#2A2340\" stroke-width=\"2.5\" stroke-linejoin=\"round\"><path d=\"M86 20 L89 29 L98 30 L91 35 L93 44 L86 39 L79 44 L81 35 L74 30 L83 29 Z\"/><path d=\"M156 12 L158 18 L164 19 L159 22 L161 28 L156 25 L151 28 L153 22 L148 19 L154 18 Z\"/></g><g fill=\"#7CC4FF\" stroke=\"#2A2340\" stroke-width=\"3\"><circle cx=\"30\" cy=\"132\" r=\"9\"/></g><g fill=\"#B48CFF\" stroke=\"#2A2340\" stroke-width=\"3\"><circle cx=\"212\" cy=\"132\" r=\"9\"/></g></svg>"
    },
    {
      id: 'cubbies', save: 'cubbies', name: 'Cosy Cubbies', blurb: 'Tuck sleepy cats into their beds',
      ages: ['5-10'], toddler: false, free: 0, status: 'live', season: null, colour: '#BFE0FF',
      badge: level, art: "<svg viewBox=\"0 0 240 150\"><rect x=\"14\" y=\"14\" width=\"64\" height=\"62\" rx=\"10\" fill=\"#E6B98A\" stroke=\"#2A2340\" stroke-width=\"4\"/><rect x=\"20\" y=\"24\" width=\"52\" height=\"44\" rx=\"7\" fill=\"#FFF3E4\" stroke=\"#2A2340\" stroke-width=\"3\"/><ellipse cx=\"46\" cy=\"62\" rx=\"22\" ry=\"6\" fill=\"#FFA94D\" stroke=\"#2A2340\" stroke-width=\"3\"/>" + cat({ preset: 'ginger', face: 'blink', x: 46, y: 52, size: 41 }) + "<rect x=\"88\" y=\"14\" width=\"64\" height=\"62\" rx=\"10\" fill=\"#E6B98A\" stroke=\"#2A2340\" stroke-width=\"4\"/><rect x=\"94\" y=\"24\" width=\"52\" height=\"44\" rx=\"7\" fill=\"#FFF3E4\" stroke=\"#2A2340\" stroke-width=\"3\"/><ellipse cx=\"120\" cy=\"62\" rx=\"22\" ry=\"6\" fill=\"#B48CFF\" stroke=\"#2A2340\" stroke-width=\"3\"/>" + cat({ preset: 'purple', face: 'blink', x: 120, y: 52, size: 41 }) + "<rect x=\"162\" y=\"14\" width=\"64\" height=\"62\" rx=\"10\" fill=\"#E6B98A\" stroke=\"#2A2340\" stroke-width=\"4\"/><rect x=\"168\" y=\"24\" width=\"52\" height=\"44\" rx=\"7\" fill=\"#FFF3E4\" stroke=\"#2A2340\" stroke-width=\"3\"/><ellipse cx=\"194\" cy=\"62\" rx=\"22\" ry=\"6\" fill=\"#7CC4FF\" stroke=\"#2A2340\" stroke-width=\"3\"/><rect x=\"4\" y=\"112\" width=\"232\" height=\"22\" rx=\"11\" fill=\"#6E6487\" stroke=\"#2A2340\" stroke-width=\"4\"/><g fill=\"#B9AED0\" stroke=\"#2A2340\" stroke-width=\"2.5\"><circle cx=\"30\" cy=\"126\" r=\"4\"/><circle cx=\"90\" cy=\"126\" r=\"4\"/><circle cx=\"150\" cy=\"126\" r=\"4\"/><circle cx=\"210\" cy=\"126\" r=\"4\"/></g><ellipse cx=\"170\" cy=\"106\" rx=\"26\" ry=\"10\" fill=\"#F2DCC3\" stroke=\"#2A2340\" stroke-width=\"3.5\"/>" + cat({ preset: 'blue', face: 'blink', x: 168, y: 96, size: 41 }) + "<path d=\"M146 106 Q170 118 194 106 Q170 112 146 106 Z\" fill=\"#F7E6D2\" stroke=\"#2A2340\" stroke-width=\"3.5\" stroke-linejoin=\"round\"/><path d=\"M170 84 Q176 70 174 56\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\" stroke-dasharray=\"5 5\" stroke-linecap=\"round\"/><path d=\"M168 60 L174 52 L180 60\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"
    },
    {
      id: 'yarn', save: 'yarn', name: 'Yarn Sort', blurb: 'Sort the wool into tubes',
      ages: ['5-10'], toddler: false, free: 0, status: 'live', season: null, colour: '#DCC8FF',
      badge: level, art: "<svg viewBox=\"0 -14 240 164\"><rect x=\"26\" y=\"22\" width=\"34\" height=\"112\" rx=\"17\" fill=\"#fff\" fill-opacity=\".6\"/><g transform=\"translate(43 118)\"><circle r=\"13\" fill=\"#FF5A5F\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#C7343A\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(43 91)\"><circle r=\"13\" fill=\"#4D8BFF\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#2459C2\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(43 65)\"><circle r=\"13\" fill=\"#5CCB75\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#2E9447\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><rect x=\"26\" y=\"22\" width=\"34\" height=\"112\" rx=\"17\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"4\"/><rect x=\"22\" y=\"16\" width=\"42\" height=\"12\" rx=\"6\" fill=\"#E6B98A\" stroke=\"#2A2340\" stroke-width=\"3.5\"/><rect x=\"76\" y=\"22\" width=\"34\" height=\"112\" rx=\"17\" fill=\"#fff\" fill-opacity=\".6\"/><g transform=\"translate(93 118)\"><circle r=\"13\" fill=\"#4D8BFF\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#2459C2\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(93 91)\"><circle r=\"13\" fill=\"#FFD93F\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#C9A20C\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(93 65)\"><circle r=\"13\" fill=\"#FF5A5F\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#C7343A\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(93 39)\"><circle r=\"13\" fill=\"#4D8BFF\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#2459C2\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><rect x=\"76\" y=\"22\" width=\"34\" height=\"112\" rx=\"17\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"4\"/><rect x=\"72\" y=\"16\" width=\"42\" height=\"12\" rx=\"6\" fill=\"#E6B98A\" stroke=\"#2A2340\" stroke-width=\"3.5\"/><rect x=\"121\" y=\"22\" width=\"34\" height=\"112\" rx=\"17\" fill=\"#fff\" fill-opacity=\".6\"/><g transform=\"translate(138 118)\"><circle r=\"13\" fill=\"#5CCB75\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#2E9447\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(138 91)\"><circle r=\"13\" fill=\"#5CCB75\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#2E9447\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(138 65)\"><circle r=\"13\" fill=\"#5CCB75\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#2E9447\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(138 39)\"><circle r=\"13\" fill=\"#5CCB75\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#2E9447\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><rect x=\"121\" y=\"22\" width=\"34\" height=\"112\" rx=\"17\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"4\"/><rect x=\"117\" y=\"16\" width=\"42\" height=\"12\" rx=\"6\" fill=\"#E6B98A\" stroke=\"#2A2340\" stroke-width=\"3.5\"/><rect x=\"170\" y=\"22\" width=\"34\" height=\"112\" rx=\"17\" fill=\"#fff\" fill-opacity=\".6\"/><g transform=\"translate(187 118)\"><circle r=\"13\" fill=\"#FFD93F\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#C9A20C\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><g transform=\"translate(187 91)\"><circle r=\"13\" fill=\"#FF5A5F\"/><path d=\"M-11 -5 Q0 -12 11 -5 M-13 1 Q0 -6 13 1 M-11 7 Q0 0 11 7\" fill=\"none\" stroke=\"#C7343A\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><circle r=\"13\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"3\"/></g><rect x=\"170\" y=\"22\" width=\"34\" height=\"112\" rx=\"17\" fill=\"none\" stroke=\"#2A2340\" stroke-width=\"4\"/><rect x=\"166\" y=\"16\" width=\"42\" height=\"12\" rx=\"6\" fill=\"#E6B98A\" stroke=\"#2A2340\" stroke-width=\"3.5\"/>" + cat({ preset: 'ginger', pose: 'peek', face: 'blink', x: 138, y: 8, size: 38 }) + "</svg>"
    }
  ];

  /* Dev games show on a test copy of the site (localhost, preview links) or with ?dev in the address. */
  function devVisible() {
    try {
      var h = location.hostname;
      return /^(localhost|127\.0\.0\.1)$/.test(h) || /[?&]dev\b/.test(location.search) || /-git-|vercel\.app$/.test(h);
    } catch (e) { return false; }
  }

  window.GGGames = {
    all: GAMES,
    AGES: [{ id: 'under5', label: 'Under 5' }, { id: '5-10', label: '5\u201310' }, { id: '11+', label: '11+' }],
    get: function (id) { for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i]; return null; },
    /* games to show on the home page right now (season games only in their season) */
    visible: function (opts) {
      opts = opts || {};
      var dev = devVisible(), season = opts.season || null;
      return GAMES.filter(function (g) {
        if (g.status === 'dev' && !dev) return false;
        if (g.season && g.season !== season) return false;
        if (opts.toddler !== undefined && !!g.toddler !== !!opts.toddler) return false;
        if (opts.age && g.ages.indexOf(opts.age) < 0) return false;
        return true;
      });
    },
    playable: function (g) { return g.status === 'live' || (g.status !== 'soon' && devVisible()); }
  };
})();
