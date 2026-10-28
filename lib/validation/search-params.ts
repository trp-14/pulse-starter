export type SearchParamsResult = { ok: true; value: Record<string, string> } | { ok: false; key: string };

export const MAX_QUERY_KEYS = 20;

/** Flattens URLSearchParams into a plain object, rejecting repeated keys instead of silently picking one. */
export function searchParamsToObject(params: URLSearchParams): SearchParamsResult {
  const entries = new Map<string, string>();
  for (const [key, item] of params) {
    if (entries.has(key) || entries.size >= MAX_QUERY_KEYS) {
      return { ok: false, key };
    }
    entries.set(key, item);
  }
  return { ok: true, value: Object.fromEntries(entries) };
}
