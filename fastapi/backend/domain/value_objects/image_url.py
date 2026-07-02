from dataclasses import dataclass
from urllib.parse import urlparse

MAX_IMAGE_URL_LENGTH = 2048


@dataclass(frozen=True, slots=True)
class ImageUrl:
    value: str


def new_image_url(value: object) -> ImageUrl:
    if not isinstance(value, str):
        raise ValueError("image url must be a string")

    normalized = value.strip()
    if not normalized or normalized in ("画像なし",):
        raise ValueError("image url must not be empty")

    if len(normalized) > MAX_IMAGE_URL_LENGTH:
        raise ValueError(f"image url must be at most {MAX_IMAGE_URL_LENGTH} chars")

    parsed = urlparse(normalized)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("image url must be a valid http(s) url")

    return ImageUrl(normalized)
