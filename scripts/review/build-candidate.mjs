// SPDX-License-Identifier: MIT
//
// Deterministic assembly of the reviewed candidate package.
//
//   base conversion output + tracked repairs + tracked decisions -> reviewed package
//
// The base file is the untouched output of `npm run convert:enraged-eggplant`.
// Review never edits it, so a reviewer can always diff what the conversion
// produced against what the package ships, and the whole reviewed package can be
// thrown away and rebuilt from tracked inputs at any time.

import { readFileSync } from "node:fs";
import { effectivenessFromStats } from "./cer.mjs";
import { applyRepairs, loadRepairFiles, repairsByRecord } from "./repairs.mjs";
import { effectiveDecisions, readLedger, recordHash } from "./ledger.mjs";
import { ENCOUNTER_DERIVATION_NOTE, deriveEncounter, recordFlags } from "./queue.mjs";

export const BASE_PATH = "converted/enraged-eggplant/doa-monsters.review-required.json";
export const REVIEWED_PATH = "converted/enraged-eggplant/doa-monsters.reviewed.json";
export const CHECKLIST_PATH = "converted/enraged-eggplant/CHECKLIST.md";
export const MANIFEST_PATH = "converted/enraged-eggplant/conversion-manifest.json";
export const BASE_LOCK_PATH = "review/base-lock.json";

export const CONTENT_LICENSE = "cc_by_4_0";
export const CONTENT_LICENSE_URL =
  "https://github.com/Zuljita/DungeonsOnAutomaticMonsters/blob/main/licenses/CC-BY-4.0.txt";
export const REVIEWED_CONVERSION_VERSION = "0.2.0-reviewed";

export function loadInputs(root = ".") {
  const base = JSON.parse(readFileSync(`${root}/${BASE_PATH}`, "utf8"));
  const conversionManifest = JSON.parse(readFileSync(`${root}/${MANIFEST_PATH}`, "utf8"));
  const manifestByName = new Map(conversionManifest.records.map(entry => [entry.name, entry]));
  return {
    base,
    manifestByName,
    repairs: repairsByRecord(loadRepairFiles(root)),
    decisions: effectiveDecisions(readLedger(root)),
  };
}

/**
 * Build one reviewed record. Returns the record plus the review dossier used by
 * the queue view, the checklist, and the integrity checks.
 */
export function buildRecord(baseRecord, { repairs = [], decision = null, manifestEntry = null } = {}) {
  const baseSha256 = recordHash(baseRecord);
  const { record: repaired, applied } = applyRepairs(baseRecord, repairs);

  // Ratings are always re-derived from the reviewed stats unless a repair pins
  // them, so a mechanics repair can never leave a stale CER behind.
  const pinnedEffectiveness = applied.some(entry =>
    entry.changes.some(change => change.path.startsWith("effectiveness.")));
  const canonical = effectivenessFromStats(repaired.stats, repaired.name);
  const notes = [];

  if (!pinnedEffectiveness) {
    const baseline = baseRecord.effectiveness;
    repaired.effectiveness = {
      ...repaired.effectiveness,
      offenseRating: canonical.offenseRating,
      protectionRating: canonical.protectionRating,
      combatEffectivenessRating: canonical.combatEffectivenessRating,
      threatTier: canonical.threatTier,
    };
    notes.push(
      `CER recomputed from the reviewed Typical Stats through the canonical Dungeons on Automatic CER path: `
      + `OR ${canonical.offenseRating}, PR ${canonical.protectionRating}, `
      + `CER ${canonical.combatEffectivenessRating}, threat tier ${canonical.threatTier}.`,
    );
    if (
      baseline.combatEffectivenessRating !== canonical.combatEffectivenessRating
      || baseline.offenseRating !== canonical.offenseRating
      || baseline.protectionRating !== canonical.protectionRating
    ) {
      notes.push(
        `Conversion baseline reported OR ${baseline.offenseRating}, PR ${baseline.protectionRating}, `
        + `CER ${baseline.combatEffectivenessRating} (tier ${baseline.threatTier}). The reviewed values come from the `
        + `consumer CER implementation, which rounds damage once after the damage-type multiplier and credits ranged `
        + `accuracy; the conversion baseline ceilinged the damage base first and ignored range.`,
      );
    }
  } else {
    notes.push(
      `CER pinned by review rather than recomputed: OR ${repaired.effectiveness.offenseRating}, `
      + `PR ${repaired.effectiveness.protectionRating}, CER ${repaired.effectiveness.combatEffectivenessRating}, `
      + `threat tier ${repaired.effectiveness.threatTier}. The canonical stats-only path yields `
      + `CER ${canonical.combatEffectivenessRating}.`,
    );
  }

  const pinnedEncounter = applied.some(entry =>
    entry.changes.some(change => change.path.startsWith("encounter.")));
  if (!pinnedEncounter) {
    const derived = deriveEncounter(repaired, repaired.effectiveness.threatTier);
    repaired.encounter = {
      ...repaired.encounter,
      averageNumberAppearing: derived.averageNumberAppearing,
      wanderingWeight: derived.wanderingWeight,
    };
    notes.push(
      `Encounter metadata derived (${derived.basis}): average number appearing `
      + `${derived.averageNumberAppearing}, wandering weight ${derived.wanderingWeight}. `
      + (derived.disabling
        ? "Appearing count capped at 2 because this creature carries a save-or-disable attack that the CER "
          + "path does not price; the rating understates how dangerous a group of them is. "
        : "")
      + ENCOUNTER_DERIVATION_NOTE,
    );
  }

  notes.push(FIELD_POLICY_NOTE);

  repaired.provenance = {
    ...repaired.provenance,
    conversionVersion: REVIEWED_CONVERSION_VERSION,
    conversionNotes: [...repaired.provenance.conversionNotes, ...notes],
  };

  const { flags, mechanics } = recordFlags(repaired, {
    manifestEntry,
    canonical,
    stored: baseRecord.effectiveness,
  });

  if (decision) {
    if (decision.baseRecordSha256 !== baseSha256) {
      throw new Error(
        `Decision for ${baseRecord.id} was recorded against base record ${decision.baseRecordSha256.slice(0, 12)} `
        + `but the local base record hashes to ${baseSha256.slice(0, 12)}. Re-review the record or regenerate the lock.`,
      );
    }
    repaired.provenance.manualReviewStatus = decision.decision;
    repaired.provenance.conversionNotes = [
      ...repaired.provenance.conversionNotes,
      `Review ${decision.decision} by ${decision.reviewer} on ${decision.reviewedOn} (batch ${decision.batch}); `
      + `GCS fidelity check ${decision.checks.gcsFidelity ? "passed" : "not passed"}, `
      + `DOA playability check ${decision.checks.doaPlayability ? "passed" : "not passed"}.`,
      ...(decision.notes ?? []),
    ];
    if (decision.decision === "approved") {
      repaired.provenance.contentLicense = CONTENT_LICENSE;
      repaired.provenance.contentLicenseUrl = CONTENT_LICENSE_URL;
    }
  }

  return {
    record: repaired,
    dossier: {
      id: baseRecord.id,
      name: baseRecord.name,
      baseSha256,
      flags,
      mechanics,
      applied,
      decision,
      manifestEntry,
      baseEffectiveness: baseRecord.effectiveness,
      reviewedEffectiveness: repaired.effectiveness,
      baseEncounter: baseRecord.encounter,
      reviewedEncounter: repaired.encounter,
    },
  };
}

export function buildReviewedPackage(root = ".") {
  const { base, manifestByName, repairs, decisions } = loadInputs(root);
  const dossiers = [];
  const monsters = base.monsters.map(baseRecord => {
    const built = buildRecord(baseRecord, {
      repairs: repairs.get(baseRecord.id) ?? [],
      decision: decisions.get(baseRecord.id) ?? null,
      manifestEntry: manifestByName.get(baseRecord.name) ?? null,
    });
    dossiers.push(built.dossier);
    assertNoLoss(baseRecord, built.record);
    return built.record;
  });

  const knownIds = new Set(base.monsters.map(record => record.id));
  for (const id of repairs.keys()) {
    if (!knownIds.has(id)) throw new Error(`Repair targets unknown record id ${id}.`);
  }
  for (const id of decisions.keys()) {
    if (!knownIds.has(id)) throw new Error(`Review decision targets unknown record id ${id}.`);
  }

  const anyApproved = monsters.some(record => record.provenance.manualReviewStatus === "approved");
  const reviewed = {
    manifest: {
      ...base.manifest,
      version: REVIEWED_CONVERSION_VERSION,
      sources: base.manifest.sources.map(source => (anyApproved
        ? { ...source, contentLicense: CONTENT_LICENSE, contentLicenseUrl: CONTENT_LICENSE_URL }
        : source)),
    },
    monsters,
  };
  return { reviewed, dossiers, base };
}

/**
 * Approval must never quietly drop what the conversion recorded. Provenance keys
 * and conversion notes are append-only through the review pipeline.
 */
export function assertNoLoss(baseRecord, reviewedRecord) {
  for (const key of Object.keys(baseRecord.provenance)) {
    if (!(key in reviewedRecord.provenance)) {
      throw new Error(`Review dropped provenance.${key} from ${baseRecord.id}.`);
    }
  }
  const reviewedNotes = new Set(reviewedRecord.provenance.conversionNotes);
  for (const note of baseRecord.provenance.conversionNotes) {
    if (!reviewedNotes.has(note)) {
      throw new Error(`Review dropped a conversion note from ${baseRecord.id}: ${note}`);
    }
  }
  const reviewedStatNotes = new Set(reviewedRecord.stats.notes ?? []);
  for (const note of baseRecord.stats.notes ?? []) {
    if (!reviewedStatNotes.has(note)) {
      throw new Error(`Review dropped a stat note from ${baseRecord.id}: ${note}`);
    }
  }
  for (const credit of baseRecord.provenance.credits ?? []) {
    const retained = (reviewedRecord.provenance.credits ?? []).some(
      entry => entry.name === credit.name && entry.creditLine === credit.creditLine,
    );
    if (!retained) throw new Error(`Review dropped originator credit for ${credit.name} from ${baseRecord.id}.`);
  }
}

export const FIELD_POLICY_NOTE =
  "Lair, treasure, and grappling remain unpopulated in 0.2.0 by package policy: the authorized fan-conversion "
  + "source states no lair, treasure, or grappling values, and review declines to invent them. See "
  + "review/policy/0.2.0-empty-field-policy.md.";

export function serializePackage(pkg) {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}
