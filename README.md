# Dungeons on Automatic Monsters

Canonical public monster data packages for [Dungeons on Automatic](https://github.com/Zuljita/DungeonsOnAutomatic).

GCS v5 compatibility is a first-class output target: approved concrete monsters are intended to produce both reusable `.gct` templates and ready-to-use `.gcs` sheets that remain useful outside Dungeons on Automatic.

This repository owns the publishable monster-data contract, conversion tools, validation scripts, generated JSON packages, and license/provenance documentation. Raw source material and parsed working corpora stay under the ignored `data/` directory. The app consumes released package JSON from this repository or a mirrored public-site URL; the public site documents and links to the packages rather than becoming the canonical data store.

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

## Roadmap

The cross-repository plan for the open SRD monster corpus, CER, controlled tags, generated portraits and top-down tokens, public-site browsing, and generator integration is tracked in [ROADMAP.md](ROADMAP.md). The issue-ready epic backlog is in [docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md](docs/roadmap/OPEN-MONSTER-LIBRARY-BACKLOG.md).

## SRD Source Ingestion

The SRD source fetch and parse pipeline keeps raw source caches and parsed intermediate monster records under ignored `data/`, separate from both the tracked source manifests and the reviewed public package:

```bash
npm run fetch:srds
npm run parse:srds
```

Outputs:

- `data/srd-5-1/raw/SRD_CC_v5.1.pdf` - ignored local cache of the SRD 5.1 Creative Commons PDF.
- `data/srd-5-1/parsed/monsters.json` - ignored extracted SRD 5.1 monster stat blocks.
- `data/srd-3-5/raw/` - ignored local cache of the d20srd.org monster index and monster pages.
- `data/srd-3-5/parsed/monsters.json` - ignored extracted 3.5-era SRD monster pages/stat blocks.

The corresponding `sources/*/manifest.json` files remain tracked because they describe provenance and licensing without mirroring either SRD. The ignored parsed files are source intermediates, not reviewed DOA public package records. `converted/doa-monsters.json` remains the public package API and should only receive records after license/provenance review and conversion into the DOA monster schema.

Enraged Eggplant's fan-authored GURPS monster statistics have separate author-permission provenance. Generated records may be public, but stay `review_required` until their GCS mechanics, Typical Stats parsing, attacks, and CER are checked.

## Enraged Eggplant GCS Rebuild

The authorized conversion pass uses the ignored source extraction plus every `.adq`, `.adm`, and `.skl` file under the local GCS master library. Basic Set, Powers, and Power-Ups records receive tie-break priority over setting-specific duplicate traits, while racial skills use exact native skill matches by name, controlling attribute, and difficulty:

```bash
npm run convert:enraged-eggplant
npm run validate:gct-enraged-eggplant
npm run validate:enraged-eggplant
```

It writes all 304 SRD-overlap GCS v5 ancestry drafts under `converted/enraged-eggplant/gcs/`, including corrected rebuilds for identities already present in the imported EE library, plus a DOA review package, a per-monster checklist, and `LIBRARY-AUDIT.md`. The batch script also accepts `--selection missing` or `--selection covered` for focused audits. Only exact trait/level/self-control/modifier matches become native library records; flat mode modifiers and safely parameterized modifiers are supported. Library cost disagreements are reported separately from unresolved source-total reconciliation, and no generated record is approved automatically.

## Consumer Contract

Treat `converted/doa-monsters.json` as the public API. Converter internals can change, but released package records must preserve stable IDs, upstream `sourceLicense`, downstream `contentLicense`, copyright and attribution data, conversion version, and manual review status.

```bash
npm test
```
