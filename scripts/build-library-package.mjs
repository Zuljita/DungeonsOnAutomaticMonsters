// SPDX-License-Identifier: MIT
//
// Build the public Dungeons on Automatic Monster Library package from every
// reviewed source: the Enraged Eggplant conversion and the independently
// authored SRD-coverage records.
//
//   npm run promote:library -- --version 0.5.0
//
// One library, one package, one source-book toggle. The package keeps the
// public identity the Enraged Eggplant releases shipped under — the package id
// and the source-book id are consumer-stored keys, not labels (see
// scripts/package-identity.mjs) — so every record is re-shelved onto that
// source book here. Who made each record is not this field's job: originator
// credit travels on every record in provenance.credits, creditLine and
// sourceCopyrightNotice, and per source in manifest.sources.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validatePackage } from "./package-validation.mjs";
import { artRecordMap, readPngMetadata, validateImageManifest } from "./art-validation.mjs";
import { publicPackageIdentity } from "./package-identity.mjs";

const args = process.argv.slice(2);
const valueFor = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const version = valueFor("--version");
const output = resolve(valueFor("--output") ?? "converted/doa-monsters.json");
const combinedArtManifestPath = resolve(valueFor("--art-manifest-output") ?? "converted/library-image-manifest.json");
const latestManifest = resolve(valueFor("--latest-manifest") ?? "packages/latest/manifest.json");
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

if (!version || !versionPattern.test(version)) {
  throw new Error("Provide a release version with --version, for example --version 0.5.0.");
}

const ASSETS_ORIGIN = "https://assets.dungeonsonautomatic.com";
const publicPermissionUrl = "https://dungeonsonautomatic.com/data/monsters/enraged-eggplant-permission.txt";
const publicCreditsUrl = "https://dungeonsonautomatic.com/monster-credits";
const publicDataUrl = `https://dungeonsonautomatic.com/data/monsters/packages/enraged-eggplant-${version}.json`;

/**
 * Everything that differs between the two reviewed sources lives here. A
 * published URL never points into this repository: Enraged Eggplant URLs
 * resolve to the site-hosted permission record, and Monsters on Automatic
 * URLs to the site's credits page and the canonical CC BY 4.0 text.
 */
const SOURCES = [
  {
    key: "enraged-eggplant",
    candidatePath: "converted/enraged-eggplant/doa-monsters.reviewed.json",
    artManifestPath: "art/enraged-eggplant/image-manifest.json",
    gcsDir: "converted/enraged-eggplant",
    artBaseUrl: `${ASSETS_ORIGIN}/monsters/enraged-eggplant`,
    creditUrl: publicPermissionUrl,
    sourceRewrites: { sourceUrl: publicPermissionUrl },
    provenanceRewrites: { sourceUrl: publicPermissionUrl, url: publicPermissionUrl },
    notes: `Authorized for publication by Enraged Eggplant; mechanical review approved for package ${version}.`,
  },
  {
    key: "srd-monsters",
    candidatePath: "converted/srd-monsters/doa-monsters.reviewed.json",
    artManifestPath: "art/srd-monsters/image-manifest.json",
    gcsDir: "converted/srd-monsters",
    artBaseUrl: `${ASSETS_ORIGIN}/monsters/srd-monsters`,
    creditUrl: publicCreditsUrl,
    sourceRewrites: {
      sourceUrl: publicCreditsUrl,
      contentLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
    provenanceRewrites: {
      sourceUrl: publicCreditsUrl,
      url: "https://creativecommons.org/licenses/by/4.0/",
      contentLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
    descriptionRewrites: { contentLicenseUrl: "https://creativecommons.org/licenses/by/4.0/" },
    notes: `Independently authored by Monsters on Automatic; mechanical review approved for package ${version}.`,
  },
];

function publicCredits(credits, url) {
  return (credits ?? []).map(credit => ({ ...credit, url }));
}

function publicFiles(monster, source) {
  for (const [label, local] of [
    ["gct", `${source.gcsDir}/gcs/${monster.provenance.sourceMonsterId}.gct`],
    ["gcs", `${source.gcsDir}/gcs-sheets/${monster.id}.gcs`],
  ]) {
    if (!existsSync(resolve(local))) {
      throw new Error(`Refusing to publish a ${label} URL for ${monster.id}: ${local} does not exist.`);
    }
  }
  return {
    gct: {
      url: `${source.artBaseUrl}/gct/${monster.provenance.sourceMonsterId}.gct`,
      mediaType: "application/json",
      format: "gcs_v5_ancestry_template",
    },
    gcs: {
      url: `${source.artBaseUrl}/gcs/${monster.id}.gcs`,
      mediaType: "application/json",
      format: "gcs_v5_character_sheet",
    },
  };
}

function publicArt(monster, source, artManifest, artByMonsterId) {
  const record = artByMonsterId.get(monster.id);
  if (!record) throw new Error(`Missing art record for ${monster.id}.`);
  const portraitMetadata = readPngMetadata(resolve(record.assets.portrait.assetPath));
  const tokenMetadata = readPngMetadata(resolve(record.assets.token.assetPath));
  const hexTokenMetadata = readPngMetadata(resolve(record.assets.hexToken.assetPath));
  return {
    kind: "ai_generated",
    generator: artManifest.generator,
    styleId: artManifest.styleId,
    portrait: {
      url: `${source.artBaseUrl}/portraits/${monster.id}.png`,
      alt: `${monster.name} bestiary portrait`,
      mediaType: "image/png",
      width: portraitMetadata.width,
      height: portraitMetadata.height,
      promptSha256: record.assets.portrait.promptSha256,
    },
    token: {
      url: `${source.artBaseUrl}/tokens/${monster.id}.png`,
      alt: `${monster.name} top-down encounter token`,
      mediaType: "image/png",
      width: tokenMetadata.width,
      height: tokenMetadata.height,
      view: "top_down",
      grid: "flat_top_hex",
      transparent: true,
      footprint: monster.size?.hexes ?? "1 hex",
      promptSha256: record.assets.token.promptSha256,
    },
    hexToken: {
      url: `${source.artBaseUrl}/hex-tokens/${monster.id}.png`,
      alt: `${monster.name} top-down flat-top hex token`,
      mediaType: "image/png",
      width: hexTokenMetadata.width,
      height: hexTokenMetadata.height,
      view: "top_down",
      grid: "flat_top_hex",
      shape: "flat_top_hex",
      transparent: true,
      footprint: monster.size?.hexes ?? "1 hex",
      promptSha256: record.assets.hexToken.sourcePromptSha256,
      derivedFrom: "token",
      derivationStyleId: record.assets.hexToken.derivationStyleId,
    },
  };
}

const publishedSources = SOURCES.map(source => {
  const candidate = JSON.parse(readFileSync(resolve(source.candidatePath), "utf8"));
  const candidateErrors = validatePackage(candidate, { allowUnapproved: true });
  if (candidateErrors.length > 0) {
    throw new Error(`${source.key} candidate package is invalid:\n${candidateErrors.join("\n")}`);
  }
  const unapproved = candidate.monsters.filter(monster => monster.provenance?.manualReviewStatus !== "approved");
  if (unapproved.length > 0) {
    const examples = unapproved.slice(0, 10).map(monster => monster.id).join(", ");
    throw new Error(
      `Refusing to publish ${source.key}: ${unapproved.length} of ${candidate.monsters.length} records are `
        + `not approved. Examples: ${examples}`,
    );
  }

  const artManifest = JSON.parse(readFileSync(resolve(source.artManifestPath), "utf8"));
  const artErrors = validateImageManifest({
    manifest: artManifest,
    candidate,
    repoRoot: resolve("."),
    requireComplete: true,
    artPackage: source.key,
  });
  if (artErrors.length > 0) {
    throw new Error(`Refusing to publish incomplete or invalid ${source.key} art:\n${artErrors.join("\n")}`);
  }
  const artByMonsterId = artRecordMap(artManifest);

  return { source, candidate, artManifest, artByMonsterId };
});

// The library's identity comes from the first source's candidate, exactly as
// the single-source promote took it: publicPackageIdentity preserves the
// consumer-stored package and source-book keys and restyles only the labels.
const identity = publicPackageIdentity(publishedSources[0].candidate.manifest);

const monsters = publishedSources.flatMap(({ source, candidate, artManifest, artByMonsterId }) =>
  candidate.monsters.map(monster => ({
    ...monster,
    sourceBook: identity.sourceBook.id,
    sourceBooks: [identity.sourceBook.id],
    art: publicArt(monster, source, artManifest, artByMonsterId),
    files: publicFiles(monster, source),
    ...(source.descriptionRewrites && monster.description
      ? { description: { ...monster.description, ...source.descriptionRewrites } }
      : {}),
    provenance: {
      ...monster.provenance,
      ...source.provenanceRewrites,
      credits: publicCredits(monster.provenance.credits, source.creditUrl),
      notes: source.notes,
    },
  })),
);

const manifestSources = publishedSources.flatMap(({ source, candidate }) =>
  candidate.manifest.sources.map(entry => ({
    ...entry,
    ...source.sourceRewrites,
    credits: publicCredits(entry.credits, source.creditUrl),
  })),
);

const manifestCredits = publishedSources.flatMap(({ source, candidate }) =>
  publicCredits(candidate.manifest.credits, source.creditUrl),
);

const artCounts = key => publishedSources.reduce(
  (total, { artManifest }) => total + artManifest.counts[key].generated,
  0,
);

const combinedArtManifest = {
  schemaVersion: 2,
  library: identity.name,
  counts: {
    monsters: monsters.length,
    portrait: { generated: artCounts("portrait"), pending: 0 },
    token: { generated: artCounts("token"), pending: 0 },
    hexToken: { generated: artCounts("hexToken"), pending: 0 },
  },
  sources: publishedSources.map(({ source, artManifest }) => ({
    id: source.key,
    baseUrl: source.artBaseUrl,
    manifestUrl: `${source.artBaseUrl}/image-manifest.json`,
    generator: artManifest.generator,
    styleId: artManifest.styleId,
    counts: artManifest.counts,
  })),
};

const published = {
  manifest: {
    ...publishedSources[0].candidate.manifest,
    ...identity,
    version,
    dataUrl: publicDataUrl,
    art: {
      manifestUrl: `${ASSETS_ORIGIN}/monsters/image-manifest.json`,
      baseUrl: `${ASSETS_ORIGIN}/monsters`,
      generator: publishedSources[0].artManifest.generator,
      styleId: publishedSources[0].artManifest.styleId,
      portraitCount: artCounts("portrait"),
      tokenCount: artCounts("token"),
      hexTokenCount: artCounts("hexToken"),
    },
    credits: manifestCredits,
    sources: manifestSources,
  },
  monsters,
};

const publishedErrors = validatePackage(published);
if (publishedErrors.length > 0) {
  throw new Error(`Published package is invalid:\n${publishedErrors.join("\n")}`);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(published, null, 2)}\n`, "utf8");
writeFileSync(combinedArtManifestPath, `${JSON.stringify(combinedArtManifest, null, 2)}\n`, "utf8");

const latest = {
  id: "latest",
  version,
  status: "approved",
  package: {
    path: "../../converted/doa-monsters.json",
    publicUrl: publicDataUrl,
  },
  schema: {
    path: "../../schema/monster.schema.json",
  },
  art: {
    path: "../../converted/library-image-manifest.json",
    publicUrl: `${ASSETS_ORIGIN}/monsters/image-manifest.json`,
    sources: SOURCES.map(source => ({
      path: `../../${source.artManifestPath}`,
      publicUrl: `${source.artBaseUrl}/image-manifest.json`,
    })),
  },
  sources: [
    "../../sources/enraged-eggplant/manifest.json",
    "../../sources/monsters-on-automatic/manifest.json",
  ],
};
mkdirSync(dirname(latestManifest), { recursive: true });
writeFileSync(latestManifest, `${JSON.stringify(latest, null, 2)}\n`, "utf8");

const bySource = publishedSources.map(({ source, candidate }) => `${candidate.monsters.length} ${source.key}`);
console.log(`Built library package ${version} with ${monsters.length} approved records (${bySource.join(", ")}).`);
