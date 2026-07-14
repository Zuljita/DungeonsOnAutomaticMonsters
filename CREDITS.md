# Credits and Attribution

Credits follow the contribution that originated the published material. They are part of the data contract, not optional acknowledgements added only to release notes.

## Enraged Eggplant

Reviewed EE-originated contributions and project adaptations included in a public release use `sourceLicense: "author_permission"` to record their origin and `contentLicense: "cc_by_4_0"` to record the downstream release terms. The grant applies only to rights held by or authorized through Enraged Eggplant; it does not relicense third-party expression.

Canonical display credit:

> Original GURPS conversion by Enraged Eggplant, from *Monsters (May 11, 2024)*; adapted and republished with permission.

This credit identifies Enraged Eggplant as the originator of the GURPS conversion work, not of an underlying SRD or traditional monster identity.

Use the credit whenever an artifact directly derives from, materially adapts, or retains a material mechanical or textual contribution from Enraged Eggplant's work. This includes partial derivations: if an EE-originated field survives into an otherwise independently rebuilt record, the record retains scoped EE credit.

The credit must travel with the work through:

- the source manifest and package-level source/credit lists;
- every derived monster record's structured provenance;
- GCS references and ancestry-container notes;
- release notices and downloadable artifact metadata;
- public-site monster details and attribution views;
- app/GM views and exports that display the credited statistics;
- image metadata when EE-authored description or design material was used to construct the image prompt.

A comparison that changes no published content is recorded in the private/review audit, but does not by itself make EE the originator of the independently authored record. If comparison causes an EE-originated construction to be adopted, structured EE credit is required before publication.

## Structured Credit

EE-derived package sources and records use this shape:

```json
{
  "name": "Enraged Eggplant",
  "role": "originator",
  "scope": ["gurps_conversion", "monster_mechanics"],
  "sourceTitle": "Monsters",
  "sourceVersion": "2024-05-11",
  "creditLine": "Original GURPS conversion by Enraged Eggplant, from Monsters (May 11, 2024); adapted and republished with permission.",
  "url": "https://github.com/Zuljita/DungeonsOnAutomaticMonsters/blob/main/licenses/ENRAGED-EGGPLANT-PERMISSION.md"
}
```

Additional contributors may be credited with their own role and scope. Do not replace, collapse, or obscure an originator credit when later adapters, reviewers, editors, or artists are added.
