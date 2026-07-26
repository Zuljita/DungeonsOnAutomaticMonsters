// SPDX-License-Identifier: MIT
//
// Exception flags, batch filters, and the deterministic encounter-metadata
// derivation used during package review.
//
// Every flag answers one question: "what would make a reviewer stop on this
// record?" Batches are built from flags so review can proceed in intentionally
// sized, homogeneous passes instead of one 304-record slog.

import { effectivenessFromStats } from "./cer.mjs";

/** Issue #6 priority mechanics, matched against traits, notes, and attacks. */
const SPECIAL_MECHANICS = [
  { id: "insubstantial", label: "Insubstantiality / possession", pattern: /insubstantial|possession|permeation|ethereal/i },
  { id: "unusual_immunity", label: "Unusual immunities", pattern: /\bimmunity\b|\bimmune\b|injury tolerance \(diffuse|unkillable/i },
  { id: "gaze_aura_area", label: "Gaze, aura, engulf, contact, or area attack", pattern: /\bgaze\b|\baura\b|engulf|\bcontact\b|area effect|cone\b|explosion/i },
  { id: "regeneration", label: "Regeneration or extreme durability", pattern: /regeneration|regrowth|unkillable|hard to kill|damage resistance \d{2}/i },
  { id: "save_or_disable", label: "Save-or-disable effect", pattern: /affliction|paraly|petrif|\bpoison\b|terror\b|mind control|\bsleep\b|charm|\bstun\b|binding\b/i },
  { id: "spellcasting_psionics", label: "Spellcasting or psionics", pattern: /\bspell|magery|psionic|telepath|telekin|clairsen|\bESP\b/i },
  { id: "swarm", label: "Swarm", pattern: /\bswarm\b|diffuse\b/i },
  { id: "extreme_mobility", label: "Extreme mobility or reach", pattern: /flight\b|enhanced move|super jump|\bwarp\b|tunneling|constriction attack/i },
];

/**
 * Solitary creature classes: encounter counts stay at one regardless of tier.
 * Class tags are slugified by the conversion, so these are hyphenated forms.
 */
const SOLITARY_CLASS_TAGS = new Set(["dragon", "aberration", "ooze", "plant", "construct", "fungus"]);
const SOLITARY_NAME_PATTERN =
  /dragon|tarrasque|kraken|titan|sphinx|hydra|golem|elemental|whale|worm|nightcrawler|shrieker|swarm/i;
/** Creatures that turn up in numbers when they are weak enough to swarm a party. */
const GREGARIOUS_CLASS_TAGS = new Set([
  "animal",
  "vermin",
  "humanoid",
  "magical-beast",
  "fey",
  "giant",
  "monstrous-humanoid",
]);

/**
 * `stored` is the effectiveness the reviewer is being asked to accept as given —
 * the conversion baseline — not the recomputed block, so `cer_drift` reports
 * records whose published ratings the canonical path disagrees with.
 */
export function recordFlags(record, { manifestEntry, canonical, stored: storedInput } = {}) {
  const flags = [];
  const attacks = record.stats?.attacks ?? [];
  const stored = storedInput ?? record.effectiveness ?? {};
  const computed = canonical ?? effectivenessFromStats(record.stats, record.name);

  if (attacks.length === 0) flags.push("missing_attacks");
  if ((manifestEntry?.reconciliation ?? 0) !== 0) flags.push("reconciliation");
  if ((manifestEntry?.library_cost_mismatches ?? 0) > 0) flags.push("cost_discrepancy");
  if ((manifestEntry?.stats_fields ?? 12) < 12) flags.push("partial_stats");

  const mechanics = specialMechanics(record);
  if (mechanics.length > 0) flags.push("special_mechanics");

  const cer = computed.combatEffectivenessRating;
  if (cer <= 1 || cer >= 100) flags.push("cer_outlier");
  if (
    stored.combatEffectivenessRating !== cer
    || stored.offenseRating !== computed.offenseRating
    || stored.protectionRating !== computed.protectionRating
    || stored.threatTier !== computed.threatTier
  ) {
    flags.push("cer_drift");
  }

  if (flags.length === 0) flags.push("ordinary");
  return { flags, mechanics, canonical: computed };
}

export function specialMechanics(record) {
  const haystack = [
    ...(record.stats?.traits ?? []),
    ...(record.stats?.notes ?? []),
    ...(record.stats?.skills ?? []).map(skill => skill.name),
    ...(record.stats?.attacks ?? []).flatMap(attack => [attack.name, attack.damage, attack.notes]),
  ]
    .filter(Boolean)
    .join(" | ");
  const matched = SPECIAL_MECHANICS.filter(mechanic => mechanic.pattern.test(haystack)).map(mechanic => mechanic.id);
  // Multi-hex bodies are a size property, not a trait string.
  const sizeModifier = Number(record.size?.heightSizeModifier);
  if (Number.isFinite(sizeModifier) && sizeModifier >= 3 && !matched.includes("extreme_mobility")) {
    matched.push("multi_hex_body");
  }
  return matched;
}

export function mechanicLabel(id) {
  return SPECIAL_MECHANICS.find(mechanic => mechanic.id === id)?.label ?? "Multi-hex body";
}

/**
 * Deterministic encounter metadata for the reviewed CER.
 *
 * The fan-conversion source carries no appearing-in-numbers or wandering data,
 * so 0.2.0 derives both from the reviewed threat tier and creature class rather
 * than shipping a placeholder 1 for all 304 records. The rule is stated here and
 * echoed into every record's conversionNotes so it never reads as source data.
 */
export function deriveEncounter(record, threatTier) {
  const tags = new Set([...(record.classTags ?? []), ...(record.tags ?? [])].map(tag => String(tag).toLowerCase()));
  const solitary = SOLITARY_NAME_PATTERN.test(record.name)
    || [...tags].some(tag => SOLITARY_CLASS_TAGS.has(tag));
  const gregarious = !solitary && [...tags].some(tag => GREGARIOUS_CLASS_TAGS.has(tag));

  const byTier = { minor: 4, standard: 2, major: 1, severe: 1 };
  let averageNumberAppearing = byTier[threatTier] ?? 1;
  if (solitary) averageNumberAppearing = 1;
  else if (gregarious && threatTier === "minor") averageNumberAppearing = 6;

  // A creature that can remove a player character from the fight is not fodder,
  // whatever its rating says. The CER path prices damage and durability, not
  // save-or-disable effects, so the correction belongs here — in how many turn
  // up — rather than in a rating that would then no longer equal OR + PR.
  const disabling = hasDisablingAttack(record);
  if (disabling && averageNumberAppearing > 2) averageNumberAppearing = 2;

  // Weaker creatures turn up more often on a wandering roll than apex threats.
  const wanderingWeight = { minor: 4, standard: 3, major: 2, severe: 1 }[threatTier] ?? 1;

  return {
    averageNumberAppearing,
    wanderingWeight,
    disabling,
    basis: solitary ? "solitary" : gregarious ? "gregarious" : "default",
  };
}

/**
 * Does the record carry an attack that can take a character out of the fight?
 * Matched against attacks only: trait lists are full of "Immunity to Poison"
 * style entries that name a disabling effect without granting one.
 */
export function hasDisablingAttack(record) {
  const pattern = /affliction|paraly|petrif|possession|energy drain|attribute penalty|\bterror\b|binding|\bsleep\b|\bstun\b|\bcharm\b|hallucinat/i;
  return (record.stats?.attacks ?? []).some(attack =>
    pattern.test([attack.name, attack.damage, attack.notes].filter(Boolean).join(" ")));
}

export const ENCOUNTER_DERIVATION_NOTE =
  "Encounter metadata derived for 0.2.0 from the reviewed threat tier and creature class "
  + "(appearing: minor 4 / standard 2 / major 1 / severe 1, forced to 1 for solitary classes — including "
  + "swarms, which are a single multi-body creature — and raised to 6 for gregarious minor creatures; "
  + "wandering weight: minor 4 / standard 3 / major 2 / severe 1). The fan-conversion source states no "
  + "appearing-in-numbers or wandering values, so these are derived, not source mechanics.";

export const BATCHES = {
  "missing-attacks": { flag: "missing_attacks", label: "Records with no parsed attacks" },
  reconciliation: { flag: "reconciliation", label: "GCS drafts carrying a source-total reconciliation child" },
  "cost-discrepancy": { flag: "cost_discrepancy", label: "Exact-identity library cost discrepancies" },
  "special-mechanics": { flag: "special_mechanics", label: "Special mechanics needing a CER sanity check" },
  "cer-outlier": { flag: "cer_outlier", label: "CER tails (floor 1 and severe 100+)" },
  "cer-drift": { flag: "cer_drift", label: "Stored ratings disagreeing with the canonical CER path" },
  "partial-stats": { flag: "partial_stats", label: "Incomplete Typical Stats parses" },
  ordinary: { flag: "ordinary", label: "Records with no exception flag" },
};

export function selectBatch(entries, batch) {
  if (!batch || batch === "all") return entries;
  const definition = BATCHES[batch];
  if (!definition) {
    throw new Error(`Unknown batch ${batch}. Known batches: ${["all", ...Object.keys(BATCHES)].join(", ")}`);
  }
  return entries.filter(entry => entry.flags.includes(definition.flag));
}
