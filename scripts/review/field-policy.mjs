// SPDX-License-Identifier: MIT
//
// Enforcement of the 0.2.0 lair/treasure/grappling policy.
// See review/policy/0.2.0-empty-field-policy.md for the decision and its reasons.
//
// The policy is "deferred enrichment, shipped as explicit nulls": the objects are
// always present with their full key sets so consumers never need an existence
// check, and every value is null because the authorized source states none.
// Enforcing the key set is what makes a null read as "known absent" rather than
// "field forgotten".

export const TREASURE_FIELDS = [
  "money",
  "items",
  "strategy",
  "change",
  "estimatedMoneyAverage",
  "estimatedItemAverage",
  "estimatedMoneyPerAppearance",
];

export const GRAPPLING_FIELDS = ["skill", "damage", "controlMaximum"];

/** Structural check: the families exist with their documented keys. */
export function checkFieldShape(record, path = record.id) {
  const errors = [];
  if (record.lair !== null && typeof record.lair !== "string") {
    errors.push(`${path}.lair must be a string or null`);
  }
  for (const [family, fields] of [["treasure", TREASURE_FIELDS], ["grappling", GRAPPLING_FIELDS]]) {
    const value = record[family];
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`${path}.${family} must be an object`);
      continue;
    }
    for (const field of fields) {
      if (!(field in value)) errors.push(`${path}.${family}.${field} must be present (null when unknown)`);
    }
    for (const field of Object.keys(value)) {
      if (!fields.includes(field)) errors.push(`${path}.${family}.${field} is not part of the field contract`);
    }
  }
  return errors;
}

/** Package policy check: this source states no values, so none may be invented. */
export function checkDeferredPolicy(record, path = record.id) {
  const errors = checkFieldShape(record, path);
  if (record.lair !== null) {
    errors.push(`${path}.lair must be null: the authorized source states no lair data (0.2.0 policy)`);
  }
  for (const [family, fields] of [["treasure", TREASURE_FIELDS], ["grappling", GRAPPLING_FIELDS]]) {
    for (const field of fields) {
      if (record[family]?.[field] !== null && record[family]?.[field] !== undefined) {
        errors.push(
          `${path}.${family}.${field} must be null: the authorized source states no ${family} data, and review `
          + `does not synthesize it (0.2.0 policy)`,
        );
      }
    }
  }
  return errors;
}
