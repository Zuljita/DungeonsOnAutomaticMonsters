# Cost-math errata for Enraged Eggplant's *Monsters* (May 11, 2024)

Status: **drafted, not yet sent** (issue #18). This is the upstream report, written to
be sent to Enraged Eggplant verbatim. Record the send date and any response at the
bottom; if the author disagrees on any entry, re-open the corresponding adjudication in
[`../../review/reports/gcs-adjudication.md`](../../review/reports/gcs-adjudication.md)
rather than leaving the package silently at odds with the source.

---

Hi — we're the Dungeons on Automatic project, adapting your *Monsters* conversions
under the permission you granted (thank you again — the whole library exists because of
it). While rebuilding every template against the native GCS libraries for our review
pass, we found fourteen entries where the stated point cost doesn't match the
construction the entry itself writes down. We thought you'd want the list back, since
these are easy slips to fix at source and two of them repeat across entries.

In each case the trait identity, level, and every stated modifier match the library
construction exactly — only the arithmetic differs:

| Monster | Construction | Stated | Computed | Basis |
| --- | --- | ---: | ---: | --- |
| Athach | IQ-2 | -20 | -40 | Reduced IQ is -20/level (B15) |
| Scorpionfolk | IQ-2 | -20 | -40 | as above |
| Digester | IQ-6 | -140 | -120 | as above; -140 prices seven levels |
| Chimera | Per+5 | 50 | 25 | Increased Perception is 5/level (B16) |
| Chimera | Will+5 | 50 | 25 | Increased Will is 5/level (B16) |
| Gargoyle | Per+4 | 40 | 20 | as above |
| Behir | FP+4 | 8 | 12 | Extra FP are 3/point (B16) |
| Monstrous Scorpion (Huge) | DR 4 | 40 | 20 | DR is 5/level (B46) |
| Howler | DR 2 (Tough Skin, -40%) | 3 | 6 | 10 at -40% is 6 |
| White Dragon | Clinging (Specific, Ice, -60%) | 6 | 8 | 20 at -60% is 8 |
| Dire Tiger | ST+19 (No Fine Manipulators, -40%; Size Modifier, -20%) | 68 | 76 | 190 at -60% is 76 |
| Frost Giant | ST+30 (Size Modifier, -20%) | 210 | 240 | 300 at -20% is 240 |
| Stone Giant | ST+31 (Size Modifier, -20%) | 217 | 248 | 310 at -20% is 248 |
| Tarrasque | Super Jump 2 (Costs Fatigue, 1 FP, -5%) | 18 | 19 | 20 at -5% is 19; rounds the wrong way |

Two recurring patterns account for most of these: reduced/increased secondary
characteristics priced at 10/level instead of their B15–B16 values (Athach,
Scorpionfolk, Digester, Chimera ×2, Gargoyle), and limitation percentages applied to a
partial base (the ST and DR entries).

One deliberate difference we did **not** treat as an error: Gray Render's
Parthenogenesis as a 0-point feature where Power-Ups 2 prices it as a 1-point perk. You
apply that treatment consistently, so we preserved it as your convention.

Our published records use the computed values above, with the adjudication recorded per
record. If you disagree with any entry we'd genuinely like to know — we'll revisit our
adjudication rather than assume we're right.

---

## Outcome log

| Date | Event |
| --- | --- |
| 2026-07-28 | Report drafted; not yet sent. |
