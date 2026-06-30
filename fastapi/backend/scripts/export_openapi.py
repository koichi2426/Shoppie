"""FastAPI の OpenAPI スキーマを openapi.json に書き出す。"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# langgraph / Bedrock 初期化前にダミー値を入れて import を通す
os.environ.setdefault("BEDROCK_AWS_ACCESS_KEY_ID", "export-openapi")
os.environ.setdefault("BEDROCK_AWS_SECRET_ACCESS_KEY", "export-openapi")
os.environ.setdefault("BEDROCK_AWS_REGION", "us-east-1")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
FASTAPI_ROOT = BACKEND_ROOT.parent
OUTPUT_PATH = FASTAPI_ROOT / "openapi.json"

sys.path.insert(0, str(BACKEND_ROOT))

from infrastructure.router.fastapi import create_app  # noqa: E402


def main() -> None:
    app = create_app()
    schema = app.openapi()
    OUTPUT_PATH.write_text(
        json.dumps(schema, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
