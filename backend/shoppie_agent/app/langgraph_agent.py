# ----------------------------
# 必要なライブラリをインポート
# ----------------------------
import os
import logging
import boto3
import time
import json
import random
from typing_extensions import Annotated, TypedDict
from dotenv import load_dotenv
from botocore.config import Config
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import AnyMessage, add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, ToolMessage, HumanMessage
from langchain_aws import ChatBedrock
from langgraph.checkpoint.memory import MemorySaver

# ----------------------------
# Claude用トークン数の概算カウント
# ----------------------------
def count_tokens(text: str) -> int:
    return int(len(text) / 4) + 1

def truncate_messages(messages, max_tokens=1000):
    total = 0
    result = []
    for m in reversed(messages):
        tokens = count_tokens(m.content)
        if total + tokens <= max_tokens:
            result.insert(0, m)
            total += tokens
        else:
            break
    return result

# ----------------------------
# ★変更点 1: Yahoo API用のStructuredToolをインポート
# ----------------------------
from app.tools.yahoo.yahoo_tool_wrappers import (
    search_yahoo_products_with_filters_tool
)
# Amazon API（コメントアウト）
# from app.tools.amazon.amazon_tool_wrappers import (
#     search_amazon_products_with_filters_tool
# )

# ----------------------------
# .envファイルを読み込む
# ----------------------------
# ルートの.envファイルも読み込めるようにパスを調整
dotenv_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(dotenv_path)

from app.log_util import truncate

logger = logging.getLogger("shoppie.agent")

HAIKU_45_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"
LEGACY_BEDROCK_MODEL_IDS = {
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0",
}
INFERENCE_PROFILE_PREFIXES = ("us.", "eu.", "jp.", "au.", "global.")
REGION_TO_GEO_PREFIX = {
    "us-east-1": "us",
    "us-east-2": "us",
    "us-west-1": "us",
    "us-west-2": "us",
    "ca-central-1": "us",
    "eu-west-1": "eu",
    "eu-west-2": "eu",
    "eu-west-3": "eu",
    "eu-central-1": "eu",
    "eu-north-1": "eu",
    "ap-northeast-1": "jp",
    "ap-southeast-2": "au",
}


def to_inference_profile_id(model_id: str, region: str) -> str:
    if model_id.startswith(INFERENCE_PROFILE_PREFIXES):
        return model_id

    if "claude-haiku-4-5" not in model_id:
        return model_id

    geo_prefix = REGION_TO_GEO_PREFIX.get(region, "global")
    base_model_id = model_id if model_id.startswith("anthropic.") else HAIKU_45_MODEL_ID
    return f"{geo_prefix}.{base_model_id}"


def resolve_bedrock_model_id(region: str) -> str:
    model_id = os.getenv("BEDROCK_MODEL_ID", HAIKU_45_MODEL_ID)
    legacy_markers = ("claude-3-haiku", "claude-3-5-haiku")
    is_legacy = model_id in LEGACY_BEDROCK_MODEL_IDS or any(
        marker in model_id for marker in legacy_markers
    )
    if is_legacy:
        logger.warning(
            "BEDROCK_MODEL_ID=%s is legacy; using %s instead",
            model_id,
            HAIKU_45_MODEL_ID,
        )
        model_id = HAIKU_45_MODEL_ID

    return to_inference_profile_id(model_id, region)


BEDROCK_AWS_REGION = os.getenv("BEDROCK_AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = resolve_bedrock_model_id(BEDROCK_AWS_REGION)
logger.info("Using Bedrock model: %s (region=%s)", BEDROCK_MODEL_ID, BEDROCK_AWS_REGION)

# ----------------------------
# AWS Bedrockクライアントの初期化
# ----------------------------
bedrock_client = boto3.client(
    service_name="bedrock-runtime",
    region_name=BEDROCK_AWS_REGION,
    aws_access_key_id=os.getenv("BEDROCK_AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("BEDROCK_AWS_SECRET_ACCESS_KEY"),
    config=Config(retries={"max_attempts": 3, "mode": "adaptive"})
)

# ----------------------------
# Claude (Bedrock) 設定
# ----------------------------
llm = ChatBedrock(
    model=BEDROCK_MODEL_ID,
    client=bedrock_client,
    temperature=0.7,
    max_tokens=512,
    model_kwargs={
        "system": """
あなたはショッピングアシスタントです。店頭でお客様をお迎えするような気持ちで、親切で丁寧な対応をお願いします。
お客様のご要望にお応えする際は、必ず search_yahoo_products_with_filters_tool を使ってください。
ツールでは価格帯・セール品・新品/中古・送料無料・並び順（安い順・レビュー多い順など）で絞り込めます。
ユーザーが条件を言っていない項目は filters に含めないでください。
"""
        # Amazon API（コメントアウト）
        # - search_amazon_products_with_filters_tool（推奨）
    } # ★変更点 2: システムプロンプト内のツール名を変更
)

# ----------------------------
# LangGraphで使うステート定義
# ----------------------------
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

# ----------------------------
# Claudeにプロンプトと履歴を渡すノード
# ----------------------------
def llm_node(state: State):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "ショッピングアシスタントとして、必ずStructuredToolを使い、ユーザーの条件をfiltersに反映してください。"),
        MessagesPlaceholder(variable_name="messages")
    ])
    # ★変更点 3: LLMにバインドするツールをYahoo用に変更
    agent = prompt | llm.bind_tools([
        search_yahoo_products_with_filters_tool
    ])
    # Amazon API（コメントアウト）
    # agent = prompt | llm.bind_tools([
    #     search_amazon_products_with_filters_tool
    # ])
    result = agent.invoke(state)
    return {"messages": result}

# ----------------------------
# StructuredToolノード定義
# ----------------------------
# ★変更点 4: ToolNodeで実行するツールをYahoo用に変更
tool_node = ToolNode([
    search_yahoo_products_with_filters_tool
])
# Amazon API（コメントアウト）
# tool_node = ToolNode([
#     search_amazon_products_with_filters_tool
# ])

# ----------------------------
# チェックポイントメモリ定義
# ----------------------------
memory = MemorySaver()

# ----------------------------
# グラフ構築関数
# ----------------------------
def build_graph():
    graph = StateGraph(State)
    graph.add_node("llm_agent", llm_node)
    graph.add_node("tool", tool_node)
    graph.add_edge(START, "llm_agent")
    graph.add_conditional_edges("llm_agent", tools_condition, {
        "tools": "tool",
        "__end__": END
    })
    graph.add_edge("tool", END)
    return graph.compile(checkpointer=memory)

graph_app = build_graph()

# ----------------------------
# レスポンス解析ヘルパー
# ----------------------------
def count_products(parsed_tool_content) -> int:
    if isinstance(parsed_tool_content, list):
        return len(parsed_tool_content)
    return 0


# ----------------------------
# グラフを非同期実行する関数
# ----------------------------
async def run_agent(user_input: str, thread_id: str = "default") -> dict:
    start = time.perf_counter()
    checkpoint = memory.get({"configurable": {"thread_id": thread_id}})
    past_messages = checkpoint.get("state", {}).get("messages", []) if checkpoint else []

    limited_past = truncate_messages([m for m in past_messages if isinstance(m, HumanMessage)])
    limited_past.append(HumanMessage(content=user_input))
    human_messages = limited_past

    logger.info(
        "agent start thread_id=%s history_messages=%s input=%r",
        thread_id,
        len(limited_past) - 1,
        truncate(user_input),
    )

    def run_with_retry():
        delay = 1
        for attempt in range(5):
            try:
                return list(graph_app.stream(
                    {"messages": human_messages},
                    {"configurable": {"thread_id": thread_id}},
                ))
            except Exception as e:
                if "ThrottlingException" in str(e):
                    logger.warning(
                        "bedrock throttled thread_id=%s attempt=%s retry_in_s=%.1f",
                        thread_id,
                        attempt + 1,
                        delay,
                    )
                    time.sleep(delay + random.uniform(0, 0.5))
                    delay *= 2
                else:
                    raise e
        raise RuntimeError("Claude API throttled after multiple retries.")

    complete_raw_events = []
    parsed_tool_content = None

    try:
        for event in run_with_retry():
            node_name = next(iter(event.keys()))
            complete_raw_events.append(event)
            logger.info("graph event thread_id=%s node=%s", thread_id, node_name)

            if "llm_agent" in event:
                messages = event["llm_agent"].get("messages", [])
                if messages:
                    last = messages[-1]
                    tool_calls = getattr(last, "tool_calls", None) or []
                    logger.info(
                        "llm response thread_id=%s tool_calls=%s content=%r",
                        thread_id,
                        len(tool_calls),
                        truncate(getattr(last, "content", "") or ""),
                    )

            if "tool" in event:
                for msg in event["tool"].get("messages", []):
                    try:
                        parsed_tool_content = json.loads(msg.content)
                    except Exception:
                        parsed_tool_content = msg.content

                    if isinstance(parsed_tool_content, list):
                        logger.info(
                            "tool result thread_id=%s products=%s",
                            thread_id,
                            len(parsed_tool_content),
                        )
                    elif isinstance(parsed_tool_content, dict):
                        logger.info(
                            "tool result thread_id=%s payload=%s",
                            thread_id,
                            list(parsed_tool_content.keys()),
                        )
                    else:
                        logger.info(
                            "tool result thread_id=%s type=%s",
                            thread_id,
                            type(parsed_tool_content).__name__,
                        )
    except Exception as e:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "agent failed thread_id=%s duration_ms=%.0f error=%s",
            thread_id,
            duration_ms,
            e,
        )
        return {"error": str(e)}

    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "agent done thread_id=%s duration_ms=%.0f events=%s products=%s",
        thread_id,
        duration_ms,
        len(complete_raw_events),
        count_products(parsed_tool_content),
    )

    return {
        "complete_raw_events": complete_raw_events,
        "parsed_tool_content": parsed_tool_content
    }

# ----------------------------
# 現在の会話履歴を取得
# ----------------------------
def get_memory_state(thread_id: str):
    return memory.get({"configurable": {"thread_id": thread_id}})


def list_memory_thread_ids() -> list[str]:
    return list(memory.storage.keys())


def delete_thread_memory(thread_id: str) -> bool:
    if thread_id not in memory.storage:
        return False
    memory.delete_thread(thread_id)
    return True


def delete_all_thread_memories() -> int:
    thread_ids = list(memory.storage.keys())
    for thread_id in thread_ids:
        memory.delete_thread(thread_id)
    return len(thread_ids)


def serialize_memory_messages(checkpoint) -> list[dict[str, str]]:
    if not checkpoint:
        return []

    if isinstance(checkpoint, dict):
        state = checkpoint.get("state") or checkpoint.get("channel_values") or {}
    else:
        state = (
            getattr(checkpoint, "state", None)
            or getattr(checkpoint, "channel_values", None)
            or {}
        )

    messages = state.get("messages", []) if isinstance(state, dict) else getattr(state, "messages", [])

    serialized = []
    for message in messages:
        role = type(message).__name__
        content = getattr(message, "content", "")
        if isinstance(content, list):
            content = json.dumps(content, ensure_ascii=False)
        serialized.append(
            {
                "role": role,
                "content": str(content),
            }
        )
    return serialized

# ----------------------------
# メモリデバッグ表示関数
# ----------------------------
def debug_memory(thread_id: str = "default"):
    checkpoint = memory.get({"configurable": {"thread_id": thread_id}})
    print(f"\n🧠 Debug: Memory contents for thread_id='{thread_id}'")
    if checkpoint:
        messages = checkpoint.get("state", {}).get("messages", [])
        for i, m in enumerate(messages):
            if isinstance(m, HumanMessage):
                print(f"[{i}] HumanMessage: {m.content}")
            else:
                print(f"[{i}] Skipped non-HumanMessage ({type(m).__name__})")
    else:
        print("No memory found for this thread.")
    print("-" * 40)