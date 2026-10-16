// generate-pool.js
//
// Enumerates every canonical board (D4 orbit) in the dark-bishop component
// the deployed deck uses, dedups by boardHash (one entry per orbit, the
// lex-min grid), cross-references against cards.json, and writes pool.json
// (machine) + POOL.md (human table). This is the complete universe of 945
// canonical boards a dark-component deck can draw from.
//
// Use it to verify the physical deck: boardHash each real card and look it
// up by `hash` — it must be present; matching against cards.json tells you
// how many of the 60 were real.
//
//   node generate-pool.js
//
// Counts (verified, also printed at runtime):
//   dark-bishop raw placements:  7,560   dark D4 orbits:   945
//   light-bishop raw placements: 5,880   light D4 orbits:   735
//   total raw:                 13,440   total D4 orbits: 1,680

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";
import * as E from "./royal-study-engine.js";
import cardsDeck from "./cards.json" with { type: "json" };
const { boardHash, boardHashNum, isDark,
        parseGrid, isValidPlacement, PIECE_ORDER } = E;

const SQS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const CENTER = 4;

// Enumerate all valid placements in `component` ("dark" | "light").
// Valid iff: Knight off centre, AND Bishop on the component's color.
function* placements(component) {
  for (const b of SQS) {
    if (component === "dark"  && !isDark(b)) continue;
    if (component === "light" &&  isDark(b)) continue;
    for (const n of SQS) {
      if (n === b || n === CENTER) continue;            // Knight off centre
      for (const k of SQS) {
        if (k === b || k === n) continue;
        for (const q of SQS) {
          if (q === b || q === n || q === k) continue;
          for (const r of SQS) {
            if (r === b || r === n || r === k || r === q) continue;
            yield { K: k, Q: q, R: r, B: b, N: n };
          }
        }
      }
    }
  }
}

// Group placements by D4 orbit (boardHash). Returns the deduped orbit list
// (each entry: the lex-min grid + hash + raw count) and the raw count.
function enumerateOrbits(component) {
  const map = new Map();
  let raw = 0;
  for (const p of placements(component)) {
    raw++;
    const h = boardHash(p);
    let o = map.get(h);
    if (!o) {
      o = { hash: h, hashNum: boardHashNum(p), board: E.toGrid(p), count: 0 };
      map.set(h, o);
    }
    o.count++;
  }
  const list = [...map.values()].sort((a, b) =>
    a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
  return { component, raw, orbitCount: list.length, orbits: list };
}

async function main() {
  const t0 = Date.now();

  // Enumerate both components (for the count table); the pool uses dark only.
  const dark  = enumerateOrbits("dark");
  const light = enumerateOrbits("light");

  // Sanity: D4 action is free → every orbit has exactly 8 elements.
  const badDark  = dark.orbits.filter(o => o.count !== 8);
  const badLight = light.orbits.filter(o => o.count !== 8);
  if (badDark.length || badLight.length) {
    throw new Error("D4 action not free: " + badDark.length + " dark, " +
                    badLight.length + " light orbits with size != 8");
  }
  if (dark.orbitCount !== 945 || light.orbitCount !== 735) {
    throw new Error(`orbit count mismatch: dark ${dark.orbitCount} (expect 945), light ${light.orbitCount} (expect 735)`);
  }

  console.log(`Enumerated in ${Date.now() - t0} ms`);
  console.log(`dark-bishop:  raw ${dark.raw}  orbits ${dark.orbitCount}  (all size 8)`);
  console.log(`light-bishop: raw ${light.raw}  orbits ${light.orbitCount}  (all size 8)`);
  console.log(`total:         raw ${dark.raw + light.raw}  orbits ${dark.orbitCount + light.orbitCount}`);

  // Build the pool: dark-component canonical boards, cross-referenced to the deck.
  // No pars — in the real deck each card's start is the previous card's landing
  // position (carry-over), so a fixed-start par is only meaningful for card 1.
  // The pool's job is board identity (which canonical board), not difficulty.
  const deckHashes = new Set(cardsDeck.cards.map((c) => c.hash));
  const pool = dark.orbits.map((o, i) => {
    const board = parseGrid(o.board);
    if (!isValidPlacement(board)) throw new Error(`pool board not deck-valid: ${o.board}`);
    return {
      id: i + 1,
      board: o.board,
      hash: o.hash,
      hashNum: o.hashNum,
      orbitSize: o.count,
      inDeck: deckHashes.has(o.hash),
    };
  });

  const inDeckCount = pool.filter((p) => p.inDeck).length;
  const distinctHashes = new Set(pool.map((p) => p.hash)).size;
  console.log(`\nPool: ${pool.length} canonical dark boards (${distinctHashes} distinct hashes).`);
  console.log(`All deck-valid: ${pool.every((p) => isValidPlacement(parseGrid(p.board)))}`);
  console.log(`In our 60-card deck: ${inDeckCount}/60 (coverage ${pool.length ? (inDeckCount / pool.length * 100).toFixed(1) : 0}%)`);

  // Write pool.json
  const out = {
    component: "dark-bishop (7,560 states, 945 D4 orbits)",
    count: pool.length,
    dedupKey: "boardHash (D4-invariant; one entry per orbit, the lex-min grid)",
    note: "Catalog of all 945 canonical boards a dark-component deck can draw from. Each entry is one D4 orbit (one canonical board standing for all 8 rotations/mirrors). inDeck:true means the board is one of our 60 generated cards (cards.json). Pars are intentionally omitted: in the real deck each card's start is the previous card's landing position (carry-over), so a fixed-start par would only be meaningful for card 1. Use `hash` to verify a physical card against this catalog.",
    companionCounts: {
      dark:  { raw: dark.raw,  orbits: dark.orbitCount },
      light: { raw: light.raw, orbits: light.orbitCount },
      total: { raw: dark.raw + light.raw, orbits: dark.orbitCount + light.orbitCount },
    },
    inDeckCount,
    pool,
  };
  await writeFile(join(__dirname, "pool.json"), JSON.stringify(out, null, 2) + "\n");
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
    lines.push(`| ${p.id} | \`${p.board}\` | ${p.inDeck ? "✓" : ""} | ${p.hash} |`);
  }
  lines.push("");
  await writeFile(join(__dirname, "POOL.md"), lines.join("\n"));
  console.log("Wrote POOL.md");
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
if (fileURLToPath(import.meta.url) === argv[1]) main();