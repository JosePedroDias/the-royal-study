# The Royal Study — Findings

## Summary

- The web app at <https://the-royal-study-chess.vercel.app/> is a Next.js
  single-page app. Its game logic lives in one JS chunk:
  `app/page-bdf3c8756188ac81.js`.
- The app embeds **10 target cards** ("Carta Objetivo") plus **one fixed
  starting board**.
- The physical board game (Philos item 2850, by Stan van Rooijen) ships
  **60 objective cards**. So the web app is a ~17% subset of the card deck,
  not the full set.
- No public source enumerates all 60 physical cards (checked: publisher
  store, BGG, rules PDFs from philosshop.de / niggemann.com /
  chessgamesemporium.com). Verifying the 10 web-app boards against the
  physical deck requires owning the game or contacting the author/publisher.
- The web app's **rules** faithfully match the printed rules (no captures,
  3 levels — plain / rotate / mirror — pieces carry over between cards,
  first-to-6 in 2-player, hourglass in the challenge phase).

---

## 1. Notation

3×3 board, read row by row, left to right.

- `/` separates rows, spaces separate cells, `.` = empty.
- Pieces (5 total, all the same color — "white" in the code):
  - **K** = King
  - **Q** = Queen
  - **R** = Rook
  - **B** = Bishop
  - **N** = Knight

Positions are indexed 0–8:

```
0 1 2
3 4 5
6 7 8
```

## 2. The 10 board combinations

### Starting board (shared by every puzzle)

```
R . N
. K .
B Q .
```

i.e. R@0, N@2, K@4, B@6, Q@7.

### Target boards ("Carta Objetivo")

The web app ships exactly these 10 target configurations:

#### Card 1 — `. K . / R . Q / B . N`
```
. K .
R . Q
B . N
```
K@1, R@3, Q@5, B@6, N@8

#### Card 2 — `R . N / . K . / B . Q`
```
R . N
. K .
B . Q
```
R@0, N@2, K@4, B@6, Q@8

#### Card 3 — `K . R / . Q . / B N .`
```
K . R
. Q .
B N .
```
K@0, R@2, Q@4, B@6, N@7

#### Card 4 — `B . K / Q . R / . N .`
```
B . K
Q . R
. N .
```
B@0, K@2, Q@3, R@5, N@7

#### Card 5 — `. N B / K . Q / R . .`
```
. N B
K . Q
R . .
```
N@1, B@2, K@3, Q@5, R@6

#### Card 6 — `R N . / . . K / B . Q`
```
R N .
. . K
B . Q
```
R@0, N@1, K@5, B@6, Q@8

#### Card 7 — `K . Q / R . N / B . .`
```
K . Q
R . N
B . .
```
K@0, Q@2, R@3, N@5, B@6

#### Card 8 — `B K R / . Q . / . N .`
```
B K R
. Q .
. N .
```
B@0, K@1, R@2, Q@4, N@7

#### Card 9 — `B R N / . . . / K Q .`
```
B R N
. . .
K Q .
```
B@0, R@1, N@2, K@6, Q@7

#### Card 10 — `N . Q / . . K / B R .`
```
N . Q
. . K
B R .
```
N@0, Q@2, K@5, B@6, R@7

### Raw data (as found in the source)

```js
// starting board
const startBoard = parseBoard("R . N / . K . / B Q .", "w");

// 10 target cards
const targetBoards = [
  ". K . / R . Q / B . N",
  "R . N / . K . / B . Q",
  "K . R / . Q . / B N .",
  "B . K / Q . R / . N .",
  ". N B / K . Q / R . .",
  "R N . / . . K / B . Q",
  "K . Q / R . N / B . .",
  "B K R / . Q . / . N .",
  "B R N / . . . / K Q .",
  "N . Q / . . K / B R .",
].map(s => parseBoard(s, "w"));
```

## 3. Reverse-engineered app logic

### Phases / state machine

The game is a `useReducer` state machine with these phases:

- `MENU` — mode selection (Solo / 2-player Local).
- `PREDICTING` — Solo: player sets a move limit, optionally rotates/mirrors
  the target card (each costs +1), then starts.
- `BIDDING` — 2-player: active player sets a move limit, then starts a
  challenge.
- `CHALLENGING` — 2-player: the other player has a countdown (15s in the
  app) to either bid fewer moves ("Desafiar") or pass ("Pasar").
- `PLAYING` — the active player moves pieces on the board.
- `WON` / `LOST` — Solo end-of-round outcome.
- `ROUND_OVER` / `MATCH_OVER` — 2-player end-of-round / end-of-match.

Game modes: `SOLO`, `LOCAL_MULTIPLAYER`, `MENU`.

### Piece movement (`SELECT_PIECE` / `MOVE_PIECE`)

- `SELECT_PIECE` computes valid destination squares for the selected piece
  type, respecting board edges. Destination must be empty (no captures).
- Sliding pieces (R, B, Q) additionally check path obstruction: every square
  along the way must be empty (adjacent steps are always allowed; only
  multi-step slides are blocked).
- Knight jumps (ignores blockers).
- `MOVE_PIECE` swaps the piece into the destination, clears the source,
  pushes the new board onto `history`, increments `movesCount`, then checks
  for a win (board matches target board by piece type at each index).

### Win/loss evaluation

After each move:

- `modifierCost = rotations + (mirrorH ? 1 : 0) + (mirrorV ? 1 : 0)`
- `total = movesCount + modifierCost`
- `limit = prediction + modifierCost`
- Win if `board === target` **and** `total <= limit`.
- Solo: `WON` (+1 solved) or `LOST` (over limit). 2-player: point to the
  solver or the opponent depending on who executed; first to 6 wins.

### Rotation / mirror transforms (`m`)

The target card can be rotated (0/1/2/3 × 90°) and mirrored horizontally
and/or vertically. Each active modifier adds +1 to the move cost. The
transform reorders the 9-cell array accordingly.

### Carry-over between cards

`NEXT_LEVEL` sets `levelStartBoard` to the *current* board (pieces stay
where they landed), matching the printed rule "Leave the chess pieces in
their final positions. Draw a new objective card." `RESTART_LEVEL` resets
to `levelStartBoard` (not the original start), so a retry keeps the same
starting position for the current card.

### Other notable details

- Cards are presented in a **shuffled** order (`c` shuffles indices 0–9);
  the queue refills when exhausted.
- Solo `prediction` defaults to 1 and is player-adjustable up from there.
- 2-player `prediction` defaults to 3.
- Asset paths: `/assets/SVG with shadow/<color>_<piece>_svg_withShadow.svg`
  where `<color>` ∈ {w, b} and `<piece>` ∈ {king, queen, rook, bishop,
  knight}. The board always uses white pieces (`w`) for both start and
  target; the target card display renders them as black (`b`) for visual
  contrast.
- Audio: `/assets/chess-piece-move.wav`, `/assets/win.wav`,
  `/assets/lose.wav`.

## 3a. Reachability & board coloring (deck constraints)

**Board coloring** (standard chess convention, matches the physical game):

- **5 dark cells** = corners + center = even parity = `{0, 2, 4, 6, 8}`
- **4 light cells** = edges = odd parity = `{1, 3, 5, 7}`
- **Pieces**: a single **light**-colored set (not two armies) — same as
  repo 2's note ("único set de 5 piezas compartidas").

> The deployed site renders the board **cosmetically flipped**: its HTML
> paints even-parity squares `#fdfcfb` (light) and odd-parity `#e6e1d8`
> (dark), i.e. opposite to standard chess. So on screen the bishop
> *appears* to sit on light squares, but in physical-game coloring it is
> on a dark square (the 5-cell set). Component membership is unchanged;
> it's a rendering choice, not a rules difference.

**Two connected components.** Enumerating all legal placements (5 distinct
pieces, Knight not on the centre) and BFS over the move graph yields exactly
**2 components**, partitioned by the Bishop's square color:

| Component | Bishop on | Size | Reachable from the deployed start? |
|---|---|---|---|
| **dark-bishop** | a dark cell (5-cell set) | **7,560** | yes — the start `R . N / . K . / B Q .` has B@6 (dark) |
| light-bishop | a light cell (4-cell set) | 5,880 | no |

No legal move ever changes a Bishop's color, so the two never connect.
Carry-over between cards (pieces stay where they landed, then a new target
is drawn) **only works within one component**. The deployed deck is entirely
in the **dark-bishop (7,560-state) component**: the fixed start has B@6
(dark) and all 10 target cards place B on a dark square (0, 2, or 6) —
verified empirically (the reachable set from the start has exactly 7,560
placements and contains all 10 cards).

**Constraints for our generated collection** (wired into
`royal-study-engine.js`):

1. **Bishop on a dark square** (the 5-cell set) → stays in the 7,560-state
   dark component the deployed deck uses, so carry-over always works.
2. **Knight never on the centre** (square 4) → geometric on 3×3 (a knight
   can't reach (1,1) from any square; from the centre it can't move at
   all). Enforced to avoid emitting a dead start.

These are encoded as `isValidPlacement(p)` (rejects N at centre and a
light-square Bishop) plus the constrained generators
`randomValidPlacement` / `randomValidTargetFor` / `generateValidPuzzle`.
`isReachable(a, b)` / `reachableSet(start)` validate membership; the test
suite asserts the start's component has 7,560 states and that all 10
deployed cards are valid + reachable.

## 3b. State space (how many unique boards exist)

The constraints induce a clean, finite state space. Enumerating all
placements under the deck constraints (5 distinct pieces, Bishop on a
fixed color, Knight not on the centre) and quotienting by the 8-element
dihedral group D4 (rotations + mirrors — the card transforms the game
allows) gives:

| Component | Raw placements | D4 orbits (unique canonical boards) |
|---|---:|---:|
| **dark-bishop** (5-cell set) | **7,560** | **945** |
| light-bishop (4-cell set) | 5,880 | 735 |
| **total (both colors)** | **13,440** | **1,680** |

The numbers divide evenly (7560/8 = 945; 5880/8 = 735) because the D4 action
is **free** on each component: no non-identity symmetry can fix a placement,
since any reflection or non-trivial rotation swaps at least one pair of
squares, and with 5 distinct pieces a swapped pair can never hold the same
piece. D4 also preserves both deck constraints (it keeps (r+c) parity, hence
Bishop color; and fixes the centre, hence the Knight-off-centre rule), so
the action is clean on the constrained set.

**Deck coverage.** Our 60-card deck (`cards.json`) covers **60 / 945 ≈ 6.3%**
of the dark-component canonical boards — the same fraction a 60-card physical
deck would cover if it is all-dark (as the 10 known cards suggest). The
remaining 885 canonical dark boards are available as alternates; the full
enumeration lives in `enumerate-boards.js` / `canonical-boards.json`.

**Implication for verification.** When the physical deck is available,
`boardHash` each real card and look it up in `canonical-boards.json`: a hit
confirms the card is one of our 945 dark boards (it must be, by the
constraint), and matching it against `cards.json`'s 60 tells us how many of
our generated 50 are real vs. novel.

## 4. The three GitHub repos

The README links three repos. I cloned and inspected each one. **None of
them contain the official 60 physical cards.** Summary:

| # | Repo | What it is | Fixed cards? | Cards in source |
|---|------|------------|--------------|-----------------|
| 1 | `Manuel-Avecilla/the_royal_study` | Next.js — **the source of the deployed site** (`the-royal-study-chess.vercel.app`) | yes (hand-picked) | **10** (`src/lib/levels.json`) |
| 2 | `jostivtrb-create/The-Royal-Study` | Vite PWA "The Royal Enchanted" | **no** — generates puzzles at random at runtime | 0 (procedural) |
| 3 | `rmoya81/the-royal-study` | Vite + Three.js 3D | yes, but **auto-generated**, not the official deck | 24 solo puzzles + **40** DUO cards |

### repo 1 — `Manuel-Avecilla/the_royal_study` (Next.js)

This is the source of the web app we reverse-engineered in §2–§3. The 10
target cards live in `src/lib/levels.json` and are identical to the array we
extracted from the deployed JS chunk:

```json
[
  ". K . / R . Q / B . N",
  "R . N / . K . / B . Q",
  "K . R / . Q . / B N .",
  "B . K / Q . R / . N .",
  ". N B / K . Q / R . .",
  "R N . / . . K / B . Q",
  "K . Q / R . N / B . .",
  "B K R / . Q . / . N .",
  "B R N / . . . / K Q .",
  "N . Q / . . K / B R ."
]
```

Fixed starting board in `src/lib/levels.ts`:
`"R . N / . K . / B Q ."`. Matches §2 exactly. So repo 1 = the deployed
site; nothing new here.

### repo 2 — `jostivtrb-create/The-Royal-Study` (Vite PWA)

Branded "The Royal Enchanted". The README states it is "inspirado
libremente" (loosely inspired) by the board game. Its engine
(`src/game/engine.ts`) has a `randomTargetFor()` / `generatePuzzle()`
generator and a BFS `minSolution()`/`solve()` that create puzzles **on the
fly at runtime**. There is no fixed card list anywhere in the repo. It
cannot contribute the 60 cards.

Useful regardless: its `engine.ts` is the cleanest reference
implementation of the rules + BFS solver + dihedral-group transforms
(rot CW/CCW/mirror H/V, with cost table) among the three repos.

### repo 3 — `rmoya81/the-royal-study` (Vite + Three.js 3D)

A 3D version. `src/game/puzzles.js` is **auto-generated** by
`scripts/generate-puzzles.js` (fixed seed → deterministic, but generated,
not the official deck). It contains two datasets:

- **`LEVELS`** — 24 solo "studies" in 3 groups of 8:
  - `aprendiz` (Aprendiz): **3 pieces** R/N/K, no transforms.
  - `maestro` (Maestro): **4 pieces** Q/R/N/K, rotate allowed.
  - `granmaestro` (Gran Maestro): **5 pieces** Q/R/B/N/K, rotate + mirror.
  - Each study = `{ start, goal, par (BFS-verified), transforms }`.
- **`DUO`** — **40 cards** for the 2-player carry-over bidding mode, each
  an arrangement of all 5 pieces (K/Q/R/B/N). This is the closest thing to
  a "card deck" in any of the repos — but it's 40 generated arrangements,
  not the 60 printed cards.

This repo also adds two rules not present in the others (claimed to be
"faithful to the Philos rulebook"): the **Bishop must stay on dark
squares** and the **Knight may never occupy the centre**. repo 1 and the
printed rules I read do not state these explicitly, but they follow from
standard chess on a 3×3 (a bishop on a light square can never reach a dark
one; a knight cannot reach the centre from any 3×3 square). Worth noting as
a possible point of divergence vs. the physical cards.

### Conclusion from the repos

- The **10 cards** in §2 come from repo 1 / the deployed site and are a
  hand-picked subset, not the full deck.
- repo 2 generates puzzles at random — no cards to extract.
- repo 3 has **40 generated DUO cards + 24 generated solo studies** with a
  BFS solver; these are a *reimplementation*, not the official 60-card
  deck. They may or may not overlap with the physical cards.
- **No repo or public source enumerates the official 60 physical cards.**
  To obtain them you still need the physical game or the author/publisher.
- Repo 3's generator + BFS solver is, however, a good starting point if
  you later want to *generate* a plausible 60-card set yourself.

## 5. Verification against the physical board game

**Status: unverified — none of the 10 (repo 1) or 40 (repo 3) boards can
be confirmed against the 60-card physical deck from public sources.**

What is known:

- Physical game: Philos item 2850, author Stan van Rooijen, **60 objective
  cards**, 5 chess pieces (K/Q/R/B/N), 3×3 board, hourglass, 1–2 players,
  first to 6 points.
- Three printed difficulty levels:
  - Level 1 — plain card.
  - Level 2 — may rotate the card 90°/180° (costs 1 move per 90°).
  - Level 3 — may also mirror the card horizontally/vertically (costs 1
    move each).
- Bonus challenge: draw two cards, solve both, apply rotate/mirror to one
  of the two.

What is unknown (no public source lists it): the exact 60 card layouts.

Sources checked for a full 60-card listing — none enumerate the cards:

- Publisher store: <https://www.philosshop.de/en/The-Royal-Study/2850>
  → specs confirm "60 task cards"; no card list. Rules PDF linked but
  contains no card enumeration.
- BGG: <https://boardgamegeek.com/boardgame/451989/the-royal-study>
  → page is sparse / admin-flagged; no card list.
- BGG review thread (meepletales): blocked (403).
- Rombol / chessgamesemporium / HRAS / niggemann rules PDFs: describe
  rules only, no card enumeration.

To verify the 10 web-app boards, you would need to either:

1. physically own the game and compare each board against the 60-card
   deck, or
2. contact the author (Stan van Rooijen) or publisher (Philos,
   info@philosspiele.de) for the card list.

What *can* be confirmed from the web: the web app's rules faithfully match
the printed rules (no captures, 3 levels with rotate/mirror costs, pieces
carry over between cards, first-to-6 in 2-player, hourglass in the
challenge phase).

---

## Appendix A — repo 3's generated card data (`rmoya81/the-royal-study`)

> **These are NOT the official 60 physical cards.** They are auto-generated
> by `scripts/generate-puzzles.js` (fixed seed). Included here because they
> are the largest concrete, fully-specified card set found in any repo, and
> the 40 DUO cards are the closest analogue to a physical "objective card"
> (a single 5-piece arrangement). Board index: row 0 = top, col 0 = left.

### A.1 — `DUO.cards` (40 cards, all 5 pieces K/Q/R/B/N)

1. `Q . R / . B . / K N .`
2. `. . Q / K . . / B R N`
3. `R . . / N . . / K Q B`
4. `R . . / . Q N / B . K`
5. `Q . B / R . . / . N K`
6. `B . . / N . K / Q R .`
7. `K N . / Q B . / R . .`
8. `K . N / R . . / Q . B`
9. `B . . / K . R / . N Q`
10. `B . . / . . N / Q R K`
11. `. Q B / . . K / N R .`
12. `B Q R / . . . / N K .`
13. `N R B / . K . / . Q .`
14. `. K Q / N . . / R . B`
15. `. . . / N . K / Q R B`
16. `. . N / . . K / Q R B`
17. `K N Q / . . . / B R .`
18. `B . K / . . N / R Q .`
19. `. . N / R K . / Q . B`
20. `K . N / . Q . / B R .`
21. `. K B / N . . / Q R .`
22. `N K . / . . . / B Q R`
23. `B . Q / . . K / N . R`
24. `B N R / Q . . / K . .`
25. `Q N . / K . . / . R B`
26. `B R N / . . K / . . Q`
27. `R K N / . . Q / B . .`
28. `B Q N / . K . / . . R`
29. `K . R / . Q N / . . B`
30. `R N . / K . Q / . . B`
31. `B N . / R Q . / . K .`
32. `R . K / . Q . / B N .`
33. `B . K / Q R . / N . .`
34. `. K B / N R . / . . Q`
35. `B R K / Q . . / . . N`
36. `B . R / Q K . / N . .`
37. `. . . / Q R . / B N K`
38. `Q . N / R . K / . . B`
39. `R Q . / . . . / B N K`
40. `. . B / K . N / R Q .`

### A.2 — `LEVELS` solo studies (24; start → goal, BFS par)

#### Aprendiz (3 pieces R/N/K, no transforms) — 8 studies

1. start `. . . / N K R / . . .` → goal `R . . / . . . / . K N` (par 4)
2. start `. R N / . K . / . . .` → goal `R . . / N . . / . K .` (par 3)
3. start `. N . / . . . / K R .` → goal `. . K / . . . / N R .` (par 3)
4. start `. K . / . R N / . . .` → goal `. . K / . R . / . N .` (par 3)
5. start `. . . / . R . / N . K` → goal `. N . / . . K / R . .` (par 4)
6. start `. . K / R . . / . N .` → goal `N . . / . . K / . R .` (par 4)
7. start `K . . / . . R / N . .` → goal `. N . / . . . / . K R` (par 4)
8. start `. . . / R . K / . . N` → goal `. N . / R . . / K . .` (par 3)

#### Maestro (4 pieces Q/R/N/K, rotate) — 8 studies

1. start `R N . / . . Q / K . .` → goal `K R . / . Q . / N . .` (par 4)
2. start `. R N / Q . K / . . .` → goal `N . . / R K . / Q . .` (par 3)
3. start `. N . / . . Q / R K .` → goal `R K . / . Q N / . . .` (par 3)
4. start `N . R / K . . / . . Q` → goal `Q . N / . . R / . . K` (par 5)
5. start `N . K / Q . . / R . .` → goal `K . . / Q . . / N R .` (par 3)
6. start `Q N . / R . . / . K .` → goal `. Q . / N . K / . . R` (par 4)
7. start `. . Q / . . . / K R N` → goal `. R . / K . . / N . Q` (par 4)
8. start `Q . . / . R K / . N .` → goal `. . Q / . R K / . . N` (par 3)

#### Gran Maestro (5 pieces Q/R/B/N/K, rotate + mirror) — 8 studies

1. start `. Q R / . B N / . K .` → goal `N . . / K Q . / B . R` (par 4)
2. start `. R . / Q K . / . N B` → goal `K . . / N Q R / . . B` (par 5)
3. start `R . . / . Q . / B N K` → goal `R Q . / . K . / . N B` (par 4)
4. start `K . . / . . N / B Q R` → goal `. K B / Q . . / . N R` (par 4)
5. start `R Q . / . K . / N . B` → goal `. Q R / . B N / . . K` (par 5)
6. start `R . B / . . K / Q . N` → goal `. K . / N . . / Q R B` (par 5)
7. start `K . R / . B . / N Q .` → goal `. N . / . B K / R . Q` (par 5)
8. start `N . . / K Q . / . R B` → goal `. . B / Q . N / K . R` (par 5)

---

## Appendix B — source files fetched / inspected

| URL / path | Purpose |
|-----|---------|
| `https://the-royal-study-chess.vercel.app/` | App shell; confirmed Next.js + Spanish UI. |
| `…/_next/static/chunks/app/page-bdf3c8756188ac81.js` | Deployed game logic (the minified source of repo 1). |
| repo 1 `src/lib/levels.json`, `src/lib/levels.ts`, `src/lib/gameReducer.ts`, `src/lib/chessEngine.ts` | Source of the 10 cards + state machine + move rules. |
| repo 2 `src/game/engine.ts`, `src/game/pieces.ts` | Random generator + BFS solver + dihedral transforms; no fixed cards. |
| repo 3 `src/game/puzzles.js`, `src/game/engine.js`, `src/game/solver.js`, `scripts/generate-puzzles.js` | Generated 24 solo studies + 40 DUO cards; generator + BFS solver. |
| `https://www.philosshop.de/en/The-Royal-Study/2850` | Publisher page: specs, rules PDF link. |
| `https://boardgamegeek.com/boardgame/451989/the-royal-study` | BGG page (sparse). |
| Rules PDFs (niggemann.com, chessgamesemporium.com) | Full rules; no card list. |