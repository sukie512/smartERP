import { useState, useEffect, useCallback } from 'react';

/**
 * Generic hook for API calls.
 * Usage:
 *   const { data, loading, error, refetch } = useApi(() => customers.list());
 */
export function useApi(fn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn();
      setData(res.data ?? res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for mutations (create/update/delete).
 * Usage:
 *   const { submit, loading } = useMutation((d) => customers.create(d), { onSuccess });
 */
export function useMutation(fn, { onSuccess, onError } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const submit = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn(data);
      onSuccess?.(res.data ?? res);
      return res;
    } catch (e) {
      setError(e.message);
      onError?.(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [fn, onSuccess, onError]);

  return { submit, loading, error };
}
