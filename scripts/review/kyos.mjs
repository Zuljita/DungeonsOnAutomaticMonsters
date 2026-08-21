// SPDX-License-Identifier: MIT
//
// Drop Knowing Your Own Strength notation from converted records.
//
// The source states every attack twice: the Basic Set reading, then the same
// attack under Knowing Your Own Strength (Pyramid 3/83) as a trailing
// "(KYOS: ...)" parenthetical. Dungeons on Automatic does not use the KYOS
// scale, so the second reading is not an option the package offers a table --
// it is a second damage figure sitting in a field that holds one, which every
// consumer downstream would have to know to ignore.
//
// It is not inert, either. The CER path decides an attack is ranged by finding
// a two-digit number in `reach` (see isRangedReach in cer.mjs), and a KYOS
// parenthetical reading "1d-10 impaling" put one there: the grig's shortsword
// scored as a ranged attack and collected the accuracy credit it is not owed.
//
// Armor divisors nest inside the parenthetical -- "(KYOS: 3d+1(2))" -- so the
// closing paren is found by counting depth, not by taking the first ")".

const OPEN = "(KYOS:";

/**
 * Remove every "(KYOS: ...)" parenthetical from `text`, along with the spaces
 * that set it off, so "thrust 2d cutting (KYOS: 3d+1 cutting), Reach C" reads
 * "thrust 2d cutting, Reach C". Text with no KYOS notation is returned as is.
 */
export function stripKyosNotation(text) {
  if (typeof text !== "string" || !text.includes(OPEN)) return text;
  let out = "";
  let from = 0;
  for (;;) {
    const open = text.indexOf(OPEN, from);
    if (open < 0) return out + text.slice(from);
    const close = closingParen(text, open);
    // An unbalanced parenthetical is malformed source rather than notation this
    // function understands; leave the rest of the string alone instead of
    // guessing where the author meant it to end.
    if (close < 0) return out + text.slice(from);
    // Take the whitespace before the parenthetical with it, or every stripped
    // field ends up with a double space or a space before its comma.
    let start = open;
    while (start > from && text[start - 1] === " ") start -= 1;
    out += text.slice(from, start);
    from = close + 1;
  }
}

/** Deep copy of `value` with KYOS notation stripped from every string in it. */
export function stripKyos(value) {
  if (typeof value === "string") return stripKyosNotation(value);
  if (Array.isArray(value)) return value.map(stripKyos);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, stripKyos(entry)]));
  }
  return value;
}

function closingParen(text, open) {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    if (text[at] === "(") depth += 1;
    else if (text[at] === ")") {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
}
