from infrastructure.log_util import setup_logging
from infrastructure.router.fastapi import create_app

setup_logging()
app = create_app()
