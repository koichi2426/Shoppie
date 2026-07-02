# ----------------------------
# 必要なライブラリをインポート
# ----------------------------
import os
import logging
import asyncio
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
from langchain_core.runnables import RunnableConfig
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
# 商品検索ツール（Yahoo / 楽天 / Amazon）
# ----------------------------
dotenv_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".env")
load_dotenv(dotenv_path)

from infrastructure.gateways.langgraph.tool_result_summary import messages_for_llm
from infrastructure.gateways.langgraph.llm_context_log import log_llm_context
from infrastructure.log_util import truncate, normalize_messages
from infrastructure.gateways.amazon.amazon_api import is_amazon_api_eligibility_blocked
from infrastructure.marketplace_config import (
    describe_amazon_capability,
    is_amazon_configured,
    is_rakuten_configured,
    is_yahoo_configured,
    log_marketplace_status,
)
from infrastructure.gateways.yahoo.yahoo_tool_wrappers import (
    search_yahoo_products_with_filters_tool,
)
from infrastructure.gateways.rakuten.rakuten_tool_wrappers import (
    search_rakuten_products_with_filters_tool,
)
from infrastructure.gateways.amazon.amazon_tool_wrappers import (
    search_amazon_products_with_filters_tool,
)

SHOPPING_TOOLS = [
    search_yahoo_products_with_filters_tool,
    search_rakuten_products_with_filters_tool,
    search_amazon_products_with_filters_tool,
]


def build_shopping_system_prompt() -> str:
    availability = []
    if is_yahoo_configured():
        availability.append("Yahoo")
    if is_rakuten_configured():
        availability.append("楽天")
    amazon_note = ""
    if is_amazon_configured():
        amazon_capability = describe_amazon_capability(is_amazon_api_eligibility_blocked())
        if "検索リンクのみ" in amazon_capability:
            amazon_note = (
                f"\nAmazon: {amazon_capability}。"
                "ツールは呼び出してよいが、返るのはパートナータグ付き検索リンク1件のみ。"
                "「商品が見つからなかった」「APIが使えない」とは言わず、"
                "「Amazonの検索ページはこちらから見られるよ」と案内すること。"
            )
        else:
            availability.append("Amazon")
    availability_text = "、".join(availability) if availability else "なし"
    configured_tools = []
    if is_yahoo_configured():
        configured_tools.append("search_yahoo_products_with_filters_tool")
    if is_rakuten_configured():
        configured_tools.append("search_rakuten_products_with_filters_tool")
    if is_amazon_configured():
        configured_tools.append("search_amazon_products_with_filters_tool")
    configured_tools_text = "、".join(configured_tools) if configured_tools else "なし"

    return f"""
あなたは「Shoppie（ショッピー）」という名前の、かわいくて明るいショッピングの相棒です。
ユーザーと一緒にお買い物を楽しむような、親しみやすい口調で話してください。

口調:
- 一人称は「わたし」または「Shoppie」
- 語尾は「〜だよ」「〜ね」「〜かな？」など柔らかく
- 堅い敬語や店員のような丁寧語の使いすぎは避ける
- 絵文字は返答に最大1つまで（なくてもよい）

商品検索には必ず次のツールを使ってください。APIキーや技術的制約について推測して説明せず、まずツールを実行してください。
- search_yahoo_products_with_filters_tool: Yahoo!ショッピング
- search_rakuten_products_with_filters_tool: 楽天市場
- search_amazon_products_with_filters_tool: Amazon.co.jp

サーバーで利用可能なツール: {configured_tools_text}
サーバーで設定済みのモール: {availability_text}{amazon_note}

商品検索時のルール:
- モール指定がない場合は、利用可能なツールをすべて1回の応答で並列実行してください（Yahooだけでは不十分）。
- 「Amazonで」「楽天で」など特定モール指定時は、そのツールのみ実行してください。
- 商品の比較・横断検索の要望でも、利用可能なツールをすべて使ってください。
- 画面にはツールで取得した商品がそのまま表示されます。件数の絞り込みはサーバー側では行いません。
- 「この中で一番高い」「一番安い」「どれがおすすめ」など、直前の検索結果への質問は、直前のツール結果（price_yen 付き）を見て答えてください。同じキーワードで再検索しないでください。
- あなたが参照できる商品データは、常に直近1回のツール実行結果だけです。それより前の検索結果は見えません。
- 価格比較は price_yen（円・数値）を使ってください。

ユーザーが特定のモール（Yahoo、楽天、Amazon）を指定した場合は、必ずそのツールを呼び出してください。
「Amazonから」「楽天で」などの指定があるのに検索しないで断ることは禁止です。
モールの指定がない場合は、質問でモールを聞かず、直ちに利用可能なすべてのツールで検索してください。
「どちらのモールがよいですか」などの確認は禁止です。商品名が分かれば即検索です。
「他でも探して」「どこが安い」「楽天やAmazonも」「複数のモールで比較」などの要望があれば複数のツールを使ってください。
会話の前後関係を必ず踏まえてください。並べ替えや条件の変更だけの指示では、直前の検索キーワードを維持してください。
検索結果が0件のときは、キーワードを短く・シンプルにして再検索してください。
ツール実行後は、全件の商品リスト（タイトル・価格など最小フィールド）を見て状況を把握し、短く返答してください。URL・画像・説明文の列挙は不要です（画面カードに表示済み）。
error があったモールはその旨を簡潔に伝えてください。
返答文は必ず短くしてください（目安: 1〜3文、120字以内）。商品名・価格・評価・送料の列挙や番号付きリスト、見出し、絵文字だらけの長文は禁止です。
商品は画面のカードで表示されるため、本文では「見つけたよ！」「これおすすめかな？」程度の一言で十分です。
Amazonツールが is_amazon_search_link の商品1件を返した場合は、検索失敗ではありません。
「Amazonでここから探してみてね」とリンクを案内し、技術的制限やエラーとして断らないでください。
価格帯・並び順など、ユーザーが言っていない条件は filters に含めないでください。
"""


SHOPPING_SYSTEM_PROMPT = build_shopping_system_prompt()
log_marketplace_status()

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
    max_tokens=256,
    model_kwargs={
        "system": SHOPPING_SYSTEM_PROMPT,
    },
)

# ----------------------------
# LangGraphで使うステート定義
# ----------------------------
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

# ----------------------------
# Claudeにプロンプトと履歴を渡すノード
# ----------------------------
def llm_node(state: State, config: RunnableConfig):
    prompt = ChatPromptTemplate.from_messages([
        MessagesPlaceholder(variable_name="messages"),
    ])
    agent = prompt | llm.bind_tools(SHOPPING_TOOLS)
    thread_id = config.get("configurable", {}).get("thread_id", "unknown")
    llm_messages = messages_for_llm(state.get("messages", []))
    log_llm_context(thread_id, llm_messages)
    result = agent.invoke({"messages": llm_messages})
    return {"messages": result}


tool_node = ToolNode(SHOPPING_TOOLS)

# ----------------------------
# チェックポイントメモリ定義
# ----------------------------
memory = MemorySaver()

THREAD_IDLE_TTL_SECONDS = 180
THREAD_CLEANUP_INTERVAL_SECONDS = 60

_thread_last_access: dict[str, float] = {}
_cleanup_task: asyncio.Task | None = None


def touch_thread_access(thread_id: str) -> None:
    _thread_last_access[thread_id] = time.monotonic()


def forget_thread_access(thread_id: str) -> None:
    _thread_last_access.pop(thread_id, None)


def cleanup_idle_thread_memories() -> int:
    """最終アクセスから THREAD_IDLE_TTL_SECONDS 経過したスレッドを削除する。"""
    now = time.monotonic()
    stale_thread_ids = [
        thread_id
        for thread_id, last_access in list(_thread_last_access.items())
        if now - last_access >= THREAD_IDLE_TTL_SECONDS
    ]

    deleted = 0
    for thread_id in stale_thread_ids:
        if delete_thread_memory(thread_id):
            deleted += 1

    if deleted:
        logger.info(
            "thread memory cleanup idle_ttl_s=%s deleted=%s remaining=%s",
            THREAD_IDLE_TTL_SECONDS,
            deleted,
            len(memory.storage),
        )
    return deleted


async def _thread_memory_cleanup_loop() -> None:
    while True:
        await asyncio.sleep(THREAD_CLEANUP_INTERVAL_SECONDS)
        try:
            cleanup_idle_thread_memories()
        except Exception:
            logger.exception("thread memory cleanup failed")


def start_thread_memory_cleanup() -> asyncio.Task:
    global _cleanup_task
    if _cleanup_task is not None and not _cleanup_task.done():
        return _cleanup_task
    _cleanup_task = asyncio.create_task(_thread_memory_cleanup_loop())
    logger.info(
        "thread memory cleanup started idle_ttl_s=%s interval_s=%s",
        THREAD_IDLE_TTL_SECONDS,
        THREAD_CLEANUP_INTERVAL_SECONDS,
    )
    return _cleanup_task


async def stop_thread_memory_cleanup() -> None:
    global _cleanup_task
    if _cleanup_task is None:
        return
    _cleanup_task.cancel()
    try:
        await _cleanup_task
    except asyncio.CancelledError:
        pass
    _cleanup_task = None


def extract_checkpoint_messages(checkpoint) -> list:
    if not checkpoint:
        return []

    if isinstance(checkpoint, dict):
        state = checkpoint.get("channel_values") or checkpoint.get("state") or {}
    else:
        state = (
            getattr(checkpoint, "channel_values", None)
            or getattr(checkpoint, "state", None)
            or {}
        )

    if isinstance(state, dict):
        return normalize_messages(state.get("messages", []))
    return normalize_messages(getattr(state, "messages", []))


def is_empty_tool_result(message: ToolMessage) -> bool:
    content = message.content
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except json.JSONDecodeError:
            return False

    if isinstance(content, list):
        return len(content) == 0
    if isinstance(content, dict):
        if content.get("error"):
            return True
        if content.get("message") and not content.get("products"):
            return True
    return False


def route_after_tool(state: State) -> str:
    messages = state.get("messages", [])
    if not messages or not isinstance(messages[-1], ToolMessage):
        return END

    empty_tool_count = 0
    for message in reversed(messages):
        if isinstance(message, ToolMessage) and is_empty_tool_result(message):
            empty_tool_count += 1
            continue
        break

    if empty_tool_count >= 2:
        return END
    return "llm_agent"


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
    graph.add_conditional_edges("tool", route_after_tool, {
        "llm_agent": "llm_agent",
        END: END,
    })
    return graph.compile(checkpointer=memory)

graph_app = build_graph()

# ----------------------------
# レスポンス解析ヘルパー
# ----------------------------
def count_products(parsed_tool_content) -> int:
    if isinstance(parsed_tool_content, list):
        return len(parsed_tool_content)
    return 0


def merge_tool_content(current, new_content):
    """複数ツールの検索結果を1つの商品リストにまとめる。"""
    if isinstance(new_content, list):
        if current is None:
            return new_content
        if isinstance(current, list):
            return current + new_content
        return new_content
    if current is None:
        return new_content
    return current


# ----------------------------
# グラフを非同期実行する関数
# ----------------------------
async def run_agent(user_input: str, thread_id: str = "default") -> dict:
    start = time.perf_counter()
    touch_thread_access(thread_id)
    checkpoint = memory.get({"configurable": {"thread_id": thread_id}})
    past_messages = extract_checkpoint_messages(checkpoint)
    history_count = len(past_messages)

    logger.info(
        "agent start thread_id=%s history_messages=%s input=%r",
        thread_id,
        history_count,
        truncate(user_input),
    )

    def run_with_retry():
        delay = 1
        for attempt in range(5):
            try:
                return list(graph_app.stream(
                    {"messages": [HumanMessage(content=user_input)]},
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
                messages = normalize_messages(event["llm_agent"].get("messages", []))
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
                for msg in normalize_messages(event["tool"].get("messages", [])):
                    try:
                        content = json.loads(msg.content)
                    except Exception:
                        content = msg.content

                    if isinstance(content, dict) and content.get("error"):
                        logger.warning(
                            "tool error thread_id=%s error=%s",
                            thread_id,
                            content.get("error"),
                        )
                        continue

                    parsed_tool_content = merge_tool_content(parsed_tool_content, content)

                    if isinstance(content, list):
                        logger.info(
                            "tool result thread_id=%s products=%s total=%s",
                            thread_id,
                            len(content),
                            count_products(parsed_tool_content),
                        )
                    elif isinstance(content, dict):
                        logger.info(
                            "tool result thread_id=%s payload=%s",
                            thread_id,
                            list(content.keys()),
                        )
                    else:
                        logger.info(
                            "tool result thread_id=%s type=%s",
                            thread_id,
                            type(content).__name__,
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
    forget_thread_access(thread_id)
    checkpoint = memory.get({"configurable": {"thread_id": thread_id}})
    message_count = len(extract_checkpoint_messages(checkpoint))
    existed = thread_id in memory.storage
    if existed:
        memory.delete_thread(thread_id)
    logger.info(
        "thread memory delete thread_id=%s existed=%s message_count=%s",
        thread_id,
        existed,
        message_count,
    )
    return existed


def delete_all_thread_memories() -> int:
    thread_ids = list(memory.storage.keys())
    for thread_id in thread_ids:
        memory.delete_thread(thread_id)
    _thread_last_access.clear()
    return len(thread_ids)


def serialize_memory_messages(checkpoint) -> list[dict[str, str]]:
    messages = extract_checkpoint_messages(checkpoint)

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
        messages = extract_checkpoint_messages(checkpoint)
        for i, m in enumerate(messages):
            if isinstance(m, HumanMessage):
                print(f"[{i}] HumanMessage: {m.content}")
            else:
                print(f"[{i}] Skipped non-HumanMessage ({type(m).__name__})")
    else:
        print("No memory found for this thread.")
    print("-" * 40)