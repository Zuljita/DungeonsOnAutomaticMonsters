// SPDX-License-Identifier: MIT
//
// Minimal in-memory package fixtures. The real 304-record conversion queue is
// deliberately untracked (see .gitignore), so the test suite must not depend on
// it: these fixtures let `npm test` cover approval-state generation and package
// promotion on a clean checkout.

export const CREDIT = {
  name: "Fixture Author",
  role: "originator",
  scope: ["gurps_conversion", "monster_mechanics"],
  sourceTitle: "Fixture Monsters",
  sourceVersion: "2024-05-11",
  creditLine: "Original GURPS conversion by Fixture Author; adapted and republished with permission.",
  url: "https://example.invalid/permission",
};

export function fixtureRecord(overrides = {}) {
  return {
    id: "fixture_biter",
    name: "Fixture Biter",
    pageRef: "Fixture Biter [Fixture Manual, page 1]",
    class: "Animal",
    classTags: ["animal"],
    tags: ["fan-authorized", "animal"],
    iq: 4,
    appearance: "1",
    lair: null,
    treasure: {
      money: null,
      items: null,
      strategy: null,
      change: null,
      estimatedMoneyAverage: null,
      estimatedItemAverage: null,
      estimatedMoneyPerAppearance: null,
    },
    size: { modifier: "+0", heightSizeModifier: 0, hexes: "1 hex", heightHexes: null, lengthHexes: null, widthHexes: null },
    grappling: { skill: null, damage: null, controlMaximum: null },
    effectiveness: {
      offenseRating: 99,
      protectionRating: -99,
      combatEffectivenessRating: 1,
      treasureAdjustedCombatEffectiveness: null,
      wanderingCombatEffectiveness: null,
      threatTier: "minor",
    },
    encounter: { averageNumberAppearing: 1, treasureMultiplier: null, wanderingWeight: 1, lightSensitive: null },
    stats: {
      attributes: { st: 12, dx: 12, iq: 4, ht: 12, hp: 14, will: 10, per: 12, fp: 12, speed: 6, move: 7, dodge: 9, dr: 2 },
      attacks: [{ name: "Bite", skill: 13, damage: "1d+1 cutting", reach: "C", notes: "Bite (13): 1d+1 cutting, Reach C." }],
      traits: ["Combat Reflexes"],
      skills: [{ name: "Brawling", level: 13 }],
      notes: ["Source note retained from the conversion."],
    },
    provenance: {
      kind: "fan_authorized",
      sourceSystem: "gurps_4e_fan_conversion",
      sourceLicense: "author_permission",
      sourceMonsterId: "fixture-biter",
      sourceName: "Fixture Biter [Fixture Manual, page 1]",
      sourceUrl: "https://example.invalid/permission",
      sourceCopyrightNotice: "Fixture conversions; used with permission.",
      conversionVersion: "0.2.0-library-rebuild-draft",
      conversionNotes: ["GCS ancestry draft: gcs/fixture-biter.gct", "Source template total: 10 points."],
      manualReviewStatus: "review_required",
      packageSourceId: "fixture_author_permission",
      license: "Unrestricted author permission; attribution retained.",
      url: "https://example.invalid/permission",
      originalId: "fixture-biter",
      publicStats: true,
      notes: "Authorized for publication; mechanical review remains required.",
      credits: [CREDIT],
    },
    sourceBook: "fixture_monsters",
    sourceBooks: ["fixture_monsters"],
    source: { workbook: "Fixture Monsters", sheet: "fixture", row: 1 },
    ...overrides,
  };
}

export function fixturePackage(monsters = [fixtureRecord()]) {
  return {
    manifest: {
      id: "fixture-monsters-review-required",
      name: "Fixture Monsters (Review Required)",
      version: "0.2.0-library-rebuild-draft",
      sourceBook: { id: "fixture_monsters", name: "Fixture Monsters", required: false, derived: true },
      licenseSummary: "Fixture package for tests.",
      packageUrl: null,
      dataUrl: null,
      credits: [CREDIT],
      sources: [{
        id: "fixture_author_permission",
        name: "Fixture Monsters",
        sourceSystem: "gurps_4e_fan_conversion",
        sourceLicense: "author_permission",
        sourceUrl: "https://example.invalid/permission",
        sourceCopyrightNotice: "Fixture conversions; used with permission.",
        credits: [CREDIT],
      }],
    },
    monsters,
  };
}

export function fixtureManifestEntry(overrides = {}) {
  return {
    name: "Fixture Biter",
    editions: ["srd-3-5"],
    points: 10,
    rebuilt_points: 10,
    gct: "gcs/fixture-biter.gct",
    stats_fields: 12,
    attacks: 1,
    reconciliation: 0,
    library_matches: 3,
    library_exact_cost_matches: 3,
    library_cost_mismatches: 0,
    library_adjustment: 0,
    unmatched_traits: 0,
    skills: 1,
    native_skill_matches: 1,
    ...overrides,
  };
}

export function fixtureDecision(baseRecordSha256, overrides = {}) {
  return {
    recordId: "fixture_biter",
    monster: "Fixture Biter",
    decision: "approved",
    reviewer: "fixture-reviewer",
    reviewedOn: "2026-07-26",
    batch: "fixture-batch",
    baseRecordSha256,
    checks: { gcsFidelity: true, doaPlayability: true, gcsVisualPass: false },
    flags: ["ordinary"],
    notes: ["Fixture approval."],
    ...overrides,
  };
}
