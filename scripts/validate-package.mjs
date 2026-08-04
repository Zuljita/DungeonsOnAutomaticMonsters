// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import { validatePackage } from "./package-validation.mjs";

JSON.parse(readFileSync(new URL("../schema/monster.schema.json", import.meta.url), "utf8"));

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith("--")) ?? "converted/doa-monsters.json";
const allowUnapproved = args.includes("--allow-unapproved") || args.includes("--allow-review-required");
// Opt-in so the checker stays usable against a package released before the
// citation contract existed; this repository's own artifact is held to it.
// See review/policy/citation-policy.md.
const requirePublicCitations = args.includes("--require-public-citations");
const pkg = JSON.parse(readFileSync(file, "utf8"));
const errors = validatePackage(pkg, { allowUnapproved, requirePublicCitations });

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const label = allowUnapproved ? "candidate" : "public";
console.log(`Validated ${pkg.monsters.length} ${label} monster record(s) from ${file}`);
