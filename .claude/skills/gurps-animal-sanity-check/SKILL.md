---
name: gurps-animal-sanity-check
description: Check already-authored GURPS animal statistics for scale errors, after the record exists. Use when reviewing or repairing a finished monster spec in content/srd-monsters/, or when a CER, Move or DR value looks off in converted/srd-monsters/. Triggers on "sanity check the animals", "do these stats look right", "review the batch". NOT an authoring aid — do not consult it while writing a record; write the record first, from the rules and the animal, then bring it here.
---

# Sanity-checking authored animal statistics

**This runs after. Author the record first.**

That ordering is the whole point of the skill, not a stylistic preference. The project's authorship posture
([ROADMAP.md](../../../ROADMAP.md#authorship-and-rights-posture)) allows outside work only in "a separately
logged comparison or quality-review phase" — *separately* and *logged*, meaning after a draft exists and
recorded when it happens. A check consulted before authoring is not a check; it is a template, and a record
built to match it was never independently authored no matter what its provenance block says.

So: write the build from the creature and from the published GURPS rules. Then come here.

## Why this file carries no target numbers

An earlier version of this skill listed fitted values — a strength-from-mass formula, a clade-by-clade HT
table, DR and Size Modifier bands. Those were a regression on an outside reference's generator, and putting
them here made this file a way to author *his* animals with our names on them. They are gone, and they are
not coming back into a tracked file.

What remains is the method: the questions to ask of a finished record, and where the answers legitimately
come from — the published rules, the real animal, and the project's own prior records.

## Step 1 — the record must state its mass

`massLb` on the spec, `size.massLb` on the record. Measurements are US customary throughout, which is also what GURPS Basic Lift reads in. Every check below depends on it, and a record that does
not state one cannot be checked against anything.

For a fantasy scale-up, the spec should name the mundane animal and the factor — "a badger at roughly eight
times mass, ~260 lb." — so the build is reviewable rather than asserted.

## Step 2 — check scale against the rules, not against a table here

Work these out yourself, from the Basic Set, for the record in front of you:

- **Size Modifier** comes from the published Size Modifier table, keyed to the creature's longest dimension.
  Note that this is *length or height*, not mass: a four-metre crocodile and a compact animal of the same
  weight do not share a footprint. If a record's SM does not follow from a stated length, that is the finding.
- **ST** should be consistent with the creature's Basic Lift and with what it can actually shift. GURPS ties
  Basic Lift to ST directly, so a stated mass and a plausible lifting capacity together bracket ST closely.
  Derive the bracket, then compare.
- **HP** follows ST for an ordinary body plan. HP bought separately needs a reason in `notes`.

If ST and the mass disagree, resolve it before going further: damage, Basic Lift and half the rating hang
off ST.

## Step 3 — check the senses and the nerve

The failure mode here is authoring animals as dulled-down humans.

- **Per** — an animal's senses are its defining advantage over a person. Ask what this creature actually
  hunts or evades by, and whether the record's Per and sense advantages let it do that. A wandering
  encounter that fails to notice the party is not an encounter.
- **Will** — animals are not cowards by default. The specific timid ones take Cowardice, which is a separate
  statement about that creature.
- **IQ** — most animals sit at the bottom of the range; the genuinely bright ones are a short list and should
  say why in `notes`.

## Step 4 — check the hide, and check what kind it is

Is the DR *hide* or *armour*? Thick skin is Tough Skin and a scratch bypasses it; a carapace or a bed of
osteoderms is neither thick skin nor bypassable. A record using the wrong one is wrong even when the number
is right. Then ask whether an animal of this mass and build plausibly turns a blade at all.

## Step 5 — check HT against the animal, not against habit

Do not give everything the same HT because it is an animal. Ask what this creature is actually known for:
shrugging off wounds, surviving winter, dying of a broken leg. HT drives FP and the protection rating, so a
blanket value inflates every record in the batch at once.

## Step 6 — check what `move` means on this record

- A spec with a `movement` block publishes its primary medium's **cruising** Move and states every mode,
  sprint included, in a `Movement:` stat note. Check the primary medium is the one the creature actually
  lives in.
- A spec without one folds Enhanced Move into the published figure. That is the pre-correction behaviour;
  see decision 6 of
  [review/policy/srd-independent-build-policy.md](../../../review/policy/srd-independent-build-policy.md).
- **The rating path scores `move - 6` straight into offense.** If a CER looks high, check Move first.

## Step 7 — read the finished record as a GM

- Sort the batch by CER and look for anything that has jumped its neighbours.
- Does `encounter.averageNumberAppearing` match how the animal lives — pack, pride, herd, shoal, solitary?
- Does the damage read plausibly for the creature's size?
- Is the description consistent with the mechanics beside it?
- Compare against the project's own earlier records. A new 450 lb. predator should sit sensibly next to the
  lion we already published; that comparison is entirely ours and always available.

## Step 8 — only now, the outside comparison

If a local benchmark is present, run it:

```bash
node scripts/review-animal-benchmark.mjs
```

It reports per-attribute deltas and never edits a record. Both the benchmark data and its report are
gitignored — someone else's data under someone else's terms — so a fresh checkout has neither and the check
skips.

Rules for this step:

- **Run it only against records that already exist.** If a record is not written yet, it is not ready for
  this step.
- **Do not copy a value across.** Adopting a number changes the record's provenance story and needs its own
  permission and credit, the way Enraged Eggplant material does. See
  [review/policy/srd-independent-build-policy.md](../../../review/policy/srd-independent-build-policy.md).
- **Do not lift the reference's patterns back into this file, or into the trait library, or into a spec
  template.** A generalisation extracted from someone's data and then used to author is the same act as
  copying, spread over more records.
- A delta is a question. The answer is often "yes, deliberately" — write that into the spec's `notes` and
  leave the number alone.

## The enforcement gap worth closing

Steps 1 and 2 could be machine-checked once every spec records `massKg` and a stated length. The
bird-fish-aquatic batch records mass; the land-animal batch does not yet. A linter would want its
thresholds derived from the published rules and from our own corpus — not from the outside reference.
