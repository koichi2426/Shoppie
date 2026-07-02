#!/usr/bin/env python3
"""Shoppie マスコット画像からアプリアイコン（透過 PNG）を生成する。"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "shoppie-icon-source.png"
ICON = ROOT / "app" / "icon.png"
APPLE_ICON = ROOT / "app" / "apple-icon.png"


def _remove_near_black_background(img: Image.Image) -> Image.Image:
    """ソースに乗った黒背景を透過にする。"""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if r < 24 and g < 24 and b < 24:
                pixels[x, y] = (0, 0, 0, 0)

    return rgba


def _finalize_icon(
    img: Image.Image,
    size: int,
    *,
    outside: str,
) -> Image.Image:
    """円の外側を透過または黒で統一する（白フチを出さない）。"""
    if outside not in {"transparent", "black"}:
        raise ValueError(f"unsupported outside mode: {outside}")

    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    pixels = resized.load()

    if outside == "black":
        # iOS「ホーム画面に追加」は透過を白で埋めることがあるため、不透過 RGB にする
        output = Image.new("RGB", (size, size), (0, 0, 0))
        out_pixels = output.load()
    else:
        output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out_pixels = output.load()

    center = (size - 1) / 2
    radius = size / 2

    for y in range(size):
        for x in range(size):
            dx = x - center
            dy = y - center
            if dx * dx + dy * dy > radius * radius:
                continue

            r, g, b, a = pixels[x, y]
            if outside == "black":
                if a == 0:
                    continue
                alpha = a / 255
                out_pixels[x, y] = (
                    int(r * alpha),
                    int(g * alpha),
                    int(b * alpha),
                )
            else:
                out_pixels[x, y] = (r, g, b, a)

    return output


def _save_icon(size: int, output: Path, *, outside: str) -> None:
    with Image.open(SOURCE) as source:
        prepared = _remove_near_black_background(source)
        icon = _finalize_icon(prepared, size, outside=outside)
        icon.save(output, format="PNG")
    print(f"Wrote {output} ({size}x{size}, outside={outside})")


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source image not found: {SOURCE}")

    _save_icon(32, ICON, outside="transparent")
    _save_icon(180, APPLE_ICON, outside="black")


if __name__ == "__main__":
    main()
