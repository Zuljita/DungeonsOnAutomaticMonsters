// SPDX-License-Identifier: MIT
//
// Record review decisions in the append-only ledger without hand-editing the
// generated candidate JSON.
//
//   node scripts/review-decide.mjs --batch ordinary --decision approved \
//     --reviewer "Kyle Norton" --on 2026-07-26 --batch-name ee-2026-07-26-ordinary \
//     --gcs-fidelity pass --doa-playability pass --note "Mechanical review; no exception flags."
//
//   node scripts/review-decide.mjs --record enraged_eggplant_shrieker --decision approved ...
//
// Nothing is written until every selected record passes validation, and a record
// that already carries the same effective decision is skipped so re-running the
// command does not spam the ledger.

import { appendDecisions, effectiveDecisions, readLedger } from "./review/ledger.mjs";
import { selectBatch } from "./review/queue.mjs";
import { buildReviewedPackage } from "./review/build-candidate.mjs";

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const batch = valueFor("--batch", "all");
const recordFilter = valueFor("--record");
const decision = valueFor("--decision");
const reviewer = valueFor("--reviewer");
const reviewedOn = valueFor("--on");
const batchName = valueFor("--batch-name");
const gcsFidelity = valueFor("--gcs-fidelity") === "pass";
const doaPlayability = valueFor("--doa-playability") === "pass";
// Recorded, never required: see OPTIONAL_CHECKS in scripts/review/ledger.mjs.
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

const { dossiers } = buildReviewedPackage(".");
const existing = effectiveDecisions(readLedger("."));

let selected = selectBatch(dossiers, batch);
if (recordFilter) selected = selected.filter(entry => entry.id === recordFilter || entry.name === recordFilter);

const entries = [];
const skipped = [];
for (const entry of selected) {
  const current = existing.get(entry.id);
  if (
    current
    && current.decision === decision
    && current.baseRecordSha256 === entry.baseSha256
    && current.checks.gcsFidelity === gcsFidelity
    && current.checks.doaPlayability === doaPlayability
    && (current.checks.gcsVisualPass ?? false) === gcsVisualPass
    && (current.checks.foundryRenderPass ?? false) === foundryRenderPass
  ) {
    skipped.push(entry.id);
    continue;
  }
  entries.push({
    recordId: entry.id,
    monster: entry.name,
    decision,
    reviewer,
    reviewedOn,
    batch: batchName,
    baseRecordSha256: entry.baseSha256,
    checks: { gcsFidelity, doaPlayability, gcsVisualPass, foundryRenderPass },
    flags: entry.flags,
    notes,
  });
}

if (entries.length === 0) {
  console.log(`No new decisions to record (${skipped.length} already current).`);
  process.exit(0);
}

if (dryRun) {
  console.log(`Would append ${entries.length} decision(s); ${skipped.length} already current:`);
  for (const entry of entries) console.log(`  ${entry.decision.padEnd(16)} ${entry.recordId}`);
  process.exit(0);
}

appendDecisions(entries, ".");
console.log(
  `Appended ${entries.length} ${decision} decision(s) to the ledger as batch ${batchName}`
  + `${skipped.length > 0 ? `; ${skipped.length} already current` : ""}. Run npm run review:apply to regenerate.`,
);
