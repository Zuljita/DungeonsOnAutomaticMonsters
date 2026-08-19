import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ASSET_TYPES = ["portrait", "token", "hexToken"];
const STATUS_VALUES = new Set(["pending", "generated"]);

export function readPngMetadata(filePath) {
  const bytes = readFileSync(filePath);
  if (bytes.subarray(0, 12).toString("ascii").startsWith("version http")) {
    // "version https://git-lfs.github.com/spec/v1" — a skip-smudge checkout.
    const dir = path.relative(process.cwd(), path.dirname(filePath)).replace(/\\/g, "/") || ".";
    throw new Error(
      `${filePath} is a Git LFS pointer left over from before the art moved to R2, not image bytes. Delete it and run: npm run art:pull`,
    );
  }
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

export function validateImageManifest({
  manifest,
  candidate,
  repoRoot,
  requireComplete = false,
  artPackage = "enraged-eggplant",
  // The candidate is a promoted subset of the records the manifest covers:
  // extra manifest rows are drafts held back from the package, not drift.
  // requireComplete then means "every promoted record's art is generated"
  // rather than "everything in the manifest is generated".
  subset = false,
}) {
  const errors = [];
  if (manifest?.schemaVersion !== 2) errors.push("image manifest must use schemaVersion 2");
  if (!Array.isArray(manifest?.records)) errors.push("image manifest records must be an array");
  const hasCandidate = Array.isArray(candidate?.monsters);
  const expectedMonsterCount = subset
    ? manifest?.counts?.monsters
    : hasCandidate
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
    if (hasCandidate && !subset && !candidateById.has(record.monsterId)) {
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
        artPackage,
        assetType === "portrait" ? "portraits" : assetType === "token" ? "tokens" : "hex-tokens",
        `${record.monsterId}.png`,
      );
      if (asset.assetPath !== expectedPath) errors.push(`${assetPath}.assetPath must be ${expectedPath}`);
      const absolutePath = path.resolve(repoRoot, asset.assetPath);
      const artRoot = `${path.resolve(repoRoot, "art", artPackage)}${path.sep}`;
      if (!absolutePath.startsWith(artRoot)) {
        errors.push(`${assetPath}.assetPath escapes the art root`);
        continue;
      }
      // Generated assets carry their published byte length and sha256; the
      // manifest is the record, R2 holds the bytes, and a checkout is not
      // required to have either (npm run art:pull fetches them for authoring).
      if (asset.status === "generated") {
        if (!Number.isInteger(asset.bytes) || asset.bytes <= 0) errors.push(`${assetPath}.bytes must be a positive integer (rebuild the manifest with the art on disk)`);
        if (!/^[0-9a-f]{64}$/.test(asset.sha256 ?? "")) errors.push(`${assetPath}.sha256 must be sha256 hex (rebuild the manifest with the art on disk)`);
        generatedCounts[assetType] += 1;
      } else if (asset.bytes !== undefined || asset.sha256 !== undefined) {
        errors.push(`${assetPath} is pending but records bytes/sha256; rebuild the manifest`);
      }

      // Local pixels are optional. When the asset's directory is present the
      // file must agree with the manifest (and pass the format checks); when
      // the directory is absent — CI, a fresh clone — the manifest stands alone
      // and scripts/verify-art-on-r2.mjs proves the published copy.
      const localDirPresent = existsSync(path.dirname(absolutePath));
      if (!localDirPresent) continue;
      const exists = existsSync(absolutePath);
      if (asset.status === "generated" && !exists) errors.push(`${assetPath} is generated but the PNG is missing locally; run npm run art:pull (or rebuild the manifest)`);
      if (asset.status === "pending" && exists) errors.push(`${assetPath} is pending but the PNG exists; rebuild the manifest`);
      if (!exists) continue;

      try {
        const onDisk = statSync(absolutePath).size;
        if (Number.isInteger(asset.bytes) && onDisk !== asset.bytes) {
          errors.push(`${assetPath} is ${onDisk} B on disk but the manifest records ${asset.bytes} B; rebuild the manifest`);
        }
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
    if (requireComplete && !subset && generatedCounts[assetType] !== expectedMonsterCount) {
      errors.push(`${assetType} art is incomplete: ${generatedCounts[assetType]}/${expectedMonsterCount}`);
    }
  }

  // Subset completeness: every candidate record must have every asset
  // generated, whatever the drafts beside them are still waiting on.
  if (requireComplete && subset) {
    const manifestById = new Map(manifest.records.map((record) => [record.monsterId, record]));
    for (const monsterId of candidateById.keys()) {
      const record = manifestById.get(monsterId);
      if (!record) continue;
      for (const assetType of ASSET_TYPES) {
        if (record.assets?.[assetType]?.status !== "generated") {
          errors.push(`${monsterId} is promoted but its ${assetType} art is not generated`);
        }
      }
    }
  }

  return errors;
}

export function artRecordMap(manifest) {
  return new Map(manifest.records.map((record) => [record.monsterId, record]));
}
