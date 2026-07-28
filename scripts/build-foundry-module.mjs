// SPDX-License-Identifier: MIT
//
// Build the Foundry VTT module directory from the published package.
//
//   node scripts/build-foundry-module.mjs [--input converted/doa-monsters.json]
//     [--out dist/foundry] [--pack] [--zip] [--update-latest-manifest]
//
// Always emits module.json plus one source JSON per Actor. --pack compiles the
// LevelDB compendium with the official @foundryvtt/foundryvtt-cli (fetched via
// npx; the repository itself stays dependency-free). --zip archives the module
// directory for release. --update-latest-manifest records the artifact — with
// its sha256 — in packages/latest/manifest.json the way the package and art
// artifacts are recorded.

import { createHash } from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  FOUNDRY_BASE_URL,
  FOUNDRY_COMPATIBILITY,
  MODULE_ID,
  PACK_NAME,
  buildFoundryModule,
  validateFoundryModule,
} from "./foundry-module.mjs";

const args = process.argv.slice(2);
const valueFor = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const input = resolve(valueFor("--input") ?? "converted/doa-monsters.json");
const outRoot = resolve(valueFor("--out") ?? "dist/foundry");
const latestManifestPath = resolve(valueFor("--latest-manifest") ?? "packages/latest/manifest.json");

const pkg = JSON.parse(readFileSync(input, "utf8"));
const module_ = buildFoundryModule(pkg);
const errors = validateFoundryModule(module_, pkg);
if (errors.length > 0) {
  throw new Error(`Refusing to build an invalid Foundry module:\n${errors.join("\n")}`);
}

const moduleDir = join(outRoot, MODULE_ID);
const sourceDir = join(moduleDir, "packs-source", PACK_NAME);
rmSync(moduleDir, { recursive: true, force: true });
mkdirSync(sourceDir, { recursive: true });

writeFileSync(join(moduleDir, "module.json"), `${JSON.stringify(module_.manifest, null, 2)}\n`, "utf8");
for (const actor of module_.actors) {
  writeFileSync(join(sourceDir, `${actor._id}.json`), `${JSON.stringify(actor, null, 2)}\n`, "utf8");
}
console.log(`Emitted ${module_.actors.length} Actor sources and module.json to ${moduleDir}`);

if (args.includes("--pack")) {
  const packsDir = join(moduleDir, "packs");
  mkdirSync(packsDir, { recursive: true });
  runPackageRunner([
    "@foundryvtt/foundryvtt-cli",
    "package",
    "pack",
    PACK_NAME,
    "--in",
    sourceDir,
    "--out",
    packsDir,
  ]);
  console.log(`Compiled LevelDB pack at ${join(packsDir, PACK_NAME)}`);
}

/**
 * Run `npx --yes <args>` without handing an argument array to a shell (#51).
 * Under an npm script, npm_execpath lets us invoke npm's own entry point with
 * node directly — no shell, no .cmd shim. Outside npm, Windows needs a shell
 * to run the npx.cmd shim, so the command is built as one explicitly quoted
 * string; every argument here is a tracked constant or a path this script
 * resolved itself, and anything quote-bearing is refused outright.
 */
function runPackageRunner(cliArgs) {
  if (process.env.npm_execpath) {
    execFileSync(
      process.execPath,
      [process.env.npm_execpath, "exec", "--yes", "--", ...cliArgs],
      { stdio: "inherit" },
    );
    return;
  }
  if (process.platform === "win32") {
    for (const arg of cliArgs) {
      if (/["']/.test(arg)) throw new Error(`Refusing to shell-quote an argument containing quotes: ${arg}`);
    }
    execSync(["npx", "--yes", ...cliArgs].map(arg => `"${arg}"`).join(" "), { stdio: "inherit" });
    return;
  }
  execFileSync("npx", ["--yes", ...cliArgs], { stdio: "inherit" });
}

let zipPath;
if (args.includes("--zip")) {
  const version = module_.manifest.version;
  zipPath = join(outRoot, `${MODULE_ID}-${version}.zip`);
  rmSync(zipPath, { force: true });
  // The zip roots at the module directory contents, which is what Foundry's
  // installer expects the download to contain. Paths travel as environment
  // variables so nothing is interpolated into the PowerShell command (#51).
  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      ["-NoProfile", "-Command",
        "Get-ChildItem -LiteralPath $env:DOA_ZIP_SOURCE | Compress-Archive -DestinationPath $env:DOA_ZIP_DEST"],
      { env: { ...process.env, DOA_ZIP_SOURCE: moduleDir, DOA_ZIP_DEST: zipPath } },
    );
  } else {
    execFileSync("zip", ["-qr", zipPath, "."], { cwd: moduleDir });
  }
  console.log(`Archived module to ${zipPath}`);
}

if (args.includes("--update-latest-manifest")) {
  if (!zipPath) throw new Error("--update-latest-manifest requires --zip so the checksum covers the released artifact.");
  const sha256 = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
  const latest = JSON.parse(readFileSync(latestManifestPath, "utf8"));
  const version = module_.manifest.version;
  latest.foundryModule = {
    id: MODULE_ID,
    format: "foundry_vtt_module",
    system: "gurps",
    foundryCompatibility: { ...FOUNDRY_COMPATIBILITY },
    version,
    manifestUrl: `${FOUNDRY_BASE_URL}/module.json`,
    downloadUrl: `${FOUNDRY_BASE_URL}/${MODULE_ID}-${version}.zip`,
    sha256,
    provenance: "Built from converted/doa-monsters.json by scripts/build-foundry-module.mjs; approved records only.",
  };
  writeFileSync(latestManifestPath, `${JSON.stringify(latest, null, 2)}\n`, "utf8");
  console.log(`Recorded foundryModule artifact (sha256 ${sha256.slice(0, 12)}…) in ${latestManifestPath}`);
}
