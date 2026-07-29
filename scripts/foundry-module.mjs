// SPDX-License-Identifier: MIT
//
// Foundry VTT module builder for the published monster package.
//
// Target system: the GURPS Game Aid (system id "gurps"). The package's
// statistics are GURPS-shaped and the Game Aid is the Foundry system that
// consumes GCS data, so its actor model is the one the package data already
// fits. The decision and its alternatives are recorded in
// docs/foundry/target-system-decision.md.
//
// Everything here is a pure function of the published package plus the tracked
// constants below, so the module is reproducible from the package alone. The
// LevelDB pack compile (the only step that needs a dependency) happens in
// scripts/build-foundry-module.mjs via the official @foundryvtt/foundryvtt-cli.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { BODY_PLAN_OVERRIDES, bodyPlan } from "./body-plan.mjs";

// Re-exported so consumers of the module builder get the derivation it used.
export { bodyPlan };

export const MODULE_ID = "dungeons-on-automatic-monsters";
export const MODULE_TITLE = "Dungeons on Automatic Monster Library (GURPS)";
export const SYSTEM_ID = "gurps";
export const PACK_NAME = "doa-monsters";
// Foundry V11 moved packs to LevelDB directories, but the binding constraint is
// the system: GURPS Game Aid 0.18.x declares minimum 13, so a v12 install can
// never run the system this pack is built for. Declaring 12 would let those
// users install a module they cannot use.
//
// `verified` is a claim that someone loaded the module on that generation and
// looked at it. Until the Foundry render pass is recorded against a release,
// that claim rests on the field mapping being checked against the system's
// template.json, not on anyone having opened a sheet.
export const FOUNDRY_COMPATIBILITY = { minimum: "13", verified: "13" };
export const FOUNDRY_BASE_URL = "https://assets.dungeonsonautomatic.com/monsters/enraged-eggplant/foundry";

const ID_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Deterministic 16-character Foundry document id for a monster.
 *
 * Stability is the contract: republishing must update a GM's existing Actors
 * rather than duplicate them, so the id is derived from the monster id alone
 * and never from build state. Changing this derivation is a breaking change
 * for every installed copy of the module.
 */
export function foundryActorId(monsterId) {
  if (!monsterId || typeof monsterId !== "string") {
    throw new Error("foundryActorId requires a non-empty monster id");
  }
  const digest = createHash("sha256").update(`doa-foundry-actor:${monsterId}`, "utf8").digest();
  let id = "";
  for (let i = 0; i < 16; i += 1) id += ID_CHARSET[digest[i] % ID_CHARSET.length];
  return id;
}

/** Parse the leading hex count out of a footprint string like "14 hexes". */
export function footprintHexes(size) {
  const match = /^(\d+)\s*hex/i.exec(String(size?.hexes ?? "").trim());
  return match ? Math.max(1, Number(match[1])) : 1;
}

/**
 * Token grid footprint from the stated hex count: the diameter of the hex
 * "circle" with that area (a radius-1 circle is 7 hexes across 3, radius-2 is
 * 19 across 5). round(sqrt(4n/3)) reproduces those anchors: 1→1, 3→2, 7→3,
 * 14→4, 19→5.
 */
export function tokenGridSize(size) {
  return Math.max(1, Math.round(Math.sqrt((4 * footprintHexes(size)) / 3)));
}

function assertHttpsUrl(value, label, errors) {
  if (typeof value !== "string" || !/^https:\/\/[^ ]+$/.test(value)) {
    errors.push(`${label} is not a well-formed https URL: ${JSON.stringify(value)}`);
  }
}

/** GURPS Game Aid list objects are plain objects keyed "00000", "00001", ... */
function listObject(entries) {
  const object = {};
  entries.forEach((entry, index) => {
    object[String(index).padStart(5, "0")] = entry;
  });
  return object;
}

function gaUuid(actorId, kind, index) {
  return `${actorId}-${kind}-${String(index).padStart(5, "0")}`;
}

function isRangedReach(reach) {
  if (!reach) return false;
  return /ranged|missile|thrown|\d{2,}/i.test(String(reach));
}

/**
 * Hit location tables and the per-record body plan overrides, both tracked.
 *
 * Hit locations have to come from a body plan the Game Aid knows, or its damage
 * application cannot find them, so the tables are its own — see the $comment in
 * the tables file.
 */
export const HIT_LOCATION_PLANS = JSON.parse(
  readFileSync(new URL("../schema/foundry-hit-locations.json", import.meta.url), "utf8"),
).plans;

/**
 * Hit locations for the record's body plan, carrying its DR.
 *
 * The source states one DR for the creature, not a per-location breakdown, so
 * every location gets it. That is what the stat block claims; inventing lower
 * DR for eyes and vitals would be adding a rule the source does not state.
 * Without this the Game Aid renders an armourless monster — 248 of the 304
 * records have DR.
 */
export function hitLocations(dr, plan = "humanoid") {
  const table = HIT_LOCATION_PLANS[plan];
  if (!table) throw new Error(`No hit location table for body plan ${JSON.stringify(plan)}`);
  const value = String(Number(dr) || 0);
  return listObject(table.map(location => ({
    where: location.where,
    import: value,
    equipment: "",
    penalty: String(location.penalty),
    roll: location.roll,
  })));
}

function creditLines(monster) {
  return (monster.provenance?.credits ?? [])
    .map(credit => credit.creditLine)
    .filter(line => typeof line === "string" && line.length > 0);
}

const LICENSE_LABELS = {
  cc_by_4_0: "CC BY 4.0",
  ogl_1_0a: "OGL 1.0a",
};

export function licenseNoteText(monster, packageVersion) {
  const provenance = monster.provenance ?? {};
  const license = LICENSE_LABELS[provenance.contentLicense] ?? provenance.contentLicense ?? "unknown";
  const lines = [
    `${monster.name} — Dungeons on Automatic Monster Library ${packageVersion}.`,
    `Content licence: ${license} (${provenance.contentLicenseUrl}).`,
    ...creditLines(monster),
  ];
  if (provenance.sourceCopyrightNotice) lines.push(provenance.sourceCopyrightNotice);
  lines.push("Package and permission record: https://dungeonsonautomatic.com/monsters");
  return lines.join("\n");
}

function attackEntry(attack, ranged) {
  const base = {
    name: attack.name ?? "Attack",
    import: attack.skill ?? "",
    level: attack.skill ?? 0,
    damage: attack.damage ?? "",
    st: "",
    mode: "",
    weight: "",
    techlevel: "",
    cost: "",
    notes: attack.notes ?? "",
    pageref: "",
    contains: {},
  };
  if (ranged) {
    return { ...base, acc: "", rof: "", shots: "", bulk: "", halfd: "", max: "", range: attack.reach ?? "", legalityclass: "" };
  }
  return { ...base, reach: attack.reach ?? "", parry: "", block: "" };
}

/**
 * One GURPS Game Aid Actor per approved record.
 *
 * Player-facing surfaces (the sheet: attributes, attacks, ads, skills, notes)
 * carry only source statistics, the DOA description, and the licence and
 * credit. CER, threat tier, encounter derivations and review provenance are GM
 * data and live exclusively under the module's flags namespace, which no sheet
 * renders.
 */
export function foundryActor(monster, packageVersion) {
  const actorId = foundryActorId(monster.id);
  const attributes = monster.stats?.attributes ?? {};
  const plan = bodyPlan(monster);
  const gridSize = tokenGridSize(monster.size);
  const melee = [];
  const ranged = [];
  const hazards = [];
  for (const attack of monster.stats?.attacks ?? []) {
    // An attack with no skill is resolved by something other than an attack
    // roll — an acid aura, an engulf, a petrifying gaze. Giving it a weapon row
    // would put a clickable to-hit roll on the sheet for a roll that does not
    // exist, so it keeps its prose instead. The GCS sheet builder splits the
    // same data the same way.
    if (typeof attack.skill !== "number") hazards.push(attack);
    else (isRangedReach(attack.reach) ? ranged : melee).push(attack);
  }
  const notes = [];
  if (monster.description?.text) {
    notes.push({ notes: monster.description.text, pageref: "DOA", contains: {} });
  }
  for (const hazard of hazards) {
    const heading = [hazard.name, hazard.damage, hazard.reach ? `reach ${hazard.reach}` : null]
      .filter(Boolean).join(", ");
    notes.push({
      notes: `${heading}: ${hazard.autoHit ? "No attack roll and no active defence. " : ""}${hazard.notes ?? ""}`.trim(),
      pageref: "DOA",
      contains: {},
    });
  }
  notes.push({ notes: licenseNoteText(monster, packageVersion), pageref: "DOA", contains: {} });

  const attribute = value => ({ import: value ?? 10, value: value ?? 10, points: 0 });

  return {
    _id: actorId,
    _key: `!actors!${actorId}`,
    name: monster.name,
    type: "character",
    img: monster.art?.portrait?.url ?? "",
    system: {
      attributes: {
        ST: attribute(attributes.st),
        DX: attribute(attributes.dx),
        IQ: attribute(attributes.iq),
        HT: attribute(attributes.ht),
        WILL: attribute(attributes.will),
        PER: attribute(attributes.per),
      },
      HP: { value: attributes.hp ?? 0, min: 0, max: attributes.hp ?? 0, points: 0 },
      // 25 records state no FP at all: unliving things that carry "Not Subject
      // to Fatigue" and never spend it. FP 0/0 is the honest rendering of that
      // — the trait is on the sheet to explain it — and it is deliberate rather
      // than a missing value falling through to zero.
      FP: { value: attributes.fp ?? 0, min: 0, max: attributes.fp ?? 0, points: 0 },
      dodge: { value: attributes.dodge ?? 0, enc_level: 0 },
      basicmove: { value: String(attributes.move ?? 0), points: 0 },
      basicspeed: { value: String(attributes.speed ?? 0), points: 0 },
      parry: 0,
      currentmove: attributes.move ?? 0,
      traits: {
        title: monster.name,
        race: monster.class ?? "",
        sizemod: monster.size?.modifier ?? "+0",
      },
      ads: listObject(
        (monster.stats?.traits ?? []).map((trait, index) => ({
          name: trait,
          points: 0,
          notes: "",
          pageref: "",
          uuid: gaUuid(actorId, "ads", index),
          contains: {},
        })),
      ),
      skills: listObject(
        (monster.stats?.skills ?? []).map((skill, index) => ({
          name: skill.name,
          import: skill.level ?? "",
          level: skill.level ?? 0,
          relativelevel: "",
          points: 0,
          notes: "",
          pageref: "",
          uuid: gaUuid(actorId, "skills", index),
          contains: {},
        })),
      ),
      melee: listObject(melee.map((attack, index) => ({
        ...attackEntry(attack, false),
        uuid: gaUuid(actorId, "melee", index),
      }))),
      ranged: listObject(ranged.map((attack, index) => ({
        ...attackEntry(attack, true),
        uuid: gaUuid(actorId, "ranged", index),
      }))),
      notes: listObject(notes.map((note, index) => ({ ...note, uuid: gaUuid(actorId, "notes", index) }))),
      hitlocations: hitLocations(attributes.dr, plan),
      additionalresources: { bodyplan: plan, tracker: {} },
    },
    prototypeToken: {
      name: monster.name,
      // The hex token is the published asset already cropped for a flat-top
      // hex grid; the plain top-down token is its uncropped source.
      texture: { src: monster.art?.hexToken?.url ?? "" },
      width: gridSize,
      height: gridSize,
      disposition: -1,
      actorLink: false,
    },
    ownership: { default: 0 },
    flags: {
      [MODULE_ID]: {
        monsterId: monster.id,
        packageVersion,
        gm: {
          offenseRating: monster.effectiveness?.offenseRating ?? null,
          protectionRating: monster.effectiveness?.protectionRating ?? null,
          combatEffectivenessRating: monster.effectiveness?.combatEffectivenessRating ?? null,
          threatTier: monster.effectiveness?.threatTier ?? null,
          encounter: monster.encounter ?? null,
        },
        provenance: {
          conversionVersion: monster.provenance?.conversionVersion ?? null,
          manualReviewStatus: monster.provenance?.manualReviewStatus ?? null,
        },
        files: monster.files ?? null,
      },
    },
  };
}

export function foundryModuleManifest(pkg) {
  const version = pkg.manifest?.version;
  return {
    id: MODULE_ID,
    title: MODULE_TITLE,
    description:
      "Compendium of the Dungeons on Automatic monster library for the GURPS Game Aid: "
      + "one Actor per approved monster with portrait, hex token, statistics, licence and originator credit. "
      + "Monster mechanics adapted from the Enraged Eggplant fan conversions under recorded unrestricted author "
      + "permission and released CC BY 4.0 with mandatory originator credit; DOA-authored descriptions are CC BY 4.0. "
      + "Each Actor names its own licence in its notes.",
    version,
    compatibility: { ...FOUNDRY_COMPATIBILITY },
    authors: [{ name: "Dungeons on Automatic", url: "https://dungeonsonautomatic.com" }],
    relationships: {
      systems: [{ id: SYSTEM_ID, type: "system", compatibility: {} }],
    },
    packs: [
      {
        name: PACK_NAME,
        label: "DOA Monsters (GURPS)",
        path: `packs/${PACK_NAME}`,
        type: "Actor",
        system: SYSTEM_ID,
        ownership: { PLAYER: "OBSERVER", ASSISTANT: "OWNER" },
      },
    ],
    url: "https://dungeonsonautomatic.com/monsters",
    manifest: `${FOUNDRY_BASE_URL}/module.json`,
    download: `${FOUNDRY_BASE_URL}/${MODULE_ID}-${version}.zip`,
    license: "https://github.com/Zuljita/DungeonsOnAutomaticMonsters/blob/main/LICENSE.md",
    readme: "https://github.com/Zuljita/DungeonsOnAutomaticMonsters/blob/main/docs/foundry/README.md",
    bugs: "https://github.com/Zuljita/DungeonsOnAutomaticMonsters/issues",
  };
}

/**
 * Build the whole module from a published package.
 *
 * Refuses — rather than skips — any record that is not approved with public
 * stats. The published package is supposed to contain only such records; being
 * handed anything else means the input is not a published package, and a
 * silently smaller module would hide that.
 */
export function buildFoundryModule(pkg) {
  const version = pkg?.manifest?.version;
  if (!version) throw new Error("Package has no manifest.version; refusing to build an unversioned module.");
  const monsters = pkg?.monsters;
  if (!Array.isArray(monsters) || monsters.length === 0) {
    throw new Error("Package has no monsters; refusing to build an empty module.");
  }
  // An override naming a record that does not exist is a typo that would
  // otherwise sit silently, still claiming to correct something.
  const ids = new Set(monsters.map(monster => monster.id));
  const strayOverrides = Object.keys(BODY_PLAN_OVERRIDES).filter(id => !ids.has(id));
  if (strayOverrides.length > 0) {
    throw new Error(`schema/foundry-body-plans.json overrides records not in the package: ${strayOverrides.join(", ")}`);
  }
  const unknownPlans = Object.entries(BODY_PLAN_OVERRIDES)
    .filter(([, plan]) => !HIT_LOCATION_PLANS[plan])
    .map(([id, plan]) => `${id} -> ${plan}`);
  if (unknownPlans.length > 0) {
    throw new Error(`schema/foundry-body-plans.json names body plans the Game Aid has no table for: ${unknownPlans.join(", ")}`);
  }

  const ineligible = monsters.filter(
    monster => monster.provenance?.manualReviewStatus !== "approved" || monster.provenance?.publicStats !== true,
  );
  if (ineligible.length > 0) {
    const examples = ineligible.slice(0, 10).map(monster => monster.id).join(", ");
    throw new Error(
      `Refusing to build: ${ineligible.length} of ${monsters.length} records are not approved with public stats. `
        + `Examples: ${examples}`,
    );
  }
  return {
    manifest: foundryModuleManifest(pkg),
    actors: monsters.map(monster => foundryActor(monster, version)),
  };
}

/** Invariant checks for a built module; returns a list of error strings. */
export function validateFoundryModule(module, pkg) {
  const errors = [];
  const { manifest, actors } = module;

  if (!manifest || typeof manifest !== "object") errors.push("module manifest is missing");
  for (const field of ["id", "title", "version", "compatibility", "packs"]) {
    if (!manifest?.[field]) errors.push(`module.json is missing ${field}`);
  }
  if (!manifest?.compatibility?.minimum || !manifest?.compatibility?.verified) {
    errors.push("module.json does not declare compatibility.minimum and compatibility.verified");
  }
  if (manifest?.packs?.[0]?.system !== SYSTEM_ID) {
    errors.push(`module pack does not declare system ${SYSTEM_ID}`);
  }
  assertHttpsUrl(manifest?.manifest, "module.json manifest URL", errors);
  assertHttpsUrl(manifest?.download, "module.json download URL", errors);

  if (actors.length !== pkg.monsters.length) {
    errors.push(`expected ${pkg.monsters.length} actors, built ${actors.length}`);
  }
  const seenIds = new Set();
  actors.forEach((actor, index) => {
    const monster = pkg.monsters[index];
    const label = monster?.id ?? `actor #${index}`;
    if (!/^[A-Za-z0-9]{16}$/.test(actor._id)) errors.push(`${label}: actor id ${actor._id} is not 16 alphanumerics`);
    if (seenIds.has(actor._id)) errors.push(`${label}: duplicate actor id ${actor._id}`);
    seenIds.add(actor._id);
    if (actor._id !== foundryActorId(monster.id)) errors.push(`${label}: actor id is not the stable derivation`);
    if (actor._key !== `!actors!${actor._id}`) errors.push(`${label}: _key does not match _id`);
    assertHttpsUrl(actor.img, `${label}: portrait img`, errors);
    assertHttpsUrl(actor.prototypeToken?.texture?.src, `${label}: token texture`, errors);
    if (!(actor.prototypeToken?.width >= 1) || actor.prototypeToken.width !== tokenGridSize(monster.size)) {
      errors.push(`${label}: token footprint does not follow the stated hex footprint`);
    }
    const plan = actor.system?.additionalresources?.bodyplan;
    const expected = HIT_LOCATION_PLANS[plan];
    const locations = Object.values(actor.system?.hitlocations ?? {});
    if (!expected) {
      errors.push(`${label}: body plan ${JSON.stringify(plan)} is not one the Game Aid knows`);
    } else if (locations.length !== expected.length) {
      errors.push(`${label}: ${plan} has ${expected.length} hit locations, actor has ${locations.length}`);
    } else if (locations.some((location, i) => location.where !== expected[i].where)) {
      errors.push(`${label}: hit location names do not match the ${plan} table`);
    }
    const statedDr = String(Number(monster.stats?.attributes?.dr) || 0);
    if (locations.some(location => location.import !== statedDr)) {
      errors.push(`${label}: hit location DR does not match the record's stated DR of ${statedDr}`);
    }

    // Every weapon row implies a to-hit roll, so every weapon row must come
    // from an attack that states a skill.
    const rollable = (monster.stats?.attacks ?? []).filter(attack => typeof attack.skill === "number");
    const weapons = Object.keys(actor.system?.melee ?? {}).length + Object.keys(actor.system?.ranged ?? {}).length;
    if (weapons !== rollable.length) {
      errors.push(`${label}: ${weapons} weapon row(s) for ${rollable.length} attack(s) that state a skill`);
    }

    const noteTexts = Object.values(actor.system?.notes ?? {}).map(note => note.notes ?? "");
    const licenseNote = noteTexts.find(text => text.includes("Content licence:"));
    if (!licenseNote) {
      errors.push(`${label}: no licence note on the actor`);
    } else {
      if (monster.provenance?.contentLicenseUrl && !licenseNote.includes(monster.provenance.contentLicenseUrl)) {
        errors.push(`${label}: licence note does not name the record's content licence URL`);
      }
      for (const line of creditLines(monster)) {
        if (!licenseNote.includes(line)) errors.push(`${label}: licence note is missing an originator credit line`);
      }
    }
    // GM-only data must live under flags and nowhere a player-facing sheet
    // renders. Serialize everything except flags and look for leaks.
    const playerFacing = JSON.stringify({ ...actor, flags: undefined });
    for (const needle of ["combatEffectivenessRating", "threatTier", "manualReviewStatus", "offenseRating"]) {
      if (playerFacing.includes(needle)) errors.push(`${label}: GM-only field ${needle} leaked outside flags`);
    }
  });
  return errors;
}
