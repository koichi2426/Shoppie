/**
 * LLM応答に含まれるMarkdown装飾や余計な記号を除去し、プレーンテキストに整える。
 */
export function cleanAgentMessage(text: string): string {
  if (!text) return text;

  let result = text.replace(/\r\n/g, '\n');

  // コードブロック・インラインコード
  result = result.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim()
  );
  result = result.replace(/`([^`]+)`/g, '$1');
  result = result.replace(/`/g, '');

  // 太字・斜体（** ... ** / __ ... __ / * ... *）
  for (let i = 0; i < 3; i++) {
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
    result = result.replace(/__([^_]+)__/g, '$1');
  }
  result = result.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '$1');
  result = result.replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, '$1');

  // 残ったマークダウン記号
  result = result.replace(/\*\*/g, '');
  result = result.replace(/__/g, '');

  // 見出し記号
  result = result.replace(/^#{1,6}\s+/gm, '');

  // スマートクォート・アポストロフィを通常の引用符に
  result = result.replace(/[\u2018\u2019\u2032\u0060]/g, "'");
  result = result.replace(/[\u201C\u201D\u2033]/g, '"');

  // 行頭の箇条書き記号（- * +）の直後スペースのみ整える
  result = result.replace(/^(\s*)[-*+]\s+/gm, '$1');

  // 連続スペースを1つに（改行は維持）
  result = result.replace(/[^\S\n]+/g, ' ');

  return result
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
