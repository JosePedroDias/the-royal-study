// enumerate-boards.js
//
// Enumerates every canonical board (D4 orbit) in the dark-bishop component
// the deployed deck uses, and (for reference) the light-bishop component and
// the union. Writes canonical-boards.json (all dark orbits) + prints the
// counts that go into BOARD_COMBINATIONS.md §3b.
//
//   node enumerate-boards.js
//
// Counts (verified):
//   dark-bishop raw placements:  7,560   dark D4 orbits:   945
//   light-bishop raw placements: 5,880   light D4 orbits:   735
//   total raw:                 13,440   total D4 orbits: 1,680

"use strict";

const E = require("./royal-study-engine.js");
const { boardHash, boardHashNum, isDark,
        parseGrid, toGrid, PIECE_ORDER } = E;
const fs = require("fs");
const path = require("path");

const SQS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const CENTER = 4;

// Enumerate all valid placements in `component` ("dark" | "light" | "both").
// A placement is valid for a component iff: Knight off centre, AND Bishop on
// the component's color. (isValidPlacement hard-codes dark; we check here.)
function* placements(component) {
  for (const b of SQS) {
    if (component === "dark"  && !isDark(b)) continue;
    if (component === "light" &&  isDark(b)) continue;
    if (component === "both")  { /* accept either color */ }
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

// Build { hash -> { hash, hashNum, canonical (grid), orbitSize, sample (grid) } }
function orbits(component) {
  const map = new Map();
  let raw = 0;
  for (const p of placements(component)) {
    raw++;
    // Knight-off-centre is enforced by the generator; Bishop color by the
    // branch above. No further isValidPlacement check needed here.
    const h = boardHash(p);
    let o = map.get(h);
    if (!o) {
      o = { hash: h, hashNum: boardHashNum(p), canonical: toGrid(p), count: 0, samples: [] };
      map.set(h, o);
    }
    o.count++;
    if (o.samples.length < 3) o.samples.push(toGrid(p));
  }
  const list = [...map.values()].sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
  return { component, raw, orbitCount: list.length, orbits: list };
}

function main() {
  const t0 = Date.now();
  const dark  = orbits("dark");
  const light = orbits("light");

  // Sanity: D4 action is free → every orbit has exactly 8 elements.
  const badDark  = dark.orbits.filter(o => o.count !== 8);
  const badLight = light.orbits.filter(o => o.count !== 8);
  if (badDark.length || badLight.length) {
    throw new Error("D4 action not free: " + badDark.length + " dark, " +
                    badLight.length + " light orbits with size != 8");
  }

  console.log(`Enumerated in ${Date.now() - t0} ms`);
  console.log(`dark-bishop:  raw ${dark.raw}  orbits ${dark.orbitCount}  (all size 8)`);
  console.log(`light-bishop:  raw ${light.raw}  orbits ${light.orbitCount}  (all size 8)`);
  console.log(`total:          raw ${dark.raw + light.raw}  orbits ${dark.orbitCount + light.orbitCount}`);

  // Write the full dark-component enumeration (the deck's component).
  const out = {
    generatedAt: new Date().toISOString(),
    component: "dark-bishop",
    rawPlacements: dark.raw,
    d4Orbits: dark.orbitCount,
    note: "D4 action is free on the dark component — every orbit has exactly 8 elements (7,560 / 8 = 945). Each entry is one canonical board (boardHash, the lex-min of its 8 rotations/mirrors); its full orbit is those 8 grids. The deck's 60 cards (cards.json) cover 60 / 945 ≈ 6.3% of these.",
    orbits: dark.orbits.map(o => ({
      hash: o.hash,
      hashNum: o.hashNum,
      board: o.canonical,
      orbitSize: o.count,
      samples: o.samples,
    })),
  };
  fs.writeFileSync(path.join(__dirname, "canonical-boards.json"),
                   JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote canonical-boards.json (${dark.orbitCount} dark orbits).`);

  // Coverage cross-check against our 60-card deck.
  const deck = require("./cards.json");
  const deckHashes = new Set(deck.cards.map(c => c.hash));
  const inDark = [...deckHashes].filter(h => dark.orbits.some(o => o.hash === h)).length;
  console.log(`\nDeck coverage: ${inDark}/${deckHashes.size} card hashes present in the dark enumeration (expected ${deckHashes.size}/${deckHashes.size}).`);
  console.log(`Deck covers ${deckHashes.size}/${dark.orbitCount} = ${(deckHashes.size / dark.orbitCount * 100).toFixed(1)}% of dark canonical boards.`);
}

if (require.main === module) main();