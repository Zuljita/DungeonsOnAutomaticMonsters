import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  repoRoot,
  "converted",
  "srd-monsters",
  "doa-monsters.review-required.json",
);
const artPackage = "srd-monsters";
const artRoot = path.join(repoRoot, "art", artPackage);
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
  /appearance|arm|beak|body|claw|eye|fang|fire|flame|fur|gill|head|hoof|horn|leg|membrane|neck|scale|shell|skin|smoke|spine|tail|teeth|tentacle|trunk|wing/i;

function list(items, fallback = "none recorded") {
  return items.length > 0 ? items.join("; ") : fallback;
}

function visualTraits(monster) {
  return (monster.stats?.traits ?? [])
    .filter((trait) => visualTraitPattern.test(trait))
    .slice(0, 12);
}

function combatCues(monster) {
  return (monster.stats?.attacks ?? [])
    .slice(0, 4)
    .map((attack) => attack.name);
}

function scaleCues(monster) {
  const sizeNote = (monster.stats?.notes ?? []).find((note) => /^Size\b/i.test(note));
  return [
    monster.size?.modifier ? `size modifier ${monster.size.modifier}` : null,
    monster.size?.hexes,
    monster.size?.massKg ? `${monster.size.massKg} kg` : null,
    sizeNote,
  ]
    .filter(Boolean)
    .join(", ");
}

function subjectCount(monster) {
  return monster.class === "Swarm"
    ? "one cohesive swarm encounter entity, with its constituent animals or vermin forming a single readable group"
    : `exactly one ${monster.name}`;
}

function creatureBrief(monster) {
  return monster.description?.text
    ?? "Use the creature's name, class, physical traits, attacks, and scale as the complete design brief.";
}

function buildPortraitPrompt(monster) {
  return [
    "Use case: stylized-concept.",
    "Asset type: square dark-fantasy bestiary portrait.",
    `Primary request: create an original full-body portrait of ${subjectCount(monster)}.`,
    `Creature class: ${monster.class ?? "fantasy creature"}.`,
    `Creature brief: ${creatureBrief(monster)}`,
    `Scale cues: ${scaleCues(monster) || "unspecified"}.`,
    `Distinctive anatomical cues from the game record: ${list(visualTraits(monster))}.`,
    `Combat or equipment cues: ${list(combatCues(monster))}.`,
    "Composition: readable three-quarter full-body view with a strong silhouette, complete anatomy visible, and generous crop-safe edge padding.",
    "Style/medium: richly textured painterly realism with restrained natural colors, cinematic directional light, atmospheric depth, and a setting appropriate to the creature that does not obscure it.",
    "Treat the record as the complete design brief. Make the visual design original and do not reproduce an existing published monster illustration.",
    "No extra creature outside a swarm, duplicate head or limb, modern object, words, lettering, labels, border, card frame, logo, signature, watermark, UI, or graphic-design mockup.",
  ].join(" ");
}

function tokenChromaKey(monster) {
  const cues = [
    monster.name,
    monster.class,
    creatureBrief(monster),
    ...(monster.stats?.traits ?? []),
    ...(monster.stats?.attacks ?? []).map((attack) => attack.name),
  ].join(" ");
  return /acid|fung|green|mold|moss|ooze|plant|slime|swamp|veget|vine/i.test(cues)
    ? "#ff00ff"
    : "#00ff00";
}

function buildTokenPrompt(monster) {
  const chromaKey = tokenChromaKey(monster);
  return [
    "Use case: stylized-concept.",
    "Asset type: strict top-down fantasy encounter-map token on a square 1:1 canvas.",
    `Primary request: create an original overhead token of ${subjectCount(monster)}, facing the top edge.`,
    `Creature class: ${monster.class ?? "fantasy creature"}.`,
    `Creature brief: ${creatureBrief(monster)}`,
    `Game footprint and scale: ${monster.size?.hexes ?? "1 hex"}; size modifier ${monster.size?.modifier ?? "+0"}.`,
    `Distinctive anatomical cues from the game record: ${list(visualTraits(monster))}.`,
    `Combat or equipment cues: ${list(combatCues(monster))}.`,
    "Camera and composition: exactly 90 degrees overhead and orthographic, with the complete silhouette, every limb, carried item, wing, and tail visible inside generous padding. Show only dorsal or top planes, never a front-facing portrait, side view, or perspective view.",
    "Compose the silhouette to read clearly on a flat-top hex grid; do not draw a hex outline or base.",
    `Scene/backdrop: perfectly flat solid ${chromaKey} chroma-key background for local removal, uniform with no shadows, gradients, texture, reflections, floor plane, scenery, or lighting variation.`,
    `Style/medium: richly textured painterly game-token realism, readable map lighting, crisp opaque subject edges, and do not use ${chromaKey} anywhere in the subject.`,
    "Treat the record as the complete design brief. Make the visual design original and do not reproduce an existing published monster illustration.",
    "No extra creature outside a swarm, duplicate head or limb, words, lettering, labels, border, frame, logo, signature, watermark, UI, scenery, contact shadow, cast shadow, or reflection.",
  ].join(" ");
}

function promptSha256(prompt) {
  return createHash("sha256").update(prompt).digest("hex");
}

fs.mkdirSync(portraitsRoot, { recursive: true });
fs.mkdirSync(tokensRoot, { recursive: true });
fs.mkdirSync(hexTokensRoot, { recursive: true });

const records = monsters.map((monster) => {
  const filename = `${monster.id}.png`;
  const portraitPath = path.posix.join("art", artPackage, "portraits", filename);
  const tokenPath = path.posix.join("art", artPackage, "tokens", filename);
  const hexTokenPath = path.posix.join("art", artPackage, "hex-tokens", filename);
  const portraitPrompt = [
    promptOverrides[monster.id]?.portrait ?? buildPortraitPrompt(monster),
    promptOverrides[monster.id]?.portraitCorrection,
  ]
    .filter(Boolean)
    .join(" ");
  const tokenPrompt = [
    promptOverrides[monster.id]?.token ?? buildTokenPrompt(monster),
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
        status: fs.existsSync(path.join(portraitsRoot, filename)) ? "generated" : "pending",
        prompt: portraitPrompt,
        promptSha256: promptSha256(portraitPrompt),
      },
      token: {
        assetPath: tokenPath,
        status: fs.existsSync(path.join(tokensRoot, filename)) ? "generated" : "pending",
        chromaKey: tokenChromaKey(monster),
        prompt: tokenPrompt,
        promptSha256: promptSha256(tokenPrompt),
      },
      hexToken: {
        assetPath: hexTokenPath,
        status: fs.existsSync(path.join(hexTokensRoot, filename)) ? "generated" : "pending",
        derivedFrom: tokenPath,
        derivationStyleId: "doa-flat-top-hex-v2",
        sourcePromptSha256: promptSha256(tokenPrompt),
      },
    },
  };
});

const generatedCount = (assetType) => records.filter(
  (record) => record.assets[assetType].status === "generated",
).length;
const portraitGenerated = generatedCount("portrait");
const tokenGenerated = generatedCount("token");
const hexTokenGenerated = generatedCount("hexToken");

const manifest = {
  schemaVersion: 2,
  sourcePackage: path.posix.join(
    "converted",
    "srd-monsters",
    "doa-monsters.review-required.json",
  ),
  publicBaseUrl: "https://assets.dungeonsonautomatic.com/monsters/srd-monsters",
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
  `Wrote ${path.relative(repoRoot, manifestPath)} `
    + `(${portraitGenerated}/${records.length} portraits, `
    + `${tokenGenerated}/${records.length} tokens, `
    + `${hexTokenGenerated}/${records.length} hex tokens generated).`,
);
