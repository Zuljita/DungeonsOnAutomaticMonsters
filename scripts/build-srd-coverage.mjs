// SPDX-License-Identifier: MIT
//
// SRD coverage registry: every parsed SRD 5.1 and 3.5 monster identity,
// matched against every reviewed source, with a verified resolution for each
// heading that is not one concrete covered creature.
//
//   node scripts/build-srd-coverage.mjs
//   node scripts/build-srd-coverage.mjs --check    # fail instead of writing
//
// The roadmap's coverage rule is that no source identity may be silently
// missing (ROADMAP.md, "What 'Full SRD Set' Means"). A heading is accounted
// for in exactly one way:
//
//   covered   — a reviewed record answers to it, by name, by curated alias, or
//               by an explicit provenance.coversSourceIdentities claim.
//   family    — a family index page; its members are named and each one must
//               itself be covered, so the claim of completeness is checked,
//               not asserted.
//   variant   — a sample or variant stat block printed beside a base creature;
//               the base must be covered.
//   excluded  — out of scope on purpose, with the reason recorded.
//   deferred  — a decision is still owed; the row names the issue that owns it.
//
// Anything else is unresolved, and the build fails on it. That is the
// no-silent-gaps rule with teeth: absence is always deliberate and named.
//
// The parsed corpora live under the ignored `data/` directory, so this skips
// cleanly on a checkout that has not run `npm run parse:srds` — the same
// contract `review-verify.mjs` uses for the untracked conversion queue.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SRD_35_PATH = "data/srd-3-5/parsed/monsters.json";
const SRD_51_PATH = "data/srd-5-1/parsed/monsters.json";
const REVIEWED_PATHS = [
  "converted/enraged-eggplant/doa-monsters.reviewed.json",
  "converted/srd-monsters/doa-monsters.reviewed.json",
];
const DISPOSITIONS_PATH = "review/srd-coverage-dispositions.json";
const REPORT_PATH = "review/reports/srd-coverage.md";
const REGISTRY_PATH = "review/srd-coverage.json";

const check = process.argv.includes("--check");
const readJson = path => JSON.parse(readFileSync(path, "utf8"));

/**
 * Fold a source heading down to a comparison key: case, punctuation and the
 * SRD's typographic dashes and quotes all vary between the 3.5 HTML and the
 * 5.1 PDF for what is plainly the same word.
 */
function clean(value) {
  return String(value)
    .replace(/­/g, "")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9,()'\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every spelling a heading might be matched by. The SRD writes the same
 * creature as "Bear, Black" in one index and "Black Bear" in another, and
 * parenthesises a second name — "Hellcat (Bezekira)" — that other sources use
 * on its own.
 */
function spellings(name) {
  const out = new Set();
  const base = clean(name);
  out.add(base);

  // "Bear, Black" is "Black Bear" reordered. It is *not* "Bear": the SRD prints
  // a separate family heading under that name, and folding the two together
  // would silently mark a family page as covered by one of its members.
  const comma = base.match(/^([^,]+),\s*(.+)$/);
  if (comma) out.add(`${comma[2]} ${comma[1]}`.replace(/\s+/g, " ").trim());
  const paren = base.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (paren) {
    out.add(paren[1].trim());
    out.add(paren[2].trim());
  }
  for (const value of [...out]) {
    out.add(value.replace(/-/g, " ").replace(/\s+/g, " ").trim());
    out.add(value.replace(/'/g, "").trim());
    out.add(value.replace(/'/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim());
  }
  return [...out].filter(Boolean);
}

/** Spellings plus the curated aliases, searched in both directions. */
function keysFor(name, aliasMap) {
  const keys = new Set(spellings(name));
  const self = clean(name);
  for (const [from, to] of Object.entries(aliasMap)) {
    if (clean(from) === self) for (const key of spellings(to)) keys.add(key);
    if (clean(to) === self) for (const key of spellings(from)) keys.add(key);
  }
  return [...keys];
}

/** Display form: the parse keeps the source's dashes, the registry does not. */
function display(name) {
  return String(name).replace(/­/g, "").replace(/[‐‑]/g, "-");
}

if (!existsSync(SRD_35_PATH) || !existsSync(SRD_51_PATH)) {
  console.log(
    `Skipped: ${SRD_35_PATH} and ${SRD_51_PATH} are not present `
    + "(the parsed SRD corpora are untracked). Run npm run parse:srds first.",
  );
  process.exit(0);
}

const dispositionsFile = readJson(DISPOSITIONS_PATH);
const aliasMap = dispositionsFile.aliases.map;
const problems = [];

// Every reviewed record, from every source. A record answers to its own name
// and, where its provenance states them, to explicit source headings — the
// independently authored batch records exactly which SRD headings each build
// answers with provenance.coversSourceIdentities, and those claims outrank
// name matching.
const reviewed = REVIEWED_PATHS.flatMap(path => readJson(path).monsters);
const packageKeys = new Map();
const claim = (key, recordName) => {
  if (!packageKeys.has(key)) packageKeys.set(key, recordName);
};
for (const record of reviewed) {
  for (const key of keysFor(record.name, aliasMap)) claim(key, record.name);
  for (const cover of record.provenance.coversSourceIdentities ?? []) {
    for (const name of [cover.heading, ...(cover.alsoPrintedAs ?? [])]) {
      for (const key of keysFor(name, aliasMap)) claim(key, record.name);
    }
  }
}

/** The covering record for a heading, or undefined. */
function coveredBy(name) {
  return keysFor(name, aliasMap).map(key => packageKeys.get(key)).find(Boolean);
}

const resolutions = dispositionsFile.resolutions;

function resolve(name) {
  const wanted = clean(display(name));
  const named = entries => Object.keys(entries).find(heading => clean(heading) === wanted);

  const family = named(resolutions.familyIndex.members);
  if (family) {
    const members = resolutions.familyIndex.members[family];
    if (members.length === 0) problems.push(`family heading ${family} names no members`);
    const missing = members.filter(member => !coveredBy(member));
    if (missing.length > 0) {
      problems.push(`family heading ${family} names uncovered member(s): ${missing.join(", ")}`);
    }
    return { kind: "family", detail: members.map(member => coveredBy(member) ?? member) };
  }

  const variant = named(resolutions.sampleVariants.variantOf);
  if (variant) {
    const base = resolutions.sampleVariants.variantOf[variant];
    const record = coveredBy(base);
    if (!record) problems.push(`variant heading ${variant} names an uncovered base: ${base}`);
    return { kind: "variant", detail: [record ?? base] };
  }

  if (resolutions.excluded.headings.some(heading => clean(heading) === wanted)) {
    return { kind: "excluded", detail: [resolutions.excluded.reason] };
  }

  for (const group of resolutions.deferred) {
    if (group.headings.some(heading => clean(heading) === wanted)) {
      return { kind: "deferred", detail: [group.owner] };
    }
  }

  return { kind: "unresolved", detail: [] };
}

const sources = [
  { id: "srd-3-5", label: "SRD 3.5", monsters: readJson(SRD_35_PATH).monsters },
  { id: "srd-5-1", label: "SRD 5.1", monsters: readJson(SRD_51_PATH).monsters },
];

// One row per distinct heading, not per source printing: a monster both SRDs
// name is one piece of work, and the row records both source identities.
const union = new Map();
const perSource = [];

for (const source of sources) {
  let covered = 0;
  for (const entry of source.monsters) {
    const name = display(entry.name);
    const keys = keysFor(name, aliasMap);
    if (keys.map(key => packageKeys.get(key)).find(Boolean)) {
      covered += 1;
      continue;
    }
    // Fold cross-edition duplicates onto one row via the first spelling that
    // an already-seen row also answers to.
    const existing = keys.map(key => union.get(key)).find(Boolean);
    const row = existing ?? { name, ...resolve(name), sourceIds: [], sourceNames: [] };
    row.sourceIds.push(entry.id);
    if (!row.sourceNames.includes(entry.name)) row.sourceNames.push(entry.name);
    if (!existing) for (const key of keys) if (!union.has(key)) union.set(key, row);
  }
  perSource.push({ ...source, covered, total: source.monsters.length, monsters: undefined });
}

const rows = [...new Set(union.values())].sort((a, b) => a.name.localeCompare(b.name));
const byKind = new Map([["family", []], ["variant", []], ["excluded", []], ["deferred", []], ["unresolved", []]]);
for (const row of rows) byKind.get(row.kind).push(row);

for (const row of byKind.get("unresolved")) {
  problems.push(`${row.name} (${row.sourceNames.join("; ")}) is neither covered nor dispositioned`);
}

// A resolution nobody needs any more is stale curation: every named heading
// must still be a real, uncovered parsed heading.
const rowNames = new Set(rows.map(row => clean(row.name)));
const declared = [
  ...Object.keys(resolutions.familyIndex.members),
  ...Object.keys(resolutions.sampleVariants.variantOf),
  ...resolutions.excluded.headings,
  ...resolutions.deferred.flatMap(group => group.headings),
];
for (const heading of declared) {
  if (!rowNames.has(clean(heading))) {
    problems.push(`resolution for ${heading} matches no uncovered parsed heading; remove or correct it`);
  }
}

if (problems.length > 0) {
  console.error(`SRD coverage failed:\n${problems.map(problem => `  - ${problem}`).join("\n")}`);
  process.exit(1);
}

const KIND_LABELS = {
  family: "Family index headings, members named and covered",
  variant: "Sample and variant stat blocks, base covered",
  excluded: "Excluded on purpose",
  deferred: "Deferred, decision owed",
};

const registry = {
  note: "Generated by scripts/build-srd-coverage.mjs. Do not edit by hand; edit review/srd-coverage-dispositions.json and regenerate.",
  packageRecordCount: reviewed.length,
  sources: perSource.map(source => ({
    id: source.id,
    parsedIdentities: source.total,
    covered: source.covered,
    accounted: source.total - source.covered,
  })),
  resolvedHeadingCount: rows.length,
  unresolvedCount: 0,
  resolved: rows.map(row => ({
    name: row.name,
    kind: row.kind,
    detail: row.detail,
    sourceIds: row.sourceIds,
    sourceNames: row.sourceNames,
  })),
};

const lines = [];
lines.push("# SRD Coverage");
lines.push("");
lines.push(
  "Generated by `npm run coverage:srd`. Every parsed SRD monster identity, matched against the "
  + `${reviewed.length} reviewed records across every source. Do not edit by hand — the judgement calls live in `
  + "[`review/srd-coverage-dispositions.json`](../srd-coverage-dispositions.json).",
);
lines.push("");
lines.push("## Per source");
lines.push("");
lines.push("| Source | Parsed identities | Covered by a record | Accounted by disposition |");
lines.push("| --- | ---: | ---: | ---: |");
for (const source of perSource) {
  lines.push(`| ${source.label} | ${source.total} | ${source.covered} | ${source.total - source.covered} |`);
}
lines.push("");
lines.push(
  "Folding the headings both SRDs share onto one row each, **every parsed heading is accounted for**: "
  + `${rows.length} non-creature headings carry a verified resolution and zero are unresolved.`,
);
lines.push("");
for (const [kind, list] of byKind) {
  if (list.length === 0) continue;
  lines.push(`## ${KIND_LABELS[kind]} (${list.length})`);
  lines.push("");
  lines.push("| Heading | Sources | Resolution |");
  lines.push("| --- | --- | --- |");
  for (const row of list) {
    const editions = [...new Set(row.sourceIds.map(id => (id.startsWith("srd_5_1") ? "5.1" : "3.5")))].join(", ");
    lines.push(`| ${row.name} | ${editions} | ${row.detail.join(", ")} |`);
  }
  lines.push("");
}

const reportText = `${lines.join("\n")}\n`;
const registryText = `${JSON.stringify(registry, null, 2)}\n`;

if (check) {
  const stale = [];
  const matches = (path, text) => existsSync(path) && readFileSync(path, "utf8") === text;
  if (!matches(REPORT_PATH, reportText)) stale.push(`${REPORT_PATH} is stale; run npm run coverage:srd`);
  if (!matches(REGISTRY_PATH, registryText)) stale.push(`${REGISTRY_PATH} is stale; run npm run coverage:srd`);
  if (stale.length > 0) {
    console.error(stale.join("\n"));
    process.exit(1);
  }
  console.log(`SRD coverage is current: every parsed heading accounted for (${rows.length} by disposition).`);
} else {
  writeFileSync(REPORT_PATH, reportText, "utf8");
  writeFileSync(REGISTRY_PATH, registryText, "utf8");
  for (const source of perSource) {
    console.log(`${source.label}: ${source.covered}/${source.total} covered, ${source.total - source.covered} accounted by disposition`);
  }
  console.log(`Wrote ${REPORT_PATH} and ${REGISTRY_PATH}: 0 unresolved.`);
}
