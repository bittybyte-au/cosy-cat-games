# Scenery audit and the GGScene plan

The owner's direction: every tree, curtain, cloud and so on should come from one shared drawing function that
takes parameters (which kind, which colours), never be drawn from scratch in a game. Phase 1 (this change) audits
every place scenery is drawn, builds `shared/scene.js` (`GGScene`), and converts two games as proof
(Grow and Hide and Seek). Phase 2 converts the rest, in the batches at the end of this file.

Reference sheet of every kind and variant: `tools/scene-gallery.html` (open it in the browser).

Line numbers are from commit `d377084`, before this change. "same as" means copy-pasted with tiny differences.

## Inventory, by kind

### Curtains (4 copies of one function)
The tied-back curtain pair on a rod, `curtainTile()` + `drawCurtains()`, commented "copied into each game that has a window".
- games/grow/game.js 350-391: gingham red. Plain `fill + ink(3.5)` outline, folds drawn *after* the outline (on top of it). **Converted.**
- games/seek/game.js 227-268: same as grow, 4 looks (stripes, dots, stars, gingham) in `CURTAINS`. **Converted.**
- games/feed/game.js 166-208: the best copy: `D.shape` with the folds clipped inside and outline last, mid weight, shaded tie.
  This is the one GGScene keeps.
- games/home/game.js 463-484 (`drawWindow`): a different, simpler pair of straight drapes, toned, ink 3, no rod
  (a pole over the window). GGScene keeps it as `kind: 'drape'`.
- games/rooftop/game.js 350: a pink rectangle "curtain" in lit building windows (a 15 x 20 fill, not really scenery; leave).

### Windows (8 places)
- games/grow/game.js 393-413 (`drawBench`): rounded pane, sky tone, the cat sun behind a hill, cream sill, curtains. **Converted.**
- games/seek/game.js 470-492 (`drawBackground` bedroom, kitchen): pane, flat sun disc (no outline), white bar as a
  `fillRect` (no edge), curtains. **Converted.**
- games/feed/game.js 211-223 (`drawRoom`, phones only): pane, flat sun disc, white bar, curtains.
- games/home/game.js 463-484 (`drawWindow`): white surround frame, three-circle clouds drifting (no outline),
  flat sun, green ellipse hill, white cross bars stroked over the pane (no edges), drapes, pole.
- games/pottery/game.js 518-531 (`drawRoom`): surround frame, three-circle cloud (no outline), outlined hill, cross bars
  drawn as ink 11 + cream 5 (outlined bars, the nicest), wooden sill.
- games/sneaky/game.js 386-396: night window, stars, small moon, cross bars in ink over the pane, sill, moonlight on the floor.
- games/rescue/scenes.js 216 (bath scene): a small window with white circle clouds and a white bar.
- games/slide/game.js 135 ('yarn' picture): pane with white cross bars, wooden sill.
- (games/colour/pages.js 185-231: colouring-page windows, SVG regions; see "Not for GGScene" below.)

### Sun (8 places, 3 looks)
- GGCat `preset: 'sun'` cat face: games/grow (with its own spinning yellow rays), games/rescue/scenes.js 371 and 391
  (`rays: true`, GGCat's ink rays), games/slide/game.js 77, index.html 151 (`data-cat`, SVG), shared/games.js 145 (SVG).
- Flat yellow disc, no outline: games/seek (bedroom/kitchen windows), games/feed 219, games/home 467, games/slide 152.
- Outlined shaded disc: games/seek garden and beach (`sh(c, E(...), '#FFE14D')`).

### Moon and stars
- Moon: games/rooftop/game.js 304-309 (glow + craters, ink 3), games/slide/game.js 103 (full, craters, ink 4.5),
  games/puzzle/game.js 99-103 (crescent, ink 5), games/sneaky/game.js 391 (small disc in a window).
- Night-sky stars (unoutlined twinkles/dots): games/rooftop 300, games/slide 102 (8-point), games/puzzle 29 (`stars()`),
  games/sneaky 390 (dots).
- Outlined five-point star as an object: games/slide 113-116 (hanging star on a string), games/seek ITEMS.star.
  (The many `star()` helpers in games are sparkle particles and reward stars, not scenery: out of scope.)

### Clouds (6 places, 3 looks)
- Cat-eared outlined cloud: play/index.html 173-174 (inline SVG, the original), games/rescue/scenes.js 126-150
  (`cloudPath` + `puffyCloud`, a canvas re-drawing of it with faces).
- Three white circles, no outline: games/seek garden 471 (**converted**), games/home 468-472, games/pottery 521-523,
  games/slide 75 (garden picture), games/rescue 216.
- A cloud to stand on: games/rooftop/game.js 394-409 (`drawCloud`).

### Hills, grass, ground
- Hills: play/index.html 175 (SVG, two layers, no outline), games/rescue/scenes.js 250 (tree scene), games/slide 79-80,
  games/grow window hill (**converted**), games/pottery window hill, games/home window hill (ellipse, no outline).
- Grass ground with tufts: games/rescue/scenes.js 157-163 (`grass`), games/seek garden 476-477 (**converted**),
  games/slide 85-87, games/crossing 186-187 (plain fills, no tufts).
- Grass tufts (three strokes): games/rescue (inside `grass`), games/seek, games/slide: three copies, three sizes.
- Sand: games/seek beach (wavy ink edge, specks; **converted**), games/rescue tide 397-399 (beach slope, specks).

### Trees (3 places, 3 different builds)
- games/seek/game.js 344-353 (PROPS.tree): trunk + four-circle crown with a union outline (ink circles behind,
  smaller leaf circles in front), optional berries. The best one: GGScene's `round` tree uses its exact shape. **Converted.**
- games/crossing/game.js 188-193 (`drawWorld`): park trees, a stick trunk and a single shaded circle.
- games/rescue/scenes.js 276-282 (tree scene): a tall trunk with a bending branch and a five-circle crown. The branch
  bends with the game (it is a game object): phase 2 should use `GGScene.tree` for the crown and trunk and keep
  only the branch in the game, or accept it as a special.
- (games/grow/plants.js draws the *grown plants*: those are GGPlants, a separate shared module, not scenery.)

### Bushes
- games/seek/game.js 317-322 (PROPS.bush, mound shape, berries). **Converted.** Only one, but it belongs in the kit.

### Flowers (5 places, 4 builds)
- games/rescue/scenes.js 164-169 (`flower`): ink-under stem, union-outlined petals, yellow middle.
- games/slide/game.js 27-34 (`flower`): stem tube, petals in one path (petal outlines cross), middle.
- games/seek PROPS.pot flowers 323-330 (**converted**), ITEMS.flower (a thing to find, leave).
- games/home: plants come from GGPlants; no scenery flowers.

### Fences
Picket fence, three copies with different sizes: games/rescue/scenes.js 335-336 (rain scene), games/seek garden 473-474
(**converted**), games/slide 82-84.

### Water
- Sea with white wave strokes: games/seek beach (**converted**), games/rescue tide 389-391, games/puzzle boat picture.
- Bath water: games/bath and games/rescue bath (game objects, not scenery: leave).

### Walls (wallpaper)
- Dots: games/feed 213, games/home 488-494, games/seek bedroom (**converted**), games/slide 22-26 (`wallpaper`),
  games/rescue laundry 448-449, games/pottery 511-512, games/hotpaws 236-237 (dark, faint).
- Stripes: games/grow (**converted**), games/boxes/boxes.js 136 (`room`, used by peekaboo and kitten-box),
  games/cafe 584, games/stack 179, games/slide 'yarn' 132, games/sneaky 371-373.
- Tiles: games/kitten-kitchen 503-504, games/seek kitchen (**converted**), games/bath 226-229, games/rescue bath 212-214,
  games/cooking 431-435.
- Dado rail: games/pottery 513-516 (only one).

### Floors
- Planks: games/home 506-510, games/seek bedroom (**converted**), games/pottery 532-534, games/boxes 137-138,
  games/slide 138-140, games/rescue `floor` 152-156, games/stack 180, games/yarn-dash 330-333, games/mouse-pop 155-157,
  games/laser 386-410 (night), games/sneaky 413+, games/cubbies.
- Tiles / check / carpet: games/home `FLOORS` (planks, tiles, carpet), games/seek kitchen check (**converted**),
  games/bath 230 (plain), games/hotpaws (light-up tiles are the game itself: leave).
- Skirting boards: games/home 517-518, games/yarn-dash 340-345 (round the room, seen from above), games/sneaky 413-415.

### Shelves and sills (7 places, 4 bracket styles)
- games/home 495-503: filled triangle brackets under the board, and white sills.
- games/pottery 536-543 (`drawShelf`): small tapered legs, shadows of pots on the board.
- games/seek PROPS.shelf: ink-line brackets (**converted**).
- games/kitten-kitchen 518: plain board, `fillInk`.
- games/bath 232-240: plain board with bottles.
- games/slide 'teacup' 44-49: plain board with jars.
- games/cafe (shelf of ingredients in the hatch, part of the game UI).

### Tables, benches, counters
- Work bench / counter running across the screen: games/grow (**converted**), games/cafe 668-674 (`drawCounter`, door
  panels), games/kitten-kitchen 513-517, games/feed 224-227 (table top), games/cooking 436-442, games/puzzle 298,
  games/slide 'teacup' 50-52, games/colour (table behind the page).
- Table on legs: games/home 522-541 (`drawFurniture`: table with an apron, and a sideboard cabinet), games/seek
  PROPS.table (striped cloth; **converted**), games/sneaky 404-410 (side table under a lamp).

### Rugs and mats
- Stitched rug (dashed ring inside): games/mouse-pop 158-163, games/yarn-dash 334-338.
- Rings: games/slide 'yarn' 142-145, games/rescue laundry 455 (and nap mat 340).
- Plain ellipse: games/seek (**converted**). Others: games/feed `drawMat` (place mats, game objects), games/cubbies `drawMat`.

### Lamps, pictures, bunting, plants
- Lamps: games/slide 'sofa' 165-168 (floor lamp), games/sneaky 404-410 (table lamp).
- Framed pictures: games/slide 'sofa' 151-153, games/sneaky 397-402, games/colour/pages.js 446 (`drawFramed`, shows a
  coloured page: it is the player's picture, keep but could use `GGScene.picture` for the frame).
- Bunting: games/cafe 586-598 (flags on the curve, string over), games/kitten-kitchen 506-511 (string first, flags over
  it: the line sits under the flags). Same idea, two builds.
- House plants in pots: games/seek PROPS.plant and PROPS.pot (**converted**), games/laser 444-452 (plant pot obstacle).
- Fairy lights: games/hotpaws 239-252, games/rooftop 364 (string lights): night decorations, two builds (not yet in the kit).

### Single-use scenery (no duplicate yet; leave in place, add to the kit when a second game needs one)
crossing road and pavements; rooftop buildings/skyline, chimneys; cubbies cat house (`drawCatDoor`); pottery kiln and
wheel; bath tub and shower; cafe hatch with hanging pots; seek beach shells, castle, boat, fridge, oven, bed, armchair;
slide sofa; stack cushion; sneaky door frames and dog beds; hotpaws floor frame.

### Not for GGScene
- games/colour/pages.js: colouring pages are line-art SVG *regions* with fixed indexes (saved pictures store fills by
  index), so their suns, windows, flowers and houses must keep their exact shapes. Leave them.
- games/grow/plants.js (GGPlants), shared/pots.js (GGPot), shared/dishes.js (GGDish), shared/cat.js (GGCat): already shared.
- Game objects that look like scenery but move with play (rescue's bending branch and rising water, bath water).

### SVG users
play/index.html (clouds + hills, inline SVG) and index.html / shared/games.js (the GGCat sun as SVG). GGScene has
`GGScene.svg.cloud()` and `GGScene.svg.hills()` built from the same path data as the canvas versions, so play/index.html
can switch to them in phase 2 (they render the same as the canvas twin: see the last row of the gallery).

## GGScene (shared/scene.js)

Load it after `shared/draw.js` (and `shared/cat.js` for the cat sun and cat clouds). The header comment in the file is
the full reference. Every function takes `ls` (the scale you are already drawing at, so outlines stay the house weights
when called inside your own `c.scale()`) and `seed` where things are scattered. Ground things are placed by their base.

| Kind | Call | Variants |
| --- | --- | --- |
| sky | `sky(c, x, y, w, h, { kind, col, stars })` | day, dusk, night |
| sun | `sun(c, x, y, { kind, size, col, rays, spin, face })` | plain, cat |
| moon | `moon(c, x, y, { kind, size, col, glow })` | full, crescent |
| stars | `stars(c, x, y, w, h, { n, kind, col, size })` / `star(c, x, y, { r, col, string })` | dot, twinkle / one outlined star |
| cloud | `cloud(c, x, y, { kind, size, col, face })` | puff, cat, flat |
| hills | `hills(c, x, y, w, h, { kind, col, back })` | one, two, bumpy |
| ground | `ground(c, x, y, w, h, { kind, col, edge, tufts })`, `tuft(c, x, y, { size, col })` | grass, sand, soil |
| tree | `tree(c, x, y, { kind, size, leaf, trunk, fruit, flower })` | round, pine, blossom |
| bush | `bush(c, x, y, { kind, w, h, col, berries, flower })` | mound, hedge, ball |
| flower | `flower(c, x, y, { kind, size, col, middle, stem })`, `flowerTuft(c, x, y, { cols, n, size, kind })` | daisy, tulip, bud |
| fence | `fence(c, x0, x1, y, { kind, h, col })` | picket, rail |
| water | `water(c, x, y, w, h, { kind, col, t, offset })` | sea, pond |
| wall | `wall(c, x, y, w, h, { pattern, col, col2, size, edge })` | plain, dots, stripes, tiles |
| floor | `floor(c, x, y, w, h, { kind, col, col2, size, skirting })` | planks, tiles, check, carpet |
| window | `window(c, x, y, w, h, { view, sky, frame, bars, barCol, sill, curtains, sun, cloud, hill, r, behind, inside })` | garden, day, night, sky; bars cross, mid, none |
| curtains | `curtains(c, x, y, w, h, { kind, pattern, colour, colour2, tie, rod })` | tied, drape; plain, gingham, stripes, dots, stars |
| shelf | `shelf(c, x0, x1, y, { kind, col, thick, on })` | brackets, plain, sill |
| table | `table(c, x0, x1, y, floorY, { kind, col, legs, cloth, apron, front, doors, on })` | legs, cabinet, bench |
| rug | `rug(c, x, y, rx, ry, { kind, col, col2 })` | plain, stitch, rings |
| lamp | `lamp(c, x, y, { kind, size, shade, stand, on })` | floor, table |
| picture | `picture(c, x, y, w, h, { view, frame, string })` | hills, sea, night |
| bunting | `bunting(c, x0, y0, x1, y1, { sag, cols, flag })` | one |
| plant | `plant(c, x, y, { kind, size, pot, leaf, flower })` | leafy, flowers, cactus |
| SVG | `svg.cloud({ x, y, size, kind, col, face })`, `svg.hills({ w, h, kind, col, back, top, line })` | puff, cat / one, two, bumpy |

`GGScene.VARIANTS` lists the variants of each kind. To add a look, add a variant in scene.js and a cell in the gallery.

## Phase 2: migration batches

Each batch can go to its own agent; no file is in two batches. In every file: replace the local scenery code with
GGScene calls, delete the local helpers it no longer needs (no orphans), add
`<script src="../../shared/scene.js"></script>` after draw.js (and cat.js) in the game's index.html, check before/after
screenshots at 390x844 and 1280x800 with no console errors. If a game needs a look GGScene lacks, add a *variant* to
scene.js (and the gallery) rather than drawing it locally; batches that both touch scene.js should add, not change,
existing variants, and rebase carefully.

**Batch A: outdoors** (sky, sun, clouds, hills, grass, trees, flowers, fences, sea)
- games/rescue/scenes.js, games/rescue/game.js (sky, `puffyCloud` -> cloud cat, `grass`, `flower`, fence, hills, tree crown
  and trunk; keep the bending branch; tide sea -> water sea; bath and laundry rooms -> wall tiles/dots, floor, rug)
- games/slide/game.js (`wallpaper`, `flower`, garden hills/fence/grass/clouds/sun, night moon/stars/hanging star,
  yarn window/floor/rug, sofa picture/lamp/floor, teacup shelf/table)
- games/rooftop/game.js (moon, stars, `drawCloud` -> cloud flat; skyline stays)
- games/puzzle/game.js (`stars`, `moon`, table)
- games/crossing/game.js (park trees -> tree round, grass) **only once the agent editing it now has finished**

**Batch B: rooms with windows** (window, curtains, shelves, sills, tables, walls, floors)
- games/feed/game.js (delete `curtainTile`/`drawCurtains`; `drawRoom` -> wall dots, window, curtains, table bench)
- games/home/game.js (`drawWindow` -> window frame + curtains drape; `drawRoom` walls/floors/shelves/sills;
  `drawFurniture` -> table legs/cabinet; keep WALLS/FLOORS colour lists as parameters)
- games/pottery/game.js (`drawRoom` -> wall, window frame cross, floor planks; `drawShelf` -> shelf plain with `on` for
  the pot shadows; kiln and wheel stay)
- games/bath/game.js (`drawRoom` -> wall tiles, floor, shelf)

**Batch C: kitchens and counters** (tiles, counters, bunting)
- games/cafe/game.js (`drawWall` -> wall stripes + bunting; `drawCounter` -> table bench with doors; hatch stays)
- games/kitten-kitchen/game.js (`drawKitchen` -> wall tiles, bunting, table bench, shelf plain)
- games/cooking/game.js (`drawBackground` -> wall tiles, table bench)
- games/boxes/boxes.js (`room` -> wall stripes + floor planks; this also changes peekaboo and kitten-box)
- games/stack/game.js (`frameScene` wall stripes + floor; the cushion stays)

**Batch D: floors, rugs, night rooms and the SVG pages**
- games/mouse-pop/game.js (`paintFloor` -> floor planks + rug stitch)
- games/yarn-dash/game.js (`paintFloor` -> floor planks + rug stitch; add a top-down skirting variant if needed)
- games/laser/game.js (night floor; plant pot -> plant)
- games/sneaky/game.js (`drawRoom` walls, window night, picture, lamp table, skirting/floor)
- games/hotpaws/game.js (`buildRoom` wallpaper dots; fairy lights could become a new `lights` kind)
- games/cubbies/game.js (mat and floor)
- play/index.html (clouds -> `GGScene.svg.cloud({ kind: 'cat' })`, hills -> `GGScene.svg.hills({ kind: 'two' })`,
  needs `shared/draw.js` + `shared/scene.js` loaded on the page), index.html (sun stays GGCat)

Not in any batch (nothing to convert): games/kitty-pop, games/yarn, games/peekaboo and games/kitten-box (they use
boxes.js, batch C), games/hotpaws tiles, games/colour (see "Not for GGScene"), games/grow and games/seek (done).

## Phase 3: furniture, top-down views and the things kit

From now on a new graphic goes into a shared kit before a game uses it (see "Drawing: always from the shared
kits" in the README). Batch E added to `shared/scene.js`: `sofa` (sofa and armchair), `basket`, `cushion`, `books`,
`box`, `runner`, `mousehole` and a top view for `plant`, each in `view: 'front'` and `view: 'top'`. The new
`shared/things.js` (GGThings) holds the creatures and little things: `mouse` (top, side), `dog` (side, top),
`yarnBall`, `fish`. Converted: Slide Puzzle (sofa, yarn balls), Hide and Seek (armchair), Sneaky Cat (dog, fish,
armchair, box, plant), Rooftop Run (fish), Mouse Pop (mouse), Yarn Dash (toy mouse, dog in its bed, yarn balls),
Yarn Defence (floor, rug path, mouse hole, basket, cushions, mice, yarn balls), Laser Bounce (books, basket,
cushion). The single-use list above is no longer a reason to draw locally.

