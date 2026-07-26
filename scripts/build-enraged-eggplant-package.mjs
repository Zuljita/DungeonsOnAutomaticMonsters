import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validatePackage } from "./package-validation.mjs";
import { artRecordMap, readPngMetadata, validateImageManifest } from "./art-validation.mjs";

const args = process.argv.slice(2);
const valueFor = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const version = valueFor("--version");
const input = resolve(valueFor("--input") ?? "converted/enraged-eggplant/doa-monsters.review-required.json");
const output = resolve(valueFor("--output") ?? "converted/doa-monsters.json");
const latestManifest = resolve(valueFor("--latest-manifest") ?? "packages/latest/manifest.json");
const artManifestPath = resolve(valueFor("--art-manifest") ?? "art/enraged-eggplant/image-manifest.json");
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

if (!version || !versionPattern.test(version)) {
  throw new Error("Provide a release version with --version, for example --version 0.2.0.");
}

const candidate = JSON.parse(readFileSync(input, "utf8"));
const candidateErrors = validatePackage(candidate, { allowUnapproved: true });
if (candidateErrors.length > 0) {
  throw new Error(`Candidate package is invalid:\n${candidateErrors.join("\n")}`);
}

const unapproved = candidate.monsters.filter(monster => monster.provenance?.manualReviewStatus !== "approved");
if (unapproved.length > 0) {
  const examples = unapproved.slice(0, 10).map(monster => monster.id).join(", ");
  throw new Error(
    `Refusing to publish: ${unapproved.length} of ${candidate.monsters.length} records are not approved. `
      + `Examples: ${examples}`,
  );
}

const artManifest = JSON.parse(readFileSync(artManifestPath, "utf8"));
const artErrors = validateImageManifest({
  manifest: artManifest,
  candidate,
  repoRoot: resolve("."),
  requireComplete: true,
});
if (artErrors.length > 0) {
  throw new Error(`Refusing to publish incomplete or invalid monster art:\n${artErrors.join("\n")}`);
}
const artByMonsterId = artRecordMap(artManifest);

const publicPermissionUrl = "https://dungeonsonautomatic.com/data/monsters/enraged-eggplant-permission.txt";
const publicDataUrl = `https://dungeonsonautomatic.com/data/monsters/packages/enraged-eggplant-${version}.json`;
const publicArtBaseUrl = "https://dungeonsonautomatic.com/assets/monsters/enraged-eggplant";

function publicArt(monster) {
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
      url: `${publicArtBaseUrl}/portraits/${monster.id}.png`,
      alt: `${monster.name} bestiary portrait`,
      mediaType: "image/png",
      width: portraitMetadata.width,
      height: portraitMetadata.height,
      promptSha256: record.assets.portrait.promptSha256,
    },
    token: {
      url: `${publicArtBaseUrl}/tokens/${monster.id}.png`,
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
      url: `${publicArtBaseUrl}/hex-tokens/${monster.id}.png`,
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

const published = {
  manifest: {
    ...candidate.manifest,
    id: "enraged-eggplant-monsters",
    name: "Enraged Eggplant Monster Library",
    version,
    licenseSummary: "Fan-authored GURPS monster statistics adapted and republished with unrestricted author permission; attribution retained.",
    packageUrl: "https://dungeonsonautomatic.com/monsters.html",
    dataUrl: publicDataUrl,
    art: {
      manifestUrl: `${publicArtBaseUrl}/image-manifest.json`,
      baseUrl: publicArtBaseUrl,
      generator: artManifest.generator,
      styleId: artManifest.styleId,
      portraitCount: artManifest.counts.portrait.generated,
      tokenCount: artManifest.counts.token.generated,
      hexTokenCount: artManifest.counts.hexToken.generated,
    },
    sources: candidate.manifest.sources.map(source => ({
      ...source,
      sourceUrl: publicPermissionUrl,
    })),
  },
  monsters: candidate.monsters.map(monster => ({
    ...monster,
    art: publicArt(monster),
    provenance: {
      ...monster.provenance,
      sourceUrl: publicPermissionUrl,
      url: publicPermissionUrl,
      notes: `Authorized for publication by Enraged Eggplant; mechanical review approved for package ${version}.`,
    },
  })),
};

const publishedErrors = validatePackage(published);
if (publishedErrors.length > 0) {
  throw new Error(`Published package is invalid:\n${publishedErrors.join("\n")}`);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(published, null, 2)}\n`, "utf8");

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
    path: "../../art/enraged-eggplant/image-manifest.json",
    publicUrl: `${publicArtBaseUrl}/image-manifest.json`,
  },
  sources: ["../../sources/enraged-eggplant/manifest.json"],
};
mkdirSync(dirname(latestManifest), { recursive: true });
writeFileSync(latestManifest, `${JSON.stringify(latest, null, 2)}\n`, "utf8");

console.log(`Built Enraged Eggplant package ${version} with ${published.monsters.length} approved records.`);
