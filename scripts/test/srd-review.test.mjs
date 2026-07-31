// SPDX-License-Identifier: MIT
//
// The SRD batch's review ledger application: decisions flip statuses only when
// the record still hashes as reviewed, and approval carries the batch's extra
// encounter-fields check.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyReviewDecisions } from "../srd/apply-review.mjs";
import { recordHash, validateEntry } from "../review/ledger.mjs";

const base = JSON.parse(readFileSync("converted/srd-monsters/doa-monsters.review-required.json", "utf8"));
const record = () => structuredClone(base.monsters[0]);

const entryFor = (target, overrides = {}) => ({
  recordId: target.id,
  monster: target.name,
  decision: "approved",
  reviewer: "test",
  reviewedOn: "2026-07-31",
  batch: "srd-test",
  baseRecordSha256: recordHash(target),
  checks: { gcsFidelity: true, doaPlayability: true, encounterFieldsPass: true },
  ...overrides,
});

test("an approved decision flips the record and nothing else", () => {
  const target = record();
  const other = structuredClone(base.monsters[1]);
  const { reviewed, problems } = applyReviewDecisions([target, other], [entryFor(target)]);
  assert.deepEqual(problems, []);
  assert.equal(reviewed[0].provenance.manualReviewStatus, "approved");
  assert.equal(reviewed[1].provenance.manualReviewStatus, "review_required");
});

test("the base records are not mutated", () => {
  const target = record();
  applyReviewDecisions([target], [entryFor(target)]);
  assert.equal(target.provenance.manualReviewStatus, "review_required");
});

test("a decision against a rebuilt record is a problem, not an approval", () => {
  const target = record();
  const entry = entryFor(target);
  target.effectiveness.combatEffectivenessRating += 1;
  const { reviewed, problems } = applyReviewDecisions([target], [entry]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no longer matches/);
  assert.equal(reviewed[0].provenance.manualReviewStatus, "review_required");
});

test("approval without the encounter-fields check is a problem", () => {
  const target = record();
  const entry = entryFor(target, { checks: { gcsFidelity: true, doaPlayability: true } });
  const { problems } = applyReviewDecisions([target], [entry]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /encounterFieldsPass/);
});

test("a decision that names no built record is a problem", () => {
  const target = record();
  const entry = entryFor(target, { recordId: "doa_nonexistent" });
  const { problems } = applyReviewDecisions([target], [entry]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /targets no built record/);
});

test("the last decision for a record wins", () => {
  const target = record();
  const approve = entryFor(target);
  const reject = entryFor(target, { decision: "rejected", checks: { gcsFidelity: false, doaPlayability: true } });
  const { reviewed, problems } = applyReviewDecisions([target], [approve, reject]);
  assert.deepEqual(problems, []);
  assert.equal(reviewed[0].provenance.manualReviewStatus, "rejected");
});

test("the ledger validator accepts the batch's encounter-fields check", () => {
  const target = record();
  assert.deepEqual(validateEntry(entryFor(target)), []);
});
