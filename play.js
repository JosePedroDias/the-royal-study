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
  const rl = createInterface({ input, output, prompt: "" });
  const clear = () => output.write("\x1B[2J\x1B[H");

  // Pick level interactively (argv[2] can preselect, else prompt).
  let level;
  if (argv[2] && [1, 2, 3].includes(parseInt(argv[2], 10))) {
    level = parseInt(argv[2], 10);
  } else {
    clear();
    output.write("👑 The Royal Study — terminal\n\n");
    output.write("Choose difficulty:\n");
    output.write("  1. Level 1 (no transforms)\n");
    output.write("  2. Level 2 (rotations)\n");
    output.write("  3. Level 3 (rotations + mirrors)\n\n");
    while (true) {
      let ans;
      try { ans = await rl.question("level (1-3): "); }
      catch { rl.close(); return; }
      ans = (ans || "").trim();
      const n = parseInt(ans, 10);
      if (n === 1 || n === 2 || n === 3) { level = n; break; }
      output.write("(pick 1, 2, or 3)\n");
    }
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
  const par = level === 1 ? par1 : level === 2 ? par2 : par3;

  // ---- Prediction phase: show the boards, ask for the player's estimate ----
  // The player studies the position and bids how many total moves (piece
  // moves + op costs) they think they need. This is the core challenge —
  // they don't see the par until after they've played.
  clear();
  output.write("👑 The Royal Study — terminal\n");
  output.write(`\n${levelName(level)}\n\n`);
  output.write(renderBoard(goalDisplay, "── GOAL (target card) ──") + "\n\n");
  output.write(renderBoard(current, "── START ──") + "\n\n");
  output.write("Study the position. How many total moves (piece moves + card\n");
  output.write("ops) do you think you need to reach the goal?\n\n");

  let bid = null;
  while (bid === null) {
    let ans;
    try { ans = await rl.question("your estimate: "); }
    catch { rl.close(); return; }
    ans = (ans || "").trim();
    const n = parseInt(ans, 10);
    if (Number.isFinite(n) && n >= 1) bid = n;
    else output.write("(enter a positive number)\n");
  }

  // ---- Play phase ----
  let moves = 0;
  let ops = 0;
  const history = [];

  while (true) {
    clear();
    output.write("👑 The Royal Study — terminal\n");
    output.write(`\n${levelName(level)}\n\n`);
    output.write(renderBoard(goalDisplay, "── GOAL (target card) ──") + "\n\n");
    output.write(renderBoard(current, "── CURRENT ──") + "\n");

    const total = moves + ops;
    const remaining = bid - total;
    output.write(
      `\nestimate ${bid} · used ${total} · ` +
      (remaining >= 0 ? `remaining ${remaining}` : `OVER by ${-remaining}`) +
      `\n`,
    );

    if (equalPlacement(current, goalDisplay)) {
      const within = total <= bid;
      output.write(
        `\n🎉 Solved!\n` +
        `  your total: ${total} (moves ${moves} + ops ${ops})\n` +
        `  your estimate: ${bid}  →  ${within ? "✓ within bid" : "✗ over bid"}\n` +
        `\n  pars (revealed):\n` +
        `    Level 1 (no transforms):      ${par1}\n` +
        `    Level 2 (rotations):          ${par2}\n` +
        `    Level 3 (rotations + mirrors): ${par3}\n` +
        `\n  you played Level ${level}; par for this level was ${par}.\n`,
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
      revealPars(output, par1, par2, par3, par, level);
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
      revealPars(output, par1, par2, par3, par, level);
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

function revealPars(output, par1, par2, par3, par, level) {
  output.write(
    `\n  pars (revealed):\n` +
    `    Level 1 (no transforms):      ${par1}\n` +
    `    Level 2 (rotations):          ${par2}\n` +
    `    Level 3 (rotations + mirrors): ${par3}\n` +
    `\n  you played Level ${level}; par for this level was ${par}.\n\n`,
  );
}

main().catch((e) => { console.error(e); exit(1); });