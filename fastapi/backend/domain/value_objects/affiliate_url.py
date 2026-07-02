from dataclasses import dataclass
from urllib.parse import urlparse

MAX_AFFILIATE_URL_LENGTH = 2048


@dataclass(frozen=True, slots=True)
class AffiliateUrl:
    value: str


def new_affiliate_url(value: object, *, allow_empty: bool = False) -> AffiliateUrl:
    if not isinstance(value, str):
        raise ValueError("affiliate url must be a string")

    normalized = value.strip()
    if not normalized:
        if allow_empty:
            return AffiliateUrl("")
        raise ValueError("affiliate url must not be empty")

    if len(normalized) > MAX_AFFILIATE_URL_LENGTH:
        raise ValueError(f"affiliate url must be at most {MAX_AFFILIATE_URL_LENGTH} chars")

    parsed = urlparse(normalized)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("affiliate url must be a valid http(s) url")

    return AffiliateUrl(normalized)
