import re

MAX_MESSAGE_CHARS = 150
MAX_SENTENCES_WITH_PRODUCTS = 2
PRODUCT_LIST_FALLBACK = "いいの見つけたよ！下のカードで見てみてね♪"


class AgentMessagePolicy:
  """エージェント応答文を画面向けに短文化するドメインルール。"""

  def compact(self, message: str, product_count: int) -> str:
    text = message.strip()
    if not text:
      return text
    if product_count <= 0:
      return text

    if self._looks_like_product_list(text):
      return PRODUCT_LIST_FALLBACK

    sentences = self._split_sentences(text)
    if sentences:
      text = "".join(sentences[:MAX_SENTENCES_WITH_PRODUCTS])

    if len(text) > MAX_MESSAGE_CHARS:
      clipped = text[:MAX_MESSAGE_CHARS]
      last_period = max(clipped.rfind("。"), clipped.rfind("！"), clipped.rfind("？"))
      if last_period >= 40:
        text = clipped[: last_period + 1]
      else:
        text = clipped.rstrip() + "…"

    return text

  @staticmethod
  def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[。！？!?])\s*", text.strip())
    return [part.strip() for part in parts if part.strip()]

  @staticmethod
  def _looks_like_product_list(message: str) -> bool:
    if message.count("円") >= 2:
      return True
    if message.count("★") >= 1 or "送料" in message:
      return True
    numbered_items = re.findall(r"(?m)^\s*\d+[\.．)、]", message)
    return len(numbered_items) >= 2
