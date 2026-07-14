# Open Monster Library Roadmap

Status: proposed program backlog

Canonical backlog: [docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md)

## North Star

Create a versioned, publicly distributable monster-data package that covers the union of the parsed D&D SRD 5.1 and 3.5 monster identities; supplies independently authored DOA/GURPS-compatible statistics, CER, controlled tags, and reviewed AI-generated artwork; produces standard GCS v5 artifacts usable without Dungeons on Automatic; is browsable on the Dungeons on Automatic site; and can be consumed by the Dungeons on Automatic generator without sacrificing determinism or player-safe output.

The package is a public data product. "Open source" is useful shorthand, but releases must name the exact license that applies to each record, field, and asset rather than assuming one software license covers the whole collection.

## What "Full SRD Set" Means

Every monster identity found by the checked-in SRD parsers must appear in a coverage registry. Each source identity must have exactly one disposition:

- published as a canonical monster;
- represented as a source-specific variant of a canonical monster;
- mapped as an alias to another canonical monster;
- deferred to an explicitly named later batch;
- excluded with a recorded scope or rights reason.

There will be no silent gaps. SRD 5.1 is the first publication target. The 3.5 SRD adds identities and variants afterward, with OGL provenance and notices kept separate from CC BY material. Dragons, mundane animals, templates, swarms, and large variant families may be deferred for sequencing, but remain part of the coverage ledger until dispositioned.

## GCS Ecosystem Commitment

GCS compatibility is a first-class product output, not an internal conversion convenience. Canonical monster data must retain enough mechanical structure to generate useful standard GCS v5 files without requiring Dungeons on Automatic or the private GCS master-library checkout at runtime.

For every approved concrete monster, the target deliverables are:

- a `.gct` ancestry/creature template containing its reusable racial traits, features, modifiers, and racial skills;
- a `.gcs` ready-to-use monster sheet containing reviewed typical attributes, attacks, defenses, skills, notes, and the linked ancestry construction;
- package-manifest entries naming the GCS format version, artifact type, checksum, provenance, credit, and download location.

For a source identity that is inherently a template rather than a concrete creature, the `.gct` is required and the coverage registry records why a standalone `.gcs` sheet is not applicable. GCS artifacts must use standard fields, stable project IDs, valid point arithmetic, and ordinary `reference`/`local_notes` fields for provenance and credits. They must open in the supported GCS release and remain useful to other GURPS tools and players independently of DOA-specific metadata.

The rights gate controls delivery mode, not the engineering commitment. If prebuilt public GCS files cannot be distributed, the release must still preserve a lossless GCS mapping and provide or maintain a reproducible local export path to the extent permitted.

## Authorship and Rights Posture

The implementation workflow is **source-restricted independent implementation**, not a representation of legal clean-room isolation. The people and models involved may already know GURPS and published monsters.

For each first draft:

1. Allow only the applicable SRD record, an approved mechanical vocabulary, and the public package contract as direct design inputs.
2. Do not use DFRPG monster entries, GCS monster sheets, or Enraged Eggplant statistics as draft inputs.
3. Record the behavioral requirements, selected mechanics, calculations, and source references in a derivation ledger.
4. Preserve model/tool version and prompt/input hashes when practical.
5. Apply human edits as a separate, attributable review pass.
6. Use EE and official publications only in a separately logged comparison or quality-review phase.
7. Never copy third-party prose, artwork, formatting, or native library records into the public package.

When a later review adopts or retains material originated by Enraged Eggplant, the resulting artifact is no longer represented as solely independent: it receives the structured, scoped EE originator credit defined in [CREDITS.md](CREDITS.md). Credit follows the retained contribution through data, GCS exports, releases, site presentation, app presentation, and any art prompt derived from it.

This discipline improves provenance; it is not a legal conclusion. Public GURPS/GCS-facing artifacts remain behind a release gate until the project documents what may be distributed and under which license. If that gate cannot be cleared, the open core ships separately and the GURPS adapter remains private, user-generated, or distributed only under an expressly permitted policy.

## Repository Responsibilities

| Repository | Responsibility |
| --- | --- |
| `Zuljita/DungeonsOnAutomaticMonsters` | Canonical schemas, source manifests, coverage registry, derivation ledgers, conversion tools, CER/tags/assets metadata, validation, generated packages, notices, and release artifacts. |
| `Zuljita/DungeonsOnAutomaticSite` | Public browsing, search/filter UI, individual monster pages, attribution display, and links to released package assets. It is not the canonical data store. |
| `Zuljita/DungeonsOnAutomatic` | Versioned package loading, schema adaptation, source filtering, deterministic generator enrichment, encounter selection, and GM/player-safe output. |

## Milestones

| Milestone | Outcome | Exit gate |
| --- | --- | --- |
| M0 — Foundations | Rights posture, coverage definition, schema v1, GCS interchange contract, tag/CER contracts, and release channel are decided. | E0 and the blocking portions of E1 are complete. |
| M1 — Vertical slice | 10–12 mechanically varied SRD monsters travel from source through reviewed data, GCS `.gct`/`.gcs` artifacts, CER, tags, two images, a preview site page, and an opt-in app load. | No private raw URL, all records and GCS artifacts validate, and fixed-seed app tests remain deterministic. |
| M2 — SRD 5.1 core | All non-deferred SRD 5.1 identities are reviewed and available as a prerelease package. | Coverage report has no unexplained gaps and every public record is approved. |
| M3 — Complete SRD union | Deferred SRD 5.1 families and 3.5-only identities are either published or explicitly excluded; license notices remain source-specific. | Coverage registry accounts for 100% of parsed source identities and every approved record has its applicable GCS artifact set. |
| M4 — Public v1 | Stable package, GCS bundle, and assets are released, the site is browsable, and the app can use the package to enrich generation. | Cross-repository release checklist and rollback test pass. |
| M5 — Sustainable library | Contribution, review, regeneration, versioning, and deprecation procedures are documented and exercised. | A second release can be produced without ad hoc manual steps. |

## Epics

| Epic | Purpose | Primary milestone |
| --- | --- | --- |
| [E0 — Governance, scope, and provenance](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md#epic-e0) | Decide what may ship and make every source identity accountable. | M0 |
| [E1 — Canonical corpus and package contracts](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md#epic-e1) | Stabilize IDs, variants, schema, and release boundaries. | M0–M1 |
| [E2 — Independent monster and GCS implementation](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md#epic-e2) | Produce reviewed monster mechanics plus portable GCS v5 templates and ready-to-use sheets. | M0–M3 |
| [E3 — CER, taxonomy, and artwork](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md#epic-e3) | Add generator-ready ratings, controlled tags, portraits, and top-down tokens. | M1–M3 |
| [E4 — Validation, packaging, and release](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md#epic-e4) | Make the library reproducible, versioned, attributable, and downloadable. | M1–M4 |
| [E5 — Public-site monster library](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md#epic-e5) | Publish accessible browse, search, detail, and download experiences. | M1–M4 |
| [E6 — Generator integration](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md#epic-e6) | Load the package and use its CER/tags safely and deterministically. | M1–M4 |
| [E7 — Cross-repository operations](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md#epic-e7) | Coordinate releases, contributions, maintenance, and regression response. | M4–M5 |

## Critical Path

`OML-001` + `OML-002` → `OML-010` + `OML-011` + `OML-012` → `OML-003` + `OML-024` → `OML-020` → `OML-030` + `OML-031` + `OML-032` → `OML-033` → `OML-040` + `OML-041` → site/app vertical slices → corpus expansion → `OML-042` + `OML-070`.

The site and app should integrate against the M1 vertical slice before full-corpus conversion. That exposes contract mistakes while only a small reviewed set needs migration.

## Cross-Repository Definition of Done

A monster is public only when:

- its canonical identity and all source mappings are recorded;
- its direct inputs and derivation notes are reviewable;
- its source/license/copyright fields are complete;
- every retained originator contribution has structured credit on the record and all presenting artifacts;
- its mechanics, CER, tags, portrait, and token have passed human review;
- a concrete monster has validated `.gct` and `.gcs` artifacts, or a true template identity has a validated `.gct` plus a recorded not-applicable disposition for `.gcs`;
- its GCS artifacts open in the supported GCS version, reconcile points, preserve provenance/credit, and have no runtime dependency on the private master library or Dungeons on Automatic;
- `manualReviewStatus` is `approved` and `publicStats` is `true`;
- the package, schema, notices, and assets are immutable release artifacts with checksums;
- the public site renders it with attribution and useful alt text;
- the app loads it through the normal module/source-filtering path;
- fixed-seed generation remains deterministic for a pinned package version;
- player-facing output does not reveal GM-only encounter information.

## Working the Backlog

Use the stable `OML-nnn` identifier in branches, commits, and pull requests. Each issue in the canonical backlog includes its target repository, dependencies, task checklist, and acceptance criteria. Check off tasks in the backlog when work lands, or copy an issue section into GitHub while retaining the identifier and a backlink to this roadmap.

Start with `OML-001`, `OML-002`, and `OML-010`; do not begin bulk monster or image generation before their decisions are recorded.
