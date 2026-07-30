// SPDX-License-Identifier: MIT
//
// The controlled GURPS 4e trait vocabulary the SRD-coverage monster builds draw on.
//
// ROADMAP.md's authorship rule allows a first draft only the applicable SRD
// record, an approved mechanical vocabulary, and the public package contract as
// inputs. This module *is* that vocabulary: a closed catalogue of published
// GURPS Basic Set traits, each with its page reference, its cost model and the
// features and natural weapons the trait grants. A monster spec may only name
// traits that appear here, so a reviewer checking a build never has to ask where
// a cost came from — it came from this table, and the table cites its page.
//
// Nothing here is copied from another conversion. Costs and page references are
// facts about the published rules; the feature and weapon shapes are the GCS v5
// encoding of those facts, written to the same schema GCS itself reads.
//
// Cost model, one of:
//   basePoints    a flat-cost trait
//   pointsPerLevel a levelled trait; the spec supplies `levels`
//
// `attribute` marks the traits that move a derived statistic, so the builder can
// compute a record's Typical Stats from the same list that produces its .gct and
// the two cannot disagree.

/** Attribute-adjusting traits, keyed by the attribute they move. */
const ATTRIBUTE_TRAITS = {
  st: { increase: "B14", decrease: "B14", cost: 10 },
  dx: { increase: "B15", decrease: "B15", cost: 20 },
  iq: { increase: "B15", decrease: "B15", cost: 20 },
  ht: { increase: "B14", decrease: "B14", cost: 10 },
  hp: { increase: "B16", decrease: "B16", cost: 2 },
  will: { increase: "B16", decrease: "B16", cost: 5 },
  per: { increase: "B16", decrease: "B16", cost: 5 },
  fp: { increase: "B16", decrease: "B16", cost: 3 },
  move: { increase: "B17", decrease: "B17", cost: 5 },
  sm: { increase: "B19", decrease: "B19", cost: 0 },
};

const ATTRIBUTE_LABEL = {
  st: "Strength",
  dx: "Dexterity",
  iq: "Intelligence",
  ht: "Health",
  hp: "Hit Points",
  will: "Will",
  per: "Perception",
  fp: "Fatigue Points",
  move: "Basic Move",
  sm: "Size Modifier",
};

const ATTRIBUTE_TAGS = {
  st: ["Attribute", "Physical"],
  dx: ["Attribute", "Physical"],
  iq: ["Attribute", "Mental"],
  ht: ["Attribute", "Physical"],
  hp: ["Attribute", "Physical"],
  will: ["Attribute", "Mental"],
  per: ["Attribute", "Mental", "Physical"],
  fp: ["Attribute", "Physical"],
  move: ["Attribute", "Physical"],
  sm: ["Attribute", "Physical"],
};

function attributeTrait(key, direction) {
  const definition = ATTRIBUTE_TRAITS[key];
  const increasing = direction === "increase";
  const verb = increasing
    ? (key === "fp" ? "Extra" : "Increased")
    : (key === "fp" ? "Fewer" : "Decreased");
  return {
    name: `${verb} ${ATTRIBUTE_LABEL[key]}`,
    reference: increasing ? definition.increase : definition.decrease,
    tags: [increasing ? "Advantage" : "Disadvantage", ...ATTRIBUTE_TAGS[key]].sort(),
    pointsPerLevel: increasing ? definition.cost : -definition.cost,
    attribute: { id: key, amount: increasing ? 1 : -1 },
  };
}

/**
 * Natural-weapon damage shapes. `st` names the swing/thrust base GCS applies,
 * `base` the flat adjustment, `type` the GURPS damage abbreviation.
 */
function naturalWeapon(usage, damage, reach, defaults, extra = {}) {
  return { usage, damage, reach, defaults, ...extra };
}

const BRAWLING_DEFAULTS = [{ type: "dx" }, { type: "skill", name: "Brawling" }];
const KICK_DEFAULTS = [
  { type: "dx", modifier: -2 },
  { type: "skill", name: "Brawling", modifier: -2 },
];

/**
 * The catalogue. Ids are the stable keys a monster spec cites; they never appear
 * in published output, so they can stay terse.
 */
export const TRAITS = {
  // --- Attributes -----------------------------------------------------------
  st: attributeTrait("st", "increase"),
  "st-": attributeTrait("st", "decrease"),
  dx: attributeTrait("dx", "increase"),
  "dx-": attributeTrait("dx", "decrease"),
  iq: attributeTrait("iq", "increase"),
  "iq-": attributeTrait("iq", "decrease"),
  ht: attributeTrait("ht", "increase"),
  "ht-": attributeTrait("ht", "decrease"),
  hp: attributeTrait("hp", "increase"),
  "hp-": attributeTrait("hp", "decrease"),
  will: attributeTrait("will", "increase"),
  "will-": attributeTrait("will", "decrease"),
  per: attributeTrait("per", "increase"),
  "per-": attributeTrait("per", "decrease"),
  fp: attributeTrait("fp", "increase"),
  "fp-": attributeTrait("fp", "decrease"),
  "basic-move": attributeTrait("move", "increase"),
  "basic-move-": attributeTrait("move", "decrease"),
  sm: attributeTrait("sm", "increase"),
  "sm-": attributeTrait("sm", "decrease"),

  // --- Senses ---------------------------------------------------------------
  "acute-hearing": {
    name: "Acute Hearing",
    reference: "B35",
    tags: ["Advantage", "Physical"],
    pointsPerLevel: 2,
  },
  "acute-taste-smell": {
    name: "Acute Taste and Smell",
    reference: "B35",
    tags: ["Advantage", "Physical"],
    pointsPerLevel: 2,
  },
  "acute-vision": {
    name: "Acute Vision",
    reference: "B35",
    tags: ["Advantage", "Physical"],
    pointsPerLevel: 2,
  },
  "discriminatory-smell": {
    name: "Discriminatory Smell",
    reference: "B49",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 15,
    features: [
      {
        type: "skill_bonus",
        selection_type: "skills_with_name",
        name: { compare: "is", qualifier: "Tracking" },
        amount: 4,
      },
      { type: "conditional_modifier", situation: "on any task that uses the sense of smell", amount: 4 },
    ],
  },
  "night-vision": {
    name: "Night Vision",
    reference: "B71",
    tags: ["Advantage", "Physical"],
    pointsPerLevel: 1,
  },
  "peripheral-vision": {
    name: "Peripheral Vision",
    reference: "B74",
    tags: ["Advantage", "Physical"],
    basePoints: 15,
  },
  "dark-vision": {
    name: "Dark Vision",
    reference: "B47",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 25,
  },
  "nictitating-membrane": {
    name: "Nictitating Membrane",
    reference: "B71",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 1,
  },
  "telescopic-vision": {
    name: "Telescopic Vision",
    reference: "B92",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 5,
  },
  ultrahearing: {
    name: "Ultrahearing",
    reference: "B94",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  "scanning-sense-sonar": {
    name: "Scanning Sense (Sonar)",
    reference: "B81",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 20,
  },
  "vibration-sense-water": {
    name: "Vibration Sense (Water)",
    reference: "B96",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 10,
  },
  "vibration-sense-air": {
    name: "Vibration Sense (Air)",
    reference: "B96",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 10,
  },
  infravision: {
    name: "Infravision",
    reference: "B60",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 10,
  },

  // --- Body and movement ----------------------------------------------------
  "extra-legs-four": {
    name: "Extra Legs (Four Legs)",
    reference: "B54",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  "enhanced-move-ground": {
    name: "Enhanced Move",
    reference: "B52",
    tags: ["Advantage", "Exotic", "Physical"],
    // Enhanced Move is bought in half levels; the builder passes the level and
    // prices it at 20 points per full level, which is the published rate.
    pointsPerLevel: 20,
    movementDoubling: "ground",
  },
  "enhanced-move-air": {
    name: "Enhanced Move",
    reference: "B52",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 20,
    movementDoubling: "air",
  },
  "enhanced-move-water": {
    name: "Enhanced Move",
    reference: "B52",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 20,
    movementDoubling: "water",
  },
  "flight-winged": {
    name: "Flight",
    reference: "B56",
    tags: ["Advantage", "Exotic", "Physical"],
    // Flight [40] with the Winged limitation. Winged flight sets Air Move at
    // twice Basic Speed, which is where a bird's real speed comes from — not
    // from Enhanced Move, which is the sprint on top of it.
    basePoints: 40,
    modifiers: [
      {
        name: "Winged",
        reference: "B56",
        cost_adj: "-25%",
        local_notes: "Requires room to spread and beat wings; a grounded or bound flier cannot use it.",
      },
    ],
    grantsMovement: "air",
  },
  "no-legs-aquatic": {
    name: "No Legs (Aquatic)",
    reference: "B145",
    tags: ["Disadvantage", "Exotic", "Physical"],
    // A fish's body plan costs nothing: it is neither an advantage nor a
    // handicap in the water it never leaves.
    basePoints: 0,
    grantsMovement: "water",
  },
  "gills": {
    name: "Doesn't Breathe (Gills)",
    reference: "B49",
    tags: ["Advantage", "Exotic", "Physical"],
    // Doesn't Breathe [20] with the Gills limitation: no air needed, and no
    // water means suffocation.
    basePoints: 20,
    modifiers: [
      {
        name: "Gills",
        reference: "B49",
        cost_adj: "-50%",
        local_notes: "Breathes water, not air; suffocates out of it.",
      },
    ],
    grantsMovement: "water",
  },
  "breath-holding": {
    name: "Breath-Holding",
    reference: "B41",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 2,
  },
  "pressure-support": {
    name: "Pressure Support",
    reference: "B77",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 5,
  },
  "super-jump": {
    name: "Super Jump",
    reference: "B89",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 10,
  },
  "extra-legs-six": {
    name: "Extra Legs (Six Legs)",
    reference: "B54",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 10,
  },
  "extra-legs-eight": {
    name: "Extra Legs (Eight Legs)",
    reference: "B54",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 15,
  },
  "extra-legs-many": {
    name: "Extra Legs (Many Legs)",
    reference: "B54",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 15,
  },
  "no-legs-slithers": {
    name: "No Legs (Slithers)",
    reference: "B145",
    tags: ["Disadvantage", "Exotic", "Physical"],
    // A serpent's body plan, like a fish's, costs nothing: it is the only way it
    // has ever moved.
    basePoints: 0,
  },
  clinging: {
    name: "Clinging",
    reference: "B43",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 20,
  },
  "constriction-attack": {
    name: "Constriction Attack",
    reference: "B43",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 15,
  },
  "perfect-balance": {
    name: "Perfect Balance",
    reference: "B74",
    tags: ["Advantage", "Physical"],
    basePoints: 15,
    features: [
      {
        type: "conditional_modifier",
        situation: "on DX and DX-based skill rolls to keep your feet",
        amount: 4,
      },
    ],
  },
  "double-jointed": {
    name: "Double-Jointed",
    reference: "B56",
    tags: ["Advantage", "Physical"],
    basePoints: 15,
  },
  "rapid-healing": {
    name: "Rapid Healing",
    reference: "B79",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  "resistant-to-disease": {
    name: "Resistant to Disease (+3)",
    reference: "B80",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 3,
  },
  flexibility: {
    name: "Flexibility",
    reference: "B56",
    tags: ["Advantage", "Physical"],
    basePoints: 5,
    features: [
      {
        type: "skill_bonus",
        selection_type: "skills_with_name",
        name: { compare: "is", qualifier: "Climbing" },
        amount: 3,
      },
    ],
  },
  brachiator: {
    name: "Brachiator",
    reference: "B41",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  catfall: {
    name: "Catfall",
    reference: "B41",
    tags: ["Advantage", "Physical"],
    basePoints: 10,
  },
  amphibious: {
    name: "Amphibious",
    reference: "B40",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 10,
    grantsMovement: "water",
  },
  tunneling: {
    name: "Tunneling",
    reference: "B94",
    tags: ["Advantage", "Exotic", "Physical"],
    // 30 points for Tunneling Move 1; the builder only ever buys level 1 here,
    // which is what a burrowing mammal's digging speed supports.
    basePoints: 30,
  },
  silence: {
    name: "Silence",
    reference: "B85",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 5,
  },
  "extra-arm-trunk": {
    name: "Extra Arm (Trunk; Extra-Flexible)",
    reference: "B53",
    tags: ["Advantage", "Exotic", "Physical"],
    // Extra Arm 10, +50% for Extra-Flexible.
    basePoints: 15,
  },

  // --- Natural weapons ------------------------------------------------------
  "sharp-teeth": {
    name: "Sharp Teeth",
    reference: "B91",
    tags: ["Exotic", "Perk", "Physical"],
    basePoints: 1,
    weapons: [
      naturalWeapon("Bite", { type: "cut", st: "thr", base: "-1" }, "C", BRAWLING_DEFAULTS, {
        calc: { damage: "thr-1 cut" },
      }),
    ],
  },
  fangs: {
    name: "Fangs",
    reference: "B91",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 2,
    weapons: [
      naturalWeapon("Bite", { type: "imp", st: "thr", base: "-1" }, "C", BRAWLING_DEFAULTS, {
        calc: { damage: "thr-1 imp" },
      }),
    ],
  },
  "blunt-claws": {
    name: "Blunt Claws",
    reference: "B42",
    tags: ["Advantage", "Physical"],
    basePoints: 3,
    weapons: [
      naturalWeapon(
        "Strike",
        { type: "cr", st: "thr", base: "-1", modifier_per_die: 1 },
        "C",
        BRAWLING_DEFAULTS,
        { parry: "0", calc: { damage: "thr-1 (+1 per die) cr" } },
      ),
    ],
  },
  "sharp-claws": {
    name: "Sharp Claws",
    reference: "B42",
    tags: ["Advantage", "Physical"],
    basePoints: 5,
    weapons: [
      naturalWeapon("Slash", { type: "cut", st: "thr", base: "-1" }, "C", BRAWLING_DEFAULTS, {
        parry: "0",
        calc: { damage: "thr-1 cut" },
      }),
    ],
  },
  hooves: {
    name: "Hooves",
    reference: "B42",
    tags: ["Advantage", "Physical"],
    basePoints: 3,
    features: [{ type: "dr_bonus", locations: ["foot"], amount: 1 }],
    weapons: [
      naturalWeapon("Kick", { type: "cr", st: "thr", modifier_per_die: 1 }, "C,1", KICK_DEFAULTS, {
        calc: { damage: "thr (+1 per die) cr" },
      }),
    ],
  },
  "striker-horns": {
    name: "Striker (Horns; Impaling)",
    reference: "B88",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 8,
    weapons: [
      naturalWeapon("Gore", { type: "imp", st: "thr" }, "C", BRAWLING_DEFAULTS, {
        calc: { damage: "thr imp" },
      }),
    ],
  },
  "striker-antlers": {
    name: "Striker (Antlers; Impaling)",
    reference: "B88",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 8,
    weapons: [
      naturalWeapon("Gore", { type: "imp", st: "thr" }, "C", BRAWLING_DEFAULTS, {
        calc: { damage: "thr imp" },
      }),
    ],
  },
  "striker-tusks": {
    name: "Striker (Tusks; Impaling)",
    reference: "B88",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 8,
    weapons: [
      naturalWeapon("Gore", { type: "imp", st: "thr" }, "C", BRAWLING_DEFAULTS, {
        calc: { damage: "thr imp" },
      }),
    ],
  },
  talons: {
    name: "Talons",
    reference: "B42",
    tags: ["Advantage", "Physical"],
    basePoints: 8,
    weapons: [
      naturalWeapon("Talons", { type: "cut", st: "thr", base: "+1" }, "C", BRAWLING_DEFAULTS, {
        parry: "0",
        calc: { damage: "thr+1 cut" },
      }),
    ],
  },
  "sharp-beak": {
    name: "Sharp Beak",
    reference: "B91",
    tags: ["Exotic", "Perk", "Physical"],
    basePoints: 1,
    weapons: [
      naturalWeapon("Beak", { type: "pi", st: "thr", base: "-1" }, "C", BRAWLING_DEFAULTS, {
        calc: { damage: "thr-1 pi" },
      }),
    ],
  },
  "striker-tongue": {
    name: "Striker (Tongue; Crushing; Long +1)",
    reference: "B88",
    tags: ["Advantage", "Exotic", "Physical"],
    // Striker [5] with Long +1 (+100%): a tongue that reaches a hex further
    // than the creature's own body.
    basePoints: 5,
    modifiers: [{ name: "Long +1", reference: "B88", cost_adj: "+100%" }],
    weapons: [
      naturalWeapon("Tongue", { type: "cr", st: "thr", base: "-2" }, "C,1", BRAWLING_DEFAULTS, {
        parry: "0",
        calc: { damage: "thr-2 cr" },
      }),
    ],
  },
  "striker-tail": {
    name: "Striker (Tail; Crushing; Long +1)",
    reference: "B88",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
    modifiers: [{ name: "Long +1", reference: "B88", cost_adj: "+100%" }],
    weapons: [
      naturalWeapon("Tail", { type: "cr", st: "thr" }, "C,2", BRAWLING_DEFAULTS, {
        parry: "0",
        calc: { damage: "thr cr" },
      }),
    ],
  },
  "striker-sting": {
    name: "Striker (Sting; Impaling)",
    reference: "B88",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 8,
    weapons: [
      naturalWeapon("Sting", { type: "imp", st: "thr" }, "C,1", BRAWLING_DEFAULTS, {
        calc: { damage: "thr imp" },
      }),
    ],
  },
  "striker-ram": {
    name: "Striker (Horns; Crushing)",
    reference: "B88",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
    weapons: [
      naturalWeapon("Ram", { type: "cr", st: "thr" }, "C", BRAWLING_DEFAULTS, {
        calc: { damage: "thr cr" },
      }),
    ],
  },

  // --- Toughness ------------------------------------------------------------
  "damage-resistance-carapace": {
    name: "Damage Resistance",
    reference: "B46",
    tags: ["Advantage", "Exotic", "Physical"],
    // Full DR, not Tough Skin: a carapace or a bed of osteoderms is armour, and
    // a scratch that would ignore thick hide does not ignore shell.
    pointsPerLevel: 5,
    features: [{ type: "dr_bonus", locations: ["all"], amount: 1, per_level: true }],
    damageResistance: true,
  },
  "damage-resistance-element": {
    name: "Damage Resistance",
    reference: "B46",
    tags: ["Advantage", "Exotic", "Physical"],
    // DR against one damage type only. This is how a creature that is immune to
    // its own breath is built: not a special rule, just a lot of very narrow DR.
    // It deliberately does NOT count toward the record's general DR, because a
    // red dragon is not armoured against a sword.
    pointsPerLevel: 5,
    modifiers: [
      {
        name: "Limited (one damage type)",
        reference: "B46",
        cost_adj: "-40%",
        local_notes: "Protects against a single damage type and nothing else.",
      },
    ],
    limitedDamageResistance: true,
  },
  "damage-resistance-tough-skin": {
    name: "Damage Resistance",
    reference: "B46,B47",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 5,
    modifiers: [
      {
        name: "Tough Skin",
        reference: "B47",
        cost_adj: "-40%",
        local_notes: "Effects that just require skin contact or a scratch ignore this DR",
      },
    ],
    features: [
      { type: "dr_bonus", locations: ["all"], amount: 1, per_level: true },
      { type: "dr_bonus", locations: ["eye"], amount: -1, per_level: true },
    ],
    damageResistance: true,
  },
  // --- Things with no metabolism ---------------------------------------------
  "doesnt-breathe": {
    name: "Doesn't Breathe",
    reference: "B49",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 20,
  },
  "doesnt-eat-or-drink": {
    name: "Doesn't Eat or Drink",
    reference: "B50",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 10,
  },
  "doesnt-sleep": {
    name: "Doesn't Sleep",
    reference: "B50",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 20,
  },
  "immunity-metabolic-hazards": {
    name: "Immunity to Metabolic Hazards",
    reference: "B80",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 30,
  },
  unfazeable: {
    name: "Unfazeable",
    reference: "B95",
    tags: ["Advantage", "Mental"],
    basePoints: 15,
  },
  blindness: {
    name: "Blindness",
    reference: "B124",
    tags: ["Disadvantage", "Physical"],
    // Paired with a sense that does the work instead. An animated object has no
    // eyes at all; what it has is an awareness of the space around it.
    basePoints: -50,
  },
  "flight-hovering": {
    name: "Flight",
    reference: "B56",
    tags: ["Advantage", "Exotic", "Physical"],
    // No wings and no limitation: the thing simply hangs in the air, which is
    // why it costs full price where a bird's does not.
    basePoints: 40,
    grantsMovement: "air",
  },
  "injury-tolerance-homogenous": {
    name: "Injury Tolerance (Homogenous)",
    reference: "B60",
    tags: ["Advantage", "Exotic", "Physical"],
    // The same all the way through. There is no organ to rupture and no weak
    // point to aim for; a sword through the middle of it accomplishes little.
    basePoints: 40,
  },
  "injury-tolerance-unliving": {
    name: "Injury Tolerance (Unliving)",
    reference: "B60",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 20,
  },
  "injury-tolerance-no-blood": {
    name: "Injury Tolerance (No Blood)",
    reference: "B60",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  "injury-tolerance-diffuse": {
    name: "Injury Tolerance (Diffuse)",
    reference: "B60",
    tags: ["Advantage", "Exotic", "Physical"],
    // What makes a swarm a swarm. There is no body to run through: a sword takes
    // a few of them and the rest close the gap, and only something that fills the
    // whole space does real work.
    basePoints: 100,
  },
  // Injury Tolerance is bought a part at a time. A creature with no centralised
  // brain, no neck and no vitals is not invulnerable — it simply has nowhere for
  // a called shot to land, which is most of what makes vermin unpleasant.
  "injury-tolerance-no-brain": {
    name: "Injury Tolerance (No Brain)",
    reference: "B60",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  "injury-tolerance-no-neck": {
    name: "Injury Tolerance (No Neck)",
    reference: "B60",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  "injury-tolerance-no-vitals": {
    name: "Injury Tolerance (No Vitals)",
    reference: "B60",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  "high-pain-threshold": {
    name: "High Pain Threshold",
    reference: "B59",
    tags: ["Advantage", "Mental"],
    basePoints: 10,
  },
  "hard-to-kill": {
    name: "Hard to Kill",
    reference: "B58",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 2,
  },
  "combat-reflexes": {
    name: "Combat Reflexes",
    reference: "B43",
    tags: ["Advantage", "Mental"],
    basePoints: 15,
  },
  fearlessness: {
    name: "Fearlessness",
    reference: "B55",
    tags: ["Advantage", "Mental"],
    pointsPerLevel: 2,
  },
  "temperature-tolerance": {
    name: "Temperature Tolerance",
    reference: "B93",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 1,
  },
  "terrain-adaptation": {
    name: "Terrain Adaptation",
    reference: "B93",
    tags: ["Advantage", "Exotic", "Physical"],
    basePoints: 5,
  },
  "reduced-consumption": {
    name: "Reduced Consumption",
    reference: "B80",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 2,
  },
  fur: {
    name: "Fur",
    reference: "B101",
    tags: ["Exotic", "Perk", "Physical"],
    basePoints: 1,
  },
  "extra-attack": {
    name: "Extra Attack",
    reference: "B53",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 25,
  },

  // --- Disadvantages --------------------------------------------------------
  // Animal mindlessness is built from its named component disadvantages rather
  // than from a meta-trait, so every point of it cites a page a reviewer can
  // open. A wild beast takes Bestial and Cannot Speak; a domesticated one takes
  // the same pair, because training changes what it will do, not what it is.
  bestial: {
    name: "Bestial",
    reference: "B124",
    tags: ["Disadvantage", "Mental"],
    basePoints: -10,
  },
  "cannot-speak": {
    name: "Cannot Speak",
    reference: "B125",
    tags: ["Disadvantage", "Physical"],
    basePoints: -15,
  },
  horizontal: {
    name: "Horizontal",
    reference: "B139",
    tags: ["Disadvantage", "Exotic", "Physical"],
    basePoints: -10,
  },
  "no-fine-manipulators": {
    name: "No Fine Manipulators",
    reference: "B145",
    tags: ["Disadvantage", "Physical"],
    basePoints: -30,
    features: [
      { type: "cost_reduction", attribute: "st", percentage: 40 },
      { type: "cost_reduction", attribute: "dx", percentage: 40 },
    ],
    noFineManipulators: true,
  },
  "restricted-diet-carnivore": {
    name: "Restricted Diet (Carnivore)",
    reference: "B151",
    tags: ["Disadvantage", "Exotic", "Physical"],
    basePoints: -10,
  },
  "restricted-diet-herbivore": {
    name: "Restricted Diet (Herbivore)",
    reference: "B151",
    tags: ["Disadvantage", "Exotic", "Physical"],
    basePoints: -10,
  },
  "extended-lifespan": {
    name: "Extended Lifespan",
    reference: "B53",
    tags: ["Advantage", "Exotic", "Physical"],
    pointsPerLevel: 2,
  },
  "short-lifespan": {
    name: "Short Lifespan",
    reference: "B154",
    tags: ["Disadvantage", "Exotic", "Physical"],
    pointsPerLevel: -10,
  },
  "cold-blooded": {
    name: "Cold-Blooded",
    reference: "B127",
    tags: ["Disadvantage", "Exotic", "Physical"],
    basePoints: -5,
  },
  "bad-smell": {
    name: "Bad Smell",
    reference: "B124",
    tags: ["Disadvantage", "Exotic", "Physical"],
    basePoints: -10,
  },
  "restricted-diet-carrion": {
    name: "Restricted Diet (Carrion)",
    reference: "B151",
    tags: ["Disadvantage", "Exotic", "Physical"],
    basePoints: -10,
  },
  "bad-temper": {
    name: "Bad Temper (12)",
    reference: "B124",
    tags: ["Disadvantage", "Mental"],
    basePoints: -10,
  },
  berserk: {
    name: "Berserk (12)",
    reference: "B124",
    tags: ["Disadvantage", "Mental"],
    basePoints: -10,
  },
  bloodlust: {
    name: "Bloodlust (12)",
    reference: "B125",
    tags: ["Disadvantage", "Mental"],
    basePoints: -10,
  },
  cowardice: {
    name: "Cowardice (12)",
    reference: "B129",
    tags: ["Disadvantage", "Mental"],
    basePoints: -10,
  },
  greed: {
    name: "Greed (12)",
    reference: "B137",
    tags: ["Disadvantage", "Mental"],
    basePoints: -15,
  },
  gluttony: {
    name: "Gluttony (12)",
    reference: "B137",
    tags: ["Disadvantage", "Mental"],
    basePoints: -5,
  },
  chummy: {
    name: "Chummy",
    reference: "B126",
    tags: ["Disadvantage", "Mental"],
    basePoints: -5,
  },
  gregarious: {
    name: "Gregarious",
    reference: "B126",
    tags: ["Disadvantage", "Mental"],
    basePoints: -10,
  },
  stubbornness: {
    name: "Stubbornness",
    reference: "B157",
    tags: ["Disadvantage", "Mental"],
    basePoints: -5,
  },
  "increased-consumption": {
    name: "Increased Consumption",
    reference: "B139",
    tags: ["Disadvantage", "Exotic", "Physical"],
    pointsPerLevel: -10,
  },
};

export function traitDefinition(id) {
  const definition = TRAITS[id];
  if (!definition) throw new Error(`unknown trait id: ${id}`);
  return definition;
}

/**
 * The published display name for a trait entry, with its level and any
 * parenthetical the spec supplies. This is what lands in `stats.traits`, so it
 * has to read as a GURPS trait line rather than as a catalogue key.
 */
export function traitDisplayName(entry) {
  const definition = traitDefinition(entry.trait);
  const parts = [definition.name];
  if (definition.pointsPerLevel !== undefined && entry.levels !== undefined) {
    parts.push(String(entry.levels));
  }
  const qualifiers = [
    ...(entry.qualifier ? [entry.qualifier] : []),
    ...(definition.modifiers ?? []).map(modifier => modifier.name),
    ...(entry.modifiers ?? []).map(modifier => modifier.name),
  ];
  const base = parts.join(" ");
  return qualifiers.length > 0 ? `${base} (${qualifiers.join("; ")})` : base;
}
