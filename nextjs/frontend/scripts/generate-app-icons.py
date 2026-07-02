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
    """エクスポート時に乗った黒背景を透過にする。"""
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


def _save_icon(size: int, output: Path) -> None:
    with Image.open(SOURCE) as source:
        icon = _remove_near_black_background(source)
        icon = icon.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(output, format="PNG")
    print(f"Wrote {output} ({size}x{size})")


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source image not found: {SOURCE}")

    _save_icon(32, ICON)
    _save_icon(180, APPLE_ICON)


if __name__ == "__main__":
    main()
