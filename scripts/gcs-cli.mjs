// SPDX-License-Identifier: MIT
//
// Locate and drive the GCS desktop application headlessly.
//
// GCS exposes `-convert`, one of three modes that "take over the process and
// exit" without opening a window. Loading a sheet and re-saving it is what
// makes GCS write the `calc` block and the resolved `calc.value` on every
// attribute: our generated sheets record what a creature *is* (an ancestry
// container plus individual adjustments), and only GCS knows what that
// evaluates to. Converting all 304 sheets takes under three seconds.
//
// GCS is a build-time verifier, not a build-time dependency: the committed
// ancestry baseline lets `build-gcs-sheets.mjs` run anywhere, and only
// regenerating that baseline or running the verification gate needs the binary.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Documented install locations, in the order a build machine is likely to have them. */
const CANDIDATES = {
  win32: ["C:/Program Files/GCS/gcs.exe", "C:/Program Files (x86)/GCS/gcs.exe"],
  darwin: ["/Applications/GCS.app/Contents/MacOS/gcs"],
  linux: ["/usr/bin/gcs", "/usr/local/bin/gcs", "/opt/gcs/gcs"],
};

export class GcsUnavailableError extends Error {}

/**
 * @returns {string} path to the GCS binary
 * @throws {GcsUnavailableError} when no install is found
 */
export function findGcs() {
  const configured = process.env.GCS_BIN;
  if (configured) {
    if (existsSync(configured)) return configured;
    throw new GcsUnavailableError(`GCS_BIN is set to ${configured} but nothing is there.`);
  }
  const found = (CANDIDATES[process.platform] ?? []).find(path => existsSync(path));
  if (found) return found;
  throw new GcsUnavailableError(
    `No GCS install found for ${process.platform}. Install GCS 5.x or set GCS_BIN to its binary.`,
  );
}

/**
 * Convert every GCS file under `dir` in place, resolving each sheet's derived
 * values. Destructive by design — always point it at a copy.
 *
 * @param {string} dir
 * @returns {number} files processed, as GCS reports them
 */
export function convertInPlace(dir) {
  const output = execFileSync(findGcs(), ["-convert", dir], { encoding: "utf8" });
  return Number(output.match(/Processed (\d+) file/)?.[1] ?? 0);
}
