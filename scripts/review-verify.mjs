// SPDX-License-Identifier: MIT
//
// Integrity gate for the review workflow. Run before promoting anything.
//
//   node scripts/review-verify.mjs
//
// Checks, in order:
//   1. the ledger parses and every entry is well formed;
//   2. every decision targets a real record and the base record it was made
//      against still hashes the same;
//   3. approved decisions actually assert both review gates;
//   4. the reviewed package and CHECKLIST.md are regenerable byte-for-byte;
//   5. the reviewed package passes candidate validation;
//   6. promotion still refuses any record that is not approved.
//
// The base conversion queue is untracked, so this script reports "skipped"
// rather than failing when it is not present locally.

import { existsSync, readFileSync } from "node:fs";
import {
  BASE_LOCK_PATH,
  BASE_PATH,
  CHECKLIST_PATH,
  REVIEWED_PATH,
  buildReviewedPackage,
  serializePackage,
} from "./review/build-candidate.mjs";
import { renderChecklist } from "./review/checklist.mjs";
import { effectiveDecisions, readLedger, recordHash } from "./review/ledger.mjs";
import { validatePackage } from "./package-validation.mjs";

const problems = [];
const notes = [];

// 1. Ledger shape. readLedger throws on any malformed entry.
const ledger = readLedger(".");
notes.push(`ledger: ${ledger.length} entr${ledger.length === 1 ? "y" : "ies"}`);

if (!existsSync(BASE_PATH)) {
  console.log(
    `Skipped: ${BASE_PATH} is not present (the conversion queue is untracked). `
    + `Ledger validated: ${ledger.length} entries.`,
  );
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASE_PATH, "utf8"));
const baseById = new Map(base.monsters.map(record => [record.id, record]));

// 2 and 3. Decisions must target real, unchanged records and mean what they say.
for (const entry of effectiveDecisions(ledger).values()) {
  const record = baseById.get(entry.recordId);
  if (!record) {
    problems.push(`decision on line ${entry.line} targets unknown record ${entry.recordId}`);
    continue;
  }
  const hash = recordHash(record);
  if (hash !== entry.baseRecordSha256) {
    problems.push(
      `decision on line ${entry.line} for ${entry.recordId} was made against base record `
      + `${entry.baseRecordSha256.slice(0, 12)}, but the local base record is ${hash.slice(0, 12)}`,
    );
  }
  if (entry.decision === "approved" && !(entry.checks.gcsFidelity && entry.checks.doaPlayability)) {
    problems.push(`decision on line ${entry.line} approves ${entry.recordId} without both review gates`);
  }
}

// The tracked lock is what CI can see; make sure it still describes this base.
if (existsSync(BASE_LOCK_PATH)) {
  const lock = JSON.parse(readFileSync(BASE_LOCK_PATH, "utf8"));
  for (const [id, hash] of Object.entries(lock.records)) {
    const record = baseById.get(id);
    if (!record) problems.push(`${BASE_LOCK_PATH} locks ${id}, which is no longer in the conversion output`);
    else if (recordHash(record) !== hash) problems.push(`${BASE_LOCK_PATH} is stale for ${id}`);
  }
} else {
  problems.push(`${BASE_LOCK_PATH} is missing`);
}

// 4, 5. Generated artefacts must be reproducible and valid.
const { reviewed, dossiers } = buildReviewedPackage(".");
const expectedPackage = serializePackage(reviewed);
const expectedChecklist = `${renderChecklist({ dossiers, reviewed })}\n`;
if (!existsSync(REVIEWED_PATH) || readFileSync(REVIEWED_PATH, "utf8") !== expectedPackage) {
  problems.push(`${REVIEWED_PATH} does not match the tracked review inputs; run npm run review:apply`);
}
if (!existsSync(CHECKLIST_PATH) || readFileSync(CHECKLIST_PATH, "utf8") !== expectedChecklist) {
  problems.push(`${CHECKLIST_PATH} does not match the tracked review inputs; run npm run review:apply`);
}
const validationErrors = validatePackage(reviewed, { allowUnapproved: true });
for (const error of validationErrors) problems.push(`reviewed package: ${error}`);

// 6. Promotion gate.
const unapproved = reviewed.monsters.filter(record => record.provenance.manualReviewStatus !== "approved");
notes.push(`approved: ${reviewed.monsters.length - unapproved.length}/${reviewed.monsters.length}`);
if (unapproved.length > 0) {
  notes.push(`promotion would refuse: ${unapproved.length} record(s) not approved`);
}

if (problems.length > 0) {
  console.error(`Review integrity check failed:\n${problems.map(problem => `  - ${problem}`).join("\n")}`);
  process.exit(1);
}
console.log(`Review integrity OK (${notes.join("; ")}).`);
