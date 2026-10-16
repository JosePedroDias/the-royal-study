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

## 4. Verification against the physical board game

**Status: unverified — the 10 web-app boards cannot be confirmed against
the 60-card physical deck from public web sources.**

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

## Appendix — source files fetched

| URL | Purpose |
|-----|---------|
| `https://the-royal-study-chess.vercel.app/` | App shell; confirmed Next.js + Spanish UI. |
| `…/_next/static/chunks/app/page-bdf3c8756188ac81.js` | Main game logic: board data, state machine, move validation, rendering. |
| `…/_next/static/chunks/43-1b10d41d11987599.js` | Vendor chunk (no game data). |
| `…/_next/static/chunks/945-24710e330d08e0c9.js` | Vendor chunk (no game data). |
| `https://www.philosshop.de/en/The-Royal-Study/2850` | Publisher page: specs, rules PDF link. |
| `https://boardgamegeek.com/boardgame/451989/the-royal-study` | BGG page (sparse). |
| Rules PDFs (niggemann.com, chessgamesemporium.com) | Full rules; no card list. |