/* Cat Rescue: the 30 rescues. Each is a map (8 rows of 8, top row first), the goal, the moves, the peril and its cat.
   Map: '.' piece, '#' no cell, 'b' box, 'B' taped box (two hits), 'k' box with a kitten, 'K' taped box with a kitten,
   't' piece wrapped in yarn, 'c' a kitten on a cushion (bring it down to the bottom), 'p' a cell of the heap (the
   peril's filling: bubbles, leaves, mud, sand or socks, heaped up in the board).
   goal: kittens (freed from boxes), boxes (broken, kitten boxes count too), yarn (untangled), down (cushion kittens);
   clearing the whole heap is always part of the goal too.
   res: how much more of the heap is up in the scene, pouring down into the columns whose top cell starts as heap.
   The heaps start small and grow over the rescues, and sit under the cat in the scene where they can.
   colours: how many kinds of piece (4 is gentle, 5 normal, 6 tricky). tip: a line shown at the start.
   Moves were tuned by playing every level with a greedy bot (see the notes in the commit), and retuned when the
   heap came in, so each level's bot win rate stayed about what it was first tuned to. */
(function () {
  var PERILS = ['bath', 'tree', 'rain', 'tide', 'laundry'];
  var CATS = [
    ['Mochi', 'ginger'], ['Pip', 'white'], ['Biscuit', 'purple'], ['Tofu', 'blue'], ['Pumpkin', 'pink'],
    ['Bean', 'black'], ['Noodle', 'ginger'], ['Pickle', 'blue'], ['Muffin', 'pink'], ['Clover', 'white'],
    ['Sesame', 'black'], ['Juniper', 'purple'], ['Waffle', 'ginger'], ['Pebble', 'white'], ['Olive', 'pink'],
    ['Ziggy', 'blue'], ['Marmalade', 'ginger'], ['Dumpling', 'purple'], ['Fig', 'black'], ['Socks', 'white'],
    ['Poppy', 'pink'], ['Maple', 'ginger'], ['Toast', 'blue'], ['Nutmeg', 'purple'], ['Luna', 'black'],
    ['Pudding', 'white'], ['Basil', 'ginger'], ['Crumpet', 'pink'], ['Miso', 'blue'], ['Button', 'purple']
  ];
  var L = [
    { moves: 20, res: 4, colours: 5, goal: { kittens: 4 }, tip: 'Match three next to a box to break it open.',
      map: ['..pp....', '..pp....', '........', '.bbbbbb.', '.bk..kb.', '........', '..bkkb..', '........'] },
    { moves: 22, res: 5, colours: 5, goal: { kittens: 4 }, tip: 'Line up four to make zoomies. Swap it to clear a whole line!',
      map: ['...pp...', '...pp...', '.bbbbbb.', '.k.bb.k.', '..bbbb..', '...kk...', '........', '........'] },
    { moves: 22, res: 6, colours: 5, goal: { boxes: 16, kittens: 2 }, tip: 'Make an L or a T shape for catnip: it clears all round it.',
      map: ['...pp...', '...pp...', '.bbbbbb.', '.bk..kb.', '.bb..bb.', '..bbbb..', '........', '........'] },
    { moves: 26, res: 5, colours: 5, goal: { kittens: 4 }, tip: 'Taped boxes need two matches.',
      map: ['...ppp..', '....pp..', '..B..B..', '..K..K..', '........', '.B.BB.B.', '.K....K.', '........'] },
    { moves: 27, res: 6, colours: 5, goal: { boxes: 20, kittens: 3 }, tip: 'Five in a row makes rainbow yarn. Swap it with a piece to clear every piece of that kind.',
      map: ['...ppp..', '....pp..', '.BBBBBB.', '.b.kk.b.', '.bbbbbb.', '........', '.bbkbbb.', '........'] },

    { moves: 18, res: 7, colours: 5, goal: { yarn: 10, kittens: 2 }, tip: 'Yarn holds a piece still. Match that piece to untangle it.',
      map: ['..ppp...', '...pp...', '.t.tt.t.', '........', 't.tkkt.t', '........', '..t..t..', '........'] },
    { moves: 31, res: 8, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['...ppp..', '....pp..', 'tttttttt', '........', '..bkkb..', '..b..b..', '.k.tt.k.', '........'] },
    { moves: 37, res: 4, colours: 5, goal: { kittens: 6 },
      map: ['..pppp..', '...ppp..', '.tttttt.', '.tkkkkt.', '.tbKKbt.', '.tttttt.', '........', '........'] },
    { moves: 32, res: 6, colours: 5, goal: { down: 1 }, tip: 'Clear the pieces under the cushion to bring the kitten down to the bottom.',
      map: ['pppc....', 'ppp.....', 'pp......', '...b....', '........', '...b....', '........', '........'] },
    { moves: 30, res: 5, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['.cppppc.', '..pppp..', '.b.pp.b.', '...kk...', '........', '...bb...', '........', '........'] },

    { moves: 26, res: 8, colours: 5, goal: { kittens: 6 },
      map: ['#pppp..#', '..ppp...', '.bbp.bb.', '.bk..kb.', '.BB..BB.', '..kKKk..', '...bb...', '#......#'] },
    { moves: 30, res: 9, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['..pppp..', '...ppp..', '.t.tt.t.', '.K.bb.K.', '...bb...', '.t.KK.t.', '.t....t.', '........'] },
    { moves: 28, res: 11, colours: 5, goal: { down: 2 },
      map: ['..cppc..', '...pp...', '...pp...', 'bbB..Bbb', '........', '..t..t..', '........', '........'] },
    { moves: 24, res: 12, colours: 5, goal: { yarn: 16, kittens: 2 },
      map: ['..pppp..', '.tptpt.t', 't.t.t.t.', '...KK...', 't.t.t.t.', '.t.t.t.t', '........', '........'] },
    { moves: 44, res: 7, colours: 5, goal: { kittens: 4 },
      map: ['..pppp..', '..pppp..', '.BBBBBB.', '.BkKKkB.', '.BBBBBB.', '........', '........', '........'] },

    { moves: 27, res: 14, colours: 5, goal: { kittens: 6 },
      map: ['###pp###', '##....##', '#.KbbK.#', '..BkkB..', '..bBBb..', '#.K..K.#', '##....##', '###..###'] },
    { moves: 37, res: 15, colours: 5, goal: { down: 2 },
      map: ['.ppcc...', '.pp.....', '..ptt...', '..b..b..', '...tt...', '........', '...tt...', '........'] },
    { moves: 24, res: 15, colours: 5, goal: { kittens: 6 },
      map: ['.BppppB.', '.KpttpK.', '.B....B.', '...KK...', '.t....t.', '..BBBB..', '..BkkB..', '........'] },
    { moves: 32, res: 13, colours: 5, goal: { down: 2, boxes: 8 },
      map: ['cppppp.c', '..pppp..', 'bbbbbbbb', '........', '.tttttt.', '........', '........', '........'] },
    { moves: 33, res: 14, colours: 6, goal: { kittens: 4 },
      map: ['.ppppp..', '.Kppp.K.', '..tttt..', '........', '..B..B..', '.BKBBKB.', '........', '........'] },

    { moves: 31, res: 18, colours: 5, goal: { boxes: 22, kittens: 3 },
      map: ['#ppppp.#', '.bbbbbb.', '.bkBBkb.', '.bbkbbb.', '.BB..BB.', '...tt...', '..t..t..', '#......#'] },
    { moves: 30, res: 14, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['.cppppc.', '..pppp..', '.B.pp.B.', '.B.tt.B.', '........', '...KK...', '.t....t.', '........'] },
    { moves: 30, res: 18, colours: 5, goal: { kittens: 6 },
      map: ['tppppp.t', '.tpKKpt.', '..tBBt..', '.K.tt.K.', '..tBBt..', '.t.KK.t.', 't......t', '........'] },
    { moves: 32, res: 16, colours: 6, goal: { kittens: 6 },
      map: ['.ppppp..', '.pKppK..', '....p...', '.B.BB.B.', '..B..B..', '.kK..Kk.', '...BB...', '........'] },
    { moves: 29, res: 18, colours: 5, goal: { down: 1, kittens: 2 },
      map: ['pppc....', 'ppk.k...', 'pppt....', '.b.B.b..', '...t....', '..b.b...', '...B....', '........'] },

    { moves: 44, res: 14, colours: 5, goal: { down: 2, kittens: 4 },
      map: ['#ppcc..#', 'ppBBBB..', 'ptk..kt.', '.t.KK.t.', '..bbbb..', '........', '...tt...', '#......#'] },
    { moves: 23, res: 22, colours: 5, goal: { kittens: 6 },
      map: ['..pppp..', 'bK.pp.Kb', 'b.tttt.b', 'b.t..t.b', 'b.tkkt.b', 'b......b', 'bK....Kb', 'bbbbbbbb'] },
    { moves: 44, res: 12, colours: 5, goal: { down: 4 },
      map: ['c.cppc.c', '..pppp..', '...pp...', '.bbbbbb.', '........', '..t..t..', '........', '........'] },
    { moves: 28, res: 21, colours: 5, goal: { kittens: 4, down: 2 },
      map: ['.KpKKpK.', '.tpttpt.', '..pppp..', 'tt....tt', '...cc...', '........', '.bbbbbb.', '........'] },
    { moves: 37, res: 26, colours: 5, goal: { down: 2, kittens: 6 },
      map: ['cppKK..c', 'ptbbbbt.', 'pb.kk.b.', '.bt..tb.', '.b.kk.b.', '.tbbbbt.', '........', '........'] }
  ];
  L.forEach(function (lv, i) {
    lv.n = i + 1;
    lv.peril = PERILS[i % PERILS.length];
    lv.cat = { name: CATS[i][0], preset: CATS[i][1] };
  });
  window.RescueLevels = L;
})();
