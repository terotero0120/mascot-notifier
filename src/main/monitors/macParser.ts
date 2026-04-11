/**
 * Pure functions for extracting notification fields from a decoded bplist object.
 * Kept free of native module imports (better-sqlite3 / bplist-parser) so it can be unit-tested.
 */

export interface ParsedMacNotification {
  sender: string;
  body: string;
  bundleId: string;
}

/**
 * Extract sender / body / bundleId from an already-decoded bplist root object.
 * Returns null when the required `body` field cannot be found.
 */
export function extractMacNotification(
  root: Record<string, unknown> | null | undefined,
): ParsedMacNotification | null {
  if (!root) return null;

  const req = root.req as Record<string, unknown> | undefined;
  if (!req) return null;

  const bundleId = typeof root.app === 'string' ? (root.app as string) : '';

  let body = '';
  if (typeof req.body === 'string') {
    body = req.body;
  } else if (Array.isArray(req.body)) {
    const strings = (req.body as unknown[]).filter(
      (item): item is string => typeof item === 'string' && !item.includes('Notification'),
    );
    body = strings[0] || String(req.body);
  }

  let sender = '';
  if (typeof req.titl === 'string') {
    sender = req.titl;
  }

  if (!sender && bundleId) {
    const parts = bundleId.split('.');
    sender = parts[parts.length - 1];
  }

  if (!body) return null;

  return { sender: sender || 'Unknown', body, bundleId };
}
