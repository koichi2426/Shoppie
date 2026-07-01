from infrastructure.log_util import setup_logging
from infrastructure.marketplace_config import log_marketplace_status
from infrastructure.router.fastapi import create_app

setup_logging()
log_marketplace_status()
app = create_app()
