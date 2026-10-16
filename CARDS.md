# The Royal Study — generated 60-card deck

- **Component**: dark-bishop (7,560 states) — the component the deployed deck uses.
- **Dedup key**: `boardHash` (dihedral orbit, D4-invariant) — no two cards are rotations/mirrors of each other.
- **Start** (card 1 / reference par): `R . N / . K . / B Q .`. Carry-over thereafter.
- **parLevel1** = `minMoves` (no card transforms). **parLevel23** = `minSolution` (rotate + mirror allowed, Levels 2/3).
- **Seed**: the 10 `seed` cards are the deployed-site cards (known-real subset). The other 50 are plausible but **unverified** against the physical 60-card deck.

| # | board | par L1 | par L2/3 | seed | hash |
|---|-------|-------:|---------:|:----:|------|
| 1 | `R . N / . K . / B . Q` | 1 | 1 | yes | B.Q.K.R.N |
| 2 | `R . N / . . . / B K Q` | 2 | 2 |  | B.RK..Q.N |
| 3 | `. . . / N R K / B Q .` | 4 | 4 |  | ...KRN.QB |
| 4 | `R Q N / . . K / . . B` | 4 | 4 |  | ..B..KRQN |
| 5 | `. . N / Q B . / R . K` | 4 | 4 |  | ..NQB.R.K |
| 6 | `. K . / R . Q / B . N` | 5 | 5 | yes | .K.Q.RN.B |
| 7 | `K . R / . Q . / B N .` | 5 | 5 | yes | ..RNQ.B.K |
| 8 | `R N . / . . K / B . Q` | 5 | 5 | yes | .KQN..R.B |
| 9 | `B R N / . . . / K Q .` | 5 | 5 | yes | ..NQ.RK.B |
| 10 | `. Q K / N . . / B . R` | 5 | 5 |  | .NBQ..K.R |
| 11 | `. Q B / R . . / . N K` | 5 | 5 |  | .NKR...QB |
| 12 | `. N K / R . . / B Q .` | 5 | 5 |  | ..KQ.NBR. |
| 13 | `. K . / N . . / R Q B` | 5 | 5 |  | ..BK.Q.NR |
| 14 | `K . N / Q B . / . . R` | 6 | 4 |  | ..RQB.K.N |
| 15 | `B . R / N K . / . Q .` | 6 | 3 |  | ..RQK..NB |
| 16 | `B R . / N . K / Q . .` | 6 | 5 |  | ..QK.N.RB |
| 17 | `N . K / . . . / B R Q` | 6 | 6 |  | B.NR..Q.K |
| 18 | `. . B / R . . / Q N K` | 6 | 6 |  | ..BR..QNK |
| 19 | `. K Q / N R . / B . .` | 6 | 6 |  | ..B.RNQK. |
| 20 | `B R . / N Q K / . . .` | 6 | 5 |  | ...KQN.RB |
| 21 | `N . R / K . . / B Q .` | 6 | 4 |  | ..RQ..BKN |
| 22 | `B R . / N . . / K Q .` | 6 | 5 |  | ...Q.RKNB |
| 23 | `. Q B / . R K / . N .` | 6 | 6 |  | ...NRQ.KB |
| 24 | `. . K / N B R / . . Q` | 6 | 6 |  | ..KNBR..Q |
| 25 | `. K . / N B R / . . Q` | 6 | 6 |  | ..QNBR.K. |
| 26 | `B . K / Q . R / . N .` | 7 | 6 | yes | .N.Q.RB.K |
| 27 | `K . Q / R . N / B . .` | 7 | 7 | yes | ..BN.RQ.K |
| 28 | `B K R / . Q . / . N .` | 7 | 6 | yes | ..BNQK..R |
| 29 | `N . Q / . . K / B R .` | 7 | 6 | yes | .KQR..B.N |
| 30 | `B Q R / . . . / . N K` | 7 | 6 |  | ..BN.QK.R |
| 31 | `R . B / Q . . / N K .` | 7 | 4 |  | ..BK..NQR |
| 32 | `. N B / . . K / . Q R` | 7 | 5 |  | ...N.QBKR |
| 33 | `. R . / N K . / Q . B` | 7 | 6 |  | ..BRK..NQ |
| 34 | `. N K / . . . / R Q B` | 7 | 5 |  | ..RN.QK.B |
| 35 | `B . R / Q . . / K N .` | 7 | 5 |  | ..RN..KQB |
| 36 | `N . K / . . R / B Q .` | 7 | 5 |  | .QBR..K.N |
| 37 | `B . K / Q . . / R N .` | 7 | 5 |  | ..KN..RQB |
| 38 | `. . B / Q K R / . N .` | 7 | 7 |  | ..BQKR.N. |
| 39 | `K . B / . . Q / . R N` | 7 | 7 |  | ..KR..NQB |
| 40 | `. Q N / . R . / K . B` | 7 | 7 |  | ..KQR.N.B |
| 41 | `N . Q / R B K / . . .` | 7 | 5 |  | ...KBRQ.N |
| 42 | `N R . / . Q K / . . B` | 7 | 4 |  | ..B.QKNR. |
| 43 | `. N B / K . Q / R . .` | 8 | 5 | yes | ..RQ.KBN. |
| 44 | `B . N / . K . / Q . R` | 8 | 5 |  | B.N.K.Q.R |
| 45 | `N . . / . Q K / . R B` | 8 | 5 |  | ..NKQ.BR. |
| 46 | `B . . / K R Q / . . N` | 8 | 5 |  | ..BQRKN.. |
| 47 | `N . B / Q . . / K R .` | 8 | 6 |  | ..BR..KQN |
| 48 | `B . . / Q R . / K N .` | 8 | 7 |  | ....RNBQK |
| 49 | `N . K / . . Q / . R B` | 8 | 3 |  | ..NR..BQK |
| 50 | `. . B / . . N / R K Q` | 8 | 6 |  | ..B..NRKQ |
| 51 | `B . . / N Q R / K . .` | 8 | 5 |  | ..BRQN..K |
| 52 | `R . . / K . Q / N . B` | 8 | 5 |  | ..RQ.KB.N |
| 53 | `K N Q / . . . / B . R` | 8 | 7 |  | B.K..NR.Q |
| 54 | `. . . / K B N / Q R .` | 9 | 7 |  | ...KBNQR. |
| 55 | `B N K / . . R / . . Q` | 9 | 6 |  | ..B..NQRK |
| 56 | `. . Q / . B . / K R N` | 9 | 5 |  | ..K.BRQ.N |
| 57 | `R . . / K Q N / . . B` | 9 | 5 |  | ..BKQNR.. |
| 58 | `. . . / K B R / N . Q` | 9 | 7 |  | ...KBRN.Q |
| 59 | `N . . / K Q . / . R B` | 9 | 4 |  | ..B.QRNK. |
| 60 | `B N K / . R . / . . Q` | 9 | 7 |  | ..B.RNQ.K |

## Distribution (Level-1 par)

| par | count |
|----:|------:|
| 1 | 1 |
| 2 | 1 |
| 4 | 3 |
| 5 | 8 |
| 6 | 12 |
| 7 | 17 |
| 8 | 11 |
| 9 | 7 |
