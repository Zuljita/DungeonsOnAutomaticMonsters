# Monster descriptions

Original Dungeons on Automatic prose about each creature, tracked here rather than edited into a generated
package. `npm run review:apply` merges these into the reviewed package; promotion carries them into the
public one.

`enraged-eggplant.json` holds the descriptions for the Enraged Eggplant monster package:

```json
{
  "recordId": "enraged_eggplant_rust_monster",
  "monster": "Rust Monster",
  "text": "A four-legged scavenger about the size of a large dog, ...",
  "basis": ["record.stats.traits", "record.stats.attacks", "record.size"]
}
```

`basis` names what the prose was written from, and may only name project-owned material: the record's own
converted statistics, or this project's art direction for the creature. SRD text is not a permitted basis —
3.5 SRD prose is OGL 1.0a and cannot be carried into a CC BY field, and validation rejects any attempt to
claim it.

Published descriptions state `authorship: "doa_authored"` and their own CC BY 4.0 terms, separate from the
record's, because description text need not share the source or licence of the mechanics it sits beside.

To add one:

```bash
npm run descriptions:draft -- --limit 20
```

That writes a drafting sheet of undescribed records with their seed clause, traits, attacks and scale. Write
two or three sentences of reader-facing prose, add the entry here, then:

```bash
npm run descriptions:check && npm run review:apply
```

The decision behind all of this, and what a description may and may not say, is in
[review/policy/description-policy.md](../../review/policy/description-policy.md).
