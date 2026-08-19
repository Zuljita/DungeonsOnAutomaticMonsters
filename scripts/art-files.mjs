// Shared helpers for the art pipeline now that the pixels live in R2, not git.
//
// The image manifests (art/<package>/image-manifest.json) are the contract:
// each generated asset records its byte length and sha256 at manifest-build
// time, so anything — the validator without a local copy, CI without LFS, the
// R2 verifier — can check the published object against the manifest without
// touching the file. Local copies of the PNGs are an authoring convenience,
// fetched from the public CDN with `npm run art:pull`.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

/** Public CDN in front of the doa-assets bucket. */
export const PUBLIC_ART_BASE = "https://assets.dungeonsonautomatic.com";
export const R2_BUCKET = "doa-assets";

/** art/<package>/<sub>/<file> → monsters/<package>/<sub>/<file> (the R2 key). */
export function r2KeyForAssetPath(assetPath) {
  const parts = assetPath.split("/");
  if (parts[0] !== "art" || parts.length < 4) {
    throw new Error(`unexpected asset path (want art/<package>/<sub>/<file>): ${assetPath}`);
  }
  return ["monsters", ...parts.slice(1)].join("/");
}

/** The site gallery loads thumbs/<monster-id>.webp beside each portrait. */
export function r2ThumbKey(artPackage, monsterId) {
  return `monsters/${artPackage}/thumbs/${monsterId}.webp`;
}

export function localThumbPath(repoRoot, artPackage, monsterId) {
  return path.join(repoRoot, "art", artPackage, "thumbs", `${monsterId}.webp`);
}

export function publicUrlForKey(key) {
  return `${PUBLIC_ART_BASE}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

/** { bytes, sha256 } for a local file, or null when it is not on disk. */
export async function describeLocalFile(filePath) {
  if (!existsSync(filePath)) return null;
  const { size } = statSync(filePath);
  return { bytes: size, sha256: await sha256File(filePath) };
}

/**
 * The generated assets a manifest declares, flattened: one row per
 * (record, assetType) whose status is "generated", with the R2 key it must
 * occupy and the recorded bytes/sha256 (null when the manifest predates them).
 */
export function generatedAssets(manifest, artPackage) {
  const rows = [];
  for (const record of manifest.records ?? []) {
    for (const [assetType, asset] of Object.entries(record.assets ?? {})) {
      if (asset?.status !== "generated") continue;
      rows.push({
        monsterId: record.monsterId,
        assetType,
        assetPath: asset.assetPath,
        key: r2KeyForAssetPath(asset.assetPath),
        bytes: Number.isInteger(asset.bytes) ? asset.bytes : null,
        sha256: typeof asset.sha256 === "string" ? asset.sha256 : null,
      });
    }
    if (record.assets?.portrait?.status === "generated") {
      rows.push({
        monsterId: record.monsterId,
        assetType: "thumb",
        assetPath: path.posix.join("art", artPackage, "thumbs", `${record.monsterId}.webp`),
        key: r2ThumbKey(artPackage, record.monsterId),
        bytes: null,
        sha256: null,
      });
    }
  }
  return rows;
}

/** The two art packages this repository publishes, with their manifests. */
export const ART_PACKAGES = [
  { artPackage: "enraged-eggplant", manifestPath: "art/enraged-eggplant/image-manifest.json" },
  { artPackage: "srd-monsters", manifestPath: "art/srd-monsters/image-manifest.json" },
];
