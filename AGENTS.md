# The Royal Study — agent notes

> Project constraints, file map, and the relevant algorithms/structures.
> For the game *rules* see `RULES.md`; for the reverse-engineering
> provenance and verification status see `BOARD_COMBINATIONS.md`.

## Goal

Reverse-engineer "The Royal Study" (Philos, item 2850, by Stan van Rooijen) —
a 3×3 chess puzzle game with 60 objective cards — and at minimum obtain all
60 board cards. Secondary goal: a faithful digital reimplementation.

## Status

- **Rules**: confirmed against the printed rulebook (see `RULES.md`).
- **60 physical card layouts**: **not publicly enumerated anywhere** we could
  find (publisher store, BGG, rules PDFs, the three GitHub repos all checked).
  We generate a plausible 60-card deck in `cards.json` (10 seeded from the
  deployed site — the only cards we can confirm are real — plus 50 generated).
  Full verification still needs the physical deck or the author/publisher.
- **Reachability / component math**: verified by enumeration
  (`generate-pool.js`). The dark-bishop component has 7,560 placements /
  945 D4 orbits; the light-bishop component has 5,880 / 735.

## Constraints that govern any generated deck

1. **Bishop on a dark square** (the 5-square set, `(row+col)` even) → keeps the
   deck in the 7,560-state dark-bishop component, which is connected under the
   move graph, so carry-over between cards always works. The deployed deck is
   all-dark (start has B@6; all 10 known cards have B on 0/2/6).
2. **Knight never on the centre** (square 4) → geometric on 3×3 (a knight can't
   reach `(1,1)` from any square, and from the centre it can't move). Enforced
   in generators to avoid emitting a dead start.
3. **Dihedral distinctness** → no two cards in the deck are rotations/mirrors
   of each other. Enforced by `boardHash` dedup (see below).

These are encoded in `isValidPlacement(p)` (rejects N at centre and a
light-square Bishop) and the constrained generators (`randomValidPlacement`,
`randomValidTargetFor`, `generateValidPuzzle`).

## File map

| File | Role |
|---|---|
| `royal-study-engine.js` | Core: rules, BFS solver (`minMoves`/`minMovesLevel`/`minSolution`/`solve`), dihedral transforms, generators, reachability, the dihedral-invariant `boardHash`/`puzzleHash`, and a built-in test suite (`npm test`, ~7s; `--solver=all` for an exhaustive 945-board sweep). |
| `generate-pool.js` | Enumerates the dark component, dedups by `boardHash`, cross-references `cards.json`, writes `pool.json` (945 canonical boards) + `POOL.md`. |
| `generate-cards.js` | Builds the 60-card deck: seeds the 10 deployed-site cards, fills 50 more from `randomValidPlacement` with Level-1 par in [2,9], dedups by `boardHash`. Writes `cards.json` + `CARDS.md`. |
| `simulate-deck.js` | Plays the 60-card carry-over chain end-to-end (start → card 1 → … → card 60), reports per-step Level-1 and Level-2/3 pars. Writes `deck-simulation.json`. |
| `play.js` | Terminal TUI: pick a level (1/2/3), study start + goal, **bid** an estimate, then play to that budget. Reveals the three pars only on completion. `npm run play`. |
| `pool.json` / `POOL.md` | The 945 canonical dark boards — the complete universe a dark deck can draw from. Use `hash` to verify a physical card. |
| `cards.json` / `CARDS.md` | The 60-card deck (10 `isSeed:true` confirmed real; 50 unverified). |
| `deck-simulation.json` | Per-step carry-over pars for the 60-card chain. |
| `RULES.md` | The game rules (human-facing). |
| `BOARD_COMBINATIONS.md` | Reverse-engineering provenance, the 3 GitHub repos, the 10 deployed cards, the state-space counts, the verification gap. |
| `royal_study_original_rules.pdf` | The original rules PDF (reference). |
| `package.json` | ESM (`"type": "module"`); `npm` scripts: `test`, `cards`, `pool`, `simulate`, `play`. |

`repos/` (gitignored) holds clones of the three reference repos.

## Algorithms & structures

### Board representation
- A placement is `{ K, Q, R, B, N }` mapping each piece to a square index
  `0..8` where `idx = row*3 + col` (row 0 = top, col 0 = left).
- Grid notation: `"R . N / . K . / B Q ."` (rows separated by `/`, `.` = empty).

### Legal moves (`legalDestinations`)
- No captures → destination must be empty.
- Sliders (R/B/Q) stop at the first piece in each direction.
- Knight jumps (ignores blockers); King steps one in any of 8 directions.

### Solver
- `minMoves(start, target)` — BFS over placements, **no card transforms**. This
  is the Level-1 par.
- `minMovesLevel(start, target, level)` — min over the transforms allowed at
  each level (L1: identity only; L2: 4 rotations; L3: all 8 dihedral) of
  `minMoves(transformed target) + transform cost`. **Provably optimal** even
  with interleaved moves+ops, because board isometries commute with piece
  movement ("transform-then-solve" can't be beaten by interleaving).
- `minSolution(start, target)` = `minMovesLevel(_, _, 3)` (all 8 dihedral).
- `solve(start, target)` — BFS that interleaves moves + ops and reconstructs
  the actual path (used by the TUI and the demo).

### Dihedral transforms (D4)
- 8 elements: identity, rot90 CW, rot180, rot90 CCW, mirror H, mirror V,
  transpose, antitranspose. Costs: 0/1/2/1/1/1/2/2 (rot180 and the diagonals
  cost 2 = two 90°/mirror composites).
- Cost model matches the game: `rotations + mirrorH + mirrorV`, with 180°
  counting as two 90° turns.

### Dedup key — `boardHash(board)`
- **D4-invariant**: lex-min of the 8 transformed grid strings. Two boards in
  the same D4 orbit share the key; boards in different orbits don't.
- Used by `generate-cards.js` so no two cards are rotations/mirrors of each
  other. Test suite asserts invariance.
- `puzzleHash(start, target)` is the analogous key for a start→target *pair*
  (invariant under applying the *same* D4 element to both); used when starts
  vary. Not needed for the current fixed-start deck but implemented + tested.

### Reachability
- `isReachable(a, b)` / `reachableSet(start)` — full BFS over the move graph.
- The 7,560 dark placements form **one** connected component; the 5,880
  light placements form another. No legal move changes a bishop's color, so
  the two never connect. Carry-over between cards only works within one
  component — hence constraint #1 above.

### Generators
- `randomPlacement` / `randomValidPlacement` — random dark-component placement.
- `randomTargetFor(start)` / `randomValidTargetFor(start)` — reachable +
  distinct target for carry-over endless mode.
- `generatePuzzle(min, max)` / `generateValidPuzzle(min, max)` — fresh
  start+target pair with par in a window. (Random-pair + filter; less
  principled than a random walk — repo 3 uses a walk; this is fine because the
  state space is tiny.)

## Verification path (when the physical deck is available)

1. For each of the 60 physical cards, compute `boardHash` (or look the grid up
   in `POOL.md`).
2. Look the hash up in `pool.json` — it **must** be present (the card is a
   dark-component board by construction). This confirms the card is in our
   universe.
3. Cross-reference against `cards.json`'s 60 hashes:
   - matching hash → the card is one we already generated (and we know which
     one).
   - no match → a physical card we didn't generate; add it to the deck and
     re-emit.
4. After diffing, `cards.json` can be regenerated to exactly mirror the
   physical deck, preserving the `boardHash` dedup so no orbit is repeated.