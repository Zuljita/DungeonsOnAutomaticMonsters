# SRD-coverage monster specs

Independently authored GURPS builds for the SRD monster identities the package does not yet cover, tracked
here as specs rather than as generated records. Everything under `converted/srd-monsters/` is built from this
directory and nothing in it is hand-edited.

```
content/srd-monsters/<batch>.json          (tracked: the build)
              |
     npm run build:srd-monsters
              |
converted/srd-monsters/doa-monsters.review-required.json   (generated)
converted/srd-monsters/gcs/<slug>.gct                      (generated)
converted/srd-monsters/gcs-sheets/<id>.gcs                 (generated)
converted/srd-monsters/CHECKLIST.md                        (generated)
```

`npm run validate:srd-monsters` rebuilds in memory and fails if any generated file has drifted, so the specs
and the artifacts cannot disagree. It runs as part of `npm test`.

## What a spec states, and what it must not

A spec states the *build*: size, the racial traits, the racial skills, the natural attacks in GURPS
shorthand, the encounter fields, and the description prose. It does not state Typical Stats, damage dice,
point totals or ratings. Those are derived:

| Derived | From |
| --- | --- |
| ST, DX, IQ, HT, HP, Will, Per, FP, Basic Speed, Move, Dodge, DR | the attribute and DR traits in the list |
| damage dice | the creature's ST and the attack's `basis` (`thr-1`, `sw+2`, `+N per die`) |
| racial-skill points | difficulty and level relative to the controlling attribute |
| ancestry point total | the sum of the priced children |
| OR, PR, CER, threat tier | `scripts/review/cer.mjs`, the consumer rating path |

Deriving them is the point. A record cannot claim ST 13 and a 2d bite, and a template cannot claim a total
its children do not add up to, because neither number is ever written down twice.

A spec should also state `massLb`, the body weight the build was scaled from. It is the one fact that makes an
authored animal checkable — ST, Size Modifier and DR all follow from it — and the
`gurps-animal-sanity-check` skill is built around it. It is published on the record as `size.massLb`. Measurements throughout are US customary, which is also what GURPS Basic Lift and the published size table read in.

## Movement, and what `move` means

A creature that flies or swims declares a `movement` block naming its primary medium:

```json
"movement": { "primary": "air" }
```

The builder then derives cruising Move for every medium the build grants — ground from Basic Speed, air at
twice Basic Speed for winged flight, water for anything with gills, an aquatic body plan or Amphibious —
publishes the **primary medium's cruising Move** in `stats.attributes.move`, and states the full set,
sprint figures included, in a `Movement:` stat note.

A spec with no `movement` block keeps the original behavior, where Enhanced Move multiplies the published
Move. That behavior is wrong — it publishes a chase speed where a consumer reads tactical movement, and
the rating path scores `move - 6` straight into offense — but what `move` means is a package-contract
question rather than a builder's to settle quietly. So the corrected rule is opt-in per spec, and the
land-animal batch keeps the numbers it was reviewed with until that decision is recorded. See
[review/policy/srd-independent-build-policy.md](../../review/policy/srd-independent-build-policy.md).

## The controlled vocabulary

A spec may only name traits defined in [`scripts/srd/trait-library.mjs`](../../scripts/srd/trait-library.mjs).
Each catalogue entry carries the published page reference and cost, so a reviewer checks a build against the
rules rather than against this file's assertions. A trait cost that does not come out to a whole number of
points is a build error, not a rounding: see `traitPoints` in
[`scripts/srd/build-srd-record.mjs`](../../scripts/srd/build-srd-record.mjs).

`traitSets` are shared baselines — the quadruped body plan, a keen nose, a carnivore's diet. A monster that
differs restates the entry in its own `traits` list, which overrides the set; a monster that does not have a
set trait at all names it in `omitTraits`, as the elephant does for No Fine Manipulators because a trunk is
one.

## Tags

`classTags` and `tags` are closed the same way, against
[`scripts/srd/tag-taxonomy.mjs`](../../scripts/srd/tag-taxonomy.mjs), and the build fails on a tag that
catalogue does not define. A tag is the only part of a record a consumer filters on without reading the
stat block, so a one-off invented for a single creature reads as a filter and matches nothing.

Two rules decide what belongs. A **lineage** tag names a kind — `lich`, `drow`, `demon` — and may be the only
one of its kind in the library, because it still answers a question. A **descriptive** tag is a filter, and a
filter of one is not a filter: every one either covers two or more records or is a documented wildcard.

Where the build already states something, the tag follows it rather than being authored beside it: `flier`
follows Flight, `stealthy` follows Silence, `burrower` follows Tunneling, `berserk` follows Berserk, and
`talker` follows the absence of Cannot Speak at IQ 6 or better. `scripts/test/srd-monsters.test.mjs` pins all
five, so a tag cannot drift away from the creature it describes.

Specific lineage tags entail broader ones — `baatezu` entails `devil` entails `fiend` — and a spec states
both. `IMPLIED_TAGS` is the table, and the build checks it; the record is the contract, so it should answer
"is this a fiend" without the consumer holding a lookup table.

`RETIRED_TAGS` records every tag the library used before the catalogue existed, what replaced it and why, so a
consumer that stored a tag string can still resolve it.

## Prose, and which notes go where

A spec writes two kinds of note, and they go to two different places:

| Spec field | Published as | For |
| --- | --- | --- |
| `notes` | `stats.notes` | Someone running the creature at the table |
| `provenanceNotes` | `provenance.conversionNotes` | Someone auditing how the record was made |

The split is not cosmetic. `stats.notes` renders on the GCS sheet and on the Foundry actor, so a note there is
read by a GM mid-encounter, and the test is whether it changes what happens at the table. Three kinds pass:
what actually works against the creature (`a carapace is shell rather than hide`), what the stat block
understates (`mail and a shield are the usual kit and are not in this record's DR`), and what is deliberately
not on the stat block at all (`the enlargement a duergar can call ... running it is the GM's job`).

Everything that justifies a number fails the test and goes to `provenanceNotes`. Why a record sits on the
SM +2 row, where its ST came from, which trait was bought at what price, which batch authored it, what it was
compared against afterwards, which issue tracks a defect in the shared rating path — all true, all worth
keeping, none of it a fact about the monster. `provenanceNotes` is also where ROADMAP.md rule 6's
outside-comparison disclosure belongs: an auditor looks there, and a GM does not.

Where a build problem does change how a creature should be run — the dragons' breath is rated as though it
could be used every second, so their ratings run high — the *effect* stays in `stats.notes` and the diagnosis
goes to `provenanceNotes`.

Reader-facing prose — `description`, `lair`, `notes`, and an attack's `notes` — is written in the third person
and in US spelling. It describes the creature, never the reader and never this repository.
`scripts/test/srd-monsters.test.mjs` fails on a second-person pronoun or a mention of the build in any of
those four fields.

## Rights posture

These records are the project's own work. The SRD supplies the creature identity a record answers to and
nothing else: no SRD statistics, wording or presentation is reproduced, and no third-party GURPS conversion
is an input. That is [ROADMAP.md](../../ROADMAP.md#authorship-and-rights-posture)'s source-restricted
independent implementation rule, and it is why these records carry `sourceLicense: "doa_authored"` and a
Monsters on Automatic originator credit rather than an SRD copyright notice.

The SRD headings a record answers are recorded in `provenance.coversSourceIdentities`, so the coverage
registry can account for them without the record claiming SRD provenance it does not have.

Drafts are AI-generated and say so, in `provenance.notes`, in the record's tags, and in the `local_notes` of
every GCS artifact. Nothing is approved automatically: every record ships `review_required` until the
GCS-fidelity and DOA-playability gates in [review/README.md](../../review/README.md) are recorded against it.

## Adding a batch

Drop a new `<batch>.json` beside this file with `batch`, `issue`, `title`, `summary`, optional `traitSets`,
and a `monsters` array, then:

```bash
npm run build:srd-monsters
```

Validate the GCS templates against the ancestry validator as well, which checks ids, point reconciliation
and that every template carries its credit:

```bash
npm run validate:gct-srd-monsters
```
