// SPDX-License-Identifier: MIT

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const srd51ManifestPath = path.join(root, "sources", "srd-5-1", "manifest.json");
const srd35ManifestPath = path.join(root, "sources", "srd-3-5", "manifest.json");
const srd51RawDir = path.join(root, "data", "srd-5-1", "raw");
const srd35RawDir = path.join(root, "data", "srd-3-5", "raw");
const srd35IndexUrl = "https://www.d20srd.org/indexes/monsters.htm";

const readJson = async file => JSON.parse(await readFile(file, "utf8"));

const ensureDir = async dir => {
  await mkdir(dir, { recursive: true });
};

const download = async (url, file) => {
  if (existsSync(file)) {
    console.log(`cached ${path.relative(root, file)}`);
    return;
  }

  await ensureDir(path.dirname(file));
  console.log(`downloading ${url}`);
  const response = await fetch(url, {
    headers: {
      "user-agent": "DungeonsOnAutomaticMonsters source fetcher/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(file, buffer);
  console.log(`wrote ${path.relative(root, file)} (${buffer.length.toLocaleString()} bytes)`);
};

const decodeEntities = value => value
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, " ");

const stripTags = value => decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

const localMonsterPagePath = url => {
  const parsed = new URL(url);
  const basename = path.basename(parsed.pathname);
  return path.join(srd35RawDir, "srd", "monsters", basename);
};

const parseMonsterIndex = html => {
  const entries = [];
  const seenNames = new Set();
  const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html))) {
    const href = decodeEntities(match[1]);
    const name = stripTags(match[2]);
    if (!name || name.startsWith("Image:")) continue;

    const absolute = new URL(href, srd35IndexUrl);
    if (absolute.hostname !== "www.d20srd.org") continue;
    if (!absolute.pathname.startsWith("/srd/monsters/")) continue;
    if (!absolute.pathname.endsWith(".htm")) continue;
    if (absolute.pathname.endsWith("/intro.htm")) continue;

    const pageUrl = `${absolute.origin}${absolute.pathname}`;
    const key = `${name} ${absolute.pathname}${absolute.hash}`;
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    entries.push({
      name,
      url: absolute.href,
      pageUrl,
      anchor: absolute.hash ? absolute.hash.slice(1) : null,
      localPage: path.relative(root, localMonsterPagePath(pageUrl)).replace(/\\/g, "/")
    });
  }

  return entries;
};

const uniquePageUrls = entries => [...new Set(entries.map(entry => entry.pageUrl))].sort();

const main = async () => {
  const [srd51Manifest, srd35Manifest] = await Promise.all([
    readJson(srd51ManifestPath),
    readJson(srd35ManifestPath)
  ]);

  await download(srd51Manifest.sourceUrl, path.join(srd51RawDir, "SRD_CC_v5.1.pdf"));
  const indexFile = path.join(srd35RawDir, "indexes", "monsters.htm");
  await download(srd35IndexUrl, indexFile);

  const indexHtml = await readFile(indexFile, "utf8");
  const indexEntries = parseMonsterIndex(indexHtml);
  const pageUrls = uniquePageUrls(indexEntries);

  await writeFile(
    path.join(srd35RawDir, "monster-index.json"),
    `${JSON.stringify({
      source: {
        id: srd35Manifest.id,
        name: srd35Manifest.name,
        url: srd35IndexUrl,
        license: srd35Manifest.sourceLicense,
        sourceLicense: srd35Manifest.sourceLicense,
        contentLicense: srd35Manifest.contentLicense,
        contentLicenseUrl: srd35Manifest.contentLicenseUrl
      },
      fetchedAt: new Date().toISOString(),
      entryCount: indexEntries.length,
      pageCount: pageUrls.length,
      entries: indexEntries
    }, null, 2)}\n`
  );

  for (const pageUrl of pageUrls) {
    await download(pageUrl, localMonsterPagePath(pageUrl));
  }

  console.log(`SRD 3.5 monster index entries: ${indexEntries.length}`);
  console.log(`SRD 3.5 monster pages cached: ${pageUrls.length}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
