// SPDX-License-Identifier: MIT
//
// Audit the trait chain against the authorized source.
//
//   node scripts/review-trait-audit.mjs            # regenerate the report
//   node scripts/review-trait-audit.mjs --check    # fail if new divergence appears
//
// The source states each creature's traits twice: once in the racial template
// (**Advantages:** and its companion lines) and again as a **Traits:** summary
// inside the Typical Stats block. The JSON conversion reads the summary; the
// GCS conversion reads the template. Wherever the summary is incomplete the two
// artifacts describe different creatures, and nothing downstream can tell.
//
// That is how issues #26 and #29 happened: 33 records shipped a flying creature
// with no means of flight, and 88 records were missing traits their own .gct
// carried. This audit exists so the next incomplete summary is caught by a
// command rather than by someone reading prose and noticing an eagle cannot fly.
//
// The source corpus lives under the ignored data/ directory, so this runs
// locally and commits its report; it reports "skipped" where the corpus is
// absent rather than failing a clean checkout.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BESTIARY = "data/enraged-eggplant/bestiary.md";
const OVERLAP = "data/enraged-eggplant/srd-overlap.json";
const REVIEWED = "converted/enraged-eggplant/doa-monsters.reviewed.json";
const REPORT = "review/reports/trait-source-audit.md";

const check = process.argv.includes("--check");

if (!existsSync(BESTIARY) || !existsSync(OVERLAP)) {
  console.log(`Trait audit skipped: ${BESTIARY} is not present on this checkout.`);
  process.exit(0);
}

const reviewed = JSON.parse(readFileSync(REVIEWED, "utf8"));
const overlap = JSON.parse(readFileSync(OVERLAP, "utf8"));
const lines = readFileSync(BESTIARY, "utf8").split(/\r?\n/);

const sections = new Map();
let current = null;
for (const line of lines) {
  if (/^## /.test(line)) {
    current = { heading: line.slice(3).trim(), body: [] };
    sections.set(current.heading, current);
    continue;
  }
  if (current) current.body.push(line);
}
const headingFor = new Map(overlap.matches.map(entry => [entry.name, entry.heading]));

/** Split "A; B (x, -10%) [5]; C" on top-level semicolons only. */
function splitEntries(text) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === ";" && depth === 0) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out.map(s => s.trim()).filter(Boolean);
}

/** Trait identity: no cost, no parentheticals, no level. Parentheticals nest. */
function head(entry) {
  let s = entry.replace(/\[[^\]]*\]/g, "");
  let previous;
  do { previous = s; s = s.replace(/\([^()]*\)/g, ""); } while (s !== previous);
  return s
    .replace(/[.;,)(]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+\d+(\.\d+)?$/, "")
    .trim()
    .toLowerCase();
}

function labelled(body, label) {
  const line = body.find(l => new RegExp(`^\\*\\*${label}:`).test(l.trim()));
  return line ? splitEntries(line.replace(new RegExp(`^\\*\\*${label}:\\*\\*`), "")) : [];
}

function levenshtein(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length][b.length];
}

// Purchased as advantages, but correctly published as attacks rather than traits.
const NATURAL_WEAPON = /^(sharp teeth|sharp claws|blunt claws|fangs|sharp beak|weak bite|talons|striker|hooves|horns|stinger|proboscis|mandibles|pincers|spines|tail|claws|teeth|beak|bite|gore|slam|punch|kick)/;
// Published as attributes rather than as trait-list entries.
const ATTRIBUTE_LIKE = /^(dr|st|dx|iq|ht|hp|fp|will|per|basic|damage resistance|striking st|lifting st|extra attack)\b/;
// Read by scripts/review/cer.mjs; a gap in one of these misprices the record.
const CER_TRAITS = new Set(["high pain threshold", "recovery", "combat reflexes", "unfazeable"]);

const frequency = new Map();
for (const record of reviewed.monsters) {
  for (const trait of record.stats.traits) {
    const h = head(trait);
    if (h) frequency.set(h, (frequency.get(h) ?? 0) + 1);
  }
}
const wellKnown = name => (frequency.get(name) ?? 0) >= 5;

const divergences = [];
let compared = 0;

for (const record of reviewed.monsters) {
  const section = sections.get(headingFor.get(record.name));
  if (!section) continue;
  const authoritative = [
    ...labelled(section.body, "Advantages"),
    ...labelled(section.body, "Disadvantages"),
    ...labelled(section.body, "Perks"),
    ...labelled(section.body, "Features"),
  ];
  if (authoritative.length === 0) continue;
  compared += 1;

  const traitHeads = record.stats.traits.map(head).filter(Boolean);
  const expressed = new Set([
    ...traitHeads,
    ...record.stats.attacks.map(a => head(a.name ?? "")),
    ...(record.stats.skills ?? []).map(s => head(s.name ?? "")),
  ]);
  const prose = [
    ...record.stats.attacks.map(a => `${a.name} ${a.notes ?? ""}`),
    ...(record.stats.notes ?? []),
  ].join(" ").toLowerCase();

  for (const entry of authoritative) {
    const h = head(entry);
    if (!h || ATTRIBUTE_LIKE.test(h) || NATURAL_WEAPON.test(h)) continue;
    if (expressed.has(h) || prose.includes(h)) continue;
    // A misspelling already carried by the record is not a missing trait.
    const near = traitHeads.find(t => Math.abs(t.length - h.length) <= 3 && levenshtein(t, h) <= 2);
    if (near && !(wellKnown(near) && wellKnown(h))) continue;
    divergences.push({ record: record.name, trait: entry.trim(), head: h, cer: CER_TRAITS.has(h) });
  }
}

const affectedRecords = new Set(divergences.map(d => d.record));
const cerAffecting = divergences.filter(d => d.cer);

const report = [
  "# Trait source audit",
  "",
  "Generated by `npm run review:audit-traits`. Do not edit by hand.",
  "",
  "The authorized source states every creature's traits twice: once in the racial template",
  "(`**Advantages:**` and its companion lines) and again as a `**Traits:**` summary inside Typical Stats.",
  "The JSON conversion reads the summary; the GCS conversion reads the template. Where the summary is",
  "incomplete the published record and the `.gct` describe different creatures, which is how",
  "[#26](https://github.com/Zuljita/DungeonsOnAutomaticMonsters/issues/26) and",
  "[#29](https://github.com/Zuljita/DungeonsOnAutomaticMonsters/issues/29) happened.",
  "",
  "This audit compares the racial template against everything the published record expresses — traits,",
  "attacks, skills and notes — and reports what the template states and the record does not.",
  "",
  "## Result",
  "",
  `- records compared: **${compared}**`,
  `- trait statements in the template but absent from the record: **${divergences.length}**`,
  `- records affected: **${affectedRecords.size}**`,
  `- of those, gaps in a CER input: **${cerAffecting.length}**`,
  "",
];

if (divergences.length === 0) {
  report.push(
    "No divergence. Every trait the racial template states reaches the published record, as a trait, an",
    "attack, a skill or a note.",
    "",
  );
} else {
  report.push(
    "| Record | Trait stated by the racial template | CER input |",
    "| --- | --- | ---: |",
    ...divergences.map(d => `| ${d.record} | \`${d.trait}\` | ${d.cer ? "**yes**" : "no"} |`),
    "",
  );
}

report.push(
  "## What is deliberately excluded",
  "",
  "- **Natural weapons.** Sharp Teeth, Talons, Striker and similar are purchased as advantages but published",
  "  as entries in `stats.attacks`, which is where a GM needs them.",
  "- **Attribute-like entries.** DR and attribute bonuses are published as `stats.attributes`.",
  "- **Source misspellings the record already carries.** The source contains `Resitricted Diet`,",
  "  `infraivision`, `odious racial habie`, `nigh vision`, `discirminatory smell`, `constriciton attack`,",
  "  `dobule-jointed`, `odious radial habit` and `doesn't breath`. Where the record carries the misspelling,",
  "  the trait is present and only its spelling is wrong. Two names that are both in wide use across the",
  "  corpus are never collapsed into each other, so Clinging and Climbing stay distinct.",
  "",
);

const text = `${report.join("\n")}\n`;

if (check) {
  const current = existsSync(REPORT) ? readFileSync(REPORT, "utf8") : "";
  if (current !== text) {
    console.error(`${REPORT} is stale; run npm run review:audit-traits`);
    process.exit(1);
  }
  if (divergences.length > 0) {
    console.error(
      `Trait audit: ${divergences.length} statement(s) in the racial template never reach the record `
      + `(${affectedRecords.size} record(s), ${cerAffecting.length} affecting CER).`,
    );
    process.exit(1);
  }
  console.log(`Trait audit clean: ${compared} record(s) compared, no divergence.`);
  process.exit(0);
}

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, text, "utf8");
console.log(
  `Wrote ${REPORT}: ${compared} record(s) compared, ${divergences.length} divergence(s) `
  + `across ${affectedRecords.size} record(s), ${cerAffecting.length} affecting CER.`,
);
