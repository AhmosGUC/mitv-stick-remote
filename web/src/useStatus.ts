import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { DeviceStatus } from './types';

/** Polls the stick's status. `error` is set when the local server itself is unreachable. */
export function useStatus(intervalMs: number) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.status());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { status, error, refresh };
}
