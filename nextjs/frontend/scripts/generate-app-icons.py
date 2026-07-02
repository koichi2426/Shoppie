#!/usr/bin/env python3
"""Shoppie マスコット画像から各端末向けアイコンを生成する。"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "shoppie-icon-source.png"
PUBLIC_ICONS = ROOT / "public" / "icons"
APP_DIR = ROOT / "app"

# ブラウザタブ用（円の外は透過）
BROWSER_SIZES = (16, 32, 48)

# iOS「ホーム画面に追加」（円の外は黒・不透過）
APPLE_SIZES = (152, 167, 180)

# Android / PWA manifest（円の外は黒・不透過）
PWA_SIZES = (192, 512)


def _remove_near_black_background(img: Image.Image) -> Image.Image:
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
    if outside not in {"transparent", "black"}:
        raise ValueError(f"unsupported outside mode: {outside}")

    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    pixels = resized.load()

    if outside == "black":
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


def _render(size: int, outside: str) -> Image.Image:
    with Image.open(SOURCE) as source:
        prepared = _remove_near_black_background(source)
        return _finalize_icon(prepared, size, outside=outside)


def _save_png(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")
    print(f"Wrote {path} ({image.size[0]}x{image.size[1]}, mode={image.mode})")


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source image not found: {SOURCE}")

    PUBLIC_ICONS.mkdir(parents=True, exist_ok=True)

    browser_icons: list[Image.Image] = []
    for size in BROWSER_SIZES:
        icon = _render(size, outside="transparent")
        browser_icons.append(icon)
        _save_png(PUBLIC_ICONS / f"icon-{size}.png", icon)

    # Next.js 既定の favicon / tab icon
    _save_png(APP_DIR / "icon.png", browser_icons[1])  # 32x32
    browser_icons[0].save(
        APP_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=browser_icons[1:],
    )
    print(f"Wrote {APP_DIR / 'favicon.ico'} (16, 32, 48)")

    for size in APPLE_SIZES:
        icon = _render(size, outside="black")
        _save_png(PUBLIC_ICONS / f"apple-touch-icon-{size}.png", icon)
        if size == 180:
            _save_png(APP_DIR / "apple-icon.png", icon)

    for size in PWA_SIZES:
        icon = _render(size, outside="black")
        _save_png(PUBLIC_ICONS / f"icon-{size}.png", icon)


if __name__ == "__main__":
    main()
