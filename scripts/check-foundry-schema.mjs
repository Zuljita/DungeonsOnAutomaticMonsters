// SPDX-License-Identifier: MIT
//
// Check the built Actors against the installed GURPS Game Aid's data model.
//
//   node scripts/check-foundry-schema.mjs
//   FOUNDRY_DATA=/path/to/FoundryVTT/Data node scripts/check-foundry-schema.mjs
//
// Foundry builds an Actor's system data from the system's template.json. A key
// we emit that the template does not define is not an error Foundry reports —
// it is silently dropped, and the monster is quietly missing whatever it was.
// This compares the two directly: every key we write must exist in the model,
// and the keys the model has that we never populate are listed so that leaving
// them empty stays a decision rather than an oversight.
//
// This is not a render check. It cannot tell you the sheet looks right, only
// that nothing we wrote will be thrown away on load. Requires the system to be
// installed locally, so it is a separate command from `npm test`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildFoundryModule } from "./foundry-module.mjs";

const PACKAGE_PATH = "converted/doa-monsters.json";
const SYSTEM_ID = "gurps";

const CANDIDATE_DATA_DIRS = [
  process.env.FOUNDRY_DATA,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "FoundryVTT", "Data"),
  process.env.HOME && join(process.env.HOME, ".local", "share", "FoundryVTT", "Data"),
  process.env.HOME && join(process.env.HOME, "Library", "Application Support", "FoundryVTT", "Data"),
].filter(Boolean);

const dataDir = CANDIDATE_DATA_DIRS.find(dir => existsSync(join(dir, "systems", SYSTEM_ID, "template.json")));
if (!dataDir) {
  console.error(
    `No installed ${SYSTEM_ID} system found. Set FOUNDRY_DATA to your Foundry user data directory `
    + "(the one containing systems/, modules/ and worlds/).",
  );
  process.exit(2);
}

const templatePath = join(dataDir, "systems", SYSTEM_ID, "template.json");
const systemPath = join(dataDir, "systems", SYSTEM_ID, "system.json");
const template = JSON.parse(readFileSync(templatePath, "utf8"));
const system = JSON.parse(readFileSync(systemPath, "utf8"));

/** Merge the templates an Actor type composes, the way Foundry does. */
function modelFor(type) {
  const definition = template.Actor?.[type];
  if (!definition) return null;
  const merged = {};
  for (const name of definition.templates ?? []) Object.assign(merged, template.Actor.templates?.[name] ?? {});
  for (const [key, value] of Object.entries(definition)) {
    if (key !== "templates") merged[key] = value;
  }
  return merged;
}

const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
const { actors } = buildFoundryModule(pkg);

const type = actors[0].type;
const model = modelFor(type);
if (!model) {
  console.error(`The installed system has no Actor type ${JSON.stringify(type)}. Types: ${template.Actor?.types?.join(", ")}`);
  process.exit(1);
}

const modelKeys = new Set(Object.keys(model));
const written = new Set();
const unknown = new Map();

for (const actor of actors) {
  for (const key of Object.keys(actor.system ?? {})) {
    written.add(key);
    if (!modelKeys.has(key)) unknown.set(key, (unknown.get(key) ?? 0) + 1);
  }
}

const untouched = [...modelKeys].filter(key => !written.has(key)).sort();

console.log(`System: ${system.title} ${system.version} (Actor type "${type}")`);
console.log(`Actors: ${actors.length}`);
console.log(`Keys written: ${written.size} of ${modelKeys.size} in the data model`);

if (untouched.length > 0) {
  console.log("\nModel keys left at their defaults (deliberate unless noted otherwise):");
  for (const key of untouched) console.log(`  - ${key}`);
}

if (unknown.size > 0) {
  console.error("\nKeys written that the data model does not define — Foundry will DROP these on load:");
  for (const [key, count] of unknown) console.error(`  - system.${key} (on ${count} actor(s))`);
  process.exit(1);
}

console.log("\nEvery key written is defined by the installed system's data model; nothing will be dropped on load.");
console.log("This is a schema check, not a render check: it says nothing about how the sheet looks.");
