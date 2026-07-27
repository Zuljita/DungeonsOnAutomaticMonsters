// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DESCRIPTION_CONTENT_LICENSE,
  DESCRIPTION_NOTE,
  applyDescription,
  checkDescriptionPolicy,
  checkDescriptionShape,
  describedField,
  validateDescriptionFile,
  validateDescriptionText,
} from "../review/descriptions.mjs";
import { buildRecord } from "../review/build-candidate.mjs";
import { validatePackage } from "../package-validation.mjs";
import { fixturePackage, fixtureRecord } from "./fixtures.mjs";

const PROSE =
  "A four-legged scavenger about the size of a large dog, plated in dull chitin, that smells worked metal "
  + "across a room and wants nothing else in the world.";

function fixtureEntry(overrides = {}) {
  return { recordId: "fixture_biter", monster: "Fixture Biter", text: PROSE, basis: ["record.stats.traits"], ...overrides };
}

test("a description carries its own authorship and licence, not the record's", () => {
  const field = describedField(fixtureEntry());
  assert.equal(field.authorship, "doa_authored");
  assert.equal(field.contentLicense, DESCRIPTION_CONTENT_LICENSE);
  assert.ok(field.contentLicenseUrl.length > 0);
});

test("every record carries the description key, null when nothing is authored", () => {
  const described = applyDescription(fixtureRecord(), fixtureEntry());
  const undescribed = applyDescription(fixtureRecord(), null);
  assert.equal(described.description.text, PROSE);
  assert.equal(undescribed.description, null);
  assert.ok("description" in undescribed);
  assert.deepEqual(checkDescriptionPolicy(undescribed), []);
});

test("the description sits with the flavour fields rather than after provenance", () => {
  const keys = Object.keys(applyDescription(fixtureRecord(), fixtureEntry()));
  assert.equal(keys[keys.indexOf("lair") + 1], "description");
  assert.ok(keys.indexOf("description") < keys.indexOf("provenance"));
});

test("re-applying a description replaces it rather than appending a second key", () => {
  const once = applyDescription(fixtureRecord(), fixtureEntry());
  const twice = applyDescription(once, fixtureEntry({ text: `${PROSE} It eats the flakes.` }));
  assert.equal(Object.keys(twice).filter(key => key === "description").length, 1);
  assert.match(twice.description.text, /flakes/);
});

test("image-prompt phrasing is rejected: the seed is raw material, not the deliverable", () => {
  const promptish =
    "Depict one low heavy lizard in a readable three-quarter full-body view with a strong silhouette and "
    + "enough edge padding for responsive cropping.";
  const errors = validateDescriptionText(promptish, "d");
  assert.ok(errors.length >= 3, `expected several prompt tells, got ${errors.length}`);
  assert.deepEqual(validateDescriptionText(PROSE, "d"), []);
});

test("a description must say what it was written from, and only from project-owned material", () => {
  const missing = validateDescriptionFile({
    version: 1,
    title: "t",
    descriptions: [fixtureEntry({ basis: [] })],
  });
  assert.ok(missing.some(error => /basis/.test(error)));

  // SRD prose is OGL 1.0a. It is not a permitted basis for a CC BY field, and
  // the content file cannot claim it as one.
  const srd = validateDescriptionFile({
    version: 1,
    title: "t",
    descriptions: [fixtureEntry({ basis: ["srd.3.5.rawText"] })],
  });
  assert.ok(srd.some(error => /unsupported value srd\.3\.5\.rawText/.test(error)));
});

test("duplicate record ids in the content file are rejected", () => {
  const errors = validateDescriptionFile({
    version: 1,
    title: "t",
    descriptions: [fixtureEntry(), fixtureEntry()],
  });
  assert.ok(errors.some(error => /duplicates fixture_biter/.test(error)));
});

test("a published description may not relabel its own authorship or licence", () => {
  const record = applyDescription(fixtureRecord(), fixtureEntry());
  record.description.authorship = "author_permission";
  assert.ok(checkDescriptionShape(record).some(error => /authorship must be doa_authored/.test(error)));

  const relicensed = applyDescription(fixtureRecord(), fixtureEntry());
  relicensed.description.contentLicense = "ogl_1_0a";
  assert.ok(checkDescriptionShape(relicensed).some(error => /contentLicense must be cc_by_4_0/.test(error)));
});

test("undeclared keys on the description are rejected", () => {
  const record = applyDescription(fixtureRecord(), fixtureEntry());
  record.description.sourceUrl = "https://example.invalid/srd";
  assert.ok(checkDescriptionShape(record).some(error => /sourceUrl is not part of the field contract/.test(error)));
});

test("package validation accepts a package released before the field existed", () => {
  const pkg = fixturePackage();
  for (const monster of pkg.monsters) delete monster.description;
  assert.deepEqual(validatePackage(pkg, { allowUnapproved: true }), []);
});

test("package validation rejects a malformed description", () => {
  const pkg = fixturePackage();
  pkg.monsters[0].description = { text: "too short" };
  assert.ok(validatePackage(pkg).some(error => /description/.test(error)));
});

test("a described record states the authorship in its provenance notes", () => {
  const described = buildRecord(fixtureRecord(), { description: fixtureEntry() });
  assert.ok(described.record.provenance.conversionNotes.includes(DESCRIPTION_NOTE));

  const undescribed = buildRecord(fixtureRecord(), {});
  assert.ok(!undescribed.record.provenance.conversionNotes.includes(DESCRIPTION_NOTE));
});

test("the tracked content file is valid and its prose passes the same checks", () => {
  const file = JSON.parse(readFileSync("content/descriptions/enraged-eggplant.json", "utf8"));
  assert.deepEqual(validateDescriptionFile(file), []);
  assert.ok(file.descriptions.length > 0);
  for (const entry of file.descriptions) {
    assert.deepEqual(validateDescriptionText(entry.text, entry.recordId), []);
  }
});
