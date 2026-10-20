/** Simple in-memory sliding-window rate limiter (per process). */
export function createRateLimiter(limitPerMinute: number) {
  const hits = new Map<string, number[]>();
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [k, v] of hits) {
      const f = v.filter((t) => t > cutoff);
      if (f.length) hits.set(k, f);
      else hits.delete(k);
    }
  }, 60_000).unref();

  return function allow(key: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => t > now - 60_000);
    if (arr.length >= limitPerMinute) {
      hits.set(key, arr);
      return { allowed: false, retryAfter: Math.ceil((arr[0] + 60_000 - now) / 1000) };
    }
    arr.push(now);
    hits.set(key, arr);
    return { allowed: true, retryAfter: 0 };
  };
}
