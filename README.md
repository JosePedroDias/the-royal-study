# The Royal Study

## What is it?

The Royal Study is a board game for 1 or 2 players.
It uses some rules of chess (several pieces and their moves),
constraining the board to a 3x3 one.

## Credits

- **Game design**: Stan van Rooijen
- **Publisher**: [Philos Spiel- und Geschenkartikel GmbH & Co. KG](https://www.philosspiele.de) (item 2850)

## Reference URLs

- [publisher's store of the game](https://www.philosshop.de/en/The-Royal-Study/2850)
- [boardgamegeek page](https://boardgamegeek.com/boardgame/451989/the-royal-study)
- [bgg review in text](https://boardgamegeek.com/thread/3661260/the-royal-study-a-review-by-meepletales)
- [cuby review in video](https://youtu.be/9PY5n2_ThE0)
- [a web version of the game 1](https://the-royal-study-chess.vercel.app/)
- [repo for game 1](https://github.com/Manuel-Avecilla/the_royal_study)
- [repo for game 2](https://github.com/jostivtrb-create/The-Royal-Study)
- [repo for game 3](https://github.com/rmoya81/the-royal-study)

## How to play (the terminal version)

```
node play.js [--unicode] [1|2|3]
```

- Pick a **level** (or pass `1`/`2`/`3` as an argument to skip the prompt):
  - **Level 1** — no card transforms
  - **Level 2** — you may rotate the goal card 90° (CW/CCW, each +1 move)
  - **Level 3** — rotations + mirrors (H/V, each +1 move)
- You're shown the **start** and **goal** boards. Study them and **bid** how
  many total moves (piece moves + card ops) you think you need.
- Play by typing the number of a move and Enter:
  - piece moves re-list every turn (`King @4 → 1`, or `♔ @4 → 1` with `--unicode`)
  - at Level 2/3 the goal-card transforms are listed too (each costs 1 op)
  - `u` = undo, `q` = quit
- The status line shows `estimate · used · remaining` (or `OVER by N`).
- Match the goal to win. The **three pars** (one per level) are revealed only
  after you solve or quit — so estimate blind, then see how you did.

Pieces move by chess rules but **no captures**: a piece may only move to an
empty square; sliders (R/B/Q) are blocked by the first piece in their path;
the Knight jumps. Full rules in [`RULES.md`](RULES.md); project notes and
algorithms in [`AGENTS.md`](AGENTS.md).
