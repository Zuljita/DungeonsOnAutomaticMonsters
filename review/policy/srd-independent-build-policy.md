# Policy: how SRD-coverage records are built, credited and licensed

Decided for issue #37 (mundane land animals) and applied since to #38 (birds, fish and aquatic animals),
#39 (vermin), #40 (snakes), #41 (dinosaurs), #36 (swarms), #42 (constructs and awakened plants), #35
(dragons) and #34 (humanoid folk) — the batches of the SRD coverage programme (#33) authored so far. It applies to every later batch built the same way.

## The problem

The coverage programme has 250 uncovered SRD identities. Two of the ways to close that gap are closed to us
and a third needs stating before anything is authored.

Converting SRD statistics is not available: SRD 3.5 material is OGL 1.0a and cannot be relicensed into a
CC BY package, and mixing licences per record is exactly the ambiguity `OML-023` exists to prevent. Reusing
the Enraged Eggplant conversions is not available either — `ROADMAP.md` forbids EE statistics as a draft
input, and where EE already covers an identity it is not in the uncovered list anyway.

What remains is authoring the mechanics ourselves. That is straightforward for the animals in these
batches, because a wolf is a wolf; the questions worth deciding are what an authored record may take from the SRD,
what it must say about how it was made, and what stops "authored" from meaning "asserted".

## Decisions

### 1. The SRD supplies the identity and nothing else

A record answers to an SRD heading. It takes the creature identity from that heading — that a wolf exists,
runs in packs and bites — and takes no statistics, no wording, no presentation and no structure. There is no
transformation step from an SRD stat block to a GURPS one, because the SRD stat block is not an input to the
build.

That is `ROADMAP.md`'s source-restricted independent implementation rule, and it is a discipline about
process rather than a legal conclusion. It is worth the discipline anyway: the alternative would put OGL 1.0a
obligations on records this package intends to release under CC BY 4.0.

The headings a record answers are recorded in `provenance.coversSourceIdentities` so the coverage registry
can account for them. They are deliberately *not* in `sourceSystem`, `sourceUrl` or
`sourceCopyrightNotice`, because those fields state where the material came from and the material did not
come from there.

### 2. Provenance names the project, and says the draft was AI-generated

Every record carries `kind: "doa_authored"`, `sourceLicense: "doa_authored"`, a Monsters on Automatic
originator credit, and `provenance.notes` stating that the first draft was AI-generated and is under project
review. The record's tags carry `ai-generated` and `monsters-on-automatic`, and the `local_notes` of the
`.gct` and the notes of the `.gcs` carry the credit line, so a GCS file that travels away from the package
still answers "who wrote this".

`sourceSystem` is `doa_fixture`. That is the package contract's enum value for project-authored material and
the only one that does not misdescribe these records; the name is a legacy of the contract fixture that
first used it. A `doa_authored` `sourceSystem` value would read better, but adding an enum value the
consuming application does not know is a change to make deliberately at promotion time, not as a side effect
of a content batch.

### 3. Nothing is approved automatically

Every record ships `review_required`. The two gates in [review/README.md](../README.md) — GCS arithmetic and
library fidelity, and DOA playability — still have to be recorded before any of this can be promoted into
the public package. `OML-022` adds a third question for these batches specifically: whether the encounter
fields suit each creature's actual table use as a wandering encounter, a mount, livestock or a trained bird.

This is the same rule the conversion pipeline follows, and for the same reason. A generated record that
approves itself has had no review at all.

### 4. Derived numbers are derived, once

The tracked spec states the build. The builder derives Typical Stats, damage dice, racial-skill points, the
ancestry point total and the rating, each from exactly one place:

- attributes and DR come from the attribute and DR traits in the list;
- damage comes from the creature's ST and the attack's GURPS shorthand;
- the template total is the sum of its priced children;
- OR, PR and CER come from `scripts/review/cer.mjs`, the consumer rating path.

Nothing is written down twice, so nothing can disagree. This matters more for authored records than for
converted ones: a conversion at least has a source to check against, while an authored stat block that
states both "ST 13" and "bite 2d" has nothing but the author's arithmetic standing behind it.

### 5. Traits come from a controlled vocabulary, priced exactly

A spec may only name traits defined in `scripts/srd/trait-library.mjs`, and each catalogue entry carries the
published page reference and cost. A reviewer checks a build against the rules; they never have to take the
spec's word for what something costs.

A trait cost that does not come out to a whole number of points is a build error rather than a rounding. The
alternative is a template whose total depends on which way an implementation rounds, and that is not a
reviewable number. In practice it means choosing levels that price cleanly, which the published discounts
(-10% per point of positive Size Modifier, -40% for No Fine Manipulators, -40% for Tough Skin) always allow.

### 6. `move` means cruising Move, opt-in per batch

A comparison pass against an outside mass-driven GURPS animal reference found that the land-animal batch
publishes sprint speeds in `move`: the builder folded each record's Enhanced Move into the single published
figure, so thirteen records advertise a chase speed where a consumer reads tactical movement. Because the
rating path scores `move - 6` straight into offense, those records are also rated as if they fought at that
speed — the cheetah takes 18 of its 28 offense points from Move alone.

What `move` means is a package-contract question. The application reads the field, and changing its meaning
is a decision for the contract owner, not something a builder should do quietly to records that have already
been reviewed. So the fix is **opt-in per spec**:

- A spec that declares a `movement` block publishes its primary medium's *cruising* Move and states every
  mode, sprint figures included, in a `Movement:` stat note. The bird-fish-aquatic batch does this, and it
  has to: a hawk's ground Move and its air Move differ by a factor of six, and there is no honest way to put
  one number in the field without saying which.
- A spec without one keeps the original behaviour. The land-animal batch keeps the numbers it was reviewed
  with.

Both batches state their movement modes in the notes either way, so the two are readable side by side. When
the contract decision lands, the land-animal specs gain a `movement` block and nothing else changes.

### 7. The outside comparison runs after authoring, never before

`ROADMAP.md` rule 6 allows outside work "only in a separately logged comparison or quality-review phase".
The load-bearing words are *separately* and *logged*: after a draft exists, and recorded when it happens.

This is not a formality. A check consulted before authoring is not a check — it is a template. A record
built to match an outside model was never independently authored, whatever its provenance block says, and
the generalisation is worse than the individual value because it spreads across every record in the batch
at once.

Two consequences, both binding:

- **No outside-derived target values live in tracked files.** Not in the trait library, not in a spec
  template, not in the sanity-check skill. A fitted formula extracted from someone's dataset is a
  derivative of that dataset, and it belongs with the dataset — local only.
- **The order is author, then check.** The `gurps-animal-sanity-check` skill enforces this in its own
  instructions and its description.

**Where the rule came from, and what it cost.** The bird-fish-aquatic batch (#38) was first authored with
fitted bands from the outside reference in hand — its Size Modifier, ST, Per, Will, HT and DR shaped by that
model rather than checked against it. That draft was discarded and the batch re-derived from the rules
alone. The derivation route is now stated on every record:

- **Size Modifier** from the published table keyed to the creature's longest dimension, with the length
  written into the spec's `notes`. This is where the first draft went furthest wrong: sizing from mass put
  the frog three steps too large, the sea horse two, and the hawk, owl, quipper, giant toad and giant
  vulture one each. A pond frog is 13 cm long whatever it weighs.
- **ST** from Basic Lift and from what the animal demonstrably shifts — prey carried, a rider borne, a
  carcass dragged. That raised the giant sea horse from a figure that could not have carried a rider, and
  the giant crab from one that could not have dragged a body.
- **Perception and Will** reasoned per creature from the sense it lives by, rather than one figure applied
  across the batch. The hawk and the owl end up equal and eight points clear of the sea horse, and they get
  there by different routes — sight for one, hearing for the other.

**What the check actually catches.** Run properly — after the record exists — a web comparison against
independent GURPS conversions of the same creature finds *missing capabilities*, not different numbers. The
first full pass over batches #36 and #38–41 amended 40 records and changed no rating at all, because
everything it found was a trait the creature obviously has and the draft forgot: Peripheral Vision on
side-eyed prey animals and on eight-eyed spiders, the Tracking skill on every creature with Discriminatory
Smell, Night Vision on a nocturnal hunter, Double-Jointed on constrictors, the durability and flammability
of a spider's web. That is the shape a legitimate comparison finding takes. A finding that says "their ST is
19 and ours is 16" is not a finding; it is a temptation.

The land-animal batch (#37) never had this problem: it was authored before the reference was known and
compared against it afterwards, which is the order this decision now requires.

### 8. Every animal build records the mass it was scaled from

`massKg` on the spec, `size.massKg` on the record. Almost every property of a real animal's GURPS statistics
follows from body mass and clade, and an authored record with no stated mass cannot be checked against
anything — which is exactly how the first batch ended up with a wolf stronger than a mass-derived model
suggests and no hide at all. The bands are in the `gurps-animal-sanity-check` skill.

### 9. A family that varies on two axes is expanded, not duplicated

`OML-022` requires age and size variants to be modelled "without hiding mechanical differences and without
exploding the package into incoherent duplicates". Dragons are the case: ten colours at four ages, forty
identities, one body plan.

The rule is **age scales the body, colour states the weapon and the mind**. Age owns Size Modifier, ST, DR,
the reach of a limb and the dice of a breath. Colour owns what that breath is made of, what the creature is
immune to, where it lives and what it wants. Neither axis knows about the other, and a value one axis needs
from the other is passed as a named variable rather than by one axis reaching into the other's business.

The spec states the axes; `scripts/srd/expand-matrix.mjs` emits the cross-product as forty ordinary specs.
Nothing downstream knows a matrix was involved. That gets both halves of what `OML-022` asks for: a consumer
receives forty real stat blocks rather than one record with an age footnote, and a reviewer reads one body
plan rather than forty near-copies that will drift apart by the third edit.

### 10. Empty fields stay empty

Treasure and grappling ship as explicit nulls, following the
[0.2.0 field policy](0.2.0-empty-field-policy.md): the key set is complete so a consumer never needs an
existence check, and a null reads as "known absent" rather than "forgotten". Animals carry no treasure, and
grappling values would be invented rather than derived.

`lair` is the exception and carries a short habitat note. Where a wandering animal dens is an encounter fact,
which is precisely what `OML-022` asks this batch to get right, and it is not a claim about loot.

Art is out of scope for these batches. The records carry no `art` block, which the package contract permits,
and the portrait/token/hex-token requirement in #37's acceptance criteria remains open.

### 11. A record's DR is the creature's own hide, and equipment is not bought

Decided for #34, the first batch of folk who wear things. A racial template states what a creature is. A
hobgoblin's mail is not what it is: it is what it was issued, and a GM who takes it away should be left with
a hobgoblin rather than with a record that still claims DR 4 for a shirt nobody is wearing. So armour is
never bought, and `stats.attributes.dr` carries natural protection only — the lizardfolk's scale, the ogre's
hide, the bugbear's thick skin — with the typical worn kit named in the record's `notes` for a GM to add.

This has a cost and the cost is stated rather than compensated for. The rating path reads
`stats.attributes.dr` straight into protection, so every armoured folk in the batch rates below how it
plays; the hobgoblin is the sharpest case, since being hard to hurt in a shield wall is most of what it is
for. That is the same shape of problem as decision 6: what the package's `dr` field *means* — the creature,
or the creature as encountered — is a contract question the application owns, and a builder should not settle
it by quietly pricing a mail shirt into an ancestry template. If the contract decides `dr` means "as
encountered", these specs gain DR entries and nothing else changes.

Weapons are treated differently and deliberately so. An armed creature's typical attack is a fact about the
encounter and belongs on the stat block, so the records state one; the weapon still never enters the `.gct`,
because the ancestry template lists only traits, and the point total therefore prices no equipment either.

### 12. Melee damage is the wielder's, missile damage is the weapon's

Also decided for #34. A sword's damage is stated in the GURPS shorthand relative to the wielder's thrust or
swing, exactly as a natural weapon is, so a stronger creature hits harder with the same blade. A bow's is
not: a bow has its own draw weight, and an arrow does what the arrow does whoever looses it. Missile weapons
therefore state literal dice, the way the flying sword's blade already did in #42, and slings stay
ST-derived because a sling really is powered by the arm swinging it.

The batch would otherwise have produced a gray elf whose longbow was feebler than a halfling's sling, which
is not a fact about archery.

### 13. Sub-races are records, not variants

The #34 list is mostly sub-races — deep and mountain dwarves, gray, wild and wood elves, tallfellow and deep
halflings. There is no base record for them to be variants of: `Dwarf`, `Elf`, `Gnome` and `Halfling` are
family index headings in #46, dispositioned by naming the records that cover their members. Each sub-race
therefore ships as its own record, and what a family shares is stated once in a `traitSet` while what a
sub-race differs on is restated in its own list. That is the same mechanism decision 9 uses for dragons at
one axis instead of two: one description of the shared body, and no near-copies to drift apart.

## What these batches do not settle

- **Promotion.** These records are not in `converted/doa-monsters.json` and the promotion path for a second
  package source is not built. That is deliberate: promotion should follow review, not precede it.
- **The coverage registry.** `npm run coverage:srd` and `review/srd-coverage.json` do not exist on this
  checkout. `provenance.coversSourceIdentities` is written in the shape a registry would want, so the
  registry can be built against it rather than the records being retrofitted to the registry.
- **The `doa_authored` sourceSystem value.** See decision 2.
