// SPDX-License-Identifier: MIT
//
// The creature's body plan, from the limb structure its own traits state.
//
// Two artifacts need this and must agree: the GCS sheet, whose `body_type`
// decides the hit locations GCS renders and the table name the Game Aid's
// importer reads, and the Foundry Actor, whose hit locations are written
// directly. One derivation, two consumers — a monster that is a naga in one and
// a humanoid in the other is worse than either being wrong alone.
//
// The source never names a body plan, but it does say how many legs a creature
// walks on and whether it has arms, wings or tentacles, which is the same
// information. Reading it from the traits keeps 304 creatures consistent with
// the stat block instead of with someone's memory of the monster.

import { readFileSync } from "node:fs";

const BODY_PLAN_OVERRIDES = JSON.parse(
  readFileSync(new URL("../schema/foundry-body-plans.json", import.meta.url), "utf8"),
).overrides;

export { BODY_PLAN_OVERRIDES };

/**
 * Two distinctions do the most work here:
 *
 *  - "Extra Arms (Foot Manipulators)" is a creature using its feet as hands — an
 *    ape, a bird of prey — not a torso with a pair of arms on it. Counting those
 *    as arms turns every ape into a centaur.
 *  - Four or more extra-flexible arms is a ring of tentacles, not limbs, which
 *    is what separates an octopus from a spider and a squid from a fish.
 *
 * Where the traits genuinely cannot tell two plans apart — a scorpion and an
 * eight-legged basilisk state the same limbs — the derivation takes the general
 * answer and the specific one is named in schema/foundry-body-plans.json.
 *
 * @param {object} monster a package record
 * @returns {string} a body plan key present in schema/foundry-hit-locations.json
 */
export function bodyPlan(monster) {
  const override = BODY_PLAN_OVERRIDES[monster.id];
  if (override) return override;

  const traits = monster.stats?.traits ?? [];
  const joined = traits.join(" | ");
  const has = pattern => pattern.test(joined);
  const extraArms = traits.filter(trait => /^Extra Arms\b/i.test(trait));

  const arms = extraArms.some(trait => !/Foot Manipulators/i.test(trait))
    || has(/Extra-Flexible Long .*\bArms\b/i);
  const tentacles = extraArms.some(trait =>
    Number(/Extra Arms (\d+)/i.exec(trait)?.[1] ?? 0) >= 4 && /Extra-Flexible/i.test(trait));
  // Small Wings is still wings — a pixie, a giant wasp, a dragonne. Only
  // wingless flight (Magical, Lighter Than Air) leaves the body plan unchanged.
  const winged = has(/Flight[^|]*(Winged|Small Wings)/i);
  const beast = ["animal", "magical-beast", "dragon", "vermin"]
    .some(tag => (monster.classTags ?? []).includes(tag));

  if (has(/No Legs \((Aquatic|Semi-Aquatic)\)/i)) return tentacles ? "squid" : "ichthyoid";
  if (has(/Eight Legs/i)) return tentacles ? "octopod" : "arachnoid";
  if (has(/No Legs \(Slithers\)/i)) {
    if (tentacles) return "octopod";
    if (arms) return "snakeman";
    return winged ? "winged vermiform" : "vermiform";
  }
  // Sessile things — an assassin vine, a shrieker — have a trunk and no limbs.
  if (has(/No Legs \(Sessile\)/i)) return "vermiform";
  if (has(/Six Legs/i)) return winged ? "winged hexapod" : "hexapod";
  if (has(/Four Legs/i)) {
    if (arms) return "centaur";
    return winged ? "winged quadruped" : "quadruped";
  }
  if (winged && beast && !arms) return "avian";
  if (winged) return "winged humanoid";
  return "humanoid";
}
