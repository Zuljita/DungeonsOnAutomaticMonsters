import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describeLocalFile } from "./art-files.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  repoRoot,
  "converted",
  "enraged-eggplant",
  "doa-monsters.review-required.json",
);
const artRoot = path.join(repoRoot, "art", "enraged-eggplant");
const portraitsRoot = path.join(artRoot, "portraits");
const tokensRoot = path.join(artRoot, "tokens");
const hexTokensRoot = path.join(artRoot, "hex-tokens");
const manifestPath = path.join(artRoot, "image-manifest.json");
const promptOverridesPath = path.join(artRoot, "prompt-overrides.json");

const packageData = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const monsters = packageData.monsters ?? [];
const promptOverrides = fs.existsSync(promptOverridesPath)
  ? JSON.parse(fs.readFileSync(promptOverridesPath, "utf8"))
  : {};

const visualTraitPattern =
  /appearance|arm|beak|body|claw|eye|fang|fire|flame|fur|gill|head|hoof|horn|leg|membrane|neck|scale|shell|skin|smoke|spine|tail|teeth|tentacle|wing/i;

function list(items, fallback = "none recorded") {
  return items.length > 0 ? items.join("; ") : fallback;
}

function buildPrompt(monster) {
  const visualTraits = (monster.stats?.traits ?? [])
    .filter((trait) => visualTraitPattern.test(trait))
    .slice(0, 10);
  const attacks = (monster.stats?.attacks ?? [])
    .slice(0, 3)
    .map((attack) => attack.name);
  const sizeNote = (monster.stats?.notes ?? []).find((note) => /^Size\b/i.test(note));
  const size = [
    monster.size?.modifier ? `size modifier ${monster.size.modifier}` : null,
    monster.size?.hexes,
    sizeNote,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `Create an original square dark-fantasy bestiary portrait of ${monster.name}.`,
    `Creature type: ${monster.class ?? "fantasy monster"}.`,
    `Scale cues: ${size || "unspecified"}.`,
    `Distinctive anatomical cues from the game record: ${list(visualTraits)}.`,
    `Combat cues: ${list(attacks)}.`,
    "Show one creature in a readable three-quarter full-body view with a strong silhouette and enough edge padding for responsive cropping.",
    "Use richly textured painterly realism, restrained natural colors, cinematic directional light, atmospheric depth, and a setting that supports the creature without obscuring it.",
    "Treat the stat record as design inspiration only. Make the visual design original and do not reproduce any existing published monster illustration.",
    "No words, lettering, labels, border, card frame, logo, signature, watermark, UI, or graphic-design mockup.",
  ].join(" ");
}

function buildTokenPrompt(monster) {
  const visualTraits = (monster.stats?.traits ?? [])
    .filter((trait) => visualTraitPattern.test(trait))
    .slice(0, 10);
  const attacks = (monster.stats?.attacks ?? [])
    .slice(0, 3)
    .map((attack) => attack.name);
  const footprint = monster.size?.hexes ?? "1 hex";
  const chromaKey = tokenChromaKey(monster);

  return [
    "Use case: stylized-concept.",
    "Asset type: top-down fantasy encounter-map token.",
    `Primary request: create an original token of ${monster.name}.`,
    `Creature type: ${monster.class ?? "fantasy monster"}.`,
    `Game footprint: ${footprint}; size modifier ${monster.size?.modifier ?? "+0"}.`,
    `Distinctive anatomical cues from the game record: ${list(visualTraits)}.`,
    `Combat cues: ${list(attacks)}.`,
    "Use a square 1:1 canvas and a strict 90-degree overhead orthographic view, with the creature facing the top of the canvas and its complete body and every limb visible.",
    "Compose the silhouette to read clearly on a flat-top hex grid; keep all important anatomy inside generous padding and do not draw a hex outline or base.",
    `Scene/backdrop: a perfectly flat solid ${chromaKey} chroma-key background for local background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.`,
    `Use richly textured painterly realism, restrained natural colors, readable game-map lighting, crisp subject edges, and do not use ${chromaKey} anywhere in the creature.`,
    "Treat the stat record as design inspiration only. Make the visual design original and do not reproduce any existing published monster illustration.",
    "No perspective camera, side view, portrait pose, words, lettering, labels, border, frame, logo, signature, watermark, UI, scenery, floor texture, contact shadow, cast shadow, or reflection.",
  ].join(" ");
}

function tokenChromaKey(monster) {
  const cues = [
    monster.name,
    monster.class,
    ...(monster.stats?.traits ?? []),
    ...(monster.stats?.attacks ?? []).map((attack) => attack.name),
  ].join(" ");
  return /acid|fung|green|mold|moss|ooze|plant|slime|swamp|veget|vine/i.test(cues)
    ? "#ff00ff"
    : "#00ff00";
}

/**
 * Where an asset stands, as the manifest records it: generated assets carry
 * their byte length and sha256 so the validator (without a local copy), CI
 * (without LFS) and the R2 verifier can check the published object against
 * the manifest without touching pixels. Pending assets carry neither.
 */
async function assetState(filePath) {
  const described = await describeLocalFile(filePath);
  return described ? { status: "generated", ...described } : { status: "pending" };
}

function promptSha256(prompt) {
  return createHash("sha256").update(prompt).digest("hex");
}

fs.mkdirSync(portraitsRoot, { recursive: true });
fs.mkdirSync(tokensRoot, { recursive: true });
fs.mkdirSync(hexTokensRoot, { recursive: true });

const records = await Promise.all(monsters.map(async (monster) => {
  const filename = `${monster.id}.png`;
  const portraitPath = path.posix.join("art", "enraged-eggplant", "portraits", filename);
  const tokenPath = path.posix.join("art", "enraged-eggplant", "tokens", filename);
  const hexTokenPath = path.posix.join("art", "enraged-eggplant", "hex-tokens", filename);
  const portraitPromptBase = promptOverrides[monster.id]?.portrait ?? buildPrompt(monster);
  const portraitPrompt = [
    portraitPromptBase,
    promptOverrides[monster.id]?.portraitCorrection,
  ]
    .filter(Boolean)
    .join(" ");
  const tokenPromptBase = promptOverrides[monster.id]?.token ?? buildTokenPrompt(monster);
  const tokenPrompt = [
    tokenPromptBase,
    promptOverrides[monster.id]?.tokenCorrection,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    monsterId: monster.id,
    name: monster.name,
    sourceStatus: monster.provenance?.manualReviewStatus ?? null,
    assets: {
      portrait: {
        assetPath: portraitPath,
        ...(await assetState(path.join(portraitsRoot, filename))),
        prompt: portraitPrompt,
        promptSha256: promptSha256(portraitPrompt),
      },
      token: {
        assetPath: tokenPath,
        ...(await assetState(path.join(tokensRoot, filename))),
        chromaKey: tokenChromaKey(monster),
        prompt: tokenPrompt,
        promptSha256: promptSha256(tokenPrompt),
      },
      hexToken: {
        assetPath: hexTokenPath,
        ...(await assetState(path.join(hexTokensRoot, filename))),
        derivedFrom: tokenPath,
        derivationStyleId: "doa-flat-top-hex-v2",
        sourcePromptSha256: promptSha256(tokenPrompt),
      },
    },
  };
}));

const portraitGenerated = records.filter(
  (record) => record.assets.portrait.status === "generated",
).length;
const tokenGenerated = records.filter(
  (record) => record.assets.token.status === "generated",
).length;
const hexTokenGenerated = records.filter(
  (record) => record.assets.hexToken.status === "generated",
).length;
const manifest = {
  schemaVersion: 2,
  sourcePackage: path.posix.join(
    "converted",
    "enraged-eggplant",
    "doa-monsters.review-required.json",
  ),
  generator: "OpenAI image generation",
  styleId: "doa-dark-fantasy-bestiary-v1",
  outputs: {
    portrait: {
      format: "png",
      aspectRatio: "1:1",
      background: "scene",
      filenameKey: "monster.id",
    },
    token: {
      format: "png",
      aspectRatio: "1:1",
      camera: "orthographic-top-down",
      grid: "flat-top-hex",
      background: "transparent",
      transparencyWorkflow: "built-in-chroma-key-local-removal",
      filenameKey: "monster.id",
    },
    hexToken: {
      format: "png",
      aspectRatio: "1:1",
      camera: "orthographic-top-down",
      grid: "flat-top-hex",
      shape: "flat-top-hex",
      background: "transparent-outside-hex",
      derivedFrom: "token",
      derivationStyleId: "doa-flat-top-hex-v2",
      filenameKey: "monster.id",
    },
  },
  counts: {
    monsters: records.length,
    portrait: {
      generated: portraitGenerated,
      pending: records.length - portraitGenerated,
    },
    token: {
      generated: tokenGenerated,
      pending: records.length - tokenGenerated,
    },
    hexToken: {
      generated: hexTokenGenerated,
      pending: records.length - hexTokenGenerated,
    },
  },
  records,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${path.relative(repoRoot, manifestPath)} (${portraitGenerated}/${records.length} portraits, ${tokenGenerated}/${records.length} tokens, ${hexTokenGenerated}/${records.length} hex tokens generated).`,
);
