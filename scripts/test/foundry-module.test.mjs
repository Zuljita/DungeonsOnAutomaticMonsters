// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HIT_LOCATION_PLANS,
  bodyPlan,
  buildFoundryModule,
  foundryActor,
  foundryActorId,
  licenseNoteText,
  tokenGridSize,
  validateFoundryModule,
} from "../foundry-module.mjs";

const publishedPackage = JSON.parse(readFileSync("converted/doa-monsters.json", "utf8"));

test("actor ids are 16 alphanumerics, deterministic, and frozen", () => {
  const id = foundryActorId("enraged_eggplant_aboleth");
  assert.match(id, /^[A-Za-z0-9]{16}$/);
  assert.equal(id, foundryActorId("enraged_eggplant_aboleth"));
  // Frozen contract: this exact value is what GMs' installed worlds key on.
  // Changing the derivation duplicates every Actor on their next update, so
  // this assertion failing means a breaking change is being made.
  assert.equal(id, "KVXF0YQIO3P5Zk72");
  assert.notEqual(id, foundryActorId("enraged_eggplant_xorn"));
});

test("token footprint follows the hex-circle diameter of the stated footprint", () => {
  assert.equal(tokenGridSize({ hexes: "1 hex" }), 1);
  assert.equal(tokenGridSize({ hexes: "3 hexes" }), 2);
  assert.equal(tokenGridSize({ hexes: "7 hexes" }), 3);
  assert.equal(tokenGridSize({ hexes: "14 hexes" }), 4);
  assert.equal(tokenGridSize({ hexes: "19 hexes" }), 5);
  assert.equal(tokenGridSize({ hexes: null }), 1);
  assert.equal(tokenGridSize(undefined), 1);
});

test("the build refuses unapproved or non-public records instead of skipping them", () => {
  const tampered = structuredClone(publishedPackage);
  tampered.monsters[3].provenance.manualReviewStatus = "pending";
  assert.throws(() => buildFoundryModule(tampered), /Refusing to build: 1 of/);

  const hidden = structuredClone(publishedPackage);
  hidden.monsters[5].provenance.publicStats = false;
  assert.throws(() => buildFoundryModule(hidden), /Refusing to build: 1 of/);
});

test("the published package builds a module that passes every invariant", () => {
  const module_ = buildFoundryModule(publishedPackage);
  assert.equal(module_.actors.length, publishedPackage.monsters.length);
  assert.deepEqual(validateFoundryModule(module_, publishedPackage), []);
});

test("every actor carries its licence and credit where a GM can read them", () => {
  const monster = publishedPackage.monsters[0];
  const note = licenseNoteText(monster, publishedPackage.manifest.version);
  assert.ok(note.includes("CC BY 4.0"));
  assert.ok(note.includes(monster.provenance.contentLicenseUrl));
  for (const credit of monster.provenance.credits) {
    assert.ok(note.includes(credit.creditLine));
  }
});

test("GM-only data lives in module flags and nowhere player-facing", () => {
  const monster = publishedPackage.monsters[0];
  const actor = foundryActor(monster, publishedPackage.manifest.version);
  const flags = actor.flags["dungeons-on-automatic-monsters"];
  assert.equal(flags.gm.combatEffectivenessRating, monster.effectiveness.combatEffectivenessRating);
  const playerFacing = JSON.stringify({ ...actor, flags: undefined });
  assert.ok(!playerFacing.includes("combatEffectivenessRating"));
  assert.ok(!playerFacing.includes("threatTier"));
  assert.ok(!playerFacing.includes("manualReviewStatus"));
});

test("actors map the published art: portrait on the sheet, hex token on the token", () => {
  const monster = publishedPackage.monsters[0];
  const actor = foundryActor(monster, publishedPackage.manifest.version);
  assert.equal(actor.img, monster.art.portrait.url);
  assert.equal(actor.prototypeToken.texture.src, monster.art.hexToken.url);
  assert.equal(actor.prototypeToken.width, tokenGridSize(monster.size));
  assert.equal(actor.prototypeToken.width, actor.prototypeToken.height);
});

test("stated DR reaches every hit location, on every body plan", () => {
  for (const monster of publishedPackage.monsters) {
    const actor = foundryActor(monster, publishedPackage.manifest.version);
    const plan = actor.system.additionalresources.bodyplan;
    const table = HIT_LOCATION_PLANS[plan];
    // The plan has to be one the Game Aid knows, or damage cannot resolve.
    assert.ok(table, `${monster.id}: unknown body plan ${plan}`);
    const locations = Object.values(actor.system.hitlocations);
    assert.equal(locations.length, table.length, `${monster.id}: ${plan} location count`);
    assert.deepEqual(locations.map(l => l.where), table.map(l => l.where), `${monster.id}: location names`);
    const dr = String(Number(monster.stats.attributes.dr) || 0);
    assert.ok(locations.every(location => location.import === dr), `${monster.id}: DR on every location`);
  }
});

test("body plans follow the limbs the record states", () => {
  const plan = id => bodyPlan(publishedPackage.monsters.find(monster => monster.id === id));
  // Four legs and wings, not a humanoid with a cloak.
  assert.equal(plan("enraged_eggplant_white_dragon"), "winged quadruped");
  // Slithers, no arms.
  assert.equal(plan("enraged_eggplant_guardian_naga"), "vermiform");
  // Slithers with a humanoid torso and arms.
  assert.equal(plan("enraged_eggplant_marilith"), "snakeman");
  // Feet used as hands must not read as a second pair of arms.
  assert.equal(plan("enraged_eggplant_ape"), "quadruped");
  // A ring of extra-flexible arms is tentacles.
  assert.equal(plan("enraged_eggplant_darkmantle"), "octopod");
  // Named explicitly: the traits cannot tell a scorpion from a spider.
  assert.equal(plan("enraged_eggplant_monstrous_scorpion_large"), "scorpion");
});

test("hazards that allow no attack roll become notes, not weapon rows", () => {
  const aboleth = publishedPackage.monsters.find(monster => monster.id === "enraged_eggplant_aboleth");
  const mucus = aboleth.stats.attacks.find(attack => attack.name === "Mucus Cloud");
  assert.notEqual(typeof mucus.skill, "number", "fixture: Mucus Cloud states no attack skill");

  const actor = foundryActor(aboleth, publishedPackage.manifest.version);
  const weaponNames = [...Object.values(actor.system.melee), ...Object.values(actor.system.ranged)]
    .map(weapon => weapon.name);
  assert.ok(!weaponNames.includes("Mucus Cloud"), "an unrollable hazard must not get a to-hit row");

  const noteTexts = Object.values(actor.system.notes).map(note => note.notes);
  assert.ok(noteTexts.some(text => text.startsWith("Mucus Cloud")), "the hazard keeps its prose");
});

test("every weapon row corresponds to an attack that states a skill", () => {
  for (const monster of publishedPackage.monsters) {
    const actor = foundryActor(monster, publishedPackage.manifest.version);
    const rollable = monster.stats.attacks.filter(attack => typeof attack.skill === "number").length;
    const weapons = Object.keys(actor.system.melee).length + Object.keys(actor.system.ranged).length;
    assert.equal(weapons, rollable, `${monster.id}: weapon rows must match rollable attacks`);
  }
});
