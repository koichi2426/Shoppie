#!/usr/bin/env python3
"""Shoppie アプリアイコン（透過 PNG）を生成する。"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
APPLE_ICON = ROOT / "app" / "apple-icon.png"

INK = (30, 27, 75, 217)
BLUSH = (253, 164, 175, 89)
WHITE = (255, 255, 255, 230)
SIZE = 180


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _gradient_color(x: float, y: float, size: int) -> tuple[int, int, int]:
    t = (x / size + y / size) / 2
    cyan = (34, 211, 238)
    purple = (168, 85, 247)
    pink = (236, 72, 153)
    if t < 0.52:
        ratio = t / 0.52
        return (
            int(_lerp(cyan[0], purple[0], ratio)),
            int(_lerp(cyan[1], purple[1], ratio)),
            int(_lerp(cyan[2], purple[2], ratio)),
        )
    ratio = (t - 0.52) / 0.48
    return (
        int(_lerp(purple[0], pink[0], ratio)),
        int(_lerp(purple[1], pink[1], ratio)),
        int(_lerp(purple[2], pink[2], ratio)),
    )


def _scale(value: float) -> float:
    return value * SIZE / 100


def generate_apple_icon() -> None:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pixels = img.load()
    radius = SIZE / 2

    for y in range(SIZE):
        for x in range(SIZE):
            dx = x + 0.5 - radius
            dy = y + 0.5 - radius
            if dx * dx + dy * dy <= radius * radius:
                r, g, b = _gradient_color(x, y, SIZE)
                pixels[x, y] = (r, g, b, 255)

    draw = ImageDraw.Draw(img)

    shine_box = (
        _scale(12),
        _scale(12),
        SIZE - _scale(12),
        SIZE - _scale(12),
    )
    shine = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shine_draw = ImageDraw.Draw(shine)
    shine_draw.ellipse(shine_box, fill=(255, 255, 255, 72))
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, SIZE - 1, SIZE - 1), fill=255)
    img = Image.alpha_composite(img, shine)

    draw = ImageDraw.Draw(img)
    draw.ellipse(
        (_scale(14), _scale(47), _scale(30), _scale(57)),
        fill=BLUSH,
    )
    draw.ellipse(
        (_scale(70), _scale(47), _scale(86), _scale(57)),
        fill=BLUSH,
    )
    draw.ellipse(
        (_scale(25), _scale(33), _scale(39), _scale(51)),
        fill=INK,
    )
    draw.ellipse(
        (_scale(61), _scale(33), _scale(75), _scale(51)),
        fill=INK,
    )
    draw.ellipse(
        (_scale(31.5), _scale(37), _scale(36.5), _scale(43)),
        fill=WHITE,
    )
    draw.ellipse(
        (_scale(63.5), _scale(37), _scale(68.5), _scale(43)),
        fill=WHITE,
    )
    draw.arc(
        (_scale(34), _scale(52), _scale(66), _scale(72)),
        start=200,
        end=-20,
        fill=INK,
        width=max(2, int(_scale(3.5))),
    )

    img.save(APPLE_ICON, format="PNG")
    print(f"Wrote {APPLE_ICON}")


if __name__ == "__main__":
    generate_apple_icon()
