# Dungeons on Automatic Monsters

Canonical public monster data packages for [Dungeons on Automatic](https://github.com/Zuljita/DungeonsOnAutomatic).

This repository owns the publishable monster-data contract, conversion inputs, validation scripts, generated JSON packages, and license/provenance documentation. The app consumes released package JSON from this repository or a mirrored public-site URL; the public site documents and links to the packages rather than becoming the canonical data store.

## Repository Layout

- `schema/monster.schema.json` - JSON Schema for a released DOA public monster package.
- `sources/srd-5-1/manifest.json` - SRD 5.1 Creative Commons source manifest.
- `sources/srd-3-5/manifest.json` - 3.5-era SRD OGL source manifest.
- `sources/enraged-eggplant/manifest.json` - author-authorized GURPS fan-conversion source manifest.
- `converted/doa-monsters.json` - generated package output. The initial file is a DOA-authored contract fixture, not converted SRD content.
- `packages/latest/manifest.json` - stable pointer metadata for consumers.
- `scripts/validate-package.mjs` - no-dependency validation checks for package/provenance basics.
- `licenses/` - license boundary notes and required notice templates.
- `CREDITS.md` - originator-credit policy and canonical structured credit lines.
- `LICENSE.md` - repository-wide license map for data, software, and source-specific exceptions.
- `NOTICE.md` - release attribution, third-party notices, and trademark disclaimers.

## Status

Initial scaffold. The package format is intentionally usable before the full SRD conversion exists so the app and site can integrate against a stable contract.

## Licensing

This is a multi-license repository:

- original DOA monster data, prose, calculations, metadata, and documentation use [CC BY 4.0](licenses/CC-BY-4.0.txt);
- scripts, schema, and project-authored technical tooling use the [MIT License](licenses/MIT.txt);
- SRD 5.1-derived records remain CC BY 4.0 with the exact Wizards attribution in [NOTICE.md](NOTICE.md);
- 3.5-era SRD records remain under [OGL 1.0a](licenses/OGL-1.0a.txt) and are not relicensed under CC BY 4.0;
- reviewed Enraged Eggplant-originated contributions and project adaptations are released under CC BY 4.0 in reliance on the recorded unrestricted authorization, with mandatory originator credit;
- images, GURPS/GCS-facing artifacts, and other third-party material require their own recorded release terms.

See [LICENSE.md](LICENSE.md) for the controlling scope map. In package data, `sourceLicense` records the upstream provenance or permission basis, while `contentLicense` records the terms under which the reviewed record is released downstream. An approved record must have both.

## Consumer Contract

Treat `converted/doa-monsters.json` as the public API. Converter internals can change, but released package records must preserve stable IDs, upstream `sourceLicense`, downstream `contentLicense`, copyright and attribution data, conversion version, and manual review status.

```bash
npm test
```
