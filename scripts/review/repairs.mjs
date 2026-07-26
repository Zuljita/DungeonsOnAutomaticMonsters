// SPDX-License-Identifier: MIT
//
// Declarative repair records. A repair is a tracked, reviewable statement of
// "this candidate field changes, for this reason" rather than a hand edit to a
// two-megabyte generated JSON file. Repairs are applied deterministically in
// file order, then record order, so the regenerated candidate package is a pure
// function of (base conversion output + tracked repairs + tracked decisions).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPAIR_DIR = "review/repairs";

export function loadRepairFiles(root = ".") {
  const dir = join(root, REPAIR_DIR);
  let names;
  try {
    names = readdirSync(dir).filter(name => name.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return names.map(name => {
    const file = JSON.parse(readFileSync(join(dir, name), "utf8"));
    const errors = validateRepairFile(file, name);
    if (errors.length > 0) throw new Error(`Invalid repair file ${name}:\n${errors.join("\n")}`);
    return { name, ...file };
  });
}

export function validateRepairFile(file, name) {
  const errors = [];
  if (typeof file !== "object" || file === null) return [`${name} must be an object`];
  if (file.version !== 1) errors.push(`${name}.version must be 1`);
  if (!Number.isInteger(file.issue)) errors.push(`${name}.issue must be the GitHub issue number`);
  if (typeof file.title !== "string" || file.title.trim() === "") errors.push(`${name}.title must be a non-empty string`);
  if (!Array.isArray(file.repairs) || file.repairs.length === 0) {
    errors.push(`${name}.repairs must be a non-empty array`);
    return errors;
  }
  for (const [index, repair] of file.repairs.entries()) {
    const path = `${name}.repairs[${index}]`;
    if (typeof repair !== "object" || repair === null) {
      errors.push(`${path} must be an object`);
      continue;
    }
    if (typeof repair.recordId !== "string" || repair.recordId.trim() === "") {
      errors.push(`${path}.recordId must be a non-empty string`);
    }
    if (typeof repair.rationale !== "string" || repair.rationale.trim() === "") {
      errors.push(`${path}.rationale must explain why the record changes`);
    }
    const hasSet = repair.set !== undefined;
    const hasNotes = Array.isArray(repair.appendConversionNotes) && repair.appendConversionNotes.length > 0;
    if (!hasSet && !hasNotes) errors.push(`${path} must change something (set and/or appendConversionNotes)`);
    if (hasSet && (typeof repair.set !== "object" || repair.set === null || Array.isArray(repair.set))) {
      errors.push(`${path}.set must be an object of dotted paths`);
    }
    for (const field of ["appendConversionNotes", "appendStatNotes"]) {
      if (repair[field] !== undefined && !isStringArray(repair[field])) {
        errors.push(`${path}.${field} must be an array of non-empty strings`);
      }
    }
  }
  return errors;
}

/** Group every repair by the record it targets, preserving file/record order. */
export function repairsByRecord(repairFiles) {
  const byRecord = new Map();
  for (const file of repairFiles) {
    for (const repair of file.repairs) {
      const entry = { ...repair, issue: file.issue, sourceFile: file.name };
      const existing = byRecord.get(repair.recordId);
      if (existing) existing.push(entry);
      else byRecord.set(repair.recordId, [entry]);
    }
  }
  return byRecord;
}

/**
 * Apply repairs to a record clone. Returns the repaired record plus the audit
 * trail of what each repair changed, so review views and the checklist can show
 * the before/after without re-deriving it.
 */
export function applyRepairs(record, repairs) {
  const next = structuredClone(record);
  const applied = [];
  for (const repair of repairs) {
    const changes = [];
    for (const [path, value] of Object.entries(repair.set ?? {})) {
      const before = getPath(next, path);
      setPath(next, path, structuredClone(value));
      changes.push({ path, before, after: structuredClone(value) });
    }
    for (const note of repair.appendStatNotes ?? []) {
      next.stats.notes = [...(next.stats.notes ?? []), note];
    }
    for (const note of repair.appendConversionNotes ?? []) {
      next.provenance.conversionNotes = [...(next.provenance.conversionNotes ?? []), note];
    }
    applied.push({
      issue: repair.issue,
      sourceFile: repair.sourceFile,
      rationale: repair.rationale,
      changes,
    });
  }
  return { record: next, applied };
}

export function getPath(target, path) {
  let cursor = target;
  for (const key of path.split(".")) {
    if (cursor === null || cursor === undefined) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

export function setPath(target, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cursor = target;
  for (const key of keys) {
    if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[last] = value;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(entry => typeof entry === "string" && entry.trim() !== "");
}
