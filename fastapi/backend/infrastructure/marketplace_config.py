import logging
import os

logger = logging.getLogger("shoppie.marketplace")


def is_yahoo_configured() -> bool:
    return bool(os.getenv("YAHOO_APP_ID"))


def is_rakuten_configured() -> bool:
    return bool(os.getenv("RAKUTEN_APP_ID") and os.getenv("RAKUTEN_ACCESS_KEY"))


def is_amazon_paapi_configured() -> bool:
    return all(
        [
            os.getenv("AMAZON_ACCESS_KEY"),
            os.getenv("AMAZON_SECRET_KEY"),
            os.getenv("AMAZON_PARTNER_TAG"),
            os.getenv("AMAZON_REGION"),
        ]
    )


def is_amazon_creators_configured() -> bool:
    return all(
        [
            os.getenv("AMAZON_CREATORS_CREDENTIAL_ID"),
            os.getenv("AMAZON_CREATORS_CREDENTIAL_SECRET"),
            os.getenv("AMAZON_PARTNER_TAG"),
        ]
    )


def is_amazon_configured() -> bool:
    return is_amazon_creators_configured() or is_amazon_paapi_configured() or bool(
        os.getenv("AMAZON_PARTNER_TAG")
    )


def log_marketplace_status() -> None:
    status = {
        "yahoo": is_yahoo_configured(),
        "rakuten": is_rakuten_configured(),
        "amazon_creators": is_amazon_creators_configured(),
        "amazon_paapi": is_amazon_paapi_configured(),
        "amazon_partner_tag": bool(os.getenv("AMAZON_PARTNER_TAG")),
    }
    logger.info("marketplace credentials configured: %s", status)
