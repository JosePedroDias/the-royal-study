// generate-pool.js
//
// Writes the full pool of 945 candidate cards (one canonical board per D4
// orbit in the dark-bishop component) to pool.json, with each candidate's
// reference par from the fixed start, and a human-readable POOL.md table.
//
// This is the complete universe a dark-component deck can draw from. Use it
// to verify the physical deck: boardHash each real card and look it up by
// `hash` — it must be present; matching against cards.json tells you how
// many of the 60 were real.
//
//   node generate-pool.js

"use strict";

const E = require("./royal-study-engine.js");
const { boardHash, isDark, toGrid,
        parseGrid, isValidPlacement, PIECE_ORDER } = E;
const canonical = require("./canonical-boards.json");
const fs = require("fs");
const path = require("path");

function main() {
  const t0 = Date.now();
  const orbits = canonical.orbits;
  if (orbits.length !== 945) throw new Error(`expected 945 orbits, got ${orbits.length}`);

  // The pool is a catalog of canonical boards, NOT a difficulty rating.
  // Pars are omitted on purpose: in the real deck the start of each card is
  // the previous card's landing position (carry-over), so a par computed from
  // the fixed start would only be meaningful for card 1. The pool's job is
  // board identity (which canonical board), not difficulty.
  const pool = [];
  const deckHashes = new Set(require("./cards.json").cards.map((c) => c.hash));

  for (let i = 0; i < orbits.length; i++) {
    const o = orbits[i];
    const board = parseGrid(o.board);
    if (!isValidPlacement(board)) throw new Error(`pool board not deck-valid: ${o.board}`);
    pool.push({
      id: i + 1,
      board: o.board,
      hash: o.hash,
      hashNum: o.hashNum,
      orbitSize: o.orbitSize,
      inDeck: deckHashes.has(o.hash),
    });
  }

  // Sort by hash for a stable, reproducible pool order; re-index by poolId.
  pool.sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
  pool.forEach((p, i) => (p.poolId = i + 1));

  // Sanity.
  const inDeckCount = pool.filter((p) => p.inDeck).length;
  const distinctHashes = new Set(pool.map((p) => p.hash)).size;

  console.log(`Built pool of ${pool.length} candidates in ${Date.now() - t0} ms.`);
  console.log(`All deck-valid: ${pool.every((p) => isValidPlacement(parseGrid(p.board)))}`);
  console.log(`Distinct hashes: ${distinctHashes}/${pool.length}`);
  console.log(`In our 60-card deck: ${inDeckCount}/60`);

  // Write pool.json
  const out = {
    generatedAt: new Date().toISOString(),
    component: "dark-bishop (7,560 states, 945 D4 orbits)",
    count: pool.length,
    dedupKey: "boardHash (D4-invariant; one entry per orbit, the lex-min grid)",
    note: "Catalog of all 945 canonical boards a dark-component deck can draw from. Each entry is one D4 orbit (one canonical board standing for all 8 rotations/mirrors). inDeck:true means the board is one of our 60 generated cards (cards.json). Pars are intentionally omitted: in the real deck each card's start is the previous card's landing position (carry-over), so a fixed-start par would only be meaningful for card 1. Use `hash` to verify a physical card against this catalog.",
    inDeckCount,
    pool,
  };
  fs.writeFileSync(path.join(__dirname, "pool.json"), JSON.stringify(out, null, 2) + "\n");
  console.log("\nWrote pool.json");

  // Write POOL.md (dense table — no pars, just identity).
  const lines = [
    "# The Royal Study — candidate pool (945 canonical dark boards)",
    "",
    "- **Component**: dark-bishop (7,560 states, **945 D4 orbits**).",
    "- **Dedup key**: `boardHash` — one entry per orbit (the lex-min of its 8 rotations/mirrors).",
    "- **inDeck**: `✓` if the board is one of our 60 generated cards (`cards.json`).",
    "- **No pars**: in the real deck each card's start is the previous card's landing position (carry-over), so a fixed-start par is only meaningful for card 1. This is a board catalog, not a difficulty table.",
    "",
    `| pool | board | inDeck | hash |`,
    `|-----:|-------|:------:|------|`,
  ];
  for (const p of pool) {
    lines.push(`| ${p.poolId} | \`${p.board}\` | ${p.inDeck ? "✓" : ""} | ${p.hash} |`);
  }
  lines.push("");
  fs.writeFileSync(path.join(__dirname, "POOL.md"), lines.join("\n"));
  console.log("Wrote POOL.md");
}

if (require.main === module) main();