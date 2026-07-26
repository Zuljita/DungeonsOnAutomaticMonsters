const PROVENANCE_KINDS = new Set([
  "workbook_metadata",
  "srd",
  "gcs_public",
  "doa_authored",
  "fan_authorized",
]);

const SOURCE_SYSTEMS = new Set([
  "srd_3_5",
  "srd_5_1",
  "gcs_public",
  "doa_fixture",
  "gurps_4e_fan_conversion",
]);

const SOURCE_LICENSES = new Set([
  "ogl_1_0a",
  "cc_by_4_0",
  "gcs_public",
  "doa_authored",
  "author_permission",
]);

const REVIEW_STATUSES = new Set(["draft", "review_required", "approved", "rejected"]);
const PUBLIC_CONTENT_LICENSES = new Set(["cc_by_4_0", "ogl_1_0a"]);

export function validatePackage(pkg, { allowUnapproved = false } = {}) {
  const errors = [];
  if (!isRecord(pkg)) return ["package root must be an object"];

  const manifest = pkg.manifest;
  if (!isRecord(manifest)) {
    errors.push("manifest must be an object");
  } else {
    requiredString(manifest.id, "manifest.id", errors);
    requiredString(manifest.name, "manifest.name", errors);
    requiredString(manifest.version, "manifest.version", errors);
    requiredString(manifest.licenseSummary, "manifest.licenseSummary", errors);
    nullableString(manifest.packageUrl, "manifest.packageUrl", errors);
    nullableString(manifest.dataUrl, "manifest.dataUrl", errors);

    if (!isRecord(manifest.sourceBook)) {
      errors.push("manifest.sourceBook must be an object");
    } else {
      requiredString(manifest.sourceBook.id, "manifest.sourceBook.id", errors);
      requiredString(manifest.sourceBook.name, "manifest.sourceBook.name", errors);
      if (manifest.sourceBook.required !== false) errors.push("manifest.sourceBook.required must be false");
      if (manifest.sourceBook.derived !== true) errors.push("manifest.sourceBook.derived must be true");
    }
  }

  const manifestCredits = validateCredits(manifest?.credits, "manifest.credits", errors);
  const sources = Array.isArray(manifest?.sources) ? manifest.sources : [];
  if (sources.length === 0) errors.push("manifest.sources must include at least one source");
  const sourceIds = new Set();
  const sourceById = new Map();
  for (const [index, source] of sources.entries()) {
    const path = `manifest.sources[${index}]`;
    if (!isRecord(source)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    requiredString(source.id, `${path}.id`, errors);
    requiredEnum(source.sourceSystem, `${path}.sourceSystem`, SOURCE_SYSTEMS, errors);
    requiredEnum(source.sourceLicense, `${path}.sourceLicense`, SOURCE_LICENSES, errors);
    requiredString(source.name, `${path}.name`, errors);
    requiredString(source.sourceUrl, `${path}.sourceUrl`, errors);
    requiredString(source.sourceCopyrightNotice, `${path}.sourceCopyrightNotice`, errors);
    if (source.contentLicense !== undefined || source.contentLicenseUrl !== undefined) {
      requiredEnum(source.contentLicense, `${path}.contentLicense`, PUBLIC_CONTENT_LICENSES, errors);
      requiredString(source.contentLicenseUrl, `${path}.contentLicenseUrl`, errors);
    }
    const requiresOriginator = source.sourceLicense === "author_permission";
    const sourceCredits = validateCredits(source.credits, `${path}.credits`, errors, {
      required: requiresOriginator,
      requireOriginator: requiresOriginator,
    });
    if (sourceIds.has(source.id)) errors.push(`duplicate manifest source id ${source.id}`);
    sourceIds.add(source.id);
    sourceById.set(source.id, source);
    for (const originator of sourceCredits.filter(credit => credit.role === "originator")) {
      const retainedAtPackageLevel = manifestCredits.some(
        credit => credit.role === "originator"
          && credit.name === originator.name
          && credit.creditLine === originator.creditLine,
      );
      if (!retainedAtPackageLevel) {
        errors.push(`manifest.credits must retain originator credit for ${originator.name}`);
      }
    }
  }

  const monsters = Array.isArray(pkg.monsters) ? pkg.monsters : [];
  if (monsters.length === 0) errors.push("monsters must include at least one monster");
  const monsterIds = new Set();
  for (const [index, monster] of monsters.entries()) {
    validateMonster(monster, index, manifest, sourceIds, sourceById, monsterIds, allowUnapproved, errors);
  }
  if (manifest?.art !== undefined) validateArtManifest(manifest.art, monsters.length, "manifest.art", errors);

  return errors;
}

function validateArtManifest(art, monsterCount, path, errors) {
  if (!isRecord(art)) {
    errors.push(`${path} must be an object`);
    return;
  }
  requiredString(art.manifestUrl, `${path}.manifestUrl`, errors);
  requiredString(art.baseUrl, `${path}.baseUrl`, errors);
  requiredString(art.generator, `${path}.generator`, errors);
  requiredString(art.styleId, `${path}.styleId`, errors);
  for (const countName of ["portraitCount", "tokenCount", "hexTokenCount"]) {
    if (!Number.isInteger(art[countName]) || art[countName] !== monsterCount) {
      errors.push(`${path}.${countName} must equal monsters.length`);
    }
  }
}

function validateMonster(monster, index, manifest, sourceIds, sourceById, monsterIds, allowUnapproved, errors) {
  const path = `monsters[${index}]`;
  if (!isRecord(monster)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requiredString(monster.id, `${path}.id`, errors);
  requiredString(monster.name, `${path}.name`, errors);
  requiredString(monster.sourceBook, `${path}.sourceBook`, errors);
  requiredStringArray(monster.tags, `${path}.tags`, errors);
  requiredObject(monster.treasure, `${path}.treasure`, errors);
  requiredObject(monster.size, `${path}.size`, errors);
  requiredObject(monster.grappling, `${path}.grappling`, errors);
  requiredObject(monster.encounter, `${path}.encounter`, errors);
  requiredObject(monster.source, `${path}.source`, errors);
  if (monster.sourceBook && manifest?.sourceBook?.id && monster.sourceBook !== manifest.sourceBook.id) {
    errors.push(`${path}.sourceBook must match manifest.sourceBook.id`);
  }
  if (monsterIds.has(monster.id)) errors.push(`duplicate monster id ${monster.id}`);
  monsterIds.add(monster.id);

  if (!isRecord(monster.effectiveness)) {
    errors.push(`${path}.effectiveness must be an object`);
  } else {
    if (typeof monster.effectiveness.combatEffectivenessRating !== "number") {
      errors.push(`${path}.effectiveness.combatEffectivenessRating must be a number`);
    }
    requiredString(monster.effectiveness.threatTier, `${path}.effectiveness.threatTier`, errors);
  }

  if (!isRecord(monster.stats)) {
    errors.push(`${path}.stats must be an object`);
  } else {
    requiredObject(monster.stats.attributes, `${path}.stats.attributes`, errors);
    requiredArray(monster.stats.attacks, `${path}.stats.attacks`, errors);
    requiredStringArray(monster.stats.traits, `${path}.stats.traits`, errors, true);
    requiredArray(monster.stats.skills, `${path}.stats.skills`, errors);
    requiredStringArray(monster.stats.notes, `${path}.stats.notes`, errors, true);
  }

  if (monster.art !== undefined) validateMonsterArt(monster.art, `${path}.art`, errors);

  const provenance = monster.provenance;
  if (!isRecord(provenance)) {
    errors.push(`${path}.provenance must be an object`);
    return;
  }

  requiredEnum(provenance.kind, `${path}.provenance.kind`, PROVENANCE_KINDS, errors);
  requiredEnum(provenance.sourceSystem, `${path}.provenance.sourceSystem`, SOURCE_SYSTEMS, errors);
  requiredEnum(provenance.sourceLicense, `${path}.provenance.sourceLicense`, SOURCE_LICENSES, errors);
  requiredString(provenance.sourceMonsterId, `${path}.provenance.sourceMonsterId`, errors);
  requiredString(provenance.sourceName, `${path}.provenance.sourceName`, errors);
  requiredString(provenance.sourceUrl, `${path}.provenance.sourceUrl`, errors);
  requiredString(provenance.sourceCopyrightNotice, `${path}.provenance.sourceCopyrightNotice`, errors);
  requiredString(provenance.conversionVersion, `${path}.provenance.conversionVersion`, errors);
  requiredStringArray(provenance.conversionNotes, `${path}.provenance.conversionNotes`, errors, true);
  requiredEnum(provenance.manualReviewStatus, `${path}.provenance.manualReviewStatus`, REVIEW_STATUSES, errors);
  requiredString(provenance.packageSourceId, `${path}.provenance.packageSourceId`, errors);
  if (!sourceIds.has(provenance.packageSourceId)) {
    errors.push(`${path}.provenance.packageSourceId must reference manifest.sources`);
  }
  if (provenance.publicStats !== true) errors.push(`${path}.provenance.publicStats must be true`);
  const allowedStatuses = allowUnapproved ? new Set(["approved", "review_required"]) : new Set(["approved"]);
  if (!allowedStatuses.has(provenance.manualReviewStatus)) {
    errors.push(
      `${path}.provenance.manualReviewStatus must be `
        + `${allowUnapproved ? "approved or review_required" : "approved"}`,
    );
  }

  const isApproved = provenance.manualReviewStatus === "approved";
  if (isApproved || provenance.contentLicense !== undefined || provenance.contentLicenseUrl !== undefined) {
    requiredEnum(
      provenance.contentLicense,
      `${path}.provenance.contentLicense`,
      PUBLIC_CONTENT_LICENSES,
      errors,
    );
    requiredString(provenance.contentLicenseUrl, `${path}.provenance.contentLicenseUrl`, errors);
  }

  const requiresOriginator = provenance.sourceLicense === "author_permission"
    || provenance.kind === "fan_authorized";
  const provenanceCredits = validateCredits(
    provenance.credits,
    `${path}.provenance.credits`,
    errors,
    { required: requiresOriginator, requireOriginator: requiresOriginator },
  );
  const packageSource = sourceById.get(provenance.packageSourceId);
  if (isApproved) {
    requiredString(packageSource?.contentLicense, `${path}.packageSource.contentLicense`, errors);
    requiredString(packageSource?.contentLicenseUrl, `${path}.packageSource.contentLicenseUrl`, errors);
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

function validateMonsterArt(art, path, errors) {
  if (!isRecord(art)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (art.kind !== "ai_generated") errors.push(`${path}.kind must be ai_generated`);
  requiredString(art.generator, `${path}.generator`, errors);
  requiredString(art.styleId, `${path}.styleId`, errors);
  validateArtAsset(art.portrait, `${path}.portrait`, errors, false);
  validateArtAsset(art.token, `${path}.token`, errors, true);
  validateArtAsset(art.hexToken, `${path}.hexToken`, errors, true, true);
}

function validateArtAsset(asset, path, errors, token, hexToken = false) {
  if (!isRecord(asset)) {
    errors.push(`${path} must be an object`);
    return;
  }
  requiredString(asset.url, `${path}.url`, errors);
  requiredString(asset.alt, `${path}.alt`, errors);
  requiredString(asset.mediaType, `${path}.mediaType`, errors);
  if (!Number.isInteger(asset.width) || asset.width < 1) errors.push(`${path}.width must be a positive integer`);
  if (!Number.isInteger(asset.height) || asset.height < 1) errors.push(`${path}.height must be a positive integer`);
  if (!/^[0-9a-f]{64}$/.test(asset.promptSha256 ?? "")) errors.push(`${path}.promptSha256 must be sha256 hex`);
  if (token) {
    if (asset.view !== "top_down") errors.push(`${path}.view must be top_down`);
    if (asset.grid !== "flat_top_hex") errors.push(`${path}.grid must be flat_top_hex`);
    if (asset.transparent !== true) errors.push(`${path}.transparent must be true`);
    requiredString(asset.footprint, `${path}.footprint`, errors);
  }
  if (hexToken) {
    if (asset.shape !== "flat_top_hex") errors.push(`${path}.shape must be flat_top_hex`);
    if (asset.derivedFrom !== "token") errors.push(`${path}.derivedFrom must be token`);
    requiredString(asset.derivationStyleId, `${path}.derivationStyleId`, errors);
  }
}

function requiredString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${path} must be a non-empty string`);
}

function nullableString(value, path, errors) {
  if (value !== null && (typeof value !== "string" || value.trim() === "")) {
    errors.push(`${path} must be a non-empty string or null`);
  }
}

function requiredEnum(value, path, allowed, errors) {
  requiredString(value, path, errors);
  if (typeof value === "string" && !allowed.has(value)) errors.push(`${path} has unsupported value ${value}`);
}

function requiredObject(value, path, errors) {
  if (!isRecord(value)) errors.push(`${path} must be an object`);
}

function requiredArray(value, path, errors) {
  if (!Array.isArray(value)) errors.push(`${path} must be an array`);
}

function requiredStringArray(value, path, errors, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some(item => typeof item !== "string" || item.trim() === "")) {
    errors.push(`${path} must be ${allowEmpty ? "an" : "a non-empty"} array of non-empty strings`);
  }
}

function validateCredits(credits, path, errors, { required = false, requireOriginator = false } = {}) {
  if (credits === undefined) {
    if (required) errors.push(`${path} must include at least one structured credit`);
    return [];
  }
  if (!Array.isArray(credits) || credits.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return [];
  }
  const records = [];
  for (const [index, credit] of credits.entries()) {
    const creditPath = `${path}[${index}]`;
    if (!isRecord(credit)) {
      errors.push(`${creditPath} must be an object`);
      continue;
    }
    records.push(credit);
    requiredString(credit.name, `${creditPath}.name`, errors);
    requiredString(credit.role, `${creditPath}.role`, errors);
    requiredString(credit.creditLine, `${creditPath}.creditLine`, errors);
    requiredStringArray(credit.scope, `${creditPath}.scope`, errors);
  }
  if (requireOriginator && !records.some(credit => credit.role === "originator")) {
    errors.push(`${path} must include an originator credit`);
  }
  return records;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
