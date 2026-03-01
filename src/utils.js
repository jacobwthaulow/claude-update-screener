import { createHash } from 'node:crypto';

/**
 * Fetch with automatic retry on transient failures.
 * Uses Node 20+ built-in fetch.
 */
export async function fetchWithRetry(url, options = {}, retries = 2) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  const fetchOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      'User-Agent': 'ClaudeUpdatesWatcher/1.0',
      ...options.headers,
    },
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, fetchOptions);
      clearTimeout(timeout);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }

      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) throw err;
      await sleep(2000 * (attempt + 1));
    }
  }
}

/** SHA-256 hash of a string, returned as hex. */
export function hashContent(text) {
  return createHash('sha256').update(text).digest('hex');
}

/** Escape characters that break Telegram HTML parse mode. */
export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Truncate string to maxLength, appending "..." if truncated. */
export function truncate(text, maxLength = 500) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
