# Open Monster Library Backlog

This is the canonical issue-ready backlog for the [Open Monster Library roadmap](../../ROADMAP.md). Stable identifiers let work continue across the data, site, and app repositories without depending on one repository's issue numbers.

## Backlog Conventions

Suggested labels:

- `type:epic`, `type:issue`, `type:task`
- `repo:data`, `repo:site`, `repo:app`, `repo:cross-repo`
- `area:provenance`, `area:schema`, `area:conversion`, `area:gcs`, `area:cer`, `area:tags`, `area:art`, `area:release`
- `priority:p0`, `priority:p1`, `priority:p2`
- `needs-human-review`, `blocked:rights`, `blocked:contract`

Checkboxes represent tasks, not automatic approval. A generated record or image remains unpublishable until an authorized reviewer explicitly approves it.

<a id="epic-e0"></a>

## Epic E0 — Governance, Scope, and Provenance

### OML-001 — Freeze the corpus scope and coverage policy

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0
- Priority: P0
- Dependencies: none
- Outcome: a measurable definition of the full SRD corpus and a rule for every alias, variant, family, template, and exclusion.

Tasks:

- [ ] Declare the source corpus as the union of checked-in SRD 5.1 and 3.5 parser outputs.
- [ ] Define canonical monster, source identity, alias, variant, template, swarm, family, and mundane-animal handling.
- [ ] Record the sequencing policy: SRD 5.1 first, shared identities next, 3.5-only identities afterward.
- [ ] Put dragons and mundane animals into named deferred batches rather than dropping them.
- [ ] Decide whether NPC stat blocks and summoned/template creatures belong in v1 or a later package.
- [ ] Define when multiple SRD stat blocks become variants versus separate canonical monsters.
- [ ] Define coverage metrics and the allowed disposition values.

Acceptance criteria:

- A checked-in policy defines the corpus and dispositions unambiguously.
- Every parsed source identity can be assigned exactly one disposition.
- "Full" can be reported as a numerator, denominator, and categorized remainder.

### OML-002 — Decide the public-license and GURPS distribution boundary

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0
- Priority: P0
- Dependencies: OML-001
- Outcome: the project knows which artifacts can be public, under what terms, and what fallback ships if GURPS-facing data cannot be openly licensed.

Tasks:

- [x] Inventory SRD 5.1 CC BY, SRD 3.5 OGL, DOA-authored data, EE-authorized material, GURPS/GCS material, and generated-image terms separately.
- [x] Decide the license for DOA-authored database structure, original prose, calculations, and metadata.
- [x] Preserve CC BY attribution and OGL notices at record and release level without collapsing them into one ambiguous license.
- [x] Document that EE permission covers EE's work but does not grant rights in incorporated third-party expression.
- [x] Adopt the canonical EE credit line and require scoped structured credit wherever an EE-originated contribution survives.
- [ ] Ask SJ Games the narrow written question about distributing machine-readable GURPS-compatible templates containing trait names, modifiers, levels, and point costs without copied rules text or artwork.
- [ ] Review prior author agreements for obligations relevant to this project.
- [ ] Review the redistribution terms for any GCS master-library records used during private QA.
- [x] Define a fallback: publish the open core while keeping the GURPS adapter private, locally generated, or otherwise policy-compliant.
- [x] Draft the public disclaimer, attribution block, asset notice, and trademark notice.

Acceptance criteria:

- A rights matrix names the owner/source, allowed use, required notice, and release decision for every artifact class.
- The package license does not claim to relicense GURPS rules, trademarks, SJ Games prose/art, or third-party library records.
- The public release pipeline has a binary gate for GURPS/GCS artifacts and a documented open-core fallback.

### OML-003 — Establish the source-restricted independent-implementation protocol

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0
- Priority: P0
- Dependencies: OML-001, OML-002, OML-011
- Outcome: model-first drafts have reproducible input boundaries and derivation evidence without making an inaccurate legal clean-room claim.

Tasks:

- [ ] Name the process "source-restricted independent implementation" in contributor and release documentation.
- [ ] Define allowed draft inputs: one SRD source packet, approved mechanical vocabulary/rules references, schema, tag taxonomy, and calculation specifications.
- [ ] Define excluded draft inputs: DFRPG monster writeups, GCS monster sheets, GCS monster libraries, EE statistics, and prior comparison reports.
- [ ] Generate a minimal per-monster input packet outside the full private research tree.
- [ ] Run first drafts in a fresh task/context that receives only the packet and authoring instructions.
- [ ] Record packet hash, source IDs, tool/model version, prompt version, and output hash.
- [ ] Require a derivation ledger connecting creature requirements to each material mechanical choice.
- [ ] Record human edits and their rationale as a distinct review event.
- [ ] Keep later EE/official comparisons in a separate audit record and never rewrite draft provenance.
- [ ] Pilot the protocol on two mechanically different monsters and revise it before the vertical slice.

Acceptance criteria:

- A reviewer can identify exactly what the drafter saw and why each material choice was made.
- The process does not describe participants as unexposed to GURPS or related publications.
- Re-running the same packet and prompt version produces a reviewable replacement draft without reading private comparison sources.

<a id="epic-e1"></a>

## Epic E1 — Canonical Corpus and Package Contracts

### OML-010 — Build the canonical identity and coverage registry

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0
- Priority: P0
- Dependencies: OML-001
- Outcome: a machine-readable union of SRD identities with stable DOA IDs, source mappings, variants, aliases, and dispositions.

Tasks:

- [ ] Normalize parsed SRD 5.1 and 3.5 identities without discarding source-native IDs.
- [ ] Assign stable DOA canonical IDs that do not encode a mutable package version.
- [ ] Map exact overlap, aliases, singular/plural forms, size variants, templates, and families conservatively.
- [ ] Require manual review for fuzzy or semantic matches.
- [ ] Record source-specific names, URLs, licenses, and copyright notices.
- [ ] Add disposition, batch, review status, and rationale fields.
- [ ] Generate human-readable coverage tables grouped by source and disposition.
- [ ] Add duplicate-ID, orphan-source, and conflicting-mapping validation.

Acceptance criteria:

- Every parsed source identity is represented exactly once.
- Canonical records can cite multiple source identities without losing per-source provenance.
- The coverage report separates published, draft, alias, variant, deferred, excluded, and unresolved counts.

### OML-011 — Freeze public package schema v1

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0
- Priority: P0
- Dependencies: OML-001, OML-002
- Outcome: one versioned contract supports core monster data, provenance, review state, CER, controlled tags, and assets.

Tasks:

- [ ] Add an explicit schema version and compatibility policy to the package manifest.
- [ ] Define canonical identity and source-reference fields for multi-SRD records.
- [x] Preserve required record-level upstream `sourceLicense`, downstream `contentLicense`, copyright, conversion version, notes, approval, and `publicStats` fields.
- [ ] Define structured credits with originator, role, scope, source title/version, display line, and URL; require them for author-permission sources and records.
- [ ] Define CER components, algorithm version, confidence/review fields, and threat tier.
- [ ] Define taxonomy version plus controlled tags without eliminating useful freeform notes.
- [ ] Define portrait and top-down token metadata, URLs, dimensions, media types, hashes, alt text, license, and generation provenance.
- [ ] Define derivation-ledger and review-event references without bloating runtime records unnecessarily.
- [ ] Define GCS v5 artifact references, types, format version, checksums, and compatibility state; require applicable `.gct`/`.gcs` coverage for approved records while allowing the rights gate to select public or local-export delivery.
- [ ] Define additive versus breaking changes and schema-version negotiation.
- [ ] Update fixtures and validator tests alongside the schema proposal.

Acceptance criteria:

- The data repo validator accepts the fixture and rejects missing provenance, invalid tags, malformed assets, and incomplete public records.
- The site can render a record without private conversion files.
- The app can adapt a record to `MonsterDef` without inventing missing required values.

### OML-012 — Freeze the public distribution contract

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0
- Priority: P0
- Dependencies: OML-002, OML-011
- Outcome: consumers use immutable public releases rather than private or mutable raw repository URLs.

Tasks:

- [ ] Select GitHub Release assets, site-hosted artifacts, or both as supported public origins.
- [ ] Define immutable versioned URLs and a small `latest` pointer.
- [ ] Put package, schema, structured credits, notices, asset manifest, checksums, and compatibility metadata into each release.
- [ ] Define package and asset archive layout.
- [ ] Define a standalone GCS bundle layout with stable filenames, per-monster `.gct`/`.gcs` links, checksums, and no DOA runtime dependency.
- [ ] Define cache headers, integrity verification, and rollback behavior.
- [ ] Define the minimum and maximum schema/package versions supported by site and app consumers.
- [ ] Remove private raw `main` URLs from the intended public contract.

Acceptance criteria:

- A released version is immutable and independently verifiable by checksum.
- The site and app can pin an exact package version.
- Updating `latest` is a final promotion step, not the mechanism that creates a release.

### OML-013 — Select the golden vertical-slice corpus

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0
- Priority: P1
- Dependencies: OML-010, OML-011
- Outcome: 10–12 monsters exercise the schema and pipelines before bulk work begins.

Tasks:

- [ ] Include humanoid, undead, construct, ooze, swarm, large creature, ranged/special attacker, and supernatural ability cases.
- [ ] Include at least one SRD 5.1/3.5 overlap and one source-specific variant.
- [ ] Include varied size, movement, senses, defenses, and encounter patterns.
- [ ] Avoid making dragons or mundane animals critical-path dependencies.
- [ ] Record why each golden monster exists and which tests it exercises.

Acceptance criteria:

- Every important schema branch and generator input is exercised by at least one golden monster.
- The list is small enough for full human review, `.gct` and `.gcs` construction, GCS UI inspection, two art assets each, site rendering, and deterministic app tests.

<a id="epic-e2"></a>

## Epic E2 — Independent Monster and GCS Implementation

### OML-020 — Produce the end-to-end independent vertical slice

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M1
- Priority: P0
- Dependencies: OML-003, OML-010, OML-011, OML-013, OML-024, OML-030, OML-031
- Outcome: the golden corpus has source-restricted drafts, derivation ledgers, reviewed mechanics, and valid package records.

Tasks:

- [ ] Generate one restricted input packet per golden monster.
- [ ] Draft attributes, attacks, traits, skills, encounter data, and explanatory notes from those packets.
- [ ] Store derivation ledgers and review events separately from runtime package records.
- [ ] Recalculate all point totals and derived values rather than inheriting fan or official totals.
- [ ] Perform human mechanical review and record every material edit.
- [ ] Generate and review a reusable `.gct` template and a ready-to-use `.gcs` sheet for each concrete golden monster.
- [ ] Compare against EE or official treatments only after the independent draft is frozen, when useful.
- [ ] If an EE-originated construction is adopted during comparison, add scoped EE credit before the record can be approved.
- [ ] Resolve every discrepancy or record a deliberate design difference.
- [ ] Promote only approved records into the preview package.

Acceptance criteria:

- All golden records validate and have no unresolved reconciliation placeholders.
- All applicable golden GCS artifacts open in the supported GCS release, reconcile their totals, and work without Dungeons on Automatic.
- No draft input packet contains EE or official monster-template content.
- Each approved record has a complete derivation and review trail.

### OML-021 — Convert and review the SRD 5.1 core batch

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M2
- Priority: P1
- Dependencies: OML-020, OML-040, OML-041
- Outcome: all non-deferred SRD 5.1 identities have independently authored and manually reviewed DOA records.

Tasks:

- [ ] Partition the corpus into review-sized batches by mechanical family.
- [ ] Generate restricted source packets and first drafts without auto-approval.
- [ ] Reuse mechanical patterns only through documented project-authored building blocks.
- [ ] Review attacks, defenses, special abilities, movement, senses, size, grappling, and encounter fields.
- [ ] Resolve aliases and source variants through the coverage registry.
- [ ] Track review throughput and recurring modeling questions.
- [ ] Publish prerelease packages after each approved batch.

Acceptance criteria:

- Every non-deferred SRD 5.1 identity is approved, aliased, variant-mapped, or explicitly excluded.
- Batch regeneration is deterministic apart from documented model-generated draft text.
- No review-required record enters a public release.

### OML-022 — Complete deferred families: dragons, mundane animals, templates, and swarms

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M3
- Priority: P2
- Dependencies: OML-021
- Outcome: high-volume families are modeled consistently without exploding the package into incoherent duplicates.

Tasks:

- [ ] Define family/variant inheritance rules that can be materialized into standalone runtime records.
- [ ] Model dragon color, age, and size variants without hiding important mechanical differences.
- [ ] Model mundane animals with a consistent realism and encounter-use policy.
- [ ] Distinguish a swarm from an individual creature explicitly.
- [ ] Decide whether templates are generators, pre-materialized variants, or both.
- [ ] Add family-level validation and representative GCS/UI checks.

Acceptance criteria:

- Every deferred source identity receives a final disposition.
- Materialized package records require no runtime access to private family source data.
- Similar variants follow documented construction rules and retain individual review status.

### OML-023 — Add the 3.5-only corpus and source variants

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M3
- Priority: P1
- Dependencies: OML-002, OML-010, OML-021, OML-040
- Outcome: the canonical package covers 3.5-only identities while preserving OGL obligations and avoiding duplicate canonical monsters.

Tasks:

- [ ] Separate 3.5-only identities from overlaps and variants.
- [ ] Keep OGL-derived text/data and required notices distinguishable from CC BY and DOA-authored material.
- [ ] Generate and review source-restricted implementations in mechanical-family batches.
- [ ] Add source-specific variants only when differences matter to consumers.
- [ ] Preserve 3.5 source identity and URL on every mapping.
- [ ] Test release assembly with mixed-license records and complete notices.

Acceptance criteria:

- The coverage report accounts for 100% of parsed 3.5 identities.
- Consumers can identify the license and source basis of every record.
- Mixed-source releases contain every required notice and no ambiguous blanket-license statement.

### OML-024 — Freeze and implement portable GCS v5 interchange

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0–M1
- Priority: P0
- Dependencies: OML-002, OML-011, OML-013
- Outcome: GCS is a required, portable output target: every approved concrete monster can produce a reusable `.gct` template and a ready-to-use `.gcs` sheet without cloning or requiring third-party library records.

Tasks:

- [ ] Freeze the supported GCS file-format version and record it in manifests and compatibility reports.
- [ ] Define the canonical mapping from DOA attributes, traits, modifiers, features, skills, attacks, equipment, notes, provenance, and credits to standard GCS fields.
- [ ] Produce `.gct` ancestry/creature templates for reusable racial construction and racial skills.
- [ ] Produce `.gcs` full monster sheets for concrete creatures using reviewed typical stats, attacks, defenses, skills, equipment, and the linked ancestry construction.
- [ ] Mark `.gcs` not applicable only for true template identities and require a coverage-registry rationale.
- [ ] Avoid copied descriptions, notes, UUIDs, and native master-library record payloads.
- [ ] Recalculate trait, modifier, skill, and container totals independently.
- [ ] Emit GCS v5 JSON with deterministic project IDs, explicit provenance/credits, and no private filesystem references.
- [ ] Add package-manifest artifact entries with type, GCS version, checksum, review status, and download path.
- [ ] Validate structure automatically, open every golden artifact in GCS, and verify displayed totals, attacks, modifiers, and linked ancestry behavior.
- [ ] Test round-trip or regeneration invariants so importing/exporting does not silently drop material canonical mechanics.
- [ ] Ensure GCS artifacts can be downloaded and used without installing or running Dungeons on Automatic.
- [ ] Gate prebuilt public inclusion on OML-002; if blocked, preserve the lossless mapping and maintain a reproducible permitted local exporter rather than dropping GCS support.

Acceptance criteria:

- Every golden concrete monster has a valid `.gct` and `.gcs`; every true template identity has a valid `.gct` and explicit `.gcs` disposition.
- Golden exports open in the supported GCS release and display reviewed totals, attacks, modifier behavior, provenance, and credits.
- The artifacts and exporter do not depend on redistributing or accessing the local GCS master library at runtime.
- The canonical schema retains enough information to regenerate the same reviewed GCS mechanics without DOA-only interpretation.
- The rights decision changes public delivery mode, not the GCS compatibility requirement.

### OML-025 — Run EE and official-publication comparison as a separate QA pass

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M2–M3
- Priority: P2
- Dependencies: OML-020, OML-024
- Outcome: prior art improves quality without being misrepresented as the origin of independent drafts.

Tasks:

- [ ] Freeze the independent draft and its hash before comparison.
- [ ] Compare EE statistics under the recorded author permission.
- [ ] Compare official publications only for quality review and only to the extent permitted.
- [ ] Classify differences as error, judgment call, source-edition difference, or distinctive third-party expression.
- [ ] Record human changes, source basis, and whether they alter the release provenance/license.
- [ ] Apply the canonical scoped EE originator credit to every record, GCS export, or prompt that retains an EE-originated contribution.
- [ ] Keep feedback to EE separate from public package derivation records.
- [ ] Never auto-copy a native GCS trait tree during this pass.

Acceptance criteria:

- Every comparison-driven change is attributable and rights-reviewed.
- The original independent derivation remains available for audit.
- Similarity to an official implementation is explained by functional reasoning where possible, not hidden.

### OML-026 — Complete full-corpus mechanical acceptance

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M3
- Priority: P1
- Dependencies: OML-021, OML-022, OML-023, OML-024, OML-031
- Outcome: every publishable monster has passed a consistent mechanical review standard.

Tasks:

- [ ] Require two-pass review for especially complex monsters and high-impact generator records.
- [ ] Resolve all placeholder costs, ambiguous attacks, and incomplete special abilities.
- [ ] Verify size, reach, movement, senses, grappling, and encounter quantities.
- [ ] Verify CER after final mechanics rather than before.
- [ ] Spot-check GCS totals and UI behavior by mechanical family.
- [ ] Produce a signed-off exception list for deliberate approximations.

Acceptance criteria:

- No public record is `draft` or `review_required`.
- Coverage, validation, and exception reports agree on the final corpus.
- Changes to mechanics automatically invalidate prior CER and approval where appropriate.

<a id="epic-e3"></a>

## Epic E3 — CER, Taxonomy, and Artwork

### OML-030 — Define the controlled monster-tag taxonomy

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0
- Priority: P0
- Dependencies: OML-001, OML-010
- Outcome: tags are consistent enough for search and generator constraints while remaining understandable to humans.

Tasks:

- [ ] Define categories for creature class, physiology, intelligence, movement, habitat, senses, combat role, damage, defense, social organization, encounter context, and special hazards.
- [ ] Separate class tags from descriptive or generator-behavior tags when their semantics differ.
- [ ] Define canonical spelling, casing, IDs, descriptions, and deprecations.
- [ ] Map legacy DOA tags to the controlled vocabulary.
- [ ] Mark tags as sourced, mechanically derived, or editorial.
- [ ] Define which tags the generator may use as hard constraints versus soft preferences.
- [ ] Version the taxonomy and validate every public tag.

Acceptance criteria:

- Golden monsters can be usefully filtered without free-text heuristics.
- Unknown or deprecated tags fail validation or require an explicit compatibility mapping.
- The app and site can consume the same tag IDs and human-readable labels.

### OML-031 — Specify, calculate, and calibrate CER

- Repository: `DungeonsOnAutomaticMonsters` with app review
- Milestone: M0–M1
- Priority: P0
- Dependencies: OML-011, OML-013
- Outcome: CER is reproducible, versioned, calibrated, and meaningful to the generator.

Tasks:

- [ ] Locate and document the current DOA offense, protection, CER, treasure-adjusted, and wandering calculations.
- [ ] Define required mechanical inputs and explicit handling of unknown or nonnumeric effects.
- [ ] Version the algorithm and store the version on every calculated record.
- [ ] Distinguish calculated value, human adjustment, final value, confidence, and review notes.
- [ ] Build golden cases covering glass cannons, tanks, swarms, save-or-lose effects, regeneration, insubstantial foes, and group encounters.
- [ ] Calibrate threat tiers against known DOA encounter behavior rather than copying D&D CR.
- [ ] Recalculate automatically when relevant stats change.
- [ ] Require human review for outliers and unsupported abilities.

Acceptance criteria:

- The same monster and algorithm version always produce the same calculated CER.
- Human adjustments are visible and do not overwrite the calculated baseline.
- App encounter tests demonstrate sensible relative ordering across the golden set.

### OML-032 — Define the AI-art and asset contract

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M0–M1
- Priority: P0
- Dependencies: OML-002, OML-011, OML-013
- Outcome: every monster can have a consistent portrait and usable top-down hex token with complete provenance.

Tasks:

- [ ] Define portrait dimensions, aspect ratio, format, color profile, file-size budget, and thumbnail derivatives.
- [ ] Define token dimensions, transparent background, true top-down viewpoint, facing direction, footprint, and hex-safe margins.
- [ ] Decide whether the released token is transparent art, a composited hex, or both.
- [ ] Create a visual style guide that is distinct from D&D and SJ Games trade dress.
- [ ] Define prompt templates from open monster descriptions without referencing living artists or proprietary depictions.
- [ ] Store generator/model/version, creation date, prompt or prompt hash, seed when available, source monster ID, reviewer, license/terms, dimensions, and SHA-256.
- [ ] Carry structured EE credit into image metadata whenever EE-authored description or design material contributes to the prompt; do not add originator credit for audit-only comparison.
- [ ] Require useful alt text and flag potentially sensitive imagery.
- [ ] Define rejection criteria for wrong anatomy, wrong viewpoint, unreadable silhouettes, text/logos, copied-looking characters, and inconsistent scale.
- [ ] Document regeneration and supersession without overwriting released assets.

Acceptance criteria:

- Asset metadata is sufficient to audit origin, terms, identity, and integrity.
- Portraits and tokens render correctly in the site and planned app surfaces.
- No image is publishable solely because generation succeeded.

### OML-033 — Generate and review vertical-slice artwork

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M1
- Priority: P1
- Dependencies: OML-013, OML-032
- Outcome: the golden corpus proves the full prompt, generation, QA, optimization, and packaging workflow.

Tasks:

- [ ] Generate one portrait and one top-down token for each golden monster.
- [ ] Preserve original generation outputs outside release derivatives.
- [ ] Review identity, anatomy, silhouette, viewpoint, footprint, style, and rights metadata.
- [ ] Regenerate failures rather than repairing provenance manually.
- [ ] Create optimized web derivatives and verify hashes/dimensions.
- [ ] Test transparent tokens over light, dark, and common battle-map backgrounds.
- [ ] Add alt text and explicit approval state.

Acceptance criteria:

- Every golden monster has two approved assets and complete metadata.
- Site performance budgets and token legibility targets are met.
- Release assembly can include or separately archive the assets reproducibly.

### OML-034 — Generate and review full-corpus artwork

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M2–M3
- Priority: P2
- Dependencies: OML-033, OML-041
- Outcome: every published monster has consistent, approved visual assets without blocking mechanical review unnecessarily.

Tasks:

- [ ] Generate in resumable batches keyed by canonical monster ID and asset-spec version.
- [ ] Use family-aware prompts while avoiding near-duplicate portraits and tokens.
- [ ] Keep mechanical approval and asset approval as separate states.
- [ ] Route every image through human visual review.
- [ ] Detect missing, duplicated, corrupt, oversized, and hash-mismatched assets automatically.
- [ ] Publish partial asset-complete prereleases only when the manifest states coverage accurately.

Acceptance criteria:

- Every v1 monster has an approved portrait and token or an explicit asset exception.
- Regeneration never changes an existing released asset URL or checksum.
- Asset coverage and review counts are visible in release reports.

<a id="epic-e4"></a>

## Epic E4 — Validation, Packaging, and Release

### OML-040 — Expand data and provenance validation

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M1
- Priority: P0
- Dependencies: OML-010, OML-011, OML-030, OML-031, OML-032
- Outcome: invalid, unlicensed, incomplete, or unreviewed data cannot enter a public package.

Tasks:

- [ ] Validate schema version, unique canonical IDs, and manifest/source references.
- [ ] Validate that every coverage-registry identity has exactly one disposition.
- [ ] Validate record-level source, license, copyright, conversion, approval, and public-stat fields.
- [ ] Require package-level, source-level, and record-level originator credits to agree for author-permission material.
- [ ] Validate controlled tags and taxonomy version.
- [ ] Validate CER inputs, algorithm version, ranges, and stale-calculation detection.
- [ ] Validate asset existence, type, dimensions, hashes, metadata, and approval.
- [ ] Validate mixed-license notice assembly.
- [ ] Validate every emitted GCS artifact separately from the DOA runtime package.
- [ ] Require every approved concrete record to reference validated `.gct` and `.gcs` artifacts, with explicit not-applicable handling only for true templates.
- [ ] Add negative fixtures for each public-release gate.

Acceptance criteria:

- `npm test` fails for every intentionally broken fixture.
- There is no command-line option that silently publishes review-required records.
- Validation reports identify the monster and actionable failing field.

### OML-041 — Make conversion and package builds reproducible

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M1
- Priority: P0
- Dependencies: OML-003, OML-011, OML-040
- Outcome: canonical inputs produce stable, reviewable packages and reports.

Tasks:

- [ ] Separate authored inputs, generated drafts, approved records, and release outputs.
- [ ] Sort records and object lists deterministically where order is not semantic.
- [ ] Keep volatile timestamps and environment details out of content hashes.
- [ ] Pin converter, schema, taxonomy, CER, prompt, and asset-spec versions.
- [ ] Generate coverage, provenance, review, CER, tag, and asset reports with each build.
- [ ] Generate GCS artifacts deterministically and report `.gct`/`.gcs` coverage, supported version, validation, and UI-review state.
- [ ] Fail builds on dirty generated outputs or incompatible version combinations.
- [ ] Document the exact commands needed for a clean rebuild.

Acceptance criteria:

- Two clean builds from the same approved inputs produce identical package and manifest hashes.
- Generated diffs are reviewable and identify the responsible input/version change.
- A release never depends on ignored private files at runtime.

### OML-042 — Implement immutable release assembly and promotion

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M1–M4
- Priority: P1
- Dependencies: OML-012, OML-040, OML-041
- Outcome: preview and stable releases contain all required data, notices, assets, checksums, and compatibility metadata.

Tasks:

- [ ] Assemble versioned package JSON, schema, manifest, standalone GCS bundle, structured credits, notices, reports, and asset archives.
- [ ] Generate SHA-256 checksums and verify them before upload.
- [ ] Publish prereleases for vertical slice and batch review.
- [ ] Define semantic-version rules for data, schema, corrected mechanics, and replaced art.
- [ ] Generate a human-readable changelog including added, changed, superseded, and removed IDs.
- [ ] Promote a tested immutable version to `latest` only after site and app compatibility checks.
- [ ] Exercise rollback by repointing consumers to the prior compatible version.

Acceptance criteria:

- Consumers can download and verify a release without repository access.
- Stable releases are never mutated in place.
- Promotion and rollback do not require changing canonical monster IDs.

### OML-043 — Publish Open Monster Library v1

- Repository: cross-repository
- Milestone: M4
- Priority: P1
- Dependencies: OML-026, OML-034, OML-042, OML-053, OML-063, OML-070
- Outcome: the complete approved corpus, site, and app integration are publicly available as one coordinated release.

Tasks:

- [ ] Freeze the candidate package and asset versions.
- [ ] Run all data, GCS, site, app, attribution, accessibility, and link checks.
- [ ] Confirm every applicable GCS artifact opens independently of DOA and matches the released package mechanics.
- [ ] Review coverage and all exceptions.
- [ ] Publish data artifacts and verify public availability.
- [ ] Publish or update the site against the exact released version.
- [ ] Release app support with compatible version bounds.
- [ ] Announce license boundaries, source coverage, known approximations, and contribution path.
- [ ] Monitor errors and retain a tested rollback target.

Acceptance criteria:

- A new user can browse, download, verify, and use the library without private-repository access.
- Site and app report the same package version and monster count.
- All three repositories link to the release notes and attribution material.

<a id="epic-e5"></a>

## Epic E5 — Public-Site Monster Library

### OML-050 — Add a versioned site data client and hosting path

- Repository: `DungeonsOnAutomaticSite`
- Milestone: M1
- Priority: P0
- Dependencies: OML-012, OML-020, OML-042 preview release
- Outcome: the site reads a pinned public release or site-hosted mirror with integrity and graceful failure.

Tasks:

- [ ] Read the site repository guidance and current build/deploy contract.
- [ ] Select release-asset fetch, build-time mirroring, or site-hosted JSON according to OML-012.
- [ ] Verify package schema version and checksum before rendering.
- [ ] Cache an exact version and display the loaded version to users.
- [ ] Provide useful loading, empty, incompatible, and unavailable states.
- [ ] Never reference private raw repository URLs.
- [ ] Add a safe update procedure and rollback to a prior package.

Acceptance criteria:

- The site works from a public immutable artifact.
- A broken or incompatible new release does not blank the existing library.
- Package version and attribution are visible.

### OML-051 — Build the browsable Monster Library index

- Repository: `DungeonsOnAutomaticSite`
- Milestone: M1–M4
- Priority: P1
- Dependencies: OML-030, OML-031, OML-033, OML-050
- Outcome: visitors can discover monsters by name and generator-relevant characteristics.

Tasks:

- [ ] Add or update `monsters.html` and keep navigation consistent across static pages.
- [ ] Implement name search plus filters for class, controlled tags, size, CER/threat tier, and source.
- [ ] Support predictable sorting and shareable filter state.
- [ ] Show portrait thumbnail, name, key tags, size, CER/tier, and source on result cards.
- [ ] Add paging or virtualization if the full corpus requires it.
- [ ] Make keyboard, screen-reader, mobile, and no-image states usable.
- [ ] Link downloads to the exact public release artifacts.

Acceptance criteria:

- Golden and full-corpus searches return correct, stable results.
- Filters use taxonomy IDs rather than display-string guessing.
- The page meets agreed accessibility and performance budgets.

### OML-052 — Build canonical monster detail pages

- Repository: `DungeonsOnAutomaticSite`
- Milestone: M1–M4
- Priority: P1
- Dependencies: OML-024, OML-033, OML-050
- Outcome: every monster has a durable, attributable, browsable detail view.

Tasks:

- [ ] Define stable URLs based on canonical IDs with redirects for renamed slugs.
- [ ] Render portrait, top-down token, core stats, attacks, traits, skills, encounter data, CER, and tags.
- [ ] Explain CER method/version and distinguish calculated versus adjusted values.
- [ ] Render source/license/copyright attribution and conversion/review notes.
- [ ] Render structured originator credit prominently whenever the record or displayed asset carries it.
- [ ] Offer per-monster and complete GCS bundle downloads when the release contract and rights gate allow prebuilt publication; otherwise document the permitted local export path.
- [ ] Add useful alt text and downloadable token links.
- [ ] Provide related monsters through canonical variants and controlled tags.

Acceptance criteria:

- Every public canonical monster resolves to one detail URL.
- No GM-only application state is required to understand the published record.
- Attribution and license information remain visible without opening raw JSON.

### OML-053 — Verify site accessibility, performance, SEO, and release safety

- Repository: `DungeonsOnAutomaticSite`
- Milestone: M4
- Priority: P1
- Dependencies: OML-051, OML-052
- Outcome: the full library remains fast, accessible, indexable, and resilient.

Tasks:

- [ ] Test keyboard navigation, focus order, landmarks, contrast, labels, and image alt text.
- [ ] Measure full-corpus index and detail-page performance on mobile-sized connections.
- [ ] Add canonical metadata and an index strategy for monster detail URLs.
- [ ] Check all package, asset, source, and license links.
- [ ] Test missing/corrupt assets and package-version mismatch behavior.
- [ ] Run site build/static checks and preserve consistent navigation.

Acceptance criteria:

- No critical accessibility failures remain.
- Broken external data degrades gracefully to the last known compatible package or a clear error.
- Public crawlers can discover canonical monster pages without indexing private artifacts.

<a id="epic-e6"></a>

## Epic E6 — Generator Integration

### OML-060 — Load and adapt versioned public monster packages

- Repository: `DungeonsOnAutomatic`
- Milestone: M1
- Priority: P0
- Dependencies: OML-011, OML-012, OML-020, OML-042 preview release
- Outcome: the app can opt into a pinned library through its existing module and source-filtering path.

Tasks:

- [ ] Read app `AGENTS.md`, `REGISTRY.md`, module-loader code, exports, and nearby tests before editing.
- [ ] Validate manifest and schema compatibility before adapting records.
- [ ] Convert package records to `MonsterDef[]` through the existing public-package adapter.
- [ ] Route monsters through `FilteredModule` and source filtering rather than a parallel generator path.
- [ ] Support explicit package version pinning, caching, integrity verification, and offline fallback.
- [ ] Keep the library optional and preserve existing behavior when disabled.
- [ ] Reject records unless `provenance.publicStats === true` and review status is approved.
- [ ] Surface package/source/version information for debugging and exports.

Acceptance criteria:

- The app loads the golden package and rejects incompatible, corrupt, or unapproved records.
- Disabling the package preserves existing fixed-seed output.
- No runtime fetch depends on a private repository URL.

### OML-061 — Use CER and tags to enrich deterministic generation

- Repository: `DungeonsOnAutomatic`
- Milestone: M1–M4
- Priority: P1
- Dependencies: OML-030, OML-031, OML-060
- Outcome: package monsters improve encounter selection and thematic generation without changing determinism guarantees.

Tasks:

- [ ] Map controlled tags to existing generator constraints and preferences explicitly.
- [ ] Use CER/versioned threat data in encounter budgeting and placement.
- [ ] Define behavior for unknown, low-confidence, or human-adjusted CER.
- [ ] Avoid double-counting source challenge values and DOA CER.
- [ ] Include package version in reproducibility/debug metadata.
- [ ] Add fixed-seed golden tests for tag filtering, encounter budgets, variants, and source toggles.
- [ ] Compare distribution and difficulty before and after enabling the package.

Acceptance criteria:

- A fixed seed, configuration, module set, and package version always produce the same result.
- Tag filters never select a monster outside hard constraints.
- CER-enriched encounters pass agreed sanity checks and preserve an opt-out path.

### OML-062 — Surface public assets and provenance safely in app output

- Repository: `DungeonsOnAutomatic`
- Milestone: M4
- Priority: P2
- Dependencies: OML-032, OML-034, OML-060
- Outcome: approved portraits/tokens and source information are available where useful without leaking GM-only encounter data.

Tasks:

- [ ] Decide which GM views and exports display portrait and token assets.
- [ ] Keep player exports free of hidden encounter details even when monster stats are public.
- [ ] Preserve public-stat gating in all render paths.
- [ ] Include attribution and package version in appropriate GM/export metadata.
- [ ] Preserve structured originator credits in every GM view or export that presents the credited statistics or assets.
- [ ] Cache assets with checksum verification and usable placeholders.
- [ ] Test missing assets, offline operation, and superseded asset versions.

Acceptance criteria:

- GM output can identify and use approved assets.
- Player-safe exports remain player-safe in regression tests.
- Asset failures do not break generation or reveal private paths.

### OML-063 — Complete app compatibility and regression testing

- Repository: `DungeonsOnAutomatic`
- Milestone: M4
- Priority: P1
- Dependencies: OML-060, OML-061, OML-062
- Outcome: public-package support is stable across valid, invalid, absent, and upgraded package states.

Tasks:

- [ ] Add unit tests for schema adaptation, provenance gates, version bounds, and errors.
- [ ] Add deterministic smoke fixtures for golden and representative full-corpus records.
- [ ] Test source filtering, module defaults, encounter placement, narrative surfaces, and GM/player exports.
- [ ] Test absent package, network failure, checksum failure, unknown schema, and rollback.
- [ ] Run `phase0`, `phase2:smoke`, `phase3:smoke`, `registry`, and `build`; run `phase1` and `narrative:smoke` when shared/default behavior changes.
- [ ] Document supported package versions and upgrade behavior.

Acceptance criteria:

- All required app checks pass against the release candidate.
- Existing generation remains unchanged when the package is disabled.
- Failure states are explicit and do not silently substitute incompatible data.

<a id="epic-e7"></a>

## Epic E7 — Cross-Repository Operations

### OML-070 — Define and exercise cross-repository release choreography

- Repository: cross-repository
- Milestone: M1–M4
- Priority: P0
- Dependencies: OML-042, OML-050, OML-060
- Outcome: data, site, and app versions are promoted and rolled back in a safe order.

Tasks:

- [ ] Release immutable data/package assets first.
- [ ] Verify public reachability, checksums, notices, and compatibility metadata.
- [ ] Verify standalone GCS bundle coverage, checksums, supported-version metadata, and representative imports before promotion.
- [ ] Update and test the site against the exact release.
- [ ] Update and test the app's supported version range or pinned default.
- [ ] Promote `latest` only after both consumers pass.
- [ ] Record a compatibility matrix across data, site, and app releases.
- [ ] Exercise rollback of site and app to the last compatible package.

Acceptance criteria:

- A failed site or app rollout does not require mutating the data release.
- Operators can identify the exact three-version combination in production.
- Rollback has been tested rather than merely documented.

### OML-071 — Document contribution and human-review workflows

- Repository: `DungeonsOnAutomaticMonsters`
- Milestone: M5
- Priority: P1
- Dependencies: OML-003, OML-026, OML-034, OML-040
- Outcome: new monsters, corrections, CER changes, tags, and art can be contributed without weakening provenance or review quality.

Tasks:

- [ ] Create issue/PR templates using the stable OML identifiers and provenance questions.
- [ ] Document source-restricted draft preparation and forbidden inputs.
- [ ] Document mechanical, CER, tag, art, rights, and GCS review checklists.
- [ ] Require reviewers and review timestamps without exposing unnecessary personal data.
- [ ] Define how corrections invalidate dependent approvals and derived assets.
- [ ] Define dispute and exception handling for judgment calls.
- [ ] Add a contributor-facing license and attribution guide.
- [ ] Document that adapters, reviewers, editors, and artists receive additional credits and never replace an originator credit attached to retained work.

Acceptance criteria:

- A contributor can prepare a valid change without access to ignored private research files.
- Approval responsibility is explicit for every publishable artifact.
- Review-required content cannot be merged into a stable package unnoticed.

### OML-072 — Add maintenance metrics, deprecation, and audit cadence

- Repository: cross-repository
- Milestone: M5
- Priority: P2
- Dependencies: OML-043, OML-070, OML-071
- Outcome: the library remains accurate and compatible after v1.

Tasks:

- [ ] Report corpus coverage, review queue, CER outliers, taxonomy drift, asset coverage, and broken links.
- [ ] Define canonical-ID stability, redirects, deprecation windows, and removal policy.
- [ ] Schedule periodic source/license, package-integrity, link, and consumer-compatibility audits.
- [ ] Track app selection frequency and generation failures without collecting private campaign content.
- [ ] Define patch-release handling for mechanical errors and asset replacements.
- [ ] Exercise a small post-v1 correction release end to end.

Acceptance criteria:

- Maintainers can see gaps and regressions without manually comparing three repositories.
- Consumers receive actionable deprecation metadata before removals.
- The second release follows the documented process successfully.

## Recommended First Work Queue

1. OML-001 — corpus scope and dispositions.
2. OML-002 — rights matrix and GURPS/open-core fork.
3. OML-010 — canonical identity registry.
4. OML-030 and OML-031 — tag and CER contracts.
5. OML-011 and OML-012 — schema and public distribution contract.
6. OML-003, OML-013, and OML-024 — restricted implementation protocol, golden corpus, and GCS interchange contract/exporters.
7. OML-020 — end-to-end monster and GCS vertical slice.
8. OML-032 and OML-033 — asset contract and vertical-slice images.
9. OML-040 through OML-042 — validation and preview release.
10. OML-050/051/052 and OML-060/061 — site and app vertical slices in parallel after the preview release.
