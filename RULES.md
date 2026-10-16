# The Royal Study — Rules

> Reverse-engineered from the published rules (Philos, author Stan van Rooijen,
> item 2850), the deployed web app
> (<https://the-royal-study-chess.vercel.app/>), and three GitHub repos
> (`Manuel-Avecilla/the_royal_study`, `jostivtrb-create/The-Royal-Study`,
> `rmoya81/the-royal-study`). See `BOARD_COMBINATIONS.md` for the full provenance.
>
> Status: the *rules* below are confirmed against the printed rulebook. The
> *60 physical card layouts* are **not** publicly enumerated anywhere; we
> generate a plausible 60-card deck in `cards.json` (10 seeded from the
> deployed site, 50 generated) — see `BOARD_COMBINATIONS.md` for the
> verification gap.

---

## Components

- **3×3 board** (9 squares), single color of pieces (not two armies).
- **5 chess pieces**: King (K), Queen (Q), Rook (R), Bishop (B), Knight (N).
  A single shared set — there are no "sides."
- **60 objective cards**, each showing one target arrangement of the 5 pieces.
- **Hourglass** (sand timer), used in the 2-player bidding phase.
- 1–2 players; ages 8+; ~20 min; first to **6 points** wins (2-player).

## Board coloring (relevant to reachability)

Standard chess coloring applies to the 3×3:

- **5 dark squares** = corners + center = the squares with `(row + col)` even
  → `{(0,0), (0,2), (1,1), (2,0), (2,2)}` = indices `{0, 2, 4, 6, 8}`.
- **4 light squares** = edges = `(row + col)` odd → `{1, 3, 5, 7}`.
- The pieces are a single **light**-colored set.

> The deployed web app renders the board **cosmetically flipped** (its HTML
> paints even-parity squares light and odd-parity dark), so on screen the
> bishop *appears* to sit on light squares. In the physical game's coloring
> the bishop is on a **dark** square (the 5-square set). This affects nothing
> about reachability — it's purely a rendering choice. The dark-bishop
> component has 7,560 reachable placements; the light-bishop component has
> 5,880. The deployed deck uses the dark component.

## Piece movement (chess rules, adapted)

- Pieces move by standard chess rules **but there are no captures**: a piece
  may only move to an **empty** square.
- Sliding pieces (R, B, Q) may not jump over other pieces — the first piece
  in their path blocks them.
- The **Knight jumps** (ignores blockers), as in chess.
- On the 3×3 the Knight can **never reach the centre square** by geometry
  (a knight move changes both coordinates; `(1,1) ↔ anything` is never a
  knight move), and from the centre it cannot move at all. Generators reject
  `N` at the centre to avoid emitting a dead state.
- A **Bishop's square color is invariant** under any legal move (bishops
  stay on their color). This is what splits the placement graph into the two
  reachability components above.

## Objective

Re-arrange the 5 pieces on the 3×3 so their positions match the **objective
card**. Estimate the minimum number of moves needed, then execute within that
estimate to score.

## The three difficulty levels

Each level adds a transformation you may apply to the **objective card** (the
target), each transformation **costing moves** against your budget:

| Level | Card transforms allowed | Cost model |
|---|---|---|
| **Level 1** | none (play the card as printed) | — |
| **Level 2** | **rotate** the card 90° CW or 90° CCW | 1 move per 90° (180° = 2 moves) |
| **Level 3** | rotations **+ mirror** horizontally or vertically | 1 move per mirror, on top of rotations |

The par for a (start, goal) pair is:

- Level 1 → `minMoves(start, goal)` (no transforms)
- Level 2 → `min` over the 4 rotations (0°/90°/270°/180°) of
  `minMoves(transformed goal) + rotation cost`
- Level 3 → `min` over all 8 dihedral transforms (the 4 rotations + the 4
  reflections) of `minMoves(transformed goal) + transform cost`

These are computed exactly by BFS in `royal-study-engine.js`
(`minMoves`, `minMovesLevel`, `minSolution`). The Level 3 par is the true
optimum even when the game allows interleaving moves and transforms, because
board isometries commute with piece movement — "transform-then-solve" cannot
be beaten by any interleaved plan.

## 2-player (duel) flow — bidding & challenge

1. **Draw a card** and place it below the board.
2. **Bid**: both players study the card and think of the minimum moves
   needed. The first player to declare a number **starts the hourglass**.
3. **Challenge**: while the sand runs (≈15–20s in practice), the opponent
   may either:
   - **challenge** by stating a *lower* number (they must then solve in that
     many), or
   - **pass** (let the original bidder play).
4. **Execute**: whoever is bound to a number moves the pieces. If they solve
   within the bid → they score 1 point; otherwise the point goes to the
   opponent.
5. **Carry-over**: leave the pieces where they landed; draw a new card and
   repeat from step 2. (This is why the deck lives in one reachable
   component — see "Board coloring" above.)
6. **Win**: first player to **6 points**.

## Solo / cooperative flow

- Draw a card, declare a move limit, then execute. Match the target within
  your limit to score; exceeding it is a loss. Pieces carry over between
  cards. No hourglass in solo; the challenge is pure estimation.

## Bonus challenge (any level)

Draw **two** cards instead of one. Bid the total moves to solve **both**.
During execution you choose the order, and any rotate/mirror action is
applied to **one** of the two cards (not both).

---

## Appendix: how our code models this

| Concept | Implementation |
|---|---|
| Board, pieces | `PIECE_ORDER = ["K","Q","R","B","N"]`; square `idx = row*3 + col` |
| Legal moves | `legalDestinations(occupied, from, piece)` — no captures, sliders blocked, knight jumps |
| Par (Level 1) | `minMoves(start, target)` — BFS, no transforms |
| Par (Level 2/3) | `minMovesLevel(start, target, 2|3)`, `minSolution(start, target)` — min over D4 transforms + cost |
| Reconstructed solution | `solve(start, target)` — BFS with interleaved moves + ops, returns the path |
| Dedup key (don't ship the same card twice) | `boardHash(board)` — lex-min over the 8 D4 transforms; invariant under rotation/mirror |
| Carry-over reachability | `isReachable(a, b)` / `reachableSet(start)` — BFS over the move graph |
| Valid deck card | `isValidPlacement(p)` — Bishop on a dark square (the 5-square set), Knight not on the centre |
| Difficulty levels (TUI) | `node play.js [1\|2\|3]` — choose level, estimate a bid, then play to that budget |