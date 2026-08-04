// SPDX-License-Identifier: MIT
//
// The controlled monster-tag vocabulary (OML-030).
//
// Tags are the only part of a record a consumer filters on without reading the
// stat block, so they are worth as much as they are consistent and worth nothing
// when they are not. Before this catalogue existed the library carried a long
// tail of tags used exactly once — `pod`, `pride`, `haunt`, `illusionist`,
// `draft` — which no search can use, alongside near-duplicate pairs that split a
// single idea in half: `caster`/`spellcaster`, `night`/`nocturnal`,
// `town`/`urban`, `cave`/`underground`.
//
// This module is the closed vocabulary that replaces them. A spec may only name
// tags that appear here; `scripts/build-srd-monsters.mjs` fails the build
// otherwise, the same way `trait-library.mjs` closes the mechanical vocabulary.
//
// Two rules decide whether a tag belongs:
//
//   A LINEAGE tag names a kind of creature and may be the only record of its
//   kind. `lich` on one record is useful because it answers "is this a lich",
//   and the answer stays useful when the second lich arrives.
//
//   A DESCRIPTIVE tag is a filter, and a filter that matches one record is not a
//   filter. Every descriptive tag here either applies to two or more records or
//   is a documented wildcard (`any-terrain`).
//
// Where a tag restates something the build already says, the build is the
// authority and the tag is derived from it rather than authored: `flier` follows
// Flight, `stealthy` follows Silence, `burrower` follows Tunneling, `berserk`
// follows Berserk, and `talker` follows the absence of Cannot Speak at IQ 6 or
// better. `checkSpecTags` does not enforce those derivations, because a spec
// states its own tags; `scripts/test/srd-monsters.test.mjs` asserts the finished
// records agree with them, so the two can never quietly drift apart.

/**
 * Tags the builder emits from provenance. A spec never states one; they are
 * listed so a validator over a finished record knows they are legal.
 */
export const PROVENANCE_TAGS = [
  "ai-generated",
  "doa-authored",
  "enraged-eggplant",
  "fan-authorized",
  "monsters-on-automatic",
  "srd-3-5",
  "srd-5-1",
];

/**
 * Lineage tags — what the creature *is*. These travel on `classTags` and the
 * builder copies them onto the record's tags, so a consumer filters kind and
 * behavior through one list.
 */
export const LINEAGE_TAGS = {
  // Top-level kinds.
  aberration: "A thing whose body plan answers to no earthly phylum.",
  animal: "A natural, non-magical creature of the real world's kinds.",
  construct: "An assembled body animated without life.",
  dragon: "A true dragon.",
  elemental: "A body made of one of the four elements.",
  fey: "A creature of the wild otherworld.",
  giant: "Humanoid in shape and far past humanoid in scale.",
  humanoid: "Two arms, two legs, a language and a culture.",
  "magical-beast": "An animal body with a supernatural nature.",
  monstrosity: "A creature built wrong on purpose.",
  ooze: "A body with no fixed shape and no organs to lose.",
  outsider: "A native of somewhere that is not the world.",
  plant: "A vegetable body, mobile or not.",
  swarm: "Many small creatures rated and run as one.",
  undead: "A body that kept moving after it stopped living.",

  // Physiology.
  amphibian: "Amphibian.",
  "animated-object": "An object walking around without a body to call its own.",
  arthropod: "Jointed legs and an exoskeleton.",
  awakened: "Given a mind it was not born with.",
  bird: "Bird.",
  crustacean: "Crustacean.",
  dinosaur: "A dinosaur or a contemporary of one.",
  fish: "Fish.",
  fungus: "Fungus.",
  golem: "A construct built from worked matter and bound magic.",
  incorporeal: "Has no substantial body.",
  lich: "A spellcaster who prepared for death and went through with it.",
  lycanthrope: "Carries the shapeshifting curse and can pass it on.",
  mammal: "Mammal.",
  mummy: "Preserved, bound and still on duty.",
  reptile: "Reptile.",
  shapechanger: "Wears more than one body.",
  skeleton: "Animated bone with nothing left on it.",
  vampire: "Undead that feeds on the living to stay standing.",
  vermin: "Small, numerous and unwelcome.",
  zombie: "Animated flesh, slow and unpicky.",

  // Folk.
  centaur: "Centaur.",
  drow: "Drow.",
  duergar: "Duergar.",
  dwarf: "Dwarf.",
  elf: "Elf.",
  gnoll: "Gnoll.",
  gnome: "Gnome.",
  goblinoid: "Goblin, hobgoblin, bugbear and their kin.",
  halfling: "Halfling.",
  hag: "Hag.",
  human: "Human, or part human.",
  kobold: "Kobold.",
  merfolk: "Merfolk.",
  "monstrous-humanoid": "Humanoid in shape, and not one of the folk.",
  ogre: "Ogre.",
  oni: "Oni.",
  orc: "Orc.",
  reptilian: "Scaled folk.",
  sprite: "Sprite.",
  svirfneblin: "Deep gnome.",

  // Planar lineage. `fiend`, `demon` and `devil` are the umbrella and its two
  // halves: a record states the umbrella always and the half when the source
  // names one, so "any fiend" and "devils only" are both answerable.
  angel: "A celestial of the highest orders.",
  archon: "A lawful celestial of the mountain.",
  baatezu: "The devils' own name for themselves.",
  celestial: "Of the upper planes, or descended from something that was.",
  chromatic: "Of the evil dragon line.",
  demon: "A fiend of chaos.",
  devil: "A fiend of law.",
  dragonblood: "Carries dragon ancestry without being a dragon.",
  eladrin: "A chaotic celestial.",
  fiend: "Of the lower planes, or descended from something that was.",
  guardinal: "A neutral-good celestial.",
  hybrid: "Two lineages in one body.",
  mephit: "A minor elemental imp.",
  metallic: "Of the good dragon line.",
  native: "An outsider born to this world rather than sent to it.",
  planetouched: "A mortal with planar ancestry a few generations back.",
  "tanar-ri": "The demons' own name for themselves.",
  tiefling: "Tiefling.",
};

/**
 * Descriptive tags — how the creature is used at the table. Grouped by the
 * question each group answers, because a filter UI and a generator constraint
 * both want the groups, not one flat list.
 */
export const DESCRIPTIVE_TAGS = {
  environment: {
    "any-terrain": "Wildcard: at home anywhere, and matches any environment filter.",
    aquatic: "Lives in the water, whatever it breathes.",
    arctic: "Ice, tundra and the snow line.",
    coastal: "Shore, shallows and tidal water.",
    desert: "Sand, rock and heat.",
    dungeon: "Worked underground: vaults, halls and the things left guarding them.",
    forest: "Temperate woodland.",
    freshwater: "Rivers, lakes and ponds.",
    hills: "Broken upland below the tree line.",
    jungle: "Hot forest and rainforest.",
    mountain: "High ground, peaks and passes.",
    ocean: "Salt water.",
    "open-water": "Salt water away from any shore, at any depth.",
    plains: "Grassland, steppe and savannah.",
    reef: "Coral and rock shallows.",
    swamp: "Marsh, fen and flooded ground.",
    tomb: "Graves, barrows and burial halls.",
    underground: "Natural caves and the deep dark.",
    urban: "Towns, cities and the settled places between.",
  },

  element: {
    acid: "Attacks with, or is made of, acid.",
    air: "Attacks with, or is made of, air.",
    cold: "Attacks with, or is made of, cold.",
    earth: "Attacks with, or is made of, earth and stone.",
    fire: "Attacks with, or is made of, fire.",
    lightning: "Attacks with, or is made of, lightning.",
    poison: "Attacks with poison that is breathed, secreted or touched rather than injected.",
    water: "Attacks with, or is made of, water.",
  },

  role: {
    ambusher: "Opens from concealment and expects the first exchange to end it.",
    apex: "Nothing in its range hunts it.",
    archer: "Fights at range with a bow or crossbow first.",
    brute: "Wins by mass and reach.",
    guardian: "Placed to hold something and will not leave it.",
    predator: "Hunts living prey.",
    prey: "Is hunted, and runs first.",
    raider: "Takes from settlements and leaves.",
    scavenger: "Eats what something else killed.",
    scout: "Ranges ahead, watches, and reports.",
    soldier: "Fights in formation under orders.",
    spellcaster: "Brings magic to the fight as its main weapon.",
    trapper: "Prepares the ground before anything arrives.",
  },

  organization: {
    flock: "Travels in bird-sized numbers.",
    herd: "Grazes in numbers and defends the young.",
    hive: "A colony with a nest and a queen.",
    pack: "Hunts in a coordinated group.",
    "swarm-forming": "The library also carries this creature as a swarm.",
  },

  encounter: {
    "animated-dead": "Raised and directed by someone else.",
    "beast-of-burden": "Carries or hauls.",
    domestic: "Kept by people.",
    familiar: "Small enough and biddable enough to be a familiar.",
    game: "Hunted for meat or hide.",
    hazard: "Read as a danger of the place rather than as an encounter.",
    hoard: "Keeps a treasure worth coming for.",
    livestock: "Kept for meat, milk or wool.",
    mount: "Ridden.",
    prehistoric: "Out of its own age, and a surprise in any other.",
    summoned: "Turns up because something called it.",
    trained: "Works to commands it was taught.",
    "war-beast": "Taken to war on purpose.",
  },

  hazard: {
    diseased: "Its wounds carry sickness.",
    plague: "Arrives in numbers that ruin a season.",
    venomous: "Injects venom with a bite or a sting.",
  },

  disposition: {
    berserk: "Fights past the point of sense once it starts.",
    chaotic: "Keeps no word it did not feel like keeping.",
    cowardly: "Breaks early and runs.",
    disciplined: "Holds formation and holds orders.",
    evil: "Hostile by nature, not by circumstance.",
    good: "Helps by nature, not by circumstance.",
    lawful: "Keeps to a code, and can be held to it.",
    harmless: "No real threat to anyone armed.",
    mercenary: "Fights for pay and can be outbid.",
    miner: "Digs for a living and knows stone.",
    omen: "Read as a sign, and worth an encounter for that alone.",
    outcast: "Belongs to a people that will not have it.",
    slaver: "Takes prisoners to keep or sell.",
    talker: "Can be negotiated with instead of fought.",
    trickster: "Would rather set something up than settle it.",
    wary: "Watches, withdraws, and comes back when it suits.",
  },

  movement: {
    burrower: "Digs its own way through.",
    eyeless: "Has no eyes to meet, and nothing that works through them reaches it.",
    flier: "Flies.",
    nocturnal: "Active at night.",
    stealthy: "Moves without being heard.",
  },

  family: {
    // Emitted by the matrix expansion in expand-matrix.mjs from the axis keys,
    // so a consumer can filter a family without parsing names apart.
    "age-wyrmling": "Dragon age.",
    "age-young": "Dragon age.",
    "age-adult": "Dragon age.",
    "age-ancient": "Dragon age.",
    "color-black": "Dragon color.",
    "color-blue": "Dragon color.",
    "color-brass": "Dragon color.",
    "color-bronze": "Dragon color.",
    "color-copper": "Dragon color.",
    "color-gold": "Dragon color.",
    "color-green": "Dragon color.",
    "color-red": "Dragon color.",
    "color-silver": "Dragon color.",
    "color-white": "Dragon color.",
  },
};

/**
 * What every tag the library used before this catalogue existed became, and why.
 *
 * A consumer that stored a tag string keeps working by reading this table, and a
 * reviewer can check that no meaning was thrown away silently. `null` means the
 * tag was dropped outright; the note says what carries the meaning instead.
 *
 * The Enraged Eggplant half of the library is retagged by
 * `review/repairs/007-planar-lineage-tags.json`, which is where its records are
 * changed from: they are a pure function of an untracked conversion queue plus
 * that directory. What remains there is editorial rather than mechanical — 38
 * records carry `outsider` with no planar family named at all (Imp, Quasit,
 * Chain Devil, Efreeti, the mephits), and naming one is a reading of the source,
 * not a rule this table can apply.
 */
export const RETIRED_TAGS = {
  arcane: { to: null, why: "Named one elf. Its build has Magic Resistance, not spells; the prose carries the flavor." },
  beast: { to: null, why: "Restated `animal` on the one record that had both." },
  cave: { to: "underground", why: "A kind of underground, not a different place." },
  caster: { to: "spellcaster", why: "Two spellings of one idea; `spellcaster` says it in full." },
  "colour-black": { to: "color-black", why: "US spelling." },
  "colour-blue": { to: "color-blue", why: "US spelling." },
  "colour-brass": { to: "color-brass", why: "US spelling." },
  "colour-bronze": { to: "color-bronze", why: "US spelling." },
  "colour-copper": { to: "color-copper", why: "US spelling." },
  "colour-gold": { to: "color-gold", why: "US spelling." },
  "colour-green": { to: "color-green", why: "US spelling." },
  "colour-red": { to: "color-red", why: "US spelling." },
  "colour-silver": { to: "color-silver", why: "US spelling." },
  "colour-white": { to: "color-white", why: "US spelling." },
  companion: { to: "domestic", why: "The dog was already domestic; the second tag added nothing." },
  "deep-water": { to: "open-water", why: "One pelagic tag instead of two that split by depth." },
  draft: { to: "beast-of-burden", why: "A horse that pulls is a beast of burden." },
  "familiar-scale": { to: "familiar", why: "The tag is about being a familiar, not about a size band." },
  fiendish: { to: "fiend", why: "The lineage, stated as the lineage." },
  friendly: { to: null, why: "Named one porpoise. `good` is the axis; the prose carries the rest." },
  haunt: { to: "tomb", why: "Named one ghost. Where it haunts is the filterable part." },
  healer: { to: null, why: "Named one unicorn, whose build has no healing ability to filter on." },
  highland: { to: "mountain", why: "One elf's word for mountain." },
  horde: { to: null, why: "How many turn up is `encounter.averageNumberAppearing`, a number." },
  hunter: { to: "predator", why: "Two words for hunting live prey." },
  illusionist: { to: null, why: "Named one gnome, whose build casts nothing." },
  infernal: { to: "fiend", why: "The lineage, stated as the lineage." },
  just: { to: "good", why: "One dragon color's word for good, and `color-bronze` already says which." },
  kindly: { to: "good", why: "One dragon color's word for good, and `color-silver` already says which." },
  night: { to: "nocturnal", why: "Two spellings of one idea." },
  noble: { to: "good", why: "One dragon color's word for good, and `color-gold` already says which." },
  omnivore: { to: null, why: "Marked the absence of a Restricted Diet trait. The traits already say it." },
  pod: { to: "pack", why: "A pod is a pack that swims." },
  poisonous: { to: "poison", why: "Contact poison is the element; injected venom stays `venomous`." },
  pride: { to: "pack", why: "A pride is a pack that lies down more." },
  primitive: { to: null, why: "Named one elf, and said nothing a filter can use." },
  ranger: { to: "scout", why: "Named one elf; `scout` and `archer` carry the build." },
  rare: { to: null, why: "How often it turns up is `encounter.wanderingWeight`, a number." },
  riding: { to: "mount", why: "A horse that is ridden is a mount." },
  scholar: { to: null, why: "Named one elf. The prose carries it." },
  shapeshifter: { to: "shapechanger", why: "Two spellings of one idea; the lineage tag wins." },
  spirit: { to: "incorporeal", why: "Named one ghost; the lineage tag is the mechanical one." },
  talkative: { to: "talker", why: "One dragon color's word for a tag every dragon already had." },
  town: { to: "urban", why: "Two words for settled ground." },
  true: { to: "dragon", why: "Meant 'a true dragon' on a record that already said `dragon`." },
  "wandering-encounter": {
    to: null,
    why: "How readily a creature turns up wandering is `encounter.wanderingWeight`, a number every record "
      + "carries and none of which is zero — so the tag excluded nothing and was applied to whichever "
      + "animals someone remembered. It sat on Hunter Shark but not Reef Shark, on Wolf but not Werewolf, "
      + "on every swarm but Spider Swarm, and on no humanoid, dragon or undead at all while Zombie outweighed "
      + "most of what did carry it. A creature that should never wander is `wanderingWeight: 0`.",
  },
  warm: { to: null, why: "Named one lizard, and named a climate band nothing else used." },
  wilderness: { to: null, why: "Replaced per record by the environment the creature actually lives in." },
};

/**
 * Lineage tags that entail broader ones. A record states the specific tag and
 * this table supplies the umbrella, so "any fiend" and "devils only" are both
 * answerable from a corpus whose sources name their planar families
 * inconsistently: the SRD calls devils baatezu on one page and devils on the
 * next, and a search for `devil` should find both.
 *
 * This is why `demon` and `devil` went from unused to useful. The nine tanar'ri
 * and eight baatezu the library already carried were filed under names only a
 * reader of the source would think to search for.
 */
export const IMPLIED_TAGS = {
  angel: ["celestial"],
  archon: ["celestial"],
  baatezu: ["devil"],
  chromatic: ["dragon", "evil"],
  demon: ["fiend"],
  devil: ["fiend"],
  drow: ["elf"],
  duergar: ["dwarf"],
  eladrin: ["celestial"],
  golem: ["construct"],
  guardinal: ["celestial"],
  lich: ["undead"],
  lycanthrope: ["shapechanger"],
  metallic: ["dragon", "good"],
  mummy: ["undead"],
  skeleton: ["undead"],
  svirfneblin: ["gnome"],
  "tanar-ri": ["demon"],
  tiefling: ["planetouched", "fiend"],
  vampire: ["undead"],
  zombie: ["undead"],
};

/** Every tag `tags` entails, transitively, itself included. */
export function withImplied(tags) {
  const closed = new Set(tags);
  for (let added = true; added;) {
    added = false;
    for (const tag of [...closed]) {
      for (const implied of IMPLIED_TAGS[tag] ?? []) {
        if (!closed.has(implied)) {
          closed.add(implied);
          added = true;
        }
      }
    }
  }
  return closed;
}

/** Every tag a spec may state, lineage and descriptive together. */
export const SPEC_TAGS = new Set([
  ...Object.keys(LINEAGE_TAGS),
  ...Object.values(DESCRIPTIVE_TAGS).flatMap(group => Object.keys(group)),
]);

/** Every tag that may appear on a finished record. */
export const RECORD_TAGS = new Set([...SPEC_TAGS, ...PROVENANCE_TAGS]);

/** The group a tag belongs to, for a UI that wants to show them apart. */
export function tagCategory(tag) {
  if (PROVENANCE_TAGS.includes(tag)) return "provenance";
  if (tag in LINEAGE_TAGS) return "lineage";
  for (const [category, group] of Object.entries(DESCRIPTIVE_TAGS)) {
    if (tag in group) return category;
  }
  return undefined;
}

/**
 * Problems with one spec's tags, as strings the builder can print. Named tags
 * must exist, must not repeat, and must not be a tag this catalogue retired —
 * the retirement note names the replacement, so the error can too.
 */
export function checkSpecTags(spec) {
  const problems = [];
  for (const [field, tags] of [["classTags", spec.classTags], ["tags", spec.tags]]) {
    const seen = new Set();
    for (const tag of tags ?? []) {
      if (seen.has(tag)) problems.push(`${field} names ${tag} twice`);
      seen.add(tag);
      if (SPEC_TAGS.has(tag)) continue;
      const retired = RETIRED_TAGS[tag];
      if (retired) {
        problems.push(retired.to
          ? `${field} names the retired tag ${tag}; use ${retired.to} (${retired.why})`
          : `${field} names the retired tag ${tag}; drop it (${retired.why})`);
      } else {
        problems.push(`${field} names ${tag}, which the tag taxonomy does not define`);
      }
    }
  }

  // A spec states the umbrella as well as the specific tag, rather than leaving
  // a consumer to apply IMPLIED_TAGS itself. The published record is the
  // contract, and it should answer "is this a fiend" without a lookup table.
  const stated = new Set([...(spec.classTags ?? []), ...(spec.tags ?? [])]);
  for (const tag of withImplied(stated)) {
    if (!stated.has(tag)) problems.push(`states a tag that implies ${tag}, which it does not state`);
  }
  return problems;
}
