/**
 * Pure helpers for the Windows notification monitor.
 * Kept free of native module imports (better-sqlite3) so it can be unit-tested.
 *
 * NOTE on precision: current FILETIME values (~1.3e17 ticks as of 2026) exceed
 * Number.MAX_SAFE_INTEGER (~9e15), so raw ticks cannot be represented exactly as
 * JS numbers. `fileTimeToUnixMs` is safe because `/ TICKS_PER_SECOND` scales the
 * value back into the safe range before returning ms. `unixSecondsToFileTime`
 * returns an approximate tick count (low bits may be rounded to the nearest
 * ~100ns); this is acceptable for `onStart()` where the value is only used as a
 * ">= lastArrival" cursor and sub-microsecond accuracy is irrelevant. If BigInt
 * support is added to the poll query in the future, migrate both helpers.
 */

export const FILETIME_UNIX_EPOCH_OFFSET = 11644473600;
export const FILETIME_TICKS_PER_SECOND = 10_000_000;

export interface ParsedWindowsNotification {
  sender: string;
  body: string;
  appId: string;
}

/**
 * Convert a Windows FILETIME tick count (100-ns since 1601-01-01) to
 * Unix epoch milliseconds.
 */
export function fileTimeToUnixMs(filetime: number): number {
  const unixSeconds = filetime / FILETIME_TICKS_PER_SECOND - FILETIME_UNIX_EPOCH_OFFSET;
  return unixSeconds * 1000;
}

/**
 * Convert Unix epoch seconds to a Windows FILETIME tick count.
 */
export function unixSecondsToFileTime(unixSeconds: number): number {
  return (unixSeconds + FILETIME_UNIX_EPOCH_OFFSET) * FILETIME_TICKS_PER_SECOND;
}

/**
 * Extract sender / body / appId from a WNS toast XML payload string.
 * Returns null when no <text> elements can be found.
 */
export function parseWindowsPayload(
  payload: string,
  appId: string | null,
): ParsedWindowsNotification | null {
  const texts = [...payload.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)].map((m) => m[1].trim());
  if (texts.length === 0) return null;

  const body = texts.length >= 2 ? texts[1] : texts[0];
  const sender =
    texts.length >= 2 ? texts[0] : (appId?.split('.').pop()?.replace(/_.*$/, '') ?? '');

  if (!body) return null;
  return { sender: sender || 'Unknown', body, appId: appId ?? '' };
}
