import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// Set env vars before dynamic import so jwtToken.js does not call process.exit(1)
process.env.JWT_SECRET = 'test-ci-secret-key-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '1h';

const { createToken, verifyToken, getCookieOptions } = await import('../utils/jwtToken.js');

const mockUser = { _id: 'user123', email: 'test@example.com', name: 'Test User' };

describe('createToken', () => {
  test('returns a non-empty string', () => {
    const token = createToken(mockUser);
    assert.strictEqual(typeof token, 'string');
    assert.ok(token.length > 10);
  });

  test('encodes user id, email, and name in payload', () => {
    const token = createToken(mockUser);
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, mockUser._id);
    assert.strictEqual(decoded.email, mockUser.email);
    assert.strictEqual(decoded.name, mockUser.name);
  });
});

describe('verifyToken', () => {
  test('returns null for an invalid token', () => {
    assert.strictEqual(verifyToken('not-a-valid-token'), null);
  });

  test('returns null for a tampered token', () => {
    const token = createToken(mockUser);
    assert.strictEqual(verifyToken(token + 'tampered'), null);
  });

  test('returns decoded payload for a valid token', () => {
    const token = createToken(mockUser);
    const decoded = verifyToken(token);
    assert.ok(decoded);
    assert.strictEqual(typeof decoded.iat, 'number');
    assert.strictEqual(typeof decoded.exp, 'number');
  });
});

describe('getCookieOptions', () => {
  test('httpOnly is true', () => {
    assert.strictEqual(getCookieOptions().httpOnly, true);
  });

  test('path is /', () => {
    assert.strictEqual(getCookieOptions().path, '/');
  });

  test('maxAge matches 3 days in milliseconds', () => {
    assert.strictEqual(getCookieOptions().maxAge, 3 * 24 * 60 * 60 * 1000);
  });

  test('sameSite is lax', () => {
    assert.strictEqual(getCookieOptions().sameSite, 'lax');
  });
});
