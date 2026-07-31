// SPDX-License-Identifier: MIT
//
// Apply review/srd-decisions.jsonl to the built SRD records.
//
// The Enraged Eggplant pipeline locks an untracked conversion queue and applies
// its ledger through review/build-candidate.mjs. This batch's base records are
// tracked and regenerable from content/srd-monsters/, so the same guarantee is
// simpler: every decision stores the sha256 of the base record the reviewer
// saw, and a decision whose record has since been rebuilt differently is an
// error, not a silent approval of different data.

import { effectiveDecisions, recordHash } from "../review/ledger.mjs";

/**
 * Return { reviewed, decisions, problems }.
 *
 * `reviewed` is a deep copy of `records` with each record's
 * provenance.manualReviewStatus set to its effective decision; records with no
 * decision stay `review_required`. `decisions` maps recordId to the effective
 * ledger entry so the checklist can print reviewer and date.
 *
 * The SRD checklist requires the encounter-fields check for approval on this
 * batch, on top of the two gates the ledger itself enforces.
 */
export function applyReviewDecisions(records, entries) {
  const problems = [];
  const decisions = effectiveDecisions(entries);
  const byId = new Map(records.map(record => [record.id, record]));

  for (const [recordId, entry] of decisions) {
    const record = byId.get(recordId);
    if (!record) {
      problems.push(`${recordId}: decision targets no built record; restore the spec or supersede the decision`);
      continue;
    }
    const hash = recordHash(record);
    if (hash !== entry.baseRecordSha256) {
      problems.push(
        `${recordId}: the record no longer matches the build the reviewer saw `
        + `(decision ${entry.baseRecordSha256.slice(0, 12)}, build ${hash.slice(0, 12)}); re-review it`,
      );
      continue;
    }
    if (entry.decision === "approved" && entry.checks.encounterFieldsPass !== true) {
      problems.push(`${recordId}: approval on this batch requires checks.encounterFieldsPass`);
    }
  }

  const reviewed = records.map(record => {
    const entry = decisions.get(record.id);
    const clone = structuredClone(record);
    if (entry && problems.every(problem => !problem.startsWith(`${record.id}:`))) {
      clone.provenance.manualReviewStatus = entry.decision;
    }
    return clone;
  });

  return { reviewed, decisions, problems };
}
