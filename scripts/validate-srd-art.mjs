import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateImageManifest } from "./art-validation.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidate = JSON.parse(readFileSync(
  path.join(repoRoot, "converted", "srd-monsters", "doa-monsters.review-required.json"),
  "utf8",
));
const manifest = JSON.parse(readFileSync(
  path.join(repoRoot, "art", "srd-monsters", "image-manifest.json"),
  "utf8",
));
const requireComplete = !process.argv.includes("--allow-incomplete");

const errors = validateImageManifest({
  manifest,
  candidate,
  repoRoot,
  requireComplete,
  artPackage: "srd-monsters",
});
if (errors.length > 0) throw new Error(`SRD monster art validation failed:\n${errors.join("\n")}`);

console.log(
  `Validated ${manifest.records.length} SRD art records: `
    + `${manifest.counts.portrait.generated} portraits, `
    + `${manifest.counts.token.generated} tokens, and `
    + `${manifest.counts.hexToken.generated} hex tokens generated.`,
);
