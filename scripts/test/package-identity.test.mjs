// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PUBLIC_BESTIARY_URL,
  PUBLIC_LIBRARY_NAME,
  PUBLIC_PACKAGE_ID,
  publicPackageIdentity,
} from "../package-identity.mjs";
import { fixturePackage } from "./fixtures.mjs";

const CANDIDATE = fixturePackage().manifest;

test("a promoted package is shelved under the Dungeons on Automatic library name", () => {
  const identity = publicPackageIdentity(CANDIDATE);
  assert.equal(identity.name, PUBLIC_LIBRARY_NAME);
  assert.equal(identity.sourceBook.name, PUBLIC_LIBRARY_NAME);
  assert.equal(identity.id, PUBLIC_PACKAGE_ID);
});

test("the source-book id survives the rename, because consumers store it", () => {
  // Dungeons on Automatic writes this id into every saved profile and dungeon
  // state as an enabled source book. Restyling the label must never move the key.
  const identity = publicPackageIdentity(CANDIDATE);
  assert.equal(identity.sourceBook.id, CANDIDATE.sourceBook.id);
});

test("the source book stays an optional derived toggle", () => {
  const identity = publicPackageIdentity(CANDIDATE);
  assert.equal(identity.sourceBook.required, false);
  assert.equal(identity.sourceBook.derived, true);
});

test("renaming the shelf never touches originator credit", () => {
  // Credit is a licence condition; the identity helper writes labels only, so
  // it must return nothing that could overwrite credits or sources on spread.
  const identity = publicPackageIdentity(CANDIDATE);
  assert.equal(identity.credits, undefined);
  assert.equal(identity.sources, undefined);

  const published = { ...CANDIDATE, ...identity };
  assert.deepEqual(published.credits, CANDIDATE.credits);
  assert.deepEqual(published.sources, CANDIDATE.sources);
  assert.equal(published.credits[0].role, "originator");
  assert.equal(published.credits[0].creditLine, CANDIDATE.credits[0].creditLine);
});

test("the bestiary url is the one the site serves, not the redirecting alias", () => {
  // Every record's published page hangs off this base as `${packageUrl}/${slug}/`
  // (see public-citation.mjs); /monsters.html 308s to /monsters, and a citation
  // should not spend a redirect.
  const identity = publicPackageIdentity(CANDIDATE);
  assert.equal(identity.packageUrl, PUBLIC_BESTIARY_URL);
  assert.ok(!identity.packageUrl.endsWith(".html"));
});

test("the promotion script publishes through the shared identity, not its own literals", () => {
  const source = readFileSync(new URL("../build-enraged-eggplant-package.mjs", import.meta.url), "utf8");
  assert.ok(
    source.includes("publicPackageIdentity(candidate.manifest)"),
    "build-enraged-eggplant-package.mjs should apply the shared identity",
  );
  assert.ok(
    !source.includes("Enraged Eggplant Monster Library"),
    "the old shelf name should no longer be hard-coded in the promotion script",
  );
});
