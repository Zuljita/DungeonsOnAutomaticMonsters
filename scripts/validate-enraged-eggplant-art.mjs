import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateImageManifest } from "./art-validation.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireComplete = process.argv.includes("--require-complete");
const candidatePath = path.join(
  repoRoot,
  "converted",
  "enraged-eggplant",
  "doa-monsters.review-required.json",
);
const candidate = existsSync(candidatePath)
  ? JSON.parse(readFileSync(candidatePath, "utf8"))
  : undefined;
const manifest = JSON.parse(readFileSync(
  path.join(repoRoot, "art", "enraged-eggplant", "image-manifest.json"),
  "utf8",
));

const errors = validateImageManifest({ manifest, candidate, repoRoot, requireComplete });
if (errors.length > 0) throw new Error(`Monster art validation failed:\n${errors.join("\n")}`);

console.log(
  `Validated ${manifest.records.length} art records: `
    + `${manifest.counts.portrait.generated} portraits, ${manifest.counts.token.generated} tokens, `
    + `and ${manifest.counts.hexToken.generated} hex tokens generated.`,
);
