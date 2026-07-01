import logging
import os

logger = logging.getLogger("shoppie.marketplace")


def is_yahoo_configured() -> bool:
    return bool(os.getenv("YAHOO_APP_ID"))


def is_rakuten_configured() -> bool:
    return bool(os.getenv("RAKUTEN_APP_ID"))


def is_amazon_configured() -> bool:
    return all(
        [
            os.getenv("AMAZON_ACCESS_KEY"),
            os.getenv("AMAZON_SECRET_KEY"),
            os.getenv("AMAZON_PARTNER_TAG"),
            os.getenv("AMAZON_REGION"),
        ]
    )


def log_marketplace_status() -> None:
    status = {
        "yahoo": is_yahoo_configured(),
        "rakuten": is_rakuten_configured(),
        "amazon": is_amazon_configured(),
    }
    logger.info("marketplace credentials configured: %s", status)
