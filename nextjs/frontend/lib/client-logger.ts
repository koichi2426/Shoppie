type LogData = Record<string, unknown>;

function serialize(data?: LogData): string {
  if (!data) return '';
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

const isDev = process.env.NODE_ENV === 'development';

export const clientLogger = {
  info(message: string, data?: LogData) {
    if (!isDev) return;
    console.log(`[Shoppie:client] ${message}`, data ? serialize(data) : '');
  },
  warn(message: string, data?: LogData) {
    console.warn(`[Shoppie:client] ${message}`, data ? serialize(data) : '');
  },
  error(message: string, data?: LogData) {
    console.error(`[Shoppie:client] ${message}`, data ? serialize(data) : '');
  },
};
