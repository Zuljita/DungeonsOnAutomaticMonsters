# Foundry VTT module

The published monster package builds into an installable Foundry VTT module —
one compendium of Actors for the GURPS Game Aid (system id `gurps`), one Actor
per approved monster, carrying its portrait, its flat-top hex token, its parsed
Typical Stats, and its licence and originator credit.

- Target-system decision and its constraints: [target-system-decision.md](target-system-decision.md)
- Manual QA checklist for a real Foundry install: [foundry-module-qa.md](foundry-module-qa.md)

## Building

```bash
npm run build:foundry
```

emits `dist/foundry/dungeons-on-automatic-monsters/` (module.json plus one
source JSON per Actor under `packs-source/`), compiles the LevelDB compendium
with the official `@foundryvtt/foundryvtt-cli` (fetched via `npx`; the
repository itself has no dependencies), and archives the module zip. The build
is a pure function of `converted/doa-monsters.json` plus the tracked constants
in `scripts/foundry-module.mjs`, and it **refuses** to build from any record
that is not `approved` with `publicStats: true`.

`npm run validate:foundry` re-runs the build in memory and checks every
invariant without touching disk or the CLI; it is part of `npm test`.

## Contracts worth knowing

- **Actor ids are stable.** Each Actor `_id` is derived from the monster id
  alone (`sha256("doa-foundry-actor:<id>")` mapped to 16 alphanumerics), so
  republishing updates a GM's installed Actors instead of duplicating them.
  The derivation is frozen by a golden-value unit test; changing it is a
  breaking change for every installed world.
- **Player-safe surfaces.** CER, threat tier, encounter derivations and review
  provenance live only under the Actor's `dungeons-on-automatic-monsters`
  flags, which no sheet renders. The validator fails if any of them leak into
  player-facing fields.
- **Licence and credit ride on every Actor** as a note on the sheet: the
  record's content licence and URL, every structured originator credit line,
  and the source copyright notice. Module metadata names the licences too, but
  the Actor-level note is the one a GM actually sees.
- **Art is remote.** `img` is the published portrait URL; the prototype token
  texture is the published hex-token URL, sized from the record's stated hex
  footprint (diameter of the hex circle with that area: 1 hex → 1, 7 → 3,
  14 → 4).
- **Hit locations carry the record's DR**, on a body plan derived from the limbs
  the record's own traits state — a naga slithers so it is vermiform, a dragon
  has four legs and wings so it is a winged quadruped. The Game Aid resolves
  damage by matching location names against a body plan it knows, so the tables
  are its own, transcribed into `schema/foundry-hit-locations.json`. The source
  states one DR per creature rather than a per-location breakdown, so every
  location gets it. Where the stated limbs cannot distinguish two plans — a
  scorpion and an eight-legged basilisk say the same thing — the record is named
  in [schema/foundry-body-plans.json](../../schema/foundry-body-plans.json), and
  the full assignment for every record is in
  [review/reports/foundry-body-plans.md](../../review/reports/foundry-body-plans.md).
- **Attacks that allow no attack roll are not weapons.** An acid aura or a
  petrifying gaze has no to-hit number, so it becomes a note with its resolution
  intact rather than a weapon row implying a roll that does not exist.

## Release

The publish workflow builds the module from the freshly promoted package,
uploads `module.json` and the versioned zip to
`https://assets.dungeonsonautomatic.com/monsters/enraged-eggplant/foundry/`,
attaches the zip to the GitHub release, and records the artifact (with its
sha256) in `packages/latest/manifest.json`. Foundry's **Install Module →
Manifest URL** uses the stable `module.json` URL above.
