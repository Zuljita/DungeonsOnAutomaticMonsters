// SPDX-License-Identifier: MIT
//
// Turn one tracked monster spec into the three artifacts it owes: a public
// package record, a GCS v5 ancestry template, and a ready-to-open GCS v5 sheet.
//
// Everything derived is derived once. The trait list produces the point total,
// the Typical Stats, and the ancestry container; the Typical Stats produce the
// damage and the rating. A spec cannot state a ST of 13 and a bite of 2d, or a
// 40-point template whose children add to 35, because it never states either —
// it states the build, and the build states the rest.

import {
  enhancedMoveMultiplier,
  resolveDamage,
  skillPoints,
  stableId,
} from "./gurps.mjs";
import { traitDefinition, traitDisplayName } from "./trait-library.mjs";
import { effectivenessFromStats } from "../review/cer.mjs";

export const CONVERSION_VERSION = "0.1.0-srd-independent-build";

/** Order the ancestry container lists its attribute children in. */
const ATTRIBUTE_ORDER = ["st", "dx", "iq", "ht", "hp", "will", "per", "fp", "sm", "move"];

/** GURPS damage-type words the rating path and the sheet builder both read. */
const DAMAGE_TYPE_ABBREVIATIONS = {
  crushing: "cr",
  cutting: "cut",
  impaling: "imp",
  piercing: "pi",
  "large piercing": "pi+",
  "huge piercing": "pi++",
  "small piercing": "pi-",
  burning: "burn",
  corrosion: "cor",
  toxic: "tox",
  fatigue: "fat",
};

/** A breath weapon or a spit is not a melee weapon, whatever else it is. */
function isRanged(reach) {
  return typeof reach === "string" && /ranged|cone|\d{2,}/i.test(reach);
}

function expandTraits(spec, traitSets) {
  const entries = [];
  // A set is a convenience, not a straitjacket: an elephant is a quadruped that
  // has a fine manipulator, so it drops that one entry by name rather than
  // forgoing the set and restating five traits it does share.
  const omitted = new Set(spec.omitTraits ?? []);
  const supplied = new Set();
  for (const setName of spec.traitSets ?? []) {
    const set = traitSets[setName];
    if (!set) throw new Error(`${spec.slug}: unknown trait set ${setName}`);
    for (const entry of set) {
      supplied.add(entry.trait);
      if (!omitted.has(entry.trait)) entries.push(entry);
    }
  }
  for (const omission of omitted) {
    if (!supplied.has(omission)) {
      throw new Error(`${spec.slug}: omitTraits names ${omission}, which no trait set supplies`);
    }
  }
  // A spec entry for a trait a set already supplies overrides it — a deer hears
  // better than the shared keen-nose baseline and says so once, in its own list.
  // Two entries inside one spec are a mistake, and stay an error.
  const key = entry => `${entry.trait}|${entry.qualifier ?? ""}`;
  const resolved = new Map(entries.map(entry => [key(entry), entry]));
  const own = new Set();
  for (const entry of spec.traits ?? []) {
    if (own.has(key(entry))) throw new Error(`${spec.slug}: trait ${key(entry)} is listed twice`);
    own.add(key(entry));
    resolved.set(key(entry), entry);
  }
  return [...resolved.values()];
}

/**
 * Attribute totals and the derived statistics that follow from them.
 *
 * The record's Typical Stats are computed here rather than authored, so the
 * ancestry template and the stat block can only ever agree.
 */
function deriveAttributes(entries, sizeModifier, movement) {
  const adjustments = { st: 0, dx: 0, iq: 0, ht: 0, hp: 0, will: 0, per: 0, fp: 0, move: 0 };
  const enhanced = { ground: 0, air: 0, water: 0 };
  const media = new Set(["ground"]);
  let damageResistance = 0;
  for (const entry of entries) {
    const definition = traitDefinition(entry.trait);
    if (definition.attribute && definition.attribute.id !== "sm") {
      adjustments[definition.attribute.id] += definition.attribute.amount * (entry.levels ?? 0);
    }
    // Element-limited DR is real armour against one thing and nothing against
    // a sword, so it prices into the template but never into the published DR.
    if (definition.damageResistance) damageResistance += entry.levels ?? 0;
    if (definition.movementDoubling) enhanced[definition.movementDoubling] += entry.levels ?? 0;
    if (definition.grantsMovement) media.add(definition.grantsMovement);
  }

  const st = 10 + adjustments.st;
  const dx = 10 + adjustments.dx;
  const iq = 10 + adjustments.iq;
  const ht = 10 + adjustments.ht;
  const basicSpeed = (dx + ht) / 4;
  const groundMove = Math.max(0, Math.floor(basicSpeed) + adjustments.move);
  // Winged flight sets Air Move at twice Basic Speed. Water Move for a creature
  // at home in it is its Basic Move; a fish's body plan does not slow it down.
  const cruise = {
    ground: groundMove,
    air: media.has("air") ? Math.floor(basicSpeed * 2) : null,
    water: media.has("water") ? groundMove : null,
  };
  const primary = movement?.primary ?? "ground";
  if (cruise[primary] === null) {
    throw new Error(`primary medium ${primary} has no movement: the build grants no trait for it`);
  }

  /*
   * Two rules, and the difference is deliberate.
   *
   * A spec that declares a `movement` block publishes its primary medium's
   * *cruising* Move, and its Enhanced Move becomes a sprint figure stated in the
   * notes. A spec without one keeps the original behaviour, where Enhanced Move
   * multiplies the published Move.
   *
   * The second rule is wrong — the benchmark pass showed it publishes a chase
   * speed where a consumer reads tactical movement, and the rating path scores
   * `move - 6` straight into offense — but changing what `move` means is a
   * package-contract decision, not a builder's to make quietly. So the corrected
   * rule is opt-in per spec until that decision is recorded, and the land-animal
   * batch keeps the numbers it was reviewed with. See
   * review/policy/srd-independent-build-policy.md.
   */
  const published = movement
    ? cruise[primary]
    : Math.floor(groundMove * enhancedMoveMultiplier(enhanced.ground));

  const sprint = {};
  for (const medium of ["ground", "air", "water"]) {
    if (cruise[medium] === null) continue;
    const top = Math.floor(cruise[medium] * enhancedMoveMultiplier(enhanced[medium]));
    if (top !== cruise[medium]) sprint[medium] = top;
  }

  return {
    st,
    dx,
    iq,
    ht,
    hp: st + adjustments.hp,
    will: iq + adjustments.will,
    per: iq + adjustments.per,
    fp: ht + adjustments.fp,
    speed: basicSpeed,
    move: published,
    dodge: Math.floor(basicSpeed) + 3,
    dr: damageResistance,
    sizeModifier,
    movement: { primary, cruise, sprint, declared: Boolean(movement) },
  };
}

/**
 * A body weight in the unit a person would actually say it in. A bat is an
 * ounce, a wolf is a hundred pounds, and an ancient dragon is twenty-two tons;
 * writing all three in pounds gets one of them wrong every time.
 */
function weight(pounds) {
  if (pounds * 16 < 0.5) return "under an ounce";
  if (pounds < 1) return `${Math.round(pounds * 16)} oz`;
  if (pounds >= 10000) {
    const tons = pounds / 2000;
    return `${tons % 1 === 0 ? tons : tons.toFixed(1)} tons`;
  }
  return `${pounds.toLocaleString("en-US")} lb`;
}

/** The Move figures for every medium the build grants. */
function movementNote(attributes) {
  const { primary, cruise, sprint } = attributes.movement;
  const parts = [];
  for (const medium of ["ground", "air", "water"]) {
    if (cruise[medium] === null) continue;
    const top = sprint[medium] ? `, ${sprint[medium]} at a sprint` : "";
    parts.push(`${medium} Move ${cruise[medium]}${top}${medium === primary ? " (primary)" : ""}`);
  }
  return `Movement: ${parts.join("; ")}.`;
}

/** Why the published Move reads the way it does. Reviewer material, not table. */
function movementBasis(attributes) {
  return attributes.movement.declared
    ? "The published Move is the primary medium's cruising Move; sprint figures are stated in the movement note "
      + "and not folded into it."
    : "The published Move folds this creature's Enhanced Move into a single figure.";
}

/**
 * The percentage modifiers a levelled attribute trait carries automatically.
 *
 * ST costs less for a large creature and ST and DX both cost less without fine
 * manipulators. Both are published discounts on the attribute itself, so they
 * belong on the trait that buys it rather than being quietly folded into a
 * hand-tuned point total.
 */
function automaticModifiers(traitId, { sizeModifier, noFineManipulators }) {
  const modifiers = [];
  if (traitId === "st" || traitId === "st-") {
    if (sizeModifier > 0) {
      const percent = Math.min(80, sizeModifier * 10);
      modifiers.push({
        name: "Size",
        reference: "B19",
        cost_adj: `-${percent}%`,
        local_notes: "Strength costs less for a creature this large.",
      });
    }
    if (noFineManipulators) {
      modifiers.push({ name: "No Fine Manipulators", reference: "B145", cost_adj: "-40%" });
    }
  }
  if ((traitId === "dx" || traitId === "dx-") && noFineManipulators) {
    modifiers.push({ name: "No Fine Manipulators", reference: "B145", cost_adj: "-40%" });
  }
  return modifiers;
}

function traitPoints(definition, entry, modifiers) {
  const base = definition.basePoints !== undefined
    ? definition.basePoints
    : definition.pointsPerLevel * (entry.levels ?? 0);
  // Percentages are summed and applied as integers. Doing this in floating point
  // turns a -70% discount on 350 points into 244.99999999999997, and a build
  // whose total depends on which way that rounds is not a reviewable build.
  const adjustment = modifiers.reduce((total, modifier) => total + Number(modifier.cost_adj.replace("%", "")), 0);
  const percent = Math.max(20, 100 + adjustment);
  const scaled = base * percent;
  if (!Number.isInteger(scaled / 100)) {
    throw new Error(
      `${definition.name}: ${base} points at ${percent}% is ${scaled / 100}, not a whole number of points; `
      + "choose levels that price cleanly rather than rounding silently",
    );
  }
  return scaled / 100;
}

function gctChild(slug, entry, context) {
  const definition = traitDefinition(entry.trait);
  const modifiers = [
    ...(definition.modifiers ?? []),
    ...automaticModifiers(entry.trait, context),
    ...(entry.modifiers ?? []),
  ];
  const points = traitPoints(definition, entry, modifiers);
  const child = {
    id: stableId("t", slug, entry.trait, entry.qualifier ?? ""),
    name: entry.qualifier ? `${definition.name} (${entry.qualifier})` : definition.name,
    reference: definition.reference,
    tags: definition.tags,
  };
  if (entry.note) child.local_notes = entry.note;
  if (definition.basePoints !== undefined) {
    child.base_points = definition.basePoints;
  } else {
    child.points_per_level = definition.pointsPerLevel;
    child.can_level = true;
    child.levels = entry.levels;
  }
  // A trait can appear more than once in a build when the qualifier is what
  // distinguishes the copies — an aasimar buys element-limited DR three times,
  // once each for acid, cold and lightning. The child id already carries the
  // qualifier; its modifiers and weapons have to as well, or the three copies
  // hand GCS the same modifier id three times. The qualifier is appended only
  // when there is one, so ids for the unqualified traits do not move.
  const qualified = entry.qualifier ? [entry.qualifier] : [];
  if (modifiers.length > 0) {
    child.modifiers = modifiers.map(modifier => ({
      id: stableId("m", slug, entry.trait, modifier.name, ...qualified),
      ...modifier,
    }));
  }
  if (definition.features) child.features = definition.features;
  if (definition.weapons) {
    child.weapons = definition.weapons.map(weapon => ({
      id: stableId("w", slug, entry.trait, weapon.usage, ...qualified),
      sv: 1,
      ...weapon,
    }));
  }
  child.calc = definition.basePoints !== undefined
    ? { points }
    : { points, current_level: entry.levels };
  return child;
}

function orderedEntries(entries) {
  const attributes = [];
  const advantages = [];
  const disadvantages = [];
  for (const entry of entries) {
    const definition = traitDefinition(entry.trait);
    if (definition.attribute) attributes.push(entry);
    else if (definition.tags.includes("Disadvantage")) disadvantages.push(entry);
    else advantages.push(entry);
  }
  const attributeRank = entry => {
    const id = traitDefinition(entry.trait).attribute.id;
    return ATTRIBUTE_ORDER.indexOf(id);
  };
  attributes.sort((a, b) => attributeRank(a) - attributeRank(b));
  const byName = (a, b) => traitDefinition(a.trait).name.localeCompare(traitDefinition(b.trait).name);
  advantages.sort(byName);
  disadvantages.sort(byName);
  return [...attributes, ...advantages, ...disadvantages];
}

function racialSkills(spec, attributes) {
  return (spec.skills ?? []).map(skill => {
    const attributeValue = attributes[skill.attribute];
    if (attributeValue === undefined) throw new Error(`${spec.slug}: skill ${skill.name} names no attribute`);
    return {
      name: skill.name,
      specialization: skill.specialization,
      difficulty: `${skill.attribute}/${skill.difficulty}`,
      relative: skill.relative,
      level: attributeValue + skill.relative,
      points: skillPoints(skill.difficulty, skill.relative),
    };
  });
}

function buildAttacks(spec, attributes, skills) {
  const byName = new Map(skills.map(skill => [skill.name, skill]));
  return (spec.attacks ?? []).map(attack => {
    let skill = null;
    if (attack.skill !== undefined && attack.skill !== null) {
      const racial = byName.get(attack.skill);
      if (!racial) throw new Error(`${spec.slug}: attack ${attack.name} uses unlisted skill ${attack.skill}`);
      skill = racial.level + (attack.skillModifier ?? 0);
    }
    // A natural weapon states its damage relative to the wielder's thrust or
    // swing. A swarm does not: its damage is a property of how many small bodies
    // are in the hex, not of any one of them pushing, so a spec may state literal
    // dice and the ST-relative path is skipped.
    const literal = attack.basis && /^\d+d([+-]\d+)?$/.test(attack.basis);
    const damage = attack.basis
      ? `${literal ? attack.basis : resolveDamage(attributes.st, attack.basis, attack.perDie ?? 0)} ${attack.type}`
      : null;
    const entry = {
      name: attack.name,
      skill,
      damage,
      reach: attack.reach ?? null,
    };
    if (attack.autoHit !== undefined) entry.autoHit = attack.autoHit;
    if (attack.afflictionPoints !== undefined) entry.afflictionPoints = attack.afflictionPoints;
    // A web or a coil is priced by the ST that holds it, not by damage; the
    // rating path reads bindingSt directly.
    if (attack.bindingSt !== undefined) entry.bindingSt = attack.bindingSt;
    if (attack.usesFatigueOrSpell !== undefined) entry.usesFatigueOrSpell = attack.usesFatigueOrSpell;
    const summary = [
      `${attack.name}${skill === null ? "" : ` (${skill})`}:`,
      damage ? `${damage},` : null,
      entry.reach ? `Reach ${entry.reach}.` : null,
      attack.notes ?? null,
    ].filter(Boolean).join(" ");
    entry.notes = summary.trim();
    entry.damageType = attack.type;
    entry.basis = attack.basis ?? null;
    entry.perDie = attack.perDie ?? 0;
    return entry;
  });
}

function packageAttack(attack) {
  const { damageType, basis, perDie, ...published } = attack;
  return published;
}

function headingLabel(cover) {
  return `${cover.heading} (${cover.sourceSystem === "srd_5_1" ? "SRD 5.1" : "SRD 3.5"})`;
}

/**
 * The one place that says who wrote this and under what terms. It goes into the
 * package record, the ancestry template and the sheet, because a GCS file that
 * travels away from the package has to carry its own credit.
 */
function creditLine(source) {
  return source.credits[0].creditLine;
}

export function buildRecord(spec, context) {
  const { batch, traitSets, source, packageSourceId, sourceBookId, settings } = context;
  const entries = orderedEntries(expandTraits(spec, traitSets));
  const noFineManipulators = entries.some(entry => traitDefinition(entry.trait).noFineManipulators);
  const attributes = deriveAttributes(entries, spec.sizeModifier, spec.movement);
  const gctContext = { sizeModifier: spec.sizeModifier, noFineManipulators };
  const children = entries.map(entry => gctChild(spec.slug, entry, gctContext));
  const templatePoints = children.reduce((total, child) => total + child.calc.points, 0);
  const skills = racialSkills(spec, attributes);
  const skillPointTotal = skills.reduce((total, skill) => total + skill.points, 0);
  const attacks = buildAttacks(spec, attributes, skills);

  // A swarm is one multi-body creature, not a group of creatures. The consumer's
  // encounter derivation already forces this, and a spec that disagreed would
  // put a number on the table that the application would then overrule.
  const isSwarm = /\bswarm\b/i.test(spec.name) || (spec.classTags ?? []).includes("swarm");
  if (isSwarm && spec.encounter.averageNumberAppearing !== 1) {
    throw new Error(
      `${spec.slug}: a swarm appears as one creature; averageNumberAppearing must be 1, not `
      + `${spec.encounter.averageNumberAppearing}`,
    );
  }

  const covers = spec.covers.map(headingLabel).join("; ");
  const recordId = `doa_${spec.slug.replace(/-/g, "_")}`;
  const statsAttributes = {
    st: attributes.st,
    dx: attributes.dx,
    iq: attributes.iq,
    ht: attributes.ht,
    hp: attributes.hp,
    will: attributes.will,
    per: attributes.per,
    fp: attributes.fp,
    speed: attributes.speed,
    move: attributes.move,
    dodge: attributes.dodge,
    dr: attributes.dr,
  };
  const stats = {
    attributes: statsAttributes,
    attacks: attacks.map(packageAttack),
    // Attribute adjustments are left out: the attributes block above already
    // states ST, DX, Will and the rest, and a trait line reading "Increased
    // Strength 10" beside "ST 20" is the same fact twice in a worse format. The
    // adjustments remain in the .gct, which is where a point total needs them.
    traits: entries
      .filter(entry => !traitDefinition(entry.trait).attribute)
      .map(traitDisplayName)
      .sort((a, b) => a.localeCompare(b)),
    skills: skills.map(skill => ({ name: skill.name, level: skill.level })),
    // Stat notes are read at the table, on a sheet, by someone running the
    // creature. They say what a GM needs and nothing about how the record was
    // made: which batch authored it, what it was compared against afterwards,
    // which issue tracks a defect in the rating path. All of that is true and
    // none of it belongs on a stat block, so it goes to provenanceNotes below
    // and travels in provenance.conversionNotes instead.
    notes: [
      `Racial cost: ${templatePoints} points of traits plus ${skillPointTotal} ${skillPointTotal === 1 ? "point" : "points"} of skills.`,
      ...(spec.massLb === undefined ? [] : [`Body weight: ${weight(spec.massLb)}.`]),
      movementNote(attributes),
      ...(spec.notes ?? []),
    ],
  };

  const effectiveness = effectivenessFromStats(stats, recordId);
  const record = {
    id: recordId,
    name: spec.name,
    pageRef: `${spec.name} [Monsters on Automatic, ${batch.title}; answers ${covers}]`,
    class: spec.class,
    classTags: spec.classTags,
    tags: [
      "monsters-on-automatic",
      "ai-generated",
      "doa-authored",
      ...spec.covers.map(cover => (cover.sourceSystem === "srd_5_1" ? "srd-5-1" : "srd-3-5")),
      ...spec.classTags,
      ...spec.tags,
    ].filter((tag, index, all) => all.indexOf(tag) === index),
    iq: attributes.iq,
    appearance: null,
    lair: spec.lair ?? null,
    description: {
      text: spec.description,
      authorship: "doa_authored",
      basis: ["record.stats.traits", "record.stats.attacks", "record.size", "record.class"],
      contentLicense: "cc_by_4_0",
      contentLicenseUrl: "https://github.com/Zuljita/DungeonsOnAutomaticMonsters/blob/main/licenses/CC-BY-4.0.txt",
    },
    treasure: {
      money: null,
      items: null,
      strategy: null,
      change: null,
      estimatedMoneyAverage: null,
      estimatedItemAverage: null,
      estimatedMoneyPerAppearance: null,
    },
    size: {
      modifier: spec.sizeModifier >= 0 ? `+${spec.sizeModifier}` : String(spec.sizeModifier),
      heightSizeModifier: spec.sizeModifier,
      hexes: spec.hexes,
      // The mass the build was scaled from. Recorded because it is the one fact
      // that makes an authored animal checkable: ST, SM and DR all follow it.
      massLb: spec.massLb ?? null,
      heightHexes: null,
      lengthHexes: null,
      widthHexes: null,
    },
    grappling: { skill: null, damage: null, controlMaximum: null },
    effectiveness: {
      offenseRating: effectiveness.offenseRating,
      protectionRating: effectiveness.protectionRating,
      combatEffectivenessRating: effectiveness.combatEffectivenessRating,
      treasureAdjustedCombatEffectiveness: null,
      wanderingCombatEffectiveness: null,
      threatTier: effectiveness.threatTier,
    },
    encounter: {
      averageNumberAppearing: spec.encounter.averageNumberAppearing,
      treasureMultiplier: null,
      wanderingWeight: spec.encounter.wanderingWeight,
      lightSensitive: spec.encounter.lightSensitive ?? null,
    },
    stats,
    provenance: {
      kind: "doa_authored",
      sourceSystem: "doa_fixture",
      sourceLicense: "doa_authored",
      contentLicense: "cc_by_4_0",
      contentLicenseUrl: source.contentLicenseUrl,
      sourceMonsterId: spec.slug,
      sourceName: `${spec.name} [Monsters on Automatic, ${batch.title}]`,
      sourceUrl: source.sourceUrl,
      sourceCopyrightNotice: source.sourceCopyrightNotice,
      conversionVersion: CONVERSION_VERSION,
      conversionNotes: [
        "Independently authored GURPS build. The SRD supplies the creature identity this record answers to and "
          + "nothing else: no SRD statistics, wording or presentation is reproduced, and no third-party GURPS "
          + "conversion was used as an input.",
        `Answers the SRD heading(s): ${covers}.`,
        `Racial template: ${templatePoints} points across ${children.length} traits, plus ${skills.length} racial `
          + `skill(s) worth ${skillPointTotal} points.`,
        "Every trait is drawn from the project's controlled GURPS vocabulary in scripts/srd/trait-library.mjs, "
          + "which carries the page reference and published cost for each entry.",
        "sourceSystem is recorded as doa_fixture because that is the package contract's value for "
          + "project-authored material; the SRD headings this record answers are in provenance.coversSourceIdentities.",
        "Ratings are recomputed through the consumer CER path on every build, so a mechanics change cannot leave a "
          + "stale rating behind.",
        "Typical Stats, damage and ratings are derived from the racial template rather than authored beside it, so "
          + "the sheet and the stat block cannot disagree.",
        `GCS ancestry draft: gcs/${spec.slug}.gct`,
        movementBasis(attributes),
        "Treasure and grappling are not authored for this record and ship as explicit nulls, which reads as known "
          + "absent rather than forgotten; `lair` carries a short habitat note instead, because where a creature "
          + "dens is an encounter fact rather than a loot one.",
        ...(spec.massLb === undefined
          ? []
          : ["Body mass is the figure the build was scaled from and the one fact that makes it checkable; see the "
            + "gurps-animal-sanity-check skill for the bands."]),
        // How the record was made, logged where an auditor looks rather than
        // where a GM does: the outside-comparison disclosure ROADMAP.md rule 6
        // requires, defects in the shared rating path, and cross-record notes.
        ...(spec.provenanceNotes ?? []),
      ],
      manualReviewStatus: "review_required",
      packageSourceId,
      license: "Project-authored monster mechanics and prose released under CC BY 4.0 with originator credit.",
      url: source.sourceUrl,
      originalId: spec.slug,
      publicStats: true,
      notes: "AI-generated first draft authored by Monsters on Automatic. Mechanical and playability review is "
        + "required before approval; no generated record is approved automatically.",
      credits: source.credits,
      coversSourceIdentities: spec.covers.map(cover => ({
        sourceSystem: cover.sourceSystem,
        heading: cover.heading,
        relationship: cover.relationship ?? "published",
        alsoPrintedAs: cover.alsoPrintedAs ?? [],
      })),
    },
    sourceBook: sourceBookId,
    sourceBooks: [sourceBookId],
    source: {
      batch: batch.id,
      issue: batch.issue,
      spec: batch.specPath,
      slug: spec.slug,
    },
  };

  return {
    record,
    template: buildTemplate(spec, { children, skills, templatePoints, covers, source, batch }),
    sheet: buildSheet(record, { children, skills, templatePoints, attacks, spec, source, settings }),
  };
}

function buildTemplate(spec, { children, skills, templatePoints, covers, source, batch }) {
  const localNotes = [
    "Independent Monsters on Automatic build; AI-generated first draft authorized for publication under CC BY 4.0.",
    `Originator credit: ${creditLine(source)}`,
    `Answers the SRD heading(s): ${covers}. Only the creature identity comes from the SRD; these GURPS mechanics `
      + "are this project's own work and reproduce no SRD text.",
    "Review status: draft, review required.",
    `Template total: ${templatePoints} points.`,
  ].join(" ");

  const template = {
    version: 5,
    id: stableId("T", spec.slug, "template"),
    traits: [
      {
        id: stableId("t", spec.slug, "ancestry"),
        name: spec.name,
        reference: `Monsters on Automatic, ${batch.title}: ${spec.name}`,
        local_notes: localNotes,
        container_type: "ancestry",
        children,
        calc: { points: templatePoints },
      },
    ],
  };
  if (skills.length > 0) template.skills = skills.map(skill => gcsSkill(spec.slug, skill));
  return template;
}

const ATTRIBUTE_ABBREVIATION = { st: "ST", dx: "DX", iq: "IQ", ht: "HT", will: "Will", per: "Per" };

function gcsSkill(slug, skill) {
  const attribute = ATTRIBUTE_ABBREVIATION[skill.difficulty.split("/")[0]];
  const entry = {
    id: stableId("s", slug, skill.name, skill.specialization ?? ""),
    name: skill.name,
    difficulty: skill.difficulty,
    points: skill.points,
    local_notes: `Racial skill at ${attribute}${skill.relative >= 0 ? "+" : ""}${skill.relative}, `
      + `level ${skill.level}.`,
  };
  if (skill.specialization) entry.specialization = skill.specialization;
  return entry;
}

/**
 * The sheet drops the ancestry container into a character and leaves every
 * attribute adjustment at zero, so GCS derives ST, HP, Will and the rest by
 * applying the ancestry the way a player would. Setting both would count every
 * modifier twice.
 */
function buildSheet(record, { children, skills, templatePoints, attacks, spec, source, settings }) {
  const ancestry = {
    id: stableId("t", spec.slug, "sheet-ancestry"),
    name: record.name,
    reference: record.pageRef,
    local_notes: `Independent Monsters on Automatic build. ${creditLine(source)}`,
    container_type: "ancestry",
    children,
    calc: { points: templatePoints },
  };

  const rollable = attacks.filter(attack => attack.skill !== null && attack.damage && !isRanged(attack.reach));
  if (rollable.length > 0) {
    ancestry.melee_weapons = rollable.map(attack => {
      const weapon = {
        id: stableId("w", record.id, "attack", attack.name),
        damage: {
          type: DAMAGE_TYPE_ABBREVIATIONS[attack.damageType] ?? "cr",
          base: attack.damage.split(" ")[0],
        },
        usage: attack.name,
        defaults: [{ type: "10", modifier: attack.skill - 10 }],
      };
      if (attack.reach) weapon.reach = attack.reach;
      weapon.usage_notes = attack.notes;
      return weapon;
    });
  }

  const typical = ["st", "dx", "iq", "ht", "hp", "will", "per", "fp", "speed", "move", "dodge", "dr"]
    .map(key => `${key.toUpperCase()} ${record.stats.attributes[key]}`)
    .join(", ");

  const notes = [
    {
      id: stableId("n", record.id, "typical"),
      text: `Typical Stats from the package record: ${typical}. GCS derives its own values by applying the `
        + "ancestry; where the two differ, the package's Typical Stats are what the Dungeons on Automatic "
        + "encounter tables use.",
    },
    {
      id: stableId("n", record.id, "rating"),
      text: `Encounter rating: CER ${record.effectiveness.combatEffectivenessRating} `
        + `(offense ${record.effectiveness.offenseRating}, protection ${record.effectiveness.protectionRating}), `
        + `threat tier ${record.effectiveness.threatTier}, appearing ${record.encounter.averageNumberAppearing}.`,
    },
  ];
  for (const hazard of attacks.filter(attack => attack.skill === null || isRanged(attack.reach))) {
    notes.push({
      id: stableId("n", record.id, hazard.name),
      text: `${hazard.name}: ${hazard.autoHit ? "No attack roll and no active defense. " : ""}${hazard.notes}`,
    });
  }
  for (const note of record.stats.notes) {
    notes.push({ id: stableId("n", record.id, "statnote", note.slice(0, 40)), text: note });
  }
  notes.push({ id: stableId("n", record.id, "credit"), text: creditLine(source) });

  return {
    version: 5,
    id: stableId("C", record.id, "sheet"),
    total_points: templatePoints + skills.reduce((total, skill) => total + skill.points, 0),
    profile: {
      name: record.name,
      title: record.class ?? "Monster",
      player_name: "Monsters on Automatic",
      SM: record.size.heightSizeModifier,
    },
    settings,
    attributes: settings.attributes.map(attribute => ({ attr_id: attribute.id, adj: 0 })),
    traits: [ancestry],
    skills: skills.map(skill => gcsSkill(record.id, skill)),
    notes,
    created_date: "1970-01-01T00:00:00Z",
    modified_date: "1970-01-01T00:00:00Z",
  };
}
