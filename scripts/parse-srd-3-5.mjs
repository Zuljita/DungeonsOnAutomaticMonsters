// SPDX-License-Identifier: MIT

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rawDir = path.join(root, "data", "srd-3-5", "raw", "srd", "monsters");
const manifestPath = path.join(root, "sources", "srd-3-5", "manifest.json");
const indexPath = path.join(root, "data", "srd-3-5", "raw", "monster-index.json");
const outputPath = path.join(root, "data", "srd-3-5", "parsed", "monsters.json");

const statLabels = new Set([
  "Size/Type",
  "Hit Dice",
  "Initiative",
  "Speed",
  "Armor Class",
  "Base Attack/Grapple",
  "Attack",
  "Full Attack",
  "Space/Reach",
  "Special Attacks",
  "Special Qualities",
  "Saves",
  "Abilities",
  "Skills",
  "Feats",
  "Environment",
  "Organization",
  "Challenge Rating",
  "Treasure",
  "Alignment",
  "Advancement",
  "Level Adjustment"
]);

const decodeEntities = value => value
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, " ")
  .replace(/&mdash;|&#8212;|&#x2014;/g, "-")
  .replace(/&ndash;|&#8211;|&#x2013;/g, "-")
  .replace(/&rsquo;|&#8217;|&#x2019;/g, "'")
  .replace(/&lsquo;|&#8216;|&#x2018;/g, "'")
  .replace(/&ldquo;|&#8220;|&#x201C;/g, "\"")
  .replace(/&rdquo;|&#8221;|&#x201D;/g, "\"")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const cleanText = value => decodeEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n[ \t]+/g, "\n")
  .replace(/\s+([:;,.)])/g, "$1")
  .replace(/([(])\s+/g, "$1")
  .replace(/[ \t]{2,}/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const statLabel = value => value.replace(/:$/, "").trim();

const slugify = value => value
  .toLowerCase()
  .replace(/['’]/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const normalizedName = value => slugify(value)
  .replace(/_the_/g, "_")
  .replace(/_and_/g, "_");

const titleFromHtml = html => {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanText(h1[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? cleanText(title[1]).replace(/\s*::\s*d20srd\.org\s*$/i, "") : null;
};

const extractTables = html => {
  const tables = [];
  const tablePattern = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tablePattern.exec(html))) {
    const rows = [];
    const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(tableMatch[1]))) {
      const cells = [];
      const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;

      while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
        const text = cleanText(cellMatch[1]);
        if (text) cells.push(text);
      }

      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length > 0) tables.push(rows);
  }

  return tables;
};

const statBlockTables = tables => tables.filter(rows =>
  rows.some(row => row.length >= 2 && statLabels.has(statLabel(row[0])))
);

const blocksFromTable = (rows, fallbackName) => {
  const names = [];
  const blocks = [];

  for (const row of rows) {
    const label = statLabel(row[0]);
    if (!statLabels.has(label) && row.length > 1 && names.length === 0) {
      names.push(...row.slice(row.length > 2 ? 1 : 0));
    }
  }

  const valueColumnCount = Math.max(1, ...rows
    .filter(row => statLabels.has(statLabel(row[0])))
    .map(row => Math.max(1, row.length - 1)));

  for (let index = 0; index < valueColumnCount; index += 1) {
    blocks.push({
      name: names[index] ?? (index === 0 ? fallbackName : `${fallbackName} ${index + 1}`),
      fields: {}
    });
  }

  for (const row of rows) {
    const label = statLabel(row[0]);
    if (!statLabels.has(label)) continue;

    const values = row.slice(1);
    for (const [index, block] of blocks.entries()) {
      block.fields[label] = values[index] ?? values[0] ?? "";
    }
  }

  return blocks.filter(block => Object.keys(block.fields).length > 0);
};

const escapedRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const statBlockFromRawText = (name, rawText) => {
  const lines = rawText.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const target = normalizedName(name);
  let sizeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const lineName = normalizedName(lines[index]);
    const nearName = lineName === target || lineName.startsWith(`${target}_`) || target.startsWith(`${lineName}_`);
    if (!nearName) continue;

    const nextSizeIndex = lines.slice(index + 1, index + 4).findIndex(line => statLabel(line) === "Size/Type");
    if (nextSizeIndex >= 0) {
      sizeIndex = index + 1 + nextSizeIndex;
      break;
    }
  }

  if (sizeIndex < 0) return null;

  const block = {};
  const labelPattern = new RegExp(`^(${[...statLabels].map(escapedRegExp).join("|")}):?$`);

  for (let index = sizeIndex; index < lines.length; index += 1) {
    const label = statLabel(lines[index]);
    if (!statLabels.has(label)) continue;

    const values = [];
    for (let valueIndex = index + 1; valueIndex < lines.length; valueIndex += 1) {
      if (labelPattern.test(lines[valueIndex])) break;
      if (/^(Combat|Carrying Capacity|Skills|Feats|[A-Z][A-Za-z '-]+)$/u.test(lines[valueIndex]) && values.length > 0) break;
      values.push(lines[valueIndex]);
    }
    block[label] = values.join(" ").trim();

    if (label === "Level Adjustment") break;
  }

  return Object.keys(block).length > 0 ? block : null;
};

const matchingStatBlock = (name, statBlocks, rawText) => {
  const target = normalizedName(name);
  const exact = statBlocks.find(block => normalizedName(block.name) === target);
  if (exact) return exact.fields;

  const partial = statBlocks.find(block => {
    const blockName = normalizedName(block.name);
    return blockName.startsWith(target) || target.startsWith(blockName);
  });
  if (partial) return partial.fields;

  return statBlockFromRawText(name, rawText);
};

const combatTextFromHtml = html => {
  const h1End = html.search(/<\/h1>/i);
  const bodyStart = h1End >= 0 ? h1End + 5 : 0;
  const footerStart = html.slice(bodyStart).search(/The Hypertext d20 SRD/i);
  const bodyEnd = footerStart >= 0 ? bodyStart + footerStart : html.length;
  const body = html.slice(bodyStart, bodyEnd);
  return cleanText(body);
};

const main = async () => {
  const [manifest, index] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(indexPath, "utf8").then(JSON.parse)
  ]);

  const files = (await readdir(rawDir)).filter(file => file.endsWith(".htm")).sort();
  const pages = new Map();

  for (const file of files) {
    const html = await readFile(path.join(rawDir, file), "utf8");
    const pageTitle = titleFromHtml(html) ?? file.replace(/\.htm$/i, "");
    const pageUrl = `https://www.d20srd.org/srd/monsters/${file}`;
    const tables = statBlockTables(extractTables(html));
    const rawText = combatTextFromHtml(html);
    const statBlocks = tables.flatMap(table => blocksFromTable(table, pageTitle));

    pages.set(file, {
      pageTitle,
      pageUrl,
      rawText,
      statBlocks
    });
  }

  const monsters = [];
  for (const entry of index.entries) {
    const file = path.basename(new URL(entry.pageUrl).pathname);
    const page = pages.get(file);
    if (!page) continue;

    monsters.push({
      id: `srd_3_5_${slugify(entry.name)}`,
      name: entry.name,
      sourcePage: file,
      sourceUrl: entry.url,
      sourceAnchor: entry.anchor,
      pageTitle: page.pageTitle,
      pageStatBlockNames: page.statBlocks.map(block => block.name),
      statBlock: matchingStatBlock(entry.name, page.statBlocks, page.rawText),
      rawText: page.rawText
    });
  }

  const deduped = [];
  const idCounts = new Map();
  for (const monster of monsters) {
    const count = idCounts.get(monster.id) ?? 0;
    idCounts.set(monster.id, count + 1);
    deduped.push({
      ...monster,
      id: count === 0 ? monster.id : `${monster.id}_${count + 1}`
    });
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    source: {
      id: manifest.id,
      name: manifest.name,
      sourceSystem: manifest.sourceSystem,
      sourceLicense: manifest.sourceLicense,
      contentLicense: manifest.contentLicense,
      contentLicenseUrl: manifest.contentLicenseUrl,
      sourceUrl: manifest.sourceUrl,
      sourceCopyrightNotice: manifest.sourceCopyrightNotice
    },
    parsedAt: new Date().toISOString(),
    parserVersion: "0.1.0",
    sourcePageCount: files.length,
    monsterCount: deduped.length,
    monsters: deduped
  }, null, 2)}\n`);

  console.log(`Parsed ${deduped.length} SRD 3.5 monster records from ${files.length} pages`);
  console.log(path.relative(root, outputPath));
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
