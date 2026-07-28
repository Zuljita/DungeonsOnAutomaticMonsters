# Foundry module manual QA checklist

A script can verify the pack builds and the data is shaped right; it cannot see
what Foundry actually renders. Run this once per release against a real install
and record the result at the bottom.

Prerequisites: a Foundry VTT install at V12 or V13 with the GURPS Game Aid
(system `gurps`) installed, and an internet connection (art is remote).

## Steps

1. **Install by manifest URL.** Setup → Add-on Modules → Install Module →
   paste `https://assets.dungeonsonautomatic.com/monsters/enraged-eggplant/foundry/module.json`.
   The module installs without error and reports the expected version.
2. **Enable and open.** In a GURPS-system world, enable the module and open the
   **DOA Monsters (GURPS)** compendium. All approved monsters are listed
   (0.3.2: 304), alphabetically, each with its portrait thumbnail.
3. **Open a sheet.** Open Aboleth. The sheet shows ST 30, DX 11, IQ 15, HT 13,
   HP 37, the attack list, traits and skills; the portrait renders.
4. **Credit is visible.** On the same sheet, the notes contain the licence
   block: content licence and URL, the Enraged Eggplant credit line, and the
   source copyright notice.
5. **Drag onto a hex scene.** Create a scene with a hexagonal-columns grid and
   drag Aboleth onto it. The token uses the flat-top hex token art, transparent
   background intact, occupying a 4-across footprint (record states 14 hexes).
   Drag a 1-hex creature (e.g. Stirge) and confirm a single-hex token.
6. **Player view is safe.** Join as a player with observer rights to a dragged
   token. Nothing player-visible shows CER, threat tier, or review provenance.
7. **Update, don't duplicate.** With a previous module version installed and an
   Actor imported into the world, update the module and re-import: Foundry
   offers to update the existing Actor (same id) rather than creating a second.

## Results

| Date | Foundry / GURPS system version | Module version | Result | Notes |
| ---- | ------------------------------ | -------------- | ------ | ----- |
| _not yet run_ | | | | |
