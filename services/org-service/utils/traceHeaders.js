export const buildForwardHeaders = (req, extraHeaders = {}) => {
  const headers = {
    'x-trace-id': req.headers['x-trace-id'] || req.traceId || 'unknown',
  };

  const passthroughHeaders = ['traceparent', 'tracestate', 'baggage'];
  passthroughHeaders.forEach((headerName) => {
    const value = req.headers[headerName];
    if (value) {
      headers[headerName] = value;
    }
  });

  return {
    ...headers,
    ...extraHeaders,
  };
};
