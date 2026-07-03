# Dungeons on Automatic Monsters

Canonical public monster data packages for [Dungeons on Automatic](https://github.com/Zuljita/DungeonsOnAutomatic).

This repository owns the publishable monster-data contract, conversion inputs, validation scripts, generated JSON packages, and license/provenance documentation. The app consumes released package JSON from this repository or a mirrored public-site URL; the public site documents and links to the packages rather than becoming the canonical data store.

## Repository Layout

- `schema/monster.schema.json` - JSON Schema for a released DOA public monster package.
- `sources/srd-5-1/manifest.json` - SRD 5.1 Creative Commons source manifest.
- `sources/srd-3-5/manifest.json` - 3.5-era SRD OGL source manifest.
- `converted/doa-monsters.json` - generated package output. The initial file is a DOA-authored contract fixture, not converted SRD content.
- `packages/latest/manifest.json` - stable pointer metadata for consumers.
- `scripts/validate-package.mjs` - no-dependency validation checks for package/provenance basics.
- `licenses/` - license boundary notes and required notice templates.

## Status

Initial scaffold. The package format is intentionally usable before the full SRD conversion exists so the app and site can integrate against a stable contract.

## Consumer Contract

Treat `converted/doa-monsters.json` as the public API. Converter internals can change, but released package records must preserve stable IDs, source/license provenance, conversion version, and manual review status.

```bash
npm test
```
