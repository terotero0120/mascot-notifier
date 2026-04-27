import { describe, expect, it } from 'vitest';
import { BoundedCache, fallbackName, normalizeWinId, resolveAppNameWin } from './appNameResolver';

describe('BoundedCache', () => {
  it('stores and retrieves values', () => {
    const c = new BoundedCache(3);
    c.set('a', '1');
    expect(c.get('a')).toBe('1');
  });

  it('evicts the oldest entry once capacity is exceeded', () => {
    const c = new BoundedCache(3);
    c.set('a', '1');
    c.set('b', '2');
    c.set('c', '3');
    c.set('d', '4'); // should evict 'a'
    expect(c.has('a')).toBe(false);
    expect(c.get('b')).toBe('2');
    expect(c.get('c')).toBe('3');
    expect(c.get('d')).toBe('4');
  });

  it('marks an entry as most-recent on get so it survives eviction', () => {
    const c = new BoundedCache(3);
    c.set('a', '1');
    c.set('b', '2');
    c.set('c', '3');
    // Touch 'a' so it becomes most recent
    c.get('a');
    c.set('d', '4'); // should now evict 'b' instead of 'a'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
  });

  it('re-setting an existing key updates recency', () => {
    const c = new BoundedCache(2);
    c.set('a', '1');
    c.set('b', '2');
    c.set('a', '11'); // refresh 'a'
    c.set('c', '3'); // should evict 'b'
    expect(c.get('a')).toBe('11');
    expect(c.has('b')).toBe(false);
    expect(c.get('c')).toBe('3');
  });
});

describe('fallbackName', () => {
  it('returns the last dot-separated segment', () => {
    expect(fallbackName('com.tinyspeck.slackmacgap')).toBe('slackmacgap');
  });

  it('returns the identifier itself when there is no dot', () => {
    expect(fallbackName('Slack')).toBe('Slack');
  });

  it('returns the input string when it ends with an empty segment', () => {
    expect(fallbackName('com.example.')).toBe('com.example.');
  });
});

describe('normalizeWinId', () => {
  it('strips the "!" suffix and _hash', () => {
    expect(normalizeWinId('Microsoft.Teams2_8wekyb3d8bbwe!MSTeams')).toBe('Microsoft.Teams2');
  });

  it('returns the id unchanged when it has no "!" or "_"', () => {
    expect(normalizeWinId('Microsoft.WindowsStore')).toBe('Microsoft.WindowsStore');
  });

  it('strips _hash even without "!"', () => {
    expect(normalizeWinId('Microsoft.Teams_abc')).toBe('Microsoft.Teams');
  });
});

describe('resolveAppNameWin', () => {
  it('returns the known PWA host name when appId is a URL after "!"', () => {
    expect(resolveAppNameWin('SomePrefix!https://chat.google.com/messages')).toBe('Google Chat');
  });

  it('returns the registrable domain label when host is not a known PWA', () => {
    expect(resolveAppNameWin('SomePrefix!https://example.co.jp/foo')).toBe('example');
    expect(resolveAppNameWin('SomePrefix!https://example.com/foo')).toBe('example');
    expect(resolveAppNameWin('SomePrefix!https://www.example.co.jp/foo')).toBe('example');
  });

  it('returns the app slug for PWAs hosted on private PSL domains', () => {
    expect(resolveAppNameWin('SomePrefix!https://my-app.vercel.app/')).toBe('my-app');
    expect(resolveAppNameWin('SomePrefix!https://foo.github.io/')).toBe('foo');
  });

  it('falls back to descriptive segment for package-style ids', () => {
    // "stable" is non-descriptive, so should pick the next meaningful segment
    expect(resolveAppNameWin('com.example.MyApp.stable')).toBe('MyApp');
  });

  it('skips known non-descriptive segments', () => {
    expect(resolveAppNameWin('com.google.Chrome.beta')).toBe('Chrome');
    expect(resolveAppNameWin('foo.bar.Baz.app')).toBe('Baz');
  });

  it('strips _hash from the picked segment', () => {
    expect(resolveAppNameWin('Microsoft.Teams2_8wekyb3d8bbwe')).toBe('Teams2');
  });

  it('returns the appId itself when nothing descriptive is found', () => {
    expect(resolveAppNameWin('app')).toBe('app');
  });

  it('handles a malformed URL after "!" by falling back to segment parsing', () => {
    // URL parsing will throw, so falls through to segment logic on the part before "!"
    expect(resolveAppNameWin('Microsoft.Teams!not a url')).toBe('Teams');
  });
});
