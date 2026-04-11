import { describe, expect, it } from 'vitest';
import { extractMacNotification } from './macParser';

describe('extractMacNotification', () => {
  it('returns null when root is nullish', () => {
    expect(extractMacNotification(null)).toBeNull();
    expect(extractMacNotification(undefined)).toBeNull();
  });

  it('returns null when req is missing', () => {
    expect(extractMacNotification({ app: 'com.example.app' })).toBeNull();
  });

  it('returns null when body cannot be found', () => {
    expect(
      extractMacNotification({
        app: 'com.example.app',
        req: { titl: 'Only title, no body' },
      }),
    ).toBeNull();
  });

  it('extracts sender and body from a string body', () => {
    const result = extractMacNotification({
      app: 'com.tinyspeck.slackmacgap',
      req: { titl: 'Alice', body: 'Hello there' },
    });
    expect(result).toEqual({
      sender: 'Alice',
      body: 'Hello there',
      bundleId: 'com.tinyspeck.slackmacgap',
    });
  });

  it('extracts the first non-Notification string when body is an array', () => {
    const result = extractMacNotification({
      app: 'com.example.app',
      req: {
        titl: 'Bob',
        body: ['SomethingNotificationInternal', 'Actual message', 'Ignored'],
      },
    });
    expect(result?.body).toBe('Actual message');
    expect(result?.sender).toBe('Bob');
  });

  it('derives sender from bundleId when titl is missing', () => {
    const result = extractMacNotification({
      app: 'com.apple.MobileSMS',
      req: { body: 'New message' },
    });
    expect(result?.sender).toBe('MobileSMS');
    expect(result?.body).toBe('New message');
    expect(result?.bundleId).toBe('com.apple.MobileSMS');
  });

  it('falls back to "Unknown" when no sender can be derived', () => {
    const result = extractMacNotification({
      req: { body: 'Anonymous body' },
    });
    expect(result?.sender).toBe('Unknown');
    expect(result?.bundleId).toBe('');
  });

  it('ignores non-string app field', () => {
    const result = extractMacNotification({
      app: 42,
      req: { titl: 'T', body: 'B' },
    });
    expect(result?.bundleId).toBe('');
  });
});
