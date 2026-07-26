# App, Site and Export Review

Issue [#8](https://github.com/Zuljita/DungeonsOnAutomaticMonsters/issues/8). Run against the 0.2.0 build of
`converted/doa-monsters.json` (304 approved records).

## How to reproduce

The checks live in the application repository, because that is where the consuming code is:

```bash
npm run promote:enraged-eggplant -- --version 0.2.0
```

```bash
cd ../DungeoonsOnAutomatic && npm run ee-package:smoke -- --package ../DungeonsOnAutomaticMonsters/converted/doa-monsters.json
```

`tests/enraged-eggplant-package-smoke.ts` is registered in the application's deterministic test tier and
skips cleanly when no built package is supplied, so it does not break CI on a machine without one.

## Representative family matrix

One representative per family, selected by the smoke from the package itself rather than hard-coded, so the
matrix cannot silently stop covering a family:

| Family | Representative | CER | Tier | Attacks | Appearing |
| --- | --- | ---: | --- | ---: | ---: |
| ordinary beast | Rat | 5 | minor | 2 | 6 |
| humanoid | Derro | 6 | minor | 2 | 6 |
| giant | Hill Giant | 43 | standard | 3 | 2 |
| dragon | White Dragon | 72 | major | 6 | 1 |
| swarm | Bat Swarm | 18 | minor | 1 | 1 |
| ooze | Black Pudding | 108 | severe | 2 | 1 |
| incorporeal undead | Allip | 1 | minor | 3 | 4 |
| spellcaster / psionics | Aboleth | 57 | standard | 4 | 1 |
| multi-hex creature | Aboleth | 57 | standard | 4 | 1 |
| CER outlier (low) | Allip | 1 | minor | 3 | 4 |
| CER outlier (high) | Purple Worm | 231 | severe | 2 | 1 |

## Results

| Check | Result |
| --- | --- |
| Package loads through the real module/source-filtering path | pass — all 304 records survive filtering |
| Disabling the package source book removes every package record | pass |
| `CER = OR + PR` for every record (the app's own validator rule) | pass — 304/304 |
| `resolveMonsterCer` returns the package's stored rating | pass — no record is silently recomputed by the consumer |
| Every stored rating is reproducible from stats by the app's own calculator | pass — 304/304, so the package and the app cannot drift on how a hazard is priced |
| Save-or-disable hazards contribute to their record's offense rating | pass — 82 records carry a priced disabling ability, none scoring zero |
| Lair, treasure and grappling are null and keep their full key set | pass — 304/304 |
| Fixed-seed encounter placement is deterministic | pass — seeds 7, 20260726 and 99 each place the same monster twice |
| Placed encounters carry approved status, public-stat provenance and full stats | pass |
| Foundry output prefers the published hex token | pass — `foundry-adapter.ts` reads `art.hexToken` before `art.token` |
| Every record exposes portrait, overhead token and hex token URLs | pass |
| GM Markdown names the monster and exposes CER | pass |
| Player Markdown suppresses CER and review provenance | pass |
| No record links to a private repository URL | pass, **after a fix** — see below |
| Every attack entry carries GM-facing resolution text | pass — 304/304 |

## Two defects this review found and fixed

**1. Private repository URLs survived promotion into the public package.**
`scripts/build-enraged-eggplant-package.mjs` rewrote `provenance.sourceUrl` and `provenance.url` to the public
permission record, but not the `url` on structured credits. Every one of the 304 records shipped a
`provenance.credits[].url` pointing at `github.com/Zuljita/DungeonsOnAutomaticMonsters`, a private repository —
a dead link for every public consumer and a pointer at a private source. The same applied to
`manifest.credits[]` and `manifest.sources[].credits[]`. Promotion now rewrites credit URLs everywhere they
appear, and the smoke asserts no private URL survives.

**2. The public site rendered three images but offered no downloads.**
`monsters.html` displayed the portrait, overhead token and hex token in the record dialog, but there was no way
to download any of them; the issue requires all three exposed as downloads from site-hosted URLs. The dialog
now carries a download row with the three assets, named `<monster-id>-portrait.png`, `-token.png` and
`-hex-token.png`.

## Application-side changes made for this review

| File | Change |
| --- | --- |
| `tests/enraged-eggplant-package-smoke.ts` | New. The whole review above, as a runnable smoke. |
| `scripts/run-test-tier.ts`, `package.json` | Register `ee-package:smoke` in the deterministic tier. |
| `src/modules/module-types.ts` | `MonsterProvenance` gained `credits`, `contentLicense` and `contentLicenseUrl`. The published contract requires structured originator credit on every author-permission record, and the consumer type did not model it, so consumers could not reproduce the credit line without an unchecked cast. `MonsterAttack` gained `autoHit`, `afflictionPoints`, `bindingSt` and `usesFatigueOrSpell`. |
| `src/modules/cer-calculator.ts` | `combatProfileFromMonsterStats` now reads those fields, so a monster whose danger is an aura or a save-or-disable ability rates for it when the app derives a rating from stats. `AfflictionProfile` gained `abilityPoints`, scored at 1 per 5 points like the model's other trait-point terms. The Lady Ion worked example is unchanged. |

## What still needs a person

- **Visual inspection of portraits and tokens.** The smoke asserts every asset exists, is square, is at least
  1024px, and that tokens carry real alpha. Whether the art *looks* right for the creature is not a check a
  script can make. `checks.gcsVisualPass` is `false` for every record in this pass.
- **The public site's `data/monsters/index.json` still reports `status: review_required`, `approvedCount: 0`,
  `latest: null`.** That file is regenerated by the site's mirror workflow when the publish workflow
  dispatches `monster_package_published`; it was not hand-edited here. Publishing 0.2.0 will refresh it.
- **Site rendering was reviewed as source, not in a browser.** The download row is a small, self-contained
  change to `monsters.html`, but nobody has loaded the page against a live 0.2.0 package.
