#!/usr/bin/env python3
"""Build a presentation-ready flat-top hex token from transparent overhead art."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


STYLE_ID = "doa-flat-top-hex-v2"


def hex_points(size: int, margin: int) -> list[tuple[int, int]]:
    left = margin
    right = size - margin - 1
    top = margin
    bottom = size - margin - 1
    quarter = round(size * 0.25)
    three_quarters = size - quarter - 1
    middle = size // 2
    return [
        (quarter, top),
        (three_quarters, top),
        (right, middle),
        (three_quarters, bottom),
        (quarter, bottom),
        (left, middle),
    ]


def fit_source_inside_hex(source: Image.Image, safe_mask: Image.Image) -> Image.Image:
    """Center and scale non-transparent art so every visible pixel stays in the safe hex."""

    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("source token has no visible pixels")

    crop = source.crop(bbox)
    size = source.width
    outside_mask = ImageChops.invert(safe_mask)

    def candidate(scale: float) -> tuple[Image.Image, bool]:
        width = max(1, round(crop.width * scale))
        height = max(1, round(crop.height * scale))
        resized = crop.resize((width, height), Image.Resampling.LANCZOS)
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        x = (size - width) // 2
        y = (size - height) // 2
        layer.alpha_composite(resized, (x, y))

        # Ignore only near-zero resampling noise when testing containment.
        visible = layer.getchannel("A").point(lambda value: 255 if value >= 8 else 0)
        overflow = ImageChops.multiply(visible, outside_mask).getbbox() is not None
        return layer, not overflow

    low = 0.0
    high = 1.0
    fitted = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for _ in range(24):
        scale = (low + high) / 2
        layer, fits = candidate(scale)
        if fits:
            low = scale
            fitted = layer
        else:
            high = scale

    if low == 0.0:
        raise ValueError("source token could not be fitted inside the safe hex")
    return fitted


def render(source_path: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    if source.width != source.height:
        raise ValueError(f"source token must be square, found {source.width}x{source.height}")

    size = source.width
    margin = max(20, round(size * 0.035))
    points = hex_points(size, margin)
    inset = max(12, round(size * 0.02))
    inner_width = max(3, round(size * 0.004))
    safe_margin = margin + inset + max(8, round(size * 0.012))

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)

    safe_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(safe_mask).polygon(hex_points(size, safe_margin), fill=255)
    source = fit_source_inside_hex(source, safe_mask)

    # A restrained aubergine-to-slate field keeps the creature readable while
    # preserving transparent pixels outside the flat-top hex.
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = base.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = round(42 * (1 - t) + 20 * t)
        g = round(34 * (1 - t) + 24 * t)
        b = round(55 * (1 - t) + 34 * t)
        for x in range(size):
            vignette = abs(x - size / 2) / (size / 2)
            dim = round(8 * vignette)
            pixels[x, y] = (max(0, r - dim), max(0, g - dim), max(0, b - dim), 255)
    base.putalpha(mask)

    # Keep a soft contact shadow on the derived presentation token only. The
    # reusable source token remains shadow-free and fully transparent.
    alpha = source.getchannel("A")
    shadow_alpha = alpha.filter(ImageFilter.GaussianBlur(max(4, round(size * 0.012))))
    shadow_alpha = shadow_alpha.point(lambda value: round(value * 0.42))
    shadow_alpha = ImageChops.multiply(shadow_alpha, mask)
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow.putalpha(shadow_alpha)

    output = Image.alpha_composite(base, shadow)
    output = Image.alpha_composite(output, source)

    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(border)
    outer_width = max(8, round(size * 0.012))
    draw.line(points + [points[0]], fill=(180, 142, 73, 255), width=outer_width, joint="curve")
    inner = hex_points(size, margin + inset)
    draw.line(inner + [inner[0]], fill=(90, 63, 104, 230), width=inner_width, joint="curve")
    output = Image.alpha_composite(output, border)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.save(output_path, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="single transparent token PNG")
    parser.add_argument("--out", type=Path, help="single output PNG")
    parser.add_argument("--input-dir", type=Path, help="directory of transparent token PNGs")
    parser.add_argument("--output-dir", type=Path, help="directory for derived hex token PNGs")
    args = parser.parse_args()

    if args.input and args.out and not args.input_dir and not args.output_dir:
        render(args.input, args.out)
        print(f"Built {args.out} ({STYLE_ID}).")
        return
    if args.input_dir and args.output_dir and not args.input and not args.out:
        sources = sorted(args.input_dir.glob("*.png"))
        for source in sources:
            render(source, args.output_dir / source.name)
        print(f"Built {len(sources)} hex tokens in {args.output_dir} ({STYLE_ID}).")
        return
    parser.error("use either --input/--out or --input-dir/--output-dir")


if __name__ == "__main__":
    main()
