export async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 100;
  const maxDelay = options.maxDelay ?? 2000;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (client errors, not transient)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const jitter = delay * (0.5 + Math.random() * 0.5); // Add randomness
        console.log(`[RETRY] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(jitter)}ms`);
        await new Promise(r => setTimeout(r, jitter));
      }
    }
  }

  throw lastError;
}
