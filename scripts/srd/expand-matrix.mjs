// SPDX-License-Identifier: MIT
//
// Cross-product expansion for families where two axes vary independently.
//
// Dragons are the case this exists for. The SRD prints forty of them — ten
// colours at four ages — and both of the obvious ways to handle that are wrong.
// Authoring forty records separately duplicates the same body plan forty times
// and guarantees they drift. Publishing ten records with an "age" note hides
// mechanical differences a GM needs, which is exactly what `OML-022` forbids.
//
// So the spec states the axes and the builder emits the cross-product. Age
// scales the body: size, ST, DR, the reach of a limb, the dice of a breath.
// Colour states the weapon and the mind: what that breath *is*, what the
// creature is immune to, where it lives, what it wants. Neither axis knows about
// the other, which is what stops forty records from becoming forty opinions.
//
// The output is forty ordinary specs. Nothing downstream knows a matrix was
// involved, consumers get concrete records, and the coverage registry gets forty
// dispositions rather than one row with a footnote.

/** Fields whose values accumulate across base and every axis. */
const CONCATENATED = [
  "traitSets", "traits", "skills", "attacks", "tags", "classTags", "notes", "descriptionParts",
];

/** Fields that steer expansion and must not survive onto the finished spec. */
const DIRECTIVES = ["descriptionParts", "namePattern", "headingPattern", "vars"];

/**
 * Substitute `{name}` in a string.
 *
 * An axis contributes two kinds of value. Its `label` answers `{Colour}` and
 * `{colour}`, cased by the first letter of the placeholder. Its `vars` answer by
 * exact name, and are how one axis states a value another axis's text needs —
 * the age supplies the dice of a breath weapon, the colour supplies what it is
 * made of, and the attack that uses both belongs to neither.
 */
function fill(pattern, subs) {
  return pattern.replace(/\{(\w+)\}/g, (whole, key) => {
    if (key in subs.vars) return subs.vars[key];
    const lower = key.charAt(0).toLowerCase() + key.slice(1);
    const label = subs.labels[lower];
    if (label === undefined) throw new Error(`unknown pattern field {${key}} in ${JSON.stringify(pattern)}`);
    return key[0] === key[0].toUpperCase() ? label : label.toLowerCase();
  });
}

/** Substitute through every string in a spec, however deeply nested. */
function deepFill(value, subs) {
  if (typeof value === "string") return fill(value, subs);
  if (Array.isArray(value)) return value.map(item => deepFill(item, subs));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFill(item, subs)]));
  }
  return value;
}

function mergeFragment(target, fragment) {
  for (const [key, value] of Object.entries(fragment)) {
    if (CONCATENATED.includes(key)) target[key] = [...(target[key] ?? []), ...value];
    else if (key === "vars") target.vars = { ...(target.vars ?? {}), ...value };
    else if (value !== undefined) target[key] = value;
  }
  return target;
}

/**
 * Expand a batch file's `matrix` into ordinary monster specs.
 *
 * A matrix declares `base` (what every cell shares), two or more `axes`, and the
 * patterns that name a cell. Every axis value carries a spec fragment; fragments
 * merge in axis order, with lists concatenated, `vars` pooled, and scalars taken
 * from the last fragment that states one.
 */
export function expandMatrix(matrix) {
  const axes = matrix.axes;
  if (!Array.isArray(axes) || axes.length < 2) {
    throw new Error("a matrix needs at least two axes; one axis is just a list of monsters");
  }

  let cells = [{ labels: {}, keys: {}, fragments: [matrix.base ?? {}] }];
  for (const axis of axes) {
    const next = [];
    for (const cell of cells) {
      for (const [key, value] of Object.entries(axis.values)) {
        const { label, ...fragment } = value;
        next.push({
          labels: { ...cell.labels, [axis.id]: label },
          keys: { ...cell.keys, [axis.id]: key },
          fragments: [...cell.fragments, fragment],
        });
      }
    }
    cells = next;
  }

  return cells.map(cell => {
    const merged = cell.fragments.reduce((target, fragment) => mergeFragment(target, fragment), {});
    const subs = { labels: cell.labels, vars: merged.vars ?? {} };

    // An axis may override how a cell is named, because the SRD does not name
    // these consistently: a wyrmling takes its age as a suffix and every older
    // dragon takes it as a prefix.
    const name = fill(merged.namePattern ?? matrix.name, subs);
    const heading = fill(merged.headingPattern ?? matrix.heading, subs);
    // The description is assembled from one sentence per axis, in axis order, so
    // forty records read as forty creatures rather than one paragraph with two
    // words swapped.
    const description = fill((merged.descriptionParts ?? []).join(" "), subs);

    const spec = deepFill(merged, subs);
    for (const directive of DIRECTIVES) delete spec[directive];
    spec.slug = fill(matrix.slug, { labels: cell.keys, vars: {} });
    spec.name = name;
    spec.description = description;
    spec.covers = [{ sourceSystem: matrix.sourceSystem, heading }];
    // The axis keys travel onto the record so a consumer can filter the family
    // without parsing names apart.
    spec.tags = [...(spec.tags ?? []), ...Object.entries(cell.keys).map(([axis, key]) => `${axis}-${key}`)];
    return spec;
  });
}

/** Every monster a batch file defines, whether listed outright or expanded. */
export function batchMonsters(file) {
  return [...(file.monsters ?? []), ...(file.matrix ? expandMatrix(file.matrix) : [])];
}
