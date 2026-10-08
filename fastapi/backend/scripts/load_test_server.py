"""負荷試験用に、Bedrock とモール API を一定時間待つ偽物に差し替えて API を起動する。

外部サービスの速さやクォータに左右されず、API プロセス自体が同時リクエストを
どれだけさばけるかだけを測るため。LangGraph のグラフ・MemorySaver・FastAPI の
経路は本番と同じものを使う。

実行: PYTHONPATH=. python scripts/load_test_server.py --port 8765
"""

import argparse
import json
import os
import socket
import time

from langchain_core.messages import AIMessage, ToolMessage, HumanMessage
from langchain_core.runnables import RunnableLambda

# The fake LLM never calls Bedrock. Allow this server to start before AWS login;
# these prefixed dummy values do not affect the RDS Secrets Manager task role.
os.environ.setdefault("BEDROCK_AWS_ACCESS_KEY_ID", "load-test-only")
os.environ.setdefault("BEDROCK_AWS_SECRET_ACCESS_KEY", "load-test-only")

from infrastructure.gateways.amazon import amazon_api
from infrastructure.gateways.langgraph import langgraph_agent
from infrastructure.gateways.rakuten import rakuten_api
from infrastructure.gateways.yahoo import yahoo_api

TOOL_NAMES = [
    "search_yahoo_products_with_filters_tool",
    "search_rakuten_products_with_filters_tool",
    "search_amazon_products_with_filters_tool",
]


class FakeLLM:
    """1 回目はモール 3 つの検索を指示し、ツール結果を受けたら短く返答する。"""

    def __init__(self, delay_s: float):
        self.delay_s = delay_s

    def bind_tools(self, _tools):
        return RunnableLambda(self._invoke)

    def _invoke(self, prompt_value):
        # Bedrock の応答待ちを、同期の I/O 待ちとして再現する。
        time.sleep(self.delay_s)
        messages = prompt_value.to_messages()
        if messages and isinstance(messages[-1], ToolMessage):
            turns = sum(isinstance(m, HumanMessage) for m in messages)
            return AIMessage(content=f"見つけたよ！（会話の往復: {turns}）")
        return AIMessage(
            content="",
            tool_calls=[
                {"name": name, "args": {"keyword": "テスト", "filters": {}}, "id": f"call_{i}"}
                for i, name in enumerate(TOOL_NAMES)
            ],
        )


def fake_search(marketplace: str, delay_s: float):
    def search(*_args, **_kwargs) -> str:
        time.sleep(delay_s)
        products = [
            {"title": f"テスト商品 {i}", "price": 1000 + i, "marketplace": marketplace}
            for i in range(20)
        ]
        return json.dumps(products, ensure_ascii=False)

    return search


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--llm-delay", type=float, default=1.0)
    parser.add_argument("--mall-delay", type=float, default=1.5)
    args = parser.parse_args()
    os.environ.setdefault("SHOPPIE_INSTANCE_ID", f"{socket.gethostname()}:{args.port}")

    langgraph_agent.llm = FakeLLM(args.llm_delay)
    yahoo_api.search_products_with_filters = fake_search("yahoo", args.mall_delay)
    rakuten_api.search_products_with_filters = fake_search("rakuten", args.mall_delay)
    amazon_api.search_products_with_filters = fake_search("amazon", args.mall_delay)

    import uvicorn
    from main import app

    # 本番(Gunicorn -w 1 + UvicornWorker)と同じく 1 プロセス・1 イベントループで動かす。
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
