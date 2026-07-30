// SPDX-License-Identifier: MIT
//
// The SRD-coverage builds are generated, so the thing worth testing is the
// generator's arithmetic and the invariants that make a generated record
// reviewable: that the stat block cannot disagree with the template it came
// from, that a point total cannot be quietly rounded, and that authorship
// travels with every artifact.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { baseDamage, enhancedMoveMultiplier, resolveDamage, skillPoints } from "../srd/gurps.mjs";
import { TRAITS, traitDisplayName } from "../srd/trait-library.mjs";
import { buildRecord } from "../srd/build-srd-record.mjs";
import { batchMonsters } from "../srd/expand-matrix.mjs";
import { PACKAGE_SOURCE, SOURCE_BOOK_ID, manifest } from "../srd/package-source.mjs";
import { validatePackage } from "../package-validation.mjs";
import { effectivenessFromStats } from "../review/cer.mjs";

const SPEC_DIR = "content/srd-monsters";
const settings = JSON.parse(readFileSync("schema/gcs-monster-settings.json", "utf8"));

const batchFiles = readdirSync(SPEC_DIR)
  .filter(name => name.endsWith(".json"))
  .sort()
  .map(name => ({ path: `${SPEC_DIR}/${name}`, file: JSON.parse(readFileSync(join(SPEC_DIR, name), "utf8")) }));

/** The land-animal batch, named where a test needs a specific record from it. */
const landAnimals = batchFiles.find(entry => entry.file.batch === "land-animals");

function build(spec, entry = landAnimals) {
  return buildRecord(spec, {
    batch: { id: entry.file.batch, issue: entry.file.issue, title: entry.file.title, specPath: entry.path },
    traitSets: entry.file.traitSets ?? {},
    source: PACKAGE_SOURCE,
    packageSourceId: PACKAGE_SOURCE.id,
    sourceBookId: SOURCE_BOOK_ID,
    settings,
  });
}

const built = batchFiles.flatMap(entry => batchMonsters(entry.file).map(spec => build(spec, entry)));

test("the damage table resolves thrust and swing from ST", () => {
  assert.deepEqual(baseDamage(10, "thr"), { dice: 1, modifier: -2 });
  assert.deepEqual(baseDamage(20, "sw"), { dice: 3, modifier: 2 });
  // Above ST 40 the published table steps in fives; a ST between two steps reads
  // the lower one rather than interpolating.
  assert.deepEqual(baseDamage(47, "thr"), baseDamage(45, "thr"));
  assert.equal(resolveDamage(13, "thr-1"), "1d-1");
  assert.equal(resolveDamage(20, "thr", 1), "2d+1");
});

test("skill points follow the 1/2/4 then +4 progression", () => {
  assert.equal(skillPoints("e", 0), 1);
  assert.equal(skillPoints("e", 2), 4);
  assert.equal(skillPoints("a", 0), 2);
  assert.equal(skillPoints("a", 2), 8);
  assert.equal(skillPoints("h", 0), 4);
  assert.throws(() => skillPoints("a", -2));
});

test("Enhanced Move doubles per level and half-levels multiply by 1.5", () => {
  assert.equal(enhancedMoveMultiplier(0), 1);
  assert.equal(enhancedMoveMultiplier(0.5), 1.5);
  assert.equal(enhancedMoveMultiplier(1), 2);
  assert.equal(enhancedMoveMultiplier(2), 4);
});

test("a trait cost that does not price to a whole point is an error, not a rounding", () => {
  // Perception costs 5 a level; a 40% discount on an odd number of levels lands
  // between whole points, which is exactly the silent rounding this refuses.
  assert.throws(
    () => build({
      slug: "fractional",
      name: "Fractional",
      class: "Animal",
      classTags: ["animal"],
      tags: [],
      covers: [{ sourceSystem: "srd_5_1", heading: "Fractional" }],
      sizeModifier: 0,
      hexes: "1 hex",
      traits: [
        { trait: "per", levels: 1, modifiers: [{ name: "Test", reference: "B0", cost_adj: "-10%" }] },
      ],
      skills: [],
      attacks: [],
      encounter: { averageNumberAppearing: 1, wanderingWeight: 1 },
      description: "A test creature that exists only to price a trait badly, so that the builder has something "
        + "to refuse. It is never written to the package.",
    }),
    /not a whole number of points/,
  );
});

test("every ancestry container's points equal the sum of its children", () => {
  for (const { template, record } of built) {
    const container = template.traits[0];
    const childTotal = container.children.reduce((total, child) => total + child.calc.points, 0);
    assert.equal(container.calc.points, childTotal, `${record.name} template total`);
  }
});

test("the sheet reuses the template's children rather than rebuilding them", () => {
  for (const { template, sheet, record } of built) {
    assert.deepEqual(
      sheet.traits[0].children,
      template.traits[0].children,
      `${record.name} sheet and template ancestry`,
    );
    // Attribute adjustments stay at zero so GCS derives them from the ancestry;
    // setting both would count every modifier twice.
    assert.ok(sheet.attributes.every(attribute => attribute.adj === 0));
  }
});

test("Typical Stats are derived from the template, not authored beside it", () => {
  const wolf = built.find(entry => entry.record.id === "doa_wolf");
  const attributes = wolf.record.stats.attributes;
  // ST 13 comes from the ST+3 child, HP follows ST, and Dodge follows Basic
  // Speed. Any of these drifting would mean the stat block and the .gct disagree.
  assert.equal(attributes.st, 13);
  assert.equal(attributes.hp, attributes.st);
  assert.equal(attributes.speed, (attributes.dx + attributes.ht) / 4);
  assert.equal(attributes.dodge, Math.floor(attributes.speed) + 3);
  assert.equal(wolf.record.stats.attacks[0].damage, "1d-1 cutting");
});

test("every published rating is what the consumer CER path produces from the stats", () => {
  for (const { record } of built) {
    const recomputed = effectivenessFromStats(record.stats, record.id);
    assert.equal(record.effectiveness.combatEffectivenessRating, recomputed.combatEffectivenessRating, record.name);
    assert.equal(record.effectiveness.threatTier, recomputed.threatTier, record.name);
  }
});

test("the batch validates as a review-required package", () => {
  const pkg = { manifest: manifest("0.0.0-test", built.length), monsters: built.map(entry => entry.record) };
  assert.deepEqual(validatePackage(pkg, { allowUnapproved: true }), []);
});

test("nothing is approved automatically", () => {
  for (const { record } of built) {
    assert.equal(record.provenance.manualReviewStatus, "review_required", record.name);
  }
});

test("authorship travels with the record, the template and the sheet", () => {
  const credit = PACKAGE_SOURCE.credits[0].creditLine;
  for (const { record, template, sheet } of built) {
    assert.ok(record.tags.includes("ai-generated"), record.name);
    assert.ok(record.tags.includes("monsters-on-automatic"), record.name);
    assert.deepEqual(record.provenance.credits, PACKAGE_SOURCE.credits, record.name);
    assert.ok(template.traits[0].local_notes.includes(credit), `${record.name} template credit`);
    assert.ok(sheet.notes.some(note => note.text === credit), `${record.name} sheet credit`);
  }
});

test("every record names the SRD headings it answers, and none of them twice", () => {
  const claimed = new Map();
  for (const { record } of built) {
    assert.ok(record.provenance.coversSourceIdentities.length > 0, record.name);
    for (const cover of record.provenance.coversSourceIdentities) {
      const key = `${cover.sourceSystem}:${cover.heading}`;
      assert.equal(claimed.get(key), undefined, `${key} is claimed by both ${claimed.get(key)} and ${record.name}`);
      claimed.set(key, record.name);
    }
  }
  // 33 land animals (#37), 20 birds/fish/aquatic (#38), 7 vermin (#39),
  // 4 snakes (#40), 6 dinosaurs (#41), 9 swarms (#36), 6 constructs and
  // awakened plants (#42), and 40 dragons (#35) as ten colours by four ages.
  assert.equal(built.length, 125);
});

test("a spec may only name traits the controlled vocabulary defines", () => {
  const named = new Set();
  for (const { file } of batchFiles) {
    for (const set of Object.values(file.traitSets ?? {})) for (const entry of set) named.add(entry.trait);
    for (const spec of batchMonsters(file)) {
      for (const entry of spec.traits ?? []) named.add(entry.trait);
      for (const id of spec.omitTraits ?? []) named.add(id);
    }
  }
  for (const id of named) assert.ok(TRAITS[id], `trait ${id} is not in the catalogue`);
});

test("a spec that declares a movement block publishes cruising Move, not sprint", () => {
  const declared = built.filter(entry => entry.record.stats.notes.some(note => note.startsWith("Movement:")));
  assert.equal(declared.length, built.length, "every record states its movement modes");

  // The hawk is the sharp case: winged flight puts Air Move at twice Basic
  // Speed, and Enhanced Move 1 doubles that again. Only the first belongs in the
  // published field; the sprint is stated in the note.
  const hawk = built.find(entry => entry.record.id === "doa_hawk");
  assert.equal(hawk.record.stats.attributes.move, 12);
  assert.match(hawk.record.stats.notes.find(note => note.startsWith("Movement:")), /air Move 12, 24 at a sprint/);

  // The land-animal batch predates the corrected rule and must not have moved.
  const cheetah = built.find(entry => entry.record.id === "doa_cheetah");
  assert.equal(cheetah.record.stats.attributes.move, 24);
});

test("every record scaled from a body mass records it", () => {
  for (const { record } of built) {
    const mass = record.size.massKg;
    assert.ok(mass === null || (typeof mass === "number" && mass > 0), `${record.name} massKg`);
  }
  const aquatic = built.filter(entry => entry.record.source.batch === "aquatic-and-avian");
  assert.equal(aquatic.length, 20);
  for (const { record } of aquatic) {
    assert.ok(typeof record.size.massKg === "number", `${record.name} states no mass`);
  }
});

test("a swarm is one creature, and a spec that says otherwise is an error", () => {
  const swarms = built.filter(entry => entry.record.classTags.includes("swarm"));
  assert.equal(swarms.length, 9);
  for (const { record } of swarms) {
    assert.equal(record.encounter.averageNumberAppearing, 1, record.name);
    // Diffuse is what makes a swarm a swarm; without it the record is a group.
    assert.ok(record.stats.traits.includes("Injury Tolerance (Diffuse)"), record.name);
    // Nothing in a swarm allows an attack roll or an active defence.
    assert.ok(record.stats.attacks.every(attack => attack.skill === null), record.name);
  }

  const swarmBatch = batchFiles.find(entry => entry.file.batch === "swarms");
  const spec = structuredClone(swarmBatch.file.monsters.find(entry => entry.slug === "swarm-of-rats"));
  spec.encounter.averageNumberAppearing = 4;
  assert.throws(() => build(spec, swarmBatch), /a swarm appears as one creature/);
});

test("a swarm states literal damage dice instead of deriving them from ST", () => {
  const rats = built.find(entry => entry.record.id === "doa_swarm_of_rats");
  // ST 9 would give thrust 1d-2 by coincidence, so use a swarm whose stated
  // dice cannot be produced from its ST: the quippers are ST 10, thrust 1d-2.
  const quippers = built.find(entry => entry.record.id === "doa_swarm_of_quippers");
  assert.equal(quippers.record.stats.attributes.st, 10);
  assert.equal(quippers.record.stats.attacks[0].damage, "1d+1 cutting");
  assert.ok(rats.record.stats.attacks[0].autoHit);
});

test("a matrix expands to the full cross-product, and each axis stays independent", () => {
  const dragons = built.filter(entry => entry.record.source.batch === "dragons");
  assert.equal(dragons.length, 40, "ten colours by four ages");

  const byName = new Map(dragons.map(entry => [entry.record.name, entry.record]));
  // Age scales the body and knows nothing about colour: every colour at a given
  // age shares its Size Modifier, ST and DR.
  for (const age of ["Wyrmling", "Young", "Adult", "Ancient"]) {
    const cohort = dragons.filter(entry => entry.record.tags.includes(`age-${age.toLowerCase()}`));
    assert.equal(cohort.length, 10, age);
    const [first] = cohort;
    for (const { record } of cohort) {
      assert.equal(record.size.heightSizeModifier, first.record.size.heightSizeModifier, record.name);
      assert.equal(record.stats.attributes.st, first.record.stats.attributes.st, record.name);
      assert.equal(record.stats.attributes.dr, first.record.stats.attributes.dr, record.name);
    }
  }

  // Colour states the weapon and knows nothing about age: the breath is the same
  // substance at every age and only its dice change.
  const breathOf = name => byName.get(name).stats.attacks.find(attack => /Breath/.test(attack.name));
  assert.match(breathOf("Red Dragon Wyrmling").damage, /^3d burning$/);
  assert.match(breathOf("Ancient Red Dragon").damage, /^15d burning$/);
  assert.match(breathOf("Ancient Black Dragon").damage, /^15d corrosion$/);

  // Element immunity is DR against one damage type and must never reach the
  // record's published DR, which is armour against everything.
  const red = byName.get("Ancient Red Dragon");
  assert.ok(red.stats.traits.some(trait => /Damage Resistance 15 \(Fire; Limited/.test(trait)));
  assert.equal(red.stats.attributes.dr, 12);
});

test("a primary medium the build grants no movement for is an error", () => {
  const spec = structuredClone(landAnimals.file.monsters.find(entry => entry.slug === "wolf"));
  spec.movement = { primary: "water" };
  assert.throws(() => build(spec), /primary medium water has no movement/);
});

test("a levelled trait prints its level and its modifiers in the published trait line", () => {
  assert.equal(traitDisplayName({ trait: "night-vision", levels: 5 }), "Night Vision 5");
  assert.equal(
    traitDisplayName({ trait: "damage-resistance-tough-skin", levels: 2 }),
    "Damage Resistance 2 (Tough Skin)",
  );
  assert.equal(
    traitDisplayName({ trait: "enhanced-move-ground", levels: 0.5, qualifier: "Ground" }),
    "Enhanced Move 0.5 (Ground)",
  );
});
