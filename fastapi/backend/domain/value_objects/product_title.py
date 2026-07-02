from dataclasses import dataclass

MAX_PRODUCT_TITLE_LENGTH = 500


@dataclass(frozen=True, slots=True)
class ProductTitle:
    value: str


def new_product_title(value: object) -> ProductTitle:
    if not isinstance(value, str):
        raise ValueError("product title must be a string")

    normalized = value.strip()
    if not normalized:
        raise ValueError("product title must not be empty")
    if len(normalized) > MAX_PRODUCT_TITLE_LENGTH:
        raise ValueError(f"product title must be at most {MAX_PRODUCT_TITLE_LENGTH} chars")

    return ProductTitle(normalized)
