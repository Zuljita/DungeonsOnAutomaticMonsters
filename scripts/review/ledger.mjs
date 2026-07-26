// SPDX-License-Identifier: MIT
//
// Append-only review decision ledger.
//
// One JSON object per line in `review/decisions.jsonl`. Lines are never edited
// or removed: a reviewer who changes their mind appends a superseding decision
// for the same record, and the last line wins. That keeps the full history of
// who decided what, when, and on which exact base record.

import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export const LEDGER_PATH = "review/decisions.jsonl";
export const DECISIONS = new Set(["approved", "rejected", "review_required"]);

/**
 * The two gates issue #9 requires before a record may be approved.
 *
 *   gcsFidelity   — the rebuilt ancestry reconciles: every exact-identity cost
 *                   discrepancy is adjudicated against the published cost tables
 *                   and every source-total difference is explained. This is an
 *                   arithmetic and library check.
 *   doaPlayability — the record is runnable at the table: it has mechanics a GM
 *                   can resolve, ratings recomputed through the consumer CER
 *                   path, and encounter metadata consistent with those ratings.
 */
export const REQUIRED_CHECKS = ["gcsFidelity", "doaPlayability"];

/**
 * Recorded but not required for approval. Opening a .gct in the GCS desktop
 * application and confirming the displayed ancestry total is a human step that
 * no script performs; tracking it separately keeps `gcsFidelity: true` from
 * quietly claiming it happened.
 */
export const OPTIONAL_CHECKS = ["gcsVisualPass"];

export function ledgerFile(root = ".") {
  return join(root, LEDGER_PATH);
}

export function readLedger(root = ".") {
  const file = ledgerFile(root);
  if (!existsSync(file)) return [];
  const entries = [];
  const lines = readFileSync(file, "utf8").split("\n");
  for (const [index, line] of lines.entries()) {
    const text = line.trim();
    if (text === "") continue;
    let entry;
    try {
      entry = JSON.parse(text);
    } catch (error) {
      throw new Error(`${LEDGER_PATH}:${index + 1} is not valid JSON: ${error.message}`);
    }
    const errors = validateEntry(entry);
    if (errors.length > 0) throw new Error(`${LEDGER_PATH}:${index + 1} is invalid:\n${errors.join("\n")}`);
    entries.push({ ...entry, line: index + 1 });
  }
  return entries;
}

/** Last decision per record wins; earlier entries remain as history. */
export function effectiveDecisions(entries) {
  const byRecord = new Map();
  for (const entry of entries) byRecord.set(entry.recordId, entry);
  return byRecord;
}

export function appendDecisions(entries, root = ".") {
  for (const entry of entries) {
    const errors = validateEntry(entry);
    if (errors.length > 0) throw new Error(`Refusing to append an invalid decision:\n${errors.join("\n")}`);
  }
  const payload = entries.map(entry => JSON.stringify(entry, orderedKeys)).join("\n");
  appendFileSync(ledgerFile(root), `${payload}\n`, "utf8");
  return entries.length;
}

export function validateEntry(entry) {
  const errors = [];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return ["entry must be an object"];
  if (typeof entry.recordId !== "string" || entry.recordId.trim() === "") errors.push("recordId must be a non-empty string");
  if (!DECISIONS.has(entry.decision)) errors.push(`decision must be one of ${[...DECISIONS].join(", ")}`);
  if (typeof entry.reviewer !== "string" || entry.reviewer.trim() === "") errors.push("reviewer must be a non-empty string");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedOn ?? "")) errors.push("reviewedOn must be an ISO date (YYYY-MM-DD)");
  if (typeof entry.batch !== "string" || entry.batch.trim() === "") errors.push("batch must name the review batch");
  if (!/^[0-9a-f]{64}$/.test(entry.baseRecordSha256 ?? "")) {
    errors.push("baseRecordSha256 must be the sha256 of the base record the reviewer saw");
  }
  if (typeof entry.checks !== "object" || entry.checks === null) {
    errors.push("checks must record the review gates");
  } else {
    for (const check of REQUIRED_CHECKS) {
      if (typeof entry.checks[check] !== "boolean") errors.push(`checks.${check} must be a boolean`);
    }
    for (const check of Object.keys(entry.checks)) {
      if (!REQUIRED_CHECKS.includes(check) && !OPTIONAL_CHECKS.includes(check)) {
        errors.push(`checks.${check} is not a known review gate`);
      }
    }
  }
  if (entry.notes !== undefined && !Array.isArray(entry.notes)) errors.push("notes must be an array of strings");

  // An approval asserts both gates passed. Anything else must not read as one.
  if (entry.decision === "approved" && typeof entry.checks === "object" && entry.checks !== null) {
    for (const check of REQUIRED_CHECKS) {
      if (entry.checks[check] !== true) errors.push(`approved decisions require checks.${check} to be true`);
    }
  }
  return errors;
}

/** sha256 of the canonical JSON form of a base record, used to detect drift. */
export function recordHash(record) {
  return createHash("sha256").update(JSON.stringify(record, orderedKeys)).digest("hex");
}

/** Stable key ordering so hashes do not depend on property insertion order. */
function orderedKeys(key, value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export { orderedKeys };
