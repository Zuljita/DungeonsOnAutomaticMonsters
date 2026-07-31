// SPDX-License-Identifier: MIT
//
// Append review decisions for the independently authored SRD-coverage batch to
// review/srd-decisions.jsonl. Never edits the package; run
// `npm run build:srd-monsters` afterwards to regenerate the reviewed output
// and the checklist from the ledger.
//
//   npm run review:srd-decide -- --batch land-animals --decision approved \
//     --reviewer "Your Name" --on 2026-07-31 --batch-name srd-2026-07-31-b1 \
//     --gcs-fidelity pass --doa-playability pass --encounter-fields pass \
//     --note "Why this batch passes."
//
// --batch names a spec batch id from content/srd-monsters/ (or `all`);
// --record limits to one record by id, slug, or name. The encounter-fields
// check is required for approval on this batch: the specs author appearing
// numbers per creature instead of deriving them, so approving a record asserts
// someone judged them against the creature's role.

import { readFileSync } from "node:fs";
import {
  SRD_LEDGER_PATH,
  appendDecisions,
  effectiveDecisions,
  readLedger,
  recordHash,
} from "./review/ledger.mjs";

const BASE_PATH = "converted/srd-monsters/doa-monsters.review-required.json";

const args = process.argv.slice(2);
const valueFor = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const batch = valueFor("--batch");
const recordFilter = valueFor("--record");
const decision = valueFor("--decision");
const reviewer = valueFor("--reviewer");
const reviewedOn = valueFor("--on");
const batchName = valueFor("--batch-name");
const gcsFidelity = valueFor("--gcs-fidelity") === "pass";
const doaPlayability = valueFor("--doa-playability") === "pass";
// Recorded, never required by the ledger; required for approval on this batch.
const encounterFieldsPass = valueFor("--encounter-fields") === "pass";
const gcsVisualPass = valueFor("--gcs-visual") === "pass";
const foundryRenderPass = valueFor("--foundry-render") === "pass";
const dryRun = args.includes("--dry-run");
const notes = args.reduce((collected, arg, index) => (
  arg === "--note" && args[index + 1] ? [...collected, args[index + 1]] : collected
), []);

for (const [flag, value] of [["--decision", decision], ["--reviewer", reviewer], ["--on", reviewedOn], ["--batch-name", batchName]]) {
  if (!value) {
    console.error(`${flag} is required.`);
    process.exit(1);
  }
}
if (!batch && !recordFilter) {
  console.error("--batch <spec batch id | all> or --record <id | slug | name> is required.");
  process.exit(1);
}
if (decision === "approved" && !encounterFieldsPass) {
  console.error("Approval on this batch requires --encounter-fields pass.");
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASE_PATH, "utf8"));
const known = new Set(base.monsters.map(record => record.source.batch));

let selected = base.monsters;
if (batch && batch !== "all") {
  if (!known.has(batch)) {
    console.error(`Unknown spec batch ${batch}. Known: ${[...known].sort().join(", ")}.`);
    process.exit(1);
  }
  selected = selected.filter(record => record.source.batch === batch);
}
if (recordFilter) {
  selected = selected.filter(record => (
    record.id === recordFilter || record.source.slug === recordFilter || record.name === recordFilter
  ));
}
if (selected.length === 0) {
  console.error("Nothing matched.");
  process.exit(1);
}

const existing = effectiveDecisions(readLedger(".", SRD_LEDGER_PATH));
const entries = [];
const skipped = [];
for (const record of selected) {
  const baseRecordSha256 = recordHash(record);
  const current = existing.get(record.id);
  if (
    current
    && current.decision === decision
    && current.baseRecordSha256 === baseRecordSha256
    && current.checks.gcsFidelity === gcsFidelity
    && current.checks.doaPlayability === doaPlayability
    && (current.checks.encounterFieldsPass ?? false) === encounterFieldsPass
    && (current.checks.gcsVisualPass ?? false) === gcsVisualPass
    && (current.checks.foundryRenderPass ?? false) === foundryRenderPass
  ) {
    skipped.push(record.id);
    continue;
  }
  const checks = { gcsFidelity, doaPlayability, encounterFieldsPass };
  if (gcsVisualPass) checks.gcsVisualPass = true;
  if (foundryRenderPass) checks.foundryRenderPass = true;
  entries.push({
    recordId: record.id,
    monster: record.name,
    decision,
    reviewer,
    reviewedOn,
    batch: batchName,
    baseRecordSha256,
    checks,
    ...(notes.length > 0 ? { notes } : {}),
  });
}

if (dryRun) {
  console.log(JSON.stringify(entries, null, 2));
  console.log(`Would append ${entries.length} decision(s); ${skipped.length} already current.`);
} else if (entries.length === 0) {
  console.log(`Nothing to append; ${skipped.length} decision(s) already current.`);
} else {
  appendDecisions(entries, ".", SRD_LEDGER_PATH);
  console.log(
    `Appended ${entries.length} decision(s) to ${SRD_LEDGER_PATH}; ${skipped.length} already current. `
    + "Run npm run build:srd-monsters to regenerate the reviewed package and checklist.",
  );
}
