# Typical Stats Variant Policy

The source states more than one statted creature for some entries. A dragon has four age steps,
an elemental has eight size steps, and many humanoids have an elite counterpart — a Frost Giant
Jarl beside a Frost Giant. Each is its own `### Typical Stats` block under a single monster
heading, and the racial modifiers above them are shared.

## The rule

**A record carries the source's first Typical Stats block — the base form — and no other.**

That is what all 304 approved records already do, without exception. This policy states the
existing behaviour rather than changing it, so that the omission is a decision on the record
instead of an accident nobody wrote down.

The `.gct` ancestry is the shared racial template, so it is correct for every variant. The
divergence is confined to the Typical Stats: attributes, dodge, and the individual's bought
traits.

## What is currently excluded

34 records have variants the library does not carry:

| Entry | Carried | Also in the source, not in the library |
| --- | --- | --- |
| White, Black, Green, Blue, Red, Brass, Bronze, Copper, Silver, Gold Dragon | Small | Medium, Large, Gargantuan |
| Air, Earth, Fire, Water Elemental | Miniature | Small, Medium, Large, Huge, Greater, Elder, Primal |
| Arrowhawk | Juvenile | Adult, Elder |
| Aranea | Native Form | Humanoid Form, Hybrid Form |
| Bralani, Ghaele | Humanoid Form | Whirlwind Form / Globe Form |
| Aboleth, Hound Archon, Barghest, Frost Giant, Stone Giant, Harpy, Lammasu, Mummy, Black Pudding, Salamander, Shadow, Troll | base form | one elite or greater counterpart each |

Ten dragons at one of four age steps and four elementals at one of eight is the bulk of it: the
library ships 14 creatures where the source describes 78.

## Expanding later

Variants are additive, never a rename. A record `id` is a key, not a label — Dungeons on
Automatic writes it into every saved profile and dungeon state, so changing `enraged_eggplant_white_dragon`
to name the Small variant explicitly would silently drop the monster from every existing save.
A future expansion gives each new variant its own id and leaves the base record's id untouched.

Anything added this way needs the same gates as any other record: GCS arithmetic and library
fidelity, DOA playability, art, and a description. A variant is a new monster, not a free
derivative of one already approved.
