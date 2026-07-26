// SPDX-License-Identifier: MIT
//
// Review view: presents source values, rebuilt GCS totals, DOA stats, attacks,
// CER, encounter metadata, provenance, and the three art assets together, so a
// reviewer never has to open five files to judge one record.
//
//   node scripts/review-queue.mjs --batch missing-attacks
//   node scripts/review-queue.mjs --batch cost-discrepancy --format markdown --out review-queue.md
//   node scripts/review-queue.mjs --record enraged_eggplant_shrieker --format json

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BATCHES, mechanicLabel, selectBatch } from "./review/queue.mjs";
import { buildReviewedPackage } from "./review/build-candidate.mjs";

const args = process.argv.slice(2);
const valueFor = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const batch = valueFor("--batch") ?? "all";
const recordFilter = valueFor("--record");
const format = valueFor("--format") ?? "text";
const outPath = valueFor("--out");
const includeDecided = args.includes("--include-decided");
const limit = Number(valueFor("--limit") ?? Infinity);

const { reviewed, dossiers } = buildReviewedPackage(".");
const recordsById = new Map(reviewed.monsters.map(record => [record.id, record]));
const artManifest = loadArtManifest();

let selected = selectBatch(dossiers, batch);
if (recordFilter) selected = selected.filter(entry => entry.id === recordFilter || entry.name === recordFilter);
if (!includeDecided) selected = selected.filter(entry => entry.decision?.decision !== "approved");
if (Number.isFinite(limit)) selected = selected.slice(0, limit);

const view = selected.map(entry => dossierView(entry, recordsById.get(entry.id)));
const rendered = format === "json"
  ? `${JSON.stringify({ batch, count: view.length, records: view }, null, 2)}\n`
  : format === "markdown"
    ? renderMarkdown(view)
    : renderText(view);

if (outPath) {
  writeFileSync(outPath, rendered, "utf8");
  console.log(`Wrote ${view.length} review dossier(s) for batch ${batch} to ${outPath}`);
} else {
  process.stdout.write(rendered);
}

function dossierView(entry, record) {
  const manifest = entry.manifestEntry ?? {};
  return {
    id: entry.id,
    name: entry.name,
    baseSha256: entry.baseSha256,
    flags: entry.flags,
    specialMechanics: entry.mechanics.map(id => ({ id, label: mechanicLabel(id) })),
    decision: entry.decision,
    source: {
      pageRef: record.pageRef,
      editions: manifest.editions ?? [],
      creatureClass: record.class,
      publishedPoints: manifest.points ?? null,
      rebuiltPoints: manifest.rebuilt_points ?? null,
      reconciliation: manifest.reconciliation ?? 0,
      libraryCostMismatches: manifest.library_cost_mismatches ?? 0,
      libraryAdjustment: manifest.library_adjustment ?? 0,
      gct: manifest.gct ?? null,
      statsFieldsParsed: manifest.stats_fields ?? null,
    },
    stats: {
      attributes: record.stats.attributes,
      attacks: record.stats.attacks,
      traitCount: record.stats.traits.length,
      skills: record.stats.skills,
      size: record.size,
    },
    effectiveness: {
      base: entry.baseEffectiveness,
      reviewed: entry.reviewedEffectiveness,
    },
    encounter: {
      base: entry.baseEncounter,
      reviewed: entry.reviewedEncounter,
    },
    emptyFieldFamilies: {
      lair: record.lair,
      treasure: record.treasure,
      grappling: record.grappling,
    },
    repairs: entry.applied,
    provenance: record.provenance,
    art: artManifest.get(record.id) ?? null,
  };
}

function renderText(view) {
  const lines = [];
  for (const entry of view) {
    lines.push(
      "",
      `=== ${entry.name} (${entry.id})`,
      `    flags: ${entry.flags.join(", ")}`,
      `    source: ${entry.source.pageRef ?? "n/a"}`,
      `    GCS: ${entry.source.gct ?? "n/a"} | published ${entry.source.publishedPoints} pts, `
        + `rebuilt ${entry.source.rebuiltPoints} pts, reconciliation ${entry.source.reconciliation}, `
        + `cost flags ${entry.source.libraryCostMismatches}`,
      `    attributes: ${formatAttributes(entry.stats.attributes)}`,
      `    attacks (${entry.stats.attacks.length}):`,
      ...entry.stats.attacks.map(attack =>
        `      - ${attack.name} (${attack.skill ?? "no roll"}): ${attack.damage ?? "—"}`
        + `${attack.reach ? `, Reach ${attack.reach}` : ""}`),
      `    CER: base ${entry.effectiveness.base.combatEffectivenessRating} `
        + `(OR ${entry.effectiveness.base.offenseRating} / PR ${entry.effectiveness.base.protectionRating}, `
        + `${entry.effectiveness.base.threatTier}) -> reviewed `
        + `${entry.effectiveness.reviewed.combatEffectivenessRating} `
        + `(OR ${entry.effectiveness.reviewed.offenseRating} / PR ${entry.effectiveness.reviewed.protectionRating}, `
        + `${entry.effectiveness.reviewed.threatTier})`,
      `    encounter: appearing ${entry.encounter.reviewed.averageNumberAppearing}, `
        + `wandering weight ${entry.encounter.reviewed.wanderingWeight}`,
      `    special mechanics: ${entry.specialMechanics.map(mechanic => mechanic.label).join("; ") || "none detected"}`,
      `    art: ${entry.art ? "portrait + token + hex token present" : "MISSING"}`,
      `    base sha256: ${entry.baseSha256}`,
    );
    for (const repair of entry.repairs) {
      lines.push(`    repair (#${repair.issue}): ${repair.rationale}`);
    }
    if (entry.decision) {
      lines.push(`    decision: ${entry.decision.decision} by ${entry.decision.reviewer} on ${entry.decision.reviewedOn}`);
    }
  }
  lines.push("", `${view.length} record(s).`, "");
  return lines.join("\n");
}

function renderMarkdown(view) {
  const lines = [
    "# Review Queue",
    "",
    `Batches: ${["all", ...Object.keys(BATCHES)].join(", ")}`,
    "",
  ];
  for (const entry of view) {
    lines.push(
      `## ${entry.name}`,
      "",
      `- Record: \`${entry.id}\` (base sha256 \`${entry.baseSha256}\`)`,
      `- Source: ${entry.source.pageRef ?? "n/a"} — ${entry.source.editions.join(", ") || "no SRD overlap"}`,
      `- GCS: \`${entry.source.gct ?? "n/a"}\`, published ${entry.source.publishedPoints} pts, `
        + `rebuilt ${entry.source.rebuiltPoints} pts, reconciliation ${entry.source.reconciliation}, `
        + `cost flags ${entry.source.libraryCostMismatches}`,
      `- Flags: ${entry.flags.join(", ")}`,
      `- Special mechanics: ${entry.specialMechanics.map(mechanic => mechanic.label).join("; ") || "none detected"}`,
      `- CER: ${entry.effectiveness.base.combatEffectivenessRating} → `
        + `${entry.effectiveness.reviewed.combatEffectivenessRating} `
        + `(${entry.effectiveness.reviewed.threatTier})`,
      `- Encounter: appearing ${entry.encounter.reviewed.averageNumberAppearing}, `
        + `wandering weight ${entry.encounter.reviewed.wanderingWeight}`,
      `- Empty field families: lair ${entry.emptyFieldFamilies.lair === null ? "null" : "populated"}, `
        + `treasure ${Object.values(entry.emptyFieldFamilies.treasure).every(value => value === null) ? "null" : "populated"}, `
        + `grappling ${Object.values(entry.emptyFieldFamilies.grappling).every(value => value === null) ? "null" : "populated"}`,
      "",
      "| Attack | Skill | Damage | Reach |",
      "| --- | ---: | --- | --- |",
      ...entry.stats.attacks.map(attack =>
        `| ${attack.name} | ${attack.skill ?? "—"} | ${attack.damage ?? "—"} | ${attack.reach ?? "—"} |`),
      "",
    );
    if (entry.art) {
      lines.push(
        `Art: [portrait](${entry.art.portrait}) · [token](${entry.art.token}) · [hex token](${entry.art.hexToken})`,
        "",
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatAttributes(attributes) {
  return ["st", "dx", "iq", "ht", "hp", "will", "per", "fp", "speed", "move", "dodge", "dr"]
    .map(key => `${key.toUpperCase()} ${attributes[key] ?? "—"}`)
    .join(" ");
}

function loadArtManifest() {
  const path = "art/enraged-eggplant/image-manifest.json";
  if (!existsSync(path)) return new Map();
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const records = manifest.records ?? manifest.monsters ?? [];
  return new Map(records.map(record => [
    record.monsterId ?? record.id,
    {
      portrait: record.assets?.portrait?.assetPath ?? null,
      token: record.assets?.token?.assetPath ?? null,
      hexToken: record.assets?.hexToken?.assetPath ?? null,
    },
  ]));
}
