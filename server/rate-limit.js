const MAX_ATTEMPT_BUCKETS = 10000;

function pruneAttempts(attempts, now = Date.now()) {
  for (const [key, bucket] of attempts) if (bucket.until <= now) attempts.delete(key);
  while (attempts.size > MAX_ATTEMPT_BUCKETS) attempts.delete(attempts.keys().next().value);
}

function createRateLimiter(attempts, fail) {
  return (key, max) => (req, res, next) => {
    const id = `${key}:${req.ip}`;
    const now = Date.now();
    const current = attempts.get(id);
    const bucket = current && current.until > now ? current : { count: 0, until: now + 3600000 };
    bucket.count++;
    attempts.set(id, bucket);
    if (attempts.size > MAX_ATTEMPT_BUCKETS) pruneAttempts(attempts, now);
    if (bucket.count > max) return fail(res, 429, 'Слишком много запросов. Попробуйте позже.');
    next();
  };
}

module.exports = { MAX_ATTEMPT_BUCKETS, pruneAttempts, createRateLimiter };
