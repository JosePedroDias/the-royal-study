// royal-study-engine.js
//
// Self-contained extraction of the generation/solver algorithm from
// jostivtrb-create/The-Royal-Study (repo 2, "The Royal Enchanted"), ported
// from its original TypeScript (src/game/engine.ts + pieces.ts) to plain JS.
//
// Run:  node royal-study-engine.js            # built-in test suite + demo
//
// What's here (all faithful to the original):
//   - 3x3 chess movement rules (no captures; sliders blocked by pieces; knight jumps)
//   - BFS solver: minMoves, minSolution (with dihedral transforms), solve (path)
//   - Generators: randomPlacement, randomTargetFor (carry-over), generatePuzzle
//   - Helpers: parseGrid / toGrid so placements match the "R . N / . K . / B Q ."
//     notation used in BOARD_COMBINATIONS.md, plus toList for a compact per-piece view.
//
// Original (c) jostivtrb-create; "inspirado libremente" by The Royal Study (Philos).
// Rules summary: no captures, pieces move only to EMPTY squares, no jumping except
// the Knight. The Knight can never reach the centre square of a 3x3 by geometry
// (the original additionally rejects N at the centre in randomPlacement).

import { fileURLToPath } from "node:url";
import { argv } from "node:process";

// ---- Types & constants -----------------------------------------------------

// A Placement maps each of the 5 piece types to a square index 0..8
// (idx = row*3 + col; row 0 = top, col 0 = left).
//   0 1 2
//   3 4 5
//   6 7 8
const PIECE_ORDER = ["K", "Q", "R", "B", "N"];
const N = 3;

const rc = (s) => ({ row: Math.floor(s / N), col: s % N });
const sq = (row, col) => row * N + col;
const inBoard = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

// ---- Chess movement (to empty squares; no jumping except Knight) -----------

const SLIDES = {
  R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  Q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};
const KING_STEPS = SLIDES.Q; // 8 adjacent
const KNIGHT_STEPS = [
  [1, 2], [2, 1], [-1, 2], [-2, 1],
  [1, -2], [2, -1], [-1, -2], [-2, -1],
];

// Free squares the piece at `from` may move to (empty & reachable).
function legalDestinations(occupied, from, piece) {
  return reachable(occupied, from, piece).free;
}

// Free + blocked (occupied by a piece) squares at reach. Sliders stop at the
// first piece they hit; King/Knight just enumerate their target squares.
function reachable(occupied, from, piece) {
  const { row, col } = rc(from);
  const free = [];
  const blocked = [];
  const step = (r, c) => {
    if (!inBoard(r, c)) return;
    const s = sq(r, c);
    if (occupied.has(s)) blocked.push(s);
    else free.push(s);
  };
  if (piece === "K") {
    for (const [dr, dc] of KING_STEPS) step(row + dr, col + dc);
  } else if (piece === "N") {
    for (const [dr, dc] of KNIGHT_STEPS) step(row + dr, col + dc);
  } else {
    for (const [dr, dc] of SLIDES[piece]) {
      let r = row + dr, c = col + dc;
      while (inBoard(r, c)) {
        const s = sq(r, c);
        if (occupied.has(s)) { blocked.push(s); break; }
        free.push(s);
        r += dr; c += dc;
      }
    }
  }
  return { free, blocked };
}

// ---- Placement utilities ----------------------------------------------------

const occupiedOf = (p) => new Set(PIECE_ORDER.map((t) => p[t]));
const serialize = (p) => PIECE_ORDER.map((t) => p[t]).join(",");
const equalPlacement = (a, b) => PIECE_ORDER.every((t) => a[t] === b[t]);

// ---- Dihedral transforms (D4) with costs ------------------------------------
// Cost model matches the game: rotations + mirrorH + mirrorV (additive).
//   id 0, rot90 1, rot180 2, rot270 1, mirrorH 1, mirrorV 1,
//   transpose (rot90+mirrorH) 2, antitranspose (rot270+mirrorH) 2.

const m = (r, c) => sq(r, c);
const OP_MAP = {
  rotCW: (s) => { const { row, col } = rc(s); return m(col, N - 1 - row); },
  rotCCW: (s) => { const { row, col } = rc(s); return m(N - 1 - col, row); },
  mirrorH: (s) => { const { row, col } = rc(s); return m(row, N - 1 - col); },
  mirrorV: (s) => { const { row, col } = rc(s); return m(N - 1 - row, col); },
};
const OP_LABEL = {
  rotCW: "Rotar \u27F3", rotCCW: "Rotar \u27F2",
  mirrorH: "Espejo \u21C4", mirrorV: "Espejo \u21C5",
};

function applyOp(p, op) {
  const map = OP_MAP[op];
  const out = {};
  for (const t of PIECE_ORDER) out[t] = map(p[t]);
  return out;
}
function transformPlacement(p, map) {
  const out = {};
  for (const t of PIECE_ORDER) out[t] = map(p[t]);
  return out;
}

const DIHEDRAL = (() => {
  const id = (s) => s;
  const cw = OP_MAP.rotCW;
  const cw2 = (s) => cw(cw(s));
  const ccw = OP_MAP.rotCCW;
  const mh = OP_MAP.mirrorH;
  const mv = OP_MAP.mirrorV;
  const tr = (s) => cw(mh(s));     // transpose
  const at = (s) => ccw(mh(s));   // antitranspose
  return [
    { map: id, cost: 0 },
    { map: cw, cost: 1 },
    { map: ccw, cost: 1 },
    { map: cw2, cost: 2 },
    { map: mh, cost: 1 },
    { map: mv, cost: 1 },
    { map: tr, cost: 2 },
    { map: at, cost: 2 },
  ];
})();

// ---- BFS: minimum number of moves ------------------------------------------

// Min moves to go from `start` to `target` with NO card transforms.
// (Each move relocates one piece to an empty, reachable square.)
function minMoves(start, target) {
  if (equalPlacement(start, target)) return 0;
  const targetKey = serialize(target);
  const visited = new Set([serialize(start)]);
  let frontier = [start];
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    for (const state of frontier) {
      const occ = occupiedOf(state);
      for (const t of PIECE_ORDER) {
        for (const dest of legalDestinations(occ, state[t], t)) {
          const ns = { ...state, [t]: dest };
          const key = serialize(ns);
          if (key === targetKey) return depth;
          if (!visited.has(key)) { visited.add(key); next.push(ns); }
        }
      }
    }
    frontier = next;
    if (depth > 12) break; // safety cap (true max par on 3x3 is small)
  }
  return Infinity;
}

// Min over all 8 dihedral transforms of (moves to transformed target + transform cost).
// Optimal even if the game allows interleaving moves and transforms, because
// transforms are board isometries that commute with piece movement.
function minSolution(start, target) {
  let best = Infinity;
  for (const { map, cost } of DIHEDRAL) {
    const tt = transformPlacement(target, map);
    const mv = minMoves(start, tt);
    if (mv + cost < best) best = mv + cost;
  }
  return best;
}

// ---- Solver with a reconstructed path (moves + ops, interleaving allowed) --
// Action: { kind: "move", piece, from, to } | { kind: "op", op }

const ALL_OPS = ["rotCW", "rotCCW", "mirrorH", "mirrorV"];

function solve(start, target) {
  const startKey = serialize(start);
  const targetKey = serialize(target);
  if (startKey === targetKey) return { min: 0, path: [] };

  const prev = new Map();
  const visited = new Set([startKey]);
  let frontier = [start];
  let depth = 0;

  const finish = () => {
    const path = [];
    let key = targetKey;
    while (key !== startKey) {
      const e = prev.get(key);
      path.push(e.action);
      key = e.from;
    }
    path.reverse();
    return { min: path.length, path };
  };

  while (frontier.length) {
    depth++;
    const next = [];
    for (const state of frontier) {
      const stateKey = serialize(state);
      const occ = occupiedOf(state);
      for (const t of PIECE_ORDER) {
        for (const dest of legalDestinations(occ, state[t], t)) {
          const ns = { ...state, [t]: dest };
          const key = serialize(ns);
          if (visited.has(key)) continue;
          visited.add(key);
          prev.set(key, {
            from: stateKey,
            action: { kind: "move", piece: t, from: state[t], to: dest },
          });
          if (key === targetKey) return finish();
          next.push(ns);
        }
      }
      for (const op of ALL_OPS) {
        const ns = applyOp(state, op);
        const key = serialize(ns);
        if (visited.has(key)) continue;
        visited.add(key);
        prev.set(key, { from: stateKey, action: { kind: "op", op } });
        if (key === targetKey) return finish();
        next.push(ns);
      }
    }
    frontier = next;
    if (depth > 16) break;
  }
  return { min: Infinity, path: [] };
}

// ---- Generators -------------------------------------------------------------

const CENTER = sq(1, 1);

// ---- Reachability / deck constraints ---------------------------------------
//
// Board coloring (standard chess convention, matches the physical game):
//   5 DARK cells = corners + center = even parity = {0, 2, 4, 6, 8}
//   4 LIGHT cells = edges            = odd  parity = {1, 3, 5, 7}
// The game uses a single LIGHT-colored set of pieces (not two armies).
//
// On a 3x3 board the legal placements (5 distinct pieces, Knight not on the
// centre) split into exactly TWO connected components under the move graph,
// partitioned by the Bishop's square color:
//   dark-bishop component  — 7,560 placements (B on a dark cell, 0/2/6/8)
//   light-bishop component — 5,880 placements (B on a light cell, 1/3/5/7)
// No legal move ever changes a Bishop's color, so the two components never
// connect: carry-over between cards (pieces stay where they landed, then a
// new target is drawn) only works WITHIN one component.
//
// The deployed "The Royal Study" deck uses the DARK component: the fixed
// start "R . N / . K . / B Q ." has B on square 6 (dark), and all 10 target
// cards place B on a dark square (0, 2, or 6). Verified empirically: the
// dark component reachable from the start contains all 10.
//
// NOTE: the deployed site renders the board colors cosmetically FLIPPED
// (its HTML paints even-parity squares light and odd-parity dark), so on
// screen the bishop appears on light squares. That is a rendering choice;
// in physical-game coloring the bishop is on dark squares (the 5-cell set).
// The component math is unaffected. isDark below uses the physical-game
// convention (even parity = dark).
//
// The Knight can never reach the centre of a 3x3 by geometry (a knight move
// always changes both coordinates; (1,1)<->anything is never a knight move),
// and from the centre it can't move at all. We reject N on the centre in
// placement generation to avoid emitting a dead start.

const isDark = (i) => (Math.floor(i / N) + (i % N)) % 2 === 0; // (r+c) even => dark (5-cell set)
const BISHOP_COLOR = "dark"; // physical deck uses the dark-square (5-cell) component

// A placement is valid for the deck iff the Bishop is on the fixed color
// (dark) and the Knight is not stranded on the centre.
function isValidPlacement(p) {
  if (p.N === CENTER) return false; // never strand the Knight
  if (BISHOP_COLOR === "dark" && !isDark(p.B)) return false;
  if (BISHOP_COLOR === "light" && isDark(p.B)) return false;
  return true;
}

// Full BFS reachability (no depth cap): is `target` reachable from `start`
// by legal moves alone (no card transforms)? Use this for deck validation.
function isReachable(start, target) {
  if (equalPlacement(start, target)) return true;
  const targetKey = serialize(target);
  const visited = new Set([serialize(start)]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const state of frontier) {
      const occ = occupiedOf(state);
      for (const t of PIECE_ORDER) {
        for (const dest of legalDestinations(occ, state[t], t)) {
          const ns = { ...state, [t]: dest };
          const key = serialize(ns);
          if (key === targetKey) return true;
          if (!visited.has(key)) { visited.add(key); next.push(ns); }
        }
      }
    }
    frontier = next;
  }
  return false;
}

// Reachable set (component) from `start` as a Set of serialize keys. Used to
// verify the deck lives in one component and to size it.
function reachableSet(start) {
  const visited = new Set([serialize(start)]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const state of frontier) {
      const occ = occupiedOf(state);
      for (const t of PIECE_ORDER) {
        for (const dest of legalDestinations(occ, state[t], t)) {
          const ns = { ...state, [t]: dest };
          const key = serialize(ns);
          if (!visited.has(key)) { visited.add(key); next.push(ns); }
        }
      }
    }
    frontier = next;
  }
  return visited;
}

// Random arrangement of all 5 pieces on distinct squares. Rejects the (geometrically
// unreachable) case of the Knight on the centre, same as the original. NOTE:
// does NOT filter by Bishop color — use randomValidPlacement() for deck cards.
function randomPlacement() {
  const squares = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  let p;
  do {
    for (let i = squares.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [squares[i], squares[j]] = [squares[j], squares[i]];
    }
    p = {};
    PIECE_ORDER.forEach((t, i) => (p[t] = squares[i]));
  } while (p.N === CENTER);
  return p;
}

// A reachable, distinct target from `start` (for the carry-over endless mode:
// pieces stay where they landed, then a new target is drawn from that start).
function randomTargetFor(start) {
  for (let i = 0; i < 600; i++) {
    const target = randomPlacement();
    if (target.N === CENTER) continue;
    if (equalPlacement(start, target)) continue;
    const min = minSolution(start, target);
    if (Number.isFinite(min) && min >= 1) return { target, min };
  }
  // Fallback: move a single piece one step.
  const occ = occupiedOf(start);
  for (const t of PIECE_ORDER) {
    const dests = legalDestinations(occ, start[t], t);
    if (dests.length) return { target: { ...start, [t]: dests[0] }, min: 1 };
  }
  return { target: start, min: 0 };
}

// Fresh puzzle (independent start + target) whose par lies in [min, max].
// Note: random-pair + filter; on 3x3 the state space is tiny so this is cheap,
// but it is less principled than a random-walk generator (see repo 3).
function generatePuzzle(min = 2, max = 6) {
  for (let tries = 0; tries < 400; tries++) {
    const start = randomPlacement();
    const target = randomPlacement();
    if (equalPlacement(start, target)) continue;
    const sol = minSolution(start, target);
    if (sol >= min && sol <= max) return { start, target, min: sol };
  }
  // Fallback: any reachable pair (ignores the [min,max] window).
  const start = randomPlacement();
  let target = randomPlacement();
  while (equalPlacement(start, target)) target = randomPlacement();
  return { start, target, min: minSolution(start, target) };
}

// ---- Constrained generators (deck-valid: dark Bishop, Knight off centre) ----
//
// These wrap the unconstrained generators to stay within the dark-bishop
// component the physical deck uses. Use them when generating a collection
// meant to be played with carry-over from the standard start.

// Random placement within the dark-bishop component (also rejects N at centre).
function randomValidPlacement() {
  for (let i = 0; i < 1000; i++) {
    const p = randomPlacement();
    if (isValidPlacement(p)) return p;
  }
  // Fallback: nudge a light-bishop placement onto a dark square.
  const p = randomPlacement();
  const darkFree = [0, 2, 6, 8].find((s) => !Object.values(p).includes(s));
  return { ...p, B: darkFree };
}

// Carry-over target: valid + reachable + distinct from `start`.
function randomValidTargetFor(start) {
  for (let i = 0; i < 600; i++) {
    const target = randomValidPlacement();
    if (equalPlacement(start, target)) continue;
    const min = minSolution(start, target);
    if (Number.isFinite(min) && min >= 1) return { target, min };
  }
  // Fallback: move a single piece one step (preserves validity).
  const occ = occupiedOf(start);
  for (const t of PIECE_ORDER) {
    for (const dest of legalDestinations(occ, start[t], t)) {
      const ns = { ...start, [t]: dest };
      if (isValidPlacement(ns)) return { target: ns, min: 1 };
    }
  }
  return { target: start, min: 0 };
}

// Fresh deck-valid puzzle whose par lies in [min, max].
function generateValidPuzzle(min = 2, max = 6) {
  for (let tries = 0; tries < 400; tries++) {
    const start = randomValidPlacement();
    const target = randomValidPlacement();
    if (equalPlacement(start, target)) continue;
    const sol = minSolution(start, target);
    if (sol >= min && sol <= max) return { start, target, min: sol };
  }
  const start = randomValidPlacement();
  let target = randomValidPlacement();
  while (equalPlacement(start, target)) target = randomValidPlacement();
  return { start, target, min: minSolution(start, target) };
}

// ---- Notation helpers (match BOARD_COMBINATIONS.md) ------------------------

// "R . N / . K . / B Q ."  ->  { K:4, Q:7, R:0, B:6, N:2 }
function parseGrid(str) {
  const chars = str.replace(/[\s/]+/g, "").split("");
  if (chars.length !== 9) throw new Error(`Invalid board string length: ${chars.length}`);
  const p = {};
  for (let i = 0; i < 9; i++) {
    const ch = chars[i];
    if (ch === ".") continue;
    if (!PIECE_ORDER.includes(ch)) throw new Error(`Invalid piece: ${ch}`);
    p[ch] = i;
  }
  return p;
}

// { K:4, Q:7, R:0, B:6, N:2 }  ->  "R . N / . K . / B Q ."
function toGrid(p) {
  const g = Array(9).fill(".");
  for (const t of PIECE_ORDER) g[p[t]] = t;
  return [g.slice(0, 3).join(" "), g.slice(3, 6).join(" "), g.slice(6, 9).join(" ")].join(" / ");
}

// { K:4, Q:7, R:0, B:6, N:2 }  ->  "R@0 N@2 K@4 B@6 Q@7"
function toList(p) {
  return PIECE_ORDER.slice()
    .sort((a, b) => (rc(p[a]).row - rc(p[b]).row) || (rc(p[a]).col - rc(p[b]).col))
    .map((t) => `${t}@${p[t]}`).join(" ");
}

// Describe a solved path as a sequence of human-readable steps.
function describePath(path) {
  return path.map((a) =>
    a.kind === "move"
      ? `move ${a.piece} ${a.from}->${a.to}`
      : `${OP_LABEL[a.op]} (cost 1)`
  );
}

// ---- Dihedral-invariant canonical hashes -----------------------------------
//
// Two boards (or two puzzles) that differ only by a symmetry of the 3x3 grid
// (rotations and/or mirrors — the D4 group, 8 elements) are the *same* puzzle
// under the game's rules: rotating/mirroring the card costs moves, so the par
// of (S -> T) equals the par of (g(S) -> g(T)) for any grid symmetry g.
//
// `boardHash(board)`  — canonical key for a single board. Two boards in the
//   same D4 orbit share the key; boards in different orbits do not. Use this
//   to dedup a set of target cards when the start is fixed (e.g. repo 1).
//
// `puzzleHash(start, target)` — canonical key for a (start -> target) puzzle,
//   invariant under applying the *same* symmetry to both boards at once. Use
//   this as the dedup key for a generated collection where starts vary
//   (carry-over / repo 3 style). This is the right "don't ship the same
//   canonical puzzle twice" key.
//
// The key is the lexicographically smallest of the 8 transformed grid strings
// (puzzle key = smallest of "startGrid|targetGrid"). It is self-describing and
// stable; `boardHashNum` / `puzzleHashNum` give compact integer variants.

// The 8 elements of D4 as idx->idx bijections (id, rot90CW, rot180, rot270CW,
// mirrorH, mirrorV, transpose, antitranspose). Built from the tested OP_MAP.
const D4 = (() => {
  const id = (s) => s;
  const cw = OP_MAP.rotCW;
  const ccw = OP_MAP.rotCCW;
  const cw2 = (s) => cw(cw(s));
  const mh = OP_MAP.mirrorH;
  const mv = OP_MAP.mirrorV;
  const tr = (s) => cw(mh(s));   // transpose (main diagonal)
  const at = (s) => ccw(mh(s));  // antitranspose (anti diagonal)
  return [id, cw, cw2, ccw, mh, mv, tr, at];
})();

// 9-cell row-major array for either a Placement or a grid string.
function boardCells(board) {
  if (typeof board === "string") {
    const chars = board.replace(/[\s/]+/g, "").split("");
    if (chars.length !== 9) throw new Error(`Invalid board string length: ${chars.length}`);
    return chars;
  }
  const cells = Array(9).fill(".");
  for (const t of PIECE_ORDER) {
    if (board[t] == null) continue;
    cells[board[t]] = t;
  }
  return cells;
}

// Apply a D4 element φ to a 9-cell array: the piece at i moves to φ(i).
function applyD4(cells, phi) {
  const out = Array(9);
  for (let i = 0; i < 9; i++) out[phi(i)] = cells[i];
  return out;
}

// Canonical grid string of a single board (lex-min over the 8 D4 transforms).
// Invariant under rotation and mirroring. This is the board hash.
function boardHash(board) {
  const cells = boardCells(board);
  let best = null;
  for (const phi of D4) {
    const s = applyD4(cells, phi).join("");
    if (best === null || s < best) best = s;
  }
  return best; // 9-char string, e.g. "B.Q.K.R.N"
}

// Compact integer form (base-6; '.'<B<K<N<Q<R so numeric order == lex order).
const _DIGIT = { ".": 0, B: 1, K: 2, N: 3, Q: 4, R: 5 };
function boardHashNum(board) {
  const s = boardHash(board);
  let n = 0;
  for (let i = 0; i < 9; i++) n = n * 6 + _DIGIT[s[i]];
  return n;
}

// Canonical key for a (start -> target) puzzle, invariant under applying the
// same D4 element to BOTH boards. The dedup key for a generated collection.
function puzzleHash(start, target) {
  const sCells = boardCells(start);
  const tCells = boardCells(target);
  let best = null;
  for (const phi of D4) {
    const s = applyD4(sCells, phi).join("");
    const t = applyD4(tCells, phi).join("");
    const key = s + "|" + t;
    if (best === null || key < best) best = key;
  }
  return best;
}

// Numeric form of the puzzle hash (two base-6 board numbers packed into a
// 32-bit-safe range; max 6^9 ~ 10M, pair fits in Number).
function puzzleHashNum(start, target) {
  const [a, b] = puzzleHash(start, target).split("|");
  return boardHashNumFromStr(a) * 10077696 + boardHashNumFromStr(b); // 6^9 = 10077696
}
function boardHashNumFromStr(s) {
  let n = 0;
  for (let i = 0; i < 9; i++) n = n * 6 + _DIGIT[s[i]];
  return n;
}

// Dedupe helpers. `items` is an array of { start, target, ... }; returns the
// first occurrence of each canonical puzzle (preserving order).
function dedupePuzzles(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = puzzleHash(it.start, it.target);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

// Dedupe a list of boards (single boards) by D4 orbit.
function dedupeBoards(boards) {
  const seen = new Set();
  const out = [];
  for (const b of boards) {
    const k = boardHash(b);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

// ---- main / built-in test suite --------------------------------------------
// Mirrors scripts/test-engine.ts from the original.

async function main() {
  let pass = 0, fail = 0;
  const check = (name, cond) => {
    if (cond) pass++;
    else { fail++; console.log("  \u2717 FAIL:", name); }
  };

  // Basic movement
  const rookDests = legalDestinations(new Set([sq(0, 0)]), sq(0, 0), "R");
  check("rook from corner reaches 4 (row+col)", rookDests.length === 4);

  const knightCenter = legalDestinations(new Set([sq(1, 1)]), sq(1, 1), "N");
  check("knight on centre can't move", knightCenter.length === 0);

  const knightCorner = legalDestinations(new Set([sq(0, 0)]), sq(0, 0), "N");
  check("knight from corner reaches 2", knightCorner.length === 2);

  // minMoves
  const base = { K: sq(2, 2), Q: sq(1, 1), R: sq(0, 0), B: sq(0, 2), N: sq(2, 0) };
  check("minMoves to self = 0", minMoves(base, base) === 0);

  const oneMove = { ...base, K: sq(2, 1) };
  check("minMoves one king step = 1", minMoves(base, oneMove) === 1);

  // Transforms invertible; minSolution never worse than minMoves
  check("rotCW + rotCCW = identity",
    equalPlacement(applyOp(applyOp(base, "rotCW"), "rotCCW"), base));

  const t2 = { K: sq(0, 0), Q: sq(1, 1), R: sq(2, 2), B: sq(2, 0), N: sq(0, 2) };
  check("minSolution <= minMoves", minSolution(base, t2) <= minMoves(base, t2));

  check("occupiedOf has 5", occupiedOf(base).size === 5);

  // Generator: 3 puzzles in [2,6] and solvable. (BFS-heavy — keep the default
  // suite fast; use `node royal-study-engine.js --solver=all` for an exhaustive
  // sweep over the full 945-board component.)
  let okGen = true, sumMin = 0;
  for (let i = 0; i < 3; i++) {
    const pz = generatePuzzle(2, 6);
    if (pz.min < 2 || pz.min > 6 || !isFinite(pz.min)) okGen = false;
    if (equalPlacement(pz.start, pz.target)) okGen = false;
    sumMin += pz.min;
  }
  check("generator: 3 puzzles in [2,6], solvable", okGen);

  // randomTargetFor: always reachable & distinct from start (3 samples).
  let okTarget = true;
  for (let i = 0; i < 3; i++) {
    const start = randomPlacement();
    const { target, min } = randomTargetFor(start);
    if (!isFinite(min) || min < 1) okTarget = false;
    if (equalPlacement(start, target)) okTarget = false;
    if (minSolution(start, target) !== min) okTarget = false;
  }
  check("randomTargetFor: 3 reachable, distinct", okTarget);

  // solve(): path reaches target and its length == minSolution (3 cases).
  let okSolve = true;
  for (let i = 0; i < 3; i++) {
    const start = randomPlacement();
    const { target } = randomTargetFor(start);
    const { min, path } = solve(start, target);
    if (min !== minSolution(start, target)) okSolve = false;
    if (path.length !== min) okSolve = false;
    let cur = { ...start };
    for (const a of path) {
      if (a.kind === "move") cur = { ...cur, [a.piece]: a.to };
      else cur = applyOp(cur, a.op);
    }
    if (!equalPlacement(cur, target)) okSolve = false;
  }
  check("solve(): path valid, length == minSolution (3 cases)", okSolve);

  // ---- Dihedral-invariant hash tests ----
  // boardHash is invariant under every D4 element and stable (10 boards).
  let okBoard = true;
  for (let i = 0; i < 10; i++) {
    const b = randomPlacement();
    const h = boardHash(b);
    for (const op of ["rotCW", "rotCCW", "mirrorH", "mirrorV"]) {
      if (boardHash(applyOp(b, op)) !== h) okBoard = false;
    }
    if (boardHashNum(b) !== boardHashNum(b)) okBoard = false; // determinism
    if (boardHash(toGrid(b)) !== h) okBoard = false; // accepts grid strings too
  }
  check("boardHash invariant under D4 (10 boards)", okBoard);

  // puzzleHash invariant under applying the SAME g to both start and target
  // (3 samples — each calls randomTargetFor -> minSolution, which is expensive).
  let okPuzzle = true;
  for (let i = 0; i < 3; i++) {
    const start = randomPlacement();
    const { target } = randomTargetFor(start);
    const h = puzzleHash(start, target);
    for (const op of ["rotCW", "rotCCW", "mirrorH", "mirrorV"]) {
      if (puzzleHash(applyOp(start, op), applyOp(target, op)) !== h) okPuzzle = false;
    }
    // par must be D4-invariant too (sanity: the solver agrees with the hash).
    if (minSolution(start, target) !== minSolution(applyOp(start, "rotCW"), applyOp(target, "rotCW"))) {
      okPuzzle = false;
    }
  }
  check("puzzleHash invariant under simultaneous D4 (3 puzzles)", okPuzzle);

  // Different orbits => different hashes (spot check).
  check("distinct boards -> distinct hashes",
    boardHash("R . N / . K . / B Q .") !== boardHash("K . Q / R . N / B . ."));

  // ---- Constraint / reachability tests ----
  // The 10 deployed cards + the global start are all deck-valid (dark Bishop,
  // Knight off centre) and live in ONE reachable component.
  const START = parseGrid("R . N / . K . / B Q .");
  check("start is valid (dark Bishop, N off centre)", isValidPlacement(START));
  const DEPLOYED = [
    ". K . / R . Q / B . N", "R . N / . K . / B . Q",
    "K . R / . Q . / B N .", "B . K / Q . R / . N .",
    ". N B / K . Q / R . .", "R N . / . . K / B . Q",
    "K . Q / R . N / B . .", "B K R / . Q . / . N .",
    "B R N / . . . / K Q .", "N . Q / . . K / B R .",
  ];
  let okDeployed = true;
  for (const c of DEPLOYED) {
    const p = parseGrid(c);
    if (!isValidPlacement(p)) okDeployed = false;
    if (!isReachable(START, p)) okDeployed = false;
  }
  check("10 deployed cards valid + reachable from start", okDeployed);

  // Reachable set from the start has 7560 placements (the dark component).
  const comp = reachableSet(START);
  check("dark component reachable from start has 7560 states", comp.size === 7560);

  // Constrained generators only ever produce valid placements (3 rounds).
  let okGen2 = true;
  for (let i = 0; i < 3; i++) {
    if (!isValidPlacement(randomValidPlacement())) okGen2 = false;
    const start = randomValidPlacement();
    const { target } = randomValidTargetFor(start);
    if (!isValidPlacement(target)) okGen2 = false;
    if (equalPlacement(start, target)) okGen2 = false;
    if (!isReachable(start, target)) okGen2 = false;
    const pz = generateValidPuzzle(2, 6);
    if (!isValidPlacement(pz.start) || !isValidPlacement(pz.target)) okGen2 = false;
    if (!isReachable(pz.start, pz.target)) okGen2 = false;
    if (pz.min < 2 || pz.min > 6) okGen2 = false;
  }
  check("constrained generators produce valid, reachable puzzles (3 rounds)", okGen2);

  // isReachable agrees with minMoves finiteness on a sample (3 pairs).
  let okReach = true;
  for (let i = 0; i < 3; i++) {
    const a = randomValidPlacement();
    const b = randomValidPlacement();
    if (isReachable(a, b) !== Number.isFinite(minMoves(a, b))) okReach = false;
  }
  check("isReachable agrees with minMoves finiteness (3 pairs)", okReach);

  console.log(`\nTest suite: ${pass} passed, ${fail} failed.`);
  console.log(`Generator: mean par of 3 [2,6] puzzles ~ ${(sumMin / 3).toFixed(2)} moves`);

  // ---- Demo: print a few puzzles in card notation ----
  console.log("\n--- sample puzzles (start -> target, par) ---");
  for (let i = 0; i < 3; i++) {
    const pz = generatePuzzle(2, 6);
    console.log(`#${i + 1}  ${toGrid(pz.start)}  ->  ${toGrid(pz.target)}   par=${pz.min}`);
  }

  // ---- Demo: solve the very first card from BOARD_COMBINATIONS.md ----
  // start "R . N / . K . / B Q ." -> target card 1 ". K . / R . Q / B . N"
  const CARD1 = parseGrid(". K . / R . Q / B . N");
  const s = solve(START, CARD1);
  console.log(`\nstart  ${toGrid(START)}`);
  console.log(`card1  ${toGrid(CARD1)}`);
  console.log(`par=${s.min}; path: ${JSON.stringify(describePath(s.path))}`);

  // ---- Demo: dedupe a batch of generated puzzles by canonical puzzle hash ----
  const BATCH = 8;
  const batch = [];
  for (let i = 0; i < BATCH; i++) {
    const pz = generatePuzzle(2, 6);
    batch.push({ start: pz.start, target: pz.target, min: pz.min });
  }
  const deduped = dedupePuzzles(batch);
  console.log(`\nDedup demo: ${BATCH} generated puzzles -> ${deduped.length} unique canonical puzzles`);
  console.log(`  (boardHash of the global start board: ${boardHash(START)})`);

  // ---- Demo: canonical board hashes for the 10 deployed-site target cards ----
  console.log("\n--- boardHash for the 10 deployed target cards ---");
  const orbitOf = new Map();
  DEPLOYED.forEach((card, i) => {
    const h = boardHash(card);
    console.log(`#${String(i + 1).padStart(2, "0")}  ${card}  ->  ${h}`);
    orbitOf.set(h, (orbitOf.get(h) || 0) + 1);
  });
  console.log(`distinct D4 orbits among the 10 cards: ${orbitOf.size}`);

  // ---- Optional exhaustive solver sweep ---------------------------------------
  // `node royal-study-engine.js --solver`        → sweep all 945 dark boards
  // `node royal-study-engine.js --solver=all`    → same
  // `node royal-study-engine.js --solver=200`    → sweep first 200 boards
  // Verifies minMoves / minSolution / solve agree and the path lands on the
  // target for every board in the dark component, from the fixed start.
  const solverArg = argv.find((a) => a.startsWith("--solver"));
  if (solverArg !== undefined) {
    const N = solverArg === "--solver" || solverArg === "--solver=all"
      ? 945 : parseInt(solverArg.split("=")[1], 10);
    if (Number.isFinite(N) && N > 0) {
      console.log(`\n--- exhaustive solver sweep: ${N} dark boards (from the fixed start) ---`);
      const pool = await import("./pool.json", { with: { type: "json" } });
      const boards = pool.default.pool.slice(0, N);
      let ok = 0, bad = 0;
      for (let i = 0; i < boards.length; i++) {
        const target = parseGrid(boards[i].board);
        const m1 = minMoves(START, target);
        const m23 = minSolution(START, target);
        const { min, path } = solve(START, target);
        if (min !== m23 || m23 > m1) { bad++; console.log(`  ✗ #${i + 1} min mismatch`); continue; }
        let cur = { ...START };
        for (const a of path) {
          if (a.kind === "move") cur = { ...cur, [a.piece]: a.to };
          else cur = applyOp(cur, a.op);
        }
        if (!equalPlacement(cur, target)) { bad++; console.log(`  ✗ #${i + 1} path did not reach`); continue; }
        ok++;
      }
      console.log(`solver sweep: ${ok}/${boards.length} boards OK${bad ? `, ${bad} failed` : ""}`);
      if (bad) process.exit(1);
    }
  }

  if (fail > 0) process.exit(1);
}

if (fileURLToPath(import.meta.url) === argv[1]) main();

export {
  PIECE_ORDER, N, rc, sq, inBoard,
  legalDestinations, reachable,
  occupiedOf, serialize, equalPlacement,
  OP_MAP, OP_LABEL, applyOp, transformPlacement, DIHEDRAL,
  minMoves, minSolution, solve, ALL_OPS,
  randomPlacement, randomTargetFor, generatePuzzle,
  isDark, BISHOP_COLOR, isValidPlacement, isReachable, reachableSet,
  randomValidPlacement, randomValidTargetFor, generateValidPuzzle,
  parseGrid, toGrid, toList, describePath,
  D4, boardCells, applyD4,
  boardHash, boardHashNum, puzzleHash, puzzleHashNum,
  dedupePuzzles, dedupeBoards,
};