// Upload generated monster art to the public R2 bucket via the Cloudflare API.
// Skips objects that already exist with the same size unless --force is given.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
//     node scripts/upload-art-to-r2.mjs [--bucket doa-assets] \
//       [--art-dir art/enraged-eggplant] [--prefix monsters/enraged-eggplant] \
//       [--concurrency 8] [--max-attempts 6] [--force] [--flat] [--attachment]
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const BUCKET = opt("bucket", "doa-assets");
const ART_DIR = opt("art-dir", "art/enraged-eggplant");
const PREFIX = opt("prefix", "monsters/enraged-eggplant");
// The art tree is a fixed set of subdirectories, but the GCS templates and
// sheets are flat directories of files. --flat uploads everything directly
// inside --art-dir instead of walking the art subdirectory list.
const FLAT = process.argv.includes("--flat");
const CONCURRENCY = Number(opt("concurrency", "8"));
const MAX_ATTEMPTS = Number(opt("max-attempts", "6"));
const FORCE = args.includes("--force");
// The download attribute is ignored for cross-origin links, and these assets
// live on assets.dungeonsonautomatic.com while the site is on the apex domain.
// Without Content-Disposition a click opens the file — a .gcs sheet renders as
// raw JSON in a tab instead of landing on disk where GCS can open it.
const ATTACHMENT = args.includes("--attachment");
// Thumbnails are display-only: the gallery renders all 304 through <img>, and
// nothing links them as a download.
const ATTACHMENT_SKIP_SUBDIRS = new Set(["thumbs"]);

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!TOKEN || !ACCOUNT) {
  throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set");
}
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;
const HEADERS = { Authorization: `Bearer ${TOKEN}` };

const CONTENT_TYPES = new Map([
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".json", "application/json"],
  [".md", "text/markdown"],
  [".txt", "text/plain"],
  // GCS templates and character sheets are JSON with their own extensions.
  [".gct", "application/json"],
  [".gcs", "application/json"],
  // The Foundry module download is a zip archive.
  [".zip", "application/zip"],
]);

const SUBDIRS = ["portraits", "tokens", "hex-tokens", "thumbs"];
const ROOT_FILES = ["image-manifest.json", "README.md"];

async function listRemote() {
  const sizes = new Map();
  let cursor;
  do {
    const url = new URL(API);
    url.searchParams.set("prefix", `${PREFIX}/`);
    url.searchParams.set("per_page", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`list failed: ${response.status} ${await response.text()}`);
    const payload = await response.json();
    for (const object of payload.result ?? []) sizes.set(object.key, object.size);
    cursor = payload.result_info?.cursor;
    if ((payload.result ?? []).length === 0) cursor = undefined;
  } while (cursor);
  return sizes;
}

async function collectLocal() {
  const files = [];
  if (FLAT) {
    for (const name of await readdir(ART_DIR)) {
      if (CONTENT_TYPES.has(path.extname(name).toLowerCase())) {
        files.push({ local: path.join(ART_DIR, name), key: `${PREFIX}/${name}` });
      }
    }
    return files;
  }
  for (const subdir of SUBDIRS) {
    const dir = path.join(ART_DIR, subdir);
    let names = [];
    try {
      names = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (CONTENT_TYPES.has(path.extname(name).toLowerCase())) {
        files.push({ local: path.join(dir, name), key: `${PREFIX}/${subdir}/${name}` });
      }
    }
  }
  for (const name of ROOT_FILES) {
    const local = path.join(ART_DIR, name);
    try {
      await stat(local);
      files.push({ local, key: `${PREFIX}/${name}` });
    } catch {
      // optional file, skip
    }
  }
  return files;
}

function attachmentHeader(file) {
  if (!ATTACHMENT) return null;
  const parts = file.key.split("/");
  const name = parts.pop();
  if (ATTACHMENT_SKIP_SUBDIRS.has(parts.pop())) return null;
  return `attachment; filename="${name.replace(/"/g, "")}"`;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * The Cloudflare API rate-limits bulk writes: a forced re-upload of the whole
 * art tree drew 167 429s in one run. Back off and retry rather than failing the
 * publish, honouring Retry-After when the API sends one.
 */
async function upload(file, attempt = 1) {
  const body = await readFile(file.local);
  const contentType = CONTENT_TYPES.get(path.extname(file.local).toLowerCase());
  const disposition = attachmentHeader(file);
  const response = await fetch(`${API}/${encodeURIComponent(file.key).replace(/%2F/g, "/")}`, {
    method: "PUT",
    headers: {
      ...HEADERS,
      "Content-Type": contentType,
      ...(disposition ? { "Content-Disposition": disposition } : {}),
    },
    body,
  });
  if (response.ok) return;

  const retryable = response.status === 429 || response.status >= 500;
  if (retryable && attempt <= MAX_ATTEMPTS) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30_000, 500 * 2 ** (attempt - 1));
    await sleep(backoff + Math.floor(backoff * 0.25 * attempt % 400));
    return upload(file, attempt + 1);
  }
  throw new Error(`upload ${file.key} failed: ${response.status} ${await response.text()}`);
}

const remote = await listRemote();
const local = await collectLocal();
if (local.length === 0) throw new Error(`No uploadable files found under ${ART_DIR}`);

const pending = [];
let skipped = 0;
for (const file of local) {
  const size = (await stat(file.local)).size;
  if (!FORCE && remote.get(file.key) === size) {
    skipped += 1;
    continue;
  }
  pending.push(file);
}

console.log(`${local.length} local files; uploading ${pending.length}, skipping ${skipped} unchanged.`);
let uploaded = 0;
let failures = 0;
const queue = [...pending];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const file = queue.shift();
      try {
        await upload(file);
        uploaded += 1;
        if (uploaded % 50 === 0) console.log(`  ${uploaded}/${pending.length} uploaded`);
      } catch (error) {
        failures += 1;
        console.error(String(error));
      }
    }
  })
);
console.log(`Uploaded ${uploaded}/${pending.length} objects to r2://${BUCKET}/${PREFIX}/`);
if (failures > 0) {
  throw new Error(`${failures} uploads failed`);
}
