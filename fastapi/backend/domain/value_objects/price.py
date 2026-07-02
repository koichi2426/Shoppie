from dataclasses import dataclass

MAX_PRICE_YEN = 100_000_000


@dataclass(frozen=True, slots=True)
class Price:
    yen: int


def new_price(value: object) -> Price:
    if isinstance(value, bool):
        raise ValueError("price must be a number")

    if isinstance(value, int):
        yen = value
    elif isinstance(value, float):
        yen = int(value)
    else:
        digits = "".join(char for char in str(value) if char.isdigit())
        if not digits:
            yen = 0
        else:
            yen = int(digits)

    if yen < 0:
        raise ValueError("price must be non-negative")
    if yen > MAX_PRICE_YEN:
        raise ValueError(f"price must be at most {MAX_PRICE_YEN}")

    return Price(yen)
