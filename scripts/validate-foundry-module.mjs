// SPDX-License-Identifier: MIT
//
// Validate that the published package still builds a correct Foundry module:
// every approved record produces exactly one Actor, ids are stable and unique,
// art URLs are well-formed, licence and credit ride on every Actor, GM-only
// data stays in flags, and module.json declares its compatibility. Runs the
// build in memory, so it needs no dist output and no Foundry CLI.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFoundryModule, validateFoundryModule } from "./foundry-module.mjs";

const input = resolve(process.argv[2] ?? "converted/doa-monsters.json");
const pkg = JSON.parse(readFileSync(input, "utf8"));

let module_;
try {
  module_ = buildFoundryModule(pkg);
} catch (error) {
  console.error(`Foundry module build refused: ${error.message}`);
  process.exit(1);
}

const errors = validateFoundryModule(module_, pkg);
if (errors.length > 0) {
  console.error(`Foundry module validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Foundry module OK: ${module_.actors.length} Actors for package ${module_.manifest.version}, `
    + `pack ${module_.manifest.packs[0].name} (system ${module_.manifest.packs[0].system}).`,
);
