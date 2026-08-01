// maplibre-gl's own worker-URL resolution (based on import.meta.url) doesn't
// survive Turbopack's dev bundling — the browser ends up trying to load the
// current page as a JS module. Serving the worker as a same-origin static
// file sidesteps bundler resolution entirely. Re-run on every `npm install`
// so it stays in sync with the installed maplibre-gl version.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const destDir = join(__dirname, "..", "public");
const dest = join(destDir, "maplibre-gl-worker.mjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`copied ${src} -> ${dest}`);
