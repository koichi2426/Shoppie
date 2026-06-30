import { useCallback, useRef } from 'react';
import Cookies from 'js-cookie';
import { clientLogger } from '@/lib/client-logger';

const COOKIE_KEY = 'shoppie_context_id';
const COOKIE_EXPIRES_DAYS = 7;

export function useContextId() {
  const contextIdRef = useRef<string>('');

  const ensureContextId = useCallback(() => {
    if (contextIdRef.current) {
      return contextIdRef.current;
    }

    const savedContextId = Cookies.get(COOKIE_KEY);
    if (savedContextId) {
      contextIdRef.current = savedContextId;
      clientLogger.info('session reuse', { contextId: savedContextId });
      return savedContextId;
    }

    const newContextId = crypto.randomUUID();
    Cookies.set(COOKIE_KEY, newContextId, { expires: COOKIE_EXPIRES_DAYS });
    contextIdRef.current = newContextId;
    clientLogger.info('session created', { contextId: newContextId });
    return newContextId;
  }, []);

  const resetContextId = useCallback(() => {
    const newContextId = crypto.randomUUID();
    Cookies.set(COOKIE_KEY, newContextId, { expires: COOKIE_EXPIRES_DAYS });
    contextIdRef.current = newContextId;
    clientLogger.info('session created', { contextId: newContextId });
    return newContextId;
  }, []);

  return { ensureContextId, resetContextId };
}
