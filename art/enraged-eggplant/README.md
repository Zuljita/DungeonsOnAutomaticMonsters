# Enraged Eggplant monster portraits

This directory contains AI-generated, original bestiary art for the Enraged Eggplant monster package.

- `portraits/<monster-id>.png` is the stable asset path consumed by the app and public site.
- `tokens/<monster-id>.png` is the stable top-down encounter-map token path.
- `hex-tokens/<monster-id>.png` is the publish-ready flat-top hex presentation token derived from that transparent source.
- `image-manifest.json` records the source monster, exact prompt hash, generation status, and output path for every asset.
- Portraits use a square, painterly dark-fantasy style with strong silhouettes and crop-safe framing.
- Tokens use a strict overhead orthographic camera and padding suitable for flat-top hex grids. They are generated against a flat chroma key, converted locally to real alpha, and rejected by validation if the final PNG is not square or transparent. The deterministic `doa-flat-top-hex-v2` derivative scales each visible silhouette into a safe inset, adds a consistent hex field and border, and retains transparency outside the hex. Large creatures retain their multi-hex scale in metadata rather than baking a grid into the art.
- Generated images are new visual interpretations. They are not source/reference art and must not imitate published monster illustrations.
- Both the converted mechanics and each generated asset should receive human review before public release.

Regenerate the prompt/status manifest with:

```powershell
npm run art:enraged-eggplant:manifest
npm run art:enraged-eggplant:hex-tokens
npm run validate:enraged-eggplant-art
```

The approval-gated package release additionally runs the validator with `--require-complete`; publication is refused until all 304 portraits, all 304 transparent tokens, and all 304 hex tokens exist and pass their format checks.
