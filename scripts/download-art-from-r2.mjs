// Fetch the published art (portraits, tokens, hex tokens, web thumbnails) from
// the public CDN into art/<package>/... so a fresh checkout can run the full
// local validation, regenerate thumbnails, or review pieces — the replacement
// for `git lfs pull` now that the pixels are not in git.
//
// Only what the image manifests declare as generated is fetched; files already
// on disk with the recorded byte length are skipped. No credentials: the bucket
// is public behind assets.dungeonsonautomatic.com, and R2 egress is free.
//
// Usage:
//   npm run art:pull                       # both packages
//   node scripts/download-art-from-r2.mjs --package srd-monsters [--concurrency 8] [--force]
import { mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ART_PACKAGES, generatedAssets, publicUrlForKey } from "./art-files.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const onlyPackage = opt("package", null);
const CONCURRENCY = Number(opt("concurrency", "8"));
const FORCE = args.includes("--force");

async function fetchOne(asset) {
  const target = path.join(repoRoot, asset.assetPath);
  if (!FORCE && existsSync(target)) {
    const { size } = await stat(target);
    if (asset.bytes === null || size === asset.bytes) return "kept";
  }
  const response = await fetch(publicUrlForKey(asset.key));
  if (!response.ok) throw new Error(`${asset.key}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (asset.bytes !== null && buffer.length !== asset.bytes) {
    throw new Error(`${asset.key}: expected ${asset.bytes} bytes, got ${buffer.length}`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  return "fetched";
}

let fetched = 0;
let kept = 0;
const failures = [];
for (const { artPackage, manifestPath } of ART_PACKAGES) {
  if (onlyPackage && onlyPackage !== artPackage) continue;
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, manifestPath), "utf8"));
  const queue = generatedAssets(manifest, artPackage);
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const asset = queue[next++];
      try {
        const outcome = await fetchOne(asset);
        if (outcome === "fetched") fetched += 1;
        else kept += 1;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));
  console.log(`${artPackage}: ${queue.length} declared assets processed`);
}

console.log(`Fetched ${fetched}, kept ${kept} already-current file(s)${failures.length > 0 ? `, ${failures.length} failed` : ""}.`);
for (const failure of failures.slice(0, 20)) console.error(`  FAIL ${failure}`);
if (failures.length > 0) process.exit(1);
