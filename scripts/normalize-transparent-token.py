"""Center a chroma-keyed RGBA token on a square transparent canvas and validate it."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    source = Path(args.input)
    output = Path(args.out)
    with Image.open(source) as opened:
        image = opened.convert("RGBA")

    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("Token has no visible pixels after chroma-key removal.")

    edge = max(image.size)
    square = Image.new("RGBA", (edge, edge), (0, 0, 0, 0))
    offset = ((edge - image.width) // 2, (edge - image.height) // 2)
    square.alpha_composite(image, offset)

    square_alpha = square.getchannel("A")
    square_bounds = square_alpha.getbbox()
    assert square_bounds is not None
    left, top, right, bottom = square_bounds
    if min(left, top, edge - right, edge - bottom) < 2:
        raise ValueError("Token subject touches the canvas edge; regenerate with more padding.")

    alpha_values = square_alpha.get_flattened_data()
    opaqueish = sum(1 for value in alpha_values if value >= 128)
    coverage = opaqueish / (edge * edge)
    if not 0.04 <= coverage <= 0.85:
        raise ValueError(f"Token subject coverage {coverage:.1%} is outside the 4%-85% review range.")

    if any(square.getpixel(point)[3] != 0 for point in ((0, 0), (edge - 1, 0), (0, edge - 1), (edge - 1, edge - 1))):
        raise ValueError("Token corners must be fully transparent.")

    output.parent.mkdir(parents=True, exist_ok=True)
    square.save(output, format="PNG", optimize=True)
    print(f"Wrote {output} ({edge}x{edge}, {coverage:.1%} opaque coverage).")


if __name__ == "__main__":
    main()
