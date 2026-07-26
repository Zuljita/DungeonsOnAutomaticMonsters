// SPDX-License-Identifier: MIT
//
// Generate the special-ability repair file from the authorized source (issue #5).
//
// The conversion's attack parser only recognises paragraphs shaped like
// "Name (skill): damage". Every ability the source states as a GURPS power
// construction — "Heat Aura: Burning Attack 1d (Always On, -20%; Aura, +80%)" —
// produced nothing, so 77 records reached review missing a signature ability:
// the cockatrice had no petrification, the remorhaz no heat, the purple worm no
// poison. None of those is an empty attack list, so the nine-record queue in
// issue #5 never surfaced them.
//
// This script re-reads the source, pairs each construction with the GM-facing
// prose the source states for it in the Typical Stats block, and writes a tracked
// repair file. Rerunning it reproduces that file byte for byte.
//
//   node scripts/review-extract-special-abilities.mjs
//   node scripts/review-extract-special-abilities.mjs --report
//
// Rating policy, deliberately conservative:
//   * A damaging Attack construction that is not a Follow-Up rider becomes a
//     rated attack entry, auto-hit when the source says it is always on, an aura,
//     or explicitly allows no roll and no defense.
//   * Everything else — afflictions, terror, binding, possession, obscure,
//     defensive powers, and every Follow-Up rider — becomes an explicit entry
//     with no skill and no damage expression, or a note on the attack it rides.
//     It is runnable at the table but contributes nothing to the rating, which
//     matches the audit's position that the CER path cannot price these.

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE_PATH = "data/enraged-eggplant/srd-overlap-monsters.md";
const BASE_PATH = "converted/enraged-eggplant/doa-monsters.review-required.json";
const OUT_PATH = "review/repairs/002-special-ability-mechanics.json";

const DAMAGING = {
  "Toxic Attack": "toxic",
  "Burning Attack": "burning",
  "Corrosion Attack": "corrosion",
  "Crushing Attack": "crushing",
  "Cutting Attack": "cutting",
  "Piercing Attack": "piercing",
  "Impaling Attack": "impaling",
  "Fatigue Attack": "fatigue",
};
const NON_RATED = [
  "Internal Affliction",
  "Affliction",
  "Terror",
  "Binding",
  "Possession",
  "Dominance",
  "Obscure",
  "Innate Attack",
];
const SECTION_LABELS = new Set([
  "Advantages", "Disadvantages", "Traits", "Notes", "Features", "Perks", "Quirks",
  "Skills", "Creature Type", "Attribute Modifiers", "Secondary Characteristic Modifiers",
  "Psionic Skills", "Racial Skills", "Spells",
]);

const report = process.argv.includes("--report");
const source = readFileSync(SOURCE_PATH, "utf8");
const base = JSON.parse(readFileSync(BASE_PATH, "utf8"));
const byName = new Map(base.monsters.map(record => [record.name, record]));

// The nine empty-attack records were hand-authored from the same source in
// 001-missing-attack-mechanics.json, with resolution text this generator cannot
// match. Skip them so the later repair file does not clobber the earlier one.
const HAND_AUTHORED = new Set(
  JSON.parse(readFileSync("review/repairs/001-missing-attack-mechanics.json", "utf8"))
    .repairs.map(repair => repair.recordId),
);

const repairs = [];
const skipped = [];

for (const section of source.split(/\n(?=## )/)) {
  const heading = section.split("\n", 1)[0];
  const nameMatch = heading.match(/^## (.+?) \[/);
  if (!nameMatch) continue;
  const record = byName.get(nameMatch[1]);
  if (!record || HAND_AUTHORED.has(record.id)) continue;

  const statsIndex = section.indexOf("### Typical Stats");
  const header = statsIndex >= 0 ? section.slice(0, statsIndex) : section;
  const statsBlock = statsIndex >= 0 ? section.slice(statsIndex) : "";
  const prose = proseByLabel(statsBlock);
  const existing = attackHaystack(record);

  const added = [];
  const riders = [];
  const abilityNotes = [];

  for (const construction of constructions(header)) {
    if (existing.includes(construction.key)) continue;
    const resolution = prose.get(construction.label.toLowerCase())
      ?? summarize(construction);
    if (construction.followUp) {
      riders.push({ construction, resolution });
      continue;
    }
    if (construction.damageType) {
      added.push({
        name: construction.label,
        skill: null,
        damage: `${construction.damage} ${construction.damageType}`,
        reach: construction.reach,
        autoHit: construction.autoHit,
        notes: resolution,
      });
    } else if (construction.offensive) {
      added.push({
        name: construction.label,
        skill: null,
        damage: null,
        reach: construction.reach,
        autoHit: false,
        notes: resolution,
      });
    } else {
      abilityNotes.push(`${construction.label}: ${resolution}`);
    }
  }

  if (added.length === 0 && riders.length === 0 && abilityNotes.length === 0) continue;

  const set = {};
  if (added.length > 0) {
    const attacks = structuredClone(record.stats.attacks);
    for (const rider of riders) {
      const parent = attacks.find(attack => rider.construction.followUp.toLowerCase().includes(attack.name.toLowerCase()))
        ?? added.find(attack => rider.construction.followUp.toLowerCase().includes(attack.name.toLowerCase()));
      if (parent) parent.notes = `${parent.notes} ${rider.construction.label}: ${rider.resolution}`;
      else abilityNotes.push(`${rider.construction.label} (follow-up on ${rider.construction.followUp}): ${rider.resolution}`);
    }
    set["stats.attacks"] = [...attacks, ...added];
  } else if (riders.length > 0) {
    const attacks = structuredClone(record.stats.attacks);
    let attached = false;
    for (const rider of riders) {
      const parent = attacks.find(attack => rider.construction.followUp.toLowerCase().includes(attack.name.toLowerCase()));
      if (parent) {
        parent.notes = `${parent.notes} ${rider.construction.label}: ${rider.resolution}`;
        attached = true;
      } else {
        abilityNotes.push(`${rider.construction.label} (follow-up on ${rider.construction.followUp}): ${rider.resolution}`);
      }
    }
    if (attached) set["stats.attacks"] = attacks;
  }

  const rated = added.filter(attack => attack.damage !== null);
  repairs.push({
    recordId: record.id,
    monster: record.name,
    rationale:
      `The conversion's attack parser only matches "Name (skill): damage" paragraphs, so `
      + `${added.length + riders.length + abilityNotes.length} ability construction(s) stated by the source `
      + `produced nothing: ${[...added.map(a => a.name), ...riders.map(r => r.construction.label), ...abilityNotes.map(note => note.split(":")[0])].join(", ")}. `
      + `Restored from the source with its own resolution text. `
      + (rated.length > 0
        ? `${rated.length} damaging construction(s) are rated; afflictions, terror, binding, possession and utility powers are runnable but unrated.`
        : `None of them is a damaging construction, so the rating is unchanged.`),
    ...(Object.keys(set).length > 0 ? { set } : {}),
    ...(abilityNotes.length > 0 ? { appendStatNotes: abilityNotes } : {}),
    appendConversionNotes: [
      `Issue #5: restored ${added.length + riders.length + abilityNotes.length} special ability construction(s) `
      + `the attack parser dropped (${[...added.map(a => a.name), ...riders.map(r => r.construction.label)].join(", ") || "utility powers"}). `
      + (rated.length > 0
        ? `${rated.length} damaging construction(s) now contribute to the offense rating.`
        : `No rated change: none of the restored abilities is a damaging attack the CER path can price.`),
    ],
  });
}

const output = {
  version: 1,
  issue: 5,
  title: "Special ability constructions the attack parser dropped",
  summary:
    "Generated by scripts/review-extract-special-abilities.mjs from the authorized source. The conversion "
    + "parser only recognises 'Name (skill): damage' paragraphs, so every ability stated as a GURPS power "
    + "construction was lost. These records were not in the nine-record empty-attack queue because they each "
    + "kept an ordinary attack; they were nevertheless missing a signature ability. Damaging constructions are "
    + "rated; afflictions, terror, binding, possession and utility powers are restored as runnable but unrated "
    + "entries, matching review/reports/cer-audit.md on what the CER path can price.",
  repairs,
};

if (report) {
  console.log(`${repairs.length} record(s) gain restored abilities.`);
  for (const repair of repairs) console.log(`  ${repair.monster}: ${repair.rationale.slice(0, 140)}`);
} else {
  writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT_PATH}: ${repairs.length} record(s), ${skipped.length} construction(s) skipped.`);
}

/** Named power constructions in a monster's header block. */
function* constructions(header) {
  for (const raw of header.split("\n")) {
    const line = raw.trim().replace(/^[->\s]+/, "");
    const match = line.match(/^([A-Z][A-Za-z'’()/,\- ]{2,44}?)\s*(?:\[[-\d]+\])?\s*:\s*(.+)$/);
    if (!match) continue;
    const label = match[1].trim();
    const body = match[2].trim();
    if (SECTION_LABELS.has(label)) continue;

    const damaging = Object.entries(DAMAGING).find(([kind]) => body.includes(kind));
    const nonRated = NON_RATED.find(kind => body.includes(kind));
    if (!damaging && !nonRated) continue;

    const followUpMatch = body.match(/Follow-Up,\s*([^,;)]+)/i);
    const damageMatch = damaging
      ? body.match(new RegExp(`${damaging[0]}\\s+(\\d+d(?:[+-]\\d+)?|\\d+\\s*points?|\\d+)`))
      : null;
    const reachMatch = body.match(/Melee Attack,\s*Reach\s*([^,;)]+)/i)
      ?? body.match(/Area Effect,\s*(\d+\s*yards?)/i)
      ?? body.match(/(Cone\s*\d+)/i);

    yield {
      label,
      key: label.toLowerCase().split("(")[0].trim(),
      body,
      damageType: damaging && damageMatch ? damaging[1] : null,
      damage: damageMatch ? normalizeDamage(damageMatch[1]) : null,
      reach: reachMatch ? reachMatch[1].trim() : null,
      followUp: followUpMatch ? followUpMatch[1].trim() : null,
      offensive: Boolean(damaging) || ["Affliction", "Internal Affliction", "Terror", "Binding", "Possession", "Dominance"].some(kind => body.includes(kind)),
      autoHit: isAutoHit(body),
    };
  }
}

/**
 * Auto-hit means the source states no attack roll and no active defense. An
 * always-on aura you have to touch qualifies; a malediction or a blockable
 * attack resolves as a contest and does not.
 */
function isAutoHit(body) {
  if (/Malediction|Blockable|Based on|Takes Recharge/i.test(body)) return false;
  return /Always On|Aura,|Cosmic,\s*No die roll required|Contact Agent/i.test(body);
}

function normalizeDamage(raw) {
  const text = raw.trim();
  return /^\d+\s*points?$/i.test(text) ? text.replace(/\s+/g, " ") : text;
}

/** GM-facing prose the source states for an ability in the Typical Stats block. */
function proseByLabel(statsBlock) {
  const map = new Map();
  for (const paragraph of statsBlock.split(/\n\s*\n/)) {
    const text = paragraph.split("\n").map(line => line.trim()).join(" ").trim();
    const match = text.match(/^([A-Z][A-Za-z'’()/,\- ]{2,44}?):\s*(.+)$/);
    if (!match) continue;
    const label = match[1].trim();
    if (SECTION_LABELS.has(label) || label.startsWith("**")) continue;
    map.set(label.toLowerCase(), match[2].trim());
  }
  return map;
}

function summarize(construction) {
  return `${construction.body.replace(/\s*\[\d+\]\.?$/, "")} `
    + `Resolve as stated by the construction; the source gives no separate resolution text.`;
}

/**
 * What the record already carries for an ability. Immunity and resistance traits
 * are excluded: the cockatrice's "Immunity to Cockatrice Petrification" perk
 * names petrification without granting it, and would otherwise mask the fact
 * that its petrification aura went missing.
 */
function attackHaystack(record) {
  return [
    ...record.stats.attacks.flatMap(attack => [attack.name, attack.notes, attack.damage]),
    ...record.stats.traits.filter(trait => !/^(immunity|resistant|protected)\b/i.test(trait)),
  ].filter(Boolean).join(" | ").toLowerCase();
}
