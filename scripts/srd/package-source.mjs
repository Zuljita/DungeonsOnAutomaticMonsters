// SPDX-License-Identifier: MIT
//
// Who this material is by, and under what terms.
//
// The Enraged Eggplant package carries an originator credit because it retains
// someone else's work. This package carries one for the opposite reason: the
// mechanics, ratings and prose are the project's own, produced as an AI-generated
// first draft, and a record that did not say so would be claiming a provenance it
// does not have. The credit is not decoration — CREDITS.md requires credit to
// travel with the contribution through data, GCS exports and presentation, and
// "who wrote this" is exactly the question a GM opening a .gcs file away from the
// package cannot otherwise answer.

const REPO_URL = "https://github.com/Zuljita/DungeonsOnAutomaticMonsters";

export const CREDIT = {
  name: "Monsters on Automatic",
  role: "originator",
  scope: ["gurps_statistics", "monster_mechanics", "combat_effectiveness_rating", "description_prose"],
  sourceTitle: "Monsters on Automatic SRD coverage builds",
  creditLine:
    "Monster statistics, ratings and description prose by Monsters on Automatic; AI-generated first draft, "
    + "project-reviewed, released under CC BY 4.0.",
  url: REPO_URL,
};

export const PACKAGE_SOURCE = {
  id: "monsters_on_automatic_authored",
  name: "Monsters on Automatic",
  sourceSystem: "doa_fixture",
  sourceLicense: "doa_authored",
  sourceUrl: REPO_URL,
  sourceCopyrightNotice:
    "Copyright 2026 Monsters on Automatic. GURPS-compatible monster statistics, ratings and prose authored for "
    + "this package as an AI-generated first draft under project review. No SRD text, and no third-party GURPS "
    + "conversion, is reproduced.",
  contentLicense: "cc_by_4_0",
  contentLicenseUrl: `${REPO_URL}/blob/main/licenses/CC-BY-4.0.txt`,
  credits: [CREDIT],
};

export const SOURCE_BOOK_ID = "monsters_on_automatic_srd_coverage";

export function manifest(version, monsterCount) {
  return {
    id: "monsters-on-automatic-srd-coverage",
    name: "Dungeons on Automatic Monster Library",
    version,
    sourceBook: {
      id: SOURCE_BOOK_ID,
      name: "Dungeons on Automatic Monster Library",
      required: false,
      derived: true,
    },
    licenseSummary:
      "GURPS-compatible monster statistics, ratings and prose independently authored by Monsters on Automatic as "
      + "an AI-generated first draft under project review; released under CC BY 4.0 with originator credit. The "
      + "SRD supplies only the creature identities these records answer to.",
    licenseUrl: `${REPO_URL}/blob/main/LICENSE.md`,
    noticeUrl: `${REPO_URL}/blob/main/NOTICE.md`,
    packageUrl: "https://dungeonsonautomatic.com/monsters",
    dataUrl: null,
    credits: [CREDIT],
    sources: [PACKAGE_SOURCE],
    monsterCount,
  };
}
