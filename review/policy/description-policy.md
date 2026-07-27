# Policy for monster `description`

Status: **decided** — applies from the first release that ships the field.

## The question

Released records carry statistics, attacks, ratings, encounter metadata and art, and no prose at all. A GM
reading a monster page sees numbers and a portrait, and nothing that says what the creature *is*. The obvious
fix is to bring in the descriptive text the D&D SRDs already have, with credit. Two things make that the
wrong first move.

## Why the description is authored rather than imported

**The authorized source has none.** Enraged Eggplant's *Monsters* (May 11, 2024) is a GURPS mechanics
conversion. Reading all 1,597 headings in the parsed corpus: every paragraph is either a point-costed build
(`Advantages:`, `Disadvantages:`, `Racial Psionic Abilities:`) or the resolution text for a specific ability
("Water Dependency: The aboleth's survival depends on the mucous membrane it creates around itself..."). The
ability text is already carried, as `stats.attacks[].notes` and traits. There is no creature description in
the source to import, so carrying none withholds nothing.

That absence is fortunate rather than unlucky. The source's own headings cite Monster Manual and Expanded
Psionics Handbook page numbers, so the conversion was written from the books. Descriptions in it, had there
been any, would most likely have been derived from text the author had no right to sublicense — which is the
boundary [LICENSE.md](../../LICENSE.md) draws around the Enraged Eggplant grant: it covers only rights held by
Enraged Eggplant. His rights over the *mechanical conversion*, which is his own GURPS expression, are exactly
what this package publishes.

**The SRD descriptions are not CC BY.** The 3.5 SRD has a description paragraph for essentially every
creature in this package — 293 of the 304 records match its monster index by name — and that text is Open
Game Content under OGL 1.0a, not CC BY 4.0. Importing it would make each record a mixed-licence artifact:
`contentLicense` would have to become `ogl_1_0a`, the release would have to carry the full OGL text and a
complete Section 15 chain, and a downstream consumer could no longer treat the package as uniformly CC BY.
SRD 5.1 *is* CC BY, but its monster entries are stat blocks with no per-creature prose, so it offers almost
nothing to import. Importing 3.5 text remains available as a separate, clearly-bounded OGL side-car package;
it is not a reason to hold up prose the project can author outright.

## Decision

**Descriptions are original Dungeons on Automatic prose, written from project-owned material, and they carry
their own authorship and licence.**

1. Description text lives in `content/descriptions/`, tracked and reviewable, in the same spirit as
   `review/repairs/`: a statement of what a record says and why, never a hand edit to a generated package.
2. Every record carries the `description` key. It is either the object or `null` — never absent — for the
   same reason `lair` and `treasure` always carry their key sets: a consumer reads the field without an
   existence check, and a null reads as "known absent" rather than "field forgotten".
3. A description may be written **only** from project-owned material, and must name what it was written from
   in `basis`: the record's own converted statistics (`record.stats.traits`, `record.stats.attacks`,
   `record.class`, `record.size`, `record.notes`) and this project's art direction for the creature
   (`art.portrait.prompt`, `art.token.prompt`). **No SRD text is a permitted basis.** The enum has no value
   for it and validation rejects one, so laundering OGL prose into a CC BY field cannot happen by accident.
4. The description states `authorship: "doa_authored"` and its own `contentLicense` / `contentLicenseUrl`,
   separately from the record's. The record's licence describes the fan-conversion mechanics; the
   description's describes prose this project wrote. Collapsing the two would put DOA-authored content inside
   an EE-credited record with nothing to distinguish it — the exact failure
   [CREDITS.md](../../CREDITS.md) and the [0.2.0 field policy](0.2.0-empty-field-policy.md) both guard
   against. Enraged Eggplant originator credit is untouched and still travels with the record.
5. Every described record states the authorship in `provenance.conversionNotes` as well, so the fact survives
   into any view that renders notes but not the description block.

## Why the art prompts are a safe basis

`art/enraged-eggplant/image-manifest.json` records the exact prompt behind all 304 generated assets, and
those prompts are project-authored: written from each record's converted statistics as art direction. 229 of
them contain a hand-written descriptive clause about the creature. None came from an SRD — the local
generation helper has an SRD-fallback path, and checking all 304 prompts confirms it was never used. That
makes them CC BY material this project already owns, and the natural seed for prose. It also means the
description and the portrait derive from the same record, so they cannot describe different creatures.

Prompts are raw material, not deliverable text. Validation rejects prompt phrasing that survives into a
description ("three-quarter", "silhouette", "crop-safe", "Depict", "Subject:"), because a GM should be
reading about a creature, not about a picture of one.

## Constraints on the text

- One paragraph, 80-600 characters. Long enough to be worth reading, short enough to sit above a stat block.
- Consistent with the record's own statistics. A description that contradicts the traits or attacks it was
  written from is a review defect, not a stylistic choice.
- No edition-specific mechanics, no rules language, no trademarked or Product Identity names.
- Written, not paraphrased. The prohibition on SRD basis is about expression: knowing that an aboleth is an
  aquatic aberration is a fact, and reusing someone else's sentence about it is not.

## Commands

| Command | What it does |
| --- | --- |
| `npm run descriptions:report` | Regenerate `review/reports/description-coverage.md`: what is described, and what seed material exists for what is not. |
| `npm run descriptions:draft` | Write a drafting sheet of undescribed records with their seed clause, traits, attacks and scale. `--limit N`, `--out <file>`. |
| `npm run descriptions:check` | Validate the content file and fail on unknown record ids. |

`npm run review:apply` merges descriptions into the reviewed package and refuses to write a record missing
the key.

## Status

All 304 records carry authored prose. `review/reports/description-coverage.md` is generated, so the count
cannot overstate itself, and `npm run review:apply` refuses to write a record missing the key. A record added
to the package later ships `description: null` until someone writes one, which is a true statement about the
package rather than a gap in it.

Release notes for a version that ships the field should say:

> Monster descriptions are original Dungeons on Automatic prose, written from each record's own statistics
> and art direction and licensed CC BY 4.0. They are not derived from the fan-conversion source, which states
> none, and not from any SRD. Records without a description carry the field as null.
