import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ASSET_TYPES = ["portrait", "token", "hexToken"];
const STATUS_VALUES = new Set(["pending", "generated"]);

export function readPngMetadata(filePath) {
  const bytes = readFileSync(filePath);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG file.`);
  }
  if (bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${filePath} does not start with a PNG IHDR chunk.`);
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorType = bytes[25];
  let hasTransparency = colorType === 4 || colorType === 6;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "tRNS") hasTransparency = true;
    offset += length + 12;
    if (type === "IEND") break;
  }

  return { width, height, colorType, hasTransparency };
}

export function validateImageManifest({ manifest, candidate, repoRoot, requireComplete = false }) {
  const errors = [];
  if (manifest?.schemaVersion !== 2) errors.push("image manifest must use schemaVersion 2");
  if (!Array.isArray(manifest?.records)) errors.push("image manifest records must be an array");
  const hasCandidate = Array.isArray(candidate?.monsters);
  const expectedMonsterCount = hasCandidate
    ? candidate.monsters.length
    : manifest?.counts?.monsters;
  if (!Number.isInteger(expectedMonsterCount) || expectedMonsterCount < 1) {
    errors.push("candidate monsters or a positive manifest counts.monsters value is required");
  }
  if (errors.length > 0) return errors;

  const candidateById = new Map((candidate?.monsters ?? []).map((monster) => [monster.id, monster]));
  const recordIds = new Set();
  const generatedCounts = { portrait: 0, token: 0, hexToken: 0 };

  if (manifest.records.length !== expectedMonsterCount) {
    errors.push(`image manifest has ${manifest.records.length} records; expected ${expectedMonsterCount}`);
  }

  for (const [index, record] of manifest.records.entries()) {
    const recordPath = `records[${index}]`;
    if (typeof record?.monsterId !== "string" || record.monsterId.length === 0) {
      errors.push(`${recordPath}.monsterId must be a non-empty string`);
      continue;
    }
    if (recordIds.has(record.monsterId)) errors.push(`duplicate art monster id ${record.monsterId}`);
    recordIds.add(record.monsterId);
    if (hasCandidate && !candidateById.has(record.monsterId)) {
      errors.push(`${recordPath}.monsterId is not in the candidate package`);
    }

    for (const assetType of ASSET_TYPES) {
      const asset = record.assets?.[assetType];
      const assetPath = `${recordPath}.assets.${assetType}`;
      if (!asset || typeof asset !== "object") {
        errors.push(`${assetPath} must be an object`);
        continue;
      }
      if (!STATUS_VALUES.has(asset.status)) errors.push(`${assetPath}.status must be pending or generated`);
      if (assetType === "hexToken") {
        if (asset.derivedFrom !== record.assets?.token?.assetPath) errors.push(`${assetPath}.derivedFrom must reference the transparent token`);
        if (asset.derivationStyleId !== "doa-flat-top-hex-v2") errors.push(`${assetPath}.derivationStyleId must be doa-flat-top-hex-v2`);
        if (asset.sourcePromptSha256 !== record.assets?.token?.promptSha256) errors.push(`${assetPath}.sourcePromptSha256 must match the token prompt hash`);
      } else {
        if (typeof asset.prompt !== "string" || asset.prompt.length === 0) errors.push(`${assetPath}.prompt must be non-empty`);
        if (!/^[0-9a-f]{64}$/.test(asset.promptSha256 ?? "")) errors.push(`${assetPath}.promptSha256 must be sha256 hex`);
      }
      if (typeof asset.assetPath !== "string" || asset.assetPath.length === 0) {
        errors.push(`${assetPath}.assetPath must be non-empty`);
        continue;
      }

      const expectedPath = path.posix.join(
        "art",
        "enraged-eggplant",
        assetType === "portrait" ? "portraits" : assetType === "token" ? "tokens" : "hex-tokens",
        `${record.monsterId}.png`,
      );
      if (asset.assetPath !== expectedPath) errors.push(`${assetPath}.assetPath must be ${expectedPath}`);
      const absolutePath = path.resolve(repoRoot, asset.assetPath);
      const artRoot = `${path.resolve(repoRoot, "art", "enraged-eggplant")}${path.sep}`;
      if (!absolutePath.startsWith(artRoot)) {
        errors.push(`${assetPath}.assetPath escapes the art root`);
        continue;
      }
      const exists = existsSync(absolutePath);
      if (asset.status === "generated" && !exists) errors.push(`${assetPath} is generated but the PNG is missing`);
      if (asset.status === "pending" && exists) errors.push(`${assetPath} is pending but the PNG exists; rebuild the manifest`);
      if (!exists) continue;

      generatedCounts[assetType] += 1;
      try {
        const metadata = readPngMetadata(absolutePath);
        if (metadata.width !== metadata.height) {
          errors.push(`${assetPath} must be square; found ${metadata.width}x${metadata.height}`);
        }
        if (metadata.width < 1024) errors.push(`${assetPath} must be at least 1024px square`);
        if ((assetType === "token" || assetType === "hexToken") && !metadata.hasTransparency) {
          errors.push(`${assetPath} must contain real alpha transparency`);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  for (const monsterId of candidateById.keys()) {
    if (!recordIds.has(monsterId)) errors.push(`candidate monster ${monsterId} is missing from the image manifest`);
  }

  if (manifest.counts?.monsters !== expectedMonsterCount) errors.push("manifest counts.monsters is stale");
  for (const assetType of ASSET_TYPES) {
    if (manifest.counts?.[assetType]?.generated !== generatedCounts[assetType]) {
      errors.push(`manifest counts.${assetType}.generated is stale`);
    }
    if (manifest.counts?.[assetType]?.pending !== expectedMonsterCount - generatedCounts[assetType]) {
      errors.push(`manifest counts.${assetType}.pending is stale`);
    }
    if (requireComplete && generatedCounts[assetType] !== expectedMonsterCount) {
      errors.push(`${assetType} art is incomplete: ${generatedCounts[assetType]}/${expectedMonsterCount}`);
    }
  }

  return errors;
}

export function artRecordMap(manifest) {
  return new Map(manifest.records.map((record) => [record.monsterId, record]));
}
