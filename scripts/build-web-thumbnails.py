"""Generate web-optimized WebP thumbnails from monster portraits.

The public site gallery loads `thumbs/<monster-id>.webp` from the assets CDN
and falls back to the full portrait PNG when a thumbnail is missing.

Usage:
    python scripts/build-web-thumbnails.py \
        --input-dir art/enraged-eggplant/portraits \
        --output-dir art/enraged-eggplant/thumbs \
        [--size 420] [--quality 82]
"""

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--size", type=int, default=420)
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("--force", action="store_true", help="Rebuild existing thumbnails")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    sources = sorted(args.input_dir.glob("*.png"))
    if not sources:
        raise SystemExit(f"No PNG portraits found in {args.input_dir}")

    written = skipped = 0
    for source in sources:
        target = args.output_dir / f"{source.stem}.webp"
        if target.exists() and not args.force and target.stat().st_mtime >= source.stat().st_mtime:
            skipped += 1
            continue
        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail((args.size, args.size), Image.LANCZOS)
            image.save(target, "WEBP", quality=args.quality, method=6)
        written += 1

    print(f"Thumbnails: {written} written, {skipped} up to date, {len(sources)} portraits total.")


if __name__ == "__main__":
    main()
