# Monster review and approval workflow

Reviewing 304 converted records means recording 304 decisions without hand-editing a two-megabyte generated
JSON file, and without any way for the decisions and the package to drift apart. This directory is the
tracked source of truth for that; everything under `converted/enraged-eggplant/` is generated from it.

```
base conversion output  +  review/repairs/  +  review/decisions.jsonl
        (untracked)              (tracked)          (tracked, append-only)
                                     |
                            npm run review:apply
                                     |
        converted/enraged-eggplant/doa-monsters.reviewed.json   (generated)
        converted/enraged-eggplant/CHECKLIST.md                 (generated)
                                     |
                   npm run promote:enraged-eggplant -- --version X.Y.Z
                                     |
                       converted/doa-monsters.json              (public package)
```

## Why the base file is untracked and the lock is not

The conversion queue stays local until records are reviewed (see `.gitignore`). That is deliberate, but it
means the repository cannot see the records a decision was made about. `review/base-lock.json` closes the
gap: it stores the sha256 of every base record, and every ledger entry stores the same hash for the record it
decided. If someone re-runs the conversion and a record changes, `npm run review:verify` names the decisions
that are no longer valid instead of silently approving different data.

## Commands

| Command | What it does |
| --- | --- |
| `npm run review:lock` | Record per-record hashes of the base conversion output. Run after a fresh conversion. |
| `npm run review:queue -- --batch <name>` | Print the review dossier for a batch: source values, rebuilt GCS totals, DOA stats, attacks, CER, encounter metadata, provenance, and the three art assets together. `--format markdown\|json`, `--out <file>`, `--record <id>`, `--include-decided`, `--limit N`. |
| `npm run review:decide -- ...` | Append decisions to the ledger. Never edits the package. |
| `npm run review:apply` | Regenerate the reviewed package and `CHECKLIST.md`. `--check` fails instead of writing. |
| `npm run review:verify` | Integrity gate: ledger validity, hash drift, approval gates, regenerability, promotion refusal. |
| `npm run review:audit-cer` | Regenerate `review/reports/cer-audit.md`. |
| `npm run review:audit-traits` | Regenerate `review/reports/trait-source-audit.md`: what the source's racial template states that the published record does not. Runs as part of `npm test` in `--check` form; reports "skipped" where the ignored source corpus is absent. |
| `npm run promote:enraged-eggplant -- --version X.Y.Z` | Build the public package. Refuses if any included record is not `approved`. |

## Batches

Review proceeds in intentionally sized passes rather than one 304-record slog. Every record is flagged by
what would make a reviewer stop on it:

| Batch | Meaning |
| --- | --- |
| `missing-attacks` | No attack or hazard entry at all. |
| `reconciliation` | The GCS draft carries a source-total reconciliation child. |
| `cost-discrepancy` | An exact-identity trait costs differently in the native GCS library. |
| `special-mechanics` | Carries a mechanic the CER path cannot price. |
| `cer-outlier` | CER at the floor of 1, or 100 and above. |
| `cer-drift` | The conversion baseline's published ratings disagree with the consumer CER path. |
| `partial-stats` | The Typical Stats parse recovered fewer than twelve fields. |
| `ordinary` | No exception flag. |

```bash
npm run review:queue -- --batch cost-discrepancy --format markdown --out queue.md
```

## Recording a decision

```bash
npm run review:decide -- --batch ordinary --decision approved \
  --reviewer "Your Name" --on 2026-07-26 --batch-name ee-2026-07-26-ordinary \
  --gcs-fidelity pass --doa-playability pass \
  --note "Why this batch passes."
```

The ledger is append-only. Changing a decision means appending a new line for the same record; the last line
wins and the history stays. Re-running the same command is a no-op rather than a duplicate entry.

### The review gates

`--gcs-fidelity` and `--doa-playability` are the two gates issue #9 requires before a record may be approved;
an `approved` decision that does not assert both is rejected by the ledger validator.

- **gcsFidelity** — the rebuilt ancestry reconciles: every exact-identity cost discrepancy is adjudicated
  against the published cost tables and every source-total difference is explained. This is an arithmetic and
  library check.
- **doaPlayability** — the record is runnable at the table: resolvable mechanics, ratings recomputed through
  the consumer CER path, encounter metadata consistent with those ratings.
- **gcsVisualPass** (`--gcs-visual pass`, optional) — someone opened the `.gct` in the GCS desktop
  application and confirmed the displayed ancestry total. No script does this, so it is tracked separately
  rather than being folded into `gcsFidelity`. It is **not** required for approval, and it is `false` for the
  0.2.0 review pass.

## What the pipeline guarantees

- **Approval cannot discard provenance.** `assertNoLoss` fails the build if approval drops a provenance key,
  a conversion note, a stat note, or an originator credit.
- **The checklist and the package cannot drift.** Both are regenerated from the same inputs;
  `npm run review:verify` rebuilds them and fails on any difference.
- **Ratings are never stale.** Effectiveness is recomputed from the reviewed stats on every build, so a
  mechanics repair cannot leave an old CER behind. A repair may pin ratings explicitly; the build then records
  both the pinned value and what the stats-only path would have produced.
- **Hazards rate.** An attack entry may carry `autoHit`, `afflictionPoints`, `bindingSt`, and
  `usesFatigueOrSpell`. These let the rating see an ability that is not resolved by an attack roll — an
  always-on aura, an engulf, a petrifying gaze — instead of scoring it at zero because it deals no damage.
  The application reads the same fields, and its smoke re-derives every published rating from stats and fails
  if the two implementations disagree.
- **Promotion still refuses unapproved records**, and `npm test` covers that gate on a clean checkout using
  fixtures rather than the untracked queue.

## Repairs

A repair is a tracked statement of "this field changes, for this reason". Files apply in filename order.

```json
{
  "version": 1,
  "issue": 5,
  "title": "…",
  "repairs": [
    {
      "recordId": "enraged_eggplant_shrieker",
      "monster": "Shrieker",
      "rationale": "Required. Why the record changes.",
      "set": { "stats.attacks": [] },
      "appendStatNotes": ["GM-facing note"],
      "appendConversionNotes": ["Provenance note"]
    }
  ]
}
```

| File | Issue | Contents |
| --- | ---: | --- |
| `001-missing-attack-mechanics.json` | #5 | Hand-authored mechanics for the nine records with no parsed attacks. |
| `002-special-ability-mechanics.json` | #5, #6 | Generated by `scripts/review-extract-special-abilities.mjs`: abilities the conversion's attack parser dropped, plus rating inputs for abilities it kept but could not score. |
| `003-gcs-adjudications.json` | #4 | Generated by `scripts/review-gcs-adjudicate.mjs`: cost and ancestry-total adjudications. |

Generated repair files are regenerable byte-for-byte; edit the generator, not the output.

## Reports

- [`reports/cer-audit.md`](reports/cer-audit.md) — what the rating can and cannot see, per record (#6).
- [`reports/gcs-adjudication.md`](reports/gcs-adjudication.md) — every cost and ancestry-total decision (#4).
- [`reports/app-site-export-review.md`](reports/app-site-export-review.md) — app, site and export review (#8).
- `reports/animal-benchmark-comparison.md` — the authored land animals against an outside mass-driven GURPS
  animal reference (#37). **Local only, and so is its input `benchmarks/panoptesv-animalia.json`**: that
  data is someone else's, gathered under someone else's terms, and does not belong in a public repository.
  Regenerate with `npm run review:benchmark-animals` where the benchmark exists; the check skips cleanly
  where it does not. No value from it may be copied into a record — see
  [`policy/srd-independent-build-policy.md`](policy/srd-independent-build-policy.md).
- [`policy/0.2.0-empty-field-policy.md`](policy/0.2.0-empty-field-policy.md) — lair, treasure, grappling (#7).
- [`policy/srd-independent-build-policy.md`](policy/srd-independent-build-policy.md) — how SRD-coverage records
  are built, credited and licensed, and why none of them approves itself (#37).
