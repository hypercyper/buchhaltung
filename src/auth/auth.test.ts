import { describe, expect, it } from 'vitest';
import { isTokenValid } from './auth';
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
