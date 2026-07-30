// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import {
  cerFromOrPr,
  combatProfileFromStats,
  effectivenessFromStats,
  parseDamageExpression,
  pickBestAffliction,
  threatTierFromCer,
} from "../review/cer.mjs";
import { applyRepairs, getPath, setPath, validateRepairFile } from "../review/repairs.mjs";
import { recordHash, validateEntry, effectiveDecisions } from "../review/ledger.mjs";
import { buildRecord, assertNoLoss, CONTENT_LICENSE } from "../review/build-candidate.mjs";
import { checkDeferredPolicy, checkFieldShape } from "../review/field-policy.mjs";
import {
  deriveEncounter,
  hasDisablingAttack,
  hasUnratedDisablingAttack,
  recordFlags,
  selectBatch,
} from "../review/queue.mjs";
import { validatePackage } from "../package-validation.mjs";
import { fixtureDecision, fixtureManifestEntry, fixturePackage, fixtureRecord } from "./fixtures.mjs";

test("CER: damage rounds once after the damage-type multiplier", () => {
  // 3d impaling: 10.5 x 2 = 21. Ceilinging the base first would give 22, which
  // is the conversion baseline this review replaced.
  const stats = {
    attributes: { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 },
    attacks: [{ name: "Gore", skill: 10, damage: "3d impaling", reach: "C" }],
    traits: [],
  };
  assert.equal(effectivenessFromStats(stats, "test").offenseRating, 21);
});

test("CER: an auto-hit hazard with no attack roll scores the auto-hit credit", () => {
  const stats = {
    attributes: { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 },
    attacks: [{ name: "Acid Aura", skill: null, damage: "1d-1 corrosion", reach: "C", autoHit: true }],
    traits: [],
  };
  // 1d-1 corrosion: 2.5 x 2 = 5, plus the 15-point auto-hit credit.
  assert.equal(effectivenessFromStats(stats, "test").offenseRating, 20);
});

test("CER: an entry with no skill, no damage and no auto-hit contributes nothing", () => {
  const stats = {
    attributes: { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 },
    attacks: [{ name: "Shriek", skill: null, damage: null, reach: null, autoHit: false }],
    traits: [],
  };
  assert.equal(effectivenessFromStats(stats, "test").offenseRating, 0);
});

test("CER: an attack that costs fatigue contributes half its damage", () => {
  // The flag is documented in review/README.md as a rating input an attack may
  // carry, and damageContribution has always implemented the halving — but the
  // profile builder did not forward it, so the handling was dead code and a
  // breath weapon rated as though it were used every second.
  const base = { attributes: { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 }, traits: [] };
  const free = effectivenessFromStats({ ...base, attacks: [{ name: "Breath", skill: 12, damage: "6d burning", reach: "C" }] });
  const costly = effectivenessFromStats({
    ...base,
    attacks: [{ name: "Breath", skill: 12, damage: "6d burning", reach: "C", usesFatigueOrSpell: true }],
  });
  // 6d burning scores 21; the fatigue cost halves the damage term to 11 and
  // touches nothing else, so the two offense ratings differ by 10.
  assert.equal(free.breakdown.offense.find(part => part.id === "damage").value, 21);
  assert.equal(costly.breakdown.offense.find(part => part.id === "damage").value, 11);
  assert.equal(free.offenseRating - costly.offenseRating, 10);
});

test("CER: every rating input damageContribution reads is forwarded by the profile builder", () => {
  // A regression guard for the whole class rather than the one field: if a new
  // input is read downstream and not forwarded, this fails instead of silently
  // doing nothing.
  const attack = {
    name: "Everything",
    skill: 12,
    damage: "2d cutting",
    reach: "C",
    autoHit: true,
    cyclesWithin15Seconds: 3,
    usesFatigueOrSpell: true,
  };
  const profile = combatProfileFromStats(
    { attributes: { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 }, attacks: [attack], traits: [] },
    "guard",
  );
  for (const field of ["autoHit", "cyclesWithin15Seconds", "usesFatigueOrSpell"]) {
    assert.equal(profile.attack[field], attack[field], `${field} must reach the profile`);
  }
});

test("CER: ranged reach earns the accuracy credit", () => {
  const base = { attributes: { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 }, traits: [] };
  const melee = effectivenessFromStats({ ...base, attacks: [{ name: "Ray", skill: 12, damage: "1d burning", reach: "C" }] });
  const ranged = effectivenessFromStats({ ...base, attacks: [{ name: "Ray", skill: 12, damage: "1d burning", reach: "100/200" }] });
  assert.equal(ranged.offenseRating - melee.offenseRating, 2);
});

test("CER: a save-or-disable hazard rates even when it does no damage", () => {
  // A petrifying gaze is never a creature's best damage roll — it has none. The
  // affliction term is scored separately so it still counts.
  const attributes = { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 };
  const withoutGaze = effectivenessFromStats({
    attributes,
    attacks: [{ name: "Bite", skill: 10, damage: "1d cutting", reach: "C" }],
    traits: [],
  });
  const withGaze = effectivenessFromStats({
    attributes,
    attacks: [
      { name: "Bite", skill: 10, damage: "1d cutting", reach: "C" },
      { name: "Petrifying Gaze", skill: null, damage: null, reach: "Cone 15", afflictionPoints: 76 },
    ],
    traits: [],
  });
  // 76 points / 5, rounded up.
  assert.equal(withGaze.offenseRating - withoutGaze.offenseRating, 16);
  // The damage term is untouched: the gaze did not become the "best attack".
  assert.equal(withGaze.protectionRating, withoutGaze.protectionRating);
});

test("CER: a Binding is priced by its ST, and never also by its point cost", () => {
  const attributes = { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 };
  const engulf = { name: "Engulf", skill: null, damage: null, reach: "C", bindingSt: 24, afflictionPoints: 159 };
  const profile = combatProfileFromStats({ attributes, attacks: [engulf], traits: [] });
  assert.equal(profile.affliction.bindingSt, 24);
  // Point cost is dropped, not added to the ST: 159/5 + 24 would be 56.
  assert.equal(profile.affliction.abilityPoints, 0);
  // The whole offense rating is the binding: no skill, no damage, FP and Move at baseline.
  assert.equal(effectivenessFromStats({ attributes, attacks: [engulf], traits: [] }).offenseRating, 24);
});

test("CER: the strongest disabling ability is the one that scores", () => {
  const attacks = [
    { name: "Punch", skill: 10, damage: "1d-2 crushing", reach: "C" },
    { name: "Babble", skill: null, damage: null, reach: null, afflictionPoints: 21 },
    { name: "Touch of Insanity", skill: null, damage: null, reach: "C", afflictionPoints: 48 },
  ];
  assert.equal(pickBestAffliction(attacks).name, "Touch of Insanity");
  assert.equal(pickBestAffliction([]), null);
  assert.equal(pickBestAffliction([{ name: "Punch", skill: 10, damage: "1d" }]), null);
});

test("CER: an ability that costs fatigue contributes half", () => {
  const attributes = { ht: 10, hp: 10, will: 10, fp: 10, move: 6, dodge: 8, dr: 0 };
  const base = { name: "Roar", skill: null, damage: null, reach: "8 yards", afflictionPoints: 40 };
  const free = effectivenessFromStats({ attributes, attacks: [base], traits: [] }).offenseRating;
  const costly = effectivenessFromStats({
    attributes,
    attacks: [{ ...base, usesFatigueOrSpell: true }],
    traits: [],
  }).offenseRating;
  assert.equal(free - costly, 4);
});

test("CER: floors at 1 and bands the threat tier", () => {
  assert.equal(cerFromOrPr(-40, -20), 1);
  assert.equal(threatTierFromCer(99), "major");
  assert.equal(threatTierFromCer(100), "severe");
  assert.equal(threatTierFromCer(24), "minor");
  assert.equal(parseDamageExpression("thrust 2d+1 crushing").damageDice, 2);
});

test("repairs: dotted paths read and write nested values", () => {
  const target = { stats: { attacks: [] } };
  setPath(target, "stats.attacks", [{ name: "Bite" }]);
  setPath(target, "encounter.averageNumberAppearing", 3);
  assert.equal(getPath(target, "stats.attacks")[0].name, "Bite");
  assert.equal(getPath(target, "encounter.averageNumberAppearing"), 3);
  assert.equal(getPath(target, "missing.deeply.nested"), undefined);
});

test("repairs: a repair that changes nothing or explains nothing is rejected", () => {
  assert.equal(validateRepairFile({ version: 1, issue: 5, title: "t", repairs: [
    { recordId: "a", rationale: "why", set: { "stats.attacks": [] } },
  ] }, "f.json").length, 0);
  assert.ok(validateRepairFile({ version: 1, issue: 5, title: "t", repairs: [
    { recordId: "a", rationale: "why" },
  ] }, "f.json").some(error => /must change something/.test(error)));
  assert.ok(validateRepairFile({ version: 1, issue: 5, title: "t", repairs: [
    { recordId: "a", set: { x: 1 } },
  ] }, "f.json").some(error => /rationale/.test(error)));
});

test("repairs: application records what each repair changed", () => {
  const { record, applied } = applyRepairs(fixtureRecord(), [{
    recordId: "fixture_biter",
    issue: 5,
    sourceFile: "001.json",
    rationale: "restore the hazard",
    set: { "stats.attacks": [{ name: "Aura", skill: null, damage: "1d burning", reach: "C", autoHit: true, notes: "n" }] },
    appendConversionNotes: ["restored"],
  }]);
  assert.equal(record.stats.attacks[0].name, "Aura");
  assert.equal(applied[0].changes[0].path, "stats.attacks");
  assert.equal(applied[0].changes[0].before[0].name, "Bite");
  assert.ok(record.provenance.conversionNotes.includes("restored"));
});

test("ledger: an approval must assert both required gates", () => {
  const hash = recordHash(fixtureRecord());
  assert.equal(validateEntry(fixtureDecision(hash)).length, 0);
  assert.ok(validateEntry(fixtureDecision(hash, { checks: { gcsFidelity: false, doaPlayability: true } }))
    .some(error => /require checks\.gcsFidelity/.test(error)));
  assert.ok(validateEntry(fixtureDecision(hash, { decision: "maybe" })).some(error => /decision must be/.test(error)));
  assert.ok(validateEntry(fixtureDecision("not-a-hash")).some(error => /baseRecordSha256/.test(error)));
  assert.ok(validateEntry(fixtureDecision(hash, {
    checks: { gcsFidelity: true, doaPlayability: true, madeItUp: true },
  })).some(error => /not a known review gate/.test(error)));
});

test("ledger: hashes ignore key order and the last decision per record wins", () => {
  const record = fixtureRecord();
  const reordered = JSON.parse(JSON.stringify({ name: record.name, ...record }));
  assert.equal(recordHash(record), recordHash(reordered));

  const hash = recordHash(record);
  const effective = effectiveDecisions([
    fixtureDecision(hash, { decision: "review_required", batch: "first" }),
    fixtureDecision(hash, { decision: "approved", batch: "second" }),
  ]);
  assert.equal(effective.get("fixture_biter").decision, "approved");
  assert.equal(effective.get("fixture_biter").batch, "second");
});

test("approval state: an approved decision sets the status and the content license", () => {
  const base = fixtureRecord();
  const { record } = buildRecord(base, {
    decision: fixtureDecision(recordHash(base)),
    manifestEntry: fixtureManifestEntry(),
  });
  assert.equal(record.provenance.manualReviewStatus, "approved");
  assert.equal(record.provenance.contentLicense, CONTENT_LICENSE);
  assert.ok(record.provenance.contentLicenseUrl.length > 0);
  assert.ok(record.provenance.conversionNotes.some(note => /Review approved by fixture-reviewer/.test(note)));
});

test("approval state: ratings are recomputed, not taken from the conversion baseline", () => {
  const base = fixtureRecord();
  const { record } = buildRecord(base, { manifestEntry: fixtureManifestEntry() });
  // The fixture ships a deliberately wrong 99 / -99 baseline.
  assert.notEqual(record.effectiveness.offenseRating, 99);
  assert.equal(
    record.effectiveness.combatEffectivenessRating,
    cerFromOrPr(record.effectiveness.offenseRating, record.effectiveness.protectionRating),
  );
  assert.ok(record.provenance.conversionNotes.some(note => /Conversion baseline reported/.test(note)));
});

test("approval state: a decision made against a different base record is refused", () => {
  const base = fixtureRecord();
  const stale = fixtureDecision("0".repeat(64));
  assert.throws(
    () => buildRecord(base, { decision: stale, manifestEntry: fixtureManifestEntry() }),
    /was recorded against base record/,
  );
});

test("approval state: no record is left without a review status the promotion gate can read", () => {
  const base = fixtureRecord();
  const { record } = buildRecord(base, { manifestEntry: fixtureManifestEntry() });
  assert.equal(record.provenance.manualReviewStatus, "review_required");
});

test("no silent loss: conversion notes, stat notes and originator credit survive approval", () => {
  const base = fixtureRecord();
  const { record } = buildRecord(base, { decision: fixtureDecision(recordHash(base)) });
  assert.doesNotThrow(() => assertNoLoss(base, record));
  for (const note of base.provenance.conversionNotes) {
    assert.ok(record.provenance.conversionNotes.includes(note));
  }

  const stripped = structuredClone(record);
  stripped.provenance.conversionNotes = ["only the new ones"];
  assert.throws(() => assertNoLoss(base, stripped), /dropped a conversion note/);

  const uncredited = structuredClone(record);
  uncredited.provenance.credits = [];
  assert.throws(() => assertNoLoss(base, uncredited), /dropped originator credit/);

  const noProvenanceKey = structuredClone(record);
  delete noProvenanceKey.provenance.sourceCopyrightNotice;
  assert.throws(() => assertNoLoss(base, noProvenanceKey), /dropped provenance\.sourceCopyrightNotice/);
});

test("promotion gate: the public validator refuses a record that is not approved", () => {
  const pkg = fixturePackage();
  assert.equal(validatePackage(pkg, { allowUnapproved: true }).length, 0);
  const errors = validatePackage(pkg);
  assert.ok(errors.some(error => /manualReviewStatus must be approved/.test(error)));
});

test("promotion gate: an approved record must carry a content license matching its source", () => {
  const approved = fixtureRecord();
  approved.provenance.manualReviewStatus = "approved";
  const pkg = fixturePackage([approved]);
  assert.ok(validatePackage(pkg).some(error => /contentLicense/.test(error)));

  approved.provenance.contentLicense = "cc_by_4_0";
  approved.provenance.contentLicenseUrl = "https://example.invalid/cc-by";
  const withSource = fixturePackage([approved]);
  withSource.manifest.sources[0].contentLicense = "cc_by_4_0";
  withSource.manifest.sources[0].contentLicenseUrl = "https://example.invalid/cc-by";
  assert.equal(validatePackage(withSource).length, 0);
});

test("field policy: the deferred families keep their key set and stay null", () => {
  const record = fixtureRecord();
  assert.equal(checkFieldShape(record).length, 0);
  assert.equal(checkDeferredPolicy(record).length, 0);

  const invented = structuredClone(record);
  invented.treasure.money = "2d x $100";
  assert.ok(checkDeferredPolicy(invented).some(error => /must be null/.test(error)));

  const truncated = structuredClone(record);
  delete truncated.grappling.controlMaximum;
  assert.ok(checkFieldShape(truncated).some(error => /grappling\.controlMaximum must be present/.test(error)));

  const extended = structuredClone(record);
  extended.treasure.hoardSize = null;
  assert.ok(checkFieldShape(extended).some(error => /not part of the field contract/.test(error)));
});

test("queue: flags surface the exceptions a reviewer must not skip", () => {
  const missingAttacks = fixtureRecord();
  missingAttacks.stats.attacks = [];
  assert.ok(recordFlags(missingAttacks, { manifestEntry: fixtureManifestEntry() }).flags.includes("missing_attacks"));

  const reconciled = fixtureRecord();
  const flags = recordFlags(reconciled, {
    manifestEntry: fixtureManifestEntry({ reconciliation: 15, library_cost_mismatches: 2, stats_fields: 10 }),
  }).flags;
  assert.ok(flags.includes("reconciliation"));
  assert.ok(flags.includes("cost_discrepancy"));
  assert.ok(flags.includes("partial_stats"));

  // The fixture ships a deliberately wrong baseline, so drift must be flagged.
  assert.ok(recordFlags(fixtureRecord(), { manifestEntry: fixtureManifestEntry() }).flags.includes("cer_drift"));
});

test("queue: batches select only their own flag and reject unknown names", () => {
  const entries = [
    { id: "a", flags: ["ordinary"] },
    { id: "b", flags: ["reconciliation", "cer_outlier"] },
  ];
  assert.deepEqual(selectBatch(entries, "reconciliation").map(entry => entry.id), ["b"]);
  assert.deepEqual(selectBatch(entries, "all").map(entry => entry.id), ["a", "b"]);
  assert.throws(() => selectBatch(entries, "nope"), /Unknown batch/);
});

test("encounter derivation: swarms are single creatures and disabling attackers come in twos", () => {
  const swarm = fixtureRecord({ name: "Fixture Swarm" });
  assert.equal(deriveEncounter(swarm, "minor").averageNumberAppearing, 1);

  const beast = fixtureRecord();
  assert.equal(deriveEncounter(beast, "minor").averageNumberAppearing, 6);
  assert.equal(deriveEncounter(beast, "severe").averageNumberAppearing, 1);
  assert.equal(deriveEncounter(beast, "minor").wanderingWeight, 4);
  assert.equal(deriveEncounter(beast, "severe").wanderingWeight, 1);

  const petrifier = fixtureRecord();
  petrifier.stats.attacks = [{ name: "Petrification", skill: null, damage: null, reach: "C", notes: "Affliction 1 (HT), paralysis variant." }];
  assert.equal(hasDisablingAttack(petrifier), true);
  assert.equal(hasUnratedDisablingAttack(petrifier), true);
  assert.equal(deriveEncounter(petrifier, "minor").averageNumberAppearing, 2);
});

test("encounter derivation: the cap lifts once the rating can see the ability", () => {
  // The appearing-count cap compensates for an ability the rating cannot price.
  // Once the affliction term scores it, the compensation is no longer warranted.
  const rated = fixtureRecord();
  rated.stats.attacks = [{
    name: "Petrification",
    skill: null,
    damage: null,
    reach: "C",
    afflictionPoints: 56,
    notes: "Affliction 1 (HT), paralysis variant.",
  }];
  assert.equal(hasDisablingAttack(rated), true);
  assert.equal(hasUnratedDisablingAttack(rated), false);
  assert.equal(deriveEncounter(rated, "minor").averageNumberAppearing, 6);
});

test("encounter derivation: an immunity trait is not mistaken for a disabling attack", () => {
  const immune = fixtureRecord();
  immune.stats.traits = ["Immunity to Poison", "Immunity to Mind Control"];
  assert.equal(hasDisablingAttack(immune), false);
});
