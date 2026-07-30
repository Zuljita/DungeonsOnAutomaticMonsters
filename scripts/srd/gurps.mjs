// SPDX-License-Identifier: MIT
//
// The GURPS 4e arithmetic the SRD-coverage builds need: the damage table, skill
// point costs, and the derived-statistic rules.
//
// Only the arithmetic lives here. No rules prose is reproduced; these are the
// published numbers a GM already has, implemented so that a record's Typical
// Stats, its .gct point total, and its .gcs sheet all come out of one place and
// cannot drift from each other.

import { createHash } from "node:crypto";

/**
 * Thrust and swing damage by ST. Entries at and below ST 40 are exact; above it
 * the table is published in steps of five, so a ST that falls between two steps
 * uses the lower one, which is how the table is read at the table.
 */
const DAMAGE_TABLE = new Map([
  [1, ["1d-6", "1d-5"]], [2, ["1d-6", "1d-5"]], [3, ["1d-5", "1d-4"]], [4, ["1d-5", "1d-4"]],
  [5, ["1d-4", "1d-3"]], [6, ["1d-4", "1d-3"]], [7, ["1d-3", "1d-2"]], [8, ["1d-3", "1d-2"]],
  [9, ["1d-2", "1d-1"]], [10, ["1d-2", "1d"]], [11, ["1d-1", "1d+1"]], [12, ["1d-1", "1d+2"]],
  [13, ["1d", "2d-1"]], [14, ["1d", "2d"]], [15, ["1d+1", "2d+1"]], [16, ["1d+1", "2d+2"]],
  [17, ["1d+2", "3d-1"]], [18, ["1d+2", "3d"]], [19, ["2d-1", "3d+1"]], [20, ["2d-1", "3d+2"]],
  [21, ["2d", "4d-1"]], [22, ["2d", "4d"]], [23, ["2d+1", "4d+1"]], [24, ["2d+1", "4d+2"]],
  [25, ["2d+2", "5d-1"]], [26, ["2d+2", "5d"]], [27, ["3d-1", "5d+1"]], [28, ["3d-1", "5d+1"]],
  [29, ["3d", "5d+2"]], [30, ["3d", "5d+2"]], [31, ["3d+1", "6d-1"]], [32, ["3d+1", "6d-1"]],
  [33, ["3d+2", "6d"]], [34, ["3d+2", "6d"]], [35, ["4d-1", "6d+1"]], [36, ["4d-1", "6d+1"]],
  [37, ["4d", "6d+2"]], [38, ["4d", "6d+2"]], [39, ["4d+1", "7d-1"]], [40, ["4d+1", "7d-1"]],
  [45, ["5d", "7d+1"]], [50, ["5d+2", "8d-1"]], [55, ["6d", "8d+1"]], [60, ["7d-1", "9d"]],
  [65, ["7d+1", "9d+2"]], [70, ["8d", "10d"]],
]);

function parseDice(text) {
  const match = /^(\d+)d([+-]\d+)?$/.exec(text);
  if (!match) throw new Error(`not a dice expression: ${text}`);
  return { dice: Number(match[1]), modifier: match[2] ? Number(match[2]) : 0 };
}

function formatDice({ dice, modifier }) {
  if (modifier === 0) return `${dice}d`;
  return `${dice}d${modifier > 0 ? "+" : ""}${modifier}`;
}

/** Base thrust/swing dice for a ST, using the published table. */
export function baseDamage(st, kind) {
  if (st < 1) throw new Error(`ST must be at least 1, got ${st}`);
  let key = st;
  if (st > 40) {
    key = Math.min(70, Math.floor(st / 5) * 5);
  }
  const entry = DAMAGE_TABLE.get(key);
  if (!entry) throw new Error(`no damage table entry for ST ${st}`);
  return parseDice(kind === "sw" ? entry[1] : entry[0]);
}

/**
 * Resolve an attack's damage from the creature's ST.
 *
 * `basis` is the GURPS shorthand a natural weapon states — "thr-1", "sw+2" — and
 * `perDie` the "+N per die" a weapon like a hoof adds. The result is an absolute
 * dice expression, because that is what both the rating path and a GM reading
 * the stat block need; nobody should have to re-derive thrust at the table.
 */
export function resolveDamage(st, basis, perDie = 0) {
  const match = /^(thr|sw)([+-]\d+)?$/.exec(basis);
  if (!match) throw new Error(`not a damage basis: ${basis}`);
  const base = baseDamage(st, match[1]);
  const modifier = base.modifier + (match[2] ? Number(match[2]) : 0) + perDie * base.dice;
  return formatDice({ dice: base.dice, modifier });
}

const DIFFICULTY_OFFSET = { e: 0, a: 1, h: 2, vh: 3 };

/**
 * Points for a skill at `relative` levels above its controlling attribute.
 * 1/2/4 points buy the first three steps and every step after costs 4.
 */
export function skillPoints(difficulty, relative) {
  const offset = DIFFICULTY_OFFSET[difficulty];
  if (offset === undefined) throw new Error(`unknown skill difficulty: ${difficulty}`);
  const steps = relative + offset;
  if (steps < 0) throw new Error(`a skill cannot be bought below ${-offset} relative levels`);
  if (steps === 0) return 1;
  if (steps === 1) return 2;
  if (steps === 2) return 4;
  return 4 * (steps - 1);
}

/**
 * The Enhanced Move multiplier. Each full level doubles ground Move; a half
 * level multiplies it by 1.5.
 */
export function enhancedMoveMultiplier(level) {
  if (!level) return 1;
  const full = Math.floor(level);
  const half = level - full >= 0.5 ? 1.5 : 1;
  return 2 ** full * half;
}

/** GCS object ids are 17 characters; derive them so a rebuild is byte-identical. */
export function stableId(prefix, ...parts) {
  const digest = createHash("sha256").update(parts.join("|")).digest("base64url");
  return `${prefix}${digest.slice(0, 16)}`.replace(/[^A-Za-z0-9_-]/g, "_");
}
