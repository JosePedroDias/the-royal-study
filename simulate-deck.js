// simulate-deck.js
//
// Simulates the carry-over chain: start at the fixed board, solve card 1
// (pieces move to card 1's target), that becomes the start for card 2, etc.
// Reports the actual par at each step (Level 1 = minMoves no transforms,
// Level 2/3 = minSolution with rotate + mirror) and flags any outlier.
//
//   node simulate-deck.js

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";
import * as E from "./royal-study-engine.js";
import deck from "./cards.json" with { type: "json" };
const { parseGrid, toGrid, minMoves, minSolution, solve, describePath,
        equalPlacement, isValidPlacement, isReachable } = E;

const START = parseGrid("R . N / . K . / B Q .");

// Thresholds for flagging (the deployed deck's Level-1 pars from the fixed
// start range 1..9; we flag anything above 9 as a potential difficulty spike,
// and any Level 2/3 par above 9 as well — those would be hard even with
// transforms). Not a hard rule, just a sanity flag.
const FLAG_AT = 9;

async function main() {
  const cards = deck.cards;
  if (cards.length !== 60) throw new Error(`expected 60 cards, got ${cards.length}`);

  let current = START;
  let totalL1 = 0;
  let totalL23 = 0;
  const rows = [];
  const flags = [];

  for (let i = 0; i < cards.length; i++) {
    const target = parseGrid(cards[i].board);
    if (!isValidPlacement(target)) throw new Error(`card ${i + 1} invalid: ${cards[i].board}`);

    const parL1 = minMoves(current, target);
    const parL23 = minSolution(current, target);

    // Sanity: L23 <= L1 always (transforms can only help or tie).
    if (parL23 > parL1) throw new Error(`card ${i + 1}: L23 ${parL23} > L1 ${parL1}`);

    totalL1 += parL1;
    totalL23 += parL23;

    const row = {
      id: cards[i].id,
      from: toGrid(current),
      to: cards[i].board,
      parL1,
      parL23,
      isSeed: cards[i].isSeed,
      // how much the transform helps (0 = no help; >0 = transform beats upright)
      transformHelp: parL1 - parL23,
    };
    rows.push(row);

    if (parL1 > FLAG_AT) flags.push({ id: row.id, level: "L1", par: parL1 });
    if (parL23 > FLAG_AT) flags.push({ id: row.id, level: "L23", par: parL23 });
    if (!Number.isFinite(parL1)) flags.push({ id: row.id, level: "UNREACHABLE", par: parL1 });

    // Carry-over: pieces are now at the target.
    current = target;
  }

  // Distribution.
  const distL1 = {};
  const distL23 = {};
  for (const r of rows) {
    distL1[r.parL1] = (distL1[r.parL1] || 0) + 1;
    distL23[r.parL23] = (distL23[r.parL23] || 0) + 1;
  }

  console.log(`Simulated ${cards.length}-card carry-over chain.`);
  console.log(`Start: ${toGrid(START)}`);
  console.log(`\nTotal moves (Level 1, no transforms): ${totalL1}`);
  console.log(`Total moves (Level 2/3, transforms):  ${totalL23}`);
  console.log(`Transform savings:                   ${totalL1 - totalL23}`);
  console.log(`\nLevel-1 par distribution (carry-over):`);
  for (const p of Object.keys(distL1).sort((a, b) => +a - +b))
    console.log(`  par ${p}: ${distL1[p]} cards`);
  console.log(`Level-2/3 par distribution (carry-over):`);
  for (const p of Object.keys(distL23).sort((a, b) => +a - +b))
    console.log(`  par ${p}: ${distL23[p]} cards`);

  if (flags.length) {
    console.log(`\n⚠  ${flags.length} flag(s) at threshold ${FLAG_AT}:`);
    for (const f of flags) console.log(`  card #${f.id}: ${f.level} par=${f.par}`);
  } else {
    console.log(`\n✓ no flags (all pars <= ${FLAG_AT})`);
  }

  // Per-card table.
  console.log("\n--- per-card carry-over pars ---");
  console.log("id  parL1  parL23  help   seed  from -> to");
  for (const r of rows) {
    console.log(
      `${String(r.id).padStart(2)}  ${String(r.parL1).padStart(5)}  ${String(r.parL23).padStart(6)}  ${String(r.transformHelp).padStart(4)}   ${r.isSeed ? "seed" : "    "}  ${r.from} -> ${r.to}`
    );
  }

  // Write a machine-readable report.
  const report = {
    generatedAt: new Date().toISOString(),
    count: cards.length,
    startBoard: toGrid(START),
    totals: { level1: totalL1, level23: totalL23, transformSavings: totalL1 - totalL23 },
    flagThreshold: FLAG_AT,
    flags,
    distribution: { level1: distL1, level23: distL23 },
    steps: rows,
  };
  await writeFile(join(__dirname, "deck-simulation.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("\nWrote deck-simulation.json");
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
if (fileURLToPath(import.meta.url) === argv[1]) main();