import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildForwardHeaders } from '../../shared/traceHeaders.js';

describe('buildForwardHeaders', () => {
  test('always forwards x-trace-id from request when present', () => {
    const req = {
      headers: { 'x-trace-id': 'trace-123' },
    };

    const headers = buildForwardHeaders(req);

    assert.strictEqual(headers['x-trace-id'], 'trace-123');
  });

  test('falls back to req.traceId when x-trace-id header is missing', () => {
    const req = {
      headers: {},
      traceId: 'fallback-trace',
    };

    const headers = buildForwardHeaders(req);

    assert.strictEqual(headers['x-trace-id'], 'fallback-trace');
  });

  test('forwards W3C trace context headers when present', () => {
    const req = {
      headers: {
        'x-trace-id': 'trace-123',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'vendor=value',
        baggage: 'user.id=42',
      },
    };

    const headers = buildForwardHeaders(req);

    assert.strictEqual(headers.traceparent, req.headers.traceparent);
    assert.strictEqual(headers.tracestate, req.headers.tracestate);
    assert.strictEqual(headers.baggage, req.headers.baggage);
  });

  test('merges extra headers with precedence over defaults', () => {
    const req = {
      headers: { 'x-trace-id': 'trace-123' },
    };

    const headers = buildForwardHeaders(req, {
      'x-user-id': 'u-1',
      'x-trace-id': 'override-trace',
    });

    assert.strictEqual(headers['x-user-id'], 'u-1');
    assert.strictEqual(headers['x-trace-id'], 'override-trace');
  });
});
