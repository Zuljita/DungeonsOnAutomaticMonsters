---
name: convert-gurps-monsters-to-gcs
description: Extract large GURPS monster bestiaries from DOCX into structured Markdown, compare inferred monster sections with parsed D&D 3.5 or 5.1 SRD indexes, and author or validate GCS v5 ancestry/race templates and full monster sheets. Use for private fan-conversion research, SRD overlap audits, `.gct`/`.gcs` creation, point-total reconciliation, ecosystem-portable GCS output, and source/provenance-safe monster conversion work.
---

# Convert GURPS Monsters to GCS

Turn a private GURPS bestiary into reviewable text and GCS ancestry templates without blurring fan-derived material into publishable SRD data.

## GCS Ecosystem Commitment

Treat GCS v5 as a first-class interchange target, not merely a validation aid for DOA. For each approved concrete monster, the intended complete artifact set is a reusable `.gct` ancestry/creature template plus a ready-to-use `.gcs` monster sheet. A true template identity may omit `.gcs` only when the coverage registry records why it is not applicable.

GCS artifacts must use standard GCS fields, deterministic project IDs, reviewed point arithmetic, ordinary `reference`/`local_notes` provenance and credits, and no runtime dependency on DOA or a private master-library checkout. Validate files structurally and in the supported GCS UI. The current bundled pipeline builds `.gct` files; until OML-024 adds the reviewed full-sheet exporter, `.gct` success alone is not full ecosystem completion.

## Workflow

1. Read repository guidance and existing schemas before editing.
2. Put private source documents and unreviewed extraction intermediates under an ignored directory. Verify with `git check-ignore -v`. Publish derived files only when a recorded permission or license allows it.
3. Use the bundled workspace Python runtime, not system Python. Confirm that `python-docx` is available.
4. Run `scripts/extract_and_match.py` with every parsed SRD index in scope. Review the reported heading count and the first/last inferred headings before trusting the output.
5. Inspect `srd-overlap.md`. Accept exact, word-order, singular/plural, recognized size-variant, and explicit alias matches. Do not promote generic fuzzy-string suggestions automatically.
6. Run `scripts/audit_gcs_coverage.py` when an existing GCS monster directory is available. Treat exact names and conservatively qualified base families separately; do not equate distinct creatures merely because one name contains the other.
7. Read `references/gcs-race-template.md` before creating a race. If a matching `.gcs` monster sheet already contains an ancestry container, prefer extracting that native trait tree with `scripts/extract_gcs_ancestry.py` and reconcile it against the document. Otherwise author a compact JSON spec that preserves the source wording, final point costs, modifiers, zero-point features, and review/provenance state.
8. Run `scripts/extract_gcs_ancestry.py` or `scripts/build_gct.py` for each race, then run `scripts/validate_gct.py` on every generated `.gct` file.
9. Reconcile the container point total with the source template total. Stop on any unexplained difference and identify the missing or double-counted trait; an exact library-cost correction is explained only when the arithmetic audit records both values and the matching rule.
10. Open a representative template in GCS during converter development when GUI access is available. Before approving a queue item, open that item in GCS and verify its displayed total and modifier behavior. Treat structural validation as necessary but not proof that every modifier behaves correctly in the UI.

For a large authorized-public queue, use `scripts/batch_convert_missing.py` to produce GCS ancestry drafts, a DOA review package, and a per-monster checklist. Use `--selection missing` for monsters absent from the supplied GCS coverage audit, `--selection covered` to rebuild identities already represented there, or `--selection all` for the complete SRD-overlap set. Pass the master GCS library root when available. The batch converter recursively scans `.adq`, `.adm`, and `.skl` files, keeps every record at `review_required`, replaces only conservative exact matches with native library records, emits racial skills as real root-level GCS skills, and inserts an explicit reconciliation child when prose could not be decomposed cleanly.

## Extract and Match

Run from the repository root:

```powershell
& $BUNDLED_PYTHON scripts/extract_and_match.py `
  path/to/bestiary.docx `
  --output-dir path/to/ignored/output `
  --author "Source author" `
  --srd srd-3-5=path/to/srd-3-5/parsed/monsters.json `
  --srd srd-5-1=path/to/srd-5-1/parsed/monsters.json `
  --alias "Fan name=SRD name"
```

Expect these outputs:

- `bestiary.md`: complete Markdown transcription.
- `monster-index.json`: inferred section boundaries and headings.
- `srd-overlap.md`: compact reviewed-match inventory.
- `srd-overlap-monsters.md`: full text of matched sections.
- `srd-overlap.json`: machine-readable match provenance.

The heading inference expects centered, underlined monster-title paragraphs. If the source uses different formatting, inspect it first and adjust the script deliberately.

## Audit Existing GCS Coverage

Compare the SRD-overlap inventory with native GCS sheets by both filename and `profile.name`:

```powershell
& $BUNDLED_PYTHON scripts/audit_gcs_coverage.py `
  path/to/srd-overlap.json `
  path/to/gcs-monsters `
  --output-json path/to/ignored/gcs-coverage.json `
  --output-markdown path/to/ignored/gcs-coverage.md
```

The audit counts direct normalized names first. It counts a base monster as covered by a family only when a GCS identity is the exact base name followed by a parenthesized qualifier, or by `, Average`. Review all broader relationships manually: `Giant Eagle` is not covered by `Eagle`, `Winter Wolf` is not covered by `Wolf`, and classed character sheets should not be treated as base-race coverage without inspecting their ancestry container.

## Build and Validate GCS Races

Prefer an existing native GCS ancestry container when its points match the source document:

```powershell
& $BUNDLED_PYTHON scripts/extract_gcs_ancestry.py monster.gcs `
  --output race.gct `
  --reference "Private source citation" `
  --source-heading "Exact source heading"
& $BUNDLED_PYTHON scripts/validate_gct.py race.gct
```

If no suitable `.gcs` ancestry exists, create one spec per ancestry and run:

```powershell
& $BUNDLED_PYTHON scripts/build_gct.py race.spec.json --output race.gct
& $BUNDLED_PYTHON scripts/validate_gct.py race.gct
```

Keep source-native trait costs in `calc.points` and racial skill allocations in root-level skill `points`. Model attribute bonuses with `features`, levels, and modifiers when possible; use a final-cost trait plus a source note when the source construction cannot be represented faithfully without inventing rules. Never disguise a racial skill as a trait child: match an exact `.skl` record by name, controlling attribute, and difficulty, or build a review-required skill row from explicit source notation.

## Batch Conversion Queue

```powershell
& $BUNDLED_PYTHON scripts/batch_convert_missing.py `
  --overlap path/to/srd-overlap.json `
  --coverage path/to/gcs-coverage.json `
  --markdown path/to/srd-overlap-monsters.md `
  --output-dir path/to/converted/output `
  --selection all `
  --library-root path/to/GCS-Master-Library
```

Use repeatable `--trait-library LABEL=PATH` or `--modifier-library LABEL=PATH` only when a full library root is unavailable or an intentionally narrow audit is required.

The matcher in `scripts/gcs_library_match.py` requires an exact trait identity and consumes the entire stated level, self-control number, qualifier, and modifier construction. It prefers trait-specific modifiers, then core global modifiers, and gives Basic Set, Powers, and Power-Ups records tie-break priority over setting-specific duplicates. It supports explicitly enumerated flat mode aliases; the current implementation models Basic Set Telecommunication plus its Telesend mode. It materializes parameterized modifiers only when the library template's static name and stated percentage agree; store the source-specific location or condition in `local_notes`. Leave bespoke modifiers, incomplete qualifiers, and noncore cost conflicts as flat source records.

Treat zero-point native-illumination vision separately from the Basic Set Night Vision advantage. When the source lists `Night Vision N` under **Features** at 0 points and its Typical Stats explicitly says that `-N is the native illumination level`, model it as `Feature: Night Adapted Vision (-N) [0]` with reference `DF3:16`. This is the Dungeon Fantasy 3 shifted visual baseline: illumination farther from the native level is penalized in either direction. Do not replace it with paid Night Vision merely because the shorter source label shares that name.

A matched library calculation replaces the fan-stated cost in the rebuilt GCT; every difference is retained in `LIBRARY-AUDIT.md` and `library-audit.json` for author review. Never silently call an unmatched or partially matched construction a rules error. Treat terminology fixes such as a misspelled modifier separately from point-cost corrections.

Treat the generated DOA package as a review artifact, not a consumable release: the public app loader correctly rejects `manualReviewStatus: review_required`. Review every exact-identity cost discrepancy, resolve every remaining GCS reconciliation child, review Typical Stats and attacks, recompute or verify CER, then approve records in small batches.

Run `scripts/validate_gct.py path/to/output/gcs` when a dedicated repository command is unavailable; DOA package validation does not replace GCT validation.

## Provenance Boundary

- Keep fan-derived full text and `.gct` conversions private unless the rights holder grants publication permission.
- When permission exists, record the author, source version, permission basis, and mechanical review status. Publication authorization does not imply mechanical approval.
- When a fan author originated material retained by a derived artifact, preserve a structured originator credit on the package source and every derived DOA record. Put the same canonical credit line in the GCS ancestry container's `local_notes` and keep the author/source in `reference`; later adapters and reviewers supplement rather than replace it.
- Record the fan document and exact source heading on every draft ancestry container.
- Use SRD data only to establish name overlap; do not relabel fan-authored GURPS mechanics as SRD mechanics.
- Do not set public-package fields such as `publicStats: true` or `manualReviewStatus: approved` for fan-derived material merely because the D&D monster name is in an SRD.
- Keep 3.5 OGL, 5.1 CC-BY, GCS library, and fan-conversion provenance distinct.

## Completion Checks

- Confirm the private directory is ignored.
- Confirm the extraction is UTF-8 and has the expected first and last headings.
- Report exact and controlled-variant match counts separately if manual aliases were used.
- Report direct GCS coverage, controlled qualified-family coverage, and missing counts separately.
- Confirm every `.gct` is JSON, version 5, has unique IDs, uses an ancestry container, balances its ancestry child points, and includes any racial skills in the full template total.
- For each approved concrete monster, confirm a corresponding `.gcs` full sheet exists, opens in the supported GCS release, carries the reviewed typical stats/attacks and linked ancestry, and matches the canonical package mechanics. Record `.gcs` as not applicable only for true template identities.
- Confirm every authorized-public `.gct` contains its canonical originator credit and every author-permission package repeats that credit at package-source and record level.
- When library matching is enabled, report native match count, exact modifiers applied, exact-identity cost-discrepancy count, flat-record reasons, and source-total reconciliations separately.
- Run repository tests only for tracked repository changes; do not mistake ignored draft success for a publishable package.
