/**
 * Help Scout Mailbox API v2 client.
 * Base URL: https://api.helpscout.net/v2
 * Auth: Bearer token (OAuth)
 * Rate limiting: X-RateLimit-Retry-After (seconds until reset)
 * Pagination: HAL _embedded with page.totalPages
 */
import { getAccessToken, forceRefreshToken } from './auth.js';
import { USER_AGENT, parseJsonBody, parseCreatedResponse } from './http.js';

const BASE_URL = 'https://api.helpscout.net/v2';
const MAX_RETRIES = 3;

/**
 * Make an authenticated request to the Mailbox API.
 * Handles 401 (token refresh via getAccessToken) and 429 (rate limit wait).
 */
async function request(method, path, { body, params } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }

  let tokenRefreshed = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await getAccessToken();

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    };

    if (body !== null && body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (res.status === 401 && !tokenRefreshed) {
      tokenRefreshed = true;
      await forceRefreshToken();
      continue;
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('X-RateLimit-Retry-After') ?? '60', 10);
      process.stderr.write(`Rate limited. Waiting ${retryAfter}s...\n`);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (res.status === 204) return null;

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        message = data.message ?? data.error ?? message;
      } catch {
        // ignore parse error
      }
      throw Object.assign(new Error(message), { status: res.status });
    }

    const parsed = await parseJsonBody(res);
    return parseCreatedResponse(res, parsed) ?? parsed;
  }

  throw new Error('Exceeded maximum retries due to rate limiting.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const USER_STATUSES = ['active', 'away'];

/**
 * Build the customStatus object for the Set User Status endpoint.
 * The Mailbox API requires `text` whenever customStatus is present, so emoji
 * or emojiName without text is rejected here rather than by the live API.
 */
export function buildCustomStatus({ text, emoji, emojiName } = {}) {
  if (!text && !emoji && !emojiName) return undefined;
  if (!text) {
    throw new Error('customStatus requires text (emoji/emojiName need accompanying text)');
  }
  const customStatus = { text };
  if (emoji) customStatus.emoji = emoji;
  if (emojiName) customStatus.emojiName = emojiName;
  return customStatus;
}

/**
 * Path and body for Mailbox API Create Note.
 * POST /v2/conversations/{conversationId}/notes — not /threads/note (PATCH only).
 * @see https://developer.helpscout.com/mailbox-api/endpoints/conversations/threads/note/
 */
export function buildCreateNoteRequest(conversationId, { text, user } = {}) {
  const body = { text };
  if (typeof user === 'number') body.user = user;
  return {
    path: `/conversations/${conversationId}/notes`,
    body,
  };
}

export const mailbox = {
  /**
   * GET a single page. Returns raw API response.
   */
  async get(path, params) {
    return request('GET', path, { params });
  },

  /**
   * GET all pages of a collection.
   * Merges the _embedded array from each page into a flat array.
   * `embedKey` is the key inside `_embedded` (e.g. 'conversations', 'customers').
   */
  async getAll(path, embedKey, params = {}) {
    const results = [];
    let page = 1;

    while (true) {
      const data = await request('GET', path, { params: { ...params, page } });
      const items = data?._embedded?.[embedKey] ?? [];
      results.push(...items);

      const totalPages = data?.page?.totalPages ?? 1;
      if (page >= totalPages) break;
      page++;
    }

    return results;
  },

  async post(path, body) {
    return request('POST', path, { body });
  },

  async put(path, body) {
    return request('PUT', path, { body });
  },

  async patch(path, body) {
    return request('PATCH', path, { body });
  },

  async delete(path) {
    return request('DELETE', path);
  },
};

// Conversation numbers (shown in the web UI) are small and sequential per
// account; IDs are large. Values below this are tried as a number first.
export const CONVERSATION_NUMBER_THRESHOLD = 100000;

/**
 * Fetch a conversation given either its ID or its web UI number.
 * Tries the more likely interpretation first, falling back to the other.
 * `params` are passed to the final GET (e.g. `{ embed: 'threads' }`).
 */
export async function getConversationByIdOrNumber(value, { params, client = mailbox } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid conversation ID or number: ${value}`);
  }

  const byId = async () => {
    try {
      return await client.get(`/conversations/${n}`, params);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  };
  const byNumber = async () => {
    const data = await client.get('/conversations', { number: n, status: 'all' });
    const match = data?._embedded?.conversations?.[0];
    return match ? client.get(`/conversations/${match.id}`, params) : null;
  };

  const order = n < CONVERSATION_NUMBER_THRESHOLD ? [byNumber, byId] : [byId, byNumber];
  for (const attempt of order) {
    const found = await attempt();
    if (found) return found;
  }
  throw Object.assign(new Error(`Conversation not found by ID or number: ${n}`), { status: 404 });
}
