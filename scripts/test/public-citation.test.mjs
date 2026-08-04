// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  citesOnlyLicensedSources,
  monsterPageCollisions,
  monsterPageSlug,
  monsterPageUrl,
  publicCitation,
  publicPageRef,
  publicSourceName,
} from "../public-citation.mjs";
import { PUBLIC_BESTIARY_URL } from "../package-identity.mjs";
import { validatePackage } from "../package-validation.mjs";
import { CREDIT, fixturePackage, fixtureRecord } from "./fixtures.mjs";

/** A converted record cites the books its author worked from; the SRD tag is the lineage. */
const converted = fixtureRecord({
  name: "Aboleth",
  tags: ["fan-authorized", "srd-3-5", "aberration"],
  pageRef: "Aboleth [Monster Manual, page 8, Expanded Psionics Handbook, page 185]",
  provenance: {
    ...fixtureRecord().provenance,
    sourceName: "Aboleth [Monster Manual, page 8, Expanded Psionics Handbook, page 185]",
  },
});

/** An authored coverage record states the SRD headings it answers to. */
const authored = fixtureRecord({
  id: "doa_oni",
  name: "Oni",
  tags: ["monsters-on-automatic", "srd-5-1", "srd-3-5", "giant"],
  pageRef: "Oni [Monsters on Automatic, SRD coverage: humanoid folk; answers Oni (SRD 5.1); Ogre Mage (SRD 3.5)]",
  provenance: {
    ...fixtureRecord().provenance,
    sourceName: "Oni [Monsters on Automatic, SRD coverage: humanoid folk and their sub-races]",
    credits: [{ ...CREDIT, name: "Monsters on Automatic" }],
    coversSourceIdentities: [
      { sourceSystem: "srd_5_1", heading: "Oni", relationship: "published", alsoPrintedAs: [] },
      { sourceSystem: "srd_3_5", heading: "Ogre Mage", relationship: "published", alsoPrintedAs: [] },
    ],
  },
});

test("the slug is the site's, so the published link resolves to a page it serves", () => {
  // Checked against directories the site actually generates under monsters/.
  assert.equal(monsterPageSlug("Aboleth"), "aboleth");
  assert.equal(monsterPageSlug("Bear, Black"), "bear-black");
  assert.equal(monsterPageSlug("Will-o’-Wisp"), "will-o-wisp");
  assert.equal(monsterPageSlug("Half-Elf"), "half-elf");
  assert.equal(monsterPageSlug("Warhorse, Heavy"), "warhorse-heavy");
});

test("a record links to its own page, not to the bestiary index", () => {
  // The record id names its source package; the public URL must not, and a
  // consumer deep-linking `${packageUrl}#${id}` lands on the index instead of
  // the creature. The package states the page so nobody has to guess it.
  assert.equal(monsterPageUrl("Aboleth"), "https://dungeonsonautomatic.com/monsters/aboleth/");
  assert.ok(monsterPageUrl("Aboleth").startsWith(`${PUBLIC_BESTIARY_URL}/`));
  assert.ok(monsterPageUrl("Aboleth").endsWith("/"), "the site's canonical carries the trailing slash");
  assert.equal(monsterPageUrl("Aboleth", "https://example.invalid/monsters/"), "https://example.invalid/monsters/aboleth/");
  assert.equal(monsterPageUrl("   "), null);
});

test("a citation names who built the record, not the books its author worked from", () => {
  // The SRD prints no GURPS: crediting it with the statistics would be the same
  // overclaim as the Monster Manual line, pointed the other way. The builder
  // made them; the SRD supplied the identity they answer to.
  assert.equal(publicPageRef(converted), "Aboleth (Fixture Author; answers SRD 3.5)");
  assert.ok(!publicPageRef(converted).includes("Monster Manual"));
});

test("an authored record is credited to this project, and the fan conversion is not", () => {
  assert.ok(publicPageRef(authored).startsWith("Oni (Monsters on Automatic;"));
  assert.ok(!publicPageRef(converted).includes("Monsters on Automatic"));
});

test("an edition whose SRD heading differs is cited under the heading a reader would find", () => {
  // 3.5 prints the Oni as "Ogre Mage"; 5.1 prints it under this record's name.
  assert.equal(publicPageRef(authored), "Oni (Monsters on Automatic; answers SRD 3.5: Ogre Mage, SRD 5.1)");
});

test("both SRDs printing the identity are cited, in edition order", () => {
  const bat = fixtureRecord({ name: "Bat", tags: ["srd-5-1", "srd-3-5"] });
  assert.equal(publicPageRef(bat), "Bat (Fixture Author; answers SRD 3.5, SRD 5.1)");
});

test("a record states the half of the chain it has rather than inventing the other", () => {
  const noLineage = fixtureRecord({ name: "Fixture Biter", tags: ["fan-authorized"] });
  assert.equal(publicPageRef(noLineage), "Fixture Biter (Fixture Author)");

  const noBuilder = fixtureRecord({
    name: "Fixture Biter",
    tags: ["srd-3-5"],
    provenance: { ...fixtureRecord().provenance, credits: [{ ...CREDIT, role: "contributor" }] },
  });
  assert.equal(publicPageRef(noBuilder), "Fixture Biter (answers SRD 3.5)");
});

test("the source's own name survives publication; its citation to another book does not", () => {
  assert.equal(publicSourceName(converted), "Aboleth");
  assert.equal(
    publicSourceName(authored),
    "Oni [Monsters on Automatic, SRD coverage: humanoid folk and their sub-races]",
  );
});

test("the citation allowlist keeps this package's sources and drops everyone else's", () => {
  assert.ok(citesOnlyLicensedSources("Bat [Monsters on Automatic, SRD coverage: mundane birds]"));
  assert.ok(citesOnlyLicensedSources("Aboleth (SRD 3.5)"));
  assert.ok(citesOnlyLicensedSources("Aboleth"));
  assert.ok(!citesOnlyLicensedSources("Aboleth [Monster Manual, page 8]"));
  assert.ok(!citesOnlyLicensedSources("Xill [Monster Manual II, page 189]"));
  // An unlisted book is dropped too: the rule names what may be cited, not what may not.
  assert.ok(!citesOnlyLicensedSources("Thing [A Book Nobody Has Thought Of, page 1]"));
});

test("promotion states all three citation fields for a record", () => {
  const citation = publicCitation(converted);
  assert.deepEqual(citation, {
    pageRef: "Aboleth (Fixture Author; answers SRD 3.5)",
    sourceName: "Aboleth",
    bestiaryUrl: "https://dungeonsonautomatic.com/monsters/aboleth/",
  });
});

test("a record whose name has no page cannot be published", () => {
  assert.throws(() => publicCitation(fixtureRecord({ name: "—" })), /no public monster page/);
});

test("two records may not claim one monster page", () => {
  // The site fails its build on a slug collision rather than overwrite a page;
  // catching it here means the package never ships a link the site cannot serve.
  const collisions = monsterPageCollisions([
    fixtureRecord({ id: "enraged_eggplant_goblin", name: "Goblin" }),
    fixtureRecord({ id: "doa_goblin", name: "Goblin" }),
    fixtureRecord({ id: "doa_nameless", name: "—" }),
  ]);
  assert.equal(collisions.length, 2);
  assert.ok(collisions.some(entry => entry.includes("enraged_eggplant_goblin") && entry.includes("doa_goblin")));
  assert.ok(collisions.some(entry => entry.includes("doa_nameless")));
});

test("publishing refuses a citation to a book this package does not licence", () => {
  const errors = validatePackage(fixturePackage([converted]), {
    allowUnapproved: true,
    requirePublicCitations: true,
  });
  assert.ok(errors.some(error => error.includes("pageRef cites a source this package does not licence")));
  assert.ok(errors.some(error => error.includes("sourceName cites a source this package does not licence")));
  assert.ok(errors.some(error => error.includes("bestiaryUrl must state the record's public monster page")));
});

test("publishing accepts the record promotion actually writes", () => {
  const citation = publicCitation(converted);
  const promoted = {
    ...converted,
    pageRef: citation.pageRef,
    provenance: { ...converted.provenance, sourceName: citation.sourceName, bestiaryUrl: citation.bestiaryUrl },
  };
  const errors = validatePackage(fixturePackage([promoted]), {
    allowUnapproved: true,
    requirePublicCitations: true,
  });
  assert.deepEqual(errors.filter(error => /pageRef|sourceName|bestiaryUrl/.test(error)), []);
});

test("a stated bestiary url must be openable wherever it appears", () => {
  const broken = {
    ...converted,
    provenance: { ...converted.provenance, bestiaryUrl: "monsters/aboleth/" },
  };
  const errors = validatePackage(fixturePackage([broken]), { allowUnapproved: true });
  assert.ok(errors.some(error => error.includes("bestiaryUrl must be an absolute http(s) URL")));
});

test("the tracked public package is held to the citation policy by npm test", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.match(pkg.scripts["validate:public"], /--require-public-citations/);
});

test("both promotion scripts cite through the shared helper, not their own literals", () => {
  for (const script of ["../build-library-package.mjs", "../build-enraged-eggplant-package.mjs"]) {
    const source = readFileSync(new URL(script, import.meta.url), "utf8");
    assert.ok(source.includes("publicCitation("), `${script} should publish through publicCitation`);
    assert.ok(source.includes("monsterPageCollisions("), `${script} should refuse colliding monster pages`);
    assert.ok(
      source.includes("requirePublicCitations: true"),
      `${script} should validate its output under the citation policy`,
    );
  }
});
