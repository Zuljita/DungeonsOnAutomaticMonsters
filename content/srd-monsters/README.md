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

A spec should also state `massKg`, the body mass the build was scaled from. It is the one fact that makes an
authored animal checkable — ST, Size Modifier and DR all follow from it — and the
`gurps-animal-sanity-check` skill is built around it. It is published on the record as `size.massKg`.

## Movement, and what `move` means

A creature that flies or swims declares a `movement` block naming its primary medium:

```json
"movement": { "primary": "air" }
```

The builder then derives cruising Move for every medium the build grants — ground from Basic Speed, air at
twice Basic Speed for winged flight, water for anything with gills, an aquatic body plan or Amphibious —
publishes the **primary medium's cruising Move** in `stats.attributes.move`, and states the full set,
sprint figures included, in a `Movement:` stat note.

A spec with no `movement` block keeps the original behaviour, where Enhanced Move multiplies the published
Move. That behaviour is wrong — it publishes a chase speed where a consumer reads tactical movement, and
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
