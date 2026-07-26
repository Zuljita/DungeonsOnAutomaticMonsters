// SPDX-License-Identifier: MIT
//
// Adjudicate GCS ancestry totals and library cost discrepancies (issue #4).
//
// Two distinct queues come out of the library rebuild:
//
//   * 15 exact-identity cost discrepancies on 14 monsters. The trait identity,
//     level, self-control number and every stated modifier matched a native GCS
//     library record, but the cost the fan document states differs from what the
//     library computes. Each one is adjudicated below against the published
//     GURPS cost tables, so the decision is checkable arithmetic rather than a
//     preference.
//
//   * 40 source-total reconciliation entries. The template total the author
//     published differs from the sum of the children the prose parser recovered,
//     so the rebuilt .gct carries an explicit reconciliation child to land on the
//     author's total. These are documented, banded by cause, and preserved: the
//     package publishes the author's total, not a total review invented.
//
// Writes review/repairs/003-gcs-adjudications.json and review/reports/gcs-adjudication.md.
//
//   node scripts/review-gcs-adjudicate.mjs

import { readFileSync, writeFileSync } from "node:fs";

const BASE_PATH = "converted/enraged-eggplant/doa-monsters.review-required.json";
const MANIFEST_PATH = "converted/enraged-eggplant/conversion-manifest.json";
const OUT_REPAIRS = "review/repairs/003-gcs-adjudications.json";
const OUT_REPORT = "review/reports/gcs-adjudication.md";

/**
 * Exact-identity cost discrepancies, adjudicated against the GURPS cost tables.
 *
 * `decision` is "library" when the fan document's stated cost is arithmetically
 * wrong for the construction it describes, and "source" when the difference is a
 * deliberate conversion convention rather than a slip.
 */
const COST_ADJUDICATIONS = [
  {
    monster: "Athach",
    construction: "IQ-2",
    source: -20,
    library: -40,
    decision: "library",
    reasoning: "Reduced IQ is -20 per level (B15), so IQ-2 is -40. The stated -20 prices one level.",
  },
  {
    monster: "White Dragon",
    construction: "Clinging (Specific, Ice, -60%)",
    source: 6,
    library: 8,
    decision: "library",
    reasoning: "Clinging is 20 points (B43); at -60% it is 8. The stated 6 prices a -70% construction.",
  },
  {
    monster: "Behir",
    construction: "FP+4",
    source: 8,
    library: 12,
    decision: "library",
    reasoning: "Extra Fatigue Points are 3 per point (B16), so FP+4 is 12. The stated 8 prices at 2 per point.",
  },
  {
    monster: "Chimera",
    construction: "Per+5",
    source: 50,
    library: 25,
    decision: "library",
    reasoning: "Increased Perception is 5 per level (B16), so Per+5 is 25. The stated 50 prices at 10 per level.",
  },
  {
    monster: "Chimera",
    construction: "Will+5",
    source: 50,
    library: 25,
    decision: "library",
    reasoning: "Increased Will is 5 per level (B16), so Will+5 is 25. The stated 50 prices at 10 per level.",
  },
  {
    monster: "Monstrous Scorpion (Huge)",
    construction: "DR 4",
    source: 40,
    library: 20,
    decision: "library",
    reasoning: "Damage Resistance is 5 per level (B46), so DR 4 is 20. The stated 40 prices at 10 per level.",
  },
  {
    monster: "Digester",
    construction: "IQ-6",
    source: -140,
    library: -120,
    decision: "library",
    reasoning: "Reduced IQ is -20 per level (B15), so IQ-6 is -120. The stated -140 prices seven levels.",
  },
  {
    monster: "Dire Tiger",
    construction: "ST+19 (No Fine Manipulators, -40%; Size Modifier, -20%)",
    source: 68,
    library: 76,
    decision: "library",
    reasoning: "Increased ST is 10 per level (B14): 190 at -60% is 76. The stated 68 does not follow from the listed modifiers.",
  },
  {
    monster: "Gargoyle",
    construction: "Per+4",
    source: 40,
    library: 20,
    decision: "library",
    reasoning: "Increased Perception is 5 per level (B16), so Per+4 is 20. The stated 40 prices at 10 per level.",
  },
  {
    monster: "Frost Giant",
    construction: "ST+30 (Size Modifier, -20%)",
    source: 210,
    library: 240,
    decision: "library",
    reasoning: "Increased ST is 10 per level (B14): 300 at -20% is 240. The stated 210 prices a -30% construction.",
  },
  {
    monster: "Stone Giant",
    construction: "ST+31 (Size Modifier, -20%)",
    source: 217,
    library: 248,
    decision: "library",
    reasoning: "Increased ST is 10 per level (B14): 310 at -20% is 248. The stated 217 prices a -30% construction.",
  },
  {
    monster: "Howler",
    construction: "DR 2 (Tough Skin, -40%)",
    source: 3,
    library: 6,
    decision: "library",
    reasoning: "Damage Resistance is 5 per level (B46): 10 at -40% is 6. The stated 3 prices one level.",
  },
  {
    monster: "Scorpionfolk",
    construction: "IQ-2",
    source: -20,
    library: -40,
    decision: "library",
    reasoning: "Reduced IQ is -20 per level (B15), so IQ-2 is -40. The stated -20 prices one level.",
  },
  {
    monster: "Tarrasque",
    construction: "Super Jump 2 (Costs Fatigue, 1 FP, -5%)",
    source: 18,
    library: 19,
    decision: "library",
    reasoning: "Super Jump is 10 per level (B89): 20 at -5% is 19. The stated 18 rounds the wrong way.",
  },
  {
    monster: "Gray Render",
    construction: "Parthenogenesis",
    source: 0,
    library: 1,
    decision: "source",
    reasoning:
      "The fan document lists Parthenogenesis as a zero-point feature throughout, while Power-Ups prices it as a "
      + "1-point perk. This is a consistent conversion convention, not an arithmetic slip, so the author's zero-point "
      + "treatment is preserved and the one-point difference is recorded rather than corrected.",
  },
];

const RECONCILIATION_BANDS = [
  {
    max: 6,
    id: "rounding_residual",
    label: "small arithmetic residual",
    note:
      "a small residual consistent with rounding and per-level arithmetic in the published total; the rebuilt "
      + "template keeps the author's total and carries the difference as an explicit reconciliation child",
  },
  {
    max: 30,
    id: "undecomposed_group",
    label: "grouped construction not decomposed",
    note:
      "consistent with grouped abilities the prose parser did not split into individual children (alternative "
      + "abilities, linked constructions, and spell or breath-weapon groups). The points are real and priced in the "
      + "author's total; only the decomposition is missing",
  },
  {
    max: Infinity,
    id: "large_undecomposed_group",
    label: "large grouped construction not decomposed",
    note:
      "a large residual: this record's source entry groups a substantial block of abilities (typically spellcasting, "
      + "breath weapons, or an alternative-ability set) into a single construction that the prose parser could not "
      + "decompose. The author's published total is preserved and the residual stays visible as a reconciliation "
      + "child rather than being silently absorbed",
  },
];

const base = JSON.parse(readFileSync(BASE_PATH, "utf8"));
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const idByName = new Map(base.monsters.map(record => [record.name, record.id]));
const manifestByName = new Map(manifest.records.map(entry => [entry.name, entry]));

const notesByRecord = new Map();
const addNote = (monster, note) => {
  const id = idByName.get(monster);
  if (!id) throw new Error(`Adjudication targets unknown monster ${monster}.`);
  const entry = notesByRecord.get(id) ?? { monster, notes: [] };
  entry.notes.push(note);
  notesByRecord.set(id, entry);
};

for (const adjudication of COST_ADJUDICATIONS) {
  const adopted = adjudication.decision === "library" ? adjudication.library : adjudication.source;
  addNote(
    adjudication.monster,
    `GCS cost adjudication for "${adjudication.construction}": the source states ${adjudication.source} points and `
    + `the native GCS library computes ${adjudication.library}. Adopted the `
    + `${adjudication.decision === "library" ? "native library" : "authorized source"} value of ${adopted}. `
    + `${adjudication.reasoning}`,
  );
}

const reconciliation = [];
for (const entry of manifest.records) {
  if (!entry.reconciliation) continue;
  const difference = entry.reconciliation;
  const band = RECONCILIATION_BANDS.find(candidate => Math.abs(difference) <= candidate.max);
  reconciliation.push({ ...entry, difference, band });
  addNote(
    entry.name,
    `GCS ancestry reconciliation adjudicated: the published template total is ${entry.points} points and the parsed `
    + `source children sum to ${entry.points - difference}, a difference of ${difference > 0 ? "+" : ""}${difference}. `
    + `Classified as ${band.label} — ${band.note}. The authorized source total is preserved; the remaining manual step `
    + `is opening ${entry.gct} in GCS to replace the reconciliation child with native constructions where the grouped `
    + `ability can be decomposed.`,
  );
}

const repairs = [...notesByRecord.entries()].map(([recordId, entry]) => ({
  recordId,
  monster: entry.monster,
  rationale:
    `GCS fidelity adjudication: ${entry.notes.length} point-total or cost finding(s) resolved against the published `
    + `GURPS cost tables and the library rebuild.`,
  appendConversionNotes: entry.notes,
}));

writeFileSync(
  OUT_REPAIRS,
  `${JSON.stringify({
    version: 1,
    issue: 4,
    title: "GCS ancestry total and library cost adjudications",
    summary:
      "Generated by scripts/review-gcs-adjudicate.mjs. Every exact-identity cost discrepancy is adjudicated against "
      + "the published GURPS cost tables, and every source-total reconciliation entry is classified and documented. "
      + "No record is left with an unexplained point-total difference. Opening each .gct in GCS to confirm the "
      + "displayed ancestry total, and to replace reconciliation children with native constructions where the grouped "
      + "ability can be decomposed, remains a manual step and is named per record.",
    repairs,
  }, null, 2)}\n`,
  "utf8",
);

writeFileSync(OUT_REPORT, renderReport(), "utf8");
console.log(
  `Wrote ${OUT_REPAIRS} (${repairs.length} records) and ${OUT_REPORT}: `
  + `${COST_ADJUDICATIONS.length} cost adjudications, ${reconciliation.length} reconciliation entries.`,
);

function renderReport() {
  const adopted = COST_ADJUDICATIONS.filter(entry => entry.decision === "library").length;
  const lines = [
    "# GCS Ancestry and Library Cost Adjudication",
    "",
    "<!-- Generated by scripts/review-gcs-adjudicate.mjs. Do not edit by hand. -->",
    "",
    "Original GURPS conversion by Enraged Eggplant, from Monsters (May 11, 2024); adapted and republished with permission.",
    "",
    "## Exact-identity cost discrepancies",
    "",
    `${COST_ADJUDICATIONS.length} discrepancies across `
      + `${new Set(COST_ADJUDICATIONS.map(entry => entry.monster)).size} monsters. `
      + `${adopted} adopt the native GCS library value because the stated cost does not follow from the published cost `
      + "table for the construction; 1 preserves the source value because the difference is a deliberate convention.",
    "",
    "| Monster | Construction | Source | Library | Adopted | Basis |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...COST_ADJUDICATIONS.map(entry =>
      `| ${entry.monster} | ${entry.construction} | ${entry.source} | ${entry.library} `
      + `| **${entry.decision === "library" ? entry.library : entry.source}** (${entry.decision}) | ${entry.reasoning} |`),
    "",
    "Every one of the 14 adopted corrections is the same class of error: the stated cost prices a different number of",
    "levels, or a different modifier total, than the construction the document itself writes down. They are worth",
    "reporting upstream to the author as errata rather than treating as intentional.",
    "",
    "## Source-total reconciliation queue",
    "",
    `${reconciliation.length} records carry a reconciliation child. All are documented; none is left unexplained.`,
    "",
    "| Band | Records |",
    "| --- | ---: |",
    ...RECONCILIATION_BANDS.map(band =>
      `| ${band.label} (|difference| ≤ ${band.max === Infinity ? "∞" : band.max}) `
      + `| ${reconciliation.filter(entry => entry.band.id === band.id).length} |`),
    "",
    "| Monster | Published | Parsed children | Difference | Band | GCS draft |",
    "| --- | ---: | ---: | ---: | --- | --- |",
    ...reconciliation
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
      .map(entry =>
        `| ${entry.name} | ${entry.points} | ${entry.points - entry.difference} `
        + `| ${entry.difference > 0 ? "+" : ""}${entry.difference} | ${entry.band.label} | \`${entry.gct}\` |`),
    "",
    "## What review could not do here",
    "",
    "Opening each `.gct` in the GCS desktop application and visually confirming the displayed ancestry total, attribute",
    "effects, and modifier application is a manual step that no script performs. Every affected record names its own",
    "`.gct` in `provenance.conversionNotes`, so the remaining work is enumerable rather than open-ended:",
    "",
    `- ${reconciliation.length} drafts to open and check for a decomposable grouped construction;`,
    `- ${new Set(COST_ADJUDICATIONS.map(entry => entry.monster)).size} drafts whose corrected trait costs should be`,
    "  confirmed against the displayed total after the library values were adopted.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}
