// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";

JSON.parse(readFileSync(new URL("../schema/monster.schema.json", import.meta.url), "utf8"));

const args = process.argv.slice(2);
const allowReviewRequired = args.includes("--allow-review-required");
const file = args.find(arg => !arg.startsWith("--")) ?? "converted/doa-monsters.json";
const pkg = JSON.parse(readFileSync(file, "utf8"));
const errors = [];
const publicContentLicenses = new Set(["cc_by_4_0", "ogl_1_0a"]);

const requiredString = (value, path) => {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${path} must be a non-empty string`);
};

const validateCredits = (credits, path, { required = false, requireOriginator = false } = {}) => {
  if (credits === undefined) {
    if (required) errors.push(`${path} must include at least one structured credit`);
    return [];
  }
  if (!Array.isArray(credits) || credits.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return [];
  }
  for (const [index, credit] of credits.entries()) {
    const creditPath = `${path}[${index}]`;
    if (!credit || typeof credit !== "object") {
      errors.push(`${creditPath} must be an object`);
      continue;
    }
    requiredString(credit.name, `${creditPath}.name`);
    requiredString(credit.role, `${creditPath}.role`);
    requiredString(credit.creditLine, `${creditPath}.creditLine`);
    if (!Array.isArray(credit.scope) || credit.scope.length === 0) {
      errors.push(`${creditPath}.scope must be a non-empty array`);
    } else {
      for (const [scopeIndex, scope] of credit.scope.entries()) {
        requiredString(scope, `${creditPath}.scope[${scopeIndex}]`);
      }
    }
  }
  if (requireOriginator && !credits.some(credit => credit?.role === "originator")) {
    errors.push(`${path} must include an originator credit`);
  }
  return credits.filter(credit => credit && typeof credit === "object");
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

const manifestCredits = validateCredits(pkg?.manifest?.credits, "manifest.credits");
const sources = pkg?.manifest?.sources ?? [];
const sourceIds = new Set(sources.map(source => source.id));
const sourceById = new Map();
for (const [index, source] of sources.entries()) {
  const path = `manifest.sources[${index}]`;
  requiredString(source.id, `${path}.id`);
  requiredString(source.name, `${path}.name`);
  requiredString(source.sourceLicense, `${path}.sourceLicense`);
  if (source.contentLicense !== undefined || source.contentLicenseUrl !== undefined) {
    requiredString(source.contentLicense, `${path}.contentLicense`);
    requiredString(source.contentLicenseUrl, `${path}.contentLicenseUrl`);
    if (!publicContentLicenses.has(source.contentLicense)) {
      errors.push(`${path}.contentLicense must identify a supported public content license`);
    }
  }
  const requiresOriginator = source.sourceLicense === "author_permission";
  const sourceCredits = validateCredits(source.credits, `${path}.credits`, {
    required: requiresOriginator,
    requireOriginator: requiresOriginator,
  });
  sourceById.set(source.id, source);
  for (const originator of sourceCredits.filter(credit => credit.role === "originator")) {
    const presentAtPackageLevel = manifestCredits.some(
      credit => credit.role === "originator"
        && credit.name === originator.name
        && credit.creditLine === originator.creditLine,
    );
    if (!presentAtPackageLevel) {
      errors.push(`manifest.credits must retain originator credit for ${originator.name}`);
    }
  }
}
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
  const isApproved = provenance.manualReviewStatus === "approved";
  if (isApproved || provenance.contentLicense !== undefined || provenance.contentLicenseUrl !== undefined) {
    requiredString(provenance.contentLicense, `${path}.provenance.contentLicense`);
    requiredString(provenance.contentLicenseUrl, `${path}.provenance.contentLicenseUrl`);
    if (!publicContentLicenses.has(provenance.contentLicense)) {
      errors.push(`${path}.provenance.contentLicense must identify a supported public content license`);
    }
  }
  const requiresOriginator = provenance.sourceLicense === "author_permission" || provenance.kind === "fan_authorized";
  const provenanceCredits = validateCredits(provenance.credits, `${path}.provenance.credits`, {
    required: requiresOriginator,
    requireOriginator: requiresOriginator,
  });
  if (provenance.publicStats !== true) errors.push(`${path}.provenance.publicStats must be true`);
  const allowedReviewStatuses = allowReviewRequired ? new Set(["approved", "review_required"]) : new Set(["approved"]);
  if (!allowedReviewStatuses.has(provenance.manualReviewStatus)) {
    errors.push(`${path}.provenance.manualReviewStatus must be ${allowReviewRequired ? "approved or review_required" : "approved"}`);
  }
  if (!sourceIds.has(provenance.packageSourceId)) errors.push(`${path}.provenance.packageSourceId must reference manifest.sources`);
  const packageSource = sourceById.get(provenance.packageSourceId);
  if (isApproved) {
    requiredString(packageSource?.contentLicense, `${path}.packageSource.contentLicense`);
    requiredString(packageSource?.contentLicenseUrl, `${path}.packageSource.contentLicenseUrl`);
    if (packageSource?.contentLicense !== provenance.contentLicense) {
      errors.push(`${path}.provenance.contentLicense must match its manifest source`);
    }
  }
  if (requiresOriginator && isApproved && provenance.contentLicense !== "cc_by_4_0") {
    errors.push(`${path}.provenance.contentLicense must be cc_by_4_0 for approved author-permission material`);
  }
  for (const originator of (packageSource?.credits ?? []).filter(credit => credit?.role === "originator")) {
    const retainedOnRecord = provenanceCredits.some(
      credit => credit.role === "originator"
        && credit.name === originator.name
        && credit.creditLine === originator.creditLine,
    );
    if (!retainedOnRecord) {
      errors.push(`${path}.provenance.credits must retain originator credit for ${originator.name}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${pkg.monsters.length} monster record(s) from ${file}`);
