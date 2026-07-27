/**
 * The identity a promoted package is published under.
 *
 * Two names are in play and they are not the same thing:
 *
 *   the shelf   - what a consumer sees the library called. Dungeons on
 *                 Automatic ships these records as one monster library, so the
 *                 published package and its source book carry the DOA library
 *                 name rather than the conversion author's.
 *   the credit  - who made the work. That is a licence condition and lives on
 *                 every record in `provenance.credits`, `creditLine`, and
 *                 `sourceCopyrightNotice`, plus the manifest's own `credits`
 *                 and `sources`. Nothing here touches any of it.
 *
 * The source-book **id** is deliberately not part of the rename. Consumers
 * store it: Dungeons on Automatic writes it into every saved profile and
 * dungeon state as an enabled source book, so changing it would silently drop
 * this library from every existing save. The id is a key, the name is a label,
 * and only the label is ours to restyle.
 */

export const PUBLIC_PACKAGE_ID = "enraged-eggplant-monsters";

/** Shelf name for both the package and the source-book toggle it presents as. */
export const PUBLIC_LIBRARY_NAME = "Dungeons on Automatic Monster Library";

/**
 * Canonical bestiary page. Consumers deep-link a record as
 * `${PUBLIC_BESTIARY_URL}#${monster.id}`, so this has to be the URL the site
 * actually serves — `/monsters.html` 308s here, and a citation should not
 * spend a redirect.
 */
export const PUBLIC_BESTIARY_URL = "https://dungeonsonautomatic.com/monsters";

export const PUBLIC_LICENSE_SUMMARY =
  "Fan-authored GURPS monster statistics adapted and republished with unrestricted author permission; attribution retained.";

/**
 * Apply the published identity to a reviewed candidate's manifest fields.
 * Returns only the identity keys, for the caller to spread over the candidate
 * manifest alongside the version, art, and source rewrites it owns.
 */
export function publicPackageIdentity(candidateManifest) {
  const sourceBook = candidateManifest?.sourceBook ?? {};
  return {
    id: PUBLIC_PACKAGE_ID,
    name: PUBLIC_LIBRARY_NAME,
    // id preserved from the candidate: it is a consumer-visible key, not a label.
    sourceBook: { ...sourceBook, name: PUBLIC_LIBRARY_NAME },
    licenseSummary: PUBLIC_LICENSE_SUMMARY,
    packageUrl: PUBLIC_BESTIARY_URL,
  };
}
