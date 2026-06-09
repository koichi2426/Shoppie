from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware # ★インポートを追加
import logging

logging.basicConfig(level=logging.INFO)

# 相対インポート：app/ ディレクトリ内から取得
from app.langgraph_agent import run_agent, get_memory_state

app = FastAPI()

# --- ★ここからCORS設定を追加 ---

# 許可するオリジン（フロントエンドのURL）のリスト
origins = [
    "https://shoppie-agent.com", # Vercelのデプロイ先
    "http://localhost:3000",      # ローカルでの開発用
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # すべてのメソッド（GET, POSTなど）を許可
    allow_headers=["*"], # すべてのヘッダーを許可
)

# --- ★ここまでCORS設定 ---


class ChatRequest(BaseModel):
    user_input: str
    thread_id: str = "default"

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    user_input = body.get("message", "")
    thread_id = body.get("thread_id", "default")
    
    response = await run_agent(user_input, thread_id=thread_id)
    return {"response": response}

@app.get("/memory/{thread_id}")
async def memory(thread_id: str):
    checkpoint = get_memory_state(thread_id)

    if not checkpoint or not hasattr(checkpoint, "state"):
        return {"message": f"No memory found for thread_id: {thread_id}"}

    state_data = {
        k: [str(msg) for msg in v] if isinstance(v, list) else str(v)
        for k, v in checkpoint.state.items()
    }

    return {
        "thread_id": thread_id,
        "keys": list(checkpoint.state.keys()),
        "state": state_data
    }
