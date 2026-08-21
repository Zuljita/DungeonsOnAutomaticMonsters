// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { stripKyos, stripKyosNotation } from "../review/kyos.mjs";
import { buildRecord } from "../review/build-candidate.mjs";
import { effectivenessFromStats } from "../review/cer.mjs";
import { fixtureRecord } from "./fixtures.mjs";

test("drops the parenthetical and the space that set it off", () => {
  assert.equal(stripKyosNotation("thrust 1d cutting (KYOS: 2d+2 cutting)"), "thrust 1d cutting");
  assert.equal(
    stripKyosNotation("Sharp Teeth (11): thrust 1d cutting (KYOS: 2d+2 cutting), Reach C."),
    "Sharp Teeth (11): thrust 1d cutting, Reach C.",
  );
});

test("counts depth so a nested armor divisor does not end the parenthetical early", () => {
  assert.equal(stripKyosNotation("thrust 2d+2(2) impaling (KYOS: 4d+1(2) impaling)"), "thrust 2d+2(2) impaling");
  assert.equal(
    stripKyosNotation("Morph (Up to 245 points (KYOS: Up to 255 points); Magical; Reduced Time 1)"),
    "Morph (Up to 245 points; Magical; Reduced Time 1)",
  );
});

test("drops every parenthetical in a line, not just the first", () => {
  assert.equal(
    stripKyosNotation("thrust 7d impaling (KYOS: 8d impaling), Acc 3, 75/125 (KYOS: 51/85), T(1)."),
    "thrust 7d impaling, Acc 3, 75/125, T(1).",
  );
});

test("leaves text without the notation, and its own parentheses, alone", () => {
  const untouched = "Boulder (40 lbs.) (11): Range 25 yards, 2d+2 crushing.";
  assert.equal(stripKyosNotation(untouched), untouched);
  // Malformed source is left as it stands rather than truncated at a guess.
  assert.equal(stripKyosNotation("swing 1d cutting (KYOS: 2d cutting"), "swing 1d cutting (KYOS: 2d cutting");
});

test("is idempotent, so a second pass over a stripped package is a no-op", () => {
  const once = stripKyosNotation("thrust 3d-1 crushing (KYOS: 5d+1 crushing), Reach C-3.");
  assert.equal(stripKyosNotation(once), once);
});

test("strips through arrays and objects and leaves non-strings as they are", () => {
  assert.deepEqual(
    stripKyos({ damage: "swing 2d cutting (KYOS: 3d cutting)", skill: 13, reach: null, tags: ["a (KYOS: b)"] }),
    { damage: "swing 2d cutting", skill: 13, reach: null, tags: ["a"] },
  );
});

test("buildRecord ships no KYOS notation and rates the record without it", () => {
  const base = fixtureRecord();
  base.stats.attacks = [{
    name: "Shortsword",
    skill: 13,
    // The two-digit number inside the parenthetical is the whole problem: reach
    // is what the CER path reads to decide an attack is ranged.
    damage: "swing 1d-5 cutting (KYOS: 1d-8 cutting)",
    reach: "C or thrust 1d-6 impaling (KYOS: 1d-10 impaling), Reach C",
    notes: "Shortsword (13): swing 1d-5 cutting (KYOS: 1d-8 cutting), Reach C.",
  }];

  const { record } = buildRecord(base);
  const [attack] = record.stats.attacks;
  assert.equal(attack.damage, "swing 1d-5 cutting");
  assert.equal(attack.reach, "C or thrust 1d-6 impaling, Reach C");
  assert.equal(attack.notes, "Shortsword (13): swing 1d-5 cutting, Reach C.");
  assert.ok(!JSON.stringify(record).includes("KYOS"), "no KYOS notation survives anywhere in the record");

  // Rating the unstripped stats reads "1d-10" in reach as a two-digit range and
  // credits the shortsword with ranged accuracy. The shipped rating must be the
  // other number: the one the stripped stats produce.
  const unstripped = effectivenessFromStats(base.stats, base.name);
  const stripped = effectivenessFromStats(record.stats, record.name);
  assert.notEqual(stripped.offenseRating, unstripped.offenseRating, "the notation changed the rating");
  assert.equal(record.effectiveness.offenseRating, stripped.offenseRating);
  assert.equal(record.effectiveness.combatEffectivenessRating, stripped.combatEffectivenessRating);
});
