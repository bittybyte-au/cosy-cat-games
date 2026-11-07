/* Hot Paws: the 20 rounds. Patterns play in order (or shuffled), each made of waves that warn for w seconds then
   stay lava for h seconds; step is the time between one line of a sweep and the next. goal: blue diamonds to
   collect; floor: how many are on the floor at once; wait: seconds before a new one lights up; min/near: how far
   from the cat new ones appear. gold: the chance a new diamond is golden (worth 3); ice: how many ice tiles;
   freeze: seconds between snowflake squares; safe: the round's green tiles, drawn upright (7 wide, 9 tall, G is
   green), which stay safe and in place all round: big and many early, few and far apart later.
   tip: one line shown at the start when something is new.
   Tuned with a slow, clumsy bot (a long reaction time and some wrong turns) and a quick one. */
(function () {
  var L = [
    // 1-5: slow and kind, for little paws
    { safe: ['GG...GG', 'GG...GG', '.......', '..GGG..', '..GGG..', '..GGG..', '.......', 'GG...GG', 'GG...GG'],
      goal: 6, floor: 2, wait: 1.6, min: 2, near: 3, w: 1.8, h: 1.6, step: 1.2, gaps: 3, rest: 1.8, calm: 3, patterns: ['rows'],
      tip: 'Red is lava! Orange means lava is coming, so step off.' },
    { safe: ['GGG.GGG', 'G.....G', '.......', '...G...', '..GGG..', '...G...', '.......', 'G.....G', 'GGG.GGG'],
      goal: 7, floor: 2, wait: 1.6, min: 2, near: 4, w: 1.7, h: 1.5, step: 1.1, gaps: 3, rest: 1.6, patterns: ['cols', 'rows'] },
    { safe: ['.GG.GG.', '.GG.GG.', '.......', 'GG...GG', 'GG.G.GG', 'GG...GG', '.......', '.GG.GG.', '.GG.GG.'],
      goal: 7, floor: 2, wait: 1.5, min: 3, near: 4, w: 1.5, h: 1.5, step: 0.95, gaps: 3, k: 2, flickD: 5, rest: 1.3, patterns: ['rows', 'flicker', 'cols'] },
    { safe: ['G.....G', '.GG.GG.', '.GG.GG.', '.......', '...G...', '.......', '.GG.GG.', '.GG.GG.', 'G.....G'],
      goal: 8, floor: 2, wait: 1.5, min: 2, near: 4, w: 1.7, h: 1.0, step: 1.0, block: 2, rest: 2.0, patterns: ['checker'],
      tip: 'Some squares, then the other squares. Hop across!' },
    { safe: ['GG...GG', 'G.....G', '.......', '..G.G..', '...G...', '..G.G..', '.......', 'G.....G', 'GG...GG'],
      goal: 8, floor: 2, wait: 1.5, min: 3, near: 4, w: 1.5, h: 1.4, step: 0.85, rest: 1.3, patterns: ['rings'],
      tip: 'Rings of lava! The cross through the middle stays safe.' },
    // 6-10: new things, a bit quicker
    { safe: ['.......', '.GG.GG.', '.G...G.', '.......', '...G...', '.......', '.G...G.', '.GG.GG.', '.......'],
      goal: 9, floor: 1, wait: 1.4, min: 4, near: 5, w: 1.35, h: 1.4, step: 0.75, gaps: 2, snakes: 1, len: 4, gold: 0.25, rest: 1.1, patterns: ['snake', 'rows', 'snake', 'cols'],
      tip: 'A golden diamond is worth 3!' },
    { safe: ['G.....G', '.......', '..G.G..', '.......', 'G..G..G', '.......', '..G.G..', '.......', 'G.....G'],
      goal: 10, floor: 1, wait: 1.4, min: 4, near: 5, w: 1.3, h: 1.3, step: 0.75, crosses: 3, aim: 0.15, block: 2, gold: 0.2, rest: 1.2, patterns: ['cross', 'checker'] },
    { safe: ['.......', '.G...G.', '.G...G.', '.......', '..GGG..', '.......', '.G...G.', '.G...G.', '.......'],
      goal: 10, floor: 1, wait: 1.3, min: 4, near: 5, w: 1.2, h: 1.4, step: 0.7, gaps: 2, gold: 0.2, rest: 0.9, patterns: ['halves', 'rows', 'halves', 'snake'],
      tip: 'Half the floor gets hot. The middle line stays safe.' },
    { safe: ['G.....G', '.......', '...G...', '.G...G.', '...G...', '.G...G.', '...G...', '.......', 'G.....G'],
      goal: 11, floor: 1, wait: 1.3, min: 4, near: 5, w: 1.15, h: 1.3, step: 0.68, gaps: 2, ice: 3, block: 2, rest: 0.9, patterns: ['checker', 'cols', 'rings'],
      tip: 'Ice is slippy: you slide one more tile!' },
    { safe: ['.......', '..G.G..', '.......', 'G.....G', '...G...', 'G.....G', '.......', '..G.G..', '.......'],
      goal: 12, floor: 1, wait: 1.2, min: 4, near: 6, w: 1.1, h: 1.3, step: 0.62, gaps: 2, gold: 0.2, rest: 0.8, patterns: ['diag', 'snake', 'rows', 'cross'] },
    // 11-15: snowflakes, busier floors
    { safe: ['G......', '...G...', '.......', '.G...G.', '...G...', '.G...G.', '.......', '...G...', '......G'],
      goal: 12, floor: 1, wait: 1.2, min: 4, near: 6, w: 1.0, h: 1.3, step: 0.6, snakes: 2, len: 4, freeze: 14, rest: 0.8, patterns: ['snake', 'rings', 'snake', 'halves'],
      tip: 'Step on a snowflake to freeze the lava for a moment.' },
    { safe: ['.......', '.G...G.', '.......', '.......', '..G.G..', '.......', '.......', '.G...G.', '.......'],
      goal: 13, floor: 1, wait: 1.2, min: 4, near: 6, w: 0.95, h: 1.2, step: 0.56, gaps: 2, block: 1, gold: 0.2, rest: 0.7, patterns: ['diag', 'checker', 'cols'] },
    { safe: ['.......', '.......', '..G.G..', '.......', '...G...', '.......', '..G.G..', '.......', '.......'],
      goal: 13, floor: 1, wait: 1.1, min: 4, near: 6, w: 0.9, h: 1.2, step: 0.55, len: 8, rings: 2, crosses: 3, aim: 0.4, freeze: 16, ice: 2, rest: 0.6, patterns: ['edge', 'cross', 'edge', 'rows'], gaps: 2,
      tip: 'Lava races round the edge. Keep to the middle!' },
    { safe: ['G.....G', '.......', '.......', '...G...', '...G...', '...G...', '.......', '.......', 'G.....G'],
      goal: 14, floor: 1, wait: 1.1, min: 4, near: 7, w: 0.85, h: 1.2, step: 0.52, gaps: 2, gold: 0.2, rest: 0.6, patterns: ['rows', 'cols', 'halves'],
      overlay: ['flicker'], overlayParams: { k: 1, flickD: 4, rest: 0.5 } },
    { safe: ['.......', '.G.....', '.......', '....G..', '...G...', '..G....', '.......', '.....G.', '.......'],
      goal: 14, floor: 1, wait: 1.1, min: 4, near: 7, w: 0.8, h: 1.1, step: 0.5, snakes: 2, len: 5, crosses: 3, aim: 0.4, freeze: 15, rest: 0.5, patterns: ['rings', 'snake', 'cross'] },
    // 16-20: a real challenge
    { safe: ['.......', '...G...', '.......', '.......', 'G..G..G', '.......', '.......', '...G...', '.......'],
      goal: 15, floor: 1, wait: 1.0, min: 4, near: 7, w: 0.68, h: 1.1, step: 0.42, crosses: 4, aim: 0.5, gold: 0.2, ice: 2, gaps: 2, rest: 0.5, patterns: ['cross', 'diag', 'checker'] },
    { safe: ['G......', '.......', '.......', '.......', '...G...', '.......', '.......', '.......', '......G'],
      goal: 15, floor: 1, wait: 1.0, min: 4, near: 7, w: 0.65, h: 1.1, step: 0.41, gaps: 2, block: 2, ice: 3, freeze: 15, rest: 0.45, patterns: ['checker', 'rows', 'cols', 'snake'], snakes: 2, len: 4 },
    { safe: ['.......', '.G...G.', '.......', '.......', '...G...', '.......', '.......', '.G...G.', '.......'],
      goal: 17, floor: 1, wait: 1.0, min: 4, near: 7, w: 0.6, h: 1.05, step: 0.36, gaps: 2, snakes: 2, len: 5, crosses: 3, aim: 0.5, gold: 0.2, rest: 0.4, shuffle: true,
      patterns: ['rows', 'cols', 'rings', 'snake', 'diag', 'halves', 'cross'] },
    { safe: ['.......', '.......', '..G....', '.......', '...G...', '.......', '....G..', '.......', '.......'],
      goal: 16, floor: 1, wait: 1.0, min: 4, near: 7, w: 0.61, h: 1.0, step: 0.36, snakes: 2, len: 5, block: 2, freeze: 14, rest: 0.4, patterns: ['snake', 'edge', 'snake', 'checker'],
      overlay: ['flicker'], overlayParams: { k: 1, flickD: 5, rest: 0.6 } },
    { safe: ['.......', '.......', '.......', '.......', '...G...', '.......', '.......', '.......', '.......'],
      goal: 18, floor: 1, wait: 0.9, min: 4, near: 7, w: 0.58, h: 1.05, step: 0.33, gaps: 2, snakes: 3, len: 5, crosses: 4, aim: 0.5, gold: 0.2, ice: 2, freeze: 16, rest: 0.35, shuffle: true,
      patterns: ['rows', 'cols', 'rings', 'snake', 'diag', 'halves', 'cross', 'checker', 'edge'],
      overlay: ['flicker'], overlayParams: { k: 1, flickD: 4, rest: 0.8 } }
  ];
  L.forEach(function (lv, i) { lv.n = i + 1; });
  window.HotPawsLevels = L;
})();
