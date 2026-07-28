# CER scope policy: what the rating deliberately does not price

Adopted 2026-07-28, resolving issues #15 and #17. This is the stated position on every
input the Combat Effectiveness Rating either cannot parse to one number or cannot price
without inventing mechanics. The governing principle is the one the whole review ran on:
**a named blind spot is honest; an invented number wearing the source's provenance is
not.** The rating prices what the source states a measure for — attributes, one best
attack, stated construction costs, Binding ST — and names everything else, per record,
in `provenance.conversionNotes` and in [`../reports/cer-audit.md`](../reports/cer-audit.md).

Both CER implementations — `scripts/review/cer.mjs` here and the application's
`src/modules/cer-calculator.ts` — already behave exactly as this policy states, and the
application's package smoke re-derives every published rating and fails if they ever
disagree. This document changes no rating; it makes the existing behaviour a stated
decision instead of an accident of parsing.

## Conditional DR (issue #17)

Some sources state DR as a condition rather than a value: `DR 20 (vs. cold and fire)`,
`DR: -`. The Typical Stats parse yields null for these, and the rating's uniform-DR slot
scores null as 0.

**Policy: the uniform-DR slot scores only unconditional DR. A conditional DR scores its
unconditional portion, which is usually zero.** The protection rating of such a record
is a floor, and the audit says so.

Why not the alternatives:

- *Score the conditional value* — a gray ooze with DR 20 against cold and fire has DR 0
  against the sword that actually gets swung at it. Scoring 20 overstates protection
  against the attack mix that matters most.
- *Score a weighted value* — requires an assumption about how often adventurers attack
  with cold or fire. That weighting is a campaign fact, not a source fact; any number we
  pick is invented and unfalsifiable against the document.
- *Extend the record shape with structured conditional DR* — the record's traits already
  carry the construction verbatim, so no information is lost today. A structured field
  would obligate `MonsterAttributes` in the application and both rating implementations
  to move together in order to feed a term that still needs the invented weighting
  above. The cost buys no honesty the conversion notes do not already provide.

What a GM should read instead: the record's traits, which state the conditional DR
exactly as the source built it, and the audit's data-gaps table, which lists every
record scored this way.

## Absent FP (issue #17)

Some sources state `FP: N/A` — typically undead, constructs, and other creatures that
do not fatigue. The parse yields null, and the FP term scores null as 0, the same
contribution as the human baseline FP 10.

**Policy: a creature that does not fatigue is scored at the FP baseline — neither
penalised for the missing number nor credited for tirelessness.** The rating's FP term
measures fatigue as a spendable combat resource; a creature outside the fatigue economy
neither banks nor burns it. (The concern in issue #17 that a missing FP "reads as FP 0
and costs 10 offense" described the conversion baseline; the canonical path both
implementations now share scores null FP as 0 contribution, and the term's breakdown
note says "FP N/A".)

The single record with no parsed Dodge is treated identically on the protection side:
no active defense is scored, and the gap is named in the audit.

## Mechanics with no stated price (issue #15)

258 records carry at least one mechanic the rating does not read. Per family:

1. **Insubstantiality / permeation — out of scope, and the first candidate for a future
   lever.** This is the largest single distortion: a creature most weapons cannot touch
   is not fodder, and the rating cannot say so. It stays unpriced because "how much is
   Insubstantiality worth in a fight" depends entirely on what the party carries — a
   group with magic weapons fights a shadow at face value; a group without them cannot
   win at all. That is a binary scenario fact, not a scalar. If a lever is ever adopted,
   the defensible one is the trait's stated point cost at the model's standard 1 per 5
   points — the same instrument as the affliction term, bounded and checkable against
   the source — but adopting it means changing both implementations together and
   republishing every affected rating, a deliberate release decision rather than a
   review repair.
2. **Injury tolerance (Diffuse / Homogenous) and swarm bodies — out of scope.** These
   halve or better most incoming damage, which the protection rating cannot see. The
   distortion is real but bounded (roughly a factor of two on effective HP), where
   pricing it would require modelling the attacker's damage-type mix, the same invented
   weighting rejected for conditional DR.
3. **Regeneration and unkillability — out of scope.** These change how long a fight
   lasts and whether the creature stays down, not its per-second threat. CER measures
   per-second threat; the encounter layer and the GM notes are where fight-length
   belongs. Records with a stated Regeneration construction still show it in traits.
4. **Spellcasting and psionics — out of scope.** A spell list is an arsenal whose combat
   value depends on selection and play, which no stats-derived scalar can price. This is
   the family where a rating would be most misleading: two IQ 15 casters with the same
   sheet differ by an order of magnitude depending on their lists.
5. **Extreme mobility, reach, and multi-hex bodies — out of scope.** These decide who
   gets to act and where, not how hard anyone hits. Move already contributes linearly;
   pricing flight or reach beyond that would double-count mobility through a term the
   model does not define.

For every family: the record's `provenance.conversionNotes` and the audit's
"Priority mechanics the rating cannot price" table name the mechanic, and **a GM should
read a listed mechanic as "this creature is harder than its number", with the threat
tier as a floor rather than a measurement.** The application surfaces the same notes, so
no consumer sees the number without the caveat.

## What would change this policy

A priced lever is adopted only when all three hold: the measure is stated by the source
(a construction cost, a ST, a level), the term is implemented in both CER
implementations in the same release, and the affected ratings are republished together
with the change recorded in the release notes — the process issue #5 followed for the
affliction term. Anything less reintroduces invented numbers under source provenance.
