// SPDX-License-Identifier: MIT
//
// What a published record cites, and where a consumer follows the citation to.
//
// Two things a reviewed candidate cannot state for itself:
//
//   the lineage - a converted record inherits its source's own heading, and the
//                 authorized fan conversion cites the books its author worked
//                 from: "Aboleth [Monster Manual, page 8, Expanded Psionics
//                 Handbook, page 185]". This package does not republish those
//                 books and holds no licence to them. Nor does it come from the
//                 SRD, which prints no GURPS: the statistics are the conversion
//                 author's or this project's own expression, and what the SRD
//                 supplies is the creature identity they answer to. A published
//                 citation names the builder and the SRD heading, in that order,
//                 because either half alone is a claim the package cannot make.
//   the page    - a citation a GM cannot open is not a citation. Every record
//                 has a page on the public site, and the record is the only
//                 thing that knows which one, so the package states it rather
//                 than leaving a consumer to guess a URL from an id.
//
// Both are publication facts, not review decisions: the reviewed candidates
// keep the source's own wording, which is what the review ledger decided about,
// and promotion rewrites it for the public package. Same layering as the URL
// rewrites in the promote scripts.

import { PUBLIC_BESTIARY_URL } from "./package-identity.mjs";

/** Editions in citation order, with the record tag each is claimed by. */
export const SRD_EDITIONS = [
  { sourceSystem: "srd_3_5", tag: "srd-3-5", label: "SRD 3.5" },
  { sourceSystem: "srd_5_1", tag: "srd-5-1", label: "SRD 5.1" },
];

/**
 * Sources this package may cite: the two SRDs it draws creature identities
 * from, and its own authored coverage batches. Anything else inside a bracketed
 * citation came from the source's own bibliography and is dropped on
 * publication — an allowlist rather than a list of books to strip, so a book
 * nobody has thought of yet is dropped too.
 */
const LICENSED_CITATION = /^(?:SRD\b|System Reference Document\b|Monsters on Automatic\b)/i;

/** Every bracketed citation in `value` names a source this package may cite. */
export function citesOnlyLicensedSources(value) {
  for (const [, inside] of String(value ?? "").matchAll(/\[([^\]]*)\]/g)) {
    if (!LICENSED_CITATION.test(inside.trim())) return false;
  }
  return true;
}

/**
 * The public site's slug rule, character for character: the site derives a
 * monster page from the record *name*, never from the id, because the id
 * carries a source package ("enraged_eggplant_aboleth") and a public URL should
 * not. Keep this in step with `monsterSlug` in the site's monster-render.mjs —
 * the two agreeing is what makes the published URL resolve.
 */
export function monsterPageSlug(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Canonical public page for a creature, or null when the name yields no slug. */
export function monsterPageUrl(name, base = PUBLIC_BESTIARY_URL) {
  const slug = monsterPageSlug(name);
  if (!slug) return null;
  // Trailing slash: that is the canonical the site's own pages declare, and a
  // citation should not spend a redirect to reach it.
  return `${String(base).replace(/\/+$/, "")}/${slug}/`;
}

/**
 * The SRD lineage clauses for a record, in edition order.
 *
 * An edition is named on its own when the SRD prints the creature under this
 * record's own name. When the SRD's heading differs — 3.5 prints the Oni as
 * "Ogre Mage" — the heading follows a colon, so the citation leads to the entry
 * a reader would actually find.
 *
 * Records authored for SRD coverage state their headings outright in
 * `provenance.coversSourceIdentities`; converted records state only which SRDs
 * print the identity, as edition tags. Each is cited from what it knows.
 */
function srdLineage(record) {
  const name = String(record?.name ?? "").trim();
  const covers = Array.isArray(record?.provenance?.coversSourceIdentities)
    ? record.provenance.coversSourceIdentities
    : [];
  const tags = new Set(Array.isArray(record?.tags) ? record.tags : []);
  const clauses = [];
  for (const edition of SRD_EDITIONS) {
    const headings = [...new Set(
      covers
        .filter(cover => cover?.sourceSystem === edition.sourceSystem)
        .map(cover => String(cover?.heading ?? "").trim())
        .filter(Boolean),
    )];
    if (headings.length === 0) {
      if (tags.has(edition.tag)) clauses.push(edition.label);
      continue;
    }
    clauses.push(
      headings.length === 1 && headings[0] === name
        ? edition.label
        : `${edition.label}: ${headings.join(", ")}`,
    );
  }
  return clauses;
}

/** Who made this record, from the originator credit the licence already requires. */
function originatorName(record) {
  const originator = (record?.provenance?.credits ?? []).find(credit => credit?.role === "originator");
  return String(originator?.name ?? "").trim();
}

/**
 * The citation a published record carries: the creature, who built it, and the
 * SRD heading it answers to.
 *
 * Naming the builder is the point. The SRD is not where these statistics come
 * from — it prints no GURPS — and citing "Aboleth (SRD 3.5)" would claim it is,
 * which is the same kind of overclaim as citing the Monster Manual, pointed the
 * other way. What the SRD supplies is the creature *identity*: an Enraged
 * Eggplant conversion answers to an SRD-covered creature, and a Monsters on
 * Automatic build takes the identity from the SRD and nothing else — no SRD
 * text, no third-party conversion. So the citation reads builder first, SRD
 * heading second, in the project's own vocabulary: a record *answers to* a
 * heading.
 *
 * A record missing either half states the half it has rather than inventing one.
 */
export function publicPageRef(record) {
  const name = String(record?.name ?? "").trim();
  const originator = originatorName(record);
  const lineage = srdLineage(record);
  const clauses = [
    ...(originator ? [originator] : []),
    ...(lineage.length > 0 ? [`answers ${lineage.join(", ")}`] : []),
  ];
  return clauses.length > 0 ? `${name} (${clauses.join("; ")})` : name;
}

/**
 * The source's own name for the record, minus any citation to a book this
 * package does not licence. Stripping leaves the creature identity, which is
 * the part of the heading the conversion actually answers to.
 */
export function publicSourceName(record) {
  const stated = String(record?.provenance?.sourceName ?? "").trim();
  const cleaned = stated
    .replace(/\s*\[([^\]]*)\]/g, (whole, inside) => (LICENSED_CITATION.test(inside.trim()) ? whole : ""))
    .trim();
  return cleaned || String(record?.name ?? "").trim();
}

/** The three published citation fields for one record. */
export function publicCitation(record, base = PUBLIC_BESTIARY_URL) {
  const bestiaryUrl = monsterPageUrl(record?.name, base);
  if (!bestiaryUrl) {
    throw new Error(`Refusing to publish ${record?.id}: name "${record?.name}" has no public monster page.`);
  }
  return { pageRef: publicPageRef(record), sourceName: publicSourceName(record), bestiaryUrl };
}

/**
 * Records whose names would claim the same public page, or none at all. The
 * site refuses to build on a slug collision rather than overwrite one monster's
 * page with another's; failing here means the package never ships a link the
 * site cannot serve. A second Goblin needs a distinct record name, not a guess
 * made at publication.
 */
export function monsterPageCollisions(records) {
  const claimedBy = new Map();
  const errors = [];
  for (const record of records ?? []) {
    const slug = monsterPageSlug(record?.name);
    if (!slug) {
      errors.push(`${record?.id}: name "${record?.name}" produces no monster page slug`);
      continue;
    }
    if (claimedBy.has(slug)) errors.push(`${slug}: claimed by both ${claimedBy.get(slug)} and ${record?.id}`);
    else claimedBy.set(slug, record?.id);
  }
  return errors;
}
