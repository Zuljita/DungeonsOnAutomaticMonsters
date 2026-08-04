# Policy for what a published record cites, and where the citation leads

Status: **decided** — applies from the first release promoted after this file lands.

## The question

A record reached a consumer carrying two fields that decide what a GM sees under the creature's name:
`pageRef`, the citation, and `provenance.sourceName`, the source's own name for the record. Both were
published exactly as the reviewed candidate stated them, and for the 304 converted records the candidate
states the conversion author's heading:

```
Aboleth [Monster Manual, page 8, Expanded Psionics Handbook, page 185]
```

Dungeons on Automatic prints that after the library name, and the public site prints it twice — once on the
stat sheet, once as "Source record". Two things are wrong with it.

**It cites a lineage this package does not have.** Nothing here is republished from the Monster Manual or
the Expanded Psionics Handbook, and no licence to either is held or claimed. The bracket is the author's
bibliography — it records the books he worked from, which is a fact about his conversion and not a claim
this package is in any position to make on his behalf. The same reasoning already rules the descriptions out
of the imported set; see [description-policy.md](description-policy.md).

Replacing it with a bare `Aboleth (SRD 3.5)` would be the same overclaim pointed the other way. **The SRD is
not where these statistics come from.** It prints no GURPS. Every record here is somebody's own GURPS
expression — Enraged Eggplant's, republished with his permission, or this project's — and what the SRD
supplies is the creature *identity* that expression answers to. For the authored records that boundary is
already stated on the record itself: *"Only the creature identity is taken from the SRD; the GURPS
statistics, ratings and prose are this project's own work and reproduce no SRD text."* A citation has to
name the builder as well as the heading, because either half on its own is a claim the package cannot make.

**It is a citation nobody can follow.** "page 8" is a page in a book the reader may not own, of a creature
this package did not take its statistics from. Meanwhile every record *does* have a page a reader can open —
its page on the public site — and the package never said so. Consumers were left to construct one from the
record id, and the id names a source package (`enraged_eggplant_aboleth`) while the site's URL is named for
the creature (`/monsters/aboleth/`), so the constructed link never resolved to the creature's page.

## Decision

**A published record cites the creature, who built it, and the SRD heading it answers to, and states the
public page that citation resolves to.** Three fields, written by promotion:

| Field | Value | Example |
| --- | --- | --- |
| `pageRef` | Creature name, the originator, then the SRD headings it answers to | `Oni (Monsters on Automatic; answers SRD 3.5: Ogre Mage, SRD 5.1)` |
| `provenance.sourceName` | The source's own name for the record, minus any citation to a book this package does not licence | `Aboleth` |
| `provenance.bestiaryUrl` | The creature's canonical page on the public site | `https://dungeonsonautomatic.com/monsters/aboleth/` |

The chain reads builder first, heading second: `Aboleth (Enraged Eggplant; answers SRD 3.5, SRD 5.1)`. The
originator is the one the licence already requires on every record, taken from `provenance.credits` rather
than assumed per source — the 304 converted records are Enraged Eggplant's work and crediting them to this
project would be a misattribution the package's own validation exists to prevent. "Answers" is the word the
coverage registry already uses for a record standing in for an SRD heading.

An edition is named alone when the SRD prints the creature under this record's own name. When the SRD's
heading differs, it follows a colon, so the citation names the entry a reader would actually find: 3.5 prints
the Oni as "Ogre Mage". Records authored for SRD coverage state their headings outright in
`provenance.coversSourceIdentities`; converted records state only which SRDs print the identity, as
`srd-3-5` / `srd-5-1` tags. Each is cited from what it knows, and a record missing either half of the chain
states the half it has rather than inventing the other.

## Why promotion rewrites rather than review repairing

The reviewed candidates keep the source's own wording. That is what the review ledger decided about, what
`review:verify` hashes, and the honest record of what the conversion said. Rewriting the citation is not a
review decision about a creature; it is a publication rule about the package, and it lives beside the URL
rewrites promotion already performs — no published URL points into this repository, and no published
citation points into a book this package does not licence.

## What enforces it

- `scripts/public-citation.mjs` builds all three fields, and is the only place the rules live.
- Both promote scripts validate their output with `requirePublicCitations: true`, which refuses a package
  whose `pageRef` or `sourceName` carries a bracketed citation to anything but the SRDs or Monsters on
  Automatic, and refuses a record with no `bestiaryUrl`. The rule is an allowlist, so a book nobody has
  thought of yet is refused too.
- Promotion refuses to publish when two records would claim the same page, or when a name yields no page at
  all. The public site fails its own build on a slug collision rather than overwrite a page; failing at
  promotion means the package never ships a link the site cannot serve.
- `npm test` holds the tracked artifact to the same rule: `validate:public` passes
  `--require-public-citations`, so `converted/doa-monsters.json` cannot regress between releases.

The check is opt-in rather than implied by "this is a public package", because a package released before the
field existed is still a valid package — the same contract stance `description` took, and
`scripts/validate-package.mjs` stays usable against one.

## What a consumer should do

Link `provenance.bestiaryUrl`. Do not construct a URL from `id`: the id carries the source package a record
came from, deliberately, and the public URL carries the creature name, deliberately. The two do not
correspond, and only the record knows its page.
