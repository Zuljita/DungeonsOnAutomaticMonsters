// SPDX-License-Identifier: MIT
//
// Build a ready-to-open GCS v5 character sheet (.gcs) for every reviewed monster.
//
//   node scripts/build-gcs-sheets.mjs
//   node scripts/build-gcs-sheets.mjs --check
//
// The .gct ancestry template is the input, not a parallel construction: its trait
// container already carries every attribute modifier, advantage and disadvantage,
// cost-reconciled against the native GCS libraries by the issue #4 adjudication.
//
// The ancestry alone is not the monster, though. The source states two different
// things per creature: the racial modifiers (what the ancestry *is*) and a
// Typical Stats block (what a typical individual *has*). A typical troglodyte
// buys ST and DX up and IQ down on top of an ancestry that modifies neither.
// Dropping the container in and leaving every adjustment at zero therefore
// produces a bare ancestry — a Balor at DX 11 instead of 13 — not a monster.
//
// So each attribute carries the difference between the reviewed package and what
// the ancestry alone derives: `adj = package - ancestry`. That is the individual's
// own point spend, and it double-counts nothing. The ancestry side of that
// subtraction is `gcs-ancestry-baseline.json`, which GCS computes (see
// --baseline below); everything downstream is plain arithmetic, so the ordinary
// build needs no GCS install.
//
// Attributes the package leaves null are left alone rather than driven to zero.
// FP is the case that matters: the 25 unliving records state no FP, and writing
// FP 0 would put them below the one-third threshold where GURPS halves Move,
// Dodge and Basic Lift — turning "does not fatigue" into "permanently exhausted".
//
// Natural attacks become melee weapons on the ancestry trait, which is where GCS
// expects a creature's built-in attacks to live. Hazards that allow no attack
// roll — acid auras, engulf, petrification — have no weapon equivalent, so they
// are written into the sheet notes with their resolution intact rather than
// forced into a weapon row that would imply a roll that does not exist.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REVIEWED_PATH } from "./review/build-candidate.mjs";
import { convertInPlace } from "./gcs-cli.mjs";
import { bodyPlan } from "./body-plan.mjs";

const GCT_DIR = "converted/enraged-eggplant/gcs";
const OUT_DIR = "converted/enraged-eggplant/gcs-sheets";
const SETTINGS_PATH = "schema/gcs-monster-settings.json";
const BASELINE_PATH = "converted/enraged-eggplant/gcs-ancestry-baseline.json";
const THUMB_DIR = "art/enraged-eggplant/thumbs";
const BODY_TYPES_PATH = "schema/gcs-body-types.json";

const check = process.argv.includes("--check");
const baselineMode = process.argv.includes("--baseline");
const pkg = JSON.parse(readFileSync(REVIEWED_PATH, "utf8"));
const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
const bodyTypes = JSON.parse(readFileSync(BODY_TYPES_PATH, "utf8")).types;

/** GCS ids are 17 characters; derive them so a rebuild is byte-identical. */
function stableId(...parts) {
  const digest = createHash("sha256").update(parts.join("|")).digest("base64url");
  return `A${digest.slice(0, 16)}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

const DAMAGE_TYPES = [
  [/\bhuge piercing|\bpi\+\+/i, "pi++"],
  [/\blarge piercing|\bpi\+/i, "pi+"],
  [/\bsmall piercing|\bpi-/i, "pi-"],
  [/\bimpaling|\bimp\b/i, "imp"],
  [/\bcorrosion|\bcor\b/i, "cor"],
  [/\bfatigue|\bfat\b/i, "fat"],
  [/\bcutting|\bcut\b/i, "cut"],
  [/\bpiercing|\bpi\b/i, "pi"],
  [/\bburning|\bburn\b/i, "burn"],
  [/\btoxic|\btox\b/i, "tox"],
  [/\bcrushing|\bcr\b/i, "cr"],
];

/**
 * Our damage is prose carrying an absolute dice expression already resolved from
 * the creature's ST ("thrust 3d-1 crushing"), not a thr/sw-relative one, so the
 * dice go into `base` and no `st` component is emitted.
 */
export function gcsDamage(raw) {
  if (!raw) return { type: "cr" };
  const text = String(raw);
  const dice = text.match(/(\d+d(?:[+-]\d+)?)/i);
  const flat = dice ? null : text.match(/^(\d+)\s*points?\b/i);
  const type = (DAMAGE_TYPES.find(([pattern]) => pattern.test(text)) ?? [null, "cr"])[1];
  const damage = { type };
  if (dice) damage.base = dice[1].toLowerCase();
  else if (flat) damage.base = flat[1];
  return damage;
}

export function meleeWeapon(attack, recordId) {
  // A default of type "10" against the stated level reproduces the creature's
  // effective skill without inventing a skill it does not have.
  const skill = typeof attack.skill === "number" ? attack.skill : null;
  const weapon = {
    id: stableId(recordId, "weapon", attack.name),
    damage: gcsDamage(attack.damage),
    usage: attack.name,
  };
  if (attack.reach) weapon.reach = attack.reach;
  if (skill !== null) weapon.defaults = [{ type: "10", modifier: skill - 10 }];
  // attack.notes already restates the damage; do not print it twice.
  if (attack.notes) weapon.usage_notes = attack.notes;
  return weapon;
}

/**
 * Attributes GCS derives from another attribute, and the primary they follow.
 * Adjusting a primary moves its dependants with it, so a dependant's own
 * adjustment is measured against the already-shifted base.
 */
const DERIVED_FROM = { hp: "st", will: "iq", per: "iq", fp: "ht" };

/**
 * `adj` values reproducing the reviewed package's Typical Stats on top of the
 * ancestry. `basic_move` is deliberately absent: the package's `move` is the
 * creature's stated ground or flight Move, which is not GURPS Basic Move, so
 * writing it here would state something the source never claimed.
 *
 * @param {object} record reviewed package record
 * @param {Record<string, number>} baseline ancestry-derived values for this record
 */
export function attributeAdjustments(record, baseline) {
  const want = record.stats?.attributes ?? {};
  const adjustments = {};
  const shift = id => adjustments[id] ?? 0;

  for (const id of ["st", "dx", "iq", "ht"]) {
    if (want[id] == null || baseline[id] == null) continue;
    adjustments[id] = want[id] - baseline[id];
  }
  for (const [id, primary] of Object.entries(DERIVED_FROM)) {
    if (want[id] == null || baseline[id] == null) continue;
    adjustments[id] = want[id] - (baseline[id] + shift(primary));
  }
  if (want.speed != null && baseline.basic_speed != null) {
    adjustments.basic_speed = want.speed - (baseline.basic_speed + (shift("dx") + shift("ht")) / 4);
  }
  return adjustments;
}

/**
 * Traits the typical individual buys that the ancestry does not grant.
 *
 * The source lists these separately — a costed `Advantages:` block for the
 * ancestry, an uncosted `Traits:` line inside Typical Stats for the individual —
 * and only the second contains, say, the Astral Deva's Combat Reflexes.
 *
 * Scope is deliberately narrow. Most names present in one list and absent from
 * the other are already in the ancestry under a grouped construction's own name
 * ("Fire Resistance" containing "Immunity to Noxious Fire Effects"), so adding
 * them wholesale would double-count. Only traits that change a value GCS
 * computes, and that we can emit as an exact native library record, are added.
 */
const INDIVIDUAL_TRAITS = {
  "combat reflexes": {
    name: "Combat Reflexes",
    reference: "B43",
    tags: ["Advantage", "Mental"],
    base_points: 15,
    features: [
      { type: "skill_bonus", selection_type: "skills_with_name", name: { compare: "starts_with", qualifier: "fast-draw" }, amount: 1 },
      { type: "attribute_bonus", attribute: "dodge", amount: 1 },
      { type: "attribute_bonus", attribute: "parry", amount: 1 },
      { type: "attribute_bonus", attribute: "block", amount: 1 },
      { type: "attribute_bonus", attribute: "fright_check", amount: 2 },
    ],
  },
};

const traitKey = name => String(name).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

/** @returns {object[]} native records for individual traits the ancestry lacks */
export function individualTraits(record, ancestry) {
  const granted = new Set();
  (function walk(nodes) {
    for (const node of nodes ?? []) {
      granted.add(traitKey(node.name));
      walk(node.children);
    }
  })([ancestry]);

  const added = [];
  for (const stated of record.stats?.traits ?? []) {
    const key = traitKey(stated);
    const known = INDIVIDUAL_TRAITS[key];
    if (!known || granted.has(key)) continue;
    granted.add(key);
    added.push({
      ...structuredClone(known),
      id: stableId(record.id, "individual", known.name),
      local_notes: "Bought by the typical individual: stated in the source's Typical Stats traits, "
        + "not granted by the racial template.",
    });
  }
  return added;
}

function sheetFor(record, template, baseline) {
  const ancestry = structuredClone(template.traits[0]);
  const attacks = (record.stats?.attacks ?? []).filter(Boolean);
  // Only attacks resolved by a roll become weapons; the rest keep their prose.
  const rollable = attacks.filter(attack => typeof attack.skill === "number");
  const hazards = attacks.filter(attack => typeof attack.skill !== "number");
  if (rollable.length > 0) {
    ancestry.melee_weapons = rollable.map(attack => meleeWeapon(attack, record.id));
  }

  // A null baseline is the ancestry-only pass that produces the baseline itself.
  const adjustments = baseline ? attributeAdjustments(record, baseline) : {};
  const attributes = settings.attributes.map(def => ({ attr_id: def.id, adj: adjustments[def.id] ?? 0 }));
  const bought = baseline ? individualTraits(record, ancestry) : [];

  const skills = (record.stats?.skills ?? []).filter(Boolean).map(skill => ({
    id: stableId(record.id, "skill", skill.name),
    name: skill.name,
    difficulty: "dx/a",
    points: 1,
    // The source states levels, not points. Record the stated level so a GM can
    // see it even though GCS will recompute from points and attributes.
    local_notes: `Stated level ${skill.level} in the source conversion.`,
  }));

  const attrs = record.stats?.attributes ?? {};
  const typical = ["st", "dx", "iq", "ht", "hp", "will", "per", "fp", "speed", "move", "dodge", "dr"]
    .map(key => `${key.toUpperCase()} ${attrs[key] ?? "—"}`)
    .join(", ");

  const notes = [
    {
      id: stableId(record.id, "note", "typical"),
      text: `Typical Stats from the reviewed package: ${typical}. GCS derives its own values by applying the `
        + `ancestry; where the two differ, the package's Typical Stats are what the Dungeons on Automatic `
        + `encounter tables use.`,
    },
    {
      id: stableId(record.id, "note", "rating"),
      text: `Encounter rating: CER ${record.effectiveness.combatEffectivenessRating} `
        + `(offense ${record.effectiveness.offenseRating}, protection ${record.effectiveness.protectionRating}), `
        + `threat tier ${record.effectiveness.threatTier}, appearing ${record.encounter.averageNumberAppearing}.`,
    },
  ];
  for (const hazard of hazards) {
    notes.push({
      id: stableId(record.id, "note", hazard.name),
      text: `${hazard.name}${hazard.damage ? ` (${hazard.damage})` : ""}${hazard.reach ? `, reach ${hazard.reach}` : ""}: `
        + `${hazard.autoHit ? "No attack roll and no active defense. " : ""}${hazard.notes ?? ""}`,
    });
  }
  for (const note of record.stats?.notes ?? []) {
    notes.push({ id: stableId(record.id, "statnote", note.slice(0, 40)), text: note });
  }
  notes.push({
    id: stableId(record.id, "note", "credit"),
    text: (record.provenance.credits ?? []).map(credit => credit.creditLine).join(" ")
      || record.provenance.sourceCopyrightNotice,
  });

  const profile = {
    name: record.name,
    title: record.class ?? "Monster",
    player_name: "Dungeons on Automatic",
    SM: Number(record.size?.heightSizeModifier) || 0,
  };
  // GCS stores the portrait inside the sheet, so an exported monster carries its
  // own art. The 420px web thumbnail is the right source: GCS renders the
  // portrait small, and the full-resolution PNG would inflate every sheet from
  // ~50 KB to ~3.5 MB for no visible gain.
  // The thumbnails are generated rather than tracked, so a missing one is a
  // build-order problem, not an optional extra: silently omitting the portrait
  // produces a sheet that differs from the committed one and reports itself as
  // merely "stale", which sends the next person looking in the wrong place.
  if (baseline) {
    const thumb = join(THUMB_DIR, `${record.id}.webp`);
    if (!existsSync(thumb)) {
      throw new Error(
        `${record.id}: no portrait thumbnail at ${thumb}. Run: npm run art:thumbnails`,
      );
    }
    profile.portrait = readFileSync(thumb).toString("base64");
  }

  // The shared settings block carries a Humanoid body type; every creature that
  // is not one needs its own, or GCS renders a naga with arms and legs.
  const plan = bodyPlan(record);
  const bodyType = bodyTypes[plan];
  if (!bodyType) throw new Error(`${record.id}: no GCS body type for body plan ${JSON.stringify(plan)}`);

  return {
    version: 5,
    id: stableId(record.id, "sheet"),
    // GCS recomputes this on load; the ancestry cost is what the sheet asserts
    // before any individual spend is priced.
    total_points: ancestry.calc?.points ?? 0,
    profile,
    settings: { ...settings, body_type: bodyType },
    attributes,
    traits: [ancestry, ...bought],
    skills,
    notes,
    created_date: "1970-01-01T00:00:00Z",
    modified_date: "1970-01-01T00:00:00Z",
  };
}

const templates = new Map(
  readdirSync(GCT_DIR).filter(name => name.endsWith(".gct")).map(name => [
    name.replace(/\.gct$/, ""),
    JSON.parse(readFileSync(join(GCT_DIR, name), "utf8")),
  ]),
);

const BASELINE_ATTRIBUTES = ["st", "dx", "iq", "ht", "will", "per", "hp", "fp", "basic_speed", "basic_move"];

/**
 * Ask GCS what each ancestry alone derives, and record it.
 *
 * Regenerate whenever the .gct templates change; the result is committed so the
 * ordinary build stays pure arithmetic. Sheets are written to a scratch
 * directory because -convert rewrites in place.
 */
function writeBaseline() {
  const scratch = mkdtempSync(join(tmpdir(), "doa-gcs-baseline-"));
  try {
    const slugs = new Map();
    for (const record of pkg.monsters) {
      const template = templates.get(record.provenance.sourceMonsterId);
      if (!template) continue;
      slugs.set(record.id, true);
      writeFileSync(join(scratch, `${record.id}.gcs`), JSON.stringify(sheetFor(record, template, null), null, "\t"));
    }
    convertInPlace(scratch);
    const baseline = {};
    for (const id of slugs.keys()) {
      const resolved = JSON.parse(readFileSync(join(scratch, `${id}.gcs`), "utf8"));
      baseline[id] = Object.fromEntries(BASELINE_ATTRIBUTES.map(attr => [
        attr,
        resolved.attributes.find(entry => entry.attr_id === attr)?.calc?.value ?? null,
      ]));
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify({
      note: "Attribute values each .gct ancestry derives on its own, computed by GCS. "
        + "Regenerate with: node scripts/build-gcs-sheets.mjs --baseline",
      records: baseline,
    }, null, 2)}\n`, "utf8");
    console.log(`Wrote ancestry baseline for ${Object.keys(baseline).length} record(s) to ${BASELINE_PATH}.`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (baselineMode) {
  writeBaseline();
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error(`Missing ${BASELINE_PATH}. Regenerate it with: node scripts/build-gcs-sheets.mjs --baseline`);
  process.exit(1);
}
const baselines = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).records;

mkdirSync(OUT_DIR, { recursive: true });
const problems = [];
let written = 0;
let unchanged = 0;

for (const record of pkg.monsters) {
  const slug = record.provenance.sourceMonsterId;
  const template = templates.get(slug);
  if (!template) {
    problems.push(`${record.id}: no GCS template at ${GCT_DIR}/${slug}.gct`);
    continue;
  }
  const baseline = baselines[record.id];
  if (!baseline) {
    problems.push(`${record.id}: no ancestry baseline; run node scripts/build-gcs-sheets.mjs --baseline`);
    continue;
  }
  const sheet = sheetFor(record, template, baseline);
  const text = `${JSON.stringify(sheet, null, "\t")}\n`;
  const target = join(OUT_DIR, `${record.id}.gcs`);
  if (existsSync(target) && readFileSync(target, "utf8") === text) {
    unchanged += 1;
    continue;
  }
  if (check) problems.push(`${target} is stale; run npm run build:gcs-sheets`);
  else {
    writeFileSync(target, text, "utf8");
    written += 1;
  }
}

if (problems.length > 0) {
  console.error(`GCS sheet build failed:\n${problems.map(problem => `  - ${problem}`).join("\n")}`);
  process.exit(1);
}
console.log(check
  ? `GCS sheets are current (${unchanged}/${pkg.monsters.length}).`
  : `Wrote ${written} and left ${unchanged} unchanged of ${pkg.monsters.length} GCS sheet(s) in ${OUT_DIR}.`);
