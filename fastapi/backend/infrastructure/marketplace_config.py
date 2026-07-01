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


def is_amazon_affiliate_configured() -> bool:
    return bool(os.getenv("AMAZON_PARTNER_TAG"))


def is_amazon_product_api_configured() -> bool:
    return is_amazon_creators_configured() or is_amazon_paapi_configured()


def is_amazon_configured() -> bool:
    return is_amazon_product_api_configured() or is_amazon_affiliate_configured()


def describe_amazon_capability(eligibility_blocked: bool = False) -> str:
    if is_amazon_product_api_configured() and not eligibility_blocked:
        return "商品検索API利用可"
    if is_amazon_affiliate_configured():
        return "検索リンクのみ（商品APIは資格不足または未設定）"
    return "未設定"


def log_marketplace_status(eligibility_blocked: bool = False) -> None:
    status = {
        "yahoo": is_yahoo_configured(),
        "rakuten": is_rakuten_configured(),
        "amazon_creators": is_amazon_creators_configured(),
        "amazon_paapi": is_amazon_paapi_configured(),
        "amazon_partner_tag": is_amazon_affiliate_configured(),
        "amazon_capability": describe_amazon_capability(eligibility_blocked),
    }
    logger.info("marketplace credentials configured: %s", status)
