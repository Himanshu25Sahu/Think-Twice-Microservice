import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { traceId } from '../middleware/traceId.js';

const makeReq = (headers = {}) => ({ headers, method: 'GET', url: '/test' });
const makeRes = () => {
  const headers = {};
  return {
    setHeader: (k, v) => { headers[k] = v; },
    _headers: headers,
  };
};

describe('traceId middleware', () => {
  test('forwards existing x-trace-id from the request', () => {
    const req = makeReq({ 'x-trace-id': 'abc-123' });
    const res = makeRes();
    let nextCalled = false;
    traceId(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.strictEqual(req.traceId, 'abc-123');
    assert.strictEqual(res._headers['x-trace-id'], 'abc-123');
  });

  test('generates a UUID when no x-trace-id header is present', () => {
    const req = makeReq({});
    const res = makeRes();
    traceId(req, res, () => {});
    assert.ok(req.traceId);
    assert.match(req.traceId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.strictEqual(res._headers['x-trace-id'], req.traceId);
  });

  test('calls next()', () => {
    const req = makeReq({});
    const res = makeRes();
    let nextCalled = false;
    traceId(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
  });

  test('two requests get different UUIDs', () => {
    const req1 = makeReq({});
    const req2 = makeReq({});
    const res = makeRes();
    traceId(req1, res, () => {});
    traceId(req2, res, () => {});
    assert.notStrictEqual(req1.traceId, req2.traceId);
  });
});
