// SPDX-License-Identifier: MIT
//
// Guards the published package against stale stored ratings (#55 follow-up).
// The script fix alone was not enough: cer.mjs learned to halve FP/spell
// attacks, but Arrowhawk and Earth Mephit kept their pre-fix numbers in
// converted/doa-monsters.json because nothing regenerated them. Stored
// effectiveness must always be what effectivenessFromStats computes today.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { effectivenessFromStats } from "../review/cer.mjs";

const pkg = JSON.parse(readFileSync("converted/doa-monsters.json", "utf8"));

test("every published effectiveness block is reproducible from its record's stats", () => {
  const drifted = [];
  for (const monster of pkg.monsters) {
    if (!monster.stats || !monster.effectiveness) continue;
    const recomputed = effectivenessFromStats(monster.stats, monster);
    if (!recomputed) continue;
    const stored = monster.effectiveness;
    const same =
      stored.offenseRating === recomputed.offenseRating
      && stored.protectionRating === recomputed.protectionRating
      && stored.combatEffectivenessRating === recomputed.combatEffectivenessRating
      && stored.threatTier === recomputed.threatTier;
    if (!same) {
      drifted.push(
        `${monster.name}: stored OR ${stored.offenseRating} PR ${stored.protectionRating} `
        + `CER ${stored.combatEffectivenessRating} (${stored.threatTier}) vs recomputed `
        + `OR ${recomputed.offenseRating} PR ${recomputed.protectionRating} `
        + `CER ${recomputed.combatEffectivenessRating} (${recomputed.threatTier})`,
      );
    }
  }
  assert.deepEqual(drifted, [], `stored ratings drifted from cer.mjs:\n${drifted.join("\n")}`);
});
