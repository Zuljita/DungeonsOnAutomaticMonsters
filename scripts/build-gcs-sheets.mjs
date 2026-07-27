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
// Dropping that container into a character and leaving the attribute adjustments
// at zero lets GCS derive ST, HP, Will and the rest the way it would for a player
// applying the ancestry by hand. Setting both would count every modifier twice.
//
// Natural attacks become melee weapons on the ancestry trait, which is where GCS
// expects a creature's built-in attacks to live. Hazards that allow no attack
// roll — acid auras, engulf, petrification — have no weapon equivalent, so they
// are written into the sheet notes with their resolution intact rather than
// forced into a weapon row that would imply a roll that does not exist.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REVIEWED_PATH } from "./review/build-candidate.mjs";

const GCT_DIR = "converted/enraged-eggplant/gcs";
const OUT_DIR = "converted/enraged-eggplant/gcs-sheets";
const SETTINGS_PATH = "schema/gcs-monster-settings.json";

const check = process.argv.includes("--check");
const pkg = JSON.parse(readFileSync(REVIEWED_PATH, "utf8"));
const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));

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

function sheetFor(record, template) {
  const ancestry = structuredClone(template.traits[0]);
  const attacks = (record.stats?.attacks ?? []).filter(Boolean);
  // Only attacks resolved by a roll become weapons; the rest keep their prose.
  const rollable = attacks.filter(attack => typeof attack.skill === "number");
  const hazards = attacks.filter(attack => typeof attack.skill !== "number");
  if (rollable.length > 0) {
    ancestry.melee_weapons = rollable.map(attack => meleeWeapon(attack, record.id));
  }

  const attributes = settings.attributes.map(def => {
    const entry = { attr_id: def.id, adj: 0 };
    return entry;
  });

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

  return {
    version: 5,
    id: stableId(record.id, "sheet"),
    total_points: ancestry.calc?.points ?? 0,
    profile: {
      name: record.name,
      title: record.class ?? "Monster",
      player_name: "Dungeons on Automatic",
      SM: Number(record.size?.heightSizeModifier) || 0,
    },
    settings,
    attributes,
    traits: [ancestry],
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
  const sheet = sheetFor(record, template);
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
