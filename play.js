// play.js — terminal UI for The Royal Study
//
// Picks a random start + goal pair from pool.json (both dark-component, so
// reachable), lets you choose a difficulty level (1/2/3), shows both boards,
// and lists every legal move. You win when the current board matches the
// (possibly transformed) goal. The three pars (one per level) are computed
// up front but NOT shown until you complete the puzzle.
//
//   node play.js [level]
//     level: 1 = no transforms; 2 = rotations only; 3 = rotations + mirrors
//            (default: 3)
//
// Controls: type the number of a move and Enter. u = undo, q = quit.
//   - piece moves re-list every turn (every legal destination for every piece)
//   - level 2/3: rotate the goal card (rotCW/rotCCW, each +1 op)
//   - level 3:   also mirror the goal card (mirrorH/mirrorV, each +1 op)
//   - the pars (Level 1/2/3) are revealed only after you solve or quit

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { argv, exit } from "node:process";
import pool from "./pool.json" with { type: "json" };
import * as E from "./royal-study-engine.js";
const {
  parseGrid, legalDestinations, occupiedOf, applyOp, equalPlacement,
  minMovesLevel, minMoves, minSolution, PIECE_ORDER,
} = E;

const PIECE_NAME = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight" };

// Goal-card ops available at each level. Level 1 = none; Level 2 = rotations;
// Level 3 = rotations + mirrors.
const GOAL_OPS = {
  1: [],
  2: [
    { id: "rotCW",  label: "rotate goal 90° CW"  },
    { id: "rotCCW", label: "rotate goal 90° CCW" },
  ],
  3: [
    { id: "rotCW",   label: "rotate goal 90° CW"  },
    { id: "rotCCW",  label: "rotate goal 90° CCW" },
    { id: "mirrorH", label: "mirror goal H (⇄)"  },
    { id: "mirrorV", label: "mirror goal V (⇅)"  },
  ],
};

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

function levelName(level) {
  return level === 1 ? "Level 1 (no transforms)"
    : level === 2 ? "Level 2 (rotations)"
    : "Level 3 (rotations + mirrors)";
}

// ---- main ------------------------------------------------------------------

async function main() {
  // Level from argv or default to 3.
  let level = 3;
  if (argv[2]) {
    const n = parseInt(argv[2], 10);
    if (n === 1 || n === 2 || n === 3) level = n;
  }

  const { startGrid, goalGrid } = pickPair();
  const startBoard = parseGrid(startGrid);
  const goalOriginal = parseGrid(goalGrid);
  let current = { ...startBoard };
  let goalDisplay = { ...goalOriginal };

  // Compute all 3 pars up front, but DON'T show them until completion.
  const par1 = minMovesLevel(startBoard, goalOriginal, 1);
  const par2 = minMovesLevel(startBoard, goalOriginal, 2);
  const par3 = minMovesLevel(startBoard, goalOriginal, 3);

  let moves = 0;
  let ops = 0;
  const history = [];
  let solved = false;

  const rl = createInterface({ input, output, prompt: "" });
  const clear = () => output.write("\x1B[2J\x1B[H");

  while (true) {
    clear();
    output.write("👑 The Royal Study — terminal\n");
    output.write(`\n${levelName(level)}\n\n`);
    output.write(renderBoard(goalDisplay, "── GOAL (target card) ──") + "\n\n");
    output.write(renderBoard(current, "── CURRENT ──") + "\n");

    output.write(`\nmoves ${moves} · ops ${ops} · total ${moves + ops}\n`);

    if (equalPlacement(current, goalDisplay)) {
      solved = true;
      output.write(
        `\n🎉 Solved!\n` +
        `  your total: ${moves + ops} (moves ${moves} + ops ${ops})\n` +
        `\n  pars (revealed):\n` +
        `    Level 1 (no transforms):      ${par1}\n` +
        `    Level 2 (rotations):          ${par2}\n` +
        `    Level 3 (rotations + mirrors): ${par3}\n` +
        `\n  you played Level ${level}; par for this level was ${level === 1 ? par1 : level === 2 ? par2 : par3}.\n`,
      );
      rl.close();
      return;
    }

    // Build the option list: all legal piece moves + level's goal ops + undo/quit.
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
    for (const op of GOAL_OPS[level]) options.push({ kind: "op", op: op.id, label: `${op.label} (+1 op)` });
    if (history.length) options.push({ kind: "undo", label: "undo" });
    options.push({ kind: "quit", label: "quit" });

    output.write("\nmoves:\n");
    for (let i = 0; i < options.length; i++) {
      output.write(`  ${String(i + 1).padStart(2)}. ${options[i].label}\n`);
    }
    output.write("\n");

    let ans;
    try { ans = await rl.question(`pick (1-${options.length}): `); }
    catch { break; }
    ans = (ans || "").trim().toLowerCase();
    if (!ans) continue;
    if (ans === "q" || ans === "quit") {
      output.write(
        `\n  pars (revealed):\n` +
        `    Level 1 (no transforms):      ${par1}\n` +
        `    Level 2 (rotations):          ${par2}\n` +
        `    Level 3 (rotations + mirrors): ${par3}\n\n`,
      );
      rl.close();
      return;
    }
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
    if (choice.kind === "quit") {
      output.write(
        `\n  pars (revealed):\n` +
        `    Level 1 (no transforms):      ${par1}\n` +
        `    Level 2 (rotations):          ${par2}\n` +
        `    Level 3 (rotations + mirrors): ${par3}\n\n`,
      );
      rl.close();
      return;
    }
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