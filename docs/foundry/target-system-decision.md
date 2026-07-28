# Foundry VTT target-system decision

**Decision (2026-07-28): target the GURPS Game Aid (system id `gurps`), with the door
open to adding a system-agnostic pack later.**

## The question

Foundry Actors are system-specific. A compendium built for `dnd5e` is inert under
`pf2e`, and vice versa. The package's statistics are GURPS-shaped — ST/DX/IQ/HT,
Typical Stats, GURPS damage expressions, GCS constructions — so the module has to
pick the system whose actor model those statistics actually fit.

## Options considered

1. **GURPS Game Aid** (`gurps`). The package already publishes a valid `.gcs`
   sheet per monster, and the Game Aid is the Foundry system built around GCS
   data; its `character` actor model (attributes with `import`/`value`, HP/FP
   pools, `ads`/`skills`/`melee`/`ranged` list objects) maps directly from the
   record's parsed Typical Stats. Cost: the module only works at GURPS tables.
2. **System-agnostic Actors**, carrying the statistics as formatted text. Works
   everywhere; the numbers are reference prose rather than rollable mechanics.
3. **Both**, as two packs in one module.

## Why (1)

The data is GURPS data. Shipping it into the one system that can treat it as
mechanics preserves the most value, and mirrors the reasoning behind the GCS
interchange commitment: publish into the format the statistics natively are.
A system-agnostic pack is a strictly smaller job that can be added later as a
second pack in the same module without disturbing Actor ids, so choosing (1)
now does not foreclose (3).

## Consequences and stated constraints

- `module.json` declares `relationships.systems: [{ id: "gurps" }]` and each
  pack declares `system: "gurps"`.
- Foundry compatibility is pinned at **minimum V12, verified V13** (packs are
  LevelDB directories, the V11+ format, compiled by the official
  `@foundryvtt/foundryvtt-cli`).
- Actor `system` data is populated from the record's parsed Typical Stats
  (attributes, HP/FP, dodge, move, speed, attacks, traits, skills). The full
  GCS construction remains authoritative; each Actor's flags carry the record's
  published `.gct`/`.gcs` URLs so a GM can re-import the complete sheet through
  the Game Aid's own GCS importer.
- **Art is referenced remotely**, not bundled: every asset has a stable
  `https://assets.dungeonsonautomatic.com/...` URL and Foundry accepts remote
  textures. Bundling all 912 assets at 1254×1254 would put the module in the
  hundreds of megabytes; referencing keeps the download near a megabyte. The
  trade-off is that the art requires an internet connection at the table. If
  offline play becomes a real demand, a separate "assets" companion module can
  bundle the same URLs' files without changing this module.
- Hit locations are not populated; `additionalresources.bodyplan` stays
  `humanoid`, which is the Game Aid's default. The record data does not carry a
  body plan, and inventing one per creature would put fabricated mechanics
  behind the source's provenance.
