// generate-web.js
//
// Builds web/index.html from web/index.html.template by inlining the 945
// canonical dark boards from pool.json as window.__POOL, so the web app
// works as a static site over file:// (no fetch needed).
//
//   node generate-web.js   # writes web/index.html

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(__dirname, "docs/index.html.template"), "utf8");
const pool = JSON.parse(readFileSync(join(__dirname, "pool.json"), "utf8"));

// Inline just the board strings (22kb) — the web app only needs the grids.
const boardsJson = JSON.stringify(pool.pool.map((p) => p.board));
const html = template.replace(
  "// __POOL_PLACEHOLDER__",
  `const BOARDS = ${boardsJson};`,
);

writeFileSync(join(__dirname, "docs/index.html"), html);
console.log(`Wrote docs/index.html (${(html.length / 1024).toFixed(1)} kb, ${pool.pool.length} boards inlined).`);
