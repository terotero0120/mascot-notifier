import { describe, expect, it } from 'vitest';
import {
  FILETIME_TICKS_PER_SECOND,
  FILETIME_UNIX_EPOCH_OFFSET,
  fileTimeToUnixMs,
  parseWindowsPayload,
  unixSecondsToFileTime,
} from './windowsParser';

describe('FILETIME conversion', () => {
  it('fileTimeToUnixMs returns 0 at the Unix epoch', () => {
    const filetimeAtEpoch = FILETIME_UNIX_EPOCH_OFFSET * FILETIME_TICKS_PER_SECOND;
    expect(fileTimeToUnixMs(filetimeAtEpoch)).toBe(0);
  });

  it('unixSecondsToFileTime and fileTimeToUnixMs round-trip', () => {
    const unixSec = 1_700_000_000; // 2023-11-14T22:13:20Z
    const ft = unixSecondsToFileTime(unixSec);
    expect(fileTimeToUnixMs(ft)).toBe(unixSec * 1000);
  });

  it('unixSecondsToFileTime applies the 1601 epoch offset', () => {
    // At Unix epoch, FILETIME should be exactly the offset in ticks.
    expect(unixSecondsToFileTime(0)).toBe(FILETIME_UNIX_EPOCH_OFFSET * FILETIME_TICKS_PER_SECOND);
  });
});

describe('parseWindowsPayload', () => {
  it('returns null when payload has no text elements', () => {
    expect(parseWindowsPayload('<toast><visual/></toast>', null)).toBeNull();
    expect(parseWindowsPayload('', null)).toBeNull();
  });

  it('extracts a single <text> as body and derives sender from appId', () => {
    const payload = '<toast><visual><binding><text>Hello</text></binding></visual></toast>';
    const result = parseWindowsPayload(payload, 'com.microsoft.Teams2_8wekyb3d8bbwe');
    expect(result?.body).toBe('Hello');
    expect(result?.sender).toBe('Teams2');
    expect(result?.appId).toBe('com.microsoft.Teams2_8wekyb3d8bbwe');
  });

  it('uses first <text> as sender and second as body when both are present', () => {
    const payload =
      '<toast><visual><binding><text>Alice</text><text>Hello there</text></binding></visual></toast>';
    const result = parseWindowsPayload(payload, 'any.app.id');
    expect(result?.sender).toBe('Alice');
    expect(result?.body).toBe('Hello there');
  });

  it('handles <text> elements with attributes', () => {
    const payload = '<toast><text id="1">Alice</text><text id="2">Hello</text></toast>';
    const result = parseWindowsPayload(payload, null);
    expect(result?.sender).toBe('Alice');
    expect(result?.body).toBe('Hello');
  });

  it('trims whitespace inside <text> tags', () => {
    const payload = '<toast><text>  spaced body  </text></toast>';
    const result = parseWindowsPayload(payload, 'foo');
    expect(result?.body).toBe('spaced body');
  });

  it('falls back to "Unknown" sender when only one text exists and appId is empty', () => {
    const result = parseWindowsPayload('<toast><text>only</text></toast>', null);
    expect(result?.sender).toBe('Unknown');
    expect(result?.body).toBe('only');
    expect(result?.appId).toBe('');
  });

  it('is case-insensitive for <text> tag', () => {
    const payload = '<toast><Text>hey</Text></toast>';
    const result = parseWindowsPayload(payload, 'app');
    expect(result?.body).toBe('hey');
  });

  it('handles multiline text content', () => {
    const payload = '<toast><text>line one\nline two</text></toast>';
    const result = parseWindowsPayload(payload, 'app');
    expect(result?.body).toBe('line one\nline two');
  });
});
