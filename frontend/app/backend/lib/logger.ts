type LogData = Record<string, unknown>;

function serialize(data?: LogData): string {
  if (!data) return '';
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function truncate(text: string, maxLen = 120): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 3)}...`;
}

export const logger = {
  info(scope: string, message: string, data?: LogData) {
    console.log(`[Shoppie:${scope}] ${message}`, data ? serialize(data) : '');
  },
  warn(scope: string, message: string, data?: LogData) {
    console.warn(`[Shoppie:${scope}] ${message}`, data ? serialize(data) : '');
  },
  error(scope: string, message: string, data?: LogData) {
    console.error(`[Shoppie:${scope}] ${message}`, data ? serialize(data) : '');
  },
  truncate,
};
