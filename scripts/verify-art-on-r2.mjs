// Verify that every generated asset the image manifests declare is present in
// the public R2 bucket at the expected key with the expected byte length, and
// that every generated portrait has its web thumbnail beside it.
//
// This is the CI-side truth now that art bytes are not in git: the manifests
// say what exists, R2 holds it, and this script proves the two agree without
// downloading a pixel (one paginated listing per art package).
//
// Usage:
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/verify-art-on-r2.mjs [--require-credentials]
//
// Without credentials it prints a notice and exits 0 (a fork PR cannot see the
// secrets), unless --require-credentials is given — the publish workflow uses
// that, because publishing a package whose art is missing must not succeed.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ART_PACKAGES, R2_BUCKET, generatedAssets } from "./art-files.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireCredentials = process.argv.includes("--require-credentials");
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!TOKEN || !ACCOUNT) {
  const message = "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID are not set; skipping the R2 art check.";
  if (requireCredentials) {
    console.error(`::error title=R2 art check needs credentials::${message}`);
    process.exit(1);
  }
  console.log(`::notice title=R2 art check skipped::${message}`);
  process.exit(0);
}

const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${R2_BUCKET}/objects`;
const HEADERS = { Authorization: `Bearer ${TOKEN}` };

async function listPrefix(prefix) {
  const sizes = new Map();
  let cursor = null;
  for (;;) {
    const url = new URL(API);
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("per_page", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`R2 list ${prefix} failed: ${response.status} ${await response.text()}`);
    const body = await response.json();
    if (!body.success) throw new Error(`R2 list ${prefix} failed: ${JSON.stringify(body.errors)}`);
    for (const object of body.result ?? []) sizes.set(object.key, object.size);
    if (!body.result_info?.is_truncated || !body.result_info?.cursor) break;
    cursor = body.result_info.cursor;
  }
  return sizes;
}

let problems = 0;
for (const { artPackage, manifestPath } of ART_PACKAGES) {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, manifestPath), "utf8"));
  const expected = generatedAssets(manifest, artPackage);
  const onR2 = await listPrefix(`monsters/${artPackage}/`);

  const missing = [];
  const wrongSize = [];
  const unsized = [];
  for (const asset of expected) {
    const size = onR2.get(asset.key);
    if (size === undefined) {
      missing.push(asset.key);
      continue;
    }
    if (asset.bytes === null) {
      if (asset.assetType !== "thumb") unsized.push(asset.key);
      continue;
    }
    if (size !== asset.bytes) wrongSize.push(`${asset.key} (manifest ${asset.bytes} B, R2 ${size} B)`);
  }

  console.log(
    `${artPackage}: ${expected.length} expected objects (${expected.filter((a) => a.assetType !== "thumb").length} assets + `
      + `${expected.filter((a) => a.assetType === "thumb").length} thumbs), ${onR2.size} objects under monsters/${artPackage}/, `
      + `${missing.length} missing, ${wrongSize.length} size mismatches`
      + (unsized.length > 0 ? `, ${unsized.length} without recorded bytes (rebuild the manifest with the art on disk)` : ""),
  );
  for (const key of missing.slice(0, 25)) console.log(`  MISSING  ${key}`);
  if (missing.length > 25) console.log(`  ... and ${missing.length - 25} more missing`);
  for (const line of wrongSize.slice(0, 25)) console.log(`  SIZE     ${line}`);
  if (wrongSize.length > 25) console.log(`  ... and ${wrongSize.length - 25} more size mismatches`);
  problems += missing.length + wrongSize.length;
}

if (problems > 0) {
  console.error(`::error title=Art missing from R2::${problems} manifest asset(s) are missing or differ on R2. Upload them with npm run art:upload (and art:thumbnails first for portraits).`);
  process.exit(1);
}
console.log("PASS: every generated asset in the image manifests is on R2 with the recorded size, thumbnails included.");
