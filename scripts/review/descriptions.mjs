// SPDX-License-Identifier: MIT
//
// Tracked, DOA-authored monster descriptions.
//
// The authorized fan-conversion source states no creature descriptions: it is a
// GURPS mechanics conversion, and every paragraph in it is either a point-costed
// build or the resolution text for an ability. Nothing is withheld by carrying no
// description; there is nothing there to carry. Descriptions are therefore
// original Dungeons on Automatic prose, written from the record's own statistics
// and from this project's art direction, and they say so in the data.
//
// That matters for more than tidiness. CREDITS.md requires originator credit to
// travel with EE-originated material, and the 0.2.0 field policy refuses to let
// DOA-authored content wear the source's provenance. A description that shipped
// unlabelled inside an EE-credited record would do exactly that. So every
// description carries its own authorship and license, separate from the record's.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const DESCRIPTIONS_PATH = "content/descriptions/enraged-eggplant.json";

export const DESCRIPTION_AUTHORSHIP = "doa_authored";
export const DESCRIPTION_CONTENT_LICENSE = "cc_by_4_0";
export const DESCRIPTION_CONTENT_LICENSE_URL =
  "https://github.com/Zuljita/DungeonsOnAutomaticMonsters/blob/main/licenses/CC-BY-4.0.txt";

// What the prose was written from. A description must name its basis so a
// reviewer can check the text against the same material the author had, and so
// "where did this sentence come from" never needs a guess. Every value here is
// project-owned: the record's own converted statistics, or this project's art
// direction for the creature. No SRD text is a permitted basis — SRD 3.5 prose
// is OGL 1.0a and cannot be laundered into a CC BY field.
export const DESCRIPTION_BASES = new Set([
  "record.stats.traits",
  "record.stats.attacks",
  "record.class",
  "record.size",
  "record.notes",
  "art.portrait.prompt",
  "art.token.prompt",
]);

export const MIN_DESCRIPTION_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 600;

export function loadDescriptionFile(root = ".") {
  let raw;
  try {
    raw = readFileSync(join(root, DESCRIPTIONS_PATH), "utf8");
  } catch {
    return null;
  }
  const file = JSON.parse(raw);
  const errors = validateDescriptionFile(file);
  if (errors.length > 0) {
    throw new Error(`Invalid ${DESCRIPTIONS_PATH}:\n${errors.join("\n")}`);
  }
  return file;
}

export function validateDescriptionFile(file) {
  const errors = [];
  if (typeof file !== "object" || file === null || Array.isArray(file)) {
    return [`${DESCRIPTIONS_PATH} must be an object`];
  }
  if (file.version !== 1) errors.push("version must be 1");
  if (typeof file.title !== "string" || file.title.trim() === "") errors.push("title must be a non-empty string");
  if (!Array.isArray(file.descriptions)) {
    errors.push("descriptions must be an array");
    return errors;
  }

  const seen = new Set();
  for (const [index, entry] of file.descriptions.entries()) {
    const path = `descriptions[${index}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    if (typeof entry.recordId !== "string" || entry.recordId.trim() === "") {
      errors.push(`${path}.recordId must be a non-empty string`);
    } else if (seen.has(entry.recordId)) {
      errors.push(`${path}.recordId duplicates ${entry.recordId}`);
    } else {
      seen.add(entry.recordId);
    }
    errors.push(...validateDescriptionText(entry.text, path));
    if (!Array.isArray(entry.basis) || entry.basis.length === 0) {
      errors.push(`${path}.basis must name at least one thing the prose was written from`);
    } else {
      for (const basis of entry.basis) {
        if (!DESCRIPTION_BASES.has(basis)) {
          errors.push(`${path}.basis has unsupported value ${basis}`);
        }
      }
    }
  }
  return errors;
}

export function validateDescriptionText(text, path) {
  const errors = [];
  if (typeof text !== "string" || text.trim() === "") {
    errors.push(`${path}.text must be a non-empty string`);
    return errors;
  }
  if (text !== text.trim()) errors.push(`${path}.text must not have leading or trailing whitespace`);
  if (text.length < MIN_DESCRIPTION_LENGTH) {
    errors.push(`${path}.text is ${text.length} characters; a description must be at least ${MIN_DESCRIPTION_LENGTH}`);
  }
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`${path}.text is ${text.length} characters; the limit is ${MAX_DESCRIPTION_LENGTH}`);
  }
  if (/\n/.test(text)) errors.push(`${path}.text must be a single paragraph`);
  // Image-prompt phrasing is the raw material, not the deliverable. A seed clause
  // that survives into the published field unedited reads as machine output to a
  // GM and describes a picture rather than a creature.
  const promptTells = [
    /\bthree-quarter\b/i,
    /\bsilhouette\b/i,
    /\bcrop-safe\b/i,
    /\bpadding\b/i,
    /\bcanvas\b/i,
    /\bDepict\b/,
    /\bShow one creature\b/i,
    /\bSubject:/i,
    /\bno words, lettering\b/i,
  ];
  for (const tell of promptTells) {
    if (tell.test(text)) errors.push(`${path}.text still carries image-prompt phrasing (${tell.source})`);
  }
  return errors;
}

export function descriptionsByRecord(file) {
  const byRecord = new Map();
  if (!file) return byRecord;
  for (const entry of file.descriptions) byRecord.set(entry.recordId, entry);
  return byRecord;
}

/** The published shape: self-describing about who wrote it and under what terms. */
export function describedField(entry) {
  return {
    text: entry.text,
    authorship: DESCRIPTION_AUTHORSHIP,
    basis: [...entry.basis],
    contentLicense: DESCRIPTION_CONTENT_LICENSE,
    contentLicenseUrl: DESCRIPTION_CONTENT_LICENSE_URL,
  };
}

/**
 * Attach the description to a record clone, keeping it next to the other
 * flavour-facing fields rather than appended after the provenance block.
 * Records without authored prose still carry the key, explicitly null, for the
 * same reason lair and treasure do: a consumer reads the field without an
 * existence check, and a null reads as "known absent" rather than "forgotten".
 */
export function applyDescription(record, entry) {
  const value = entry ? describedField(entry) : null;
  const next = {};
  let inserted = false;
  for (const [key, existing] of Object.entries(record)) {
    if (key === "description") continue;
    next[key] = existing;
    if (key === "lair") {
      next.description = value;
      inserted = true;
    }
  }
  if (!inserted) next.description = value;
  return next;
}

/** Structural check used by package validation. */
export function checkDescriptionShape(record, path = record.id) {
  const errors = [];
  const value = record.description;
  if (value === undefined || value === null) return errors;
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path}.description must be an object or null`);
    return errors;
  }
  errors.push(...validateDescriptionText(value.text, `${path}.description`));
  if (value.authorship !== DESCRIPTION_AUTHORSHIP) {
    errors.push(`${path}.description.authorship must be ${DESCRIPTION_AUTHORSHIP}`);
  }
  if (value.contentLicense !== DESCRIPTION_CONTENT_LICENSE) {
    errors.push(`${path}.description.contentLicense must be ${DESCRIPTION_CONTENT_LICENSE}`);
  }
  if (typeof value.contentLicenseUrl !== "string" || value.contentLicenseUrl.trim() === "") {
    errors.push(`${path}.description.contentLicenseUrl must be a non-empty string`);
  }
  if (!Array.isArray(value.basis) || value.basis.length === 0) {
    errors.push(`${path}.description.basis must be a non-empty array`);
  } else {
    for (const basis of value.basis) {
      if (!DESCRIPTION_BASES.has(basis)) {
        errors.push(`${path}.description.basis has unsupported value ${basis}`);
      }
    }
  }
  for (const key of Object.keys(value)) {
    if (!["text", "authorship", "basis", "contentLicense", "contentLicenseUrl"].includes(key)) {
      errors.push(`${path}.description.${key} is not part of the field contract`);
    }
  }
  return errors;
}

/** Reviewed-package policy: every record carries the key, described or not. */
export function checkDescriptionPolicy(record, path = record.id) {
  const errors = checkDescriptionShape(record, path);
  if (!("description" in record)) {
    errors.push(`${path}.description must be present (null when the record has no authored description)`);
  }
  return errors;
}

export const DESCRIPTION_NOTE =
  "Description text is original Dungeons on Automatic prose written from this record's own converted statistics "
  + "and from the project's art direction for the creature. It is not derived from the authorized fan-conversion "
  + "source, which states no creature descriptions, and not from any SRD. It carries its own authorship and "
  + "CC BY 4.0 terms in the description field. See review/policy/description-policy.md.";
