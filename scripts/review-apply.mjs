// SPDX-License-Identifier: MIT
//
// Regenerate the reviewed candidate package and CHECKLIST.md from tracked
// inputs. Both outputs are pure functions of the base conversion output plus
// `review/repairs/` plus `review/decisions.jsonl`, so they can never drift from
// the decisions that produced them.
//
//   node scripts/review-apply.mjs
//   node scripts/review-apply.mjs --check      # fail instead of writing

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import {
  BASE_LOCK_PATH,
  CHECKLIST_PATH,
  REVIEWED_PATH,
  buildReviewedPackage,
  serializePackage,
} from "./review/build-candidate.mjs";
import { renderChecklist } from "./review/checklist.mjs";
import { checkDeferredPolicy } from "./review/field-policy.mjs";
import { validatePackage } from "./package-validation.mjs";

const check = process.argv.includes("--check");
const { reviewed, dossiers, base } = buildReviewedPackage(".");

const packageText = serializePackage(reviewed);
const checklistText = `${renderChecklist({ dossiers, reviewed })}\n`;

const errors = validatePackage(reviewed, { allowUnapproved: true });
for (const record of reviewed.monsters) errors.push(...checkDeferredPolicy(record));
if (errors.length > 0) {
  console.error(`Reviewed candidate package is invalid:\n${errors.join("\n")}`);
  process.exit(1);
}

const lockErrors = verifyBaseLock(base);
if (lockErrors.length > 0) {
  console.error(lockErrors.join("\n"));
  process.exit(1);
}

const drift = [];
if (check) {
  if (!matches(REVIEWED_PATH, packageText)) drift.push(`${REVIEWED_PATH} is stale; run npm run review:apply`);
  if (!matches(CHECKLIST_PATH, checklistText)) drift.push(`${CHECKLIST_PATH} is stale; run npm run review:apply`);
  if (drift.length > 0) {
    console.error(drift.join("\n"));
    process.exit(1);
  }
  console.log(`Reviewed package and checklist are current for ${reviewed.monsters.length} record(s).`);
} else {
  writeFileSync(REVIEWED_PATH, packageText, "utf8");
  writeFileSync(CHECKLIST_PATH, checklistText, "utf8");
  const approved = reviewed.monsters.filter(record => record.provenance.manualReviewStatus === "approved").length;
  console.log(
    `Wrote ${REVIEWED_PATH} and ${CHECKLIST_PATH}: `
    + `${approved}/${reviewed.monsters.length} record(s) approved.`,
  );
}

function matches(path, text) {
  return existsSync(path) && readFileSync(path, "utf8") === text;
}

function verifyBaseLock(basePackage) {
  if (!existsSync(BASE_LOCK_PATH)) {
    return [`${BASE_LOCK_PATH} is missing; run node scripts/review-lock.mjs to record the reviewed base.`];
  }
  const lock = JSON.parse(readFileSync(BASE_LOCK_PATH, "utf8"));
  const problems = [];
  if (lock.recordCount !== basePackage.monsters.length) {
    problems.push(
      `Base conversion output has ${basePackage.monsters.length} records but ${BASE_LOCK_PATH} locks `
      + `${lock.recordCount}. The conversion was re-run; re-review the affected records.`,
    );
  }
  return problems;
}
