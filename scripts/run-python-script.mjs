// SPDX-License-Identifier: MIT

import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/run-python-script.mjs <script.py> [args...]");
  process.exit(1);
}

const args = process.argv.slice(3);
const codexPython = path.join(
  os.homedir(),
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe"
);

const candidates = [
  process.env.PYTHON,
  process.env.CODEX_PYTHON,
  existsSync(codexPython) ? codexPython : null,
  "python",
  "python3",
  "py"
].filter(Boolean);

let lastError = null;
for (const command of candidates) {
  const commandArgs = command === "py" ? ["-3", script, ...args] : [script, ...args];
  const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: false });

  if (result.error) {
    lastError = result.error;
    continue;
  }

  process.exit(result.status ?? 0);
}

console.error(`Unable to run Python script ${script}.`);
if (lastError) console.error(lastError.message);
process.exit(1);
