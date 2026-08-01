// maplibre-gl's own worker-URL resolution (based on import.meta.url) doesn't
// survive Turbopack's dev bundling — the browser ends up trying to load the
// current page as a JS module. Serving the worker as a same-origin static
// file sidesteps bundler resolution entirely. Re-run on every `npm install`
// so it stays in sync with the installed maplibre-gl version.
//
// maplibre-gl-worker.mjs itself `import`s a sibling maplibre-gl-shared.mjs
// (confirmed via DevTools Network tab: that relative import 404'd when only
// the worker file was copied) — both must be copied together.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "node_modules", "maplibre-gl", "dist");
const destDir = join(__dirname, "..", "public");

mkdirSync(destDir, { recursive: true });

for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(srcDir, file), join(destDir, file));
  console.log(`copied ${file}`);
}
