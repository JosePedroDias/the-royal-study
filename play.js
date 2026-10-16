// play.js — terminal UI for The Royal Study
//
// Picks a random start + goal pair from pool.json (both dark-component, so
// reachable), shows both boards, and lists every legal move (piece moves +
// rotate/mirror of the goal card). You win when the current board matches
// the (possibly transformed) goal.
//
//   node play.js
//
// Controls: type the number of a move and Enter. u = undo, q = quit.
//   - piece moves re-list every turn (every legal destination for every piece)
//   - rotate/mirror the goal card (each costs 1 op)
//   - par shown is minSolution(start, goal): the optimal total (moves + ops)

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { argv, exit } from "node:process";
import pool from "./pool.json" with { type: "json" };
import * as E from "./royal-study-engine.js";
const {
  parseGrid, toGrid, legalDestinations, occupiedOf, applyOp, equalPlacement,
  minSolution, PIECE_ORDER,
} = E;

const PIECE_NAME = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight" };
const PIECE_GLYPH = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };

const GOAL_OPS = [
  { id: "rotCW",   label: "rotate goal 90° CW"  },
  { id: "rotCCW",  label: "rotate goal 90° CCW" },
  { id: "mirrorH", label: "mirror goal H (⇄)"  },
  { id: "mirrorV", label: "mirror goal V (⇅)"  },
];

// ---- board rendering -------------------------------------------------------

function renderBoard(p, title) {
  const cells = Array(9).fill(" ");
  for (const t of PIECE_ORDER) if (p[t] != null) cells[p[t]] = t;
  const cell = (i) => (cells[i] === " " ? " · " : ` ${cells[i]} `);
  const sep = "  ├───┼───┼───┤";
  return [
    title,
    "  ┌───┬───┬───┐",
    `0 │${cell(0)}│${cell(1)}│${cell(2)}│`,
    sep,
    `1 │${cell(3)}│${cell(4)}│${cell(5)}│`,
    sep,
    `2 │${cell(6)}│${cell(7)}│${cell(8)}│`,
    "  └───┴───┴───┘",
    "    0   1   2",
  ].join("\n");
}

// ---- game setup ------------------------------------------------------------

function pickPair() {
  const arr = pool.pool;
  const a = arr[Math.floor(Math.random() * arr.length)];
  let b;
  do { b = arr[Math.floor(Math.random() * arr.length)]; } while (b.hash === a.hash);
  return { startGrid: a.board, goalGrid: b.board };
}

async function main() {
  const { startGrid, goalGrid } = pickPair();
  const startBoard = parseGrid(startGrid);
  const goalOriginal = parseGrid(goalGrid);
  let current = { ...startBoard };
  let goalDisplay = { ...goalOriginal };
  const par = minSolution(startBoard, goalOriginal);

  let moves = 0;
  let ops = 0;
  const history = []; // { current, goalDisplay, moves, ops }

  const rl = createInterface({ input, output, prompt: "" });

  const clear = () => output.write("\x1B[2J\x1B[H");

  while (true) {
    clear();
    output.write("👑 The Royal Study — terminal\n\n");
    output.write(renderBoard(goalDisplay, "── GOAL (target card) ──") + "\n\n");
    output.write(renderBoard(current, "── CURRENT ──") + "\n\n");

    output.write(
      `moves ${moves} · ops ${ops} · total ${moves + ops} · par ${par}` +
      (equalPlacement(current, goalDisplay)
        ? `\n\n🎉 Solved in ${moves + ops} (moves ${moves} + ops ${ops}). Par was ${par}.\n`
        : "") +
      "\n",
    );

    if (equalPlacement(current, goalDisplay)) {
      rl.close();
      return;
    }

    // Build the option list: all legal piece moves + goal ops + undo + quit.
    const occ = occupiedOf(current);
    const options = [];
    for (const t of PIECE_ORDER) {
      const dests = legalDestinations(occ, current[t], t);
      for (const d of dests) {
        options.push({
          kind: "move",
          piece: t,
          from: current[t],
          to: d,
          label: `${PIECE_NAME[t]} @${current[t]} → ${d}`,
        });
      }
    }
    for (const op of GOAL_OPS) options.push({ kind: "op", op: op.id, label: `${op.label} (+1 op)` });
    options.push({ kind: "undo", label: "undo" });
    options.push({ kind: "quit", label: "quit" });

    output.write("moves:\n");
    for (let i = 0; i < options.length; i++) {
      output.write(`  ${String(i + 1).padStart(2)}. ${options[i].label}\n`);
    }
    output.write("\n");

    let ans;
    try { ans = await rl.question(`pick (1-${options.length}): `); }
    catch { break; }
    ans = (ans || "").trim();
    if (!ans) continue;
    if (ans === "q" || ans === "quit") { rl.close(); return; }
    if (ans === "u" || ans === "undo") {
      if (!history.length) { output.write("(nothing to undo)\n"); continue; }
      const prev = history.pop();
      current = prev.current;
      goalDisplay = prev.goalDisplay;
      moves = prev.moves;
      ops = prev.ops;
      continue;
    }
    const idx = parseInt(ans, 10) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= options.length) {
      output.write("(invalid pick)\n");
      continue;
    }
    const choice = options[idx];
    if (choice.kind === "quit") { rl.close(); return; }
    if (choice.kind === "undo") {
      if (!history.length) { output.write("(nothing to undo)\n"); continue; }
      const prev = history.pop();
      current = prev.current;
      goalDisplay = prev.goalDisplay;
      moves = prev.moves;
      ops = prev.ops;
      continue;
    }
    history.push({ current: { ...current }, goalDisplay: { ...goalDisplay }, moves, ops });
    if (choice.kind === "move") {
      current = { ...current, [choice.piece]: choice.to };
      moves++;
    } else if (choice.kind === "op") {
      goalDisplay = applyOp(goalDisplay, choice.op);
      ops++;
    }
  }
  rl.close();
}

main().catch((e) => { console.error(e); exit(1); });