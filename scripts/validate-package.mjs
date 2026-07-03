import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "converted/doa-monsters.json";
const pkg = JSON.parse(readFileSync(file, "utf8"));
const errors = [];

const requiredString = (value, path) => {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${path} must be a non-empty string`);
};

requiredString(pkg?.manifest?.id, "manifest.id");
requiredString(pkg?.manifest?.version, "manifest.version");
requiredString(pkg?.manifest?.sourceBook?.id, "manifest.sourceBook.id");

if (!Array.isArray(pkg?.manifest?.sources) || pkg.manifest.sources.length === 0) {
  errors.push("manifest.sources must include at least one source");
}

if (!Array.isArray(pkg?.monsters) || pkg.monsters.length === 0) {
  errors.push("monsters must include at least one monster");
}

const sourceIds = new Set((pkg?.manifest?.sources ?? []).map(source => source.id));
const monsterIds = new Set();

for (const [index, monster] of (pkg?.monsters ?? []).entries()) {
  const path = `monsters[${index}]`;
  requiredString(monster.id, `${path}.id`);
  if (monsterIds.has(monster.id)) errors.push(`duplicate monster id ${monster.id}`);
  monsterIds.add(monster.id);
  requiredString(monster.name, `${path}.name`);
  if (!monster.stats || typeof monster.stats !== "object") errors.push(`${path}.stats is required`);

  const provenance = monster.provenance;
  if (!provenance || typeof provenance !== "object") {
    errors.push(`${path}.provenance is required`);
    continue;
  }
  requiredString(provenance.sourceSystem, `${path}.provenance.sourceSystem`);
  requiredString(provenance.sourceLicense, `${path}.provenance.sourceLicense`);
  requiredString(provenance.sourceMonsterId, `${path}.provenance.sourceMonsterId`);
  requiredString(provenance.sourceName, `${path}.provenance.sourceName`);
  requiredString(provenance.sourceUrl, `${path}.provenance.sourceUrl`);
  requiredString(provenance.sourceCopyrightNotice, `${path}.provenance.sourceCopyrightNotice`);
  requiredString(provenance.conversionVersion, `${path}.provenance.conversionVersion`);
  if (provenance.publicStats !== true) errors.push(`${path}.provenance.publicStats must be true`);
  if (provenance.manualReviewStatus !== "approved") errors.push(`${path}.provenance.manualReviewStatus must be approved`);
  if (!sourceIds.has(provenance.packageSourceId)) errors.push(`${path}.provenance.packageSourceId must reference manifest.sources`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${pkg.monsters.length} public monster record(s) from ${file}`);
