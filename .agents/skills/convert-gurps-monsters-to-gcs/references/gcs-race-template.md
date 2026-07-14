# GCS v5 race-template reference

## Minimal shape

Use a version 5 `.gct` root with one top-level trait container:

```json
{
  "version": 5,
  "id": "B_unique_root_id",
  "traits": [
    {
      "id": "T_unique_container_id",
      "name": "Race name",
      "reference": "Private source citation",
      "container_type": "ancestry",
      "children": [],
      "calc": { "points": 0 }
    }
  ],
  "skills": []
}
```

Add `ancestry` only when the template explicitly inherits from an existing ancestry. The GCS master library commonly uses `Human`, `Elf`, and setting-specific values; omit the field for unrelated monsters rather than inventing a parent ancestry.
Omit the root `skills` array when the racial template grants no skills.

## Mapping rules

- If a source `.gcs` sheet already has a `container_type: "ancestry"` trait tree, extract that tree before rebuilding from prose. Require its point total to match the document version in scope.
- Otherwise, search every available `.adq`, `.adm`, and `.skl` library. Prefer Basic Set, Powers, then Power-Ups when duplicate trait constructions exist; prefer the dedicated native skill library when name, controlling attribute, and difficulty all match. Use setting-specific records only when identity and cost agree exactly. Copy tags, reference, levels, self-control roll, features, weapon blocks, prerequisites, and only the modifiers actually used by the source construction.
- Model a library mode as its parent trait plus the mode modifier when GCS does so; for example, use Telecommunication with the flat Telesend modifier instead of inventing a standalone Telesend trait.
- Use parameterized modifier templates only when the static modifier name and stated percentage match. Replace placeholders with source details in `local_notes`. Leave bespoke modifiers or noncore cost conflicts as flat source records.
- Treat a library cost difference as an audit result, not a silent correction. Keep both values and the library reference in the generated arithmetic report.
- Map ST, DX, IQ, HT, HP, FP, Will, Per, Basic Speed, and Basic Move changes to `attribute_bonus` features.
- Preserve per-level base cost, level count, and source modifiers. Keep the source's final rounded value only for flat source records; for an exact native match, use the library calculation and report any difference in the arithmetic audit.
- Store ordinary advantages, disadvantages, perks, quirks, and abilities as child traits with their final source cost.
- Store racial skills as real records in the root `skills` array, not trait children. Preserve their point allocations; match a native `.skl` record only when name, controlling attribute, and difficulty agree.
- Keep zero-point biological facts as children tagged `Feature`; do not silently discard them.
- Keep attack descriptions in `local_notes` unless a correct GCS `weapons` block can be authored from the source without assumptions.
- Use the source heading, document date/version, and draft/private status in the ancestry container's `local_notes`.
- Use the fan source as the `reference`. Do not cite an SRD as the source of the GURPS mechanics merely because its name matched an SRD record.
- For an authorized-public fan-derived template, include a canonical originator credit in `local_notes`. Keep that credit when library records, later adapters, or human review alter the construction; those contributions supplement rather than replace originator credit.

## Point reconciliation

Sum every ancestry child's numeric `calc.points` and require it to equal the ancestry container's `calc.points`. Add the point allocations of root-level racial `skills`; that combined template total must equal the source template total. Common errors are:

- counting a named ability container and its components;
- omitting zero-cost features from the file (harmless to the total but loses fidelity);
- treating a source replacement note as an additional trait;
- recomputing a modified/rounded cost differently from the source;
- mixing typical-stat skills into the racial template.

## Review status

Treat generated files as structurally valid drafts. Before reuse, review modifier behavior, attack blocks, prerequisites, ancestry inheritance, and displayed totals in GCS. Keep the file private until provenance and permission are resolved.
