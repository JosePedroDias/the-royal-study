// generate-cards.js
//
// Generates a 60-card deck for "The Royal Study" in the dark-bishop component
// (the component the deployed deck uses). Each card is a single target board
// (5 pieces on a 3x3); the start is the fixed "R . N / . K . / B Q ." for
// card 1 and carry-over thereafter. All cards are dihedrally distinct (no two
// are rotations/mirrors of each other) by boardHash dedup.
//
// The 10 cards from the deployed site (repo 1) are seeded in first — those are
// the only cards we can confirm are real (they ship with the official web app).
// The remaining 50 are generated; they are plausible but unverified against
// the physical 60-card deck.
//
// Output: cards.json (machine) + CARDS.md (human table).
//
//   node generate-cards.js

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";
import * as E from "./royal-study-engine.js";
const { parseGrid, toGrid, boardHash, boardHashNum,
        isValidPlacement, minMoves, minSolution, equalPlacement,
        PIECE_ORDER, rc } = E;

// ---- Config -----------------------------------------------------------------
const TARGET_COUNT = 60;
const START = parseGrid("R . N / . K . / B Q .");

// The 10 deployed cards (known-real subset; repo 1 / the-royal-study-chess.vercel.app).
const SEEDS = [
  ". K . / R . Q / B . N", "R . N / . K . / B . Q",
  "K . R / . Q . / B N .", "B . K / Q . R / . N .",
  ". N B / K . Q / R . .", "R N . / . . K / B . Q",
  "K . Q / R . N / B . .", "B K R / . Q . / . N .",
  "B R N / . . . / K Q .", "N . Q / . . K / B R .",
];

// Par window for Level 1 (minMoves from START, no transforms). We accept cards
// whose Level-1 par is in [2, 9] so the deck has a usable difficulty spread.
// The Level 2/3 par (minSolution, with transforms) is always <= Level 1.
const PAR_MIN = 2;
const PAR_MAX = 9;

// Deterministic PRNG so the deck is reproducible across runs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random valid placement (dark Bishop, Knight off centre) using a seeded RNG.
function seededValidPlacement(rand) {
  for (let i = 0; i < 1000; i++) {
    const sqs = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let k = sqs.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [sqs[k], sqs[j]] = [sqs[j], sqs[k]];
    }
    const p = {};
    PIECE_ORDER.forEach((t, k) => (p[t] = sqs[k]));
    if (isValidPlacement(p)) return p;
  }
  throw new Error("could not sample a valid placement");
}

// ---- Generate ---------------------------------------------------------------
function generate() {
  const seen = new Map(); // boardHash -> index (dedup)
  const cards = [];

  // Seed with the 10 deployed cards.
  let seedIdx = 0;
  for (const grid of SEEDS) {
    const p = parseGrid(grid);
    if (!isValidPlacement(p)) throw new Error("seed card not deck-valid: " + grid);
    const h = boardHash(p);
    if (seen.has(h)) { console.warn("seed orbit dup, skipping:", grid); continue; }
    seen.set(h, cards.length);
    cards.push({ ...p, _seed: true, _seedNo: ++seedIdx });
  }

  // Fill the rest with a seeded RNG.
  const rand = mulberry32(0x514d41); // "QMA1" — arbitrary stable seed
  let tries = 0;
  while (cards.length < TARGET_COUNT && tries < 500000) {
    tries++;
    const p = seededValidPlacement(rand);
    const h = boardHash(p);
    if (seen.has(h)) continue;
    // Par from the standard start (Level 1 = minMoves, no transforms).
    const par1 = minMoves(START, p);
    if (!Number.isFinite(par1) || par1 < PAR_MIN || par1 > PAR_MAX) continue;
    seen.set(h, cards.length);
    cards.push({ ...p, _seed: false });
  }

  if (cards.length < TARGET_COUNT) {
    throw new Error(`only generated ${cards.length} cards after ${tries} tries`);
  }
  return { cards, tries };
}

// ---- Compute pars + format --------------------------------------------------
function build() {
  const { cards, tries } = generate();
  const out = cards.map((p, i) => {
    const board = { K: p.K, Q: p.Q, R: p.R, B: p.B, N: p.N };
    const par1 = minMoves(START, board);          // Level 1 (no transforms)
    const par23 = minSolution(START, board);      // Level 2/3 (rotate + mirror)
    return {
      id: i + 1,
      board: toGrid(board),
      hash: boardHash(board),
      hashNum: boardHashNum(board),
      parLevel1: par1,
      parLevel23: par23,
      isSeed: !!p._seed,
      seedNo: p._seedNo || null,
    };
  });
  return { cards: out, tries };
}

// ---- main ------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  const { cards, tries } = build();
  const dt = Date.now() - t0;

  // Sanity: all distinct dihedral orbits, all valid, all reachable (component proof).
  const hashes = new Set(cards.map((c) => c.hash));
  if (hashes.size !== cards.length) throw new Error("hash collision in deck");
  for (const c of cards) {
    const p = parseGrid(c.board);
    if (!isValidPlacement(p)) throw new Error("invalid card: " + c.board);
  }

  // Sort by Level-1 par for a difficulty curve (stable on id within same par).
  cards.sort((a, b) => a.parLevel1 - b.parLevel1 || a.id - b.id);

  // Re-index after sort.
  cards.forEach((c, i) => (c.id = i + 1));

  // Distribution.
  const seeds = cards.filter((c) => c.isSeed).length;
  const byPar = {};
  for (const c of cards) byPar[c.parLevel1] = (byPar[c.parLevel1] || 0) + 1;

  console.log(`Generated ${cards.length} cards in ${dt} ms (${tries} samples tried).`);
  console.log(`Seeded with ${seeds} known-real deployed cards.`);
  console.log(`Level-1 par distribution:`, JSON.stringify(byPar));
  console.log(`par range: ${cards[0].parLevel1} .. ${cards[cards.length - 1].parLevel1}`);

  // Write cards.json
  const deck = {
    generatedAt: new Date().toISOString(),
    count: cards.length,
    startBoard: "R . N / . K . / B Q .",
    component: "dark-bishop (7560 states)",
    dedupKey: "boardHash (dihedral orbit, D4-invariant)",
    parFrom: "fixed start R . N / . K . / B Q .",
    parLevel1: "minMoves (no card transforms) — Level 1",
    parLevel23: "minSolution (rotate + mirror allowed) — Levels 2/3",
    seedsNote: "the 10 isSeed:true cards are the deployed-site cards (known-real subset); the rest are plausible but unverified against the physical 60-card deck.",
    cards,
  };
  await writeFile(join(__dirname, "cards.json"), JSON.stringify(deck, null, 2) + "\n");
  console.log("\nWrote cards.json");

  // Write CARDS.md table
  const lines = [];
  lines.push("# The Royal Study — generated 60-card deck");
  lines.push("");
  lines.push("- **Component**: dark-bishop (7,560 states) — the component the deployed deck uses.");
  lines.push("- **Dedup key**: `boardHash` (dihedral orbit, D4-invariant) — no two cards are rotations/mirrors of each other.");
  lines.push("- **Start** (card 1 / reference par): `R . N / . K . / B Q .`. Carry-over thereafter.");
  lines.push("- **parLevel1** = `minMoves` (no card transforms). **parLevel23** = `minSolution` (rotate + mirror allowed, Levels 2/3).");
  lines.push("- **Seed**: the 10 `seed` cards are the deployed-site cards (known-real subset). The other 50 are plausible but **unverified** against the physical 60-card deck.");
  lines.push("");
  lines.push("| # | board | par L1 | par L2/3 | seed | hash |");
  lines.push("|---|-------|-------:|---------:|:----:|------|");
  for (const c of cards) {
    lines.push(`| ${c.id} | \`${c.board}\` | ${c.parLevel1} | ${c.parLevel23} | ${c.isSeed ? "yes" : ""} | ${c.hash} |`);
  }
  lines.push("");
  lines.push("## Distribution (Level-1 par)");
  lines.push("");
  lines.push("| par | count |");
  lines.push("|----:|------:|");
  for (const par of Object.keys(byPar).sort((a, b) => +a - +b)) {
    lines.push(`| ${par} | ${byPar[par]} |`);
  }
  lines.push("");
  await writeFile(join(__dirname, "CARDS.md"), lines.join("\n"));
  console.log("Wrote CARDS.md");
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
if (fileURLToPath(import.meta.url) === argv[1]) main();