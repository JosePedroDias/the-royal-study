# The Royal Study — Rules

> Reverse-engineered from the published rules (Philos, item 2850, by Stan
> van Rooijen), the deployed web app, and three GitHub reimplementation
> repos. See `BOARD_COMBINATIONS.md` for full provenance and the verification
> status of the 60 card layouts.

## Components

- **3×3 board** (9 squares), with a single set of pieces (not two armies).
- **5 chess pieces**: King (K), Queen (Q), Rook (R), Bishop (B), Knight (N).
- **60 objective cards**, each showing one target arrangement of the 5 pieces.
- **Hourglass** (sand timer), used in the 2-player bidding phase.
- 1–2 players; ages 8+; ~20 min; first to **6 points** wins (2-player).

## Piece movement (chess rules, adapted)

- Pieces move by standard chess rules **but there are no captures**: a piece
  may only move to an **empty** square.
- Sliding pieces (R, B, Q) may not jump over other pieces — the first piece
  in their path blocks them.
- The **Knight jumps** (ignores blockers), as in chess.
- A **Bishop's square color is invariant** (bishops stay on their color), so
  the pieces as a whole can only ever reach placements with the bishop on the
  same color it started on.

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

At Levels 2 and 3, finding the right orientation of the card is part of the
puzzle — the optimal solution often uses a transform to shorten the path.

## 2-player (duel) flow — bidding & challenge

1. **Draw a card** and place it below the board.
2. **Bid**: both players study the card and think of the minimum moves
   needed. The first player to declare a number **starts the hourglass**.
3. **Challenge**: while the sand runs (~15–20s in practice), the opponent may
   either:
   - **challenge** by stating a *lower* number (they must then solve in that
     many), or
   - **pass** (let the original bidder play).
4. **Execute**: whoever is bound to a number moves the pieces. If they solve
   within the bid → they score 1 point; otherwise the point goes to the
   opponent.
5. **Carry-over**: leave the pieces where they landed; draw a new card and
   repeat from step 2.
6. **Win**: first player to **6 points**.

## Solo / cooperative flow

Draw a card, declare a move limit, then execute. Match the target within your
limit to score; exceeding it is a loss. Pieces carry over between cards. No
hourglass in solo; the challenge is pure estimation.

## Bonus challenge (any level)

Draw **two** cards instead of one. Bid the total moves to solve **both**.
During execution you choose the order, and any rotate/mirror action is applied
to **one** of the two cards (not both).