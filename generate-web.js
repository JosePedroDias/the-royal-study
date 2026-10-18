// generate-web.js
//
// Builds docs/index.html from docs/index.html.template by inlining the 945
// canonical dark boards from pool.json, so the web app works as a static
// site over file:// (no fetch needed).
//
// Also copies royal-study-engine.js into docs/: GitHub Pages only serves
// files inside the published folder, and the page imports it with a
// site-relative "./royal-study-engine.js" so it resolves under the
// /<repo>/ prefix of a project Pages site.
//
//   node generate-web.js   # writes docs/index.html + docs/royal-study-engine.js

import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
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
copyFileSync(join(__dirname, "royal-study-engine.js"), join(__dirname, "docs/royal-study-engine.js"));
console.log(`Wrote docs/index.html (${(html.length / 1024).toFixed(1)} kb, ${pool.pool.length} boards inlined).`);
console.log("Copied royal-study-engine.js → docs/royal-study-engine.js.");
