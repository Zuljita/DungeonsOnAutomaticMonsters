// SPDX-License-Identifier: MIT
//
// Compare the authored land-animal records against an outside GURPS animal
// reference, and report the differences.
//
//   node scripts/review-animal-benchmark.mjs
//   node scripts/review-animal-benchmark.mjs --check
//
// This is the comparison phase ROADMAP.md rule 6 allows, run after the fact and
// logged. It is deliberately one-directional: it reads the reference and reports
// deltas, and nothing in the build pipeline reads it back. Adopting a reference
// value would change a record's provenance story, so that stays a human decision
// with its own permission and credit, not something a script can do quietly.
//
// The reference derives its templates from clade and body mass, which makes it a
// good check on scale — is a 200 kg cat really stronger than a 500 kg horse? —
// and a poor check on anything fantastical. Rows say which they are.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PACKAGE_PATH = "converted/srd-monsters/doa-monsters.review-required.json";
const BENCHMARK_PATH = "review/benchmarks/panoptesv-animalia.json";
const REPORT_PATH = "review/reports/animal-benchmark-comparison.md";

const check = process.argv.includes("--check");

// The reference data is someone else's, gathered under someone else's terms, so
// it stays local (see .gitignore) and so does the report that quotes it. This
// script is tracked because the method is ours and worth keeping; on a checkout
// without the benchmark there is simply nothing to compare, which is not a
// failure. Same posture as the trait audit against the untracked EE corpus.
if (!existsSync(BENCHMARK_PATH)) {
  console.log(`Animal benchmark skipped: ${BENCHMARK_PATH} is not present on this checkout.`);
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
const benchmark = JSON.parse(readFileSync(BENCHMARK_PATH, "utf8"));
const records = new Map(pkg.monsters.map(record => [record.id, record]));

/** Attributes compared head to head, and how far apart is worth naming. */
const COMPARED = [
  { key: "st", label: "ST", tolerance: 2 },
  { key: "dx", label: "DX", tolerance: 1 },
  { key: "iq", label: "IQ", tolerance: 1 },
  { key: "ht", label: "HT", tolerance: 1 },
  { key: "will", label: "Will", tolerance: 2 },
  { key: "per", label: "Per", tolerance: 2 },
  { key: "sm", label: "SM", tolerance: 0 },
  { key: "dr", label: "DR", tolerance: 0 },
];

function ours(record, key) {
  if (key === "sm") return record.size.heightSizeModifier;
  return record.stats.attributes[key];
}

const rows = [];
const missing = [];
for (const entry of benchmark.entries) {
  const record = records.get(entry.recordId);
  if (!record) {
    missing.push(entry.recordId);
    continue;
  }
  const deltas = {};
  const flags = [];
  for (const { key, label, tolerance } of COMPARED) {
    const mine = ours(record, key);
    const theirs = entry[key];
    const delta = mine - theirs;
    deltas[key] = { mine, theirs, delta };
    if (entry.comparability === "direct" && Math.abs(delta) > tolerance) {
      flags.push(`${label} ${delta > 0 ? "+" : ""}${delta}`);
    }
  }
  // Move is the one field where the two models mean different things, so it is
  // compared against both of theirs rather than flagged on a single delta.
  const myMove = record.stats.attributes.move;
  const moveNote = entry.sprint === null
    ? `${myMove} vs ${entry.move}`
    : `${myMove} vs ${entry.move} cruise / ${entry.sprint} sprint`;
  rows.push({ entry, record, deltas, flags, moveNote, myMove });
}

/** Cross-record patterns are the finding; a single row rarely is. */
function systematic(key) {
  const direct = rows.filter(row => row.entry.comparability === "direct");
  const deltas = direct.map(row => row.deltas[key].delta);
  const mean = deltas.reduce((total, value) => total + value, 0) / deltas.length;
  const low = deltas.filter(value => value < 0).length;
  const high = deltas.filter(value => value > 0).length;
  const rounded = Math.round(mean * 10) / 10;
  return `mean ${rounded > 0 ? "+" : ""}${rounded} across ${deltas.length} directly comparable rows — `
    + `lower in ${low}, higher in ${high}, equal in ${deltas.length - low - high}`;
}

const movesAtSprint = rows.filter(row => row.entry.sprint !== null && row.myMove > row.entry.move);

function table() {
  const header = [
    "| Record | Reference (mass) | ST | DX | IQ | HT | Will | Per | SM | DR | Move | Flags |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const body = rows.map(row => {
    const cells = COMPARED.map(({ key }) => {
      const { mine, theirs, delta } = row.deltas[key];
      return delta === 0 ? `${mine}` : `${mine} / ${theirs}`;
    });
    const mass = row.entry.massKg >= 1 ? `${row.entry.massKg} kg` : `${row.entry.massKg * 1000} g`;
    const marker = row.entry.comparability === "direct" ? "" : ` _(${row.entry.comparability})_`;
    return `| ${row.record.name} | ${row.entry.reference} (${mass})${marker} | ${cells.join(" | ")} | `
      + `${row.moveNote} | ${row.flags.join(", ") || "—"} |`;
  });
  return [...header, ...body].join("\n");
}

const report = `<!-- Generated by scripts/review-animal-benchmark.mjs. Do not edit. -->

# Land animals against an outside GURPS animal reference

A comparison pass over ${rows.length} of the ${pkg.monsters.length} records in \`${PACKAGE_PATH}\` — the
ones with a counterpart in the reference — run against
[${benchmark.reference.name}](${benchmark.reference.url}) (${benchmark.reference.site}), retrieved
${benchmark.reference.retrieved}.

## What this is, and what it is not

${benchmark.reference.howItWorks}

${benchmark.reference.usagePolicy}

The reference's stated terms: ${benchmark.reference.statedTerms}

Cells read \`ours / theirs\` where the two differ and a single number where they agree. Rows marked
_scale-analogue_ compare a fantasy creature against the mundane animal behind it, so magnitudes are not
expected to match and are not flagged; _none_ means there is no usable counterpart at all.

## Per-record comparison

${table()}

${benchmark.unmatched.map(entry => `Not compared: **${records.get(entry.recordId)?.name ?? entry.recordId}** — ${entry.reason}`).join("\n\n")}

## Findings

### 1. \`move\` conflates cruising speed with sprint speed

The reference prints a cruising Move and a separate top speed. This package has one \`move\` field, and the
build writes the Enhanced Move total into it, so ${movesAtSprint.length} of ${rows.length} compared records
publish a sprint figure where a consumer reads tactical movement.

${movesAtSprint.map(row => `- ${row.record.name}: ${row.moveNote}`).join("\n")}

This is not cosmetic. The rating path scores \`move - 6\` straight into offense, so every one of these
records is rated as if it fought at its chase speed. The cheetah is the extreme case — 18 of its 28 offense
points come from Move alone, which is why it rates beside a lion — but the whole set leans the same way.

The fix is a contract question rather than a data one: either \`move\` means cruising Move and sprint lives
in a new field the rating path discounts, or \`move\` keeps its current meaning and the rating path stops
treating it as offense. Both are outside this batch. Recorded here so the decision is made deliberately.

### 2. Perception and Will run low across the board

Per: ${systematic("per")}. Will: ${systematic("will")}.

The reference gives essentially every mammal Per 12 and Will 10 — an animal's senses are its defining
advantage over a human, and its nerve is what decides whether an encounter happens at all. This package's
animals are consistently duller. For a batch whose whole point is wandering encounters, that is the wrong
direction to be wrong in: a wolf that fails to notice the party is not an encounter.

### 3. Damage Resistance runs low on the heavy-bodied records

DR: ${systematic("dr")}.

The reference scales Tough Skin with mass: nothing under about 20 kg, 1 through the mid range, 2 for bears
and large ungulates, 3–4 at bear and elephant scale. This package gives several mid-sized animals DR 0 where
hide alone earns 1.

### 4. HT runs high on the cats, deer and horses

HT: ${systematic("ht")}.

The reference reserves HT 12–13 for genuinely tough clades — bears, mustelids, pigs — and leaves cats,
cervids and equines at 10. This package gives HT 12 broadly, which inflates both FP and the protection
rating.

### 5. ST and SM largely agree, with named exceptions

ST: ${systematic("st")}. SM: ${systematic("sm")}.

The scale spine of the batch is sound — lion, tiger, saddle horse, mule, pony, goat and donkey land within a
point or two of a mass-derived model. The exceptions are worth a decision each, and they are visible in the
Flags column above.

## What was changed

Nothing. This pass reports; it does not edit. No record, template or sheet was altered, and no reference
value was copied into the package.
`;

if (check) {
  const current = existsSync(REPORT_PATH) ? readFileSync(REPORT_PATH, "utf8") : null;
  if (current !== report) {
    console.error(`${REPORT_PATH} is stale; run node scripts/review-animal-benchmark.mjs`);
    process.exit(1);
  }
  console.log(`${REPORT_PATH} is current (${rows.length} compared).`);
} else {
  writeFileSync(REPORT_PATH, report, "utf8");
  console.log(`Wrote ${REPORT_PATH}: ${rows.length} compared, ${missing.length} benchmark row(s) with no record.`);
}

if (missing.length > 0) {
  console.error(`Benchmark rows with no matching record: ${missing.join(", ")}`);
  process.exit(1);
}
