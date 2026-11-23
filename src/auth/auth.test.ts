import { describe, expect, it } from 'vitest';
import { isAppleMobile, isTokenValid } from './auth';

describe('isAppleMobile', () => {
  it('detects iPhone, iPad and iPadOS desktop-mode UA', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isAppleMobile('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5)).toBe(true);
  });
  it('does not match real Macs, Android or Windows', () => {
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0)).toBe(false);
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false);
    expect(isAppleMobile('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe(false);
  });
});
import { parseTokenFragment } from './redirectProvider';

describe('isTokenValid', () => {
  const now = 1_000_000;
  it('rejects missing token', () => {
    expect(isTokenValid(null, now)).toBe(false);
  });
  it('accepts token with enough lifetime left', () => {
    expect(isTokenValid({ accessToken: 'x', expiresAt: now + 10 * 60_000 }, now)).toBe(true);
  });
  it('rejects token expiring within the safety margin', () => {
    expect(isTokenValid({ accessToken: 'x', expiresAt: now + 30_000 }, now)).toBe(false);
  });
});

describe('parseTokenFragment', () => {
  it('reads token, lifetime and state', () => {
    expect(parseTokenFragment('#access_token=abc&token_type=Bearer&expires_in=3599&state=s1')).toEqual({
      accessToken: 'abc',
      expiresIn: 3599,
      state: 's1',
    });
  });
  it('returns null without token (e.g. error=access_denied)', () => {
    expect(parseTokenFragment('#error=access_denied&state=s1')).toBeNull();
  });
});
